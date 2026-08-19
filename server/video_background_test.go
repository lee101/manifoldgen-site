package main

import (
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestNormalizeVideoBackgroundDefaults(t *testing.T) {
	req := ServiceUsageRequest{VideoURL: "https://cdn.example/person.mp4", Duration: 7}
	if err := normalizeVideoBackgroundRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.BackgroundColor != "transparent" || req.OutputFormat != "webm_vp9" {
		t.Fatalf("unexpected output defaults: %#v", req)
	}
	if req.PreserveAudio == nil || !*req.PreserveAudio {
		t.Fatal("audio should be preserved by default")
	}
	if req.MaxQuality == nil || *req.MaxQuality {
		t.Fatal("max_quality should default off")
	}
}

func TestVideoBackgroundRejectsNonTransparentAndLongInput(t *testing.T) {
	req := ServiceUsageRequest{VideoURL: "https://cdn.example/person.mp4", Duration: 31}
	if err := normalizeVideoBackgroundRequest(&req); err == nil {
		t.Fatal("expected duration limit")
	}
	req = ServiceUsageRequest{VideoURL: "https://cdn.example/person.mp4", Duration: 5, BackgroundColor: "red"}
	if err := normalizeVideoBackgroundRequest(&req); err == nil {
		t.Fatal("expected transparent-only validation")
	}
}

func TestVideoBackgroundPriceKeepsStandbyRetailRate(t *testing.T) {
	t.Setenv("VIDEO_BACKGROUND_REMOVAL_RATE_USD_PER_SECOND", "")
	got := videoBackgroundChargeUSD(5)
	want := 5 * 0.00425 * 1.20
	if math.Abs(got-want) > 0.000001 {
		t.Fatalf("price = %f, want %f", got, want)
	}
}

func TestVideoBackgroundPriceDoesNotCrossExactMicrodollarBoundary(t *testing.T) {
	t.Setenv("VIDEO_BACKGROUND_REMOVAL_RATE_USD_PER_SECOND", "0.10")
	if got := videoBackgroundChargeUSD(6); got != 0.60 {
		t.Fatalf("price = %.9f, want 0.600000000", got)
	}
}

func TestVideoBackgroundPrivateProviderCostIncludesColdDelay(t *testing.T) {
	t.Setenv("VIDEO_BACKGROUND_RUNPOD_GPU_USD_PER_HOUR", "")
	got := videoBackgroundPrivateProviderUSD(20_000, 180_000)
	want := 200.0 * 1.75 / 3600.0
	if math.Abs(got-want) > 0.000001 {
		t.Fatalf("provider cost = %.9f, want %.9f", got, want)
	}
}

func TestFalVideoBackgroundUsesReturnedRequestNamespace(t *testing.T) {
	got := falVideoBackgroundRequestBase("request/with spaces")
	if !strings.HasPrefix(got, "https://queue.fal.run/bria/video/requests/") {
		t.Fatalf("unexpected FAL request base: %s", got)
	}
	if strings.Contains(got, "background-removal/requests") {
		t.Fatalf("submission namespace cannot be used for status polling: %s", got)
	}
}

func TestFalVideoBackgroundTranscodesWebMInputs(t *testing.T) {
	for _, test := range []struct {
		url  string
		want bool
	}{
		{"https://cdn.example/clip.webm", true},
		{"https://cdn.example/CLIP.WEBM?token=abc", true},
		{"https://cdn.example/clip.mp4", false},
		{"https://cdn.example/webm/clip", false},
	} {
		if got := falVideoBackgroundNeedsTranscode(test.url); got != test.want {
			t.Errorf("falVideoBackgroundNeedsTranscode(%q) = %t, want %t", test.url, got, test.want)
		}
	}
}

func TestVideoBackgroundKeyIsStableAndOptionSensitive(t *testing.T) {
	keep, drop := true, false
	base := ServiceUsageRequest{VideoURL: "https://cdn.example/person.mp4", BackgroundColor: "transparent", OutputFormat: "webm_vp9", PreserveAudio: &keep}
	copy := base
	copy.Duration = 12
	if videoBackgroundRequestKey(base) != videoBackgroundRequestKey(copy) {
		t.Fatal("billing duration must not change processing identity")
	}
	copy.PreserveAudio = &drop
	if videoBackgroundRequestKey(base) == videoBackgroundRequestKey(copy) {
		t.Fatal("audio option must change processing identity")
	}
}

func TestVideoBackgroundKeyIncludesMaxQuality(t *testing.T) {
	keep, on := true, true
	base := ServiceUsageRequest{VideoURL: "https://cdn.example/person.mp4", BackgroundColor: "transparent", OutputFormat: "webm_vp9", PreserveAudio: &keep}
	copy := base
	copy.MaxQuality = &on
	if videoBackgroundRequestKey(base) == videoBackgroundRequestKey(copy) {
		t.Fatal("max_quality must change processing identity")
	}
	copy.MaskURL = "https://cdn.example/cutout.webp"
	if videoBackgroundRequestKey(ServiceUsageRequest{VideoURL: base.VideoURL, BackgroundColor: base.BackgroundColor, OutputFormat: base.OutputFormat, PreserveAudio: &keep, MaxQuality: &on}) == videoBackgroundRequestKey(copy) {
		t.Fatal("mask_url must change processing identity")
	}
}

func TestVideoBackgroundWorkerInputForcesMatAnyoneWhenMaxQuality(t *testing.T) {
	on := true
	req := ServiceUsageRequest{VideoURL: "https://cdn.example/clip.mp4", ImageURL: "https://cdn.example/still.webp", MaxQuality: &on}
	if err := normalizeVideoBackgroundRequest(&req); err != nil {
		t.Fatal(err)
	}
	input := videoBackgroundWorkerInput(req, "https://upload.example/put", "https://cdn.example/out.webm")
	if input["max_quality"] != true {
		t.Fatalf("max_quality = %#v", input["max_quality"])
	}
	if input["mask_url"] != "https://cdn.example/still.webp" {
		t.Fatalf("mask_url = %#v", input["mask_url"])
	}
	if _, ok := input["workload"]; ok {
		t.Fatal("native payload must not set workload; RunPod submit adds it")
	}
	if videoBackgroundAllowsNative(req) {
		t.Fatal("max_quality must bypass the native RVM lane")
	}
}

func TestNormalizeVideoBackgroundAcceptsMaxQualityAndMask(t *testing.T) {
	on := true
	req := ServiceUsageRequest{VideoURL: "https://cdn.example/person.mp4", Duration: 8, MaxQuality: &on, MaskURL: "https://cdn.example/mask.png"}
	if err := normalizeVideoBackgroundRequest(&req); err != nil {
		t.Fatal(err)
	}
	if !videoBackgroundMaxQuality(req) || req.MaskURL != "https://cdn.example/mask.png" {
		t.Fatalf("normalized = %#v", req)
	}
}

func TestVideoBackgroundRetriesOnlyMatteQualityFailures(t *testing.T) {
	for _, message := range []string{
		"MatAnyone matte rejected: opaque pixels are black for 3 frames",
		"MatAnyone matte rejected: alpha coverage too low",
	} {
		if !videoBackgroundMatteQualityFailure(message) {
			t.Fatalf("quality failure not detected: %s", message)
		}
	}
	if videoBackgroundMatteQualityFailure("CUDA out of memory") {
		t.Fatal("infrastructure failure must not consume the quality retry")
	}
}

func TestParseRunpodVideoBackgroundJob(t *testing.T) {
	endpoint, job, ok := parseRunpodVideoBackgroundJob("runpod-bg:endpoint-1:job-1")
	if !ok || endpoint != "endpoint-1" || job != "job-1" {
		t.Fatalf("parse = %q %q %t", endpoint, job, ok)
	}
	if _, _, ok := parseRunpodVideoBackgroundJob("fal-bg:job-1"); ok {
		t.Fatal("standby job must not parse as RunPod")
	}
}

func TestVideoBackgroundRunpodMaxWorkers(t *testing.T) {
	t.Setenv("VIDEO_BACKGROUND_RUNPOD_MAX_WORKERS", "2")
	if got := videoBackgroundRunpodMaxWorkers(); got != 2 {
		t.Fatalf("configured workers = %d, want 2", got)
	}
	t.Setenv("VIDEO_BACKGROUND_RUNPOD_MAX_WORKERS", "0")
	if got := videoBackgroundRunpodMaxWorkers(); got != 3 {
		t.Fatalf("invalid configured workers = %d, want default 3", got)
	}
}

func TestVideoBackgroundRunpodReactivatesPausedEndpoint(t *testing.T) {
	var updates, submissions int
	upstream := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch {
		case request.Method == http.MethodGet && request.URL.Path == "/endpoints/background-endpoint":
			_ = json.NewEncoder(response).Encode(map[string]interface{}{"workersMax": 0})
		case request.Method == http.MethodPost && request.URL.Path == "/endpoints/background-endpoint/update":
			updates++
			response.WriteHeader(http.StatusOK)
			_, _ = response.Write([]byte(`{}`))
		case request.Method == http.MethodPost && request.URL.Path == "/background-endpoint/run":
			submissions++
			if submissions == 1 {
				response.WriteHeader(http.StatusConflict)
				_, _ = response.Write([]byte(`{"error":"ENDPOINT_PAUSED"}`))
				return
			}
			_ = json.NewEncoder(response).Encode(map[string]interface{}{"id": "job-1", "status": "IN_QUEUE"})
		default:
			http.NotFound(response, request)
		}
	}))
	defer upstream.Close()
	t.Setenv("H3_RUNPOD_API_KEY", "test-key")
	t.Setenv("H3_RUNPOD_CONTROL_URL", upstream.URL)
	t.Setenv("H3_RUNPOD_BASE_URL", upstream.URL)
	t.Setenv("VIDEO_BACKGROUND_RUNPOD_MAX_WORKERS", "2")
	h3ScaleLocks = sync.Map{}
	h3ScaleReapers = sync.Map{}
	state := &h3ScaleReaperState{running: true}
	h3ScaleReapers.Store("background-endpoint", state)
	previousDelay := h3ScalePropagationDelay
	h3ScalePropagationDelay = time.Millisecond
	t.Cleanup(func() {
		h3ScalePropagationDelay = previousDelay
		h3ScaleReapers.Delete("background-endpoint")
	})

	var queued h3RunpodQueuedJob
	status, err := submitScaledVideoBackgroundRunpod("background-endpoint", map[string]interface{}{"workload": "video-matting"}, &queued)
	if err != nil || status != http.StatusOK || queued.ID != "job-1" {
		t.Fatalf("submission = status %d job %q error %v", status, queued.ID, err)
	}
	if updates != 2 || submissions != 2 {
		t.Fatalf("control calls = %d updates, %d submissions; want 2, 2", updates, submissions)
	}
}

func TestVideoBackgroundResultDurationUsesProviderMetadata(t *testing.T) {
	payload := map[string]interface{}{"video": map[string]interface{}{"duration_seconds": 12.75}}
	if got := videoBackgroundResultDuration(payload); got != 12.75 {
		t.Fatalf("duration = %v, want 12.75", got)
	}
	if got := videoBackgroundResultDuration(map[string]interface{}{"video": map[string]interface{}{"url": "https://example.com/out.webm"}}); got != 0 {
		t.Fatalf("missing provider duration = %v, want 0", got)
	}
}

func TestVideoBackgroundCircuitOpensAndHalfOpenProbeCloses(t *testing.T) {
	now := time.Unix(100, 0)
	breaker := newH3CircuitBreaker(2, time.Minute)
	breaker.now = func() time.Time { return now }
	if breaker.failure("endpoint") || !breaker.failure("endpoint") || breaker.allow("endpoint") {
		t.Fatal("circuit did not open at its threshold")
	}
	now = now.Add(time.Minute)
	if !breaker.allow("endpoint") {
		t.Fatal("circuit did not allow its half-open probe")
	}
	breaker.success("endpoint")
	if !breaker.allow("endpoint") {
		t.Fatal("successful probe did not close circuit")
	}
}

func TestNativeCapacitySpillDoesNotOpenCircuit(t *testing.T) {
	previous := videoBackgroundCircuit
	videoBackgroundCircuit = newH3CircuitBreaker(2, time.Minute)
	t.Cleanup(func() { videoBackgroundCircuit = previous })

	recordVideoBackgroundNativeSubmissionFailure("native", 429)
	recordVideoBackgroundNativeSubmissionFailure("native", 429)
	if !videoBackgroundCircuit.allow("native") {
		t.Fatal("capacity spillover must not open the native health circuit")
	}

	recordVideoBackgroundNativeSubmissionFailure("native", 500)
	recordVideoBackgroundNativeSubmissionFailure("native", 500)
	if videoBackgroundCircuit.allow("native") {
		t.Fatal("real native failures must still open the circuit")
	}
}
