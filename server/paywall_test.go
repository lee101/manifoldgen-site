package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/valyala/fasthttp"
)

type paywallBody struct {
	Error struct {
		Code         string `json:"code"`
		Message      string `json:"message"`
		SubscribeURL string `json:"subscribe_url"`
	} `json:"error"`
}

func decodePaywall(t *testing.T, ctx *fasthttp.RequestCtx, status int, code string) paywallBody {
	t.Helper()
	if got := ctx.Response.StatusCode(); got != status {
		t.Fatalf("status %d, want %d: %s", got, status, ctx.Response.Body())
	}
	var body paywallBody
	if err := json.Unmarshal(ctx.Response.Body(), &body); err != nil {
		t.Fatalf("decode: %v %s", err, ctx.Response.Body())
	}
	if body.Error.Code != code || body.Error.Message == "" || body.Error.SubscribeURL != subscribeURL() {
		t.Fatalf("bad body: %+v", body)
	}
	if string(ctx.Response.Header.Peek("X-Subscribe-URL")) != subscribeURL() {
		t.Fatalf("missing X-Subscribe-URL")
	}
	return body
}

func TestImageEditorUnauthenticatedReturns401Contract(t *testing.T) {
	for _, handler := range []func(*fasthttp.RequestCtx){handleImageEditorBackground, handleImageEditorSelect, handleImageEditorText, handleImageEditorEdit, handleStudioRemoveBackground} {
		ctx := &fasthttp.RequestCtx{}
		ctx.Request.Header.SetMethod("POST")
		ctx.Request.SetBodyString(`{"image_url":"https://example.com/a.png"}`)
		handler(ctx)
		decodePaywall(t, ctx, http.StatusUnauthorized, paywallCodeAuthRequired)
	}
}

func TestSubscriptionRequiredContract(t *testing.T) {
	t.Setenv("MANIFOLDGEN_SUBSCRIBE_URL", "https://manifoldgen.com/account#credits")
	ctx := &fasthttp.RequestCtx{}
	chargeError(ctx, errString("insufficient credits: have 0.00, need 8.00"), "insufficient credits: targeted regeneration costs 8 credits")
	body := decodePaywall(t, ctx, http.StatusPaymentRequired, paywallCodeSubscriptionRequired)
	if !strings.Contains(body.Error.Message, "8 credits") {
		t.Fatalf("message %q", body.Error.Message)
	}
	ctx = &fasthttp.RequestCtx{}
	chargeError(ctx, errString("check balance: connection refused"), "x")
	if ctx.Response.StatusCode() != http.StatusInternalServerError {
		t.Fatalf("db error should be 500, got %d", ctx.Response.StatusCode())
	}
}

type errString string

func (e errString) Error() string { return string(e) }

func TestImageEditorNativeMapsGatewayPaywall(t *testing.T) {
	for _, status := range []int{http.StatusUnauthorized, http.StatusPaymentRequired} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Subscribe-URL", "https://gateway.example/subscribe")
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"error":{"code":"subscription_required","message":"subscribe first","subscribe_url":"https://gateway.example/subscribe"}}`))
		}))
		t.Setenv("OMNISERVE_NATIVE_URL", srv.URL)
		_, err := imageEditorNative("/v1/images/segmentations", map[string]string{})
		srv.Close()
		ctx := &fasthttp.RequestCtx{}
		if !writeGatewayPaywall(ctx, err, "Image Editor") {
			t.Fatalf("status %d not mapped: %v", status, err)
		}
		decodePaywall(t, ctx, http.StatusPaymentRequired, paywallCodeSubscriptionRequired)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusInternalServerError) }))
	defer srv.Close()
	t.Setenv("OMNISERVE_NATIVE_URL", srv.URL)
	_, err := imageEditorNative("/v1/images/segmentations", map[string]string{})
	if err == nil || writeGatewayPaywall(&fasthttp.RequestCtx{}, err, "Image Editor") {
		t.Fatalf("500 must stay a gateway error: %v", err)
	}
}
