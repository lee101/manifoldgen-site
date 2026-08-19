# GPU scheduler efficiency validation — 2026-08-16

## Production finding

The shared OmniServe RunPod endpoint had no queued or running jobs but reported
three ready/idle workers. It was configured with `workersMin=0`,
`workersMax=3`, and a five-second idle timeout; RunPod had not honored the
implicit scale-down.

The endpoint was explicitly set to `workersMax=0` after an empty-queue check.
It subsequently reported zero ready, idle, initializing, running, throttled,
and unhealthy workers.

At the application's conservative mixed-48-GB cost ceiling of $1.908/GPU-hour,
three unnecessary workers represent up to $5.724/hour, $137.376/day, or
$4,121.28 per 30-day month. Actual avoided billing depends on the GPUs RunPod
placed and how long the workers had remained live.

## Changes

- Background-removal spillover now activates its paused RunPod endpoint before
  queueing, tolerates transient `ENDPOINT_PAUSED` propagation, and always
  attaches a scale-to-zero reaper after control-plane activation.
- RunPod scale coordination is per endpoint. A draining H3 endpoint no longer
  holds a global mutex that can block Anima, character animation, image, or
  background-removal submissions for up to 30 seconds.
- Reapers use generation tracking so a new job cannot be orphaned by a stale
  reaper. Drain completion requires both zero workers and an empty queue.
- The OmniServe deployment manifest is paused at rest (`workersMax=0`). The
  application owns the workload-specific active maximum (three for background
  spillover by default).
- OmniServe obtains global VRAM admission before importing a workload plugin;
  CUDA preload therefore cannot run before admission. Repeated OOMs descend
  the complete throughput → balanced → small profile frontier, unloading
  resident engines between attempts.

## Verification

- Full ManifoldGen Go suite: pass.
- Go race detector: pass.
- Mock RunPod activation: paused endpoint, transient conflict, and retry pass.
- Endpoint isolation: a held lock for one endpoint does not prevent another
  endpoint from acquiring its lock within the 100 ms regression bound.
- Full OmniServe C and Python suite: 17 pass.
- Focused scheduler/runtime suite: 8 pass, including two-step OOM fallback and
  broker denial before plugin import.
- Production endpoint after drain: zero jobs and zero workers.

## Production canary

Immutable image `ghcr.io/lee101/omniserve-native:cac23d3509a47389`
(`sha256:c3d1098a0f3a12773bda56589b9dbbd57022aa53064091226519557705c9944b`)
was promoted to the existing template. Its build now reuses the pinned GHCR
base for the native stage, pins the mutually compatible Diffusers,
Transformers, and Hugging Face Hub versions, and fails the image build if the
Wan pipeline imports do not resolve.

A real scale-from-zero video-matting canary on the promoted image completed
successfully:

- exactly one worker initialized under a one-worker canary cap;
- first-image cold delay: 179.895 seconds;
- execution: 23.521 seconds for 5.192 seconds / 124 frames of 1184×672 input;
- RVM inference: 26.79 fps; complete decode/matte/VP9 pipeline: 10.75 fps;
- VP9 alpha plane validated with `libvpx-vp9`; zero OOM retries;
- endpoint returned to zero queued/running jobs and zero workers after the
  explicit max-zero update.

At the endpoint's current allowed GPU classes, the canary's conservative
provider upper bound is about $0.099 (203.416 seconds at the $1.75/hour 48 GB
PRO flex rate). Production settles the 5.192-second output at $0.5192, leaving
about 81% gross compute margin even on a first pull. Provider-cost settlement
now includes RunPod `delayTime` and defaults to the high allowed 48 GB rate;
previous telemetry counted execution only at a stale $0.69/hour fallback.

The cold delay includes the first pull of a 10.2 GB shared CUDA/H3/Wan image.
That is acceptable for background removal only as a spillover lane because the
site prefers its local/standby path. If spillover becomes latency-sensitive,
the measured Pareto improvement is a separate lean matting template; keeping a
warm worker would erase the cost saving established above.

RunPod's endpoint response also exposes `workersStandby`, but it is not in the
documented writable endpoint schema and live REST writes reject it. Worker
health—not this read-only telemetry field—is used for the zero-worker
assertion.

The cost change is scale-to-zero policy, not an inference-quality change; model
weights, sampling settings, and output codecs are unchanged.
