package main

import (
	"encoding/json"
	"encoding/xml"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const sitemapSiteURL = "https://manifoldgen.com"
const sitemapGalleryCDN = "https://manifoldgenstatic.manifoldgen.com/gallery"
const sitemapImagePageSize = 45000

// Sitemaps are generated from public content at request time so new gallery
// images and completed videos become crawlable without a separate cron job.
func handleSitemapIndex(ctx *fasthttp.RequestCtx) {
	setXML(ctx)
	var b strings.Builder
	b.WriteString(xml.Header)
	b.WriteString(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`)
	names := []string{"sitemap-pages.xml", "sitemap-images.xml", "videos.xml"}
	if dbConn != nil {
		dbConn.mu.RLock()
		var imageCount int
		err := dbConn.conn.QueryRow(`
			SELECT COUNT(*) FROM generated_images
			WHERE is_nsfw = FALSE AND COALESCE(file_path, '') <> ''`).Scan(&imageCount)
		dbConn.mu.RUnlock()
		if err == nil {
			for page := 2; page <= (imageCount+sitemapImagePageSize-1)/sitemapImagePageSize; page++ {
				names = append(names, fmt.Sprintf("sitemap-images-%d.xml", page))
			}
		}
	}
	for _, name := range names {
		fmt.Fprintf(&b, `<sitemap><loc>%s/%s</loc></sitemap>`, sitemapSiteURL, name)
	}
	b.WriteString(`</sitemapindex>`)
	ctx.SetBodyString(b.String())
}

func handleSitemapPages(ctx *fasthttp.RequestCtx) {
	setXML(ctx)
	var b strings.Builder
	b.WriteString(xml.Header)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`)
	for _, path := range []string{
		"/", "/tools", "/tools/h3-image", "/tools/music-generator", "/tools/make-image",
		"/tools/style-transfer", "/tools/h3-image-editor", "/tools/character-animator",
		"/tools/video-background-remover", "/tools/video-dramatizer",
		"/tools/canny-video", "/tools/depth-video", "/tools/hed-video", "/tools/mlsd-video", "/tools/pose-video", "/tools/video-inpainting",
		"/tools/cinematic-cameras", "/tools/relight", "/tools/inpaint",
		"/tools/image-upscale", "/tools/outpaint", "/tools/moodboard",
		"/tools/nano-banana", "/tools/grok-imagine", "/tools/flux-2", "/tools/gpt-image",
		"/tool/animate-video", "/tool/image-editor", "/tool/anima",
		"/api", "/api/video-generators", "/studio", "/voice", "/blog", "/privacy",
	} {
		writeSitemapURL(&b, path)
	}
	for _, path := range seoRoutesFromExport() {
		if !strings.HasPrefix(path, "/") || !publicSitemapURL(sitemapSiteURL+path) {
			continue
		}
		writeSitemapURL(&b, path)
	}
	b.WriteString(`</urlset>`)
	ctx.SetBodyString(b.String())
}

// writeSitemapURL emits one <url> carrying the full hreflang alternates
// cluster when precomputed translations cover the route; Google discovers
// every locale URL from the cluster on the English entry.
func writeSitemapURL(b *strings.Builder, path string) {
	loadI18nManifest()
	b.WriteString(`<url><loc>` + sitemapSiteURL + xmlText(path) + `</loc>`)
	if langs := i18nRouteLangs[path]; len(langs) > 0 {
		canonical := sitemapSiteURL + xmlText(path)
		b.WriteString(`<xhtml:link rel="alternate" hreflang="en" href="` + canonical + `"/>`)
		for _, lang := range langs {
			loc := sitemapSiteURL + "/" + lang
			if path != "/" {
				loc += xmlText(path)
			}
			b.WriteString(`<xhtml:link rel="alternate" hreflang="` + lang + `" href="` + loc + `"/>`)
		}
		b.WriteString(`<xhtml:link rel="alternate" hreflang="x-default" href="` + canonical + `"/>`)
	}
	b.WriteString(`</url>`)
}

// seoRoutesFromExport reads the route list emitted by the frontend build
// (public/seo-routes.json lands in the export root). Missing file or bad JSON
// simply yields no extra routes; the static list above always ships.
func seoRoutesFromExport() []string {
	data, err := os.ReadFile(filepath.Join(getEnv("DIST_DIR", "../frontend/out"), "seo-routes.json"))
	if err != nil {
		return nil
	}
	var payload struct {
		Routes []string `json:"routes"`
	}
	if json.Unmarshal(data, &payload) != nil {
		return nil
	}
	return payload.Routes
}

func handleSitemapImages(ctx *fasthttp.RequestCtx, pageText string) {
	setXML(ctx)
	var b strings.Builder
	b.WriteString(xml.Header)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`)
	page := 1
	if parsed, err := strconv.Atoi(pageText); err == nil && parsed > 0 {
		page = parsed
	}
	offset := (page - 1) * sitemapImagePageSize

	if dbConn != nil {
		dbConn.mu.RLock()
		rows, err := dbConn.conn.Query(`
			SELECT file_path, COALESCE(prompt, ''), created_at
			FROM generated_images
			WHERE is_nsfw = FALSE AND COALESCE(file_path, '') <> ''
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2`, sitemapImagePageSize, offset)
		if err == nil {
			for rows.Next() {
				var filePath, prompt string
				var createdAt time.Time
				if rows.Scan(&filePath, &prompt, &createdAt) != nil {
					continue
				}
				imageURL := sitemapGalleryCDN + "/" + strings.TrimPrefix(filePath, "/")
				fmt.Fprintf(&b, `<url><loc>%s/</loc><lastmod>%s</lastmod><image:image><image:loc>%s</image:loc>`, sitemapSiteURL, createdAt.UTC().Format(time.RFC3339), xmlText(imageURL))
				if prompt = sitemapText(prompt, "ManifoldGen generated image"); prompt != "" {
					fmt.Fprintf(&b, `<image:title>%s</image:title><image:caption>%s</image:caption>`, xmlText(prompt), xmlText(prompt))
				}
				b.WriteString(`</image:image></url>`)
			}
			rows.Close()
		}
		dbConn.mu.RUnlock()
	}
	if page == 1 && b.Len() == len(xml.Header)+len(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`) {
		b.WriteString(`<url><loc>` + sitemapSiteURL + `</loc><image:image><image:loc>` + sitemapSiteURL + `/brand/logo.webp</image:loc><image:title>ManifoldGen</image:title></image:image></url>`)
	}
	b.WriteString(`</urlset>`)
	ctx.SetBodyString(b.String())
}

func handleSitemapVideos(ctx *fasthttp.RequestCtx) {
	setXML(ctx)
	var b strings.Builder
	b.WriteString(xml.Header)
	b.WriteString(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`)

	if dbConn != nil {
		dbConn.mu.RLock()
		rows, err := dbConn.conn.Query(`
			SELECT COALESCE(prompt, ''), COALESCE(result_json::text, ''), created_at
			FROM video_jobs
			WHERE status = 'completed' AND COALESCE(prompt, '') <> ''
			ORDER BY created_at DESC
			LIMIT 50000`)
		if err == nil {
			for rows.Next() {
				var prompt, resultText string
				var createdAt time.Time
				if rows.Scan(&prompt, &resultText, &createdAt) != nil {
					continue
				}
				videoURL := extractVideoURLFromResultJSON(resultText)
				if !publicSitemapURL(videoURL) {
					continue
				}
				title := sitemapText(prompt, "ManifoldGen video")
				fmt.Fprintf(&b, `<url><loc>%s/</loc><lastmod>%s</lastmod><video:video><video:thumbnail_loc>%s/brand/logo.webp</video:thumbnail_loc><video:title>%s</video:title><video:description>%s</video:description><video:content_loc>%s</video:content_loc><video:publication_date>%s</video:publication_date></video:video></url>`, sitemapSiteURL, createdAt.UTC().Format(time.RFC3339), sitemapSiteURL, xmlText(title), xmlText(title), xmlText(videoURL), createdAt.UTC().Format(time.RFC3339))
			}
			rows.Close()
		}
		dbConn.mu.RUnlock()
	}
	b.WriteString(`</urlset>`)
	ctx.SetBodyString(b.String())
}

func setXML(ctx *fasthttp.RequestCtx) {
	ctx.SetStatusCode(fasthttp.StatusOK)
	ctx.Response.Header.SetContentType("application/xml; charset=utf-8")
	ctx.Response.Header.Set("Cache-Control", "public, max-age=300, s-maxage=900")
}

func xmlText(value string) string {
	var b strings.Builder
	_ = xml.EscapeText(&b, []byte(value))
	return b.String()
}

func sitemapText(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	if len(value) > 300 {
		return value[:300]
	}
	return value
}

func publicSitemapURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	return err == nil && parsed.Scheme == "https" && parsed.Host != "" && parsed.User == nil
}

func handleSitemapTags(ctx *fasthttp.RequestCtx) { handleSitemapPages(ctx) }
