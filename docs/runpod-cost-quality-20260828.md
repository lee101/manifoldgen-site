# RunPod cost and quality policy (2026-08-28)

This is the operating policy for ManifoldGen inference on RunPod. It separates
safe, immediate cost controls from model or hardware changes that need a
quality and latency evaluation.

## Immediate account state

The account audit found seven idle 48 GB Serverless workers across four legacy
H3 and video-restyle endpoints, despite each endpoint already having
`workersMin=0`. All queues were empty. Those four endpoints were capped at
`workersMax=0`, their idle timeout was set to five seconds, and all seven
workers subsequently stopped. At current 48 GB Serverless rates, the avoided
continuous spend is approximately $8.54-$12.25 per hour, or $6.1k-$8.8k per
30-day month.

The cost guard now recognizes both current and legacy ManifoldGen endpoint
names. If an idle worker survives scale-to-zero, it temporarily sets both the
minimum and maximum worker count to zero. It intentionally does not manage
training or customer-owned endpoints.

## Workload routing

| Workload | Current safe lane | Lower-cost candidate | Decision |
| --- | --- | --- | --- |
| H3 video | H100, balanced cache profile | L40S/48 GB | Keep H100 until a matched multi-prompt evaluation passes. Existing runs used different face-refinement settings. |
| H3 ordinary portraits | Turbo 6 steps | — | Use 6 steps only for the already-supported ordinary portrait class; retain 8 steps for action and difficult motion. |
| Wan Animate / restyle | Standard 48 GB Ada | MI300X Pod | Keep the published 48 GB path. MI300X is promising but needs a freshly built, published artifact and a production-shaped canary. |
| Very-low-latency preview | B200/Fast tier | 4-step LightX2V preview | Treat as a preview lane only. It changes the result materially and must not replace the quality lane. |
| Music3 | H100/H200 only while jobs exist | Lowest tier meeting its latency SLO | Keep scale-to-zero. Promote a cheaper GPU only after audio quality and p95 latency evaluation. |
| Matting and light preprocessing | Local/CPU first | Serverless spillover | Do not wake a GPU for work that fits the local lane. |

Existing evidence supports keeping H3's `balanced` cache policy: it reduced the
measured run from 158.4 seconds to 130.7 seconds without moving to the more
aggressive quality-risking profile. It does not support moving production H3
from H100 to L40S yet: the observed runs used different refinement step counts
and are therefore not a valid hardware comparison.

## Promotion gate

Every model, scheduler, precision, cache, step-count, or GPU-routing change
must be evaluated against the current production path before it is enabled:

1. Check account status first. Use a capped one-job run with automatic shutdown;
   never create a standing pool for an experiment.
2. Use a fixed, versioned prompt/seed set covering portraits, multiple people,
   action, hands, occlusion, text, camera motion, and the relevant audio cases.
3. Measure at least three cold and three warm runs per candidate. Record queue
   delay, execution time, model load, generation time, refinement time, retry
   rate, output duration/resolution, and provider cost.
4. For execution-preserving changes, require the existing strict same-seed
   video gate across the whole video: PSNR at least 34 and SSIM at least 0.96,
   including first, middle, and last frames.
5. For changes that deliberately alter the trajectory, use blinded comparison
   for prompt adherence, identity, motion, hands/faces, temporal stability, and
   audio artifacts. A faster but visibly weaker candidate does not pass.
6. Require at least 20% provider-cost reduction unless the change has another
   explicit product benefit. The candidate must also remain inside the tier's
   p95 latency SLO; report p50 and p95 rather than only the best warm run.
7. Recheck status, reset pool limits to zero, cap any experiment endpoint at
   zero, and clean up all direct experiment pods before ending the run.

Cost per successful output is the primary metric:

```text
(GPU seconds * GPU rate / 3600 + storage + transfer) / successful outputs
```

Include cold starts, retries, failed generations, and paid idle time. Quoting
only warm generation time systematically understates production cost.

## Warm-worker rule

Default to `workersMin=0` and a five-second idle timeout. A permanent active
worker is justified only when measured request volume shows that its latency
value exceeds its full hourly active-worker cost. Review that decision weekly,
with an automatic return to zero when traffic falls below the measured
break-even point.

Pricing and billing references:

- <https://www.runpod.io/pricing>
- <https://docs.runpod.io/serverless/endpoints/endpoint-configurations>
- <https://docs.runpod.io/serverless/endpoints/model-caching>

