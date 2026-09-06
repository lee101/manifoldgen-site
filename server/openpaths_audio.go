package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	geminiTTSInputUSDPerMillion  = 1.20
	geminiTTSOutputUSDPerMillion = 24.00
)

func geminiTTSCostUSD(inputTokens, outputTokens int) float64 {
	return (float64(inputTokens)*geminiTTSInputUSDPerMillion + float64(outputTokens)*geminiTTSOutputUSDPerMillion) / 1_000_000
}

func estimateGeminiTTSUsage(input string) (int, int) {
	characters := utf8.RuneCountInString(strings.TrimSpace(input))
	if characters == 0 {
		return 0, 0
	}
	// Prompt text averages roughly four characters per token. Reserve four
	// audio tokens per character before generation; final billing settles to
	// the exact provider usage returned with the audio.
	return max(1, (characters+3)/4), max(1, characters*4)
}

func estimateGeminiTTSCostUSD(input string) float64 {
	inputTokens, outputTokens := estimateGeminiTTSUsage(input)
	return geminiTTSCostUSD(inputTokens, outputTokens)
}

func geminiTTSResultCostUSD(body []byte, fallback float64) (float64, int, int) {
	var result struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	}
	if json.Unmarshal(body, &result) != nil || result.InputTokens <= 0 || result.OutputTokens <= 0 {
		return fallback, result.InputTokens, result.OutputTokens
	}
	return geminiTTSCostUSD(result.InputTokens, result.OutputTokens), result.InputTokens, result.OutputTokens
}

func callOpenPathsAudio(path string, payload interface{}) ([]byte, error) {
	if strings.TrimSpace(openPathsAPIKey) == "" {
		return nil, fmt.Errorf("OpenPaths audio requires OPENPATHS_API_KEY")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, strings.TrimRight(openPathsBaseURL, "/")+path, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+openPathsAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "manifoldgen-spaces/1.0")

	client := *backendClient
	client.Timeout = 8 * time.Minute
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("OpenPaths audio returned %d: %s", resp.StatusCode, truncateString(string(responseBody), 500))
	}
	return responseBody, nil
}

func proxyOpenPathsGeminiTTS(req ServiceUsageRequest) ([]byte, error) {
	input := strings.TrimSpace(getTTSText(req))
	if input == "" {
		input = strings.TrimSpace(req.Prompt)
	}
	if input == "" {
		return nil, fmt.Errorf("input is required for Gemini TTS")
	}
	voice := strings.TrimSpace(req.Voice)
	if voice == "" {
		voice = "Zephyr"
	}
	language := strings.TrimSpace(req.Language)
	if language == "" {
		language = "en-US"
	}
	temperature := req.Temperature
	if temperature == 0 {
		temperature = 1
	}
	payload := map[string]interface{}{
		"model":       "gemini-3.1-flash-tts-preview",
		"input":       input,
		"voice":       voice,
		"language":    language,
		"temperature": temperature,
	}
	if len(req.SpeakerVoices) > 0 {
		payload["speaker_voices"] = req.SpeakerVoices
	}
	if req.AutoEmotion {
		payload["auto_emotion"] = true
	}
	body, err := callOpenPathsAudio("/v1/audio/speech", payload)
	if err != nil {
		return nil, err
	}
	var response struct {
		Audio        string `json:"audio"`
		AudioURL     string `json:"audio_url"`
		Format       string `json:"format"`
		Characters   int    `json:"characters"`
		InputTokens  int    `json:"input_tokens"`
		OutputTokens int    `json:"output_tokens"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("decode OpenPaths Gemini TTS response: %w", err)
	}
	if response.Audio == "" && response.AudioURL == "" {
		return nil, fmt.Errorf("OpenPaths Gemini TTS returned no audio")
	}
	return json.Marshal(map[string]interface{}{
		"audio_base64":  response.Audio,
		"audio_url":     response.AudioURL,
		"format":        response.Format,
		"characters":    response.Characters,
		"input_tokens":  response.InputTokens,
		"output_tokens": response.OutputTokens,
		"model":         "gemini-3.1-flash-tts-preview",
		"provider":      "openpaths",
	})
}

func normalizeLyriaModel(model string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(model)) {
	case "", "lyria-3-pro-preview", "lyria-pro", "pro":
		return "lyria-3-pro-preview", nil
	case "lyria-3-clip-preview", "lyria-clip", "clip":
		return "lyria-3-clip-preview", nil
	default:
		return "", fmt.Errorf("unsupported Lyria model")
	}
}

func proxyOpenPathsLyria(req ServiceUsageRequest) ([]byte, error) {
	model, err := normalizeLyriaModel(req.Model)
	if err != nil {
		return nil, err
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return nil, fmt.Errorf("prompt is required for Lyria")
	}
	format := strings.ToLower(strings.TrimSpace(req.OutputFormat))
	if format == "" {
		format = "opus"
	}
	if format != "opus" && format != "mp3" && format != "wav" {
		return nil, fmt.Errorf("unsupported Lyria output format")
	}
	body, err := callOpenPathsAudio("/v1/music/generations", map[string]interface{}{
		"model":         model,
		"prompt":        prompt,
		"output_format": format,
	})
	if err != nil {
		return nil, err
	}
	var response struct {
		Data struct {
			Audio    string `json:"audio"`
			Format   string `json:"format"`
			MimeType string `json:"mime_type"`
		} `json:"data"`
		ExtraInfo struct {
			Size     int `json:"music_size"`
			Duration int `json:"music_duration"`
		} `json:"extra_info"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("decode OpenPaths Lyria response: %w", err)
	}
	if response.Data.Audio == "" {
		return nil, fmt.Errorf("OpenPaths Lyria returned no audio")
	}
	return json.Marshal(map[string]interface{}{
		"audio_base64":     response.Data.Audio,
		"format":           response.Data.Format,
		"mime_type":        response.Data.MimeType,
		"size":             response.ExtraInfo.Size,
		"duration_seconds": response.ExtraInfo.Duration,
		"model":            model,
		"provider":         "openpaths",
	})
}
