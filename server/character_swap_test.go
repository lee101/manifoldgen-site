package main

import (
	"math"
	"testing"
)

func TestPlanCharacterSwapChunks(t *testing.T) {
	cases := []struct {
		seconds float64
		count   int
		minLen  float64
		maxDur  int
	}{
		{5, 1, 5, 6}, {9, 2, 4.5, 5}, {10, 3, 3.33, 5}, {30.16, 7, 4.31, 5}, {30, 7, 4.29, 5}, {60, 14, 4.29, 5}, {11, 3, 3.67, 5},
	}
	for _, tc := range cases {
		chunks, err := planCharacterSwapChunks(tc.seconds)
		if err != nil {
			t.Fatalf("%.2fs: %v", tc.seconds, err)
		}
		if len(chunks) != tc.count {
			t.Fatalf("%.2fs: want %d chunks got %d", tc.seconds, tc.count, len(chunks))
		}
		total := 0.0
		for i, chunk := range chunks {
			if chunk.Index != i || math.Abs(chunk.Start-float64(i)*chunk.Length) > 1e-6 {
				t.Fatalf("%.2fs: chunk %d has bad geometry %+v", tc.seconds, i, chunk)
			}
			if math.Abs(chunk.Length-tc.minLen) > 0.01 || chunk.Duration != tc.maxDur || chunk.Duration < characterSwapMinSeconds || chunk.Duration > characterSwapChunkSeconds {
				t.Fatalf("%.2fs: chunk %d length/duration %+v", tc.seconds, i, chunk)
			}
			total += chunk.Length
		}
		if math.Abs(total-math.Min(tc.seconds, characterSwapMaxSeconds)) > 1e-6 {
			t.Fatalf("%.2fs: chunk lengths sum to %.3f", tc.seconds, total)
		}
	}
	for _, bad := range []float64{0, 4.5, 61} {
		if _, err := planCharacterSwapChunks(bad); err == nil {
			t.Fatalf("%.2fs should be rejected", bad)
		}
	}
}

func TestCharacterSwapProviderUSD(t *testing.T) {
	chunks, _ := planCharacterSwapChunks(30)
	if usd := characterSwapProviderUSD("768P", chunks); math.Abs(usd-2.80) > 1e-9 {
		t.Fatalf("768P 30s provider cost %.4f", usd)
	}
	if usd := characterSwapProviderUSD("2K", chunks); math.Abs(usd-4.55) > 1e-9 {
		t.Fatalf("2K 30s provider cost %.4f", usd)
	}
}

func TestNormalizeCharacterSwapRequest(t *testing.T) {
	req := ServiceUsageRequest{VideoURL: "https://example.com/a.mp4", ImageURL: "https://example.com/b.png", Resolution: "2k"}
	if err := normalizeCharacterSwapRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Resolution != "2K" || req.AspectRatio != "adaptive" || req.PromptExpansionMode != "disabled" || req.Prompt != characterSwapDefaultVideoPrompt {
		t.Fatalf("defaults not applied: %+v", req)
	}
	bad := []ServiceUsageRequest{
		{ImageURL: "https://example.com/b.png"},
		{VideoURL: "https://example.com/a.mp4"},
		{VideoURL: "https://example.com/a.png", ImageURL: "https://example.com/b.png"},
		{VideoURL: "https://example.com/a.mp4", ImageURL: "https://example.com/b.mp4"},
		{VideoURL: "https://example.com/a.mp4", ImageURL: "https://example.com/b.png", Resolution: "4K"},
		{VideoURL: "https://example.com/a.mp4", ImageURL: "https://example.com/b.png", PromptExpansionMode: "max"},
	}
	for i, req := range bad {
		if err := normalizeCharacterSwapRequest(&req); err == nil {
			t.Fatalf("case %d should fail: %+v", i, req)
		}
	}
	withPrompt := ServiceUsageRequest{VideoURL: "https://example.com/a.mp4", CharacterPrompt: "Elon Musk on the left"}
	if err := normalizeCharacterSwapRequest(&withPrompt); err != nil {
		t.Fatal(err)
	}
}

func TestCharacterSwapLeakCount(t *testing.T) {
	if characterSwapLeakCount("frames [4 5 6]: humans") != 3 || characterSwapLeakCount("clean") != 0 || characterSwapLeakCount("frames []: x") != 0 {
		t.Fatal("leak count parsing")
	}
}

func TestCharacterSwapFalInput(t *testing.T) {
	state := characterSwapState{Request: ServiceUsageRequest{Prompt: "p", Resolution: "768P", AspectRatio: "adaptive", PromptExpansionMode: "disabled", Seed: 7}, SwappedImageURL: "https://x/i.png"}
	input := characterSwapFalInput(state, characterSwapChunk{Index: 2, Duration: 10, SourceURL: "https://x/c.mp4"})
	if input["seed"] != 9 || input["duration"] != 10 || input["reference_image_urls"].([]string)[0] != "https://x/i.png" || input["reference_video_urls"].([]string)[0] != "https://x/c.mp4" {
		t.Fatalf("unexpected fal input %+v", input)
	}
}
