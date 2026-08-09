package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

const maxGeneratedVideoBytes = 256 << 20

const h3DownstreamMarkupPercent = int64(50)
const h3MinimumChargeMicros = int64(100_000) // $0.10; video should never cost less than an image.
const h3NativeFiveSecondBaseline = 15 * time.Minute

var appNZVideoClient = &http.Client{Timeout: 30 * time.Second}
var localH3CogClient = &http.Client{Timeout: 60 * time.Second}

func h3LocalCogURL() string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv("H3_LOCAL_COG_URL")), "/")
}

func isRunPodWorkersQuotaErr(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "workers quota") || strings.Contains(msg, "max workers across all endpoints")
}

type appNZH3Prediction struct {
	ID         string      `json:"id"`
	Status     string      `json:"status"`
	Output     interface{} `json:"output"`
	Error      string      `json:"error"`
	PredictMS  int64       `json:"predictMs"`
	CostMicros int64       `json:"costMicros"`
}

type appNZH3Envelope struct {
	Success    bool              `json:"success"`
	Prediction appNZH3Prediction `json:"prediction"`
	Error      string            `json:"error"`
}

var allowedVideoModels = map[string]bool{
	"auto-video":             true,
	"ltx-video":              true,
	"ltx-2":                  true,
	"ltx-2.3-image-to-video": true,
}

type openPathsVideoResponse struct {
	ID               string `json:"id,omitempty"`
	Status           string `json:"status,omitempty"`
	VideoURL         string `json:"video_url,omitempty"`
	OriginalVideoURL string `json:"original_video_url,omitempty"`
	OutputFormat     string `json:"output_format,omitempty"`
}

func normalizeVideoModel(model string) string {
	model = strings.TrimSpace(strings.ToLower(model))
	if model == "" {
		return "auto-video"
	}
	return model
}

func proxyOpenPathsVideo(req ServiceUsageRequest) ([]byte, error) {
	model := normalizeVideoModel(req.Model)
	if !allowedVideoModels[model] {
		return nil, fmt.Errorf("unsupported video model %q", model)
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("video prompt is required")
	}
	if model == "ltx-2.3-image-to-video" && strings.TrimSpace(req.ImageURL) == "" {
		return nil, fmt.Errorf("%s requires image_url", model)
	}
	// Keep the studio usable on existing ManifoldGen installs while the OpenPaths
	// service key is being provisioned. The configured FAL LTX backend supports
	// both text-to-video and image-to-video; OpenPaths becomes the preferred path
	// (and unlocks every model above) as soon as OPENPATHS_API_KEY is present.
	if openPathsAPIKey == "" {
		return proxyFallbackFalVideo(req)
	}

	duration := req.Duration
	if duration <= 0 || duration > 10 {
		duration = 5
	}
	aspect := strings.TrimSpace(req.AspectRatio)
	if aspect == "" {
		aspect = "16:9"
	}
	payload := map[string]interface{}{
		"model":         model,
		"prompt":        strings.TrimSpace(req.Prompt),
		"duration":      duration,
		"aspect_ratio":  aspect,
		"output_format": "mp4",
	}
	if req.ImageURL != "" {
		payload["image_url"] = strings.TrimSpace(req.ImageURL)
	}
	body, _ := json.Marshal(payload)
	result, status, err := callOpenPathsVideo(http.MethodPost, openPathsBaseURL+"/v1/videos/generations", body)
	if err != nil {
		return nil, err
	}
	if status != http.StatusAccepted {
		return result, nil
	}

	var queued openPathsVideoResponse
	if err := json.Unmarshal(result, &queued); err != nil || queued.ID == "" {
		return nil, fmt.Errorf("OpenPaths returned an invalid queued video response")
	}
	if queued.Status == "" {
		queued.Status = "queued"
	}
	return json.Marshal(queued)
}

var activeVideoJobs sync.Map

func isPendingVideoStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "", "queued", "pending", "processing", "running", "accepted":
		return true
	default:
		return false
	}
}

func appNZVideoConfig() (string, string) {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("APPNZ_BASE_URL")), "/")
	if baseURL == "" {
		baseURL = "https://app.nz"
	}
	return baseURL, strings.TrimSpace(os.Getenv("APPNZ_API_KEY"))
}

func callAppNZH3(method, path string, payload interface{}) (*appNZH3Envelope, int, error) {
	baseURL, key := appNZVideoConfig()
	if key == "" {
		return nil, 0, fmt.Errorf("APPNZ_API_KEY is not configured")
	}
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, 0, err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequest(method, baseURL+path, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	resp, err := appNZVideoClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	var envelope appNZH3Envelope
	if err := json.Unmarshal(data, &envelope); err != nil {
		return nil, resp.StatusCode, fmt.Errorf("video service returned an invalid response")
	}
	if resp.StatusCode >= 300 {
		message := strings.TrimSpace(envelope.Error)
		if message == "" {
			message = http.StatusText(resp.StatusCode)
		}
		return &envelope, resp.StatusCode, fmt.Errorf("%s", message)
	}
	return &envelope, resp.StatusCode, nil
}

func normalizeH3VideoRequest(req *ServiceUsageRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if req.FirstFrame == "" {
		req.FirstFrame = strings.TrimSpace(req.ImageURL)
	}
	if req.AudioURL != "" && req.FirstFrame == "" {
		return fmt.Errorf("audio_url requires first_frame or image_url")
	}
	if req.Loop && req.FirstFrame == "" {
		return fmt.Errorf("loop requires first_frame or image_url")
	}
	if req.AspectRatio == "" {
		req.AspectRatio = "16:9"
	}
	if !videoStringIn(req.AspectRatio, "16:9", "9:16", "1:1", "4:3", "3:4", "21:9") {
		return fmt.Errorf("unsupported aspect_ratio")
	}
	if req.Size == "" {
		req.Size = "balanced"
	}
	if !videoStringIn(req.Size, "preview", "balanced", "native", "audio") {
		return fmt.Errorf("unsupported size")
	}
	if req.Duration == 0 {
		req.Duration = 5
	}
	maxDuration := 15
	if req.Size == "audio" {
		maxDuration = 45
	} else {
		// Picture >15s auto-chains ~5s segments with 1s overlap on the H3 worker.
		maxDuration = 60
	}
	if req.Duration < 4 || req.Duration > maxDuration {
		return fmt.Errorf("duration must be between 4 and %d seconds for size=%s", maxDuration, req.Size)
	}
	if req.Size == "audio" && (req.FirstFrame != "" || req.LastFrame != "" || req.Loop) {
		return fmt.Errorf("size=audio is text-to-audio/video only; omit first_frame, last_frame, and loop")
	}
	if req.NumSteps == 0 {
		req.NumSteps = 20
	}
	if req.NumSteps < 8 || req.NumSteps > 30 {
		return fmt.Errorf("num_steps must be between 8 and 30")
	}
	if req.Quant == "" {
		// Keep the experimental w4a8 path opt-in until its visual quality is consistent.
		req.Quant = "int8_convrot"
	}
	if !videoStringIn(req.Quant, "int8_convrot", "w4a8") {
		return fmt.Errorf("unsupported quant")
	}
	if req.OutputFormat == "" {
		req.OutputFormat = "webm-av1"
	}
	if !videoStringIn(req.OutputFormat, "webm-av1", "mp4-h264") {
		return fmt.Errorf("unsupported output_format")
	}
	if req.EncodeQuality == 0 {
		req.EncodeQuality = 26
	}
	if req.EncodeQuality < 16 || req.EncodeQuality > 45 {
		return fmt.Errorf("encode_quality must be between 16 and 45")
	}
	return nil
}

func videoStringIn(value string, choices ...string) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func appNZH3Input(req ServiceUsageRequest) map[string]interface{} {
	input := map[string]interface{}{
		"prompt": req.Prompt, "aspect_ratio": req.AspectRatio, "size": req.Size,
		"duration": req.Duration, "steps": req.NumSteps, "loop": req.Loop,
		"output_codec": req.OutputFormat, "encode_quality": req.EncodeQuality,
		"quant": req.Quant,
	}
	if req.FirstFrame != "" {
		input["first_frame"] = req.FirstFrame
	}
	if req.LastFrame != "" {
		input["last_frame"] = req.LastFrame
	}
	if req.AudioURL != "" {
		input["audio"] = req.AudioURL
	}
	if req.Seed != 0 {
		input["seed"] = req.Seed
	}
	structured, audio := true, true
	if req.Structured != nil {
		structured = *req.Structured
	}
	if req.IncludeAudio != nil {
		audio = *req.IncludeAudio
	}
	input["structured_prompt"] = structured
	input["include_audio"] = audio
	return input
}

func handleH3VideoService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeH3VideoRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if local := h3LocalCogURL(); local != "" {
		handleLocalH3VideoService(ctx, req, user, local)
		return
	}
	estimatedUSD, estimatedCredits, estimatedSeconds := h3Estimate(req)
	envelope, upstreamStatus, err := callAppNZH3(http.MethodPost, "/api/cogs/run", map[string]interface{}{
		"template": "minimax-h3", "name": "minimax-h3-shared", "input": appNZH3Input(req),
	})
	if err != nil {
		if isRunPodWorkersQuotaErr(err) && h3LocalCogURL() == "" {
			jsonError(ctx, http.StatusServiceUnavailable, "video capacity is temporarily unavailable")
			return
		}
		status := http.StatusBadGateway
		if upstreamStatus == 0 {
			status = http.StatusServiceUnavailable
		} else if upstreamStatus >= 400 && upstreamStatus < 500 {
			status = upstreamStatus
		}
		jsonError(ctx, status, "video service: "+err.Error())
		return
	}
	if envelope.Prediction.ID == "" {
		jsonError(ctx, http.StatusBadGateway, "video service did not return a job")
		return
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, envelope.Prediction.ID, "h3_video", req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist H3 video job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"result":       map[string]interface{}{"job_id": job.ID, "status": job.Status, "status_url": "/api/video-jobs/" + job.ID},
		"credits_used": 0, "settlement": "final price based on generation",
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"estimated_generation_seconds": estimatedSeconds,
	})
}

func handleLocalH3VideoService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User, cogURL string) {
	_ = cogURL
	input := appNZH3Input(req)
	payload, _ := json.Marshal(input)
	job, err := dbConn.CreateVideoJobForService(user.ID, "local:sync", "h3_video", req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist H3 video job")
		return
	}
	if err := dbConn.UpdateVideoJob(job.ID, "queued", payload, ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist H3 input")
		return
	}
	estimatedUSD, estimatedCredits, estimatedSeconds := h3Estimate(req)
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID, "backend": "local-cog",
		},
		"credits_used": 0, "settlement": "final price based on generation",
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"estimated_generation_seconds": estimatedSeconds,
	})
}

func prepareGeneratedVideoResult(req ServiceUsageRequest, user *User, result []byte) ([]byte, error) {
	if req.Service != "video_generate" || user == nil {
		return result, nil
	}
	var queued openPathsVideoResponse
	if err := json.Unmarshal(result, &queued); err != nil || queued.ID == "" || queued.VideoURL != "" || !isPendingVideoStatus(queued.Status) {
		return result, nil
	}
	job, err := dbConn.CreateVideoJob(user.ID, queued.ID, req.Prompt)
	if err != nil {
		return nil, err
	}
	launchVideoJob(job.ID)
	return json.Marshal(map[string]interface{}{
		"job_id":     job.ID,
		"status":     job.Status,
		"status_url": "/api/video-jobs/" + job.ID,
	})
}

func launchVideoJob(jobID string) {
	if _, loaded := activeVideoJobs.LoadOrStore(jobID, struct{}{}); loaded {
		return
	}
	go func() {
		defer activeVideoJobs.Delete(jobID)
		processVideoJob(jobID)
	}()
}

func indexCompletedVideo(job *VideoJob, result []byte) {
	if videoSearch == nil || job == nil || strings.TrimSpace(job.Prompt) == "" {
		return
	}
	videoSearch.IndexIncremental(job.ID, job.Prompt, extractVideoURLFromResultJSON(string(result)), job.Service)
}

func processVideoJob(jobID string) {
	job, err := dbConn.GetVideoJobInternal(jobID)
	if err != nil || job.Status == "completed" || job.Status == "failed" {
		return
	}
	if job.Service == "h3_video" {
		processH3VideoJob(job)
		return
	}
	if job.Service == "studio_extend" {
		processStudioExtendJob(job)
		return
	}
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil {
		_ = dbConn.UpdateVideoJob(jobID, "failed", nil, "video job owner no longer exists")
		return
	}
	_ = dbConn.UpdateVideoJob(jobID, "processing", nil, "")

	deadline := time.Now().Add(30 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		polled, pollStatus, pollErr := callOpenPathsVideo(
			http.MethodGet,
			openPathsBaseURL+"/v1/videos/generations/"+url.PathEscape(job.ProviderJobID),
			nil,
		)
		if pollErr != nil {
			consecutiveErrors++
			if consecutiveErrors >= 5 {
				_ = dbConn.UpdateVideoJob(jobID, "failed", nil, "provider status unavailable: "+pollErr.Error())
				return
			}
			time.Sleep(2 * time.Second)
			continue
		}
		consecutiveErrors = 0
		var state openPathsVideoResponse
		_ = json.Unmarshal(polled, &state)
		if pollStatus == http.StatusAccepted || (state.Status != "" && isPendingVideoStatus(state.Status)) {
			time.Sleep(2 * time.Second)
			continue
		}
		if strings.EqualFold(state.Status, "failed") || strings.EqualFold(state.Status, "error") || strings.EqualFold(state.Status, "cancelled") {
			_ = dbConn.UpdateVideoJob(jobID, "failed", polled, "video provider reported "+state.Status)
			return
		}

		optimized := optimizeGeneratedVideo(ServiceUsageRequest{Service: "video_generate"}, user, polled)
		if err := dbConn.UpdateVideoJob(jobID, "completed", optimized, ""); err != nil {
			log.Printf("persist completed video job %s: %v", jobID, err)
		} else {
			indexCompletedVideo(job, optimized)
		}
		return
	}
	_ = dbConn.UpdateVideoJob(jobID, "failed", nil, "video provider did not finish within 30 minutes")
}

func h3DownstreamMicros(providerMicros int64) int64 {
	if providerMicros <= 0 {
		return 0
	}
	charged := (providerMicros*(100+h3DownstreamMarkupPercent) + 99) / 100
	if charged < h3MinimumChargeMicros {
		return h3MinimumChargeMicros
	}
	return charged
}

// h3Estimate turns the worker's measured native baseline into a customer-facing
// estimate. Final settlement still uses the provider's actual metered cost.
func h3Estimate(req ServiceUsageRequest) (float64, float64, float64) {
	duration := req.Duration
	if duration <= 0 {
		duration = 5
	}
	steps := req.NumSteps
	if steps <= 0 {
		steps = 20
	}
	sizeFactor := 0.7
	switch req.Size {
	case "preview":
		sizeFactor = 0.45
	case "native":
		sizeFactor = 1
	case "audio":
		sizeFactor = 0.5
	}
	predictSeconds := h3NativeFiveSecondBaseline.Seconds() * (float64(duration) / 5) * (float64(steps) / 20) * sizeFactor
	providerMicros := int64(math.Ceil(servicePricesUSD["h3_video"] * predictSeconds / 3600 * 1_000_000))
	chargedUSD := math.Ceil(float64(h3DownstreamMicros(providerMicros))/10_000) / 100
	creditPrice := getCUTEPriceUSD()
	estimatedCredits := 0.0
	if creditPrice > 0 {
		estimatedCredits = math.Ceil(chargedUSD / creditPrice)
	}
	return chargedUSD, estimatedCredits, predictSeconds
}

func h3Result(pred appNZH3Prediction) map[string]interface{} {
	var result map[string]interface{}
	switch output := pred.Output.(type) {
	case map[string]interface{}:
		result = output
	case string:
		result = map[string]interface{}{"video_url": output}
	default:
		result = map[string]interface{}{"output": output}
	}
	// Cog / serverless often expose the media as `url` (including data: URLs).
	if _, ok := result["video_url"].(string); !ok {
		if u, ok := result["url"].(string); ok && u != "" {
			result["video_url"] = u
		}
	}
	providerUSD := float64(pred.CostMicros) / 1_000_000
	chargedUSD := float64(h3DownstreamMicros(pred.CostMicros)) / 1_000_000
	result["provider"] = "manifoldgen"
	result["provider_cost_usd"] = providerUSD
	result["charged_usd"] = chargedUSD
	return result
}

func processH3VideoJob(job *VideoJob) {
	if strings.HasPrefix(job.ProviderJobID, "local:") {
		processLocalH3VideoJob(job)
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(45 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		envelope, _, err := callAppNZH3(http.MethodGet, "/api/cogs/predictions/"+url.PathEscape(job.ProviderJobID), nil)
		if err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 10 {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video status unavailable: "+err.Error())
				return
			}
			time.Sleep(2 * time.Second)
			continue
		}
		consecutiveErrors = 0
		switch strings.ToLower(strings.TrimSpace(envelope.Prediction.Status)) {
		case "succeeded", "completed":
			if envelope.Prediction.CostMicros <= 0 {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video service returned no billable cost")
				return
			}
			resultMap := h3Result(envelope.Prediction)
			providerUSD := float64(envelope.Prediction.CostMicros) / 1_000_000
			chargedUSD := float64(h3DownstreamMicros(envelope.Prediction.CostMicros)) / 1_000_000
			cutePrice := getCUTEPriceUSD()
			if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "CUTE price unavailable; retry status after pricing recovers")
				return
			}
			resultMap["cute_price_usd"] = cutePrice
			resultMap["credits_used"] = chargedUSD / cutePrice
			result, _ := json.Marshal(resultMap)
			if user, userErr := dbConn.GetUserByID(job.UserID); userErr == nil {
				// Remux onto manifoldgenstatic so the gallery CDN owns durable URLs.
				result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "h3_video"}, user, result)
			}
			_, _, settleErr := dbConn.SettleH3VideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
			if settleErr == ErrVideoPaymentRequired {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.6f (%.6f MANIFOLD) required", chargedUSD, chargedUSD/cutePrice))
				return
			}
			if settleErr != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
				return
			}
			indexCompletedVideo(job, result)
			maybeTriggerAutoTopup(job.UserID)
			return
		case "failed", "cancelled", "canceled":
			message := strings.TrimSpace(envelope.Prediction.Error)
			if message == "" {
				message = "video generation failed"
			}
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, message)
			return
		}
		time.Sleep(2 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video generation did not finish within 45 minutes")
}

func processLocalH3VideoJob(job *VideoJob) {
	cogURL := h3LocalCogURL()
	if cogURL == "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "H3_LOCAL_COG_URL is not configured")
		return
	}
	// Prefer sync POST: this coglet build has no GET /predictions/{id} poll route.
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	input := map[string]interface{}{}
	if len(job.Result) > 0 {
		_ = json.Unmarshal(job.Result, &input)
	}
	if _, ok := input["prompt"]; !ok {
		input = map[string]interface{}{
			"prompt": job.Prompt, "aspect_ratio": "16:9", "size": "balanced",
			"duration": 5, "steps": 20, "structured_prompt": true, "include_audio": true,
			"output_codec": "webm-av1", "encode_quality": 22, "quant": "int8_convrot",
		}
	}
	body, _ := json.Marshal(map[string]interface{}{"input": input})
	req, err := http.NewRequest(http.MethodPost, cogURL+"/predictions", bytes.NewReader(body))
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	// Long-running sync predict (~15 min on 5090 stack-balanced).
	client := &http.Client{Timeout: 50 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "local H3 sync predict: "+err.Error())
		return
	}
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	resp.Body.Close()
	if resp.StatusCode >= 300 {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, strings.TrimSpace(string(data)))
		return
	}
	var poll struct {
		Status      string                 `json:"status"`
		Error       string                 `json:"error"`
		Output      interface{}            `json:"output"`
		Metrics     map[string]interface{} `json:"metrics"`
		PredictTime float64                `json:"predict_time"`
		ID          string                 `json:"id"`
	}
	if err := json.Unmarshal(data, &poll); err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "invalid local H3 response")
		return
	}
	st := strings.ToLower(strings.TrimSpace(poll.Status))
	if st == "starting" || st == "processing" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "local cog returned async prediction but has no poll route; ensure Prefer respond-async is not set")
		return
	}
	if st == "failed" || st == "canceled" || st == "cancelled" {
		msg := strings.TrimSpace(poll.Error)
		if msg == "" {
			msg = "local H3 prediction failed"
		}
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, msg)
		return
	}
	videoURL := extractLocalH3OutputURL(poll.Output)
	if videoURL == "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "local H3 returned no video url")
		return
	}
	predictSeconds := poll.PredictTime
	if predictSeconds <= 0 {
		if metrics := poll.Metrics; metrics != nil {
			if v, ok := metrics["predict_time"].(float64); ok {
				predictSeconds = v
			}
		}
	}
	if predictSeconds <= 0 {
		predictSeconds = 300
	}
	providerUSD := servicePricesUSD["h3_video"] * predictSeconds / 3600
	providerMicros := int64(providerUSD * 1_000_000)
	if providerMicros < 1 {
		providerMicros = 1
	}
	chargedUSD := float64(h3DownstreamMicros(providerMicros)) / 1_000_000
	resultMap := map[string]interface{}{
		"video_url": videoURL, "provider": "manifoldgen",
		"provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
		"predict_seconds": predictSeconds,
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "CUTE price unavailable; retry status after pricing recovers")
		return
	}
	resultMap["cute_price_usd"] = cutePrice
	resultMap["credits_used"] = chargedUSD / cutePrice
	result, _ := json.Marshal(resultMap)
	if user, userErr := dbConn.GetUserByID(job.UserID); userErr == nil {
		result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "h3_video"}, user, result)
	}
	_, _, settleErr := dbConn.SettleH3VideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
	if settleErr == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.6f required", chargedUSD))
		return
	}
	if settleErr != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
}

func extractLocalH3OutputURL(output interface{}) string {
	switch v := output.(type) {
	case string:
		return v
	case map[string]interface{}:
		for _, key := range []string{"video_url", "url"} {
			if u, ok := v[key].(string); ok && u != "" {
				return u
			}
		}
	}
	return ""
}

// handleVideoJobStatus lets a caller recover a paid result after the original
// request disconnects. Pending jobs are relaunched after a process restart.
func handleVideoJobStatus(ctx *fasthttp.RequestCtx, jobID string) {
	var user *User
	var err error
	authHeader := string(ctx.Request.Header.Peek("Authorization"))
	if strings.HasPrefix(authHeader, "Bearer ") {
		user, err = dbConn.GetUserByAPIKey(strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer ")))
	} else if wallet := strings.TrimSpace(string(ctx.QueryArgs().Peek("wallet_address"))); wallet != "" {
		user, err = dbConn.GetUserByWallet(wallet)
	} else {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, "invalid credentials")
		return
	}
	job, err := dbConn.GetVideoJob(strings.TrimSpace(jobID), user.ID)
	if err != nil {
		jsonError(ctx, http.StatusNotFound, "video job not found")
		return
	}
	status := http.StatusOK
	if job.Status == "queued" || job.Status == "processing" || job.Status == "payment_required" {
		launchVideoJob(job.ID)
		status = http.StatusAccepted
	}
	if job.Status == "payment_required" {
		status = http.StatusPaymentRequired
	}
	jsonResponse(ctx, status, map[string]interface{}{
		"job":        job,
		"status_url": "/api/video-jobs/" + job.ID,
	})
}

func proxyFallbackFalVideo(req ServiceUsageRequest) ([]byte, error) {
	if falAPIKey == "" {
		return nil, fmt.Errorf("video generation requires OPENPATHS_API_KEY or FAL_KEY")
	}
	endpoint := "https://fal.run/fal-ai/ltx-2.3/text-to-video"
	payload := map[string]interface{}{
		"prompt":     strings.TrimSpace(req.Prompt),
		"duration":   6,
		"resolution": "1080p",
		"fps":        25,
	}
	if strings.TrimSpace(req.ImageURL) != "" {
		endpoint = "https://fal.run/fal-ai/ltx-2.3/image-to-video"
		payload["image_url"] = strings.TrimSpace(req.ImageURL)
	}
	body, _ := json.Marshal(payload)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Key "+falAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("FAL video fallback returned %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	var result map[string]interface{}
	if json.Unmarshal(data, &result) == nil {
		if result["video_url"] == nil {
			if video, ok := result["video"].(map[string]interface{}); ok {
				if videoURL, _ := video["url"].(string); videoURL != "" {
					result["video_url"] = videoURL
					result["backend_used"] = "fal-ltx-fallback"
					return json.Marshal(result)
				}
			}
		}
	}
	return data, nil
}

func callOpenPathsVideo(method, endpoint string, body []byte) ([]byte, int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 95*time.Second)
	defer cancel()
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+openPathsAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := backendClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode >= 400 {
		return nil, resp.StatusCode, fmt.Errorf("OpenPaths returned %d: %s", resp.StatusCode, strings.TrimSpace(string(data)))
	}
	return data, resp.StatusCode, nil
}

// optimizeGeneratedVideo converts a provider video to AV1 WebM on this host and
// publishes it to the configured ManifoldGen R2 origin. A provider result is still
// returned if optimization fails, so a completed generation is never discarded.
func optimizeGeneratedVideo(req ServiceUsageRequest, user *User, result []byte) []byte {
	if user == nil {
		return result
	}
	switch req.Service {
	case "video_generate", "h3_video", "ltx_video":
	default:
		return result
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(result, &payload); err != nil {
		return result
	}
	source, _ := payload["video_url"].(string)
	if source == "" {
		if nested, ok := payload["result"].(map[string]interface{}); ok {
			source, _ = nested["video_url"].(string)
		}
	}
	if source == "" {
		if u, ok := payload["url"].(string); ok {
			source = u
			payload["video_url"] = u
		}
	}
	if source == "" {
		return result
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Minute)
	defer cancel()
	optimizedURL, optimizedBytes, sourceBytes, err := transcodeAndUploadAV1(ctx, source, user.ID)
	if err != nil {
		log.Printf("video AV1 optimization failed for user=%s: %v", user.ID, err)
		payload["optimization_warning"] = "The generated video is available, but AV1 optimization failed."
		updated, _ := json.Marshal(payload)
		return updated
	}
	payload["original_video_url"] = source
	payload["video_url"] = optimizedURL
	payload["output_format"] = "webm"
	payload["codec"] = "av1"
	payload["bytes"] = optimizedBytes
	payload["original_bytes"] = sourceBytes
	updated, _ := json.Marshal(payload)
	return updated
}

func transcodeAndUploadAV1(ctx context.Context, sourceURL, userID string) (string, int64, int64, error) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return "", 0, 0, fmt.Errorf("ffmpeg is not available")
	}
	tmp, err := os.MkdirTemp("", "manifoldgen-video-av1-*")
	if err != nil {
		return "", 0, 0, err
	}
	defer os.RemoveAll(tmp)
	inputPath := filepath.Join(tmp, "source.mp4")
	outputPath := filepath.Join(tmp, "optimized.webm")
	sourceBytes, err := downloadGeneratedVideo(ctx, sourceURL, inputPath)
	if err != nil {
		return "", 0, 0, err
	}

	encodeArgs := []string{"-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a?", "-c:v", "av1_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-cq", "38", "-b:v", "0", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", outputPath}
	if output, encodeErr := exec.CommandContext(ctx, "ffmpeg", encodeArgs...).CombinedOutput(); encodeErr != nil {
		fallback := []string{"-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libsvtav1", "-crf", "38", "-preset", "8", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", outputPath}
		if fallbackOut, fallbackErr := exec.CommandContext(ctx, "ffmpeg", fallback...).CombinedOutput(); fallbackErr != nil {
			return "", 0, sourceBytes, fmt.Errorf("AV1 encode failed: %s; fallback: %s", tailOutput(output), tailOutput(fallbackOut))
		}
	}
	info, err := os.Stat(outputPath)
	if err != nil || info.Size() == 0 {
		return "", 0, sourceBytes, fmt.Errorf("AV1 encoder produced no output")
	}
	publicURL, err := uploadAV1ToR2(ctx, outputPath, userID)
	if err != nil {
		return "", 0, sourceBytes, err
	}
	return publicURL, info.Size(), sourceBytes, nil
}

func downloadGeneratedVideo(ctx context.Context, sourceURL, destination string) (int64, error) {
	parsed, err := url.Parse(sourceURL)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return 0, fmt.Errorf("generated video URL must be public http(s)")
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	resp, err := backendClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return 0, fmt.Errorf("video download returned %d", resp.StatusCode)
	}
	out, err := os.Create(destination)
	if err != nil {
		return 0, err
	}
	defer out.Close()
	n, err := io.Copy(out, io.LimitReader(resp.Body, maxGeneratedVideoBytes+1))
	if err != nil {
		return 0, err
	}
	if n > maxGeneratedVideoBytes {
		return 0, fmt.Errorf("generated video exceeds 256 MiB")
	}
	return n, nil
}

func uploadAV1ToR2(ctx context.Context, filename, userID string) (string, error) {
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	objectKey := fmt.Sprintf("%s/%s/videos/%s.webm", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID())
	uploadURL, err := presignR2PutObject(objectKey, "video/webm", 900)
	if err != nil {
		return "", err
	}
	f, err := os.Open(filename)
	if err != nil {
		return "", err
	}
	defer f.Close()
	// R2 presigned PUTs reject chunked uploads with 411. Go only infers
	// Content-Length for in-memory readers, so set it from the file size.
	info, err := f.Stat()
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, f)
	if err != nil {
		return "", err
	}
	req.ContentLength = info.Size()
	req.Header.Set("Content-Type", "video/webm")
	resp, err := backendClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("R2 video upload returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func tailOutput(output []byte) string {
	if len(output) > 700 {
		output = output[len(output)-700:]
	}
	return strings.TrimSpace(string(output))
}
