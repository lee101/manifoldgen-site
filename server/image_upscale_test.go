package main

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestImageUpscalePrice(t *testing.T) {
	cases := []struct {
		scale int
		model string
		want  float64
	}{{2, "", 0.02}, {0, "general", 0.02}, {4, "", 0.03}, {4, "anime", 0.03}, {4, "creative", 0.15}, {2, "creative-upscaler", 0.15}}
	for _, c := range cases {
		if got := imageUpscalePriceUSD(c.scale, c.model); got != c.want {
			t.Errorf("price(%d,%q)=%v want %v", c.scale, c.model, got, c.want)
		}
		if got := getRequestServicePriceUSD(ServiceUsageRequest{Service: "upscale_image", Scale: c.scale, Model: c.model}); got != c.want {
			t.Errorf("service price(%d,%q)=%v want %v", c.scale, c.model, got, c.want)
		}
	}
}

func TestNativeUpscaleImageContract(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/images/upscales" || r.Header.Get("Authorization") != "Bearer s3" {
			http.Error(w, `{"error":"bad"}`, 401)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("X-Upscale-Width", "2048")
		w.Header().Set("X-Upscale-Height", "1024")
		w.Write([]byte("png"))
	}))
	defer srv.Close()
	t.Setenv("OMNISERVE_NATIVE_URL", srv.URL)
	t.Setenv("OMNISERVE_NATIVE_SECRET", "s3")
	body, ct, w, h, err := nativeUpscaleImage(context.Background(), "https://x.example/a.png", 2, "general")
	if err != nil || string(body) != "png" || ct != "image/png" || w != 2048 || h != 1024 {
		t.Fatalf("got %q %q %d %d %v", body, ct, w, h, err)
	}
}

func stubUpscalers(t *testing.T, nativeErr error) *[]string {
	calls := []string{}
	n, f, c, u := nativeUpscaleImageFunc, falESRGANUpscaleFunc, falCreativeUpscaleFunc, uploadUpscaledImageFunc
	t.Cleanup(func() {
		nativeUpscaleImageFunc, falESRGANUpscaleFunc, falCreativeUpscaleFunc, uploadUpscaledImageFunc = n, f, c, u
	})
	nativeUpscaleImageFunc = func(_ context.Context, _ string, scale int, model string) ([]byte, string, int, int, error) {
		calls = append(calls, "native:"+model)
		if nativeErr != nil {
			return nil, "", 0, 0, nativeErr
		}
		return []byte("img"), "image/png", 100 * scale, 50 * scale, nil
	}
	falESRGANUpscaleFunc = func(_ string, scale int, model string) (string, error) {
		calls = append(calls, "esrgan:"+model)
		return "https://fal.example/esrgan.png", nil
	}
	falCreativeUpscaleFunc = func(string) (string, error) {
		calls = append(calls, "creative")
		return "https://fal.example/creative.png", nil
	}
	uploadUpscaledImageFunc = func(context.Context, []byte, string, string) (string, error) {
		calls = append(calls, "upload")
		return "https://r2.example/up.png", nil
	}
	return &calls
}

func TestUpscaleImageRouting(t *testing.T) {
	calls := stubUpscalers(t, nil)
	r, err := upscaleImage(context.Background(), "u", "https://x/a.png", 4, "anime")
	if err != nil || r.Backend != "native" || r.URL != "https://r2.example/up.png" || r.Width != 400 || r.Scale != 4 {
		t.Fatalf("native: %+v %v", r, err)
	}
	if strings.Join(*calls, ",") != "native:anime,upload" {
		t.Fatalf("calls %v", *calls)
	}

	calls = stubUpscalers(t, errors.New("503"))
	r, err = upscaleImage(context.Background(), "u", "https://x/a.png", 3, "")
	if err != nil || r.Backend != "fallback" || r.Scale != 2 || strings.Join(*calls, ",") != "native:general,esrgan:general" {
		t.Fatalf("fallback: %+v %v %v", r, err, *calls)
	}

	calls = stubUpscalers(t, nil)
	r, err = upscaleImage(context.Background(), "u", "https://x/a.png", 4, "creative")
	if err != nil || r.Engine != "creative-upscaler" || strings.Join(*calls, ",") != "creative" {
		t.Fatalf("creative: %+v %v %v", r, err, *calls)
	}
}
