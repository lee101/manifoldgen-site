package main

// Crazy Captions: word-level transcription of short audio chunks with Gemini.
// The browser decodes the video's soundtrack, cuts it into chunks of at most
// captionsMaxChunkSeconds, and posts each chunk as a 16-bit mono WAV so the
// whole tool stays inside fasthttp's default 4 MB body limit. Timings from the
// model are approximate; the browser snaps them to the real speech energy.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	captionsMaxChunkSeconds = 90.0
	captionsMinChunkSeconds = 0.3
	captionsCreditsPerChunk = 1.0
	captionsMaxWords        = 700
	captionsMaxHintRunes    = 800
)

var captionsSlots = make(chan struct{}, 12)

type CaptionWord struct {
	Text  string  `json:"w"`
	Start float64 `json:"s"`
	End   float64 `json:"e"`
}

type captionsWavInfo struct {
	SampleRate int
	Duration   float64
	Data       []byte
}

func captionsParseWav(body []byte) (captionsWavInfo, error) {
	var info captionsWavInfo
	if len(body) < 44 || string(body[0:4]) != "RIFF" || string(body[8:12]) != "WAVE" {
		return info, fmt.Errorf("audio must be a 16-bit mono WAV")
	}
	var channels, bits, format int
	pos := 12
	for pos+8 <= len(body) {
		id := string(body[pos : pos+4])
		size := int(binary.LittleEndian.Uint32(body[pos+4 : pos+8]))
		start := pos + 8
		end := start + size
		if end > len(body) || end < start {
			end = len(body)
		}
		switch id {
		case "fmt ":
			if end-start < 16 {
				return info, fmt.Errorf("invalid WAV header")
			}
			format = int(binary.LittleEndian.Uint16(body[start : start+2]))
			channels = int(binary.LittleEndian.Uint16(body[start+2 : start+4]))
			info.SampleRate = int(binary.LittleEndian.Uint32(body[start+4 : start+8]))
			bits = int(binary.LittleEndian.Uint16(body[start+14 : start+16]))
		case "data":
			info.Data = body[start:end]
		}
		pos = end + size&1
		if info.Data != nil {
			break
		}
	}
	if format != 1 || channels != 1 || bits != 16 {
		return info, fmt.Errorf("audio must be a 16-bit mono WAV")
	}
	if info.SampleRate < 8000 || info.SampleRate > 48000 {
		return info, fmt.Errorf("unsupported sample rate")
	}
	if len(info.Data) == 0 {
		return info, fmt.Errorf("audio is empty")
	}
	info.Duration = float64(len(info.Data)/2) / float64(info.SampleRate)
	return info, nil
}

var captionsBracketed = regexp.MustCompile(`^[\[\(\{<].*[\]\)\}>]$`)

// normalizeCaptionWords repairs model output: splits multi-word tokens, drops
// sound-effect tags, clamps to the clip, and makes the timeline strictly ordered.
func normalizeCaptionWords(raw []CaptionWord, duration float64) []CaptionWord {
	var expanded []CaptionWord
	for _, item := range raw {
		if math.IsNaN(item.Start) || math.IsNaN(item.End) || math.IsInf(item.Start, 0) || math.IsInf(item.End, 0) {
			continue
		}
		parts := strings.Fields(item.Text)
		if len(parts) == 0 {
			continue
		}
		if item.End < item.Start {
			item.Start, item.End = item.End, item.Start
		}
		total := 0
		for _, part := range parts {
			total += len([]rune(part))
		}
		cursor := item.Start
		for _, part := range parts {
			if captionsBracketed.MatchString(part) {
				continue
			}
			share := (item.End - item.Start) * float64(len([]rune(part))) / float64(total)
			expanded = append(expanded, CaptionWord{Text: part, Start: cursor, End: cursor + share})
			cursor += share
		}
	}
	sort.SliceStable(expanded, func(i, j int) bool { return expanded[i].Start < expanded[j].Start })
	words := make([]CaptionWord, 0, len(expanded))
	for _, word := range expanded {
		word.Start = math.Max(0, math.Min(word.Start, duration))
		word.End = math.Max(word.Start, math.Min(word.End, duration))
		if n := len(words); n > 0 && word.Start < words[n-1].End {
			words[n-1].End = math.Max(words[n-1].Start, word.Start)
		}
		words = append(words, word)
		if len(words) >= captionsMaxWords {
			break
		}
	}
	for i := range words {
		if words[i].End-words[i].Start < 0.04 {
			limit := duration
			if i+1 < len(words) {
				limit = words[i+1].Start
			}
			words[i].End = math.Min(limit, words[i].Start+0.04)
		}
		words[i].Start = math.Round(words[i].Start*1000) / 1000
		words[i].End = math.Round(words[i].End*1000) / 1000
	}
	return words
}

func captionsPrompt(language, hint string) string {
	var b strings.Builder
	b.WriteString(`Transcribe this audio verbatim for burned-in video captions. Return JSON {"words":[{"w":"word","s":0.000,"e":0.000}]}.
Rules: every spoken or sung word in order, including filler words and repeated words; keep punctuation attached to the word it follows; keep the original capitalization and spell numbers the way a subtitle editor would; s is the second (millisecond precision) the word starts being audible and e is when it stops, measured from the start of this clip; words never overlap; skip music-only passages, sound effects and silence; do not translate; never invent words that are not audible.`)
	if language != "" {
		b.WriteString("\nSpoken language: " + language + ".")
	}
	if hint != "" {
		b.WriteString("\nReference text that may help with spelling of names and lyrics (it may not match the audio exactly):\n" + hint)
	}
	return b.String()
}

func captionsModels() []string {
	if value := strings.TrimSpace(getEnv("CAPTIONS_GEMINI_MODEL", "")); value != "" {
		return strings.Split(value, ",")
	}
	return []string{"gemini-2.5-flash", "gemini-3-flash-preview"}
}

func captionsThinking(model string) map[string]interface{} {
	if strings.Contains(model, "gemini-3") {
		return map[string]interface{}{"thinkingLevel": "minimal"}
	}
	return map[string]interface{}{"thinkingBudget": 0}
}

var captionsGeminiCall = callCaptionsGemini

func callCaptionsGemini(ctx context.Context, wav []byte, prompt string) ([]CaptionWord, string, error) {
	key := dramatizeGeminiKey()
	if key == "" {
		return nil, "", fmt.Errorf("GEMINI_API_KEY is not set")
	}
	base := strings.TrimRight(getEnv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"), "/")
	audio := base64.StdEncoding.EncodeToString(wav)
	var last error
	for _, model := range captionsModels() {
		model = strings.TrimSpace(model)
		payload := map[string]interface{}{
			"contents": []map[string]interface{}{{"role": "user", "parts": []map[string]interface{}{
				{"text": prompt},
				{"inline_data": map[string]string{"mime_type": "audio/wav", "data": audio}},
			}}},
			"generationConfig": map[string]interface{}{
				"temperature":      0,
				"responseMimeType": "application/json",
				"thinkingConfig":   captionsThinking(model),
			},
		}
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, "", err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v1beta/models/%s:generateContent", base, model), bytes.NewReader(body))
		if err != nil {
			return nil, "", err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-goog-api-key", key)
		resp, err := dramatizePlannerClient.Do(req)
		if err != nil {
			last = err
			continue
		}
		blob, err := readLimited(resp.Body, 4<<20)
		resp.Body.Close()
		if err != nil {
			last = err
			continue
		}
		if resp.StatusCode >= 300 {
			last = fmt.Errorf("gemini %s returned %d: %s", model, resp.StatusCode, tailOutput(blob))
			continue
		}
		var parsed struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if json.Unmarshal(blob, &parsed) != nil {
			last = fmt.Errorf("parse gemini response")
			continue
		}
		var text strings.Builder
		for _, candidate := range parsed.Candidates {
			for _, part := range candidate.Content.Parts {
				text.WriteString(part.Text)
			}
		}
		words, err := parseCaptionWords(text.String())
		if err != nil {
			last = fmt.Errorf("gemini %s: %w", model, err)
			continue
		}
		return words, model, nil
	}
	if last == nil {
		last = fmt.Errorf("transcription unavailable")
	}
	return nil, "", last
}

func parseCaptionWords(text string) ([]CaptionWord, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("no transcription returned")
	}
	var reply struct {
		Words []CaptionWord `json:"words"`
	}
	if json.Unmarshal([]byte(extractJSONObject(text)), &reply) == nil && len(reply.Words) > 0 {
		return reply.Words, nil
	}
	var bare []CaptionWord
	if start := strings.Index(text, "["); start >= 0 && json.Unmarshal([]byte(text[start:strings.LastIndex(text, "]")+1]), &bare) == nil {
		return bare, nil
	}
	if reply.Words != nil || strings.Contains(text, `"words"`) {
		return nil, nil
	}
	return nil, fmt.Errorf("unreadable transcription")
}

func handleCaptionsTranscribe(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		authRequiredError(ctx, err.Error())
		return
	}
	info, err := captionsParseWav(ctx.PostBody())
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if info.Duration > captionsMaxChunkSeconds+0.5 {
		jsonError(ctx, http.StatusBadRequest, fmt.Sprintf("send chunks of at most %.0f seconds", captionsMaxChunkSeconds))
		return
	}
	if info.Duration < captionsMinChunkSeconds {
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{"words": []CaptionWord{}, "credits_used": 0})
		return
	}
	language := strings.TrimSpace(string(ctx.QueryArgs().Peek("language")))
	if len(language) > 40 {
		language = language[:40]
	}
	hint := strings.TrimSpace(string(ctx.QueryArgs().Peek("hint")))
	if runes := []rune(hint); len(runes) > captionsMaxHintRunes {
		hint = string(runes[:captionsMaxHintRunes])
	}
	select {
	case captionsSlots <- struct{}{}:
		defer func() { <-captionsSlots }()
	default:
		jsonError(ctx, http.StatusTooManyRequests, "transcription is busy; try again in a moment")
		return
	}
	balance, err := dbConn.DeductUserCredits(user.ID, captionsCreditsPerChunk)
	if err != nil {
		chargeError(ctx, err, "insufficient credits: transcription costs 1 credit per 90 seconds of audio")
		return
	}
	work, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	raw, model, err := captionsGeminiCall(work, ctx.PostBody(), captionsPrompt(language, hint))
	if err != nil {
		log.Printf("captions transcribe failed: %v", err)
		_, _ = dbConn.AddUserCredits(user.ID, captionsCreditsPerChunk)
		jsonError(ctx, http.StatusBadGateway, "transcription is temporarily unavailable")
		return
	}
	words := normalizeCaptionWords(raw, info.Duration)
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: "captions_transcribe", Amount: -captionsCreditsPerChunk,
		CuteAmount: captionsCreditsPerChunk, USDAmount: captionsCreditsPerChunk * getCUTEPriceUSD(),
		Description: "Crazy Captions transcription", CreditsAfter: balance,
	})
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"words": words, "duration": info.Duration, "model": model,
		"credits_used": captionsCreditsPerChunk, "credits_remain": balance,
	})
}
