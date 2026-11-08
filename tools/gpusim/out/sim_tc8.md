fit h100 tc=4: a=2.220e-05 s/token b=2.704e-10 s/token^2 attention share of 5s-768p step 0.60
fit h100 tc=8: a=3.559e-05 s/token b=1.130e-09 s/token^2 attention share of 5s-768p step 0.67
fit pro6000 tc=4: a=8.910e-06 s/token b=2.371e-10 s/token^2 attention share of 5s-768p step 0.77
fit pro6000 tc=8: a=1.726e-05 s/token b=8.900e-10 s/token^2 attention share of 5s-768p step 0.77

validation (tc=8): predicted vs measured
  h100     5s-768p   denoise  measured   42.0 s  model   42.0 s  tokens 64512
  h100     15s-768p  denoise  measured  262.0 s  model  262.0 s  tokens 181440
  pro6000  5s-768p   denoise  measured   36.0 s  model   28.9 s  tokens 64512
  pro6000  5s-1080p  total    measured  143.0 s  model  143.0 s  tokens 130560
  pro6000  5s-1440p  total    measured  367.0 s  model  367.0 s  tokens 227520

sparse-attention plans, rho mode struct (struct: / own dense Triton kernel, sdpa: / torch flash SDPA), measured on NVIDIA GeForce RTX 3090 Ti
  N=  64512 sliding wf2 wy12       density 0.201 rho 0.213 relL2(synthetic) 0.228
  N=  64512 sliding wf3 wy16       density 0.292 rho 0.312 relL2(synthetic) 0.191
  N=  64512 radial base0.25        density 0.304 rho 0.352 relL2(synthetic) 0.187
  N=  64512 topk keep0.25          density 0.250 rho 0.277 relL2(synthetic) 0.186
  N=  64512 topk keep0.125         density 0.125 rho 0.138 relL2(synthetic) 0.258
  N= 124992 sliding wf2 wy12       density 0.108 rho 0.109 relL2(synthetic) 0.457
  N= 124992 sliding wf3 wy16       density 0.160 rho 0.166 relL2(synthetic) 0.415
  N= 124992 radial base0.25        density 0.219 rho 0.260 relL2(synthetic) 0.373
  N= 124992 topk keep0.25          density 0.250 rho 0.274 relL2(synthetic) 0.306
  N= 124992 topk keep0.125         density 0.125 rho 0.137 relL2(synthetic) 0.422

## sparse in all 6 steps: predicted denoise speedup (dense / sparse), tc=8
| gpu | clip | dense denoise s | sliding wf2 wy12 | sliding wf3 wy16 | radial base0.25 | topk keep0.25 | topk keep0.125 |
|---|---|---|---|---|---|---|---|
| h100 | 5s-768p | 42 | 2.12x | 1.86x | 1.77x | 1.94x | 2.38x |
| h100 | 5s-1080p | 143 | 3.54x | 3.05x | 2.48x | 2.41x | 3.28x |
| h100 | 5s-1440p | 400 | 4.60x | 3.74x | 2.86x | 2.76x | 4.13x |
| h100 | 15s-768p | 262 | 4.15x | 3.46x | 2.71x | 2.62x | 3.78x |
| h200 | 5s-768p | 42 | 2.12x | 1.86x | 1.77x | 1.94x | 2.38x |
| h200 | 5s-1080p | 143 | 3.54x | 3.05x | 2.48x | 2.41x | 3.28x |
| h200 | 5s-1440p | 400 | 4.60x | 3.74x | 2.86x | 2.76x | 4.13x |
| h200 | 15s-768p | 262 | 4.15x | 3.46x | 2.71x | 2.62x | 3.78x |
| b200 | 5s-768p | 6 | 2.53x | 2.12x | 1.99x | 2.25x | 2.97x |
| b200 | 5s-1080p | 23 | 4.46x | 3.66x | 2.81x | 2.72x | 4.02x |
| b200 | 5s-1440p | 67 | 5.58x | 4.32x | 3.14x | 3.02x | 4.88x |
| b200 | 15s-768p | 44 | 5.12x | 4.06x | 3.02x | 2.91x | 4.54x |
| pro6000 | 5s-768p | 29 | 2.53x | 2.12x | 1.99x | 2.25x | 2.96x |
| pro6000 | 5s-1080p | 105 | 4.46x | 3.65x | 2.81x | 2.72x | 4.02x |
| pro6000 | 5s-1440p | 300 | 5.58x | 4.32x | 3.14x | 3.02x | 4.88x |
| pro6000 | 15s-768p | 195 | 5.12x | 4.06x | 3.02x | 2.91x | 4.54x |
| 5090 | 5s-768p | 61 | 3.17x | 2.49x | 2.29x | 2.69x | 3.99x |
| 5090 | 5s-1080p | 235 | 5.85x | 4.47x | 3.21x | 3.08x | 5.08x |
| 5090 | 5s-1440p | 692 | 6.86x | 5.00x | 3.44x | 3.29x | 5.80x |
| 5090 | 15s-768p | 445 | 6.47x | 4.80x | 3.36x | 3.22x | 5.53x |
| 4090 | 5s-768p | 109 | 1.97x | 1.75x | 1.68x | 1.82x | 2.17x |
| 4090 | 5s-1080p | 361 | 3.19x | 2.80x | 2.33x | 2.27x | 2.99x |
| 4090 | 5s-1440p | 988 | 4.19x | 3.48x | 2.72x | 2.63x | 3.81x |
| 4090 | 15s-768p | 652 | 3.76x | 3.20x | 2.56x | 2.49x | 3.46x |
| l40s | 5s-768p | 49 | 1.98x | 1.76x | 1.68x | 1.83x | 2.18x |
| l40s | 5s-1080p | 164 | 3.21x | 2.82x | 2.34x | 2.28x | 3.00x |
| l40s | 5s-1440p | 450 | 4.21x | 3.50x | 2.73x | 2.64x | 3.83x |
| l40s | 15s-768p | 296 | 3.78x | 3.21x | 2.57x | 2.50x | 3.48x |
| a100 | 5s-768p | 57 | 1.97x | 1.75x | 1.68x | 1.82x | 2.17x |
| a100 | 5s-1080p | 191 | 3.19x | 2.80x | 2.33x | 2.27x | 2.99x |
| a100 | 5s-1440p | 523 | 4.19x | 3.48x | 2.72x | 2.63x | 3.81x |
| a100 | 15s-768p | 345 | 3.76x | 3.20x | 2.56x | 2.49x | 3.46x |
| 3090 | 5s-768p | 205 | 2.53x | 2.12x | 1.99x | 2.25x | 2.97x |
| 3090 | 5s-1080p | 742 | 4.46x | 3.66x | 2.81x | 2.72x | 4.02x |
| 3090 | 5s-1440p | 2129 | 5.58x | 4.32x | 3.14x | 3.02x | 4.88x |
| 3090 | 15s-768p | 1381 | 5.12x | 4.06x | 3.02x | 2.91x | 4.54x |

## sparse in 4 of 6 steps (Sol-Attn style window): predicted denoise speedup (dense / sparse), tc=8
| gpu | clip | dense denoise s | sliding wf2 wy12 | sliding wf3 wy16 | radial base0.25 | topk keep0.25 | topk keep0.125 |
|---|---|---|---|---|---|---|---|
| h100 | 5s-768p | 42 | 1.55x | 1.45x | 1.41x | 1.48x | 1.63x |
| h100 | 5s-1080p | 143 | 1.92x | 1.81x | 1.66x | 1.64x | 1.86x |
| h100 | 5s-1440p | 400 | 2.09x | 1.96x | 1.76x | 1.74x | 2.02x |
| h100 | 15s-768p | 262 | 2.02x | 1.90x | 1.73x | 1.70x | 1.96x |
| h200 | 5s-768p | 42 | 1.55x | 1.45x | 1.41x | 1.48x | 1.63x |
| h200 | 5s-1080p | 143 | 1.92x | 1.81x | 1.66x | 1.64x | 1.86x |
| h200 | 5s-1440p | 400 | 2.09x | 1.96x | 1.76x | 1.74x | 2.02x |
| h200 | 15s-768p | 262 | 2.02x | 1.90x | 1.73x | 1.70x | 1.96x |
| b200 | 5s-768p | 6 | 1.68x | 1.54x | 1.50x | 1.59x | 1.79x |
| b200 | 5s-1080p | 23 | 2.07x | 1.94x | 1.75x | 1.73x | 2.00x |
| b200 | 5s-1440p | 67 | 2.21x | 2.05x | 1.83x | 1.81x | 2.13x |
| b200 | 15s-768p | 44 | 2.16x | 2.01x | 1.80x | 1.78x | 2.08x |
| pro6000 | 5s-768p | 29 | 1.68x | 1.54x | 1.50x | 1.59x | 1.79x |
| pro6000 | 5s-1080p | 105 | 2.07x | 1.94x | 1.75x | 1.73x | 2.00x |
| pro6000 | 5s-1440p | 300 | 2.21x | 2.05x | 1.83x | 1.80x | 2.13x |
| pro6000 | 15s-768p | 195 | 2.16x | 2.01x | 1.80x | 1.78x | 2.08x |
| 5090 | 5s-768p | 61 | 1.84x | 1.66x | 1.60x | 1.72x | 2.00x |
| 5090 | 5s-1080p | 235 | 2.24x | 2.07x | 1.85x | 1.82x | 2.15x |
| 5090 | 5s-1440p | 692 | 2.32x | 2.14x | 1.90x | 1.87x | 2.23x |
| 5090 | 15s-768p | 445 | 2.29x | 2.12x | 1.88x | 1.85x | 2.20x |
| 4090 | 5s-768p | 109 | 1.49x | 1.40x | 1.37x | 1.43x | 1.56x |
| 4090 | 5s-1080p | 361 | 1.84x | 1.75x | 1.61x | 1.60x | 1.80x |
| 4090 | 5s-1440p | 988 | 2.03x | 1.91x | 1.73x | 1.71x | 1.97x |
| 4090 | 15s-768p | 652 | 1.96x | 1.85x | 1.68x | 1.66x | 1.90x |
| l40s | 5s-768p | 49 | 1.49x | 1.40x | 1.37x | 1.43x | 1.56x |
| l40s | 5s-1080p | 164 | 1.85x | 1.75x | 1.62x | 1.60x | 1.80x |
| l40s | 5s-1440p | 450 | 2.03x | 1.91x | 1.73x | 1.71x | 1.97x |
| l40s | 15s-768p | 296 | 1.96x | 1.85x | 1.69x | 1.67x | 1.90x |
| a100 | 5s-768p | 57 | 1.49x | 1.40x | 1.37x | 1.43x | 1.56x |
| a100 | 5s-1080p | 191 | 1.84x | 1.75x | 1.61x | 1.60x | 1.80x |
| a100 | 5s-1440p | 523 | 2.03x | 1.91x | 1.73x | 1.71x | 1.97x |
| a100 | 15s-768p | 345 | 1.96x | 1.85x | 1.68x | 1.66x | 1.90x |
| 3090 | 5s-768p | 205 | 1.68x | 1.54x | 1.50x | 1.59x | 1.79x |
| 3090 | 5s-1080p | 742 | 2.07x | 1.94x | 1.75x | 1.73x | 2.00x |
| 3090 | 5s-1440p | 2129 | 2.21x | 2.05x | 1.83x | 1.81x | 2.13x |
| 3090 | 15s-768p | 1381 | 2.16x | 2.01x | 1.80x | 1.78x | 2.08x |
