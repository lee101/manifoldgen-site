package main

// The video dramatizer: a paid, long-running agent that turns one source clip
// plus a creative brief into a finished vertical edit AND an editable Studio
// project containing every cut as a separate timeline clip.
//
// Pipeline: analyse (probe + audio onsets/beats + keyframes) -> plan (LLM shot
// list) -> generate stills (gpt-image, or gpt-image edits repainting real
// frames) -> animate them (image-to-video) -> assemble (beat-aligned ffmpeg
// cuts, portrait canvas) -> publish (R2 + Studio project).
//
// Progress is written into the job's result_json on every step so the client
// can render a live agent timeline off the existing /api/video-jobs/{id} poll.

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/valyala/fasthttp"
)

const (
	dramatizeServiceName = "video_dramatize"

	// Wall-clock ceiling for one agent run. Generation dominates; a 6-shot plan
	// with a slow provider can legitimately take half an hour.
	dramatizeJobDeadline = 60 * time.Minute
	// How many shots render concurrently. Providers rate-limit, and each shot
	// also costs money, so this stays deliberately low.
	dramatizeShotConcurrency = 3

	dramatizeDefaultShotSeconds = 5
	dramatizeMaxSourceSeconds   = 300
)

// ---------------------------------------------------------------------------
// Request / state
// ---------------------------------------------------------------------------

type dramatizeRequest struct {
	Prompt   string  `json:"prompt"`
	VideoURL string  `json:"video_url"`
	MaxShots int     `json:"max_shots,omitempty"`
	Seconds  float64 `json:"shot_seconds,omitempty"`
}

// dramatizeStep is one entry in the user-visible agent timeline.
type dramatizeStep struct {
	Name    string  `json:"name"`
	Label   string  `json:"label"`
	Status  string  `json:"status"` // running | done | failed
	Detail  string  `json:"detail,omitempty"`
	Elapsed float64 `json:"elapsed_seconds,omitempty"`
}

// dramatizeShotResult records what the executor actually produced per shot.
type dramatizeShotResult struct {
	Shot      DramatizeShot `json:"shot"`
	ImageURL  string        `json:"image_url,omitempty"`
	ClipURL   string        `json:"clip_url,omitempty"`
	AssetURL  string        `json:"asset_url,omitempty"`
	ObjectKey string        `json:"object_key,omitempty"`
	AssetID   string        `json:"asset_id,omitempty"`
	Size      int64         `json:"size,omitempty"`
	Start     float64       `json:"timeline_start"`
	Duration  float64       `json:"duration"`
	Error     string        `json:"error,omitempty"`
}

// dramatizeJobState is what lives in video_jobs.result_json. Fields prefixed
// with an underscore are agent bookkeeping; the rest is the public result.
type dramatizeJobState struct {
	Request dramatizeRequest `json:"_dramatize_request"`

	Step  int             `json:"_agent_step"`
	Label string          `json:"_agent_label"`
	Steps []dramatizeStep `json:"_agent_steps,omitempty"`

	Plan  *DramatizePlan        `json:"plan,omitempty"`
	Audio *AudioAnalysis        `json:"audio,omitempty"`
	Shots []dramatizeShotResult `json:"shots,omitempty"`

	VideoURL   string  `json:"video_url,omitempty"`
	Duration   float64 `json:"duration,omitempty"`
	Width      int     `json:"width,omitempty"`
	Height     int     `json:"height,omitempty"`
	ProjectID  string  `json:"project_id,omitempty"`
	ProjectURL string  `json:"project_url,omitempty"`

	ChargedUSD  float64 `json:"charged_usd,omitempty"`
	CreditsUsed float64 `json:"credits_used,omitempty"`
	Provider    string  `json:"planner,omitempty"`
}

func (s *dramatizeJobState) marshal() []byte {
	blob, err := json.Marshal(s)
	if err != nil {
		return nil
	}
	return blob
}

// begin opens a step and immediately publishes it so the UI reacts at once.
func (s *dramatizeJobState) begin(jobID, name, label string) time.Time {
	s.Step = len(s.Steps) + 1
	s.Label = label
	s.Steps = append(s.Steps, dramatizeStep{Name: name, Label: label, Status: "running"})
	s.publish(jobID)
	return time.Now()
}

func (s *dramatizeJobState) finish(jobID string, started time.Time, detail string) {
	if len(s.Steps) == 0 {
		return
	}
	last := &s.Steps[len(s.Steps)-1]
	last.Status = "done"
	last.Detail = detail
	last.Elapsed = time.Since(started).Seconds()
	s.publish(jobID)
}

func (s *dramatizeJobState) fail(jobID string, started time.Time, detail string) {
	if len(s.Steps) == 0 {
		return
	}
	last := &s.Steps[len(s.Steps)-1]
	last.Status = "failed"
	last.Detail = detail
	last.Elapsed = time.Since(started).Seconds()
	s.publish(jobID)
}

// publish writes the current state to the job row without changing its status.
func (s *dramatizeJobState) publish(jobID string) {
	if err := dbConn.UpdateVideoJob(jobID, "processing", s.marshal(), ""); err != nil {
		log.Printf("dramatize %s: publish progress: %v", jobID, err)
	}
}

// ---------------------------------------------------------------------------
// Pricing and access
// ---------------------------------------------------------------------------

func dramatizeVideoModel() string {
	return strings.TrimSpace(getEnv("DRAMATIZE_VIDEO_MODEL", "ltx-2.3-image-to-video"))
}

// dramatizeShotVideoUSD is the provider cost of animating one still.
func dramatizeShotVideoUSD(seconds float64) float64 {
	if seconds <= 0 {
		seconds = dramatizeDefaultShotSeconds
	}
	perSecond := videoModelPricesPerSecondUSD[dramatizeVideoModel()]
	if perSecond <= 0 {
		perSecond = 0.28
	}
	return perSecond * seconds * downstreamVideoPriceMultiplier
}

// dramatizeEstimateUSD prices a nominal run, used for the up-front balance
// check before the plan exists. The real charge is settled from the plan.
func dramatizeEstimateUSD(maxShots int) float64 {
	generated := maxShots
	if generated <= 0 {
		generated = 3
	}
	// Roughly two thirds of a plan's shots are generated; the rest are free cuts.
	generated = int(math.Ceil(float64(generated) * 2.0 / 3.0))
	imageUSD := servicePricesUSD["gpt_image"] * float64(generated)
	videoUSD := dramatizeShotVideoUSD(dramatizeDefaultShotSeconds) * float64(generated)
	return imageUSD + videoUSD
}

// dramatizePlanUSD prices the plan the agent actually decided to run.
func dramatizePlanUSD(plan *DramatizePlan) float64 {
	if plan == nil {
		return dramatizeEstimateUSD(3)
	}
	var total float64
	for _, shot := range plan.Shots {
		switch shot.Kind {
		case dramatizeShotKindGenerated:
			total += servicePricesUSD["gpt_image"] + dramatizeShotVideoUSD(shot.Seconds)
		case dramatizeShotKindRestyled:
			total += servicePricesUSD["image_edit"] + dramatizeShotVideoUSD(shot.Seconds)
		}
		// Source cuts are pure ffmpeg and cost nothing beyond compute.
	}
	return total
}

// dramatizeRenderedUSD prices generated/restyled shots that produced a clip.
func dramatizeRenderedUSD(shots []dramatizeShotResult) float64 {
	var total float64
	for _, r := range shots {
		if r.Error != "" || strings.TrimSpace(r.ClipURL) == "" {
			continue
		}
		switch r.Shot.Kind {
		case dramatizeShotKindGenerated:
			total += servicePricesUSD["gpt_image"] + dramatizeShotVideoUSD(r.Shot.Seconds)
		case dramatizeShotKindRestyled:
			total += servicePricesUSD["image_edit"] + dramatizeShotVideoUSD(r.Shot.Seconds)
		}
	}
	return total
}

func usdToCredits(usd float64) float64 {
	price := getCUTEPriceUSD()
	if price <= 0 {
		return 0
	}
	return math.Ceil(usd / price)
}

// userHasPaidAccess gates the dramatizer to customers. An active subscription
// or any past top-up qualifies; a free account with promotional credits does
// not, because a full agent run costs real provider money.
func userHasPaidAccess(user *User) bool {
	if user == nil {
		return false
	}
	return user.UnlimitedAPI || user.TotalDeposited > 0
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

func normalizeDramatizeRequest(req *dramatizeRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.VideoURL = strings.TrimSpace(req.VideoURL)
	if req.Prompt == "" {
		return fmt.Errorf("a creative brief is required")
	}
	if len(req.Prompt) > 6000 {
		return fmt.Errorf("the brief must be 6000 characters or fewer")
	}
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	parsed, err := url.Parse(req.VideoURL)
	if err != nil {
		return fmt.Errorf("video_url is not a valid URL")
	}
	// Local files are allowed only in development, where the default sample
	// clip lives on disk. In production the source must be an uploaded asset.
	if parsed.Scheme == "file" || parsed.Scheme == "" {
		if strings.TrimSpace(getEnv("DEV", "")) == "" {
			return fmt.Errorf("video_url must be an https URL")
		}
	} else if parsed.Scheme != "https" {
		return fmt.Errorf("video_url must be an https URL")
	}
	if req.MaxShots <= 0 {
		req.MaxShots = 6
	}
	if req.MaxShots > dramatizeMaxShots {
		req.MaxShots = dramatizeMaxShots
	}
	if req.Seconds <= 0 {
		req.Seconds = dramatizeDefaultShotSeconds
	}
	req.Seconds = clampFloat(req.Seconds, dramatizeMinShotLength, dramatizeMaxShotLength)
	return nil
}

// handleVideoDramatizeService accepts a brief plus a source clip and queues the
// agent. Reached through POST /api/service with service "video-dramatize".
func handleVideoDramatizeService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	input := dramatizeRequest{
		Prompt:   req.Prompt,
		VideoURL: req.VideoURL,
		MaxShots: req.NumImages,
		Seconds:  float64(req.Duration),
	}
	if err := normalizeDramatizeRequest(&input); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	if !userHasPaidAccess(user) {
		jsonError(ctx, http.StatusPaymentRequired,
			"the video dramatizer is available on paid accounts; add credits or start a plan to unlock it")
		return
	}

	estimateUSD := dramatizeEstimateUSD(input.MaxShots)
	credits := usdToCredits(estimateUSD)
	if credits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if user.Credits+1e-9 < credits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf(
			"insufficient credits: need about %.0f credits ($%.2f), have %.2f", credits, estimateUSD, user.Credits))
		return
	}

	// One agent run at a time per account: they are long and expensive.
	if jobs, err := dbConn.ListVideoJobs(user.ID, 100); err == nil {
		for i := range jobs {
			status := strings.ToLower(strings.TrimSpace(jobs[i].Status))
			if jobs[i].Service == dramatizeServiceName && (status == "queued" || status == "processing") {
				jsonError(ctx, http.StatusConflict, "finish the current dramatization before starting another")
				return
			}
		}
	}

	job, err := dbConn.CreateVideoJobForService(user.ID, "agent:"+newUUID(), dramatizeServiceName, input.Prompt)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not queue the dramatization")
		return
	}
	state := dramatizeJobState{Request: input, Label: "Queued"}
	if err := dbConn.UpdateVideoJob(job.ID, "queued", state.marshal(), ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not persist the dramatization request")
		return
	}
	launchVideoJob(job.ID)

	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": "video-dramatize",
		"result": map[string]interface{}{
			"job_id":     job.ID,
			"status":     "queued",
			"status_url": "/api/video-jobs/" + job.ID,
		},
		"estimated_cost_usd": estimateUSD,
		"estimated_credits":  credits,
		"settlement":         "charged on completion from the shot plan the agent runs",
	})
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

func processVideoDramatizeJob(job *VideoJob) {
	var state dramatizeJobState
	if len(job.Result) > 0 {
		_ = json.Unmarshal(job.Result, &state)
	}
	if strings.TrimSpace(state.Request.VideoURL) == "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "dramatization request was not persisted")
		return
	}
	// Restarting mid-run would re-charge for already-generated shots, so a
	// resumed job starts its step log fresh but keeps the original request.
	state.Steps = nil
	state.Step = 0

	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil || user == nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "dramatization owner no longer exists")
		return
	}

	parent := activeVideoJobContext(job.ID)
	ctx, cancel := context.WithTimeout(parent, dramatizeJobDeadline)
	defer cancel()

	workDir, err := os.MkdirTemp("", "dramatize-"+job.ID+"-")
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "could not allocate scratch space")
		return
	}
	defer os.RemoveAll(workDir)

	if err := runDramatizeAgent(ctx, job, user, &state, workDir); err != nil {
		if videoJobWasCancelled(job.ID) {
			return
		}
		state.fail(job.ID, time.Now(), err.Error())
		_ = dbConn.UpdateVideoJob(job.ID, "failed", state.marshal(), err.Error())
		return
	}

	// Settle from shots that actually rendered, not the plan we hoped to run.
	chargedUSD := dramatizeRenderedUSD(state.Shots)
	state.ChargedUSD = chargedUSD
	state.CreditsUsed = usdToCredits(chargedUSD)
	result := state.marshal()

	cutePrice := getCUTEPriceUSD()
	if _, _, settleErr := dbConn.SettleGeneratedVideoJob(job.ID, result, chargedUSD, chargedUSD, cutePrice); settleErr != nil {
		if settleErr == ErrVideoPaymentRequired {
			_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result,
				fmt.Sprintf("top up to release the finished edit; $%.2f required", chargedUSD))
			return
		}
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, "settlement unavailable; retry status")
		return
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
}

// runDramatizeAgent is the agent loop proper. Each stage publishes progress and
// any failure aborts with a message the user can act on.
func runDramatizeAgent(ctx context.Context, job *VideoJob, user *User, state *dramatizeJobState, workDir string) error {
	// --- 1. Ingest and analyse -------------------------------------------
	started := state.begin(job.ID, "analyze", "Analysing the source clip")
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
		err := fmt.Errorf("source clip is %.0fs; the dramatizer accepts up to %ds", probe.Duration, dramatizeMaxSourceSeconds)
		state.fail(job.ID, started, err.Error())
		return err
	}

	var analysis *AudioAnalysis
	if probe.HasAudio {
		opts := DefaultAudioAnalysisOptions()
		if a, audioErr := AnalyzeAudioFile(ctx, sourcePath, opts); audioErr == nil {
			analysis = a
		} else {
			// Beat-aligned cutting is an enhancement, not a requirement.
			log.Printf("dramatize %s: audio analysis unavailable: %v", job.ID, audioErr)
		}
	}
	state.Audio = analysis

	frameTimes := sampleTimes(probe.Duration, 4)
	framePaths, err := extractKeyframes(ctx, sourcePath, frameTimes, workDir, 640)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	frames := make([]dramatizeFrame, 0, len(framePaths))
	for i, path := range framePaths {
		jpeg, readErr := os.ReadFile(path)
		if readErr != nil {
			continue
		}
		frames = append(frames, dramatizeFrame{Time: frameTimes[i], Path: path, JPEG: jpeg})
	}
	detail := fmt.Sprintf("%.1fs, %dx%d", probe.Duration, probe.Width, probe.Height)
	if analysis != nil {
		detail += fmt.Sprintf(", %d beats at %.0f BPM", len(analysis.BeatTimes), analysis.Tempo)
	}
	state.finish(job.ID, started, detail)

	// --- 2. Plan ----------------------------------------------------------
	started = state.begin(job.ID, "plan", "Planning the shot list")
	brief := dramatizeBrief{
		Prompt:   state.Request.Prompt,
		Probe:    probe,
		Audio:    analysis,
		Frames:   frames,
		MaxShots: state.Request.MaxShots,
	}
	plan, err := planDramatization(ctx, brief)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Plan = plan
	state.Provider = plan.Provider
	generated, restyled, source := plan.CountByKind()
	state.finish(job.ID, started, fmt.Sprintf(
		"%s planned %d shots (%d generated, %d restyled, %d source cuts)",
		plan.Provider, len(plan.Shots), generated, restyled, source))

	// --- 3 & 4. Stills and motion ----------------------------------------
	started = state.begin(job.ID, "generate", fmt.Sprintf("Generating %d shots", generated+restyled))
	results, err := renderDramatizeShots(ctx, job, user, plan, frames, workDir)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = results
	ready, failed := 0, 0
	for _, r := range results {
		if r.Error != "" {
			failed++
		} else {
			ready++
		}
	}
	detail = fmt.Sprintf("%d shots ready", ready)
	if failed > 0 {
		detail += fmt.Sprintf(", %d skipped", failed)
	}
	state.finish(job.ID, started, detail)

	// --- 5. Assemble ------------------------------------------------------
	started = state.begin(job.ID, "assemble", "Cutting the edit together")
	finalPath := filepath.Join(workDir, "dramatized.mp4")
	timeline, err := assembleDramatizedEdit(ctx, sourcePath, results, workDir, finalPath)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = timeline
	for _, r := range results {
		if r.Error != "" {
			state.Shots = append(state.Shots, r)
		}
	}
	finalProbe, err := probeVideoFile(ctx, finalPath)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Duration = finalProbe.Duration
	state.Width, state.Height = finalProbe.Width, finalProbe.Height
	state.finish(job.ID, started, fmt.Sprintf("%.1fs across %d clips", finalProbe.Duration, len(timeline)))

	// --- 6. Publish -------------------------------------------------------
	started = state.begin(job.ID, "publish", "Publishing the edit and Studio project")
	videoURL, err := uploadDramatizeArtifact(ctx, finalPath, user.ID, "video/mp4")
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.VideoURL = videoURL

	projectID, projectURL, err := publishDramatizeStudioProject(ctx, user, plan, timeline, workDir)
	if err != nil {
		// The rendered video is still a complete deliverable; surface the edit
		// even if the editable project could not be written.
		log.Printf("dramatize %s: studio project unavailable: %v", job.ID, err)
		state.finish(job.ID, started, "edit published; Studio project unavailable: "+err.Error())
		return nil
	}
	state.ProjectID = projectID
	state.ProjectURL = projectURL
	state.finish(job.ID, started, "edit and editable project published")
	return nil
}

// fetchDramatizeSource copies the source clip into the work directory,
// accepting a local path in development and an https URL otherwise.
func fetchDramatizeSource(ctx context.Context, source, dest string) error {
	trimmed := strings.TrimPrefix(source, "file://")
	if !strings.HasPrefix(trimmed, "http://") && !strings.HasPrefix(trimmed, "https://") {
		info, err := os.Stat(trimmed)
		if err != nil {
			return fmt.Errorf("source clip is not readable: %w", err)
		}
		if info.Size() > dramatizeMaxInputSize {
			return fmt.Errorf("source clip exceeds the %d MiB limit", dramatizeMaxInputSize>>20)
		}
		blob, err := os.ReadFile(trimmed)
		if err != nil {
			return err
		}
		return os.WriteFile(dest, blob, 0o644)
	}
	return downloadToFile(ctx, source, dest)
}

// ---------------------------------------------------------------------------
// Shot rendering
// ---------------------------------------------------------------------------

// renderDramatizeShots fans the generated and restyled shots out across a small
// worker pool. Source cuts need no provider call and pass straight through.
func renderDramatizeShots(
	ctx context.Context,
	job *VideoJob,
	user *User,
	plan *DramatizePlan,
	frames []dramatizeFrame,
	workDir string,
) ([]dramatizeShotResult, error) {
	results := make([]dramatizeShotResult, len(plan.Shots))
	for i, shot := range plan.Shots {
		results[i] = dramatizeShotResult{Shot: shot, Duration: shot.Seconds}
	}

	var (
		wg   sync.WaitGroup
		mu   sync.Mutex
		sem  = make(chan struct{}, dramatizeShotConcurrency)
		done int
	)
	for i := range plan.Shots {
		shot := plan.Shots[i]
		if shot.Kind == dramatizeShotKindSource {
			continue
		}
		wg.Add(1)
		go func(index int, shot DramatizeShot) {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				return
			}

			imageURL, clipURL, err := renderOneDramatizeShot(ctx, user, shot, frames, workDir, index)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				results[index].Error = err.Error()
			} else {
				results[index].ImageURL = imageURL
				results[index].ClipURL = clipURL
			}
			done++
			log.Printf("dramatize %s: shot %s finished (%d/%d)", job.ID, shot.ID, done, len(plan.Shots))
		}(i, shot)
	}
	wg.Wait()

	if ctx.Err() != nil {
		return nil, fmt.Errorf("dramatization was cancelled or timed out")
	}

	// A run is only viable if something renderable survived.
	usable := 0
	failures := []string{}
	for _, r := range results {
		switch {
		case r.Shot.Kind == dramatizeShotKindSource:
			usable++
		case r.Error != "":
			failures = append(failures, fmt.Sprintf("%s: %s", r.Shot.ID, r.Error))
		case r.ClipURL != "":
			usable++
		}
	}
	if usable == 0 {
		return nil, fmt.Errorf("every shot failed to render: %s", strings.Join(failures, "; "))
	}
	if len(failures) > 0 {
		log.Printf("dramatize %s: %d shots failed and were skipped: %s", job.ID, len(failures), strings.Join(failures, "; "))
	}
	return results, nil
}

// renderOneDramatizeShot produces the still and then animates it.
func renderOneDramatizeShot(
	ctx context.Context,
	user *User,
	shot DramatizeShot,
	frames []dramatizeFrame,
	workDir string,
	index int,
) (string, string, error) {
	var (
		imageURL string
		err      error
	)
	if shot.Kind == dramatizeShotKindRestyled {
		frame := nearestFrame(frames, shot.SourceFrameTime)
		if frame == nil {
			return "", "", fmt.Errorf("no source frame available to restyle")
		}
		frameURL, uploadErr := uploadDramatizeArtifact(ctx, frame.Path, user.ID, "image/jpeg")
		if uploadErr != nil {
			return "", "", fmt.Errorf("publish source frame: %w", uploadErr)
		}
		imageURL, err = dramatizeRestyleImage(shot.ImagePrompt, frameURL)
	} else {
		imageURL, err = dramatizeGenerateImage(shot.ImagePrompt)
	}
	if err != nil {
		return "", "", err
	}
	if imageURL == "" {
		return "", "", fmt.Errorf("image generation returned no image")
	}

	clipURL, err := dramatizeAnimateImage(ctx, shot, imageURL)
	if err != nil {
		return imageURL, "", err
	}
	return imageURL, clipURL, nil
}

func nearestFrame(frames []dramatizeFrame, t float64) *dramatizeFrame {
	if len(frames) == 0 {
		return nil
	}
	best := 0
	bestDist := math.Abs(frames[0].Time - t)
	for i := 1; i < len(frames); i++ {
		if d := math.Abs(frames[i].Time - t); d < bestDist {
			best, bestDist = i, d
		}
	}
	return &frames[best]
}

// dramatizeGenerateImage renders a portrait still with GPT Image via OpenPaths.
func dramatizeGenerateImage(prompt string) (string, error) {
	result, err := proxyOpenPathsImageGeneration(ServiceUsageRequest{
		Service: "gpt_image",
		Prompt:  dramatizeStylePrompt(prompt),
		Width:   1024,
		Height:  1536,
		N:       1,
	})
	if err != nil {
		return "", fmt.Errorf("generate still: %w", err)
	}
	return extractImageURL(result)
}

// dramatizeRestyleImage repaints a real frame of the source in the new style,
// which is how live footage is carried into the stylized shots.
func dramatizeRestyleImage(prompt, sourceImageURL string) (string, error) {
	result, err := proxyOpenPathsImageEdit(ServiceUsageRequest{
		Service:  "image_edit",
		Prompt:   dramatizeStylePrompt(prompt),
		ImageURL: sourceImageURL,
		Width:    1024,
		Height:   1536,
		N:        1,
	})
	if err != nil {
		return "", fmt.Errorf("restyle source frame: %w", err)
	}
	return extractImageURL(result)
}

// dramatizeStylePrompt appends the framing constraints every shot shares so the
// planner's prompts stay about content rather than format.
func dramatizeStylePrompt(prompt string) string {
	return strings.TrimSpace(prompt) +
		". Vertical 9:16 composition, cinematic anime style, dynamic camera, high detail, dramatic lighting."
}

// extractImageURL pulls a usable image reference out of the various shapes the
// image backends return, uploading inline base64 payloads when needed.
func extractImageURL(result []byte) (string, error) {
	var payload map[string]interface{}
	if err := json.Unmarshal(result, &payload); err != nil {
		return "", fmt.Errorf("image backend returned invalid JSON: %w", err)
	}
	for _, key := range []string{"saved_image_url", "image_url", "url"} {
		if value, ok := payload[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value), nil
		}
	}
	// OpenAI-compatible: data[0].url or data[0].b64_json.
	if data, ok := payload["data"].([]interface{}); ok && len(data) > 0 {
		if first, ok := data[0].(map[string]interface{}); ok {
			if value, ok := first["url"].(string); ok && strings.TrimSpace(value) != "" {
				return strings.TrimSpace(value), nil
			}
			if b64, ok := first["b64_json"].(string); ok && b64 != "" {
				return uploadInlineImage(b64)
			}
		}
	}
	if b64, ok := payload["image_base64"].(string); ok && b64 != "" {
		return uploadInlineImage(b64)
	}
	return "", fmt.Errorf("image backend response contained no image")
}

// uploadInlineImage persists a base64 image so the video model can fetch it.
func uploadInlineImage(b64 string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return "", fmt.Errorf("decode inline image: %w", err)
	}
	publicURL, _, err := uploadGeneratedImageArtifact(context.Background(), decoded, "", "image/png", "dramatize")
	if err != nil {
		return "", fmt.Errorf("publish inline image: %w", err)
	}
	return publicURL, nil
}

// dramatizeAnimateImage submits an image-to-video job and waits for it. We are
// already inside the job worker, so blocking here is the intended behaviour.
func dramatizeAnimateImage(ctx context.Context, shot DramatizeShot, imageURL string) (string, error) {
	seconds := int(math.Round(shot.Seconds))
	if seconds < 2 {
		seconds = 2
	}
	result, err := proxyOpenPathsVideo(ServiceUsageRequest{
		Service:     "video_generate",
		Model:       dramatizeVideoModel(),
		Prompt:      shot.MotionPrompt,
		ImageURL:    imageURL,
		Duration:    seconds,
		AspectRatio: "9:16",
	})
	if err != nil {
		return "", fmt.Errorf("animate still: %w", err)
	}

	var response openPathsVideoResponse
	if err := json.Unmarshal(result, &response); err != nil {
		return "", fmt.Errorf("video backend returned invalid JSON: %w", err)
	}
	if strings.TrimSpace(response.VideoURL) != "" {
		return response.VideoURL, nil
	}
	if strings.TrimSpace(response.ID) == "" {
		return "", fmt.Errorf("video backend returned neither a video nor a job id")
	}
	return waitForOpenPathsVideo(ctx, response.ID)
}

// waitForOpenPathsVideo polls a queued OpenPaths video job to completion.
func waitForOpenPathsVideo(ctx context.Context, providerID string) (string, error) {
	endpoint := openPathsBaseURL + "/v1/videos/generations/" + url.PathEscape(providerID)
	consecutiveErrors := 0
	for {
		select {
		case <-ctx.Done():
			return "", fmt.Errorf("timed out waiting for shot %s", providerID)
		case <-time.After(3 * time.Second):
		}

		polled, status, err := callOpenPathsVideo(http.MethodGet, endpoint, nil)
		if err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 6 {
				return "", fmt.Errorf("video provider status unavailable: %w", err)
			}
			continue
		}
		consecutiveErrors = 0

		var state openPathsVideoResponse
		_ = json.Unmarshal(polled, &state)
		if status == http.StatusAccepted || (state.Status != "" && isPendingVideoStatus(state.Status)) {
			continue
		}
		if strings.EqualFold(state.Status, "failed") || strings.EqualFold(state.Status, "error") ||
			strings.EqualFold(state.Status, "cancelled") {
			return "", fmt.Errorf("video provider reported %s", state.Status)
		}
		if strings.TrimSpace(state.VideoURL) == "" {
			return "", fmt.Errorf("video provider finished without a video")
		}
		return state.VideoURL, nil
	}
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

// assembleDramatizedEdit normalises every surviving shot to the portrait canvas
// and concatenates them, returning the timeline with real start times and
// durations filled in.
func assembleDramatizedEdit(
	ctx context.Context,
	sourcePath string,
	shots []dramatizeShotResult,
	workDir string,
	dest string,
) ([]dramatizeShotResult, error) {
	segmentDir := filepath.Join(workDir, "segments")
	if err := os.MkdirAll(segmentDir, 0o755); err != nil {
		return nil, err
	}

	timeline := make([]dramatizeShotResult, 0, len(shots))
	segments := make([]string, 0, len(shots))
	var cursor float64

	for i := range shots {
		shot := shots[i]
		if shot.Error != "" {
			continue
		}
		segmentPath := filepath.Join(segmentDir, fmt.Sprintf("seg_%03d.mp4", len(segments)))

		switch shot.Shot.Kind {
		case dramatizeShotKindSource:
			length := shot.Shot.SourceEnd - shot.Shot.SourceStart
			if length <= 0 {
				continue
			}
			if err := renderSegment(ctx, sourcePath, shot.Shot.SourceStart, length, true, segmentPath); err != nil {
				return nil, err
			}
		default:
			if shot.ClipURL == "" {
				continue
			}
			downloaded := filepath.Join(segmentDir, fmt.Sprintf("raw_%03d.mp4", len(segments)))
			if err := downloadToFile(ctx, shot.ClipURL, downloaded); err != nil {
				return nil, fmt.Errorf("fetch generated shot %s: %w", shot.Shot.ID, err)
			}
			clipProbe, err := probeVideoFile(ctx, downloaded)
			if err != nil {
				return nil, err
			}
			if err := renderSegment(ctx, downloaded, 0, shot.Shot.Seconds, clipProbe.HasAudio, segmentPath); err != nil {
				return nil, err
			}
		}

		// Measure rather than trust the plan: providers round durations.
		segProbe, err := probeVideoFile(ctx, segmentPath)
		if err != nil {
			return nil, err
		}
		shot.Start = cursor
		shot.Duration = segProbe.Duration
		cursor += segProbe.Duration

		timeline = append(timeline, shot)
		segments = append(segments, segmentPath)
	}

	if len(segments) == 0 {
		return nil, fmt.Errorf("no renderable segments survived assembly")
	}
	if err := concatSegments(ctx, segments, dest); err != nil {
		return nil, err
	}

	// Keep each normalised segment for the Studio project so every cut is an
	// independently editable clip rather than one flattened render.
	for i := range timeline {
		timeline[i].AssetURL = segments[i]
	}
	return timeline, nil
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

// uploadDramatizeArtifact stores a local file in R2 and returns its public URL.
func uploadDramatizeArtifact(ctx context.Context, path, userID, contentType string) (string, error) {
	blob, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if len(blob) == 0 {
		return "", fmt.Errorf("%s is empty", filepath.Base(path))
	}
	if strings.HasPrefix(contentType, "image/") {
		publicURL, _, uploadErr := uploadGeneratedImageArtifact(ctx, blob, userID, contentType, "dramatize")
		return publicURL, uploadErr
	}
	return uploadH3RunpodVideo(ctx, blob, userID, contentType)
}

// publishDramatizeStudioProject writes every cut into a Studio project so the
// user can open the edit and keep working on it clip by clip.
func publishDramatizeStudioProject(
	ctx context.Context,
	user *User,
	plan *DramatizePlan,
	timeline []dramatizeShotResult,
	workDir string,
) (string, string, error) {
	projectID := uuid.NewString()

	for i := range timeline {
		shot := &timeline[i]
		assetID := uuid.NewString()
		objectKey := studioAssetObjectPrefix(user, projectID, assetID) + fmt.Sprintf("shot_%02d.mp4", i+1)

		publicURL, err := uploadStudioAsset(ctx, shot.AssetURL, objectKey, "video/mp4")
		if err != nil {
			return "", "", fmt.Errorf("upload studio asset %d: %w", i+1, err)
		}
		if info, statErr := os.Stat(shot.AssetURL); statErr == nil {
			shot.Size = info.Size()
		}
		shot.AssetID = assetID
		shot.AssetURL = publicURL
		shot.ObjectKey = objectKey
	}

	blob, err := buildStudioDocument(timeline)
	if err != nil {
		return "", "", err
	}
	if len(blob) > maxStudioProjectDocumentBytes {
		return "", "", fmt.Errorf("studio document is too large")
	}

	name := plan.Title
	if len(name) > 120 {
		name = name[:120]
	}
	if _, err := dbConn.UpsertStudioProject(user.ID, projectID, name, blob); err != nil {
		return "", "", err
	}
	return projectID, "/studio?project=" + url.QueryEscape(projectID), nil
}

// buildStudioDocument turns the assembled timeline into a PortableStudioDocument
// (frontend/lib/studio-projects.ts). Each cut becomes its own clip on lane 0 at
// its measured start time, so opening the project shows the real edit rather
// than one flattened render.
func buildStudioDocument(timeline []dramatizeShotResult) ([]byte, error) {
	assets := make([]map[string]interface{}, 0, len(timeline))
	for i := range timeline {
		shot := timeline[i]
		if shot.AssetID == "" || shot.AssetURL == "" {
			// The editor silently drops assets it cannot resolve, so skip them
			// here instead of writing a clip that will vanish on open.
			continue
		}
		assets = append(assets, map[string]interface{}{
			"id": shot.AssetID, "mediaID": shot.AssetID,
			"name": fmt.Sprintf("%02d %s", i+1, studioClipName(shot.Shot)),
			"kind": "video",
			// Studio derives clip length from trimEnd-trimStart, so these are
			// the measured durations, not the planned ones.
			"duration": shot.Duration, "width": dramatizeCanvasWidth, "height": dramatizeCanvasHeight,
			"trimStart": 0.0, "trimEnd": shot.Duration, "timelineStart": shot.Start,
			// Sequential cuts share lane 0; non-overlapping ranges keep them there.
			"visualTrack": 0,
			"volume":      1.0, "fadeIn": 0.0, "fadeOut": 0.0,
			"stageX": 0.0, "stageY": 0.0, "stageScale": 1.0, "stageRotation": 0.0,
			"adjustments":  studioDefaultAdjustments(),
			"cloudURL":     shot.AssetURL,
			"objectKey":    shot.ObjectKey,
			"contentType":  "video/mp4",
			"size":         shot.Size,
			"lastModified": time.Now().UnixMilli(),
		})
	}
	if len(assets) == 0 {
		return nil, fmt.Errorf("no assets to place on the timeline")
	}
	return json.Marshal(map[string]interface{}{
		"version":    5,
		"selectedID": assets[0]["id"],
		"assets":     assets,
		"canvas": map[string]int{
			"width": dramatizeCanvasWidth, "height": dramatizeCanvasHeight,
		},
		"audioTrackVolume": 1.0,
	})
}

func studioClipName(shot DramatizeShot) string {
	switch shot.Kind {
	case dramatizeShotKindSource:
		return "original cut"
	case dramatizeShotKindRestyled:
		return "restyled shot"
	default:
		return "generated shot"
	}
}

// studioDefaultAdjustments mirrors DEFAULT_ADJUSTMENTS in the editor so an
// imported clip opens neutral.
func studioDefaultAdjustments() map[string]float64 {
	return map[string]float64{
		"exposure": 0, "brightness": 0, "contrast": 0,
		"highlights": 0, "shadows": 0,
		"shadowHue": 0, "midtoneHue": 0, "highlightHue": 0,
		"saturation": 0, "temperature": 0, "tint": 0,
		"fade": 0, "vignette": 0, "grain": 0,
	}
}

// uploadStudioAsset PUTs a local file to the project-scoped R2 key the editor
// expects, so the clip resolves when the project is reopened.
func uploadStudioAsset(ctx context.Context, path, objectKey, contentType string) (string, error) {
	blob, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	uploadURL, err := presignR2PutObject(objectKey, contentType, 3600)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, strings.NewReader(string(blob)))
	if err != nil {
		return "", err
	}
	// R2 presigned PUTs reject chunked uploads, so the length must be explicit.
	req.ContentLength = int64(len(blob))
	req.Header.Set("Content-Type", contentType)
	resp, err := backendClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("R2 studio asset upload returned %d", resp.StatusCode)
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}
