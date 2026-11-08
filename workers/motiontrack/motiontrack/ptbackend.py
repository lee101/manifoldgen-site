from __future__ import annotations

import contextlib
import os
import sys
from pathlib import Path

import numpy as np


class BackendUnavailable(RuntimeError):
    pass


def home() -> Path:
    return Path(os.environ.get("MOTIONTRACK_HOME") or Path.home() / ".cache" / "motiontrack")


def src_dir(name: str) -> Path:
    return Path(os.environ.get(f"MOTIONTRACK_{name.upper()}_SRC") or home() / "src" / name)


def ckpt_path(name: str) -> Path:
    return Path(os.environ.get("MOTIONTRACK_CKPT_DIR") or home() / "ckpt") / name


def _need(path: Path, what: str) -> Path:
    if not path.exists():
        raise BackendUnavailable(f"{what} not found at {path}; set MOTIONTRACK_CKPT_DIR / MOTIONTRACK_*_SRC")
    return path


def _torch():
    try:
        import torch
    except ImportError as e:
        raise BackendUnavailable("GPU tracker backends need torch in the worker interpreter") from e
    return torch


def amp_mode(amp: str | None = None, default: str = "off") -> str:
    mode = (amp or os.environ.get("MOTIONTRACK_AMP") or default).lower()
    return mode if mode in ("off", "fp16", "bf16") else "off"


def amp_ctx(torch, device: str, mode: str):
    if mode != "off" and device.startswith("cuda"):
        return torch.autocast("cuda", dtype=torch.float16 if mode == "fp16" else torch.bfloat16)
    return contextlib.nullcontext()


def pick_device(device: str | None) -> str:
    torch = _torch()
    if device and device != "cpu":
        return device
    return "cuda" if torch.cuda.is_available() else "cpu"


class TapNextBackend:
    name = "sparse"

    def __init__(self, res: int = 256, device: str | None = None, amp: str | None = None):
        torch = _torch()
        self.torch = torch
        self.device = pick_device(device)
        self.amp = amp_mode(amp)
        self.tag = f"{res}:{self.amp}"
        ck = _need(ckpt_path("tapnextpp_512.ckpt" if res == 512 else "tapnextpp_ckpt.pt"), "point tracker weights")
        sys.path.insert(0, str(_need(src_dir("tapnet"), "point tracker source")))
        from tapnet.tapnextpp.votsp2026.model import TAPNextPP

        self.model = TAPNextPP.from_checkpoint(str(ck), device=self.device, input_resolution=res)

    def tracks(self, frames: np.ndarray, queries: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        q = np.asarray(queries, np.float32)
        pos, vis, state = [], [], None
        with self.torch.no_grad(), amp_ctx(self.torch, self.device, self.amp):
            for t in range(len(frames)):
                bgr = np.ascontiguousarray(frames[t][..., ::-1])
                if t == 0:
                    p, v, state = self.model.track_frame(bgr, q)
                else:
                    p, v, state = self.model.track_frame(bgr, state=state)
                pos.append(p)
                vis.append(v)
        return np.stack(pos).astype(np.float32), np.stack(vis).astype(bool)


class AllFlowBackend:
    name = "dense"

    def __init__(self, device: str | None = None, amp: str | None = None):
        torch = _torch()
        self.torch = torch
        self.device = pick_device(device)
        self.amp = amp_mode(amp)
        self.tag = self.amp
        ck = _need(ckpt_path("alltracker.pth"), "dense tracker weights")
        sys.path.insert(0, str(_need(src_dir("alltracker"), "dense tracker source")))
        from nets.alltracker import Net

        self.model = Net(seqlen=16, init_weights=False)
        sd = torch.load(str(ck), map_location="cpu", weights_only=False)
        self.model.load_state_dict(sd["model"], strict=True)
        self.model.to(self.device).eval()
        for prm in self.model.parameters():
            prm.requires_grad_(False)

    def _x(self, frames: np.ndarray):
        return self.torch.from_numpy(np.ascontiguousarray(frames)).to(self.device).permute(0, 3, 1, 2).float()

    def flow_from_first(self, frames: np.ndarray, iters: int = 4) -> tuple[np.ndarray, np.ndarray]:
        with self.torch.no_grad(), amp_ctx(self.torch, self.device, self.amp):
            flows, vc, _, _ = self.model.forward_sliding(self._x(frames)[None], iters=iters, sw=None, is_training=False)
        f = flows[0].permute(0, 2, 3, 1).half().cpu().numpy()
        c = vc[0, :, 1].half().cpu().numpy()
        return f, c

    def consecutive_flow(self, frames: np.ndarray, batch: int = 4, iters: int = 2) -> tuple[np.ndarray, np.ndarray]:
        x = self._x(frames)
        fl, cf = [], []
        with self.torch.no_grad(), amp_ctx(self.torch, self.device, self.amp):
            for i in range(0, len(x) - 1, batch):
                a, b = x[i:i + batch], x[i + 1:i + 1 + batch]
                n = min(len(a), len(b))
                pairs = self.torch.stack([a[:n], b[:n]], 1)
                out = self.model.forward_sliding(pairs, iters=iters, sw=None, is_training=False)
                fl.append(out[0].permute(0, 2, 3, 1).half().cpu().numpy())
                cf.append(out[1][:, 1].half().cpu().numpy())
        return np.concatenate(fl), np.concatenate(cf)


def load_sparse(res: int = 256, device: str | None = None, amp: str | None = None) -> TapNextBackend:
    return TapNextBackend(res, device, amp)


def load_dense(device: str | None = None, amp: str | None = None) -> AllFlowBackend:
    return AllFlowBackend(device, amp)
