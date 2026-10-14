package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/valyala/fasthttp"
)

type mcpProductionTool struct {
	Name        string
	Title       string
	Service     string
	Description string
	Properties  map[string]interface{}
	Required    []string
}

func mcpEnum(values ...string) map[string]interface{} {
	return map[string]interface{}{"type": "string", "enum": values}
}

func mcpNumber(lo, hi float64, description string) map[string]interface{} {
	return map[string]interface{}{"type": "number", "minimum": lo, "maximum": hi, "description": description}
}

func mcpRenderProps() map[string]interface{} {
	return map[string]interface{}{
		"duration":   mcpNumber(2, 8, "Seconds."),
		"aspect":     mcpEnum("16:9", "9:16", "1:1"),
		"quality":    map[string]interface{}{"type": "string", "enum": []string{"draft", "standard", "high"}, "description": "draft ~540p fast, standard 720p, high 1080p (+$0.20)."},
		"background": mcpEnum("studio", "dark", "sky", "white"),
		"seed":       map[string]string{"type": "integer"},
	}
}

func mcpMerge(maps ...map[string]interface{}) map[string]interface{} {
	out := map[string]interface{}{}
	for _, m := range maps {
		for k, v := range m {
			out[k] = v
		}
	}
	return out
}

var mcpModelInput = map[string]interface{}{
	"model_url": map[string]string{"type": "string", "description": "Public .glb/.obj/.fbx/.stl/.ply URL (use create_upload for local files)."},
	"image_url": map[string]string{"type": "string", "description": "Photo to turn into 3D first (+$0.06). Ignored when model_url is set."},
}

func mcpProductionTools() []mcpProductionTool {
	return []mcpProductionTool{
		{
			Name: "blender_destruction", Title: "Simulate destruction in Blender", Service: "destruction-studio",
			Description: "Fracture a subject (preset, 3D text, uploaded model or photo-to-3D) and simulate a rigid-body destruction with debris and dust in hosted Blender. Returns an MP4, poster and a baked, editable .blend. $0.40 base.",
			Properties: mcpMerge(mcpModelInput, mcpRenderProps(), map[string]interface{}{
				"subject":  mcpEnum("tower", "wall", "pillar", "statue", "house", "text"),
				"text":     map[string]string{"type": "string", "description": "Extruded text when subject is text."},
				"pieces":   mcpNumber(12, 160, "Fracture pieces."),
				"material": mcpEnum("concrete", "brick", "glass", "wood", "marble", "ice"),
				"impact":   mcpEnum("ball", "explosion", "quake", "slice"),
				"slowmo":   map[string]string{"type": "boolean"},
				"dust":     map[string]string{"type": "boolean"},
			}),
		},
		{
			Name: "blender_exploded_view", Title: "Animate an exploded view in Blender", Service: "exploded-view",
			Description: "Split a model into parts and animate them exploding or assembling with clean studio staging in hosted Blender. Returns MP4, poster and editable .blend. $0.40 base.",
			Properties: mcpMerge(mcpModelInput, mcpRenderProps(), map[string]interface{}{
				"mode":      mcpEnum("explode", "assemble", "explode_assemble"),
				"split":     mcpEnum("auto", "loose", "material", "slices"),
				"axis":      mcpEnum("radial", "vertical", "forward"),
				"spread":    mcpNumber(0.2, 3, "Distance multiplier."),
				"stagger":   mcpNumber(0, 1, "Per-part delay."),
				"turntable": map[string]string{"type": "boolean"},
				"guides":    map[string]string{"type": "boolean"},
				"demo":      mcpEnum("headphones", "camera", "watch"),
			}),
		},
		{
			Name: "blender_toon_shader", Title: "Toon-shade a model in Blender", Service: "toon-shader",
			Description: "Apply cel/anime/comic toon materials with outlines to a model and render a turntable in hosted Blender. Returns MP4, poster and .blend with editable materials. $0.30 base.",
			Properties: mcpMerge(mcpModelInput, mcpRenderProps(), map[string]interface{}{
				"style":         mcpEnum("cel", "anime", "comic", "flat"),
				"bands":         mcpNumber(2, 5, "Shading bands."),
				"outline_width": mcpNumber(0, 10, "Outline thickness."),
				"outline_color": map[string]string{"type": "string", "description": "Hex color."},
				"rim":           map[string]string{"type": "boolean"},
				"palette":       map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}, "maxItems": 8},
				"turntable":     map[string]string{"type": "boolean"},
				"demo":          mcpEnum("character", "car", "helmet"),
			}),
		},
		{
			Name: "blender_render_scene", Title: "Render a scene spec in remote Blender", Service: "blender-scene",
			Description: "Build and render a declarative Blender scene: primitives, 3D text and uploaded models with materials, lights, camera and keyframes. Returns MP4, poster and editable .blend. $0.30 base. spec = {objects:[{type,model_index,text,location,rotation,scale,material:{color,roughness,metallic,emission,emission_strength,toon},keyframes:[{frame,location,rotation,scale}]}], lights:[{type,location,rotation,color,energy}], camera:{location,look_at,lens,keyframes}, world:{color,strength,preset}, frames}.",
			Properties: mcpMerge(mcpRenderProps(), map[string]interface{}{
				"spec":       map[string]interface{}{"type": "object", "description": "Scene spec (max 64 objects)."},
				"model_urls": map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}, "maxItems": 16, "description": "Models referenced by objects[].model_index."},
			}),
			Required: []string{"spec"},
		},
		{
			Name: "image_to_3d", Title: "Turn a photo into a 3D model", Service: "image-to-3d",
			Description: "Build a textured GLB from one photo. $0.06; quality high $0.45.",
			Properties: map[string]interface{}{
				"image_url": map[string]string{"type": "string"},
				"quality":   mcpEnum("standard", "high"),
			},
			Required: []string{"image_url"},
		},
		{
			Name: "vectorize_image", Title: "Convert an image to layered SVG", Service: "vectorize",
			Description: "Trace a raster image into an SVG grouped into one layer per color (opens as layers in Illustrator/Inkscape/Figma). $0.02; engine ai $0.03.",
			Properties: map[string]interface{}{
				"image_url": map[string]string{"type": "string"},
				"mode":      mcpEnum("color", "poster", "bw", "lineart"),
				"colors":    mcpNumber(2, 8, "Color precision bits (fewer = flatter)."),
				"detail":    mcpNumber(0, 1, "Higher keeps smaller shapes."),
				"corners":   mcpNumber(0, 180, "Corner threshold in degrees."),
				"smooth":    mcpEnum("spline", "polygon", "pixel"),
				"engine":    mcpEnum("trace", "ai"),
			},
			Required: []string{"image_url"},
		},
		{
			Name: "remove_video_objects", Title: "Remove objects from video", Service: "shot-cleanup",
			Description: "Erase an object from a video while keeping motion and texture. Name it in prompt (e.g. \"person\", \"logo\", \"car\") for clips up to 30 s, or pass points on the first frame for clips up to 4.8 s. $0.24 per second, charged on success.",
			Properties: map[string]interface{}{
				"video_url":  map[string]string{"type": "string"},
				"prompt":     map[string]string{"type": "string", "description": "Short noun naming what to remove."},
				"points":     map[string]interface{}{"type": "array", "maxItems": 12, "items": map[string]interface{}{"type": "object", "properties": map[string]interface{}{"x": map[string]string{"type": "number"}, "y": map[string]string{"type": "number"}, "type": mcpEnum("positive", "negative")}}},
				"keep_audio": map[string]string{"type": "boolean"},
				"duration":   map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 30, "description": "Seconds to process from the start (defaults to the whole clip up to 30 s)."},
			},
			Required: []string{"video_url"},
		},
	}
}

var mcpTopLevelFields = map[string]bool{"image_url": true, "model_url": true, "model_urls": true, "video_url": true, "prompt": true, "duration": true}

func mcpProductionToolDefs() []map[string]interface{} {
	writeTool := map[string]bool{"readOnlyHint": false, "destructiveHint": false, "idempotentHint": false, "openWorldHint": true}
	readOnly := map[string]bool{"readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true}
	defs := []map[string]interface{}{
		{
			"name": "list_services", "title": "List ManifoldGen services",
			"description": "List every generation service and production tool with price, unit and parameters.",
			"inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false},
			"annotations": readOnly,
		},
		{
			"name": "create_upload", "title": "Create an upload URL",
			"description": "Get a presigned PUT URL for a local image, video, audio or 3D model, then upload with: curl -X PUT -H 'Content-Type: <content_type>' --data-binary @file '<upload_url>'. Pass public_url to other tools.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"filename":     map[string]string{"type": "string"},
					"content_type": map[string]string{"type": "string", "description": "e.g. image/png, video/mp4, model/gltf-binary"},
					"size":         map[string]interface{}{"type": "integer", "minimum": 1},
				},
				"required": []string{"filename", "content_type", "size"}, "additionalProperties": false,
			},
			"annotations": writeTool,
		},
		{
			"name": "wait_for_job", "title": "Wait for a ManifoldGen job",
			"description": "Poll an asynchronous job until it completes, fails or the timeout passes, then return its status and outputs.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"job_id":          map[string]string{"type": "string"},
					"timeout_seconds": map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 600, "default": 240},
				},
				"required": []string{"job_id"}, "additionalProperties": false,
			},
			"annotations": readOnly,
		},
	}
	for _, tool := range mcpProductionTools() {
		props := mcpMerge(tool.Properties, map[string]interface{}{
			"wait_seconds": map[string]interface{}{"type": "integer", "minimum": 0, "maximum": 600, "default": 0, "description": "Block until done up to this many seconds."},
		})
		defs = append(defs, map[string]interface{}{
			"name": tool.Name, "title": tool.Title, "description": tool.Description + " Requires a bearer key; call get_pricing or list_services if cost is unknown.",
			"inputSchema": map[string]interface{}{"type": "object", "properties": props, "required": append([]string{}, tool.Required...), "additionalProperties": false},
			"annotations": writeTool,
		})
	}
	return defs
}

func mcpProductionToolByName(name string) (mcpProductionTool, bool) {
	for _, tool := range mcpProductionTools() {
		if tool.Name == name {
			return tool, true
		}
	}
	return mcpProductionTool{}, false
}

func executeMCPProductionTool(parent *fasthttp.RequestCtx, name string, arguments json.RawMessage) (map[string]interface{}, int, bool) {
	switch name {
	case "list_services":
		internal := newMCPInternalContext(parent)
		handleGetPricing(internal)
		pricing := map[string]interface{}{}
		_ = json.Unmarshal(internal.Response.Body(), &pricing)
		return map[string]interface{}{"services": pricing["pricing"], "production_tools": prodkitCatalog(), "credit_price_usd": pricing["credit_price_usd"]}, http.StatusOK, true
	case "create_upload":
		var args struct {
			Filename    string `json:"filename"`
			ContentType string `json:"content_type"`
			Size        int64  `json:"size"`
		}
		if err := decodeMCPArguments(arguments, &args); err != nil {
			return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest, true
		}
		body, _ := json.Marshal(map[string]interface{}{"project_id": uuid.NewString(), "asset_id": uuid.NewString(), "filename": args.Filename, "content_type": args.ContentType, "size": args.Size})
		internal := newMCPInternalContext(parent)
		internal.Request.Header.SetMethod(http.MethodPost)
		internal.Request.SetRequestURI("/api/studio/assets/presign")
		internal.Request.Header.SetContentType("application/json")
		internal.Request.SetBody(body)
		handleStudioAssetPresign(internal)
		response, status := mcpInternalJSON(internal)
		return response, status, true
	case "wait_for_job":
		var args struct {
			JobID   string `json:"job_id"`
			Timeout int    `json:"timeout_seconds"`
		}
		if err := decodeMCPArguments(arguments, &args); err != nil || strings.TrimSpace(args.JobID) == "" {
			return map[string]interface{}{"error": "job_id is required"}, http.StatusBadRequest, true
		}
		if args.Timeout <= 0 || args.Timeout > 600 {
			args.Timeout = 240
		}
		response, status := mcpWaitForJob(parent, args.JobID, time.Duration(args.Timeout)*time.Second)
		return response, status, true
	}
	tool, ok := mcpProductionToolByName(name)
	if !ok {
		return nil, 0, false
	}
	body, wait, err := mcpProductionRequestBody(tool, arguments)
	if err != nil {
		return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest, true
	}
	internal := newMCPInternalContext(parent)
	internal.Request.Header.SetMethod(http.MethodPost)
	internal.Request.SetRequestURI("/api/service")
	internal.Request.Header.SetContentType("application/json")
	internal.Request.SetBody(body)
	handleServiceRequest(internal)
	response, status := mcpInternalJSON(internal)
	if wait > 0 && status < 300 {
		if result, ok := response["result"].(map[string]interface{}); ok {
			if jobID, _ := result["job_id"].(string); jobID != "" && result["status"] != "completed" {
				if wait > 600 {
					wait = 600
				}
				job, jobStatus := mcpWaitForJob(parent, jobID, time.Duration(wait)*time.Second)
				response["job"] = job
				if jobStatus >= 300 {
					status = jobStatus
				}
			}
		}
	}
	return response, status, true
}

func mcpInternalJSON(internal *fasthttp.RequestCtx) (map[string]interface{}, int) {
	response := map[string]interface{}{}
	if err := json.Unmarshal(internal.Response.Body(), &response); err != nil {
		return map[string]interface{}{"error": "ManifoldGen returned an invalid JSON response"}, http.StatusInternalServerError
	}
	return response, internal.Response.StatusCode()
}

var mcpJobPollInterval = 3 * time.Second

func mcpWaitForJob(parent *fasthttp.RequestCtx, jobID string, timeout time.Duration) (map[string]interface{}, int) {
	deadline := time.Now().Add(timeout)
	for {
		internal := newMCPInternalContext(parent)
		handleVideoJobStatus(internal, jobID)
		response, status := mcpInternalJSON(internal)
		if status >= 300 {
			return response, status
		}
		state := ""
		if job, ok := response["job"].(map[string]interface{}); ok {
			state, _ = job["status"].(string)
		} else {
			state, _ = response["status"].(string)
		}
		switch strings.ToLower(state) {
		case "completed", "failed", "cancelled", "canceled", "payment_required", "timed_out":
			return response, status
		}
		if time.Now().Add(mcpJobPollInterval).After(deadline) {
			response["waiting"] = "timeout reached; call wait_for_job again with the same job_id"
			return response, status
		}
		time.Sleep(mcpJobPollInterval)
	}
}

type mcpPrompt struct {
	Name, Title, Description, Body string
}

var mcpPrompts = []mcpPrompt{
	{"production-bundle", "Production skills bundle", "Turn an idea into an editable production project using the best-fit ManifoldGen workflow.",
		"Help me turn my idea into an editable production project. Pick the workflow that fits: destruction-studio, exploded-view, scene-builder, toon-shader, shot-cleanup, shot-composer, vectorize, image-fixer, color-grade or shader-fx. Ask about goals, reference assets, output format and duration, check cost with list_services, then run it. Keep outputs editable (.blend, layered SVG, .cube LUT, Studio project) and return every download link."},
	{"destruction-studio", "Simulate destruction", "Cinematic fracture, debris and dust with an editable .blend.",
		"Create a destruction shot with blender_destruction. Ask what should break (preset subject, 3D text, my model or a photo), the material, impact type, slow motion and aspect. Start at quality draft to check framing, then render standard or high. Return the MP4, poster and .blend links and offer a Studio edit."},
	{"exploded-view", "Animate assembly", "Exploded or assembling parts with clean product staging.",
		"Make an exploded or assembly animation with blender_exploded_view. Ask for the model (upload with create_upload), mode, axis, spread and whether to add a turntable. Render a draft first, then standard. Return MP4, poster and .blend."},
	{"scene-builder", "Build a 3D scene", "Compose characters, props and architecture into an editable Blender scene.",
		"Build a scene with blender_render_scene. Ask for the subject, props, mood and camera move. Turn reference photos into models with image_to_3d, then write a spec with objects (model_index into model_urls, primitives or text), lights, camera keyframes and world preset. Render draft, refine positions, render final. Return MP4, poster and .blend."},
	{"toon-shader", "Cartoon materials", "Toon shading with outlines and adjustable bands.",
		"Toon-shade a model with blender_toon_shader. Ask for the model or photo, style (cel, anime, comic, flat), band count, outline width and color and palette. Return the turntable MP4 and the .blend with editable materials."},
	{"shot-cleanup", "Remove objects from video", "Erase unwanted elements while keeping motion and texture.",
		"Clean up a shot with remove_video_objects. Ask what to remove; prefer a short noun prompt (person, car, logo). For clips under 4.8 s, points on the first frame are also possible. Confirm the per-second cost first. Return the cleaned MP4."},
	{"shot-composer", "Composite a VFX shot", "Key a subject and place it on a new plate with matched color and grain.",
		"Composite a shot: remove the background with generate_media service video_background_removal (transparent output), get or generate a background plate, then open both in ManifoldGen Studio (https://manifoldgen.com/studio) on separate tracks, use chroma/luma key or the alpha clip, match color with the grade panel and add grain. Return links and the steps taken."},
	{"vectorize", "Convert images to vectors", "Layered SVG with one group per color.",
		"Vectorize an image with vectorize_image. Ask whether it is a logo/flat art (mode poster, fewer colors), line art (lineart) or illustration (color). Return the layered SVG link and the palette."},
	{"image-fixer", "Clean up images", "Fix textures, remove objects, relight and upscale.",
		"Fix an image step by step with generate_media: image-edit or inpaint for removals and texture fixes, relight for lighting, remove-background for cutouts and upscale-image last. Show each intermediate URL so steps stay reversible."},
	{"color-grade", "Color grade footage", "Balanced shots, natural skin tones and an exportable LUT.",
		"Grade footage in ManifoldGen's browser grader at https://manifoldgen.com/tools/color-grade (or the Studio grade panel): auto white balance, lift/gamma/gain, curves, match to a reference frame, then export the .cube LUT and the graded MP4. Explain the node-style adjustments made."},
	{"shader-fx", "Visual effects", "TouchDesigner-style real-time effects on images and video.",
		"Build an effect stack at https://manifoldgen.com/tools/shader-fx (feedback, kaleidoscope, bloom, displacement, halftone, VHS, keys). Preview, tune parameters, then export MP4 or PNG, or open in Studio for the edit."},
}

func mcpPromptList() []map[string]interface{} {
	out := []map[string]interface{}{}
	for _, prompt := range mcpPrompts {
		out = append(out, map[string]interface{}{
			"name": prompt.Name, "title": prompt.Title, "description": prompt.Description,
			"arguments": []map[string]interface{}{{"name": "brief", "description": "What you want to make.", "required": false}},
		})
	}
	return out
}

func mcpPromptGet(params json.RawMessage) (map[string]interface{}, bool) {
	var request struct {
		Name      string            `json:"name"`
		Arguments map[string]string `json:"arguments"`
	}
	if json.Unmarshal(params, &request) != nil {
		return nil, false
	}
	for _, prompt := range mcpPrompts {
		if prompt.Name != request.Name {
			continue
		}
		text := prompt.Body
		if brief := strings.TrimSpace(request.Arguments["brief"]); brief != "" {
			text += "\n\nBrief: " + brief
		}
		return map[string]interface{}{
			"description": prompt.Description,
			"messages":    []map[string]interface{}{{"role": "user", "content": map[string]string{"type": "text", "text": text}}},
		}, true
	}
	return nil, false
}

func mcpProductionRequestBody(tool mcpProductionTool, arguments json.RawMessage) ([]byte, int, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(arguments, &raw); err != nil {
		return nil, 0, fmt.Errorf("arguments must be a JSON object")
	}
	request := map[string]interface{}{"service": tool.Service}
	params := map[string]json.RawMessage{}
	wait := 0
	for key, value := range raw {
		if _, known := tool.Properties[key]; !known && key != "wait_seconds" {
			return nil, 0, fmt.Errorf("unknown argument %q", key)
		}
		switch {
		case key == "wait_seconds":
			_ = json.Unmarshal(value, &wait)
		case mcpTopLevelFields[key] && !(key == "duration" && tool.Name != "remove_video_objects"):
			request[key] = value
		default:
			params[key] = value
		}
	}
	if len(params) > 0 {
		request["params"] = params
	}
	body, err := json.Marshal(request)
	return body, wait, err
}
