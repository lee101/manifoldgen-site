package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestRunpodSpendCapBlocksScaleUp(t *testing.T) {
	path := filepath.Join(t.TempDir(), "caps.json")
	t.Setenv("RUNPOD_SPEND_CAP_FILE", path)
	base := "https://rest.runpod.io/v1/endpoints/"
	if err := runpodSpendCapBlocks(http.MethodPatch, base+"m3", map[string]interface{}{"workersMax": 2}); err != nil {
		t.Fatalf("missing cap file must not block: %v", err)
	}
	if err := os.WriteFile(path, []byte(`{"capped":{"m3":{"prior_workers_max":2}}}`), 0644); err != nil {
		t.Fatal(err)
	}
	if err := runpodSpendCapBlocks(http.MethodPatch, base+"m3", map[string]interface{}{"workersMax": 2}); err == nil || !strings.Contains(err.Error(), "spend cap") {
		t.Fatalf("capped scale-up allowed: %v", err)
	}
	if err := runpodSpendCapBlocks(http.MethodPost, base+"m3/update", map[string]interface{}{"workersMin": 1, "workersMax": 0}); err == nil {
		t.Fatal("capped warm-up allowed")
	}
	if err := runpodSpendCapBlocks(http.MethodPost, base+"m3/update", map[string]interface{}{"workersMin": 0, "workersMax": 0}); err != nil {
		t.Fatalf("scale-down blocked: %v", err)
	}
	if err := runpodSpendCapBlocks(http.MethodPatch, base+"other", map[string]interface{}{"workersMax": 1}); err != nil {
		t.Fatalf("uncapped endpoint blocked: %v", err)
	}
	later := time.Now().Add(2 * time.Second)
	if err := os.WriteFile(path, []byte(`{"capped":{}}`), 0644); err != nil {
		t.Fatal(err)
	}
	_ = os.Chtimes(path, later, later)
	if err := runpodSpendCapBlocks(http.MethodPatch, base+"m3", map[string]interface{}{"workersMax": 2}); err != nil {
		t.Fatalf("restored endpoint still blocked: %v", err)
	}
}
