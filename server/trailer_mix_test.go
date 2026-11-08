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

func TestTrailerSubtractWindowsKeepsScoreOffNarrator(t *testing.T) {
	gaps := []trailerScoreWindow{{0, 12}, {20, 23}}
	got := trailerSubtractWindows(gaps, []trailerScoreWindow{{4, 6}, {20.5, 21}}, 0.5)
	if len(got) != 2 || got[0] != (trailerScoreWindow{0, 3.5}) || got[1] != (trailerScoreWindow{6.5, 12}) {
		t.Fatalf("got = %+v", got)
	}
	if got := trailerSubtractWindows(gaps, nil, 0.5); len(got) != 2 {
		t.Fatalf("no narration must keep gaps: %+v", got)
	}
}

func TestTrailerDuckExpr(t *testing.T) {
	if got := trailerDuckExpr(nil, 0.45); got != "1" {
		t.Fatalf("expr = %q", got)
	}
	if got := trailerDuckExpr([]trailerScoreWindow{{2, 4}}, 0.45); got != "1-0.45*clip(min((t-1.750)/0.25,(4.250-t)/0.25),0,1)" {
		t.Fatalf("expr = %q", got)
	}
}

func TestTrailerMasterFilterInputs(t *testing.T) {
	vo := []trailerScoreWindow{{1, 2}}
	both := trailerMasterFilter(true, true, nil, vo)
	if !strings.Contains(both, "[1:a]") || !strings.Contains(both, "[2:a]") || !strings.Contains(both, "[a][m][vo]amix=inputs=3") || strings.Contains(both, "-0.45*") {
		t.Fatalf("music+vo = %s", both)
	}
	voOnly := trailerMasterFilter(false, true, nil, vo)
	if !strings.Contains(voOnly, "[1:a]") || !strings.Contains(voOnly, "[a][vo]amix=inputs=2") || !strings.Contains(voOnly, "1-0.45*") {
		t.Fatalf("vo only must duck the picture: %s", voOnly)
	}
	musicOnly := trailerMasterFilter(true, false, []trailerScoreWindow{{6, 11}}, nil)
	if !strings.Contains(musicOnly, "[a][m]amix=inputs=2") || !strings.Contains(musicOnly, "0.30+0.65*") {
		t.Fatalf("music only = %s", musicOnly)
	}
}
