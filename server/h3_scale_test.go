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
