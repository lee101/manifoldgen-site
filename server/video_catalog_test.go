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
		"kling-4.0-text-to-video",
		"fal-ai/veo3.1",
		"fal-ai/veo3.1/fast",
		"seedance-2.5-text-to-video",
		"seedance-2.0-4k-text-to-video",
	}
	image := []string{
		"fal-ai/kling-video/v3/pro/image-to-video",
		"fal-ai/kling-video/v3/standard/image-to-video",
		"fal-ai/kling-video/v2.6/pro/image-to-video",
		"kling-4.0-image-to-video",
		"fal-ai/veo3.1/image-to-video",
		"fal-ai/veo3.1/fast/image-to-video",
		"seedance-2.5-image-to-video",
	}
	reference := []string{"seedance-2.5-reference-to-video", "kling-4.0-reference-to-video"}

	for _, model := range append(append(append([]string{"kling-4.0-video-edit"}, text...), image...), reference...) {
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

func TestKling4Requirements(t *testing.T) {
	if !videoRequiredVideoModels["kling-4.0-video-edit"] {
		t.Error("kling-4.0-video-edit should require video_url")
	}
	base := ServiceUsageRequest{Service: "video_generate", Prompt: "p"}
	edit := base
	edit.Model = "kling-4.0-video-edit"
	if err := validateKling4Request(edit.Model, edit); err == nil {
		t.Error("edit without video_url should fail")
	}
	edit.VideoURL = "https://example.com/a.mp4"
	if err := validateKling4Request(edit.Model, edit); err != nil {
		t.Errorf("edit with video_url: %v", err)
	}
	bad := base
	bad.Model = "kling-4.0-text-to-video"
	bad.Resolution = "480p"
	if validateKling4Request(bad.Model, bad) == nil {
		t.Error("480p should be rejected")
	}
	bad.Resolution = ""
	bad.AspectRatio = "auto"
	if validateKling4Request(bad.Model, bad) == nil {
		t.Error("auto aspect only valid for reference")
	}
	ref := base
	ref.Model = "kling-4.0-reference-to-video"
	ref.AspectRatio = "auto"
	ref.ReferenceVideoURLs = []string{"file:///etc/passwd"}
	if validateKling4Request(ref.Model, ref) == nil {
		t.Error("non-http reference URL should be rejected")
	}
	for in, want := range map[int]int{0: 5, 1: 3, 3: 3, 12: 12, 30: 30, 99: 30} {
		if got := kling4Duration(in); got != want {
			t.Errorf("kling4Duration(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestKling4Pricing(t *testing.T) {
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want float64
	}{
		{"text 720p", ServiceUsageRequest{Model: "kling-4.0-text-to-video", Duration: 5, Resolution: "720p"}, 0.157 * 5 * 1.10},
		{"text 1080p", ServiceUsageRequest{Model: "kling-4.0-text-to-video", Duration: 10, Resolution: "1080p"}, 0.235 * 10 * 1.10},
		{"text default res and duration", ServiceUsageRequest{Model: "kling-4.0-text-to-video"}, 0.235 * 5 * 1.10},
		{"image 720p", ServiceUsageRequest{Model: "kling-4.0-image-to-video", Duration: 8, Resolution: "720p"}, 0.157 * 8 * 1.10},
		{"duration clamped to 30", ServiceUsageRequest{Model: "kling-4.0-text-to-video", Duration: 99, Resolution: "720p"}, 0.157 * 30 * 1.10},
		{"reference images only", ServiceUsageRequest{Model: "kling-4.0-reference-to-video", Duration: 5, Resolution: "720p", ReferenceImageURLs: []string{"https://x/a.png"}}, 0.157 * 5 * 1.10},
		{"reference with video 720p", ServiceUsageRequest{Model: "kling-4.0-reference-to-video", Duration: 5, Resolution: "720p", ReferenceVideoURLs: []string{"https://x/v.mp4"}}, 0.188 * 5 * 1.10},
		{"reference with video 1080p", ServiceUsageRequest{Model: "kling-4.0-reference-to-video", Duration: 5, ReferenceVideoURLs: []string{"https://x/v.mp4"}}, 0.282 * 5 * 1.10},
		{"edit 720p", ServiceUsageRequest{Model: "kling-4.0-video-edit", Duration: 6, Resolution: "720p", VideoURL: "https://x/v.mp4"}, 0.188 * 6 * 1.10},
		{"edit default", ServiceUsageRequest{Model: "kling-4.0-video-edit", VideoURL: "https://x/v.mp4"}, 0.282 * 5 * 1.10},
	}
	for _, c := range cases {
		c.req.Service = "video_generate"
		got := getRequestServicePriceUSD(c.req)
		if math.Abs(got-c.want) > 1e-9 {
			t.Errorf("%s price = %v, want %v", c.name, got, c.want)
		}
	}
}
