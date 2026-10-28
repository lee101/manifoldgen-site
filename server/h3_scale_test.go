package main

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestH3DesiredWorkersMax(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_MAX_WORKERS", "3")
	t.Setenv("H3_PINKCHERRY_RUNPOD_MAX_WORKERS", "2")
	if got := h3DesiredWorkersMax(h3WorkerRoute{Variant: h3NormalVariant}); got != 3 {
		t.Fatalf("normal workers max = %d, want 3", got)
	}
	if got := h3DesiredWorkersMax(h3WorkerRoute{Variant: h3PinkCherryVariant}); got != 2 {
		t.Fatalf("pinkcherry workers max = %d, want 2", got)
	}
	t.Setenv("H3_NORMAL_RUNPOD_MAX_WORKERS", "0")
	t.Setenv("H3_PINKCHERRY_RUNPOD_MAX_WORKERS", "invalid")
	if got := h3DesiredWorkersMax(h3WorkerRoute{Variant: h3NormalVariant}); got != 2 {
		t.Fatalf("normal invalid fallback = %d, want 2", got)
	}
	if got := h3DesiredWorkersMax(h3WorkerRoute{Variant: h3PinkCherryVariant}); got != 1 {
		t.Fatalf("pinkcherry invalid fallback = %d, want 1", got)
	}
}

func TestH3ScaleLocksArePerEndpoint(t *testing.T) {
	h3ScaleLocks = sync.Map{}
	first := h3EndpointScaleLock("first")
	if first != h3EndpointScaleLock("first") {
		t.Fatal("same endpoint must reuse its scale lock")
	}
	if first == h3EndpointScaleLock("second") {
		t.Fatal("unrelated endpoints must not share a scale lock")
	}
}

func TestBusyEndpointScaleLockDoesNotBlockAnotherEndpoint(t *testing.T) {
	h3ScaleLocks = sync.Map{}
	first := h3EndpointScaleLock("first")
	second := h3EndpointScaleLock("second")
	first.Lock()
	defer first.Unlock()
	acquired := make(chan struct{})
	go func() {
		second.Lock()
		second.Unlock()
		close(acquired)
	}()
	select {
	case <-acquired:
	case <-time.After(100 * time.Millisecond):
		t.Fatal("unrelated endpoint waited behind busy scale lock")
	}
}

func TestH3ReaperGenerationPreventsStaleFinish(t *testing.T) {
	h3ScaleReapers = sync.Map{}
	state := &h3ScaleReaperState{generation: 2, running: true}
	h3ScaleReapers.Store("endpoint", state)
	if finishH3Reaper(state, 1) {
		t.Fatal("stale reaper generation must not finish")
	}
	if !state.running {
		t.Fatal("stale finish stopped the active reaper")
	}
	if !finishH3Reaper(state, 2) || state.running {
		t.Fatal("current generation should finish")
	}
	if stored, exists := h3ScaleReapers.Load("endpoint"); !exists || stored != state {
		t.Fatal("finished reaper state should remain reusable for a race-free restart")
	}
}

func TestH3AdultLanePrefersLtxOverPinkCherry(t *testing.T) {
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink")
	t.Setenv("H3_LTX_RUNPOD_ENDPOINT", "")
	t.Setenv("H3_LTX_COG_URL", "")
	if route, ok := h3AdultLane(); !ok || route.Variant != h3PinkCherryVariant || route.RunpodEndpointID != "pink" {
		t.Fatalf("pinkcherry lane = %+v %v", route, ok)
	}
	t.Setenv("H3_LTX_RUNPOD_ENDPOINT", "ltx")
	if route, ok := h3AdultLane(); !ok || route.Variant != h3LtxVariant || route.RunpodEndpointID != "ltx" {
		t.Fatalf("ltx lane = %+v %v", route, ok)
	}
	if route := h3RouteForContent("a quiet harbor", true); route.Variant != h3LtxVariant {
		t.Fatalf("flagged input route = %+v", route)
	}
	t.Setenv("H3_LTX_RUNPOD_MAX_WORKERS", "3")
	if got := h3DesiredWorkersMax(h3WorkerRoute{Variant: h3LtxVariant}); got != 3 {
		t.Fatalf("ltx workers max = %d", got)
	}
}

func TestH3EndpointIdleSecondsOnlyForPinkCherry(t *testing.T) {
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink")
	t.Setenv("H3_PINKCHERRY_RUNPOD_IDLE_SECONDS", "60")
	if got := h3EndpointIdleSeconds("pink"); got != 60 {
		t.Fatalf("pink idle = %d", got)
	}
	if got := h3EndpointIdleSeconds("normal"); got != 5 {
		t.Fatalf("normal idle = %d", got)
	}
	t.Setenv("H3_PINKCHERRY_RUNPOD_IDLE_SECONDS", "9999")
	if got := h3EndpointIdleSeconds("pink"); got != 5 {
		t.Fatalf("out of range idle = %d", got)
	}
	t.Setenv("H3_PINKCHERRY_RUNPOD_IDLE_SECONDS", "")
	if got := h3EndpointIdleSeconds("pink"); got != 5 {
		t.Fatalf("default idle = %d", got)
	}
}

func TestH3EndpointIdleSecondsPerLane(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal")
	t.Setenv("H3_LTX_RUNPOD_ENDPOINT", "ltx")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink")
	t.Setenv("H3_NORMAL_RUNPOD_IDLE_SECONDS", "")
	t.Setenv("H3_LTX_RUNPOD_IDLE_SECONDS", "")
	t.Setenv("H3_PINKCHERRY_RUNPOD_IDLE_SECONDS", "")
	for _, endpoint := range []string{"normal", "ltx", "pink", "other"} {
		if got := h3EndpointIdleSeconds(endpoint); got != 5 {
			t.Fatalf("%s default idle = %d", endpoint, got)
		}
	}
	t.Setenv("H3_NORMAL_RUNPOD_IDLE_SECONDS", "120")
	t.Setenv("H3_LTX_RUNPOD_IDLE_SECONDS", "90")
	if got := h3EndpointIdleSeconds("normal"); got != 120 {
		t.Fatalf("normal idle = %d", got)
	}
	if got := h3EndpointIdleSeconds("ltx"); got != 90 {
		t.Fatalf("ltx idle = %d", got)
	}
	if got := h3EndpointIdleSeconds("pink"); got != 5 || h3EndpointIdleSeconds("other") != 5 {
		t.Fatal("idle window leaked to another endpoint")
	}
}

func TestH3RunpodJobsBusyUsesJobStatus(t *testing.T) {
	statuses := map[string]string{"/ep/status/a": "COMPLETED", "/ep/status/b": "IN_PROGRESS", "/ep/status/c": "FAILED"}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		status, ok := statuses[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		fmt.Fprintf(w, `{"status":%q}`, status)
	}))
	defer upstream.Close()
	t.Setenv("H3_RUNPOD_BASE_URL", upstream.URL)
	t.Setenv("H3_RUNPOD_API_KEY", "test")
	if h3RunpodJobsBusy("ep", []string{"runpod:ep:a", "runpod:ep:c"}) {
		t.Fatal("finished jobs reported busy")
	}
	if !h3RunpodJobsBusy("ep", []string{"runpod:ep:a", "runpod:ep:b"}) {
		t.Fatal("in-progress job not reported busy")
	}
	if !h3RunpodJobsBusy("ep", []string{"runpod:ep:missing"}) {
		t.Fatal("status lookup failure must keep workers")
	}
	if h3RunpodJobsBusy("ep", nil) {
		t.Fatal("no tracked jobs reported busy")
	}
}

func TestSubmitScaledSkipsConfigGETWhileFresh(t *testing.T) {
	var gets, updates, runs int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/endpoints/fresh":
			atomic.AddInt32(&gets, 1)
			fmt.Fprint(w, `{"workersMax":0}`)
		case r.URL.Path == "/endpoints/fresh/update":
			atomic.AddInt32(&updates, 1)
			fmt.Fprint(w, `{}`)
		case r.URL.Path == "/fresh/run":
			atomic.AddInt32(&runs, 1)
			fmt.Fprint(w, `{"id":"j1","status":"IN_QUEUE"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer upstream.Close()
	t.Setenv("H3_RUNPOD_API_KEY", "test")
	t.Setenv("H3_RUNPOD_CONTROL_URL", upstream.URL)
	t.Setenv("H3_RUNPOD_BASE_URL", upstream.URL)
	t.Setenv("RUNPOD_SPEND_CAP_FILE", t.TempDir()+"/none.json")
	h3KnownWorkersMax = sync.Map{}
	route := h3WorkerRoute{Variant: h3NormalVariant, RunpodEndpointID: "fresh"}
	for i := 0; i < 3; i++ {
		var queued h3RunpodQueuedJob
		if _, err := submitScaledH3RunpodJob(route, map[string]interface{}{}, &queued); err != nil {
			t.Fatal(err)
		}
	}
	if g, u, r := atomic.LoadInt32(&gets), atomic.LoadInt32(&updates), atomic.LoadInt32(&runs); g != 1 || u != 1 || r != 3 {
		t.Fatalf("gets=%d updates=%d runs=%d, want 1/1/3", g, u, r)
	}
	if err := h3SetWorkersMax("fresh", 0); err != nil {
		t.Fatal(err)
	}
	var queued h3RunpodQueuedJob
	if _, err := submitScaledH3RunpodJob(route, map[string]interface{}{}, &queued); err != nil {
		t.Fatal(err)
	}
	if g, u := atomic.LoadInt32(&gets), atomic.LoadInt32(&updates); g != 1 || u != 3 {
		t.Fatalf("after scale-to-zero gets=%d updates=%d, want 1/3 (reactivation without GET)", g, u)
	}
}

func TestH3MeanCosine(t *testing.T) {
	got := h3MeanCosine([]float32{1, 0}, [][]float32{{1, 0}, {0, 1}})
	if got < 0.49 || got > 0.51 {
		t.Fatalf("mean cosine = %v", got)
	}
}
