package main

import (
	"regexp"
	"strings"
)

// Child-related prompts are never eligible for a public gallery or search index.
// This is deliberately checked before invoking expensive visual moderation.
var childPromptPattern = regexp.MustCompile(`(?i)\b(?:child(?:ren)?|kid(?:s)?|baby|infant|toddler|underage|minor(?:s)?|loli|shota)\b|\b(?:[0-9]|1[0-7])\s*(?:yo|y/o|years?\s*old)\b`)

func isChildPrompt(prompt string) bool {
	return childPromptPattern.MatchString(strings.TrimSpace(prompt))
}

var sexualPromptPattern = regexp.MustCompile(`(?i)\b(?:sex(?:ual|y)?|nude|naked|nsfw|explicit|porn\w*|erotic\w*|nipples?|genital\w*|lewd|topless|undress\w*|fetish|hentai|cum|orgasm\w*|masturbat\w*|blowjob|penetrat\w*)\b`)

// isMinorSexualPrompt is the only generation-time refusal: a minor term together with a sexual term.
func isMinorSexualPrompt(prompt string) bool {
	p := strings.TrimSpace(prompt)
	return childPromptPattern.MatchString(p) && sexualPromptPattern.MatchString(p)
}
