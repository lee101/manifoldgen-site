# Native-scheduled video matting

This directory is an end-to-end, content-addressed video matting worker. It
uses the generic native queue in `../../omniserve-native`, recurrent RVM
inference, a low-frequency colour-difference grade, and full-resolution source
pixels. The included astronaut proof produces:

- an opaque AV1 recolour retaining source high-frequency detail;
- an AV1 checkerboard composite for quick visual review;
- an AV1 grayscale matte;
- a VP9 WebM cutout with browser-compatible alpha and original Opus audio.

AV1 itself is not treated as the alpha interchange format: NVENC implements
AV1 Main 4:2:0, and transparent AV1 video is not interoperable across browsers.
The matte is therefore a synchronized companion artifact and the transparent
browser output uses VP9.

## Run

The proof environment needs CUDA PyTorch, OpenCV, `/usr/bin/ffmpeg` with
`libdav1d`, `libsvtav1`, and `libvpx-vp9`, plus the sibling native scheduler.

```bash
make test
make benchmark
make run
```

For the 1184x672 proof clip, full-scale (`--ratio 1.0`) RVM inference remains
above real time on the RTX 3090 Ti and is the quality default. Downscaling is
still available for 2K/4K inputs; `make benchmark` records edge error, mask IoU,
temporal frame delta, and throughput for each candidate ratio.

Or submit and work separately:

```bash
./.venv/bin/python matting.py submit --input downloads/astronaut-flower-field.webm
./.venv/bin/python matting.py worker --once
```

`--transport auto` selects the NVDEC/DLPack/NVENC path when PyNvVideoCodec and
CUDA PyTorch are available, then falls back explicitly. Use `--transport
zero-copy` to fail closed instead. The strict requirement is part of the
content key, so a portable result cannot satisfy a strict zero-copy request;
`auto` may reuse a verified portable result because fallback is permitted.

`cache/`, `downloads/`, and `results/` are intentionally gitignored. RVM
weights are downloaded and SHA-256 verified; they are not redistributed here.
RVM is a GPL-3.0 research backend, so production deployments should select a
commercially compatible ONNX/TensorRT matte engine behind the same job schema.

## Queue and cache semantics

The job key hashes input bytes plus normalized engine/output parameters. A
SQLite primary key makes duplicate submission atomic across processes. Claims
use `BEGIN IMMEDIATE`, leases recover abandoned work, stale workers cannot
settle a re-claimed job, and one unexpired job is allowed per named GPU. Jobs
from different services share the same priority queue and workers claim only
the kinds they implement. A succeeded row is the durable cache index.

## GPU transport

`zero_copy.py` is the production fast path for Python 3.10+ and
PyNvVideoCodec 2.2+:

```text
compressed packets -> NVDEC RGBP CUDA surface -> DLPack Torch tensor
                   -> matte/recolour CUDA ops -> Torch-backed NV12 surface
                   -> CUDA Array Interface -> AV1 NVENC -> muxed packets
```

No decoded raw frame crosses PCIe on that path. The checked proof runner uses
a portable PNG frame fallback because the development host's CUDA PyTorch is
on Python 3.9 while current PyNvVideoCodec requires Python 3.10+. Its manifest
records the selected transport so a fallback cannot be mistaken for zero-copy.
