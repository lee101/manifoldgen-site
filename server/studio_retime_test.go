package main

import (
	"context"
	"math"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestStudioRetimeValidation(t *testing.T) {
	r2PublicHost = "cdn.example.com"
	ok := studioRetimeInput{URL: "https://cdn.example.com/a.mp4", Kind: "video", Start: 0, End: 5, Speed: -1}
	got, err := validateStudioRetimeInput(ok)
	if err != nil || !studioRetimeReverse(got) {
		t.Fatalf("reverse should validate: %v", err)
	}
	cases := map[string]studioRetimeInput{
		"host":  {URL: "https://evil.example/a.mp4", Kind: "video", End: 5, Speed: 2},
		"noop":  {URL: ok.URL, Kind: "video", End: 5, Speed: 1},
		"fast":  {URL: ok.URL, Kind: "video", End: 5, Speed: 9},
		"slow":  {URL: ok.URL, Kind: "video", End: 5, Speed: 0.05},
		"range": {URL: ok.URL, Kind: "video", Start: 5, End: 5, Speed: 2},
		"long":  {URL: ok.URL, Kind: "video", End: 90, Speed: -1},
		"kind":  {URL: ok.URL, Kind: "image", End: 5, Speed: 2},
	}
	for name, input := range cases {
		if _, err := validateStudioRetimeInput(input); err == nil {
			t.Errorf("%s should fail", name)
		}
	}
	if _, err := validateStudioRetimeInput(studioRetimeInput{URL: ok.URL, Kind: "video", End: 90, Speed: 2}); err != nil {
		t.Errorf("long plain speed-up should pass: %v", err)
	}
	audio, _ := validateStudioRetimeInput(studioRetimeInput{URL: ok.URL, Kind: "audio", End: 5, Speed: 2, Stabilize: true, Smooth: true})
	if audio.Stabilize || audio.Smooth {
		t.Error("audio drops video-only options")
	}
	smooth, _ := validateStudioRetimeInput(studioRetimeInput{URL: ok.URL, Kind: "video", End: 5, Speed: 2, Smooth: true})
	if smooth.Smooth {
		t.Error("smooth only applies to slow motion")
	}
}

func TestStudioRetimeFilters(t *testing.T) {
	in := studioRetimeInput{Speed: -0.25, Smooth: true}
	v := studioRetimeVideoFilter(in, true)
	if !strings.HasPrefix(v, "reverse,setpts=PTS/0.2500,minterpolate") {
		t.Errorf("video filter %q", v)
	}
	if a := studioRetimeAudioFilter(in, true); a != "areverse,atempo=0.5,atempo=0.5000" {
		t.Errorf("audio filter %q", a)
	}
	if a := studioAtempoChain(4); a != "atempo=2.0,atempo=2.0000" {
		t.Errorf("fast chain %q", a)
	}
	if v := studioRetimeVideoFilter(studioRetimeInput{Speed: 1}, false); v != "" {
		t.Errorf("identity filter %q", v)
	}
}

func TestRenderStudioRetimeReal(t *testing.T) {
	for _, bin := range []string{"ffmpeg", "ffprobe"} {
		if out, err := exec.Command(bin, "-version").CombinedOutput(); err != nil || len(out) == 0 {
			t.Skip(bin + " unavailable")
		}
	}
	if out, _ := exec.Command("ffmpeg", "-hide_banner", "-filters").Output(); !strings.Contains(string(out), "vidstabdetect") {
		t.Skip("vidstab unavailable")
	}
	dir := t.TempDir()
	src := filepath.Join(dir, "src.mp4")
	if out, err := exec.Command("ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=24:duration=8", "-f", "lavfi", "-i", "sine=frequency=440:duration=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", src).CombinedOutput(); err != nil {
		t.Fatalf("source: %s", out)
	}
	cases := []struct {
		name  string
		input studioRetimeInput
		want  float64
	}{
		{"reverse", studioRetimeInput{Kind: "video", Start: 1, End: 8, Speed: -1}, 7},
		{"reverse2x", studioRetimeInput{Kind: "video", Start: 0, End: 8, Speed: -2}, 4},
		{"slow", studioRetimeInput{Kind: "video", Start: 0, End: 4, Speed: 0.5}, 8},
		{"stabilize", studioRetimeInput{Kind: "video", Start: 0, End: 6, Speed: 1, Stabilize: true}, 6},
		{"stabilizeReverse", studioRetimeInput{Kind: "video", Start: 0, End: 6, Speed: -1, Stabilize: true}, 6},
		{"audio", studioRetimeInput{Kind: "audio", Start: 0, End: 4, Speed: -2}, 2},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.input.URL = src
			ext, _ := studioRetimeOutputExt(tc.input)
			out := filepath.Join(t.TempDir(), "out."+ext)
			work := t.TempDir()
			if err := renderStudioRetime(context.Background(), work, tc.input, out); err != nil {
				t.Fatal(err)
			}
			got := probeStudioDuration(context.Background(), out)
			if math.Abs(got-tc.want) > 0.35 {
				t.Errorf("duration %.2f want %.2f", got, tc.want)
			}
		})
	}
}
