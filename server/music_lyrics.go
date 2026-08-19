package main

import (
	"strings"
)

// MiniMax-Music3 reads section tags as the song's structure, and it ends the
// song when it runs out of structure to sing. Unstructured lyrics therefore
// come back as a fragment — the same words wrapped in [Verse]/[Chorus] blocks
// render two to three times longer, in the arrangement the caption asks for.
// The model also drops any lyric text that shares a line with a tag, so the
// normalizer both adds missing structure and rescues text written beside a tag.

const (
	music3SectionLines   = 4
	music3MaxLyricsRunes = 8000
)

var music3SectionTags = []string{
	"[intro]", "[verse]", "[pre-chorus]", "[prechorus]", "[chorus]", "[hook]",
	"[bridge]", "[refrain]", "[outro]", "[break]", "[drop]", "[instrumental]",
	"[interlude]", "[solo]",
}

func music3TagPrefix(line string) (string, string, bool) {
	trimmed := strings.TrimSpace(line)
	lowered := strings.ToLower(trimmed)
	for _, tag := range music3SectionTags {
		if strings.HasPrefix(lowered, tag) {
			return trimmed[:len(tag)], strings.TrimSpace(trimmed[len(tag):]), true
		}
	}
	return "", "", false
}

func music3HasStructure(lyrics string) bool {
	for _, line := range strings.Split(lyrics, "\n") {
		if _, _, ok := music3TagPrefix(line); ok {
			return true
		}
	}
	return false
}

// music3NormalizeTaggedLyrics moves lyric text off a tag's line so the model
// keeps it instead of silently dropping it.
func music3NormalizeTaggedLyrics(lyrics string) string {
	var out []string
	for _, line := range strings.Split(lyrics, "\n") {
		tag, rest, ok := music3TagPrefix(line)
		if !ok {
			out = append(out, strings.TrimRight(line, " \t"))
			continue
		}
		out = append(out, tag)
		if rest != "" {
			out = append(out, rest)
		}
	}
	return strings.Join(out, "\n")
}

// music3StructureLyrics returns lyrics the model will sing in full: existing
// structure is preserved and repaired, and unstructured lyrics are divided into
// verses and choruses, with repeated blocks recognised as the chorus.
func music3StructureLyrics(lyrics string) string {
	trimmed := strings.TrimSpace(lyrics)
	if trimmed == "" {
		return ""
	}
	if len([]rune(trimmed)) > music3MaxLyricsRunes {
		trimmed = string([]rune(trimmed)[:music3MaxLyricsRunes])
	}
	if music3HasStructure(trimmed) {
		return music3NormalizeTaggedLyrics(trimmed)
	}

	var lines []string
	for _, line := range strings.Split(trimmed, "\n") {
		if clean := strings.TrimSpace(line); clean != "" {
			lines = append(lines, clean)
		}
	}
	if len(lines) == 0 {
		return ""
	}

	var blocks [][]string
	for start := 0; start < len(lines); start += music3SectionLines {
		end := start + music3SectionLines
		if end > len(lines) {
			end = len(lines)
		}
		blocks = append(blocks, lines[start:end])
	}

	// A block that repeats earlier material is the chorus wherever it appears.
	seen := map[string]int{}
	tags := make([]string, len(blocks))
	for index, block := range blocks {
		key := strings.ToLower(strings.Join(block, "\n"))
		if first, repeated := seen[key]; repeated {
			tags[index] = "[Chorus]"
			tags[first] = "[Chorus]"
			continue
		}
		seen[key] = index
	}
	verseCount := 0
	for index := range blocks {
		if tags[index] != "" {
			continue
		}
		// Without repetition to go on, alternate so the song still has a shape.
		if verseCount%2 == 1 {
			tags[index] = "[Chorus]"
		} else {
			tags[index] = "[Verse]"
		}
		verseCount++
	}

	out := []string{"[Intro]", "(instrumental)"}
	for index, block := range blocks {
		out = append(out, tags[index])
		out = append(out, block...)
	}
	out = append(out, "[Outro]", "(instrumental)")
	return strings.Join(out, "\n")
}
