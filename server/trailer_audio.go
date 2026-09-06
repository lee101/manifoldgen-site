package main

// Trailer speech + score: Gemini 3.1 Flash TTS with director-style transcripts,
// Music3 bed, then a per-shot mix snapped to the same 5–15s window H3 will
// generate so Ref2VA driving audio lines up with the clip.

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

const (
	trailerMinShotSeconds = 5
	trailerMaxShotSeconds = 15
	trailerMusicBedVol    = 0.22
	trailerTTSCharsGuess  = 700
)

var trailerVoicePalette = []trailerVoice{
	{"Kore", "A low, unhurried close speaker", "Whispering", "Measured", "Neutral"},
	{"Puck", "A younger determined speaker", "Empathetic", "Natural", "Neutral"},
	{"Fenrir", "An older worn speaker", "Deadpan", "Natural", "Neutral"},
	{"Charon", "A cold precise speaker", "Authoritative", "Measured", "Neutral"},
	{"Orus", "A calm commanding speaker", "Deadpan", "Measured", "Neutral"},
	{"Aoede", "A lyrical close speaker", "Empathetic", "Measured", "Neutral"},
	{"Zephyr", "A bright in-world speaker", "Natural", "Natural", "Neutral"},
	{"Iapetus", "A grave distant speaker", "Deadpan", "Slow", "Neutral"},
}

var (
	trailerSpeakerStartRe = regexp.MustCompile(`(?i)\b([A-Z][a-zA-Z][A-Za-z' -]{0,38}):\s*`)
	trailerQuoteRe        = regexp.MustCompile(`[“"]([^"”]{3,240})[”"]`)
	trailerLeadingTagsRe  = regexp.MustCompile(`^((?:\[[^\]]+\]\s*)*)`)
)

type trailerVoice struct {
	Voice   string
	Profile string
	Style   string
	Pace    string
	Accent  string
}

type trailerSpeakerLine struct {
	Name string
	Tags string
	Text string
}

func trailerSnapSeconds(seconds float64) int {
	n := int(math.Round(seconds))
	if n < trailerMinShotSeconds {
		n = trailerMinShotSeconds
	}
	if n > trailerMaxShotSeconds {
		n = trailerMaxShotSeconds
	}
	return n
}

func trailerMusicDuration(shots []DramatizeShot) int {
	total := 3
	for _, shot := range shots {
		total += trailerSnapSeconds(shot.Seconds)
	}
	if total < studioMusicMinDuration {
		total = studioMusicMinDuration
	}
	if total > studioMusicMaxDuration {
		total = studioMusicMaxDuration
	}
	return total
}

func trailerSpeechUSD(blob []byte, prompt string) float64 {
	usd, _, _ := geminiTTSResultCostUSD(blob, estimateGeminiTTSCostUSD(prompt))
	return usd
}

func trailerVoiceForName(name string) trailerVoice {
	name = strings.TrimSpace(name)
	if name == "" {
		return trailerVoicePalette[0]
	}
	h := 0
	for _, r := range strings.ToLower(name) {
		h = h*31 + int(r)
	}
	if h < 0 {
		h = -h
	}
	return trailerVoicePalette[h%len(trailerVoicePalette)]
}

func trailerLooksLikeSpeaker(name string) bool {
	switch strings.ToLower(strings.TrimSpace(name)) {
	case "shot", "scene", "note", "style", "pace", "speaker", "speaker 1", "speaker 2", "context", "transcript":
		return false
	}
	return strings.TrimSpace(name) != ""
}

func extractTrailerQuotes(text string) []string {
	var quotes []string
	for _, match := range trailerQuoteRe.FindAllStringSubmatch(text, -1) {
		q := strings.TrimSpace(match[1])
		if q != "" {
			quotes = append(quotes, q)
		}
	}
	return quotes
}

func extractTrailerSpeakerLines(text string) []trailerSpeakerLine {
	matches := trailerSpeakerStartRe.FindAllStringSubmatchIndex(text, -1)
	var lines []trailerSpeakerLine
	for i, match := range matches {
		if len(match) < 4 {
			continue
		}
		name := strings.TrimSpace(text[match[2]:match[3]])
		if !trailerLooksLikeSpeaker(name) {
			continue
		}
		end := len(text)
		if i+1 < len(matches) {
			end = matches[i+1][0]
		}
		rest := strings.TrimSpace(text[match[1]:end])
		tags := ""
		if tagMatch := trailerLeadingTagsRe.FindStringSubmatch(rest); len(tagMatch) > 1 {
			tags = strings.TrimSpace(tagMatch[1])
			rest = strings.TrimSpace(rest[len(tagMatch[1]):])
		}
		rest = strings.Trim(rest, `"'“” `)
		if rest == "" {
			continue
		}
		if tags == "" {
			tags = trailerDefaultTags(name, "")
		}
		lines = append(lines, trailerSpeakerLine{Name: name, Tags: tags, Text: rest})
		if len(lines) == 2 {
			break
		}
	}
	return lines
}

func trailerDefaultTags(name, emotion string) string {
	e := strings.ToLower(emotion + " " + name)
	switch {
	case strings.Contains(e, "whisper"):
		return "[whispers]"
	case strings.Contains(e, "anger"), strings.Contains(e, "angry"), strings.Contains(e, "shout"):
		return "[shouting][angry]"
	case strings.Contains(e, "urgent"), strings.Contains(e, "plea"):
		return "[urgency]"
	case strings.Contains(e, "pensive"), strings.Contains(e, "grief"):
		return "[pensive]"
	case strings.Contains(e, "suspect"), strings.Contains(e, "wary"):
		return "[suspicion]"
	case strings.Contains(e, "determin"):
		return "[determination]"
	default:
		voice := trailerVoiceForName(name)
		switch voice.Style {
		case "Whispering":
			return "[whispers]"
		case "Authoritative":
			return "[authoritative]"
		case "Deadpan":
			return "[deadpan]"
		default:
			return "[caution]"
		}
	}
}

func trailerNamesInText(text string, characters []string) []string {
	var names []string
	seen := map[string]bool{}
	add := func(name string) {
		name = strings.TrimSpace(name)
		if name == "" || seen[strings.ToLower(name)] {
			return
		}
		seen[strings.ToLower(name)] = true
		names = append(names, name)
	}
	for _, id := range characters {
		add(characterDisplayName(id))
	}
	for _, line := range extractTrailerSpeakerLines(text) {
		add(line.Name)
	}
	return names
}

func formatTrailerTranscript(lines []trailerSpeakerLine) string {
	var b strings.Builder
	for i, line := range lines {
		if i >= 2 {
			break
		}
		if i > 0 {
			b.WriteByte('\n')
		}
		tag := strings.TrimSpace(line.Tags)
		if tag != "" && !strings.HasSuffix(tag, " ") {
			tag += " "
		}
		fmt.Fprintf(&b, "Speaker %d: %s%s", i+1, tag, strings.TrimSpace(line.Text))
	}
	return b.String()
}

func seedTrailerTranscript(text string, characters []string) string {
	lines := extractTrailerSpeakerLines(text)
	if len(lines) == 0 {
		quotes := extractTrailerQuotes(text)
		names := trailerNamesInText(text, characters)
		for i, quote := range quotes {
			name := ""
			if i < len(names) {
				name = names[i]
			} else if len(names) > 0 {
				name = names[0]
			}
			lines = append(lines, trailerSpeakerLine{Name: name, Tags: trailerDefaultTags(name, ""), Text: quote})
			if len(lines) == 2 {
				break
			}
		}
	}
	return formatTrailerTranscript(lines)
}

func trailerCastFromShot(shot DramatizeShot) (transcript string, voices []ServiceSpeakerVoice, profiles []trailerVoice) {
	transcript = strings.TrimSpace(shot.DialogueTranscript)
	if transcript == "" {
		transcript = seedTrailerTranscript(strings.TrimSpace(shot.VisualDescription+" "+shot.MotionPrompt+" "+shot.DirectorNote), shot.Characters)
	}
	names := trailerNamesInText(shot.VisualDescription+" "+transcript, shot.Characters)
	has1 := strings.Contains(transcript, "Speaker 1:")
	if !has1 {
		transcript = seedTrailerTranscript(transcript+" "+shot.VisualDescription, shot.Characters)
	}
	if !strings.Contains(transcript, "Speaker 1:") {
		return "", nil, nil
	}
	n := 1
	if strings.Contains(transcript, "Speaker 2:") {
		n = 2
	}
	for i := 0; i < n; i++ {
		name := ""
		if i < len(names) {
			name = names[i]
		}
		voice := trailerVoiceForName(name)
		profiles = append(profiles, voice)
		voices = append(voices, ServiceSpeakerVoice{Speaker: fmt.Sprintf("Speaker %d", i+1), Voice: voice.Voice})
	}
	return transcript, voices, profiles
}

func trailerDirectorPrompt(shot DramatizeShot, transcript string, profiles []trailerVoice, seconds int) string {
	var profile, note strings.Builder
	for i, p := range profiles {
		fmt.Fprintf(&profile, "For Speaker %d: %s\n", i+1, p.Profile)
		fmt.Fprintf(&note, "For Speaker %d: Style: %s. Pace: %s. Accent: %s.\n", i+1, p.Style, p.Pace, p.Accent)
	}
	scene := firstNonEmpty(shot.Environment, shot.VisualDescription, "Cinematic trailer interior")
	context := fmt.Sprintf("Cinematic trailer performance. The entire reading must fit in %d seconds. Do not add extra lines or a narrator. Tone is tense and close. %s", seconds, strings.TrimSpace(shot.DirectorNote+" "+shot.Emotion+" "+shot.Action))
	return strings.TrimSpace(fmt.Sprintf(`Read the following transcript based on the audio profile and director's note.

# Audio Profile
%s
# Director's note
%s
## Scene:
%s

## Sample Context:
%s

## Transcript:
%s`, strings.TrimSpace(profile.String()), strings.TrimSpace(note.String()), strings.TrimSpace(scene), strings.TrimSpace(context), strings.TrimSpace(transcript)))
}

func planTrailerDialogue(ctx context.Context, req dramatizeRequest, shots []DramatizeShot) []DramatizeShot {
	for i := range shots {
		if strings.TrimSpace(shots[i].DialogueTranscript) == "" {
			shots[i].DialogueTranscript = seedTrailerTranscript(shots[i].VisualDescription+" "+shots[i].MotionPrompt, shots[i].Characters)
		}
	}
	type speakerSpec struct {
		Speaker string `json:"speaker"`
		Name    string `json:"name"`
		Voice   string `json:"voice"`
		Profile string `json:"profile"`
		Style   string `json:"style"`
		Pace    string `json:"pace"`
		Accent  string `json:"accent"`
	}
	type shotSpec struct {
		ShotID     string        `json:"shot_id"`
		Transcript string        `json:"transcript"`
		Scene      string        `json:"scene"`
		Context    string        `json:"context"`
		Speakers   []speakerSpec `json:"speakers"`
	}
	speakerSchema := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": map[string]interface{}{
		"speaker": map[string]string{"type": "string"}, "name": map[string]string{"type": "string"}, "voice": map[string]string{"type": "string"},
		"profile": map[string]string{"type": "string"}, "style": map[string]string{"type": "string"}, "pace": map[string]string{"type": "string"}, "accent": map[string]string{"type": "string"},
	}, "required": []string{"speaker", "name", "voice", "profile", "style", "pace", "accent"}}
	shotSchema := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": map[string]interface{}{
		"shot_id": map[string]string{"type": "string"}, "transcript": map[string]string{"type": "string"}, "scene": map[string]string{"type": "string"},
		"context": map[string]string{"type": "string"}, "speakers": map[string]interface{}{"type": "array", "items": speakerSchema},
	}, "required": []string{"shot_id", "transcript", "scene", "context", "speakers"}}
	schema := map[string]interface{}{"type": "object", "additionalProperties": false, "properties": map[string]interface{}{
		"shots": map[string]interface{}{"type": "array", "items": shotSchema},
	}, "required": []string{"shots"}}
	payload, _ := json.Marshal(map[string]interface{}{"brief": req.Prompt, "character_bible": req.CharacterBible, "shots": shots})
	content := []map[string]interface{}{{"type": "input_text", "text": `Write Gemini TTS transcripts for this cinematic trailer. In-world spoken dialogue only, no narrator.
Each shot is 5–15 seconds; the spoken lines MUST fit that duration (a 5s shot is one or two short sentences).
Use Speaker 1: / Speaker 2: labels. Insert emotional performance markers in square brackets such as [shouting][angry] [whispers] [caution] [determination] [pensive] [suspicion] [urgency].
Silent establishing shots get an empty transcript. At most two speakers per shot. Keep the user's existing dialogue wording when it is already good.`}, {"type": "input_text", "text": string(payload)}}
	blob, err := callRemakeOpenAIJSON(ctx, remakeLunaModel, "You are a trailer dialogue director for Gemini TTS. Preserve the user's lines. Add performance tags. Never invent a narrator.", content, "trailer_dialogue", schema)
	if err != nil {
		return shots
	}
	var reply struct {
		Shots []shotSpec `json:"shots"`
	}
	if json.Unmarshal(blob, &reply) != nil {
		return shots
	}
	byID := map[string]shotSpec{}
	for _, item := range reply.Shots {
		byID[strings.TrimSpace(item.ShotID)] = item
	}
	for i := range shots {
		item, ok := byID[shots[i].ID]
		if !ok {
			continue
		}
		if strings.TrimSpace(item.Transcript) != "" {
			shots[i].DialogueTranscript = strings.TrimSpace(item.Transcript)
		}
		if strings.TrimSpace(item.Scene) != "" && shots[i].Environment == "" {
			shots[i].Environment = item.Scene
		}
		if strings.TrimSpace(item.Context) != "" && shots[i].DirectorNote == "" {
			shots[i].DirectorNote = item.Context
		}
	}
	return shots
}

func probeAudioSeconds(ctx context.Context, path string) (float64, error) {
	cmd := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path)
	blob, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ffprobe audio: %w", err)
	}
	var n float64
	fmt.Sscanf(strings.TrimSpace(string(blob)), "%f", &n)
	if n <= 0 {
		return 0, fmt.Errorf("audio has no duration")
	}
	return n, nil
}

func trailerSpeechFilter(idx int, speechDur, target float64) string {
	in := fmt.Sprintf("[%d:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo", idx)
	if speechDur > target*1.12 {
		return in + fmt.Sprintf(",atrim=0:%.3f,asetpts=PTS-STARTPTS,apad=pad_dur=%.3f,atrim=0:%.3f,asetpts=PTS-STARTPTS[s]", target, target, target)
	}
	if speechDur > target*1.01 {
		tempo := speechDur / target
		if tempo > 2 {
			tempo = 2
		}
		return in + fmt.Sprintf(",atempo=%.4f,apad=pad_dur=%.3f,atrim=0:%.3f,asetpts=PTS-STARTPTS[s]", tempo, target, target)
	}
	return in + fmt.Sprintf(",apad=pad_dur=%.3f,atrim=0:%.3f,asetpts=PTS-STARTPTS[s]", target, target)
}

func mixTrailerDriveAudio(ctx context.Context, speechPath, musicPath string, musicStart, seconds float64, dest string) error {
	seconds = float64(trailerSnapSeconds(seconds))
	dur := fmt.Sprintf("%.3f", seconds)
	args := []string{"-y", "-v", "error"}
	var filters []string
	speechIdx, musicIdx := -1, -1
	in := 0
	if strings.TrimSpace(speechPath) != "" {
		args = append(args, "-i", speechPath)
		speechDur, _ := probeAudioSeconds(ctx, speechPath)
		filters = append(filters, trailerSpeechFilter(in, speechDur, seconds))
		speechIdx = in
		in++
	}
	if strings.TrimSpace(musicPath) != "" {
		args = append(args, "-i", musicPath)
		filters = append(filters, fmt.Sprintf("[%d:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,atrim=%.3f:%.3f,asetpts=PTS-STARTPTS,volume=%.2f,apad=pad_dur=%s,atrim=0:%s,asetpts=PTS-STARTPTS[m]",
			in, musicStart, musicStart+seconds, trailerMusicBedVol, dur, dur))
		musicIdx = in
		in++
	}
	if speechIdx < 0 && musicIdx < 0 {
		args = append(args, "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", dur, "-ar", "44100", "-ac", "2", dest)
		return runTrailerFFmpeg(ctx, args)
	}
	mapLabel := "[s]"
	if speechIdx >= 0 && musicIdx >= 0 {
		filters = append(filters, fmt.Sprintf("[s][m]amix=inputs=2:duration=first:dropout_transition=0,atrim=0:%s,asetpts=PTS-STARTPTS[a]", dur))
		mapLabel = "[a]"
	} else if musicIdx >= 0 {
		mapLabel = "[m]"
	}
	args = append(args, "-filter_complex", strings.Join(filters, ";"), "-map", mapLabel, "-t", dur, "-ar", "44100", "-ac", "2", dest)
	return runTrailerFFmpeg(ctx, args)
}

func runTrailerFFmpeg(ctx context.Context, args []string) error {
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	if combined, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("mix drive audio: %w: %s", err, tailOutput(combined))
	}
	return nil
}

func persistTrailerAudioBytes(userID, preferredName string, audio []byte, contentType string) (string, error) {
	if len(audio) == 0 || len(audio) > studioGeneratedAudioMaxBytes {
		return "", fmt.Errorf("trailer audio is empty or too large")
	}
	contentType, extension, err := studioGeneratedAudioFormat(contentType, preferredName)
	if err != nil {
		contentType, extension = "audio/wav", ".wav"
	}
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	filename := sanitizeUploadName(strings.TrimSuffix(preferredName, filepath.Ext(preferredName)))
	filename = strings.Trim(filename, "-_.")
	if filename == "" {
		filename = "trailer-drive"
	}
	objectKey := fmt.Sprintf("%s/%s/audio/%s-%s%s", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), filename, extension)
	uploadURL, err := presignR2PutObject(objectKey, contentType, 900)
	if err != nil {
		return "", err
	}
	put, err := http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(audio))
	if err != nil {
		return "", err
	}
	put.ContentLength = int64(len(audio))
	put.Header.Set("Content-Type", contentType)
	upload, err := studioHTTPClient.Do(put)
	if err != nil {
		return "", err
	}
	defer upload.Body.Close()
	if upload.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("audio storage returned %d", upload.StatusCode)
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func writeTrailerSpeech(ctx context.Context, shot DramatizeShot, destPrefix string) (path string, usd float64, err error) {
	seconds := trailerSnapSeconds(shot.Seconds)
	transcript, voices, profiles := trailerCastFromShot(shot)
	if strings.TrimSpace(transcript) == "" {
		return "", 0, nil
	}
	prompt := trailerDirectorPrompt(shot, transcript, profiles, seconds)
	req := ServiceUsageRequest{Service: "openpaths_tts", Input: prompt, Language: "en-US", Temperature: 1}
	if len(voices) == 1 {
		req.Voice = voices[0].Voice
	} else if len(voices) > 1 {
		req.Voice = voices[0].Voice
		req.SpeakerVoices = voices
	}
	blob, err := proxyOpenPathsGeminiTTS(req)
	if err != nil {
		return "", 0, err
	}
	usd = trailerSpeechUSD(blob, prompt)
	var payload struct {
		AudioBase64 string `json:"audio_base64"`
		AudioURL    string `json:"audio_url"`
		Format      string `json:"format"`
	}
	if err := json.Unmarshal(blob, &payload); err != nil {
		return "", usd, err
	}
	if strings.TrimSpace(payload.AudioURL) != "" {
		ext := strings.ToLower(filepath.Ext(payload.AudioURL))
		if ext == "" {
			ext = ".wav"
		}
		path = destPrefix + ext
		return path, usd, downloadToFile(ctx, payload.AudioURL, path)
	}
	raw, err := base64.StdEncoding.DecodeString(payload.AudioBase64)
	if err != nil || len(raw) == 0 {
		return "", usd, fmt.Errorf("trailer speech returned no audio")
	}
	format := strings.ToLower(strings.TrimSpace(payload.Format))
	if format == "" {
		format = "wav"
	}
	path = destPrefix + "." + format
	return path, usd, os.WriteFile(path, raw, 0o644)
}

func prepareTrailerDriveAudio(ctx context.Context, user *User, results []dramatizeShotResult, musicPath, workDir string) ([]dramatizeShotResult, float64, error) {
	driveDir := filepath.Join(workDir, "drive")
	if err := os.MkdirAll(driveDir, 0o755); err != nil {
		return results, 0, err
	}
	userID := ""
	if user != nil {
		userID = user.ID
	}
	var cursor float64
	var speechUSD float64
	for i := range results {
		select {
		case <-ctx.Done():
			return results, speechUSD, ctx.Err()
		default:
		}
		seconds := float64(trailerSnapSeconds(results[i].Shot.Seconds))
		results[i].Shot.Seconds = seconds
		speechPath := ""
		if strings.TrimSpace(results[i].Shot.DialogueTranscript) != "" {
			path, usd, err := writeTrailerSpeech(ctx, results[i].Shot, filepath.Join(driveDir, fmt.Sprintf("speech_%03d", i)))
			if err == nil {
				speechPath = path
				speechUSD += usd
			}
		}
		mixPath := filepath.Join(driveDir, fmt.Sprintf("drive_%03d.wav", i))
		if err := mixTrailerDriveAudio(ctx, speechPath, musicPath, cursor, seconds, mixPath); err != nil {
			cursor += seconds
			continue
		}
		blob, err := os.ReadFile(mixPath)
		if err != nil {
			cursor += seconds
			continue
		}
		url, err := persistTrailerAudioBytes(userID, fmt.Sprintf("trailer-drive-%03d.wav", i+1), blob, "audio/wav")
		if err == nil {
			results[i].DriveAudioURL = url
		}
		cursor += seconds
	}
	return results, speechUSD, nil
}

func trailerShotsHaveDriveAudio(results []dramatizeShotResult) bool {
	for _, shot := range results {
		if strings.TrimSpace(shot.DriveAudioURL) != "" {
			return true
		}
	}
	return false
}
