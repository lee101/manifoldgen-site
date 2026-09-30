package main

import (
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/valyala/fasthttp"
)

func TestValidGalleryObjectKey(t *testing.T) {
	for _, key := range []string{"originals/art.webp", "nested/2026/art-01.png"} {
		if !validGalleryObjectKey(key) {
			t.Fatalf("expected %q to be accepted", key)
		}
	}
	for _, key := range []string{"", "../secret", "originals/../../secret", "originals/a b.webp", "https://example.com/image.webp", "originals/a.webp?x=1"} {
		if validGalleryObjectKey(key) {
			t.Fatalf("expected %q to be rejected", key)
		}
	}
}

type galleryRoundTripper func(*http.Request) (*http.Response, error)

func (fn galleryRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func proxyGallery(t *testing.T, rangeHeader string, upstream func(*http.Request) *http.Response) *fasthttp.RequestCtx {
	t.Helper()
	previous := galleryHTTPClient.Transport
	galleryHTTPClient.Transport = galleryRoundTripper(func(request *http.Request) (*http.Response, error) {
		return upstream(request), nil
	})
	t.Cleanup(func() { galleryHTTPClient.Transport = previous })
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.SetRequestURI("/api/gallery-assets/originals/clip.mp4")
	if rangeHeader != "" {
		ctx.Request.Header.Set("Range", rangeHeader)
	}
	handleGalleryAsset(ctx)
	return ctx
}

func TestGalleryAssetForwardsRange(t *testing.T) {
	var seen string
	ctx := proxyGallery(t, "bytes=0-3", func(request *http.Request) *http.Response {
		seen = request.Header.Get("Range")
		header := http.Header{"Content-Type": {"video/mp4"}, "Content-Range": {"bytes 0-3/10"}}
		return &http.Response{StatusCode: http.StatusPartialContent, Header: header, ContentLength: 4, Body: io.NopCloser(strings.NewReader("abcd"))}
	})
	if seen != "bytes=0-3" {
		t.Fatalf("upstream range = %q", seen)
	}
	if ctx.Response.StatusCode() != fasthttp.StatusPartialContent {
		t.Fatalf("status = %d", ctx.Response.StatusCode())
	}
	if got := string(ctx.Response.Header.Peek("Content-Range")); got != "bytes 0-3/10" {
		t.Fatalf("content-range = %q", got)
	}
	if got := string(ctx.Response.Header.Peek("Accept-Ranges")); got != "bytes" {
		t.Fatalf("accept-ranges = %q", got)
	}
	if got := string(ctx.Response.Body()); got != "abcd" {
		t.Fatalf("body = %q", got)
	}
}

func TestGalleryAssetFullResponseAdvertisesRanges(t *testing.T) {
	ctx := proxyGallery(t, "", func(request *http.Request) *http.Response {
		if request.Header.Get("Range") != "" {
			t.Fatalf("unexpected upstream range %q", request.Header.Get("Range"))
		}
		header := http.Header{"Content-Type": {"video/mp4"}}
		return &http.Response{StatusCode: http.StatusOK, Header: header, ContentLength: 4, Body: io.NopCloser(strings.NewReader("abcd"))}
	})
	if ctx.Response.StatusCode() != fasthttp.StatusOK {
		t.Fatalf("status = %d", ctx.Response.StatusCode())
	}
	if got := string(ctx.Response.Header.Peek("Accept-Ranges")); got != "bytes" {
		t.Fatalf("accept-ranges = %q", got)
	}
}

func TestGalleryAssetRejectsNonMedia(t *testing.T) {
	ctx := proxyGallery(t, "", func(*http.Request) *http.Response {
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"text/html"}}, ContentLength: 4, Body: io.NopCloser(strings.NewReader("<b/>"))}
	})
	if ctx.Response.StatusCode() != fasthttp.StatusBadGateway {
		t.Fatalf("status = %d", ctx.Response.StatusCode())
	}
}
