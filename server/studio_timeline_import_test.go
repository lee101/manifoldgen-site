package main

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/google/uuid"
)

func TestTimelineImportAndRehost(t *testing.T) {
	uploads := []string{}
	previousUpload, previousSave, previousHost := uploadTimelineStudioFile, saveTimelineProject, r2PublicHost
	defer func() { uploadTimelineStudioFile, saveTimelineProject, r2PublicHost = previousUpload, previousSave, previousHost }()
	r2PublicHost = "media.manifoldgen.test"
	uploadTimelineStudioFile = func(_ context.Context, path, objectKey, contentType string) (string, error) {
		uploads = append(uploads, objectKey+"|"+contentType)
		return "https://" + r2PublicHost + "/" + objectKey, nil
	}
	var saved []byte
	saveTimelineProject = func(userID, projectID, name string, doc *timelineDocument) error {
		raw, err := doc.marshalStudio()
		saved = raw
		if userID != "user-1" || name != "Recap" {
			t.Errorf("save user=%s name=%s", userID, name)
		}
		return err
	}
	owned := "https://" + r2PublicHost + "/gallery/studio/u/p/a/clip.mp4"
	doc := timelineDoc(t, `{"luts":{"warm":{"cube":"LUT_3D_SIZE 2\n0 0 0\n1 0 0\n0 1 0\n1 1 0\n0 0 1\n1 0 1\n0 1 1\n1 1 1\n"}},"assets":[
		{"id":"t","kind":"image","text":{"content":"Recap"}},
		{"id":"a","kind":"video","cloudURL":"`+owned+`","duration":4,"width":1280,"height":720,"size":10,"contentType":"video/mp4","previewURL":"https://evil.example/p.webm","adjustments":{"lutID":"warm"}}]}`)
	projectID, _, err := importTimelineDocument(context.Background(), "user-1", doc, "Recap", t.TempDir(), false)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := uuid.Parse(projectID); err != nil || len(uploads) != 0 {
		t.Fatalf("project=%s uploads=%v", projectID, uploads)
	}
	var stored map[string]interface{}
	_ = json.Unmarshal(saved, &stored)
	lut := stored["luts"].(map[string]interface{})["warm"].(map[string]interface{})
	video := stored["assets"].([]interface{})[1].(map[string]interface{})
	if lut["size"] != 2.0 || lut["cube"] != nil || video["previewURL"] != nil || video["cloudURL"] != owned {
		t.Fatalf("stored = %s", saved)
	}

	source := "https://cdn.example/x/My Clip.mp4"
	external := timelineDoc(t, `{"assets":[{"id":"a","kind":"video","cloudURL":"`+source+`"},{"id":"b","kind":"video","cloudURL":"`+source+`","timelineStart":9}]}`)
	media := timelineMedia{
		Info:  map[string]timelineMediaInfo{source: {Duration: 3, Width: 640, Height: 360, ContentType: "video/mp4", Size: 9}},
		Paths: map[string]string{source: "/work/media/0.mp4"},
	}
	if err := external.finalize(media.lookup); err != nil {
		t.Fatal(err)
	}
	if err := rehostTimelineMedia(context.Background(), "user-1", projectID, external, media); err != nil {
		t.Fatal(err)
	}
	if len(uploads) != 1 || !strings.Contains(uploads[0], "/studio/user1/"+projectID+"/"+external.Assets[0].MediaID+"/My_Clip.mp4|video/mp4") {
		t.Fatalf("uploads = %v", uploads)
	}
	if external.Assets[0].CloudURL != external.Assets[1].CloudURL || !timelineOwnedURL(external.Assets[1].CloudURL) || media.Paths[external.Assets[0].CloudURL] != "/work/media/0.mp4" {
		t.Fatalf("rehosted = %+v %+v", external.Assets[0], external.Assets[1])
	}
}
