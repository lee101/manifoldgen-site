package main

import (
	"strings"
	"testing"
)

func TestNormalizeLofiLoopRequestRejectsUnknownLooks(t *testing.T) {
	cases := map[string]func(*ServiceUsageRequest){
		"visualizer": func(r *ServiceUsageRequest) { r.Visualizer = "hologram" },
		"preset":     func(r *ServiceUsageRequest) { r.Preset = "cosmic" },
		"palette":    func(r *ServiceUsageRequest) { r.Palette = "taupe" },
		"motion":     func(r *ServiceUsageRequest) { r.Motion = "h3" },
		"size":       func(r *ServiceUsageRequest) { r.Size = "1280x720" },
		"seam":       func(r *ServiceUsageRequest) { r.SeamSeconds = 30 },
		"loop start": func(r *ServiceUsageRequest) { r.LoopStart = -1 },
	}
	for name, mutate := range cases {
		t.Run(name, func(t *testing.T) {
			req := ServiceUsageRequest{CharacterPrompt: "a lantern keeper"}
			mutate(&req)
			if _, _, err := normalizeLofiLoopRequest(&req); err == nil {
				t.Fatalf("expected the %s value to be rejected", name)
			}
		})
	}
}

func TestNormalizeLofiLoopRequestDefaults(t *testing.T) {
	req := ServiceUsageRequest{CharacterPrompt: "a lantern keeper", ScenePrompt: "an ashen grove"}
	prompt, duration, err := normalizeLofiLoopRequest(&req)
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if req.Size != "1280x704" {
		t.Fatalf("expected the spec default size, got %q", req.Size)
	}
	if req.SeamSeconds != -1 {
		t.Fatalf("an unspecified seam should ask the renderer for its default, got %.2f", req.SeamSeconds)
	}
	if duration < 30 || duration > 300 {
		t.Fatalf("generated soundtrack duration %d is outside the music range", duration)
	}
	if prompt != lofiLoopDefaultMusicPrompt {
		t.Fatalf("an art-only request should fall back to the default lofi soundtrack, got %q", prompt)
	}
	if req.Duration != duration {
		t.Fatalf("request duration %d disagrees with the resolved duration %d", req.Duration, duration)
	}
}

func TestNormalizeLofiLoopRequestKeepsMusicDescription(t *testing.T) {
	req := ServiceUsageRequest{
		Prompt:          "slow rainy jazz guitar loop with brushed drums",
		CharacterPrompt: "a pianist in a knit sweater",
	}
	prompt, _, err := normalizeLofiLoopRequest(&req)
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if !strings.Contains(prompt, "rainy jazz") {
		t.Fatalf("soundtrack prompt %q lost the caller description", prompt)
	}
	if !strings.HasPrefix(req.Prompt, "slow rainy jazz") {
		t.Fatalf("the request should keep the music description for the job record, got %q", req.Prompt)
	}
}

func TestNormalizeLofiLoopRequestWithUploadedTrack(t *testing.T) {
	req := ServiceUsageRequest{
		CharacterPrompt: "a lantern keeper",
		AudioURL:        "https://manifoldgenstatic.manifoldgen.com/gallery/track.mp3",
		Motion:          "embers",
		Palette:         "ember",
	}
	musicPrompt, duration, err := normalizeLofiLoopRequest(&req)
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if musicPrompt != "" || duration != 0 {
		t.Fatalf("an uploaded track must not trigger music generation (prompt %q, duration %d)", musicPrompt, duration)
	}
}

func TestNormalizeLofiLoopRequestRejectsInsecureAudio(t *testing.T) {
	req := ServiceUsageRequest{CharacterPrompt: "a lantern keeper", AudioURL: "http://localhost/track.mp3"}
	if _, _, err := normalizeLofiLoopRequest(&req); err == nil {
		t.Fatal("expected a non-https audio_url to be rejected")
	}
}

func TestNormalizeLofiLoopRequestNeedsArtDirection(t *testing.T) {
	if _, _, err := normalizeLofiLoopRequest(&ServiceUsageRequest{}); err == nil {
		t.Fatal("expected a request with no art direction to be rejected")
	}
}

func TestLofiLoopSpecIsServable(t *testing.T) {
	spec := lofiLoopSpec()
	if spec.Version <= 0 || len(spec.Visualizers) == 0 || len(spec.Presets) == 0 {
		t.Fatal("the lofi loop spec is empty")
	}
	if _, err := spec.Visualizer("bars"); err != nil {
		t.Fatalf("the public spec should expose the bars visualizer: %v", err)
	}
	if _, err := spec.Preset("drift"); err != nil {
		t.Fatalf("the public spec should expose the drift preset: %v", err)
	}
}
