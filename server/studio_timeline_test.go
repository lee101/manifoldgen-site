package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
)

func schemaExample(t *testing.T) []byte {
	t.Helper()
	var schema struct {
		Example json.RawMessage `json:"example"`
	}
	if err := json.Unmarshal(studioSchemaJSON, &schema); err != nil {
		t.Fatal(err)
	}
	return schema.Example
}

func jsonTags(value interface{}) map[string]bool {
	out := map[string]bool{}
	kind := reflect.TypeOf(value)
	for i := 0; i < kind.NumField(); i++ {
		out[strings.Split(kind.Field(i).Tag.Get("json"), ",")[0]] = true
	}
	return out
}

func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for key := range set {
		out = append(out, key)
	}
	sort.Strings(out)
	return out
}

func TestStudioSchemaMatchesGoTypes(t *testing.T) {
	cases := []struct {
		name   string
		schema map[string]bool
		types  map[string]bool
	}{
		{"document", studioSchema.DocumentKeys, jsonTags(timelineDocument{})},
		{"asset", studioSchema.AssetKeys, jsonTags(timelineAsset{})},
		{"text", studioSchema.TextKeys, jsonTags(timelineText{})},
		{"lut", studioSchema.LUTKeys, jsonTags(timelineLUT{})},
	}
	for _, tc := range cases {
		if !reflect.DeepEqual(sortedKeys(tc.schema), sortedKeys(tc.types)) {
			t.Errorf("%s keys: schema %v, go %v", tc.name, sortedKeys(tc.schema), sortedKeys(tc.types))
		}
	}
	if len(studioSchema.NumericAdjust) != 35 || !studioSchema.AdjustmentKeys["fx"] || !studioSchema.AdjustmentKeys["lutID"] {
		t.Fatalf("adjustments = %v", sortedKeys(studioSchema.AdjustmentKeys))
	}
	if len(studioSchema.FxTypes) != 18 || len(studioSchema.Transitions) != 6 || len(studioSchema.BlendModes) != 6 || len(studioSchema.Fonts) != 15 {
		t.Fatalf("enums fx=%d transitions=%d blend=%d fonts=%d", len(studioSchema.FxTypes), len(studioSchema.Transitions), len(studioSchema.BlendModes), len(studioSchema.Fonts))
	}
	if _, err := parseTimelineDocument(schemaExample(t), timelineMaxDocBytes); err != nil {
		t.Fatalf("schema example rejected: %v", err)
	}
}

func timelineDoc(t *testing.T, raw string) *timelineDocument {
	t.Helper()
	doc, err := parseTimelineDocument([]byte(raw), timelineMaxDocBytes)
	if err != nil {
		t.Fatalf("parse %s: %v", raw, err)
	}
	return doc
}

func TestParseTimelineDocumentValidation(t *testing.T) {
	clip := `{"id":"a","kind":"video","cloudURL":"https://example.com/a.mp4"}`
	many := strings.TrimSuffix(strings.Repeat(`{"id":"x","kind":"image","text":{"content":"t"}},`, 201), ",")
	cases := []struct{ doc, want string }{
		{``, "required"},
		{`{"assets":[]}`, "at least one asset"},
		{`{"assets":[` + clip + `],"extra":1}`, `unknown field "extra"`},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","speed":2}]}`, `unknown field "speed"`},
		{`{"version":7,"assets":[` + clip + `]}`, "version 7"},
		{`{"assets":[{"id":"a","kind":"gif","cloudURL":"https://x/a"}]}`, "kind must be"},
		{`{"assets":[{"id":"a","kind":"video"}]}`, "cloudURL is required"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"file:///etc/passwd"}]}`, "public"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"http://169.254.169.254/x.mp4"}]}`, "public"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://localhost/x.mp4"}]}`, "public"},
		{`{"assets":[{"id":"a","kind":"audio","cloudURL":"https://x/a.mp3"}]}`, "at least one video"},
		{`{"assets":[` + clip + `,` + clip + `]}`, "duplicate id"},
		{`{"assets":[` + many + `]}`, "limit is 200"},
		{`{"canvas":{"width":4096,"height":2160},"assets":[` + clip + `]}`, "canvas must be"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","trimStart":2,"trimEnd":1}]}`, "trimEnd"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","visualTrack":1.5}]}`, "integer"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","visualTrack":12}]}`, "visualTrack"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","transition":{"type":"spin"}}]}`, "transition type"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","blendMode":"hue"}]}`, "blendMode"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","crop":{"left":0.6,"right":0.6}}]}`, "crop"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","adjustments":{"sharpen":1}}]}`, `adjustments field "sharpen"`},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","adjustments":{"contrast":"high"}}]}`, "must be a number"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","adjustments":{"lutID":"warm"}}]}`, "not in document.luts"},
		{`{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","adjustments":{"fx":[{"type":"ray-march"}]}}]}`, "fx type"},
		{`{"assets":[{"id":"t","kind":"video","text":{"content":"Hi"}}]}`, "kind image"},
		{`{"assets":[{"id":"t","kind":"image","text":{"content":"Hi","fontFamily":"Comic Sans"}}]}`, "fontFamily"},
		{`{"assets":[{"id":"t","kind":"image","text":{"content":"Hi","color":"red"}}]}`, "#rrggbb"},
		{`{"luts":{"x":{"name":"x"}},"assets":[` + clip + `]}`, "exactly one"},
		{`{"luts":{"x":{"size":2,"data":"AAAA"}},"assets":[` + clip + `]}`, "does not match"},
		{`{"assets":[` + clip + `]}{}`, "single JSON object"},
	}
	for _, tc := range cases {
		_, err := parseTimelineDocument([]byte(tc.doc), timelineMaxDocBytes)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%.80s: err = %v, want %q", tc.doc, err, tc.want)
		}
	}
	big := `{"assets":[` + clip + `],"selectedID":"` + strings.Repeat("x", timelineMaxDocBytes) + `"}`
	if _, err := parseTimelineDocument([]byte(big), timelineMaxDocBytes); err == nil || !strings.Contains(err.Error(), "512 KB") {
		t.Fatalf("oversized doc: %v", err)
	}
	doc := timelineDoc(t, `{"assets":[{"id":"t","kind":"image","text":{"content":" Hello "}}],"history":{"undo":[]}}`)
	if doc.Version != 6 || doc.History != nil || doc.Assets[0].Text.FontFamily != "DM Sans" || doc.Assets[0].Text.Content != "Hello" {
		t.Fatalf("defaults = %+v %+v", doc, doc.Assets[0].Text)
	}
}

func fakeTimelineMedia(asset *timelineAsset) (timelineMediaInfo, bool) {
	switch asset.Kind {
	case "video":
		return timelineMediaInfo{Duration: 6, Width: 1920, Height: 1080, ContentType: "video/mp4", Size: 1000}, true
	case "audio":
		return timelineMediaInfo{Duration: 30, ContentType: "audio/mpeg", Size: 500}, true
	case "image":
		if asset.Text == nil {
			return timelineMediaInfo{Width: 800, Height: 600, ContentType: "image/png", Size: 50}, true
		}
	}
	return timelineMediaInfo{}, false
}

func TestTimelineFinalizeLayout(t *testing.T) {
	doc := timelineDoc(t, string(schemaExample(t)))
	if err := doc.finalize(fakeTimelineMedia); err != nil {
		t.Fatal(err)
	}
	title, first, second, music := doc.Assets[0], doc.Assets[1], doc.Assets[2], doc.Assets[3]
	if *title.Width != 1920 || *title.Height != 1080 || *title.TrimEnd != 3 || *title.VisualTrack != 1 || title.ContentType != "image/png" {
		t.Fatalf("title = %+v", title)
	}
	if *first.TimelineStart != 0 || *first.TrimStart != 1 || *first.TrimEnd != 5 || *first.Duration != 6 {
		t.Fatalf("first = %+v", first)
	}
	if *second.TimelineStart != 4 || *second.TrimEnd != 4 || *second.Transition.Duration != 1 || second.Name != "aurora-close.mp4" {
		t.Fatalf("second = %+v", second)
	}
	if *music.TimelineStart != 0 || *music.TrimEnd != 8 || *music.Width != 1 {
		t.Fatalf("music = %+v", music)
	}
	if doc.Duration() != 8 || doc.Canvas.Width != 1280 || doc.SelectedID != "title" || *doc.AudioTrackVolume != 1 {
		t.Fatalf("doc duration=%v canvas=%+v selected=%s", doc.Duration(), doc.Canvas, doc.SelectedID)
	}
	for _, asset := range doc.Assets {
		if _, err := uuid.Parse(asset.MediaID); err != nil {
			t.Fatalf("%s mediaID %q", asset.ID, asset.MediaID)
		}
	}
	again := timelineDoc(t, string(schemaExample(t)))
	_ = again.finalize(fakeTimelineMedia)
	if again.Assets[1].MediaID != first.MediaID {
		t.Fatal("mediaID is not deterministic")
	}

	inferred := timelineDoc(t, `{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","trimEnd":99},{"id":"b","kind":"image","cloudURL":"https://x/b.png","trimEnd":7}]}`)
	if err := inferred.finalize(fakeTimelineMedia); err != nil {
		t.Fatal(err)
	}
	if *inferred.Assets[0].TrimEnd != 6 || *inferred.Assets[1].TimelineStart != 6 || *inferred.Assets[1].Duration != 7 || inferred.Canvas.Width != 1920 {
		t.Fatalf("inferred = %+v %+v %+v", inferred.Assets[0], inferred.Assets[1], inferred.Canvas)
	}
	long := timelineDoc(t, `{"assets":[{"id":"a","kind":"image","cloudURL":"https://x/b.png","timelineStart":598,"trimEnd":5}]}`)
	if err := long.finalize(fakeTimelineMedia); err == nil || !strings.Contains(err.Error(), "limit is 600") {
		t.Fatalf("long timeline: %v", err)
	}
	unknown := timelineDoc(t, `{"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4"}]}`)
	if err := unknown.finalize(func(*timelineAsset) (timelineMediaInfo, bool) { return timelineMediaInfo{}, false }); err == nil {
		t.Fatal("finalize accepted a clip without probed media")
	}
}

func TestTimelinePricing(t *testing.T) {
	cases := []struct {
		seconds       float64
		width, height int
		want          float64
	}{
		{3, 1280, 720, 0.05}, {12, 1920, 1080, 0.12}, {12.4, 1080, 1920, 0.13}, {12, 2560, 1440, 0.24},
		{12, 3840, 2160, 0.24}, {600, 1920, 1080, 6}, {3.005, 1920, 1080, 0.05}, {10.004, 1280, 720, 0.10},
	}
	for _, tc := range cases {
		if got := timelinePriceUSD(tc.seconds, tc.width, tc.height); math.Abs(got-tc.want) > 1e-9 {
			t.Errorf("%.3fs %dx%d = %.4f, want %.4f", tc.seconds, tc.width, tc.height, got, tc.want)
		}
	}
	params := func(extra string) json.RawMessage {
		return json.RawMessage(`{"document":{"canvas":{"width":3840,"height":2160},"assets":[{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","trimEnd":20},{"id":"b","kind":"video","cloudURL":"https://x/b.mp4","trimStart":2,"trimEnd":12}]}` + extra + `}`)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: prodkitTimeline, Params: params("")}); math.Abs(got-0.60) > 1e-9 {
		t.Errorf("4K estimate = %.4f", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: prodkitTimeline, Params: params(`,"resolution":"1080p"`)}); math.Abs(got-0.30) > 1e-9 {
		t.Errorf("1080p estimate = %.4f", got)
	}
	if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: prodkitTimeline}); got != timelineMinUSD {
		t.Errorf("empty estimate = %.4f", got)
	}
	if w, h := timelineOutputSize(1080, 1920, "720p"); w != 720 || h != 1280 {
		t.Errorf("portrait 720p = %dx%d", w, h)
	}
}

func TestTimelineSettings(t *testing.T) {
	settings, err := timelineSettings(map[string]interface{}{"format": "WEBM", "quality": "high", "fps": 24.0, "resolution": "720p"})
	if err != nil || settings.Format != "webm" || settings.FPS != 24 || settings.page()["format"] != "webm-vp9" {
		t.Fatalf("settings = %+v err=%v", settings, err)
	}
	for _, bad := range []map[string]interface{}{{"format": "gif"}, {"fps": 61.0}, {"fps": 29.97}, {"quality": "ultra"}, {"resolution": "8k"}, {"fps": "30"}} {
		if _, err := timelineSettings(bad); err == nil {
			t.Errorf("accepted %v", bad)
		}
	}
}

func TestTimelineRewriteMedia(t *testing.T) {
	doc := timelineDoc(t, `{"assets":[
		{"id":"a","kind":"video","cloudURL":"https://x/a.mp4","previewURL":"https://x/p.webm"},
		{"id":"b","kind":"video","cloudURL":"https://x/a.mp4"},
		{"id":"c","kind":"image","cloudURL":"https://x/c.png"},
		{"id":"t","kind":"image","text":{"content":"Title"}}]}`)
	files := map[string]string{"https://x/a.mp4": "/work/a.mp4", "https://x/c.png": "/work/c.png"}
	out, routes, err := doc.rewriteMedia("/job/tok/media/", files)
	if err != nil {
		t.Fatal(err)
	}
	if out.Assets[0].CloudURL != "/job/tok/media/0" || out.Assets[1].CloudURL != "/job/tok/media/0" || out.Assets[2].CloudURL != "/job/tok/media/1" || out.Assets[3].CloudURL != "" {
		t.Fatalf("rewritten = %s %s %s %s", out.Assets[0].CloudURL, out.Assets[1].CloudURL, out.Assets[2].CloudURL, out.Assets[3].CloudURL)
	}
	if out.Assets[0].PreviewURL != "" || doc.Assets[0].CloudURL != "https://x/a.mp4" {
		t.Fatal("rewrite leaked the preview URL or mutated the source document")
	}
	if !reflect.DeepEqual(routes, map[string]string{"0": "/work/a.mp4", "1": "/work/c.png"}) {
		t.Fatalf("routes = %v", routes)
	}
	delete(files, "https://x/c.png")
	if _, _, err := doc.rewriteMedia("/job/tok/media/", files); err == nil {
		t.Fatal("missing media accepted")
	}
}

func TestParseTimelineCube(t *testing.T) {
	identity := "TITLE \"id\"\nLUT_3D_SIZE 2\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n"
	lut := &timelineLUT{Name: "id", Cube: identity}
	if err := lut.resolveCube(lut.Cube); err != nil {
		t.Fatal(err)
	}
	raw, _ := base64.StdEncoding.DecodeString(lut.Data)
	if lut.Size != 2 || lut.Cube != "" || len(raw) != 48 || raw[6] != 0xff || raw[7] != 0xff || raw[2] != 0 {
		t.Fatalf("lut = %+v bytes=%v", lut, raw)
	}
	if err := lut.validate(); err != nil {
		t.Fatal(err)
	}
	var big strings.Builder
	big.WriteString("LUT_3D_SIZE 65\n")
	for b := 0; b < 65; b++ {
		for g := 0; g < 65; g++ {
			for r := 0; r < 65; r++ {
				fmt.Fprintf(&big, "%g %g %g\n", float64(r)/64, float64(g)/64, float64(b)/64)
			}
		}
	}
	resampled := &timelineLUT{}
	if err := resampled.resolveCube(big.String()); err != nil || resampled.Size != 33 {
		t.Fatalf("resample size=%d err=%v", resampled.Size, err)
	}
	raw, _ = base64.StdEncoding.DecodeString(resampled.Data)
	mid := ((16*33+16)*33 + 16) * 3 * 2
	if value := int(raw[mid]) | int(raw[mid+1])<<8; value < 32700 || value > 32840 {
		t.Fatalf("resampled midpoint = %d", value)
	}
	for _, bad := range []string{"LUT_1D_SIZE 2\n0 0 0\n1 1 1\n", "LUT_3D_SIZE 2\nDOMAIN_MAX 2 2 2\n", "LUT_3D_SIZE 2\n0 0 0\n", "LUT_3D_SIZE 99\n"} {
		if _, _, err := parseTimelineCube(bad); err == nil {
			t.Errorf("accepted cube %q", bad)
		}
	}
}

func TestNormalizeTimelineRequest(t *testing.T) {
	ok := ServiceUsageRequest{Service: prodkitTimeline, Params: json.RawMessage(`{"document":` + string(schemaExample(t)) + `,"format":"mp4","fps":30}`)}
	if err := normalizeProdkitRequest(&ok); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		params, want string
	}{
		{`{}`, "params.document or params.project_id"},
		{`{"document":{"assets":[]}}`, "at least one asset"},
		{`{"document":` + string(schemaExample(t)) + `,"fps":120}`, "fps"},
		{`{"document":` + string(schemaExample(t)) + `,"script":1}`, "unknown timeline-render param"},
		{`{"document":` + string(schemaExample(t)) + `,"project_id":"nope"}`, "project_id"},
	}
	for _, tc := range cases {
		req := ServiceUsageRequest{Service: prodkitTimeline, Params: json.RawMessage(tc.params)}
		if err := normalizeProdkitRequest(&req); err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%.60s: err=%v want %q", tc.params, err, tc.want)
		}
	}
	huge := ServiceUsageRequest{Service: prodkitTimeline, Params: json.RawMessage(`{"name":"` + strings.Repeat("x", timelineMaxProjectParams) + `"}`)}
	if err := normalizeProdkitRequest(&huge); err == nil || !strings.Contains(err.Error(), "params exceed") {
		t.Fatalf("huge params: %v", err)
	}
	if requestedServiceName("timeline-render") != prodkitTimeline {
		t.Fatal("timeline-render alias missing")
	}
}

func TestResolveTimelineProject(t *testing.T) {
	previous := loadTimelineProject
	defer func() { loadTimelineProject = previous }()
	projectID := uuid.NewString()
	loadTimelineProject = func(userID, id string) (json.RawMessage, string, error) {
		if userID != "u1" || id != projectID {
			return nil, "", fmt.Errorf("wrong project")
		}
		return json.RawMessage(`{"version":6,"assets":[{"id":"a","kind":"image","text":{"content":"Hi"}}],"history":{"undo":[1,2,3]}}`), "Saved edit", nil
	}
	req := ServiceUsageRequest{Service: prodkitTimeline, Params: json.RawMessage(`{"project_id":"` + projectID + `","fps":24}`)}
	if err := resolveTimelineProject(&req, &User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}
	params := prodkitParams(req)
	document, _ := params["document"].(map[string]interface{})
	if document == nil || document["history"] != nil || params["name"] != "Saved edit" || params["fps"] != 24.0 {
		t.Fatalf("params = %s", req.Params)
	}
	if err := normalizeProdkitRequest(&req); err != nil {
		t.Fatal(err)
	}
	both := ServiceUsageRequest{Service: prodkitTimeline, Params: json.RawMessage(`{"project_id":"` + projectID + `","document":{}}`)}
	if err := resolveTimelineProject(&both, &User{ID: "u1"}); err == nil {
		t.Fatal("document and project_id accepted together")
	}
}

func TestTimelineChromeArgs(t *testing.T) {
	t.Setenv("PRODKIT_CHROME_FLAGS", "--lang=en")
	args := strings.Join(timelineChromeArgs("/w/chrome", "http://127.0.0.1:1/studio/render?job=a", "swiftshader"), " ")
	for _, want := range []string{"--headless=new", "--user-data-dir=/w/chrome", "--proxy-server=http://127.0.0.1:9", "EXCLUDE 127.0.0.1", "--use-angle=swiftshader", "--lang=en"} {
		if !strings.Contains(args, want) {
			t.Errorf("args missing %q: %s", want, args)
		}
	}
	if os.Geteuid() != 0 && strings.Contains(args, "--no-sandbox") {
		t.Error("sandbox disabled for a non-root user")
	}
	if !strings.HasSuffix(args, "job=a") {
		t.Error("page URL must be the last argument")
	}
	if gpu := strings.Join(timelineChromeArgs("/w", "u", "gpu"), " "); !strings.Contains(gpu, "--use-angle=gl-egl") {
		t.Errorf("gpu args = %s", gpu)
	}
	if timelineRenderTimeout(600, 3840, 2160) != 110*time.Minute || timelineRenderTimeout(3, 1280, 720) != 2*time.Minute+36*time.Second {
		t.Error("render timeout bounds")
	}
}

func TestTimelineRenderHandler(t *testing.T) {
	dist := t.TempDir()
	_ = os.MkdirAll(filepath.Join(dist, "studio"), 0o755)
	_ = os.MkdirAll(filepath.Join(dist, "_next"), 0o755)
	_ = os.WriteFile(filepath.Join(dist, "studio", "render.html"), []byte("<html>render</html>"), 0o644)
	_ = os.WriteFile(filepath.Join(dist, "_next", "app.js"), []byte("js"), 0o644)
	t.Setenv("PRODKIT_RENDER_DIST", dist)
	t.Setenv("PRODKIT_RENDER_ORIGIN", "")
	media := filepath.Join(dist, "..", "clip.bin")
	_ = os.WriteFile(media, []byte("0123456789"), 0o644)
	result := filepath.Join(t.TempDir(), "out.mp4")
	var progress []float64
	finished := make(chan error, 4)
	handler, err := timelineRenderHandler("tok", []byte(`{"document":{}}`), map[string]string{"0": media}, result,
		func(value float64) { progress = append(progress, value) }, func(err error) { finished <- err })
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(handler)
	defer server.Close()
	get := func(path string, header ...string) (int, string) {
		req, _ := http.NewRequest(http.MethodGet, server.URL+path, nil)
		if len(header) == 2 {
			req.Header.Set(header[0], header[1])
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		body, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(body)
	}
	if code, body := get("/studio/render?job=tok"); code != 200 || body != "<html>render</html>" {
		t.Fatalf("page %d %q", code, body)
	}
	if code, body := get("/_next/app.js"); code != 200 || body != "js" {
		t.Fatalf("asset %d %q", code, body)
	}
	if code, body := get("/job/tok/document"); code != 200 || body != `{"document":{}}` {
		t.Fatalf("document %d %q", code, body)
	}
	if code, body := get("/job/tok/media/0", "Range", "bytes=2-4"); code != http.StatusPartialContent || body != "234" {
		t.Fatalf("media range %d %q", code, body)
	}
	for _, path := range []string{"/job/tok/media/1", "/job/other/document", "/job/tok/media/../../clip.bin", "/../clip.bin"} {
		if code, _ := get(path); code == 200 {
			t.Errorf("%s was served", path)
		}
	}
	post := func(path, method, body string) int {
		req, _ := http.NewRequest(method, server.URL+path, bytes.NewBufferString(body))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		return resp.StatusCode
	}
	post("/job/tok/status", http.MethodPost, `{"progress":0.5}`)
	if len(progress) != 1 || progress[0] != 0.5 {
		t.Fatalf("progress = %v", progress)
	}
	if code := post("/job/tok/result", http.MethodPut, "video-bytes"); code != http.StatusNoContent {
		t.Fatalf("result status %d", code)
	}
	if err := <-finished; err != nil {
		t.Fatal(err)
	}
	if blob, _ := os.ReadFile(result); string(blob) != "video-bytes" {
		t.Fatalf("result = %q", blob)
	}
	post("/job/tok/status", http.MethodPost, `{"error":"WebGL 2 is required for Studio"}`)
	if err := <-finished; err == nil || !strings.Contains(err.Error(), "WebGL") {
		t.Fatalf("status error = %v", err)
	}
}

func TestMCPTimelineTools(t *testing.T) {
	names := map[string]bool{}
	for _, def := range mcpProductionToolDefs() {
		names[def["name"].(string)] = true
	}
	for _, want := range []string{"render_timeline", "create_studio_project", "get_studio_schema"} {
		if !names[want] {
			t.Errorf("%s missing from tools/list", want)
		}
	}
	response, status, ok := executeMCPProductionTool(mcpTestContext(`{}`), "get_studio_schema", json.RawMessage(`{}`))
	if !ok || status != 200 || response["example"] == nil || response["document"] == nil {
		t.Fatalf("schema status=%d keys=%v", status, response)
	}
	tool, _ := mcpProductionToolByName("render_timeline")
	body, wait, err := mcpProductionRequestBody(tool, json.RawMessage(`{"document":{"assets":[]},"fps":24,"wait_seconds":60}`))
	if err != nil || wait != 60 || !strings.Contains(string(body), `"params":{`) || !strings.Contains(string(body), `"fps":24`) {
		t.Fatalf("body=%s wait=%d err=%v", body, wait, err)
	}
}
