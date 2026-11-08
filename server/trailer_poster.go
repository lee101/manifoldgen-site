package main

import (
	"fmt"
	"strings"
)

func trailerPosterPrompt(anchor, title, tagline string, names []string) string {
	cast := "the lead characters from the attached identity sheets"
	if len(names) > 0 {
		cast = strings.Join(names, ", ") + " exactly as on the attached identity sheets"
	}
	text := fmt.Sprintf("the title %q in large, physically designed display type in the lower third", title)
	if tagline = strings.TrimSpace(tagline); tagline != "" {
		text += fmt.Sprintf(", and the tagline %q in small type above the title", tagline)
	}
	return strings.TrimSpace(fmt.Sprintf("%s Theatrical one-sheet movie poster, 2:3 portrait. Key art of %s, composed against the world from the attached board, dramatic depth and rim light. Typography: %s. Spell every word exactly. No billing block, no credits, no studio logos, no website, no rating box, no other words.", anchor, cast, text))
}

func trailerPosterRefs(references []RemakeReferenceAsset) (primary string, refs []string, names []string) {
	world := ""
	for _, ref := range references {
		if ref.ImageURL == "" || ref.Error != "" {
			continue
		}
		if ref.Kind == "setting" {
			world = ref.ImageURL
			continue
		}
		if ref.Kind == "character" && len(refs) < 4 {
			refs = append(refs, ref.ImageURL)
			names = append(names, ref.Name)
		}
	}
	if world != "" {
		refs = append(refs, world)
	}
	if len(refs) > 0 {
		primary = refs[0]
	}
	return primary, refs, names
}

func generateTrailerPoster(req dramatizeRequest, references []RemakeReferenceAsset, anchor, title, tagline string) (string, error) {
	if strings.TrimSpace(title) == "" {
		return "", fmt.Errorf("poster needs a title")
	}
	primary, refs, names := trailerPosterRefs(references)
	return trailerGenerateImage(false, req.ImageModel, trailerPosterPrompt(anchor, title, tagline, names), primary, refs, "2:3")
}
