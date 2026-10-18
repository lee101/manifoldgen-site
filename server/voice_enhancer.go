package main

// Voice enhancer and lyric music generator.
//
// Both run one RunPod worker (workers/voice-enhancer): the singer's take (or a
// TTS read of pasted lyrics) is transcribed, re-performed by the Manifold Music
// Generator in the requested style, and delivered as up to three tracks:
//   voice    the re-performance in the singer's own (or the chosen) voice
//   studio   the generator's own vocalist
//   produce  the original take, beat-locked and mixed over the new instrumental
// The price is quoted from the input length before submission and charged on
// success; GPU time is the dominant cost, TTS is added for the lyric tool.

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	voiceEnhancerService       = "voice_enhancer"
	lyricMusicService          = "lyric_music"
	voiceEnhancerDefaultGPUUSD = 1.12 // RunPod RTX 4090 flex, matches the YuE lane
	voiceEnhancerMaxSeconds    = 360
	voiceEnhancerMinSeconds    = 5
	voiceEnhancerMaxLyricChars = 6000
	voiceEnhancerMaxUserJobs   = 2
	voiceEnhancerMinPriceUSD   = 0.29
)

var voiceEnhancerTracks = []string{"voice", "studio", "produce"}

// Public quality tiers for the lyric tool's guide vocal. Internals stay
// server-side; the UI only shows the label and the price difference.
var lyricMusicTTSVoices = map[string][]string{
	"studio":   {"Fenrir", "Orus", "Charon", "Puck"},
	"standard": {"am_michael", "am_fenrir", "am_puck", "am_onyx", "af_heart", "af_bella"},
	"lite":     {"M2", "M1", "M3", "F1", "F2"},
}

type voiceEnhancerState struct {
	Task         string            `json:"task"`
	AudioURL     string            `json:"audio_url,omitempty"`
	Lyrics       string            `json:"lyrics,omitempty"`
	Prompt       string            `json:"prompt"`
	TTSTier      string            `json:"tts_tier,omitempty"`
	TTSVoice     string            `json:"tts_voice,omitempty"`
	Tracks       []string          `json:"tracks"`
	Seed         int               `json:"seed"`
	InputSeconds float64           `json:"input_seconds"`
	PriceUSD     float64           `json:"price_usd"`
	PublicURLs   map[string]string `json:"public_urls"`
}

type voiceEnhancerEnvelope struct {
	State voiceEnhancerState `json:"_voice_enhancer"`
}

type voiceEnhancerRunpodStatus struct {
	Status        string `json:"status"`
	ExecutionTime int64  `json:"executionTime"`
	Error         string `json:"error"`
	Output        struct {
		Error  string `json:"error"`
		Lyrics string `json:"lyrics"`
		Tracks map[string]struct {
			AudioURL string  `json:"audio_url"`
			Seconds  float64 `json:"seconds"`
			LUFS     float64 `json:"lufs"`
		} `json:"tracks"`
		InputSeconds float64                `json:"input_seconds"`
		Metrics      map[string]interface{} `json:"metrics"`
		Timing       map[string]interface{} `json:"timing"`
	} `json:"output"`
}

func voiceEnhancerEndpointID() string {
	return strings.TrimSpace(os.Getenv("VOICE_ENHANCER_RUNPOD_ENDPOINT_ID"))
}

func voiceEnhancerEnvFloat(name string, fallback, minimum float64) float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv(name)), 64); err == nil && value >= minimum {
		return value
	}
	return fallback
}

func voiceEnhancerGPUUSDPerHour() float64 {
	if value := voiceEnhancerEnvFloat("VOICE_ENHANCER_GPU_USD_PER_HOUR", 0, 0.01); value > 0 {
		return value
	}
	return runpodEffectiveHourlyUSD(voiceEnhancerEndpointID(), voiceEnhancerDefaultGPUUSD)
}

// voiceEnhancerGPUSeconds models one job from stage times measured in the
// worker image (RTX 3090 Ti, 177 s rap take, 393 s total): analysis 0.33x the
// take, each generator render 0.45x plus 0.16x to score it, voice conversion
// 0.5x, the beat-locked mix 0.12x, 15 s to encode and upload, and a 30 s share
// of a cold start. A second render batch runs when no render sings the lyrics
// cleanly (about a quarter of runs), so a quarter of a batch is priced in.
func voiceEnhancerGPUSeconds(inputSeconds float64, tracks []string, candidates int) float64 {
	d := math.Max(inputSeconds, voiceEnhancerMinSeconds)
	batch := float64(candidates) * 0.61 * d
	seconds := 45 + 0.33*d + batch*1.25
	for _, track := range tracks {
		switch track {
		case "voice":
			seconds += 0.5 * d
		case "produce":
			seconds += 0.12 * d
		}
	}
	return seconds * voiceEnhancerEnvFloat("VOICE_ENHANCER_TIME_SCALE", 1, 0.1)
}

// Gemini 3.1 Flash TTS: $1.20/M text in, $24/M audio out at 25 audio tokens per
// second. The self-hosted tiers cost a fraction of a cent per minute.
func lyricMusicTTSUSD(tier string, seconds float64) float64 {
	switch tier {
	case "studio":
		return 0.002 + 24e-6*25*seconds
	default:
		return 0.001 * seconds / 60
	}
}

// voiceEnhancerPriceUSD is 2x the expected provider cost (a 50% margin), never
// below the minimum. VOICE_ENHANCER_PRICE_MARGIN retunes it without a deploy.
func voiceEnhancerPriceUSD(task string, inputSeconds float64, tracks []string, ttsTier string) float64 {
	cost := voiceEnhancerGPUSeconds(inputSeconds, tracks, voiceEnhancerCandidates(ttsTier)) * voiceEnhancerGPUUSDPerHour() / 3600
	if task == "lyrics" {
		cost += lyricMusicTTSUSD(ttsTier, inputSeconds)
	}
	price := math.Max(cost*voiceEnhancerEnvFloat("VOICE_ENHANCER_PRICE_MARGIN", 2, 1), voiceEnhancerFloorUSD(task, ttsTier))
	return math.Ceil(price*100) / 100
}

// voiceEnhancerFloorUSD keeps short songs above their fixed costs; each lyric
// tier has its own floor so the quality slider moves the price at any length.
func voiceEnhancerFloorUSD(task, ttsTier string) float64 {
	if task == "lyrics" {
		switch ttsTier {
		case "lite":
			return 0.19
		case "standard":
			return 0.24
		}
	}
	return voiceEnhancerMinPriceUSD
}

// voiceEnhancerCandidates is how many renders compete per batch. The lite
// lyric tier renders one, the real saving behind its lower price.
func voiceEnhancerCandidates(ttsTier string) int {
	if ttsTier == "lite" {
		return 1
	}
	return 2
}

// lyricMusicSeconds estimates the guide vocal's length: the TTS voices read
// these lyrics at about three words per second.
func lyricMusicSeconds(lyrics string) float64 {
	return math.Max(float64(len(strings.Fields(lyrics)))/3.0, voiceEnhancerMinSeconds)
}

var voiceEnhancerPromptClean = regexp.MustCompile(`\s+`)

func normalizeVoiceEnhancerTracks(requested []string) []string {
	if len(requested) == 0 {
		return append([]string(nil), voiceEnhancerTracks...)
	}
	var out []string
	for _, track := range voiceEnhancerTracks {
		for _, want := range requested {
			if strings.EqualFold(strings.TrimSpace(want), track) {
				out = append(out, track)
				break
			}
		}
	}
	return out
}

func normalizeVoiceEnhancerRequest(req ServiceUsageRequest) (voiceEnhancerState, error) {
	state := voiceEnhancerState{Task: "enhance", Seed: req.Seed}
	if req.Service == lyricMusicService {
		state.Task = "lyrics"
	}
	state.Prompt = voiceEnhancerPromptClean.ReplaceAllString(strings.TrimSpace(req.Prompt), " ")
	if state.Prompt == "" {
		state.Prompt = "hard hip-hop diss track"
	}
	if len([]rune(state.Prompt)) > 300 {
		return state, fmt.Errorf("the style prompt must be 300 characters or fewer")
	}
	state.Lyrics = strings.TrimSpace(req.Lyrics)
	if len([]rune(state.Lyrics)) > voiceEnhancerMaxLyricChars {
		return state, fmt.Errorf("lyrics must be %d characters or fewer", voiceEnhancerMaxLyricChars)
	}
	if err := music3PromptGuard(state.Prompt, state.Lyrics); err != nil {
		return state, err
	}
	state.Tracks = normalizeVoiceEnhancerTracks(req.Tracks)
	if len(state.Tracks) == 0 {
		return state, fmt.Errorf("tracks must include voice, studio or produce")
	}
	if state.Seed < 0 {
		return state, fmt.Errorf("seed must be a non-negative integer")
	}
	if state.Task == "lyrics" {
		if len(strings.Fields(state.Lyrics)) < 8 {
			return state, fmt.Errorf("paste at least a verse of lyrics")
		}
		tier := strings.ToLower(strings.TrimSpace(req.Quality))
		if tier == "" {
			tier = "studio"
		}
		voices, ok := lyricMusicTTSVoices[tier]
		if !ok {
			return state, fmt.Errorf("quality must be studio, standard or lite")
		}
		voice := strings.TrimSpace(req.Voice)
		if voice == "" {
			voice = voices[0]
		}
		if !containsString(voices, voice) {
			return state, fmt.Errorf("unknown voice for %s quality", tier)
		}
		state.TTSTier, state.TTSVoice = tier, voice
		// "produce" lays the guide read itself over the beat: offered, not default.
		if len(req.Tracks) == 0 {
			state.Tracks = []string{"voice", "studio"}
		}
		state.InputSeconds = lyricMusicSeconds(state.Lyrics)
		if state.InputSeconds > voiceEnhancerMaxSeconds {
			return state, fmt.Errorf("lyrics are too long for one song (about %d minutes max)", voiceEnhancerMaxSeconds/60)
		}
		return state, nil
	}
	state.AudioURL = strings.TrimSpace(req.AudioURL)
	if !strings.HasPrefix(state.AudioURL, "https://"+r2PublicHost+"/") {
		return state, fmt.Errorf("upload the recording first (audio_url must be a ManifoldGen upload)")
	}
	if containsString(state.Tracks, "voice") && !req.VoiceConsent {
		return state, fmt.Errorf("confirm the recording is your own voice or that you have the singer's permission")
	}
	return state, nil
}

func voiceEnhancerActiveJobs(userID string) int {
	jobs, err := dbConn.ListVideoJobs(userID, 50)
	if err != nil {
		return 0
	}
	active := 0
	for _, job := range jobs {
		if (job.Service == voiceEnhancerService || job.Service == lyricMusicService) &&
			(job.Status == "queued" || job.Status == "processing") {
			active++
		}
	}
	return active
}

// handleVoiceEnhancerQuote prices a request without submitting it (the UI's live price).
func handleVoiceEnhancerQuote(ctx *fasthttp.RequestCtx, req ServiceUsageRequest) {
	state, err := normalizeVoiceEnhancerRequest(req)
	if err != nil && !(state.Task == "enhance" && state.AudioURL == "") {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	seconds := state.InputSeconds
	if state.Task == "enhance" {
		seconds = float64(req.Duration)
		if seconds <= 0 {
			seconds = 180
		}
	}
	tiers := map[string]float64{}
	if state.Task == "lyrics" {
		for tier := range lyricMusicTTSVoices {
			tiers[tier] = voiceEnhancerPriceUSD("lyrics", seconds, state.Tracks, tier)
		}
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"estimated_cost_usd": voiceEnhancerPriceUSD(state.Task, seconds, state.Tracks, state.TTSTier),
		"seconds":            math.Round(seconds), "tracks": state.Tracks, "quality_prices_usd": tiers,
	})
}

func handleVoiceEnhancerService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if req.QuoteOnly {
		handleVoiceEnhancerQuote(ctx, req)
		return
	}
	if user == nil {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}
	endpointID := voiceEnhancerEndpointID()
	if endpointID == "" {
		jsonError(ctx, http.StatusServiceUnavailable, "the voice enhancer is not available yet")
		return
	}
	if rejectArchivedLane(ctx, endpointID) {
		return
	}
	state, err := normalizeVoiceEnhancerRequest(req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if state.Task == "enhance" {
		probe, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		state.InputSeconds = probeStudioDuration(probe, state.AudioURL)
		cancel()
		if state.InputSeconds < voiceEnhancerMinSeconds || state.InputSeconds > voiceEnhancerMaxSeconds {
			jsonError(ctx, http.StatusBadRequest, fmt.Sprintf("the recording must be between %d seconds and %d minutes", voiceEnhancerMinSeconds, voiceEnhancerMaxSeconds/60))
			return
		}
	}
	if voiceEnhancerActiveJobs(user.ID) >= voiceEnhancerMaxUserJobs {
		jsonError(ctx, http.StatusTooManyRequests, "two songs are already in progress; wait for one to finish")
		return
	}
	state.PriceUSD = voiceEnhancerPriceUSD(state.Task, state.InputSeconds, state.Tracks, state.TTSTier)
	if rejectCreditsBelowEstimate(ctx, user, state.PriceUSD, 1) {
		return
	}
	if state.Seed == 0 {
		state.Seed = int(time.Now().UnixNano() % 2_000_000_000)
	}
	job, err := submitVoiceEnhancerJob(user, endpointID, req.Service, state)
	if err != nil {
		log.Printf("[voice-enhancer] submission failed: %v", err)
		jsonError(ctx, http.StatusServiceUnavailable, "the voice enhancer is temporarily unavailable")
		return
	}
	credits := 0.0
	if cutePrice := getCUTEPriceUSD(); cutePrice > 0 {
		credits = state.PriceUSD / cutePrice
	}
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": req.Service, "kind": "music", "tracks": state.Tracks,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": job.Status, "status_url": "/api/audio-jobs/" + job.ID,
		},
		"input_seconds": math.Round(state.InputSeconds), "estimated_cost_usd": state.PriceUSD,
		"estimated_credits": credits, "estimated_minutes": math.Ceil(voiceEnhancerGPUSeconds(state.InputSeconds, state.Tracks, voiceEnhancerCandidates(state.TTSTier)) / 60),
		"settlement": "charged after successful generation",
	})
}

func submitVoiceEnhancerJob(user *User, endpointID, service string, state voiceEnhancerState) (*VideoJob, error) {
	uploads := map[string]interface{}{}
	state.PublicURLs = map[string]string{}
	for _, track := range state.Tracks {
		uploadURL, publicURL, err := voiceEnhancerUploadTarget(user.ID, track)
		if err != nil {
			return nil, err
		}
		uploads[track] = map[string]string{"upload_url": uploadURL, "public_url": publicURL}
		state.PublicURLs[track] = publicURL
	}
	input := map[string]interface{}{
		"task": state.Task, "prompt": state.Prompt, "tracks": state.Tracks, "seed": state.Seed,
		"candidates": voiceEnhancerCandidates(state.TTSTier), "uploads": uploads,
	}
	if state.AudioURL != "" {
		input["audio_url"] = state.AudioURL
	}
	if state.Lyrics != "" {
		input["lyrics"] = state.Lyrics
	}
	if state.Task == "lyrics" {
		input["tts"] = map[string]string{"tier": state.TTSTier, "voice": state.TTSVoice}
	}
	var queued h3RunpodQueuedJob
	status, err := callH3Runpod(endpointID, "/run", http.MethodPost, runpodRunBody(input, 40*time.Minute), &queued)
	if err != nil || queued.ID == "" {
		if err == nil {
			err = fmt.Errorf("voice enhancer returned no job (status %d)", status)
		}
		return nil, err
	}
	title := state.Prompt
	if state.Task == "lyrics" {
		title = "Lyric song: " + state.Prompt
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "runpod:"+endpointID+":"+queued.ID, service, title)
	if err != nil {
		runpodCancelBestEffort(endpointID, queued.ID)
		return nil, err
	}
	stored, _ := json.Marshal(voiceEnhancerEnvelope{State: state})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		runpodCancelBestEffort(endpointID, queued.ID)
		return nil, err
	}
	launchVideoJob(job.ID)
	return job, nil
}

func voiceEnhancerUploadTarget(userID, track string) (string, string, error) {
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	objectKey := fmt.Sprintf("%s/%s/audio/%s-manifold-%s.mp3", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), track)
	uploadURL, err := presignR2PutObject(objectKey, "audio/mpeg", 3*3600)
	if err != nil {
		return "", "", err
	}
	return uploadURL, fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func voiceEnhancerStateFromJob(job *VideoJob) voiceEnhancerState {
	var envelope voiceEnhancerEnvelope
	if job != nil {
		_ = json.Unmarshal(job.Result, &envelope)
	}
	return envelope.State
}

func processVoiceEnhancerJob(job *VideoJob) {
	endpointID, providerJobID, ok := parseRunpodH3ProviderJob(job.ProviderJobID)
	if !ok {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "the voice enhancer is temporarily unavailable")
		return
	}
	state := voiceEnhancerStateFromJob(job)
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(60 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		var status voiceEnhancerRunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &status); err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 10 {
				runpodCancelBestEffort(endpointID, providerJobID)
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "the voice enhancer is temporarily unavailable; no credits were charged")
				return
			}
			time.Sleep(5 * time.Second)
			continue
		}
		consecutiveErrors = 0
		switch strings.ToUpper(strings.TrimSpace(status.Status)) {
		case "COMPLETED":
			settleVoiceEnhancerJob(job, state, status)
			return
		case "FAILED", "CANCELLED", "TIMED_OUT":
			log.Printf("[voice-enhancer] job=%s %s: %s", job.ID, status.Status, status.Error)
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "song generation failed; no credits were charged")
			return
		}
		time.Sleep(5 * time.Second)
	}
	runpodCancelBestEffort(endpointID, providerJobID)
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "song generation timed out; no credits were charged")
}

func settleVoiceEnhancerJob(job *VideoJob, state voiceEnhancerState, status voiceEnhancerRunpodStatus) {
	if status.Output.Error != "" {
		// Input problems (undecodable audio, too long) are reported, never charged.
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, status.Output.Error)
		return
	}
	tracks := map[string]interface{}{}
	primary := ""
	for _, name := range voiceEnhancerTracks {
		track, ok := status.Output.Tracks[name]
		if !ok || track.AudioURL != state.PublicURLs[name] {
			continue
		}
		tracks[name] = map[string]interface{}{"audio_url": track.AudioURL, "duration_seconds": track.Seconds}
		if primary == "" {
			primary = track.AudioURL
		}
	}
	if primary == "" {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "song generation returned no audio; no credits were charged")
		return
	}
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "pricing is temporarily unavailable")
		return
	}
	executionSeconds := math.Max(float64(status.ExecutionTime)/1000, 1)
	providerUSD := voiceEnhancerGPUUSDPerHour() * executionSeconds / 3600
	if state.Task == "lyrics" {
		providerUSD += lyricMusicTTSUSD(state.TTSTier, status.Output.InputSeconds)
	}
	result, _ := json.Marshal(map[string]interface{}{
		"service": job.Service, "kind": "music", "audio_id": h3AudioID(job), "audio_url": primary,
		"tracks": tracks, "lyrics": status.Output.Lyrics, "prompt": state.Prompt,
		"model": musicPublicModelName, "provider": "runpod", "provider_cost_usd": providerUSD,
		"charged_usd": state.PriceUSD, "input_seconds": status.Output.InputSeconds,
		"quality": state.TTSTier, "seed": state.Seed,
	})
	if _, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, state.PriceUSD, cutePrice); err != nil {
		if err != ErrVideoPaymentRequired {
			log.Printf("[voice-enhancer] settlement failed job=%s: %v", job.ID, err)
			_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement is temporarily unavailable")
		}
		return
	}
	log.Printf("[voice-enhancer] job=%s %s %.0fs exec=%.0fs provider=$%.3f charged=$%.2f timing=%v",
		job.ID, state.Task, status.Output.InputSeconds, executionSeconds, providerUSD, state.PriceUSD, status.Output.Timing)
	indexCompletedH3Asset(job, result)
	maybeTriggerAutoTopup(job.UserID)
}
