package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	studioBackgroundCredits  = 1.0
	studioExtendInputPerSec  = 0.012
	studioExtendOutputPerSec = 0.084
	studioUpscaleBaseUSD     = 0.10
	studioUpscaleOutputMPUSD = 0.012
	studioAudioSearchLimit   = 24
	studioMusicCredits       = 80.0
)

var studioHTTPClient = &http.Client{Timeout: 4 * time.Minute}

const studioUpscaleMaxOutputBytes = 256 << 20

type studioUpscaleUpload struct {
	filename string
	expires  time.Time
}

var studioUpscaleUploads sync.Map
var studioUpscaleWorkerMu sync.Mutex

func initStudioUpscaleUploadServer() {
	address := strings.TrimSpace(getEnv("STUDIO_UPSCALE_UPLOAD_ADDR", "127.0.0.1:18191"))
	if address == "" {
		return
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/upload/", handleStudioUpscaleOutputTransfer)
	server := &http.Server{Addr: address, Handler: mux, ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 50 * time.Minute, WriteTimeout: 10 * time.Minute}
	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("studio upscale output receiver failed: %v", err)
		}
	}()
	log.Printf("Studio upscale output receiver listening on %s", address)
}

func registerStudioUpscaleUploadToken(token string) (string, string, func(), error) {
	token = strings.TrimSpace(token)
	if token == "" || strings.ContainsAny(token, "/\\") {
		return "", "", nil, fmt.Errorf("invalid upscale upload token")
	}
	directory := getEnv("STUDIO_UPSCALE_OUTPUT_DIR", filepath.Join(os.TempDir(), "manifoldgen-upscale-outputs"))
	if err := os.MkdirAll(directory, 0700); err != nil {
		return "", "", nil, err
	}
	filename := filepath.Join(directory, token+".mp4")
	studioUpscaleUploads.Store(token, &studioUpscaleUpload{filename: filename, expires: time.Now().Add(50 * time.Minute)})
	base := strings.TrimRight(getEnv("STUDIO_UPSCALE_UPLOAD_URL", "http://127.0.0.1:18191"), "/")
	cleanup := func() {
		studioUpscaleUploads.Delete(token)
		_ = os.Remove(filename)
		_ = os.Remove(filename + ".partial")
	}
	return token, base + "/upload/" + token, cleanup, nil
}

func registerStudioUpscaleUpload() (string, string, func(), error) {
	return registerStudioUpscaleUploadToken(strings.ReplaceAll(newUUID(), "-", ""))
}

func studioUpscaleUploadForRequest(requestPath string) (*studioUpscaleUpload, bool) {
	relative := strings.Trim(strings.TrimPrefix(requestPath, "/upload/"), "/")
	token := strings.SplitN(relative, "/", 2)[0]
	if token == "" {
		return nil, false
	}
	value, ok := studioUpscaleUploads.Load(token)
	if !ok {
		return nil, false
	}
	upload, ok := value.(*studioUpscaleUpload)
	if !ok || time.Now().After(upload.expires) {
		studioUpscaleUploads.Delete(token)
		return nil, false
	}
	return upload, true
}

func handleStudioUpscaleOutputTransfer(w http.ResponseWriter, r *http.Request) {
	upload, ok := studioUpscaleUploadForRequest(r.URL.Path)
	if !ok {
		http.NotFound(w, r)
		return
	}
	switch r.Method {
	case http.MethodPut:
		r.Body = http.MaxBytesReader(w, r.Body, studioUpscaleMaxOutputBytes+1)
		partial := upload.filename + ".partial"
		out, err := os.OpenFile(partial, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0600)
		if err != nil {
			http.Error(w, "output unavailable", http.StatusInternalServerError)
			return
		}
		var written int64
		found := false
		mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if strings.HasPrefix(mediaType, "multipart/") {
			reader, multipartErr := r.MultipartReader()
			if multipartErr != nil {
				err = multipartErr
			} else {
				for {
					part, partErr := reader.NextPart()
					if partErr == io.EOF {
						break
					}
					if partErr != nil {
						err = partErr
						break
					}
					if part.FormName() == "file" || part.FileName() != "" {
						found = true
						written, err = io.Copy(out, io.LimitReader(part, studioUpscaleMaxOutputBytes+1))
					}
					_ = part.Close()
					if err != nil || found {
						break
					}
				}
			}
		} else {
			found = true
			written, err = io.Copy(out, io.LimitReader(r.Body, studioUpscaleMaxOutputBytes+1))
		}
		closeErr := out.Close()
		if err != nil || closeErr != nil || !found || written < 1 || written > studioUpscaleMaxOutputBytes {
			_ = os.Remove(partial)
			http.Error(w, "invalid output file", http.StatusBadRequest)
			return
		}
		if err := os.Rename(partial, upload.filename); err != nil {
			_ = os.Remove(partial)
			http.Error(w, "could not save output", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	case http.MethodGet:
		if _, err := os.Stat(upload.filename); err != nil {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "video/mp4")
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, upload.filename)
	default:
		w.Header().Set("Allow", "PUT, GET")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

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
		"kind": "audio", "results": clean, "count": len(clean),
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

func studioMP4URL(raw string) error {
	if err := studioPublicMediaURL(raw); err != nil {
		return err
	}
	parsed, _ := url.Parse(strings.TrimSpace(raw))
	if !strings.EqualFold(path.Ext(parsed.Path), ".mp4") {
		return fmt.Errorf("Grok extension requires an MP4 source")
	}
	return nil
}

func studioExtensionPriceUSD(inputSeconds float64, outputSeconds int) float64 {
	return math.Ceil((inputSeconds*studioExtendInputPerSec+float64(outputSeconds)*studioExtendOutputPerSec)*100-1e-9) / 100
}

func studioUpscalePriceUSD(width, height int, duration float64, scale int) float64 {
	outputMegapixels := float64(width*height*scale*scale) / 1_000_000
	return math.Ceil((studioUpscaleBaseUSD+outputMegapixels*duration*studioUpscaleOutputMPUSD)*100-1e-9) / 100
}

func studioRemoteVideoURL(raw string) error {
	if err := studioPublicMediaURL(raw); err != nil {
		return err
	}
	parsed, _ := url.Parse(strings.TrimSpace(raw))
	if parsed.Scheme != "https" {
		return fmt.Errorf("video URL must use https")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".local") {
		return fmt.Errorf("video URL must be public")
	}
	if ip := net.ParseIP(host); ip != nil && (ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() || ip.IsLinkLocalUnicast()) {
		return fmt.Errorf("video URL must be public")
	}
	return nil
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
			// Fal's music endpoint returns {"audio_file":{"url":"…"}}.
			// Keep this list explicit so an arbitrary string in a provider response
			// can never be mistaken for a media URL.
			for _, key := range []string{"image_url", "audio_file", "video", "url", "data_url", "image", "result", "output"} {
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

const studioMusicEndpoint = "https://fal.run/CassetteAI/music-generator"
const studioMusicMinDuration = 30

func studioFalMusic(prompt string, duration int) (string, error) {
	if falAPIKey == "" {
		return "", fmt.Errorf("music generation is not configured")
	}
	body, _ := json.Marshal(map[string]interface{}{"prompt": prompt, "duration": duration})
	req, err := http.NewRequest(http.MethodPost, studioMusicEndpoint, bytes.NewReader(body))
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
	result, err := io.ReadAll(io.LimitReader(resp.Body, 4<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("music generator returned %d", resp.StatusCode)
	}
	if url := studioMediaURL(result); url != "" {
		return url, nil
	}
	return "", fmt.Errorf("music generator returned no audio")
}

func handleStudioGenerateMusic(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	var input struct {
		Prompt   string `json:"prompt"`
		Duration int    `json:"duration"`
	}
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid json")
		return
	}
	handleMusicGeneration(ctx, user, input.Prompt, input.Duration)
}

func normalizeMusicGenerationInput(prompt string, duration int) (string, int, error) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return "", 0, fmt.Errorf("a music prompt is required")
	}
	if duration == 0 {
		duration = studioMusicMinDuration
	}
	if duration < studioMusicMinDuration || duration > 180 {
		return "", 0, fmt.Errorf("music duration must be 30–180 seconds")
	}
	return prompt, duration, nil
}

func handleMusicGeneration(ctx *fasthttp.RequestCtx, user *User, prompt string, duration int) {
	prompt, duration, err := normalizeMusicGenerationInput(prompt, duration)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	balance := user.Credits
	creditsUsed := studioMusicCredits
	if user.UnlimitedAPI {
		creditsUsed = 0
	} else {
		balance, err = dbConn.DeductUserCredits(user.ID, studioMusicCredits)
		if err != nil {
			jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: music generation costs 80 credits")
			return
		}
	}
	audioURL, err := studioFalMusic(prompt, duration)
	if err != nil {
		log.Printf("studio music generation failed: %v", err)
		if creditsUsed > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, creditsUsed)
		}
		jsonError(ctx, http.StatusBadGateway, "music generation is temporarily unavailable")
		return
	}
	if creditsUsed > 0 {
		price := getCUTEPriceUSD()
		_ = dbConn.CreateBillingEvent(&BillingEvent{UserID: user.ID, EventType: "music_generation", Amount: -creditsUsed, CuteAmount: creditsUsed, USDAmount: creditsUsed * price, Description: "music generation", CreditsAfter: balance})
		maybeTriggerAutoTopup(user.ID)
	}
	asset := &GeneratedAudio{
		ID: newUUID(), UserID: user.ID, Kind: "music", Prompt: prompt,
		Title: studioAudioTitle(prompt), AudioURL: audioURL, DurationSeconds: duration,
		Public: true, CreatedAt: time.Now(),
	}
	indexed := true
	if err := dbConn.InsertGeneratedAudio(asset); err != nil {
		indexed = false
		log.Printf("studio music persistence failed for user %s: %v", user.ID, err)
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"service": "audio", "audio_id": asset.ID, "audio_url": audioURL, "kind": asset.Kind,
		"prompt": asset.Prompt, "title": asset.Title, "duration_seconds": asset.DurationSeconds,
		"indexed": indexed, "credits_used": creditsUsed, "credits_remain": balance,
		"cost_usd": creditsUsed * getCUTEPriceUSD(),
	})
}

func studioAudioTitle(prompt string) string {
	runes := []rune(strings.TrimSpace(prompt))
	if len(runes) <= 72 {
		return string(runes)
	}
	return strings.TrimSpace(string(runes[:69])) + "…"
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

func studioXAIUserError(body []byte, status int) string {
	if status == http.StatusForbidden {
		var providerError struct {
			Code  string `json:"code"`
			Error string `json:"error"`
		}
		if json.Unmarshal(body, &providerError) == nil && providerError.Code == "permission-denied" &&
			(strings.Contains(strings.ToLower(providerError.Error), "credits") || strings.Contains(strings.ToLower(providerError.Error), "spending limit")) {
			return "Grok video extension is unavailable because the provider spending limit has been reached"
		}
	}
	return "video extension is temporarily unavailable"
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
	if studioMP4URL(input.VideoURL) != nil || input.Prompt == "" || len(input.Prompt) > 4000 {
		jsonError(ctx, http.StatusBadRequest, "a public MP4 URL and continuation prompt are required")
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
	response, providerStatus, callErr := studioXAIRequest(http.MethodPost, "/v1/videos/extensions", requestBody)
	if callErr != nil {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		log.Printf("studio Grok extension submit failed: status=%d error=%v response=%s", providerStatus, callErr, tailOutput(response))
		jsonError(ctx, http.StatusBadGateway, studioXAIUserError(response, providerStatus))
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

type studioUpscaleInput struct {
	VideoURL string  `json:"video_url"`
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	Duration float64 `json:"duration"`
	Scale    int     `json:"scale"`
}

func validateStudioUpscaleInput(input studioUpscaleInput) error {
	if err := studioRemoteVideoURL(input.VideoURL); err != nil {
		return err
	}
	if input.Scale != 2 && input.Scale != 4 {
		return fmt.Errorf("scale must be 2 or 4")
	}
	if input.Width < 16 || input.Height < 16 || input.Width > 4096 || input.Height > 4096 {
		return fmt.Errorf("source dimensions must be between 16 and 4096 pixels")
	}
	if input.Width*input.Scale > 8192 || input.Height*input.Scale > 8192 {
		return fmt.Errorf("upscaled video would exceed 8192 pixels on one side")
	}
	if input.Duration < 0.1 || input.Duration > 60.1 {
		return fmt.Errorf("video duration must be between 0.1 and 60 seconds")
	}
	return nil
}

func handleStudioUpscaleVideo(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	var input studioUpscaleInput
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	input.VideoURL = strings.TrimSpace(input.VideoURL)
	if err := validateStudioUpscaleInput(input); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	priceUSD := studioUpscalePriceUSD(input.Width, input.Height, input.Duration, input.Scale)
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
	job, err := dbConn.CreateVideoJobForService(user.ID, "local:sync", "studio_upscale", fmt.Sprintf("Real-ESRGAN %dx upscale", input.Scale))
	if err != nil {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		jsonError(ctx, http.StatusInternalServerError, "could not save upscale job")
		return
	}
	initial, _ := json.Marshal(map[string]interface{}{
		"video_url": input.VideoURL, "width": input.Width, "height": input.Height,
		"duration": input.Duration, "scale": input.Scale, "credits_used": credits, "charged_usd": priceUSD,
	})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", initial, ""); err != nil {
		_, _ = dbConn.AddUserCredits(user.ID, credits)
		jsonError(ctx, http.StatusInternalServerError, "could not queue upscale job")
		return
	}
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: "video_upscale", Amount: -credits, CuteAmount: credits,
		USDAmount: priceUSD, Description: fmt.Sprintf("Studio Real-ESRGAN %dx video upscale", input.Scale), CreditsAfter: balance,
	})
	launchVideoJob(job.ID)
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
		"credits_used": credits, "credits_remain": balance, "price_usd": priceUSD,
	})
}

func studioUpscaleEndpoint() string {
	return strings.TrimRight(strings.TrimSpace(getEnv("STUDIO_UPSCALE_URL", "http://127.0.0.1:18090")), "/")
}

func studioUpscaleOutputURL(output interface{}, endpoint string) string {
	result := extractLocalH3OutputURL(output)
	parsed, err := url.Parse(result)
	base, baseErr := url.Parse(endpoint)
	if err == nil && baseErr == nil && parsed.Hostname() != "" && (parsed.Hostname() == "localhost" || parsed.Hostname() == "127.0.0.1") && (parsed.Port() == "" || parsed.Port() == "5000") {
		parsed.Scheme = base.Scheme
		parsed.Host = base.Host
		return parsed.String()
	}
	return result
}

func studioUpscaleCredits(job *VideoJob) float64 {
	var initial struct {
		CreditsUsed float64 `json:"credits_used"`
	}
	_ = json.Unmarshal(job.Result, &initial)
	return initial.CreditsUsed
}

func studioRefundUpscale(job *VideoJob, reason string) {
	credits := studioUpscaleCredits(job)
	if credits > 0 {
		balance, err := dbConn.AddUserCredits(job.UserID, credits)
		if err == nil {
			_ = dbConn.CreateBillingEvent(&BillingEvent{
				UserID: job.UserID, EventType: "refund", Amount: credits, CuteAmount: credits,
				USDAmount: credits * getCUTEPriceUSD(), Description: "Refund: video upscale failed", CreditsAfter: balance,
			})
		}
	}
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, reason)
}

func processStudioUpscaleJob(job *VideoJob) {
	studioUpscaleWorkerMu.Lock()
	defer studioUpscaleWorkerMu.Unlock()
	endpoint := studioUpscaleEndpoint()
	if endpoint == "" {
		studioRefundUpscale(job, "video upscaler is not configured")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	var stored struct {
		VideoURL string  `json:"video_url"`
		Width    int     `json:"width"`
		Height   int     `json:"height"`
		Duration float64 `json:"duration"`
		Scale    int     `json:"scale"`
	}
	if json.Unmarshal(job.Result, &stored) != nil {
		studioRefundUpscale(job, "upscale input is unavailable")
		return
	}
	input := studioUpscaleInput{VideoURL: stored.VideoURL, Width: stored.Width, Height: stored.Height, Duration: stored.Duration, Scale: stored.Scale}
	if err := validateStudioUpscaleInput(input); err != nil {
		studioRefundUpscale(job, "invalid upscale input: "+err.Error())
		return
	}
	_, _, cleanupOutput, registerErr := registerStudioUpscaleUploadToken(getEnv("STUDIO_UPSCALE_UPLOAD_TOKEN", "worker"))
	if registerErr != nil {
		studioRefundUpscale(job, "could not prepare upscale output")
		return
	}
	defer cleanupOutput()
	payload, _ := json.Marshal(map[string]interface{}{"input": map[string]interface{}{
		"video": input.VideoURL, "scale": input.Scale, "model": "general", "face_enhance": false, "preserve_audio": true,
	}})
	req, err := http.NewRequest(http.MethodPost, endpoint+"/predictions", bytes.NewReader(payload))
	if err != nil {
		studioRefundUpscale(job, "could not prepare upscale")
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if secret := strings.TrimSpace(os.Getenv("STUDIO_UPSCALE_SECRET")); secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}
	client := &http.Client{Timeout: 45 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		studioRefundUpscale(job, "video upscale service unavailable")
		return
	}
	data, readErr := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	resp.Body.Close()
	if readErr != nil || resp.StatusCode >= 300 {
		studioRefundUpscale(job, "video upscale failed")
		return
	}
	var prediction struct {
		Status      string      `json:"status"`
		Output      interface{} `json:"output"`
		Error       string      `json:"error"`
		PredictTime float64     `json:"predict_time"`
		Metrics     struct {
			PredictTime float64 `json:"predict_time"`
		} `json:"metrics"`
	}
	if json.Unmarshal(data, &prediction) != nil {
		studioRefundUpscale(job, "video upscaler returned an invalid response")
		return
	}
	if status := strings.ToLower(strings.TrimSpace(prediction.Status)); status == "failed" || status == "canceled" || status == "cancelled" {
		studioRefundUpscale(job, "video upscale failed: "+strings.TrimSpace(prediction.Error))
		return
	}
	outputURL := studioUpscaleOutputURL(prediction.Output, endpoint)
	if outputURL == "" {
		studioRefundUpscale(job, "video upscaler returned no video")
		return
	}
	predictTime := prediction.PredictTime
	if predictTime == 0 {
		predictTime = prediction.Metrics.PredictTime
	}
	resultMap := map[string]interface{}{
		"video_url": outputURL, "source_video_url": input.VideoURL, "scale": input.Scale,
		"source_width": input.Width, "source_height": input.Height, "duration": input.Duration,
		"width": input.Width * input.Scale, "height": input.Height * input.Scale,
		"credits_used": studioUpscaleCredits(job), "predict_seconds": predictTime,
	}
	result, _ := json.Marshal(resultMap)
	if user, userErr := dbConn.GetUserByID(job.UserID); userErr == nil {
		result = optimizeGeneratedVideo(ServiceUsageRequest{Service: "studio_upscale"}, user, result)
	}
	var durable map[string]interface{}
	_ = json.Unmarshal(result, &durable)
	if warning, _ := durable["optimization_warning"].(string); warning != "" {
		studioRefundUpscale(job, "could not publish upscaled video")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "completed", result, "")
}
