package main

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/lib/pq"
	"github.com/valyala/fasthttp"
)

const (
	scopeKeysManage   = "keys:manage"
	scopeMCP          = "mcp"
	scopeImage        = "generate:image"
	scopeVideo        = "generate:video"
	scopeAudio        = "generate:audio"
	scopeTools        = "generate:tools"
	scopeTrainLoRA    = "train:lora"
	scopeGalleryRead  = "gallery:read"
	scopeJobsRead     = "jobs:read"
	scopeJobsWrite    = "jobs:write"
	scopeCreditsRead  = "credits:read"
	scopeAccountWrite = "account:write"

	apiKeyMaxActive    = 50
	apiKeyMaxGrace     = 24 * time.Hour
	apiKeyTouchEvery   = time.Minute
	apiKeyMaxExpiryDay = 3650
)

type apiKeyScope struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

var apiKeyScopeCatalog = []apiKeyScope{
	{scopeImage, "Generate and edit images, image editor, background removal"},
	{scopeVideo, "Generate and edit video, Studio video tools, video estimates"},
	{scopeAudio, "Generate music, sound effects and speech; captions and transcription"},
	{scopeTools, "Hosted production tools (Blender, vectorize, 3D), Studio projects and uploads, forecasting, safety"},
	{scopeTrainLoRA, "LoRA training datasets, uploads and training jobs"},
	{scopeGalleryRead, "Read the account's private gallery and audio library"},
	{scopeJobsRead, "List and read job status and results"},
	{scopeJobsWrite, "Retry, cancel and delete jobs"},
	{scopeCreditsRead, "Read balance, billing history and referrals"},
	{scopeAccountWrite, "Change account email, password, settings and billing; also the default for unlisted routes"},
	{scopeMCP, "Connect to the MCP server; tool calls also need the scope of the underlying operation"},
	{scopeKeysManage, "Management key: list, create, rotate and revoke API keys"},
}

func usageScopes() []string {
	scopes := make([]string, 0, len(apiKeyScopeCatalog))
	for _, scope := range apiKeyScopeCatalog {
		if scope.Name != scopeKeysManage {
			scopes = append(scopes, scope.Name)
		}
	}
	return scopes
}

func knownScope(name string) bool {
	for _, scope := range apiKeyScopeCatalog {
		if scope.Name == name {
			return true
		}
	}
	return false
}

func routeScope(path, method string) string {
	switch {
	case path == "/api/mcp":
		return scopeMCP
	case path == "/api/balance", path == "/api/billing-history", path == "/api/referrals":
		return scopeCreditsRead
	case path == "/api/images", path == "/api/images/semantic", path == "/api/audio/search", strings.HasPrefix(path, "/api/gallery-assets/"):
		return scopeGalleryRead
	case path == "/api/video-jobs", path == "/api/audio-jobs", strings.HasPrefix(path, "/api/video-jobs/"), strings.HasPrefix(path, "/api/audio-jobs/"):
		if method == http.MethodGet || method == http.MethodHead {
			return scopeJobsRead
		}
		return scopeJobsWrite
	case strings.HasPrefix(path, "/api/train/"), path == "/api/uploads/presign":
		return scopeTrainLoRA
	case strings.HasPrefix(path, "/api/image-editor/"), path == "/api/studio/remove-background", path == "/api/studio/upscale-image":
		return scopeImage
	case path == "/api/studio/extend-video", path == "/api/studio/upscale-video", path == "/api/studio/retime",
		strings.HasPrefix(path, "/api/video-remake/"), strings.HasPrefix(path, "/api/reference-video/"), strings.HasPrefix(path, "/api/character-swap/"):
		return scopeVideo
	case path == "/api/music-compose", path == "/api/studio/generate-music", path == "/api/studio/audio-search", path == "/api/studio/audio-proxy",
		strings.HasPrefix(path, "/api/voice/"), strings.HasPrefix(path, "/api/captions/"):
		return scopeAudio
	case strings.HasPrefix(path, "/api/studio/"):
		return scopeTools
	}
	return scopeAccountWrite
}

var (
	audioServices = map[string]bool{
		"audio_generation": true, "music_generation": true, "sfx_generation": true, "tts": true, "stt": true,
		"openpaths_tts": true, "lyria_generation": true, "voice_enhancer": true, "lyric_music": true,
	}
	videoServices = map[string]bool{
		"ltx_video": true, "video_generate": true, "h3_video": true, "video_restyle": true, "orbit_video": true,
		"flux3_max_video": true, "character_animation": true, "video_background_removal": true, "video_dramatize": true,
		"lofi_loop": true, "reference_video": true, "character_swap_video": true,
	}
	imageServices = map[string]bool{
		"zimage": true, "anima": true, "anime_pose_control": true, "anime_scene_control": true, "anime_depth_control": true,
		"anime_sketch_control": true, "gpt_image": true, "image_edit": true, "h3_image": true, "h3_image_edit": true,
		"flux_image": true, "openpaths_image": true, "extend_image": true, "smart_resize": true, "remove_background": true,
		"relight": true, "upscale_image": true, "caption": true,
	}
)

func serviceScope(service string) string {
	switch {
	case audioServices[service]:
		return scopeAudio
	case videoServices[service]:
		return scopeVideo
	case imageServices[service]:
		return scopeImage
	case service == "lora_training":
		return scopeTrainLoRA
	}
	return scopeTools
}

type APIKey struct {
	ID          string     `json:"id"`
	UserID      string     `json:"-"`
	Name        string     `json:"name"`
	Prefix      string     `json:"prefix"`
	Scopes      []string   `json:"scopes"`
	CreatedAt   time.Time  `json:"created_at"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	RevokedAt   *time.Time `json:"revoked_at"`
	RotatedFrom string     `json:"rotated_from,omitempty"`
}

func (k *APIKey) IsManagement() bool {
	for _, scope := range k.Scopes {
		if scope == scopeKeysManage {
			return true
		}
	}
	return false
}

func (k *APIKey) active(now time.Time) bool {
	return (k.RevokedAt == nil || k.RevokedAt.After(now)) && (k.ExpiresAt == nil || k.ExpiresAt.After(now))
}

var (
	ErrAPIKeyNotFound = errors.New("api key not found")
	ErrAPIKeyInactive = errors.New("api key is not active")
	ErrAPIKeyLimit    = errors.New("too many active api keys")
)

func hashAPISecret(secret string) string {
	sum := sha256.Sum256([]byte(secret))
	return hex.EncodeToString(sum[:])
}

func newScopedAPISecret() string {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		panic(err)
	}
	return "sk-mg-" + hex.EncodeToString(buf)
}

const apiKeyColumns = `id, user_id, name, prefix, scopes, created_at, last_used_at, expires_at, revoked_at, COALESCE(rotated_from, '')`

func scanAPIKey(row interface{ Scan(...interface{}) error }, key *APIKey) error {
	return row.Scan(&key.ID, &key.UserID, &key.Name, &key.Prefix, pq.Array(&key.Scopes), &key.CreatedAt, &key.LastUsedAt, &key.ExpiresAt, &key.RevokedAt, &key.RotatedFrom)
}

type apiKeyQuerier interface {
	QueryRow(query string, args ...interface{}) *sql.Row
}

func insertAPIKey(q apiKeyQuerier, userID, name string, scopes []string, expiresAt *time.Time, rotatedFrom string) (*APIKey, string, error) {
	secret := newScopedAPISecret()
	var rotated interface{}
	if rotatedFrom != "" {
		rotated = rotatedFrom
	}
	var key APIKey
	err := scanAPIKey(q.QueryRow(
		`INSERT INTO api_keys (id, user_id, name, prefix, key_hash, scopes, expires_at, rotated_from)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING `+apiKeyColumns,
		newUUID(), userID, name, secret[:8], hashAPISecret(secret), pq.Array(scopes), expiresAt, rotated,
	), &key)
	if err != nil {
		return nil, "", err
	}
	return &key, secret, nil
}

func (db *DB) CreateAPIKey(userID, name string, scopes []string, expiresAt *time.Time) (*APIKey, string, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	var active int
	if err := db.conn.QueryRow(
		`SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND (revoked_at IS NULL OR revoked_at > NOW()) AND (expires_at IS NULL OR expires_at > NOW())`,
		userID,
	).Scan(&active); err != nil {
		return nil, "", err
	}
	if active >= apiKeyMaxActive {
		return nil, "", ErrAPIKeyLimit
	}
	return insertAPIKey(db.conn, userID, name, scopes, expiresAt, "")
}

func (db *DB) GetAPIKeyBySecret(secret string) (*APIKey, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	var key APIKey
	if err := scanAPIKey(db.conn.QueryRow(`SELECT `+apiKeyColumns+` FROM api_keys WHERE key_hash = $1`, hashAPISecret(secret)), &key); err != nil {
		return nil, err
	}
	return &key, nil
}

func (db *DB) TouchAPIKey(id string) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	_, _ = db.conn.Exec(
		`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1 AND (last_used_at IS NULL OR last_used_at < NOW() - make_interval(secs => $2))`,
		id, apiKeyTouchEvery.Seconds(),
	)
}

func (db *DB) ListAPIKeys(userID string) ([]APIKey, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()

	rows, err := db.conn.Query(`SELECT `+apiKeyColumns+` FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC LIMIT 200`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := []APIKey{}
	for rows.Next() {
		var key APIKey
		if err := scanAPIKey(rows, &key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (db *DB) RotateAPIKeyByID(userID, id string, grace time.Duration) (*APIKey, string, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	tx, err := db.conn.Begin()
	if err != nil {
		return nil, "", err
	}
	defer tx.Rollback()

	var old APIKey
	if err := scanAPIKey(tx.QueryRow(`SELECT `+apiKeyColumns+` FROM api_keys WHERE id = $1 AND user_id = $2 FOR UPDATE`, id, userID), &old); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, "", ErrAPIKeyNotFound
		}
		return nil, "", err
	}
	if old.RevokedAt != nil || !old.active(time.Now()) {
		return nil, "", ErrAPIKeyInactive
	}
	fresh, secret, err := insertAPIKey(tx, userID, old.Name, old.Scopes, old.ExpiresAt, old.ID)
	if err != nil {
		return nil, "", err
	}
	if _, err := tx.Exec(`UPDATE api_keys SET revoked_at = NOW() + make_interval(secs => $1) WHERE id = $2`, grace.Seconds(), old.ID); err != nil {
		return nil, "", err
	}
	if err := tx.Commit(); err != nil {
		return nil, "", err
	}
	return fresh, secret, nil
}

func (db *DB) RevokeAPIKey(userID, id string) (*APIKey, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	var key APIKey
	err := scanAPIKey(db.conn.QueryRow(
		`UPDATE api_keys SET revoked_at = LEAST(COALESCE(revoked_at, NOW()), NOW()) WHERE id = $1 AND user_id = $2 RETURNING `+apiKeyColumns,
		id, userID,
	), &key)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrAPIKeyNotFound
	}
	if err != nil {
		return nil, err
	}
	return &key, nil
}

type apiPrincipal struct {
	User   *User
	Key    *APIKey
	Scopes []string
}

func (p *apiPrincipal) Legacy() bool { return p.Key == nil }

func (p *apiPrincipal) Has(scope string) bool {
	for _, have := range p.Scopes {
		if have == scope {
			return true
		}
	}
	return false
}

type apiFailure struct {
	Status        int
	Code          string
	Message       string
	Hint          string
	RequiredScope string
}

func (f *apiFailure) Error() string { return f.Message }

func (f *apiFailure) write(ctx *fasthttp.RequestCtx) {
	apiError(ctx, f.Status, f.Code, f.Message, f.Hint, f.RequiredScope)
}

func apiError(ctx *fasthttp.RequestCtx, status int, code, message, hint, requiredScope string) {
	body := map[string]string{"code": code, "message": message}
	if hint != "" {
		body["hint"] = hint
	}
	if requiredScope != "" {
		body["required_scope"] = requiredScope
	}
	switch {
	case status == http.StatusUnauthorized:
		ctx.Response.Header.Set("WWW-Authenticate", "Bearer")
	case status == http.StatusForbidden && code == "insufficient_scope":
		ctx.Response.Header.Set("WWW-Authenticate", fmt.Sprintf(`Bearer error="insufficient_scope", scope=%q`, requiredScope))
	}
	jsonResponse(ctx, status, map[string]interface{}{"error": body})
}

const (
	principalUserKey   = "api_principal"
	authFailureUserKey = "api_failure"
)

var lookupAPIKeyBySecret = func(secret string) (*APIKey, *User, error) {
	if dbConn == nil {
		return nil, nil, sql.ErrNoRows
	}
	key, err := dbConn.GetAPIKeyBySecret(secret)
	if err != nil {
		return nil, nil, err
	}
	user, err := dbConn.GetUserByID(key.UserID)
	if err != nil {
		return nil, nil, err
	}
	return key, user, nil
}

func requestAPISecret(ctx *fasthttp.RequestCtx) string {
	auth := strings.TrimSpace(string(ctx.Request.Header.Peek("Authorization")))
	if len(auth) > 7 && strings.EqualFold(auth[:7], "bearer ") {
		return strings.TrimSpace(auth[7:])
	}
	return strings.TrimSpace(string(ctx.Request.Header.Peek("X-API-Key")))
}

func authenticateSecret(secret string) (*apiPrincipal, *apiFailure) {
	if secret == "" {
		return nil, &apiFailure{Status: http.StatusUnauthorized, Code: "missing_api_key", Message: "sign in required",
			Hint: "Send Authorization: Bearer <api key> or X-API-Key: <api key>."}
	}
	key, user, err := lookupAPIKeyBySecret(secret)
	switch {
	case err == nil:
		now := time.Now()
		if key.RevokedAt != nil && !key.RevokedAt.After(now) {
			return nil, &apiFailure{Status: http.StatusUnauthorized, Code: "api_key_revoked", Message: "API key was revoked",
				Hint: "Create or rotate a key with the management key or from the account page."}
		}
		if key.ExpiresAt != nil && !key.ExpiresAt.After(now) {
			return nil, &apiFailure{Status: http.StatusUnauthorized, Code: "api_key_expired", Message: "API key expired",
				Hint: "Create a replacement with the management key or from the account page."}
		}
		if dbConn != nil && (key.LastUsedAt == nil || now.Sub(*key.LastUsedAt) >= apiKeyTouchEvery) {
			dbConn.TouchAPIKey(key.ID)
		}
		user.APIKey = ""
		return &apiPrincipal{User: user, Key: key, Scopes: key.Scopes}, nil
	case !errors.Is(err, sql.ErrNoRows):
		log.Printf("api key lookup failed: %v", err)
		return nil, &apiFailure{Status: http.StatusServiceUnavailable, Code: "auth_unavailable", Message: "authentication is temporarily unavailable",
			Hint: "Retry shortly."}
	}
	user, err = lookupUserByAPIKey(secret)
	if err != nil {
		return nil, &apiFailure{Status: http.StatusUnauthorized, Code: "invalid_api_key", Message: "invalid API key",
			Hint: "Check the key or create one on the account page. GET /api/keys/me describes a key."}
	}
	return &apiPrincipal{User: user, Scopes: usageScopes()}, nil
}

func authenticateRequest(ctx *fasthttp.RequestCtx) (*apiPrincipal, *apiFailure) {
	if p, ok := ctx.UserValue(principalUserKey).(*apiPrincipal); ok {
		return p, nil
	}
	p, failure := authenticateSecret(requestAPISecret(ctx))
	if failure == nil {
		ctx.SetUserValue(principalUserKey, p)
	}
	return p, failure
}

func insufficientScope(scope string) *apiFailure {
	return &apiFailure{Status: http.StatusForbidden, Code: "insufficient_scope", Message: "API key lacks the required scope: " + scope,
		Hint: "Use a key that includes this scope. GET /api/keys/scopes lists scopes.", RequiredScope: scope}
}

func authorizeScope(ctx *fasthttp.RequestCtx, scope string) (*apiPrincipal, *apiFailure) {
	p, failure := authenticateRequest(ctx)
	if failure != nil {
		return nil, failure
	}
	if !p.Has(scope) {
		return nil, insufficientScope(scope)
	}
	return p, nil
}

func requireScope(ctx *fasthttp.RequestCtx, scope string) (*User, bool) {
	p, failure := authorizeScope(ctx, scope)
	if failure != nil {
		failure.write(ctx)
		return nil, false
	}
	return p.User, true
}

func requireRouteScope(ctx *fasthttp.RequestCtx) (*User, bool) {
	return requireScope(ctx, routeScope(string(ctx.Path()), string(ctx.Method())))
}

func scopedUser(ctx *fasthttp.RequestCtx, scope string) (*User, error) {
	p, failure := authorizeScope(ctx, scope)
	if failure != nil {
		ctx.SetUserValue(authFailureUserKey, failure)
		return nil, failure
	}
	ctx.SetUserValue(authFailureUserKey, nil)
	return p.User, nil
}

func isBrowserSession(ctx *fasthttp.RequestCtx) bool {
	switch string(ctx.Request.Header.Peek("Sec-Fetch-Site")) {
	case "same-origin", "same-site":
		return true
	}
	origin := string(ctx.Request.Header.Peek("Origin"))
	if origin == "" {
		return false
	}
	_, configured := corsOrigins[origin]
	return configured || origin == frontendURL
}

func authorizeKeyManagement(ctx *fasthttp.RequestCtx) (*apiPrincipal, bool) {
	p, failure := authenticateRequest(ctx)
	if failure == nil && !(p.Key != nil && p.Key.IsManagement()) && !(p.Legacy() && isBrowserSession(ctx)) {
		failure = insufficientScope(scopeKeysManage)
		failure.Hint = "Use the management key (scope keys:manage) or the signed-in account page. GET /api/keys/scopes lists scopes."
	}
	if failure != nil {
		failure.write(ctx)
		return nil, false
	}
	return p, true
}

type apiKeyView struct {
	*APIKey
	IsManagement bool `json:"is_management"`
}

func viewAPIKey(key *APIKey) apiKeyView {
	return apiKeyView{APIKey: key, IsManagement: key.IsManagement()}
}

func handleAPIKeys(ctx *fasthttp.RequestCtx, path, method string) {
	rest := strings.Trim(strings.TrimPrefix(path, "/api/keys"), "/")
	parts := []string{}
	if rest != "" {
		parts = strings.Split(rest, "/")
	}
	switch {
	case len(parts) == 0 && method == http.MethodGet:
		handleListAPIKeys(ctx)
	case len(parts) == 0 && method == http.MethodPost:
		handleCreateAPIKey(ctx)
	case len(parts) == 1 && parts[0] == "scopes" && method == http.MethodGet:
		ctx.Response.Header.Set("Cache-Control", "public, max-age=300")
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{"scopes": apiKeyScopeCatalog})
	case len(parts) == 1 && parts[0] == "me" && method == http.MethodGet:
		handleAPIKeyMe(ctx)
	case len(parts) == 1 && method == http.MethodDelete:
		handleRevokeAPIKey(ctx, parts[0])
	case len(parts) == 2 && parts[1] == "rotate" && method == http.MethodPost:
		handleRotateAPIKeyByID(ctx, parts[0])
	default:
		apiError(ctx, http.StatusNotFound, "not_found", "unknown keys endpoint", "See GET /api/keys/scopes and the API docs.", "")
	}
}

func handleAPIKeyMe(ctx *fasthttp.RequestCtx) {
	p, failure := authenticateRequest(ctx)
	if failure != nil {
		failure.write(ctx)
		return
	}
	ctx.Response.Header.Set("Cache-Control", "no-store")
	if p.Legacy() {
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{
			"id": "legacy", "name": "Account API key", "scopes": p.Scopes, "expires_at": nil, "is_management": false,
		})
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"id": p.Key.ID, "name": p.Key.Name, "scopes": p.Key.Scopes, "expires_at": p.Key.ExpiresAt, "is_management": p.Key.IsManagement(),
	})
}

func handleListAPIKeys(ctx *fasthttp.RequestCtx) {
	p, ok := authorizeKeyManagement(ctx)
	if !ok {
		return
	}
	keys, err := dbConn.ListAPIKeys(p.User.ID)
	if err != nil {
		log.Printf("list api keys user=%s: %v", p.User.ID, err)
		apiError(ctx, http.StatusInternalServerError, "internal_error", "failed to list keys", "", "")
		return
	}
	views := make([]apiKeyView, len(keys))
	for i := range keys {
		views[i] = viewAPIKey(&keys[i])
	}
	ctx.Response.Header.Set("Cache-Control", "no-store")
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"keys": views})
}

func decodeKeyBody(ctx *fasthttp.RequestCtx, target interface{}, allowEmpty bool) bool {
	body := ctx.PostBody()
	if len(body) == 0 && allowEmpty {
		return true
	}
	if len(body) > 16<<10 || json.Unmarshal(body, target) != nil {
		apiError(ctx, http.StatusBadRequest, "invalid_request", "request body must be valid JSON", "", "")
		return false
	}
	return true
}

func handleCreateAPIKey(ctx *fasthttp.RequestCtx) {
	p, ok := authorizeKeyManagement(ctx)
	if !ok {
		return
	}
	var req struct {
		Name          string   `json:"name"`
		Scopes        []string `json:"scopes"`
		ExpiresInDays int      `json:"expires_in_days"`
	}
	if !decodeKeyBody(ctx, &req, false) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 64 {
		apiError(ctx, http.StatusBadRequest, "invalid_name", "name is required (1-64 characters)", "", "")
		return
	}
	seen := map[string]bool{}
	scopes := []string{}
	for _, scope := range req.Scopes {
		if !knownScope(scope) {
			apiError(ctx, http.StatusBadRequest, "invalid_scope", "unknown scope: "+scope, "GET /api/keys/scopes lists valid scopes.", "")
			return
		}
		if !seen[scope] {
			seen[scope] = true
			scopes = append(scopes, scope)
		}
	}
	if len(scopes) == 0 {
		apiError(ctx, http.StatusBadRequest, "invalid_scope", "at least one scope is required", "GET /api/keys/scopes lists valid scopes.", "")
		return
	}
	sort.Strings(scopes)
	var expiresAt *time.Time
	if req.ExpiresInDays != 0 {
		if req.ExpiresInDays < 1 || req.ExpiresInDays > apiKeyMaxExpiryDay {
			apiError(ctx, http.StatusBadRequest, "invalid_expiry", fmt.Sprintf("expires_in_days must be between 1 and %d", apiKeyMaxExpiryDay), "", "")
			return
		}
		t := time.Now().Add(time.Duration(req.ExpiresInDays) * 24 * time.Hour)
		expiresAt = &t
	}
	key, secret, err := dbConn.CreateAPIKey(p.User.ID, req.Name, scopes, expiresAt)
	if errors.Is(err, ErrAPIKeyLimit) {
		apiError(ctx, http.StatusConflict, "key_limit", fmt.Sprintf("at most %d active keys per account", apiKeyMaxActive), "Revoke an unused key first.", "")
		return
	}
	if err != nil {
		log.Printf("create api key user=%s: %v", p.User.ID, err)
		apiError(ctx, http.StatusInternalServerError, "internal_error", "failed to create key", "", "")
		return
	}
	log.Printf("api key created user=%s key=%s scopes=%s", p.User.ID, key.ID, strings.Join(scopes, ","))
	writeSecretResponse(ctx, http.StatusCreated, key, secret, nil)
}

func writeSecretResponse(ctx *fasthttp.RequestCtx, status int, key *APIKey, secret string, extra map[string]interface{}) {
	ctx.Response.Header.Set("Cache-Control", "no-store")
	body := map[string]interface{}{"key": viewAPIKey(key), "secret": secret}
	for k, v := range extra {
		body[k] = v
	}
	jsonResponse(ctx, status, body)
}

func handleRotateAPIKeyByID(ctx *fasthttp.RequestCtx, id string) {
	p, ok := authorizeKeyManagement(ctx)
	if !ok {
		return
	}
	var req struct {
		GraceSeconds int `json:"grace_seconds"`
	}
	if !decodeKeyBody(ctx, &req, true) {
		return
	}
	grace := time.Duration(req.GraceSeconds) * time.Second
	if req.GraceSeconds < 0 || grace > apiKeyMaxGrace {
		apiError(ctx, http.StatusBadRequest, "invalid_grace", "grace_seconds must be between 0 and 86400", "", "")
		return
	}
	key, secret, err := dbConn.RotateAPIKeyByID(p.User.ID, id, grace)
	switch {
	case errors.Is(err, ErrAPIKeyNotFound):
		apiError(ctx, http.StatusNotFound, "key_not_found", "no such key", "GET /api/keys lists keys.", "")
		return
	case errors.Is(err, ErrAPIKeyInactive):
		apiError(ctx, http.StatusConflict, "key_not_active", "key is already revoked, rotated or expired", "Create a new key with POST /api/keys.", "")
		return
	case err != nil:
		log.Printf("rotate api key user=%s key=%s: %v", p.User.ID, id, err)
		apiError(ctx, http.StatusInternalServerError, "internal_error", "failed to rotate key", "", "")
		return
	}
	log.Printf("api key rotated user=%s old=%s new=%s grace=%s", p.User.ID, id, key.ID, grace)
	writeSecretResponse(ctx, http.StatusOK, key, secret, map[string]interface{}{
		"rotated_from": id, "old_key_valid_until": time.Now().Add(grace).UTC().Format(time.RFC3339),
	})
}

func handleRevokeAPIKey(ctx *fasthttp.RequestCtx, id string) {
	p, ok := authorizeKeyManagement(ctx)
	if !ok {
		return
	}
	key, err := dbConn.RevokeAPIKey(p.User.ID, id)
	if errors.Is(err, ErrAPIKeyNotFound) {
		apiError(ctx, http.StatusNotFound, "key_not_found", "no such key", "GET /api/keys lists keys.", "")
		return
	}
	if err != nil {
		log.Printf("revoke api key user=%s key=%s: %v", p.User.ID, id, err)
		apiError(ctx, http.StatusInternalServerError, "internal_error", "failed to revoke key", "", "")
		return
	}
	log.Printf("api key revoked user=%s key=%s", p.User.ID, key.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"key": viewAPIKey(key), "revoked": true})
}
