package main

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/lee101/gobed"
	"github.com/valyala/fasthttp"
)

// PoseRecord is one pose of the pose library (shisei CC0 mannequins plus poses
// generated from the 3D pose studio). Image paths are relative to the library
// asset root and resolved to URLs by poseAssetURL.
type PoseRecord struct {
	ID          string            `json:"id"`
	Source      string            `json:"source"`
	Series      string            `json:"series"`
	Name        string            `json:"name"`
	Category    string            `json:"category"`
	Description string            `json:"description"`
	Bodies      []string          `json:"bodies,omitempty"`
	People      int               `json:"people"`
	Framing     string            `json:"framing"`
	NSFW        bool              `json:"nsfw"`
	Views       map[string]string `json:"views"`
	Depth       map[string]string `json:"depth,omitempty"`
	Skeleton    map[string]string `json:"skeleton,omitempty"`
	Photos      map[string]string `json:"photos,omitempty"`
	Pose        string            `json:"pose,omitempty"`
	HasPose     bool              `json:"has_pose"`
	License     string            `json:"license"`
	Credit      string            `json:"credit"`
	SearchText  string            `json:"search_text"`
}

type PoseHit struct {
	PoseRecord
	Similarity float32 `json:"similarity"`
}

type PoseLibrary struct {
	mu      sync.RWMutex
	poses   []PoseRecord
	byID    map[string]int
	engine  *gobed.SearchEngine
	ready   bool
	loaded  time.Time
	dir     string
	semOnly bool
}

var poseLib = &PoseLibrary{}

func poseLibDir() string { return getEnv("POSELIB_DIR", "../tools/poselib/data") }

// poseAssetURL maps a manifest-relative image path to its public URL: the CDN
// prefix when POSELIB_CDN is set, otherwise this server's /pose-assets/ route.
func poseAssetURL(rel string) string {
	if rel == "" {
		return ""
	}
	base := strings.TrimRight(getEnv("POSELIB_CDN", "/pose-assets"), "/")
	return base + "/" + rel
}

func (pl *PoseLibrary) load() error {
	dir := poseLibDir()
	raw, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return err
	}
	var poses []PoseRecord
	if err := json.Unmarshal(raw, &poses); err != nil {
		return err
	}
	byID := make(map[string]int, len(poses))
	for i := range poses {
		byID[poses[i].ID] = i
	}
	pl.mu.Lock()
	pl.poses, pl.byID, pl.dir, pl.loaded = poses, byID, dir, time.Now()
	pl.mu.Unlock()
	log.Printf("[poselib] %d poses loaded from %s", len(poses), dir)
	return nil
}

// indexSemantic builds the gobed index; keyword search covers requests until it is ready.
func (pl *PoseLibrary) indexSemantic() {
	pl.mu.RLock()
	poses := pl.poses
	pl.mu.RUnlock()
	if len(poses) == 0 {
		return
	}
	model, err := loadSharedSearchModel()
	if err != nil {
		log.Printf("[poselib] gobed model load failed: %v", err)
		return
	}
	engine := newLocalSearchEngine(model)
	texts := make([]string, len(poses))
	ids := make([]int, len(poses))
	for i, p := range poses {
		texts[i] = p.SearchText
		ids[i] = i
	}
	if err := engine.IndexBatchWithIDs(ids, texts); err != nil {
		_ = engine.Close()
		log.Printf("[poselib] index build failed: %v", err)
		return
	}
	pl.mu.Lock()
	old := pl.engine
	pl.engine, pl.ready = engine, true
	pl.mu.Unlock()
	if old != nil {
		_ = old.Close()
	}
	log.Printf("[poselib] gobed index ready: %d poses", len(poses))
}

func initPoseLibrary(semantic bool) {
	if err := poseLib.load(); err != nil {
		log.Printf("[poselib] unavailable: %v", err)
		return
	}
	if semantic {
		go poseLib.indexSemantic()
	}
}

type poseFilter struct {
	source, category, body string
	people                 int
	framing                string
	allowNSFW              bool
}

func (f poseFilter) match(p *PoseRecord) bool {
	if p.NSFW && !f.allowNSFW {
		return false
	}
	if f.source != "" && p.Source != f.source {
		return false
	}
	if f.category != "" && !strings.EqualFold(p.Category, f.category) {
		return false
	}
	if f.people > 0 && p.People != f.people {
		return false
	}
	if f.framing != "" && p.Framing != f.framing {
		return false
	}
	if f.body != "" {
		ok := false
		for _, b := range p.Bodies {
			if strings.EqualFold(b, f.body) || strings.Contains(strings.ToLower(b), strings.ToLower(f.body)) {
				ok = true
			}
		}
		if !ok {
			return false
		}
	}
	return true
}

func keywordScore(text string, terms []string) float32 {
	text = strings.ToLower(text)
	var s float32
	for _, t := range terms {
		if strings.Contains(text, t) {
			s += 1
		}
	}
	if len(terms) == 0 {
		return 0
	}
	return s / float32(len(terms))
}

// Search ranks poses by gobed similarity when the index is ready, otherwise by
// keyword overlap. Filters apply after ranking over the whole library.
func (pl *PoseLibrary) Search(query string, f poseFilter, limit, offset int) ([]PoseHit, int, string) {
	pl.mu.RLock()
	defer pl.mu.RUnlock()
	var hits []PoseHit
	mode := "browse"
	query = strings.TrimSpace(query)
	switch {
	case query == "":
		for i := range pl.poses {
			if f.match(&pl.poses[i]) {
				hits = append(hits, PoseHit{PoseRecord: pl.poses[i]})
			}
		}
	case pl.ready && pl.engine != nil:
		mode = "semantic"
		res, err := pl.engine.Search(query, len(pl.poses))
		if err == nil {
			terms := strings.Fields(strings.ToLower(query))
			var maxSim float32
			for _, r := range res {
				if r.Similarity > maxSim {
					maxSim = r.Similarity
				}
			}
			if maxSim <= 0 {
				maxSim = 1
			}
			for _, r := range res {
				if r.ID >= 0 && r.ID < len(pl.poses) && f.match(&pl.poses[r.ID]) {
					score := r.Similarity/maxSim + 0.5*keywordScore(pl.poses[r.ID].SearchText, terms)
					hits = append(hits, PoseHit{PoseRecord: pl.poses[r.ID], Similarity: score})
				}
			}
			sort.SliceStable(hits, func(a, b int) bool { return hits[a].Similarity > hits[b].Similarity })
			break
		}
		fallthrough
	default:
		mode = "keyword"
		terms := strings.Fields(strings.ToLower(query))
		for i := range pl.poses {
			if !f.match(&pl.poses[i]) {
				continue
			}
			if s := keywordScore(pl.poses[i].SearchText, terms); s > 0 {
				hits = append(hits, PoseHit{PoseRecord: pl.poses[i], Similarity: s})
			}
		}
		sort.SliceStable(hits, func(a, b int) bool { return hits[a].Similarity > hits[b].Similarity })
	}
	total := len(hits)
	if offset >= total {
		return []PoseHit{}, total, mode
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return hits[offset:end], total, mode
}

func poseWithURLs(p PoseRecord) PoseRecord {
	conv := func(m map[string]string) map[string]string {
		if m == nil {
			return nil
		}
		o := make(map[string]string, len(m))
		for k, v := range m {
			o[k] = poseAssetURL(v)
		}
		return o
	}
	p.Views, p.Depth, p.Skeleton, p.Photos = conv(p.Views), conv(p.Depth), conv(p.Skeleton), conv(p.Photos)
	p.SearchText = ""
	p.HasPose = p.Pose != ""
	return p
}

func poseFilterFromCtx(ctx *fasthttp.RequestCtx) poseFilter {
	q := ctx.QueryArgs()
	people, _ := strconv.Atoi(string(q.Peek("people")))
	allow, _ := resolveAllowNSFW(ctx)
	return poseFilter{
		source: string(q.Peek("source")), category: string(q.Peek("category")), body: string(q.Peek("body")),
		people: people, framing: string(q.Peek("framing")), allowNSFW: allow,
	}
}

// handlePoseSearch serves GET /api/poses/search?q=&source=&category=&body=&people=&framing=&limit=&offset=.
func handlePoseSearch(ctx *fasthttp.RequestCtx) {
	q := ctx.QueryArgs()
	limit, _ := strconv.Atoi(string(q.Peek("limit")))
	offset, _ := strconv.Atoi(string(q.Peek("offset")))
	if limit < 1 || limit > 96 {
		limit = 48
	}
	if offset < 0 {
		offset = 0
	}
	f := poseFilterFromCtx(ctx)
	if poseLib.loaded.IsZero() {
		jsonError(ctx, 503, "pose library not loaded")
		return
	}
	query := string(q.Peek("q"))
	if len(query) > 200 {
		query = query[:200]
	}
	hits, total, mode := poseLib.Search(query, f, limit, offset)
	for i := range hits {
		hits[i].PoseRecord = poseWithURLs(hits[i].PoseRecord)
		hits[i].Pose = ""
	}
	_, requested := resolveAllowNSFW(ctx)
	setGalleryCache(ctx, requested)
	jsonResponse(ctx, 200, map[string]interface{}{"results": hits, "total": total, "mode": mode, "limit": limit, "offset": offset})
}

// handlePoseFacets serves GET /api/poses/facets: filter values and counts.
func handlePoseFacets(ctx *fasthttp.RequestCtx) {
	f := poseFilterFromCtx(ctx)
	poseLib.mu.RLock()
	defer poseLib.mu.RUnlock()
	cats, srcs, bodies := map[string]int{}, map[string]int{}, map[string]int{}
	n := 0
	for i := range poseLib.poses {
		p := &poseLib.poses[i]
		if p.NSFW && !f.allowNSFW {
			continue
		}
		n++
		cats[p.Category]++
		srcs[p.Source]++
		for _, b := range p.Bodies {
			bodies[b]++
		}
	}
	_, requested := resolveAllowNSFW(ctx)
	setGalleryCache(ctx, requested)
	jsonResponse(ctx, 200, map[string]interface{}{"total": n, "categories": cats, "sources": srcs, "bodies": bodies})
}

// handlePoseGet serves GET /api/poses/{id}.
func handlePoseGet(ctx *fasthttp.RequestCtx, id string) {
	allow, requested := resolveAllowNSFW(ctx)
	poseLib.mu.RLock()
	i, ok := poseLib.byID[id]
	var p PoseRecord
	if ok {
		p = poseLib.poses[i]
	}
	poseLib.mu.RUnlock()
	if !ok || (p.NSFW && !allow) {
		jsonError(ctx, 404, "pose not found")
		return
	}
	setGalleryCache(ctx, requested)
	jsonResponse(ctx, 200, poseWithURLs(p))
}

// handlePoseAsset serves /pose-assets/<rel> from the library directory (dev and
// origin fallback; production points POSELIB_CDN at the static bucket).
func handlePoseAsset(ctx *fasthttp.RequestCtx, rel string) {
	rel = filepath.Clean("/" + rel)
	if strings.Contains(rel, "..") || !strings.HasSuffix(rel, ".webp") && !strings.HasSuffix(rel, ".png") {
		ctx.SetStatusCode(404)
		return
	}
	path := filepath.Join(poseLibDir(), "images", rel)
	if st, err := os.Stat(path); err != nil || st.IsDir() {
		ctx.SetStatusCode(404)
		return
	}
	ctx.Response.Header.Set("Cache-Control", "public, max-age=86400")
	fasthttp.ServeFile(ctx, path)
}
