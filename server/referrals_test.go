package main

import (
	"testing"

	"github.com/valyala/fasthttp"
)

func TestReferralCodeFromRequest(t *testing.T) {
	var ctx fasthttp.RequestCtx
	ctx.Request.Header.SetCookie("mg_ref", "A1B2C3D4E5")
	if got := referralCodeFromRequest(&ctx); got != "a1b2c3d4e5" {
		t.Fatalf("referral code = %q", got)
	}
	ctx.Request.Header.SetCookie("mg_ref", "../../not-a-code")
	if got := referralCodeFromRequest(&ctx); got != "" {
		t.Fatalf("unsafe referral code accepted: %q", got)
	}
}

func TestNewReferralCodeIsShareable(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 50; i++ {
		code := newReferralCode()
		if !referralCodePattern.MatchString(code) {
			t.Fatalf("invalid generated code %q", code)
		}
		if seen[code] {
			t.Fatalf("duplicate generated code %q", code)
		}
		seen[code] = true
	}
}
