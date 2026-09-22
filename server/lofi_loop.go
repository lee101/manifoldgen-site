package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/valyala/fasthttp"

	"manifoldgen-site/lofiloop"
)

const (
	lofiLoopService          = "lofi_loop"
	lofiLoopRenderTimeout    = 25 * time.Minute
	lofiLoopMaxArtifactBytes = 512 << 20
	lofiLoopDefaultDuration  = 60
)

// lofiLoopDefaultMusicPrompt keeps the tool usable when the caller only
// describes the artwork: the soundtrack still has to be something.
const lofiLoopDefaultMusicPrompt = "instrumental lofi hip hop loop, warm vinyl crackle, soft dusty drums, mellow electric piano, slow mellow tempo, no vocals"

// lofiLoopRenderSlots bounds concurrent ffmpeg renders so a burst of loop
// requests cannot starve the rest of the host.
var lofiLoopRenderSlots = make(chan struct{}, 2)

// lofiLoopState is persisted on the video job under "_lofi_loop", mirroring the
// music video pipeline: the request is replayed by the worker, and the music
// stage can hand its stored track to the render stage.
type lofiLoopState struct {
	Request            ServiceUsageRequest `json:"request"`
	Stage              string              `json:"stage"`
	AudioURL           string              `json:"audio_url,omitempty"`
	AudioID            string              `json:"audio_id,omitempty"`
	MusicCreditsUsed   float64             `json:"music_credits_used"`
	MusicCreditsRemain float64             `json:"music_credits_remain"`
	SpecVersion        int                 `json:"spec_version"`
}

type lofiLoopEnvelope struct {
	Lofi lofiLoopState `json:"_lofi_loop"`
}

func lofiLoopImageBackend() (string, string) {
	backend := getEnv("ZIMAGE_BACKEND_URL", getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"))
	secret := getEnv("OMNISERVE_NATIVE_SECRET", getEnv("OMNISERVE_SECRET", ""))
	return strings.TrimRight(backend, "/"), secret
}

// normalizeLofiLoopRequest validates the look and loop geometry, and resolves
// the soundtrack: an uploaded/public track is used as-is, otherwise the request
// asks the music pipeline for one.
func normalizeLofiLoopRequest(req *ServiceUsageRequest) (string, int, error) {
	if req == nil {
		return "", 0, fmt.Errorf("lofi loop request is required")
	}
	spec := lofiloop.DefaultSpec()
	if _, err := spec.Visualizer(req.Visualizer); err != nil {
		return "", 0, err
	}
	if _, err := spec.Preset(req.Preset); err != nil {
		return "", 0, err
	}
	if _, err := spec.Palette(req.Palette); err != nil {
		return "", 0, err
	}
	if motion := strings.TrimSpace(req.Motion); motion != "" && !lofiloop.IsMotion(motion) {
		return "", 0, fmt.Errorf("unknown motion %q", motion)
	}
	size := strings.TrimSpace(req.Size)
	if size == "" {
		size = spec.Defaults.Size
	}
	if _, _, err := lofiloop.ParseSize(size); err != nil {
		return "", 0, err
	}
	req.Size = size
	if req.LoopSeconds < 0 {
		return "", 0, fmt.Errorf("loop_seconds must not be negative")
	}
	if req.LoopStart < 0 {
		return "", 0, fmt.Errorf("loop_start must not be negative")
	}
	if req.SeamSeconds < 0 || req.SeamSeconds > lofiloop.MaxSeamSeconds {
		return "", 0, fmt.Errorf("seam_seconds must be between 0 and %.0f", lofiloop.MaxSeamSeconds)
	}
	// The API reports 0 as "unspecified"; the renderer treats a negative seam as
	// "use the spec default" and a literal 0 as a hard loop.
	if req.SeamSeconds == 0 {
		req.SeamSeconds = -1
	}
	if req.FramesPerSecond < 0 || req.FramesPerSecond > 60 {
		return "", 0, fmt.Errorf("frames_per_second must be between 0 and 60")
	}
	if strings.TrimSpace(req.CharacterPrompt) == "" && strings.TrimSpace(req.ScenePrompt) == "" && strings.TrimSpace(req.Prompt) == "" {
		return "", 0, fmt.Errorf("character_prompt, scene_prompt, or prompt is required to draw the cover")
	}
	if req.FirstFrame != "" && !strings.HasPrefix(req.FirstFrame, "https://") {
		return "", 0, fmt.Errorf("first_frame must be an https cover image URL")
	}
	if strings.TrimSpace(req.AudioURL) != "" {
		if !strings.HasPrefix(req.AudioURL, "https://") {
			return "", 0, fmt.Errorf("audio_url must be an https audio URL")
		}
		return "", 0, nil
	}
	duration := req.Duration
	if duration == 0 {
		duration = lofiLoopDefaultDuration
	}
	musicDescription := strings.TrimSpace(req.Prompt)
	if musicDescription == "" {
		musicDescription = lofiLoopDefaultMusicPrompt
	}
	prompt, normalized, err := normalizeMusicGenerationInput(musicDescription, duration)
	if err != nil {
		return "", 0, err
	}
	req.Prompt = musicDescription
	req.Duration = normalized
	return prompt, normalized, nil
}

// lofiLoopSpec is the canonical look catalogue shared with the web tool and
// lowfi-cli.
func lofiLoopSpec() *lofiloop.Spec { return lofiloop.DefaultSpec() }

func handleLofiLoopSpec(ctx *fasthttp.RequestCtx) {
	jsonResponse(ctx, http.StatusOK, lofiLoopSpec())
}

func handleLofiLoopService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	musicPrompt, musicDuration, err := normalizeLofiLoopRequest(&req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if user == nil {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}

	balance := user.Credits
	musicCredits := 0.0
	generatingMusic := strings.TrimSpace(req.AudioURL) == ""
	if generatingMusic {
		musicCredits = studioMusicCredits
		if user.UnlimitedAPI {
			musicCredits = 0
		} else {
			balance, err = dbConn.DeductUserCredits(user.ID, studioMusicCredits)
			if err != nil {
				jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: the loop soundtrack costs 80 credits before the render")
				return
			}
		}
	}

	cuteCost := getRequestServicePriceCUTE(req)
	if cuteCost <= 0 {
		if musicCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, musicCredits)
		}
		jsonError(ctx, http.StatusServiceUnavailable, "pricing unavailable")
		return
	}
	renderCredits := cuteCost
	if !user.UnlimitedAPI {
		balance, err = dbConn.DeductUserCredits(user.ID, renderCredits)
		if err != nil {
			if musicCredits > 0 {
				_, _ = dbConn.AddUserCredits(user.ID, musicCredits)
			}
			jsonError(ctx, http.StatusPaymentRequired, "insufficient credits for the loop render")
			return
		}
	} else {
		renderCredits = 0
	}

	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:lofi", lofiLoopService, req.Prompt)
	if err != nil {
		if musicCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, musicCredits)
		}
		if renderCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, renderCredits)
		}
		jsonError(ctx, http.StatusInternalServerError, "failed to create lofi loop job")
		return
	}
	req.Visualizer = strings.TrimSpace(req.Visualizer)
	state := lofiLoopState{
		Request: req, Stage: "music", AudioURL: "", AudioID: "",
		MusicCreditsUsed: musicCredits, MusicCreditsRemain: balance,
		SpecVersion: lofiloop.DefaultSpec().Version,
	}
	if generatingMusic {
		state.Stage = "music"
	} else {
		state.Stage = "render"
	}
	persisted, _ := json.Marshal(lofiLoopEnvelope{Lofi: state})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", persisted, ""); err != nil {
		if musicCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, musicCredits)
		}
		if renderCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, renderCredits)
		}
		jsonError(ctx, http.StatusInternalServerError, "failed to persist lofi loop job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": lofiLoopService,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued",
			"status_url": "/api/video-jobs/" + job.ID, "stage": state.Stage,
		},
		"credits_used":       musicCredits + renderCredits,
		"credits_remain":     balance,
		"estimated_cost_usd": musicCredits*getCUTEPriceUSD() + float64(renderCredits)*getCUTEPriceUSD(),
		"music_prompt":       musicPrompt,
		"music_duration":     musicDuration,
		"visualizer":         req.Visualizer,
		"preset":             req.Preset,
	})
}

func readLofiLoopState(job *VideoJob) (lofiLoopState, error) {
	if job == nil || len(job.Result) == 0 {
		return lofiLoopState{}, fmt.Errorf("lofi loop state is unavailable")
	}
	var envelope lofiLoopEnvelope
	if err := json.Unmarshal(job.Result, &envelope); err != nil {
		return lofiLoopState{}, fmt.Errorf("lofi loop state is invalid")
	}
	if envelope.Lofi.Request.Service == "" && envelope.Lofi.Request.Size == "" {
		return lofiLoopState{}, fmt.Errorf("lofi loop state is empty")
	}
	return envelope.Lofi, nil
}

func persistLofiLoopState(jobID, status string, state lofiLoopState) error {
	payload, _ := json.Marshal(lofiLoopEnvelope{Lofi: state})
	return dbConn.UpdateVideoJob(jobID, status, payload, "")
}

func processLofiLoopJob(job *VideoJob) {
	state, err := readLofiLoopState(job)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved lofi loop request is invalid")
		return
	}
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "lofi loop owner no longer exists")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")

	if state.AudioURL == "" {
		generatedURL, generationErr := studioGenerateMusic(state.Request.Prompt, state.Request.Duration)
		if generationErr != nil {
			log.Printf("lofi loop soundtrack failed job=%s: %v", job.ID, generationErr)
			refundLofiLoopMusic(job, state, "loop soundtrack generation failed")
			return
		}
		if videoJobWasCancelled(job.ID) {
			return
		}
		storedURL, storageErr := persistGeneratedAudioURLNamed(generatedURL, job.UserID, "lofi-loop-soundtrack")
		if storageErr != nil {
			log.Printf("lofi loop soundtrack storage failed job=%s: %v", job.ID, storageErr)
			refundLofiLoopMusic(job, state, "loop soundtrack storage failed")
			return
		}
		state.AudioID = "music_" + strings.TrimPrefix(job.ID, "video_")
		state.AudioURL = storedURL
		asset := &GeneratedAudio{
			ID: state.AudioID, UserID: job.UserID, Kind: "music", Prompt: state.Request.Prompt,
			Title: studioAudioTitle(state.Request.Prompt), AudioURL: state.AudioURL,
			DurationSeconds: state.Request.Duration, Public: true, CreatedAt: time.Now(),
		}
		if err := dbConn.InsertGeneratedAudio(asset); err != nil {
			log.Printf("lofi loop soundtrack indexing failed job=%s: %v", job.ID, err)
		}
		if state.MusicCreditsUsed > 0 {
			price := getCUTEPriceUSD()
			_ = dbConn.CreateBillingEvent(&BillingEvent{
				ID: "lofi_loop_music_" + job.ID, UserID: job.UserID, EventType: "music_generation",
				Amount: -state.MusicCreditsUsed, CuteAmount: state.MusicCreditsUsed,
				USDAmount: state.MusicCreditsUsed * price, Description: "lofi loop soundtrack generation",
				CreditsAfter: state.MusicCreditsRemain,
			})
			maybeTriggerAutoTopup(job.UserID)
		}
	}
	state.Stage = "render"
	if err := persistLofiLoopState(job.ID, "processing", state); err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "lofi loop state could not be persisted")
		return
	}
	if videoJobWasCancelled(job.ID) {
		return
	}

	result, renderErr := renderLofiLoop(job, user, state)
	if renderErr != nil {
		log.Printf("lofi loop render failed job=%s: %v", job.ID, renderErr)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "lofi loop render failed: "+truncateString(renderErr.Error(), 200))
		return
	}
	payload, err := json.Marshal(result)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "lofi loop result could not be encoded")
		return
	}
	if err := dbConn.UpdateVideoJob(job.ID, "completed", payload, ""); err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "lofi loop result could not be stored")
		return
	}
	indexCompletedVideo(job, payload)
}

func refundLofiLoopMusic(job *VideoJob, state lofiLoopState, reason string) {
	if state.MusicCreditsUsed > 0 && !videoJobWasCancelled(job.ID) {
		_, _ = dbConn.AddUserCredits(job.UserID, state.MusicCreditsUsed)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, reason)
}

// renderLofiLoop downloads the soundtrack, renders the loop, and publishes both
// the video and its cover art to R2.
func renderLofiLoop(job *VideoJob, user *User, state lofiLoopState) (map[string]interface{}, error) {
	select {
	case lofiLoopRenderSlots <- struct{}{}:
		defer func() { <-lofiLoopRenderSlots }()
	case <-time.After(20 * time.Minute):
		return nil, fmt.Errorf("render queue is saturated")
	}

	ctx, cancel := context.WithTimeout(context.Background(), lofiLoopRenderTimeout)
	defer cancel()

	workDir, err := os.MkdirTemp("", "lofi-loop-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(workDir)

	req := state.Request
	audioPath := filepath.Join(workDir, "soundtrack"+audioExtension(state.AudioURL))
	if err := downloadURLToFile(ctx, state.AudioURL, audioPath); err != nil {
		return nil, err
	}
	coverPath := ""
	if strings.TrimSpace(req.FirstFrame) != "" {
		coverPath = filepath.Join(workDir, "cover.png")
		if err := downloadURLToFile(ctx, req.FirstFrame, coverPath); err != nil {
			return nil, err
		}
	}
	backendURL, backendSecret := lofiLoopImageBackend()
	rendered, err := lofiloop.Render(ctx, lofiloop.Request{
		ID: job.ID, AudioPath: audioPath, CoverPath: coverPath, OutDir: workDir,
		Prompt: req.Prompt, Character: req.CharacterPrompt, Scene: req.ScenePrompt,
		Negative:   req.NegativePrompt,
		Preset:     req.Preset,
		Visualizer: req.Visualizer,
		Palette:    req.Palette,
		Motion:     req.Motion,
		Size:       req.Size,
		FPS:        req.FramesPerSecond,
		LoopStart:  req.LoopStart, LoopSeconds: float64(req.LoopSeconds),
		SeamSeconds: req.SeamSeconds,
		VizAlpha:    req.VisualizerAlpha,
		Grain:       req.Grain,
		Seed:        int64(req.Seed),
		StillSteps:  req.NumSteps,
		ZImageURL:   backendURL, ZImageSecret: backendSecret,
		Verify: true,
	})
	if err != nil {
		return nil, err
	}
	videoURL, err := uploadLofiLoopFile(ctx, rendered.Video, user.ID, "video/mp4")
	if err != nil {
		return nil, err
	}
	coverURL, err := uploadLofiLoopFile(ctx, rendered.Cover, user.ID, "image/png")
	if err != nil {
		return nil, err
	}
	result := map[string]interface{}{
		"video_url": videoURL, "cover_url": coverURL, "service": lofiLoopService,
		"visualizer": rendered.Visualizer, "preset": rendered.Preset,
		"palette": rendered.Palette, "motion": rendered.Motion,
		"duration_seconds": rendered.Seconds, "frames": rendered.Frames,
		"fps": rendered.FPS, "size": fmt.Sprintf("%dx%d", rendered.Width, rendered.Height),
		"seam_seconds": rendered.SeamSeconds, "seed": req.Seed,
		"still_prompt": rendered.StillPrompt, "still_model": rendered.StillModel,
		"loop_exact": false, "loop_mean_abs_diff": 0.0,
	}
	if rendered.Loop != nil {
		result["loop_exact"] = rendered.Loop.Exact
		result["loop_mean_abs_diff"] = rendered.Loop.MeanAbsDiff
		result["loop_max_abs_diff"] = rendered.Loop.MaxAbsDiff
	}
	if state.AudioID != "" {
		result["music_audio_id"] = state.AudioID
		result["music_audio_url"] = state.AudioURL
	}
	return result, nil
}

func uploadLofiLoopFile(ctx context.Context, path, userID, contentType string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	if info.Size() <= 0 || info.Size() > lofiLoopMaxArtifactBytes {
		return "", fmt.Errorf("lofi loop artifact size %d is invalid", info.Size())
	}
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	extension := "bin"
	switch contentType {
	case "video/mp4":
		extension = "mp4"
	case "image/png":
		extension = "png"
	}
	objectKey := fmt.Sprintf("%s/%s/lofi/%s.%s", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), extension)
	uploadURL, err := presignR2PutObject(objectKey, contentType, 6*60*60)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return "", err
	}
	httpReq.ContentLength = info.Size()
	httpReq.Header.Set("Content-Type", contentType)
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("R2 lofi loop upload returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func downloadURLToFile(ctx context.Context, url, path string) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, url, bytes.NewReader(nil))
	if err != nil {
		return err
	}
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("download %s returned %d", truncateString(url, 120), resp.StatusCode)
	}
	file, err := os.Create(path)
	if err != nil {
		return err
	}
	defer file.Close()
	written, err := io.Copy(file, io.LimitReader(resp.Body, lofiLoopMaxArtifactBytes))
	if err != nil {
		return err
	}
	if written == 0 {
		return fmt.Errorf("download %s returned no data", truncateString(url, 120))
	}
	return nil
}

func audioExtension(url string) string {
	lowered := strings.ToLower(url)
	for _, extension := range []string{".mp3", ".flac", ".wav", ".opus", ".ogg", ".m4a", ".aac"} {
		if strings.Contains(lowered, extension) {
			return extension
		}
	}
	return ".wav"
}

// exposePublicLofiLoopStatus publishes only the loop's user-facing progress.
func exposePublicLofiLoopStatus(payload map[string]interface{}) {
	if payload == nil {
		return
	}
	internal, ok := payload["_lofi_loop"].(map[string]interface{})
	if !ok {
		return
	}
	if stage, ok := internal["stage"].(string); ok && stage != "" {
		payload["stage"] = stage
	}
	if audioURL, ok := internal["audio_url"].(string); ok && strings.HasPrefix(audioURL, "https://") {
		payload["music_audio_url"] = audioURL
	}
}
