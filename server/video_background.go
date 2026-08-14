package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	falVideoBackgroundRateUSD = 0.00425
	videoBackgroundMarkup     = 1.20
)

var (
	videoBackgroundCircuit = newH3CircuitBreaker(2, 90*time.Second)
	videoBackgroundSubmit  sync.Mutex
)

type videoBackgroundStoredRequest struct {
	Input      ServiceUsageRequest `json:"input"`
	RequestKey string              `json:"_request_key"`
}

type videoBackgroundRunpodStatus struct {
	ID            string `json:"id"`
	Status        string `json:"status"`
	Error         string `json:"error"`
	ExecutionTime int64  `json:"executionTime"`
	Output        struct {
		VideoURL        string  `json:"video_url"`
		DurationSeconds float64 `json:"duration_seconds"`
		ContentType     string  `json:"content_type"`
		Outputs         []struct {
			Filename    string `json:"filename"`
			Data        string `json:"data"`
			ContentType string `json:"content_type"`
		} `json:"outputs"`
		Metrics          map[string]interface{} `json:"metrics"`
		FallbackRequired bool                   `json:"fallback_required"`
		FallbackReason   string                 `json:"fallback_reason"`
		Route            string                 `json:"route"`
	} `json:"output"`
}

type videoBackgroundNativeStatus struct {
	JobID            string                 `json:"job_id"`
	Status           string                 `json:"status"`
	Error            string                 `json:"error"`
	VideoURL         string                 `json:"video_url"`
	ContentType      string                 `json:"content_type"`
	DurationSeconds  float64                `json:"duration_seconds"`
	FallbackRequired bool                   `json:"fallback_required"`
	FallbackReason   string                 `json:"fallback_reason"`
	Route            string                 `json:"route"`
	Metrics          map[string]interface{} `json:"metrics"`
}

func normalizeVideoBackgroundRequest(req *ServiceUsageRequest) error {
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	if err := validateRestyleURL(req.VideoURL); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if req.Duration == 0 {
		req.Duration = 5
	}
	if req.Duration < 1 || req.Duration > 30 {
		return fmt.Errorf("duration must be between 1 and 30 seconds")
	}
	req.BackgroundColor = strings.ToLower(strings.TrimSpace(req.BackgroundColor))
	if req.BackgroundColor == "" {
		req.BackgroundColor = "transparent"
	}
	if req.BackgroundColor != "transparent" {
		return fmt.Errorf("background_color currently supports transparent only")
	}
	req.OutputFormat = strings.ToLower(strings.TrimSpace(req.OutputFormat))
	if req.OutputFormat == "" {
		req.OutputFormat = "webm_vp9"
	}
	if req.OutputFormat != "webm_vp9" {
		return fmt.Errorf("output_format must be webm_vp9 for transparent video")
	}
	if req.PreserveAudio == nil {
		keep := true
		req.PreserveAudio = &keep
	}
	req.Service = "video_background_removal"
	return nil
}

func videoBackgroundRequestKey(req ServiceUsageRequest) string {
	keepAudio := req.PreserveAudio == nil || *req.PreserveAudio
	canonical, _ := json.Marshal(map[string]interface{}{
		"video_url": req.VideoURL, "background_color": req.BackgroundColor,
		"output_format": req.OutputFormat, "preserve_audio": keepAudio,
	})
	digest := sha256.Sum256(canonical)
	return hex.EncodeToString(digest[:])
}

func videoBackgroundChargeUSD(duration float64) float64 {
	if duration <= 0 {
		duration = 1
	}
	// Keep the intentional round-up to microdollars without turning an exact
	// decimal boundary (for example 6 * $0.10) into an extra microdollar due to
	// binary floating-point representation.
	microdollars := duration * videoBackgroundPublicRateUSD() * 1_000_000
	return math.Ceil(microdollars-1e-9) / 1_000_000
}

func videoBackgroundPublicRateUSD() float64 {
	rate, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("VIDEO_BACKGROUND_REMOVAL_RATE_USD_PER_SECOND")), 64)
	if err != nil || rate <= 0 {
		return falVideoBackgroundRateUSD * videoBackgroundMarkup
	}
	return rate
}

func videoBackgroundEstimate(req ServiceUsageRequest) (float64, float64) {
	charged := videoBackgroundChargeUSD(float64(req.Duration))
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = charged / price
	}
	return charged, credits
}

func handleVideoBackgroundRemovalService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeVideoBackgroundRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	requestKey := videoBackgroundRequestKey(req)
	estimatedUSD, estimatedCredits := videoBackgroundEstimate(req)

	// Serialize the read/submit/write window in this API process. The durable
	// JSON key below also deduplicates browser retries after a restart.
	videoBackgroundSubmit.Lock()
	defer videoBackgroundSubmit.Unlock()
	if existing, err := dbConn.FindVideoBackgroundJob(user.ID, requestKey); err == nil {
		jsonResponse(ctx, http.StatusAccepted, videoBackgroundQueuedResponse(existing, estimatedUSD, estimatedCredits, true))
		return
	} else if err != sql.ErrNoRows {
		log.Printf("[video-background] duplicate lookup failed: %v", err)
	}

	providerID, err := submitPrivateVideoBackground(req, user)
	if err != nil {
		log.Printf("[video-background] private submission unavailable: %v", err)
		providerID, err = submitFalVideoBackground(req)
	}
	if err != nil {
		jsonError(ctx, http.StatusServiceUnavailable, "video background removal is temporarily unavailable")
		return
	}
	stored, _ := json.Marshal(videoBackgroundStoredRequest{Input: req, RequestKey: requestKey})
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, "video_background_removal", "Video background removal")
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist video background job")
		return
	}
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist video background input")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, videoBackgroundQueuedResponse(job, estimatedUSD, estimatedCredits, false))
}

func videoBackgroundQueuedResponse(job *VideoJob, estimatedUSD, estimatedCredits float64, deduplicated bool) map[string]interface{} {
	return map[string]interface{}{
		"service":            "video_background_removal",
		"result":             map[string]interface{}{"job_id": job.ID, "status": job.Status, "status_url": "/api/video-jobs/" + job.ID},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"settlement": "final price follows source duration", "deduplicated": deduplicated,
	}
}

func videoBackgroundEndpointID() string {
	return strings.TrimSpace(os.Getenv("VIDEO_BACKGROUND_RUNPOD_ENDPOINT_ID"))
}

func videoBackgroundNativeBaseURL() string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv("VIDEO_BACKGROUND_NATIVE_BASE_URL")), "/")
}

func callVideoBackgroundNative(method, path string, payload interface{}, target interface{}) (int, error) {
	base := videoBackgroundNativeBaseURL()
	if base == "" {
		return 0, fmt.Errorf("native video worker is not configured")
	}
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return 0, err
		}
		body = bytes.NewReader(encoded)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, method, base+path, body)
	if err != nil {
		return 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	if secret := strings.TrimSpace(os.Getenv("VIDEO_BACKGROUND_NATIVE_SECRET")); secret != "" {
		request.Header.Set("Authorization", "Bearer "+secret)
	}
	response, err := backendClient.Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	data, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return response.StatusCode, err
	}
	if response.StatusCode >= 300 {
		return response.StatusCode, fmt.Errorf("native video worker returned %d: %s", response.StatusCode, strings.TrimSpace(string(data)))
	}
	if target != nil && json.Unmarshal(data, target) != nil {
		return response.StatusCode, fmt.Errorf("native video worker returned invalid JSON")
	}
	return response.StatusCode, nil
}

func videoBackgroundUploadTarget(user *User) (string, string, error) {
	shortID := sanitizeUploadName(user.ID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	objectKey := fmt.Sprintf("%s/%s/video-background/%s.webm", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID())
	uploadURL, err := presignR2PutObject(objectKey, "video/webm", 7200)
	if err != nil {
		return "", "", err
	}
	return uploadURL, fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func submitPrivateVideoBackground(req ServiceUsageRequest, user *User) (string, error) {
	uploadURL, publicURL, err := videoBackgroundUploadTarget(user)
	if err != nil {
		return "", err
	}
	keepAudio := req.PreserveAudio == nil || *req.PreserveAudio
	input := map[string]interface{}{
		"video_url": req.VideoURL, "preserve_audio": keepAudio,
		"output_upload_url": uploadURL, "output_public_url": publicURL,
	}
	if nativeBase := videoBackgroundNativeBaseURL(); nativeBase != "" && videoBackgroundCircuit.allow(nativeBase) {
		var queued videoBackgroundNativeStatus
		_, nativeErr := callVideoBackgroundNative(http.MethodPost, "/v1/videos/background-removals/jobs", input, &queued)
		if nativeErr == nil && queued.JobID != "" {
			videoBackgroundCircuit.success(nativeBase)
			return "native-bg:" + queued.JobID, nil
		}
		videoBackgroundCircuit.failure(nativeBase)
		log.Printf("[video-background] dedicated native submission unavailable: %v", nativeErr)
	}
	endpointID := videoBackgroundEndpointID()
	if endpointID == "" {
		return "", fmt.Errorf("private endpoint is not configured")
	}
	if !videoBackgroundCircuit.allow(endpointID) {
		return "", fmt.Errorf("private endpoint circuit is open")
	}
	input["workload"] = "video-matting"
	var queued h3RunpodQueuedJob
	status, err := callH3Runpod(endpointID, "/run", http.MethodPost, map[string]interface{}{"input": input}, &queued)
	if err != nil || queued.ID == "" {
		videoBackgroundCircuit.failure(endpointID)
		if err != nil {
			return "", err
		}
		return "", fmt.Errorf("private endpoint returned no job (status %d)", status)
	}
	videoBackgroundCircuit.success(endpointID)
	return "runpod-bg:" + endpointID + ":" + queued.ID, nil
}

func submitFalVideoBackground(req ServiceUsageRequest) (string, error) {
	if falAPIKey == "" {
		return "", fmt.Errorf("standby video service is not configured")
	}
	keepAudio := req.PreserveAudio == nil || *req.PreserveAudio
	payload := map[string]interface{}{
		"video_url": req.VideoURL, "background_color": "Transparent",
		"output_container_and_codec": "webm_vp9", "preserve_audio": keepAudio,
	}
	data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/bria/video/background-removal", payload)
	if err != nil {
		return "", err
	}
	var queued falQueueResponse
	if json.Unmarshal(data, &queued) != nil || queued.RequestID == "" {
		return "", fmt.Errorf("standby video service returned no job")
	}
	return "fal-bg:" + queued.RequestID, nil
}

func parseRunpodVideoBackgroundJob(value string) (endpointID, jobID string, ok bool) {
	parts := strings.SplitN(value, ":", 3)
	if len(parts) != 3 || parts[0] != "runpod-bg" || parts[1] == "" || parts[2] == "" {
		return "", "", false
	}
	return parts[1], parts[2], true
}

func processVideoBackgroundRemovalJob(job *VideoJob) {
	var stored videoBackgroundStoredRequest
	if json.Unmarshal(job.Result, &stored) != nil || normalizeVideoBackgroundRequest(&stored.Input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved video background request is invalid")
		return
	}
	if stored.RequestKey == "" {
		stored.RequestKey = videoBackgroundRequestKey(stored.Input)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	if strings.HasPrefix(job.ProviderJobID, "native-bg:") {
		if processNativeVideoBackground(job, stored) {
			return
		}
		if !moveVideoBackgroundToStandby(job, stored) {
			return
		}
	}
	if strings.HasPrefix(job.ProviderJobID, "runpod-bg:") {
		if processPrivateVideoBackground(job, stored) {
			return
		}
		if !moveVideoBackgroundToStandby(job, stored) {
			return
		}
	}
	processFalVideoBackground(job, stored)
}

func moveVideoBackgroundToStandby(job *VideoJob, stored videoBackgroundStoredRequest) bool {
	fallbackID, err := submitFalVideoBackground(stored.Input)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background removal could not be recovered")
		return false
	}
	persisted, _ := json.Marshal(stored)
	if dbConn.UpdateVideoJobProvider(job.ID, fallbackID, "processing", persisted) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "could not move video background removal to standby")
		return false
	}
	job.ProviderJobID = fallbackID
	return true
}

func processNativeVideoBackground(job *VideoJob, stored videoBackgroundStoredRequest) bool {
	providerJobID := strings.TrimPrefix(job.ProviderJobID, "native-bg:")
	if providerJobID == "" {
		return false
	}
	base := videoBackgroundNativeBaseURL()
	deadline := time.Now().Add(45 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		var state videoBackgroundNativeStatus
		_, err := callVideoBackgroundNative(http.MethodGet, "/v1/videos/background-removals/jobs/"+url.PathEscape(providerJobID), nil, &state)
		if err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 5 {
				videoBackgroundCircuit.failure(base)
				return false
			}
			time.Sleep(2 * time.Second)
			continue
		}
		consecutiveErrors = 0
		switch strings.ToLower(strings.TrimSpace(state.Status)) {
		case "done":
			videoBackgroundCircuit.success(base)
			if state.FallbackRequired {
				log.Printf("[video-background] native route requested standby job=%s route=%s reason=%s", job.ID, state.Route, state.FallbackReason)
				return false
			}
			if strings.TrimSpace(state.VideoURL) == "" {
				videoBackgroundCircuit.failure(base)
				return false
			}
			duration := state.DurationSeconds
			if duration <= 0 {
				measured, err := measureRemoteVideoDuration(state.VideoURL)
				if err != nil {
					_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background output duration could not be verified")
					return true
				}
				duration = measured
			}
			return settleVideoBackground(job, stored, state.VideoURL, state.ContentType, duration, 0)
		case "error":
			videoBackgroundCircuit.failure(base)
			return false
		}
		time.Sleep(2 * time.Second)
	}
	videoBackgroundCircuit.failure(base)
	return false
}

// A false return means only that the private worker is unavailable, so the
// caller may continue this same durable job on standby capacity.
func processPrivateVideoBackground(job *VideoJob, stored videoBackgroundStoredRequest) bool {
	endpointID, providerJobID, ok := parseRunpodVideoBackgroundJob(job.ProviderJobID)
	if !ok {
		return false
	}
	deadline := time.Now().Add(45 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		var state videoBackgroundRunpodStatus
		_, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state)
		if err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 5 {
				videoBackgroundCircuit.failure(endpointID)
				return false
			}
			time.Sleep(2 * time.Second)
			continue
		}
		consecutiveErrors = 0
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED":
			if state.Output.FallbackRequired {
				videoBackgroundCircuit.success(endpointID)
				log.Printf("[video-background] RunPod route requested standby job=%s route=%s reason=%s", job.ID, state.Output.Route, state.Output.FallbackReason)
				return false
			}
			videoURL := strings.TrimSpace(state.Output.VideoURL)
			contentType := state.Output.ContentType
			if videoURL == "" && len(state.Output.Outputs) > 0 && state.Output.Outputs[0].Data != "" {
				artifact, err := base64.StdEncoding.DecodeString(state.Output.Outputs[0].Data)
				if err == nil {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
					videoURL, err = uploadH3RunpodVideo(ctx, artifact, job.UserID, state.Output.Outputs[0].ContentType)
					cancel()
				}
				if err != nil {
					return false
				}
			}
			if videoURL == "" {
				videoBackgroundCircuit.failure(endpointID)
				return false
			}
			videoBackgroundCircuit.success(endpointID)
			duration := state.Output.DurationSeconds
			if duration <= 0 {
				measured, err := measureRemoteVideoDuration(videoURL)
				if err != nil {
					log.Printf("[video-background] private output duration unavailable job=%s: %v", job.ID, err)
					_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background output duration could not be verified")
					return true
				}
				duration = measured
			}
			providerUSD := videoBackgroundPrivateProviderUSD(state.ExecutionTime)
			return settleVideoBackground(job, stored, videoURL, contentType, duration, providerUSD)
		case "FAILED", "CANCELLED", "TIMED_OUT":
			videoBackgroundCircuit.failure(endpointID)
			return false
		}
		time.Sleep(2 * time.Second)
	}
	videoBackgroundCircuit.failure(endpointID)
	return false
}

func videoBackgroundPrivateProviderUSD(executionMS int64) float64 {
	rate, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("VIDEO_BACKGROUND_RUNPOD_GPU_USD_PER_HOUR")), 64)
	if err != nil || rate <= 0 {
		rate = 0.69
	}
	seconds := float64(executionMS) / 1000
	if seconds <= 0 {
		seconds = 1
	}
	return rate * seconds / 3600
}

func processFalVideoBackground(job *VideoJob, stored videoBackgroundStoredRequest) {
	requestID := strings.TrimPrefix(job.ProviderJobID, "fal-bg:")
	base := falVideoBackgroundRequestBase(requestID)
	deadline := time.Now().Add(45 * time.Minute)
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
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "completed background removal could not be retrieved")
				return
			}
			var payload map[string]interface{}
			if json.Unmarshal(result, &payload) != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background service returned an invalid result")
				return
			}
			videoURL := resultURLFromMap(payload)
			if nested, ok := payload["video"].(map[string]interface{}); videoURL == "" && ok {
				videoURL, _ = nested["url"].(string)
			}
			if videoURL == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background service returned no video")
				return
			}
			duration := videoBackgroundResultDuration(payload)
			if mirrored, measured, mirrorErr := mirrorVideoBackgroundResult(job.UserID, videoURL); mirrorErr == nil {
				videoURL = mirrored
				duration = measured
			} else {
				log.Printf("[video-background] standby result mirror failed job=%s: %v", job.ID, mirrorErr)
			}
			if duration <= 0 {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background output duration could not be verified")
				return
			}
			providerUSD := falVideoBackgroundRateUSD * duration
			_ = settleVideoBackground(job, stored, videoURL, "video/webm", duration, providerUSD)
			return
		case "failed", "cancelled", "canceled":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background removal failed")
			return
		}
		time.Sleep(2500 * time.Millisecond)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "video background removal did not finish in time")
}

func falVideoBackgroundRequestBase(requestID string) string {
	// BRIA submissions use /bria/video/background-removal, but FAL's queued
	// response_url and status_url use the shared /bria/video request namespace.
	return "https://queue.fal.run/bria/video/requests/" + url.PathEscape(requestID)
}

func mirrorVideoBackgroundResult(userID, sourceURL string) (string, float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	artifact, err := downloadVideoBackgroundArtifact(ctx, sourceURL)
	if err != nil {
		return "", 0, err
	}
	duration, err := measureVideoDuration(ctx, artifact)
	if err != nil {
		return "", 0, err
	}
	publicURL, err := uploadH3RunpodVideo(ctx, artifact, userID, "video/webm")
	if err != nil {
		return "", 0, err
	}
	return publicURL, duration, nil
}

func measureRemoteVideoDuration(sourceURL string) (float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	artifact, err := downloadVideoBackgroundArtifact(ctx, sourceURL)
	if err != nil {
		return 0, err
	}
	return measureVideoDuration(ctx, artifact)
}

func downloadVideoBackgroundArtifact(ctx context.Context, sourceURL string) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, sourceURL, nil)
	if err != nil {
		return nil, err
	}
	response, err := backendClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("video download returned %d", response.StatusCode)
	}
	artifact, err := io.ReadAll(io.LimitReader(response.Body, maxGeneratedVideoBytes+1))
	if err != nil {
		return nil, err
	}
	if len(artifact) > maxGeneratedVideoBytes {
		return nil, fmt.Errorf("video exceeds 256 MiB")
	}
	return artifact, nil
}

func measureVideoDuration(ctx context.Context, artifact []byte) (float64, error) {
	if len(artifact) == 0 {
		return 0, fmt.Errorf("video artifact is empty")
	}
	command := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", "pipe:0")
	command.Stdin = bytes.NewReader(artifact)
	output, err := command.CombinedOutput()
	if err != nil {
		return 0, fmt.Errorf("ffprobe duration: %w", err)
	}
	duration, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
	if err != nil || duration <= 0 || math.IsNaN(duration) || math.IsInf(duration, 0) {
		return 0, fmt.Errorf("ffprobe returned invalid duration %q", strings.TrimSpace(string(output)))
	}
	return duration, nil
}

func videoBackgroundResultDuration(payload map[string]interface{}) float64 {
	for _, key := range []string{"duration_seconds", "duration"} {
		if duration, ok := numericDuration(payload[key]); ok {
			return duration
		}
	}
	for _, key := range []string{"video", "output", "data"} {
		if nested, ok := payload[key].(map[string]interface{}); ok {
			if duration := videoBackgroundResultDuration(nested); duration > 0 {
				return duration
			}
		}
	}
	return 0
}

func numericDuration(value interface{}) (float64, bool) {
	var duration float64
	switch typed := value.(type) {
	case float64:
		duration = typed
	case json.Number:
		duration, _ = typed.Float64()
	case string:
		duration, _ = strconv.ParseFloat(strings.TrimSpace(typed), 64)
	}
	return duration, duration > 0 && !math.IsNaN(duration) && !math.IsInf(duration, 0)
}

func settleVideoBackground(job *VideoJob, stored videoBackgroundStoredRequest, videoURL, contentType string, duration, providerUSD float64) bool {
	chargedUSD := videoBackgroundChargeUSD(duration)
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return true
	}
	result, _ := json.Marshal(map[string]interface{}{
		"video_url": videoURL, "content_type": contentType, "duration_seconds": duration,
		"output_format": "webm", "codec": "vp9", "has_alpha": true,
		"_request_key": stored.RequestKey, "charged_usd": chargedUSD,
		"credits_used": chargedUSD / cutePrice,
	})
	_, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
	if err == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed video; $%.4f required", chargedUSD))
		return true
	}
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return true
	}
	maybeTriggerAutoTopup(job.UserID)
	return true
}
