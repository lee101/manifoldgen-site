package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// scripts/runpod_cost_guard.py sets workersMax=0 on an endpoint that blows its
// daily spend cap and lists it here; the site must not scale it back up.
func runpodSpendCapPath() string {
	return getEnv("RUNPOD_SPEND_CAP_FILE", "/var/lib/manifoldgen-runpod-guard/spend-caps.json")
}

var runpodSpendCapCache = struct {
	sync.Mutex
	path    string
	modTime time.Time
	capped  map[string]bool
}{}

func runpodSpendCapped(endpointID string) bool {
	path := runpodSpendCapPath()
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	runpodSpendCapCache.Lock()
	defer runpodSpendCapCache.Unlock()
	if runpodSpendCapCache.path != path || !info.ModTime().Equal(runpodSpendCapCache.modTime) {
		var file struct {
			Capped map[string]json.RawMessage `json:"capped"`
		}
		capped := map[string]bool{}
		if raw, readErr := os.ReadFile(path); readErr == nil && json.Unmarshal(raw, &file) == nil {
			for id := range file.Capped {
				capped[id] = true
			}
		}
		runpodSpendCapCache.path, runpodSpendCapCache.modTime, runpodSpendCapCache.capped = path, info.ModTime(), capped
	}
	return runpodSpendCapCache.capped[endpointID]
}

func runpodEndpointIDFromControlURL(requestURL string) string {
	_, rest, ok := strings.Cut(requestURL, "/endpoints/")
	if !ok {
		return ""
	}
	id, _, _ := strings.Cut(rest, "/")
	id, _, _ = strings.Cut(id, "?")
	return id
}

func runpodScaleUpPayload(payload interface{}) bool {
	values, ok := payload.(map[string]interface{})
	if !ok {
		return false
	}
	for _, key := range []string{"workersMax", "workersMin"} {
		switch value := values[key].(type) {
		case int:
			if value > 0 {
				return true
			}
		case float64:
			if value > 0 {
				return true
			}
		}
	}
	return false
}

func runpodSpendCapBlocks(method, requestURL string, payload interface{}) error {
	if method == http.MethodGet || !runpodScaleUpPayload(payload) {
		return nil
	}
	if id := runpodEndpointIDFromControlURL(requestURL); id != "" && runpodSpendCapped(id) {
		return fmt.Errorf("RunPod endpoint %s is paused by the daily spend cap", id)
	}
	return nil
}
