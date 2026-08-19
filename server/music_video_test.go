package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestNormalizeMusicVideoRequestBuildsMiniMaxSoundtrack(t *testing.T) {
	req := ServiceUsageRequest{
		Service: "h3_video", MusicVideo: true,
		Prompt:   "A chrome moth orchestra circles a moonlit radio tower",
		ImageURL: "https://media.example/opening.webp",
	}
	musicPrompt, musicDuration, err := normalizeMusicVideoRequest(&req)
	if err != nil {
		t.Fatal(err)
	}
	if req.FirstFrame != req.ImageURL || req.Duration != musicVideoH3Duration || req.MusicDuration != 30 {
		t.Fatalf("normalized request = %#v", req)
	}
	if !strings.Contains(musicPrompt, "Instrumental cinematic soundtrack") || musicDuration != 30 {
		t.Fatalf("soundtrack defaults = %q, %d", musicPrompt, musicDuration)
	}
	if req.IncludeAudio == nil || !*req.IncludeAudio {
		t.Fatal("music video must retain the driving soundtrack")
	}
}

func TestNormalizeMusicVideoRequestRequiresSingleOpeningFrame(t *testing.T) {
	base := ServiceUsageRequest{MusicVideo: true, Prompt: "Dreamlike coral city music video", Duration: 5}
	if _, _, err := normalizeMusicVideoRequest(&base); err == nil || !strings.Contains(err.Error(), "first_frame") {
		t.Fatalf("missing frame error = %v", err)
	}
	for name, mutate := range map[string]func(*ServiceUsageRequest){
		"loop":       func(req *ServiceUsageRequest) { req.Loop = true },
		"long":       func(req *ServiceUsageRequest) { req.Duration = 30 },
		"user audio": func(req *ServiceUsageRequest) { req.AudioURL = "https://media.example/existing.mp3" },
	} {
		t.Run(name, func(t *testing.T) {
			req := ServiceUsageRequest{MusicVideo: true, Prompt: "Dreamlike coral city music video", FirstFrame: "https://media.example/frame.webp", Duration: 5}
			mutate(&req)
			if _, _, err := normalizeMusicVideoRequest(&req); err == nil {
				t.Fatalf("expected invalid request: %#v", req)
			}
		})
	}
}

func TestMergeMusicVideoResultPublishesSearchMetadata(t *testing.T) {
	state := musicVideoState{
		Request:     ServiceUsageRequest{Prompt: "Neon percussion garden", FirstFrame: "https://media.example/frame.webp"},
		MusicPrompt: "glitch percussion and glass marimba", MusicDuration: 30,
		AudioID: "music_123", AudioURL: "https://media.example/score.mp3", MusicCreditsUsed: 80,
	}
	stored, _ := json.Marshal(musicVideoEnvelope{MusicVideo: state})
	job := &VideoJob{ID: "video_123", Service: musicVideoService, Result: stored}
	merged := mergeMusicVideoResult(job, []byte(`{"video_url":"https://media.example/video.webm"}`))
	var result map[string]interface{}
	if err := json.Unmarshal(merged, &result); err != nil {
		t.Fatal(err)
	}
	if result["music_video"] != true || result["kind"] != musicVideoService {
		t.Fatalf("music video flags = %#v", result)
	}
	if result["music_audio_url"] != state.AudioURL || result["music_audio_id"] != state.AudioID {
		t.Fatalf("soundtrack metadata = %#v", result)
	}
}

func TestExposePublicMusicVideoStatusKeepsOnlySafeProgress(t *testing.T) {
	payload := map[string]interface{}{
		"_music_video": map[string]interface{}{
			"stage": "video", "audio_url": "https://cdn.example/score.mp3",
			"request": map[string]interface{}{"prompt": "internal request"},
		},
	}
	exposePublicMusicVideoStatus(payload)
	if payload["music_video"] != true || payload["stage"] != "video" {
		t.Fatalf("expected safe public progress metadata, got %#v", payload)
	}
	if payload["music_audio_url"] != "https://cdn.example/score.mp3" {
		t.Fatalf("expected persisted soundtrack URL, got %#v", payload)
	}
	if _, exposed := payload["request"]; exposed {
		t.Fatalf("internal request must not be copied to the public result")
	}
}

func TestMusicVideoDoesNotQueueFallbackToUnpreparedLocalWorker(t *testing.T) {
	if h3QueueFallbackAllowed(&VideoJob{Service: musicVideoService}) {
		t.Fatal("music video reference jobs must remain on the audio-ready serverless worker")
	}
	if !h3QueueFallbackAllowed(&VideoJob{Service: "h3_video"}) {
		t.Fatal("ordinary H3 jobs should retain local queue fallback")
	}
}
