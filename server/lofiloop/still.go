package lofiloop

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// CoverComposition is appended to every cover prompt so the composition leaves
// room for the visualizer band and reads as an album cover rather than a photo.
const CoverComposition = "wide 16:9 album cover composition, subject centred in the upper two thirds, uncluttered lower third, painterly edge-to-edge environment"

// StillRequest asks an image backend for one cover frame.
type StillRequest struct {
	Prompt     string
	Negative   string
	Size       string
	Steps      int
	Seed       int64
	BackendURL string
	Secret     string
	OutputPath string
	Timeout    time.Duration
}

// StillResult reports what was generated.
type StillResult struct {
	Path      string `json:"path"`
	Model     string `json:"model"`
	Format    string `json:"format"`
	Seed      int64  `json:"seed"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	LatencyMS int    `json:"latency_ms"`
	Prompt    string `json:"prompt"`
	Backend   string `json:"backend"`
	Bytes     int    `json:"bytes"`
}

type stillResponse struct {
	Model  string `json:"model"`
	Format string `json:"format"`
	Data   []struct {
		B64         string `json:"b64_json"`
		Seed        int64  `json:"seed"`
		InferenceMS int    `json:"inference_time_ms"`
		Format      string `json:"format"`
	} `json:"data"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

// StillPrompt assembles the art-direction sentence from the caller's parts.
func StillPrompt(style, character, scene, fallback string) string {
	parts := make([]string, 0, 4)
	for _, part := range []string{style, character, scene} {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			parts = append(parts, strings.TrimSuffix(trimmed, "."))
		}
	}
	if len(parts) == 0 && strings.TrimSpace(fallback) != "" {
		parts = append(parts, strings.TrimSpace(fallback))
	}
	if len(parts) == 0 {
		return ""
	}
	return strings.Join(parts, ", ") + ", " + CoverComposition
}

// GenerateStill renders one cover still through an OpenAI-compatible image
// backend (omniserve-native serves Z-Image on /v1/images/generations).
func GenerateStill(ctx context.Context, req StillRequest) (*StillResult, error) {
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("cover prompt is empty")
	}
	backend := strings.TrimSuffix(strings.TrimSpace(req.BackendURL), "/")
	if backend == "" {
		return nil, fmt.Errorf("image backend URL is required to generate the cover")
	}
	width, height, err := ParseSize(req.Size)
	if err != nil {
		return nil, err
	}
	steps := req.Steps
	if steps <= 0 {
		steps = 8
	}
	if steps > 100 {
		steps = 100
	}
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 10 * time.Minute
	}
	body, err := json.Marshal(map[string]interface{}{
		"prompt":          req.Prompt,
		"negative_prompt": req.Negative,
		"size":            fmt.Sprintf("%dx%d", width, height),
		"steps":           steps,
		"seed":            req.Seed,
	})
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, backend+"/v1/images/generations", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if req.Secret != "" {
		httpReq.Header.Set("Authorization", "Bearer "+req.Secret)
	}
	client := &http.Client{Timeout: timeout}
	started := time.Now()
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("cover generation request: %w", err)
	}
	defer resp.Body.Close()
	payload, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return nil, fmt.Errorf("cover generation response: %w", err)
	}
	var decoded stillResponse
	if err := json.Unmarshal(payload, &decoded); err != nil {
		return nil, fmt.Errorf("cover generation returned %d with unreadable body", resp.StatusCode)
	}
	if resp.StatusCode >= 300 {
		message := strings.TrimSpace(decoded.Error.Message)
		if message == "" {
			message = tailText(payload, 400)
		}
		return nil, fmt.Errorf("cover generation failed with %d: %s", resp.StatusCode, message)
	}
	if len(decoded.Data) == 0 || decoded.Data[0].B64 == "" {
		return nil, fmt.Errorf("cover generation returned no image")
	}
	item := decoded.Data[0]
	raw, err := base64.StdEncoding.DecodeString(item.B64)
	if err != nil {
		return nil, fmt.Errorf("cover generation returned invalid base64: %w", err)
	}
	if len(raw) == 0 {
		return nil, fmt.Errorf("cover generation returned an empty image")
	}
	if err := os.MkdirAll(filepath.Dir(req.OutputPath), 0o755); err != nil {
		return nil, err
	}
	format := strings.ToLower(strings.TrimSpace(item.Format))
	if format == "" {
		format = strings.ToLower(strings.TrimSpace(decoded.Format))
	}
	if format == "" {
		format = "png"
	}
	if format != "png" {
		rawPath := req.OutputPath + "." + format
		if err := os.WriteFile(rawPath, raw, 0o644); err != nil {
			return nil, err
		}
		defer os.Remove(rawPath)
		if err := RunFFmpeg(ctx, "-y", "-hide_banner", "-loglevel", "error",
			"-i", rawPath, "-frames:v", "1", req.OutputPath); err != nil {
			return nil, fmt.Errorf("convert cover to png: %w", err)
		}
	} else if err := os.WriteFile(req.OutputPath, raw, 0o644); err != nil {
		return nil, err
	}
	return &StillResult{
		Path:      req.OutputPath,
		Model:     decoded.Model,
		Format:    "png",
		Seed:      item.Seed,
		Width:     width,
		Height:    height,
		LatencyMS: int(time.Since(started).Milliseconds()),
		Prompt:    req.Prompt,
		Backend:   backend,
		Bytes:     len(raw),
	}, nil
}
