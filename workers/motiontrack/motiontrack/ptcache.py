from __future__ import annotations

import hashlib
import os
import time
from pathlib import Path

import numpy as np


def cache_dir() -> Path:
    from .ptbackend import home

    d = Path(os.environ.get("MOTIONTRACK_CACHE_DIR") or home() / "cache")
    d.mkdir(parents=True, exist_ok=True)
    return d


def cap_bytes() -> int:
    try:
        return int(float(os.environ.get("MOTIONTRACK_CACHE_MB", "3000")) * 1e6)
    except ValueError:
        return int(3e9)


def digest(*parts) -> str:
    h = hashlib.blake2b(digest_size=16)
    for part in parts:
        if isinstance(part, np.ndarray):
            a = np.ascontiguousarray(part)
            h.update(str((a.shape, a.dtype.str)).encode())
            h.update(memoryview(a).cast("B"))
        else:
            h.update(repr(part).encode())
    return h.hexdigest()


def evict(root: Path, cap: int) -> None:
    files = [(f.stat().st_mtime, f.stat().st_size, f) for f in root.glob("*.npz")]
    total = sum(s for _, s, _ in files)
    for _, size, f in sorted(files):
        if total <= cap:
            break
        try:
            f.unlink()
            total -= size
        except OSError:
            pass


class Cache:
    def __init__(self, root: Path | None = None, cap: int | None = None):
        self.root = root or cache_dir()
        self.cap = cap if cap is not None else cap_bytes()
        self.hits = 0
        self.misses = 0

    def get(self, key: str):
        f = self.root / f"{key}.npz"
        try:
            with np.load(f) as z:
                out = tuple(z[k] for k in sorted(z.files))
            os.utime(f, None)
            self.hits += 1
            return out
        except (OSError, ValueError, EOFError, KeyError):
            self.misses += 1
            return None

    def put(self, key: str, *arrays: np.ndarray) -> None:
        f = self.root / f"{key}.npz"
        tmp = self.root / f"{key}.{os.getpid()}.{time.time_ns()}.tmp.npz"
        try:
            np.savez(tmp, **{f"a{i}": a for i, a in enumerate(arrays)})
            os.replace(tmp, f)
            evict(self.root, self.cap)
        except OSError:
            tmp.unlink(missing_ok=True)


class CachedBackend:
    def __init__(self, inner, cache: Cache | None = None, tag: str = ""):
        self.inner = inner
        self.cache = cache or Cache()
        self.tag = f"{inner.name}:{tag}"
        self.name = inner.name
        self.enabled = True

    def __getattr__(self, item):
        return getattr(self.inner, item)

    def _go(self, kind: str, frames: np.ndarray, extra, fn):
        if not self.enabled:
            return fn()
        key = digest(kind, self.tag, extra, frames)
        got = self.cache.get(key)
        if got is not None:
            return got
        out = fn()
        self.cache.put(key, *out)
        return out

    def tracks(self, frames, queries):
        q = np.asarray(queries, np.float32)
        return self._go("tracks", frames, q, lambda: self.inner.tracks(frames, q))

    def consecutive_flow(self, frames, *a, **k):
        return self._go("cflow", frames, (a, sorted(k.items())), lambda: self.inner.consecutive_flow(frames, *a, **k))

    def flow_from_first(self, frames, *a, **k):
        return self._go("ffirst", frames, (a, sorted(k.items())), lambda: self.inner.flow_from_first(frames, *a, **k))
