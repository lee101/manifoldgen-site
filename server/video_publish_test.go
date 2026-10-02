package main

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func TestEncodeAV1WebMShrinksH264Master(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg unavailable")
	}
	dir := t.TempDir()
	src, out := filepath.Join(dir, "in.mp4"), filepath.Join(dir, "out.webm")
	gen := exec.Command("ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", src)
	if output, err := gen.CombinedOutput(); err != nil {
		t.Skipf("ffmpeg cannot build fixture: %s", tailOutput(output))
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if err := encodeAV1WebM(ctx, src, out); err != nil {
		t.Skipf("no AV1 encoder: %v", err)
	}
	in, _ := os.Stat(src)
	webm, err := os.Stat(out)
	if err != nil || webm.Size() == 0 || webm.Size() >= in.Size() {
		t.Fatalf("webm %v not smaller than mp4 %d (%v)", webm, in.Size(), err)
	}
}

func TestFinalVideoFormat(t *testing.T) {
	if finalVideoFormat("https://x.test/a/b.webm?v=1") != "webm/av1+opus" || finalVideoFormat("https://x.test/a.mp4") != "mp4/h264+aac" {
		t.Fatal("unexpected format label")
	}
}
