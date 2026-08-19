package main

import (
	"net/url"
	"testing"
)

func TestNormalizeH3ImageRequestCapsNativeArea(t *testing.T) {
	req := ServiceUsageRequest{Service: "h3_image", Prompt: "a finished still", Width: 2048, Height: 2048}
	if err := normalizeH3ImageRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Width%32 != 0 || req.Height%32 != 0 || req.Width*req.Height > h3ImageNativePixels {
		t.Fatalf("canvas was not safely normalized: %dx%d", req.Width, req.Height)
	}
	if req.NumSteps != 12 || req.Strength != 0.75 {
		t.Fatalf("unexpected defaults: %+v", req)
	}
}

func TestNormalizeH3ImageEditRequiresSource(t *testing.T) {
	req := ServiceUsageRequest{Service: "h3_image_edit", Prompt: "change the jacket"}
	if err := normalizeH3ImageRequest(&req); err == nil {
		t.Fatal("expected source image validation error")
	}
}

func TestH3NSFWInputSelectsAlternateWorker(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "alternate")
	route := h3RouteForContent("edit the lighting", true)
	if route.Variant != h3PinkCherryVariant || route.RunpodEndpointID != "alternate" {
		t.Fatalf("unexpected route: %+v", route)
	}
}

func TestH3ModerationEndpointUsesDedicatedWorkerSecret(t *testing.T) {
	t.Setenv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791")
	t.Setenv("OMNISERVE_NATIVE_SECRET", "gateway-secret")
	t.Setenv("OMNISERVE_IMAGE_WORKER_SECRET", "worker secret/+?")
	endpoint, secret, err := h3ModerationEndpoint()
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		t.Fatal(err)
	}
	if secret != "worker secret/+?" || parsed.Query().Get("secret") != secret {
		t.Fatalf("dedicated moderation secret was not preserved: endpoint=%q", endpoint)
	}
}

func TestH3ImageEstimateUsesConfiguredServiceFloor(t *testing.T) {
	originalImage := servicePricesUSD["h3_image"]
	originalEdit := servicePricesUSD["h3_image_edit"]
	t.Cleanup(func() {
		servicePricesUSD["h3_image"] = originalImage
		servicePricesUSD["h3_image_edit"] = originalEdit
	})
	servicePricesUSD["h3_image"] = 0.30
	servicePricesUSD["h3_image_edit"] = 0.35

	if price, _ := h3ImageEstimate(ServiceUsageRequest{Service: "h3_image", NumSteps: 12}); price != 0.30 {
		t.Fatalf("text-to-image estimate = %v", price)
	}
	if price, _ := h3ImageEstimate(ServiceUsageRequest{Service: "h3_image_edit", NumSteps: 20}); price != 0.50 {
		t.Fatalf("quality edit estimate = %v", price)
	}
}
