package main

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"unicode/utf8"
)

func TestStudioAudioTitle(t *testing.T) {
	if got := studioAudioTitle("  warm analog sunrise  "); got != "warm analog sunrise" {
		t.Fatalf("studioAudioTitle() = %q", got)
	}
	got := studioAudioTitle(strings.Repeat("a", 80))
	if utf8.RuneCountInString(got) != 70 || !strings.HasSuffix(got, "…") {
		t.Fatalf("long title was not safely shortened: %q", got)
	}
}

func TestStudioMusicEndpointMatchesPublishedModelID(t *testing.T) {
	if studioMusicEndpoint != "https://fal.run/fal-ai/minimax-music/v2.6" {
		t.Fatalf("unexpected music endpoint: %s", studioMusicEndpoint)
	}
}

func TestStudioFalMusicUsesMiniMaxInstrumentalContract(t *testing.T) {
	var received map[string]interface{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Key test-fal-key" {
			t.Fatalf("authorization header = %q", r.Header.Get("Authorization"))
		}
		if err := json.NewDecoder(r.Body).Decode(&received); err != nil {
			t.Fatal(err)
		}
		_, _ = w.Write([]byte(`{"audio":{"url":"https://cdn.example/generated.mp3"}}`))
	}))
	defer server.Close()

	oldKey := falAPIKey
	oldEndpoint, hadEndpoint := os.LookupEnv("STUDIO_MUSIC_FAL_ENDPOINT")
	t.Cleanup(func() {
		falAPIKey = oldKey
		if hadEndpoint {
			_ = os.Setenv("STUDIO_MUSIC_FAL_ENDPOINT", oldEndpoint)
		} else {
			_ = os.Unsetenv("STUDIO_MUSIC_FAL_ENDPOINT")
		}
	})
	falAPIKey = "test-fal-key"
	_ = os.Setenv("STUDIO_MUSIC_FAL_ENDPOINT", server.URL)

	result, err := studioFalMusic("warm modular sunrise score", 45)
	if err != nil || result != "https://cdn.example/generated.mp3" {
		t.Fatalf("studioFalMusic result=%q err=%v", result, err)
	}
	if received["is_instrumental"] != true {
		t.Fatalf("is_instrumental = %#v", received["is_instrumental"])
	}
	if _, exists := received["duration"]; exists {
		t.Fatal("MiniMax v2.6 does not accept a duration field")
	}
	if !strings.Contains(received["prompt"].(string), "45 seconds") {
		t.Fatalf("duration steering missing from prompt: %#v", received["prompt"])
	}
}

func TestNormalizeMusicGenerationInput(t *testing.T) {
	prompt, duration, err := normalizeMusicGenerationInput("  warm modular sunrise  ", 0)
	if err != nil || prompt != "warm modular sunrise" || duration != 30 {
		t.Fatalf("valid defaults rejected: prompt=%q duration=%d err=%v", prompt, duration, err)
	}
	for _, input := range []struct {
		prompt   string
		duration int
	}{
		{"", 30},
		{"music", 30},
		{"music", 29},
		{"music", 181},
	} {
		if _, _, err := normalizeMusicGenerationInput(input.prompt, input.duration); err == nil {
			t.Fatalf("expected invalid music input: %#v", input)
		}
	}
}

func TestStudioGeneratedAudioFormat(t *testing.T) {
	contentType, extension, err := studioGeneratedAudioFormat("audio/wav; charset=binary", "https://cdn.example/output")
	if err != nil || contentType != "audio/wav" || extension != ".wav" {
		t.Fatalf("content type format rejected: type=%q extension=%q err=%v", contentType, extension, err)
	}
	contentType, extension, err = studioGeneratedAudioFormat("application/octet-stream", "https://cdn.example/output.mp3?token=ok")
	if err != nil || contentType != "audio/mpeg" || extension != ".mp3" {
		t.Fatalf("URL format rejected: type=%q extension=%q err=%v", contentType, extension, err)
	}
	if _, _, err := studioGeneratedAudioFormat("text/html", "https://cdn.example/output.bin"); err == nil {
		t.Fatal("expected unsupported generated audio format")
	}
}

func TestStudioProjectValidation(t *testing.T) {
	id := "7cd844da-0b82-48c2-a8b2-2c20107b4cb0"
	got, err := validateStudioProjectWrite(id, studioProjectWrite{Document: json.RawMessage(`{"version":1,"assets":[]}`)})
	if err != nil || got.Name != "Untitled project" {
		t.Fatalf("valid project rejected: name=%q err=%v", got.Name, err)
	}
	for _, candidate := range []studioProjectWrite{
		{Document: json.RawMessage(`[]`)},
		{Document: json.RawMessage(`{"broken"`)},
		{Name: strings.Repeat("x", 121), Document: json.RawMessage(`{}`)},
	} {
		if _, err := validateStudioProjectWrite(id, candidate); err == nil {
			t.Fatalf("expected invalid project: %#v", candidate)
		}
	}
}

func TestStudioAssetPresignValidation(t *testing.T) {
	valid := studioAssetPresignInput{
		ProjectID: "7cd844da-0b82-48c2-a8b2-2c20107b4cb0",
		AssetID:   "923ef911-cf5f-446f-9a21-da355553b5fc",
		Filename:  "two k source.mp4", ContentType: "video/mp4", Size: 1024,
	}
	got, err := validateStudioAssetPresign(valid)
	if err != nil || got.Filename != "two_k_source.mp4" {
		t.Fatalf("valid asset rejected: %#v err=%v", got, err)
	}
	valid.ContentType = "text/html"
	if _, err := validateStudioAssetPresign(valid); err == nil {
		t.Fatal("expected unsupported content type to be rejected")
	}
}

func TestStudioVideoPreviewInputIsScopedToTheSignedInProjectAsset(t *testing.T) {
	oldPrefix := r2PathPrefix
	r2PathPrefix = "gallery"
	t.Cleanup(func() { r2PathPrefix = oldPrefix })
	user := &User{ID: "7cd844da-0b82-48c2-a8b2-2c20107b4cb0"}
	projectID := "923ef911-cf5f-446f-9a21-da355553b5fc"
	assetID := "9c6f9b7f-aed0-45ef-a261-3c7a3fd831ca"
	input := studioVideoPreviewInput{
		ProjectID: projectID,
		AssetID:   assetID,
		ObjectKey: studioAssetObjectPrefix(user, projectID, assetID) + "opening-shot.webm",
	}
	if _, err := validateStudioVideoPreviewInput(user, input); err != nil {
		t.Fatalf("valid preview input rejected: %v", err)
	}
	if got := studioVideoPreviewObjectKey(input.ObjectKey); got != input.ObjectKey+".preview.webm" {
		t.Fatalf("preview object key = %q", got)
	}
	for _, invalid := range []studioVideoPreviewInput{
		{ProjectID: projectID, AssetID: assetID, ObjectKey: "gallery/studio/another-user/" + projectID + "/" + assetID + "/clip.webm"},
		{ProjectID: projectID, AssetID: assetID, ObjectKey: studioAssetObjectPrefix(user, projectID, assetID) + "nested/clip.webm"},
		{ProjectID: projectID, AssetID: assetID, ObjectKey: studioAssetObjectPrefix(user, projectID, assetID) + "still.png"},
	} {
		if _, err := validateStudioVideoPreviewInput(user, invalid); err == nil {
			t.Fatalf("unsafe preview input accepted: %#v", invalid)
		}
	}
}

func TestStudioMediaURL(t *testing.T) {
	body := []byte(`{"result":{"image":{"url":"https://cdn.example/cutout.webp"}}}`)
	if got := studioMediaURL(body); got != "https://cdn.example/cutout.webp" {
		t.Fatalf("studioMediaURL() = %q", got)
	}
	music := []byte(`{"audio_file":{"url":"https://v3.fal.media/files/panda/generated.wav"}}`)
	if got := studioMediaURL(music); got != "https://v3.fal.media/files/panda/generated.wav" {
		t.Fatalf("studioMediaURL() did not read Fal audio_file URL = %q", got)
	}
	if got := studioMediaURL([]byte(`{"status":"done"}`)); got != "" {
		t.Fatalf("studioMediaURL() unexpected URL = %q", got)
	}
}

func TestStudioExtensionCustomerPrice(t *testing.T) {
	inputSeconds := 8.0
	outputSeconds := 6.0
	price := studioExtensionPriceUSD(inputSeconds, int(outputSeconds))
	if price != 0.60 {
		t.Fatalf("extension price = %.2f, want 0.60", price)
	}
}

func TestStudioAudioSearchURL(t *testing.T) {
	got, err := studioAudioSearchURL("https://netwrck.com/", "cinematic rain", "music", 200)
	if err != nil {
		t.Fatal(err)
	}
	parsed, err := url.Parse(got)
	if err != nil {
		t.Fatal(err)
	}
	if parsed.Path != "/api/search-audio" || parsed.Query().Get("query") != "cinematic rain" {
		t.Fatalf("unexpected URL %q", got)
	}
	if parsed.Query().Get("kind") != "music" || parsed.Query().Get("limit") != "24" {
		t.Fatalf("unexpected filters %q", parsed.RawQuery)
	}
}

func TestStudioAudioSearchRejectsUnsafeInputs(t *testing.T) {
	for _, test := range []struct{ base, query, kind string }{
		{"http://netwrck.com", "rain", "music"},
		{"https://netwrck.com", "rain", "podcast"},
		{"https://netwrck.com", strings.Repeat("x", 201), "music"},
	} {
		if _, err := studioAudioSearchURL(test.base, test.query, test.kind, 12); err == nil {
			t.Fatalf("expected rejection for %#v", test)
		}
	}
}

func TestStudioMP4URL(t *testing.T) {
	if err := studioMP4URL("https://cdn.example/source.mp4?signature=ok"); err != nil {
		t.Fatal(err)
	}
	for _, raw := range []string{"https://cdn.example/source.webm", "data:video/mp4;base64,AAAA", "file:///tmp/source.mp4"} {
		if err := studioMP4URL(raw); err == nil {
			t.Fatalf("expected %q to be rejected", raw)
		}
	}
}

func TestStudioXAIUserError(t *testing.T) {
	got := studioXAIUserError([]byte(`{"code":"permission-denied","error":"used all available credits or reached its monthly spending limit"}`), 403)
	if !strings.Contains(got, "spending limit") {
		t.Fatalf("unexpected provider error %q", got)
	}
	if got := studioXAIUserError([]byte(`{"error":"internal details"}`), 500); got != "video extension is temporarily unavailable" {
		t.Fatalf("unexpected generic error %q", got)
	}
}

func TestStudioUpscaleCustomerPriceTracksOutputPixels(t *testing.T) {
	if got := studioUpscalePriceUSD(1280, 720, 5, 2); got != 0.33 {
		t.Fatalf("2x upscale price = %.2f, want 0.33", got)
	}
	if got := studioUpscalePriceUSD(1280, 720, 5, 4); got != 0.99 {
		t.Fatalf("4x upscale price = %.2f, want 0.99", got)
	}
}

func TestStudioUpscaleInputValidation(t *testing.T) {
	valid := studioUpscaleInput{VideoURL: "https://cdn.example/clip.webm", Width: 1280, Height: 720, Duration: 5, Scale: 2}
	if err := validateStudioUpscaleInput(valid); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*studioUpscaleInput){
		func(input *studioUpscaleInput) { input.VideoURL = "http://127.0.0.1/private.mp4" },
		func(input *studioUpscaleInput) { input.Scale = 3 },
		func(input *studioUpscaleInput) { input.Duration = 61 },
		func(input *studioUpscaleInput) { input.Width = 2560; input.Scale = 4 },
	} {
		candidate := valid
		mutate(&candidate)
		if err := validateStudioUpscaleInput(candidate); err == nil {
			t.Fatalf("expected invalid upscale input: %#v", candidate)
		}
	}
}

func TestStudioUpscaleOutputURLUsesConfiguredPort(t *testing.T) {
	got := studioUpscaleOutputURL("http://localhost:5000/predictions/abc/output", "http://127.0.0.1:18090")
	if got != "http://127.0.0.1:18090/predictions/abc/output" {
		t.Fatalf("normalized output URL = %q", got)
	}
	transfer := "http://127.0.0.1:18191/upload/worker/result.mp4"
	if got := studioUpscaleOutputURL(transfer, "http://127.0.0.1:18090"); got != transfer {
		t.Fatalf("transfer URL was incorrectly normalized to %q", got)
	}
}

func TestStudioUpscaleOutputTransferStreamsRegisteredFile(t *testing.T) {
	t.Setenv("STUDIO_UPSCALE_OUTPUT_DIR", t.TempDir())
	token, prefix, cleanup, err := registerStudioUpscaleUpload()
	if err != nil {
		t.Fatal(err)
	}
	defer cleanup()
	if !strings.HasSuffix(prefix, "/upload/"+token) {
		t.Fatalf("unexpected output prefix %q", prefix)
	}

	content := []byte("small-real-video-payload")
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	part, err := form.CreateFormFile("file", "result.mp4")
	if err != nil {
		t.Fatal(err)
	}
	_, _ = part.Write(content)
	_ = form.Close()

	put := httptest.NewRequest(http.MethodPut, "/upload/"+token, &body)
	put.Header.Set("Content-Type", form.FormDataContentType())
	putResponse := httptest.NewRecorder()
	handleStudioUpscaleOutputTransfer(putResponse, put)
	if putResponse.Code != http.StatusNoContent {
		t.Fatalf("upload status = %d, body=%q", putResponse.Code, putResponse.Body.String())
	}

	get := httptest.NewRequest(http.MethodGet, "/upload/"+token+"/result.mp4", nil)
	getResponse := httptest.NewRecorder()
	handleStudioUpscaleOutputTransfer(getResponse, get)
	if getResponse.Code != http.StatusOK || !bytes.Equal(getResponse.Body.Bytes(), content) {
		t.Fatalf("download status = %d body=%q", getResponse.Code, getResponse.Body.Bytes())
	}

	rawContent := []byte("raw-cog-file-output")
	rawPut := httptest.NewRequest(http.MethodPut, "/upload/"+token, bytes.NewReader(rawContent))
	rawPut.Header.Set("Content-Type", "video/mp4")
	rawResponse := httptest.NewRecorder()
	handleStudioUpscaleOutputTransfer(rawResponse, rawPut)
	if rawResponse.Code != http.StatusNoContent {
		t.Fatalf("raw upload status = %d, body=%q", rawResponse.Code, rawResponse.Body.String())
	}
	rawGet := httptest.NewRequest(http.MethodGet, "/upload/"+token+"/result.mp4", nil)
	rawGetResponse := httptest.NewRecorder()
	handleStudioUpscaleOutputTransfer(rawGetResponse, rawGet)
	if rawGetResponse.Code != http.StatusOK || !bytes.Equal(rawGetResponse.Body.Bytes(), rawContent) {
		t.Fatalf("raw download status = %d body=%q", rawGetResponse.Code, rawGetResponse.Body.Bytes())
	}

	missing := httptest.NewRequest(http.MethodPut, "/upload/not-registered", nil)
	missingResponse := httptest.NewRecorder()
	handleStudioUpscaleOutputTransfer(missingResponse, missing)
	if missingResponse.Code != http.StatusNotFound {
		t.Fatalf("unregistered upload status = %d", missingResponse.Code)
	}
}
