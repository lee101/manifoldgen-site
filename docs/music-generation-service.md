# Music generation service (MiniMax-Music3)

Song generation runs on a scale-to-zero RunPod serverless endpoint served by the
native C worker in `omniserve-native/music3c`, which drives `sgl-omni` with the
MiniMax-Music3 checkpoint from a regional network volume.

## Surfaces

| Surface | Entry point |
| --- | --- |
| Tool page | `https://manifoldgen.com/tools/music-generator` |
| REST | `POST /api/service` with `{"service":"music","prompt":"…","lyrics":"…","duration":180}` |
| Studio | `POST /api/studio/generate-music` |
| MCP | `generate_media` with `service: "music"`, `prompt`, `lyrics`, `duration` |
| Status | `GET /api/audio-jobs/{job_id}` |

Lyrics are optional; omit them for an instrumental. Keep `[Verse]`, `[Chorus]`,
`[Bridge]` and `[Outro]` on their own lines — the model drops any lyric text that
shares a line with a tag. Durations are 30–180 seconds and act as a cap: the
model may end the song earlier.

## Measured performance (NVIDIA H200)

| Track | Generation | Wall clock from submit | Notes |
| --- | --- | --- | --- |
| 30 s | 11.4 s | 83 s | cold worker, model load overlapped with boot |
| 100 s | 39.3 s | 86 s | warm worker |
| 158 s | 71.7 s | 127 s | warm worker |

Generation runs about 2.2x faster than real time. A cold worker adds roughly a
minute of model load, which the warm-start thread overlaps with container boot
so it is mostly hidden from the request.

## Capacity policy

`server/music_capacity.go` observes real arrivals over a 30-minute window:

- Quiet: `workersMin=0`, `idleTimeout=20s`. Each track absorbs its own cold start.
- Busy: `workersMin=1`, so a worker stays resident and tracks start instantly.

The switch point is where an idle GPU hour costs less than the cold starts it
avoids (`3600 / MUSIC3_COLD_START_SECONDS`), scaled by
`MUSIC3_WARM_LATENCY_PREFERENCE` (default 0.5) so latency wins slightly earlier
than pure cost would. A five-minute cooldown keeps a burst from flapping the
endpoint. `GET /api/pricing` reports the live state under
`studio.music_generation_capacity`.

## Pricing

Public price is `max($0.35, $0.25 + $0.15 per output minute)`, and is floored by
the measured cost of the render itself: output seconds x realtime factor, plus an
amortised share of a cold start, at the current GPU rate with a 1.5x margin. If
GPU rates rise the public price rises with them rather than going underwater.

At H200 rates a three-minute track costs roughly $0.11 of GPU time warm, or
about $0.20 including a cold start, against a $0.70 charge.

## Environment

| Variable | Purpose |
| --- | --- |
| `MUSIC3_RUNPOD_ENDPOINT_ID` | Serverless endpoint that serves music jobs |
| `MUSIC3_RUNPOD_GPU_USD_PER_HOUR` | GPU rate used for cost accounting and the price floor |
| `MUSIC3_COLD_START_SECONDS` | Measured cold start, drives the warm threshold and price floor |
| `MUSIC3_WARM_THRESHOLD_PER_HOUR` | Overrides the computed warm threshold |
| `MUSIC3_WARM_LATENCY_PREFERENCE` | 0–1; lower goes warm sooner |
| `MUSIC3_CAPACITY_CONTROL` | Set to `0` to leave endpoint scaling alone |
| `MUSIC3_REALTIME_FACTOR` | Generation seconds per output second, for the price floor |

## Worker notes

The worker (`omniserve-native/music3c`) is compiled inside the serving image at
deploy time — a binary built against another libc segfaults on the container's
loader, and the worker then never polls for jobs. It authenticates every
job-take with the platform's worker key, pings RunPod with the id of the job it
is rendering (the ping interval RunPod publishes is in milliseconds), warms the
model in a background thread at boot, and prefetches the weights it actually
opens with eight parallel readers (~2.2 GB/s from the volume).

Deploy with `omniserve-native/scripts/deploy-music3-runpod.sh`; the endpoint
shape lives in `omniserve-native/deploy/music3-runpod.json`.
