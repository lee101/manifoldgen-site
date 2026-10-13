package main

import (
	"fmt"
	"strings"
	"testing"
)

const tinyPNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAgqfPawAAAABJRU5ErkJggg=="

func poseKindRequest() ServiceUsageRequest {
	return ServiceUsageRequest{Prompt: "  1girl, witch  ", ImageURL: "https://example.com/pose.png"}
}

func TestAnimeControlPricesAreFixed(t *testing.T) {
	want := map[string]float64{
		animePoseControlService: 0.08, animeSceneControlService: 0.10,
		animeDepthControlService: 0.10, animeSketchControlService: 0.12,
	}
	for service, price := range want {
		kind := animeControlKindFor(service)
		if kind == nil || kind.PriceUSD != price || servicePricesUSD[service] != price {
			t.Fatalf("%s must cost $%.2f", service, price)
		}
		if usd, _ := animeControlEstimate(kind); usd != price {
			t.Fatalf("%s estimate %v", service, usd)
		}
	}
	if isAnimeControlService("anima") || isAnimeControlService("") {
		t.Fatal("only anime control services should match")
	}
}

func TestNormalizeAnimeControlDefaultsAndSnapping(t *testing.T) {
	kind := animeControlKindFor(animePoseControlService)
	req := poseKindRequest()
	if err := normalizeAnimeControlRequest(kind, &req); err != nil {
		t.Fatal(err)
	}
	if req.Service != animePoseControlService || req.Prompt != "1girl, witch" || req.Width != 1024 || req.Height != 1024 {
		t.Fatalf("unexpected request: %+v", req)
	}
	if req.NumSteps != 24 || req.Guidance != 4 || req.Strength != 1 || req.OutputFormat != "webp" || req.N != 1 {
		t.Fatalf("unexpected defaults: %+v", req)
	}
	req = poseKindRequest()
	req.Width, req.Height = 777, 1000
	if err := normalizeAnimeControlRequest(kind, &req); err != nil || req.Width != 768 || req.Height != 992 {
		t.Fatalf("size not snapped to 16: %dx%d %v", req.Width, req.Height, err)
	}
	req = poseKindRequest()
	req.Width, req.Height = 768, 1152
	if err := normalizeAnimeControlRequest(kind, &req); err != nil || req.Width != 768 || req.Height != 1152 {
		t.Fatalf("portrait 768x1152 must be allowed: %v", err)
	}
}

func TestNormalizeAnimeControlRejections(t *testing.T) {
	pose := animeControlKindFor(animePoseControlService)
	scene := animeControlKindFor(animeSceneControlService)
	for name, mutate := range map[string]func(*ServiceUsageRequest){
		"missing prompt":   func(r *ServiceUsageRequest) { r.Prompt = " " },
		"no control":       func(r *ServiceUsageRequest) { r.ImageURL = "" },
		"too wide":         func(r *ServiceUsageRequest) { r.Width = 1600 },
		"too small":        func(r *ServiceUsageRequest) { r.Height = 256 },
		"over a megapixel": func(r *ServiceUsageRequest) { r.Width, r.Height = 1280, 1024 },
		"batch":            func(r *ServiceUsageRequest) { r.NumImages = 2 },
		"minor prompt":     func(r *ServiceUsageRequest) { r.Prompt = "anime child character" },
		"minor negative":   func(r *ServiceUsageRequest) { r.NegativePrompt = "minor" },
		"steps":            func(r *ServiceUsageRequest) { r.NumSteps = 80 },
		"guidance":         func(r *ServiceUsageRequest) { r.Guidance = 20 },
		"strength":         func(r *ServiceUsageRequest) { r.Strength = 3 },
		"negative seed":    func(r *ServiceUsageRequest) { r.Seed = -1 },
		"long prompt":      func(r *ServiceUsageRequest) { r.Prompt = strings.Repeat("a", 2401) },
		"http image":       func(r *ServiceUsageRequest) { r.ImageURL = "http://example.com/a.png" },
		"loopback":         func(r *ServiceUsageRequest) { r.ImageURL = "https://127.0.0.1/a.png" },
		"private":          func(r *ServiceUsageRequest) { r.ImageURL = "https://10.0.0.5/a.png" },
		"localhost":        func(r *ServiceUsageRequest) { r.ImageURL = "https://localhost/a.png" },
		"userinfo":         func(r *ServiceUsageRequest) { r.ImageURL = "https://user:pw@example.com/a.png" },
		"video extension":  func(r *ServiceUsageRequest) { r.ImageURL = "https://example.com/a.mp4" },
		"unknown map":      func(r *ServiceUsageRequest) { r.ControlImages = map[string]string{"nope": tinyPNG} },
		"map wrong tool":   func(r *ServiceUsageRequest) { r.ControlImages = map[string]string{"region_map": tinyPNG} },
		"huge inline": func(r *ServiceUsageRequest) {
			r.ControlImages = map[string]string{"skeleton": "data:image/png;base64," + strings.Repeat("A", animeControlMaxInline*2)}
		},
		"bad strengths": func(r *ServiceUsageRequest) { r.ControlStrengths = map[string]float64{"depth": 1} },
	} {
		bad := poseKindRequest()
		mutate(&bad)
		if err := normalizeAnimeControlRequest(pose, &bad); err == nil {
			t.Errorf("%s: expected rejection", name)
		}
	}
	photo := ServiceUsageRequest{Prompt: "p", ImageURL: "https://example.com/a.png"}
	if err := normalizeAnimeControlRequest(scene, &photo); err == nil {
		t.Error("scene control must not accept a photo")
	}
}

func TestNormalizeAnimeControlAcceptsInlineMaps(t *testing.T) {
	scene := animeControlKindFor(animeSceneControlService)
	req := ServiceUsageRequest{
		Prompt:           "two witches",
		ControlImages:    map[string]string{"region_map": tinyPNG, "pose_map": tinyPNG, "  ": ""},
		ControlStrengths: map[string]float64{"regional": 0.8, "pose": 1},
	}
	if err := normalizeAnimeControlRequest(scene, &req); err != nil {
		t.Fatal(err)
	}
	if len(req.ControlImages) != 2 {
		t.Fatalf("empty control image should be dropped: %v", req.ControlImages)
	}
}

func TestAnimeControlWorkerContract(t *testing.T) {
	for _, tc := range []struct {
		service, workload string
		strengthKeys      []string
	}{
		{animePoseControlService, "anime-pose-control", []string{"control_strength"}},
		{animeDepthControlService, "anime-depth-control", []string{"control_strength"}},
		{animeSketchControlService, "anime-sketch-control", nil},
		{animeSceneControlService, "anime-scene-control", []string{"regional_strength", "pose_strength"}},
	} {
		kind := animeControlKindFor(tc.service)
		req := ServiceUsageRequest{Prompt: "p", ImageURL: "https://example.com/a.png", Strength: 1,
			ControlStrengths: map[string]float64{"regional": 0.5, "pose": 0.9}, Width: 1024, Height: 1024, NumSteps: 24, Guidance: 4}
		input := animeControlWorkerInput(kind, req)
		if input["workload"] != tc.workload || input["output_format"] != "webp" || input["negative_prompt"] != animeControlNegative {
			t.Fatalf("%s: unexpected worker input %#v", tc.service, input)
		}
		for _, key := range tc.strengthKeys {
			if _, ok := input[key]; !ok {
				t.Fatalf("%s: missing %s", tc.service, key)
			}
		}
		saved := animeControlSavedInput(kind, req)
		for key, value := range saved {
			if strings.Contains(strings.ToLower(key+fmt.Sprint(value)), "anim") && key != "negative_prompt" || key == "workload" {
				t.Fatalf("%s: saved input leaks %q=%v", tc.service, key, value)
			}
		}
	}
	req := ServiceUsageRequest{Prompt: "p", NegativePrompt: "blurry"}
	if animeControlWorkerInput(animeControlKindFor(animePoseControlService), req)["negative_prompt"] != "blurry" {
		t.Fatal("explicit negative prompt must win")
	}
}

func TestAnimeControlProviderID(t *testing.T) {
	endpoint, job, ok := parseAnimeControlProviderID("runpod:ep1:job-9")
	if !ok || endpoint != "ep1" || job != "job-9" {
		t.Fatalf("parse failed: %q %q %v", endpoint, job, ok)
	}
	for _, bad := range []string{"", "runpod-orbit:a:b", "runpod::b", "runpod:a"} {
		if _, _, ok := parseAnimeControlProviderID(bad); ok {
			t.Errorf("%q should not parse", bad)
		}
	}
}

func TestAnimeControlEndpointResolution(t *testing.T) {
	kind := animeControlKindFor(animeDepthControlService)
	t.Setenv("ANIME_CONTROL_RUNPOD_ENDPOINT_ID", "shared")
	if animeControlEndpointID(kind) != "shared" {
		t.Fatal("shared endpoint expected")
	}
	t.Setenv("ANIME_DEPTH_CONTROL_RUNPOD_ENDPOINT_ID", "depth-only")
	if animeControlEndpointID(kind) != "depth-only" {
		t.Fatal("per-service endpoint must win")
	}
}

func TestAnimeControlFailureMessagesHideWorkerDetails(t *testing.T) {
	if got := animeControlFailureMessage("ValueError: no person detected in the reference image"); !strings.Contains(got, "no person") {
		t.Fatalf("missing person hint: %q", got)
	}
	got := strings.ToLower(animeControlFailureMessage("CUDA out of memory in anime_pose_control.py anima"))
	if strings.Contains(got, "cuda") || strings.Contains(got, "anima ") || strings.Contains(got, ".py") {
		t.Fatalf("worker details leaked: %q", got)
	}
}

func TestPoseControlRoutesStudioMeshThroughTheMeshWorkload(t *testing.T) {
	kind := animeControlKindFor(animePoseControlService)
	req := ServiceUsageRequest{Prompt: "p", Strength: 0.9, ControlImages: map[string]string{"pose_map": tinyPNG}}
	if err := normalizeAnimeControlRequest(kind, &req); err != nil {
		t.Fatal(err)
	}
	input := animeControlWorkerInput(kind, req)
	if input["workload"] != "anime-scene-control" || input["pose_strength"] != 0.9 {
		t.Fatalf("mesh input must use the mesh workload: %#v", input)
	}
	if _, ok := input["control_strength"]; ok {
		t.Fatalf("mesh workload takes pose_strength: %#v", input)
	}
	skeleton := ServiceUsageRequest{Prompt: "p", Strength: 1, ControlImages: map[string]string{"skeleton": tinyPNG}}
	if animeControlWorkerInput(kind, skeleton)["workload"] != "anime-pose-control" {
		t.Fatal("skeleton input must stay on the pose workload")
	}
}
