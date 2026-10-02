package main

import (
	"math"
	"strings"
	"testing"
)

func TestRecastPriceCoversFalAndLoraFallback(t *testing.T) {
	for resolution, fal := range recastFalUSDPerSecond {
		if recastPriceUSDPerSecond[resolution] < fal*1.2-1e-9 {
			t.Fatalf("%s price %.2f is below fal+20%% (%.2f)", resolution, recastPriceUSDPerSecond[resolution], fal*1.2)
		}
		fallback := loraPriceUSDPerSecond["standard"] * loraResolutions["768p"].Multiplier
		if recastPriceUSDPerSecond[resolution] <= fallback {
			t.Fatalf("%s price %.2f must exceed the lora 768p standard price %.2f", resolution, recastPriceUSDPerSecond[resolution], fallback)
		}
	}
	if recastPriceUSDPerSecond["1080P"] <= recastPriceUSDPerSecond["768P"] {
		t.Fatal("1080P must cost more than 768P")
	}
}

func TestRecastChargeMinimumAndRounding(t *testing.T) {
	if got := recastChargeUSD("768P", 2); math.Abs(got-3.10) > 1e-9 {
		t.Fatalf("5 s minimum at 768P = %.2f, want 3.10", got)
	}
	if got := recastChargeUSD("1080P", 30); math.Abs(got-21.00) > 1e-9 {
		t.Fatalf("30 s at 1080P = %.2f, want 21.00", got)
	}
}

func TestNormalizeRecastRequest(t *testing.T) {
	req := ServiceUsageRequest{Kind: "Recast", ReferenceImageURLs: []string{" https://cdn.example/a.png ", ""}}
	if err := normalizeCharacterSwapRecast(&req); err != nil {
		t.Fatal(err)
	}
	if req.Kind != "recast" || req.Resolution != "1080P" || len(req.ReferenceImageURLs) != 1 {
		t.Fatalf("unexpected normalisation %+v", req)
	}
	single := ServiceUsageRequest{ImageURL: "https://cdn.example/a.png", Resolution: "768P"}
	if err := normalizeCharacterSwapRecast(&single); err != nil || single.ReferenceImageURLs[0] != "https://cdn.example/a.png" {
		t.Fatalf("image_url must act as the single photo: %v %+v", err, single)
	}
	cases := map[string]ServiceUsageRequest{
		"photo":      {},
		"at most 4":  {ReferenceImageURLs: strings.Split("https://c/1.png,https://c/2.png,https://c/3.png,https://c/4.png,https://c/5.png", ",")},
		"768P":       {ReferenceImageURLs: []string{"https://cdn.example/a.png"}, Resolution: "2K"},
		"image file": {ReferenceImageURLs: []string{"https://cdn.example/a.mp4"}},
		"duration":   {ReferenceImageURLs: []string{"https://cdn.example/a.png"}, Duration: 31},
	}
	for want, bad := range cases {
		if err := normalizeCharacterSwapRecast(&bad); err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("%s: got %v", want, err)
		}
	}
}

func TestRecastLongestShot(t *testing.T) {
	if got := recastLongestShot(30, nil); got != 30 {
		t.Fatalf("no cuts = %.1f", got)
	}
	if got := recastLongestShot(30, []float64{4, 10, 28}); math.Abs(got-18) > 1e-9 {
		t.Fatalf("longest shot = %.1f, want 18", got)
	}
}

func TestRecastFalInputOmitsEmptyPrompt(t *testing.T) {
	input := recastFalInput(ServiceUsageRequest{VideoURL: "https://c/v.mp4", ReferenceImageURLs: []string{"https://c/a.png"}, Resolution: "768P"})
	if _, ok := input["prompt"]; ok || input["resolution"] != "768P" {
		t.Fatalf("unexpected input %+v", input)
	}
	input = recastFalInput(ServiceUsageRequest{Prompt: "left becomes Ann", Seed: 7})
	if input["prompt"] != "left becomes Ann" || input["seed"] != 7 {
		t.Fatalf("unexpected input %+v", input)
	}
}

func TestRecastLoraFallbackRequest(t *testing.T) {
	lora := recastLoraRequest(ServiceUsageRequest{Kind: "recast", Resolution: "1080P", Prompt: "keep the hat"})
	if !characterSwapIsLora(lora) || lora.Resolution != "768p" || lora.ServiceTier != "standard" || !strings.Contains(lora.Prompt, "keep the hat") {
		t.Fatalf("unexpected fallback request %+v", lora)
	}
}
