package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDripConfigAndTemplatesPresent(t *testing.T) {
	candidates := []string{
		"emails/drip_config.json",
		"../emails/drip_config.json",
	}
	var data []byte
	var err error
	var root string
	for _, c := range candidates {
		data, err = os.ReadFile(c)
		if err == nil {
			root = filepath.Dir(c)
			break
		}
	}
	if err != nil {
		t.Fatalf("drip_config.json missing: %v", err)
	}

	var cfg DripConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatalf("parse drip config: %v", err)
	}
	if cfg.FromEmail != "lee.penkman@netwrck.com" {
		t.Fatalf("from_email=%q want lee.penkman@netwrck.com", cfg.FromEmail)
	}
	if len(cfg.Emails) < 8 {
		t.Fatalf("expected >=8 drip emails, got %d", len(cfg.Emails))
	}
	for _, drip := range cfg.Emails {
		path := filepath.Join(root, drip.Template)
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("missing template %s: %v", drip.Template, err)
		}
		html := string(body)
		if !strings.Contains(html, "{{.UnsubscribeURL}}") {
			t.Fatalf("%s missing unsubscribe placeholder", drip.Template)
		}
		if !strings.Contains(html, "ManifoldGen") {
			t.Fatalf("%s missing ManifoldGen branding", drip.Template)
		}
	}

	for _, extra := range []string{"credits-expired.html", "password-reset.html"} {
		body, err := os.ReadFile(filepath.Join(root, extra))
		if err != nil {
			t.Fatalf("missing %s: %v", extra, err)
		}
		if extra == "password-reset.html" && !strings.Contains(string(body), "{{.ResetURL}}") {
			t.Fatalf("password-reset.html missing {{.ResetURL}}")
		}
	}
}

func TestPasswordHashAndResetToken(t *testing.T) {
	hash, err := hashPassword("manifold-test-123")
	if err != nil {
		t.Fatal(err)
	}
	if !checkPassword("manifold-test-123", hash) {
		t.Fatal("password should verify")
	}
	if checkPassword("wrong-password", hash) {
		t.Fatal("wrong password should fail")
	}
	if _, err := hashPassword("short"); err == nil {
		t.Fatal("short password should error")
	}

	raw, tokenHash, err := newPasswordResetToken()
	if err != nil {
		t.Fatal(err)
	}
	if raw == "" || tokenHash == "" {
		t.Fatal("empty token")
	}
	if passwordResetTokenHash(raw) != tokenHash {
		t.Fatal("token hash mismatch")
	}
}

func TestPersonalizeTemplate(t *testing.T) {
	user := &User{
		Email:         "creator@manifoldgen.local",
		APIKey:        "mg_test_key",
		WalletAddress: "email:creator00000000000000000000000000000000",
	}
	out := personalizeTemplate("hi {{.Email}} key={{.APIKey}} unsub={{.UnsubscribeURL}}", user)
	if !strings.Contains(out, "creator@manifoldgen.local") {
		t.Fatalf("email missing: %s", out)
	}
	if !strings.Contains(out, "mg_test_key") {
		t.Fatalf("api key missing: %s", out)
	}
	if !strings.Contains(out, "unsubscribe?email=") {
		t.Fatalf("unsubscribe missing: %s", out)
	}
}

func TestSESFromDefaults(t *testing.T) {
	os.Unsetenv("SES_FROM_EMAIL")
	os.Unsetenv("SES_FROM_NAME")
	if got := getEnv("SES_FROM_EMAIL", "lee.penkman@netwrck.com"); got != "lee.penkman@netwrck.com" {
		t.Fatalf("default from email = %s", got)
	}
}
