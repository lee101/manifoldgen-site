package main

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
)

func TestSafeJoin(t *testing.T) {
	base := t.TempDir()
	for _, rel := range []string{"a.png", "audit-bob-shot_01-src", "x/y.mp4"} {
		got, err := safeJoin(base, rel)
		if err != nil || got != filepath.Join(base, rel) {
			t.Errorf("safeJoin(%q) = %q, %v", rel, got, err)
		}
	}
	for _, rel := range []string{"", "..", "../x", "a/../../x", "/etc/passwd", "a\\..\\x", "a\x00b", "audit-bob-../../../etc/x-src"} {
		if got, err := safeJoin(base, rel); err == nil {
			t.Errorf("safeJoin(%q) = %q, want error", rel, got)
		}
	}
}

func TestTrailerStillDataURLRejectsTraversal(t *testing.T) {
	if _, err := trailerStillDataURL(context.Background(), t.TempDir(), "audit-bob-../../../../tmp/pwn", "http://127.0.0.1:1/x.png"); err == nil || !strings.HasPrefix(err.Error(), "unsafe path") {
		t.Fatalf("expected unsafe path error, got %v", err)
	}
}
