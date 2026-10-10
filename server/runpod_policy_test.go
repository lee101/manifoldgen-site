package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestRunpodJobPolicyBoundsExecutionAndQueueTime(t *testing.T) {
	policy := runpodJobPolicy(30 * time.Minute)
	if policy["executionTimeout"] != int64(30*60*1000) || policy["ttl"] != int64(60*60*1000) {
		t.Fatalf("unexpected policy %+v", policy)
	}
	if got := runpodJobPolicy(0)["executionTimeout"]; got != runpodDefaultExecutionTimeout.Milliseconds() {
		t.Fatalf("default execution = %v", got)
	}
	if got := runpodJobPolicy(24 * time.Hour)["executionTimeout"]; got != runpodMaxExecutionTimeout.Milliseconds() {
		t.Fatalf("cap = %v", got)
	}
}

func TestH3ExecutionBudgetScalesWithDuration(t *testing.T) {
	if got := h3ExecutionBudget(map[string]interface{}{}); got != 40*time.Minute {
		t.Fatalf("no duration = %v", got)
	}
	if got := h3ExecutionBudget(map[string]interface{}{"duration": 5}); got != 32*time.Minute {
		t.Fatalf("5s = %v", got)
	}
	if got := h3ExecutionBudget(map[string]interface{}{"duration": float64(60)}); got != 164*time.Minute {
		t.Fatalf("60s = %v", got)
	}
}

func TestDefaultRunpodPolicyOnlyAppliesToRunSubmissions(t *testing.T) {
	body := map[string]interface{}{"input": map[string]interface{}{"x": 1}}
	withPolicy, ok := withDefaultRunpodPolicy(http.MethodPost, "/run", body).(map[string]interface{})
	if !ok || withPolicy["policy"] == nil {
		t.Fatal("run submission must get a policy")
	}
	if _, mutated := body["policy"]; mutated {
		t.Fatal("caller payload must not be mutated")
	}
	custom := map[string]interface{}{"input": 1, "policy": "keep"}
	if got := withDefaultRunpodPolicy(http.MethodPost, "/run", custom).(map[string]interface{}); got["policy"] != "keep" {
		t.Fatal("explicit policy must be preserved")
	}
	for _, suffix := range []string{"/status/abc", "/cancel/abc"} {
		if got := withDefaultRunpodPolicy(http.MethodPost, suffix, body).(map[string]interface{}); got["policy"] != nil {
			t.Fatalf("%s must not get a policy", suffix)
		}
	}
}

func TestCallH3RunpodSendsPolicyAndCancelHelperEscapes(t *testing.T) {
	var runs, cancels int32
	var seen map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		switch r.URL.Path {
		case "/ep/run":
			atomic.AddInt32(&runs, 1)
			_ = json.Unmarshal(raw, &seen)
			_, _ = w.Write([]byte(`{"id":"job1","status":"IN_QUEUE"}`))
		case "/ep/cancel/job%201", "/ep/cancel/job 1":
			atomic.AddInt32(&cancels, 1)
			_, _ = w.Write([]byte(`{}`))
		default:
			t.Errorf("unexpected path %s", r.URL.Path)
		}
	}))
	defer server.Close()
	t.Setenv("H3_RUNPOD_BASE_URL", server.URL)
	t.Setenv("H3_RUNPOD_API_KEY", "test-key")
	var queued h3RunpodQueuedJob
	if _, err := callH3Runpod("ep", "/run", http.MethodPost, map[string]interface{}{"input": map[string]interface{}{"a": 1}}, &queued); err != nil {
		t.Fatal(err)
	}
	policy, _ := seen["policy"].(map[string]interface{})
	if policy["executionTimeout"] != float64(runpodDefaultExecutionTimeout.Milliseconds()) || policy["ttl"] == nil {
		t.Fatalf("submitted policy = %+v", seen["policy"])
	}
	runpodCancelBestEffort("ep", "job 1")
	runpodCancelBestEffort("", "x")
	runpodCancelBestEffort("ep", "")
	if atomic.LoadInt32(&runs) != 1 || atomic.LoadInt32(&cancels) != 1 {
		t.Fatalf("runs=%d cancels=%d", runs, cancels)
	}
}
