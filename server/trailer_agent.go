package main

// Trailer agent: brief + world + character bible -> Grok 4.6 craft ->
// GPT Image (or Z-Image sketch) identity sheets and start frames, Flash
// review on 800px stills, Gemini TTS + score mix as H3 driving audio, then
// H3 cog I2V from those frames.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	trailerDefaultShots   = 8
	trailerHardMaxShots   = 12
	trailerCanvasWidth    = 1920
	trailerCanvasHeight   = 1080
	trailerFPS            = 24
	trailerJobDeadline    = 3 * time.Hour
	trailerSheetPasses    = 2
	trailerSheetThreshold = 0.84
)

var (
	trailerShotLine  = regexp.MustCompile(`(?i)^SHOT\s+(\d+)\s*[—–-]\s*(?:(\d+(?:\.\d+)?)\s*seconds?\.\s*)?(.*)$`)
	trailerTitleLine = regexp.MustCompile(`(?i)\bTitle(?:\s*card)?:\s*["']?([A-Z0-9][A-Za-z0-9'’ :-]{1,60})`)
)

func normalizeTrailerRequest(req *dramatizeRequest) error {
	req.Prompt = strings.TrimSpace(req.Prompt)
	req.SettingPrompt = strings.TrimSpace(req.SettingPrompt)
	req.CharacterBible = strings.TrimSpace(req.CharacterBible)
	req.MusicPrompt = strings.TrimSpace(req.MusicPrompt)
	req.Lyrics = strings.TrimSpace(req.Lyrics)
	req.VideoURL = ""
	if req.Prompt == "" {
		return fmt.Errorf("a trailer brief is required")
	}
	if len(req.Prompt) > 8000 {
		return fmt.Errorf("the brief must be 8000 characters or fewer")
	}
	if len(req.SettingPrompt) > 4000 {
		return fmt.Errorf("the setting prompt must be 4000 characters or fewer")
	}
	if len(req.CharacterBible) > 12000 {
		return fmt.Errorf("the character bible must be 12000 characters or fewer")
	}
	if req.MaxShots <= 0 {
		req.MaxShots = trailerDefaultShots
	}
	if req.MaxShots > trailerHardMaxShots {
		req.MaxShots = trailerHardMaxShots
	}
	if req.Seconds <= 0 {
		req.Seconds = dramatizeDefaultShotSeconds
	}
	req.Seconds = clampFloat(req.Seconds, trailerMinShotSeconds, trailerMaxShotSeconds)
	if req.Sketch {
		req.ImageModel = "zimage"
	} else if _, ok := allowedImageModels[req.ImageModel]; !ok || !allowedImageModels[req.ImageModel].edit {
		req.ImageModel = "gpt-image-2"
	}
	if req.VisionModel == "" {
		req.VisionModel = trailerStoryModel()
	}
	if req.ConsistentCharacters && req.ConsistencyPasses <= 0 {
		req.ConsistencyPasses = remakeDefaultConsistencyPasses
	}
	if req.ConsistencyPasses > remakeMaxConsistencyPasses {
		req.ConsistencyPasses = remakeMaxConsistencyPasses
	}
	req.Mode = "trailer"
	return nil
}

func trailerCharacterCount(bible string) int {
	count := 0
	for _, line := range strings.Split(bible, "\n") {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	return min(remakeMaxCharacterSheets, count)
}

func trailerEstimate(req dramatizeRequest) RemakeEstimate {
	shots := req.MaxShots
	if shots <= 0 {
		shots = trailerDefaultShots
	}
	imageUSD := 0.24
	if spec, ok := allowedImageModels[req.ImageModel]; ok {
		imageUSD = spec.usd
	}
	if req.Sketch {
		imageUSD = servicePricesUSD["zimage"]
	}
	characters := 0
	if req.ConsistentCharacters {
		characters = trailerCharacterCount(req.CharacterBible)
		if characters == 0 {
			characters = min(4, shots)
		}
	}
	world := 1
	repairs := 0
	if req.ConsistentCharacters && !req.Sketch {
		repairs = (characters + shots) * req.ConsistencyPasses
	}
	baseImages := shots
	references := world + characters
	h3USD := 0.0
	musicUSD := 0.0
	if !req.Sketch {
		clip, _, _ := h3Estimate(ServiceUsageRequest{Service: "h3_video", Size: "native", Duration: int(req.Seconds), NumSteps: 20})
		h3USD = clip * float64(shots)
		dummy := make([]DramatizeShot, shots)
		for i := range dummy {
			dummy[i].Seconds = req.Seconds
		}
		musicUSD = music3PublicPriceUSD(trailerMusicDuration(dummy))
	}
	speechUSD := 0.0
	if !req.Sketch {
		speechUSD = estimateGeminiTTSCostUSD(strings.Repeat("n", trailerTTSCharsGuess)) * float64(shots)
	}
	agentUSD := remakeAgentUSDPerShot * float64(shots)
	imageCost := imageUSD * float64(baseImages)
	refUSD := imageUSD * float64(references)
	repairUSD := imageUSD * float64(repairs)
	total := imageCost + refUSD + repairUSD + h3USD + musicUSD + speechUSD + agentUSD
	return RemakeEstimate{
		Exact: true, ShotCount: shots, Duration: req.Seconds * float64(shots),
		BaseImages: baseImages, ReferenceImages: references, RepairImages: repairs,
		TotalImages: baseImages + references + repairs, MotionClips: shots,
		MotionSeconds: int(req.Seconds) * shots, ImageUnitUSD: imageUSD, ImageUSD: imageCost,
		ReferenceUSD: refUSD, RepairUSD: repairUSD, MotionUSD: h3USD, AgentUSD: agentUSD,
		EstimatedCostUSD: total, EstimatedCredits: usdToCredits(total),
		Settlement: "charged on completion from successful sheets, frames, clips, speech, and score",
	}
}

func trailerEstimateUSD(req dramatizeRequest) float64 { return trailerEstimate(req).EstimatedCostUSD }

func parseTrailerShotList(prompt string, seconds float64, maxShots int) []DramatizeShot {
	var shots []DramatizeShot
	for _, line := range strings.Split(prompt, "\n") {
		line = strings.TrimSpace(line)
		match := trailerShotLine.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		dur := seconds
		desc := strings.TrimSpace(match[3])
		if match[2] != "" {
			if parsed := parseTrailerFloat(match[2]); parsed >= trailerMinShotSeconds {
				dur = float64(trailerSnapSeconds(parsed))
			}
		}
		shots = append(shots, DramatizeShot{
			ID: fmt.Sprintf("shot_%03d", len(shots)+1), Kind: dramatizeShotKindGenerated,
			Order: len(shots) + 1, Seconds: dur, VisualDescription: desc,
			ImagePrompt: desc, MotionPrompt: trailerMotionPrompt(desc), DialogueTranscript: seedTrailerTranscript(desc, nil),
			Characters: trailerSpeakerIDs(desc), AspectRatio: "16:9", ImageModel: "gpt-image-2",
		})
		if len(shots) >= maxShots {
			break
		}
	}
	return shots
}

func parseTrailerFloat(value string) float64 {
	var n float64
	fmt.Sscanf(value, "%f", &n)
	return n
}

func trailerCharactersFromBible(bible string, specs []RemakeCharacterSpec, shots []DramatizeShot) []RemakeReferenceAsset {
	assets := []RemakeReferenceAsset{}
	seen := map[string]bool{}
	add := func(id, name, description string, shotIDs []string) {
		id = canonicalCharacterID(id)
		if id == "" {
			return
		}
		for existing := range seen {
			if trailerSamePerson(id, existing) {
				return
			}
		}
		seen[id] = true
		if name == "" {
			name = characterDisplayName(id)
		}
		assets = append(assets, RemakeReferenceAsset{ID: id, Kind: "character", Name: name, Description: description, ShotIDs: shotIDs})
	}
	for _, line := range strings.Split(bible, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		name := line
		for _, sep := range []string{" — ", " – ", ": ", " - "} {
			if prefix, _, ok := strings.Cut(line, sep); ok {
				name = prefix
				break
			}
		}
		add(name, name, line, nil)
	}
	for _, spec := range specs {
		add(spec.ID, spec.Name, spec.DetailedDescription, spec.ShotIDs)
	}
	if len(assets) == 0 {
		for _, shot := range shots {
			for _, id := range normalizeCharacterIDs(shot.Characters) {
				add(id, "", "", []string{shot.ID})
			}
		}
	}
	if len(assets) > remakeMaxCharacterSheets {
		assets = assets[:remakeMaxCharacterSheets]
	}
	return assets
}

func trailerStyleAnchor(style RemakeStyleBible, setting, goal string) string {
	parts := []string{
		strings.TrimSpace(style.RenderingLanguage),
		strings.TrimSpace(style.WorldDesign),
		strings.TrimSpace(style.Lighting),
		strings.TrimSpace(style.Palette),
		strings.TrimSpace(style.Materials),
		strings.TrimSpace(setting),
		strings.TrimSpace(goal),
	}
	var keep []string
	for _, part := range parts {
		if part != "" {
			keep = append(keep, part)
		}
	}
	if len(keep) == 0 {
		return "Coherent cinematic production still. Identical rendering language, costume, and identity across the set."
	}
	return strings.Join(keep, " ")
}

func processTrailerAgentJob(job *VideoJob, state *dramatizeJobState) {
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil || user == nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "trailer owner no longer exists")
		return
	}
	state.Steps, state.Step = nil, 0
	ctx, cancel := context.WithTimeout(activeVideoJobContext(job.ID), trailerJobDeadline)
	defer cancel()
	workDir, err := os.MkdirTemp("", "trailer-"+job.ID+"-")
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "could not allocate trailer scratch space")
		return
	}
	defer os.RemoveAll(workDir)
	if err := runTrailerAgent(ctx, job, user, state, workDir); err != nil {
		if !videoJobWasCancelled(job.ID) {
			_ = dbConn.UpdateVideoJob(job.ID, "failed", state.marshal(), err.Error())
		}
		return
	}
	chargedUSD := trailerRenderedUSD(state)
	state.ChargedUSD, state.CreditsUsed = chargedUSD, usdToCredits(chargedUSD)
	result := state.marshal()
	if _, _, err := dbConn.SettleGeneratedVideoJob(job.ID, result, chargedUSD, chargedUSD, getCUTEPriceUSD()); err != nil {
		message := "settlement unavailable; retry status"
		if err == ErrVideoPaymentRequired {
			message = fmt.Sprintf("top up to release the trailer; $%.2f required", chargedUSD)
		}
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", result, message)
		return
	}
	indexCompletedVideo(job, result)
	maybeTriggerAutoTopup(job.UserID)
}

func trailerRenderedUSD(state *dramatizeJobState) float64 {
	req := state.Request
	imageUSD := 0.24
	if spec, ok := allowedImageModels[req.ImageModel]; ok {
		imageUSD = spec.usd
	}
	if req.Sketch {
		imageUSD = servicePricesUSD["zimage"]
	}
	total := remakeAgentUSDPerShot * float64(len(state.Shots))
	for _, reference := range state.References {
		if reference.Error == "" && strings.TrimSpace(reference.ImageURL) != "" {
			total += imageUSD
		}
	}
	for _, shot := range state.Shots {
		if strings.TrimSpace(shot.ImageURL) != "" {
			total += imageUSD * float64(1+shot.Regenerations)
		}
		if !req.Sketch && shot.Error == "" && strings.TrimSpace(shot.ClipURL) != "" {
			clip, _, _ := h3Estimate(ServiceUsageRequest{Service: "h3_video", Size: "native", Duration: int(shot.Shot.Seconds), NumSteps: 20})
			total += clip
		}
	}
	if strings.TrimSpace(state.AudioURL) != "" {
		total += music3PublicPriceUSD(trailerMusicDuration(planShotsFromResults(state.Shots)))
	}
	total += state.SpeechUSD
	return total
}

func planShotsFromResults(results []dramatizeShotResult) []DramatizeShot {
	shots := make([]DramatizeShot, len(results))
	for i, result := range results {
		shots[i] = result.Shot
	}
	return shots
}

func runTrailerAgent(ctx context.Context, job *VideoJob, user *User, state *dramatizeJobState, workDir string) error {
	req := state.Request
	state.Estimate = trailerEstimate(req)

	started := state.begin(job.ID, "plan", "Locking style, characters, and shot list")
	shots := parseTrailerShotList(req.Prompt, req.Seconds, req.MaxShots)
	styleBible := RemakeStyleBible{}
	var characterSpecs []RemakeCharacterSpec
	if len(shots) == 0 {
		planned, err := planTrailerShots(ctx, req)
		if err != nil {
			state.fail(job.ID, started, err.Error())
			return err
		}
		shots = planned
	}
	if !req.Sketch {
		if crafted, craftErr := craftTrailerShots(ctx, req, shots); craftErr == nil {
			shots = crafted
			state.Provider = "Grok 4.6"
		} else if style, specs, harmonized, err := harmonizeRemakePrompts(ctx, req, shots); err == nil {
			styleBible, characterSpecs, shots = style, specs, harmonized
			state.Provider = "Luna trailer harmonizer"
		} else {
			state.Provider = "brief shot list"
		}
	} else {
		state.Provider = "Z-Image sketch"
	}
	anchor := trailerStyleAnchor(styleBible, req.SettingPrompt, req.Prompt)
	for i := range shots {
		shots[i].Kind = dramatizeShotKindGenerated
		shots[i].AspectRatio = "16:9"
		shots[i].ImageModel = req.ImageModel
		if shots[i].Seconds <= 0 {
			shots[i].Seconds = req.Seconds
		}
		shots[i].Seconds = float64(trailerSnapSeconds(shots[i].Seconds))
		if shots[i].ImagePrompt == "" {
			shots[i].ImagePrompt = shots[i].VisualDescription
		}
		shots[i].ImagePrompt = strings.TrimSpace(anchor + " " + shots[i].ImagePrompt)
		if shots[i].MotionPrompt == "" {
			shots[i].MotionPrompt = shots[i].VisualDescription
		}
		shots[i].MotionPrompt = trailerMotionPrompt(shots[i].MotionPrompt)
		if shots[i].DialogueTranscript == "" {
			shots[i].DialogueTranscript = seedTrailerTranscript(shots[i].VisualDescription+" "+shots[i].MotionPrompt, shots[i].Characters)
		}
	}
	if !req.Sketch {
		shots = planTrailerDialogue(ctx, req, shots)
	}
	plan := &DramatizePlan{Title: "Cinematic trailer", Concept: req.Prompt, Provider: state.Provider, Width: trailerCanvasWidth, Height: trailerCanvasHeight, Shots: shots, StyleBible: styleBible, CharacterSpecs: characterSpecs}
	state.Plan = plan
	state.finish(job.ID, started, fmt.Sprintf("%d shots · %s", len(shots), state.Provider))

	started = state.begin(job.ID, "references", "World board and character sheets")
	references := buildTrailerReferences(ctx, req, shots, styleBible, characterSpecs, anchor)
	if !req.Sketch {
		references, _ = refineTrailerSheets(ctx, references, anchor, workDir)
	}
	state.References, plan.References = references, references
	state.ReferenceUSD = remakeReferenceUSD(references)
	ready := 0
	for _, reference := range references {
		if reference.ImageURL != "" && reference.Error == "" {
			ready++
		}
	}
	state.finish(job.ID, started, fmt.Sprintf("%d/%d identity and world plates ready", ready, len(references)))

	started = state.begin(job.ID, "render_frames", "Style-transferring sheets into start frames")
	rendered, err := renderTrailerFrames(ctx, req, shots, references, anchor)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = rendered
	state.finish(job.ID, started, fmt.Sprintf("%d start frames", countTrailerImages(rendered)))

	if !req.Sketch && req.ConsistentCharacters {
		started = state.begin(job.ID, "consistency", "Auditing identity drift and repairing the worst frames")
		rendered, audits := refineTrailerFrames(ctx, req, rendered, references, anchor, workDir)
		state.Shots, state.ConsistencyAudits = rendered, audits
		repairs := 0
		for _, audit := range audits {
			repairs += len(audit.Regenerated)
		}
		state.finish(job.ID, started, fmt.Sprintf("%d identity repairs across %d passes", repairs, len(audits)))
	}

	if req.Sketch {
		state.Width, state.Height = trailerCanvasWidth, trailerCanvasHeight
		state.Duration = req.Seconds * float64(len(shots))
		return nil
	}

	started = state.begin(job.ID, "score", "Composing the trailer score")
	musicPrompt := req.MusicPrompt
	if musicPrompt == "" {
		musicPrompt = "Intimate dark-fantasy trailer score, low cello, wet-wood percussion, close female alto, funeral choir through rain, no pop beat, no heroic brass fanfare"
	}
	if req.Lyrics != "" {
		musicPrompt = musicPrompt + "\n\n" + req.Lyrics
	}
	musicPath := ""
	if url, musicErr := studioGenerateMusic(musicPrompt, trailerMusicDuration(planShotsFromResults(rendered))); musicErr == nil {
		state.AudioURL = url
		musicPath = filepath.Join(workDir, "score.audio")
		if downloadToFile(ctx, url, musicPath) != nil {
			musicPath = ""
		}
		state.finish(job.ID, started, "score ready")
	} else {
		state.finish(job.ID, started, "score unavailable: "+musicErr.Error())
	}

	started = state.begin(job.ID, "voices", "Directing Gemini speech and mixing drive audio")
	rendered, speechUSD, err := prepareTrailerDriveAudio(ctx, user, rendered, musicPath, workDir)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.SpeechUSD = speechUSD
	state.Shots = rendered
	driven := 0
	for _, shot := range rendered {
		if shot.DriveAudioURL != "" {
			driven++
		}
	}
	state.finish(job.ID, started, fmt.Sprintf("%d/%d drive beds · $%.3f speech", driven, len(rendered), speechUSD))

	started = state.begin(job.ID, "animate", "Animating accepted start frames on H3 with drive audio")
	rendered, err = animateTrailerShots(ctx, user, rendered)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = rendered
	okClips := 0
	for _, shot := range rendered {
		if shot.ClipURL != "" && shot.Error == "" {
			okClips++
		}
	}
	if okClips == 0 {
		err := fmt.Errorf("H3 produced no clips")
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.finish(job.ID, started, fmt.Sprintf("%d/%d H3 clips", okClips, len(rendered)))

	started = state.begin(job.ID, "assemble", "Cutting the 16:9 master")
	finalPath := filepath.Join(workDir, "trailer.mp4")
	assembleMusic := ""
	if !trailerShotsHaveDriveAudio(rendered) {
		assembleMusic = state.AudioURL
	}
	titleImage := ""
	if title := trailerTitleFromText(req.Prompt); title != "" {
		world := ""
		for _, ref := range references {
			if ref.Kind == "setting" && ref.ImageURL != "" {
				world = ref.ImageURL
				break
			}
		}
		prompt := fmt.Sprintf("%s Cinematic end-card still only. Physically set title type reading %q as carved or gilt type in the world. No website, no extra words, no logos, no credits roll.", anchor, title)
		if url, genErr := trailerGenerateImage(false, req.ImageModel, prompt, world, nil, "16:9"); genErr == nil {
			titleImage = url
		}
	}
	timeline, err := assembleTrailer(ctx, rendered, workDir, finalPath, assembleMusic, titleImage)
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.Shots = timeline
	probe, err := probeVideoFile(ctx, finalPath)
	if err != nil {
		return err
	}
	state.Duration, state.Width, state.Height = probe.Duration, probe.Width, probe.Height
	state.finish(job.ID, started, fmt.Sprintf("%.1fs master", probe.Duration))

	started = state.begin(job.ID, "publish", "Publishing the trailer and Studio timeline")
	state.VideoURL, err = uploadDramatizeArtifact(ctx, finalPath, user.ID, "video/mp4")
	if err != nil {
		state.fail(job.ID, started, err.Error())
		return err
	}
	state.ProjectID, state.ProjectURL, err = publishDramatizeStudioProject(ctx, user, plan, timeline, workDir)
	if err != nil {
		state.finish(job.ID, started, "trailer published; Studio project unavailable: "+err.Error())
		return nil
	}
	state.finish(job.ID, started, "trailer and editable timeline published")
	return nil
}

func planTrailerShots(ctx context.Context, req dramatizeRequest) ([]DramatizeShot, error) {
	if shots, err := planTrailerShotsGrok(ctx, req); err == nil {
		return shots, nil
	}
	content := []map[string]interface{}{{"type": "input_text", "text": fmt.Sprintf(`Plan a cinematic game trailer of exactly %d shots. Each shot is %.0f seconds, 16:9.
Craft like a finished publisher trailer: one coherent world, locked character designs, one camera move, at most one or two spoken in-world lines (no narrator). Silent establishing shots are allowed.
Each image_prompt is a self-contained production still: repeat the rendering language, name only visible characters with their canonical traits, no captions or logos.
Each motion_prompt describes camera and performance for image-to-video, asks for precise lip sync when someone speaks, native room tone, and forbids subtitles, captions, and logos. Do not restate the still.
Overall brief: %s
Setting bible: %s
Character bible: %s`, req.MaxShots, req.Seconds, req.Prompt, firstNonEmpty(req.SettingPrompt, "Infer one coherent world."), firstNonEmpty(req.CharacterBible, "Infer recurring people."))}}
	blob, err := callRemakeOpenAIJSON(ctx, remakeLunaModel, "You are a trailer director. Preserve the user's story beats. Do not invent a different genre.", content, "trailer_shot_plan", remakeVisionReplySchema())
	if err != nil {
		return nil, err
	}
	var reply remakeVisionReply
	if err := json.Unmarshal(blob, &reply); err != nil || len(reply.Shots) == 0 {
		return nil, fmt.Errorf("trailer planner returned no shots")
	}
	shots := make([]DramatizeShot, 0, len(reply.Shots))
	for i, item := range reply.Shots {
		if i >= req.MaxShots {
			break
		}
		shot := DramatizeShot{ID: fmt.Sprintf("shot_%03d", i+1), Kind: dramatizeShotKindGenerated, Order: i + 1, Seconds: req.Seconds, AspectRatio: "16:9", ImageModel: req.ImageModel}
		applyRemakeVisionShot(&shot, item, req)
		shots = append(shots, shot)
	}
	if len(shots) == 0 {
		return nil, fmt.Errorf("trailer planner returned no usable shots")
	}
	return shots, nil
}

func trailerGenerateImage(sketch bool, model, prompt, imageURL string, refs []string, aspect string) (string, error) {
	if sketch {
		width, height := 1344, 768
		if aspect == "1:1" {
			width, height = 1024, 1024
		}
		backend := serviceBackends["zimage"]
		blob, err := proxyZImageWithFallbacks(ServiceUsageRequest{Service: "zimage", Prompt: prompt, Width: width, Height: height, NumSteps: 8, Guidance: 1}, backend)
		if err != nil {
			return "", err
		}
		return extractImageURL(blob)
	}
	if model == "" {
		model = "gpt-image-2"
	}
	blob, err := proxyOpenPathsModelImage(ServiceUsageRequest{Service: "openpaths_image", Model: model, Prompt: prompt, ImageURL: imageURL, ReferenceImageURLs: refs, AspectRatio: aspect, N: 1})
	if err != nil {
		return "", err
	}
	return extractImageURL(blob)
}

func buildTrailerReferences(ctx context.Context, req dramatizeRequest, shots []DramatizeShot, style RemakeStyleBible, specs []RemakeCharacterSpec, anchor string) []RemakeReferenceAsset {
	styleJSON, _ := json.Marshal(style)
	world := RemakeReferenceAsset{ID: "world", Kind: "setting", Name: "World style board", Description: req.SettingPrompt}
	worldPrompt := fmt.Sprintf("%s Create one borderless 2x2 cinematic world and production-design reference board. Setting: %s. Harmonized bible: %s. Show complementary establishing environments with one rendering language, architecture, materials, palette, atmosphere, and lighting. No captions, labels, logos, or alternate art styles.", anchor, firstNonEmpty(req.SettingPrompt, req.Prompt), styleJSON)
	if url, err := trailerGenerateImage(req.Sketch, "gpt-image-2", worldPrompt, "", nil, "16:9"); err != nil {
		world.Error = err.Error()
	} else {
		world.ImageURL = url
	}
	references := []RemakeReferenceAsset{world}
	if !req.ConsistentCharacters {
		return references
	}
	characters := trailerCharactersFromBible(req.CharacterBible, specs, shots)
	for i := range characters {
		select {
		case <-ctx.Done():
			characters[i].Error = ctx.Err().Error()
			continue
		default:
		}
		description := characters[i].Description
		if spec := characterSpecByID(specs, characters[i].ID); spec != nil {
			if blob, err := json.Marshal(spec); err == nil {
				description = string(blob)
			}
		}
		prompt := fmt.Sprintf("%s Create a single clean cinematic identity reference sheet for %q. Canonical specification: %s. Show the same person in neutral front, three-quarter, profile, back, face close-up, and full-body. Lock face geometry, age, hair, body, costume construction, palette, and signature props. Use the attached world board only for rendering language. No captions, labels, duplicate people, or alternate costumes.", anchor, characters[i].Name, description)
		url, err := trailerGenerateImage(req.Sketch, "gpt-image-2", prompt, world.ImageURL, nil, "16:9")
		if err != nil {
			characters[i].Error = err.Error()
		} else {
			characters[i].ImageURL = url
		}
	}
	return append(references, characters...)
}

func refineTrailerSheets(ctx context.Context, references []RemakeReferenceAsset, anchor, workDir string) ([]RemakeReferenceAsset, []RemakeConsistencyAudit) {
	world := RemakeReferenceAsset{}
	for _, reference := range references {
		if reference.Kind == "setting" {
			world = reference
		}
	}
	var audits []RemakeConsistencyAudit
	for pass := 1; pass <= trailerSheetPasses; pass++ {
		audit := RemakeConsistencyAudit{Pass: pass}
		for i, character := range references {
			if character.Kind != "character" || character.ImageURL == "" {
				continue
			}
			score, issues, correction, flashErr := reviewTrailerSheetFlash(ctx, workDir, world, character)
			if flashErr != nil {
				content := []map[string]interface{}{
					{"type": "input_text", "text": fmt.Sprintf("Image 1 is the world/style board. Image 2 is the identity sheet for %s. Score 0-1 whether the sheet matches the world rendering language AND is a distinct, stable identity matching: %s. Below 0.84 needs regeneration. Write a surgical correction prompt.", character.ID, character.Description)},
				}
				if world.ImageURL != "" {
					content = append(content, map[string]interface{}{"type": "input_image", "image_url": world.ImageURL, "detail": "original"})
				}
				content = append(content, map[string]interface{}{"type": "input_image", "image_url": character.ImageURL, "detail": "original"})
				schema := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": map[string]interface{}{
					"score": map[string]string{"type": "number"}, "identity_issues": stringArraySchema(), "correction_prompt": map[string]string{"type": "string"},
				}, "required": []string{"score", "identity_issues", "correction_prompt"}}
				blob, err := callRemakeOpenAIJSON(ctx, remakeLunaModel, "You are a strict character-continuity grader for a trailer identity sheet.", content, "trailer_sheet_consistency", schema)
				if err != nil {
					continue
				}
				var reply struct {
					Score            float64  `json:"score"`
					IdentityIssues   []string `json:"identity_issues"`
					CorrectionPrompt string   `json:"correction_prompt"`
				}
				if json.Unmarshal(blob, &reply) != nil {
					continue
				}
				score, issues, correction = reply.Score, reply.IdentityIssues, reply.CorrectionPrompt
			}
			audit.Scores = append(audit.Scores, RemakeConsistencyScore{ShotID: character.ID, CharacterID: character.ID, Score: score, IdentityIssues: issues, CorrectionPrompt: correction})
			if score >= trailerSheetThreshold {
				continue
			}
			prompt := anchor + " CONSISTENCY REPAIR for identity sheet " + character.Name + ": " + correction + " Keep this one person. Use the world board for rendering language only."
			url, genErr := trailerGenerateImage(false, "gpt-image-2", prompt, world.ImageURL, nil, "16:9")
			if genErr == nil && url != "" {
				references[i].ImageURL = url
				audit.Regenerated = append(audit.Regenerated, character.ID)
			}
		}
		audits = append(audits, audit)
		if len(audit.Regenerated) == 0 {
			break
		}
	}
	return references, audits
}

func remakeShotCharacterRefs(shot DramatizeShot, references []RemakeReferenceAsset) (primary string, refs []string) {
	return firstTrailerRef(shot, references), trailerShotReferenceURLs(shot, references)
}

func firstTrailerRef(shot DramatizeShot, references []RemakeReferenceAsset) string {
	for _, reference := range references {
		if reference.Kind == "character" && reference.ImageURL != "" && trailerShotShowsPerson(shot, reference) {
			return reference.ImageURL
		}
	}
	for _, reference := range references {
		if reference.ImageURL != "" {
			return reference.ImageURL
		}
	}
	return ""
}

func trailerShotReferenceURLs(shot DramatizeShot, references []RemakeReferenceAsset) []string {
	urls := make([]string, 0, 5)
	settingURL := ""
	for _, reference := range references {
		if reference.ImageURL == "" || reference.Error != "" {
			continue
		}
		if reference.Kind == "setting" {
			settingURL = reference.ImageURL
			continue
		}
		if reference.Kind == "character" && trailerShotShowsPerson(shot, reference) {
			urls = append(urls, reference.ImageURL)
		}
	}
	if len(urls) > 5 {
		urls = urls[:5]
	}
	if settingURL != "" && len(urls) < 5 {
		urls = append(urls, settingURL)
	}
	return urls
}

func renderTrailerFrames(ctx context.Context, req dramatizeRequest, shots []DramatizeShot, references []RemakeReferenceAsset, anchor string) ([]dramatizeShotResult, error) {
	results := make([]dramatizeShotResult, len(shots))
	sem := make(chan struct{}, dramatizeShotConcurrency)
	var wg sync.WaitGroup
	for i, shot := range shots {
		results[i] = dramatizeShotResult{Shot: shot, Duration: shot.Seconds}
		wg.Add(1)
		go func(index int, shot DramatizeShot) {
			defer wg.Done()
			select {
			case sem <- struct{}{}:
				defer func() { <-sem }()
			case <-ctx.Done():
				results[index].Error = ctx.Err().Error()
				return
			}
			primary, refs := remakeShotCharacterRefs(shot, references)
			prompt := shot.ImagePrompt + " Use the attached character sheets as authoritative identity, costume, anatomy, and proportions. Use the world board for production design. This is a finished cinematic start frame, not a model sheet. Do not copy the sheet layout into the shot."
			url, err := trailerGenerateImage(req.Sketch, req.ImageModel, prompt, primary, refs, "16:9")
			if err != nil {
				results[index].Error = err.Error()
				return
			}
			results[index].ImageURL = url
		}(i, shot)
	}
	wg.Wait()
	return results, ctx.Err()
}

func refineTrailerFrames(ctx context.Context, req dramatizeRequest, results []dramatizeShotResult, references []RemakeReferenceAsset, anchor, workDir string) ([]dramatizeShotResult, []RemakeConsistencyAudit) {
	passes := req.ConsistencyPasses
	if passes <= 0 {
		return results, nil
	}
	var audits []RemakeConsistencyAudit
	for pass := 1; pass <= passes+1; pass++ {
		audit := RemakeConsistencyAudit{Pass: pass}
		for _, character := range references {
			if character.Kind != "character" || character.Error != "" {
				continue
			}
			scores, err := auditTrailerCharacterFlash(ctx, workDir, character, results)
			if err != nil {
				scores, err = auditRemakeCharacter(ctx, character, results)
			}
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
			if pass > passes || score.Score >= remakeConsistencyThreshold {
				continue
			}
			index := resultIndexByShotID(results, score.ShotID)
			if index < 0 {
				continue
			}
			primary, refs := remakeShotCharacterRefs(results[index].Shot, references)
			prompt := results[index].Shot.ImagePrompt + " CONSISTENCY REPAIR: " + score.CorrectionPrompt + " The authoritative character sheet overrides conflicting details. Preserve action, composition, camera, and environment."
			url, err := trailerGenerateImage(false, req.ImageModel, prompt, primary, refs, "16:9")
			if err == nil && url != "" {
				results[index].ImageURL = url
				results[index].Regenerations++
				audit.Regenerated = append(audit.Regenerated, score.ShotID)
			}
		}
		audits = append(audits, audit)
		if len(audit.Regenerated) == 0 {
			break
		}
	}
	return results, audits
}

func animateTrailerShots(ctx context.Context, user *User, results []dramatizeShotResult) ([]dramatizeShotResult, error) {
	sem := make(chan struct{}, dramatizeShotConcurrency)
	var wg sync.WaitGroup
	for i := range results {
		if results[i].ImageURL == "" {
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
			prompt := results[index].Shot.MotionPrompt
			if results[index].DriveAudioURL != "" {
				prompt = strings.TrimSpace(prompt + " Perform in sync with the driving soundtrack. Mouth, breath, and blocking follow the attached audio.")
			}
			url, err := runH3ClipFromFrame(ctx, user, prompt, results[index].ImageURL, results[index].DriveAudioURL, int(results[index].Shot.Seconds))
			if err != nil && results[index].DriveAudioURL != "" {
				url, err = runH3ClipFromFrame(ctx, user, results[index].Shot.MotionPrompt, results[index].ImageURL, "", int(results[index].Shot.Seconds))
			}
			if err != nil {
				results[index].Error = err.Error()
				return
			}
			results[index].ClipURL = url
		}(i)
	}
	wg.Wait()
	return results, ctx.Err()
}

func trailerH3Request(prompt, firstFrame, audioURL string, seconds int) ServiceUsageRequest {
	seconds = trailerSnapSeconds(float64(seconds))
	include, structured := true, true
	req := ServiceUsageRequest{
		Service: "h3_video", Prompt: prompt, FirstFrame: firstFrame, ImageURL: firstFrame,
		AspectRatio: "16:9", Size: "native", Duration: seconds, NumSteps: 20,
		OutputFormat: "mp4-h264", IncludeAudio: &include, Structured: &structured,
	}
	if audio := strings.TrimSpace(audioURL); audio != "" {
		req.AudioURL = audio
	}
	return req
}

func runH3ClipFromFrame(ctx context.Context, user *User, prompt, firstFrame, audioURL string, seconds int) (string, error) {
	req := trailerH3Request(prompt, firstFrame, audioURL, seconds)
	if err := normalizeH3VideoRequest(&req); err != nil {
		return "", err
	}
	input := appNZH3Input(req)
	route := h3RouteForPrompt(prompt)
	if route.RunpodEndpointID != "" {
		if err := prepareH3RunpodOutputTarget(input, user.ID); err != nil {
			return "", err
		}
		expected, _ := input["_output_public_url"].(string)
		provider := map[string]interface{}{}
		for key, value := range input {
			provider[key] = value
		}
		stripH3ProviderTransparency(provider)
		var queued h3RunpodQueuedJob
		if _, err := submitScaledH3RunpodJob(route, provider, &queued); err != nil {
			return "", err
		}
		if queued.ID == "" {
			return "", fmt.Errorf("H3 returned no job")
		}
		scheduleH3ScaleToZero(route.RunpodEndpointID)
		return waitH3RunpodClip(ctx, route.RunpodEndpointID, queued.ID, expected)
	}
	if route.CogURL == "" {
		route.CogURL = h3LocalCogURL()
	}
	if route.CogURL == "" {
		return "", fmt.Errorf("H3 cog is not configured")
	}
	return waitH3LocalClip(ctx, route.CogURL, input)
}

func waitH3RunpodClip(ctx context.Context, endpointID, jobID, expectedURL string) (string, error) {
	deadline := time.Now().Add(4 * time.Hour)
	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}
		var state h3RunpodStatus
		if _, err := callH3Runpod(endpointID, "/status/"+url.PathEscape(jobID), http.MethodGet, nil, &state); err != nil {
			time.Sleep(3 * time.Second)
			continue
		}
		switch strings.ToUpper(strings.TrimSpace(state.Status)) {
		case "COMPLETED":
			if len(state.Output.Outputs) == 0 {
				return "", fmt.Errorf("H3 completed without an artifact")
			}
			videoURL, artifact, _, err := resolveH3RunpodArtifact(state.Output.Outputs[0], expectedURL)
			if err != nil {
				return "", err
			}
			if videoURL != "" {
				return videoURL, nil
			}
			return uploadH3RunpodVideo(ctx, artifact, "", state.Output.Outputs[0].ContentType)
		case "FAILED", "CANCELLED", "TIMED_OUT":
			return "", fmt.Errorf("H3 %s", strings.ToLower(state.Status))
		}
		time.Sleep(4 * time.Second)
	}
	return "", fmt.Errorf("H3 timed out")
}

func waitH3LocalClip(ctx context.Context, cogURL string, input map[string]interface{}) (string, error) {
	delete(input, "_h3_cog_url")
	delete(input, "_h3_variant")
	delete(input, "_output_upload_url")
	delete(input, "_output_public_url")
	stripH3ProviderTransparency(input)
	body, _ := json.Marshal(map[string]interface{}{"input": input})
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(cogURL, "/")+"/predictions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 50 * time.Minute}
	resp, err := client.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return "", err
	}
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("H3 cog returned %d: %s", resp.StatusCode, tailOutput(data))
	}
	var poll struct {
		Status string      `json:"status"`
		Error  string      `json:"error"`
		Output interface{} `json:"output"`
	}
	if err := json.Unmarshal(data, &poll); err != nil {
		return "", err
	}
	if strings.EqualFold(poll.Status, "failed") {
		return "", fmt.Errorf("H3 cog failed: %s", poll.Error)
	}
	videoURL := extractLocalH3OutputURL(poll.Output)
	if videoURL == "" {
		return "", fmt.Errorf("H3 cog returned no video URL")
	}
	return videoURL, nil
}

func assembleTrailer(ctx context.Context, shots []dramatizeShotResult, workDir, dest, musicURL, titleImageURL string) ([]dramatizeShotResult, error) {
	segmentDir := filepath.Join(workDir, "segments")
	if err := os.MkdirAll(segmentDir, 0o755); err != nil {
		return nil, err
	}
	segments := make([]string, 0, len(shots))
	timeline := make([]dramatizeShotResult, 0, len(shots))
	var cursor float64
	for i, shot := range shots {
		if shot.ClipURL == "" {
			continue
		}
		raw := filepath.Join(segmentDir, fmt.Sprintf("raw_%03d.mp4", i))
		if err := downloadToFile(ctx, shot.ClipURL, raw); err != nil {
			shot.Error = err.Error()
			continue
		}
		segmentPath := filepath.Join(segmentDir, fmt.Sprintf("seg_%03d.mp4", i))
		probe, err := probeVideoFile(ctx, raw)
		if err != nil {
			shot.Error = err.Error()
			continue
		}
		if err := renderTrailerSegment(ctx, raw, shot.Shot.Seconds, probe.HasAudio, segmentPath); err != nil {
			shot.Error = err.Error()
			continue
		}
		shot.Start, shot.Duration = cursor, shot.Shot.Seconds
		cursor += shot.Shot.Seconds
		shot.AssetURL = segmentPath
		timeline = append(timeline, shot)
		segments = append(segments, segmentPath)
	}
	if title := strings.TrimSpace(titleImageURL); title != "" {
		still := filepath.Join(segmentDir, "title-still.png")
		if downloadToFile(ctx, title, still) == nil {
			hold := filepath.Join(segmentDir, "title-hold.mp4")
			if err := renderTrailerTitleHold(ctx, still, hold, 3); err == nil {
				shot := dramatizeShotResult{Shot: DramatizeShot{ID: "title", Kind: dramatizeShotKindGenerated, Seconds: 3}, ImageURL: title, Start: cursor, Duration: 3, AssetURL: hold}
				cursor += 3
				timeline = append(timeline, shot)
				segments = append(segments, hold)
			}
		}
	}
	if len(segments) == 0 {
		return nil, fmt.Errorf("no clips to assemble")
	}
	joined := filepath.Join(workDir, "picture.mp4")
	if err := concatSegments(ctx, segments, joined); err != nil {
		return nil, err
	}
	if strings.TrimSpace(musicURL) == "" {
		if err := os.Rename(joined, dest); err != nil {
			return nil, copyFile(joined, dest)
		}
		return timeline, nil
	}
	musicPath := filepath.Join(workDir, "score.audio")
	if err := downloadToFile(ctx, musicURL, musicPath); err != nil {
		_ = os.Rename(joined, dest)
		return timeline, nil
	}
	if err := mixTrailerScore(ctx, joined, musicPath, dest); err != nil {
		_ = os.Rename(joined, dest)
	}
	return timeline, nil
}

func mixTrailerScore(ctx context.Context, videoPath, musicPath, dest string) error {
	filter := "[1:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=0.24,afade=t=in:st=0:d=1.2[m];[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a];[a][m]amix=inputs=2:duration=first:dropout_transition=2,alimiter=limit=0.95[mix]"
	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-v", "error", "-i", videoPath, "-i", musicPath,
		"-filter_complex", filter, "-map", "0:v:0", "-map", "[mix]",
		"-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dest)
	if combined, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("mix score: %w: %s", err, tailOutput(combined))
	}
	return nil
}

func copyFile(src, dest string) error {
	blob, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dest, blob, 0o644)
}

func countTrailerImages(results []dramatizeShotResult) int {
	n := 0
	for _, shot := range results {
		if shot.ImageURL != "" {
			n++
		}
	}
	return n
}

func trailerMotionPrompt(prompt string) string {
	prompt = strings.TrimSpace(prompt)
	lock := "High-definition cinematic image-to-video. Precise natural lip sync if anyone speaks. Native room tone. No subtitles, no captions, no logos, no on-screen text unless this beat is an explicit title card."
	if strings.Contains(strings.ToLower(prompt), "lip sync") {
		return prompt
	}
	return strings.TrimSpace(prompt + " " + lock)
}

func trailerTitleFromText(text string) string {
	match := trailerTitleLine.FindStringSubmatch(text)
	if match == nil {
		return ""
	}
	return strings.TrimSpace(strings.Trim(match[1], `"'`))
}

func trailerSpeakerIDs(text string) []string {
	var ids []string
	seen := map[string]bool{}
	for _, line := range extractTrailerSpeakerLines(text) {
		id := canonicalCharacterID(line.Name)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	return ids
}

func renderTrailerSegment(ctx context.Context, source string, duration float64, hasAudio bool, dest string) error {
	args := []string{"-y", "-v", "error", "-i", source}
	if !hasAudio {
		args = append(args, "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100")
	}
	if duration > 0 {
		args = append(args, "-t", fmt.Sprintf("%.3f", duration))
	}
	args = append(args,
		"-map", "0:v:0",
		"-map", map[bool]string{true: "0:a:0", false: "1:a:0"}[hasAudio],
		"-vf", fmt.Sprintf("fps=%d,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1", trailerFPS, trailerCanvasWidth, trailerCanvasHeight, trailerCanvasWidth, trailerCanvasHeight),
		"-c:v", "libx264", "-preset", "medium", "-crf", "17",
		"-pix_fmt", "yuv420p",
		"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
		"-g", fmt.Sprintf("%d", trailerFPS),
		"-shortest", "-movflags", "+faststart", dest,
	)
	if combined, err := exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput(); err != nil {
		return fmt.Errorf("render trailer segment: %w: %s", err, tailOutput(combined))
	}
	return nil
}

func renderTrailerTitleHold(ctx context.Context, imagePath, dest string, seconds float64) error {
	if seconds <= 0 {
		seconds = 3
	}
	frames := int(seconds * float64(trailerFPS))
	filter := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,zoompan=z='min(zoom+0.00025,1.018)':d=%d:s=%dx%d:fps=%d,format=yuv420p",
		trailerCanvasWidth, trailerCanvasHeight, trailerCanvasWidth, trailerCanvasHeight, frames, trailerCanvasWidth, trailerCanvasHeight, trailerFPS)
	cmd := exec.CommandContext(ctx, "ffmpeg", "-y", "-v", "error", "-loop", "1", "-i", imagePath,
		"-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
		"-vf", filter, "-t", fmt.Sprintf("%.3f", seconds),
		"-c:v", "libx264", "-preset", "medium", "-crf", "17",
		"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
		"-shortest", "-movflags", "+faststart", dest)
	if combined, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("title hold: %w: %s", err, tailOutput(combined))
	}
	return nil
}
