package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	musicVideoService    = "music_video"
	musicVideoH3Duration = 15
)

type musicVideoState struct {
	Request            ServiceUsageRequest `json:"request"`
	MusicPrompt        string              `json:"music_prompt"`
	MusicDuration      int                 `json:"music_duration"`
	AudioID            string              `json:"audio_id,omitempty"`
	AudioURL           string              `json:"audio_url,omitempty"`
	MusicCreditsUsed   float64             `json:"music_credits_used"`
	MusicCreditsRemain float64             `json:"music_credits_remain"`
	Stage              string              `json:"stage"`
}

type musicVideoEnvelope struct {
	MusicVideo musicVideoState `json:"_music_video"`
}

func defaultMusicVideoPrompt(videoPrompt string) string {
	prefix := "Instrumental cinematic soundtrack for this music video: "
	runes := []rune(prefix + strings.TrimSpace(videoPrompt))
	if len(runes) > 2000 {
		runes = runes[:2000]
	}
	return string(runes)
}

func normalizeMusicVideoRequest(req *ServiceUsageRequest) (string, int, error) {
	if req == nil {
		return "", 0, fmt.Errorf("music video request is required")
	}
	if strings.TrimSpace(req.AudioURL) != "" {
		return "", 0, fmt.Errorf("music_video generates its own reference audio; omit audio_url")
	}
	if err := normalizeH3VideoRequest(req); err != nil {
		return "", 0, err
	}
	if req.FirstFrame == "" {
		return "", 0, fmt.Errorf("music_video requires first_frame or image_url")
	}
	if req.Loop || req.LastFrame != "" || len(req.Keyframes) > 1 {
		return "", 0, fmt.Errorf("music_video cannot be combined with loop, last_frame, or multiple keyframes")
	}
	if req.Duration > 15 {
		return "", 0, fmt.Errorf("music_video duration must be between 4 and 15 seconds")
	}
	// H3's reference-audio path renders one fixed 15-second window. Normalize
	// here so pricing, progress estimates, and the delivered artifact agree.
	req.Duration = musicVideoH3Duration
	keepAudio := true
	req.IncludeAudio = &keepAudio
	musicPrompt := strings.TrimSpace(req.MusicPrompt)
	if musicPrompt == "" {
		musicPrompt = defaultMusicVideoPrompt(req.Prompt)
	}
	musicDuration := req.MusicDuration
	if musicDuration == 0 {
		musicDuration = studioMusicMinDuration
	}
	musicPrompt, musicDuration, err := normalizeMusicGenerationInput(musicPrompt, musicDuration)
	if err != nil {
		return "", 0, err
	}
	req.MusicPrompt = musicPrompt
	req.MusicDuration = musicDuration
	return musicPrompt, musicDuration, nil
}

func handleMusicVideoService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	musicPrompt, musicDuration, err := normalizeMusicVideoRequest(&req)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if user == nil {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}

	balance := user.Credits
	musicCredits := studioMusicCredits
	if user.UnlimitedAPI {
		musicCredits = 0
	} else {
		balance, err = dbConn.DeductUserCredits(user.ID, studioMusicCredits)
		if err != nil {
			jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: music video soundtrack costs 80 credits before video settlement")
			return
		}
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:music", musicVideoService, req.Prompt)
	if err != nil {
		if musicCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, musicCredits)
		}
		jsonError(ctx, http.StatusInternalServerError, "failed to create music video job")
		return
	}
	state := musicVideoState{
		Request: req, MusicPrompt: musicPrompt, MusicDuration: musicDuration,
		MusicCreditsUsed: musicCredits, MusicCreditsRemain: balance, Stage: "music",
	}
	persisted, _ := json.Marshal(musicVideoEnvelope{MusicVideo: state})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", persisted, ""); err != nil {
		if musicCredits > 0 {
			_, _ = dbConn.AddUserCredits(user.ID, musicCredits)
		}
		jsonError(ctx, http.StatusInternalServerError, "failed to persist music video job")
		return
	}
	estimatedUSD, estimatedCredits, estimatedSeconds := h3Estimate(req)
	launchVideoJob(job.ID)
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": musicVideoService,
		"result": map[string]interface{}{
			"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID,
			"stage": "music",
		},
		"credits_used": musicCredits, "credits_remain": balance,
		"music_cost_usd":               musicCredits * getCUTEPriceUSD(),
		"estimated_video_cost_usd":     estimatedUSD,
		"estimated_total_credits":      musicCredits + estimatedCredits,
		"estimated_generation_seconds": estimatedSeconds,
	})
}

func readMusicVideoState(job *VideoJob) (musicVideoState, error) {
	if job == nil || job.Service != musicVideoService || len(job.Result) == 0 {
		return musicVideoState{}, fmt.Errorf("music video state is unavailable")
	}
	var envelope musicVideoEnvelope
	if err := json.Unmarshal(job.Result, &envelope); err != nil || envelope.MusicVideo.Request.Prompt == "" {
		return musicVideoState{}, fmt.Errorf("music video state is invalid")
	}
	return envelope.MusicVideo, nil
}

func persistMusicVideoState(jobID, status string, state musicVideoState) error {
	payload, _ := json.Marshal(musicVideoEnvelope{MusicVideo: state})
	return dbConn.UpdateVideoJob(jobID, status, payload, "")
}

func processMusicVideoJob(job *VideoJob) {
	state, err := readMusicVideoState(job)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved music video request is invalid")
		return
	}
	providerID := strings.TrimSpace(job.ProviderJobID)
	if state.AudioURL != "" && providerID != "" && providerID != "pipeline:music" {
		processH3VideoJob(job)
		return
	}
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music video owner no longer exists")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")

	if state.AudioURL == "" {
		generatedURL, generationErr := studioGenerateMusic(state.MusicPrompt, state.MusicDuration)
		if generationErr != nil {
			log.Printf("music video soundtrack generation failed job=%s: %v", job.ID, generationErr)
			if state.MusicCreditsUsed > 0 && !videoJobWasCancelled(job.ID) {
				_, _ = dbConn.AddUserCredits(job.UserID, state.MusicCreditsUsed)
			}
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music video soundtrack generation failed")
			return
		}
		if videoJobWasCancelled(job.ID) {
			return
		}
		storedURL, storageErr := persistGeneratedAudioURLNamed(generatedURL, job.UserID, "music-video-soundtrack")
		if storageErr != nil {
			log.Printf("music video soundtrack storage failed job=%s: %v", job.ID, storageErr)
			if state.MusicCreditsUsed > 0 {
				_, _ = dbConn.AddUserCredits(job.UserID, state.MusicCreditsUsed)
			}
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music video soundtrack storage failed")
			return
		}
		state.AudioID = "music_" + strings.TrimPrefix(job.ID, "video_")
		state.AudioURL = storedURL
		state.Stage = "video"
		asset := &GeneratedAudio{
			ID: state.AudioID, UserID: job.UserID, Kind: "music", Prompt: state.MusicPrompt,
			Title: studioAudioTitle(state.MusicPrompt), AudioURL: state.AudioURL,
			DurationSeconds: state.MusicDuration, Public: true, CreatedAt: time.Now(),
		}
		if err := dbConn.InsertGeneratedAudio(asset); err != nil {
			log.Printf("music video soundtrack indexing failed job=%s: %v", job.ID, err)
		}
		if err := persistMusicVideoState(job.ID, "processing", state); err != nil {
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music video state could not be persisted")
			return
		}
		if state.MusicCreditsUsed > 0 {
			price := getCUTEPriceUSD()
			_ = dbConn.CreateBillingEvent(&BillingEvent{
				ID: "music_video_music_" + job.ID, UserID: job.UserID, EventType: "music_generation",
				Amount: -state.MusicCreditsUsed, CuteAmount: state.MusicCreditsUsed,
				USDAmount: state.MusicCreditsUsed * price, Description: "music video soundtrack generation",
				CreditsAfter: state.MusicCreditsRemain,
			})
			maybeTriggerAutoTopup(job.UserID)
		}
	}
	if videoJobWasCancelled(job.ID) {
		return
	}

	state.Request.AudioURL = state.AudioURL
	state.Request.Loop = false
	state.Request.LastFrame = ""
	state.Request.Keyframes = nil
	keepAudio := true
	state.Request.IncludeAudio = &keepAudio
	if err := normalizeH3VideoRequest(&state.Request); err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music video reference is invalid")
		return
	}
	if err := submitMusicVideoH3(job, user, state); err != nil {
		log.Printf("music video H3 submission failed job=%s: %v", job.ID, err)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, videoGenerationUnavailableMessage)
	}
}

func musicVideoPersistedInput(input map[string]interface{}, state musicVideoState) []byte {
	persisted := make(map[string]interface{}, len(input)+1)
	for key, value := range input {
		persisted[key] = value
	}
	persisted["_music_video"] = state
	data, _ := json.Marshal(persisted)
	return data
}

func submitMusicVideoH3(job *VideoJob, user *User, state musicVideoState) error {
	req := state.Request
	input := appNZH3Input(req)
	route := h3RouteForPrompt(req.Prompt)
	if route.RunpodEndpointID != "" {
		logH3Route(req.Prompt, route)
		if err := prepareH3RunpodOutputTarget(input, user.ID); err != nil {
			return err
		}
		var queued h3RunpodQueuedJob
		if _, err := submitScaledH3RunpodJob(route, input, &queued); err != nil {
			return err
		}
		if queued.ID == "" {
			return fmt.Errorf("hosted music video service returned no job")
		}
		scheduleH3ScaleToZero(route.RunpodEndpointID)
		input["_h3_variant"] = route.Variant
		providerID := "runpod:" + route.RunpodEndpointID + ":" + queued.ID
		if err := dbConn.UpdateVideoJobProvider(job.ID, providerID, "queued", musicVideoPersistedInput(input, state)); err != nil {
			return err
		}
		updated, err := dbConn.GetVideoJobInternal(job.ID)
		if err != nil {
			return err
		}
		processRunpodH3VideoJob(updated)
		return nil
	}
	if route.CogURL != "" {
		logH3Route(req.Prompt, route)
		input["_h3_cog_url"] = route.CogURL
		input["_h3_variant"] = route.Variant
		if err := dbConn.UpdateVideoJobProvider(job.ID, "local:sync", "queued", musicVideoPersistedInput(input, state)); err != nil {
			return err
		}
		updated, err := dbConn.GetVideoJobInternal(job.ID)
		if err != nil {
			return err
		}
		processLocalH3VideoJob(updated)
		return nil
	}
	envelope, _, err := callAppNZH3(http.MethodPost, "/api/cogs/run", map[string]interface{}{
		"template": "minimax-h3", "name": "minimax-h3-music-video", "input": input,
	})
	if err != nil {
		return err
	}
	if envelope.Prediction.ID == "" {
		return fmt.Errorf("shared music video service returned no job")
	}
	if err := dbConn.UpdateVideoJobProvider(job.ID, envelope.Prediction.ID, "queued", musicVideoPersistedInput(input, state)); err != nil {
		return err
	}
	updated, err := dbConn.GetVideoJobInternal(job.ID)
	if err != nil {
		return err
	}
	processH3VideoJob(updated)
	return nil
}

func mergeMusicVideoResult(job *VideoJob, result []byte) []byte {
	state, err := readMusicVideoState(job)
	if err != nil || state.AudioURL == "" {
		return result
	}
	var payload map[string]interface{}
	if json.Unmarshal(result, &payload) != nil {
		return result
	}
	payload["music_video"] = true
	payload["kind"] = musicVideoService
	payload["music_audio_id"] = state.AudioID
	payload["music_audio_url"] = state.AudioURL
	payload["music_prompt"] = state.MusicPrompt
	payload["music_requested_duration_seconds"] = state.MusicDuration
	payload["music_credits_used"] = state.MusicCreditsUsed
	merged, err := json.Marshal(payload)
	if err != nil {
		return result
	}
	return merged
}

func exposePublicMusicVideoStatus(payload map[string]interface{}) {
	if payload == nil {
		return
	}
	internal, ok := payload["_music_video"].(map[string]interface{})
	if !ok {
		return
	}
	payload["music_video"] = true
	if stage, ok := internal["stage"].(string); ok && (stage == "music" || stage == "video") {
		payload["stage"] = stage
	}
	if audioURL, ok := internal["audio_url"].(string); ok && strings.HasPrefix(audioURL, "https://") {
		payload["music_audio_url"] = audioURL
	}
}
