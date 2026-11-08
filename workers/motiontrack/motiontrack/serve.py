from __future__ import annotations

import json
import os
import socket
import sys
from pathlib import Path


def serve(path: str, preload: bool = False) -> None:
    from . import job, ptfx

    ptfx.KEEP_WARM = True
    if preload:
        probe = {"device": None}
        ptfx._backend(None, "sparse", probe)
        ptfx._backend(None, "dense", probe)
    sock = Path(path)
    sock.unlink(missing_ok=True)
    srv = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    old = os.umask(0o177)
    try:
        srv.bind(str(sock))
    finally:
        os.umask(old)
    srv.listen(8)
    print(f"serving {sock}", file=sys.stderr, flush=True)
    while True:
        conn, _ = srv.accept()
        with conn, conn.makefile("rwb") as f:
            line = f.readline().strip().decode()
            try:
                code = job.main([line]) if line else 2
            except BaseException as e:
                code = 1
                print(f"job crashed: {type(e).__name__}: {e}", file=sys.stderr, flush=True)
            f.write(json.dumps({"code": code}).encode() + b"\n")
            f.flush()
        _release()


def _release() -> None:
    try:
        import torch

        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass
