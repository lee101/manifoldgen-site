package main

import (
	"fmt"
	"strings"
)

// Kling 4.0 routes through OpenPaths (fal kling/v4/*). ManifoldGen adds a slim
// 10% over the fal rate instead of the 1.20 downstream video multiplier.
const kling4VideoPriceMultiplier = 1.10

const (
	kling4MinSeconds = 3
	kling4MaxSeconds = 30
)

var kling4VideoModels = map[string]bool{
	"kling-4.0-text-to-video":      true,
	"kling-4.0-image-to-video":     true,
	"kling-4.0-reference-to-video": true,
	"kling-4.0-video-edit":         true,
}

var videoRequiredVideoModels = map[string]bool{
	"kling-4.0-video-edit": true,
}

func isKling4Model(model string) bool {
	return kling4VideoModels[normalizeVideoModel(model)]
}

func kling4Duration(seconds int) int {
	if seconds <= 0 {
		return 5
	}
	if seconds < kling4MinSeconds {
		return kling4MinSeconds
	}
	if seconds > kling4MaxSeconds {
		return kling4MaxSeconds
	}
	return seconds
}

func kling4Resolution(resolution string) string {
	if strings.ToLower(strings.TrimSpace(resolution)) == "720p" {
		return "720p"
	}
	return "1080p"
}

// kling4PerSecondUSD is the fal rate. Video references and the edit route bill
// input plus output length (minimum 2x output), so they price at 2x fal's
// per-second rate.
func kling4PerSecondUSD(model, resolution string, hasVideoRef bool) float64 {
	model = normalizeVideoModel(model)
	hasVideoRef = hasVideoRef || model == "kling-4.0-video-edit"
	is720 := kling4Resolution(resolution) == "720p"
	switch {
	case hasVideoRef && is720:
		return 0.188
	case hasVideoRef:
		return 0.282
	case is720:
		return 0.157
	default:
		return 0.235
	}
}

func kling4PriceUSD(req ServiceUsageRequest) float64 {
	hasVideoRef := len(req.ReferenceVideoURLs) > 0 || strings.TrimSpace(req.VideoURL) != ""
	return kling4PerSecondUSD(req.Model, req.Resolution, hasVideoRef) * float64(kling4Duration(req.Duration)) * kling4VideoPriceMultiplier
}

func validateKling4Request(model string, req ServiceUsageRequest) error {
	if r := strings.ToLower(strings.TrimSpace(req.Resolution)); r != "" && r != "720p" && r != "1080p" {
		return fmt.Errorf("%s resolution must be 720p or 1080p", model)
	}
	aspect := strings.TrimSpace(req.AspectRatio)
	if aspect != "" {
		ok := videoStringIn(aspect, "16:9", "9:16", "1:1", "21:9")
		if model == "kling-4.0-reference-to-video" && aspect == "auto" {
			ok = true
		}
		if !ok {
			return fmt.Errorf("%s aspect_ratio must be 16:9, 9:16, 1:1 or 21:9", model)
		}
	}
	if videoRequiredVideoModels[model] && strings.TrimSpace(req.VideoURL) == "" {
		return fmt.Errorf("%s requires video_url", model)
	}
	urls := append(append([]string{req.ImageURL, req.LastFrame, req.VideoURL}, req.ReferenceImageURLs...), req.ReferenceVideoURLs...)
	for _, candidate := range urls {
		if strings.TrimSpace(candidate) == "" {
			continue
		}
		if err := validateRestyleURL(candidate); err != nil {
			return fmt.Errorf("media URL: %w", err)
		}
	}
	if len(req.ReferenceImageURLs) > 10 || len(req.ReferenceVideoURLs) > 5 {
		return fmt.Errorf("%s accepts at most 10 reference images and 5 reference videos", model)
	}
	return nil
}
