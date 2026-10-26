package main

import (
	"strings"
	"testing"
)

func TestOptimizedVideoURLOnlyHostedWebM(t *testing.T) {
	cases := map[string]bool{
		"https://static.test/gallery/a.webm":                  true,
		"https://static.test/gallery/a.WEBM?v=2":              true,
		"https://static.test/gallery/a.mp4":                   false,
		"http://static.test/gallery/a.webm":                   false,
		"data:video/webm;base64," + strings.Repeat("A", 4000): false,
		"data:video/mp4;base64,AAAA":                          false,
		"":                                                    false,
	}
	for u, want := range cases {
		if got := isOptimizedVideoURL(u); got != want {
			t.Errorf("isOptimizedVideoURL(%.40q) = %v, want %v", u, got, want)
		}
	}
	if got := extractOptimizedVideoURLFromResultJSON(`{"video_url":"https://x.test/a.mp4"}`); got != "" {
		t.Fatalf("mp4 accepted: %q", got)
	}
	if got := extractOptimizedVideoURLFromResultJSON(`{"result":{"url":"https://x.test/a.webm"}}`); got != "https://x.test/a.webm" {
		t.Fatalf("got %q", got)
	}
}
