package main

import "testing"

func TestChildPromptGate(t *testing.T) {
	for _, prompt := range []string{"2yo portrait", "a child playing", "baby dragon", "17 years old fashion shoot", "underage character"} {
		if !isChildPrompt(prompt) {
			t.Fatalf("expected child gate for %q", prompt)
		}
	}
	for _, prompt := range []string{"25 year old adult portrait", "cinematic harbor at night", "kidskin moisturizer product"} {
		if isChildPrompt(prompt) {
			t.Fatalf("unexpected child gate for %q", prompt)
		}
	}
}
