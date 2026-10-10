package main

import (
	"strings"
	"testing"
)

func TestNormalizeOrbitRequestDefaults(t *testing.T) {
	req := ServiceUsageRequest{ImageURL: " https://example.com/a.png "}
	if err := normalizeOrbitRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Service != orbitVideoService || req.ImageURL != "https://example.com/a.png" || req.Prompt != orbitDefaultPrompt || req.NumSteps != orbitDefaultSteps {
		t.Fatalf("unexpected defaults: %+v", req)
	}
	if !strings.HasPrefix(req.Prompt, "One frozen instant. Only the camera moves. In a continuous 360 orbit.") {
		t.Fatal("default prompt must be the LoRA's recommended prompt")
	}
}

func TestNormalizeOrbitRequestRejects(t *testing.T) {
	cases := map[string]ServiceUsageRequest{
		"missing image":  {},
		"video as image": {ImageURL: "https://example.com/a.mp4"},
		"too few steps":  {ImageURL: "https://example.com/a.png", NumSteps: 2},
		"too many steps": {ImageURL: "https://example.com/a.png", NumSteps: 90},
		"long prompt":    {ImageURL: "https://example.com/a.png", Prompt: strings.Repeat("x", 2001)},
	}
	for name, req := range cases {
		if err := normalizeOrbitRequest(&req); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestOrbitProviderID(t *testing.T) {
	endpoint, job, ok := parseOrbitProviderID("runpod-orbit:ep1:job-1-u1")
	if !ok || endpoint != "ep1" || job != "job-1-u1" {
		t.Fatalf("got %q %q %v", endpoint, job, ok)
	}
	if _, _, ok := parseOrbitProviderID("runpod-wan:ep1:job"); ok {
		t.Fatal("wan provider ids must not parse as orbit")
	}
}

func TestOrbitWorkerInput(t *testing.T) {
	req := ServiceUsageRequest{ImageURL: "https://example.com/a.png", Prompt: orbitDefaultPrompt, NumSteps: 28, Seed: 7}
	input := orbitWorkerInput(req, "https://up", "https://pub")
	if input["frames"] != orbitFrames || input["size"] != orbitSize || input["lora_strength"] != 1.0 || input["seed"] != int64(7) && input["seed"] != 7 {
		t.Fatalf("unexpected worker input: %+v", input)
	}
}
