package main

import (
	"context"
	"math"
	"os"
	"path/filepath"
	"testing"
)

const dramatizeFixtureVideo = "/vfast/data/code/vids/robotrun.mp4"

func requireFixtureVideo(t *testing.T) {
	t.Helper()
	requireFFmpeg(t)
	if _, err := os.Stat(dramatizeFixtureVideo); err != nil {
		t.Skipf("fixture %s not present", dramatizeFixtureVideo)
	}
}

func TestProbeVideoFileReadsRobotRun(t *testing.T) {
	requireFixtureVideo(t)
	probe, err := probeVideoFile(context.Background(), dramatizeFixtureVideo)
	if err != nil {
		t.Fatalf("probeVideoFile: %v", err)
	}
	if probe.Width != 544 || probe.Height != 960 {
		t.Errorf("dimensions = %dx%d, want 544x960", probe.Width, probe.Height)
	}
	if math.Abs(probe.Duration-11.53) > 0.2 {
		t.Errorf("duration = %.2f, want ~11.53", probe.Duration)
	}
	if math.Abs(probe.FPS-30) > 0.1 {
		t.Errorf("fps = %.2f, want 30", probe.FPS)
	}
	if !probe.HasAudio {
		t.Error("expected an audio stream")
	}
}

func TestParseFrameRate(t *testing.T) {
	cases := map[string]float64{"30/1": 30, "30000/1001": 29.97, "0/0": 0, "25": 25, "": 0}
	for input, want := range cases {
		if got := parseFrameRate(input); math.Abs(got-want) > 0.01 {
			t.Errorf("parseFrameRate(%q) = %v, want %v", input, got, want)
		}
	}
}

func TestSampleTimesSpreadsAcrossDuration(t *testing.T) {
	got := sampleTimes(10, 4)
	if len(got) != 4 {
		t.Fatalf("len = %d, want 4", len(got))
	}
	for i := 1; i < len(got); i++ {
		if got[i] <= got[i-1] {
			t.Fatalf("not increasing: %v", got)
		}
	}
	// Never lands on the very first or last frame.
	if got[0] <= 0 || got[len(got)-1] >= 10 {
		t.Errorf("sample times touch the edges: %v", got)
	}
	if len(sampleTimes(10, 1)) != 1 || sampleTimes(10, 1)[0] != 5 {
		t.Errorf("single sample should be the midpoint, got %v", sampleTimes(10, 1))
	}
	if sampleTimes(0, 3) != nil || sampleTimes(10, 0) != nil {
		t.Error("degenerate inputs should return nil")
	}
}

func TestPlanSourceCutsSnapsToBeatsAndEnforcesLength(t *testing.T) {
	analysis := &AudioAnalysis{
		Duration:   12,
		BeatTimes:  []float64{1.0, 3.0, 5.0, 7.0},
		OnsetTimes: []float64{1.05, 3.02},
	}
	cuts := planSourceCuts([][2]float64{{1.1, 2.9}, {6.9, 7.05}}, analysis, 12, 1.0)
	if len(cuts) != 2 {
		t.Fatalf("cuts = %v, want 2", cuts)
	}
	// Snapping takes the nearest cut point of either kind: the 1.05 onset beats
	// the 1.0 beat for a 1.1 start, while 2.9 lands on the 3.0 beat.
	if math.Abs(cuts[0][0]-1.05) > 1e-9 || math.Abs(cuts[0][1]-3.0) > 1e-9 {
		t.Errorf("cuts[0] = %v, want [1.05 3]", cuts[0])
	}
	// Second window collapsed onto one beat, so it gets extended to minLength.
	if cuts[1][1]-cuts[1][0] < 1.0-1e-9 {
		t.Errorf("cuts[1] = %v, want at least 1s long", cuts[1])
	}
	if cuts[1][1] > 12 {
		t.Errorf("cuts[1] runs past the source: %v", cuts[1])
	}
}

func TestPlanSourceCutsDropsWindowsThatCannotReachMinLength(t *testing.T) {
	// A window at the very end of a 2s source cannot be stretched to 1s.
	cuts := planSourceCuts([][2]float64{{1.9, 1.95}}, nil, 2, 1.0)
	if len(cuts) != 0 {
		t.Errorf("expected the window to be dropped, got %v", cuts)
	}
}

// The real work: cut two source windows, normalise both to portrait, and
// concatenate. Verifies the output is the exact canvas and the expected length.
func TestRenderAndConcatProducesPortraitVideo(t *testing.T) {
	requireFixtureVideo(t)
	dir := t.TempDir()
	ctx := context.Background()

	segments := []string{}
	for i, window := range [][2]float64{{0.5, 2.0}, {6.0, 7.5}} {
		dest := filepath.Join(dir, "seg_"+string(rune('a'+i))+".mp4")
		if err := renderSegment(ctx, dramatizeFixtureVideo, window[0], window[1]-window[0], true, dest); err != nil {
			t.Fatalf("renderSegment: %v", err)
		}
		segments = append(segments, dest)
	}

	final := filepath.Join(dir, "final.mp4")
	if err := concatSegments(ctx, segments, final); err != nil {
		t.Fatalf("concatSegments: %v", err)
	}

	probe, err := probeVideoFile(ctx, final)
	if err != nil {
		t.Fatalf("probe final: %v", err)
	}
	if probe.Width != dramatizeCanvasWidth || probe.Height != dramatizeCanvasHeight {
		t.Errorf("final = %dx%d, want %dx%d", probe.Width, probe.Height, dramatizeCanvasWidth, dramatizeCanvasHeight)
	}
	if math.Abs(probe.Duration-3.0) > 0.35 {
		t.Errorf("final duration = %.2f, want ~3.0", probe.Duration)
	}
	if !probe.HasAudio {
		t.Error("concatenated output lost its audio track")
	}
}

// A generated clip has no audio; the renderer must synthesise a silent track so
// concatenation with source cuts keeps a continuous audio stream.
func TestRenderSegmentSynthesisesSilenceForMuteInput(t *testing.T) {
	requireFixtureVideo(t)
	dir := t.TempDir()
	ctx := context.Background()

	mute := filepath.Join(dir, "mute.mp4")
	if err := runFFmpeg(ctx, "-y", "-v", "error", "-i", dramatizeFixtureVideo, "-t", "2", "-an",
		"-c:v", "libx264", "-preset", "ultrafast", mute); err != nil {
		t.Fatalf("build mute fixture: %v", err)
	}
	if probe, err := probeVideoFile(ctx, mute); err != nil || probe.HasAudio {
		t.Fatalf("mute fixture still has audio (err=%v)", err)
	}

	dest := filepath.Join(dir, "seg.mp4")
	if err := renderSegment(ctx, mute, 0, 1.5, false, dest); err != nil {
		t.Fatalf("renderSegment: %v", err)
	}
	probe, err := probeVideoFile(ctx, dest)
	if err != nil {
		t.Fatalf("probe: %v", err)
	}
	if !probe.HasAudio {
		t.Error("expected a synthesised silent audio track")
	}
	if probe.Width != dramatizeCanvasWidth || probe.Height != dramatizeCanvasHeight {
		t.Errorf("segment = %dx%d, want portrait canvas", probe.Width, probe.Height)
	}
}

func TestExtractKeyframesWritesRequestedStills(t *testing.T) {
	requireFixtureVideo(t)
	dir := t.TempDir()
	times := sampleTimes(11.5, 3)
	paths, err := extractKeyframes(context.Background(), dramatizeFixtureVideo, times, dir, 384)
	if err != nil {
		t.Fatalf("extractKeyframes: %v", err)
	}
	if len(paths) != 3 {
		t.Fatalf("got %d frames, want 3", len(paths))
	}
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			t.Fatalf("stat %s: %v", p, err)
		}
		if info.Size() < 1024 {
			t.Errorf("%s is suspiciously small (%d bytes)", filepath.Base(p), info.Size())
		}
	}
}
