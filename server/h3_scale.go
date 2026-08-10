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
	h3ScaleControlClient = &http.Client{Timeout: 30 * time.Second}
	h3ScaleMu            sync.Mutex
	h3ScaleReapers       sync.Map
)

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
	h3ScaleMu.Lock()
	defer h3ScaleMu.Unlock()
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
		time.Sleep(5 * time.Second)
	}
	return status, err
}

func scheduleH3ScaleToZero(endpointID string) {
	if strings.TrimSpace(endpointID) == "" {
		return
	}
	if _, loaded := h3ScaleReapers.LoadOrStore(endpointID, struct{}{}); loaded {
		return
	}
	go func() {
		defer h3ScaleReapers.Delete(endpointID)
		deadline := time.Now().Add(65 * time.Minute)
		for time.Now().Before(deadline) {
			h3ScaleMu.Lock()
			var health h3ScaleHealth
			_, err := callH3Runpod(endpointID, "/health", http.MethodGet, nil, &health)
			if err == nil && health.Jobs.InProgress == 0 && health.Jobs.InQueue == 0 {
				err = h3SetWorkersMax(endpointID, 0)
				if err == nil {
					drainDeadline := time.Now().Add(30 * time.Second)
					for time.Now().Before(drainDeadline) {
						var drained h3ScaleHealth
						if _, healthErr := callH3Runpod(endpointID, "/health", http.MethodGet, nil, &drained); healthErr == nil {
							live := 0
							for _, count := range drained.Workers {
								live += count
							}
							if live == 0 {
								log.Printf("[h3] endpoint=%s scaled to zero", endpointID)
								h3ScaleMu.Unlock()
								return
							}
						}
						time.Sleep(3 * time.Second)
					}
					log.Printf("[h3] endpoint=%s scale-to-zero still draining after 30s", endpointID)
				}
			}
			h3ScaleMu.Unlock()
			if err != nil {
				log.Printf("[h3] endpoint=%s scale-to-zero check failed: %v", endpointID, err)
			}
			time.Sleep(5 * time.Second)
		}
	}()
}
