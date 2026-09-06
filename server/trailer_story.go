package main

// Trailer story/prompt pass: Grok 4.6 writes the cut and prompts.
// Craft notes are guidance, not a checklist. Preserve the user's beats.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

const trailerStoryModelDefault = "grok-4.6"

const trailerCraftGuidance = `You are writing a cinematic trailer, not a plot summary.
Preserve the user's story, world, and character bible. Do not invent a different premise, narrator, or ending.
Useful tendencies, not rules: the audience should know who we follow, what they want, what just broke, and what it might cost them; withhold the solution.
Each shot earns its place with one dominant visual idea. Dialogue is in-world, specific to these people, never generic save-the-world lines. Cut into conflict; do not show who wins a swing.
Sound can arrive before the image. Silence can sit before a title. Mystery is a clear question without an answer; confusion is not knowing what to ask.
If the user already listed SHOT lines, keep that order and those events. Tighten camera, performance, and prompts.`

func trailerStoryModel() string {
	return firstNonEmpty(strings.TrimSpace(getEnv("TRAILER_STORY_MODEL", "")), trailerStoryModelDefault)
}

func callTrailerGrokJSON(ctx context.Context, system, user string) ([]byte, error) {
	key := dramatizeXAIKey()
	if key == "" {
		return nil, fmt.Errorf("XAI_API_KEY is not set")
	}
	payload := map[string]interface{}{
		"model": trailerStoryModel(),
		"messages": []map[string]interface{}{
			{"role": "system", "content": system},
			{"role": "user", "content": user},
		},
		"temperature":     0.7,
		"response_format": map[string]string{"type": "json_object"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.x.ai/v1/chat/completions", bytes.NewReader(mustJSON(payload)))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+key)
	resp, err := dramatizePlannerClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	blob, err := readLimited(resp.Body, 2<<20)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("grok trailer craft returned %d: %s", resp.StatusCode, tailOutput(blob))
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(blob, &parsed) != nil || len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return nil, fmt.Errorf("grok trailer craft returned no JSON")
	}
	return []byte(extractJSONObject(parsed.Choices[0].Message.Content)), nil
}

type trailerCraftReply struct {
	Title            string             `json:"title"`
	EmotionalPromise string             `json:"emotional_promise"`
	Shots            []trailerCraftShot `json:"shots"`
}

type trailerCraftShot struct {
	ID                 string   `json:"id"`
	VisualDescription  string   `json:"visual_description"`
	Camera             string   `json:"camera"`
	Lighting           string   `json:"lighting"`
	Emotion            string   `json:"emotion"`
	Characters         []string `json:"characters"`
	ImagePrompt        string   `json:"image_prompt"`
	MotionPrompt       string   `json:"motion_prompt"`
	DialogueTranscript string   `json:"dialogue_transcript"`
	DirectorNote       string   `json:"director_note"`
}

func craftTrailerShots(ctx context.Context, req dramatizeRequest, shots []DramatizeShot) ([]DramatizeShot, error) {
	if len(shots) == 0 {
		return shots, fmt.Errorf("no shots to craft")
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"brief": req.Prompt, "setting_bible": req.SettingPrompt, "character_bible": req.CharacterBible, "shots": shots,
	})
	blob, err := callTrailerGrokJSON(ctx, trailerCraftGuidance+`

Return JSON: {"title":"...","emotional_promise":"one sentence","shots":[{
  "id":"shot_001","visual_description":"...","camera":"...","lighting":"...","emotion":"...","characters":["..."],
  "image_prompt":"self-contained production still with canonical visible traits, no captions",
  "motion_prompt":"camera and performance for image-to-video, lip sync if speaking, no subtitles",
  "dialogue_transcript":"Speaker 1: [tag] line or empty","director_note":"optional"
}]}
Keep the same shot ids and count. Seconds stay as supplied.`, string(payload))
	if err != nil {
		return shots, err
	}
	var reply trailerCraftReply
	if json.Unmarshal(blob, &reply) != nil || len(reply.Shots) == 0 {
		return shots, fmt.Errorf("grok returned no crafted shots")
	}
	byID := map[string]trailerCraftShot{}
	for _, item := range reply.Shots {
		byID[strings.TrimSpace(item.ID)] = item
	}
	out := append([]DramatizeShot(nil), shots...)
	for i := range out {
		item, ok := byID[out[i].ID]
		if !ok && i < len(reply.Shots) {
			item = reply.Shots[i]
		}
		if strings.TrimSpace(item.VisualDescription) != "" {
			out[i].VisualDescription = strings.TrimSpace(item.VisualDescription)
		}
		if strings.TrimSpace(item.Camera) != "" {
			out[i].Camera = strings.TrimSpace(item.Camera)
		}
		if strings.TrimSpace(item.Lighting) != "" {
			out[i].Lighting = strings.TrimSpace(item.Lighting)
		}
		if strings.TrimSpace(item.Emotion) != "" {
			out[i].Emotion = strings.TrimSpace(item.Emotion)
		}
		if len(item.Characters) > 0 {
			out[i].Characters = normalizeCharacterIDs(item.Characters)
		}
		if strings.TrimSpace(item.ImagePrompt) != "" {
			out[i].ImagePrompt = strings.TrimSpace(item.ImagePrompt)
		}
		if strings.TrimSpace(item.MotionPrompt) != "" {
			out[i].MotionPrompt = strings.TrimSpace(item.MotionPrompt)
		}
		if strings.TrimSpace(item.DialogueTranscript) != "" {
			out[i].DialogueTranscript = strings.TrimSpace(item.DialogueTranscript)
		}
		if strings.TrimSpace(item.DirectorNote) != "" {
			out[i].DirectorNote = strings.TrimSpace(item.DirectorNote)
		}
	}
	if promise := strings.TrimSpace(reply.EmotionalPromise); promise != "" && out[0].DirectorNote == "" {
		out[0].DirectorNote = promise
	}
	return out, nil
}

func planTrailerShotsGrok(ctx context.Context, req dramatizeRequest) ([]DramatizeShot, error) {
	user := fmt.Sprintf(`Plan exactly %d shots, each %.0f seconds, 16:9, in-world dialogue only.
Brief: %s
Setting: %s
Character bible: %s
Return the craft JSON with that many shots.`, req.MaxShots, req.Seconds, req.Prompt, firstNonEmpty(req.SettingPrompt, "Infer one coherent world."), firstNonEmpty(req.CharacterBible, "Infer recurring people."))
	blob, err := callTrailerGrokJSON(ctx, trailerCraftGuidance+`
Return JSON: {"title":"...","emotional_promise":"one sentence","shots":[{
  "id":"shot_001","visual_description":"...","camera":"...","lighting":"...","emotion":"...","characters":["..."],
  "image_prompt":"self-contained production still with canonical visible traits, no captions",
  "motion_prompt":"camera and performance for image-to-video, lip sync if speaking, no subtitles",
  "dialogue_transcript":"Speaker 1: [tag] line or empty","director_note":"optional"
}]}`, user)
	if err != nil {
		return nil, err
	}
	var reply trailerCraftReply
	if json.Unmarshal(blob, &reply) != nil || len(reply.Shots) == 0 {
		return nil, fmt.Errorf("grok returned no trailer shots")
	}
	shots := make([]DramatizeShot, 0, len(reply.Shots))
	for i, item := range reply.Shots {
		if i >= req.MaxShots {
			break
		}
		shot := DramatizeShot{
			ID: fmt.Sprintf("shot_%03d", i+1), Kind: dramatizeShotKindGenerated, Order: i + 1, Seconds: req.Seconds,
			AspectRatio: "16:9", ImageModel: req.ImageModel, VisualDescription: item.VisualDescription,
			Camera: item.Camera, Lighting: item.Lighting, Emotion: item.Emotion,
			Characters: normalizeCharacterIDs(item.Characters), ImagePrompt: item.ImagePrompt, MotionPrompt: item.MotionPrompt,
			DialogueTranscript: item.DialogueTranscript, DirectorNote: item.DirectorNote,
		}
		if shot.ImagePrompt == "" {
			shot.ImagePrompt = shot.VisualDescription
		}
		if shot.MotionPrompt == "" {
			shot.MotionPrompt = shot.VisualDescription
		}
		shots = append(shots, shot)
	}
	if len(shots) == 0 {
		return nil, fmt.Errorf("grok returned no usable trailer shots")
	}
	return shots, nil
}

func trailerSamePerson(a, b string) bool {
	a, b = canonicalCharacterID(a), canonicalCharacterID(b)
	if a == "" || b == "" {
		return false
	}
	if a == b {
		return true
	}
	return strings.HasPrefix(a, b+"-") || strings.HasPrefix(b, a+"-")
}
