package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

var prodkitPTServices = []string{prodkitTrackBlur, prodkitStickyOverlay, prodkitFlowFX, prodkitReactiveFX, prodkitMaskPropagate}

func TestProdkitPTPricing(t *testing.T) {
	cases := []struct {
		service string
		seconds float64
		want    float64
	}{
		{prodkitTrackBlur, 1, 0.15},
		{prodkitTrackBlur, 10, 0.60},
		{prodkitTrackBlur, 99, 1.20},
		{prodkitStickyOverlay, 3, 0.18},
		{prodkitFlowFX, 1, 0.20},
		{prodkitFlowFX, 99, 1.20},
		{prodkitReactiveFX, 5, 0.40},
		{prodkitMaskPropagate, 1, 0.12},
		{prodkitMaskPropagate, 20, 1.00},
	}
	for _, tc := range cases {
		if got := prodkitMotionPriceUSD(tc.service, tc.seconds); math.Abs(got-tc.want) > 1e-9 {
			t.Errorf("%s %.1fs = %v, want %v", tc.service, tc.seconds, got, tc.want)
		}
	}
}

func TestProdkitPTRegistry(t *testing.T) {
	for _, internal := range prodkitPTServices {
		public := publicServiceName(internal)
		if public == internal || requestedServiceName(public) != internal || !isProdkitService(internal) || !prodkitMotionIsPT(internal) {
			t.Errorf("alias %s -> %s", internal, public)
		}
		if _, ok := servicePricesUSD[internal]; !ok {
			t.Errorf("%s missing from servicePricesUSD", internal)
		}
		tool, _ := prodkitToolFor(internal)
		if tool.Engine != "motion" || tool.Title == "" || len(tool.Params) == 0 {
			t.Errorf("tool entry %s = %+v", internal, tool)
		}
		for _, banned := range []string{"alltracker", "tapnext", "cotracker", "tapnet", "raft", "pika"} {
			if strings.Contains(strings.ToLower(tool.Unit+tool.Title), banned) {
				t.Errorf("%s names a model: %s", internal, banned)
			}
		}
	}
	if prodkitMotionIsPT(prodkitMotionFX) {
		t.Fatal("motion-fx classified as tracker-driven")
	}
}

func TestProdkitPTAvailability(t *testing.T) {
	old := prodkitPTAvailable
	t.Cleanup(func() { prodkitPTAvailable = old })
	prodkitPTAvailable = func() bool { return false }
	if prodkitMotionAvailableFor(prodkitTrackBlur) {
		t.Fatal("pt tool available without interpreter")
	}
	prodkitPTAvailable = func() bool { return true }
	if !prodkitMotionAvailableFor(prodkitFlowFX) {
		t.Fatal("pt tool unavailable with interpreter")
	}
	t.Setenv("PRODKIT_PTFX_PYTHON", "")
	prodkitPTAvailable = old
	if prodkitPTAvailable() {
		t.Fatal("available without PRODKIT_PTFX_PYTHON")
	}
}

func TestProdkitPTValidation(t *testing.T) {
	v := "https://x.test/a.mp4"
	img := "https://x.test/a.png"
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want string
	}{
		{"blur needs a region", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v}, "region"},
		{"blur region field", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"region":{"x":2,"y":0,"w":0.2,"h":0.2}}`)}, "params.region.x"},
		{"blur region unknown field", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"region":{"x":0.1,"y":0.1,"w":0.2,"h":0.2,"z":1}}`)}, "not a known field"},
		{"blur region type", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"region":[1]}`)}, "object"},
		{"blur style", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"point":{"x":0.5,"y":0.5,"radius":0.1},"style":"melt"}`)}, "style"},
		{"blur strength", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"point":{"x":0.5,"y":0.5,"radius":0.1},"strength":9}`)}, "strength"},
		{"blur colour", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"point":{"x":0.5,"y":0.5,"radius":0.1},"color":"red"}`)}, "hex"},
		{"blur mask mode needs shape or mask", ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"mode":"mask"}`)}, "region"},
		{"sticky needs text or image", ServiceUsageRequest{Service: prodkitStickyOverlay, VideoURL: v}, "text or image_url"},
		{"sticky text length", ServiceUsageRequest{Service: prodkitStickyOverlay, VideoURL: v, Params: json.RawMessage(`{"text":"` + strings.Repeat("a", 41) + `"}`)}, "40"},
		{"sticky width", ServiceUsageRequest{Service: prodkitStickyOverlay, VideoURL: v, Params: json.RawMessage(`{"text":"x","width":2}`)}, "width"},
		{"sticky type", ServiceUsageRequest{Service: prodkitStickyOverlay, VideoURL: v, Params: json.RawMessage(`{"text":5}`)}, "string"},
		{"flow effect", ServiceUsageRequest{Service: prodkitFlowFX, VideoURL: v, Params: json.RawMessage(`{"effects":["melt"]}`)}, "effects"},
		{"reactive effect", ServiceUsageRequest{Service: prodkitReactiveFX, VideoURL: v, Params: json.RawMessage(`{"effects":["trails","laser"]}`)}, "effects"},
		{"reactive palette", ServiceUsageRequest{Service: prodkitReactiveFX, VideoURL: v, Params: json.RawMessage(`{"palette":"rainbow"}`)}, "palette"},
		{"mask needs a seed", ServiceUsageRequest{Service: prodkitMaskPropagate, VideoURL: v}, "region"},
		{"mask segment", ServiceUsageRequest{Service: prodkitMaskPropagate, VideoURL: v, ImageURL: img, Params: json.RawMessage(`{"segment":3}`)}, "segment"},
		{"unknown param", ServiceUsageRequest{Service: prodkitFlowFX, VideoURL: v, Params: json.RawMessage(`{"bogus":1}`)}, "bogus"},
		{"video required", ServiceUsageRequest{Service: prodkitFlowFX}, "video_url"},
	}
	for _, tc := range cases {
		req := tc.req
		err := normalizeProdkitRequest(&req)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: err = %v, want %q", tc.name, err, tc.want)
		}
	}
	good := []ServiceUsageRequest{
		{Service: prodkitTrackBlur, VideoURL: v, Params: json.RawMessage(`{"region":{"x":0.1,"y":0.2,"w":0.3,"h":0.2},"style":"pixelate","invert":true,"color":"#00ff00"}`)},
		{Service: prodkitTrackBlur, VideoURL: v, ImageURL: img},
		{Service: prodkitStickyOverlay, VideoURL: v, Params: json.RawMessage(`{"text":"K.O.","x":0.6,"y":0.2,"width":0.2,"rotation":-10,"pop":false}`)},
		{Service: prodkitStickyOverlay, VideoURL: v, ImageURL: img},
		{Service: prodkitFlowFX, VideoURL: v, Params: json.RawMessage(`{"effects":["motion-blur","trails"],"strength":1.5}`)},
		{Service: prodkitReactiveFX, VideoURL: v, AudioURL: "https://x.test/a.mp3", Params: json.RawMessage(`{"effects":["glow","sparks"],"intensity":9,"audio_start":12}`)},
		{Service: prodkitMaskPropagate, VideoURL: v, Params: json.RawMessage(`{"point":{"x":0.4,"y":0.4,"radius":0.1},"shape":"ellipse"}`)},
	}
	for i, req := range good {
		if err := normalizeProdkitRequest(&req); err != nil {
			t.Errorf("good[%d]: %v", i, err)
		}
	}
	long := ServiceUsageRequest{Service: prodkitFlowFX, VideoURL: v, Duration: 99}
	if err := normalizeProdkitRequest(&long); err != nil || long.Duration != 15 {
		t.Fatalf("flow duration cap = %d err=%v", long.Duration, err)
	}
	loud := ServiceUsageRequest{Service: prodkitReactiveFX, VideoURL: v, Params: json.RawMessage(`{"intensity":9}`)}
	_ = normalizeProdkitRequest(&loud)
	if prodkitMotionPTParams(loud, 5)["intensity"] != 1.6 {
		t.Fatal("intensity not clamped")
	}
}

const ptManifest = `{"ok":true,"tool":"track-blur","video":"result.mp4","poster":"poster.jpg","mask":"mask.mp4","seconds":5,"width":1280,"height":704,"mode":"mask","style":"blur","tracked_visible":0.93,"effects":["jelly"],"area_first":0.1,"area_last":0.12,"secret":"x"}`

func TestProdkitPTRun(t *testing.T) {
	fake := &motionFake{manifest: ptManifest}
	stubs := stubProdkitMotion(t, t.TempDir(), fake, 12)
	stubs.sources["https://x.test/m.png"] = stubs.sources["https://x.test/a.mp4"]
	inner := prodkitMotionWorker
	prodkitMotionWorker = func(ctx context.Context, dir, argsPath string) (int, error) {
		code, err := inner(ctx, dir, argsPath)
		out := fake.args["out"].(string)
		_ = os.WriteFile(filepath.Join(out, "mask.mp4"), []byte("x"), 0o644)
		return code, err
	}
	req := ServiceUsageRequest{Service: prodkitTrackBlur, VideoURL: "https://x.test/a.mp4", ImageURL: "https://x.test/m.png", Duration: 6,
		Params: json.RawMessage(`{"mode":"mask","style":"blur","strength":1.5}`)}
	result, seconds, err := runMotionForTest(t, req)
	if err != nil {
		t.Fatal(err)
	}
	if seconds != 6 || prodkitMotionPriceUSD(req.Service, seconds) != 0.36 {
		t.Fatalf("seconds=%v", seconds)
	}
	if fake.args["tool"] != "track-blur" || fake.args["device"] != "cuda" || fake.args["image"] == nil || fake.args["music"] != nil {
		t.Fatalf("worker args = %#v", fake.args)
	}
	params := fake.args["params"].(map[string]interface{})
	if params["max_seconds"] != 6.0 || params["style"] != "blur" || params["strength"] != 1.5 || false {
		t.Fatalf("worker params = %#v", params)
	}
	for _, key := range []string{"video_url", "poster_url", "mask_url", "mode", "style", "tracked_visible", "effects", "area_first", "tool"} {
		if _, ok := result[key]; !ok {
			t.Errorf("missing result key %s: %v", key, result)
		}
	}
	if _, leaked := result["secret"]; leaked {
		t.Fatal("unknown manifest key leaked into the result")
	}
	if _, ok := result["tracks_count"]; !ok {
		t.Fatal("result lacks tracks_count")
	}
}

func TestProdkitPTRunNeedsNoPeopleAndRoutesAudio(t *testing.T) {
	fake := &motionFake{manifest: `{"ok":true,"video":"result.mp4","poster":"poster.jpg","seconds":4,"width":1280,"height":704,"effects":["glow"],"audio_bpm":120,"kicks":8,"snares":4}`}
	stubProdkitMotion(t, t.TempDir(), fake, 4)
	result, _, err := runMotionForTest(t, ServiceUsageRequest{Service: prodkitReactiveFX, VideoURL: "https://x.test/a.mp4", AudioURL: "https://x.test/a.mp3"})
	if err != nil {
		t.Fatal(err)
	}
	if fake.args["audio"] == nil || fake.args["image"] != nil || result["audio_bpm"] != 120.0 || result["kicks"] != 8.0 {
		t.Fatalf("args=%#v result=%v", fake.args, result)
	}
}

func TestProdkitPTUserAndSystemErrors(t *testing.T) {
	bad := &motionFake{manifest: `{"ok":false,"error":"reactive-fx needs audio"}`, code: 2}
	stubProdkitMotion(t, t.TempDir(), bad, 4)
	req := ServiceUsageRequest{Service: prodkitReactiveFX, VideoURL: "https://x.test/a.mp4"}
	_ = normalizeProdkitRequest(&req)
	_, _, _, err := runProdkitMotion(context.Background(), &VideoJob{ID: "j", UserID: "u"}, req, t.TempDir(), func(string) {})
	if _, ok := err.(prodkitUserError); !ok || !strings.Contains(err.Error(), "needs audio") {
		t.Fatalf("err = %v", err)
	}
	broken := &motionFake{manifest: `{"ok":false,"error":"dense tracker weights not found"}`, code: 1}
	stubProdkitMotion(t, t.TempDir(), broken, 4)
	_, _, _, err = runProdkitMotion(context.Background(), &VideoJob{ID: "j", UserID: "u"}, req, t.TempDir(), func(string) {})
	if err == nil {
		t.Fatal("system error accepted")
	}
	if _, ok := err.(prodkitUserError); ok {
		t.Fatal("system error exposed as user error")
	}
}

func TestProdkitPTWorkerUsesPTInterpreter(t *testing.T) {
	dir := t.TempDir()
	marker := filepath.Join(dir, "marker")
	script := filepath.Join(dir, "py.sh")
	_ = os.WriteFile(script, []byte("#!/bin/sh\necho pt > "+marker+"\nexit 0\n"), 0o755)
	t.Setenv("PRODKIT_PTFX_PYTHON", script)
	t.Setenv("PRODKIT_MOTION_PYTHON", "/nonexistent/python")
	args := filepath.Join(dir, "args.json")
	_ = os.WriteFile(args, []byte(`{"tool":"flow-fx"}`), 0o644)
	if code, err := prodkitMotionWorker(context.Background(), dir, args); err != nil || code != 0 {
		t.Fatalf("code=%d err=%v", code, err)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("tracker-driven tool did not use PRODKIT_PTFX_PYTHON")
	}
	_ = os.Remove(marker)
	_ = os.WriteFile(args, []byte(`{"tool":"motion-fx"}`), 0o644)
	if _, err := prodkitMotionWorker(context.Background(), dir, args); err == nil {
		if _, statErr := os.Stat(marker); statErr == nil {
			t.Fatal("pose tool used the tracker interpreter")
		}
	}
}

func TestMCPPTRequestBodies(t *testing.T) {
	cases := []struct {
		tool    string
		service string
		args    string
		top     []string
		par     []string
	}{
		{"blur_tracked_region", "track-blur", `{"video_url":"https://x.test/a.mp4","region":{"x":0.1,"y":0.1,"w":0.2,"h":0.2},"style":"pixelate","duration":6}`, []string{"video_url", "duration"}, []string{"region", "style"}},
		{"add_sticky_overlay", "sticky-overlay", `{"video_url":"https://x.test/a.mp4","image_url":"https://x.test/s.png","x":0.5,"y":0.2}`, []string{"video_url", "image_url"}, []string{"x", "y"}},
		{"apply_flow_fx", "flow-fx", `{"video_url":"https://x.test/a.mp4","effects":["jelly","trails"],"duration":8}`, []string{"video_url", "duration"}, []string{"effects"}},
		{"apply_reactive_fx", "reactive-fx", `{"video_url":"https://x.test/a.mp4","audio_url":"https://x.test/a.mp3","intensity":1.2}`, []string{"video_url", "audio_url"}, []string{"intensity"}},
		{"propagate_mask", "mask-propagate", `{"video_url":"https://x.test/a.mp4","image_url":"https://x.test/m.png","segment":24}`, []string{"video_url", "image_url"}, []string{"segment"}},
	}
	for _, tc := range cases {
		tool, ok := mcpProductionToolByName(tc.tool)
		if !ok {
			t.Fatalf("missing tool %s", tc.tool)
		}
		body, _, err := mcpProductionRequestBody(tool, json.RawMessage(tc.args))
		if err != nil {
			t.Fatalf("%s: %v", tc.tool, err)
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
		var service string
		_ = json.Unmarshal(request["service"], &service)
		if service != tc.service || !isProdkitService(requestedServiceName(service)) {
			t.Errorf("%s: service %q", tc.tool, service)
		}
		if strings.Contains(strings.ToLower(tool.Description+tool.Title), "tapnext") || strings.Contains(strings.ToLower(tool.Description), "alltracker") {
			t.Errorf("%s names a model", tc.tool)
		}
	}
	tool, _ := mcpProductionToolByName("apply_flow_fx")
	if _, _, err := mcpProductionRequestBody(tool, json.RawMessage(`{"video_url":"https://x.test/a.mp4","audio_url":"https://x.test/a.mp3"}`)); err == nil {
		t.Fatal("flow fx accepted an undeclared argument")
	}
}

func TestProdkitPTSocketRun(t *testing.T) {
	dir, err := os.MkdirTemp("", "pt")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(dir)
	sock := filepath.Join(dir, "w.sock")
	ln, err := net.Listen("unix", sock)
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close()
	got := make(chan string, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		line, _ := bufio.NewReader(conn).ReadString('\n')
		got <- strings.TrimSpace(line)
		fmt.Fprintf(conn, "{\"code\":2}\n")
	}()
	t.Setenv("PRODKIT_PTFX_SOCKET", sock)
	code, ok := prodkitPTSocketRun(context.Background(), "/tmp/job/args.json")
	if !ok || code != 2 {
		t.Fatalf("code=%d ok=%v", code, ok)
	}
	if line := <-got; line != "/tmp/job/args.json" {
		t.Fatalf("worker received %q", line)
	}
	t.Setenv("PRODKIT_PTFX_SOCKET", filepath.Join(dir, "missing.sock"))
	if _, ok := prodkitPTSocketRun(context.Background(), "/x"); ok {
		t.Fatal("a dead socket must fall back to a process")
	}
	t.Setenv("PRODKIT_PTFX_SOCKET", "")
	if _, ok := prodkitPTSocketRun(context.Background(), "/x"); ok {
		t.Fatal("no socket configured must not be used")
	}
}
