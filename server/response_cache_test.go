package main

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/valyala/fasthttp"
)

func cachedXMLBuilder(calls *int32, body string) fasthttp.RequestHandler {
	return func(ctx *fasthttp.RequestCtx) {
		atomic.AddInt32(calls, 1)
		setXML(ctx)
		ctx.SetBodyString(body)
	}
}

func TestResponseCacheServesPrecompressedBodies(t *testing.T) {
	c := newResponseCache(time.Hour)
	var calls int32
	payload := strings.Repeat("<url><loc>https://manifoldgen.com/</loc></url>", 200)
	build := cachedXMLBuilder(&calls, payload)

	for _, enc := range []string{"br", "gzip", ""} {
		ctx := &fasthttp.RequestCtx{}
		if enc != "" {
			ctx.Request.Header.Set("Accept-Encoding", enc)
		}
		c.serve(ctx, "k", build)
		if got := string(ctx.Response.Header.ContentEncoding()); got != enc {
			t.Fatalf("encoding=%q want %q", got, enc)
		}
		body, err := ctx.Response.BodyUncompressed()
		if err != nil || string(body) != payload {
			t.Fatalf("roundtrip failed for %q: %v", enc, err)
		}
		if !strings.HasPrefix(string(ctx.Response.Header.ContentType()), "application/xml") {
			t.Fatalf("content type lost: %s", ctx.Response.Header.ContentType())
		}
		if string(ctx.Response.Header.Peek("Cache-Control")) != "public, max-age=300, s-maxage=900" {
			t.Fatalf("cache-control lost")
		}
	}
	if calls != 1 {
		t.Fatalf("builder ran %d times, want 1", calls)
	}
}

func TestResponseCacheRefreshesStaleInBackground(t *testing.T) {
	c := newResponseCache(time.Minute)
	now := time.Unix(1000, 0)
	c.now = func() time.Time { return now }
	var calls int32
	build := cachedXMLBuilder(&calls, "<a/>")
	c.serve(&fasthttp.RequestCtx{}, "k", build)
	now = now.Add(2 * time.Minute)
	c.serve(&fasthttp.RequestCtx{}, "k", build)
	deadline := time.Now().Add(2 * time.Second)
	for atomic.LoadInt32(&calls) < 2 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if atomic.LoadInt32(&calls) != 2 {
		t.Fatalf("stale entry was not refreshed")
	}
}

func TestResponseCacheDoesNotKeepErrors(t *testing.T) {
	c := newResponseCache(time.Hour)
	var calls int32
	build := func(ctx *fasthttp.RequestCtx) {
		atomic.AddInt32(&calls, 1)
		ctx.SetStatusCode(500)
	}
	c.serve(&fasthttp.RequestCtx{}, "k", build)
	c.serve(&fasthttp.RequestCtx{}, "k", build)
	if calls != 2 {
		t.Fatalf("error response was cached")
	}
}

func runCompressed(t *testing.T, accept, contentType, vary string, body []byte, preEncoded bool) *fasthttp.RequestCtx {
	t.Helper()
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.Header.Set("Accept-Encoding", accept)
	compressDynamic(func(ctx *fasthttp.RequestCtx) {
		ctx.Response.Header.SetContentType(contentType)
		if vary != "" {
			ctx.Response.Header.Set("Vary", vary)
		}
		if preEncoded {
			ctx.Response.Header.SetContentEncoding("br")
		}
		ctx.SetBody(body)
	})(ctx)
	return ctx
}

func TestCompressDynamicJSON(t *testing.T) {
	body := []byte(`{"images":[` + strings.Repeat(`{"id":"x","prompt":"a cliffside observatory"},`, 100) + `{}]}`)
	ctx := runCompressed(t, "gzip, deflate, br", "application/json", "Authorization", body, false)
	if string(ctx.Response.Header.ContentEncoding()) != "gzip" {
		t.Fatalf("json not gzip encoded")
	}
	if got, _ := ctx.Response.BodyUncompressed(); string(got) != string(body) {
		t.Fatalf("roundtrip mismatch")
	}
	if len(ctx.Response.Body()) >= len(body)/4 {
		t.Fatalf("weak compression %d/%d", len(ctx.Response.Body()), len(body))
	}
	if v := string(ctx.Response.Header.Peek("Vary")); v != "Authorization, Accept-Encoding" {
		t.Fatalf("vary=%q", v)
	}
	ctx = runCompressed(t, "br", "application/json", "", body, false)
	if string(ctx.Response.Header.ContentEncoding()) != "br" || string(ctx.Response.Header.Peek("Vary")) != "Accept-Encoding" {
		t.Fatalf("br fallback missing")
	}
	if got, _ := ctx.Response.BodyUncompressed(); string(got) != string(body) {
		t.Fatalf("br roundtrip mismatch")
	}
}

func TestCompressDynamicSkips(t *testing.T) {
	big := []byte(strings.Repeat("a", 4096))
	cases := []struct {
		name, accept, ct string
		body             []byte
		pre              bool
	}{
		{"small", "br", "application/json", []byte(`{"count":1}`), false},
		{"binary", "br", "image/webp", big, false},
		{"preencoded", "br", "text/html", big, true},
		{"no-accept", "", "application/json", big, false},
	}
	for _, tc := range cases {
		ctx := runCompressed(t, tc.accept, tc.ct, "", tc.body, tc.pre)
		enc := string(ctx.Response.Header.ContentEncoding())
		if (tc.pre && enc != "br") || (!tc.pre && enc != "") || string(ctx.Response.Body()) != string(tc.body) {
			t.Fatalf("%s: unexpected re-encoding %q", tc.name, enc)
		}
	}
}

func TestFeaturedVideoCacheTTL(t *testing.T) {
	now := time.Unix(1000, 0)
	var calls int
	c := &featuredVideoCache{ttl: time.Minute, entries: map[featuredKey]featuredEntry{}, now: func() time.Time { return now },
		load: func(limit, offset int, allow bool) ([]FeaturedVideo, error) {
			calls++
			return []FeaturedVideo{{JobID: "a"}}, nil
		}}
	c.list(13, 0, false)
	c.list(13, 0, false)
	c.list(13, 0, true)
	if calls != 2 {
		t.Fatalf("calls=%d want 2", calls)
	}
	now = now.Add(2 * time.Minute)
	c.list(13, 0, false)
	if calls != 3 {
		t.Fatalf("expired entry not reloaded")
	}
}
