package main

import (
	"net/url"
	"strings"
	"testing"
)

func TestStudioMediaURL(t *testing.T) {
	body := []byte(`{"result":{"image":{"url":"https://cdn.example/cutout.webp"}}}`)
	if got := studioMediaURL(body); got != "https://cdn.example/cutout.webp" {
		t.Fatalf("studioMediaURL() = %q", got)
	}
	if got := studioMediaURL([]byte(`{"status":"done"}`)); got != "" {
		t.Fatalf("studioMediaURL() unexpected URL = %q", got)
	}
}

func TestStudioExtensionCustomerPrice(t *testing.T) {
	inputSeconds := 8.0
	outputSeconds := 6.0
	price := studioExtensionPriceUSD(inputSeconds, int(outputSeconds))
	if price != 0.60 {
		t.Fatalf("extension price = %.2f, want 0.60", price)
	}
}

func TestStudioAudioSearchURL(t *testing.T) {
	got, err := studioAudioSearchURL("https://netwrck.com/", "cinematic rain", "music", 200)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Path != "/api/search-audio" || parsed.Query().Get("query") != "cinematic rain" {
		t.Fatalf("unexpected URL %q", got)
	}
	if parsed.Query().Get("kind") != "music" || parsed.Query().Get("limit") != "24" {
		t.Fatalf("unexpected filters %q", parsed.RawQuery)
	}
}

func TestStudioAudioSearchRejectsUnsafeInputs(t *testing.T) {
	for _, test := range []struct{ base, query, kind string }{
		{"http://netwrck.com", "rain", "music"},
		{"https://netwrck.com", "rain", "podcast"},
		{"https://netwrck.com", strings.Repeat("x", 201), "music"},
	} {
		if _, err := studioAudioSearchURL(test.base, test.query, test.kind, 12); err == nil {
			t.Fatalf("expected rejection for %#v", test)
		}
	}
}
