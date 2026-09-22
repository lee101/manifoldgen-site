package main

import (
	"fmt"
	"os"
	"strings"
)

// The public music model is the Manifold Music Generator. When
// YUE_RUNPOD_ENDPOINT_ID is set it is served by the yue-cog RunPod worker
// (style + lyrics in, 48 kHz stereo out); otherwise the legacy Music3 worker.
const musicPublicModelName = "Manifold Music Generator"

const (
	musicYueTokensPerSecond = 25
	musicYueMinTokens       = 200
	musicYueMaxTokens       = 9000
	musicYueDefaultGPUUSD   = 1.10
	musicYueFormat          = "mp3"
	musicYueContentType     = "audio/mpeg"
)

func musicYueEndpointID() string {
	return strings.TrimSpace(os.Getenv("YUE_RUNPOD_ENDPOINT_ID"))
}

func musicBackendIsYue() bool {
	return musicYueEndpointID() != ""
}

func musicYueSemanticTokens(duration int) int {
	tokens := duration * musicYueTokensPerSecond
	if tokens < musicYueMinTokens {
		tokens = musicYueMinTokens
	}
	if tokens > musicYueMaxTokens {
		tokens = musicYueMaxTokens
	}
	return tokens
}

func musicYueSeed(seed int64) int {
	if seed < 0 {
		seed = -seed
	}
	return int(seed % 2147483647)
}

func musicYueLyrics(lyrics string) string {
	if structured := music3StructureLyrics(lyrics); structured != "" {
		return structured
	}
	return "[Instrumental]"
}

func musicYueStyle(prompt, lyrics string) string {
	style := strings.TrimSpace(prompt)
	if strings.TrimSpace(lyrics) == "" && !strings.Contains(strings.ToLower(style), "instrumental") {
		style = "Instrumental, no vocals. " + style
	}
	if len(style) > 2000 {
		style = style[:2000]
	}
	return style
}

func musicYueInput(prompt, lyrics string, duration int, seed int64, uploadURL, publicURL string) map[string]interface{} {
	return map[string]interface{}{
		"style":               musicYueStyle(prompt, lyrics),
		"lyrics":              musicYueLyrics(lyrics),
		"seed":                musicYueSeed(seed),
		"semantic_max_tokens": musicYueSemanticTokens(duration),
		"format":              musicYueFormat,
		"cot":                 "full",
		"output_upload": map[string]string{
			"put_url": uploadURL, "audio_url": publicURL, "content_type": musicYueContentType,
		},
	}
}

func musicUploadObjectKey(userID string) string {
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	if musicBackendIsYue() {
		return fmt.Sprintf("%s/%s/audio/%s-manifold-music.%s", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), musicYueFormat)
	}
	return fmt.Sprintf("%s/%s/audio/%s-minimax-music3.wav", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID())
}

func musicUploadContentType() string {
	if musicBackendIsYue() {
		return musicYueContentType
	}
	return "audio/wav"
}
