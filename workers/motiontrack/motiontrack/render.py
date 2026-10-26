from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

import cv2
import numpy as np

from . import beats as beatmod
from . import fx as fxmod
from . import reframe as rf
from . import retime, sfx
from .signals import Signals, analyze
from .track import TrackSet, read_meta, track_video

PRESETS: dict[str, dict] = {
    "anime-fight": {"fx": ["aura", "trails", "impact", "speedlines"], "slowmo": True, "sfx": True, "palette": "gold-blue", "text": True,
                    "title": "Anime Fight", "blurb": "Ki aura, speed trails, comic impacts and slow-mo on every hit."},
    "ki-aura": {"fx": ["aura", "lightning", "trails"], "slowmo": False, "sfx": True, "palette": "gold-blue", "text": False,
                "title": "Power Aura", "blurb": "Flaming aura and crackling lightning that scale with how hard each fighter moves."},
    "lightning": {"fx": ["lightning", "impact"], "slowmo": True, "sfx": True, "palette": "ice", "text": False,
                  "title": "Lightning Strikes", "blurb": "Electric arcs on every limb, flash and shockwave on contact."},
    "neon-trails": {"fx": ["neon", "trails"], "slowmo": False, "sfx": False, "palette": "neon", "text": False,
                    "title": "Neon Trails", "blurb": "Glowing skeleton and long light trails on a dimmed scene."},
    "game-hud": {"fx": ["hud", "impact"], "slowmo": False, "sfx": True, "palette": "gold-blue", "text": True,
                 "title": "Fighting Game HUD", "blurb": "Health bars, combo counter, FIGHT banner and tracked fighter brackets."},
    "spotlight": {"fx": ["spotlight", "trails"], "slowmo": False, "sfx": False, "palette": "ice", "text": False,
                  "title": "Spotlight", "blurb": "Dim the world and light up the most active fighter."},
    "exaggerate": {"fx": ["exaggerate", "punch"], "slowmo": True, "sfx": True, "palette": "gold-blue", "text": False,
                   "title": "Motion Exaggerate", "blurb": "Limbs whip further along their path with smear streaks, so every punch and kick reads bigger and snappier."},
    "echo": {"fx": ["echo", "trails"], "slowmo": False, "sfx": False, "palette": "neon", "text": False,
             "title": "Afterimage Echo", "blurb": "Delayed coloured ghost outlines trail each fighter like a chrono echo."},
    "tracking-overlay": {"fx": ["overlay"], "slowmo": False, "sfx": False, "palette": "gold-blue", "text": False, "title": "Tracking overlay", "blurb": "", "hidden": True},
    "track-guide": {"fx": ["guide"], "slowmo": False, "sfx": False, "palette": "gold-blue", "text": False, "title": "Track guide", "blurb": "", "hidden": True},
    "beat-drop": {"fx": ["beats"], "slowmo": False, "sfx": False, "palette": "neon", "text": False, "tracks": False,
                  "title": "Beat Drop", "blurb": "Zoom punch, flash, shake and color split on every kick and snare of your song."},
    "slowmo-impacts": {"fx": ["impact"], "slowmo": True, "sfx": True, "palette": "gold-blue", "text": False,
                       "title": "Impact Slow-mo", "blurb": "Ramp into slow motion on every big hit with flash, shake and sound."},
}


class Source:
    def __init__(self, path: str, max_side: int):
        self.cap = cv2.VideoCapture(path)
        self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        w, h = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        s = min(1.0, max_side / max(w, h))
        self.w, self.h = int(round(w * s / 2)) * 2, int(round(h * s / 2)) * 2
        self.cache: dict[int, np.ndarray] = {}
        self.next = 0

    def get(self, i: int) -> np.ndarray:
        i = min(max(i, 0), self.n - 1)
        while i not in self.cache and self.next <= i:
            ok, fr = self.cap.read()
            if not ok:
                break
            if fr.shape[1] != self.w or fr.shape[0] != self.h:
                fr = cv2.resize(fr, (self.w, self.h), interpolation=cv2.INTER_AREA)
            self.cache[self.next] = fr
            self.next += 1
            for k in [k for k in self.cache if k < i - 2]:
                del self.cache[k]
        return self.cache.get(i, self.cache[max(self.cache)])


def has_audio(path: str) -> bool:
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", path],
                       capture_output=True, text=True)
    return bool(p.stdout.strip())


def _ff(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-v", "error", "-y", *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError(p.stderr.strip()[-600:])


def get_tracks(video: str, tracks: str | None, *, device: str = "cpu", mode: str = "balanced", max_seconds: float | None = None,
               progress=None) -> TrackSet:
    if tracks and Path(tracks).exists():
        return TrackSet.load(Path(tracks))
    fps, _, _, _ = read_meta(video)
    ts = track_video(video, mode=mode, device=device, max_frames=int(max_seconds * fps) if max_seconds else None, progress=progress)
    if tracks:
        ts.save(Path(tracks))
    return ts


def scale_tracks(ts: TrackSet, w: int, h: int) -> TrackSet:
    s = w / ts.width
    if abs(s - 1) < 1e-3:
        return ts
    for t in ts.tracks:
        t.kp = t.kp * s
        t.box = t.box * s
    ts.width, ts.height = w, h
    return ts


def render(video: str, out: str, preset: str = "anime-fight", *, tracks: str | None = None, intensity: float = 1.0,
           palette: str | None = None, slowmo: bool | None = None, with_sfx: bool | None = None, text: bool | None = None,
           target: int | None = None, names: list[str] | None = None, max_seconds: float = 30.0, max_side: int = 1280,
           music: str | None = None, reactive_audio: str | None = None, extra_fx: list[str] | None = None,
           device: str = "cpu", seed: int = 7, crf: int = 18, audio_start: float = 0.0, aspect: str | None = None, progress=None, log=print) -> dict:
    t0 = time.time()
    cfg = dict(PRESETS[preset])
    fx_names = list(cfg["fx"]) + [f for f in (extra_fx or []) if f not in cfg["fx"]]
    slowmo = cfg["slowmo"] if slowmo is None else slowmo
    with_sfx = cfg["sfx"] if with_sfx is None else with_sfx
    text = cfg["text"] if text is None else text
    palette = palette or cfg["palette"]
    fps0, _, _, n0 = read_meta(video)
    limit = int(max_seconds * fps0)
    src = Source(video, max_side)
    if cfg.get("tracks", True):
        ts = get_tracks(video, tracks, device=device, max_seconds=max_seconds,
                        progress=(lambda a, b: progress("tracking", a / max(b, 1))) if progress else None)
        ts = scale_tracks(ts, src.w, src.h)
    else:
        ts = TrackSet(fps0, src.w, src.h, min(n0, limit))
    nframes = min(n0, limit, ts.frames) if ts.frames else min(n0, limit)
    sig = analyze(ts)
    ctx = fxmod.Ctx(ts, sig, src.w, src.h, ts.fps, intensity=intensity, palette=palette, seed=seed, text=text, target=target,
                    names=names or [])
    audio_feats = None
    if reactive_audio:
        audio_feats = beatmod.analyze_audio(beatmod.decode(reactive_audio, max_seconds, audio_start))
        ctx.audio = audio_feats
        if "beats" not in fx_names:
            fx_names.append("beats")
        env = np.interp(np.arange(nframes) / ts.fps, np.arange(len(audio_feats.bass)) / audio_feats.fps, audio_feats.bass * 0.6 + audio_feats.mid * 0.4)
        ctx.drive = (0.5 * env + 0.5 * sig.energy[:nframes]).astype(np.float32) if len(sig.energy) >= nframes else env.astype(np.float32)
        if not ts.tracks:
            ctx.drive = env.astype(np.float32)
    music_gain = 0.55
    if reactive_audio and not music:
        music, music_gain = reactive_audio, 0.95
    hits = retime.pick_slowmo(sig) if slowmo else []
    pos, spd = retime.plan(nframes, ts.fps, hits)
    cw, ch, ow, oh, cam = src.w, src.h, src.w, src.h, None
    if aspect and aspect in rf.ASPECTS:
        cw, ch = rf.crop_size(src.w, src.h, aspect)
        if (cw, ch) != (src.w, src.h):
            ow, oh = rf.output_size(cw, ch)
            cam = rf.camera_path(ts, sig, nframes, cw, ch)
    log(f"tracks={len(ts.tracks)} events={len(sig.events)} bpm={sig.bpm:.0f} slowmo={len(hits)} out_frames={len(pos)}")

    tmp = Path(tempfile.mkdtemp(prefix="mt_"))
    try:
        vid = tmp / "v.mp4"
        enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{ow}x{oh}",
                                "-r", f"{ts.fps:.5f}", "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(crf),
                                "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(vid)], stdin=subprocess.PIPE)
        interp = retime.Interpolator()
        for of, p in enumerate(pos):
            i = int(np.floor(p))
            a = src.get(i)
            alpha = float(p - i)
            frame = a if alpha < 0.02 else interp.at(a, src.get(i + 1), i, alpha)
            L = fxmod.Layers.new(frame.astype(np.float32) / 255.0)
            for name in fx_names:
                fxmod.EFFECTS[name](ctx, L, float(p), of)
            glow = 1.0 if name != "neon" else 1.4
            img = (fxmod.composite(ctx, L, glow) * 255).astype(np.uint8)
            img = fxmod.draw_overlays(ctx, img, L.overlay)
            if cam is not None:
                c = cam[min(int(round(p)), len(cam) - 1)]
                img = cv2.resize(rf.crop_frame(img, c, cw, ch), (ow, oh), interpolation=cv2.INTER_CUBIC)
            enc.stdin.write(img.tobytes())
            if progress and of % 8 == 0:
                progress("render", of / len(pos))
        enc.stdin.close()
        if enc.wait():
            raise RuntimeError("encoder failed")
        dur = len(pos) / ts.fps
        audio = _build_audio(video, tmp, sig, pos, spd, ts.fps, dur, hits, with_sfx, slowmo, nframes, music, music_gain, audio_start if music is reactive_audio else 0.0)
        cmd = ["-i", str(vid)]
        if audio:
            cmd += ["-i", str(audio), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest"]
        else:
            cmd += ["-c:v", "copy"]
        _ff(cmd + ["-movflags", "+faststart", out])
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return {"preset": preset, "output": out, "seconds": round(dur, 2), "frames": len(pos), "width": ow, "height": oh,
            "tracks": len(ts.tracks), "events": [e.to_json() for e in sig.events], "bpm": round(sig.bpm, 1),
            "slowmo_hits": hits, "audio": bool(audio), "tracks_file": tracks, "elapsed": round(time.time() - t0, 1),
            "audio_bpm": round(audio_feats.bpm, 1) if audio_feats else None}


def _build_audio(video, tmp, sig, pos, spd, fps, dur, hits, with_sfx, slowmo, nframes, music, music_gain=0.55, music_start=0.0):
    base = None
    src_audio = has_audio(video)
    if src_audio:
        base = tmp / "base.wav"
        if slowmo and len(hits):
            segs = retime.segments(pos, spd, fps)
            parts, labels = [], []
            for k, (a, b, lv) in enumerate(segs):
                parts.append(f"[0:a]atrim={a:.4f}:{b:.4f},asetpts=PTS-STARTPTS,{retime.atempo_chain(lv)}[s{k}]")
                labels.append(f"[s{k}]")
            fc = ";".join(parts) + ";" + "".join(labels) + f"concat=n={len(segs)}:v=0:a=1[a]"
            _ff(["-i", video, "-filter_complex", fc, "-map", "[a]", "-ar", str(sfx.SR), "-ac", "2", str(base)])
        else:
            _ff(["-i", video, "-t", f"{dur:.3f}", "-vn", "-ar", str(sfx.SR), "-ac", "2", str(base)])
    if not (with_sfx or music or base):
        return None
    out_pos = lambda frame: float(np.interp(frame, pos, np.arange(len(pos)))) / fps
    mix = np.zeros((int(sfx.SR * dur), 2), np.float32)
    if base is not None:
        mix = _read_wav(base, len(mix)) * (0.8 if music_gain < 0.9 else 0.25)
    if music:
        mm = _read_music(music, len(mix), music_start)
        mix += mm * music_gain
    if with_sfx:
        items = []
        for e in sig.events:
            if e.frame >= nframes:
                continue
            items.append(("impact" if e.kind == "impact" else "strike", out_pos(e.frame), e.power, 0.0))
        for te in hits:
            items.append(("slowmo", out_pos(te * fps), 1.0, 0.0))
        mix += sfx.mix_events(dur, items)[: len(mix)] if len(mix) else 0
    peak = float(np.abs(mix).max())
    if peak > 0.97:
        mix *= 0.97 / peak
    path = tmp / "audio.wav"
    sfx.write_wav(str(path), mix)
    return path


def _read_wav(path, n) -> np.ndarray:
    import wave

    with wave.open(str(path)) as w:
        raw = np.frombuffer(w.readframes(w.getnframes()), "<i2").astype(np.float32) / 32768
        ch = w.getnchannels()
    a = raw.reshape(-1, ch)
    if ch == 1:
        a = np.repeat(a, 2, axis=1)
    out = np.zeros((n, 2), np.float32)
    m = min(n, len(a))
    out[:m] = a[:m, :2]
    return out


def _read_music(path, n, start=0.0) -> np.ndarray:
    p = subprocess.run(["ffmpeg", "-v", "error"] + (["-ss", f"{start:.2f}"] if start > 0 else []) + ["-i", path, "-vn", "-ac", "2", "-ar", str(sfx.SR), "-f", "f32le", "-"], capture_output=True)
    a = np.frombuffer(p.stdout, np.float32).reshape(-1, 2)
    out = np.zeros((n, 2), np.float32)
    m = min(n, len(a))
    out[:m] = a[:m]
    peak = float(np.abs(out).max())
    if peak > 1e-4:
        out *= min(0.9 / peak, 8.0)
    fade = min(m, int(sfx.SR * 0.5))
    if fade:
        out[m - fade:m] *= np.linspace(1, 0, fade)[:, None]
    return out
