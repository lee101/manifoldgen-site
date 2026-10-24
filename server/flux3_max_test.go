package main

import "testing"

func TestNormalizeFlux3MaxRequestDefaults(t *testing.T) {
	req := ServiceUsageRequest{Prompt: " a fox ", ImageURL: " https://example.com/a.png "}
	if err := normalizeFlux3MaxRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Service != flux3MaxVideoService || req.FirstFrame != "https://example.com/a.png" || req.Duration != 5 ||
		req.Resolution != "720p" || req.AspectRatio != "auto" || req.ReasoningLevel != "high" {
		t.Fatalf("unexpected defaults: %+v", req)
	}
	payload := flux3MaxPayload(req)
	if payload["duration"] != 5 || payload["generate_audio"] != true {
		t.Fatalf("unexpected payload: %v", payload)
	}
	if _, ok := payload["end_image_url"]; ok {
		t.Fatal("end frame must be omitted when unset")
	}
	if _, ok := payload["seed"]; ok {
		t.Fatal("seed must be omitted when unset")
	}
}

func TestNormalizeFlux3MaxRequestRejects(t *testing.T) {
	ok := ServiceUsageRequest{Prompt: "x", ImageURL: "https://example.com/a.png"}
	cases := map[string]func(*ServiceUsageRequest){
		"no prompt": func(r *ServiceUsageRequest) { r.Prompt = "" },
		"end only":  func(r *ServiceUsageRequest) { r.ImageURL = ""; r.LastFrame = "https://example.com/b.png" },
		"both modes": func(r *ServiceUsageRequest) {
			r.TimedKeyframes = []Flux3MaxKeyframe{{ImageURL: "https://example.com/b.png"}}
		},
		"index too high": func(r *ServiceUsageRequest) {
			r.ImageURL = ""
			r.TimedKeyframes = []Flux3MaxKeyframe{{ImageURL: "https://example.com/b.png", FrameIndex: 121}}
		},
		"duplicate index": func(r *ServiceUsageRequest) {
			r.ImageURL = ""
			r.TimedKeyframes = []Flux3MaxKeyframe{{ImageURL: "https://example.com/a.png"}, {ImageURL: "https://example.com/b.png"}}
		},
		"video keyframe": func(r *ServiceUsageRequest) {
			r.ImageURL = ""
			r.TimedKeyframes = []Flux3MaxKeyframe{{ImageURL: "https://example.com/b.mp4"}}
		},
		"video as image":  func(r *ServiceUsageRequest) { r.ImageURL = "https://example.com/a.mp4" },
		"video end frame": func(r *ServiceUsageRequest) { r.LastFrame = "https://example.com/b.mp4" },
		"short":           func(r *ServiceUsageRequest) { r.Duration = 4 },
		"long":            func(r *ServiceUsageRequest) { r.Duration = 21 },
		"resolution":      func(r *ServiceUsageRequest) { r.Resolution = "4k" },
		"aspect":          func(r *ServiceUsageRequest) { r.AspectRatio = "5:4" },
		"reasoning":       func(r *ServiceUsageRequest) { r.ReasoningLevel = "medium" },
	}
	for name, mutate := range cases {
		req := ok
		mutate(&req)
		if err := normalizeFlux3MaxRequest(&req); err == nil {
			t.Errorf("%s: expected an error", name)
		}
	}
}

func TestFlux3MaxPricing(t *testing.T) {
	if got := flux3MaxChargedUSD(ServiceUsageRequest{Duration: 10, Resolution: "720p"}); got != 1.7 {
		t.Fatalf("720p 10s charged %v", got)
	}
	if got := flux3MaxChargedUSD(ServiceUsageRequest{Duration: 5, Resolution: "1080p"}); got != 1.45 {
		t.Fatalf("1080p 5s charged %v", got)
	}
}

func TestFlux3MaxPayloadOptions(t *testing.T) {
	off := false
	req := ServiceUsageRequest{Prompt: "x", ImageURL: "https://example.com/a.png", LastFrame: "https://example.com/b.png", Duration: 12, Resolution: "1080p", AspectRatio: "9:16", ReasoningLevel: "low", Seed: 7, IncludeAudio: &off}
	if err := normalizeFlux3MaxRequest(&req); err != nil {
		t.Fatal(err)
	}
	payload := flux3MaxPayload(req)
	if payload["end_image_url"] != "https://example.com/b.png" || payload["seed"] != 7 || payload["generate_audio"] != false || payload["reasoning_level"] != "low" {
		t.Fatalf("unexpected payload: %v", payload)
	}
}

func TestFlux3MaxModes(t *testing.T) {
	text := ServiceUsageRequest{Prompt: "x"}
	if err := normalizeFlux3MaxRequest(&text); err != nil {
		t.Fatal(err)
	}
	payload := flux3MaxPayload(text)
	if flux3MaxMode(text) != "text" || payload["image_url"] != nil || payload["keyframes"] != nil {
		t.Fatalf("text mode: %v", payload)
	}
	if flux3MaxModel("text") != "blackforestlabs/flux-3-max/text-to-video" {
		t.Fatal("text model")
	}
	img := ServiceUsageRequest{Prompt: "x", ImageURL: "https://example.com/a.png"}
	if err := normalizeFlux3MaxRequest(&img); err != nil || flux3MaxMode(img) != "image" {
		t.Fatalf("image mode: %v", err)
	}
	kf := ServiceUsageRequest{Prompt: "x", Duration: 10, Keyframes: []string{"https://example.com/a.png", "https://example.com/b.png", "https://example.com/c.png"}}
	if err := normalizeFlux3MaxRequest(&kf); err != nil {
		t.Fatal(err)
	}
	if flux3MaxMode(kf) != "keyframes" || len(kf.TimedKeyframes) != 3 || kf.TimedKeyframes[0].FrameIndex != 0 || kf.TimedKeyframes[1].FrameIndex != 120 || kf.TimedKeyframes[2].FrameIndex != 240 {
		t.Fatalf("even spacing: %+v", kf.TimedKeyframes)
	}
	if payload := flux3MaxPayload(kf); payload["keyframes"] == nil || payload["image_url"] != nil {
		t.Fatalf("keyframes payload: %v", payload)
	}
	if flux3MaxModel("keyframes") != "blackforestlabs/flux-3-max/keyframes-to-video" {
		t.Fatal("keyframes model")
	}
	again := kf
	if err := normalizeFlux3MaxRequest(&again); err != nil || len(again.TimedKeyframes) != 3 {
		t.Fatalf("normalization must be idempotent: %v", err)
	}
}

func TestFlux3MaxProviderID(t *testing.T) {
	if mode, id, ok := parseFlux3MaxProviderID(flux3MaxProviderID("keyframes", "req-1")); !ok || id != "req-1" || mode != "keyframes" {
		t.Fatalf("got %q %q %v", mode, id, ok)
	}
	if _, _, ok := parseFlux3MaxProviderID("fal-flux3-bogus:req-1"); ok {
		t.Fatal("must reject unknown modes")
	}
	if _, _, ok := parseFlux3MaxProviderID("fal:req-1"); ok {
		t.Fatal("must reject other providers")
	}
}
