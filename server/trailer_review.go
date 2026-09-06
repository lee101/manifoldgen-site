package main

// Cheap trailer reviewer: Gemini Flash on stills capped at 800px on the long side.
// Notes can repair identity; they do not rewrite the user's story.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

const trailerReviewMaxSide = 800

func trailerReviewModels() []string {
	if model := strings.TrimSpace(getEnv("TRAILER_REVIEW_MODEL", "")); model != "" {
		return []string{model}
	}
	return []string{"gemini-2.0-flash-exp", "gemini-2.5-flash"}
}

func trailerResizeStill(ctx context.Context, src, dest string) error {
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	filter := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease", trailerReviewMaxSide, trailerReviewMaxSide)
	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-v", "error", "-i", src, "-vf", filter, "-q:v", "5", dest)
	if combined, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("resize review still: %w: %s", err, tailOutput(combined))
	}
	return nil
}

func trailerStillDataURL(ctx context.Context, workDir, name, sourceURL string) (string, error) {
	raw := filepath.Join(workDir, name+"-src")
	if err := downloadToFile(ctx, sourceURL, raw); err != nil {
		return "", err
	}
	jpg := filepath.Join(workDir, name+"-800.jpg")
	if err := trailerResizeStill(ctx, raw, jpg); err != nil {
		return "", err
	}
	blob, err := os.ReadFile(jpg)
	if err != nil || len(blob) == 0 {
		return "", fmt.Errorf("review still empty")
	}
	return "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(blob), nil
}

func callTrailerFlashJSON(ctx context.Context, prompt string, images []string) ([]byte, error) {
	key := dramatizeGeminiKey()
	if key == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not set")
	}
	parts := []map[string]interface{}{{"text": prompt}}
	for _, image := range images {
		raw := strings.TrimPrefix(image, "data:image/jpeg;base64,")
		if raw == image {
			continue
		}
		parts = append(parts, map[string]interface{}{"inline_data": map[string]string{"mime_type": "image/jpeg", "data": raw}})
	}
	payload := map[string]interface{}{
		"contents":         []map[string]interface{}{{"role": "user", "parts": parts}},
		"generationConfig": map[string]interface{}{"temperature": 0.2, "responseMimeType": "application/json"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	base := strings.TrimRight(getEnv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"), "/")
	var last error
	for _, model := range trailerReviewModels() {
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v1beta/models/%s:generateContent", base, model), bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-goog-api-key", key)
		resp, err := dramatizePlannerClient.Do(req)
		if err != nil {
			last = err
			continue
		}
		blob, err := readLimited(resp.Body, 1<<20)
		resp.Body.Close()
		if err != nil {
			last = err
			continue
		}
		if resp.StatusCode >= 300 {
			last = fmt.Errorf("flash review %s returned %d: %s", model, resp.StatusCode, tailOutput(blob))
			continue
		}
		var parsed struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						Text string `json:"text"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if json.Unmarshal(blob, &parsed) != nil {
			last = fmt.Errorf("parse flash review")
			continue
		}
		var text strings.Builder
		for _, c := range parsed.Candidates {
			for _, p := range c.Content.Parts {
				text.WriteString(p.Text)
			}
		}
		if strings.TrimSpace(text.String()) == "" {
			last = fmt.Errorf("flash review returned no text")
			continue
		}
		return []byte(extractJSONObject(text.String())), nil
	}
	if last == nil {
		last = fmt.Errorf("flash review unavailable")
	}
	return nil, last
}

func reviewTrailerSheetFlash(ctx context.Context, workDir string, world, character RemakeReferenceAsset) (score float64, issues []string, correction string, err error) {
	var images []string
	if world.ImageURL != "" {
		if url, stillErr := trailerStillDataURL(ctx, workDir, "world-"+character.ID, world.ImageURL); stillErr == nil {
			images = append(images, url)
		}
	}
	sheet, err := trailerStillDataURL(ctx, workDir, "sheet-"+character.ID, character.ImageURL)
	if err != nil {
		return 0, nil, "", err
	}
	images = append(images, sheet)
	prompt := fmt.Sprintf(`Score 0-1 whether this identity sheet is one stable person matching: %s.
Ignore pose. Flag extra people, costume drift, age drift, or a different face. Below 0.84 needs a surgical correction prompt.
Return JSON {"score":0.0,"identity_issues":["..."],"correction_prompt":"..."}.`, character.Description)
	blob, err := callTrailerFlashJSON(ctx, prompt, images)
	if err != nil {
		return 0, nil, "", err
	}
	var reply struct {
		Score            float64  `json:"score"`
		IdentityIssues   []string `json:"identity_issues"`
		CorrectionPrompt string   `json:"correction_prompt"`
	}
	if json.Unmarshal(blob, &reply) != nil {
		return 0, nil, "", fmt.Errorf("flash sheet JSON")
	}
	return reply.Score, reply.IdentityIssues, reply.CorrectionPrompt, nil
}

func auditTrailerCharacterFlash(ctx context.Context, workDir string, character RemakeReferenceAsset, results []dramatizeShotResult) ([]RemakeConsistencyScore, error) {
	if character.ImageURL == "" {
		return nil, nil
	}
	sheet, err := trailerStillDataURL(ctx, workDir, "audit-sheet-"+character.ID, character.ImageURL)
	if err != nil {
		return nil, err
	}
	var images []string
	images = append(images, sheet)
	valid := map[string]bool{}
	var labels []string
	for _, result := range results {
		if result.ImageURL == "" || !trailerShotShowsPerson(result.Shot, character) {
			continue
		}
		still, stillErr := trailerStillDataURL(ctx, workDir, "audit-"+character.ID+"-"+result.Shot.ID, result.ImageURL)
		if stillErr != nil {
			continue
		}
		valid[result.Shot.ID] = true
		labels = append(labels, result.Shot.ID)
		images = append(images, still)
	}
	if len(valid) == 0 {
		return nil, nil
	}
	prompt := fmt.Sprintf(`Image 1 is the identity sheet for %s. Each following image is a start frame in order: %s.
Score 0-1 identity only (face, age, hair, body, costume). Ignore pose, crop, emotion, lighting, and story-state.
Also note if a frame is confusing rather than mysterious (audience cannot tell who to follow or what is happening).
Return JSON {"shots":[{"shot_id":"shot_001","score":0.9,"identity_issues":[],"correction_prompt":"","confused":false}]}.`, character.ID, strings.Join(labels, ", "))
	blob, err := callTrailerFlashJSON(ctx, prompt, images)
	if err != nil {
		return nil, err
	}
	var reply remakeConsistencyReply
	if json.Unmarshal(blob, &reply) != nil {
		return nil, fmt.Errorf("flash audit JSON")
	}
	out := make([]RemakeConsistencyScore, 0, len(reply.Shots))
	for _, item := range reply.Shots {
		if !valid[item.ShotID] {
			continue
		}
		score := item.Score
		if score < 0 {
			score = 0
		}
		if score > 1 {
			score = 1
		}
		out = append(out, RemakeConsistencyScore{ShotID: item.ShotID, CharacterID: character.ID, Score: score, IdentityIssues: item.IdentityIssues, CorrectionPrompt: item.CorrectionPrompt})
	}
	return out, nil
}

func trailerShotShowsPerson(shot DramatizeShot, character RemakeReferenceAsset) bool {
	for _, id := range normalizeCharacterIDs(shot.Characters) {
		if trailerSamePerson(id, character.ID) {
			return true
		}
	}
	name := strings.ToLower(strings.TrimSpace(character.Name))
	if name == "" {
		return false
	}
	hay := strings.ToLower(shot.VisualDescription + " " + shot.ImagePrompt)
	return strings.Contains(hay, name)
}
