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
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	h3ImageNativePixels = 768 * 1344
	h3ImageMaxBytes     = 32 << 20
)

type h3ImageModeration struct {
	NSFWScore float64 `json:"nsfw_score"`
	Score     float64 `json:"score"`
}

func h3ImageEstimate(req ServiceUsageRequest) (float64, float64) {
	// Until production telemetry is broad enough for a percentile model, show
	// a conservative warm-generation estimate. Settlement still uses measured
	// RunPod execution time and the ordinary H3 margin.
	price := servicePricesUSD["h3_image"]
	if req.Service == "h3_image_edit" {
		price = servicePricesUSD["h3_image_edit"]
	}
	if req.NumSteps >= 20 {
		price += 0.15
	}
	credits := 0.0
	if cutePrice := getCUTEPriceUSD(); cutePrice > 0 {
		credits = price / cutePrice
	}
	return price, credits
}

func normalizeH3ImageRequest(req *ServiceUsageRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	if req.Prompt == "" {
		return fmt.Errorf("prompt is required")
	}
	if len(req.Prompt) > 2400 {
		return fmt.Errorf("prompt must be 2400 characters or fewer")
	}
	if req.Service != "h3_image" && req.Service != "h3_image_edit" {
		return fmt.Errorf("service must be h3_image or h3_image_edit")
	}
	if req.Service == "h3_image_edit" {
		req.ImageURL = strings.TrimSpace(req.ImageURL)
		if req.ImageURL == "" {
			return fmt.Errorf("image_url is required for H3 image editing")
		}
		if err := studioRemoteImageURL(req.ImageURL); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
	}
	if len(req.ReferenceImageURLs) > 8 {
		return fmt.Errorf("at most 8 additional references are supported (9 images total)")
	}
	for index := range req.ReferenceImageURLs {
		req.ReferenceImageURLs[index] = strings.TrimSpace(req.ReferenceImageURLs[index])
		if err := studioRemoteImageURL(req.ReferenceImageURLs[index]); err != nil {
			return fmt.Errorf("reference_image_urls[%d]: %w", index, err)
		}
	}
	if req.Service == "h3_image" && len(req.ReferenceImageURLs) > 0 {
		return fmt.Errorf("reference_image_urls require h3_image_edit")
	}
	if req.Width == 0 {
		req.Width = 992
	}
	if req.Height == 0 {
		req.Height = 992
	}
	if req.Width < 256 || req.Width > 2048 || req.Height < 256 || req.Height > 2048 {
		return fmt.Errorf("width and height must be between 256 and 2048")
	}
	req.Width = max(32, int(math.Round(float64(req.Width)/32))*32)
	req.Height = max(32, int(math.Round(float64(req.Height)/32))*32)
	if req.Width*req.Height > h3ImageNativePixels {
		scale := math.Sqrt(float64(h3ImageNativePixels) / float64(req.Width*req.Height))
		req.Width = max(32, int(float64(req.Width)*scale)/32*32)
		req.Height = max(32, int(float64(req.Height)*scale)/32*32)
	}
	if req.NumSteps == 0 {
		req.NumSteps = 12
	}
	if req.NumSteps != 12 && req.NumSteps != 20 {
		return fmt.Errorf("num_steps must be 12 (fast) or 20 (quality)")
	}
	if req.Seed < 0 {
		return fmt.Errorf("seed must be non-negative")
	}
	if req.Strength == 0 {
		req.Strength = 0.75
	}
	if req.Strength < 0 || req.Strength > 1 {
		return fmt.Errorf("strength must be between 0 and 1")
	}
	if req.Quant == "" {
		req.Quant = "int8_convrot"
	}
	if req.Quant != "int8_convrot" && req.Quant != "w4a8" {
		return fmt.Errorf("quant must be int8_convrot or w4a8")
	}
	return nil
}

func studioRemoteImageURL(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Hostname() == "" || parsed.Scheme != "https" {
		return fmt.Errorf("a public HTTPS image URL is required")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".local") {
		return fmt.Errorf("image URL must be public")
	}
	addresses, err := net.LookupIP(host)
	if err != nil || len(addresses) == 0 {
		return fmt.Errorf("image host could not be resolved")
	}
	for _, address := range addresses {
		if address.IsLoopback() || address.IsPrivate() || address.IsUnspecified() || address.IsLinkLocalUnicast() || !address.IsGlobalUnicast() {
			return fmt.Errorf("image URL must resolve to a public address")
		}
	}
	return nil
}

func downloadH3ModerationImage(rawURL string) ([]byte, error) {
	if err := studioRemoteImageURL(rawURL); err != nil {
		return nil, err
	}
	request, err := http.NewRequest(http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "manifoldgen-h3-image/1.0")
	client := *backendClient
	client.Timeout = 90 * time.Second
	client.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 4 {
			return fmt.Errorf("too many redirects")
		}
		return studioRemoteImageURL(req.URL.String())
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("image download returned %d", response.StatusCode)
	}
	contentType := strings.ToLower(strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0]))
	if contentType != "" && !strings.HasPrefix(contentType, "image/") {
		return nil, fmt.Errorf("URL did not return an image")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, h3ImageMaxBytes+1))
	if err != nil {
		return nil, err
	}
	if len(data) == 0 || len(data) > h3ImageMaxBytes {
		return nil, fmt.Errorf("image must be between 1 byte and 32 MiB")
	}
	return data, nil
}

func classifyH3Image(image []byte) (bool, float64, error) {
	if len(image) == 0 || len(image) > h3ImageMaxBytes {
		return false, 0, fmt.Errorf("invalid moderation image size")
	}
	payload, _ := json.Marshal(map[string]string{"image_base64": base64.StdEncoding.EncodeToString(image)})
	endpoint, secret, err := h3ModerationEndpoint()
	if err != nil {
		return false, 0, err
	}
	request, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return false, 0, err
	}
	request.Header.Set("Content-Type", "application/json")
	if secret != "" {
		request.Header.Set("Authorization", "Bearer "+secret)
	}
	response, err := backendClient.Do(request)
	if err != nil {
		return false, 0, err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return false, 0, err
	}
	if response.StatusCode >= 300 {
		return false, 0, fmt.Errorf("NSFW classifier returned %d: %s", response.StatusCode, tailOutput(body))
	}
	var verdict h3ImageModeration
	if err := json.Unmarshal(body, &verdict); err != nil {
		return false, 0, fmt.Errorf("NSFW classifier returned invalid JSON")
	}
	score := verdict.NSFWScore
	if score == 0 {
		score = verdict.Score
	}
	threshold := 0.5
	if configured, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("H3_IMAGE_NSFW_THRESHOLD")), 64); err == nil && configured > 0 && configured < 1 {
		threshold = configured
	}
	return score >= threshold, score, nil
}

func h3ModerationEndpoint() (string, string, error) {
	endpoint := strings.TrimRight(getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"), "/") + "/nsfw_detect"
	secret := strings.TrimSpace(getEnv("OMNISERVE_IMAGE_WORKER_SECRET",
		getEnv("OMNISERVE_NATIVE_SECRET", getEnv("OMNISERVE_SECRET", ""))))
	if secret == "" {
		return endpoint, "", nil
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", "", fmt.Errorf("invalid OmniServe moderation endpoint: %w", err)
	}
	// The legacy image worker authenticates this route with a query parameter.
	// OmniServe and the worker are loopback-only; retain the header as well so a
	// future header-aware worker can migrate without changing the site again.
	query := parsed.Query()
	query.Set("secret", secret)
	parsed.RawQuery = query.Encode()
	return parsed.String(), secret, nil
}

func classifyH3ImageURL(rawURL string) (bool, float64, error) {
	image, err := downloadH3ModerationImage(rawURL)
	if err != nil {
		return false, 0, err
	}
	return classifyH3Image(image)
}

func handleH3ImageService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeH3ImageRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	inputNSFW := false
	inputScore := 0.0
	for _, imageURL := range append([]string{req.ImageURL}, req.ReferenceImageURLs...) {
		if imageURL == "" {
			continue
		}
		adult, score, err := classifyH3ImageURL(imageURL)
		if err != nil {
			log.Printf("[h3-image] input moderation unavailable: %v", err)
			jsonError(ctx, http.StatusServiceUnavailable, "image safety check is temporarily unavailable")
			return
		}
		inputNSFW = inputNSFW || adult
		inputScore = math.Max(inputScore, score)
	}
	route := h3RouteForContent(req.Prompt, inputNSFW)
	if route.RunpodEndpointID == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "H3 image generation is temporarily unavailable")
		return
	}
	input := map[string]interface{}{
		"task": "image", "prompt": req.Prompt, "width": req.Width, "height": req.Height,
		"steps": req.NumSteps, "seed": req.Seed, "quant": req.Quant,
		"source_fidelity": req.Strength, "_input_nsfw": inputNSFW, "_input_nsfw_score": inputScore,
	}
	if req.Service == "h3_image_edit" {
		input["task"] = "image_edit"
		input["source_image"] = req.ImageURL
		input["reference_image_urls"] = req.ReferenceImageURLs
	}
	var queued h3RunpodQueuedJob
	status, err := submitScaledH3RunpodJob(route, input, &queued)
	if err != nil || queued.ID == "" {
		log.Printf("[h3-image] submission failed status=%d: %v", status, err)
		jsonError(ctx, http.StatusBadGateway, "H3 image generation could not be started")
		return
	}
	scheduleH3ScaleToZero(route.RunpodEndpointID)
	job, err := dbConn.CreateVideoJobForService(user.ID, "runpod:"+route.RunpodEndpointID+":"+queued.ID, req.Service, req.Prompt)
	if err != nil {
		_, _ = callH3Runpod(route.RunpodEndpointID, "/cancel/"+url.PathEscape(queued.ID), http.MethodPost, nil, nil)
		jsonError(ctx, http.StatusInternalServerError, "failed to create image job")
		return
	}
	input["_h3_variant"] = route.Variant
	stored, _ := json.Marshal(input)
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist image job")
		return
	}
	estimatedUSD, estimatedCredits := h3ImageEstimate(req)
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": req.Service, "result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
		},
		"credits_used": 0, "settlement": "final price based on measured generation",
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
	})
}

func h3ImageContentType(value string) (string, string) {
	switch strings.ToLower(strings.TrimSpace(strings.Split(value, ";")[0])) {
	case "image/webp":
		return "webp", "image/webp"
	case "image/jpeg":
		return "jpg", "image/jpeg"
	default:
		return "png", "image/png"
	}
}

func uploadGeneratedImageArtifact(ctx context.Context, image []byte, userID, contentType, prefix string) (string, string, error) {
	if len(image) == 0 || len(image) > h3ImageMaxBytes {
		return "", "", fmt.Errorf("invalid generated image output size")
	}
	extension, mediaType := h3ImageContentType(contentType)
	prefix = sanitizeUploadName(prefix)
	if prefix == "" {
		prefix = "image"
	}
	fileName := fmt.Sprintf("%s_%s.%s", prefix, newUUID(), extension)
	relPath := filepath.ToSlash(filepath.Join("originals", fileName))
	objectKey := strings.TrimSuffix(r2PathPrefix, "/") + "/" + relPath
	uploadURL, err := presignR2PutObject(objectKey, mediaType, 900)
	if err != nil {
		return "", "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(image))
	if err != nil {
		return "", "", err
	}
	request.ContentLength = int64(len(image))
	request.Header.Set("Content-Type", mediaType)
	response, err := backendClient.Do(request)
	if err != nil {
		return "", "", err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return "", "", fmt.Errorf("R2 H3 image upload returned %d: %s", response.StatusCode, tailOutput(body))
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), relPath, nil
}

func uploadH3ImageArtifact(ctx context.Context, image []byte, userID, contentType string) (string, string, error) {
	return uploadGeneratedImageArtifact(ctx, image, userID, contentType, "h3")
}

func processRunpodH3ImageJob(job *VideoJob) {
	endpointID, providerJobID, ok := parseRunpodH3ProviderJob(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image generation failed")
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
		case "COMPLETED":
			if state.Output.Moderation.IsChild || strings.EqualFold(state.Output.Moderation.Status, "blocked") {
				log.Printf("[h3-image] worker moderation blocked job=%s", job.ID)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image generation was blocked by the safety check")
				return
			}
			if len(state.Output.Outputs) == 0 || state.Output.Outputs[0].Data == "" {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image generation returned no artifact")
				return
			}
			artifact, err := base64.StdEncoding.DecodeString(state.Output.Outputs[0].Data)
			if err != nil || len(artifact) > h3ImageMaxBytes {
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image generation returned an invalid artifact")
				return
			}
			outputNSFW, outputScore, err := classifyH3Image(artifact)
			if err != nil {
				log.Printf("[h3-image] output moderation unavailable job=%s: %v", job.ID, err)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image safety check is temporarily unavailable")
				return
			}
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
			imageURL, relPath, err := uploadH3ImageArtifact(ctx, artifact, job.UserID, state.Output.Outputs[0].ContentType)
			cancel()
			if err != nil {
				log.Printf("[h3-image] output upload failed job=%s: %v", job.ID, err)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image storage is temporarily unavailable")
				return
			}
			predictSeconds := math.Max(1, float64(state.ExecutionTime)/1000)
			providerUSD := servicePricesUSD["h3_video"] * predictSeconds / 3600
			providerMicros := max(int64(1), int64(math.Ceil(providerUSD*1_000_000)))
			chargedUSD := float64(h3DownstreamMicros(providerMicros)) / 1_000_000
			cutePrice := getCUTEPriceUSD()
			if cutePrice <= 0 {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit price unavailable; retry shortly")
				return
			}
			width, height, steps, seed := 992, 992, 12, 0
			if metrics := state.Output.Metrics; metrics != nil {
				width = intFromInterface(metrics["width"], width)
				height = intFromInterface(metrics["height"], height)
				steps = intFromInterface(metrics["steps"], steps)
				seed = intFromInterface(metrics["seed"], seed)
			}
			result, _ := json.Marshal(map[string]interface{}{
				"image_url": imageURL, "gallery_file_path": relPath, "image_id": "h3img_" + newUUID(),
				"width": width, "height": height, "steps": steps, "seed": seed, "bytes": len(artifact),
				"is_nsfw": outputNSFW, "nsfw_score": outputScore, "provider": "runpod",
				"provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
				"cute_price_usd": cutePrice, "credits_used": chargedUSD / cutePrice, "metrics": state.Output.Metrics,
			})
			_, _, settleErr := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
			if settleErr == ErrVideoPaymentRequired {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release completed image; $%.6f required", chargedUSD))
				return
			}
			if settleErr != nil {
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
				return
			}
			job.Result = result
			job.Status = "completed"
			if err := persistH3ImageJobResult(job); err != nil {
				log.Printf("[h3-image] gallery persistence failed job=%s: %v", job.ID, err)
			}
			maybeTriggerAutoTopup(job.UserID)
			return
		case "FAILED", "CANCELLED", "TIMED_OUT":
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image generation failed")
			return
		}
		time.Sleep(2 * time.Second)
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "image generation timed out")
}

func intFromInterface(value interface{}, fallback int) int {
	switch typed := value.(type) {
	case float64:
		return int(typed)
	case int:
		return typed
	case json.Number:
		parsed, _ := typed.Int64()
		return int(parsed)
	default:
		return fallback
	}
}

func persistH3ImageJobResult(job *VideoJob) error {
	if job == nil || len(job.Result) == 0 {
		return nil
	}
	var result struct {
		ImageID         string `json:"image_id"`
		GalleryFilePath string `json:"gallery_file_path"`
		Width           int    `json:"width"`
		Height          int    `json:"height"`
		Steps           int    `json:"steps"`
		Seed            int64  `json:"seed"`
		Bytes           int64  `json:"bytes"`
		IsNSFW          bool   `json:"is_nsfw"`
	}
	if err := json.Unmarshal(job.Result, &result); err != nil || result.ImageID == "" || result.GalleryFilePath == "" {
		return err
	}
	verdict := result.IsNSFW
	return dbConn.InsertGeneratedImage(&GeneratedImage{
		ID: result.ImageID, Prompt: job.Prompt, Width: result.Width, Height: result.Height,
		FilePath: result.GalleryFilePath, ThumbPath: result.GalleryFilePath, MedPath: result.GalleryFilePath,
		FileSize: result.Bytes, Model: job.Service, Seed: result.Seed, Steps: result.Steps,
		IsNSFW: &verdict, CreatedByUserID: job.UserID, CreatedAt: time.Now(),
	})
}
