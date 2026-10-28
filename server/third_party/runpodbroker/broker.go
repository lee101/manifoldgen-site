package runpodbroker

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

type Tier string

const (
	TierBatch      Tier = "batch"
	TierServerless Tier = "serverless"
)

// Job is one unit of Runpod work and the money it is expected to earn.
type Job struct {
	Endpoint string
	Input    interface{}
	Policy   map[string]interface{}

	// Patience is how long the job may wait for a batch worker before it moves
	// to serverless. Zero means the job is interactive and skips batch.
	Patience time.Duration

	// RevenueUSD is what the customer pays for this job (quoted price).
	// EstCostUSD is our on-demand serverless cost estimate.
	RevenueUSD float64
	EstCostUSD float64
	// Internal marks R&D or ops work with no customer. It draws on the
	// daily internal budget instead of being tied to revenue.
	Internal bool
	// GPU is the endpoint's primary GPU type id, used for the batch discount.
	GPU string
}

// Handle identifies a submitted job. Persist Encode() next to the job row.
type Handle struct {
	Tier        Tier
	Endpoint    string
	RequestID   string
	BatchID     string
	SubmittedAt time.Time
	Patience    time.Duration
	Job         *Job `json:"-"` // only set in memory by Submit; fallback needs it
}

func (h Handle) Encode() string {
	return strings.Join([]string{"rp1", string(h.Tier), h.Endpoint, h.RequestID, h.BatchID,
		strconv.FormatInt(h.SubmittedAt.Unix(), 10), strconv.FormatInt(int64(h.Patience/time.Second), 10)}, ":")
}

func DecodeHandle(s string) (Handle, error) {
	p := strings.Split(s, ":")
	if len(p) != 7 || p[0] != "rp1" {
		return Handle{}, fmt.Errorf("not a broker handle")
	}
	at, _ := strconv.ParseInt(p[5], 10, 64)
	pat, _ := strconv.ParseInt(p[6], 10, 64)
	return Handle{Tier: Tier(p[1]), Endpoint: p[2], RequestID: p[3], BatchID: p[4],
		SubmittedAt: time.Unix(at, 0), Patience: time.Duration(pat) * time.Second}, nil
}

var (
	ErrUnprofitable = errors.New("runpodbroker: estimated compute cost exceeds the allowed share of revenue")
	ErrNoRevenue    = errors.New("runpodbroker: job has no revenue and is not marked internal")
	ErrInternalCap  = errors.New("runpodbroker: daily internal compute budget is spent")
)

// Guard ties spend to customer money.
type Guard struct {
	MaxCostRatio   float64 // max EstCost/Revenue, default 0.7
	InternalDayUSD float64 // daily budget for Internal jobs, default 5

	mu       sync.Mutex
	day      string
	internal float64
	spent    map[Tier]float64
	revenue  float64
	now      func() time.Time
}

func NewGuard() *Guard {
	return &Guard{MaxCostRatio: 0.7, InternalDayUSD: 5, spent: map[Tier]float64{}, now: time.Now}
}

func (g *Guard) rollLocked() {
	d := g.now().UTC().Format("2006-01-02")
	if d != g.day {
		g.day, g.internal, g.revenue, g.spent = d, 0, 0, map[Tier]float64{}
	}
}

// Admit checks a job and, when allowed, books its estimated cost.
func (g *Guard) Admit(j Job, tier Tier) error {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.rollLocked()
	cost := j.EstCostUSD
	if tier == TierBatch {
		cost *= 1 - BatchDiscount(j.GPU)
	}
	switch {
	case j.RevenueUSD > 0:
		if cost > 0 && cost > j.RevenueUSD*g.MaxCostRatio {
			return ErrUnprofitable
		}
		g.revenue += j.RevenueUSD
	case j.Internal:
		if g.internal+cost > g.InternalDayUSD {
			return ErrInternalCap
		}
		g.internal += cost
	default:
		return ErrNoRevenue
	}
	g.spent[tier] += cost
	return nil
}

// Refund undoes Admit when a submission fails before reaching Runpod.
func (g *Guard) Refund(j Job, tier Tier) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.rollLocked()
	cost := j.EstCostUSD
	if tier == TierBatch {
		cost *= 1 - BatchDiscount(j.GPU)
	}
	g.spent[tier] -= cost
	if j.RevenueUSD > 0 {
		g.revenue -= j.RevenueUSD
	} else if j.Internal {
		g.internal -= cost
	}
}

type Stats struct {
	Day         string
	RevenueUSD  float64
	SpentUSD    map[Tier]float64
	InternalUSD float64
}

func (g *Guard) Stats() Stats {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.rollLocked()
	s := Stats{Day: g.day, RevenueUSD: g.revenue, InternalUSD: g.internal, SpentUSD: map[Tier]float64{}}
	for k, v := range g.spent {
		s.SpentUSD[k] = v
	}
	return s
}

// BatchDiscount is the published batch saving: 20% on H100, H200, B200 and
// B300, up to 30% on everything else.
func BatchDiscount(gpu string) float64 {
	g := strings.ToUpper(gpu)
	for _, k := range []string{"H100", "H200", "B200", "B300"} {
		if strings.Contains(g, k) {
			return 0.20
		}
	}
	return 0.30
}

// Event is reported to the host's ledger so every spend can be reconciled
// against revenue.
type Event struct {
	Kind     string // "submit", "fallback", "refused"
	Tier     Tier
	Endpoint string
	Job      Job
	Err      error
}

type Broker struct {
	Client *Client
	Guard  *Guard
	// BatchEnabled turns the batch tier on. When false everything is /run.
	BatchEnabled bool
	OnEvent      func(Event)
	now          func() time.Time
}

func New(c *Client) *Broker {
	return &Broker{Client: c, Guard: NewGuard(), now: time.Now}
}

func (b *Broker) emit(e Event) {
	if b.OnEvent != nil {
		b.OnEvent(e)
	}
}

func (b *Broker) clock() time.Time {
	if b.now != nil {
		return b.now()
	}
	return time.Now()
}

// Submit sends the job down the cheapest tier that fits its patience.
func (b *Broker) Submit(ctx context.Context, j Job) (Handle, error) {
	tier := TierServerless
	if b.BatchEnabled && j.Patience > 0 {
		tier = TierBatch
	}
	if err := b.Guard.Admit(j, tier); err != nil {
		b.emit(Event{Kind: "refused", Tier: tier, Endpoint: j.Endpoint, Job: j, Err: err})
		return Handle{}, err
	}
	if tier == TierBatch {
		h, err := b.submitBatch(ctx, j)
		if err == nil {
			b.emit(Event{Kind: "submit", Tier: TierBatch, Endpoint: j.Endpoint, Job: j})
			return h, nil
		}
		// Batch rejected (10 active batches, daily cap, 402...): rebook as serverless.
		b.Guard.Refund(j, TierBatch)
		if err2 := b.Guard.Admit(j, TierServerless); err2 != nil {
			return Handle{}, err2
		}
		b.emit(Event{Kind: "fallback", Tier: TierServerless, Endpoint: j.Endpoint, Job: j, Err: err})
	}
	h, err := b.submitRun(ctx, j)
	if err != nil {
		b.Guard.Refund(j, TierServerless)
		return Handle{}, err
	}
	b.emit(Event{Kind: "submit", Tier: TierServerless, Endpoint: j.Endpoint, Job: j})
	return h, nil
}

func (b *Broker) submitRun(ctx context.Context, j Job) (Handle, error) {
	r, err := b.Client.Run(ctx, j.Endpoint, j.Input, j.Policy)
	if err != nil {
		return Handle{}, err
	}
	jj := j
	return Handle{Tier: TierServerless, Endpoint: j.Endpoint, RequestID: r.ID, SubmittedAt: b.clock(), Job: &jj}, nil
}

func (b *Broker) submitBatch(ctx context.Context, j Job) (Handle, error) {
	id, err := b.Client.CreateBatch(ctx, j.Endpoint, []Request{{Input: j.Input, Policy: j.Policy}})
	if err != nil {
		return Handle{}, err
	}
	if err := b.Client.FinalizeBatch(ctx, j.Endpoint, id); err != nil {
		_, _ = b.Client.CancelBatch(ctx, j.Endpoint, id)
		return Handle{}, err
	}
	reqs, _, err := b.Client.BatchRequests(ctx, j.Endpoint, id, 0, 1)
	if err != nil || len(reqs) == 0 {
		_, _ = b.Client.CancelBatch(ctx, j.Endpoint, id)
		if err == nil {
			err = fmt.Errorf("batch %s has no requests after finalize", id)
		}
		return Handle{}, err
	}
	jj := j
	return Handle{Tier: TierBatch, Endpoint: j.Endpoint, RequestID: reqs[0].ID, BatchID: id,
		SubmittedAt: b.clock(), Patience: j.Patience, Job: &jj}, nil
}

// Poll returns the current state. For a batch job that has waited past its
// patience without starting, it cancels the batch (nothing is billed for
// queued requests) and resubmits on serverless, returning the new handle.
// Callers must store the returned handle when it differs.
func (b *Broker) Poll(ctx context.Context, h Handle) (RunResult, Handle, error) {
	res, err := b.Client.Status(ctx, h.Endpoint, h.RequestID)
	if err != nil {
		return res, h, err
	}
	if h.Tier != TierBatch || res.Status != "IN_QUEUE" || h.Patience <= 0 || b.clock().Sub(h.SubmittedAt) < h.Patience {
		return res, h, nil
	}
	if h.Job == nil {
		// Handle was restored from storage; the caller owns the original job,
		// so surface the state and let it call Reroute with the input.
		return res, h, nil
	}
	nh, err := b.Reroute(ctx, h, *h.Job)
	if err != nil {
		return res, h, nil
	}
	res, err = b.Client.Status(ctx, nh.Endpoint, nh.RequestID)
	return res, nh, err
}

// Reroute moves a not-yet-started batch job to serverless. If the batch worker
// already started it, the original handle is returned unchanged.
func (b *Broker) Reroute(ctx context.Context, h Handle, j Job) (Handle, error) {
	if h.Tier != TierBatch {
		return h, nil
	}
	if batch, err := b.Client.GetBatch(ctx, h.Endpoint, h.BatchID); err == nil && batch.Started() {
		return h, nil
	}
	batch, err := b.Client.CancelBatch(ctx, h.Endpoint, h.BatchID)
	if err != nil {
		return h, err
	}
	if batch.Started() {
		return h, nil
	}
	b.Guard.Refund(j, TierBatch)
	if err := b.Guard.Admit(j, TierServerless); err != nil {
		return h, err
	}
	nh, err := b.submitRun(ctx, j)
	if err != nil {
		b.Guard.Refund(j, TierServerless)
		return h, err
	}
	b.emit(Event{Kind: "fallback", Tier: TierServerless, Endpoint: j.Endpoint, Job: j, Err: errors.New("batch patience expired")})
	return nh, nil
}

// Cancel stops a job on whichever tier it is on.
func (b *Broker) Cancel(ctx context.Context, h Handle) error {
	if h.Tier == TierBatch && h.BatchID != "" {
		if _, err := b.Client.CancelBatch(ctx, h.Endpoint, h.BatchID); err == nil {
			return nil
		}
	}
	return b.Client.Cancel(ctx, h.Endpoint, h.RequestID)
}
