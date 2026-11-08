#!/usr/bin/env python3
import argparse
import hashlib
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

REPOS = {
    "tapnet": ("https://github.com/google-deepmind/tapnet.git", "ceedd60bb9f6c9f7c74796e4445aff6c6ddf7c9b"),
    "alltracker": ("https://github.com/aharley/alltracker.git", "e7553135e7b361590dbccd10e2b274b024f41cd6"),
}
WEIGHTS = {
    "alltracker.pth": ("https://huggingface.co/aharley/alltracker/resolve/main/alltracker.pth", "ffd9ebcfb6d206d594b646999a150540f92c049cf9b2bf940facf7123f62aa1d"),
    "tapnextpp_ckpt.pt": ("https://storage.googleapis.com/dm-tapnet/tapnextpp/tapnextpp_ckpt.pt", "cb96a43444ccb4fbdb25d800b88c7ba196179a526e78f01b021a16b1c1eff6da"),
    "tapnextpp_512.ckpt": ("https://storage.googleapis.com/gresearch/tapnextpp/tapnextpp_512.ckpt", "6cd0e793fdcface3063d63f8ed3819bcf74c2c0468fe1fef85acee4de2f3609f"),
}
DEFAULT = ("alltracker.pth", "tapnextpp_ckpt.pt")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1 << 24):
            h.update(chunk)
    return h.hexdigest()


def clone(name: str, root: Path) -> None:
    url, sha = REPOS[name]
    dest = root / "src" / name
    if (dest / ".git").exists():
        head = subprocess.run(["git", "-C", str(dest), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
        if head == sha:
            print(f"ok   {name} {sha[:10]}")
            return
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not (dest / ".git").exists():
        subprocess.run(["git", "clone", "--filter=blob:none", "--no-checkout", url, str(dest)], check=True)
    subprocess.run(["git", "-C", str(dest), "fetch", "origin", sha], check=True)
    subprocess.run(["git", "-C", str(dest), "checkout", "--detach", sha], check=True)
    print(f"got  {name} {sha[:10]}")


def weight(name: str, root: Path) -> None:
    url, want = WEIGHTS[name]
    dest = root / "ckpt" / name
    if dest.exists() and (not want or sha256(dest) == want):
        print(f"ok   {name}")
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url) as r, open(tmp, "wb") as f:
        while chunk := r.read(1 << 24):
            f.write(chunk)
    got = sha256(tmp)
    if want and got != want:
        tmp.unlink()
        sys.exit(f"{name}: checksum mismatch {got}")
    tmp.replace(dest)
    print(f"got  {name} {got[:12]}" + ("" if want else "  (no pinned checksum, record it)"))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--home", default=os.environ.get("MOTIONTRACK_HOME") or str(Path.home() / ".cache" / "motiontrack"))
    ap.add_argument("--hq", action="store_true", help="also fetch the 512 px point tracker")
    a = ap.parse_args()
    root = Path(a.home)
    for name in REPOS:
        clone(name, root)
    for name in DEFAULT + (("tapnextpp_512.ckpt",) if a.hq else ()):
        weight(name, root)
    print(f"MOTIONTRACK_HOME={root}")


if __name__ == "__main__":
    main()
