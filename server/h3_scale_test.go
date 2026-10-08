package main

import (
	"sync"
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
