package main

import "testing"

func TestCreditsShortForEstimate(t *testing.T) {
	t.Setenv("CREDIT_PRICE_USD", "0.01")
	poor := &User{Credits: 50}
	if need, have, short := creditsShortForEstimate(poor, 1.00, meteredPreflightShare); !short || need != 0.6 || have != 0.5 {
		t.Fatalf("need=%v have=%v short=%v", need, have, short)
	}
	if _, _, short := creditsShortForEstimate(&User{Credits: 60}, 1.00, meteredPreflightShare); short {
		t.Fatal("balance equal to the held share must pass")
	}
	if _, _, short := creditsShortForEstimate(&User{Credits: 0, UnlimitedAPI: true}, 5, 1); short {
		t.Fatal("unlimited users are never held")
	}
	if _, _, short := creditsShortForEstimate(&User{}, 0, 1); short {
		t.Fatal("zero estimate is never short")
	}
	if _, _, short := creditsShortForEstimate(nil, 1, 1); short {
		t.Fatal("nil user is handled by auth, not the hold")
	}
	if _, _, short := creditsShortForEstimate(&User{Credits: 0}, 0.35, 1); !short {
		t.Fatal("empty balance must not start a paid GPU job")
	}
}
