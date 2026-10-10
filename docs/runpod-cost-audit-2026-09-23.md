# RunPod cost review — 23 September 2026

Read-only API audit at approximately 08:40 UTC, prompted by the YuE2
`idle_worker` alert. No GPU jobs were launched and no production capacity or
storage was deleted.

## YuE2 alert

`omniserve-yue2-quality` (`tmozxvnm9fuuud`) reports one idle/ready worker,
zero queued/in-progress jobs, minimum zero, maximum one, a 20-second idle
timeout, and FlashBoot enabled. The guard deliberately alerts instead of
setting maximum workers to zero: current callers do not restore that maximum.
Disabling this endpoint would therefore break subsequent music requests.

The worker count alone does not establish continuing billed GPU residency.
Today's endpoint bill was $0.07297588, unchanged between the observed checks.
Hourly detail shows 162,878 billed milliseconds at 06:00 ($0.04976828) and
74,437 at 07:00 ($0.02320760): approximately 237 seconds, not two hours of
continuous GPU charges. No 08:00 endpoint rows were returned at inspection;
billing can lag, so this is not proof that later usage is free.

Keep minimum workers zero and automatic flex scaling available. Investigate
an idle worker together with changes in billed time/amount, queue health, and
worker status. Do not suppress the existing warning or disable FlashBoot solely
because the health API continues to list an idle/ready worker. Before enabling
hard idle shutdown, every caller needs tested on-demand capacity restoration
that also respects the daily spend-cap file.

## Account inventory and actual charges

- Live direct pod inventory: empty.
- Current network-volume inventory: one 100 GB Wan Blackwell cache,
  `fb96eh7ozc`, US-CA-2. Preserve it until its contents and recovery path are
  verified.
- Daily serverless billing across all returned endpoints: approximately
  $0.61524. This includes builder usage ($0.07889 plus $0.01379) outside the
  guard's per-endpoint managed/alert list. The source's global total sums all
  returned endpoint billing rows; totals from earlier checks can differ as
  billing arrives.
- YuE2 $0.07298; RA2 $0.31729; Pixal3D $0.09018; Qwen image $0.04211.
- The 06:00–08:00 direct-pod billing query contains approximately $0.87275
  of historical usage despite no direct pods remaining in the live inventory.
- Those hours' storage rows still show 612 GB ordinary plus 100 GB high
  performance storage, totaling approximately $0.07894 per hour. Do not
  extrapolate that retired capacity as the current monthly baseline: reconcile
  later hourly billing against the current 100 GB inventory first.

All inspected endpoints have minimum workers zero. H3 and Music3 managed lanes
have maximum zero; request-time restoration exists for these services. Active
flex endpoint maxima remain bounded (YuE2 one, Pixal3D two, Qwen two, RA2 three).
Qwen image has a 120-second idle timeout; shortening it trades idle billing
against model cold-start latency and should follow measured traffic data.

## Verification

Queried endpoint configuration and queue health, daily and hourly endpoint
billing, hourly direct-pod and storage billing, plus the guard's persisted
state. Existing guard unit tests were run. No inference charge was incurred by
these read-only checks. Account-wide cost enforcement still means endpoint
spend in the current guard: direct-pod and storage spend are inventoried but
are not included in its daily endpoint cap.
