package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestImageUtilityValidation(t *testing.T) {
	base := ServiceUsageRequest{Service: "smart_resize", ImageURL: "https://static.example/source.png", TargetSizes: []string{"1024x1024", "1080x1920"}}
	if err := validateImageUtility(base); err != nil {
		t.Fatal(err)
	}
	for _, sizes := range [][]string{nil, {"63x1024"}, {"4096x100"}, {"0100x100"}, {"100X100"}, {"100x100", "100x100"}, {"100x100", "100x100", "100x100", "100x100", "100x100", "100x100", "100x100"}} {
		req := base
		req.TargetSizes = sizes
		if validateImageUtility(req) == nil {
			t.Fatalf("accepted invalid sizes %v", sizes)
		}
	}
	base.NumImages = 2
	if validateImageUtility(base) == nil {
		t.Fatal("accepted extra variants at fixed per-size price")
	}
	base.NumImages = 1
	for _, imageURL := range []string{"http://example.com/source.png", "https://127.0.0.1/source.png", "https://169.254.169.254/source.png", "https://10.0.0.1/source.png", "https://localhost/source.png", "https://user:password@example.com/source.png"} {
		base.ImageURL = imageURL
		if validateImageUtility(base) == nil {
			t.Fatalf("accepted non-public URL %s", imageURL)
		}
	}
}

func TestProxyFalSmartResizeRejectsIncompleteBatch(t *testing.T) {
	withFalQueueStub(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"images":[{"url":"https://cdn.example/one.png"}]}`))
	})
	_, err := proxyFalImageUtility(ServiceUsageRequest{Service: "smart_resize", ImageURL: "https://static.example/source.png", TargetSizes: []string{"1024x1024", "1080x1920"}})
	if err == nil || !strings.Contains(err.Error(), "incomplete batch") {
		t.Fatalf("partial batch was not rejected: %v", err)
	}
}

func TestImageUtilityRegistrationAndPrice(t *testing.T) {
	for _, service := range []string{"smart_resize", "remove_background"} {
		if !imagePersistService(service) {
			t.Fatalf("%s is not persisted", service)
		}
	}
	if requestedServiceName("smart-resize") != "smart_resize" || requestedServiceName("remove-background") != "remove_background" {
		t.Fatal("missing public aliases")
	}
	for count, price := range map[int]float64{1: 0.24, 6: 1.14} {
		got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "smart_resize", TargetSizes: make([]string, count)})
		if got-price > 0.00001 || price-got > 0.00001 {
			t.Fatalf("%d outputs cost %v, want %v", count, got, price)
		}
	}
}

func TestProxyFalImageUtilities(t *testing.T) {
	for _, service := range []string{"smart_resize", "remove_background"} {
		t.Run(service, func(t *testing.T) {
			var input map[string]interface{}
			withFalQueueStub(t, func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.Method == http.MethodPost {
					_ = json.NewDecoder(r.Body).Decode(&input)
					model := "fal-ai/birefnet"
					if service == "smart_resize" {
						model = "fal-ai/smart-resize"
					}
					if !strings.HasSuffix(r.URL.Path, model) {
						t.Errorf("model URL = %s", r.URL.Path)
					}
					w.Write([]byte(`{"status_url":"http://` + r.Host + `/status?logs=0","response_url":"http://` + r.Host + `/response"}`))
				} else if strings.Contains(r.URL.RawQuery, "logs=0") {
					w.Write([]byte(`{"status":"COMPLETED"}`))
				} else {
					w.Write([]byte(`{"image":{"url":"https://cdn.example/one.png"}}`))
				}
			})
			result, err := proxyFalImageUtility(ServiceUsageRequest{Service: service, ImageURL: "https://static.example/source.png", TargetSizes: []string{"1080x1920"}})
			if err != nil {
				t.Fatal(err)
			}
			if input["output_format"] != "png" || len(extractPayloadImageURLs(result)) != 1 {
				t.Fatalf("invalid PNG response: %s input=%v", result, input)
			}
			if service == "smart_resize" && (input["num_images_per_size"] != float64(1) || input["resolution"] != "2K") {
				t.Fatalf("wrong resize billing profile: %v", input)
			}
		})
	}
}
