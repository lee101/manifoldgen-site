package runpodbroker

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type fake struct {
	mu           sync.Mutex
	calls        []string
	reqStatus    string
	batchStarted bool
	failBatch    bool
}

func (f *fake) handler(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, r.Method+" "+r.URL.Path)
	if r.Header.Get("User-Agent") == "" || strings.HasPrefix(r.Header.Get("User-Agent"), "Go-http") {
		w.WriteHeader(403)
		return
	}
	p := r.URL.Path
	switch {
	case p == "/ep1/batch" && r.Method == "POST":
		if f.failBatch {
			w.WriteHeader(429)
			return
		}
		json.NewEncoder(w).Encode(map[string]string{"id": "b1", "status": "DRAFT"})
	case strings.HasSuffix(p, "/finalize"):
		json.NewEncoder(w).Encode(Batch{ID: "b1", Status: "FINALIZED"})
	case strings.HasSuffix(p, "/cancel") && strings.Contains(p, "/batch/"):
		json.NewEncoder(w).Encode(Batch{ID: "b1", Status: "CANCELLED", RequestInProgress: map[bool]int{true: 1}[f.batchStarted]})
	case strings.HasSuffix(p, "/requests"):
		json.NewEncoder(w).Encode(map[string]interface{}{"requests": []BatchRequest{{ID: "r1", Status: "IN_QUEUE"}}})
	case p == "/ep1/batch/b1":
		json.NewEncoder(w).Encode(Batch{ID: "b1", Status: "FINALIZED", RequestInProgress: map[bool]int{true: 1}[f.batchStarted]})
	case p == "/ep1/run":
		json.NewEncoder(w).Encode(RunResult{ID: "run1", Status: "IN_QUEUE"})
	case strings.Contains(p, "/status/"):
		json.NewEncoder(w).Encode(RunResult{ID: p[strings.LastIndex(p, "/")+1:], Status: f.reqStatus})
	default:
		w.WriteHeader(404)
	}
}

func setup(t *testing.T) (*Broker, *fake, *time.Time) {
	f := &fake{reqStatus: "IN_QUEUE"}
	srv := httptest.NewServer(http.HandlerFunc(f.handler))
	t.Cleanup(srv.Close)
	c := NewClient("k")
	c.BaseURL = srv.URL
	b := New(c)
	b.BatchEnabled = true
	clock := time.Unix(1_800_000_000, 0)
	b.now = func() time.Time { return clock }
	b.Guard.now = b.now
	return b, f, &clock
}

func job() Job {
	return Job{Endpoint: "ep1", Input: map[string]string{"a": "b"}, Patience: time.Minute, RevenueUSD: 1, EstCostUSD: 0.4, GPU: "NVIDIA H100 PCIe"}
}

func TestBatchThenFallbackAfterPatience(t *testing.T) {
	b, f, clock := setup(t)
	h, err := b.Submit(context.Background(), job())
	if err != nil || h.Tier != TierBatch || h.RequestID != "r1" {
		t.Fatalf("submit: %+v %v", h, err)
	}
	*clock = clock.Add(30 * time.Second)
	if _, nh, _ := b.Poll(context.Background(), h); nh.Tier != TierBatch {
		t.Fatal("moved before patience expired")
	}
	*clock = clock.Add(31 * time.Second)
	_, nh, err := b.Poll(context.Background(), h)
	if err != nil || nh.Tier != TierServerless || nh.RequestID != "run1" {
		t.Fatalf("expected serverless fallback, got %+v %v", nh, err)
	}
	if !strings.Contains(strings.Join(f.calls, ","), "POST /ep1/batch/b1/cancel") {
		t.Fatalf("batch was not cancelled: %v", f.calls)
	}
	if s := b.Guard.Stats(); s.SpentUSD[TierBatch] > 0.0001 {
		t.Fatalf("batch booking not refunded: %+v", s)
	}
}

func TestStartedBatchIsNotRerouted(t *testing.T) {
	b, f, clock := setup(t)
	h, _ := b.Submit(context.Background(), job())
	f.batchStarted = true
	f.reqStatus = "IN_PROGRESS"
	*clock = clock.Add(time.Hour)
	_, nh, _ := b.Poll(context.Background(), h)
	if nh.Tier != TierBatch {
		t.Fatalf("running job was moved: %+v", nh)
	}
}

func TestRaceStartedDuringCancelKeepsBatch(t *testing.T) {
	b, f, clock := setup(t)
	h, _ := b.Submit(context.Background(), job())
	*clock = clock.Add(time.Hour)
	f.batchStarted = true // status still IN_QUEUE but batch reports progress
	_, nh, _ := b.Poll(context.Background(), h)
	if nh.Tier != TierBatch {
		t.Fatal("must not double-run a job a batch worker already took")
	}
}

func TestBatchRejectedFallsBackToRun(t *testing.T) {
	b, f, _ := setup(t)
	f.failBatch = true
	var kinds []string
	b.OnEvent = func(e Event) { kinds = append(kinds, e.Kind) }
	h, err := b.Submit(context.Background(), job())
	if err != nil || h.Tier != TierServerless {
		t.Fatalf("%+v %v", h, err)
	}
	if strings.Join(kinds, ",") != "fallback,submit" {
		t.Fatalf("events %v", kinds)
	}
}

func TestInteractiveSkipsBatch(t *testing.T) {
	b, _, _ := setup(t)
	j := job()
	j.Patience = 0
	if h, _ := b.Submit(context.Background(), j); h.Tier != TierServerless {
		t.Fatal("interactive job used batch")
	}
}

func TestGuard(t *testing.T) {
	b, _, _ := setup(t)
	j := job()
	j.EstCostUSD = 0.9
	if _, err := b.Submit(context.Background(), j); err != ErrUnprofitable {
		t.Fatalf("want ErrUnprofitable, got %v", err)
	}
	j = Job{Endpoint: "ep1", Input: 1}
	if _, err := b.Submit(context.Background(), j); err != ErrNoRevenue {
		t.Fatalf("want ErrNoRevenue, got %v", err)
	}
	j = Job{Endpoint: "ep1", Input: 1, Internal: true, EstCostUSD: 4}
	if _, err := b.Submit(context.Background(), j); err != nil {
		t.Fatal(err)
	}
	if _, err := b.Submit(context.Background(), j); err != ErrInternalCap {
		t.Fatalf("want ErrInternalCap, got %v", err)
	}
}

func TestHandleRoundTripAndDiscount(t *testing.T) {
	h := Handle{Tier: TierBatch, Endpoint: "ep1", RequestID: "r-u2", BatchID: "b", SubmittedAt: time.Unix(5, 0), Patience: 90 * time.Second}
	g, err := DecodeHandle(h.Encode())
	if err != nil || g.RequestID != "r-u2" || g.Patience != 90*time.Second || g.BatchID != "b" {
		t.Fatalf("%+v %v", g, err)
	}
	if BatchDiscount("NVIDIA H200") != 0.2 || BatchDiscount("NVIDIA GeForce RTX 4090") != 0.3 {
		t.Fatal("discount tiers")
	}
	if Recommend(PlaceServerless, 0.5, 2.69, 4.80) != PlaceServerless || Recommend(PlaceServerless, 0.7, 2.69, 4.80) != PlacePod {
		t.Fatal("promote threshold")
	}
	if Recommend(PlacePod, 0.3, 2.69, 4.80) != PlaceServerless || Recommend(PlacePod, 0.5, 2.69, 4.80) != PlacePod {
		t.Fatal("demote hysteresis")
	}
}
