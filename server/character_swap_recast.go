package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/valyala/fasthttp"

	"manifoldgen-site/lofiloop"
)

const (
	characterSwapRecastKind = "recast"
	characterSwapRecastPath = "minimax/h3-max/recast"
	recastMaxSeconds        = 30
	recastMaxShotSeconds    = 15.5
	recastMaxPeople         = 4
	recastEngineFal         = "fal"
	recastEngineLora        = "lora"
)

// fal bills $0.30/s at 768P and $0.45/s at 1080P. The public price is at
// least 20% above that and above the self-hosted LoRA lane at 768p standard,
// which is the internal fallback when fal fails.
var recastFalUSDPerSecond = map[string]float64{"768P": 0.30, "1080P": 0.45}
var recastPriceUSDPerSecond = map[string]float64{"768P": 0.62, "1080P": 0.70}

type recastState struct {
	Engine     string `json:"engine"`
	FallbackOK bool   `json:"fallback_ok"`
	FalError   string `json:"fal_error,omitempty"`
}

func characterSwapIsRecast(req ServiceUsageRequest) bool {
	return strings.EqualFold(strings.TrimSpace(req.Kind), characterSwapRecastKind)
}

func normalizeCharacterSwapRecast(req *ServiceUsageRequest) error {
	req.Kind = characterSwapRecastKind
	refs := make([]string, 0, recastMaxPeople)
	for _, candidate := range req.ReferenceImageURLs {
		if candidate = strings.TrimSpace(candidate); candidate != "" {
			refs = append(refs, candidate)
		}
	}
	if len(refs) == 0 && req.ImageURL != "" {
		refs = append(refs, req.ImageURL)
	}
	if len(refs) == 0 {
		return fmt.Errorf("reference_image_urls needs one photo per new person")
	}
	if len(refs) > recastMaxPeople {
		return fmt.Errorf("reference_image_urls accepts at most %d photos", recastMaxPeople)
	}
	for _, ref := range refs {
		if err := validateRestyleURL(ref); err != nil {
			return fmt.Errorf("reference_image_urls: %w", err)
		}
		if err := characterSwapMediaKind(ref, "image"); err != nil {
			return fmt.Errorf("reference_image_urls: %w", err)
		}
	}
	req.ReferenceImageURLs = refs
	if req.Resolution == "" {
		req.Resolution = "1080P"
	}
	if _, ok := recastPriceUSDPerSecond[req.Resolution]; !ok {
		return fmt.Errorf("resolution must be 768P or 1080P")
	}
	if len(req.Prompt) > 2000 {
		return fmt.Errorf("prompt must be at most 2000 characters")
	}
	if req.Duration < 0 || req.Duration > recastMaxSeconds {
		return fmt.Errorf("duration must be between %d and %d seconds", characterSwapMinSeconds, recastMaxSeconds)
	}
	return nil
}

func recastChargeUSD(resolution string, seconds float64) float64 {
	return math.Ceil(recastPriceUSDPerSecond[resolution]*math.Max(seconds, characterSwapMinSeconds)*100) / 100
}

func recastLongestShot(seconds float64, cuts []float64) float64 {
	longest, prev := 0.0, 0.0
	for _, cut := range cuts {
		if cut > prev && cut < seconds {
			longest = math.Max(longest, cut-prev)
			prev = cut
		}
	}
	return math.Max(longest, seconds-prev)
}

func recastEstimate(req ServiceUsageRequest, seconds float64) (float64, float64, error) {
	if seconds < characterSwapMinSeconds-0.05 {
		return 0, 0, fmt.Errorf("source video must be at least %d seconds", characterSwapMinSeconds)
	}
	if seconds > recastMaxSeconds+0.5 {
		return 0, 0, fmt.Errorf("source video must be at most %d seconds; trim it first", recastMaxSeconds)
	}
	charged := recastChargeUSD(req.Resolution, math.Min(seconds, recastMaxSeconds))
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(charged / price)
	}
	return charged, credits, nil
}

func recastFallbackAvailable(ctx *fasthttp.RequestCtx) bool {
	endpoint := characterSwapLoraEndpointID()
	return endpoint != "" && !runpodEndpointArchived(endpoint)
}

func handleRecastEstimate(ctx *fasthttp.RequestCtx, req ServiceUsageRequest) {
	seconds, cuts, err := probeRemoteVideo(req.VideoURL)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not read the source video duration")
		return
	}
	usd, credits, err := recastEstimate(req, seconds)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	longShot := recastLongestShot(seconds, cuts) > recastMaxShotSeconds
	if longShot && !recastFallbackAvailable(ctx) {
		jsonError(ctx, http.StatusBadRequest, "shots must be at most 15 seconds; add a cut or trim the video")
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"estimated_cost_usd": usd, "estimated_credits": credits, "kind": characterSwapRecastKind,
		"source_seconds": math.Round(seconds*100) / 100, "people": len(req.ReferenceImageURLs), "resolution": req.Resolution,
		"rate_usd_per_second": recastPriceUSDPerSecond[req.Resolution], "estimated_generation_seconds": 150 + int(8*seconds),
	})
}

func handleCharacterRecastService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	fallback := recastFallbackAvailable(ctx)
	if falAPIKey == "" && !fallback {
		jsonError(ctx, http.StatusServiceUnavailable, "character recast is not configured")
		return
	}
	seconds, cuts, err := probeRemoteVideo(req.VideoURL)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not read the source video; supply a public MP4/WebM URL")
		return
	}
	estimatedUSD, estimatedCredits, err := recastEstimate(req, seconds)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	engine := recastEngineFal
	if falAPIKey == "" || recastLongestShot(seconds, cuts) > recastMaxShotSeconds {
		if !fallback {
			jsonError(ctx, http.StatusBadRequest, "shots must be at most 15 seconds; add a cut or trim the video")
			return
		}
		engine = recastEngineLora
	}
	if !user.UnlimitedAPI && user.Credits < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: this recast needs about %.0f credits ($%.2f)", estimatedCredits, estimatedUSD))
		return
	}
	state := characterSwapState{
		Request: req, Stage: "video", SourceSeconds: seconds, Cuts: cuts, ChargeUSD: estimatedUSD,
		EstimatedUSD: estimatedUSD, EstimatedCredits: estimatedCredits, Recast: &recastState{Engine: engine, FallbackOK: fallback},
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:character-swap", characterSwapService, req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to create character recast job")
		return
	}
	if err := persistCharacterSwapState(job.ID, "queued", state); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist character recast job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": characterSwapService,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID, "stage": state.Stage,
		},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"source_seconds": math.Round(seconds*100) / 100, "people": len(req.ReferenceImageURLs), "kind": characterSwapRecastKind,
		"settlement": "final price based on source seconds",
	})
}

func recastFalInput(req ServiceUsageRequest) map[string]interface{} {
	input := map[string]interface{}{
		"video_url": req.VideoURL, "reference_image_urls": req.ReferenceImageURLs, "resolution": req.Resolution,
	}
	if req.Prompt != "" {
		input["prompt"] = req.Prompt
	}
	if req.Seed != 0 {
		input["seed"] = req.Seed
	}
	return input
}

func runRecastFal(ctx context.Context, job *VideoJob, state *characterSwapState) (string, error) {
	if len(state.Chunks) == 0 {
		state.Chunks = []characterSwapChunk{{Index: 0, Length: state.SourceSeconds, ShotStart: true}}
	}
	chunk := &state.Chunks[0]
	if chunk.Status == "completed" && chunk.OutputURL != "" {
		return chunk.OutputURL, nil
	}
	if chunk.RequestID == "" {
		data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+characterSwapRecastPath, recastFalInput(state.Request))
		if err != nil {
			return "", fmt.Errorf("recast service rejected the video: %s", truncateString(string(data), 160))
		}
		var queued falQueueResponse
		if err := json.Unmarshal(data, &queued); err != nil || queued.RequestID == "" {
			return "", fmt.Errorf("recast service returned no job")
		}
		chunk.RequestID, chunk.Status = queued.RequestID, "queued"
		_ = persistCharacterSwapState(job.ID, "processing", *state)
	}
	outputURL, err := waitCharacterSwapChunk(ctx, job.ID, chunk.RequestID)
	if err != nil {
		return "", err
	}
	chunk.OutputURL, chunk.Status = outputURL, "completed"
	chunk.ProviderUSD = recastFalUSDPerSecond[state.Request.Resolution] * state.SourceSeconds
	_ = persistCharacterSwapState(job.ID, "processing", *state)
	return outputURL, nil
}

func extractRecastFrame(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) (string, error) {
	framePath := filepath.Join(workDir, "frame.png")
	frameAt := "0"
	if state.SourceSeconds > 4 {
		frameAt = "2"
	}
	if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", frameAt, "-i", sourcePath, "-frames:v", "1", "-update", "1", framePath); err != nil {
		return "", fmt.Errorf("could not extract the first frame")
	}
	frameURL, err := uploadCharacterSwapFile(ctx, framePath, job.UserID, "image/png")
	if err != nil {
		return "", fmt.Errorf("could not store the reference frame")
	}
	state.FrameURL = frameURL
	return framePath, nil
}

const recastFramePrompt = "Edit the first image in place: replace each person with the person shown in the reference photos, matched left to right (reference photo 1 replaces the leftmost person). Keep every replacement in exactly the same position, pose, scale, framing and camera angle as the person it replaces, keeping each reference person's face, hair and outfit. Keep the set, props, lighting and background identical. Output exactly one image, not a collage. Photorealistic."

func generateRecastFallbackFrame(user *User, state characterSwapState, frameW, frameH int) (string, error) {
	prompt := recastFramePrompt
	if state.Request.Prompt != "" {
		prompt += " Direction: " + state.Request.Prompt
	}
	aspect := "16:9"
	if frameH > frameW {
		aspect = "9:16"
	}
	req := ServiceUsageRequest{Service: "openpaths_image", Model: "gpt-image-2", Prompt: prompt, ImageURL: state.FrameURL, ReferenceImageURLs: state.Request.ReferenceImageURLs, AspectRatio: aspect, N: 1}
	blob, err := proxyOpenPathsModelImage(req)
	if err != nil {
		return "", err
	}
	blob, saved := persistGeneratedZImage(req, user, blob)
	if hosted := characterSwapHostedImage(blob, saved); hosted != "" {
		return hosted, nil
	}
	return "", fmt.Errorf("no hosted image was returned")
}

func recastLoraRequest(req ServiceUsageRequest) ServiceUsageRequest {
	lora := req
	lora.Kind, lora.Resolution, lora.ServiceTier, lora.Prompt = characterSwapLoraKind, "768p", "standard", loraDefaultPrompt
	if req.Prompt != "" {
		lora.Prompt += " Direction: " + req.Prompt
	}
	return lora
}

func processCharacterRecast(ctx context.Context, job *VideoJob, user *User, state *characterSwapState, sourcePath, workDir string) {
	if state.Recast == nil {
		state.Recast = &recastState{Engine: recastEngineFal}
	}
	if state.Recast.Engine == recastEngineFal {
		outputURL, err := runRecastFal(ctx, job, state)
		if err == nil {
			localPath := filepath.Join(workDir, "recast-out.mp4")
			if err = downloadURLToFile(ctx, outputURL, localPath); err != nil {
				failCharacterSwap(job, *state, false, "could not download the recast video")
				return
			}
			hosted, err := publishFinalVideo(ctx, localPath, job.UserID, func() (string, error) {
				return uploadCharacterSwapFile(ctx, localPath, job.UserID, "video/mp4")
			})
			if err != nil {
				failCharacterSwap(job, *state, false, "could not publish the final video")
				return
			}
			state.Stage = "mux"
			settleCharacterSwap(job, *state, hosted, localPath)
			return
		}
		if err.Error() == "cancelled" || videoJobCancellationRequested(job.ID) {
			return
		}
		log.Printf("[character-recast] job=%s fal failed: %v", job.ID, err)
		state.Chunks = nil
		if !state.Recast.FallbackOK {
			failCharacterSwap(job, *state, false, "H3 Max recast failed: "+truncateString(err.Error(), 160))
			return
		}
		state.Recast.Engine, state.Recast.FalError = recastEngineLora, truncateString(err.Error(), 200)
		_ = persistCharacterSwapState(job.ID, "processing", *state)
	}

	loraState := *state
	loraState.Request = recastLoraRequest(state.Request)
	loraState.Chunks = nil
	if loraState.SwappedImageURL == "" {
		loraState.Stage = "image"
		if loraState.FrameURL == "" {
			if _, err := extractRecastFrame(ctx, job, &loraState, sourcePath, workDir); err != nil {
				failCharacterSwap(job, loraState, false, err.Error())
				return
			}
		}
		_ = persistCharacterSwapState(job.ID, "processing", loraState)
		frameW, frameH := loraFrameSize(filepath.Join(workDir, "frame.png"))
		swapped, err := generateRecastFallbackFrame(user, loraState, frameW, frameH)
		if err != nil {
			failCharacterSwap(job, loraState, false, "could not draw the new characters: "+truncateString(err.Error(), 160))
			return
		}
		loraState.SwappedImageURL = swapped
	}
	loraState.Stage = "video"
	_ = persistCharacterSwapState(job.ID, "processing", loraState)
	outputURL, outputPath, err := processCharacterSwapLora(ctx, job, &loraState, sourcePath, workDir)
	if err != nil {
		if err.Error() == "cancelled" {
			return
		}
		failCharacterSwap(job, loraState, false, err.Error())
		return
	}
	settleCharacterSwap(job, loraState, outputURL, outputPath)
}
