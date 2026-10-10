package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

// The orbit lane turns one photo into a frozen-time 360 degree camera orbit:
// MiniMax H3 FL2VA plus the MiniMax-H3-360-Orbit-LoRA at strength 1.0, with
// the photo pinned as both the first and the last keyframe so the clip closes
// on its own first frame. Worker: workers/h3-orbit.
const (
	orbitVideoService      = "orbit_video"
	orbitDefaultSteps      = 28
	orbitFrames            = 73
	orbitSize              = 768
	orbitDefaultGPUUSDPerS = 0.00126
	orbitPriceUSD          = 0.50
)

const orbitDefaultPrompt = "One frozen instant. Only the camera moves. In a continuous 360 orbit. Preserve every person and object in exactly the same world position, orientation, shape and pose throughout the shot. Airborne objects remain suspended at the captured height and angle: no wobbling, shaking, spinning, drifting, falling or continued action. Keep faces, hands, clothing, liquids and the background motionless while retaining their natural appearance. Camera parallax is the only source of apparent movement. No cuts, zoom, morphing or added objects."

type orbitStoredRequest struct {
	Input ServiceUsageRequest `json:"input"`
}

func orbitEndpointID() string {
	return strings.TrimSpace(os.Getenv("H3_ORBIT_RUNPOD_ENDPOINT_ID"))
}

func normalizeOrbitRequest(req *ServiceUsageRequest) error {
	req.Service = orbitVideoService
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.ImageURL == "" {
		return fmt.Errorf("image_url is required")
	}
	if err := validateRestyleURL(req.ImageURL); err != nil {
		return fmt.Errorf("image_url: %w", err)
	}
	if err := validateRestyleMediaKind(req.ImageURL, "image"); err != nil {
		return fmt.Errorf("image_url: %w", err)
	}
	if req.Prompt == "" {
		req.Prompt = orbitDefaultPrompt
	}
	if len(req.Prompt) > 2000 {
		return fmt.Errorf("prompt must be at most 2000 characters")
	}
	if req.NumSteps == 0 {
		req.NumSteps = orbitDefaultSteps
	}
	if req.NumSteps < 8 || req.NumSteps > 40 {
		return fmt.Errorf("num_steps must be between 8 and 40")
	}
	return nil
}

func orbitEstimate() (float64, float64) {
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(orbitPriceUSD / price)
	}
	return orbitPriceUSD, credits
}

func orbitUploadTarget(user *User) (string, string, error) {
	shortID := sanitizeUploadName(user.ID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	objectKey := fmt.Sprintf("%s/%s/orbit-video/%s.mp4", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID())
	uploadURL, err := presignR2PutObject(objectKey, "video/mp4", 3*60*60)
	if err != nil {
		return "", "", err
	}
	return uploadURL, fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func orbitWorkerInput(req ServiceUsageRequest, uploadURL, publicURL string) map[string]interface{} {
	input := map[string]interface{}{
		"image_url": req.ImageURL, "prompt": req.Prompt, "steps": req.NumSteps, "frames": orbitFrames, "size": orbitSize,
		"lora_strength": 1.0, "_output_upload_url": uploadURL, "_output_public_url": publicURL,
	}
	if req.Seed != 0 {
		input["seed"] = req.Seed
	}
	return input
}

func submitOrbitVideo(req ServiceUsageRequest, user *User) (string, error) {
	endpointID := orbitEndpointID()
	if endpointID == "" {
		return "", fmt.Errorf("orbit endpoint is not configured")
	}
	uploadURL, publicURL, err := orbitUploadTarget(user)
	if err != nil {
		return "", err
	}
	var queued h3RunpodQueuedJob
	status, err := submitCharacterAnimationRunpod(endpointID, "standard", orbitWorkerInput(req, uploadURL, publicURL), &queued)
	if err != nil {
		return "", err
	}
	if queued.ID == "" {
		return "", fmt.Errorf("orbit endpoint returned no job (status %d)", status)
	}
	return "runpod-orbit:" + endpointID + ":" + queued.ID, nil
}

func parseOrbitProviderID(value string) (endpointID, jobID string, ok bool) {
	parts := strings.SplitN(value, ":", 3)
	if len(parts) != 3 || parts[0] != "runpod-orbit" || parts[1] == "" || parts[2] == "" {
		return "", "", false
	}
	return parts[1], parts[2], true
}

func cancelOrbitProvider(providerID string) {
	endpointID, jobID, ok := parseOrbitProviderID(providerID)
	if !ok {
		return
	}
	_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(jobID), http.MethodPost, nil, nil)
	scheduleCharacterAnimationScaleToZero(endpointID, "standard")
}

func orbitGPUUSDPerSecond() float64 {
	return restyleEnvFloat("H3_ORBIT_GPU_USD_PER_SECOND", orbitDefaultGPUUSDPerS)
}

func handleOrbitVideoService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeOrbitRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if orbitEndpointID() == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "orbit video is not configured")
		return
	}
	if rejectArchivedLane(ctx, orbitEndpointID()) {
		return
	}
	estimatedUSD, estimatedCredits := orbitEstimate()
	if estimatedCredits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if !user.UnlimitedAPI && user.Credits+1e-9 < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits ($%.2f), have %.2f", estimatedCredits, estimatedUSD, user.Credits))
		return
	}
	providerID, err := submitOrbitVideo(req, user)
	if err != nil {
		log.Printf("[orbit] submit failed: %v", err)
		jsonError(ctx, http.StatusServiceUnavailable, "orbit video is temporarily unavailable")
		return
	}
	stored, _ := json.Marshal(orbitStoredRequest{Input: req})
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, orbitVideoService, req.Prompt)
	if err != nil {
		cancelOrbitProvider(providerID)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist orbit job")
		return
	}
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		cancelOrbitProvider(providerID)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist orbit input")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service":            orbitVideoService,
		"result":             map[string]interface{}{"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"settlement": "fixed price confirmed before generation",
	})
}

func processOrbitVideoJob(job *VideoJob) {
	var stored orbitStoredRequest
	if json.Unmarshal(job.Result, &stored) != nil || normalizeOrbitRequest(&stored.Input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved orbit request is invalid")
		return
	}
	endpointID, providerJobID, ok := parseOrbitProviderID(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "orbit provider job is invalid")
		return
	}
	defer scheduleCharacterAnimationScaleToZero(endpointID, "standard")
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(90 * time.Minute)
	for time.Now().Before(deadline) {
		if videoJobCancellationRequested(job.ID) {
			cancelOrbitProvider(job.ProviderJobID)
			return
		}
		var state characterAnimationRunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state); err != nil {
			time.Sleep(3 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED", "SUCCEEDED":
			if strings.TrimSpace(state.Output.VideoURL) == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "orbit video was blocked or returned no playable video")
				return
			}
			providerUSD := orbitGPUUSDPerSecond() * float64(state.ExecutionTime) / 1000
			if providerUSD <= 0 {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "orbit video returned no metered execution time")
				return
			}
			chargedUSD, _ := orbitEstimate()
			log.Printf("[orbit] job=%s charged_usd=%.4f metered_usd=%.4f execution_seconds=%.1f", job.ID, chargedUSD, providerUSD, float64(state.ExecutionTime)/1000)
			settleOrbitVideo(job, state, providerUSD, chargedUSD)
			return
		case "FAILED", "CANCELLED", "CANCELED", "TIMED_OUT":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "orbit video generation failed")
			return
		}
		time.Sleep(3 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "orbit video did not finish in time")
}

func settleOrbitVideo(job *VideoJob, state characterAnimationRunpodStatus, providerUSD, chargedUSD float64) {
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	resultMap := map[string]interface{}{
		"video_url": state.Output.VideoURL, "duration_seconds": state.Output.DurationSeconds,
		"content_type": state.Output.ContentType, "provider_cost_usd": providerUSD,
		"charged_usd": chargedUSD, "cute_price_usd": cutePrice, "credits_used": chargedUSD / cutePrice,
	}
	result, _ := json.Marshal(resultMap)
	_, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
	if err == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.2f required", chargedUSD))
		return
	}
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
}
