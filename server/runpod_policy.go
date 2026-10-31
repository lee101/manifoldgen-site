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

func h3InputSeconds(input map[string]interface{}) float64 {
	switch value := input["duration"].(type) {
	case int:
		return float64(value)
	case int64:
		return float64(value)
	case float64:
		return value
	}
	return 0
}

// h3FlexColdBootAllowance covers a cold worker's weight download (78-175 s
// measured), which is billed as execution time.
const h3FlexColdBootAllowance = 4 * time.Minute

// h3FlexExecutionBudget bounds a flex job at a cold boot plus 3x its predicted
// generation time (about 7 min for a 5 s native clip). The generic budget
// below was sized for the 20-step lanes and let a hung 10 s flex job bill 44
// minutes (measured 2026-10-31: two jobs hung for 56 minutes before cancel).
func h3FlexExecutionBudget(input map[string]interface{}) time.Duration {
	req := ServiceUsageRequest{Duration: int(math.Ceil(h3InputSeconds(input)))}
	if size, ok := input["size"].(string); ok {
		req.Size = size
	}
	return h3FlexColdBootAllowance + time.Duration(3*h3FlexPredictSeconds(req))*time.Second
}

func h3JobBudget(route h3WorkerRoute, input map[string]interface{}) time.Duration {
	if route.Variant == h3FlexVariant {
		return h3FlexExecutionBudget(input)
	}
	return h3ExecutionBudget(input)
}

func h3ExecutionBudget(input map[string]interface{}) time.Duration {
	seconds := h3InputSeconds(input)
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
