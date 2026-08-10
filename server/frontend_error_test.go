package main

import "testing"

func TestIsAllowedFrontendReportURLProduction(t *testing.T) {
	for _, rawURL := range []string{
		"https://manifoldgen.com/studio",
		"https://www.manifoldgen.com/account",
	} {
		if !isAllowedFrontendReportURL(rawURL) {
			t.Fatalf("expected production URL to be allowed: %s", rawURL)
		}
	}
	if isAllowedFrontendReportURL("https://attacker.example/studio") {
		t.Fatal("unexpected third-party URL allowed")
	}
}

func TestManifoldListenerFallsBackToTCP(t *testing.T) {
	t.Setenv("LISTEN_PID", "")
	t.Setenv("LISTEN_FDS", "")
	listener, err := manifoldListener(0)
	if err != nil {
		t.Fatalf("manifoldListener(0): %v", err)
	}
	if err := listener.Close(); err != nil {
		t.Fatalf("close listener: %v", err)
	}
}
