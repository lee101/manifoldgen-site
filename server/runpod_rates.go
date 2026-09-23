package main

import (
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// RunPod serverless Flex rates as actually billed (amount / timeBilledMs from
// the billing API), not the list price: H200 lanes bill $5.94/h and H100 lanes
// $4.80/h, both above the published per-second rate.
var runpodGPUHourlyUSDTable = []struct {
	match string
	usd   float64
}{
	{"B200", 8.66},
	{"H200", 5.94},
	{"H100", 4.80},
	{"RTX PRO 6000", 4.00},
	{"A100", 2.74},
	{"RTX 6000 Ada", 1.908},
	{"L40", 1.908},
	{"NVIDIA A40", 1.25},
	{"RTX A6000", 1.25},
	{"4090", 1.12},
	{"3090", 0.75},
	{"RTX A5000", 0.75},
	{"L4", 0.75},
}

func runpodGPUHourlyUSD(gpuType string) float64 {
	for _, row := range runpodGPUHourlyUSDTable {
		if strings.Contains(gpuType, row.match) {
			return row.usd
		}
	}
	return 0
}

// A mixed-pool endpoint can place on any listed GPU, so price the ceiling.
func runpodWorstCaseHourlyUSD(gpuTypes []string, fallback float64) float64 {
	worst := 0.0
	for _, gpuType := range gpuTypes {
		if rate := runpodGPUHourlyUSD(gpuType); rate > worst {
			worst = rate
		}
	}
	if worst == 0 {
		return fallback
	}
	return worst
}

type runpodBillingRow struct {
	Amount       float64 `json:"amount"`
	TimeBilledMS float64 `json:"timeBilledMs"`
	EndpointID   string  `json:"endpointId"`
}

const runpodBilledRateMinHours = 0.1

func runpodBilledHourlyUSD(rows []runpodBillingRow) float64 {
	amount, billedMS := 0.0, 0.0
	for _, row := range rows {
		amount += row.Amount
		billedMS += row.TimeBilledMS
	}
	if billedMS < runpodBilledRateMinHours*3_600_000 || amount <= 0 {
		return 0
	}
	return amount / (billedMS / 3_600_000)
}

var runpodBilledRates = struct {
	sync.RWMutex
	byEndpoint map[string]float64
}{byEndpoint: map[string]float64{}}

func runpodObservedHourlyUSD(endpointID string) float64 {
	runpodBilledRates.RLock()
	defer runpodBilledRates.RUnlock()
	return runpodBilledRates.byEndpoint[endpointID]
}

func setRunpodObservedHourlyUSD(endpointID string, rate float64) {
	runpodBilledRates.Lock()
	defer runpodBilledRates.Unlock()
	if rate > 0 {
		runpodBilledRates.byEndpoint[endpointID] = rate
	} else {
		delete(runpodBilledRates.byEndpoint, endpointID)
	}
}

// Never price below either the table ceiling or what RunPod actually billed.
func runpodEffectiveHourlyUSD(endpointID string, tableRate float64) float64 {
	if observed := runpodObservedHourlyUSD(endpointID); observed > tableRate {
		return observed
	}
	return tableRate
}

func runpodPricedEndpointIDs() []string {
	seen := map[string]bool{}
	var ids []string
	for _, key := range []string{"YUE_RUNPOD_ENDPOINT_ID", "MUSIC3_RUNPOD_ENDPOINT_ID", "MUSIC3_FAST_RUNPOD_ENDPOINT_ID", "MUSIC3_XFAST_RUNPOD_ENDPOINT_ID", "VIDEO_CONTROL_RUNPOD_ENDPOINT_ID"} {
		if id := strings.TrimSpace(os.Getenv(key)); id != "" && !seen[id] {
			seen[id] = true
			ids = append(ids, id)
		}
	}
	return ids
}

func refreshRunpodBilledRates(now time.Time) error {
	start := now.Add(-30 * 24 * time.Hour).UTC().Format(time.RFC3339)
	for _, id := range runpodPricedEndpointIDs() {
		var rows []runpodBillingRow
		query := url.Values{"bucketSize": {"month"}, "endpointId": {id}, "startTime": {start}}
		if err := h3ControlRequest(http.MethodGet, h3ControlBase()+"/billing/endpoints?"+query.Encode(), nil, &rows); err != nil {
			return err
		}
		setRunpodObservedHourlyUSD(id, runpodBilledHourlyUSD(rows))
	}
	return nil
}

func startRunpodBilledRateRefresher() {
	if h3RunpodAPIKey() == "" || strings.EqualFold(os.Getenv("RUNPOD_BILLED_RATE_REFRESH"), "false") {
		return
	}
	go func() {
		for {
			if err := refreshRunpodBilledRates(time.Now()); err != nil {
				log.Printf("[runpod-rates] billing refresh failed: %v", err)
			}
			time.Sleep(6 * time.Hour)
		}
	}()
}
