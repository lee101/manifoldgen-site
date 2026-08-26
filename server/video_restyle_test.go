package main

import (
	"math"
	"testing"

	"github.com/valyala/fasthttp"
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

func TestH3ControlEstimateUsesMeasuredColdStartAndDuration(t *testing.T) {
	req := ServiceUsageRequest{Model: "h3-control", Resolution: "480p", Duration: 3}
	provider := restyleFalProviderCost(req)
	charged, _ := restyleEstimate(req)
	if math.Abs(provider-0.96) > 0.000001 || math.Abs(charged-1.16) > 0.000001 {
		t.Fatalf("provider=%f charged=%f", provider, charged)
	}
}

func TestNormalizeWanAnimationTransferDefaults(t *testing.T) {
	req := ServiceUsageRequest{
		Model: "wan-animate", Prompt: "A red stage costume", ImageURL: "https://cdn.example/subject.png",
		VideoURL: "https://cdn.example/dance.mp4",
	}
	if err := normalizeVideoRestyleRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Model != "wan-animate-2" || req.Duration != 5 || req.FramesPerSecond != 24 || req.NumFrames != 37 || req.NumSteps != 10 || req.Resolution != "preview" {
		t.Fatalf("unexpected animation defaults: %+v", req)
	}
}

func TestWanAnimationTransferRequiresSubjectImage(t *testing.T) {
	req := ServiceUsageRequest{Model: "wan-animate-2", Prompt: "A dancer", VideoURL: "https://cdn.example/dance.mp4"}
	if err := normalizeVideoRestyleRequest(&req); err == nil {
		t.Fatal("expected a subject image error")
	}
}

func TestWanAnimationTransferProviderContractAndMargin(t *testing.T) {
	preserveAudio := false
	req := ServiceUsageRequest{
		Model: "wan-animate-2", Prompt: "A dancer", ImageURL: "https://cdn.example/subject.png",
		VideoURL: "https://cdn.example/dance.mp4", Resolution: "preview", Duration: 5,
		FramesPerSecond: 24, NumFrames: 37, NumSteps: 10, Seed: 42, IncludeAudio: &preserveAudio,
	}
	input := privateRestyleProviderInput(req)
	if input["image"] != req.ImageURL || input["driving_video"] != req.VideoURL || input["quality"] != "preview" || input["max_seconds"] != 5 || input["frames_per_segment"] != 37 || input["preserve_audio"] != false || input["cgtaylor"] != false {
		t.Fatalf("unexpected worker input: %#v", input)
	}
	provider := restyleFalProviderCost(req)
	charged, credits := restyleEstimate(req)
	if math.Abs(provider-0.50) > 0.000001 || math.Abs(charged-1.00) > 0.000001 || math.Abs(credits-100) > 0.000001 {
		t.Fatalf("provider=%f charged=%f credits=%f", provider, charged, credits)
	}
}

func TestWanAnimationTransferDoesNotAllowFalRestyleFallback(t *testing.T) {
	if allowsFalVideoRestyle(ServiceUsageRequest{Model: "wan-animate-2"}) {
		t.Fatal("animation transfer must not fall back to ordinary video restyling")
	}
	if !allowsFalVideoRestyle(ServiceUsageRequest{Model: "wan-2.2"}) {
		t.Fatal("ordinary video restyling should retain its FAL fallback")
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

func TestNormalizeH3ControlDefaultsAndContract(t *testing.T) {
	req := ServiceUsageRequest{
		Model: "h3-control", Prompt: "A mage walking through an ancient forest",
		VideoURL: "https://cdn.example/walk.mp4", ControlType: "Pose", AcceptH3License: true,
	}
	if err := normalizeVideoRestyleRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.ControlType != "pose" || req.Duration != 5 || req.Resolution != "480p" || req.ControlScale != 1 || req.NumSteps != 20 || req.ControlPreprocess == nil || !*req.ControlPreprocess {
		t.Fatalf("unexpected control defaults: %+v", req)
	}
	input := privateRestyleProviderInput(req)
	if input["control_type"] != "pose" || input["preprocess"] != true || input["steps"] != 20 || input["video_url"] != req.VideoURL {
		t.Fatalf("unexpected control worker input: %#v", input)
	}
}

func TestH3ControlRequiresLicenseAndInpaintMask(t *testing.T) {
	base := ServiceUsageRequest{Model: "h3-control", Prompt: "replace coat", VideoURL: "https://cdn.example/walk.mp4", ControlType: "canny"}
	if err := normalizeVideoRestyleRequest(&base); err == nil {
		t.Fatal("expected license acceptance error")
	}
	base.AcceptH3License = true
	base.ControlType = "inpaint"
	if err := normalizeVideoRestyleRequest(&base); err == nil {
		t.Fatal("expected inpaint mask error")
	}
}

func TestH3ControlTerritoryGate(t *testing.T) {
	for _, country := range []string{"US", "GB", "KR", "DE", "FR", "NZ"} {
		excluded := h3ControlTerritoryExcluded(country)
		if country == "NZ" && excluded {
			t.Fatal("New Zealand must remain in the applicable territory")
		}
		if country != "NZ" && !excluded {
			t.Fatalf("%s should be excluded", country)
		}
	}
	t.Setenv("H3_CONTROL_REQUIRE_CF_COUNTRY", "true")
	var ctx fasthttp.RequestCtx
	if h3ControlRequestAllowed(&ctx) {
		t.Fatal("production must reject requests without a Cloudflare country")
	}
	ctx.Request.Header.Set("CF-IPCountry", "NZ")
	if !h3ControlRequestAllowed(&ctx) {
		t.Fatal("New Zealand request should be allowed")
	}
}

func TestH3ControlHasNoOrdinaryRestyleFallback(t *testing.T) {
	if allowsFalVideoRestyle(ServiceUsageRequest{Model: "h3-control"}) {
		t.Fatal("H3 control must not silently fall back to ordinary video restyling")
	}
}

func TestH3ControlRunpodProviderID(t *testing.T) {
	endpoint, job, ok := parseH3ControlProviderID("runpod-control:endpoint-1:job-2")
	if !ok || endpoint != "endpoint-1" || job != "job-2" {
		t.Fatalf("unexpected parse: endpoint=%q job=%q ok=%v", endpoint, job, ok)
	}
	if _, _, ok := parseH3ControlProviderID("runpod-control:missing"); ok {
		t.Fatal("malformed provider ID should be rejected")
	}
}
