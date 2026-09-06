package main

// Shot planning for the video dramatizer. The planner turns a free-form brief
// ("dramatize this robot experience, first an anime team builds it, then...")
// plus what we measured about the source clip into a concrete, validated shot
// list the executor can run.
//
// Three providers, tried in order: Gemini (vision, preferred), xAI Grok
// (vision, already configured on this deployment), and a deterministic
// prompt-segmenting planner that needs no API key at all. The deterministic
// path is what keeps the tool working — and testable — with zero LLM config.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"time"
)

const (
	dramatizeShotKindGenerated = "generated"
	dramatizeShotKindRestyled  = "restyled_source"
	dramatizeShotKindSource    = "source"

	dramatizeMaxShots      = 10
	dramatizeMinShotLength = 2.0
	dramatizeMaxShotLength = 10.0
)

// DramatizeShot is one entry on the generated timeline.
type DramatizeShot struct {
	ID    string `json:"id"`
	Kind  string `json:"kind"`
	Order int    `json:"order"`
	// Seconds is the intended on-timeline length of the shot.
	Seconds float64 `json:"seconds"`

	// generated / restyled_source
	ImagePrompt  string `json:"image_prompt,omitempty"`
	MotionPrompt string `json:"motion_prompt,omitempty"`
	// Remake mode keeps the vision model's literal observation separate from
	// the creative edit instruction so users can guide or revise either one.
	VisualDescription  string   `json:"visual_description,omitempty"`
	Action             string   `json:"action,omitempty"`
	Camera             string   `json:"camera,omitempty"`
	Lighting           string   `json:"lighting,omitempty"`
	Environment        string   `json:"environment,omitempty"`
	Emotion            string   `json:"emotion,omitempty"`
	Continuity         string   `json:"continuity,omitempty"`
	VisibleTraits      []string `json:"visible_traits,omitempty"`
	RemoveArtifacts    []string `json:"remove_artifacts,omitempty"`
	Characters         []string `json:"characters,omitempty"`
	DirectorNote       string   `json:"director_note,omitempty"`
	DialogueTranscript string   `json:"dialogue_transcript,omitempty"`
	ImageModel         string   `json:"image_model,omitempty"`
	VideoModel         string   `json:"video_model,omitempty"`
	AspectRatio        string   `json:"aspect_ratio,omitempty"`
	// SourceFrameTime picks the frame of the original that a restyled shot
	// repaints, which is how source footage gets carried into the new style.
	SourceFrameTime float64 `json:"source_frame_time,omitempty"`

	// source
	SourceStart float64 `json:"source_start,omitempty"`
	SourceEnd   float64 `json:"source_end,omitempty"`

	Note string `json:"note,omitempty"`
}

// DramatizePlan is the validated output of the planning stage.
type DramatizePlan struct {
	Title          string                 `json:"title"`
	Concept        string                 `json:"concept"`
	Provider       string                 `json:"provider"`
	Width          int                    `json:"width"`
	Height         int                    `json:"height"`
	Shots          []DramatizeShot        `json:"shots"`
	References     []RemakeReferenceAsset `json:"references,omitempty"`
	StyleBible     RemakeStyleBible       `json:"style_bible,omitempty"`
	CharacterSpecs []RemakeCharacterSpec  `json:"character_specs,omitempty"`
}

// TotalSeconds is the planned runtime of the finished edit.
func (p *DramatizePlan) TotalSeconds() float64 {
	var total float64
	for _, s := range p.Shots {
		total += s.Seconds
	}
	return total
}

// CountByKind reports how many shots of each kind the plan contains, which
// drives the cost estimate.
func (p *DramatizePlan) CountByKind() (generated, restyled, source int) {
	for _, s := range p.Shots {
		switch s.Kind {
		case dramatizeShotKindGenerated:
			generated++
		case dramatizeShotKindRestyled:
			restyled++
		case dramatizeShotKindSource:
			source++
		}
	}
	return
}

// dramatizeBrief is everything the planner knows about the job.
type dramatizeBrief struct {
	Prompt   string
	Probe    dramatizeProbe
	Audio    *AudioAnalysis
	Frames   []dramatizeFrame
	MaxShots int
}

// dramatizeFrame is a sampled still from the source, used both as vision input
// and as the repaint source for restyled shots.
type dramatizeFrame struct {
	Time  float64
	Path  string
	JPEG  []byte
	Label string
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

// planDramatization produces a validated shot plan, falling back through the
// available providers. It never returns an empty plan without an error.
func planDramatization(ctx context.Context, brief dramatizeBrief) (*DramatizePlan, error) {
	if brief.MaxShots <= 0 || brief.MaxShots > dramatizeMaxShots {
		brief.MaxShots = dramatizeMaxShots
	}

	type attempt struct {
		name string
		run  func(context.Context, dramatizeBrief) (*DramatizePlan, error)
	}
	attempts := []attempt{}
	if dramatizeGeminiKey() != "" {
		attempts = append(attempts, attempt{"gemini", planWithGemini})
	}
	if dramatizeXAIKey() != "" {
		attempts = append(attempts, attempt{"xai", planWithXAI})
	}

	var lastErr error
	for _, a := range attempts {
		plan, err := a.run(ctx, brief)
		if err != nil {
			// A planner outage must not fail a paid job; fall through.
			lastErr = fmt.Errorf("%s planner: %w", a.name, err)
			continue
		}
		if err := plan.normalize(brief); err != nil {
			lastErr = fmt.Errorf("%s planner: %w", a.name, err)
			continue
		}
		plan.Provider = a.name
		return plan, nil
	}

	plan := planDeterministic(brief)
	if err := plan.normalize(brief); err != nil {
		if lastErr != nil {
			return nil, fmt.Errorf("%v; deterministic fallback also failed: %w", lastErr, err)
		}
		return nil, err
	}
	plan.Provider = "deterministic"
	return plan, nil
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// normalize clamps a plan into something the executor can always run: valid
// kinds, sane durations, in-range source windows, ordered shots.
func (p *DramatizePlan) normalize(brief dramatizeBrief) error {
	if p == nil {
		return fmt.Errorf("plan is nil")
	}
	p.Width, p.Height = dramatizeCanvasWidth, dramatizeCanvasHeight
	if strings.TrimSpace(p.Title) == "" {
		p.Title = "Dramatized edit"
	}

	kept := make([]DramatizeShot, 0, len(p.Shots))
	for i := range p.Shots {
		s := p.Shots[i]
		s.Kind = strings.ToLower(strings.TrimSpace(s.Kind))
		s.ImagePrompt = strings.TrimSpace(s.ImagePrompt)
		s.MotionPrompt = strings.TrimSpace(s.MotionPrompt)

		switch s.Kind {
		case dramatizeShotKindGenerated, dramatizeShotKindRestyled:
			if s.ImagePrompt == "" {
				// A generated shot with no prompt is unrenderable; drop it
				// rather than sending an empty prompt to the image model.
				continue
			}
			if s.MotionPrompt == "" {
				s.MotionPrompt = s.ImagePrompt
			}
			if s.Kind == dramatizeShotKindRestyled {
				if brief.Probe.Duration > 0 {
					s.SourceFrameTime = clampFloat(s.SourceFrameTime, 0, brief.Probe.Duration)
				}
				if len(brief.Frames) == 0 {
					// Nothing to repaint; treat it as a pure generation.
					s.Kind = dramatizeShotKindGenerated
				}
			}
		case dramatizeShotKindSource:
			if brief.Probe.Duration <= 0 {
				continue
			}
			s.SourceStart = clampFloat(s.SourceStart, 0, brief.Probe.Duration)
			s.SourceEnd = clampFloat(s.SourceEnd, 0, brief.Probe.Duration)
			if s.SourceEnd <= s.SourceStart {
				s.SourceEnd = math.Min(brief.Probe.Duration, s.SourceStart+math.Max(s.Seconds, dramatizeMinShotLength))
			}
			if s.SourceEnd-s.SourceStart < 0.5 {
				continue
			}
			s.Seconds = s.SourceEnd - s.SourceStart
		default:
			continue
		}

		if s.Kind != dramatizeShotKindSource {
			s.Seconds = clampFloat(s.Seconds, dramatizeMinShotLength, dramatizeMaxShotLength)
			if s.Seconds == 0 {
				s.Seconds = 5
			}
		}
		s.Order = len(kept)
		if strings.TrimSpace(s.ID) == "" {
			s.ID = fmt.Sprintf("shot_%02d", s.Order+1)
		}
		kept = append(kept, s)
		if len(kept) >= brief.MaxShots {
			break
		}
	}

	if len(kept) == 0 {
		return fmt.Errorf("plan contains no runnable shots")
	}
	sort.SliceStable(kept, func(i, j int) bool { return kept[i].Order < kept[j].Order })
	p.Shots = kept
	return nil
}

func clampFloat(v, lo, hi float64) float64 {
	if math.IsNaN(v) {
		return lo
	}
	return math.Max(lo, math.Min(hi, v))
}

// ---------------------------------------------------------------------------
// Prompting
// ---------------------------------------------------------------------------

const dramatizeSystemPrompt = `You are a music-video editor planning a vertical, TikTok-style short.

You receive a creative brief and measurements of a source clip (its duration, and
the beat/onset times detected in its audio). Reply with ONLY a JSON object, no
prose and no code fences, matching:

{
  "title": "short title",
  "concept": "one sentence on the throughline",
  "shots": [
    {
      "id": "shot_01",
      "kind": "generated" | "restyled_source" | "source",
      "seconds": 5,
      "image_prompt": "for generated/restyled_source: a vivid still-image prompt",
      "motion_prompt": "for generated/restyled_source: how that still should move",
      "source_frame_time": 3.2,
      "source_start": 0.0,
      "source_end": 2.5,
      "note": "why this shot is here"
    }
  ]
}

Rules:
- "generated" invents a new shot from an image prompt, then animates it.
- "restyled_source" repaints an actual frame of the source clip (pick it with
  source_frame_time) in the new style, then animates it. Use this to carry the
  real subject into the stylized world.
- "source" cuts a window of untouched original footage. Set source_start and
  source_end within the clip duration. Prefer boundaries that fall on the
  supplied beat times.
- Follow the brief's ordering language ("first", "second", "then", "end on")
  exactly.
- Every image_prompt must be self-contained and describe a vertical 9:16 frame.
- Between 3 and %d shots. Each generated shot is 2-10 seconds.
- Interleave source cuts with generated shots so the edit keeps returning to the
  real footage.`

func (b dramatizeBrief) userMessage() string {
	var sb strings.Builder
	sb.WriteString("CREATIVE BRIEF:\n")
	sb.WriteString(strings.TrimSpace(b.Prompt))
	sb.WriteString("\n\nSOURCE CLIP:\n")
	fmt.Fprintf(&sb, "- duration: %.2fs\n", b.Probe.Duration)
	fmt.Fprintf(&sb, "- resolution: %dx%d (%s)\n", b.Probe.Width, b.Probe.Height,
		map[bool]string{true: "portrait", false: "landscape"}[b.Probe.Height >= b.Probe.Width])
	fmt.Fprintf(&sb, "- has audio: %v\n", b.Probe.HasAudio)
	if b.Audio != nil {
		fmt.Fprintf(&sb, "- detected tempo: %.1f BPM\n", b.Audio.Tempo)
		fmt.Fprintf(&sb, "- beat times: %s\n", formatTimes(b.Audio.BeatTimes, 16))
		fmt.Fprintf(&sb, "- onset times: %s\n", formatTimes(b.Audio.OnsetTimes, 16))
	}
	if len(b.Frames) > 0 {
		sb.WriteString("- sampled frames at: ")
		times := make([]float64, len(b.Frames))
		for i, f := range b.Frames {
			times[i] = f.Time
		}
		sb.WriteString(formatTimes(times, 12))
		sb.WriteString("\n")
		sb.WriteString("  (the images are attached in the same order)\n")
	}
	fmt.Fprintf(&sb, "\nPlan at most %d shots. Return JSON only.", b.MaxShots)
	return sb.String()
}

func formatTimes(values []float64, limit int) string {
	if len(values) == 0 {
		return "(none)"
	}
	if limit > 0 && len(values) > limit {
		values = values[:limit]
	}
	parts := make([]string, len(values))
	for i, v := range values {
		parts[i] = fmt.Sprintf("%.2f", v)
	}
	return strings.Join(parts, ", ")
}

// extractJSONObject pulls the first balanced {...} out of a model reply,
// tolerating code fences and stray prose.
func extractJSONObject(raw string) string {
	s := strings.TrimSpace(raw)
	if fence := strings.Index(s, "```"); fence >= 0 {
		rest := s[fence+3:]
		if nl := strings.IndexByte(rest, '\n'); nl >= 0 {
			rest = rest[nl+1:]
		}
		if end := strings.Index(rest, "```"); end >= 0 {
			rest = rest[:end]
		}
		s = strings.TrimSpace(rest)
	}
	start := strings.IndexByte(s, '{')
	if start < 0 {
		return ""
	}
	depth, inString, escaped := 0, false, false
	for i := start; i < len(s); i++ {
		c := s[i]
		if inString {
			switch {
			case escaped:
				escaped = false
			case c == '\\':
				escaped = true
			case c == '"':
				inString = false
			}
			continue
		}
		switch c {
		case '"':
			inString = true
		case '{':
			depth++
		case '}':
			depth--
			if depth == 0 {
				return s[start : i+1]
			}
		}
	}
	return ""
}

func parsePlanJSON(raw string) (*DramatizePlan, error) {
	blob := extractJSONObject(raw)
	if blob == "" {
		return nil, fmt.Errorf("no JSON object in planner reply")
	}
	var plan DramatizePlan
	if err := json.Unmarshal([]byte(blob), &plan); err != nil {
		return nil, fmt.Errorf("parse planner JSON: %w", err)
	}
	if len(plan.Shots) == 0 {
		return nil, fmt.Errorf("planner returned no shots")
	}
	return &plan, nil
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

var dramatizePlannerClient = &http.Client{Timeout: 3 * time.Minute}

// readLimited drains a response body up to limit bytes so a misbehaving
// provider cannot balloon memory.
func readLimited(r io.Reader, limit int64) ([]byte, error) {
	return io.ReadAll(io.LimitReader(r, limit))
}

func dramatizeGeminiKey() string {
	return strings.TrimSpace(getEnv("GEMINI_API_KEY", getEnv("GOOGLE_API_KEY", "")))
}

func dramatizeGeminiModel() string {
	return strings.TrimSpace(getEnv("DRAMATIZE_GEMINI_MODEL", "gemini-3-pro-preview"))
}

func planWithGemini(ctx context.Context, brief dramatizeBrief) (*DramatizePlan, error) {
	key := dramatizeGeminiKey()
	if key == "" {
		return nil, fmt.Errorf("GEMINI_API_KEY is not set")
	}

	parts := []map[string]interface{}{{"text": brief.userMessage()}}
	for _, frame := range brief.Frames {
		if len(frame.JPEG) == 0 {
			continue
		}
		parts = append(parts, map[string]interface{}{
			"inline_data": map[string]string{
				"mime_type": "image/jpeg",
				"data":      base64.StdEncoding.EncodeToString(frame.JPEG),
			},
		})
	}

	payload := map[string]interface{}{
		"system_instruction": map[string]interface{}{
			"parts": []map[string]string{{"text": fmt.Sprintf(dramatizeSystemPrompt, brief.MaxShots)}},
		},
		"contents": []map[string]interface{}{{"role": "user", "parts": parts}},
		"generationConfig": map[string]interface{}{
			"temperature":      0.8,
			"responseMimeType": "application/json",
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	base := strings.TrimRight(getEnv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com"), "/")
	endpoint := fmt.Sprintf("%s/v1beta/models/%s:generateContent", base, dramatizeGeminiModel())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", key)

	resp, err := dramatizePlannerClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	blob, err := readLimited(resp.Body, 1<<20)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("gemini returned %d: %s", resp.StatusCode, tailOutput(blob))
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
	if err := json.Unmarshal(blob, &parsed); err != nil {
		return nil, fmt.Errorf("parse gemini response: %w", err)
	}
	var text strings.Builder
	for _, c := range parsed.Candidates {
		for _, p := range c.Content.Parts {
			text.WriteString(p.Text)
		}
	}
	if strings.TrimSpace(text.String()) == "" {
		return nil, fmt.Errorf("gemini returned no text")
	}
	return parsePlanJSON(text.String())
}

// ---------------------------------------------------------------------------
// xAI Grok (OpenAI-compatible chat completions)
// ---------------------------------------------------------------------------

func dramatizeXAIKey() string {
	return strings.TrimSpace(os.Getenv("XAI_API_KEY"))
}

func dramatizeXAIModel() string {
	return strings.TrimSpace(getEnv("DRAMATIZE_XAI_MODEL", "grok-4"))
}

func planWithXAI(ctx context.Context, brief dramatizeBrief) (*DramatizePlan, error) {
	key := dramatizeXAIKey()
	if key == "" {
		return nil, fmt.Errorf("XAI_API_KEY is not set")
	}

	content := []map[string]interface{}{{"type": "text", "text": brief.userMessage()}}
	for _, frame := range brief.Frames {
		if len(frame.JPEG) == 0 {
			continue
		}
		content = append(content, map[string]interface{}{
			"type": "image_url",
			"image_url": map[string]string{
				"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(frame.JPEG),
			},
		})
	}

	payload := map[string]interface{}{
		"model": dramatizeXAIModel(),
		"messages": []map[string]interface{}{
			{"role": "system", "content": fmt.Sprintf(dramatizeSystemPrompt, brief.MaxShots)},
			{"role": "user", "content": content},
		},
		"temperature":     0.8,
		"response_format": map[string]string{"type": "json_object"},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.x.ai/v1/chat/completions", bytes.NewReader(body))
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
	blob, err := readLimited(resp.Body, 1<<20)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("xai returned %d: %s", resp.StatusCode, tailOutput(blob))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(blob, &parsed); err != nil {
		return nil, fmt.Errorf("parse xai response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return nil, fmt.Errorf("xai returned no choices")
	}
	return parsePlanJSON(parsed.Choices[0].Message.Content)
}

// ---------------------------------------------------------------------------
// Deterministic planner
// ---------------------------------------------------------------------------

// Ordering cues creators actually write, in the order they imply.
var dramatizeOrdinalPattern = regexp.MustCompile(`(?i)\b(first|second|third|fourth|fifth|then|next|after that|finally|lastly|end(?:ing)? (?:the )?(?:video )?on|last(?:ly)?)\b`)

// planDeterministic segments the brief into scene descriptions and lays them
// out as generated shots interleaved with beat-aligned source cuts. This runs
// when no LLM is configured, and is what the unit tests exercise.
func planDeterministic(brief dramatizeBrief) *DramatizePlan {
	scenes := splitBriefIntoScenes(brief.Prompt)
	plan := &DramatizePlan{
		Title:   deriveTitle(brief.Prompt),
		Concept: firstSentence(brief.Prompt),
	}

	// Reserve roughly a third of the shot budget for real footage.
	maxScenes := brief.MaxShots
	if maxScenes > 1 {
		maxScenes = int(math.Ceil(float64(brief.MaxShots) * 2.0 / 3.0))
	}
	if len(scenes) > maxScenes {
		scenes = scenes[:maxScenes]
	}

	sourceWindows := deterministicSourceWindows(brief, len(scenes))

	for i, scene := range scenes {
		// Alternate: every second generated shot repaints a real frame so the
		// original subject stays present in the stylized sections.
		kind := dramatizeShotKindGenerated
		frameTime := 0.0
		if i%2 == 1 && len(brief.Frames) > 0 {
			kind = dramatizeShotKindRestyled
			frameTime = brief.Frames[i%len(brief.Frames)].Time
		}
		plan.Shots = append(plan.Shots, DramatizeShot{
			ID:              fmt.Sprintf("shot_%02d", len(plan.Shots)+1),
			Kind:            kind,
			Seconds:         5,
			ImagePrompt:     scene,
			MotionPrompt:    scene,
			SourceFrameTime: frameTime,
			Note:            fmt.Sprintf("scene %d from the brief", i+1),
		})
		// Drop back to live footage between scenes.
		if i < len(sourceWindows) {
			w := sourceWindows[i]
			plan.Shots = append(plan.Shots, DramatizeShot{
				ID:          fmt.Sprintf("shot_%02d", len(plan.Shots)+1),
				Kind:        dramatizeShotKindSource,
				SourceStart: w[0],
				SourceEnd:   w[1],
				Seconds:     w[1] - w[0],
				Note:        "beat-aligned cut back to the original footage",
			})
		}
	}

	if len(plan.Shots) == 0 && brief.Probe.Duration > 0 {
		// Nothing parseable in the brief: still deliver the source, cut to beats.
		plan.Shots = append(plan.Shots, DramatizeShot{
			ID: "shot_01", Kind: dramatizeShotKindSource,
			SourceStart: 0, SourceEnd: brief.Probe.Duration, Seconds: brief.Probe.Duration,
			Note: "unmodified source",
		})
	}
	return plan
}

// deterministicSourceWindows carves `count` beat-aligned windows out of the
// source, spread across its length.
func deterministicSourceWindows(brief dramatizeBrief, count int) [][2]float64 {
	if count <= 0 || brief.Probe.Duration <= 0 {
		return nil
	}
	duration := brief.Probe.Duration
	// Aim for ~1.5s of real footage per return, without overrunning the clip.
	window := math.Min(1.5, duration/float64(count+1))
	if window < 0.5 {
		return nil
	}
	requested := make([][2]float64, 0, count)
	for i := 0; i < count; i++ {
		start := duration * float64(i) / float64(count)
		requested = append(requested, [2]float64{start, start + window})
	}
	return planSourceCuts(requested, brief.Audio, duration, window)
}

// splitBriefIntoScenes breaks a brief on ordering cues, falling back to
// sentences. Each returned string is a self-contained scene description.
func splitBriefIntoScenes(prompt string) []string {
	text := strings.TrimSpace(prompt)
	if text == "" {
		return nil
	}

	locs := dramatizeOrdinalPattern.FindAllStringIndex(text, -1)
	segments := []string{}
	if len(locs) >= 2 {
		for i, loc := range locs {
			end := len(text)
			if i+1 < len(locs) {
				end = locs[i+1][0]
			}
			segments = append(segments, text[loc[0]:end])
		}
	} else {
		segments = splitSentences(text)
	}

	out := []string{}
	for _, seg := range segments {
		clean := cleanScene(seg)
		// Drop fragments too short to be a usable image prompt.
		if len(strings.Fields(clean)) < 4 {
			continue
		}
		out = append(out, clean)
	}
	if len(out) == 0 {
		out = append(out, text)
	}
	return out
}

var dramatizeSentenceSplit = regexp.MustCompile(`(?m)[.!?]+\s+`)

func splitSentences(text string) []string {
	parts := dramatizeSentenceSplit.Split(text, -1)
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if strings.TrimSpace(p) != "" {
			out = append(out, p)
		}
	}
	return out
}

// dramatizeMetaPattern marks where a segment stops describing a scene and
// starts giving editing directions. Everything from the first match on is
// dropped, so "...running really fast. So, make a few videos for this and then
// stitch together..." keeps only the shot description.
var dramatizeMetaPattern = regexp.MustCompile(`(?i)\b(so,?\s*make a few videos|make a few videos?|stitch(?:ing)? (?:it )?together|tik ?tok[- ]style|tik ?tok style|high social media|social media style|make it portrait|original cuts of the video|vertical video format)\b`)

// dramatizeFillerPattern removes conversational scaffolding that would confuse
// an image model but carries no visual meaning.
var dramatizeFillerPattern = regexp.MustCompile(`(?i)\b(let us make a video dramatizing|we should make|the first one|one we should make|should be it,?|should be|ok,? so|and or)\b`)

// cleanScene turns one brief segment into a self-contained image prompt, or ""
// if the segment was purely an editing instruction.
func cleanScene(segment string) string {
	s := strings.TrimSpace(segment)
	// Truncate at the first editing direction rather than deleting it inline,
	// since everything after it is direction too.
	if loc := dramatizeMetaPattern.FindStringIndex(s); loc != nil {
		s = s[:loc[0]]
	}
	s = dramatizeOrdinalPattern.ReplaceAllString(s, " ")
	s = dramatizeFillerPattern.ReplaceAllString(s, " ")
	s = strings.Join(strings.Fields(s), " ")
	s = strings.TrimSpace(strings.Trim(s, ".,;:- "))
	if s == "" {
		return ""
	}
	// Capitalise the opening word without flattening the rest of the casing.
	return strings.ToUpper(s[:1]) + s[1:]
}

func deriveTitle(prompt string) string {
	words := strings.Fields(firstSentence(prompt))
	if len(words) == 0 {
		return "Dramatized edit"
	}
	if len(words) > 8 {
		words = words[:8]
	}
	return strings.Join(words, " ")
}

func firstSentence(text string) string {
	parts := splitSentences(strings.TrimSpace(text))
	if len(parts) == 0 {
		return strings.TrimSpace(text)
	}
	return strings.TrimSpace(parts[0])
}
