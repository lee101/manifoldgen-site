package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"manifoldgen-site/lofiloop"
)

const (
	characterSwapLipSyncFalPath    = "fal-ai/sync-lipsync/v2"
	characterSwapLipSyncRequestKey = "fal-ai/sync-lipsync"
	characterSwapLipSyncModel      = "lipsync-2"
	characterSwapLipSyncRateUSD    = 0.05
	characterSwapLipSyncChargeUSD  = 0.10
	characterSwapLipSyncMinScore   = 45.0
	characterSwapLipSyncMinBody    = 0.45
	characterSwapLipSyncGain       = 3.0
	characterSwapLipSyncTolerance  = 3.0
)

// characterSwapLipSyncRequested reads the opt-in post pass from params:
// {"lipsync": true}. It re-times mouths to the soundtrack on close-up and
// medium clips whose lip-sync metric is weak.
func characterSwapLipSyncRequested(req ServiceUsageRequest) bool {
	if len(req.Params) == 0 || characterSwapIsExact(req) || characterSwapIsLora(req) || characterSwapIsRecast(req) {
		return false
	}
	var params map[string]interface{}
	if json.Unmarshal(req.Params, &params) != nil {
		return false
	}
	switch v := params["lipsync"].(type) {
	case bool:
		return v
	case string:
		on, _ := strconv.ParseBool(v)
		return on
	}
	return false
}

func characterSwapLipSyncThreshold() float64 {
	if v, err := strconv.ParseFloat(strings.TrimSpace(getEnv("CHARACTER_SWAP_LIPSYNC_MIN", "")), 64); err == nil && v > 0 {
		return v
	}
	return characterSwapLipSyncMinScore
}

// characterSwapLipSyncMaxFee is the most a job can be charged for the pass:
// every clip lip-synced.
func characterSwapLipSyncMaxFee(req ServiceUsageRequest, chunks []characterSwapChunk) float64 {
	if !characterSwapLipSyncRequested(req) {
		return 0
	}
	total := 0.0
	for _, chunk := range chunks {
		total += characterSwapLipSyncChargeUSD * float64(chunk.Duration)
	}
	return math.Round(total*100) / 100
}

func characterSwapLipSyncFee(seconds float64) float64 {
	return math.Round(characterSwapLipSyncChargeUSD*seconds*100) / 100
}

// characterSwapChunkAudio writes the soundtrack of one provider clip, aligned
// like its video: delayed by the frozen lead-in on shot starts.
func characterSwapChunkAudio(ctx context.Context, chunk characterSwapChunk, sourcePath, audioPath string) error {
	var args []string
	if chunk.Index == 0 || chunk.ShotStart {
		delay := int(math.Round(chunk.Lead * 1000))
		args = []string{"-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start), "-i", sourcePath, "-t", trimSeconds(chunk.Length), "-vn",
			"-af", fmt.Sprintf("adelay=%d|%d", delay, delay)}
	} else {
		args = []string{"-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start - chunk.Lead), "-i", sourcePath, "-t", trimSeconds(float64(chunk.Duration)), "-vn"}
	}
	args = append(args, "-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", audioPath)
	return lofiloop.RunFFmpeg(ctx, args...)
}

// characterSwapClipIsCloseup is true when the generated clip shows people
// large enough for a mouth re-sync to matter. Without the helper it assumes
// yes so the metric alone gates the pass.
func characterSwapClipIsCloseup(ctx context.Context, clipPath string, at float64, workDir string, index int) bool {
	framePath := filepath.Join(workDir, fmt.Sprintf("lip-frame-%02d.png", index))
	if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(at), "-i", clipPath, "-frames:v", "1", "-update", "1", framePath); err != nil {
		return true
	}
	people, ok := characterSwapShotPeople(ctx, framePath)
	if !ok {
		return true
	}
	for _, p := range people {
		if p.Face && p.Box[3]-p.Box[1] >= characterSwapLipSyncMinBody {
			return true
		}
	}
	return false
}

// characterSwapLipSyncClip lip-syncs one whole provider clip to the matching
// soundtrack with fal sync-lipsync v2 and returns the hosted result.
func characterSwapLipSyncClip(ctx context.Context, jobID, clipURL, audioURL string) (string, error) {
	input := map[string]interface{}{
		"video_url": clipURL, "audio_url": audioURL,
		"model": characterSwapLipSyncModel, "sync_mode": "cut_off",
	}
	data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+characterSwapLipSyncFalPath, input)
	if err != nil {
		return "", fmt.Errorf("lip-sync service rejected the clip")
	}
	var queued falQueueResponse
	if err := json.Unmarshal(data, &queued); err != nil || queued.RequestID == "" {
		return "", fmt.Errorf("lip-sync service returned no job")
	}
	return waitFalVideoResult(ctx, jobID, characterSwapLipSyncRequestKey, queued.RequestID, 20*time.Minute)
}

// waitFalVideoResult polls a fal queue request until its video is ready.
func waitFalVideoResult(ctx context.Context, jobID, requestKey, requestID string, timeout time.Duration) (string, error) {
	base := "https://queue.fal.run/" + requestKey + "/requests/" + url.PathEscape(requestID)
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if ctx.Err() != nil {
			return "", fmt.Errorf("timed out")
		}
		if videoJobCancellationRequested(jobID) {
			return "", fmt.Errorf("cancelled")
		}
		data, _, err := callFalQueue(http.MethodGet, base+"/status", nil)
		if err == nil {
			var status falQueueResponse
			_ = json.Unmarshal(data, &status)
			switch strings.ToLower(strings.TrimSpace(status.Status)) {
			case "completed", "succeeded":
				result, _, err := callFalQueue(http.MethodGet, base, nil)
				if err != nil {
					return "", fmt.Errorf("completed clip could not be retrieved")
				}
				var payload map[string]interface{}
				if err := json.Unmarshal(result, &payload); err != nil {
					return "", fmt.Errorf("video service returned an invalid result")
				}
				if video, ok := payload["video"].(map[string]interface{}); ok {
					if outputURL, _ := video["url"].(string); outputURL != "" {
						return outputURL, nil
					}
				}
				return "", fmt.Errorf("video service returned no clip")
			case "failed", "cancelled", "canceled":
				return "", fmt.Errorf("video generation failed")
			}
		}
		time.Sleep(3 * time.Second)
	}
	return "", fmt.Errorf("video generation did not finish in time")
}

// characterSwapMaybeLipSync runs the optional lip-sync pass on the chosen
// attempt and keeps the result only when the lip-sync metric improves without
// hurting the overall score. It returns the (possibly replaced) attempt and a
// short note.
func characterSwapMaybeLipSync(ctx context.Context, job *VideoJob, state *characterSwapState, chunk characterSwapChunk, chosen characterSwapAttempt, sourcePath, workDir string, score func(characterSwapChunk, string) (*characterSwapAttempt, bool)) (characterSwapAttempt, string) {
	if !characterSwapLipSyncRequested(state.Request) || chosen.Metrics == nil || chosen.Leaked || falAPIKey == "" {
		return chosen, ""
	}
	if chosen.Metrics.Lipsync >= characterSwapLipSyncThreshold() {
		return chosen, ""
	}
	if !characterSwapClipIsCloseup(ctx, chosen.Path, chunk.Lead+chunk.Length/2, workDir, chunk.Index) {
		return chosen, "lipsync skipped: wide shot"
	}
	audioPath := filepath.Join(workDir, fmt.Sprintf("lip-%02d.mp3", chunk.Index))
	if err := characterSwapChunkAudio(ctx, chunk, sourcePath, audioPath); err != nil {
		return chosen, ""
	}
	audioURL, err := uploadCharacterSwapFile(ctx, audioPath, job.UserID, "audio/mpeg")
	if err != nil {
		return chosen, ""
	}
	lipURL, err := characterSwapLipSyncClip(ctx, job.ID, chosen.URL, audioURL)
	if err != nil {
		return chosen, "lipsync failed: " + truncateString(err.Error(), 80)
	}
	state.Chunks[chunk.Index].LipSyncUSD += characterSwapLipSyncRateUSD * float64(chunk.Duration)
	lipPath := filepath.Join(workDir, fmt.Sprintf("out-%02d-lip.mp4", chunk.Index))
	if err := downloadURLToFile(ctx, lipURL, lipPath); err != nil {
		return chosen, "lipsync download failed"
	}
	candidate, ok := score(chunk, lipPath)
	if !ok || candidate.Metrics == nil {
		return chosen, "lipsync result could not be scored; kept original"
	}
	candidate.URL, candidate.Path = lipURL, lipPath
	gain := candidate.Metrics.Lipsync - chosen.Metrics.Lipsync
	if gain >= characterSwapLipSyncGain && candidate.Metrics.Overall >= chosen.Metrics.Overall-characterSwapLipSyncTolerance && !candidate.Leaked {
		state.Chunks[chunk.Index].LipSynced = true
		return *candidate, fmt.Sprintf("lipsync kept: %.0f -> %.0f", chosen.Metrics.Lipsync, candidate.Metrics.Lipsync)
	}
	if _, err := os.Stat(lipPath); err == nil {
		_ = os.Remove(lipPath)
	}
	return chosen, fmt.Sprintf("lipsync rejected: %.0f -> %.0f", chosen.Metrics.Lipsync, candidate.Metrics.Lipsync)
}
