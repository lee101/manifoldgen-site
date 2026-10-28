package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

// RunPod completion webhook (opt-in). When H3_RUNPOD_WEBHOOK_BASE_URL and
// H3_RUNPOD_WEBHOOK_SECRET are set, H3 /run submissions carry a signed webhook
// URL. The webhook is only a wake-up: the watcher still reads the authoritative
// /status before settling, so a forged or replayed call costs one status read.
// Without the flag the watcher keeps its 2 s poll.

const h3RunpodWebhookPath = "/api/runpod/h3-webhook"

var h3RunpodPollInterval = 2 * time.Second

func h3RunpodWebhookSecret() string {
	secret := strings.TrimSpace(os.Getenv("H3_RUNPOD_WEBHOOK_SECRET"))
	if len(secret) < 16 {
		return ""
	}
	return secret
}

func h3RunpodWebhookSig(secret, endpointID string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte("h3-runpod-webhook:" + endpointID))
	return hex.EncodeToString(mac.Sum(nil))
}

func h3RunpodWebhookURL(endpointID string) string {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("H3_RUNPOD_WEBHOOK_BASE_URL")), "/")
	secret := h3RunpodWebhookSecret()
	if base == "" || secret == "" || strings.TrimSpace(endpointID) == "" || !strings.HasPrefix(base, "https://") {
		return ""
	}
	return base + h3RunpodWebhookPath + "?ep=" + url.QueryEscape(endpointID) + "&sig=" + h3RunpodWebhookSig(secret, endpointID)
}

// h3RunpodFallbackPoll is the /status interval used while a webhook is
// expected; it bounds the delay if a webhook is lost.
func h3RunpodFallbackPoll() time.Duration {
	if configured := strings.TrimSpace(os.Getenv("H3_RUNPOD_WEBHOOK_FALLBACK_POLL")); configured != "" {
		if parsed, err := time.ParseDuration(configured); err == nil && parsed >= time.Second {
			return parsed
		}
	}
	return 15 * time.Second
}

func h3RunpodStatusInterval(endpointID string) time.Duration {
	if h3RunpodWebhookURL(endpointID) != "" {
		return h3RunpodFallbackPoll()
	}
	return h3RunpodPollInterval
}

func withH3RunpodWebhook(endpointID string, body map[string]interface{}) map[string]interface{} {
	if hook := h3RunpodWebhookURL(endpointID); hook != "" {
		body["webhook"] = hook
	}
	return body
}

var h3RunpodWakeups sync.Map // "endpoint:job" -> chan struct{}

// watchRunpodH3Job registers a wake-up channel for one provider job. Register
// before the first /status read: a webhook that lands earlier is then either
// buffered here or already visible in that read.
func watchRunpodH3Job(endpointID, providerJobID string) (<-chan struct{}, func()) {
	key := endpointID + ":" + providerJobID
	ch := make(chan struct{}, 1)
	h3RunpodWakeups.Store(key, ch)
	return ch, func() { h3RunpodWakeups.CompareAndDelete(key, ch) }
}

func wakeRunpodH3Job(endpointID, providerJobID string) bool {
	value, ok := h3RunpodWakeups.Load(endpointID + ":" + providerJobID)
	if !ok {
		return false
	}
	select {
	case value.(chan struct{}) <- struct{}{}:
	default:
	}
	return true
}

// waitForRunpodH3Change sleeps until the next /status read is due, a webhook
// arrives, or the job is cancelled (false).
func waitForRunpodH3Change(jobID string, interval time.Duration, wake <-chan struct{}) bool {
	timer := time.NewTimer(interval)
	defer timer.Stop()
	select {
	case <-activeVideoJobContext(jobID).Done():
		return false
	case <-wake:
		return true
	case <-timer.C:
		return true
	}
}

func handleH3RunpodWebhook(ctx *fasthttp.RequestCtx) {
	secret := h3RunpodWebhookSecret()
	endpointID := strings.TrimSpace(string(ctx.QueryArgs().Peek("ep")))
	sig := strings.TrimSpace(string(ctx.QueryArgs().Peek("sig")))
	if secret == "" || endpointID == "" || !hmac.Equal([]byte(sig), []byte(h3RunpodWebhookSig(secret, endpointID))) {
		jsonError(ctx, http.StatusForbidden, "invalid webhook signature")
		return
	}
	var body struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(ctx.PostBody(), &body); err != nil || strings.TrimSpace(body.ID) == "" {
		jsonError(ctx, http.StatusBadRequest, "missing job id")
		return
	}
	woke := wakeRunpodH3Job(endpointID, strings.TrimSpace(body.ID))
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"ok": true, "watched": woke})
}
