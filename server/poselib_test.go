package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/valyala/fasthttp"
)

func writePoseManifest(t *testing.T, poses []PoseRecord) {
	t.Helper()
	dir := t.TempDir()
	raw, _ := json.Marshal(poses)
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("POSELIB_DIR", dir)
	poseLib = &PoseLibrary{}
	if err := poseLib.load(); err != nil {
		t.Fatal(err)
	}
}

func TestPoseLibrarySearchFiltersAndNSFW(t *testing.T) {
	writePoseManifest(t, []PoseRecord{
		{ID: "a", Source: "shisei", Name: "Sitting leaning back", Category: "Sitting", People: 1, Framing: "full", SearchText: "sitting leaning back floor", Views: map[string]string{"front": "shisei/a.webp"}},
		{ID: "b", Source: "generated", Name: "Running", Category: "Running", People: 1, Framing: "full", Bodies: []string{"genwoman"}, SearchText: "running genwoman", Views: map[string]string{"front": "gen/b.webp"}},
		{ID: "c", Source: "shisei", Name: "Hidden", Category: "Sitting", People: 1, Framing: "full", NSFW: true, SearchText: "sitting hidden"},
		{ID: "d", Source: "generated", Name: "Duo", Category: "Duo", People: 2, Framing: "full", Bodies: []string{"genman", "genwoman"}, SearchText: "2 people dancing"},
	})
	hits, total, mode := poseLib.Search("sitting", poseFilter{}, 10, 0)
	if mode != "keyword" || total != 1 || hits[0].ID != "a" {
		t.Fatalf("nsfw gate / keyword: mode=%s total=%d hits=%v", mode, total, hits)
	}
	if _, total, _ := poseLib.Search("sitting", poseFilter{allowNSFW: true}, 10, 0); total != 2 {
		t.Fatalf("allowNSFW total=%d want 2", total)
	}
	if hits, _, _ := poseLib.Search("", poseFilter{body: "genwoman"}, 10, 0); len(hits) != 2 {
		t.Fatalf("body filter: %d hits", len(hits))
	}
	if hits, _, _ := poseLib.Search("", poseFilter{people: 2}, 10, 0); len(hits) != 1 || hits[0].ID != "d" {
		t.Fatalf("people filter: %v", hits)
	}
	if _, total, _ := poseLib.Search("", poseFilter{source: "shisei"}, 1, 5); total != 1 {
		t.Fatalf("offset past end total=%d", total)
	}
}

func TestPoseAssetURL(t *testing.T) {
	if got := poseAssetURL("gen/x.webp"); got != "/pose-assets/gen/x.webp" {
		t.Fatalf("default: %s", got)
	}
	t.Setenv("POSELIB_CDN", "https://cdn.example/poses/")
	if got := poseAssetURL("gen/x.webp"); got != "https://cdn.example/poses/gen/x.webp" {
		t.Fatalf("cdn: %s", got)
	}
	p := poseWithURLs(PoseRecord{Views: map[string]string{"front": "a.webp"}, SearchText: "x"})
	if p.SearchText != "" || p.Views["front"] != "https://cdn.example/poses/a.webp" {
		t.Fatalf("poseWithURLs: %+v", p)
	}
}

func TestPoseAssetRoute(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "images", "gen"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "images", "gen", "a.webp"), []byte("RIFFwebp"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), []byte("[]"), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("POSELIB_DIR", dir)
	cases := []struct {
		rel  string
		code int
	}{{"gen/a.webp", 200}, {"gen/missing.webp", 404}, {"../manifest.json", 404}, {"gen/a.webp.txt", 404}}
	for _, c := range cases {
		var ctx fasthttp.RequestCtx
		handlePoseAsset(&ctx, c.rel)
		if ctx.Response.StatusCode() != c.code {
			t.Errorf("%s: status %d want %d", c.rel, ctx.Response.StatusCode(), c.code)
		}
	}
}
