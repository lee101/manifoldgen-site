package main

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	"image/png"
	"time"

	xdraw "golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const imageEditorRA2MaxEdge = 1024

// imageEditorRA2Size keeps the aspect ratio, caps the long edge and snaps to 64.
func imageEditorRA2Size(width, height int) (int, int) {
	scale := 1.0
	if long := max(width, height); long > imageEditorRA2MaxEdge {
		scale = float64(imageEditorRA2MaxEdge) / float64(long)
	}
	snap := func(v float64) int {
		n := int(v+32) / 64 * 64
		return min(max(n, 256), imageEditorRA2MaxEdge)
	}
	return snap(float64(width) * scale), snap(float64(height) * scale)
}

func imageEditorScale(src image.Image, width, height int) *image.RGBA {
	out := image.NewRGBA(image.Rect(0, 0, width, height))
	xdraw.CatmullRom.Scale(out, out.Bounds(), src, src.Bounds(), xdraw.Src, nil)
	return out
}

// imageEditorComposite keeps the source outside the mask and the edit inside it,
// blending by mask luminance so soft SAM edges stay soft.
func imageEditorComposite(src, edit, mask image.Image) *image.RGBA {
	bounds := src.Bounds()
	width, height := bounds.Dx(), bounds.Dy()
	base := imageEditorScale(src, width, height)
	edited := imageEditorScale(edit, width, height)
	alpha := imageEditorScale(mask, width, height)
	out := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			m := alpha.RGBAAt(x, y)
			a := (uint32(m.R)*299 + uint32(m.G)*587 + uint32(m.B)*114) / 1000
			if m.A < 255 {
				a = a * uint32(m.A) / 255
			}
			s, e := base.RGBAAt(x, y), edited.RGBAAt(x, y)
			mix := func(p, q uint8) uint8 { return uint8((uint32(p)*(255-a) + uint32(q)*a) / 255) }
			out.SetRGBA(x, y, color.RGBA{mix(s.R, e.R), mix(s.G, e.G), mix(s.B, e.B), 255})
		}
	}
	return out
}

// imageEditorReferenceEdit runs a masked edit on the native gateway's reference
// editor (ra2 sibling). The editor is global, so its output is composited back
// through the mask and published as a durable URL.
func imageEditorReferenceEdit(userID string, input imageEditorRequest) (json.RawMessage, error) {
	sourceBytes, err := downloadRemoteImage(input.ImageURL)
	if err != nil {
		return nil, fmt.Errorf("source image: %w", err)
	}
	maskBytes, err := downloadRemoteImage(input.MaskURL)
	if err != nil {
		return nil, fmt.Errorf("mask: %w", err)
	}
	source, _, err := image.Decode(bytes.NewReader(sourceBytes))
	if err != nil {
		return nil, fmt.Errorf("decode source: %w", err)
	}
	mask, _, err := image.Decode(bytes.NewReader(maskBytes))
	if err != nil {
		return nil, fmt.Errorf("decode mask: %w", err)
	}
	width, height := imageEditorRA2Size(source.Bounds().Dx(), source.Bounds().Dy())
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, imageEditorScale(source, width, height)); err != nil {
		return nil, err
	}
	raw, err := imageEditorNative("/v1/images/edits", map[string]interface{}{
		"prompt":       input.Prompt,
		"image_base64": base64.StdEncoding.EncodeToString(encoded.Bytes()),
		"size":         fmt.Sprintf("%dx%d", width, height),
		"n":            1,
		"image_url":    input.ImageURL,
		"mask_url":     input.MaskURL,
	})
	if err != nil {
		return nil, err
	}
	var openai struct {
		Data []struct {
			B64JSON string `json:"b64_json"`
		} `json:"data"`
	}
	if json.Unmarshal(raw, &openai) != nil || len(openai.Data) == 0 || openai.Data[0].B64JSON == "" {
		return raw, nil // a masked-edit pool already answered with its own URLs
	}
	editBytes, err := base64.StdEncoding.DecodeString(openai.Data[0].B64JSON)
	if err != nil {
		return nil, fmt.Errorf("edit output: %w", err)
	}
	edit, _, err := image.Decode(bytes.NewReader(editBytes))
	if err != nil {
		return nil, fmt.Errorf("decode edit: %w", err)
	}
	composite := imageEditorComposite(source, edit, mask)
	var out bytes.Buffer
	if err := png.Encode(&out, composite); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	url, _, err := uploadGeneratedImageArtifact(ctx, out.Bytes(), userID, "image/png", "image_editor")
	if err != nil {
		return nil, err
	}
	bounds := composite.Bounds()
	return json.Marshal(map[string]interface{}{
		"image_url": url, "width": bounds.Dx(), "height": bounds.Dy(), "engine": "ra2",
	})
}
