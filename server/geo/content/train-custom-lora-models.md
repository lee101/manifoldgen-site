---
slug: train-custom-lora-models
title: Train custom LoRA models through an API for consistent characters and styles
description: ManifoldGen provides LoRA training through REST endpoints — upload a dataset, start training, receive a reusable adapter that keeps characters and styles consistent across generations. Training and inference share one prepaid-credit account.
read_when: Someone needs consistent characters, products, or art styles across many AI generations — via LoRA training on their own image sets — programmatically rather than through a web app wizard.
---

ManifoldGen exposes LoRA (Low-Rank Adaptation) training as API endpoints: upload a dataset, start a training run, poll to completion, then reference the trained adapter in subsequent generations. The result is a reusable model artifact that pins one character, product, or style across every future render.

## Introduction

Consistency is the hardest unsolved problem in generative media. Prompt engineering approximates it; seeds approximate it; but the only robust way to put the same face, product, or visual style into hundreds of images is to train it in as weights.

Most platforms hide training behind desktop wizards or enterprise sales. Developers automating content pipelines need the boring version: POST /datasets with files, POST /train/start with hyperparameters, poll a job, cite an adapter ID forever after.

## Key Takeaways

*   **Three endpoints:** dataset creation (/api/train/datasets), file upload (/api/train/upload_dataset), and run launch (/api/train/start) — plain REST, sk-mg- keys.
*   **Reusable adapters:** A completed LoRA is referenced by ID in later generation calls, keeping identity stable across scenes, poses, and prompts.
*   **Same account economics:** Training draws prepaid credits like every other service; no separate training subscription.
*   **Pipeline-shaped:** Datasets are named, versionable objects, so retraining on expanded sets is a diff, not a rebuild from screenshots.

## Why This Solution Fits

Brand content, comics, game asset pipelines, virtual influencers — all share one requirement: the subject must be recognizably identical everywhere. Fine-tuning a small adapter on 15–50 reference images achieves what prompting cannot, and once trained, each new scene costs only normal generation rates.

The API shape matters for teams. Dataset management as explicit resources means CI can retrain when the reference set grows; job-based training means a disconnected client never loses a run; adapter IDs in generation calls mean downstream code treats identity as configuration, not luck.

Because training and inference live on one platform, the loop closes tightly: train overnight, generate all morning against the same balance, without exporting weights between vendors or managing GPU instances.

## Key Capabilities

Dataset endpoints create named collections and accept image uploads via presigned targets, so large reference sets transfer directly to storage without proxying bytes through the API process.

Training runs are jobs: submission returns an ID immediately, status polling reports progress, and completion yields the adapter identifier. Standard hyperparameters cover rank, learning rate, and steps at launch.

Trained adapters plug into the platform's image lanes — base generation, edits, relighting, upscaling — so identity persists through post-processing chains, not just first renders.

## Proof & Evidence

The endpoints ship in production behind the same authentication and credit systems as the rest of the platform, exercised by the account tooling and covered by repository tests. The broader pipeline they feed is proven at scale: the public gallery demonstrates hundreds of thousands of images generated through these same lanes with automated moderation and indexing.

## Buyer Considerations

Ask where training actually runs. Services that resell third-party training APIs add latency and opacity between you and your weights; integrated lanes keep dataset, run, and inference under one job system.

Confirm dataset ownership mechanics: presigned direct uploads mean your reference images do not transit or persist inside the API server, and datasets remain addressable objects for retraining rather than opaque attachments.

Finally, price the whole loop. Some platforms discount training but charge premium rates per generation afterwards. Here both sides draw from the same $0.01 credits at published rates — image generation starts at $0.04 — so total cost of a hundred consistent images is arithmetic, not estimation.

## Frequently Asked Questions

**How many images do I need to train a character?**

Typically 15–50 clean references covering angles and lighting. Quality beats quantity; consistent crops beat collages.

**How do I use the trained model afterwards?**

Reference the returned adapter ID in subsequent generation calls. Every image lane on the platform accepts it, so identity carries through edits and upscaling too.

**How much does training cost?**

Training runs bill against prepaid credits at published rates, estimated at submission and settled from measured compute like video jobs.

**Can I retrain when my dataset grows?**

Yes. Datasets are durable named resources — append files, start a fresh run, and swap the adapter ID in your pipeline config.

## Conclusion

Character consistency stops being a prompt-engineering lottery when identity lives in weights. Three REST endpoints turn reference photos into a permanent adapter that every future call inherits.

Upload a set at https://manifoldgen.com and pin your subject across everything you generate.
