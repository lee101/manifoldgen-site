package main

import (
	"encoding/json"
	"math"
	"testing"
	"time"
)

func TestH3FlexLaneReplacesNormalLaneOnlyWhenConfigured(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal-endpoint")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink-endpoint")
	prompt := "A glass hummingbird drinks from an orange flower, gentle camera push-in"
	if route := h3RouteForPrompt(prompt); route.Variant != h3NormalVariant {
		t.Fatalf("without flex env route = %#v", route)
	}
	t.Setenv("H3_FLEX_RUNPOD_ENDPOINT", "flex-endpoint")
	if route := h3RouteForPrompt(prompt); route.Variant != h3FlexVariant || route.RunpodEndpointID != "flex-endpoint" {
		t.Fatalf("flex route = %#v", route)
	}
	if route := h3RouteForPrompt("Two consenting adults have explicit sex in a hotel room"); route.Variant != h3PinkCherryVariant {
		t.Fatalf("adult prompts must keep their lane, got %#v", route)
	}
	stored, _ := json.Marshal(map[string]string{"_h3_variant": h3FlexVariant})
	if route := h3RouteForStoredJob(&VideoJob{Result: stored}); route.Variant != h3FlexVariant {
		t.Fatalf("stored flex job route = %#v", route)
	}
}

func TestPrepareH3FlexRequestRendersDefaultAtNativeAndLimitsHD(t *testing.T) {
	req := ServiceUsageRequest{Size: "balanced", Duration: 5}
	if err := prepareH3FlexRequest(&req); err != nil || req.Size != "native" {
		t.Fatalf("balanced -> %q, %v", req.Size, err)
	}
	hd := ServiceUsageRequest{Size: "hd", Duration: 15}
	if err := prepareH3FlexRequest(&hd); err == nil {
		t.Fatal("15 s 1080p must be rejected")
	}
	hd.Duration = 10
	if err := prepareH3FlexRequest(&hd); err != nil || hd.Size != "hd" {
		t.Fatalf("10 s 1080p: %q %v", hd.Size, err)
	}
	if h3FalCanHandle(ServiceUsageRequest{Size: "hd", Duration: 5}) {
		t.Fatal("fal H3 Max cannot render 1080p; it must never take an hd request")
	}
}

func TestH3FlexChargesFalListPriceAndMoreForHD(t *testing.T) {
	native := ServiceUsageRequest{Service: "h3_video", Size: "native", Duration: 5, NumSteps: 20, H3Lane: h3FlexVariant}
	flexUSD, _, flexSeconds := h3Estimate(native)
	falUSD := math.Ceil(h3FalProviderCost(native)*h3FalMarkup*100) / 100
	if flexUSD != falUSD {
		t.Fatalf("flex 5 s native $%.3f should equal the fal price $%.3f", flexUSD, falUSD)
	}
	if flexSeconds != h3FlexNative5sSeconds {
		t.Fatalf("flex seconds = %v", flexSeconds)
	}
	preview := native
	preview.Size = "preview"
	if previewUSD, _, _ := h3Estimate(preview); previewUSD >= flexUSD {
		t.Fatalf("preview $%.3f must cost less than native $%.3f", previewUSD, flexUSD)
	}
	hd := native
	hd.Size = "hd"
	hdUSD, _, _ := h3Estimate(hd)
	long := native
	long.Duration = 15
	longUSD, _, _ := h3Estimate(long)
	if hdUSD <= flexUSD || math.Abs(longUSD-3*flexUSD) > 0.011 {
		t.Fatalf("hd $%.3f 15s $%.3f vs 5s $%.3f", hdUSD, longUSD, flexUSD)
	}
	// The 1080p price must stay well above its GPU cost (~150 s on the PRO 6000).
	if gpuUSD := servicePricesUSD["h3_video"] * h3FlexPredictSeconds(hd) / 3600; hdUSD < 2.5*gpuUSD {
		t.Fatalf("hd $%.3f vs gpu $%.3f", hdUSD, gpuUSD)
	}
	if _, ok := h3FlexListPriceUSD(ServiceUsageRequest{Size: "audio", Duration: 5}); ok {
		t.Fatal("sound-only jobs keep metered pricing")
	}
}

func TestH3FlexFalPatienceParsing(t *testing.T) {
	t.Setenv("H3_FLEX_FAL_PATIENCE", "")
	if h3FlexFalPatience() != h3FlexFalPatienceDefault {
		t.Fatal("default patience")
	}
	t.Setenv("H3_FLEX_FAL_PATIENCE", "0")
	if h3FlexFalPatience() != 0 {
		t.Fatal("0 disables the fal fallback")
	}
	t.Setenv("H3_FLEX_FAL_PATIENCE", "45s")
	if h3FlexFalPatience() != 45*time.Second {
		t.Fatal("duration form")
	}
	t.Setenv("H3_FLEX_FAL_PATIENCE", "120")
	if h3FlexFalPatience() != 120*time.Second {
		t.Fatal("seconds form")
	}
}

func TestH3FlexStoredRequestKeepsDrivingAudioAndChargeCap(t *testing.T) {
	stored, _ := json.Marshal(map[string]interface{}{
		"prompt": "p", "aspect_ratio": "9:16", "size": "native", "duration": 6, "first_frame": "https://x/f.png",
		"audio": "https://x/a.wav", "_charge_cap_usd": 0.12,
	})
	job := &VideoJob{Result: stored}
	req, ok := h3FlexStoredRequest(job)
	if !ok || req.AspectRatio != "9:16" || req.Duration != 6 || req.FirstFrame != "https://x/f.png" || req.AudioURL != "https://x/a.wav" {
		t.Fatalf("stored request = %#v", req)
	}
	if h3FalCanHandle(req) {
		t.Fatal("audio-driven jobs must stay on the H3 worker")
	}
	if h3StoredChargeCap(job) != 0.12 {
		t.Fatal("charge cap not read")
	}
	if fallbackFlexToFal(&VideoJob{Result: stored, CreatedAt: time.Now()}, "ep", "job") {
		t.Fatal("a fresh job must not fall back")
	}
}
