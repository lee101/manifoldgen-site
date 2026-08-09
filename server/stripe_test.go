package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

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
