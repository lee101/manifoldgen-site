package main

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	galleryCDNHost = "manifoldgenstatic.manifoldgen.com"
	// Studio can retain original timeline clips locally, not merely a tiny
	// thumbnail. Stream them through the CORS-safe proxy rather than reading a
	// whole video into backend RAM; the cap still prevents a bad object from
	// turning one import into an unbounded transfer.
	galleryAssetMaxSize = 512 << 20
)

var galleryHTTPClient = &http.Client{Timeout: 5 * time.Minute}

// handleGalleryAsset proxies image, video, and audio files from our public
// gallery bucket. Studio imports need the media bytes, and a same-origin
// request avoids depending on the bucket's CORS configuration (including www
// vs apex origin).
func handleGalleryAsset(ctx *fasthttp.RequestCtx) {
	objectKey := strings.TrimPrefix(string(ctx.Path()), "/api/gallery-assets/")
	if !validGalleryObjectKey(objectKey) {
		jsonError(ctx, fasthttp.StatusBadRequest, "invalid gallery asset path")
		return
	}

	request, err := http.NewRequest(http.MethodGet, "https://"+galleryCDNHost+"/gallery/"+objectKey, nil)
	if err != nil {
		jsonError(ctx, fasthttp.StatusInternalServerError, "could not request gallery asset")
		return
	}
	response, err := galleryHTTPClient.Do(request)
	if err != nil {
		jsonError(ctx, fasthttp.StatusBadGateway, "could not load gallery asset")
		return
	}
	if response.StatusCode != http.StatusOK {
		response.Body.Close()
		jsonError(ctx, fasthttp.StatusBadGateway, fmt.Sprintf("gallery asset returned %d", response.StatusCode))
		return
	}
	contentType := response.Header.Get("Content-Type")
	mediaType := strings.ToLower(contentType)
	if !strings.HasPrefix(mediaType, "image/") && !strings.HasPrefix(mediaType, "video/") && !strings.HasPrefix(mediaType, "audio/") {
		response.Body.Close()
		jsonError(ctx, fasthttp.StatusBadGateway, "gallery asset is not supported media")
		return
	}
	if response.ContentLength <= 0 || response.ContentLength > galleryAssetMaxSize {
		response.Body.Close()
		jsonError(ctx, fasthttp.StatusBadGateway, "gallery asset is empty or too large")
		return
	}

	ctx.Response.Header.SetContentType(contentType)
	// Object keys are immutable Studio media IDs, so this browser cache entry
	// survives project reloads while IndexedDB keeps the authoritative local
	// File used by playback.
	ctx.Response.Header.Set("Cache-Control", "public, max-age=31536000, immutable")
	ctx.SetStatusCode(fasthttp.StatusOK)
	// fasthttp closes response.Body after it has copied the stream to the
	// browser. The known length is validated above, so this remains bounded
	// without buffering a full source video in the backend process.
	ctx.SetBodyStream(response.Body, int(response.ContentLength))
}

func validGalleryObjectKey(key string) bool {
	if key == "" || len(key) > 1024 || strings.ContainsAny(key, "\\?") || strings.Contains(key, "//") {
		return false
	}
	for _, segment := range strings.Split(key, "/") {
		if segment == "" || segment == "." || segment == ".." {
			return false
		}
		for _, character := range segment {
			if !((character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') || (character >= '0' && character <= '9') || character == '.' || character == '_' || character == '-') {
				return false
			}
		}
	}
	return true
}
