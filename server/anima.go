package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const animaMaxPixels = 1024 * 1024

func animaNativeURL() string {
	return strings.TrimRight(getEnv("ANIMA_NATIVE_URL", getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791")), "/")
}

// Kept for polling jobs created by the previous RunPod-backed implementation.
func animaEndpointID() string {
	return strings.TrimSpace(os.Getenv("ANIMA_RUNPOD_ENDPOINT_ID"))
}

func animaAvailable() bool {
	return animaNativeURL() != ""
}

func animaUnavailableReason() string {
	if animaNativeURL() == "" {
		return "capacity_not_configured"
	}
	return ""
}

func animaModelName() string {
	return getEnv("ANIMA_MODEL_NAME", "z_image_turbo-Q4_K")
}

func handleAnimaStatus(ctx *fasthttp.RequestCtx) {
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"available": animaAvailable(), "reason": animaUnavailableReason(),
		"model": animaModelName(), "price_usd": servicePricesUSD["anima"],
		"billing": "fixed price per successful illustration",
		"backend": "omniserve-native",
	})
}

func normalizeAnimaRequest(req *ServiceUsageRequest) error {
	req.Service = "anima"
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if len(req.Prompt) > 2400 {
		return fmt.Errorf("prompt must be 2400 characters or fewer")
	}
	if len(req.NegativePrompt) > 1200 {
		return fmt.Errorf("negative_prompt must be 1200 characters or fewer")
	}
	if isChildPrompt(req.Prompt) || isChildPrompt(req.NegativePrompt) {
		return fmt.Errorf("prompts involving minors are not supported")
	}
	if req.N > 1 || req.NumImages > 1 {
		return fmt.Errorf("Anima currently supports one image per request")
	}
	req.N = 1
	req.NumImages = 1
	if req.Width == 0 {
		req.Width = 768
	}
	if req.Height == 0 {
		req.Height = 1024
	}
	if req.Width < 512 || req.Width > 1536 || req.Height < 512 || req.Height > 1536 {
		return fmt.Errorf("width and height must be between 512 and 1536")
	}
	// OmniServe's native diffusion parser requires 64-pixel increments.
	req.Width = max(512, (req.Width/64)*64)
	req.Height = max(512, (req.Height/64)*64)
	if req.Width*req.Height > animaMaxPixels {
		return fmt.Errorf("Anima images may contain at most 1048576 pixels")
	}
	if req.NumSteps == 0 {
		req.NumSteps = 28
	}
	if req.NumSteps < 10 || req.NumSteps > 50 {
		return fmt.Errorf("num_steps must be between 10 and 50")
	}
	if req.Guidance == 0 {
		req.Guidance = 4
	}
	if req.Guidance < 1 || req.Guidance > 8 {
		return fmt.Errorf("guidance must be between 1 and 8")
	}
	if req.Seed < 0 {
		return fmt.Errorf("seed must be non-negative")
	}
	req.OutputFormat = "webp"
	return nil
}

func animaWorkerInput(req ServiceUsageRequest) map[string]interface{} {
	return map[string]interface{}{
		"prompt": req.Prompt, "negative_prompt": strings.TrimSpace(req.NegativePrompt),
		"width": req.Width, "height": req.Height, "num_inference_steps": req.NumSteps,
		"guidance_scale": req.Guidance, "seed": req.Seed, "output_format": "webp",
	}
}

func submitAnimaRunpod(input map[string]interface{}, queued *h3RunpodQueuedJob) (int, error) {
	endpointID := animaEndpointID()
	if endpointID == "" {
		return 0, fmt.Errorf("Anima endpoint is not configured")
	}
	lock := h3EndpointScaleLock(endpointID)
	lock.Lock()
	defer lock.Unlock()
	config, err := h3EndpointConfig(endpointID)
	if err != nil {
		return 0, err
	}
	if config.WorkersMax != 1 {
		if err := h3SetWorkersMax(endpointID, 1); err != nil {
			return 0, err
		}
	}
	var status int
	for attempt := 0; attempt < 7; attempt++ {
		status, err = callH3Runpod(endpointID, "/run", http.MethodPost, map[string]interface{}{"input": input}, queued)
		if status != http.StatusConflict || err == nil || !strings.Contains(err.Error(), "ENDPOINT_PAUSED") {
			return status, err
		}
		if err := h3SetWorkersMax(endpointID, 1); err != nil {
			return status, err
		}
		time.Sleep(h3ScalePropagationDelay)
	}
	return status, err
}

func animaEstimate() (float64, float64) {
	usd := servicePricesUSD["anima"]
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = usd / price
	}
	return usd, credits
}

type animaNativeImageResponse struct {
	Model  string `json:"model"`
	Format string `json:"format"`
	Data   []struct {
		B64JSON string `json:"b64_json"`
	} `json:"data"`
}

func animaNativeSecret() string {
	return strings.TrimSpace(getEnv("OMNISERVE_NATIVE_SECRET", getEnv("OMNISERVE_SECRET", "")))
}

func callAnimaNative(input map[string]interface{}) ([]byte, string, error) {
	body, err := json.Marshal(input)
	if err != nil {
		return nil, "", err
	}
	endpoint := animaNativeURL() + "/v1/images/generations"
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, "", err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Omniserve-Tier", "paid")
	if secret := animaNativeSecret(); secret != "" {
		request.Header.Set("Authorization", "Bearer "+secret)
	}
	client := *backendClient
	client.Timeout = 45 * time.Minute
	response, err := client.Do(request)
	if err != nil {
		return nil, "", err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(response.Body, h3ImageMaxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if response.StatusCode >= 300 {
		return nil, "", fmt.Errorf("OmniServe image generation returned %d: %s", response.StatusCode, tailOutput(responseBody))
	}
	var decoded animaNativeImageResponse
	if err := json.Unmarshal(responseBody, &decoded); err != nil {
		return nil, "", fmt.Errorf("OmniServe returned invalid image JSON: %w", err)
	}
	if len(decoded.Data) == 0 || strings.TrimSpace(decoded.Data[0].B64JSON) == "" {
		return nil, "", fmt.Errorf("OmniServe returned no image data")
	}
	artifact, err := base64.StdEncoding.DecodeString(decoded.Data[0].B64JSON)
	if err != nil || len(artifact) == 0 || len(artifact) > h3ImageMaxBytes {
		return nil, "", fmt.Errorf("OmniServe returned an invalid image artifact")
	}
	contentType := "image/png"
	if strings.EqualFold(strings.TrimSpace(decoded.Format), "webp") || strings.EqualFold(strings.TrimSpace(decoded.Format), "image/webp") {
		contentType = "image/webp"
	}
	return artifact, contentType, nil
}

func processAnimaNativeJob(job *VideoJob) {
	var input map[string]interface{}
	if err := json.Unmarshal(job.Result, &input); err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved Anima request is invalid")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	started := time.Now()
	artifact, contentType, err := callAnimaNative(input)
	if err != nil {
		log.Printf("[anima] OmniServe generation failed job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "Anima illustration failed")
		return
	}
	completeAnimaJob(job, input, artifact, contentType, time.Since(started).Seconds(), 0, "omniserve-native")
}

func completeAnimaJob(job *VideoJob, input map[string]interface{}, artifact []byte, contentType string, executionSeconds, providerUSD float64, provider string) {
	outputNSFW, outputScore, err := classifyH3Image(artifact)
	if err != nil {
		log.Printf("[anima] output moderation unavailable job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image safety check is temporarily unavailable")
		return
	}
	uploadContext, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	imageURL, relPath, err := uploadGeneratedImageArtifact(uploadContext, artifact, job.UserID, contentType, "anima")
	cancel()
	if err != nil {
		log.Printf("[anima] output upload failed job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image storage is temporarily unavailable")
		return
	}
	chargedUSD, _ := animaEstimate()
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	width := intFromInterface(input["width"], 768)
	height := intFromInterface(input["height"], 1024)
	steps := intFromInterface(input["num_inference_steps"], 28)
	seed := intFromInterface(input["seed"], 0)
	result, _ := json.Marshal(map[string]interface{}{
		"image_url": imageURL, "gallery_file_path": relPath, "image_id": "anima_" + newUUID(),
		"width": width, "height": height, "steps": steps, "seed": seed, "bytes": len(artifact),
		"is_nsfw": outputNSFW, "nsfw_score": outputScore, "provider": provider,
		"provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
		"cute_price_usd": cutePrice, "credits_used": chargedUSD / cutePrice,
	})
	_, _, settleErr := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
	if settleErr == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, fmt.Sprintf("top up to release completed image; $%.2f required", chargedUSD))
		return
	}
	if settleErr != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, "settlement unavailable; retry status")
		return
	}
	job.Result = result
	job.Status = "completed"
	if err := persistH3ImageJobResult(job); err != nil {
		log.Printf("[anima] gallery persistence failed job=%s: %v", job.ID, err)
	}
	margin := 0.0
	if chargedUSD > 0 {
		margin = (chargedUSD - providerUSD) / chargedUSD
	}
	log.Printf("[anima] provider=%s charged_usd=%.4f metered_execution_usd=%.4f execution_seconds=%.3f metered_margin=%.1f%%", provider, chargedUSD, providerUSD, executionSeconds, margin*100)
	maybeTriggerAutoTopup(job.UserID)
}

func handleAnimaService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if !animaAvailable() {
		jsonError(ctx, http.StatusServiceUnavailable, "Anima native image capacity is temporarily unavailable")
		return
	}
	if err := normalizeAnimaRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	chargedUSD, credits := animaEstimate()
	if credits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if user.Credits+1e-9 < credits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits ($%.2f), have %.2f", credits, chargedUSD, user.Credits))
		return
	}
	if jobs, err := dbConn.ListVideoJobs(user.ID, 100); err == nil {
		for i := range jobs {
			status := strings.ToLower(strings.TrimSpace(jobs[i].Status))
			if jobs[i].Service == "anima" && (status == "queued" || status == "processing") {
				jsonError(ctx, http.StatusConflict, "finish the current Anima illustration before starting another")
				return
			}
		}
	}
	input := animaWorkerInput(req)
	job, err := dbConn.CreateVideoJobForService(user.ID, "native:"+newUUID(), "anima", req.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to create Anima job")
		return
	}
	stored, _ := json.Marshal(input)
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist Anima job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": "anima", "result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
		},
		"estimated_cost_usd": chargedUSD, "estimated_credits": credits,
		"settlement": "fixed price confirmed before generation",
	})
}

func animaGPUHourlyUSD() float64 {
	if configured, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("ANIMA_RUNPOD_GPU_USD_PER_HOUR")), 64); err == nil && configured > 0 {
		return configured
	}
	// Use the current L40/L40S/RTX 6000 Ada Flex ceiling ($0.00053/s)
	// because a mixed 48 GB endpoint can place on that more expensive pool.
	return 1.908
}

func processAnimaJob(job *VideoJob) {
	if strings.HasPrefix(job.ProviderJobID, "native:") {
		processAnimaNativeJob(job)
		return
	}
	endpointID, providerJobID, ok := parseRunpodH3ProviderJob(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "Anima provider job is invalid")
		return
	}
	defer scheduleH3ScaleToZero(endpointID)
	var input map[string]interface{}
	if json.Unmarshal(job.Result, &input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved Anima request is invalid")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(45 * time.Minute)
	for time.Now().Before(deadline) {
		var state h3RunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state); err != nil {
			time.Sleep(2 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED", "SUCCEEDED":
			if len(state.Output.Outputs) == 0 || state.Output.Outputs[0].Data == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "Anima returned no illustration")
				return
			}
			artifact, err := base64.StdEncoding.DecodeString(state.Output.Outputs[0].Data)
			if err != nil || len(artifact) == 0 || len(artifact) > h3ImageMaxBytes {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "Anima returned an invalid illustration")
				return
			}
			outputNSFW, outputScore, err := classifyH3Image(artifact)
			if err != nil {
				log.Printf("[anima] output moderation unavailable job=%s: %v", job.ID, err)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image safety check is temporarily unavailable")
				return
			}
			uploadContext, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			imageURL, relPath, err := uploadGeneratedImageArtifact(uploadContext, artifact, job.UserID, state.Output.Outputs[0].ContentType, "anima")
			cancel()
			if err != nil {
				log.Printf("[anima] output upload failed job=%s: %v", job.ID, err)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image storage is temporarily unavailable")
				return
			}
			seconds := math.Max(1, float64(state.ExecutionTime)/1000)
			providerUSD := animaGPUHourlyUSD() * seconds / 3600
			chargedUSD, _ := animaEstimate()
			cutePrice := getCUTEPriceUSD()
			if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
				return
			}
			width := intFromInterface(input["width"], 768)
			height := intFromInterface(input["height"], 1024)
			steps := intFromInterface(input["num_inference_steps"], 28)
			seed := intFromInterface(input["seed"], 0)
			result, _ := json.Marshal(map[string]interface{}{
				"image_url": imageURL, "gallery_file_path": relPath, "image_id": "anima_" + newUUID(),
				"width": width, "height": height, "steps": steps, "seed": seed, "bytes": len(artifact),
				"is_nsfw": outputNSFW, "nsfw_score": outputScore, "provider": "runpod",
				"provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
				"cute_price_usd": cutePrice, "credits_used": chargedUSD / cutePrice,
			})
			_, _, settleErr := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
			if settleErr == ErrVideoPaymentRequired {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, fmt.Sprintf("top up to release completed image; $%.2f required", chargedUSD))
				return
			}
			if settleErr != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, "settlement unavailable; retry status")
				return
			}
			job.Result = result
			job.Status = "completed"
			if err := persistH3ImageJobResult(job); err != nil {
				log.Printf("[anima] gallery persistence failed job=%s: %v", job.ID, err)
			}
			margin := 0.0
			if chargedUSD > 0 {
				margin = (chargedUSD - providerUSD) / chargedUSD
			}
			log.Printf("[anima] charged_usd=%.4f metered_execution_usd=%.4f execution_seconds=%.3f metered_margin=%.1f%%", chargedUSD, providerUSD, seconds, margin*100)
			maybeTriggerAutoTopup(job.UserID)
			return
		case "FAILED", "CANCELLED", "CANCELED", "TIMED_OUT":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "Anima illustration failed")
			return
		}
		time.Sleep(2 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "Anima illustration timed out")
}
