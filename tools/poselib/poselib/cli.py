import argparse
import json
from pathlib import Path

from .shisei import import_shisei


def main():
    ap = argparse.ArgumentParser(prog="poselib")
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("import-shisei")
    s.add_argument("repo", type=Path)
    s.add_argument("--out", type=Path, default=Path("data"))
    d = sub.add_parser("depth")
    d.add_argument("--out", type=Path, default=Path("data"))
    d.add_argument("--only", default="shisei")
    b = sub.add_parser("build")
    b.add_argument("--out", type=Path, default=Path("data"))
    a = ap.parse_args()
    if a.cmd == "import-shisei":
        entries = import_shisei(a.repo, a.out)
        a.out.mkdir(parents=True, exist_ok=True)
        (a.out / "shisei.json").write_text(json.dumps(entries, ensure_ascii=False))
        print(f"{len(entries)} poses, {sum(len(e['views']) for e in entries)} views")
    elif a.cmd == "build":
        from .build import build
        build(a.out)
    elif a.cmd == "depth":
        from .depth import run
        run(a.out, a.only)


if __name__ == "__main__":
    main()
