package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	prodkitTrackBlur     = "prodkit_track_blur"
	prodkitStickyOverlay = "prodkit_sticky_overlay"
	prodkitFlowFX        = "prodkit_flow_fx"
	prodkitReactiveFX    = "prodkit_reactive_fx"
	prodkitMaskPropagate = "prodkit_mask_propagate"

	prodkitTrackBlurRate     = 0.06
	prodkitTrackBlurMin      = 0.15
	prodkitStickyRate        = 0.06
	prodkitStickyMin         = 0.15
	prodkitFlowFXRate        = 0.08
	prodkitFlowFXMin         = 0.20
	prodkitReactiveFXRate    = 0.08
	prodkitReactiveFXMin     = 0.20
	prodkitMaskPropagateRate = 0.05
	prodkitMaskPropagateMin  = 0.12
	prodkitPTMaxSec          = 20.0
	prodkitPTFlowMaxSec      = 15.0
)

var prodkitPTBlurStyles = []string{"blur", "pixelate", "solid"}
var prodkitPTFlowEffects = []string{"motion-blur", "jelly", "trails", "flow-color"}
var prodkitPTReactiveEffects = []string{"glow", "trails", "sparks", "warp", "flash"}

func init() {
	prodkitMotionSpecs[prodkitTrackBlur] = prodkitMotionSpec{prodkitTrackBlurRate, prodkitTrackBlurMin, prodkitPTMaxSec, "track-blur"}
	prodkitMotionSpecs[prodkitStickyOverlay] = prodkitMotionSpec{prodkitStickyRate, prodkitStickyMin, prodkitPTMaxSec, "sticky-overlay"}
	prodkitMotionSpecs[prodkitFlowFX] = prodkitMotionSpec{prodkitFlowFXRate, prodkitFlowFXMin, prodkitPTFlowMaxSec, "flow-fx"}
	prodkitMotionSpecs[prodkitReactiveFX] = prodkitMotionSpec{prodkitReactiveFXRate, prodkitReactiveFXMin, prodkitPTMaxSec, "reactive-fx"}
	prodkitMotionSpecs[prodkitMaskPropagate] = prodkitMotionSpec{prodkitMaskPropagateRate, prodkitMaskPropagateMin, prodkitPTMaxSec, "mask-propagate"}
}

func prodkitMotionIsPT(service string) bool {
	switch service {
	case prodkitTrackBlur, prodkitStickyOverlay, prodkitFlowFX, prodkitReactiveFX, prodkitMaskPropagate:
		return true
	}
	return false
}

func prodkitPTPython() string {
	return strings.TrimSpace(os.Getenv("PRODKIT_PTFX_PYTHON"))
}

var prodkitPTAvailable = func() bool {
	py := prodkitPTPython()
	if py == "" {
		return false
	}
	if _, err := os.Stat(py); err != nil {
		return false
	}
	_, err := os.Stat(filepath.Join(prodkitMotionRoot(), "motiontrack", "ptfx.py"))
	return err == nil
}

func prodkitMotionAvailableFor(service string) bool {
	if prodkitMotionIsPT(service) {
		return prodkitPTAvailable()
	}
	return prodkitMotionAvailable()
}

func prodkitPTNumber(params map[string]interface{}, key string, lo, hi float64) error {
	if _, ok := params[key]; !ok {
		return nil
	}
	if err := prodkitParamType(params, key, "number"); err != nil {
		return err
	}
	if value := params[key].(float64); value < lo || value > hi {
		return fmt.Errorf("params.%s must be from %g to %g", key, lo, hi)
	}
	return nil
}

func prodkitPTObject(params map[string]interface{}, key string, fields map[string][2]float64) error {
	raw, ok := params[key]
	if !ok {
		return nil
	}
	object, isObject := raw.(map[string]interface{})
	if !isObject {
		return fmt.Errorf("params.%s must be an object", key)
	}
	for name, value := range object {
		bounds, known := fields[name]
		if !known {
			return fmt.Errorf("params.%s.%s is not a known field", key, name)
		}
		number, isNumber := value.(float64)
		if !isNumber || math.IsNaN(number) || number < bounds[0] || number > bounds[1] {
			return fmt.Errorf("params.%s.%s must be a number from %g to %g", key, name, bounds[0], bounds[1])
		}
	}
	return nil
}

func prodkitPTHex(params map[string]interface{}, key string) error {
	if _, ok := params[key]; !ok {
		return nil
	}
	if err := prodkitParamType(params, key, "string"); err != nil {
		return err
	}
	value := strings.TrimPrefix(prodkitString(params, key), "#")
	if len(value) != 6 {
		return fmt.Errorf("params.%s must be a hex colour like #ffd21f", key)
	}
	for _, r := range value {
		if !strings.ContainsRune("0123456789abcdef", r) {
			return fmt.Errorf("params.%s must be a hex colour like #ffd21f", key)
		}
	}
	return nil
}

func prodkitPTRegion(params map[string]interface{}, required bool) error {
	box := map[string][2]float64{"x": {0, 1}, "y": {0, 1}, "w": {0.01, 1}, "h": {0.01, 1}}
	point := map[string][2]float64{"x": {0, 1}, "y": {0, 1}, "radius": {0.01, 0.5}}
	if err := prodkitPTObject(params, "region", box); err != nil {
		return err
	}
	if err := prodkitPTObject(params, "point", point); err != nil {
		return err
	}
	_, hasRegion := params["region"]
	_, hasPoint := params["point"]
	if required && !hasRegion && !hasPoint {
		return fmt.Errorf("params.region (x, y, w, h as fractions of the frame), params.point (x, y, radius) or image_url (mask) is required")
	}
	return nil
}

func normalizeProdkitMotionPT(req *ServiceUsageRequest, params map[string]interface{}) error {
	spec := prodkitMotionSpecs[req.Service]
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	if req.ImageURL != "" {
		if err := validateProdkitURL(req.ImageURL); err != nil {
			return err
		}
	}
	req.AudioURL = strings.TrimSpace(req.AudioURL)
	if req.AudioURL != "" {
		if err := validateProdkitURL(req.AudioURL); err != nil {
			return err
		}
	}
	for key, kind := range map[string]string{"strength": "number", "intensity": "number", "feather": "number", "grow": "number", "persp": "number",
		"track_pad": "number", "x": "number", "y": "number", "width": "number", "rotation": "number", "fade": "number", "audio_start": "number",
		"segment": "number", "invert": "bool", "pop": "bool", "text": "string"} {
		if err := prodkitParamType(params, key, kind); err != nil {
			return err
		}
	}
	ranges := map[string][2]float64{"strength": {0.3, 3}, "feather": {0, 0.05}, "grow": {0, 0.05}, "persp": {0, 1}, "track_pad": {1, 4},
		"x": {0, 1}, "y": {0, 1}, "width": {0.03, 0.9}, "rotation": {-180, 180}, "fade": {0, 2}, "audio_start": {0, 3600}, "segment": {8, 96}}
	for key, bounds := range ranges {
		if err := prodkitPTNumber(params, key, bounds[0], bounds[1]); err != nil {
			return err
		}
	}
	for _, key := range []string{"palette"} {
		if err := prodkitMotionEnum(params, key, prodkitMotionPalettes); err != nil {
			return err
		}
	}
	if err := prodkitMotionInt(params, "seed", 0, 1<<30); err != nil {
		return err
	}
	if err := prodkitPTHex(params, "color"); err != nil {
		return err
	}
	switch req.Service {
	case prodkitTrackBlur:
		if err := prodkitMotionEnum(params, "style", prodkitPTBlurStyles); err != nil {
			return err
		}
		if err := prodkitMotionEnum(params, "mode", []string{"region", "mask"}); err != nil {
			return err
		}
		if err := prodkitMotionEnum(params, "shape", []string{"rect", "ellipse"}); err != nil {
			return err
		}
		if err := prodkitPTRegion(params, req.ImageURL == ""); err != nil {
			return err
		}
	case prodkitMaskPropagate:
		if err := prodkitMotionEnum(params, "shape", []string{"rect", "ellipse"}); err != nil {
			return err
		}
		if err := prodkitPTRegion(params, req.ImageURL == ""); err != nil {
			return err
		}
	case prodkitStickyOverlay:
		if strings.TrimSpace(prodkitString(params, "text")) == "" && req.ImageURL == "" {
			return fmt.Errorf("params.text or image_url (a PNG sticker) is required")
		}
		if len([]rune(prodkitString(params, "text"))) > 40 {
			return fmt.Errorf("params.text must be at most 40 characters")
		}
	case prodkitFlowFX:
		if err := prodkitMotionStrings(params, "effects", len(prodkitPTFlowEffects), 14, prodkitPTFlowEffects); err != nil {
			return err
		}
	case prodkitReactiveFX:
		if err := prodkitMotionStrings(params, "effects", len(prodkitPTReactiveEffects), 10, prodkitPTReactiveEffects); err != nil {
			return err
		}
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

var prodkitPTParamKeys = []string{"region", "point", "style", "mode", "strength", "feather", "grow", "invert", "color", "persp", "track_pad", "text", "x", "y",
	"width", "rotation", "pop", "fade", "effects", "intensity", "palette", "seed", "audio_start", "shape", "segment"}

func prodkitMotionPTParams(req ServiceUsageRequest, seconds float64) map[string]interface{} {
	params := prodkitParams(req)
	out := map[string]interface{}{"max_seconds": seconds}
	for _, key := range prodkitPTParamKeys {
		if value, ok := params[key]; ok {
			out[key] = value
		}
	}
	return out
}

var prodkitPTResultKeys = []string{"mode", "style", "tracked_visible", "effects", "mean_motion_px", "audio_bpm", "kicks", "snares", "area_first", "area_last"}

func prodkitPTResult(raw []byte, result map[string]interface{}) {
	var extra map[string]interface{}
	if json.Unmarshal(raw, &extra) != nil {
		return
	}
	for _, key := range prodkitPTResultKeys {
		if value, ok := extra[key]; ok {
			result[key] = value
		}
	}
}

func prodkitPTSocketRun(ctx context.Context, argsPath string) (int, bool) {
	sock := strings.TrimSpace(os.Getenv("PRODKIT_PTFX_SOCKET"))
	if sock == "" {
		return 0, false
	}
	dialer := net.Dialer{Timeout: 2 * time.Second}
	conn, err := dialer.DialContext(ctx, "unix", sock)
	if err != nil {
		log.Printf("[prodkit] warm worker unavailable, starting a process: %v", err)
		return 0, false
	}
	defer conn.Close()
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()
	if _, err := fmt.Fprintf(conn, "%s\n", argsPath); err != nil {
		return 1, true
	}
	var reply struct {
		Code int `json:"code"`
	}
	if err := json.NewDecoder(conn).Decode(&reply); err != nil {
		log.Printf("[prodkit] warm worker reply: %v", err)
		return 1, true
	}
	return reply.Code, true
}
