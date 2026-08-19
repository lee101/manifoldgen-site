package main

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/valyala/fasthttp"
)

func TestMCPInitialize(t *testing.T) {
	ctx := mcpTestContext(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}`)
	handleMCPWithExecutor(ctx, nil)

	if ctx.Response.StatusCode() != http.StatusOK {
		t.Fatalf("status = %d, body = %s", ctx.Response.StatusCode(), ctx.Response.Body())
	}
	var response struct {
		JSONRPC string `json:"jsonrpc"`
		Result  struct {
			ProtocolVersion string `json:"protocolVersion"`
			ServerInfo      struct {
				Name string `json:"name"`
			} `json:"serverInfo"`
		} `json:"result"`
	}
	if err := json.Unmarshal(ctx.Response.Body(), &response); err != nil {
		t.Fatal(err)
	}
	want := struct {
		JSONRPC string
		Version string
		Name    string
	}{"2.0", mcpProtocolVersion, "manifoldgen"}
	got := struct {
		JSONRPC string
		Version string
		Name    string
	}{response.JSONRPC, response.Result.ProtocolVersion, response.Result.ServerInfo.Name}
	if got != want {
		t.Fatalf("initialize = %#v, want %#v", got, want)
	}
}

func TestMCPToolsListIncludesGenerationAnnotations(t *testing.T) {
	ctx := mcpTestContext(`{"jsonrpc":"2.0","id":"tools","method":"tools/list"}`)
	handleMCPWithExecutor(ctx, nil)

	var response struct {
		Result struct {
			Tools []struct {
				Name        string          `json:"name"`
				Annotations map[string]bool `json:"annotations"`
			} `json:"tools"`
		} `json:"result"`
	}
	if err := json.Unmarshal(ctx.Response.Body(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Result.Tools) != 5 {
		t.Fatalf("tool count = %d, want 5", len(response.Result.Tools))
	}
	for _, tool := range response.Result.Tools {
		if tool.Name == "generate_media" {
			if tool.Annotations["readOnlyHint"] || tool.Annotations["idempotentHint"] {
				t.Fatalf("generation annotations = %#v", tool.Annotations)
			}
			return
		}
	}
	t.Fatal("generate_media tool not found")
}

func TestMCPToolCallPreservesRESTFailureAsToolError(t *testing.T) {
	ctx := mcpTestContext(`{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"generate_media","arguments":{"service":"image","prompt":"glass torus"}}}`)
	execute := func(_ *fasthttp.RequestCtx, name string, arguments json.RawMessage) (map[string]interface{}, int) {
		if name != "generate_media" {
			t.Fatalf("tool name = %q", name)
		}
		return map[string]interface{}{"error": "api key required"}, http.StatusUnauthorized
	}
	handleMCPWithExecutor(ctx, execute)

	var response struct {
		Result struct {
			IsError           bool `json:"isError"`
			StructuredContent struct {
				Status int `json:"status"`
			} `json:"structuredContent"`
		} `json:"result"`
	}
	if err := json.Unmarshal(ctx.Response.Body(), &response); err != nil {
		t.Fatal(err)
	}
	if !response.Result.IsError || response.Result.StructuredContent.Status != http.StatusUnauthorized {
		t.Fatalf("tool result = %#v", response.Result)
	}
}

func TestMCPNotificationReturnsAcceptedWithoutBody(t *testing.T) {
	ctx := mcpTestContext(`{"jsonrpc":"2.0","method":"notifications/initialized"}`)
	handleMCPWithExecutor(ctx, nil)

	if ctx.Response.StatusCode() != http.StatusAccepted || len(ctx.Response.Body()) != 0 {
		t.Fatalf("status = %d, body = %q", ctx.Response.StatusCode(), ctx.Response.Body())
	}
}

func TestMCPRejectsTrailingJSON(t *testing.T) {
	ctx := mcpTestContext(`{"jsonrpc":"2.0","id":1,"method":"ping"} {}`)
	handleMCPWithExecutor(ctx, nil)

	if ctx.Response.StatusCode() != http.StatusBadRequest {
		t.Fatalf("status = %d, body = %s", ctx.Response.StatusCode(), ctx.Response.Body())
	}
}

func TestExecuteMCPGenerateRequiresBearerWithoutCallingBackend(t *testing.T) {
	ctx := mcpTestContext(`{}`)
	response, status := executeMCPTool(ctx, "generate_media", json.RawMessage(`{"service":"image","prompt":"glass torus"}`))

	if status != http.StatusUnauthorized || response["error"] != "authorization required: use Authorization header with API key or wallet_address in body" {
		t.Fatalf("status = %d, response = %#v", status, response)
	}
}

func TestDecodeMCPArgumentsRejectsUnknownFields(t *testing.T) {
	var args struct {
		JobID string `json:"job_id"`
	}
	if err := decodeMCPArguments(json.RawMessage(`{"job_id":"one","wallet_address":"bypass"}`), &args); err == nil {
		t.Fatal("expected unknown argument to be rejected")
	}
}

func TestDecodeMCPArgumentsRejectsTrailingJSON(t *testing.T) {
	var args struct {
		JobID string `json:"job_id"`
	}
	if err := decodeMCPArguments(json.RawMessage(`{"job_id":"one"} {}`), &args); err == nil {
		t.Fatal("expected trailing JSON to be rejected")
	}
}

func mcpTestContext(body string) *fasthttp.RequestCtx {
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.Header.SetMethod(http.MethodPost)
	ctx.Request.SetRequestURI("/api/mcp")
	ctx.Request.Header.SetContentType("application/json")
	ctx.Request.SetBodyString(body)
	return ctx
}
