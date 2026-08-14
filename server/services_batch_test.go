package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
)

func TestProxyZImageBatchSerializesNativeRequests(t *testing.T) {
	var mu sync.Mutex
	var counts []int
	var seeds []int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/generations" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		var request struct {
			N    int `json:"n"`
			Seed int `json:"seed"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Fatal(err)
		}
		mu.Lock()
		counts = append(counts, request.N)
		seeds = append(seeds, request.Seed)
		index := len(counts)
		mu.Unlock()
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"model": "native-zimage",
			"data":  []map[string]string{{"b64_json": "image-" + string(rune('0'+index))}},
		})
	}))
	defer server.Close()

	t.Setenv("OMNISERVE_NATIVE_URL", server.URL)
	result, err := proxyZImageWithFallbacks(ServiceUsageRequest{
		Prompt: "four kittens",
		Width:  512,
		Height: 512,
		N:      4,
		Seed:   100,
	}, server.URL)
	if err != nil {
		t.Fatal(err)
	}
	if len(counts) != 4 {
		t.Fatalf("native gateway received %d requests, want 4", len(counts))
	}
	for i, count := range counts {
		if count != 1 {
			t.Fatalf("request %d had n=%d, want 1", i+1, count)
		}
		if seeds[i] != 100+i {
			t.Fatalf("request %d had seed=%d, want %d", i+1, seeds[i], 100+i)
		}
	}

	var payload struct {
		N      int                      `json:"n"`
		Images []map[string]interface{} `json:"images"`
	}
	if err := json.Unmarshal(result, &payload); err != nil {
		t.Fatal(err)
	}
	if payload.N != 4 || len(payload.Images) != 4 {
		t.Fatalf("batch response = n=%d, images=%d; want 4 images", payload.N, len(payload.Images))
	}
}
