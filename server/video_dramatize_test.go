package main

import (
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestNormalizeDramatizeRequest(t *testing.T) {
	t.Run("accepts a full request", func(t *testing.T) {
		req := dramatizeRequest{Prompt: "  dramatize this  ", VideoURL: "https://cdn.example/clip.mp4"}
		if err := normalizeDramatizeRequest(&req); err != nil {
			t.Fatalf("normalize: %v", err)
		}
		if req.Prompt != "dramatize this" {
			t.Errorf("prompt not trimmed: %q", req.Prompt)
		}
		if req.MaxShots != 6 || req.Seconds != dramatizeDefaultShotSeconds {
			t.Errorf("defaults not applied: %+v", req)
		}
	})

	t.Run("rejects bad input", func(t *testing.T) {
		cases := map[string]dramatizeRequest{
			"no prompt":    {VideoURL: "https://cdn.example/c.mp4"},
			"no video":     {Prompt: "x"},
			"insecure url": {Prompt: "x", VideoURL: "http://cdn.example/c.mp4"},
			"overlong":     {Prompt: strings.Repeat("a", 6001), VideoURL: "https://cdn.example/c.mp4"},
		}
		for name, req := range cases {
			input := req
			if err := normalizeDramatizeRequest(&input); err == nil {
				t.Errorf("%s: expected an error", name)
			}
		}
	})

	t.Run("clamps shot bounds", func(t *testing.T) {
		req := dramatizeRequest{Prompt: "x", VideoURL: "https://cdn.example/c.mp4", MaxShots: 999, Seconds: 999}
		if err := normalizeDramatizeRequest(&req); err != nil {
			t.Fatalf("normalize: %v", err)
		}
		if req.MaxShots != dramatizeMaxShots {
			t.Errorf("max shots = %d, want %d", req.MaxShots, dramatizeMaxShots)
		}
		if req.Seconds != dramatizeMaxShotLength {
			t.Errorf("seconds = %v, want %v", req.Seconds, dramatizeMaxShotLength)
		}
	})

	t.Run("local paths need DEV", func(t *testing.T) {
		req := dramatizeRequest{Prompt: "x", VideoURL: "/vfast/data/code/vids/robotrun.mp4"}
		t.Setenv("DEV", "")
		if err := normalizeDramatizeRequest(&req); err == nil {
			t.Error("expected a local path to be rejected outside DEV")
		}
		t.Setenv("DEV", "1")
		req = dramatizeRequest{Prompt: "x", VideoURL: "/vfast/data/code/vids/robotrun.mp4"}
		if err := normalizeDramatizeRequest(&req); err != nil {
			t.Errorf("expected a local path to be accepted in DEV, got %v", err)
		}
	})
}

func TestUserHasPaidAccess(t *testing.T) {
	cases := []struct {
		name string
		user *User
		want bool
	}{
		{"nil", nil, false},
		{"fresh free account", &User{Credits: 500}, false},
		{"active subscriber", &User{UnlimitedAPI: true}, true},
		{"past top-up", &User{TotalDeposited: 20}, true},
		{"lapsed subscriber who paid before", &User{UnlimitedAPI: false, TotalDeposited: 5}, true},
	}
	for _, tc := range cases {
		if got := userHasPaidAccess(tc.user); got != tc.want {
			t.Errorf("%s: userHasPaidAccess = %v, want %v", tc.name, got, tc.want)
		}
	}
}

func TestDramatizePlanPricingTracksTheShotMix(t *testing.T) {
	// Source cuts are free; generated and restyled shots each cost an image
	// plus their animation.
	sourceOnly := &DramatizePlan{Shots: []DramatizeShot{
		{Kind: dramatizeShotKindSource, Seconds: 3},
		{Kind: dramatizeShotKindSource, Seconds: 4},
	}}
	if got := dramatizePlanUSD(sourceOnly); got != 0 {
		t.Errorf("a source-only plan should be free, got $%.2f", got)
	}

	one := &DramatizePlan{Shots: []DramatizeShot{{Kind: dramatizeShotKindGenerated, Seconds: 5}}}
	two := &DramatizePlan{Shots: []DramatizeShot{
		{Kind: dramatizeShotKindGenerated, Seconds: 5},
		{Kind: dramatizeShotKindGenerated, Seconds: 5},
	}}
	if math.Abs(dramatizePlanUSD(two)-2*dramatizePlanUSD(one)) > 1e-9 {
		t.Errorf("pricing is not linear in shot count: %v vs %v", dramatizePlanUSD(one), dramatizePlanUSD(two))
	}

	// Longer shots cost more.
	long := &DramatizePlan{Shots: []DramatizeShot{{Kind: dramatizeShotKindGenerated, Seconds: 10}}}
	if dramatizePlanUSD(long) <= dramatizePlanUSD(one) {
		t.Error("a 10s shot should cost more than a 5s shot")
	}

	// A restyle costs more than a plain generation (edit > generate).
	restyled := &DramatizePlan{Shots: []DramatizeShot{{Kind: dramatizeShotKindRestyled, Seconds: 5}}}
	if dramatizePlanUSD(restyled) <= dramatizePlanUSD(one) {
		t.Error("a restyled shot should cost more than a generated one")
	}

	// A nil plan must still price something chargeable rather than zero.
	if dramatizePlanUSD(nil) <= 0 {
		t.Error("nil plan should fall back to a positive estimate")
	}
}

func TestDramatizeRenderedUSDIgnoresFailedShots(t *testing.T) {
	ok := dramatizeShotResult{Shot: DramatizeShot{Kind: dramatizeShotKindGenerated, Seconds: 5}, ClipURL: "https://cdn/clip.mp4"}
	failed := dramatizeShotResult{Shot: DramatizeShot{Kind: dramatizeShotKindGenerated, Seconds: 5}, Error: "animate still: OpenPaths returned 502"}
	source := dramatizeShotResult{Shot: DramatizeShot{Kind: dramatizeShotKindSource, Seconds: 1.5}}
	if got := dramatizeRenderedUSD([]dramatizeShotResult{ok, failed, source}); math.Abs(got-dramatizePlanUSD(&DramatizePlan{Shots: []DramatizeShot{ok.Shot}})) > 1e-9 {
		t.Errorf("rendered USD = %v, want the successful generated shot only", got)
	}
	if got := dramatizeRenderedUSD([]dramatizeShotResult{failed, source}); got != 0 {
		t.Errorf("source-only fallback should be free, got $%.2f", got)
	}
}

func TestPublicVideoJobKeepsDramatizeAgentSteps(t *testing.T) {
	job := &VideoJob{Service: dramatizeServiceName, Status: "processing", Result: json.RawMessage(`{"_agent_step":2,"_agent_label":"Planning the shot list","_agent_steps":[{"name":"analyze","status":"done"}],"_dramatize_request":{"video_url":"/secret.mp4"}}`)}
	public := publicVideoJob(job)
	var result map[string]interface{}
	if err := json.Unmarshal(public.Result, &result); err != nil {
		t.Fatal(err)
	}
	if result["_agent_step"] != float64(2) {
		t.Errorf("_agent_step = %#v", result["_agent_step"])
	}
	if _, ok := result["_agent_steps"]; !ok {
		t.Error("progress UI needs _agent_steps")
	}
	if _, ok := result["_dramatize_request"]; ok {
		t.Error("internal request leaked")
	}
}

func TestDramatizeEstimateCoversATypicalPlan(t *testing.T) {
	// The up-front estimate gates the balance check, so it must not undershoot
	// the plan the agent typically ends up running.
	estimate := dramatizeEstimateUSD(6)
	typical := &DramatizePlan{Shots: []DramatizeShot{
		{Kind: dramatizeShotKindGenerated, Seconds: 5},
		{Kind: dramatizeShotKindSource, Seconds: 1.5},
		{Kind: dramatizeShotKindRestyled, Seconds: 5},
		{Kind: dramatizeShotKindSource, Seconds: 1.5},
		{Kind: dramatizeShotKindGenerated, Seconds: 5},
		{Kind: dramatizeShotKindSource, Seconds: 1.5},
	}}
	actual := dramatizePlanUSD(typical)
	if estimate < actual*0.9 {
		t.Errorf("estimate $%.2f badly undershoots a typical plan at $%.2f", estimate, actual)
	}
	if estimate <= 0 {
		t.Error("estimate must be positive")
	}
}

func TestUsdToCredits(t *testing.T) {
	t.Setenv("CREDIT_PRICE_USD", "0.01")
	if got := usdToCredits(3.00); got != 300 {
		t.Errorf("usdToCredits(3.00) = %v, want 300", got)
	}
	// Always rounds up so a run is never under-charged.
	if got := usdToCredits(0.001); got != 1 {
		t.Errorf("usdToCredits(0.001) = %v, want 1", got)
	}
}

func TestExtractImageURLHandlesProviderShapes(t *testing.T) {
	cases := map[string]string{
		`{"saved_image_url":"https://cdn/x.webp"}`:    "https://cdn/x.webp",
		`{"image_url":"https://cdn/y.png"}`:           "https://cdn/y.png",
		`{"url":"https://cdn/z.png"}`:                 "https://cdn/z.png",
		`{"data":[{"url":"https://cdn/openai.png"}]}`: "https://cdn/openai.png",
		`{"saved_image_url":"  "," image_url":"x"}`:   "",
	}
	for input, want := range cases {
		got, err := extractImageURL([]byte(input))
		if want == "" {
			if err == nil {
				t.Errorf("extractImageURL(%s) = %q, expected an error", input, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("extractImageURL(%s): %v", input, err)
			continue
		}
		if got != want {
			t.Errorf("extractImageURL(%s) = %q, want %q", input, got, want)
		}
	}

	if _, err := extractImageURL([]byte(`not json`)); err == nil {
		t.Error("expected an error for malformed JSON")
	}
	if _, err := extractImageURL([]byte(`{"data":[]}`)); err == nil {
		t.Error("expected an error for an empty data array")
	}
}

func TestDramatizeStylePromptAddsFraming(t *testing.T) {
	got := dramatizeStylePrompt("a robot on a track")
	if !strings.HasPrefix(got, "a robot on a track") {
		t.Errorf("style prompt dropped the scene: %q", got)
	}
	if !strings.Contains(got, "9:16") {
		t.Errorf("style prompt lost the vertical constraint: %q", got)
	}
}

func TestNearestFrame(t *testing.T) {
	frames := []dramatizeFrame{{Time: 1}, {Time: 5}, {Time: 9}}
	if got := nearestFrame(frames, 4.6); got.Time != 5 {
		t.Errorf("nearestFrame(4.6) = %v, want 5", got.Time)
	}
	if got := nearestFrame(frames, 100); got.Time != 9 {
		t.Errorf("nearestFrame(100) = %v, want 9", got.Time)
	}
	if nearestFrame(nil, 1) != nil {
		t.Error("nearestFrame(nil) should be nil")
	}
}

// ---------------------------------------------------------------------------
// Assembly + studio document, end to end with real ffmpeg
// ---------------------------------------------------------------------------

// Builds a plan of real source cuts plus "generated" clips (synthesised from
// the source and served over HTTP the way a provider would), assembles them,
// and checks both the rendered edit and the Studio project that comes with it.
func TestAssembleDramatizedEditBuildsTheTimeline(t *testing.T) {
	requireFixtureVideo(t)
	ctx := context.Background()
	dir := t.TempDir()

	// Stand in for provider output: a muted 3s clip at a different aspect
	// ratio, so the portrait normalisation is genuinely exercised.
	generated := filepath.Join(dir, "generated.mp4")
	if err := runFFmpeg(ctx, "-y", "-v", "error", "-i", dramatizeFixtureVideo,
		"-t", "3", "-an", "-vf", "scale=640:360", "-c:v", "libx264", "-preset", "ultrafast", generated); err != nil {
		t.Fatalf("build generated fixture: %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, generated)
	}))
	defer server.Close()

	shots := []dramatizeShotResult{
		{Shot: DramatizeShot{ID: "s1", Kind: dramatizeShotKindGenerated, Seconds: 3, ImagePrompt: "anime team"},
			ClipURL: server.URL + "/clip.mp4"},
		{Shot: DramatizeShot{ID: "s2", Kind: dramatizeShotKindSource, SourceStart: 1.0, SourceEnd: 2.5, Seconds: 1.5}},
		{Shot: DramatizeShot{ID: "s3", Kind: dramatizeShotKindGenerated, Seconds: 3, ImagePrompt: "olympic track"},
			ClipURL: server.URL + "/clip.mp4"},
		// A failed shot must be skipped rather than aborting the whole edit.
		{Shot: DramatizeShot{ID: "s4", Kind: dramatizeShotKindGenerated, Seconds: 3}, Error: "provider timeout"},
	}

	final := filepath.Join(dir, "final.mp4")
	timeline, err := assembleDramatizedEdit(ctx, dramatizeFixtureVideo, shots, dir, final)
	if err != nil {
		t.Fatalf("assembleDramatizedEdit: %v", err)
	}

	if len(timeline) != 3 {
		t.Fatalf("timeline has %d clips, want 3 (the failed shot should be skipped)", len(timeline))
	}
	// Starts must be contiguous and non-overlapping, or Studio restacks lanes.
	var cursor float64
	for i, clip := range timeline {
		if math.Abs(clip.Start-cursor) > 1e-6 {
			t.Errorf("clip %d starts at %.3f, want %.3f", i, clip.Start, cursor)
		}
		if clip.Duration <= 0 {
			t.Errorf("clip %d has duration %.3f", i, clip.Duration)
		}
		cursor += clip.Duration
	}

	probe, err := probeVideoFile(ctx, final)
	if err != nil {
		t.Fatalf("probe final: %v", err)
	}
	if probe.Width != dramatizeCanvasWidth || probe.Height != dramatizeCanvasHeight {
		t.Errorf("final = %dx%d, want portrait canvas", probe.Width, probe.Height)
	}
	if !probe.HasAudio {
		t.Error("final edit has no audio track")
	}
	if math.Abs(probe.Duration-cursor) > 0.4 {
		t.Errorf("final duration %.2f does not match the timeline total %.2f", probe.Duration, cursor)
	}
	t.Logf("assembled %.2fs from %d clips", probe.Duration, len(timeline))
}

func TestAssembleFailsWhenNothingIsRenderable(t *testing.T) {
	requireFixtureVideo(t)
	dir := t.TempDir()
	shots := []dramatizeShotResult{
		{Shot: DramatizeShot{ID: "s1", Kind: dramatizeShotKindGenerated}, Error: "failed"},
	}
	if _, err := assembleDramatizedEdit(context.Background(), dramatizeFixtureVideo, shots, dir, filepath.Join(dir, "f.mp4")); err == nil {
		t.Error("expected an error when every shot failed")
	}
}

func TestBuildStudioDocumentMatchesTheEditorSchema(t *testing.T) {
	timeline := []dramatizeShotResult{
		{Shot: DramatizeShot{ID: "s1", Kind: dramatizeShotKindGenerated},
			AssetID: "11111111-1111-4111-8111-111111111111", AssetURL: "https://cdn/a.mp4",
			ObjectKey: "gallery/studio/u/p/a/shot_01.mp4", Start: 0, Duration: 3, Size: 1234},
		{Shot: DramatizeShot{ID: "s2", Kind: dramatizeShotKindSource},
			AssetID: "22222222-2222-4222-8222-222222222222", AssetURL: "https://cdn/b.mp4",
			ObjectKey: "gallery/studio/u/p/b/shot_02.mp4", Start: 3, Duration: 1.5, Size: 567},
		// No asset URL: the editor would silently drop it, so we must too.
		{Shot: DramatizeShot{ID: "s3", Kind: dramatizeShotKindGenerated}, Start: 4.5, Duration: 3},
	}

	blob, err := buildStudioDocument(timeline)
	if err != nil {
		t.Fatalf("buildStudioDocument: %v", err)
	}
	if len(blob) > maxStudioProjectDocumentBytes {
		t.Errorf("document is %d bytes, over the %d limit", len(blob), maxStudioProjectDocumentBytes)
	}

	var doc struct {
		Version    int    `json:"version"`
		SelectedID string `json:"selectedID"`
		Assets     []struct {
			ID            string             `json:"id"`
			MediaID       string             `json:"mediaID"`
			Name          string             `json:"name"`
			Kind          string             `json:"kind"`
			Duration      float64            `json:"duration"`
			Width         int                `json:"width"`
			Height        int                `json:"height"`
			TrimStart     float64            `json:"trimStart"`
			TrimEnd       float64            `json:"trimEnd"`
			TimelineStart float64            `json:"timelineStart"`
			VisualTrack   int                `json:"visualTrack"`
			Volume        float64            `json:"volume"`
			StageScale    float64            `json:"stageScale"`
			CloudURL      string             `json:"cloudURL"`
			ObjectKey     string             `json:"objectKey"`
			ContentType   string             `json:"contentType"`
			Size          int64              `json:"size"`
			Adjustments   map[string]float64 `json:"adjustments"`
		} `json:"assets"`
	}
	if err := json.Unmarshal(blob, &doc); err != nil {
		t.Fatalf("unmarshal document: %v", err)
	}

	if doc.Version != 5 {
		t.Errorf("version = %d, want 5 (STUDIO_PROJECT_VERSION)", doc.Version)
	}
	if len(doc.Assets) != 2 {
		t.Fatalf("got %d assets, want 2 (the URL-less shot must be dropped)", len(doc.Assets))
	}
	if doc.SelectedID != doc.Assets[0].ID {
		t.Errorf("selectedID = %q, want the first asset %q", doc.SelectedID, doc.Assets[0].ID)
	}

	for i, a := range doc.Assets {
		if a.ID == "" || a.MediaID != a.ID {
			t.Errorf("asset %d: id/mediaID mismatch (%q/%q)", i, a.ID, a.MediaID)
		}
		if a.Kind != "video" || a.ContentType != "video/mp4" {
			t.Errorf("asset %d: kind=%q contentType=%q", i, a.Kind, a.ContentType)
		}
		if a.Width != dramatizeCanvasWidth || a.Height != dramatizeCanvasHeight {
			t.Errorf("asset %d: %dx%d, want portrait canvas", i, a.Width, a.Height)
		}
		// Clip length in Studio is trimEnd-trimStart; it must equal duration.
		if math.Abs((a.TrimEnd-a.TrimStart)-a.Duration) > 1e-9 {
			t.Errorf("asset %d: trim span %.3f != duration %.3f", i, a.TrimEnd-a.TrimStart, a.Duration)
		}
		if a.VisualTrack != 0 {
			t.Errorf("asset %d: visualTrack = %d, want 0", i, a.VisualTrack)
		}
		if a.Volume != 1 || a.StageScale != 1 {
			t.Errorf("asset %d: volume=%v stageScale=%v, want 1/1", i, a.Volume, a.StageScale)
		}
		if a.CloudURL == "" || a.ObjectKey == "" {
			t.Errorf("asset %d: missing cloudURL/objectKey", i)
		}
		if a.Size <= 0 {
			t.Errorf("asset %d: size = %d", i, a.Size)
		}
		// A missing adjustment key renders as an uncontrolled slider.
		for _, key := range []string{"exposure", "brightness", "contrast", "saturation", "vignette", "grain"} {
			if _, ok := a.Adjustments[key]; !ok {
				t.Errorf("asset %d: adjustments missing %q", i, key)
			}
		}
	}

	// Clips must not overlap, otherwise Studio pushes them onto extra lanes.
	if doc.Assets[1].TimelineStart < doc.Assets[0].TimelineStart+doc.Assets[0].Duration-1e-9 {
		t.Errorf("clips overlap: %+v", doc.Assets)
	}
	if !strings.Contains(doc.Assets[1].Name, "original cut") {
		t.Errorf("source clip name = %q, want it to mention the original", doc.Assets[1].Name)
	}
}

func TestBuildStudioDocumentRejectsAnEmptyTimeline(t *testing.T) {
	if _, err := buildStudioDocument(nil); err == nil {
		t.Error("expected an error for an empty timeline")
	}
	if _, err := buildStudioDocument([]dramatizeShotResult{{Shot: DramatizeShot{ID: "x"}}}); err == nil {
		t.Error("expected an error when no shot has an uploaded asset")
	}
}

func TestJobStateTracksAgentProgress(t *testing.T) {
	// publish() writes to the DB, which is unavailable in unit tests; exercise
	// the step bookkeeping directly instead.
	state := &dramatizeJobState{}
	state.Steps = append(state.Steps, dramatizeStep{Name: "analyze", Label: "Analysing", Status: "running"})
	state.Step = 1
	state.Steps[0].Status = "done"
	state.Steps[0].Detail = "11.5s"

	blob := state.marshal()
	var round map[string]interface{}
	if err := json.Unmarshal(blob, &round); err != nil {
		t.Fatalf("marshal/unmarshal: %v", err)
	}
	// The frontend reads these exact keys off the job poll.
	for _, key := range []string{"_agent_step", "_agent_steps"} {
		if _, ok := round[key]; !ok {
			t.Errorf("job state is missing %q; the progress UI reads it", key)
		}
	}
}

func TestFetchDramatizeSourceReadsLocalFiles(t *testing.T) {
	requireFixtureVideo(t)
	dest := filepath.Join(t.TempDir(), "copy.mp4")
	if err := fetchDramatizeSource(context.Background(), dramatizeFixtureVideo, dest); err != nil {
		t.Fatalf("fetchDramatizeSource: %v", err)
	}
	info, err := os.Stat(dest)
	if err != nil || info.Size() == 0 {
		t.Fatalf("copy missing or empty: %v", err)
	}
	if err := fetchDramatizeSource(context.Background(), "/nonexistent/x.mp4", dest); err == nil {
		t.Error("expected an error for a missing local file")
	}
}
