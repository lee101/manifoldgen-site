package main

// Luna-backed prompt harmonization and visual consistency control for remake
// mode. Image generation is deliberately split from motion generation so the
// identity audit can repair weak start frames before paid animation begins.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
)

const (
	remakeLunaModel                = "gpt-5.6-luna"
	remakeDefaultConsistencyPasses = 2
	remakeMaxConsistencyPasses     = 3
	remakeConsistencyThreshold     = 0.84
)

type RemakeStyleBible struct {
	RenderingLanguage string   `json:"rendering_language,omitempty"`
	WorldDesign       string   `json:"world_design,omitempty"`
	CameraLanguage    string   `json:"camera_language,omitempty"`
	Lighting          string   `json:"lighting,omitempty"`
	Palette           string   `json:"palette,omitempty"`
	Materials         string   `json:"materials,omitempty"`
	ContinuityRules   []string `json:"continuity_rules,omitempty"`
	NegativeRules     []string `json:"negative_rules,omitempty"`
}

type RemakeCharacterSpec struct {
	ID                  string   `json:"id"`
	Name                string   `json:"name"`
	DetailedDescription string   `json:"detailed_description"`
	Face                string   `json:"face"`
	Hair                string   `json:"hair"`
	Anatomy             string   `json:"anatomy"`
	Costume             string   `json:"costume"`
	Palette             string   `json:"palette"`
	Proportions         string   `json:"proportions"`
	SignatureProps      []string `json:"signature_props"`
	MustKeep            []string `json:"must_keep"`
	MustAvoid           []string `json:"must_avoid"`
	ShotIDs             []string `json:"shot_ids"`
}

type remakeHarmonizedReply struct {
	StyleBible     RemakeStyleBible      `json:"style_bible"`
	CharacterSpecs []RemakeCharacterSpec `json:"character_specs"`
	Shots          []remakeVisionShot    `json:"shots"`
}

type RemakeConsistencyScore struct {
	ShotID           string   `json:"shot_id"`
	CharacterID      string   `json:"character_id"`
	Score            float64  `json:"score"`
	IdentityIssues   []string `json:"identity_issues,omitempty"`
	CorrectionPrompt string   `json:"correction_prompt,omitempty"`
}

type RemakeConsistencyAudit struct {
	Pass        int                      `json:"pass"`
	Scores      []RemakeConsistencyScore `json:"scores"`
	Regenerated []string                 `json:"regenerated_shot_ids,omitempty"`
}

type remakeConsistencyReply struct {
	Shots []struct {
		ShotID           string   `json:"shot_id"`
		Score            float64  `json:"score"`
		IdentityIssues   []string `json:"identity_issues"`
		CorrectionPrompt string   `json:"correction_prompt"`
	} `json:"shots"`
}

func remakeOpenAIKey() string { return strings.TrimSpace(getEnv("OPENAI_API_KEY", "")) }

func callRemakeOpenAIJSON(ctx context.Context, model, instructions string, content []map[string]interface{}, schemaName string, schema map[string]interface{}) ([]byte, error) {
	if remakeOpenAIKey() == "" {
		return nil, fmt.Errorf("OPENAI_API_KEY is not configured")
	}
	payload := map[string]interface{}{
		"model":        model,
		"instructions": instructions,
		"input":        []map[string]interface{}{{"role": "user", "content": content}},
		"reasoning":    map[string]string{"effort": "high"},
		"text": map[string]interface{}{
			"verbosity": "high",
			"format":    map[string]interface{}{"type": "json_schema", "name": schemaName, "strict": true, "schema": schema},
		},
		"store": false,
	}
	endpoint := strings.TrimRight(getEnv("OPENAI_BASE_URL", "https://api.openai.com/v1"), "/") + "/responses"
	request, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(mustJSON(payload)))
	request.Header.Set("Authorization", "Bearer "+remakeOpenAIKey())
	request.Header.Set("Content-Type", "application/json")
	response, err := backendClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	blob, err := readLimited(response.Body, 12<<20)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 300 {
		return nil, fmt.Errorf("OpenAI remake analysis returned %d: %s", response.StatusCode, tailOutput(blob))
	}
	var envelope struct {
		Output []struct {
			Content []struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"content"`
		} `json:"output"`
	}
	if err := json.Unmarshal(blob, &envelope); err != nil {
		return nil, err
	}
	var text strings.Builder
	for _, item := range envelope.Output {
		for _, part := range item.Content {
			if part.Type == "output_text" || part.Type == "text" {
				text.WriteString(part.Text)
			}
		}
	}
	if text.Len() == 0 {
		return nil, fmt.Errorf("OpenAI remake analysis returned no JSON")
	}
	return []byte(extractJSONObject(text.String())), nil
}

func stringArraySchema() map[string]interface{} {
	return map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}}
}

func remakeVisionShotSchema() map[string]interface{} {
	properties := map[string]interface{}{
		"id": map[string]string{"type": "string"}, "visual_description": map[string]string{"type": "string"},
		"action": map[string]string{"type": "string"}, "camera": map[string]string{"type": "string"},
		"lighting": map[string]string{"type": "string"}, "environment": map[string]string{"type": "string"},
		"emotion": map[string]string{"type": "string"}, "continuity": map[string]string{"type": "string"},
		"characters": stringArraySchema(), "visible_traits": stringArraySchema(), "remove_artifacts": stringArraySchema(),
		"image_prompt": map[string]string{"type": "string"}, "motion_prompt": map[string]string{"type": "string"},
	}
	return map[string]interface{}{"type": "object", "additionalProperties": false, "properties": properties,
		"required": []string{"id", "visual_description", "action", "camera", "lighting", "environment", "emotion", "continuity", "characters", "visible_traits", "remove_artifacts", "image_prompt", "motion_prompt"}}
}

func remakeVisionReplySchema() map[string]interface{} {
	return map[string]interface{}{"type": "object", "additionalProperties": false,
		"properties": map[string]interface{}{"shots": map[string]interface{}{"type": "array", "items": remakeVisionShotSchema()}},
		"required":   []string{"shots"}}
}

func callRemakeLunaVision(ctx context.Context, req dramatizeRequest, frames []dramatizeFrame, shots []DramatizeShot) (*remakeVisionReply, error) {
	content := []map[string]interface{}{{"type": "input_text", "text": remakeVisionInstruction(req, shots)}}
	for i, frame := range frames {
		content = append(content,
			map[string]interface{}{"type": "input_text", "text": fmt.Sprintf("%s — source midpoint %.3fs", shots[i].ID, frame.Time)},
			map[string]interface{}{"type": "input_image", "image_url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(frame.JPEG), "detail": "original"},
		)
	}
	blob, err := callRemakeOpenAIJSON(ctx, remakeLunaModel,
		"You are a meticulous film continuity supervisor and visual-development artist. Observe literally before rewriting. Never infer a generic archetype when the supplied character bible or source frame provides distinctive evidence.",
		content, "remake_shot_analysis", remakeVisionReplySchema())
	if err != nil {
		return nil, err
	}
	var reply remakeVisionReply
	if err := json.Unmarshal(blob, &reply); err != nil || len(reply.Shots) == 0 {
		return nil, fmt.Errorf("Luna returned invalid shot analysis")
	}
	return &reply, nil
}

func harmonizeRemakePrompts(ctx context.Context, req dramatizeRequest, shots []DramatizeShot) (RemakeStyleBible, []RemakeCharacterSpec, []DramatizeShot, error) {
	input, _ := json.Marshal(map[string]interface{}{"goal": req.Prompt, "setting_bible": req.SettingPrompt, "character_bible": req.CharacterBible, "shots": shots})
	content := []map[string]interface{}{{"type": "input_text", "text": `Rewrite the entire supplied timeline as one internally consistent production package.
First synthesize one highly specific art-direction bible. It must name the rendering language, world design, camera language, lighting, palette, materials, continuity rules, and negative rules. Keep the user's requested medium stable across every shot; do not drift between photographic live action, generic fantasy, anime, old game graphics, or unrelated franchise aesthetics.
Then synthesize one canonical high-detail specification per recurring character by reconciling the user bible with all observed appearances. Make face, hair, anatomy, costume construction, palette, proportions, signature props, must-keep traits, and must-avoid traits explicit. Never transfer a distinctive trait between characters.
Finally rewrite every image prompt and motion prompt. Each image prompt must be self-contained, preserve the source story beat/composition, repeat the shared style anchor, name only characters actually present, embed their exact canonical visible traits, specify emotional performance and eyelines, remove source HUD/text/artifacts where appropriate, and state shot-specific negatives. Preserve IDs and timing order. Every prompt should be detailed enough for an image model without access to earlier text.`}, {"type": "input_text", "text": string(input)}}
	blob, err := callRemakeOpenAIJSON(ctx, remakeLunaModel,
		"You are the final prompt continuity editor for a feature-length remake. Resolve contradictions globally, preserve literal story actions, and return every supplied shot exactly once.",
		content, "remake_prompt_harmonization", remakeHarmonizedSchema())
	if err != nil {
		return RemakeStyleBible{}, nil, shots, err
	}
	var reply remakeHarmonizedReply
	if err := json.Unmarshal(blob, &reply); err != nil || len(reply.Shots) != len(shots) {
		return RemakeStyleBible{}, nil, shots, fmt.Errorf("Luna returned incomplete harmonization")
	}
	byID := map[string]remakeVisionShot{}
	for _, item := range reply.Shots {
		byID[item.ID] = item
	}
	refined := append([]DramatizeShot(nil), shots...)
	for i := range refined {
		item, ok := byID[refined[i].ID]
		if !ok {
			return RemakeStyleBible{}, nil, shots, fmt.Errorf("harmonization omitted %s", refined[i].ID)
		}
		applyRemakeVisionShot(&refined[i], item, req)
	}
	return reply.StyleBible, reply.CharacterSpecs, refined, nil
}

func remakeHarmonizedSchema() map[string]interface{} {
	styleProperties := map[string]interface{}{
		"rendering_language": map[string]string{"type": "string"}, "world_design": map[string]string{"type": "string"},
		"camera_language": map[string]string{"type": "string"}, "lighting": map[string]string{"type": "string"},
		"palette": map[string]string{"type": "string"}, "materials": map[string]string{"type": "string"},
		"continuity_rules": stringArraySchema(), "negative_rules": stringArraySchema(),
	}
	style := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": styleProperties,
		"required": []string{"rendering_language", "world_design", "camera_language", "lighting", "palette", "materials", "continuity_rules", "negative_rules"}}
	characterProperties := map[string]interface{}{
		"id": map[string]string{"type": "string"}, "name": map[string]string{"type": "string"}, "detailed_description": map[string]string{"type": "string"},
		"face": map[string]string{"type": "string"}, "hair": map[string]string{"type": "string"}, "anatomy": map[string]string{"type": "string"},
		"costume": map[string]string{"type": "string"}, "palette": map[string]string{"type": "string"}, "proportions": map[string]string{"type": "string"},
		"signature_props": stringArraySchema(), "must_keep": stringArraySchema(), "must_avoid": stringArraySchema(), "shot_ids": stringArraySchema(),
	}
	character := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": characterProperties,
		"required": []string{"id", "name", "detailed_description", "face", "hair", "anatomy", "costume", "palette", "proportions", "signature_props", "must_keep", "must_avoid", "shot_ids"}}
	return map[string]interface{}{"type": "object", "additionalProperties": false,
		"properties": map[string]interface{}{"style_bible": style, "character_specs": map[string]interface{}{"type": "array", "items": character}, "shots": map[string]interface{}{"type": "array", "items": remakeVisionShotSchema()}},
		"required":   []string{"style_bible", "character_specs", "shots"}}
}

func applyRemakeVisionShot(shot *DramatizeShot, item remakeVisionShot, req dramatizeRequest) {
	shot.VisualDescription = strings.TrimSpace(item.VisualDescription)
	shot.Action = strings.TrimSpace(item.Action)
	shot.Camera = strings.TrimSpace(item.Camera)
	shot.Lighting = strings.TrimSpace(item.Lighting)
	shot.Environment = strings.TrimSpace(item.Environment)
	shot.Emotion = strings.TrimSpace(item.Emotion)
	shot.Continuity = strings.TrimSpace(item.Continuity)
	shot.Characters = normalizeCharacterIDs(item.Characters)
	shot.VisibleTraits = item.VisibleTraits
	shot.RemoveArtifacts = item.RemoveArtifacts
	shot.ImagePrompt = strings.TrimSpace(item.ImagePrompt)
	shot.MotionPrompt = strings.TrimSpace(item.MotionPrompt)
	if shot.ImagePrompt == "" || shot.MotionPrompt == "" {
		fallbackRemakePrompt(shot, req.Prompt)
	}
}

func characterSpecByID(specs []RemakeCharacterSpec, id string) *RemakeCharacterSpec {
	for i := range specs {
		if canonicalCharacterID(specs[i].ID) == id {
			return &specs[i]
		}
	}
	return nil
}

func auditRemakeCharacter(ctx context.Context, character RemakeReferenceAsset, results []dramatizeShotResult) ([]RemakeConsistencyScore, error) {
	if character.ImageURL == "" {
		return nil, nil
	}
	content := []map[string]interface{}{
		{"type": "input_text", "text": fmt.Sprintf("Canonical character ID: %s. Image 1 is the authoritative identity sheet. Score each following generated shot only for this character's identity consistency against Image 1. Ignore pose, crop, emotion, lighting, and intentional story-state changes unless they alter identity. Compare face geometry, age, hair design, anatomy, body proportions, costume construction, palette, and signature props. A score of 1.0 is a clear match; below 0.84 needs regeneration. Write a surgical correction prompt that preserves the shot's action/composition while fixing only identity drift.", character.ID)},
		{"type": "input_image", "image_url": character.ImageURL, "detail": "original"},
	}
	valid := map[string]bool{}
	for _, result := range results {
		if result.ImageURL == "" || !containsRemakeString(normalizeCharacterIDs(result.Shot.Characters), character.ID) {
			continue
		}
		valid[result.Shot.ID] = true
		content = append(content, map[string]interface{}{"type": "input_text", "text": "Generated appearance " + result.Shot.ID}, map[string]interface{}{"type": "input_image", "image_url": result.ImageURL, "detail": "original"})
	}
	if len(valid) == 0 {
		return nil, nil
	}
	scoreProperties := map[string]interface{}{
		"shot_id": map[string]string{"type": "string"}, "score": map[string]string{"type": "number"},
		"identity_issues": stringArraySchema(), "correction_prompt": map[string]string{"type": "string"},
	}
	score := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": scoreProperties, "required": []string{"shot_id", "score", "identity_issues", "correction_prompt"}}
	schema := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": map[string]interface{}{"shots": map[string]interface{}{"type": "array", "items": score}}, "required": []string{"shots"}}
	blob, err := callRemakeOpenAIJSON(ctx, remakeLunaModel, "You are a strict character-continuity grader. Use only visible evidence and the authoritative identity sheet. Do not reward general style similarity when identity differs.", content, "remake_character_consistency", schema)
	if err != nil {
		return nil, err
	}
	var reply remakeConsistencyReply
	if err := json.Unmarshal(blob, &reply); err != nil {
		return nil, err
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

func containsRemakeString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

func refineRemakeConsistency(ctx context.Context, user *User, req dramatizeRequest, results []dramatizeShotResult, frames []dramatizeFrame, references []RemakeReferenceAsset) ([]dramatizeShotResult, []RemakeConsistencyAudit) {
	passes := req.ConsistencyPasses
	if !req.ConsistentCharacters || passes <= 0 {
		return results, nil
	}
	if passes > remakeMaxConsistencyPasses {
		passes = remakeMaxConsistencyPasses
	}
	var audits []RemakeConsistencyAudit
	for pass := 1; pass <= passes+1; pass++ {
		audit := RemakeConsistencyAudit{Pass: pass}
		for _, character := range references {
			if character.Kind != "character" || character.Error != "" {
				continue
			}
			scores, err := auditRemakeCharacter(ctx, character, results)
			if err != nil {
				continue
			}
			audit.Scores = append(audit.Scores, scores...)
		}
		worst := map[string]RemakeConsistencyScore{}
		for i := range results {
			results[i].ConsistencyScore = 0
		}
		for _, score := range audit.Scores {
			if index := resultIndexByShotID(results, score.ShotID); index >= 0 && (results[index].ConsistencyScore == 0 || score.Score < results[index].ConsistencyScore) {
				results[index].ConsistencyScore = score.Score
			}
			current, ok := worst[score.CharacterID]
			if !ok || score.Score < current.Score {
				worst[score.CharacterID] = score
			}
		}
		for _, score := range worst {
			if pass > passes {
				continue
			}
			if score.Score >= remakeConsistencyThreshold {
				continue
			}
			index := resultIndexByShotID(results, score.ShotID)
			if index < 0 {
				continue
			}
			url, err := regenerateRemakeFrame(ctx, user, results[index].Shot, frames, references, score.CorrectionPrompt)
			if err == nil && url != "" {
				results[index].ImageURL = url
				results[index].Regenerations++
				results[index].ConsistencyScore = score.Score
				audit.Regenerated = append(audit.Regenerated, score.ShotID)
			}
		}
		sort.Strings(audit.Regenerated)
		audits = append(audits, audit)
		if len(audit.Regenerated) == 0 {
			break
		}
	}
	return results, audits
}

func resultIndexByShotID(results []dramatizeShotResult, id string) int {
	for i := range results {
		if results[i].Shot.ID == id {
			return i
		}
	}
	return -1
}

func regenerateRemakeFrame(ctx context.Context, user *User, shot DramatizeShot, frames []dramatizeFrame, references []RemakeReferenceAsset, correction string) (string, error) {
	frame := nearestFrame(frames, shot.SourceFrameTime)
	if frame == nil {
		return "", fmt.Errorf("no source frame")
	}
	frameURL, err := uploadDramatizeArtifact(ctx, frame.Path, user.ID, "image/jpeg")
	if err != nil {
		return "", err
	}
	prompt := shot.ImagePrompt + " CONSISTENCY REPAIR: " + correction + " The authoritative character sheet overrides conflicting source details. Preserve the exact action, composition, camera, environment, and all characters not named by the correction."
	blob, err := proxyOpenPathsModelImage(ServiceUsageRequest{Service: "openpaths_image", Model: shot.ImageModel, Prompt: prompt, ImageURL: frameURL, ReferenceImageURLs: remakeShotReferenceURLs(shot, references), AspectRatio: shot.AspectRatio, N: 1})
	if err != nil {
		return "", err
	}
	return extractImageURL(blob)
}

func animateRemakeShots(ctx context.Context, results []dramatizeShotResult) ([]dramatizeShotResult, error) {
	sem := make(chan struct{}, dramatizeShotConcurrency)
	var wg sync.WaitGroup
	for i := range results {
		if results[i].Error != "" || results[i].ImageURL == "" {
			continue
		}
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				results[index].Error = ctx.Err().Error()
				return
			}
			url, err := dramatizeAnimateImage(ctx, results[index].Shot, results[index].ImageURL)
			if err != nil {
				results[index].Error = err.Error()
				return
			}
			results[index].ClipURL = url
		}(i)
	}
	wg.Wait()
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	return results, nil
}
