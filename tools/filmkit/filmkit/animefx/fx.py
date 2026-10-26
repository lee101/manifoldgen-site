"""animefx effect library: anime / comic / GenAI-cleanup layers on float32 RGB frames in [0,1].

Every effect is fn(img, u, k, P, ctx) -> img where
  u   progress through the layer window, 0..1
  k   intensity envelope 0..1 (see ease in engine.py)
  P   resolved params (defaults merged with the recipe layer)
  ctx frame context: w, h, fps, t (seconds into the clip), idx, seed, state (per-layer dict)
Effects are deterministic for (seed, frame) so a render is reproducible and parallel-safe.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

CJK_FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
LATIN_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


@dataclass
class Ctx:
    w: int
    h: int
    fps: float
    t: float = 0.0
    idx: int = 0
    seed: int = 1
    state: dict = field(default_factory=dict)

    def rng(self, salt: int = 0, hold: int = 1) -> np.random.Generator:
        return np.random.default_rng([self.seed, salt, self.idx // max(1, hold)])


@dataclass
class Fx:
    name: str
    fn: Callable
    group: str
    desc: str
    params: dict  # name -> (default, description)


FX: dict[str, Fx] = {}


def fx(name: str, group: str, desc: str, **params):
    def deco(fn):
        FX[name] = Fx(name, fn, group, desc, {k: (v[0], v[1]) for k, v in params.items()})
        return fn
    return deco


def color(value, default=(1.0, 1.0, 1.0)) -> np.ndarray:
    if value is None:
        return np.array(default, np.float32)
    if isinstance(value, str):
        v = value.lstrip("#")
        return np.array([int(v[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)
    return np.array(value, np.float32)


def luma(img: np.ndarray) -> np.ndarray:
    return img[..., 0] * 0.2126 + img[..., 1] * 0.7152 + img[..., 2] * 0.0722


def blur(img: np.ndarray, sigma: float) -> np.ndarray:
    return cv2.GaussianBlur(img, (0, 0), max(0.1, sigma))


def mix(a: np.ndarray, b: np.ndarray, m) -> np.ndarray:
    return a + (b - a) * m


def over(img: np.ndarray, rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    return img * (1 - alpha[..., None]) + rgb * alpha[..., None]


def affine(img: np.ndarray, scale=1.0, dx=0.0, dy=0.0, rot=0.0, center=None) -> np.ndarray:
    h, w = img.shape[:2]
    cx, cy = center if center else (w / 2, h / 2)
    m = cv2.getRotationMatrix2D((cx, cy), rot, scale)
    m[0, 2] += dx
    m[1, 2] += dy
    return cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def smooth_noise(seed: int, t: float, octaves=3) -> float:
    """Deterministic smooth 1D noise in about [-1, 1]."""
    v = 0.0
    for o in range(octaves):
        f = 0.7 * (2.1 ** o)
        v += math.sin(2 * math.pi * f * t + seed * 1.713 + o * 2.9) / (1.7 ** o)
    return v / 1.8


def _px(ctx: Ctx, frac: float) -> float:
    return frac * ctx.w


# ---------------------------------------------------------------- finish / camera

@fx("grain", "finish", "Film grain (luma weighted, new pattern every frame).",
    amount=(0.05, "strength 0-0.3"), size=(1.0, "grain size px"), chroma=(0.25, "colour noise share"))
def grain(img, u, k, P, ctx):
    r = ctx.rng(11)
    h, w = img.shape[:2]
    s = max(1.0, P["size"])
    n = r.standard_normal((int(h / s), int(w / s), 1)).astype(np.float32)
    n = cv2.resize(n, (w, h), interpolation=cv2.INTER_LINEAR)[..., None] if s > 1 else n
    c = r.standard_normal((h, w, 3)).astype(np.float32) * P["chroma"] if P["chroma"] else 0
    weight = 1.0 - 0.6 * np.abs(luma(img) - 0.5)[..., None]
    return img + (n + c) * P["amount"] * k * weight


@fx("bloom", "finish", "Soft highlight glow / halation; tint it warm for neon.",
    threshold=(0.62, "highlight threshold"), intensity=(0.55, "glow strength"), radius=(0.02, "blur radius, fraction of width"),
    tint=("#ffd9b0", "glow colour"))
def bloom(img, u, k, P, ctx):
    h, w = img.shape[:2]
    small = cv2.resize(img, (w // 4, h // 4), interpolation=cv2.INTER_AREA)
    bright = np.clip((small - P["threshold"]) / max(1e-3, 1 - P["threshold"]), 0, 1)
    g = blur(bright, P["radius"] * w / 4) + 0.5 * blur(bright, P["radius"] * w / 1.5)
    g = cv2.resize(g, (w, h), interpolation=cv2.INTER_LINEAR)
    return img + g * color(P["tint"]) * P["intensity"] * k


@fx("chromatic", "finish", "Radial chromatic aberration (lens fringe).", amount=(0.004, "fraction of width at the edge"))
def chromatic(img, u, k, P, ctx):
    a = P["amount"] * k
    if a < 1e-5:
        return img
    out = img.copy()
    out[..., 0] = cv2.warpAffine(
        img[..., 0], cv2.getRotationMatrix2D((ctx.w / 2, ctx.h / 2), 0, 1 + a * 2), (ctx.w, ctx.h), borderMode=cv2.BORDER_REFLECT)
    out[..., 2] = cv2.warpAffine(
        img[..., 2], cv2.getRotationMatrix2D((ctx.w / 2, ctx.h / 2), 0, 1 - a * 2), (ctx.w, ctx.h), borderMode=cv2.BORDER_REFLECT)
    return out


@fx("vignette", "finish", "Darken the corners.", strength=(0.3, "0-1"), softness=(0.6, "0-1"))
def vignette(img, u, k, P, ctx):
    key = ("vig", P["softness"])
    if key not in ctx.state:
        ys, xs = np.mgrid[0:ctx.h, 0:ctx.w].astype(np.float32)
        d = np.hypot((xs - ctx.w / 2) / (ctx.w / 2), (ys - ctx.h / 2) / (ctx.h / 2)) / 1.4142
        ctx.state[key] = (np.clip((d - (1 - P["softness"]) * 0.7) / max(0.05, P["softness"]), 0, 1) ** 1.6)[..., None]
    return img * (1 - ctx.state[key] * P["strength"] * k)


@fx("grade", "finish", "Colour grade: lift/gain/gamma, contrast, saturation, warm-cool, tint.",
    lift=(0.0, "black lift"), gain=(1.0, "gain"), gamma=(1.0, "gamma"), contrast=(1.0, "contrast"),
    saturation=(1.0, "saturation"), temp=(0.0, "-1 cool .. +1 warm"), tint=(0.0, "-1 green .. +1 magenta"))
def grade(img, u, k, P, ctx):
    o = img
    o = o * P["gain"] + P["lift"]
    o = (o - 0.5) * P["contrast"] + 0.5
    o = np.clip(o, 0, None) ** (1.0 / max(0.05, P["gamma"]))
    l = luma(o)[..., None]
    o = l + (o - l) * P["saturation"]
    o = o * np.array([1 + 0.12 * P["temp"], 1 - 0.06 * P["tint"], 1 - 0.12 * P["temp"]], np.float32)
    return mix(img, o, k)


@fx("letterbox", "finish", "Cinema bars.", ratio=(2.39, "aspect ratio"))
def letterbox(img, u, k, P, ctx):
    bar = int(max(0, (ctx.h - ctx.w / P["ratio"]) / 2))
    if bar > 0:
        img = img.copy()
        img[:bar] = 0
        img[ctx.h - bar:] = 0
    return img


@fx("fade", "finish", "Fade from/to a colour over the layer window.", mode=("out", "in | out"), color=("#000000", "fade colour"))
def fade(img, u, k, P, ctx):
    m = (1 - u) if P["mode"] == "in" else u
    return mix(img, color(P["color"]), m)


@fx("handheld", "camera", "Deliberate handheld drift: slow translate + roll, edge-safe zoom.",
    amount=(0.004, "translate, fraction of width"), roll=(0.12, "degrees"), speed=(0.6, "drift speed"))
def handheld(img, u, k, P, ctx):
    t = ctx.t * P["speed"]
    s = ctx.seed
    dx = smooth_noise(s, t) * P["amount"] * ctx.w * k
    dy = smooth_noise(s + 7, t) * P["amount"] * ctx.w * 0.7 * k
    rot = smooth_noise(s + 13, t) * P["roll"] * k
    return affine(img, 1 + P["amount"] * 2.4 * k, dx, dy, rot)


@fx("push_in", "camera", "Slow digital push-in / pull-out across the layer window.",
    zoom=(0.06, "total zoom (negative = pull out)"), cx=(0.5, "focus x 0-1"), cy=(0.5, "focus y 0-1"))
def push_in(img, u, k, P, ctx):
    z = 1 + P["zoom"] * u if P["zoom"] >= 0 else 1 + abs(P["zoom"]) * (1 - u)
    return affine(img, z, center=(P["cx"] * ctx.w, P["cy"] * ctx.h))


# ---------------------------------------------------------------- anime look (make GenAI video read as drawn)

@fx("on_twos", "anime", "Animate on twos: hold every Nth frame like real hand-drawn anime (12 fps feel). Put it first.",
    hold=(2, "frames to hold (2 = 12fps from 24, 3 = 8fps)"))
def on_twos(img, u, k, P, ctx):
    hold = int(P["hold"])
    if k > 0.5 and ctx.idx % hold != 0 and "held" in ctx.state:
        return ctx.state["held"]
    ctx.state["held"] = img
    return img


@fx("line_boil", "anime", "Hand-drawn line boil: tiny low-frequency wobble that re-rolls every few frames.",
    amount=(1.4, "pixels"), scale=(0.08, "noise scale, fraction of width"), hold=(2, "re-roll every N frames"))
def line_boil(img, u, k, P, ctx):
    r = ctx.rng(5, int(P["hold"]))
    gw = max(4, int(1 / P["scale"] * 1.0))
    gh = max(3, int(gw * ctx.h / ctx.w))
    nx = cv2.resize(r.standard_normal((gh, gw)).astype(np.float32), (ctx.w, ctx.h), interpolation=cv2.INTER_CUBIC)
    ny = cv2.resize(r.standard_normal((gh, gw)).astype(np.float32), (ctx.w, ctx.h), interpolation=cv2.INTER_CUBIC)
    xs, ys = np.meshgrid(np.arange(ctx.w, dtype=np.float32), np.arange(ctx.h, dtype=np.float32))
    return cv2.remap(img, xs + nx * P["amount"] * k, ys + ny * P["amount"] * k, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


@fx("ink_edges", "anime", "Ink outlines from a difference-of-gaussians edge pass (comic / cel linework).",
    strength=(0.55, "line opacity"), width=(1.2, "line width px"), threshold=(0.045, "edge threshold"),
    ink=("#14101c", "line colour"))
def ink_edges(img, u, k, P, ctx):
    l = luma(img)
    d = np.abs(blur(l, P["width"]) - blur(l, P["width"] * 1.9))
    e = np.clip((d - P["threshold"] * 0.3) / max(1e-3, P["threshold"]), 0, 1)
    return over(img, color(P["ink"]), e * P["strength"] * k)


@fx("cel", "anime", "Cel shading: edge-preserving flatten + soft luma banding.",
    levels=(9, "luma bands"), flatten=(0.5, "0-1 colour flattening"), soft=(0.55, "band softness"))
def cel(img, u, k, P, ctx):
    small = cv2.resize((np.clip(img, 0, 1) * 255).astype(np.uint8), (ctx.w // 2, ctx.h // 2), interpolation=cv2.INTER_AREA)
    for _ in range(2):
        small = cv2.bilateralFilter(small, 7, 38 * P["flatten"] + 8, 6)
    flat = cv2.resize(small, (ctx.w, ctx.h), interpolation=cv2.INTER_CUBIC).astype(np.float32) / 255
    hsv = cv2.cvtColor(np.clip(flat, 0, 1), cv2.COLOR_RGB2HSV)
    v = hsv[..., 2]
    q = np.round(v * P["levels"]) / P["levels"]
    hsv[..., 2] = mix(q, v, P["soft"])
    return mix(img, cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB), k)


@fx("screentone", "comic", "Manga screentone: halftone dots whose size follows shadow depth.",
    size=(7.0, "dot pitch px"), angle=(45.0, "degrees"), strength=(0.55, "ink opacity"), shadow_start=(0.55, "luma below which dots appear"),
    ink=("#120e18", "dot colour"), paper=(0.0, "0-1 tint highlights toward paper white"))
def screentone(img, u, k, P, ctx):
    key = ("tone", P["size"], P["angle"])
    if key not in ctx.state:
        ys, xs = np.mgrid[0:ctx.h, 0:ctx.w].astype(np.float32)
        a = math.radians(P["angle"])
        rx = xs * math.cos(a) + ys * math.sin(a)
        ry = -xs * math.sin(a) + ys * math.cos(a)
        fx_ = (rx / P["size"]) % 1.0 - 0.5
        fy_ = (ry / P["size"]) % 1.0 - 0.5
        ctx.state[key] = np.hypot(fx_, fy_).astype(np.float32)
    dist = ctx.state[key]
    dark = np.clip((P["shadow_start"] - blur(luma(img), 2.0)) / max(1e-3, P["shadow_start"]), 0, 1)
    radius = np.sqrt(dark) * 0.72
    ink = np.clip((radius - dist) * P["size"] * 0.9 + 0.5, 0, 1)
    out = over(img, color(P["ink"]), ink * P["strength"] * k)
    return mix(out, out * 0.92 + 0.08, P["paper"] * k)


@fx("comic_panels", "comic", "Slanted comic panel split with gutters; each panel re-frames the shot.",
    panels=(3, "2-4"), gutter=(0.012, "gutter, fraction of width"), skew=(0.1, "slant"), zoom=(1.35, "punch-in on the secondary panels"),
    paper=("#f4efe6", "gutter colour"))
def comic_panels(img, u, k, P, ctx):
    n = int(P["panels"])
    h, w = ctx.h, ctx.w
    canvas = np.empty_like(img)
    canvas[:] = color(P["paper"])
    cuts = [w * i / n for i in range(n + 1)]
    g = P["gutter"] * w
    foci = [(0.5, 0.5), (0.3, 0.45), (0.7, 0.5), (0.5, 0.35)]
    for i in range(n):
        x0, x1 = cuts[i], cuts[i + 1]
        sk = P["skew"] * h / 2
        poly = np.array([[x0 + sk + g / 2, g / 2], [x1 + sk - g / 2, g / 2], [x1 - sk - g / 2, h - g / 2], [x0 - sk + g / 2, h - g / 2]], np.int32)
        if i == 0:
            poly[[0, 3], 0] = [-4, -4]
        if i == n - 1:
            poly[[1, 2], 0] = [w + 4, w + 4]
        z = 1.0 if i == 0 else P["zoom"]
        fxp, fyp = foci[i % 4]
        pic = affine(img, z, center=(fxp * w, fyp * h))
        m = np.zeros((h, w), np.uint8)
        cv2.fillConvexPoly(m, poly, 255, cv2.LINE_AA)
        a = (m.astype(np.float32) / 255)
        slide = (1 - min(1, u * 3 + 0.0)) * (h * 0.2) * (1 if i % 2 else -1) if k > 0 else 0
        canvas = over(canvas, affine(pic, 1, 0, slide), a)
    return mix(img, canvas, k)


# ---------------------------------------------------------------- impact / comic emphasis

def _line_overlay(ctx: Ctx, P: dict, k: float, hold: int, salt: int) -> np.ndarray:
    r = ctx.rng(salt, hold)
    h, w = ctx.h, ctx.w
    mask = np.zeros((h, w), np.uint8)
    cx, cy = P["cx"] * w, P["cy"] * h
    R = math.hypot(w, h)
    count = int(P["count"])
    if P["mode"] == "radial":
        for _ in range(count):
            a = r.uniform(0, 2 * math.pi)
            r0 = R * P["inner"] * r.uniform(0.85, 1.4)
            r1 = R * r.uniform(0.7, 1.1)
            wd = r.uniform(0.002, 0.012) * (1 + 2 * (r.random() > 0.9))
            d = np.array([math.cos(a), math.sin(a)])
            pp = np.array([-d[1], d[0]])
            tip = np.array([cx, cy]) + d * r0
            far = np.array([cx, cy]) + d * r1
            pts = np.array([tip, far + pp * R * wd, far - pp * R * wd], np.int32)
            cv2.fillConvexPoly(mask, pts, 255, cv2.LINE_AA)
    else:  # parallel
        a = math.radians(P["angle"])
        d = np.array([math.cos(a), math.sin(a)])
        pp = np.array([-d[1], d[0]])
        for _ in range(count):
            off = r.uniform(-0.6, 0.6) * R
            s0 = r.uniform(-0.6, 0.3) * R
            ln = r.uniform(0.15, 0.7) * R
            c0 = np.array([w / 2, h / 2]) + pp * off + d * s0
            wd = r.uniform(0.6, 2.2)
            pts = np.array([c0, c0 + d * ln + pp * wd, c0 + d * ln - pp * wd], np.int32)
            cv2.fillConvexPoly(mask, pts, 255, cv2.LINE_AA)
    return cv2.GaussianBlur(mask, (0, 0), 0.7).astype(np.float32) / 255


@fx("speed_lines", "comic", "Manga speed / focus lines (radial focus burst or parallel speed streaks), drawn on twos.",
    mode=("radial", "radial | parallel"), count=(90, "number of lines"), inner=(0.22, "clear centre radius, fraction of diagonal"),
    opacity=(0.8, "0-1"), color=("#ffffff", "line colour"), cx=(0.5, "focus x"), cy=(0.5, "focus y"),
    angle=(0.0, "parallel angle degrees"), hold=(2, "re-roll every N frames"))
def speed_lines(img, u, k, P, ctx):
    m = _line_overlay(ctx, P, k, int(P["hold"]), 21)
    return over(img, color(P["color"]), m * P["opacity"] * k)


@fx("impact_burst", "comic", "Comic starburst (POW shape) with ink outline, expanding at the hit point.",
    cx=(0.5, "x 0-1"), cy=(0.5, "y 0-1"), radius=(0.32, "fraction of width"), rays=(18, "points"), color=("#fff2a8", "fill"),
    ink=("#18101c", "outline"), opacity=(0.95, "0-1"))
def impact_burst(img, u, k, P, ctx):
    r = np.random.default_rng([ctx.seed, 33])  # constant shape through the hit, grows with u
    n = int(P["rays"])
    grow = 1 - (1 - min(1, u * 3.5)) ** 3
    R = P["radius"] * ctx.w * (0.35 + 0.65 * grow)
    pts = []
    for i in range(n * 2):
        ang = math.pi * i / n + 0.2
        rad = R * (1.0 if i % 2 == 0 else 0.55) * r.uniform(0.85, 1.12)
        pts.append([P["cx"] * ctx.w + rad * math.cos(ang), P["cy"] * ctx.h + rad * math.sin(ang)])
    pts = np.array(pts, np.int32)
    fill = np.zeros((ctx.h, ctx.w), np.uint8)
    cv2.fillPoly(fill, [pts], 255, cv2.LINE_AA)
    edge = np.zeros_like(fill)
    cv2.polylines(edge, [pts], True, 255, max(2, int(ctx.w * 0.004)), cv2.LINE_AA)
    a = k * P["opacity"]
    out = over(img, color(P["color"]), fill.astype(np.float32) / 255 * a)
    return over(out, color(P["ink"]), edge.astype(np.float32) / 255 * a)


@fx("flash", "comic", "Impact frame: white/black flash or a hard colour inversion that decays.",
    mode=("white", "white | black | invert | negative"), color=("#ffffff", "flash colour when mode=white"))
def flash(img, u, k, P, ctx):
    if P["mode"] == "invert":
        return mix(img, 1 - img, k > 0.5)
    if P["mode"] == "negative":  # high-contrast negative, the anime 'impact still'
        l = luma(img)
        neg = np.repeat((1 - np.clip((l - 0.5) * 3 + 0.5, 0, 1))[..., None], 3, 2)
        return mix(img, neg, k)
    tgt = np.zeros(3, np.float32) if P["mode"] == "black" else color(P["color"])
    return mix(img, tgt, k)


@fx("surprise", "genai", "The surprise shader: punch-in zoom, RGB split, contrast snap, focus lines and shake, decaying. Use at a startle.",
    strength=(1.0, "0-2"), cx=(0.5, "focus x"), cy=(0.45, "focus y"), lines=(True, "focus lines"), flash=(True, "first-frame flash"))
def surprise(img, u, k, P, ctx):
    s = P["strength"] * k
    if s < 1e-3:
        return img
    r = ctx.rng(77)
    sh = r.normal(0, 1, 2) * s * ctx.w * 0.004
    out = affine(img, 1 + 0.07 * s, sh[0], sh[1], center=(P["cx"] * ctx.w, P["cy"] * ctx.h))
    out = chromatic(out, u, 1, {"amount": 0.006 * s}, ctx)
    l = luma(out)[..., None]
    out = (l + (out - l) * (1 - 0.35 * min(1, s))) 
    out = (out - 0.5) * (1 + 0.32 * min(1.5, s)) + 0.5
    if P["lines"]:
        lp = {"mode": "radial", "count": 70, "inner": 0.2, "cx": P["cx"], "cy": P["cy"]}
        out = over(out, np.ones(3, np.float32), _line_overlay(ctx, lp, 1, 2, 23) * 0.75 * min(1, s))
    if P["flash"] and u < 0.12:
        out = mix(out, 1.0, (1 - u / 0.12) * 0.6 * min(1, s))
    return out


@fx("doki", "genai", "Heartbeat pulse: double-thump zoom, vignette throb, tiny desaturation. Pair with onomatopoeia ドキ.",
    bpm=(78, "beats per minute"), depth=(0.025, "zoom depth"), throb=(0.25, "vignette throb"))
def doki(img, u, k, P, ctx):
    ph = (ctx.t * P["bpm"] / 60.0) % 1.0
    pulse = math.exp(-((ph - 0.04) / 0.07) ** 2) + 0.65 * math.exp(-((ph - 0.26) / 0.07) ** 2)
    out = affine(img, 1 + P["depth"] * pulse * k)
    v = vignette(out, u, 1, {"strength": P["throb"] * pulse, "softness": 0.7}, ctx)
    return mix(out, v, k)


@fx("glitch", "genai", "Digital slice glitch with channel split. Rei's system-slip moments, subtle at low strength.",
    strength=(0.4, "0-1"), slices=(9, "bands"), hold=(2, "re-roll frames"), split=(0.004, "channel split fraction"))
def glitch(img, u, k, P, ctx):
    s = P["strength"] * k
    if s < 0.02:
        return img
    r = ctx.rng(91, int(P["hold"]))
    out = img.copy()
    for _ in range(int(P["slices"])):
        y0 = int(r.uniform(0, ctx.h))
        hh = int(r.uniform(0.01, 0.08) * ctx.h)
        sx = int(r.normal(0, 1) * ctx.w * 0.05 * s)
        out[y0:y0 + hh] = np.roll(out[y0:y0 + hh], sx, axis=1)
    sp = int(P["split"] * ctx.w * s * 3)
    if sp:
        out[..., 0] = np.roll(out[..., 0], sp, axis=1)
        out[..., 2] = np.roll(out[..., 2], -sp, axis=1)
    return out


# ---------------------------------------------------------------- emotes & text

_font_cache: dict = {}


def _font(path: str, size: int):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size, index=0) if path.endswith(".ttc") else ImageFont.truetype(path, size)
    return _font_cache[key]


def _sprite(text: str, size: int, fill, stroke, stroke_w: int, font_path: str) -> np.ndarray:
    f = _font(font_path, size)
    pad = stroke_w * 2 + 8
    dummy = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    box = dummy.textbbox((0, 0), text, font=f, stroke_width=stroke_w)
    im = Image.new("RGBA", (box[2] - box[0] + pad * 2, box[3] - box[1] + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((pad - box[0], pad - box[1]), text, font=f, fill=tuple(int(c * 255) for c in fill) + (255,),
           stroke_width=stroke_w, stroke_fill=tuple(int(c * 255) for c in stroke) + (255,))
    return np.asarray(im).astype(np.float32) / 255


def _paste(img: np.ndarray, sprite: np.ndarray, cx: float, cy: float, scale=1.0, angle=0.0, alpha=1.0) -> np.ndarray:
    sh, sw = sprite.shape[:2]
    m = cv2.getRotationMatrix2D((sw / 2, sh / 2), angle, scale)
    nw, nh = int(sw * scale + sh * 0.5), int(sh * scale + sw * 0.5)
    m[0, 2] += nw / 2 - sw / 2
    m[1, 2] += nh / 2 - sh / 2
    sp = cv2.warpAffine(sprite, m, (nw, nh), flags=cv2.INTER_LINEAR)
    x0, y0 = int(cx - nw / 2), int(cy - nh / 2)
    h, w = img.shape[:2]
    ax0, ay0, ax1, ay1 = max(0, x0), max(0, y0), min(w, x0 + nw), min(h, y0 + nh)
    if ax1 <= ax0 or ay1 <= ay0:
        return img
    part = sp[ay0 - y0:ay1 - y0, ax0 - x0:ax1 - x0]
    a = part[..., 3:4] * alpha
    out = img.copy()
    out[ay0:ay1, ax0:ax1] = out[ay0:ay1, ax0:ax1] * (1 - a) + part[..., :3] * a
    return out


def _pop(u: float) -> float:
    """Overshoot pop-in over the first 18% of the window."""
    if u >= 0.18:
        return 1.0
    x = u / 0.18
    return 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2 if x < 1 else 1.0


@fx("onomatopoeia", "comic", "Comic / manga sound-effect lettering (ドキ, ゴゴゴ, POW) that pops in, wobbles and fades.",
    text=("ドキ", "the lettering"), x=(0.78, "x 0-1"), y=(0.25, "y 0-1"), size=(0.11, "font size, fraction of height"),
    fill=("#ffffff", "fill"), stroke=("#1a1420", "outline"), stroke_w=(5, "outline px"), angle=(-8.0, "degrees"),
    wobble=(1.5, "wobble degrees"), latin=(False, "use the Latin comic font"))
def onomatopoeia(img, u, k, P, ctx):
    size = max(12, int(P["size"] * ctx.h))
    key = ("ono", P["text"], size, P["fill"], P["stroke"], P["stroke_w"], P["latin"])
    if key not in ctx.state:
        ctx.state[key] = _sprite(P["text"], size, color(P["fill"]), color(P["stroke"]), int(P["stroke_w"]),
                                 LATIN_FONT if P["latin"] else CJK_FONT)
    fade_out = min(1.0, (1 - u) / 0.2) if u > 0.8 else 1.0
    ang = P["angle"] + P["wobble"] * math.sin(ctx.t * 22)
    return _paste(img, ctx.state[key], P["x"] * ctx.w, P["y"] * ctx.h, _pop(u), ang, fade_out * min(1.0, k * 4))


def _star(mask: np.ndarray, cx: float, cy: float, r: float) -> None:
    pts = []
    for i in range(8):
        ang = math.pi / 4 * i - math.pi / 2
        rad = r if i % 2 == 0 else r * 0.16
        pts.append([cx + rad * math.cos(ang), cy + rad * math.sin(ang)])
    cv2.fillPoly(mask, [np.array(pts, np.int32)], 255, cv2.LINE_AA)


@fx("sparkle", "comic", "Twinkling 4-point anime sparkles in a region.",
    count=(7, "sparkles"), region=([0.55, 0.1, 0.95, 0.5], "x0,y0,x1,y1 (0-1)"), size=(0.045, "fraction of width"),
    color=("#fff6d8", "colour"), speed=(0.9, "twinkles per second"))
def sparkle(img, u, k, P, ctx):
    r = np.random.default_rng([ctx.seed, 41])
    x0, y0, x1, y1 = P["region"]
    mask = np.zeros((ctx.h, ctx.w), np.uint8)
    for _ in range(int(P["count"])):
        cx, cy = r.uniform(x0, x1) * ctx.w, r.uniform(y0, y1) * ctx.h
        ph, sz = r.uniform(0, 1), r.uniform(0.5, 1.0)
        b = max(0.0, math.sin(2 * math.pi * (ctx.t * P["speed"] + ph))) ** 3
        if b > 0.02:
            tile = np.zeros_like(mask)
            _star(tile, cx, cy, P["size"] * ctx.w * sz * (0.4 + 0.6 * b))
            mask = np.maximum(mask, (tile * b).astype(np.uint8))
    m = blur(mask.astype(np.float32) / 255, 1.0)
    return img + m[..., None] * color(P["color"]) * 1.3 * k


@fx("sweatdrop", "comic", "Anime sweat-drop emote that pops and slides.", x=(0.62, "x"), y=(0.2, "y"), size=(0.035, "fraction of width"))
def sweatdrop(img, u, k, P, ctx):
    s = P["size"] * ctx.w * _pop(u)
    cx, cy = P["x"] * ctx.w, P["y"] * ctx.h + u * s * 1.4
    m = np.zeros((ctx.h, ctx.w), np.uint8)
    cv2.circle(m, (int(cx), int(cy + s * 0.5)), int(s * 0.55), 255, -1, cv2.LINE_AA)
    cv2.fillConvexPoly(m, np.array([[cx, cy - s * 0.9], [cx - s * 0.5, cy + s * 0.3], [cx + s * 0.5, cy + s * 0.3]], np.int32), 255, cv2.LINE_AA)
    a = m.astype(np.float32) / 255 * k * min(1, (1 - u) * 4)
    out = over(img, color("#a9ddff"), a * 0.92)
    hl = np.zeros_like(m)
    cv2.circle(hl, (int(cx - s * 0.18), int(cy + s * 0.4)), max(1, int(s * 0.14)), 255, -1, cv2.LINE_AA)
    return over(out, np.ones(3, np.float32), hl.astype(np.float32) / 255 * k * 0.9 * min(1, (1 - u) * 4))


@fx("eye_glow", "genai", "Pulsing / flickering light at points (a synthetic's eyes, a status LED).",
    points=([[0.45, 0.4], [0.52, 0.4]], "list of [x,y] 0-1"), radius=(0.012, "fraction of width"),
    color=("#bfe9ff", "light colour"), hz=(0.7, "pulse rate"), flicker=(0.6, "0-1 random dropouts"), intensity=(1.0, "strength"))
def eye_glow(img, u, k, P, ctx):
    r = ctx.rng(63, 2)
    f = 0.5 + 0.5 * math.sin(2 * math.pi * P["hz"] * ctx.t)
    f *= 1 - P["flicker"] * (r.random() > 0.55) * r.random()
    glow = np.zeros((ctx.h, ctx.w), np.float32)
    for px, py in P["points"]:
        cv2.circle(glow, (int(px * ctx.w), int(py * ctx.h)), max(1, int(P["radius"] * ctx.w * 0.4)), 1.0, -1, cv2.LINE_AA)
    g = blur(glow, P["radius"] * ctx.w) * 3.2 + blur(glow, P["radius"] * ctx.w * 3.5) * 1.2 + glow * 0.8
    return img + g[..., None] * color(P["color"]) * P["intensity"] * f * k


# ---------------------------------------------------------------- atmosphere

@fx("rain", "atmosphere", "Procedural rain streaks in depth layers (needs no source rain).",
    density=(220, "streaks per layer"), layers=(3, "depth layers"), angle=(12.0, "lean degrees"), opacity=(0.22, "0-1"),
    speed=(1.0, "fall speed"), color=("#cfe0ff", "colour"))
def rain(img, u, k, P, ctx):
    h, w = ctx.h, ctx.w
    over_mask = np.zeros((h, w), np.uint8)
    lean = math.tan(math.radians(P["angle"]))
    for layer in range(int(P["layers"])):
        r = np.random.default_rng([ctx.seed, 50, layer])
        n = int(P["density"])
        depth = 0.45 + 0.55 * layer / max(1, P["layers"] - 1)
        x0, y0 = r.uniform(-0.2 * w, 1.2 * w, n), r.uniform(0, h * 1.4, n)
        ln = r.uniform(0.02, 0.05, n) * h * (0.5 + depth)
        sp = r.uniform(900, 1300, n) * depth * P["speed"]
        yy = (y0 + sp * ctx.t) % (h * 1.4) - 0.2 * h
        xx = x0 + lean * (yy - y0) * 0.0 + lean * yy
        for i in range(n):
            cv2.line(over_mask, (int(xx[i]), int(yy[i])), (int(xx[i] + lean * ln[i]), int(yy[i] + ln[i])), int(120 + 135 * depth),
                     1 if depth < 0.8 else 2, cv2.LINE_AA)
    m = over_mask.astype(np.float32) / 255
    return img + m[..., None] * color(P["color"]) * P["opacity"] * k


@fx("glass_drops", "atmosphere", "Rain on a window: refracting beads, clean trails through fog. For the final window shot.",
    drops=(36, "moving drops"), beads=(70, "static beads"), fog=(0.5, "condensation blur 0-1"), size=(0.012, "drop radius, fraction of width"))
def glass_drops(img, u, k, P, ctx):
    h, w = ctx.h, ctx.w
    r = np.random.default_rng([ctx.seed, 88])
    nd, nb = int(P["drops"]), int(P["beads"])
    t0 = r.uniform(0, 0.7 * max(ctx.state.get("dur", 6.0), 1.0), nd)
    x = r.uniform(0.02, 0.98, nd) * w
    y0 = r.uniform(0.0, 0.55, nd) * h
    v = r.uniform(0.04, 0.16, nd) * h
    rad = r.uniform(0.6, 1.5, nd) * P["size"] * w
    bx, by, br = r.uniform(0, w, nb), r.uniform(0, h, nb), r.uniform(0.25, 0.7, nb) * P["size"] * w
    clear = np.zeros((h, w), np.uint8)
    drops = []
    for i in range(nd):
        tt = max(0.0, ctx.t - t0[i])
        if ctx.t < t0[i]:
            continue
        y = y0[i] + v[i] * tt * (0.6 + 0.4 * abs(math.sin(tt * 1.3 + i)))
        if y > h + rad[i]:
            continue
        cv2.line(clear, (int(x[i]), int(y0[i])), (int(x[i]), int(y)), 255, max(2, int(rad[i] * 0.9)), cv2.LINE_AA)
        drops.append((x[i], y, rad[i]))
    for i in range(nb):
        drops.append((bx[i], by[i], br[i]))
    clear_f = blur(clear.astype(np.float32) / 255, 1.5)
    fog = blur(img, P["fog"] * 7 + 0.1)
    out = mix(fog * (1 - 0.06 * P["fog"]) + 0.02 * P["fog"], img, clear_f[..., None])
    out = mix(img, out, k)
    for dx, dy, dr in drops:
        R = int(dr * 1.25)
        x0, y0_, x1, y1 = int(dx) - R, int(dy) - R, int(dx) + R, int(dy) + R
        if x0 < 0 or y0_ < 0 or x1 >= w or y1 >= h or R < 2:
            continue
        roi = out[y0_:y1, x0:x1]
        refr = cv2.flip(roi, -1)
        refr = cv2.resize(refr, None, fx=1.0, fy=1.0)
        yy, xx = np.mgrid[-R:R, -R:R].astype(np.float32)
        d = np.hypot(xx, yy / 1.25) / R
        a = np.clip((0.95 - d) * 8, 0, 1)[..., None]
        lit = refr * 1.08 + 0.015
        rim = np.clip(1 - np.abs(d - 0.88) * 14, 0, 1)[..., None] * 0.18
        spec = np.clip(1 - np.hypot(xx + R * 0.35, yy + R * 0.4) / (R * 0.22), 0, 1)[..., None] * 0.9
        out[y0_:y1, x0:x1] = roi * (1 - a) + (lit - rim * 0.6 + spec) * a
    return out


@fx("bokeh", "atmosphere", "Drifting out-of-focus neon bokeh discs.",
    count=(26, "discs"), size=(0.035, "fraction of width"), opacity=(0.2, "0-1"), drift=(0.015, "drift speed"),
    palette=(["#ff6fa8", "#ffb25c", "#6fd0ff", "#c9a2ff"], "colours"))
def bokeh(img, u, k, P, ctx):
    r = np.random.default_rng([ctx.seed, 71])
    canvas = np.zeros((ctx.h // 2, ctx.w // 2, 3), np.float32)
    pal = [color(c) for c in P["palette"]]
    for i in range(int(P["count"])):
        cx = (r.uniform() + P["drift"] * ctx.t * r.uniform(-1, 1)) % 1.0 * canvas.shape[1]
        cy = (r.uniform(0.1, 1.0) + P["drift"] * 0.4 * ctx.t * r.uniform(-1, 1)) % 1.0 * canvas.shape[0]
        rad = P["size"] * ctx.w / 2 * r.uniform(0.4, 1.5)
        col = pal[i % len(pal)] * r.uniform(0.5, 1.0)
        tw = 0.75 + 0.25 * math.sin(ctx.t * r.uniform(0.5, 2) + i)
        cv2.circle(canvas, (int(cx), int(cy)), max(2, int(rad)), tuple(float(c * tw) for c in col), -1, cv2.LINE_AA)
    canvas = cv2.resize(blur(canvas, 3.0), (ctx.w, ctx.h), interpolation=cv2.INTER_LINEAR)
    return img + canvas * P["opacity"] * k


@fx("light_leak", "atmosphere", "Slow warm light leak from an edge.", color=("#ff9a4d", "colour"), intensity=(0.35, "0-1"),
    speed=(0.25, "drift"), side=("right", "left | right | top | bottom"))
def light_leak(img, u, k, P, ctx):
    ys, xs = np.mgrid[0:ctx.h, 0:ctx.w].astype(np.float32)
    nx, ny = xs / ctx.w, ys / ctx.h
    d = {"left": nx, "right": 1 - nx, "top": ny, "bottom": 1 - ny}[P["side"]]
    drift = 0.5 + 0.5 * math.sin(ctx.t * P["speed"] * 2 * math.pi / 4)
    g = np.exp(-(d / (0.28 + 0.12 * drift)) ** 2)[..., None]
    return img + g * color(P["color"]) * P["intensity"] * k


def list_effects() -> list[dict]:
    return [{"fx": f.name, "group": f.group, "description": f.desc,
             "params": {n: {"default": d, "description": desc} for n, (d, desc) in f.params.items()}}
            for f in FX.values()]
