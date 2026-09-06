package main

import "testing"

func TestH3FalPayloadSelectsTextAndImageEndpoints(t *testing.T) {
	textReq := ServiceUsageRequest{Prompt: "A fox runs", Duration: 5, AspectRatio: "16:9", Size: "preview", Seed: 7}
	if got := h3FalModel(textReq); got != h3FalTextModel {
		t.Fatalf("text model = %q", got)
	}
	text := h3FalPayload(textReq)
	if text["resolution"] != "480P" || text["aspect_ratio"] != "16:9" || text["seed"] != 7 {
		t.Fatalf("text payload = %#v", text)
	}

	imageReq := ServiceUsageRequest{Prompt: "She turns", Duration: 10, FirstFrame: "https://example.com/a.png", LastFrame: "https://example.com/b.png", Size: "native"}
	if got := h3FalModel(imageReq); got != h3FalImageModel {
		t.Fatalf("image model = %q", got)
	}
	image := h3FalPayload(imageReq)
	if image["resolution"] != "768P" || image["image_url"] != imageReq.FirstFrame || image["end_image_url"] != imageReq.LastFrame {
		t.Fatalf("image payload = %#v", image)
	}
	if _, ok := image["aspect_ratio"]; ok {
		t.Fatalf("image payload must inherit aspect ratio: %#v", image)
	}
}

func TestH3FalCompatibilityKeepsAdvancedRecipesOnRunpod(t *testing.T) {
	base := ServiceUsageRequest{Duration: 5, AspectRatio: "16:9", Size: "balanced"}
	if !h3FalCanHandle(base) {
		t.Fatal("simple request should use H3 Max")
	}
	upscale := true
	for _, req := range []ServiceUsageRequest{
		{Duration: 20, AspectRatio: "16:9"},
		{Duration: 5, AspectRatio: "16:9", AudioURL: "https://example.com/a.wav"},
		{Duration: 5, AspectRatio: "16:9", Loop: true},
		{Duration: 5, AspectRatio: "16:9", Keyframes: []string{"a", "b", "c"}},
		{Duration: 5, AspectRatio: "16:9", LatentUpscale: &upscale},
	} {
		if h3FalCanHandle(req) {
			t.Fatalf("advanced request unexpectedly eligible: %#v", req)
		}
	}
}

func TestParseFalH3ProviderJob(t *testing.T) {
	mode, id, ok := parseFalH3ProviderJob("fal-h3-image:req-123")
	if !ok || mode != "image" || id != "req-123" {
		t.Fatalf("parse = %q %q %t", mode, id, ok)
	}
	if _, _, ok := parseFalH3ProviderJob("fal:req-123"); ok {
		t.Fatal("unrelated fal job parsed as H3 Max")
	}
}

func TestH3FalProviderCostUsesResolutionRate(t *testing.T) {
	t.Setenv("H3_FAL_480P_USD_PER_SECOND", "0.025")
	t.Setenv("H3_FAL_768P_USD_PER_SECOND", "0.04")
	if got := h3FalProviderCost(ServiceUsageRequest{Duration: 5, Size: "preview"}); got != 0.125 {
		t.Fatalf("480P cost = %f", got)
	}
	if got := h3FalProviderCost(ServiceUsageRequest{Duration: 10, Size: "native"}); got != 0.4 {
		t.Fatalf("768P cost = %f", got)
	}
}
