package main

import (
	"math"
	"strings"
	"testing"
)

func boolPtr(v bool) *bool { return &v }

func TestPlanCharacterSwapChunks(t *testing.T) {
	cases := []struct {
		seconds float64
		count   int
		minLen  float64
		maxDur  int
	}{
		{5, 2, 2.5, 5}, {8, 2, 4, 5}, {10, 3, 3.33, 5}, {30.16, 8, 3.77, 5}, {30, 8, 3.75, 5}, {60, 15, 4, 5}, {11, 3, 3.67, 5},
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
			if math.Abs(chunk.Lead+chunk.Length-float64(chunk.Duration)) > 1e-6 || chunk.Lead < characterSwapLeadSeconds-1e-6 {
				t.Fatalf("%.2fs: chunk %d lead does not fill the clip %+v", tc.seconds, i, chunk)
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

func TestPlanCharacterSwapChunksWithCuts(t *testing.T) {
	chunks, err := planCharacterSwapChunks(30.16, 2.0, 2.3, 24.1, 29.9)
	if err != nil {
		t.Fatal(err)
	}
	starts := 0
	prevEnd := 0.0
	for _, chunk := range chunks {
		if chunk.ShotStart {
			starts++
		}
		if math.Abs(chunk.Start-prevEnd) > 1e-6 || chunk.Length > characterSwapSegmentSeconds+1e-6 || math.Abs(chunk.Lead+chunk.Length-float64(chunk.Duration)) > 1e-6 {
			t.Fatalf("bad chunk %+v", chunk)
		}
		prevEnd = chunk.Start + chunk.Length
	}
	if starts != 3 || math.Abs(prevEnd-30.16) > 1e-6 {
		t.Fatalf("expected 3 shots (cuts at 2.3 s and 29.9 s dropped as too close), got %d shots ending at %.2f", starts, prevEnd)
	}
	if !chunks[0].ShotStart || chunks[0].Length > 2.0+1e-6 || chunks[1].Start != 2.0 || !chunks[1].ShotStart {
		t.Fatalf("shot boundaries not honoured: %+v %+v", chunks[0], chunks[1])
	}
}

func TestCharacterSwapProviderUSD(t *testing.T) {
	chunks, _ := planCharacterSwapChunks(30)
	if usd := characterSwapProviderUSD("768P", chunks); math.Abs(usd-2.40) > 1e-9 {
		t.Fatalf("768P 30s provider cost %.4f", usd)
	}
	if usd := characterSwapChargeUSD("768P", 30); math.Abs(usd-4.80) > 1e-9 {
		t.Fatalf("768P 30s charge %.4f", usd)
	}
	if usd := characterSwapChargeUSD("2K", 30.16); math.Abs(usd-9.05) > 1e-9 {
		t.Fatalf("2K 30.16s charge %.4f", usd)
	}
	shots, _ := planCharacterSwapChunks(30.16, 5, 10, 20)
	if fee := characterSwapShotFee(ServiceUsageRequest{MaxQuality: boolPtr(true)}, shots); math.Abs(fee-0.90) > 1e-9 {
		t.Fatalf("shot fee %.4f", fee)
	}
	if fee := characterSwapShotFee(ServiceUsageRequest{}, shots); fee != 0 {
		t.Fatalf("shot fee should be waived when per-shot frames are off: %.4f", fee)
	}
	usd, _, _, err := characterSwapEstimate(ServiceUsageRequest{Resolution: "768P", ImageURL: "https://x/i.png", MaxQuality: boolPtr(true)}, 30.16, 5, 10, 20)
	if err != nil || math.Abs(usd-(4.83+0.90)) > 1e-9 {
		t.Fatalf("estimate with shots %.4f %v", usd, err)
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

func TestCharacterSwapHostedImage(t *testing.T) {
	r2PublicHost, r2PathPrefix = "cdn.example", "gallery"
	if got := characterSwapHostedImage([]byte(`{"data":[{"b64_json":"abc"}]}`), &GeneratedImage{FilePath: "originals/a_b.webp"}); got != "https://cdn.example/gallery/originals/a_b.webp" {
		t.Fatalf("gallery record not used: %q", got)
	}
	if got := characterSwapHostedImage([]byte(`{"data":[{"b64_json":"abc"}],"saved_image_url":"https://cdn/x.png"}`), nil); got != "https://cdn/x.png" {
		t.Fatalf("saved_image_url not preferred: %q", got)
	}
	if got := characterSwapHostedImage([]byte(`{"data":[{"url":"https://prov/y.png"}]}`), nil); got != "https://prov/y.png" {
		t.Fatalf("provider url not found: %q", got)
	}
	if got := characterSwapHostedImage([]byte(`{"data":[{"b64_json":"abc"}]}`), nil); got != "" {
		t.Fatalf("expected no url, got %q", got)
	}
}

func TestCharacterSwapFalInput(t *testing.T) {
	state := characterSwapState{Request: ServiceUsageRequest{Prompt: "p", Resolution: "768P", AspectRatio: "adaptive", PromptExpansionMode: "disabled", Seed: 7}, SwappedImageURL: "https://x/i.png"}
	input := characterSwapFalInput(state, characterSwapChunk{Index: 2, Duration: 10, SourceURL: "https://x/c.mp4", PrevFrame: "https://x/p.png", AudioURL: "https://x/a.mp3"})
	images := input["reference_image_urls"].([]string)
	if input["seed"] != 9 || input["duration"] != 10 || len(images) != 2 || images[1] != "https://x/p.png" || input["reference_video_urls"].([]string)[0] != "https://x/c.mp4" || input["reference_audio_urls"].([]string)[0] != "https://x/a.mp3" || !strings.HasPrefix(input["prompt"].(string), "Image 2 is") {
		t.Fatalf("unexpected fal input %+v", input)
	}
	first := characterSwapFalInput(state, characterSwapChunk{Index: 0, Duration: 5, SourceURL: "https://x/c.mp4"})
	if len(first["reference_image_urls"].([]string)) != 1 || first["prompt"] != "p" {
		t.Fatalf("first clip should not reference a previous frame: %+v", first)
	}
	shot := characterSwapFalInput(state, characterSwapChunk{Index: 3, Duration: 5, SourceURL: "https://x/c.mp4", ShotImage: "https://x/s.png", PrevFrame: "https://x/p.png"})
	shotImages := shot["reference_image_urls"].([]string)
	if len(shotImages) != 3 || shotImages[0] != "https://x/s.png" || shotImages[1] != "https://x/i.png" || !strings.Contains(shot["prompt"].(string), "Image 3 is the exact frame") {
		t.Fatalf("shot clip references wrong: %+v", shot)
	}
	audio := ServiceUsageRequest{VideoURL: "https://example.com/a.mp4", ImageURL: "https://example.com/b.png", IncludeAudio: boolPtr(true)}
	if err := normalizeCharacterSwapRequest(&audio); err != nil || !strings.Contains(audio.Prompt, "Audio 1") {
		t.Fatalf("audio reference prompt missing: %v %q", err, audio.Prompt)
	}
}

func TestPlanExactChunks(t *testing.T) {
	chunks := planExactChunks(30.16, []float64{0.5, 5, 8.25, 12.17, 15.92, 19.42, 22.29, 26.58})
	if len(chunks) != 3 || chunks[0][0] != 0 || math.Abs(chunks[2][1]-30.16) > 1e-9 {
		t.Fatalf("unexpected exact chunks %v", chunks)
	}
	if math.Abs(chunks[0][1]-8.25) > 1e-9 || math.Abs(chunks[1][1]-19.42) > 1e-9 {
		t.Fatalf("boundaries should snap to nearby cuts: %v", chunks)
	}
	for _, c := range chunks {
		if c[1]-c[0] > exactChunkSeconds+1.5 || c[1] <= c[0] {
			t.Fatalf("bad chunk %v", c)
		}
	}
	if single := planExactChunks(9, nil); len(single) != 1 || single[0][1] != 9 {
		t.Fatalf("short source should be one chunk: %v", single)
	}
}

func TestExactPricing(t *testing.T) {
	if usd := exactChargeUSD("720p", 30.16, 2); math.Abs(usd-14.48) > 1e-9 {
		t.Fatalf("720p two performers %.4f", usd)
	}
	if usd := exactChargeUSD("580p", 30, 1); math.Abs(usd-5.40) > 1e-9 {
		t.Fatalf("580p one performer %.4f", usd)
	}
	if usd := exactProviderUSD("720p", 30); math.Abs(usd-3.60) > 1e-9 {
		t.Fatalf("provider 720p 30s %.4f", usd)
	}
	req := ServiceUsageRequest{VideoURL: "https://x/a.mp4", ImageURL: "https://x/b.png", Kind: "EXACT", Resolution: "768P"}
	if err := normalizeCharacterSwapRequest(&req); err != nil || req.Resolution != "720p" || req.Kind != "exact" || exactPeople(req) != 2 {
		t.Fatalf("exact normalisation: %v %+v", err, req)
	}
	usd, _, _, err := characterSwapEstimate(req, 30.16, 5, 15)
	if err != nil || math.Abs(usd-14.48) > 1e-9 {
		t.Fatalf("exact estimate %.4f %v", usd, err)
	}
	bad := ServiceUsageRequest{VideoURL: "https://x/a.mp4", ImageURL: "https://x/b.png", Kind: "exact", Characters: 5}
	if err := normalizeCharacterSwapRequest(&bad); err == nil {
		t.Fatal("too many characters should be rejected")
	}
}
