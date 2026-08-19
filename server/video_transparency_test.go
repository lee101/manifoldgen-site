package main

import (
	"encoding/json"
	"testing"
)

func TestPersistH3RequestIncludesAddTransparency(t *testing.T) {
	on := true
	req := ServiceUsageRequest{Prompt: "talk", FirstFrame: "https://cdn.example/still.webp", AddTransparency: &on}
	stored := persistH3Request(req, map[string]interface{}{"prompt": "talk", "first_frame": req.FirstFrame, "duration": 15})
	var payload map[string]interface{}
	if err := json.Unmarshal(stored, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["add_transparency"] != true {
		t.Fatalf("payload = %#v", payload)
	}
	if payload["mask_url"] != "https://cdn.example/still.webp" {
		t.Fatalf("mask_url = %#v", payload["mask_url"])
	}
	off := persistH3Request(ServiceUsageRequest{Prompt: "talk"}, map[string]interface{}{"prompt": "talk"})
	var plain map[string]interface{}
	_ = json.Unmarshal(off, &plain)
	if _, ok := plain["add_transparency"]; ok {
		t.Fatal("default H3 request must not stamp add_transparency")
	}
}

func TestCarryH3TransparencyFlagsCopiesOpaqueURL(t *testing.T) {
	on := true
	stored, _ := json.Marshal(map[string]interface{}{"add_transparency": true, "mask_url": "https://cdn.example/still.webp", "first_frame": "https://cdn.example/still.webp"})
	job := &VideoJob{Result: stored}
	result := map[string]interface{}{"video_url": "https://cdn.example/opaque.mp4"}
	carryH3TransparencyFlags(job, result)
	if result["opaque_video_url"] != "https://cdn.example/opaque.mp4" || result["transparency_status"] != "queued" {
		t.Fatalf("result = %#v", result)
	}
	if result["mask_url"] != "https://cdn.example/still.webp" {
		t.Fatalf("mask_url = %#v", result["mask_url"])
	}
	_ = on
}

func TestMergeTransparencyIntoH3ResultKeepsOpaqueAndAddsTransparent(t *testing.T) {
	base, _ := json.Marshal(map[string]interface{}{"video_url": "https://cdn.example/opaque.mp4", "add_transparency": true, "opaque_video_url": "https://cdn.example/opaque.mp4"})
	merged := mergeTransparencyIntoH3Result(base, map[string]interface{}{
		"transparency_status":   "completed",
		"transparent_video_url": "https://cdn.example/alpha.webm",
	})
	var payload map[string]interface{}
	if err := json.Unmarshal(merged, &payload); err != nil {
		t.Fatal(err)
	}
	if payload["opaque_video_url"] != "https://cdn.example/opaque.mp4" {
		t.Fatalf("opaque missing: %#v", payload)
	}
	if payload["transparent_video_url"] != "https://cdn.example/alpha.webm" {
		t.Fatalf("transparent missing: %#v", payload)
	}
}

func TestStripH3ProviderTransparencyKeepsStoredFlags(t *testing.T) {
	input := map[string]interface{}{"prompt": "talk", "add_transparency": true, "mask_url": "https://cdn.example/still.webp", "first_frame": "https://cdn.example/still.webp"}
	stripH3ProviderTransparency(input)
	if _, ok := input["add_transparency"]; ok {
		t.Fatal("provider payload must not send add_transparency")
	}
	if _, ok := input["mask_url"]; ok {
		t.Fatal("provider payload must not send mask_url")
	}
	if input["first_frame"] != "https://cdn.example/still.webp" {
		t.Fatalf("first_frame = %#v", input["first_frame"])
	}
}

func TestStoredWantsTransparency(t *testing.T) {
	if !storedWantsTransparency(map[string]interface{}{"add_transparency": true}) {
		t.Fatal("bool true")
	}
	if storedWantsTransparency(map[string]interface{}{"add_transparency": false}) {
		t.Fatal("bool false")
	}
	if storedWantsTransparency(map[string]interface{}{}) {
		t.Fatal("missing")
	}
}
