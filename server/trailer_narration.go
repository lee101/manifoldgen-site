package main

// Off-screen narrator VO. Never part of H3 drive audio (that would lip-sync on-screen mouths); synthesized separately
// (ElevenLabs v3 with delivery tags, Gemini TTS fallback), placed at shot starts in the master, and ducks the score.

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"
)

const (
	trailerNarratorElevenVoice = "George"
	trailerNarratorGeminiVoice = "Enceladus"
	trailerNarratorTakes       = 2
	trailerNarrationLead       = 0.4
	trailerNarrationGap        = 0.25
	trailerNarrationMaxRunes   = 240
	trailerTitleShotID         = "title"
	trailerTitleHold           = 3.0
)

type trailerNarrationCue struct {
	ID       json.RawMessage `json:"id,omitempty"`
	Shot     string          `json:"shot,omitempty"`
	VO       string          `json:"vo,omitempty"`
	Text     string          `json:"text,omitempty"`
	Delivery string          `json:"delivery,omitempty"`
}

type trailerNarrationLine struct {
	ShotID   string  `json:"shot_id"`
	Text     string  `json:"text"`
	Delivery string  `json:"delivery,omitempty"`
	Engine   string  `json:"engine,omitempty"`
	Voice    string  `json:"voice,omitempty"`
	Takes    int     `json:"takes,omitempty"`
	AudioURL string  `json:"audio_url,omitempty"`
	Start    float64 `json:"timeline_start,omitempty"`
	Duration float64 `json:"duration,omitempty"`
	Error    string  `json:"error,omitempty"`
	path     string
}

var (
	trailerNarrationRowRe = regexp.MustCompile(`(?i)^(?:shot\s*)?(\d{1,2}|end[\s-]*card|title(?:\s*card)?)\s*(?:vo|v\.o\.|narrator)?\s*[:.)—–-]\s*(.+)$`)
	trailerNarrationDelRe = regexp.MustCompile(`\s*\(([^()]{2,120})\)\s*$`)
	trailerBriefVORe      = regexp.MustCompile(`(?i)\s*\b(?:VO|V\.O\.|narrator|voice[\s-]?over)\s*:\s*["“]?([^"”]+?)["”]?\s*$`)
)

func trailerNarrationShotID(raw string) string {
	raw = strings.ToLower(strings.Trim(strings.TrimSpace(raw), `"'`))
	raw = strings.TrimPrefix(strings.TrimSpace(strings.TrimPrefix(raw, "shot")), "_")
	if strings.HasPrefix(raw, "end") || strings.HasPrefix(raw, "title") {
		return trailerTitleShotID
	}
	if n, err := strconv.Atoi(strings.TrimLeft(raw, "0")); err == nil && n > 0 && n <= trailerHardMaxShots {
		return fmt.Sprintf("shot_%03d", n)
	}
	return ""
}

func trailerCleanNarration(text string) string {
	text = strings.Trim(strings.TrimSpace(text), `"'“”`)
	if utf8.RuneCountInString(text) > trailerNarrationMaxRunes {
		text = string([]rune(text)[:trailerNarrationMaxRunes])
	}
	return strings.TrimSpace(text)
}

// parseTrailerNarrationScript reads a markdown table (| shot | line | delivery |) or "N: line (delivery)" lines;
// "end card"/"title" maps to the title hold.
func parseTrailerNarrationScript(script string) []trailerNarrationLine {
	var lines []trailerNarrationLine
	for _, raw := range strings.Split(script, "\n") {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			continue
		}
		var id, text, delivery string
		if strings.HasPrefix(raw, "|") {
			var cells []string
			for _, c := range strings.Split(strings.Trim(raw, "|"), "|") {
				cells = append(cells, strings.TrimSpace(c))
			}
			if len(cells) < 2 {
				continue
			}
			id, text = trailerNarrationShotID(cells[0]), cells[1]
			if len(cells) > 2 {
				delivery = cells[2]
			}
		} else if m := trailerNarrationRowRe.FindStringSubmatch(raw); m != nil {
			id, text = trailerNarrationShotID(m[1]), m[2]
			if d := trailerNarrationDelRe.FindStringSubmatch(text); d != nil {
				delivery, text = d[1], text[:len(text)-len(d[0])]
			}
		}
		if text = trailerCleanNarration(text); id == "" || text == "" {
			continue
		}
		lines = append(lines, trailerNarrationLine{ShotID: id, Text: text, Delivery: strings.TrimSpace(delivery)})
	}
	return lines
}

func trailerNarrationFromCues(cues []trailerNarrationCue) []trailerNarrationLine {
	var lines []trailerNarrationLine
	for _, cue := range cues {
		id := trailerNarrationShotID(cue.Shot)
		if id == "" && len(cue.ID) > 0 {
			id = trailerNarrationShotID(string(cue.ID))
		}
		text := trailerCleanNarration(firstNonEmpty(cue.Text, cue.VO))
		if id == "" || text == "" {
			continue
		}
		lines = append(lines, trailerNarrationLine{ShotID: id, Text: text, Delivery: strings.TrimSpace(cue.Delivery)})
	}
	return lines
}

// normalizeTrailerNarration folds NarrationScript and the cue list into canonical cues (later entries win per shot).
func normalizeTrailerNarration(req *dramatizeRequest) error {
	req.NarrationScript = strings.TrimSpace(req.NarrationScript)
	req.NarratorVoice = strings.TrimSpace(req.NarratorVoice)
	if len(req.NarrationScript) > 6000 {
		return fmt.Errorf("the narration script must be 6000 characters or fewer")
	}
	lines := append(parseTrailerNarrationScript(req.NarrationScript), trailerNarrationFromCues(req.Narration)...)
	byID := map[string]int{}
	var out []trailerNarrationCue
	for _, line := range lines {
		cue := trailerNarrationCue{Shot: line.ShotID, Text: line.Text, Delivery: line.Delivery}
		if i, ok := byID[line.ShotID]; ok {
			out[i] = cue
			continue
		}
		byID[line.ShotID] = len(out)
		out = append(out, cue)
	}
	if len(out) > trailerHardMaxShots+1 {
		out = out[:trailerHardMaxShots+1]
	}
	req.Narration, req.NarrationScript = out, ""
	return nil
}

// trailerPlannerNarrates: the story model writes VO only when asked and nothing was scripted.
func trailerPlannerNarrates(req dramatizeRequest) bool {
	return req.Narrator && len(req.Narration) == 0
}

func trailerSplitVO(desc string) (string, string) {
	m := trailerBriefVORe.FindStringSubmatchIndex(desc)
	if m == nil {
		return desc, ""
	}
	return strings.TrimSpace(desc[:m[0]]), trailerCleanNarration(desc[m[2]:m[3]])
}

func trailerNarrationFromBrief(prompt string, maxShots int) []trailerNarrationLine {
	var lines []trailerNarrationLine
	n := 0
	for _, line := range strings.Split(prompt, "\n") {
		match := trailerShotLine.FindStringSubmatch(strings.TrimSpace(line))
		if match == nil {
			continue
		}
		n++
		if n > maxShots {
			break
		}
		if _, vo := trailerSplitVO(match[3]); vo != "" {
			lines = append(lines, trailerNarrationLine{ShotID: fmt.Sprintf("shot_%03d", n), Text: vo})
		}
	}
	return lines
}

// trailerMergeNarration: scripted cues beat brief VO beat planner VO; planner VO never lands on a shot with on-camera
// dialogue; unknown shots are dropped; result is in timeline order with the title last.
func trailerMergeNarration(scripted []trailerNarrationCue, brief, planned []trailerNarrationLine, shots []DramatizeShot) []trailerNarrationLine {
	order := map[string]int{trailerTitleShotID: len(shots)}
	dialogue := map[string]bool{}
	for i, shot := range shots {
		order[shot.ID] = i
		dialogue[shot.ID] = strings.TrimSpace(shot.DialogueTranscript) != ""
	}
	byID := map[string]trailerNarrationLine{}
	for _, line := range planned {
		if !dialogue[line.ShotID] {
			byID[line.ShotID] = line
		}
	}
	for _, line := range brief {
		byID[line.ShotID] = line
	}
	for _, line := range trailerNarrationFromCues(scripted) {
		byID[line.ShotID] = line
	}
	var out []trailerNarrationLine
	for id, line := range byID {
		if _, ok := order[id]; ok && strings.TrimSpace(line.Text) != "" {
			out = append(out, line)
		}
	}
	sort.Slice(out, func(i, j int) bool { return order[out[i].ShotID] < order[out[j].ShotID] })
	return out
}

// trailerPlaceNarration puts each synthesized line just after its shot starts in the cut timeline, pushing later lines
// so they never overlap; lines whose shot was dropped or that would start past the end are left out.
func trailerPlaceNarration(lines []trailerNarrationLine, timeline []dramatizeShotResult, total float64) []trailerNarrationLine {
	starts := map[string]float64{}
	for _, shot := range timeline {
		starts[shot.Shot.ID] = shot.Start
	}
	var placed []trailerNarrationLine
	prevEnd := -trailerNarrationGap
	for _, line := range lines {
		start, ok := starts[line.ShotID]
		if !ok || line.Duration <= 0 {
			continue
		}
		start = max(start+trailerNarrationLead, prevEnd+trailerNarrationGap)
		if start >= total-0.5 {
			continue
		}
		line.Start = start
		prevEnd = start + line.Duration
		placed = append(placed, line)
	}
	return placed
}

func trailerNarrationWindows(lines []trailerNarrationLine) []trailerScoreWindow {
	windows := make([]trailerScoreWindow, 0, len(lines))
	for _, line := range lines {
		windows = append(windows, trailerScoreWindow{Start: line.Start, End: line.Start + line.Duration})
	}
	return windows
}

type trailerNarratorEngine struct{ Engine, Voice string }

// Gemini 3.1 Flash TTS is the narrator default: it is the only engine that honours a time budget in the prompt
// (vampirewellington/out/vo/review.md). ElevenLabs v3 is the fallback, stretched in post because it reads 30-50% fast.
func trailerNarratorEngines(voice string) []trailerNarratorEngine {
	eleven, _ := voiceModelByID("eleven-v3")
	if voice != "" && containsString(eleven.Voices, voice) {
		return []trailerNarratorEngine{{"eleven-v3", voice}, {"gemini", trailerNarratorGeminiVoice}}
	}
	engines := []trailerNarratorEngine{{"gemini", firstNonEmpty(voice, trailerNarratorGeminiVoice)}}
	if voice != "" && voice != trailerNarratorGeminiVoice {
		engines = append(engines, trailerNarratorEngine{"gemini", trailerNarratorGeminiVoice})
	}
	return append(engines, trailerNarratorEngine{"eleven-v3", trailerNarratorElevenVoice})
}

func trailerNarratorProfile(voice string) string {
	switch voice {
	case "Gacrux", "Kore", "Aoede", "Leda", "Sulafat", "Vindemiatrix":
		return "Elderly woman, low smoky alto, grandmother by the fire, close to the microphone, cinematic horror trailer narrator, quiet menace and gravity, slow, never shouty, pauses are part of the read."
	}
	return "Old, weathered man, very deep gravelly baritone, close to the microphone, cinematic horror trailer narrator, quiet menace and gravity, slow, never shouty, pauses are part of the read."
}

// trailerNarrationBudget is the speech-span window a take must land in to sit inside its slot with room to breathe.
func trailerNarrationBudget(slot float64) (lo, hi float64) {
	lo = math.Max(0.8, slot-2)
	hi = math.Max(lo+0.6, slot-0.8)
	return lo, hi
}

// trailerNarratorTagged is the ElevenLabs v3 text: pace and delivery as an inline audio tag ahead of the line.
func trailerNarratorTagged(text, delivery string) string {
	text = strings.TrimSpace(text)
	if strings.HasPrefix(text, "[") {
		return text
	}
	delivery = strings.Trim(strings.TrimSpace(delivery), "[]")
	if delivery == "" {
		delivery = "low, close"
	}
	return "[slowly, " + delivery + "] " + text
}

// trailerNarratorPrompt keeps the trailerDirectorPrompt shape: without the header and the trailing transcript section,
// short lines come back as model_moderated with no audio.
func trailerNarratorPrompt(line trailerNarrationLine, voice string, lo, hi float64) string {
	return fmt.Sprintf(`Read the following transcript based on the audio profile and director's note.

# Audio Profile
%s
# Director's note
Style: %s. Pace: slow; pauses are part of the read. The whole line must take about %.1f to %.1f seconds including pauses, no longer. One take, no extra words.
## Scene:
Off-screen narrator over a cinematic trailer shot. Nobody on screen speaks.

## Transcript:
%s`, trailerNarratorProfile(voice), firstNonEmpty(line.Delivery, "measured, low, unhurried"), lo, hi, line.Text)
}

type trailerLoudness struct {
	I, TP, LRA, Thresh, Offset float64
}

func trailerParseLoudnorm(output string) (trailerLoudness, error) {
	start, end := strings.LastIndex(output, "{"), strings.LastIndex(output, "}")
	if start < 0 || end <= start {
		return trailerLoudness{}, fmt.Errorf("loudnorm printed no stats")
	}
	var raw map[string]string
	if err := json.Unmarshal([]byte(output[start:end+1]), &raw); err != nil {
		return trailerLoudness{}, err
	}
	num := func(key string) float64 {
		v, err := strconv.ParseFloat(strings.TrimSpace(raw[key]), 64)
		if err != nil || math.IsInf(v, 0) || math.IsNaN(v) {
			return -70
		}
		return v
	}
	l := trailerLoudness{I: num("input_i"), TP: num("input_tp"), LRA: num("input_lra"), Thresh: num("input_thresh"), Offset: num("target_offset")}
	if l.LRA == -70 {
		l.LRA = 0
	}
	return l, nil
}

// trailerVOTrimFilter strips the 0.3-0.8 s of silence TTS pads at each end; stretch < 1 slows a fast engine.
func trailerVOTrimFilter(stretch float64) string {
	f := "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,highpass=f=70"
	if stretch > 0 && stretch != 1 {
		f += fmt.Sprintf(",atempo=%.3f", 1/stretch)
	}
	return f
}

// postTrailerVO trims and two-pass loudnorms a raw take to -16 LUFS; returns the speech span and loudness range.
func postTrailerVO(ctx context.Context, raw, dest string, stretch float64) (float64, float64, error) {
	trim := trailerVOTrimFilter(stretch)
	const target = "I=-16:TP=-1.5:LRA=11"
	out, err := exec.CommandContext(ctx, "ffmpeg", "-hide_banner", "-nostats", "-i", raw, "-af", trim+",loudnorm="+target+":print_format=json", "-f", "null", "-").CombinedOutput()
	if err != nil {
		return 0, 0, fmt.Errorf("measure VO: %w: %s", err, tailOutput(out))
	}
	l, err := trailerParseLoudnorm(string(out))
	if err != nil {
		return 0, 0, err
	}
	second := fmt.Sprintf("%s,loudnorm=%s:measured_I=%.2f:measured_TP=%.2f:measured_LRA=%.2f:measured_thresh=%.2f:offset=%.2f:linear=true,aresample=44100", trim, target, l.I, l.TP, l.LRA, l.Thresh, l.Offset)
	if err := runTrailerFFmpeg(ctx, []string{"-y", "-v", "error", "-i", raw, "-af", second, "-ar", "44100", "-ac", "2", dest}); err != nil {
		return 0, 0, err
	}
	span, err := probeAudioSeconds(ctx, dest)
	return span, l.LRA, err
}

type trailerVOTake struct {
	Path      string
	Span, LRA float64
}

// trailerPickTake prefers takes whose speech span lands in [lo, hi], then the steadier loudness.
func trailerPickTake(takes []trailerVOTake, lo, hi float64) int {
	best, bestScore := -1, math.Inf(1)
	for i, t := range takes {
		if t.Path == "" || t.Span <= 0 {
			continue
		}
		miss := math.Max(0, lo-t.Span) + math.Max(0, t.Span-hi)
		if score := 10*miss + 0.05*t.LRA; score < bestScore {
			best, bestScore = i, score
		}
	}
	return best
}

func trailerNarratorTake(ctx context.Context, line trailerNarrationLine, engine trailerNarratorEngine, lo, hi float64, rawPrefix string) (string, float64, error) {
	if engine.Engine == "eleven-v3" {
		input, model, err := normalizeVoiceInput(voiceGenerationInput{Model: "eleven-v3", Text: trailerNarratorTagged(line.Text, line.Delivery), Voice: engine.Voice})
		if err != nil {
			return "", 0, err
		}
		blob, err := voiceFalCall(input, model, 0)
		if err != nil {
			return "", 0, err
		}
		usd := voiceChargedUSD(model, utf8.RuneCountInString(input.Text), voiceResultDuration(blob))
		audioURL := voiceResultURL(blob)
		if audioURL == "" {
			return "", usd, fmt.Errorf("ElevenLabs returned no audio")
		}
		path := rawPrefix + ".mp3"
		return path, usd, downloadToFile(ctx, audioURL, path)
	}
	prompt := trailerNarratorPrompt(line, engine.Voice, lo, hi)
	req := ServiceUsageRequest{Service: "openpaths_tts", Input: prompt, Voice: engine.Voice, Language: "en-GB", Temperature: 1}
	blob, err := proxyOpenPathsGeminiTTS(req)
	if err != nil {
		blob, err = proxyOpenPathsGeminiTTS(req)
	}
	if err != nil {
		return "", 0, err
	}
	usd := trailerSpeechUSD(blob, prompt)
	path, err := writeTrailerGeminiAudio(ctx, blob, rawPrefix)
	return path, usd, err
}

func synthesizeTrailerNarrationLine(ctx context.Context, userID string, line trailerNarrationLine, engine trailerNarratorEngine, slot float64, destPrefix string) (trailerNarrationLine, float64, error) {
	lo, hi := trailerNarrationBudget(slot)
	takes, stretch := trailerNarratorTakes, 1.0
	if engine.Engine == "eleven-v3" {
		takes, stretch = 1, 0.88
	}
	var usd float64
	var rolled []trailerVOTake
	var lastErr error
	for k := 0; k < takes && ctx.Err() == nil; k++ {
		raw, cost, err := trailerNarratorTake(ctx, line, engine, lo, hi, fmt.Sprintf("%s_raw%d", destPrefix, k))
		usd += cost
		if err != nil {
			lastErr = err
			continue
		}
		take := trailerVOTake{Path: fmt.Sprintf("%s_take%d.wav", destPrefix, k)}
		if take.Span, take.LRA, err = postTrailerVO(ctx, raw, take.Path, stretch); err != nil {
			lastErr = err
			continue
		}
		rolled = append(rolled, take)
	}
	pick := trailerPickTake(rolled, lo, hi)
	if pick < 0 {
		if lastErr == nil {
			lastErr = fmt.Errorf("no usable narrator take")
		}
		return line, usd, lastErr
	}
	line.Engine, line.Voice, line.Takes = engine.Engine, engine.Voice, len(rolled)
	line.path, line.Duration = rolled[pick].Path, rolled[pick].Span
	if blob, err := os.ReadFile(line.path); err == nil {
		if url, upErr := persistTrailerAudioBytes(userID, "trailer-vo-"+line.ShotID+".wav", blob, "audio/wav"); upErr == nil {
			line.AudioURL = url
		}
	}
	return line, usd, nil
}

// synthesizeTrailerNarration voices each line against its slot (the shot's cut length) with engine fallback.
func synthesizeTrailerNarration(ctx context.Context, user *User, voice string, lines []trailerNarrationLine, slots map[string]float64, workDir string) ([]trailerNarrationLine, float64) {
	out := append([]trailerNarrationLine(nil), lines...)
	dir := filepath.Join(workDir, "vo")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		for i := range out {
			out[i].Error = err.Error()
		}
		return out, 0
	}
	userID := ""
	if user != nil {
		userID = user.ID
	}
	var mu sync.Mutex
	var usd float64
	trailerParallel(len(out), dramatizeShotConcurrency, func(i int) {
		slot := slots[out[i].ShotID]
		if slot <= 0 {
			slot = trailerTitleHold
		}
		var lastErr error
		for n, engine := range trailerNarratorEngines(voice) {
			if ctx.Err() != nil {
				lastErr = ctx.Err()
				break
			}
			line, cost, err := synthesizeTrailerNarrationLine(ctx, userID, out[i], engine, slot, filepath.Join(dir, fmt.Sprintf("vo_%02d_%d", i, n)))
			mu.Lock()
			usd += cost
			mu.Unlock()
			if err == nil {
				out[i] = line
				return
			}
			lastErr = err
		}
		if lastErr != nil {
			out[i].Error = lastErr.Error()
		}
	})
	return out, usd
}

func trailerParallel(n, limit int, fn func(i int)) {
	sem := make(chan struct{}, max(1, limit))
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		sem <- struct{}{}
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			defer func() { <-sem }()
			fn(i)
		}(i)
	}
	wg.Wait()
}

// trailerVOStemFilter delays each post-processed line to its slot and sums them over silence of the master's length
// (the silent bed sets the duration; apad after loudnorm truncates).
func trailerVOStemFilter(lines []trailerNarrationLine, total float64) string {
	const af = "aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo"
	parts := []string{fmt.Sprintf("anullsrc=r=44100:cl=stereo:d=%.3f,%s[z]", total, af)}
	labels := "[z]"
	for i, line := range lines {
		ms := int(line.Start*1000 + 0.5)
		parts = append(parts, fmt.Sprintf("[%d:a]aresample=44100,%s,adelay=%d|%d[v%d]", i, af, ms, ms, i))
		labels += fmt.Sprintf("[v%d]", i)
	}
	parts = append(parts, fmt.Sprintf("%samix=inputs=%d:duration=first:dropout_transition=0:normalize=0[vo]", labels, len(lines)+1))
	return strings.Join(parts, ";")
}

func buildTrailerVOStem(ctx context.Context, lines []trailerNarrationLine, total float64, dest string) error {
	args := []string{"-y", "-v", "error"}
	for _, line := range lines {
		args = append(args, "-i", line.path)
	}
	args = append(args, "-filter_complex", trailerVOStemFilter(lines, total), "-map", "[vo]", "-ar", "44100", "-ac", "2", dest)
	return runTrailerFFmpeg(ctx, args)
}
