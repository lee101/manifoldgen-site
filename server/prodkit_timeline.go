package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/valyala/fasthttp"
)

const (
	prodkitTimeline       = "prodkit_timeline_render"
	timelineMaxAudio      = 100 << 20
	timelineMaxTotalBytes = 2 << 30
	timelineMaxCubeBytes  = 4 << 20
)

var timelineDownload = prodkitDownload

var timelineDecodableVideo = map[string]bool{"h264": true, "vp8": true, "vp9": true, "av1": true}

func prodkitChromeBinary() string {
	if bin := strings.TrimSpace(os.Getenv("PRODKIT_CHROME")); bin != "" {
		return bin
	}
	if _, err := os.Stat("/usr/bin/google-chrome"); err == nil {
		return "/usr/bin/google-chrome"
	}
	for _, name := range []string{"google-chrome-stable", "chromium", "chromium-browser"} {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	return ""
}

func timelineRenderOrigin() string {
	return strings.TrimRight(strings.TrimSpace(os.Getenv("PRODKIT_RENDER_ORIGIN")), "/")
}

func timelineRenderDist() (string, string) {
	dist := strings.TrimSpace(os.Getenv("PRODKIT_RENDER_DIST"))
	if dist == "" {
		dist = getEnv("DIST_DIR", "../frontend/out")
	}
	for _, page := range []string{"studio/render.html", "studio/render/index.html"} {
		if info, err := os.Stat(filepath.Join(dist, page)); err == nil && !info.IsDir() {
			return dist, filepath.Join(dist, page)
		}
	}
	return dist, ""
}

func timelineRendererAvailable() bool {
	if prodkitChromeBinary() == "" {
		return false
	}
	if timelineRenderOrigin() != "" {
		return true
	}
	_, page := timelineRenderDist()
	return page != ""
}

func timelineOwnedURL(raw string) bool {
	parsed, err := url.Parse(raw)
	return err == nil && parsed.Scheme == "https" && parsed.Hostname() == r2PublicHost
}

type timelineProbe struct {
	Duration   float64
	Width      int
	Height     int
	VideoCodec string
	AudioCodec string
	Format     string
}

func probeTimelineFile(ctx context.Context, path string) (timelineProbe, error) {
	var probe timelineProbe
	out, err := exec.CommandContext(ctx, "ffprobe", "-v", "error", "-show_entries",
		"stream=codec_type,codec_name,width,height:format=duration,format_name", "-of", "json", path).Output()
	if err != nil {
		return probe, fmt.Errorf("ffprobe: %w", err)
	}
	var parsed struct {
		Streams []struct {
			CodecType string `json:"codec_type"`
			CodecName string `json:"codec_name"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
		} `json:"streams"`
		Format struct {
			Duration   string `json:"duration"`
			FormatName string `json:"format_name"`
		} `json:"format"`
	}
	if err := json.Unmarshal(out, &parsed); err != nil {
		return probe, err
	}
	for _, stream := range parsed.Streams {
		switch stream.CodecType {
		case "video":
			if probe.VideoCodec == "" {
				probe.VideoCodec, probe.Width, probe.Height = stream.CodecName, stream.Width, stream.Height
			}
		case "audio":
			if probe.AudioCodec == "" {
				probe.AudioCodec = stream.CodecName
			}
		}
	}
	probe.Duration = parseFloat(strings.TrimSpace(parsed.Format.Duration))
	probe.Format = parsed.Format.FormatName
	return probe, nil
}

func timelineSniff(path string) string {
	head := make([]byte, 512)
	if file, err := os.Open(path); err == nil {
		n, _ := io.ReadFull(file, head)
		head = head[:n]
		file.Close()
	}
	return strings.SplitN(http.DetectContentType(head), ";", 2)[0]
}

func timelineContentType(path string, probe timelineProbe, kind string) string {
	sniffed := timelineSniff(path)
	if strings.HasPrefix(sniffed, kind+"/") {
		return sniffed
	}
	format := probe.Format
	switch {
	case kind == "video" && strings.Contains(format, "webm"), kind == "video" && strings.Contains(format, "matroska"):
		return "video/webm"
	case kind == "video" && strings.Contains(format, "mov"):
		if strings.HasSuffix(strings.ToLower(path), ".mov") {
			return "video/quicktime"
		}
		return "video/mp4"
	case kind == "audio" && strings.Contains(format, "mp3"):
		return "audio/mpeg"
	case kind == "audio" && strings.Contains(format, "wav"):
		return "audio/wav"
	case kind == "audio" && strings.Contains(format, "ogg"):
		return "audio/ogg"
	case kind == "audio" && strings.Contains(format, "flac"):
		return "audio/flac"
	case kind == "audio" && strings.Contains(format, "mov"):
		return "audio/mp4"
	case kind == "image" && strings.Contains(format, "png"):
		return "image/png"
	case kind == "image" && strings.Contains(format, "jpeg"):
		return "image/jpeg"
	case kind == "image" && strings.Contains(format, "webp"):
		return "image/webp"
	}
	return map[string]string{"video": "video/mp4", "audio": "audio/mpeg", "image": "image/png"}[kind]
}

type timelineMedia struct {
	Info  map[string]timelineMediaInfo
	Paths map[string]string
}

func (media timelineMedia) lookup(asset *timelineAsset) (timelineMediaInfo, bool) {
	info, ok := media.Info[asset.CloudURL]
	return info, ok
}

func timelineNeedsFetch(asset *timelineAsset) bool {
	if asset.CloudURL == "" {
		return false
	}
	if !timelineOwnedURL(asset.CloudURL) || asset.Size == nil || asset.ContentType == "" || asset.Duration == nil {
		return true
	}
	return asset.Kind != "audio" && (asset.Width == nil || asset.Height == nil)
}

func fetchTimelineMedia(ctx context.Context, doc *timelineDocument, workDir string, all bool) (timelineMedia, error) {
	media := timelineMedia{Info: map[string]timelineMediaInfo{}, Paths: map[string]string{}}
	type item struct {
		url, kind string
		index     int
	}
	wanted := map[string]bool{}
	items := []item{}
	for _, asset := range doc.Assets {
		if asset.CloudURL == "" || wanted[asset.CloudURL] || !(all || timelineNeedsFetch(asset)) {
			continue
		}
		wanted[asset.CloudURL] = true
		items = append(items, item{asset.CloudURL, asset.Kind, len(items)})
	}
	dir := filepath.Join(workDir, "media")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return media, err
	}
	fetchCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	var mu sync.Mutex
	var reserved int64
	var budgetErr error
	overBudget := func() {
		budgetErr = prodkitUserError{fmt.Sprintf("timeline media exceeds %d GiB in total", timelineMaxTotalBytes>>30)}
		cancel()
	}
	errs := make([]error, len(items))
	limiter := make(chan struct{}, 4)
	var wg sync.WaitGroup
	for _, entry := range items {
		wg.Add(1)
		go func(entry item) {
			defer wg.Done()
			select {
			case limiter <- struct{}{}:
			case <-fetchCtx.Done():
				return
			}
			defer func() { <-limiter }()
			limit := map[string]int64{"video": prodkitMaxVideo, "image": prodkitMaxImage, "audio": timelineMaxAudio}[entry.kind]
			mu.Lock()
			share := min(limit, timelineMaxTotalBytes-reserved)
			if share <= 0 || fetchCtx.Err() != nil {
				if share <= 0 && budgetErr == nil {
					overBudget()
				}
				mu.Unlock()
				return
			}
			reserved += share
			mu.Unlock()
			path := filepath.Join(dir, strconv.Itoa(entry.index)+prodkitURLExt(entry.url))
			downloadErr := timelineDownload(fetchCtx, entry.url, path, share)
			var used int64
			if stat, err := os.Stat(path); err == nil {
				used = min(stat.Size(), share)
			}
			mu.Lock()
			reserved -= share - used
			if downloadErr != nil && share < limit && fetchCtx.Err() == nil && used >= share && budgetErr == nil {
				overBudget()
			}
			mu.Unlock()
			if downloadErr != nil {
				errs[entry.index] = prodkitUserError{downloadErr.Error()}
				return
			}
			info, path, err := inspectTimelineMedia(fetchCtx, path, entry.kind, entry.url)
			if err != nil {
				errs[entry.index] = err
				return
			}
			mu.Lock()
			media.Info[entry.url] = info
			media.Paths[entry.url] = path
			mu.Unlock()
		}(entry)
	}
	wg.Wait()
	if budgetErr != nil {
		return media, budgetErr
	}
	for _, err := range errs {
		if err != nil {
			return media, err
		}
	}
	return media, nil
}

func inspectTimelineMedia(ctx context.Context, path, kind, source string) (timelineMediaInfo, string, error) {
	name := truncateString(timelineURLName(source), 80)
	transcoded := false
	probe, err := probeTimelineFile(ctx, path)
	if err != nil {
		return timelineMediaInfo{}, "", prodkitUserError{name + " is not a readable " + kind}
	}
	switch kind {
	case "video":
		if probe.VideoCodec == "" || probe.Duration <= 0 {
			return timelineMediaInfo{}, "", prodkitUserError{name + " has no video stream"}
		}
		if !timelineDecodableVideo[probe.VideoCodec] {
			converted := strings.TrimSuffix(path, filepath.Ext(path)) + "-h264.mp4"
			cmd := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-y", "-i", path, "-map", "0:v:0", "-map", "0:a:0?",
				"-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", converted)
			if output, err := cmd.CombinedOutput(); err != nil {
				log.Printf("[timeline] transcode %s: %v %s", name, err, tailOutput(output))
				return timelineMediaInfo{}, "", prodkitUserError{name + " uses an unsupported video codec"}
			}
			path = converted
			if probe, err = probeTimelineFile(ctx, path); err != nil {
				return timelineMediaInfo{}, "", err
			}
			transcoded = true
		}
	case "audio":
		if probe.AudioCodec == "" || probe.Duration <= 0 {
			return timelineMediaInfo{}, "", prodkitUserError{name + " has no audio stream"}
		}
	case "image":
		sniffed := timelineSniff(path)
		if probe.Width <= 0 || probe.Height <= 0 || strings.HasPrefix(sniffed, "video/") || strings.HasPrefix(sniffed, "audio/") {
			return timelineMediaInfo{}, "", prodkitUserError{name + " is not a readable image"}
		}
		probe.Duration = 0
	}
	stat, err := os.Stat(path)
	if err != nil {
		return timelineMediaInfo{}, "", err
	}
	return timelineMediaInfo{
		Duration: probe.Duration, Width: float64(probe.Width), Height: float64(probe.Height),
		ContentType: timelineContentType(path, probe, kind), Size: stat.Size(), Transcoded: transcoded,
	}, path, nil
}

func resolveTimelineLUTs(ctx context.Context, doc *timelineDocument, workDir string) error {
	for id, lut := range doc.LUTs {
		text := lut.Cube
		if lut.URL != "" {
			path := filepath.Join(workDir, "lut-"+uuid.NewString()+".cube")
			if err := prodkitDownload(ctx, lut.URL, path, timelineMaxCubeBytes); err != nil {
				return prodkitUserError{fmt.Sprintf("luts[%q]: %v", id, err)}
			}
			raw, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			text = string(raw)
		}
		if text == "" {
			continue
		}
		if err := lut.resolveCube(text); err != nil {
			return prodkitUserError{fmt.Sprintf("luts[%q]: %v", id, err)}
		}
	}
	return nil
}

var uploadTimelineStudioFile = func(ctx context.Context, path, objectKey, contentType string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	uploadURL, err := presignR2PutObject(objectKey, contentType, 3600)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return "", err
	}
	req.ContentLength = info.Size()
	req.Header.Set("Content-Type", contentType)
	resp, err := backendClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("R2 studio asset upload returned %d", resp.StatusCode)
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func rehostTimelineMedia(ctx context.Context, userID, projectID string, doc *timelineDocument, media timelineMedia) error {
	type hosted struct{ url, key string }
	done := map[string]hosted{}
	user := &User{ID: userID}
	for _, asset := range doc.Assets {
		if asset.PreviewURL != "" && !timelineOwnedURL(asset.PreviewURL) {
			asset.PreviewURL = ""
		}
		if asset.CloudURL == "" || (timelineOwnedURL(asset.CloudURL) && !media.Info[asset.CloudURL].Transcoded) {
			continue
		}
		source := asset.CloudURL
		if previous, ok := done[source]; ok {
			asset.CloudURL, asset.ObjectKey = previous.url, previous.key
			continue
		}
		path, ok := media.Paths[source]
		if !ok {
			return fmt.Errorf("media %s was not downloaded", truncateString(source, 120))
		}
		filename := sanitizeUploadName(strings.TrimSuffix(asset.Name, filepath.Ext(asset.Name)) + filepath.Ext(path))
		if strings.Trim(filename, ".") == "" {
			filename = "media" + filepath.Ext(path)
		}
		objectKey := studioAssetObjectPrefix(user, projectID, asset.MediaID) + filename
		publicURL, err := uploadTimelineStudioFile(ctx, path, objectKey, asset.ContentType)
		if err != nil {
			return err
		}
		done[source] = hosted{publicURL, objectKey}
		media.Paths[publicURL] = path
		media.Info[publicURL] = media.Info[source]
		asset.CloudURL, asset.ObjectKey, asset.PreviewURL = publicURL, objectKey, ""
	}
	return nil
}

var saveTimelineProject = func(userID, projectID, name string, doc *timelineDocument) error {
	raw, err := doc.marshalStudio()
	if err != nil {
		return err
	}
	if _, err := dbConn.UpsertStudioProject(userID, projectID, name, raw); err != nil {
		return err
	}
	return nil
}

func timelineStudioURL(projectID string) string {
	return sitemapSiteURL + "/studio?project=" + url.QueryEscape(projectID)
}

func timelineProjectName(params map[string]interface{}) string {
	name, _ := params["name"].(string)
	name = strings.TrimSpace(name)
	if name == "" {
		return "Agent timeline"
	}
	return truncateString(name, 120)
}

func importTimelineDocument(ctx context.Context, userID string, doc *timelineDocument, name, workDir string, all bool) (string, timelineMedia, error) {
	media, err := fetchTimelineMedia(ctx, doc, workDir, all)
	if err != nil {
		return "", media, err
	}
	if err := resolveTimelineLUTs(ctx, doc, workDir); err != nil {
		return "", media, err
	}
	if err := doc.finalize(media.lookup); err != nil {
		return "", media, prodkitUserError{err.Error()}
	}
	projectID := uuid.NewString()
	if err := rehostTimelineMedia(ctx, userID, projectID, doc, media); err != nil {
		return "", media, err
	}
	if err := saveTimelineProject(userID, projectID, name, doc); err != nil {
		return "", media, err
	}
	return projectID, media, nil
}

var loadTimelineProject = func(userID, projectID string) (json.RawMessage, string, error) {
	project, err := dbConn.GetStudioProject(userID, projectID)
	if err != nil {
		return nil, "", err
	}
	return project.Document, project.Name, nil
}

func resolveTimelineProject(req *ServiceUsageRequest, user *User) error {
	params := prodkitParams(*req)
	projectID, _ := params["project_id"].(string)
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil
	}
	if params["document"] != nil {
		return fmt.Errorf("pass either document or project_id, not both")
	}
	if _, err := uuid.Parse(projectID); err != nil {
		return fmt.Errorf("invalid project_id")
	}
	raw, name, err := loadTimelineProject(user.ID, projectID)
	if err == sql.ErrNoRows {
		return fmt.Errorf("project not found")
	}
	if err != nil {
		return fmt.Errorf("could not load project")
	}
	var document map[string]interface{}
	if json.Unmarshal(raw, &document) != nil || document == nil {
		return fmt.Errorf("project document is invalid")
	}
	delete(document, "history")
	params["document"] = document
	params["project_id"] = projectID
	if _, set := params["name"]; !set {
		params["name"] = name
	}
	encoded, err := json.Marshal(params)
	if err != nil {
		return err
	}
	if len(encoded) > timelineMaxProjectParams {
		return fmt.Errorf("project document exceeds %d KB", maxStudioProjectDocumentBytes>>10)
	}
	req.Params = encoded
	return nil
}

func normalizeTimelineParams(params map[string]interface{}) error {
	if _, err := timelineSettings(params); err != nil {
		return err
	}
	if projectID, _ := params["project_id"].(string); projectID != "" {
		if _, err := uuid.Parse(projectID); err != nil {
			return fmt.Errorf("invalid project_id")
		}
	}
	if name, ok := params["name"]; ok {
		if _, isString := name.(string); !isString {
			return fmt.Errorf("name must be a string")
		}
	}
	if params["document"] == nil {
		return fmt.Errorf("timeline-render needs params.document or params.project_id")
	}
	_, err := parseTimelineDocument(timelineDocumentParam(params), timelineDocLimit(params))
	return err
}

func timelineDocLimit(params map[string]interface{}) int {
	if projectID, _ := params["project_id"].(string); projectID != "" {
		return maxStudioProjectDocumentBytes
	}
	return timelineMaxDocBytes
}

func timelineRandomToken() string {
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}

func timelineGPUModes() []string {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("PRODKIT_CHROME_GPU"))) {
	case "off", "swiftshader", "software":
		return []string{"swiftshader"}
	case "gpu", "on":
		return []string{"gpu"}
	case "vulkan":
		return []string{"vulkan", "swiftshader"}
	}
	if _, err := os.Stat("/dev/dri/renderD128"); err == nil {
		return []string{"gpu", "swiftshader"}
	}
	return []string{"swiftshader"}
}

func timelineChromeArgs(userDataDir, pageURL, gpu string) []string {
	args := []string{
		"--headless=new", "--user-data-dir=" + userDataDir, "--no-first-run", "--no-default-browser-check",
		"--disable-extensions", "--disable-sync", "--disable-background-networking", "--disable-default-apps",
		"--disable-component-update", "--disable-breakpad", "--disable-features=Translate,MediaRouter,OptimizationHints",
		"--mute-audio", "--autoplay-policy=no-user-gesture-required", "--disable-background-timer-throttling",
		"--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
		"--proxy-server=http://127.0.0.1:9", "--host-resolver-rules=MAP * ~NOTFOUND , EXCLUDE 127.0.0.1",
		"--window-size=1280,720",
	}
	switch gpu {
	case "gpu":
		args = append(args, "--enable-gpu", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=gl-egl")
	case "vulkan":
		args = append(args, "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=vulkan", "--enable-features=Vulkan")
	default:
		args = append(args, "--use-angle=swiftshader", "--enable-unsafe-swiftshader")
	}
	if os.Geteuid() == 0 || os.Getenv("PRODKIT_CHROME_NO_SANDBOX") == "1" {
		args = append(args, "--no-sandbox")
	}
	if extra := strings.Fields(os.Getenv("PRODKIT_CHROME_FLAGS")); len(extra) > 0 {
		args = append(args, extra...)
	}
	return append(args, pageURL)
}

func timelineRenderTimeout(seconds float64, width, height int) time.Duration {
	pixels := math.Max(1, float64(width*height)/(1920*1080))
	timeout := 2*time.Minute + time.Duration(seconds*12*pixels*float64(time.Second))
	if timeout > 110*time.Minute {
		timeout = 110 * time.Minute
	}
	return timeout
}

type timelineTail struct {
	mu  sync.Mutex
	buf []byte
}

func (t *timelineTail) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	if len(t.buf) > 8192 {
		t.buf = t.buf[len(t.buf)-8192:]
	}
	return len(p), nil
}

func (t *timelineTail) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(t.buf)
}

type timelineRenderError struct{ msg string }

func (e timelineRenderError) Error() string { return e.msg }

func timelineRenderHandler(token string, payload []byte, routes map[string]string, resultPath string, progress func(float64), finish func(error)) (http.Handler, error) {
	prefix := "/job/" + token + "/"
	mux := http.NewServeMux()
	mux.HandleFunc(prefix+"document", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		_, _ = w.Write(payload)
	})
	mux.HandleFunc(prefix+"media/", func(w http.ResponseWriter, r *http.Request) {
		local, ok := routes[strings.TrimPrefix(r.URL.Path, prefix+"media/")]
		if !ok || (r.Method != http.MethodGet && r.Method != http.MethodHead) {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, local)
	})
	mux.HandleFunc(prefix+"result", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		file, err := os.Create(resultPath)
		if err != nil {
			http.Error(w, "unavailable", http.StatusInternalServerError)
			finish(err)
			return
		}
		written, err := io.Copy(file, io.LimitReader(r.Body, prodkitMaxArtifact+1))
		file.Close()
		switch {
		case err != nil:
			http.Error(w, "upload failed", http.StatusBadRequest)
			finish(fmt.Errorf("render upload failed: %w", err))
		case written == 0 || written > prodkitMaxArtifact:
			http.Error(w, "invalid size", http.StatusRequestEntityTooLarge)
			finish(prodkitUserError{"the rendered video is too large"})
		default:
			w.WriteHeader(http.StatusNoContent)
			finish(nil)
		}
	})
	mux.HandleFunc(prefix+"status", func(w http.ResponseWriter, r *http.Request) {
		var status struct {
			Progress float64 `json:"progress"`
			Error    string  `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(r.Body, 8192)).Decode(&status)
		w.WriteHeader(http.StatusNoContent)
		if status.Error != "" {
			finish(timelineRenderError{truncateString(status.Error, 240)})
			return
		}
		progress(math.Max(0, math.Min(1, status.Progress)))
	})
	if origin := timelineRenderOrigin(); origin != "" {
		target, err := url.Parse(origin)
		if err != nil {
			return nil, err
		}
		mux.Handle("/", httputil.NewSingleHostReverseProxy(target))
		return mux, nil
	}
	dist, page := timelineRenderDist()
	if page == "" {
		return nil, fmt.Errorf("the render page is not built in %s", dist)
	}
	mux.HandleFunc("/studio/render", func(w http.ResponseWriter, r *http.Request) {
		http.ServeFile(w, r, page)
	})
	files := http.FileServer(http.Dir(dist))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			http.NotFound(w, r)
			return
		}
		files.ServeHTTP(w, r)
	})
	return mux, nil
}

func renderTimelineInChrome(ctx context.Context, doc *timelineDocument, files map[string]string, settings timelineRenderSettings, workDir string, progress func(float64)) (string, string, error) {
	var lastErr error
	for _, gpu := range timelineGPUModes() {
		path, err := renderTimelineAttempt(ctx, doc, files, settings, workDir, gpu, progress)
		if err == nil {
			return path, gpu, nil
		}
		lastErr = err
		var renderErr timelineRenderError
		if ctx.Err() != nil || !(errors.As(err, &renderErr) && strings.Contains(strings.ToLower(renderErr.msg), "webgl")) {
			break
		}
		log.Printf("[timeline] %s renderer failed, retrying: %v", gpu, err)
	}
	return "", "", lastErr
}

func renderTimelineAttempt(ctx context.Context, doc *timelineDocument, files map[string]string, settings timelineRenderSettings, workDir, gpu string, progress func(float64)) (string, error) {
	token := timelineRandomToken()
	renderDoc, routes, err := doc.rewriteMedia("/job/"+token+"/media/", files)
	if err != nil {
		return "", err
	}
	payload, err := json.Marshal(map[string]interface{}{"document": renderDoc, "settings": settings.page()})
	if err != nil {
		return "", err
	}
	resultPath := filepath.Join(workDir, "render-"+gpu+".bin")
	done := make(chan error, 1)
	finish := func(err error) {
		select {
		case done <- err:
		default:
		}
	}
	handler, err := timelineRenderHandler(token, payload, routes, resultPath, progress, finish)
	if err != nil {
		return "", err
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 15 * time.Second}
	go func() { _ = server.Serve(listener) }()
	defer server.Close()
	userDataDir := filepath.Join(workDir, "chrome-"+gpu)
	if err := os.MkdirAll(userDataDir, 0o700); err != nil {
		return "", err
	}
	pageURL := fmt.Sprintf("http://%s/studio/render?job=%s", listener.Addr().String(), token)
	width, height := timelineOutputSize(doc.Canvas.Width, doc.Canvas.Height, settings.Resolution)
	renderCtx, cancel := context.WithTimeout(ctx, timelineRenderTimeout(doc.Duration(), width, height))
	defer cancel()
	cmd := exec.Command(prodkitChromeBinary(), timelineChromeArgs(userDataDir, pageURL, gpu)...)
	cmd.Dir = workDir
	cmd.Env = append(prodkitCommandEnv(workDir), "XDG_CONFIG_HOME="+workDir, "XDG_CACHE_HOME="+workDir)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	tail := &timelineTail{}
	cmd.Stdout, cmd.Stderr = tail, tail
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("could not start chrome: %w", err)
	}
	exited := make(chan error, 1)
	go func() { exited <- cmd.Wait() }()
	kill := func() {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		<-exited
	}
	started := time.Now()
	select {
	case err := <-done:
		kill()
		log.Printf("[timeline] chrome %s render %.1fs for %.1fs timeline", gpu, time.Since(started).Seconds(), doc.Duration())
		if err != nil {
			return "", err
		}
		return resultPath, nil
	case err := <-exited:
		log.Printf("[timeline] chrome exited early: %v %s", err, truncateString(tail.String(), 2000))
		return "", fmt.Errorf("chrome exited before rendering: %v", err)
	case <-renderCtx.Done():
		kill()
		if ctx.Err() != nil {
			return "", ctx.Err()
		}
		log.Printf("[timeline] chrome timed out: %s", truncateString(tail.String(), 2000))
		return "", prodkitUserError{"the timeline render took too long"}
	}
}

func finishTimelineRender(ctx context.Context, raw string, settings timelineRenderSettings, workDir string) (string, string, timelineProbe, error) {
	probe, err := probeTimelineFile(ctx, raw)
	if err != nil || probe.VideoCodec == "" {
		return "", "", probe, fmt.Errorf("render produced an unreadable video")
	}
	final := filepath.Join(workDir, "timeline."+settings.Format)
	if settings.Format == "mp4" && probe.AudioCodec != "" && probe.AudioCodec != "aac" {
		cmd := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-y", "-i", raw, "-map", "0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final)
		if output, err := cmd.CombinedOutput(); err != nil {
			log.Printf("[timeline] aac remux: %v %s", err, tailOutput(output))
			return "", "", probe, fmt.Errorf("could not finish the soundtrack")
		}
	} else if err := os.Rename(raw, final); err != nil {
		return "", "", probe, err
	}
	poster := filepath.Join(workDir, "poster.jpg")
	at := math.Min(1, probe.Duration/3)
	cmd := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-y", "-ss", strconv.FormatFloat(at, 'f', 3, 64), "-i", final, "-frames:v", "1", "-q:v", "3", poster)
	if output, err := cmd.CombinedOutput(); err != nil {
		log.Printf("[timeline] poster: %v %s", err, tailOutput(output))
		poster = ""
	}
	return final, poster, probe, nil
}

func runProdkitTimeline(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string, setStage func(string)) (map[string]interface{}, float64, float64, error) {
	params := prodkitParams(req)
	settings, err := timelineSettings(params)
	if err != nil {
		return nil, 0, 0, prodkitUserError{err.Error()}
	}
	doc, err := parseTimelineDocument(timelineDocumentParam(params), timelineDocLimit(params))
	if err != nil {
		return nil, 0, 0, prodkitUserError{err.Error()}
	}
	projectID, _ := params["project_id"].(string)
	var media timelineMedia
	setStage("downloading media")
	if projectID == "" {
		projectID, media, err = importTimelineDocument(ctx, job.UserID, doc, timelineProjectName(params), workDir, true)
		if err != nil {
			return nil, 0, 0, err
		}
	} else {
		if media, err = fetchTimelineMedia(ctx, doc, workDir, true); err != nil {
			return nil, 0, 0, err
		}
		if err := resolveTimelineLUTs(ctx, doc, workDir); err != nil {
			return nil, 0, 0, err
		}
		if err := doc.finalize(media.lookup); err != nil {
			return nil, 0, 0, prodkitUserError{err.Error()}
		}
	}
	setStage("waiting for renderer")
	release, err := acquireProdkitSlot(ctx, "chrome")
	if err != nil {
		return nil, 0, 0, err
	}
	defer release()
	setStage("rendering")
	started := time.Now()
	lastStage := ""
	raw, gpu, err := renderTimelineInChrome(ctx, doc, media.Paths, settings, workDir, func(value float64) {
		stage := fmt.Sprintf("rendering %d%%", int(value*10)*10)
		if stage != lastStage {
			lastStage = stage
			setStage(stage)
		}
	})
	if err != nil {
		var renderErr timelineRenderError
		if errors.As(err, &renderErr) {
			return nil, 0, 0, prodkitUserError{"render failed: " + renderErr.msg}
		}
		return nil, 0, 0, err
	}
	renderSeconds := time.Since(started).Seconds()
	setStage("encoding")
	final, poster, probe, err := finishTimelineRender(ctx, raw, settings, workDir)
	if err != nil {
		return nil, 0, 0, err
	}
	setStage("uploading")
	contentType := "video/mp4"
	if settings.Format == "webm" {
		contentType = "video/webm"
	}
	videoURL, err := uploadProdkitFile(ctx, final, job.UserID, contentType)
	if err != nil {
		return nil, 0, 0, err
	}
	result := map[string]interface{}{
		"video_url": videoURL, "studio_url": timelineStudioURL(projectID), "project_id": projectID,
		"duration_seconds": math.Round(probe.Duration*1000) / 1000, "width": probe.Width, "height": probe.Height,
		"fps": settings.FPS, "format": settings.Format, "render_seconds": math.Round(renderSeconds*10) / 10, "renderer": gpu,
	}
	if poster != "" {
		if posterURL, err := uploadProdkitFile(ctx, poster, job.UserID, "image/jpeg"); err == nil {
			result["poster_url"] = posterURL
		}
	}
	return result, timelinePriceUSD(probe.Duration, probe.Width, probe.Height), renderSeconds * prodkitGPUUSDPerSecond, nil
}

func handleStudioSchema(ctx *fasthttp.RequestCtx) {
	ctx.Response.Header.Set("Cache-Control", "public, max-age=300")
	ctx.SetContentType("application/json")
	ctx.SetStatusCode(http.StatusOK)
	ctx.SetBody(studioSchemaJSON)
}

func handleStudioProjectImport(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	if len(ctx.PostBody()) > timelineMaxParams {
		jsonError(ctx, http.StatusRequestEntityTooLarge, fmt.Sprintf("document exceeds %d KB", timelineMaxDocBytes>>10))
		return
	}
	var input struct {
		Name     string          `json:"name"`
		Document json.RawMessage `json:"document"`
	}
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	doc, err := parseTimelineDocument(input.Document, timelineMaxDocBytes)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	work, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	release, err := acquireProdkitSlot(work, "local")
	if err != nil {
		jsonError(ctx, http.StatusServiceUnavailable, err.Error())
		return
	}
	defer release()
	workDir, err := os.MkdirTemp("", "timeline-import-*")
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not allocate a work directory")
		return
	}
	defer os.RemoveAll(workDir)
	projectID, _, err := importTimelineDocument(work, user.ID, doc, timelineProjectName(map[string]interface{}{"name": input.Name}), workDir, false)
	if err != nil {
		var userErr prodkitUserError
		if errors.As(err, &userErr) {
			jsonError(ctx, http.StatusBadRequest, userErr.msg)
			return
		}
		log.Printf("[timeline] import for %s failed: %v", user.ID, err)
		jsonError(ctx, http.StatusInternalServerError, "could not create the Studio project")
		return
	}
	response := doc.summary()
	response["project_id"], response["studio_url"] = projectID, timelineStudioURL(projectID)
	jsonResponse(ctx, http.StatusOK, response)
}
