package lofiloop

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

// vizWarmupSeconds is how much of the loop's tail is fed to the visualizer
// before the loop starts, so its analysis window is full on frame zero.
const vizWarmupSeconds = 1.0

// graphRequest is everything the filtergraph needs.
type graphRequest struct {
	Plan    *Plan
	Motion  string
	Viz     Visualizer
	Palette Palette
	Alpha   float64
	Grain   float64
	Seed    int64
}

// FilterComplex builds the single filtergraph that renders one looped video.
//
// Layout: [0:v] is the still, [1:a] is the song. The song is trimmed to the
// loop window and its tail is crossfaded onto its head, so wrapping the file
// is continuous; the visualizer reads that same looped signal, so it wraps with
// the picture.
func FilterComplex(req graphRequest) (string, error) {
	if req.Plan == nil {
		return "", fmt.Errorf("render plan is required")
	}
	plan := req.Plan

	if req.Alpha <= 0 {
		req.Alpha = DefaultSpec().Defaults.VizAlpha
	}
	palette := req.Palette
	if palette.Tint == "" {
		palette = DefaultSpec().Palettes[0]
	}

	chain, err := motionFilter(req.Motion, motionParams{
		Width: plan.Width, Height: plan.Height, FPS: plan.FPS,
		Frames: plan.Frames, Span: plan.Frames - 1, Cycles: plan.Cycles,
	})
	if err != nil {
		return "", err
	}
	bg := chain
	if req.Grain > 0 {
		seed := req.Seed
		if seed == 0 {
			seed = 4211
		}
		bg = fmt.Sprintf("%s,noise=alls=%d:allf=p:all_seed=%d", bg, grainAmount(req.Grain), seed)
	}
	bg = bg + ",setsar=1"

	var b strings.Builder
	fmt.Fprintf(&b, "[0:v]%s[bg];", bg)

	from := plan.LoopFrom
	to := from + plan.Seconds
	if plan.Source > 0 && to > plan.Source {
		to = plan.Source
	}
	trim := fmt.Sprintf("atrim=start=%.3f:end=%.3f,asetpts=N/SR/TB", from, to)

	switch {
	case plan.Seam > 0:
		seam := plan.Seam
		fmt.Fprintf(&b, "[1:a]%s,asplit=3[aout][atail][ahead];", trim)
		fmt.Fprintf(&b, "[ahead]atrim=0:%.3f,asetpts=N/SR/TB,afade=t=out:st=0:d=%.3f[ah];", seam, seam)
		fmt.Fprintf(&b, "[atail]atrim=start=%.3f,asetpts=N/SR/TB,afade=t=in:st=0:d=%.3f[at];", math.Max(plan.Seconds-seam, 0), seam)
		b.WriteString("[ah][at]amix=inputs=2:duration=longest:normalize=0[sx];")
		fmt.Fprintf(&b, "[aout]atrim=0:%.3f,asetpts=N/SR/TB[bd];", math.Max(plan.Seconds-seam, 0))
		b.WriteString("[bd][sx]concat=n=2:v=0:a=1[aloop];")
	default:
		fmt.Fprintf(&b, "[1:a]%s[aloop];", trim)
	}

	hasViz := req.Viz.ID != "" && req.Viz.ID != VisualizerNone
	if !hasViz {
		fmt.Fprintf(&b, "[aloop]apad=whole_dur=%.3f[a_mix];", plan.Seconds)
		b.WriteString("[bg]null[vout]")
		return b.String(), nil
	}

	vizHeight := int(math.Round(float64(plan.Height) * req.Viz.HeightFrac))
	if vizHeight < 16 {
		vizHeight = 16
	}
	if vizHeight%2 != 0 {
		vizHeight++
	}
	if vizHeight > plan.Height {
		vizHeight = plan.Height
	}
	square := plan.Height
	if req.Viz.HeightFrac < 1 {
		square = vizHeight
	}
	if square%2 != 0 {
		square++
	}

	// The visualizer needs past audio to fill its analysis window, so it is fed
	// the loop's own tail first: frame zero then sees a full window instead of
	// the silent warm-up ramp, and the seam closes with the audio crossfade.
	warmup := vizWarmupSeconds
	if warmup > plan.Seconds/4 {
		warmup = plan.Seconds / 4
	}
	fmt.Fprintf(&b, "[aloop]apad=whole_dur=%.3f,asplit=2[a_mix][awrap];", plan.Seconds+1)
	b.WriteString("[awrap]asplit=2[aw0][aw1];")
	fmt.Fprintf(&b, "[aw0]atrim=start=%.3f,asetpts=N/SR/TB[wt];", math.Max(plan.Seconds-warmup, 0))
	b.WriteString("[aw1]asetpts=N/SR/TB[ww];")
	b.WriteString("[wt][ww]concat=n=2:v=0:a=1[afed];")
	fmt.Fprintf(&b, "[afed]apad=whole_dur=%.3f[a_viz];", warmup+plan.Seconds+1)
	b.WriteString(fill(req.Viz.Graph, map[string]string{
		"in":     "a_viz",
		"out":    "viz_raw",
		"w":      strconv.Itoa(plan.Width),
		"h":      strconv.Itoa(plan.Height),
		"vizh":   strconv.Itoa(vizHeight),
		"s":      strconv.Itoa(square),
		"rate":   strconv.Itoa(plan.FPS),
		"alpha":  trimFloat(req.Alpha, 3),
		"colors": palette.Colors,
		"tint":   palette.Tint,
	}))
	// Both sides are converted to RGB first: blend applies its mode to every
	// plane, so mixing in YUV would screen the chroma planes too and wash the
	// picture magenta.
	fmt.Fprintf(&b, ";[viz_raw]trim=start=%.3f:end=%.3f,setpts=PTS-STARTPTS,format=rgb24[viz];",
		warmup, warmup+plan.Seconds)
	b.WriteString("[bg]format=rgb24[bg_rgb];")
	// blend works on planar frames and hands back a planar RGB frame, which
	// ffmpeg 4.4's automatic planar-RGB conversion tinted magenta; forcing
	// packed rgb24 here routes it through the same conversion the still-only
	// path already uses.
	fmt.Fprintf(&b, "[bg_rgb][viz]blend=all_mode=%s:all_opacity=%s:shortest=0[vblend];",
		req.Viz.Op, trimFloat(req.Alpha, 3))
	b.WriteString("[vblend]format=rgb24[vout]")
	return b.String(), nil
}

func grainAmount(grain float64) int {
	amount := int(math.Round(grain * 20))
	if amount < 1 {
		return 1
	}
	if amount > 64 {
		return 64
	}
	return amount
}

func trimFloat(value float64, digits int) string {
	return strconv.FormatFloat(value, 'f', digits, 64)
}

// EncodeArgs is the ffmpeg argument vector for a single loop render.
type EncodeArgs struct {
	CoverPath    string
	AudioPath    string
	OutputPath   string
	Plan         *Plan
	Filter       string
	CRF          int
	AudioBitrate string
	Preset       string
}

// EncodeArgs builds the argv for one render.
func (a EncodeArgs) Args() []string {
	plan := a.Plan
	crf := a.CRF
	if crf < 0 || crf > 51 {
		crf = DefaultSpec().Defaults.CRF
	}
	bitrate := a.AudioBitrate
	if bitrate == "" {
		bitrate = DefaultSpec().Defaults.AudioBitrate
	}
	preset := a.Preset
	if preset == "" {
		preset = "medium"
	}
	return []string{
		"-y", "-hide_banner", "-loglevel", "error",
		"-loop", "1", "-framerate", strconv.Itoa(plan.FPS), "-i", a.CoverPath,
		"-i", a.AudioPath,
		"-filter_complex", a.Filter,
		"-map", "[vout]", "-map", "[a_mix]",
		"-frames:v", strconv.Itoa(plan.Frames),
		"-c:v", "libx264", "-preset", preset, "-crf", strconv.Itoa(crf),
		"-pix_fmt", "yuv420p", "-r", strconv.Itoa(plan.FPS), "-g", strconv.Itoa(plan.FPS * 2),
		"-c:a", "aac", "-b:a", bitrate,
		"-movflags", "+faststart",
		a.OutputPath,
	}
}

// RunFFmpeg executes ffmpeg, returning its stderr when it fails.
func RunFFmpeg(ctx context.Context, args ...string) error {
	if _, err := exec.LookPath(ffmpegBinary()); err != nil {
		return fmt.Errorf("ffmpeg is not available")
	}
	cmd := exec.CommandContext(ctx, ffmpegBinary(), args...)
	var diagnostics bytes.Buffer
	cmd.Stderr = &diagnostics
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("ffmpeg: %w: %s", err, tailText(diagnostics.Bytes(), 1200))
	}
	return nil
}

// ProbeDurationSeconds reads a media file's duration with ffprobe.
// Binary overrides let a host pin a known-good build (FFMPEG_BIN/FFPROBE_BIN)
// when the ambient PATH resolves to a broken one.
func ffmpegBinary() string { return binary("FFMPEG_BIN", "ffmpeg") }

func ffprobeBinary() string { return binary("FFPROBE_BIN", "ffprobe") }

func binary(envKey, name string) string {
	if override := strings.TrimSpace(os.Getenv(envKey)); override != "" {
		return override
	}
	return name
}

func ProbeDurationSeconds(ctx context.Context, path string) (float64, error) {
	if _, err := exec.LookPath(ffprobeBinary()); err != nil {
		return 0, fmt.Errorf("ffprobe is not available")
	}
	out, err := exec.CommandContext(ctx, ffprobeBinary(), "-v", "error",
		"-show_entries", "format=duration", "-of", "json", path).Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe %s: %w", path, err)
	}
	var payload struct {
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &payload); err != nil {
		return 0, fmt.Errorf("ffprobe %s: %w", path, err)
	}
	seconds, err := strconv.ParseFloat(strings.TrimSpace(payload.Format.Duration), 64)
	if err != nil || seconds <= 0 {
		return 0, fmt.Errorf("ffprobe %s returned no usable duration", path)
	}
	return seconds, nil
}

// ProbeFrameCount counts decoded video frames.
func ProbeFrameCount(ctx context.Context, path string) (int, error) {
	out, err := exec.CommandContext(ctx, ffprobeBinary(), "-v", "error",
		"-select_streams", "v:0", "-count_frames",
		"-show_entries", "stream=nb_read_frames", "-of", "json", path).Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe frames %s: %w", path, err)
	}
	var payload struct {
		Streams []struct {
			Frames string `json:"nb_read_frames"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &payload); err != nil || len(payload.Streams) == 0 {
		return 0, fmt.Errorf("ffprobe frames %s returned nothing", path)
	}
	count, err := strconv.Atoi(strings.TrimSpace(payload.Streams[0].Frames))
	if err != nil {
		return 0, fmt.Errorf("ffprobe frames %s: %w", path, err)
	}
	return count, nil
}

// LoopVerification is the measured seam quality of a rendered loop.
type LoopVerification struct {
	Checked     bool    `json:"checked"`
	Frames      int     `json:"frames"`
	MeanAbsDiff float64 `json:"mean_abs_diff"`
	MaxAbsDiff  int     `json:"max_abs_diff"`
	Exact       bool    `json:"exact"`
}

// VerifyLoop decodes the first and last frame of a rendered loop and measures
// how closely the seam closes. Identical bytes mean the file wraps with no
// visible jump at all.
func VerifyLoop(ctx context.Context, path string, width, height int, frames int) (*LoopVerification, error) {
	if frames <= 1 {
		counted, err := ProbeFrameCount(ctx, path)
		if err != nil {
			return nil, err
		}
		frames = counted
	}
	first, err := decodeFrame(ctx, path, 0, width, height)
	if err != nil {
		return nil, err
	}
	last, err := decodeFrame(ctx, path, frames-1, width, height)
	if err != nil {
		return nil, err
	}
	if len(first) != len(last) || len(first) == 0 {
		return nil, fmt.Errorf("decoded frames differ in size")
	}
	var total, maxDiff int
	exact := true
	for i := range first {
		diff := int(first[i]) - int(last[i])
		if diff < 0 {
			diff = -diff
		}
		total += diff
		if diff > maxDiff {
			maxDiff = diff
		}
		if diff != 0 {
			exact = false
		}
	}
	return &LoopVerification{
		Checked:     true,
		Frames:      frames,
		MeanAbsDiff: math.Round(float64(total)/float64(len(first))*1000) / 1000,
		MaxAbsDiff:  maxDiff,
		Exact:       exact,
	}, nil
}

func decodeFrame(ctx context.Context, path string, index, width, height int) ([]byte, error) {
	filter := fmt.Sprintf("select=eq(n\\,%d)", index)
	out, err := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-i", path,
		"-vf", filter, "-frames:v", "1",
		"-f", "rawvideo", "-pix_fmt", "rgb24", "-").Output()
	if err != nil {
		return nil, fmt.Errorf("decode frame %d of %s: %w", index, path, err)
	}
	expected := width * height * 3
	if width > 0 && height > 0 && len(out) != expected {
		return nil, fmt.Errorf("frame %d of %s decoded to %d bytes, want %d", index, path, len(out), expected)
	}
	return out, nil
}

func tailText(value []byte, limit int) string {
	text := strings.TrimSpace(string(value))
	if len(text) <= limit {
		return text
	}
	return text[len(text)-limit:]
}
