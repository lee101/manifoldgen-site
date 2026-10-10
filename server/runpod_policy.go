package main

import (
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	runpodDefaultExecutionTimeout = 2 * time.Hour
	runpodMaxExecutionTimeout     = 4 * time.Hour
	runpodQueueGrace              = 30 * time.Minute
)

func runpodJobPolicy(execution time.Duration) map[string]interface{} {
	if execution <= 0 {
		execution = runpodDefaultExecutionTimeout
	}
	if execution > runpodMaxExecutionTimeout {
		execution = runpodMaxExecutionTimeout
	}
	return map[string]interface{}{
		"executionTimeout": execution.Milliseconds(),
		"ttl":              (execution + runpodQueueGrace).Milliseconds(),
	}
}

func runpodRunBody(input interface{}, execution time.Duration) map[string]interface{} {
	return map[string]interface{}{"input": input, "policy": runpodJobPolicy(execution)}
}

func h3ExecutionBudget(input map[string]interface{}) time.Duration {
	seconds := 0.0
	switch value := input["duration"].(type) {
	case int:
		seconds = float64(value)
	case int64:
		seconds = float64(value)
	case float64:
		seconds = value
	}
	if seconds <= 0 {
		return 40 * time.Minute
	}
	return 20*time.Minute + time.Duration(math.Ceil(seconds/5))*12*time.Minute
}

func withDefaultRunpodPolicy(method, suffix string, payload interface{}) interface{} {
	if method != http.MethodPost || suffix != "/run" {
		return payload
	}
	body, ok := payload.(map[string]interface{})
	if !ok {
		return payload
	}
	if _, exists := body["policy"]; exists {
		return payload
	}
	if _, hasInput := body["input"]; !hasInput {
		return payload
	}
	merged := make(map[string]interface{}, len(body)+1)
	for key, value := range body {
		merged[key] = value
	}
	merged["policy"] = runpodJobPolicy(runpodDefaultExecutionTimeout)
	return merged
}

func runpodCancelBestEffort(endpointID, jobID string) {
	endpointID, jobID = strings.TrimSpace(endpointID), strings.TrimSpace(jobID)
	if endpointID == "" || jobID == "" {
		return
	}
	_, _ = callH3Runpod(endpointID, "/cancel/"+url.PathEscape(jobID), http.MethodPost, nil, nil)
}
