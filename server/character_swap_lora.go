package main

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	_ "golang.org/x/image/webp"

	"manifoldgen-site/lofiloop"
)

// The LoRA lane edits the footage with MiniMax H3 Ref2VA plus the Akatz
// character-swap LoRA: the source clip is <Video 1>, the new characters are
// <Picture 1>, and every provider clip keeps the source scene, camera and
// motion. One pass replaces every performer, left to right.
const (
	characterSwapLoraKind      = "lora"
	loraSegmentSeconds         = 5.0
	loraOverlapSeconds         = 0.25
	loraMinSegmentSeconds      = 0.3
	loraMaxAttempts            = 3
	loraMaxSeconds             = 60
	loraSlots                  = 4
	loraChunkTimeout           = 45 * time.Minute
	loraDefaultGPUUSDPerSecond = 0.00126
	// Worker boot, image pull and weight download when no worker is warm.
	loraColdStartSeconds = 240
)

type loraTier struct {
	Steps     int
	Turbo     bool
	EasyCache []float64
	// Wall-clock seconds per generated second on an H100 at 0.4 megapixels,
	// measured on the production image; drives the estimate only.
	GPUSecondsPerSecond float64
}

// Standard is the LoRA author's 20-step recipe with EasyCache at 0.12, which
// matched the uncached output at 34.7 dB PSNR and ran 27% faster. Fast is the
// official 4-step Ref2V Turbo LoRA stacked on the swap LoRA: 2.8x faster.
var loraTiers = map[string]loraTier{
	"standard": {Steps: 20, EasyCache: []float64{0.12, 0.15, 0.90}, GPUSecondsPerSecond: 17.7},
	"fast":     {Steps: 4, Turbo: true, GPUSecondsPerSecond: 8.7},
}

type loraResolution struct {
	Megapixels float64
	Multiplier float64
}

var loraResolutions = map[string]loraResolution{
	"480p": {Megapixels: 0.4, Multiplier: 1},
	"768p": {Megapixels: 0.98, Multiplier: 4.0},
}

// loraPriceUSDPerSecond is the public price per source second at 480p and
// the standard tier; 768p (4x the attention cost) and the fast tier scale it. It covers the GPU time,
// the 8% overlap between clips in one shot, cold starts and retries.
var loraPriceUSDPerSecond = map[string]float64{"standard": 0.15, "fast": 0.13}

const loraDefaultPrompt = "Replace every person in <Video 1> with the corresponding character in <Picture 1>, matching left to right. Keep each replacement character's identity, outfit, and look from <Picture 1>. Preserve the source video's camera, background, lighting, and objects. Match each person's position, scale, pose, and movement. Do not show the reference image or its background."

const loraCharacterEditPrompt = "Edit this frame in place: replace each person with the character described below, keeping every replacement in exactly the same position, pose, scale, framing and camera angle as the person it replaces. Keep the set, props, lighting and background identical. Output exactly one image, not a collage. Photorealistic. Characters, left to right: "

func characterSwapIsLora(req ServiceUsageRequest) bool {
	return strings.EqualFold(strings.TrimSpace(req.Kind), characterSwapLoraKind)
}

func characterSwapLoraEndpointID() string {
	return strings.TrimSpace(os.Getenv("H3_SWAP_RUNPOD_ENDPOINT_ID"))
}

func loraGPUUSDPerSecond() float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("H3_SWAP_GPU_USD_PER_SECOND")), 64); err == nil && value > 0 {
		return value
	}
	return loraDefaultGPUUSDPerSecond
}

func normalizeCharacterSwapLora(req *ServiceUsageRequest) error {
	req.Kind = characterSwapLoraKind
	req.Resolution = strings.ToLower(strings.TrimSpace(req.Resolution))
	if req.Resolution == "" {
		req.Resolution = "480p"
	}
	if _, ok := loraResolutions[req.Resolution]; !ok {
		return fmt.Errorf("resolution must be 480p or 768p for the LoRA lane")
	}
	req.ServiceTier = strings.ToLower(strings.TrimSpace(req.ServiceTier))
	if req.ServiceTier == "" {
		req.ServiceTier = "standard"
	}
	if _, ok := loraTiers[req.ServiceTier]; !ok {
		return fmt.Errorf("service_tier must be standard or fast")
	}
	if req.Prompt == "" {
		req.Prompt = loraDefaultPrompt
	}
	if len(req.Prompt) > 2000 {
		return fmt.Errorf("prompt must be at most 2000 characters")
	}
	if req.Characters < 0 || req.Characters > 3 {
		return fmt.Errorf("characters must be between 1 and 3")
	}
	if req.Duration < 0 || req.Duration > loraMaxSeconds {
		return fmt.Errorf("duration must be between %d and %d seconds", characterSwapMinSeconds, loraMaxSeconds)
	}
	return nil
}

func loraChargeUSD(req ServiceUsageRequest, seconds float64) float64 {
	rate := loraPriceUSDPerSecond[req.ServiceTier] * loraResolutions[req.Resolution].Multiplier
	return math.Ceil(rate*math.Max(seconds, characterSwapMinSeconds)*100) / 100
}

// loraImageUSD is the upfront character-image fee: the local RA2 edit price.
// When RA2 is unavailable and OpenPaths answers instead, the job owner is
// charged the difference to the metered image_edit price once it happens.
func loraImageUSD() float64 {
	return ra2ImageEditPriceUSD
}

func loraImageFallbackTopUp(user *User, state *characterSwapState, engine string) {
	if engine == "ra2" || user.UnlimitedAPI {
		return
	}
	extraUSD := servicePricesUSD["image_edit"] - loraImageUSD()
	price := getCUTEPriceUSD()
	if extraUSD <= 0 || price <= 0 {
		return
	}
	extra := math.Ceil(extraUSD / price)
	if _, err := dbConn.DeductUserCredits(user.ID, extra); err != nil {
		log.Printf("[character-swap-lora] fallback image top-up skipped for %s: %v", user.ID, err)
		return
	}
	state.ImageCredits += extra
	state.ImageUSD += extraUSD
}

// planLoraChunks splits the source into shots at detected cuts and each shot
// into equal clips of at most 5 s. Clips after the first in a shot start
// loraOverlapSeconds early so the joins can be cross-faded; cuts stay hard.
func planLoraChunks(seconds float64, cuts []float64) ([]characterSwapChunk, error) {
	if seconds < characterSwapMinSeconds-0.05 {
		return nil, fmt.Errorf("source video must be at least %d seconds", characterSwapMinSeconds)
	}
	if seconds > loraMaxSeconds+0.5 {
		return nil, fmt.Errorf("source video must be at most %d seconds; trim it first", loraMaxSeconds)
	}
	seconds = math.Min(seconds, loraMaxSeconds)
	bounds := []float64{0}
	for _, cut := range cuts {
		if cut-bounds[len(bounds)-1] >= loraMinSegmentSeconds && seconds-cut >= loraMinSegmentSeconds {
			bounds = append(bounds, cut)
		}
	}
	bounds = append(bounds, seconds)
	chunks := make([]characterSwapChunk, 0, 16)
	for b := 0; b+1 < len(bounds); b++ {
		shotStart, shotLen := bounds[b], bounds[b+1]-bounds[b]
		count := int(math.Ceil((shotLen - 1e-6) / loraSegmentSeconds))
		if count < 1 {
			count = 1
		}
		length := shotLen / float64(count)
		for i := 0; i < count; i++ {
			chunk := characterSwapChunk{Index: len(chunks), Start: shotStart + float64(i)*length, Length: length, ShotStart: i == 0}
			if i > 0 {
				chunk.Start -= loraOverlapSeconds
				chunk.Length += loraOverlapSeconds
				chunk.Lead = loraOverlapSeconds
			}
			chunks = append(chunks, chunk)
		}
	}
	return chunks, nil
}

func loraEstimate(req ServiceUsageRequest, seconds float64, cuts []float64) (float64, float64, []characterSwapChunk, error) {
	chunks, err := planLoraChunks(seconds, cuts)
	if err != nil {
		return 0, 0, nil, err
	}
	charged := loraChargeUSD(req, math.Min(seconds, loraMaxSeconds))
	if req.ImageURL == "" {
		charged += loraImageUSD()
	}
	charged = math.Round(charged*100) / 100
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(charged / price)
	}
	return charged, credits, chunks, nil
}

// loraEstimatedGenerationSeconds is wall-clock time: clips run loraSlots at a
// time, each costing its GPU time plus a fixed load and transfer overhead.
func loraEstimatedGenerationSeconds(req ServiceUsageRequest, chunks []characterSwapChunk) int {
	if len(chunks) == 0 {
		return 0
	}
	tier, res := loraTiers[req.ServiceTier], loraResolutions[req.Resolution]
	total := 0.0
	for _, chunk := range chunks {
		total += chunk.Length*tier.GPUSecondsPerSecond*res.Multiplier + 25
	}
	waves := math.Ceil(float64(len(chunks)) / loraSlots)
	return int(total/float64(len(chunks))*waves) + loraColdStartSeconds
}

func loraEstimateResponse(req ServiceUsageRequest, usd, credits, seconds float64, chunks []characterSwapChunk) map[string]interface{} {
	return map[string]interface{}{
		"estimated_cost_usd": usd, "estimated_credits": credits, "kind": characterSwapLoraKind,
		"source_seconds": math.Round(seconds*100) / 100, "chunks": len(chunks), "shots": characterSwapShotCount(chunks),
		"resolution": req.Resolution, "service_tier": req.ServiceTier, "image_included": req.ImageURL == "",
		"image_cost_usd": loraImageUSD(), "rate_usd_per_second": loraPriceUSDPerSecond[req.ServiceTier] * loraResolutions[req.Resolution].Multiplier,
		"estimated_generation_seconds": loraEstimatedGenerationSeconds(req, chunks),
	}
}

// generateLoraCharacterImage redraws the source frame with the new characters
// on the local RA2 edit lane, falling back to the OpenPaths GPT image edit.
func generateLoraCharacterImage(user *User, state characterSwapState, width, height int) (string, string, error) {
	prompt := strings.TrimSpace(state.Request.CharacterPrompt)
	if prompt == "" {
		prompt = state.Request.Prompt
	}
	if !strings.Contains(strings.ToLower(prompt), "replace") {
		prompt = loraCharacterEditPrompt + prompt
	}
	req := ServiceUsageRequest{Service: "image_edit", Prompt: prompt, ImageURL: state.FrameURL, Width: width, Height: height}
	result, err := proxyToBackend(req, serviceBackends["image_edit"])
	if err != nil {
		return "", "", err
	}
	engine := resultEngine(result)
	result, saved := persistGeneratedZImage(req, user, result)
	if hosted := characterSwapHostedImage(result, saved); hosted != "" {
		return hosted, engine, nil
	}
	return "", engine, fmt.Errorf("no hosted image was returned")
}

func loraFrameSize(path string) (int, int) {
	file, err := os.Open(path)
	if err != nil {
		return 1536, 864
	}
	defer file.Close()
	cfg, _, err := image.DecodeConfig(file)
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return 1536, 864
	}
	aspect := float64(cfg.Width) / float64(cfg.Height)
	const area = 1.15e6
	h := math.Sqrt(area / aspect)
	w := h * aspect
	return int(math.Round(w/16)) * 16, int(math.Round(h/16)) * 16
}

func loraInput(state characterSwapState, chunk characterSwapChunk) map[string]interface{} {
	tier, res := loraTiers[state.Request.ServiceTier], loraResolutions[state.Request.Resolution]
	input := map[string]interface{}{
		"task": "character_swap", "video_url": chunk.SourceURL, "image_urls": []string{state.SwappedImageURL},
		"prompt": state.Request.Prompt, "steps": tier.Steps, "megapixels": res.Megapixels, "turbo": tier.Turbo,
	}
	if len(tier.EasyCache) == 3 {
		input["easycache"] = tier.EasyCache
	}
	if state.Request.Seed != 0 {
		input["seed"] = state.Request.Seed + chunk.Index
	}
	return input
}

func submitLoraRunpod(endpointID string, input map[string]interface{}, queued *h3RunpodQueuedJob) (int, error) {
	lock := h3EndpointScaleLock(endpointID)
	lock.Lock()
	defer lock.Unlock()
	config, err := h3EndpointConfig(endpointID)
	if err != nil {
		return 0, err
	}
	workers := loraSlots
	if value, err := strconv.Atoi(strings.TrimSpace(os.Getenv("H3_SWAP_WORKERS_MAX"))); err == nil && value > 0 {
		workers = value
	}
	if config.WorkersMax != workers {
		if err := characterAnimationSetWorkersMax(endpointID, "standard", workers); err != nil {
			return 0, err
		}
	}
	var status int
	for attempt := 0; attempt < 7; attempt++ {
		status, err = callH3Runpod(endpointID, "/run", http.MethodPost, runpodRunBody(input, 40*time.Minute), queued)
		if status != http.StatusConflict || err == nil || !strings.Contains(err.Error(), "ENDPOINT_PAUSED") {
			return status, err
		}
		if err := characterAnimationSetWorkersMax(endpointID, "standard", workers); err != nil {
			return status, err
		}
		time.Sleep(h3ScalePropagationDelay)
	}
	return status, err
}

func waitLoraClip(ctx context.Context, jobID, endpointID, runpodID, expectedURL string) (string, float64, error) {
	deadline := time.Now().Add(loraChunkTimeout)
	for time.Now().Before(deadline) {
		if ctx.Err() != nil {
			return "", 0, ctx.Err()
		}
		if videoJobCancellationRequested(jobID) {
			_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(runpodID), http.MethodPost, nil, nil)
			return "", 0, fmt.Errorf("cancelled")
		}
		var state h3RunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(runpodID), http.MethodGet, nil, &state); err != nil {
			time.Sleep(4 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED":
			if len(state.Output.Outputs) == 0 {
				return "", 0, fmt.Errorf("swap worker completed without a clip")
			}
			videoURL, artifact, _, err := resolveH3RunpodArtifact(state.Output.Outputs[0], expectedURL)
			if err != nil {
				return "", 0, err
			}
			if videoURL == "" {
				videoURL, err = uploadH3RunpodVideo(ctx, artifact, "", state.Output.Outputs[0].ContentType)
				if err != nil {
					return "", 0, err
				}
			}
			return videoURL, float64(state.ExecutionTime) / 1000, nil
		case "FAILED", "CANCELLED", "TIMED_OUT":
			return "", 0, fmt.Errorf("swap worker %s: %s", strings.ToLower(state.Status), truncateString(state.Error, 200))
		}
		time.Sleep(5 * time.Second)
	}
	return "", 0, fmt.Errorf("swap clip did not finish in time")
}

func processCharacterSwapLora(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) (string, string, error) {
	endpointID := characterSwapLoraEndpointID()
	if endpointID == "" {
		return "", "", fmt.Errorf("the character swap LoRA lane is not configured")
	}
	if len(state.Chunks) == 0 {
		planned, err := planLoraChunks(state.SourceSeconds, state.Cuts)
		if err != nil {
			return "", "", err
		}
		state.Chunks = planned
	}
	state.Stage = "video"
	_ = persistCharacterSwapState(job.ID, "processing", *state)

	var mu sync.Mutex
	persist := func() {
		mu.Lock()
		defer mu.Unlock()
		_ = persistCharacterSwapState(job.ID, "processing", *state)
	}
	var wg sync.WaitGroup
	slots := make(chan struct{}, loraSlots*2)
	errs := make([]error, len(state.Chunks))
	for i := range state.Chunks {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			mu.Lock()
			chunk := state.Chunks[i]
			mu.Unlock()
			if chunk.Status == "completed" && chunk.OutputURL != "" {
				return
			}
			if chunk.SourceURL == "" {
				clipPath := filepath.Join(workDir, fmt.Sprintf("lora-src-%02d.mp4", chunk.Index))
				if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start), "-i", sourcePath, "-t", trimSeconds(chunk.Length), "-an",
					"-vf", "fps=24,scale='min(1280,iw)':-2,format=yuv420p", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-movflags", "+faststart", clipPath); err != nil {
					errs[i] = fmt.Errorf("could not cut the source into clips")
					return
				}
				sourceURL, err := uploadCharacterSwapFile(ctx, clipPath, job.UserID, "video/mp4")
				if err != nil {
					errs[i] = fmt.Errorf("could not store a source clip")
					return
				}
				chunk.SourceURL = sourceURL
			}
			var lastErr error
			for attempt := 0; attempt < loraMaxAttempts; attempt++ {
				if videoJobCancellationRequested(job.ID) {
					errs[i] = fmt.Errorf("cancelled")
					return
				}
				input := loraInput(*state, chunk)
				if attempt > 0 {
					input["seed"] = 1000 + chunk.Index*7 + attempt
				}
				if err := prepareH3RunpodOutputTarget(input, job.UserID); err != nil {
					errs[i] = fmt.Errorf("could not prepare the clip upload")
					return
				}
				expected, _ := input["_output_public_url"].(string)
				var queued h3RunpodQueuedJob
				if _, err := submitLoraRunpod(endpointID, input, &queued); err != nil || queued.ID == "" {
					lastErr = fmt.Errorf("swap worker rejected clip %d", chunk.Index+1)
					log.Printf("[character-swap-lora] job=%s clip=%d submit: %v", job.ID, chunk.Index, err)
					time.Sleep(10 * time.Second)
					continue
				}
				mu.Lock()
				state.Chunks[i].SourceURL, state.Chunks[i].RequestID, state.Chunks[i].Status = chunk.SourceURL, queued.ID, "queued"
				mu.Unlock()
				persist()
				outputURL, execSeconds, err := waitLoraClip(ctx, job.ID, endpointID, queued.ID, expected)
				if err != nil {
					lastErr = fmt.Errorf("clip %d: %w", chunk.Index+1, err)
					log.Printf("[character-swap-lora] job=%s clip=%d attempt=%d: %v", job.ID, chunk.Index, attempt, err)
					if err.Error() == "cancelled" {
						errs[i] = err
						return
					}
					continue
				}
				mu.Lock()
				state.Chunks[i].OutputURL, state.Chunks[i].Status = outputURL, "completed"
				state.Chunks[i].ProviderUSD += execSeconds * loraGPUUSDPerSecond()
				state.Chunks[i].Retries = attempt
				mu.Unlock()
				persist()
				return
			}
			errs[i] = lastErr
		}(i)
	}
	wg.Wait()
	scheduleH3ScaleToZero(endpointID)
	for _, err := range errs {
		if err != nil {
			return "", "", err
		}
	}
	if videoJobCancellationRequested(job.ID) {
		return "", "", fmt.Errorf("cancelled")
	}

	state.Stage = "mux"
	_ = persistCharacterSwapState(job.ID, "processing", *state)
	outputPath, err := assembleLoraVideo(ctx, *state, sourcePath, workDir)
	if err != nil {
		return "", "", fmt.Errorf("could not assemble the final video: %s", truncateString(err.Error(), 200))
	}
	outputURL, err := publishFinalVideo(ctx, outputPath, job.UserID, func() (string, error) {
		return uploadCharacterSwapFile(ctx, outputPath, job.UserID, "video/mp4")
	})
	if err != nil {
		return "", "", fmt.Errorf("could not publish the final video")
	}
	return outputURL, outputPath, nil
}

func probeVideoSize(ctx context.Context, path string) (int, int, error) {
	binary := "ffprobe"
	if configured := strings.TrimSpace(os.Getenv("FFPROBE_BIN")); configured != "" {
		binary = configured
	}
	out, err := exec.CommandContext(ctx, binary, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", path).Output()
	if err != nil {
		return 0, 0, err
	}
	parts := strings.Split(strings.TrimSpace(string(out)), "x")
	if len(parts) != 2 {
		return 0, 0, fmt.Errorf("unexpected probe output")
	}
	w, errW := strconv.Atoi(parts[0])
	h, errH := strconv.Atoi(parts[1])
	if errW != nil || errH != nil || w <= 0 || h <= 0 {
		return 0, 0, fmt.Errorf("unexpected probe output")
	}
	return w, h, nil
}

// loraFilterGraph joins clips: every clip is trimmed to its planned length,
// clips inside one shot are cross-faded over their shared overlap, and shots
// are cut together hard.
func loraFilterGraph(chunks []characterSwapChunk, width, height int) string {
	var filter strings.Builder
	for i, chunk := range chunks {
		fmt.Fprintf(&filter, "[%d:v]fps=24,scale=%d:%d:flags=lanczos,setsar=1,format=yuv420p,trim=duration=%s,setpts=PTS-STARTPTS,settb=AVTB[c%d];", i, width, height, trimSeconds(chunk.Length), i)
	}
	var shots []string
	for i := 0; i < len(chunks); {
		j := i + 1
		for j < len(chunks) && !chunks[j].ShotStart {
			j++
		}
		label := fmt.Sprintf("c%d", i)
		total := chunks[i].Length
		for k := i + 1; k < j; k++ {
			next := fmt.Sprintf("x%d", k)
			fade := chunks[k].Lead
			fmt.Fprintf(&filter, "[%s][c%d]xfade=transition=fade:duration=%s:offset=%s[%s];", label, k, trimSeconds(fade), trimSeconds(total-fade), next)
			total += chunks[k].Length - fade
			label = next
		}
		shots = append(shots, "["+label+"]")
		i = j
	}
	filter.WriteString(strings.Join(shots, ""))
	fmt.Fprintf(&filter, "concat=n=%d:v=1:a=0[v]", len(shots))
	return filter.String()
}

func assembleLoraVideo(ctx context.Context, state characterSwapState, sourcePath, workDir string) (string, error) {
	args := []string{"-y", "-loglevel", "error"}
	width, height := 0, 0
	for i, chunk := range state.Chunks {
		clipPath := filepath.Join(workDir, fmt.Sprintf("lora-out-%02d.mp4", i))
		if err := downloadURLToFile(ctx, chunk.OutputURL, clipPath); err != nil {
			return "", fmt.Errorf("clip %d could not be downloaded", i+1)
		}
		if i == 0 {
			w, h, err := probeVideoSize(ctx, clipPath)
			if err != nil {
				return "", err
			}
			width, height = w, h
		}
		args = append(args, "-i", clipPath)
	}
	joined := filepath.Join(workDir, "lora-joined.mp4")
	var stderr bytes.Buffer
	cmd := exec.CommandContext(ctx, ffmpegBinary(), append(args, "-filter_complex", loraFilterGraph(state.Chunks, width, height), "-map", "[v]",
		"-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", joined)...)
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return "", fmt.Errorf("join failed: %w: %s", err, tailOutput(stderr.Bytes()))
	}
	finalPath := filepath.Join(workDir, "lora-final.mp4")
	mux := []string{"-y", "-loglevel", "error", "-i", joined}
	keepAudio := state.Request.IncludeAudio == nil || *state.Request.IncludeAudio
	if keepAudio {
		mux = append(mux, "-i", sourcePath, "-map", "0:v:0", "-map", "1:a:0?")
	} else {
		mux = append(mux, "-map", "0:v:0")
	}
	mux = append(mux, "-t", trimSeconds(math.Min(state.SourceSeconds, loraMaxSeconds)), "-c:v", "libx264", "-preset", "medium", "-crf", "17",
		"-profile:v", "high", "-pix_fmt", "yuv420p", "-r", "24", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart", finalPath)
	if err := lofiloop.RunFFmpeg(ctx, mux...); err != nil {
		return "", fmt.Errorf("could not mux the soundtrack")
	}
	return finalPath, nil
}

func ffmpegBinary() string {
	if binary := strings.TrimSpace(os.Getenv("FFMPEG_BIN")); binary != "" {
		return binary
	}
	return "ffmpeg"
}
