package main

import (
	"strings"
	"testing"
)

func TestMusic3StructureLyricsAddsSectionsToPlainLyrics(t *testing.T) {
	plain := strings.Join([]string{
		"There is a house in New Orleans",
		"They call the Rising Sun",
		"And it's been the ruin of many a poor boy",
		"Dear God, I know I was one",
		"My mother was a tailor",
		"She sewed my new blue jeans",
		"And my father was a gamblin' man",
		"Way down in New Orleans",
	}, "\n")
	structured := music3StructureLyrics(plain)
	if !strings.HasPrefix(structured, "[Intro]\n(instrumental)\n[Verse]\n") {
		t.Fatalf("structure did not open with an intro and a verse:\n%s", structured)
	}
	if !strings.HasSuffix(structured, "[Outro]\n(instrumental)") {
		t.Fatalf("structure did not close with an outro:\n%s", structured)
	}
	for _, line := range strings.Split(plain, "\n") {
		if !strings.Contains(structured, line) {
			t.Fatalf("lyric line %q was lost", line)
		}
	}
	if strings.Count(structured, "[Verse]")+strings.Count(structured, "[Chorus]") < 2 {
		t.Fatalf("expected at least two sung sections:\n%s", structured)
	}
}

func TestMusic3StructureLyricsMarksRepeatedBlocksAsChorus(t *testing.T) {
	block := "Oh mother tell your children\nNot to do what I have done\nTo spend your lives in sin and misery\nIn the house of the rising sun"
	verse := "I got one foot on the platform\nAnd another on the train\nAnd I'm going back to New Orleans\nTo wear that ball and chain"
	structured := music3StructureLyrics(block + "\n" + verse + "\n" + block)
	if strings.Count(structured, "[Chorus]") != 2 {
		t.Fatalf("repeated block should be tagged as the chorus twice:\n%s", structured)
	}
}

func TestMusic3StructureLyricsRescuesTextBesideATag(t *testing.T) {
	structured := music3StructureLyrics("[Verse] Walking down the street\n[Chorus]\nWe keep on walking")
	if !strings.Contains(structured, "[Verse]\nWalking down the street") {
		t.Fatalf("text sharing the tag line was not moved to its own line:\n%s", structured)
	}
	if strings.Contains(structured, "[Intro]") {
		t.Fatal("lyrics that already carry structure should not be re-sectioned")
	}
}

func TestMusic3StructureLyricsKeepsInstrumentalsEmpty(t *testing.T) {
	if got := music3StructureLyrics("   \n\n"); got != "" {
		t.Fatalf("blank lyrics should stay empty, got %q", got)
	}
}

func TestMusicDurationAcceptsFiveMinutes(t *testing.T) {
	if _, duration, err := normalizeMusicGenerationInput("a long cinematic techno set", 300); err != nil || duration != 300 {
		t.Fatalf("300 second track rejected: duration=%d err=%v", duration, err)
	}
	if _, _, err := normalizeMusicGenerationInput("a long cinematic techno set", 301); err == nil {
		t.Fatal("durations past the model's limit should be rejected")
	}
}
