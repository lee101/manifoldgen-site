// Package lofiloop renders seamless looping "lofi environment" videos: a
// generated cover still is given periodic parallax motion, an audio
// visualizer is composited over it, and the song is loop-crossfaded onto its
// own head so the muxed file wraps without a click.
//
// The look of every visualizer and preset lives in spec.json, which is also
// served to clients at GET /api/lofi-loop/spec, so the Go renderer, the web
// tool, and lowfi-cli all describe the same product.
package lofiloop

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

//go:embed spec.json
var specJSON []byte

// Spec is the canonical, client-visible description of the renderer's look.
type Spec struct {
	Version     int          `json:"version"`
	Description string       `json:"description"`
	Defaults    Defaults     `json:"defaults"`
	Palettes    []Palette    `json:"palettes"`
	Visualizers []Visualizer `json:"visualizers"`
	Presets     []Preset     `json:"presets"`
}

// Defaults are the renderer's fallbacks and the shared art-direction strings.
type Defaults struct {
	Size         string  `json:"size"`
	FPS          int     `json:"fps"`
	SeamSeconds  float64 `json:"seam_seconds"`
	VizAlpha     float64 `json:"viz_alpha"`
	CRF          int     `json:"crf"`
	Grain        float64 `json:"grain"`
	AudioBitrate string  `json:"audio_bitrate"`
	Style        string  `json:"style"`
	Negative     string  `json:"negative"`
}

// Visualizer is one audio-reactive overlay. Graph is an ffmpeg filter chain
// fragment that consumes [in] and produces a full-frame RGBA [out].
type Visualizer struct {
	ID         string  `json:"id"`
	Label      string  `json:"label"`
	Desc       string  `json:"desc"`
	HeightFrac float64 `json:"height_frac"`
	Op         string  `json:"op"`
	Default    bool    `json:"default,omitempty"`
	Graph      string  `json:"graph"`
}

// Preset is a complete look: art grade, motion, and default visualizer.
type Preset struct {
	ID         string `json:"id"`
	Label      string `json:"label"`
	Desc       string `json:"desc"`
	Palette    string `json:"palette"`
	Visualizer string `json:"visualizer"`
	Motion     string `json:"motion"`
	Default    bool   `json:"default,omitempty"`
}

// Palette colours the visualizer and grades the cover art.
type Palette struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Colors string `json:"colors"`
	Tint   string `json:"tint"`
}

// VisualizerNone is the sentinel id for a cover-only loop.
const VisualizerNone = "none"

var loadedSpec = mustLoadSpec()

func mustLoadSpec() *Spec {
	spec, err := ParseSpec(specJSON)
	if err != nil {
		panic(fmt.Sprintf("lofiloop: embedded spec is invalid: %v", err))
	}
	return spec
}

// DefaultSpec returns the canonical spec. Callers must treat it as read-only.
func DefaultSpec() *Spec { return loadedSpec }

// ParseSpec decodes and validates a spec document.
func ParseSpec(raw []byte) (*Spec, error) {
	var spec Spec
	if err := json.Unmarshal(raw, &spec); err != nil {
		return nil, fmt.Errorf("decode spec: %w", err)
	}
	if err := spec.Validate(); err != nil {
		return nil, err
	}
	return &spec, nil
}

// Validate rejects a spec the renderer cannot execute.
func (s *Spec) Validate() error {
	if s == nil || s.Version <= 0 {
		return fmt.Errorf("spec version is required")
	}
	if _, _, err := ParseSize(s.Defaults.Size); err != nil {
		return fmt.Errorf("default size: %w", err)
	}
	if s.Defaults.FPS <= 0 || s.Defaults.FPS > 120 {
		return fmt.Errorf("default fps %d is out of range", s.Defaults.FPS)
	}
	if s.Defaults.VizAlpha <= 0 || s.Defaults.VizAlpha > 1 {
		return fmt.Errorf("default viz_alpha %.2f is out of range", s.Defaults.VizAlpha)
	}
	if len(s.Visualizers) == 0 || len(s.Presets) == 0 || len(s.Palettes) == 0 {
		return fmt.Errorf("spec needs at least one visualizer, preset, and palette")
	}
	known := map[string]bool{VisualizerNone: true}
	for _, v := range s.Visualizers {
		if v.ID == "" || v.Graph == "" {
			return fmt.Errorf("visualizer with id %q has no graph", v.ID)
		}
		if known[v.ID] {
			return fmt.Errorf("duplicate visualizer id %q", v.ID)
		}
		if v.HeightFrac <= 0 || v.HeightFrac > 1 {
			return fmt.Errorf("visualizer %q height_frac %.2f is out of range", v.ID, v.HeightFrac)
		}
		switch v.Op {
		case "screen", "addition", "softlight", "multiply", "overlay", "lighten":
		default:
			return fmt.Errorf("visualizer %q has unsupported blend mode %q", v.ID, v.Op)
		}
		for _, placeholder := range []string{"{{in}}", "{{out}}"} {
			if !strings.Contains(v.Graph, placeholder) {
				return fmt.Errorf("visualizer %q graph is missing %s", v.ID, placeholder)
			}
		}
		if !strings.Contains(v.Graph, "{{vizh}}") && !strings.Contains(v.Graph, "{{s}}") && !strings.Contains(v.Graph, "{{w}}") {
			return fmt.Errorf("visualizer %q graph needs {{vizh}}, {{s}}, or {{w}} to size its overlay", v.ID)
		}
		known[v.ID] = true
	}
	palettes := map[string]bool{}
	for _, p := range s.Palettes {
		if p.ID == "" || p.Colors == "" || p.Tint == "" {
			return fmt.Errorf("palette %q needs id, colors, and tint", p.ID)
		}
		if palettes[p.ID] {
			return fmt.Errorf("duplicate palette id %q", p.ID)
		}
		palettes[p.ID] = true
	}
	presets := map[string]bool{}
	for _, p := range s.Presets {
		if p.ID == "" {
			return fmt.Errorf("preset id is required")
		}
		if presets[p.ID] {
			return fmt.Errorf("duplicate preset id %q", p.ID)
		}
		if !known[p.Visualizer] {
			return fmt.Errorf("preset %q references unknown visualizer %q", p.ID, p.Visualizer)
		}
		if !palettes[p.Palette] {
			return fmt.Errorf("preset %q references unknown palette %q", p.ID, p.Palette)
		}
		if !IsMotion(p.Motion) {
			return fmt.Errorf("preset %q references unknown motion %q", p.ID, p.Motion)
		}
		presets[p.ID] = true
	}
	return nil
}

// Visualizer resolves a visualizer id. The empty id resolves to the default.
func (s *Spec) Visualizer(id string) (Visualizer, error) {
	id = strings.TrimSpace(id)
	if id == VisualizerNone {
		return Visualizer{ID: VisualizerNone}, nil
	}
	if id == "" {
		for _, v := range s.Visualizers {
			if v.Default {
				return v, nil
			}
		}
		return s.Visualizers[0], nil
	}
	for _, v := range s.Visualizers {
		if v.ID == id {
			return v, nil
		}
	}
	return Visualizer{}, fmt.Errorf("unknown visualizer %q", id)
}

// Preset resolves a preset id. The empty id resolves to the default.
func (s *Spec) Preset(id string) (Preset, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		for _, p := range s.Presets {
			if p.Default {
				return p, nil
			}
		}
		return s.Presets[0], nil
	}
	for _, p := range s.Presets {
		if p.ID == id {
			return p, nil
		}
	}
	return Preset{}, fmt.Errorf("unknown preset %q", id)
}

// Palette resolves a palette id. The empty id resolves to the first palette.
func (s *Spec) Palette(id string) (Palette, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return s.Palettes[0], nil
	}
	for _, p := range s.Palettes {
		if p.ID == id {
			return p, nil
		}
	}
	return Palette{}, fmt.Errorf("unknown palette %q", id)
}

// ParseSize reads a WxH size and enforces the 64-pixel grid the image backends
// require, plus even dimensions for yuv420p encoding.
func ParseSize(size string) (int, int, error) {
	parts := strings.SplitN(strings.ToLower(strings.TrimSpace(size)), "x", 2)
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("size %q must be WxH", size)
	}
	width, err := strconv.Atoi(strings.TrimSpace(parts[0]))
	if err != nil {
		return 0, 0, fmt.Errorf("size %q width is not a number", size)
	}
	height, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return 0, 0, fmt.Errorf("size %q height is not a number", size)
	}
	if width < 256 || height < 256 || width > 4096 || height > 4096 {
		return 0, 0, fmt.Errorf("size %q is outside 256..4096", size)
	}
	if width%64 != 0 || height%64 != 0 {
		return 0, 0, fmt.Errorf("size %q must be a multiple of 64 on both edges", size)
	}
	return width, height, nil
}
