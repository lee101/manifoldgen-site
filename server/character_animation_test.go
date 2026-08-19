package main

import (
	"math"
	"testing"
)

func TestNormalizeCharacterAnimationRequest(t *testing.T) {
	req := ServiceUsageRequest{
		ImageURL: "https://cdn.example/character.png", VideoURL: "https://cdn.example/dance.mp4",
		Prompt: "A silver robot in a white studio",
	}
	if err := normalizeCharacterAnimationRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Duration != 5 || req.Width != 640 || req.Height != 800 || req.ExecutionProfile != "auto" || req.ServiceTier != "standard" || req.NumSteps != 10 || req.Guidance != 1 {
		t.Fatalf("unexpected defaults: %+v", req)
	}

	req.Width = 641
	if err := normalizeCharacterAnimationRequest(&req); err == nil {
		t.Fatal("expected alignment validation")
	}
}

func TestCharacterAnimationProviderID(t *testing.T) {
	endpoint, job, ok := parseCharacterAnimationProviderID("runpod-wan:endpoint-1:job-2")
	if !ok || endpoint != "endpoint-1" || job != "job-2" {
		t.Fatalf("unexpected parse result: %q %q %v", endpoint, job, ok)
	}
	if _, _, ok := parseCharacterAnimationProviderID("runpod-bg:endpoint:job"); ok {
		t.Fatal("accepted another service provider ID")
	}
}

func TestCharacterAnimationEstimateScalesWithDuration(t *testing.T) {
	one, _ := characterAnimationEstimate(ServiceUsageRequest{Duration: 1})
	five, _ := characterAnimationEstimate(ServiceUsageRequest{Duration: 5})
	eight, _ := characterAnimationEstimate(ServiceUsageRequest{Duration: 8})
	if math.Abs(one-0.75) > 1e-9 || math.Abs(five-0.75) > 1e-9 || math.Abs(eight-1.20) > 1e-9 {
		t.Fatalf("unexpected estimates: %f %f %f", one, five, eight)
	}
}

func TestCharacterAnimationServiceTiers(t *testing.T) {
	for tier, want := range map[string]float64{"standard": 0.75, "fast": 1.50, "xfast": 3.00} {
		got, _ := characterAnimationEstimate(ServiceUsageRequest{Duration: 5, ServiceTier: tier})
		if math.Abs(got-want) > 1e-9 {
			t.Fatalf("%s estimate = %.2f, want %.2f", tier, got, want)
		}
	}
	req := ServiceUsageRequest{ImageURL: "https://cdn.example/character.png", VideoURL: "https://cdn.example/dance.mp4", Prompt: "robot", ServiceTier: "turbo"}
	if err := normalizeCharacterAnimationRequest(&req); err == nil {
		t.Fatal("accepted invalid service tier")
	}
}

func TestCharacterAnimationEndpointByTier(t *testing.T) {
	t.Setenv("WAN_ANIMATE_RUNPOD_ENDPOINT_ID", "standard-id")
	t.Setenv("WAN_ANIMATE_FAST_RUNPOD_ENDPOINT_ID", "fast-id")
	t.Setenv("WAN_ANIMATE_XFAST_RUNPOD_ENDPOINT_ID", "xfast-id")
	if got := characterAnimationEndpointID("standard"); got != "standard-id" {
		t.Fatalf("standard = %q", got)
	}
	if got := characterAnimationEndpointID("fast"); got != "fast-id" {
		t.Fatalf("fast = %q", got)
	}
	if got := characterAnimationEndpointID("xfast"); got != "xfast-id" {
		t.Fatalf("xfast = %q", got)
	}
}

func TestCharacterAnimationWorkerInputMatchesWanHandler(t *testing.T) {
	req := ServiceUsageRequest{ImageURL: "https://cdn.example/character.png", VideoURL: "https://cdn.example/dance.mp4", Prompt: "robot", Duration: 5, NumSteps: 10, Seed: 42, ServiceTier: "fast"}
	got := characterAnimationWorkerInput(req, "https://upload.example/put", "https://cdn.example/output.mp4")
	for _, key := range []string{"image", "driving_video", "prompt", "quality", "max_seconds", "fps", "frames_per_segment", "steps", "seed", "_output_upload_url", "_output_public_url"} {
		if got[key] == nil {
			t.Fatalf("worker input is missing %q: %#v", key, got)
		}
	}
	for _, legacy := range []string{"character_image_url", "driving_video_url", "output_upload_url", "output_public_url"} {
		if got[legacy] != nil {
			t.Fatalf("worker input retained unsupported %q", legacy)
		}
	}
}

func TestCharacterAnimationDrainDelayCostsMostForStandard(t *testing.T) {
	if !(characterAnimationDrainDelay("xfast") < characterAnimationDrainDelay("fast") && characterAnimationDrainDelay("fast") < characterAnimationDrainDelay("standard")) {
		t.Fatal("higher-cost lanes must drain sooner")
	}
}
