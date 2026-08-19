package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func TestSubscriptionCreditGrant(t *testing.T) {
	tests := []struct {
		plan string
		want float64
	}{
		{plan: "monthly", want: 25},
		{plan: "creator_monthly", want: 25},
		{plan: "annual", want: 300},
		{plan: "creator_annual", want: 300},
		{plan: "pro_annual", want: 300},
		{plan: "creator-yearly", want: 300},
		{plan: "", want: 25},
	}
	for _, test := range tests {
		if got := subscriptionCreditGrantUSD(test.plan); got != test.want {
			t.Errorf("grant for %q = %v, want %v", test.plan, got, test.want)
		}
	}
}

func TestCreditPriceIsOneCent(t *testing.T) {
	os.Unsetenv("CREDIT_PRICE_USD")
	if got := getCUTEPriceUSD(); got != 0.01 {
		t.Fatalf("credit price = %v, want 0.01", got)
	}
	imgUSD := servicePricesUSD["zimage"]
	credits := imgUSD / getCUTEPriceUSD()
	if credits != 4 {
		t.Fatalf("image credits = %v, want 4", credits)
	}
}

func TestImageBatchScalesPrice(t *testing.T) {
	req := ServiceUsageRequest{Service: "zimage", N: 3}
	usd := getRequestServicePriceUSD(req)
	if usd != 0.12 {
		t.Fatalf("batch usd = %v, want 0.12", usd)
	}
	cute := getRequestServicePriceCUTE(req)
	if cute != 12 {
		t.Fatalf("batch credits = %v, want 12", cute)
	}
}

func TestGPTImageBatchIsAlwaysMeteredAtPaidRate(t *testing.T) {
	req := ServiceUsageRequest{Service: "gpt_image", N: 4}
	if usd := getRequestServicePriceUSD(req); usd != 0.96 {
		t.Fatalf("GPT Image 2 batch usd = %v, want 0.96", usd)
	}
	if credits := getRequestServicePriceCUTE(req); credits != 96 {
		t.Fatalf("GPT Image 2 batch credits = %v, want 96", credits)
	}
	if firstPartyServices[req.Service] {
		t.Fatal("GPT Image 2 must use current credit pricing, not first-party ATH pricing")
	}
}

func TestProxyOpenPathsGPTImageGenerationPinsModelAndBatch(t *testing.T) {
	var got map[string]interface{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/generations" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		if auth := r.Header.Get("Authorization"); auth != "Bearer test-openpaths-key" {
			t.Fatalf("authorization = %q", auth)
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": []map[string]string{{"b64_json": "aW1hZ2U="}},
		})
	}))
	defer srv.Close()

	oldClient, oldBaseURL, oldKey := backendClient, openPathsBaseURL, openPathsAPIKey
	backendClient, openPathsBaseURL, openPathsAPIKey = srv.Client(), srv.URL, "test-openpaths-key"
	defer func() { backendClient, openPathsBaseURL, openPathsAPIKey = oldClient, oldBaseURL, oldKey }()

	result, err := proxyOpenPathsImageGeneration(ServiceUsageRequest{
		Prompt: "  paid image  ", Width: 1536, Height: 1024, N: 4, Model: "some-other-model",
	})
	if err != nil {
		t.Fatalf("proxyOpenPathsImageGeneration: %v", err)
	}
	if got["model"] != "gpt-image-2" || got["size"] != "1536x1024" || got["n"] != float64(4) {
		t.Fatalf("OpenPaths request = %#v", got)
	}
	var normalized map[string]interface{}
	if err := json.Unmarshal(result, &normalized); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if normalized["engine"] != "gpt-image-2" {
		t.Fatalf("engine = %v", normalized["engine"])
	}
}

func TestGPTImagePublicAlias(t *testing.T) {
	if got := requestedServiceName("gpt-image-2"); got != "gpt_image" {
		t.Fatalf("requestedServiceName = %q, want gpt_image", got)
	}
}

func TestGeneratedImageSafetyStatus(t *testing.T) {
	for _, service := range []string{"gpt_image", "image_edit"} {
		status := generatedImageSafetyStatus(service)
		if status == nil || *status {
			t.Fatalf("generatedImageSafetyStatus(%q) = %v, want explicit false", service, status)
		}
	}
	if status := generatedImageSafetyStatus("zimage"); status != nil {
		t.Fatalf("generatedImageSafetyStatus(zimage) = %v, want nil for local moderation", *status)
	}
}

func TestZImageBackendOrderPrefersRequested(t *testing.T) {
	req := ServiceUsageRequest{Service: "zimage", ImageBackend: "images3"}
	order := zimageBackendOrder(req, "http://127.0.0.1:8100")
	if len(order) == 0 || order[0].name != "images3" {
		t.Fatalf("order[0]=%v, want images3 first", order)
	}
}

func TestProxyImages3ZImage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/create_and_upload_image" {
			t.Fatalf("path = %s", r.URL.Path)
		}
		_ = json.NewEncoder(w).Encode(map[string]string{
			"path": "https://cdn.example/img.webp",
		})
	}))
	defer srv.Close()

	old := backendClient
	backendClient = srv.Client()
	defer func() { backendClient = old }()

	body, err := proxyImages3ZImage(ServiceUsageRequest{Prompt: "teal", Width: 512, Height: 512, N: 1}, srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	if out["engine"] != "images3" {
		t.Fatalf("engine=%v", out["engine"])
	}
	if out["image_url"] != "https://cdn.example/img.webp" {
		t.Fatalf("image_url=%v", out["image_url"])
	}
}

func TestProxyOmniserveMultiImage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		_ = json.NewDecoder(r.Body).Decode(&req)
		if int(req["n"].(float64)) != 2 {
			t.Fatalf("n=%v want 2", req["n"])
		}
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"data": []map[string]string{
				{"b64_json": "aaa"},
				{"b64_json": "bbb"},
			},
			"model": "z-image",
		})
	}))
	defer srv.Close()

	old := backendClient
	backendClient = srv.Client()
	defer func() { backendClient = old }()

	body, err := proxyOmniserveZImage(ServiceUsageRequest{Prompt: "x", N: 2}, srv.URL)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatal(err)
	}
	imgs, _ := out["images"].([]interface{})
	if len(imgs) != 2 {
		t.Fatalf("images len=%d", len(imgs))
	}
}
