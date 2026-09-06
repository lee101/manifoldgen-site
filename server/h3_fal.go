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

const (
	h3FalTextModel  = "minimax/h3-max/text-to-video"
	h3FalImageModel = "minimax/h3-max/image-to-video"
	h3FalMarkup     = 1.20
)

func isFalH3MaxModel(model string) bool {
	model = normalizeVideoModel(model)
	return model == h3FalTextModel || model == h3FalImageModel
}

func h3FalMode(req ServiceUsageRequest) string {
	if strings.TrimSpace(req.FirstFrame) != "" || strings.TrimSpace(req.ImageURL) != "" {
		return "image"
	}
	return "text"
}

func h3FalCanHandle(req ServiceUsageRequest) bool {
	wantsLocalRefine := req.LatentUpscale != nil && *req.LatentUpscale
	return !wantsLocalRefine && req.Size != "audio" && req.AudioURL == "" && !req.Loop &&
		len(req.Keyframes) <= 2 && req.Duration >= 5 && req.Duration <= 15
}

func h3FalResolution(req ServiceUsageRequest) string {
	if strings.EqualFold(strings.TrimSpace(req.Resolution), "480p") || req.Size == "preview" {
		return "480P"
	}
	return "768P"
}

func h3FalExpansion(req ServiceUsageRequest) string {
	mode := strings.ToLower(strings.TrimSpace(req.PromptExpansionMode))
	if mode == "disabled" || mode == "balanced" || mode == "quality" {
		return mode
	}
	if req.Structured != nil && !*req.Structured {
		return "disabled"
	}
	return "balanced"
}

func h3FalModel(req ServiceUsageRequest) string {
	if h3FalMode(req) == "image" {
		return h3FalImageModel
	}
	return h3FalTextModel
}

func h3FalPayload(req ServiceUsageRequest) map[string]interface{} {
	payload := map[string]interface{}{
		"prompt": strings.TrimSpace(req.Prompt), "duration": req.Duration,
		"resolution": h3FalResolution(req), "enable_safety_checker": true,
		"prompt_expansion_mode": h3FalExpansion(req),
	}
	if req.Seed != 0 {
		payload["seed"] = req.Seed
	}
	if h3FalMode(req) == "image" {
		imageURL := strings.TrimSpace(req.FirstFrame)
		if imageURL == "" {
			imageURL = strings.TrimSpace(req.ImageURL)
		}
		payload["image_url"] = imageURL
		if end := strings.TrimSpace(req.LastFrame); end != "" {
			payload["end_image_url"] = end
		}
	} else {
		payload["aspect_ratio"] = req.AspectRatio
	}
	return payload
}

func submitFalH3Max(req ServiceUsageRequest) (string, error) {
	if strings.TrimSpace(falAPIKey) == "" {
		return "", fmt.Errorf("FAL_KEY is not configured")
	}
	data, _, err := callFalQueue(http.MethodPost, strings.TrimRight(falQueueBaseURL, "/")+"/"+h3FalModel(req), h3FalPayload(req))
	if err != nil {
		return "", err
	}
	var queued falQueueResponse
	if json.Unmarshal(data, &queued) != nil || strings.TrimSpace(queued.RequestID) == "" {
		return "", fmt.Errorf("fal H3 Max returned no request ID")
	}
	return "fal-h3-" + h3FalMode(req) + ":" + queued.RequestID, nil
}

func handleDirectFalH3MaxService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	model := normalizeVideoModel(req.Model)
	if model == h3FalImageModel && strings.TrimSpace(req.ImageURL) == "" {
		jsonError(ctx, http.StatusBadRequest, "minimax/h3-max/image-to-video requires image_url")
		return
	}
	req.Service = "h3_video"
	if req.Size == "" {
		if strings.EqualFold(req.Resolution, "480p") {
			req.Size = "preview"
		} else {
			req.Size = "native"
		}
	}
	if err := normalizeH3VideoRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if !h3FalCanHandle(req) {
		jsonError(ctx, http.StatusBadRequest, "H3 Max supports 5-15 seconds, up to two endpoint images, and no driving audio or loop mode")
		return
	}
	handleFalH3MaxService(ctx, req, user)
}

func handleFalH3MaxService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	providerID, err := submitFalH3Max(req)
	if err != nil {
		log.Printf("[h3] fal H3 Max submission failed: %v", err)
		jsonError(ctx, http.StatusServiceUnavailable, videoGenerationUnavailableMessage)
		return
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, h3JobService(req), req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to create video job")
		return
	}
	input := h3FalPayload(req)
	input["_h3_variant"] = "h3-max"
	if err := dbConn.UpdateVideoJob(job.ID, "queued", persistH3Request(req, input), ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist generation input")
		return
	}
	providerUSD := h3FalProviderCost(req)
	chargedUSD := math.Ceil(providerUSD*h3FalMarkup*1_000_000) / 1_000_000
	estimatedCredits := 0.0
	if creditPrice := getCUTEPriceUSD(); creditPrice > 0 {
		estimatedCredits = math.Ceil(chargedUSD / creditPrice)
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": "video", "result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
		},
		"credits_used": 0, "settlement": "final price based on generation",
		"estimated_cost_usd": chargedUSD, "estimated_credits": estimatedCredits,
	})
}

func parseFalH3ProviderJob(value string) (mode, requestID string, ok bool) {
	parts := strings.SplitN(value, ":", 2)
	if len(parts) != 2 || (parts[0] != "fal-h3-text" && parts[0] != "fal-h3-image") || parts[1] == "" {
		return "", "", false
	}
	return strings.TrimPrefix(parts[0], "fal-h3-"), parts[1], true
}

func h3FalStoredRequest(job *VideoJob) ServiceUsageRequest {
	var stored ServiceUsageRequest
	_ = json.Unmarshal(job.Result, &stored)
	return stored
}

func h3FalProviderCost(req ServiceUsageRequest) float64 {
	promo := time.Now().UTC().Before(time.Date(2026, time.September, 1, 0, 0, 0, 0, time.UTC))
	rate, envName := 0.08, "H3_FAL_768P_USD_PER_SECOND"
	if promo {
		rate = 0.04
	}
	if h3FalResolution(req) == "480P" {
		rate, envName = 0.05, "H3_FAL_480P_USD_PER_SECOND"
		if promo {
			rate = 0.025
		}
	}
	if configured := strings.TrimSpace(os.Getenv(envName)); configured != "" {
		var parsed float64
		if _, err := fmt.Sscanf(configured, "%f", &parsed); err == nil && parsed > 0 {
			rate = parsed
		}
	}
	return rate * float64(req.Duration)
}

func processFalH3MaxJob(job *VideoJob) {
	_, requestID, ok := parseFalH3ProviderJob(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, videoGenerationFailedMessage)
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	base := strings.TrimRight(falQueueBaseURL, "/") + "/minimax/h3-max/requests/" + url.PathEscape(requestID)
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
			body, _, err := callFalQueue(http.MethodGet, base, nil)
			if err != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "completed video could not be retrieved")
				return
			}
			var response struct {
				Video struct {
					URL         string `json:"url"`
					ContentType string `json:"content_type"`
					FileSize    int64  `json:"file_size"`
				} `json:"video"`
				ExpandedPrompt interface{} `json:"expanded_prompt"`
				Timings        interface{} `json:"timings"`
			}
			if json.Unmarshal(body, &response) != nil || strings.TrimSpace(response.Video.URL) == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation returned no playable video")
				return
			}
			req := h3FalStoredRequest(job)
			providerUSD := h3FalProviderCost(req)
			chargedUSD := math.Ceil(providerUSD*h3FalMarkup*1_000_000) / 1_000_000
			result, _ := json.Marshal(map[string]interface{}{
				"video_url": response.Video.URL, "provider": "fal", "model_variant": "h3-max",
				"output_format": "mp4", "codec": "h264", "bytes": response.Video.FileSize,
				"provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
				"expanded_prompt": response.ExpandedPrompt, "timings": response.Timings,
			})
			if user, err := dbConn.GetUserByID(job.UserID); err == nil {
				result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "h3_video"}, user, result)
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
			_, _, settleErr := dbConn.SettleH3VideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
			if settleErr == ErrVideoPaymentRequired {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.6f required", chargedUSD))
				return
			}
			if settleErr != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
				return
			}
			afterH3VideoSettled(job, result)
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
