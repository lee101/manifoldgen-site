package main

import "testing"

func TestValidGalleryObjectKey(t *testing.T) {
	for _, key := range []string{"originals/art.webp", "nested/2026/art-01.png"} {
		if !validGalleryObjectKey(key) {
			t.Fatalf("expected %q to be accepted", key)
		}
	}
	for _, key := range []string{"", "../secret", "originals/../../secret", "originals/a b.webp", "https://example.com/image.webp", "originals/a.webp?x=1"} {
		if validGalleryObjectKey(key) {
			t.Fatalf("expected %q to be rejected", key)
		}
	}
}
