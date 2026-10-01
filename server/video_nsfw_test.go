package main

import (
	"encoding/json"
	"strings"
	"testing"
)

const explicitPrompt = "Two consenting adults have explicit sex in a hotel room"

func setAdultLanes(t *testing.T, ltx, pink string) {
	t.Setenv("H3_LTX_RUNPOD_ENDPOINT", ltx)
	t.Setenv("H3_LTX_COG_URL", "")
	t.Setenv("H3_PINKCHERRY_RUNPOD_ENDPOINT", pink)
	t.Setenv("H3_PINKCHERRY_COG_URL", "")
	t.Setenv("H3_NORMAL_RUNPOD_ENDPOINT", "normal")
}

func TestH3RouteForRequestCapabilityFallback(t *testing.T) {
	setAdultLanes(t, "ltx", "pink")
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want string
	}{
		{"plain", ServiceUsageRequest{Prompt: explicitPrompt}, h3LtxVariant},
		{"last frame", ServiceUsageRequest{Prompt: explicitPrompt, LastFrame: "https://x/y.png"}, h3PinkCherryVariant},
		{"loop", ServiceUsageRequest{Prompt: explicitPrompt, Loop: true}, h3PinkCherryVariant},
		{"three keyframes", ServiceUsageRequest{Prompt: explicitPrompt, Keyframes: []string{"a", "b", "c"}}, h3PinkCherryVariant},
		{"two keyframes", ServiceUsageRequest{Prompt: explicitPrompt, Keyframes: []string{"a", "b"}}, h3LtxVariant},
		{"normal prompt with loop", ServiceUsageRequest{Prompt: "A glass hummingbird drinks from an orange flower", Loop: true}, h3NormalVariant},
	}
	for _, c := range cases {
		if got := h3RouteForRequest(c.req); got.Variant != c.want {
			t.Errorf("%s: variant %s want %s", c.name, got.Variant, c.want)
		}
	}
	if got := h3RouteForRequest(ServiceUsageRequest{Prompt: explicitPrompt, Loop: true}); got.RunpodEndpointID != "pink" {
		t.Errorf("pink endpoint = %q", got.RunpodEndpointID)
	}
}

func TestH3RouteForRequestWithoutPinkCherryKeepsLtx(t *testing.T) {
	setAdultLanes(t, "ltx", "")
	got := h3RouteForRequest(ServiceUsageRequest{Prompt: explicitPrompt, LastFrame: "https://x/y.png", Loop: true})
	if got.Variant != h3LtxVariant || got.RunpodEndpointID != "ltx" {
		t.Fatalf("route = %+v", got)
	}
}

func TestH3RouteForStoredJobReusesRecordedVariant(t *testing.T) {
	setAdultLanes(t, "ltx", "pink")
	stored := func(variant string) *VideoJob {
		raw, _ := json.Marshal(map[string]string{"_h3_variant": variant})
		return &VideoJob{Prompt: "A glass hummingbird drinks from an orange flower", Result: raw}
	}
	if got := h3RouteForStoredJob(stored(h3PinkCherryVariant)); got.Variant != h3PinkCherryVariant || got.RunpodEndpointID != "pink" {
		t.Errorf("pink stored = %+v", got)
	}
	if got := h3RouteForStoredJob(stored(h3LtxVariant)); got.Variant != h3LtxVariant || got.RunpodEndpointID != "ltx" {
		t.Errorf("ltx stored = %+v", got)
	}
	if got := h3RouteForStoredJob(stored("h3-max")); got.Variant != h3NormalVariant {
		t.Errorf("fallback = %+v", got)
	}
	if got := h3RouteForStoredJob(&VideoJob{Prompt: explicitPrompt}); got.Variant != h3LtxVariant {
		t.Errorf("no stored variant = %+v", got)
	}
	setAdultLanes(t, "", "pink")
	job := stored(h3LtxVariant)
	job.Prompt = explicitPrompt
	if got := h3RouteForStoredJob(job); got.Variant != h3PinkCherryVariant {
		t.Errorf("unconfigured stored lane = %+v", got)
	}
}

func TestMarkAdultVideoJob(t *testing.T) {
	orig := setVideoJobNSFW
	t.Cleanup(func() { setVideoJobNSFW = orig })
	marked := map[string]bool{}
	setVideoJobNSFW = func(id string, nsfw bool) error { marked[id] = nsfw; return nil }
	for id, variant := range map[string]string{"a": h3LtxVariant, "b": h3PinkCherryVariant, "c": h3NormalVariant, "d": "h3-max", "e": ""} {
		markAdultVideoJob(id, variant)
	}
	for _, id := range []string{"a", "b"} {
		if !marked[id] {
			t.Errorf("%s not marked", id)
		}
	}
	for _, id := range []string{"c", "d", "e"} {
		if _, ok := marked[id]; ok {
			t.Errorf("%s must stay unmarked", id)
		}
	}
}

func TestFeaturedVideosNSFWGating(t *testing.T) {
	stubUsers(t)
	orig := listFeaturedVideos
	t.Cleanup(func() { listFeaturedVideos = orig })
	var gotAllow bool
	listFeaturedVideos = func(limit, offset int, allow bool) ([]FeaturedVideo, error) {
		gotAllow = allow
		return []FeaturedVideo{{JobID: "v1", Prompt: "p", VideoURL: "u", IsNSFW: allow}}, nil
	}
	cases := []struct {
		name, uri, auth string
		allow           bool
		private         bool
	}{
		{"anonymous default", "/api/videos/featured", "", false, false},
		{"anonymous requests nsfw", "/api/videos/featured?allow_nsfw=true", "", false, true},
		{"opted out requests nsfw", "/api/videos/featured?allow_nsfw=true", "optout", false, true},
		{"opted in", "/api/videos/featured?allow_nsfw=true", "optin", true, true},
		{"opted in without flag", "/api/videos/featured", "optin", false, false},
	}
	for _, c := range cases {
		ctx := nsfwCtx(c.uri, c.auth)
		handleFeaturedVideos(ctx)
		if ctx.Response.StatusCode() != 200 || gotAllow != c.allow {
			t.Errorf("%s: status=%d allow=%v", c.name, ctx.Response.StatusCode(), gotAllow)
		}
		cc := string(ctx.Response.Header.Peek("Cache-Control"))
		if c.private != strings.HasPrefix(cc, "private") || (!c.private && !strings.HasPrefix(cc, "public")) {
			t.Errorf("%s: cache-control %q", c.name, cc)
		}
		if c.allow && !strings.Contains(string(ctx.Response.Body()), `"is_nsfw":true`) {
			t.Errorf("%s: is_nsfw missing: %s", c.name, ctx.Response.Body())
		}
	}
}

func TestVideoSearchNSFWGating(t *testing.T) {
	stubUsers(t)
	origEngine, origSearch := videoSearch, searchVideoPrompts
	t.Cleanup(func() { videoSearch, searchVideoPrompts = origEngine, origSearch })
	videoSearch = &VideoSearchEngine{ready: true}
	var gotAllow bool
	searchVideoPrompts = func(q string, topK int, allow bool) ([]SearchResult, error) {
		gotAllow = allow
		return []SearchResult{{JobID: "v1", Prompt: q, IsNSFW: allow}}, nil
	}
	cases := []struct {
		name, uri, auth string
		allow           bool
		private         bool
	}{
		{"anonymous default", "/api/search?q=x", "", false, false},
		{"anonymous requests nsfw", "/api/search?q=x&allow_nsfw=true", "", false, true},
		{"opted out requests nsfw", "/api/search?q=x&allow_nsfw=true", "optout", false, true},
		{"opted in", "/api/search?q=x&allow_nsfw=true", "optin", true, true},
	}
	for _, c := range cases {
		ctx := nsfwCtx(c.uri, c.auth)
		handleSemanticSearch(ctx)
		if ctx.Response.StatusCode() != 200 || gotAllow != c.allow {
			t.Errorf("%s: status=%d allow=%v", c.name, ctx.Response.StatusCode(), gotAllow)
		}
		cc := string(ctx.Response.Header.Peek("Cache-Control"))
		if c.private != strings.HasPrefix(cc, "private") || (!c.private && !strings.HasPrefix(cc, "public")) {
			t.Errorf("%s: cache-control %q", c.name, cc)
		}
	}
}

func TestMergeVideoResultsOrdersBySimilarity(t *testing.T) {
	safe := []SearchResult{{JobID: "s1", Similarity: 0.9}, {JobID: "s2", Similarity: 0.5}}
	flagged := []SearchResult{{JobID: "n1", Similarity: 0.7, IsNSFW: true}, {JobID: "n2", Similarity: 0.1, IsNSFW: true}}
	got := mergeVideoResults(safe, flagged, 3)
	ids := []string{}
	for _, r := range got {
		ids = append(ids, r.JobID)
	}
	if strings.Join(ids, ",") != "s1,n1,s2" {
		t.Fatalf("merged = %v", ids)
	}
}

func TestSearchVideoPromptsSFWOnlyWhenNotOptedIn(t *testing.T) {
	origSafe, origNSFW := videoSearch, videoSearchNSFW
	t.Cleanup(func() { videoSearch, videoSearchNSFW = origSafe, origNSFW })
	videoSearch = &VideoSearchEngine{}
	videoSearchNSFW = &VideoSearchEngine{nsfw: true, ready: true}
	got, err := searchVideoPrompts("x", 5, false)
	if err != nil || len(got) != 0 {
		t.Fatalf("sfw-only path: %v %v", got, err)
	}
}
