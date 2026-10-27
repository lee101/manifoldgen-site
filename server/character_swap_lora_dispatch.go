package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

const (
	loraMaxBatchClips     = 6
	loraColdTargetSeconds = 360.0
	loraDefaultQueueGrace = 4 * time.Minute
	loraDefaultInitGrace  = 15 * time.Minute
	loraRetryDelay        = 10 * time.Second
	loraBatchBaseTimeout  = 20 * time.Minute
	loraBatchClipTimeout  = 15 * time.Minute
	loraCapacityMessage   = "GPU capacity for the character swap LoRA lane is unavailable right now. The video was not charged; try again in a few minutes."
)

var (
	loraStatusInterval = 5 * time.Second
	loraHealthInterval = 15 * time.Second
	loraRetryBackoff   = loraRetryDelay
)

type loraCapacityError struct{ reason string }

func (e *loraCapacityError) Error() string { return "lora capacity unavailable: " + e.reason }

func loraEnvSeconds(name string, fallback time.Duration) time.Duration {
	if value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(name))); err == nil && value > 0 {
		return time.Duration(value) * time.Second
	}
	return fallback
}

func loraQueueGrace() time.Duration {
	return loraEnvSeconds("H3_SWAP_QUEUE_GRACE_SECONDS", loraDefaultQueueGrace)
}
func loraInitGrace() time.Duration {
	return loraEnvSeconds("H3_SWAP_INIT_GRACE_SECONDS", loraDefaultInitGrace)
}

func loraEnvOff(name string) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(name))) {
	case "0", "false", "off", "no":
		return true
	}
	return false
}

func loraBatchEnabled() bool { return !loraEnvOff("H3_SWAP_BATCH") }

func loraWorkersMax() int {
	if value, err := strconv.Atoi(strings.TrimSpace(os.Getenv("H3_SWAP_WORKERS_MAX"))); err == nil && value > 0 {
		return value
	}
	return loraSlots
}

type loraHealth struct {
	Jobs struct {
		Completed  int `json:"completed"`
		Failed     int `json:"failed"`
		InProgress int `json:"inProgress"`
		InQueue    int `json:"inQueue"`
	} `json:"jobs"`
	Workers struct {
		Idle         int `json:"idle"`
		Initializing int `json:"initializing"`
		Ready        int `json:"ready"`
		Running      int `json:"running"`
		Throttled    int `json:"throttled"`
		Unhealthy    int `json:"unhealthy"`
	} `json:"workers"`
}

func (h loraHealth) serving() int { return h.Workers.Idle + h.Workers.Ready + h.Workers.Running }
func (h loraHealth) active() int  { return h.serving() + h.Workers.Initializing }

var fetchLoraHealth = func(endpointID string) (loraHealth, error) {
	var health loraHealth
	_, err := callH3Runpod(endpointID, "/health", http.MethodGet, nil, &health)
	return health, err
}

type loraCapacityWatch struct {
	grace, initGrace time.Duration
	noWorkersSince   time.Time
	noServingSince   time.Time
}

func (w *loraCapacityWatch) observe(health loraHealth, waiting bool, now time.Time) string {
	if !waiting && health.Jobs.InQueue == 0 {
		w.noWorkersSince, w.noServingSince = time.Time{}, time.Time{}
		return ""
	}
	if health.active() == 0 {
		if w.noWorkersSince.IsZero() {
			w.noWorkersSince = now
		}
		if now.Sub(w.noWorkersSince) >= w.grace {
			return fmt.Sprintf("no GPU worker could be started for %s (queued %d, throttled %d)", now.Sub(w.noWorkersSince).Round(time.Second), health.Jobs.InQueue, health.Workers.Throttled)
		}
	} else {
		w.noWorkersSince = time.Time{}
	}
	if health.serving() == 0 && health.Workers.Initializing > 0 {
		if w.noServingSince.IsZero() {
			w.noServingSince = now
		}
		if now.Sub(w.noServingSince) >= w.initGrace {
			return fmt.Sprintf("workers have been initializing for %s without serving", now.Sub(w.noServingSince).Round(time.Second))
		}
	} else {
		w.noServingSince = time.Time{}
	}
	return ""
}

func planLoraBatches(pending []int, workers, maxPerBatch int) [][]int {
	if len(pending) == 0 {
		return nil
	}
	if maxPerBatch < 1 {
		maxPerBatch = 1
	}
	count := workers
	if count < 1 {
		count = 1
	}
	if minimum := int(math.Ceil(float64(len(pending)) / float64(maxPerBatch))); count < minimum {
		count = minimum
	}
	if count > len(pending) {
		count = len(pending)
	}
	batches := make([][]int, 0, count)
	next := 0
	for b := 0; b < count; b++ {
		size := len(pending) / count
		if b < len(pending)%count {
			size++
		}
		batches = append(batches, pending[next:next+size])
		next += size
	}
	return batches
}

func loraClipGPUSeconds(req ServiceUsageRequest, chunk characterSwapChunk) float64 {
	return chunk.Length*loraTiers[req.ServiceTier].GPUSecondsPerSecond*loraResolutions[req.Resolution].Multiplier + 18
}

func loraColdWorkers(req ServiceUsageRequest, chunks []characterSwapChunk, pending []int, workersMax int) int {
	total := 0.0
	for _, i := range pending {
		total += loraClipGPUSeconds(req, chunks[i])
	}
	workers := int(math.Ceil(total / loraColdTargetSeconds))
	if workers > workersMax {
		workers = workersMax
	}
	if workers < 1 {
		workers = 1
	}
	return workers
}

func loraAvailableWorkers(health loraHealth, healthErr error, cold, workersMax int) int {
	if healthErr == nil && health.active() > 0 {
		if health.active() > workersMax {
			return workersMax
		}
		return health.active()
	}
	return cold
}

func loraBatchTimeout(clips int) time.Duration {
	timeout := loraBatchBaseTimeout + time.Duration(clips)*loraBatchClipTimeout
	if timeout > runpodMaxExecutionTimeout {
		return runpodMaxExecutionTimeout
	}
	return timeout
}

type loraTarget struct{ upload, public string }

func loraClipInput(state characterSwapState, chunk characterSwapChunk, attempt int) map[string]interface{} {
	input := map[string]interface{}{"video_url": chunk.SourceURL}
	if state.Request.Seed != 0 {
		input["seed"] = state.Request.Seed + chunk.Index
	}
	if attempt > 0 {
		input["seed"] = 1000 + chunk.Index*7 + attempt
	}
	return input
}

func loraBatchInput(state characterSwapState, chunks []characterSwapChunk, attempts []int, userID string, legacy bool) (map[string]interface{}, map[int]string, error) {
	input := loraInput(state, chunks[0])
	delete(input, "video_url")
	delete(input, "seed")
	expected := make(map[int]string, len(chunks))
	if legacy {
		clip := loraClipInput(state, chunks[0], attempts[chunks[0].Index])
		input["video_url"] = clip["video_url"]
		if seed, ok := clip["seed"]; ok {
			input["seed"] = seed
		}
		if err := prepareH3RunpodOutputTarget(input, userID); err != nil {
			return nil, nil, err
		}
		expected[chunks[0].Index], _ = input["_output_public_url"].(string)
		return input, expected, nil
	}
	clips := make([]map[string]interface{}, 0, len(chunks))
	for _, chunk := range chunks {
		clip := loraClipInput(state, chunk, attempts[chunk.Index])
		clip["id"] = chunk.Index
		if err := prepareH3RunpodOutputTarget(clip, userID); err != nil {
			return nil, nil, err
		}
		expected[chunk.Index], _ = clip["_output_public_url"].(string)
		clips = append(clips, clip)
	}
	input["clips"] = clips
	return input, expected, nil
}

type loraClipOutput struct {
	Clip       *int                   `json:"clip"`
	Error      string                 `json:"error"`
	Outputs    []h3RunpodArtifact     `json:"outputs"`
	Metrics    map[string]interface{} `json:"metrics"`
	Moderation struct {
		Status string `json:"status"`
	} `json:"moderation"`
}

func parseLoraOutputs(raw json.RawMessage) []loraClipOutput {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	if raw[0] == '[' {
		var items []json.RawMessage
		if json.Unmarshal(raw, &items) != nil {
			return nil
		}
		var out []loraClipOutput
		for _, item := range items {
			out = append(out, parseLoraOutputs(item)...)
		}
		return out
	}
	var wrapped struct {
		Output json.RawMessage `json:"output"`
	}
	if json.Unmarshal(raw, &wrapped) == nil && len(wrapped.Output) > 0 && string(wrapped.Output) != "null" {
		return parseLoraOutputs(wrapped.Output)
	}
	var one loraClipOutput
	if json.Unmarshal(raw, &one) != nil {
		return nil
	}
	if one.Clip == nil && one.Error == "" && len(one.Outputs) == 0 && one.Moderation.Status == "" {
		return nil
	}
	return []loraClipOutput{one}
}

type loraRunStatus struct {
	Status        string          `json:"status"`
	Error         string          `json:"error"`
	ExecutionTime int64           `json:"executionTime"`
	Output        json.RawMessage `json:"output"`
}

type loraStream struct {
	Status string            `json:"status"`
	Stream []json.RawMessage `json:"stream"`
}

type loraClipDone struct {
	index   int
	url     string
	seconds float64
}

func waitLoraBatch(ctx context.Context, jobID, endpointID, runpodID string, expected map[int]string, queued *atomic.Int32,
	onClip func(loraClipDone), timeout time.Duration) (map[int]error, error) {
	failed := make(map[int]error)
	seen := make(map[int]bool)
	wasQueued := false
	setQueued := func(value bool) {
		if value != wasQueued {
			if value {
				queued.Add(1)
			} else {
				queued.Add(-1)
			}
			wasQueued = value
		}
	}
	defer setQueued(false)
	handle := func(items []loraClipOutput) {
		for _, item := range items {
			index := -1
			if item.Clip != nil {
				index = *item.Clip
			} else if len(expected) == 1 {
				for only := range expected {
					index = only
				}
			}
			want, known := expected[index]
			if !known || seen[index] {
				continue
			}
			if item.Error != "" {
				seen[index] = true
				failed[index] = fmt.Errorf("clip %d: %s", index+1, truncateString(item.Error, 160))
				continue
			}
			if len(item.Outputs) == 0 {
				seen[index] = true
				failed[index] = fmt.Errorf("clip %d: swap worker completed without a clip (moderation %s)", index+1, item.Moderation.Status)
				continue
			}
			videoURL, artifact, _, err := resolveH3RunpodArtifact(item.Outputs[0], want)
			if err == nil && videoURL == "" {
				videoURL, err = uploadH3RunpodVideo(ctx, artifact, "", item.Outputs[0].ContentType)
			}
			seen[index] = true
			if err != nil {
				failed[index] = fmt.Errorf("clip %d: %w", index+1, err)
				continue
			}
			seconds, _ := item.Metrics["generation_seconds"].(float64)
			onClip(loraClipDone{index: index, url: videoURL, seconds: seconds})
		}
	}
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if ctx.Err() != nil {
			runpodCancelBestEffort(endpointID, runpodID)
			return failed, ctx.Err()
		}
		if videoJobCancellationRequested(jobID) {
			runpodCancelBestEffort(endpointID, runpodID)
			return failed, fmt.Errorf("cancelled")
		}
		var status loraRunStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(runpodID), http.MethodGet, nil, &status); err != nil {
			sleepContext(ctx, loraStatusInterval)
			continue
		}
		state := strings.ToUpper(strings.TrimSpace(status.Status))
		setQueued(state == "IN_QUEUE")
		var stream loraStream
		if _, err := callH3Runpod(endpointID, "/stream/"+url.PathEscape(runpodID), http.MethodGet, nil, &stream); err == nil {
			for _, item := range stream.Stream {
				handle(parseLoraOutputs(item))
			}
		}
		switch state {
		case "COMPLETED":
			handle(parseLoraOutputs(status.Output))
			for index := range expected {
				if !seen[index] {
					failed[index] = fmt.Errorf("clip %d: the swap worker finished the batch without it", index+1)
				}
			}
			return failed, nil
		case "FAILED", "CANCELLED", "TIMED_OUT":
			reason := fmt.Errorf("swap worker %s: %s", strings.ToLower(status.Status), truncateString(status.Error, 200))
			for index := range expected {
				if !seen[index] {
					failed[index] = fmt.Errorf("clip %d: %w", index+1, reason)
				}
			}
			return failed, nil
		}
		sleepContext(ctx, loraStatusInterval)
	}
	runpodCancelBestEffort(endpointID, runpodID)
	for index := range expected {
		if !seen[index] {
			failed[index] = fmt.Errorf("clip %d did not finish in time", index+1)
		}
	}
	return failed, nil
}

func sleepContext(ctx context.Context, d time.Duration) {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
	case <-timer.C:
	}
}

var loraStockLookup = lookupLoraStock

func lookupLoraStock(endpointID string) (map[string]string, error) {
	var config struct {
		GPUTypeIDs []string `json:"gpuTypeIds"`
	}
	if err := h3ControlRequest(http.MethodGet, h3ControlBase()+"/endpoints/"+url.PathEscape(endpointID), nil, &config); err != nil {
		return nil, err
	}
	query := map[string]string{"query": "{ gpuTypes { id lowestPrice(input:{gpuCount:1}){ stockStatus } } }"}
	body, _ := json.Marshal(query)
	req, err := http.NewRequest(http.MethodPost, getEnv("H3_RUNPOD_GRAPHQL_URL", "https://api.runpod.io/graphql"), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+h3RunpodAPIKey())
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "manifoldgen-control/1.0")
	response, err := h3ScaleControlClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	var payload struct {
		Data struct {
			GPUTypes []struct {
				ID          string `json:"id"`
				LowestPrice *struct {
					StockStatus string `json:"stockStatus"`
				} `json:"lowestPrice"`
			} `json:"gpuTypes"`
		} `json:"data"`
	}
	if response.StatusCode >= 300 || json.NewDecoder(response.Body).Decode(&payload) != nil || len(payload.Data.GPUTypes) == 0 {
		return nil, fmt.Errorf("RunPod stock lookup failed")
	}
	levels := make(map[string]string, len(payload.Data.GPUTypes))
	for _, gpu := range payload.Data.GPUTypes {
		level := "None"
		if gpu.LowestPrice != nil && strings.TrimSpace(gpu.LowestPrice.StockStatus) != "" {
			level = gpu.LowestPrice.StockStatus
		}
		levels[gpu.ID] = level
	}
	pool := make(map[string]string, len(config.GPUTypeIDs))
	for _, id := range config.GPUTypeIDs {
		if level, ok := levels[id]; ok {
			pool[id] = level
		}
	}
	return pool, nil
}

func loraPoolStockEmpty(endpointID string) bool {
	if loraEnvOff("H3_SWAP_STOCK_PRECHECK") {
		return false
	}
	pool, err := loraStockLookup(endpointID)
	if err != nil || len(pool) == 0 {
		return false
	}
	for _, level := range pool {
		if !strings.EqualFold(level, "None") {
			return false
		}
	}
	return true
}

type loraRound struct {
	job        *VideoJob
	endpointID string
	state      *characterSwapState
	mu         *sync.Mutex
	persist    func()
	attempts   []int
}

func (r *loraRound) run(ctx context.Context, batches [][]int, watch *loraCapacityWatch) (map[int]error, error) {
	roundCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	var queued atomic.Int32
	var stallReason atomic.Value
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		ticker := time.NewTicker(loraHealthInterval)
		defer ticker.Stop()
		for {
			select {
			case <-roundCtx.Done():
				return
			case <-ticker.C:
				health, err := fetchLoraHealth(r.endpointID)
				if err != nil {
					continue
				}
				if reason := watch.observe(health, queued.Load() > 0, time.Now()); reason != "" {
					stallReason.Store(reason)
					cancel()
					return
				}
			}
		}
	}()

	var wg sync.WaitGroup
	var failMu sync.Mutex
	failures := make(map[int]error)
	for _, batch := range batches {
		wg.Add(1)
		go func(batch []int) {
			defer wg.Done()
			failed := r.runBatch(roundCtx, batch, &queued)
			failMu.Lock()
			for index, err := range failed {
				failures[index] = err
			}
			failMu.Unlock()
		}(batch)
	}
	wg.Wait()
	cancel()
	<-watcherDone
	if reason, ok := stallReason.Load().(string); ok && ctx.Err() == nil {
		return failures, &loraCapacityError{reason: reason}
	}
	return failures, ctx.Err()
}

func (r *loraRound) runBatch(ctx context.Context, batch []int, queued *atomic.Int32) map[int]error {
	failAll := func(err error) map[int]error {
		out := make(map[int]error, len(batch))
		for _, index := range batch {
			out[index] = fmt.Errorf("clip %d: %w", index+1, err)
		}
		return out
	}
	r.mu.Lock()
	chunks := make([]characterSwapChunk, 0, len(batch))
	for _, index := range batch {
		chunks = append(chunks, r.state.Chunks[index])
	}
	state := *r.state
	attempts := append([]int(nil), r.attempts...)
	r.mu.Unlock()
	if videoJobCancellationRequested(r.job.ID) {
		return failAll(fmt.Errorf("cancelled"))
	}
	legacy := !loraBatchEnabled()
	if legacy && len(batch) > 1 {
		out := make(map[int]error)
		for _, index := range batch {
			for i, err := range r.runBatch(ctx, []int{index}, queued) {
				out[i] = err
			}
		}
		return out
	}
	input, expected, err := loraBatchInput(state, chunks, attempts, r.job.UserID, legacy)
	if err != nil {
		return failAll(fmt.Errorf("could not prepare the clip upload"))
	}
	var job h3RunpodQueuedJob
	timeout := loraBatchTimeout(len(batch))
	if _, err := submitLoraRunpod(r.endpointID, input, &job, timeout); err != nil || job.ID == "" {
		log.Printf("[character-swap-lora] job=%s batch=%v submit: %v", r.job.ID, batch, err)
		return failAll(fmt.Errorf("swap worker rejected the batch"))
	}
	r.mu.Lock()
	for _, index := range batch {
		r.state.Chunks[index].RequestID, r.state.Chunks[index].Status = job.ID, "queued"
	}
	r.mu.Unlock()
	r.persist()
	failed, err := waitLoraBatch(ctx, r.job.ID, r.endpointID, job.ID, expected, queued, func(done loraClipDone) {
		r.mu.Lock()
		chunk := &r.state.Chunks[done.index]
		chunk.OutputURL, chunk.Status, chunk.Retries = done.url, "completed", r.attempts[done.index]
		chunk.ProviderUSD += done.seconds * loraGPUUSDPerSecond()
		r.mu.Unlock()
		r.persist()
	}, timeout)
	if err != nil {
		r.mu.Lock()
		for _, index := range batch {
			if _, bad := failed[index]; !bad && r.state.Chunks[index].Status != "completed" {
				failed[index] = fmt.Errorf("clip %d: %w", index+1, err)
			}
		}
		r.mu.Unlock()
	}
	return failed
}

func runLoraClips(ctx context.Context, job *VideoJob, endpointID string, state *characterSwapState, mu *sync.Mutex, persist func()) error {
	attempts := make([]int, len(state.Chunks))
	lastErr := make([]error, len(state.Chunks))
	round := &loraRound{job: job, endpointID: endpointID, state: state, mu: mu, persist: persist, attempts: attempts}
	watch := &loraCapacityWatch{grace: loraQueueGrace(), initGrace: loraInitGrace()}
	workersMax := loraWorkersMax()
	for pass := 0; ; pass++ {
		mu.Lock()
		var pending []int
		for i, chunk := range state.Chunks {
			if chunk.Status != "completed" || chunk.OutputURL == "" {
				pending = append(pending, i)
			}
		}
		mu.Unlock()
		if len(pending) == 0 {
			return nil
		}
		for _, i := range pending {
			if attempts[i] >= loraMaxAttempts {
				return lastErr[i]
			}
		}
		if videoJobCancellationRequested(job.ID) {
			return fmt.Errorf("cancelled")
		}
		health, healthErr := fetchLoraHealth(endpointID)
		if pass == 0 && healthErr == nil && health.active() == 0 && loraPoolStockEmpty(endpointID) {
			return &loraCapacityError{reason: "every GPU type of the pool reports no stock"}
		}
		if pass > 0 {
			sleepContext(ctx, loraRetryBackoff)
		}
		mu.Lock()
		cold := loraColdWorkers(state.Request, state.Chunks, pending, workersMax)
		mu.Unlock()
		workers := loraAvailableWorkers(health, healthErr, cold, workersMax)
		batches := planLoraBatches(pending, workers, loraMaxBatchClips)
		log.Printf("[character-swap-lora] job=%s pass=%d pending=%d workers=%d (active=%d queued=%d) batches=%d", job.ID, pass, len(pending), workers, health.active(), health.Jobs.InQueue, len(batches))
		failures, err := round.run(ctx, batches, watch)
		var capacity *loraCapacityError
		if errors.As(err, &capacity) {
			return capacity
		}
		if err != nil {
			return err
		}
		mu.Lock()
		for _, i := range pending {
			if state.Chunks[i].Status == "completed" && state.Chunks[i].OutputURL != "" {
				continue
			}
			attempts[i]++
			lastErr[i] = failures[i]
			if lastErr[i] == nil {
				lastErr[i] = fmt.Errorf("clip %d did not complete", i+1)
			}
			state.Chunks[i].Status = "failed"
			log.Printf("[character-swap-lora] job=%s clip=%d attempt=%d: %v", job.ID, i, attempts[i], lastErr[i])
			if lastErr[i].Error() == "cancelled" || strings.HasSuffix(lastErr[i].Error(), ": cancelled") {
				mu.Unlock()
				return fmt.Errorf("cancelled")
			}
		}
		mu.Unlock()
	}
}
