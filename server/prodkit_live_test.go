//go:build prodkitlive

package main

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/joho/godotenv"
)

func TestProdkitLive(t *testing.T) {
	_ = godotenv.Load("../.env")
	initServices()
	initUploads()
	ctx := context.Background()
	job := &VideoJob{ID: "live-test", UserID: "prodkit-live"}
	stage := func(s string) { t.Log("stage:", s) }
	out := map[string]interface{}{}
	if image := os.Getenv("PRODKIT_LIVE_IMAGE"); image != "" {
		req := ServiceUsageRequest{Service: prodkitImageTo3D, ImageURL: image}
		result, cost, err := runProdkitImageTo3D(ctx, job, req, t.TempDir())
		if err != nil {
			t.Fatal(err)
		}
		out["image_to_3d"], out["image_to_3d_cost"] = result, cost
	}
	if video := os.Getenv("PRODKIT_LIVE_VIDEO"); video != "" {
		req := ServiceUsageRequest{Service: prodkitShotCleanup, VideoURL: video, Prompt: os.Getenv("PRODKIT_LIVE_PROMPT"), Duration: 30}
		if err := normalizeProdkitRequest(&req); err != nil {
			t.Fatal(err)
		}
		result, seconds, cost, err := runProdkitShotCleanup(ctx, job, req, t.TempDir(), stage)
		if err != nil {
			t.Fatal(err)
		}
		out["cleanup"], out["cleanup_seconds"], out["cleanup_cost"] = result, seconds, cost
	}
	if image := os.Getenv("PRODKIT_LIVE_VECTOR"); image != "" {
		req := ServiceUsageRequest{Service: prodkitVectorize, ImageURL: image, Params: json.RawMessage(os.Getenv("PRODKIT_LIVE_VECTOR_PARAMS"))}
		if len(req.Params) == 0 {
			req.Params = nil
		}
		result, _, err := runProdkitVectorize(ctx, job, req, t.TempDir())
		if err != nil {
			t.Fatal(err)
		}
		out["vectorize"] = result
	}
	if service := os.Getenv("PRODKIT_LIVE_BLENDER"); service != "" {
		req := ServiceUsageRequest{Service: service, ImageURL: os.Getenv("PRODKIT_LIVE_BLENDER_IMAGE"), Params: json.RawMessage(os.Getenv("PRODKIT_LIVE_BLENDER_PARAMS"))}
		if len(req.Params) == 0 {
			req.Params = nil
		}
		if err := normalizeProdkitRequest(&req); err != nil {
			t.Fatal(err)
		}
		tool, _ := prodkitToolFor(service)
		result, cost, err := runProdkitBlender(ctx, job, req, tool, t.TempDir(), stage)
		if err != nil {
			t.Fatal(err)
		}
		out["blender"], out["blender_cost"] = result, cost
	}
	if raw := os.Getenv("PRODKIT_LIVE_REQ"); raw != "" {
		var req ServiceUsageRequest
		if err := json.Unmarshal([]byte(raw), &req); err != nil {
			t.Fatal(err)
		}
		req.Service = requestedServiceName(req.Service)
		if err := normalizeProdkitRequest(&req); err != nil {
			t.Fatal(err)
		}
		var result map[string]interface{}
		var cost float64
		var err error
		switch req.Service {
		case prodkitFootageSorter:
			result, cost, err = runProdkitFootageSorter(ctx, job, req, t.TempDir(), stage)
		case prodkitShotComposer:
			result, _, cost, err = runProdkitShotComposer(ctx, job, req, t.TempDir(), stage)
		default:
			t.Fatalf("unsupported %s", req.Service)
		}
		if err != nil {
			t.Fatal(err)
		}
		out["req"], out["req_cost"] = result, cost
	}
	encoded, _ := json.MarshalIndent(out, "", "  ")
	t.Logf("%s", encoded)
}
