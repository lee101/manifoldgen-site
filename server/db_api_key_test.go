package main

import (
	"strings"
	"testing"
)

func TestNewAPIKeyHasNoTrailingSeparator(t *testing.T) {
	for range 100 {
		key := newAPIKey()
		if !strings.HasPrefix(key, "sk-mg-") {
			t.Fatalf("key has unexpected prefix: %q", key)
		}
		suffix := strings.TrimPrefix(key, "sk-mg-")
		if suffix == "" || strings.HasSuffix(key, "-") || strings.Contains(suffix, "-") {
			t.Fatalf("key has an invalid suffix: %q", key)
		}
	}
}
