package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/valyala/fasthttp"
)

const (
	mcpProtocolVersion = "2025-06-18"
	mcpMaxRequestBytes = 1 << 20
)

type mcpRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type mcpToolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type mcpToolExecutor func(*fasthttp.RequestCtx, string, json.RawMessage) (map[string]interface{}, int)

func handleMCP(ctx *fasthttp.RequestCtx) {
	handleMCPWithExecutor(ctx, executeMCPTool)
}

func handleMCPWithExecutor(ctx *fasthttp.RequestCtx, execute mcpToolExecutor) {
	if !ctx.IsPost() {
		ctx.Response.Header.Set("Allow", http.MethodPost)
		jsonError(ctx, http.StatusMethodNotAllowed, "the MCP endpoint accepts POST requests")
		return
	}
	if len(ctx.PostBody()) > mcpMaxRequestBytes {
		writeMCPError(ctx, nil, -32600, "request exceeds the 1 MiB limit", http.StatusRequestEntityTooLarge)
		return
	}

	var request mcpRequest
	decoder := json.NewDecoder(bytes.NewReader(ctx.PostBody()))
	if err := decoder.Decode(&request); err != nil {
		writeMCPError(ctx, nil, -32700, "invalid JSON", http.StatusBadRequest)
		return
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		writeMCPError(ctx, nil, -32700, "request must contain exactly one JSON value", http.StatusBadRequest)
		return
	}
	if request.JSONRPC != "2.0" || request.Method == "" {
		writeMCPError(ctx, request.ID, -32600, "invalid JSON-RPC request", http.StatusBadRequest)
		return
	}

	// MCP notifications do not have an id and never receive a JSON-RPC body.
	if len(request.ID) == 0 {
		ctx.SetStatusCode(http.StatusAccepted)
		return
	}

	switch request.Method {
	case "initialize":
		writeMCPResult(ctx, request.ID, map[string]interface{}{
			"protocolVersion": mcpProtocolVersion,
			"capabilities": map[string]interface{}{
				"tools": map[string]bool{"listChanged": false},
			},
			"serverInfo": map[string]string{
				"name":    "manifoldgen",
				"title":   "ManifoldGen",
				"version": "1.0.0",
			},
			"instructions": "Search public ManifoldGen media without a key. Pricing, generation, and job tools use the current API; generation and private jobs require Authorization: Bearer with a ManifoldGen API key and may spend account credits.",
		})
	case "ping":
		writeMCPResult(ctx, request.ID, map[string]interface{}{})
	case "tools/list":
		writeMCPResult(ctx, request.ID, map[string]interface{}{"tools": manifoldMCPTools()})
	case "tools/call":
		var params mcpToolCallParams
		if err := json.Unmarshal(request.Params, &params); err != nil || strings.TrimSpace(params.Name) == "" {
			writeMCPError(ctx, request.ID, -32602, "tools/call requires a tool name and arguments", http.StatusOK)
			return
		}
		if len(params.Arguments) == 0 {
			params.Arguments = json.RawMessage(`{}`)
		}
		response, status := execute(ctx, params.Name, params.Arguments)
		text, _ := json.MarshalIndent(response, "", "  ")
		result := map[string]interface{}{
			"content": []map[string]string{{"type": "text", "text": string(text)}},
			"structuredContent": map[string]interface{}{
				"status":   status,
				"response": response,
			},
		}
		if status < 200 || status >= 300 {
			result["isError"] = true
		}
		writeMCPResult(ctx, request.ID, result)
	default:
		writeMCPError(ctx, request.ID, -32601, "method not found", http.StatusOK)
	}
}

func manifoldMCPTools() []map[string]interface{} {
	readOnly := map[string]bool{"readOnlyHint": true, "destructiveHint": false, "idempotentHint": true, "openWorldHint": true}
	writeTool := map[string]bool{"readOnlyHint": false, "destructiveHint": false, "idempotentHint": false, "openWorldHint": true}
	return []map[string]interface{}{
		{
			"name":        "get_pricing",
			"title":       "Get ManifoldGen pricing",
			"description": "Return the current public price and credit matrix before starting a generation.",
			"inputSchema": map[string]interface{}{"type": "object", "properties": map[string]interface{}{}, "additionalProperties": false},
			"annotations": readOnly,
		},
		{
			"name":        "search_media",
			"title":       "Search ManifoldGen media",
			"description": "Semantically search public images, videos, or audio. A bearer key also includes that account's private audio in audio searches.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]string{"type": "string", "description": "Natural-language search query."},
					"kind":  map[string]interface{}{"type": "string", "enum": []string{"images", "videos", "audio"}, "description": "Media catalog to search."},
					"limit": map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
					"audio_kind": map[string]interface{}{
						"type": "string", "enum": []string{"music", "sfx", "speech"}, "description": "Optional filter used only for audio searches.",
					},
				},
				"required":             []string{"query", "kind"},
				"additionalProperties": false,
			},
			"annotations": readOnly,
		},
		{
			"name":        "generate_media",
			"title":       "Generate ManifoldGen media",
			"description": "Generate an image, video, music track, sound effect, edit, or background-removed video. Requires a ManifoldGen bearer API key and spends credits. Call get_pricing first unless the user already approved the cost.",
			"inputSchema": manifoldGenerateSchema(),
			"annotations": writeTool,
		},
		{
			"name":        "get_job",
			"title":       "Get a ManifoldGen job",
			"description": "Return current status and output for an asynchronous video or audio job owned by the authenticated account.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"job_id": map[string]string{"type": "string", "description": "Job identifier returned by generate_media."},
				},
				"required":             []string{"job_id"},
				"additionalProperties": false,
			},
			"annotations": readOnly,
		},
		{
			"name":        "list_jobs",
			"title":       "List ManifoldGen jobs",
			"description": "List recent video or asynchronous audio jobs owned by the authenticated account.",
			"inputSchema": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"kind": map[string]interface{}{"type": "string", "enum": []string{"video", "audio"}, "default": "video"},
				},
				"additionalProperties": false,
			},
			"annotations": readOnly,
		},
	}
}

func manifoldGenerateSchema() map[string]interface{} {
	properties := map[string]interface{}{
		"service": map[string]interface{}{"type": "string", "enum": []string{"image", "video", "audio", "music", "sfx", "video_restyle", "video_background_removal"}},
		"prompt":  map[string]string{"type": "string"},
		"kind":    map[string]interface{}{"type": "string", "enum": []string{"music", "sfx"}},
		"lyrics": map[string]interface{}{
			"type": "string",
			"description": "Sung lyrics for music generation. Put [Verse], [Chorus], [Bridge] or [Outro] on their own line; " +
				"text sharing a line with a tag is dropped. Omit for an instrumental.",
		},
		"image_url":       map[string]string{"type": "string"},
		"video_url":       map[string]string{"type": "string"},
		"negative_prompt": map[string]string{"type": "string"},
		"width":           map[string]interface{}{"type": "integer", "minimum": 64},
		"height":          map[string]interface{}{"type": "integer", "minimum": 64},
		"num_steps":       map[string]interface{}{"type": "integer", "minimum": 1},
		"guidance":        map[string]string{"type": "number"},
		"seed":            map[string]string{"type": "integer"},
		"n":               map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 8},
		"image_backend":   map[string]interface{}{"type": "string", "enum": []string{"auto", "omniserve", "images3", "r1"}},
		"duration":        map[string]interface{}{"type": "integer", "minimum": 1, "maximum": 300},
		"aspect_ratio":    map[string]interface{}{"type": "string", "enum": []string{"16:9", "9:16", "1:1", "4:3", "3:4", "21:9"}},
		"size":            map[string]interface{}{"type": "string", "enum": []string{"preview", "balanced", "native", "audio"}},
		"resolution":      map[string]string{"type": "string"},
		"output_format":   map[string]string{"type": "string"},
		"include_audio":   map[string]string{"type": "boolean"},
		"loop":            map[string]string{"type": "boolean"},
		"strength":        map[string]interface{}{"type": "number", "minimum": 0, "maximum": 1},
		"background_color": map[string]string{
			"type": "string", "description": "Optional replacement color for video background removal.",
		},
		"preserve_audio":       map[string]string{"type": "boolean"},
		"max_quality":          map[string]interface{}{"type": "boolean", "description": "Skip the person-detector RVM path and matte with MatAnyone."},
		"mask_url":             map[string]interface{}{"type": "string", "description": "Optional first-frame mask or cutout still for MatAnyone."},
		"add_transparency":     map[string]interface{}{"type": "boolean", "description": "After video generation, also produce a transparent VP9 WebM via max_quality matting."},
		"reference_image_urls": map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}},
		"reference_video_urls": map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}},
		"reference_audio_urls": map[string]interface{}{"type": "array", "items": map[string]string{"type": "string"}},
	}
	return map[string]interface{}{
		"type":                 "object",
		"properties":           properties,
		"required":             []string{"service"},
		"additionalProperties": false,
	}
}

func executeMCPTool(parent *fasthttp.RequestCtx, name string, arguments json.RawMessage) (map[string]interface{}, int) {
	internal := newMCPInternalContext(parent)
	switch name {
	case "get_pricing":
		if err := requireEmptyMCPArguments(arguments); err != nil {
			return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest
		}
		handleGetPricing(internal)
	case "search_media":
		var args struct {
			Query     string `json:"query"`
			Kind      string `json:"kind"`
			Limit     int    `json:"limit"`
			AudioKind string `json:"audio_kind"`
		}
		if err := decodeMCPArguments(arguments, &args); err != nil {
			return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest
		}
		args.Query = strings.TrimSpace(args.Query)
		if args.Query == "" {
			return map[string]interface{}{"error": "query is required"}, http.StatusBadRequest
		}
		if args.Limit <= 0 || args.Limit > 100 {
			args.Limit = 20
		}
		query := url.Values{"q": {args.Query}, "top_k": {fmt.Sprint(args.Limit)}}
		switch args.Kind {
		case "images":
			internal.Request.SetRequestURI("/api/images/semantic?" + query.Encode())
			handleSemanticImageSearch(internal)
		case "videos":
			internal.Request.SetRequestURI("/api/search?" + query.Encode())
			handleSemanticSearch(internal)
		case "audio":
			if args.AudioKind != "" {
				query.Set("kind", args.AudioKind)
			}
			internal.Request.SetRequestURI("/api/audio/search?" + query.Encode())
			handleSemanticAudioSearch(internal)
		default:
			return map[string]interface{}{"error": "kind must be images, videos, or audio"}, http.StatusBadRequest
		}
	case "generate_media":
		var request ServiceUsageRequest
		if err := decodeMCPArguments(arguments, &request); err != nil {
			return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest
		}
		request.WalletAddress = ""
		body, err := json.Marshal(request)
		if err != nil {
			return map[string]interface{}{"error": "could not encode generation request"}, http.StatusInternalServerError
		}
		internal.Request.Header.SetMethod(http.MethodPost)
		internal.Request.SetRequestURI("/api/service")
		internal.Request.Header.SetContentType("application/json")
		internal.Request.SetBody(body)
		handleServiceRequest(internal)
	case "get_job":
		var args struct {
			JobID string `json:"job_id"`
		}
		if err := decodeMCPArguments(arguments, &args); err != nil {
			return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest
		}
		if strings.TrimSpace(args.JobID) == "" {
			return map[string]interface{}{"error": "job_id is required"}, http.StatusBadRequest
		}
		handleVideoJobStatus(internal, args.JobID)
	case "list_jobs":
		var args struct {
			Kind string `json:"kind"`
		}
		if err := decodeMCPArguments(arguments, &args); err != nil {
			return map[string]interface{}{"error": err.Error()}, http.StatusBadRequest
		}
		switch args.Kind {
		case "", "video":
			handleListVideoJobs(internal)
		case "audio":
			handleListAudioJobs(internal)
		default:
			return map[string]interface{}{"error": "kind must be video or audio"}, http.StatusBadRequest
		}
	default:
		return map[string]interface{}{"error": "unknown tool: " + name}, http.StatusNotFound
	}

	response := map[string]interface{}{}
	if err := json.Unmarshal(internal.Response.Body(), &response); err != nil {
		return map[string]interface{}{"error": "ManifoldGen returned an invalid JSON response"}, http.StatusInternalServerError
	}
	return response, internal.Response.StatusCode()
}

func newMCPInternalContext(parent *fasthttp.RequestCtx) *fasthttp.RequestCtx {
	internal := &fasthttp.RequestCtx{}
	internal.Request.Header.SetMethod(http.MethodGet)
	if authorization := parent.Request.Header.Peek("Authorization"); len(authorization) > 0 {
		internal.Request.Header.SetBytesV("Authorization", authorization)
	}
	return internal
}

func decodeMCPArguments(arguments json.RawMessage, target interface{}) error {
	decoder := json.NewDecoder(bytes.NewReader(arguments))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("invalid tool arguments: %w", err)
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return fmt.Errorf("invalid tool arguments: expected exactly one JSON value")
	}
	return nil
}

func requireEmptyMCPArguments(arguments json.RawMessage) error {
	var args map[string]interface{}
	if err := decodeMCPArguments(arguments, &args); err != nil {
		return err
	}
	if len(args) != 0 {
		return fmt.Errorf("this tool does not accept arguments")
	}
	return nil
}

func writeMCPResult(ctx *fasthttp.RequestCtx, id json.RawMessage, result interface{}) {
	writeMCPResponse(ctx, http.StatusOK, map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      json.RawMessage(id),
		"result":  result,
	})
}

func writeMCPError(ctx *fasthttp.RequestCtx, id json.RawMessage, code int, message string, status int) {
	var responseID interface{}
	if len(id) > 0 {
		responseID = json.RawMessage(id)
	}
	writeMCPResponse(ctx, status, map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      responseID,
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	})
}

func writeMCPResponse(ctx *fasthttp.RequestCtx, status int, response interface{}) {
	ctx.Response.Header.SetContentType("application/json")
	ctx.SetStatusCode(status)
	body, err := json.Marshal(response)
	if err != nil {
		ctx.SetStatusCode(http.StatusInternalServerError)
		ctx.SetBodyString(`{"jsonrpc":"2.0","id":null,"error":{"code":-32603,"message":"internal error"}}`)
		return
	}
	ctx.SetBody(body)
}
