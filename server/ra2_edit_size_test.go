package main

import (
	"bytes"
	"image"
	"image/png"
	"testing"
)

func TestRA2EditSizeKeepsSourceAspect(t *testing.T) {
	encode := func(w, h int) []byte {
		var buf bytes.Buffer
		_ = png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, w, h)))
		return buf.Bytes()
	}
	cases := []struct{ w, h, wantW, wantH int }{
		{1247, 1882, 832, 1280},
		{2016, 1152, 1344, 768},
		{800, 800, 1024, 1024},
		{4000, 500, 2048, 384},
	}
	for _, c := range cases {
		if w, h := ra2EditSize(encode(c.w, c.h)); w != c.wantW || h != c.wantH {
			t.Errorf("%dx%d: got %dx%d, want %dx%d", c.w, c.h, w, h, c.wantW, c.wantH)
		}
	}
	if w, h := ra2EditSize([]byte("not an image")); w != 1024 || h != 1024 {
		t.Errorf("undecodable source: got %dx%d", w, h)
	}
}
