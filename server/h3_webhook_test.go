package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/valyala/fasthttp"
)

func TestH3RunpodWebhookURLIsOptIn(t *testing.T) {
	t.Setenv("H3_RUNPOD_WEBHOOK_BASE_URL", "")
	t.Setenv("H3_RUNPOD_WEBHOOK_SECRET", "")
	if got := h3RunpodWebhookURL("ep"); got != "" {
		t.Fatalf("webhook without config = %q", got)
	}
	if got := h3RunpodStatusInterval("ep"); got != 2*time.Second {
		t.Fatalf("poll interval without webhook = %v, want 2s", got)
	}
	body := withH3RunpodWebhook("ep", map[string]interface{}{"input": 1})
	if _, ok := body["webhook"]; ok {
		t.Fatal("webhook added while disabled")
	}
	t.Setenv("H3_RUNPOD_WEBHOOK_BASE_URL", "https://manifoldgen.com/")
	t.Setenv("H3_RUNPOD_WEBHOOK_SECRET", "short")
	if got := h3RunpodWebhookURL("ep"); got != "" {
		t.Fatalf("webhook with weak secret = %q", got)
	}
	t.Setenv("H3_RUNPOD_WEBHOOK_SECRET", "0123456789abcdef0123")
	got := h3RunpodWebhookURL("ep")
	want := "https://manifoldgen.com/api/runpod/h3-webhook?ep=ep&sig=" + h3RunpodWebhookSig("0123456789abcdef0123", "ep")
	if got != want {
		t.Fatalf("webhook = %q, want %q", got, want)
	}
	if got := h3RunpodStatusInterval("ep"); got != 15*time.Second {
		t.Fatalf("fallback poll = %v, want 15s", got)
	}
	t.Setenv("H3_RUNPOD_WEBHOOK_FALLBACK_POLL", "8s")
	if got := h3RunpodStatusInterval("ep"); got != 8*time.Second {
		t.Fatalf("configured fallback poll = %v, want 8s", got)
	}
}

func TestSubmitScaledH3RunpodJobCarriesWebhook(t *testing.T) {
	var mu sync.Mutex
	var submitted map[string]interface{}
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/h3ep/run" {
			mu.Lock()
			_ = json.NewDecoder(r.Body).Decode(&submitted)
			mu.Unlock()
			_ = json.NewEncoder(w).Encode(map[string]interface{}{"id": "job-1", "status": "IN_QUEUE"})
			return
		}
		http.NotFound(w, r)
	}))
	defer upstream.Close()
	t.Setenv("H3_RUNPOD_API_KEY", "test-key")
	t.Setenv("H3_RUNPOD_BASE_URL", upstream.URL)
	t.Setenv("H3_RUNPOD_CONTROL_URL", upstream.URL)
	t.Setenv("RUNPOD_ARCHIVED_ENDPOINT_IDS", "")
	t.Setenv("H3_RUNPOD_WEBHOOK_BASE_URL", "https://manifoldgen.com")
	t.Setenv("H3_RUNPOD_WEBHOOK_SECRET", "0123456789abcdef0123")
	route := h3WorkerRoute{Variant: h3NormalVariant, RunpodEndpointID: "h3ep"}
	h3KnownWorkersMax.Store("h3ep", h3KnownMax{h3DesiredWorkersMax(route), time.Now()})
	t.Cleanup(func() { h3KnownWorkersMax.Delete("h3ep") })

	var queued h3RunpodQueuedJob
	if _, err := submitScaledH3RunpodJob(route, map[string]interface{}{"prompt": "x", "duration": 5}, &queued); err != nil || queued.ID != "job-1" {
		t.Fatalf("submit job=%q err=%v", queued.ID, err)
	}
	mu.Lock()
	defer mu.Unlock()
	hook, _ := submitted["webhook"].(string)
	if !strings.HasPrefix(hook, "https://manifoldgen.com/api/runpod/h3-webhook?ep=h3ep&sig=") {
		t.Fatalf("submitted webhook = %q", hook)
	}
	if _, ok := submitted["policy"]; !ok {
		t.Fatal("execution policy dropped")
	}
	if input, _ := submitted["input"].(map[string]interface{}); input["prompt"] != "x" {
		t.Fatalf("input changed: %#v", submitted["input"])
	}
}

func webhookCtx(query string, body string) *fasthttp.RequestCtx {
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.Header.SetMethod(http.MethodPost)
	ctx.Request.SetRequestURI(h3RunpodWebhookPath + "?" + query)
	ctx.Request.SetBodyString(body)
	return ctx
}

func TestH3RunpodWebhookWakesOnlySignedWatcher(t *testing.T) {
	secret := "0123456789abcdef0123"
	t.Setenv("H3_RUNPOD_WEBHOOK_SECRET", secret)
	wake, stop := watchRunpodH3Job("ep", "job-1")
	defer stop()

	bad := webhookCtx("ep=ep&sig=deadbeef", `{"id":"job-1","status":"COMPLETED"}`)
	handleH3RunpodWebhook(bad)
	if bad.Response.StatusCode() != http.StatusForbidden {
		t.Fatalf("bad signature status = %d", bad.Response.StatusCode())
	}
	select {
	case <-wake:
		t.Fatal("unsigned webhook woke the watcher")
	default:
	}

	good := webhookCtx("ep=ep&sig="+h3RunpodWebhookSig(secret, "ep"), `{"id":"job-1","status":"COMPLETED"}`)
	handleH3RunpodWebhook(good)
	if good.Response.StatusCode() != http.StatusOK {
		t.Fatalf("signed webhook status = %d body=%s", good.Response.StatusCode(), good.Response.Body())
	}
	select {
	case <-wake:
	case <-time.After(time.Second):
		t.Fatal("signed webhook did not wake the watcher")
	}
	other := webhookCtx("ep=ep&sig="+h3RunpodWebhookSig(secret, "ep"), `{"id":"job-2"}`)
	handleH3RunpodWebhook(other)
	if !strings.Contains(string(other.Response.Body()), `"watched":false`) {
		t.Fatalf("unwatched job response = %s", other.Response.Body())
	}
}

func TestWaitForRunpodH3ChangeReturnsOnWake(t *testing.T) {
	wake, stop := watchRunpodH3Job("ep", "job-w")
	defer stop()
	go func() {
		time.Sleep(20 * time.Millisecond)
		wakeRunpodH3Job("ep", "job-w")
	}()
	started := time.Now()
	if !waitForRunpodH3Change("no-such-video-job", time.Minute, wake) {
		t.Fatal("wait reported cancellation")
	}
	if elapsed := time.Since(started); elapsed > 5*time.Second {
		t.Fatalf("wake took %v", elapsed)
	}
}

func TestAwaitVideoJobChange(t *testing.T) {
	previousTick := videoJobLongPollTick
	videoJobLongPollTick = time.Hour
	t.Cleanup(func() { videoJobLongPollTick = previousTick })

	var mu sync.Mutex
	status := "processing"
	load := func(id, userID string) (*VideoJob, error) {
		mu.Lock()
		defer mu.Unlock()
		return &VideoJob{ID: id, UserID: userID, Status: status}, nil
	}
	job := &VideoJob{ID: "vj-1", UserID: "u", Status: "processing"}

	// Client already saw an older status: answer immediately.
	if got := awaitVideoJobChange(&VideoJob{ID: "vj-1", Status: "processing"}, "u", "queued", time.Minute, load); got.Status != "processing" {
		t.Fatalf("stale client status = %q", got.Status)
	}
	// Terminal rows never wait.
	started := time.Now()
	awaitVideoJobChange(&VideoJob{ID: "vj-1", Status: "completed"}, "u", "completed", time.Minute, load)
	if time.Since(started) > time.Second {
		t.Fatal("terminal job waited")
	}
	// A notification wakes the waiter as soon as the row changes.
	go func() {
		time.Sleep(30 * time.Millisecond)
		mu.Lock()
		status = "completed"
		mu.Unlock()
		notifyVideoJobChanged("vj-1")
	}()
	started = time.Now()
	got := awaitVideoJobChange(job, "u", "processing", time.Minute, load)
	if got.Status != "completed" || time.Since(started) > 5*time.Second {
		t.Fatalf("notify path status=%q after %v", got.Status, time.Since(started))
	}
	// Without changes the wait expires and returns the fresh row.
	mu.Lock()
	status = "processing"
	mu.Unlock()
	started = time.Now()
	got = awaitVideoJobChange(job, "u", "processing", 50*time.Millisecond, load)
	if got.Status != "processing" || time.Since(started) < 50*time.Millisecond {
		t.Fatalf("timeout path status=%q after %v", got.Status, time.Since(started))
	}
	videoJobWatchers.Lock()
	leaked := len(videoJobWatchers.m)
	videoJobWatchers.Unlock()
	if leaked != 0 {
		t.Fatalf("%d watcher sets leaked", leaked)
	}
}

func TestVideoJobLongPollWaitIsOptIn(t *testing.T) {
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.SetRequestURI("/api/video-jobs/x?wait=60&status=processing")
	t.Setenv("VIDEO_JOB_LONG_POLL", "")
	if got := videoJobLongPollWait(ctx); got != 0 {
		t.Fatalf("disabled wait = %v", got)
	}
	t.Setenv("VIDEO_JOB_LONG_POLL", "1")
	if got := videoJobLongPollWait(ctx); got != videoJobLongPollMax {
		t.Fatalf("clamped wait = %v", got)
	}
	ctx.Request.SetRequestURI("/api/video-jobs/x")
	if got := videoJobLongPollWait(ctx); got != 0 {
		t.Fatalf("no wait param = %v", got)
	}
}
