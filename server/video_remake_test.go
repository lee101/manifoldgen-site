package main

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
	"testing"
)

func TestNormalizeRemakeRequestDefaultsModelsAndBounds(t *testing.T) {
	req := dramatizeRequest{Mode: "remake", Prompt: "  photoreal fantasy  ", VideoURL: "https://cdn.example/trailer.mp4", MaxShots: 999, Seconds: 102.274}
	if err := normalizeRemakeRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.Prompt != "photoreal fantasy" || req.MaxShots != remakeHardMaxShots {
		t.Fatalf("normalized request = %+v", req)
	}
	if req.ImageModel != "gpt-image-2" || req.VisionModel != remakeLunaModel || req.VideoModel != "minimax/h3-max/image-to-video" {
		t.Fatalf("model defaults = %+v", req)
	}
}

func TestNormalizeRemakeRequestDefaultsConsistencyPasses(t *testing.T) {
	req := dramatizeRequest{Prompt: "AAA remake", VideoURL: "https://cdn.example/trailer.mp4", ConsistentCharacters: true}
	if err := normalizeRemakeRequest(&req); err != nil {
		t.Fatal(err)
	}
	if req.ConsistencyPasses != remakeDefaultConsistencyPasses {
		t.Fatalf("passes = %d", req.ConsistencyPasses)
	}
}

func TestRemakeEstimateItemizesDetectedShots(t *testing.T) {
	req := dramatizeRequest{
		Prompt: "AAA remake", VideoURL: "https://cdn.example/source.mp4", MaxShots: 60,
		ImageModel: "gpt-image-2", VideoModel: "minimax/h3-max/image-to-video",
		SettingPrompt: "medieval fantasy", CharacterBible: "Hero — blond thief\nPrincess — dark hair\nMage — pointed hat",
		ConsistentCharacters: true, ConsistencyPasses: 2,
	}
	if err := normalizeRemakeRequest(&req); err != nil {
		t.Fatal(err)
	}
	estimate := remakeEstimateForBoundaries(req, []float64{0, 1.2, 4.9, 11.1})
	if !estimate.Exact || estimate.ShotCount != 3 || estimate.BaseImages != 3 {
		t.Fatalf("unexpected shot estimate: %+v", estimate)
	}
	if estimate.ReferenceImages != 4 || estimate.RepairImages != 6 || estimate.TotalImages != 13 {
		t.Fatalf("unexpected image estimate: %+v", estimate)
	}
	// H3 bills each detected window at its whole-second five-second minimum.
	if estimate.MotionClips != 3 || estimate.MotionSeconds != 17 {
		t.Fatalf("unexpected motion estimate: %+v", estimate)
	}
	if estimate.EstimatedCostUSD <= estimate.ImageUSD+estimate.ReferenceUSD || estimate.EstimatedCredits <= 0 {
		t.Fatalf("estimate omitted paid stages: %+v", estimate)
	}
}

func TestRemakeEstimateCapsCharacterSheets(t *testing.T) {
	lines := make([]string, 12)
	for i := range lines {
		lines[i] = fmt.Sprintf("character %d", i)
	}
	req := dramatizeRequest{ImageModel: "gpt-image-2", VideoModel: "minimax/h3-max/image-to-video", CharacterBible: strings.Join(lines, "\n"), ConsistentCharacters: true, ConsistencyPasses: 3}
	estimate := remakeEstimateForDurations(req, []float64{1, 1}, true)
	if estimate.ReferenceImages != remakeMaxCharacterSheets || estimate.RepairImages != remakeMaxCharacterSheets*3 {
		t.Fatalf("character reserve exceeded cap: %+v", estimate)
	}
}

func TestRemakeStudioDocumentKeepsSourceCanvas(t *testing.T) {
	timeline := []dramatizeShotResult{{
		Shot: DramatizeShot{ID: "shot_001"}, AssetID: "asset-1", AssetURL: "https://cdn/shot.mp4",
		ObjectKey: "projects/p/shot.mp4", Duration: 2.5,
	}}
	blob, err := buildStudioDocumentForCanvas(timeline, 1920, 1080)
	if err != nil {
		t.Fatal(err)
	}
	var document struct {
		Assets []struct {
			Width  int `json:"width"`
			Height int `json:"height"`
		} `json:"assets"`
	}
	if err := json.Unmarshal(blob, &document); err != nil {
		t.Fatal(err)
	}
	if len(document.Assets) != 1 || document.Assets[0].Width != 1920 || document.Assets[0].Height != 1080 {
		t.Fatalf("studio assets = %+v", document.Assets)
	}
}

func TestParseAndCoalesceRemakeBoundaries(t *testing.T) {
	raw := strings.Join([]string{
		"frame:0 pts:30 pts_time:1.000000", "lavfi.scene_score=0.200000",
		"frame:1 pts:36 pts_time:1.200000", "lavfi.scene_score=0.900000",
		"frame:2 pts:90 pts_time:3.000000", "lavfi.scene_score=0.500000",
		"frame:3 pts:120 pts_time:4.000000", "lavfi.scene_score=0.400000",
	}, "\n")
	candidates := parseRemakeCandidates(raw)
	if len(candidates) != 4 || candidates[1].Time != 1.2 || candidates[1].Score != 0.9 {
		t.Fatalf("parsed candidates = %#v", candidates)
	}
	boundaries := coalesceRemakeBoundaries(candidates, 5, 0.7, 4)
	want := []float64{0, 1.2, 3, 4, 5}
	if len(boundaries) != len(want) {
		t.Fatalf("boundaries = %#v", boundaries)
	}
	for i := range want {
		if math.Abs(boundaries[i]-want[i]) > 1e-9 {
			t.Fatalf("boundaries[%d] = %v, want %v", i, boundaries[i], want[i])
		}
	}
}

func TestRemakePricingUsesBillableRoundedDurations(t *testing.T) {
	short := DramatizeShot{Seconds: 0.8, ImageModel: "nano-banana-2", VideoModel: "minimax/h3-max/image-to-video"}
	two := short
	two.Seconds = 2
	if remakeShotUSD(short) != remakeShotUSD(two) {
		t.Fatalf("short shots must price the provider's five-second minimum: %v vs %v", remakeShotUSD(short), remakeShotUSD(two))
	}
	long := short
	long.Seconds = 5.1
	if remakeShotUSD(long) <= remakeShotUSD(two) {
		t.Fatal("fractional provider duration must round up before pricing")
	}
	failed := dramatizeShotResult{Shot: short, ImageURL: "https://cdn/image.png", Error: "motion failed"}
	ok := dramatizeShotResult{Shot: short, ClipURL: "https://cdn/video.mp4", Regenerations: 2}
	references := []RemakeReferenceAsset{{ID: "world", ImageURL: "https://cdn/world.png"}, {ID: "failed", Error: "nope"}}
	if got := remakeRenderedUSD([]dramatizeShotResult{failed, ok}, references); math.Abs(got-(remakeShotUSD(ok.Shot)+2*allowedImageModels["nano-banana-2"].usd+2*remakeAgentUSDPerShot+allowedImageModels["gpt-image-2"].usd)) > 1e-9 {
		t.Fatalf("rendered price = %v", got)
	}
}

func TestRecurringCharactersAndPerShotReferences(t *testing.T) {
	shots := []DramatizeShot{
		{ID: "s1", Characters: []string{"Princess Garnet", "Vivi"}},
		{ID: "s2", Characters: []string{"Princess Garnet"}},
		{ID: "s3", Characters: []string{"Vivi"}},
		{ID: "s4", Characters: []string{"One-off"}},
	}
	characters := recurringRemakeCharacters(shots)
	if len(characters) != 2 || characters[0].ID != "princess-garnet" || characters[1].ID != "vivi" {
		t.Fatalf("recurring characters = %#v", characters)
	}
	references := []RemakeReferenceAsset{
		{ID: "world", Kind: "setting", ImageURL: "https://cdn/world.png"},
		{ID: "princess-garnet", Kind: "character", ImageURL: "https://cdn/garnet.png"},
		{ID: "vivi", Kind: "character", ImageURL: "https://cdn/vivi.png"},
	}
	got := remakeShotReferenceURLs(shots[1], references)
	if len(got) != 2 || got[0] != references[1].ImageURL || got[1] != references[0].ImageURL {
		t.Fatalf("shot references = %#v", got)
	}
}

func TestRemakeVisionInstructionCarriesWorldAndAnatomyRules(t *testing.T) {
	req := dramatizeRequest{Prompt: "photographic fantasy", SettingPrompt: "medieval cobbles", CharacterBible: "Eiko has a real horn"}
	got := remakeVisionInstruction(req, []DramatizeShot{{ID: "s1", SourceEnd: 1}})
	for _, want := range []string{"medieval cobbles", "Eiko has a real horn", "visible_traits", "never transfer anatomy"} {
		if !strings.Contains(got, want) {
			t.Fatalf("instruction missing %q: %s", want, got)
		}
	}
}

func TestCharacterBibleDescriptionScopesAnatomyToOneIdentity(t *testing.T) {
	bible := "Steiner — armored knight, no horn\nEiko — child with one real horn"
	if got := characterBibleDescription(bible, "eiko"); got != "Eiko — child with one real horn" {
		t.Fatalf("Eiko entry = %q", got)
	}
	if got := characterBibleDescription(bible, "vivi"); got != "" {
		t.Fatalf("unexpected Vivi entry = %q", got)
	}
	if characterHasHorn("armored knight, no horn") || !characterHasHorn("one real anatomical horn") {
		t.Fatal("horn presence rules did not respect an explicit negative")
	}
}

func TestBuildRemakeShotsCoversTimelineWithoutGaps(t *testing.T) {
	shots := buildRemakeShots([]float64{0, 1.2, 3.4, 5}, dramatizeRequest{Prompt: "goal", ImageModel: "gpt-image-2", VideoModel: "minimax/h3-max/image-to-video"}, dramatizeProbe{Width: 1920, Height: 1080})
	if len(shots) != 3 || shots[0].SourceStart != 0 || shots[2].SourceEnd != 5 {
		t.Fatalf("shots = %#v", shots)
	}
	for i := 1; i < len(shots); i++ {
		if shots[i-1].SourceEnd != shots[i].SourceStart {
			t.Fatalf("gap between %d and %d", i-1, i)
		}
	}
}
