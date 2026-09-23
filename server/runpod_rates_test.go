package main

import (
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRunpodGPUHourlyUSD(t *testing.T) {
	for gpu, want := range map[string]float64{
		"NVIDIA H200": 5.94, "NVIDIA H100 80GB HBM3": 4.80, "NVIDIA B200": 8.66,
		"NVIDIA L40S": 1.908, "NVIDIA L4": 0.75, "NVIDIA GeForce RTX 4090": 1.12,
		"NVIDIA RTX A4000": 0, "NVIDIA RTX 6000 Ada Generation": 1.908,
	} {
		if got := runpodGPUHourlyUSD(gpu); got != want {
			t.Fatalf("%s = %v, want %v", gpu, got, want)
		}
	}
	music3Pool := []string{"NVIDIA H200", "NVIDIA H100 PCIe", "NVIDIA RTX PRO 6000 Blackwell Server Edition", "NVIDIA A100 80GB PCIe"}
	if got := runpodWorstCaseHourlyUSD(music3Pool, 1); got != 5.94 {
		t.Fatalf("music3 pool = %v", got)
	}
	if got := runpodWorstCaseHourlyUSD([]string{"mystery"}, 3); got != 3 {
		t.Fatalf("fallback = %v", got)
	}
}

func TestRunpodBilledHourlyUSD(t *testing.T) {
	rows := []runpodBillingRow{{Amount: 173.42, TimeBilledMS: 29.2 * 3_600_000}, {Amount: 0.5, TimeBilledMS: 0.1 * 3_600_000}}
	if got := runpodBilledHourlyUSD(rows); math.Abs(got-5.9393) > 0.01 {
		t.Fatalf("billed rate = %v", got)
	}
	if got := runpodBilledHourlyUSD([]runpodBillingRow{{Amount: 1, TimeBilledMS: 1000}}); got != 0 {
		t.Fatalf("tiny sample should be ignored, got %v", got)
	}
}

func TestMusic3GPURateDefaultsAndObserved(t *testing.T) {
	t.Setenv("YUE_RUNPOD_ENDPOINT_ID", "")
	t.Setenv("MUSIC3_RUNPOD_GPU_USD_PER_HOUR", "")
	t.Setenv("MUSIC3_RUNPOD_ENDPOINT_ID", "m3")
	defer setRunpodObservedHourlyUSD("m3", 0)
	if got := music3GPUUSDPerHour(); got != 5.94 {
		t.Fatalf("music3 default = %v, want 5.94", got)
	}
	setRunpodObservedHourlyUSD("m3", 6.5)
	if got := music3GPUUSDPerHour(); got != 6.5 {
		t.Fatalf("observed higher rate should win, got %v", got)
	}
	setRunpodObservedHourlyUSD("m3", 3)
	if got := music3GPUUSDPerHour(); got != 5.94 {
		t.Fatalf("observed lower rate must not undercut, got %v", got)
	}
	t.Setenv("MUSIC3_RUNPOD_GPU_USD_PER_HOUR", "7.25")
	if got := music3GPUUSDPerHour(); got != 7.25 {
		t.Fatalf("env override = %v", got)
	}
	t.Setenv("MUSIC3_RUNPOD_GPU_USD_PER_HOUR", "")
	t.Setenv("YUE_RUNPOD_ENDPOINT_ID", "yue")
	if got := music3GPUUSDPerHour(); got != 1.12 {
		t.Fatalf("yue default = %v", got)
	}
}

func TestH3ControlGPUHourlyUSD(t *testing.T) {
	t.Setenv("H3_CONTROL_GPU_HOURLY_USD", "")
	t.Setenv("VIDEO_CONTROL_RUNPOD_ENDPOINT_ID", "ctl")
	if got := h3ControlGPUHourlyUSD(); got != 5.94 {
		t.Fatalf("control default = %v", got)
	}
	t.Setenv("H3_CONTROL_GPU_HOURLY_USD", "6.1")
	if got := h3ControlGPUHourlyUSD(); got != 6.1 {
		t.Fatalf("control override = %v", got)
	}
}

func TestRefreshRunpodBilledRates(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/billing/endpoints" || r.URL.Query().Get("endpointId") != "ep1" {
			http.Error(w, "bad", 400)
			return
		}
		_, _ = w.Write([]byte(`[{"amount":11.88,"timeBilledMs":7200000,"endpointId":"ep1"}]`))
	}))
	defer server.Close()
	for _, key := range []string{"YUE_RUNPOD_ENDPOINT_ID", "MUSIC3_RUNPOD_ENDPOINT_ID", "MUSIC3_FAST_RUNPOD_ENDPOINT_ID", "VIDEO_CONTROL_RUNPOD_ENDPOINT_ID"} {
		t.Setenv(key, "")
	}
	t.Setenv("MUSIC3_XFAST_RUNPOD_ENDPOINT_ID", "ep1")
	t.Setenv("H3_RUNPOD_CONTROL_URL", server.URL)
	t.Setenv("H3_RUNPOD_API_KEY", "test")
	defer setRunpodObservedHourlyUSD("ep1", 0)
	if err := refreshRunpodBilledRates(time.Now()); err != nil {
		t.Fatal(err)
	}
	if got := runpodObservedHourlyUSD("ep1"); math.Abs(got-5.94) > 0.001 {
		t.Fatalf("observed = %v", got)
	}
}
