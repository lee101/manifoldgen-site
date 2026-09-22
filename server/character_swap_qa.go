package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"time"

	"manifoldgen-site/lofiloop"
)

const (
	characterSwapQAModel  = "gpt-5.6-luna"
	characterSwapQAFrames = 6
	characterSwapQASkip   = 1.0
)

type characterSwapQAReply struct {
	Verdict      string `json:"verdict"`
	LeakedFrames []int  `json:"leaked_frames"`
	Reason       string `json:"reason"`
}

func characterSwapQAEnabled() bool {
	return !strings.EqualFold(strings.TrimSpace(getEnv("CHARACTER_SWAP_QA", "true")), "false") && strings.TrimSpace(openPathsAPIKey) != ""
}

func sampleCharacterSwapFrames(ctx context.Context, clipPath string, count int, skip float64) ([][]byte, error) {
	duration, err := lofiloop.ProbeDurationSeconds(ctx, clipPath)
	if err != nil {
		return nil, err
	}
	if duration <= skip+0.5 {
		skip = 0
	}
	binary := strings.TrimSpace(os.Getenv("FFMPEG_BIN"))
	if binary == "" {
		binary = "ffmpeg"
	}
	frames := make([][]byte, 0, count)
	for i := 0; i < count; i++ {
		at := skip + (duration-skip)*(float64(i)+0.5)/float64(count)
		cmd := exec.CommandContext(ctx, binary, "-loglevel", "error", "-ss", trimSeconds(at), "-i", clipPath,
			"-frames:v", "1", "-vf", "scale=640:-2", "-f", "image2", "-c:v", "mjpeg", "-q:v", "4", "pipe:1")
		var out bytes.Buffer
		cmd.Stdout = &out
		if err := cmd.Run(); err != nil || out.Len() == 0 {
			return nil, fmt.Errorf("could not sample frame %d", i)
		}
		frames = append(frames, out.Bytes())
	}
	return frames, nil
}

// checkCharacterSwapClip asks a vision model whether any sampled frame of a
// generated clip still shows the source performers instead of the characters
// in the swapped reference image. It fails open: any provider error counts as
// a clean clip so a QA outage never blocks delivery.
func checkCharacterSwapClip(ctx context.Context, state characterSwapState, clipPath string) (bool, string) {
	frames, err := sampleCharacterSwapFrames(ctx, clipPath, characterSwapQAFrames, characterSwapQASkip)
	if err != nil {
		return false, "sampling failed: " + err.Error()
	}
	content := []map[string]interface{}{
		{"type": "text", "text": fmt.Sprintf(`The first image is the TARGET look: the new characters that must appear in every frame. The following %d images are frames sampled from a generated video clip. The clip was supposed to show only the target characters performing. Report any frame where the people are NOT the target characters (for example the original performers from the source footage, different people, or a mix of original and target people). Ignore pose, motion blur, small proportion changes, and lighting differences. Answer with strict JSON: {"verdict":"clean"|"leaked","leaked_frames":[frame numbers starting at 1],"reason":"short reason"}.`, len(frames))},
		{"type": "image_url", "image_url": map[string]string{"url": state.SwappedImageURL}},
	}
	for i, frame := range frames {
		content = append(content,
			map[string]interface{}{"type": "text", "text": fmt.Sprintf("Frame %d", i+1)},
			map[string]interface{}{"type": "image_url", "image_url": map[string]string{"url": "data:image/jpeg;base64," + base64.StdEncoding.EncodeToString(frame)}},
		)
	}
	payload, _ := json.Marshal(map[string]interface{}{
		"model":           characterSwapQAModel,
		"messages":        []map[string]interface{}{{"role": "user", "content": content}},
		"response_format": map[string]string{"type": "json_object"},
		"max_tokens":      300,
		"temperature":     0,
	})
	reqCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodPost, openPathsBaseURL+"/v1/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return false, err.Error()
	}
	httpReq.Header.Set("Authorization", "Bearer "+openPathsAPIKey)
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := backendClient.Do(httpReq)
	if err != nil {
		return false, "vision unavailable: " + err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return false, fmt.Sprintf("vision returned %d", resp.StatusCode)
	}
	var envelope struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil || len(envelope.Choices) == 0 {
		return false, "vision returned no answer"
	}
	text := strings.TrimSpace(envelope.Choices[0].Message.Content)
	if start := strings.Index(text, "{"); start > 0 {
		text = text[start:]
	}
	if end := strings.LastIndex(text, "}"); end >= 0 {
		text = text[:end+1]
	}
	var reply characterSwapQAReply
	if err := json.Unmarshal([]byte(text), &reply); err != nil {
		return false, "vision answer unreadable"
	}
	leaked := strings.EqualFold(strings.TrimSpace(reply.Verdict), "leaked") || len(reply.LeakedFrames) > 0
	reason := strings.TrimSpace(reply.Reason)
	if leaked {
		reason = fmt.Sprintf("frames %v: %s", reply.LeakedFrames, reason)
	}
	return leaked, reason
}
