package main

import (
	"log"
	"math"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// MiniMax-Music3 loads ~27 GiB before it can sing, so a cold worker costs
// minutes of GPU time that no single track pays for. Below a demand threshold
// the endpoint scales to zero within seconds and each track absorbs its own
// cold start; above it, one worker is held warm — a dedicated machine in all
// but name — because the idle GPU is then cheaper than the cold starts it
// replaces. The switch is measured from real arrivals, with hysteresis so a
// burst does not flap the endpoint configuration.

const (
	music3IdleTimeoutSeconds = 20
	music3DemandWindow       = 30 * time.Minute
	music3WarmCooldown       = 5 * time.Minute
	music3MaxTrackedArrivals = 512
)

type music3CapacityState struct {
	mu         sync.Mutex
	arrivals   []time.Time
	warm       bool
	lastChange time.Time
	applied    bool
}

var music3Capacity = &music3CapacityState{}

func music3WarmWorkerUSDPerHour() float64 {
	return music3GPUUSDPerHour()
}

// A cold start costs this much GPU time before the first note, measured from
// the worker's own model-load and compile timings.
func music3ColdStartSeconds() float64 {
	value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_COLD_START_SECONDS")), 64)
	if err != nil || value <= 0 {
		return 60
	}
	return value
}

// Holding a worker warm pays off once arrivals are frequent enough that the
// cold starts avoided cost more than the idle hour does.
func music3WarmThresholdPerHour() float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_WARM_THRESHOLD_PER_HOUR")), 64); err == nil && value > 0 {
		return value
	}
	coldStartHours := music3ColdStartSeconds() / 3600
	if coldStartHours <= 0 {
		return math.MaxFloat64
	}
	// An idle hour buys this many cold starts; the latency preference goes warm
	// a little before pure GPU cost would, because a cold track also makes the
	// user wait through the model load.
	return music3LatencyPreference() / coldStartHours
}

// music3LatencyPreference < 1 keeps a worker warm below the pure cost
// break-even, trading a little GPU spend for a much shorter wait.
func music3LatencyPreference() float64 {
	if value, err := strconv.ParseFloat(strings.TrimSpace(os.Getenv("MUSIC3_WARM_LATENCY_PREFERENCE")), 64); err == nil && value > 0 && value <= 1 {
		return value
	}
	return 0.5
}

func (state *music3CapacityState) record(now time.Time) {
	state.mu.Lock()
	defer state.mu.Unlock()
	state.arrivals = append(state.arrivals, now)
	if len(state.arrivals) > music3MaxTrackedArrivals {
		state.arrivals = state.arrivals[len(state.arrivals)-music3MaxTrackedArrivals:]
	}
}

// demandPerHour extrapolates the observed window to an hourly arrival rate.
func (state *music3CapacityState) demandPerHour(now time.Time) float64 {
	state.mu.Lock()
	defer state.mu.Unlock()
	cutoff := now.Add(-music3DemandWindow)
	kept := state.arrivals[:0]
	for _, arrival := range state.arrivals {
		if arrival.After(cutoff) {
			kept = append(kept, arrival)
		}
	}
	state.arrivals = kept
	return float64(len(kept)) / music3DemandWindow.Hours()
}

// desiredWarm reports the capacity mode the current demand justifies, and
// whether it differs from what is already applied to the endpoint.
func (state *music3CapacityState) desiredWarm(now time.Time, demand float64) (bool, bool) {
	warm := demand >= music3WarmThresholdPerHour()
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.applied && warm == state.warm {
		return warm, false
	}
	if state.applied && now.Sub(state.lastChange) < music3WarmCooldown {
		return state.warm, false
	}
	return warm, true
}

func (state *music3CapacityState) commit(now time.Time, warm bool) {
	state.mu.Lock()
	defer state.mu.Unlock()
	state.warm = warm
	state.applied = true
	state.lastChange = now
}

func music3ApplyCapacity(endpointID string, warm bool) error {
	workersMin := 0
	if warm {
		workersMin = 1
	}
	return h3ControlRequest(
		http.MethodPost,
		h3ControlBase()+"/endpoints/"+url.PathEscape(endpointID)+"/update",
		map[string]interface{}{
			"workersMin": workersMin, "idleTimeout": music3IdleTimeoutSeconds,
			"flashboot": true, "scalerType": "REQUEST_COUNT", "scalerValue": 1,
		},
		nil,
	)
}

// music3TuneCapacity records an arrival and moves the endpoint between
// scale-to-zero and warm capacity when the demand rate crosses the threshold.
func music3TuneCapacity(endpointID string) {
	if strings.TrimSpace(endpointID) == "" || getEnv("MUSIC3_CAPACITY_CONTROL", "1") != "1" {
		return
	}
	now := time.Now()
	music3Capacity.record(now)
	demand := music3Capacity.demandPerHour(now)
	warm, changed := music3Capacity.desiredWarm(now, demand)
	if !changed {
		return
	}
	go func() {
		if err := music3ApplyCapacity(endpointID, warm); err != nil {
			log.Printf("[music3] capacity update failed warm=%t: %v", warm, err)
			return
		}
		music3Capacity.commit(time.Now(), warm)
		recordMusic3Event("music3_capacity", "", map[string]interface{}{
			"warm": warm, "demand_per_hour": math.Round(demand*100) / 100,
			"threshold_per_hour": math.Round(music3WarmThresholdPerHour()*100) / 100,
		})
		log.Printf("[music3] capacity warm=%t demand=%.2f/h", warm, demand)
	}()
}

// music3CapacitySnapshot exposes the controller state for status endpoints.
func music3CapacitySnapshot() map[string]interface{} {
	now := time.Now()
	demand := music3Capacity.demandPerHour(now)
	music3Capacity.mu.Lock()
	defer music3Capacity.mu.Unlock()
	return map[string]interface{}{
		"warm":               music3Capacity.warm,
		"applied":            music3Capacity.applied,
		"demand_per_hour":    math.Round(demand*100) / 100,
		"threshold_per_hour": math.Round(music3WarmThresholdPerHour()*100) / 100,
		"idle_timeout":       music3IdleTimeoutSeconds,
		"cold_start_seconds": music3ColdStartSeconds(),
		"gpu_usd_per_hour":   music3WarmWorkerUSDPerHour(),
	}
}
