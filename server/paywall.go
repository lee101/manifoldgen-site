package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/valyala/fasthttp"
)

const (
	paywallCodeAuthRequired         = "auth_required"
	paywallCodeSubscriptionRequired = "subscription_required"
)

func subscribeURL() string {
	return getEnv("MANIFOLDGEN_SUBSCRIBE_URL", sitemapSiteURL+"/account#credits")
}

// paywallError writes the shared 401/402 contract used by the GPU gateway:
// {"error":{"code","message","subscribe_url"}} plus X-Subscribe-URL.
func paywallError(ctx *fasthttp.RequestCtx, status int, code, msg string) {
	url := subscribeURL()
	ctx.SetStatusCode(status)
	ctx.Response.Header.Set("Content-Type", "application/json")
	ctx.Response.Header.Set("X-Subscribe-URL", url)
	body, _ := json.Marshal(map[string]interface{}{
		"error": map[string]string{"code": code, "message": msg, "subscribe_url": url},
	})
	ctx.SetBody(body)
}

// servicePaywallError keeps /api/service's string "error" for its many API,
// MCP and frontend consumers while adding the contract's code, subscribe_url
// and X-Subscribe-URL so clients can still route users to subscribe.
func servicePaywallError(ctx *fasthttp.RequestCtx, status int, code, msg string) {
	url := subscribeURL()
	ctx.SetStatusCode(status)
	ctx.Response.Header.Set("Content-Type", "application/json")
	ctx.Response.Header.Set("X-Subscribe-URL", url)
	body, _ := json.Marshal(map[string]string{"error": msg, "code": code, "subscribe_url": url})
	ctx.SetBody(body)
}

func authRequiredError(ctx *fasthttp.RequestCtx, msg string) {
	paywallError(ctx, http.StatusUnauthorized, paywallCodeAuthRequired, msg)
}

func subscriptionRequiredError(ctx *fasthttp.RequestCtx, msg string) {
	paywallError(ctx, http.StatusPaymentRequired, paywallCodeSubscriptionRequired, msg)
}

// gatewayPaywallError is an upstream GPU gateway 401/402. Callers surface it
// to the user as the 402 subscribe contract instead of a 5xx.
type gatewayPaywallError struct {
	Status  int
	Message string
}

func (e *gatewayPaywallError) Error() string {
	return fmt.Sprintf("gpu gateway returned %d: %s", e.Status, e.Message)
}

func gatewayStatusError(label string, status int, body []byte) error {
	if status != http.StatusUnauthorized && status != http.StatusPaymentRequired {
		return fmt.Errorf("%s returned %d", label, status)
	}
	var parsed struct {
		Error json.RawMessage `json:"error"`
	}
	msg := ""
	if json.Unmarshal(body, &parsed) == nil && len(parsed.Error) > 0 {
		var nested struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(parsed.Error, &nested) == nil {
			msg = nested.Message
		} else {
			_ = json.Unmarshal(parsed.Error, &msg)
		}
	}
	return &gatewayPaywallError{Status: status, Message: strings.TrimSpace(msg)}
}

// writeGatewayPaywall maps an upstream gateway 401/402 to the 402 contract.
func writeGatewayPaywall(ctx *fasthttp.RequestCtx, err error, feature string) bool {
	var paywall *gatewayPaywallError
	if !errors.As(err, &paywall) {
		return false
	}
	log.Printf("gpu gateway paywall for %s: %v", feature, err)
	subscriptionRequiredError(ctx, "Subscribe or add credits to use "+feature+".")
	return true
}

// chargeError answers a failed credit deduction: 402 contract when the balance
// is short, 500 for storage failures.
func chargeError(ctx *fasthttp.RequestCtx, err error, msg string) {
	if strings.Contains(err.Error(), "insufficient") {
		subscriptionRequiredError(ctx, msg)
		return
	}
	jsonError(ctx, http.StatusInternalServerError, "failed to deduct credits")
}
