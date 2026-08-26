package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/lee101/gobed"

	"github.com/valyala/fasthttp"
)

// BlogSearchEngine indexes ManifoldGen blog articles for semantic search.
// Article text is generated into the static export (blog/search-index.json)
// at frontend build time; the server embeds it with the shared gobed model
// alongside the image/video/audio indexes.
type BlogSearchEngine struct {
	engine    *gobed.SearchEngine
	model     *gobed.EmbeddingModel
	posts     []BlogPost
	mu        sync.RWMutex
	ready     bool
	indexing  bool
	indexedAt time.Time
}

// BlogPost is one entry of the generated search index.
type BlogPost struct {
	Slug     string `json:"slug"`
	Title    string `json:"title"`
	Excerpt  string `json:"excerpt"`
	Category string `json:"category"`
	Date     string `json:"date"`
	Text     string `json:"text"`
}

// BlogSearchResult is a ranked blog post hit.
type BlogSearchResult struct {
	Slug       string  `json:"slug"`
	Title      string  `json:"title"`
	Excerpt    string  `json:"excerpt"`
	Category   string  `json:"category"`
	Date       string  `json:"date"`
	URL        string  `json:"url"`
	Similarity float32 `json:"similarity"`
}

var blogSearch *BlogSearchEngine

func blogSearchIndexPath() string {
	return filepath.Join(getEnv("DIST_DIR", "../frontend/out"), "blog", "search-index.json")
}

func (bs *BlogSearchEngine) loadAndIndex() {
	bs.mu.Lock()
	if bs.indexing {
		bs.mu.Unlock()
		return
	}
	bs.indexing = true
	bs.mu.Unlock()
	defer func() {
		bs.mu.Lock()
		bs.indexing = false
		bs.mu.Unlock()
	}()

	t0 := time.Now()
	raw, err := os.ReadFile(blogSearchIndexPath())
	if err != nil {
		log.Printf("[blog-search] index file unavailable: %v", err)
		return
	}
	var posts []BlogPost
	if err := json.Unmarshal(raw, &posts); err != nil {
		log.Printf("[blog-search] parse index: %v", err)
		return
	}
	if len(posts) == 0 {
		log.Printf("[blog-search] index file empty")
		return
	}

	model, err := loadSharedSearchModel()
	if err != nil {
		log.Printf("[blog-search] gobed model load failed: %v", err)
		return
	}

	texts := make([]string, len(posts))
	for i, post := range posts {
		texts[i] = post.Title + "\n" + post.Category + "\n" + post.Excerpt + "\n" + post.Text
	}

	engine := gobed.NewAutoSearchEngine(model)
	ids := make([]int, len(texts))
	for i := range ids {
		ids[i] = i
	}
	if err := engine.IndexBatchWithIDs(ids, texts); err != nil {
		_ = engine.Close()
		log.Printf("[blog-search] index build failed: %v", err)
		return
	}

	bs.mu.Lock()
	old := bs.engine
	bs.engine = engine
	bs.model = model
	bs.posts = posts
	bs.ready = true
	bs.indexedAt = time.Now()
	bs.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
	log.Printf("[blog-search] Ready: %d posts in %v", len(posts), time.Since(t0))
}

func (bs *BlogSearchEngine) IsReady() bool {
	bs.mu.RLock()
	defer bs.mu.RUnlock()
	return bs.ready
}

func (bs *BlogSearchEngine) Stats() map[string]any {
	bs.mu.RLock()
	defer bs.mu.RUnlock()
	out := map[string]any{"ready": bs.ready, "indexing": bs.indexing, "total_posts": len(bs.posts), "kind": "blog"}
	if !bs.indexedAt.IsZero() {
		out["indexed_at"] = bs.indexedAt.Format(time.RFC3339)
	}
	return out
}

func (bs *BlogSearchEngine) Search(query string, topK int) ([]BlogSearchResult, error) {
	bs.mu.RLock()
	defer bs.mu.RUnlock()
	if !bs.ready || bs.engine == nil {
		return nil, nil
	}
	hits, err := bs.engine.Search(query, topK)
	if err != nil {
		return nil, err
	}
	out := make([]BlogSearchResult, 0, len(hits))
	for _, hit := range hits {
		if hit.ID < 0 || hit.ID >= len(bs.posts) {
			continue
		}
		post := bs.posts[hit.ID]
		out = append(out, BlogSearchResult{
			Slug:       post.Slug,
			Title:      post.Title,
			Excerpt:    post.Excerpt,
			Category:   post.Category,
			Date:       post.Date,
			URL:        "/blog/" + post.Slug,
			Similarity: hit.Similarity,
		})
	}
	return out, nil
}

// handleBlogSearch serves GET /api/blog/search?q=query&top_k=8.
func handleBlogSearch(ctx *fasthttp.RequestCtx) {
	query := string(ctx.QueryArgs().Peek("q"))
	if query == "" {
		jsonError(ctx, 400, "q parameter required")
		return
	}

	topK, _ := strconv.Atoi(string(ctx.QueryArgs().Peek("top_k")))
	if topK < 1 || topK > 25 {
		topK = 8
	}

	if blogSearch == nil || !blogSearch.IsReady() {
		jsonError(ctx, 503, "blog search engine not ready (still indexing)")
		return
	}

	results, err := blogSearch.Search(query, topK)
	if err != nil {
		jsonError(ctx, 500, "search failed")
		return
	}

	jsonResponse(ctx, 200, map[string]interface{}{
		"query":   query,
		"results": results,
		"count":   len(results),
		"kind":    "blog",
	})
}
