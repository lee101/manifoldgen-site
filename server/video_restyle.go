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
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	falRestyleMarkup = 1.20
	wanAnimateMarkup = 2.00
	h3ControlMarkup  = 1.20
)

var h3ControlTypes = map[string]bool{
	"canny": true, "depth": true, "hed": true, "mlsd": true, "pose": true, "inpaint": true,
}

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
	if req.Model != "wan-2.2" && req.Model != "h3-reference" && req.Model != "h3-control" && req.Model != "wan-animate-2" {
		return fmt.Errorf("unsupported video restyle model")
	}
	if req.Prompt == "" && req.Model != "wan-animate-2" {
		return fmt.Errorf("prompt is required")
	}
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	if err := validateRestyleURL(req.VideoURL); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if err := validateRestyleMediaKind(req.VideoURL, "video"); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if req.Model == "h3-control" {
		req.ControlType = strings.ToLower(strings.TrimSpace(req.ControlType))
		if !h3ControlTypes[req.ControlType] {
			return fmt.Errorf("control_type must be canny, depth, hed, mlsd, pose, or inpaint")
		}
		if !req.AcceptH3License {
			return fmt.Errorf("accept_h3_license is required")
		}
		if req.Duration == 0 {
			req.Duration = 5
		}
		if req.Duration < 1 || req.Duration > 15 {
			return fmt.Errorf("duration must be between 1 and 15 seconds")
		}
		if req.Resolution == "" {
			req.Resolution = "480p"
		}
		if !videoStringIn(req.Resolution, "480p", "576p", "720p") {
			return fmt.Errorf("resolution must be 480p, 576p, or 720p")
		}
		if req.ControlScale == 0 {
			req.ControlScale = 1
		}
		if req.ControlScale < 0.1 || req.ControlScale > 1 {
			return fmt.Errorf("control_scale must be between 0.1 and 1")
		}
		if req.NumSteps == 0 {
			req.NumSteps = 20
		}
		if req.NumSteps < 20 || req.NumSteps > 50 {
			return fmt.Errorf("num_steps must be between 20 and 50")
		}
		if req.ControlPreprocess == nil {
			value := true
			req.ControlPreprocess = &value
		}
		if req.ControlType == "inpaint" {
			req.MaskVideoURL = strings.TrimSpace(req.MaskVideoURL)
			if req.MaskVideoURL == "" {
				return fmt.Errorf("mask_video_url is required for video inpainting")
			}
			if err := validateRestyleURL(req.MaskVideoURL); err != nil {
				return fmt.Errorf("mask_video_url: %w", err)
			}
		}
	} else if req.Model == "wan-animate-2" {
		req.AnimationMode = strings.ToLower(strings.TrimSpace(req.AnimationMode))
		if req.AnimationMode == "" {
			req.AnimationMode = "move"
		}
		if !videoStringIn(req.AnimationMode, "move", "replace") {
			return fmt.Errorf("animation_mode must be move or replace")
		}
		req.ImageURL = strings.TrimSpace(req.ImageURL)
		if req.ImageURL == "" {
			return fmt.Errorf("image_url is required for animation transfer")
		}
		if err := validateRestyleURL(req.ImageURL); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
		if err := validateRestyleMediaKind(req.ImageURL, "image"); err != nil {
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
		if req.NumSteps == 0 {
			req.NumSteps = 20
		}
		if req.NumSteps < 2 || req.NumSteps > 40 {
			return fmt.Errorf("num_steps must be between 2 and 40")
		}
		if req.Resolution == "" {
			req.Resolution = "580p"
		}
		if !videoStringIn(req.Resolution, "480p", "580p", "720p") {
			return fmt.Errorf("resolution must be 480p, 580p, or 720p")
		}
		if req.Guidance == 0 {
			req.Guidance = 1
		}
		if req.Guidance < 1 || req.Guidance > 10 {
			return fmt.Errorf("guidance must be between 1 and 10")
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

var restyleImageExtensions = map[string]bool{
	".avif": true, ".bmp": true, ".gif": true, ".heic": true, ".heif": true,
	".jpeg": true, ".jpg": true, ".png": true, ".tif": true, ".tiff": true, ".webp": true,
}

var restyleVideoExtensions = map[string]bool{
	".avi": true, ".m4v": true, ".mkv": true, ".mov": true, ".mp4": true,
	".mpeg": true, ".mpg": true, ".ogv": true, ".webm": true,
}

func validateRestyleMediaKind(value, expected string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return fmt.Errorf("invalid media URL")
	}
	ext := strings.ToLower(path.Ext(parsed.Path))
	if expected == "video" && restyleImageExtensions[ext] {
		return fmt.Errorf("expected a video file, got image extension %s", ext)
	}
	if expected == "image" && restyleVideoExtensions[ext] {
		return fmt.Errorf("expected an image file, got video extension %s", ext)
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
	if req.Model == "h3-control" {
		coldStart := restyleEnvFloat("H3_CONTROL_ESTIMATED_PROVIDER_BASE_USD", 0.60)
		perSecond := restyleEnvFloat("H3_CONTROL_ESTIMATED_PROVIDER_USD_PER_SECOND", 0.12)
		factor := map[string]float64{"480p": 1, "576p": 1.35, "720p": 2}[req.Resolution]
		return (coldStart + perSecond*float64(req.Duration)) * factor
	}
	if req.Model == "wan-animate-2" {
		rate := map[string]float64{"480p": 0.04, "580p": 0.06, "720p": 0.08}[req.Resolution]
		return rate * float64(req.Duration*req.FramesPerSecond) / 16
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
	if req.Model == "h3-control" {
		markup = h3ControlMarkup
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
	if req.Model == "h3-control" && !h3ControlRequestAllowed(ctx) {
		jsonError(ctx, http.StatusForbidden, "MiniMax H3 Control is not licensed for use in your territory")
		return
	}
	estimatedUSD, estimatedCredits := restyleEstimate(req)
	if (req.Model == "wan-animate-2" || req.Model == "h3-control") && !user.UnlimitedAPI && user.Credits < estimatedCredits {
		label := "animation transfer"
		if req.Model == "h3-control" {
			label = "H3 control video"
		}
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: %s needs about %.0f credits ($%.2f)", label, estimatedCredits, estimatedUSD))
		return
	}
	stored, _ := json.Marshal(restyleStoredRequest{Input: req})
	var providerID string
	var err error
	if req.Model == "wan-animate-2" {
		providerID, err = submitFalVideoRestyle(req)
	} else {
		providerID, err = submitPrivateVideoRestyle(req)
		if err != nil && allowsFalVideoRestyle(req) {
			providerID, err = submitFalVideoRestyle(req)
		}
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

func h3ControlTerritoryExcluded(country string) bool {
	switch strings.ToUpper(strings.TrimSpace(country)) {
	case "US", "GB", "KR", "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE":
		return true
	default:
		return false
	}
}

func handleH3ControlEligibility(ctx *fasthttp.RequestCtx) {
	country := strings.ToUpper(strings.TrimSpace(string(ctx.Request.Header.Peek("CF-IPCountry"))))
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"allowed": h3ControlRequestAllowed(ctx),
		"country": country,
	})
}

func h3ControlRequestAllowed(ctx *fasthttp.RequestCtx) bool {
	country := strings.ToUpper(strings.TrimSpace(string(ctx.Request.Header.Peek("CF-IPCountry"))))
	if strings.EqualFold(strings.TrimSpace(os.Getenv("H3_CONTROL_REQUIRE_CF_COUNTRY")), "true") && (len(country) != 2 || country == "XX" || country == "T1") {
		return false
	}
	return !h3ControlTerritoryExcluded(country)
}

func allowsFalVideoRestyle(req ServiceUsageRequest) bool {
	return req.Model != "h3-control"
}

func privateRestyleTemplate(req ServiceUsageRequest) string {
	if req.Model == "wan-animate-2" {
		return strings.TrimSpace(getEnv("VIDEO_ANIMATE_APPNZ_TEMPLATE", "wan-animate-2"))
	}
	if req.Model == "h3-reference" {
		return strings.TrimSpace(getEnv("VIDEO_REFERENCE_APPNZ_TEMPLATE", "minimax-h3-reference"))
	}
	if req.Model == "h3-control" {
		return strings.TrimSpace(getEnv("VIDEO_CONTROL_APPNZ_TEMPLATE", "minimax-h3-control-union"))
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
	if req.Model == "h3-control" {
		return strings.TrimSpace(os.Getenv("VIDEO_CONTROL_APPNZ_MODEL_ID"))
	}
	return strings.TrimSpace(os.Getenv("VIDEO_RESTYLE_APPNZ_MODEL_ID"))
}

func submitPrivateVideoRestyle(req ServiceUsageRequest) (string, error) {
	if req.Model == "h3-control" && h3ControlEndpointID() != "" {
		return submitH3ControlRunpod(req)
	}
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

func h3ControlEndpointID() string {
	return strings.TrimSpace(os.Getenv("VIDEO_CONTROL_RUNPOD_ENDPOINT_ID"))
}

func h3ControlOutputTarget() (string, string, error) {
	objectKey := fmt.Sprintf("%s/control-video/%s.mp4", strings.TrimSuffix(r2PathPrefix, "/"), newUUID())
	uploadURL, err := presignR2PutObject(objectKey, "video/mp4", 6*60*60)
	if err != nil {
		return "", "", err
	}
	return uploadURL, fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func submitH3ControlRunpod(req ServiceUsageRequest) (string, error) {
	endpointID := h3ControlEndpointID()
	if endpointID == "" {
		return "", fmt.Errorf("H3 control endpoint is not configured")
	}
	uploadURL, publicURL, err := h3ControlOutputTarget()
	if err != nil {
		return "", err
	}
	input := privateRestyleProviderInput(req)
	input["_output_upload_url"] = uploadURL
	input["_output_public_url"] = publicURL
	var queued h3RunpodQueuedJob
	status, err := submitCharacterAnimationRunpod(endpointID, "standard", input, &queued)
	if err != nil {
		return "", err
	}
	if queued.ID == "" {
		return "", fmt.Errorf("H3 control endpoint returned no job (status %d)", status)
	}
	return "runpod-control:" + endpointID + ":" + queued.ID, nil
}

func parseH3ControlProviderID(value string) (endpointID, jobID string, ok bool) {
	parts := strings.SplitN(value, ":", 3)
	if len(parts) != 3 || parts[0] != "runpod-control" || parts[1] == "" || parts[2] == "" {
		return "", "", false
	}
	return parts[1], parts[2], true
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
	if req.Model == "h3-control" {
		preprocess := true
		if req.ControlPreprocess != nil {
			preprocess = *req.ControlPreprocess
		}
		input := map[string]interface{}{
			"video_url": req.VideoURL, "prompt": req.Prompt, "negative_prompt": req.NegativePrompt,
			"control_type": req.ControlType, "control_scale": req.ControlScale,
			"preprocess": preprocess, "duration": req.Duration, "resolution": req.Resolution,
			"steps": req.NumSteps, "mask_video_url": req.MaskVideoURL,
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
	if req.Model == "wan-animate-2" {
		input := map[string]interface{}{
			"video_url": req.VideoURL, "image_url": req.ImageURL,
			"guidance_scale": req.Guidance, "resolution": req.Resolution,
			"num_inference_steps": req.NumSteps, "shift": 5,
			"enable_safety_checker": true, "enable_output_safety_checker": true,
			"video_quality": "high", "video_write_mode": "balanced",
			"return_frames_zip": false, "use_turbo": false,
		}
		if req.Seed != 0 {
			input["seed"] = req.Seed
		}
		return input
	}
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
	if req.Model == "wan-animate-2" {
		return "fal-ai/wan/v2.2-14b/animate/" + req.AnimationMode
	}
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
	if req.Model == "wan-animate-2" {
		// restyleProviderInput already emits the exact Move/Replace schema.
	} else if req.Model == "h3-reference" {
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
	if strings.HasPrefix(job.ProviderJobID, "runpod-control:") {
		processH3ControlRunpod(job, stored.Input)
		return
	}
	if strings.HasPrefix(job.ProviderJobID, "private:") {
		if processPrivateVideoRestyle(job, stored.Input) {
			return
		}
		if videoJobCancellationRequested(job.ID) {
			return
		}
		if stored.Input.Model == "h3-control" {
			label := "animation transfer"
			if stored.Input.Model == "h3-control" {
				label = "H3 control video"
			}
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, label+" failed; your credits were not charged")
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

func processH3ControlRunpod(job *VideoJob, input ServiceUsageRequest) {
	endpointID, providerJobID, ok := parseH3ControlProviderID(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "H3 control provider job is invalid")
		return
	}
	defer scheduleCharacterAnimationScaleToZero(endpointID, "standard")
	deadline := time.Now().Add(3 * time.Hour)
	for time.Now().Before(deadline) {
		if videoJobCancellationRequested(job.ID) {
			return
		}
		var state characterAnimationRunpodStatus
		_, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state)
		if err != nil {
			time.Sleep(3 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED", "SUCCEEDED":
			if strings.TrimSpace(state.Output.VideoURL) == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "H3 control returned no playable video")
				return
			}
			seconds := float64(state.ExecutionTime) / 1000
			providerUSD := restyleEnvFloat("H3_CONTROL_GPU_HOURLY_USD", 4.59) * seconds / 3600
			if providerUSD <= 0 {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "H3 control returned no metered execution time")
				return
			}
			chargedUSD := math.Ceil(providerUSD*h3ControlMarkup*1_000_000) / 1_000_000
			result := map[string]interface{}{"video_url": state.Output.VideoURL, "duration_seconds": state.Output.DurationSeconds, "content_type": state.Output.ContentType}
			settleVideoRestyle(job, input, result, providerUSD, chargedUSD)
			return
		case "FAILED", "CANCELLED", "CANCELED", "TIMED_OUT":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "H3 control generation failed")
			return
		}
		time.Sleep(3 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "H3 control generation did not finish in time")
}

// processPrivateVideoRestyle returns false only when the private worker fails,
// allowing the caller to continue the same durable job on standby capacity.
func processPrivateVideoRestyle(job *VideoJob, input ServiceUsageRequest) bool {
	providerID := strings.TrimPrefix(job.ProviderJobID, "private:")
	deadline := time.Now().Add(60 * time.Minute)
	for time.Now().Before(deadline) {
		if videoJobCancellationRequested(job.ID) {
			return false
		}
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
			} else if input.Model == "h3-control" {
				chargedMicros = int64(math.Ceil(float64(envelope.Prediction.CostMicros) * h3ControlMarkup))
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
		if videoJobCancellationRequested(job.ID) {
			return
		}
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
