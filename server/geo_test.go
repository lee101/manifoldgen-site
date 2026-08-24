package main

import (
	"encoding/xml"
	"strings"
	"testing"

	"github.com/valyala/fasthttp"
)

func geoTestCtx(path string, accept string) *fasthttp.RequestCtx {
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.Header.SetMethod("GET")
	ctx.Request.SetRequestURI("https://" + geoHost + path)
	if accept != "" {
		ctx.Request.Header.Set("Accept", accept)
	}
	return ctx
}

// Content files must parse: every embedded article needs slug/title/desc/read_when.
func TestGeoContentParses(t *testing.T) {
	if len(geoArticles) == 0 {
		t.Fatal("no geo articles loaded")
	}
	for _, a := range geoArticles {
		if a.description == "" || a.readWhen == "" {
			t.Errorf("article %s missing description or read_when", a.slug)
		}
		if !strings.Contains(a.bodyHTML, "<p>") {
			t.Errorf("article %s body did not render HTML", a.slug)
		}
		if len(a.bodyMD) < 200 {
			t.Errorf("article %s body suspiciously short", a.slug)
		}
	}
}

func TestGeoLandingListsAllArticles(t *testing.T) {
	for _, a := range geoArticles {
		if !strings.Contains(geoLandingMD, "](/blog/"+a.slug+".md)") {
			t.Errorf("landing markdown missing link to %s", a.slug)
		}
	}
}

func TestGeoRoutes(t *testing.T) {
	cases := []struct {
		path        string
		accept      string
		wantStatus  int
		wantType    string
		wantContain string
	}{
		{"/llms.txt", "", 200, "text/plain", "# ManifoldGen"},
		{"/robots.txt", "", 200, "text/plain", "Sitemap: https://geo.manifoldgen.com/sitemap.xml"},
		{"/sitemap.xml", "", 200, "application/xml", "<loc>https://geo.manifoldgen.com/blog/"},
		{"/", "", 200, "text/html", "<!DOCTYPE html>"},
		{"/index.md", "", 200, "text/markdown", "# ManifoldGen"},
		{"/", "text/markdown", 200, "text/markdown", "# ManifoldGen"},
		{"/blog/" + geoArticles[0].slug, "", 200, "text/html", "canonical"},
		{"/blog/" + geoArticles[0].slug + ".md", "", 200, "text/markdown", "title: "},
		{"/task/blog/" + geoArticles[0].slug + ".md", "", 200, "text/markdown", "title: "},
		{"/blog/" + geoArticles[0].slug + "/", "", 200, "text/html", "<!DOCTYPE html>"},
		{"/blog/does-not-exist", "", 404, "text/plain", "not found"},
		{"/random/path", "", 404, "text/plain", "not found"},
	}
	for _, tc := range cases {
		ctx := geoTestCtx(tc.path, tc.accept)
		handleGeo(ctx)
		if ctx.Response.StatusCode() != tc.wantStatus {
			t.Errorf("%s: status = %d, want %d", tc.path, ctx.Response.StatusCode(), tc.wantStatus)
			continue
		}
		ct := string(ctx.Response.Header.ContentType())
		if !strings.Contains(ct, tc.wantType) {
			t.Errorf("%s: content type = %q, want contains %q", tc.path, ct, tc.wantType)
		}
		body := string(ctx.Response.Body())
		if !strings.Contains(body, tc.wantContain) {
			t.Errorf("%s: body missing %q", tc.path, tc.wantContain)
		}
	}
}

// /task/blog/<slug> must serve identical markdown bytes to /blog/<slug>.md.
func TestGeoTaskAliasMatchesCanonical(t *testing.T) {
	slug := geoArticles[0].slug
	a := geoTestCtx("/blog/"+slug+".md", "")
	handleGeo(a)
	b := geoTestCtx("/task/blog/"+slug+".md", "")
	handleGeo(b)
	if string(a.Response.Body()) != string(b.Response.Body()) {
		t.Error("/task alias body differs from canonical")
	}
}

func TestGeoSitemapIsValidXMLWithEveryArticle(t *testing.T) {
	ctx := geoTestCtx("/sitemap.xml", "")
	handleGeo(ctx)
	var set struct {
		URLs []struct {
			Loc string `xml:"loc"`
		} `xml:"url"`
	}
	if err := xml.Unmarshal(ctx.Response.Body(), &set); err != nil {
		t.Fatalf("sitemap not valid XML: %v", err)
	}
	joined := ""
	for _, u := range set.URLs {
		joined += u.Loc + "\n"
	}
	for _, a := range geoArticles {
		if !strings.Contains(joined, "/blog/"+a.slug) {
			t.Errorf("sitemap missing %s", a.slug)
		}
	}
}

// Search indexers get .md disallowed while AI crawlers do not — the core GEO split.
func TestGeoRobotsSplit(t *testing.T) {
	rob := geoTestCtx("/robots.txt", "")
	handleGeo(rob)
	body := string(rob.Response.Body())
	mdIdx := strings.Index(body, "Disallow: /*.md$")
	googlebotIdx := strings.Index(body, "User-Agent: Googlebot")
	if mdIdx < 0 || googlebotIdx < 0 || mdIdx < googlebotIdx {
		t.Error("expected .md disallow only after the Googlebot group")
	}
	if !strings.Contains(body, "Allow: /*.md$") {
		t.Error("AI crawler group must allow .md")
	}
}

// The host gate must route before the main-site router sees the request.
func TestGeoHostGate(t *testing.T) {
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.Header.SetMethod("GET")
	ctx.Request.SetRequestURI("https://geo.manifoldgen.com/llms.txt")
	requestHandler(ctx)
	if ctx.Response.StatusCode() == 404 && strings.Contains(string(ctx.Response.Header.ContentType()), "html") {
		t.Error("host gate did not engage; geo request fell through to SPA router")
	}
	if !strings.Contains(string(ctx.Response.Body()), "# ManifoldGen") {
		t.Errorf("llms.txt via host gate: unexpected body %.80s", ctx.Response.Body())
	}
}
