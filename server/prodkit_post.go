package main

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"math"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"manifoldgen-site/lofiloop"
)

const (
	prodkitFootageSorter    = "prodkit_footage_sorter"
	prodkitShotComposer     = "prodkit_shot_composer"
	prodkitFootageMaxClips  = 24
	prodkitFootageMaxBytes  = 2 << 30
	prodkitFootageBaseUSD   = 0.05
	prodkitFootageClipUSD   = 0.02
	prodkitFootageAudioSec  = 1200.0
	prodkitFootageSyncSec   = 60.0
	prodkitFootageMinConf   = 0.15
	prodkitEnvRate          = 100
	prodkitEnvHop           = 160
	prodkitEnvWindow        = 512
	prodkitCaptionUSD       = 0.0004
	prodkitComposerBaseUSD  = 0.10
	prodkitComposerChromaPS = 0.01
	prodkitComposerPromptBG = 0.04
	prodkitComposerMaxSec   = 30.0
	prodkitSheetW           = 384
	prodkitSheetH           = 216
)

var prodkitFetchMedia = prodkitDownload

func prodkitFootageClips(params map[string]interface{}) []string {
	raw, _ := params["clips"].([]interface{})
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		value, _ := item.(string)
		out = append(out, strings.TrimSpace(value))
	}
	return out
}

func prodkitFootagePriceUSD(req ServiceUsageRequest) float64 {
	return prodkitFootageBaseUSD + prodkitFootageClipUSD*float64(len(prodkitFootageClips(prodkitParams(req))))
}

func prodkitComposerChroma(req ServiceUsageRequest) bool {
	return prodkitString(prodkitParams(req), "key") == "chroma"
}

func prodkitComposerBackground(req ServiceUsageRequest) string {
	params := prodkitParams(req)
	switch {
	case strings.TrimSpace(req.ImageURL) != "":
		return "image"
	case prodkitRawString(params, "background_video_url") != "":
		return "video"
	case strings.TrimSpace(req.Prompt) != "":
		return "prompt"
	}
	return ""
}

func prodkitRawString(params map[string]interface{}, key string) string {
	value, _ := params[key].(string)
	return strings.TrimSpace(value)
}

func prodkitComposerPriceUSD(req ServiceUsageRequest, seconds float64) float64 {
	if seconds <= 0 {
		seconds = 5
	}
	seconds = math.Ceil(math.Min(seconds, prodkitComposerMaxSec))
	price := prodkitComposerBaseUSD + prodkitComposerChromaPS*seconds
	if !prodkitComposerChroma(req) {
		price = prodkitComposerBaseUSD + videoBackgroundPublicRateUSD()*seconds
	}
	if prodkitComposerBackground(req) == "prompt" {
		price += prodkitComposerPromptBG
	}
	return math.Round(price*1e6) / 1e6
}

func prodkitParamType(params map[string]interface{}, key, kind string) error {
	value, ok := params[key]
	if !ok {
		return nil
	}
	valid := false
	switch kind {
	case "number":
		number, isNumber := value.(float64)
		valid = isNumber && !math.IsNaN(number) && !math.IsInf(number, 0)
	case "bool":
		_, valid = value.(bool)
	case "string":
		_, valid = value.(string)
	}
	if !valid {
		return fmt.Errorf("params.%s must be a %s", key, map[string]string{"number": "number", "bool": "boolean", "string": "string"}[kind])
	}
	return nil
}

func normalizeProdkitFootage(params map[string]interface{}) error {
	raw, ok := params["clips"].([]interface{})
	if !ok || len(raw) == 0 {
		return fmt.Errorf("footage-sorter needs params.clips (1-%d public video or audio URLs)", prodkitFootageMaxClips)
	}
	if len(raw) > prodkitFootageMaxClips {
		return fmt.Errorf("at most %d clips", prodkitFootageMaxClips)
	}
	for i, item := range raw {
		value, ok := item.(string)
		if !ok || strings.TrimSpace(value) == "" {
			return fmt.Errorf("params.clips[%d] must be a URL", i)
		}
		if err := validateProdkitURL(strings.TrimSpace(value)); err != nil {
			return err
		}
	}
	for key, kind := range map[string]string{"reference_audio": "number", "sync": "bool", "fps": "number"} {
		if err := prodkitParamType(params, key, kind); err != nil {
			return err
		}
	}
	if ref, ok := params["reference_audio"].(float64); ok && (ref != math.Trunc(ref) || ref < 0 || int(ref) >= len(raw)) {
		return fmt.Errorf("params.reference_audio must be a clip index from 0 to %d", len(raw)-1)
	}
	if fps, ok := params["fps"].(float64); ok && (fps < 1 || fps > 120) {
		return fmt.Errorf("params.fps must be between 1 and 120")
	}
	return nil
}

var prodkitKeyColorPattern = regexp.MustCompile(`^(#|0x)?[0-9a-f]{6}$`)

func normalizeProdkitComposer(req *ServiceUsageRequest, params map[string]interface{}) error {
	if req.VideoURL == "" {
		return fmt.Errorf("video_url (the foreground subject) is required")
	}
	for key, kind := range map[string]string{"background_video_url": "string", "position": "string", "scale": "number", "match_color": "bool",
		"light_wrap": "number", "grain": "number", "shadow": "bool", "keep_audio": "bool", "key": "string", "key_color": "string"} {
		if err := prodkitParamType(params, key, kind); err != nil {
			return err
		}
	}
	if bg := prodkitRawString(params, "background_video_url"); bg != "" {
		if err := validateProdkitURL(bg); err != nil {
			return err
		}
	}
	req.Prompt = strings.TrimSpace(req.Prompt)
	if len(req.Prompt) > 500 {
		return fmt.Errorf("prompt must be at most 500 characters")
	}
	if prodkitComposerBackground(*req) == "" {
		return fmt.Errorf("pass image_url, params.background_video_url or a prompt describing the background")
	}
	switch prodkitString(params, "position") {
	case "", "center", "left", "right", "bottom":
	default:
		return fmt.Errorf("params.position must be center, left, right or bottom")
	}
	switch prodkitString(params, "key") {
	case "", "ai", "chroma":
	default:
		return fmt.Errorf("params.key must be ai or chroma")
	}
	if color := prodkitString(params, "key_color"); color != "" && color != "green" && color != "blue" && !prodkitKeyColorPattern.MatchString(color) {
		return fmt.Errorf("params.key_color must be green, blue or a hex color like #00ff00")
	}
	if req.Duration <= 0 || req.Duration > int(prodkitComposerMaxSec) {
		req.Duration = int(prodkitComposerMaxSec)
	}
	return nil
}

type prodkitMediaInfo struct {
	Duration     float64
	FPS          float64
	Width        int
	Height       int
	HasVideo     bool
	HasAudio     bool
	Channels     int
	CreationTime string
	Camera       string
}

func prodkitFFprobe() string {
	if bin := strings.TrimSpace(os.Getenv("FFPROBE_BIN")); bin != "" {
		return bin
	}
	if ff := ffmpegBinary(); filepath.Base(ff) == "ffmpeg" && strings.ContainsRune(ff, os.PathSeparator) {
		return filepath.Join(filepath.Dir(ff), "ffprobe")
	}
	return "ffprobe"
}

func prodkitParseRate(value string) float64 {
	num, den, found := strings.Cut(value, "/")
	n, _ := strconv.ParseFloat(num, 64)
	if !found {
		return n
	}
	d, _ := strconv.ParseFloat(den, 64)
	if d == 0 {
		return 0
	}
	return n / d
}

func prodkitProbeMedia(ctx context.Context, path string) (prodkitMediaInfo, error) {
	var info prodkitMediaInfo
	blob, err := exec.CommandContext(ctx, prodkitFFprobe(), "-v", "error", "-show_streams", "-show_format", "-of", "json", path).Output()
	if err != nil {
		return info, fmt.Errorf("ffprobe %s: %w", filepath.Base(path), err)
	}
	var parsed struct {
		Streams []struct {
			CodecType    string            `json:"codec_type"`
			Width        int               `json:"width"`
			Height       int               `json:"height"`
			AvgFrameRate string            `json:"avg_frame_rate"`
			RFrameRate   string            `json:"r_frame_rate"`
			Channels     int               `json:"channels"`
			Duration     string            `json:"duration"`
			Disposition  map[string]int    `json:"disposition"`
			Tags         map[string]string `json:"tags"`
		} `json:"streams"`
		Format struct {
			Duration string            `json:"duration"`
			Tags     map[string]string `json:"tags"`
		} `json:"format"`
	}
	if err := json.Unmarshal(blob, &parsed); err != nil {
		return info, err
	}
	tags := map[string]string{}
	for key, value := range parsed.Format.Tags {
		tags[strings.ToLower(key)] = strings.TrimSpace(value)
	}
	info.Duration, _ = strconv.ParseFloat(parsed.Format.Duration, 64)
	for _, stream := range parsed.Streams {
		for key, value := range stream.Tags {
			if _, set := tags[strings.ToLower(key)]; !set {
				tags[strings.ToLower(key)] = strings.TrimSpace(value)
			}
		}
		if seconds, _ := strconv.ParseFloat(stream.Duration, 64); info.Duration <= 0 && seconds > 0 {
			info.Duration = seconds
		}
		switch stream.CodecType {
		case "video":
			if stream.Disposition["attached_pic"] == 1 || info.HasVideo {
				continue
			}
			info.HasVideo, info.Width, info.Height = true, stream.Width, stream.Height
			info.FPS = prodkitParseRate(stream.AvgFrameRate)
			if info.FPS <= 0 || info.FPS > 240 {
				info.FPS = prodkitParseRate(stream.RFrameRate)
			}
		case "audio":
			if !info.HasAudio {
				info.HasAudio, info.Channels = true, stream.Channels
			}
		}
	}
	info.CreationTime = tags["creation_time"]
	if info.CreationTime == "" {
		info.CreationTime = tags["com.apple.quicktime.creationdate"]
	}
	for _, pair := range [][2]string{{"com.apple.quicktime.make", "com.apple.quicktime.model"}, {"make", "model"}, {"com.android.manufacturer", "com.android.model"}} {
		if camera := strings.TrimSpace(tags[pair[0]] + " " + tags[pair[1]]); camera != "" {
			info.Camera = truncateString(camera, 60)
			break
		}
	}
	return info, nil
}

func prodkitRun(ctx context.Context, label string, args ...string) error {
	if output, err := exec.CommandContext(ctx, ffmpegBinary(), append([]string{"-v", "error", "-y"}, args...)...).CombinedOutput(); err != nil {
		log.Printf("[prodkit] %s: %v %s", label, err, tailOutput(output))
		return fmt.Errorf("%s failed", label)
	}
	return nil
}

type prodkitClip struct {
	Index        int      `json:"index"`
	Name         string   `json:"name"`
	URL          string   `json:"url"`
	Kind         string   `json:"kind"`
	Duration     float64  `json:"duration_seconds"`
	FPS          float64  `json:"fps,omitempty"`
	Width        int      `json:"width,omitempty"`
	Height       int      `json:"height,omitempty"`
	HasAudio     bool     `json:"has_audio"`
	Channels     int      `json:"-"`
	Size         int64    `json:"bytes"`
	CreationTime string   `json:"creation_time,omitempty"`
	Camera       string   `json:"camera"`
	Caption      string   `json:"caption,omitempty"`
	Scene        string   `json:"scene,omitempty"`
	Shot         string   `json:"shot"`
	Role         string   `json:"role"`
	Speech       float64  `json:"speech_activity"`
	Offset       float64  `json:"offset_seconds"`
	Confidence   float64  `json:"sync_confidence"`
	Synced       bool     `json:"synced"`
	Reference    bool     `json:"reference,omitempty"`
	Start        float64  `json:"timeline_start"`
	Lane         int      `json:"lane"`
	Bins         []string `json:"bins"`
	path         string
	frames       []string
	talking      bool
	env          []float64
	speechy      bool
}

type prodkitBin struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Clips []int  `json:"clips"`
}

type prodkitCaption struct {
	Caption string `json:"caption"`
	Scene   string `json:"scene"`
	Talking bool   `json:"talking"`
}

var prodkitCaptionClip = func(ctx context.Context, frames []string) (prodkitCaption, error) {
	var out prodkitCaption
	if dramatizeGeminiKey() == "" {
		return out, fmt.Errorf("captions unavailable")
	}
	images := []string{}
	for _, frame := range frames {
		blob, err := os.ReadFile(frame)
		if err == nil && len(blob) > 0 {
			images = append(images, "data:image/jpeg;base64,"+base64.StdEncoding.EncodeToString(blob))
		}
	}
	if len(images) == 0 {
		return out, fmt.Errorf("no frames")
	}
	prompt := `These are 3 stills from one video clip. Return JSON {"caption": one sentence naming the subject, action and framing (wide shot, medium shot or close-up), "scene": a 2-4 word location label, "talking": true only if a person speaks to camera or is interviewed}.`
	callCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()
	blob, err := callTrailerFlashJSON(callCtx, prompt, images)
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(blob, &out)
	out.Caption, out.Scene = truncateString(strings.TrimSpace(out.Caption), 300), truncateString(strings.TrimSpace(out.Scene), 60)
	return out, err
}

var prodkitSaveStudioProject = func(userID, name string, doc []byte) string {
	if dbConn == nil || len(doc) > maxStudioProjectDocumentBytes {
		return ""
	}
	id := uuid.NewString()
	if _, err := dbConn.UpsertStudioProject(userID, id, name, doc); err != nil {
		log.Printf("[prodkit] studio project save: %v", err)
		return ""
	}
	return "/studio?project=" + url.QueryEscape(id)
}

func prodkitClipName(raw string, index int) string {
	name := ""
	if parsed, err := url.Parse(raw); err == nil {
		name = strings.TrimSuffix(filepath.Base(parsed.Path), filepath.Ext(parsed.Path))
	}
	name = strings.Map(func(r rune) rune {
		if r < 32 || strings.ContainsRune(`<>"&/\`, r) {
			return '_'
		}
		return r
	}, name)
	if name == "" || name == "." {
		name = "clip"
	}
	return fmt.Sprintf("%02d %s", index+1, truncateString(name, 48))
}

var prodkitMediaTypes = map[string]string{
	".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".mkv": "video/x-matroska",
	".wav": "audio/wav", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".aac": "audio/aac", ".flac": "audio/flac", ".ogg": "audio/ogg",
}

func prodkitMediaExt(raw string) string {
	if ext := prodkitURLExt(raw); prodkitMediaTypes[ext] != "" {
		return ext
	}
	return ".media"
}

func prodkitClipContentType(clip *prodkitClip) string {
	if value := prodkitMediaTypes[prodkitURLExt(clip.URL)]; value != "" {
		return value
	}
	if clip.Kind == "audio" {
		return "audio/mpeg"
	}
	return "video/mp4"
}

func prodkitExtractFrames(ctx context.Context, clip *prodkitClip, dir string) {
	scale := fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=decrease,pad=%d:%d:(ow-iw)/2:(oh-ih)/2:black,setsar=1", prodkitSheetW, prodkitSheetH, prodkitSheetW, prodkitSheetH)
	for j, frac := range []float64{0.15, 0.5, 0.85} {
		out := filepath.Join(dir, fmt.Sprintf("frame%02d_%d.jpg", clip.Index, j))
		at := fmt.Sprintf("%.3f", clip.Duration*frac)
		if prodkitRun(ctx, "keyframe", "-ss", at, "-i", clip.path, "-frames:v", "1", "-vf", scale, "-q:v", "4", out) == nil {
			if info, err := os.Stat(out); err == nil && info.Size() > 0 {
				clip.frames = append(clip.frames, out)
			}
		}
	}
}

func prodkitAudioEnvelope(ctx context.Context, path string, maxSec float64) ([]float64, []float64, error) {
	cmd := exec.CommandContext(ctx, ffmpegBinary(), "-v", "error", "-t", fmt.Sprintf("%.0f", maxSec), "-i", path, "-vn", "-ac", "1", "-ar", "16000", "-f", "f32le", "-acodec", "pcm_f32le", "-")
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, nil, err
	}
	reader := bufio.NewReaderSize(stdout, 1<<16)
	window := hannWindow(prodkitEnvWindow)
	re, im := make([]float64, prodkitEnvWindow), make([]float64, prodkitEnvWindow)
	prev := make([]float64, prodkitEnvWindow/2)
	pending := make([]float64, 0, 4*prodkitEnvWindow)
	var env, rms []float64
	word := make([]byte, 4)
	for {
		if _, err := io.ReadFull(reader, word); err != nil {
			break
		}
		pending = append(pending, float64(math.Float32frombits(binary.LittleEndian.Uint32(word))))
		if len(pending) < prodkitEnvWindow {
			continue
		}
		energy := 0.0
		for i := range re {
			energy += pending[i] * pending[i]
			re[i], im[i] = pending[i]*window[i], 0
		}
		fftInPlace(re, im)
		flux := 0.0
		for k := 1; k <= prodkitEnvWindow/2; k++ {
			mag := math.Log1p(100 * math.Hypot(re[k], im[k]))
			if d := mag - prev[k-1]; d > 0 && len(env) > 0 {
				flux += d
			}
			prev[k-1] = mag
		}
		env = append(env, flux)
		rms = append(rms, math.Sqrt(energy/prodkitEnvWindow))
		pending = append(pending[:0], pending[prodkitEnvHop:]...)
	}
	waitErr := cmd.Wait()
	if waitErr != nil && len(env) == 0 {
		return nil, nil, waitErr
	}
	return env, rms, nil
}

func prodkitOnsetNormalize(env []float64) []float64 {
	n := len(env)
	out := make([]float64, n)
	if n == 0 {
		return out
	}
	prefix := make([]float64, n+1)
	for i, v := range env {
		prefix[i+1] = prefix[i] + v
	}
	half := prodkitEnvRate / 4
	mean := 0.0
	for i := range env {
		lo, hi := maxInt(0, i-half), minInt(n, i+half+1)
		out[i] = math.Max(0, env[i]-(prefix[hi]-prefix[lo])/float64(hi-lo))
		mean += out[i]
	}
	mean /= float64(n)
	variance := 0.0
	for i := range out {
		out[i] -= mean
		variance += out[i] * out[i]
	}
	if std := math.Sqrt(variance / float64(n)); std > 1e-12 {
		for i := range out {
			out[i] /= std
		}
	}
	return out
}

func prodkitXCorrOffset(ref, sig []float64, maxLag int) (float64, float64) {
	if len(ref) == 0 || len(sig) == 0 {
		return 0, 0
	}
	n := 1
	for n < len(ref)+len(sig) {
		n <<= 1
	}
	ar, ai, br, bi := make([]float64, n), make([]float64, n), make([]float64, n), make([]float64, n)
	copy(ar, ref)
	copy(br, sig)
	fftInPlace(ar, ai)
	fftInPlace(br, bi)
	for k := range ar {
		re := ar[k]*br[k] + ai[k]*bi[k]
		im := ai[k]*br[k] - ar[k]*bi[k]
		ar[k], ai[k] = re, -im
	}
	fftInPlace(ar, ai)
	at := func(lag int) float64 {
		if lag < 0 {
			lag += n
		}
		return ar[lag] / float64(n)
	}
	lo, hi := maxInt(-maxLag, -(len(sig)-1)), minInt(maxLag, len(ref)-1)
	if lo > hi {
		return 0, 0
	}
	best := lo
	for lag := lo; lag <= hi; lag++ {
		if at(lag) > at(best) {
			best = lag
		}
	}
	peak := at(best)
	if peak <= 0 {
		return float64(best), 0
	}
	guard := prodkitEnvRate / 4
	second := 0.0
	for lag := lo; lag <= hi; lag++ {
		if (lag < best-guard || lag > best+guard) && at(lag) > second {
			second = at(lag)
		}
	}
	refined := float64(best)
	if best > lo && best < hi {
		left, right := at(best-1), at(best+1)
		if denom := left - 2*peak + right; denom < 0 {
			refined += math.Max(-0.5, math.Min(0.5, 0.5*(left-right)/denom))
		}
	}
	return refined, math.Max(0, math.Min(1, 1-second/peak))
}

func prodkitSpeechActivity(rms []float64) (float64, bool) {
	if len(rms) < prodkitEnvRate {
		return 0, false
	}
	sorted := append([]float64(nil), rms...)
	sort.Float64s(sorted)
	threshold := math.Max(0.005, 0.15*sorted[len(sorted)*95/100])
	active, sum, sumSq := 0, 0.0, 0.0
	for _, v := range rms {
		if v > threshold {
			active++
			sum += v
			sumSq += v * v
		}
	}
	ratio := float64(active) / float64(len(rms))
	if active < 2 {
		return ratio, false
	}
	mean := sum / float64(active)
	cv := math.Sqrt(math.Max(0, sumSq/float64(active)-mean*mean)) / mean
	return ratio, ratio >= 0.3 && ratio <= 0.97 && cv >= 0.35
}

var (
	prodkitTalkWords  = []string{"talk", "speak", "interview", "presenter", "host", "vlog", "addressing", "lecture", "conversation", "podcast", "microphone", "to camera", "to the camera"}
	prodkitCloseWords = []string{"close-up", "close up", "closeup", "extreme close", "macro", "detail shot", "insert shot"}
	prodkitWideWords  = []string{"wide", "establishing", "aerial", "drone", "landscape", "long shot", "panoram", "skyline", "full shot"}
	prodkitMedWords   = []string{"medium", "mid shot", "mid-shot", "waist", "half body", "upper body", "chest"}
	prodkitStopWords  = map[string]bool{"the": true, "and": true, "with": true, "from": true, "into": true, "onto": true, "while": true, "shot": true, "wide": true, "medium": true, "close": true, "closeup": true, "frame": true, "camera": true, "video": true, "clip": true, "scene": true, "this": true, "that": true, "their": true, "there": true, "over": true, "near": true, "for": true, "are": true, "his": true, "her": true, "its": true, "who": true, "being": true, "background": true, "foreground": true}
	prodkitWordRe     = regexp.MustCompile(`[a-z]+`)
)

func prodkitHasAny(text string, words []string) bool {
	for _, word := range words {
		if strings.Contains(text, word) {
			return true
		}
	}
	return false
}

func prodkitShotType(caption string) string {
	text := strings.ToLower(caption)
	switch {
	case prodkitHasAny(text, prodkitCloseWords):
		return "close"
	case prodkitHasAny(text, prodkitWideWords):
		return "wide"
	case prodkitHasAny(text, prodkitMedWords) || prodkitHasAny(text, prodkitTalkWords):
		return "medium"
	}
	return "unknown"
}

func prodkitTokens(text string) map[string]bool {
	out := map[string]bool{}
	for _, word := range prodkitWordRe.FindAllString(strings.ToLower(text), -1) {
		if len(word) >= 3 && !prodkitStopWords[word] {
			out[strings.TrimSuffix(word, "s")] = true
		}
	}
	return out
}

func prodkitJaccard(a, b map[string]bool) float64 {
	if len(a) == 0 || len(b) == 0 {
		return 0
	}
	shared := 0
	for word := range a {
		if b[word] {
			shared++
		}
	}
	return float64(shared) / float64(len(a)+len(b)-shared)
}

func prodkitBuildBins(clips []*prodkitClip) []prodkitBin {
	bins := []prodkitBin{}
	index := map[string]int{}
	add := func(name, kind string, clip *prodkitClip) {
		key := kind + "\x00" + name
		i, ok := index[key]
		if !ok {
			i = len(bins)
			index[key] = i
			bins = append(bins, prodkitBin{Name: name, Type: kind})
		}
		bins[i].Clips = append(bins[i].Clips, clip.Index)
		clip.Bins = append(clip.Bins, name)
	}
	for _, role := range []string{"a-roll", "b-roll", "audio"} {
		for _, clip := range clips {
			if clip.Role == role {
				add(map[string]string{"a-roll": "A-roll", "b-roll": "B-roll", "audio": "Audio"}[role], "role", clip)
			}
		}
	}
	for _, clip := range clips {
		camera := clip.Camera
		if camera == "" && clip.Kind == "video" {
			camera = fmt.Sprintf("%dx%d %sp", clip.Width, clip.Height, strconv.FormatFloat(math.Round(clip.FPS*100)/100, 'f', -1, 64))
		}
		if camera != "" {
			add("Camera: "+camera, "camera", clip)
		}
	}
	type cluster struct {
		label  string
		tokens map[string]bool
		clips  []*prodkitClip
	}
	clusters := []*cluster{}
	for _, clip := range clips {
		if clip.Caption == "" && clip.Scene == "" {
			continue
		}
		tokens := prodkitTokens(clip.Scene + " " + clip.Scene + " " + clip.Caption)
		var best *cluster
		bestScore := 0.2
		for _, group := range clusters {
			if score := prodkitJaccard(tokens, group.tokens); score >= bestScore {
				best, bestScore = group, score
			}
		}
		if best == nil {
			label := clip.Scene
			if label == "" {
				label = truncateString(clip.Caption, 40)
			}
			best = &cluster{label: label, tokens: map[string]bool{}}
			clusters = append(clusters, best)
		}
		for word := range tokens {
			best.tokens[word] = true
		}
		best.clips = append(best.clips, clip)
	}
	for i, group := range clusters {
		for _, clip := range group.clips {
			add(fmt.Sprintf("Scene %d: %s", i+1, group.label), "scene", clip)
		}
	}
	return bins
}

func prodkitTimebase(fps float64) (int64, int64) {
	for _, ntsc := range []int64{24, 30, 48, 60, 120} {
		if math.Abs(fps-float64(ntsc)*1000/1001) < 0.01 {
			return 1001, ntsc * 1000
		}
	}
	rounded := int64(math.Round(fps))
	if rounded < 1 || rounded > 120 {
		rounded = 30
	}
	return 1, rounded
}

func prodkitFootageLayout(clips []*prodkitClip, sync bool) {
	synced := []*prodkitClip{}
	for _, clip := range clips {
		if sync && clip.Synced {
			synced = append(synced, clip)
		}
	}
	sort.SliceStable(synced, func(a, b int) bool {
		if synced[a].Reference != synced[b].Reference {
			return synced[a].Reference
		}
		return synced[a].Offset < synced[b].Offset
	})
	minOffset := 0.0
	for _, clip := range synced {
		minOffset = math.Min(minOffset, clip.Offset)
	}
	end, video, audio := 0.0, 0, -1
	for _, clip := range synced {
		clip.Start = clip.Offset - minOffset
		if clip.Kind == "video" {
			clip.Lane = video
			video++
		} else {
			clip.Lane = audio
			audio--
		}
		end = math.Max(end, clip.Start+clip.Duration)
	}
	videoCursor, audioCursor := end, end
	for _, clip := range clips {
		if sync && clip.Synced {
			continue
		}
		if clip.Kind == "video" {
			clip.Start, clip.Lane = videoCursor, 0
			videoCursor += clip.Duration
		} else {
			clip.Start, clip.Lane = audioCursor, -1
			audioCursor += clip.Duration
		}
	}
}

func prodkitSyncClips(clips []*prodkitClip, refIndex int) int {
	ref := -1
	if refIndex >= 0 && refIndex < len(clips) && len(clips[refIndex].env) > 0 {
		ref = refIndex
	} else {
		for i, clip := range clips {
			if len(clip.env) > 0 && (ref < 0 || clip.Duration > clips[ref].Duration) {
				ref = i
			}
		}
	}
	if ref < 0 {
		return -1
	}
	reference := prodkitOnsetNormalize(clips[ref].env)
	clips[ref].Reference, clips[ref].Synced, clips[ref].Confidence = true, true, 1
	maxLag := int(prodkitFootageSyncSec * prodkitEnvRate)
	for i, clip := range clips {
		if i == ref || len(clip.env) == 0 {
			continue
		}
		lag, confidence := prodkitXCorrOffset(reference, prodkitOnsetNormalize(clip.env), maxLag)
		clip.Offset = math.Round(lag/prodkitEnvRate*1000) / 1000
		clip.Confidence = math.Round(confidence*1000) / 1000
		clip.Synced = confidence >= prodkitFootageMinConf
	}
	return ref
}

type fcpXML struct {
	XMLName   xml.Name     `xml:"fcpxml"`
	Version   string       `xml:"version,attr"`
	Resources fcpResources `xml:"resources"`
	Library   fcpLibrary   `xml:"library"`
}

type fcpResources struct {
	Formats []fcpFormat `xml:"format"`
	Assets  []fcpAsset  `xml:"asset"`
}

type fcpFormat struct {
	ID            string `xml:"id,attr"`
	Name          string `xml:"name,attr,omitempty"`
	FrameDuration string `xml:"frameDuration,attr,omitempty"`
	Width         int    `xml:"width,attr,omitempty"`
	Height        int    `xml:"height,attr,omitempty"`
}

type fcpAsset struct {
	ID            string      `xml:"id,attr"`
	Name          string      `xml:"name,attr"`
	Start         string      `xml:"start,attr"`
	Duration      string      `xml:"duration,attr"`
	HasVideo      string      `xml:"hasVideo,attr,omitempty"`
	Format        string      `xml:"format,attr,omitempty"`
	HasAudio      string      `xml:"hasAudio,attr,omitempty"`
	AudioSources  string      `xml:"audioSources,attr,omitempty"`
	AudioChannels string      `xml:"audioChannels,attr,omitempty"`
	AudioRate     string      `xml:"audioRate,attr,omitempty"`
	MediaRep      fcpMediaRep `xml:"media-rep"`
}

type fcpMediaRep struct {
	Kind string `xml:"kind,attr"`
	Src  string `xml:"src,attr"`
}

type fcpLibrary struct {
	Events []fcpEvent `xml:"event"`
}

type fcpEvent struct {
	Name        string                 `xml:"name,attr"`
	Clips       []fcpAssetClip         `xml:"asset-clip"`
	Collections []fcpKeywordCollection `xml:"keyword-collection"`
	Projects    []fcpProject           `xml:"project"`
}

type fcpKeywordCollection struct {
	Name string `xml:"name,attr"`
}

type fcpProject struct {
	Name     string      `xml:"name,attr"`
	Sequence fcpSequence `xml:"sequence"`
}

type fcpSequence struct {
	Format      string   `xml:"format,attr"`
	Duration    string   `xml:"duration,attr"`
	TCStart     string   `xml:"tcStart,attr"`
	TCFormat    string   `xml:"tcFormat,attr"`
	AudioLayout string   `xml:"audioLayout,attr"`
	AudioRate   string   `xml:"audioRate,attr"`
	Spine       fcpSpine `xml:"spine"`
}

type fcpSpine struct {
	Gaps []fcpGap `xml:"gap"`
}

type fcpGap struct {
	Name     string         `xml:"name,attr"`
	Offset   string         `xml:"offset,attr"`
	Start    string         `xml:"start,attr"`
	Duration string         `xml:"duration,attr"`
	Clips    []fcpAssetClip `xml:"asset-clip"`
}

type fcpAssetClip struct {
	Ref      string       `xml:"ref,attr"`
	Lane     string       `xml:"lane,attr,omitempty"`
	Offset   string       `xml:"offset,attr,omitempty"`
	Name     string       `xml:"name,attr"`
	Start    string       `xml:"start,attr,omitempty"`
	Duration string       `xml:"duration,attr"`
	Format   string       `xml:"format,attr,omitempty"`
	TCFormat string       `xml:"tcFormat,attr,omitempty"`
	Keywords []fcpKeyword `xml:"keyword"`
	Markers  []fcpMarker  `xml:"marker"`
}

type fcpKeyword struct {
	Start    string `xml:"start,attr"`
	Duration string `xml:"duration,attr"`
	Value    string `xml:"value,attr"`
}

type fcpMarker struct {
	Start    string `xml:"start,attr"`
	Duration string `xml:"duration,attr"`
	Value    string `xml:"value,attr"`
}

type prodkitTimeline struct {
	Num, Den      int64
	Width, Height int
	Name          string
}

func (t prodkitTimeline) frames(seconds float64) int64 {
	return int64(math.Round(seconds * float64(t.Den) / float64(t.Num)))
}

func (t prodkitTimeline) fcp(frames int64) string {
	if frames <= 0 {
		return "0s"
	}
	return fmt.Sprintf("%d/%ds", frames*t.Num, t.Den)
}

func (t prodkitTimeline) clipFrames(clip *prodkitClip) int64 {
	return maxInt64(1, int64(math.Floor(clip.Duration*float64(t.Den)/float64(t.Num)+1e-6)))
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

func buildProdkitFCPXML(clips []*prodkitClip, bins []prodkitBin, tl prodkitTimeline) ([]byte, error) {
	doc := fcpXML{Version: "1.10"}
	doc.Resources.Formats = append(doc.Resources.Formats, fcpFormat{ID: "r1", FrameDuration: tl.fcp(1), Width: tl.Width, Height: tl.Height})
	formats := map[string]string{}
	event := fcpEvent{Name: tl.Name}
	gap := fcpGap{Name: "Gap", Offset: "0s", Start: "0s"}
	total := int64(1)
	for _, clip := range clips {
		id := fmt.Sprintf("a%d", clip.Index+1)
		length := tl.clipFrames(clip)
		asset := fcpAsset{ID: id, Name: clip.Name, Start: "0s", Duration: tl.fcp(length), MediaRep: fcpMediaRep{Kind: "original-media", Src: clip.URL}}
		format := ""
		if clip.Kind == "video" {
			key := fmt.Sprintf("%dx%d@%.3f", clip.Width, clip.Height, clip.FPS)
			if formats[key] == "" {
				num, den := prodkitTimebase(clip.FPS)
				formats[key] = fmt.Sprintf("r%d", len(doc.Resources.Formats)+1)
				doc.Resources.Formats = append(doc.Resources.Formats, fcpFormat{ID: formats[key], FrameDuration: fmt.Sprintf("%d/%ds", num, den), Width: clip.Width, Height: clip.Height})
			}
			format = formats[key]
			asset.HasVideo, asset.Format = "1", format
		}
		if clip.HasAudio {
			channels := clip.Channels
			if channels <= 0 {
				channels = 2
			}
			asset.HasAudio, asset.AudioSources, asset.AudioChannels, asset.AudioRate = "1", "1", strconv.Itoa(channels), "48000"
		}
		doc.Resources.Assets = append(doc.Resources.Assets, asset)
		keyword := fcpKeyword{Start: "0s", Duration: tl.fcp(length), Value: strings.Join(clip.Bins, ", ")}
		browser := fcpAssetClip{Ref: id, Name: clip.Name, Duration: tl.fcp(length), Format: format, TCFormat: "NDF", Keywords: []fcpKeyword{keyword}}
		event.Clips = append(event.Clips, browser)
		lane := clip.Lane
		if lane >= 0 {
			lane++
		}
		start := tl.frames(clip.Start)
		placed := fcpAssetClip{Ref: id, Lane: strconv.Itoa(lane), Offset: tl.fcp(start), Name: clip.Name, Start: "0s", Duration: tl.fcp(length), Format: format, TCFormat: "NDF"}
		marker := clip.Role
		if clip.Synced {
			marker += fmt.Sprintf(" | synced %+.3fs (%.0f%%)", clip.Offset, clip.Confidence*100)
		}
		placed.Markers = []fcpMarker{{Start: "0s", Duration: tl.fcp(1), Value: marker}}
		gap.Clips = append(gap.Clips, placed)
		total = maxInt64(total, start+length)
	}
	gap.Duration = tl.fcp(total)
	for _, bin := range bins {
		event.Collections = append(event.Collections, fcpKeywordCollection{Name: bin.Name})
	}
	event.Projects = []fcpProject{{Name: tl.Name + " (synced)", Sequence: fcpSequence{Format: "r1", Duration: tl.fcp(total), TCStart: "0s", TCFormat: "NDF", AudioLayout: "stereo", AudioRate: "48k", Spine: fcpSpine{Gaps: []fcpGap{gap}}}}}
	doc.Library.Events = []fcpEvent{event}
	body, err := xml.MarshalIndent(doc, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header+"<!DOCTYPE fcpxml>\n"), append(body, '\n')...), nil
}

func otioTime(frames int64, rate float64) map[string]interface{} {
	return map[string]interface{}{"OTIO_SCHEMA": "RationalTime.1", "rate": rate, "value": float64(frames)}
}

func otioRange(start, duration int64, rate float64) map[string]interface{} {
	return map[string]interface{}{"OTIO_SCHEMA": "TimeRange.1", "start_time": otioTime(start, rate), "duration": otioTime(duration, rate)}
}

func buildProdkitOTIO(clips []*prodkitClip, bins []prodkitBin, tl prodkitTimeline) ([]byte, error) {
	rate := float64(tl.Den) / float64(tl.Num)
	lanes := map[int][]*prodkitClip{}
	for _, clip := range clips {
		lanes[clip.Lane] = append(lanes[clip.Lane], clip)
	}
	keys := make([]int, 0, len(lanes))
	for lane := range lanes {
		keys = append(keys, lane)
	}
	sort.Slice(keys, func(a, b int) bool {
		if (keys[a] >= 0) != (keys[b] >= 0) {
			return keys[a] >= 0
		}
		return math.Abs(float64(keys[a])) < math.Abs(float64(keys[b]))
	})
	colors := map[string]string{"a-roll": "GREEN", "b-roll": "CYAN", "audio": "PURPLE"}
	tracks := []interface{}{}
	for _, lane := range keys {
		items := lanes[lane]
		sort.Slice(items, func(a, b int) bool { return items[a].Start < items[b].Start })
		kind, name := "Video", fmt.Sprintf("V%d", lane+1)
		if lane < 0 {
			kind, name = "Audio", fmt.Sprintf("A%d", -lane)
		}
		children := []interface{}{}
		cursor := int64(0)
		for _, clip := range items {
			start, length := tl.frames(clip.Start), tl.clipFrames(clip)
			if start > cursor {
				children = append(children, map[string]interface{}{"OTIO_SCHEMA": "Gap.1", "name": "", "source_range": otioRange(0, start-cursor, rate), "effects": []interface{}{}, "markers": []interface{}{}, "metadata": map[string]interface{}{}, "enabled": true})
			}
			markers := []interface{}{}
			for _, bin := range clip.Bins {
				markers = append(markers, map[string]interface{}{"OTIO_SCHEMA": "Marker.2", "name": bin, "color": colors[clip.Role], "comment": clip.Caption, "marked_range": otioRange(0, 1, rate), "metadata": map[string]interface{}{}})
			}
			children = append(children, map[string]interface{}{
				"OTIO_SCHEMA": "Clip.2", "name": clip.Name, "enabled": true,
				"source_range": otioRange(0, length, rate),
				"media_references": map[string]interface{}{"DEFAULT_MEDIA": map[string]interface{}{
					"OTIO_SCHEMA": "ExternalReference.1", "name": clip.Name, "target_url": clip.URL,
					"available_range": otioRange(0, length, rate), "available_image_bounds": nil, "metadata": map[string]interface{}{},
				}},
				"active_media_reference_key": "DEFAULT_MEDIA", "effects": []interface{}{}, "markers": markers,
				"metadata": map[string]interface{}{"manifoldgen": map[string]interface{}{"role": clip.Role, "shot": clip.Shot, "bins": clip.Bins, "caption": clip.Caption, "offset_seconds": clip.Offset, "sync_confidence": clip.Confidence, "synced": clip.Synced}},
			})
			cursor = start + length
		}
		tracks = append(tracks, map[string]interface{}{"OTIO_SCHEMA": "Track.1", "name": name, "kind": kind, "source_range": nil, "effects": []interface{}{}, "markers": []interface{}{}, "metadata": map[string]interface{}{}, "enabled": true, "children": children})
	}
	return json.MarshalIndent(map[string]interface{}{
		"OTIO_SCHEMA": "Timeline.1", "name": tl.Name, "global_start_time": otioTime(0, rate),
		"metadata": map[string]interface{}{"manifoldgen": map[string]interface{}{"bins": bins, "fps": rate}},
		"tracks":   map[string]interface{}{"OTIO_SCHEMA": "Stack.1", "name": "tracks", "source_range": nil, "effects": []interface{}{}, "markers": []interface{}{}, "metadata": map[string]interface{}{}, "enabled": true, "children": tracks},
	}, "", "  ")
}

func prodkitStudioAsset(id, name, kind, cloudURL, contentType string, duration float64, width, height int, start float64, track int, volume float64, size int64) map[string]interface{} {
	if kind == "audio" {
		track = 0
	}
	return map[string]interface{}{
		"id": id, "mediaID": id, "name": name, "kind": kind,
		"duration": duration, "width": width, "height": height,
		"trimStart": 0.0, "trimEnd": duration, "timelineStart": math.Max(0, start),
		"visualTrack": maxInt(0, minInt(11, track)), "volume": volume, "fadeIn": 0.0, "fadeOut": 0.0,
		"stageX": 0.0, "stageY": 0.0, "stageScale": 1.0, "stageRotation": 0.0,
		"adjustments": studioDefaultAdjustments(), "cloudURL": cloudURL,
		"contentType": contentType, "size": size, "lastModified": time.Now().UnixMilli(),
	}
}

func prodkitStudioDocument(assets []map[string]interface{}, width, height int) ([]byte, error) {
	if len(assets) == 0 {
		return nil, fmt.Errorf("no assets")
	}
	return json.Marshal(map[string]interface{}{
		"version": 5, "selectedID": assets[0]["id"], "assets": assets,
		"canvas": map[string]int{"width": width, "height": height}, "audioTrackVolume": 1.0,
	})
}

func buildProdkitFootageStudio(clips []*prodkitClip, bins []prodkitBin, tl prodkitTimeline) ([]byte, error) {
	track := map[int]int{}
	primary := "scene"
	hasScene := false
	for _, bin := range bins {
		hasScene = hasScene || bin.Type == "scene"
	}
	if !hasScene {
		primary = "role"
	}
	n := 0
	for _, bin := range bins {
		if bin.Type != primary {
			continue
		}
		for _, index := range bin.Clips {
			if _, set := track[index]; !set {
				track[index] = n
			}
		}
		n++
	}
	assets := []map[string]interface{}{}
	for _, clip := range clips {
		volume := 1.0
		if clip.Synced && !clip.Reference && clip.HasAudio {
			volume = 0
		}
		assets = append(assets, prodkitStudioAsset(uuid.NewString(), clip.Name, clip.Kind, clip.URL, prodkitClipContentType(clip), clip.Duration, clip.Width, clip.Height, clip.Start, track[clip.Index], volume, clip.Size))
	}
	return prodkitStudioDocument(assets, tl.Width, tl.Height)
}

func prodkitWriteUpload(ctx context.Context, workDir, name string, data []byte, userID, contentType string) (string, error) {
	path := filepath.Join(workDir, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		return "", err
	}
	return uploadProdkitFile(ctx, path, userID, contentType)
}

func runProdkitFootageSorter(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string, setStage func(string)) (map[string]interface{}, float64, error) {
	params := prodkitParams(req)
	urls := prodkitFootageClips(params)
	doSync := true
	if value, ok := params["sync"].(bool); ok {
		doSync = value
	}
	refIndex := -1
	if value, ok := params["reference_audio"].(float64); ok {
		refIndex = int(value)
	}
	clips := make([]*prodkitClip, len(urls))
	budget := int64(prodkitFootageMaxBytes)
	for i, raw := range urls {
		setStage(fmt.Sprintf("downloading clip %d/%d", i+1, len(urls)))
		if budget <= 0 {
			return nil, 0, prodkitUserError{"clips exceed the 2 GB total limit"}
		}
		path := filepath.Join(workDir, fmt.Sprintf("clip%02d%s", i, prodkitMediaExt(raw)))
		if err := prodkitFetchMedia(ctx, raw, path, budget); err != nil {
			if strings.Contains(err.Error(), "exceeds") {
				return nil, 0, prodkitUserError{"clips exceed the 2 GB total limit"}
			}
			return nil, 0, prodkitUserError{err.Error()}
		}
		info, err := os.Stat(path)
		if err != nil {
			return nil, 0, err
		}
		budget -= info.Size()
		clips[i] = &prodkitClip{Index: i, URL: raw, Name: prodkitClipName(raw, i), path: path, Size: info.Size()}
	}
	setStage("waiting for analyzer")
	release, err := acquireProdkitSlot(ctx, "local")
	if err != nil {
		return nil, 0, err
	}
	defer release()
	setStage("probing clips")
	frameDir := filepath.Join(workDir, "frames")
	if err := os.MkdirAll(frameDir, 0o755); err != nil {
		return nil, 0, err
	}
	for _, clip := range clips {
		info, err := prodkitProbeMedia(ctx, clip.path)
		if err != nil || info.Duration <= 0 || (!info.HasVideo && !info.HasAudio) {
			return nil, 0, prodkitUserError{fmt.Sprintf("clip %d is not a readable video or audio file", clip.Index+1)}
		}
		clip.Duration, clip.FPS, clip.Width, clip.Height = math.Round(info.Duration*1000)/1000, info.FPS, info.Width, info.Height
		clip.HasAudio, clip.Channels, clip.CreationTime, clip.Camera = info.HasAudio, info.Channels, info.CreationTime, info.Camera
		clip.Kind = "audio"
		if info.HasVideo {
			clip.Kind = "video"
			prodkitExtractFrames(ctx, clip, frameDir)
		}
	}
	setStage("captioning and listening")
	providerUSD := 0.0
	var mu sync.Mutex
	var wg sync.WaitGroup
	limiter := make(chan struct{}, 4)
	for _, clip := range clips {
		wg.Add(1)
		go func(clip *prodkitClip) {
			defer wg.Done()
			limiter <- struct{}{}
			defer func() { <-limiter }()
			if len(clip.frames) > 0 {
				if caption, err := prodkitCaptionClip(ctx, clip.frames); err == nil {
					mu.Lock()
					clip.Caption, clip.Scene, clip.talking = caption.Caption, caption.Scene, caption.Talking
					providerUSD += prodkitCaptionUSD
					mu.Unlock()
				}
			}
			if clip.HasAudio {
				env, rms, err := prodkitAudioEnvelope(ctx, clip.path, prodkitFootageAudioSec)
				if err != nil {
					log.Printf("[prodkit] footage audio clip=%d: %v", clip.Index, err)
					return
				}
				clip.Speech, clip.speechy = prodkitSpeechActivity(rms)
				clip.Speech = math.Round(clip.Speech*1000) / 1000
				if doSync {
					clip.env = env
				}
			}
		}(clip)
	}
	wg.Wait()
	if err := ctx.Err(); err != nil {
		return nil, 0, err
	}
	captioned := false
	for _, clip := range clips {
		captioned = captioned || clip.Caption != ""
		clip.Shot = prodkitShotType(clip.Caption)
		talkEvidence := clip.talking || prodkitHasAny(strings.ToLower(clip.Caption), prodkitTalkWords)
		switch {
		case clip.Kind == "audio":
			clip.Role, clip.Shot = "audio", "audio"
		case clip.speechy && (talkEvidence || clip.Caption == ""):
			clip.Role = "a-roll"
		default:
			clip.Role = "b-roll"
		}
	}
	bins := prodkitBuildBins(clips)
	reference := -1
	if doSync {
		setStage("syncing audio")
		reference = prodkitSyncClips(clips, refIndex)
	}
	prodkitFootageLayout(clips, doSync)
	fps := prodkitNumber(params, "fps", 0, 1, 120)
	tl := prodkitTimeline{Name: "ManifoldGen footage"}
	counts := map[float64]int{}
	for _, clip := range clips {
		if clip.Kind == "video" {
			counts[math.Round(clip.FPS*1000)/1000]++
			if clip.Width*clip.Height > tl.Width*tl.Height || clip.Reference {
				tl.Width, tl.Height = clip.Width, clip.Height
			}
		}
	}
	if fps == 0 {
		fps = 30
		best := 0
		for rate, count := range counts {
			if rate > 0 && (count > best || (count == best && rate < fps)) {
				fps, best = rate, count
			}
		}
	}
	if tl.Width <= 0 || tl.Height <= 0 {
		tl.Width, tl.Height = 1920, 1080
	}
	tl.Num, tl.Den = prodkitTimebase(fps)
	setStage("writing timelines")
	fcpxml, err := buildProdkitFCPXML(clips, bins, tl)
	if err != nil {
		return nil, 0, err
	}
	otio, err := buildProdkitOTIO(clips, bins, tl)
	if err != nil {
		return nil, 0, err
	}
	studio, err := buildProdkitFootageStudio(clips, bins, tl)
	if err != nil {
		return nil, 0, err
	}
	sheet, err := prodkitContactSheet(ctx, clips, workDir)
	if err != nil {
		return nil, 0, err
	}
	offsets := []map[string]interface{}{}
	for _, clip := range clips {
		if clip.HasAudio && doSync {
			offsets = append(offsets, map[string]interface{}{"clip": clip.Index, "name": clip.Name, "offset_seconds": clip.Offset, "confidence": clip.Confidence, "synced": clip.Synced, "reference": clip.Reference})
		}
	}
	binSummary := []map[string]interface{}{}
	for _, bin := range bins {
		binSummary = append(binSummary, map[string]interface{}{"name": bin.Name, "type": bin.Type, "count": len(bin.Clips)})
	}
	timebase := float64(tl.Den) / float64(tl.Num)
	reportBody, _ := json.MarshalIndent(map[string]interface{}{
		"clips": clips, "bins": bins, "reference_clip": reference, "timeline_fps": timebase, "sync": doSync,
		"captioned": captioned, "canvas": map[string]int{"width": tl.Width, "height": tl.Height},
		"note": "Timelines reference the original clip URLs; relink to local copies in your NLE if it cannot stream them.",
	}, "", "  ")
	setStage("uploading")
	result := map[string]interface{}{}
	for _, upload := range []struct {
		key, name, contentType string
		data                   []byte
	}{
		{"otio_url", "timeline.otio", "application/x-otio+json", otio},
		{"fcpxml_url", "timeline.fcpxml", "application/x-fcpxml+xml", fcpxml},
		{"studio_project_url", "studio.json", "application/json", studio},
		{"report_url", "report.json", "application/json", reportBody},
	} {
		publicURL, err := prodkitWriteUpload(ctx, workDir, upload.name, upload.data, job.UserID, upload.contentType)
		if err != nil {
			return nil, 0, err
		}
		result[upload.key] = publicURL
	}
	sheetURL, err := uploadProdkitFile(ctx, sheet, job.UserID, "image/jpeg")
	if err != nil {
		return nil, 0, err
	}
	result["contact_sheet_url"] = sheetURL
	if studioURL := prodkitSaveStudioProject(job.UserID, "Footage: "+truncateString(clips[0].Name, 60), studio); studioURL != "" {
		result["studio_url"] = studioURL
	}
	synced := 0
	for _, clip := range clips {
		if clip.Synced && doSync {
			synced++
		}
	}
	summary := map[string]interface{}{"clips": len(clips), "synced": synced, "bins": binSummary, "offsets": offsets, "captioned": captioned, "timeline_fps": timebase}
	if reference >= 0 {
		summary["reference_clip"] = clips[reference].Name
	}
	result["report"] = summary
	return result, providerUSD + 0.0005*float64(len(clips)), nil
}

func prodkitContactSheet(ctx context.Context, clips []*prodkitClip, workDir string) (string, error) {
	dir := filepath.Join(workDir, "sheet")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	black := filepath.Join(dir, "black.jpg")
	if err := prodkitRun(ctx, "contact sheet", "-f", "lavfi", "-i", fmt.Sprintf("color=c=0x1a1a1a:s=%dx%d", prodkitSheetW, prodkitSheetH), "-frames:v", "1", black); err != nil {
		return "", err
	}
	n := 0
	for _, clip := range clips {
		for j := 0; j < 3; j++ {
			src := black
			if j < len(clip.frames) {
				src = clip.frames[j]
			}
			blob, err := os.ReadFile(src)
			if err != nil {
				return "", err
			}
			if err := os.WriteFile(filepath.Join(dir, fmt.Sprintf("%03d.jpg", n)), blob, 0o644); err != nil {
				return "", err
			}
			n++
		}
	}
	out := filepath.Join(workDir, "contact_sheet.jpg")
	if err := prodkitRun(ctx, "contact sheet", "-framerate", "1", "-i", filepath.Join(dir, "%03d.jpg"), "-vf", fmt.Sprintf("tile=3x%d:padding=6:margin=6:color=0x111111", len(clips)), "-frames:v", "1", "-q:v", "3", out); err != nil {
		return "", err
	}
	return out, nil
}

var prodkitMatteVideo = func(ctx context.Context, videoURL string, seconds float64) (string, float64, error) {
	body, err := runFalQueuedJobWithin(ctx, "bria/video/background-removal", map[string]interface{}{
		"video_url": videoURL, "background_color": "Transparent", "output_container_and_codec": "webm_vp9", "preserve_audio": false,
	}, 15*time.Minute)
	if err != nil {
		log.Printf("[prodkit] composer matte: %v", err)
		return "", 0, prodkitUserError{"background removal failed; you were not charged"}
	}
	var out struct {
		Video struct {
			URL string `json:"url"`
		} `json:"video"`
	}
	_ = json.Unmarshal(body, &out)
	if out.Video.URL == "" {
		return "", 0, prodkitUserError{"background removal returned no video"}
	}
	return out.Video.URL, falVideoBackgroundRateUSD * math.Ceil(seconds), nil
}

var prodkitGenerateBackground = func(ctx context.Context, prompt, size, out string) (float64, error) {
	backend, secret := lofiLoopImageBackend()
	_, err := lofiloop.GenerateStill(ctx, lofiloop.StillRequest{
		Prompt: prompt + ", empty background plate, no people, cinematic lighting, high detail", Size: size, Steps: 8,
		BackendURL: backend, Secret: secret, OutputPath: out, Timeout: 3 * time.Minute,
	})
	if err != nil {
		log.Printf("[prodkit] composer background: %v", err)
		return 0, prodkitUserError{"could not generate the background image"}
	}
	return 0.004, nil
}

type prodkitColorStats struct {
	Mean, Std [3]float64
	N         int
}

func prodkitLinear(c float64) float64 {
	if c <= 0.04045 {
		return c / 12.92
	}
	return math.Pow((c+0.055)/1.055, 2.4)
}

func prodkitGamma(c float64) float64 {
	if c <= 0.0031308 {
		return 12.92 * c
	}
	return 1.055*math.Pow(c, 1/2.4) - 0.055
}

func prodkitLab(r, g, b float64) [3]float64 {
	r, g, b = prodkitLinear(r), prodkitLinear(g), prodkitLinear(b)
	x := (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047
	y := 0.2126*r + 0.7152*g + 0.0722*b
	z := (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883
	f := func(t float64) float64 {
		if t > 216.0/24389 {
			return math.Cbrt(t)
		}
		return (24389.0/27*t + 16) / 116
	}
	fx, fy, fz := f(x), f(y), f(z)
	return [3]float64{116*fy - 16, 500 * (fx - fy), 200 * (fy - fz)}
}

func prodkitRGB(lab [3]float64) [3]float64 {
	fy := (lab[0] + 16) / 116
	fx, fz := fy+lab[1]/500, fy-lab[2]/200
	inv := func(t float64) float64 {
		if t*t*t > 216.0/24389 {
			return t * t * t
		}
		return (116*t - 16) * 27 / 24389
	}
	x, y, z := inv(fx)*0.95047, inv(fy), inv(fz)*1.08883
	rgb := [3]float64{
		3.2406*x - 1.5372*y - 0.4986*z,
		-0.9689*x + 1.8758*y + 0.0415*z,
		0.0557*x - 0.2040*y + 1.0570*z,
	}
	for i := range rgb {
		rgb[i] = math.Max(0, math.Min(1, prodkitGamma(math.Max(0, rgb[i]))))
	}
	return rgb
}

func prodkitStatsRGBA(pixels []byte, alphaMin byte) prodkitColorStats {
	var stats prodkitColorStats
	var sum, sumSq [3]float64
	for i := 0; i+3 < len(pixels); i += 4 {
		if pixels[i+3] < alphaMin {
			continue
		}
		lab := prodkitLab(float64(pixels[i])/255, float64(pixels[i+1])/255, float64(pixels[i+2])/255)
		for c := 0; c < 3; c++ {
			sum[c] += lab[c]
			sumSq[c] += lab[c] * lab[c]
		}
		stats.N++
	}
	if stats.N == 0 {
		return stats
	}
	for c := 0; c < 3; c++ {
		stats.Mean[c] = sum[c] / float64(stats.N)
		stats.Std[c] = math.Sqrt(math.Max(0, sumSq[c]/float64(stats.N)-stats.Mean[c]*stats.Mean[c]))
	}
	return stats
}

func prodkitMatchLUT(fg, bg prodkitColorStats, size int) []byte {
	shift := [3]float64{0.3, 0.4, 0.4}
	var ratio [3]float64
	for c := 0; c < 3; c++ {
		ratio[c] = 1
		if fg.Std[c] > 0.5 {
			ratio[c] = 1 + (math.Max(0.7, math.Min(1.4, bg.Std[c]/fg.Std[c]))-1)*0.6
		}
	}
	var b strings.Builder
	fmt.Fprintf(&b, "TITLE \"ManifoldGen color match\"\nLUT_3D_SIZE %d\n", size)
	step := 1 / float64(size-1)
	for bi := 0; bi < size; bi++ {
		for gi := 0; gi < size; gi++ {
			for ri := 0; ri < size; ri++ {
				lab := prodkitLab(float64(ri)*step, float64(gi)*step, float64(bi)*step)
				for c := 0; c < 3; c++ {
					lab[c] = (lab[c]-fg.Mean[c])*ratio[c] + fg.Mean[c] + (bg.Mean[c]-fg.Mean[c])*shift[c]
				}
				rgb := prodkitRGB(lab)
				fmt.Fprintf(&b, "%.5f %.5f %.5f\n", rgb[0], rgb[1], rgb[2])
			}
		}
	}
	return []byte(b.String())
}

func prodkitSampleRGBA(ctx context.Context, input []string, filter string, frames int) ([]byte, error) {
	args := append([]string{"-v", "error"}, input...)
	args = append(args, "-vf", filter+",scale=96:54,format=rgba", "-frames:v", strconv.Itoa(frames), "-f", "rawvideo", "-pix_fmt", "rgba", "-")
	return exec.CommandContext(ctx, ffmpegBinary(), args...).Output()
}

type prodkitComposeOpts struct {
	W, H, FW, FH, X, Y int
	FPS                string
	Seconds            float64
	LUT                string
	LightWrap, Grain   float64
	Shadow, GradedOut  bool
}

func prodkitFilterPath(path string) string {
	return "'" + strings.NewReplacer(`\`, `\\`, `'`, `'\''`, `:`, `\:`).Replace(path) + "'"
}

func prodkitLabels(prefix string, n int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += fmt.Sprintf("[%s%d]", prefix, i)
	}
	return out
}

func prodkitComposeFilter(o prodkitComposeOpts) string {
	parts := []string{}
	bgSplit := 1
	if o.LightWrap > 0 {
		bgSplit = 2
	}
	parts = append(parts, fmt.Sprintf("[0:v]scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,setsar=1,fps=%s,format=rgba,split=%d%s", o.W, o.H, o.W, o.H, o.FPS, bgSplit, prodkitLabels("bg", bgSplit)))
	fg := "[1:v]format=rgba,setsar=1,fps=" + o.FPS
	if o.LUT != "" {
		fg += ",lut3d=file=" + prodkitFilterPath(o.LUT)
	}
	if o.GradedOut {
		fg += ",split=2[fga][fgsrc]"
	} else {
		fg += "[fgsrc]"
	}
	parts = append(parts, fg, fmt.Sprintf("[fgsrc]scale=%d:%d[fgs]", o.FW, o.FH))
	fgSplit := 1
	if o.Shadow {
		fgSplit++
	}
	if o.LightWrap > 0 {
		fgSplit++
	}
	parts = append(parts, fmt.Sprintf("color=c=black@0.0:s=%dx%d:r=%s:d=%.3f,format=rgba[cv]", o.W, o.H, o.FPS, o.Seconds+1),
		fmt.Sprintf("[cv][fgs]overlay=%d:%d:format=rgb,format=rgba,split=%d%s", o.X, o.Y, fgSplit, prodkitLabels("fgc", fgSplit)))
	base, next := "bg0", 1
	if o.Shadow {
		radius := maxInt(2, minInt(o.W, o.H)/80)
		parts = append(parts, fmt.Sprintf("[fgc%d]colorchannelmixer=rr=0:gg=0:bb=0:aa=0.55,format=yuva420p,boxblur=%d:2[sh]", next, radius),
			fmt.Sprintf("[%s][sh]overlay=%d:%d[shd]", base, maxInt(1, o.W/90), maxInt(1, o.H/50)))
		base = "shd"
		next++
	}
	parts = append(parts, fmt.Sprintf("[%s][fgc0]overlay=0:0[comp]", base))
	base = "comp"
	if o.LightWrap > 0 {
		inner := maxInt(2, minInt(o.W, o.H)/90)
		parts = append(parts, fmt.Sprintf("[fgc%d]alphaextract,split=2[a0][a1]", next),
			fmt.Sprintf("[a1]boxblur=%d:1[ab]", inner),
			fmt.Sprintf("[a0][ab]blend=all_expr='min(255,A*(255-B)/255*%.3f)'[edge]", 3*o.LightWrap),
			fmt.Sprintf("[bg1]boxblur=%d:1[bgb]", maxInt(4, minInt(o.W, o.H)/40)),
			"[bgb][edge]alphamerge[wrap]", "[comp][wrap]overlay=0:0[wrapped]")
		base = "wrapped"
	}
	final := fmt.Sprintf("[%s]format=yuv420p", base)
	if o.Grain > 0 {
		final += fmt.Sprintf(",noise=alls=%d:allf=t+u", maxInt(1, int(math.Round(o.Grain*30))))
	}
	return strings.Join(append(parts, final+"[v]"), ";")
}

func prodkitPlacement(position string, scale float64, w, h, fw0, fh0 int) (int, int, int, int) {
	k := math.Min(float64(w)/float64(fw0), float64(h)/float64(fh0)) * scale
	fw, fh := maxInt(2, int(math.Round(float64(fw0)*k/2))*2), maxInt(2, int(math.Round(float64(fh0)*k/2))*2)
	x, y := (w-fw)/2, (h-fh)/2
	margin := int(float64(w) * 0.05)
	switch position {
	case "left":
		x, y = margin, h-fh
	case "right":
		x, y = w-fw-margin, h-fh
	case "bottom":
		y = h - fh
	}
	return fw, fh, x, y
}

func prodkitEven(v int) int {
	return maxInt(2, v/2*2)
}

func prodkitCanvas(w, h int) (int, int) {
	if w <= 0 || h <= 0 {
		return 1280, 720
	}
	if long := maxInt(w, h); long > 1920 {
		w, h = w*1920/long, h*1920/long
	}
	return prodkitEven(w), prodkitEven(h)
}

func prodkitKeyColor(value string) string {
	switch value {
	case "", "green":
		return "0x00FF00"
	case "blue":
		return "0x0000FF"
	}
	return "0x" + strings.ToUpper(strings.TrimPrefix(strings.TrimPrefix(value, "#"), "0x"))
}

func runProdkitShotComposer(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string, setStage func(string)) (map[string]interface{}, float64, float64, error) {
	params := prodkitParams(req)
	chroma := prodkitComposerChroma(req)
	setStage("downloading")
	source := filepath.Join(workDir, "fg_source"+prodkitMediaExt(req.VideoURL))
	if err := prodkitFetchMedia(ctx, req.VideoURL, source, prodkitMaxVideo); err != nil {
		return nil, 0, 0, prodkitUserError{err.Error()}
	}
	probe, err := prodkitProbeMedia(ctx, source)
	if err != nil || !probe.HasVideo || probe.Duration <= 0 {
		return nil, 0, 0, prodkitUserError{"video_url is not a readable video"}
	}
	seconds := math.Min(probe.Duration, math.Min(prodkitComposerMaxSec, float64(req.Duration)))
	fps := prodkitFPS(probe.FPS)
	keepAudio := true
	if value, ok := params["keep_audio"].(bool); ok {
		keepAudio = value
	}
	matchColor := true
	if value, ok := params["match_color"].(bool); ok {
		matchColor = value
	}
	shadow, _ := params["shadow"].(bool)
	scale := prodkitNumber(params, "scale", 1, 0.3, 1.5)
	lightWrap := prodkitNumber(params, "light_wrap", 0, 0, 1)
	grain := prodkitNumber(params, "grain", 0, 0, 1)
	position := prodkitString(params, "position")
	if position == "" {
		position = "center"
	}
	setStage("waiting for compositor")
	release, err := acquireProdkitSlot(ctx, "local")
	if err != nil {
		return nil, 0, 0, err
	}
	defer release()
	setStage("preparing foreground")
	fgClip := filepath.Join(workDir, "fg.mp4")
	if err := prodkitRun(ctx, "foreground trim", "-i", source, "-t", fmt.Sprintf("%.3f", seconds), "-map", "0:v:0", "-map", "0:a:0?",
		"-vf", "scale='min(1920,iw)':-2,fps="+fps, "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", fgClip); err != nil {
		return nil, 0, 0, prodkitUserError{"could not read that video"}
	}
	providerUSD := 0.0
	matte := filepath.Join(workDir, "fg_alpha.webm")
	if chroma {
		setStage("keying")
		color := prodkitKeyColor(prodkitString(params, "key_color"))
		spill := "green"
		if rgb, err := strconv.ParseUint(strings.TrimPrefix(color, "0x"), 16, 32); err == nil && rgb&0xff > (rgb>>8)&0xff {
			spill = "blue"
		}
		if err := prodkitRun(ctx, "chroma key", "-i", fgClip, "-an", "-vf", fmt.Sprintf("format=yuva444p,chromakey=%s:0.14:0.08,format=rgba,despill=type=%s", color, spill),
			"-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "24", "-deadline", "realtime", "-cpu-used", "8", matte); err != nil {
			return nil, 0, 0, err
		}
	} else {
		setStage("removing background")
		fgURL, err := uploadProdkitFile(ctx, fgClip, job.UserID, "video/mp4")
		if err != nil {
			return nil, 0, 0, err
		}
		alphaURL, cost, err := prodkitMatteVideo(ctx, fgURL, seconds)
		if err != nil {
			return nil, 0, 0, err
		}
		providerUSD += cost
		if err := prodkitFetchMedia(ctx, alphaURL, matte, prodkitMaxVideo); err != nil {
			return nil, 0, 0, err
		}
	}
	matteInfo, err := prodkitProbeMedia(ctx, matte)
	if err != nil || matteInfo.Width <= 0 {
		return nil, 0, 0, prodkitUserError{"the foreground matte could not be read"}
	}
	setStage("preparing background")
	kind := prodkitComposerBackground(req)
	backgroundURL := ""
	background := filepath.Join(workDir, "background")
	var bgInfo prodkitMediaInfo
	switch kind {
	case "image":
		backgroundURL = req.ImageURL
		background += prodkitURLExt(req.ImageURL)
		if err := prodkitFetchMedia(ctx, req.ImageURL, background, prodkitMaxImage); err != nil {
			return nil, 0, 0, prodkitUserError{err.Error()}
		}
	case "video":
		backgroundURL = prodkitRawString(params, "background_video_url")
		background += prodkitMediaExt(backgroundURL)
		if err := prodkitFetchMedia(ctx, backgroundURL, background, prodkitMaxVideo); err != nil {
			return nil, 0, 0, prodkitUserError{err.Error()}
		}
	default:
		size := "1344x768"
		if matteInfo.Height > matteInfo.Width*11/10 {
			size = "768x1344"
		} else if matteInfo.Width <= matteInfo.Height*11/10 {
			size = "1024x1024"
		}
		background += ".png"
		cost, err := prodkitGenerateBackground(ctx, req.Prompt, size, background)
		if err != nil {
			return nil, 0, 0, err
		}
		providerUSD += cost
	}
	bgInfo, err = prodkitProbeMedia(ctx, background)
	if err != nil || bgInfo.Width <= 0 {
		return nil, 0, 0, prodkitUserError{"the background could not be read"}
	}
	if kind == "prompt" {
		if backgroundURL, err = uploadProdkitFile(ctx, background, job.UserID, "image/png"); err != nil {
			return nil, 0, 0, err
		}
	}
	w, h := prodkitCanvas(bgInfo.Width, bgInfo.Height)
	fw, fh, x, y := prodkitPlacement(position, scale, w, h, matteInfo.Width, matteInfo.Height)
	bgInput := []string{"-loop", "1", "-framerate", fps, "-t", fmt.Sprintf("%.3f", seconds+0.5), "-i", background}
	if kind == "video" {
		bgInput = []string{"-stream_loop", "-1", "-t", fmt.Sprintf("%.3f", seconds+0.5), "-i", background}
	}
	alphaInput := []string{"-c:v", "libvpx-vp9", "-i", matte}
	lut := ""
	if matchColor {
		setStage("matching color")
		fgPixels, fgErr := prodkitSampleRGBA(ctx, alphaInput, fmt.Sprintf("fps=%.4f", math.Max(0.2, 8/seconds)), 8)
		bgFilter, bgFrames := "null", 1
		if kind == "video" {
			bgFilter, bgFrames = "fps=1", 6
		}
		bgPixels, bgErr := prodkitSampleRGBA(ctx, []string{"-i", background}, bgFilter, bgFrames)
		fgStats, bgStats := prodkitStatsRGBA(fgPixels, 128), prodkitStatsRGBA(bgPixels, 0)
		if fgErr == nil && bgErr == nil && fgStats.N >= 50 && bgStats.N >= 50 {
			lut = filepath.Join(workDir, "match.cube")
			if err := os.WriteFile(lut, prodkitMatchLUT(fgStats, bgStats, 17), 0o644); err != nil {
				return nil, 0, 0, err
			}
		}
	}
	setStage("compositing")
	opts := prodkitComposeOpts{W: w, H: h, FW: fw, FH: fh, X: x, Y: y, FPS: fps, Seconds: seconds, LUT: lut, LightWrap: lightWrap, Grain: grain, Shadow: shadow, GradedOut: lut != ""}
	args := append(append(append([]string{}, bgInput...), alphaInput...), "-i", fgClip)
	args = append(args, "-filter_complex", prodkitComposeFilter(opts), "-map", "[v]")
	audio := keepAudio && probe.HasAudio
	if audio {
		args = append(args, "-map", "2:a:0?", "-c:a", "aac", "-b:a", "192k")
	}
	final := filepath.Join(workDir, "composite.mp4")
	args = append(args, "-t", fmt.Sprintf("%.3f", seconds), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", final)
	graded := filepath.Join(workDir, "fg_graded.webm")
	if opts.GradedOut {
		args = append(args, "-map", "[fga]", "-t", fmt.Sprintf("%.3f", seconds), "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-auto-alt-ref", "0", "-b:v", "0", "-crf", "30", "-deadline", "realtime", "-cpu-used", "8", graded)
	}
	if err := prodkitRun(ctx, "composite", args...); err != nil {
		return nil, 0, 0, err
	}
	if opts.GradedOut {
		matte = graded
	}
	setStage("uploading")
	videoURL, err := uploadProdkitFile(ctx, final, job.UserID, "video/mp4")
	if err != nil {
		return nil, 0, 0, err
	}
	alphaURL, err := uploadProdkitFile(ctx, matte, job.UserID, "video/webm")
	if err != nil {
		return nil, 0, 0, err
	}
	result := map[string]interface{}{
		"video_url": videoURL, "fg_alpha_url": alphaURL, "background_url": backgroundURL, "source_video_url": req.VideoURL,
		"duration_seconds": math.Round(seconds*100) / 100, "width": w, "height": h, "key": map[bool]string{true: "chroma", false: "ai"}[chroma],
		"position": position, "scale": scale, "color_matched": lut != "",
	}
	if lut != "" {
		if lutURL, err := uploadProdkitFile(ctx, lut, job.UserID, "text/x-cube"); err == nil {
			result["lut_url"] = lutURL
		}
	}
	bgKind, bgType := "image", map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}[prodkitURLExt(backgroundURL)]
	if bgType == "" {
		bgType = "image/png"
	}
	if kind == "video" {
		bgKind, bgType = "video", prodkitMediaTypes[prodkitMediaExt(backgroundURL)]
		if bgType == "" {
			bgType = "video/mp4"
		}
	}
	fgAsset := prodkitStudioAsset(uuid.NewString(), "Foreground (alpha)", "video", alphaURL, "video/webm", seconds, matteInfo.Width, matteInfo.Height, 0, 1, 0, 0)
	fgAsset["stageScale"] = scale
	fgAsset["stageX"] = math.Max(-0.48, math.Min(0.48, (float64(x)+float64(fw)/2)/float64(w)-0.5))
	fgAsset["stageY"] = math.Max(-0.48, math.Min(0.48, (float64(y)+float64(fh)/2)/float64(h)-0.5))
	assets := []map[string]interface{}{
		prodkitStudioAsset(uuid.NewString(), "Background", bgKind, backgroundURL, bgType, seconds, bgInfo.Width, bgInfo.Height, 0, 0, 0, 0),
		fgAsset,
	}
	if audio {
		track := filepath.Join(workDir, "fg_audio.m4a")
		if prodkitRun(ctx, "audio extract", "-i", fgClip, "-vn", "-c:a", "copy", track) == nil {
			if audioURL, err := uploadProdkitFile(ctx, track, job.UserID, "audio/mp4"); err == nil {
				result["audio_url"] = audioURL
				assets = append(assets, prodkitStudioAsset(uuid.NewString(), "Foreground audio", "audio", audioURL, "audio/mp4", seconds, 0, 0, 0, 0, 1, 0))
			}
		}
	}
	doc, err := prodkitStudioDocument(assets, w, h)
	if err != nil {
		return nil, 0, 0, err
	}
	studioURL, err := prodkitWriteUpload(ctx, workDir, "studio.json", doc, job.UserID, "application/json")
	if err != nil {
		return nil, 0, 0, err
	}
	result["studio_project_url"] = studioURL
	if open := prodkitSaveStudioProject(job.UserID, "Composite: "+truncateString(prodkitJobPrompt(req, prodkitTool{Title: "Shot Composer"}), 60), doc); open != "" {
		result["studio_url"] = open
	}
	return result, seconds, providerUSD + 0.0005*math.Ceil(seconds), nil
}
