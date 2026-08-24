package main

import (
	"strings"
	"testing"
)

// The literal brief the tool ships as its default, used to check the planner
// handles a long, messy, multi-scene creator prompt.
const robotBrief = `Let us make a video dramatizing this robot experience. So the first one we should make a team of Asian anime characters building out a running robot with a square head and training it and testing it. Second should be it actually running on a Olympic track and then the third should be it, its point of view running down the track with lots of interesting sensors and stuff going really fast. So, make a few videos for this and then stitch together back the some of the original cuts of the video that will mean to make it portrait, so high social media style, TikTok style video. end the video on generated final 5s of real video but should be a part another one where the people sare shocked anime characters as the robot hits a wall fast then explodes inside and its also a new scene where point of view as the robot is feeling it and explodes sparks in the middle waist.`

func robotBrief_(t *testing.T) dramatizeBrief {
	t.Helper()
	return dramatizeBrief{
		Prompt: robotBrief,
		Probe:  dramatizeProbe{Width: 544, Height: 960, Duration: 11.53, FPS: 30, HasAudio: true},
		Audio: &AudioAnalysis{
			Duration:   11.53,
			Tempo:      46.14,
			BeatTimes:  []float64{0.7, 2.0, 3.3, 4.6, 5.9, 7.2, 8.5, 9.8},
			OnsetTimes: []float64{0.5, 1.9, 3.4, 5.1, 6.8, 8.2, 9.9, 11.0},
		},
		Frames: []dramatizeFrame{
			{Time: 1.0, Path: "/tmp/f0.jpg"},
			{Time: 5.5, Path: "/tmp/f1.jpg"},
			{Time: 10.0, Path: "/tmp/f2.jpg"},
		},
		MaxShots: dramatizeMaxShots,
	}
}

func TestDeterministicPlannerSegmentsTheRobotBrief(t *testing.T) {
	brief := robotBrief_(t)
	plan := planDeterministic(brief)
	if err := plan.normalize(brief); err != nil {
		t.Fatalf("normalize: %v", err)
	}

	generated, restyled, source := plan.CountByKind()
	if generated+restyled < 3 {
		t.Errorf("want at least 3 stylized shots, got generated=%d restyled=%d", generated, restyled)
	}
	if source == 0 {
		t.Error("plan never cuts back to the original footage")
	}
	if len(plan.Shots) < 4 {
		t.Errorf("plan too short: %d shots", len(plan.Shots))
	}

	// The brief's three numbered beats must survive into distinct prompts.
	joined := strings.ToLower(promptsOf(plan))
	for _, want := range []string{"anime", "track", "point of view"} {
		if !strings.Contains(joined, want) {
			t.Errorf("planned prompts lost %q; got:\n%s", want, promptsOf(plan))
		}
	}
	// Meta-instructions must not leak into image prompts.
	for _, shot := range plan.Shots {
		low := strings.ToLower(shot.ImagePrompt)
		for _, banned := range []string{"tiktok style video", "make a few videos"} {
			if strings.Contains(low, banned) {
				t.Errorf("shot %s leaked meta-instruction %q: %s", shot.ID, banned, shot.ImagePrompt)
			}
		}
	}
	t.Logf("plan %q (%d shots, %.1fs)", plan.Title, len(plan.Shots), plan.TotalSeconds())
	for _, s := range plan.Shots {
		t.Logf("  %-16s %5.1fs %s", s.Kind, s.Seconds, truncate(s.ImagePrompt, 70))
	}
}

func promptsOf(plan *DramatizePlan) string {
	var sb strings.Builder
	for _, s := range plan.Shots {
		if s.ImagePrompt != "" {
			sb.WriteString(s.ImagePrompt)
			sb.WriteString("\n")
		}
	}
	return sb.String()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

func TestPlannerAlternatesRestyledShotsWhenFramesExist(t *testing.T) {
	brief := robotBrief_(t)
	plan := planDeterministic(brief)
	if err := plan.normalize(brief); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	_, restyled, _ := plan.CountByKind()
	if restyled == 0 {
		t.Error("expected at least one restyled_source shot when frames are available")
	}
	for _, s := range plan.Shots {
		if s.Kind == dramatizeShotKindRestyled && (s.SourceFrameTime <= 0 || s.SourceFrameTime > brief.Probe.Duration) {
			t.Errorf("restyled shot %s has out-of-range frame time %.2f", s.ID, s.SourceFrameTime)
		}
	}
}

func TestPlannerFallsBackToPureGenerationWithoutFrames(t *testing.T) {
	brief := robotBrief_(t)
	brief.Frames = nil
	plan := planDeterministic(brief)
	if err := plan.normalize(brief); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	for _, s := range plan.Shots {
		if s.Kind == dramatizeShotKindRestyled {
			t.Errorf("shot %s stayed restyled with no frames available", s.ID)
		}
	}
}

func TestNormalizeClampsAndRejectsBadShots(t *testing.T) {
	brief := dramatizeBrief{
		Probe:    dramatizeProbe{Duration: 10},
		MaxShots: dramatizeMaxShots,
	}
	plan := &DramatizePlan{Shots: []DramatizeShot{
		{Kind: "generated", ImagePrompt: "a robot", Seconds: 900},  // clamped down
		{Kind: "generated", ImagePrompt: "a robot", Seconds: 0.01}, // clamped up
		{Kind: "generated", Seconds: 5},                            // dropped: no prompt
		{Kind: "nonsense", ImagePrompt: "x", Seconds: 5},           // dropped: bad kind
		{Kind: "source", SourceStart: 8, SourceEnd: 400},           // clamped to duration
		{Kind: "source", SourceStart: 5, SourceEnd: 5.1},           // dropped: too short
	}}
	if err := plan.normalize(brief); err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if len(plan.Shots) != 3 {
		t.Fatalf("kept %d shots, want 3: %+v", len(plan.Shots), plan.Shots)
	}
	if plan.Shots[0].Seconds != dramatizeMaxShotLength {
		t.Errorf("seconds not clamped down: %v", plan.Shots[0].Seconds)
	}
	if plan.Shots[1].Seconds != dramatizeMinShotLength {
		t.Errorf("seconds not clamped up: %v", plan.Shots[1].Seconds)
	}
	if plan.Shots[2].SourceEnd != 10 {
		t.Errorf("source window not clamped to duration: %v", plan.Shots[2])
	}
	if plan.Width != dramatizeCanvasWidth || plan.Height != dramatizeCanvasHeight {
		t.Errorf("canvas = %dx%d, want portrait", plan.Width, plan.Height)
	}
	// Orders must be contiguous after drops.
	for i, s := range plan.Shots {
		if s.Order != i {
			t.Errorf("shot %d has order %d", i, s.Order)
		}
		if s.ID == "" {
			t.Errorf("shot %d has no id", i)
		}
	}
}

func TestNormalizeRejectsAPlanWithNothingRunnable(t *testing.T) {
	plan := &DramatizePlan{Shots: []DramatizeShot{{Kind: "generated"}, {Kind: "bogus"}}}
	if err := plan.normalize(dramatizeBrief{MaxShots: 5}); err == nil {
		t.Error("expected an error for a plan with no runnable shots")
	}
}

func TestExtractJSONObjectHandlesFencesAndProse(t *testing.T) {
	cases := map[string]string{
		`{"a":1}`:                 `{"a":1}`,
		"```json\n{\"a\":1}\n```": `{"a":1}`,
		"Sure! Here you go:\n{\"a\":{\"b\":2}}\nHope that helps": `{"a":{"b":2}}`,
		`{"s":"a } brace in a string"}`:                          `{"s":"a } brace in a string"}`,
		`{"s":"escaped \" quote"}`:                               `{"s":"escaped \" quote"}`,
		`no json here`:                                           ``,
	}
	for input, want := range cases {
		if got := extractJSONObject(input); got != want {
			t.Errorf("extractJSONObject(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestParsePlanJSONRejectsEmptyShotLists(t *testing.T) {
	if _, err := parsePlanJSON(`{"title":"x","shots":[]}`); err == nil {
		t.Error("expected an error for an empty shot list")
	}
	if _, err := parsePlanJSON(`not json`); err == nil {
		t.Error("expected an error for non-JSON")
	}
	plan, err := parsePlanJSON("```json\n" + `{"title":"T","shots":[{"kind":"generated","image_prompt":"p","seconds":4}]}` + "\n```")
	if err != nil {
		t.Fatalf("parsePlanJSON: %v", err)
	}
	if plan.Title != "T" || len(plan.Shots) != 1 {
		t.Errorf("unexpected plan: %+v", plan)
	}
}

func TestBriefUserMessageIncludesMeasurements(t *testing.T) {
	msg := robotBrief_(t).userMessage()
	for _, want := range []string{"11.53s", "portrait", "46.1 BPM", "beat times", "Return JSON only"} {
		if !strings.Contains(msg, want) {
			t.Errorf("brief message missing %q:\n%s", want, msg)
		}
	}
}

func TestSplitBriefIntoScenesUsesOrdinalCues(t *testing.T) {
	scenes := splitBriefIntoScenes("First a wide desert shot with a lone figure. Second the figure starts running fast. Then the camera whips to the sky above.")
	if len(scenes) != 3 {
		t.Fatalf("got %d scenes, want 3: %q", len(scenes), scenes)
	}
	if !strings.Contains(strings.ToLower(scenes[0]), "desert") {
		t.Errorf("scene 0 = %q", scenes[0])
	}
	if !strings.Contains(strings.ToLower(scenes[2]), "sky") {
		t.Errorf("scene 2 = %q", scenes[2])
	}
}
