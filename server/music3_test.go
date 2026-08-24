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

func TestCompletedMusicJobBuildsPublicIndexedAsset(t *testing.T) {
	job := &VideoJob{ID: "job-1", UserID: "user-1", Service: "music_generation", Prompt: "  relaxing isochronic ambient  ", Result: []byte(`{"_music3_request":{"duration":90}}`)}
	result := []byte(`{"audio_id":"","audio_url":"https://static.example/track.wav","duration_seconds":92}`)
	asset, err := h3AudioAssetFromResult(job, result)
	if err != nil {
		t.Fatalf("asset build failed: %v", err)
	}
	if asset.Kind != "music" || !asset.Public || asset.Prompt != "relaxing isochronic ambient" {
		t.Fatalf("unexpected asset: %#v", asset)
	}
	if asset.AudioURL != "https://static.example/track.wav" || asset.DurationSeconds != 92 || asset.ID == "" {
		t.Fatalf("unexpected asset payload: %#v", asset)
	}
	if _, err := h3AudioAssetFromResult(job, []byte(`{"audio_url":""}`)); err == nil {
		t.Fatal("result without audio URL should not index")
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
