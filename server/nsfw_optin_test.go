package main

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/valyala/fasthttp"
)

func stubUsers(t *testing.T) map[string]*User {
	users := map[string]*User{
		"optin":  {ID: "u1", APIKey: "optin", AllowNSFW: true},
		"optout": {ID: "u2", APIKey: "optout"},
	}
	origLookup, origSet := lookupUserByAPIKey, setUserAllowNSFW
	lookupUserByAPIKey = func(key string) (*User, error) {
		if u, ok := users[key]; ok {
			copy := *u
			return &copy, nil
		}
		return nil, errors.New("no user")
	}
	setUserAllowNSFW = func(id string, allow bool) error {
		for _, u := range users {
			if u.ID == id {
				u.AllowNSFW = allow
			}
		}
		return nil
	}
	t.Cleanup(func() { lookupUserByAPIKey, setUserAllowNSFW = origLookup, origSet })
	return users
}

func nsfwCtx(uri, auth string) *fasthttp.RequestCtx {
	ctx := &fasthttp.RequestCtx{}
	ctx.Request.SetRequestURI(uri)
	if auth != "" {
		ctx.Request.Header.Set("Authorization", "Bearer "+auth)
	}
	return ctx
}

func TestResolveAllowNSFW(t *testing.T) {
	stubUsers(t)
	cases := []struct {
		name, uri, auth      string
		wantHonored, wantReq bool
	}{
		{"anonymous", "/api/images?allow_nsfw=true", "", false, true},
		{"unknown key", "/api/images?allow_nsfw=true", "bogus", false, true},
		{"opted out", "/api/images?allow_nsfw=true", "optout", false, true},
		{"opted in", "/api/images?allow_nsfw=true", "optin", true, true},
		{"opted in not requested", "/api/images", "optin", false, false},
		{"opted in false", "/api/images?allow_nsfw=false", "optin", false, false},
	}
	for _, c := range cases {
		honored, requested := resolveAllowNSFW(nsfwCtx(c.uri, c.auth))
		if honored != c.wantHonored || requested != c.wantReq {
			t.Errorf("%s: honored=%v requested=%v", c.name, honored, requested)
		}
	}
}

func TestGalleryCacheVariesWhenNSFWRequested(t *testing.T) {
	ctx := &fasthttp.RequestCtx{}
	setGalleryCache(ctx, false)
	if !strings.HasPrefix(string(ctx.Response.Header.Peek("Cache-Control")), "public") {
		t.Fatalf("sfw response must stay public: %s", ctx.Response.Header.Peek("Cache-Control"))
	}
	ctx = &fasthttp.RequestCtx{}
	setGalleryCache(ctx, true)
	if !strings.HasPrefix(string(ctx.Response.Header.Peek("Cache-Control")), "private") ||
		!strings.Contains(string(ctx.Response.Header.Peek("Vary")), "Authorization") {
		t.Fatalf("nsfw response must be private: %s / %s", ctx.Response.Header.Peek("Cache-Control"), ctx.Response.Header.Peek("Vary"))
	}
}

func TestAccountSettingsEndpoint(t *testing.T) {
	users := stubUsers(t)

	ctx := nsfwCtx("/api/account/settings", "")
	ctx.Request.SetBodyString(`{"allow_nsfw":true}`)
	handleAccountSettings(ctx)
	if ctx.Response.StatusCode() != 401 {
		t.Fatalf("anonymous status %d", ctx.Response.StatusCode())
	}

	ctx = nsfwCtx("/api/account/settings", "optout")
	ctx.Request.SetBodyString(`{"allow_nsfw":true}`)
	handleAccountSettings(ctx)
	if ctx.Response.StatusCode() != 200 || !users["optout"].AllowNSFW ||
		!strings.Contains(string(ctx.Response.Body()), `"allow_nsfw":true`) {
		t.Fatalf("enable failed: %d %s", ctx.Response.StatusCode(), ctx.Response.Body())
	}

	ctx = nsfwCtx("/api/account/settings", "optout")
	ctx.Request.SetBodyString(`{}`)
	handleAccountSettings(ctx)
	if ctx.Response.StatusCode() != 200 || !users["optout"].AllowNSFW {
		t.Fatalf("empty body must not change the setting: %d", ctx.Response.StatusCode())
	}

	ctx = nsfwCtx("/api/account/settings", "optout")
	ctx.Request.SetBodyString(`{"allow_nsfw":false}`)
	handleAccountSettings(ctx)
	if ctx.Response.StatusCode() != 200 || users["optout"].AllowNSFW {
		t.Fatalf("disable failed: %d", ctx.Response.StatusCode())
	}

	ctx = nsfwCtx("/api/account/settings", "optout")
	ctx.Request.SetBodyString(`nope`)
	handleAccountSettings(ctx)
	if ctx.Response.StatusCode() != 400 {
		t.Fatalf("bad body status %d", ctx.Response.StatusCode())
	}
}

func TestClassifierFailureDoesNotBlock(t *testing.T) {
	failing := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "down", http.StatusServiceUnavailable)
	}))
	t.Setenv("OMNISERVE_NATIVE_URL", failing.URL)
	t.Setenv("OMNISERVE_NATIVE_SECRET", "")
	t.Setenv("OMNISERVE_IMAGE_WORKER_SECRET", "")
	verdict, score := classifyH3ImageFlag([]byte("img"), "test")
	if verdict != nil || score != 0 {
		t.Fatalf("classifier error must yield unknown verdict, got %v %v", verdict, score)
	}
	failing.Close()
	if verdict, _ := classifyH3ImageFlag([]byte("img"), "test"); verdict != nil {
		t.Fatal("unreachable classifier must yield unknown verdict")
	}

	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"nsfw_score":0.9}`))
	}))
	defer ok.Close()
	t.Setenv("OMNISERVE_NATIVE_URL", ok.URL)
	verdict, score = classifyH3ImageFlag([]byte("img"), "test")
	if verdict == nil || !*verdict || score != 0.9 {
		t.Fatalf("score must still be stored as a flag: %v %v", verdict, score)
	}
}
