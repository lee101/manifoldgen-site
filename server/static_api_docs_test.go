package main

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/valyala/fasthttp"
)

func TestRequestHandlerServesNestedAPIDocsRSCBeforeJSONRouter(t *testing.T) {
	distDir := t.TempDir()
	docsDir := filepath.Join(distDir, "api")
	if err := os.MkdirAll(docsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	const payload = "video generator docs RSC"
	if err := os.WriteFile(filepath.Join(docsDir, "video-generators.txt"), []byte(payload), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DIST_DIR", distDir)

	var ctx fasthttp.RequestCtx
	ctx.Request.Header.SetMethod("GET")
	ctx.Request.SetRequestURI("/api/video-generators.txt?_rsc=regression")
	requestHandler(&ctx)

	if got := ctx.Response.StatusCode(); got != fasthttp.StatusOK {
		t.Fatalf("status = %d, want 200; body = %q", got, ctx.Response.Body())
	}
	if got := string(ctx.Response.Body()); got != payload {
		t.Fatalf("body = %q, want %q", got, payload)
	}
	if got := string(ctx.Response.Header.ContentType()); got != "text/plain" {
		t.Fatalf("Content-Type = %q, want text/plain", got)
	}
}

func TestStaticAPIDocsPathIsNarrowlyScoped(t *testing.T) {
	for _, path := range []string{
		"/api/video-generators",
		"/api/video-generators.txt",
		"/api/video-generators/manifold",
		"/api/video-generators/manifold.txt",
	} {
		if !isStaticAPIDocsPath(path) {
			t.Errorf("isStaticAPIDocsPath(%q) = false, want true", path)
		}
	}
	for _, path := range []string{
		"/api/video-generators-malicious",
		"/api/video-jobs/123",
		"/api/pricing",
	} {
		if isStaticAPIDocsPath(path) {
			t.Errorf("isStaticAPIDocsPath(%q) = true, want false", path)
		}
	}
}
