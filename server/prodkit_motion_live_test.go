//go:build prodkitlive

package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestProdkitMotionLive(t *testing.T) {
	video, music := os.Getenv("MOTION_LIVE_VIDEO"), os.Getenv("MOTION_LIVE_AUDIO")
	if video == "" {
		t.Skip("MOTION_LIVE_VIDEO not set")
	}
	dir := t.TempDir()
	stubs := stubProdkitIO(t, dir)
	stubs.sources["https://x.test/v.mp4"] = video
	stubs.sources["https://x.test/a.mp3"] = music
	cases := []ServiceUsageRequest{
		{Service: prodkitMotionTrack, VideoURL: "https://x.test/v.mp4", Duration: 3},
		{Service: prodkitMotionFX, VideoURL: "https://x.test/v.mp4", Duration: 3, Params: json.RawMessage(`{"preset":"anime-fight","intensity":1.2}`)},
		{Service: prodkitMotionScore, VideoURL: "https://x.test/v.mp4", Duration: 3},
	}
	if music != "" {
		cases = append(cases,
			ServiceUsageRequest{Service: prodkitBeatDrop, VideoURL: "https://x.test/v.mp4", AudioURL: "https://x.test/a.mp3", Duration: 3, Params: json.RawMessage(`{"audio_start":8}`)},
			ServiceUsageRequest{Service: prodkitMotionScore, VideoURL: "https://x.test/v.mp4", AudioURL: "https://x.test/a.mp3", Duration: 3})
	}
	for _, req := range cases {
		if err := normalizeProdkitRequest(&req); err != nil {
			t.Fatal(err)
		}
		work := filepath.Join(dir, req.Service+string(rune('a'+len(req.AudioURL)%7)))
		_ = os.MkdirAll(work, 0o755)
		result, seconds, _, err := runProdkitMotion(context.Background(), &VideoJob{ID: "live", UserID: "live"}, req, work, func(s string) { t.Log(req.Service, "stage", s) })
		if err != nil {
			t.Fatalf("%s: %v", req.Service, err)
		}
		blob, _ := json.Marshal(result)
		t.Logf("%s seconds=%.1f price=$%.2f %s", req.Service, seconds, prodkitMotionPriceUSD(req.Service, seconds), string(blob)[:min(len(blob), 400)])
		if result["video_url"] == nil {
			t.Fatalf("%s: no video_url", req.Service)
		}
	}
}
