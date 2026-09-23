package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/valyala/fasthttp"
)

func TestArchivedLanesFailFastWithoutRunpodCalls(t *testing.T) {
	var calls int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		_, _ = w.Write([]byte(`{}`))
	}))
	defer server.Close()
	t.Setenv("H3_RUNPOD_API_KEY", "test")
	t.Setenv("H3_RUNPOD_CONTROL_URL", server.URL)
	t.Setenv("H3_RUNPOD_BASE_URL", server.URL)
	t.Setenv("RUNPOD_SPEND_CAP_FILE", t.TempDir()+"/none.json")
	t.Setenv("RUNPOD_ARCHIVED_ENDPOINT_IDS", "m3, ctl ,anim")
	t.Setenv("YUE_RUNPOD_ENDPOINT_ID", "")
	t.Setenv("MUSIC3_RUNPOD_ENDPOINT_ID", "m3")
	t.Setenv("MUSIC3_XFAST_RUNPOD_ENDPOINT_ID", "")
	t.Setenv("MUSIC3_FAST_RUNPOD_ENDPOINT_ID", "")
	t.Setenv("VIDEO_CONTROL_RUNPOD_ENDPOINT_ID", "ctl")
	t.Setenv("WAN_ANIMATE_RUNPOD_ENDPOINT_ID", "anim")
	t.Setenv("WAN_ANIMATE_FAST_RUNPOD_ENDPOINT_ID", "live")

	if !runpodEndpointArchived("ctl") || runpodEndpointArchived("live") || runpodEndpointArchived("") {
		t.Fatal("archive list parsing")
	}
	if err := music3PrepareEndpoint("m3", "standard"); err == nil {
		t.Fatal("scale-up of archived endpoint allowed")
	}
	if err := h3SetWorkersMax("ctl", 1); err == nil {
		t.Fatal("h3 scale-up of archived endpoint allowed")
	}
	if err := h3SetWorkersMax("ctl", 0); err != nil {
		t.Fatalf("scale-down must stay allowed: %v", err)
	}
	if status, err := callH3Runpod("anim", "/run", http.MethodPost, map[string]interface{}{"input": map[string]interface{}{}}, nil); err == nil || status != http.StatusServiceUnavailable {
		t.Fatalf("job submit to archived endpoint: status=%d err=%v", status, err)
	}
	if got := atomic.LoadInt32(&calls); got != 1 {
		t.Fatalf("RunPod calls = %d, want 1 (the scale-down)", got)
	}

	ctx := &fasthttp.RequestCtx{}
	handleMusic3Generation(ctx, &User{ID: "u"}, "lofi", "", 60, "audio", "standard", 0)
	if ctx.Response.StatusCode() != http.StatusServiceUnavailable {
		t.Fatalf("music status = %d", ctx.Response.StatusCode())
	}
	var body map[string]interface{}
	_ = json.Unmarshal(ctx.Response.Body(), &body)
	if body["error"] != runpodArchivedMessage || body["archived"] != true {
		t.Fatalf("music body = %s", ctx.Response.Body())
	}

	status := runpodLaneStatus()
	if status["music"] != true || status["h3_control"] != true {
		t.Fatalf("lane status = %#v", status)
	}
	animation := status["character_animation"].(map[string]bool)
	if !animation["standard"] || animation["fast"] {
		t.Fatalf("animation lanes = %#v", animation)
	}
	if atomic.LoadInt32(&calls) != 1 {
		t.Fatal("handler touched RunPod")
	}
}

func TestYueMusicUnaffectedByMusic3Archive(t *testing.T) {
	t.Setenv("RUNPOD_ARCHIVED_ENDPOINT_IDS", "lm0zg9x5ffivf6,abtkpd80glwpme")
	t.Setenv("YUE_RUNPOD_ENDPOINT_ID", "tmozxvnm9fuuud")
	t.Setenv("MUSIC3_RUNPOD_ENDPOINT_ID", "lm0zg9x5ffivf6")
	t.Setenv("MUSIC3_XFAST_RUNPOD_ENDPOINT_ID", "abtkpd80glwpme")
	for _, tier := range []string{"standard", "fast", "xfast"} {
		if runpodEndpointArchived(music3EndpointIDForTier(tier)) {
			t.Fatalf("%s music routed to archived lane", tier)
		}
	}
	if runpodLaneStatus()["music"] != false {
		t.Fatal("music shown archived while YuE serves it")
	}
}
