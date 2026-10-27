package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"

	"manifoldgen-site/lofiloop"
)

// characterSwapKeyframeLead introduces a per-shot keyframe as the only scene
// reference. On the rap test video adding the global swapped frame or its body
// and face crops pulled wide shots and close-ups back to the medium two-shot
// (bbox IoU 0.15-0.36 vs 0.84-0.91 with the keyframe alone), and the keyframe
// alone leaked the source performers in 4 of 10 clips until the prompt said
// that Video 1 is a motion reference only.
const characterSwapKeyframeLead = "Image 1 is the exact target look for this shot, including its camera distance, framing and composition: keep the same crop and positions throughout. The people in Video 1 are only a motion reference; never reproduce their faces, hats, chains, tattoos or clothing, show only the people exactly as they look in Image 1. "

const (
	characterSwapService        = "character_swap_video"
	characterSwapMaxSeconds     = 60
	characterSwapMinSeconds     = 5
	characterSwapChunkSeconds   = 10
	characterSwapSegmentSeconds = 4.0
	characterSwapLeadSeconds    = 1.0
	characterSwapCrossfade      = 0.2
	characterSwapCutThreshold   = 0.18
	characterSwapMinShot        = 0.75
	characterSwapMaxRetries     = 2
	characterSwapJobTimeout     = 90 * time.Minute
	characterSwapChunkTimeout   = 40 * time.Minute
	characterSwapMaxArtifact    = 768 << 20
	characterSwapFalPath        = "minimax/h3-max/reference-to-video"
	characterSwapFalRequestBase = "minimax/h3-max"
	characterSwapAudioPrompt    = " Audio 1 is the song being performed: match the lip sync and rhythm to Audio 1."
	characterSwapShotFeeUSD     = 0.12
	characterSwapShotSlots      = 4
)

// characterSwapRates is what fal bills per generated second; 2K and 4K are
// upscales of the 768P base, so 768P is the native fidelity ceiling.
var characterSwapRates = map[string]float64{"768P": 0.08, "2K": 0.16}

// characterSwapPriceRates is the public price per second of source video. It
// covers the 25% lead-in overhead, the vision QA calls, and unbilled retries.
var characterSwapPriceRates = map[string]float64{"768P": 0.20, "2K": 0.36}

var characterSwapRenderSlots = make(chan struct{}, 2)

const characterSwapDefaultVideoPrompt = "Image 1 is the exact target look: the new characters, their wardrobe, the set and the background. Video 1 is only the motion and camera reference. From the very first frame show only the characters of Image 1, never the original people. Each new character performs every move, gesture, lip movement and timing of the corresponding person in Video 1, in the identical position and scale. Same camera angles, same framing, same cuts, same props, and the background of Image 1 throughout. Photorealistic music video."

type characterSwapChunk struct {
	Index       int                       `json:"index"`
	Start       float64                   `json:"start"`
	Length      float64                   `json:"length"`
	Duration    int                       `json:"duration"`
	Lead        float64                   `json:"lead"`
	ShotStart   bool                      `json:"shot_start,omitempty"`
	ShotImage   string                    `json:"shot_image,omitempty"`
	SourceURL   string                    `json:"source_url,omitempty"`
	AudioURL    string                    `json:"audio_url,omitempty"`
	PrevFrame   string                    `json:"prev_frame,omitempty"`
	RequestID   string                    `json:"request_id,omitempty"`
	OutputURL   string                    `json:"output_url,omitempty"`
	Status      string                    `json:"status,omitempty"`
	ProviderUSD float64                   `json:"provider_usd"`
	Retries     int                       `json:"retries,omitempty"`
	QAReason    string                    `json:"qa_reason,omitempty"`
	ShotNote    string                    `json:"shot_note,omitempty"`
	Background  string                    `json:"background,omitempty"`
	Attempts    int                       `json:"attempts,omitempty"`
	Metrics     *characterSwapClipMetrics `json:"metrics,omitempty"`
	Flagged     bool                      `json:"flagged,omitempty"`
	LipSynced   bool                      `json:"lipsynced,omitempty"`
	LipSyncUSD  float64                   `json:"lipsync_usd,omitempty"`
	LocalPath   string                    `json:"-"`
}

type characterSwapState struct {
	Request          ServiceUsageRequest    `json:"request"`
	Stage            string                 `json:"stage"`
	SourceSeconds    float64                `json:"source_seconds"`
	FrameURL         string                 `json:"frame_url,omitempty"`
	SwappedImageURL  string                 `json:"swapped_image_url,omitempty"`
	ImageCredits     float64                `json:"image_credits"`
	ImageUSD         float64                `json:"image_usd"`
	Chunks           []characterSwapChunk   `json:"chunks,omitempty"`
	Cuts             []float64              `json:"cuts,omitempty"`
	ShotFeeUSD       float64                `json:"shot_fee_usd"`
	ShotImageUSD     float64                `json:"shot_image_usd"`
	Exact            *exactState            `json:"exact,omitempty"`
	IdentityURLs     []string               `json:"identity_urls,omitempty"`
	EstimatedUSD     float64                `json:"estimated_usd"`
	EstimatedCredits float64                `json:"estimated_credits"`
	ChargeUSD        float64                `json:"charge_usd,omitempty"`
	Recast           *recastState           `json:"recast,omitempty"`
	FinalMetrics     map[string]interface{} `json:"final_metrics,omitempty"`
}

type characterSwapEnvelope struct {
	State characterSwapState `json:"_character_swap"`
}

func normalizeCharacterSwapRequest(req *ServiceUsageRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.CharacterPrompt = strings.TrimSpace(req.CharacterPrompt)
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.Resolution = strings.ToUpper(strings.TrimSpace(req.Resolution))
	req.AspectRatio = strings.TrimSpace(req.AspectRatio)
	req.PromptExpansionMode = strings.ToLower(strings.TrimSpace(req.PromptExpansionMode))
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	if err := validateRestyleURL(req.VideoURL); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if err := characterSwapMediaKind(req.VideoURL, "video"); err != nil {
		return fmt.Errorf("video_url: %w", err)
	}
	if characterSwapIsRecast(*req) {
		return normalizeCharacterSwapRecast(req)
	}
	if req.ImageURL != "" {
		if err := validateRestyleURL(req.ImageURL); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
		if err := characterSwapMediaKind(req.ImageURL, "image"); err != nil {
			return fmt.Errorf("image_url: %w", err)
		}
	} else if req.CharacterPrompt == "" {
		return fmt.Errorf("character_prompt is required when image_url is not supplied")
	}
	if characterSwapIsExact(*req) {
		return normalizeCharacterSwapExact(req)
	}
	if characterSwapIsLora(*req) {
		return normalizeCharacterSwapLora(req)
	}
	if len(req.ReferenceImageURLs) > characterSwapKeyframeMaxRefs {
		return fmt.Errorf("reference_image_urls accepts at most %d character photos", characterSwapKeyframeMaxRefs)
	}
	for i, ref := range req.ReferenceImageURLs {
		ref = strings.TrimSpace(ref)
		req.ReferenceImageURLs[i] = ref
		if err := validateRestyleURL(ref); err != nil {
			return fmt.Errorf("reference_image_urls: %w", err)
		}
		if err := characterSwapMediaKind(ref, "image"); err != nil {
			return fmt.Errorf("reference_image_urls: %w", err)
		}
	}
	if req.Prompt == "" {
		req.Prompt = characterSwapDefaultVideoPrompt
	}
	if len(req.Prompt) > 4000 || len(req.CharacterPrompt) > 4000 {
		return fmt.Errorf("prompts must be at most 4000 characters")
	}
	if req.Resolution == "" {
		req.Resolution = "768P"
	}
	if _, ok := characterSwapRates[req.Resolution]; !ok {
		return fmt.Errorf("resolution must be 768P or 2K")
	}
	if req.AspectRatio == "" {
		req.AspectRatio = "adaptive"
	}
	if !videoStringIn(req.AspectRatio, "adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16") {
		return fmt.Errorf("unsupported aspect_ratio")
	}
	if req.PromptExpansionMode == "" {
		req.PromptExpansionMode = "disabled"
	}
	if !videoStringIn(req.PromptExpansionMode, "disabled", "fast", "balanced", "quality") {
		return fmt.Errorf("prompt_expansion_mode must be disabled, fast, balanced, or quality")
	}
	if req.Duration < 0 || req.Duration > characterSwapMaxSeconds {
		return fmt.Errorf("duration must be between %d and %d seconds", characterSwapMinSeconds, characterSwapMaxSeconds)
	}
	if req.IncludeAudio != nil && *req.IncludeAudio && !strings.Contains(req.Prompt, "Audio 1") {
		req.Prompt += characterSwapAudioPrompt
	}
	return nil
}

// characterSwapFalResolution maps the public quality tiers onto H3 Max,
// whose top native-plus-refinement tier is 1080P.
func characterSwapFalResolution(resolution string) string {
	if resolution == "2K" {
		return "1080P"
	}
	return resolution
}

func characterSwapUsesAudio(req ServiceUsageRequest) bool {
	return req.IncludeAudio != nil && *req.IncludeAudio
}

// characterSwapPlannedUnits is the number of provider generations the job
// will run: reference clips for the H3 lane, performer passes for the exact
// lane.
func characterSwapPlannedUnits(req ServiceUsageRequest, seconds float64, cuts []float64, chunks []characterSwapChunk) int {
	if characterSwapIsExact(req) {
		return len(planExactChunks(seconds, cuts)) * exactPeople(req)
	}
	return len(chunks)
}

func characterSwapShotCount(chunks []characterSwapChunk) int {
	count := 0
	for _, chunk := range chunks {
		if chunk.ShotStart {
			count++
		}
	}
	return count
}

func characterSwapShotFee(req ServiceUsageRequest, chunks []characterSwapChunk) float64 {
	if !characterSwapPerShot(req, chunks) {
		return 0
	}
	extra := characterSwapShotCount(chunks) - 1
	if extra < 1 {
		return 0
	}
	return math.Round(float64(extra)*characterSwapShotFeeUSD*100) / 100
}

// planCharacterSwapChunks splits the source into shots at detected cuts and
// each shot into equal usable segments of at most 4 s. H3 drifts back toward
// the reference footage the longer a clip runs, so clips stay short, and every
// provider clip is exactly as long as its reference: a lead-in taken from the
// preceding footage of the same shot (a frozen first frame when a clip opens a
// shot) fills the integer duration and is trimmed off again so the model is
// already tracking the motion when the usable part begins. Cuts are therefore
// reproduced as hard cuts in the output.
func planCharacterSwapChunks(seconds float64, cuts ...float64) ([]characterSwapChunk, error) {
	if seconds < characterSwapMinSeconds-0.05 {
		return nil, fmt.Errorf("source video must be at least %d seconds", characterSwapMinSeconds)
	}
	if seconds > characterSwapMaxSeconds+0.5 {
		return nil, fmt.Errorf("source video must be at most %d seconds; trim it first", characterSwapMaxSeconds)
	}
	seconds = math.Min(seconds, characterSwapMaxSeconds)
	bounds := []float64{0}
	for _, cut := range cuts {
		if cut-bounds[len(bounds)-1] >= characterSwapMinShot && seconds-cut >= characterSwapMinShot {
			bounds = append(bounds, cut)
		}
	}
	bounds = append(bounds, seconds)
	chunks := make([]characterSwapChunk, 0, 16)
	for b := 0; b+1 < len(bounds); b++ {
		shotStart, shotLen := bounds[b], bounds[b+1]-bounds[b]
		count := int(math.Ceil(shotLen / characterSwapSegmentSeconds))
		if count < 1 {
			count = 1
		}
		length := shotLen / float64(count)
		for i := 0; i < count; i++ {
			duration := int(math.Ceil(length + characterSwapLeadSeconds - 1e-6))
			if duration < characterSwapMinSeconds {
				duration = characterSwapMinSeconds
			}
			if duration > characterSwapChunkSeconds {
				duration = characterSwapChunkSeconds
			}
			chunks = append(chunks, characterSwapChunk{
				Index: len(chunks), Start: shotStart + float64(i)*length, Length: length,
				Duration: duration, Lead: float64(duration) - length, ShotStart: i == 0,
			})
		}
	}
	return chunks, nil
}

// detectCharacterSwapCuts lists hard-cut timestamps using ffmpeg's scene
// score. A detection failure just yields no cuts.
func detectCharacterSwapCuts(ctx context.Context, path string) []float64 {
	binary := strings.TrimSpace(os.Getenv("FFMPEG_BIN"))
	if binary == "" {
		binary = "ffmpeg"
	}
	cmd := exec.CommandContext(ctx, binary, "-loglevel", "info", "-i", path, "-vf",
		fmt.Sprintf("scale=320:-2,select='gt(scene,%.2f)',showinfo", characterSwapCutThreshold), "-an", "-f", "null", "-")
	var diagnostics bytes.Buffer
	cmd.Stderr = &diagnostics
	_ = cmd.Run()
	var cuts []float64
	for _, line := range strings.Split(diagnostics.String(), "\n") {
		if !strings.Contains(line, "showinfo") || !strings.Contains(line, "pts_time:") {
			continue
		}
		rest := line[strings.Index(line, "pts_time:")+len("pts_time:"):]
		field := strings.Fields(rest)
		if len(field) == 0 {
			continue
		}
		if at, err := strconv.ParseFloat(field[0], 64); err == nil && at > 0 {
			cuts = append(cuts, at)
		}
	}
	return cuts
}

func characterSwapProviderUSD(resolution string, chunks []characterSwapChunk) float64 {
	rate := characterSwapRates[resolution]
	total := 0.0
	for _, chunk := range chunks {
		total += rate * float64(chunk.Duration)
	}
	return total
}

func characterSwapChargeUSD(resolution string, seconds float64) float64 {
	return math.Ceil(characterSwapPriceRates[resolution]*math.Max(seconds, characterSwapMinSeconds)*100) / 100
}

func characterSwapEstimate(req ServiceUsageRequest, seconds float64, cuts ...float64) (float64, float64, []characterSwapChunk, error) {
	if characterSwapIsLora(req) {
		return loraEstimate(req, seconds, cuts)
	}
	chunks, err := planCharacterSwapChunks(seconds, cuts...)
	if err != nil {
		return 0, 0, nil, err
	}
	charged := characterSwapChargeUSD(req.Resolution, math.Min(seconds, characterSwapMaxSeconds)) + characterSwapShotFee(req, chunks) + characterSwapLipSyncMaxFee(req, chunks)
	if characterSwapIsExact(req) {
		charged = exactChargeUSD(req.Resolution, math.Min(seconds, characterSwapMaxSeconds), exactPeople(req))
	}
	if req.ImageURL == "" {
		charged += servicePricesUSD["gpt_image"]
	}
	credits := 0.0
	if price := getCUTEPriceUSD(); price > 0 {
		credits = math.Ceil(charged / price)
	}
	return charged, credits, chunks, nil
}

func handleCharacterSwapEstimate(ctx *fasthttp.RequestCtx) {
	if _, err := videoJobUser(ctx); err != nil {
		jsonError(ctx, http.StatusUnauthorized, "invalid credentials")
		return
	}
	var req ServiceUsageRequest
	if err := json.Unmarshal(ctx.PostBody(), &req); err != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	if err := normalizeCharacterSwapRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if characterSwapIsRecast(req) {
		handleRecastEstimate(ctx, req)
		return
	}
	seconds, cuts, err := probeRemoteVideo(req.VideoURL)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not read the source video duration")
		return
	}
	usd, credits, chunks, err := characterSwapEstimate(req, seconds, cuts...)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if characterSwapIsLora(req) {
		jsonResponse(ctx, http.StatusOK, loraEstimateResponse(req, usd, credits, seconds, chunks))
		return
	}
	shots := characterSwapShotCount(chunks)
	generation := 50 * len(chunks)
	if characterSwapPerShot(req, chunks) && shots > 1 {
		generation += 60 * ((shots + characterSwapShotSlots - 1) / characterSwapShotSlots)
	}
	if characterSwapScoreAvailable() {
		generation += 25 * len(chunks)
	}
	if characterSwapLipSyncRequested(req) {
		generation += 30 * len(chunks)
	}
	if characterSwapIsExact(req) {
		exactChunks := planExactChunks(seconds, cuts)
		passes := len(exactChunks) * exactPeople(req)
		generation = 120 + int(60*math.Ceil(seconds/float64(len(exactChunks))))*((passes+exactPassSlots-1)/exactPassSlots)
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{
			"estimated_cost_usd": usd, "estimated_credits": credits, "kind": characterSwapExactKind,
			"source_seconds": math.Round(seconds*100) / 100, "shots": shots, "chunks": passes, "people": exactPeople(req),
			"resolution": req.Resolution, "image_included": req.ImageURL == "", "image_cost_usd": servicePricesUSD["gpt_image"],
			"rate_usd_per_second_per_character": exactPriceRates[req.Resolution], "estimated_generation_seconds": generation,
		})
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"estimated_cost_usd": usd, "estimated_credits": credits,
		"source_seconds": math.Round(seconds*100) / 100, "chunks": len(chunks), "shots": shots,
		"resolution": req.Resolution, "image_included": req.ImageURL == "",
		"image_cost_usd": servicePricesUSD["gpt_image"], "rate_usd_per_second": characterSwapPriceRates[req.Resolution],
		"per_shot_frames": characterSwapPerShot(req, chunks), "keyframe_model": characterSwapKeyframeModel, "lipsync": characterSwapLipSyncRequested(req), "lipsync_max_fee_usd": characterSwapLipSyncMaxFee(req, chunks), "shot_fee_usd": characterSwapShotFee(req, chunks), "shot_fee_unit_usd": characterSwapShotFeeUSD,
		"audio_reference": characterSwapUsesAudio(req), "estimated_generation_seconds": generation,
	})
}

func handleCharacterSwapService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if err := normalizeCharacterSwapRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if characterSwapIsRecast(req) {
		handleCharacterRecastService(ctx, req, user)
		return
	}
	lora := characterSwapIsLora(req)
	if lora {
		if characterSwapLoraEndpointID() == "" {
			jsonError(ctx, http.StatusServiceUnavailable, "character swap LoRA is not configured")
			return
		}
		if rejectArchivedLane(ctx, characterSwapLoraEndpointID()) {
			return
		}
	} else if falAPIKey == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "character swap video is not configured")
		return
	}
	seconds, cuts, err := probeRemoteVideo(req.VideoURL)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not read the source video; supply a public MP4/WebM URL")
		return
	}
	estimatedUSD, estimatedCredits, chunks, err := characterSwapEstimate(req, seconds, cuts...)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if !user.UnlimitedAPI && user.Credits < estimatedCredits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: this swap needs about %.0f credits ($%.2f)", estimatedCredits, estimatedUSD))
		return
	}
	state := characterSwapState{
		Request: req, Stage: "frame", SourceSeconds: seconds, Chunks: chunks, Cuts: cuts,
		EstimatedUSD: estimatedUSD, EstimatedCredits: estimatedCredits, ShotFeeUSD: characterSwapShotFee(req, chunks),
	}
	if req.ImageURL != "" {
		state.Stage = "video"
		state.SwappedImageURL = req.ImageURL
	} else {
		imageUSD := servicePricesUSD["gpt_image"]
		if lora {
			imageUSD = loraImageUSD()
		}
		imageCredits := 0.0
		if price := getCUTEPriceUSD(); price > 0 {
			imageCredits = math.Ceil(imageUSD / price)
		}
		if !user.UnlimitedAPI {
			if _, err := dbConn.DeductUserCredits(user.ID, imageCredits); err != nil {
				jsonError(ctx, http.StatusPaymentRequired, "insufficient credits for the GPT Image 2 character frame")
				return
			}
			state.ImageCredits = imageCredits
			state.ImageUSD = imageUSD
		}
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:character-swap", characterSwapService, req.Prompt)
	if err != nil {
		refundCharacterSwapImage(user.ID, state)
		jsonError(ctx, http.StatusInternalServerError, "failed to create character swap job")
		return
	}
	if err := persistCharacterSwapState(job.ID, "queued", state); err != nil {
		refundCharacterSwapImage(user.ID, state)
		jsonError(ctx, http.StatusInternalServerError, "failed to persist character swap job")
		return
	}
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": characterSwapService,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID, "stage": state.Stage,
		},
		"estimated_cost_usd": estimatedUSD, "estimated_credits": estimatedCredits,
		"source_seconds": math.Round(seconds*100) / 100, "chunks": characterSwapPlannedUnits(req, seconds, cuts, chunks), "shots": characterSwapShotCount(chunks), "kind": strings.TrimSpace(req.Kind),
		"settlement": "final price based on generated seconds",
	})
}

func refundCharacterSwapImage(userID string, state characterSwapState) {
	if state.ImageCredits > 0 {
		_, _ = dbConn.AddUserCredits(userID, state.ImageCredits)
	}
}

func readCharacterSwapState(job *VideoJob) (characterSwapState, error) {
	var envelope characterSwapEnvelope
	if err := json.Unmarshal(job.Result, &envelope); err != nil {
		return characterSwapState{}, err
	}
	if envelope.State.Request.VideoURL == "" {
		return characterSwapState{}, fmt.Errorf("saved character swap request is invalid")
	}
	return envelope.State, nil
}

func persistCharacterSwapState(jobID, status string, state characterSwapState) error {
	persisted, _ := json.Marshal(characterSwapEnvelope{State: state})
	return dbConn.UpdateVideoJob(jobID, status, persisted, "")
}

func failCharacterSwap(job *VideoJob, state characterSwapState, refundImage bool, message string) {
	if refundImage {
		refundCharacterSwapImage(job.UserID, state)
	}
	log.Printf("[character-swap] job=%s failed: %s", job.ID, message)
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, message)
}

func processCharacterSwapJob(job *VideoJob) {
	state, err := readCharacterSwapState(job)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved character swap request is invalid")
		return
	}
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil || user == nil {
		failCharacterSwap(job, state, true, "job owner not found")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), characterSwapJobTimeout)
	defer cancel()
	workDir, err := os.MkdirTemp("", "character-swap-")
	if err != nil {
		failCharacterSwap(job, state, true, "could not allocate scratch space")
		return
	}
	defer os.RemoveAll(workDir)

	_ = persistCharacterSwapState(job.ID, "processing", state)
	sourcePath := filepath.Join(workDir, "source.mp4")
	if err := downloadURLToFile(ctx, state.Request.VideoURL, sourcePath); err != nil {
		failCharacterSwap(job, state, true, "could not download the source video")
		return
	}

	if characterSwapIsRecast(state.Request) {
		processCharacterRecast(ctx, job, user, &state, sourcePath, workDir)
		return
	}

	if state.SwappedImageURL == "" {
		if state.FrameURL == "" {
			framePath := filepath.Join(workDir, "frame.png")
			frameAt := "0"
			if state.SourceSeconds > 4 {
				frameAt = "2"
			}
			if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", frameAt, "-i", sourcePath, "-frames:v", "1", "-update", "1", framePath); err != nil {
				failCharacterSwap(job, state, true, "could not extract the first frame")
				return
			}
			frameURL, err := uploadCharacterSwapFile(ctx, framePath, job.UserID, "image/png")
			if err != nil {
				failCharacterSwap(job, state, true, "could not store the reference frame")
				return
			}
			state.FrameURL = frameURL
			state.Stage = "image"
			_ = persistCharacterSwapState(job.ID, "processing", state)
		}
		if videoJobCancellationRequested(job.ID) {
			refundCharacterSwapImage(job.UserID, state)
			return
		}
		var swapped string
		var err error
		if characterSwapIsLora(state.Request) {
			frameW, frameH := loraFrameSize(filepath.Join(workDir, "frame.png"))
			var engine string
			swapped, engine, err = generateLoraCharacterImage(user, state, frameW, frameH)
			if err == nil {
				loraImageFallbackTopUp(user, &state, engine)
			}
		} else {
			swapped, err = generateCharacterSwapImage(user, state)
		}
		if err != nil {
			failCharacterSwap(job, state, true, "GPT Image 2 could not produce the character frame: "+truncateString(err.Error(), 160))
			return
		}
		state.SwappedImageURL = swapped
		state.Stage = "video"
		_ = persistCharacterSwapState(job.ID, "processing", state)
	}

	if videoJobCancellationRequested(job.ID) {
		return
	}
	if characterSwapIsLora(state.Request) {
		outputURL, outputPath, err := processCharacterSwapLora(ctx, job, &state, sourcePath, workDir)
		if err != nil {
			if err.Error() == "cancelled" {
				return
			}
			failCharacterSwap(job, state, false, err.Error())
			return
		}
		settleCharacterSwap(job, state, outputURL, outputPath)
		return
	}
	if len(state.Chunks) == 0 {
		planned, err := planCharacterSwapChunks(state.SourceSeconds, state.Cuts...)
		if err != nil {
			failCharacterSwap(job, state, false, err.Error())
			return
		}
		state.Chunks = planned
	}
	if characterSwapIsExact(state.Request) {
		outputURL, outputPath, err := processCharacterSwapExact(ctx, job, user, &state, sourcePath, workDir)
		if err != nil {
			failCharacterSwap(job, state, false, err.Error())
			return
		}
		settleCharacterSwap(job, state, outputURL, outputPath)
		return
	}
	infos := characterSwapShotInfos(ctx, job, &state, sourcePath, workDir)
	if characterSwapPerShot(state.Request, state.Chunks) {
		state.Stage = "shots"
		_ = persistCharacterSwapState(job.ID, "processing", state)
		redrawCharacterSwapShots(ctx, job, user, &state, sourcePath, workDir, infos)
		if videoJobCancellationRequested(job.ID) {
			return
		}
		state.Stage = "video"
		_ = persistCharacterSwapState(job.ID, "processing", state)
	}
	if len(state.IdentityURLs) == 0 && state.SwappedImageURL != "" {
		state.IdentityURLs = characterSwapIdentityRefs(ctx, job, state.SwappedImageURL, workDir)
		_ = persistCharacterSwapState(job.ID, "processing", state)
	}
	if err := prepareCharacterSwapChunks(ctx, job, &state, sourcePath, workDir); err != nil {
		failCharacterSwap(job, state, false, err.Error())
		return
	}
	if err := runCharacterSwapChunks(ctx, job, &state, sourcePath, workDir); err != nil {
		failCharacterSwap(job, state, false, err.Error())
		return
	}
	if videoJobCancellationRequested(job.ID) {
		return
	}
	state.Stage = "mux"
	_ = persistCharacterSwapState(job.ID, "processing", state)
	outputPath, err := muxCharacterSwapVideo(ctx, state, sourcePath, workDir)
	if err != nil {
		failCharacterSwap(job, state, false, "could not assemble the final video: "+truncateString(err.Error(), 200))
		return
	}
	state.FinalMetrics = characterSwapFinalMetrics(ctx, job, state, sourcePath, outputPath, workDir)
	outputURL, err := publishFinalVideo(ctx, outputPath, job.UserID, func() (string, error) {
		return uploadCharacterSwapFile(ctx, outputPath, job.UserID, "video/mp4")
	})
	if err != nil {
		failCharacterSwap(job, state, false, "could not publish the final video")
		return
	}
	settleCharacterSwap(job, state, outputURL, outputPath)
}

// characterSwapFinalMetrics scores the assembled video; when scoring is skipped
// or fails the result still says so, with the reason, and the job logs it.
func characterSwapFinalMetrics(ctx context.Context, job *VideoJob, state characterSwapState, sourcePath, outputPath, workDir string) map[string]interface{} {
	if reason := characterSwapScoreSkipReason(); reason != "" {
		log.Printf("[character-swap] job=%s final metrics skipped: %s", job.ID, reason)
		return map[string]interface{}{"available": false, "reason": reason}
	}
	report, err := runCharacterSwapScore(ctx, sourcePath, outputPath, characterSwapScoreRefs(ctx, state, workDir), workDir)
	if err != nil {
		log.Printf("[character-swap] job=%s final metrics failed: %v", job.ID, err)
		return map[string]interface{}{"available": false, "reason": truncateString(err.Error(), 200)}
	}
	public := report.publicResult()
	m := report.summary()
	log.Printf("[character-swap] job=%s final metrics overall %.1f pose %.2f framing %.0f identity %.0f lipsync %.0f bg %.1f", job.ID, m.Overall, m.Pose, m.Framing, m.Identity, m.Lipsync, m.BGDrift)
	return public
}

func generateCharacterSwapImage(user *User, state characterSwapState) (string, error) {
	prompt := state.Request.CharacterPrompt
	if prompt == "" {
		prompt = state.Request.Prompt
	}
	req := ServiceUsageRequest{Service: "image_edit", Prompt: prompt, ImageURL: state.FrameURL, Width: 1536, Height: 1024}
	result, err := proxyOpenPathsImageEdit(req)
	if err != nil {
		return "", err
	}
	result, saved := persistGeneratedZImage(req, user, result)
	if hosted := characterSwapHostedImage(result, saved); hosted != "" {
		return hosted, nil
	}
	return "", fmt.Errorf("no hosted image was returned")
}

// characterSwapHostedImage returns the durable https URL of a persisted image
// edit: the gallery copy written by persistGeneratedZImage when the provider
// answered with base64, otherwise a hosted URL from the provider payload.
func characterSwapHostedImage(result []byte, saved *GeneratedImage) string {
	if saved != nil && saved.FilePath != "" {
		return fmt.Sprintf("https://%s/%s/%s", r2PublicHost, strings.TrimSuffix(r2PathPrefix, "/"), strings.TrimLeft(saved.FilePath, "/"))
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(result, &payload); err == nil {
		if saved, _ := payload["saved_image_url"].(string); strings.HasPrefix(saved, "https://") {
			return saved
		}
	}
	for _, candidate := range extractPayloadImageURLs(result) {
		if strings.HasPrefix(candidate, "https://") {
			return candidate
		}
	}
	return ""
}

// characterSwapIdentityRefs cuts a face close-up and a full-body crop of every
// character out of the swapped frame. H3 Max holds a likeness far better
// (joint error 0.12 vs 0.16, recognisable face in close-ups) when each
// character also has its own close-up reference next to the scene frame.
func characterSwapIdentityRefs(ctx context.Context, job *VideoJob, swappedURL, workDir string) []string {
	path := filepath.Join(workDir, "identity-source.png")
	if err := downloadURLToFile(ctx, swappedURL, path); err != nil {
		return nil
	}
	res, err := runExactHelper(ctx, "personcrops", "--image", path, "--out-dir", workDir)
	if err != nil {
		log.Printf("[character-swap] job=%s identity crops skipped: %v", job.ID, err)
		return nil
	}
	people, _ := res["people"].([]interface{})
	var faces, bodies []string
	for _, raw := range people {
		p, _ := raw.(map[string]interface{})
		if face, _ := p["face"].(string); face != "" {
			if u, err := uploadCharacterSwapFile(ctx, face, job.UserID, "image/png"); err == nil {
				faces = append(faces, u)
			}
		}
		if body, _ := p["body"].(string); body != "" {
			if u, err := uploadCharacterSwapFile(ctx, body, job.UserID, "image/png"); err == nil {
				bodies = append(bodies, u)
			}
		}
	}
	refs := append(faces, bodies...)
	if len(refs) > 6 {
		refs = refs[:6]
	}
	return refs
}

func prepareCharacterSwapChunks(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) error {
	useAudio := characterSwapUsesAudio(state.Request)
	for i := range state.Chunks {
		chunk := &state.Chunks[i]
		if chunk.SourceURL != "" && (!useAudio || chunk.AudioURL != "") {
			continue
		}
		chunkPath := filepath.Join(workDir, fmt.Sprintf("chunk-%02d.mp4", chunk.Index))
		audioPath := filepath.Join(workDir, fmt.Sprintf("chunk-%02d.mp3", chunk.Index))
		var args []string
		if chunk.Index == 0 || chunk.ShotStart {
			args = []string{"-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start), "-i", sourcePath, "-t", trimSeconds(chunk.Length), "-an",
				"-vf", fmt.Sprintf("fps=24,scale='min(1920,iw)':-2,tpad=start_duration=%s:start_mode=clone,format=yuv420p", trimSeconds(chunk.Lead))}
		} else {
			args = []string{"-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start - chunk.Lead), "-i", sourcePath, "-t", trimSeconds(float64(chunk.Duration)), "-an",
				"-vf", "fps=24,scale='min(1920,iw)':-2,format=yuv420p"}
		}
		args = append(args, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-movflags", "+faststart", chunkPath)
		if err := lofiloop.RunFFmpeg(ctx, args...); err != nil {
			return fmt.Errorf("could not cut the source into reference clips")
		}
		sourceURL, err := uploadCharacterSwapFile(ctx, chunkPath, job.UserID, "video/mp4")
		if err != nil {
			return fmt.Errorf("could not store a reference clip")
		}
		chunk.SourceURL = sourceURL
		if useAudio {
			if err := characterSwapChunkAudio(ctx, *chunk, sourcePath, audioPath); err == nil {
				if audioURL, err := uploadCharacterSwapFile(ctx, audioPath, job.UserID, "audio/mpeg"); err == nil {
					chunk.AudioURL = audioURL
				}
			}
		}
		chunk.Status = "prepared"
	}
	return persistCharacterSwapState(job.ID, "processing", *state)
}

// characterSwapBackgroundClause pins the shot's measured wall colour for H3,
// which otherwise drifts to dark studio walls (6 of 10 shots on the rap test).
// It must stay positive: "never introduce a dark studio wall" made 4 of 4
// clips go dark (dE 43-70), while "the wall is bright orange (#B35420) in every
// frame" kept 8 of 8 at dE 4-12.
func characterSwapBackgroundClause(background string) string {
	if background == "" {
		return " The background and lighting are exactly those of Video 1 and Image 1 in every frame, from the first frame to the last."
	}
	return fmt.Sprintf(" The background wall is %s in every frame, the same flat evenly lit colour as in Video 1 and Image 1, from the first frame to the last.", background)
}

func characterSwapFalInput(state characterSwapState, chunk characterSwapChunk) map[string]interface{} {
	images := []string{state.SwappedImageURL}
	prompt := state.Request.Prompt + characterSwapBackgroundClause(chunk.Background)
	keyframe := chunk.ShotImage != "" && chunk.ShotImage != state.SwappedImageURL
	if keyframe {
		images = []string{chunk.ShotImage}
		prompt = characterSwapKeyframeLead + prompt
	}
	if len(state.IdentityURLs) > 0 && !keyframe {
		first := len(images) + 1
		images = append(images, state.IdentityURLs...)
		prompt = fmt.Sprintf("Images %d to %d are close-up identity references for the characters, left to right (faces first, then full bodies): keep each character's exact face, hair, skin, build and outfit in every frame, including close-ups. ", first, len(images)) + prompt
	}
	if chunk.PrevFrame != "" {
		images = append(images, chunk.PrevFrame)
		prompt = fmt.Sprintf("Image %d is the exact frame immediately before this clip begins: the first frame must continue seamlessly from Image %d with the same framing, camera distance, poses and lighting, then keep following Video 1. ", len(images), len(images)) + prompt
	}
	input := map[string]interface{}{
		"prompt":                prompt,
		"reference_image_urls":  images,
		"reference_video_urls":  []string{chunk.SourceURL},
		"duration":              chunk.Duration,
		"resolution":            characterSwapFalResolution(state.Request.Resolution),
		"aspect_ratio":          state.Request.AspectRatio,
		"prompt_expansion_mode": state.Request.PromptExpansionMode,
		"enable_safety_checker": true,
	}
	if chunk.AudioURL != "" {
		input["reference_audio_urls"] = []string{chunk.AudioURL}
	}
	if state.Request.Seed != 0 {
		input["seed"] = state.Request.Seed + chunk.Index
	}
	return input
}

// runCharacterSwapChunks renders the clips in order: each clip receives its
// shot keyframe and, inside a shot, the last usable frame of the previous clip
// as references. Every clip is vision-checked for source performers leaking
// through and scored by the metrics CLI against its source segment; clips under
// the threshold are regenerated up to twice and the best attempt by combined
// score is kept. Weak close-ups can then get an optional lip-sync pass.
func runCharacterSwapChunks(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) error {
	persist := func() { _ = persistCharacterSwapState(job.ID, "processing", *state) }
	generate := func(chunk characterSwapChunk, seed int) (string, error) {
		input := characterSwapFalInput(*state, chunk)
		if seed != 0 {
			input["seed"] = seed
		}
		data, _, err := callFalQueue(http.MethodPost, "https://queue.fal.run/"+characterSwapFalPath, input)
		if err != nil {
			return "", fmt.Errorf("video service rejected clip %d", chunk.Index+1)
		}
		var queued falQueueResponse
		if err := json.Unmarshal(data, &queued); err != nil || queued.RequestID == "" {
			return "", fmt.Errorf("video service returned no job for clip %d", chunk.Index+1)
		}
		state.Chunks[chunk.Index].RequestID = queued.RequestID
		state.Chunks[chunk.Index].Status = "queued"
		persist()
		outputURL, err := waitCharacterSwapChunk(ctx, job.ID, queued.RequestID)
		if err != nil {
			return "", fmt.Errorf("clip %d: %w", chunk.Index+1, err)
		}
		state.Chunks[chunk.Index].ProviderUSD += characterSwapRates[state.Request.Resolution] * float64(chunk.Duration)
		return outputURL, nil
	}
	scoreSkip := characterSwapScoreSkipReason()
	scoring := scoreSkip == ""
	if !scoring {
		log.Printf("[character-swap] job=%s per-clip metrics skipped: %s", job.ID, scoreSkip)
	}
	threshold := characterSwapScoreMin()
	var refs []string
	if scoring {
		refs = characterSwapScoreRefs(ctx, *state, workDir)
	}
	tags := 0
	evaluate := func(chunk characterSwapChunk, outputURL, path string) *characterSwapAttempt {
		qaState := *state
		if chunk.ShotImage != "" {
			qaState.SwappedImageURL = chunk.ShotImage
		}
		attempt := &characterSwapAttempt{URL: outputURL, Path: path}
		if characterSwapQAEnabled() {
			attempt.Leaked, attempt.Reason = checkCharacterSwapClip(ctx, qaState, path)
			if attempt.Leaked {
				attempt.LeakCount = characterSwapLeakCount(attempt.Reason)
			}
		}
		if scoring {
			tags++
			if srcSeg, outSeg, err := characterSwapClipSegments(ctx, chunk, sourcePath, path, workDir, fmt.Sprintf("t%d", tags)); err != nil {
				log.Printf("[character-swap] job=%s clip %d metrics skipped: segment cut failed: %v", job.ID, chunk.Index+1, err)
			} else {
				report, err := runCharacterSwapScore(ctx, srcSeg, outSeg, refs, workDir)
				if err != nil {
					log.Printf("[character-swap] job=%s clip %d metrics skipped: %v", job.ID, chunk.Index+1, err)
				} else {
					metrics := report.summary()
					attempt.Metrics, attempt.Report = &metrics, report
					attempt.Score = characterSwapClipScore(metrics.Overall, attempt.Leaked, attempt.LeakCount, metrics.BGDrift)
				}
				_ = os.Remove(outSeg)
			}
		}
		return attempt
	}
	logAttempt := func(chunk characterSwapChunk, n int, a characterSwapAttempt) {
		gate := a.gate(threshold)
		if gate == "" {
			gate = "pass"
		}
		leak := "no"
		if a.Leaked {
			leak = fmt.Sprintf("yes(%d)", a.LeakCount)
		}
		if a.Metrics == nil {
			log.Printf("[character-swap] job=%s clip %d/%d shot attempt %d no-metrics leak=%s gate=%s", job.ID, chunk.Index+1, len(state.Chunks), n, leak, gate)
			return
		}
		m := a.Metrics
		log.Printf("[character-swap] job=%s clip %d/%d attempt %d score %.1f overall %.1f pose %.2f frame %.0f id %.0f lip %.0f bg %.1f leak=%s gate=%s", job.ID, chunk.Index+1, len(state.Chunks), n, a.Score, m.Overall, m.Pose, m.Framing, m.Identity, m.Lipsync, m.BGDrift, leak, gate)
	}
	for i := range state.Chunks {
		if videoJobCancellationRequested(job.ID) {
			return fmt.Errorf("cancelled")
		}
		chunk := state.Chunks[i]
		if chunk.OutputURL != "" && chunk.Status == "completed" {
			continue
		}
		if i > 0 && !chunk.ShotStart && chunk.PrevFrame == "" {
			prev := state.Chunks[i-1]
			prevPath := prev.LocalPath
			if info, err := os.Stat(prevPath); prevPath == "" || err != nil || info.Size() == 0 {
				prevPath = filepath.Join(workDir, fmt.Sprintf("out-%02d.mp4", prev.Index))
				if err := downloadURLToFile(ctx, prev.OutputURL, prevPath); err != nil {
					prevPath = ""
				}
			}
			framePath := filepath.Join(workDir, fmt.Sprintf("prev-%02d.png", chunk.Index))
			at := prev.Lead + prev.Length - 1.0/24
			if prevPath != "" {
				if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(at), "-i", prevPath, "-frames:v", "1", "-update", "1", framePath); err == nil {
					if frameURL, err := uploadCharacterSwapFile(ctx, framePath, job.UserID, "image/png"); err == nil {
						chunk.PrevFrame = frameURL
						state.Chunks[i].PrevFrame = frameURL
					}
				}
			}
		}
		outputURL, err := generate(chunk, 0)
		if err != nil {
			return err
		}
		localPath := filepath.Join(workDir, fmt.Sprintf("out-%02d.mp4", chunk.Index))
		if err := downloadURLToFile(ctx, outputURL, localPath); err != nil {
			return fmt.Errorf("clip %d could not be downloaded", chunk.Index+1)
		}
		state.Chunks[i].Status = "checking"
		persist()
		chosen := *evaluate(chunk, outputURL, localPath)
		logAttempt(chunk, 1, chosen)
		attempts, kept := 1, 1
		for retry := 1; !chosen.acceptable(threshold) && retry <= characterSwapMaxRetries && !videoJobCancellationRequested(job.ID); retry++ {
			log.Printf("[character-swap] job=%s clip %d regenerating: %s", job.ID, chunk.Index+1, chosen.gate(threshold))
			retryURL, err := generate(chunk, int(time.Now().UnixNano()%2_000_000_000)+chunk.Index+retry)
			if err != nil {
				break
			}
			state.Chunks[i].Retries++
			persist()
			retryPath := filepath.Join(workDir, fmt.Sprintf("out-%02d-retry%d.mp4", chunk.Index, retry))
			if err := downloadURLToFile(ctx, retryURL, retryPath); err != nil {
				continue
			}
			attempts++
			candidate := evaluate(chunk, retryURL, retryPath)
			logAttempt(chunk, attempts, *candidate)
			if candidate.better(chosen) {
				chosen, kept = *candidate, attempts
			}
		}
		lipNote := ""
		chosen, lipNote = characterSwapMaybeLipSync(ctx, job, state, chunk, chosen, sourcePath, workDir, func(c characterSwapChunk, path string) (*characterSwapAttempt, bool) {
			return evaluate(c, "", path), true
		})
		reason := chosen.describe()
		if attempts > 1 {
			reason = fmt.Sprintf("kept attempt %d of %d: %s", kept, attempts, reason)
		}
		if chosen.Metrics != nil && chosen.Metrics.Pose > characterSwapPoseFlagLimit() {
			state.Chunks[i].Flagged = true
			reason += fmt.Sprintf("; flagged: pose error %.2f stays above %.2f", chosen.Metrics.Pose, characterSwapPoseFlagLimit())
		}
		if lipNote != "" {
			reason += "; " + lipNote
		}
		state.Chunks[i].OutputURL = chosen.URL
		state.Chunks[i].LocalPath = chosen.Path
		state.Chunks[i].Status = "completed"
		state.Chunks[i].Attempts = attempts
		state.Chunks[i].Metrics = chosen.Metrics
		state.Chunks[i].QAReason = strings.TrimPrefix(reason, "; ")
		persist()
	}
	return nil
}

func waitCharacterSwapChunk(ctx context.Context, jobID, requestID string) (string, error) {
	return waitFalVideoResult(ctx, jobID, characterSwapFalRequestBase, requestID, characterSwapChunkTimeout)
}

// muxCharacterSwapVideo trims each clip's lead-in, normalises the clips to
// 1280x720 at 24 fps, joins them with short crossfades across the boundaries
// (the lead-in tail of the next clip provides the overlap), and lays the
// untouched original soundtrack back over the result.
func muxCharacterSwapVideo(ctx context.Context, state characterSwapState, sourcePath, workDir string) (string, error) {
	characterSwapRenderSlots <- struct{}{}
	defer func() { <-characterSwapRenderSlots }()
	args := []string{"-y", "-loglevel", "error"}
	var filter strings.Builder
	xf := characterSwapCrossfade
	for i, chunk := range state.Chunks {
		clipPath := chunk.LocalPath
		if info, err := os.Stat(clipPath); clipPath == "" || err != nil || info.Size() == 0 {
			clipPath = filepath.Join(workDir, fmt.Sprintf("out-%02d.mp4", chunk.Index))
			if err := downloadURLToFile(ctx, chunk.OutputURL, clipPath); err != nil {
				return "", fmt.Errorf("download clip %d: %w", chunk.Index+1, err)
			}
		}
		args = append(args, "-i", clipPath)
		trimStart, keep := chunk.Lead, chunk.Length
		if i > 0 && !chunk.ShotStart {
			trimStart -= xf
			keep += xf
		}
		if trimStart < 0 {
			trimStart = 0
		}
		fmt.Fprintf(&filter, "[%d:v]trim=start=%s,setpts=PTS-STARTPTS,fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,tpad=stop_mode=clone:stop_duration=1,trim=duration=%s,setpts=PTS-STARTPTS,settb=AVTB,format=yuv420p[v%d];",
			i, trimSeconds(trimStart), trimSeconds(keep), i)
	}
	if len(state.Chunks) == 1 {
		filter.WriteString("[v0]null[v]")
	} else {
		elapsed := state.Chunks[0].Length
		prev := "v0"
		for i := 1; i < len(state.Chunks); i++ {
			next := fmt.Sprintf("x%d", i)
			if i == len(state.Chunks)-1 {
				next = "v"
			}
			if state.Chunks[i].ShotStart {
				fmt.Fprintf(&filter, "[%s][v%d]concat=n=2:v=1:a=0[%s];", prev, i, next)
			} else {
				fmt.Fprintf(&filter, "[%s][v%d]xfade=transition=fade:duration=%s:offset=%s[%s];", prev, i, trimSeconds(xf), trimSeconds(elapsed-xf), next)
			}
			elapsed += state.Chunks[i].Length
			prev = next
		}
	}
	graph := strings.TrimSuffix(filter.String(), ";")
	args = append(args, "-i", sourcePath, "-filter_complex", graph,
		"-map", "[v]", "-map", fmt.Sprintf("%d:a:0?", len(state.Chunks)),
		"-t", trimSeconds(state.SourceSeconds),
		"-c:v", "libx264", "-preset", "medium", "-crf", "19", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", "24",
		"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2", "-movflags", "+faststart",
		filepath.Join(workDir, "final.mp4"))
	if err := lofiloop.RunFFmpeg(ctx, args...); err != nil {
		return "", err
	}
	return filepath.Join(workDir, "final.mp4"), nil
}

func settleCharacterSwap(job *VideoJob, state characterSwapState, outputURL, outputPath string) {
	redrawn := 0
	for _, chunk := range state.Chunks {
		if chunk.ShotStart && chunk.ShotImage != "" && chunk.ShotImage != state.SwappedImageURL {
			redrawn++
		}
	}
	state.ShotFeeUSD = math.Round(float64(redrawn)*characterSwapShotFeeUSD*100) / 100
	lipSeconds, lipClips, flagged := 0.0, 0, []int{}
	providerUSD, retries := state.ShotImageUSD, 0
	for _, chunk := range state.Chunks {
		providerUSD += chunk.ProviderUSD + chunk.LipSyncUSD
		retries += chunk.Retries
		if chunk.LipSynced {
			lipSeconds += chunk.Length
			lipClips++
		}
		if chunk.Flagged {
			flagged = append(flagged, chunk.Index)
		}
	}
	lipFee := characterSwapLipSyncFee(lipSeconds)
	chargedUSD := characterSwapChargeUSD(state.Request.Resolution, state.SourceSeconds) + state.ShotFeeUSD + lipFee
	if characterSwapIsLora(state.Request) {
		chargedUSD = loraChargeUSD(state.Request, state.SourceSeconds)
	}
	if state.Exact != nil {
		chargedUSD = exactChargeUSD(state.Request.Resolution, state.SourceSeconds, state.Exact.People)
		for _, pass := range state.Exact.Passes {
			providerUSD += pass.ProviderUSD
		}
	}
	if state.ChargeUSD > 0 {
		chargedUSD = state.ChargeUSD
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	duration, _ := lofiloop.ProbeDurationSeconds(context.Background(), outputPath)
	result := map[string]interface{}{
		"_character_swap":   state,
		"video_url":         outputURL,
		"swapped_image_url": state.SwappedImageURL,
		"frame_url":         state.FrameURL,
		"stage":             "completed",
		"duration_seconds":  math.Round(duration*100) / 100,
		"chunks":            len(state.Chunks),
		"clip_retries":      retries,
		"cuts":              state.Cuts,
		"kind":              strings.TrimSpace(state.Request.Kind),
		"shots":             characterSwapShotCount(state.Chunks),
		"per_shot_frames":   characterSwapPerShot(state.Request, state.Chunks),
		"shot_fee_usd":      state.ShotFeeUSD,
		"audio_reference":   characterSwapUsesAudio(state.Request),
		"flagged_clips":     flagged,
		"lipsync_clips":     lipClips,
		"lipsync_fee_usd":   lipFee,
		"resolution":        state.Request.Resolution,
		"fps":               24,
		"format":            finalVideoFormat(outputURL),
		"provider_cost_usd": providerUSD,
		"charged_usd":       chargedUSD,
		"image_charged_usd": state.ImageUSD,
		"cute_price_usd":    cutePrice,
		"credits_used":      chargedUSD/cutePrice + state.ImageCredits,
	}
	if state.FinalMetrics != nil {
		result["metrics"] = state.FinalMetrics
	} else {
		result["metrics"] = map[string]interface{}{"available": false, "reason": "objective metrics are not computed on this lane"}
	}
	if state.Exact != nil {
		result["people"] = state.Exact.People
		result["pose_error"] = state.Exact.PoseError
		result["pose_bad_fraction"] = state.Exact.PoseBad
		result["chunks"] = len(state.Exact.Passes)
	}
	payload, _ := json.Marshal(result)
	_, _, err := dbConn.SettleGeneratedVideoJob(job.ID, payload, providerUSD, chargedUSD, cutePrice)
	if err == ErrVideoPaymentRequired {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release the completed video; $%.2f required", chargedUSD))
		return
	}
	if err != nil {
		log.Printf("[character-swap] settlement failed job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, payload)
	maybeTriggerAutoTopup(job.UserID)
}

// retryCharacterSwapJob re-queues a failed swap. Completed clips are kept in
// the persisted state, so only the missing clips and the final assembly run
// again.
func retryCharacterSwapJob(job *VideoJob) error {
	state, err := readCharacterSwapState(job)
	if err != nil {
		return err
	}
	if err := persistCharacterSwapState(job.ID, "queued", state); err != nil {
		return err
	}
	launchVideoJob(job.ID)
	return nil
}

func exposePublicCharacterSwapStatus(payload map[string]interface{}) {
	internal, ok := payload["_character_swap"].(map[string]interface{})
	if !ok {
		return
	}
	if stage, ok := internal["stage"].(string); ok && stage != "" {
		if _, exists := payload["stage"]; !exists {
			payload["stage"] = stage
		}
	}
	for _, key := range []string{"swapped_image_url", "frame_url"} {
		if value, ok := internal[key].(string); ok && strings.HasPrefix(value, "https://") {
			payload[key] = value
		}
	}
	if exact, ok := internal["exact"].(map[string]interface{}); ok {
		if passes, ok := exact["passes"].([]interface{}); ok && len(passes) > 0 {
			done := 0
			for _, raw := range passes {
				if pass, ok := raw.(map[string]interface{}); ok && pass["status"] == "completed" {
					done++
				}
			}
			payload["chunks_total"] = len(passes)
			payload["chunks_completed"] = done
			if people, ok := exact["people"].(float64); ok {
				payload["people"] = int(people)
			}
			return
		}
	}
	if chunks, ok := internal["chunks"].([]interface{}); ok {
		done := 0
		for _, raw := range chunks {
			if chunk, ok := raw.(map[string]interface{}); ok && chunk["status"] == "completed" {
				done++
			}
		}
		payload["chunks_total"] = len(chunks)
		payload["chunks_completed"] = done
	}
}

func uploadCharacterSwapFile(ctx context.Context, path, userID, contentType string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	if info.Size() <= 0 || info.Size() > characterSwapMaxArtifact {
		return "", fmt.Errorf("artifact size %d is invalid", info.Size())
	}
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	extension := map[string]string{"video/mp4": "mp4", "image/png": "png", "audio/mpeg": "mp3"}[contentType]
	if extension == "" {
		extension = "bin"
	}
	objectKey := fmt.Sprintf("%s/%s/character-swap/%s.%s", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), extension)
	uploadURL, err := presignR2PutObject(objectKey, contentType, 6*60*60)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return "", err
	}
	httpReq.ContentLength = info.Size()
	httpReq.Header.Set("Content-Type", contentType)
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("R2 upload returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func probeRemoteVideo(videoURL string) (float64, []float64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	dir, err := os.MkdirTemp("", "character-swap-probe-")
	if err != nil {
		return 0, nil, err
	}
	defer os.RemoveAll(dir)
	path := filepath.Join(dir, "probe.mp4")
	if err := downloadURLToFile(ctx, videoURL, path); err != nil {
		return 0, nil, err
	}
	seconds, err := lofiloop.ProbeDurationSeconds(ctx, path)
	if err != nil {
		return 0, nil, err
	}
	return seconds, detectCharacterSwapCuts(ctx, path), nil
}

var characterSwapImageExtensions = map[string]bool{
	".avif": true, ".bmp": true, ".gif": true, ".heic": true, ".heif": true,
	".jpeg": true, ".jpg": true, ".png": true, ".tif": true, ".tiff": true, ".webp": true,
}

var characterSwapVideoExtensions = map[string]bool{
	".avi": true, ".m4v": true, ".mkv": true, ".mov": true, ".mp4": true,
	".mpeg": true, ".mpg": true, ".ogv": true, ".webm": true,
}

func characterSwapMediaKind(value, expected string) error {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil {
		return fmt.Errorf("invalid media URL")
	}
	ext := strings.ToLower(path.Ext(parsed.Path))
	if expected == "video" && characterSwapImageExtensions[ext] {
		return fmt.Errorf("expected a video file, got image extension %s", ext)
	}
	if expected == "image" && characterSwapVideoExtensions[ext] {
		return fmt.Errorf("expected an image file, got video extension %s", ext)
	}
	return nil
}

// characterSwapLeakCount parses the "frames [a b c]" prefix written by the QA
// check so retries can keep the least-leaking attempt.
func characterSwapLeakCount(reason string) int {
	start := strings.Index(reason, "[")
	end := strings.Index(reason, "]")
	if start < 0 || end <= start {
		return 0
	}
	return len(strings.Fields(reason[start+1 : end]))
}

func trimSeconds(value float64) string {
	return fmt.Sprintf("%.3f", value)
}
