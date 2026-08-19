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
