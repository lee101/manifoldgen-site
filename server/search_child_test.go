package main

import "testing"

func TestSearchIndexClassKeepsChildNSFWOutOfBothIndexes(t *testing.T) {
	cases := []struct {
		name        string
		prompt      string
		nsfw        bool
		wantSafe    bool
		wantFlagged bool
	}{
		{"safe adult scene", "a lighthouse at dusk", false, true, false},
		{"safe prologue with children", "two children on a flooded mill bank, grief, rain", false, true, false},
		{"explicit adults", "two consenting adults having sex", true, false, true},
		{"child described and flagged", "a child in an explicit adult scene", true, false, false},
		{"teen described and flagged", "a 15 years old subject, explicit", true, false, false},
	}
	for _, c := range cases {
		safe, flagged := searchIndexClass(c.prompt, c.nsfw)
		if safe != c.wantSafe || flagged != c.wantFlagged {
			t.Errorf("%s: safe=%v flagged=%v want %v/%v", c.name, safe, flagged, c.wantSafe, c.wantFlagged)
		}
	}
}
