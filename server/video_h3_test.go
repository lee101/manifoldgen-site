package main

import "testing"

func TestH3RouteUsesDedicatedPinkCherryWorkerForExplicitAdultPrompt(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal-endpoint")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink-endpoint")
	route := h3RouteForPrompt("Two consenting adults have explicit sex in a hotel room")
	if route.Variant != h3PinkCherryVariant || route.RunpodEndpointID != "pink-endpoint" {
		t.Fatalf("explicit route = %#v", route)
	}
}

func TestH3RouteKeepsNormalPromptOnNormalWorker(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal-endpoint")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink-endpoint")
	route := h3RouteForPrompt("A glass hummingbird drinks from an orange flower, gentle camera push-in")
	if route.Variant != h3NormalVariant || route.RunpodEndpointID != "normal-endpoint" {
		t.Fatalf("normal route = %#v", route)
	}
}

func TestParseRunpodH3ProviderJob(t *testing.T) {
	endpoint, job, ok := parseRunpodH3ProviderJob("runpod:endpoint-1:job-1")
	if !ok || endpoint != "endpoint-1" || job != "job-1" {
		t.Fatalf("parse = %q %q %t", endpoint, job, ok)
	}
	if _, _, ok := parseRunpodH3ProviderJob("local:sync"); ok {
		t.Fatal("local job must not parse as RunPod")
	}
}

func TestNormalizeH3VideoRequestDefaults(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "neon alley rain"}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Size != "balanced" || req.NumSteps != 20 || req.Quant != "int8_convrot" {
		t.Fatalf("defaults = size=%s steps=%d quant=%s", req.Size, req.NumSteps, req.Quant)
	}
	if req.AspectRatio != "16:9" || req.OutputFormat != "webm-av1" {
		t.Fatalf("aspect/format = %s %s", req.AspectRatio, req.OutputFormat)
	}
}

func TestNormalizeH3AudioSizeAllowsLongDuration(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "soft rain ambience", Size: "audio", Duration: 45}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatal(err)
	}
	req.Duration = 46
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("expected duration reject for audio>45")
	}
	req = ServiceUsageRequest{Prompt: "x", Size: "balanced", Duration: 30}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatalf("expected chained duration 30 to be allowed: %v", err)
	}
	req = ServiceUsageRequest{Prompt: "x", Size: "balanced", Duration: 61}
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("expected duration reject for balanced>60")
	}
}

func TestNormalizeH3DrivingAudioRequiresImage(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "portrait speaking", AudioURL: "https://cdn.example/voice.wav"}
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("expected driving audio without a first frame to be rejected")
	}
	req.ImageURL = "https://cdn.example/portrait.png"
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatalf("expected image plus driving audio to be accepted: %v", err)
	}
	input := appNZH3Input(req)
	if input["first_frame"] != req.ImageURL || input["audio"] != req.AudioURL {
		t.Fatalf("asset input = %#v", input)
	}
}

func TestIsRunPodWorkersQuotaErr(t *testing.T) {
	if !isRunPodWorkersQuotaErr(fmtError("serverless: Max workers across all endpoints must not exceed your workers quota (5)")) {
		t.Fatal("expected quota match")
	}
	if isRunPodWorkersQuotaErr(fmtError("model not found")) {
		t.Fatal("did not expect quota match")
	}
}

func TestH3DownstreamPricingHasMarginAndMinimum(t *testing.T) {
	if got := h3DownstreamMicros(1); got != h3MinimumChargeMicros {
		t.Fatalf("minimum charge = %d, want %d", got, h3MinimumChargeMicros)
	}
	if got := h3DownstreamMicros(1_000_000); got != 1_500_000 {
		t.Fatalf("$1 provider charge = %d micros, want 1500000", got)
	}
}

type fmtError string

func (e fmtError) Error() string { return string(e) }
