package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
)

func TestFetchTimelineMediaBudget(t *testing.T) {
	previous := timelineDownload
	defer func() { timelineDownload = previous }()
	var mu sync.Mutex
	started := 0
	timelineDownload = func(ctx context.Context, raw, dest string, limit int64) error {
		mu.Lock()
		started++
		mu.Unlock()
		if ctx.Err() != nil {
			return ctx.Err()
		}
		file, err := os.Create(dest)
		if err != nil {
			return err
		}
		defer file.Close()
		if err := file.Truncate(limit); err != nil {
			return err
		}
		if limit < prodkitMaxVideo {
			return fmt.Errorf("%s exceeds the limit", raw)
		}
		return nil
	}
	assets := []string{}
	for i := 0; i < 40; i++ {
		assets = append(assets, fmt.Sprintf(`{"id":"v%d","kind":"video","cloudURL":"https://cdn.example/%d.mp4"}`, i, i))
	}
	doc := timelineDoc(t, `{"assets":[`+strings.Join(assets, ",")+`]}`)
	_, err := fetchTimelineMedia(context.Background(), doc, t.TempDir(), true)
	if err == nil || !strings.Contains(err.Error(), "2 GiB") {
		t.Fatalf("err = %v", err)
	}
	if started > int(timelineMaxTotalBytes/prodkitMaxVideo)+5 {
		t.Fatalf("%d downloads started after the budget ran out", started)
	}
}

func TestRehostTranscodedOwnedMedia(t *testing.T) {
	previousUpload, previousHost := uploadTimelineStudioFile, r2PublicHost
	defer func() { uploadTimelineStudioFile, r2PublicHost = previousUpload, previousHost }()
	r2PublicHost = "media.manifoldgen.test"
	uploaded := 0
	uploadTimelineStudioFile = func(_ context.Context, path, objectKey, contentType string) (string, error) {
		uploaded++
		return "https://" + r2PublicHost + "/" + objectKey, nil
	}
	hevc := "https://media.manifoldgen.test/u/clip.mov"
	plain := "https://media.manifoldgen.test/u/plain.mp4"
	doc := timelineDoc(t, `{"assets":[{"id":"a","kind":"video","cloudURL":"`+hevc+`"},{"id":"b","kind":"video","cloudURL":"`+plain+`"}]}`)
	media := timelineMedia{
		Info: map[string]timelineMediaInfo{
			hevc:  {Duration: 2, Width: 64, Height: 64, ContentType: "video/mp4", Transcoded: true},
			plain: {Duration: 2, Width: 64, Height: 64, ContentType: "video/mp4"},
		},
		Paths: map[string]string{hevc: "/w/0-h264.mp4", plain: "/w/1.mp4"},
	}
	if err := doc.finalize(media.lookup); err != nil {
		t.Fatal(err)
	}
	if err := rehostTimelineMedia(context.Background(), "u", uuid.NewString(), doc, media); err != nil {
		t.Fatal(err)
	}
	if uploaded != 1 || !strings.HasSuffix(doc.Assets[0].CloudURL, "/clip.mp4") || doc.Assets[1].CloudURL != plain {
		t.Fatalf("uploaded=%d a=%s b=%s", uploaded, doc.Assets[0].CloudURL, doc.Assets[1].CloudURL)
	}
}

func TestTimelineProjectDocumentLimit(t *testing.T) {
	big := `{"assets":[{"id":"t","kind":"image","text":{"content":"Hi"}}],"selectedID":"` + strings.Repeat("x", 600<<10) + `"}`
	if _, err := parseTimelineDocument([]byte(big), timelineDocLimit(map[string]interface{}{})); err == nil {
		t.Fatal("600 KB agent document accepted")
	}
	if _, err := parseTimelineDocument([]byte(big), timelineDocLimit(map[string]interface{}{"project_id": uuid.NewString()})); err != nil {
		t.Fatalf("saved project rejected: %v", err)
	}
}
