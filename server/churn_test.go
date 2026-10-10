package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeLedger struct {
	mu       sync.Mutex
	users    map[string]*User
	seen     map[string]bool
	balances map[string]float64
}

func newFakeLedger(u *User) *fakeLedger {
	return &fakeLedger{users: map[string]*User{u.StripeSubscriptionID: u}, seen: map[string]bool{}, balances: map[string]float64{}}
}

func (f *fakeLedger) GetUserByStripeSubscription(sub, cust string) (*User, error) {
	if u, ok := f.users[sub]; ok {
		return u, nil
	}
	return nil, errors.New("no user")
}

func (f *fakeLedger) CreditStripeCheckout(userID, cust, grantID, pi string, usd, cute float64) (bool, float64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.seen[grantID] {
		return false, 0, nil
	}
	f.seen[grantID] = true
	f.balances[userID] += cute
	return true, f.balances[userID], nil
}

func invoiceFor(id, reason, price string) stripeInvoice {
	raw := `{"id":"` + id + `","customer":"cus_1","subscription":"sub_1","billing_reason":"` + reason + `","lines":{"data":[{"price":{"id":"` + price + `"}}]}}`
	var inv stripeInvoice
	if err := json.Unmarshal([]byte(raw), &inv); err != nil {
		panic(err)
	}
	return inv
}

func TestCreditPlanInvoiceGrantsOncePerInvoice(t *testing.T) {
	for _, spec := range creditPlans {
		u := &User{ID: "u1", StripeCustomerID: "cus_1", StripeSubscriptionID: "sub_1"}
		l := newFakeLedger(u)
		inv := invoiceFor("in_create", "subscription_create", spec.priceID())
		processStripeInvoicePaid(l, inv)
		processStripeInvoicePaid(l, inv)
		if l.balances["u1"] != spec.Credits {
			t.Fatalf("%s create: balance %v want %v", spec.Plan, l.balances["u1"], spec.Credits)
		}
		cyc := invoiceFor("in_cycle", "subscription_cycle", spec.priceID())
		processStripeInvoicePaid(l, cyc)
		processStripeInvoicePaid(l, cyc)
		if l.balances["u1"] != spec.Credits*2 {
			t.Fatalf("%s cycle: balance %v want %v", spec.Plan, l.balances["u1"], spec.Credits*2)
		}
		processStripeInvoicePaid(l, invoiceFor("in_upd", "subscription_update", spec.priceID()))
		processStripeInvoicePaid(l, invoiceFor("in_manual", "manual", spec.priceID()))
		if l.balances["u1"] != spec.Credits*2 {
			t.Fatalf("%s: non-cycle invoice granted credits", spec.Plan)
		}
	}
}

func TestCreditPlanAmounts(t *testing.T) {
	want := map[string]float64{"credits_maker": 3000, "credits_studio": 10500, "credits_scale": 33000}
	for _, p := range creditPlans {
		if p.Credits != want[p.Plan] {
			t.Fatalf("%s credits %v", p.Plan, p.Credits)
		}
		if got := stripePlanFromPriceID(p.priceID()); got != p.Plan {
			t.Fatalf("plan from price %s = %q", p.priceID(), got)
		}
		plan, price := stripePlanPriceID(p.Plan)
		if plan != p.Plan || price != p.priceID() {
			t.Fatalf("checkout plan %s -> %s %s", p.Plan, plan, price)
		}
	}
	if isCreditPlan("creator_monthly") || isCreditPlan("pro_annual") || isCreditPlan("") {
		t.Fatal("creator/pro misclassified as credit plan")
	}
	if plan, _ := stripePlanPriceID("creator_monthly"); plan != "creator_monthly" {
		t.Fatalf("creator plan broken: %s", plan)
	}
}

func TestCreatorRenewalStillGrantsAllowance(t *testing.T) {
	u := &User{ID: "u1", StripeCustomerID: "cus_1", StripeSubscriptionID: "sub_1", SubscriptionPlan: "creator_monthly"}
	l := newFakeLedger(u)
	creator := stripeCreatorMonthlyPriceID()
	processStripeInvoicePaid(l, invoiceFor("in_a", "subscription_create", creator))
	if l.balances["u1"] != 0 {
		t.Fatal("creator create invoice should not grant (checkout does)")
	}
	processStripeInvoicePaid(l, invoiceFor("in_b", "subscription_cycle", creator))
	processStripeInvoicePaid(l, invoiceFor("in_b", "subscription_cycle", creator))
	if l.balances["u1"] != 2500 {
		t.Fatalf("creator renewal balance %v want 2500", l.balances["u1"])
	}
}

type fakeRetention struct {
	mu      sync.Mutex
	claimed map[string]bool
}

func (f *fakeRetention) ClaimRetentionCoupon(cust, user string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.claimed[cust] {
		return false, nil
	}
	f.claimed[cust] = true
	return true, nil
}

func (f *fakeRetention) ReleaseRetentionCoupon(cust string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	delete(f.claimed, cust)
	return nil
}

type fakeApplier struct {
	calls int
	err   error
}

func (a *fakeApplier) applyRetentionCoupon(string) error {
	a.calls++
	return a.err
}

func TestRetentionCouponOnlyOnce(t *testing.T) {
	store := &fakeRetention{claimed: map[string]bool{}}
	ap := &fakeApplier{}
	u := &User{ID: "u1", StripeCustomerID: "cus_1", SubscriptionPlan: "creator_monthly"}
	if err := offerRetentionCoupon(store, ap, u); err != nil {
		t.Fatal(err)
	}
	if err := offerRetentionCoupon(store, ap, u); !errors.Is(err, errCouponAlreadyUsed) {
		t.Fatalf("second offer err = %v", err)
	}
	if ap.calls != 1 {
		t.Fatalf("applier calls = %d", ap.calls)
	}
}

func TestRetentionCouponReleasedOnStripeFailure(t *testing.T) {
	store := &fakeRetention{claimed: map[string]bool{}}
	ap := &fakeApplier{err: errors.New("stripe down")}
	u := &User{ID: "u1", StripeCustomerID: "cus_1", SubscriptionPlan: "pro_monthly"}
	if err := offerRetentionCoupon(store, ap, u); err == nil {
		t.Fatal("expected error")
	}
	ap.err = nil
	if err := offerRetentionCoupon(store, ap, u); err != nil {
		t.Fatalf("retry after failure: %v", err)
	}
}

func TestRetentionCouponRefusedForCreditPlans(t *testing.T) {
	store := &fakeRetention{claimed: map[string]bool{}}
	ap := &fakeApplier{}
	u := &User{ID: "u1", StripeCustomerID: "cus_1", SubscriptionPlan: "credits_studio"}
	if err := offerRetentionCoupon(store, ap, u); !errors.Is(err, errCouponNotForPlan) {
		t.Fatalf("err = %v", err)
	}
	if ap.calls != 0 || len(store.claimed) != 0 {
		t.Fatal("credit plan consumed coupon")
	}
}

func TestApplyRetentionCouponStripeCall(t *testing.T) {
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(`{"data":[{"id":"sub_1","status":"active","items":{"data":[{"id":"si_1","price":{"id":"price_other"}}]}}]}`))
			return
		}
		_ = r.ParseForm()
		got = r.URL.Path + " " + r.Form.Get("discounts[0][coupon]")
		_, _ = w.Write([]byte(`{}`))
	}))
	defer srv.Close()
	s := &stripeService{secretKey: "sk_test", baseURL: srv.URL, client: srv.Client()}
	if err := s.applyRetentionCoupon("cus_1"); err != nil {
		t.Fatal(err)
	}
	if got != "/v1/subscriptions/sub_1 CHURN50_3M" {
		t.Fatalf("stripe call = %q", got)
	}
}

func TestApplyRetentionCouponRejectsCreditPriceAtStripe(t *testing.T) {
	spec := creditPlans[1]
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Error("must not post for credit plan")
		}
		_, _ = w.Write([]byte(`{"data":[{"id":"sub_1","status":"active","items":{"data":[{"id":"si_1","price":{"id":"` + spec.priceID() + `"}}]}}]}`))
	}))
	defer srv.Close()
	s := &stripeService{secretKey: "sk_test", baseURL: srv.URL, client: srv.Client()}
	if err := s.applyRetentionCoupon("cus_1"); !errors.Is(err, errCouponNotForPlan) {
		t.Fatalf("err = %v", err)
	}
}

func TestCancelSurveyValidation(t *testing.T) {
	if _, _, err := normalizeCancelSurvey("bogus", ""); err == nil {
		t.Fatal("bogus reason accepted")
	}
	r, d, err := normalizeCancelSurvey(" Too_Expensive ", strings.Repeat("x", 2000))
	if err != nil || r != "too_expensive" || len(d) != 1000 {
		t.Fatalf("got %q %d %v", r, len(d), err)
	}
}

func TestCancelOptions(t *testing.T) {
	o := cancelOptionsFor(&User{SubscriptionPlan: "credits_scale"}, false)
	if o["coupon_available"] != false || o["can_pause"] != true || o["can_downgrade"] != true {
		t.Fatalf("scale options %v", o)
	}
	o = cancelOptionsFor(&User{SubscriptionPlan: "credits_maker"}, false)
	if o["can_downgrade"] != false {
		t.Fatalf("maker options %v", o)
	}
	o = cancelOptionsFor(&User{SubscriptionPlan: "creator_monthly"}, false)
	if o["coupon_available"] != true || o["can_pause"] != false {
		t.Fatalf("creator options %v", o)
	}
	o = cancelOptionsFor(&User{SubscriptionPlan: "creator_monthly"}, true)
	if o["coupon_available"] != false {
		t.Fatalf("claimed options %v", o)
	}
}

func TestCreditPlanDoesNotGrantUnlimitedAPI(t *testing.T) {
	if !stripeSubscriptionIsActive("active") || isCreditPlan("creator_monthly") {
		t.Fatal("creator must keep unlimited_api path")
	}
	if !isCreditPlan("credits_maker") {
		t.Fatal("maker must be credit plan")
	}
}

func TestWinbackSchedule(t *testing.T) {
	cfg := loadWinbackConfig()
	if cfg == nil || len(cfg.Emails) != 5 {
		t.Fatalf("winback config: %+v", cfg)
	}
	end := time.Now().Add(-48 * time.Hour)
	e, ok := nextWinbackEmail(cfg, 0, end, time.Now())
	if !ok || e.ID != 1 {
		t.Fatalf("first email %+v %v", e, ok)
	}
	if _, ok := nextWinbackEmail(cfg, 1, end, time.Now()); ok {
		t.Fatal("step 2 sent too early")
	}
	last := cfg.Emails[len(cfg.Emails)-1]
	if last.DelayDays > 30 {
		t.Fatalf("chain exceeds 30 days: %d", last.DelayDays)
	}
	if _, ok := nextWinbackEmail(cfg, 5, end.Add(-40*24*time.Hour), time.Now()); ok {
		t.Fatal("chain should be complete")
	}
}

func TestChurnEmailsDefaultOff(t *testing.T) {
	t.Setenv("CHURN_EMAILS_ENABLED", "")
	if churnEmailsEnabled() {
		t.Fatal("must default off")
	}
	called := false
	processWinbackEmails(time.Now(), func(*User, DripEmail) error { called = true; return nil })
	if called {
		t.Fatal("sent while disabled")
	}
	t.Setenv("CHURN_EMAILS_ENABLED", "true")
	if !churnEmailsEnabled() {
		t.Fatal("flag not honored")
	}
}
