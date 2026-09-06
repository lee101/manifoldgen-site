package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const musicComposerSystem = `You write inputs for MiniMax Music 3, a lyrics-and-description music model.
Return ONLY one JSON object with: title, tags, lyrics, global_metadata, vocal_details, arrangement. Every value MUST be a JSON string, never an array or nested object.

The model was trained on a precise three-part caption. Write concrete musical direction and an evolving arrangement, not a static list of adjectives or equipment. Never contradict the user's constraints and never quote lyrics in the caption.

global_metadata is one paragraph in this exact order:
Basic Attributes: bpm is <number>. key is <letter>, and scale is <major|minor>. <genre and subgenre>.
Global Emotional Progression: <opening through final section>.
Application Scenarios & Imagery: <two or three vivid listening settings>.
Sonics & Production Profile: <soundstage, frequency balance, dynamics, production character>.

vocal_details is one paragraph in this exact order:
Vocal Gender & Timbre: Singer A (<Male|Female>), <timbre and register>.
Vocal Style: <delivery and section-by-section changes>.
Harmony/Backing Vocals: <where harmonies or doubles enter>.
Vocal FX: <restrained reverb, delay and compression that preserve a clear, close, full-bandwidth lead>.
For instrumental music, instead write "Instrumental, no vocals." and identify the lead melodic instrument or texture.

arrangement is one paragraph in this exact order:
Instrument Lifecycle Description (Primary/Secondary Layering): Primary: <core instruments and roles>. Secondary: <what enters, exits, or intensifies and in which sections>.
Groove & Foundation Progression: <how drums, bass and groove develop>.
Embellishments, Textures & Spatial FX: <fills, transitions, stereo and space treatment>.
Cover every lyric section and align the changes with its tags. Total caption length: 250-400 words.

Continuity and mix safety are mandatory unless the user explicitly requests an experimental degraded effect. Keep an audible rhythmic or harmonic bed through every transition. Never request silence, dropouts, mutes, hard gates, abrupt master-level jumps, sudden full-band filter closures, extreme phase cancellation, underwater filtering, random pitch instability, tape damage, glitch cuts, or reverb/delay that masks the lead. Prefer stable full-range tonality, controlled low mids, clear transients, centered intelligible vocals, conservative stereo widening, and smooth section changes. Never name, compare with, or imitate a real artist.

Lyrics must be singable and use only these tags, each alone on its own line: [intro] [verse] [pre-chorus] [chorus] [post-chorus] [bridge] [instrumental] [solo] [outro]. Musical instructions never go in lyrics. Use roughly 12-16 sung words per ten seconds and provide enough tagged sections to fill the requested duration without an empty tail. Every song must finish with an [outro] section; vocal songs put one or two singable closing lines after it. For instrumental music use tagged instrumental sections with no sung words. Write lyrics in the requested language, defaulting to English.

title is 2-5 words. tags is 3-5 short comma-separated feed tags. Unless explicitly instrumental, always specify a singer and write sung lyrics.`

const music3ContinuityCaption = "Mix Continuity: Maintain an audible rhythmic and harmonic bed through every transition with stable full-range tonality, controlled low mids, clear transients, centered intelligible lead vocals, and conservative stereo width. Use smooth automation only: no silence, dropout, mute, hard gate, abrupt level jump, full-band filter closure, underwater filtering, pitch instability, phase cancellation, glitch cut, or masking reverb/delay."

type musicComposition struct {
	Title          string `json:"title"`
	Tags           string `json:"tags"`
	Lyrics         string `json:"lyrics"`
	GlobalMetadata string `json:"global_metadata"`
	VocalDetails   string `json:"vocal_details"`
	Arrangement    string `json:"arrangement"`
	Caption        string `json:"caption"`
	Model          string `json:"model,omitempty"`
	ComposeMS      int64  `json:"compose_ms,omitempty"`
}

func musicComposerFieldText(value interface{}) string {
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	case []interface{}:
		parts := make([]string, 0, len(typed))
		for _, item := range typed {
			if text := musicComposerFieldText(item); text != "" {
				parts = append(parts, text)
			}
		}
		return strings.Join(parts, "\n")
	case map[string]interface{}:
		parts := make([]string, 0, len(typed))
		for key, item := range typed {
			parts = append(parts, strings.ReplaceAll(key, "_", " ")+": "+musicComposerFieldText(item))
		}
		return strings.Join(parts, " ")
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func music3BalancedCaption(globalMetadata, vocalDetails string) string {
	return strings.Join([]string{strings.TrimSpace(globalMetadata), strings.TrimSpace(vocalDetails), music3ContinuityCaption}, "\n")
}

var musicComposerHTTPClient = &http.Client{Timeout: 35 * time.Second}

func composeMusic3(ctx context.Context, description string, duration int, instrumental bool) (*musicComposition, error) {
	description = strings.TrimSpace(description)
	if len(description) < 10 || len(description) > 2000 {
		return nil, fmt.Errorf("song idea must be between 10 and 2000 characters")
	}
	if duration < 30 || duration > 300 {
		return nil, fmt.Errorf("duration must be between 30 and 300 seconds")
	}
	provider := strings.ToLower(strings.TrimSpace(getEnv("MUSIC_COMPOSER_PROVIDER", "openpaths")))
	key := strings.TrimSpace(os.Getenv("OPENPATHS_API_KEY"))
	endpoint := strings.TrimRight(getEnv("OPENPATHS_BASE_URL", "https://openpaths.io"), "/") + "/v1/chat/completions"
	model := strings.TrimSpace(getEnv("MUSIC_COMPOSER_MODEL", "deepseek-v4-flash"))
	if provider == "xai" {
		key = dramatizeXAIKey()
		endpoint = "https://api.x.ai/v1/chat/completions"
		model = strings.TrimSpace(getEnv("MUSIC_COMPOSER_MODEL", "grok-4-fast-non-reasoning"))
	}
	if key == "" {
		return nil, fmt.Errorf("music composer is not configured")
	}
	mode := "The song has sung vocals; choose a fitting singer when unspecified."
	if instrumental {
		mode = "This is strictly instrumental: no singer and no sung words."
	}
	user := fmt.Sprintf("Song idea: %s\nTarget duration: %d seconds.\n%s", description, duration, mode)
	payload := map[string]interface{}{
		"model":           model,
		"messages":        []map[string]string{{"role": "system", "content": musicComposerSystem}, {"role": "user", "content": user}},
		"temperature":     0.75,
		"response_format": map[string]string{"type": "json_object"},
	}
	if provider == "openpaths" {
		payload["thinking"] = map[string]string{"type": "disabled"}
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "manifoldgen-music-composer/1.0")
	started := time.Now()
	resp, err := musicComposerHTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("compose song: %w", err)
	}
	defer resp.Body.Close()
	blob, err := readLimited(resp.Body, 1<<20)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("composer returned %d: %s", resp.StatusCode, tailOutput(blob))
	}
	var answer struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(blob, &answer); err != nil || len(answer.Choices) == 0 {
		return nil, fmt.Errorf("composer returned an invalid response")
	}
	content := answer.Choices[0].Message.Content
	start, end := strings.Index(content, "{"), strings.LastIndex(content, "}")
	if start < 0 || end <= start {
		return nil, fmt.Errorf("composer returned no JSON")
	}
	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(content[start:end+1]), &raw); err != nil {
		return nil, fmt.Errorf("parse composition: %w", err)
	}
	result := musicComposition{
		Title: musicComposerFieldText(raw["title"]), Tags: musicComposerFieldText(raw["tags"]),
		Lyrics: musicComposerFieldText(raw["lyrics"]), GlobalMetadata: musicComposerFieldText(raw["global_metadata"]),
		VocalDetails: musicComposerFieldText(raw["vocal_details"]), Arrangement: musicComposerFieldText(raw["arrangement"]),
	}
	result.Title = strings.Trim(strings.TrimSpace(result.Title), "\"'")
	result.Tags = strings.TrimSpace(result.Tags)
	result.Lyrics = music3NormalizeTaggedLyrics(strings.TrimSpace(result.Lyrics))
	result.GlobalMetadata = strings.TrimSpace(result.GlobalMetadata)
	result.VocalDetails = strings.TrimSpace(result.VocalDetails)
	result.Arrangement = strings.TrimSpace(result.Arrangement)
	if result.Title == "" || result.GlobalMetadata == "" || result.VocalDetails == "" || result.Arrangement == "" || result.Lyrics == "" {
		return nil, fmt.Errorf("composer omitted required song fields")
	}
	// The fixed-seed ablation showed that metadata + vocals outperformed the
	// longer lifecycle caption. Keep the arrangement in the response for expert
	// editing, but default the GPU prompt to the faster, more stable profile.
	result.Caption = music3BalancedCaption(result.GlobalMetadata, result.VocalDetails)
	result.Model = model
	result.ComposeMS = time.Since(started).Milliseconds()
	return &result, nil
}

func handleMusicCompose(ctx *fasthttp.RequestCtx) {
	var input struct {
		Description  string `json:"description"`
		Duration     int    `json:"duration"`
		Instrumental bool   `json:"instrumental"`
	}
	if err := json.Unmarshal(ctx.PostBody(), &input); err != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid json")
		return
	}
	auth := strings.TrimPrefix(string(ctx.Request.Header.Peek("Authorization")), "Bearer ")
	if auth == "" || auth == string(ctx.Request.Header.Peek("Authorization")) {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}
	if _, err := dbConn.GetUserByAPIKey(auth); err != nil {
		jsonError(ctx, http.StatusUnauthorized, "invalid API key")
		return
	}
	result, err := composeMusic3(context.Background(), input.Description, input.Duration, input.Instrumental)
	if err != nil {
		jsonError(ctx, http.StatusServiceUnavailable, err.Error())
		return
	}
	jsonResponse(ctx, http.StatusOK, result)
}
