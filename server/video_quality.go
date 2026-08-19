package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type generatedVideoSignal struct {
	Samples int
	MaxYAvg float64
	MaxYMax float64
}

var (
	videoYAvgPattern = regexp.MustCompile(`lavfi\.signalstats\.YAVG=([0-9.]+)`)
	videoYMaxPattern = regexp.MustCompile(`lavfi\.signalstats\.YMAX=([0-9.]+)`)
)

func parseGeneratedVideoSignal(metadata string) (generatedVideoSignal, error) {
	averages := videoYAvgPattern.FindAllStringSubmatch(metadata, -1)
	maxima := videoYMaxPattern.FindAllStringSubmatch(metadata, -1)
	if len(averages) == 0 || len(maxima) == 0 {
		return generatedVideoSignal{}, fmt.Errorf("video signal check decoded no sample frames")
	}
	signal := generatedVideoSignal{Samples: len(averages)}
	if len(maxima) < signal.Samples {
		signal.Samples = len(maxima)
	}
	for _, match := range averages {
		value, _ := strconv.ParseFloat(match[1], 64)
		if value > signal.MaxYAvg {
			signal.MaxYAvg = value
		}
	}
	for _, match := range maxima {
		value, _ := strconv.ParseFloat(match[1], 64)
		if value > signal.MaxYMax {
			signal.MaxYMax = value
		}
	}
	return signal, nil
}

func validateGeneratedVideoFile(ctx context.Context, filename string) (generatedVideoSignal, error) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return generatedVideoSignal{}, fmt.Errorf("ffmpeg is unavailable for video validation")
	}
	command := exec.CommandContext(
		ctx, "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", filename,
		"-vf", "fps=1,scale=160:-2,signalstats,metadata=print:file=-",
		"-an", "-f", "null", "-",
	)
	output, err := command.CombinedOutput()
	if err != nil {
		return generatedVideoSignal{}, fmt.Errorf("video signal decode failed: %s", tailOutput(output))
	}
	signal, err := parseGeneratedVideoSignal(string(output))
	if err != nil {
		return generatedVideoSignal{}, err
	}
	// Limited-range Y=16 is exact black. Keep dark scenes valid when even a
	// small real highlight exists, while rejecting uniform numerical collapse.
	if signal.MaxYAvg < 18 && signal.MaxYMax < 24 {
		return signal, fmt.Errorf(
			"video contains only near-black frames (max_yavg=%.3f max_ymax=%.3f)",
			signal.MaxYAvg, signal.MaxYMax,
		)
	}
	return signal, nil
}

func validateH3VideoArtifact(ctx context.Context, videoURL string, artifact []byte) (generatedVideoSignal, error) {
	temporary, err := os.MkdirTemp("", "manifoldgen-h3-validate-*")
	if err != nil {
		return generatedVideoSignal{}, err
	}
	defer os.RemoveAll(temporary)
	filename := filepath.Join(temporary, "artifact.video")
	if len(artifact) > 0 {
		if err := os.WriteFile(filename, artifact, 0o600); err != nil {
			return generatedVideoSignal{}, err
		}
	} else {
		if strings.TrimSpace(videoURL) == "" {
			return generatedVideoSignal{}, fmt.Errorf("video validation received no artifact")
		}
		if _, err := downloadGeneratedVideo(ctx, videoURL, filename); err != nil {
			return generatedVideoSignal{}, err
		}
	}
	return validateGeneratedVideoFile(ctx, filename)
}

// retryRunpodH3QualityFailure absorbs one provider retry before settlement.
// The next worker chooses a fresh seed; a second invalid result becomes a
// normal failed job and remains uncharged/retryable in the UI.
func retryRunpodH3QualityFailure(job *VideoJob, endpointID, variant string) bool {
	var input map[string]interface{}
	if job == nil || json.Unmarshal(job.Result, &input) != nil {
		return false
	}
	attempt, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprint(input["_h3_quality_retry"])))
	if attempt >= 1 {
		return false
	}
	input["_h3_quality_retry"] = 1
	delete(input, "seed")
	delete(input, "_output_upload_url")
	delete(input, "_output_public_url")
	if err := prepareH3RunpodOutputTarget(input, job.UserID); err != nil {
		return false
	}
	route := h3WorkerRoute{Variant: variant, RunpodEndpointID: endpointID}
	var queued h3RunpodQueuedJob
	if _, err := submitScaledH3RunpodJob(route, input, &queued); err != nil || queued.ID == "" {
		return false
	}
	scheduleH3ScaleToZero(endpointID)
	payload, _ := json.Marshal(input)
	providerJobID := "runpod:" + endpointID + ":" + queued.ID
	if err := dbConn.UpdateVideoJobProvider(job.ID, providerJobID, "queued", payload); err != nil {
		return false
	}
	job.ProviderJobID = providerJobID
	job.Status = "queued"
	job.Result = payload
	job.CreatedAt = time.Now()
	processRunpodH3VideoJob(job)
	return true
}
