package main

import "testing"

func TestAnimaUsesOmniServeNativeCapacity(t *testing.T) {
	t.Setenv("ANIMA_NATIVE_URL", "http://127.0.0.1:8791")
	if !animaAvailable() || animaUnavailableReason() != "" {
		t.Fatal("Anima should use the configured OmniServe native capacity")
	}
	if animaModelName() == "" {
		t.Fatal("Anima should report the configured native model")
	}
}

func TestNormalizeAnimaRequest(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "  celestial cartographer  ", Width: 777, Height: 1031}
	if err := normalizeAnimaRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Service != "anima" || req.Prompt != "celestial cartographer" || req.Width != 768 || req.Height != 1024 {
		t.Fatalf("unexpected normalized request: %+v", req)
	}
	if req.NumSteps != 28 || req.Guidance != 4 || req.OutputFormat != "webp" {
		t.Fatalf("unexpected Anima defaults: %+v", req)
	}
	if req.N != 1 || req.NumImages != 1 {
		t.Fatalf("Anima must normalize to exactly one billed image: %+v", req)
	}
}

func TestNormalizeAnimaRequestRejectsOversizedCanvas(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "test", Width: 1536, Height: 1536}
	if err := normalizeAnimaRequest(&req); err == nil {
		t.Fatal("expected oversized Anima canvas to be rejected")
	}
}

func TestNormalizeAnimaRequestRejectsMinorPromptsAndBatches(t *testing.T) {
	for _, req := range []ServiceUsageRequest{
		{Prompt: "anime child character"},
		{Prompt: "adult character", NegativePrompt: "minor"},
		{Prompt: "adult character", NumImages: 2},
		{Prompt: "adult character", N: 2},
	} {
		if err := normalizeAnimaRequest(&req); err == nil {
			t.Fatalf("expected unsafe or ambiguous request to be rejected: %+v", req)
		}
	}
}

func TestAnimaWorkerContract(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "character", NegativePrompt: "text", Width: 768, Height: 1024, NumSteps: 28, Guidance: 4, Seed: 42}
	input := animaWorkerInput(req)
	if input["num_inference_steps"] != 28 || input["guidance_scale"] != float64(4) || input["output_format"] != "webp" {
		t.Fatalf("unexpected worker input: %#v", input)
	}
}
