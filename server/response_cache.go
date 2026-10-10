package main

import (
	"bytes"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

const dynamicCompressMinBytes = 1024

type encodedBody struct {
	status       int
	contentType  []byte
	cacheControl []byte
	raw, gz, br  []byte
	built        time.Time
}

type responseCacheEntry struct {
	mu         sync.Mutex
	body       *encodedBody
	refreshing bool
}

type responseCache struct {
	ttl     time.Duration
	mu      sync.Mutex
	entries map[string]*responseCacheEntry
	now     func() time.Time
}

func newResponseCache(ttl time.Duration) *responseCache {
	return &responseCache{ttl: ttl, entries: map[string]*responseCacheEntry{}, now: time.Now}
}

var sitemapCache = newResponseCache(15 * time.Minute)

func (c *responseCache) entry(key string) *responseCacheEntry {
	c.mu.Lock()
	defer c.mu.Unlock()
	e := c.entries[key]
	if e == nil {
		e = &responseCacheEntry{}
		c.entries[key] = e
	}
	return e
}

func (c *responseCache) reset() {
	c.mu.Lock()
	c.entries = map[string]*responseCacheEntry{}
	c.mu.Unlock()
}

func renderEncoded(build fasthttp.RequestHandler, built time.Time) *encodedBody {
	var scratch fasthttp.RequestCtx
	build(&scratch)
	resp := &scratch.Response
	raw := append([]byte(nil), resp.Body()...)
	out := &encodedBody{
		status:       resp.StatusCode(),
		contentType:  append([]byte(nil), resp.Header.ContentType()...),
		cacheControl: append([]byte(nil), resp.Header.Peek("Cache-Control")...),
		raw:          raw,
		built:        built,
	}
	if len(raw) >= dynamicCompressMinBytes {
		out.gz = fasthttp.AppendGzipBytesLevel(nil, raw, fasthttp.CompressDefaultCompression)
		out.br = fasthttp.AppendBrotliBytesLevel(nil, raw, 5)
	}
	return out
}

func (c *responseCache) serve(ctx *fasthttp.RequestCtx, key string, build fasthttp.RequestHandler) {
	e := c.entry(key)
	e.mu.Lock()
	body := e.body
	if body == nil {
		body = renderEncoded(build, c.now())
		if body.status == fasthttp.StatusOK {
			e.body = body
		}
	} else if c.now().Sub(body.built) > c.ttl && !e.refreshing {
		e.refreshing = true
		go func() {
			fresh := renderEncoded(build, c.now())
			e.mu.Lock()
			if fresh.status == fasthttp.StatusOK {
				e.body = fresh
			}
			e.refreshing = false
			e.mu.Unlock()
		}()
	}
	e.mu.Unlock()
	writeEncoded(ctx, body)
}

func writeEncoded(ctx *fasthttp.RequestCtx, body *encodedBody) {
	ctx.SetStatusCode(body.status)
	ctx.Response.Header.SetContentTypeBytes(body.contentType)
	if len(body.cacheControl) > 0 {
		ctx.Response.Header.SetBytesV("Cache-Control", body.cacheControl)
	}
	ctx.Response.Header.Set("Vary", "Accept-Encoding")
	switch {
	case body.br != nil && ctx.Request.Header.HasAcceptEncoding("br"):
		ctx.Response.Header.SetContentEncoding("br")
		ctx.SetBody(body.br)
	case body.gz != nil && ctx.Request.Header.HasAcceptEncoding("gzip"):
		ctx.Response.Header.SetContentEncoding("gzip")
		ctx.SetBody(body.gz)
	default:
		ctx.SetBody(body.raw)
	}
}

func compressibleDynamicType(ct []byte) bool {
	return bytes.HasPrefix(ct, []byte("application/json")) ||
		bytes.HasPrefix(ct, []byte("application/xml")) ||
		bytes.HasPrefix(ct, []byte("text/"))
}

func compressDynamic(next fasthttp.RequestHandler) fasthttp.RequestHandler {
	return func(ctx *fasthttp.RequestCtx) {
		next(ctx)
		resp := &ctx.Response
		if resp.StatusCode() != fasthttp.StatusOK || resp.IsBodyStream() || len(resp.Header.ContentEncoding()) > 0 ||
			ctx.IsHead() || !compressibleDynamicType(resp.Header.ContentType()) {
			return
		}
		body := resp.Body()
		if len(body) < dynamicCompressMinBytes {
			return
		}
		var encoded []byte
		switch {
		case ctx.Request.Header.HasAcceptEncoding("gzip"):
			encoded = fasthttp.AppendGzipBytesLevel(nil, body, 5)
			resp.Header.SetContentEncoding("gzip")
		case ctx.Request.Header.HasAcceptEncoding("br"):
			encoded = fasthttp.AppendBrotliBytesLevel(nil, body, 1)
			resp.Header.SetContentEncoding("br")
		default:
			return
		}
		resp.SetBody(encoded)
		if vary := resp.Header.Peek("Vary"); !bytes.Contains(bytes.ToLower(vary), []byte("accept-encoding")) {
			if len(vary) == 0 {
				resp.Header.Set("Vary", "Accept-Encoding")
			} else {
				resp.Header.Set("Vary", string(vary)+", Accept-Encoding")
			}
		}
	}
}

type featuredKey struct {
	limit, offset int
	allowNSFW     bool
}

type featuredEntry struct {
	rows  []FeaturedVideo
	built time.Time
}

type featuredVideoCache struct {
	ttl     time.Duration
	mu      sync.Mutex
	entries map[featuredKey]featuredEntry
	load    func(limit, offset int, allowNSFW bool) ([]FeaturedVideo, error)
	now     func() time.Time
}

func (c *featuredVideoCache) list(limit, offset int, allowNSFW bool) ([]FeaturedVideo, error) {
	key := featuredKey{limit, offset, allowNSFW}
	c.mu.Lock()
	defer c.mu.Unlock()
	if e, ok := c.entries[key]; ok && c.now().Sub(e.built) < c.ttl {
		return e.rows, nil
	}
	rows, err := c.load(limit, offset, allowNSFW)
	if err != nil {
		return nil, err
	}
	if len(c.entries) > 256 {
		c.entries = map[featuredKey]featuredEntry{}
	}
	c.entries[key] = featuredEntry{rows: rows, built: c.now()}
	return rows, nil
}

var featuredCache *featuredVideoCache

func init() {
	featuredCache = &featuredVideoCache{ttl: time.Minute, entries: map[featuredKey]featuredEntry{}, load: listFeaturedVideos, now: time.Now}
	listFeaturedVideos = featuredCache.list
}
