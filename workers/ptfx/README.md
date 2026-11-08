# ptfx: GPU interpreter for the tracked-fx tools

Runs `track-blur`, `sticky-overlay`, `flow-fx`, `reactive-fx` and `mask-propagate` (code in `../motiontrack/motiontrack/pt*.py`). The server picks this interpreter through `PRODKIT_PTFX_PYTHON`; until it is set those services answer "not available on this server".

## Install (once per host, as the service user)

```
cd /opt/manifoldgen-site/workers/ptfx
uv sync --frozen --no-dev
MOTIONTRACK_HOME=$PWD/.home .venv/bin/python fetch_assets.py          # --hq adds the 512 px point tracker
MOTIONTRACK_HOME=$PWD/.home MOTIONTRACK_CKPT_DIR=$PWD/.home/ckpt MOTIONTRACK_TAPNET_SRC=$PWD/.home/src/tapnet \
  MOTIONTRACK_ALLTRACKER_SRC=$PWD/.home/src/alltracker .venv/bin/python smoke.py
```

`fetch_assets.py` clones the two tracker repos at pinned commits and downloads the weights with pinned sha256 (refuses a mismatch). `smoke.py` renders all five tools on a 2 s synthetic clip and exits non-zero on any failure or when no CUDA device is visible. `deploy.sh` rsyncs this directory (without `.venv/` and `.home/`).

The lock pins torch from the cu128 wheel index, which needs NVIDIA driver 570 or newer (the default PyPI wheel is cu13 and silently falls back to CPU on older drivers). On a newer driver switch the index in `pyproject.toml` and relock.

## Server env (`/opt/manifoldgen-site/.env`)

```
PRODKIT_PTFX_PYTHON=/opt/manifoldgen-site/workers/ptfx/.venv/bin/python
MOTIONTRACK_HOME=/opt/manifoldgen-site/workers/ptfx/.home
MOTIONTRACK_CKPT_DIR=/opt/manifoldgen-site/workers/ptfx/.home/ckpt
MOTIONTRACK_TAPNET_SRC=/opt/manifoldgen-site/workers/ptfx/.home/src/tapnet
MOTIONTRACK_ALLTRACKER_SRC=/opt/manifoldgen-site/workers/ptfx/.home/src/alltracker
PRODKIT_MOTION_SLOTS=1
```

The server forwards the `MOTIONTRACK_*` variables to the worker process. Keep `PRODKIT_MOTION_SLOTS` at 1 on a single-GPU host: one job holds the card (about 2 GB per tracker plus the frames).

Optional knobs (worker side): `MOTIONTRACK_AMP` (`off|fp16|bf16`, dense tracker defaults to fp16), `MOTIONTRACK_CACHE_DIR` (default `$MOTIONTRACK_HOME/cache`), `MOTIONTRACK_CACHE_MB` (default 3000), `MOTIONTRACK_CACHE=0` disables the track cache, `MOTIONTRACK_CPU_FX=1` forces the CPU render path.

## Warm worker (recommended)

A cold process spends most of a short job importing torch, initialising CUDA and loading both tracker models. `deploy/manifoldgen-ptfx.service` keeps them resident and takes jobs over a unix socket:

```
sudo install -m 644 deploy/manifoldgen-ptfx.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now manifoldgen-ptfx
echo 'PRODKIT_PTFX_SOCKET=/run/manifoldgen-ptfx/worker.sock' | sudo tee -a /opt/manifoldgen-site/.env
```

With `PRODKIT_PTFX_SOCKET` set the server sends each job's `args.json` path to the socket and reads back the exit code; if the socket is missing or refuses the connection it falls back to starting a process per job, so a worker restart never breaks the services. The service user must be able to read the job directories the server creates (same user, `www-data`).

## GPU sizing

Measured on an RTX 3090 Ti (`/vfast/data/code/trackeval/RESULTS.md`, `docs/motion-tools.md`):

| stage | VRAM | note |
| --- | --- | --- |
| sparse point tracker, 256 px | 2.1 GB | 19-36 fps; 512 px (`hq`) 2.9 GB at 6.7-11 fps |
| dense flow tracker at 640x352 | 1.8-1.9 GB | 4-frame pairs; 8 GB at 896 px long side |
| GPU render (flow-fx) | about 1 GB | 1280x720 float32 working set |

Peak per job is under 6 GB at the default 640 px tracking side, so any 16 GB card (A4000/A4500/4080-class, L4 24 GB, A10) runs it; a 24 GB card (3090/4090/L40S) leaves room for `track_side` 1024 and a second job. Throughput is bound by the sequential point tracker, which is latency-bound per frame rather than FLOP-bound, so a bigger GPU does not make a single job faster: prefer the cheapest 24 GB card.
