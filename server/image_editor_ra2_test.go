package main

import (
	"image"
	"image/color"
	"testing"
)

func TestImageEditorRA2Size(t *testing.T) {
	for _, c := range [][4]int{{1024, 1024, 1024, 1024}, {3000, 2000, 1024, 704}, {200, 100, 256, 256}, {800, 600, 832, 576}} {
		if w, h := imageEditorRA2Size(c[0], c[1]); w != c[2] || h != c[3] {
			t.Fatalf("%dx%d -> %dx%d, want %dx%d", c[0], c[1], w, h, c[2], c[3])
		}
	}
}

func TestImageEditorComposite(t *testing.T) {
	fill := func(w, h int, c color.RGBA) *image.RGBA {
		img := image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				img.SetRGBA(x, y, c)
			}
		}
		return img
	}
	src := fill(64, 64, color.RGBA{255, 0, 0, 255})
	edit := fill(128, 128, color.RGBA{0, 0, 255, 255})
	mask := fill(64, 64, color.RGBA{0, 0, 0, 255})
	for y := 0; y < 64; y++ {
		for x := 32; x < 64; x++ {
			mask.SetRGBA(x, y, color.RGBA{255, 255, 255, 255})
		}
	}
	out := imageEditorComposite(src, edit, mask)
	if out.Bounds().Dx() != 64 || out.RGBAAt(4, 4) != (color.RGBA{255, 0, 0, 255}) || out.RGBAAt(60, 4) != (color.RGBA{0, 0, 255, 255}) {
		t.Fatalf("composite wrong: %v %v", out.RGBAAt(4, 4), out.RGBAAt(60, 4))
	}
}
