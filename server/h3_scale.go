package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

// RunPod occasionally leaves H3 workers warm indefinitely even with
// workersMin=0 and idleTimeout=5. Keep the endpoint object paused between
// bursts, activate it immediately before submission, then force it back to
// zero after the last queued/running job finishes.
var (
	h3ScaleControlClient    = &http.Client{Timeout: 30 * time.Second}
	h3ScaleLocks            sync.Map
	h3ScaleReapers          sync.Map
	h3ScalePropagationDelay = 5 * time.Second
)

type h3ScaleReaperState struct {
	mu         sync.Mutex
	generation uint64
	running    bool
}

type h3ScaleEndpoint struct {
	WorkersMax int `json:"workersMax"`
}

type h3ScaleHealth struct {
	Jobs struct {
		InProgress int `json:"inProgress"`
		InQueue    int `json:"inQueue"`
	} `json:"jobs"`
	Workers map[string]int `json:"workers"`
}

// h3EndpointScaleLock keeps pause/unpause atomic for one endpoint without
// making an unrelated endpoint wait through its control-plane propagation or
// 30-second worker drain.
func h3EndpointScaleLock(endpointID string) *sync.Mutex {
	value, _ := h3ScaleLocks.LoadOrStore(endpointID, &sync.Mutex{})
	return value.(*sync.Mutex)
}

func h3DesiredWorkersMax(route h3WorkerRoute) int {
	defaultMax, envName := 2, "H3_NORMAL_RUNPOD_MAX_WORKERS"
	if route.Variant == h3PinkCherryVariant {
		defaultMax, envName = 1, "H3_PINKCHERRY_RUNPOD_MAX_WORKERS"
	}
	if configured, err := strconv.Atoi(strings.TrimSpace(os.Getenv(envName))); err == nil && configured > 0 {
		return configured
	}
	return defaultMax
}

func h3ControlRequest(method, requestURL string, payload interface{}, output interface{}) error {
	key := h3RunpodAPIKey()
	if key == "" {
		return fmt.Errorf("H3_RUNPOD_API_KEY is not configured")
	}
	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		body = bytes.NewReader(encoded)
	}
	req, err := http.NewRequest(method, requestURL, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "manifoldgen-control/1.0")
	response, err := h3ScaleControlClient.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return err
	}
	if response.StatusCode >= 300 {
		return fmt.Errorf("RunPod endpoint control returned %d: %s", response.StatusCode, tailOutput(raw))
	}
	if output != nil && json.Unmarshal(raw, output) != nil {
		return fmt.Errorf("RunPod endpoint control returned invalid JSON")
	}
	return nil
}

func h3ControlBase() string {
	return strings.TrimRight(getEnv("H3_RUNPOD_CONTROL_URL", "https://rest.runpod.io/v1"), "/")
}

func h3EndpointConfig(endpointID string) (h3ScaleEndpoint, error) {
	var config h3ScaleEndpoint
	err := h3ControlRequest(
		http.MethodGet,
		h3ControlBase()+"/endpoints/"+url.PathEscape(endpointID),
		nil,
		&config,
	)
	return config, err
}

func h3SetWorkersMax(endpointID string, workersMax int) error {
	return h3ControlRequest(
		http.MethodPost,
		h3ControlBase()+"/endpoints/"+url.PathEscape(endpointID)+"/update",
		map[string]interface{}{
			"workersMin": 0, "workersMax": workersMax, "idleTimeout": 5,
			"executionTimeoutMs": 4 * 60 * 60 * 1000, "flashboot": true,
			"scalerType": "REQUEST_COUNT", "scalerValue": 1,
		},
		nil,
	)
}

func submitScaledH3RunpodJob(route h3WorkerRoute, input map[string]interface{}, queued *h3RunpodQueuedJob) (int, error) {
	lock := h3EndpointScaleLock(route.RunpodEndpointID)
	lock.Lock()
	defer lock.Unlock()
	desiredMax := h3DesiredWorkersMax(route)
	config, err := h3EndpointConfig(route.RunpodEndpointID)
	if err != nil {
		return 0, err
	}
	if config.WorkersMax != desiredMax {
		if err := h3SetWorkersMax(route.RunpodEndpointID, desiredMax); err != nil {
			return 0, err
		}
	}
	reasserted := false
	var status int
	for attempt := 0; attempt < 7; attempt++ {
		status, err = callH3Runpod(route.RunpodEndpointID, "/run", http.MethodPost, map[string]interface{}{"input": input}, queued)
		paused := status == http.StatusConflict && err != nil && strings.Contains(err.Error(), "ENDPOINT_PAUSED")
		if !paused {
			return status, err
		}
		// Management reads and queue state can be briefly inconsistent after a
		// pause. Re-assert once, then wait without spawning duplicate rollouts.
		if !reasserted {
			if scaleErr := h3SetWorkersMax(route.RunpodEndpointID, desiredMax); scaleErr != nil {
				return status, scaleErr
			}
			reasserted = true
		}
		time.Sleep(h3ScalePropagationDelay)
	}
	return status, err
}

func scheduleH3ScaleToZero(endpointID string) {
	if strings.TrimSpace(endpointID) == "" {
		return
	}
	value, _ := h3ScaleReapers.LoadOrStore(endpointID, &h3ScaleReaperState{})
	state := value.(*h3ScaleReaperState)
	state.mu.Lock()
	state.generation++
	if state.running {
		state.mu.Unlock()
		return
	}
	state.running = true
	state.mu.Unlock()
	go reapH3Endpoint(endpointID, state)
}

func h3ReaperGeneration(state *h3ScaleReaperState) uint64 {
	state.mu.Lock()
	defer state.mu.Unlock()
	return state.generation
}

func finishH3Reaper(state *h3ScaleReaperState, generation uint64) bool {
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.generation != generation {
		return false
	}
	state.running = false
	return true
}

func reapH3Endpoint(endpointID string, state *h3ScaleReaperState) {
	generation := h3ReaperGeneration(state)
	deadline := time.Now().Add(65 * time.Minute)
	for {
		currentGeneration := h3ReaperGeneration(state)
		if currentGeneration != generation {
			generation = currentGeneration
			deadline = time.Now().Add(65 * time.Minute)
		}
		if time.Now().After(deadline) {
			if finishH3Reaper(state, generation) {
				return
			}
			continue
		}

		// Serialize only the idle recheck and the update. Worker drain polling is
		// deliberately outside this lock, so a new request can immediately
		// reactivate this endpoint and other endpoints never wait behind it.
		lock := h3EndpointScaleLock(endpointID)
		lock.Lock()
		var health h3ScaleHealth
		_, err := callH3Runpod(endpointID, "/health", http.MethodGet, nil, &health)
		requestedZero := false
		if err == nil && health.Jobs.InProgress == 0 && health.Jobs.InQueue == 0 {
			err = h3SetWorkersMax(endpointID, 0)
			requestedZero = err == nil
		}
		lock.Unlock()
		if err != nil {
			log.Printf("[h3] endpoint=%s scale-to-zero check failed: %v", endpointID, err)
		}

		if requestedZero {
			drainDeadline := time.Now().Add(30 * time.Second)
			for time.Now().Before(drainDeadline) {
				if h3ReaperGeneration(state) != generation {
					break
				}
				var drained h3ScaleHealth
				if _, healthErr := callH3Runpod(endpointID, "/health", http.MethodGet, nil, &drained); healthErr == nil {
					// A request can arrive after the zero update. Queue state is
					// authoritative even before a replacement worker appears.
					if drained.Jobs.InProgress > 0 || drained.Jobs.InQueue > 0 {
						break
					}
					live := 0
					for _, count := range drained.Workers {
						live += count
					}
					if live == 0 && finishH3Reaper(state, generation) {
						log.Printf("[h3] endpoint=%s scaled to zero", endpointID)
						return
					}
				}
				time.Sleep(3 * time.Second)
			}
			if h3ReaperGeneration(state) == generation {
				log.Printf("[h3] endpoint=%s scale-to-zero still draining after 30s", endpointID)
			}
		}
		time.Sleep(5 * time.Second)
	}
}
