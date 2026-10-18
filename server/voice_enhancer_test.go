package main

import (
	"strings"
	"testing"
)

func TestVoiceEnhancerPriceKeepsHalfAsMargin(t *testing.T) {
	t.Setenv("VOICE_ENHANCER_GPU_USD_PER_HOUR", "1.12")
	for _, seconds := range []float64{10, 60, 180, 360} {
		cost := voiceEnhancerGPUSeconds(seconds, voiceEnhancerTracks, 2) * 1.12 / 3600
		price := voiceEnhancerPriceUSD("enhance", seconds, voiceEnhancerTracks, "")
		if price < 2*cost-0.005 {
			t.Fatalf("%.0fs: price $%.2f below 2x cost $%.3f", seconds, price, cost)
		}
		if price < voiceEnhancerMinPriceUSD {
			t.Fatalf("%.0fs: price $%.2f below the minimum", seconds, price)
		}
	}
	if voiceEnhancerPriceUSD("enhance", 360, voiceEnhancerTracks, "") <= voiceEnhancerPriceUSD("enhance", 60, voiceEnhancerTracks, "") {
		t.Fatal("longer songs must cost more")
	}
	// A three-minute take with all three tracks stays an impulse buy.
	if price := voiceEnhancerPriceUSD("enhance", 180, voiceEnhancerTracks, ""); price > 0.5 {
		t.Fatalf("3 minute song priced at $%.2f", price)
	}
}

func TestLyricMusicQualityChangesPrice(t *testing.T) {
	t.Setenv("VOICE_ENHANCER_GPU_USD_PER_HOUR", "1.12")
	tracks := []string{"voice", "studio"}
	for _, seconds := range []float64{30, 90, 180, 300} {
		studio := voiceEnhancerPriceUSD("lyrics", seconds, tracks, "studio")
		standard := voiceEnhancerPriceUSD("lyrics", seconds, tracks, "standard")
		lite := voiceEnhancerPriceUSD("lyrics", seconds, tracks, "lite")
		if !(studio > standard && standard > lite) {
			t.Fatalf("%.0fs: expected studio > standard > lite, got %.2f %.2f %.2f", seconds, studio, standard, lite)
		}
		for tier, price := range map[string]float64{"studio": studio, "standard": standard, "lite": lite} {
			cost := voiceEnhancerGPUSeconds(seconds, tracks, voiceEnhancerCandidates(tier))*1.12/3600 + lyricMusicTTSUSD(tier, seconds)
			if price < 2*cost-0.005 {
				t.Fatalf("%.0fs %s: price $%.2f below 2x cost $%.3f", seconds, tier, price, cost)
			}
		}
	}
}

func TestNormalizeVoiceEnhancerRequest(t *testing.T) {
	r2PublicHost = "cdn.example.com"
	upload := "https://cdn.example.com/manifoldgen/u/take.mp3"
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want string
	}{
		{"foreign audio host", ServiceUsageRequest{Service: voiceEnhancerService, AudioURL: "https://evil.example/a.mp3", VoiceConsent: true}, "upload the recording"},
		{"voice track needs consent", ServiceUsageRequest{Service: voiceEnhancerService, AudioURL: upload}, "your own voice"},
		{"studio only needs no consent", ServiceUsageRequest{Service: voiceEnhancerService, AudioURL: upload, Tracks: []string{"studio"}}, ""},
		{"lyrics too short", ServiceUsageRequest{Service: lyricMusicService, Lyrics: "too short"}, "at least a verse"},
		{"unknown tier", ServiceUsageRequest{Service: lyricMusicService, Lyrics: strings.Repeat("word ", 20), Quality: "ultra"}, "quality must be"},
		{"voice outside tier", ServiceUsageRequest{Service: lyricMusicService, Lyrics: strings.Repeat("word ", 20), Quality: "lite", Voice: "Fenrir"}, "unknown voice"},
		{"bad tracks", ServiceUsageRequest{Service: voiceEnhancerService, AudioURL: upload, Tracks: []string{"karaoke"}}, "tracks must include"},
		{"guard", ServiceUsageRequest{Service: lyricMusicService, Lyrics: strings.Repeat("word ", 20), Prompt: "voice clone of a star"}, "safeguards"},
	}
	for _, c := range cases {
		_, err := normalizeVoiceEnhancerRequest(c.req)
		if c.want == "" && err != nil {
			t.Fatalf("%s: unexpected error %v", c.name, err)
		}
		if c.want != "" && (err == nil || !strings.Contains(err.Error(), c.want)) {
			t.Fatalf("%s: want error containing %q, got %v", c.name, c.want, err)
		}
	}
	state, err := normalizeVoiceEnhancerRequest(ServiceUsageRequest{Service: lyricMusicService, Lyrics: strings.Repeat("word ", 300)})
	if err != nil {
		t.Fatal(err)
	}
	if state.TTSTier != "studio" || state.TTSVoice != "Fenrir" || strings.Join(state.Tracks, ",") != "voice,studio" {
		t.Fatalf("lyric defaults: %+v", state)
	}
	if state.InputSeconds != 100 {
		t.Fatalf("300 words should estimate 100 s, got %.1f", state.InputSeconds)
	}
}

func TestTrailerSoundtrackMustBeOurs(t *testing.T) {
	r2PublicHost = "cdn.example.com"
	req := dramatizeRequest{Prompt: "a lyric video", SoundtrackURL: "https://elsewhere.example/song.mp3"}
	if err := normalizeTrailerRequest(&req); err == nil {
		t.Fatal("foreign soundtrack accepted")
	}
	req = dramatizeRequest{Prompt: "a lyric video", SoundtrackURL: "https://cdn.example.com/manifoldgen/u/song.mp3"}
	if err := normalizeTrailerRequest(&req); err != nil {
		t.Fatal(err)
	}
}
