package main

// ffmpeg/ffprobe primitives for the video dramatizer. Everything the agent
// assembles goes through these: probing the source, pulling keyframes for the
// vision pass, cutting source segments on beat boundaries, normalising every
// clip to one portrait format, and concatenating the result.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

const (
	// TikTok-style portrait canvas. Every shot is normalised to this so the
	// concat demuxer can stream-copy and the studio timeline stays uniform.
	dramatizeCanvasWidth  = 1080
	dramatizeCanvasHeight = 1920
	dramatizeFPS          = 30
	dramatizeMaxInputSize = 512 << 20
)

type dramatizeProbe struct {
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	Duration float64 `json:"duration"`
	FPS      float64 `json:"fps"`
	HasAudio bool    `json:"has_audio"`
}

// probeVideoFile reads dimensions, duration, frame rate and audio presence.
func probeVideoFile(ctx context.Context, path string) (dramatizeProbe, error) {
	var out dramatizeProbe
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-show_entries", "stream=index,codec_type,width,height,avg_frame_rate:format=duration",
		"-of", "json", path,
	)
	blob, err := cmd.Output()
	if err != nil {
		return out, fmt.Errorf("ffprobe %s: %w", filepath.Base(path), err)
	}
	var parsed struct {
		Streams []struct {
			CodecType    string `json:"codec_type"`
			Width        int    `json:"width"`
			Height       int    `json:"height"`
			AvgFrameRate string `json:"avg_frame_rate"`
		} `json:"streams"`
		Format struct {
			Duration string `json:"duration"`
		} `json:"format"`
	}
	if err := json.Unmarshal(blob, &parsed); err != nil {
		return out, fmt.Errorf("parse ffprobe output: %w", err)
	}
	for _, s := range parsed.Streams {
		switch s.CodecType {
		case "video":
			if out.Width == 0 {
				out.Width, out.Height = s.Width, s.Height
				out.FPS = parseFrameRate(s.AvgFrameRate)
			}
		case "audio":
			out.HasAudio = true
		}
	}
	out.Duration = parseFloat(strings.TrimSpace(parsed.Format.Duration))
	if out.Width <= 0 || out.Height <= 0 {
		return out, fmt.Errorf("%s has no video stream", filepath.Base(path))
	}
	return out, nil
}

// parseFrameRate turns ffprobe's "30/1" rational into a float.
func parseFrameRate(value string) float64 {
	parts := strings.SplitN(strings.TrimSpace(value), "/", 2)
	if len(parts) != 2 {
		return parseFloat(value)
	}
	den := parseFloat(parts[1])
	if den == 0 {
		return 0
	}
	return parseFloat(parts[0]) / den
}

// extractKeyframes writes one JPEG per requested timestamp and returns the
// paths in the same order. Frames feed the vision planning pass and act as
// restyle sources for gpt-image edits.
func extractKeyframes(ctx context.Context, source string, times []float64, dir string, maxWidth int) ([]string, error) {
	if maxWidth <= 0 {
		maxWidth = 512
	}
	paths := make([]string, 0, len(times))
	for i, t := range times {
		if t < 0 {
			t = 0
		}
		out := filepath.Join(dir, fmt.Sprintf("frame_%02d.jpg", i))
		cmd := exec.CommandContext(ctx, "ffmpeg",
			"-y", "-v", "error",
			// Seeking before -i is the fast path and is accurate enough for stills.
			"-ss", fmt.Sprintf("%.3f", t),
			"-i", source,
			"-frames:v", "1",
			"-vf", fmt.Sprintf("scale='min(%d,iw)':-2", maxWidth),
			"-q:v", "3",
			out,
		)
		if combined, err := cmd.CombinedOutput(); err != nil {
			return nil, fmt.Errorf("extract frame at %.2fs: %w: %s", t, err, tailOutput(combined))
		}
		paths = append(paths, out)
	}
	return paths, nil
}

// portraitFilter scales-to-cover then centre-crops to the portrait canvas,
// which is what turns landscape or square generated footage into TikTok format
// without letterboxing.
func portraitFilter(width, height, fps int) string {
	return fmt.Sprintf(
		"fps=%d,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1",
		fps, width, height, width, height,
	)
}

// renderSegment normalises any clip (source cut or generated footage) into one
// uniform encode so segments can be concatenated without re-encoding again.
// A silent stereo track is synthesised when the input has none, otherwise the
// concat demuxer drops audio for the whole timeline.
func renderSegment(ctx context.Context, source string, start, duration float64, hasAudio bool, dest string) error {
	return renderSegmentCanvas(ctx, source, start, duration, hasAudio, dramatizeCanvasWidth, dramatizeCanvasHeight, dest)
}

// renderSegmentCanvas is the format-preserving variant used by remake mode.
// Dramatize mode remains portrait, while remakes inherit their source canvas.
func renderSegmentCanvas(ctx context.Context, source string, start, duration float64, hasAudio bool, width, height int, dest string) error {
	args := []string{"-y", "-v", "error"}
	if start > 0 {
		args = append(args, "-ss", fmt.Sprintf("%.3f", start))
	}
	args = append(args, "-i", source)
	if !hasAudio {
		args = append(args, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100")
	}
	if duration > 0 {
		args = append(args, "-t", fmt.Sprintf("%.3f", duration))
	}
	args = append(args,
		"-map", "0:v:0",
		"-map", map[bool]string{true: "0:a:0", false: "1:a:0"}[hasAudio],
		"-vf", portraitFilter(width, height, dramatizeFPS),
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
		// Uniform GOP keeps cuts landing exactly where the plan asked.
		"-g", fmt.Sprintf("%d", dramatizeFPS),
		"-shortest",
		"-movflags", "+faststart",
		dest,
	)
	if combined, err := exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("render segment %s: %w: %s", filepath.Base(dest), err, tailOutput(combined))
	}
	return nil
}

// replaceAudioTrack copies the rendered picture and remuxes the untouched
// source soundtrack. Re-encoding only audio avoids timestamp/container
// incompatibilities while keeping the original mix and exact source length.
func replaceAudioTrack(ctx context.Context, videoPath, sourcePath, dest string, duration float64) error {
	copyDest := dest + ".audio-copy.mp4"
	copyArgs := []string{"-y", "-v", "error", "-i", videoPath, "-i", sourcePath,
		"-map", "0:v:0", "-map", "1:a:0?", "-c:v", "copy", "-c:a", "copy"}
	if duration > 0 {
		copyArgs = append(copyArgs, "-t", fmt.Sprintf("%.6f", duration))
	}
	copyArgs = append(copyArgs, "-movflags", "+faststart", copyDest)
	if _, err := exec.CommandContext(ctx, "ffmpeg", copyArgs...).CombinedOutput(); err == nil {
		if err := os.Rename(copyDest, dest); err == nil {
			return nil
		}
	}
	_ = os.Remove(copyDest)

	args := []string{"-y", "-v", "error", "-i", videoPath, "-i", sourcePath,
		"-map", "0:v:0", "-map", "1:a:0?", "-c:v", "copy", "-c:a", "aac",
		"-b:a", "192k", "-ar", "48000", "-ac", "2"}
	if duration > 0 {
		args = append(args, "-t", fmt.Sprintf("%.6f", duration))
	}
	args = append(args, "-movflags", "+faststart", dest)
	if combined, err := exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("replace soundtrack: %w: %s", err, tailOutput(combined))
	}
	return nil
}

// runFFmpeg runs ffmpeg and surfaces the tail of its output on failure, which
// is where ffmpeg puts the actual reason.
func runFFmpeg(ctx context.Context, args ...string) error {
	combined, err := exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("ffmpeg: %w: %s", err, tailOutput(combined))
	}
	return nil
}

// concatSegments joins pre-normalised segments with the concat demuxer.
func concatSegments(ctx context.Context, segments []string, dest string) error {
	if len(segments) == 0 {
		return fmt.Errorf("nothing to concatenate")
	}
	listing := filepath.Join(filepath.Dir(dest), "concat.txt")
	var buf bytes.Buffer
	for _, s := range segments {
		abs, err := filepath.Abs(s)
		if err != nil {
			return err
		}
		// Single quotes are escaped the way the concat demuxer expects.
		fmt.Fprintf(&buf, "file '%s'\n", strings.ReplaceAll(abs, "'", `'\''`))
	}
	if err := os.WriteFile(listing, buf.Bytes(), 0o644); err != nil {
		return err
	}
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-y", "-v", "error",
		"-f", "concat", "-safe", "0", "-i", listing,
		"-c", "copy",
		"-movflags", "+faststart",
		dest,
	)
	if combined, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("concat segments: %w: %s", err, tailOutput(combined))
	}
	return nil
}

// downloadToFile streams a remote asset to disk with a hard size ceiling.
func downloadToFile(ctx context.Context, rawURL, dest string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return err
	}
	resp, err := backendClient.Do(req)
	if err != nil {
		return fmt.Errorf("fetch %s: %w", rawURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("fetch %s returned %d: %s", rawURL, resp.StatusCode, tailOutput(body))
	}
	file, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer file.Close()
	written, err := io.Copy(file, io.LimitReader(resp.Body, dramatizeMaxInputSize+1))
	if err != nil {
		return err
	}
	if written > dramatizeMaxInputSize {
		return fmt.Errorf("%s exceeds the %d MiB input limit", rawURL, dramatizeMaxInputSize>>20)
	}
	if written == 0 {
		return fmt.Errorf("%s returned an empty body", rawURL)
	}
	return nil
}

// sampleTimes spreads count timestamps across duration, avoiding the very first
// and last frames where encoders often park black or duplicated frames.
func sampleTimes(duration float64, count int) []float64 {
	if count <= 0 || duration <= 0 {
		return nil
	}
	if count == 1 {
		return []float64{duration / 2}
	}
	inset := math.Min(0.25, duration*0.02)
	usable := duration - 2*inset
	if usable <= 0 {
		usable = duration
		inset = 0
	}
	out := make([]float64, count)
	for i := 0; i < count; i++ {
		out[i] = inset + usable*float64(i)/float64(count-1)
	}
	return out
}

// planSourceCuts turns requested [start,end) windows into cuts that land on the
// nearest detected beat or onset, so returning to live footage feels musical
// rather than arbitrary. Windows are clamped to the source and de-overlapped.
func planSourceCuts(windows [][2]float64, analysis *AudioAnalysis, duration, minLength float64) [][2]float64 {
	if minLength <= 0 {
		minLength = 0.4
	}
	out := make([][2]float64, 0, len(windows))
	for _, w := range windows {
		start, end := w[0], w[1]
		if analysis != nil {
			// Snap within half a shot so a cut never drifts into the next beat.
			tolerance := math.Max(0.15, minLength/2)
			start = analysis.SnapToBeat(start, tolerance)
			end = analysis.SnapToBeat(end, tolerance)
		}
		start = math.Max(0, math.Min(start, duration))
		end = math.Max(0, math.Min(end, duration))
		if end-start < minLength {
			end = math.Min(duration, start+minLength)
		}
		if end-start < minLength {
			continue
		}
		out = append(out, [2]float64{start, end})
	}
	sort.Slice(out, func(i, j int) bool { return out[i][0] < out[j][0] })
	return out
}
