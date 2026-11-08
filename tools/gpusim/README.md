# gpusim

Shape-free calibrated cost model for the H3 DiT across GPU types, plus a Triton block-sparse attention prototype that runs on the local RTX 3090 Ti.

- `gpusim/specs.py` GPU table (SMs, bandwidth, dense bf16 / low-precision TFLOPS, $/h).
- `gpusim/dit.py` step time = a*N + b*N^2 per GPU. Fit exactly on measured H100 (5 s, 15 s) and RTX PRO 6000 (1080p, 1440p) numbers from `results/h3-flex-bench/README.md`; other GPUs scale a by low-precision peak and b by bf16 peak from the nearest same-architecture fit. `tc` is the unknown temporal VAE ratio (4 or 8).
- `gpusim/bsa.py` forward block-sparse flash attention (CSR block lists per head), `gpusim/patterns.py` sliding 3D window, radial, top-k pooled blocks, `gpusim/synth.py` structured synthetic Q/K/V.
- `bench_sparse.py` real timings and error vs dense SDPA on the local GPU, `simulate.py` end-to-end predictions per GPU from those timings.

```
python3 -m pytest -q
python3 bench_sparse.py --clip 5s-768p --tc 4 --heads 4 --out out/bench_5s_tc4.json
python3 simulate.py --bench out/bench_5s_tc4.json out/bench_15s_tc4.json
```

Limits: DiT layer/head dims are not available locally (weights only), error numbers use synthetic structured activations, the local GPU is shared and sm_86 only; predictions for other GPUs assume the sparse kernel keeps the same ratio to its own dense kernel.
