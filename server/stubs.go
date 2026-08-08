package main

import (
	"fmt"
	"strconv"
	"sync"

	"github.com/valyala/fasthttp"
)

// Stubs for manifoldgen-only surfaces (crypto, gallery SEO, gobed prompt search)
// that manifoldgen does not ship. Keep the video/auth/stripe core compiling.

type promptSearchEngine struct {
	mu sync.Mutex
}

func (p *promptSearchEngine) loadAndIndex() {}
func (p *promptSearchEngine) IsReady() bool { return false }
func (p *promptSearchEngine) Search(query string, topK int) ([]map[string]any, error) {
	return nil, nil
}
func (p *promptSearchEngine) Stats() map[string]any {
	return map[string]any{"ready": false, "indexed": 0}
}
func (p *promptSearchEngine) IndexIncremental(imageID, prompt string) {}

var promptSearch = &promptSearchEngine{}

func initCrypto()       {}
func initPromptSearch() {}

func getCUTEPriceUSD() float64 {
	// Manifoldgen bills in USD credits; keep a stable 1:1 conversion for
	// legacy ManifoldGen fields still referenced by shared handlers.
	return 1.0
}

func getCUTEPriceATH() float64 { return 1.0 }
func getSOLPriceUSD() float64  { return 0 }

func parseFloat(s string) float64 {
	v, _ := strconv.ParseFloat(s, 64)
	return v
}

func parseInt(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}

func initDiffusionzEngine() {}

var diffusionzAvailable = false

func generateImageC(prompt string, width, height, steps, seed int, guidance float64) ([]byte, error) {
	return nil, fmt.Errorf("local image generation disabled on manifoldgen")
}

func handleSitemapIndex(ctx *fasthttp.RequestCtx) { ctx.SetStatusCode(404) }
func handleSitemapPages(ctx *fasthttp.RequestCtx) { ctx.SetStatusCode(404) }
func handleSitemapImages(ctx *fasthttp.RequestCtx, _ string) {
	ctx.SetStatusCode(404)
}
func handleSitemapTags(ctx *fasthttp.RequestCtx) { ctx.SetStatusCode(404) }
func handlePromptHTML(ctx *fasthttp.RequestCtx, _ string) {
	ctx.SetStatusCode(404)
}
func handleImageBySlug(ctx *fasthttp.RequestCtx, _ string) {
	ctx.SetStatusCode(404)
}
func handleTagPage(ctx *fasthttp.RequestCtx, _ string) { ctx.SetStatusCode(404) }
func handleTagsIndex(ctx *fasthttp.RequestCtx)         { ctx.SetStatusCode(404) }
func handleCryptoCheckout(ctx *fasthttp.RequestCtx) {
	jsonError(ctx, 501, "crypto checkout disabled on manifoldgen")
}
func handleStreamCheckoutEvents(ctx *fasthttp.RequestCtx, _ string) {
	jsonError(ctx, 501, "crypto checkout disabled on manifoldgen")
}
func handleGetCheckoutStatus(ctx *fasthttp.RequestCtx, _ string) {
	jsonError(ctx, 501, "crypto checkout disabled on manifoldgen")
}
func handleGetCUTEPrice(ctx *fasthttp.RequestCtx) {
	jsonResponse(ctx, 200, map[string]any{"cute_price_usd": 1.0, "sol_price_usd": 0})
}
func handleSwapQuote(ctx *fasthttp.RequestCtx)       { jsonError(ctx, 501, "token swap disabled") }
func handleSwapTransaction(ctx *fasthttp.RequestCtx) { jsonError(ctx, 501, "token swap disabled") }
func handleSwapSendTransaction(ctx *fasthttp.RequestCtx) {
	jsonError(ctx, 501, "token swap disabled")
}
func handleSemanticImageSearch(ctx *fasthttp.RequestCtx) {
	jsonError(ctx, 501, "image search disabled")
}
func handlePromptAPI(ctx *fasthttp.RequestCtx, _ string) {
	jsonError(ctx, 501, "prompt library disabled")
}
