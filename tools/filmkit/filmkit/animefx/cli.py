"""animefx CLI. `animefx list --json` is the machine-readable tool manifest for agents."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import load_recipe, render_batch, render_still, render_video
from .fx import FX, list_effects


def _inline_layers(items: list[str]) -> list[dict]:
    """--fx 'surprise:at=2,dur=.6,ease=decay,strength=1.2'"""
    layers = []
    for item in items:
        name, _, rest = item.partition(":")
        layer: dict = {"fx": name}
        for kv in filter(None, rest.split(",")):
            k, _, v = kv.partition("=")
            try:
                layer[k] = json.loads(v)
            except ValueError:
                layer[k] = v
        layers.append(layer)
    return layers


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(prog="animefx")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("list", help="list effects and their parameters")
    p.add_argument("--json", action="store_true")
    for name in ("video", "still"):
        p = sub.add_parser(name)
        p.add_argument("src")
        p.add_argument("dst")
        p.add_argument("--recipe", help="recipe JSON file or inline JSON")
        p.add_argument("--fx", action="append", default=[], help="inline layer name:k=v,k=v")
        if name == "still":
            p.add_argument("--t", type=float, default=0.0, help="time in seconds the effects are evaluated at")
        else:
            p.add_argument("--crf", type=int, default=15)
    p = sub.add_parser("sheet", help="contact sheet of an effect over time on a still")
    p.add_argument("src")
    p.add_argument("dst")
    p.add_argument("--recipe")
    p.add_argument("--fx", action="append", default=[])
    p.add_argument("--times", default="0,0.15,0.4,0.9")
    a = ap.parse_args(argv)

    if a.cmd == "list":
        data = list_effects()
        if a.json:
            print(json.dumps(data, indent=2))
        else:
            for e in data:
                print(f"{e['fx']:<14}{e['group']:<11}{e['description']}")
        return 0
    spec = load_recipe(a.recipe) if a.recipe else {"layers": []}
    spec = {**spec, "layers": list(spec.get("layers", [])) + _inline_layers(a.fx)}
    if a.cmd == "still":
        print(render_still(a.src, a.dst, spec, a.t))
    elif a.cmd == "video":
        print(json.dumps(render_video(a.src, a.dst, spec, crf=a.crf)))
    else:
        import cv2
        import numpy as np
        tiles = []
        for t in [float(x) for x in a.times.split(",")]:
            tmp = Path(a.dst).with_suffix(f".t{t}.png")
            render_still(a.src, tmp, spec, t)
            im = cv2.imread(str(tmp))
            tiles.append(cv2.resize(im, (640, int(im.shape[0] * 640 / im.shape[1]))))
            tmp.unlink()
        cols = 2
        rows = [np.hstack(tiles[i:i + cols] + [np.zeros_like(tiles[0])] * (cols - len(tiles[i:i + cols]))) for i in range(0, len(tiles), cols)]
        cv2.imwrite(a.dst, np.vstack(rows))
        print(a.dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
