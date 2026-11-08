package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/valyala/fasthttp"
)

type keyHarness struct {
	t    *testing.T
	db   *DB
	user *User
}

func newKeyHarness(t *testing.T) *keyHarness {
	t.Helper()
	db := tempDB(t)
	old := dbConn
	dbConn = db
	t.Cleanup(func() { dbConn = old })
	user, _, err := db.GetOrCreateUser("wallet-" + newUUID())
	if err != nil {
		t.Fatal(err)
	}
	return &keyHarness{t: t, db: db, user: user}
}

func (h *keyHarness) call(method, uri, secret, body string, headers ...string) (int, map[string]interface{}, *fasthttp.RequestCtx) {
	h.t.Helper()
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.Header.SetMethod(method)
	ctx.Request.SetRequestURI(uri)
	if secret != "" {
		ctx.Request.Header.Set("Authorization", "Bearer "+secret)
	}
	for i := 0; i+1 < len(headers); i += 2 {
		ctx.Request.Header.Set(headers[i], headers[i+1])
	}
	if body != "" {
		ctx.Request.Header.SetContentType("application/json")
		ctx.Request.SetBodyString(body)
	}
	routeAPI(ctx, string(ctx.Path()), method)
	out := map[string]interface{}{}
	_ = json.Unmarshal(ctx.Response.Body(), &out)
	return ctx.Response.StatusCode(), out, ctx
}

func (h *keyHarness) create(auth string, scopes string, extra ...string) (string, string) {
	h.t.Helper()
	headers := append([]string{"Sec-Fetch-Site", "same-origin"}, extra...)
	status, out, _ := h.call("POST", "/api/keys", auth, `{"name":"test","scopes":`+scopes+`}`, headers...)
	if status != http.StatusCreated {
		h.t.Fatalf("create status %d body %v", status, out)
	}
	secret, _ := out["secret"].(string)
	id, _ := out["key"].(map[string]interface{})["id"].(string)
	if !strings.HasPrefix(secret, "sk-mg-") || id == "" {
		h.t.Fatalf("bad create response %v", out)
	}
	return id, secret
}

func errorCode(out map[string]interface{}) string {
	body, _ := out["error"].(map[string]interface{})
	code, _ := body["code"].(string)
	return code
}

func (h *keyHarness) mgmt() (string, string) {
	return h.create(h.user.APIKey, `["keys:manage"]`)
}

func TestAPIKeyCreateStoresHashOnly(t *testing.T) {
	h := newKeyHarness(t)
	if err := h.db.migrate(); err != nil {
		t.Fatalf("migration is not idempotent: %v", err)
	}
	id, secret := h.create(h.user.APIKey, `["credits:read","generate:image"]`)

	var hash, prefix string
	if err := h.db.conn.QueryRow(`SELECT key_hash, prefix FROM api_keys WHERE id = $1`, id).Scan(&hash, &prefix); err != nil {
		t.Fatal(err)
	}
	if hash != hashAPISecret(secret) || len(hash) != 64 || prefix != secret[:8] {
		t.Fatalf("hash %q prefix %q", hash, prefix)
	}
	var leaked int
	if err := h.db.conn.QueryRow(`SELECT COUNT(*) FROM api_keys WHERE key_hash = $1 OR name = $1 OR prefix = $1 OR id = $1 OR rotated_from = $1`, secret).Scan(&leaked); err != nil || leaked != 0 {
		t.Fatalf("secret stored plaintext: %d %v", leaked, err)
	}

	_, mgmt := h.mgmt()
	status, _, ctx := h.call("GET", "/api/keys", mgmt, "")
	if status != 200 || strings.Contains(string(ctx.Response.Body()), secret) {
		t.Fatalf("list status %d leaks secret", status)
	}
}

func TestAPIKeyCreateValidation(t *testing.T) {
	h := newKeyHarness(t)
	browser := []string{"Sec-Fetch-Site", "same-origin"}
	for _, body := range []string{
		`{"name":"x","scopes":["nope"]}`,
		`{"name":"x","scopes":[]}`,
		`{"name":"","scopes":["jobs:read"]}`,
		`{"name":"x","scopes":["jobs:read"],"expires_in_days":99999}`,
		`not json`,
	} {
		status, out, _ := h.call("POST", "/api/keys", h.user.APIKey, body, browser...)
		if status != http.StatusBadRequest || errorCode(out) == "" {
			t.Fatalf("%s: status %d %v", body, status, out)
		}
	}
	status, out, _ := h.call("POST", "/api/keys", h.user.APIKey, `{"name":"x","scopes":["jobs:read"],"expires_in_days":30}`, browser...)
	if status != http.StatusCreated || out["key"].(map[string]interface{})["expires_at"] == nil {
		t.Fatalf("expiry create: %d %v", status, out)
	}
}

func TestAPIKeyScopeAllowDeny(t *testing.T) {
	h := newKeyHarness(t)
	_, secret := h.create(h.user.APIKey, `["credits:read"]`)

	if status, out, _ := h.call("GET", "/api/billing-history", secret, ""); status != 200 {
		t.Fatalf("allowed scope: %d %v", status, out)
	}
	status, out, ctx := h.call("GET", "/api/video-jobs", secret, "")
	body := out["error"].(map[string]interface{})
	if status != 403 || body["code"] != "insufficient_scope" || body["required_scope"] != "jobs:read" || body["hint"] == "" {
		t.Fatalf("deny: %d %v", status, out)
	}
	if got := string(ctx.Response.Header.Peek("WWW-Authenticate")); got != `Bearer error="insufficient_scope", scope="jobs:read"` {
		t.Fatalf("WWW-Authenticate = %q", got)
	}

	status, _, _ = h.call("GET", "/api/billing-history", "", "", "X-API-Key", secret)
	if status != 200 {
		t.Fatalf("X-API-Key: %d", status)
	}

	status, out, ctx = h.call("GET", "/api/billing-history", "sk-mg-unknown", "")
	if status != 401 || errorCode(out) != "invalid_api_key" || string(ctx.Response.Header.Peek("WWW-Authenticate")) != "Bearer" {
		t.Fatalf("invalid key: %d %v", status, out)
	}
	status, out, _ = h.call("GET", "/api/billing-history", "", "")
	if status != 401 || errorCode(out) != "missing_api_key" {
		t.Fatalf("missing key: %d %v", status, out)
	}

	status, out, _ = h.call("POST", "/api/service", secret, `{"service":"video","prompt":"x"}`)
	if status != 403 || out["error"].(map[string]interface{})["required_scope"] != "generate:video" {
		t.Fatalf("service scope: %d %v", status, out)
	}
}

func TestAPIKeyManagementOnly(t *testing.T) {
	h := newKeyHarness(t)
	allUsage, _ := json.Marshal(usageScopes())
	_, ordinary := h.create(h.user.APIKey, string(allUsage))
	_, mgmt := h.mgmt()

	for _, tc := range []struct{ method, uri, body string }{
		{"GET", "/api/keys", ""},
		{"POST", "/api/keys", `{"name":"x","scopes":["jobs:read"]}`},
		{"POST", "/api/keys/abc/rotate", ""},
		{"DELETE", "/api/keys/abc", ""},
	} {
		status, out, ctx := h.call(tc.method, tc.uri, ordinary, tc.body, "Sec-Fetch-Site", "same-origin")
		if status != 403 || out["error"].(map[string]interface{})["required_scope"] != "keys:manage" {
			t.Fatalf("ordinary %s %s: %d %v", tc.method, tc.uri, status, out)
		}
		if !strings.Contains(string(ctx.Response.Header.Peek("WWW-Authenticate")), `scope="keys:manage"`) {
			t.Fatal("missing WWW-Authenticate scope")
		}
	}

	status, out, _ := h.call("POST", "/api/keys", mgmt, `{"name":"worker","scopes":["generate:image"]}`)
	if status != http.StatusCreated {
		t.Fatalf("management create: %d %v", status, out)
	}
	id := out["key"].(map[string]interface{})["id"].(string)
	if status, out, _ := h.call("POST", "/api/keys/"+id+"/rotate", mgmt, ""); status != 200 || out["secret"] == "" {
		t.Fatalf("management rotate: %d %v", status, out)
	}
	if status, out, _ := h.call("DELETE", "/api/keys/"+id, mgmt, ""); status != 200 {
		t.Fatalf("management revoke: %d %v", status, out)
	}

	status, out, _ = h.call("GET", "/api/billing-history", mgmt, "")
	if status != 403 || out["error"].(map[string]interface{})["required_scope"] != "credits:read" {
		t.Fatalf("management key has usage scopes: %d %v", status, out)
	}
	status, out, _ = h.call("GET", "/api/keys/me", mgmt, "")
	if status != 200 || out["is_management"] != true {
		t.Fatalf("me: %d %v", status, out)
	}
}

func TestAPIKeyOwnerIsolation(t *testing.T) {
	h := newKeyHarness(t)
	other, _, err := h.db.GetOrCreateUser("wallet-" + newUUID())
	if err != nil {
		t.Fatal(err)
	}
	id, _ := h.create(h.user.APIKey, `["jobs:read"]`)
	_, otherMgmt := h.create(other.APIKey, `["keys:manage"]`)
	if status, _, _ := h.call("DELETE", "/api/keys/"+id, otherMgmt, ""); status != 404 {
		t.Fatalf("cross-account revoke: %d", status)
	}
	if status, _, _ := h.call("POST", "/api/keys/"+id+"/rotate", otherMgmt, ""); status != 404 {
		t.Fatalf("cross-account rotate: %d", status)
	}
}

func TestAPIKeyRotateGracePeriod(t *testing.T) {
	h := newKeyHarness(t)
	_, mgmt := h.mgmt()
	oldID, oldSecret := h.create(h.user.APIKey, `["credits:read"]`)

	status, out, _ := h.call("POST", "/api/keys/"+oldID+"/rotate", mgmt, `{"grace_seconds":3600}`)
	if status != 200 {
		t.Fatalf("rotate: %d %v", status, out)
	}
	newSecret := out["secret"].(string)
	newKey := out["key"].(map[string]interface{})
	if newKey["rotated_from"] != oldID || newSecret == oldSecret {
		t.Fatalf("rotation links: %v", out)
	}
	for _, secret := range []string{oldSecret, newSecret} {
		if status, _, _ := h.call("GET", "/api/billing-history", secret, ""); status != 200 {
			t.Fatalf("key should work during grace: %d", status)
		}
	}
	if status, out, _ := h.call("POST", "/api/keys/"+oldID+"/rotate", mgmt, ""); status != 409 || errorCode(out) != "key_not_active" {
		t.Fatalf("re-rotate: %d %v", status, out)
	}

	if _, err := h.db.conn.Exec(`UPDATE api_keys SET revoked_at = NOW() - INTERVAL '1 second' WHERE id = $1`, oldID); err != nil {
		t.Fatal(err)
	}
	status, out, _ = h.call("GET", "/api/billing-history", oldSecret, "")
	if status != 401 || errorCode(out) != "api_key_revoked" {
		t.Fatalf("old key after grace: %d %v", status, out)
	}
	if status, _, _ := h.call("GET", "/api/billing-history", newSecret, ""); status != 200 {
		t.Fatalf("new key: %d", status)
	}

	newID := newKey["id"].(string)
	if status, _, _ := h.call("POST", "/api/keys/"+newID+"/rotate", mgmt, `{"grace_seconds":0}`); status != 200 {
		t.Fatalf("zero grace rotate: %d", status)
	}
	if status, out, _ := h.call("GET", "/api/billing-history", newSecret, ""); status != 401 {
		t.Fatalf("zero grace should revoke immediately: %d %v", status, out)
	}
	if status, out, _ := h.call("POST", "/api/keys/"+newID+"/rotate", mgmt, `{"grace_seconds":86401}`); status != 400 || errorCode(out) != "invalid_grace" {
		t.Fatalf("grace cap: %d %v", status, out)
	}
}

func TestAPIKeyRevokeAndExpiry(t *testing.T) {
	h := newKeyHarness(t)
	_, mgmt := h.mgmt()
	revokeID, revokeSecret := h.create(h.user.APIKey, `["credits:read"]`)
	expireID, expireSecret := h.create(h.user.APIKey, `["credits:read"]`)

	if status, _, _ := h.call("DELETE", "/api/keys/"+revokeID, mgmt, ""); status != 200 {
		t.Fatalf("revoke: %d", status)
	}
	if status, out, _ := h.call("GET", "/api/billing-history", revokeSecret, ""); status != 401 || errorCode(out) != "api_key_revoked" {
		t.Fatalf("revoked key: %d %v", status, out)
	}
	if status, _, _ := h.call("DELETE", "/api/keys/"+revokeID, mgmt, ""); status != 200 {
		t.Fatalf("revoke is idempotent: %d", status)
	}

	if _, err := h.db.conn.Exec(`UPDATE api_keys SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1`, expireID); err != nil {
		t.Fatal(err)
	}
	if status, out, _ := h.call("GET", "/api/billing-history", expireSecret, ""); status != 401 || errorCode(out) != "api_key_expired" {
		t.Fatalf("expired key: %d %v", status, out)
	}
	if status, out, _ := h.call("POST", "/api/keys/"+expireID+"/rotate", mgmt, ""); status != 409 {
		t.Fatalf("rotate expired: %d %v", status, out)
	}
}

func TestAPIKeyLastUsedThrottled(t *testing.T) {
	h := newKeyHarness(t)
	id, secret := h.create(h.user.APIKey, `["credits:read"]`)
	read := func() time.Time {
		var at *time.Time
		if err := h.db.conn.QueryRow(`SELECT last_used_at FROM api_keys WHERE id = $1`, id).Scan(&at); err != nil {
			t.Fatal(err)
		}
		if at == nil {
			return time.Time{}
		}
		return *at
	}
	if !read().IsZero() {
		t.Fatal("last_used_at set before use")
	}
	h.call("GET", "/api/billing-history", secret, "")
	first := read()
	if first.IsZero() {
		t.Fatal("last_used_at not recorded")
	}
	h.call("GET", "/api/billing-history", secret, "")
	if !read().Equal(first) {
		t.Fatal("last_used_at not throttled")
	}
}

func TestLegacyAPIKeyCompat(t *testing.T) {
	h := newKeyHarness(t)
	legacy := h.user.APIKey

	for _, uri := range []string{"/api/billing-history", "/api/video-jobs"} {
		if status, out, _ := h.call("GET", uri, legacy, ""); status != 200 {
			t.Fatalf("legacy %s: %d %v", uri, status, out)
		}
	}
	if status, _, _ := h.call("GET", "/api/billing-history", "", "", "X-API-Key", legacy); status != 200 {
		t.Fatalf("legacy X-API-Key: %d", status)
	}
	status, out, _ := h.call("GET", "/api/keys/me", legacy, "")
	if status != 200 || out["is_management"] != false || len(out["scopes"].([]interface{})) != len(usageScopes()) {
		t.Fatalf("legacy me: %d %v", status, out)
	}
	for _, scope := range out["scopes"].([]interface{}) {
		if scope == scopeKeysManage {
			t.Fatal("legacy key has keys:manage")
		}
	}

	status, out, _ = h.call("GET", "/api/keys", legacy, "")
	if status != 403 || out["error"].(map[string]interface{})["required_scope"] != "keys:manage" {
		t.Fatalf("legacy key outside browser session: %d %v", status, out)
	}
	if status, _, _ := h.call("GET", "/api/keys", legacy, "", "Sec-Fetch-Site", "same-origin"); status != 200 {
		t.Fatalf("browser session: %d", status)
	}
	if status, _, _ := h.call("GET", "/api/keys", legacy, "", "Origin", "https://evil.example"); status != 403 {
		t.Fatalf("foreign origin: %d", status)
	}

	rotated, err := h.db.RotateAPIKey(h.user.ID, legacy)
	if err != nil {
		t.Fatal(err)
	}
	if status, _, _ := h.call("GET", "/api/billing-history", legacy, ""); status != 401 {
		t.Fatalf("rotated legacy key still works: %d", status)
	}
	if status, _, _ := h.call("GET", "/api/billing-history", rotated.APIKey, ""); status != 200 {
		t.Fatalf("new legacy key: %d", status)
	}
}

func TestScopedKeyNeverSeesLegacySecret(t *testing.T) {
	h := newKeyHarness(t)
	_, secret := h.create(h.user.APIKey, `["account:write"]`)
	status, _, ctx := h.call("GET", "/api/session", secret, "")
	body := string(ctx.Response.Body())
	if status != 200 || strings.Contains(body, h.user.APIKey) {
		t.Fatalf("session leaks legacy key: %d %s", status, body)
	}
	status, _, ctx = h.call("POST", "/api/account/settings", secret, `{"allow_nsfw":false}`)
	if status != 200 || strings.Contains(string(ctx.Response.Body()), h.user.APIKey) {
		t.Fatalf("settings leaks legacy key: %d %s", status, ctx.Response.Body())
	}
}

func TestAPIKeyMCPScopes(t *testing.T) {
	h := newKeyHarness(t)
	_, noMCP := h.create(h.user.APIKey, `["jobs:read"]`)
	_, mcpOnly := h.create(h.user.APIKey, `["mcp"]`)
	_, both := h.create(h.user.APIKey, `["mcp","jobs:read"]`)

	call := func(secret string) (int, map[string]interface{}) {
		ctx := &fasthttp.RequestCtx{}
		ctx.Request.Header.SetMethod("POST")
		ctx.Request.SetRequestURI("/api/mcp")
		ctx.Request.Header.Set("Authorization", "Bearer "+secret)
		ctx.Request.SetBodyString(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_jobs","arguments":{}}}`)
		routeAPI(ctx, "/api/mcp", "POST")
		out := map[string]interface{}{}
		_ = json.Unmarshal(ctx.Response.Body(), &out)
		return ctx.Response.StatusCode(), out
	}
	if status, out := call(noMCP); status != 403 || out["error"].(map[string]interface{})["required_scope"] != "mcp" {
		t.Fatalf("mcp scope: %d %v", status, out)
	}
	status, out := call(mcpOnly)
	result := out["result"].(map[string]interface{})["structuredContent"].(map[string]interface{})
	if status != 200 || result["status"] != float64(403) {
		t.Fatalf("tool scope: %d %v", status, out)
	}
	if body := result["response"].(map[string]interface{})["error"].(map[string]interface{}); body["required_scope"] != "jobs:read" {
		t.Fatalf("tool scope error: %v", body)
	}
	status, out = call(both)
	if result := out["result"].(map[string]interface{})["structuredContent"].(map[string]interface{}); status != 200 || result["status"] != float64(200) {
		t.Fatalf("allowed tool: %d %v", status, out)
	}
}

func TestRouteScopeTable(t *testing.T) {
	for _, tc := range []struct{ method, path, want string }{
		{"POST", "/api/mcp", scopeMCP},
		{"GET", "/api/balance", scopeCreditsRead},
		{"GET", "/api/images", scopeGalleryRead},
		{"GET", "/api/video-jobs/abc", scopeJobsRead},
		{"POST", "/api/video-jobs/abc/cancel", scopeJobsWrite},
		{"DELETE", "/api/audio-jobs/abc", scopeJobsWrite},
		{"POST", "/api/train/start", scopeTrainLoRA},
		{"GET", "/api/uploads/presign", scopeTrainLoRA},
		{"POST", "/api/image-editor/edit", scopeImage},
		{"POST", "/api/studio/upscale-video", scopeVideo},
		{"POST", "/api/voice/generate", scopeAudio},
		{"POST", "/api/studio/projects/import", scopeTools},
		{"POST", "/api/auth/email", scopeAccountWrite},
		{"POST", "/api/stripe/portal", scopeAccountWrite},
		{"POST", "/api/unlisted", scopeAccountWrite},
	} {
		if got := routeScope(tc.path, tc.method); got != tc.want {
			t.Errorf("%s %s = %q, want %q", tc.method, tc.path, got, tc.want)
		}
	}
	for service := range servicePricesUSD {
		if !knownScope(serviceScope(service)) {
			t.Errorf("service %s has unknown scope", service)
		}
	}
}
