# H3 face refinement visual check

`review-grid.png` is ordered left-to-right as source/refined, with the first
frame on top and final frame on the bottom. `before.webm` and `after.mp4` are
the exact controlled pair; the candidate changes only the stitched face region
and retains the scene trajectory.

The decoded full-video comparison measured SSIM 0.990605 / PSNR 43.04 dB.
First/middle/last frame SSIM was 0.983905, 0.981829, and 0.975767. The reference
SHA-256 is `10ddda968cc3e1dca07bc4e0fa5d44892381aa2b8ef1278d9ada1376391715b9`;
the refined candidate is
`3418f0ac0dc9b3be9390cd89d46024238de1a7ee0f2ae8236687dc13ef7c3d7e`.

Close-up endpoint faces are now excluded by a separate size gate: when a face
spans over 55% of either frame dimension, the source already has more detail
than the 512/768 refinement canvas can add and a wide paste can reveal crop
boundaries.
