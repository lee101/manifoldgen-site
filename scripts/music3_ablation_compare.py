#!/usr/bin/env python3
import argparse
import json
import pathlib
import sys

import numpy as np

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import music3_quality_metrics as qm

KEYS = ["echo_score", "spectral_flatness", "hf_ratio", "crest_db", "stereo_corr", "side_mid_db", "onset_sharpness", "mod_smear", "rms_dbfs"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--jam", type=pathlib.Path, required=True)
    ap.add_argument("--reference", nargs="*", default=[])
    ap.add_argument("--json", default=None)
    ap.add_argument("run_dir", type=pathlib.Path)
    a = ap.parse_args()
    configs = sorted(p for p in a.run_dir.iterdir() if p.is_dir())
    model = qm.load_clap()
    refs = qm.collect(a.reference, cap=40)
    R = np.stack([qm.clap_embed(model, qm.to48(p)) for p in refs]) if refs else None
    cen = R.mean(0) / np.linalg.norm(R.mean(0)) if R is not None else None
    jam_files = sorted(a.jam.glob("*.wav"))
    jam = {p.stem: (qm.analyze(str(p)), qm.clap_embed(model, qm.to48(str(p)))) for p in jam_files}
    groups = {"jam": [dict(m, clap_ref=float(e @ cen) if cen is not None else None, pair=1.0) for m, e in jam.values()]}
    embs = {"jam": np.stack([e for _, e in jam.values()])}
    for c in configs:
        rows, E = [], []
        for p in sorted(c.glob("*.wav")):
            m = qm.analyze(str(p))
            e = qm.clap_embed(model, qm.to48(str(p)))
            E.append(e)
            j = jam.get(p.stem)
            rows.append(dict(m, clap_ref=float(e @ cen) if cen is not None else None, pair=float(e @ j[1]) if j else None))
        groups[c.name] = rows
        embs[c.name] = np.stack(E)
    cols = KEYS + ["clap_ref", "pair"]
    print(f"{'config':12} {'n':>2} " + " ".join(f"{k[:9]:>9}" for k in cols) + f" {'fad_jam':>8}" + (f" {'fad_ref':>8}" if R is not None else ""))
    for name, rows in groups.items():
        vals = [np.mean([r[k] for r in rows if r.get(k) is not None]) if any(r.get(k) is not None for r in rows) else float("nan") for k in cols]
        fj = qm.fad(embs[name], embs["jam"]) if name != "jam" else 0.0
        line = f"{name:12} {len(rows):>2} " + " ".join(f"{v:9.3f}" for v in vals) + f" {fj:8.3f}"
        if R is not None:
            line += f" {qm.fad(embs[name], R):8.3f}"
        print(line)
    print("\nper-song paired CLAP (row=config, col=song):")
    songs = sorted(jam)
    print(f"{'config':12} " + " ".join(f"{s[:8]:>8}" for s in songs))
    for name, rows in groups.items():
        if name == "jam":
            continue
        by = {pathlib.Path(r["file"]).stem: r for r in rows}
        print(f"{name:12} " + " ".join(f"{by[s]['pair']:8.3f}" if s in by and by[s]["pair"] is not None else f"{'-':>8}" for s in songs))
    if a.json:
        pathlib.Path(a.json).write_text(json.dumps({k: [{kk: vv for kk, vv in r.items()} for r in v] for k, v in groups.items()}, indent=1))


if __name__ == "__main__":
    main()
