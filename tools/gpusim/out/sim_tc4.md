fit h100 tc=4: a=2.220e-05 s/token b=2.704e-10 s/token^2 attention share of 5s-768p step 0.60
fit h100 tc=8: a=3.559e-05 s/token b=1.130e-09 s/token^2 attention share of 5s-768p step 0.67
fit pro6000 tc=4: a=8.910e-06 s/token b=2.371e-10 s/token^2 attention share of 5s-768p step 0.77
fit pro6000 tc=8: a=1.726e-05 s/token b=8.900e-10 s/token^2 attention share of 5s-768p step 0.77

validation (tc=4): predicted vs measured
  h100     5s-768p   denoise  measured   42.0 s  model   42.0 s  tokens 124992
  h100     15s-768p  denoise  measured  262.0 s  model  262.0 s  tokens 362880
  pro6000  5s-768p   denoise  measured   36.0 s  model   28.9 s  tokens 124992
  pro6000  5s-1080p  total    measured  143.0 s  model  143.0 s  tokens 252960
  pro6000  5s-1440p  total    measured  367.0 s  model  367.0 s  tokens 440820

sparse-attention plans, rho mode struct (struct: / own dense Triton kernel, sdpa: / torch flash SDPA), measured on NVIDIA GeForce RTX 3090 Ti
  N= 124992 sliding wf2 wy12       density 0.108 rho 0.109 relL2(synthetic) 0.457
  N= 124992 sliding wf3 wy16       density 0.160 rho 0.166 relL2(synthetic) 0.415
  N= 124992 radial base0.25        density 0.219 rho 0.260 relL2(synthetic) 0.373
  N= 124992 topk keep0.25          density 0.250 rho 0.274 relL2(synthetic) 0.306
  N= 124992 topk keep0.125         density 0.125 rho 0.137 relL2(synthetic) 0.422
  N= 362880 sliding wf2 wy12       density 0.038 rho 0.038 relL2(synthetic) 0.480
  N= 362880 sliding wf3 wy16       density 0.058 rho 0.058 relL2(synthetic) 0.443
  N= 362880 radial base0.25        density 0.156 rho 0.173 relL2(synthetic) 0.373
  N= 362880 topk keep0.25          density 0.250 rho 0.265 relL2(synthetic) 0.253
  N= 362880 topk keep0.125         density 0.125 rho 0.132 relL2(synthetic) 0.349

## sparse in all 6 steps: predicted denoise speedup (dense / sparse), tc=4
| gpu | clip | dense denoise s | sliding wf2 wy12 | sliding wf3 wy16 | radial base0.25 | topk keep0.25 | topk keep0.125 |
|---|---|---|---|---|---|---|---|
| h100 | 5s-768p | 42 | 2.16x | 2.01x | 1.81x | 1.78x | 2.09x |
| h100 | 5s-1080p | 138 | 3.65x | 3.46x | 2.66x | 2.25x | 2.90x |
| h100 | 5s-1440p | 374 | 5.29x | 4.86x | 3.30x | 2.63x | 3.73x |
| h100 | 15s-768p | 262 | 4.64x | 4.31x | 3.07x | 2.50x | 3.42x |
| h200 | 5s-768p | 42 | 2.16x | 2.01x | 1.81x | 1.78x | 2.09x |
| h200 | 5s-1080p | 138 | 3.65x | 3.46x | 2.66x | 2.25x | 2.90x |
| h200 | 5s-1440p | 374 | 5.29x | 4.86x | 3.30x | 2.63x | 3.73x |
| h200 | 15s-768p | 262 | 4.64x | 4.31x | 3.07x | 2.50x | 3.42x |
| b200 | 5s-768p | 6 | 3.17x | 2.79x | 2.32x | 2.26x | 2.97x |
| b200 | 5s-1080p | 23 | 6.15x | 5.56x | 3.57x | 2.78x | 4.10x |
| b200 | 5s-1440p | 67 | 8.80x | 7.58x | 4.20x | 3.10x | 5.00x |
| b200 | 15s-768p | 46 | 7.79x | 6.83x | 3.99x | 3.00x | 4.69x |
| pro6000 | 5s-768p | 29 | 3.17x | 2.79x | 2.32x | 2.26x | 2.97x |
| pro6000 | 5s-1080p | 105 | 6.15x | 5.56x | 3.57x | 2.78x | 4.09x |
| pro6000 | 5s-1440p | 300 | 8.79x | 7.58x | 4.20x | 3.10x | 5.00x |
| pro6000 | 15s-768p | 207 | 7.79x | 6.83x | 3.99x | 3.00x | 4.69x |
| 5090 | 5s-768p | 61 | 4.43x | 3.64x | 2.80x | 2.71x | 4.00x |
| 5090 | 5s-1080p | 235 | 9.54x | 8.12x | 4.34x | 3.17x | 5.21x |
| 5090 | 5s-1440p | 692 | 12.90x | 10.36x | 4.83x | 3.39x | 5.97x |
| 5090 | 15s-768p | 473 | 11.68x | 9.58x | 4.67x | 3.32x | 5.72x |
| 4090 | 5s-768p | 109 | 2.25x | 2.09x | 1.86x | 1.83x | 2.17x |
| 4090 | 5s-1080p | 361 | 3.87x | 3.65x | 2.76x | 2.31x | 3.02x |
| 4090 | 5s-1440p | 988 | 5.61x | 5.12x | 3.40x | 2.69x | 3.87x |
| 4090 | 15s-768p | 691 | 4.92x | 4.55x | 3.17x | 2.56x | 3.56x |
| l40s | 5s-768p | 49 | 2.27x | 2.10x | 1.87x | 1.84x | 2.18x |
| l40s | 5s-1080p | 164 | 3.90x | 3.68x | 2.77x | 2.32x | 3.04x |
| l40s | 5s-1440p | 450 | 5.66x | 5.16x | 3.42x | 2.70x | 3.89x |
| l40s | 15s-768p | 314 | 4.96x | 4.59x | 3.19x | 2.57x | 3.58x |
| a100 | 5s-768p | 57 | 2.25x | 2.09x | 1.86x | 1.83x | 2.17x |
| a100 | 5s-1080p | 191 | 3.87x | 3.65x | 2.76x | 2.31x | 3.02x |
| a100 | 5s-1440p | 523 | 5.61x | 5.12x | 3.40x | 2.69x | 3.87x |
| a100 | 15s-768p | 365 | 4.92x | 4.55x | 3.17x | 2.56x | 3.56x |
| 3090 | 5s-768p | 205 | 3.17x | 2.79x | 2.32x | 2.26x | 2.97x |
| 3090 | 5s-1080p | 742 | 6.15x | 5.56x | 3.57x | 2.78x | 4.10x |
| 3090 | 5s-1440p | 2129 | 8.80x | 7.58x | 4.20x | 3.10x | 5.00x |
| 3090 | 15s-768p | 1467 | 7.79x | 6.83x | 3.99x | 3.00x | 4.69x |

## sparse in 4 of 6 steps (Sol-Attn style window): predicted denoise speedup (dense / sparse), tc=4
| gpu | clip | dense denoise s | sliding wf2 wy12 | sliding wf3 wy16 | radial base0.25 | topk keep0.25 | topk keep0.125 |
|---|---|---|---|---|---|---|---|
| h100 | 5s-768p | 42 | 1.56x | 1.51x | 1.42x | 1.41x | 1.53x |
| h100 | 5s-1080p | 138 | 1.94x | 1.90x | 1.71x | 1.59x | 1.78x |
| h100 | 5s-1440p | 374 | 2.18x | 2.12x | 1.87x | 1.70x | 1.95x |
| h100 | 15s-768p | 262 | 2.10x | 2.05x | 1.82x | 1.67x | 1.89x |
| h200 | 5s-768p | 42 | 1.56x | 1.51x | 1.42x | 1.41x | 1.53x |
| h200 | 5s-1080p | 138 | 1.94x | 1.90x | 1.71x | 1.59x | 1.78x |
| h200 | 5s-1440p | 374 | 2.18x | 2.12x | 1.87x | 1.70x | 1.95x |
| h200 | 15s-768p | 262 | 2.10x | 2.05x | 1.82x | 1.67x | 1.89x |
| b200 | 5s-768p | 6 | 1.84x | 1.75x | 1.61x | 1.59x | 1.79x |
| b200 | 5s-1080p | 23 | 2.26x | 2.21x | 1.92x | 1.74x | 2.02x |
| b200 | 5s-1440p | 67 | 2.44x | 2.37x | 2.03x | 1.82x | 2.14x |
| b200 | 15s-768p | 46 | 2.39x | 2.32x | 2.00x | 1.80x | 2.10x |
| pro6000 | 5s-768p | 29 | 1.84x | 1.75x | 1.61x | 1.59x | 1.79x |
| pro6000 | 5s-1080p | 105 | 2.26x | 2.21x | 1.92x | 1.74x | 2.02x |
| pro6000 | 5s-1440p | 300 | 2.44x | 2.37x | 2.03x | 1.82x | 2.14x |
| pro6000 | 15s-768p | 207 | 2.39x | 2.32x | 2.00x | 1.80x | 2.10x |
| 5090 | 5s-768p | 61 | 2.07x | 1.94x | 1.75x | 1.73x | 2.00x |
| 5090 | 5s-1080p | 235 | 2.48x | 2.41x | 2.05x | 1.84x | 2.17x |
| 5090 | 5s-1440p | 692 | 2.60x | 2.51x | 2.12x | 1.89x | 2.25x |
| 5090 | 15s-768p | 473 | 2.56x | 2.48x | 2.10x | 1.87x | 2.22x |
| 4090 | 5s-768p | 109 | 1.59x | 1.53x | 1.45x | 1.43x | 1.56x |
| 4090 | 5s-1080p | 361 | 1.98x | 1.94x | 1.74x | 1.61x | 1.81x |
| 4090 | 5s-1440p | 988 | 2.21x | 2.16x | 1.89x | 1.72x | 1.98x |
| 4090 | 15s-768p | 691 | 2.13x | 2.08x | 1.84x | 1.68x | 1.92x |
| l40s | 5s-768p | 49 | 1.59x | 1.54x | 1.45x | 1.44x | 1.56x |
| l40s | 5s-1080p | 164 | 1.98x | 1.94x | 1.74x | 1.61x | 1.81x |
| l40s | 5s-1440p | 450 | 2.22x | 2.16x | 1.89x | 1.72x | 1.98x |
| l40s | 15s-768p | 314 | 2.14x | 2.09x | 1.84x | 1.69x | 1.92x |
| a100 | 5s-768p | 57 | 1.59x | 1.53x | 1.45x | 1.43x | 1.56x |
| a100 | 5s-1080p | 191 | 1.98x | 1.94x | 1.74x | 1.61x | 1.81x |
| a100 | 5s-1440p | 523 | 2.21x | 2.16x | 1.89x | 1.72x | 1.98x |
| a100 | 15s-768p | 365 | 2.13x | 2.08x | 1.84x | 1.68x | 1.92x |
| 3090 | 5s-768p | 205 | 1.84x | 1.75x | 1.61x | 1.59x | 1.79x |
| 3090 | 5s-1080p | 742 | 2.26x | 2.21x | 1.92x | 1.74x | 2.02x |
| 3090 | 5s-1440p | 2129 | 2.44x | 2.37x | 2.03x | 1.82x | 2.14x |
| 3090 | 15s-768p | 1467 | 2.39x | 2.32x | 2.00x | 1.80x | 2.10x |
