package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestPlanLoraBatchesBalancedAndCapped(t *testing.T) {
	pending := []int{0, 1, 2, 3, 4, 5, 6, 7, 8}
	cases := []struct {
		workers, max int
		sizes        []int
	}{
		{1, 6, []int{5, 4}},
		{3, 6, []int{3, 3, 3}},
		{4, 6, []int{3, 2, 2, 2}},
		{20, 6, []int{1, 1, 1, 1, 1, 1, 1, 1, 1}},
		{0, 20, []int{9}},
	}
	for _, c := range cases {
		batches := planLoraBatches(pending, c.workers, c.max)
		if len(batches) != len(c.sizes) {
			t.Fatalf("workers=%d max=%d: got %d batches %v", c.workers, c.max, len(batches), batches)
		}
		next := 0
		for i, batch := range batches {
			if len(batch) != c.sizes[i] {
				t.Fatalf("workers=%d: batch %d size %d want %d (%v)", c.workers, i, len(batch), c.sizes[i], batches)
			}
			for _, index := range batch {
				if index != pending[next] {
					t.Fatalf("batches must keep clip order: %v", batches)
				}
				next++
			}
		}
	}
	if planLoraBatches(nil, 3, 6) != nil {
		t.Fatal("no pending clips must plan nothing")
	}
}

func TestLoraAvailableWorkersAndColdTarget(t *testing.T) {
	var health loraHealth
	health.Workers.Running, health.Workers.Initializing = 1, 1
	if got := loraAvailableWorkers(health, nil, 3, 4); got != 2 {
		t.Fatalf("active workers should win: %d", got)
	}
	health.Workers.Idle = 9
	if got := loraAvailableWorkers(health, nil, 3, 4); got != 4 {
		t.Fatalf("workers are capped by workersMax: %d", got)
	}
	if got := loraAvailableWorkers(loraHealth{}, nil, 3, 4); got != 3 {
		t.Fatalf("cold pool uses the target: %d", got)
	}
	if got := loraAvailableWorkers(health, fmt.Errorf("down"), 3, 4); got != 3 {
		t.Fatalf("unknown health uses the target: %d", got)
	}
	req := ServiceUsageRequest{Resolution: "768p", ServiceTier: "standard"}
	chunks, _ := planLoraChunks(30, nil)
	pending := make([]int, len(chunks))
	for i := range pending {
		pending[i] = i
	}
	if got := loraColdWorkers(req, chunks, pending, 4); got != 4 {
		t.Fatalf("768p 30s needs the whole pool, got %d", got)
	}
	short := ServiceUsageRequest{Resolution: "480p", ServiceTier: "fast"}
	if got := loraColdWorkers(short, chunks, pending[:1], 4); got != 1 {
		t.Fatalf("one fast clip needs one worker, got %d", got)
	}
}

func TestLoraCapacityWatch(t *testing.T) {
	watch := &loraCapacityWatch{grace: 4 * time.Minute, initGrace: 15 * time.Minute}
	start := time.Now()
	var empty loraHealth
	empty.Jobs.InQueue = 3
	if watch.observe(empty, true, start) != "" || watch.observe(empty, true, start.Add(3*time.Minute)) != "" {
		t.Fatal("must wait for the grace")
	}
	if watch.observe(empty, true, start.Add(4*time.Minute+time.Second)) == "" {
		t.Fatal("queued jobs without any worker past the grace must stall")
	}
	var starting loraHealth
	starting.Workers.Initializing = 1
	starting.Jobs.InQueue = 1
	if watch.observe(starting, true, start.Add(5*time.Minute)) != "" {
		t.Fatal("an initializing worker resets the no-worker clock")
	}
	if watch.observe(starting, true, start.Add(21*time.Minute)) == "" {
		t.Fatal("a worker initializing past the init grace must stall")
	}
	var serving loraHealth
	serving.Workers.Running = 1
	serving.Jobs.InQueue = 5
	if watch.observe(serving, true, start.Add(60*time.Minute)) != "" {
		t.Fatal("a serving pool is never stalled, however long the queue")
	}
	idle := &loraCapacityWatch{grace: time.Second, initGrace: time.Second}
	if idle.observe(loraHealth{}, false, start) != "" || idle.observe(loraHealth{}, false, start.Add(time.Hour)) != "" {
		t.Fatal("an empty queue with no workers is simply scaled to zero")
	}
	var throttled loraHealth
	throttled.Workers.Throttled = 2
	throttled.Jobs.InQueue = 1
	zero := &loraCapacityWatch{grace: time.Second, initGrace: time.Hour}
	zero.observe(throttled, true, start)
	if zero.observe(throttled, true, start.Add(2*time.Second)) == "" {
		t.Fatal("throttled workers are not capacity")
	}
}

func TestParseLoraOutputsShapes(t *testing.T) {
	aggregated := parseLoraOutputs(json.RawMessage(`[{"clip":0,"outputs":[{"url":"u"}]},{"clip":1,"error":"boom"}]`))
	if len(aggregated) != 2 || *aggregated[0].Clip != 0 || aggregated[1].Error != "boom" {
		t.Fatalf("aggregated list: %+v", aggregated)
	}
	wrapped := parseLoraOutputs(json.RawMessage(`{"output":{"clip":2,"outputs":[{"url":"u"}]}}`))
	if len(wrapped) != 1 || *wrapped[0].Clip != 2 {
		t.Fatalf("stream item: %+v", wrapped)
	}
	legacy := parseLoraOutputs(json.RawMessage(`{"outputs":[{"url":"u"}],"metrics":{"generation_seconds":3}}`))
	if len(legacy) != 1 || legacy[0].Clip != nil {
		t.Fatalf("old single-clip object: %+v", legacy)
	}
	for _, empty := range []string{``, `null`, `{}`, `[]`, `{"output":null}`, `{"event":"boot","seconds":15,"weights_gb":3.2,"weights_total_gb":44.7}`, `{"output":{"event":"boot","seconds":30}}`} {
		if got := parseLoraOutputs(json.RawMessage(empty)); len(got) != 0 {
			t.Fatalf("%q parsed to %+v", empty, got)
		}
	}
}

type fakePool struct {
	mu       sync.Mutex
	t        *testing.T
	health   loraHealth
	runs     []map[string]interface{}
	jobs     map[string][]map[string]interface{}
	failOnce map[int]bool
	stall    bool
	cancels  int
	legacy   bool
}

func (p *fakePool) handler(w http.ResponseWriter, r *http.Request) {
	p.mu.Lock()
	defer p.mu.Unlock()
	path := strings.TrimPrefix(r.URL.Path, "/v2/ep")
	switch {
	case strings.HasPrefix(r.URL.Path, "/v1/endpoints/ep/update"):
		fmt.Fprint(w, `{}`)
	case strings.HasPrefix(r.URL.Path, "/v1/endpoints/ep"):
		fmt.Fprint(w, `{"workersMax":4,"gpuTypeIds":["NVIDIA H100 PCIe"]}`)
	case path == "/health":
		json.NewEncoder(w).Encode(p.health)
	case path == "/run":
		var body struct {
			Input map[string]interface{} `json:"input"`
		}
		json.NewDecoder(r.Body).Decode(&body)
		p.runs = append(p.runs, body.Input)
		id := fmt.Sprintf("job%d", len(p.runs))
		var items []map[string]interface{}
		if clips, ok := body.Input["clips"].([]interface{}); ok {
			for _, raw := range clips {
				clip := raw.(map[string]interface{})
				index := int(clip["id"].(float64))
				item := map[string]interface{}{"clip": index, "outputs": []map[string]interface{}{{"url": clip["_output_public_url"], "bytes": 1000, "content_type": "video/mp4"}},
					"metrics": map[string]interface{}{"generation_seconds": 10.0}}
				if p.failOnce[index] {
					delete(p.failOnce, index)
					item = map[string]interface{}{"clip": index, "error": "boom"}
				}
				items = append(items, item)
			}
		} else {
			p.legacy = true
			items = append(items, map[string]interface{}{"outputs": []map[string]interface{}{{"url": body.Input["_output_public_url"], "bytes": 1000, "content_type": "video/mp4"}},
				"metrics": map[string]interface{}{"generation_seconds": 10.0}})
		}
		if p.jobs == nil {
			p.jobs = map[string][]map[string]interface{}{}
		}
		p.jobs[id] = items
		fmt.Fprintf(w, `{"id":%q,"status":"IN_QUEUE"}`, id)
	case strings.HasPrefix(path, "/status/"):
		id := strings.TrimPrefix(path, "/status/")
		if p.stall {
			fmt.Fprint(w, `{"status":"IN_QUEUE"}`)
			return
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "COMPLETED", "executionTime": 10000, "output": p.jobs[id]})
	case strings.HasPrefix(path, "/stream/"):
		id := strings.TrimPrefix(path, "/stream/")
		var stream []map[string]interface{}
		if !p.stall {
			for _, item := range p.jobs[id] {
				stream = append(stream, map[string]interface{}{"output": item})
			}
		}
		json.NewEncoder(w).Encode(map[string]interface{}{"status": "IN_PROGRESS", "stream": stream})
	case strings.HasPrefix(path, "/cancel/"):
		p.cancels++
		fmt.Fprint(w, `{}`)
	default:
		http.NotFound(w, r)
	}
}

func startFakePool(t *testing.T, pool *fakePool) {
	server := httptest.NewServer(http.HandlerFunc(pool.handler))
	t.Cleanup(server.Close)
	pool.t = t
	t.Setenv("H3_RUNPOD_BASE_URL", server.URL+"/v2")
	t.Setenv("H3_RUNPOD_CONTROL_URL", server.URL+"/v1")
	t.Setenv("H3_RUNPOD_API_KEY", "test")
	t.Setenv("H3_SWAP_WORKERS_MAX", "4")
	oldAccount, oldKey, oldSecret, oldBucket, oldHost, oldPrefix := r2AccountID, r2AccessKeyID, r2SecretAccessKey, r2Bucket, r2PublicHost, r2PathPrefix
	r2AccountID, r2AccessKeyID, r2SecretAccessKey, r2Bucket, r2PublicHost, r2PathPrefix = "acct", "key", "secret", "bucket", "cdn.example", "gallery"
	oldStatus, oldHealth, oldRetry, oldLookup := loraStatusInterval, loraHealthInterval, loraRetryBackoff, loraStockLookup
	loraStatusInterval, loraHealthInterval, loraRetryBackoff = 5*time.Millisecond, 20*time.Millisecond, time.Millisecond
	loraStockLookup = func(string) (map[string]string, error) { return nil, fmt.Errorf("no lookup in tests") }
	t.Cleanup(func() {
		r2AccountID, r2AccessKeyID, r2SecretAccessKey, r2Bucket, r2PublicHost, r2PathPrefix = oldAccount, oldKey, oldSecret, oldBucket, oldHost, oldPrefix
		loraStatusInterval, loraHealthInterval, loraRetryBackoff, loraStockLookup = oldStatus, oldHealth, oldRetry, oldLookup
	})
}

func loraTestState(t *testing.T, seconds float64) *characterSwapState {
	chunks, err := planLoraChunks(seconds, nil)
	if err != nil {
		t.Fatal(err)
	}
	for i := range chunks {
		chunks[i].SourceURL = fmt.Sprintf("https://cdn.example/src-%d.mp4", i)
	}
	return &characterSwapState{Request: ServiceUsageRequest{Kind: "lora", Resolution: "480p", ServiceTier: "standard", Prompt: "p"},
		SourceSeconds: seconds, Chunks: chunks, SwappedImageURL: "https://cdn.example/swapped.png"}
}

func TestRunLoraClipsBatchesByWorkersAndRetriesOnlyFailures(t *testing.T) {
	pool := &fakePool{failOnce: map[int]bool{1: true}}
	pool.health.Workers.Running, pool.health.Workers.Idle = 1, 1
	startFakePool(t, pool)
	state := loraTestState(t, 30)
	var mu sync.Mutex
	if err := runLoraClips(t.Context(), &VideoJob{ID: "job-a", UserID: "user"}, "ep", state, &mu, func() {}); err != nil {
		t.Fatal(err)
	}
	for i, chunk := range state.Chunks {
		if chunk.Status != "completed" || chunk.OutputURL == "" || chunk.ProviderUSD <= 0 {
			t.Fatalf("clip %d not completed: %+v", i, chunk)
		}
	}
	first := pool.runs[0:2]
	sent := 0
	for _, run := range first {
		sent += len(run["clips"].([]interface{}))
		if run["task"] != "character_swap" || run["video_url"] != nil {
			t.Fatalf("shared batch input malformed: %v", run)
		}
	}
	if sent != len(state.Chunks) || len(pool.runs) != 3 {
		t.Fatalf("want 2 batches for 2 workers then 1 retry batch; got %d runs, %d clips in first round", len(pool.runs), sent)
	}
	retry := pool.runs[2]["clips"].([]interface{})
	if len(retry) != 1 || int(retry[0].(map[string]interface{})["id"].(float64)) != 1 {
		t.Fatalf("only the failed clip is retried: %v", retry)
	}
	if seed := int(retry[0].(map[string]interface{})["seed"].(float64)); seed != 1000+7+1 {
		t.Fatalf("retry seed %d", seed)
	}
	if state.Chunks[1].Retries != 1 {
		t.Fatalf("retry count: %+v", state.Chunks[1])
	}
}

func TestRunLoraClipsLegacyInputRollback(t *testing.T) {
	t.Setenv("H3_SWAP_BATCH", "0")
	pool := &fakePool{}
	pool.health.Workers.Running = 1
	startFakePool(t, pool)
	state := loraTestState(t, 15)
	var mu sync.Mutex
	if err := runLoraClips(t.Context(), &VideoJob{ID: "job-legacy", UserID: "user"}, "ep", state, &mu, func() {}); err != nil {
		t.Fatal(err)
	}
	if !pool.legacy || len(pool.runs) != len(state.Chunks) {
		t.Fatalf("legacy mode must send one single-clip job per clip: runs=%d chunks=%d", len(pool.runs), len(state.Chunks))
	}
	if _, batched := pool.runs[0]["clips"]; batched || pool.runs[0]["video_url"] == nil {
		t.Fatalf("legacy input shape: %v", pool.runs[0])
	}
}

func TestRunLoraClipsFailsFastWhenQueueNeverGetsAWorker(t *testing.T) {
	t.Setenv("H3_SWAP_QUEUE_GRACE_SECONDS", "1")
	pool := &fakePool{stall: true}
	pool.health.Jobs.InQueue = 16
	startFakePool(t, pool)
	state := loraTestState(t, 10)
	var mu sync.Mutex
	started := time.Now()
	err := runLoraClips(t.Context(), &VideoJob{ID: "job-stall", UserID: "user"}, "ep", state, &mu, func() {})
	capacity, ok := err.(*loraCapacityError)
	if !ok {
		t.Fatalf("want a capacity error, got %v", err)
	}
	if elapsed := time.Since(started); elapsed < time.Second || elapsed > 6*time.Second {
		t.Fatalf("failed after %s, want about the 1s grace", elapsed)
	}
	if !strings.Contains(capacity.reason, "no GPU worker") || pool.cancels == 0 {
		t.Fatalf("queued runpod jobs must be cancelled: reason=%q cancels=%d", capacity.reason, pool.cancels)
	}
}

func TestRunLoraClipsFailsImmediatelyWithoutStock(t *testing.T) {
	pool := &fakePool{}
	startFakePool(t, pool)
	loraStockLookup = func(string) (map[string]string, error) {
		return map[string]string{"NVIDIA H100 PCIe": "None", "NVIDIA H200": "None"}, nil
	}
	state := loraTestState(t, 10)
	var mu sync.Mutex
	err := runLoraClips(t.Context(), &VideoJob{ID: "job-nostock", UserID: "user"}, "ep", state, &mu, func() {})
	if _, ok := err.(*loraCapacityError); !ok || len(pool.runs) != 0 {
		t.Fatalf("no stock must fail before any submission: err=%v runs=%d", err, len(pool.runs))
	}
	loraStockLookup = func(string) (map[string]string, error) {
		return map[string]string{"NVIDIA H100 PCIe": "None", "NVIDIA H200": "Low"}, nil
	}
	if loraPoolStockEmpty("ep") {
		t.Fatal("one type with stock means the pool may still start a worker")
	}
	t.Setenv("H3_SWAP_STOCK_PRECHECK", "0")
	loraStockLookup = func(string) (map[string]string, error) { return map[string]string{"x": "None"}, nil }
	if loraPoolStockEmpty("ep") {
		t.Fatal("precheck can be disabled")
	}
}

func TestLoraFalFallbackNeverChargesMoreThanTheQuote(t *testing.T) {
	for _, c := range []struct {
		resolution, tier string
		seconds          float64
	}{{"768p", "standard", 30}, {"480p", "standard", 30}, {"480p", "fast", 12}, {"768p", "fast", 7}} {
		state := characterSwapState{Request: ServiceUsageRequest{Kind: "lora", Resolution: c.resolution, ServiceTier: c.tier}, SourceSeconds: c.seconds}
		charge, quote := loraFalFallbackChargeUSD(state), loraChargeUSD(state.Request, c.seconds)
		if charge > quote+1e-9 || charge <= 0 {
			t.Fatalf("%s/%s: fallback charge %.2f vs quote %.2f", c.resolution, c.tier, charge, quote)
		}
	}
	fal := loraFalRequest(ServiceUsageRequest{Kind: "lora", Resolution: "480p", ServiceTier: "fast", Prompt: loraDefaultPrompt})
	if fal.Kind != "" || fal.Resolution != "768P" || fal.Prompt != characterSwapDefaultVideoPrompt || fal.PromptExpansionMode != "disabled" {
		t.Fatalf("fal request: %+v", fal)
	}
	if custom := loraFalRequest(ServiceUsageRequest{Prompt: "keep the hat"}); custom.Prompt != "keep the hat" {
		t.Fatal("a custom prompt must survive the fallback")
	}
}

func TestLoraFalFallbackAvailability(t *testing.T) {
	old := falAPIKey
	defer func() { falAPIKey = old }()
	state := characterSwapState{SwappedImageURL: "https://x/i.png"}
	falAPIKey = ""
	if loraFalFallbackAvailable(state) {
		t.Fatal("needs the fal key")
	}
	falAPIKey = "k"
	if !loraFalFallbackAvailable(state) {
		t.Fatal("fallback should be on by default")
	}
	t.Setenv("H3_SWAP_FAL_FALLBACK", "0")
	if loraFalFallbackAvailable(state) {
		t.Fatal("fallback must be switchable off")
	}
	t.Setenv("H3_SWAP_FAL_FALLBACK", "")
	state.Recast = &recastState{}
	if loraFalFallbackAvailable(state) {
		t.Fatal("recast jobs already left fal once")
	}
}
