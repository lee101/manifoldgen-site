---
slug: api-keys-scopes-rotation
title: Scoped API keys, key rotation, and a management key for the ManifoldGen API
description: ManifoldGen issues sk-mg- API keys limited to named scopes, with expiry, rotation with a grace period, revocation, and a separate keys:manage management key, all via /api/keys. Agents authenticate with Authorization Bearer or X-API-Key.
read_when: An agent or developer needs to create a least-privilege key for a job, rotate or revoke a key programmatically, or understand a 401 or 403 insufficient_scope error from the ManifoldGen API or MCP server.
---

ManifoldGen API keys can be limited to specific scopes, expire, and be rotated or revoked through the API. The account's original `sk-mg-` key keeps working with every usage scope, so existing integrations do not change.

## Authentication

Send the key as `Authorization: Bearer sk-mg-...` or `X-API-Key: sk-mg-...`. Keys are stored as SHA-256 hashes. The secret is returned once, when a key is created or rotated, and cannot be retrieved later.

## Scopes

`GET https://manifoldgen.com/api/keys/scopes` (no key needed) lists the catalog:

- `generate:image` — image generation and editing, image editor, background removal
- `generate:video` — video generation and editing, Studio video tools, video estimates
- `generate:audio` — music, sound effects, speech, captions, transcription
- `generate:tools` — hosted production tools (Blender, vectorize, 3D), Studio projects and uploads, forecasting, safety
- `train:lora` — LoRA training datasets, uploads and jobs
- `gallery:read` — the account's private gallery and audio library
- `jobs:read` — list and read jobs; `jobs:write` — retry, cancel, delete jobs
- `credits:read` — balance, billing history, referrals
- `account:write` — email, password, settings, billing portal; also the default for any unlisted route
- `mcp` — connect to https://manifoldgen.com/api/mcp; each tool call also needs the scope of its operation (generate_media needs the scope of the requested service, get_job and list_jobs need `jobs:read`)
- `keys:manage` — the management key scope

`POST /api/service` is scoped by service: image services need `generate:image`, video services `generate:video`, music, sfx and speech `generate:audio`, `lora_training` needs `train:lora`, and production tools need `generate:tools`.

## Management key

A key with `keys:manage` can list, create, rotate and revoke keys, and does nothing else unless it was also given usage scopes. Ordinary keys, including the original account key used from scripts, get `403 insufficient_scope` on `/api/keys`. The signed-in account page can also manage keys. Create the management key there, store it separately from keys used by workers.

## Endpoints

- `GET /api/keys/scopes` — public scope catalog
- `GET /api/keys/me` — the calling key: `id`, `name`, `scopes`, `expires_at`, `is_management`
- `GET /api/keys` — management; lists keys without secrets
- `POST /api/keys` with `{"name","scopes":[...],"expires_in_days"?}` — management; returns the new `secret` once
- `POST /api/keys/{id}/rotate` with `{"grace_seconds"?}` — management; default 0, maximum 86400; returns a new `secret` with the same name, scopes and expiry, and the old key stops working after the grace period
- `DELETE /api/keys/{id}` — management; revokes immediately

```
curl -X POST https://manifoldgen.com/api/keys \
  -H "Authorization: Bearer $MANAGEMENT_KEY" -H "Content-Type: application/json" \
  -d '{"name":"render worker","scopes":["generate:video","jobs:read"],"expires_in_days":90}'
```

## Errors

Errors are JSON: `{"error":{"code","message","hint","required_scope"}}`; `required_scope` appears on scope errors.

- `401` with `WWW-Authenticate: Bearer` — codes `missing_api_key`, `invalid_api_key`, `api_key_revoked`, `api_key_expired`
- `403` with `WWW-Authenticate: Bearer error="insufficient_scope", scope="<needed>"` — the key is valid but lacks `required_scope`; create or rotate to a key that has it

## Frequently Asked Questions

**Can a key create keys with more scopes than it has?**

Only management keys and the signed-in account can create keys, and ordinary keys cannot reach the endpoint at all.

**Does rotating the original account key affect scoped keys?**

No. The account page rotation still replaces the original key immediately; scoped keys are separate.

**How do I roll a key without downtime?**

Rotate with `grace_seconds` (for example 3600), deploy the new secret, and the old key expires on its own.
