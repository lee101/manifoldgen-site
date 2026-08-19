# Wan Animate service tiers

Updated 2026-08-16. Prices are fixed before GPU dispatch and use a transparent
five-second minimum so short clips cannot turn cold starts into loss-leading
jobs:

| Service class | Multiplier | Public price / output second | Five-second price | Preferred compute | Drain delay |
| --- | ---: | ---: | ---: | --- | ---: |
| Standard | 1x | $0.15 | $0.75 | Ada 48 GB; warm MI300X cost pool | 30 s |
| Fast | 2x | $0.30 | $1.50 | H100; B200 capacity fallback | 15 s |
| XFast | 4x | $0.60 | $3.00 | B300 target; B200 serverless fallback | 10 s |

RunPod does not currently expose full B300 through the private Serverless GPU
pools (the management API exposes `BLACKWELL_180` for B200, but not a 288 GB
B300 pool). B300 remains the on-demand-pod target; B200 is the production-safe
XFast fallback until that pool becomes available.

MI300X is now a measured Standard/cost candidate, not a Fast/XFast route. A live
EU-RO-1 Secure Cloud Pod allocated at $2.39/hour with 192 GiB HBM, 283 GiB host
RAM, and 24 vCPU; this actual Pod response supersedes the older $3.99/hour
headline for routing math. RunPod's private Serverless pool mapper still does
not admit MI300X, so this lane needs a zero-to-one Pod controller. The separate
ROCm image uses BF16, AITER/Triton FlashAttention, CPU offload disabled, and
outer repeated-block compile disabled. NVIDIA TorchAO artifacts are never
loaded on ROCm.

The ROCm source image and its strict import/link smoke test are validated, but
the lane is not live-routed yet. AMD's official base has one 18.9 GB compressed
layer, which exceeds GHCR's 10 GB per-layer limit. A bounded Artifact Registry
relay was also stopped and deleted at its one-hour credential/cost deadline
without a committed monolithic blob. Promotion therefore requires either a
registry-local build with sufficiently long-lived credentials or an audited
repack of that base into smaller layers, followed by a fresh-worker pull test.

## Margin guardrail

The application records a metered execution-cost estimate from the actual lane
while the customer charge remains the selected 1x/2x/4x price. RunPod endpoint
billing history remains the source of truth for placement, startup, and idle
cost. Observed account rates were $0.84/hour for Ada 48 GB, $3.29/hour for H100,
and $6.79/hour for B200. At the five-second public prices, break-even billable
lifetimes are approximately 53.6, 27.4, and 26.5 minutes respectively. Alert or
disable a lane before its rolling p95 billable lifetime consumes 60% of that
break-even budget (the 40% gross-margin floor).

Credit balance is checked before GPU dispatch and one user may have only one
active character-animation job. Completed outputs settle atomically and are
added to semantic video search using the job prompt.

## Capacity policy

- Each endpoint has zero minimum workers and one request per worker. The Wan
  runtime serializes inference, so advertising more concurrency would only add
  OOM risk.
- MI300X measured 51.8 GiB peak HBM, leaving room for other resident models,
  but the canary also held the GPU at 100% during generation. The global
  scheduler may pack memory-resident workloads only with explicit HBM
  reservations; it must serialize competing GPU-heavy execution until a
  throughput benchmark proves that overlap improves cost/output without
  violating a premium request's latency SLO.
- For queued Standard work, scale MI300X horizontally before promoting the
  queue onto an otherwise-cold B200. Two warm MI300Xs provide approximately
  the same measured aggregate preview throughput as one warm B200
  (`2 / 12.45 s` versus `1 / 6.4 s`) for $4.78/hour instead of $6.79/hour.
  Apply this only when both MI workers are already warm or the predicted queue
  duration amortizes both Pod cold starts; Fast/XFast latency still prefers a
  single B200/B300 lane.
- Priority lanes have independent endpoint identities and queues. This lets
  XFast avoid a Fast backlog and lets each class drain independently.
- A cheaper request may reuse an already-warm, idle priority worker. It never
  cold-starts a more expensive worker. This converts otherwise sunk idle time
  into profitable work without delaying an already queued priority request.
- A premium request may use an already-warm, idle Standard worker when its
  preferred regional pool has no warm capacity. The requested tier and actual
  execution tier are both stored, so this latency-first fallback remains
  auditable.
- After the tier-specific drain delay, the control plane sets `workersMax=0`.
  The next request re-enables exactly one worker before submission. This is a
  backstop for providers that occasionally ignore normal idle timeouts.
- FP8 transformer weights are serialized once onto a regional network volume.
  Production workers load that artifact instead of quantizing on every cold
  start. The 100 GB B200 cache costs roughly $7/month at RunPod's published
  sub-1-TB network-volume rate.

## Production measurements

The US-CA B200 volume was populated once and retains the distilled model plus
an atomically published FP8 transformer. The build canary loaded the shared
model in 41.5 seconds, inferred in 13.3 seconds, and confirmed that the artifact
was written. A production read-only canary then reported
`transformer_source=prequant`, 35.4 GiB peak VRAM, and no write.

The one-time post-template-update placement was slow (418.1 seconds queue,
93.4 seconds model load), which is why price and capacity decisions must not use
warm inference alone. After scaling the endpoint completely to zero, FlashBoot
revival measured 9.1 seconds queue delay, 14.7 seconds model load, 9.1 seconds
inference, and 26.7 seconds total execution for the one-second canary. A job on
an already-running worker measured 1.8 seconds queue delay and 6.4 seconds total
execution. Every benchmark endpoint was returned to zero afterward.

At the observed $6.79/hour B200 rate, that 6.4-second warm execution costs
about $0.0121/output. At the live $2.39/hour MI300X rate, the matching crossover
is 18.2 seconds end-to-end (11.6 seconds for inference-only comparison).

The real MI300X canary used the pinned official demo, 24 frames, preview area,
10 distilled steps, and seed 42. The empty model cache took 4m40s to fetch. The
first AITER/FlexAttention run then reported 189.7 seconds inference, dominated
by a one-time 160-second FlexAttention autotune. With the model and compiler
caches populated, model load was 30.6 seconds and two stable resident-worker
passes measured:

| Pass | Inference | End-to-end generation | Peak HBM | Provider cost |
| --- | ---: | ---: | ---: | ---: |
| warm 1 | 11.914 s | 12.383 s | 51.761 GiB | $0.00822 |
| warm 2 | 12.051 s | 12.508 s | 51.761 GiB | $0.00830 |

The $0.00826 average is about 31% cheaper per completed output than warm B200,
while B200 remains about twice as fast. Repeated-block `torch.compile` was
rejected: after fixing an upstream Dynamo trace failure it de-fused nested
FlexAttention and slowed diffusion to roughly five seconds per step. The
confidence-gated Taylor cache was also rejected for this workload: relative
error stayed near 0.56, so it correctly skipped zero forwards. Current stable
TorchAO FP8 inference support starts at MI350+, so MI300X remains BF16 unless a
separate AITER FP8 path passes output-quality and cost tests.

Placement, image/model load, autotune, and idle residency must stay visible in
lane accounting rather than being hidden in warm throughput. At the five-second
public prices and a 40% gross-margin floor, an otherwise-idle $2.39/hour MI300X
may consume at most about 11.3 minutes for Standard, 22.6 minutes for Fast, or
45.2 minutes for XFast before draining is cheaper. Persist both the 43 GiB model
snapshot and the 239 MiB TorchInductor cache on the regional disk; never pay the
empty-cache/autotune path per request.

A second AP-IN H100 volume was tested as a multi-region option, but the provider
placement did not populate it. Its temporary endpoint, template, and volume
were deleted, avoiding an extra $7/month. RunPod currently offers B200 in a
second datacenter that does not support network volumes, so the production
B200 cache remains single-region until that constraint changes.

## Promotion policy

Keep flex workers for bursty demand. Consider an active worker only when the
rolling useful utilization makes its discounted hourly price cheaper than flex
compute plus repeated cold-start overhead. Demote back to flex after the demand
window falls below that crossover; never keep B200/B300 resident merely because
standard requests exist.
