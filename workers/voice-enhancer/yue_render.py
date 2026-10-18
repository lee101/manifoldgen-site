"""YuE2 renderer, run inside the yue-cog virtualenv (it pins its own torch/yue2).

Rap lyrics leave the planner without a length cue: its ABC is one long verse of
vocal rests, sometimes 380 s for 140 s of lyrics, and the semantic stage then
fills the surplus with invented words or a long empty vamp. With
``--vocal-seconds`` the plan is generated first, cut to the bars the lyrics need,
and closed with a short outro, so generation itself stops early.
"""
import argparse
import json
import math
import os
import re
import time

os.environ.setdefault("HF_HOME", "/vfast/data/.cache/huggingface")

MODEL_REVISION = "14fc6c6f146441b1dd6363fcb2e01e82a6914cb7"
VAE_REVISION = "9a94e1d0ea9f8087e98f77fa88df4a4068104d2a"


def fit_plan(abc: str, vocal_seconds: float, outro_bars: int = 4) -> tuple[str, dict]:
    """Truncate/extend an ABC plan to intro + ``vocal_seconds`` + outro, in whole 4-bar blocks."""
    q = int(re.search(r"Q:1/4=(\d+)", abc).group(1))
    bar = 240.0 / q
    header, _, body = abc.partition("\n% ")
    body = "% " + body
    sections = re.split(r"\n(?=% )", body)
    blocks = []  # (section name, "V: Vocal...V: Ins..." text, bars)
    for section in sections:
        name, _, rest = section.partition("\n")
        for chunk in re.findall(r"V: Vocal\n.*?\nV: Ins\n.*?(?=\nV: Vocal|\Z)", rest, flags=re.S):
            rows = chunk.strip("\n").split("\n")
            # A plan cut off by the token cap ends mid-block; keep only whole ones.
            if len(rows) != 4 or rows[1].count("|") != rows[3].count("|") or not rows[3].rstrip().endswith("|"):
                continue
            blocks.append((name.strip(), "\n".join(rows), rows[1].count("|")))
    if not blocks:
        raise ValueError("unrecognised ABC plan")
    intro = [b for b in blocks if b[0] == "% intro"] or blocks[:1]
    body_blocks = [b for b in blocks if b[0] not in ("% intro", "% outro")] or blocks
    need = math.ceil(vocal_seconds / bar)
    chosen, have = [], 0
    i = 0
    while have < need:
        block = body_blocks[i % len(body_blocks)]
        chosen.append(block)
        have += block[2]
        i += 1
    outro_src = ([b for b in blocks if b[0] == "% outro"] or intro)[0]
    lines = outro_src[1].split("\n")
    trim = lambda line: "|".join(line.split("|")[:outro_bars]) + "|"  # noqa: E731
    outro = "\n".join([lines[0], trim(lines[1]), lines[2], trim(lines[3])])
    parts, current = [header.rstrip("\n")], None
    for name, text, _ in intro + chosen:
        if name != current:
            parts.append(name)
            current = name
        parts.append(text)
    parts += ["% outro", outro]
    total = sum(b[2] for b in intro + chosen) + outro_bars
    return "\n".join(parts) + "\n", {"bpm": q, "bars": total, "planned_seconds": round(total * bar, 1),
                                     "intro_seconds": round(sum(b[2] for b in intro) * bar, 1)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lyrics", required=True)
    ap.add_argument("--style", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--seeds", default="831001")
    ap.add_argument("--cot", default="full")
    ap.add_argument("--tokens", type=int, default=6000)
    ap.add_argument("--abc", default="")
    ap.add_argument("--cfg", type=float, default=0)
    ap.add_argument("--vocal-seconds", type=float, default=0, help="fit the plan to this much vocal")
    a = ap.parse_args()
    from yue2 import YuE2Pipeline
    from yue2.protocol import GenerationConfig
    try:
        # yue-cog image: reuse verified checkpoint digests within a warm worker
        # instead of re-hashing 7 GB on every render call (~27 s each).
        import sys
        sys.path.insert(0, os.getenv("YUE_COG_ROOT", "/src"))
        from weight_cache import install_verified_hash_cache
        install_verified_hash_cache()
    except ImportError:
        pass
    pipe = YuE2Pipeline.from_pretrained("m-a-p/YuE2-3B", revision=MODEL_REVISION, vae_revision=VAE_REVISION,
                                        device="cuda", backend="torch", memory_budget_gib=20, offload_ar=True,
                                        generation_config=GenerationConfig(ode_steps=32), progress=False)
    lyrics = open(a.lyrics).read()
    fixed_abc = open(a.abc).read() if a.abc else None
    os.makedirs(a.out, exist_ok=True)
    for seed in [int(s) for s in a.seeds.split(",")]:
        started = time.time()
        kw = dict(style=a.style, lyrics=lyrics, cot=a.cot, seed=seed)
        if a.cfg:
            kw["cfg_scale"] = a.cfg
        info = {}
        abc = fixed_abc
        if abc is None and a.vocal_seconds:
            # Only the first few 4-bar patterns are reused, so a short plan is enough.
            plan = pipe.plan(abc_sampling={"max_tokens": 1100}, **kw)
            abc, info = fit_plan(plan.abc, a.vocal_seconds)
            info["plan_s"] = round(time.time() - started, 1)
        if abc:
            kw["abc"] = abc
        tokens = min(a.tokens, int(info["planned_seconds"] * 25 + 150)) if info else a.tokens
        song = pipe(semantic_sampling={"max_tokens": tokens}, **kw)
        directory = f"{a.out}/seed{seed}"
        song.save_artifacts(directory)
        row = {"seed": seed, "secs": round(len(song.audio) / 48000, 2), "wall": round(time.time() - started, 1),
               "trunc": song.truncated, "tokens_cap": tokens, **info}
        with open(f"{directory}/render.json", "w") as handle:
            json.dump(row, handle)
        print(json.dumps(row), flush=True)


if __name__ == "__main__":
    main()
