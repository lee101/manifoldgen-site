package main

import (
	"bufio"
	"bytes"
	_ "embed"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/url"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

//go:embed studio_schema.json
var studioSchemaJSON []byte

const (
	timelineMaxDocBytes  = 512 << 10
	timelineMaxClips     = 200
	timelineMaxSeconds   = 600.0
	timelineMaxWidth     = 3840
	timelineMaxHeight    = 2160
	timelineMaxFPS       = 60
	timelineMaxLUTs      = 8
	timelineMaxFx        = 12
	timelineMaxTracks    = 12
	timelineMaxParams    = timelineMaxDocBytes + 8<<10
	timelineTextWidth    = 1920
	timelineTextHeight   = 1080
	timelineImageSeconds = 5.0
	timelineStoredLUT    = 33
	timelineMinUSD       = 0.05
)

var timelineMediaNamespace = uuid.MustParse("6f1c3c2e-9a57-4b0e-8f0a-6d9b8f6c2a11")

type studioSchemaSpec struct {
	DocumentKeys   map[string]bool
	AssetKeys      map[string]bool
	TextKeys       map[string]bool
	LUTKeys        map[string]bool
	AdjustmentKeys map[string]bool
	NumericAdjust  map[string]bool
	Kinds          map[string]bool
	BlendModes     map[string]bool
	Transitions    map[string]bool
	FxTypes        map[string]bool
	Fonts          map[string]bool
	Aligns         map[string]bool
	Weights        map[string]bool
}

var studioSchema = mustStudioSchemaSpec(studioSchemaJSON)

func mustStudioSchemaSpec(raw []byte) studioSchemaSpec {
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		panic("studio_schema.json: " + err.Error())
	}
	node := func(keys ...string) map[string]interface{} {
		current := root
		for _, key := range keys {
			next, ok := current[key].(map[string]interface{})
			if !ok {
				panic("studio_schema.json missing " + strings.Join(keys, "."))
			}
			current = next
		}
		return current
	}
	propertyKeys := func(object map[string]interface{}) map[string]bool {
		out := map[string]bool{}
		for key := range object["properties"].(map[string]interface{}) {
			out[key] = true
		}
		return out
	}
	enum := func(object map[string]interface{}) map[string]bool {
		out := map[string]bool{}
		for _, value := range object["enum"].([]interface{}) {
			out[fmt.Sprint(value)] = true
		}
		return out
	}
	document := node("document")
	asset := node("document", "properties", "assets", "items")
	assetProps := asset["properties"].(map[string]interface{})
	adjust := assetProps["adjustments"].(map[string]interface{})
	adjustProps := adjust["properties"].(map[string]interface{})
	text := assetProps["text"].(map[string]interface{})
	textProps := text["properties"].(map[string]interface{})
	numeric := map[string]bool{}
	for key, value := range adjustProps {
		if value.(map[string]interface{})["type"] == "number" {
			numeric[key] = true
		}
	}
	fx := adjustProps["fx"].(map[string]interface{})["items"].(map[string]interface{})["properties"].(map[string]interface{})
	transition := assetProps["transition"].(map[string]interface{})["properties"].(map[string]interface{})
	return studioSchemaSpec{
		DocumentKeys:   propertyKeys(document),
		AssetKeys:      propertyKeys(asset),
		TextKeys:       propertyKeys(text),
		LUTKeys:        propertyKeys(node("document", "properties", "luts", "additionalProperties")),
		AdjustmentKeys: propertyKeys(adjust),
		NumericAdjust:  numeric,
		Kinds:          enum(assetProps["kind"].(map[string]interface{})),
		BlendModes:     enum(assetProps["blendMode"].(map[string]interface{})),
		Transitions:    enum(transition["type"].(map[string]interface{})),
		FxTypes:        enum(fx["type"].(map[string]interface{})),
		Fonts:          enum(textProps["fontFamily"].(map[string]interface{})),
		Aligns:         enum(textProps["align"].(map[string]interface{})),
		Weights:        enum(textProps["fontWeight"].(map[string]interface{})),
	}
}

type timelineCanvas struct {
	Width  int `json:"width"`
	Height int `json:"height"`
}

type timelineCrop struct {
	Left   float64 `json:"left"`
	Top    float64 `json:"top"`
	Right  float64 `json:"right"`
	Bottom float64 `json:"bottom"`
}

type timelineTransition struct {
	Type     string   `json:"type"`
	Duration *float64 `json:"duration,omitempty"`
}

type timelineText struct {
	Content    string  `json:"content"`
	FontSize   float64 `json:"fontSize"`
	FontFamily string  `json:"fontFamily"`
	FontWeight int     `json:"fontWeight"`
	Color      string  `json:"color"`
	Align      string  `json:"align"`
}

type timelineLUT struct {
	Name string `json:"name"`
	Size int    `json:"size,omitempty"`
	Data string `json:"data,omitempty"`
	Cube string `json:"cube,omitempty"`
	URL  string `json:"url,omitempty"`
}

type timelineAsset struct {
	ID               string                     `json:"id"`
	MediaID          string                     `json:"mediaID,omitempty"`
	Name             string                     `json:"name"`
	Kind             string                     `json:"kind"`
	Duration         *float64                   `json:"duration,omitempty"`
	Width            *float64                   `json:"width,omitempty"`
	Height           *float64                   `json:"height,omitempty"`
	TrimStart        *float64                   `json:"trimStart,omitempty"`
	TrimEnd          *float64                   `json:"trimEnd,omitempty"`
	TimelineStart    *float64                   `json:"timelineStart,omitempty"`
	VisualTrack      *float64                   `json:"visualTrack,omitempty"`
	Volume           *float64                   `json:"volume,omitempty"`
	FadeIn           *float64                   `json:"fadeIn,omitempty"`
	FadeOut          *float64                   `json:"fadeOut,omitempty"`
	SourceAudioMuted bool                       `json:"sourceAudioMuted,omitempty"`
	StageX           *float64                   `json:"stageX,omitempty"`
	StageY           *float64                   `json:"stageY,omitempty"`
	StageScale       *float64                   `json:"stageScale,omitempty"`
	StageRotation    *float64                   `json:"stageRotation,omitempty"`
	Attribution      string                     `json:"attribution,omitempty"`
	Adjustments      map[string]json.RawMessage `json:"adjustments"`
	Opacity          *float64                   `json:"opacity,omitempty"`
	BlendMode        string                     `json:"blendMode,omitempty"`
	Crop             *timelineCrop              `json:"crop,omitempty"`
	Transition       *timelineTransition        `json:"transition,omitempty"`
	CloudURL         string                     `json:"cloudURL,omitempty"`
	ObjectKey        string                     `json:"objectKey,omitempty"`
	PreviewURL       string                     `json:"previewURL,omitempty"`
	ContentType      string                     `json:"contentType,omitempty"`
	Size             *float64                   `json:"size,omitempty"`
	LastModified     *float64                   `json:"lastModified,omitempty"`
	Text             *timelineText              `json:"text,omitempty"`
}

type timelineDocument struct {
	Version          int                     `json:"version"`
	SelectedID       string                  `json:"selectedID,omitempty"`
	Assets           []*timelineAsset        `json:"assets"`
	Canvas           *timelineCanvas         `json:"canvas,omitempty"`
	LUTs             map[string]*timelineLUT `json:"luts,omitempty"`
	AudioTrackVolume *float64                `json:"audioTrackVolume,omitempty"`
	History          json.RawMessage         `json:"history,omitempty"`
}

type timelineMediaInfo struct {
	Duration    float64
	Width       float64
	Height      float64
	ContentType string
	Size        int64
}

var (
	timelineJSONField = regexp.MustCompile(`json: unknown field "([^"]+)"`)
	timelineHexColor  = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
)

func timelineFloat(value float64) *float64 { return &value }

func timelineValue(value *float64, fallback float64) float64 {
	if value == nil {
		return fallback
	}
	return *value
}

func parseTimelineDocument(raw []byte) (*timelineDocument, error) {
	raw = bytes.TrimSpace(raw)
	if len(raw) == 0 {
		return nil, fmt.Errorf("document is required")
	}
	if len(raw) > timelineMaxDocBytes {
		return nil, fmt.Errorf("document exceeds %d KB", timelineMaxDocBytes>>10)
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	var doc timelineDocument
	if err := decoder.Decode(&doc); err != nil {
		if match := timelineJSONField.FindStringSubmatch(err.Error()); match != nil {
			return nil, fmt.Errorf("document has unknown field %q (see get_studio_schema)", match[1])
		}
		return nil, fmt.Errorf("document is not a valid PortableStudioDocument: %v", err)
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return nil, fmt.Errorf("document must be a single JSON object")
	}
	doc.History = nil
	return &doc, doc.validate()
}

func timelineRange(name string, value *float64, lo, hi float64) error {
	if value == nil {
		return nil
	}
	if math.IsNaN(*value) || math.IsInf(*value, 0) || *value < lo || *value > hi {
		return fmt.Errorf("%s must be between %g and %g", name, lo, hi)
	}
	return nil
}

func (doc *timelineDocument) validate() error {
	if doc.Version == 0 {
		doc.Version = 6
	}
	if doc.Version > 6 || doc.Version < 1 {
		return fmt.Errorf("document version %d is not supported (use 6)", doc.Version)
	}
	if len(doc.Assets) == 0 {
		return fmt.Errorf("document needs at least one asset")
	}
	if len(doc.Assets) > timelineMaxClips {
		return fmt.Errorf("document has %d clips; the limit is %d", len(doc.Assets), timelineMaxClips)
	}
	if doc.Canvas != nil && (doc.Canvas.Width < 64 || doc.Canvas.Height < 64 || doc.Canvas.Width > timelineMaxWidth || doc.Canvas.Height > timelineMaxHeight) {
		return fmt.Errorf("canvas must be between 64x64 and %dx%d", timelineMaxWidth, timelineMaxHeight)
	}
	if err := timelineRange("audioTrackVolume", doc.AudioTrackVolume, 0, 2); err != nil {
		return err
	}
	if len(doc.LUTs) > timelineMaxLUTs {
		return fmt.Errorf("at most %d LUTs", timelineMaxLUTs)
	}
	for id, lut := range doc.LUTs {
		if err := lut.validate(); err != nil {
			return fmt.Errorf("luts[%q]: %v", id, err)
		}
	}
	seen := map[string]bool{}
	visual := false
	for i, asset := range doc.Assets {
		if asset == nil {
			return fmt.Errorf("assets[%d] is empty", i)
		}
		if err := asset.validate(doc); err != nil {
			label := asset.ID
			if label == "" {
				label = strconv.Itoa(i)
			}
			return fmt.Errorf("assets[%d] (%s): %v", i, label, err)
		}
		if seen[asset.ID] {
			return fmt.Errorf("assets[%d]: duplicate id %q", i, asset.ID)
		}
		seen[asset.ID] = true
		visual = visual || asset.Kind != "audio"
	}
	if !visual {
		return fmt.Errorf("document needs at least one video, image or text clip")
	}
	return nil
}

func (lut *timelineLUT) validate() error {
	if lut == nil {
		return fmt.Errorf("is empty")
	}
	sources := 0
	for _, set := range []bool{lut.Data != "", lut.Cube != "", lut.URL != ""} {
		if set {
			sources++
		}
	}
	if sources != 1 {
		return fmt.Errorf("give exactly one of data, cube or url")
	}
	if lut.URL != "" {
		if err := validateProdkitURL(lut.URL); err != nil {
			return err
		}
	}
	if lut.Data != "" {
		if lut.Size < 2 || lut.Size > timelineStoredLUT {
			return fmt.Errorf("size must be 2-%d", timelineStoredLUT)
		}
		decoded, err := base64.StdEncoding.DecodeString(lut.Data)
		if err != nil || len(decoded) != lut.Size*lut.Size*lut.Size*6 {
			return fmt.Errorf("data does not match size")
		}
	}
	return nil
}

func (asset *timelineAsset) validate(doc *timelineDocument) error {
	asset.ID = strings.TrimSpace(asset.ID)
	if asset.ID == "" || len(asset.ID) > 128 {
		return fmt.Errorf("id is required (max 128 chars)")
	}
	if !studioSchema.Kinds[asset.Kind] {
		return fmt.Errorf("kind must be video, image or audio")
	}
	if len(asset.Name) > 200 {
		return fmt.Errorf("name is too long")
	}
	if asset.Text != nil {
		if asset.Kind != "image" {
			return fmt.Errorf("text clips must use kind image")
		}
		if err := asset.Text.validate(); err != nil {
			return fmt.Errorf("text: %v", err)
		}
	}
	asset.CloudURL = strings.TrimSpace(asset.CloudURL)
	if asset.CloudURL == "" && asset.Text == nil {
		return fmt.Errorf("cloudURL is required")
	}
	if asset.CloudURL != "" {
		if err := validateProdkitURL(asset.CloudURL); err != nil {
			return err
		}
	}
	checks := []struct {
		name   string
		value  *float64
		lo, hi float64
	}{
		{"duration", asset.Duration, 0, 24 * 3600}, {"width", asset.Width, 1, 16384}, {"height", asset.Height, 1, 16384},
		{"trimStart", asset.TrimStart, 0, 24 * 3600}, {"trimEnd", asset.TrimEnd, 0, 24 * 3600}, {"timelineStart", asset.TimelineStart, 0, timelineMaxSeconds},
		{"visualTrack", asset.VisualTrack, 0, timelineMaxTracks - 1}, {"volume", asset.Volume, 0, 2}, {"fadeIn", asset.FadeIn, 0, 30}, {"fadeOut", asset.FadeOut, 0, 30},
		{"stageX", asset.StageX, -2, 2}, {"stageY", asset.StageY, -2, 2}, {"stageScale", asset.StageScale, 0.1, 4}, {"stageRotation", asset.StageRotation, -360, 360},
		{"opacity", asset.Opacity, 0, 1}, {"size", asset.Size, 0, 1 << 45}, {"lastModified", asset.LastModified, 0, 1 << 53},
	}
	for _, check := range checks {
		if err := timelineRange(check.name, check.value, check.lo, check.hi); err != nil {
			return err
		}
	}
	if asset.VisualTrack != nil && *asset.VisualTrack != math.Floor(*asset.VisualTrack) {
		return fmt.Errorf("visualTrack must be an integer")
	}
	if asset.TrimStart != nil && asset.TrimEnd != nil && *asset.TrimEnd-*asset.TrimStart < 0.05 {
		return fmt.Errorf("trimEnd must be at least 0.05 s after trimStart")
	}
	if asset.BlendMode != "" && !studioSchema.BlendModes[asset.BlendMode] {
		return fmt.Errorf("unknown blendMode %q", asset.BlendMode)
	}
	if crop := asset.Crop; crop != nil {
		for _, side := range []float64{crop.Left, crop.Top, crop.Right, crop.Bottom} {
			if math.IsNaN(side) || side < 0 || side > 0.95 {
				return fmt.Errorf("crop sides must be 0-0.95")
			}
		}
		if crop.Left+crop.Right > 0.95 || crop.Top+crop.Bottom > 0.95 {
			return fmt.Errorf("crop removes the whole clip")
		}
	}
	if transition := asset.Transition; transition != nil {
		if asset.Kind == "audio" {
			return fmt.Errorf("audio clips use fadeIn/fadeOut instead of transition")
		}
		if !studioSchema.Transitions[transition.Type] {
			return fmt.Errorf("unknown transition type %q", transition.Type)
		}
		if err := timelineRange("transition.duration", transition.Duration, 0.1, 5); err != nil {
			return err
		}
	}
	return asset.validateAdjustments(doc)
}

func (text *timelineText) validate() error {
	text.Content = strings.TrimSpace(text.Content)
	if text.Content == "" || len(text.Content) > 2000 {
		return fmt.Errorf("content must be 1-2000 characters")
	}
	if text.FontSize == 0 {
		text.FontSize = 96
	}
	if text.FontSize < 8 || text.FontSize > 400 {
		return fmt.Errorf("fontSize must be 8-400")
	}
	if text.FontFamily == "" {
		text.FontFamily = "DM Sans"
	}
	if !studioSchema.Fonts[text.FontFamily] {
		return fmt.Errorf("unknown fontFamily %q", text.FontFamily)
	}
	if text.FontWeight == 0 {
		text.FontWeight = 800
	}
	if !studioSchema.Weights[strconv.Itoa(text.FontWeight)] {
		return fmt.Errorf("fontWeight must be 400, 600 or 800")
	}
	if text.Color == "" {
		text.Color = "#ffffff"
	}
	if !timelineHexColor.MatchString(text.Color) {
		return fmt.Errorf("color must be #rrggbb")
	}
	if text.Align == "" {
		text.Align = "center"
	}
	if !studioSchema.Aligns[text.Align] {
		return fmt.Errorf("align must be left, center or right")
	}
	return nil
}

func (asset *timelineAsset) validateAdjustments(doc *timelineDocument) error {
	if asset.Adjustments == nil {
		asset.Adjustments = map[string]json.RawMessage{}
	}
	for key, raw := range asset.Adjustments {
		if !studioSchema.AdjustmentKeys[key] {
			return fmt.Errorf("unknown adjustments field %q", key)
		}
		switch {
		case studioSchema.NumericAdjust[key]:
			var number float64
			if json.Unmarshal(raw, &number) != nil || math.IsNaN(number) || math.IsInf(number, 0) || math.Abs(number) > 1000 {
				return fmt.Errorf("adjustments.%s must be a number", key)
			}
		case key == "lutID":
			var id string
			if json.Unmarshal(raw, &id) != nil {
				return fmt.Errorf("adjustments.lutID must be a string")
			}
			if id != "" && doc.LUTs[id] == nil {
				return fmt.Errorf("adjustments.lutID %q is not in document.luts", id)
			}
		case key == "curves":
			var curves map[string][][2]float64
			if json.Unmarshal(raw, &curves) != nil {
				return fmt.Errorf("adjustments.curves must map channels to [[in,out],...] points")
			}
			for channel, points := range curves {
				if channel != "master" && channel != "red" && channel != "green" && channel != "blue" {
					return fmt.Errorf("unknown curves channel %q", channel)
				}
				if len(points) > 32 {
					return fmt.Errorf("curves.%s has too many points", channel)
				}
			}
		case key == "fx":
			var layers []struct {
				ID      string             `json:"id"`
				Type    string             `json:"type"`
				Enabled *bool              `json:"enabled"`
				Params  map[string]float64 `json:"params"`
			}
			if json.Unmarshal(raw, &layers) != nil {
				return fmt.Errorf("adjustments.fx must be a list of {type, params}")
			}
			if len(layers) > timelineMaxFx {
				return fmt.Errorf("at most %d fx layers", timelineMaxFx)
			}
			for _, layer := range layers {
				if !studioSchema.FxTypes[layer.Type] {
					return fmt.Errorf("unknown fx type %q", layer.Type)
				}
			}
		}
	}
	return nil
}

func timelineURLName(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	name, _ := url.PathUnescape(path.Base(parsed.Path))
	if name == "." || name == "/" {
		return ""
	}
	return name
}

func timelineMediaID(asset *timelineAsset) string {
	if _, err := uuid.Parse(asset.MediaID); err == nil {
		return asset.MediaID
	}
	if _, err := uuid.Parse(asset.ID); err == nil {
		return asset.ID
	}
	return uuid.NewSHA1(timelineMediaNamespace, []byte(asset.ID+"\x00"+asset.CloudURL)).String()
}

func timelineDefaultContentType(asset *timelineAsset) string {
	switch {
	case asset.Text != nil:
		return "image/png"
	case asset.Kind == "video":
		return "video/mp4"
	case asset.Kind == "audio":
		return "audio/mpeg"
	}
	return "image/png"
}

func timelineFit(width, height, maxWidth, maxHeight int) (int, int) {
	scale := math.Min(1, math.Min(float64(maxWidth)/math.Max(1, float64(width)), float64(maxHeight)/math.Max(1, float64(height))))
	w := math.Max(2, math.Round(float64(width)*scale/2)*2)
	h := math.Max(2, math.Round(float64(height)*scale/2)*2)
	encoder := math.Max(1, math.Max(16/w, 16/h))
	return int(math.Max(16, math.Round(w*encoder/2)*2)), int(math.Max(16, math.Round(h*encoder/2)*2))
}

func timelineOutputSize(width, height int, resolution string) (int, int) {
	if resolution == "" || resolution == "source" {
		return timelineFit(width, height, 4096, 4096)
	}
	short, _ := strconv.Atoi(strings.TrimSuffix(resolution, "p"))
	long := int(math.Round(float64(short) * 16 / 9))
	if width >= height {
		return timelineFit(width, height, long, short)
	}
	return timelineFit(width, height, short, long)
}

func (doc *timelineDocument) finalize(media func(*timelineAsset) (timelineMediaInfo, bool)) error {
	now := float64(time.Now().UnixMilli())
	laneEnd := map[string]float64{}
	for i, asset := range doc.Assets {
		info, known := media(asset)
		fail := func(format string, args ...interface{}) error {
			return fmt.Errorf("assets[%d] (%s): %s", i, asset.ID, fmt.Sprintf(format, args...))
		}
		asset.MediaID = timelineMediaID(asset)
		if asset.Name == "" {
			switch {
			case asset.Text != nil:
				asset.Name = truncateString(asset.Text.Content, 60)
			case timelineURLName(asset.CloudURL) != "":
				asset.Name = truncateString(timelineURLName(asset.CloudURL), 120)
			default:
				asset.Name = asset.ID
			}
		}
		switch {
		case asset.Text != nil:
			if asset.Width == nil || asset.Height == nil {
				asset.Width, asset.Height = timelineFloat(timelineTextWidth), timelineFloat(timelineTextHeight)
			}
		case asset.Kind == "audio":
			asset.Width, asset.Height = timelineFloat(1), timelineFloat(1)
		default:
			if known && info.Width > 0 && info.Height > 0 {
				asset.Width, asset.Height = timelineFloat(info.Width), timelineFloat(info.Height)
			}
			if asset.Width == nil || asset.Height == nil {
				return fail("width and height are unknown")
			}
		}
		if asset.Kind == "image" {
			length := timelineValue(asset.TrimEnd, math.Max(timelineValue(asset.Duration, timelineImageSeconds), timelineImageSeconds))
			asset.Duration = timelineFloat(math.Max(timelineValue(asset.Duration, timelineImageSeconds), length))
			if asset.TrimEnd == nil {
				asset.TrimEnd = timelineFloat(timelineValue(asset.TrimStart, 0) + timelineImageSeconds)
			}
		} else {
			if known && info.Duration > 0 {
				asset.Duration = timelineFloat(info.Duration)
			}
			if timelineValue(asset.Duration, 0) <= 0 {
				return fail("could not read the media duration")
			}
			if asset.TrimEnd == nil || *asset.TrimEnd > *asset.Duration {
				asset.TrimEnd = timelineFloat(*asset.Duration)
			}
		}
		if asset.TrimStart == nil {
			asset.TrimStart = timelineFloat(0)
		}
		if *asset.TrimEnd-*asset.TrimStart < 0.05 {
			return fail("trimStart %.2f leaves no media before trimEnd %.2f", *asset.TrimStart, *asset.TrimEnd)
		}
		if asset.Kind == "audio" {
			asset.VisualTrack = timelineFloat(0)
		} else if asset.VisualTrack == nil {
			asset.VisualTrack = timelineFloat(0)
		}
		lane := "a"
		if asset.Kind != "audio" {
			lane = "v" + strconv.Itoa(int(*asset.VisualTrack))
		}
		if asset.TimelineStart == nil {
			asset.TimelineStart = timelineFloat(laneEnd[lane])
		}
		laneEnd[lane] = math.Max(laneEnd[lane], *asset.TimelineStart+*asset.TrimEnd-*asset.TrimStart)
		for _, field := range []**float64{&asset.FadeIn, &asset.FadeOut, &asset.StageX, &asset.StageY, &asset.StageRotation} {
			if *field == nil {
				*field = timelineFloat(0)
			}
		}
		for _, field := range []**float64{&asset.Volume, &asset.StageScale, &asset.Opacity} {
			if *field == nil {
				*field = timelineFloat(1)
			}
		}
		if asset.BlendMode == "" {
			asset.BlendMode = "normal"
		}
		if asset.Transition != nil && asset.Transition.Duration == nil {
			asset.Transition.Duration = timelineFloat(1)
		}
		if known && info.ContentType != "" {
			asset.ContentType = info.ContentType
		}
		if asset.ContentType == "" {
			asset.ContentType = timelineDefaultContentType(asset)
		}
		if known && info.Size > 0 {
			asset.Size = timelineFloat(float64(info.Size))
		}
		if asset.Size == nil {
			asset.Size = timelineFloat(0)
		}
		if asset.LastModified == nil {
			asset.LastModified = timelineFloat(now)
		}
	}
	if doc.Canvas == nil {
		for _, asset := range doc.Assets {
			if asset.Kind != "audio" {
				w, h := timelineFit(int(*asset.Width), int(*asset.Height), timelineMaxWidth, timelineMaxHeight)
				doc.Canvas = &timelineCanvas{Width: w, Height: h}
				break
			}
		}
	}
	if doc.AudioTrackVolume == nil {
		doc.AudioTrackVolume = timelineFloat(1)
	}
	found := false
	for _, asset := range doc.Assets {
		found = found || asset.ID == doc.SelectedID
	}
	if !found {
		doc.SelectedID = doc.Assets[0].ID
	}
	if seconds := doc.Duration(); seconds > timelineMaxSeconds {
		return fmt.Errorf("timeline runs %.1f s; the limit is %.0f s", seconds, timelineMaxSeconds)
	}
	return nil
}

func (doc *timelineDocument) Duration() float64 {
	end := 1.0
	for _, asset := range doc.Assets {
		end = math.Max(end, timelineValue(asset.TimelineStart, 0)+timelineValue(asset.TrimEnd, 0)-timelineValue(asset.TrimStart, 0))
	}
	return end
}

func (doc *timelineDocument) clone() *timelineDocument {
	raw, _ := json.Marshal(doc)
	var out timelineDocument
	_ = json.Unmarshal(raw, &out)
	return &out
}

func (doc *timelineDocument) mediaURLs() []string {
	seen := map[string]bool{}
	out := []string{}
	for _, asset := range doc.Assets {
		if asset.CloudURL != "" && !seen[asset.CloudURL] {
			seen[asset.CloudURL] = true
			out = append(out, asset.CloudURL)
		}
	}
	return out
}

type timelineRenderSettings struct {
	Format     string
	Quality    string
	Resolution string
	FPS        int
}

func timelineSettings(params map[string]interface{}) (timelineRenderSettings, error) {
	settings := timelineRenderSettings{Format: "mp4", Quality: "balanced", Resolution: "source", FPS: 30}
	if value := prodkitString(params, "format"); value != "" {
		if value != "mp4" && value != "webm" {
			return settings, fmt.Errorf("format must be mp4 or webm")
		}
		settings.Format = value
	}
	if value := prodkitString(params, "quality"); value != "" {
		if value != "draft" && value != "balanced" && value != "high" {
			return settings, fmt.Errorf("quality must be draft, balanced or high")
		}
		settings.Quality = value
	}
	if value := prodkitString(params, "resolution"); value != "" {
		switch value {
		case "source", "2160p", "1440p", "1080p", "720p":
			settings.Resolution = value
		default:
			return settings, fmt.Errorf("resolution must be source, 2160p, 1440p, 1080p or 720p")
		}
	}
	if raw, ok := params["fps"]; ok {
		fps, isNumber := raw.(float64)
		if !isNumber || fps != math.Floor(fps) || fps < 1 || fps > timelineMaxFPS {
			return settings, fmt.Errorf("fps must be an integer from 1 to %d", timelineMaxFPS)
		}
		settings.FPS = int(fps)
	}
	return settings, nil
}

func (settings timelineRenderSettings) page() map[string]interface{} {
	format := "mp4-h264"
	if settings.Format == "webm" {
		format = "webm-vp9"
	}
	return map[string]interface{}{
		"format": format, "resolution": settings.Resolution, "frameRate": settings.FPS, "quality": settings.Quality, "audio": "aac",
		"softwareMaxSize": map[string]int{"width": timelineMaxWidth, "height": timelineMaxHeight},
	}
}

func timelineAbove1080(width, height int) bool {
	long, short := width, height
	if short > long {
		long, short = short, long
	}
	return long > 1920 || short > 1080
}

func timelinePriceUSD(seconds float64, width, height int) float64 {
	rate := 0.01
	if timelineAbove1080(width, height) {
		rate = 0.02
	}
	return math.Max(timelineMinUSD, rate*math.Ceil(math.Max(0, seconds-0.01)))
}

func timelineDocumentParam(params map[string]interface{}) []byte {
	if params["document"] == nil {
		return nil
	}
	raw, _ := json.Marshal(params["document"])
	return raw
}

func timelineEstimate(params map[string]interface{}) (float64, int, int) {
	doc, err := parseTimelineDocument(timelineDocumentParam(params))
	if err != nil {
		return 0, 1920, 1080
	}
	estimate := doc.clone()
	_ = estimate.finalize(func(asset *timelineAsset) (timelineMediaInfo, bool) {
		info := timelineMediaInfo{Width: 1920, Height: 1080, Duration: timelineValue(asset.Duration, 0)}
		if info.Duration <= 0 {
			info.Duration = math.Max(timelineValue(asset.TrimEnd, 0), timelineImageSeconds)
		}
		return info, asset.Width == nil || asset.Duration == nil
	})
	width, height := 1920, 1080
	if estimate.Canvas != nil {
		width, height = estimate.Canvas.Width, estimate.Canvas.Height
	}
	settings, _ := timelineSettings(params)
	width, height = timelineOutputSize(width, height, settings.Resolution)
	return math.Min(estimate.Duration(), timelineMaxSeconds), width, height
}

func timelineEstimateUSD(req ServiceUsageRequest) float64 {
	seconds, width, height := timelineEstimate(prodkitParams(req))
	return timelinePriceUSD(seconds, width, height)
}

func (doc *timelineDocument) rewriteMedia(prefix string, files map[string]string) (*timelineDocument, map[string]string, error) {
	out := doc.clone()
	routes := map[string]string{}
	names := map[string]string{}
	for _, asset := range out.Assets {
		asset.PreviewURL = ""
		if asset.CloudURL == "" {
			continue
		}
		local, ok := files[asset.CloudURL]
		if !ok {
			return nil, nil, fmt.Errorf("media %s was not downloaded", truncateString(asset.CloudURL, 120))
		}
		name, ok := names[asset.CloudURL]
		if !ok {
			name = strconv.Itoa(len(names))
			names[asset.CloudURL] = name
			routes[name] = local
		}
		asset.CloudURL = prefix + name
	}
	return out, routes, nil
}

func (lut *timelineLUT) resolveCube(text string) error {
	size, data, err := parseTimelineCube(text)
	if err != nil {
		return err
	}
	if size > timelineStoredLUT {
		data = resampleTimelineLUT(size, data, timelineStoredLUT)
		size = timelineStoredLUT
	}
	buf := make([]byte, len(data)*2)
	for i, value := range data {
		binary.LittleEndian.PutUint16(buf[i*2:], uint16(math.Round(math.Max(0, math.Min(1, value))*65535)))
	}
	if lut.Name == "" {
		lut.Name = "LUT"
	}
	lut.Size, lut.Data, lut.Cube, lut.URL = size, base64.StdEncoding.EncodeToString(buf), "", ""
	return nil
}

func parseTimelineCube(text string) (int, []float64, error) {
	size := 0
	values := make([]float64, 0, 1024)
	scanner := bufio.NewScanner(strings.NewReader(text))
	scanner.Buffer(make([]byte, 64<<10), 1<<20)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if index := strings.IndexByte(line, '#'); index >= 0 {
			line = strings.TrimSpace(line[:index])
		}
		if line == "" {
			continue
		}
		fields := strings.Fields(line)
		switch strings.ToUpper(fields[0]) {
		case "TITLE":
			continue
		case "LUT_3D_SIZE":
			if len(fields) < 2 {
				return 0, nil, fmt.Errorf("invalid LUT_3D_SIZE")
			}
			size, _ = strconv.Atoi(fields[1])
			continue
		case "LUT_1D_SIZE":
			return 0, nil, fmt.Errorf("1D LUTs are not supported; use a 3D .cube")
		case "DOMAIN_MIN", "DOMAIN_MAX":
			want := "0"
			if strings.ToUpper(fields[0]) == "DOMAIN_MAX" {
				want = "1"
			}
			for _, field := range fields[1:] {
				if value, err := strconv.ParseFloat(field, 64); err != nil || value != parseFloat(want) {
					return 0, nil, fmt.Errorf("only DOMAIN_MIN 0 and DOMAIN_MAX 1 are supported")
				}
			}
			continue
		}
		if len(fields) < 3 {
			return 0, nil, fmt.Errorf("invalid LUT row %q", truncateString(line, 40))
		}
		for _, field := range fields[:3] {
			value, err := strconv.ParseFloat(field, 64)
			if err != nil || math.IsNaN(value) || math.IsInf(value, 0) {
				return 0, nil, fmt.Errorf("invalid LUT row %q", truncateString(line, 40))
			}
			values = append(values, value)
		}
	}
	if err := scanner.Err(); err != nil {
		return 0, nil, err
	}
	if size < 2 || size > 65 {
		return 0, nil, fmt.Errorf("LUT_3D_SIZE must be 2-65")
	}
	if len(values) != size*size*size*3 {
		return 0, nil, fmt.Errorf("LUT data does not match LUT_3D_SIZE %d", size)
	}
	return size, values, nil
}

func resampleTimelineLUT(size int, data []float64, target int) []float64 {
	sample := func(r, g, b float64, channel int) float64 {
		scale := float64(size - 1)
		pos := [3]float64{r * scale, g * scale, b * scale}
		var lo, hi [3]int
		var frac [3]float64
		for i := range pos {
			lo[i] = int(math.Floor(pos[i]))
			hi[i] = int(math.Min(float64(size-1), float64(lo[i]+1)))
			frac[i] = pos[i] - float64(lo[i])
		}
		at := func(ri, gi, bi int) float64 { return data[((bi*size+gi)*size+ri)*3+channel] }
		mix := func(a, b, t float64) float64 { return a + (b-a)*t }
		c00 := mix(at(lo[0], lo[1], lo[2]), at(hi[0], lo[1], lo[2]), frac[0])
		c10 := mix(at(lo[0], hi[1], lo[2]), at(hi[0], hi[1], lo[2]), frac[0])
		c01 := mix(at(lo[0], lo[1], hi[2]), at(hi[0], lo[1], hi[2]), frac[0])
		c11 := mix(at(lo[0], hi[1], hi[2]), at(hi[0], hi[1], hi[2]), frac[0])
		return mix(mix(c00, c10, frac[1]), mix(c01, c11, frac[1]), frac[2])
	}
	out := make([]float64, 0, target*target*target*3)
	step := 1 / float64(target-1)
	for b := 0; b < target; b++ {
		for g := 0; g < target; g++ {
			for r := 0; r < target; r++ {
				for channel := 0; channel < 3; channel++ {
					out = append(out, sample(float64(r)*step, float64(g)*step, float64(b)*step, channel))
				}
			}
		}
	}
	return out
}

func (doc *timelineDocument) marshalStudio() ([]byte, error) {
	for id, lut := range doc.LUTs {
		if lut.Data == "" {
			return nil, fmt.Errorf("luts[%q] was not resolved", id)
		}
	}
	raw, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}
	if len(raw) > maxStudioProjectDocumentBytes {
		return nil, errors.New("studio document is too large")
	}
	return raw, nil
}

func (doc *timelineDocument) summary() map[string]interface{} {
	kinds := map[string]int{}
	for _, asset := range doc.Assets {
		kind := asset.Kind
		if asset.Text != nil {
			kind = "text"
		}
		kinds[kind]++
	}
	keys := make([]string, 0, len(kinds))
	for key := range kinds {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	clips := map[string]int{}
	for _, key := range keys {
		clips[key] = kinds[key]
	}
	out := map[string]interface{}{"duration_seconds": math.Round(doc.Duration()*1000) / 1000, "clips": clips}
	if doc.Canvas != nil {
		out["canvas"] = doc.Canvas
	}
	return out
}
