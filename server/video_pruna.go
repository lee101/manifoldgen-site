package main

import (
	"fmt"
	"strings"
)

// Pruna P-Video / P-Video-Edit route through OpenPaths (Runpod public
// endpoints). Same slim 10% markup as Kling 4 over the Runpod rate.
const prunaVideoPriceMultiplier = 1.10

const (
	prunaMinSeconds     = 1
	prunaMaxSeconds     = 10
	prunaEditMaxSeconds = 15
)

var prunaVideoModels = map[string]bool{
	"p-video":      true,
	"p-video-edit": true,
}

func isPrunaVideoModel(model string) bool {
	return prunaVideoModels[normalizeVideoModel(model)]
}

func prunaDuration(model string, seconds int) int {
	max := prunaMaxSeconds
	if normalizeVideoModel(model) == "p-video-edit" {
		max = prunaEditMaxSeconds
	}
	if seconds <= 0 {
		return 5
	}
	if seconds < prunaMinSeconds {
		return prunaMinSeconds
	}
	if seconds > max {
		return max
	}
	return seconds
}

func prunaResolution(resolution string) string {
	if strings.ToLower(strings.TrimSpace(resolution)) == "1080p" {
		return "1080p"
	}
	return "720p"
}

// prunaPerSecondUSD is the Runpod list rate: P-Video $0.02/s at 720p and
// $0.04/s at 1080p; P-Video-Edit $0.045/s flat.
func prunaPerSecondUSD(model, resolution string) float64 {
	if normalizeVideoModel(model) == "p-video-edit" {
		return 0.045
	}
	if prunaResolution(resolution) == "1080p" {
		return 0.04
	}
	return 0.02
}

func prunaPriceUSD(req ServiceUsageRequest) float64 {
	return prunaPerSecondUSD(req.Model, req.Resolution) * float64(prunaDuration(req.Model, req.Duration)) * prunaVideoPriceMultiplier
}

func validatePrunaRequest(model string, req ServiceUsageRequest) error {
	if r := strings.ToLower(strings.TrimSpace(req.Resolution)); r != "" && r != "720p" && r != "1080p" {
		return fmt.Errorf("%s resolution must be 720p or 1080p", model)
	}
	if model == "p-video-edit" && strings.TrimSpace(req.VideoURL) == "" {
		return fmt.Errorf("%s requires video_url", model)
	}
	if len(req.ReferenceImageURLs) > 4 || len(req.ReferenceVideoURLs) > 4 || len(req.ReferenceAudioURLs) > 4 {
		return fmt.Errorf("%s accepts at most 4 reference URLs per type", model)
	}
	urls := append([]string{req.ImageURL, req.VideoURL, req.LastFrame}, req.ReferenceImageURLs...)
	urls = append(append(urls, req.ReferenceVideoURLs...), req.ReferenceAudioURLs...)
	for _, candidate := range urls {
		if strings.TrimSpace(candidate) == "" {
			continue
		}
		if err := assertPublicFetchURL(candidate); err != nil {
			return fmt.Errorf("media URL: %w", err)
		}
	}
	return nil
}
