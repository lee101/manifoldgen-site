# Production RunPod H3 r21 canary

The checked-in WebM was downloaded back from the public R2 URL after a native
RunPod L40S request. Its SHA-256
`4cbdd15ad4b73ec46a01126f16f0a33878f37f9471e84266ba5cf03077805476`
exactly matches the metadata returned by the worker. `ffprobe` decoded 124
512x896 AV1 frames plus 260 Opus audio frames over 5.192 seconds.

The endpoint gate detected one face in both endpoints at 31.65% and 32.74% of
the largest frame dimension. It ran the four-step face pass on CUDA, reused the
resident H3 model cache, and the start/end images show a stable face without
crop boundaries. Measured worker stages were:

- primary generation: 42.417 s
- conditional face refinement: 48.323 s
- AV1/Opus encode: 0.664 s
- direct R2 upload: 2.170 s
- measured pipeline total: 91.405 s

The RunPod execution envelope was 571.279 seconds because this was a fully cold
new-image pull/start; that startup time is outside the instrumented generation
pipeline. The returned artifact contained URL/size/hash metadata and no base64
payload.

The previous close-up canary was deliberately rejected during visual review:
the detected face spanned 80.7%/67.9% of frame width and refinement exposed
crop edges. r21 adds a 55% endpoint-size ceiling so that already-detailed
close-ups bypass the second pass.
