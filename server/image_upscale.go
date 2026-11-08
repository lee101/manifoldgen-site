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
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	imageUpscale2xUSD       = 0.02
	imageUpscale4xUSD       = 0.03
	imageUpscaleCreativeUSD = 0.15
	imageUpscaleMaxBytes    = 64 << 20
)

var imageUpscaleHTTPClient = &http.Client{Timeout: 3 * time.Minute}

type imageUpscaleResult struct {
	URL     string `json:"image_url"`
	Backend string `json:"backend"`
	Engine  string `json:"engine"`
	Width   int    `json:"width,omitempty"`
	Height  int    `json:"height,omitempty"`
	Scale   int    `json:"scale"`
}

func normalizeUpscaleScale(scale int) int {
	if scale == 4 {
		return 4
	}
	return 2
}

func normalizeUpscaleModel(model string) string {
	switch strings.ToLower(strings.TrimSpace(model)) {
	case "creative", "creative-upscaler":
		return "creative"
	case "anime":
		return "anime"
	default:
		return "general"
	}
}

func imageUpscalePriceUSD(scale int, model string) float64 {
	if normalizeUpscaleModel(model) == "creative" {
		return imageUpscaleCreativeUSD
	}
	if normalizeUpscaleScale(scale) == 4 {
		return imageUpscale4xUSD
	}
	return imageUpscale2xUSD
}

func nativeUpscaleImage(ctx context.Context, imageURL string, scale int, model string) ([]byte, string, int, int, error) {
	base := strings.TrimRight(getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"), "/")
	format := "png"
	if scale == 4 {
		format = "webp"
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"image_url": imageURL, "scale": scale, "model": model, "output_format": format,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/v1/images/upscales", bytes.NewReader(payload))
	if err != nil {
		return nil, "", 0, 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	if secret := strings.TrimSpace(getEnv("OMNISERVE_NATIVE_SECRET", getEnv("OMNISERVE_SECRET", ""))); secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}
	resp, err := imageUpscaleHTTPClient.Do(req)
	if err != nil {
		return nil, "", 0, 0, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, imageUpscaleMaxBytes))
	if err != nil {
		return nil, "", 0, 0, err
	}
	contentType := resp.Header.Get("Content-Type")
	if resp.StatusCode >= 300 {
		return nil, "", 0, 0, fmt.Errorf("native upscale returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	if len(body) == 0 || !strings.HasPrefix(contentType, "image/") {
		return nil, "", 0, 0, fmt.Errorf("native upscale returned no image")
	}
	width, _ := strconv.Atoi(resp.Header.Get("X-Upscale-Width"))
	height, _ := strconv.Atoi(resp.Header.Get("X-Upscale-Height"))
	return body, contentType, width, height, nil
}

func falESRGANUpscale(imageURL string, scale int, model string) (string, error) {
	if strings.TrimSpace(falAPIKey) == "" {
		return "", fmt.Errorf("upscale fallback requires FAL_KEY")
	}
	falModel := "RealESRGAN_x4plus"
	if model == "anime" {
		falModel = "RealESRGAN_x4plus_anime_6B"
	} else if scale == 2 {
		falModel = "RealESRGAN_x2plus"
	}
	result, err := runFalQueuedJob("fal-ai/esrgan", map[string]interface{}{
		"image_url": imageURL, "scale": scale, "model": falModel, "output_format": "png",
	})
	if err != nil {
		return "", err
	}
	urls := extractPayloadImageURLs(result)
	if len(urls) == 0 {
		return "", fmt.Errorf("esrgan fallback returned no image")
	}
	return urls[0], nil
}

func falCreativeUpscale(imageURL string) (string, error) {
	if strings.TrimSpace(falAPIKey) == "" {
		return "", fmt.Errorf("creative upscale requires FAL_KEY")
	}
	result, err := runFalQueuedJob("fal-ai/creative-upscaler", map[string]interface{}{
		"image_url": imageURL, "scale": 2, "creativity": 0.35, "output_format": "png",
	})
	if err != nil {
		return "", err
	}
	urls := extractPayloadImageURLs(result)
	if len(urls) == 0 {
		return "", fmt.Errorf("creative upscale returned no image")
	}
	return urls[0], nil
}

var nativeUpscaleImageFunc = nativeUpscaleImage
var falESRGANUpscaleFunc = falESRGANUpscale
var falCreativeUpscaleFunc = falCreativeUpscale
var uploadUpscaledImageFunc = func(ctx context.Context, image []byte, userID, contentType string) (string, error) {
	url, _, err := uploadGeneratedImageArtifact(ctx, image, userID, contentType, "upscale")
	return url, err
}

func upscaleImage(ctx context.Context, userID, imageURL string, scale int, model string) (imageUpscaleResult, error) {
	scale = normalizeUpscaleScale(scale)
	model = normalizeUpscaleModel(model)
	if model == "creative" {
		url, err := falCreativeUpscaleFunc(imageURL)
		if err != nil {
			return imageUpscaleResult{}, err
		}
		return imageUpscaleResult{URL: url, Backend: "fal", Engine: "creative-upscaler", Scale: 2}, nil
	}
	image, contentType, width, height, err := nativeUpscaleImageFunc(ctx, imageURL, scale, model)
	if err == nil {
		url, uploadErr := uploadUpscaledImageFunc(ctx, image, userID, contentType)
		if uploadErr == nil {
			return imageUpscaleResult{URL: url, Backend: "native", Engine: "upscaler", Width: width, Height: height, Scale: scale}, nil
		}
		err = uploadErr
	}
	log.Printf("image upscale native unavailable: %v", err)
	url, fallbackErr := falESRGANUpscaleFunc(imageURL, scale, model)
	if fallbackErr != nil {
		return imageUpscaleResult{}, fmt.Errorf("native: %v; fallback: %v", err, fallbackErr)
	}
	return imageUpscaleResult{URL: url, Backend: "fallback", Engine: "upscaler", Scale: scale}, nil
}

func proxyUpscaleImage(req ServiceUsageRequest) ([]byte, error) {
	imageURL := strings.TrimSpace(req.ImageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("image_url is required for upscale")
	}
	if err := validateHTTPURL(imageURL); err != nil {
		return nil, err
	}
	result, err := upscaleImage(context.Background(), "", imageURL, req.Scale, req.Model)
	if err != nil {
		return nil, err
	}
	normalized, _ := json.Marshal(map[string]interface{}{
		"engine": result.Engine, "backend": result.Backend, "scale": result.Scale,
		"width": result.Width, "height": result.Height, "prompt": req.Prompt,
		"data": urlsToDataRows([]string{result.URL}),
	})
	return normalized, nil
}

func handleStudioUpscaleImage(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		authRequiredError(ctx, err.Error())
		return
	}
	var input struct {
		ImageURL string `json:"image_url"`
		Scale    int    `json:"scale"`
		Model    string `json:"model"`
	}
	if json.Unmarshal(ctx.PostBody(), &input) != nil || validateHTTPURL(strings.TrimSpace(input.ImageURL)) != nil {
		jsonError(ctx, http.StatusBadRequest, "a public image URL is required")
		return
	}
	priceUSD := imageUpscalePriceUSD(input.Scale, input.Model)
	credits := math.Max(1, usdToCredits(priceUSD))
	balance, err := dbConn.DeductUserCredits(user.ID, credits)
	if err != nil {
		chargeError(ctx, err, fmt.Sprintf("insufficient credits: this upscale costs %.0f credits", credits))
		return
	}
	result, err := upscaleImage(ctx, user.ID, strings.TrimSpace(input.ImageURL), input.Scale, input.Model)
	if err != nil {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		log.Printf("studio image upscale failed for %s: %v", user.ID, err)
		jsonError(ctx, http.StatusBadGateway, "image upscale is temporarily unavailable")
		return
	}
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: "image_upscale", Amount: -credits,
		CuteAmount: credits, USDAmount: credits * getCUTEPriceUSD(),
		Description: fmt.Sprintf("Image upscale %dx", result.Scale), CreditsAfter: balance,
	})
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"image_url": result.URL, "backend": result.Backend, "engine": result.Engine, "scale": result.Scale,
		"width": result.Width, "height": result.Height, "credits_used": credits, "credits_remain": balance,
	})
}
