package main

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"os/exec"
	"strings"
)

// Procedural score mix for the trailer agent: the score sits low (~30%) so characters stay intelligible, and swells to
// near full volume only where nobody talks for a while (sweeping establishing shots, silent beats, the title hold),
// ramping up as the shot opens and back down before the next line. conjurerssoul2/tools/gen.py mirrors these rules.
const (
	trailerScoreBase     = 0.30
	trailerScorePeak     = 0.95
	trailerScoreRampUp   = 1.2 // seconds to reach the peak
	trailerScoreRampDown = 1.0 // seconds to return to base, finished by the time speech resumes
	trailerScoreMinSwell = 2.5 // shortest dialogue-free run that earns a swell
)

type trailerScoreWindow struct{ Start, End float64 }

const (
	trailerSpeechHop      = 0.25 // seconds per level window
	trailerSpeechFloorDB  = -43  // band-passed (250-3400 Hz) RMS above this counts as speech; ambience sits at -50 or lower
	trailerSpeechGuardHop = 1    // windows of padding either side of speech
)

// trailerSpeechGaps finds the stretches of the picture audio with no speech, from per-window dialogue-band levels in dB.
// Gaps shorter than trailerScoreMinSwell are dropped; speech is padded so a swell never starts on a breath or tail.
func trailerSpeechGaps(levelsDB []float64) []trailerScoreWindow {
	speech := make([]bool, len(levelsDB))
	for i, db := range levelsDB {
		if db > trailerSpeechFloorDB {
			for j := i - trailerSpeechGuardHop; j <= i+trailerSpeechGuardHop; j++ {
				if j >= 0 && j < len(speech) {
					speech[j] = true
				}
			}
		}
	}
	var windows []trailerScoreWindow
	start := -1
	for i := 0; i <= len(speech); i++ {
		if i < len(speech) && !speech[i] {
			if start < 0 {
				start = i
			}
			continue
		}
		if start >= 0 && float64(i-start)*trailerSpeechHop >= trailerScoreMinSwell {
			windows = append(windows, trailerScoreWindow{Start: float64(start) * trailerSpeechHop, End: float64(i) * trailerSpeechHop})
		}
		start = -1
	}
	return windows
}

// analyzeTrailerSpeech decodes the picture's dialogue band and returns its swell windows.
func analyzeTrailerSpeech(ctx context.Context, picturePath string) ([]trailerScoreWindow, error) {
	out, err := exec.CommandContext(ctx, "ffmpeg", "-v", "error", "-i", picturePath, "-vn", "-af", "highpass=f=250,lowpass=f=3400",
		"-ac", "1", "-ar", "16000", "-f", "f32le", "-").Output()
	if err != nil {
		return nil, err
	}
	hop := int(trailerSpeechHop * 16000)
	var levels []float64
	for i := 0; i+hop <= len(out)/4; i += hop {
		var sum float64
		for j := i; j < i+hop; j++ {
			v := float64(math.Float32frombits(binary.LittleEndian.Uint32(out[j*4:])))
			sum += v * v
		}
		levels = append(levels, 10*math.Log10(sum/float64(hop)+1e-12))
	}
	if len(levels) == 0 {
		return nil, fmt.Errorf("no audio to analyze")
	}
	return trailerSpeechGaps(levels), nil
}

// trailerScoreWindows returns the dialogue-free runs (shot-level fallback when the audio cannot be analyzed) (consecutive shots without spoken lines) long enough to swell.
func trailerScoreWindows(shots []dramatizeShotResult) []trailerScoreWindow {
	var windows []trailerScoreWindow
	open := -1
	flush := func(end float64) {
		if open >= 0 && end-shots[open].Start >= trailerScoreMinSwell {
			windows = append(windows, trailerScoreWindow{Start: shots[open].Start, End: end})
		}
		open = -1
	}
	for i, shot := range shots {
		if strings.TrimSpace(shot.Shot.DialogueTranscript) != "" {
			flush(shot.Start)
			continue
		}
		if open < 0 {
			open = i
		}
		if i == len(shots)-1 {
			flush(shot.Start + shot.Duration)
		}
	}
	return windows
}

// trailerScoreVolumeExpr is an ffmpeg volume expression (eval=frame): base level plus a trapezoid per swell window.
func trailerScoreVolumeExpr(windows []trailerScoreWindow) string {
	expr := fmt.Sprintf("%.2f", trailerScoreBase)
	for _, w := range windows {
		expr += fmt.Sprintf("+%.2f*clip(min((t-%.3f)/%.2f,(%.3f-t)/%.2f),0,1)", trailerScorePeak-trailerScoreBase, w.Start, trailerScoreRampUp, w.End, trailerScoreRampDown)
	}
	return expr
}
