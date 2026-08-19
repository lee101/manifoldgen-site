package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

const music3DefaultGPUUSDPerHour = 4.59

var music3EventMu sync.Mutex

func music3EventPath() string {
	if value := strings.TrimSpace(os.Getenv("MUSIC3_EVENT_LOG_PATH")); value != "" {
		return value
	}
	return "/opt/manifoldgen-site/logs/music3-events.jsonl"
}

func recordMusic3Event(event, jobID string, detail map[string]interface{}) {
	entry := map[string]interface{}{
		"timestamp": time.Now().Unix(),
		"event":     event,
		"job_id":    jobID,
	}
	for key, value := range detail {
		entry[key] = value
	}
	encoded, err := json.Marshal(entry)
	if err != nil {
		log.Printf("[music3] event encoding failed event=%s job=%s: %v", event, jobID, err)
		return
	}
	path := music3EventPath()
	music3EventMu.Lock()
	defer music3EventMu.Unlock()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		log.Printf("[music3] event directory failed: %v", err)
		return
	}
	if info, statErr := os.Stat(path); statErr == nil && info.Size() >= 8<<20 {
		_ = os.Remove(path + ".1")
		if err := os.Rename(path, path+".1"); err != nil {
			log.Printf("[music3] event rotation failed: %v", err)
		}
	}
	file, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Printf("[music3] event log unavailable: %v", err)
		return
	}
	if _, err := file.Write(append(encoded, '\n')); err != nil {
		log.Printf("[music3] event write failed: %v", err)
	}
	_ = file.Close()
}

type music3StoredRequest struct {
	Prompt   string `json:"prompt"`
	Lyrics   string `json:"lyrics,omitempty"`
	Duration int    `json:"duration"`
	Seed     int64  `json:"seed"`
}

type music3RunpodStatus struct {
	ID            string `json:"id"`
	Status        string `json:"status"`
	Error         string `json:"error"`
	ExecutionTime int64  `json:"executionTime"`
	Output        struct {
		AudioURL string                 `json:"audio_url"`
		Model    string                 `json:"model"`
		Route    string                 `json:"route"`
		Seed     int64                  `json:"seed"`
		Metrics  map[string]interface{} `json:"metrics"`
	} `json:"output"`
}

func music3EndpointID() string {
	return strings.TrimSpace(os.Getenv("MUSIC3_RUNPOD_ENDPOINT_ID"))
}

func music3GPUUSDPerHour() float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_RUNPOD_GPU_USD_PER_HOUR")), 64)
	if err != nil || value <= 0 {
		return music3DefaultGPUUSDPerHour
	}
	return value
}

// Measured on H200: MiniMax-Music3 renders about 2.2x faster than real time.
func music3RealtimeFactor() float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_REALTIME_FACTOR")), 64); err == nil && value > 0 {
		return value
	}
	return 0.46
}

// A cold start is shared by the tracks that arrive before the worker idles out,
// so only a share of it belongs to any one track.
func music3ColdStartAmortization() float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_COLD_START_AMORTIZATION")), 64); err == nil && value >= 1 {
		return value
	}
	return 2
}

func music3PriceMarginMultiple() float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_PRICE_MARGIN")), 64); err == nil && value >= 1 {
		return value
	}
	return 1.5
}

// music3FloorPriceUSD is what the GPU time behind one track costs, plus margin.
// It is a guard rather than the headline price: if GPU rates move, the public
// price follows rather than quietly going underwater.
func music3FloorPriceUSD(duration int) float64 {
	gpuSeconds := float64(duration)*music3RealtimeFactor() + music3ColdStartSeconds()/music3ColdStartAmortization()
	return gpuSeconds * music3GPUUSDPerHour() / 3600 * music3PriceMarginMultiple()
}

// Price from output length, never below what the render costs to produce.
func music3PublicPriceUSD(duration int) float64 {
	price := 0.25 + 0.15*float64(duration)/60
	if floor := music3FloorPriceUSD(duration); price < floor {
		price = floor
	}
	if price < 0.35 {
		price = 0.35
	}
	return math.Round(price*100) / 100
}

func music3PromptGuard(prompt, lyrics string) error {
	combined := strings.ToLower(prompt + "\n" + lyrics)
	for _, phrase := range []string{
		"child sexual", "sexual minor", "terrorist propaganda", "kill myself",
		"impersonate ", "deepfake voice", "sound exactly like ", "voice clone",
	} {
		if strings.Contains(combined, phrase) {
			return fmt.Errorf("the music request conflicts with generation safeguards")
		}
	}
	return nil
}

func music3UploadTarget(userID string) (string, string, error) {
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	objectKey := fmt.Sprintf("%s/%s/audio/%s-minimax-music3.wav", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID())
	uploadURL, err := presignR2PutObject(objectKey, "audio/wav", 3600)
	if err != nil {
		return "", "", err
	}
	return uploadURL, fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func submitMusic3Job(user *User, prompt, lyrics string, duration int) (*VideoJob, error) {
	endpointID := music3EndpointID()
	if endpointID == "" {
		return nil, fmt.Errorf("Music3 endpoint is not configured")
	}
	if err := music3PromptGuard(prompt, lyrics); err != nil {
		return nil, err
	}
	uploadURL, publicURL, err := music3UploadTarget(user.ID)
	if err != nil {
		return nil, err
	}
	music3TuneCapacity(endpointID)
	seed := time.Now().UnixNano() & math.MaxInt64
	input := map[string]interface{}{
		"workload": "minimax-music3", "prompt": prompt, "duration_seconds": duration,
		"seed": seed, "output_upload_url": uploadURL, "output_public_url": publicURL,
	}
	if structured := music3StructureLyrics(lyrics); structured != "" {
		input["lyrics"] = structured
	}
	var queued h3RunpodQueuedJob
	status, err := callH3Runpod(endpointID, "/run", http.MethodPost, map[string]interface{}{"input": input}, &queued)
	if err != nil || queued.ID == "" {
		if err != nil {
			return nil, err
		}
		return nil, fmt.Errorf("Music3 returned no job (status %d)", status)
	}
	job, err := dbConn.CreateVideoJobForService(user.ID, "runpod:"+endpointID+":"+queued.ID, "music_generation", prompt)
	if err != nil {
		_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(queued.ID), http.MethodPost, nil, nil)
		return nil, err
	}
	stored, _ := json.Marshal(map[string]interface{}{
		"_music3_request":   music3StoredRequest{Prompt: prompt, Lyrics: lyrics, Duration: duration, Seed: seed},
		"output_public_url": publicURL,
	})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(queued.ID), http.MethodPost, nil, nil)
		return nil, err
	}
	launchVideoJob(job.ID)
	return job, nil
}

func handleMusic3Generation(ctx *fasthttp.RequestCtx, user *User, prompt, lyrics string, duration int, service string) {
	if err := music3PromptGuard(prompt, lyrics); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	job, err := submitMusic3Job(user, prompt, lyrics, duration)
	if err != nil {
		log.Printf("[music3] submission failed: %v", err)
		recordMusic3Event("music3_job_error", "", map[string]interface{}{"stage": "submission", "error": err.Error()})
		jsonError(ctx, http.StatusServiceUnavailable, "music generation is temporarily unavailable")
		return
	}
	recordMusic3Event("music3_job_queued", job.ID, map[string]interface{}{"duration_seconds": duration})
	price := music3PublicPriceUSD(duration)
	credits := 0.0
	if cutePrice := getCUTEPriceUSD(); cutePrice > 0 {
		credits = price / cutePrice
	}
	jsonResponse(ctx, http.StatusAccepted, map[string]interface{}{
		"service": service, "kind": "music", "model": "MiniMax-Music3",
		"result": map[string]interface{}{
			"job_id": job.ID, "status": job.Status, "status_url": "/api/audio-jobs/" + job.ID,
		},
		"estimated_cost_usd": price, "estimated_credits": credits,
		"settlement": "charged after successful generation",
	})
}

func music3RequestFromJob(job *VideoJob) music3StoredRequest {
	var stored struct {
		Request music3StoredRequest `json:"_music3_request"`
	}
	if job != nil {
		_ = json.Unmarshal(job.Result, &stored)
	}
	return stored.Request
}

func processMusic3Job(job *VideoJob) {
	endpointID, providerJobID, ok := parseRunpodH3ProviderJob(job.ProviderJobID)
	if !ok {
		log.Printf("[music3] invalid provider job id job=%s", job.ID)
		recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "provider_job_id"})
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music generation is temporarily unavailable")
		return
	}
	_ = dbConn.UpdateVideoJob(job.ID, "processing", nil, "")
	deadline := time.Now().Add(45 * time.Minute)
	consecutiveErrors := 0
	for time.Now().Before(deadline) {
		var state music3RunpodStatus
		_, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(providerJobID), http.MethodGet, nil, &state)
		if err != nil {
			consecutiveErrors++
			if consecutiveErrors >= 10 {
				log.Printf("[music3] status unavailable job=%s: %v", job.ID, err)
				recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "status", "error": err.Error()})
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music generation is temporarily unavailable")
				return
			}
			time.Sleep(3 * time.Second)
			continue
		}
		consecutiveErrors = 0
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED":
			if strings.TrimSpace(state.Output.AudioURL) == "" {
				log.Printf("[music3] generation returned no audio job=%s", job.ID)
				recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "output", "error": "missing audio URL"})
				_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music generation returned no audio")
				return
			}
			request := music3RequestFromJob(job)
			predictSeconds := math.Max(float64(state.ExecutionTime)/1000, 1)
			providerUSD := music3GPUUSDPerHour() * predictSeconds / 3600
			chargedUSD := music3PublicPriceUSD(request.Duration)
			cutePrice := getCUTEPriceUSD()
			if cutePrice <= 0 || math.IsNaN(cutePrice) || math.IsInf(cutePrice, 0) {
				log.Printf("[music3] pricing unavailable job=%s", job.ID)
				recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "pricing"})
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "pricing is temporarily unavailable")
				return
			}
			result, _ := json.Marshal(map[string]interface{}{
				"service": "music", "kind": "music", "audio_id": h3AudioID(job),
				"audio_url": state.Output.AudioURL, "duration_seconds": request.Duration,
				"model": "MiniMax-Music3", "seed": state.Output.Seed,
				"provider": "runpod", "provider_cost_usd": providerUSD,
				"charged_usd": chargedUSD, "metrics": state.Output.Metrics,
			})
			_, _, settleErr := dbConn.SettleGeneratedVideoJob(job.ID, result, providerUSD, chargedUSD, cutePrice)
			if settleErr == ErrVideoPaymentRequired {
				recordMusic3Event("music3_job_payment_required", job.ID, map[string]interface{}{"provider_cost_usd": providerUSD})
				return
			}
			if settleErr != nil {
				log.Printf("[music3] settlement failed job=%s: %v", job.ID, settleErr)
				recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "settlement", "error": settleErr.Error()})
				_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "music settlement is temporarily unavailable")
				return
			}
			indexCompletedH3Asset(job, result)
			maybeTriggerAutoTopup(job.UserID)
			recordMusic3Event("music3_job_completed", job.ID, map[string]interface{}{
				"duration_seconds": request.Duration, "execution_seconds": predictSeconds,
				"provider_cost_usd": providerUSD, "charged_usd": chargedUSD,
			})
			return
		case "FAILED", "CANCELLED", "TIMED_OUT":
			if state.Error != "" {
				log.Printf("[music3] generation failed job=%s: %s", job.ID, state.Error)
			}
			recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "generation", "status": state.Status, "error": state.Error})
			_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music generation failed; no credits were charged")
			return
		}
		time.Sleep(3 * time.Second)
	}
	log.Printf("[music3] generation timed out job=%s", job.ID)
	recordMusic3Event("music3_job_error", job.ID, map[string]interface{}{"stage": "timeout"})
	_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "music generation timed out; no credits were charged")
}
