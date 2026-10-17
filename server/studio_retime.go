package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/valyala/fasthttp"
)

const (
	studioRetimeMaxSpeed        = 8.0
	studioRetimeMinSpeed        = 0.1
	studioRetimeMaxSeconds      = 300.0
	studioRetimeHeavyMaxSeconds = 60.0
	studioRetimeSegmentSeconds  = 3.0
	studioRetimeMaxOutputBytes  = 1 << 30
	studioRetimeMaxUserJobs     = 3
)

type studioRetimeInput struct {
	URL       string  `json:"url"`
	Kind      string  `json:"kind"`
	Start     float64 `json:"start"`
	End       float64 `json:"end"`
	Speed     float64 `json:"speed"`
	Stabilize bool    `json:"stabilize"`
	Smooth    bool    `json:"smooth"`
}

type studioRetimeState struct {
	mu       sync.RWMutex
	UserID   string
	Status   string
	URL      string
	Duration float64
	Error    string
}

var (
	studioRetimeJobs    sync.Map
	studioRetimeWorkers = make(chan struct{}, 2)
)

func studioRetimeReverse(input studioRetimeInput) bool {
	return input.Speed < 0
}

func studioRetimeRate(input studioRetimeInput) float64 {
	return math.Abs(input.Speed)
}

func validateStudioRetimeInput(input studioRetimeInput) (studioRetimeInput, error) {
	input.URL = strings.TrimSpace(input.URL)
	parsed, err := url.Parse(input.URL)
	if err != nil || parsed.Scheme != "https" || !strings.EqualFold(parsed.Host, r2PublicHost) {
		return input, fmt.Errorf("media must be uploaded through Studio first")
	}
	if input.Kind != "video" && input.Kind != "audio" {
		return input, fmt.Errorf("kind must be video or audio")
	}
	if input.Speed == 0 {
		input.Speed = 1
	}
	rate := studioRetimeRate(input)
	if math.IsNaN(rate) || rate < studioRetimeMinSpeed || rate > studioRetimeMaxSpeed {
		return input, fmt.Errorf("speed must be between %.1fx and %.0fx (negative reverses)", studioRetimeMinSpeed, studioRetimeMaxSpeed)
	}
	if input.Start < 0 || input.End <= input.Start || math.IsNaN(input.End) {
		return input, fmt.Errorf("invalid trim range")
	}
	length := input.End - input.Start
	if length < 0.1 || length > studioRetimeMaxSeconds {
		return input, fmt.Errorf("clip must be between 0.1 and %.0f seconds", studioRetimeMaxSeconds)
	}
	if input.Kind == "audio" {
		input.Stabilize, input.Smooth = false, false
	}
	if (studioRetimeReverse(input) || input.Stabilize || input.Smooth) && input.Kind == "video" && length > studioRetimeHeavyMaxSeconds {
		return input, fmt.Errorf("reverse, stabilize and smooth slow motion are limited to %.0f second clips; split the clip first", studioRetimeHeavyMaxSeconds)
	}
	if input.Smooth && rate >= 1 {
		input.Smooth = false
	}
	if input.Smooth && length/rate > studioRetimeHeavyMaxSeconds {
		return input, fmt.Errorf("smooth slow motion is limited to %.0f seconds of output; trim the clip or use a faster speed", studioRetimeHeavyMaxSeconds)
	}
	if input.Speed == 1 && !input.Stabilize {
		return input, fmt.Errorf("nothing to apply")
	}
	return input, nil
}

func studioAtempoChain(rate float64) string {
	var parts []string
	for rate > 2.0+1e-9 {
		parts = append(parts, "atempo=2.0")
		rate /= 2.0
	}
	for rate < 0.5-1e-9 {
		parts = append(parts, "atempo=0.5")
		rate /= 0.5
	}
	parts = append(parts, "atempo="+strconv.FormatFloat(rate, 'f', 4, 64))
	return strings.Join(parts, ",")
}

func studioRetimeVideoFilter(input studioRetimeInput, reverse bool) string {
	var parts []string
	if reverse {
		parts = append(parts, "reverse")
	}
	rate := studioRetimeRate(input)
	if rate != 1 {
		parts = append(parts, "setpts=PTS/"+strconv.FormatFloat(rate, 'f', 4, 64))
	}
	if input.Smooth {
		parts = append(parts, "minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:vsbmc=1")
	}
	return strings.Join(parts, ",")
}

func studioRetimeAudioFilter(input studioRetimeInput, reverse bool) string {
	var parts []string
	if reverse {
		parts = append(parts, "areverse")
	}
	if rate := studioRetimeRate(input); rate != 1 {
		parts = append(parts, studioAtempoChain(rate))
	}
	return strings.Join(parts, ",")
}

func studioRetimeOutputExt(input studioRetimeInput) (string, string) {
	if input.Kind == "audio" {
		return "m4a", "audio/mp4"
	}
	return "mp4", "video/mp4"
}

func handleStudioRetime(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	if string(ctx.Method()) == http.MethodGet {
		value, ok := studioRetimeJobs.Load(string(ctx.QueryArgs().Peek("id")))
		if !ok || value.(*studioRetimeState).UserID != user.ID {
			jsonError(ctx, http.StatusNotFound, "retime job not found")
			return
		}
		state := value.(*studioRetimeState)
		state.mu.RLock()
		defer state.mu.RUnlock()
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{"status": state.Status, "url": state.URL, "duration": state.Duration, "error": state.Error})
		return
	}
	var input studioRetimeInput
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	input, err = validateStudioRetimeInput(input)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	active := 0
	studioRetimeJobs.Range(func(_, value any) bool {
		other := value.(*studioRetimeState)
		other.mu.RLock()
		if other.UserID == user.ID && (other.Status == "queued" || other.Status == "processing") {
			active++
		}
		other.mu.RUnlock()
		return true
	})
	if active >= studioRetimeMaxUserJobs {
		jsonError(ctx, http.StatusTooManyRequests, "too many retime jobs in progress; wait for one to finish")
		return
	}
	id := uuid.NewString()
	state := &studioRetimeState{UserID: user.ID, Status: "queued"}
	studioRetimeJobs.Store(id, state)
	time.AfterFunc(6*time.Hour, func() { studioRetimeJobs.Delete(id) })
	go runStudioRetime(user, id, input, state)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{"id": id, "status": "queued"})
}

func runStudioRetime(user *User, id string, input studioRetimeInput, state *studioRetimeState) {
	fail := func(message string) {
		state.mu.Lock()
		state.Status, state.Error = "failed", message
		state.mu.Unlock()
	}
	select {
	case studioRetimeWorkers <- struct{}{}:
		defer func() { <-studioRetimeWorkers }()
	case <-time.After(20 * time.Minute):
		fail("retime queue expired")
		return
	}
	state.mu.Lock()
	state.Status = "processing"
	state.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Minute)
	defer cancel()
	temporary, err := os.MkdirTemp("", "manifoldgen-studio-retime-*")
	if err != nil {
		fail("could not prepare workspace")
		return
	}
	defer os.RemoveAll(temporary)
	ext, contentType := studioRetimeOutputExt(input)
	output := filepath.Join(temporary, "out."+ext)
	if err := renderStudioRetime(ctx, temporary, input, output); err != nil {
		fail("retime failed: " + err.Error())
		return
	}
	info, err := os.Stat(output)
	if err != nil || info.Size() == 0 || info.Size() > studioRetimeMaxOutputBytes {
		fail("retime produced an invalid file")
		return
	}
	userShort := strings.ReplaceAll(user.ID, "-", "")
	if len(userShort) > 16 {
		userShort = userShort[:16]
	}
	key := fmt.Sprintf("%s/studio/%s/retime/%s.%s", strings.TrimSuffix(r2PathPrefix, "/"), userShort, id, ext)
	if err := uploadStudioFile(ctx, output, key, contentType); err != nil {
		fail("could not store the retimed clip")
		return
	}
	duration := probeStudioDuration(ctx, output)
	state.mu.Lock()
	state.Status, state.URL, state.Duration = "ready", fmt.Sprintf("https://%s/%s", r2PublicHost, key), duration
	state.mu.Unlock()
}

func studioInputHasAudio(ctx context.Context, source string) bool {
	out, err := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=index", "-of", "csv=p=0", source).Output()
	return err == nil && strings.TrimSpace(string(out)) != ""
}

func probeStudioDuration(ctx context.Context, file string) float64 {
	out, err := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file).Output()
	if err != nil {
		return 0
	}
	value, _ := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	return value
}

func studioVideoEncodeArgs() []string {
	return []string{"-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"}
}

func runStudioFFmpeg(ctx context.Context, args ...string) error {
	full := append([]string{"-y", "-hide_banner", "-loglevel", "error"}, args...)
	if out, err := exec.CommandContext(ctx, "ffmpeg", full...).CombinedOutput(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return fmt.Errorf("%s", tailOutput(out))
	}
	return nil
}

func renderStudioRetime(ctx context.Context, dir string, input studioRetimeInput, output string) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("ffmpeg is not available")
	}
	reverse := studioRetimeReverse(input)
	length := input.End - input.Start
	source, sourceStart := input.URL, input.Start
	trimArgs := func(path string, start, span float64) []string {
		return []string{"-ss", strconv.FormatFloat(start, 'f', 3, 64), "-t", strconv.FormatFloat(span, 'f', 3, 64), "-i", path}
	}
	if input.Kind == "audio" {
		args := trimArgs(source, sourceStart, length)
		args = append(args, "-vn")
		if filter := studioRetimeAudioFilter(input, reverse); filter != "" {
			args = append(args, "-af", filter)
		}
		return runStudioFFmpeg(ctx, append(args, "-c:a", "aac", "-b:a", "192k", output)...)
	}
	hasAudio := studioInputHasAudio(ctx, input.URL)
	if input.Stabilize {
		trimmed := filepath.Join(dir, "trimmed.mp4")
		if err := runStudioFFmpeg(ctx, append(append(trimArgs(source, sourceStart, length), "-an"), append(studioVideoEncodeArgs(), "-crf", "14", trimmed)...)...); err != nil {
			return err
		}
		transforms := filepath.Join(dir, "transforms.trf")
		if err := runStudioFFmpeg(ctx, "-i", trimmed, "-vf", "vidstabdetect=shakiness=6:accuracy=15:result="+transforms, "-f", "null", "-"); err != nil {
			return err
		}
		stabilized := filepath.Join(dir, "stabilized.mp4")
		filter := "vidstabtransform=input=" + transforms + ":smoothing=20:optzoom=1:interpol=bicubic,unsharp=5:5:0.8:3:3:0.4"
		args := []string{"-i", trimmed, "-vf", filter, "-an"}
		if err := runStudioFFmpeg(ctx, append(args, append(studioVideoEncodeArgs(), "-crf", "14", stabilized)...)...); err != nil {
			return err
		}
		if hasAudio {
			withAudio := filepath.Join(dir, "stabilized-audio.mp4")
			muxArgs := append(trimArgs(input.URL, input.Start, length), "-i", stabilized, "-map", "1:v:0", "-map", "0:a:0", "-c", "copy", "-shortest", withAudio)
			if err := runStudioFFmpeg(ctx, muxArgs...); err != nil {
				return err
			}
			stabilized = withAudio
		}
		source, sourceStart = stabilized, 0
	}
	if !reverse {
		args := trimArgs(source, sourceStart, length)
		return runStudioFFmpeg(ctx, append(studioRetimeStreamArgs(input, false, hasAudio, args), output)...)
	}
	var segments []string
	for offset, index := 0.0, 0; offset < length-1e-6; offset, index = offset+studioRetimeSegmentSeconds, index+1 {
		span := math.Min(studioRetimeSegmentSeconds, length-offset)
		segment := filepath.Join(dir, fmt.Sprintf("seg-%03d.mp4", index))
		args := studioRetimeStreamArgs(input, true, hasAudio, trimArgs(source, sourceStart+offset, span))
		if err := runStudioFFmpeg(ctx, append(args, segment)...); err != nil {
			return err
		}
		segments = append(segments, segment)
	}
	var list strings.Builder
	for i := len(segments) - 1; i >= 0; i-- {
		fmt.Fprintf(&list, "file '%s'\n", segments[i])
	}
	listPath := filepath.Join(dir, "list.txt")
	if err := os.WriteFile(listPath, []byte(list.String()), 0o600); err != nil {
		return err
	}
	return runStudioFFmpeg(ctx, "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", "-movflags", "+faststart", output)
}

func studioRetimeStreamArgs(input studioRetimeInput, reverse, hasAudio bool, inputArgs []string) []string {
	args := append([]string{}, inputArgs...)
	args = append(args, "-map", "0:v:0")
	if filter := studioRetimeVideoFilter(input, reverse); filter != "" {
		args = append(args, "-vf", filter)
	}
	args = append(args, studioVideoEncodeArgs()...)
	if hasAudio {
		args = append(args, "-map", "0:a:0")
		if filter := studioRetimeAudioFilter(input, reverse); filter != "" {
			args = append(args, "-af", filter)
		}
		args = append(args, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2")
	} else {
		args = append(args, "-an")
	}
	return args
}

func uploadStudioFile(ctx context.Context, filename, objectKey, contentType string) error {
	uploadURL, err := presignR2PutObject(objectKey, contentType, 1800)
	if err != nil {
		return err
	}
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return err
	}
	request.ContentLength = info.Size()
	request.Header.Set("Content-Type", contentType)
	response, err := backendClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return fmt.Errorf("upload returned %d: %s", response.StatusCode, tailOutput(body))
	}
	return nil
}
