package main

import (
	"math"
	"testing"
)

func trailerClickTrack(seconds, interval float64) []float64 {
	y := make([]float64, int(seconds*trailerBeatSR))
	for n := 0; float64(n)*interval < seconds; n++ {
		amp := 0.5
		if n%4 == 0 {
			amp = 1
		}
		s := int(float64(n) * interval * trailerBeatSR)
		for i := 0; i < 400 && s+i < len(y); i++ {
			y[s+i] = amp * math.Exp(-float64(i)/80) * math.Sin(float64(i)*1.3)
		}
	}
	return y
}

func nearMultiple(t, step, tol float64) bool {
	r := math.Mod(t, step)
	return r < tol || step-r < tol
}

func TestTrailerBeatsFollowClicks(t *testing.T) {
	env := trailerOnsetEnvelope(trailerClickTrack(20, 0.5))
	bpm := trailerTempo(env)
	if math.Abs(bpm-120) > 4 && math.Abs(bpm-60) > 2 {
		t.Fatalf("bpm = %.1f", bpm)
	}
	beats := trailerBeats(env, bpm)
	if len(beats) < 15 {
		t.Fatalf("beats = %d", len(beats))
	}
	for _, b := range beats {
		if at := trailerFrameTime(b); at > 0.1 && !nearMultiple(at, 0.5, 0.04) {
			t.Fatalf("beat at %.3fs is off the clicks", at)
		}
	}
}

func TestTrailerCutPlanSnapsToBeats(t *testing.T) {
	env := trailerOnsetEnvelope(trailerClickTrack(34, 0.5))
	cuts, err := trailerCutPlan(env, 30, []float64{6, 8, 7, 9}, 5, 15)
	if err != nil {
		t.Fatal(err)
	}
	var sum float64
	for i, d := range cuts {
		if d < 5 || d > 15 {
			t.Fatalf("cut %d = %.2f", i, d)
		}
		sum += d
		if i < len(cuts)-1 && !nearMultiple(sum, 0.5, 0.04) {
			t.Fatalf("cut boundary %.3f off the beat (%v)", sum, cuts)
		}
	}
	if math.Abs(sum-30) > 0.01 {
		t.Fatalf("sum = %.3f (%v)", sum, cuts)
	}
	if _, err := trailerCutPlan(env, 12, []float64{6, 6, 6}, 5, 15); err == nil {
		t.Fatal("3 shots cannot fit 12s at >=5s each")
	}
}

func TestTrailerBeatSpanAndH3Seconds(t *testing.T) {
	if span, ok := trailerBeatSpan(43, 3, 4); !ok || span != 40 {
		t.Fatalf("span = %v %v", span, ok)
	}
	if span, ok := trailerBeatSpan(200, 3, 4); !ok || span != 60 {
		t.Fatalf("long score span = %v %v", span, ok)
	}
	if _, ok := trailerBeatSpan(20, 3, 4); ok {
		t.Fatal("score shorter than 4 minimum shots must not plan")
	}
	for in, want := range map[float64]int{4: 5, 5: 5, 5.0004: 5, 6.2: 7, 14.99: 15, 15: 15} {
		if got := trailerH3Seconds(in); got != want {
			t.Fatalf("h3(%v) = %d want %d", in, got, want)
		}
	}
}

func TestTrailerCutStartsSkipShotsWithoutFrames(t *testing.T) {
	results := []dramatizeShotResult{{ImageURL: "a", Shot: DramatizeShot{Seconds: 6.5}}, {Shot: DramatizeShot{Seconds: 5}}, {ImageURL: "c", Shot: DramatizeShot{Seconds: 7}}}
	if got := trailerCutStarts(results); got[0] != 0 || got[1] != 6.5 || got[2] != 6.5 {
		t.Fatalf("starts = %v", got)
	}
}
