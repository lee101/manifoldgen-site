package lofiloop

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Request is one cover-art looping video.
type Request struct {
	// ID names the outputs: <OutDir>/<ID>.mp4 and <OutDir>/<ID>.cover.png.
	ID string
	// AudioPath is the song to loop.
	AudioPath string
	// CoverPath skips generation when the still already exists.
	CoverPath string
	OutDir    string

	// Art direction.
	Prompt    string
	Character string
	Scene     string
	Style     string
	Negative  string

	// Look.
	Preset     string
	Visualizer string
	Palette    string
	Motion     string
	Size       string
	FPS        int

	// Loop geometry.
	LoopStart   float64
	LoopSeconds float64
	SeamSeconds float64 // negative means "use the spec default"

	// Encode.
	VizAlpha     float64
	Grain        float64
	CRF          int
	AudioBitrate string
	X264Preset   string

	Seed       int64
	StillSteps int

	// Cover backend.
	ZImageURL    string
	ZImageSecret string

	Spec   *Spec
	Verify bool
	// Timeout bounds the whole render. Defaults to 30 minutes.
	Timeout time.Duration
}

// Result describes a rendered loop.
type Result struct {
	ID          string            `json:"id"`
	Video       string            `json:"video"`
	Cover       string            `json:"cover"`
	Seconds     float64           `json:"seconds"`
	Frames      int               `json:"frames"`
	Width       int               `json:"width"`
	Height      int               `json:"height"`
	FPS         int               `json:"fps"`
	Cycle       int               `json:"cycle_frames"`
	Cycles      int               `json:"motion_cycles"`
	SeamSeconds float64           `json:"seam_seconds"`
	Visualizer  string            `json:"visualizer"`
	Preset      string            `json:"preset"`
	Palette     string            `json:"palette"`
	Motion      string            `json:"motion"`
	StillPrompt string            `json:"still_prompt"`
	StillModel  string            `json:"still_model"`
	Loop        *LoopVerification `json:"loop_verification,omitempty"`
}

// Render produces one seamless looping lofi video.
func Render(ctx context.Context, req Request) (*Result, error) {
	spec := req.Spec
	if spec == nil {
		spec = DefaultSpec()
	}
	if strings.TrimSpace(req.AudioPath) == "" {
		return nil, fmt.Errorf("audio path is required")
	}
	if _, err := os.Stat(req.AudioPath); err != nil {
		return nil, fmt.Errorf("audio %s: %w", req.AudioPath, err)
	}
	id := sanitizeID(req.ID)
	if id == "" {
		id = sanitizeID(strings.TrimSuffix(filepath.Base(req.AudioPath), filepath.Ext(req.AudioPath)))
	}
	if id == "" {
		return nil, fmt.Errorf("an output id is required")
	}
	outDir := req.OutDir
	if outDir == "" {
		outDir = "."
	}
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return nil, err
	}

	preset, err := spec.Preset(req.Preset)
	if err != nil {
		return nil, err
	}
	motionID := strings.TrimSpace(req.Motion)
	if motionID == "" {
		motionID = preset.Motion
	}
	if !IsMotion(motionID) {
		return nil, fmt.Errorf("unknown motion %q", motionID)
	}
	paletteID := strings.TrimSpace(req.Palette)
	if paletteID == "" {
		paletteID = preset.Palette
	}
	palette, err := spec.Palette(paletteID)
	if err != nil {
		return nil, err
	}
	vizID := strings.TrimSpace(req.Visualizer)
	if vizID == "" {
		vizID = preset.Visualizer
	}
	viz, err := spec.Visualizer(vizID)
	if err != nil {
		return nil, err
	}

	size := strings.TrimSpace(req.Size)
	if size == "" {
		size = spec.Defaults.Size
	}
	width, height, err := ParseSize(size)
	if err != nil {
		return nil, err
	}
	fps := req.FPS
	if fps <= 0 {
		fps = spec.Defaults.FPS
	}
	seam := spec.Defaults.SeamSeconds
	if req.SeamSeconds >= 0 {
		seam = req.SeamSeconds
	}
	alpha := req.VizAlpha
	if alpha <= 0 || alpha > 1 {
		alpha = spec.Defaults.VizAlpha
	}
	// Zero means "the spec's grain"; a negative value turns grain off.
	grain := req.Grain
	if grain == 0 {
		grain = spec.Defaults.Grain
	}
	if grain < 0 {
		grain = 0
	}

	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Minute
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	source, err := ProbeDurationSeconds(ctx, req.AudioPath)
	if err != nil {
		return nil, err
	}
	plan, err := BuildPlan(width, height, fps, source, req.LoopStart, req.LoopSeconds, seam)
	if err != nil {
		return nil, err
	}

	coverPath := req.CoverPath
	stillModel := "reused"
	style := strings.TrimSpace(req.Style)
	if style == "" {
		style = spec.Defaults.Style
	}
	negative := strings.TrimSpace(req.Negative)
	if negative == "" {
		negative = spec.Defaults.Negative
	}
	prompt := StillPrompt(style, req.Character, req.Scene, req.Prompt)
	if strings.TrimSpace(prompt) == "" {
		return nil, fmt.Errorf("a character, scene, or prompt is required to draw the cover")
	}
	if coverPath == "" {
		coverPath = filepath.Join(outDir, id+".cover.png")
		still, err := GenerateStill(ctx, StillRequest{
			Prompt:     prompt,
			Negative:   negative,
			Size:       size,
			Steps:      req.StillSteps,
			Seed:       req.Seed,
			BackendURL: req.ZImageURL,
			Secret:     req.ZImageSecret,
			OutputPath: coverPath,
		})
		if err != nil {
			return nil, err
		}
		stillModel = still.Model
	}

	// The vignette is baked once into a working art layer instead of running as
	// a per-frame filter: ffmpeg's vignette is not bit-reproducible across
	// frames, which would break the loop's first-frame/last-frame identity.
	artPath := filepath.Join(outDir, "."+id+".art.png")
	if err := bakeArt(ctx, coverPath, artPath, palette.Tint); err != nil {
		return nil, err
	}
	defer os.Remove(artPath)

	filter, err := FilterComplex(graphRequest{
		Plan: plan, Motion: motionID, Viz: viz, Palette: palette,
		Alpha: alpha, Grain: grain, Seed: req.Seed,
	})
	if err != nil {
		return nil, err
	}
	videoPath := filepath.Join(outDir, id+".mp4")
	if err := RunFFmpeg(ctx, EncodeArgs{
		CoverPath: artPath, AudioPath: req.AudioPath, OutputPath: videoPath,
		Plan: plan, Filter: filter, CRF: req.CRF, AudioBitrate: req.AudioBitrate,
		Preset: req.X264Preset,
	}.Args()...); err != nil {
		return nil, err
	}

	result := &Result{
		ID: id, Video: videoPath, Cover: coverPath,
		Seconds: plan.Seconds, Frames: plan.Frames,
		Width: width, Height: height, FPS: fps, Cycle: plan.Cycle, Cycles: plan.Cycles,
		SeamSeconds: plan.Seam, Visualizer: viz.ID, Preset: preset.ID,
		Palette: palette.ID, Motion: motionID,
		StillPrompt: prompt, StillModel: stillModel,
	}
	if req.Verify {
		verification, err := VerifyLoop(ctx, videoPath, width, height, plan.Frames)
		if err != nil {
			return nil, err
		}
		result.Loop = verification
	}
	return result, nil
}

// bakeArt writes the working art layer: the cover still with its soft vignette
// and palette grade applied once.
//
// Both steps run here rather than in the per-frame graph because ffmpeg's
// vignette and colour-channel filters are not bit-reproducible between frames,
// which would break the loop's first-frame/last-frame identity.
func bakeArt(ctx context.Context, coverPath, artPath, tint string) error {
	filter := "vignette=PI/5"
	if strings.TrimSpace(tint) != "" {
		filter += "," + tint
	}
	return RunFFmpeg(ctx, "-y", "-hide_banner", "-loglevel", "error",
		"-i", coverPath, "-vf", filter, "-frames:v", "1", artPath)
}

// MetadataPath is where Render's caller should write the JSON sidecar.
func MetadataPath(outDir, id string) string {
	return filepath.Join(outDir, sanitizeID(id)+".json")
}

// WriteMetadata writes the result sidecar next to the rendered files.
func WriteMetadata(result *Result, outDir string) (string, error) {
	if result == nil {
		return "", fmt.Errorf("no result to write")
	}
	path := MetadataPath(outDir, result.ID)
	payload, err := json.MarshalIndent(result, "", " ")
	if err != nil {
		return "", err
	}
	if err := os.WriteFile(path, append(payload, '\n'), 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func sanitizeID(id string) string {
	trimmed := strings.TrimSpace(id)
	var b strings.Builder
	for _, r := range trimmed {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == '-' || r == '_' || r == '.':
			b.WriteRune(r)
		case r == ' ':
			b.WriteRune('-')
		}
	}
	return strings.Trim(b.String(), "-.")
}
