package main

import (
	"context"
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestProdkitMotionPricing(t *testing.T) {
	cases := []struct {
		service string
		seconds float64
		want    float64
	}{
		{prodkitMotionFX, 1, 0.15},
		{prodkitMotionFX, 2.1, 0.18},
		{prodkitMotionFX, 5, 0.30},
		{prodkitMotionFX, 99, 1.20},
		{prodkitBeatDrop, 1, 0.10},
		{prodkitBeatDrop, 10, 0.40},
		{prodkitBeatDrop, 99, 1.20},
		{prodkitMotionTrack, 1, 0.05},
		{prodkitMotionTrack, 59.2, 1.20},
		{prodkitMotionTrack, 500, 1.20},
		{prodkitMotionScore, 2, 0.20},
		{prodkitMotionScore, 9.5, 0.50},
		{prodkitMotionScore, 99, 1.50},
	}
	for _, tc := range cases {
		if got := prodkitMotionPriceUSD(tc.service, tc.seconds); math.Abs(got-tc.want) > 1e-6 {
			t.Errorf("%s %.1fs = %.4f, want %.4f", tc.service, tc.seconds, got, tc.want)
		}
	}
	est := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", Duration: 10}
	if got := getRequestServicePriceUSD(est); math.Abs(got-0.60) > 1e-6 {
		t.Fatalf("estimate = %.4f", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: prodkitMotionFX}); math.Abs(got-0.30) > 1e-6 {
		t.Fatalf("default estimate = %.4f", got)
	}
	for _, service := range []string{prodkitMotionFX, prodkitBeatDrop, prodkitMotionTrack, prodkitMotionScore} {
		if prodkitUsesPaidProvider(ServiceUsageRequest{Service: service}) {
			t.Errorf("%s must not reserve credits", service)
		}
		tool, ok := prodkitToolFor(service)
		if !ok || tool.Engine != "motion" || prodkitPricingUnits()[service] == "" {
			t.Errorf("%s not registered", service)
		}
	}
}

func TestNormalizeProdkitMotionValidation(t *testing.T) {
	v := "https://x.test/a.mp4"
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want string
	}{
		{"no video", ServiceUsageRequest{Service: prodkitMotionFX}, "video_url"},
		{"unknown param", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"cmd":"x"}`)}, "unknown motion-fx param"},
		{"track takes no params", ServiceUsageRequest{Service: prodkitMotionTrack, VideoURL: v, Params: json.RawMessage(`{"preset":"anime-fight"}`)}, "unknown motion-track param"},
		{"preset", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"preset":"beat-drop"}`)}, "params.preset"},
		{"palette", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"palette":"red"}`)}, "params.palette"},
		{"intensity type", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"intensity":"max"}`)}, "number"},
		{"slowmo type", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"slowmo":"yes"}`)}, "boolean"},
		{"target range", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"target":9}`)}, "params.target"},
		{"target fraction", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"target":1.5}`)}, "params.target"},
		{"names count", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"names":["a","b","c","d","e"]}`)}, "at most 4"},
		{"names length", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"names":["12345678901234567"]}`)}, "at most 16"},
		{"names type", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"names":[1]}`)}, "array of strings"},
		{"extra enum", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"extra":["beats"]}`)}, "params.extra"},
		{"seed", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, Params: json.RawMessage(`{"seed":-1}`)}, "params.seed"},
		{"private audio", ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, AudioURL: "http://10.0.0.1/a.mp3"}, "public"},
		{"beat drop needs audio", ServiceUsageRequest{Service: prodkitBeatDrop, VideoURL: v}, "audio_url"},
		{"beat drop preset", ServiceUsageRequest{Service: prodkitBeatDrop, VideoURL: v, AudioURL: "https://x.test/a.mp3", Params: json.RawMessage(`{"preset":"anime-fight"}`)}, "unknown beat-drop param"},
		{"score keep_audio type", ServiceUsageRequest{Service: prodkitMotionScore, VideoURL: v, Params: json.RawMessage(`{"keep_audio":1}`)}, "boolean"},
	}
	for _, tc := range cases {
		err := normalizeProdkitRequest(&tc.req)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: err = %v, want %q", tc.name, err, tc.want)
		}
	}
	ok := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: v, AudioURL: "https://x.test/a.mp3", Duration: 99,
		Params: json.RawMessage(`{"preset":"Anime-Fight","intensity":9,"palette":"fire","names":["Sensei","Rival"],"extra":["trails","aura"],"target":2,"seed":4}`)}
	if err := normalizeProdkitRequest(&ok); err != nil || ok.Duration != 20 {
		t.Fatalf("err=%v duration=%d", err, ok.Duration)
	}
	if got := prodkitParams(ok)["intensity"]; got != 1.6 {
		t.Fatalf("intensity not clamped: %v", got)
	}
	for service, max := range map[string]int{prodkitBeatDrop: 30, prodkitMotionTrack: 60, prodkitMotionScore: 30} {
		req := ServiceUsageRequest{Service: service, VideoURL: v, AudioURL: "https://x.test/a.mp3", Duration: 500}
		if err := normalizeProdkitRequest(&req); err != nil || req.Duration != max {
			t.Errorf("%s err=%v duration=%d want %d", service, err, req.Duration, max)
		}
	}
	idle := ServiceUsageRequest{Service: prodkitMotionTrack, VideoURL: v}
	if err := normalizeProdkitRequest(&idle); err != nil || idle.Duration != 0 {
		t.Fatalf("duration default = %d err=%v", idle.Duration, err)
	}
}

type motionFake struct {
	manifest string
	code     int
	args     map[string]interface{}
}

func stubProdkitMotion(t *testing.T, dir string, fake *motionFake, clipSeconds float64) *prodkitTestStubs {
	stubs := stubProdkitIO(t, dir)
	oldWorker, oldProbe := prodkitMotionWorker, prodkitMotionProbe
	t.Cleanup(func() { prodkitMotionWorker, prodkitMotionProbe = oldWorker, oldProbe })
	src := filepath.Join(dir, "src.bin")
	_ = os.WriteFile(src, []byte("media"), 0o644)
	stubs.sources["https://x.test/a.mp4"] = src
	stubs.sources["https://x.test/a.mp3"] = src
	prodkitMotionProbe = func(context.Context, string) (prodkitMediaInfo, error) {
		return prodkitMediaInfo{HasVideo: true, Duration: clipSeconds, Width: 1280, Height: 720}, nil
	}
	prodkitMotionWorker = func(_ context.Context, _, argsPath string) (int, error) {
		blob, _ := os.ReadFile(argsPath)
		fake.args = map[string]interface{}{}
		_ = json.Unmarshal(blob, &fake.args)
		out := fake.args["out"].(string)
		_ = os.MkdirAll(out, 0o755)
		for _, name := range []string{"result.mp4", "poster.jpg", "tracks.json", "signals.json", "preview.mp4", "guide.mp4", "result.wav", "cues.json"} {
			_ = os.WriteFile(filepath.Join(out, name), []byte("x"), 0o644)
		}
		return fake.code, os.WriteFile(filepath.Join(out, "manifest.json"), []byte(fake.manifest), 0o644)
	}
	return stubs
}

func runMotionForTest(t *testing.T, req ServiceUsageRequest) (map[string]interface{}, float64, error) {
	t.Helper()
	if err := normalizeProdkitRequest(&req); err != nil {
		t.Fatal(err)
	}
	result, seconds, _, err := runProdkitMotion(context.Background(), &VideoJob{ID: "j1", UserID: "user-1"}, req, t.TempDir(), func(string) {})
	return result, seconds, err
}

const motionFxManifest = `{"ok":true,"tool":"motion-fx","video":"result.mp4","poster":"poster.jpg","tracks":"tracks.json","seconds":9.08,"width":1280,"height":704,"tracks_count":2,"events_count":7,"bpm":84.7,"preset":"anime-fight","slowmo_hits":2,"events":[{"frame":51,"t":2.1,"power":1.5}]}`

func TestProdkitMotionFXRun(t *testing.T) {
	fake := &motionFake{manifest: motionFxManifest}
	stubProdkitMotion(t, t.TempDir(), fake, 12.4)
	req := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", AudioURL: "https://x.test/a.mp3", Duration: 8,
		Params: json.RawMessage(`{"preset":"anime-fight","names":["A","B"],"seed":3}`)}
	result, seconds, err := runMotionForTest(t, req)
	if err != nil {
		t.Fatal(err)
	}
	if seconds != 8 {
		t.Fatalf("billed seconds = %v, want the 8 s window", seconds)
	}
	if prodkitMotionPriceUSD(req.Service, seconds) != 0.48 {
		t.Fatalf("charge = %v", prodkitMotionPriceUSD(req.Service, seconds))
	}
	for _, key := range []string{"video_url", "poster_url", "tracks_url", "events", "bpm", "tracks_count", "events_count", "preset", "duration_seconds"} {
		if _, ok := result[key]; !ok {
			t.Errorf("missing result key %s: %v", key, result)
		}
	}
	for _, key := range []string{"preview_url", "guide_url", "audio_url", "signals_url", "cues_url"} {
		if _, ok := result[key]; ok {
			t.Errorf("unexpected %s", key)
		}
	}
	if fake.args["tool"] != "motion-fx" || fake.args["audio"] == nil || fake.args["music"] != nil || fake.args["device"] != "cpu" {
		t.Fatalf("worker args = %#v", fake.args)
	}
	params := fake.args["params"].(map[string]interface{})
	if params["max_seconds"] != 8.0 || params["preset"] != "anime-fight" || params["seed"] != 3.0 {
		t.Fatalf("worker params = %#v", params)
	}
}

func TestProdkitMotionShortClipBillsActualSeconds(t *testing.T) {
	fake := &motionFake{manifest: motionFxManifest}
	stubProdkitMotion(t, t.TempDir(), fake, 3.2)
	_, seconds, err := runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4"})
	if err != nil || math.Abs(seconds-3.2) > 1e-9 || prodkitMotionPriceUSD(prodkitMotionFX, seconds) != 0.24 {
		t.Fatalf("seconds=%v err=%v", seconds, err)
	}
}

func TestProdkitMotionScoreAndTrackRun(t *testing.T) {
	fake := &motionFake{manifest: `{"ok":true,"video":"result.mp4","audio":"result.wav","cues":"cues.json","poster":"poster.jpg","seconds":5.04,"tracks_count":2,"events_count":14,"bpm":144,"music_prompt":"144 BPM action","music":{"stretch":1.0}}`}
	stubProdkitMotion(t, t.TempDir(), fake, 5)
	result, _, err := runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionScore, VideoURL: "https://x.test/a.mp4", AudioURL: "https://x.test/a.mp3"})
	if err != nil {
		t.Fatal(err)
	}
	if fake.args["music"] == nil || fake.args["audio"] != nil {
		t.Fatalf("score must send music not audio: %#v", fake.args)
	}
	for _, key := range []string{"video_url", "audio_url", "cues_url", "music_prompt", "music"} {
		if _, ok := result[key]; !ok {
			t.Errorf("score missing %s", key)
		}
	}
	fake.manifest = `{"ok":true,"tracks":"tracks.json","signals":"signals.json","preview":"preview.mp4","guide":"guide.mp4","poster":"poster.jpg","seconds":5.04,"tracks_count":2,"events_count":7,"bpm":84.7}`
	result, _, err = runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionTrack, VideoURL: "https://x.test/a.mp4", AudioURL: "https://x.test/a.mp3"})
	if err != nil {
		t.Fatal(err)
	}
	if result["video_url"] != result["preview_url"] || result["guide_url"] == nil || result["signals_url"] == nil || result["tracks_url"] == nil {
		t.Fatalf("track result = %#v", result)
	}
	if fake.args["audio"] != nil || fake.args["music"] != nil {
		t.Fatalf("track must not take audio: %#v", fake.args)
	}
}

func TestProdkitMotionNoPeopleIsNotCharged(t *testing.T) {
	fake := &motionFake{manifest: `{"ok":true,"video":"result.mp4","poster":"poster.jpg","seconds":5,"tracks_count":0}`}
	stubProdkitMotion(t, t.TempDir(), fake, 5)
	for _, service := range []string{prodkitMotionFX, prodkitMotionTrack, prodkitMotionScore} {
		_, _, err := runMotionForTest(t, ServiceUsageRequest{Service: service, VideoURL: "https://x.test/a.mp4"})
		var userErr prodkitUserError
		if err == nil || !strings.Contains(err.Error(), "no people found") {
			t.Errorf("%s err = %v", service, err)
		}
		_ = userErr
		if got := prodkitPublicError(err); !strings.Contains(got, "no people found") {
			t.Errorf("%s public error = %q", service, got)
		}
	}
	result, seconds, err := runMotionForTest(t, ServiceUsageRequest{Service: prodkitBeatDrop, VideoURL: "https://x.test/a.mp4", AudioURL: "https://x.test/a.mp3"})
	if err != nil || result["video_url"] == nil || seconds != 5 {
		t.Fatalf("beat-drop with no people: err=%v seconds=%v", err, seconds)
	}
}

func TestProdkitMotionWorkerFailures(t *testing.T) {
	fake := &motionFake{manifest: `{"ok":false,"error":"beat-drop needs an audio file"}`, code: 2}
	stubProdkitMotion(t, t.TempDir(), fake, 5)
	_, _, err := runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4"})
	if got := prodkitPublicError(err); got != "beat-drop needs an audio file" {
		t.Fatalf("bad input error = %q", got)
	}
	fake.manifest, fake.code = `{"ok":false,"error":"RuntimeError: boom /secret/path"}`, 1
	_, _, err = runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4"})
	if err == nil || strings.Contains(prodkitPublicError(err), "secret") {
		t.Fatalf("internal error leaked: %v", prodkitPublicError(err))
	}
	fake.manifest, fake.code = `{"ok":true,"video":"../etc/passwd","tracks_count":1}`, 0
	if _, _, err = runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4"}); err == nil {
		t.Fatal("path traversal in manifest accepted")
	}
}

func TestProdkitMotionRegistry(t *testing.T) {
	for _, name := range []string{"motion-fx", "beat-drop", "motion-track", "motion-score"} {
		internal := requestedServiceName(name)
		if !isProdkitService(internal) || publicServiceName(internal) != name {
			t.Errorf("alias %s -> %s", name, internal)
		}
		if _, ok := servicePricesUSD[internal]; !ok {
			t.Errorf("%s missing from servicePricesUSD", internal)
		}
	}
	if prodkitSlot("motion") == prodkitSlot("local") || cap(prodkitSlot("motion")) < 1 {
		t.Fatal("motion slot not separate")
	}
	motion := 0
	for _, entry := range prodkitCatalog() {
		if entry["service"] == "motion-fx" || entry["service"] == "beat-drop" || entry["service"] == "motion-track" || entry["service"] == "motion-score" {
			motion++
		}
	}
	if motion != 4 {
		t.Fatalf("catalog has %d motion tools", motion)
	}
}

func TestMCPMotionRequestBodies(t *testing.T) {
	cases := []struct {
		tool string
		args string
		top  []string
		par  []string
	}{
		{"apply_motion_fx", `{"video_url":"https://x.test/a.mp4","audio_url":"https://x.test/a.mp3","preset":"ki-aura","duration":8,"names":["A"],"wait_seconds":5}`, []string{"video_url", "audio_url", "duration", "service"}, []string{"preset", "names"}},
		{"beat_drop_video", `{"video_url":"https://x.test/a.mp4","audio_url":"https://x.test/a.mp3","intensity":1.2,"duration":10}`, []string{"video_url", "audio_url", "duration"}, []string{"intensity"}},
		{"track_motion", `{"video_url":"https://x.test/a.mp4","duration":20}`, []string{"video_url", "duration"}, nil},
		{"score_motion_video", `{"video_url":"https://x.test/a.mp4","audio_url":"https://x.test/a.mp3","keep_audio":true}`, []string{"video_url", "audio_url"}, []string{"keep_audio"}},
	}
	for _, tc := range cases {
		tool, ok := mcpProductionToolByName(tc.tool)
		if !ok {
			t.Fatalf("missing tool %s", tc.tool)
		}
		body, _, err := mcpProductionRequestBody(tool, json.RawMessage(tc.args))
		if err != nil {
			t.Fatal(err)
		}
		var request map[string]json.RawMessage
		_ = json.Unmarshal(body, &request)
		var params map[string]json.RawMessage
		_ = json.Unmarshal(request["params"], &params)
		for _, key := range tc.top {
			if _, ok := request[key]; !ok {
				t.Errorf("%s: %s not top level: %s", tc.tool, key, body)
			}
		}
		for _, key := range tc.par {
			if _, ok := params[key]; !ok {
				t.Errorf("%s: %s not in params: %s", tc.tool, key, body)
			}
		}
		if _, leaked := params["wait_seconds"]; leaked || len(params["duration"]) > 0 || len(params["audio_url"]) > 0 {
			t.Errorf("%s: params leaked top-level fields: %s", tc.tool, body)
		}
		var service string
		_ = json.Unmarshal(request["service"], &service)
		if internal := requestedServiceName(service); !isProdkitService(internal) {
			t.Errorf("%s: service %q not routable", tc.tool, service)
		}
	}
	tool, _ := mcpProductionToolByName("track_motion")
	if _, _, err := mcpProductionRequestBody(tool, json.RawMessage(`{"video_url":"https://x.test/a.mp4","preset":"x"}`)); err == nil {
		t.Fatal("track_motion accepted an unknown argument")
	}
	for _, name := range []string{"motion-fx", "beat-drop", "motion-track", "motion-score"} {
		if _, ok := mcpPromptGet(json.RawMessage(`{"name":"` + name + `"}`)); !ok {
			t.Errorf("missing prompt %s", name)
		}
	}
}

func TestProdkitMotionPresetsAndAudioStart(t *testing.T) {
	for _, preset := range []string{"exaggerate", "echo", "anime-fight"} {
		req := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", Params: json.RawMessage(`{"preset":"` + preset + `","audio_start":12}`)}
		if err := normalizeProdkitRequest(&req); err != nil {
			t.Fatalf("%s: %v", preset, err)
		}
	}
	bad := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", Params: json.RawMessage(`{"audio_start":"soon"}`)}
	if normalizeProdkitRequest(&bad) == nil {
		t.Fatal("audio_start must be a number")
	}
	beat := ServiceUsageRequest{Service: prodkitBeatDrop, VideoURL: "https://x.test/a.mp4", AudioURL: "https://x.test/a.mp3", Params: json.RawMessage(`{"audio_start":8}`)}
	if err := normalizeProdkitRequest(&beat); err != nil {
		t.Fatal(err)
	}
	if got := prodkitMotionParams(beat, 5)["audio_start"]; got != float64(8) {
		t.Fatalf("audio_start not forwarded: %v", got)
	}
}

func TestProdkitMotionEnvAndAvailability(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("PRODKIT_MOTION_DIR", dir)
	t.Setenv("PRODKIT_MOTION_HOME", "/srv/motion-home")
	t.Setenv("ORT_NUM_THREADS", "4")
	if prodkitMotionRoot() != dir {
		t.Fatalf("root = %s", prodkitMotionRoot())
	}
	if got := prodkitMotionPython(); got != filepath.Join(dir, ".venv", "bin", "python") {
		t.Fatalf("python = %s", got)
	}
	if prodkitMotionAvailable() {
		t.Fatal("must be unavailable without venv and job.py")
	}
	_ = os.MkdirAll(filepath.Join(dir, "motiontrack"), 0o755)
	_ = os.MkdirAll(filepath.Join(dir, ".venv", "bin"), 0o755)
	_ = os.WriteFile(filepath.Join(dir, "motiontrack", "job.py"), []byte("x"), 0o644)
	_ = os.WriteFile(filepath.Join(dir, ".venv", "bin", "python"), []byte("x"), 0o755)
	if !prodkitMotionAvailable() {
		t.Fatal("must be available")
	}
	t.Setenv("PRODKIT_MOTION_PYTHON", "/opt/py")
	if prodkitMotionPython() != "/opt/py" {
		t.Fatal("PRODKIT_MOTION_PYTHON override")
	}
	env := strings.Join(prodkitMotionEnv("/tmp/w"), "\n")
	for _, want := range []string{"HOME=/srv/motion-home", "TMPDIR=/tmp/w", "ORT_NUM_THREADS=4", "PATH="} {
		if !strings.Contains(env, want) {
			t.Fatalf("env missing %s in %s", want, env)
		}
	}
	if strings.Contains(env, "FAL_KEY") || strings.Contains(env, "DATABASE_URL") {
		t.Fatal("worker env must not leak secrets")
	}
}

func TestProdkitMotionWorkerExecutesPythonModule(t *testing.T) {
	dir := t.TempDir()
	py := filepath.Join(dir, "python")
	script := "#!/bin/sh\nargs=\"$4\"\nout=$(sed -n 's/.*\"out\": *\"\\([^\"]*\\)\".*/\\1/p' \"$args\")\nmkdir -p \"$out\"\necho '{\"ok\":false,\"error\":\"bad clip\"}' > \"$out/manifest.json\"\nexit 2\n"
	if err := os.WriteFile(py, []byte(script), 0o755); err != nil {
		t.Fatal(err)
	}
	t.Setenv("PRODKIT_MOTION_PYTHON", py)
	t.Setenv("PRODKIT_MOTION_DIR", dir)
	out := filepath.Join(dir, "out")
	args := filepath.Join(dir, "args.json")
	_ = os.WriteFile(args, []byte(`{"out": "`+out+`"}`), 0o644)
	code, err := prodkitMotionWorker(context.Background(), dir, args)
	if err != nil || code != 2 {
		t.Fatalf("code=%d err=%v", code, err)
	}
	blob, _ := os.ReadFile(filepath.Join(out, "manifest.json"))
	if !strings.Contains(string(blob), "bad clip") {
		t.Fatalf("manifest = %s", blob)
	}
	t.Setenv("PRODKIT_MOTION_PYTHON", filepath.Join(dir, "missing"))
	if code, err := prodkitMotionWorker(context.Background(), dir, args); err == nil || code != -1 {
		t.Fatalf("missing interpreter: code=%d err=%v", code, err)
	}
}

func TestProdkitMotionAspectAndStats(t *testing.T) {
	req := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", Params: json.RawMessage(`{"preset":"echo","aspect":"9:16"}`)}
	if err := normalizeProdkitRequest(&req); err != nil {
		t.Fatal(err)
	}
	if prodkitMotionParams(req, 4)["aspect"] != "9:16" {
		t.Fatal("aspect not forwarded")
	}
	bad := ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", Params: json.RawMessage(`{"aspect":"21:9"}`)}
	if normalizeProdkitRequest(&bad) == nil {
		t.Fatal("unsupported aspect must be rejected")
	}
	fake := &motionFake{manifest: `{"ok":true,"tool":"motion-fx","video":"result.mp4","poster":"poster.jpg","seconds":4,"width":720,"height":1280,"tracks_count":2,"events_count":1,"bpm":90,"stats":{"total_strikes":3,"fighters":{"1":{"strikes":2}}}}`}
	stubProdkitMotion(t, t.TempDir(), fake, 4)
	result, _, err := runMotionForTest(t, ServiceUsageRequest{Service: prodkitMotionFX, VideoURL: "https://x.test/a.mp4", Params: req.Params})
	if err != nil {
		t.Fatal(err)
	}
	stats, _ := result["stats"].(map[string]interface{})
	if stats["total_strikes"] != float64(3) {
		t.Fatalf("stats = %v", result["stats"])
	}
	if result["height"] != 1280 {
		t.Fatalf("height = %v", result["height"])
	}
}
