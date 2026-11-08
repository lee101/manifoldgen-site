package main

import (
	"strings"
	"testing"
)

func TestMusicRestylePriceKeepsHalfAsMargin(t *testing.T) {
	t.Setenv("VOICE_ENHANCER_GPU_USD_PER_HOUR", "1.12")
	for _, seconds := range []float64{10, 60, 180, 360} {
		for _, candidates := range []int{1, 2} {
			cost := musicRestyleGPUSeconds(seconds, candidates) * 1.12 / 3600
			price := musicRestylePriceUSD(seconds, candidates)
			if price < 2*cost-0.005 || price < musicRestyleMinPriceUSD {
				t.Fatalf("%.0fs x%d: price $%.2f for cost $%.3f", seconds, candidates, price, cost)
			}
		}
	}
	if musicRestylePriceUSD(360, 2) <= musicRestylePriceUSD(60, 1) {
		t.Fatal("longer, multi-render restyles must cost more")
	}
}

func TestNormalizeMusicRestyleRequest(t *testing.T) {
	r2PublicHost = "cdn.example.com"
	upload := "https://cdn.example.com/manifoldgen/u/track.mp3"
	ok := ServiceUsageRequest{Service: musicRestyleService, AudioURL: upload, RightsConfirmed: true}
	cases := []struct {
		name   string
		mutate func(*ServiceUsageRequest)
		want   string
	}{
		{"defaults", func(*ServiceUsageRequest) {}, ""},
		{"foreign host", func(r *ServiceUsageRequest) { r.AudioURL = "https://evil.example/a.mp3" }, "ManifoldGen upload"},
		{"rights", func(r *ServiceUsageRequest) { r.RightsConfirmed = false }, "rights_confirmed"},
		{"harmony", func(r *ServiceUsageRequest) { r.Harmony = "jazz" }, "harmony must be"},
		{"bpm", func(r *ServiceUsageRequest) { r.BPM = 300 }, "bpm must be"},
		{"renders", func(r *ServiceUsageRequest) { r.N = 3 }, "1 or 2"},
		{"duration", func(r *ServiceUsageRequest) { r.Duration = 5 }, "duration must be"},
		{"long prompt", func(r *ServiceUsageRequest) { r.Prompt = strings.Repeat("x", 301) }, "300 characters"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := ok
			tc.mutate(&req)
			state, err := normalizeMusicRestyleRequest(req)
			if tc.want == "" {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if state.Harmony != "melody" || state.Candidates != 1 || state.Prompt != musicRestyleDefaultPrompt || state.MaxSeconds != musicRestyleMaxSeconds {
					t.Fatalf("unexpected defaults %+v", state)
				}
				return
			}
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("want %q, got %v", tc.want, err)
			}
		})
	}
}

func TestLofiLoopAcceptsLoopClipWithoutCoverPrompt(t *testing.T) {
	req := ServiceUsageRequest{AudioURL: "https://cdn.example.com/a.mp3", VideoURL: "https://cdn.example.com/loop.mp4"}
	if _, _, err := normalizeLofiLoopRequest(&req); err != nil {
		t.Fatalf("clip loop: %v", err)
	}
	req.VideoURL = "http://cdn.example.com/loop.mp4"
	if _, _, err := normalizeLofiLoopRequest(&req); err == nil {
		t.Fatal("plain http clip must be rejected")
	}
}

func TestMCPListsRestyleTool(t *testing.T) {
	for _, tool := range manifoldMCPTools() {
		if tool["name"] == "restyle_music" {
			schema := tool["inputSchema"].(map[string]interface{})
			if _, ok := schema["properties"].(map[string]interface{})["harmony"]; !ok {
				t.Fatal("restyle_music schema lacks harmony")
			}
			return
		}
	}
	t.Fatal("restyle_music tool missing")
}
