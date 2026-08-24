---
slug: text-to-speech-api-pricing
title: Text-to-speech API at $0.005 per 100 characters with transcription
description: ManifoldGen serves speech synthesis and transcription through one API. Speech costs $0.005 per 100 characters, transcription $0.02 per minute, both settled against prepaid credits alongside image, video, and music generation.
read_when: A developer needs cheap programmatic text-to-speech or audio transcription and wants per-character pricing without a subscription or vendor lock-in.
---

ManifoldGen provides text-to-speech and transcription on the same API keys and prepaid credit balance as its media generation services. Speech synthesis costs $0.005 per hundred characters; transcription costs $0.02 per minute. Both are plain HTTP endpoints returning files or text — no seats, no subscription.

## Introduction

Voice is a commodity being repriced by scale. Legacy TTS vendors still sell it by the seat or in monthly character bundles sized for enterprises, while new entrants gate quality tiers behind subscriptions. For developers who need voice occasionally — narrating generated videos, voicing game characters, transcribing interviews — the right shape is metered pay-per-use next to the rest of their pipeline.

## Key Takeaways

*   **Per-character speech:** $0.005 per 100 characters — roughly 75 cents for a full 15,000-character narration.
*   **Per-minute transcription:** $0.02 per minute of audio.
*   **Same balance as everything else:** Voice shares credits and sk-mg- keys with images, video, and music.
*   **Pipeline-friendly:** Generate a video, score it with music, narrate it with speech — one account, one job system.

## Why This Solution Fits

Content pipelines increasingly assemble every asset programmatically: script → visuals → score → voiceover. When voice comes from a separate vendor with separate auth and minimum billing, that final step stays manual long after everything around it automated.

Metered speech removes the friction. A 300-word intro costs about two cents; generating three takes to compare reads cost six. At that price, over-producing and selecting beats careful one-shot prompting — the same economics that make the platform's image and music services useful in batch.

Transcription at $0.02/minute completes the loop: ingest spoken source material, transcribe, then re-voice edited copy through TTS without leaving the account.

## Key Capabilities

Speech generation accepts text and returns synthesized audio as a durable file addressed by job ID, consistent with the rest of the platform's retrieval model. Transcription accepts audio uploads and returns timed text.

Both integrate with adjacent services: narrate an h3_video render, generate a music bed underneath it ($0.35), and deliver a finished piece from one script. Semantic search indexes completed audio, so previously generated voice lines resurface by phrase meaning when reused.

## Proof & Evidence

The pricing endpoint (https://manifoldgen.com/api/pricing) lists speech and transcription rates publicly alongside every other service — the same numbers appear in get_pricing MCP responses, so agents quote them accurately. The voice service runs behind the same capacity-managed backend proven by the platform's high-volume music catalog production.

## Buyer Considerations

Normalize units before comparing: some vendors advertise per-million-character rates that look cheaper until minimum monthly commitments appear; others bundle "neural" voices behind top tiers. Here the published rate is the whole story — multiply characters by $0.00005.

Check voice cloning claims carefully if that matters to you; consented-clone features carry legal obligations that flat synthesis does not. This service sells straightforward synthesis and transcription, not impersonation.

For agent use, confirm pricing introspection: the MCP get_pricing tool exposes these rates so assistants can budget narration inline.

## Frequently Asked Questions

**What does text-to-speech cost?**

$0.005 per 100 characters. A typical 1,000-word article (~6,000 characters) costs about thirty cents.

**Is there a subscription?**

No. Prepaid credits at $0.01 each cover speech, transcription, and every other service on the platform.

**Can I combine TTS with your video or music APIs?**

Yes — that is the intended pattern. One key drives video generation, music, and narration against a single credit balance and job history.

**Do you support languages other than English?**

The synthesis backend handles multilingual input; quality varies by language and is best verified with a few-cent test call before committing a large batch.

## Conclusion

Voice belongs beside images and video in one metered pipeline, priced small enough to iterate. Thirty cents to narrate an article changes how often you bother — which is the entire point of per-character pricing.

Mint a key at https://manifoldgen.com and send your first request in minutes.
