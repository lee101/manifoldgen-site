package main

import (
	"strings"
	"testing"

	"github.com/valyala/fasthttp"
)

func TestSitemapPagesIncludesAnimationTransfer(t *testing.T) {
	ctx := &fasthttp.RequestCtx{}
	handleSitemapPages(ctx)
	body := string(ctx.Response.Body())
	for _, path := range []string{"/tools", "/tool/animate-video", "/tool/image-editor", "/api/video-generators", "/studio"} {
		if !strings.Contains(body, sitemapSiteURL+path) {
			t.Fatalf("sitemap is missing %s", path)
		}
	}
}

func TestSitemapPagesIncludesMotionTools(t *testing.T) {
	ctx := &fasthttp.RequestCtx{}
	handleSitemapPages(ctx)
	body := string(ctx.Response.Body())
	for _, slug := range []string{"motion-fx", "anime-fight-fx", "ki-aura-fx", "lightning-fx", "fight-game-hud", "motion-exaggerate-fx", "afterimage-fx", "fight-reel-reframe", "beat-drop-fx", "motion-tracker", "motion-score"} {
		if got := strings.Count(body, sitemapSiteURL+"/tools/"+slug+"<"); got != 1 {
			t.Fatalf("sitemap lists /tools/%s %d times, want once", slug, got)
		}
	}
}
