package main

import (
	"strings"
	"testing"
)

func mixShot(start, dur float64, line string) dramatizeShotResult {
	return dramatizeShotResult{Shot: DramatizeShot{DialogueTranscript: line}, Start: start, Duration: dur}
}

func TestTrailerScoreWindowsSwellOnlyWithoutDialogue(t *testing.T) {
	shots := []dramatizeShotResult{
		mixShot(0, 6, "Vesper: stay."),
		mixShot(6, 3, ""), // aerial establishing
		mixShot(9, 2, ""), // continues the dialogue-free run
		mixShot(11, 5, "Orin: no."),
		mixShot(16, 1.5, ""), // too short to swell
		mixShot(17.5, 4, "Tomas: go."),
		mixShot(21.5, 3, ""), // final title hold
	}
	got := trailerScoreWindows(shots)
	if len(got) != 2 || got[0] != (trailerScoreWindow{6, 11}) || got[1] != (trailerScoreWindow{21.5, 24.5}) {
		t.Fatalf("windows = %+v", got)
	}
}

func TestTrailerScoreVolumeExprStaysLowWithoutWindows(t *testing.T) {
	if got := trailerScoreVolumeExpr(nil); got != "0.30" {
		t.Fatalf("expr = %q", got)
	}
	expr := trailerScoreVolumeExpr([]trailerScoreWindow{{6, 11}})
	if !strings.HasPrefix(expr, "0.30+0.65*clip(min((t-6.000)/1.20,(11.000-t)/1.00),0,1)") {
		t.Fatalf("expr = %q", expr)
	}
}

func TestTrailerSpeechGapsFindsLongSilencesOnly(t *testing.T) {
	// 0.25 s windows: speech, 3 s of ambience, speech, 1 s of ambience, speech
	var levels []float64
	add := func(n int, db float64) {
		for i := 0; i < n; i++ {
			levels = append(levels, db)
		}
	}
	add(8, -30)
	add(12, -52)
	add(8, -25)
	add(4, -52)
	add(8, -30)
	gaps := trailerSpeechGaps(levels)
	// the 3 s gap loses 0.25 s of guard each side: windows 9..19 -> 2.25 s..4.75 s? it must be >= 2.5 s to count
	if len(gaps) != 1 || gaps[0].Start != 2.25 || gaps[0].End != 4.75 {
		t.Fatalf("gaps = %+v", gaps)
	}
}
