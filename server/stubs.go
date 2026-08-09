package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/valyala/fasthttp"
)

// Stubs for manifoldgen-only surfaces (crypto, gallery SEO) that the video
// studio does not ship. Gobed search lives in search.go.

func initCrypto() {}

func getCUTEPriceUSD() float64 {
	// Netwrck-style credit unit: 1 credit = $0.01 USD.
	// Image gen at $0.04 → 4 credits; $50 top-up → 5000 credits.
	if v := parseFloat(strings.TrimSpace(os.Getenv("CREDIT_PRICE_USD"))); v > 0 {
		return v
	}
	return 0.01
}

func getCUTEPriceATH() float64 { return getCUTEPriceUSD() }
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
	jsonResponse(ctx, 200, map[string]any{
		"cute_price_usd":     getCUTEPriceUSD(),
		"credit_price_usd":   getCUTEPriceUSD(),
		"credits_per_dollar": 1.0 / getCUTEPriceUSD(),
		"sol_price_usd":      0,
	})
}
func handleSwapQuote(ctx *fasthttp.RequestCtx)       { jsonError(ctx, 501, "token swap disabled") }
func handleSwapTransaction(ctx *fasthttp.RequestCtx) { jsonError(ctx, 501, "token swap disabled") }
func handleSwapSendTransaction(ctx *fasthttp.RequestCtx) {
	jsonError(ctx, 501, "token swap disabled")
}
func handlePromptAPI(ctx *fasthttp.RequestCtx, _ string) {
	jsonError(ctx, 501, "prompt library disabled")
}
