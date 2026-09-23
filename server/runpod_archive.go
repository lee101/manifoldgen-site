package main

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/valyala/fasthttp"
)

// RUNPOD_ARCHIVED_ENDPOINT_IDS lists endpoints whose model volume was archived
// to R2 (docs/runpod-volume-archive.md). They must never be scaled up or sent
// work: a worker would boot without weights and bill GPU time. Restoring a
// volume and removing its endpoint from the list re-enables the lane.
const runpodArchivedMessage = "this model lane is archived: its weights are in cold storage and must be restored before it can run"

func runpodEndpointArchived(endpointID string) bool {
	endpointID = strings.TrimSpace(endpointID)
	if endpointID == "" {
		return false
	}
	for _, id := range strings.Split(os.Getenv("RUNPOD_ARCHIVED_ENDPOINT_IDS"), ",") {
		if strings.TrimSpace(id) == endpointID {
			return true
		}
	}
	return false
}

type runpodArchivedError struct{ endpointID string }

func (e runpodArchivedError) Error() string {
	return fmt.Sprintf("RunPod endpoint %s: %s", e.endpointID, runpodArchivedMessage)
}

func runpodArchiveBlocks(method, endpointID string) error {
	if method != http.MethodGet && runpodEndpointArchived(endpointID) {
		return runpodArchivedError{endpointID}
	}
	return nil
}

func rejectArchivedLane(ctx *fasthttp.RequestCtx, endpointID string) bool {
	if !runpodEndpointArchived(endpointID) {
		return false
	}
	ctx.Response.Header.Set("Retry-After", "86400")
	jsonResponse(ctx, http.StatusServiceUnavailable, map[string]interface{}{"error": runpodArchivedMessage, "archived": true})
	return true
}

func runpodLaneStatus() map[string]interface{} {
	music := false
	for _, tier := range []string{"standard", "fast", "xfast"} {
		music = music || runpodEndpointArchived(music3EndpointIDForTier(tier))
	}
	animation := map[string]bool{}
	for _, tier := range []string{"standard", "fast", "xfast"} {
		animation[tier] = runpodEndpointArchived(characterAnimationEndpointID(tier))
	}
	return map[string]interface{}{
		"music":               music,
		"h3_control":          runpodEndpointArchived(h3ControlEndpointID()),
		"character_animation": animation,
		"message":             runpodArchivedMessage,
	}
}

func handleRunpodLaneStatus(ctx *fasthttp.RequestCtx) {
	ctx.Response.Header.Set("Cache-Control", "no-store")
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"archived": runpodLaneStatus()})
}
