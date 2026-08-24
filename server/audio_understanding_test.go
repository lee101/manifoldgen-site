package main

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"os/exec"
	"testing"
)

const parityFixtureVideo = "/vfast/data/code/vids/robotrun.mp4"

func requireFFmpeg(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg not available")
	}
}

// A synthetic click track at a known tempo is the ground truth the port has to
// reproduce: onsets land on the clicks and the tempo estimate matches.
func synthClickTrack(sr int, bpm float64, seconds float64) []float64 {
	n := int(float64(sr) * seconds)
	y := make([]float64, n)
	period := 60.0 / bpm
	for beat := 0; ; beat++ {
		start := int(float64(beat) * period * float64(sr))
		if start >= n {
			break
		}
		// 40 ms exponentially-decaying 1 kHz burst.
		burst := int(0.04 * float64(sr))
		for i := 0; i < burst && start+i < n; i++ {
			tt := float64(i) / float64(sr)
			y[start+i] += math.Sin(2*math.Pi*1000*tt) * math.Exp(-40*tt)
		}
	}
	return y
}

func TestOnsetDetectionFindsClicksAtKnownTempo(t *testing.T) {
	sr := audioDefaultSampleRate
	const bpm = 120.0
	y := synthClickTrack(sr, bpm, 8)

	opts := DefaultAudioAnalysisOptions()
	opts.StartBPM = 120
	got := AnalyzeAudioSamples(y, opts)

	// The click at t=0 is unreachable: onset strength is a first-order
	// difference, so frame 0 has no predecessor to rise above. librosa behaves
	// the same way. Expect every click from the second one on.
	expected := []float64{}
	for tt := 60.0 / bpm; tt < 8; tt += 60.0 / bpm {
		expected = append(expected, tt)
	}
	if len(got.OnsetTimes) != len(expected) {
		t.Fatalf("onset count = %d, want %d (%v)", len(got.OnsetTimes), len(expected), got.OnsetTimes)
	}
	// Onsets quantize to whichever STFT frame carries the energy jump, so they
	// land within one hop (46 ms) either side of the true transient.
	hop := float64(opts.HopLength) / float64(sr)
	for i, want := range expected {
		if delta := math.Abs(got.OnsetTimes[i] - want); delta > hop {
			t.Errorf("onset[%d] = %.4f, want %.4f (±%.4f)", i, got.OnsetTimes[i], want, hop)
		}
	}
	if math.Abs(got.Tempo-bpm) > 3 {
		t.Errorf("tempo = %.2f, want ~%.0f", got.Tempo, bpm)
	}
	if len(got.BeatTimes) < 12 {
		t.Errorf("beat count = %d, want >= 12 for 8s at 120bpm", len(got.BeatTimes))
	}
}

func TestSilenceProducesNoOnsets(t *testing.T) {
	y := make([]float64, audioDefaultSampleRate*3)
	got := AnalyzeAudioSamples(y, DefaultAudioAnalysisOptions())
	if len(got.OnsetTimes) != 0 {
		t.Errorf("silence produced %d onsets: %v", len(got.OnsetTimes), got.OnsetTimes)
	}
}

func TestSpectralCentroidTracksPitch(t *testing.T) {
	sr := audioDefaultSampleRate
	lo := make([]float64, sr*2)
	hi := make([]float64, sr*2)
	for i := range lo {
		tt := float64(i) / float64(sr)
		lo[i] = math.Sin(2 * math.Pi * 220 * tt)
		hi[i] = math.Sin(2 * math.Pi * 3520 * tt)
	}
	opts := DefaultAudioAnalysisOptions()
	opts.IncludeSeries = true
	loRes := AnalyzeAudioSamples(lo, opts)
	hiRes := AnalyzeAudioSamples(hi, opts)

	loMid := loRes.SpectralCentroid[len(loRes.SpectralCentroid)/2]
	hiMid := hiRes.SpectralCentroid[len(hiRes.SpectralCentroid)/2]
	if !(loMid > 150 && loMid < 400) {
		t.Errorf("220Hz tone centroid = %.1f, want ~220", loMid)
	}
	if !(hiMid > 3000 && hiMid < 4200) {
		t.Errorf("3520Hz tone centroid = %.1f, want ~3520", hiMid)
	}
	if hiMid <= loMid {
		t.Errorf("centroid did not increase with pitch: %.1f vs %.1f", loMid, hiMid)
	}
}

func TestBeatGridRespectsMinimumGap(t *testing.T) {
	a := &AudioAnalysis{
		Duration:   10,
		BeatTimes:  []float64{0, 0.2, 0.5, 1.4, 1.45, 2.9, 5.0},
		OnsetTimes: []float64{0, 1, 2},
	}
	grid := a.BeatGrid(1.0)
	want := []float64{0, 1.4, 2.9, 5.0}
	if len(grid) != len(want) {
		t.Fatalf("grid = %v, want %v", grid, want)
	}
	for i := range want {
		if math.Abs(grid[i]-want[i]) > 1e-9 {
			t.Fatalf("grid = %v, want %v", grid, want)
		}
	}
}

func TestSnapToBeatPrefersNearestWithinTolerance(t *testing.T) {
	a := &AudioAnalysis{BeatTimes: []float64{1.0, 2.0}, OnsetTimes: []float64{1.88}}
	if got := a.SnapToBeat(1.9, 0.2); math.Abs(got-1.88) > 1e-9 {
		t.Errorf("SnapToBeat(1.9) = %v, want the nearer onset 1.88", got)
	}
	if got := a.SnapToBeat(5.0, 0.2); math.Abs(got-5.0) > 1e-9 {
		t.Errorf("SnapToBeat(5.0) has nothing in tolerance and should stay put, got %v", got)
	}
	// A tracked beat wins ties against an equidistant onset.
	tie := &AudioAnalysis{BeatTimes: []float64{2.0}, OnsetTimes: []float64{1.9}}
	if got := tie.SnapToBeat(1.95, 0.2); math.Abs(got-2.0) > 1e-9 {
		t.Errorf("SnapToBeat tie = %v, want the beat 2.0", got)
	}
}

// Exercises the real decode path on the dramatizer's default source clip and
// writes the PCM + result the TypeScript parity test reads back.
func TestAnalyzeRobotRunVideo(t *testing.T) {
	requireFFmpeg(t)
	if _, err := os.Stat(parityFixtureVideo); err != nil {
		t.Skipf("fixture %s not present", parityFixtureVideo)
	}

	opts := DefaultAudioAnalysisOptions()
	opts.IncludeSeries = true
	got, err := AnalyzeAudioFile(context.Background(), parityFixtureVideo, opts)
	if err != nil {
		t.Fatalf("AnalyzeAudioFile: %v", err)
	}
	if got.Duration < 11 || got.Duration > 12 {
		t.Errorf("duration = %.2f, want ~11.5", got.Duration)
	}
	if len(got.OnsetTimes) == 0 {
		t.Fatal("no onsets detected in robotrun.mp4")
	}
	if got.Tempo <= 0 {
		t.Errorf("tempo = %v", got.Tempo)
	}
	for i, tt := range got.OnsetTimes {
		if tt < 0 || tt > got.Duration+0.1 {
			t.Fatalf("onset[%d] = %v outside [0, %v]", i, tt, got.Duration)
		}
	}
	if grid := got.BeatGrid(0.8); len(grid) < 2 {
		t.Errorf("beat grid too sparse: %v", grid)
	}

	if dir := os.Getenv("AUDIO_PARITY_DIR"); dir != "" {
		writeParityFixture(t, dir, got)
	}
	t.Logf("tempo=%.2f onsets=%d beats=%d duration=%.2f", got.Tempo, len(got.OnsetTimes), len(got.BeatTimes), got.Duration)
}

func writeParityFixture(t *testing.T, dir string, got *AudioAnalysis) {
	t.Helper()
	pcm, err := DecodeAudioMono(context.Background(), parityFixtureVideo, audioDefaultSampleRate)
	if err != nil {
		t.Fatalf("DecodeAudioMono: %v", err)
	}
	raw := make([]byte, 0, len(pcm)*4)
	for _, v := range pcm {
		bits := math.Float32bits(float32(v))
		raw = append(raw, byte(bits), byte(bits>>8), byte(bits>>16), byte(bits>>24))
	}
	if err := os.WriteFile(dir+"/robotrun.f32le", raw, 0o644); err != nil {
		t.Fatalf("write pcm: %v", err)
	}
	slim := *got
	slim.OnsetEnvelope, slim.RMS, slim.Times = nil, nil, nil
	slim.SpectralCentroid, slim.SpectralRolloff, slim.ZeroCrossingRate = nil, nil, nil
	blob, _ := json.MarshalIndent(&slim, "", "  ")
	if err := os.WriteFile(dir+"/robotrun.go.json", blob, 0o644); err != nil {
		t.Fatalf("write json: %v", err)
	}
}
