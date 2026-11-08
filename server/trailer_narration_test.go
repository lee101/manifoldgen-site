package main

import (
	"context"
	"encoding/json"
	"math"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

const vampireNarration = `# Narrator VO
| shot | line | delivery |
|---|---|---|
| 1 | They crossed the world for land. | measured, almost reverent |
| 2 | One of them came for blood. | lower |
| 12 | And the dead came home. | whisper on "home" |
| end card | Vampire Wellington. | close whisper |`

func TestParseTrailerNarrationScriptTable(t *testing.T) {
	lines := parseTrailerNarrationScript(vampireNarration)
	if len(lines) != 4 {
		t.Fatalf("lines = %+v", lines)
	}
	if lines[0] != (trailerNarrationLine{ShotID: "shot_001", Text: "They crossed the world for land.", Delivery: "measured, almost reverent"}) {
		t.Fatalf("first = %+v", lines[0])
	}
	if lines[2].ShotID != "shot_012" || lines[3].ShotID != trailerTitleShotID || lines[3].Text != "Vampire Wellington." {
		t.Fatalf("lines = %+v", lines)
	}
}

func TestParseTrailerNarrationScriptLines(t *testing.T) {
	lines := parseTrailerNarrationScript("1: They crossed the world. (slow)\nSHOT 3 VO: \"Silver from their altar.\"\nnot a cue\nTitle card - Vampire Wellington.")
	if len(lines) != 3 || lines[0].Delivery != "slow" || lines[0].Text != "They crossed the world." {
		t.Fatalf("lines = %+v", lines)
	}
	if lines[1].ShotID != "shot_003" || lines[1].Text != "Silver from their altar." || lines[2].ShotID != trailerTitleShotID {
		t.Fatalf("lines = %+v", lines)
	}
}

func TestNormalizeTrailerNarrationMergesScriptAndShotsJSON(t *testing.T) {
	var cues []trailerNarrationCue
	shotsJSON := `[{"id":1,"mv":1,"chars":[],"lines":[],"vo":"They crossed the world for land, again."},{"id":3,"lines":[["VARNE","x","y"]],"vo":""},{"id":"end card","vo":"Vampire Wellington."}]`
	if err := json.Unmarshal([]byte(shotsJSON), &cues); err != nil {
		t.Fatal(err)
	}
	req := dramatizeRequest{Prompt: "brief", NarrationScript: vampireNarration, Narration: cues, NarratorVoice: " Callum "}
	if err := normalizeTrailerRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.NarrationScript != "" || req.NarratorVoice != "Callum" || len(req.Narration) != 4 {
		t.Fatalf("normalized = %+v", req.Narration)
	}
	if req.Narration[0].Shot != "shot_001" || req.Narration[0].Text != "They crossed the world for land, again." {
		t.Fatalf("JSON cue must override the script: %+v", req.Narration[0])
	}
	if err := normalizeTrailerRequest(&req); err != nil || len(req.Narration) != 4 {
		t.Fatalf("renormalize = %v %+v", err, req.Narration)
	}
	if trailerPlannerNarrates(dramatizeRequest{Narrator: true, Narration: req.Narration}) || !trailerPlannerNarrates(dramatizeRequest{Narrator: true}) {
		t.Fatal("planner narrates only when asked and unscripted")
	}
}

func TestTrailerBriefVOStaysOffCamera(t *testing.T) {
	prompt := "SHOT 1 — 6 seconds. Harbour at first light, gulls lift. VO: \"They crossed the world for land.\"\nSHOT 2 — Varne on the wharf. Varne: \"Such a young country.\""
	shots := parseTrailerShotList(prompt, 5, 8)
	if len(shots) != 2 || strings.Contains(shots[0].VisualDescription, "crossed") || shots[0].DialogueTranscript != "" {
		t.Fatalf("shot 1 = %+v", shots[0])
	}
	if !strings.Contains(shots[1].DialogueTranscript, "Such a young country") {
		t.Fatalf("shot 2 dialogue = %q", shots[1].DialogueTranscript)
	}
	vo := trailerNarrationFromBrief(prompt, 8)
	if len(vo) != 1 || vo[0].ShotID != "shot_001" || vo[0].Text != "They crossed the world for land." {
		t.Fatalf("vo = %+v", vo)
	}
	if got := seedTrailerTranscript("Narrator: they came for blood", nil); got != "" {
		t.Fatalf("narrator seeded as on-camera speech: %q", got)
	}
}

func TestTrailerMergeNarrationPriorities(t *testing.T) {
	shots := []DramatizeShot{{ID: "shot_001"}, {ID: "shot_002", DialogueTranscript: "Speaker 1: hi"}, {ID: "shot_003"}}
	planned := []trailerNarrationLine{{ShotID: "shot_001", Text: "planned one"}, {ShotID: "shot_002", Text: "over dialogue"}, {ShotID: "shot_003", Text: "planned three"}}
	brief := []trailerNarrationLine{{ShotID: "shot_003", Text: "brief three"}}
	scripted := []trailerNarrationCue{{Shot: "title", Text: "The End."}, {Shot: "shot_001", Text: "scripted one"}, {Shot: "shot_009", Text: "gone"}}
	got := trailerMergeNarration(scripted, brief, planned, shots)
	want := []string{"shot_001:scripted one", "shot_003:brief three", "title:The End."}
	if len(got) != len(want) {
		t.Fatalf("got = %+v", got)
	}
	for i, line := range got {
		if line.ShotID+":"+line.Text != want[i] {
			t.Fatalf("got[%d] = %+v", i, line)
		}
	}
	scriptedDialogue := trailerMergeNarration([]trailerNarrationCue{{Shot: "shot_002", Text: "user wants it"}}, nil, nil, shots)
	if len(scriptedDialogue) != 1 {
		t.Fatal("scripted narration may sit over dialogue")
	}
}

func TestTrailerPlaceNarration(t *testing.T) {
	timeline := []dramatizeShotResult{
		{Shot: DramatizeShot{ID: "shot_001"}, Start: 0, Duration: 6},
		{Shot: DramatizeShot{ID: "shot_002"}, Start: 6, Duration: 5},
		{Shot: DramatizeShot{ID: "title"}, Start: 11, Duration: 3},
	}
	lines := []trailerNarrationLine{
		{ShotID: "shot_001", Duration: 6.5},
		{ShotID: "shot_002", Duration: 2},
		{ShotID: "shot_004", Duration: 1},
		{ShotID: "title", Duration: 0},
	}
	placed := trailerPlaceNarration(lines, timeline, 14)
	if len(placed) != 2 || placed[0].Start != trailerNarrationLead {
		t.Fatalf("placed = %+v", placed)
	}
	if want := trailerNarrationLead + 6.5 + trailerNarrationGap; placed[1].Start != want {
		t.Fatalf("overlap not pushed: %v want %v", placed[1].Start, want)
	}
	w := trailerNarrationWindows(placed)
	if w[1].End != placed[1].Start+2 {
		t.Fatalf("windows = %+v", w)
	}
	if late := trailerPlaceNarration([]trailerNarrationLine{{ShotID: "title", Duration: 1}}, timeline, 11.2); len(late) != 0 {
		t.Fatalf("line past the end kept: %+v", late)
	}
}

func TestTrailerNarratorEnginesAndTags(t *testing.T) {
	want := []trailerNarratorEngine{{"gemini", "Enceladus"}, {"eleven-v3", trailerNarratorElevenVoice}}
	if e := trailerNarratorEngines(""); len(e) != 2 || e[0] != want[0] || e[1] != want[1] {
		t.Fatalf("default = %+v", e)
	}
	if e := trailerNarratorEngines("Algenib"); len(e) != 3 || e[0] != (trailerNarratorEngine{"gemini", "Algenib"}) || e[1] != want[0] {
		t.Fatalf("gemini voice = %+v", e)
	}
	if e := trailerNarratorEngines("Callum"); e[0] != (trailerNarratorEngine{"eleven-v3", "Callum"}) || e[1] != want[0] {
		t.Fatalf("eleven voice = %+v", e)
	}
	if got := trailerNarratorTagged("And the dead came home.", "whisper on home"); got != "[slowly, whisper on home] And the dead came home." {
		t.Fatalf("tagged = %q", got)
	}
	if got := trailerNarratorTagged("[whispers] home.", "loud"); got != "[whispers] home." {
		t.Fatalf("pre-tagged = %q", got)
	}
	if !strings.Contains(trailerNarratorProfile("Gacrux"), "woman") || !strings.Contains(trailerNarratorProfile("Enceladus"), "baritone") {
		t.Fatal("profiles")
	}
}

func TestTrailerNarratorPromptShapeAndBudget(t *testing.T) {
	lo, hi := trailerNarrationBudget(6)
	if lo != 4 || hi != 5.2 {
		t.Fatalf("budget(6) = %v %v", lo, hi)
	}
	if lo, hi := trailerNarrationBudget(3); lo != 1 || math.Abs(hi-2.2) > 1e-9 {
		t.Fatalf("budget(3) = %v %v", lo, hi)
	}
	if lo, hi := trailerNarrationBudget(1); lo != 0.8 || math.Abs(hi-1.4) > 1e-9 {
		t.Fatalf("budget(1) = %v %v", lo, hi)
	}
	p := trailerNarratorPrompt(trailerNarrationLine{Text: "Vampire Wellington.", Delivery: "close whisper"}, "Enceladus", 4, 5.2)
	if !strings.HasPrefix(p, "Read the following transcript based on the audio profile and director's note.") || !strings.HasSuffix(p, "## Transcript:\nVampire Wellington.") {
		t.Fatalf("prompt shape = %q", p)
	}
	for _, want := range []string{"about 4.0 to 5.2 seconds including pauses, no longer", "Style: close whisper"} {
		if !strings.Contains(p, want) {
			t.Fatalf("prompt missing %q", want)
		}
	}
}

func TestTrailerPickTakeAndLoudnorm(t *testing.T) {
	takes := []trailerVOTake{{Path: "a", Span: 5.6, LRA: 1}, {Path: "b", Span: 4.6, LRA: 6}, {Path: "c", Span: 4.4, LRA: 2}, {Span: 4.5}}
	if got := trailerPickTake(takes, 4, 5.2); got != 2 {
		t.Fatalf("pick = %d", got)
	}
	if got := trailerPickTake([]trailerVOTake{{Path: "a", Span: 7}, {Path: "b", Span: 6}}, 4, 5.2); got != 1 {
		t.Fatalf("closest miss = %d", got)
	}
	if trailerPickTake(nil, 1, 2) != -1 {
		t.Fatal("no takes")
	}
	l, err := trailerParseLoudnorm("noise\n[Parsed_loudnorm_0 @ 0x1]\n{\n\t\"input_i\" : \"-27.40\",\n\t\"input_tp\" : \"-9.10\",\n\t\"input_lra\" : \"3.20\",\n\t\"input_thresh\" : \"-37.80\",\n\t\"target_offset\" : \"0.30\"\n}\n")
	if err != nil || l.I != -27.4 || l.TP != -9.1 || l.LRA != 3.2 || l.Thresh != -37.8 || l.Offset != 0.3 {
		t.Fatalf("loudnorm = %+v %v", l, err)
	}
	if !strings.Contains(trailerVOTrimFilter(0.88), "atempo=1.136") || strings.Contains(trailerVOTrimFilter(1), "atempo") {
		t.Fatal("stretch")
	}
}

func TestPostTrailerVOTrimsAndNormalizes(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg")
	}
	dir := t.TempDir()
	raw, dest := filepath.Join(dir, "raw.wav"), filepath.Join(dir, "vo.wav")
	if out, err := exec.Command("ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=180:duration=2,volume=0.3,adelay=600|600,apad=pad_dur=0.7", raw).CombinedOutput(); err != nil {
		t.Fatalf("%v %s", err, out)
	}
	span, _, err := postTrailerVO(context.Background(), raw, dest, 1)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(span-2) > 0.1 {
		t.Fatalf("span = %v (padding not trimmed)", span)
	}
	out, _ := exec.Command("ffmpeg", "-hide_banner", "-nostats", "-i", dest, "-af", "loudnorm=print_format=json", "-f", "null", "-").CombinedOutput()
	if l, err := trailerParseLoudnorm(string(out)); err != nil || math.Abs(l.I+16) > 1.5 {
		t.Fatalf("loudness = %+v %v", l, err)
	}
}

func TestTrailerVOStemFilter(t *testing.T) {
	f := trailerVOStemFilter([]trailerNarrationLine{{Start: 0.4}, {Start: 7.25}}, 20)
	for _, want := range []string{"adelay=400|400[v0]", "adelay=7250|7250[v1]", "[z][v0][v1]amix=inputs=3", "d=20.000"} {
		if !strings.Contains(f, want) {
			t.Fatalf("missing %q in %s", want, f)
		}
	}
}

func TestTrailerMasterMixWithNarrationRuns(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg")
	}
	dir := t.TempDir()
	run := func(args ...string) {
		if out, err := exec.Command("ffmpeg", append([]string{"-y", "-v", "error"}, args...)...).CombinedOutput(); err != nil {
			t.Fatalf("%v: %s", err, out)
		}
	}
	picture, music, vo := filepath.Join(dir, "p.mp4"), filepath.Join(dir, "m.wav"), filepath.Join(dir, "vo.wav")
	run("-f", "lavfi", "-i", "testsrc=size=320x180:rate=24:duration=6", "-f", "lavfi", "-i", "sine=frequency=300:duration=6", "-c:v", "libx264", "-c:a", "aac", "-shortest", picture)
	run("-f", "lavfi", "-i", "sine=frequency=110:duration=8", music)
	run("-f", "lavfi", "-i", "sine=frequency=500:duration=1.5", vo)
	ctx := context.Background()
	lines := []trailerNarrationLine{{ShotID: "shot_001", Start: 0.4, Duration: 1.5, path: vo}, {ShotID: "shot_002", Start: 3, Duration: 1.5, path: vo}}
	stem := filepath.Join(dir, "stem.wav")
	if err := buildTrailerVOStem(ctx, lines, 6, stem); err != nil {
		t.Fatal(err)
	}
	if d, err := probeAudioSeconds(ctx, stem); err != nil || d < 5.9 || d > 6.1 {
		t.Fatalf("stem = %v %v", d, err)
	}
	windows := trailerNarrationWindows(lines)
	for _, c := range []struct{ music, vo string }{{music, stem}, {"", stem}, {music, ""}} {
		dest := filepath.Join(dir, "out.mp4")
		if err := mixTrailerMaster(ctx, picture, c.music, c.vo, dest, []trailerScoreWindow{{0, 6}}, windows); err != nil {
			t.Fatalf("music=%q vo=%q: %v", c.music, c.vo, err)
		}
	}
}
