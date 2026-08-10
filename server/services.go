package main

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

// Service pricing in USD (converted to $CUTE at current rate)
var servicePricesUSD = map[string]float64{
	"zimage":         0.04,  // per generation
	"chronos2":       0.002, // per forecast (Chronos-2, our own ~120M model, ms-scale call)
	"tts":            0.005, // per 100 chars
	"stt":            0.02,  // per minute
	"gemma4":         0.01,  // per request
	"caption":        0.01,  // per image
	"lora_training":  5.00,
	"ltx_video":      0.30,  // per ~6s 1080p video via fal.ai
	"video_generate": 0.15,  // OpenPaths auto-video base price; model overrides below
	"h3_video":       2.688, // per GPU-hour reference rate; exact execution is settled asynchronously
	"video_restyle":  0.48,  // estimated five-second 720p ceiling; async settlement uses the selected backend
	"flux_image":     0.04,  // per image via fal.ai or netwrck
	"nsfw_detect":    0.001, // per image classification
}

var zimageDefaultSteps = 8
var zimageHighStepPriceUSD = 0.10

// First-party services run on our hardware — priced at ATH rate to reward early holders.
// If you bought $MANIFOLD at $0.001 and ATH is $0.01, you pay 10x fewer tokens.
var firstPartyServices = map[string]bool{
	"zimage": true, "chronos2": true, "tts": true,
	"stt": true, "gemma4": true, "caption": true, "lora_training": true,
	"nsfw_detect": true,
}

// FAL API key for third-party proxied services
var falAPIKey string
var textGeneratorAPIKey string
var openPathsAPIKey string
var openPathsBaseURL string

var videoModelPricesUSD = map[string]float64{
	"auto-video":             0.15,
	"ltx-video":              0.08,
	"ltx-2":                  0.12,
	"ltx-2.3-image-to-video": 1.85,
}

// Reusable HTTP client with connection pooling
var backendClient = &http.Client{
	Timeout: 180 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 20,
		MaxConnsPerHost:     50,
		IdleConnTimeout:     90 * time.Second,
	},
}

// Service backend URLs
var serviceBackends = map[string]string{}

func initServices() {
	// ManifoldGen inference server serves zimage, chronos2, tts, stt, caption, gemma4
	inferenceURL := getEnv("INFERENCE_BACKEND_URL", "http://localhost:8100")
	textGeneratorURL := getEnv("TG_BACKEND_URL", "http://localhost:9080")
	nativeGatewayURL := getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791")

	serviceBackends["zimage"] = getEnv("ZIMAGE_BACKEND_URL", nativeGatewayURL)
	serviceBackends["chronos2"] = getEnv("CHRONOS_BACKEND_URL", nativeGatewayURL)
	serviceBackends["tts"] = getEnv("TTS_BACKEND_URL", textGeneratorURL)
	serviceBackends["stt"] = getEnv("STT_BACKEND_URL", inferenceURL)
	serviceBackends["gemma4"] = getEnv("GEMMA4_BACKEND_URL", inferenceURL)
	serviceBackends["caption"] = getEnv("CAPTION_BACKEND_URL", inferenceURL)
	serviceBackends["lora_training"] = getEnv("LORA_TRAINING_BACKEND_URL", inferenceURL)
	serviceBackends["ltx_video"] = "https://fal.run"
	serviceBackends["video_generate"] = getEnv("OPENPATHS_BASE_URL", "https://openpaths.io")
	serviceBackends["flux_image"] = "https://fal.run"

	falAPIKey = getEnv("FAL_KEY", getEnv("FAL_API_KEY", ""))
	if falAPIKey != "" {
		log.Printf("FAL API key configured for ltx_video and flux_image services")
	}
	textGeneratorAPIKey = getEnv("TG_API_KEY", getEnv("TEXT_GENERATOR_API_KEY", getEnv("TEXT_GENERATOR_SECRET", "")))
	openPathsAPIKey = getEnv("OPENPATHS_API_KEY", "")
	openPathsBaseURL = strings.TrimRight(getEnv("OPENPATHS_BASE_URL", "https://openpaths.io"), "/")
	if openPathsAPIKey != "" {
		log.Printf("OpenPaths video generation configured: %s", openPathsBaseURL)
	}
	if textGeneratorAPIKey != "" {
		log.Printf("Text-generator API key configured for tts service")
	}

	// Load custom prices from env
	envPriceMap := map[string]string{
		"zimage":         "ZIMAGE_PRICE_USD",
		"chronos2":       "CHRONOS_PRICE_USD",
		"tts":            "TTS_PRICE_USD_PER_100CHARS",
		"stt":            "STT_PRICE_USD_PER_MINUTE",
		"gemma4":         "GEMMA4_PRICE_USD",
		"caption":        "CAPTION_PRICE_USD",
		"lora_training":  "LORA_TRAINING_PRICE_USD",
		"ltx_video":      "LTX_VIDEO_PRICE_USD",
		"video_generate": "VIDEO_GENERATE_PRICE_USD",
		"h3_video":       "H3_VIDEO_PRICE_USD_PER_GPU_HOUR",
		"video_restyle":  "VIDEO_RESTYLE_ESTIMATE_USD",
		"flux_image":     "FLUX_IMAGE_PRICE_USD",
		"nsfw_detect":    "NSFW_DETECT_PRICE_USD",
	}
	for svc, envKey := range envPriceMap {
		if p := os.Getenv(envKey); p != "" {
			servicePricesUSD[svc] = parseFloat(p)
		}
	}
	if p := os.Getenv("ZIMAGE_20_40_STEPS_PRICE_USD"); p != "" {
		zimageHighStepPriceUSD = parseFloat(p)
	}
	if steps := os.Getenv("ZIMAGE_DEFAULT_STEPS"); steps != "" {
		if parsed := parseInt(steps); parsed > 0 {
			zimageDefaultSteps = parsed
		}
	}

	log.Printf("Service pricing loaded: %v", servicePricesUSD)
	log.Printf("Z-Image default steps: %d, 20+ step price: $%.4f", zimageDefaultSteps, zimageHighStepPriceUSD)
	log.Printf("Service backends: %v", serviceBackends)

	// Initialize diffusionz C engine for direct GPU inference (optional)
	initDiffusionzEngine()
}

// getServicePriceCUTE returns the current $CUTE cost for a service.
// First-party services use ATH pricing — rewarding early token holders with
// permanently lower rates. Third-party proxy services use current market price.
func getServicePriceCUTE(service string) float64 {
	usdPrice, ok := servicePricesUSD[service]
	if !ok {
		return 0
	}

	var pricePerToken float64
	if firstPartyServices[service] {
		// ATH pricing: divide by ATH price, so if token pumps, you need fewer tokens
		pricePerToken = getCUTEPriceATH()
	} else {
		pricePerToken = getCUTEPriceUSD()
	}

	if pricePerToken <= 0 {
		return 0
	}
	return usdPrice / pricePerToken
}

func getRequestServicePriceUSD(req ServiceUsageRequest) float64 {
	usdPrice, ok := servicePricesUSD[req.Service]
	if !ok {
		return 0
	}
	if req.Service == "zimage" && getZImageSteps(req) >= 20 {
		usdPrice = zimageHighStepPriceUSD
	}
	if req.Service == "video_generate" {
		if price, exists := videoModelPricesUSD[normalizeVideoModel(req.Model)]; exists {
			usdPrice = price
		}
	}
	if req.Service == "zimage" || req.Service == "flux_image" {
		usdPrice *= float64(getImageCount(req))
	}
	return usdPrice
}

func getImageCount(req ServiceUsageRequest) int {
	n := req.N
	if n <= 0 {
		n = req.NumImages
	}
	if n <= 0 {
		return 1
	}
	if n > 8 {
		return 8
	}
	return n
}

func getRequestServicePriceCUTE(req ServiceUsageRequest) float64 {
	usdPrice := getRequestServicePriceUSD(req)
	if usdPrice <= 0 {
		return 0
	}

	var pricePerToken float64
	if firstPartyServices[req.Service] {
		pricePerToken = getCUTEPriceATH()
	} else {
		pricePerToken = getCUTEPriceUSD()
	}
	if pricePerToken <= 0 {
		return 0
	}
	return usdPrice / pricePerToken
}

func getZImageSteps(req ServiceUsageRequest) int {
	if req.NumSteps > 0 {
		return req.NumSteps
	}
	return zimageDefaultSteps
}

type h3VideoPricePoint struct {
	DurationSeconds int     `json:"duration_seconds"`
	PriceUSD        float64 `json:"price_usd"`
	Credits         float64 `json:"credits"`
}

type h3VideoPricingTier struct {
	Size           string              `json:"size"`
	Label          string              `json:"label"`
	Width16x9      int                 `json:"width_16_9"`
	Height16x9     int                 `json:"height_16_9"`
	Resolution16x9 string              `json:"resolution_16_9"`
	Prices         []h3VideoPricePoint `json:"prices"`
}

func h3VideoPricingTiers() []h3VideoPricingTier {
	tiers := []h3VideoPricingTier{
		{Size: "preview", Label: "Preview", Width16x9: 1024, Height16x9: 576, Resolution16x9: "1024 × 576"},
		{Size: "balanced", Label: "Balanced", Width16x9: 1184, Height16x9: 672, Resolution16x9: "1184 × 672"},
		{Size: "native", Label: "Native", Width16x9: 1344, Height16x9: 768, Resolution16x9: "1344 × 768"},
	}
	for tierIndex := range tiers {
		for _, duration := range []int{5, 10, 15, 30, 60} {
			priceUSD, credits, _ := h3Estimate(ServiceUsageRequest{
				Service: "h3_video", Size: tiers[tierIndex].Size, Duration: duration, NumSteps: 20,
			})
			tiers[tierIndex].Prices = append(tiers[tierIndex].Prices, h3VideoPricePoint{
				DurationSeconds: duration, PriceUSD: priceUSD, Credits: credits,
			})
		}
	}
	return tiers
}

type publicServiceAlias struct {
	Public   string
	Internal string
}

var publicServiceAliases = []publicServiceAlias{
	{Public: "image", Internal: "zimage"},
	{Public: "video", Internal: "h3_video"},
	{Public: "speech", Internal: "tts"},
	{Public: "transcription", Internal: "stt"},
	{Public: "caption", Internal: "caption"},
	{Public: "forecast", Internal: "chronos2"},
	{Public: "text", Internal: "gemma4"},
	{Public: "training", Internal: "lora_training"},
	{Public: "video_restyle", Internal: "video_restyle"},
	{Public: "safety", Internal: "nsfw_detect"},
}

func requestedServiceName(service string) string {
	clean := strings.ToLower(strings.TrimSpace(service))
	if clean == "" || clean == "z-image-turbo" || clean == "zimage-turbo" {
		return "zimage"
	}
	for _, alias := range publicServiceAliases {
		if clean == alias.Public {
			return alias.Internal
		}
	}
	return strings.TrimSpace(service)
}

func publicServiceName(service string) string {
	for _, alias := range publicServiceAliases {
		if service == alias.Internal {
			return alias.Public
		}
	}
	return ""
}

// handleGetPricing returns current pricing for all services
func handleGetPricing(ctx *fasthttp.RequestCtx) {
	cutePrice := getCUTEPriceUSD()
	h3EstimateUSD, h3EstimateCredits, h3EstimateSeconds := h3Estimate(ServiceUsageRequest{
		Service: "h3_video", Size: "native", Duration: 5, NumSteps: 20,
	})

	units := map[string]string{
		"zimage":         fmt.Sprintf("per generation (base); $%.2f for 20+ steps", zimageHighStepPriceUSD),
		"chronos2":       "per forecast",
		"tts":            "per 100 characters",
		"stt":            "per minute",
		"gemma4":         "per request",
		"caption":        "per image",
		"lora_training":  "per training job",
		"ltx_video":      "per ~6s video",
		"video_generate": "per generated video (model dependent)",
		"h3_video":       "per video; final price follows measured generation time",
		"video_restyle":  "estimated default clip; final price follows length and quality",
		"flux_image":     "per image",
	}

	pricing := make([]ServicePricing, 0, len(publicServiceAliases))
	for _, alias := range publicServiceAliases {
		usdPrice, available := servicePricesUSD[alias.Internal]
		if !available {
			continue
		}
		cuteCost := getServicePriceCUTE(alias.Internal)
		if alias.Internal == "h3_video" {
			usdPrice = h3EstimateUSD
			cuteCost = h3EstimateCredits
		}
		pricing = append(pricing, ServicePricing{
			Service:   alias.Public,
			PriceUSD:  usdPrice,
			PriceCute: cuteCost,
			CutePrice: cutePrice,
			Unit:      units[alias.Internal],
		})
	}

	jsonResponse(ctx, 200, map[string]interface{}{
		"pricing":                   pricing,
		"cute_price_usd":            cutePrice,
		"credit_price_usd":          cutePrice,
		"credits_per_dollar":        1.0 / cutePrice,
		"cute_price_ath":            getCUTEPriceATH(),
		"sol_price_usd":             getSOLPriceUSD(),
		"image_price_usd":           servicePricesUSD["zimage"],
		"image_credits":             servicePricesUSD["zimage"] / cutePrice,
		"image_high_step_price_usd": zimageHighStepPriceUSD,
		"image_high_step_credits":   zimageHighStepPriceUSD / cutePrice,
		"video_estimate": map[string]interface{}{
			"size": "native", "duration_seconds": 5, "steps": 20,
			"estimated_cost_usd": h3EstimateUSD, "estimated_credits": h3EstimateCredits,
			"estimated_generation_seconds": h3EstimateSeconds,
			"minimum_cost_usd":             float64(h3MinimumChargeMicros) / 1_000_000,
			"final_billing":                "final price based on generation",
		},
		"video_pricing": map[string]interface{}{
			"basis_steps":            20,
			"duration_range_seconds": []int{4, 60},
			"billing":                "Final video price follows measured generation time; these are the current preflight estimates.",
			"tiers":                  h3VideoPricingTiers(),
		},
		"topup_presets_usd": []int{25, 50, 100, 200},
		"topup_default_usd": 50,
		"topup_min_usd":     5,
		"studio": map[string]interface{}{
			"background_removal_credits":   studioBackgroundCredits,
			"music_generation_credits":     studioMusicCredits,
			"extend_input_second_usd":      studioExtendInputPerSec,
			"extend_output_second_usd":     studioExtendOutputPerSec,
			"upscale_base_usd":             studioUpscaleBaseUSD,
			"upscale_output_mp_second_usd": studioUpscaleOutputMPUSD,
		},
	})
}

// handleServiceRequest processes an AI service request, deducts credits, and proxies to backend
func handleServiceRequest(ctx *fasthttp.RequestCtx) {
	var req ServiceUsageRequest
	if err := json.Unmarshal(ctx.PostBody(), &req); err != nil {
		jsonError(ctx, 400, "invalid json")
		return
	}

	req.Service = requestedServiceName(req.Service)

	// Validate service exists
	_, ok := servicePricesUSD[req.Service]
	if !ok {
		jsonError(ctx, 400, "unknown service: "+req.Service)
		return
	}

	// Authenticate: API key (Authorization header) or wallet_address in body
	var user *User
	var err error
	authHeader := string(ctx.Request.Header.Peek("Authorization"))
	if strings.HasPrefix(authHeader, "Bearer ") {
		apiKey := strings.TrimPrefix(authHeader, "Bearer ")
		user, err = dbConn.GetUserByAPIKey(apiKey)
		if err != nil {
			jsonError(ctx, 401, "invalid API key")
			return
		}
	} else if req.WalletAddress != "" {
		user, err = dbConn.GetUserByWallet(req.WalletAddress)
		if err != nil {
			jsonError(ctx, 401, "wallet not registered - deposit $MANIFOLD first")
			return
		}
	} else {
		jsonError(ctx, 401, "authorization required: use Authorization header with API key or wallet_address in body")
		return
	}
	if req.Service == "h3_video" {
		handleH3VideoService(ctx, req, user)
		return
	}
	if req.Service == "video_restyle" {
		handleVideoRestyleService(ctx, req, user)
		return
	}

	// Calculate cost in $CUTE
	cuteCost := getRequestServicePriceCUTE(req)
	if cuteCost <= 0 {
		jsonError(ctx, 503, "pricing unavailable")
		return
	}

	// For TTS, scale by text length.
	if req.Service == "tts" {
		chars := float64(len(getTTSText(req)))
		cuteCost = cuteCost * (chars / 100.0)
		if cuteCost < getServicePriceCUTE("tts")*0.1 {
			cuteCost = getServicePriceCUTE("tts") * 0.1 // Minimum charge
		}
	}

	newBalance := user.Credits
	billableCost := cuteCost
	// Subscriptions include unlimited image generation only. Video and every
	// other service continue to consume the subscriber's rollover credits.
	unlimitedImage := user.UnlimitedAPI && req.Service == "zimage"
	if unlimitedImage {
		billableCost = 0
	} else {
		// Deduct credits
		newBalance, err = dbConn.DeductUserCredits(user.ID, cuteCost)
		if err != nil {
			if strings.Contains(err.Error(), "insufficient") {
				needUSD := cuteCost * getCUTEPriceUSD()
				jsonError(ctx, 402, fmt.Sprintf("insufficient credits: need %.2f credits ($%.4f), have %.2f", cuteCost, needUSD, user.Credits))
				return
			}
			jsonError(ctx, 500, "failed to deduct credits")
			return
		}
	}

	// Log billing event (for lora_training we log only in settle to avoid
	// double-booking — the deduction above is a hold).
	cutePrice := getCUTEPriceUSD()
	usdEquiv := cuteCost * cutePrice
	if req.Service != "lora_training" && !unlimitedImage {
		go dbConn.CreateBillingEvent(&BillingEvent{
			UserID:       user.ID,
			EventType:    req.Service,
			Amount:       -cuteCost,
			CuteAmount:   cuteCost,
			USDAmount:    usdEquiv,
			Description:  fmt.Sprintf("%s usage (%.2f $MANIFOLD @ $%.6f)", req.Service, cuteCost, cutePrice),
			CreditsAfter: newBalance,
		})
	}

	log.Printf("Service %s: user=%s cost=%.2f MANIFOLD ($%.4f) balance=%.2f",
		req.Service, user.WalletAddress, billableCost, billableCost*cutePrice, newBalance)

	// Proxy to backend service
	backendURL, ok := serviceBackends[req.Service]
	if !ok {
		jsonError(ctx, 503, "service backend not configured")
		return
	}

	result, err := proxyToBackend(req, backendURL)
	if err == nil && req.Service == "video_generate" {
		result, err = prepareGeneratedVideoResult(req, user, result)
	}
	if err != nil {
		log.Printf("Backend proxy error for %s: %v", req.Service, err)
		// Refund on backend failure
		if !unlimitedImage {
			refundBalance, refundErr := dbConn.AddUserCredits(user.ID, cuteCost)
			if refundErr == nil {
				go dbConn.CreateBillingEvent(&BillingEvent{
					UserID:       user.ID,
					EventType:    "refund",
					Amount:       cuteCost,
					CuteAmount:   cuteCost,
					USDAmount:    usdEquiv,
					Description:  fmt.Sprintf("Refund: %s backend error", req.Service),
					CreditsAfter: refundBalance,
				})
			}
		}
		jsonError(ctx, 502, "service temporarily unavailable")
		return
	}
	result = optimizeGeneratedVideo(req, user, result)

	// LoRA training is async — deduction above is a HOLD. A background
	// watcher polls the inference job and either finalizes (keep deducted +
	// log billing event) or refunds on training failure.
	if req.Service == "lora_training" && !unlimitedImage {
		var r struct {
			JobID string `json:"job_id"`
		}
		if jerr := json.Unmarshal(result, &r); jerr == nil && r.JobID != "" {
			go settleLoraTrainingJob(user.ID, r.JobID, cuteCost, cutePrice)
		}
	}

	if !unlimitedImage {
		maybeTriggerAutoTopup(user.ID)
	}

	result, savedImage := persistGeneratedZImage(req, user, result)
	savedImages := make([]*GeneratedImage, 0, getImageCount(req))
	if savedImage != nil {
		savedImages = append(savedImages, savedImage)
	}
	if req.Service == "zimage" && getImageCount(req) > 1 {
		var additional []*GeneratedImage
		result, additional = persistAdditionalZImages(req, user, result)
		savedImages = append(savedImages, additional...)
	}

	// Return backend response with billing info
	response := map[string]interface{}{
		"result":          json.RawMessage(result),
		"credits_used":    billableCost,
		"credits_remain":  newBalance,
		"usd_equivalent":  billableCost * cutePrice,
		"unlimited_api":   unlimitedImage,
		"metered_credits": cuteCost,
	}
	if savedImage != nil {
		response["saved_image"] = savedImage
		response["saved_image_url"] = fmt.Sprintf("https://%s/%s/%s", r2PublicHost, strings.TrimSuffix(r2PathPrefix, "/"), strings.TrimLeft(savedImage.FilePath, "/"))
	}
	if len(savedImages) > 0 {
		response["saved_images"] = savedImages
		urls := make([]string, 0, len(savedImages))
		for _, image := range savedImages {
			urls = append(urls, fmt.Sprintf("https://%s/%s/%s", r2PublicHost, strings.TrimSuffix(r2PathPrefix, "/"), strings.TrimLeft(image.FilePath, "/")))
		}
		response["saved_image_urls"] = urls
	}
	jsonResponse(ctx, 200, response)
}

func persistGeneratedZImage(req ServiceUsageRequest, user *User, result []byte) ([]byte, *GeneratedImage) {
	if req.Service != "zimage" || req.Prompt == "" || user == nil {
		return result, nil
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(result, &payload); err != nil {
		return result, nil
	}
	imageB64, _ := payload["image_base64"].(string)
	if imageB64 == "" {
		// OpenAI-compatible omniserve response: data[0].b64_json
		if data, ok := payload["data"].([]interface{}); ok && len(data) > 0 {
			if row, ok := data[0].(map[string]interface{}); ok {
				imageB64, _ = row["b64_json"].(string)
			}
		}
	}
	if imageB64 == "" {
		return result, nil
	}
	imageBytes, err := base64.StdEncoding.DecodeString(imageB64)
	if err != nil || len(imageBytes) == 0 {
		log.Printf("zimage persist decode failed: %v", err)
		return result, nil
	}

	imageID := newUUID()
	hash := sha1.Sum([]byte(req.Prompt))
	fileName := fmt.Sprintf("%s_%s.webp", hex.EncodeToString(hash[:])[:16], imageID[:8])
	relPath := filepath.ToSlash(filepath.Join("originals", fileName))
	imageDir := getEnv("IMAGES_DIR", "/sdb-disk/manifoldgen-images")
	fullPath := filepath.Join(imageDir, relPath)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		log.Printf("zimage persist mkdir failed: %v", err)
		return result, nil
	}
	if err := os.WriteFile(fullPath, imageBytes, 0644); err != nil {
		log.Printf("zimage persist write failed: %v", err)
		return result, nil
	}
	if recompressed, err := recompressWebPQ85(fullPath); err == nil && len(recompressed) > 0 {
		imageBytes = recompressed
	} else if err != nil {
		log.Printf("zimage webp q85 recompress skipped: %v", err)
	}
	if err := uploadGalleryImageToR2(relPath, imageBytes); err != nil {
		// Do not discard a successful generation if storage is temporarily down;
		// it remains on disk for the deploy sync to publish later.
		log.Printf("zimage gallery upload failed: %v", err)
	}

	width := intFromPayload(payload, "width", req.Width)
	if width <= 0 {
		width = 1024
	}
	height := intFromPayload(payload, "height", req.Height)
	if height <= 0 {
		height = 1024
	}
	seed := int64(intFromPayload(payload, "seed", req.Seed))
	steps := getZImageSteps(req)
	img := &GeneratedImage{
		ID:              imageID,
		Prompt:          req.Prompt,
		Width:           width,
		Height:          height,
		FilePath:        relPath,
		ThumbPath:       relPath,
		MedPath:         relPath,
		FileSize:        int64(len(imageBytes)),
		Model:           "zimage",
		Seed:            seed,
		Steps:           steps,
		CreatedByUserID: user.ID,
		CreatedAt:       time.Now(),
	}
	if err := dbConn.InsertGeneratedImage(img); err != nil {
		log.Printf("zimage persist db insert failed: %v", err)
		return result, nil
	}

	payload["gallery_image"] = img
	updated, err := json.Marshal(payload)
	if err != nil {
		return result, img
	}
	return updated, img
}

// persistAdditionalZImages stores the remaining members of a batched image
// response. The primary image is persisted by persistGeneratedZImage above;
// this keeps the legacy saved_image response intact while making n=4 useful to
// the gallery as well.
func persistAdditionalZImages(req ServiceUsageRequest, user *User, result []byte) ([]byte, []*GeneratedImage) {
	var payload map[string]interface{}
	if err := json.Unmarshal(result, &payload); err != nil {
		return result, nil
	}
	rows, ok := payload["images"].([]interface{})
	if !ok || len(rows) < 2 {
		return result, nil
	}
	additional := make([]*GeneratedImage, 0, len(rows)-1)
	galleryRows := make([]interface{}, 0, len(rows))
	if first, ok := payload["gallery_image"]; ok {
		galleryRows = append(galleryRows, first)
	}
	for _, row := range rows[1:] {
		item, ok := row.(map[string]interface{})
		if !ok {
			continue
		}
		b64, _ := item["image_base64"].(string)
		if b64 == "" {
			continue
		}
		one, _ := json.Marshal(map[string]interface{}{
			"image_base64": b64,
			"width":        payload["width"], "height": payload["height"], "seed": payload["seed"],
		})
		updated, saved := persistGeneratedZImage(req, user, one)
		if saved == nil {
			continue
		}
		additional = append(additional, saved)
		var savedPayload map[string]interface{}
		if json.Unmarshal(updated, &savedPayload) == nil {
			if gallery, ok := savedPayload["gallery_image"]; ok {
				galleryRows = append(galleryRows, gallery)
			}
		}
	}
	if len(galleryRows) > 0 {
		payload["gallery_images"] = galleryRows
	}
	updated, err := json.Marshal(payload)
	if err != nil {
		return result, additional
	}
	return updated, additional
}

// uploadGalleryImageToR2 keeps the public gallery on its dedicated bucket,
// rather than relying on the API server's /images route. relPath is stored in
// the database without the gallery prefix (for example originals/foo.webp).
func uploadGalleryImageToR2(relPath string, image []byte) error {
	if len(image) == 0 {
		return fmt.Errorf("gallery image is empty")
	}
	key := strings.TrimSuffix(r2PathPrefix, "/") + "/" + strings.TrimLeft(relPath, "/")
	uploadURL, err := presignR2PutObject(key, "image/webp", 900)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(image))
	if err != nil {
		return err
	}
	req.ContentLength = int64(len(image))
	req.Header.Set("Content-Type", "image/webp")
	resp, err := backendClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return fmt.Errorf("R2 gallery upload returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	return nil
}

func intFromPayload(payload map[string]interface{}, key string, fallback int) int {
	switch v := payload[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	case json.Number:
		i, _ := v.Int64()
		return int(i)
	default:
		return fallback
	}
}

// recompressWebPQ85 rewrites path via cwebp -q 85 when available.
func recompressWebPQ85(path string) ([]byte, error) {
	cwebp, err := exec.LookPath("cwebp")
	if err != nil {
		return nil, err
	}
	tmp := path + ".q85.tmp"
	cmd := exec.Command(cwebp, "-q", "85", "-m", "6", path, "-o", tmp)
	if out, err := cmd.CombinedOutput(); err != nil {
		_ = os.Remove(tmp)
		return nil, fmt.Errorf("%v: %s", err, truncateString(string(out), 200))
	}
	data, err := os.ReadFile(tmp)
	if err != nil {
		_ = os.Remove(tmp)
		return nil, err
	}
	if err := os.Rename(tmp, path); err != nil {
		_ = os.Remove(tmp)
		return nil, err
	}
	return data, nil
}

// settleLoraTrainingJob polls the inference server for a training job and
// finalizes billing: if the job completes we log a permanent billing event;
// if it fails, we refund the credits and log a refund event.
// Runs as a goroutine; blocks up to ~2 hours before giving up (keeping charge).
func settleLoraTrainingJob(userID, jobID string, cuteCost, cutePrice float64) {
	backendURL := serviceBackends["lora_training"]
	endpoint := fmt.Sprintf("%s/train/%s", backendURL, jobID)
	usdEquiv := cuteCost * cutePrice

	start := time.Now()
	for time.Since(start) < 2*time.Hour {
		time.Sleep(5 * time.Second)
		resp, err := backendClient.Get(endpoint)
		if err != nil {
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 {
			continue
		}

		var job struct {
			Status     string  `json:"status"`
			OutputPath string  `json:"output_path"`
			ErrorMsg   string  `json:"error"`
			Loss       float64 `json:"loss"`
		}
		if err := json.Unmarshal(body, &job); err != nil {
			continue
		}

		switch job.Status {
		case "completed":
			// Finalize: the credits were already held. Log the billing event now.
			// Use a no-op add of 0 to fetch current balance.
			balAfter, _ := dbConn.AddUserCredits(userID, 0)
			dbConn.CreateBillingEvent(&BillingEvent{
				UserID:       userID,
				EventType:    "lora_training",
				Amount:       -cuteCost,
				CuteAmount:   cuteCost,
				USDAmount:    usdEquiv,
				Description:  fmt.Sprintf("LoRA training completed (job=%s, loss=%.4f, output=%s)", jobID, job.Loss, job.OutputPath),
				CreditsAfter: balAfter,
			})
			log.Printf("Lora job %s settled: completed, charged %.2f MANIFOLD ($%.4f)", jobID, cuteCost, usdEquiv)
			return

		case "failed":
			// Refund the hold
			refundBalance, rerr := dbConn.AddUserCredits(userID, cuteCost)
			if rerr == nil {
				dbConn.CreateBillingEvent(&BillingEvent{
					UserID:       userID,
					EventType:    "refund",
					Amount:       cuteCost,
					CuteAmount:   cuteCost,
					USDAmount:    usdEquiv,
					Description:  fmt.Sprintf("Refund: LoRA training failed (job=%s): %s", jobID, truncateString(job.ErrorMsg, 200)),
					CreditsAfter: refundBalance,
				})
			}
			log.Printf("Lora job %s settled: failed, refunded %.2f MANIFOLD. Error: %s", jobID, cuteCost, job.ErrorMsg)
			return
		}
	}

	log.Printf("Lora job %s: gave up polling after 2h, charge stands", jobID)
}

func truncateString(s string, n int) string {
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}

// proxyToBackend forwards the request to the appropriate AI service backend
func proxyToBackend(req ServiceUsageRequest, backendURL string) ([]byte, error) {
	var endpoint string
	var body io.Reader
	var method = "POST"

	switch req.Service {
	case "zimage":
		return proxyZImageWithFallbacks(req, backendURL)

	case "chronos2":
		endpoint = fmt.Sprintf("%s/forecast", backendURL)
		payload := map[string]interface{}{
			"values": req.Values,
		}
		if req.PredictionLength > 0 {
			payload["prediction_length"] = req.PredictionLength
		}
		if len(req.QuantileLevels) > 0 {
			payload["quantile_levels"] = req.QuantileLevels
		}
		jsonBody, _ := json.Marshal(payload)
		body = strings.NewReader(string(jsonBody))

	case "tts":
		return proxyTextGeneratorSpeech(req, backendURL)

	case "stt":
		endpoint = fmt.Sprintf("%s/transcribe", backendURL)
		jsonBody, _ := json.Marshal(map[string]interface{}{
			"audio_url": req.AudioURL,
		})
		body = strings.NewReader(string(jsonBody))

	case "gemma4":
		endpoint = fmt.Sprintf("%s/chat", backendURL)
		payload := map[string]interface{}{
			"messages":    req.Messages,
			"max_tokens":  req.MaxTokens,
			"temperature": req.Temperature,
		}
		if req.MaxTokens == 0 {
			payload["max_tokens"] = 1024
		}
		if req.Temperature == 0 {
			payload["temperature"] = 0.7
		}
		jsonBody, _ := json.Marshal(payload)
		body = strings.NewReader(string(jsonBody))

	case "caption":
		endpoint = fmt.Sprintf("%s/caption", backendURL)
		jsonBody, _ := json.Marshal(map[string]interface{}{
			"image_url": req.ImageURL,
		})
		body = strings.NewReader(string(jsonBody))

	case "ltx_video":
		endpoint = "https://fal.run/fal-ai/ltx-2.3/text-to-video"
		payload := map[string]interface{}{
			"prompt":     req.Prompt,
			"duration":   6,
			"resolution": "1080p",
			"fps":        25,
		}
		jsonBody, _ := json.Marshal(payload)
		body = strings.NewReader(string(jsonBody))
		// FAL auth is handled below in the request

	case "video_generate":
		return proxyOpenPathsVideo(req)

	case "flux_image":
		endpoint = "https://fal.run/fal-ai/flux/schnell"
		payload := map[string]interface{}{
			"prompt":              req.Prompt,
			"image_size":          "square_hd",
			"num_inference_steps": 4,
		}
		jsonBody, _ := json.Marshal(payload)
		body = strings.NewReader(string(jsonBody))

	case "lora_training":
		endpoint = fmt.Sprintf("%s/train", backendURL)
		payload := map[string]interface{}{
			"model":        req.Model,
			"dataset_name": req.DatasetName,
		}
		if len(req.TrainValues) > 0 {
			payload["values"] = req.TrainValues
		}
		if req.LoRAR > 0 {
			payload["lora_r"] = req.LoRAR
		}
		if req.LoRAAlpha > 0 {
			payload["lora_alpha"] = req.LoRAAlpha
		}
		if req.LearningRate > 0 {
			payload["learning_rate"] = req.LearningRate
		}
		if req.TrainSteps > 0 {
			payload["num_steps"] = req.TrainSteps
		}
		if req.TrainBatch > 0 {
			payload["batch_size"] = req.TrainBatch
		}
		jsonBody, _ := json.Marshal(payload)
		body = strings.NewReader(string(jsonBody))

	default:
		return nil, fmt.Errorf("unknown service: %s", req.Service)
	}

	httpReq, err := http.NewRequest(method, endpoint, body)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	// Add FAL API key for fal.ai proxy services
	if (req.Service == "ltx_video" || req.Service == "flux_image") && falAPIKey != "" {
		httpReq.Header.Set("Authorization", "Key "+falAPIKey)
	}

	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("backend returned %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

func isOmniserveNativeURL(backendURL string) bool {
	u := strings.ToLower(backendURL)
	return strings.Contains(u, "8791") || strings.Contains(u, "omniserve")
}

func proxyZImageWithFallbacks(req ServiceUsageRequest, primaryURL string) ([]byte, error) {
	backends := zimageBackendOrder(req, primaryURL)
	var errs []string
	for _, b := range backends {
		result, err := proxyZImageBackend(req, b.name, b.url)
		if err == nil {
			return result, nil
		}
		log.Printf("zimage backend %s failed: %v", b.name, err)
		errs = append(errs, fmt.Sprintf("%s: %v", b.name, err))
	}
	if len(errs) == 0 {
		return nil, fmt.Errorf("no image backends configured")
	}
	return nil, fmt.Errorf("all image backends failed: %s", strings.Join(errs, " | "))
}

type namedBackend struct {
	name string
	url  string
}

func zimageBackendOrder(req ServiceUsageRequest, primaryURL string) []namedBackend {
	prefer := strings.ToLower(strings.TrimSpace(req.ImageBackend))
	omni := strings.TrimSpace(getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"))
	images3 := strings.TrimSpace(getEnv("IMAGES3_URL", "https://images3.netwrck.com"))
	r1 := strings.TrimSpace(getEnv("RA1_URL", getEnv("R1_URL", "https://ra.netwrck.com")))
	legacy := strings.TrimSpace(primaryURL)

	ordered := []namedBackend{
		{name: "omniserve", url: omni},
		{name: "images3", url: images3},
		{name: "r1", url: r1},
	}
	if legacy != "" && !isOmniserveNativeURL(legacy) && !strings.Contains(strings.ToLower(legacy), "images3") && !strings.Contains(strings.ToLower(legacy), "ra.netwrck") {
		ordered = append(ordered, namedBackend{name: "legacy", url: legacy})
	}

	if prefer == "" || prefer == "auto" {
		return filterNonEmptyBackends(ordered)
	}
	var preferred []namedBackend
	var rest []namedBackend
	for _, b := range ordered {
		if b.name == prefer {
			preferred = append(preferred, b)
		} else {
			rest = append(rest, b)
		}
	}
	return filterNonEmptyBackends(append(preferred, rest...))
}

func filterNonEmptyBackends(in []namedBackend) []namedBackend {
	out := make([]namedBackend, 0, len(in))
	seen := map[string]bool{}
	for _, b := range in {
		u := strings.TrimRight(strings.TrimSpace(b.url), "/")
		if u == "" || seen[u] {
			continue
		}
		seen[u] = true
		b.url = u
		out = append(out, b)
	}
	return out
}

func proxyZImageBackend(req ServiceUsageRequest, name, backendURL string) ([]byte, error) {
	switch name {
	case "omniserve":
		return proxyOmniserveZImage(req, backendURL)
	case "images3":
		return proxyImages3ZImage(req, backendURL)
	case "r1":
		return proxyR1ZImage(req, backendURL)
	default:
		return proxyLegacyZImageHTTP(req, backendURL)
	}
}

func proxyOmniserveZImage(req ServiceUsageRequest, backendURL string) ([]byte, error) {
	width := req.Width
	if width <= 0 {
		width = 1024
	}
	height := req.Height
	if height <= 0 {
		height = 1024
	}
	n := getImageCount(req)
	payload := map[string]interface{}{
		"prompt": req.Prompt,
		"size":   fmt.Sprintf("%dx%d", width, height),
		"n":      n,
	}
	if req.Seed > 0 {
		payload["seed"] = req.Seed
	}
	jsonBody, _ := json.Marshal(payload)
	endpoint := strings.TrimRight(backendURL, "/") + "/v1/images/generations"
	httpReq, err := http.NewRequest("POST", endpoint, strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("omniserve returned %d: %s", resp.StatusCode, truncateString(string(respBody), 400))
	}

	var openai struct {
		Data []struct {
			B64JSON string `json:"b64_json"`
			URL     string `json:"url"`
		} `json:"data"`
		Model string `json:"model"`
	}
	if err := json.Unmarshal(respBody, &openai); err != nil || len(openai.Data) == 0 {
		return respBody, nil
	}
	images := make([]map[string]interface{}, 0, len(openai.Data))
	firstB64 := ""
	for _, row := range openai.Data {
		item := map[string]interface{}{}
		if row.B64JSON != "" {
			item["image_base64"] = row.B64JSON
			if firstB64 == "" {
				firstB64 = row.B64JSON
			}
		}
		if row.URL != "" {
			item["image_url"] = row.URL
		}
		images = append(images, item)
	}
	normalized, _ := json.Marshal(map[string]interface{}{
		"image_base64": firstB64,
		"images":       images,
		"n":            len(images),
		"width":        width,
		"height":       height,
		"format":       "webp",
		"engine":       "omniserve-native",
		"model":        openai.Model,
		"prompt":       req.Prompt,
	})
	return normalized, nil
}

func proxyImages3ZImage(req ServiceUsageRequest, backendURL string) ([]byte, error) {
	width := req.Width
	if width <= 0 {
		width = 1024
	}
	height := req.Height
	if height <= 0 {
		height = 1024
	}
	n := getImageCount(req)
	images := make([]map[string]interface{}, 0, n)
	var firstB64 string
	var firstURL string
	for i := 0; i < n; i++ {
		q := url.Values{}
		q.Set("prompt", req.Prompt)
		q.Set("width", strconv.Itoa(width))
		q.Set("height", strconv.Itoa(height))
		endpoint := strings.TrimRight(backendURL, "/") + "/create_and_upload_image?" + q.Encode()
		httpReq, err := http.NewRequest("GET", endpoint, nil)
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Accept", "application/json")
		resp, err := backendClient.Do(httpReq)
		if err != nil {
			return nil, err
		}
		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("images3 returned %d: %s", resp.StatusCode, truncateString(string(respBody), 400))
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(respBody, &payload); err != nil {
			return nil, err
		}
		imageURL, _ := payload["path"].(string)
		if imageURL == "" {
			imageURL, _ = payload["image_url"].(string)
		}
		if imageURL == "" {
			imageURL, _ = payload["url"].(string)
		}
		b64, _ := payload["image_base64"].(string)
		if b64 == "" {
			b64, _ = payload["b64_json"].(string)
		}
		if imageURL == "" && b64 == "" {
			return nil, fmt.Errorf("images3 response missing image")
		}
		item := map[string]interface{}{}
		if b64 != "" {
			item["image_base64"] = b64
			if firstB64 == "" {
				firstB64 = b64
			}
		}
		if imageURL != "" {
			item["image_url"] = imageURL
			if firstURL == "" {
				firstURL = imageURL
			}
		}
		images = append(images, item)
	}
	out := map[string]interface{}{
		"images": images,
		"n":      len(images),
		"width":  width,
		"height": height,
		"engine": "images3",
		"prompt": req.Prompt,
	}
	if firstB64 != "" {
		out["image_base64"] = firstB64
	}
	if firstURL != "" {
		out["image_url"] = firstURL
	}
	return json.Marshal(out)
}

func proxyR1ZImage(req ServiceUsageRequest, backendURL string) ([]byte, error) {
	width := req.Width
	if width <= 0 {
		width = 1024
	}
	height := req.Height
	if height <= 0 {
		height = 1024
	}
	n := getImageCount(req)
	payload := map[string]interface{}{
		"prompt": req.Prompt,
		"width":  width,
		"height": height,
		"n":      n,
	}
	if req.Seed > 0 {
		payload["seed"] = req.Seed
	}
	jsonBody, _ := json.Marshal(payload)
	base := strings.TrimRight(backendURL, "/")
	endpoints := []string{base + "/ra", base + "/api/ra1", base}
	var lastErr error
	for _, endpoint := range endpoints {
		httpReq, err := http.NewRequest("POST", endpoint, strings.NewReader(string(jsonBody)))
		if err != nil {
			lastErr = err
			continue
		}
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Accept", "application/json")
		if key := strings.TrimSpace(os.Getenv("RA1_API_KEY")); key != "" {
			httpReq.Header.Set("Authorization", "Bearer "+key)
		}
		resp, err := backendClient.Do(httpReq)
		if err != nil {
			lastErr = err
			continue
		}
		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode >= 400 {
			lastErr = fmt.Errorf("r1 returned %d: %s", resp.StatusCode, truncateString(string(respBody), 400))
			continue
		}
		var payload map[string]interface{}
		if err := json.Unmarshal(respBody, &payload); err != nil {
			lastErr = err
			continue
		}
		imageURL, _ := payload["image_url"].(string)
		if imageURL == "" {
			imageURL, _ = payload["url"].(string)
		}
		if imageURL == "" {
			if data, ok := payload["data"].([]interface{}); ok && len(data) > 0 {
				if row, ok := data[0].(map[string]interface{}); ok {
					imageURL, _ = row["url"].(string)
				}
			}
		}
		b64, _ := payload["image_base64"].(string)
		if imageURL == "" && b64 == "" {
			lastErr = fmt.Errorf("r1 response missing image")
			continue
		}
		out := map[string]interface{}{
			"engine": "r1",
			"prompt": req.Prompt,
			"width":  width,
			"height": height,
			"n":      n,
		}
		if b64 != "" {
			out["image_base64"] = b64
		}
		if imageURL != "" {
			out["image_url"] = imageURL
		}
		out["images"] = []map[string]interface{}{{"image_url": imageURL, "image_base64": b64}}
		return json.Marshal(out)
	}
	if lastErr == nil {
		lastErr = fmt.Errorf("r1 unavailable")
	}
	return nil, lastErr
}

func proxyLegacyZImageHTTP(req ServiceUsageRequest, backendURL string) ([]byte, error) {
	if diffusionzAvailable {
		width := req.Width
		if width <= 0 {
			width = 1024
		}
		height := req.Height
		if height <= 0 {
			height = 1024
		}
		steps := req.NumSteps
		if steps <= 0 {
			steps = zimageDefaultSteps
		}
		guidance := req.Guidance
		if guidance <= 0 {
			guidance = 3.5
		}
		imgBytes, err := generateImageC(req.Prompt, width, height, steps, req.Seed, guidance)
		if err == nil {
			result, _ := json.Marshal(map[string]interface{}{
				"image_bytes_len": len(imgBytes),
				"width":           width,
				"height":          height,
				"format":          "webp",
				"engine":          "diffusionz",
			})
			return result, nil
		}
		log.Printf("diffusionz generateImageC failed, falling back to HTTP proxy: %v", err)
	}

	endpoint := fmt.Sprintf("%s/generate_image", strings.TrimRight(backendURL, "/"))
	payload := map[string]interface{}{
		"prompt":              req.Prompt,
		"num_inference_steps": getZImageSteps(req),
		"num_images":          getImageCount(req),
	}
	if req.Width > 0 {
		payload["width"] = req.Width
	}
	if req.Height > 0 {
		payload["height"] = req.Height
	}
	if req.Guidance > 0 {
		payload["guidance_scale"] = req.Guidance
	}
	if req.Seed > 0 {
		payload["seed"] = req.Seed
	}
	if req.LoRAID != "" {
		payload["lora_id"] = req.LoRAID
	}
	if req.AutoLoRA != nil {
		payload["auto_lora"] = *req.AutoLoRA
	}
	jsonBody, _ := json.Marshal(payload)
	httpReq, err := http.NewRequest("POST", endpoint, strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("legacy zimage returned %d: %s", resp.StatusCode, truncateString(string(respBody), 400))
	}
	return respBody, nil
}

func getTTSText(req ServiceUsageRequest) string {
	if strings.TrimSpace(req.Text) != "" {
		return req.Text
	}
	return req.Input
}

func getTTSSteps(req ServiceUsageRequest) int {
	if req.Steps > 0 {
		return req.Steps
	}
	if req.NumSteps > 0 {
		return req.NumSteps
	}
	return 4
}

func speechFormatFromContentType(contentType string) string {
	contentType = strings.ToLower(contentType)
	switch {
	case strings.Contains(contentType, "mpeg"), strings.Contains(contentType, "mp3"):
		return "mp3"
	case strings.Contains(contentType, "ogg"):
		return "ogg"
	case strings.Contains(contentType, "webm"):
		return "webm"
	case strings.Contains(contentType, "wav"), strings.Contains(contentType, "wave"):
		return "wav"
	default:
		return "wav"
	}
}

func proxyTextGeneratorSpeech(req ServiceUsageRequest, backendURL string) ([]byte, error) {
	text := strings.TrimSpace(getTTSText(req))
	if text == "" {
		return nil, fmt.Errorf("text or input is required for tts")
	}

	voice := strings.TrimSpace(req.Voice)
	if voice == "" {
		voice = "M1"
	}
	language := strings.TrimSpace(req.Language)
	if language == "" {
		language = "en"
	}
	speed := req.Speed
	if speed <= 0 {
		speed = 1
	}
	steps := getTTSSteps(req)

	payload := map[string]interface{}{
		"text":     text,
		"voice":    voice,
		"language": language,
		"speed":    speed,
		"steps":    steps,
	}
	jsonBody, _ := json.Marshal(payload)
	endpoint := fmt.Sprintf("%s/api/v1/generate_speech", strings.TrimRight(backendURL, "/"))

	httpReq, err := http.NewRequest("POST", endpoint, strings.NewReader(string(jsonBody)))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if textGeneratorAPIKey != "" {
		httpReq.Header.Set("secret", textGeneratorAPIKey)
	}

	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("text-generator speech returned %d: %s", resp.StatusCode, string(respBody))
	}

	return json.Marshal(map[string]interface{}{
		"audio_base64":  base64.StdEncoding.EncodeToString(respBody),
		"format":        speechFormatFromContentType(resp.Header.Get("Content-Type")),
		"content_type":  resp.Header.Get("Content-Type"),
		"voice":         voice,
		"language":      language,
		"speed":         speed,
		"steps":         steps,
		"characters":    len(text),
		"backend":       "text-generator.io",
		"provider_path": "/api/v1/generate_speech",
	})
}

// handleTrainStatus proxies training job status from inference server
func handleTrainStatus(ctx *fasthttp.RequestCtx, jobID string) {
	backendURL := serviceBackends["lora_training"]
	endpoint := fmt.Sprintf("%s/train/%s", backendURL, jobID)

	resp, err := backendClient.Get(endpoint)
	if err != nil {
		jsonError(ctx, 502, "training backend unavailable")
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		jsonError(ctx, 502, "failed to read training status")
		return
	}

	ctx.SetStatusCode(resp.StatusCode)
	ctx.SetBody(respBody)
}

// handleListTrainingDatasets proxies the dataset listing from inference server.
func handleListTrainingDatasets(ctx *fasthttp.RequestCtx) {
	backendURL := serviceBackends["lora_training"]
	resp, err := backendClient.Get(backendURL + "/train/datasets")
	if err != nil {
		jsonError(ctx, 502, "training backend unavailable")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	ctx.SetStatusCode(resp.StatusCode)
	ctx.SetBody(body)
}

// handleUploadTrainingDataset accepts multipart upload and forwards to inference.
// Auth: Bearer API key. Does not deduct credits — that happens at /api/service POST when training starts.
func handleUploadTrainingDataset(ctx *fasthttp.RequestCtx) {
	authHeader := string(ctx.Request.Header.Peek("Authorization"))
	if !strings.HasPrefix(authHeader, "Bearer ") {
		jsonError(ctx, 401, "API key required (Authorization: Bearer ...)")
		return
	}
	apiKey := strings.TrimPrefix(authHeader, "Bearer ")
	if _, err := dbConn.GetUserByAPIKey(apiKey); err != nil {
		jsonError(ctx, 401, "invalid API key")
		return
	}

	// Forward multipart body verbatim to inference /train/upload_dataset
	backendURL := serviceBackends["lora_training"]
	endpoint := backendURL + "/train/upload_dataset"

	httpReq, err := http.NewRequest("POST", endpoint, strings.NewReader(string(ctx.PostBody())))
	if err != nil {
		jsonError(ctx, 500, "failed to build upload request")
		return
	}
	contentType := string(ctx.Request.Header.ContentType())
	httpReq.Header.Set("Content-Type", contentType)
	httpReq.ContentLength = int64(len(ctx.PostBody()))

	resp, err := backendClient.Do(httpReq)
	if err != nil {
		jsonError(ctx, 502, "upload backend unavailable")
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	ctx.SetStatusCode(resp.StatusCode)
	ctx.SetBody(body)
}

// handleGetBalance returns wallet balance and credit info
func handleGetBalance(ctx *fasthttp.RequestCtx) {
	wallet := string(ctx.QueryArgs().Peek("wallet"))
	if wallet == "" {
		jsonError(ctx, 400, "wallet query param required")
		return
	}

	user, err := dbConn.GetUserByWallet(wallet)
	if err != nil {
		// Return zero balance for unknown wallets
		jsonResponse(ctx, 200, WalletBalanceResponse{
			WalletAddress: wallet,
			Credits:       0,
			CreditsUSD:    0,
			CutePrice:     getCUTEPriceUSD(),
		})
		return
	}

	cutePrice := getCUTEPriceUSD()
	jsonResponse(ctx, 200, WalletBalanceResponse{
		WalletAddress:         user.WalletAddress,
		Credits:               user.Credits,
		CreditsUSD:            user.Credits * cutePrice,
		CutePrice:             cutePrice,
		TotalDeposited:        user.TotalDeposited,
		StripeCustomerID:      user.StripeCustomerID,
		AutotopupEnabled:      user.AutotopupEnabled,
		AutotopupThresholdUSD: user.AutotopupThresholdUSD,
		AutotopupAmountUSD:    user.AutotopupAmountUSD,
		HasPaymentMethod:      user.StripePaymentMethodID != "",
		HasPassword:           user.PasswordHash != "",
		UnlimitedAPI:          user.UnlimitedAPI,
		SubscriptionStatus:    user.SubscriptionStatus,
		SubscriptionPlan:      user.SubscriptionPlan,
		StripePriceID:         user.StripePriceID,
	})
}

// handleGetBillingHistory returns billing events for a wallet
func handleGetBillingHistory(ctx *fasthttp.RequestCtx) {
	wallet := string(ctx.QueryArgs().Peek("wallet"))
	if wallet == "" {
		jsonError(ctx, 400, "wallet query param required")
		return
	}

	user, err := dbConn.GetUserByWallet(wallet)
	if err != nil {
		jsonResponse(ctx, 200, map[string]interface{}{"events": []interface{}{}})
		return
	}

	events, err := dbConn.GetUserBillingHistory(user.ID, 50)
	if err != nil {
		jsonError(ctx, 500, "failed to get billing history")
		return
	}

	jsonResponse(ctx, 200, map[string]interface{}{"events": events})
}
