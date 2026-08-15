package main

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func TestMusic3PublicPriceUSD(t *testing.T) {
	for duration, want := range map[int]float64{30: 1.90, 60: 2.30, 90: 2.70, 180: 3.90} {
		if got := music3PublicPriceUSD(duration); math.Abs(got-want) > 0.000001 {
			t.Fatalf("duration %d price = %.2f, want %.2f", duration, got, want)
		}
	}
}

func TestMusic3PromptGuard(t *testing.T) {
	if err := music3PromptGuard("cinematic synthwave", "[Verse]\nNeon on the water"); err != nil {
		t.Fatalf("safe prompt rejected: %v", err)
	}
	if err := music3PromptGuard("sound exactly like a named singer", ""); err == nil {
		t.Fatal("voice imitation request should be rejected")
	}
}

func TestRecordMusic3Event(t *testing.T) {
	path := filepath.Join(t.TempDir(), "music3-events.jsonl")
	t.Setenv("MUSIC3_EVENT_LOG_PATH", path)
	recordMusic3Event("music3_job_completed", "job-123", map[string]interface{}{"charged_usd": 0.50})
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var event map[string]interface{}
	if err := json.Unmarshal(raw, &event); err != nil {
		t.Fatalf("event is not valid JSON: %v", err)
	}
	if event["event"] != "music3_job_completed" || event["job_id"] != "job-123" {
		t.Fatalf("unexpected event: %#v", event)
	}
}
