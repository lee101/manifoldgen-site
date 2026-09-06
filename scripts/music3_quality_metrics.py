#!/usr/bin/env python3
import argparse
import hashlib
import io
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import numpy as np

SR = 32000
CLAP_SR = 48000
EXTS = {".wav", ".opus", ".mp3", ".flac"}
N_FFT = 4096
HOP = 1024
MAX_SEC = 180
CLAP_MAX_SEC = 60
CLAP_CHUNK_SEC = 10
CKPT_NAME = "music_audioset_epoch_15_esc_90.14.pt"
CKPT_URL = "https://huggingface.co/lukewys/laion_clap/resolve/main/" + CKPT_NAME


def eprint(*a):
    print(*a, file=sys.stderr)


def collect(paths, cap=None):
    out = []
    for p in paths or []:
        q = Path(p)
        if q.is_dir():
            out += sorted(str(f) for f in q.iterdir() if f.is_file() and f.suffix.lower() in EXTS)
        elif q.is_file():
            out.append(str(q))
    out = sorted(set(out))
    if cap and len(out) > cap:
        out = [out[int(i * len(out) / cap)] for i in range(cap)]
    return out


def load_audio(path, sr=SR):
    import soundfile as sf
    try:
        y, fs = sf.read(path, always_2d=True, frames=(MAX_SEC + 5) * 32000)
        y = y.T.astype(np.float32)
    except Exception:
        r = subprocess.run(["ffmpeg", "-v", "error", "-t", str(MAX_SEC + 5), "-i", path, "-f", "wav", "-ac", "2", "-ar", str(sr), "-"],
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        r.check_returncode()
        y, fs = sf.read(io.BytesIO(r.stdout), always_2d=True)
        y = y.T.astype(np.float32)
    if fs != sr:
        import librosa
        y = np.stack([librosa.resample(c, orig_sr=fs, target_sr=sr) for c in y]).astype(np.float32)
    if y.shape[0] == 1:
        y = np.repeat(y, 2, axis=0)
    return y[:2], y[:2].mean(axis=0)


def medfilt(x, k):
    k = int(k) | 1
    p = k // 2
    w = np.lib.stride_tricks.sliding_window_view(np.pad(x, p, mode="reflect"), k)
    return np.median(w, axis=-1)


def analyze(path):
    import librosa
    stereo, mono = load_audio(path)
    n = min(mono.shape[0], MAX_SEC * SR)
    y = mono[:n]
    st = stereo[:, :n]
    dur = n / SR
    D = np.abs(librosa.stft(y, n_fft=N_FFT, hop_length=HOP, window="hann", center=False))
    P = D ** 2
    CN = 16384
    DL = np.abs(librosa.stft(y, n_fft=CN, hop_length=CN // 4, window="hann", center=False))
    C = np.fft.irfft(np.log(DL + 1e-10), n=CN, axis=0).mean(axis=1)
    k0 = int(0.010 * SR)
    k1 = min(int(0.250 * SR), CN // 2 - 1)
    seg = C[k0:k1]
    res = seg - medfilt(seg, int(0.002 * SR))
    ie = int(np.argmax(res))
    echo_score, lag_ms = float(res[ie] / (np.std(res) + 1e-9)), (k0 + ie) / SR * 1000.0
    Pm = np.log(P + 1e-12).mean(axis=1)
    Pm -= Pm.mean()
    A = np.fft.irfft(np.abs(np.fft.rfft(Pm, n=2 * len(Pm))) ** 2)[:len(Pm)]
    K = N_FFT // int(0.004 * SR)
    cres = A[1:K + 1] - medfilt(A[1:K + 1], 5)
    comb_score = float(cres.max() / max(A[0], 1e-12))
    fr = np.fft.rfftfreq(N_FFT, 1.0 / SR)
    tot = float(P.sum())
    rolloff95 = float(librosa.feature.spectral_rolloff(S=D, sr=SR, roll_percent=0.95).mean())
    hf_ratio = float(P[fr > 8000].sum() / tot)
    hf_ratio_12k = float(P[fr > 12000].sum() / tot)
    flatness = float(librosa.feature.spectral_flatness(S=D).mean())
    centroid = float(librosa.feature.spectral_centroid(S=D, sr=SR).mean())
    bands = {}
    for lo, hi in [(0, 200), (200, 2000), (2000, 8000), (8000, 16000)]:
        bands[f"{lo}-{hi}"] = float(10 * np.log10(max(P[(fr >= lo) & (fr < hi)].sum() / tot, 1e-12)))
    rms = float(np.sqrt(np.mean(y ** 2)))
    peak = float(np.max(np.abs(y)))
    rms_db = float(20 * np.log10(rms + 1e-12))
    peak_db = float(20 * np.log10(peak + 1e-12))
    w = librosa.feature.rms(y=y, frame_length=int(0.4 * SR), hop_length=int(0.2 * SR))[0]
    wd = 20 * np.log10(w + 1e-12)
    spread = float(np.percentile(wd, 95) - np.percentile(wd, 10))
    o = librosa.onset.onset_strength(y=y, sr=SR)
    sharp = float(o[o >= np.percentile(o, 90)].mean() / (np.median(o) + 1e-9))
    L, R = st[0], st[1]
    corr = float(np.corrcoef(L, R)[0, 1]) if L.std() > 0 and R.std() > 0 else 1.0
    sm = float(10 * np.log10(max(np.mean(((L - R) / 2) ** 2), 1e-18) / max(np.mean(((L + R) / 2) ** 2), 1e-18)))
    blk = y[:len(y) // 320 * 320].reshape(-1, 320)
    env = np.sqrt((blk ** 2).mean(axis=1) + 1e-12)
    env -= env.mean()
    E = np.abs(np.fft.rfft(env)) ** 2
    f = np.fft.rfftfreq(len(env), 1.0 / 100)
    mod = float(E[(f >= 4) & (f < 16)].sum() / max(E[(f >= 0.5) & (f < 4)].sum(), 1e-12))
    return {"file": path, "seconds": dur, "echo_score": echo_score, "lag_ms": lag_ms,
            "comb_score": comb_score, "rolloff95_hz": rolloff95, "hf_ratio": hf_ratio,
            "hf_ratio_12k": hf_ratio_12k, "spectral_flatness": flatness, "spectral_centroid": centroid,
            "band_energy_db": bands, "rms_dbfs": rms_db, "peak_dbfs": peak_db,
            "crest_db": peak_db - rms_db, "lufs_spread": spread, "onset_sharpness": sharp,
            "stereo_corr": corr, "side_mid_db": sm, "mod_smear": mod}


def ensure_ckpt():
    d = Path.home() / ".cache" / "laion_clap"
    d.mkdir(parents=True, exist_ok=True)
    p = d / CKPT_NAME
    if not p.exists():
        eprint("downloading " + CKPT_NAME)
        urllib.request.urlretrieve(CKPT_URL, p)
    return str(p)


def load_clap():
    import torch
    from laion_clap import CLAP_Module
    dev = "cuda:0" if torch.cuda.is_available() else "cpu"
    try:
        m = CLAP_Module(enable_fusion=False, amodel="HTSAT-base", device=dev)
    except TypeError:
        m = CLAP_Module(enable_fusion=False, amodel="HTSAT-base")
    m.load_ckpt(ensure_ckpt())
    return m


def clap_embed(model, y48):
    import torch
    y48 = y48[:CLAP_MAX_SEC * CLAP_SR].astype(np.float32)
    chunks = []
    for i in range(0, max(len(y48), 1), CLAP_CHUNK_SEC * CLAP_SR):
        c = y48[i:i + CLAP_CHUNK_SEC * CLAP_SR]
        if len(c) < CLAP_SR:
            c = np.pad(c, (0, CLAP_SR - len(c)))
        chunks.append(c)
    with torch.no_grad():
        E = np.asarray(model.get_audio_embedding_from_data(chunks, use_tensor=False)).reshape(len(chunks), -1)
    e = E.mean(axis=0)
    return (e / (np.linalg.norm(e) + 1e-12)).astype(np.float64)


def to48(path):
    import librosa
    _, mono = load_audio(path)
    if len(mono) > MAX_SEC * SR:
        mono = mono[:MAX_SEC * SR]
    return librosa.resample(mono, orig_sr=SR, target_sr=CLAP_SR).astype(np.float32)


def fad(X, Y):
    def cov(M):
        if len(M) > 1:
            return np.cov(M, rowvar=False) + np.eye(M.shape[1]) * 1e-6
        return np.eye(M.shape[1]) * 1e-6
    C1, C2 = cov(X), cov(Y)
    w, V = np.linalg.eigh(C1)
    S = (V * np.sqrt(np.maximum(w, 0))) @ V.T
    ew = np.linalg.eigvalsh((S @ C2 @ S + (S @ C2 @ S).T) / 2)
    d = X.mean(0) - Y.mean(0)
    return float(d @ d + np.trace(C1 + C2) - 2 * np.sum(np.sqrt(np.maximum(ew, 0))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reference", nargs="*", default=[])
    ap.add_argument("--caption-json", default=None)
    ap.add_argument("--json", default=None)
    ap.add_argument("--no-clap", action="store_true")
    ap.add_argument("inputs", nargs="+")
    a = ap.parse_args()
    files = collect(a.inputs)
    refs = collect(a.reference, cap=40)
    if not files:
        sys.exit("no input files")
    eprint(f"inputs={len(files)} refs={len(refs)}")
    rows = []
    for p in files:
        try:
            rows.append(analyze(p))
        except Exception as e:
            eprint(f"skip {p}: {e}")
            rows.append({"file": p, "error": str(e)})
    out = {"files": rows, "reference_files": refs}
    if not a.no_clap:
        try:
            import torch
            model = load_clap()
            eprint("clap on " + ("cuda" if torch.cuda.is_available() else "cpu"))
            E = np.stack([clap_embed(model, to48(r["file"])) for r in rows if "error" not in r])
            out["fad"] = None
            if refs:
                key = hashlib.sha1("\n".join(sorted(refs)).encode()).hexdigest()
                cd = Path.home() / ".cache" / "music3_metrics"
                cd.mkdir(parents=True, exist_ok=True)
                cp, cj = cd / (key + ".npy"), cd / (key + ".json")
                R = None
                if cp.exists() and cj.exists() and json.loads(cj.read_text()) == sorted(refs):
                    R = np.load(cp)
                    if R.shape[0] != len(refs):
                        R = None
                if R is None:
                    R = np.stack([clap_embed(model, to48(p)) for p in refs])
                    np.save(cp, R)
                    cj.write_text(json.dumps(sorted(refs)))
                cen = R.mean(0) / (np.linalg.norm(R.mean(0)) + 1e-12)
                for r, e in zip([x for x in rows if "error" not in x], E):
                    r["clap_ref_cos"] = float(e @ cen)
                if len(E) > 0 and len(R) > 0:
                    out["fad"] = fad(E, R)
                out["ref_cache"] = str(cp)
            if a.caption_json:
                caps = json.loads(Path(a.caption_json).read_text())
                names = [Path(r["file"]).name for r in rows if "error" not in r]
                have = [(n, caps[n]) for n in names if n in caps]
                if have:
                    import torch
                    with torch.no_grad():
                        T = np.asarray(model.get_text_embedding([c for _, c in have], use_tensor=False))
                    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
                    emap = {Path(r["file"]).name: e for r, e in zip([x for x in rows if "error" not in x], E)}
                    for (n, _), t in zip(have, T):
                        for r in rows:
                            if Path(r["file"]).name == n and Path(r["file"]).name in emap:
                                r["clap_text_sim"] = float(emap[Path(r["file"]).name] @ t)
        except Exception as e:
            eprint(f"clap disabled: {e}")
    hdr = ["file", "echo", "lag_ms", "comb", "hf", "flat", "crest", "onset", "refcos", "txt"]
    print(f"{'file':30} {'echo':>9} {'lag_ms':>7} {'comb':>9} {'hf':>7} {'flat':>7} {'crest':>6} {'onset':>7} {'refcos':>7} {'txt':>7}")
    for r in rows:
        if "error" in r:
            print(f"{Path(r['file']).name[:30]:30} ERROR {r['error'][:60]}")
            continue
        g = lambda k: (f"{r[k]:.3f}" if k in r and isinstance(r[k], float) else "      -")
        print(f"{Path(r['file']).name[:30]:30} {r['echo_score']:9.3f} {r['lag_ms']:7.1f} "
              f"{r['comb_score']:9.4f} {r['hf_ratio']:7.4f} {r['spectral_flatness']:7.4f} "
              f"{r['crest_db']:6.1f} {r['onset_sharpness']:7.2f} "
              f"{g('clap_ref_cos'):>7} {g('clap_text_sim'):>7}")
    if out.get("fad") is not None:
        print(f"FAD(input||ref) = {out['fad']:.4f}")
    if a.json:
        slim = [{k: v for k, v in r.items() if k != "clap_emb"} for r in rows]
        out["files"] = slim
        Path(a.json).write_text(json.dumps(out, indent=1))
        eprint("wrote " + a.json)


if __name__ == "__main__":
    main()
