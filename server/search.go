package main

import (
	"log"
	"sync"
	"time"

	"github.com/lee101/gobed"
)

// PromptSearchEngine indexes generated_images prompts for gallery semantic search.
type PromptSearchEngine struct {
	engine    *gobed.SearchEngine
	model     *gobed.EmbeddingModel
	imageIDs  []string
	prompts   []string
	mu        sync.RWMutex
	ready     bool
	indexing  bool
	indexedAt time.Time
}

// VideoSearchEngine indexes completed video_jobs by prompt text.
type VideoSearchEngine struct {
	engine    *gobed.SearchEngine
	model     *gobed.EmbeddingModel
	jobIDs    []string
	prompts   []string
	videoURLs []string
	services  []string
	mu        sync.RWMutex
	ready     bool
	indexing  bool
	indexedAt time.Time
}

// AudioSearchEngine indexes generated audio prompts while retaining enough
// metadata to return useful, provider-neutral search results.
type AudioSearchEngine struct {
	engine    *gobed.SearchEngine
	model     *gobed.EmbeddingModel
	assets    []GeneratedAudio
	mu        sync.RWMutex
	ready     bool
	indexing  bool
	indexedAt time.Time
}

type SearchResult struct {
	ImageID    string  `json:"image_id,omitempty"`
	JobID      string  `json:"job_id,omitempty"`
	Prompt     string  `json:"prompt"`
	VideoURL   string  `json:"video_url,omitempty"`
	Service    string  `json:"service,omitempty"`
	Similarity float32 `json:"similarity"`
}

type AudioSearchResult struct {
	ID              string    `json:"id"`
	Kind            string    `json:"kind"`
	Prompt          string    `json:"prompt"`
	Title           string    `json:"title"`
	AudioURL        string    `json:"audio_url"`
	DurationSeconds int       `json:"duration_seconds"`
	CreatedAt       time.Time `json:"created_at"`
	Similarity      float32   `json:"similarity"`
}

var promptSearch *PromptSearchEngine
var videoSearch *VideoSearchEngine
var audioSearch *AudioSearchEngine

func initPromptSearch() {
	promptSearch = &PromptSearchEngine{}
	videoSearch = &VideoSearchEngine{}
	audioSearch = &AudioSearchEngine{}
	go promptSearch.loadAndIndex()
	go videoSearch.loadAndIndex()
	go audioSearch.loadAndIndex()
}

func (ps *PromptSearchEngine) loadAndIndex() {
	ps.mu.Lock()
	if ps.indexing {
		ps.mu.Unlock()
		return
	}
	ps.indexing = true
	ps.mu.Unlock()
	defer func() {
		ps.mu.Lock()
		ps.indexing = false
		ps.mu.Unlock()
	}()

	t0 := time.Now()
	log.Println("[search] Loading gobed model for image gallery…")
	model, err := gobed.LoadModel()
	if err != nil {
		log.Printf("[search] gobed model load failed: %v", err)
		return
	}

	var imageIDs, prompts []string
	if dbConn != nil {
		err = dbConn.StreamAllImagePrompts(true, func(id, prompt string) error {
			imageIDs = append(imageIDs, id)
			prompts = append(prompts, prompt)
			return nil
		})
		if err != nil {
			log.Printf("[search] stream image prompts: %v", err)
			return
		}
	}
	log.Printf("[search] Loaded %d image prompts in %v", len(prompts), time.Since(t0))

	engine := gobed.NewAutoSearchEngine(model)
	if len(prompts) > 0 {
		ids := make([]int, len(prompts))
		for i := range ids {
			ids[i] = i
		}
		if err := engine.IndexBatchWithIDs(ids, prompts); err != nil {
			_ = engine.Close()
			log.Printf("[search] image index build failed: %v", err)
			return
		}
	}

	ps.mu.Lock()
	old := ps.engine
	ps.model = model
	ps.engine = engine
	ps.imageIDs = imageIDs
	ps.prompts = prompts
	ps.ready = true
	ps.indexedAt = time.Now()
	ps.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
	log.Printf("[search] Image index ready: %d prompts", len(prompts))
}

func (ps *PromptSearchEngine) IndexIncremental(imageID, prompt string) {
	if ps == nil || prompt == "" {
		return
	}
	ps.mu.Lock()
	defer ps.mu.Unlock()
	if ps.engine == nil || !ps.ready {
		return
	}
	intID := len(ps.prompts)
	if err := ps.engine.IndexWithID(intID, prompt); err != nil {
		log.Printf("[search] image IndexIncremental: %v", err)
		return
	}
	ps.prompts = append(ps.prompts, prompt)
	ps.imageIDs = append(ps.imageIDs, imageID)
}

func (ps *PromptSearchEngine) IsReady() bool {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	return ps.ready
}

func (ps *PromptSearchEngine) Stats() map[string]any {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	out := map[string]any{"ready": ps.ready, "indexing": ps.indexing, "total_prompts": len(ps.prompts), "kind": "images"}
	if !ps.indexedAt.IsZero() {
		out["indexed_at"] = ps.indexedAt.Format(time.RFC3339)
	}
	return out
}

func (ps *PromptSearchEngine) Search(query string, topK int) ([]SearchResult, error) {
	ps.mu.RLock()
	defer ps.mu.RUnlock()
	if !ps.ready || ps.engine == nil {
		return nil, nil
	}
	hits, err := ps.engine.Search(query, topK)
	if err != nil {
		return nil, err
	}
	out := make([]SearchResult, 0, len(hits))
	for _, r := range hits {
		if r.ID < 0 || r.ID >= len(ps.prompts) {
			continue
		}
		out = append(out, SearchResult{
			ImageID:    ps.imageIDs[r.ID],
			Prompt:     ps.prompts[r.ID],
			Similarity: r.Similarity,
		})
	}
	return out, nil
}

func (vs *VideoSearchEngine) loadAndIndex() {
	vs.mu.Lock()
	if vs.indexing {
		vs.mu.Unlock()
		return
	}
	vs.indexing = true
	vs.mu.Unlock()
	defer func() {
		vs.mu.Lock()
		vs.indexing = false
		vs.mu.Unlock()
	}()

	t0 := time.Now()
	log.Println("[video-search] Loading gobed model…")
	model, err := gobed.LoadModel()
	if err != nil {
		log.Printf("[video-search] gobed model load failed: %v", err)
		return
	}

	var jobIDs, prompts, urls, services []string
	if dbConn != nil {
		err = dbConn.StreamCompletedVideoPrompts(func(jobID, prompt, videoURL, service string) error {
			jobIDs = append(jobIDs, jobID)
			prompts = append(prompts, prompt)
			urls = append(urls, videoURL)
			services = append(services, service)
			return nil
		})
		if err != nil {
			log.Printf("[video-search] stream video prompts: %v", err)
			return
		}
	}
	log.Printf("[video-search] Loaded %d video prompts in %v", len(prompts), time.Since(t0))

	engine := gobed.NewAutoSearchEngine(model)
	if len(prompts) > 0 {
		ids := make([]int, len(prompts))
		for i := range ids {
			ids[i] = i
		}
		if err := engine.IndexBatchWithIDs(ids, prompts); err != nil {
			_ = engine.Close()
			log.Printf("[video-search] index build failed: %v", err)
			return
		}
	}

	vs.mu.Lock()
	old := vs.engine
	vs.model = model
	vs.engine = engine
	vs.jobIDs = jobIDs
	vs.prompts = prompts
	vs.videoURLs = urls
	vs.services = services
	vs.ready = true
	vs.indexedAt = time.Now()
	vs.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
	log.Printf("[video-search] Ready: %d videos", len(prompts))
}

func (vs *VideoSearchEngine) IndexIncremental(jobID, prompt, videoURL, service string) {
	if vs == nil || prompt == "" || jobID == "" {
		return
	}
	vs.mu.Lock()
	defer vs.mu.Unlock()
	if vs.engine == nil || !vs.ready {
		return
	}
	intID := len(vs.prompts)
	if err := vs.engine.IndexWithID(intID, prompt); err != nil {
		log.Printf("[video-search] IndexIncremental: %v", err)
		return
	}
	vs.prompts = append(vs.prompts, prompt)
	vs.jobIDs = append(vs.jobIDs, jobID)
	vs.videoURLs = append(vs.videoURLs, videoURL)
	vs.services = append(vs.services, service)
}

func (vs *VideoSearchEngine) IsReady() bool {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	return vs.ready
}

func (vs *VideoSearchEngine) Stats() map[string]any {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	out := map[string]any{"ready": vs.ready, "indexing": vs.indexing, "total_prompts": len(vs.prompts), "kind": "videos"}
	if !vs.indexedAt.IsZero() {
		out["indexed_at"] = vs.indexedAt.Format(time.RFC3339)
	}
	return out
}

func (vs *VideoSearchEngine) Search(query string, topK int) ([]SearchResult, error) {
	vs.mu.RLock()
	defer vs.mu.RUnlock()
	if !vs.ready || vs.engine == nil {
		return nil, nil
	}
	hits, err := vs.engine.Search(query, topK)
	if err != nil {
		return nil, err
	}
	out := make([]SearchResult, 0, len(hits))
	for _, r := range hits {
		if r.ID < 0 || r.ID >= len(vs.prompts) {
			continue
		}
		out = append(out, SearchResult{
			JobID:      vs.jobIDs[r.ID],
			Prompt:     vs.prompts[r.ID],
			VideoURL:   vs.videoURLs[r.ID],
			Service:    "video",
			Similarity: r.Similarity,
		})
	}
	return out, nil
}

func (as *AudioSearchEngine) loadAndIndex() {
	as.mu.Lock()
	if as.indexing {
		as.mu.Unlock()
		return
	}
	as.indexing = true
	as.mu.Unlock()
	defer func() {
		as.mu.Lock()
		as.indexing = false
		as.mu.Unlock()
	}()

	t0 := time.Now()
	log.Println("[audio-search] Loading gobed model…")
	model, err := gobed.LoadModel()
	if err != nil {
		log.Printf("[audio-search] gobed model load failed: %v", err)
		return
	}

	assets := make([]GeneratedAudio, 0)
	if dbConn != nil {
		err = dbConn.StreamAllAudioPrompts(func(asset *GeneratedAudio) error {
			assets = append(assets, *asset)
			return nil
		})
		if err != nil {
			log.Printf("[audio-search] stream audio prompts: %v", err)
			return
		}
	}
	log.Printf("[audio-search] Loaded %d audio prompts in %v", len(assets), time.Since(t0))

	engine := gobed.NewAutoSearchEngine(model)
	if len(assets) > 0 {
		ids := make([]int, len(assets))
		prompts := make([]string, len(assets))
		for i := range assets {
			ids[i] = i
			prompts[i] = assets[i].Prompt
		}
		if err := engine.IndexBatchWithIDs(ids, prompts); err != nil {
			_ = engine.Close()
			log.Printf("[audio-search] index build failed: %v", err)
			return
		}
	}

	as.mu.Lock()
	old := as.engine
	as.model = model
	as.engine = engine
	as.assets = assets
	as.ready = true
	as.indexedAt = time.Now()
	as.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
	log.Printf("[audio-search] Ready: %d audio assets", len(assets))
}

func (as *AudioSearchEngine) IndexIncremental(asset *GeneratedAudio) {
	if as == nil || asset == nil || asset.ID == "" || asset.Prompt == "" {
		return
	}
	as.mu.Lock()
	defer as.mu.Unlock()
	if as.engine == nil || !as.ready {
		return
	}
	intID := len(as.assets)
	if err := as.engine.IndexWithID(intID, asset.Prompt); err != nil {
		log.Printf("[audio-search] IndexIncremental: %v", err)
		return
	}
	as.assets = append(as.assets, *asset)
}

func (as *AudioSearchEngine) IsReady() bool {
	as.mu.RLock()
	defer as.mu.RUnlock()
	return as.ready
}

func (as *AudioSearchEngine) Stats() map[string]any {
	as.mu.RLock()
	defer as.mu.RUnlock()
	out := map[string]any{"ready": as.ready, "indexing": as.indexing, "total_prompts": len(as.assets), "kind": "audio"}
	if !as.indexedAt.IsZero() {
		out["indexed_at"] = as.indexedAt.Format(time.RFC3339)
	}
	return out
}

func (as *AudioSearchEngine) Search(query, kind, userID string, topK int) ([]AudioSearchResult, error) {
	as.mu.RLock()
	defer as.mu.RUnlock()
	if !as.ready || as.engine == nil {
		return nil, nil
	}
	// Ask for extra semantic candidates because visibility and kind filters are
	// applied after nearest-neighbour lookup.
	candidateK := topK * 5
	if candidateK < 50 {
		candidateK = 50
	}
	if candidateK > len(as.assets) {
		candidateK = len(as.assets)
	}
	if candidateK == 0 {
		return []AudioSearchResult{}, nil
	}
	hits, err := as.engine.Search(query, candidateK)
	if err != nil {
		return nil, err
	}
	out := make([]AudioSearchResult, 0, topK)
	for _, hit := range hits {
		if hit.ID < 0 || hit.ID >= len(as.assets) {
			continue
		}
		asset := as.assets[hit.ID]
		if kind != "" && asset.Kind != kind {
			continue
		}
		if !asset.Public && (userID == "" || userID != asset.UserID) {
			continue
		}
		out = append(out, AudioSearchResult{
			ID: asset.ID, Kind: asset.Kind, Prompt: asset.Prompt, Title: asset.Title,
			AudioURL: asset.AudioURL, DurationSeconds: asset.DurationSeconds,
			CreatedAt: asset.CreatedAt, Similarity: hit.Similarity,
		})
		if len(out) == topK {
			break
		}
	}
	return out, nil
}
