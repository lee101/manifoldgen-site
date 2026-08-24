package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func withImageToolUpstream(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(handler)
	originalBase, originalKey, originalClient := openPathsBaseURL, openPathsAPIKey, backendClient
	openPathsBaseURL, openPathsAPIKey, backendClient = srv.URL, "test-openpaths-key", srv.Client()
	t.Cleanup(func() {
		srv.Close()
		openPathsBaseURL, openPathsAPIKey, backendClient = originalBase, originalKey, originalClient
	})
}

func withFalQueueStub(t *testing.T, handler http.HandlerFunc) {
	t.Helper()
	srv := httptest.NewServer(handler)
	originalQueue, originalKey := falQueueBaseURL, falAPIKey
	falQueueBaseURL, falAPIKey = srv.URL, "test-fal-key"
	t.Cleanup(func() {
		srv.Close()
		falQueueBaseURL, falAPIKey = originalQueue, originalKey
	})
}

func TestImageModelPriceUSDTiers(t *testing.T) {
	if got := imageModelPriceUSD(ServiceUsageRequest{Service: "openpaths_image", Model: "nano-banana-2"}); got != 0.16 {
		t.Fatalf("nano-banana price = %v, want 0.16", got)
	}
	if got := imageModelPriceUSD(ServiceUsageRequest{Service: "openpaths_image", Model: "nano-banana-2", NumImages: 3}); got != 0.48 {
		t.Fatalf("nano-banana x3 price = %v, want 0.48", got)
	}
	grok := ServiceUsageRequest{Service: "openpaths_image", Model: "grok-imagine", Resolution: "2k"}
	if got := imageModelPriceUSD(grok); got != 0.09 {
		t.Fatalf("grok 2k price = %v, want 0.09", got)
	}
	if got := getRequestServicePriceUSD(grok); got != 0.09 {
		t.Fatalf("request price for grok 2k = %v, want 0.09", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "openpaths_image", Model: "not-a-model"}); got != 0 {
		t.Fatalf("unknown model must price to 0, got %v", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "relight", NumImages: 2}); got != 0.24 {
		t.Fatalf("relight x2 = %v, want 0.24", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "upscale_image"}); got != 0.15 {
		t.Fatalf("upscale_image = %v, want 0.15", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "extend_image"}); got != 0.10 {
		t.Fatalf("extend_image = %v, want 0.10", got)
	}
}

func TestProxyOpenPathsModelImageGenerationsForwardsModel(t *testing.T) {
	var received map[string]interface{}
	var auth string
	withImageToolUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		if r.URL.Path != "/v1/images/generations" {
			t.Errorf("path = %s", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"created":1,"data":[{"url":"https://cdn.example/out.png"}]}`))
	})
	result, err := proxyOpenPathsModelImage(ServiceUsageRequest{
		Service: "openpaths_image", Model: "nano-banana-2",
		Prompt: "a lighthouse", AspectRatio: "landscape", N: 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if auth != "Bearer test-openpaths-key" {
		t.Fatalf("auth = %q", auth)
	}
	if received["model"] != "or/gemini-3.1-flash-image" {
		t.Fatalf("upstream model = %v", received["model"])
	}
	if received["aspect_ratio"] != "16:9" || received["n"] != float64(2) {
		t.Fatalf("payload = %v", received)
	}
	var normalized map[string]interface{}
	if err := json.Unmarshal(result, &normalized); err != nil {
		t.Fatal(err)
	}
	if normalized["engine"] != "nano-banana-2" {
		t.Fatalf("engine = %v", normalized["engine"])
	}
}

func TestProxyOpenPathsModelImageEditUsesEditsRoute(t *testing.T) {
	var received map[string]interface{}
	withImageToolUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/edits" {
			t.Errorf("path = %s", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"url":"https://cdn.example/edited.png"}]}`))
	})
	if _, err := proxyOpenPathsModelImage(ServiceUsageRequest{
		Service: "openpaths_image", Model: "gpt-image-2",
		Prompt: "make it night", ImageURL: "https://static.example/src.png",
	}); err != nil {
		t.Fatal(err)
	}
	if received["image_url"] != "https://static.example/src.png" {
		t.Fatalf("image_url = %v", received["image_url"])
	}
	refs, _ := received["reference_image_urls"].([]interface{})
	if len(refs) != 1 || refs[0] != "https://static.example/src.png" {
		t.Fatalf("reference_image_urls = %v", received["reference_image_urls"])
	}
}

func TestProxyOpenPathsModelImageRejectsUnknownModelAndEditOnFlux(t *testing.T) {
	withImageToolUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[]}`))
	})
	if _, err := proxyOpenPathsModelImage(ServiceUsageRequest{Service: "openpaths_image", Model: "seedream-5", Prompt: "x"}); err == nil || !strings.Contains(err.Error(), "unsupported image model") {
		t.Fatalf("unknown model error = %v", err)
	}
	if _, err := proxyOpenPathsModelImage(ServiceUsageRequest{
		Service: "openpaths_image", Model: "flux-2-dev",
		Prompt: "x", ImageURL: "https://static.example/src.png",
	}); err == nil || !strings.Contains(err.Error(), "does not support reference edits") {
		t.Fatalf("flux edit error = %v", err)
	}
}

func TestProxyOpenPathsExtendImageSendsExpandFields(t *testing.T) {
	var received map[string]interface{}
	withImageToolUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/edits" {
			t.Errorf("path = %s", r.URL.Path)
		}
		_ = json.NewDecoder(r.Body).Decode(&received)
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"data":[{"url":"https://cdn.example/wide.png"}]}`))
	})
	req := ServiceUsageRequest{
		Service: "extend_image", ImageURL: "https://static.example/src.png",
		ExpandLeft: 0.25, ExpandRight: 0.25,
	}
	if _, err := proxyOpenPathsExtendImage(req); err != nil {
		t.Fatal(err)
	}
	if received["expand_left"] != 25.0 || received["expand_right"] != 25.0 {
		t.Fatalf("expansion fields missing: %v", received)
	}
	if received["model"] != "extend-image" {
		t.Fatalf("model = %v", received["model"])
	}
	if _, err := proxyOpenPathsExtendImage(ServiceUsageRequest{Service: "extend_image", ImageURL: "https://static.example/src.png"}); err == nil {
		t.Fatal("expected error when no expansion is requested")
	}
}

func TestProxyFalRelightPollsQueueUntilComplete(t *testing.T) {
	var phase int32
	var relightPayload map[string]interface{}
	withFalQueueStub(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/fal-ai/iclight-v2"):
			if auth := r.Header.Get("Authorization"); auth != "Key test-fal-key" {
				t.Errorf("submit auth = %q", auth)
			}
			_ = json.NewDecoder(r.Body).Decode(&relightPayload)
			w.Write([]byte(`{"status_url":"http://` + r.Host + `/status?logs=0","response_url":"http://` + r.Host + `/response"}`))
		case r.Method == http.MethodGet && strings.Contains(r.URL.RawQuery, "logs=0"):
			if atomic.AddInt32(&phase, 1) > 1 {
				w.Write([]byte(`{"status":"COMPLETED"}`))
				return
			}
			w.Write([]byte(`{"status":"IN_QUEUE"}`))
		default:
			w.Write([]byte(`{"output":{"images":[{"url":"https://cdn.example/lit.jpg"}]}}`))
		}
	})
	result, err := proxyFalRelight(ServiceUsageRequest{
		Service: "relight", Prompt: "warm sunset key light",
		ImageURL: "https://static.example/photo.png", Kind: "left",
	})
	if err != nil {
		t.Fatal(err)
	}
	if relightPayload["initial_latent"] != "Left" {
		t.Fatalf("initial_latent = %v", relightPayload["initial_latent"])
	}
	if relightPayload["num_inference_steps"] != float64(28) {
		t.Fatalf("steps = %v", relightPayload["num_inference_steps"])
	}
	urls := extractPayloadImageURLs(result)
	if len(urls) != 1 || urls[0] != "https://cdn.example/lit.jpg" {
		t.Fatalf("normalized rows = %v", urls)
	}
}

func TestProxyFalUpscaleImageReturnsNormalizedRow(t *testing.T) {
	withFalQueueStub(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodPost {
			w.Write([]byte(`{"status_url":"http://` + r.Host + `/status?logs=0","response_url":"http://` + r.Host + `/response"}`))
			return
		}
		if strings.Contains(r.URL.RawQuery, "logs=0") {
			w.Write([]byte(`{"status":"COMPLETED"}`))
			return
		}
		w.Write([]byte(`{"image":{"url":"https://cdn.example/big.png"}}`))
	})
	result, err := proxyFalUpscaleImage(ServiceUsageRequest{
		Service: "upscale_image", Prompt: "sharpen",
		ImageURL: "https://static.example/small.png",
	})
	if err != nil {
		t.Fatal(err)
	}
	urls := extractPayloadImageURLs(result)
	if len(urls) != 1 || !strings.HasSuffix(urls[0], "big.png") {
		t.Fatalf("upscale urls = %v", urls)
	}
}
