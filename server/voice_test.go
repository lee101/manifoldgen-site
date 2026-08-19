package main

import (
	"encoding/json"
	"math"
	"testing"
)

func TestVoicePricingAddsTwentyPercent(t *testing.T) {
	model, ok := voiceModelByID("eleven-v3")
	if !ok {
		t.Fatal("eleven-v3 model missing")
	}
	if got := voiceChargedUSD(model, 1000, 0); got != 0.12 {
		t.Fatalf("1000 Eleven v3 characters = $%v, want $0.12", got)
	}
	seed, _ := voiceModelByID("seed-audio-1")
	if got := voiceChargedUSD(seed, 1000, 60); got != 0.225 {
		t.Fatalf("one Seed Audio minute = $%v, want $0.225", got)
	}
}

func TestNormalizeVoiceInput(t *testing.T) {
	input, model, err := normalizeVoiceInput(voiceGenerationInput{Model: "seed-speech", Text: " hello ", BatchSize: 4})
	if err != nil {
		t.Fatal(err)
	}
	if input.Text != "hello" || input.Speed != 1 || input.Volume != 1 || input.OutputFormat != "mp3" || input.SampleRate != 24000 || input.Voice != "stokie_en" || model.ID != "seed-speech" {
		t.Fatalf("unexpected normalized input: %#v", input)
	}
	if _, _, err := normalizeVoiceInput(voiceGenerationInput{Model: "seed-audio-1", Text: "x", BatchSize: 5}); err == nil {
		t.Fatal("expected invalid batch size")
	}
}

func TestVoiceFalPayloads(t *testing.T) {
	model, _ := voiceModelByID("minimax-2.8-hd")
	input, _, err := normalizeVoiceInput(voiceGenerationInput{Model: model.ID, Text: "Hello", Mood: "happy", Speed: 1.1, Volume: 1.2, Pitch: 2, OutputFormat: "mp3", SampleRate: 24000})
	if err != nil {
		t.Fatal(err)
	}
	payload := voiceFalPayload(input, model, 42)
	setting := payload["voice_setting"].(map[string]interface{})
	if setting["emotion"] != "happy" || setting["pitch"] != 2 {
		t.Fatalf("unexpected MiniMax voice setting: %#v", setting)
	}
	if payload["output_format"] != "url" {
		t.Fatalf("MiniMax output format = %#v", payload["output_format"])
	}
}

func TestVoiceResultDuration(t *testing.T) {
	if got := voiceResultDuration([]byte(`{"audio":{"url":"https://example.com/a.mp3","duration":2.75}}`)); math.Abs(got-2.75) > 0.0001 {
		t.Fatalf("duration = %v", got)
	}
	encoded, _ := json.Marshal(map[string]interface{}{"duration_ms": 1250})
	if got := voiceResultDuration(encoded); math.Abs(got-1.25) > 0.0001 {
		t.Fatalf("duration_ms = %v", got)
	}
}

func TestVoiceResultURL(t *testing.T) {
	if got := voiceResultURL([]byte(`{"audio":{"url":"https://example.com/voice.mp3"}}`)); got != "https://example.com/voice.mp3" {
		t.Fatalf("audio URL = %q", got)
	}
	if got := voiceResultURL([]byte(`{"audio_file":{"url":"https://example.com/legacy.wav"}}`)); got != "https://example.com/legacy.wav" {
		t.Fatalf("audio_file URL = %q", got)
	}
}

func TestVoiceFilename(t *testing.T) {
	if got := voiceFilename("Hi, how's it going?", "mp3", 0); got != "hi-hows-it-going.mp3" {
		t.Fatalf("filename = %q", got)
	}
	if got := voiceFilename("Hi, how's it going?", "ogg_opus", 1); got != "hi-hows-it-going-2.opus" {
		t.Fatalf("batch filename = %q", got)
	}
	if got := voiceFilename("A stored voice", "ogg", 0); got != "a-stored-voice.opus" {
		t.Fatalf("stored opus filename = %q", got)
	}
}

func TestVoiceR2ObjectKey(t *testing.T) {
	oldHost, oldPrefix := r2PublicHost, r2PathPrefix
	r2PublicHost, r2PathPrefix = "cdn.example.com", "gallery"
	defer func() { r2PublicHost, r2PathPrefix = oldHost, oldPrefix }()
	got, ok := voiceR2ObjectKey("https://cdn.example.com/gallery/user/audio/id-hi.mp3")
	if !ok || got != "gallery/user/audio/id-hi.mp3" {
		t.Fatalf("object key = %q, %v", got, ok)
	}
	if _, ok := voiceR2ObjectKey("https://evil.example/gallery/user/audio/id-hi.mp3"); ok {
		t.Fatal("accepted foreign storage host")
	}
}
