package lofiloop

import (
	"context"
	"os/exec"
	"path/filepath"
	"testing"
)

func TestTileClipAndConcat(t *testing.T) {
	if _, err := exec.LookPath(ffmpegBinary()); err != nil {
		t.Skip("ffmpeg unavailable")
	}
	ctx := context.Background()
	dir := t.TempDir()
	clip := filepath.Join(dir, "clip.mp4")
	audio := filepath.Join(dir, "a.wav")
	if err := RunFFmpeg(ctx, "-y", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=12:duration=2", "-pix_fmt", "yuv420p", clip); err != nil {
		t.Fatal(err)
	}
	if err := RunFFmpeg(ctx, "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=5", audio); err != nil {
		t.Fatal(err)
	}
	a := filepath.Join(dir, "a.mp4")
	res, err := TileClip(ctx, ClipRequest{Clip: clip, Audio: audio, Out: a, Width: 320, Height: 180, FPS: 12})
	if err != nil {
		t.Fatal(err)
	}
	if res.Repeats != 3 || res.Seconds < 4.9 {
		t.Fatalf("unexpected %+v", res)
	}
	out := filepath.Join(dir, "all.mp4")
	if err := ConcatVideos(ctx, []string{a, a}, out); err != nil {
		t.Fatal(err)
	}
	seconds, err := ProbeDurationSeconds(ctx, out)
	if err != nil || seconds < 9.5 {
		t.Fatalf("duration %v err %v", seconds, err)
	}
	if got := ChapterTimestamps([]float64{180, 60}, nil); got[1] != "03:00 Track 2" {
		t.Fatal(got)
	}
}
