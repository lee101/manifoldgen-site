package main

// Full-length guided video remakes. Unlike the short-form dramatizer, remake
// mode preserves the source canvas, every detected shot window, total runtime,
// and soundtrack. Vision writes editable per-shot prompts; image editing and
// image-to-video replace only the picture track.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	remakeDefaultMaxShots    = 60
	remakeHardMaxShots       = 80
	remakeMinShotSeconds     = 0.70
	remakeSceneThreshold     = 0.18
	remakeVisionBatch        = 6
	remakeMaxCharacterSheets = 8
	remakeJobDeadline        = 3 * time.Hour
	// Covers boundary detection, DeepSeek vision, assembly, and artifact I/O.
	// Image and motion generation remain itemized separately below.
	remakeAgentUSDPerShot = 0.01
)

type remakeSceneCandidate struct {
	Time  float64
	Score float64
}

type remakeVisionShot struct {
	ID                string   `json:"id"`
	VisualDescription string   `json:"visual_description"`
	Action            string   `json:"action"`
	Camera            string   `json:"camera"`
	Lighting          string   `json:"lighting"`
	Environment       string   `json:"environment"`
	Emotion           string   `json:"emotion"`
	Continuity        string   `json:"continuity"`
	ImagePrompt       string   `json:"image_prompt"`
	MotionPrompt      string   `json:"motion_prompt"`
	Characters        []string `json:"characters,omitempty"`
	VisibleTraits     []string `json:"visible_traits"`
	RemoveArtifacts   []string `json:"remove_artifacts"`
}

// RemakeReferenceAsset is a reusable visual anchor generated before any shot.
// Setting boards control production design; character sheets control identity.
type RemakeReferenceAsset struct {
	ID          string   `json:"id"`
	Kind        string   `json:"kind"`
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	ImageURL    string   `json:"image_url,omitempty"`
	ShotIDs     []string `json:"shot_ids,omitempty"`
	Error       string   `json:"error,omitempty"`
}

// RemakeEstimate is the public, server-authoritative preflight shown in the
// tool and retained on the durable account job. RepairImages is a reserve: the
// final settlement includes only repairs and motion clips that actually ran.
type RemakeEstimate struct {
	Exact            bool    `json:"exact"`
	ShotCount        int     `json:"shot_count"`
	Duration         float64 `json:"duration_seconds"`
	BaseImages       int     `json:"base_images"`
	ReferenceImages  int     `json:"reference_images"`
	RepairImages     int     `json:"repair_images"`
	TotalImages      int     `json:"total_images"`
	MotionClips      int     `json:"motion_clips"`
	MotionSeconds    int     `json:"motion_billable_seconds"`
	ImageUnitUSD     float64 `json:"image_unit_usd"`
	ImageUSD         float64 `json:"image_cost_usd"`
	ReferenceUSD     float64 `json:"reference_cost_usd"`
	RepairUSD        float64 `json:"repair_reserve_usd"`
	MotionUnitUSD    float64 `json:"motion_unit_usd_per_second"`
	MotionUSD        float64 `json:"motion_cost_usd"`
	AgentUSD         float64 `json:"agent_cost_usd"`
	EstimatedCostUSD float64 `json:"estimated_cost_usd"`
	EstimatedCredits float64 `json:"estimated_credits"`
	Settlement       string  `json:"settlement"`
}

type remakeVisionReply struct {
	Shots []remakeVisionShot `json:"shots"`
}

var remakeMetadataLine = regexp.MustCompile(`^frame:[^ ]+\s+pts:[^ ]+\s+pts_time:([0-9.]+)`)

func normalizeRemakeRequest(req *dramatizeRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.SettingPrompt = strings.TrimSpace(req.SettingPrompt)
	req.CharacterBible = strings.TrimSpace(req.CharacterBible)
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	if req.Prompt == "" {
		return fmt.Errorf("an overall remake goal is required")
	}
	if len(req.Prompt) > 6000 {
		return fmt.Errorf("the remake goal must be 6000 characters or fewer")
	}
	if len(req.SettingPrompt) > 4000 {
		return fmt.Errorf("the setting prompt must be 4000 characters or fewer")
	}
	if len(req.CharacterBible) > 12000 {
		return fmt.Errorf("the character bible must be 12000 characters or fewer")
	}
	// Reuse the hardened URL and local-development validation.
	base := *req
	base.Mode = ""
	base.MaxShots = 1
	base.Seconds = 2
	if err := normalizeDramatizeRequest(&base); err != nil {
		return err
	}
	if req.MaxShots <= 0 {
		req.MaxShots = remakeDefaultMaxShots
	}
	if req.MaxShots > remakeHardMaxShots {
		req.MaxShots = remakeHardMaxShots
	}
	if req.Seconds < 0 || req.Seconds > dramatizeMaxSourceSeconds {
		return fmt.Errorf("source duration must be between 0 and %d seconds", dramatizeMaxSourceSeconds)
	}
	if _, ok := allowedImageModels[req.ImageModel]; !ok || !allowedImageModels[req.ImageModel].edit {
		req.ImageModel = "gpt-image-2"
	}
	if req.VisionModel == "" {
		req.VisionModel = remakeLunaModel
	}
	if req.VideoModel == "" {
		req.VideoModel = "minimax/h3-max/image-to-video"
	}
	if req.ConsistentCharacters && req.ConsistencyPasses <= 0 {
		req.ConsistencyPasses = remakeDefaultConsistencyPasses
	}
	if req.ConsistencyPasses > remakeMaxConsistencyPasses {
		req.ConsistencyPasses = remakeMaxConsistencyPasses
	}
	req.Mode = "remake"
	return nil
}

func remakeRequestedVideoSeconds(seconds float64) float64 {
	// H3 Max accepts whole-second 5-15s requests. The generated clip is trimmed
	// back to the sub-five-second source window during assembly.
	return math.Min(15, math.Max(5, math.Ceil(seconds)))
}

func remakeShotUSD(shot DramatizeShot) float64 {
	imageSpec, ok := allowedImageModels[shot.ImageModel]
	if !ok {
		imageSpec = allowedImageModels["nano-banana-2"]
	}
	perSecond := videoModelPricesPerSecondUSD[shot.VideoModel]
	if perSecond <= 0 {
		perSecond = videoModelPricesPerSecondUSD["minimax/h3-max/image-to-video"]
	}
	return imageSpec.usd + perSecond*remakeRequestedVideoSeconds(shot.Seconds)*downstreamVideoPriceMultiplier
}

func remakeCharacterCount(bible string, consistent bool, shotCount int) int {
	if !consistent {
		return 0
	}
	count := 0
	for _, line := range strings.Split(strings.TrimSpace(bible), "\n") {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	if count == 0 {
		// With no explicit bible the agent may still discover recurring people.
		count = min(remakeMaxCharacterSheets, max(1, min(4, shotCount)))
	}
	return min(remakeMaxCharacterSheets, count)
}

func remakeEstimateForDurations(req dramatizeRequest, durations []float64, exact bool) RemakeEstimate {
	imageSpec, ok := allowedImageModels[req.ImageModel]
	if !ok {
		imageSpec = allowedImageModels["gpt-image-2"]
	}
	perSecond := videoModelPricesPerSecondUSD[req.VideoModel]
	if perSecond <= 0 {
		perSecond = videoModelPricesPerSecondUSD["minimax/h3-max/image-to-video"]
	}
	motionUnit := perSecond * downstreamVideoPriceMultiplier
	duration, motionSeconds := 0.0, 0
	for _, seconds := range durations {
		duration += seconds
		motionSeconds += int(remakeRequestedVideoSeconds(seconds))
	}
	shots := len(durations)
	characters := remakeCharacterCount(req.CharacterBible, req.ConsistentCharacters, shots)
	references := characters
	if req.SettingPrompt != "" {
		references++
	}
	repairs := characters * req.ConsistencyPasses
	estimate := RemakeEstimate{
		Exact: exact, ShotCount: shots, Duration: duration,
		BaseImages: shots, ReferenceImages: references, RepairImages: repairs,
		TotalImages: shots + references + repairs, MotionClips: shots, MotionSeconds: motionSeconds,
		ImageUnitUSD: imageSpec.usd, MotionUnitUSD: motionUnit,
		Settlement: "final charge includes generated references, successful replacement clips, and identity repairs that actually ran",
	}
	estimate.ImageUSD = float64(shots) * imageSpec.usd
	estimate.ReferenceUSD = float64(references) * allowedImageModels["gpt-image-2"].usd
	estimate.RepairUSD = float64(repairs) * imageSpec.usd
	estimate.MotionUSD = float64(motionSeconds) * motionUnit
	estimate.AgentUSD = float64(shots) * remakeAgentUSDPerShot
	estimate.EstimatedCostUSD = estimate.ImageUSD + estimate.ReferenceUSD + estimate.RepairUSD + estimate.MotionUSD + estimate.AgentUSD
	estimate.EstimatedCredits = usdToCredits(estimate.EstimatedCostUSD)
	return estimate
}

func remakeProvisionalEstimate(req dramatizeRequest) RemakeEstimate {
	seconds := req.Seconds
	if seconds <= 0 {
		seconds = math.Min(dramatizeMaxSourceSeconds, float64(req.MaxShots)*1.5)
	}
	shots := min(req.MaxShots, max(1, int(math.Ceil(seconds/1.5))))
	durations := make([]float64, shots)
	for i := range durations {
		durations[i] = seconds / float64(shots)
	}
	return remakeEstimateForDurations(req, durations, false)
}

func remakeEstimateForBoundaries(req dramatizeRequest, boundaries []float64) RemakeEstimate {
	durations := make([]float64, 0, max(0, len(boundaries)-1))
	for i := 0; i+1 < len(boundaries); i++ {
		durations = append(durations, math.Max(0, boundaries[i+1]-boundaries[i]))
	}
	return remakeEstimateForDurations(req, durations, true)
}

func remakeEstimateUSD(req dramatizeRequest) float64 {
	return remakeProvisionalEstimate(req).EstimatedCostUSD
}

// handleVideoRemakeEstimate detects real boundaries without invoking Luna or
// any paid image/video model. It lets the customer approve an itemized ceiling
// before the durable account job is created.
func handleVideoRemakeEstimate(ctx *fasthttp.RequestCtx) {
	if _, err := videoJobUser(ctx); err != nil {
		jsonError(ctx, http.StatusUnauthorized, "invalid credentials")
		return
	}
	var req dramatizeRequest
	if err := json.Unmarshal(ctx.PostBody(), &req); err != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid remake estimate request")
		return
	}
	req.Mode = "remake"
	if err := normalizeRemakeRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	workDir, err := os.MkdirTemp("", "remake-estimate-")
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not allocate estimate workspace")
		return
	}
	defer os.RemoveAll(workDir)
	source := filepath.Join(workDir, "source.mp4")
	if err := fetchDramatizeSource(requestCtx, req.VideoURL, source); err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not read source video: "+err.Error())
		return
	}
	probe, err := probeVideoFile(requestCtx, source)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, "could not inspect source video")
		return
	}
	if probe.Duration > dramatizeMaxSourceSeconds {
		jsonError(ctx, http.StatusBadRequest, fmt.Sprintf("source is %.1fs; remakes accept up to %ds", probe.Duration, dramatizeMaxSourceSeconds))
		return
	}
	boundaries, err := detectRemakeBoundaries(requestCtx, source, probe.Duration, req.MaxShots)
	if err != nil {
		jsonError(ctx, http.StatusServiceUnavailable, "shot detection failed")
		return
	}
	estimate := remakeEstimateForBoundaries(req, boundaries)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"estimate": estimate})
}

func remakeRenderedUSD(shots []dramatizeShotResult, references []RemakeReferenceAsset) float64 {
	total := remakeAgentUSDPerShot * float64(len(shots))
	for _, reference := range references {
		if reference.Error == "" && strings.TrimSpace(reference.ImageURL) != "" {
			total += allowedImageModels["gpt-image-2"].usd
		}
	}
	for _, shot := range shots {
		if shot.Error == "" && strings.TrimSpace(shot.ClipURL) != "" {
			total += remakeShotUSD(shot.Shot)
			if spec, ok := allowedImageModels[shot.Shot.ImageModel]; ok {
				total += float64(shot.Regenerations) * spec.usd
			}
		}
	}
	return total
}

func processVideoRemakeJob(job *VideoJob, state *dramatizeJobState) {
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil || user == nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "remake owner no longer exists")
		return
	}
	state.Steps, state.Step = nil, 0
	ctx, cancel := context.WithTimeout(activeVideoJobContext(job.ID), remakeJobDeadline)
	defer cancel()
	workDir, err := os.MkdirTemp("", "remake-"+job.ID+"-")
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "could not allocate remake scratch space")
		return
	}
	defer os.RemoveAll(workDir)

	if err := runVideoRemakeAgent(ctx, job, user, state, workDir); err != nil {
		if !videoJobWasCancelled(job.ID) {
			_ = dbConn.UpdateVideoJob(job.ID, "failed", state.marshal(), err.Error())
		}
		return
	}
	chargedUSD := remakeRenderedUSD(state.Shots, state.References)
	state.ChargedUSD, state.CreditsUsed = chargedUSD, usdToCredits(chargedUSD)
	result := state.marshal()
	if _, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, chargedUSD, chargedUSD, getCUTEPriceUSD()); err != nil {
		message := "settlement unavailable; retry status"
		if err == ErrVideoPaymentRequired {
			message = fmt.Sprintf("top up to release the finished remake; $%.2f required", chargedUSD)
		}
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, message)
		return
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
}

func runVideoRemakeAgent(ctx context.Context, job *VideoJob, user *User, state *dramatizeJobState, workDir string) error {
	started := state.begin(job.ID, "detect", "Detecting and coalescing shot boundaries")
	sourcePath := filepath.Join(workDir, "source.mp4")
	if err := fetchDramatizeSource(ctx, state.Request.VideoURL, sourcePath); err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	probe, err := probeVideoFile(ctx, sourcePath)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	if probe.Duration > dramatizeMaxSourceSeconds {
		return fmt.Errorf("source is %.1fs; remakes accept up to %ds", probe.Duration, dramatizeMaxSourceSeconds)
	}
	boundaries, err := detectRemakeBoundaries(ctx, sourcePath, probe.Duration, state.Request.MaxShots)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Estimate = remakeEstimateForBoundaries(state.Request, boundaries)
	frameTimes := make([]float64, len(boundaries)-1)
	for i := range frameTimes {
		frameTimes[i] = (boundaries[i] + boundaries[i+1]) / 2
	}
	framePaths, err := extractKeyframes(ctx, sourcePath, frameTimes, workDir, 768)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	frames := make([]dramatizeFrame, 0, len(framePaths))
	for i, path := range framePaths {
		blob, readErr := os.ReadFile(path)
		if readErr == nil {
			frames = append(frames, dramatizeFrame{Time: frameTimes[i], Path: path, JPEG: blob, Label: fmt.Sprintf("shot_%03d", i+1)})
		}
	}
	state.finish(job.ID, started, fmt.Sprintf("%d shots across %.3fs at %dx%d", len(frameTimes), probe.Duration, probe.Width, probe.Height))

	started = state.begin(job.ID, "verbalize", "Luna is extracting detailed action, identity, camera, and continuity for every shot")
	shots := buildRemakeShots(boundaries, state.Request, probe)
	visionProvider, visionErr := verbalizeRemakeShots(ctx, state.Request, frames, shots)
	if visionErr != nil {
		// A vision outage should not throw away a detected timeline. The fallback
		// remains fully renderable and is explicit in the provider label.
		state.Provider = "deterministic fallback"
		for i := range shots {
			fallbackRemakePrompt(&shots[i], state.Request.Prompt)
		}
	} else {
		state.Provider = visionProvider
	}
	styleBible, characterSpecs, harmonized, harmonizeErr := harmonizeRemakePrompts(ctx, state.Request, shots)
	if harmonizeErr == nil {
		shots = harmonized
		state.Provider += " + global Luna harmonizer"
	}
	plan := &DramatizePlan{Title: "Guided video remake", Concept: state.Request.Prompt, Provider: state.Provider, Width: probe.Width, Height: probe.Height, Shots: shots, StyleBible: styleBible, CharacterSpecs: characterSpecs}
	state.Plan = plan
	state.finish(job.ID, started, fmt.Sprintf("%d editable shot prompts from %s", len(shots), state.Provider))

	started = state.begin(job.ID, "references", "Building the shared world board and recurring-character sheets")
	references := buildRemakeReferences(ctx, user, state.Request, shots, frames, styleBible, characterSpecs)
	state.References, plan.References = references, references
	state.ReferenceUSD = remakeReferenceUSD(references)
	ready := 0
	for _, reference := range references {
		if reference.ImageURL != "" && reference.Error == "" {
			ready++
		}
	}
	state.finish(job.ID, started, fmt.Sprintf("%d/%d GPT Image 2 consistency references ready", ready, len(references)))

	started = state.begin(job.ID, "render_frames", fmt.Sprintf("Generating %d multi-reference start frames", len(shots)))
	rendered, err := renderRemakeFrames(ctx, job, user, shots, frames, references)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = rendered
	state.finish(job.ID, started, fmt.Sprintf("%d start frames ready for identity review", len(rendered)))

	started = state.begin(job.ID, "consistency", "Luna is finding and repairing the least-consistent character appearances")
	rendered, audits := refineRemakeConsistency(ctx, user, state.Request, rendered, frames, references)
	state.Shots, state.ConsistencyAudits = rendered, audits
	repairs := 0
	for _, audit := range audits {
		repairs += len(audit.Regenerated)
	}
	state.finish(job.ID, started, fmt.Sprintf("%d bounded identity repairs across %d audit passes", repairs, len(audits)))

	started = state.begin(job.ID, "animate", fmt.Sprintf("Animating %d accepted start frames", len(shots)))
	rendered, err = animateRemakeShots(ctx, rendered)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = rendered
	fallbacks := 0
	for _, shot := range rendered {
		if shot.Error != "" {
			fallbacks++
		}
	}
	state.finish(job.ID, started, fmt.Sprintf("%d replacements ready; %d source fallbacks", len(rendered)-fallbacks, fallbacks))

	started = state.begin(job.ID, "assemble", "Restoring the exact timeline and original soundtrack")
	finalPath := filepath.Join(workDir, "remake.mp4")
	timeline, err := assembleVideoRemake(ctx, sourcePath, rendered, probe, workDir, finalPath)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = timeline
	finalProbe, err := probeVideoFile(ctx, finalPath)
	if err != nil {
		return err
	}
	state.Duration, state.Width, state.Height = finalProbe.Duration, finalProbe.Width, finalProbe.Height
	state.finish(job.ID, started, fmt.Sprintf("%.3fs; source soundtrack remuxed", finalProbe.Duration))

	started = state.begin(job.ID, "publish", "Publishing the remake and editable shot timeline")
	state.VideoURL, err = uploadDramatizeArtifact(ctx, finalPath, user.ID, "video/mp4")
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.ProjectID, state.ProjectURL, err = publishDramatizeStudioProject(ctx, user, plan, timeline, workDir)
	if err != nil {
		state.finish(job.ID, started, "remake published; editable project unavailable: "+err.Error())
		return nil
	}
	state.finish(job.ID, started, "remake and editable shot timeline published")
	return nil
}

func parseRemakeCandidates(raw string) []remakeSceneCandidate {
	lines := strings.Split(raw, "\n")
	var out []remakeSceneCandidate
	var current float64
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if match := remakeMetadataLine.FindStringSubmatch(line); len(match) == 2 {
			current, _ = strconv.ParseFloat(match[1], 64)
			continue
		}
		if strings.HasPrefix(line, "lavfi.scene_score=") {
			score, _ := strconv.ParseFloat(strings.TrimPrefix(line, "lavfi.scene_score="), 64)
			out = append(out, remakeSceneCandidate{Time: current, Score: score})
		}
	}
	return out
}

func coalesceRemakeBoundaries(candidates []remakeSceneCandidate, duration, minGap float64, maxShots int) []float64 {
	if duration <= 0 {
		return nil
	}
	if minGap <= 0 {
		minGap = remakeMinShotSeconds
	}
	if maxShots <= 0 {
		maxShots = remakeDefaultMaxShots
	}
	// Greedy non-maximum suppression keeps the strongest cut around flashes,
	// then restores chronological order.
	sort.SliceStable(candidates, func(i, j int) bool { return candidates[i].Score > candidates[j].Score })
	selected := make([]remakeSceneCandidate, 0, maxShots-1)
	for _, candidate := range candidates {
		if candidate.Time < minGap || duration-candidate.Time < minGap {
			continue
		}
		clear := true
		for _, keep := range selected {
			if math.Abs(keep.Time-candidate.Time) < minGap {
				clear = false
				break
			}
		}
		if clear {
			selected = append(selected, candidate)
			if len(selected) >= maxShots-1 {
				break
			}
		}
	}
	sort.Slice(selected, func(i, j int) bool { return selected[i].Time < selected[j].Time })
	boundaries := []float64{0}
	for _, candidate := range selected {
		boundaries = append(boundaries, candidate.Time)
	}
	return append(boundaries, duration)
}

func detectRemakeBoundaries(ctx context.Context, source string, duration float64, maxShots int) ([]float64, error) {
	filter := fmt.Sprintf("select='gt(scene,%.3f)',metadata=print:file=-", remakeSceneThreshold)
	cmd := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", source, "-filter:v", filter, "-an", "-f", "null", "-")
	blob, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("shot boundary detection: %w", err)
	}
	return coalesceRemakeBoundaries(parseRemakeCandidates(string(blob)), duration, remakeMinShotSeconds, maxShots), nil
}

func buildRemakeShots(boundaries []float64, req dramatizeRequest, probe dramatizeProbe) []DramatizeShot {
	aspect := "16:9"
	if probe.Height > probe.Width {
		aspect = "9:16"
	} else if probe.Height == probe.Width {
		aspect = "1:1"
	}
	shots := make([]DramatizeShot, 0, len(boundaries)-1)
	for i := 0; i+1 < len(boundaries); i++ {
		start, end := boundaries[i], boundaries[i+1]
		shots = append(shots, DramatizeShot{
			ID: fmt.Sprintf("shot_%03d", i+1), Order: i, Kind: dramatizeShotKindRestyled,
			Seconds: end - start, SourceStart: start, SourceEnd: end, SourceFrameTime: (start + end) / 2,
			DirectorNote: req.Prompt, ImageModel: req.ImageModel, VideoModel: req.VideoModel, AspectRatio: aspect,
		})
	}
	return shots
}

func fallbackRemakePrompt(shot *DramatizeShot, goal string) {
	shot.VisualDescription = fmt.Sprintf("Source shot from %.2fs to %.2fs", shot.SourceStart, shot.SourceEnd)
	shot.ImagePrompt = fmt.Sprintf("Preserve the exact composition, characters, pose, camera angle, and lighting of the source frame. Apply this overall art direction: %s", goal)
	shot.MotionPrompt = "Recreate the source shot's camera movement, subject motion, pacing, and continuity. No new cuts."
}

func verbalizeRemakeShots(ctx context.Context, req dramatizeRequest, frames []dramatizeFrame, shots []DramatizeShot) (string, error) {
	byID := make(map[string]*DramatizeShot, len(shots))
	for i := range shots {
		byID[shots[i].ID] = &shots[i]
	}
	provider := req.VisionModel
	useLuna := req.VisionModel == remakeLunaModel && remakeOpenAIKey() != ""
	useGemini := !useLuna && strings.TrimSpace(getEnv("OPENROUTER_API_KEY", "")) == ""
	useXAI := false
	useQwen := false
	if useGemini {
		provider = dramatizeGeminiModel()
	}
	for start := 0; start < len(frames); start += remakeVisionBatch {
		end := min(len(frames), start+remakeVisionBatch)
		var reply *remakeVisionReply
		var err error
		if useLuna {
			reply, err = callRemakeLunaVision(ctx, req, frames[start:end], shots[start:end])
			if err != nil {
				useLuna = false
				useGemini = strings.TrimSpace(getEnv("OPENROUTER_API_KEY", "")) == ""
			}
		}
		if !useLuna && !useGemini {
			reply, err = callRemakeVision(ctx, req, frames[start:end], shots[start:end])
			if err != nil {
				// Restarting the current batch with the configured direct vision
				// provider avoids changing OpenRouter privacy policy at runtime.
				useGemini = true
				provider = dramatizeGeminiModel()
			}
		}
		if useGemini && !useXAI {
			reply, err = callRemakeGeminiVision(ctx, req, frames[start:end], shots[start:end])
			if err != nil {
				useXAI = true
				provider = dramatizeXAIModel()
			}
		}
		if useXAI && !useQwen {
			reply, err = callRemakeXAIVision(ctx, req, frames[start:end], shots[start:end])
			if err != nil {
				useQwen = true
				provider = "qwen/qwen3-vl-32b-instruct"
			}
		}
		if useQwen {
			qwenRequest := req
			qwenRequest.VisionModel = provider
			reply, err = callRemakeVision(ctx, qwenRequest, frames[start:end], shots[start:end])
		}
		if err != nil {
			return "", err
		}
		for _, item := range reply.Shots {
			shot := byID[item.ID]
			if shot == nil {
				continue
			}
			applyRemakeVisionShot(shot, item, req)
		}
	}
	return provider, nil
}

func remakeVisionInstruction(req dramatizeRequest, shots []DramatizeShot) string {
	var windows strings.Builder
	for _, shot := range shots {
		fmt.Fprintf(&windows, "- %s, %.3fs-%.3fs\n", shot.ID, shot.SourceStart, shot.SourceEnd)
	}
	return fmt.Sprintf(`Inspect each attached source frame for a full-length video remake.
Overall goal: %s
World/setting bible: %s
Canonical character bible: %s
The images follow these IDs in order:
%s
Return JSON {"shots":[...]}. For each supplied ID write every required field:
- visual_description: exhaustive literal inventory of subjects, action, spatial relationships, setting, props, framing, lens impression, light, color, and source rendering artifacts.
- action: the exact story beat and what changes during this source window.
- camera: shot size, angle, lens/perspective, camera position, and likely movement.
- lighting: direction, quality, motivation, atmosphere, and palette.
- environment: architecture, terrain, materials, props, technology, weather, and background depth.
- emotion: facial performance, posture, eyeline, interaction, and narrative intention; distinguish grief, crying, fear, resolve, and neutral looking.
- continuity: what must match adjacent shots, including character state, direction of travel, prop position, weather, and emotional progression.
- characters: stable lowercase canonical IDs from the supplied bible; empty for environments. Identify named characters from distinctive evidence, not generic archetypes.
- visible_traits: exact character-specific face, hair, anatomy, costume, palette, proportions, and props visible in this frame.
- remove_artifacts: HUD, subtitles, logos, old-game aliasing, low-poly geometry, painted textures, or accessories that conflict with canon.
- image_prompt: a detailed self-contained image-edit instruction preserving source composition/action while applying the setting, one stable next-generation rendering language, exact character traits, emotion, eyelines, materials, lighting, and shot-specific negatives.
- motion_prompt: precise camera and subject movement, timing, emotional micro-performance, cloth/hair/environment motion, and continuity; no new cuts.
Use exactly the same character ID in every appearance. Do not replace distinctive game characters with generic fantasy archetypes. Only a character whose own canonical entry specifies a horn may have one; never transfer anatomy between identities. For a canonically horned character, distinguish a real forehead horn from any separately specified bow or hair accessory instead of deleting or merging them. Do not merge or omit IDs.`, req.Prompt, firstNonEmpty(req.SettingPrompt, "Infer one coherent setting from the overall goal."), firstNonEmpty(req.CharacterBible, "Identify recurring people with stable descriptive IDs."), windows.String())
}

func callRemakeVision(ctx context.Context, req dramatizeRequest, frames []dramatizeFrame, shots []DramatizeShot) (*remakeVisionReply, error) {
	content := []map[string]interface{}{{"type": "text", "text": remakeVisionInstruction(req, shots)}}
	for i, frame := range frames {
		content = append(content,
			map[string]interface{}{"type": "text", "text": fmt.Sprintf("%s, %.3fs–%.3fs", shots[i].ID, shots[i].SourceStart, shots[i].SourceEnd)},
			map[string]interface{}{"type": "image_url", "image_url": map[string]string{"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(frame.JPEG)}},
		)
	}
	payload := map[string]interface{}{
		"model":           req.VisionModel,
		"messages":        []map[string]interface{}{{"role": "user", "content": content}},
		"temperature":     0.25,
		"response_format": map[string]string{"type": "json_object"},
	}
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(getEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"), "/")+"/chat/completions", bytes.NewReader(mustJSON(payload)))
	request.Header.Set("Authorization", "Bearer "+getEnv("OPENROUTER_API_KEY", ""))
	request.Header.Set("Content-Type", "application/json")
	response, err := backendClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	blob, err := readLimited(response.Body, 2<<20)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("remake vision returned %d: %s", response.StatusCode, tailOutput(blob))
	}
	var envelope struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(blob, &envelope) != nil || len(envelope.Choices) == 0 {
		return nil, fmt.Errorf("remake vision returned no completion")
	}
	var reply remakeVisionReply
	if err := json.Unmarshal([]byte(extractJSONObject(envelope.Choices[0].Message.Content)), &reply); err != nil || len(reply.Shots) == 0 {
		return nil, fmt.Errorf("remake vision returned invalid shot JSON")
	}
	return &reply, nil
}

func callRemakeGeminiVision(ctx context.Context, req dramatizeRequest, frames []dramatizeFrame, shots []DramatizeShot) (*remakeVisionReply, error) {
	key := dramatizeGeminiKey()
	if key == "" {
		return nil, fmt.Errorf("no remake vision provider is configured")
	}
	parts := []map[string]interface{}{{"text": remakeVisionInstruction(req, shots)}}
	for _, frame := range frames {
		parts = append(parts, map[string]interface{}{"inline_data": map[string]string{"mime_type": "image/jpeg", "data": base64.StdEncoding.EncodeToString(frame.JPEG)}})
	}
	payload := map[string]interface{}{
		"contents":         []map[string]interface{}{{"role": "user", "parts": parts}},
		"generationConfig": map[string]interface{}{"temperature": 0.25, "responseMimeType": "application/json"},
	}
	endpoint := fmt.Sprintf("%s/v1beta/models/%s:generateContent", strings.TrimRight(getEnv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"), "/"), dramatizeGeminiModel())
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(mustJSON(payload)))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("x-goog-api-key", key)
	response, err := backendClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	blob, err := readLimited(response.Body, 2<<20)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("gemini remake vision returned %d: %s", response.StatusCode, tailOutput(blob))
	}
	var envelope struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(blob, &envelope) != nil || len(envelope.Candidates) == 0 {
		return nil, fmt.Errorf("gemini remake vision returned no completion")
	}
	var text strings.Builder
	for _, candidate := range envelope.Candidates {
		for _, part := range candidate.Content.Parts {
			text.WriteString(part.Text)
		}
	}
	var reply remakeVisionReply
	if err := json.Unmarshal([]byte(extractJSONObject(text.String())), &reply); err != nil || len(reply.Shots) == 0 {
		return nil, fmt.Errorf("gemini remake vision returned invalid shot JSON")
	}
	return &reply, nil
}

func callRemakeXAIVision(ctx context.Context, req dramatizeRequest, frames []dramatizeFrame, shots []DramatizeShot) (*remakeVisionReply, error) {
	key := dramatizeXAIKey()
	if key == "" {
		return nil, fmt.Errorf("no remake vision provider is configured")
	}
	content := []map[string]interface{}{{"type": "text", "text": remakeVisionInstruction(req, shots)}}
	for _, frame := range frames {
		content = append(content, map[string]interface{}{"type": "image_url", "image_url": map[string]string{"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(frame.JPEG)}})
	}
	payload := map[string]interface{}{
		"model": dramatizeXAIModel(), "messages": []map[string]interface{}{{"role": "user", "content": content}},
		"temperature": 0.25, "response_format": map[string]string{"type": "json_object"},
	}
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.x.ai/v1/chat/completions", bytes.NewReader(mustJSON(payload)))
	request.Header.Set("Authorization", "Bearer "+key)
	request.Header.Set("Content-Type", "application/json")
	response, err := backendClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	blob, err := readLimited(response.Body, 2<<20)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("xai remake vision returned %d: %s", response.StatusCode, tailOutput(blob))
	}
	var envelope struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(blob, &envelope) != nil || len(envelope.Choices) == 0 {
		return nil, fmt.Errorf("xai remake vision returned no completion")
	}
	var reply remakeVisionReply
	if err := json.Unmarshal([]byte(extractJSONObject(envelope.Choices[0].Message.Content)), &reply); err != nil || len(reply.Shots) == 0 {
		return nil, fmt.Errorf("xai remake vision returned invalid shot JSON")
	}
	return &reply, nil
}

func canonicalCharacterID(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	var out strings.Builder
	dash := false
	for _, r := range value {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			out.WriteRune(r)
			dash = false
		} else if out.Len() > 0 && !dash {
			out.WriteByte('-')
			dash = true
		}
	}
	return strings.Trim(out.String(), "-")
}

func normalizeCharacterIDs(values []string) []string {
	seen := map[string]bool{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		id := canonicalCharacterID(value)
		if id != "" && !seen[id] {
			seen[id] = true
			out = append(out, id)
		}
	}
	return out
}

func characterDisplayName(id string) string {
	parts := strings.Split(id, "-")
	for i := range parts {
		if parts[i] != "" {
			parts[i] = strings.ToUpper(parts[i][:1]) + parts[i][1:]
		}
	}
	return strings.Join(parts, " ")
}

func characterBibleDescription(bible, id string) string {
	for _, line := range strings.Split(bible, "\n") {
		line = strings.TrimSpace(line)
		for _, separator := range []string{" — ", " – ", ": ", " - "} {
			if prefix, _, ok := strings.Cut(line, separator); ok && canonicalCharacterID(prefix) == id {
				return line
			}
		}
	}
	return ""
}

func characterHasHorn(description string) bool {
	description = strings.ToLower(description)
	if strings.Contains(description, "no horn") || strings.Contains(description, "without horn") {
		return false
	}
	return strings.Contains(description, "horn")
}

func recurringRemakeCharacters(shots []DramatizeShot) []RemakeReferenceAsset {
	shotsByCharacter := map[string][]string{}
	for _, shot := range shots {
		for _, id := range normalizeCharacterIDs(shot.Characters) {
			shotsByCharacter[id] = append(shotsByCharacter[id], shot.ID)
		}
	}
	assets := make([]RemakeReferenceAsset, 0, len(shotsByCharacter))
	for id, shotIDs := range shotsByCharacter {
		if len(shotIDs) < 2 {
			continue
		}
		assets = append(assets, RemakeReferenceAsset{ID: id, Kind: "character", Name: characterDisplayName(id), ShotIDs: shotIDs})
	}
	sort.Slice(assets, func(i, j int) bool {
		if len(assets[i].ShotIDs) != len(assets[j].ShotIDs) {
			return len(assets[i].ShotIDs) > len(assets[j].ShotIDs)
		}
		return assets[i].ID < assets[j].ID
	})
	if len(assets) > remakeMaxCharacterSheets {
		assets = assets[:remakeMaxCharacterSheets]
	}
	return assets
}

func remakeReferenceUSD(references []RemakeReferenceAsset) float64 {
	var total float64
	for _, reference := range references {
		if reference.Error == "" && reference.ImageURL != "" {
			total += allowedImageModels["gpt-image-2"].usd
		}
	}
	return total
}

func buildRemakeReferences(ctx context.Context, user *User, req dramatizeRequest, shots []DramatizeShot, frames []dramatizeFrame, styleBible RemakeStyleBible, characterSpecs []RemakeCharacterSpec) []RemakeReferenceAsset {
	references := make([]RemakeReferenceAsset, 0, 1+remakeMaxCharacterSheets)
	worldURL := ""
	if req.SettingPrompt != "" {
		world := RemakeReferenceAsset{ID: "world", Kind: "setting", Name: "World style board", Description: req.SettingPrompt}
		styleJSON, _ := json.Marshal(styleBible)
		prompt := fmt.Sprintf("Create one borderless 2x2 cinematic world and production-design reference board for a coherent feature film. Overall direction: %s. Setting bible: %s. Harmonized production bible: %s. Show complementary establishing environments with one unmistakably consistent rendering language, architecture, materials, palette, atmosphere, lighting, and technology level. This board is authoritative for every later shot. No captions, labels, typography, logos, characters, modern objects that conflict with the setting, generic fantasy drift, or alternate art styles.", req.Prompt, req.SettingPrompt, styleJSON)
		blob, err := proxyOpenPathsModelImage(ServiceUsageRequest{Service: "openpaths_image", Model: "gpt-image-2", Prompt: prompt, AspectRatio: "16:9", N: 1})
		if err == nil {
			world.ImageURL, err = extractImageURL(blob)
		}
		if err != nil {
			world.Error = err.Error()
		} else {
			worldURL = world.ImageURL
		}
		references = append(references, world)
	}
	if !req.ConsistentCharacters {
		return references
	}

	characters := recurringRemakeCharacters(shots)
	shotIndex := map[string]int{}
	for i, shot := range shots {
		shotIndex[shot.ID] = i
	}
	for i := range characters {
		select {
		case <-ctx.Done():
			characters[i].Error = ctx.Err().Error()
			continue
		default:
		}
		frameURLs := make([]string, 0, 4)
		for _, shotID := range characters[i].ShotIDs {
			index, ok := shotIndex[shotID]
			if !ok || index >= len(frames) || len(frameURLs) >= 4 {
				continue
			}
			url, err := uploadDramatizeArtifact(ctx, frames[index].Path, user.ID, "image/jpeg")
			if err == nil {
				frameURLs = append(frameURLs, url)
			}
		}
		if len(frameURLs) == 0 {
			characters[i].Error = "no source appearances available for character sheet"
			continue
		}
		refs := append([]string{}, frameURLs[1:]...)
		if worldURL != "" {
			refs = append(refs, worldURL)
		}
		description := characterBibleDescription(req.CharacterBible, characters[i].ID)
		if spec := characterSpecByID(characterSpecs, characters[i].ID); spec != nil {
			if blob, err := json.Marshal(spec); err == nil {
				description = string(blob)
			}
		}
		if description == "" {
			description = "Infer this character's stable identity only from the attached source appearances."
		}
		anatomy := "This character has no horns or horn-like accessories; never borrow anatomy from another identity."
		if characterHasHorn(description) {
			anatomy = "Preserve the explicitly described horn as real anatomy growing from the forehead, never a headband, bow, tiara, jewel, or accessory."
		}
		prompt := fmt.Sprintf("Create a single clean cinematic identity reference sheet for recurring character %q. Use every attached source appearance as evidence for one exact identity; use the world board only for the shared rendering language. Canonical specification: %s. Overall direction: %s. Show the same character in neutral front, three-quarter, profile, back, face close-up, and full-body views. Lock distinctive face geometry, apparent age, hair silhouette and color, body proportions, anatomy, costume cut and construction, material response, exact palette, footwear, and signature props. %s This sheet is authoritative for later multi-reference edits. No generic archetype substitution, alternate identities, alternate costumes, anatomy borrowed from other characters, duplicate people, captions, labels, logos, panels, or sheet borders.", characters[i].Name, description, req.Prompt, anatomy)
		blob, err := proxyOpenPathsModelImage(ServiceUsageRequest{Service: "openpaths_image", Model: "gpt-image-2", Prompt: prompt, ImageURL: frameURLs[0], ReferenceImageURLs: refs, AspectRatio: "16:9", N: 1})
		if err == nil {
			characters[i].ImageURL, err = extractImageURL(blob)
		}
		if err != nil {
			characters[i].Error = err.Error()
		}
	}
	return append(references, characters...)
}

func remakeShotReferenceURLs(shot DramatizeShot, references []RemakeReferenceAsset) []string {
	characters := map[string]bool{}
	for _, id := range normalizeCharacterIDs(shot.Characters) {
		characters[id] = true
	}
	urls := make([]string, 0, 5)
	settingURL := ""
	for _, reference := range references {
		if reference.ImageURL == "" || reference.Error != "" {
			continue
		}
		if reference.Kind == "setting" {
			settingURL = reference.ImageURL
		} else if reference.Kind == "character" && characters[reference.ID] {
			urls = append(urls, reference.ImageURL)
		}
	}
	if len(urls) > 5 {
		urls = urls[:5]
	}
	if settingURL != "" && len(urls) < 5 {
		urls = append(urls, settingURL)
	}
	return urls
}

func renderRemakeFrames(ctx context.Context, job *VideoJob, user *User, shots []DramatizeShot, frames []dramatizeFrame, references []RemakeReferenceAsset) ([]dramatizeShotResult, error) {
	results := make([]dramatizeShotResult, len(shots))
	sem := make(chan struct{}, dramatizeShotConcurrency)
	var wg sync.WaitGroup
	for i, shot := range shots {
		results[i] = dramatizeShotResult{Shot: shot, Duration: shot.Seconds}
		wg.Add(1)
		go func(index int, shot DramatizeShot) {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				results[index].Error = ctx.Err().Error()
				return
			}
			frame := nearestFrame(frames, shot.SourceFrameTime)
			if frame == nil {
				results[index].Error = "no source frame available"
				return
			}
			frameURL, err := uploadDramatizeArtifact(ctx, frame.Path, user.ID, "image/jpeg")
			if err != nil {
				results[index].Error = "publish source frame: " + err.Error()
				return
			}
			prompt := shot.ImagePrompt + " Use the source frame only for composition, pose, action, lens, and staging. Use the attached world board for production design and the attached character sheets as authoritative for exact identity, costume, anatomy, and proportions. Remove source accessories or anatomy that conflict with the character sheet. Do not copy the sheet layout into the shot."
			imageJSON, err := proxyOpenPathsModelImage(ServiceUsageRequest{Service: "openpaths_image", Model: shot.ImageModel, Prompt: prompt, ImageURL: frameURL, ReferenceImageURLs: remakeShotReferenceURLs(shot, references), AspectRatio: shot.AspectRatio, N: 1})
			if err != nil {
				results[index].Error = "restyle frame: " + err.Error()
				return
			}
			imageURL, err := extractImageURL(imageJSON)
			if err != nil {
				results[index].Error = err.Error()
				return
			}
			results[index].ImageURL = imageURL
		}(i, shot)
	}
	wg.Wait()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return results, nil
}

func assembleVideoRemake(ctx context.Context, sourcePath string, shots []dramatizeShotResult, probe dramatizeProbe, workDir, dest string) ([]dramatizeShotResult, error) {
	segmentDir := filepath.Join(workDir, "remake-segments")
	if err := os.MkdirAll(segmentDir, 0o755); err != nil {
		return nil, err
	}
	segments := make([]string, 0, len(shots))
	timeline := make([]dramatizeShotResult, 0, len(shots))
	var cursor float64
	for i, shot := range shots {
		segmentPath := filepath.Join(segmentDir, fmt.Sprintf("seg_%03d.mp4", i))
		if shot.Error == "" && shot.ClipURL != "" {
			raw := filepath.Join(segmentDir, fmt.Sprintf("raw_%03d.mp4", i))
			if err := downloadToFile(ctx, shot.ClipURL, raw); err == nil {
				clipProbe, probeErr := probeVideoFile(ctx, raw)
				if probeErr == nil {
					probeErr = renderSegmentCanvas(ctx, raw, 0, shot.Shot.Seconds, clipProbe.HasAudio, probe.Width, probe.Height, segmentPath)
				}
				if probeErr != nil {
					shot.Error = probeErr.Error()
				}
			} else {
				shot.Error = err.Error()
			}
		}
		if shot.Error != "" || shot.ClipURL == "" {
			// Continuity and duration are more important than hiding a failed API
			// call: put the exact source window back into its original position.
			if err := renderSegmentCanvas(ctx, sourcePath, shot.Shot.SourceStart, shot.Shot.Seconds, true, probe.Width, probe.Height, segmentPath); err != nil {
				return nil, err
			}
		}
		shot.Start, shot.Duration = cursor, shot.Shot.Seconds
		cursor += shot.Shot.Seconds
		shot.AssetURL = segmentPath
		timeline = append(timeline, shot)
		segments = append(segments, segmentPath)
	}
	joined := filepath.Join(workDir, "remake-picture.mp4")
	if err := concatSegments(ctx, segments, joined); err != nil {
		return nil, err
	}
	if err := replaceAudioTrack(ctx, joined, sourcePath, dest, probe.Duration); err != nil {
		return nil, err
	}
	return timeline, nil
}
