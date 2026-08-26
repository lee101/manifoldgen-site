package main

import (
	"log"
	"os"
	"strings"
)

const (
	h3NormalVariant     = "normal-h3"
	h3PinkCherryVariant = "pinkcherry-alpha-0.5"
	h3Studio1939LoRA    = "studio1939"
)

type h3WorkerRoute struct {
	Variant          string
	CogURL           string
	RunpodEndpointID string
	StyleLoRA        string
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

var h3Studio1939RouteAnchors = []string{
	"a 1920s black and white rubber hose cartoon",
	"a 1930s golden age hand painted cel animation",
	"an early theatrical cartoon with inked characters and painted backgrounds",
	"a vintage celluloid animation from the 1930s",
}

var h3NonStudio1939RouteAnchors = []string{
	"a modern Japanese anime television scene",
	"a contemporary 3D computer animated feature film",
	"a live action historical drama set in the 1930s",
	"a modern photorealistic cinematic video",
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

func h3AnimationRouteContext(prompt string) bool {
	text := strings.ToLower(prompt)
	for _, marker := range []string{
		"animat", "cartoon", "cel art", "celluloid", "rubber hose", "inked character",
	} {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
}

func h3ExplicitStudio1939RouteHint(prompt string) bool {
	text := strings.ToLower(strings.TrimSpace(prompt))
	for _, phrase := range []string{
		"1920s cartoon", "1920s animation", "1930s cartoon",
		"1930s animation", "rubber hose cartoon", "rubber hose animation",
		"golden age cel animation", "golden age cartoon", "early theatrical cartoon",
	} {
		if strings.Contains(text, phrase) {
			return true
		}
	}
	return false
}

func h3SemanticStudio1939Route(prompt string) (selected bool, available bool) {
	// The lexical context is intentionally broad but mandatory. Gobed decides
	// old theatrical animation versus modern animation; it must never turn a
	// live-action 1930s period prompt into a cartoon by itself.
	if promptSearch == nil || !h3AnimationRouteContext(prompt) {
		return false, false
	}
	promptSearch.mu.RLock()
	model := promptSearch.model
	ready := promptSearch.ready
	promptSearch.mu.RUnlock()
	if !ready || model == nil {
		return false, false
	}
	meanSimilarity := func(anchors []string) (float32, bool) {
		var sum float32
		for _, anchor := range anchors {
			score, err := model.Similarity(prompt, anchor)
			if err != nil {
				return 0, false
			}
			sum += score
		}
		return sum / float32(len(anchors)), true
	}
	oldScore, okOld := meanSimilarity(h3Studio1939RouteAnchors)
	otherScore, okOther := meanSimilarity(h3NonStudio1939RouteAnchors)
	if !okOld || !okOther {
		return false, false
	}
	// A wider margin than adult weight routing keeps this rare style opt-in
	// conservative: uncertain animation prompts stay on the base H3 model.
	return oldScore >= otherScore+0.055, true
}

func h3StyleLoRAForPrompt(prompt string) string {
	if !strings.EqualFold(strings.TrimSpace(os.Getenv("H3_STUDIO1939_ENABLED")), "true") {
		return ""
	}
	if h3ExplicitStudio1939RouteHint(prompt) {
		return h3Studio1939LoRA
	}
	if selected, available := h3SemanticStudio1939Route(prompt); available && selected {
		return h3Studio1939LoRA
	}
	return ""
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
	meanSimilarity := func(anchors []string) (float32, bool) {
		var sum float32
		for _, anchor := range anchors {
			score, err := model.Similarity(prompt, anchor)
			if err != nil {
				return 0, false
			}
			sum += score
		}
		return sum / float32(len(anchors)), true
	}
	adultScore, okAdult := meanSimilarity(h3AdultRouteAnchors)
	generalScore, okGeneral := meanSimilarity(h3GeneralRouteAnchors)
	if !okAdult || !okGeneral {
		return false, false
	}
	// The margin avoids model churn for prompts that are merely romantic,
	// artistic, or mention a body without asking for explicit content.
	return adultScore >= generalScore+0.035, true
}

func h3RouteForPrompt(prompt string) h3WorkerRoute {
	styleLoRA := h3StyleLoRAForPrompt(prompt)
	normalURL := strings.TrimRight(strings.TrimSpace(os.Getenv("H3_NORMAL_COG_URL")), "/")
	if normalURL == "" {
		normalURL = h3LocalCogURL()
	}
	normalEndpoint := strings.TrimSpace(os.Getenv("H3_NORMAL_RUNPOD_ENDPOINT"))
	pinkURL := strings.TrimRight(strings.TrimSpace(os.Getenv("H3_PINKCHERRY_COG_URL")), "/")
	pinkEndpoint := strings.TrimSpace(os.Getenv("H3_PINKCHERRY_RUNPOD_ENDPOINT"))
	if pinkURL == "" && pinkEndpoint == "" {
		return h3WorkerRoute{Variant: h3NormalVariant, CogURL: normalURL, RunpodEndpointID: normalEndpoint, StyleLoRA: styleLoRA}
	}
	if h3ExplicitRouteHint(prompt) {
		return h3WorkerRoute{Variant: h3PinkCherryVariant, CogURL: pinkURL, RunpodEndpointID: pinkEndpoint, StyleLoRA: styleLoRA}
	}
	if adult, available := h3SemanticAdultRoute(prompt); available && adult {
		return h3WorkerRoute{Variant: h3PinkCherryVariant, CogURL: pinkURL, RunpodEndpointID: pinkEndpoint, StyleLoRA: styleLoRA}
	}
	return h3WorkerRoute{Variant: h3NormalVariant, CogURL: normalURL, RunpodEndpointID: normalEndpoint, StyleLoRA: styleLoRA}
}

// h3RouteForContent lets the image classifier choose the compatible weight
// lane without turning model routing into policy enforcement.
func h3RouteForContent(prompt string, inputNSFW bool) h3WorkerRoute {
	if !inputNSFW {
		return h3RouteForPrompt(prompt)
	}
	route := h3RouteForPrompt(prompt)
	pinkURL := strings.TrimRight(strings.TrimSpace(os.Getenv("H3_PINKCHERRY_COG_URL")), "/")
	pinkEndpoint := strings.TrimSpace(os.Getenv("H3_PINKCHERRY_RUNPOD_ENDPOINT"))
	if pinkURL != "" || pinkEndpoint != "" {
		route.Variant = h3PinkCherryVariant
		route.CogURL = pinkURL
		route.RunpodEndpointID = pinkEndpoint
	}
	return route
}

func logH3Route(prompt string, route h3WorkerRoute) {
	// Do not log raw prompt text: this is operational routing telemetry only.
	log.Printf("[h3] selected worker variant=%s style_lora=%s configured=%t serverless=%t prompt_bytes=%d", route.Variant, route.StyleLoRA, route.CogURL != "" || route.RunpodEndpointID != "", route.RunpodEndpointID != "", len(prompt))
}
