package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/valyala/fasthttp"
)

const voiceProviderMarkup = 1.20

type voiceModel struct {
	ID                   string   `json:"id"`
	Name                 string   `json:"name"`
	Description          string   `json:"description"`
	Endpoint             string   `json:"-"`
	ProviderUSDPerKChars float64  `json:"provider_usd_per_1000_characters,omitempty"`
	ProviderUSDPerMinute float64  `json:"provider_usd_per_minute,omitempty"`
	MaxCharacters        int      `json:"max_characters"`
	Voices               []string `json:"voices,omitempty"`
	Formats              []string `json:"formats"`
	SampleRates          []int    `json:"sample_rates,omitempty"`
	SupportsSpeed        bool     `json:"supports_speed"`
	SupportsPitch        bool     `json:"supports_pitch"`
	SupportsVolume       bool     `json:"supports_volume"`
	SupportsMood         bool     `json:"supports_mood"`
	SupportsVoiceDetails bool     `json:"supports_voice_details"`
}

var voiceModels = []voiceModel{
	{ID: "seed-audio-1", Name: "Seed Audio 1.0", Description: "Multi-speaker scenes with speech and ambience", Endpoint: "bytedance/seed-audio-1.0", ProviderUSDPerMinute: 0.1875, MaxCharacters: 2048, Formats: []string{"mp3", "wav", "ogg_opus"}, SampleRates: []int{24000, 8000, 16000, 32000, 44100, 48000}, SupportsSpeed: true, SupportsPitch: true, SupportsVolume: true, SupportsMood: true, SupportsVoiceDetails: true},
	{ID: "eleven-v3", Name: "ElevenLabs v3", Description: "Emotion and delivery control via inline tags", Endpoint: "fal-ai/elevenlabs/tts/eleven-v3", ProviderUSDPerKChars: 0.10, MaxCharacters: 15000, Voices: []string{"Aria", "Roger", "Sarah", "Laura", "Charlie", "George", "Callum", "River", "Liam", "Charlotte", "Alice", "Matilda"}, Formats: []string{"mp3", "wav", "opus"}, SampleRates: []int{44100, 22050}, SupportsSpeed: true, SupportsMood: true},
	{ID: "qwen3-tts", Name: "Qwen Audio 3.0 TTS", Description: "Natural speech with voice, style, and emotion control", Endpoint: "fal-ai/qwen-3-tts/text-to-speech/1.7b", ProviderUSDPerKChars: 0.09, MaxCharacters: 5000, Voices: []string{"Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"}, Formats: []string{"mp3"}, SampleRates: []int{24000}, SupportsMood: true, SupportsVoiceDetails: true},
	{ID: "minimax-2.8-hd", Name: "MiniMax Speech 2.8 HD", Description: "High-fidelity single-voice narration", Endpoint: "fal-ai/minimax/speech-2.8-hd", ProviderUSDPerKChars: 0.10, MaxCharacters: 5000, Voices: []string{"Wise_Woman", "Friendly_Person", "Inspirational_girl", "Deep_Voice_Man", "Calm_Woman", "Casual_Guy"}, Formats: []string{"mp3", "flac", "pcm"}, SampleRates: []int{24000, 8000, 16000, 22050, 32000, 44100}, SupportsSpeed: true, SupportsPitch: true, SupportsVolume: true, SupportsMood: true},
	{ID: "seed-speech", Name: "Seed Speech", Description: "Multilingual speech across 30+ languages", Endpoint: "fal-ai/bytedance/seed-speech/tts/v2", ProviderUSDPerKChars: 0.03, MaxCharacters: 5000, Voices: []string{"stokie_en", "dacey_en", "tim_en", "vivi_mixed_en_zh_ja_es_id", "mindy_en_es_id_pt_zh", "jess_ja_es_id_pt_en_zh", "sven_de", "usseau_fr", "felipe_es", "enzo_it"}, Formats: []string{"mp3", "opus"}, SampleRates: []int{24000, 8000, 16000, 22050, 32000, 44100, 48000}, SupportsSpeed: true, SupportsPitch: true, SupportsVolume: true, SupportsMood: true, SupportsVoiceDetails: true},
	{ID: "gemini-3.1-flash-tts", Name: "Google Gemini Voice", Description: "Expressive multilingual speech and dialogue", Endpoint: "fal-ai/gemini-3.1-flash-tts", ProviderUSDPerKChars: 0.15, MaxCharacters: 15000, Voices: []string{"Kore", "Puck", "Charon", "Zephyr", "Aoede", "Fenrir", "Leda", "Orus"}, Formats: []string{"mp3", "wav", "ogg_opus"}, SampleRates: []int{24000}, SupportsMood: true, SupportsVoiceDetails: true},
	{ID: "grok-voice", Name: "Grok Voice", Description: "Fast, expressive xAI voices with inline tags", Endpoint: "xai/tts/v1", ProviderUSDPerKChars: 0.015, MaxCharacters: 15000, Voices: []string{"eve", "ara", "rex", "sal", "leo"}, Formats: []string{"mp3"}, SampleRates: []int{24000}, SupportsMood: true},
}

type voiceGenerationInput struct {
	Model        string  `json:"model"`
	Text         string  `json:"text"`
	BatchSize    int     `json:"batch_size"`
	Voice        string  `json:"voice"`
	VoiceDetails string  `json:"voice_details"`
	Mood         string  `json:"mood"`
	Speed        float64 `json:"speed"`
	Pitch        int     `json:"pitch"`
	Volume       float64 `json:"volume"`
	OutputFormat string  `json:"output_format"`
	SampleRate   int     `json:"sample_rate"`
	Language     string  `json:"language"`
	Seed         int     `json:"seed"`
}

type voiceGenerationResult struct {
	ID              string  `json:"id"`
	AudioURL        string  `json:"audio_url"`
	Filename        string  `json:"filename"`
	Title           string  `json:"title"`
	DurationSeconds float64 `json:"duration_seconds,omitempty"`
	Format          string  `json:"format"`
	Seed            int     `json:"seed,omitempty"`
	CreatedAt       string  `json:"created_at,omitempty"`
}

func voiceFilename(text, format string, batchIndex int) string {
	var slug strings.Builder
	lastDash := false
	for _, character := range strings.ToLower(strings.TrimSpace(text)) {
		if (character >= 'a' && character <= 'z') || (character >= '0' && character <= '9') {
			slug.WriteRune(character)
			lastDash = false
		} else if character == '\'' || character == '’' {
			// Apostrophes join contractions instead of creating an extra word boundary.
			continue
		} else if slug.Len() > 0 && !lastDash {
			slug.WriteByte('-')
			lastDash = true
		}
		if slug.Len() >= 64 {
			break
		}
	}
	base := strings.Trim(slug.String(), "-")
	if base == "" {
		base = "voice"
	}
	if batchIndex > 0 {
		base += fmt.Sprintf("-%d", batchIndex+1)
	}
	extension := strings.ToLower(strings.TrimSpace(format))
	switch extension {
	case "ogg", "oga", "ogg_opus", "opus":
		extension = "opus"
	case "pcm":
		extension = "pcm"
	case "flac":
		extension = "flac"
	case "wav":
		extension = "wav"
	default:
		extension = "mp3"
	}
	return base + "." + extension
}

func voiceAssetResult(asset GeneratedAudio) voiceGenerationResult {
	format := strings.TrimPrefix(strings.ToLower(path.Ext(asset.AudioURL)), ".")
	if format == "" {
		format = "mp3"
	}
	filename := voiceFilename(asset.Prompt, format, 0)
	return voiceGenerationResult{
		ID: asset.ID, AudioURL: asset.AudioURL, Filename: filename, Title: asset.Title,
		DurationSeconds: float64(asset.DurationSeconds), Format: format, CreatedAt: asset.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func voiceModelByID(id string) (voiceModel, bool) {
	for _, model := range voiceModels {
		if model.ID == strings.ToLower(strings.TrimSpace(id)) {
			return model, true
		}
	}
	return voiceModel{}, false
}

func containsString(values []string, value string) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

func containsInt(values []int, value int) bool {
	for _, candidate := range values {
		if candidate == value {
			return true
		}
	}
	return false
}

func normalizeVoiceInput(input voiceGenerationInput) (voiceGenerationInput, voiceModel, error) {
	model, ok := voiceModelByID(input.Model)
	if !ok {
		return input, model, fmt.Errorf("unsupported voice model")
	}
	input.Text = strings.TrimSpace(input.Text)
	if input.Text == "" {
		return input, model, fmt.Errorf("text is required")
	}
	if utf8.RuneCountInString(input.Text) > model.MaxCharacters {
		return input, model, fmt.Errorf("%s supports up to %d characters", model.Name, model.MaxCharacters)
	}
	if input.BatchSize == 0 {
		input.BatchSize = 1
	}
	if input.BatchSize < 1 || input.BatchSize > 4 {
		return input, model, fmt.Errorf("batch size must be between 1 and 4")
	}
	if input.Speed == 0 {
		input.Speed = 1
	}
	if input.Speed < 0.5 || input.Speed > 2 {
		return input, model, fmt.Errorf("speed must be between 0.5 and 2.0")
	}
	if input.Volume == 0 {
		input.Volume = 1
	}
	if input.Volume < 0.1 || input.Volume > 2 {
		return input, model, fmt.Errorf("volume must be between 0.1 and 2.0")
	}
	if input.Pitch < -12 || input.Pitch > 12 {
		return input, model, fmt.Errorf("pitch must be between -12 and 12")
	}
	input.Mood = strings.ToLower(strings.TrimSpace(input.Mood))
	if input.Mood == "" {
		input.Mood = "neutral"
	}
	if !containsString([]string{"angry", "neutral", "happy"}, input.Mood) {
		return input, model, fmt.Errorf("mood must be angry, neutral, or happy")
	}
	input.VoiceDetails = strings.TrimSpace(input.VoiceDetails)
	if utf8.RuneCountInString(input.VoiceDetails) > 500 {
		return input, model, fmt.Errorf("voice details support up to 500 characters")
	}
	if input.OutputFormat == "" {
		input.OutputFormat = model.Formats[0]
	}
	if !containsString(model.Formats, input.OutputFormat) {
		return input, model, fmt.Errorf("%s does not support %s output", model.Name, input.OutputFormat)
	}
	if input.SampleRate == 0 {
		input.SampleRate = model.SampleRates[0]
	}
	if len(model.SampleRates) > 0 && !containsInt(model.SampleRates, input.SampleRate) {
		return input, model, fmt.Errorf("%s does not support %d Hz output", model.Name, input.SampleRate)
	}
	if input.Voice == "" && len(model.Voices) > 0 {
		input.Voice = model.Voices[0]
	}
	if input.Voice != "" && len(model.Voices) > 0 && !containsString(model.Voices, input.Voice) {
		return input, model, fmt.Errorf("unsupported %s voice", model.Name)
	}
	return input, model, nil
}

func voiceStyle(input voiceGenerationInput) string {
	parts := make([]string, 0, 2)
	if input.Mood != "" && input.Mood != "neutral" {
		parts = append(parts, "Speak in a "+input.Mood+" mood.")
	}
	if input.VoiceDetails != "" {
		parts = append(parts, input.VoiceDetails)
	}
	return strings.Join(parts, " ")
}

func elevenOutputFormat(format string, sampleRate int) string {
	switch format {
	case "wav":
		return fmt.Sprintf("pcm_%d", sampleRate)
	case "opus":
		return fmt.Sprintf("opus_%d_128", sampleRate)
	default:
		if sampleRate != 44100 && sampleRate != 22050 {
			sampleRate = 44100
		}
		return fmt.Sprintf("mp3_%d_128", sampleRate)
	}
}

func voiceFalPayload(input voiceGenerationInput, model voiceModel, seed int) map[string]interface{} {
	style := voiceStyle(input)
	switch model.ID {
	case "seed-audio-1":
		prompt := input.Text
		if style != "" {
			prompt = "[" + style + "]\n" + prompt
		}
		return map[string]interface{}{"prompt": prompt, "output_format": input.OutputFormat, "sample_rate": input.SampleRate, "speed": input.Speed, "volume": input.Volume, "pitch": input.Pitch}
	case "eleven-v3":
		text := input.Text
		if input.Mood != "neutral" {
			text = "[" + input.Mood + "] " + text
		}
		return map[string]interface{}{"text": text, "voice": input.Voice, "speed": input.Speed, "seed": seed, "output_format": elevenOutputFormat(input.OutputFormat, input.SampleRate)}
	case "qwen3-tts":
		return map[string]interface{}{"text": input.Text, "prompt": style, "voice": input.Voice, "language": "Auto"}
	case "minimax-2.8-hd":
		return map[string]interface{}{
			"prompt":         input.Text,
			"voice_setting":  map[string]interface{}{"voice_id": input.Voice, "speed": input.Speed, "vol": input.Volume, "pitch": input.Pitch, "emotion": input.Mood},
			"audio_setting":  map[string]interface{}{"sample_rate": input.SampleRate, "bitrate": 128000, "format": input.OutputFormat, "channel": 1},
			"language_boost": "auto", "output_format": "url",
		}
	case "seed-speech":
		payload := map[string]interface{}{"text": input.Text, "voice": input.Voice, "output_format": input.OutputFormat, "sample_rate": input.SampleRate, "speed": input.Speed, "volume": input.Volume, "pitch": input.Pitch, "voice_instruction": style}
		if input.Language != "" && input.Language != "auto" {
			payload["language"] = input.Language
		}
		return payload
	case "gemini-3.1-flash-tts":
		return map[string]interface{}{"prompt": input.Text, "style_instructions": style, "voice": input.Voice, "temperature": 1, "output_format": input.OutputFormat}
	case "grok-voice":
		text := input.Text
		if input.Mood != "neutral" {
			text = "[" + input.Mood + "] " + text
		}
		language := input.Language
		if language == "" {
			language = "auto"
		}
		return map[string]interface{}{"text": text, "voice": input.Voice, "language": language}
	default:
		return nil
	}
}

func voiceProviderPriceUSD(model voiceModel, characters int, durationSeconds float64) float64 {
	if model.ProviderUSDPerMinute > 0 {
		return model.ProviderUSDPerMinute * math.Max(0, durationSeconds) / 60
	}
	return model.ProviderUSDPerKChars * float64(characters) / 1000
}

func voiceChargedUSD(model voiceModel, characters int, durationSeconds float64) float64 {
	return math.Ceil(voiceProviderPriceUSD(model, characters, durationSeconds)*voiceProviderMarkup*1_000_000-1e-9) / 1_000_000
}

func voiceReserveUSD(model voiceModel, characters, batch int) float64 {
	if model.ProviderUSDPerMinute > 0 {
		// Seed Audio can create a full two-minute scene independent of script
		// length, so reserve its documented maximum and refund the difference.
		return voiceChargedUSD(model, characters, 120) * float64(batch)
	}
	return voiceChargedUSD(model, characters, 0) * float64(batch)
}

func voiceFalCall(input voiceGenerationInput, model voiceModel, seed int) ([]byte, error) {
	if falAPIKey == "" {
		return nil, fmt.Errorf("voice providers are not configured")
	}
	payload := voiceFalPayload(input, model, seed)
	body, _ := json.Marshal(payload)
	base := strings.TrimRight(getEnv("FAL_RUN_BASE_URL", "https://fal.run"), "/")
	req, err := http.NewRequest(http.MethodPost, base+"/"+model.Endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Key "+falAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	result, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("%s returned %d: %s", model.Name, resp.StatusCode, truncateString(string(result), 300))
	}
	return result, nil
}

func voiceResultDuration(body []byte) float64 {
	var payload map[string]interface{}
	if json.Unmarshal(body, &payload) != nil {
		return 0
	}
	if duration, ok := payload["duration_ms"].(float64); ok {
		return duration / 1000
	}
	if audio, ok := payload["audio"].(map[string]interface{}); ok {
		if duration, ok := audio["duration"].(float64); ok {
			return duration
		}
	}
	return 0
}

func voiceResultURL(body []byte) string {
	var payload struct {
		Audio struct {
			URL string `json:"url"`
		} `json:"audio"`
		AudioFile struct {
			URL string `json:"url"`
		} `json:"audio_file"`
	}
	if json.Unmarshal(body, &payload) == nil {
		if strings.TrimSpace(payload.Audio.URL) != "" {
			return strings.TrimSpace(payload.Audio.URL)
		}
		if strings.TrimSpace(payload.AudioFile.URL) != "" {
			return strings.TrimSpace(payload.AudioFile.URL)
		}
	}
	return studioMediaURL(body)
}

func handleVoiceModels(ctx *fasthttp.RequestCtx) {
	creditPrice := getCUTEPriceUSD()
	models := make([]map[string]interface{}, 0, len(voiceModels))
	for _, model := range voiceModels {
		encoded, _ := json.Marshal(model)
		var item map[string]interface{}
		_ = json.Unmarshal(encoded, &item)
		item["markup"] = voiceProviderMarkup
		if model.ProviderUSDPerKChars > 0 {
			item["price_usd_per_1000_characters"] = model.ProviderUSDPerKChars * voiceProviderMarkup
		}
		if model.ProviderUSDPerMinute > 0 {
			item["price_usd_per_minute"] = model.ProviderUSDPerMinute * voiceProviderMarkup
		}
		models = append(models, item)
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"models": models, "markup": voiceProviderMarkup, "credit_price_usd": creditPrice})
}

func handleVoiceGenerate(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	var input voiceGenerationInput
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid json")
		return
	}
	input, model, err := normalizeVoiceInput(input)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	creditPrice := getCUTEPriceUSD()
	if creditPrice <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing unavailable")
		return
	}
	characters := utf8.RuneCountInString(input.Text)
	reserveUSD := voiceReserveUSD(model, characters, input.BatchSize)
	reserveCredits := reserveUSD / creditPrice
	balance, err := dbConn.DeductUserCredits(user.ID, reserveCredits)
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.2f credits ($%.4f)", reserveCredits, reserveUSD))
		return
	}

	type generated struct {
		result voiceGenerationResult
		err    error
		cost   float64
	}
	generatedItems := make([]generated, input.BatchSize)
	var wait sync.WaitGroup
	for index := range generatedItems {
		wait.Add(1)
		go func(index int) {
			defer wait.Done()
			seed := input.Seed
			if seed == 0 {
				seed = int(time.Now().UnixNano()&0x7fffffff) + index
			} else {
				seed += index
			}
			body, callErr := voiceFalCall(input, model, seed)
			if callErr != nil {
				generatedItems[index].err = callErr
				return
			}
			sourceURL := voiceResultURL(body)
			if sourceURL == "" {
				generatedItems[index].err = fmt.Errorf("provider returned no audio")
				return
			}
			duration := voiceResultDuration(body)
			if duration <= 0 {
				duration = math.Min(120, math.Max(1, float64(characters)/12/input.Speed))
			}
			filename := voiceFilename(input.Text, input.OutputFormat, index)
			audioURL, persistErr := persistGeneratedAudioURLNamed(sourceURL, user.ID, filename)
			if persistErr != nil {
				log.Printf("voice output storage failed for %s: %v", model.ID, persistErr)
				audioURL = sourceURL
			}
			asset := &GeneratedAudio{ID: newUUID(), UserID: user.ID, Kind: "speech", Prompt: input.Text, Title: studioAudioTitle(input.Text), AudioURL: audioURL, DurationSeconds: int(math.Ceil(duration)), Public: false, CreatedAt: time.Now()}
			if insertErr := dbConn.InsertGeneratedAudio(asset); insertErr != nil {
				log.Printf("voice asset persistence failed for user %s: %v", user.ID, insertErr)
			}
			generatedItems[index].result = voiceGenerationResult{ID: asset.ID, AudioURL: audioURL, Filename: filename, Title: asset.Title, DurationSeconds: duration, Format: input.OutputFormat, Seed: seed, CreatedAt: asset.CreatedAt.UTC().Format(time.RFC3339)}
			generatedItems[index].cost = voiceChargedUSD(model, characters, duration)
		}(index)
	}
	wait.Wait()

	results := make([]voiceGenerationResult, 0, input.BatchSize)
	errorsOut := make([]string, 0)
	chargedUSD := 0.0
	for _, item := range generatedItems {
		if item.err != nil {
			log.Printf("voice generation failed for %s: %v", model.ID, item.err)
			errorsOut = append(errorsOut, "A batch item could not be generated")
			continue
		}
		results = append(results, item.result)
		chargedUSD += item.cost
	}
	if model.ProviderUSDPerKChars > 0 {
		chargedUSD = voiceChargedUSD(model, characters, 0) * float64(len(results))
	}
	chargedCredits := chargedUSD / creditPrice
	refundCredits := math.Max(0, reserveCredits-chargedCredits)
	if refundCredits > 0 {
		balance, _ = dbConn.AddUserCredits(user.ID, refundCredits)
	}
	if len(results) == 0 {
		jsonError(ctx, http.StatusBadGateway, "voice generation is temporarily unavailable")
		return
	}
	_ = dbConn.CreateBillingEvent(&BillingEvent{UserID: user.ID, EventType: "voice_generation", Amount: -chargedCredits, CuteAmount: chargedCredits, USDAmount: chargedUSD, Description: fmt.Sprintf("%s voice generation (%d item%s, %.0f%% provider markup)", model.Name, len(results), map[bool]string{true: "", false: "s"}[len(results) == 1], (voiceProviderMarkup-1)*100), CreditsAfter: balance})
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"model": model.ID, "results": results, "errors": errorsOut, "characters": characters, "credits_used": chargedCredits, "credits_remain": balance, "cost_usd": chargedUSD, "markup": voiceProviderMarkup})
}

func handleVoiceGenerations(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	assets, err := dbConn.ListGeneratedAudio(user.ID, "speech", 100)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not load voice history")
		return
	}
	results := make([]voiceGenerationResult, 0, len(assets))
	for _, asset := range assets {
		results = append(results, voiceAssetResult(asset))
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"results": results})
}

func voiceR2ObjectKey(rawURL string) (string, bool) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme != "https" || !strings.EqualFold(parsed.Hostname(), r2PublicHost) || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", false
	}
	objectKey := strings.TrimPrefix(parsed.EscapedPath(), "/")
	if decoded, decodeErr := url.PathUnescape(objectKey); decodeErr == nil {
		objectKey = decoded
	}
	prefix := strings.Trim(r2PathPrefix, "/") + "/"
	if !strings.HasPrefix(objectKey, prefix) || strings.Contains(objectKey, "..") {
		return "", false
	}
	return objectKey, true
}

func deleteGeneratedAudioObject(rawURL string) error {
	objectKey, managed := voiceR2ObjectKey(rawURL)
	if !managed {
		return nil
	}
	deleteURL, err := presignR2Object(http.MethodDelete, objectKey, 300)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodDelete, deleteURL, nil)
	if err != nil {
		return err
	}
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("audio storage returned %d", resp.StatusCode)
	}
	return nil
}

func handleDeleteVoiceGeneration(ctx *fasthttp.RequestCtx, assetID string) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	assetID = strings.TrimSpace(assetID)
	asset, err := dbConn.GetGeneratedAudio(user.ID, assetID)
	if err != nil {
		if err == sql.ErrNoRows {
			jsonError(ctx, http.StatusNotFound, "voice generation not found")
			return
		}
		jsonError(ctx, http.StatusInternalServerError, "could not load voice generation")
		return
	}
	if err := deleteGeneratedAudioObject(asset.AudioURL); err != nil {
		log.Printf("voice storage deletion failed asset=%s: %v", asset.ID, err)
		jsonError(ctx, http.StatusBadGateway, "could not delete stored voice audio")
		return
	}
	if err := dbConn.DeleteGeneratedAudio(user.ID, asset.ID); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not delete voice generation")
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]bool{"deleted": true})
}
