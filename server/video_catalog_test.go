package main

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProxyOpenPathsVideoForwardsReferenceControls(t *testing.T) {
	originalBase, originalKey, originalClient := openPathsBaseURL, openPathsAPIKey, backendClient
	t.Cleanup(func() { openPathsBaseURL, openPathsAPIKey, backendClient = originalBase, originalKey, originalClient })

	var received map[string]interface{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/videos/generations" || r.Header.Get("Authorization") != "Bearer private-key" {
			t.Fatalf("unexpected request %s auth=%q", r.URL.Path, r.Header.Get("Authorization"))
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte(`{"id":"upstream-job","status":"queued"}`))
	}))
	defer upstream.Close()
	openPathsBaseURL, openPathsAPIKey, backendClient = upstream.URL, "private-key", upstream.Client()

	audio := true
	result, err := proxyOpenPathsVideo(ServiceUsageRequest{
		Model: "seedance-2.0-reference-to-video", Prompt: "a product reveal", Duration: 8,
		AspectRatio: "9:16", Resolution: "1080P", ReferenceImageURLs: []string{"https://example.com/product.webp"},
		ReferenceVideoURLs: []string{"https://example.com/motion.mp4"}, IncludeAudio: &audio, Seed: 42,
	})
	if err != nil {
		t.Fatal(err)
	}
	if string(result) == "" {
		t.Fatal("expected queued response")
	}
	if received["model"] != "seedance-2.0-reference-to-video" || received["resolution"] != "1080p" || received["seed"] != float64(42) {
		t.Fatalf("unexpected forwarded payload: %#v", received)
	}
	images, ok := received["image_urls"].([]interface{})
	if !ok || len(images) != 1 || images[0] != "https://example.com/product.webp" {
		t.Fatalf("image_urls = %#v", received["image_urls"])
	}
	if received["generate_audio"] != true {
		t.Fatalf("generate_audio = %#v", received["generate_audio"])
	}
}

func TestProxyOpenPathsVideoRequiresModeInput(t *testing.T) {
	for _, model := range []string{"seedance-2.0-image-to-video", "alibaba/happy-horse/image-to-video", "ltx-2.3-image-to-video"} {
		if _, err := proxyOpenPathsVideo(ServiceUsageRequest{Model: model, Prompt: "move"}); err == nil {
			t.Fatalf("%s accepted no image", model)
		}
	}
	if _, err := proxyOpenPathsVideo(ServiceUsageRequest{Model: "seedance-2.0-reference-to-video", Prompt: "move"}); err == nil {
		t.Fatal("reference model accepted no reference media")
	}
}

func TestVideoCatalogPerSecondPricing(t *testing.T) {
	five := getRequestServicePriceUSD(ServiceUsageRequest{Service: "video_generate", Model: "seedance-2.0-text-to-video", Duration: 5})
	ten := getRequestServicePriceUSD(ServiceUsageRequest{Service: "video_generate", Model: "seedance-2.0-text-to-video", Duration: 10})
	if five <= 0 || ten != five*2 {
		t.Fatalf("five seconds=%f ten seconds=%f", five, ten)
	}
	if perSecond := getRequestServicePriceUSD(ServiceUsageRequest{Service: "video_generate", Model: "wan", Duration: 5}); math.Abs(perSecond-0.90) > 1e-9 {
		t.Fatalf("Wan five-second price=%f", perSecond)
	}
}
