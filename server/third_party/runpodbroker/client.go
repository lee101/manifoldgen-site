// Package runpodbroker is the shared way our products buy Runpod compute.
//
// Order of preference for one job:
//  1. Batch (up to 30% off, 20% off on H100/H200/B200/B300), only for work that
//     can wait. Start times are not guaranteed, so a batch that has not started
//     within its patience window is cancelled (queued requests are not billed)
//     and the job moves to tier 2.
//  2. Serverless /run (spiky, scale-to-zero).
//  3. Sustained load is advised onto pods or owned GPUs by Advisor.
//
// Every job carries the revenue it is expected to earn; Guard refuses spend
// that is not tied to money from a customer.
package runpodbroker

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const DefaultBaseURL = "https://api.runpod.ai/v2"

// Runpod's edge blocks the default Go/Python user agents with 403 error 1010.
const userAgent = "runpodbroker/1.0 (+ops)"

type Client struct {
	APIKey  string
	BaseURL string
	HTTP    *http.Client
}

func NewClient(apiKey string) *Client {
	return &Client{APIKey: apiKey, BaseURL: DefaultBaseURL, HTTP: &http.Client{Timeout: 60 * time.Second}}
}

// HTTPError carries the upstream status so callers can map 402/429/5xx.
type HTTPError struct {
	Status int
	Body   string
}

func (e *HTTPError) Error() string { return fmt.Sprintf("runpod returned %d: %s", e.Status, e.Body) }

func (c *Client) do(ctx context.Context, method, path string, in, out interface{}) error {
	var body io.Reader
	if in != nil {
		raw, err := json.Marshal(in)
		if err != nil {
			return err
		}
		body = bytes.NewReader(raw)
	}
	base := strings.TrimRight(c.BaseURL, "/")
	req, err := http.NewRequestWithContext(ctx, method, base+path, body)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)
	httpc := c.HTTP
	if httpc == nil {
		httpc = http.DefaultClient
	}
	resp, err := httpc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 64<<20))
	if err != nil {
		return err
	}
	if resp.StatusCode >= 300 {
		tail := string(data)
		if len(tail) > 400 {
			tail = tail[:400]
		}
		return &HTTPError{Status: resp.StatusCode, Body: tail}
	}
	if out != nil && len(data) > 0 {
		if err := json.Unmarshal(data, out); err != nil {
			return fmt.Errorf("runpod returned invalid JSON: %w", err)
		}
	}
	return nil
}

func ep(id string) string { return "/" + url.PathEscape(id) }

// Request is one element of a batch, same shape as a /run body.
type Request struct {
	Input  interface{}            `json:"input"`
	Policy map[string]interface{} `json:"policy,omitempty"`
}

type Batch struct {
	ID                string `json:"id"`
	EndpointID        string `json:"endpointId"`
	Status            string `json:"status"`
	RequestTotal      int    `json:"requestTotal"`
	RequestInProgress int    `json:"requestInProgress"`
	RequestCompleted  int    `json:"requestCompleted"`
	RequestFailed     int    `json:"requestFailed"`
	FailureCode       string `json:"failureCode"`
	CreatedAt         int64  `json:"createdAt"`
}

// Started reports whether any batch worker has picked work up.
func (b Batch) Started() bool {
	return b.RequestInProgress > 0 || b.RequestCompleted > 0 || b.RequestFailed > 0
}

func (b Batch) Terminal() bool {
	return b.Status == "COMPLETED" || b.Status == "FAILED" || b.Status == "CANCELLED"
}

type BatchRequest struct {
	ID            string          `json:"id"`
	Status        string          `json:"status"`
	Input         json.RawMessage `json:"input"`
	Output        json.RawMessage `json:"output"`
	Error         string          `json:"error"`
	DelayTime     int64           `json:"delayTime"`
	ExecutionTime int64           `json:"executionTime"`
}

// CreateBatch makes a DRAFT batch. Finalize it to make it run.
func (c *Client) CreateBatch(ctx context.Context, endpointID string, reqs []Request) (string, error) {
	if reqs == nil {
		reqs = []Request{}
	}
	var out struct {
		ID string `json:"id"`
	}
	if err := c.do(ctx, http.MethodPost, ep(endpointID)+"/batch", reqs, &out); err != nil {
		return "", err
	}
	if out.ID == "" {
		return "", fmt.Errorf("runpod batch create returned no id")
	}
	return out.ID, nil
}

func (c *Client) FinalizeBatch(ctx context.Context, endpointID, batchID string) error {
	return c.do(ctx, http.MethodPost, ep(endpointID)+"/batch/"+url.PathEscape(batchID)+"/finalize", nil, nil)
}

func (c *Client) GetBatch(ctx context.Context, endpointID, batchID string) (Batch, error) {
	var b Batch
	err := c.do(ctx, http.MethodGet, ep(endpointID)+"/batch/"+url.PathEscape(batchID), nil, &b)
	return b, err
}

func (c *Client) CancelBatch(ctx context.Context, endpointID, batchID string) (Batch, error) {
	var b Batch
	err := c.do(ctx, http.MethodPost, ep(endpointID)+"/batch/"+url.PathEscape(batchID)+"/cancel", nil, &b)
	return b, err
}

// BatchRequests pages through a batch's requests (limit up to 100).
func (c *Client) BatchRequests(ctx context.Context, endpointID, batchID string, offset, limit int) ([]BatchRequest, bool, error) {
	var out struct {
		Requests []BatchRequest `json:"requests"`
		HasMore  bool           `json:"hasMore"`
	}
	path := fmt.Sprintf("%s/batch/%s/requests?offset=%d&limit=%d", ep(endpointID), url.PathEscape(batchID), offset, limit)
	err := c.do(ctx, http.MethodGet, path, nil, &out)
	return out.Requests, out.HasMore, err
}

// RunResult is the /run and /status shape. Batch request IDs work with Status.
type RunResult struct {
	ID            string          `json:"id"`
	Status        string          `json:"status"`
	Output        json.RawMessage `json:"output"`
	Error         string          `json:"error"`
	DelayTime     int64           `json:"delayTime"`
	ExecutionTime int64           `json:"executionTime"`
}

func (r RunResult) Terminal() bool {
	switch r.Status {
	case "COMPLETED", "FAILED", "CANCELLED", "TIMED_OUT":
		return true
	}
	return false
}

func (c *Client) Run(ctx context.Context, endpointID string, input interface{}, policy map[string]interface{}) (RunResult, error) {
	body := map[string]interface{}{"input": input}
	if len(policy) > 0 {
		body["policy"] = policy
	}
	var r RunResult
	err := c.do(ctx, http.MethodPost, ep(endpointID)+"/run", body, &r)
	return r, err
}

func (c *Client) Status(ctx context.Context, endpointID, requestID string) (RunResult, error) {
	var r RunResult
	err := c.do(ctx, http.MethodGet, ep(endpointID)+"/status/"+url.PathEscape(requestID), nil, &r)
	return r, err
}

func (c *Client) Cancel(ctx context.Context, endpointID, requestID string) error {
	return c.do(ctx, http.MethodPost, ep(endpointID)+"/cancel/"+url.PathEscape(requestID), nil, nil)
}
