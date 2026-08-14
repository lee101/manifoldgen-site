package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	falRestyleMarkup = 1.20
	wanAnimateMarkup = 2.00
)

type restyleStoredRequest struct {
	Input ServiceUsageRequest `json:"input"`
}

type falQueueResponse struct {
	RequestID string `json:"request_id"`
	Status    string `json:"status"`
	Error     string `json:"error"`
}

func normalizeVideoRestyleRequest(req *ServiceUsageRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	req.Model = strings.ToLower(strings.TrimSpace(req.Model))
	if req.Model == "" {
		req.Model = "wan-2.2"
	}
	if req.Model == "wan-animate" {
		req.Model = "wan-animate-2"
	}
	if req.Model != "wan-2.2" && req.Model != "h3-reference" && req.Model != "wan-animate-2" {
		return fmt.Errorf("model must be wan-2.2, h3-reference, or wan-animate-2")
	}
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	if err := validateRestyleURL(req.VideoURL); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if req.Model == "wan-animate-2" {
		req.ImageURL = strings.TrimSpace(req.ImageURL)
		if req.ImageURL == "" {
			return fmt.Errorf("image_url is required for animation transfer")
		}
		if err := validateRestyleURL(req.ImageURL); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
		if req.Duration == 0 {
			req.Duration = 5
		}
		if req.Duration < 1 || req.Duration > 15 {
			return fmt.Errorf("duration must be between 1 and 15 seconds")
		}
		if req.FramesPerSecond == 0 {
			req.FramesPerSecond = 24
		}
		if !videoIntIn(req.FramesPerSecond, 12, 16, 24, 30) {
			return fmt.Errorf("frames_per_second must be 12, 16, 24, or 30")
		}
		if req.NumFrames == 0 {
			req.NumFrames = 37
		}
		if req.NumFrames < 17 || req.NumFrames > 81 || (req.NumFrames-1)%4 != 0 {
			return fmt.Errorf("num_frames must be 17 to 81 and equal 4n+1")
		}
		if req.NumSteps == 0 {
			req.NumSteps = 10
		}
		if req.NumSteps < 6 || req.NumSteps > 20 {
			return fmt.Errorf("num_steps must be between 6 and 20")
		}
		if req.Resolution == "" {
			req.Resolution = "preview"
		}
		if !videoStringIn(req.Resolution, "preview", "balanced", "high") {
			return fmt.Errorf("resolution must be preview, balanced, or high")
		}
	} else if req.Model == "h3-reference" {
		if req.Duration == 0 {
			req.Duration = 10
		}
		if req.Duration < 5 || req.Duration > 10 {
			return fmt.Errorf("duration must be between 5 and 10 seconds")
		}
		if req.Resolution == "" {
			req.Resolution = "2K"
		}
		if !videoStringIn(req.Resolution, "768p", "2K", "4K") {
			return fmt.Errorf("unsupported resolution")
		}
		if req.AspectRatio == "" {
			req.AspectRatio = "16:9"
		}
		if !videoStringIn(req.AspectRatio, "16:9", "9:16", "1:1") {
			return fmt.Errorf("unsupported aspect_ratio")
		}
		req.ReferenceVideoURLs = prependUniqueURL(req.VideoURL, req.ReferenceVideoURLs)
		if len(req.ReferenceImageURLs) > 9 || len(req.ReferenceVideoURLs) > 3 || len(req.ReferenceAudioURLs) > 3 {
			return fmt.Errorf("reference limits are 9 images, 3 videos, and 3 audio clips")
		}
	} else {
		if req.Strength == 0 {
			req.Strength = 0.9
		}
		if req.Strength < 0.05 || req.Strength > 1 {
			return fmt.Errorf("strength must be between 0.05 and 1")
		}
		if req.NumFrames == 0 {
			req.NumFrames = 81
		}
		if req.NumFrames < 17 || req.NumFrames > 161 {
			return fmt.Errorf("num_frames must be between 17 and 161")
		}
		if req.FramesPerSecond == 0 {
			req.FramesPerSecond = 16
		}
		if req.FramesPerSecond < 4 || req.FramesPerSecond > 60 {
			return fmt.Errorf("frames_per_second must be between 4 and 60")
		}
		if req.Resolution == "" {
			req.Resolution = "720p"
		}
		if !videoStringIn(req.Resolution, "480p", "580p", "720p") {
			return fmt.Errorf("unsupported resolution")
		}
		if req.AspectRatio == "" {
			req.AspectRatio = "auto"
		}
		if !videoStringIn(req.AspectRatio, "auto", "16:9", "9:16", "1:1") {
			return fmt.Errorf("unsupported aspect_ratio")
		}
	}
	for _, candidate := range append(append(append([]string{}, req.ReferenceImageURLs...), req.ReferenceVideoURLs...), req.ReferenceAudioURLs...) {
		if err := validateRestyleURL(candidate); err != nil {
			return fmt.Errorf("reference URL: %w", err)
		}
	}
	return nil
}

func videoIntIn(value int, choices ...int) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func validateRestyleURL(value string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return fmt.Errorf("must be a public HTTP(S) URL")
	}
	return nil
}

func prependUniqueURL(first string, rest []string) []string {
	out := []string{first}
	for _, candidate := range rest {
		candidate = strings.TrimSpace(candidate)
		if candidate != "" && candidate != first {
			out = append(out, candidate)
		}
	}
	return out
}

func restyleFalProviderCost(req ServiceUsageRequest) float64 {
	if req.Model == "wan-animate-2" {
		base := restyleEnvFloat("WAN_ANIMATE_ESTIMATED_PROVIDER_USD_PER_SECOND", 0.10)
		factor := map[string]float64{"preview": 1, "balanced": 1.6, "high": 3}[req.Resolution]
		return base * factor * float64(req.Duration)
	}
	if req.Model == "h3-reference" {
		rate := map[string]float64{"768p": 0.08, "2K": 0.13, "4K": 0.16}[req.Resolution]
		return rate*float64(req.Duration) + math.Max(0, float64(len(req.ReferenceImageURLs)-5))*0.08
	}
	rate := map[string]float64{"480p": 0.04, "580p": 0.06, "720p": 0.08}[req.Resolution]
	return rate * float64(req.NumFrames) / 16
}

func restyleEstimate(req ServiceUsageRequest) (float64, float64) {
	markup := falRestyleMarkup
	if req.Model == "wan-animate-2" {
		markup = wanAnimateMarkup
	}
	charged := math.Ceil(restyleFalProviderCost(req)*markup*100) / 100
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(charged / price)
	}
	return charged, credits
}

func handleVideoRestyleService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeVideoRestyleRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	estimatedUSD, estimatedCredits := restyleEstimate(req)
	if req.Model == "wan-animate-2" && !user.UnlimitedAPI && user.Credits < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: animation transfer needs about %.0f credits ($%.2f)", estimatedCredits, estimatedUSD))
		return
	}
	stored, _ := json.Marshal(restyleStoredRequest{Input: req})
	providerID, err := submitPrivateVideoRestyle(req)
	if err != nil && allowsFalVideoRestyle(req) {
		providerID, err = submitFalVideoRestyle(req)
	}
	if err != nil {
		jsonError(ctx, http.StatusServiceUnavailable, "video restyling is temporarily unavailable")
		return
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, "video_restyle", req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist video restyle job")
		return
	}
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist video restyle input")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"result":             map[string]interface{}{"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"settlement": "final price based on generation",
	})
}

func allowsFalVideoRestyle(req ServiceUsageRequest) bool {
	return req.Model != "wan-animate-2"
}

func privateRestyleTemplate(req ServiceUsageRequest) string {
	if req.Model == "wan-animate-2" {
		return strings.TrimSpace(getEnv("VIDEO_ANIMATE_APPNZ_TEMPLATE", "wan-animate-2"))
	}
	if req.Model == "h3-reference" {
		return strings.TrimSpace(getEnv("VIDEO_REFERENCE_APPNZ_TEMPLATE", "minimax-h3-reference"))
	}
	return strings.TrimSpace(getEnv("VIDEO_RESTYLE_APPNZ_TEMPLATE", "wan-2.2-a14b-v2v"))
}

func privateRestyleModelID(req ServiceUsageRequest) string {
	if req.Model == "wan-animate-2" {
		return strings.TrimSpace(os.Getenv("VIDEO_ANIMATE_APPNZ_MODEL_ID"))
	}
	if req.Model == "h3-reference" {
		return strings.TrimSpace(os.Getenv("VIDEO_REFERENCE_APPNZ_MODEL_ID"))
	}
	return strings.TrimSpace(os.Getenv("VIDEO_RESTYLE_APPNZ_MODEL_ID"))
}

func submitPrivateVideoRestyle(req ServiceUsageRequest) (string, error) {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("VIDEO_RESTYLE_PRIVATE_DISABLED")), "true") {
		return "", fmt.Errorf("private restyle disabled")
	}
	payload := privateRestyleProviderInput(req)
	runRequest := map[string]interface{}{"input": payload}
	if modelID := privateRestyleModelID(req); modelID != "" {
		runRequest["modelId"] = modelID
	} else {
		runRequest["template"] = privateRestyleTemplate(req)
		runRequest["name"] = "video-restyle-shared"
	}
	envelope, _, err := callAppNZH3(http.MethodPost, "/api/cogs/run", runRequest)
	if err != nil {
		return "", err
	}
	if envelope.Prediction.ID == "" {
		return "", fmt.Errorf("private video service returned no job")
	}
	return "private:" + envelope.Prediction.ID, nil
}

func privateRestyleProviderInput(req ServiceUsageRequest) map[string]interface{} {
	if req.Model == "wan-animate-2" {
		preserveAudio := true
		if req.IncludeAudio != nil {
			preserveAudio = *req.IncludeAudio
		}
		input := map[string]interface{}{
			"image": req.ImageURL, "driving_video": req.VideoURL, "prompt": req.Prompt,
			"quality": req.Resolution, "max_seconds": req.Duration,
			"fps": req.FramesPerSecond, "frames_per_segment": req.NumFrames,
			"steps": req.NumSteps, "preserve_audio": preserveAudio,
			"cgtaylor": false,
		}
		if req.Seed != 0 {
			input["seed"] = req.Seed
		}
		return input
	}
	if req.Model == "h3-reference" {
		input := map[string]interface{}{
			"prompt": req.Prompt, "duration": req.Duration, "resolution": req.Resolution,
			"aspect_ratio": req.AspectRatio, "reference_image_urls": req.ReferenceImageURLs,
			"reference_video_urls": req.ReferenceVideoURLs, "reference_audio_urls": req.ReferenceAudioURLs,
		}
		if req.Seed != 0 {
			input["seed"] = req.Seed
		}
		return input
	}
	input := map[string]interface{}{
		"video_url": req.VideoURL, "prompt": req.Prompt, "negative_prompt": req.NegativePrompt,
		"resolution": req.Resolution, "aspect_ratio": req.AspectRatio, "strength": req.Strength,
		"num_frames": req.NumFrames, "frames_per_second": req.FramesPerSecond,
	}
	if req.Seed != 0 {
		input["seed"] = req.Seed
	}
	return input
}

func restyleProviderInput(req ServiceUsageRequest) map[string]interface{} {
	input := map[string]interface{}{
		"video_url": req.VideoURL, "prompt": req.Prompt, "negative_prompt": req.NegativePrompt,
		"model": req.Model, "resolution": req.Resolution, "aspect_ratio": req.AspectRatio,
		"strength": req.Strength, "num_frames": req.NumFrames, "frames_per_second": req.FramesPerSecond,
		"duration": req.Duration, "reference_image_urls": req.ReferenceImageURLs,
		"reference_video_urls": req.ReferenceVideoURLs, "reference_audio_urls": req.ReferenceAudioURLs,
	}
	if req.Seed != 0 {
		input["seed"] = req.Seed
	}
	return input
}

func falRestylePath(req ServiceUsageRequest) string {
	if req.Model == "h3-reference" {
		return "minimax/h3/reference-to-video"
	}
	return "fal-ai/wan/v2.2-a14b/video-to-video"
}

func falRestyleRequestBase(req ServiceUsageRequest) string {
	if req.Model == "h3-reference" {
		return "minimax/h3"
	}
	return "fal-ai/wan"
}

func submitFalVideoRestyle(req ServiceUsageRequest) (string, error) {
	if falAPIKey == "" {
		return "", fmt.Errorf("standby video service is not configured")
	}
	payload := restyleProviderInput(req)
	delete(payload, "model")
	if req.Model == "h3-reference" {
		delete(payload, "video_url")
		delete(payload, "strength")
		delete(payload, "num_frames")
		delete(payload, "frames_per_second")
		delete(payload, "negative_prompt")
	} else {
		delete(payload, "duration")
		delete(payload, "reference_image_urls")
		delete(payload, "reference_video_urls")
		delete(payload, "reference_audio_urls")
	}
	data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+falRestylePath(req), payload)
	if err != nil {
		return "", err
	}
	var queued falQueueResponse
	if err := json.Unmarshal(data, &queued); err != nil || queued.RequestID == "" {
		return "", fmt.Errorf("standby video service returned no job")
	}
	return "fal:" + queued.RequestID, nil
}

func callFalQueue(method, endpoint string, payload interface{}) ([]byte, int, error) {
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequest(method, endpoint, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Key "+falAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := appNZVideoClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode >= 300 {
		return data, resp.StatusCode, fmt.Errorf("video queue returned %d", resp.StatusCode)
	}
	return data, resp.StatusCode, nil
}

func processVideoRestyleJob(job *VideoJob) {
	var stored restyleStoredRequest
	if err := json.Unmarshal(job.Result, &stored); err != nil || normalizeVideoRestyleRequest(&stored.Input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved video restyle request is invalid")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	if strings.HasPrefix(job.ProviderJobID, "private:") {
		if processPrivateVideoRestyle(job, stored.Input) {
			return
		}
		if stored.Input.Model == "wan-animate-2" {
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "animation transfer failed; your credits were not charged")
			return
		}
		fallbackID, err := submitFalVideoRestyle(stored.Input)
		if err != nil {
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation could not be recovered")
			return
		}
		if err := dbConn.UpdateVideoJobProvider(job.ID, fallbackID, "processing", job.Result); err != nil {
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "could not move video generation to standby")
			return
		}
		job.ProviderJobID = fallbackID
	}
	processFalVideoRestyle(job, stored.Input)
}

// processPrivateVideoRestyle returns false only when the private worker fails,
// allowing the caller to continue the same durable job on standby capacity.
func processPrivateVideoRestyle(job *VideoJob, input ServiceUsageRequest) bool {
	providerID := strings.TrimPrefix(job.ProviderJobID, "private:")
	deadline := time.Now().Add(60 * time.Minute)
	for time.Now().Before(deadline) {
		envelope, _, err := callAppNZH3(http.MethodGet, "/api/cogs/predictions/"+url.PathEscape(providerID), nil)
		if err != nil {
			return false
		}
		switch strings.ToLower(strings.TrimSpace(envelope.Prediction.Status)) {
		case "succeeded", "completed":
			if envelope.Prediction.CostMicros <= 0 {
				return false
			}
			resultMap := h3Result(envelope.Prediction)
			providerUSD := float64(envelope.Prediction.CostMicros) / 1_000_000
			chargedMicros := h3DownstreamMicros(envelope.Prediction.CostMicros)
			if input.Model == "wan-animate-2" {
				chargedMicros = int64(math.Ceil(float64(envelope.Prediction.CostMicros) * wanAnimateMarkup))
			}
			chargedUSD := float64(chargedMicros) / 1_000_000
			return settleVideoRestyle(job, input, resultMap, providerUSD, chargedUSD)
		case "failed", "cancelled", "canceled":
			return false
		}
		time.Sleep(2500 * time.Millisecond)
	}
	return false
}

func processFalVideoRestyle(job *VideoJob, input ServiceUsageRequest) {
	requestID := strings.TrimPrefix(job.ProviderJobID, "fal:")
	base := "https://queue.fal.run/" + falRestyleRequestBase(input) + "/requests/" + url.PathEscape(requestID)
	deadline := time.Now().Add(60 * time.Minute)
	for time.Now().Before(deadline) {
		data, _, err := callFalQueue(http.MethodGet, base+"/status", nil)
		if err != nil {
			time.Sleep(2500 * time.Millisecond)
			continue
		}
		var state falQueueResponse
		_ = json.Unmarshal(data, &state)
		switch strings.ToLower(strings.TrimSpace(state.Status)) {
		case "completed", "succeeded":
			result, _, err := callFalQueue(http.MethodGet, base, nil)
			if err != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "completed video could not be retrieved")
				return
			}
			var resultMap map[string]interface{}
			if err := json.Unmarshal(result, &resultMap); err != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video service returned an invalid result")
				return
			}
			if video, ok := resultMap["video"].(map[string]interface{}); ok {
				if outputURL, _ := video["url"].(string); outputURL != "" {
					resultMap["video_url"] = outputURL
				}
			}
			providerUSD := restyleFalProviderCost(input)
			chargedUSD := math.Ceil(providerUSD*falRestyleMarkup*1_000_000) / 1_000_000
			_ = settleVideoRestyle(job, input, resultMap, providerUSD, chargedUSD)
			return
		case "failed", "cancelled", "canceled":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation failed")
			return
		}
		time.Sleep(2500 * time.Millisecond)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation did not finish in time")
}

func settleVideoRestyle(job *VideoJob, input ServiceUsageRequest, resultMap map[string]interface{}, providerUSD, chargedUSD float64) bool {
	if strings.TrimSpace(resultURLFromMap(resultMap)) == "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation returned no playable video")
		return true
	}
	// Do not expose routing details to clients. Only pricing and media metadata
	// survive into the durable result.
	delete(resultMap, "provider")
	delete(resultMap, "backend_used")
	resultMap["provider_cost_usd"] = providerUSD
	resultMap["charged_usd"] = chargedUSD
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return true
	}
	resultMap["cute_price_usd"] = cutePrice
	resultMap["credits_used"] = chargedUSD / cutePrice
	result, _ := json.Marshal(resultMap)
	if user, err := dbConn.GetUserByID(job.UserID); err == nil {
		result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "video_restyle"}, user, result)
	}
	_, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
	if err == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.2f required", chargedUSD))
		return true
	}
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return true
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
	return true
}

func resultURLFromMap(payload map[string]interface{}) string {
	for _, key := range []string{"video_url", "url"} {
		if value, _ := payload[key].(string); value != "" {
			return value
		}
	}
	return ""
}

func restyleEnvFloat(key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv(key)), 64)
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}
