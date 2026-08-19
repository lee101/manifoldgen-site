package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/valyala/fasthttp"
)

// Previews are intentionally small: they are for hover/scrub UI, never for
// editing or export. Keeping them capped lets a large source library remain
// quick to browse without quietly downloading full-resolution masters.
const (
	studioVideoPreviewMaxOutputBytes = 18 << 20
)

type studioVideoPreviewInput struct {
	ProjectID string `json:"project_id"`
	AssetID   string `json:"asset_id"`
	ObjectKey string `json:"object_key"`
}

type studioVideoPreviewState struct {
	mu         sync.RWMutex
	Status     string
	PreviewURL string
	Error      string
}

var (
	studioVideoPreviews       sync.Map // map[string]*studioVideoPreviewState, keyed by source object key
	studioVideoPreviewWorkers = make(chan struct{}, 2)
)

func studioVideoPreviewObjectKey(sourceKey string) string {
	return sourceKey + ".preview.webm"
}

func studioVideoPreviewURL(sourceKey string) string {
	return fmt.Sprintf("https://%s/%s", r2PublicHost, studioVideoPreviewObjectKey(sourceKey))
}

func studioAssetObjectPrefix(user *User, projectID, assetID string) string {
	userShort := strings.ReplaceAll(user.ID, "-", "")
	if len(userShort) > 16 {
		userShort = userShort[:16]
	}
	return fmt.Sprintf("%s/studio/%s/%s/%s/", strings.TrimSuffix(r2PathPrefix, "/"), userShort, projectID, assetID)
}

func validateStudioVideoPreviewInput(user *User, input studioVideoPreviewInput) (studioVideoPreviewInput, error) {
	if user == nil {
		return input, fmt.Errorf("sign in required")
	}
	if _, err := uuid.Parse(strings.TrimSpace(input.ProjectID)); err != nil {
		return input, fmt.Errorf("invalid project ID")
	}
	if _, err := uuid.Parse(strings.TrimSpace(input.AssetID)); err != nil {
		return input, fmt.Errorf("invalid asset ID")
	}
	input.ObjectKey = strings.TrimSpace(input.ObjectKey)
	prefix := studioAssetObjectPrefix(user, input.ProjectID, input.AssetID)
	filename := strings.TrimPrefix(input.ObjectKey, prefix)
	if filename == input.ObjectKey || filename == "" || strings.ContainsAny(filename, "/\\") || sanitizeUploadName(filename) != filename {
		return input, fmt.Errorf("asset does not belong to this project")
	}
	if !isStudioVideoFilename(filename) {
		return input, fmt.Errorf("a video asset is required")
	}
	return input, nil
}

func isStudioVideoFilename(name string) bool {
	name = strings.ToLower(name)
	return strings.HasSuffix(name, ".mp4") || strings.HasSuffix(name, ".webm") || strings.HasSuffix(name, ".mov") || strings.HasSuffix(name, ".m4v") || strings.HasSuffix(name, ".mkv")
}

func studioVideoPreviewResponse(state *studioVideoPreviewState) map[string]string {
	state.mu.RLock()
	defer state.mu.RUnlock()
	return map[string]string{"status": state.Status, "preview_url": state.PreviewURL, "error": state.Error}
}

func handleStudioVideoPreview(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	method := string(ctx.Method())
	var input studioVideoPreviewInput
	switch method {
	case http.MethodPost:
		if json.Unmarshal(ctx.PostBody(), &input) != nil {
			jsonError(ctx, http.StatusBadRequest, "invalid JSON")
			return
		}
	case http.MethodGet:
		input.ProjectID = string(ctx.QueryArgs().Peek("project_id"))
		input.AssetID = string(ctx.QueryArgs().Peek("asset_id"))
		input.ObjectKey = string(ctx.QueryArgs().Peek("object_key"))
	default:
		ctx.Response.Header.Set("Allow", "GET, POST")
		ctx.SetStatusCode(http.StatusMethodNotAllowed)
		return
	}
	input, err = validateStudioVideoPreviewInput(user, input)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}

	if existing, ok := studioVideoPreviews.Load(input.ObjectKey); ok {
		jsonResponse(ctx, http.StatusOK, studioVideoPreviewResponse(existing.(*studioVideoPreviewState)))
		return
	}
	previewURL := studioVideoPreviewURL(input.ObjectKey)
	if method == http.MethodGet {
		// The process may have restarted after a preview was encoded. Avoid
		// needlessly re-encoding an immutable derivative that already exists.
		if studioVideoPreviewExists(previewURL) {
			jsonResponse(ctx, http.StatusOK, map[string]string{"status": "ready", "preview_url": previewURL})
			return
		}
		jsonResponse(ctx, http.StatusOK, map[string]string{"status": "missing", "preview_url": previewURL})
		return
	}
	if studioVideoPreviewExists(previewURL) {
		jsonResponse(ctx, http.StatusOK, map[string]string{"status": "ready", "preview_url": previewURL})
		return
	}

	state := &studioVideoPreviewState{Status: "queued", PreviewURL: previewURL}
	actual, loaded := studioVideoPreviews.LoadOrStore(input.ObjectKey, state)
	if loaded {
		jsonResponse(ctx, http.StatusOK, studioVideoPreviewResponse(actual.(*studioVideoPreviewState)))
		return
	}
	go encodeStudioVideoPreview(input, state)
	jsonResponse(ctx, http.StatusAccepted, studioVideoPreviewResponse(state))
}

func studioVideoPreviewExists(previewURL string) bool {
	request, err := http.NewRequest(http.MethodHead, previewURL, nil)
	if err != nil {
		return false
	}
	response, err := backendClient.Do(request)
	if err != nil {
		return false
	}
	response.Body.Close()
	return response.StatusCode >= http.StatusOK && response.StatusCode < http.StatusMultipleChoices
}

func encodeStudioVideoPreview(input studioVideoPreviewInput, state *studioVideoPreviewState) {
	defer time.AfterFunc(24*time.Hour, func() {
		if current, ok := studioVideoPreviews.Load(input.ObjectKey); ok && current == state {
			studioVideoPreviews.Delete(input.ObjectKey)
		}
	})
	select {
	case studioVideoPreviewWorkers <- struct{}{}:
		defer func() { <-studioVideoPreviewWorkers }()
	case <-time.After(20 * time.Minute):
		state.mu.Lock()
		state.Status = "failed"
		state.Error = "preview encoding queue expired"
		state.mu.Unlock()
		return
	}
	state.mu.Lock()
	state.Status = "processing"
	state.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Minute)
	defer cancel()
	if err := makeStudioVideoPreview(ctx, input.ObjectKey); err != nil {
		state.mu.Lock()
		state.Status = "failed"
		state.Error = "preview encoding could not be completed"
		state.mu.Unlock()
		return
	}
	state.mu.Lock()
	state.Status = "ready"
	state.Error = ""
	state.mu.Unlock()
}

func makeStudioVideoPreview(ctx context.Context, sourceKey string) error {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		return fmt.Errorf("ffmpeg is not available")
	}
	temporary, err := os.MkdirTemp("", "manifoldgen-studio-preview-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(temporary)
	preview := filepath.Join(temporary, "preview.webm")
	sourceURL := fmt.Sprintf("https://%s/%s", r2PublicHost, sourceKey)
	baseArgs := []string{
		"-y", "-hide_banner", "-loglevel", "error", "-i", sourceURL,
		"-t", "12", "-map", "0:v:0", "-an",
		"-vf", "fps=15,scale=w='trunc(min(480,iw)/2)*2':h=-2",
	}
	// AV1 keeps a library of browser previews substantially smaller than a
	// full editing proxy. Prefer NVENC so the production GPU does the encode;
	// the two CPU encoders make the feature reliable on a GPU-less host or when
	// NVENC is temporarily unavailable. Both outputs remain AV1/WebM.
	encoders := [][]string{
		{"-c:v", "av1_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", "40", "-b:v", "0", "-g", "90", "-pix_fmt", "yuv420p"},
		{"-c:v", "libsvtav1", "-preset", "10", "-crf", "42", "-g", "90", "-svtav1-params", "lp=4", "-pix_fmt", "yuv420p"},
		{"-c:v", "libaom-av1", "-cpu-used", "8", "-crf", "42", "-b:v", "0", "-g", "90", "-row-mt", "1", "-pix_fmt", "yuv420p"},
	}
	var encodeOutput []byte
	var encodeErr error
	for _, encoderArgs := range encoders {
		args := append(append([]string{}, baseArgs...), encoderArgs...)
		args = append(args, preview)
		encodeOutput, encodeErr = exec.CommandContext(ctx, "ffmpeg", args...).CombinedOutput()
		if encodeErr == nil {
			break
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
	if encodeErr != nil {
		return fmt.Errorf("AV1 thumbnail encode failed: %s", tailOutput(encodeOutput))
	}
	info, err := os.Stat(preview)
	if err != nil || info.Size() == 0 || info.Size() > studioVideoPreviewMaxOutputBytes {
		return fmt.Errorf("thumbnail encode produced an invalid preview")
	}
	return uploadStudioVideoPreview(ctx, preview, studioVideoPreviewObjectKey(sourceKey))
}

func uploadStudioVideoPreview(ctx context.Context, filename, objectKey string) error {
	uploadURL, err := presignR2PutObject(objectKey, "video/webm", 900)
	if err != nil {
		return err
	}
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return err
	}
	request.ContentLength = info.Size()
	request.Header.Set("Content-Type", "video/webm")
	response, err := backendClient.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode >= http.StatusMultipleChoices {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return fmt.Errorf("preview upload returned %d: %s", response.StatusCode, tailOutput(body))
	}
	return nil
}
