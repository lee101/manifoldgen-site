package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	flux3MaxVideoService = "flux3_max_video"
	flux3MaxApp          = "blackforestlabs/flux-3-max"
	flux3MaxProviderTag  = "fal-flux3-"
	flux3MaxFPS          = 24
	flux3MaxMaxKeyframes = 10
	flux3Max720USD       = 0.17
	flux3Max1080USD      = 0.29
	flux3MaxPromo720USD  = 0.0425
	flux3MaxPromo1080USD = 0.0725
)

var flux3MaxAspects = []string{"auto", "21:9", "2:1", "16:9", "4:3", "1:1", "3:4", "9:16"}

var flux3MaxModes = map[string]string{"text": "text-to-video", "image": "image-to-video", "keyframes": "keyframes-to-video"}

type flux3MaxStoredRequest struct {
	Input ServiceUsageRequest `json:"input"`
}

func flux3MaxPromoActive() bool {
	return time.Now().UTC().Before(time.Date(2026, time.November, 8, 0, 0, 0, 0, time.UTC))
}

func normalizeFlux3MaxRequest(req *ServiceUsageRequest) error {
	req.Service = flux3MaxVideoService
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if len(req.Prompt) > 4000 {
		return fmt.Errorf("prompt must be at most 4000 characters")
	}
	req.FirstFrame = strings.TrimSpace(req.FirstFrame)
	if req.FirstFrame == "" {
		req.FirstFrame = strings.TrimSpace(req.ImageURL)
	}
	req.ImageURL = req.FirstFrame
	req.LastFrame = strings.TrimSpace(req.LastFrame)
	if req.Duration == 0 {
		req.Duration = 5
	}
	if req.Duration < 5 || req.Duration > 20 {
		return fmt.Errorf("duration must be between 5 and 20 seconds")
	}
	if err := normalizeFlux3MaxFrames(req); err != nil {
		return err
	}
	req.Resolution = strings.ToLower(strings.TrimSpace(req.Resolution))
	if req.Resolution == "" {
		req.Resolution = "720p"
	}
	if !videoStringIn(req.Resolution, "720p", "1080p") {
		return fmt.Errorf("resolution must be 720p or 1080p")
	}
	req.AspectRatio = strings.TrimSpace(req.AspectRatio)
	if req.AspectRatio == "" {
		req.AspectRatio = "auto"
	}
	if !videoStringIn(req.AspectRatio, flux3MaxAspects...) {
		return fmt.Errorf("aspect_ratio must be one of %s", strings.Join(flux3MaxAspects, ", "))
	}
	req.ReasoningLevel = strings.ToLower(strings.TrimSpace(req.ReasoningLevel))
	if req.ReasoningLevel == "" {
		req.ReasoningLevel = "high"
	}
	if !videoStringIn(req.ReasoningLevel, "low", "high") {
		return fmt.Errorf("reasoning_level must be low or high")
	}
	if req.Seed < 0 {
		return fmt.Errorf("seed must be zero or positive")
	}
	return nil
}

func validateFlux3MaxImage(field, value string) error {
	if err := validateRestyleURL(value); err != nil {
		return fmt.Errorf("%s: %w", field, err)
	}
	if err := validateRestyleMediaKind(value, "image"); err != nil {
		return fmt.Errorf("%s: %w", field, err)
	}
	return nil
}

func normalizeFlux3MaxFrames(req *ServiceUsageRequest) error {
	if len(req.TimedKeyframes) == 0 && len(req.Keyframes) > 0 {
		last := req.Duration * flux3MaxFPS
		for i, frame := range req.Keyframes {
			index := 0
			if len(req.Keyframes) > 1 {
				index = last * i / (len(req.Keyframes) - 1)
			}
			req.TimedKeyframes = append(req.TimedKeyframes, Flux3MaxKeyframe{ImageURL: frame, FrameIndex: index})
		}
	}
	req.Keyframes = nil
	if len(req.TimedKeyframes) == 0 {
		for field, value := range map[string]string{"image_url": req.FirstFrame, "last_frame": req.LastFrame} {
			if value != "" {
				if err := validateFlux3MaxImage(field, value); err != nil {
					return err
				}
			}
		}
		if req.FirstFrame == "" && req.LastFrame != "" {
			return fmt.Errorf("last_frame requires image_url (first frame)")
		}
		return nil
	}
	if req.FirstFrame != "" || req.LastFrame != "" {
		return fmt.Errorf("use either image_url/last_frame or keyframes, not both")
	}
	if len(req.TimedKeyframes) > flux3MaxMaxKeyframes {
		return fmt.Errorf("keyframes must contain at most %d images", flux3MaxMaxKeyframes)
	}
	seen := map[int]bool{}
	for i := range req.TimedKeyframes {
		frame := &req.TimedKeyframes[i]
		frame.ImageURL = strings.TrimSpace(frame.ImageURL)
		if err := validateFlux3MaxImage(fmt.Sprintf("keyframes[%d].image_url", i), frame.ImageURL); err != nil {
			return err
		}
		if frame.FrameIndex < 0 || frame.FrameIndex > req.Duration*flux3MaxFPS {
			return fmt.Errorf("keyframes[%d].frame_index must be between 0 and %d for a %d second video", i, req.Duration*flux3MaxFPS, req.Duration)
		}
		if seen[frame.FrameIndex] {
			return fmt.Errorf("keyframes frame_index values must be unique")
		}
		seen[frame.FrameIndex] = true
	}
	return nil
}

func flux3MaxMode(req ServiceUsageRequest) string {
	switch {
	case len(req.TimedKeyframes) > 0:
		return "keyframes"
	case req.FirstFrame != "":
		return "image"
	}
	return "text"
}

func flux3MaxModel(mode string) string {
	return flux3MaxApp + "/" + flux3MaxModes[mode]
}

func flux3MaxPayload(req ServiceUsageRequest) map[string]interface{} {
	audio := true
	if req.IncludeAudio != nil {
		audio = *req.IncludeAudio
	}
	payload := map[string]interface{}{
		"prompt": req.Prompt, "duration": req.Duration,
		"resolution": req.Resolution, "aspect_ratio": req.AspectRatio,
		"reasoning_level": req.ReasoningLevel, "generate_audio": audio,
	}
	switch flux3MaxMode(req) {
	case "image":
		payload["image_url"] = req.FirstFrame
		if req.LastFrame != "" {
			payload["end_image_url"] = req.LastFrame
		}
	case "keyframes":
		payload["keyframes"] = req.TimedKeyframes
	}
	if req.Seed != 0 {
		payload["seed"] = req.Seed
	}
	return payload
}

func flux3MaxChargedUSD(req ServiceUsageRequest) float64 {
	rate := flux3Max720USD
	if req.Resolution == "1080p" {
		rate = flux3Max1080USD
	}
	return math.Round(rate*float64(req.Duration)*1_000_000) / 1_000_000
}

func flux3MaxProviderUSD(req ServiceUsageRequest) float64 {
	rate := flux3Max720USD
	if req.Resolution == "1080p" {
		rate = flux3Max1080USD
	}
	if flux3MaxPromoActive() {
		rate = flux3MaxPromo720USD
		if req.Resolution == "1080p" {
			rate = flux3MaxPromo1080USD
		}
	}
	return rate * float64(req.Duration)
}

func flux3MaxEstimate(req ServiceUsageRequest) (float64, float64) {
	usd := flux3MaxChargedUSD(req)
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(usd / price)
	}
	return usd, credits
}

func flux3MaxProviderID(mode, requestID string) string {
	return flux3MaxProviderTag + mode + ":" + requestID
}

func parseFlux3MaxProviderID(value string) (mode, requestID string, ok bool) {
	if !strings.HasPrefix(value, flux3MaxProviderTag) {
		return "", "", false
	}
	parts := strings.SplitN(strings.TrimPrefix(value, flux3MaxProviderTag), ":", 2)
	if len(parts) != 2 || parts[1] == "" || flux3MaxModes[parts[0]] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func cancelFlux3MaxProvider(providerID string) error {
	_, id, ok := parseFlux3MaxProviderID(providerID)
	if !ok {
		return nil
	}
	endpoint := strings.TrimRight(falQueueBaseURL, "/") + "/" + flux3MaxApp + "/requests/" + url.PathEscape(id) + "/cancel"
	_, _, err := callFalQueue(http.MethodPut, endpoint, nil)
	return err
}

func handleFlux3MaxVideoService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeFlux3MaxRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(falAPIKey) == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "FLUX 3 Max video is not configured")
		return
	}
	estimatedUSD, estimatedCredits := flux3MaxEstimate(req)
	if estimatedCredits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if !user.UnlimitedAPI && user.Credits+1e-9 < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits ($%.2f), have %.2f", estimatedCredits, estimatedUSD, user.Credits))
		return
	}
	data, _, err := callFalQueue(http.MethodPost, strings.TrimRight(falQueueBaseURL, "/")+"/"+flux3MaxModel(flux3MaxMode(req)), flux3MaxPayload(req))
	var queued falQueueResponse
	if err != nil || json.Unmarshal(data, &queued) != nil || strings.TrimSpace(queued.RequestID) == "" {
		log.Printf("[flux3-max] submit failed: %v", err)
		jsonError(ctx, http.StatusServiceUnavailable, videoGenerationUnavailableMessage)
		return
	}
	providerID := flux3MaxProviderID(flux3MaxMode(req), queued.RequestID)
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, flux3MaxVideoService, req.Prompt)
	if err != nil {
		_ = cancelFlux3MaxProvider(providerID)
		jsonError(ctx, http.StatusInternalServerError, "failed to create video job")
		return
	}
	stored, _ := json.Marshal(flux3MaxStoredRequest{Input: req})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		_ = cancelFlux3MaxProvider(providerID)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist generation input")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service":            flux3MaxVideoService,
		"result":             map[string]interface{}{"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"settlement": "fixed price confirmed before generation",
	})
}

func processFlux3MaxVideoJob(job *VideoJob) {
	var stored flux3MaxStoredRequest
	if json.Unmarshal(job.Result, &stored) != nil || normalizeFlux3MaxRequest(&stored.Input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved generation request is invalid")
		return
	}
	_, requestID, ok := parseFlux3MaxProviderID(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, videoGenerationFailedMessage)
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	base := strings.TrimRight(falQueueBaseURL, "/") + "/" + flux3MaxApp + "/requests/" + url.PathEscape(requestID)
	deadline := time.Now().Add(60 * time.Minute)
	for time.Now().Before(deadline) {
		if videoJobCancellationRequested(job.ID) {
			return
		}
		data, _, err := callFalQueue(http.MethodGet, base+"/status", nil)
		if err != nil {
			if !waitForVideoJob(job.ID, 2500*time.Millisecond) {
				return
			}
			continue
		}
		var state falQueueResponse
		_ = json.Unmarshal(data, &state)
		switch strings.ToLower(strings.TrimSpace(state.Status)) {
		case "completed", "succeeded":
			settleFlux3MaxVideo(job, stored.Input, base)
			return
		case "failed", "cancelled", "canceled", "timed_out":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, videoGenerationFailedMessage)
			return
		}
		if !waitForVideoJob(job.ID, 2500*time.Millisecond) {
			return
		}
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, videoGenerationTimedOutMessage)
}

func settleFlux3MaxVideo(job *VideoJob, req ServiceUsageRequest, base string) {
	body, _, err := callFalQueue(http.MethodGet, base, nil)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "completed video could not be retrieved")
		return
	}
	var response struct {
		Video struct {
			URL         string  `json:"url"`
			ContentType string  `json:"content_type"`
			FileSize    int64   `json:"file_size"`
			Width       int     `json:"width"`
			Height      int     `json:"height"`
			Duration    float64 `json:"duration"`
			FPS         float64 `json:"fps"`
		} `json:"video"`
		Seed    int         `json:"seed"`
		Timings interface{} `json:"timings"`
	}
	if json.Unmarshal(body, &response) != nil || strings.TrimSpace(response.Video.URL) == "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation returned no playable video")
		return
	}
	providerUSD, chargedUSD := flux3MaxProviderUSD(req), flux3MaxChargedUSD(req)
	result, _ := json.Marshal(map[string]interface{}{
		"video_url": response.Video.URL, "provider": "fal", "model_variant": "flux-3-max",
		"output_format": "mp4", "bytes": response.Video.FileSize, "seed": response.Seed,
		"width": response.Video.Width, "height": response.Video.Height,
		"duration_seconds": response.Video.Duration, "fps": response.Video.FPS,
		"resolution": req.Resolution, "reasoning_level": req.ReasoningLevel, "mode": flux3MaxMode(req),
		"provider_cost_usd": providerUSD, "charged_usd": chargedUSD, "timings": response.Timings,
	})
	if user, err := dbConn.GetUserByID(job.UserID); err == nil {
		result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "video_generate"}, user, result)
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, "credit pricing unavailable; retry status")
		return
	}
	var final map[string]interface{}
	_ = json.Unmarshal(result, &final)
	final["cute_price_usd"], final["credits_used"] = cutePrice, chargedUSD/cutePrice
	result, _ = json.Marshal(final)
	_, _, settleErr := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
	if settleErr == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.2f required", chargedUSD))
		return
	}
	if settleErr != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
}
