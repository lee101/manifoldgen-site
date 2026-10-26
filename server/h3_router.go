package main

import (
	"encoding/json"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/lee101/gobed"
)

const (
	h3NormalVariant     = "normal-h3"
	h3PinkCherryVariant = "pinkcherry-alpha-0.5"
	h3LtxVariant        = "ltx23-q4"
)

type h3WorkerRoute struct {
	Variant          string
	CogURL           string
	RunpodEndpointID string
}

// These are semantic reference prompts, not a user-facing blocklist. The
// custom worker is only used to choose compatible weights; enforcement remains
// the responsibility of the product's normal policy layer.
var h3AdultRouteAnchors = []string{
	"an explicit adult sexual scene",
	"consenting adults having sex",
	"pornographic nudity",
	"an erotic nude adult scene",
}

var h3GeneralRouteAnchors = []string{
	"a glass hummingbird in a botanical garden",
	"a cinematic city street in rainfall",
	"a rabbit in a field of cherry blossoms",
	"a person walking through a modern art gallery",
}

// h3ExplicitRouteHint is deliberately small. It makes routing dependable while
// Gobed is still loading, then semantic anchors handle less literal wording.
func h3ExplicitRouteHint(prompt string) bool {
	text := strings.ToLower(" " + strings.TrimSpace(prompt) + " ")
	for _, phrase := range []string{
		" explicit sex ", " porn ", " pornography ", " sexual intercourse ",
		" naked sex ", " nude sex ", " erotic nudity ", " adult nude ",
	} {
		if strings.Contains(text, phrase) {
			return true
		}
	}
	return false
}

// Anchor texts are constant, so their embeddings are computed once per model
// instead of twice per anchor on every routing decision.
var h3AnchorCache struct {
	sync.Mutex
	model   *gobed.EmbeddingModel
	vectors map[string][][]float32
}

func h3AnchorEmbeddings(model *gobed.EmbeddingModel, name string, anchors []string) ([][]float32, bool) {
	h3AnchorCache.Lock()
	defer h3AnchorCache.Unlock()
	if h3AnchorCache.model != model {
		h3AnchorCache.model, h3AnchorCache.vectors = model, map[string][][]float32{}
	}
	if cached, ok := h3AnchorCache.vectors[name]; ok {
		return cached, true
	}
	vectors := make([][]float32, 0, len(anchors))
	for _, anchor := range anchors {
		vector, err := model.Encode(anchor)
		if err != nil {
			return nil, false
		}
		vectors = append(vectors, vector)
	}
	h3AnchorCache.vectors[name] = vectors
	return vectors, true
}

func h3MeanCosine(query []float32, anchors [][]float32) float32 {
	var sum float32
	for _, anchor := range anchors {
		sum += gobed.CosineSimilarity(query, anchor)
	}
	return sum / float32(len(anchors))
}

func h3SemanticAdultRoute(prompt string) (adult bool, available bool) {
	if promptSearch == nil || strings.TrimSpace(prompt) == "" {
		return false, false
	}
	promptSearch.mu.RLock()
	model := promptSearch.model
	ready := promptSearch.ready
	promptSearch.mu.RUnlock()
	if !ready || model == nil {
		return false, false
	}
	query, err := model.Encode(prompt)
	if err != nil {
		return false, false
	}
	adultAnchors, okAdult := h3AnchorEmbeddings(model, "adult", h3AdultRouteAnchors)
	generalAnchors, okGeneral := h3AnchorEmbeddings(model, "general", h3GeneralRouteAnchors)
	if !okAdult || !okGeneral {
		return false, false
	}
	adultScore, generalScore := h3MeanCosine(query, adultAnchors), h3MeanCosine(query, generalAnchors)
	// The margin avoids model churn for prompts that are merely romantic,
	// artistic, or mention a body without asking for explicit content.
	return adultScore >= generalScore+0.035, true
}

func h3AdultLane() (h3WorkerRoute, bool) {
	if route, ok := h3LtxLane(); ok {
		return route, true
	}
	return h3PinkCherryLane()
}

func h3PinkCherryLane() (h3WorkerRoute, bool) {
	if url, ep := h3LaneEnv("H3_PINKCHERRY"); url != "" || ep != "" {
		return h3WorkerRoute{Variant: h3PinkCherryVariant, CogURL: url, RunpodEndpointID: ep}, true
	}
	return h3WorkerRoute{}, false
}

func h3LtxLane() (h3WorkerRoute, bool) {
	if url, ep := h3LaneEnv("H3_LTX"); url != "" || ep != "" {
		return h3WorkerRoute{Variant: h3LtxVariant, CogURL: url, RunpodEndpointID: ep}, true
	}
	return h3WorkerRoute{}, false
}

func h3IsAdultVariant(variant string) bool {
	return variant == h3LtxVariant || variant == h3PinkCherryVariant
}

func h3LtxLacksFeatures(req ServiceUsageRequest) bool {
	return strings.TrimSpace(req.LastFrame) != "" || len(req.Keyframes) > 2 || req.Loop
}

func h3RouteForRequest(req ServiceUsageRequest) h3WorkerRoute {
	route := h3RouteForPrompt(req.Prompt)
	if route.Variant == h3LtxVariant && h3LtxLacksFeatures(req) {
		if pink, ok := h3PinkCherryLane(); ok {
			return pink
		}
	}
	return route
}

func h3RouteForStoredJob(job *VideoJob) h3WorkerRoute {
	if job != nil && len(job.Result) > 0 {
		var stored struct {
			Variant string `json:"_h3_variant"`
		}
		if json.Unmarshal(job.Result, &stored) == nil {
			switch stored.Variant {
			case h3LtxVariant:
				if route, ok := h3LtxLane(); ok {
					return route
				}
			case h3PinkCherryVariant:
				if route, ok := h3PinkCherryLane(); ok {
					return route
				}
			}
		}
	}
	prompt := ""
	if job != nil {
		prompt = job.Prompt
	}
	return h3RouteForPrompt(prompt)
}

func h3LaneEnv(prefix string) (string, string) {
	url := strings.TrimRight(strings.TrimSpace(os.Getenv(prefix+"_COG_URL")), "/")
	endpoint := strings.TrimSpace(os.Getenv(prefix + "_RUNPOD_ENDPOINT"))
	return url, endpoint
}

func h3RouteForPrompt(prompt string) h3WorkerRoute {
	normalURL := strings.TrimRight(strings.TrimSpace(os.Getenv("H3_NORMAL_COG_URL")), "/")
	if normalURL == "" {
		normalURL = h3LocalCogURL()
	}
	normalEndpoint := strings.TrimSpace(os.Getenv("H3_NORMAL_RUNPOD_ENDPOINT"))
	normal := h3WorkerRoute{Variant: h3NormalVariant, CogURL: normalURL, RunpodEndpointID: normalEndpoint}
	adult, ok := h3AdultLane()
	if !ok {
		return normal
	}
	if h3ExplicitRouteHint(prompt) {
		return adult
	}
	if isAdult, available := h3SemanticAdultRoute(prompt); available && isAdult {
		return adult
	}
	return normal
}

// h3RouteForContent lets the image classifier choose the compatible weight
// lane without turning model routing into policy enforcement.
func h3RouteForContent(prompt string, inputNSFW bool) h3WorkerRoute {
	route := h3RouteForPrompt(prompt)
	if !inputNSFW {
		return route
	}
	if adult, ok := h3AdultLane(); ok {
		return adult
	}
	return route
}

func logH3Route(prompt string, route h3WorkerRoute) {
	// Do not log raw prompt text: this is operational routing telemetry only.
	log.Printf("[h3] selected worker variant=%s configured=%t serverless=%t prompt_bytes=%d", route.Variant, route.CogURL != "" || route.RunpodEndpointID != "", route.RunpodEndpointID != "", len(prompt))
}
