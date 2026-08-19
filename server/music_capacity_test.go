package main

import (
	"math"
	"os"
	"testing"
	"time"
)

func TestMusic3WarmThresholdMatchesColdStartCost(t *testing.T) {
	t.Setenv("MUSIC3_COLD_START_SECONDS", "150")
	t.Setenv("MUSIC3_WARM_THRESHOLD_PER_HOUR", "")
	want := 0.5 * 3600.0 / 150.0
	if got := music3WarmThresholdPerHour(); math.Abs(got-want) > 0.001 {
		t.Fatalf("threshold = %.3f, want %.3f", got, want)
	}
}

func TestMusic3CapacityStaysWarmOnlyUnderSustainedDemand(t *testing.T) {
	t.Setenv("MUSIC3_COLD_START_SECONDS", "150")
	state := &music3CapacityState{}
	now := time.Now()
	for i := 0; i < 3; i++ {
		state.record(now.Add(time.Duration(i) * time.Minute))
	}
	quiet := state.demandPerHour(now.Add(3 * time.Minute))
	if warm, changed := state.desiredWarm(now.Add(3*time.Minute), quiet); warm || !changed {
		t.Fatalf("light traffic wants warm=%t changed=%t at %.2f/h", warm, changed, quiet)
	}
	busy := now.Add(10 * time.Minute)
	state.commit(busy, false)

	for i := 0; i < 40; i++ {
		state.record(busy.Add(time.Duration(i) * time.Second))
	}
	rate := state.demandPerHour(busy.Add(time.Minute))
	if rate < music3WarmThresholdPerHour() {
		t.Fatalf("burst rate %.2f/h did not exceed threshold %.2f/h", rate, music3WarmThresholdPerHour())
	}
	// Within the cooldown the applied mode holds even though demand justifies warm.
	if warm, changed := state.desiredWarm(busy.Add(time.Minute), rate); warm || changed {
		t.Fatalf("cooldown ignored: warm=%t changed=%t", warm, changed)
	}
	after := busy.Add(music3WarmCooldown + time.Minute)
	if warm, changed := state.desiredWarm(after, rate); !warm || !changed {
		t.Fatalf("sustained demand did not request warm capacity: warm=%t changed=%t", warm, changed)
	}
}

func TestMusic3CapacityDropsOldArrivals(t *testing.T) {
	state := &music3CapacityState{}
	now := time.Now()
	state.record(now.Add(-2 * music3DemandWindow))
	state.record(now.Add(-time.Minute))
	if got := state.demandPerHour(now); math.Abs(got-1/music3DemandWindow.Hours()) > 0.001 {
		t.Fatalf("stale arrival still counted: %.3f/h", got)
	}
}

func TestMusic3PriceNeverFallsBelowGPUCost(t *testing.T) {
	t.Setenv("MUSIC3_RUNPOD_GPU_USD_PER_HOUR", "60")
	t.Setenv("MUSIC3_COLD_START_SECONDS", "150")
	defer os.Unsetenv("MUSIC3_RUNPOD_GPU_USD_PER_HOUR")
	price := music3PublicPriceUSD(180)
	floor := music3FloorPriceUSD(180)
	if price+0.005 < floor {
		t.Fatalf("price %.2f is below the cost floor %.2f", price, floor)
	}
	if price <= 0.70 {
		t.Fatalf("an expensive GPU should raise the price above the list rate, got %.2f", price)
	}
}
