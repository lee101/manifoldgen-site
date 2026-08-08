#!/usr/bin/env python3
"""Generate ManifoldGen logo (Z-Image + BiRefNet) and recompress gallery art to WebP q85."""

from __future__ import annotations

import argparse
import base64
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIMAGE = "http://127.0.0.1:8100"
OMNI = "http://127.0.0.1:8791"
IMAGES_DIR = Path("/nvme0n1-disk/manifoldgen-images/originals")
BRAND_DIR = ROOT / "frontend" / "public" / "brand"
PUBLIC_IMAGES = ROOT / "frontend" / "public" / "images"

LOGO_PROMPT = (
    "app product icon, abstract manifold ribbon loop knot, teal cyan emerald "
    "gradient, glossy soft lighting, centered composition, solid flat medium "
    "gray background #808080, no text, no letters, no watermark, clean logo mark"
)


def http_json(url: str, payload: dict, timeout: int = 300) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def http_bytes(url: str, payload: dict, timeout: int = 300) -> tuple[bytes, str]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "Accept": "*/*"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read(), resp.headers.get("Content-Type", "")


def cwebp_q85(src: Path, dst: Path, *, alpha: bool = False) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = ["cwebp", "-q", "85", "-m", "6"]
    if alpha:
        cmd += ["-alpha_q", "100"]
    cmd += [str(src), "-o", str(dst)]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def generate_logo(out_webp: Path) -> Path:
    print(f"[logo] Z-Image → {ZIMAGE}/generate_image")
    data = http_json(
        f"{ZIMAGE}/generate_image",
        {
            "prompt": LOGO_PROMPT,
            "width": 1024,
            "height": 1024,
            "num_inference_steps": 10,
            "seed": 10101,
        },
        timeout=360,
    )
    b64 = data.get("image_base64") or ""
    if not b64:
        raise SystemExit(f"zimage returned no image: {list(data)[:8]}")
    raw = Path("/tmp/mg_logo_raw.webp")
    raw.write_bytes(base64.b64decode(b64))
    print(f"[logo] raw {raw.stat().st_size} bytes")

    data_url = "data:image/webp;base64," + base64.b64encode(raw.read_bytes()).decode()
    print(f"[logo] BiRefNet → {OMNI}/v1/images/background-removals")
    cutout, ctype = http_bytes(
        f"{OMNI}/v1/images/background-removals",
        {"image_url": data_url, "format": "webp"},
        timeout=360,
    )
    cut_path = Path("/tmp/mg_logo_cutout.webp")
    # Sometimes JSON with b64
    if ctype.startswith("application/json") or cutout[:1] == b"{":
        payload = json.loads(cutout)
        if isinstance(payload, dict):
            nested = payload.get("image_base64") or payload.get("b64_json")
            if not nested and isinstance(payload.get("data"), list) and payload["data"]:
                nested = payload["data"][0].get("b64_json")
            if nested:
                cutout = base64.b64decode(nested)
            else:
                raise SystemExit(f"unexpected birefnet json: {list(payload)[:10]}")
    cut_path.write_bytes(cutout)
    print(f"[logo] cutout {cut_path.stat().st_size} bytes ({ctype})")

    # Normalize to WebP q85 with alpha preserved via convert→cwebp
    png = Path("/tmp/mg_logo_cutout.png")
    subprocess.check_call(["convert", str(cut_path), str(png)])
    cwebp_q85(png, out_webp, alpha=True)
    print(f"[logo] wrote {out_webp} ({out_webp.stat().st_size} bytes)")
    return out_webp


def recompress_gallery(directory: Path, dry_run: bool = False) -> None:
    files = sorted(directory.glob("*.webp")) + sorted(directory.glob("*.png")) + sorted(directory.glob("*.jpg"))
    print(f"[art] recompressing {len(files)} files in {directory} → webp q85")
    saved = 0
    before = 0
    after = 0
    for src in files:
        before += src.stat().st_size
        tmp = src.with_suffix(".q85.tmp.webp")
        try:
            # Detect alpha
            info = subprocess.check_output(["identify", "-format", "%A", str(src)], text=True).strip()
            has_alpha = info.upper() in {"TRUE", "BLEND"}
            if dry_run:
                print(f"  would recompress {src.name} alpha={has_alpha}")
                continue
            cwebp_q85(src, tmp, alpha=has_alpha)
            new_size = tmp.stat().st_size
            old_size = src.stat().st_size
            after += new_size
            if new_size < old_size or src.suffix.lower() != ".webp":
                dst = src if src.suffix.lower() == ".webp" else src.with_suffix(".webp")
                tmp.replace(dst)
                if dst != src and src.exists():
                    src.unlink()
                saved += old_size - new_size
                print(f"  {src.name}: {old_size} → {new_size}")
            else:
                tmp.unlink(missing_ok=True)
                after += old_size - new_size  # keep old
                after = after - new_size + old_size
                print(f"  {src.name}: keep ({old_size} <= {new_size})")
        except Exception as e:
            tmp.unlink(missing_ok=True)
            print(f"  FAIL {src.name}: {e}", file=sys.stderr)
            after += src.stat().st_size
    if not dry_run:
        print(f"[art] saved ~{saved/1024:.1f} KiB (before {before/1024:.1f} → after {after/1024:.1f} KiB)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--logo-only", action="store_true")
    ap.add_argument("--art-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--images-dir", type=Path, default=IMAGES_DIR)
    args = ap.parse_args()

    if not args.art_only:
        BRAND_DIR.mkdir(parents=True, exist_ok=True)
        PUBLIC_IMAGES.mkdir(parents=True, exist_ok=True)
        logo = generate_logo(BRAND_DIR / "logo.webp")
        # Also publish under images/ for cutedsl-style paths
        cwebp_q85(logo, PUBLIC_IMAGES / "logo.webp", alpha=True)
        # Square mark copy
        subprocess.check_call(
            ["convert", str(logo), "-resize", "512x512", "/tmp/mg_logo_mark.png"]
        )
        cwebp_q85(Path("/tmp/mg_logo_mark.png"), BRAND_DIR / "logo-mark.webp", alpha=True)

    if not args.logo_only:
        if args.images_dir.exists():
            recompress_gallery(args.images_dir, dry_run=args.dry_run)
        else:
            print(f"[art] skip missing {args.images_dir}")


if __name__ == "__main__":
    main()
