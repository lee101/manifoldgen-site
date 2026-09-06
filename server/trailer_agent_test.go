package main

import (
	"context"
	"math"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalizeTrailerRequestDefaults(t *testing.T) {
	req := dramatizeRequest{Prompt: "  a dark trailer  ", MaxShots: 99, ConsistentCharacters: true}
	if err := normalizeTrailerRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Mode != "trailer" || req.MaxShots != trailerHardMaxShots || req.ImageModel != "gpt-image-2" {
		t.Fatalf("normalized = %+v", req)
	}
	if req.VisionModel != trailerStoryModel() {
		t.Fatalf("vision = %s", req.VisionModel)
	}
	if req.VideoURL != "" {
		t.Fatal("trailer must not require a source video")
	}
	if req.ConsistencyPasses != remakeDefaultConsistencyPasses {
		t.Fatalf("passes = %d", req.ConsistencyPasses)
	}
}

func TestNormalizeTrailerSketchUsesZImage(t *testing.T) {
	req := dramatizeRequest{Prompt: "brief", Sketch: true, ImageModel: "gpt-image-2"}
	if err := normalizeTrailerRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.ImageModel != "zimage" {
		t.Fatalf("sketch model = %s", req.ImageModel)
	}
}

func TestParseTrailerShotList(t *testing.T) {
	prompt := "Create a trailer.\nSHOT 1 — 5 seconds. Dusk over Wickhollow.\nSHOT 2 — Vesper and Orin in the loft.\nNot a shot line."
	shots := parseTrailerShotList(prompt, 5, 8)
	if len(shots) != 2 {
		t.Fatalf("shots = %d", len(shots))
	}
	if shots[0].VisualDescription != "Dusk over Wickhollow." || shots[1].Seconds != 5 {
		t.Fatalf("parsed = %+v", shots)
	}
}

func TestTrailerCharactersFromBibleDedupesLunaAliases(t *testing.T) {
	bible := "Orin Calder — 18, lean, wet-bark coat\nVesper Rane — 21, throat scar\n"
	specs := []RemakeCharacterSpec{{ID: "orin", Name: "Orin"}, {ID: "vesper", Name: "Vesper"}, {ID: "orin-calder", Name: "Orin Calder"}}
	assets := trailerCharactersFromBible(bible, specs, nil)
	if len(assets) != 2 {
		t.Fatalf("assets = %+v", assets)
	}
	if assets[0].ID != "orin-calder" || assets[1].ID != "vesper-rane" {
		t.Fatalf("ids = %s %s", assets[0].ID, assets[1].ID)
	}
}

func TestTrailerSamePerson(t *testing.T) {
	if !trailerSamePerson("orin", "orin-calder") || !trailerSamePerson("Vesper Rane", "vesper") {
		t.Fatal("short ids should match bible names")
	}
	if trailerSamePerson("orin", "vesper") || trailerSamePerson("", "orin") {
		t.Fatal("unrelated ids must not collapse")
	}
}

func TestTrailerShotShowsPersonAliases(t *testing.T) {
	shot := DramatizeShot{Characters: []string{"orin"}, VisualDescription: "Orin at the mill"}
	if !trailerShotShowsPerson(shot, RemakeReferenceAsset{ID: "orin-calder", Name: "Orin Calder"}) {
		t.Fatal("shot orin should match orin-calder sheet")
	}
}

func TestTrailerStoryModelDefault(t *testing.T) {
	if trailerStoryModelDefault != "grok-4.6" {
		t.Fatalf("story model = %s", trailerStoryModelDefault)
	}
	if !strings.Contains(trailerCraftGuidance, "Preserve the user's story") {
		t.Fatal("craft guidance must not replace the brief")
	}
}

func TestTrailerReviewResizeMaxSide(t *testing.T) {
	if trailerReviewMaxSide != 800 {
		t.Fatalf("max side = %d", trailerReviewMaxSide)
	}
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg")
	}
	if _, err := exec.LookPath("ffprobe"); err != nil {
		t.Skip("ffprobe")
	}
	dir := t.TempDir()
	src := filepath.Join(dir, "wide.png")
	if out, err := exec.Command("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "color=c=black:s=1600x900", "-frames:v", "1", src).CombinedOutput(); err != nil {
		t.Fatalf("src: %v %s", err, out)
	}
	dest := filepath.Join(dir, "out.jpg")
	if err := trailerResizeStill(context.Background(), src, dest); err != nil {
		t.Fatal(err)
	}
	out, err := exec.Command("ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", dest).Output()
	if err != nil {
		t.Fatal(err)
	}
	got := strings.TrimSpace(string(out))
	if got != "800,450" {
		t.Fatalf("resized = %s", got)
	}
}

func TestNormalizeTrailerDurationClampsToH3AudioWindow(t *testing.T) {
	req := dramatizeRequest{Prompt: "brief", Seconds: 20}
	if err := normalizeTrailerRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Seconds != trailerMaxShotSeconds {
		t.Fatalf("long shot = %v", req.Seconds)
	}
	req = dramatizeRequest{Prompt: "brief", Seconds: 2}
	if err := normalizeTrailerRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Seconds != trailerMinShotSeconds {
		t.Fatalf("short shot = %v", req.Seconds)
	}
}

func TestTrailerSnapSeconds(t *testing.T) {
	if trailerSnapSeconds(4.2) != 5 || trailerSnapSeconds(15.4) != 15 || trailerSnapSeconds(8) != 8 {
		t.Fatalf("snap 4.2/15.4/8 = %d/%d/%d", trailerSnapSeconds(4.2), trailerSnapSeconds(15.4), trailerSnapSeconds(8))
	}
}

func TestTrailerVoiceForName(t *testing.T) {
	a := trailerVoiceForName("Vesper Rane")
	b := trailerVoiceForName("Vesper Rane")
	if a.Voice == "" || a.Voice != b.Voice {
		t.Fatalf("voice must be stable: %+v %+v", a, b)
	}
	if trailerVoiceForName("").Voice == "" {
		t.Fatal("empty name needs a default voice")
	}
}

func TestTrailerTitleFromText(t *testing.T) {
	if got := trailerTitleFromText("Smash to black. Title: CONJURER'S SOUL. Vesper whispers."); got != "CONJURER'S SOUL" {
		t.Fatalf("title = %q", got)
	}
}

func TestTrailerMotionPrompt(t *testing.T) {
	got := trailerMotionPrompt("Slow dolly on two figures in rain.")
	if !strings.Contains(got, "lip sync") || !strings.Contains(got, "Slow dolly") {
		t.Fatalf("motion = %q", got)
	}
}

func TestSeedTrailerTranscript(t *testing.T) {
	got := seedTrailerTranscript(`Candlelit loft. Vesper: [whispers][caution] If you call him, he will answer. That is the danger.`, nil)
	if !strings.Contains(got, "Speaker 1:") || !strings.Contains(got, "[whispers]") || !strings.Contains(got, "If you call him") {
		t.Fatalf("transcript = %q", got)
	}
	quoted := seedTrailerTranscript(`Silver aims: "I told you not to hide."`, []string{"silver-hade"})
	if !strings.Contains(quoted, "Speaker 1:") || !strings.Contains(quoted, "I told you not to hide") {
		t.Fatalf("quoted = %q", quoted)
	}
}

func TestTrailerDirectorPrompt(t *testing.T) {
	shot := DramatizeShot{VisualDescription: "A dark mill loft", Environment: "Candlelit mill loft", DirectorNote: "Close, almost a whisper.", Seconds: 5}
	prompt := trailerDirectorPrompt(shot, "Speaker 1: [whispers] Stay near.", []trailerVoice{{Voice: "Kore", Profile: "A low speaker", Style: "Whispering", Pace: "Measured", Accent: "Neutral"}}, 5)
	for _, needle := range []string{"# Audio Profile", "# Director's note", "## Scene:", "## Transcript:", "[whispers]", "5 seconds", "Whispering", "Stay near"} {
		if !strings.Contains(prompt, needle) {
			t.Fatalf("missing %q in %s", needle, prompt)
		}
	}
}

func TestTrailerH3RequestIncludesDriveAudio(t *testing.T) {
	req := trailerH3Request("speak", "https://cdn.example/frame.png", "https://cdn.example/drive.wav", 5)
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatal(err)
	}
	input := appNZH3Input(req)
	if input["audio"] != "https://cdn.example/drive.wav" || input["first_frame"] != "https://cdn.example/frame.png" {
		t.Fatalf("input = %#v", input)
	}
	if req.Duration != 5 {
		t.Fatalf("duration = %d", req.Duration)
	}
}

func TestTrailerSpeechFilterTiming(t *testing.T) {
	if !strings.Contains(trailerSpeechFilter(0, 3.0, 5), "apad") {
		t.Fatal("short speech should pad")
	}
	if !strings.Contains(trailerSpeechFilter(0, 6.5, 5), "atrim") {
		t.Fatal("long speech should trim")
	}
	if !strings.Contains(trailerSpeechFilter(0, 5.25, 5), "atempo") {
		t.Fatal("slightly long speech should atempo")
	}
}

func TestTrailerFitAudioDuration(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg")
	}
	if _, err := exec.LookPath("ffprobe"); err != nil {
		t.Skip("ffprobe")
	}
	dir := t.TempDir()
	src := filepath.Join(dir, "src.wav")
	if out, err := exec.Command("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=3.2", src).CombinedOutput(); err != nil {
		t.Fatalf("sine: %v %s", err, out)
	}
	dest := filepath.Join(dir, "out.wav")
	if err := mixTrailerDriveAudio(context.Background(), src, "", 0, 5, dest); err != nil {
		t.Fatal(err)
	}
	dur, err := probeAudioSeconds(context.Background(), dest)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(dur-5) > 0.08 {
		t.Fatalf("fitted duration = %v", dur)
	}
}

func TestTrailerSpeechUSDUsesGeminiRates(t *testing.T) {
	got, _, _ := geminiTTSResultCostUSD([]byte(`{"input_tokens":100,"output_tokens":400}`), 9)
	if math.Abs(got-geminiTTSCostUSD(100, 400)) > 1e-9 {
		t.Fatalf("speech usd = %v", got)
	}
	est := estimateGeminiTTSCostUSD(strings.Repeat("n", trailerTTSCharsGuess))
	if est <= 0 || est > 0.5 {
		t.Fatalf("guessed shot speech = %v", est)
	}
}

func TestTrailerEstimateSketchesAreCheaper(t *testing.T) {
	prod := trailerEstimate(dramatizeRequest{Prompt: "x", SettingPrompt: "wet marsh", CharacterBible: "Orin — boy\nVesper — girl", ConsistentCharacters: true, ConsistencyPasses: 2, MaxShots: 8, Seconds: 5})
	sketch := trailerEstimate(dramatizeRequest{Prompt: "x", SettingPrompt: "wet marsh", CharacterBible: "Orin — boy\nVesper — girl", ConsistentCharacters: true, MaxShots: 8, Seconds: 5, Sketch: true, ImageModel: "zimage"})
	if prod.MotionUSD <= 0 || sketch.MotionUSD != 0 {
		t.Fatalf("motion prod=%v sketch=%v", prod.MotionUSD, sketch.MotionUSD)
	}
	if sketch.EstimatedCostUSD >= prod.EstimatedCostUSD {
		t.Fatalf("sketch should be cheaper: sketch=%v prod=%v", sketch.EstimatedCostUSD, prod.EstimatedCostUSD)
	}
	if !strings.Contains(prod.Settlement, "completion") {
		t.Fatal(prod.Settlement)
	}
}
