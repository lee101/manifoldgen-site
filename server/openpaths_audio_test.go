package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func withOpenPathsAudioTestServer(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	previousURL, previousKey, previousClient := openPathsBaseURL, openPathsAPIKey, backendClient
	openPathsBaseURL, openPathsAPIKey, backendClient = server.URL, "test-openpaths-key", server.Client()
	t.Cleanup(func() { openPathsBaseURL, openPathsAPIKey, backendClient = previousURL, previousKey, previousClient })
}

func TestProxyOpenPathsGeminiTTSMultiSpeaker(t *testing.T) {
	withOpenPathsAudioTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/audio/speech" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-openpaths-key" {
			t.Fatalf("authorization = %q", r.Header.Get("Authorization"))
		}
		var payload map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload["model"] != "gemini-3.1-flash-tts-preview" || payload["input"] != "Speaker 1: Hello\nSpeaker 2: Hi" {
			t.Fatalf("payload = %#v", payload)
		}
		voices, _ := payload["speaker_voices"].([]interface{})
		if len(voices) != 2 {
			t.Fatalf("speaker voices = %#v", payload["speaker_voices"])
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"audio": "UklGRg==", "format": "wav", "characters": 30, "input_tokens": 12, "output_tokens": 640})
	})

	body, err := proxyOpenPathsGeminiTTS(ServiceUsageRequest{
		Input: "Speaker 1: Hello\nSpeaker 2: Hi",
		SpeakerVoices: []ServiceSpeakerVoice{
			{Speaker: "Speaker 1", Voice: "Fenrir"},
			{Speaker: "Speaker 2", Voice: "Puck"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]interface{}
	_ = json.Unmarshal(body, &result)
	if result["audio_base64"] != "UklGRg==" || result["format"] != "wav" {
		t.Fatalf("result = %#v", result)
	}
	if result["input_tokens"] != float64(12) || result["output_tokens"] != float64(640) {
		t.Fatalf("usage = %#v", result)
	}
}

func TestGeminiTTSTokenPricing(t *testing.T) {
	if got := geminiTTSCostUSD(1_000_000, 1_000_000); got != 25.20 {
		t.Fatalf("combined million-token price = %.2f, want 25.20", got)
	}
	body := []byte(`{"input_tokens":100,"output_tokens":200}`)
	got, inputTokens, outputTokens := geminiTTSResultCostUSD(body, 9)
	want := (100*1.20 + 200*24.00) / 1_000_000
	if got != want || inputTokens != 100 || outputTokens != 200 {
		t.Fatalf("cost=%f input=%d output=%d, want %f/100/200", got, inputTokens, outputTokens, want)
	}
}

func TestProxyOpenPathsLyriaDefaultsToOpus(t *testing.T) {
	withOpenPathsAudioTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/music/generations" {
			t.Fatalf("path = %q", r.URL.Path)
		}
		var payload map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&payload)
		if payload["model"] != "lyria-3-clip-preview" || payload["output_format"] != "opus" {
			t.Fatalf("payload = %#v", payload)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data":       map[string]interface{}{"audio": "T2dnUw==", "format": "opus", "mime_type": "audio/ogg;codecs=opus"},
			"extra_info": map[string]interface{}{"music_size": 524288},
		})
	})

	body, err := proxyOpenPathsLyria(ServiceUsageRequest{Model: "clip", Prompt: "A bright electronic loop"})
	if err != nil {
		t.Fatal(err)
	}
	var result map[string]interface{}
	_ = json.Unmarshal(body, &result)
	if result["format"] != "opus" || result["mime_type"] != "audio/ogg;codecs=opus" {
		t.Fatalf("result = %#v", result)
	}
}

func TestLyriaClipPrice(t *testing.T) {
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "lyria_generation", Model: "lyria-3-clip-preview"}); got != 0.04 {
		t.Fatalf("clip price = %.2f", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "lyria_generation", Model: "lyria-3-pro-preview"}); got != 0.08 {
		t.Fatalf("pro price = %.2f", got)
	}
}
