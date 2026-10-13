package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	animePoseControlService   = "anime_pose_control"
	animeSceneControlService  = "anime_scene_control"
	animeDepthControlService  = "anime_depth_control"
	animeSketchControlService = "anime_sketch_control"

	animeControlMaxPixels  = 1024 * 1024
	animeControlMaxRefEdge = 1280
	animeControlMaxInline  = 6 << 20
	animeControlNegative   = "worst quality, low quality, bad anatomy, bad hands, extra fingers, fused fingers, deformed, extra limbs, missing limbs, watermark, text"
)

type animeControlKind struct {
	Service  string
	Workload string
	PriceUSD float64
	Maps     map[string]string
	PhotoKey string
}

var animeControlKinds = map[string]*animeControlKind{
	animePoseControlService: {
		Service: animePoseControlService, Workload: "anime-pose-control", PriceUSD: 0.08,
		Maps: map[string]string{"skeleton": "skeleton_image", "pose_map": "pose_map"}, PhotoKey: "reference_image",
	},
	animeSceneControlService: {
		Service: animeSceneControlService, Workload: "anime-scene-control", PriceUSD: 0.10,
		Maps: map[string]string{"region_map": "region_map", "pose_map": "pose_map"},
	},
	animeDepthControlService: {
		Service: animeDepthControlService, Workload: "anime-depth-control", PriceUSD: 0.10,
		Maps: map[string]string{"depth_image": "depth_image"}, PhotoKey: "reference_image",
	},
	animeSketchControlService: {
		Service: animeSketchControlService, Workload: "anime-sketch-control", PriceUSD: 0.12,
		Maps: map[string]string{"edge_image": "edge_image"}, PhotoKey: "reference_image",
	},
}

func animeControlKindFor(service string) *animeControlKind {
	return animeControlKinds[service]
}

func isAnimeControlService(service string) bool {
	return animeControlKinds[service] != nil
}

func animeControlEndpointID(kind *animeControlKind) string {
	if value := strings.TrimSpace(os.Getenv(strings.ToUpper(kind.Service) + "_RUNPOD_ENDPOINT_ID")); value != "" {
		return value
	}
	return strings.TrimSpace(os.Getenv("ANIME_CONTROL_RUNPOD_ENDPOINT_ID"))
}

func animeControlEstimate(kind *animeControlKind) (float64, float64) {
	usd := servicePricesUSD[kind.Service]
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = usd / price
	}
	return usd, credits
}

func validateAnimeControlURL(value string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme != "https" || parsed.User != nil {
		return fmt.Errorf("a public HTTPS image URL or an inline PNG is required")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".local") {
		return fmt.Errorf("a public HTTPS image URL or an inline PNG is required")
	}
	if address := net.ParseIP(host); address != nil && (address.IsPrivate() || address.IsLoopback() || address.IsUnspecified() || address.IsLinkLocalUnicast() || !address.IsGlobalUnicast()) {
		return fmt.Errorf("a public HTTPS image URL or an inline PNG is required")
	}
	return nil
}

func validateAnimeControlSource(value string) error {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "data:image/") {
		if len(value) > animeControlMaxInline*4/3+64 {
			return fmt.Errorf("inline image is too large")
		}
		return nil
	}
	if err := validateAnimeControlURL(value); err != nil {
		return err
	}
	return validateRestyleMediaKind(value, "image")
}

func normalizeAnimeControlRequest(kind *animeControlKind, req *ServiceUsageRequest) error {
	req.Service = kind.Service
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.NegativePrompt = strings.TrimSpace(req.NegativePrompt)
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
	provided := 0
	for key, value := range req.ControlImages {
		if strings.TrimSpace(value) == "" {
			delete(req.ControlImages, key)
		}
	}
	for key := range req.ControlImages {
		if kind.Maps[key] == "" {
			return fmt.Errorf("control_images.%s is not supported by this tool", key)
		}
	}
	for key, value := range req.ControlImages {
		if err := validateAnimeControlSource(value); err != nil {
			return fmt.Errorf("control_images.%s: %w", key, err)
		}
		provided++
	}
	if req.ImageURL != "" {
		if kind.PhotoKey == "" {
			return fmt.Errorf("image_url is not supported by this tool")
		}
		if err := validateAnimeControlSource(req.ImageURL); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
		provided++
	}
	if provided == 0 {
		return fmt.Errorf("provide a control image")
	}
	if req.N > 1 || req.NumImages > 1 {
		return fmt.Errorf("one image per request is supported")
	}
	req.N, req.NumImages = 1, 1
	if req.Width == 0 {
		req.Width = 1024
	}
	if req.Height == 0 {
		req.Height = 1024
	}
	if req.Width < 512 || req.Width > 1536 || req.Height < 512 || req.Height > 1536 {
		return fmt.Errorf("width and height must be between 512 and 1536")
	}
	req.Width = max(512, (req.Width/16)*16)
	req.Height = max(512, (req.Height/16)*16)
	if req.Width*req.Height > animeControlMaxPixels {
		return fmt.Errorf("images may contain at most 1048576 pixels")
	}
	if req.NumSteps == 0 {
		req.NumSteps = 24
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
	if req.Strength == 0 {
		req.Strength = 1
	}
	if req.Strength < 0.2 || req.Strength > 1.5 {
		return fmt.Errorf("strength must be between 0.2 and 1.5")
	}
	for key, value := range req.ControlStrengths {
		if key != "regional" && key != "pose" {
			return fmt.Errorf("control_strengths.%s is not supported", key)
		}
		if value < 0 || value > 1.5 {
			return fmt.Errorf("control_strengths.%s must be between 0 and 1.5", key)
		}
	}
	if req.Seed < 0 {
		return fmt.Errorf("seed must be non-negative")
	}
	req.OutputFormat = "webp"
	return nil
}

func animeControlLoad(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	if strings.HasPrefix(value, "data:image/") {
		comma := strings.IndexByte(value, ',')
		if comma < 0 || !strings.Contains(value[:comma], ";base64") {
			return nil, fmt.Errorf("inline image must be base64")
		}
		raw, err := base64.StdEncoding.DecodeString(value[comma+1:])
		if err != nil || len(raw) == 0 || len(raw) > animeControlMaxInline {
			return nil, fmt.Errorf("inline image is not valid base64 or is too large")
		}
		return raw, nil
	}
	return downloadH3ModerationImage(value)
}

func animeControlEncode(value string, photo bool) (string, error) {
	raw, err := animeControlLoad(value)
	if err != nil {
		return "", fmt.Errorf("image: %w", err)
	}
	source, _, err := image.Decode(bytes.NewReader(raw))
	if err != nil {
		return "", fmt.Errorf("image is not readable: %w", err)
	}
	bounds := source.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	if width < 64 || height < 64 {
		return "", fmt.Errorf("image is too small")
	}
	if long := max(width, height); long > animeControlMaxRefEdge {
		scale := float64(animeControlMaxRefEdge) / float64(long)
		width, height = max(1, int(float64(width)*scale)), max(1, int(float64(height)*scale))
	}
	var encoded bytes.Buffer
	if photo {
		err = jpeg.Encode(&encoded, imageEditorScale(source, width, height), &jpeg.Options{Quality: 92})
	} else {
		err = png.Encode(&encoded, imageEditorScale(source, width, height))
	}
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(encoded.Bytes()), nil
}

func animeControlWorkerInput(kind *animeControlKind, req ServiceUsageRequest) map[string]interface{} {
	negative := req.NegativePrompt
	if negative == "" {
		negative = animeControlNegative
	}
	input := map[string]interface{}{
		"workload": kind.Workload, "prompt": req.Prompt, "negative_prompt": negative,
		"width": req.Width, "height": req.Height, "num_inference_steps": req.NumSteps,
		"guidance_scale": req.Guidance, "seed": req.Seed, "output_format": "webp",
	}
	switch kind.Service {
	case animePoseControlService:
		if req.ControlImages["pose_map"] != "" {
			input["workload"] = "anime-scene-control"
			input["pose_strength"] = req.Strength
		} else {
			input["control_strength"] = req.Strength
		}
	case animeDepthControlService:
		input["control_strength"] = req.Strength
	case animeSceneControlService:
		for _, name := range []string{"regional", "pose"} {
			if value, ok := req.ControlStrengths[name]; ok {
				input[name+"_strength"] = value
			}
		}
	}
	return input
}

func animeControlSavedInput(kind *animeControlKind, req ServiceUsageRequest) map[string]interface{} {
	saved := animeControlWorkerInput(kind, req)
	delete(saved, "workload")
	return saved
}

func animeControlPrepare(kind *animeControlKind, req ServiceUsageRequest) (map[string]interface{}, error) {
	input := animeControlWorkerInput(kind, req)
	for key, value := range req.ControlImages {
		encoded, err := animeControlEncode(value, false)
		if err != nil {
			return nil, fmt.Errorf("control_images.%s: %w", key, err)
		}
		input[kind.Maps[key]] = encoded
	}
	if req.ImageURL != "" {
		encoded, err := animeControlEncode(req.ImageURL, true)
		if err != nil {
			return nil, fmt.Errorf("image_url: %w", err)
		}
		input[kind.PhotoKey] = encoded
	}
	return input, nil
}

func handleAnimeControlService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	kind := animeControlKindFor(req.Service)
	if kind == nil {
		jsonError(ctx, http.StatusBadRequest, "unknown anime control service")
		return
	}
	endpointID := animeControlEndpointID(kind)
	if endpointID == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "anime control capacity is not configured")
		return
	}
	if rejectArchivedLane(ctx, endpointID) {
		return
	}
	if err := normalizeAnimeControlRequest(kind, &req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	chargedUSD, credits := animeControlEstimate(kind)
	if credits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if !user.UnlimitedAPI && user.Credits+1e-9 < credits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits ($%.2f), have %.2f", credits, chargedUSD, user.Credits))
		return
	}
	if !user.UnlimitedAPI {
		if jobs, err := dbConn.ListVideoJobs(user.ID, 100); err == nil {
			for i := range jobs {
				status := strings.ToLower(strings.TrimSpace(jobs[i].Status))
				if isAnimeControlService(jobs[i].Service) && (status == "queued" || status == "processing") {
					jsonError(ctx, http.StatusConflict, "finish the current illustration before starting another")
					return
				}
			}
		}
	}
	input, err := animeControlPrepare(kind, req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	var queued h3RunpodQueuedJob
	status, err := submitSingleWorkerRunpod(endpointID, input, &queued)
	if err != nil || queued.ID == "" {
		log.Printf("[%s] submit failed status=%d: %v", kind.Service, status, err)
		jsonError(ctx, http.StatusServiceUnavailable, "anime control capacity is temporarily unavailable")
		return
	}
	providerID := fmt.Sprintf("runpod:%s:%s", endpointID, queued.ID)
	job, err := dbConn.CreateVideoJobForService(user.ID, providerID, kind.Service, req.Prompt)
	if err != nil {
		cancelAnimeControlProvider(providerID)
		jsonError(ctx, http.StatusInternalServerError, "failed to create anime control job")
		return
	}
	stored, _ := json.Marshal(animeControlSavedInput(kind, req))
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		cancelAnimeControlProvider(providerID)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist anime control job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": kind.Service,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
		},
		"estimated_cost_usd": chargedUSD, "estimated_credits": credits,
		"settlement": "fixed price confirmed before generation",
	})
}

func parseAnimeControlProviderID(value string) (endpointID, jobID string, ok bool) {
	parts := strings.SplitN(value, ":", 3)
	if len(parts) != 3 || parts[0] != "runpod" || parts[1] == "" || parts[2] == "" {
		return "", "", false
	}
	return parts[1], parts[2], true
}

func cancelAnimeControlProvider(providerID string) {
	endpointID, jobID, ok := parseAnimeControlProviderID(providerID)
	if !ok {
		return
	}
	_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(jobID), http.MethodPost, nil, nil)
	scheduleH3ScaleToZero(endpointID)
}

func animeControlFailureMessage(workerError string) string {
	lower := strings.ToLower(workerError)
	if strings.Contains(lower, "no person") || strings.Contains(lower, "no full person") {
		return "no person found in the reference image; use a clear photo of one person"
	}
	return "anime control generation failed"
}

func processAnimeControlJob(job *VideoJob) {
	kind := animeControlKindFor(job.Service)
	endpointID, providerJobID, ok := parseAnimeControlProviderID(job.ProviderJobID)
	if kind == nil || !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "anime control provider job is invalid")
		return
	}
	defer scheduleH3ScaleToZero(endpointID)
	var input map[string]interface{}
	if json.Unmarshal(job.Result, &input) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved anime control request is invalid")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(45 * time.Minute)
	for time.Now().Before(deadline) {
		if videoJobCancellationRequested(job.ID) {
			cancelAnimeControlProvider(job.ProviderJobID)
			return
		}
		var state h3RunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state); err != nil {
			time.Sleep(2 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED", "SUCCEEDED":
			if len(state.Output.Outputs) == 0 || state.Output.Outputs[0].Data == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "anime control returned no illustration")
				return
			}
			artifact, err := base64.StdEncoding.DecodeString(state.Output.Outputs[0].Data)
			if err != nil || len(artifact) == 0 || len(artifact) > h3ImageMaxBytes {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "anime control returned an invalid illustration")
				return
			}
			seconds := math.Max(1, float64(state.ExecutionTime)/1000)
			completeAnimeControlJob(kind, job, input, artifact, state.Output.Outputs[0].ContentType, animaGPUHourlyUSD()*seconds/3600, seconds)
			return
		case "FAILED", "CANCELLED", "CANCELED", "TIMED_OUT":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, animeControlFailureMessage(state.Error))
			return
		}
		time.Sleep(2 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "anime control generation timed out")
}

func completeAnimeControlJob(kind *animeControlKind, job *VideoJob, input map[string]interface{}, artifact []byte, contentType string, providerUSD, executionSeconds float64) {
	outputNSFW, outputScore := classifyH3ImageFlag(artifact, "job="+job.ID)
	uploadContext, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	imageURL, relPath, err := uploadGeneratedImageArtifact(uploadContext, artifact, job.UserID, contentType, "anime")
	cancel()
	if err != nil {
		log.Printf("[%s] output upload failed job=%s: %v", kind.Service, job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image storage is temporarily unavailable")
		return
	}
	chargedUSD, _ := animeControlEstimate(kind)
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	result, _ := json.Marshal(map[string]interface{}{
		"image_url": imageURL, "gallery_file_path": relPath, "image_id": "anime_" + newUUID(),
		"width": intFromInterface(input["width"], 1024), "height": intFromInterface(input["height"], 1024),
		"steps": intFromInterface(input["num_inference_steps"], 24), "seed": intFromInterface(input["seed"], 0),
		"bytes": len(artifact), "is_nsfw": outputNSFW, "nsfw_score": outputScore,
		"provider": "runpod", "provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
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
		log.Printf("[%s] gallery persistence failed job=%s: %v", kind.Service, job.ID, err)
	}
	log.Printf("[%s] charged_usd=%.4f metered_execution_usd=%.4f execution_seconds=%.3f", kind.Service, chargedUSD, providerUSD, executionSeconds)
	maybeTriggerAutoTopup(job.UserID)
}
