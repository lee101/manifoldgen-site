package main

import (
	"math"
	"strings"
	"testing"
)

func TestPlanLoraChunksCoversSourceWithOverlaps(t *testing.T) {
	chunks, err := planLoraChunks(30, []float64{0.5, 5, 8.25, 12.17, 15.92, 19.42, 22.29, 26.58})
	if err != nil {
		t.Fatal(err)
	}
	covered := 0.0
	for i, chunk := range chunks {
		if chunk.Index != i || chunk.Length <= 0 || chunk.Length > loraSegmentSeconds+loraOverlapSeconds+1e-6 {
			t.Fatalf("chunk %d bad geometry %+v", i, chunk)
		}
		if chunk.ShotStart && chunk.Lead != 0 {
			t.Fatalf("shot-start chunk %d must not overlap: %+v", i, chunk)
		}
		if !chunk.ShotStart && math.Abs(chunk.Lead-loraOverlapSeconds) > 1e-9 {
			t.Fatalf("chunk %d must overlap its predecessor: %+v", i, chunk)
		}
		covered += chunk.Length - chunk.Lead
	}
	if math.Abs(covered-30) > 1e-6 {
		t.Fatalf("usable lengths sum to %.3f, want 30", covered)
	}
	for _, bad := range []float64{0, 4.5, 61} {
		if _, err := planLoraChunks(bad, nil); err == nil {
			t.Fatalf("%.2fs should be rejected", bad)
		}
	}
}

func TestPlanLoraChunksIgnoresTinyShots(t *testing.T) {
	chunks, err := planLoraChunks(10, []float64{0.2, 9.85})
	if err != nil {
		t.Fatal(err)
	}
	if shots := characterSwapShotCount(chunks); shots != 1 {
		t.Fatalf("cuts within %.1fs of the ends must be ignored, got %d shots", loraMinSegmentSeconds, shots)
	}
}

func TestLoraFilterGraphCrossfadesInsideShotsAndCutsBetween(t *testing.T) {
	chunks, _ := planLoraChunks(12, []float64{6})
	graph := loraFilterGraph(chunks, 832, 480)
	if got := strings.Count(graph, "xfade="); got != len(chunks)-characterSwapShotCount(chunks) {
		t.Fatalf("want one xfade per in-shot join, got %d in %s", got, graph)
	}
	if !strings.Contains(graph, "concat=n=2:v=1:a=0[v]") {
		t.Fatalf("shots must be hard-cut together: %s", graph)
	}
}

func TestNormalizeCharacterSwapLora(t *testing.T) {
	req := ServiceUsageRequest{Kind: "LoRA", VideoURL: "https://example.com/v.mp4", ImageURL: "https://example.com/i.png"}
	if err := normalizeCharacterSwapRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Kind != characterSwapLoraKind || req.Resolution != "480p" || req.ServiceTier != "standard" || req.Prompt != loraDefaultPrompt {
		t.Fatalf("defaults not applied: %+v", req)
	}
	req = ServiceUsageRequest{Kind: "lora", VideoURL: "https://example.com/v.mp4", ImageURL: "https://example.com/i.png", Resolution: "768P", ServiceTier: "fast"}
	if err := normalizeCharacterSwapRequest(&req); err != nil || req.Resolution != "768p" {
		t.Fatalf("768P should normalise: %v %+v", err, req)
	}
	for _, bad := range []ServiceUsageRequest{
		{Kind: "lora", VideoURL: "https://example.com/v.mp4", ImageURL: "https://example.com/i.png", Resolution: "2K"},
		{Kind: "lora", VideoURL: "https://example.com/v.mp4", ImageURL: "https://example.com/i.png", ServiceTier: "xfast"},
		{Kind: "lora", VideoURL: "https://example.com/v.mp4", ImageURL: "https://example.com/i.png", Characters: 9},
	} {
		if err := normalizeCharacterSwapRequest(&bad); err == nil {
			t.Fatalf("should reject %+v", bad)
		}
	}
}

func TestLoraChargeScalesWithTierResolutionAndMinimum(t *testing.T) {
	std := ServiceUsageRequest{Resolution: "480p", ServiceTier: "standard"}
	fast := ServiceUsageRequest{Resolution: "480p", ServiceTier: "fast"}
	hd := ServiceUsageRequest{Resolution: "768p", ServiceTier: "standard"}
	if loraChargeUSD(fast, 30) >= loraChargeUSD(std, 30) || loraChargeUSD(hd, 30) <= loraChargeUSD(std, 30) {
		t.Fatal("fast must be cheaper and 768p dearer than standard 480p")
	}
	if loraChargeUSD(std, 1) != loraChargeUSD(std, characterSwapMinSeconds) {
		t.Fatal("sub-minimum sources bill the five-second minimum")
	}
}
