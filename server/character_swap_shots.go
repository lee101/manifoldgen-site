package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"log"
	"math"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"manifoldgen-site/lofiloop"
)

const (
	characterSwapKeyframeModel    = "gemini-nano-banana-2.1"
	characterSwapKeyframeRetries  = 2
	characterSwapKeyframeMinShots = 3
	characterSwapKeyframeUSD      = 0.036
	characterSwapKeyframeTimeout  = 6 * time.Minute
	characterSwapKeyframeMaxRefs  = 4
)

type characterSwapShotPerson struct {
	Box  [4]float64 `json:"box"`
	Face bool       `json:"face"`
}

type characterSwapShotCheck struct {
	SrcPeople  int      `json:"src_people"`
	OutPeople  int      `json:"out_people"`
	SrcFaces   int      `json:"src_faces"`
	OutFaces   int      `json:"out_faces"`
	MeanIoU    float64  `json:"mean_iou"`
	ScaleRatio float64  `json:"scale_ratio"`
	OK         bool     `json:"ok"`
	Reasons    []string `json:"reasons"`
	BgSrc      string   `json:"bg_src"`
	BgOut      string   `json:"bg_out"`
	BgName     string   `json:"bg_name"`
	BgDE       float64  `json:"bg_de"`
}

type characterSwapBackground struct {
	Hex      string    `json:"hex"`
	Name     string    `json:"name"`
	Lab      []float64 `json:"lab"`
	Coverage float64   `json:"coverage"`
}

// phrase names the wall colour for prompts, e.g. "bright orange (#B35420)".
func (b *characterSwapBackground) phrase() string {
	if b == nil || b.Hex == "" {
		return ""
	}
	return fmt.Sprintf("%s (%s)", b.Name, b.Hex)
}

type characterSwapShotInfo struct {
	People     []characterSwapShotPerson `json:"people"`
	Background *characterSwapBackground  `json:"background"`
}

type characterSwapShotSpan struct {
	First int
	Last  int
	Start float64
	End   float64
}

func (s characterSwapShotSpan) Mid() float64 { return (s.Start + s.End) / 2 }

// characterSwapPerShot reports whether every detected shot gets its own
// swapped keyframe. Default for the H3 lane when the video has at least three
// shots; max_quality=true forces it on for any multi-shot video and
// max_quality=false keeps the single-frame behaviour.
func characterSwapPerShot(req ServiceUsageRequest, chunks []characterSwapChunk) bool {
	if characterSwapIsExact(req) || characterSwapIsLora(req) || characterSwapIsRecast(req) {
		return false
	}
	shots := characterSwapShotCount(chunks)
	if req.MaxQuality != nil {
		return *req.MaxQuality && shots > 1
	}
	return shots >= characterSwapKeyframeMinShots
}

func characterSwapShotSpans(chunks []characterSwapChunk) []characterSwapShotSpan {
	var spans []characterSwapShotSpan
	for i, chunk := range chunks {
		end := chunk.Start + chunk.Length
		if chunk.ShotStart || len(spans) == 0 {
			spans = append(spans, characterSwapShotSpan{First: i, Last: i, Start: chunk.Start, End: end})
			continue
		}
		last := &spans[len(spans)-1]
		last.Last, last.End = i, end
	}
	return spans
}

var characterSwapPositionNames = map[int][]string{
	2: {"LEFT", "RIGHT"},
	3: {"LEFT", "MIDDLE", "RIGHT"},
}

func characterSwapPositionName(i, n int) string {
	if names, ok := characterSwapPositionNames[n]; ok {
		return "the person on the " + names[i]
	}
	if n == 1 {
		return "the person"
	}
	return fmt.Sprintf("person %d counted from the left", i+1)
}

// characterSwapKeyframePrompt pins position, pose, crop, camera distance and
// back-of-head views of one source frame while the identities are swapped.
// photos > 0 means Images 2.. are one photo per character, left to right;
// otherwise Image 2 is a single image holding the characters left to right.
func characterSwapKeyframePrompt(people []characterSwapShotPerson, photos int, characters int, background, extra, failure string) string {
	n := len(people)
	var b strings.Builder
	if n == 0 {
		b.WriteString("Image 1 is a frame from a music video. ")
	} else {
		fmt.Fprintf(&b, "Image 1 is a frame from a music video with %d %s. ", n, map[bool]string{true: "person", false: "people"}[n == 1])
	}
	if photos == 0 {
		b.WriteString("Image 2 shows the new characters, left to right. ")
	}
	for i := 0; i < n; i++ {
		idx := i
		if n < characters {
			idx = 0
			if (people[i].Box[0]+people[i].Box[2])/2 > 0.5 {
				idx = characters - 1
			}
		}
		if idx >= characters {
			idx = characters - 1
		}
		var who string
		if photos > 0 {
			who = fmt.Sprintf("the person from Image %d", idx+2)
		} else {
			who = fmt.Sprintf("the %s character from the left in Image 2", characterSwapOrdinal(idx+1))
		}
		view := ""
		if !people[i].Face {
			view = " (seen from behind with no face visible: keep them seen from behind, with the back of the head, hair and clothing of their replacement)"
		}
		fmt.Fprintf(&b, "Replace %s with %s%s. ", characterSwapPositionName(i, n), who, view)
	}
	if n == 0 {
		b.WriteString("Replace every person in Image 1 with the characters from the other images, left to right. ")
	}
	b.WriteString("Keep every person in the exact same position, pose, arm gestures, head direction, expression, scale and framing as Image 1: the crop and camera distance stay identical, a wide shot stays a wide shot and a close-up stays an equally tight close-up. ")
	b.WriteString("Keep the set, props, lighting and background exactly as in Image 1. ")
	if background != "" {
		fmt.Fprintf(&b, "The background wall stays exactly %s as in Image 1, with the same lighting: never darken it and never turn it into a dark studio. ", background)
	}
	b.WriteString("Remove tattoos, chains and hats; dress each in the clothing from their own photo. ")
	if n > 0 {
		fmt.Fprintf(&b, "Show exactly these %d %s, never the originals. ", n, map[bool]string{true: "person", false: "people"}[n == 1])
	} else {
		b.WriteString("Show only the new characters, never the originals. ")
	}
	b.WriteString("Output exactly one 16:9 image, not a collage.")
	if extra = strings.TrimSpace(extra); extra != "" {
		b.WriteString(" " + extra)
	}
	if failure != "" {
		b.WriteString(" The previous attempt was rejected: " + failure + ". Fix exactly that and keep the framing of Image 1.")
	}
	return b.String()
}

func characterSwapOrdinal(n int) string {
	names := []string{"", "first", "second", "third", "fourth", "fifth", "sixth"}
	if n >= 1 && n < len(names) {
		return names[n]
	}
	return fmt.Sprintf("%dth", n)
}

func characterSwapSniffMIME(data []byte) string {
	return http.DetectContentType(data)
}

func characterSwapKeyframeEndpoint() string {
	return openPathsBaseURL + "/v1/images/edits"
}

// callOpenPathsNanoBanana runs gemini-nano-banana-2.1 through OpenPaths
// /v1/images/edits with image[]=frame then the identity images in one call.
func callOpenPathsNanoBanana(ctx context.Context, prompt string, images [][]byte) ([]byte, error) {
	if strings.TrimSpace(openPathsAPIKey) == "" {
		return nil, fmt.Errorf("keyframe edit requires OPENPATHS_API_KEY")
	}
	var body bytes.Buffer
	form := multipart.NewWriter(&body)
	_ = form.WriteField("model", characterSwapKeyframeModel)
	_ = form.WriteField("prompt", prompt)
	for i, data := range images {
		header := make(textproto.MIMEHeader)
		header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="image[]"; filename="image%d"`, i+1))
		header.Set("Content-Type", characterSwapSniffMIME(data))
		part, err := form.CreatePart(header)
		if err != nil {
			return nil, err
		}
		_, _ = part.Write(data)
	}
	if err := form.Close(); err != nil {
		return nil, err
	}
	reqCtx, cancel := context.WithTimeout(ctx, characterSwapKeyframeTimeout)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, characterSwapKeyframeEndpoint(), &body)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Authorization", "Bearer "+openPathsAPIKey)
	httpReq.Header.Set("Content-Type", form.FormDataContentType())
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("OpenPaths returned %d: %s", resp.StatusCode, truncateString(strings.TrimSpace(string(raw)), 300))
	}
	var payload struct {
		Data []struct {
			B64 string `json:"b64_json"`
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil || len(payload.Data) == 0 {
		return nil, fmt.Errorf("keyframe edit returned no image")
	}
	if payload.Data[0].B64 != "" {
		return base64.StdEncoding.DecodeString(payload.Data[0].B64)
	}
	if strings.HasPrefix(payload.Data[0].URL, "https://") {
		dl, err := http.NewRequestWithContext(reqCtx, http.MethodGet, payload.Data[0].URL, nil)
		if err != nil {
			return nil, err
		}
		got, err := backendClient.Do(dl)
		if err != nil {
			return nil, err
		}
		defer got.Body.Close()
		return io.ReadAll(io.LimitReader(got.Body, 32<<20))
	}
	return nil, fmt.Errorf("keyframe edit returned no image")
}

func characterSwapImageSize(path string) (int, int) {
	file, err := os.Open(path)
	if err != nil {
		return 1280, 720
	}
	defer file.Close()
	cfg, _, err := image.DecodeConfig(file)
	if err != nil || cfg.Width <= 0 || cfg.Height <= 0 {
		return 1280, 720
	}
	return cfg.Width, cfg.Height
}

func characterSwapKeyframeTarget(width, height int) (int, int) {
	if width > 1280 {
		height = int(math.Round(float64(height) * 1280 / float64(width)))
		width = 1280
	}
	return width &^ 1, height &^ 1
}

// characterSwapShotInfoErr runs the shotinfo helper, retrying once: parallel
// YOLO processes occasionally abort at start-up.
func characterSwapShotInfoErr(ctx context.Context, framePath string) (characterSwapShotInfo, error) {
	var res map[string]interface{}
	var err error
	for try := 0; try < 2; try++ {
		if res, err = runExactHelper(ctx, "shotinfo", "--image", framePath); err == nil {
			break
		}
	}
	if err != nil {
		return characterSwapShotInfo{}, err
	}
	raw, _ := json.Marshal(res)
	var info characterSwapShotInfo
	if err := json.Unmarshal(raw, &info); err != nil {
		return characterSwapShotInfo{}, err
	}
	return info, nil
}

func characterSwapShotInfoOf(ctx context.Context, framePath string) (characterSwapShotInfo, bool) {
	info, err := characterSwapShotInfoErr(ctx, framePath)
	return info, err == nil
}

func characterSwapShotPeople(ctx context.Context, framePath string) ([]characterSwapShotPerson, bool) {
	info, ok := characterSwapShotInfoOf(ctx, framePath)
	return info.People, ok
}

// characterSwapShotInfos measures people and the wall colour of every shot's
// real mid-shot frame (median of the pixels outside the dilated person boxes)
// and records the colour on the shot's chunks so the H3 prompt can pin it.
func characterSwapShotInfos(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) map[int]characterSwapShotInfo {
	spans := characterSwapShotSpans(state.Chunks)
	infos := make(map[int]characterSwapShotInfo, len(spans))
	var mu sync.Mutex
	var wg sync.WaitGroup
	slots := make(chan struct{}, characterSwapShotSlots)
	var failure string
	for si, span := range spans {
		wg.Add(1)
		go func(si int, span characterSwapShotSpan) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			framePath := filepath.Join(workDir, fmt.Sprintf("bg-%02d.png", si))
			if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(span.Mid()), "-i", sourcePath, "-frames:v", "1", "-update", "1", framePath); err != nil {
				return
			}
			info, err := characterSwapShotInfoErr(ctx, framePath)
			if err != nil {
				mu.Lock()
				failure = truncateString(err.Error(), 160)
				mu.Unlock()
				return
			}
			mu.Lock()
			defer mu.Unlock()
			infos[si] = info
			if phrase := info.Background.phrase(); phrase != "" {
				for c := span.First; c <= span.Last; c++ {
					if state.Chunks[c].Background == "" {
						state.Chunks[c].Background = phrase
					}
				}
			}
		}(si, span)
	}
	wg.Wait()
	if failure != "" {
		log.Printf("[character-swap] job=%s shot analysis skipped (people, background colour): %s", job.ID, failure)
	} else if len(infos) > 0 {
		var names []string
		for si := range spans {
			if info, ok := infos[si]; ok && info.Background != nil {
				names = append(names, fmt.Sprintf("%d:%s", si, info.Background.phrase()))
			}
		}
		log.Printf("[character-swap] job=%s shot backgrounds %s", job.ID, strings.Join(names, " "))
	}
	_ = persistCharacterSwapState(job.ID, "processing", *state)
	return infos
}

func characterSwapCheckKeyframe(ctx context.Context, srcPath, outPath string) (characterSwapShotCheck, bool) {
	res, err := runExactHelper(ctx, "shotcheck", "--src", srcPath, "--out", outPath)
	if err != nil {
		return characterSwapShotCheck{}, false
	}
	raw, _ := json.Marshal(res)
	var check characterSwapShotCheck
	if err := json.Unmarshal(raw, &check); err != nil {
		return characterSwapShotCheck{}, false
	}
	return check, true
}

func characterSwapKeyframeBetter(a, b characterSwapShotCheck) bool {
	if a.OK != b.OK {
		return a.OK
	}
	return a.MeanIoU-a.BgDE/100 > b.MeanIoU-b.BgDE/100
}

// characterSwapKeyframeVision asks the QA vision model whether a candidate
// keyframe shows the target characters instead of the source performers. It
// fails open.
func characterSwapKeyframeVision(ctx context.Context, srcPath, outPath, identityURL string) (bool, string) {
	if !characterSwapQAEnabled() {
		return true, ""
	}
	src, err1 := os.ReadFile(srcPath)
	out, err2 := os.ReadFile(outPath)
	if err1 != nil || err2 != nil {
		return true, ""
	}
	content := []map[string]interface{}{
		{"type": "text", "text": `Image 1 is a source frame. Image 2 shows the TARGET characters. Image 3 is a candidate that must show the target characters in exactly the arrangement of Image 1. Answer strict JSON {"verdict":"ok"|"bad","reason":"short"}. Say bad if any person in Image 3 still looks like the original person of Image 1 (face, tattoos, hat, chain) or if the people are not the target characters. Ignore small pose or lighting differences.`},
		{"type": "image_url", "image_url": map[string]string{"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(src)}},
		{"type": "image_url", "image_url": map[string]string{"url": identityURL}},
		{"type": "image_url", "image_url": map[string]string{"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(out)}},
	}
	text, err := characterSwapVisionJSON(ctx, content)
	if err != nil {
		return true, ""
	}
	var reply struct {
		Verdict string `json:"verdict"`
		Reason  string `json:"reason"`
	}
	if json.Unmarshal([]byte(text), &reply) != nil {
		return true, ""
	}
	if strings.EqualFold(strings.TrimSpace(reply.Verdict), "bad") {
		return false, "vision: " + strings.TrimSpace(reply.Reason)
	}
	return true, ""
}

// redrawCharacterSwapShots gives every shot after the first its own swapped
// keyframe: the real source frame from the middle of the shot is edited by
// nano banana so the people are swapped while position, pose, crop, camera
// distance and back-of-head views stay as in the source. Each keyframe is
// validated (person count, left-to-right framing, face versus back views and
// an optional vision check) and retried up to twice; a shot that never
// validates keeps its best attempt, and a failed shot falls back to the global
// frame.
func redrawCharacterSwapShots(ctx context.Context, job *VideoJob, user *User, state *characterSwapState, sourcePath, workDir string, infos map[int]characterSwapShotInfo) {
	spans := characterSwapShotSpans(state.Chunks)
	if len(spans) < 2 {
		return
	}
	identity := [][]byte{}
	photos := 0
	for _, refURL := range state.Request.ReferenceImageURLs {
		if len(identity) >= characterSwapKeyframeMaxRefs {
			break
		}
		path := filepath.Join(workDir, fmt.Sprintf("kf-ref-%d", len(identity)))
		if err := downloadURLToFile(ctx, refURL, path); err != nil {
			continue
		}
		if data, err := os.ReadFile(path); err == nil && len(data) > 0 {
			identity = append(identity, data)
			photos++
		}
	}
	identityURL := state.SwappedImageURL
	characters := 0
	if photos == 0 {
		path := filepath.Join(workDir, "kf-swapped")
		if err := downloadURLToFile(ctx, state.SwappedImageURL, path); err != nil {
			log.Printf("[character-swap] job=%s keyframes skipped: swapped image unavailable: %v", job.ID, err)
			return
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return
		}
		identity = [][]byte{data}
		firstFrame := filepath.Join(workDir, "kf-first.png")
		if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(spans[0].Mid()), "-i", sourcePath, "-frames:v", "1", "-update", "1", firstFrame); err == nil {
			if people, ok := characterSwapShotPeople(ctx, firstFrame); ok {
				characters = len(people)
			}
		}
		if characters == 0 {
			characters = 2
		}
	} else {
		characters = photos
	}
	var wg sync.WaitGroup
	var mu sync.Mutex
	slots := make(chan struct{}, characterSwapShotSlots)
	for si := 1; si < len(spans); si++ {
		span := spans[si]
		if state.Chunks[span.First].ShotImage != "" {
			continue
		}
		wg.Add(1)
		go func(si int, span characterSwapShotSpan) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()
			if ctx.Err() != nil || videoJobCancellationRequested(job.ID) {
				return
			}
			info, haveInfo := infos[si]
			hosted, calls, note := characterSwapShotKeyframe(ctx, job, state, sourcePath, workDir, si, span, identity, photos, characters, identityURL, info, haveInfo)
			mu.Lock()
			defer mu.Unlock()
			state.ShotImageUSD += float64(calls) * characterSwapKeyframeUSD
			if hosted != "" {
				for c := span.First; c <= span.Last; c++ {
					state.Chunks[c].ShotImage = hosted
					state.Chunks[c].ShotNote = note
				}
			} else {
				log.Printf("[character-swap] job=%s shot %d at %.2fs keyframe failed: %s", job.ID, si, span.Start, note)
			}
			_ = persistCharacterSwapState(job.ID, "processing", *state)
		}(si, span)
	}
	wg.Wait()
}

func characterSwapShotKeyframe(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string, si int, span characterSwapShotSpan, identity [][]byte, photos, characters int, identityURL string, info characterSwapShotInfo, haveInfo bool) (string, int, string) {
	srcPath := filepath.Join(workDir, fmt.Sprintf("kf-%02d-src.png", si))
	if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-ss", trimSeconds(span.Mid()), "-i", sourcePath, "-frames:v", "1", "-update", "1", srcPath); err != nil {
		return "", 0, "could not extract the shot frame"
	}
	srcData, err := os.ReadFile(srcPath)
	if err != nil {
		return "", 0, "could not read the shot frame"
	}
	if !haveInfo {
		info, haveInfo = characterSwapShotInfoOf(ctx, srcPath)
	}
	people, havePeople := info.People, haveInfo
	background := state.Chunks[span.First].Background
	if background == "" {
		background = info.Background.phrase()
	}
	w, h := characterSwapKeyframeTarget(characterSwapImageSize(srcPath))
	images := append([][]byte{srcData}, identity...)
	var best string
	var bestCheck characterSwapShotCheck
	calls, failure, note := 0, "", ""
	for attempt := 0; attempt <= characterSwapKeyframeRetries; attempt++ {
		if ctx.Err() != nil {
			break
		}
		prompt := characterSwapKeyframePrompt(people, photos, characters, background, state.Request.CharacterPrompt, failure)
		raw, err := callOpenPathsNanoBanana(ctx, prompt, images)
		calls++
		if err != nil {
			note = truncateString(err.Error(), 160)
			continue
		}
		rawPath := filepath.Join(workDir, fmt.Sprintf("kf-%02d-raw%d", si, attempt))
		outPath := filepath.Join(workDir, fmt.Sprintf("kf-%02d-a%d.png", si, attempt))
		if err := os.WriteFile(rawPath, raw, 0o600); err != nil {
			continue
		}
		if err := lofiloop.RunFFmpeg(ctx, "-y", "-loglevel", "error", "-i", rawPath, "-vf",
			fmt.Sprintf("scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d", w, h, w, h), "-frames:v", "1", "-update", "1", outPath); err != nil {
			continue
		}
		check := characterSwapShotCheck{OK: true}
		if havePeople {
			if c, ok := characterSwapCheckKeyframe(ctx, srcPath, outPath); ok {
				check = c
			} else {
				log.Printf("[character-swap] job=%s shot %d keyframe geometry/background check skipped: shotcheck helper failed", job.ID, si)
			}
		} else if attempt == 0 {
			log.Printf("[character-swap] job=%s shot %d keyframe geometry/background check skipped: shotinfo helper unavailable (CHARACTER_SWAP_PYTHON)", job.ID, si)
		}
		if check.OK {
			if ok, reason := characterSwapKeyframeVision(ctx, srcPath, outPath, identityURL); !ok {
				check.OK = false
				check.Reasons = append(check.Reasons, reason)
			}
		}
		if best == "" || characterSwapKeyframeBetter(check, bestCheck) {
			best, bestCheck = outPath, check
		}
		if check.OK {
			note = fmt.Sprintf("keyframe attempt %d ok", attempt+1)
			log.Printf("[character-swap] job=%s shot %d keyframe attempt %d ok iou %.2f bg dE %.1f", job.ID, si, attempt+1, check.MeanIoU, check.BgDE)
			break
		}
		failure = strings.Join(check.Reasons, "; ")
		note = fmt.Sprintf("keyframe best of %d attempts, flagged: %s", attempt+1, failure)
		log.Printf("[character-swap] job=%s shot %d keyframe attempt %d rejected: %s", job.ID, si, attempt+1, failure)
	}
	if best == "" {
		return "", calls, note
	}
	url, err := uploadCharacterSwapFile(ctx, best, job.UserID, "image/png")
	if err != nil {
		return "", calls, "could not store the keyframe"
	}
	return url, calls, note
}
