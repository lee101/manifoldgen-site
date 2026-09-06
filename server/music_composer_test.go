package main

import (
	"strings"
	"testing"
)

func TestMusicComposerFieldTextAcceptsProviderShapeVariants(t *testing.T) {
	value := map[string]interface{}{
		"basic_attributes": "bpm is 112. key is F#, and scale is minor.",
		"genre":            []interface{}{"synth-pop", "new wave"},
	}
	text := musicComposerFieldText(value)
	for _, want := range []string{"basic attributes:", "bpm is 112", "synth-pop", "new wave"} {
		if !strings.Contains(text, want) {
			t.Fatalf("field text %q does not contain %q", text, want)
		}
	}
}

func TestMusicComposerPromptRequiresStringFields(t *testing.T) {
	if !strings.Contains(musicComposerSystem, "Every value MUST be a JSON string") {
		t.Fatal("composer contract must prevent nested provider responses")
	}
}

func TestMusic3BalancedCaptionUsesStableProfile(t *testing.T) {
	caption := music3BalancedCaption("global", "vocals")
	if !strings.Contains(caption, "global\nvocals\nMix Continuity:") {
		t.Fatalf("unexpected balanced caption: %q", caption)
	}
	if strings.Contains(caption, "arrangement") {
		t.Fatal("balanced default must not add the unstable lifecycle field")
	}
}
