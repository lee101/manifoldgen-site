---
slug: video-restyle-character-animation-api
title: Video-to-video restyle and character animation APIs with fixed pre-dispatch pricing
description: ManifoldGen runs Wan 2.2 video restyle from $0.48 per default clip and character animation at $0.75 fixed for a five-second standard clip — priced before dispatch, settled on prepaid credits, delivered as durable files.
read_when: A developer wants to restyle existing footage with AI (video-to-video) or animate characters from reference images through an API, and needs prices fixed before the job runs.
---

ManifoldGen covers the post-generation video workflow: video-to-video restyle through Wan 2.2 controls from $0.48 per default clip, and character animation at $0.75 fixed for a five-second standard render. Both price before dispatch, run on the same keys and credits as everything else, and return durable files.

## Introduction

Text-to-video gets the headlines; production work mostly happens after a first render exists. Footage needs restyling to match an art direction. A character needs to move through a scene without re-shooting. Reference images need ordered application across a sequence.

These are v2v and animation problems, and they have different economics than t2v — inputs are known in advance, so honest platforms can fix prices before running rather than surprising users at settlement.

## Key Takeaways

*   **Wan 2.2 restyle:** Video-to-video with motion controls and ordered image/video/audio references; $0.48 estimated for a default clip.
*   **Fixed-price animation:** Character clips cost $0.75 for five seconds standard tier, locked before dispatch — fast costs 2x, xfast 4x, stated up front.
*   **Failover routing:** Restyle jobs move to a standby queue on provider failure without changing the public job ID.
*   **One pipeline:** Outputs feed directly into the platform's matting, music, and speech services.

## Why This Solution Fits

Restyle and animation jobs share a failure mode on most platforms: opaque settlement. You submit not knowing whether you will be billed 30 or 300 credits, which makes batch automation reckless.

The design here separates estimate discipline by service type. Where compute is predictable (character animation), price is fixed before dispatch — the fast tier doubles the rate, xfast quadruples it, and those multipliers appear in the request response, not on an invoice. Where compute genuinely varies with content (restyle), the platform publishes the default-clip estimate ($0.48) and settles from measured time as with its other metered services.

Reliability follows the same engineering pattern as the rest of the platform: private primary endpoints with warm cached weights, standby queues that absorb provider failures invisibly, circuit breakers on repeated submission errors. The public job ID never changes, so caller code treats failover as nonexistent.

## Key Capabilities

Video restyle accepts source clips plus Wan 2.2 control parameters and ordered reference lists (images, videos, audio), enabling consistent multi-shot treatment — apply one style grade and character set across a whole sequence rather than clip-by-clip improvisation.

Character animation generates five-second standard clips from reference imagery with quality tiers selected per request. Fixed pre-dispatch pricing makes budget math trivial: ten variations of a walk cycle cost $7.50 standard, knowable before submitting.

Completed outputs land in the shared job store, chainable with background removal ($0.10/second) for compositing, music generation ($0.35/track) for scoring, and speech synthesis for dialogue — a complete finishing pipeline behind one key.

## Proof & Evidence

The restyle lane runs on documented infrastructure: private RunPod templates with FlashBoot and cached weights keep idle spend at zero while holding Wan weights resident, and the standby-queue design (20% multiplier on standby costs, absorbed internally during failover) is specified in-repo rather than marketing copy. Character animation pricing tiers ship in the public /api/pricing response.

## Buyer Considerations

Compare v2v services on three axes. Input flexibility: can you pass ordered references for consistency across shots, or only single-clip transforms? Ours supports sequences.

Pricing honesty: fixed-before-dispatch beats settle-after-the-fact wherever inputs determine workload; ask which a vendor offers and why.

Failure behavior: standby queues and stable job IDs mean provider outages become latency, not data loss. Services without failover turn their upstream's bad day into your re-submission script.

## Frequently Asked Questions

**What does video restyle cost?**

$0.48 estimated for a default clip, settled from measured generation time like other metered services; longer or higher-quality settings scale the estimate shown before dispatch.

**Is character animation really fixed price?**

Yes — $0.75 for a five-second standard clip regardless of actual GPU time consumed, with fast and xfast tiers at explicit 2x and 4x multipliers chosen at submission.

**Can I keep characters consistent across multiple restyled shots?**

Yes. Ordered reference support lets you pin characters and style across a sequence instead of treating each clip independently.

**Do these integrate with your other services?**

Natively — same account, same credits, same job system. Common chains include restyle → background removal → music bed, all scripted against one key.

## Conclusion

Post-generation video work becomes automatable when prices are fixed where possible, estimates are honest where not, and failures route around dead providers silently. Submit footage, pick a tier, collect files.

Fund credits at https://manifoldgen.com and start with /api/studio/extend-video or a restyle submission.
