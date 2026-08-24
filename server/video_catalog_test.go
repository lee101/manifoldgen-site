package main

import (
	"math"
	"testing"
)

// TestNewVideoCatalogAllowlists pins the Higgsfield-parity generators: Kling
// 3.0/2.6, Veo 3.1, Seedance 2.5, and Seedance 4K must be routable through
// video_generate with the right input requirements.
func TestNewVideoCatalogAllowlists(t *testing.T) {
	text := []string{
		"fal-ai/kling-video/v3/pro/text-to-video",
		"fal-ai/kling-video/v3/standard/text-to-video",
		"fal-ai/kling-video/v2.6/pro/text-to-video",
		"fal-ai/veo3.1",
		"fal-ai/veo3.1/fast",
		"seedance-2.5-text-to-video",
		"seedance-2.0-4k-text-to-video",
	}
	image := []string{
		"fal-ai/kling-video/v3/pro/image-to-video",
		"fal-ai/kling-video/v3/standard/image-to-video",
		"fal-ai/kling-video/v2.6/pro/image-to-video",
		"fal-ai/veo3.1/image-to-video",
		"fal-ai/veo3.1/fast/image-to-video",
		"seedance-2.5-image-to-video",
	}
	reference := []string{"seedance-2.5-reference-to-video"}

	for _, model := range append(append(append([]string{}, text...), image...), reference...) {
		if !allowedVideoModels[model] {
			t.Errorf("%s not allowed for video_generate", model)
		}
	}
	for _, model := range image {
		if !imageRequiredVideoModels[model] {
			t.Errorf("%s should require image_url", model)
		}
	}
	for _, model := range text {
		if imageRequiredVideoModels[model] {
			t.Errorf("%s must not require image_url", model)
		}
	}
	for _, model := range reference {
		if !referenceRequiredVideoModels[model] {
			t.Errorf("%s should require references", model)
		}
	}
}

// TestNewVideoCatalogPricing checks the public credit math: per-second cost
// times duration times the 1.20 downstream multiplier.
func TestNewVideoCatalogPricing(t *testing.T) {
	cases := []struct {
		model    string
		duration int
		want     float64
	}{
		{"fal-ai/kling-video/v3/standard/text-to-video", 5, 0.126 * 5 * 1.20},
		{"fal-ai/kling-video/v3/pro/image-to-video", 5, 0.168 * 5 * 1.20},
		{"fal-ai/kling-video/v2.6/pro/text-to-video", 10, 0.14 * 10 * 1.20},
		{"fal-ai/veo3.1/fast/image-to-video", 8, 0.15 * 8 * 1.20},
		{"fal-ai/veo3.1", 5, 0.40 * 5 * 1.20},
		{"seedance-2.5-text-to-video", 4, 0.473 * 4 * 1.20},
		{"seedance-2.0-4k-text-to-video", 4, 1.5552 * 4 * 1.20},
	}
	for _, c := range cases {
		got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "video_generate", Model: c.model, Duration: c.duration})
		if math.Abs(got-c.want) > 1e-9 {
			t.Errorf("%s %ds price = %v, want %v", c.model, c.duration, got, c.want)
		}
	}
}
