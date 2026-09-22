package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"

	"manifoldgen-site/lofiloop"
)

// Reference Video Studio: Seedance 2.0 reference-to-video with image, video
// and audio references. A single reference video longer than 15 s is split at
// its cuts into provider-sized segments that render in parallel and are joined
// back together under the reference soundtrack.
const (
	referenceVideoService       = "reference_video"
	referenceVideoMaxSegment    = 15.0
	referenceVideoMinSegment    = 4.0
	referenceVideoMaxSource     = 60.0
	referenceVideoMarkup        = 1.5
	referenceVideoJobTimeout    = 60 * time.Minute
	referenceVideoSegmentWait   = 40 * time.Minute
	referenceVideoFalRequestDir = "bytedance/seedance-2.0"
)

var referenceVideoEndpoints = map[string]string{
	"mini": "bytedance/seedance-2.0/mini/reference-to-video",
	"pro":  "bytedance/seedance-2.0/reference-to-video",
}

// referenceVideoRates are fal's per-second prices: output seconds, and input
// reference-video seconds (billed at 0.6x the output rate).
var referenceVideoRates = map[string]map[string][2]float64{
	"mini": {"480p": {0.0721, 0.0433}, "720p": {0.1547, 0.0928}},
	"pro":  {"480p": {0.1345, 0.0807}, "720p": {0.3034, 0.1814}, "1080p": {0.682, 0.4092}},
}

const referenceVideoPolicyMessage = "Seedance refuses references or prompts that show or name real people. Use face-free or illustrated references and describe people instead of naming them."

type referenceVideoSegment struct {
	Index       int     `json:"index"`
	Start       float64 `json:"start"`
	Length      float64 `json:"length"`
	Duration    int     `json:"duration"`
	VideoURL    string  `json:"video_url,omitempty"`
	AudioURL    string  `json:"audio_url,omitempty"`
	RequestID   string  `json:"request_id,omitempty"`
	OutputURL   string  `json:"output_url,omitempty"`
	Status      string  `json:"status,omitempty"`
	ProviderUSD float64 `json:"provider_usd"`
	Attempts    int     `json:"attempts,omitempty"`
	FacesHidden bool    `json:"faces_hidden,omitempty"`
	localPath   string
}

type referenceVideoState struct {
	Request        ServiceUsageRequest     `json:"request"`
	Stage          string                  `json:"stage"`
	ImageURLs      []string                `json:"image_urls,omitempty"`
	VideoURLs      []string                `json:"video_urls,omitempty"`
	AudioURLs      []string                `json:"audio_urls,omitempty"`
	VideoSeconds   float64                 `json:"video_seconds"`
	AudioSeconds   float64                 `json:"audio_seconds"`
	Long           bool                    `json:"long"`
	Cuts           []float64               `json:"cuts,omitempty"`
	Segments       []referenceVideoSegment `json:"segments,omitempty"`
	OutputSeconds  float64                 `json:"output_seconds"`
	EstimatedUSD   float64                 `json:"estimated_usd"`
	SoundtrackPath string                  `json:"-"`
	videoPaths     []string
}

type referenceVideoEnvelope struct {
	State referenceVideoState `json:"_reference_video"`
}

func normalizeReferenceVideoRequest(req *ServiceUsageRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.Model = strings.ToLower(strings.TrimSpace(req.Model))
	req.Resolution = strings.ToLower(strings.TrimSpace(req.Resolution))
	req.AspectRatio = strings.TrimSpace(req.AspectRatio)
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if len(req.Prompt) > 4000 {
		return fmt.Errorf("prompt must be at most 4000 characters")
	}
	if req.Model == "" || req.Model == "seedance-2.0-mini" {
		req.Model = "mini"
	}
	if req.Model == "seedance-2.0" || req.Model == "full" {
		req.Model = "pro"
	}
	rates, ok := referenceVideoRates[req.Model]
	if !ok {
		return fmt.Errorf("model must be mini or pro")
	}
	if req.Resolution == "" {
		req.Resolution = "720p"
	}
	if _, ok := rates[req.Resolution]; !ok {
		return fmt.Errorf("unsupported resolution for %s", req.Model)
	}
	if req.AspectRatio == "" {
		req.AspectRatio = "auto"
	}
	if !videoStringIn(req.AspectRatio, "auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16") {
		return fmt.Errorf("unsupported aspect_ratio")
	}
	clean := func(list []string, max int, name string) ([]string, error) {
		out := make([]string, 0, len(list))
		for _, item := range list {
			item = strings.TrimSpace(item)
			if item == "" {
				continue
			}
			if err := validateRestyleURL(item); err != nil {
				return nil, fmt.Errorf("%s: %w", name, err)
			}
			out = append(out, item)
		}
		if len(out) > max {
			return nil, fmt.Errorf("at most %d %s", max, name)
		}
		return out, nil
	}
	var err error
	if req.ReferenceImageURLs, err = clean(req.ReferenceImageURLs, 9, "reference images"); err != nil {
		return err
	}
	if req.ReferenceVideoURLs, err = clean(req.ReferenceVideoURLs, 3, "reference videos"); err != nil {
		return err
	}
	if req.ReferenceAudioURLs, err = clean(req.ReferenceAudioURLs, 3, "reference audio clips"); err != nil {
		return err
	}
	if len(req.ReferenceImageURLs)+len(req.ReferenceVideoURLs)+len(req.ReferenceAudioURLs) > 12 {
		return fmt.Errorf("at most 12 reference files in total")
	}
	if len(req.ReferenceImageURLs)+len(req.ReferenceVideoURLs) == 0 {
		return fmt.Errorf("add at least one reference image or video")
	}
	if req.Duration != 0 && (req.Duration < 4 || req.Duration > 15) {
		return fmt.Errorf("duration must be between 4 and 15 seconds, or 0 to follow the reference video")
	}
	return nil
}

func referenceVideoKeepsSoundtrack(req ServiceUsageRequest) bool {
	if req.PreserveAudio != nil {
		return *req.PreserveAudio
	}
	return len(req.ReferenceAudioURLs) > 0 || len(req.ReferenceVideoURLs) > 0
}

// planReferenceVideoSegments splits a long reference video into segments of
// 4-15 s, preferring boundaries on detected cuts so every join is a hard cut.
func planReferenceVideoSegments(seconds float64, cuts []float64) []referenceVideoSegment {
	bounds := []float64{0}
	for seconds-bounds[len(bounds)-1] > referenceVideoMaxSegment {
		start := bounds[len(bounds)-1]
		best := -1.0
		for _, cut := range cuts {
			if cut-start >= referenceVideoMinSegment && cut-start <= referenceVideoMaxSegment && seconds-cut >= referenceVideoMinSegment && cut > best {
				best = cut
			}
		}
		if best < 0 {
			remaining := seconds - start
			parts := math.Ceil(remaining / referenceVideoMaxSegment)
			best = start + remaining/parts
		}
		bounds = append(bounds, best)
	}
	bounds = append(bounds, seconds)
	segments := make([]referenceVideoSegment, 0, len(bounds)-1)
	for i := 0; i+1 < len(bounds); i++ {
		length := bounds[i+1] - bounds[i]
		duration := int(math.Ceil(length - 1e-6))
		if duration < int(referenceVideoMinSegment) {
			duration = int(referenceVideoMinSegment)
		}
		if duration > int(referenceVideoMaxSegment) {
			duration = int(referenceVideoMaxSegment)
		}
		segments = append(segments, referenceVideoSegment{Index: i, Start: bounds[i], Length: length, Duration: duration})
	}
	return segments
}

func referenceVideoProviderUSD(req ServiceUsageRequest, outputSeconds, inputSeconds float64) float64 {
	rate := referenceVideoRates[req.Model][req.Resolution]
	return rate[0]*outputSeconds + rate[1]*inputSeconds
}

func referenceVideoChargeUSD(providerUSD float64) float64 {
	return math.Ceil(providerUSD*referenceVideoMarkup*100) / 100
}

// referenceVideoPlan works out the segments and billable seconds for a request
// given the probed reference video length (0 when there is no video).
func referenceVideoPlan(req ServiceUsageRequest, videoSeconds float64, cuts []float64) ([]referenceVideoSegment, bool, float64, float64, error) {
	if videoSeconds > referenceVideoMaxSource+0.5 {
		return nil, false, 0, 0, fmt.Errorf("reference video must be at most %.0f seconds", referenceVideoMaxSource)
	}
	if videoSeconds > referenceVideoMaxSegment+0.05 {
		if len(req.ReferenceVideoURLs) != 1 {
			return nil, false, 0, 0, fmt.Errorf("reference videos longer than 15 s must be the only reference video")
		}
		segments := planReferenceVideoSegments(math.Min(videoSeconds, referenceVideoMaxSource), cuts)
		out, in := 0.0, 0.0
		for _, s := range segments {
			out += float64(s.Duration)
			in += s.Length
		}
		return segments, true, out, in, nil
	}
	if videoSeconds > 0 && videoSeconds < 2 {
		return nil, false, 0, 0, fmt.Errorf("reference videos must total at least 2 seconds")
	}
	duration := req.Duration
	if duration == 0 {
		duration = int(math.Ceil(videoSeconds - 1e-6))
		if duration < 4 {
			duration = 10
		}
		if duration > 15 {
			duration = 15
		}
	}
	return []referenceVideoSegment{{Index: 0, Length: float64(duration), Duration: duration}}, false, float64(duration), videoSeconds, nil
}

func referenceVideoProbe(ctx context.Context, urls []string) (float64, []float64, error) {
	total := 0.0
	var cuts []float64
	for i, u := range urls {
		dir, err := os.MkdirTemp("", "reference-video-probe-")
		if err != nil {
			return 0, nil, err
		}
		path := filepath.Join(dir, "probe")
		if err := downloadURLToFile(ctx, u, path); err != nil {
			os.RemoveAll(dir)
			return 0, nil, fmt.Errorf("could not download reference video %d", i+1)
		}
		seconds, err := lofiloop.ProbeDurationSeconds(ctx, path)
		if err != nil || seconds <= 0 {
			os.RemoveAll(dir)
			return 0, nil, fmt.Errorf("could not read reference video %d", i+1)
		}
		if len(urls) == 1 && seconds > referenceVideoMaxSegment {
			cuts = detectCharacterSwapCuts(ctx, path)
		}
		total += seconds
		os.RemoveAll(dir)
	}
	return total, cuts, nil
}

func referenceVideoEstimate(ctx context.Context, req ServiceUsageRequest) (map[string]interface{}, []referenceVideoSegment, float64, []float64, error) {
	videoSeconds, cuts, err := referenceVideoProbe(ctx, req.ReferenceVideoURLs)
	if err != nil {
		return nil, nil, 0, nil, err
	}
	segments, long, out, in, err := referenceVideoPlan(req, videoSeconds, cuts)
	if err != nil {
		return nil, nil, 0, nil, err
	}
	provider := referenceVideoProviderUSD(req, out, in)
	charged := referenceVideoChargeUSD(provider)
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(charged / price)
	}
	rate := referenceVideoRates[req.Model][req.Resolution]
	return map[string]interface{}{
		"estimated_cost_usd": charged, "estimated_credits": credits,
		"model": req.Model, "resolution": req.Resolution, "segments": len(segments), "long": long,
		"output_seconds": out, "reference_video_seconds": math.Round(videoSeconds*100) / 100,
		"usd_per_output_second":          math.Round(rate[0]*referenceVideoMarkup*10000) / 10000,
		"usd_per_reference_video_second": math.Round(rate[1]*referenceVideoMarkup*10000) / 10000,
		"keeps_soundtrack":               referenceVideoKeepsSoundtrack(req),
		"estimated_generation_seconds":   150 + 20*int(math.Ceil(out/float64(len(segments)))),
	}, segments, videoSeconds, cuts, nil
}

func handleReferenceVideoEstimate(ctx *fasthttp.RequestCtx) {
	if _, err := videoJobUser(ctx); err != nil {
		jsonError(ctx, http.StatusUnauthorized, "invalid credentials")
		return
	}
	var req ServiceUsageRequest
	if err := json.Unmarshal(ctx.PostBody(), &req); err != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := normalizeReferenceVideoRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	probeCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	estimate, _, _, _, err := referenceVideoEstimate(probeCtx, req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	jsonResponse(ctx, http.StatusOK, estimate)
}

func handleReferenceVideoService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeReferenceVideoRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if falAPIKey == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "reference video is not configured")
		return
	}
	probeCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	estimate, segments, videoSeconds, cuts, err := referenceVideoEstimate(probeCtx, req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	estimatedUSD, _ := estimate["estimated_cost_usd"].(float64)
	estimatedCredits, _ := estimate["estimated_credits"].(float64)
	if !user.UnlimitedAPI && user.Credits < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: this video needs about %.0f credits ($%.2f)", estimatedCredits, estimatedUSD))
		return
	}
	long, _ := estimate["long"].(bool)
	state := referenceVideoState{Request: req, Stage: "prepare", VideoSeconds: videoSeconds, Long: long, Cuts: cuts, Segments: segments, EstimatedUSD: estimatedUSD}
	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:reference-video", referenceVideoService, req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to create reference video job")
		return
	}
	if err := persistReferenceVideoState(job.ID, "queued", state); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist reference video job")
		return
	}
	launchVideoJob(job.ID)
	estimate["service"] = referenceVideoService
	estimate["result"] = map[string]interface{}{"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID, "stage": state.Stage}
	estimate["settlement"] = "final price based on generated seconds"
	jsonResponse(ctx, http.StatusAccepted, estimate)
}

func persistReferenceVideoState(jobID, status string, state referenceVideoState) error {
	persisted, _ := json.Marshal(referenceVideoEnvelope{State: state})
	return dbConn.UpdateVideoJob(jobID, status, persisted, "")
}

func readReferenceVideoState(job *VideoJob) (referenceVideoState, error) {
	var envelope referenceVideoEnvelope
	if err := json.Unmarshal(job.Result, &envelope); err != nil || envelope.State.Request.Prompt == "" {
		return referenceVideoState{}, fmt.Errorf("saved reference video request is invalid")
	}
	return envelope.State, nil
}

func failReferenceVideo(job *VideoJob, message string) {
	log.Printf("[reference-video] job=%s failed: %s", job.ID, message)
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, message)
}

func processReferenceVideoJob(job *VideoJob) {
	state, err := readReferenceVideoState(job)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), referenceVideoJobTimeout)
	defer cancel()
	workDir, err := os.MkdirTemp("", "reference-video-")
	if err != nil {
		failReferenceVideo(job, "could not allocate scratch space")
		return
	}
	defer os.RemoveAll(workDir)
	_ = persistReferenceVideoState(job.ID, "processing", state)
	if err := prepareReferenceVideoMedia(ctx, job, &state, workDir); err != nil {
		failReferenceVideo(job, err.Error())
		return
	}
	state.Stage = "video"
	_ = persistReferenceVideoState(job.ID, "processing", state)
	if err := runReferenceVideoSegments(ctx, job, &state, workDir); err != nil {
		failReferenceVideo(job, err.Error())
		return
	}
	state.Stage = "mux"
	_ = persistReferenceVideoState(job.ID, "processing", state)
	outputPath, err := assembleReferenceVideo(ctx, state, workDir)
	if err != nil {
		failReferenceVideo(job, "could not assemble the final video: "+truncateString(err.Error(), 200))
		return
	}
	outputURL, err := uploadCharacterSwapFile(ctx, outputPath, job.UserID, "video/mp4")
	if err != nil {
		failReferenceVideo(job, "could not publish the final video")
		return
	}
	settleReferenceVideo(job, state, outputURL, outputPath)
}

// prepareReferenceVideoMedia normalises every reference: videos become
// <=720p 24 fps H.264 without audio (the provider's limits), anything in an
// audio slot (including a video file) becomes a stereo MP3, and a long
// reference video is cut into its planned segments with matching audio.
func prepareReferenceVideoMedia(ctx context.Context, job *VideoJob, state *referenceVideoState, workDir string) error {
	req := state.Request
	state.ImageURLs = req.ReferenceImageURLs
	videoPaths := make([]string, 0, len(req.ReferenceVideoURLs))
	state.VideoURLs = state.VideoURLs[:0]
	for i, u := range req.ReferenceVideoURLs {
		raw := filepath.Join(workDir, fmt.Sprintf("video-raw-%d", i))
		if err := downloadURLToFile(ctx, u, raw); err != nil {
			return fmt.Errorf("could not download reference video %d", i+1)
		}
		norm := filepath.Join(workDir, fmt.Sprintf("video-%d.mp4", i))
		if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", raw, "-an",
			"-vf", "fps=24,scale='if(gte(iw,ih),min(1280,iw),-2)':'if(gte(iw,ih),-2,min(1280,ih))',scale='max(640,iw)':-2,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
			"-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", norm); err != nil {
			return fmt.Errorf("could not read reference video %d", i+1)
		}
		videoPaths = append(videoPaths, norm)
		state.videoPaths = append(state.videoPaths, norm)
		if i == 0 && referenceVideoKeepsSoundtrack(req) && len(req.ReferenceAudioURLs) == 0 {
			track := filepath.Join(workDir, "soundtrack.m4a")
			if lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", raw, "-vn", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", track) == nil {
				state.SoundtrackPath = track
			}
		}
		if !state.Long {
			videoURL, err := uploadCharacterSwapFile(ctx, norm, job.UserID, "video/mp4")
			if err != nil {
				return fmt.Errorf("could not store reference video %d", i+1)
			}
			state.VideoURLs = append(state.VideoURLs, videoURL)
		}
	}
	audioPaths := make([]string, 0, len(req.ReferenceAudioURLs))
	state.AudioURLs = state.AudioURLs[:0]
	for i, u := range req.ReferenceAudioURLs {
		raw := filepath.Join(workDir, fmt.Sprintf("audio-raw-%d", i))
		if err := downloadURLToFile(ctx, u, raw); err != nil {
			return fmt.Errorf("could not download reference audio %d", i+1)
		}
		full := filepath.Join(workDir, fmt.Sprintf("audio-full-%d.wav", i))
		if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", raw, "-vn", "-ac", "2", "-ar", "44100", full); err != nil {
			return fmt.Errorf("reference audio %d has no readable audio track", i+1)
		}
		if seconds, err := lofiloop.ProbeDurationSeconds(ctx, full); err == nil && i == 0 {
			state.AudioSeconds = seconds
		}
		audioPaths = append(audioPaths, full)
		if i == 0 && referenceVideoKeepsSoundtrack(req) {
			state.SoundtrackPath = full
		}
		if !state.Long {
			clip := filepath.Join(workDir, fmt.Sprintf("audio-%d.mp3", i))
			if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", full, "-t", "15", "-c:a", "libmp3lame", "-b:a", "192k", clip); err != nil {
				return fmt.Errorf("could not encode reference audio %d", i+1)
			}
			audioURL, err := uploadCharacterSwapFile(ctx, clip, job.UserID, "audio/mpeg")
			if err != nil {
				return fmt.Errorf("could not store reference audio %d", i+1)
			}
			state.AudioURLs = append(state.AudioURLs, audioURL)
		}
	}
	if !state.Long {
		return nil
	}
	for i := range state.Segments {
		seg := &state.Segments[i]
		if seg.VideoURL != "" {
			continue
		}
		clip := filepath.Join(workDir, fmt.Sprintf("segment-%02d.mp4", seg.Index))
		if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(seg.Start), "-i", videoPaths[0], "-t", trimSeconds(seg.Length),
			"-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-movflags", "+faststart", clip); err != nil {
			return fmt.Errorf("could not cut reference segment %d", seg.Index+1)
		}
		videoURL, err := uploadCharacterSwapFile(ctx, clip, job.UserID, "video/mp4")
		if err != nil {
			return fmt.Errorf("could not store reference segment %d", seg.Index+1)
		}
		seg.VideoURL = videoURL
		seg.localPath = clip
		if len(audioPaths) > 0 {
			audioClip := filepath.Join(workDir, fmt.Sprintf("segment-%02d.mp3", seg.Index))
			start := seg.Start
			if state.AudioSeconds < state.VideoSeconds-0.5 {
				start = 0
			}
			if lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(start), "-i", audioPaths[0], "-t", trimSeconds(math.Max(2, seg.Length)),
				"-c:a", "libmp3lame", "-b:a", "192k", audioClip) == nil {
				if audioURL, err := uploadCharacterSwapFile(ctx, audioClip, job.UserID, "audio/mpeg"); err == nil {
					seg.AudioURL = audioURL
				}
			}
		}
	}
	return nil
}

func referenceVideoFalInput(state referenceVideoState, seg referenceVideoSegment) map[string]interface{} {
	req := state.Request
	input := map[string]interface{}{
		"prompt": req.Prompt, "resolution": req.Resolution, "duration": fmt.Sprint(seg.Duration),
		"aspect_ratio": req.AspectRatio, "generate_audio": req.IncludeAudio != nil && *req.IncludeAudio,
	}
	if len(state.ImageURLs) > 0 {
		input["image_urls"] = state.ImageURLs
	}
	if state.Long {
		input["video_urls"] = []string{seg.VideoURL}
		if seg.AudioURL != "" {
			input["audio_urls"] = []string{seg.AudioURL}
		}
	} else {
		if len(state.VideoURLs) > 0 {
			input["video_urls"] = state.VideoURLs
		}
		if len(state.AudioURLs) > 0 {
			input["audio_urls"] = state.AudioURLs
		}
	}
	return input
}

type referenceVideoPolicyError struct{ detail string }

func (e referenceVideoPolicyError) Error() string { return referenceVideoPolicyMessage }

func referenceVideoFalError(data []byte) error {
	text := string(data)
	if strings.Contains(text, "content_policy") || strings.Contains(text, "likeness") || strings.Contains(text, "Invalid parameters") {
		return referenceVideoPolicyError{detail: truncateString(text, 300)}
	}
	var payload struct {
		Detail []struct {
			Msg string `json:"msg"`
		} `json:"detail"`
	}
	if json.Unmarshal(data, &payload) == nil && len(payload.Detail) > 0 && payload.Detail[0].Msg != "" {
		return fmt.Errorf("the video model rejected the request: %s", truncateString(payload.Detail[0].Msg, 200))
	}
	return fmt.Errorf("the video model rejected the request")
}

// hideReferenceVideoFaces pixelates the performers' faces in a reference clip
// so a provider likeness filter passes while the body motion stays intact.
func hideReferenceVideoFaces(ctx context.Context, job *VideoJob, src, workDir string, index int) (string, error) {
	if src == "" {
		return "", fmt.Errorf("no local reference clip")
	}
	out := filepath.Join(workDir, fmt.Sprintf("faceless-%02d.mp4", index))
	if _, err := runExactHelper(ctx, "blurfaces", "--src", src, "--out", out); err != nil {
		return "", err
	}
	return uploadCharacterSwapFile(ctx, out, job.UserID, "video/mp4")
}

func runReferenceVideoSegments(ctx context.Context, job *VideoJob, state *referenceVideoState, workDir string) error {
	endpoint := referenceVideoEndpoints[state.Request.Model]
	var mu sync.Mutex
	var wg sync.WaitGroup
	errs := make([]error, len(state.Segments))
	submit := func(i int) (string, error) {
		mu.Lock()
		seg := state.Segments[i]
		input := referenceVideoFalInput(*state, seg)
		mu.Unlock()
		data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+endpoint, input)
		if err != nil {
			return "", referenceVideoFalError(data)
		}
		var queued falQueueResponse
		if json.Unmarshal(data, &queued) != nil || queued.RequestID == "" {
			return "", fmt.Errorf("the video model returned no job")
		}
		mu.Lock()
		state.Segments[i].RequestID, state.Segments[i].Status = queued.RequestID, "queued"
		state.Segments[i].Attempts++
		_ = persistReferenceVideoState(job.ID, "processing", *state)
		mu.Unlock()
		return waitReferenceVideoSegment(ctx, job.ID, queued.RequestID)
	}
	for i := range state.Segments {
		if state.Segments[i].OutputURL != "" {
			continue
		}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			var outputURL string
			var err error
			if rid := state.Segments[i].RequestID; rid != "" {
				outputURL, err = waitReferenceVideoSegment(ctx, job.ID, rid)
			} else {
				outputURL, err = submit(i)
			}
			for attempt := 0; err != nil && attempt < 2; attempt++ {
				if _, policy := err.(referenceVideoPolicyError); !policy || videoJobCancellationRequested(job.ID) {
					break
				}
				log.Printf("[reference-video] job=%s segment %d rejected by the likeness filter; retrying (%d)", job.ID, i+1, attempt+1)
				outputURL, err = submit(i)
			}
			if _, policy := err.(referenceVideoPolicyError); policy && !videoJobCancellationRequested(job.ID) {
				mu.Lock()
				local := state.Segments[i].localPath
				if !state.Long && len(state.videoPaths) > 0 {
					local = state.videoPaths[0]
				}
				mu.Unlock()
				if faceless, ferr := hideReferenceVideoFaces(ctx, job, local, workDir, i); ferr == nil {
					log.Printf("[reference-video] job=%s segment %d resubmitting with faces pixelated", job.ID, i+1)
					mu.Lock()
					if state.Long {
						state.Segments[i].VideoURL = faceless
					} else if len(state.VideoURLs) > 0 {
						state.VideoURLs[0] = faceless
					}
					state.Segments[i].FacesHidden = true
					mu.Unlock()
					outputURL, err = submit(i)
				} else {
					log.Printf("[reference-video] job=%s face pixelation failed: %v", job.ID, ferr)
				}
			}
			if err != nil {
				errs[i] = err
				return
			}
			mu.Lock()
			seg := state.Segments[i]
			state.Segments[i].OutputURL, state.Segments[i].Status = outputURL, "completed"
			inputSeconds := 0.0
			if state.Long {
				inputSeconds = seg.Length
			} else if i == 0 {
				inputSeconds = state.VideoSeconds
			}
			state.Segments[i].ProviderUSD = referenceVideoProviderUSD(state.Request, float64(seg.Duration), inputSeconds)
			_ = persistReferenceVideoState(job.ID, "processing", *state)
			mu.Unlock()
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			if pe, ok := err.(referenceVideoPolicyError); ok {
				log.Printf("[reference-video] job=%s provider rejection: %s", job.ID, pe.detail)
			}
			return err
		}
	}
	return nil
}

func waitReferenceVideoSegment(ctx context.Context, jobID, requestID string) (string, error) {
	base := "https://queue.fal.run/" + referenceVideoFalRequestDir + "/requests/" + url.PathEscape(requestID)
	deadline := time.Now().Add(referenceVideoSegmentWait)
	for time.Now().Before(deadline) {
		if ctx.Err() != nil {
			return "", fmt.Errorf("video generation timed out")
		}
		if videoJobCancellationRequested(jobID) {
			return "", fmt.Errorf("cancelled")
		}
		data, _, err := callFalQueue(http.MethodGet, base+"/status", nil)
		if err == nil {
			var status falQueueResponse
			_ = json.Unmarshal(data, &status)
			switch strings.ToLower(strings.TrimSpace(status.Status)) {
			case "completed", "succeeded":
				result, _, err := callFalQueue(http.MethodGet, base, nil)
				if err != nil {
					return "", referenceVideoFalError(result)
				}
				var payload map[string]interface{}
				if err := json.Unmarshal(result, &payload); err != nil {
					return "", fmt.Errorf("the video model returned an invalid result")
				}
				if video, ok := payload["video"].(map[string]interface{}); ok {
					if outputURL, _ := video["url"].(string); outputURL != "" {
						return outputURL, nil
					}
				}
				return "", referenceVideoFalError(result)
			case "failed", "cancelled", "canceled":
				return "", fmt.Errorf("video generation failed")
			}
		}
		time.Sleep(5 * time.Second)
	}
	return "", fmt.Errorf("video generation did not finish in time")
}

// assembleReferenceVideo trims each segment to its reference length, joins
// them with hard cuts, and lays the reference soundtrack (or the model's own
// audio when none is kept) under the result.
func assembleReferenceVideo(ctx context.Context, state referenceVideoState, workDir string) (string, error) {
	args := []string{"-y", "-loglevel", "error"}
	var filter strings.Builder
	total := 0.0
	for i, seg := range state.Segments {
		path := filepath.Join(workDir, fmt.Sprintf("out-%02d.mp4", seg.Index))
		if err := downloadURLToFile(ctx, seg.OutputURL, path); err != nil {
			return "", fmt.Errorf("download segment %d: %w", seg.Index+1, err)
		}
		args = append(args, "-i", path)
		keep := float64(seg.Duration)
		if state.Long {
			keep = seg.Length
		}
		total += keep
		fmt.Fprintf(&filter, "[%d:v]fps=24,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1,tpad=stop_mode=clone:stop_duration=1,trim=duration=%s,setpts=PTS-STARTPTS[v%d];", i, trimSeconds(keep), i)
	}
	for i := range state.Segments {
		fmt.Fprintf(&filter, "[v%d]", i)
	}
	fmt.Fprintf(&filter, "concat=n=%d:v=1:a=0,format=yuv420p[v]", len(state.Segments))
	soundtrack := state.SoundtrackPath
	if soundtrack != "" {
		args = append(args, "-i", soundtrack)
	}
	args = append(args, "-filter_complex", filter.String(), "-map", "[v]")
	if soundtrack != "" {
		args = append(args, "-map", fmt.Sprintf("%d:a:0", len(state.Segments)))
	} else if len(state.Segments) == 1 {
		args = append(args, "-map", "0:a:0?")
	}
	out := filepath.Join(workDir, "final.mp4")
	args = append(args, "-t", trimSeconds(total), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "24",
		"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", out)
	if err := lofiloop.RunFFmpeg(ctx, args...); err != nil {
		return "", err
	}
	return out, nil
}

func settleReferenceVideo(job *VideoJob, state referenceVideoState, outputURL, outputPath string) {
	providerUSD, outputSeconds := 0.0, 0.0
	for _, seg := range state.Segments {
		providerUSD += seg.ProviderUSD
		outputSeconds += float64(seg.Duration)
	}
	chargedUSD := referenceVideoChargeUSD(providerUSD)
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	duration, _ := lofiloop.ProbeDurationSeconds(context.Background(), outputPath)
	state.Stage = "completed"
	result := map[string]interface{}{
		"_reference_video": state, "video_url": outputURL, "stage": "completed",
		"duration_seconds": math.Round(duration*100) / 100, "segments": len(state.Segments),
		"model": state.Request.Model, "resolution": state.Request.Resolution, "format": "mp4/h264+aac",
		"provider_cost_usd": providerUSD, "charged_usd": chargedUSD, "cute_price_usd": cutePrice,
		"credits_used": chargedUSD / cutePrice,
	}
	payload, _ := json.Marshal(result)
	_, _, err := dbConn.SettleGeneratedVideoJob(job.ID, payload, providerUSD, chargedUSD, cutePrice)
	if err == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release the completed video; $%.2f required", chargedUSD))
		return
	}
	if err != nil {
		log.Printf("[reference-video] settlement failed job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, payload)
	maybeTriggerAutoTopup(job.UserID)
}

func exposePublicReferenceVideoStatus(payload map[string]interface{}) {
	internal, ok := payload["_reference_video"].(map[string]interface{})
	if !ok {
		return
	}
	if stage, ok := internal["stage"].(string); ok && stage != "" {
		if _, exists := payload["stage"]; !exists {
			payload["stage"] = stage
		}
	}
	if segments, ok := internal["segments"].([]interface{}); ok {
		done := 0
		for _, raw := range segments {
			if seg, ok := raw.(map[string]interface{}); ok && seg["status"] == "completed" {
				done++
			}
		}
		payload["segments_total"] = len(segments)
		payload["segments_completed"] = done
	}
}

func retryReferenceVideoJob(job *VideoJob) error {
	state, err := readReferenceVideoState(job)
	if err != nil {
		return err
	}
	if err := persistReferenceVideoState(job.ID, "queued", state); err != nil {
		return err
	}
	launchVideoJob(job.ID)
	return nil
}
