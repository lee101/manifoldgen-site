package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestStripeCreatorPriceIDsMigrateRetiredLegacyPrices(t *testing.T) {
	t.Setenv("STRIPE_CREATOR_MONTHLY_PRICE_ID", "")
	t.Setenv("STRIPE_CREATOR_ANNUAL_PRICE_ID", "")
	t.Setenv("STRIPE_MONTHLY_PRICE_ID", "price_1U23cXHS07k89Tt2FAaOIol0")
	t.Setenv("STRIPE_ANNUAL_PRICE_ID", "price_1U23cXHS07k89Tt2xAwAPV8Y")

	if got := stripeCreatorMonthlyPriceID(); got != "price_1U3RWpHS07k89Tt2D18g8vZE" {
		t.Fatalf("creator monthly price = %q, want active replacement", got)
	}
	if got := stripeCreatorAnnualPriceID(); got != "price_1U3RWpHS07k89Tt2DLaeh6bN" {
		t.Fatalf("creator annual price = %q, want active replacement", got)
	}
}

func TestStripeCheckoutUIModeNormalizesLegacyAndInvalidValues(t *testing.T) {
	t.Setenv("STRIPE_CHECKOUT_UI_MODE", "embedded_page")
	if got := stripeCheckoutUIMode(); got != "embedded_page" {
		t.Fatalf("checkout UI mode = %q, want embedded_page", got)
	}
	t.Setenv("STRIPE_CHECKOUT_UI_MODE", "embedded")
	if got := stripeCheckoutUIMode(); got != "embedded_page" {
		t.Fatalf("embedded checkout UI mode = %q, want embedded_page", got)
	}
	t.Setenv("STRIPE_CHECKOUT_UI_MODE", "not-a-stripe-mode")
	if got := stripeCheckoutUIMode(); got != "embedded_page" {
		t.Fatalf("invalid checkout UI mode = %q, want embedded_page", got)
	}
	t.Setenv("STRIPE_CHECKOUT_UI_MODE", "hosted")
	if got := stripeCheckoutUIMode(); got != "hosted" {
		t.Fatalf("hosted checkout UI mode = %q, want hosted", got)
	}
}

func TestCreateBillingPortalSession(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/v1/billing_portal/sessions" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if got := r.Form.Get("customer"); got != "cus_test_customer" {
			t.Errorf("customer = %q", got)
		}
		if got := r.Form.Get("return_url"); got != "https://manifoldgen.test/account" {
			t.Errorf("return_url = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"bps_test","url":"https://billing.stripe.com/p/session/test"}`))
	}))
	defer server.Close()

	service := &stripeService{secretKey: "sk_test", baseURL: server.URL, client: server.Client()}
	session, err := service.createBillingPortalSession("cus_test_customer", "https://manifoldgen.test/account")
	if err != nil {
		t.Fatal(err)
	}
	if session.ID != "bps_test" || session.URL != "https://billing.stripe.com/p/session/test" {
		t.Fatalf("unexpected session: %+v", session)
	}
}
