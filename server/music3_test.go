package main

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
)

func TestMusic3PublicPriceUSD(t *testing.T) {
	for duration, want := range map[int]float64{30: 0.35, 60: 0.40, 90: 0.48, 180: 0.70} {
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

func TestMusicGenerationIsAudioJob(t *testing.T) {
	job := &VideoJob{Service: "music_generation", Result: []byte(`{"_music3_request":{"duration":60}}`)}
	if !h3AudioJob(job) || audioJobKind(job) != "music" || h3AudioDuration(job) != 60 {
		t.Fatalf("music job classification failed: %#v", job)
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
