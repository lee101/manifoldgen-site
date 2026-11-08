package lofiloop

import (
	"context"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type ClipRequest struct {
	Clip    string
	Audio   string
	Out     string
	Seconds float64
	Width   int
	Height  int
	FPS     int
	CRF     int
	FadeOut float64
}

type ClipResult struct {
	Path    string
	Seconds float64
	Repeats int
}

func TileClip(ctx context.Context, req ClipRequest) (*ClipResult, error) {
	if req.Clip == "" || req.Out == "" {
		return nil, fmt.Errorf("clip and out are required")
	}
	clipSeconds, err := ProbeDurationSeconds(ctx, req.Clip)
	if err != nil {
		return nil, err
	}
	total := req.Seconds
	if req.Audio != "" {
		audioSeconds, err := ProbeDurationSeconds(ctx, req.Audio)
		if err != nil {
			return nil, err
		}
		if total <= 0 || total > audioSeconds {
			total = audioSeconds
		}
	}
	if total <= 0 {
		return nil, fmt.Errorf("seconds or audio is required")
	}
	width, height, fps, crf := req.Width, req.Height, req.FPS, req.CRF
	if width <= 0 {
		width = 1280
	}
	if height <= 0 {
		height = 720
	}
	if fps <= 0 {
		fps = 24
	}
	if crf <= 0 {
		crf = 22
	}
	vf := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,fps=%d,format=yuv420p", width, height, width, height, fps)
	args := []string{"-y", "-hide_banner", "-loglevel", "error", "-stream_loop", "-1", "-i", req.Clip}
	if req.Audio != "" {
		args = append(args, "-i", req.Audio)
	}
	args = append(args, "-t", trimFloat(total, 3), "-map", "0:v:0")
	if req.Audio != "" {
		args = append(args, "-map", "1:a:0")
		af := "aresample=48000"
		if req.FadeOut > 0 && total > req.FadeOut {
			af += ",afade=t=out:st=" + trimFloat(total-req.FadeOut, 3) + ":d=" + trimFloat(req.FadeOut, 3)
		}
		args = append(args, "-af", af, "-c:a", "aac", "-b:a", "192k")
	} else {
		args = append(args, "-an")
	}
	args = append(args, "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", strconv.Itoa(crf),
		"-g", strconv.Itoa(fps*2), "-movflags", "+faststart", req.Out)
	if err := os.MkdirAll(filepath.Dir(req.Out), 0o755); err != nil {
		return nil, err
	}
	if err := RunFFmpeg(ctx, args...); err != nil {
		return nil, err
	}
	return &ClipResult{Path: req.Out, Seconds: total, Repeats: int(math.Ceil(total / clipSeconds))}, nil
}

func ConcatVideos(ctx context.Context, parts []string, out string) error {
	if len(parts) == 0 {
		return fmt.Errorf("no parts to concatenate")
	}
	dir, err := os.MkdirTemp("", "lowfi-concat-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	var list strings.Builder
	for _, part := range parts {
		abs, err := filepath.Abs(part)
		if err != nil {
			return err
		}
		list.WriteString("file '" + strings.ReplaceAll(abs, "'", `'\''`) + "'\n")
	}
	listPath := filepath.Join(dir, "list.txt")
	if err := os.WriteFile(listPath, []byte(list.String()), 0o600); err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return err
	}
	return RunFFmpeg(ctx, "-y", "-hide_banner", "-loglevel", "error", "-f", "concat", "-safe", "0",
		"-i", listPath, "-c", "copy", "-movflags", "+faststart", out)
}

func ChapterTimestamps(durations []float64, titles []string) []string {
	lines := make([]string, 0, len(durations))
	at := 0.0
	for i, d := range durations {
		title := fmt.Sprintf("Track %d", i+1)
		if i < len(titles) && titles[i] != "" {
			title = titles[i]
		}
		minutes := int(at) / 60
		lines = append(lines, fmt.Sprintf("%02d:%02d %s", minutes, int(at)%60, title))
		at += d
	}
	return lines
}
