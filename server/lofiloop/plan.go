package lofiloop

import (
	"fmt"
	"math"
	"strings"
)

// Plan is the frame-exact loop geometry. Everything downstream (motion cycle,
// audio seam, visualizer rate) derives from it, which is what makes the first
// and last frame of the render coincide.
type Plan struct {
	Width    int
	Height   int
	FPS      int
	Frames   int     // N, frames in the loop
	Seconds  float64 // L = N/FPS, the loop length
	Cycles   int     // k, motion cycles over the loop (span = N-1 frames)
	Cycle    int     // frames per motion cycle, span/k, for reporting
	Seam     float64 // seconds of loop seam crossfade
	LoopFrom float64 // seconds into the source track
	Source   float64 // source track duration in seconds
}

// MinLoopSeconds is the shortest loop the renderer will produce.
const MinLoopSeconds = 4.0

// MaxSeamSeconds bounds the loop crossfade a caller may ask for.
const MaxSeamSeconds = 15.0

// IsMotion reports whether a motion chain exists.
func IsMotion(id string) bool {
	_, ok := motionSpecs[strings.TrimSpace(id)]
	return ok
}

// BuildPlan derives the loop geometry for a source track.
//
// loopFrom selects the window start; loopSeconds selects its length (0 = the
// whole remaining track). The window is snapped to whole frames so the audio
// trim, the motion period, and the encode agree exactly.
func BuildPlan(width, height, fps int, source, loopFrom, loopSeconds, seam float64) (*Plan, error) {
	if fps <= 0 || fps > 120 {
		return nil, fmt.Errorf("fps %d is out of range", fps)
	}
	if source <= 0 || math.IsNaN(source) {
		return nil, fmt.Errorf("source audio duration is unknown")
	}
	if loopFrom < 0 {
		return nil, fmt.Errorf("loop start must not be negative")
	}
	if loopFrom >= source-1 {
		return nil, fmt.Errorf("loop start %.2fs is outside the %.2fs track", loopFrom, source)
	}
	length := loopSeconds
	if length <= 0 {
		length = source - loopFrom
	}
	if length > source-loopFrom+0.001 {
		return nil, fmt.Errorf("loop length %.2fs exceeds the %.2fs left after the loop start", length, source-loopFrom)
	}
	if length < MinLoopSeconds {
		return nil, fmt.Errorf("loop length %.2fs is shorter than the %.0fs minimum", length, float64(MinLoopSeconds))
	}

	frames := int(math.Round(length * float64(fps)))
	if frames < int(MinLoopSeconds*float64(fps)) {
		return nil, fmt.Errorf("loop length %.2fs rounds to %d frames, below the minimum", length, frames)
	}
	plan := &Plan{
		Width:    width,
		Height:   height,
		FPS:      fps,
		Frames:   frames,
		Seconds:  float64(frames) / float64(fps),
		LoopFrom: loopFrom,
		Source:   source,
	}
	span := frames - 1
	plan.Cycles = motionCycles(frames, motionCycleTarget(fps))
	if plan.Cycles > 1 {
		plan.Cycle = int(math.Round(float64(span) / float64(plan.Cycles)))
	} else {
		plan.Cycle = span
	}
	if seam < 0 {
		return nil, fmt.Errorf("seam duration must not be negative")
	}
	if maxSeam := plan.Seconds * 0.25; seam > maxSeam {
		seam = maxSeam
	}
	plan.Seam = math.Round(seam*1000) / 1000
	return plan, nil
}

// motionCycleTarget aims for a slow visible cycle without turning the parallax
// into a metronome: roughly half a minute of travel. Combined with the small
// amplitudes below, the frame breathes rather than slides.
func motionCycleTarget(fps int) int {
	return 32 * fps
}

// motionCycles returns how many whole motion cycles fit the loop, aiming for
// one cycle every target frames.
//
// The motion is written as sin(2*pi*cycles*n/span) with span = N-1, so any
// integer cycle count lands on a whole cycle at the final frame and reproduces
// frame zero exactly. The count - rather than a divisor of the span - is what
// keeps long tracks from collapsing into a three-frame jitter.
func motionCycles(frames, target int) int {
	span := frames - 1
	if span < 2 || target <= 0 {
		return 1
	}
	cycles := int(math.Round(float64(span) / float64(target)))
	if cycles < 1 {
		cycles = 1
	}
	if cycles > span/2 {
		cycles = span / 2
	}
	if cycles < 1 {
		cycles = 1
	}
	return cycles
}

type motionParams struct {
	Width  int
	Height int
	FPS    int
	Frames int
	Span   int
	Cycles int
}

// motionSpec describes one parallax look. Amplitude fractions are of the slack
// between the oversized still and the output frame; every term is periodic in
// the frame index with period motionParams.Cycle, so frame N-1 reproduces
// frame zero exactly.
//
// Only filters that are bit-reproducible frame to frame may be used here:
// ffmpeg's vignette, eq, colorbalance, curves, and colorchannelmixer all vary
// between frames on identical input, which would break the loop (the vignette
// and palette grade are baked into the still instead).
type motionSpec struct {
	panX         float64 // horizontal drift amplitude
	panY         float64 // vertical drift amplitude
	yHarmonics   int     // vertical drift cycles per motion cycle
	hueAmp       float64 // hue swing in degrees
	hueHarmonics int     // hue cycles per motion cycle
	hueOffset    float64 // constant hue rotation in degrees
	saturation   float64 // 0 keeps the input saturation
	breath       float64 // periodic push-in amplitude for the zoompan looks
}

var motionSpecs = map[string]motionSpec{
	"drift":       {panX: 0.105, panY: 0.040, yHarmonics: 2, hueAmp: 2.0, hueHarmonics: 1, saturation: 1.02},
	"breathe":     {breath: 0.015, hueAmp: 1.0, hueHarmonics: 1, saturation: 1.01},
	"rain-window": {panX: 0.075, panY: -0.085, yHarmonics: 1, hueAmp: 1.5, hueHarmonics: 1, hueOffset: -3, saturation: 0.95},
	"embers":      {panX: 0.085, panY: 0.030, yHarmonics: 2, hueAmp: 2.5, hueHarmonics: 2, hueOffset: 2, saturation: 1.04},
	"rooftop":     {panX: 0.030, panY: 0.100, yHarmonics: 2, hueAmp: 1.5, hueHarmonics: 1, hueOffset: 1, saturation: 1.03},
	"vigil":       {panX: 0.015, panY: 0.010, yHarmonics: 1, hueAmp: 1.0, hueHarmonics: 1},
	"static":      {},
}

// motionFilter builds the chain that turns the cover still into [bg].
func motionFilter(id string, p motionParams) (string, error) {
	spec, ok := motionSpecs[id]
	if !ok {
		return "", fmt.Errorf("unknown motion %q", id)
	}
	span := p.Span
	if span < 2 {
		span = 2
	}
	cycles := p.Cycles
	if cycles < 1 {
		cycles = 1
	}
	phase := fmt.Sprintf("2*PI*%d*n/%d", cycles, span)
	scale := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=increase:flags=lanczos",
		oversize(p.Width), oversize(p.Height))
	chain := scale
	switch {
	case spec.breath > 0:
		// One input frame drives the whole loop, so `on` counts loop frames.
		chain += fmt.Sprintf(""+
			",zoompan=z='%.3f+%.3f*(0.5-0.5*cos(2*PI*%d*on/%d))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=%d:s=%dx%d:fps=%d",
			1.02, spec.breath, cycles, span, p.Frames, p.Width, p.Height, p.FPS)
	case spec.panX == 0 && spec.panY == 0:
		chain += fmt.Sprintf(",crop=%d:%d:(in_w-out_w)/2:(in_h-out_h)/2", p.Width, p.Height)
	default:
		x := fmt.Sprintf("(in_w-out_w)/2")
		if spec.panX != 0 {
			x = fmt.Sprintf("(in_w-out_w)/2+(in_w-out_w)*%.3f*sin(%s)", spec.panX, phase)
		}
		y := fmt.Sprintf("(in_h-out_h)/2")
		if spec.panY != 0 {
			y = fmt.Sprintf("(in_h-out_h)/2+(in_h-out_h)*%.3f*sin(%d*(%s))",
				spec.panY, spec.yHarmonics, phase)
		}
		// floor() keeps fractional ties resolving the same way on the last
		// frame as on the first.
		chain += fmt.Sprintf(",crop=%d:%d:x='floor(%s)':y='floor(%s)'", p.Width, p.Height, x, y)
	}
	if spec.hueAmp != 0 || spec.hueOffset != 0 {
		hue := fmt.Sprintf("%.3f", spec.hueOffset)
		if spec.hueAmp != 0 {
			if spec.hueHarmonics <= 1 {
				hue += fmt.Sprintf("+%.3f*sin(%s)", spec.hueAmp, phase)
			} else {
				hue += fmt.Sprintf("+%.3f*(0.5-0.5*cos(%d*(%s)))", spec.hueAmp, spec.hueHarmonics, phase)
			}
		}
		chain += fmt.Sprintf(",hue=h='%s'", hue)
	}
	if spec.saturation > 0 {
		chain += fmt.Sprintf(":s=%.3f", spec.saturation)
	}
	return chain, nil
}

// MotionIDs lists the supported motion chains in display order.
func MotionIDs() []string {
	ids := make([]string, 0, len(motionSpecs))
	for _, id := range []string{"drift", "breathe", "rain-window", "embers", "rooftop", "vigil", "static"} {
		if _, ok := motionSpecs[id]; ok {
			ids = append(ids, id)
		}
	}
	return ids
}

func oversize(length int) int {
	return int(math.Ceil(float64(length) * 1.18))
}

// fill substitutes the renderer's placeholders in a spec template.
func fill(template string, values map[string]string) string {
	pairs := make([]string, 0, len(values)*2)
	for key, value := range values {
		pairs = append(pairs, "{{"+key+"}}", value)
	}
	return strings.NewReplacer(pairs...).Replace(template)
}
