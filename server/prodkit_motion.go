package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const (
	prodkitMotionFX    = "prodkit_motion_fx"
	prodkitBeatDrop    = "prodkit_beat_drop"
	prodkitMotionTrack = "prodkit_motion_track"
	prodkitMotionScore = "prodkit_motion_score"

	prodkitMotionFXRate          = 0.06
	prodkitMotionFXMin           = 0.15
	prodkitMotionFXMaxSec        = 20.0
	prodkitBeatDropRate          = 0.04
	prodkitBeatDropMin           = 0.10
	prodkitBeatDropMaxSec        = 30.0
	prodkitMotionTrackRate       = 0.02
	prodkitMotionTrackMin        = 0.05
	prodkitMotionTrackMaxS       = 60.0
	prodkitMotionScoreRate       = 0.05
	prodkitMotionScoreMin        = 0.20
	prodkitMotionScoreMaxS       = 30.0
	prodkitMotionCPUUSDPerSecond = 0.00016
	prodkitMotionMaxAudio        = 60 << 20
	prodkitMotionEstimateS       = 5.0
	prodkitMotionTimeout         = 20 * time.Minute
	prodkitMotionNoPeopleMs      = "no people found in the video; try a clip where a person is fully visible"
)

var prodkitMotionAspects = []string{"9:16", "4:5", "1:1", "16:9"}

var prodkitMotionPresets = []string{"anime-fight", "ki-aura", "lightning", "neon-trails", "game-hud", "spotlight", "slowmo-impacts", "exaggerate", "echo"}
var prodkitMotionPalettes = []string{"gold-blue", "fire", "neon", "ice"}
var prodkitMotionExtras = []string{"trails", "aura", "lightning", "speedlines", "impact"}

type prodkitMotionSpec struct {
	Rate, Min, MaxSec float64
	Worker            string
}

var prodkitMotionSpecs = map[string]prodkitMotionSpec{
	prodkitMotionFX:    {prodkitMotionFXRate, prodkitMotionFXMin, prodkitMotionFXMaxSec, "motion-fx"},
	prodkitBeatDrop:    {prodkitBeatDropRate, prodkitBeatDropMin, prodkitBeatDropMaxSec, "beat-drop"},
	prodkitMotionTrack: {prodkitMotionTrackRate, prodkitMotionTrackMin, prodkitMotionTrackMaxS, "motion-track"},
	prodkitMotionScore: {prodkitMotionScoreRate, prodkitMotionScoreMin, prodkitMotionScoreMaxS, "motion-score"},
}

// prodkitMotionPriceUSD charges per started second up to the tool cap, with a minimum.
func prodkitMotionPriceUSD(service string, seconds float64) float64 {
	spec, ok := prodkitMotionSpecs[service]
	if !ok {
		return 0
	}
	if seconds <= 0 {
		seconds = prodkitMotionEstimateS
	}
	price := spec.Rate * math.Ceil(math.Min(seconds, spec.MaxSec))
	return math.Round(math.Max(price, spec.Min)*1e6) / 1e6
}

func prodkitMotionEstimateUSD(req ServiceUsageRequest) float64 {
	return prodkitMotionPriceUSD(req.Service, float64(req.Duration))
}

func prodkitMotionEnum(params map[string]interface{}, key string, allowed []string) error {
	if _, ok := params[key]; !ok {
		return nil
	}
	if err := prodkitParamType(params, key, "string"); err != nil {
		return err
	}
	value := prodkitString(params, key)
	for _, item := range allowed {
		if value == item {
			return nil
		}
	}
	return fmt.Errorf("params.%s must be one of %s", key, strings.Join(allowed, ", "))
}

func prodkitMotionInt(params map[string]interface{}, key string, lo, hi float64) error {
	if _, ok := params[key]; !ok {
		return nil
	}
	if err := prodkitParamType(params, key, "number"); err != nil {
		return err
	}
	value := params[key].(float64)
	if value != math.Trunc(value) || value < lo || value > hi {
		return fmt.Errorf("params.%s must be a whole number from %.0f to %.0f", key, lo, hi)
	}
	return nil
}

func prodkitMotionStrings(params map[string]interface{}, key string, maxItems, maxLen int, allowed []string) error {
	value, ok := params[key]
	if !ok {
		return nil
	}
	list, isList := value.([]interface{})
	if !isList {
		return fmt.Errorf("params.%s must be an array of strings", key)
	}
	if len(list) > maxItems {
		return fmt.Errorf("params.%s allows at most %d items", key, maxItems)
	}
	for _, item := range list {
		text, isString := item.(string)
		if !isString {
			return fmt.Errorf("params.%s must be an array of strings", key)
		}
		if len([]rune(strings.TrimSpace(text))) > maxLen {
			return fmt.Errorf("params.%s items must be at most %d characters", key, maxLen)
		}
		if allowed != nil {
			found := false
			for _, option := range allowed {
				found = found || strings.ToLower(strings.TrimSpace(text)) == option
			}
			if !found {
				return fmt.Errorf("params.%s items must be one of %s", key, strings.Join(allowed, ", "))
			}
		}
	}
	return nil
}

func normalizeProdkitMotion(req *ServiceUsageRequest, params map[string]interface{}) error {
	spec := prodkitMotionSpecs[req.Service]
	if req.VideoURL == "" {
		return fmt.Errorf("video_url is required")
	}
	req.AudioURL = strings.TrimSpace(req.AudioURL)
	if req.AudioURL != "" {
		if err := validateProdkitURL(req.AudioURL); err != nil {
			return err
		}
	}
	if req.Service == prodkitBeatDrop && req.AudioURL == "" {
		return fmt.Errorf("audio_url (the song) is required")
	}
	for key, kind := range map[string]string{"intensity": "number", "slowmo": "bool", "sfx": "bool", "text": "bool", "keep_audio": "bool", "audio_start": "number"} {
		if err := prodkitParamType(params, key, kind); err != nil {
			return err
		}
	}
	if err := prodkitMotionEnum(params, "preset", prodkitMotionPresets); err != nil {
		return err
	}
	if err := prodkitMotionEnum(params, "aspect", prodkitMotionAspects); err != nil {
		return err
	}
	if err := prodkitMotionEnum(params, "palette", prodkitMotionPalettes); err != nil {
		return err
	}
	if err := prodkitMotionInt(params, "target", 1, 8); err != nil {
		return err
	}
	if err := prodkitMotionInt(params, "seed", 0, 1<<30); err != nil {
		return err
	}
	if err := prodkitMotionStrings(params, "names", 4, 16, nil); err != nil {
		return err
	}
	if err := prodkitMotionStrings(params, "extra", len(prodkitMotionExtras), 12, prodkitMotionExtras); err != nil {
		return err
	}
	if value, ok := params["intensity"].(float64); ok {
		params["intensity"] = math.Max(0.3, math.Min(1.6, value))
		raw, _ := json.Marshal(params)
		req.Params = raw
	}
	if req.Duration < 0 || req.Duration > int(spec.MaxSec) {
		req.Duration = int(spec.MaxSec)
	}
	return nil
}

var prodkitMotionProbe = prodkitProbeMedia

func prodkitMotionRoot() string {
	if dir := strings.TrimSpace(os.Getenv("PRODKIT_MOTION_DIR")); dir != "" {
		return dir
	}
	for _, dir := range []string{"workers/motiontrack", "../workers/motiontrack"} {
		if _, err := os.Stat(filepath.Join(dir, "motiontrack", "job.py")); err == nil {
			abs, _ := filepath.Abs(dir)
			return abs
		}
	}
	return "workers/motiontrack"
}

func prodkitMotionPython() string {
	if bin := strings.TrimSpace(os.Getenv("PRODKIT_MOTION_PYTHON")); bin != "" {
		return bin
	}
	return filepath.Join(prodkitMotionRoot(), ".venv", "bin", "python")
}

var prodkitMotionAvailable = func() bool {
	if _, err := os.Stat(prodkitMotionPython()); err != nil {
		return false
	}
	_, err := os.Stat(filepath.Join(prodkitMotionRoot(), "motiontrack", "job.py"))
	return err == nil
}

func prodkitMotionEnv(workDir string) []string {
	home := strings.TrimSpace(os.Getenv("PRODKIT_MOTION_HOME"))
	if home == "" {
		home = os.Getenv("HOME")
	}
	path := "/usr/local/bin:/usr/bin:/bin"
	if dir := filepath.Dir(ffmpegBinary()); dir != "." && dir != "" && !strings.Contains(path, dir) {
		path = dir + ":" + path
	}
	env := []string{"HOME=" + home, "TMPDIR=" + workDir, "PATH=" + path, "PYTHONDONTWRITEBYTECODE=1", "MPLBACKEND=Agg"}
	for _, key := range []string{"LD_LIBRARY_PATH", "CUDA_VISIBLE_DEVICES", "OMP_NUM_THREADS", "OPENBLAS_NUM_THREADS", "ORT_NUM_THREADS"} {
		if value := os.Getenv(key); value != "" {
			env = append(env, key+"="+value)
		}
	}
	return env
}

// prodkitMotionWorker runs the motiontrack job contract; the exit code is returned for bad-input handling.
var prodkitMotionWorker = func(ctx context.Context, workDir, argsPath string) (int, error) {
	cmd := exec.CommandContext(ctx, prodkitMotionPython(), "-m", "motiontrack.cli", "job", argsPath)
	cmd.Dir = prodkitMotionRoot()
	cmd.Env = prodkitMotionEnv(workDir)
	cmd.Env = append(cmd.Env, "PYTHONPATH="+prodkitMotionRoot())
	var out bytes.Buffer
	cmd.Stdout, cmd.Stderr = &out, &out
	err := cmd.Run()
	var exit *exec.ExitError
	if errors.As(err, &exit) {
		log.Printf("[prodkit] motion worker exit %d: %s", exit.ExitCode(), tailOutput(out.Bytes()))
		return exit.ExitCode(), nil
	}
	if err != nil {
		return -1, err
	}
	return 0, nil
}

type prodkitMotionManifest struct {
	OK          bool                     `json:"ok"`
	Error       string                   `json:"error"`
	Video       string                   `json:"video"`
	Poster      string                   `json:"poster"`
	Tracks      string                   `json:"tracks"`
	Signals     string                   `json:"signals"`
	Preview     string                   `json:"preview"`
	Guide       string                   `json:"guide"`
	Audio       string                   `json:"audio"`
	Cues        string                   `json:"cues"`
	Seconds     float64                  `json:"seconds"`
	Width       int                      `json:"width"`
	Height      int                      `json:"height"`
	TracksCount int                      `json:"tracks_count"`
	EventsCount int                      `json:"events_count"`
	BPM         float64                  `json:"bpm"`
	AudioBPM    float64                  `json:"audio_bpm"`
	Preset      string                   `json:"preset"`
	MusicPrompt string                   `json:"music_prompt"`
	Music       map[string]interface{}   `json:"music"`
	SlowmoHits  int                      `json:"slowmo_hits"`
	Events      []map[string]interface{} `json:"events"`
	Stats       map[string]interface{}   `json:"stats"`
}

func prodkitMotionParams(req ServiceUsageRequest, seconds float64) map[string]interface{} {
	params := prodkitParams(req)
	out := map[string]interface{}{"max_seconds": seconds}
	for _, key := range []string{"preset", "intensity", "palette", "slowmo", "sfx", "text", "target", "names", "extra", "seed", "keep_audio", "audio_start", "aspect"} {
		if value, ok := params[key]; ok {
			out[key] = value
		}
	}
	if req.Service == prodkitBeatDrop {
		delete(out, "preset")
	}
	return out
}

// runProdkitMotion returns the result, the source seconds that were processed (the billing unit) and provider cost.
func runProdkitMotion(ctx context.Context, job *VideoJob, req ServiceUsageRequest, workDir string, setStage func(string)) (map[string]interface{}, float64, float64, error) {
	spec, ok := prodkitMotionSpecs[req.Service]
	if !ok {
		return nil, 0, 0, fmt.Errorf("unsupported motion tool")
	}
	setStage("downloading")
	source := filepath.Join(workDir, "source"+prodkitMediaExt(req.VideoURL))
	if err := prodkitFetchMedia(ctx, req.VideoURL, source, prodkitMaxVideo); err != nil {
		return nil, 0, 0, prodkitUserError{err.Error()}
	}
	probe, err := prodkitMotionProbe(ctx, source)
	if err != nil || !probe.HasVideo || probe.Duration <= 0 {
		return nil, 0, 0, prodkitUserError{"video_url is not a readable video"}
	}
	limit := spec.MaxSec
	if req.Duration > 0 {
		limit = math.Min(limit, float64(req.Duration))
	}
	seconds := math.Min(probe.Duration, limit)
	args := map[string]interface{}{"tool": spec.Worker, "video": source, "out": filepath.Join(workDir, "motion-out"), "device": "cpu",
		"params": prodkitMotionParams(req, seconds)}
	if req.AudioURL != "" {
		audio := filepath.Join(workDir, "audio"+prodkitMediaExt(req.AudioURL))
		if err := prodkitFetchMedia(ctx, req.AudioURL, audio, prodkitMotionMaxAudio); err != nil {
			return nil, 0, 0, prodkitUserError{err.Error()}
		}
		switch req.Service {
		case prodkitMotionScore:
			args["music"] = audio
		case prodkitMotionTrack:
		default:
			args["audio"] = audio
		}
	}
	setStage("waiting for motion worker")
	release, err := acquireProdkitSlot(ctx, "motion")
	if err != nil {
		return nil, 0, 0, err
	}
	defer release()
	setStage("tracking and rendering")
	outDir := filepath.Join(workDir, "motion-out")
	argsPath := filepath.Join(workDir, "motion-args.json")
	raw, _ := json.Marshal(args)
	if err := os.WriteFile(argsPath, raw, 0o644); err != nil {
		return nil, 0, 0, err
	}
	started := time.Now()
	code, err := prodkitMotionWorker(ctx, workDir, argsPath)
	if err != nil {
		return nil, 0, 0, err
	}
	var manifest prodkitMotionManifest
	blob, readErr := os.ReadFile(filepath.Join(outDir, "manifest.json"))
	if readErr != nil || json.Unmarshal(blob, &manifest) != nil {
		return nil, 0, 0, fmt.Errorf("motion worker exit %d without a manifest", code)
	}
	if !manifest.OK {
		if code == 2 {
			return nil, 0, 0, prodkitUserError{truncateString(manifest.Error, 200)}
		}
		return nil, 0, 0, fmt.Errorf("motion worker: %s", manifest.Error)
	}
	if code != 0 {
		return nil, 0, 0, fmt.Errorf("motion worker exit %d", code)
	}
	if req.Service != prodkitBeatDrop && manifest.TracksCount == 0 {
		return nil, 0, 0, prodkitUserError{prodkitMotionNoPeopleMs}
	}
	setStage("uploading")
	result := map[string]interface{}{
		"source_video_url": req.VideoURL, "duration_seconds": math.Round(seconds*100) / 100, "seconds": manifest.Seconds,
		"width": manifest.Width, "height": manifest.Height, "tracks_count": manifest.TracksCount, "events_count": manifest.EventsCount,
		"bpm": manifest.BPM, "tool": spec.Worker,
	}
	if manifest.Preset != "" {
		result["preset"] = manifest.Preset
	}
	if manifest.AudioBPM > 0 {
		result["audio_bpm"] = manifest.AudioBPM
	}
	if manifest.MusicPrompt != "" {
		result["music_prompt"] = manifest.MusicPrompt
	}
	if manifest.Music != nil {
		result["music"] = manifest.Music
	}
	if manifest.Stats != nil {
		result["stats"] = manifest.Stats
	}
	if manifest.SlowmoHits > 0 {
		result["slowmo_hits"] = manifest.SlowmoHits
	}
	if len(manifest.Events) > 0 {
		events := manifest.Events
		if len(events) > 64 {
			events = events[:64]
		}
		result["events"] = events
	}
	files := []struct{ name, key, contentType string }{
		{manifest.Video, "video_url", "video/mp4"}, {manifest.Poster, "poster_url", "image/jpeg"},
		{manifest.Tracks, "tracks_url", "application/json"}, {manifest.Signals, "signals_url", "application/json"},
		{manifest.Preview, "preview_url", "video/mp4"}, {manifest.Guide, "guide_url", "video/mp4"},
		{manifest.Audio, "audio_url", "audio/wav"}, {manifest.Cues, "cues_url", "application/json"},
	}
	for _, file := range files {
		if file.name == "" {
			continue
		}
		if file.name != filepath.Base(file.name) {
			return nil, 0, 0, fmt.Errorf("motion worker returned an unsafe file name")
		}
		link, err := uploadProdkitFile(ctx, filepath.Join(outDir, file.name), job.UserID, file.contentType)
		if err != nil {
			if file.key == "video_url" || file.key == "preview_url" {
				return nil, 0, 0, err
			}
			log.Printf("[prodkit] job=%s motion upload %s: %v", job.ID, file.key, err)
			continue
		}
		result[file.key] = link
	}
	if _, ok := result["video_url"]; !ok {
		if preview, ok := result["preview_url"]; ok {
			result["video_url"] = preview
		} else {
			return nil, 0, 0, fmt.Errorf("motion worker produced no video")
		}
	}
	elapsed := time.Since(started).Seconds()
	return result, seconds, prodkitMotionCPUUSDPerSecond * elapsed, nil
}
