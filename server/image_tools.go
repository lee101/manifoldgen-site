package main

// Model-level image tools: an OpenPaths passthrough that exposes the premium
// image model catalog (GPT Image 2, Nano Banana 2, Grok Imagine, FLUX.2) plus
// FAL-backed relight (IC-Light v2) and creative upscale. Every route here is
// metered per image at the configured rate and refunded when the provider
// fails, exactly like the existing gpt_image / image_edit services.

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type imageModelSpec struct {
	upstream   string  // OpenPaths model id sent upstream
	usd        float64 // public price per image
	edit       bool    // supports reference-based edits through /v1/images/edits
	useAspect  bool    // prefers aspect_ratio over WxH size
	aspects    map[string]string
	resolution bool // supports resolution tiers (grok 1k/2k)
}

var imageAspectPresets = map[string]string{
	"square": "1:1", "1:1": "1:1",
	"portrait": "9:16", "9:16": "9:16", "3:4": "3:4", "4:3": "4:3",
	"landscape": "16:9", "16:9": "16:9", "21:9": "21:9",
}

// Public prices track the OpenPaths cost table with the same markup convention
// as servicePricesUSD["gpt_image"] ($0.211 upstream -> $0.24 public).
var allowedImageModels = map[string]imageModelSpec{
	"gpt-image-2":   {upstream: "gpt-image-2", usd: 0.24, edit: true},
	"nano-banana-2": {upstream: "or/gemini-3.1-flash-image", usd: 0.16, edit: true, useAspect: true, aspects: imageAspectPresets, resolution: true},
	"grok-imagine":  {upstream: "grok-imagine-image", usd: 0.04, edit: true, useAspect: true, aspects: imageAspectPresets, resolution: true},
	"flux-2-klein":  {upstream: "klein", usd: 0.03, useAspect: false},
	"flux-2-dev":    {upstream: "flux-dev", usd: 0.04, useAspect: false},
	"flux-pro":      {upstream: "flux-pro", usd: 0.06, useAspect: false},
}

func normalizeImageModel(model string) string {
	return strings.TrimSpace(model)
}

const grokTwoKExtraUSD = 0.05

// imageModelPriceUSD is the per-request charge for openpaths_image.
func imageModelPriceUSD(req ServiceUsageRequest) float64 {
	spec, ok := allowedImageModels[normalizeImageModel(req.Model)]
	if !ok {
		return 0
	}
	price := spec.usd
	if spec.resolution && strings.EqualFold(strings.TrimSpace(req.Resolution), "2k") {
		price += grokTwoKExtraUSD
	}
	return price * float64(getImageCount(req))
}

// proxyOpenPathsModelImage forwards one premium-model image request to
// OpenPaths. Requests carrying an image_url for edit-capable models go to
// /v1/images/edits; everything else lands on /v1/images/generations.
func proxyOpenPathsModelImage(req ServiceUsageRequest) ([]byte, error) {
	model := normalizeImageModel(req.Model)
	spec, ok := allowedImageModels[model]
	if !ok {
		return nil, fmt.Errorf("unsupported image model %q", model)
	}
	if strings.TrimSpace(openPathsAPIKey) == "" {
		return nil, fmt.Errorf("model image generation requires OPENPATHS_API_KEY")
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		return nil, fmt.Errorf("image prompt is required")
	}

	payload := map[string]interface{}{
		"model":  spec.upstream,
		"prompt": prompt,
		"n":      clampImageCount(getImageCount(req)),
	}
	if seed := req.Seed; seed != 0 {
		payload["seed"] = seed
	}
	if spec.resolution {
		switch strings.ToLower(strings.TrimSpace(req.Resolution)) {
		case "2k":
			payload["resolution"] = "2k"
		default:
			payload["resolution"] = "1k"
		}
	}
	if spec.useAspect {
		if aspect, ok := spec.aspects[strings.ToLower(strings.TrimSpace(firstNonEmpty(req.AspectRatio, sizeToAspect(req.Width, req.Height))))]; ok {
			payload["aspect_ratio"] = aspect
		}
	} else if req.Width > 0 && req.Height > 0 {
		payload["size"] = fmt.Sprintf("%dx%d", req.Width, req.Height)
	} else {
		payload["size"] = "1024x1024"
	}

	endpoint := openPathsBaseURL + "/v1/images/generations"
	if imageURL := strings.TrimSpace(req.ImageURL); imageURL != "" {
		if !spec.edit {
			return nil, fmt.Errorf("model %q does not support reference edits", model)
		}
		if err := validateHTTPURL(imageURL); err != nil {
			return nil, err
		}
		payload["image_url"] = imageURL
		payload["images"] = []map[string]string{{"url": imageURL}}
		referenceImageURLs := sanitizedReferenceURLs(req.ReferenceImageURLs, imageURL)
		if len(referenceImageURLs) > 0 {
			payload["reference_image_urls"] = referenceImageURLs
		}
		endpoint = openPathsBaseURL + "/v1/images/edits"
	}

	result, err := callOpenPathsImageEdit(endpoint, mustJSON(payload))
	if err != nil {
		return nil, err
	}
	return withImageEngine(result, model, req)
}

// proxyOpenPathsExtendImage expands an image beyond its original borders via
// the OpenPaths extend-image outpaint route. Expansion sides are fractions of
// the source dimensions (0..1).
func proxyOpenPathsExtendImage(req ServiceUsageRequest) ([]byte, error) {
	if strings.TrimSpace(openPathsAPIKey) == "" {
		return nil, fmt.Errorf("image extension requires OPENPATHS_API_KEY")
	}
	imageURL := strings.TrimSpace(req.ImageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("image_url is required for extend-image")
	}
	if err := validateHTTPURL(imageURL); err != nil {
		return nil, err
	}
	expansion := expandFields(req)
	if expansion == nil && req.ZoomOut <= 0 {
		return nil, fmt.Errorf("set at least one expand side or zoom_out_percentage")
	}
	prompt := strings.TrimSpace(req.Prompt)
	if prompt == "" {
		// The fal outpaint schema requires a prompt even when only expanding.
		prompt = "seamlessly extend the scene beyond its original borders"
	}
	payload := map[string]interface{}{
		"model":     "extend-image",
		"prompt":    prompt,
		"image_url": imageURL,
		"n":         1,
	}
	for key, value := range expansion {
		payload[key] = value
	}
	if req.ZoomOut > 0 {
		if req.ZoomOut == float64(int(req.ZoomOut)) {
			payload["zoom_out_percentage"] = int(req.ZoomOut)
		} else {
			payload["zoom_out_percentage"] = req.ZoomOut
		}
	}
	result, err := callOpenPathsImageEdit(openPathsBaseURL+"/v1/images/edits", mustJSON(payload))
	if err != nil {
		return nil, err
	}
	return withImageEngine(result, "extend-image", req)
}

// proxyFalRelight relights a photo with fal IC-Light v2. Kind selects the
// lighting direction ("left"/"right"/"top"/"bottom"); parameters follow the
// production-tuned values netwrck uses for the same endpoint.
func proxyFalRelight(req ServiceUsageRequest) ([]byte, error) {
	if strings.TrimSpace(falAPIKey) == "" {
		return nil, fmt.Errorf("relight requires FAL_KEY")
	}
	imageURL := strings.TrimSpace(req.ImageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("image_url is required for relight")
	}
	if err := validateHTTPURL(imageURL); err != nil {
		return nil, err
	}
	direction := "None"
	switch kind := strings.ToLower(strings.TrimSpace(req.Kind)); kind {
	case "left", "right", "top", "bottom":
		direction = strings.ToUpper(kind[:1]) + kind[1:]
	}
	payload := map[string]interface{}{
		"prompt":                strings.TrimSpace(req.Prompt),
		"image_url":             imageURL,
		"negative_prompt":       req.NegativePrompt,
		"initial_latent":        direction,
		"image_size":            iclightImageSize(req.AspectRatio),
		"num_images":            clampImageCount(getImageCount(req)),
		"num_inference_steps":   28,
		"cfg":                   1,
		"guidance_scale":        5,
		"lowres_denoise":        0.98,
		"highres_denoise":       0.95,
		"hr_downscale":          0.5,
		"enable_safety_checker": true,
		"output_format":         "jpeg",
	}
	result, err := runFalQueuedJob("fal-ai/iclight-v2", payload)
	if err != nil {
		return nil, err
	}
	urls := extractPayloadImageURLs(result)
	if len(urls) == 0 {
		return nil, fmt.Errorf("relight returned no images")
	}
	normalized, _ := json.Marshal(map[string]interface{}{
		"engine": "fal-ai/iclight-v2",
		"prompt": req.Prompt,
		"data":   urlsToDataRows(urls),
	})
	return normalized, nil
}

// proxyFalUpscaleImage runs fal creative-upscaler at 2x with the same mild
// creativity netwrck uses in production.
func proxyFalUpscaleImage(req ServiceUsageRequest) ([]byte, error) {
	if strings.TrimSpace(falAPIKey) == "" {
		return nil, fmt.Errorf("image upscale requires FAL_KEY")
	}
	imageURL := strings.TrimSpace(req.ImageURL)
	if imageURL == "" {
		return nil, fmt.Errorf("image_url is required for upscale")
	}
	if err := validateHTTPURL(imageURL); err != nil {
		return nil, err
	}
	// Pinned at the same 2x / creativity 0.35 profile netwrck runs in
	// production so the flat price stays accurate.
	const scale = 2
	result, err := runFalQueuedJob("fal-ai/creative-upscaler", map[string]interface{}{
		"image_url":     imageURL,
		"scale":         int(scale),
		"creativity":    0.35,
		"output_format": "png",
	})
	if err != nil {
		return nil, err
	}
	urls := extractPayloadImageURLs(result)
	if len(urls) == 0 {
		return nil, fmt.Errorf("upscale returned no images")
	}
	normalized, _ := json.Marshal(map[string]interface{}{
		"engine": "fal-ai/creative-upscaler",
		"prompt": req.Prompt,
		"data":   urlsToDataRows(urls),
	})
	return normalized, nil
}

// runFalQueuedJob submits to the fal.ai queue and polls until completion.
// Each HTTP hop reuses callFalQueue (30s client); the overall wait is bounded
// by the deadline below, well inside the API request budget.
var falQueueBaseURL = "https://queue.fal.run"

func runFalQueuedJob(model string, payload map[string]interface{}) ([]byte, error) {
	if strings.TrimSpace(falAPIKey) == "" {
		return nil, fmt.Errorf("FAL_KEY is not configured")
	}
	submitBody, status, err := callFalQueue(http.MethodPost, falQueueBaseURL+"/"+model, payload)
	if err != nil {
		return nil, err
	}
	var queued struct {
		StatusURL   string `json:"status_url"`
		ResponseURL string `json:"response_url"`
	}
	if jsonErr := json.Unmarshal(submitBody, &queued); jsonErr != nil || queued.StatusURL == "" || queued.ResponseURL == "" {
		if status < 400 && bytes.Contains(submitBody, []byte(`"image`)) {
			return submitBody, nil
		}
		return nil, fmt.Errorf("fal queue returned no tracking URLs")
	}
	statusEndpoint := strings.TrimRight(queued.StatusURL, "/") + "?logs=0"
	deadline := time.Now().Add(150 * time.Second)
	for time.Now().Before(deadline) {
		time.Sleep(2 * time.Second)
		stateBody, _, err := callFalQueue(http.MethodGet, statusEndpoint, nil)
		if err != nil {
			return nil, err
		}
		var state struct {
			Status string `json:"status"`
			Error  string `json:"error"`
		}
		if err := json.Unmarshal(stateBody, &state); err != nil {
			return nil, fmt.Errorf("fal status returned invalid JSON")
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED", "OK":
			resultBody, _, err := callFalQueue(http.MethodGet, queued.ResponseURL, nil)
			return resultBody, err
		case "FAILED", "ERROR", "CANCELLED", "CANCELED", "TIMED_OUT":
			message := strings.TrimSpace(state.Error)
			if message == "" {
				message = "fal job failed"
			}
			return nil, fmt.Errorf("fal job failed: %s", truncateString(message, 300))
		}
	}
	return nil, fmt.Errorf("timed out waiting for fal job")
}

// withImageEngine normalizes an OpenPaths image response and stamps the
// engine/prompt/size fields the frontend expects next to result.data.
func withImageEngine(result []byte, engine string, req ServiceUsageRequest) ([]byte, error) {
	var normalized map[string]interface{}
	if err := json.Unmarshal(result, &normalized); err != nil {
		return nil, fmt.Errorf("OpenPaths returned invalid image JSON")
	}
	normalized["engine"] = engine
	normalized["prompt"] = req.Prompt
	normalized["width"] = req.Width
	normalized["height"] = req.Height
	return json.Marshal(normalized)
}

// expandFields converts the API's 0..1 side fractions into the integer
// percentages OpenPaths forwards to fal (expand_top: 25 == 25% of that side).
func expandFields(req ServiceUsageRequest) map[string]interface{} {
	fields := map[string]interface{}{}
	for _, entry := range []struct {
		key   string
		value float64
	}{
		{"expand_top", req.ExpandTop},
		{"expand_bottom", req.ExpandBottom},
		{"expand_left", req.ExpandLeft},
		{"expand_right", req.ExpandRight},
	} {
		if entry.value > 0 {
			fields[entry.key] = int(entry.value*100 + 0.5)
		}
	}
	if len(fields) == 0 {
		return nil
	}
	return fields
}

func iclightImageSize(aspect string) string {
	switch strings.ToLower(strings.TrimSpace(aspect)) {
	case "portrait", "9:16":
		return "portrait_16_9"
	case "3:4":
		return "portrait_4_3"
	case "landscape", "16:9":
		return "landscape_16_9"
	case "4:3":
		return "landscape_4_3"
	default:
		return "square_hd"
	}
}

func sizeToAspect(width, height int) string {
	if width <= 0 || height <= 0 {
		return ""
	}
	if width == height {
		return "square"
	}
	if width > height {
		return "landscape"
	}
	return "portrait"
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func validateHTTPURL(raw string) error {
	parsed, err := url.ParseRequestURI(raw)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" {
		return fmt.Errorf("image_url must be an absolute http(s) URL")
	}
	return nil
}

func sanitizedReferenceURLs(candidates []string, primary string) []string {
	out := make([]string, 0, len(candidates)+1)
	seen := map[string]bool{}
	add := func(value string) {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] || validateHTTPURL(value) != nil {
			return
		}
		seen[value] = true
		out = append(out, value)
	}
	add(primary)
	for _, candidate := range candidates {
		if len(out) >= 6 {
			break
		}
		add(candidate)
	}
	return out
}

func clampImageCount(n int) int {
	if n <= 0 {
		return 1
	}
	if n > 4 {
		return 4
	}
	return n
}

func mustJSON(payload map[string]interface{}) []byte {
	body, _ := json.Marshal(payload)
	return body
}

func urlsToDataRows(urls []string) []map[string]string {
	rows := make([]map[string]string, 0, len(urls))
	for _, one := range urls {
		rows = append(rows, map[string]string{"url": one})
	}
	return rows
}

// extractPayloadImageURLs walks any JSON payload collecting image URLs from
// data[].url, images[].url, image_url, url, and output_url style fields.
func extractPayloadImageURLs(result []byte) []string {
	var payload interface{}
	if err := json.Unmarshal(result, &payload); err != nil {
		return nil
	}
	found := []string{}
	var walk func(value interface{})
	walk = func(value interface{}) {
		switch row := value.(type) {
		case []interface{}:
			for _, item := range row {
				walk(item)
			}
		case map[string]interface{}:
			for _, key := range []string{"image_url", "url", "output_url"} {
				if text, ok := row[key].(string); ok && strings.HasPrefix(text, "http") {
					found = append(found, text)
					return
				}
			}
			for _, key := range []string{"data", "images", "image", "output", "outputs"} {
				if nested, ok := row[key]; ok {
					walk(nested)
				}
			}
		}
	}
	walk(payload)
	deduped := found[:0]
	seen := map[string]bool{}
	for _, one := range found {
		if !seen[one] {
			seen[one] = true
			deduped = append(deduped, one)
		}
	}
	return deduped
}
