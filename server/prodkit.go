package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/valyala/fasthttp"
)

const (
	prodkitDestruction  = "prodkit_destruction"
	prodkitExploded     = "prodkit_exploded_view"
	prodkitToon         = "prodkit_toon_shader"
	prodkitScene        = "prodkit_scene"
	prodkitImageTo3D    = "prodkit_image_to_3d"
	prodkitVectorize    = "prodkit_vectorize"
	prodkitShotCleanup  = "prodkit_shot_cleanup"
	prodkitMaxParams    = 64 << 10
	prodkitMaxModel     = 200 << 20
	prodkitMaxImage     = 25 << 20
	prodkitMaxVideo     = 300 << 20
	prodkitMaxArtifact  = 400 << 20
	prodkitEraserUSDSec = 0.24
	prodkitEraserMaxSec = 30.0
	prodkitEraserChunk  = 4.8
	prodkitEraserFade   = 0.3

	prodkitGPUUSDPerSecond = 0.0003
)

type prodkitTool struct {
	Service string
	Public  string
	Title   string
	Engine  string
	BaseUSD float64
	Unit    string
	Params  []string
}

var prodkitTools = []prodkitTool{
	{prodkitDestruction, "destruction-studio", "Destruction Studio", "blender", 0.40, "per simulated destruction shot with editable .blend; +$0.06 when a photo is turned into 3D first, +$0.20 at high quality",
		[]string{"subject", "text", "pieces", "material", "impact", "slowmo", "dust", "duration", "fps", "aspect", "quality", "seed", "background"}},
	{prodkitExploded, "exploded-view", "Exploded View", "blender", 0.40, "per exploded or assembly animation with editable .blend; +$0.06 for photo to 3D, +$0.20 at high quality",
		[]string{"mode", "split", "axis", "spread", "stagger", "turntable", "guides", "duration", "fps", "aspect", "quality", "seed", "background", "demo"}},
	{prodkitToon, "toon-shader", "Toon Shader", "blender", 0.30, "per toon-shaded turntable with editable materials; +$0.06 for photo to 3D, +$0.20 at high quality",
		[]string{"style", "bands", "outline_width", "outline_color", "rim", "palette", "turntable", "duration", "fps", "aspect", "quality", "seed", "background", "demo"}},
	{prodkitScene, "blender-scene", "Blender Scene", "blender", 0.30, "per rendered scene spec with editable .blend (remote Blender); +$0.20 at high quality",
		[]string{"spec", "duration", "fps", "aspect", "quality", "seed", "background"}},
	{prodkitImageTo3D, "image-to-3d", "Image to 3D", "fal3d", 0.06, "per textured GLB from one photo; $0.45 at high quality", []string{"quality"}},
	{prodkitVectorize, "vectorize", "Vectorize", "vector", 0.02, "per layered SVG; $0.03 with the AI tracer", []string{"mode", "colors", "detail", "corners", "smooth", "engine"}},
	{prodkitShotCleanup, "shot-cleanup", "Shot Cleanup", "eraser", prodkitEraserUSDSec, "per second of video (max 30 s) with objects removed",
		[]string{"points", "keep_audio"}},
}

func prodkitToolFor(service string) (prodkitTool, bool) {
	for _, tool := range prodkitTools {
		if tool.Service == service {
			return tool, true
		}
	}
	return prodkitTool{}, false
}

func isProdkitService(service string) bool {
	_, ok := prodkitToolFor(service)
	return ok
}

func prodkitParams(req ServiceUsageRequest) map[string]interface{} {
	params := map[string]interface{}{}
	if len(req.Params) > 0 {
		_ = json.Unmarshal(req.Params, &params)
	}
	return params
}

func prodkitString(params map[string]interface{}, key string) string {
	value, _ := params[key].(string)
	return strings.ToLower(strings.TrimSpace(value))
}

func prodkitNumber(params map[string]interface{}, key string, fallback, lo, hi float64) float64 {
	value, ok := params[key].(float64)
	if !ok || math.IsNaN(value) || math.IsInf(value, 0) {
		return fallback
	}
	return math.Max(lo, math.Min(hi, value))
}

func prodkitHighQuality(req ServiceUsageRequest) bool {
	return prodkitString(prodkitParams(req), "quality") == "high"
}

func prodkitNeeds3D(req ServiceUsageRequest) bool {
	tool, _ := prodkitToolFor(req.Service)
	return tool.Engine == "blender" && req.Service != prodkitScene && strings.TrimSpace(req.ModelURL) == "" && strings.TrimSpace(req.ImageURL) != ""
}

func prodkitPriceUSD(req ServiceUsageRequest) float64 {
	tool, ok := prodkitToolFor(req.Service)
	if !ok {
		return 0
	}
	switch tool.Engine {
	case "blender":
		price := tool.BaseUSD
		if prodkitNeeds3D(req) {
			price += 0.06
		}
		if prodkitHighQuality(req) {
			price += 0.20
		}
		return price
	case "fal3d":
		if prodkitHighQuality(req) {
			return 0.45
		}
		return tool.BaseUSD
	case "vector":
		if prodkitString(prodkitParams(req), "engine") == "ai" {
			return 0.03
		}
		return tool.BaseUSD
	case "eraser":
		seconds := float64(req.Duration)
		if seconds <= 0 {
			seconds = 5
		}
		return prodkitEraserUSDSec * math.Ceil(math.Min(seconds, prodkitEraserMaxSec))
	}
	return 0
}

func prodkitCredits(usd float64) float64 {
	price := getCUTEPriceUSD()
	if price <= 0 || usd <= 0 {
		return 0
	}
	return math.Ceil(usd / price)
}

var prodkitModelExt = map[string]bool{".glb": true, ".obj": true, ".fbx": true, ".stl": true, ".ply": true}

func normalizeProdkitRequest(req *ServiceUsageRequest) error {
	tool, ok := prodkitToolFor(req.Service)
	if !ok {
		return fmt.Errorf("unknown production tool")
	}
	if len(req.Params) > prodkitMaxParams {
		return fmt.Errorf("params exceed 64 KiB")
	}
	params := map[string]interface{}{}
	if len(bytes.TrimSpace(req.Params)) > 0 {
		if err := json.Unmarshal(req.Params, &params); err != nil {
			return fmt.Errorf("params must be a JSON object")
		}
	}
	allowed := map[string]bool{}
	for _, key := range tool.Params {
		allowed[key] = true
	}
	for key := range params {
		if !allowed[key] {
			return fmt.Errorf("unknown %s param %q", tool.Public, key)
		}
	}
	for _, field := range []*string{&req.ImageURL, &req.ModelURL, &req.VideoURL} {
		*field = strings.TrimSpace(*field)
		if *field != "" {
			if err := validateProdkitURL(*field); err != nil {
				return err
			}
		}
	}
	if len(req.ModelURLs) > 16 {
		return fmt.Errorf("at most 16 model_urls")
	}
	for i := range req.ModelURLs {
		req.ModelURLs[i] = strings.TrimSpace(req.ModelURLs[i])
		if err := validateProdkitURL(req.ModelURLs[i]); err != nil {
			return err
		}
		if !prodkitModelExt[prodkitURLExt(req.ModelURLs[i])] {
			return fmt.Errorf("model_urls must end in .glb, .obj, .fbx, .stl or .ply")
		}
	}
	if req.ModelURL != "" && !prodkitModelExt[prodkitURLExt(req.ModelURL)] {
		return fmt.Errorf("model_url must end in .glb, .obj, .fbx, .stl or .ply")
	}
	switch tool.Engine {
	case "blender":
		if req.Service == prodkitScene {
			spec, ok := params["spec"].(map[string]interface{})
			if !ok {
				return fmt.Errorf("blender-scene needs params.spec")
			}
			objects, _ := spec["objects"].([]interface{})
			if len(objects) == 0 || len(objects) > 64 {
				return fmt.Errorf("params.spec.objects must hold 1-64 objects")
			}
		}
		if req.Service == prodkitDestruction && req.ModelURL == "" && req.ImageURL == "" {
			if subject := prodkitString(params, "subject"); subject == "text" && prodkitString(params, "text") == "" {
				return fmt.Errorf("subject text needs params.text")
			}
		}
	case "fal3d":
		if req.ImageURL == "" {
			return fmt.Errorf("image_url is required")
		}
	case "vector":
		if req.ImageURL == "" {
			return fmt.Errorf("image_url is required")
		}
	case "eraser":
		if req.VideoURL == "" {
			return fmt.Errorf("video_url is required")
		}
		points, _ := params["points"].([]interface{})
		req.Prompt = strings.TrimSpace(req.Prompt)
		if req.Prompt == "" && len(points) == 0 {
			return fmt.Errorf("describe what to remove in prompt (e.g. \"person\") or pass params.points")
		}
		if len(points) > 12 {
			return fmt.Errorf("at most 12 points")
		}
		if len(req.Prompt) > 120 {
			return fmt.Errorf("prompt must be a short object name")
		}
		if req.Duration <= 0 || req.Duration > int(prodkitEraserMaxSec) {
			req.Duration = int(prodkitEraserMaxSec)
		}
	}
	return nil
}

func prodkitURLExt(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	return strings.ToLower(filepath.Ext(parsed.Path))
}

func validateProdkitURL(value string) error {
	parsed, err := url.Parse(value)
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.User != nil || parsed.Hostname() == "" {
		return fmt.Errorf("media URLs must be public http(s) URLs")
	}
	host := strings.ToLower(parsed.Hostname())
	if host == "localhost" || strings.HasSuffix(host, ".local") || strings.HasSuffix(host, ".internal") {
		return fmt.Errorf("media URLs must be public http(s) URLs")
	}
	if ip := net.ParseIP(host); ip != nil && !prodkitPublicIP(ip) {
		return fmt.Errorf("media URLs must be public http(s) URLs")
	}
	return nil
}

func prodkitPublicIP(ip net.IP) bool {
	return ip.IsGlobalUnicast() && !ip.IsPrivate() && !ip.IsLoopback() && !ip.IsLinkLocalUnicast() && !ip.IsUnspecified()
}

var prodkitDownloadClient = &http.Client{
	Timeout: 5 * time.Minute,
	Transport: &http.Transport{
		Proxy: nil,
		DialContext: (&net.Dialer{
			Timeout: 15 * time.Second,
			Control: func(network, address string, _ syscall.RawConn) error {
				host, _, err := net.SplitHostPort(address)
				if err != nil {
					return err
				}
				if ip := net.ParseIP(host); ip == nil || !prodkitPublicIP(ip) {
					return fmt.Errorf("refusing to fetch from a private address")
				}
				return nil
			},
		}).DialContext,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
	},
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 5 {
			return fmt.Errorf("too many redirects")
		}
		return validateProdkitURL(req.URL.String())
	},
}

var prodkitTrustedFetch = func(raw string) bool {
	parsed, err := url.Parse(raw)
	return err == nil && parsed.Scheme == "https" && (parsed.Hostname() == r2PublicHost || strings.HasSuffix(parsed.Hostname(), ".fal.media"))
}

func prodkitDownload(ctx context.Context, raw, dest string, limit int64) error {
	if err := validateProdkitURL(raw); err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return err
	}
	client := prodkitDownloadClient
	if prodkitTrustedFetch(raw) {
		client = backendClient
	}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("could not fetch %s", truncateString(raw, 120))
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("fetching %s returned %d", truncateString(raw, 120), resp.StatusCode)
	}
	file, err := os.Create(dest)
	if err != nil {
		return err
	}
	defer file.Close()
	written, err := io.Copy(file, io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return err
	}
	if written == 0 {
		return fmt.Errorf("%s is empty", truncateString(raw, 120))
	}
	if written > limit {
		return fmt.Errorf("%s exceeds the %d MiB limit", truncateString(raw, 120), limit>>20)
	}
	return nil
}

type prodkitStored struct {
	Request ServiceUsageRequest `json:"request"`
	Stage   string              `json:"stage,omitempty"`
}

type prodkitEnvelope struct {
	Prodkit  prodkitStored `json:"_prodkit"`
	Attempts int           `json:"_attempts,omitempty"`
	Stage    string        `json:"stage,omitempty"`
}

func prodkitUsesPaidProvider(req ServiceUsageRequest) bool {
	tool, _ := prodkitToolFor(req.Service)
	switch tool.Engine {
	case "fal3d", "eraser":
		return true
	case "vector":
		return prodkitString(prodkitParams(req), "engine") == "ai"
	}
	return prodkitNeeds3D(req)
}

func handleProdkitService(ctx *fasthttp.RequestCtx, req ServiceUsageRequest, user *User) {
	if user == nil {
		jsonError(ctx, http.StatusUnauthorized, "authorization required")
		return
	}
	if err := normalizeProdkitRequest(&req); err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	tool, _ := prodkitToolFor(req.Service)
	if tool.Engine == "blender" && prodkitBlenderBinary() == "" {
		jsonError(ctx, http.StatusServiceUnavailable, tool.Title+" is not available on this server")
		return
	}
	estimateUSD := prodkitPriceUSD(req)
	credits := prodkitCredits(estimateUSD)
	if credits <= 0 {
		jsonError(ctx, http.StatusServiceUnavailable, "credit pricing is temporarily unavailable")
		return
	}
	if !user.UnlimitedAPI && user.Credits+1e-9 < credits {
		jsonError(ctx, http.StatusPaymentRequired, fmt.Sprintf("insufficient credits: need %.0f credits ($%.2f), have %.2f", credits, estimateUSD, user.Credits))
		return
	}
	req.WalletAddress = ""
	job, err := dbConn.CreateVideoJobForService(user.ID, "pipeline:prodkit", req.Service, prodkitJobPrompt(req, tool))
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to create job")
		return
	}
	stored, _ := json.Marshal(prodkitEnvelope{Prodkit: prodkitStored{Request: req}, Stage: "queued"})
	if err := dbConn.UpdateVideoJob(job.ID, "queued", stored, ""); err != nil {
		jsonError(ctx, http.StatusInternalServerError, "failed to persist job")
		return
	}
	launchVideoJob(job.ID)
	response := map[string]interface{}{
		"service":            tool.Public,
		"result":             map[string]interface{}{"job_id": job.ID, "status": "queued", "status_url": "/api/video-jobs/" + job.ID},
		"estimated_cost_usd": estimateUSD, "estimated_credits": credits,
		"settlement": "charged only when the job completes",
	}
	if tool.Engine == "vector" || tool.Engine == "fal3d" {
		if done := waitProdkitJob(job.ID, 40*time.Second); done != nil {
			response["result"] = done
		}
	}
	jsonResponse(ctx, http.StatusAccepted, response)
}

func prodkitJobPrompt(req ServiceUsageRequest, tool prodkitTool) string {
	if prompt := strings.TrimSpace(req.Prompt); prompt != "" {
		return truncateString(prompt, 300)
	}
	return tool.Title
}

var waitProdkitJob = func(jobID string, timeout time.Duration) map[string]interface{} {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		time.Sleep(700 * time.Millisecond)
		job, err := dbConn.GetVideoJobInternal(jobID)
		if err != nil {
			return nil
		}
		switch job.Status {
		case "completed":
			result := map[string]interface{}{}
			_ = json.Unmarshal(job.Result, &result)
			for key := range result {
				if strings.HasPrefix(key, "_") || key == "provider_cost_usd" {
					delete(result, key)
				}
			}
			result["job_id"], result["status"] = job.ID, job.Status
			return result
		case "failed", "payment_required":
			return map[string]interface{}{"job_id": job.ID, "status": job.Status, "error": job.Error}
		}
	}
	return nil
}

func processProdkitJob(job *VideoJob) {
	var envelope prodkitEnvelope
	if json.Unmarshal(job.Result, &envelope) != nil || normalizeProdkitRequest(&envelope.Prodkit.Request) != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "saved request is invalid")
		return
	}
	req := envelope.Prodkit.Request
	tool, _ := prodkitToolFor(req.Service)
	if envelope.Attempts > 0 && (prodkitUsesPaidProvider(req) || envelope.Attempts > 1) {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "the job was interrupted by a server restart; you were not charged")
		return
	}
	envelope.Attempts++
	setStage := func(stage string) {
		envelope.Stage = stage
		payload, _ := json.Marshal(envelope)
		_ = dbConn.UpdateVideoJob(job.ID, "processing", payload, "")
	}
	setStage("starting")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	go func() {
		ticker := time.NewTicker(3 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if videoJobCancellationRequested(job.ID) {
					cancel()
					return
				}
			}
		}
	}()
	workDir, err := os.MkdirTemp("", "prodkit-*")
	if err != nil {
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, "could not allocate a work directory")
		return
	}
	defer os.RemoveAll(workDir)
	var result map[string]interface{}
	var providerUSD, chargedUSD float64
	switch tool.Engine {
	case "blender":
		result, providerUSD, err = runProdkitBlender(ctx, job, req, tool, workDir, setStage)
		chargedUSD = prodkitPriceUSD(req)
	case "fal3d":
		result, providerUSD, err = runProdkitImageTo3D(ctx, job, req, workDir)
		chargedUSD = prodkitPriceUSD(req)
	case "vector":
		result, providerUSD, err = runProdkitVectorize(ctx, job, req, workDir)
		chargedUSD = prodkitPriceUSD(req)
	case "eraser":
		var seconds float64
		result, seconds, providerUSD, err = runProdkitShotCleanup(ctx, job, req, workDir, setStage)
		chargedUSD = prodkitEraserUSDSec * math.Ceil(seconds)
	default:
		err = fmt.Errorf("unsupported engine")
	}
	if ctx.Err() != nil && videoJobCancellationRequested(job.ID) {
		return
	}
	if err != nil {
		log.Printf("[prodkit] job=%s service=%s failed: %v", job.ID, req.Service, err)
		_ = dbConn.UpdateVideoJob(job.ID, "failed", nil, prodkitPublicError(err))
		return
	}
	providerUSD = math.Max(providerUSD, 0.001)
	cutePrice := getCUTEPriceUSD()
	if cutePrice <= 0 || chargedUSD <= 0 {
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "credit pricing unavailable; retry status")
		return
	}
	result["service"] = tool.Public
	result["charged_usd"] = chargedUSD
	result["credits_used"] = chargedUSD / cutePrice
	result["provider_cost_usd"] = providerUSD
	payload, _ := json.Marshal(result)
	if _, _, err := dbConn.SettleGeneratedVideoJob(job.ID, payload, providerUSD, chargedUSD, cutePrice); err != nil {
		if err == ErrVideoPaymentRequired {
			_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, fmt.Sprintf("top up to release the result; $%.2f required", chargedUSD))
			return
		}
		_ = dbConn.UpdateVideoJob(job.ID, "payment_required", nil, "settlement unavailable; retry status")
		return
	}
	maybeTriggerAutoTopup(job.UserID)
}

type prodkitUserError struct{ msg string }

func (e prodkitUserError) Error() string { return e.msg }

func prodkitPublicError(err error) string {
	var userErr prodkitUserError
	if errors.As(err, &userErr) {
		return userErr.msg
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "the job did not finish in time"
	}
	return "the job failed; you were not charged"
}

var prodkitSlots = struct {
	once    sync.Once
	blender chan struct{}
	local   chan struct{}
}{}

func prodkitSlot(kind string) chan struct{} {
	prodkitSlots.once.Do(func() {
		blender, _ := strconv.Atoi(getEnv("PRODKIT_BLENDER_SLOTS", "1"))
		if blender < 1 {
			blender = 1
		}
		prodkitSlots.blender = make(chan struct{}, blender)
		prodkitSlots.local = make(chan struct{}, 4)
	})
	if kind == "blender" {
		return prodkitSlots.blender
	}
	return prodkitSlots.local
}

func acquireProdkitSlot(ctx context.Context, kind string) (func(), error) {
	slot := prodkitSlot(kind)
	select {
	case slot <- struct{}{}:
		return func() { <-slot }, nil
	case <-ctx.Done():
		return nil, prodkitUserError{"the render queue is busy; try again shortly"}
	}
}

func prodkitBlenderBinary() string {
	if bin := strings.TrimSpace(os.Getenv("PRODKIT_BLENDER")); bin != "" {
		return bin
	}
	if path, err := exec.LookPath("blender"); err == nil {
		return path
	}
	return ""
}

func prodkitDir() string {
	if dir := strings.TrimSpace(os.Getenv("PRODKIT_DIR")); dir != "" {
		return dir
	}
	for _, dir := range []string{"workers/prodkit", "../workers/prodkit"} {
		if _, err := os.Stat(filepath.Join(dir, "run_blender.py")); err == nil {
			abs, _ := filepath.Abs(dir)
			return abs
		}
	}
	return "workers/prodkit"
}

func prodkitCommandEnv(workDir string) []string {
	env := []string{"HOME=" + workDir, "TMPDIR=" + workDir, "PATH=/usr/local/bin:/usr/bin:/bin", "FFMPEG_BIN=" + ffmpegBinary()}
	for _, key := range []string{"LD_LIBRARY_PATH", "CUDA_VISIBLE_DEVICES", "NVIDIA_VISIBLE_DEVICES", "PRODKIT_ENGINE"} {
		if value := os.Getenv(key); value != "" {
			env = append(env, key+"="+value)
		}
	}
	return env
}

type prodkitManifest struct {
	OK            bool                   `json:"ok"`
	Error         string                 `json:"error"`
	Video         string                 `json:"video"`
	Poster        string                 `json:"poster"`
	Blend         string                 `json:"blend"`
	GLB           string                 `json:"glb"`
	Width         int                    `json:"width"`
	Height        int                    `json:"height"`
	FPS           float64                `json:"fps"`
	Frames        int                    `json:"frames"`
	Seconds       float64                `json:"seconds"`
	Device        string                 `json:"device"`
	RenderSeconds float64                `json:"render_seconds"`
	Stats         map[string]interface{} `json:"stats"`
}

func runProdkitBlender(ctx context.Context, job *VideoJob, req ServiceUsageRequest, tool prodkitTool, workDir string, setStage func(string)) (map[string]interface{}, float64, error) {
	inputs := map[string]interface{}{}
	providerUSD := 0.0
	sourceModelURL := ""
	switch {
	case req.ModelURL != "":
		path := filepath.Join(workDir, "input"+prodkitURLExt(req.ModelURL))
		setStage("downloading")
		if err := prodkitDownload(ctx, req.ModelURL, path, prodkitMaxModel); err != nil {
			return nil, 0, prodkitUserError{err.Error()}
		}
		inputs["model_path"] = path
	case req.Service != prodkitScene && req.ImageURL != "":
		setStage("building 3D model")
		glbURL, cost, err := prodkitGenerateGLB(ctx, req.ImageURL, false)
		if err != nil {
			return nil, 0, err
		}
		providerUSD += cost
		sourceModelURL = glbURL
		path := filepath.Join(workDir, "input.glb")
		if err := prodkitDownload(ctx, glbURL, path, prodkitMaxModel); err != nil {
			return nil, 0, err
		}
		inputs["model_path"] = path
	}
	if len(req.ModelURLs) > 0 {
		paths := []string{}
		for i, raw := range req.ModelURLs {
			path := filepath.Join(workDir, fmt.Sprintf("model%d%s", i, prodkitURLExt(raw)))
			if err := prodkitDownload(ctx, raw, path, prodkitMaxModel); err != nil {
				return nil, 0, prodkitUserError{err.Error()}
			}
			paths = append(paths, path)
		}
		inputs["model_paths"] = paths
	}
	setStage("waiting for renderer")
	release, err := acquireProdkitSlot(ctx, "blender")
	if err != nil {
		return nil, 0, err
	}
	defer release()
	setStage("simulating and rendering")
	outDir := filepath.Join(workDir, "out")
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return nil, 0, err
	}
	recipe := strings.TrimPrefix(req.Service, "prodkit_")
	if recipe == "toon_shader" || recipe == "exploded_view" || recipe == "destruction" || recipe == "scene" {
		params := prodkitParams(req)
		if _, set := params["duration"]; !set && req.Duration > 0 {
			params["duration"] = req.Duration
		}
		args, _ := json.Marshal(map[string]interface{}{"recipe": recipe, "out": outDir, "params": params, "inputs": inputs})
		argsPath := filepath.Join(workDir, "args.json")
		if err := os.WriteFile(argsPath, args, 0o600); err != nil {
			return nil, 0, err
		}
		renderCtx, cancel := context.WithTimeout(ctx, 12*time.Minute)
		defer cancel()
		cmd := exec.CommandContext(renderCtx, prodkitBlenderBinary(), "-b", "--factory-startup", "-noaudio", "-P", filepath.Join(prodkitDir(), "run_blender.py"), "--", argsPath)
		cmd.Dir = workDir
		cmd.Env = prodkitCommandEnv(workDir)
		cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
		cmd.Cancel = func() error { return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL) }
		started := time.Now()
		output, runErr := cmd.CombinedOutput()
		log.Printf("[prodkit] job=%s recipe=%s blender %.1fs", job.ID, recipe, time.Since(started).Seconds())
		var manifest prodkitManifest
		manifestBytes, readErr := os.ReadFile(filepath.Join(outDir, "manifest.json"))
		if readErr == nil {
			_ = json.Unmarshal(manifestBytes, &manifest)
		}
		if runErr != nil || !manifest.OK {
			log.Printf("[prodkit] job=%s blender error: %v %s", job.ID, runErr, tailOutput(output))
			if manifest.Error != "" {
				return nil, 0, prodkitUserError{truncateString(manifest.Error, 200)}
			}
			if renderCtx.Err() != nil {
				return nil, 0, prodkitUserError{"the render took too long; try draft quality or fewer pieces"}
			}
			return nil, 0, fmt.Errorf("blender failed: %v", runErr)
		}
		setStage("uploading")
		result := map[string]interface{}{
			"recipe": recipe, "width": manifest.Width, "height": manifest.Height, "fps": manifest.FPS,
			"frames": manifest.Frames, "duration_seconds": manifest.Seconds, "render_seconds": manifest.RenderSeconds,
		}
		uploads := []struct{ key, file, contentType string }{
			{"video_url", manifest.Video, "video/mp4"}, {"poster_url", manifest.Poster, "image/jpeg"},
			{"blend_url", manifest.Blend, "application/x-blender"}, {"glb_url", manifest.GLB, "model/gltf-binary"},
		}
		for _, upload := range uploads {
			if upload.file == "" {
				continue
			}
			path := filepath.Join(outDir, filepath.Base(upload.file))
			publicURL, err := uploadProdkitFile(ctx, path, job.UserID, upload.contentType)
			if err != nil {
				return nil, 0, err
			}
			result[upload.key] = publicURL
		}
		if result["video_url"] == nil {
			return nil, 0, fmt.Errorf("render produced no video")
		}
		if sourceModelURL != "" {
			result["source_model_url"] = sourceModelURL
		}
		if len(manifest.Stats) > 0 {
			result["stats"] = manifest.Stats
		}
		providerUSD += manifest.RenderSeconds * prodkitGPUUSDPerSecond
		return result, providerUSD, nil
	}
	return nil, 0, fmt.Errorf("unknown recipe")
}

var prodkitGenerateGLB = func(ctx context.Context, imageURL string, high bool) (string, float64, error) {
	model, cost, key := "fal-ai/trellis", 0.02, "model_mesh"
	payload := map[string]interface{}{"image_url": imageURL}
	if high {
		model, cost, key = "fal-ai/trellis-2", 0.30, "model_glb"
		payload["resolution"] = "1024"
	}
	body, err := runFalQueuedJobWithin(ctx, model, payload, 6*time.Minute)
	if err != nil {
		log.Printf("[prodkit] image to 3D failed: %v", err)
		return "", 0, prodkitUserError{"could not build a 3D model from that image"}
	}
	var out map[string]struct {
		URL string `json:"url"`
	}
	_ = json.Unmarshal(body, &out)
	if out[key].URL == "" {
		return "", 0, prodkitUserError{"the 3D model service returned no mesh"}
	}
	return out[key].URL, cost, nil
}

func runProdkitImageTo3D(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string) (map[string]interface{}, float64, error) {
	glbURL, cost, err := prodkitGenerateGLB(ctx, req.ImageURL, prodkitHighQuality(req))
	if err != nil {
		return nil, 0, err
	}
	path := filepath.Join(workDir, "model.glb")
	if err := prodkitDownload(ctx, glbURL, path, prodkitMaxModel); err != nil {
		return nil, 0, err
	}
	publicURL, err := uploadProdkitFile(ctx, path, job.UserID, "model/gltf-binary")
	if err != nil {
		return nil, 0, err
	}
	return map[string]interface{}{"glb_url": publicURL, "image_url": req.ImageURL}, cost, nil
}

func prodkitVtracerBinary() string {
	if bin := strings.TrimSpace(os.Getenv("PRODKIT_VTRACER")); bin != "" {
		return bin
	}
	if path, err := exec.LookPath("vtracer"); err == nil {
		return path
	}
	return ""
}

func runProdkitVectorize(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string) (map[string]interface{}, float64, error) {
	params := prodkitParams(req)
	providerUSD := 0.0
	var svg []byte
	if prodkitString(params, "engine") == "ai" {
		body, err := runFalQueuedJobWithin(ctx, "fal-ai/recraft/vectorize", map[string]interface{}{"image_url": req.ImageURL}, 2*time.Minute)
		if err != nil {
			return nil, 0, prodkitUserError{"the AI tracer could not vectorize that image"}
		}
		var out struct {
			Image struct {
				URL string `json:"url"`
			} `json:"image"`
		}
		_ = json.Unmarshal(body, &out)
		path := filepath.Join(workDir, "ai.svg")
		if out.Image.URL == "" || prodkitDownload(ctx, out.Image.URL, path, prodkitMaxImage) != nil {
			return nil, 0, prodkitUserError{"the AI tracer returned no SVG"}
		}
		svg, _ = os.ReadFile(path)
		providerUSD = 0.01
	} else {
		raw := filepath.Join(workDir, "source")
		if err := prodkitDownload(ctx, req.ImageURL, raw, prodkitMaxImage); err != nil {
			return nil, 0, prodkitUserError{err.Error()}
		}
		traced, err := traceProdkitImage(ctx, params, raw, workDir)
		if err != nil {
			return nil, 0, err
		}
		svg = traced
	}
	layered, stats, err := layerProdkitSVG(svg, prodkitString(params, "engine") != "ai")
	if err != nil {
		return nil, 0, prodkitUserError{err.Error()}
	}
	path := filepath.Join(workDir, "vector.svg")
	if err := os.WriteFile(path, layered, 0o644); err != nil {
		return nil, 0, err
	}
	publicURL, err := uploadProdkitFile(ctx, path, job.UserID, "image/svg+xml")
	if err != nil {
		return nil, 0, err
	}
	result := map[string]interface{}{"svg_url": publicURL, "image_url": req.ImageURL}
	for key, value := range stats {
		result[key] = value
	}
	return result, providerUSD, nil
}

func traceProdkitImage(ctx context.Context, params map[string]interface{}, raw, workDir string) ([]byte, error) {
	if prodkitVtracerBinary() == "" {
		return nil, fmt.Errorf("vtracer is not installed")
	}
	release, err := acquireProdkitSlot(ctx, "local")
	if err != nil {
		return nil, err
	}
	defer release()
	input := filepath.Join(workDir, "source.png")
	maxSide := 2048
	convert := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-y", "-i", raw, "-frames:v", "1",
		"-vf", fmt.Sprintf("scale='min(%d,iw)':'min(%d,ih)':force_original_aspect_ratio=decrease", maxSide, maxSide), input)
	if output, err := convert.CombinedOutput(); err != nil {
		log.Printf("[prodkit] vectorize decode: %v %s", err, tailOutput(output))
		return nil, prodkitUserError{"that file is not a readable image"}
	}
	output := filepath.Join(workDir, "out.svg")
	args := prodkitVtracerArgs(params, input, output)
	vctx, cancel := context.WithTimeout(ctx, 90*time.Second)
	defer cancel()
	cmd := exec.CommandContext(vctx, prodkitVtracerBinary(), args...)
	cmd.Env = prodkitCommandEnv(workDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		log.Printf("[prodkit] vtracer: %v %s", err, tailOutput(out))
		return nil, prodkitUserError{"tracing failed; try fewer colors or less detail"}
	}
	return os.ReadFile(output)
}

func prodkitVtracerArgs(params map[string]interface{}, input, output string) []string {
	args := []string{"--input", input, "--output", output}
	mode := prodkitString(params, "mode")
	colors := int(prodkitNumber(params, "colors", 6, 2, 8))
	detail := prodkitNumber(params, "detail", 0.5, 0, 1)
	corners := prodkitNumber(params, "corners", 60, 0, 180)
	smooth := prodkitString(params, "smooth")
	switch mode {
	case "bw", "lineart":
		args = append(args, "--colormode", "bw")
	default:
		args = append(args, "--colormode", "color", "--hierarchical", "cutout", "--color_precision", strconv.Itoa(colors))
		if mode == "poster" {
			args = append(args, "--gradient_step", "32")
		} else {
			args = append(args, "--gradient_step", "16")
		}
	}
	curve := "spline"
	if smooth == "polygon" || smooth == "pixel" {
		curve = smooth
	}
	speckle := int(math.Round(16 - detail*14))
	args = append(args, "--mode", curve, "--filter_speckle", strconv.Itoa(speckle), "--corner_threshold", strconv.Itoa(int(corners)), "--path_precision", "2")
	return args
}

var (
	svgPathPattern   = regexp.MustCompile(`<path\b[^>]*/>`)
	svgFillPattern   = regexp.MustCompile(`fill="(#[0-9A-Fa-f]{3,8})"`)
	svgDimsPattern   = regexp.MustCompile(`<svg\b[^>]*>`)
	svgUnsafePattern = regexp.MustCompile(`(?i)<script|<foreignobject|\son[a-z]+\s*=|javascript:|<iframe|<use\b[^>]*href\s*=\s*["']https?:`)
)

func layerProdkitSVG(svg []byte, regroup bool) ([]byte, map[string]interface{}, error) {
	if len(svg) == 0 {
		return nil, nil, fmt.Errorf("tracing produced an empty SVG")
	}
	if svgUnsafePattern.Match(svg) {
		return nil, nil, fmt.Errorf("the traced SVG contained unsupported content")
	}
	header := svgDimsPattern.Find(svg)
	paths := svgPathPattern.FindAll(svg, -1)
	if header == nil || len(paths) == 0 {
		return svg, map[string]interface{}{"paths": len(paths), "layers": 0}, nil
	}
	type layer struct {
		color string
		paths [][]byte
	}
	layers := []*layer{}
	byColor := map[string]*layer{}
	counts := map[string]int{}
	for _, path := range paths {
		color := "#000000"
		if match := svgFillPattern.FindSubmatch(path); match != nil {
			color = strings.ToLower(string(match[1]))
		}
		counts[color]++
		current := byColor[color]
		if !regroup && (len(layers) == 0 || layers[len(layers)-1].color != color) {
			current = nil
		}
		if current == nil {
			current = &layer{color: color}
			layers = append(layers, current)
			byColor[color] = current
		}
		current.paths = append(current.paths, path)
	}
	var out bytes.Buffer
	out.WriteString(`<?xml version="1.0" encoding="UTF-8"?>` + "\n")
	out.Write(header)
	out.WriteString("\n")
	for i, group := range layers {
		fmt.Fprintf(&out, `<g id="layer-%02d" data-color="%s" inkscape:groupmode="layer" inkscape:label="%s" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape">`+"\n", i+1, group.color, group.color)
		for _, path := range group.paths {
			out.Write(path)
			out.WriteString("\n")
		}
		out.WriteString("</g>\n")
	}
	out.WriteString("</svg>\n")
	palette := make([]string, 0, len(counts))
	for color := range counts {
		palette = append(palette, color)
	}
	sort.Slice(palette, func(a, b int) bool {
		if counts[palette[a]] != counts[palette[b]] {
			return counts[palette[a]] > counts[palette[b]]
		}
		return palette[a] < palette[b]
	})
	if len(palette) > 16 {
		palette = palette[:16]
	}
	return out.Bytes(), map[string]interface{}{"paths": len(paths), "layers": len(layers), "colors": len(counts), "palette": palette, "bytes": out.Len()}, nil
}

func runProdkitShotCleanup(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string, setStage func(string)) (map[string]interface{}, float64, float64, error) {
	setStage("downloading")
	source := filepath.Join(workDir, "source"+prodkitURLExt(req.VideoURL))
	if err := prodkitDownload(ctx, req.VideoURL, source, prodkitMaxVideo); err != nil {
		return nil, 0, 0, prodkitUserError{err.Error()}
	}
	probe, err := probeVideoFile(ctx, source)
	if err != nil || probe.Duration <= 0 {
		return nil, 0, 0, prodkitUserError{"that file is not a readable video"}
	}
	seconds := math.Min(probe.Duration, math.Min(prodkitEraserMaxSec, float64(req.Duration)))
	params := prodkitParams(req)
	points, _ := params["points"].([]interface{})
	keepAudio := true
	if value, ok := params["keep_audio"].(bool); ok {
		keepAudio = value
	}
	chunks := int(math.Ceil(seconds / prodkitEraserChunk))
	if len(points) > 0 && chunks > 1 {
		return nil, 0, 0, prodkitUserError{"point selection works on clips up to 4.8 s; use a prompt such as \"person\" for longer clips"}
	}
	setStage("preparing")
	paths := make([]string, chunks)
	span := seconds / float64(chunks)
	for i := 0; i < chunks; i++ {
		start := float64(i) * span
		length := span
		if i > 0 {
			start -= prodkitEraserFade
			length += prodkitEraserFade
		}
		paths[i] = filepath.Join(workDir, fmt.Sprintf("chunk%02d.mp4", i))
		cmd := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-y", "-ss", fmt.Sprintf("%.3f", start), "-i", source, "-t", fmt.Sprintf("%.3f", length),
			"-an", "-vf", "scale='min(1920,iw)':-2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", paths[i])
		if output, err := cmd.CombinedOutput(); err != nil {
			log.Printf("[prodkit] cleanup chunk: %v %s", err, tailOutput(output))
			return nil, 0, 0, prodkitUserError{"could not read that video"}
		}
	}
	setStage(fmt.Sprintf("removing objects (%d part%s)", chunks, map[bool]string{true: "s", false: ""}[chunks > 1]))
	cleaned := make([]string, chunks)
	errs := make([]error, chunks)
	var wg sync.WaitGroup
	limiter := make(chan struct{}, 3)
	for i := range paths {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			limiter <- struct{}{}
			defer func() { <-limiter }()
			chunkURL, err := uploadProdkitFile(ctx, paths[i], job.UserID, "video/mp4")
			if err != nil {
				errs[i] = err
				return
			}
			model := "bria/bria_video_eraser/erase/prompt"
			payload := map[string]interface{}{"video_url": chunkURL, "preserve_audio": false, "output_container_and_codec": "mp4_h264", "auto_trim": false}
			if len(points) > 0 {
				model = "bria/bria_video_eraser/erase/keypoints"
				keypoints := []string{}
				for _, raw := range points {
					point, _ := raw.(map[string]interface{})
					x, _ := point["x"].(float64)
					y, _ := point["y"].(float64)
					kind := "positive"
					if value, _ := point["type"].(string); value == "negative" {
						kind = "negative"
					}
					keypoints = append(keypoints, fmt.Sprintf("{'x': %d, 'y': %d, 'type': '%s'}", int(x), int(y), kind))
				}
				payload["keypoints"] = keypoints
			} else {
				payload["prompt"] = req.Prompt
			}
			body, err := runFalQueuedJobWithin(ctx, model, payload, 10*time.Minute)
			if err != nil {
				errs[i] = err
				return
			}
			var out struct {
				Video struct {
					URL string `json:"url"`
				} `json:"video"`
			}
			_ = json.Unmarshal(body, &out)
			if out.Video.URL == "" {
				errs[i] = fmt.Errorf("eraser returned no video")
				return
			}
			cleaned[i] = filepath.Join(workDir, fmt.Sprintf("clean%02d.mp4", i))
			errs[i] = prodkitDownload(ctx, out.Video.URL, cleaned[i], prodkitMaxVideo)
		}(i)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			log.Printf("[prodkit] cleanup eraser: %v", err)
			return nil, 0, 0, prodkitUserError{"object removal failed; you were not charged"}
		}
	}
	setStage("assembling")
	final := filepath.Join(workDir, "cleaned.mp4")
	args := []string{"-v", "error", "-y"}
	for _, path := range cleaned {
		args = append(args, "-i", path)
	}
	audio := keepAudio && probe.HasAudio
	if audio {
		args = append(args, "-t", fmt.Sprintf("%.3f", seconds), "-i", source)
	}
	filter := ""
	for i := range cleaned {
		filter += fmt.Sprintf("[%d:v]setsar=1,fps=%s,settb=AVTB[v%d];", i, prodkitFPS(probe.FPS), i)
	}
	last := "v0"
	for i := 1; i < len(cleaned); i++ {
		offset := float64(i)*span - prodkitEraserFade
		next := fmt.Sprintf("x%d", i)
		filter += fmt.Sprintf("[%s][v%d]xfade=transition=fade:duration=%.3f:offset=%.3f[%s];", last, i, prodkitEraserFade, offset, next)
		last = next
	}
	filter += fmt.Sprintf("[%s]null[v]", last)
	args = append(args, "-filter_complex", filter, "-map", "[v]")
	if audio {
		args = append(args, "-map", fmt.Sprintf("%d:a:0", len(cleaned)), "-c:a", "aac", "-b:a", "192k", "-shortest")
	}
	args = append(args, "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart", final)
	if output, err := exec.CommandContext(ctx, ffmpegBinary(), args...).CombinedOutput(); err != nil {
		log.Printf("[prodkit] cleanup concat: %v %s", err, tailOutput(output))
		return nil, 0, 0, fmt.Errorf("concat failed")
	}
	videoURL, err := uploadProdkitFile(ctx, final, job.UserID, "video/mp4")
	if err != nil {
		return nil, 0, 0, err
	}
	providerUSD := 0.14 * float64(chunks) * math.Ceil(span+prodkitEraserFade)
	return map[string]interface{}{
		"video_url": videoURL, "source_video_url": req.VideoURL, "duration_seconds": math.Round(seconds*100) / 100,
		"parts": chunks, "removed": req.Prompt, "width": probe.Width, "height": probe.Height,
	}, seconds, providerUSD, nil
}

func prodkitFPS(fps float64) string {
	if fps <= 1 || fps > 120 {
		return "30"
	}
	return strconv.FormatFloat(fps, 'f', 3, 64)
}

var prodkitContentExt = map[string]string{
	"video/mp4": "mp4", "image/jpeg": "jpg", "image/png": "png", "image/svg+xml": "svg",
	"application/x-blender": "blend", "model/gltf-binary": "glb", "text/plain": "txt",
}

var uploadProdkitFile = func(ctx context.Context, path, userID, contentType string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return "", err
	}
	if info.Size() <= 0 || info.Size() > prodkitMaxArtifact {
		return "", fmt.Errorf("artifact size %d is invalid", info.Size())
	}
	shortID := sanitizeUploadName(userID)
	if len(shortID) > 12 {
		shortID = shortID[:12]
	}
	extension := prodkitContentExt[contentType]
	if extension == "" {
		extension = "bin"
	}
	objectKey := fmt.Sprintf("%s/%s/prodkit/%s.%s", strings.TrimSuffix(r2PathPrefix, "/"), shortID, newUUID(), extension)
	uploadURL, err := presignR2PutObject(objectKey, contentType, 6*60*60)
	if err != nil {
		return "", err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, file)
	if err != nil {
		return "", err
	}
	httpReq.ContentLength = info.Size()
	httpReq.Header.Set("Content-Type", contentType)
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return "", fmt.Errorf("R2 upload returned %d: %s", resp.StatusCode, tailOutput(body))
	}
	return fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey), nil
}

func prodkitPricingUnits() map[string]string {
	units := map[string]string{}
	for _, tool := range prodkitTools {
		units[tool.Service] = tool.Unit
	}
	return units
}

func prodkitCatalog() []map[string]interface{} {
	out := []map[string]interface{}{}
	for _, tool := range prodkitTools {
		out = append(out, map[string]interface{}{
			"service": tool.Public, "internal": tool.Service, "title": tool.Title,
			"price_usd": tool.BaseUSD, "unit": tool.Unit, "params": tool.Params,
		})
	}
	return out
}
