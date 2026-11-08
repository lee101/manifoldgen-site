# Upscaler performance ideas

Scope: native Real-ESRGAN lane (`omniserve-native` `POST /v1/images/upscales`, sd.cpp ggml ESRGAN) plus the manifoldgen/netwrck/homesy callers. Goal: more images per GPU-second with no quality loss. Measured on the local RTX 3090 Ti (shared with another tenant, so medians are noisy; min is the cleaner signal). Accuracy is PSNR against PyTorch (spandrel, cu128) on the same input.

## Results so far

GPU ms is `X-Upscale-Ms`, min over interleaved A/B runs of the same build with env toggles. Wall ms is request to last byte (PNG out, WebP for the 4x row marked webp), min over 6 runs.

| case | GPU before | GPU now | wall before | wall now | wall speedup |
| --- | --- | --- | --- | --- | --- |
| 512 -> 1024 (x2plus) | 404 | 154 | 708 | 190 | 3.7x |
| 1344x768 -> 2688x1536 (x2plus) | 1538 | 563 | 2714 | 762 | 3.6x |
| 512 -> 2048 (x4plus), png | 1515 | 526 | 2538 | 782 | 3.2x |
| 512 -> 2048 (x4plus), webp | - | - | 2696 | 804 | 3.4x |
| 512 -> 1024 anime (x4plus_anime_6B + box) | 588 | 229 | 816 | 264 | 3.1x |

Per step, GPU min ms (512 / 1344 / 4x):

| step | 512 | 1344 | 4x |
| --- | --- | --- | --- |
| im2col (old) | 404 | 1538 | 1515 |
| + cuDNN direct conv, f32 acc | 197-250 | 755-982 | 673-982 |
| + in-place dense concat | 167-175 | 740-809 | 699-795 |
| + fused bias/leaky/residual epilogue | 154-164 | 563-743 | 526-704 |

The ranges come from the other tenant's load drifting between pairs; each step was measured against its predecessor in the same interleaved run.

PSNR vs PyTorch (512 / 1344 / 4x): baseline 54.1 / 50.9 / 52.1 dB, now 60.2 / 57.3 / 57.7 dB. Concat and fusion are numerically identical to plain cuDNN. The new path is closer to the reference, not further. Output PNGs are also 30% smaller (libdeflate).

## Done

- [x] **cuDNN conv for ESRGAN.** ggml-sd already had an optional dlopen'd cuDNN path for `GGML_OP_CONV_2D` (direct conv), but the upscaler created its context with `direct=false`, so every 3x3 conv went through im2col (67-79% of GPU time). `backend_upscale.c` now probes `libcudnn.so.9` (or `GGML_CUDA_CUDNN_LIB`) at load. If it loads, it sets `GGML_CUDA_CUDNN_CONV=1` and `GGML_CUDA_CUDNN_CONV_F32ACC=1` and creates the nets with direct conv. If not, it stays on im2col, because ggml's own direct kernel is slower than im2col. Result: 2.1-2.6x GPU, and +6 dB closer to PyTorch (f32 accumulate beats im2col's f16 GEMM path). f16 accumulate was the same speed and less accurate, so f32acc is the default. `OMNISERVE_NATIVE_ESRGAN_CUDNN=0` turns it off.
- [x] **PNG encode via libdeflate.** stb_image_write took 850-1260 ms for a 4 MP PNG, about 40% of wall time on a 2x 1344x768 job. `liboencode.so` (already in the repo: libdeflate, threaded filters) is now dlopened next to the binary: 120-150 ms at level 1, and files 30% smaller (5.4 MB vs 7.8 MB). stb remains the fallback. Env: `OMNISERVE_NATIVE_UPSCALE_PNG_LEVEL` (1), `OMNISERVE_NATIVE_UPSCALE_ENCODE_THREADS` (4).
- [x] **WebP encode (4x outputs).** `WebPEncodeRGB` is method 4, single-threaded (~520 ms at 4 MP). Now oencode at method 2, q94: 135 ms, +0.47 dB, +27% bytes vs m4 q92 (275 ms threaded). Env: `OMNISERVE_NATIVE_UPSCALE_WEBP_METHOD` (2), `OMNISERVE_NATIVE_UPSCALE_WEBP_QUALITY` (94).
- [x] **In-place dense concat (sd.cpp `esrgan.hpp`).** Each RRDB dense block did 4 `ggml_concat` calls, re-copying the growing tensor (576 channel-planes read and written per block). Now: one `ggml_pad` to 192 channels, each conv output appended with `ggml_set_inplace`, and conv inputs are zero-copy channel-prefix views (batch 1, so a prefix is contiguous in WHCN). Output is bit-identical.
- [x] **Fused conv epilogue (ggml-cuda).** `ggml_cuda_try_fuse` matches `CONV_2D [-> RESHAPE] -> ADD(bias)`, followed by either `LEAKY_RELU` or `SCALE -> ADD(residual)`. The cuDNN f16 output is converted, biased, leaky-relu'd, scaled and residual-added in one kernel instead of up to 5. It returns false before launching anything when cuDNN is off, so the unfused path runs unchanged. `GGML_CUDA_DISABLE_FUSION=1` disables it. 6-11% on top of the concat change.

## Profile after cuDNN (1344x768 -> 2x, nsys, before concat/fusion)

| share | kernel |
| --- | --- |
| 26% | actual conv GEMMs (cutlass / xmma implicit GEMM, f16 in, f32 acc) |
| 23% | `convert_unary` f32->f16 (conv inputs) and f16->f32 (outputs) |
| 16% | cuDNN `nchwToNhwc` / `nhwcToNchw` transforms |
| 17% | `concat_cont` (dense block) -> addressed |
| 10% | `k_bin_bcast` add (bias + residual) -> bias part addressed |
| 7% | leaky relu, scale -> leaky part addressed |

The conv math itself is about a quarter of the time. The rest is layout and precision traffic, so the remaining big wins are memory-layout work, not faster GEMMs.

## Next (ranked by gain/effort)

- [ ] **NHWC f16 activations end to end** (est. 1.5-1.8x more GPU). Run the ESRGAN graph in CWHN (ggml's `cwhn` conv flag) with f16 tensors, give cuDNN NHWC descriptors, and use `cudnnSetTensor4dDescriptorEx` strides so channel-prefix views of the dense buffer stay zero-copy. This removes the 23% convert and 16% transform traffic. Needs a CUDA `cwhn` branch in `conv2d.cu` (currently asserted off) and f16 support for pad/set/add/scale/upscale in the ESRGAN graph.
- [x] **Fuse the residual into conv5's epilogue.** Done as part of the fused epilogue above. The RRDB-level `scale + add` (not after a conv) is still separate, at ~1%.
- [ ] **Skip repeated filter transforms** (est. 2-4%). cuDNN runs `nchwToNhwc` on the f16 weights every call. Pre-transform weights once at load (KRSC) and pass an NHWC filter descriptor.
- [ ] **Convert the dense buffer to f16 once** (est. 5-10%, superseded by NHWC f16). Each conv re-converts its whole 64-192 channel prefix to f16. Keep an f16 mirror and convert only the newly appended 32 channels.
- [x] **VRAM model for direct conv.** Done (see Prod). Previously, lease sizing assumed 1700 B per output pixel (the im2col buffer). Measured with cuDNN (after concat/fusion; the peak is set by the full-res upsample convs, so concat barely moves it): ~950 B/px (x2plus) and ~1440 B/px (x4plus), vs ~1530 / 1660 with im2col. Dropping to ~1500 B/px raises the untiled limit and frees lease headroom for concurrent diffusion. A small change, but it needs a check on the 5090 first.
- [ ] **Tile overlap.** sd.cpp overlaps tiles 25%. When tiling is forced (VRAM-limited), 1/8 overlap with feathering cuts redundant work ~25% (needs a PSNR check at seams). On the 5090 at 8 GB budget most requests run untiled, so this matters little in prod.
- [ ] **CUDA graphs.** Disabled for the upscale process (they pinned per-net VRAM; see Prod). Re-enable only with a graph-memory trim, and only if launch overhead becomes a measurable share.
- [ ] **TensorRT engine for RRDBNet** (est. 2-3x over cuDNN eager; known from Real-ESRGAN TRT ports). It brings a TRT runtime dependency, per-GPU engine builds and dynamic-shape profiles. Only worth it if upscale volume becomes a real GPU cost.
- [ ] **FP8 conv on the 5090** (Blackwell). cuDNN supports FP8 fprop. It needs a per-layer quality check because ESRGAN is sensitive near highlights. Not planned unless the GPU is saturated.

## Not worth it / rejected

- Smaller nets (realesr-general-x4v3, SRVGGNetCompact): ~10x faster but visibly softer. That is a quality loss, so it would only be acceptable as a separate cheaper "fast" tier.
- f16 accumulate in cuDNN: no speed gain on the 3090 Ti (memory-bound), less accurate.
- Batching concurrent requests: same-size requests are rare, and the GPU is already busy end to end on one image.
- Moving encode out of the GPU lock: already outside (`backend_upscale.c` encodes after unlocking), so the next request's GPU work overlaps the previous encode.

## Verification

- `omniserve-native` `onative_tests` (core) pass; `tests/test_upscale_route.py` with GPU and all three nets passes (2x/4x, odd-size alpha, jpeg/webp, anime, 413, SSRF).
- PSNR vs PyTorch as above, on every step.

## Prod (2026-11-08)

Live in the single prod gateway, `omniserve-native.service` on `127.0.0.1:8791`. It shares the tier scheduler and VRAM ledger with Z-Image, the LLM and the other lanes. The binary is `omniserve-native-deploy/deploy-prod-20261108-upscale/` (built from the same `build-z` config as `20261104-permits`, 37c5583 main, plus upscale) and sits beside `liboencode.so`. The drop-in is `omniserve-native.service.d/zzzzzzzzzzzzzzzzzzz-upscale-20261108.conf`; to roll back, remove it, daemon-reload and restart.

The upscaler loads its own sd.cpp library, `sd-20261108-upscale-own` (`OMNISERVE_NATIVE_ESRGAN_SD_LIB`), built with `GGML_CUDA_GRAPHS=OFF` and `-DGGML_CUDA_CUDNN_F32ACC_DEFAULT`. The Z-Image library (`sd-20261102-pass2`), its f16-accumulate cuDNN VAE convs and its CUDA graphs are unchanged. Both libraries share the pinned cuDNN 9.10.2 the gateway already used. Weights are in `/nvme0n1-disk/models/omniserve-native/esrgan/`, with `ESRGAN_VRAM_MB=3500`. The pre-change sd sources are in `sd-src-backup-20261108/pre-upscale.tgz`. `libdeflate-dev` and `libwebp-dev` were installed for the oencode build.

Post-switch checks on 8791:
- Z-Image generation: 200, normal output.
- 2x/4x upscales from https URLs: 200, 0.4-2.5 s GPU.
- Gateway VRAM: 15.1 GB, unchanged from before.

Callers already default to 8791:
- netwrck `/api/upscale` (and ebank.nz's editor, which calls ebank.nz `/api/upscale` on the same server) uses the native path with no config change.
- ManifoldGen needs `server/image_upscale.go` deployed (branch `native-image-upscale`).

Prod QA on real frames (two robot-run video frames, a low-res showcase frame, an anime illustration, and a portrait), vs PyTorch fp32 on the same GPU. The in-gateway canary matched within 1-6 levels:

| frame | old im2col | cuDNN | GPU ms old -> new |
| --- | --- | --- | --- |
| anime-rain 1024x768 2x | 55.8 dB | 61.0 dB | 2293 -> 1149 |
| celestial 768x1024 2x | 59.1 dB | 63.6 dB | 2331 -> 1114 |
| robotrun-a 544x960 2x | 54.1 dB | 58.6 dB | 852 -> 400 |
| robotrun-b 544x960 2x | 52.8 dB | 57.0 dB | 867 -> 259 |
| robotrun-a 4x | 54.2 dB | 57.2 dB | 5816 -> 1693 |
| e2e-source 320x182 2x | 58.8 dB | 64.2 dB | 113 -> 172 (tiny image, plan setup dominates) |

Side-by-side crops of old, new and PyTorch are visually identical (max per-pixel difference old vs new 1-4 levels).

Two issues found and fixed on prod:
- **Lease sizing.** Leases were sized with the im2col constant (1700 B/out px). A 768x1024 2x asked for 5.6 GB, which exceeds the broker's 4096 MB cap, so it 503'd. With cuDNN the sizing now uses measured costs plus margin (x2plus 1100, x4 nets 1650 B/px; `out_px_bytes` in `backend_upscale.c`).
- **Resident VRAM growth** (664 MiB idle -> 3.7 GB after three jobs, permanently). Two causes. (1) The cuDNN scratch (f16 in/out copies, workspace) came from ggml's grow-only pool; it now uses `cudaMallocAsync`/`cudaFreeAsync`, which hands memory back at stream sync, and falls back to the pool during graph capture. (2) ggml CUDA graphs captured the repeated tile graphs and kept per-net graph memory. The upscaler library is built without CUDA graphs, at no measured speed cost for this workload. Result: residency stays flat at ~590 MiB across 2x/4x/anime/concurrent jobs.

## Deploy notes

- The cuDNN path needs `libcudnn.so.9` on prod (pip `nvidia-cudnn-cu12` 9.x is enough). Set `GGML_CUDA_CUDNN_LIB=/path/to/libcudnn.so.9`; the sibling `libcudnn_*.so.9` libraries resolve from the same directory without `LD_LIBRARY_PATH` (verified locally). Without it the lane still works on im2col.
- `liboencode.so` must sit next to `omniserve-native` (or set `OMNISERVE_NATIVE_OENCODE_LIB`) and needs `libdeflate.so.0` + `libwebp`.
- The ggml changes live in the `stable-diffusion.cpp-prod/ggml` submodule (uncommitted, alongside the earlier cuDNN work there). Rebuild sd.cpp for sm_120 on the 5090.
- Startup log line `[upscale] conv=cudnn png=libdeflate webp=oencode` confirms all three are active.

## Bench

Scripts are in the session scratchpad (not committed): `bench.py` (per-config server runs plus PSNR vs baseline), `ab.py` (interleaved A/B across library builds plus PSNR vs PyTorch), `vram.py` (per-process peak VRAM), `ref.py` (spandrel fp32 reference). The input is `omniserve-native/matte/bench/gs2k.png` resized.
