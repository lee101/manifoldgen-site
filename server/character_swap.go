package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"

	"manifoldgen-site/lofiloop"
)

const (
	characterSwapService        = "character_swap_video"
	characterSwapMarkup         = 1.20
	characterSwapMaxSeconds     = 60
	characterSwapMinSeconds     = 5
	characterSwapChunkSeconds   = 10
	characterSwapSegmentSeconds = 4.5
	characterSwapMaxRetries     = 2
	characterSwapMinSlack       = 0.5
	characterSwapJobTimeout     = 90 * time.Minute
	characterSwapChunkTimeout   = 40 * time.Minute
	characterSwapMaxArtifact    = 768 << 20
	characterSwapFalPath        = "minimax/h3/reference-to-video"
	characterSwapFalRequestBase = "minimax/h3"
	characterSwapHeadTrim       = 0.125
	characterSwapMaxHeadTrim    = 1.5
)

var characterSwapRates = map[string]float64{"768P": 0.08, "2K": 0.13}

var characterSwapRenderSlots = make(chan struct{}, 2)

const characterSwapDefaultVideoPrompt = "Image 1 is the exact target look: the new characters, their wardrobe, the set and the background. Video 1 is only the motion and camera reference. From the very first frame show only the characters of Image 1, never the original people. Each new character performs every move, gesture, lip movement and timing of the corresponding person in Video 1, in the identical position and scale. Same camera angles, same framing, same cuts, same props, and the background of Image 1 throughout. Photorealistic music video."

type characterSwapChunk struct {
	Index       int     `json:"index"`
	Start       float64 `json:"start"`
	Length      float64 `json:"length"`
	Duration    int     `json:"duration"`
	SourceURL   string  `json:"source_url,omitempty"`
	RequestID   string  `json:"request_id,omitempty"`
	OutputURL   string  `json:"output_url,omitempty"`
	Status      string  `json:"status,omitempty"`
	ProviderUSD float64 `json:"provider_usd"`
	Retries     int     `json:"retries,omitempty"`
	QAReason    string  `json:"qa_reason,omitempty"`
	LocalPath   string  `json:"-"`
}

type characterSwapState struct {
	Request          ServiceUsageRequest  `json:"request"`
	Stage            string               `json:"stage"`
	SourceSeconds    float64              `json:"source_seconds"`
	FrameURL         string               `json:"frame_url,omitempty"`
	SwappedImageURL  string               `json:"swapped_image_url,omitempty"`
	ImageCredits     float64              `json:"image_credits"`
	ImageUSD         float64              `json:"image_usd"`
	Chunks           []characterSwapChunk `json:"chunks,omitempty"`
	EstimatedUSD     float64              `json:"estimated_usd"`
	EstimatedCredits float64              `json:"estimated_credits"`
}

type characterSwapEnvelope struct {
	State characterSwapState `json:"_character_swap"`
}

func normalizeCharacterSwapRequest(req *ServiceUsageRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.CharacterPrompt = strings.TrimSpace(req.CharacterPrompt)
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.Resolution = strings.ToUpper(strings.TrimSpace(req.Resolution))
	req.AspectRatio = strings.TrimSpace(req.AspectRatio)
	req.PromptExpansionMode = strings.ToLower(strings.TrimSpace(req.PromptExpansionMode))
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	if err := validateRestyleURL(req.VideoURL); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if err := characterSwapMediaKind(req.VideoURL, "video"); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if req.ImageURL != "" {
		if err := validateRestyleURL(req.ImageURL); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
		if err := characterSwapMediaKind(req.ImageURL, "image"); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
	} else if req.CharacterPrompt == "" {
		return fmt.Errorf("character_prompt is required when image_url is not supplied")
	}
	if req.Prompt == "" {
		req.Prompt = characterSwapDefaultVideoPrompt
	}
	if len(req.Prompt) > 4000 || len(req.CharacterPrompt) > 4000 {
		return fmt.Errorf("prompts must be at most 4000 characters")
	}
	if req.Resolution == "" {
		req.Resolution = "768P"
	}
	if _, ok := characterSwapRates[req.Resolution]; !ok {
		return fmt.Errorf("resolution must be 768P or 2K")
	}
	if req.AspectRatio == "" {
		req.AspectRatio = "adaptive"
	}
	if !videoStringIn(req.AspectRatio, "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16") {
		return fmt.Errorf("unsupported aspect_ratio")
	}
	if req.PromptExpansionMode == "" {
		req.PromptExpansionMode = "disabled"
	}
	if !videoStringIn(req.PromptExpansionMode, "disabled", "fast", "balanced", "quality") {
		return fmt.Errorf("prompt_expansion_mode must be disabled, fast, balanced, or quality")
	}
	if req.Duration < 0 || req.Duration > characterSwapMaxSeconds {
		return fmt.Errorf("duration must be between %d and %d seconds", characterSwapMinSeconds, characterSwapMaxSeconds)
	}
	return nil
}

// planCharacterSwapChunks splits the source into equal segments of at most
// 4.5 s. H3 drifts back toward the reference footage the longer a clip runs,
// so short clips leak far less, and each 5 s provider clip still carries >=0.5 s
// of slack that is trimmed off the head (the model copies the reference
// video's opening frames). Cost per source second is unchanged.
func planCharacterSwapChunks(seconds float64) ([]characterSwapChunk, error) {
	if seconds < characterSwapMinSeconds-0.05 {
		return nil, fmt.Errorf("source video must be at least %d seconds", characterSwapMinSeconds)
	}
	if seconds > characterSwapMaxSeconds+0.5 {
		return nil, fmt.Errorf("source video must be at most %d seconds; trim it first", characterSwapMaxSeconds)
	}
	seconds = math.Min(seconds, characterSwapMaxSeconds)
	count := int(math.Ceil(seconds / characterSwapSegmentSeconds))
	if count < 1 || seconds <= characterSwapMinSeconds {
		count = 1
	}
	length := seconds / float64(count)
	chunks := make([]characterSwapChunk, 0, count)
	for i := 0; i < count; i++ {
		start := float64(i) * length
		duration := int(math.Ceil(length + characterSwapMinSlack))
		if duration < characterSwapMinSeconds {
			duration = characterSwapMinSeconds
		}
		if duration > characterSwapChunkSeconds {
			duration = characterSwapChunkSeconds
		}
		chunks = append(chunks, characterSwapChunk{Index: i, Start: start, Length: length, Duration: duration})
	}
	return chunks, nil
}

func characterSwapProviderUSD(resolution string, chunks []characterSwapChunk) float64 {
	rate := characterSwapRates[resolution]
	total := 0.0
	for _, chunk := range chunks {
		total += rate * float64(chunk.Duration)
	}
	return total
}

func characterSwapEstimate(req ServiceUsageRequest, seconds float64) (float64, float64, []characterSwapChunk, error) {
	chunks, err := planCharacterSwapChunks(seconds)
	if err != nil {
		return 0, 0, nil, err
	}
	charged := math.Ceil(characterSwapProviderUSD(req.Resolution, chunks)*characterSwapMarkup*100) / 100
	if req.ImageURL == "" {
		charged += servicePricesUSD["gpt_image"]
	}
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(charged / price)
	}
	return charged, credits, chunks, nil
}

func handleCharacterSwapEstimate(ctx *fasthttp.RequestCtx) {
	if _, err := videoJobUser(ctx); err != nil {
		jsonError(ctx, http.StatusUnauthorized, "invalid credentials")
		return
	}
	var req ServiceUsageRequest
	if err := json.Unmarshal(ctx.PostBody(), &req); err != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := normalizeCharacterSwapRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	seconds := float64(req.Duration)
	if seconds <= 0 {
		probed, err := probeRemoteVideoSeconds(req.VideoURL)
		if err != nil {
			jsonError(ctx, http.StatusBadRequest, "could not read the source video duration")
			return
		}
		seconds = probed
	}
	usd, credits, chunks, err := characterSwapEstimate(req, seconds)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"estimated_cost_usd": usd, "estimated_credits": credits,
		"source_seconds": math.Round(seconds*100) / 100, "chunks": len(chunks),
		"resolution": req.Resolution, "image_included": req.ImageURL == "",
		"image_cost_usd": servicePricesUSD["gpt_image"], "rate_usd_per_second": characterSwapRates[req.Resolution] * characterSwapMarkup,
	})
}

func handleCharacterSwapService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeCharacterSwapRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if falAPIKey == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "character swap video is not configured")
		return
	}
	seconds, err := probeRemoteVideoSeconds(req.VideoURL)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not read the source video; supply a public MP4/WebM URL")
		return
	}
	estimatedUSD, estimatedCredits, chunks, err := characterSwapEstimate(req, seconds)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if !user.UnlimitedAPI && user.Credits < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: this swap needs about %.0f credits ($%.2f)", estimatedCredits, estimatedUSD))
		return
	}
	state := characterSwapState{
		Request: req, Stage: "frame", SourceSeconds: seconds, Chunks: chunks,
		EstimatedUSD: estimatedUSD, EstimatedCredits: estimatedCredits,
	}
	if req.ImageURL != "" {
		state.Stage = "video"
		state.SwappedImageURL = req.ImageURL
	} else {
		imageUSD := servicePricesUSD["gpt_image"]
		imageCredits := 0.0
		if price := getCUTEPriceUSD(); price > 0 {
			imageCredits = math.Ceil(imageUSD / price)
		}
		if !user.UnlimitedAPI {
			if _, err := dbConn.DeductUserCredits(user.ID, imageCredits); err != nil {
				jsonError(ctx, http.StatusPaymentRequired, "insufficient credits for the GPT Image 2 character frame")
				return
			}
			state.ImageCredits = imageCredits
			state.ImageUSD = imageUSD
		}
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:character-swap", characterSwapService, req.Prompt)
	if err != nil {
		refundCharacterSwapImage(user.ID, state)
		jsonError(ctx, http.StatusInternalServerError, "failed to create character swap job")
		return
	}
	if err := persistCharacterSwapState(job.ID, "queued", state); err != nil {
		refundCharacterSwapImage(user.ID, state)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist character swap job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": characterSwapService,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID, "stage": state.Stage,
		},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"source_seconds": math.Round(seconds*100) / 100, "chunks": len(chunks),
		"settlement": "final price based on generated seconds",
	})
}

func refundCharacterSwapImage(userID string, state characterSwapState) {
	if state.ImageCredits > 0 {
		_, _ = dbConn.AddUserCredits(userID, state.ImageCredits)
	}
}

func readCharacterSwapState(job *VideoJob) (characterSwapState, error) {
	var envelope characterSwapEnvelope
	if err := json.Unmarshal(job.Result, &envelope); err != nil {
		return characterSwapState{}, err
	}
	if envelope.State.Request.VideoURL == "" {
		return characterSwapState{}, fmt.Errorf("saved character swap request is invalid")
	}
	return envelope.State, nil
}

func persistCharacterSwapState(jobID, status string, state characterSwapState) error {
	persisted, _ := json.Marshal(characterSwapEnvelope{State: state})
	return dbConn.UpdateVideoJob(jobID, status, persisted, "")
}

func failCharacterSwap(job *VideoJob, state characterSwapState, refundImage bool, message string) {
	if refundImage {
		refundCharacterSwapImage(job.UserID, state)
	}
	log.Printf("[character-swap] job=%s failed: %s", job.ID, message)
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, message)
}

func processCharacterSwapJob(job *VideoJob) {
	state, err := readCharacterSwapState(job)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved character swap request is invalid")
		return
	}
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil || user == nil {
		failCharacterSwap(job, state, true, "job owner not found")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), characterSwapJobTimeout)
	defer cancel()
	workDir, err := os.MkdirTemp("", "character-swap-")
	if err != nil {
		failCharacterSwap(job, state, true, "could not allocate scratch space")
		return
	}
	defer os.RemoveAll(workDir)

	_ = persistCharacterSwapState(job.ID, "processing", state)
	sourcePath := filepath.Join(workDir, "source.mp4")
	if err := downloadURLToFile(ctx, state.Request.VideoURL, sourcePath); err != nil {
		failCharacterSwap(job, state, true, "could not download the source video")
		return
	}

	if state.SwappedImageURL == "" {
		if state.FrameURL == "" {
			framePath := filepath.Join(workDir, "frame.png")
			frameAt := "0"
			if state.SourceSeconds > 4 {
				frameAt = "2"
			}
			if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", frameAt, "-i", sourcePath, "-frames:v", "1", "-update", "1", framePath); err != nil {
				failCharacterSwap(job, state, true, "could not extract the first frame")
				return
			}
			frameURL, err := uploadCharacterSwapFile(ctx, framePath, job.UserID, "image/png")
			if err != nil {
				failCharacterSwap(job, state, true, "could not store the reference frame")
				return
			}
			state.FrameURL = frameURL
			state.Stage = "image"
			_ = persistCharacterSwapState(job.ID, "processing", state)
		}
		if videoJobCancellationRequested(job.ID) {
			refundCharacterSwapImage(job.UserID, state)
			return
		}
		swapped, err := generateCharacterSwapImage(user, state)
		if err != nil {
			failCharacterSwap(job, state, true, "GPT Image 2 could not produce the character frame: "+truncateString(err.Error(), 160))
			return
		}
		state.SwappedImageURL = swapped
		state.Stage = "video"
		_ = persistCharacterSwapState(job.ID, "processing", state)
	}

	if videoJobCancellationRequested(job.ID) {
		return
	}
	if err := prepareCharacterSwapChunks(ctx, job, &state, sourcePath, workDir); err != nil {
		failCharacterSwap(job, state, false, err.Error())
		return
	}
	if err := runCharacterSwapChunks(ctx, job, &state, workDir); err != nil {
		failCharacterSwap(job, state, false, err.Error())
		return
	}
	if videoJobCancellationRequested(job.ID) {
		return
	}
	state.Stage = "mux"
	_ = persistCharacterSwapState(job.ID, "processing", state)
	outputPath, err := muxCharacterSwapVideo(ctx, state, sourcePath, workDir)
	if err != nil {
		failCharacterSwap(job, state, false, "could not assemble the final video: "+truncateString(err.Error(), 200))
		return
	}
	outputURL, err := uploadCharacterSwapFile(ctx, outputPath, job.UserID, "video/mp4")
	if err != nil {
		failCharacterSwap(job, state, false, "could not publish the final video")
		return
	}
	settleCharacterSwap(job, state, outputURL, outputPath)
}

func generateCharacterSwapImage(user *User, state characterSwapState) (string, error) {
	prompt := state.Request.CharacterPrompt
	if prompt == "" {
		prompt = state.Request.Prompt
	}
	req := ServiceUsageRequest{Service: "image_edit", Prompt: prompt, ImageURL: state.FrameURL, Width: 1536, Height: 1024}
	result, err := proxyOpenPathsImageEdit(req)
	if err != nil {
		return "", err
	}
	result, _ = persistGeneratedZImage(req, user, result)
	for _, candidate := range extractPayloadImageURLs(result) {
		if strings.HasPrefix(candidate, "https://") {
			return candidate, nil
		}
	}
	return "", fmt.Errorf("no hosted image was returned")
}

func prepareCharacterSwapChunks(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) error {
	for i := range state.Chunks {
		chunk := &state.Chunks[i]
		if chunk.SourceURL != "" {
			continue
		}
		chunkPath := filepath.Join(workDir, fmt.Sprintf("chunk-%02d.mp4", chunk.Index))
		args := []string{"-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start), "-i", sourcePath, "-t", trimSeconds(chunk.Length),
			"-an", "-vf", "fps=24,scale='min(1920,iw)':-2,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", chunkPath}
		if err := lofiloop.RunFFmpeg(ctx, args...); err != nil {
			return fmt.Errorf("could not cut the source into reference clips")
		}
		sourceURL, err := uploadCharacterSwapFile(ctx, chunkPath, job.UserID, "video/mp4")
		if err != nil {
			return fmt.Errorf("could not store a reference clip")
		}
		chunk.SourceURL = sourceURL
		chunk.Status = "prepared"
	}
	return persistCharacterSwapState(job.ID, "processing", *state)
}

func characterSwapFalInput(state characterSwapState, chunk characterSwapChunk) map[string]interface{} {
	input := map[string]interface{}{
		"prompt":                state.Request.Prompt,
		"reference_image_urls":  []string{state.SwappedImageURL},
		"reference_video_urls":  []string{chunk.SourceURL},
		"duration":              chunk.Duration,
		"resolution":            state.Request.Resolution,
		"aspect_ratio":          state.Request.AspectRatio,
		"prompt_expansion_mode": state.Request.PromptExpansionMode,
		"enable_safety_checker": true,
	}
	if state.Request.Seed != 0 {
		input["seed"] = state.Request.Seed + chunk.Index
	}
	return input
}

func runCharacterSwapChunks(ctx context.Context, job *VideoJob, state *characterSwapState, workDir string) error {
	var mu sync.Mutex
	var wg sync.WaitGroup
	errs := make([]error, len(state.Chunks))
	persist := func() {
		mu.Lock()
		defer mu.Unlock()
		_ = persistCharacterSwapState(job.ID, "processing", *state)
	}
	for i := range state.Chunks {
		if state.Chunks[i].OutputURL != "" {
			continue
		}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			mu.Lock()
			chunk := state.Chunks[i]
			mu.Unlock()
			if chunk.RequestID == "" {
				data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+characterSwapFalPath, characterSwapFalInput(*state, chunk))
				if err != nil {
					errs[i] = fmt.Errorf("video service rejected clip %d", chunk.Index+1)
					return
				}
				var queued falQueueResponse
				if err := json.Unmarshal(data, &queued); err != nil || queued.RequestID == "" {
					errs[i] = fmt.Errorf("video service returned no job for clip %d", chunk.Index+1)
					return
				}
				mu.Lock()
				state.Chunks[i].RequestID = queued.RequestID
				state.Chunks[i].Status = "queued"
				mu.Unlock()
				persist()
				chunk.RequestID = queued.RequestID
			}
			outputURL, err := waitCharacterSwapChunk(ctx, job.ID, chunk.RequestID)
			if err != nil {
				errs[i] = fmt.Errorf("clip %d: %w", chunk.Index+1, err)
				return
			}
			passUSD := characterSwapRates[state.Request.Resolution] * float64(chunk.Duration)
			mu.Lock()
			state.Chunks[i].OutputURL = outputURL
			state.Chunks[i].Status = "checking"
			state.Chunks[i].ProviderUSD += passUSD
			mu.Unlock()
			persist()
			localPath := filepath.Join(workDir, fmt.Sprintf("out-%02d.mp4", chunk.Index))
			leaked, reason := false, ""
			if characterSwapQAEnabled() {
				if err := downloadURLToFile(ctx, outputURL, localPath); err == nil {
					leaked, reason = checkCharacterSwapClip(ctx, *state, localPath)
				}
			}
			bestLeakCount := 0
			if leaked {
				bestLeakCount = characterSwapLeakCount(reason)
			}
			for attempt := 1; leaked && attempt <= characterSwapMaxRetries && !videoJobCancellationRequested(job.ID); attempt++ {
				log.Printf("[character-swap] job=%s clip %d leaked source performers (%s); regenerating (attempt %d)", job.ID, chunk.Index+1, reason, attempt)
				retryInput := characterSwapFalInput(*state, chunk)
				retryInput["seed"] = int(time.Now().UnixNano()%2_000_000_000) + chunk.Index + attempt
				data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+characterSwapFalPath, retryInput)
				if err != nil {
					break
				}
				var queued falQueueResponse
				if json.Unmarshal(data, &queued) != nil || queued.RequestID == "" {
					break
				}
				retryURL, err := waitCharacterSwapChunk(ctx, job.ID, queued.RequestID)
				if err != nil {
					break
				}
				mu.Lock()
				state.Chunks[i].ProviderUSD += passUSD
				state.Chunks[i].Retries++
				mu.Unlock()
				persist()
				retryPath := filepath.Join(workDir, fmt.Sprintf("out-%02d-retry%d.mp4", chunk.Index, attempt))
				if err := downloadURLToFile(ctx, retryURL, retryPath); err != nil {
					continue
				}
				retryLeaked, retryReason := checkCharacterSwapClip(ctx, *state, retryPath)
				if !retryLeaked {
					outputURL, localPath, leaked, reason = retryURL, retryPath, false, fmt.Sprintf("regenerated on attempt %d: %s", attempt, reason)
					break
				}
				if count := characterSwapLeakCount(retryReason); count < bestLeakCount {
					outputURL, localPath, bestLeakCount, reason = retryURL, retryPath, count, "kept least-leaking attempt: "+retryReason
				}
			}
			mu.Lock()
			state.Chunks[i].OutputURL = outputURL
			state.Chunks[i].LocalPath = localPath
			state.Chunks[i].Status = "completed"
			state.Chunks[i].QAReason = reason
			mu.Unlock()
			persist()
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}

func waitCharacterSwapChunk(ctx context.Context, jobID, requestID string) (string, error) {
	base := "https://queue.fal.run/" + characterSwapFalRequestBase + "/requests/" + url.PathEscape(requestID)
	deadline := time.Now().Add(characterSwapChunkTimeout)
	for time.Now().Before(deadline) {
		if ctx.Err() != nil {
			return "", fmt.Errorf("timed out")
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
					return "", fmt.Errorf("completed clip could not be retrieved")
				}
				var payload map[string]interface{}
				if err := json.Unmarshal(result, &payload); err != nil {
					return "", fmt.Errorf("video service returned an invalid result")
				}
				if video, ok := payload["video"].(map[string]interface{}); ok {
					if outputURL, _ := video["url"].(string); outputURL != "" {
						return outputURL, nil
					}
				}
				return "", fmt.Errorf("video service returned no clip")
			case "failed", "cancelled", "canceled":
				return "", fmt.Errorf("video generation failed")
			}
		}
		time.Sleep(3 * time.Second)
	}
	return "", fmt.Errorf("video generation did not finish in time")
}

// muxCharacterSwapVideo trims each generated clip to its source segment, drops
// the provider's copied head frames, concatenates the clips at 24 fps, and
// lays the untouched original soundtrack back over the result.
func muxCharacterSwapVideo(ctx context.Context, state characterSwapState, sourcePath, workDir string) (string, error) {
	characterSwapRenderSlots <- struct{}{}
	defer func() { <-characterSwapRenderSlots }()
	args := []string{"-y", "-loglevel", "error"}
	var filter strings.Builder
	for i, chunk := range state.Chunks {
		clipPath := chunk.LocalPath
		if info, err := os.Stat(clipPath); clipPath == "" || err != nil || info.Size() == 0 {
			clipPath = filepath.Join(workDir, fmt.Sprintf("out-%02d.mp4", chunk.Index))
			if err := downloadURLToFile(ctx, chunk.OutputURL, clipPath); err != nil {
				return "", fmt.Errorf("download clip %d: %w", chunk.Index+1, err)
			}
		}
		args = append(args, "-i", clipPath)
		trimStart := characterSwapHeadTrim
		if clipSeconds, err := lofiloop.ProbeDurationSeconds(ctx, clipPath); err == nil {
			trimStart = math.Max(0, math.Min(characterSwapMaxHeadTrim, clipSeconds-chunk.Length))
		}
		fmt.Fprintf(&filter, "[%d:v]trim=start=%s,setpts=PTS-STARTPTS,fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=1,trim=duration=%s,setpts=PTS-STARTPTS[v%d];",
			i, trimSeconds(trimStart), trimSeconds(chunk.Length), i)
	}
	for i := range state.Chunks {
		fmt.Fprintf(&filter, "[v%d]", i)
	}
	fmt.Fprintf(&filter, "concat=n=%d:v=1:a=0,format=yuv420p[v]", len(state.Chunks))
	args = append(args, "-i", sourcePath, "-filter_complex", filter.String(),
		"-map", "[v]", "-map", fmt.Sprintf("%d:a:0?", len(state.Chunks)),
		"-t", trimSeconds(state.SourceSeconds),
		"-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", "24",
		"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart",
		filepath.Join(workDir, "final.mp4"))
	if err := lofiloop.RunFFmpeg(ctx, args...); err != nil {
		return "", err
	}
	return filepath.Join(workDir, "final.mp4"), nil
}

func settleCharacterSwap(job *VideoJob, state characterSwapState, outputURL, outputPath string) {
	chargedUSD := math.Ceil(characterSwapProviderUSD(state.Request.Resolution, state.Chunks)*characterSwapMarkup*100) / 100
	providerUSD, retries := 0.0, 0
	for _, chunk := range state.Chunks {
		providerUSD += chunk.ProviderUSD
		retries += chunk.Retries
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	duration, _ := lofiloop.ProbeDurationSeconds(context.Background(), outputPath)
	result := map[string]interface{}{
		"_character_swap":   state,
		"video_url":         outputURL,
		"swapped_image_url": state.SwappedImageURL,
		"frame_url":         state.FrameURL,
		"stage":             "completed",
		"duration_seconds":  math.Round(duration*100) / 100,
		"chunks":            len(state.Chunks),
		"clip_retries":      retries,
		"resolution":        state.Request.Resolution,
		"fps":               24,
		"format":            "mp4/h264+aac",
		"provider_cost_usd": providerUSD,
		"charged_usd":       chargedUSD,
		"image_charged_usd": state.ImageUSD,
		"cute_price_usd":    cutePrice,
		"credits_used":      chargedUSD/cutePrice + state.ImageCredits,
	}
	payload, _ := json.Marshal(result)
	_, _, err := dbConn.SettleGeneratedVideoJob(job.ID, payload, providerUSD, chargedUSD, cutePrice)
	if err == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release the completed video; $%.2f required", chargedUSD))
		return
	}
	if err != nil {
		log.Printf("[character-swap] settlement failed job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, payload)
	maybeTriggerAutoTopup(job.UserID)
}

func exposePublicCharacterSwapStatus(payload map[string]interface{}) {
	internal, ok := payload["_character_swap"].(map[string]interface{})
	if !ok {
		return
	}
	if stage, ok := internal["stage"].(string); ok && stage != "" {
		if _, exists := payload["stage"]; !exists {
			payload["stage"] = stage
		}
	}
	for _, key := range []string{"swapped_image_url", "frame_url"} {
		if value, ok := internal[key].(string); ok && strings.HasPrefix(value, "https://") {
			payload[key] = value
		}
	}
	if chunks, ok := internal["chunks"].([]interface{}); ok {
		done := 0
		for _, raw := range chunks {
			if chunk, ok := raw.(map[string]interface{}); ok && chunk["status"] == "completed" {
				done++
			}
		}
		payload["chunks_total"] = len(chunks)
		payload["chunks_completed"] = done
	}
}

func uploadCharacterSwapFile(ctx context.Context, path, userID, contentType string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	if info.Size() <= 0 || info.Size() > characterSwapMaxArtifact {
		return "", fmt.Errorf("artifact size %d is invalid", info.Size())
	}
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	extension := map[string]string{"video/mp4": "mp4", "image/png": "png"}[contentType]
	if extension == "" {
		extension = "bin"
	}
	objectKey := fmt.Sprintf("%s/%s/character-swap/%s.%s", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), extension)
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
		return "", fmt.Errorf("R2 upload returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func probeRemoteVideoSeconds(videoURL string) (float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	dir, err := os.MkdirTemp("", "character-swap-probe-")
	if err != nil {
		return 0, err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "probe.mp4")
	if err := downloadURLToFile(ctx, videoURL, path); err != nil {
		return 0, err
	}
	return lofiloop.ProbeDurationSeconds(ctx, path)
}

var characterSwapImageExtensions = map[string]bool{
	".avif": true, ".bmp": true, ".gif": true, ".heic": true, ".heif": true,
	".jpeg": true, ".jpg": true, ".png": true, ".tif": true, ".tiff": true, ".webp": true,
}

var characterSwapVideoExtensions = map[string]bool{
	".avi": true, ".m4v": true, ".mkv": true, ".mov": true, ".mp4": true,
	".mpeg": true, ".mpg": true, ".ogv": true, ".webm": true,
}

func characterSwapMediaKind(value, expected string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return fmt.Errorf("invalid media URL")
	}
	ext := strings.ToLower(path.Ext(parsed.Path))
	if expected == "video" && characterSwapImageExtensions[ext] {
		return fmt.Errorf("expected a video file, got image extension %s", ext)
	}
	if expected == "image" && characterSwapVideoExtensions[ext] {
		return fmt.Errorf("expected an image file, got video extension %s", ext)
	}
	return nil
}

// characterSwapLeakCount parses the "frames [a b c]" prefix written by the QA
// check so retries can keep the least-leaking attempt.
func characterSwapLeakCount(reason string) int {
	start := strings.Index(reason, "[")
	end := strings.Index(reason, "]")
	if start < 0 || end <= start {
		return 0
	}
	return len(strings.Fields(reason[start+1 : end]))
}

func trimSeconds(value float64) string {
	return fmt.Sprintf("%.3f", value)
}
