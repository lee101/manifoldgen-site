package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
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
	studioBackgroundCredits  = 1.0
	studioExtendInputPerSec  = 0.012
	studioExtendOutputPerSec = 0.084
	studioAudioSearchLimit   = 24
)

var studioHTTPClient = &http.Client{Timeout: 4 * time.Minute}

type studioAudioAsset struct {
	ID          int64    `json:"id"`
	Title       string   `json:"title"`
	Tags        []string `json:"tags,omitempty"`
	URL         string   `json:"url"`
	PreviewURL  string   `json:"preview_url,omitempty"`
	Duration    float64  `json:"duration"`
	Provider    string   `json:"provider"`
	Kind        string   `json:"kind"`
	Description string   `json:"description,omitempty"`
	License     string   `json:"license"`
	LicenseURL  string   `json:"license_url,omitempty"`
	Attribution string   `json:"attribution,omitempty"`
	SourceURL   string   `json:"source_url,omitempty"`
}

func studioAudioSearchURL(base, query, kind string, limit int) (string, error) {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if parsed, err := url.Parse(base); err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return "", fmt.Errorf("invalid audio index URL")
	}
	query = strings.TrimSpace(query)
	if len(query) > 200 {
		return "", fmt.Errorf("search is too long")
	}
	switch kind {
	case "", "music", "sfx", "voice":
	default:
		return "", fmt.Errorf("unsupported audio kind")
	}
	if limit < 1 {
		limit = 12
	}
	if limit > studioAudioSearchLimit {
		limit = studioAudioSearchLimit
	}
	values := url.Values{"query": {query}, "limit": {fmt.Sprintf("%d", limit)}}
	if kind != "" {
		values.Set("kind", kind)
	}
	return base + "/api/search-audio?" + values.Encode(), nil
}

func handleStudioAudioSearch(ctx *fasthttp.RequestCtx) {
	endpoint, err := studioAudioSearchURL(
		getEnv("NETWRCK_AUDIO_INDEX_URL", "https://netwrck.com"),
		string(ctx.QueryArgs().Peek("q")),
		strings.ToLower(strings.TrimSpace(string(ctx.QueryArgs().Peek("kind")))),
		parseInt(string(ctx.QueryArgs().Peek("limit"))),
	)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	req, _ := http.NewRequest(http.MethodGet, endpoint, nil)
	req.Header.Set("Accept", "application/json")
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		jsonError(ctx, http.StatusBadGateway, "audio catalog is temporarily unavailable")
		return
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil || resp.StatusCode != http.StatusOK {
		jsonError(ctx, http.StatusBadGateway, "audio catalog is temporarily unavailable")
		return
	}
	var assets []studioAudioAsset
	if json.Unmarshal(body, &assets) != nil {
		jsonError(ctx, http.StatusBadGateway, "audio catalog returned invalid data")
		return
	}
	clean := assets[:0]
	for _, asset := range assets {
		if asset.Title == "" || studioPublicMediaURL(asset.URL) != nil {
			continue
		}
		if asset.PreviewURL != "" && studioPublicMediaURL(asset.PreviewURL) != nil {
			asset.PreviewURL = ""
		}
		clean = append(clean, asset)
	}
	ctx.Response.Header.Set("Cache-Control", "public, max-age=300")
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"kind": "audio", "results": clean, "count": len(clean), "source": "netwrck",
	})
}

func studioUser(ctx *fasthttp.RequestCtx) (*User, error) {
	auth := strings.TrimSpace(string(ctx.Request.Header.Peek("Authorization")))
	if !strings.HasPrefix(auth, "Bearer ") {
		return nil, fmt.Errorf("sign in required")
	}
	user, err := dbConn.GetUserByAPIKey(strings.TrimSpace(strings.TrimPrefix(auth, "Bearer ")))
	if err != nil {
		return nil, fmt.Errorf("invalid API key")
	}
	return user, nil
}

func studioPublicMediaURL(raw string) error {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return fmt.Errorf("a public media URL is required")
	}
	return nil
}

func studioExtensionPriceUSD(inputSeconds float64, outputSeconds int) float64 {
	return math.Ceil((inputSeconds*studioExtendInputPerSec+float64(outputSeconds)*studioExtendOutputPerSec)*100-1e-9) / 100
}

func studioNativeRequest(imageURL string) (string, error) {
	base := strings.TrimRight(getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"), "/")
	payload, _ := json.Marshal(map[string]interface{}{
		"image_url": imageURL, "output_format": "webp", "cache": true, "decontaminate": true,
	})
	req, err := http.NewRequest(http.MethodPost, base+"/v1/images/background-removals", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if secret := strings.TrimSpace(getEnv("OMNISERVE_NATIVE_SECRET", getEnv("OMNISERVE_SECRET", ""))); secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("native cutout returned %d", resp.StatusCode)
	}
	if remote := strings.TrimSpace(resp.Header.Get("X-Cutout-Url")); remote != "" {
		return remote, nil
	}
	contentType := resp.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		if found := studioMediaURL(body); found != "" {
			return found, nil
		}
		return "", fmt.Errorf("native cutout returned no image")
	}
	if len(body) == 0 {
		return "", fmt.Errorf("native cutout returned an empty image")
	}
	if contentType == "" {
		contentType = "image/webp"
	}
	return "data:" + contentType + ";base64," + base64.StdEncoding.EncodeToString(body), nil
}

func studioFalBackground(imageURL string) (string, error) {
	if falAPIKey == "" {
		return "", fmt.Errorf("background fallback is not configured")
	}
	payload, _ := json.Marshal(map[string]interface{}{"image_url": imageURL, "output_format": "webp"})
	req, err := http.NewRequest(http.MethodPost, "https://fal.run/fal-ai/birefnet/v2", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Key "+falAPIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("background fallback returned %d", resp.StatusCode)
	}
	if found := studioMediaURL(body); found != "" {
		return found, nil
	}
	return "", fmt.Errorf("background fallback returned no image")
}

func studioMediaURL(body []byte) string {
	var payload interface{}
	if json.Unmarshal(body, &payload) != nil {
		return ""
	}
	var visit func(interface{}) string
	visit = func(value interface{}) string {
		switch typed := value.(type) {
		case string:
			if strings.HasPrefix(typed, "http://") || strings.HasPrefix(typed, "https://") || strings.HasPrefix(typed, "data:image/") {
				return typed
			}
		case map[string]interface{}:
			for _, key := range []string{"image_url", "url", "data_url", "image", "result", "output"} {
				if found := visit(typed[key]); found != "" {
					return found
				}
			}
		case []interface{}:
			for _, item := range typed {
				if found := visit(item); found != "" {
					return found
				}
			}
		}
		return ""
	}
	return visit(payload)
}

func handleStudioRemoveBackground(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		ImageURL string `json:"image_url"`
	}
	if json.Unmarshal(ctx.PostBody(), &input) != nil || studioPublicMediaURL(input.ImageURL) != nil {
		jsonError(ctx, http.StatusBadRequest, "a public image URL is required")
		return
	}
	balance, err := dbConn.DeductUserCredits(user.ID, studioBackgroundCredits)
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: background removal costs 1 credit")
		return
	}

	imageURL, nativeErr := studioNativeRequest(input.ImageURL)
	backend := "native"
	if nativeErr != nil {
		log.Printf("studio background native unavailable: %v", nativeErr)
		backend = "fallback"
		imageURL, err = studioFalBackground(input.ImageURL)
	}
	if err != nil || imageURL == "" {
		_, _ = dbConn.AddUserCredits(user.ID, studioBackgroundCredits)
		jsonError(ctx, http.StatusBadGateway, "background removal is temporarily unavailable")
		return
	}
	creditPrice := getCUTEPriceUSD()
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: "background_removal", Amount: -studioBackgroundCredits,
		CuteAmount: studioBackgroundCredits, USDAmount: studioBackgroundCredits * creditPrice,
		Description: "Studio background removal", CreditsAfter: balance,
	})
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"image_url": imageURL, "credits_used": studioBackgroundCredits, "credits_remain": balance, "backend": backend,
	})
}

func studioXAIRequest(method, path string, payload []byte) ([]byte, int, error) {
	key := strings.TrimSpace(os.Getenv("XAI_API_KEY"))
	if key == "" {
		return nil, 0, fmt.Errorf("video extension is not configured")
	}
	var body io.Reader
	if payload != nil {
		body = bytes.NewReader(payload)
	}
	req, err := http.NewRequest(method, "https://api.x.ai"+path, body)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return nil, resp.StatusCode, err
	}
	if resp.StatusCode >= 300 {
		return data, resp.StatusCode, fmt.Errorf("extension service returned %d", resp.StatusCode)
	}
	return data, resp.StatusCode, nil
}

func handleStudioExtendVideo(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		VideoURL       string  `json:"video_url"`
		Prompt         string  `json:"prompt"`
		Duration       int     `json:"duration"`
		SourceDuration float64 `json:"source_duration"`
	}
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	input.Prompt = strings.TrimSpace(input.Prompt)
	if studioPublicMediaURL(input.VideoURL) != nil || input.Prompt == "" || len(input.Prompt) > 4000 {
		jsonError(ctx, http.StatusBadRequest, "video URL and continuation prompt are required")
		return
	}
	if input.Duration < 2 || input.Duration > 10 || input.SourceDuration < 2 || input.SourceDuration > 15.1 {
		jsonError(ctx, http.StatusBadRequest, "source must be 2–15 seconds and extension must be 2–10 seconds")
		return
	}
	priceUSD := studioExtensionPriceUSD(input.SourceDuration, input.Duration)
	creditPrice := getCUTEPriceUSD()
	if creditPrice <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing unavailable")
		return
	}
	credits := math.Ceil(priceUSD / creditPrice)
	balance, err := dbConn.DeductUserCredits(user.ID, credits)
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits", credits))
		return
	}

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model": "grok-imagine-video", "prompt": input.Prompt, "duration": input.Duration,
		"video": map[string]string{"url": input.VideoURL},
	})
	response, _, callErr := studioXAIRequest(http.MethodPost, "/v1/videos/extensions", requestBody)
	if callErr != nil {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		jsonError(ctx, http.StatusBadGateway, "video extension is temporarily unavailable")
		return
	}
	var provider struct {
		RequestID string `json:"request_id"`
	}
	if json.Unmarshal(response, &provider) != nil || provider.RequestID == "" {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		jsonError(ctx, http.StatusBadGateway, "video extension returned an invalid response")
		return
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, provider.RequestID, "studio_extend", input.Prompt)
	if err != nil {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		jsonError(ctx, http.StatusInternalServerError, "could not save extension job")
		return
	}
	initial, _ := json.Marshal(map[string]interface{}{"credits_used": credits, "charged_usd": priceUSD})
	_ = dbConn.UpdateVideoJob(job.ID, "queued", initial, "")
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: "video_extend", Amount: -credits, CuteAmount: credits,
		USDAmount: priceUSD, Description: fmt.Sprintf("Studio video extension (%ds)", input.Duration), CreditsAfter: balance,
	})
	launchVideoJob(job.ID)
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
		"credits_used": credits, "credits_remain": balance, "price_usd": priceUSD,
	})
}

func studioExtensionCredits(job *VideoJob) float64 {
	var initial struct {
		CreditsUsed float64 `json:"credits_used"`
	}
	_ = json.Unmarshal(job.Result, &initial)
	return initial.CreditsUsed
}

func studioRefundExtension(job *VideoJob, reason string) {
	credits := studioExtensionCredits(job)
	if credits > 0 {
		balance, err := dbConn.AddUserCredits(job.UserID, credits)
		if err == nil {
			_ = dbConn.CreateBillingEvent(&BillingEvent{
				UserID: job.UserID, EventType: "refund", Amount: credits, CuteAmount: credits,
				USDAmount: credits * getCUTEPriceUSD(), Description: "Refund: video extension failed", CreditsAfter: balance,
			})
		}
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, reason)
}

func processStudioExtendJob(job *VideoJob) {
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(30 * time.Minute)
	errorsInRow := 0
	for time.Now().Before(deadline) {
		data, _, err := studioXAIRequest(http.MethodGet, "/v1/videos/"+url.PathEscape(job.ProviderJobID), nil)
		if err != nil {
			errorsInRow++
			if errorsInRow >= 8 {
				studioRefundExtension(job, "extension status unavailable")
				return
			}
			time.Sleep(3 * time.Second)
			continue
		}
		errorsInRow = 0
		var state struct {
			Status string `json:"status"`
			Video  struct {
				URL      string  `json:"url"`
				Duration float64 `json:"duration"`
			} `json:"video"`
		}
		_ = json.Unmarshal(data, &state)
		switch strings.ToLower(strings.TrimSpace(state.Status)) {
		case "done", "completed", "succeeded":
			if state.Video.URL == "" {
				studioRefundExtension(job, "extension returned no video")
				return
			}
			result, _ := json.Marshal(map[string]interface{}{
				"video_url": state.Video.URL, "duration": state.Video.Duration,
				"credits_used": studioExtensionCredits(job),
			})
			if user, userErr := dbConn.GetUserByID(job.UserID); userErr == nil {
				result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "video_generate"}, user, result)
			}
			_ = dbConn.UpdateVideoJob(job.ID, "completed", result, "")
			indexCompletedVideo(job, result)
			return
		case "failed", "expired", "cancelled", "canceled":
			studioRefundExtension(job, "video extension failed")
			return
		}
		time.Sleep(3 * time.Second)
	}
	studioRefundExtension(job, "video extension timed out")
}
