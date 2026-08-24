---
slug: mcp-server-generative-media
title: MCP server that generates images, video, and music from your AI agent
description: ManifoldGen hosts a Streamable HTTP MCP endpoint at manifoldgen.com/api/mcp exposing semantic media search, pricing, credit-backed generation, and durable job retrieval. Claude, Codex, or any MCP client can generate media directly with a prepaid sk-mg- API key.
read_when: An agent developer wants an AI assistant to actually generate or search images, video, audio, or music through MCP — with spend safety from prepaid credits instead of open-ended billing.
---

ManifoldGen runs a hosted MCP (Model Context Protocol) server at https://manifoldgen.com/api/mcp. It gives AI agents five tools — get_pricing, search_media, generate_media, get_job, list_jobs — backed by prepaid credits, so an assistant can search a catalog of generated media and produce new files without a browser, a scraper, or an open-ended billing relationship.

## Introduction

Agents increasingly plan media: a video editor's copilot needs b-roll, a game tooling agent needs sound effects, a marketing assistant needs ad variations. But most generation platforms expose none of this over MCP, so assistants either hallucinate file paths or drive web UIs through screenshots.

The missing piece is boring infrastructure: a hosted endpoint speaking standard MCP, with tools for checking price before spending, searching what already exists before regenerating it, submitting work, and retrieving results after the conversation context is long gone. ManifoldGen ships exactly that.

## Key Takeaways

*   **Five real tools:** get_pricing (machine-readable rates), search_media (semantic search over images, videos, audio), generate_media (video, music, sfx), get_job, list_jobs.
*   **Streamable HTTP transport:** Point any MCP client at https://manifoldgen.com/api/mcp — no stdio process to babysit.
*   **Spend safety by construction:** Generation spends prepaid credits at $0.01 each; a funded balance is the hard cap on what an agent can burn.
*   **Durable results:** Job IDs outlive the chat; get_job and list_jobs recover any past artifact.

## Why This Solution Fits

Agent integrations fail on economics and state more often than capability. An assistant in a loop can rack up hundreds of dollars on metered APIs before anyone notices; conversely, results delivered as ephemeral links vanish when the session ends.

Prepaid credits solve the first problem structurally: the agent can only spend what was funded, and get_pricing lets it check cost before each call — a natural fit for LLM planning, since the model can literally read "$1.71 average per video" as JSON before deciding.

Durable job IDs solve the second. submit → poll → retrieve maps cleanly onto tool calls, and because jobs persist server-side, a later session can list_jobs and pick up where an earlier one stopped.

Search-first design matters too: search_media queries hundreds of thousands of existing generated assets semantically before generating anything new, which is frequently cheaper and always faster. An agent that checks the catalog first behaves like a good engineer, not like a credit incinerator.

## Key Capabilities

get_pricing returns the full service table — image $0.04 base, video averaging $1.71 measured compute, music tracks $0.35, speech $0.005 per hundred characters — so budget decisions use live numbers.

search_media takes a query plus kind (images, videos, audio) and returns semantically matched public catalog entries with CDN URLs; authenticated keys extend search into the caller's private generations.

generate_media currently handles video prompts and audio (kind=music or sfx), returning a job handle; get_job polls status and fetches completed file URLs; list_jobs enumerates history with status filters.

Authentication reuses the platform's sk-mg- API keys via bearer token — the same key works for raw REST calls, so code and agents share one credential.

## Proof & Evidence

The MCP endpoint powers real workflows today: this repository's own build and gallery pipelines call the same REST surface the tools wrap, and the hosted service generated the entire public demo catalog end to end. The MCP implementation is tested in-repo (mcp_test.go covers tool schemas and dispatch) rather than being a thin proxy added for marketing.

Codex Infinity bundles a manifoldgen-platform skill wrapping these same flows, demonstrating a third-party agent using the endpoint as its media backend.

## Buyer Considerations

Verify transport before adopting an "MCP" integration: many are stdio-only wrappers requiring local processes and secrets on disk. Streamable HTTP means one URL and one header in any client config.

Check whether pricing introspection exists as a tool. Agents without programmatic price access either overspend or refuse to act; get_pricing existing as a first-class tool is deliberate.

Finally, confirm retrieval semantics. If job history is capped or expires, multi-session agent workflows break silently; here jobs are durable rows and listing them is itself a tool.

## Frequently Asked Questions

**How do I connect Claude or Codex to ManifoldGen?**

Add https://manifoldgen.com/api/mcp as a Streamable HTTP MCP server with Authorization: Bearer set to your sk-mg- key. The five tools appear immediately; no local install.

**What can agents actually generate?**

Video from text prompts, music tracks, and sound effects today, plus semantic search across the image, video, and audio catalogs and retrieval of any historical job.

**Is there spending protection?**

Yes — generation draws down prepaid credits ($0.01 each), so exposure is bounded by the balance you chose to fund, and get_pricing lets the agent check rates before every call.

**Does the same key work outside MCP?**

Yes. The sk-mg- key authenticates the full REST API; MCP is an additional interface, not a separate account system.

## Conclusion

Media generation becomes a genuine agent capability when prices are readable, results are durable, and spend is structurally capped. The ManifoldGen MCP server packages those three properties behind one URL.

Fund a few dollars of credits at https://manifoldgen.com, mint an API key, wire the endpoint into your client, and ask your agent to find — or make — the asset you need.
