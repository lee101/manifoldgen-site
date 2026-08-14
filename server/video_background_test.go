package main

import (
	"math"
	"strings"
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

func TestFalVideoBackgroundUsesReturnedRequestNamespace(t *testing.T) {
	got := falVideoBackgroundRequestBase("request/with spaces")
	if !strings.HasPrefix(got, "https://queue.fal.run/bria/video/requests/") {
		t.Fatalf("unexpected FAL request base: %s", got)
	}
	if strings.Contains(got, "background-removal/requests") {
		t.Fatalf("submission namespace cannot be used for status polling: %s", got)
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

func TestParseRunpodVideoBackgroundJob(t *testing.T) {
	endpoint, job, ok := parseRunpodVideoBackgroundJob("runpod-bg:endpoint-1:job-1")
	if !ok || endpoint != "endpoint-1" || job != "job-1" {
		t.Fatalf("parse = %q %q %t", endpoint, job, ok)
	}
	if _, _, ok := parseRunpodVideoBackgroundJob("fal-bg:job-1"); ok {
		t.Fatal("standby job must not parse as RunPod")
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
