# Astronaut proof benchmark

Measured on the 124-frame, 1184x672, 24 fps
`astronaut-flower-field.webm` clip with RVM ResNet50 FP16 on an RTX 3090 Ti.
One-time model/CUDA warm-up is excluded. Edge MAE and thresholded mask IoU are
relative to full-scale (`1.0`) inference.

| Matte scale | Throughput | Edge MAE | Mask IoU |
| ---: | ---: | ---: | ---: |
| 0.25 | 37.75 fps | 0.1769 | 0.9706 |
| 0.375 | 37.63 fps | 0.1297 | 0.9777 |
| 0.5 | 42.39 fps | 0.1165 | 0.9803 |
| 0.75 | 40.52 fps | 0.0764 | 0.9877 |
| 1.0 | 33.84 fps | reference | reference |

Full-scale inference is the default for this resolution because it stays
above real time and materially improves the astronaut boundary. For 2K/4K,
rerun `make benchmark` on representative footage instead of scaling the final
video: only the matte and smooth colour-difference field should be resized;
the source pixels remain at native resolution.

The rose-gold proof changes the fully opaque foreground by a mean absolute
0.0232 on a `[0,1]` channel scale. Only 4.84% of that delta's RMS energy is
high-frequency (mean across frames, 11x11-eroded foreground); that residual is
mostly 8-bit PNG quantization and clamp boundaries. The grade is generated at
quarter resolution and added to the original image, preserving the original
high-frequency residual before final AV1 quantization.
