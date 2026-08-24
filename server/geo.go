package main

// geo.manifoldgen.com — agent-first markdown mirror of the platform, modeled
// on the GEO (generative engine optimization) pattern of serving clean
// markdown to AI crawlers while search engines index HTML.
//
// All content is embedded at build time from geo/content/*.md. Each file has
// a trivial frontmatter block: slug, title, description, read_when.

import (
	"embed"
	"encoding/xml"
	"fmt"
	"html"
	"sort"
	"strings"

	"github.com/valyala/fasthttp"
	"github.com/yuin/goldmark"
)

const geoHost = "geo.manifoldgen.com"
const geoBaseURL = "https://" + geoHost
const geoBrandLine = "Pay-as-you-go generative media APIs: images, video, music, speech, and editing on one prepaid balance, with a hosted MCP server for AI agents."

//go:embed geo/content/*.md
var geoContentFS embed.FS

type geoArticle struct {
	slug        string
	title       string
	description string
	readWhen    string
	bodyMD      string
	bodyHTML    string
}

var (
	geoArticles  []geoArticle
	geoBySlug    = map[string]*geoArticle{}
	geoLandingMD string
)

func init() {
	entries, err := geoContentFS.ReadDir("geo/content")
	if err != nil {
		panic(fmt.Sprintf("geo: read embedded content: %v", err))
	}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".md") {
			continue
		}
		raw, err := geoContentFS.ReadFile("geo/content/" + e.Name())
		if err != nil {
			panic(fmt.Sprintf("geo: read %s: %v", e.Name(), err))
		}
		a, ok := parseGeoArticle(string(raw))
		if !ok {
			panic(fmt.Sprintf("geo: malformed frontmatter in %s", e.Name()))
		}
		a.bodyHTML = renderGeoMarkdown(a.bodyMD)
		geoArticles = append(geoArticles, a)
	}
	sort.Slice(geoArticles, func(i, j int) bool { return geoArticles[i].slug < geoArticles[j].slug })
	for i := range geoArticles {
		geoBySlug[geoArticles[i].slug] = &geoArticles[i]
	}
	geoLandingMD = buildGeoLanding()
}

// parseGeoArticle splits the `key: value` frontmatter block from the body.
func parseGeoArticle(raw string) (geoArticle, bool) {
	var a geoArticle
	rest := strings.TrimPrefix(raw, "\ufeff")
	if !strings.HasPrefix(rest, "---\n") {
		return a, false
	}
	end := strings.Index(rest[4:], "\n---\n")
	if end < 0 {
		return a, false
	}
	front := rest[4 : 4+end]
	a.bodyMD = strings.TrimSpace(rest[4+end+5:]) + "\n"
	for _, line := range strings.Split(front, "\n") {
		key, value, found := strings.Cut(line, ":")
		if !found {
			return a, false
		}
		value = strings.TrimSpace(value)
		switch strings.TrimSpace(key) {
		case "slug":
			a.slug = value
		case "title":
			a.title = value
		case "description":
			a.description = value
		case "read_when":
			a.readWhen = value
		default:
			return a, false
		}
	}
	if a.slug == "" || a.title == "" || strings.ContainsAny(a.slug, "/ ") {
		return a, false
	}
	return a, true
}

func renderGeoMarkdown(md string) string {
	var b strings.Builder
	if err := goldmark.Convert([]byte(md), &b); err != nil {
		return ""
	}
	return b.String()
}

func buildGeoLanding() string {
	var b strings.Builder
	b.WriteString("# ManifoldGen\n\n> " + geoBrandLine + "\n\n")
	b.WriteString("This site serves clean markdown for AI agents and assistants. Every page exists as HTML at its canonical URL and as raw markdown by appending `.md`. Prices quoted across these pages are machine-readable at https://manifoldgen.com/api/pricing.\n\n")
	b.WriteString("Agents can act on this platform directly through the hosted MCP endpoint `https://manifoldgen.com/api/mcp` (tools: get_pricing, search_media, generate_media, get_job, list_jobs) or the REST API with an `sk-mg-` key.\n\n## Pages\n\n")
	for i := range geoArticles {
		a := &geoArticles[i]
		fmt.Fprintf(&b, "- [%s](/blog/%s.md): %s\n", a.title, a.slug, a.description)
	}
	return b.String()
}

func handleGeo(ctx *fasthttp.RequestCtx) {
	method := string(ctx.Method())
	if method != "GET" && method != "HEAD" {
		ctx.SetStatusCode(fasthttp.StatusMethodNotAllowed)
		return
	}

	path := strings.TrimSuffix(string(ctx.Path()), "/")
	if path == "" {
		path = "/"
	}

	switch path {
	case "/llms.txt":
		var b strings.Builder
		fmt.Fprintf(&b, "# ManifoldGen\n\n> %s\n\n## Docs\n\n", geoBrandLine)
		for i := range geoArticles {
			a := &geoArticles[i]
			fmt.Fprintf(&b, "- [%s](%s/blog/%s.md): %s\n", a.title, geoBaseURL, a.slug, a.readWhen)
		}
		fmt.Fprintf(&b, "- [Platform overview and page index](%s/index.md): Read this first for a summary of the platform and links to every page on this site.\n", geoBaseURL)
		geoRespond(ctx, fasthttp.StatusOK, "text/plain; charset=utf-8", b.String())
		return

	case "/robots.txt":
		geoRespond(ctx, fasthttp.StatusOK, "text/plain; charset=utf-8", `# AI answer engines and training crawlers: full access including raw markdown.
User-Agent: GPTBot
User-Agent: OAI-SearchBot
User-Agent: ChatGPT-User
User-Agent: ClaudeBot
User-Agent: Claude-Web
User-Agent: anthropic-ai
User-Agent: PerplexityBot
User-Agent: Google-Extended
User-Agent: Applebot
User-Agent: Amazonbot
User-Agent: CCBot
User-Agent: Bytespider
User-Agent: DuckDuckBot
Allow: /
Allow: /*.md$

# Search indexers: HTML only, so raw markdown duplicates stay out of web results.
User-Agent: Googlebot
User-Agent: Googlebot Smartphone
User-Agent: Bingbot
Disallow: /*.md$

Sitemap: `+geoBaseURL+`/sitemap.xml
`)
		return

	case "/sitemap.xml":
		var b strings.Builder
		b.WriteString(xml.Header)
		b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
		fmt.Fprintf(&b, "<url><loc>%s/</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>", geoBaseURL)
		for i := range geoArticles {
			fmt.Fprintf(&b, "<url><loc>%s/blog/%s</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>", geoBaseURL, geoArticles[i].slug)
		}
		b.WriteString("</urlset>")
		geoRespond(ctx, fasthttp.StatusOK, "application/xml; charset=utf-8", b.String())
		return
	}

	// Document routes. /task/blog/<slug> mirrors Higgsfield's agent-referral
	// alias pattern; it serves identical bytes with a canonical pointer to
	// the /blog/<slug> form.
	canonicalPath := ""
	var doc *string // landing markdown when set
	var art *geoArticle
	switch {
	case path == "/" || path == "/index.md":
		canonicalPath = "/"
		doc = &geoLandingMD
	case strings.HasPrefix(path, "/task/blog/"):
		slug := strings.TrimSuffix(strings.TrimPrefix(path, "/task/blog/"), ".md")
		canonicalPath = "/blog/" + slug
		art = geoBySlug[slug]
	case strings.HasPrefix(path, "/blog/"):
		rest := strings.TrimPrefix(path, "/blog/")
		slug := strings.TrimSuffix(rest, ".md")
		canonicalPath = "/blog/" + slug
		art = geoBySlug[slug]
	default:
		geoNotFound(ctx)
		return
	}

	if doc == nil && art == nil {
		geoNotFound(ctx)
		return
	}

	wantsMD := strings.HasSuffix(path, ".md") || geoWantsMarkdown(ctx)

	ctx.Response.Header.Set("Cache-Control", "public, max-age=3600")
	if wantsMD {
		body := ""
		if doc != nil {
			body = *doc
		} else {
			body = "---\ntitle: " + art.title + "\ncanonical: " + geoBaseURL + canonicalPath + "\n---\n\n" + art.bodyMD
		}
		geoRespond(ctx, fasthttp.StatusOK, "text/markdown; charset=utf-8", body)
		return
	}

	// HTML surface for search engines and human referrals.
	pageTitle, pageDesc, bodyHTML := "ManifoldGen — Generative Media APIs", geoBrandLine, ""
	if doc != nil {
		bodyHTML = renderGeoMarkdown(*doc)
	} else {
		pageTitle = art.title
		pageDesc = art.description
		bodyHTML = art.bodyHTML
	}
	geoRespondHTML(ctx, pageTitle, pageDesc, canonicalPath, bodyHTML)
}

func geoWantsMarkdown(ctx *fasthttp.RequestCtx) bool {
	return strings.Contains(string(ctx.Request.Header.Peek("Accept")), "text/markdown")
}

func geoNotFound(ctx *fasthttp.RequestCtx) {
	ctx.Response.Header.Set("Cache-Control", "no-store")
	geoRespond(ctx, fasthttp.StatusNotFound, "text/plain; charset=utf-8",
		"not found; see "+geoBaseURL+"/llms.txt\n")
}

func geoRespond(ctx *fasthttp.RequestCtx, status int, contentType, body string) {
	ctx.SetStatusCode(status)
	ctx.Response.Header.SetContentType(contentType)
	ctx.SetBodyString(body)
}

const geoPageStyle = `body{background:#0a0a0f;color:#e8e8ef;font:16px/1.7 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:2rem 1rem;}main{max-width:46rem;margin:0 auto;}a{color:#8ab4ff;}h1,h2{line-height:1.25;}code{background:#1a1a24;border-radius:4px;padding:.1em .35em;font-size:.9em;}pre code{display:block;padding:1em;overflow-x:auto;}blockquote{border-left:3px solid #33334a;margin:0;padding:.25rem 1rem;color:#b9b9c9;}footer{margin-top:3rem;border-top:1px solid #26263a;padding-top:1rem;color:#8888a0;font-size:.9rem;}`

func geoRespondHTML(ctx *fasthttp.RequestCtx, title, description, canonicalPath, bodyHTML string) {
	var b strings.Builder
	b.WriteString("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>")
	b.WriteString(html.EscapeString(title))
	b.WriteString("</title>\n<meta name=\"description\" content=\"")
	b.WriteString(html.EscapeString(description))
	b.WriteString("\">\n<link rel=\"canonical\" href=\"")
	b.WriteString(geoBaseURL)
	if canonicalPath == "" {
		b.WriteString("/")
	} else {
		b.WriteString(html.EscapeString(canonicalPath))
	}
	b.WriteString("\">\n<style>")
	b.WriteString(geoPageStyle)
	b.WriteString("</style>\n</head>\n<body>\n<main>\n")
	b.WriteString(bodyHTML)
	b.WriteString("\n<footer>ManifoldGen — <a href=\"https://manifoldgen.com\">manifoldgen.com</a> · <a href=\"/llms.txt\">llms.txt</a> · markdown: append <code>.md</code> to any URL</footer>\n</main>\n</body>\n</html>\n")
	geoRespond(ctx, fasthttp.StatusOK, "text/html; charset=utf-8", b.String())
}
