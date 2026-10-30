package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Flex lane: MiniMax H3 plus the Pika H3 Flex adapter (six NFE on fixed knots,
// worker profile pika-6), served from the RunPod endpoint named by
// H3_FLEX_RUNPOD_ENDPOINT. When set it replaces fal H3 Max as the normal lane;
// adult prompts keep their own lanes. Benchmarked 2026-10-30 against fal H3 Max
// and the 20-step worker in results/h3-flex-bench (same quality at native 768p,
// a fraction of the fal cost). Users pay a fixed list price: the fal H3 Max
// price (fal rate x h3FalMarkup) up to 768p, and h3FlexHDUSDPerSecond for
// 1080p, which fal cannot render. A job that no worker starts within
// H3_FLEX_FAL_PATIENCE (default 90s, 0 disables) moves to fal H3 Max at the
// same price.
const (
	h3FlexVariant            = "flex-h3"
	h3FlexHDMaxDuration      = 10
	h3FlexFalPatienceDefault = 90 * time.Second
	h3FlexNative5sSeconds    = 55.0
	// 1080p list price per second (env H3_FLEX_HD_USD_PER_SECOND). A 5 s clip
	// takes ~150 s on an RTX PRO 6000 (~$0.17 at serverless rates).
	h3FlexHDUSDPerSecond = 0.15
)

// Warm seconds for a 5 s clip per worker size on the flex endpoint's primary
// GPU (RTX PRO 6000, native nvfp4 text encoder), measured on the bench pods:
// text encode + six steps + VAE decode + encode. Settlement uses the metered
// execution time; this only drives quotes and the credit preflight. Duration
// scales super-linearly with attention cost.
var h3FlexSizeSeconds = map[string]float64{
	"preview":  28,
	"balanced": 42,
	"native":   h3FlexNative5sSeconds,
	"hd":       150,
	"audio":    20,
}

func h3FlexLane() (h3WorkerRoute, bool) {
	if ep := strings.TrimSpace(os.Getenv("H3_FLEX_RUNPOD_ENDPOINT")); ep != "" {
		return h3WorkerRoute{Variant: h3FlexVariant, RunpodEndpointID: ep}, true
	}
	return h3WorkerRoute{}, false
}

// prepareH3FlexRequest adapts a normalized request to the flex worker: the
// default size renders at native 1344x768 (the resolution fal H3 Max served
// for it), and 1080p ("hd") is limited to short clips.
func prepareH3FlexRequest(req *ServiceUsageRequest) error {
	if req.Size == "balanced" {
		req.Size = "native"
	}
	if req.Size == "hd" && req.Duration > h3FlexHDMaxDuration {
		return fmt.Errorf("1080p video supports up to %d seconds", h3FlexHDMaxDuration)
	}
	return nil
}

func h3FlexPredictSeconds(req ServiceUsageRequest) float64 {
	base, ok := h3FlexSizeSeconds[req.Size]
	if !ok {
		base = h3FlexNative5sSeconds
	}
	duration := float64(req.Duration)
	if duration <= 0 {
		duration = 5
	}
	if duration <= 15 {
		return base * math.Pow(duration/5, 1.35)
	}
	// Longer pictures chain 5 s segments on the worker: linear past one shot.
	return base * math.Pow(3, 1.35) * duration / 15
}

// h3FlexListPriceUSD is the fixed user price of a flex job. Sound-only jobs
// ("audio" size) report false and keep metered pricing.
func h3FlexListPriceUSD(req ServiceUsageRequest) (float64, bool) {
	if req.Size == "audio" {
		return 0, false
	}
	duration := req.Duration
	if duration <= 0 {
		duration = 5
	}
	var usd float64
	if req.Size == "hd" {
		rate := h3FlexHDUSDPerSecond
		if raw := strings.TrimSpace(os.Getenv("H3_FLEX_HD_USD_PER_SECOND")); raw != "" {
			if parsed, err := strconv.ParseFloat(raw, 64); err == nil && parsed > 0 {
				rate = parsed
			}
		}
		usd = rate * float64(duration)
	} else {
		req.Duration = duration
		usd = h3FalProviderCost(req) * h3FalMarkup
	}
	return math.Ceil(usd*100-1e-9) / 100, true
}

func h3FlexFalPatience() time.Duration {
	raw := strings.TrimSpace(os.Getenv("H3_FLEX_FAL_PATIENCE"))
	if raw == "" {
		return h3FlexFalPatienceDefault
	}
	if raw == "0" {
		return 0
	}
	if d, err := time.ParseDuration(raw); err == nil && d >= 0 {
		return d
	}
	if seconds, err := strconv.Atoi(raw); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second
	}
	return h3FlexFalPatienceDefault
}

// h3FlexStoredRequest rebuilds the user's request from the persisted worker
// input; driving audio is stored under the worker's "audio" key.
func h3FlexStoredRequest(job *VideoJob) (ServiceUsageRequest, bool) {
	var req ServiceUsageRequest
	var raw map[string]interface{}
	if len(job.Result) == 0 || json.Unmarshal(job.Result, &req) != nil || json.Unmarshal(job.Result, &raw) != nil {
		return req, false
	}
	if audio, _ := raw["audio"].(string); strings.TrimSpace(audio) != "" {
		req.AudioURL = audio
	}
	if req.Prompt == "" {
		req.Prompt = job.Prompt
	}
	return req, true
}

// fallbackFlexToFal moves a queue-starved flex job to fal H3 Max. The user is
// charged the flex quote (stored as _charge_cap_usd), never the fal price.
func fallbackFlexToFal(job *VideoJob, endpointID, providerJobID string) bool {
	patience := h3FlexFalPatience()
	if patience == 0 || time.Since(job.CreatedAt) < patience || strings.TrimSpace(falAPIKey) == "" {
		return false
	}
	req, ok := h3FlexStoredRequest(job)
	if !ok || req.Size == "hd" || !h3FalCanHandle(req) {
		return false
	}
	capUSD, _, _ := h3Estimate(withH3Lane(req, h3FlexVariant))
	// Submit to fal first so a fal outage never leaves the job with no provider.
	providerID, err := submitFalH3Max(req)
	if err != nil {
		log.Printf("[h3-flex] fal fallback submit failed job=%s: %v", job.ID, err)
		return false
	}
	var cancelled h3RunpodQueuedJob
	_, cancelErr := callH3Runpod(endpointID, "/cancel/"+url.PathEscape(providerJobID), http.MethodPost, nil, &cancelled)
	if status := strings.ToUpper(strings.TrimSpace(cancelled.Status)); cancelErr != nil || (status != "CANCELLED" && status != "CANCELED") {
		// A worker picked the job up meanwhile: keep it and drop the fal request.
		cancelFalH3Request(providerID)
		return false
	}
	input := h3FalPayload(req)
	input["_h3_variant"] = "h3-max"
	input["_charge_cap_usd"] = capUSD
	input["_fallback_from"] = h3FlexVariant
	if err := dbConn.RequeueVideoJobProvider(job.ID, providerID, persistH3Request(req, input)); err != nil {
		log.Printf("[h3-flex] fal fallback persistence failed job=%s: %v", job.ID, err)
		return false
	}
	log.Printf("[h3-flex] job=%s queued %s on %s, moved to fal H3 Max (charge cap $%.4f)", job.ID, time.Since(job.CreatedAt).Round(time.Second), endpointID, capUSD)
	launchVideoJob(job.ID)
	return true
}

func cancelFalH3Request(providerID string) {
	if _, requestID, ok := parseFalH3ProviderJob(providerID); ok {
		endpoint := strings.TrimRight(falQueueBaseURL, "/") + "/minimax/h3-max/requests/" + url.PathEscape(requestID) + "/cancel"
		_, _, _ = callFalQueue(http.MethodPut, endpoint, nil)
	}
}

func withH3Lane(req ServiceUsageRequest, lane string) ServiceUsageRequest {
	req.H3Lane = lane
	return req
}

// h3StoredChargeCap returns the price promised before a lane switch, if any.
func h3StoredChargeCap(job *VideoJob) float64 {
	var stored struct {
		Cap float64 `json:"_charge_cap_usd"`
	}
	if len(job.Result) > 0 && json.Unmarshal(job.Result, &stored) == nil && stored.Cap > 0 {
		return stored.Cap
	}
	return 0
}
