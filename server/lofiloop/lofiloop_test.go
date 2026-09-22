package lofiloop

import (
	"context"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// requireFFmpeg skips the test when the host has no usable ffmpeg.
func requireFFmpeg(t *testing.T) string {
	t.Helper()
	path, err := exec.LookPath(ffmpegBinary())
	if err != nil {
		t.Skip("ffmpeg is not available")
	}
	return path
}

func TestAllVisualizersResolvePlaceholders(t *testing.T) {
	spec := DefaultSpec()
	plan, err := BuildPlan(1280, 704, 24, 60, 0, 0, 1.5)
	if err != nil {
		t.Fatalf("BuildPlan: %v", err)
	}
	for _, visualizer := range spec.Visualizers {
		t.Run(visualizer.ID, func(t *testing.T) {
			graph, err := FilterComplex(graphRequest{
				Plan: plan, Motion: "drift", Viz: visualizer, Palette: spec.Palettes[0],
				Alpha: 0.7, Seed: 1,
			})
			if err != nil {
				t.Fatalf("FilterComplex: %v", err)
			}
			if strings.Contains(graph, "{{") {
				t.Fatalf("graph left an unresolved placeholder: %s", graph)
			}
			if !strings.Contains(graph, "[bg]") || !strings.Contains(graph, "[vout]") {
				t.Fatalf("graph is missing its background or output label: %s", graph)
			}
		})
	}
}

func TestFilterComplexWithoutVisualizerMapsBackground(t *testing.T) {
	plan, err := BuildPlan(1280, 704, 24, 30, 0, 0, 1.5)
	if err != nil {
		t.Fatalf("BuildPlan: %v", err)
	}
	graph, err := FilterComplex(graphRequest{Plan: plan, Motion: "static", Viz: Visualizer{ID: VisualizerNone}})
	if err != nil {
		t.Fatalf("FilterComplex: %v", err)
	}
	if strings.Contains(graph, "blend=") || strings.Contains(graph, "overlay=") {
		t.Fatalf("cover-only render should not composite a visualizer: %s", graph)
	}
	if !strings.Contains(graph, "[bg]null[vout]") && !strings.Contains(graph, "[bg]format=") {
		t.Fatalf("cover-only render must pass the background through: %s", graph)
	}
	if strings.Contains(graph, "blend=") {
		t.Fatalf("cover-only render should not blend a visualizer: %s", graph)
	}
}

// TestPlanMotionCycles defends the loop's core invariant: the motion is
// sin(2*pi*cycles*n/span) with span = N-1, so any whole cycle count reproduces
// frame zero - and the cycle has to stay slow, never a per-frame jitter.
func TestPlanMotionCycles(t *testing.T) {
	target := motionCycleTarget(24)
	for _, length := range []float64{4.2, 8, 30.5, 61.7, 96} {
		plan, err := BuildPlan(1280, 704, 24, length, 0, 0, 1.5)
		if err != nil {
			t.Fatalf("BuildPlan(%.1f): %v", length, err)
		}
		if plan.Frames < 2 {
			t.Fatalf("plan for %.1fs produced %d frames", length, plan.Frames)
		}
		if plan.Cycles < 1 {
			t.Fatalf("plan for %.1fs has %d motion cycles", length, plan.Cycles)
		}
		span := plan.Frames - 1
		want := target / 2
		if span < want {
			want = span // a loop shorter than one target cycle gets a single cycle
		}
		if framesPerCycle := span / plan.Cycles; framesPerCycle < want {
			t.Fatalf("plan for %.1fs drifts every %d frames, too fast for a %.1fs target",
				length, framesPerCycle, float64(target)/24)
		}
		if got := float64(plan.Frames) / float64(plan.FPS); got != plan.Seconds {
			t.Fatalf("seconds %.4f disagrees with %d frames at %d fps", got, plan.Frames, plan.FPS)
		}
	}
}

func TestPlanRejectsImpossibleWindows(t *testing.T) {
	cases := map[string]struct {
		source, from, length, seam float64
	}{
		"shorter than the minimum": {source: 10, length: 1, seam: 1.5},
		"start beyond the track":   {source: 10, from: 9.5, length: 5, seam: 1.5},
		"length beyond the track":  {source: 10, length: 30, seam: 1.5},
		"unknown source":           {source: 0, length: 5, seam: 1.5},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := BuildPlan(1280, 704, 24, tc.source, tc.from, tc.length, tc.seam); err == nil {
				t.Fatal("expected BuildPlan to reject the window")
			}
		})
	}
}

func TestParseSizeEnforcesGrid(t *testing.T) {
	if _, _, err := ParseSize("1280x704"); err != nil {
		t.Fatalf("1280x704 should parse: %v", err)
	}
	for _, size := range []string{"1280x720", "1279x704", "100x100", "wide"} {
		if _, _, err := ParseSize(size); err == nil {
			t.Fatalf("expected %q to be rejected", size)
		}
	}
}

// TestRenderedLoopIsFrameExact renders a real two-second loop and proves the
// first and last frame of the art layer are byte-identical.
func TestRenderedLoopIsFrameExact(t *testing.T) {
	ffmpeg := requireFFmpeg(t)
	workDir := t.TempDir()
	still := filepath.Join(workDir, "cover.png")
	audio := filepath.Join(workDir, "tone.wav")
	run := func(args ...string) {
		t.Helper()
		if out, err := exec.CommandContext(context.Background(), ffmpeg, args...).CombinedOutput(); err != nil {
			t.Fatalf("ffmpeg %v: %v: %s", args, err, out)
		}
	}
	run("-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=1280x704:rate=1:duration=1",
		"-frames:v", "1", still)
	run("-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=9",
		"-ac", "2", "-ar", "44100", audio)

	for _, motion := range MotionIDs() {
		t.Run(motion, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
			defer cancel()
			result, err := Render(ctx, Request{
				ID: "seam-" + motion, AudioPath: audio, CoverPath: still, OutDir: workDir,
				Motion: motion, Visualizer: VisualizerNone,
				Size: "640x384", FPS: 12, LoopSeconds: 4, CRF: 0, Verify: true,
			})
			if err != nil {
				t.Fatalf("Render: %v", err)
			}
			if result.Loop == nil || !result.Loop.Checked {
				t.Fatal("render did not verify the loop")
			}
			if !result.Loop.Exact {
				t.Fatalf("art layer is not frame-exact: mean %.3f max %d",
					result.Loop.MeanAbsDiff, result.Loop.MaxAbsDiff)
			}
		})
	}
}

// TestRenderRefusesMissingCoverInput checks the renderer fails loudly instead of
// shipping a video without art.
func TestRenderRefusesMissingCoverInput(t *testing.T) {
	workDir := t.TempDir()
	audio := filepath.Join(workDir, "tone.wav")
	if _, err := exec.LookPath(ffmpegBinary()); err == nil {
		if out, err := exec.Command(ffmpegBinary(), "-y", "-v", "error", "-f", "lavfi",
			"-i", "sine=frequency=220:duration=9", "-ac", "2", "-ar", "44100", audio).CombinedOutput(); err != nil {
			t.Fatalf("ffmpeg: %v: %s", err, out)
		}
	} else {
		t.Skip("ffmpeg is not available")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if _, err := Render(ctx, Request{
		ID: "no-cover", AudioPath: audio, OutDir: workDir, Motion: "drift",
		Size: "640x384", LoopSeconds: 4,
	}); err == nil {
		t.Fatal("expected Render to require a cover")
	}
}
