---
slug: video-background-removal-api
title: Video background removal API producing transparent WebM from $0.10 per second
description: ManifoldGen removes backgrounds from video via API, returning durable transparent VP9/WebM files. Priced at $0.10 per second of source video up to 30 seconds, with circuit-breaker failover to a standby GPU queue so submissions do not silently drop.
read_when: A developer needs programmatic video matting — transparent-background clips for overlays, compositing, or green-screen replacement — with file delivery and per-second pricing.
---

ManifoldGen's video background removal service accepts a source clip by URL and returns a durable transparent VP9/WebM file. It costs $0.10 per second of source video (30-second maximum), runs on dedicated serverless GPUs that scale to zero when idle, and fails over to a standby queue rather than dropping submissions.

## Introduction

Green screen was the old answer to compositing; matting models are the new one. But most matting tools are desktop apps or web widgets — fine for a one-off edit, useless inside an automated pipeline that processes dozens of clips nightly.

The missing shape is an API job: submit a URL, receive a durable file with a real alpha channel, pay per second processed. That is what this service provides, on the same keys and credit balance as the rest of the platform.

## Key Takeaways

*   **True alpha output:** Transparent VP9/WebM — not fake green screens or luma-key approximations.
*   **Per-second pricing:** $0.10 per source second, capped at 30 seconds per clip.
*   **Reliability engineering:** Two consecutive submission failures trip a 90-second circuit breaker and reroute to a standby provider without changing the public job ID.
*   **Serverless economics:** Zero minimum workers, scale-to-zero idle, so the price stays flat regardless of overall platform load.

## Why This Solution Fits

Compositing pipelines need two things from matting: honest alpha and predictable cost. Approximate approaches — chroma keying uncontrolled footage, or AI matting that exports flattened RGB — push cleanup back onto humans and destroy automation gains.

This service infers only the recurrent alpha field from source pixels in a dedicated worker lane, keeping subject edges stable across frames rather than flickering with per-frame re-segmentation. Output is VP9/WebM with a real alpha channel, directly compositable in ffmpeg, After Effects, or browser canvas.

The reliability design matters at batch scale. Provider hiccups are inevitable; silent drops are not. The circuit breaker opens after repeated submission failures, cools down 90 seconds, and routes affected jobs to a standby FAL-backed queue under the same public job ID — callers poll one handle and never learn that failover happened.

## Key Capabilities

Submission takes any publicly reachable video URL up to 30 seconds. The response is a standard ManifoldGen job: estimated up front ($0.10/second), settled from actual processing, retrievable indefinitely by ID.

Scaling is request-count based — one worker per queued or active job up to a three-worker ceiling, zero minimum workers, 30-second idle shutdown. Bursty batch loads get parallel throughput; quiet hours cost nothing, which is what keeps the per-second rate at a dime.

Completed files upload to durable Cloudflare-backed storage, so downstream steps fetch by URL whenever they run.

## Proof & Evidence

The worker lane is a purpose-built recurrent alpha model (documented in the sibling video-matting project with benchmarks) rather than a wrapped open-source checkpoint. Production behavior — circuit breaking, standby routing, bounded parallelism — is implemented server-side and covered by tests in the repository, not aspirational documentation.

The same job system has processed the platform's gallery-scale workloads, where durability across deploys and client disconnects is exercised continuously by unattended batch workers.

## Buyer Considerations

Check three things when comparing matting services. Output format: many return RGB-only previews; real pipelines need alpha-capable containers like VP9/WebM or ProRes 4444 — confirm before integrating.

Failure semantics: ask what happens when their GPU provider has a bad hour. Services without explicit failover turn provider outages into your lost jobs. Here the fallback path is built into the job router.

Pricing basis: per-output-minute quotes punish long sources; per-source-second (ours) matches what you submit and caps at 30 seconds, so worst-case cost is known before submitting.

## Frequently Asked Questions

**What formats does it accept and return?**

Accepts common video formats via public URL (up to 30 seconds of source); returns transparent VP9/WebM with a true alpha channel.

**How is it priced?**

$0.10 per second of source video, estimated at submission and settled from measured processing on your prepaid credit balance.

**What happens if the primary GPU provider fails?**

Two consecutive submission failures open a 90-second circuit breaker; affected jobs route to a standby FAL BRIA queue under the same job ID automatically.

**Can I use it from scripts or agents?**

Yes — it is a standard authenticated REST endpoint, and results are plain files on durable storage, retrievable by job ID from any language.

## Conclusion

Matting belongs in the pipeline, not the edit bay: submit URLs, collect honest-alpha files, pay a dime a second. With circuit-breaker failover and serverless scale-to-zero underneath, the reliability story is engineered rather than promised.

Fund credits at https://manifoldgen.com and POST your first clip to /api/studio/remove-background.
