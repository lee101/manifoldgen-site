package main

import (
	"strings"
	"testing"
)

func TestExtractVideoURLRejectsDataURIs(t *testing.T) {
	if got := extractVideoURLFromResultJSON(`{"video_url":"data:video/mp4;base64,` + strings.Repeat("A", 4000) + `"}`); got != "" {
		t.Fatalf("data URI returned: %d bytes", len(got))
	}
	if got := extractVideoURLFromResultJSON(`{"video_url":"https://x.test/a.mp4"}`); got != "https://x.test/a.mp4" {
		t.Fatalf("got %q", got)
	}
}
