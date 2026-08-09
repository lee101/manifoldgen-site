package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestNormalizeH3LoopRequiresPublicAnchor(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "orbiting camera", Loop: true}
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("loop without an anchor should fail")
	}

	req = ServiceUsageRequest{Prompt: "orbiting camera", Loop: true, ImageURL: "https://cdn.example/anchor.webp"}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatalf("loop with image_url failed: %v", err)
	}
	if req.FirstFrame != req.ImageURL {
		t.Fatalf("first frame = %q, want image_url %q", req.FirstFrame, req.ImageURL)
	}
	if req.AspectRatio != "16:9" || req.Size != "balanced" || req.Duration != 5 || req.NumSteps != 20 {
		t.Fatalf("unexpected H3 defaults: %+v", req)
	}
}

func TestNormalizeH3LoopRejectsSeparateLastFrame(t *testing.T) {
	req := ServiceUsageRequest{
		Prompt: "orbiting camera", Loop: true,
		FirstFrame: "https://cdn.example/anchor.webp",
		LastFrame:  "https://cdn.example/other.webp",
	}
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("loop with an explicit last frame should fail because the Cog reuses first_frame")
	}
}

func TestAppNZH3LoopInputUsesOneExactAnchor(t *testing.T) {
	audio := false
	req := ServiceUsageRequest{
		Prompt: "a perfect seamless orbit", AspectRatio: "9:16", Size: "preview",
		Duration: 4, NumSteps: 12, OutputFormat: "mp4-h264", EncodeQuality: 24,
		FirstFrame: "https://manifoldgen.com/images/originals/loop.webp",
		Loop:       true, IncludeAudio: &audio,
	}
	input := appNZH3Input(req)
	if input["loop"] != true {
		t.Fatalf("loop = %#v, want true", input["loop"])
	}
	if input["first_frame"] != req.FirstFrame {
		t.Fatalf("first_frame = %#v, want %q", input["first_frame"], req.FirstFrame)
	}
	if _, exists := input["last_frame"]; exists {
		t.Fatal("last_frame must be omitted; h3-cog reuses the exact first_frame when loop=true")
	}
	if input["include_audio"] != false || input["steps"] != 12 || input["output_codec"] != "mp4-h264" {
		t.Fatalf("unexpected input: %#v", input)
	}
}

func TestCallAppNZH3PreservesLoopPayload(t *testing.T) {
	var received map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/api/cogs/run" {
			t.Fatalf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-appnz-key" {
			t.Fatalf("authorization header = %q", r.Header.Get("Authorization"))
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatal(err)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"success":    true,
			"prediction": map[string]interface{}{"id": "pred-loop-1", "status": "starting"},
		})
	}))
	defer srv.Close()

	oldBase, hadBase := os.LookupEnv("APPNZ_BASE_URL")
	oldKey, hadKey := os.LookupEnv("APPNZ_API_KEY")
	t.Cleanup(func() {
		if hadBase {
			_ = os.Setenv("APPNZ_BASE_URL", oldBase)
		} else {
			_ = os.Unsetenv("APPNZ_BASE_URL")
		}
		if hadKey {
			_ = os.Setenv("APPNZ_API_KEY", oldKey)
		} else {
			_ = os.Unsetenv("APPNZ_API_KEY")
		}
	})
	_ = os.Setenv("APPNZ_BASE_URL", srv.URL)
	_ = os.Setenv("APPNZ_API_KEY", "test-appnz-key")

	anchor := "https://manifoldgen.com/images/originals/loop.webp"
	payload := map[string]interface{}{
		"template": "minimax-h3",
		"name":     "minimax-h3-shared",
		"input":    map[string]interface{}{"prompt": "loop", "loop": true, "first_frame": anchor},
	}
	envelope, status, err := callAppNZH3(http.MethodPost, "/api/cogs/run", payload)
	if err != nil || status != http.StatusOK || envelope.Prediction.ID != "pred-loop-1" {
		t.Fatalf("response envelope=%+v status=%d err=%v", envelope, status, err)
	}
	input, _ := received["input"].(map[string]interface{})
	if input["first_frame"] != anchor || input["loop"] != true {
		t.Fatalf("received input = %#v", input)
	}
}

func TestH3LoopSettlementMarkupRoundsUp(t *testing.T) {
	if got := h3DownstreamMicros(1); got != h3MinimumChargeMicros {
		t.Fatalf("one micro provider cost settled to %d, want minimum %d", got, h3MinimumChargeMicros)
	}
	if got := h3DownstreamMicros(1_000_000); got != 1_500_000 {
		t.Fatalf("$1 provider cost settled to %d micros, want 1500000", got)
	}
}
