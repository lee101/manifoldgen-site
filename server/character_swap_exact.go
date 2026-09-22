package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"manifoldgen-site/lofiloop"
)

// The exact-motion lane edits the footage instead of regenerating it: every
// performer is tracked, hidden from the other performers' passes, replaced
// with Wan 2.2 Animate (pose-exact motion transfer from a crop of the swapped
// frame), and composited back onto the untouched original.
const (
	characterSwapExactKind   = "exact"
	exactAnimatePath         = "fal-ai/wan/v2.2-14b/animate/replace"
	exactAnimateRequestBase  = "fal-ai/wan"
	exactChunkSeconds        = 12.0
	exactMaxPeople           = 3
	exactPassSlots           = 6
	exactPassTimeout         = 50 * time.Minute
	exactWidth, exactHeight  = 1280, 720
	exactReferenceFrameAt    = 2.0
	exactAnimateFramesPerSec = 24.0
)

// exactAnimateRates is what fal bills per 16-frame "video second" of Animate
// output; exactPriceRates is the public price per source second per performer.
var exactAnimateRates = map[string]float64{"580p": 0.06, "720p": 0.08}
var exactPriceRates = map[string]float64{"580p": 0.18, "720p": 0.24}

type exactPass struct {
	Person      int     `json:"person"`
	Chunk       int     `json:"chunk"`
	Start       float64 `json:"start"`
	Length      float64 `json:"length"`
	BoxedURL    string  `json:"boxed_url,omitempty"`
	RequestID   string  `json:"request_id,omitempty"`
	OutputURL   string  `json:"output_url,omitempty"`
	Status      string  `json:"status,omitempty"`
	ProviderUSD float64 `json:"provider_usd"`
	boxedPath   string
	outputPath  string
}

type exactState struct {
	People     int         `json:"people"`
	CropURLs   []string    `json:"crop_urls,omitempty"`
	Passes     []exactPass `json:"passes,omitempty"`
	PoseError  float64     `json:"pose_error"`
	PoseBad    float64     `json:"pose_bad_fraction"`
	Coverage   []float64   `json:"coverage,omitempty"`
	Resolution string      `json:"resolution"`
}

func characterSwapIsExact(req ServiceUsageRequest) bool {
	return strings.EqualFold(strings.TrimSpace(req.Kind), characterSwapExactKind)
}

func exactPeople(req ServiceUsageRequest) int {
	if req.Characters <= 0 {
		return 2
	}
	if req.Characters > exactMaxPeople {
		return exactMaxPeople
	}
	return req.Characters
}

func exactChargeUSD(resolution string, seconds float64, people int) float64 {
	return math.Ceil(exactPriceRates[resolution]*math.Max(seconds, characterSwapMinSeconds)*float64(people)*100) / 100
}

func exactProviderUSD(resolution string, seconds float64) float64 {
	return exactAnimateRates[resolution] * seconds * exactAnimateFramesPerSec / 16
}

func normalizeCharacterSwapExact(req *ServiceUsageRequest) error {
	req.Kind = characterSwapExactKind
	req.Resolution = strings.ToLower(strings.TrimSpace(req.Resolution))
	if req.Resolution == "" || req.Resolution == "768p" {
		req.Resolution = "720p"
	}
	if _, ok := exactPriceRates[req.Resolution]; !ok {
		return fmt.Errorf("resolution must be 720p or 580p for the exact lane")
	}
	if req.Characters < 0 || req.Characters > exactMaxPeople {
		return fmt.Errorf("characters must be between 1 and %d", exactMaxPeople)
	}
	if req.Prompt == "" {
		req.Prompt = "exact motion character swap"
	}
	return nil
}

// planExactChunks splits the source into pieces no longer than 12 s, snapping
// boundaries to detected cuts so identity re-rendering differences between
// passes land on a cut instead of mid-shot.
func planExactChunks(seconds float64, cuts []float64) [][2]float64 {
	count := int(math.Ceil(seconds / exactChunkSeconds))
	if count < 1 {
		count = 1
	}
	bounds := []float64{0}
	for i := 1; i < count; i++ {
		target := seconds * float64(i) / float64(count)
		best, bestDist := target, 2.0
		for _, cut := range cuts {
			if dist := math.Abs(cut - target); dist < bestDist && cut-bounds[len(bounds)-1] > 2 && seconds-cut > 2 {
				best, bestDist = cut, dist
			}
		}
		bounds = append(bounds, best)
	}
	bounds = append(bounds, seconds)
	chunks := make([][2]float64, 0, count)
	for i := 0; i+1 < len(bounds); i++ {
		chunks = append(chunks, [2]float64{bounds[i], bounds[i+1]})
	}
	return chunks
}

func characterSwapPython() (string, string) {
	python := strings.TrimSpace(getEnv("CHARACTER_SWAP_PYTHON", "python3"))
	helper := strings.TrimSpace(getEnv("CHARACTER_SWAP_HELPER", ""))
	if helper == "" {
		if exe, err := os.Executable(); err == nil {
			helper = filepath.Join(filepath.Dir(exe), "charswap_exact.py")
		}
		if _, err := os.Stat(helper); err != nil {
			helper = "charswap_exact.py"
		}
	}
	return python, helper
}

func runExactHelper(ctx context.Context, args ...string) (map[string]interface{}, error) {
	python, helper := characterSwapPython()
	cmd := exec.CommandContext(ctx, python, append([]string{helper}, args...)...)
	cmd.Env = append(os.Environ(), "YOLO_VERBOSE=False")
	var stdout, stderr bytes.Buffer
	cmd.Stdout, cmd.Stderr = &stdout, &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("%s %s: %w: %s", filepath.Base(helper), args[0], err, tailOutput(stderr.Bytes()))
	}
	lines := strings.Split(strings.TrimSpace(stdout.String()), "\n")
	var payload map[string]interface{}
	if err := json.Unmarshal([]byte(lines[len(lines)-1]), &payload); err != nil {
		return nil, fmt.Errorf("%s returned no JSON", args[0])
	}
	return payload, nil
}

func processCharacterSwapExact(ctx context.Context, job *VideoJob, user *User, state *characterSwapState, sourcePath, workDir string) (string, string, error) {
	ex := state.Exact
	if ex == nil {
		ex = &exactState{Resolution: state.Request.Resolution}
		state.Exact = ex
	}
	normPath := filepath.Join(workDir, "source-norm.mp4")
	if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", sourcePath, "-an",
		"-vf", fmt.Sprintf("fps=24,scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p", exactWidth, exactHeight, exactWidth, exactHeight),
		"-c:v", "libx264", "-preset", "medium", "-crf", "16", "-movflags", "+faststart", normPath); err != nil {
		return "", "", fmt.Errorf("could not normalise the source video")
	}
	state.Stage = "track"
	_ = persistCharacterSwapState(job.ID, "processing", *state)
	boxesPath := filepath.Join(workDir, "boxes.json")
	track, err := runExactHelper(ctx, "track", "--src", normPath, "--out", boxesPath, "--width", fmt.Sprint(exactWidth), "--height", fmt.Sprint(exactHeight), "--max-people", fmt.Sprint(exactMaxPeople))
	if err != nil {
		return "", "", fmt.Errorf("performer tracking failed: %s", truncateString(err.Error(), 200))
	}
	people, _ := track["people"].(float64)
	ex.People = int(people)
	if ex.People < 1 {
		return "", "", fmt.Errorf("no performers were detected in the source video")
	}
	if requested := exactPeople(state.Request); state.Request.Characters > 0 && requested < ex.People {
		ex.People = requested
	}
	frameIndex := 0
	if state.SourceSeconds > 4 {
		frameIndex = int(exactReferenceFrameAt * 24)
	}
	swappedPath := filepath.Join(workDir, "swapped.png")
	if err := downloadURLToFile(ctx, state.SwappedImageURL, swappedPath); err != nil {
		return "", "", fmt.Errorf("could not download the swapped frame")
	}
	crops, err := runExactHelper(ctx, "crops", "--image", swappedPath, "--boxes", boxesPath, "--frame-index", fmt.Sprint(frameIndex), "--out-dir", workDir)
	if err != nil {
		return "", "", fmt.Errorf("could not crop the characters from the swapped frame: %s", truncateString(err.Error(), 160))
	}
	cropList, _ := crops["crops"].([]interface{})
	ex.CropURLs = make([]string, 0, ex.People)
	for k := 0; k < ex.People; k++ {
		if k >= len(cropList) {
			break
		}
		path, _ := cropList[k].(string)
		if path == "" {
			return "", "", fmt.Errorf("performer %d has no reference crop", k+1)
		}
		cropURL, err := uploadCharacterSwapFile(ctx, path, job.UserID, "image/png")
		if err != nil {
			return "", "", fmt.Errorf("could not store a character crop")
		}
		ex.CropURLs = append(ex.CropURLs, cropURL)
	}
	if len(ex.Passes) == 0 {
		chunks := planExactChunks(state.SourceSeconds, state.Cuts)
		for k := 0; k < ex.People; k++ {
			for c, chunk := range chunks {
				ex.Passes = append(ex.Passes, exactPass{Person: k, Chunk: c, Start: chunk[0], Length: chunk[1] - chunk[0]})
			}
		}
	}
	state.Stage = "video"
	_ = persistCharacterSwapState(job.ID, "processing", *state)

	var mu sync.Mutex
	var wg sync.WaitGroup
	slots := make(chan struct{}, exactPassSlots)
	errs := make([]error, len(ex.Passes))
	persist := func() {
		mu.Lock()
		defer mu.Unlock()
		_ = persistCharacterSwapState(job.ID, "processing", *state)
	}
	for i := range ex.Passes {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			mu.Lock()
			pass := ex.Passes[i]
			mu.Unlock()
			boxedPath := filepath.Join(workDir, fmt.Sprintf("boxed-%d-%02d.mp4", pass.Person, pass.Chunk))
			if _, err := runExactHelper(ctx, "boxout", "--src", normPath, "--boxes", boxesPath, "--keep", fmt.Sprint(pass.Person), "--out", boxedPath,
				"--start", trimSeconds(pass.Start), "--end", trimSeconds(pass.Start+pass.Length)); err != nil {
				errs[i] = fmt.Errorf("could not prepare performer %d clip %d", pass.Person+1, pass.Chunk+1)
				return
			}
			if pass.OutputURL == "" {
				boxedURL, err := uploadCharacterSwapFile(ctx, boxedPath, job.UserID, "video/mp4")
				if err != nil {
					errs[i] = fmt.Errorf("could not store performer %d clip %d", pass.Person+1, pass.Chunk+1)
					return
				}
				input := map[string]interface{}{
					"video_url": boxedURL, "image_url": ex.CropURLs[pass.Person],
					"guidance_scale": 1, "resolution": state.Request.Resolution, "num_inference_steps": 20, "shift": 5,
					"enable_safety_checker": false, "enable_output_safety_checker": false,
					"video_quality": "high", "video_write_mode": "balanced", "return_frames_zip": false, "use_turbo": false,
				}
				if state.Request.Seed != 0 {
					input["seed"] = state.Request.Seed
				}
				data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+exactAnimatePath, input)
				if err != nil {
					errs[i] = fmt.Errorf("motion transfer rejected performer %d clip %d", pass.Person+1, pass.Chunk+1)
					return
				}
				var queued falQueueResponse
				if json.Unmarshal(data, &queued) != nil || queued.RequestID == "" {
					errs[i] = fmt.Errorf("motion transfer returned no job for performer %d clip %d", pass.Person+1, pass.Chunk+1)
					return
				}
				mu.Lock()
				ex.Passes[i].BoxedURL, ex.Passes[i].RequestID, ex.Passes[i].Status = boxedURL, queued.RequestID, "queued"
				mu.Unlock()
				persist()
				outputURL, err := waitExactPass(ctx, job.ID, queued.RequestID)
				if err != nil {
					errs[i] = fmt.Errorf("performer %d clip %d: %w", pass.Person+1, pass.Chunk+1, err)
					return
				}
				mu.Lock()
				ex.Passes[i].OutputURL = outputURL
				ex.Passes[i].ProviderUSD = exactProviderUSD(state.Request.Resolution, pass.Length)
				mu.Unlock()
				pass.OutputURL = outputURL
			}
			outputPath := filepath.Join(workDir, fmt.Sprintf("gen-%d-%02d.mp4", pass.Person, pass.Chunk))
			if err := downloadURLToFile(ctx, pass.OutputURL, outputPath); err != nil {
				errs[i] = fmt.Errorf("performer %d clip %d could not be downloaded", pass.Person+1, pass.Chunk+1)
				return
			}
			mu.Lock()
			ex.Passes[i].boxedPath, ex.Passes[i].outputPath, ex.Passes[i].Status = boxedPath, outputPath, "completed"
			mu.Unlock()
			persist()
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			return "", "", err
		}
	}

	state.Stage = "mux"
	_ = persistCharacterSwapState(job.ID, "processing", *state)
	pairs := make([]string, 0, ex.People)
	for k := 0; k < ex.People; k++ {
		boxedAll := filepath.Join(workDir, fmt.Sprintf("boxed-%d.mp4", k))
		genAll := filepath.Join(workDir, fmt.Sprintf("gen-%d.mp4", k))
		var boxed, gen []exactPass
		for _, pass := range ex.Passes {
			if pass.Person == k {
				boxed = append(boxed, pass)
				gen = append(gen, pass)
			}
		}
		if err := concatExactClips(ctx, boxed, false, boxedAll); err != nil {
			return "", "", fmt.Errorf("could not join performer %d inputs", k+1)
		}
		if err := concatExactClips(ctx, gen, true, genAll); err != nil {
			return "", "", fmt.Errorf("could not join performer %d passes", k+1)
		}
		pairs = append(pairs, "--pair", boxedAll+":"+genAll)
	}
	compPath := filepath.Join(workDir, "composite.mp4")
	comp, err := runExactHelper(ctx, append([]string{"composite", "--src", normPath, "--boxes", boxesPath, "--out", compPath}, pairs...)...)
	if err != nil {
		return "", "", fmt.Errorf("compositing failed: %s", truncateString(err.Error(), 160))
	}
	if coverage, ok := comp["coverage"].([]interface{}); ok {
		ex.Coverage = ex.Coverage[:0]
		for _, c := range coverage {
			if v, ok := c.(float64); ok {
				ex.Coverage = append(ex.Coverage, v)
			}
		}
	}
	finalPath := filepath.Join(workDir, "final.mp4")
	if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", compPath, "-i", sourcePath,
		"-map", "0:v:0", "-map", "1:a:0?", "-t", trimSeconds(state.SourceSeconds),
		"-c:v", "libx264", "-preset", "medium", "-crf", "18", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", "24",
		"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", finalPath); err != nil {
		return "", "", fmt.Errorf("could not mux the soundtrack")
	}
	if check, err := runExactHelper(ctx, "posecheck", "--src", normPath, "--out", compPath); err == nil {
		ex.PoseError, _ = check["mean_joint_error"].(float64)
		ex.PoseBad, _ = check["bad_fraction"].(float64)
	} else {
		log.Printf("[character-swap] job=%s pose check skipped: %v", job.ID, err)
	}
	outputURL, err := uploadCharacterSwapFile(ctx, finalPath, job.UserID, "video/mp4")
	if err != nil {
		return "", "", fmt.Errorf("could not publish the final video")
	}
	return outputURL, finalPath, nil
}

// concatExactClips joins one performer's chunk clips back into a full-length
// video. Generated clips are re-encoded so a provider frame-rate quirk cannot
// desynchronise the composite.
func concatExactClips(ctx context.Context, passes []exactPass, generated bool, out string) error {
	args := []string{"-y", "-loglevel", "error"}
	var filter strings.Builder
	for i, pass := range passes {
		path := pass.boxedPath
		if generated {
			path = pass.outputPath
		}
		args = append(args, "-i", path)
		fmt.Fprintf(&filter, "[%d:v]fps=24,scale=%d:%d,setsar=1,tpad=stop_mode=clone:stop_duration=1,trim=duration=%s,setpts=PTS-STARTPTS,settb=AVTB[v%d];", i, exactWidth, exactHeight, trimSeconds(pass.Length), i)
	}
	for i := range passes {
		fmt.Fprintf(&filter, "[v%d]", i)
	}
	fmt.Fprintf(&filter, "concat=n=%d:v=1:a=0,format=yuv420p[v]", len(passes))
	args = append(args, "-filter_complex", filter.String(), "-map", "[v]", "-c:v", "libx264", "-preset", "medium", "-crf", "16", out)
	return lofiloop.RunFFmpeg(ctx, args...)
}

func waitExactPass(ctx context.Context, jobID, requestID string) (string, error) {
	base := "https://queue.fal.run/" + exactAnimateRequestBase + "/requests/" + url.PathEscape(requestID)
	deadline := time.Now().Add(exactPassTimeout)
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
					return "", fmt.Errorf("motion transfer returned an invalid result")
				}
				if video, ok := payload["video"].(map[string]interface{}); ok {
					if outputURL, _ := video["url"].(string); outputURL != "" {
						return outputURL, nil
					}
				}
				return "", fmt.Errorf("motion transfer returned no clip")
			case "failed", "cancelled", "canceled":
				return "", fmt.Errorf("motion transfer failed")
			}
		}
		time.Sleep(6 * time.Second)
	}
	return "", fmt.Errorf("motion transfer did not finish in time")
}
