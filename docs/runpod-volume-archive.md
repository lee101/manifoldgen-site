# RunPod network volume archive (2026-09-23)

Three idle RunPod network volumes were archived to Cloudflare R2 and deleted from
RunPod. `fb96eh7ozc` (manifold-wan-blackwell-cache, US-CA-2) was not touched.

- Bucket: `runpod-volume-archive` (private R2 bucket, no public/r2.dev access, same
  account and credentials as `logrotatebak`: `CLOUDFLARE_R2_*`, `R2_ENDPOINT` in `~/.secretbashrc`).
- Layout: `s3://runpod-volume-archive/<volume-id>-<volume-name>/<original path under /workspace>`,
  one object per file, no tarballs. Symlinks are stored as `<path>.rclonelink` objects
  (content = link target); `rclone copy --links` recreates them.
- Manifests: `s3://runpod-volume-archive/_manifests/<volume-id>-<volume-name>/`
  - `manifest.md5` md5 + path for every object (from R2 object hashes)
  - `src_sizes.tsv` size + path for every source file
  - `symlinks.txt` source symlinks, `check.log` rclone check output, `spot.txt` sha256 spot checks
- Endpoint snapshot before detach (no env/secrets): `s3://runpod-volume-archive/_manifests/endpoints_snapshot_20260923.json`
- Templates were not modified; their env vars remain in RunPod.

## Summary

| Volume | Name | DC | Size | Files | Bytes archived | Objects in R2 |
|---|---|---|---|---|---|---|
| `5rc1bmt70a` | manifold-shared-video-models | US-IL-1 | 256 GB | 1922 (+29 symlinks) | 189,626,967,632 (176.6 GiB) | 1951 |
| `r2died41lj` | manifold-music3-models-nc1 | US-NC-1 | 100 GB | 12581 | 58,059,060,148 (54.1 GiB) | 12581 |
| `gz226u7mrl` | manifold-h3-control-models-ca3 | CA-MTL-3 | 256 GB | 133 | 150,886,858,141 (140.5 GiB) | 133 |

Total: 398.6 GB (371.2 GiB) across 14,665 objects.

## Procedure used

1. Rechecked: every attached endpoint `workersMin=0 workersMax=0`, no pods on the volumes.
   No RunPod S3 API key exists in env files, so the S3 network-volume API was not used.
2. Scratch pod per volume in the volume's DC (`ubuntu:24.04`, volume at `/workspace`, sshd for access):
   - `scratch-archive-video` US-IL-1 CPU $0.12/h, `scratch-archive-music3` US-NC-1 CPU $0.06/h,
   - `scratch-archive-h3control` CA-MTL-3: no CPU stock for ~20 min, fell back to the only
     available GPU (RTX PRO 6000, $2.09/h). No public TCP there; used the `ssh.runpod.io` proxy.
   - Note: RunPod injects an old `/usr/bin/rclone` (v1.58.1, no Cloudflare provider) into pods;
     official rclone v1.75.1 was downloaded to `/root/bin` instead.
3. `rclone copy /workspace r2:runpod-volume-archive/<prefix> --links --checksum --transfers 16`
   (R2 credentials written to the pod's ephemeral container disk only, not pod env).
4. Verification:
   - `rclone check --one-way` (md5, source re-read vs R2): 0 differences for all three.
   - Object count and total bytes: identical to source file count/size (video: +29 `.rclonelink`
     objects, +1874 bytes of link targets).
   - sha256 spot check of the 3 largest files per volume, hashing the source and a fresh stream
     from R2: all 9 MATCH (HF blob names also equal their sha256).
5. Pods terminated, endpoints detached (`PATCH /v1/endpoints/{id}` with
   `{"networkVolumeIds":[],"networkVolumeId":""}`; templates, GPU types and scaling unchanged),
   volumes deleted (`DELETE /v1/networkvolumes/{id}`, 204).

Pod spend: about $0.07 (video) + $0.02 (music3) + $0.86 (h3control GPU) = about $0.95.

## Cost

- RunPod network storage removed: 612 GB x $0.07/GB-month = $42.84/month.
- R2 storage added: about 399 GB x $0.015/GB-month = about $6.0/month (egress free).
- Net saving: about $36.8/month. Delete the R2 prefix when a model set is confirmed dead.

## Restore procedure

Per volume (replace `<vol>`, `<prefix>`, `<dc>`, `<size>`):

1. Create a volume in the same DC (endpoints' GPU types were picked for it):
   `curl -X POST https://rest.runpod.io/v1/networkvolumes -H "Authorization: Bearer $RUNPOD_API_KEY" -H 'Content-Type: application/json' -d '{"name":"<name>","size":<size>,"dataCenterId":"<dc>"}'`
   It gets a new id.
2. Start the cheapest CPU pod in that DC with the new volume at `/workspace` (fall back to the
   cheapest in-stock GPU if no CPU stock), install official rclone, write an `r2` remote
   (`type = s3`, `provider = Cloudflare`, `R2_ENDPOINT`, `CLOUDFLARE_R2_*`), then:
   `rclone copy r2:runpod-volume-archive/<prefix> /workspace --links --checksum --transfers 16`
   `rclone check r2:runpod-volume-archive/<prefix> /workspace --links --one-way`
   Terminate the pod.
3. Reattach every endpoint listed below:
   `PATCH /v1/endpoints/<endpoint-id>` with `{"networkVolumeIds":["<new-vol-id>"]}`,
   then raise `workersMax` as needed. Update `config/runpod-h3-control.json`
   (`networkVolumeId`) and any other code/config that hard-codes the old volume id.
4. Estimate: archive ran at 350-620 MB/s. Restore ~10 min (music3), ~10 min (video),
   ~10-15 min (h3control) plus pod start; CPU pod cost under $0.10 each (about $1 if a GPU
   fallback is needed). R2 egress is free. The volume bills from creation at $0.07/GB-month.

## `5rc1bmt70a` manifold-shared-video-models (US-IL-1, 256 GB)

Restore prefix: `runpod-volume-archive/5rc1bmt70a-manifold-shared-video-models/`

### Attached endpoints (before detach)

| Endpoint | Name | Template | GPU types | GPUs | workers min/max/standby | idle | exec timeout ms | flashboot | networkVolumeIds |
|---|---|---|---|---|---|---|---|---|---|
| `17g0r8olu6sdqf` | cog-wan-animate-2-comfy-smoke-4524b27b | `2qyf8l666o` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/2 | 5s | null | true | 5rc1bmt70a |
| `5fzsapohpaz8nv` | cog-video-restyle-shared-32f76c77 | `yxewb8zavl` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/1 | 30s | 14400000 | true | 5rc1bmt70a |
| `5t2pv78i1r46md` | manifold-wan-animate-fast-ada-fallback | `7whv3n3s8h` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/1 | 5s | 14400000 | true | 5rc1bmt70a |
| `6p9elbqarsij1i` | cog-wan-animate-shared-b7c9198-9b2a4fc5 | `nhfrl1z03f` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/2 | 5s | null | true | 5rc1bmt70a |
| `6s7lcwfj0vqudn` | cog-wan-animate-shared-928e9c2d | `iguga2mf9c` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/2 | 5s | null | true | 5rc1bmt70a |
| `hibshx3abonecy` | manifold-wan-animate-fast-ada-gql | `u8rpiakayy` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/0 | 5s | 14400000 | true | 5rc1bmt70a |
| `j1dkz8zzgo877l` | manifold-wan-animate-xfast-b200 | `yxewb8zavl` | NVIDIA B200 | 1 | 0/0/1 | 5s | 7200000 | true | 5rc1bmt70a |
| `l9j6n0xs4txpzn` | cog-manifold-wan22-video-restyle-a3c5eff4 | `tdsf1qbgnn` | NVIDIA A40, NVIDIA RTX A6000, NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/2 | 5s | null | false | 5rc1bmt70a |
| `mzshwf3el0a0zb` | cog-video-restyle-shared-d2a61f47 | `3xq89fvtm9` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/2 | 5s | 3600000 | true | 5rc1bmt70a |
| `mzz277fr4rbdw0` | omniserve-native | `7y210d7l43` | NVIDIA A40, NVIDIA RTX A6000, NVIDIA RTX A5000, NVIDIA L4, NVIDIA GeForce RTX 3090, NVIDIA GeForce RTX 4090, NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/3 | 5s | 14400000 | true |  |
| `nt4qaorj2z7sij` | manifold-wan-animate-fast-h100 | `yxewb8zavl` | NVIDIA H100 80GB HBM3 | 1 | 0/0/1 | 5s | 7200000 | true | 5rc1bmt70a |
| `onljtw1jm5wa3h` | manifold-wan-animate-fast-blackwell96 | `yxewb8zavl` | NVIDIA RTX PRO 6000 Blackwell Server Edition, NVIDIA RTX PRO 6000 Blackwell Workstation Edition, NVIDIA RTX PRO 6000 Blackwell Max-Q Workstation Edition | 1 | 0/0/1 | 5s | null | true | 5rc1bmt70a |
| `p72bcfclcztu8w` | wan-animate-prequant-builder-r5 | `wn4am9i0x4` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/1 | 30s | null | true | 5rc1bmt70a |
| `zdi4qv9hx9w2wa` | manifold-wan-animate-xfast-ada-fallback | `5fouipg39z` | NVIDIA RTX 6000 Ada Generation, NVIDIA L40, NVIDIA L40S | 1 | 0/0/1 | 5s | 14400000 | true | 5rc1bmt70a |

### Templates

| Template | Name | Image | Container disk GB | Mount |
|---|---|---|---|---|
| `2qyf8l666o` | cog-wan-animate-2-comfy-smoke-4524b27b | `ghcr.io/lee101/wan-animate-cog@sha256:c6607ae517f87e9dbb49e2c0d0ea1595111dcf9e14e9d0455caa1ad2b97f12f3` | 100 | /workspace |
| `3xq89fvtm9` | cog-video-restyle-shared-d2a61f47 | `ghcr.io/lee101/wan-animate-cog@sha256:83424813907ed1dcabd20f514e1713da888f89e4f689a0b6e92a30562d8464a4` | 100 | /workspace |
| `5fouipg39z` | wan-animate-xfast-ada-fallback-r5 | `ghcr.io/lee101/wan-animate-cog@sha256:c6607ae517f87e9dbb49e2c0d0ea1595111dcf9e14e9d0455caa1ad2b97f12f3` | 100 | /workspace |
| `7whv3n3s8h` | wan-animate-fast-ada-fallback-r5 | `ghcr.io/lee101/wan-animate-cog@sha256:c6607ae517f87e9dbb49e2c0d0ea1595111dcf9e14e9d0455caa1ad2b97f12f3` | 100 | /workspace |
| `7y210d7l43` | omniserve-native | `ghcr.io/lee101/omniserve-native:7ea96f29db6e53c4` | 20 | /workspace |
| `iguga2mf9c` | cog-wan-animate-shared-928e9c2d | `ghcr.io/lee101/wan-animate-cog:latest` | 100 | /workspace |
| `nhfrl1z03f` | cog-wan-animate-shared-b7c9198-9b2a4fc5 | `ghcr.io/lee101/wan-animate-cog:b7c9198` | 100 | /workspace |
| `tdsf1qbgnn` | cog-manifold-wan22-video-restyle-a3c5eff4 | `ghcr.io/lee101/accelerated-cgtaylor-wan-app-nz:v2v-20260809-7` | 100 | /workspace |
| `u8rpiakayy` | wan-animate-fast-ada-fallback-r5-gql | `ghcr.io/lee101/wan-animate-cog@sha256:c6607ae517f87e9dbb49e2c0d0ea1595111dcf9e14e9d0455caa1ad2b97f12f3` | 100 | /workspace |
| `wn4am9i0x4` | wan-animate-prequant-builder-r5 | `ghcr.io/lee101/wan-animate-cog@sha256:d02c40b15efcd6d8d33fd2ed059a672dfae30649f200f5a3aad51c1ec6c65361` | 100 | /workspace |
| `yxewb8zavl` | cog-video-restyle-shared-32f76c77 | `ghcr.io/lee101/wan-animate-cog@sha256:d02c40b15efcd6d8d33fd2ed059a672dfae30649f200f5a3aad51c1ec6c65361` | 100 | /workspace |

### Contents by directory

| Directory | Files | GiB |
|---|---|---|
| `models/Wan2.2-T2V-A14B-Diffusers` | 150 | 117.53 |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers` | 28 | 42.79 |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00003-of-00004.bin` | 1 | 4.65 |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00001-of-00004.bin` | 1 | 4.64 |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00002-of-00004.bin` | 1 | 4.61 |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00004-of-00004.bin` | 1 | 1.89 |
| `torchinductor-wan-animate/triton` | 1465 | 0.17 |
| `torchinductor-wan-animate/fxgraph` | 15 | 0.17 |
| `omniserve/huggingface` | 6 | 0.13 |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model.bin.index.json` | 1 | 0.00 |
| `wan-animate-fp8-transformer-v1/config.json` | 1 | 0.00 |
| `torchinductor-wan-animate/zz` | 1 | 0.00 |
| `torchinductor-wan-animate/zt` | 1 | 0.00 |
| `torchinductor-wan-animate/zr` | 1 | 0.00 |
| `torchinductor-wan-animate/zg` | 2 | 0.00 |
| `torchinductor-wan-animate/zf` | 1 | 0.00 |
| `torchinductor-wan-animate/zb` | 1 | 0.00 |
| `torchinductor-wan-animate/yz` | 1 | 0.00 |
| `torchinductor-wan-animate/yl` | 1 | 0.00 |
| `torchinductor-wan-animate/yg` | 1 | 0.00 |
| `torchinductor-wan-animate/y7` | 1 | 0.00 |
| `torchinductor-wan-animate/xq` | 1 | 0.00 |
| `torchinductor-wan-animate/x7` | 1 | 0.00 |
| `torchinductor-wan-animate/x3` | 1 | 0.00 |
| `torchinductor-wan-animate/wn` | 2 | 0.00 |
| `torchinductor-wan-animate/wm` | 1 | 0.00 |
| `torchinductor-wan-animate/w7` | 1 | 0.00 |
| `torchinductor-wan-animate/w4` | 1 | 0.00 |
| `torchinductor-wan-animate/uo` | 1 | 0.00 |
| `torchinductor-wan-animate/ui` | 2 | 0.00 |
| `torchinductor-wan-animate/uf` | 1 | 0.00 |
| `torchinductor-wan-animate/ua` | 2 | 0.00 |
| `torchinductor-wan-animate/u5` | 1 | 0.00 |
| `torchinductor-wan-animate/u4` | 1 | 0.00 |
| `torchinductor-wan-animate/u3` | 1 | 0.00 |
| `torchinductor-wan-animate/ty` | 1 | 0.00 |
| `torchinductor-wan-animate/tx` | 1 | 0.00 |
| `torchinductor-wan-animate/tw` | 1 | 0.00 |
| `torchinductor-wan-animate/tf` | 1 | 0.00 |
| `torchinductor-wan-animate/tb` | 2 | 0.00 |
| `torchinductor-wan-animate/t3` | 1 | 0.00 |
| `torchinductor-wan-animate/t2` | 1 | 0.00 |
| `torchinductor-wan-animate/sy` | 1 | 0.00 |
| `torchinductor-wan-animate/sq` | 1 | 0.00 |
| `torchinductor-wan-animate/sl` | 1 | 0.00 |
| `torchinductor-wan-animate/se` | 1 | 0.00 |
| `torchinductor-wan-animate/sb` | 1 | 0.00 |
| `torchinductor-wan-animate/sa` | 1 | 0.00 |
| `torchinductor-wan-animate/rx` | 1 | 0.00 |
| `torchinductor-wan-animate/rl` | 2 | 0.00 |
| `torchinductor-wan-animate/rb` | 3 | 0.00 |
| `torchinductor-wan-animate/r7` | 1 | 0.00 |
| `torchinductor-wan-animate/r4` | 1 | 0.00 |
| `torchinductor-wan-animate/qw` | 1 | 0.00 |
| `torchinductor-wan-animate/qr` | 1 | 0.00 |
| `torchinductor-wan-animate/qq` | 1 | 0.00 |
| `torchinductor-wan-animate/qp` | 1 | 0.00 |
| `torchinductor-wan-animate/qo` | 4 | 0.00 |
| `torchinductor-wan-animate/qc` | 2 | 0.00 |
| `torchinductor-wan-animate/q6` | 2 | 0.00 |
| `torchinductor-wan-animate/py` | 1 | 0.00 |
| `torchinductor-wan-animate/pu` | 1 | 0.00 |
| `torchinductor-wan-animate/pp` | 1 | 0.00 |
| `torchinductor-wan-animate/pn` | 2 | 0.00 |
| `torchinductor-wan-animate/pi` | 1 | 0.00 |
| `torchinductor-wan-animate/ph` | 1 | 0.00 |
| `torchinductor-wan-animate/p6` | 3 | 0.00 |
| `torchinductor-wan-animate/oy` | 1 | 0.00 |
| `torchinductor-wan-animate/ox` | 1 | 0.00 |
| `torchinductor-wan-animate/ow` | 1 | 0.00 |
| `torchinductor-wan-animate/oe` | 1 | 0.00 |
| `torchinductor-wan-animate/oa` | 1 | 0.00 |
| `torchinductor-wan-animate/nu` | 1 | 0.00 |
| `torchinductor-wan-animate/ne` | 1 | 0.00 |
| `torchinductor-wan-animate/n4` | 1 | 0.00 |
| `torchinductor-wan-animate/n3` | 1 | 0.00 |
| `torchinductor-wan-animate/mv` | 1 | 0.00 |
| `torchinductor-wan-animate/mh` | 1 | 0.00 |
| `torchinductor-wan-animate/mf` | 1 | 0.00 |
| `torchinductor-wan-animate/md` | 1 | 0.00 |
| `torchinductor-wan-animate/mc` | 2 | 0.00 |
| `torchinductor-wan-animate/ls` | 1 | 0.00 |
| `torchinductor-wan-animate/lr` | 2 | 0.00 |
| `torchinductor-wan-animate/li` | 1 | 0.00 |
| `torchinductor-wan-animate/lh` | 2 | 0.00 |
| `torchinductor-wan-animate/km` | 1 | 0.00 |
| `torchinductor-wan-animate/kh` | 2 | 0.00 |
| `torchinductor-wan-animate/kd` | 1 | 0.00 |
| `torchinductor-wan-animate/k7` | 1 | 0.00 |
| `torchinductor-wan-animate/jk` | 2 | 0.00 |
| `torchinductor-wan-animate/jb` | 1 | 0.00 |
| `torchinductor-wan-animate/ip` | 1 | 0.00 |
| `torchinductor-wan-animate/ii` | 1 | 0.00 |
| `torchinductor-wan-animate/i7` | 3 | 0.00 |
| `torchinductor-wan-animate/ht` | 1 | 0.00 |
| `torchinductor-wan-animate/hp` | 2 | 0.00 |
| `torchinductor-wan-animate/h7` | 1 | 0.00 |
| `torchinductor-wan-animate/h4` | 1 | 0.00 |
| `torchinductor-wan-animate/gy` | 1 | 0.00 |
| `torchinductor-wan-animate/gt` | 1 | 0.00 |
| `torchinductor-wan-animate/gp` | 1 | 0.00 |
| `torchinductor-wan-animate/gm` | 1 | 0.00 |
| `torchinductor-wan-animate/gj` | 1 | 0.00 |
| `torchinductor-wan-animate/g4` | 1 | 0.00 |
| `torchinductor-wan-animate/ft` | 2 | 0.00 |
| `torchinductor-wan-animate/fl` | 1 | 0.00 |
| `torchinductor-wan-animate/fa` | 1 | 0.00 |
| `torchinductor-wan-animate/ew` | 1 | 0.00 |
| `torchinductor-wan-animate/eh` | 1 | 0.00 |
| `torchinductor-wan-animate/eg` | 1 | 0.00 |
| `torchinductor-wan-animate/ea` | 2 | 0.00 |
| `torchinductor-wan-animate/e3` | 2 | 0.00 |
| `torchinductor-wan-animate/e2` | 1 | 0.00 |
| `torchinductor-wan-animate/ds` | 1 | 0.00 |
| `torchinductor-wan-animate/do` | 2 | 0.00 |
| `torchinductor-wan-animate/dj` | 1 | 0.00 |
| `torchinductor-wan-animate/d7` | 2 | 0.00 |
| `torchinductor-wan-animate/d5` | 1 | 0.00 |
| `torchinductor-wan-animate/co` | 1 | 0.00 |
| `torchinductor-wan-animate/cj` | 1 | 0.00 |
| `torchinductor-wan-animate/cf` | 1 | 0.00 |
| `torchinductor-wan-animate/cache` | 1 | 0.00 |
| `torchinductor-wan-animate/bw` | 1 | 0.00 |
| `torchinductor-wan-animate/bb` | 1 | 0.00 |
| `torchinductor-wan-animate/b5` | 2 | 0.00 |
| `torchinductor-wan-animate/aw` | 1 | 0.00 |
| `torchinductor-wan-animate/as` | 1 | 0.00 |
| `torchinductor-wan-animate/ar` | 1 | 0.00 |
| `torchinductor-wan-animate/aq` | 1 | 0.00 |
| `torchinductor-wan-animate/aotautograd` | 15 | 0.00 |
| `torchinductor-wan-animate/am` | 2 | 0.00 |
| `torchinductor-wan-animate/ac` | 1 | 0.00 |
| `torchinductor-wan-animate/7z` | 1 | 0.00 |
| `torchinductor-wan-animate/7y` | 1 | 0.00 |
| `torchinductor-wan-animate/7v` | 1 | 0.00 |
| `torchinductor-wan-animate/7l` | 1 | 0.00 |
| `torchinductor-wan-animate/74` | 2 | 0.00 |
| `torchinductor-wan-animate/6y` | 1 | 0.00 |
| `torchinductor-wan-animate/6x` | 1 | 0.00 |
| `torchinductor-wan-animate/6d` | 1 | 0.00 |
| `torchinductor-wan-animate/65` | 1 | 0.00 |
| `torchinductor-wan-animate/5z` | 1 | 0.00 |
| `torchinductor-wan-animate/5x` | 1 | 0.00 |
| `torchinductor-wan-animate/5f` | 1 | 0.00 |
| `torchinductor-wan-animate/5d` | 1 | 0.00 |
| `torchinductor-wan-animate/5b` | 2 | 0.00 |
| `torchinductor-wan-animate/4r` | 1 | 0.00 |
| `torchinductor-wan-animate/4q` | 2 | 0.00 |
| `torchinductor-wan-animate/4n` | 1 | 0.00 |
| `torchinductor-wan-animate/4h` | 1 | 0.00 |
| `torchinductor-wan-animate/4c` | 1 | 0.00 |
| `torchinductor-wan-animate/4b` | 1 | 0.00 |
| `torchinductor-wan-animate/47` | 1 | 0.00 |
| `torchinductor-wan-animate/3z` | 1 | 0.00 |
| `torchinductor-wan-animate/3v` | 1 | 0.00 |
| `torchinductor-wan-animate/3q` | 1 | 0.00 |
| `torchinductor-wan-animate/3o` | 1 | 0.00 |
| `torchinductor-wan-animate/3l` | 2 | 0.00 |
| `torchinductor-wan-animate/3b` | 1 | 0.00 |
| `torchinductor-wan-animate/2z` | 1 | 0.00 |
| `torchinductor-wan-animate/2u` | 1 | 0.00 |
| `torchinductor-wan-animate/2s` | 1 | 0.00 |
| `torchinductor-wan-animate/2f` | 2 | 0.00 |
| `tmp/wan-animate-input-26_g9z9k` | 2 | 0.00 |
| `tmp/wan-animate-1wgdluv6` | 1 | 0.00 |
| `tmp/tmpxydac7ts` | 2 | 0.00 |
| `tmp/tmpxhgs5mc9` | 2 | 0.00 |
| `tmp/tmppvy4ed24` | 1 | 0.00 |
| `tmp/tmpn8omhjvh` | 1 | 0.00 |
| `tmp/tmph_63rmvn.mp4` | 1 | 0.00 |
| `tmp/tmph55ssr6l` | 2 | 0.00 |
| `tmp/tmpe0vpsy6s.mp4` | 1 | 0.00 |
| `tmp/tmp465qgkni.mp4` | 1 | 0.00 |
| `tmp/tmp41vgqnre` | 1 | 0.00 |
| `omniserve/video-matting` | 4 | 0.00 |
| `huggingface/CACHEDIR.TAG` | 1 | 0.00 |
| `huggingface/.wan-animate-model.lock` | 1 | 0.00 |
| `huggingface/.locks` | 27 | 0.00 |
| `huggingface/.agent_harnesses.json` | 1 | 0.00 |
| `.wan-animate-fp8-transformer-v1.lock/` | 1 | 0.00 |

### Files >= 100 MB (full list in R2 manifest)

| Path | Bytes | md5 |
|---|---|---|
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/0da9ee284e21d1406df708788db1d502d95d75f69faa25cd26151bf8829b7c5f` | 1442935480 | `5c2935971f033bb456ee5d4541dadf97` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/0eea9449bfc81f553f804bf2ddd08abeb3ceb043008e3f364b94e1ac5149858c` | 9954402920 | `649ebcd78873662866051aeb46a0f655` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/83c9f8fe04ae01429c3e46053d1e55e2134fd1942df63ff3fe7b7aa7d2aeaca4` | 9874594352 | `ccdc9f84002f87df396e1e2939f612f4` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/a222285e4eb588d37315c3ccc155a2d33c91c2e93fc7de428005c944ff268f9c` | 9975380624 | `7d133cf613f8a2827ae7e489ab6e9b24` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/a8e861969c7433e707cc5a74065d795d36cca07ec96eb6763eb4083df7248f58` | 4935812536 | `edaccdb6db715330457139ee8b97606b` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/d57d948ece4837d850b7a859a4415121d57cacf8b9ee1d4db200c67f592902d7` | 4983103192 | `6a2f915f0ea502838c5e92b8ac41f219` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/d6e524b3fffede1787a74e81b30976dce5400c4439ba64222168e607ed19e793` | 507591892 | `3f80444947443d8f36c0ed2497c20c8d` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/e672f7dcb7f46458f8edc218669bc25d7ab1fc48bec53e8bd5b957bc1386a5e4` | 1261596224 | `7373078cff5019be50c12b581a3fc4f0` |
| `huggingface/models--Wan-AI--Wan2.2-Animate-2-14B-Distilled-Diffusers/blobs/eda459bcd5fe68a5a6fea6e758fe0f70466d31c3f53d54fc443aca876884a2d2` | 2985521896 | `017a186a7268cacf08dff2cb2146fa7d` |
| `models/Wan2.2-T2V-A14B-Diffusers/text_encoder/model-00001-of-00003.safetensors` | 4935812536 | `edaccdb6db715330457139ee8b97606b` |
| `models/Wan2.2-T2V-A14B-Diffusers/text_encoder/model-00002-of-00003.safetensors` | 4983103192 | `6a2f915f0ea502838c5e92b8ac41f219` |
| `models/Wan2.2-T2V-A14B-Diffusers/text_encoder/model-00003-of-00003.safetensors` | 1442935480 | `5c2935971f033bb456ee5d4541dadf97` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00001-of-00012.safetensors` | 4863171808 | `5e7d392a77f22f253a0eef25dd7d8adc` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00002-of-00012.safetensors` | 4919594456 | `ed2f85a7ef921a3fae5255c41910df2b` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00003-of-00012.safetensors` | 4919465128 | `c5353ac8574e43ff0cbbcbbf2c54ed79` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00004-of-00012.safetensors` | 4919594536 | `b7c9d5d752116abffb4cd962d75cd8ea` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00005-of-00012.safetensors` | 4919465224 | `20cd76037239b54aab38fc777a6ae585` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00006-of-00012.safetensors` | 4919594552 | `95efd3b411607d2f2ecb305bea1530ad` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00007-of-00012.safetensors` | 4919465224 | `ead79679ca61d2239f38f7304f079b42` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00008-of-00012.safetensors` | 4919594552 | `b192075133ad4ffe0298bf6b72c97285` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00009-of-00012.safetensors` | 4919465224 | `311645030e975b83f0e18e1ab991ac37` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00010-of-00012.safetensors` | 4919594552 | `38f3732a7eb345b61cf751abd0ddd18f` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00011-of-00012.safetensors` | 4919465224 | `8a300026f444e24a325eda9b96ad3415` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer/diffusion_pytorch_model-00012-of-00012.safetensors` | 3095607280 | `af244900f4b1d1af9bdbb32af876a0a2` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00001-of-00012.safetensors` | 4863171808 | `9963971882bc658128833cb9624edb4a` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00002-of-00012.safetensors` | 4919594456 | `87f73c93175c55328911301220b4a1b5` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00003-of-00012.safetensors` | 4919465128 | `0eb06ee189baebf6de3236da63cfa621` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00004-of-00012.safetensors` | 4919594536 | `b70b4c46cb5a704e2545855c97f42348` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00005-of-00012.safetensors` | 4919465224 | `734e2e49a47a84a2ff97f66b1ab93bc6` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00006-of-00012.safetensors` | 4919594552 | `276c8863f75a130fcf44af05eb49ee2d` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00007-of-00012.safetensors` | 4919465224 | `7b6278ac64be6d569aecdefadd867c7e` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00008-of-00012.safetensors` | 4919594552 | `dd5da12295d72a17e9ff11d8790ec840` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00009-of-00012.safetensors` | 4919465224 | `96feb59f5ce958772c6ce530367d95dc` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00010-of-00012.safetensors` | 4919594552 | `47ebc0d45c04bea2a636644be7d63d52` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00011-of-00012.safetensors` | 4919465224 | `217f7e1d74fd89cffb25adce8e89920e` |
| `models/Wan2.2-T2V-A14B-Diffusers/transformer_2/diffusion_pytorch_model-00012-of-00012.safetensors` | 3095607280 | `5a8696f310c5dfc8bbf4a44be188db51` |
| `models/Wan2.2-T2V-A14B-Diffusers/vae/diffusion_pytorch_model.safetensors` | 507591892 | `3f80444947443d8f36c0ed2497c20c8d` |
| `omniserve/huggingface/hub/models--PeiqingYang--MatAnyone/blobs/07f2a00683e6aec3d62f1cb0b13b7bbe45622d06355443f2861767074a6ec7b1` | 141199924 | `6dc46b6a65f815716fc5365bdcc0b219` |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00001-of-00004.bin` | 4986384514 | `d6950a3a743ffb2168a4407c5e45a3f1` |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00002-of-00004.bin` | 4953820252 | `a9b53be0922cdf486924bf20cceae5e8` |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00003-of-00004.bin` | 4990606344 | `af1a89a653230db5964505812662ce5d` |
| `wan-animate-fp8-transformer-v1/diffusion_pytorch_model-00004-of-00004.bin` | 2028850270 | `e9d32b22dae119a8221f381696d0c859` |

## `r2died41lj` manifold-music3-models-nc1 (US-NC-1, 100 GB)

Restore prefix: `runpod-volume-archive/r2died41lj-manifold-music3-models-nc1/`

### Attached endpoints (before detach)

| Endpoint | Name | Template | GPU types | GPUs | workers min/max/standby | idle | exec timeout ms | flashboot | networkVolumeIds |
|---|---|---|---|---|---|---|---|---|---|
| `abtkpd80glwpme` | omniserve-minimax-music3-xfast | `aitkinqty1` | NVIDIA H200, NVIDIA H100 PCIe, NVIDIA H100 80GB HBM3, NVIDIA H100 NVL, NVIDIA RTX PRO 6000 Blackwell Server Edition, NVIDIA A100 80GB PCIe, NVIDIA A100-SXM4-80GB | 1 | 0/0/3 | 5s | 2400000 | true | r2died41lj |
| `lm0zg9x5ffivf6` | omniserve-minimax-music3-standard | `aitkinqty1` | NVIDIA H200, NVIDIA H100 PCIe, NVIDIA H100 80GB HBM3, NVIDIA H100 NVL, NVIDIA RTX PRO 6000 Blackwell Server Edition, NVIDIA A100 80GB PCIe, NVIDIA A100-SXM4-80GB | 1 | 0/0/1 | 20s | 2400000 | true | r2died41lj |
| `o9454204o9ckwc` | omniserve-minimax-music3-bf16 | `3fhcowzvs2` | NVIDIA H200, NVIDIA H100 PCIe, NVIDIA H100 80GB HBM3, NVIDIA H100 NVL, NVIDIA RTX PRO 6000 Blackwell Server Edition, NVIDIA A100 80GB PCIe, NVIDIA A100-SXM4-80GB | 1 | 0/0/1 | 20s | 2400000 | true | r2died41lj |

### Templates

| Template | Name | Image | Container disk GB | Mount |
|---|---|---|---|---|
| `3fhcowzvs2` | omniserve-minimax-music3-bf16 | `hongccc/sglang-omni@sha256:374d0b1c30b2bff685b1716fc64a02ad3b3d0a90fe2ce73ce9861a6992c28101` | 60 | /workspace |
| `aitkinqty1` | omniserve-minimax-music3 | `hongccc/sglang-omni@sha256:374d0b1c30b2bff685b1716fc64a02ad3b3d0a90fe2ce73ce9861a6992c28101` | 60 | /workspace |

### Contents by directory

| Directory | Files | GiB |
|---|---|---|
| `models/minimax-music3` | 180 | 53.41 |
| `omniserve/music3` | 12399 | 0.65 |
| `huggingface/xet` | 1 | 0.00 |
| `huggingface/hub` | 1 | 0.00 |

### Files >= 100 MB (full list in R2 manifest)

| Path | Bytes | md5 |
|---|---|---|
| `models/minimax-music3/condition_encoder/diffusion_pytorch_model.safetensors` | 100671852 | `5fc31ff33d918bca573c8d81769aa092` |
| `models/minimax-music3/dav.pth` | 491817450 | `bb45eec1d2f2bb88a19c71c517cca419` |
| `models/minimax-music3/flowmatching_vae.pth` | 9828468476 | `4ce6bc6d98570b29e000a3dbcc01d496` |
| `models/minimax-music3/language_model/model-00001-of-00004.safetensors` | 4910103856 | `b56457434f9b43956abcf6e039514a54` |
| `models/minimax-music3/language_model/model-00002-of-00004.safetensors` | 4915960352 | `c7aca8f9ac202403c135c3e66095a6a6` |
| `models/minimax-music3/language_model/model-00003-of-00004.safetensors` | 4983068496 | `e3ffcb94399321fd12b55b3a09d8a447` |
| `models/minimax-music3/language_model/model-00004-of-00004.safetensors` | 2359864688 | `ee9db78f61b25e875a5624db9525535f` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00000-of-00048.safetensors` | 1638400144 | `646c3fa166e72e9694a7012a84a22ce2` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00002-of-00048.safetensors` | 285230720 | `d4844873a26602c4ce59e02dcd106339` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00003-of-00048.safetensors` | 385894144 | `135b648ee6f01ce853ad8ad49d7ed047` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00004-of-00048.safetensors` | 385894144 | `1db5d16ac7d621d66e17a993af5b0857` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00005-of-00048.safetensors` | 385894144 | `720d2afb3a6dfb49fc505d270240c870` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00006-of-00048.safetensors` | 385894144 | `696a5b4cfa777630bc7d7cbded9f64e8` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00007-of-00048.safetensors` | 385894144 | `6dbcc60f7104794a983db21f053c7cc0` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00008-of-00048.safetensors` | 385894144 | `d609162b92d7b076a3b27f939c6f2750` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00009-of-00048.safetensors` | 385894144 | `a0c45354fed49a4e3099cc12f6c52247` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00010-of-00048.safetensors` | 385894144 | `9fc73a187d46dd3a74be7b7c6ad1f2f9` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00011-of-00048.safetensors` | 385894144 | `436844ff458a8adabccb4c6150480118` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00012-of-00048.safetensors` | 385894144 | `dd6ff41867d5310bf5ad71f9acac5f8f` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00013-of-00048.safetensors` | 385894152 | `b93a10db17644c8fe293b784aca6d9ed` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00014-of-00048.safetensors` | 385894152 | `628449168138a348ceb3cab81ea1241b` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00015-of-00048.safetensors` | 385894152 | `b07437663951962086a3b4edca51f198` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00016-of-00048.safetensors` | 385894152 | `8c0a20335b04b5b67c539955d6c4fe2e` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00017-of-00048.safetensors` | 385894152 | `13babb2eef50b526ec7a62bebded3bed` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00018-of-00048.safetensors` | 385894152 | `97f331d8b4429e0127b791d26ccbf3fb` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00019-of-00048.safetensors` | 385894152 | `6eee2d0870ac8f51c7115c3f4b346555` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00020-of-00048.safetensors` | 385894152 | `9479905bde3585ea0fdef2b95c3e6012` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00021-of-00048.safetensors` | 385894152 | `ad8312b4df1e01d7b7d28168c7e1bcce` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00022-of-00048.safetensors` | 385894152 | `6907ac769cb5a51d4018080451d9f8a0` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00023-of-00048.safetensors` | 385894152 | `6ad77d54e8ede4a3d17e1717a6381258` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00024-of-00048.safetensors` | 385894152 | `4f812671b346b3b5ae6e68276ab42f4e` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00025-of-00048.safetensors` | 385894152 | `6c784d8a93440d763246d4116c138126` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00026-of-00048.safetensors` | 385894152 | `d44e3fb3d343729c964a06f5c6c37646` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00027-of-00048.safetensors` | 385894152 | `0133994dc7f28c1f4047b83f74f02273` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00028-of-00048.safetensors` | 385894152 | `f2f88e0892492bd587fc2fb6ba5da125` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00029-of-00048.safetensors` | 385894152 | `d8e38ef525f3afe563cec5f142509e4e` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00030-of-00048.safetensors` | 385894152 | `961d87e6c656ed2384ae354118695436` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00031-of-00048.safetensors` | 385894152 | `1c060d526bca82588a4c06bd9f8348d0` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00032-of-00048.safetensors` | 385894152 | `db1f7cf550310e593d99cc6ab90815fd` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00033-of-00048.safetensors` | 385894152 | `983181bfd067c0eb1fb8dd039271e4bc` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00034-of-00048.safetensors` | 385894152 | `c42ca00988f6a9a1b36470847d378474` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00035-of-00048.safetensors` | 385894152 | `7fcbe588cb164d1250c7d5c63a86bd17` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00036-of-00048.safetensors` | 385894152 | `da6442b0ced7bbc1b8f6867040ee14dd` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00037-of-00048.safetensors` | 385894152 | `52cafd8b5e850e4393f582f46fcfabaa` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00038-of-00048.safetensors` | 1739071824 | `53f0e0c4a32b4577d5dcf80e636d229a` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00042-of-00048.safetensors` | 109060744 | `a89b00fb8e09ad5d4397529f9487e542` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00043-of-00048.safetensors` | 285230240 | `566de7c2f354138a9e14b00662c25b20` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00044-of-00048.safetensors` | 285230240 | `4dcb917fa67eaf5da2cbf421583b1574` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00045-of-00048.safetensors` | 285230240 | `39bdb0ac0362159fb7b838dd0bdf2e10` |
| `models/minimax-music3/qwen_7B/qwen_7B/model-00046-of-00048.safetensors` | 184566536 | `8d0bc460599b2f42472529fa3bf93e64` |
| `models/minimax-music3/rvq_depth_decoder/diffusion_pytorch_model.safetensors` | 1292055248 | `138764e5a459428f515ae7b381042d1b` |
| `models/minimax-music3/transformer/diffusion_pytorch_model-00001-of-00002.safetensors` | 4959921384 | `5d6306ad4cae061d4cdd258151c20305` |
| `models/minimax-music3/transformer/diffusion_pytorch_model-00002-of-00002.safetensors` | 4767750800 | `a0d697a5f97314eb91c222b8994fb982` |
| `models/minimax-music3/vocoder/diffusion_pytorch_model.safetensors` | 216695272 | `bbdff88c4ec2e438c993b7cd51f7eb4a` |

## `gz226u7mrl` manifold-h3-control-models-ca3 (CA-MTL-3, 256 GB)

Restore prefix: `runpod-volume-archive/gz226u7mrl-manifold-h3-control-models-ca3/`

### Attached endpoints (before detach)

| Endpoint | Name | Template | GPU types | GPUs | workers min/max/standby | idle | exec timeout ms | flashboot | networkVolumeIds |
|---|---|---|---|---|---|---|---|---|---|
| `0464l4kizwvlzo` | manifold-h3-control-union-is | `xynpyccyhg` | NVIDIA H200, NVIDIA H100 80GB HBM3 | 1 | 0/0/3 | 5s | 14400000 | true | gz226u7mrl |

### Templates

| Template | Name | Image | Container disk GB | Mount |
|---|---|---|---|---|
| `xynpyccyhg` | manifold-h3-control-union-cu130-v12 | `ghcr.io/lee101/manifold-h3-control@sha256:51ba1e426bfb3d645855f80b7981811377a44476cc578fe6aab0850e482281fa` | 50 | /workspace |

### Contents by directory

| Directory | Files | GiB |
|---|---|---|
| `models/minimax-h3` | 121 | 134.16 |
| `models/minimax-h3-control` | 9 | 6.34 |
| `huggingface/xet` | 1 | 0.03 |
| `huggingface/hub` | 2 | 0.00 |

### Files >= 100 MB (full list in R2 manifest)

| Path | Bytes | md5 |
|---|---|---|
| `models/minimax-h3-control/MiniMax-H3-Fun-Controlnet-Union.safetensors` | 6806843904 | `1616e57cda583665a89a55962a1b72b6` |
| `models/minimax-h3/audio_vae/diffusion_pytorch_model.safetensors` | 605429340 | `8205d28c7bf52e6bf0aa5d745fabb8e7` |
| `models/minimax-h3/text_encoder/model-00001-of-00014.safetensors` | 4932328944 | `aa61403f6e4abfae2db9cff794c32b5e` |
| `models/minimax-h3/text_encoder/model-00002-of-00014.safetensors` | 4875990528 | `abaad4e80cd75e9264813afa786a6a3a` |
| `models/minimax-h3/text_encoder/model-00003-of-00014.safetensors` | 4875990552 | `a429a3ebc4387ae4c828f5b5f373fb3c` |
| `models/minimax-h3/text_encoder/model-00004-of-00014.safetensors` | 4875990584 | `a1d59f31324eb578ccaec987a54a386e` |
| `models/minimax-h3/text_encoder/model-00005-of-00014.safetensors` | 4875990584 | `98902f76f45f40da2a5652092039a16a` |
| `models/minimax-h3/text_encoder/model-00006-of-00014.safetensors` | 4875990584 | `266753850edb906600c8f8bc8ce585a3` |
| `models/minimax-h3/text_encoder/model-00007-of-00014.safetensors` | 4875990584 | `4c065c49eedb66a8b49ca26cff030973` |
| `models/minimax-h3/text_encoder/model-00008-of-00014.safetensors` | 4875990584 | `dbe46cd27b37bc81c1f182f9a538f3a7` |
| `models/minimax-h3/text_encoder/model-00009-of-00014.safetensors` | 4875990584 | `dd9be30d59ed42bc303e1fb5ea21ca5d` |
| `models/minimax-h3/text_encoder/model-00010-of-00014.safetensors` | 4875990584 | `241cc6cdb52ba39f241ee1d39cebeacb` |
| `models/minimax-h3/text_encoder/model-00011-of-00014.safetensors` | 4875990584 | `4f7bfdb3fb15a03021d19acbadc42376` |
| `models/minimax-h3/text_encoder/model-00012-of-00014.safetensors` | 4875990584 | `586a62f548697b7743db6d70e8ea07bf` |
| `models/minimax-h3/text_encoder/model-00013-of-00014.safetensors` | 4875990584 | `504516a937d5fbacbc4c0462791797d2` |
| `models/minimax-h3/text_encoder/model-00014-of-00014.safetensors` | 3270697008 | `cfbc67c2e03b7dfc993264b530da46a9` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00001-of-00014.safetensors` | 4825958704 | `130f2c4a80d53374b84017cce0b3e609` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00002-of-00014.safetensors` | 4702158032 | `e0c614b8d1bd7a787d58e5361fe7a044` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00003-of-00014.safetensors` | 4933368192 | `df27176066764684d991b1b6e25ff90a` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00004-of-00014.safetensors` | 4567069608 | `77fc6efc66c7e90764e031049033bec4` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00005-of-00014.safetensors` | 4702158080 | `3d1506d4d5246778f6ab0ab5efcad828` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00006-of-00014.safetensors` | 4933368232 | `dd790d4349064e304f4c584e859216f8` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00007-of-00014.safetensors` | 4567069608 | `6b3d584824040dad0c1c0e1fd0a7a7bc` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00008-of-00014.safetensors` | 4702158080 | `5296b62f02ec9ed24791ac3a86001c66` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00009-of-00014.safetensors` | 4933368232 | `fe0cda55a5d1e2c7e0ef5e281915a7b7` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00010-of-00014.safetensors` | 4567069608 | `a83319139bb2d24ebcdc23083836024a` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00011-of-00014.safetensors` | 4702158080 | `9f33292f067cb81145a6751ed1ad26d7` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00012-of-00014.safetensors` | 4933368232 | `6857d9beceea06cb03e9be145ba0d548` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00013-of-00014.safetensors` | 4567069608 | `878cb1b4fecdd307ccda335a169d4ff3` |
| `models/minimax-h3/transformer/diffusion_pytorch_model-00014-of-00014.safetensors` | 4644161920 | `04bf1f43f196cf15e529c9a71ddef667` |
| `models/minimax-h3/vae/diffusion_pytorch_model-00001-of-00003.safetensors` | 5061033024 | `6e9e707a3435bf6f1306cde8d3001f89` |
| `models/minimax-h3/vae/diffusion_pytorch_model-00002-of-00003.safetensors` | 4955986528 | `560bbc51136e22c816b5a37c921bf44b` |
| `models/minimax-h3/vae/diffusion_pytorch_model-00003-of-00003.safetensors` | 398539336 | `55790a39752ac58fe870eb076bddcd82` |


## Site gating (archived lanes fail fast)

`RUNPOD_ARCHIVED_ENDPOINT_IDS` in `/opt/manifoldgen-site/.env` (installed from the repo
`.env` by `deploy.sh`) lists every endpoint detached above:

`0464l4kizwvlzo,abtkpd80glwpme,lm0zg9x5ffivf6,o9454204o9ckwc,17g0r8olu6sdqf,5fzsapohpaz8nv,5t2pv78i1r46md,6p9elbqarsij1i,6s7lcwfj0vqudn,hibshx3abonecy,j1dkz8zzgo877l,l9j6n0xs4txpzn,mzshwf3el0a0zb,mzz277fr4rbdw0,nt4qaorj2z7sij,onljtw1jm5wa3h,p72bcfclcztu8w,zdi4qv9hx9w2wa`

While an endpoint is listed:

- `server/runpod_archive.go`: no scale-up (`workersMax`/`workersMin` > 0) and no `/run` is
  sent to it; scale-down is still allowed. Music3, H3 Control and the Wan Animate
  standard lane return HTTP 503 `{"error":"this model lane is archived: ...","archived":true}`
  before any charge or RunPod call. Video background removal skips its RunPod spill
  (local native, then fal). Music is unaffected while `YUE_RUNPOD_ENDPOINT_ID` is set.
- `GET /api/lane-status` and `GET /api/h3-control-eligibility` report the archived
  lanes; the H3 Control tools and the character animator's Standard tier show
  "Unavailable: archived".
- `scripts/runpod_cost_guard.py` (10-minute timer) sets `workersMin=0 workersMax=0` and
  alerts if a listed endpoint has any capacity, and never auto-restores it after a
  spend cap.

Restore = restore the volume (above), reattach it, then remove the endpoint id from
`RUNPOD_ARCHIVED_ENDPOINT_IDS` and redeploy (or edit `/opt/manifoldgen-site/.env` and
restart `manifoldgen.service`).
