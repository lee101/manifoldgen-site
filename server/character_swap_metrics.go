package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"manifoldgen-site/lofiloop"
)

const (
	characterSwapScoreTimeout   = 12 * time.Minute
	characterSwapScoreMinimum   = 50.0
	characterSwapPoseFlag       = 0.5
	characterSwapLeakPenalty    = 25.0
	characterSwapScoreMaxMisses = 3
	characterSwapBGDriftLimit   = 25.0
	characterSwapBGPenalty      = 15.0
)

// swapScoreReport is the JSON written by tools/swapscore/swapscore.py.
type swapScoreReport map[string]interface{}

type characterSwapClipMetrics struct {
	Overall  float64 `json:"overall"`
	Pose     float64 `json:"pose_err"`
	Framing  float64 `json:"framing"`
	Identity float64 `json:"identity"`
	Lipsync  float64 `json:"lipsync"`
	BGDrift  float64 `json:"bg_drift"`
}

var (
	characterSwapScoreSlots    = make(chan struct{}, 1)
	characterSwapScoreOnce     sync.Once
	characterSwapScoreMisses   int32
	characterSwapScoreDisabled int32
)

func (r swapScoreReport) section(name string) map[string]interface{} {
	section, _ := r[name].(map[string]interface{})
	return section
}

func swapScoreNumber(value interface{}) (float64, bool) {
	switch v := value.(type) {
	case float64:
		return v, !math.IsNaN(v) && !math.IsInf(v, 0)
	case json.Number:
		f, err := v.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(v, 64)
		return f, err == nil
	}
	return 0, false
}

func (r swapScoreReport) overall() (float64, bool) {
	return swapScoreNumber(r["overall"])
}

func (r swapScoreReport) sectionNumber(section, key string) (float64, bool) {
	return swapScoreNumber(r.section(section)[key])
}

func (r swapScoreReport) summary() characterSwapClipMetrics {
	var m characterSwapClipMetrics
	m.Overall, _ = r.overall()
	m.Pose, _ = r.sectionNumber("pose", "joint_err_torso")
	m.Framing, _ = r.sectionNumber("framing", "score")
	m.Identity, _ = r.sectionNumber("identity", "score")
	m.Lipsync, _ = r.sectionNumber("lipsync", "score")
	m.BGDrift, _ = r.sectionNumber("background", "color_drift")
	return m
}

// publicResult keeps the sections the job result exposes; everything else in
// the CLI output stays internal.
func (r swapScoreReport) publicResult() map[string]interface{} {
	out := map[string]interface{}{"available": true}
	for _, key := range []string{"overall", "pose", "framing", "identity", "lipsync", "background", "jumps", "repeat_composition", "per_shot", "verdict"} {
		if value, ok := r[key]; ok {
			out[key] = value
		}
	}
	return out
}

func characterSwapScoreMin() float64 {
	if v, err := strconv.ParseFloat(strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE_MIN", "")), 64); err == nil && v > 0 {
		return v
	}
	return characterSwapScoreMinimum
}

// characterSwapBGLimit is the clip background drift (Lab dE against its source
// segment) above which a clip is regenerated; the metric's own overall weight
// for background is only 5%, so a black wall barely moves the overall score.
func characterSwapBGLimit() float64 {
	if v, err := strconv.ParseFloat(strings.TrimSpace(getEnv("CHARACTER_SWAP_BG_DRIFT", "")), 64); err == nil && v > 0 {
		return v
	}
	return characterSwapBGDriftLimit
}

func characterSwapPoseFlagLimit() float64 {
	if v, err := strconv.ParseFloat(strings.TrimSpace(getEnv("CHARACTER_SWAP_POSE_FLAG", "")), 64); err == nil && v > 0 {
		return v
	}
	return characterSwapPoseFlag
}

func characterSwapScoreScriptCandidates() []string {
	var candidates []string
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		candidates = append(candidates, filepath.Join(dir, "tools", "swapscore", "swapscore.py"), filepath.Join(dir, "..", "tools", "swapscore", "swapscore.py"))
	}
	return append(candidates, filepath.Join("tools", "swapscore", "swapscore.py"), filepath.Join("..", "tools", "swapscore", "swapscore.py"))
}

// characterSwapScoreCommand resolves how to run the metrics CLI:
// CHARACTER_SWAP_SCORE_PYTHON + CHARACTER_SWAP_SCORE_SCRIPT, defaulting to
// `uv run tools/swapscore/swapscore.py` found next to the binary or the
// working directory. ok is false when the script or interpreter is missing.
func characterSwapScoreCommand() (name string, prefix []string, ok bool) {
	if strings.EqualFold(strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE", "true")), "false") || atomic.LoadInt32(&characterSwapScoreDisabled) != 0 {
		return "", nil, false
	}
	script := strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE_SCRIPT", ""))
	if script == "" {
		for _, candidate := range characterSwapScoreScriptCandidates() {
			if _, err := os.Stat(candidate); err == nil {
				script = candidate
				break
			}
		}
	}
	if script == "" {
		return "", nil, false
	}
	if _, err := os.Stat(script); err != nil {
		return "", nil, false
	}
	if python := strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE_PYTHON", "")); python != "" {
		if _, err := exec.LookPath(python); err != nil {
			return "", nil, false
		}
		return python, []string{script}, true
	}
	uv, err := exec.LookPath("uv")
	if err != nil {
		return "", nil, false
	}
	return uv, []string{"run", script}, true
}

// characterSwapScoreSkipReason explains why metrics cannot run, or returns "".
func characterSwapScoreSkipReason() string {
	if strings.EqualFold(strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE", "true")), "false") {
		return "disabled by CHARACTER_SWAP_SCORE=false"
	}
	if atomic.LoadInt32(&characterSwapScoreDisabled) != 0 {
		return "disabled after repeated swapscore failures"
	}
	if _, _, ok := characterSwapScoreCommand(); ok {
		return ""
	}
	if script := strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE_SCRIPT", "")); script != "" {
		if _, err := os.Stat(script); err != nil {
			return "swapscore script not found: " + script
		}
	} else if !characterSwapScoreDefaultScriptExists() {
		return "swapscore script tools/swapscore/swapscore.py not deployed next to the server (set CHARACTER_SWAP_SCORE_SCRIPT)"
	}
	if python := strings.TrimSpace(getEnv("CHARACTER_SWAP_SCORE_PYTHON", "")); python != "" {
		return "swapscore interpreter not found: " + python
	}
	return "swapscore interpreter not found (set CHARACTER_SWAP_SCORE_PYTHON or install uv)"
}

func characterSwapScoreDefaultScriptExists() bool {
	for _, candidate := range characterSwapScoreScriptCandidates() {
		if _, err := os.Stat(candidate); err == nil {
			return true
		}
	}
	return false
}

func characterSwapScoreAvailable() bool {
	reason := characterSwapScoreSkipReason()
	if reason != "" {
		characterSwapScoreOnce.Do(func() {
			log.Printf("[character-swap] objective metrics unavailable: %s", reason)
		})
	}
	return reason == ""
}

// runCharacterSwapScore scores output against source; refs are character
// photos. It returns false when the CLI is unavailable or fails, and stops
// trying after repeated failures with no success.
func runCharacterSwapScore(ctx context.Context, sourcePath, outputPath string, refs []string, workDir string) (swapScoreReport, error) {
	name, prefix, ok := characterSwapScoreCommand()
	if !ok {
		reason := characterSwapScoreSkipReason()
		if reason == "" {
			reason = "swapscore unavailable"
		}
		return nil, fmt.Errorf("%s", reason)
	}
	jsonPath := filepath.Join(workDir, fmt.Sprintf("score-%d.json", time.Now().UnixNano()))
	args := append(append([]string{}, prefix...), "--source", sourcePath, "--output", outputPath)
	for _, ref := range refs {
		args = append(args, "--ref", ref)
	}
	args = append(args, "--json", jsonPath)
	args = append(args, strings.Fields(getEnv("CHARACTER_SWAP_SCORE_ARGS", ""))...)
	characterSwapScoreSlots <- struct{}{}
	defer func() { <-characterSwapScoreSlots }()
	runCtx, cancel := context.WithTimeout(ctx, characterSwapScoreTimeout)
	defer cancel()
	cmd := exec.CommandContext(runCtx, name, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	fail := func(reason string) (swapScoreReport, error) {
		if atomic.AddInt32(&characterSwapScoreMisses, 1) >= characterSwapScoreMaxMisses {
			if atomic.CompareAndSwapInt32(&characterSwapScoreDisabled, 0, 1) {
				log.Printf("[character-swap] objective metrics disabled after repeated failures: %s", reason)
			}
		}
		return nil, fmt.Errorf("swapscore failed: %s", reason)
	}
	if err := cmd.Run(); err != nil {
		return fail(truncateString(err.Error()+": "+tailOutput(stderr.Bytes()), 300))
	}
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fail("no metrics file written")
	}
	_ = os.Remove(jsonPath)
	var report swapScoreReport
	if err := json.Unmarshal(data, &report); err != nil {
		return fail("metrics file unreadable")
	}
	if _, ok := report.overall(); !ok {
		return fail("metrics file has no overall score")
	}
	atomic.StoreInt32(&characterSwapScoreMisses, 0)
	return report, nil
}

// characterSwapScoreRefs downloads the character photos used for the identity
// metric: the request photos, otherwise the face crops cut from the swapped
// frame, otherwise the swapped frame itself.
func characterSwapScoreRefs(ctx context.Context, state characterSwapState, workDir string) []string {
	urls := append([]string{}, state.Request.ReferenceImageURLs...)
	if len(urls) == 0 && len(state.IdentityURLs) >= 2 && len(state.IdentityURLs)%2 == 0 {
		urls = append(urls, state.IdentityURLs[:len(state.IdentityURLs)/2]...)
	}
	if len(urls) == 0 && state.SwappedImageURL != "" {
		urls = []string{state.SwappedImageURL}
	}
	var refs []string
	for i, u := range urls {
		if i >= 4 {
			break
		}
		path := filepath.Join(workDir, fmt.Sprintf("score-ref-%d.img", i))
		if _, err := os.Stat(path); err != nil {
			if err := downloadURLToFile(ctx, u, path); err != nil {
				continue
			}
		}
		refs = append(refs, path)
	}
	return refs
}

// characterSwapClipSegments cuts the usable part of a source chunk and of a
// generated clip into matching 1280x720 24 fps files; the output segment
// carries the source audio so the lip-sync metric has sound to listen to.
func characterSwapClipSegments(ctx context.Context, chunk characterSwapChunk, sourcePath, clipPath, workDir, tag string) (string, string, error) {
	srcSeg := filepath.Join(workDir, fmt.Sprintf("seg-src-%02d.mp4", chunk.Index))
	if _, err := os.Stat(srcSeg); err != nil {
		if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Start), "-i", sourcePath, "-t", trimSeconds(chunk.Length),
			"-vf", "fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p",
			"-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "128k", "-ac", "2", "-ar", "44100", srcSeg); err != nil {
			return "", "", err
		}
	}
	outSeg := filepath.Join(workDir, fmt.Sprintf("seg-out-%02d-%s.mp4", chunk.Index, tag))
	args := []string{"-y", "-loglevel", "error", "-ss", trimSeconds(chunk.Lead), "-i", clipPath, "-i", srcSeg, "-t", trimSeconds(chunk.Length),
		"-map", "0:v:0", "-map", "1:a:0?", "-vf", "fps=24,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p",
		"-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-c:a", "aac", "-b:a", "128k", "-shortest", outSeg}
	if err := lofiloop.RunFFmpeg(ctx, args...); err != nil {
		return "", "", err
	}
	return srcSeg, outSeg, nil
}

// characterSwapClipScore combines the metrics overall score with the vision
// leak verdict into one comparable number.
func characterSwapClipScore(overall float64, leaked bool, leakCount int, bgDrift float64) float64 {
	score := overall
	if leaked {
		score -= characterSwapLeakPenalty + 5*float64(leakCount)
	}
	if limit := characterSwapBGLimit(); bgDrift > limit {
		score -= characterSwapBGPenalty + (bgDrift - limit)
	}
	return score
}

type characterSwapAttempt struct {
	URL       string
	Path      string
	Leaked    bool
	LeakCount int
	Reason    string
	Metrics   *characterSwapClipMetrics
	Report    swapScoreReport
	Score     float64
}

// better reports whether a beats b: by combined metric score when both have
// metrics, otherwise by the least-leaking attempt.
func (a characterSwapAttempt) better(b characterSwapAttempt) bool {
	if a.Metrics != nil && b.Metrics != nil {
		return a.Score > b.Score
	}
	if a.Leaked != b.Leaked {
		return !a.Leaked
	}
	return a.LeakCount < b.LeakCount
}

// gate returns why the attempt must be regenerated, or "" when it passes: a
// vision leak, a background colour drift over the limit, or a combined score
// under the threshold.
func (a characterSwapAttempt) gate(threshold float64) string {
	if a.Leaked {
		return "leak"
	}
	if a.Metrics == nil {
		return ""
	}
	if a.Metrics.BGDrift > characterSwapBGLimit() {
		return fmt.Sprintf("background drift %.0f > %.0f", a.Metrics.BGDrift, characterSwapBGLimit())
	}
	if a.Score < threshold {
		return fmt.Sprintf("score %.1f < %.0f", a.Score, threshold)
	}
	return ""
}

func (a characterSwapAttempt) acceptable(threshold float64) bool {
	return a.gate(threshold) == ""
}

func (a characterSwapAttempt) describe() string {
	parts := []string{}
	if a.Metrics != nil {
		parts = append(parts, fmt.Sprintf("score %.1f (overall %.1f pose %.2f framing %.0f identity %.0f lipsync %.0f bg %.1f)", a.Score, a.Metrics.Overall, a.Metrics.Pose, a.Metrics.Framing, a.Metrics.Identity, a.Metrics.Lipsync, a.Metrics.BGDrift))
	}
	if a.Leaked {
		parts = append(parts, "leak: "+a.Reason)
	} else if a.Reason != "" && a.Metrics == nil {
		parts = append(parts, a.Reason)
	}
	return strings.Join(parts, "; ")
}
