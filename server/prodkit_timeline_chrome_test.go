//go:build prodkitchrome

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

func timelineFixture(t *testing.T, path string, args ...string) {
	t.Helper()
	cmd := exec.Command("ffmpeg", append([]string{"-y", "-loglevel", "error"}, append(args, path)...)...)
	if out, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("ffmpeg %s: %v %s", filepath.Base(path), err, out)
	}
}

func timelineChromeMedia(t *testing.T, ctx context.Context, doc *timelineDocument, files map[string]string) timelineMedia {
	t.Helper()
	media := timelineMedia{Info: map[string]timelineMediaInfo{}, Paths: map[string]string{}}
	for _, asset := range doc.Assets {
		if asset.CloudURL == "" {
			continue
		}
		info, path, err := inspectTimelineMedia(ctx, files[asset.CloudURL], asset.Kind, asset.CloudURL)
		if err != nil {
			t.Fatal(err)
		}
		media.Info[asset.CloudURL], media.Paths[asset.CloudURL] = info, path
	}
	return media
}

func requireTimelineChrome(t *testing.T) {
	if prodkitChromeBinary() == "" {
		t.Skip("google-chrome not installed")
	}
	if !timelineRendererAvailable() {
		t.Skip("build the frontend export and set PRODKIT_RENDER_DIST (or PRODKIT_RENDER_ORIGIN)")
	}
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not installed")
	}
}

func renderTimelineFixture(t *testing.T, ctx context.Context, raw string, files map[string]string, settings timelineRenderSettings) (timelineProbe, string, float64) {
	t.Helper()
	dir := t.TempDir()
	doc, err := parseTimelineDocument([]byte(raw), timelineMaxDocBytes)
	if err != nil {
		t.Fatal(err)
	}
	if err := resolveTimelineLUTs(ctx, doc, dir); err != nil {
		t.Fatal(err)
	}
	media := timelineChromeMedia(t, ctx, doc, files)
	if err := doc.finalize(media.lookup); err != nil {
		t.Fatal(err)
	}
	started := time.Now()
	out, gpu, err := renderTimelineInChrome(ctx, doc, media.Paths, settings, dir, func(float64) {})
	if err != nil {
		t.Fatal(err)
	}
	elapsed := time.Since(started).Seconds()
	final, poster, _, err := finishTimelineRender(ctx, out, settings, dir)
	if err != nil {
		t.Fatal(err)
	}
	if poster == "" {
		t.Fatal("no poster")
	}
	if keep := os.Getenv("TIMELINE_KEEP"); keep != "" {
		_ = exec.Command("cp", final, filepath.Join(keep, fmt.Sprintf("timeline-%d.%s", time.Now().UnixNano(), settings.Format))).Run()
	}
	probe, err := probeTimelineFile(ctx, final)
	if err != nil {
		t.Fatal(err)
	}
	frames, err := exec.Command("ffprobe", "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", final).Output()
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("renderer=%s %dx%d %.2fs rendered in %.1fs (%.2f s per output second)", gpu, probe.Width, probe.Height, probe.Duration, elapsed, elapsed/probe.Duration)
	return probe, strings.TrimSpace(string(frames)), elapsed
}

func TestTimelineChromeRender(t *testing.T) {
	requireTimelineChrome(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	dir := t.TempDir()
	files := map[string]string{
		"https://example.com/a.mp4":   filepath.Join(dir, "a.mp4"),
		"https://example.com/b.mp4":   filepath.Join(dir, "b.mp4"),
		"https://example.com/bed.wav": filepath.Join(dir, "bed.wav"),
	}
	timelineFixture(t, files["https://example.com/a.mp4"], "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=30", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p")
	timelineFixture(t, files["https://example.com/b.mp4"], "-f", "lavfi", "-i", "smptebars=size=640x360:rate=30", "-f", "lavfi", "-i", "sine=frequency=550:sample_rate=48000", "-t", "2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac")
	timelineFixture(t, files["https://example.com/bed.wav"], "-f", "lavfi", "-i", "sine=frequency=220:sample_rate=48000", "-t", "4")
	raw := `{
		"canvas": {"width": 640, "height": 360},
		"luts": {"warm": {"name": "Warm", "cube": "LUT_3D_SIZE 2\n0 0 0.02\n1 0.05 0\n0 0.95 0\n1 0.98 0\n0.03 0 0.9\n1 0.05 0.85\n0.03 0.95 0.85\n1 1 0.95\n"}},
		"assets": [
			{"id": "title", "kind": "image", "visualTrack": 1, "timelineStart": 0, "trimEnd": 1.5, "stageScale": 0.6, "text": {"content": "Timeline test", "fontSize": 120, "fontFamily": "Bebas Neue"}},
			{"id": "a", "kind": "video", "cloudURL": "https://example.com/a.mp4", "trimEnd": 1.5},
			{"id": "b", "kind": "video", "cloudURL": "https://example.com/b.mp4", "trimStart": 0.25, "trimEnd": 1.75, "transition": {"type": "crossfade", "duration": 0.5},
			 "adjustments": {"contrast": 0.2, "saturation": 0.25, "vignette": 0.3, "lutID": "warm", "lutIntensity": 0.8}},
			{"id": "bed", "kind": "audio", "cloudURL": "https://example.com/bed.wav", "timelineStart": 0, "trimEnd": 3, "volume": 0.6, "fadeOut": 0.5}
		]
	}`
	probe, frames, _ := renderTimelineFixture(t, ctx, raw, files, timelineRenderSettings{Format: "mp4", Quality: "balanced", Resolution: "source", FPS: 30})
	if probe.Width != 640 || probe.Height != 360 || probe.VideoCodec != "h264" || probe.AudioCodec != "aac" {
		t.Fatalf("probe = %+v", probe)
	}
	if probe.Duration < 2.95 || probe.Duration > 3.1 {
		t.Fatalf("duration = %.3f", probe.Duration)
	}
	if count, _ := strconv.Atoi(frames); count != 90 {
		t.Fatalf("frames = %s", frames)
	}
}

func TestTimelineChromeRenderSpeed(t *testing.T) {
	if os.Getenv("TIMELINE_BENCH") != "1" {
		t.Skip("set TIMELINE_BENCH=1")
	}
	requireTimelineChrome(t)
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
	defer cancel()
	dir := t.TempDir()
	for _, size := range [][2]int{{1280, 720}, {1920, 1080}} {
		clip := filepath.Join(dir, fmt.Sprintf("clip-%d.mp4", size[1]))
		timelineFixture(t, clip, "-f", "lavfi", "-i", fmt.Sprintf("testsrc2=size=%dx%d:rate=30", size[0], size[1]), "-t", "6", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p")
		files := map[string]string{"https://example.com/clip.mp4": clip}
		assets := []map[string]interface{}{}
		for i := 0; i < 2; i++ {
			asset := map[string]interface{}{"id": fmt.Sprintf("c%d", i), "kind": "video", "cloudURL": "https://example.com/clip.mp4", "trimEnd": 5, "adjustments": map[string]interface{}{"contrast": 0.1, "saturation": 0.2}}
			if i == 1 {
				asset["transition"] = map[string]interface{}{"type": "crossfade", "duration": 1}
			}
			assets = append(assets, asset)
		}
		raw, _ := json.Marshal(map[string]interface{}{"canvas": map[string]int{"width": size[0], "height": size[1]}, "assets": assets})
		probe, _, elapsed := renderTimelineFixture(t, ctx, string(raw), files, timelineRenderSettings{Format: "mp4", Quality: "balanced", Resolution: "source", FPS: 30})
		t.Logf("BENCH %dp: %.2f s per output second", size[1], elapsed/probe.Duration)
	}
}
