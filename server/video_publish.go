package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const finalVideoEncodeTimeout = 10 * time.Minute

// encodeAV1WebM writes a small AV1 + Opus WebM. NVENC is tried first; the
// measured lp=8, preset-10 SVT-AV1 fallback stays under 2 GiB at 2K while
// remaining faster than realtime on many-core hosts.
func encodeAV1WebM(ctx context.Context, inputPath, outputPath string) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("ffmpeg is not available")
	}
	encodeArgs := []string{"-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a?", "-c:v", "av1_nvenc", "-preset", "p5", "-tune", "hq", "-rc", "vbr", "-cq", "38", "-b:v", "0", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", outputPath}
	output, err := exec.CommandContext(ctx, "ffmpeg", encodeArgs...).CombinedOutput()
	if err == nil {
		return nil
	}
	fallback := []string{"-y", "-i", inputPath, "-map", "0:v:0", "-map", "0:a?", "-c:v", "libsvtav1", "-crf", "38", "-preset", "10", "-svtav1-params", "lp=8", "-pix_fmt", "yuv420p", "-c:a", "libopus", "-b:a", "96k", outputPath}
	if fallbackOut, fallbackErr := exec.CommandContext(ctx, "ffmpeg", fallback...).CombinedOutput(); fallbackErr != nil {
		return fmt.Errorf("AV1 encode failed: %s; fallback: %s", tailOutput(output), tailOutput(fallbackOut))
	}
	return nil
}

// publishFinalVideo stores a finished job video as compact AV1 WebM. Users who
// want MP4 convert locally in the browser, so the bucket never holds the large
// H.264 master. If encoding or upload fails, fallback publishes the MP4 so a
// completed job is never lost.
func publishFinalVideo(ctx context.Context, mp4Path, userID string, fallback func() (string, error)) (string, error) {
	encodeCtx, cancel := context.WithTimeout(ctx, finalVideoEncodeTimeout)
	defer cancel()
	dir, err := os.MkdirTemp("", "manifoldgen-final-av1-*")
	if err == nil {
		defer os.RemoveAll(dir)
		webm := filepath.Join(dir, "final.webm")
		if err = encodeAV1WebM(encodeCtx, mp4Path, webm); err == nil {
			var info os.FileInfo
			if info, err = os.Stat(webm); err == nil && info.Size() > 0 {
				var publicURL string
				if publicURL, err = uploadAV1ToR2(ctx, webm, userID); err == nil {
					return publicURL, nil
				}
			}
		}
	}
	log.Printf("final video AV1 publish failed for user=%s, publishing MP4: %v", userID, err)
	return fallback()
}

func finalVideoFormat(videoURL string) string {
	if strings.HasSuffix(strings.ToLower(strings.SplitN(videoURL, "?", 2)[0]), ".webm") {
		return "webm/av1+opus"
	}
	return "mp4/h264+aac"
}
