package main

import "testing"

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
