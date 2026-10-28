package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestRunpodBatchSubmitAndExpire(t *testing.T) {
	var calls []string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method+" "+r.URL.Path)
		switch {
		case r.URL.Path == "/ep9/batch":
			json.NewEncoder(w).Encode(map[string]string{"id": "b9"})
		case strings.HasSuffix(r.URL.Path, "/requests"):
			w.Write([]byte(`{"requests":[{"id":"req9","status":"IN_QUEUE"}]}`))
		case strings.HasSuffix(r.URL.Path, "/cancel"):
			w.Write([]byte(`{"id":"b9","status":"CANCELLED"}`))
		case r.URL.Path == "/ep9/batch/b9":
			w.Write([]byte(`{"id":"b9","status":"FINALIZED"}`))
		case r.URL.Path == "/ep9/run":
			w.Write([]byte(`{"id":"run9","status":"IN_QUEUE"}`))
		}
	}))
	defer srv.Close()
	t.Setenv("H3_RUNPOD_API_KEY", "k")
	t.Setenv("H3_RUNPOD_BASE_URL", srv.URL)
	t.Setenv("RUNPOD_BATCH_PATIENCE", "1s")

	var q h3RunpodQueuedJob
	if submitRunpodBatchJob("ep9", map[string]interface{}{"p": 1}, nil, &q) {
		t.Fatal("batch used for an endpoint that did not opt in")
	}
	t.Setenv("RUNPOD_BATCH_ENDPOINTS", "ep8, ep9")
	if !submitRunpodBatchJob("ep9", map[string]interface{}{"p": 1}, nil, &q) || q.ID != "req9" {
		t.Fatalf("batch submit failed: %+v", q)
	}
	if got := runpodBatchExpire("ep9", "req9"); got != "" {
		t.Fatalf("expired before patience: %q", got)
	}
	time.Sleep(1100 * time.Millisecond)
	if got := runpodBatchExpire("ep9", "req9"); got != "run9" {
		t.Fatalf("want fallback run9, got %q (%v)", got, calls)
	}
}
