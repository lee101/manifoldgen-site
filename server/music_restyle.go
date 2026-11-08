package main

// Music restyle: an uploaded instrumental is transcribed to a score and
// re-performed by the Manifold Music Generator (YuE2) in a new style, on the
// voice enhancer's RunPod worker (task "restyle"). The melody is kept; harmony
// is either re-written for the new style ("melody") or kept ("full"). The
// result carries the conditioned ABC score so agents can inspect or edit it,
// and the delivered track feeds the lofi loop, H3 loop clip or trailer agent.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	musicRestyleService        = "music_restyle"
	musicRestyleMaxSeconds     = 360
	musicRestyleMinSeconds     = 10
	musicRestyleMinPriceUSD    = 0.19
	musicRestyleMaxCandidates  = 2
	musicRestyleDefaultPrompt  = "lofi hip hop, mellow Rhodes electric piano, dusty boom bap drums, warm vinyl crackle, relaxing"
	musicRestyleAbcResultLimit = 24000
)

var musicRestyleHarmonies = []string{"melody", "full"}

// Style presets shown by the studio and returned to API/MCP callers so agents
// can pick one without inventing prompt text.
var musicRestylePresets = []map[string]string{
	{"id": "lofi", "name": "Lofi hip hop", "prompt": "lofi hip hop, mellow Rhodes electric piano, dusty boom bap drums, warm vinyl crackle, relaxing", "bpm": "80"},
	{"id": "rnb", "name": "R&B slow jam", "prompt": "smooth R&B instrumental, silky electric piano, deep warm bass, laid-back groove, soft finger snaps"},
	{"id": "violin", "name": "Violin & strings", "prompt": "expressive solo violin lead, warm string ensemble, soft piano, cinematic and lyrical"},
	{"id": "peaceful", "name": "Peaceful piano", "prompt": "peaceful relaxing solo piano, gentle and soft, ambient reverb, calm meditation"},
	{"id": "jazz", "name": "Jazz trio", "prompt": "jazz piano trio, upright bass, brushed drums, warm club ambience, swing feel"},
	{"id": "ambient", "name": "Ambient pads", "prompt": "ambient electronic, lush evolving pads, soft synth lead, slow and dreamy, spacious reverb"},
	{"id": "guitar", "name": "Acoustic guitar", "prompt": "fingerstyle acoustic guitar lead, warm and intimate, light percussion, folk"},
	{"id": "synthwave", "name": "Synthwave", "prompt": "80s synthwave, analog synth lead, pulsing bass, gated reverb drums, retro neon"},
	{"id": "orchestral", "name": "Orchestral", "prompt": "full cinematic orchestra, soaring strings and horns, timpani, epic film score"},
	{"id": "chiptune", "name": "Chiptune", "prompt": "8-bit chiptune, square wave lead, retro video game, bouncy arpeggios"},
}

type musicRestyleState struct {
	AudioURL        string  `json:"audio_url"`
	Prompt          string  `json:"prompt"`
	Harmony         string  `json:"harmony"`
	BPM             int     `json:"bpm,omitempty"`
	MaxSeconds      float64 `json:"max_seconds"`
	Candidates      int     `json:"candidates"`
	Seed            int     `json:"seed"`
	InputSeconds    float64 `json:"input_seconds"`
	PriceUSD        float64 `json:"price_usd"`
	PublicURL       string  `json:"public_url"`
	RightsConfirmed bool    `json:"rights_confirmed"`
}

type musicRestyleEnvelope struct {
	State musicRestyleState `json:"_music_restyle"`
}

type musicRestyleRunpodStatus struct {
	Status        string `json:"status"`
	ExecutionTime int64  `json:"executionTime"`
	Error         string `json:"error"`
	Output        struct {
		Error  string `json:"error"`
		Tracks map[string]struct {
			AudioURL string  `json:"audio_url"`
			Seconds  float64 `json:"seconds"`
			LUFS     float64 `json:"lufs"`
		} `json:"tracks"`
		InputSeconds float64                `json:"input_seconds"`
		ABC          string                 `json:"abc"`
		Style        string                 `json:"style"`
		BPM          int                    `json:"bpm"`
		Key          string                 `json:"key"`
		Bars         int                    `json:"bars"`
		Cot          string                 `json:"cot"`
		Seed         int                    `json:"seed"`
		Transcriber  string                 `json:"transcriber"`
		Timing       map[string]interface{} `json:"timing"`
	} `json:"output"`
}

// musicRestyleEndpointID defaults to the voice enhancer lane: same image.
func musicRestyleEndpointID() string {
	if id := strings.TrimSpace(os.Getenv("MUSIC_RESTYLE_RUNPOD_ENDPOINT_ID")); id != "" {
		return id
	}
	return voiceEnhancerEndpointID()
}

// musicRestyleGPUSeconds: transcription (beat tracking + note model) about
// 0.1x the source, each YuE2 render about 0.45x plus 0.05x to score it, and a
// fixed 60 s for model loads, encode/upload and a cold-start share.
func musicRestyleGPUSeconds(inputSeconds float64, candidates int) float64 {
	d := math.Max(inputSeconds, musicRestyleMinSeconds)
	seconds := 60 + 0.1*d + float64(max(candidates, 1))*0.5*d
	return seconds * voiceEnhancerEnvFloat("MUSIC_RESTYLE_TIME_SCALE", 1, 0.1)
}

// musicRestylePriceUSD is 2x the expected GPU cost (MUSIC_RESTYLE_PRICE_MARGIN), from the minimum.
func musicRestylePriceUSD(inputSeconds float64, candidates int) float64 {
	cost := musicRestyleGPUSeconds(inputSeconds, candidates) * voiceEnhancerGPUUSDPerHour() / 3600
	price := math.Max(cost*voiceEnhancerEnvFloat("MUSIC_RESTYLE_PRICE_MARGIN", 2, 1), musicRestyleMinPriceUSD)
	return math.Ceil(price*100) / 100
}

func normalizeMusicRestyleRequest(req ServiceUsageRequest) (musicRestyleState, error) {
	state := musicRestyleState{Seed: req.Seed, BPM: req.BPM, Candidates: req.N, RightsConfirmed: req.RightsConfirmed}
	state.Prompt = voiceEnhancerPromptClean.ReplaceAllString(strings.TrimSpace(req.Prompt), " ")
	if state.Prompt == "" {
		state.Prompt = musicRestyleDefaultPrompt
	}
	if len([]rune(state.Prompt)) > 300 {
		return state, fmt.Errorf("the style prompt must be 300 characters or fewer")
	}
	state.Harmony = strings.ToLower(strings.TrimSpace(req.Harmony))
	if state.Harmony == "" {
		state.Harmony = "melody"
	}
	if !containsString(musicRestyleHarmonies, state.Harmony) {
		return state, fmt.Errorf("harmony must be melody (new chords for the style) or full (keep the original chords)")
	}
	if state.BPM != 0 && (state.BPM < 40 || state.BPM > 200) {
		return state, fmt.Errorf("bpm must be between 40 and 200, or omitted to keep the source tempo")
	}
	if state.Candidates == 0 {
		state.Candidates = 1
	}
	if state.Candidates < 1 || state.Candidates > musicRestyleMaxCandidates {
		return state, fmt.Errorf("n must be 1 or 2 renders")
	}
	if state.Seed < 0 {
		return state, fmt.Errorf("seed must be a non-negative integer")
	}
	state.MaxSeconds = musicRestyleMaxSeconds
	if req.Duration != 0 {
		if req.Duration < musicRestyleMinSeconds || req.Duration > musicRestyleMaxSeconds {
			return state, fmt.Errorf("duration must be between %d and %d seconds", musicRestyleMinSeconds, musicRestyleMaxSeconds)
		}
		state.MaxSeconds = float64(req.Duration)
	}
	state.AudioURL = strings.TrimSpace(req.AudioURL)
	if !strings.HasPrefix(state.AudioURL, "https://"+r2PublicHost+"/") {
		return state, fmt.Errorf("upload the track first (audio_url must be a ManifoldGen upload)")
	}
	if !state.RightsConfirmed {
		return state, fmt.Errorf("confirm you own the recording, it is public domain, or you have permission to arrange it (rights_confirmed)")
	}
	return state, nil
}

func musicRestyleActiveJobs(userID string) int {
	jobs, err := dbConn.ListVideoJobs(userID, 50)
	if err != nil {
		return 0
	}
	active := 0
	for _, job := range jobs {
		if job.Service == musicRestyleService && (job.Status == "queued" || job.Status == "processing") {
			active++
		}
	}
	return active
}

func musicRestyleQuote(ctx *fasthttp.RequestCtx, req ServiceUsageRequest) {
	candidates := req.N
	if candidates < 1 || candidates > musicRestyleMaxCandidates {
		candidates = 1
	}
	seconds := float64(req.Duration)
	if seconds <= 0 {
		seconds = 180
	}
	seconds = math.Min(math.Max(seconds, musicRestyleMinSeconds), musicRestyleMaxSeconds)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"service": musicRestyleService, "estimated_cost_usd": musicRestylePriceUSD(seconds, candidates),
		"seconds": math.Round(seconds), "candidates": candidates,
		"estimated_minutes": math.Ceil(musicRestyleGPUSeconds(seconds, candidates) / 60),
		"presets":           musicRestylePresets, "harmony_options": musicRestyleHarmonies,
	})
}

func handleMusicRestyleService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if req.QuoteOnly {
		musicRestyleQuote(ctx, req)
		return
	}
	if user == nil {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}
	endpointID := musicRestyleEndpointID()
	if endpointID == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "music restyle is not available yet")
		return
	}
	if rejectArchivedLane(ctx, endpointID) {
		return
	}
	state, err := normalizeMusicRestyleRequest(req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	probe, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	duration := probeStudioDuration(probe, state.AudioURL)
	cancel()
	if duration < musicRestyleMinSeconds || duration > 20*60 {
		jsonError(ctx, http.StatusBadRequest, fmt.Sprintf("the track must be at least %d seconds and under 20 minutes", musicRestyleMinSeconds))
		return
	}
	state.InputSeconds = math.Min(duration, state.MaxSeconds)
	if musicRestyleActiveJobs(user.ID) >= voiceEnhancerMaxUserJobs {
		jsonError(ctx, http.StatusTooManyRequests, "two restyles are already in progress; wait for one to finish")
		return
	}
	state.PriceUSD = musicRestylePriceUSD(state.InputSeconds, state.Candidates)
	if rejectCreditsBelowEstimate(ctx, user, state.PriceUSD, 1) {
		return
	}
	if state.Seed == 0 {
		state.Seed = int(time.Now().UnixNano() % 2_000_000_000)
	}
	job, err := submitMusicRestyleJob(user, endpointID, state)
	if err != nil {
		log.Printf("[music-restyle] submission failed: %v", err)
		jsonError(ctx, http.StatusServiceUnavailable, "music restyle is temporarily unavailable")
		return
	}
	credits := 0.0
	if cutePrice := getCUTEPriceUSD(); cutePrice > 0 {
		credits = state.PriceUSD / cutePrice
	}
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": musicRestyleService, "kind": "music",
		"result": map[string]interface{}{
			"job_id": job.ID, "status": job.Status, "status_url": "/api/audio-jobs/" + job.ID,
		},
		"input_seconds": math.Round(state.InputSeconds), "harmony": state.Harmony, "bpm": state.BPM,
		"estimated_cost_usd": state.PriceUSD, "estimated_credits": credits,
		"estimated_minutes": math.Ceil(musicRestyleGPUSeconds(state.InputSeconds, state.Candidates) / 60),
		"settlement":        "charged after successful generation",
		"next":              musicRestyleNextStages(),
	})
}

// musicRestyleNextStages tells API/MCP callers how to turn the finished track into a video.
func musicRestyleNextStages() []map[string]string {
	return []map[string]string{
		{"service": "lofi_loop", "use": "audio_url=<restyled track>; cover still + parallax + visualizer, loop_seconds sets the repeat interval"},
		{"service": "video", "use": "loop=true with first_frame=<image>, duration 5-15: a clip whose first and last frame match; then lofi_loop with video_url=<clip> and audio_url tiles it over the track"},
		{"service": "trailer_agent", "use": "soundtrack_url=<restyled track>; a DeepSeek-planned multi-shot H3 music video"},
	}
}

func submitMusicRestyleJob(user *User, endpointID string, state musicRestyleState) (*VideoJob, error) {
	uploadURL, publicURL, err := voiceEnhancerUploadTarget(user.ID, "restyle")
	if err != nil {
		return nil, err
	}
	state.PublicURL = publicURL
	input := map[string]interface{}{
		"task": "restyle", "audio_url": state.AudioURL, "prompt": state.Prompt, "harmony": state.Harmony,
		"max_seconds": state.MaxSeconds, "seed": state.Seed, "candidates": state.Candidates,
		"uploads": map[string]interface{}{"restyle": map[string]string{"upload_url": uploadURL, "public_url": publicURL}},
	}
	if state.BPM > 0 {
		input["bpm"] = state.BPM
	}
	var queued h3RunpodQueuedJob
	status, err := callH3Runpod(endpointID, "/run", http.MethodPost, runpodRunBody(input, 30*time.Minute), &queued)
	if err != nil || queued.ID == "" {
		if err == nil {
			err = fmt.Errorf("music restyle returned no job (status %d)", status)
		}
		return nil, err
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "runpod:"+endpointID+":"+queued.ID, musicRestyleService, "Restyle: "+state.Prompt)
	if err != nil {
		runpodCancelBestEffort(endpointID, queued.ID)
		return nil, err
	}
	stored, _ := json.Marshal(musicRestyleEnvelope{State: state})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		runpodCancelBestEffort(endpointID, queued.ID)
		return nil, err
	}
	launchVideoJob(job.ID)
	return job, nil
}

func musicRestyleStateFromJob(job *VideoJob) musicRestyleState {
	var envelope musicRestyleEnvelope
	if job != nil {
		_ = json.Unmarshal(job.Result, &envelope)
	}
	return envelope.State
}

func processMusicRestyleJob(job *VideoJob) {
	endpointID, providerJobID, ok := parseRunpodH3ProviderJob(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music restyle is temporarily unavailable")
		return
	}
	state := musicRestyleStateFromJob(job)
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(50 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		var status musicRestyleRunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &status); err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 10 {
				runpodCancelBestEffort(endpointID, providerJobID)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music restyle is temporarily unavailable; no credits were charged")
				return
			}
			time.Sleep(5 * time.Second)
			continue
		}
		consecutiveErrors = 0
		switch strings.ToUpper(strings.TrimSpace(status.Status)) {
		case "COMPLETED":
			settleMusicRestyleJob(job, state, status)
			return
		case "FAILED", "CANCELLED", "TIMED_OUT":
			log.Printf("[music-restyle] job=%s %s: %s", job.ID, status.Status, status.Error)
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "restyle failed; no credits were charged")
			return
		}
		time.Sleep(5 * time.Second)
	}
	runpodCancelBestEffort(endpointID, providerJobID)
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "restyle timed out; no credits were charged")
}

func settleMusicRestyleJob(job *VideoJob, state musicRestyleState, status musicRestyleRunpodStatus) {
	out := status.Output
	if out.Error != "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, out.Error)
		return
	}
	track, ok := out.Tracks["restyle"]
	if !ok || track.AudioURL == "" || track.AudioURL != state.PublicURL {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "restyle returned no audio; no credits were charged")
		return
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "pricing is temporarily unavailable")
		return
	}
	executionSeconds := math.Max(float64(status.ExecutionTime)/1000, 1)
	providerUSD := voiceEnhancerGPUUSDPerHour() * executionSeconds / 3600
	abc := out.ABC
	if len(abc) > musicRestyleAbcResultLimit {
		abc = abc[:musicRestyleAbcResultLimit]
	}
	result, _ := json.Marshal(map[string]interface{}{
		"service": job.Service, "kind": "music", "audio_id": h3AudioID(job), "audio_url": track.AudioURL,
		"duration_seconds": track.Seconds, "source_url": state.AudioURL, "prompt": state.Prompt,
		"style": out.Style, "harmony": state.Harmony, "bpm": out.BPM, "key": out.Key, "bars": out.Bars,
		"score_abc": abc, "transcriber": out.Transcriber, "seed": out.Seed,
		"model": musicPublicModelName, "provider": "runpod", "provider_cost_usd": providerUSD,
		"charged_usd": state.PriceUSD, "input_seconds": out.InputSeconds,
		"next": musicRestyleNextStages(),
	})
	if _, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, state.PriceUSD, cutePrice); err != nil {
		if err != ErrVideoPaymentRequired {
			log.Printf("[music-restyle] settlement failed job=%s: %v", job.ID, err)
			_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement is temporarily unavailable")
		}
		return
	}
	log.Printf("[music-restyle] job=%s %.0fs %s %dbpm exec=%.0fs provider=$%.3f charged=$%.2f timing=%v",
		job.ID, out.InputSeconds, out.Key, out.BPM, executionSeconds, providerUSD, state.PriceUSD, out.Timing)
	asset := &GeneratedAudio{
		ID: h3AudioID(job), UserID: job.UserID, Kind: "music", Prompt: state.Prompt,
		Title: studioAudioTitle("Restyled: " + state.Prompt), AudioURL: track.AudioURL,
		DurationSeconds: int(math.Round(track.Seconds)), Public: false, CreatedAt: time.Now(),
	}
	if err := dbConn.InsertGeneratedAudio(asset); err != nil {
		log.Printf("[music-restyle] audio indexing failed job=%s: %v", job.ID, err)
	}
	maybeTriggerAutoTopup(job.UserID)
}
