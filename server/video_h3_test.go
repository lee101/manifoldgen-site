package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestH3RouteUsesDedicatedPinkCherryWorkerForExplicitAdultPrompt(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal-endpoint")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink-endpoint")
	route := h3RouteForPrompt("Two consenting adults have explicit sex in a hotel room")
	if route.Variant != h3PinkCherryVariant || route.RunpodEndpointID != "pink-endpoint" {
		t.Fatalf("explicit route = %#v", route)
	}
}

func TestH3RouteKeepsNormalPromptOnNormalWorker(t *testing.T) {
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal-endpoint")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", "pink-endpoint")
	route := h3RouteForPrompt("A glass hummingbird drinks from an orange flower, gentle camera push-in")
	if route.Variant != h3NormalVariant || route.RunpodEndpointID != "normal-endpoint" {
		t.Fatalf("normal route = %#v", route)
	}
}

func TestParseRunpodH3ProviderJob(t *testing.T) {
	endpoint, job, ok := parseRunpodH3ProviderJob("runpod:endpoint-1:job-1")
	if !ok || endpoint != "endpoint-1" || job != "job-1" {
		t.Fatalf("parse = %q %q %t", endpoint, job, ok)
	}
	if _, _, ok := parseRunpodH3ProviderJob("local:sync"); ok {
		t.Fatal("local job must not parse as RunPod")
	}
}

func TestNormalizeH3VideoRequestDefaults(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "neon alley rain"}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Size != "balanced" || req.NumSteps != 20 || req.Quant != "int8_convrot" {
		t.Fatalf("defaults = size=%s steps=%d quant=%s", req.Size, req.NumSteps, req.Quant)
	}
	if req.AspectRatio != "16:9" || req.OutputFormat != "webm-av1" {
		t.Fatalf("aspect/format = %s %s", req.AspectRatio, req.OutputFormat)
	}
}

func TestNormalizeH3AudioSizeAllowsLongDuration(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "soft rain ambience", Size: "audio", Duration: 45}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatal(err)
	}
	req.Duration = 46
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("expected duration reject for audio>45")
	}
	req = ServiceUsageRequest{Prompt: "x", Size: "balanced", Duration: 30}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatalf("expected chained duration 30 to be allowed: %v", err)
	}
	req = ServiceUsageRequest{Prompt: "x", Size: "balanced", Duration: 61}
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("expected duration reject for balanced>60")
	}
}

func TestH3AudioJobIsNotGalleryEligible(t *testing.T) {
	request, err := json.Marshal(map[string]interface{}{
		"_h3_request": map[string]interface{}{"size": "audio"},
	})
	if err != nil {
		t.Fatal(err)
	}
	if !h3AudioJob(&VideoJob{Service: "h3_video", Result: request}) {
		t.Fatal("expected H3 audio request to be detected")
	}
	if h3AudioJob(&VideoJob{Service: "h3_video", Result: []byte(`{"_h3_request":{"size":"balanced"}}`)}) {
		t.Fatal("video request must remain gallery eligible")
	}
	if !h3AudioJob(&VideoJob{Service: "h3_video", Result: []byte(`{"size":"audio"}`)}) {
		t.Fatal("normalized direct audio request must be detected")
	}
	if !h3AudioJob(&VideoJob{Service: "sfx_generation"}) {
		t.Fatal("public SFX jobs must always be treated as audio")
	}
}

func TestPrepareH3AudioResultUsesPublicAudioShape(t *testing.T) {
	job := &VideoJob{
		ID: "video_123", UserID: "user_1", Service: "sfx_generation", Prompt: "crackling campfire",
		Result: json.RawMessage(`{"size":"audio","duration":10}`),
	}
	prepared := prepareH3AudioResult(job, []byte(`{"video_url":"https://media.example/sound.webm","provider":"internal"}`))
	var result map[string]interface{}
	if err := json.Unmarshal(prepared, &result); err != nil {
		t.Fatal(err)
	}
	if result["audio_id"] != "audio_123" || result["audio_url"] != "https://media.example/sound.webm" || result["kind"] != "sfx" {
		t.Fatalf("unexpected audio result: %#v", result)
	}
	if result["duration_seconds"] != float64(10) {
		t.Fatalf("duration = %#v", result["duration_seconds"])
	}
	job.Result = prepared
	public := publicVideoJob(job)
	if public.Service != "sfx" {
		t.Fatalf("public service = %q", public.Service)
	}
	result = nil
	if err := json.Unmarshal(public.Result, &result); err != nil {
		t.Fatal(err)
	}
	if result["audio_url"] == nil || result["video_url"] != nil || result["provider"] != nil {
		t.Fatalf("public SFX result leaked video/provider shape: %#v", result)
	}
}

func TestH3AudioRequestsUseSFXJobService(t *testing.T) {
	if got := h3JobService(ServiceUsageRequest{Service: "h3_video", Size: "audio"}); got != "sfx_generation" {
		t.Fatalf("audio job service = %q", got)
	}
	if got := h3JobService(ServiceUsageRequest{Service: "h3_video", Size: "balanced"}); got != "h3_video" {
		t.Fatalf("video job service = %q", got)
	}
	if got := h3StatusURL(ServiceUsageRequest{Service: "sfx_generation", Size: "audio"}, "video_123"); got != "/api/audio-jobs/video_123" {
		t.Fatalf("SFX status URL = %q", got)
	}
	if got := publicJobStatusURL(&VideoJob{ID: "video_123", Service: "sfx_generation"}); got != "/api/audio-jobs/video_123" {
		t.Fatalf("public SFX status URL = %q", got)
	}
}

func TestH3RunpodQueueTimeout(t *testing.T) {
	t.Setenv("H3_RUNPOD_QUEUE_TIMEOUT", "90s")
	if got := h3RunpodQueueTimeout(); got != 90*time.Second {
		t.Fatalf("configured queue timeout = %s", got)
	}
	t.Setenv("H3_RUNPOD_QUEUE_TIMEOUT", "invalid")
	if got := h3RunpodQueueTimeout(); got != h3RunpodQueueTimeoutDefault {
		t.Fatalf("invalid queue timeout fallback = %s", got)
	}
}

func TestLocalH3WorkerReadyRequiresSuccessfulHealthCheck(t *testing.T) {
	ready := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/health-check" {
			t.Fatalf("health path = %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"READY"}`))
	}))
	defer ready.Close()
	if !localH3WorkerReady(ready.URL + "/") {
		t.Fatal("healthy local worker was not detected")
	}

	unavailable := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "starting", http.StatusServiceUnavailable)
	}))
	defer unavailable.Close()
	if localH3WorkerReady(unavailable.URL) {
		t.Fatal("unavailable local worker must not receive a fallback job")
	}
	if localH3WorkerReady("") {
		t.Fatal("empty local worker URL must not be ready")
	}
}

func TestPublicVideoGenerationErrorsHideProviderDetails(t *testing.T) {
	for _, message := range []string{
		videoGenerationFailedMessage,
		videoGenerationUnavailableMessage,
		videoGenerationTimedOutMessage,
	} {
		lower := strings.ToLower(message)
		for _, internal := range []string{"h3", "runpod", "cog", "local"} {
			if strings.Contains(lower, internal) {
				t.Fatalf("public error %q leaked %q", message, internal)
			}
		}
	}
}

func TestPublicVideoJobRemovesProviderDetails(t *testing.T) {
	job := &VideoJob{Service: "h3_video", Status: "failed", Error: `local H3 sync predict: connection refused`, ProviderCost: 1.2, ChargedUSD: 1.8, CreditsUsed: 180, Result: json.RawMessage(`{"_h3_variant":"normal-h3","provider":"runpod","provider_cost_usd":1.2,"metrics":{"quant":"internal"},"video_url":"https://media.example/video.webm"}`)}
	public := publicVideoJob(job)
	if public.Service != "video" {
		t.Fatalf("public service = %q", public.Service)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(public.Result, &result); err != nil {
		t.Fatal(err)
	}
	if _, ok := result["_h3_variant"]; ok {
		t.Fatal("internal variant leaked")
	}
	if _, ok := result["provider"]; ok {
		t.Fatal("provider leaked")
	}
	if public.ProviderCost != 0 || result["metrics"] != nil {
		t.Fatalf("provider diagnostics leaked: job=%#v result=%#v", public, result)
	}
	if public.Error != videoGenerationFailedMessage {
		t.Fatalf("provider error leaked: %q", public.Error)
	}
	payment := publicVideoJob(&VideoJob{Service: "h3_video", Status: "payment_required", Error: "top up to release completed video"})
	if payment.Error != "top up to release completed video" {
		t.Fatalf("payment guidance was hidden: %q", payment.Error)
	}
	if result["charged_usd"] != 1.8 || result["credits_used"] != float64(180) {
		t.Fatalf("customer settlement missing: %#v", result)
	}
	if result["video_url"] == nil {
		t.Fatal("public video URL was removed")
	}
}

func TestPaymentRequiredJobIsTerminalForInference(t *testing.T) {
	job := &VideoJob{Status: "payment_required", Result: json.RawMessage(`{"video_url":"https://media.example/done.webm"}`)}
	if job.Status == "queued" || job.Status == "processing" {
		t.Fatal("payment-required result must never relaunch inference")
	}
}

func TestDecodeVideoDataURL(t *testing.T) {
	artifact, err := decodeVideoDataURL("data:video/webm;base64,AAEC")
	if err != nil || !bytes.Equal(artifact, []byte{0, 1, 2}) {
		t.Fatalf("decoded artifact = %v, err=%v", artifact, err)
	}
	if _, err := decodeVideoDataURL("https://media.example/video.webm"); err == nil {
		t.Fatal("expected non-data URL to be rejected")
	}
}

func TestShouldRelaunchVideoJobDoesNotReplayProcessingLocalCog(t *testing.T) {
	processingLocal := &VideoJob{Status: "processing", ProviderJobID: "local:sync"}
	if shouldRelaunchVideoJob(processingLocal) {
		t.Fatal("processing local Cog job must not be replayed by status polling")
	}
	queuedLocal := &VideoJob{Status: "queued", ProviderJobID: "local:sync"}
	if !shouldRelaunchVideoJob(queuedLocal) {
		t.Fatal("queued local Cog job must remain recoverable")
	}
	processingRunPod := &VideoJob{Status: "processing", ProviderJobID: "runpod:endpoint:job"}
	if !shouldRelaunchVideoJob(processingRunPod) {
		t.Fatal("processing durable provider job must remain recoverable")
	}
}

func TestNormalizeH3DrivingAudioRequiresImage(t *testing.T) {
	req := ServiceUsageRequest{Prompt: "portrait speaking", AudioURL: "https://cdn.example/voice.wav"}
	if err := normalizeH3VideoRequest(&req); err == nil {
		t.Fatal("expected driving audio without a first frame to be rejected")
	}
	req.ImageURL = "https://cdn.example/portrait.png"
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatalf("expected image plus driving audio to be accepted: %v", err)
	}
	input := appNZH3Input(req)
	if input["first_frame"] != req.ImageURL || input["audio"] != req.AudioURL {
		t.Fatalf("asset input = %#v", input)
	}
}

func TestH3ArtifactFormat(t *testing.T) {
	extension, contentType := h3ArtifactFormat("video/mp4; charset=binary")
	if extension != "mp4" || contentType != "video/mp4" {
		t.Fatalf("mp4 format = %q %q", extension, contentType)
	}
	extension, contentType = h3ArtifactFormat("application/octet-stream")
	if extension != "webm" || contentType != "video/webm" {
		t.Fatalf("fallback format = %q %q", extension, contentType)
	}
}

func TestVideoDataURLContentType(t *testing.T) {
	if got := videoDataURLContentType("data:video/mp4;base64,AAAA"); got != "video/mp4" {
		t.Fatalf("mp4 content type = %q", got)
	}
	if got := videoDataURLContentType("data:video/webm;base64,AAAA"); got != "video/webm" {
		t.Fatalf("webm content type = %q", got)
	}
}

func TestNormalizeH3OrderedKeyframesPreservesSequence(t *testing.T) {
	req := ServiceUsageRequest{
		Service: "h3_video", Prompt: "move through all three moments", Duration: 5,
		Keyframes: []string{
			" https://cdn.example/start.png ",
			"https://cdn.example/middle.png",
			"https://cdn.example/stop.png",
		},
	}
	if err := normalizeH3VideoRequest(&req); err != nil {
		t.Fatalf("normalize ordered keyframes: %v", err)
	}
	if req.FirstFrame != "https://cdn.example/start.png" || req.LastFrame != "https://cdn.example/stop.png" {
		t.Fatalf("first/last = %q/%q", req.FirstFrame, req.LastFrame)
	}
	input := appNZH3Input(req)
	frames, ok := input["keyframes"].([]string)
	if !ok || len(frames) != 3 || frames[1] != "https://cdn.example/middle.png" {
		t.Fatalf("keyframes = %#v", input["keyframes"])
	}
}

func TestNormalizeH3OrderedKeyframesRejectsIncompatibleModes(t *testing.T) {
	base := ServiceUsageRequest{
		Service: "h3_video", Prompt: "transition", Duration: 5,
		Keyframes: []string{"https://cdn.example/start.png", "https://cdn.example/stop.png"},
	}
	withLoop := base
	withLoop.Loop = true
	if err := normalizeH3VideoRequest(&withLoop); err == nil {
		t.Fatal("multiple keyframes with loop should fail")
	}
	withAudio := base
	withAudio.AudioURL = "https://cdn.example/drive.wav"
	if err := normalizeH3VideoRequest(&withAudio); err == nil {
		t.Fatal("multiple keyframes with driving audio should fail")
	}
	tooLong := base
	tooLong.Keyframes = append(tooLong.Keyframes, "https://cdn.example/third.png")
	tooLong.Duration = 16
	if err := normalizeH3VideoRequest(&tooLong); err == nil {
		t.Fatal("ordered keyframes over 15 seconds per transition should fail")
	}
}
func TestIsRunPodWorkersQuotaErr(t *testing.T) {
	if !isRunPodWorkersQuotaErr(fmtError("serverless: Max workers across all endpoints must not exceed your workers quota (5)")) {
		t.Fatal("expected quota match")
	}
	if isRunPodWorkersQuotaErr(fmtError("model not found")) {
		t.Fatal("did not expect quota match")
	}
}

func TestH3DownstreamPricingHasMarginAndMinimum(t *testing.T) {
	if got := h3DownstreamMicros(1); got != h3MinimumChargeMicros {
		t.Fatalf("minimum charge = %d, want %d", got, h3MinimumChargeMicros)
	}
	if got := h3DownstreamMicros(1_000_000); got != 1_500_000 {
		t.Fatalf("$1 provider charge = %d micros, want 1500000", got)
	}
}

func TestH3VideoPricingTiersExposeResolutionAndDurationMatrix(t *testing.T) {
	tiers := h3VideoPricingTiers()
	if len(tiers) != 3 {
		t.Fatalf("tiers = %d, want 3", len(tiers))
	}
	if tiers[0].Size != "preview" || tiers[0].Resolution16x9 != "1024 × 576" {
		t.Fatalf("preview tier = %#v", tiers[0])
	}
	if tiers[1].Size != "balanced" || tiers[1].Resolution16x9 != "1184 × 672" {
		t.Fatalf("balanced tier = %#v", tiers[1])
	}
	if tiers[2].Size != "native" || tiers[2].Resolution16x9 != "1344 × 768" {
		t.Fatalf("native tier = %#v", tiers[2])
	}
	for _, tier := range tiers {
		if len(tier.Prices) != 5 || tier.Prices[0].DurationSeconds != 5 || tier.Prices[4].DurationSeconds != 60 {
			t.Fatalf("%s price matrix = %#v", tier.Size, tier.Prices)
		}
	}
	if got := tiers[0].Prices[0].PriceUSD; got != 0.46 {
		t.Fatalf("5s preview = %.2f, want 0.46", got)
	}
	if got := tiers[1].Prices[1].PriceUSD; got != 1.42 {
		t.Fatalf("10s balanced = %.2f, want 1.42", got)
	}
	if got := tiers[2].Prices[4].PriceUSD; got != 12.10 {
		t.Fatalf("60s native = %.2f, want 12.10", got)
	}
}

func TestPublicServiceNamesMapToInternalCapabilities(t *testing.T) {
	for _, alias := range publicServiceAliases {
		if got := requestedServiceName(alias.Public); got != alias.Internal {
			t.Fatalf("requestedServiceName(%q) = %q, want %q", alias.Public, got, alias.Internal)
		}
		if got := publicServiceName(alias.Internal); got != alias.Public {
			t.Fatalf("publicServiceName(%q) = %q, want %q", alias.Internal, got, alias.Public)
		}
	}
	if got := requestedServiceName("tts"); got != "tts" {
		t.Fatalf("unrelated service changed to %q", got)
	}
}

type fmtError string

func (e fmtError) Error() string { return string(e) }
