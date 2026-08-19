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

const characterAnimationStandardUSDPerSecond = 0.15

type characterAnimationStoredRequest struct {
	Input        ServiceUsageRequest `json:"input"`
	DispatchTier string              `json:"dispatch_tier"`
}

type characterAnimationRunpodStatus struct {
	ID            string `json:"id"`
	Status        string `json:"status"`
	Error         string `json:"error"`
	ExecutionTime int64  `json:"executionTime"`
	Output        struct {
		VideoURL        string                 `json:"video_url"`
		DurationSeconds float64                `json:"duration_seconds"`
		ContentType     string                 `json:"content_type"`
		Metrics         map[string]interface{} `json:"metrics"`
		OmniServe       map[string]interface{} `json:"omniserve"`
	} `json:"output"`
}

func normalizeCharacterAnimationRequest(req *ServiceUsageRequest) error {
	req.Service = "character_animation"
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.ImageURL == "" {
		return fmt.Errorf("image_url is required")
	}
	if err := validateRestyleURL(req.ImageURL); err != nil {
		return fmt.Errorf("image_url: %w", err)
	}
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	if err := validateRestyleURL(req.VideoURL); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required and should describe the character appearance and background")
	}
	if len(req.Prompt) > 1600 {
		return fmt.Errorf("prompt must be 1600 characters or fewer")
	}
	if req.Duration == 0 {
		req.Duration = 5
	}
	if req.Duration < 1 || req.Duration > 8 {
		return fmt.Errorf("duration must be between 1 and 8 seconds")
	}
	if req.Width == 0 {
		req.Width = 640
	}
	if req.Height == 0 {
		req.Height = 800
	}
	if req.Width < 320 || req.Width > 1280 || req.Height < 320 || req.Height > 1280 || req.Width%16 != 0 || req.Height%16 != 0 {
		return fmt.Errorf("width and height must be 320–1280 and divisible by 16")
	}
	if req.Width*req.Height > 921600 {
		return fmt.Errorf("width times height must not exceed 921600 pixels")
	}
	req.ExecutionProfile = strings.ToLower(strings.TrimSpace(req.ExecutionProfile))
	if req.ExecutionProfile == "" {
		req.ExecutionProfile = "auto"
	}
	if !videoStringIn(req.ExecutionProfile, "auto", "small", "balanced", "throughput") {
		return fmt.Errorf("execution_profile must be auto, small, balanced, or throughput")
	}
	req.ServiceTier = strings.ToLower(strings.TrimSpace(req.ServiceTier))
	if req.ServiceTier == "" {
		req.ServiceTier = "standard"
	}
	if !videoStringIn(req.ServiceTier, "standard", "fast", "xfast") {
		return fmt.Errorf("service_tier must be standard, fast, or xfast")
	}
	if req.NumSteps == 0 {
		req.NumSteps = 10
	}
	if req.NumSteps < 4 || req.NumSteps > 50 {
		return fmt.Errorf("num_steps must be between 4 and 50")
	}
	if req.Guidance == 0 {
		req.Guidance = 1
	}
	if req.Guidance != 1 {
		return fmt.Errorf("distilled execution profiles require guidance=1")
	}
	return nil
}

func characterAnimationEndpointID(tier string) string {
	var keys []string
	switch tier {
	case "fast":
		keys = []string{"WAN_ANIMATE_FAST_RUNPOD_ENDPOINT_ID"}
	case "xfast":
		keys = []string{"WAN_ANIMATE_XFAST_RUNPOD_ENDPOINT_ID"}
	default:
		keys = []string{"WAN_ANIMATE_RUNPOD_ENDPOINT_ID", "OMNISERVE_RUNPOD_ENDPOINT_ID", "VIDEO_BACKGROUND_RUNPOD_ENDPOINT_ID"}
	}
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

func characterAnimationUploadTarget(user *User) (string, string, error) {
	shortID := sanitizeUploadName(user.ID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	objectKey := fmt.Sprintf("%s/%s/character-animation/%s.mp4", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID())
	uploadURL, err := presignR2PutObject(objectKey, "video/mp4", 3*60*60)
	if err != nil {
		return "", "", err
	}
	return uploadURL, fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func characterAnimationEstimate(req ServiceUsageRequest) (float64, float64) {
	// Price is fixed before dispatch so a cold worker never surprises the user
	// and expensive priority lanes retain enough reserve to scale back to zero.
	// Short outputs still consume the same model placement and setup, so use a
	// transparent five-second minimum instead of loss-leading one-second jobs.
	billableSeconds := math.Max(5, float64(req.Duration))
	charged := math.Ceil(characterAnimationStandardUSDPerSecond*billableSeconds*characterAnimationTierMultiplier(req.ServiceTier)*100) / 100
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = charged / price
	}
	return charged, credits
}

func characterAnimationTierMultiplier(tier string) float64 {
	switch strings.ToLower(strings.TrimSpace(tier)) {
	case "fast":
		return 2
	case "xfast":
		return 4
	default:
		return 1
	}
}

func characterAnimationWarmEndpoint(tier string) bool {
	endpointID := characterAnimationEndpointID(tier)
	if endpointID == "" {
		return false
	}
	var health h3ScaleHealth
	if _, err := callH3Runpod(endpointID, "/health", http.MethodGet, nil, &health); err != nil {
		return false
	}
	return health.Jobs.InProgress == 0 && health.Jobs.InQueue == 0 && health.Workers["ready"]+health.Workers["idle"] > 0
}

func characterAnimationDispatchTier(requested string) string {
	// Reuse already-paid-for priority capacity before it idles out. Never cold
	// start a more expensive lane for a cheaper request. A premium request may
	// also use an idle Standard worker when its requested pool has no warm
	// capacity; this beats waiting on a scarce regional placement while keeping
	// the requested and actual execution tiers visible at settlement.
	if strings.ToLower(getEnv("WAN_ANIMATE_REUSE_PRIORITY_CAPACITY", "1")) != "0" {
		if requested != "xfast" && characterAnimationWarmEndpoint("xfast") {
			return "xfast"
		}
		if requested == "standard" && characterAnimationWarmEndpoint("fast") {
			return "fast"
		}
		if requested != "standard" && !characterAnimationWarmEndpoint(requested) && characterAnimationWarmEndpoint("standard") {
			return "standard"
		}
	}
	return requested
}

func characterAnimationWorkerInput(req ServiceUsageRequest, uploadURL, publicURL string) map[string]interface{} {
	input := map[string]interface{}{
		"workload": "wan-animate-2", "image": req.ImageURL,
		"driving_video": req.VideoURL, "prompt": req.Prompt, "max_seconds": req.Duration,
		"quality": "balanced", "fps": 12, "frames_per_segment": 37, "steps": req.NumSteps,
		"service_tier":       req.ServiceTier,
		"_output_upload_url": uploadURL, "_output_public_url": publicURL,
	}
	if req.Seed != 0 {
		input["seed"] = req.Seed
	}
	return input
}

func characterAnimationSetWorkersMax(endpointID, tier string, workersMax int) error {
	idleSeconds := int(characterAnimationDrainDelay(tier) / time.Second)
	return h3ControlRequest(
		http.MethodPost,
		h3ControlBase()+"/endpoints/"+url.PathEscape(endpointID)+"/update",
		map[string]interface{}{
			"workersMin": 0, "workersMax": workersMax, "idleTimeout": idleSeconds,
			"executionTimeoutMs": 4 * 60 * 60 * 1000, "flashboot": true,
			"scalerType": "REQUEST_COUNT", "scalerValue": 1,
		},
		nil,
	)
}

func submitCharacterAnimationRunpod(endpointID, tier string, input map[string]interface{}, queued *h3RunpodQueuedJob) (int, error) {
	lock := h3EndpointScaleLock(endpointID)
	lock.Lock()
	defer lock.Unlock()
	config, err := h3EndpointConfig(endpointID)
	if err != nil {
		return 0, err
	}
	if config.WorkersMax != 1 {
		if err := characterAnimationSetWorkersMax(endpointID, tier, 1); err != nil {
			return 0, err
		}
	}
	var status int
	for attempt := 0; attempt < 7; attempt++ {
		status, err = callH3Runpod(endpointID, "/run", http.MethodPost, map[string]interface{}{"input": input}, queued)
		if status != http.StatusConflict || err == nil || !strings.Contains(err.Error(), "ENDPOINT_PAUSED") {
			return status, err
		}
		if err := characterAnimationSetWorkersMax(endpointID, tier, 1); err != nil {
			return status, err
		}
		// RunPod's control plane can report the updated worker limit several
		// seconds before the queue API observes the endpoint as unpaused.
		time.Sleep(h3ScalePropagationDelay)
	}
	return status, err
}

func characterAnimationDrainDelay(tier string) time.Duration {
	switch tier {
	case "xfast":
		return 10 * time.Second
	case "fast":
		return 15 * time.Second
	default:
		return 30 * time.Second
	}
}

func scheduleCharacterAnimationScaleToZero(endpointID, tier string) {
	go func() {
		time.Sleep(characterAnimationDrainDelay(tier))
		scheduleH3ScaleToZero(endpointID)
	}()
}

func submitCharacterAnimation(req ServiceUsageRequest, user *User) (string, string, error) {
	dispatchTier := characterAnimationDispatchTier(req.ServiceTier)
	endpointID := characterAnimationEndpointID(dispatchTier)
	if endpointID == "" {
		return "", "", fmt.Errorf("character animation %s endpoint is not configured", req.ServiceTier)
	}
	uploadURL, publicURL, err := characterAnimationUploadTarget(user)
	if err != nil {
		return "", "", err
	}
	input := characterAnimationWorkerInput(req, uploadURL, publicURL)
	var queued h3RunpodQueuedJob
	status, err := submitCharacterAnimationRunpod(endpointID, dispatchTier, input, &queued)
	if err != nil {
		return "", "", err
	}
	if queued.ID == "" {
		return "", "", fmt.Errorf("character animation endpoint returned no job (status %d)", status)
	}
	return "runpod-wan:" + endpointID + ":" + queued.ID, dispatchTier, nil
}

func cancelCharacterAnimationProvider(providerID, tier string) {
	endpointID, jobID, ok := parseCharacterAnimationProviderID(providerID)
	if !ok {
		return
	}
	_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(jobID), http.MethodPost, nil, nil)
	scheduleCharacterAnimationScaleToZero(endpointID, tier)
}

func parseCharacterAnimationProviderID(value string) (endpointID, jobID string, ok bool) {
	parts := strings.SplitN(value, ":", 3)
	if len(parts) != 3 || parts[0] != "runpod-wan" || parts[1] == "" || parts[2] == "" {
		return "", "", false
	}
	return parts[1], parts[2], true
}

func handleCharacterAnimationService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeCharacterAnimationRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	estimatedUSD, estimatedCredits := characterAnimationEstimate(req)
	if estimatedCredits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if user.Credits+1e-9 < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits ($%.2f), have %.2f", estimatedCredits, estimatedUSD, user.Credits))
		return
	}
	if jobs, err := dbConn.ListVideoJobs(user.ID, 100); err == nil {
		for i := range jobs {
			status := strings.ToLower(strings.TrimSpace(jobs[i].Status))
			if jobs[i].Service == "character_animation" && (status == "queued" || status == "processing") {
				jsonError(ctx, http.StatusConflict, "finish the current character animation before starting another")
				return
			}
		}
	}
	providerID, dispatchTier, err := submitCharacterAnimation(req, user)
	if err != nil {
		jsonError(ctx, http.StatusServiceUnavailable, "character animation is temporarily unavailable")
		return
	}
	stored, _ := json.Marshal(characterAnimationStoredRequest{Input: req, DispatchTier: dispatchTier})
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, "character_animation", req.Prompt)
	if err != nil {
		cancelCharacterAnimationProvider(providerID, dispatchTier)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist character animation job")
		return
	}
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		cancelCharacterAnimationProvider(providerID, dispatchTier)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist character animation input")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service":            "character_animation",
		"result":             map[string]interface{}{"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"service_tier": req.ServiceTier, "execution_tier": dispatchTier, "pricing_multiplier": characterAnimationTierMultiplier(req.ServiceTier),
		"settlement": "fixed price confirmed before generation",
	})
}

func processCharacterAnimationJob(job *VideoJob) {
	var stored characterAnimationStoredRequest
	if json.Unmarshal(job.Result, &stored) != nil || normalizeCharacterAnimationRequest(&stored.Input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved character animation request is invalid")
		return
	}
	endpointID, providerJobID, ok := parseCharacterAnimationProviderID(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "character animation provider job is invalid")
		return
	}
	dispatchTier := stored.DispatchTier
	if dispatchTier == "" {
		dispatchTier = stored.Input.ServiceTier
	}
	defer scheduleCharacterAnimationScaleToZero(endpointID, dispatchTier)
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(2 * time.Hour)
	for time.Now().Before(deadline) {
		var state characterAnimationRunpodStatus
		_, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state)
		if err != nil {
			time.Sleep(3 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED", "SUCCEEDED":
			if strings.TrimSpace(state.Output.VideoURL) == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "character animation returned no playable video")
				return
			}
			seconds := float64(state.ExecutionTime) / 1000
			providerUSD := characterAnimationGPUHourlyUSD(dispatchTier) * seconds / 3600
			if providerUSD <= 0 {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "character animation returned no metered execution time")
				return
			}
			chargedUSD, _ := characterAnimationEstimate(stored.Input)
			margin := 0.0
			if chargedUSD > 0 {
				margin = (chargedUSD - providerUSD) / chargedUSD
			}
			log.Printf("[wan-animate] tier=%s execution_tier=%s charged_usd=%.4f metered_execution_usd=%.4f execution_seconds=%.3f metered_margin=%.1f%%", stored.Input.ServiceTier, dispatchTier, chargedUSD, providerUSD, seconds, margin*100)
			settleCharacterAnimation(job, state, providerUSD, chargedUSD, stored.Input.ServiceTier, dispatchTier)
			return
		case "FAILED", "CANCELLED", "CANCELED", "TIMED_OUT":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "character animation failed")
			return
		}
		time.Sleep(3 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "character animation did not finish in time")
}

func characterAnimationGPUHourlyUSD(tier string) float64 {
	switch strings.ToLower(strings.TrimSpace(tier)) {
	case "fast":
		// The priority pool may place on a B200, so meter against the current
		// Flex ceiling rather than optimistically assuming an H100 placement.
		return restyleEnvFloat("WAN_ANIMATE_FAST_GPU_HOURLY_USD", 8.64)
	case "xfast":
		return restyleEnvFloat("WAN_ANIMATE_XFAST_GPU_HOURLY_USD", 8.64)
	default:
		// This fallback pool includes L40/L40S/RTX 6000 Ada, so use the
		// current $0.00053/s Flex ceiling rather than the cheaper A40 rate.
		return restyleEnvFloat("WAN_ANIMATE_STANDARD_GPU_HOURLY_USD", 1.908)
	}
}

func settleCharacterAnimation(job *VideoJob, state characterAnimationRunpodStatus, providerUSD, chargedUSD float64, serviceTier, dispatchTier string) {
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	resultMap := map[string]interface{}{
		"video_url": state.Output.VideoURL, "duration_seconds": state.Output.DurationSeconds,
		"content_type": state.Output.ContentType, "provider_cost_usd": providerUSD,
		"charged_usd": chargedUSD, "cute_price_usd": cutePrice, "credits_used": chargedUSD / cutePrice,
		"service_tier": serviceTier, "execution_tier": dispatchTier,
	}
	result, _ := json.Marshal(resultMap)
	if user, err := dbConn.GetUserByID(job.UserID); err == nil {
		result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "character_animation"}, user, result)
	}
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
