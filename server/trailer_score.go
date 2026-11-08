package main

// Trailer score providers: the house music generators (MiniMax Music3 / Manifold Music Generator RunPod lanes, with
// lyrics) or the Studio music path. Runs concurrently with reference and frame rendering; joined before voices.

import (
	"context"
	"fmt"
	"math"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

const trailerDefaultMusicPrompt = "Intimate dark-fantasy trailer score, low cello, wet-wood percussion, close female alto, funeral choir through rain, no pop beat, no heroic brass fanfare"

type trailerScoreResult struct {
	URL, Path, Provider, Detail string
	Err                         error
}

func normalizeTrailerScoreProvider(value string) string {
	switch v := strings.ToLower(strings.TrimSpace(value)); v {
	case "house", "music3", "yue", "manifold":
		return "house"
	case "studio", "fal":
		return "studio"
	default:
		return "auto"
	}
}

// trailerScoreProvider: explicit request > TRAILER_SCORE_PROVIDER > house when lyrics are supplied > studio.
func trailerScoreProvider(req dramatizeRequest) string {
	if p := normalizeTrailerScoreProvider(req.ScoreProvider); p != "auto" {
		return p
	}
	if p := normalizeTrailerScoreProvider(getEnv("TRAILER_SCORE_PROVIDER", "")); p != "auto" {
		return p
	}
	if strings.TrimSpace(req.Lyrics) != "" {
		return "house"
	}
	return "studio"
}

func trailerHouseMusic(ctx context.Context, userID, prompt, lyrics string, duration int) (string, error) {
	endpointID := music3EndpointIDForTier("standard")
	if endpointID == "" {
		return "", fmt.Errorf("house music endpoint is not configured")
	}
	uploadURL, publicURL, err := music3UploadTarget(userID)
	if err != nil {
		return "", err
	}
	if err := music3PrepareEndpoint(endpointID, "standard"); err != nil {
		return "", err
	}
	seed := time.Now().UnixNano() & math.MaxInt64
	input := map[string]interface{}{
		"workload": "minimax-music3", "prompt": prompt, "duration_seconds": duration,
		"seed": seed, "output_upload_url": uploadURL, "output_public_url": publicURL,
	}
	if structured := music3StructureLyrics(lyrics); structured != "" {
		input["lyrics"] = structured
	}
	if musicBackendIsYue() {
		input = musicYueInput(prompt, lyrics, duration, seed, uploadURL, publicURL)
	}
	var queued h3RunpodQueuedJob
	if _, err := callH3Runpod(endpointID, "/run", http.MethodPost, runpodRunBody(input, 25*time.Minute), &queued); err != nil {
		return "", err
	}
	if queued.ID == "" {
		return "", fmt.Errorf("house music returned no job")
	}
	deadline := time.Now().Add(45 * time.Minute)
	for failures := 0; time.Now().Before(deadline); {
		select {
		case <-ctx.Done():
			runpodCancelBestEffort(endpointID, queued.ID)
			return "", ctx.Err()
		case <-time.After(3 * time.Second):
		}
		var state music3RunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(queued.ID), http.MethodGet, nil, &state); err != nil {
			if failures++; failures >= 10 {
				runpodCancelBestEffort(endpointID, queued.ID)
				return "", err
			}
			continue
		}
		failures = 0
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED":
			return firstNonEmpty(strings.TrimSpace(state.Output.AudioURL), publicURL), nil
		case "FAILED", "CANCELLED", "TIMED_OUT":
			return "", fmt.Errorf("house music %s %s", strings.ToLower(state.Status), state.Error)
		}
	}
	runpodCancelBestEffort(endpointID, queued.ID)
	return "", fmt.Errorf("house music timed out")
}

func generateTrailerScore(ctx context.Context, user *User, req dramatizeRequest, duration int, workDir string) trailerScoreResult {
	path := filepath.Join(workDir, "score.audio")
	fetch := func(r trailerScoreResult) trailerScoreResult {
		if downloadToFile(ctx, r.URL, path) == nil {
			r.Path = path
		}
		return r
	}
	if req.SoundtrackURL != "" {
		return fetch(trailerScoreResult{URL: req.SoundtrackURL, Provider: "supplied", Detail: "using the supplied song"})
	}
	prompt := firstNonEmpty(req.MusicPrompt, trailerDefaultMusicPrompt)
	var houseErr error
	if trailerScoreProvider(req) == "house" {
		userID := ""
		if user != nil {
			userID = user.ID
		}
		u, err := trailerHouseMusic(ctx, userID, prompt, req.Lyrics, duration)
		if err == nil {
			detail := "house score ready"
			if req.Lyrics != "" {
				detail = "house song with lyrics ready"
			}
			return fetch(trailerScoreResult{URL: u, Provider: "house", Detail: detail})
		}
		houseErr = err
	}
	if ctx.Err() != nil {
		return trailerScoreResult{Err: ctx.Err()}
	}
	studioPrompt := prompt
	if req.Lyrics != "" {
		studioPrompt += "\n\n" + req.Lyrics
	}
	u, err := studioGenerateMusic(studioPrompt, duration)
	if err != nil {
		if houseErr != nil {
			err = fmt.Errorf("%v; house: %v", err, houseErr)
		}
		return trailerScoreResult{Err: err}
	}
	detail := "score ready"
	if houseErr != nil {
		detail = "studio score ready (house unavailable: " + houseErr.Error() + ")"
	}
	return fetch(trailerScoreResult{URL: u, Provider: "studio", Detail: detail})
}

// trailerCutToMusic: snapping cuts to the score is on unless the request turns it off.
func trailerCutToMusic(req dramatizeRequest) bool {
	return req.CutToMusic == nil || *req.CutToMusic
}
