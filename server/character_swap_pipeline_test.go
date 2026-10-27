package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCharacterSwapPerShotDefault(t *testing.T) {
	three, _ := planCharacterSwapChunks(20, 5, 10)
	two, _ := planCharacterSwapChunks(20, 10)
	one, _ := planCharacterSwapChunks(20)
	if !characterSwapPerShot(ServiceUsageRequest{}, three) || characterSwapPerShot(ServiceUsageRequest{}, two) || characterSwapPerShot(ServiceUsageRequest{}, one) {
		t.Fatal("default is per-shot from three shots")
	}
	if !characterSwapPerShot(ServiceUsageRequest{MaxQuality: boolPtr(true)}, two) || characterSwapPerShot(ServiceUsageRequest{MaxQuality: boolPtr(true)}, one) {
		t.Fatal("max_quality forces per-shot on multi-shot videos only")
	}
	if characterSwapPerShot(ServiceUsageRequest{MaxQuality: boolPtr(false)}, three) {
		t.Fatal("max_quality=false keeps the single frame")
	}
	if characterSwapPerShot(ServiceUsageRequest{Kind: "exact"}, three) || characterSwapPerShot(ServiceUsageRequest{Kind: "lora"}, three) {
		t.Fatal("per-shot keyframes are H3 lane only")
	}
}

func TestCharacterSwapShotSpans(t *testing.T) {
	chunks, _ := planCharacterSwapChunks(20, 6, 11)
	spans := characterSwapShotSpans(chunks)
	if len(spans) != 3 || spans[0].Start != 0 || math.Abs(spans[1].Start-6) > 1e-9 || math.Abs(spans[2].End-20) > 1e-9 {
		t.Fatalf("spans %+v", spans)
	}
	if math.Abs(spans[1].Mid()-8.5) > 1e-9 {
		t.Fatalf("mid %v", spans[1].Mid())
	}
	last := 0
	for _, span := range spans {
		if span.First != last {
			t.Fatalf("spans must tile the chunks: %+v", spans)
		}
		last = span.Last + 1
	}
	if last != len(chunks) {
		t.Fatalf("spans cover %d of %d chunks", last, len(chunks))
	}
}

func TestCharacterSwapKeyframePrompt(t *testing.T) {
	people := []characterSwapShotPerson{{Box: [4]float64{0.1, 0.1, 0.4, 0.9}, Face: true}, {Box: [4]float64{0.55, 0.1, 0.9, 0.9}, Face: false}}
	prompt := characterSwapKeyframePrompt(people, 2, 2, "bright orange (#B35420)", "extra words", "")
	for _, want := range []string{"2 people", "person on the LEFT with the person from Image 2", "person on the RIGHT with the person from Image 3", "seen from behind", "wide shot stays a wide shot", "Remove tattoos, chains and hats", "exactly these 2 people", "extra words", "16:9", "wall stays exactly bright orange (#B35420)", "never darken it"} {
		if !strings.Contains(prompt, want) {
			t.Fatalf("prompt missing %q: %s", want, prompt)
		}
	}
	frame := characterSwapKeyframePrompt(people, 0, 2, "", "", "people 3 vs source 2")
	if !strings.Contains(frame, "Image 2 shows the new characters") || !strings.Contains(frame, "second character from the left in Image 2") || !strings.Contains(frame, "previous attempt was rejected: people 3 vs source 2") {
		t.Fatalf("frame-mode prompt: %s", frame)
	}
	solo := characterSwapKeyframePrompt(people[1:], 0, 2, "", "", "")
	if !strings.Contains(solo, "the person with the second character") {
		t.Fatalf("a lone right-hand person maps to the last character: %s", solo)
	}
	unknown := characterSwapKeyframePrompt(nil, 2, 2, "", "", "")
	if !strings.Contains(unknown, "Replace every person") {
		t.Fatalf("unknown people: %s", unknown)
	}
}

func TestCharacterSwapKeyframeBetter(t *testing.T) {
	ok := characterSwapShotCheck{OK: true, MeanIoU: 0.5}
	bad := characterSwapShotCheck{OK: false, MeanIoU: 0.9}
	if !characterSwapKeyframeBetter(ok, bad) || characterSwapKeyframeBetter(bad, ok) {
		t.Fatal("a validated keyframe beats a higher-iou rejected one")
	}
	if !characterSwapKeyframeBetter(characterSwapShotCheck{MeanIoU: 0.6}, characterSwapShotCheck{MeanIoU: 0.4}) {
		t.Fatal("rejected keyframes rank by iou")
	}
}

func TestCallOpenPathsNanoBanana(t *testing.T) {
	var fields map[string]string
	files := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/edits" || r.Header.Get("Authorization") != "Bearer k" {
			http.Error(w, "bad", http.StatusBadRequest)
			return
		}
		if err := r.ParseMultipartForm(8 << 20); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		fields = map[string]string{"model": r.FormValue("model"), "prompt": r.FormValue("prompt")}
		files = len(r.MultipartForm.File["image[]"])
		_ = json.NewEncoder(w).Encode(map[string]interface{}{"data": []map[string]string{{"b64_json": base64.StdEncoding.EncodeToString([]byte("PNGDATA"))}}})
	}))
	defer server.Close()
	oldKey, oldBase := openPathsAPIKey, openPathsBaseURL
	openPathsAPIKey, openPathsBaseURL = "k", server.URL
	defer func() { openPathsAPIKey, openPathsBaseURL = oldKey, oldBase }()
	got, err := callOpenPathsNanoBanana(context.Background(), "swap", [][]byte{[]byte("a"), []byte("b"), []byte("c")})
	if err != nil || string(got) != "PNGDATA" {
		t.Fatalf("got %q %v", got, err)
	}
	if fields["model"] != characterSwapKeyframeModel || fields["prompt"] != "swap" || files != 3 {
		t.Fatalf("request %+v files=%d", fields, files)
	}
	openPathsAPIKey = ""
	if _, err := callOpenPathsNanoBanana(context.Background(), "swap", nil); err == nil {
		t.Fatal("missing key must fail")
	}
}

func TestCharacterSwapKeyframeTarget(t *testing.T) {
	if w, h := characterSwapKeyframeTarget(1920, 1080); w != 1280 || h != 720 {
		t.Fatalf("%dx%d", w, h)
	}
	if w, h := characterSwapKeyframeTarget(854, 481); w != 854 || h != 480 {
		t.Fatalf("%dx%d", w, h)
	}
}

func TestSwapScoreReport(t *testing.T) {
	var report swapScoreReport
	raw := `{"overall": 71.5, "pose": {"joint_err_torso": 0.31, "score": 80}, "framing": {"score": 66.0}, "identity": {"score": 58}, "lipsync": {"score": 40, "method": "syncnet"}, "per_shot": [{"start": 0, "end": 3}], "verdict": "ok", "extra": 1}`
	if err := json.Unmarshal([]byte(raw), &report); err != nil {
		t.Fatal(err)
	}
	m := report.summary()
	if m.Overall != 71.5 || m.Pose != 0.31 || m.Framing != 66 || m.Identity != 58 || m.Lipsync != 40 {
		t.Fatalf("summary %+v", m)
	}
	public := report.publicResult()
	if public["available"] != true || public["verdict"] != "ok" || public["per_shot"] == nil {
		t.Fatalf("public %+v", public)
	}
	if _, leaked := public["extra"]; leaked {
		t.Fatal("unlisted keys stay internal")
	}
}

func TestCharacterSwapAttemptSelection(t *testing.T) {
	m := func(score float64) *characterSwapClipMetrics { return &characterSwapClipMetrics{Overall: score} }
	good := characterSwapAttempt{Metrics: m(80), Score: 80}
	weak := characterSwapAttempt{Metrics: m(40), Score: 40}
	leaky := characterSwapAttempt{Metrics: m(90), Leaked: true, LeakCount: 2, Score: characterSwapClipScore(90, true, 2, 0)}
	if !good.acceptable(55) || weak.acceptable(55) || leaky.acceptable(55) {
		t.Fatal("gate: score threshold and leak")
	}
	if !good.better(weak) || weak.better(good) || !good.better(leaky) {
		t.Fatal("best-of-N follows the combined score")
	}
	if characterSwapClipScore(90, true, 2, 0) != 90-characterSwapLeakPenalty-10 {
		t.Fatal("leak penalty")
	}
	noMetricsClean := characterSwapAttempt{}
	noMetricsLeak := characterSwapAttempt{Leaked: true, LeakCount: 3}
	fewerLeaks := characterSwapAttempt{Leaked: true, LeakCount: 1}
	if !noMetricsClean.acceptable(55) || noMetricsLeak.acceptable(55) || !noMetricsClean.better(noMetricsLeak) || !fewerLeaks.better(noMetricsLeak) || noMetricsLeak.better(fewerLeaks) {
		t.Fatal("without metrics the vision verdict decides, as before")
	}
}

func TestRunCharacterSwapScoreStub(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "stub.sh")
	body := "#!/bin/sh\nwhile [ $# -gt 0 ]; do if [ \"$1\" = \"--json\" ]; then out=\"$2\"; fi; shift; done\necho '{\"overall\": 64, \"pose\": {\"joint_err_torso\": 0.2}}' > \"$out\"\n"
	if err := os.WriteFile(script, []byte(body), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CHARACTER_SWAP_SCORE_PYTHON", "sh")
	t.Setenv("CHARACTER_SWAP_SCORE_SCRIPT", script)
	atomicReset()
	report, err := runCharacterSwapScore(context.Background(), "a.mp4", "b.mp4", []string{"r.png"}, dir)
	if err != nil || report.summary().Overall != 64 || report.summary().Pose != 0.2 {
		t.Fatalf("stub report %v %v", report, err)
	}
	t.Setenv("CHARACTER_SWAP_SCORE_SCRIPT", filepath.Join(dir, "missing.py"))
	if _, err := runCharacterSwapScore(context.Background(), "a.mp4", "b.mp4", nil, dir); err == nil || characterSwapScoreAvailable() {
		t.Fatal("a missing script degrades to no metrics")
	}
	if reason := characterSwapScoreSkipReason(); !strings.Contains(reason, "script not found") {
		t.Fatalf("skip reason %q", reason)
	}
	t.Setenv("CHARACTER_SWAP_SCORE_SCRIPT", script)
	t.Setenv("CHARACTER_SWAP_SCORE", "false")
	if characterSwapScoreAvailable() {
		t.Fatal("CHARACTER_SWAP_SCORE=false disables metrics")
	}
}

func TestRunCharacterSwapScoreDisablesAfterFailures(t *testing.T) {
	dir := t.TempDir()
	script := filepath.Join(dir, "fail.sh")
	if err := os.WriteFile(script, []byte("#!/bin/sh\nexit 3\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("CHARACTER_SWAP_SCORE_PYTHON", "sh")
	t.Setenv("CHARACTER_SWAP_SCORE_SCRIPT", script)
	atomicReset()
	for i := 0; i < characterSwapScoreMaxMisses; i++ {
		if _, err := runCharacterSwapScore(context.Background(), "a", "b", nil, dir); err == nil {
			t.Fatal("failing script must not report")
		}
	}
	if characterSwapScoreAvailable() {
		t.Fatal("repeated failures disable the scorer")
	}
	atomicReset()
}

func atomicReset() {
	characterSwapScoreMisses = 0
	characterSwapScoreDisabled = 0
}

func TestCharacterSwapLipSyncOptIn(t *testing.T) {
	off := ServiceUsageRequest{VideoURL: "https://x/a.mp4", ImageURL: "https://x/b.png"}
	on := off
	on.Params = json.RawMessage(`{"lipsync": true}`)
	if characterSwapLipSyncRequested(off) || !characterSwapLipSyncRequested(on) {
		t.Fatal("lipsync is opt-in through params")
	}
	exact := on
	exact.Kind = "exact"
	if characterSwapLipSyncRequested(exact) {
		t.Fatal("lipsync is H3 lane only")
	}
	chunks, _ := planCharacterSwapChunks(30)
	if fee := characterSwapLipSyncMaxFee(on, chunks); math.Abs(fee-float64(len(chunks))*5*characterSwapLipSyncChargeUSD) > 1e-9 {
		t.Fatalf("max fee %.2f", fee)
	}
	if characterSwapLipSyncMaxFee(off, chunks) != 0 {
		t.Fatal("no fee when off")
	}
	base, _, _, _ := characterSwapEstimate(ServiceUsageRequest{Resolution: "768P", ImageURL: "https://x/i.png", MaxQuality: boolPtr(false)}, 30)
	withLip, _, _, _ := characterSwapEstimate(ServiceUsageRequest{Resolution: "768P", ImageURL: "https://x/i.png", MaxQuality: boolPtr(false), Params: on.Params}, 30)
	if math.Abs(withLip-base-characterSwapLipSyncMaxFee(on, chunks)) > 1e-9 {
		t.Fatalf("estimate must carry the lipsync fee: %.2f vs %.2f", withLip, base)
	}
	if characterSwapLipSyncFee(8) != 0.8 {
		t.Fatalf("fee for 8 s %.2f", characterSwapLipSyncFee(8))
	}
}

func TestCharacterSwapKeyframeCostIsBelowGPTRedraw(t *testing.T) {
	if characterSwapKeyframeUSD*float64(1+characterSwapKeyframeRetries) > characterSwapShotFeeUSD {
		t.Fatalf("worst-case keyframe provider cost must fit the per-shot fee")
	}
}

func TestCharacterSwapShotHelpers(t *testing.T) {
	python := os.Getenv("CHARACTER_SWAP_PYTHON")
	src := filepath.Join("..", "testvid", "rapviddario", "kf", "shot4-src.png")
	out := filepath.Join("..", "testvid", "rapviddario", "kf", "shot4.png")
	if python == "" {
		t.Skip("CHARACTER_SWAP_PYTHON not set")
	}
	if _, err := os.Stat(out); err != nil {
		t.Skip("sample keyframes not present")
	}
	t.Setenv("CHARACTER_SWAP_HELPER", "charswap_exact.py")
	people, ok := characterSwapShotPeople(context.Background(), src)
	if !ok || len(people) != 2 || people[0].Box[0] > people[1].Box[0] {
		t.Fatalf("people %+v %v", people, ok)
	}
	check, ok := characterSwapCheckKeyframe(context.Background(), src, out)
	if !ok || !check.OK || check.MeanIoU < 0.5 {
		t.Fatalf("check %+v %v", check, ok)
	}
	other := filepath.Join("..", "testvid", "rapviddario", "kf", "shot5.png")
	if bad, ok := characterSwapCheckKeyframe(context.Background(), src, other); !ok || bad.OK {
		t.Fatalf("a close-up must not validate against the wide source: %+v", bad)
	}
}

func TestCharacterSwapBackgroundGate(t *testing.T) {
	clean := characterSwapAttempt{Metrics: &characterSwapClipMetrics{Overall: 70, BGDrift: 8}}
	clean.Score = characterSwapClipScore(70, false, 0, 8)
	dark := characterSwapAttempt{Metrics: &characterSwapClipMetrics{Overall: 72, BGDrift: 52}}
	dark.Score = characterSwapClipScore(72, false, 0, 52)
	if clean.gate(50) != "" || !strings.Contains(dark.gate(50), "background drift 52") {
		t.Fatalf("gate: %q %q", clean.gate(50), dark.gate(50))
	}
	if !clean.better(dark) || dark.better(clean) || dark.Score >= 72-characterSwapBGPenalty {
		t.Fatalf("a dark wall must lose to a clean clip despite a higher overall: %.1f vs %.1f", dark.Score, clean.Score)
	}
	t.Setenv("CHARACTER_SWAP_BG_DRIFT", "60")
	dark.Score = characterSwapClipScore(72, false, 0, 52)
	if dark.gate(50) != "" {
		t.Fatal("CHARACTER_SWAP_BG_DRIFT raises the limit")
	}
}

func TestCharacterSwapBackgroundClause(t *testing.T) {
	state := characterSwapState{Request: ServiceUsageRequest{Prompt: "p"}, SwappedImageURL: "https://x/i.png"}
	named := characterSwapFalInput(state, characterSwapChunk{Index: 0, Duration: 5, SourceURL: "https://x/c.mp4", Background: "bright orange (#B35420)"})["prompt"].(string)
	if !strings.Contains(named, "wall is bright orange (#B35420) in every frame") || strings.Contains(named, "dark") {
		t.Fatalf("named background: %s", named)
	}
	generic := characterSwapFalInput(state, characterSwapChunk{Index: 0, Duration: 5, SourceURL: "https://x/c.mp4"})["prompt"].(string)
	if !strings.Contains(generic, "lighting are exactly those of Video 1") || strings.Contains(generic, "dark") {
		t.Fatalf("generic clause missing: %s", generic)
	}
}

func TestCharacterSwapBackgroundPhrase(t *testing.T) {
	var none *characterSwapBackground
	if none.phrase() != "" || (&characterSwapBackground{Hex: "#B35420", Name: "bright orange"}).phrase() != "bright orange (#B35420)" {
		t.Fatal("phrase")
	}
}
