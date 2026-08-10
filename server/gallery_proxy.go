package main

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	galleryCDNHost      = "manifoldgenstatic.manifoldgen.com"
	galleryAssetMaxSize = 32 << 20
)

var galleryHTTPClient = &http.Client{Timeout: 30 * time.Second}

// handleGalleryAsset proxies only files from our public gallery bucket. Studio
// imports need the image bytes, and a same-origin request avoids depending on
// the bucket's CORS configuration (or an intermediary cache preserving it).
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
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		jsonError(ctx, fasthttp.StatusBadGateway, fmt.Sprintf("gallery asset returned %d", response.StatusCode))
		return
	}
	contentType := response.Header.Get("Content-Type")
	if !strings.HasPrefix(strings.ToLower(contentType), "image/") {
		jsonError(ctx, fasthttp.StatusBadGateway, "gallery asset is not an image")
		return
	}

	asset, err := io.ReadAll(io.LimitReader(response.Body, galleryAssetMaxSize+1))
	if err != nil || len(asset) == 0 || len(asset) > galleryAssetMaxSize {
		jsonError(ctx, fasthttp.StatusBadGateway, "gallery asset is empty or too large")
		return
	}

	ctx.Response.Header.SetContentType(contentType)
	ctx.Response.Header.Set("Cache-Control", "public, max-age=86400")
	ctx.SetStatusCode(fasthttp.StatusOK)
	ctx.SetBody(asset)
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
