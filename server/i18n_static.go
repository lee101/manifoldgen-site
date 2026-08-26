package main

// Precomputed multilingual static pages. The frontend export ships a
// i18n-manifest.json (written by frontend/scripts/i18n-build.ts) describing
// which locales exist and which routes they cover. This file serves
// /<lang>/… paths out of the same DIST_DIR tree (out/<lang>/…) and keeps the
// English SPA fallback from swallowing unknown localized URLs as soft 404s.

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/valyala/fasthttp"
)

var (
	i18nOnce       sync.Once
	i18nLangs      = map[string]bool{}
	i18nRouteLangs = map[string][]string{}
)

type i18nManifest struct {
	Langs  []string            `json:"langs"`
	Routes map[string][]string `json:"routes"`
}

func loadI18nManifest() {
	i18nOnce.Do(func() {
		data, err := os.ReadFile(filepath.Join(getEnv("DIST_DIR", "../frontend/out"), "i18n-manifest.json"))
		if err != nil {
			return
		}
		var manifest i18nManifest
		if json.Unmarshal(data, &manifest) != nil {
			return
		}
		for _, lang := range manifest.Langs {
			i18nLangs[lang] = true
		}
		i18nRouteLangs = manifest.Routes
	})
}

// i18nLangOf reports the locale prefix when path starts with a known language
// directory, returning the lang code and the remaining path ("/de/blog/x" ->
// "de", "/blog/x").
func i18nLangOf(path string) (string, string) {
	loadI18nManifest()
	if !strings.HasPrefix(path, "/") || len(path) < 3 {
		return "", ""
	}
	seg := path[1:]
	rest := "/"
	if i := strings.IndexByte(seg, '/'); i >= 0 {
		rest = seg[i:]
		seg = seg[:i]
	}
	if seg == "" || !i18nLangs[seg] {
		return "", ""
	}
	return seg, rest
}

// handleLocalizedStatic serves precomputed localized HTML. Missing pages are
// real 404s: an English fallback here would create duplicate-content soft 404s.
func handleLocalizedStatic(ctx *fasthttp.RequestCtx, lang, rest string) bool {
	if rest == "/" || rest == "" {
		if serveStaticFile(ctx, "/"+lang+"/index.html") {
			return true
		}
		return false
	}
	if serveStaticFile(ctx, "/"+lang+rest) {
		return true
	}
	return false
}

// serveLocalized404 returns the exported 404 page with a real 404 status so
// unknown localized URLs are not treated as duplicate content.
func serveLocalized404(ctx *fasthttp.RequestCtx) {
	path := filepath.Join(getEnv("DIST_DIR", "../frontend/out"), "404.html")
	if body, err := os.ReadFile(path); err == nil {
		ctx.SetStatusCode(fasthttp.StatusNotFound)
		ctx.Response.Header.SetContentType("text/html; charset=utf-8")
		ctx.SetBody(body)
		return
	}
	ctx.SetStatusCode(fasthttp.StatusNotFound)
	ctx.SetBodyString("not found")
}
