package main

import (
	"math"
	"testing"
)

func TestNormalizeVideoRestyleDefaults(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "watercolor", VideoURL: "https://cdn.example/source.mp4"}
	if err := normalizeVideoRestyleRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Model != "wan-2.2" || req.Strength != 0.9 || req.NumFrames != 81 || req.FramesPerSecond != 16 || req.Resolution != "720p" || req.AspectRatio != "auto" {
		t.Fatalf("unexpected restyle defaults: %+v", req)
	}
}

func TestNormalizeH3ReferencePrependsSourceAndPreservesOrder(t *testing.T) {
	req := ServiceUsageRequest{
		Model: "h3-reference", Prompt: "follow Video 1", VideoURL: "https://cdn.example/source.mp4",
		ReferenceVideoURLs: []string{"https://cdn.example/motion-2.mp4"},
		ReferenceImageURLs: []string{"https://cdn.example/character.png", "https://cdn.example/style.png"},
	}
	if err := normalizeVideoRestyleRequest(&req); err != nil {
		t.Fatal(err)
	}
	if len(req.ReferenceVideoURLs) != 2 || req.ReferenceVideoURLs[0] != req.VideoURL || req.ReferenceVideoURLs[1] != "https://cdn.example/motion-2.mp4" {
		t.Fatalf("source/order was not preserved: %#v", req.ReferenceVideoURLs)
	}
	if req.Duration != 10 || req.Resolution != "2K" || req.AspectRatio != "16:9" {
		t.Fatalf("unexpected reference defaults: %+v", req)
	}
}

func TestFalRestyleEstimateIncludesTwentyPercent(t *testing.T) {
	req := ServiceUsageRequest{Model: "wan-2.2", Resolution: "720p", NumFrames: 80, FramesPerSecond: 16}
	provider := restyleFalProviderCost(req)
	charged, _ := restyleEstimate(req)
	if math.Abs(provider-0.40) > 0.000001 || math.Abs(charged-0.48) > 0.000001 {
		t.Fatalf("provider=%f charged=%f", provider, charged)
	}
}

func TestH3ReferenceLimits(t *testing.T) {
	images := make([]string, 10)
	for index := range images {
		images[index] = "https://cdn.example/image-" + string(rune('a'+index)) + ".png"
	}
	req := ServiceUsageRequest{Model: "h3-reference", Prompt: "test", VideoURL: "https://cdn.example/source.mp4", ReferenceImageURLs: images}
	if err := normalizeVideoRestyleRequest(&req); err == nil {
		t.Fatal("expected the 9-image limit to be enforced")
	}
}
