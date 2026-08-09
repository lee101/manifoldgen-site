package main

import "testing"

func TestStudioMediaURL(t *testing.T) {
	body := []byte(`{"result":{"image":{"url":"https://cdn.example/cutout.webp"}}}`)
	if got := studioMediaURL(body); got != "https://cdn.example/cutout.webp" {
		t.Fatalf("studioMediaURL() = %q", got)
	}
	if got := studioMediaURL([]byte(`{"status":"done"}`)); got != "" {
		t.Fatalf("studioMediaURL() unexpected URL = %q", got)
	}
}

func TestStudioExtensionCustomerPrice(t *testing.T) {
	inputSeconds := 8.0
	outputSeconds := 6.0
	price := studioExtensionPriceUSD(inputSeconds, int(outputSeconds))
	if price != 0.60 {
		t.Fatalf("extension price = %.2f, want 0.60", price)
	}
}
