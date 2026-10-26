from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .signals import Signals, combos
from .track import BONES, EFFECTORS, Track, TrackSet

FONT = Path(__file__).parent / "assets" / "Bangers-Regular.ttf"

PALETTES = {
    "gold-blue": [(0.15, 0.75, 1.0), (1.0, 0.6, 0.15), (0.3, 1.0, 0.5), (0.9, 0.3, 1.0)],
    "fire": [(0.1, 0.45, 1.0), (0.2, 0.8, 1.0), (0.1, 0.25, 1.0), (0.4, 0.9, 1.0)],
    "neon": [(1.0, 0.25, 0.9), (1.0, 0.95, 0.1), (0.4, 1.0, 0.2), (1.0, 0.5, 0.1)],
    "ice": [(1.0, 0.8, 0.3), (1.0, 0.95, 0.7), (0.9, 0.6, 0.2), (1.0, 1.0, 0.9)],
}
HIT_WORDS = ["POW!", "BAM!", "WHAM!", "CRACK!", "BOOM!", "SMASH!", "THWACK!"]


@dataclass
class Ctx:
    ts: TrackSet
    sig: Signals
    w: int
    h: int
    fps: float
    intensity: float = 1.0
    palette: str = "gold-blue"
    seed: int = 7
    drive: np.ndarray | None = None
    text: bool = True
    target: int | None = None
    names: list[str] = field(default_factory=list)
    _fonts: dict = field(default_factory=dict)

    def color(self, tid: int) -> np.ndarray:
        p = PALETTES.get(self.palette, PALETTES["gold-blue"])
        return np.asarray(p[(tid - 1) % len(p)], np.float32)

    def font(self, size: int) -> ImageFont.FreeTypeFont:
        size = max(8, int(size))
        if size not in self._fonts:
            try:
                self._fonts[size] = ImageFont.truetype(str(FONT), size)
            except OSError:
                self._fonts[size] = ImageFont.load_default()
        return self._fonts[size]

    def energy(self, tf: float) -> float:
        arr = self.drive if self.drive is not None else self.sig.energy
        x = min(max(tf, 0.0), len(arr) - 1.0)
        i = int(x)
        j = min(i + 1, len(arr) - 1)
        return float(arr[i] * (1 - (x - i)) + arr[j] * (x - i))

    def track_energy(self, tid: int, tf: float) -> float:
        arr = self.sig.track_energy.get(tid)
        if arr is None:
            return 0.0
        peak = max(float(np.percentile(arr[arr > 0], 98)) if (arr > 0).any() else 1.0, 1e-6)
        x = min(max(tf, 0.0), len(arr) - 1.0)
        i = int(x)
        return float(min(arr[i] / peak, 1.5))

    def rng(self, k: int) -> np.random.Generator:
        return np.random.default_rng(self.seed * 100003 + k)

    def events_near(self, tf: float, before: float, after: float):
        lo, hi = tf - after * self.fps, tf + before * self.fps
        return [e for e in self.sig.events if lo <= e.frame <= hi]


@dataclass
class Layers:
    base: np.ndarray
    add: np.ndarray
    core: np.ndarray
    overlay: list = field(default_factory=list)
    shake: tuple[float, float] = (0.0, 0.0)
    flash: float = 0.0
    chroma: float = 0.0
    zoom: float = 0.0
    dim: np.ndarray | None = None

    @staticmethod
    def new(frame_f: np.ndarray) -> "Layers":
        return Layers(frame_f, np.zeros_like(frame_f), np.zeros_like(frame_f))


def person_mask(ctx: Ctx, t: Track, tf: float, grow: float = 1.0) -> np.ndarray:
    m = np.zeros((ctx.h, ctx.w), np.uint8)
    kp = t.kp_f(tf)
    cf = t.conf_f(tf)
    sc = max(float(t.box_f(tf)[3] - t.box_f(tf)[1]), 20.0)
    for a, b in BONES:
        if cf[a] < 0.25 or cf[b] < 0.25:
            continue
        thick = int(sc * (0.17 if (a, b) in ((5, 11), (6, 12), (5, 6), (11, 12)) else 0.085) * grow)
        cv2.line(m, tuple(int(v) for v in kp[a]), tuple(int(v) for v in kp[b]), 255, max(thick, 2), cv2.LINE_AA)
    torso = np.array([kp[5], kp[6], kp[12], kp[11]], np.int32)
    cv2.fillPoly(m, [torso], 255)
    head = kp[0]
    cv2.circle(m, (int(head[0]), int(head[1])), int(sc * 0.065 * grow), 255, -1, cv2.LINE_AA)
    return m


def _blur(img: np.ndarray, sigma: float) -> np.ndarray:
    if sigma < 0.5:
        return img
    k = int(sigma * 4) | 1
    return cv2.GaussianBlur(img, (k, k), sigma)


def _glow_blur(layer: np.ndarray, sigma: float) -> np.ndarray:
    h, w = layer.shape[:2]
    s = 4 if max(h, w) > 700 else 2
    small = cv2.resize(layer, (w // s, h // s), interpolation=cv2.INTER_AREA)
    small = _blur(small, sigma / s)
    return cv2.resize(small, (w, h), interpolation=cv2.INTER_LINEAR)


def _pt(v) -> tuple[int, int]:
    return int(round(float(v[0]))), int(round(float(v[1])))


def active_tracks(ctx: Ctx, tf: float) -> list[Track]:
    return [t for t in ctx.ts.tracks if t.at_f(tf, 0.0)]


def pick_target(ctx: Ctx) -> int | None:
    if ctx.target:
        return ctx.target
    best, bs = None, -1.0
    for tid, arr in ctx.sig.track_energy.items():
        s = float(arr.sum())
        if s > bs:
            best, bs = tid, s
    return best


# ---------------------------------------------------------------- effects

def fx_aura(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    for t in active_tracks(ctx, tf):
        e = 0.35 + 0.65 * min(ctx.track_energy(t.id, tf), 1.2)
        m = person_mask(ctx, t, tf, 1.05).astype(np.float32) / 255.0
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        halo = _glow_blur(m, sc * 0.05)
        flame = np.zeros_like(m)
        rng = ctx.rng(of * 31 + t.id)
        noise = _blur(rng.random((ctx.h // 8 + 1, ctx.w // 8 + 1)).astype(np.float32), 1.2)
        noise = cv2.resize(noise, (ctx.w, ctx.h), interpolation=cv2.INTER_LINEAR)
        rise = sc * (0.10 + 0.10 * e) * ctx.intensity
        steps = 7
        for i in range(1, steps + 1):
            dy = int(rise * i / steps)
            shifted = np.zeros_like(m)
            shifted[: ctx.h - dy] = m[dy:] if dy else m
            wob = int(math.sin(of * 0.9 + i) * sc * 0.012)
            shifted = np.roll(shifted, wob, axis=1)
            flame = np.maximum(flame, shifted * (1.0 - i / (steps + 1)) * (0.55 + 0.9 * noise))
        flame = _glow_blur(flame, sc * 0.018)
        aura = np.clip(halo * 1.1 + flame * 1.0, 0, 1.6) * (1.0 - 0.55 * m)
        col = ctx.color(t.id)
        hot = np.array([1.0, 1.0, 1.0], np.float32)
        a3 = aura[..., None]
        L.add += a3 * col * (0.6 * e * ctx.intensity)
        L.core += (np.clip(aura - 0.8, 0, 1)[..., None]) * hot * (0.18 * e * ctx.intensity)


def fx_trails(ctx: Ctx, L: Layers, tf: float, of: int, length: int = 12) -> None:
    n = max(4, int(length * ctx.intensity))
    for t in active_tracks(ctx, tf):
        col = ctx.color(t.id)
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        for j in EFFECTORS:
            pts, spd = [], []
            for k in range(n):
                tt = tf - k * 0.75
                if tt < t.first:
                    break
                pts.append(t.kp_f(tt)[j])
            if len(pts) < 3:
                continue
            e = min(ctx.track_energy(t.id, tf) + 0.15, 1.2)
            for i in range(len(pts) - 1):
                fade = 1.0 - i / len(pts)
                d = float(np.hypot(*(pts[i] - pts[i + 1])))
                thick = max(1, int(sc * 0.032 * fade * (1.0 if j in (9, 10) else 1.25)))
                a = (fade ** 1.4) * min(1.0, 0.35 + d / (sc * 0.05)) * e
                cv2.line(L.add, _pt(pts[i]), _pt(pts[i + 1]), tuple(float(c * a * 1.4) for c in col), thick * 2, cv2.LINE_AA)
                cv2.line(L.core, _pt(pts[i]), _pt(pts[i + 1]), tuple(float(a * 0.9) for _ in range(3)), max(1, thick // 2), cv2.LINE_AA)


def _bolt(rng: np.random.Generator, a: np.ndarray, b: np.ndarray, rough: float, depth: int = 5) -> list[np.ndarray]:
    pts = [a, b]
    off = rough
    for _ in range(depth):
        nxt = []
        for p, q in zip(pts[:-1], pts[1:]):
            mid = (p + q) / 2
            d = q - p
            n = np.array([-d[1], d[0]], np.float32)
            n = n / (np.linalg.norm(n) + 1e-6)
            nxt += [p, mid + n * rng.normal(0, off)]
        nxt.append(pts[-1])
        pts = nxt
        off *= 0.55
    return pts


def fx_lightning(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    for t in active_tracks(ctx, tf):
        kp = t.kp_f(tf)
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        e = min(ctx.track_energy(t.id, tf), 1.2)
        near = ctx.events_near(tf, 0.0, 0.35)
        boost = 1.0 if any(ev.track == t.id for ev in near) else 0.0
        level = min(1.0, e * 0.9 + boost * 0.7) * ctx.intensity
        if level < 0.2:
            continue
        rng = ctx.rng((of // 2) * 17 + t.id)
        col = ctx.color(t.id)
        center = (kp[5] + kp[6] + kp[11] + kp[12]) / 4
        pairs = [(j, center) for j in EFFECTORS] + [(0, center)]
        for j, c in pairs:
            if rng.random() > level + 0.15:
                continue
            tip = kp[j] + rng.normal(0, sc * 0.02, 2)
            target = tip + rng.normal(0, sc * 0.22, 2) if j != 0 else tip + np.array([rng.normal(0, sc * 0.2), -sc * 0.25])
            for branch in range(2):
                pts = _bolt(rng, (c if branch == 0 else tip).astype(np.float32), (tip if branch == 0 else target).astype(np.float32), sc * 0.05)
                poly = np.array([_pt(p) for p in pts], np.int32)
                cv2.polylines(L.add, [poly], False, tuple(float(x * 0.9) for x in col), max(3, int(sc * 0.016)), cv2.LINE_AA)
                cv2.polylines(L.core, [poly], False, (1.0, 1.0, 1.0), max(1, int(sc * 0.005)), cv2.LINE_AA)
        L.add += 0.0


def fx_impact(ctx: Ctx, L: Layers, tf: float, of: int, comic: bool = True, light: bool = False) -> None:
    fps = ctx.fps
    for e in ctx.sig.events:
        age = (tf - e.frame) / fps
        if age < -0.02 or age > 0.9:
            continue
        a = max(age, 0.0)
        pw = min(e.power, 1.5)
        big = e.kind == "impact"
        t = next((x for x in ctx.ts.tracks if x.id == e.track), None)
        sc = float(t.box_f(e.frame)[3] - t.box_f(e.frame)[1]) if t is not None else ctx.h * 0.5
        c = (e.x, e.y)
        col = ctx.color(e.track)
        k = ctx.intensity
        if big:
            decay = math.exp(-a / 0.07)
            r = int(sc * 0.42 * (0.6 + 0.4 * pw)) if not light else 0
            yy, xx = np.ogrid[max(0, int(c[1] - r)):min(ctx.h, int(c[1] + r)), max(0, int(c[0] - r)):min(ctx.w, int(c[0] + r))]
            if r and yy.size and xx.size:
                d = np.sqrt((xx - c[0]) ** 2 + (yy - c[1]) ** 2) / r
                g = np.clip(1.0 - d, 0, 1) ** 2.6 * decay * (0.24 + 0.18 * pw) * k
                L.add[yy[0, 0]:yy[-1, 0] + 1, xx[0, 0]:xx[0, -1] + 1] += g[..., None] * np.array([1.0, 1.0, 1.0], np.float32)
            L.flash = max(L.flash, 0.07 * pw * decay * k)
            L.shake = (L.shake[0] + math.sin(of * 2.3) * 14 * pw * math.exp(-a / 0.10) * k,
                       L.shake[1] + math.cos(of * 3.1) * 10 * pw * math.exp(-a / 0.10) * k)
            L.chroma = max(L.chroma, 7.0 * pw * math.exp(-a / 0.12) * k)
        if light:
            continue
        ring_r = sc * (0.10 + 1.1 * (1 - math.exp(-a / 0.18))) * (0.7 + 0.5 * pw)
        ring_a = math.exp(-a / 0.20) * (1.0 if big else 0.45)
        cv2.circle(L.add, _pt(c), int(ring_r), tuple(float(x * ring_a * 1.2 * k) for x in col), max(2, int(sc * 0.03 * ring_a)) * 2, cv2.LINE_AA)
        cv2.circle(L.core, _pt(c), int(ring_r), (ring_a * k,) * 3, max(1, int(sc * 0.008)), cv2.LINE_AA)
        rng = ctx.rng(e.frame * 13 + e.track)
        n = int(14 + 18 * pw) if big else 6
        for i in range(n):
            ang = rng.uniform(0, 2 * math.pi)
            r0 = sc * (0.04 + 0.5 * (1 - math.exp(-a / 0.12))) * rng.uniform(0.5, 1.2)
            r1 = r0 + sc * rng.uniform(0.04, 0.16) * math.exp(-a / 0.25)
            p0 = (c[0] + math.cos(ang) * r0, c[1] + math.sin(ang) * r0)
            p1 = (c[0] + math.cos(ang) * r1, c[1] + math.sin(ang) * r1)
            fade = math.exp(-a / 0.22)
            cv2.line(L.core, _pt(p0), _pt(p1), (fade * k,) * 3, max(1, int(sc * 0.006)), cv2.LINE_AA)
            cv2.line(L.add, _pt(p0), _pt(p1), tuple(float(x * fade * k) for x in col), max(2, int(sc * 0.014)), cv2.LINE_AA)
        if big and comic and ctx.text and a < 0.55 and not any(o[0] == "comic" for o in L.overlay):
            word = HIT_WORDS[(ctx.sig.events.index(e) * 3 + e.track) % len(HIT_WORDS)]
            L.overlay.append(("comic", word, c, a, pw, sc, col))


def fx_speedlines(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    e = ctx.energy(tf)
    near = ctx.events_near(tf, 0.0, 0.25)
    level = min(1.0, max(e - 0.55, 0) * 1.6 + (0.6 if near else 0.0)) * ctx.intensity
    if level < 0.15:
        return
    rng = ctx.rng(of * 7)
    ts = active_tracks(ctx, tf)
    if not ts:
        return
    cx = float(np.mean([t.box_f(tf)[[0, 2]].mean() for t in ts]))
    cy = float(np.mean([t.box_f(tf)[[1, 3]].mean() for t in ts]))
    diag = math.hypot(ctx.w, ctx.h)
    for _ in range(int(40 * level)):
        ang = rng.uniform(0, 2 * math.pi)
        r0 = diag * rng.uniform(0.28, 0.5)
        r1 = diag * rng.uniform(0.6, 0.9)
        p0 = (cx + math.cos(ang) * r0, cy + math.sin(ang) * r0)
        p1 = (cx + math.cos(ang) * r1, cy + math.sin(ang) * r1)
        cv2.line(L.core, _pt(p0), _pt(p1), (0.55 * level,) * 3, int(rng.integers(1, 3)), cv2.LINE_AA)


def fx_neon(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    L.base *= 0.38
    for t in active_tracks(ctx, tf):
        kp = t.kp_f(tf)
        cf = t.conf_f(tf)
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        col = ctx.color(t.id)
        e = 0.5 + 0.5 * min(ctx.track_energy(t.id, tf), 1.0)
        for a, b in BONES:
            if cf[a] < 0.25 or cf[b] < 0.25:
                continue
            cv2.line(L.add, _pt(kp[a]), _pt(kp[b]), tuple(float(c * e * 1.2) for c in col), max(4, int(sc * 0.03)), cv2.LINE_AA)
            cv2.line(L.core, _pt(kp[a]), _pt(kp[b]), (0.9,) * 3, max(1, int(sc * 0.008)), cv2.LINE_AA)
        for j in range(17):
            if cf[j] >= 0.25:
                cv2.circle(L.core, _pt(kp[j]), max(2, int(sc * 0.012)), (1.0, 1.0, 1.0), -1, cv2.LINE_AA)
                cv2.circle(L.add, _pt(kp[j]), max(4, int(sc * 0.03)), tuple(float(c * e) for c in col), -1, cv2.LINE_AA)


def fx_spotlight(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    tid = pick_target(ctx)
    mask = np.zeros((ctx.h, ctx.w), np.float32)
    for t in active_tracks(ctx, tf):
        if ctx.target is None and False:
            continue
        if tid is not None and t.id != tid and ctx.target is not None:
            continue
        mask = np.maximum(mask, person_mask(ctx, t, tf, 1.25).astype(np.float32) / 255.0)
    sc = ctx.h * 0.5
    mask = _glow_blur(mask, sc * 0.06)
    mask = np.clip(mask * 1.8, 0, 1)
    gray = cv2.cvtColor(L.base, cv2.COLOR_BGR2GRAY)[..., None]
    dark = (L.base * 0.5 + gray * 0.5) * 0.22
    L.base = dark * (1 - mask[..., None]) + L.base * 1.12 * mask[..., None]
    t = next((x for x in ctx.ts.tracks if x.id == tid and x.at_f(tf, 0.0)), None)
    if t is not None:
        b = t.box_f(tf)
        cx, fy = (b[0] + b[2]) / 2, b[3]
        ell = np.zeros((ctx.h, ctx.w), np.float32)
        cv2.ellipse(ell, (int(cx), int(fy)), (int((b[2] - b[0]) * 0.9), int((b[3] - b[1]) * 0.07)), 0, 0, 360, 1.0, -1, cv2.LINE_AA)
        ell = _glow_blur(ell, (b[3] - b[1]) * 0.03)
        L.add += ell[..., None] * np.array([0.9, 0.95, 1.0], np.float32) * 0.45
        L.overlay.append(("tag", ctx.names[tid - 1] if tid - 1 < len(ctx.names) else f"FIGHTER {tid}", (cx, max(b[1] - 8, ctx.h * 0.06)), ctx.color(tid)))


def fx_hud(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    ts = sorted(active_tracks(ctx, tf), key=lambda t: t.id)
    hp: dict[int, float] = {t.id: 1.0 for t in ctx.ts.tracks}
    for e in ctx.sig.events:
        if e.kind == "impact" and e.target and e.frame <= tf:
            hp[e.target] = max(0.05, hp[e.target] - 0.07 - 0.12 * min(e.power, 1.5))
    L.overlay.append(("hud", ts, hp, tf))
    for t in ts:
        b = t.box_f(tf)
        L.overlay.append(("bracket", b, ctx.color(t.id), ctx.names[t.id - 1] if t.id - 1 < len(ctx.names) else f"P{t.id}"))
    cb = [c for c in combos(ctx.sig.events) if 0 <= (tf - c[0]) / ctx.fps < 1.1 and c[2] >= 2]
    if cb:
        L.overlay.append(("combo", cb[-1], (tf - cb[-1][0]) / ctx.fps))
    if tf / ctx.fps < 1.2:
        L.overlay.append(("fight", tf / ctx.fps))


EFFECTS = {
    "aura": fx_aura, "trails": fx_trails, "lightning": fx_lightning, "impact": fx_impact,
    "speedlines": fx_speedlines, "neon": fx_neon, "spotlight": fx_spotlight, "hud": fx_hud,
}


# ---------------------------------------------------------------- compositing

def _shift(img: np.ndarray, dx: float, dy: float) -> np.ndarray:
    m = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(img, m, (img.shape[1], img.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def composite(ctx: Ctx, L: Layers, glow: float = 1.0) -> np.ndarray:
    sig = max(ctx.h, ctx.w) * 0.012
    out = L.base + _glow_blur(L.add, sig * 2.2) * 1.15 * glow + L.add * 0.35 * glow + L.core
    if L.flash > 0.01:
        out = out + L.flash
    if L.chroma > 0.5:
        b, g, r = cv2.split(out)
        d = L.chroma
        out = cv2.merge([_shift(b, -d, 0), g, _shift(r, d, 0)])
    if L.zoom > 0.002:
        z = 1.0 + L.zoom
        m = cv2.getRotationMatrix2D((ctx.w / 2, ctx.h / 2), 0, z)
        out = cv2.warpAffine(out, m, (ctx.w, ctx.h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    if abs(L.shake[0]) + abs(L.shake[1]) > 0.5:
        out = _shift(out, L.shake[0], L.shake[1])
    return np.clip(out, 0, 1)


def draw_overlays(ctx: Ctx, img_u8: np.ndarray, items: list) -> np.ndarray:
    if not items:
        return img_u8
    im = Image.fromarray(cv2.cvtColor(img_u8, cv2.COLOR_BGR2RGB)).convert("RGBA")
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    W, H = im.size
    for it in items:
        kind = it[0]
        if kind == "comic":
            _, word, c, age, pw, sc, col = it
            pop = 1.0 + 0.45 * math.exp(-age / 0.06) * (1 if age < 0.15 else 0)
            size = sc * 0.22 * (0.8 + 0.4 * pw) * pop
            fnt = ctx.font(size)
            alpha = int(255 * min(1.0, (0.55 - age) / 0.15))
            x = min(max(c[0], W * 0.12), W * 0.88)
            y = min(max(c[1] - sc * 0.22, H * 0.12), H * 0.88)
            tile = Image.new("RGBA", (int(size * 5), int(size * 2)), (0, 0, 0, 0))
            td = ImageDraw.Draw(tile)
            td.text((tile.width / 2, tile.height / 2), word, font=fnt, anchor="mm", fill=(255, 235, 30, alpha),
                    stroke_width=max(2, int(size * 0.09)), stroke_fill=(210, 20, 20, alpha))
            tile = tile.rotate(-9 + 5 * math.sin(age * 40), resample=Image.BICUBIC, expand=False)
            layer.alpha_composite(tile, (int(x - tile.width / 2), int(y - tile.height / 2)))
        elif kind == "tag":
            _, name, (x, y), col = it
            fnt = ctx.font(H * 0.04)
            rgb = tuple(int(v * 255) for v in col[::-1])
            d.text((x, y), name.upper(), font=fnt, anchor="ms", fill=rgb + (255,), stroke_width=3, stroke_fill=(0, 0, 0, 220))
        elif kind == "bracket":
            _, b, col, name = it
            rgb = tuple(int(min(1, v * 1.1) * 255) for v in col[::-1]) + (255,)
            x1, y1, x2, y2 = [float(v) for v in b]
            ln = min(x2 - x1, y2 - y1) * 0.22
            wd = max(3, int(H * 0.007))
            for (cx, cy, sx, sy) in ((x1, y1, 1, 1), (x2, y1, -1, 1), (x1, y2, 1, -1), (x2, y2, -1, -1)):
                d.line([(cx, cy + sy * ln), (cx, cy), (cx + sx * ln, cy)], fill=rgb, width=wd)
            d.text((x1, y1 - 6), name.upper(), font=ctx.font(H * 0.032), anchor="ls", fill=rgb, stroke_width=2, stroke_fill=(0, 0, 0, 220))
        elif kind == "hud":
            _, ts, hp, tf = it
            ids = [t.id for t in ctx.ts.tracks][:2]
            barw, barh, y0 = W * 0.38, H * 0.032, H * 0.045
            for slot, tid in enumerate(ids):
                col = tuple(int(v * 255) for v in ctx.color(tid)[::-1])
                x0 = W * 0.04 if slot == 0 else W * 0.96 - barw
                d.rounded_rectangle([x0 - 3, y0 - 3, x0 + barw + 3, y0 + barh + 3], 6, fill=(0, 0, 0, 170), outline=(255, 255, 255, 200), width=2)
                frac = hp.get(tid, 1.0)
                fx0 = x0 if slot == 0 else x0 + barw * (1 - frac)
                d.rounded_rectangle([fx0, y0, fx0 + barw * frac, y0 + barh], 4, fill=col + (255,))
                nm = ctx.names[tid - 1] if tid - 1 < len(ctx.names) else f"P{tid}"
                d.text((x0 if slot == 0 else x0 + barw, y0 + barh + 8), nm.upper(), font=ctx.font(H * 0.034),
                       anchor="la" if slot == 0 else "ra", fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(0, 0, 0, 255))
            d.text((W / 2, y0 + barh / 2), "VS", font=ctx.font(H * 0.06), anchor="mm", fill=(255, 220, 40, 255), stroke_width=3, stroke_fill=(150, 0, 0, 255))
        elif kind == "combo":
            _, (fr, atk, n), age = it
            pop = 1.0 + 0.5 * math.exp(-age / 0.08)
            fnt = ctx.font(H * 0.085 * pop)
            left = (atk == ctx.ts.tracks[0].id) if ctx.ts.tracks else True
            x = W * 0.06 if left else W * 0.94
            d.text((x, H * 0.62), f"{n} HIT", font=fnt, anchor="lm" if left else "rm", fill=(255, 235, 30, 255), stroke_width=5, stroke_fill=(200, 20, 20, 255))
            d.text((x, H * 0.62 + H * 0.08), "COMBO!", font=ctx.font(H * 0.05), anchor="lm" if left else "rm", fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(0, 0, 0, 255))
        elif kind == "fight":
            _, age = it
            pop = 0.6 + 1.2 * min(age / 0.25, 1.0)
            alpha = int(255 * min(1.0, (1.2 - age) / 0.4))
            d.text((W / 2, H * 0.42), "FIGHT!", font=ctx.font(H * 0.2 * pop), anchor="mm", fill=(255, 235, 30, alpha), stroke_width=8, stroke_fill=(200, 20, 20, alpha))
    im = Image.alpha_composite(im, layer).convert("RGB")
    return cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)


def fx_beats(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    a = getattr(ctx, "audio", None)
    if a is None:
        return
    t = tf / ctx.fps
    k = ctx.intensity
    kick = max((s * math.exp(-(t - bt) / 0.11) for bt, s in a.kicks if 0 <= t - bt < 0.5), default=0.0)
    snare = max((s * math.exp(-(t - bt) / 0.08) for bt, s in a.snares if 0 <= t - bt < 0.4), default=0.0)
    beat = max((math.exp(-(t - b) / 0.09) for b in a.beats if 0 <= t - b < 0.4), default=0.0)
    L.zoom = max(L.zoom, 0.06 * kick * k)
    L.flash = max(L.flash, 0.16 * snare * k + 0.05 * beat * k)
    L.chroma = max(L.chroma, 8.0 * (kick * 0.6 + snare * 0.8) * k)
    if kick > 0.55:
        rng = ctx.rng(of)
        L.shake = (L.shake[0] + rng.normal(0, 7) * kick * k, L.shake[1] + rng.normal(0, 5) * kick * k)


EFFECTS["beats"] = fx_beats


def fx_overlay(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    """Analysis view: thin skeletons, ids and effector trails on the untouched video."""
    for t in active_tracks(ctx, tf):
        kp, cf = t.kp_f(tf), t.conf_f(tf)
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        col = ctx.color(t.id)
        th = max(2, int(sc * 0.008))
        for a, b in BONES:
            if cf[a] >= 0.25 and cf[b] >= 0.25:
                cv2.line(L.core, _pt(kp[a]), _pt(kp[b]), tuple(float(c) for c in col), th, cv2.LINE_AA)
        for j in range(17):
            if cf[j] >= 0.25:
                cv2.circle(L.core, _pt(kp[j]), th + 1, (1.0, 1.0, 1.0), -1, cv2.LINE_AA)
        x1, y1, x2, y2 = [float(v) for v in t.box_f(tf)]
        cv2.rectangle(L.core, (int(x1), int(y1)), (int(x2), int(y2)), tuple(float(c * 0.8) for c in col), max(1, th - 1), cv2.LINE_AA)
        L.overlay.append(("tag", f"ID {t.id}", ((x1 + x2) / 2, max(y1 - 6, ctx.h * 0.05)), col))
    fx_trails(ctx, L, tf, of, 18)


GUIDE_COLORS = [(0.2, 0.2, 1.0), (0.2, 1.0, 0.2), (1.0, 0.4, 0.2), (0.1, 0.9, 1.0), (1.0, 0.2, 0.9), (1.0, 1.0, 0.2), (0.6, 0.4, 1.0), (0.2, 0.7, 1.0)]
GUIDE_JOINTS = (0, 9, 10, 15, 16, 11, 12)


def fx_guide(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    """Colored spline per tracked point (head, wrists, ankles, hips): full path in dim color, history bright, dot at the head of the path."""
    L.base *= float(getattr(ctx, "guide_base", 0.0))
    k = 0
    for t in ctx.ts.tracks:
        if not t.at_f(tf, 0.0):
            continue
        for j in GUIDE_JOINTS:
            col = tuple(float(c) for c in GUIDE_COLORS[k % len(GUIDE_COLORS)])
            k += 1
            lo = max(t.first, tf - 24)
            hi = min(t.last, tf + 12)
            pts = np.array([_pt(t.kp_f(x)[j]) for x in np.arange(lo, hi + 0.5, 1.0)], np.int32)
            if len(pts) >= 2:
                now = int(min(len(pts) - 1, round(tf - lo)))
                cv2.polylines(L.core, [pts[: now + 1]], False, col, 4, cv2.LINE_AA)
                cv2.polylines(L.core, [pts[now:]], False, tuple(c * 0.35 for c in col), 2, cv2.LINE_AA)
            cv2.circle(L.core, _pt(t.kp_f(tf)[j]), 7, col, -1, cv2.LINE_AA)


EFFECTS["overlay"] = fx_overlay
EFFECTS["guide"] = fx_guide


WHIP_JOINTS = (7, 8, 9, 10, 13, 14, 15, 16)


def _joint_velocity(t: Track, j: int, tf: float) -> np.ndarray:
    return (t.kp_f(tf + 0.5)[j] - t.kp_f(tf - 1.5)[j]) / 2.0


def whip_field(ctx: Ctx, tf: float, gain: float, cell: int = 8) -> np.ndarray | None:
    """Displacement (dx, dy) per pixel: content near a fast joint is pushed further along its motion."""
    gh, gw = ctx.h // cell + 1, ctx.w // cell + 1
    field = np.zeros((gh, gw, 2), np.float32)
    used = False
    for t in active_tracks(ctx, tf):
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        cap = sc * 0.4
        sigma = max(sc * 0.11 / cell, 1.5)
        for j in WHIP_JOINTS:
            v = _joint_velocity(t, j, tf) * gain * (1.0 if j in EFFECTORS else 0.6)
            n = float(np.hypot(*v))
            if n < sc * 0.006:
                continue
            if n > cap:
                v = v * (cap / n)
            cx, cy = t.kp_f(tf)[j] / cell
            r = int(sigma * 3)
            x0, x1 = max(0, int(cx) - r), min(gw, int(cx) + r + 1)
            y0, y1 = max(0, int(cy) - r), min(gh, int(cy) + r + 1)
            if x0 >= x1 or y0 >= y1:
                continue
            xs = np.arange(x0, x1, dtype=np.float32)[None, :]
            ys = np.arange(y0, y1, dtype=np.float32)[:, None]
            w = np.exp(-((xs - cx) ** 2 + (ys - cy) ** 2) / (2 * sigma ** 2))
            field[y0:y1, x0:x1] += w[..., None] * v
            used = True
    if not used:
        return None
    full = cv2.resize(field, (gw * cell, gh * cell), interpolation=cv2.INTER_LINEAR)[: ctx.h, : ctx.w]
    return full


def fx_exaggerate(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    amount = float(np.clip(ctx.intensity, 0.3, 1.6))
    field = whip_field(ctx, tf, amount * 2.4)
    if field is not None:
        gx, gy = np.meshgrid(np.arange(ctx.w, dtype=np.float32), np.arange(ctx.h, dtype=np.float32))
        L.base = cv2.remap(L.base, gx - field[..., 0], gy - field[..., 1], cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    mask = np.zeros((ctx.h, ctx.w), np.float32)
    color = np.zeros_like(L.base)
    for t in active_tracks(ctx, tf):
        sc = float(t.box_f(tf)[3] - t.box_f(tf)[1])
        for j in EFFECTORS:
            v = _joint_velocity(t, j, tf)
            speed = float(np.hypot(*v))
            if speed < sc * 0.02:
                continue
            p = t.kp_f(tf)[j]
            x, y = int(np.clip(p[0], 0, ctx.w - 1)), int(np.clip(p[1], 0, ctx.h - 1))
            c = L.base[y, x].copy()
            length = min(speed * 3.2 * amount, sc * 0.7)
            u = v / max(speed, 1e-6)
            steps = 6
            for i in range(steps):
                f0, f1 = i / steps, (i + 1) / steps
                a = (1 - f0) ** 1.5 * min(1.0, speed / (sc * 0.08)) * 0.75
                q0 = p - u * length * f0
                q1 = p - u * length * f1
                width = max(2, int(sc * 0.05 * (1 - f0 * 0.8)))
                cv2.line(mask, _pt(q0), _pt(q1), a, width, cv2.LINE_AA)
                cv2.line(color, _pt(q0), _pt(q1), tuple(float(k) for k in c), width, cv2.LINE_AA)
    m = np.clip(_blur(mask, 2.0), 0, 0.9)[..., None]
    peak = np.maximum(_blur(np.max(color, axis=2), 2.0)[..., None], 1e-3)
    tint = _blur(color, 2.0) / np.maximum(_blur((mask > 0).astype(np.float32), 2.0)[..., None], 1e-3)
    L.base = L.base * (1 - m) + np.clip(tint, 0, 1) * m * (peak > 1e-3)


def fx_echo(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    for t in active_tracks(ctx, tf):
        col = ctx.color(t.id)
        e = min(ctx.track_energy(t.id, tf) + 0.25, 1.2)
        for k, lag in enumerate((3.0, 6.0, 9.0, 12.0)):
            tt = tf - lag
            if tt < t.first:
                continue
            m = person_mask(ctx, t, tt, 1.0)
            edge = cv2.subtract(m, cv2.erode(m, np.ones((5, 5), np.uint8))).astype(np.float32) / 255.0
            fill = m.astype(np.float32) / 255.0
            a = (1.0 - k / 4.5) * e * ctx.intensity
            shade = col * (0.55 + 0.45 * (1 - k / 4.0))
            L.add += (edge[..., None] * 1.1 + fill[..., None] * 0.18) * shade * a


EFFECTS["exaggerate"] = fx_exaggerate
EFFECTS["echo"] = fx_echo


def fx_punch(ctx: Ctx, L: Layers, tf: float, of: int) -> None:
    fx_impact(ctx, L, tf, of, comic=False, light=True)


EFFECTS["punch"] = fx_punch
