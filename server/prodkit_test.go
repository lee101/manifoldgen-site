package main

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalizeProdkitRequestValidation(t *testing.T) {
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want string
	}{
		{"unknown param", ServiceUsageRequest{Service: prodkitDestruction, Params: json.RawMessage(`{"script":"import os"}`)}, "unknown destruction-studio param"},
		{"private url", ServiceUsageRequest{Service: prodkitVectorize, ImageURL: "http://127.0.0.1/a.png"}, "public"},
		{"localhost", ServiceUsageRequest{Service: prodkitVectorize, ImageURL: "https://localhost/a.png"}, "public"},
		{"model ext", ServiceUsageRequest{Service: prodkitToon, ModelURL: "https://example.com/a.exe"}, "model_url must end"},
		{"scene spec", ServiceUsageRequest{Service: prodkitScene, Params: json.RawMessage(`{"spec":{"objects":[]}}`)}, "1-64 objects"},
		{"eraser target", ServiceUsageRequest{Service: prodkitShotCleanup, VideoURL: "https://example.com/a.mp4"}, "prompt"},
		{"text subject", ServiceUsageRequest{Service: prodkitDestruction, Params: json.RawMessage(`{"subject":"text"}`)}, "params.text"},
		{"params array", ServiceUsageRequest{Service: prodkitToon, Params: json.RawMessage(`[1]`)}, "JSON object"},
	}
	for _, tc := range cases {
		err := normalizeProdkitRequest(&tc.req)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: err = %v, want %q", tc.name, err, tc.want)
		}
	}
	ok := ServiceUsageRequest{Service: prodkitDestruction, Params: json.RawMessage(`{"subject":"tower","pieces":80,"impact":"ball"}`)}
	if err := normalizeProdkitRequest(&ok); err != nil {
		t.Fatal(err)
	}
	cleanup := ServiceUsageRequest{Service: prodkitShotCleanup, VideoURL: "https://example.com/a.mp4", Prompt: "person"}
	if err := normalizeProdkitRequest(&cleanup); err != nil || cleanup.Duration != 30 {
		t.Fatalf("cleanup err=%v duration=%d", err, cleanup.Duration)
	}
}

func TestProdkitPricing(t *testing.T) {
	cases := []struct {
		req  ServiceUsageRequest
		want float64
	}{
		{ServiceUsageRequest{Service: prodkitDestruction}, 0.40},
		{ServiceUsageRequest{Service: prodkitDestruction, ImageURL: "https://x/a.png"}, 0.46},
		{ServiceUsageRequest{Service: prodkitDestruction, ImageURL: "https://x/a.png", ModelURL: "https://x/a.glb"}, 0.40},
		{ServiceUsageRequest{Service: prodkitToon, Params: json.RawMessage(`{"quality":"high"}`)}, 0.50},
		{ServiceUsageRequest{Service: prodkitScene, ImageURL: "https://x/a.png"}, 0.30},
		{ServiceUsageRequest{Service: prodkitImageTo3D, Params: json.RawMessage(`{"quality":"high"}`)}, 0.45},
		{ServiceUsageRequest{Service: prodkitVectorize}, 0.02},
		{ServiceUsageRequest{Service: prodkitVectorize, Params: json.RawMessage(`{"engine":"ai"}`)}, 0.03},
		{ServiceUsageRequest{Service: prodkitShotCleanup, Duration: 7}, 0.24 * 7},
		{ServiceUsageRequest{Service: prodkitShotCleanup, Duration: 99}, 0.24 * 30},
	}
	for _, tc := range cases {
		if got := getRequestServicePriceUSD(tc.req); got < tc.want-1e-9 || got > tc.want+1e-9 {
			t.Errorf("%s %s: price = %.4f, want %.4f", tc.req.Service, tc.req.Params, got, tc.want)
		}
	}
	for _, tool := range prodkitTools {
		if requestedServiceName(tool.Public) != tool.Service || publicServiceName(tool.Service) != tool.Public {
			t.Errorf("alias mismatch for %s", tool.Public)
		}
		if _, ok := servicePricesUSD[tool.Service]; !ok {
			t.Errorf("%s missing from servicePricesUSD", tool.Service)
		}
	}
	if prodkitEraserUSDSec < 0.14*1.5 {
		t.Fatalf("eraser margin too thin: %.2f vs provider 0.14", prodkitEraserUSDSec)
	}
}

func TestLayerProdkitSVG(t *testing.T) {
	svg := []byte(`<?xml version="1.0"?><svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="4" height="4"><path d="M0 0" fill="#FF0000" transform="translate(0,0)"/><path d="M1 1" fill="#00ff00"/><path d="M2 2" fill="#ff0000"/></svg>`)
	out, stats, err := layerProdkitSVG(svg, true)
	if err != nil {
		t.Fatal(err)
	}
	if stats["layers"] != 2 || stats["paths"] != 3 {
		t.Fatalf("stats = %#v", stats)
	}
	ordered, orderedStats, _ := layerProdkitSVG(svg, false)
	if orderedStats["layers"] != 3 || strings.Index(string(ordered), "M1 1") > strings.Index(string(ordered), "M2 2") {
		t.Fatalf("paint order not preserved: %s", ordered)
	}
	if !strings.Contains(string(out), `data-color="#ff0000"`) || strings.Count(string(out), "<g ") != 2 {
		t.Fatalf("layered svg = %s", out)
	}
	for _, bad := range []string{`<svg><script>alert(1)</script></svg>`, `<svg><path onload="x" d="M0 0"/></svg>`, `<svg><a href="javascript:x"/></svg>`} {
		if _, _, err := layerProdkitSVG([]byte(bad), true); err == nil {
			t.Errorf("accepted unsafe svg %s", bad)
		}
	}
}

func TestProdkitVtracerArgsClamp(t *testing.T) {
	args := strings.Join(prodkitVtracerArgs(map[string]interface{}{"colors": 99.0, "detail": -3.0, "mode": "poster", "smooth": "rm -rf"}, "in.png", "out.svg"), " ")
	for _, want := range []string{"--color_precision 8", "--filter_speckle 16", "--mode spline", "--gradient_step 32"} {
		if !strings.Contains(args, want) {
			t.Errorf("args %q missing %q", args, want)
		}
	}
	bw := strings.Join(prodkitVtracerArgs(map[string]interface{}{"mode": "lineart"}, "a", "b"), " ")
	if !strings.Contains(bw, "--colormode bw") {
		t.Errorf("bw args = %q", bw)
	}
}

func TestTraceProdkitImageWithVtracer(t *testing.T) {
	if prodkitVtracerBinary() == "" {
		t.Skip("vtracer not installed")
	}
	ffmpeg, err := exec.LookPath("/usr/bin/ffmpeg")
	if err != nil {
		t.Skip("ffmpeg not installed")
	}
	t.Setenv("FFMPEG_BIN", ffmpeg)
	dir := t.TempDir()
	src := filepath.Join(dir, "src.png")
	if out, err := exec.Command(ffmpeg, "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=160x120", "-frames:v", "1", src).CombinedOutput(); err != nil {
		t.Fatalf("ffmpeg: %v %s", err, out)
	}
	svg, err := traceProdkitImage(context.Background(), map[string]interface{}{"mode": "poster", "colors": 4.0}, src, dir)
	if err != nil {
		t.Fatal(err)
	}
	layered, stats, err := layerProdkitSVG(svg, true)
	if err != nil || stats["layers"].(int) < 3 {
		t.Fatalf("layers=%v err=%v", stats, err)
	}
	_ = os.WriteFile(filepath.Join(dir, "out.svg"), layered, 0o644)
}

func TestMCPProductionRequestBody(t *testing.T) {
	tool, ok := mcpProductionToolByName("blender_destruction")
	if !ok {
		t.Fatal("tool missing")
	}
	body, wait, err := mcpProductionRequestBody(tool, json.RawMessage(`{"image_url":"https://x/a.png","pieces":60,"impact":"ball","wait_seconds":30}`))
	if err != nil || wait != 30 {
		t.Fatalf("err=%v wait=%d", err, wait)
	}
	var req ServiceUsageRequest
	if err := json.Unmarshal(body, &req); err != nil {
		t.Fatal(err)
	}
	if requestedServiceName(req.Service) != prodkitDestruction || req.ImageURL != "https://x/a.png" || !strings.Contains(string(req.Params), `"pieces":60`) {
		t.Fatalf("request = %s", body)
	}
	body, _, _ = mcpProductionRequestBody(tool, json.RawMessage(`{"duration":3.5}`))
	if err := json.Unmarshal(body, &req); err != nil || req.Duration != 0 || !strings.Contains(string(req.Params), `"duration":3.5`) {
		t.Fatalf("request = %s", body)
	}
	if _, _, err := mcpProductionRequestBody(tool, json.RawMessage(`{"wallet_address":"x"}`)); err == nil {
		t.Fatal("unknown argument accepted")
	}
	for _, tool := range mcpProductionTools() {
		if !isProdkitService(requestedServiceName(tool.Service)) {
			t.Errorf("%s maps to unknown service %s", tool.Name, tool.Service)
		}
		internal := requestedServiceName(tool.Service)
		spec, _ := prodkitToolFor(internal)
		for key := range tool.Properties {
			if mcpTopLevelFields[key] {
				continue
			}
			found := false
			for _, param := range spec.Params {
				found = found || param == key
			}
			if !found {
				t.Errorf("%s exposes %q which %s rejects", tool.Name, key, internal)
			}
		}
	}
}

func TestMCPPrompts(t *testing.T) {
	ctx := mcpTestContext(`{"jsonrpc":"2.0","id":1,"method":"prompts/get","params":{"name":"destruction-studio","arguments":{"brief":"brick tower"}}}`)
	handleMCPWithExecutor(ctx, nil)
	if !strings.Contains(string(ctx.Response.Body()), "blender_destruction") || !strings.Contains(string(ctx.Response.Body()), "brick tower") {
		t.Fatalf("prompt = %s", ctx.Response.Body())
	}
	ctx = mcpTestContext(`{"jsonrpc":"2.0","id":2,"method":"prompts/list"}`)
	handleMCPWithExecutor(ctx, nil)
	if strings.Count(string(ctx.Response.Body()), `"name"`) < len(mcpPrompts) {
		t.Fatalf("prompts = %s", ctx.Response.Body())
	}
}
