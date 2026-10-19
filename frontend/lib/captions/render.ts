import type { AnimIn, CaptionDoc, CaptionPage, CaptionStyle, CaptionWord } from './types';
import { fontShorthand } from './registry';
import { buildPages, pageAt, resolveEmphasis } from './words';

type Ctx = CanvasRenderingContext2D;
type Surface = { canvas: HTMLCanvasElement; ctx: Ctx };

const GLYPHS = '▓▒░#@$%&*+=<>/\\|01{}[]~^';

function hash(...values: number[]) {
  let h = 2166136261 >>> 0;
  for (const value of values) {
    h ^= Math.floor(value * 1000) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 2246822519);
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

const clamp = (value: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, value));
const easeOutCubic = (p: number) => 1 - (1 - p) ** 3;
const easeOutExpo = (p: number) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p));
const easeOutBack = (p: number, s: number) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2;
const easeOutBounce = (p: number) => {
  if (p < 1 / 2.75) return 7.5625 * p * p;
  if (p < 2 / 2.75) return 7.5625 * (p -= 1.5 / 2.75) * p + 0.75;
  if (p < 2.5 / 2.75) return 7.5625 * (p -= 2.25 / 2.75) * p + 0.9375;
  return 7.5625 * (p -= 2.625 / 2.75) * p + 0.984375;
};

function surface(): Surface {
  const canvas = document.createElement('canvas');
  return { canvas, ctx: canvas.getContext('2d', { willReadFrequently: false }) as Ctx };
}

function fit(target: Surface, width: number, height: number) {
  const w = Math.max(2, Math.ceil(width));
  const h = Math.max(2, Math.ceil(height));
  if (target.canvas.width < w || target.canvas.height < h) {
    target.canvas.width = Math.max(w, target.canvas.width);
    target.canvas.height = Math.max(h, target.canvas.height);
  }
  target.ctx.setTransform(1, 0, 0, 1, 0, 0);
  target.ctx.globalAlpha = 1;
  target.ctx.globalCompositeOperation = 'source-over';
  target.ctx.shadowColor = 'transparent';
  target.ctx.shadowBlur = 0;
  target.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
}

type LaidWord = {
  index: number;
  text: string;
  font: string;
  px: number;
  width: number;
  x: number;
  y: number;
  level: number;
  line: number;
};

type Layout = { key: string; words: LaidWord[]; width: number; height: number; cx: number; cy: number };

type Anim = { alpha: number; sx: number; sy: number; dx: number; dy: number; rot: number; blur: number; chars: number; scramble: number; glitch: number };

const REST: Anim = { alpha: 1, sx: 1, sy: 1, dx: 0, dy: 0, rot: 0, blur: 0, chars: 1, scramble: 0, glitch: 0 };

export class CaptionEngine {
  words: CaptionWord[] = [];
  style: CaptionStyle;
  pages: CaptionPage[] = [];
  levels: number[] = [];
  private duration = 0;
  private offset = 0;
  private layouts = new Map<number, Layout>();
  private styleKey = '';
  private measure: Surface;
  private layer: Surface;
  private compose: Surface;
  private tint: Surface;
  private videoTmp: Surface;

  constructor(style: CaptionStyle) {
    this.style = style;
    this.measure = surface();
    this.layer = surface();
    this.compose = surface();
    this.tint = surface();
    this.videoTmp = surface();
  }

  update(doc: CaptionDoc, duration: number) {
    this.words = doc.words;
    this.style = doc.style;
    this.duration = duration;
    this.offset = doc.offset;
    this.pages = buildPages(doc.words, doc.grouping, doc.offset, duration);
    this.levels = resolveEmphasis(doc.words, doc.style);
    this.styleKey = JSON.stringify(doc.style) + JSON.stringify(doc.grouping);
    this.layouts.clear();
  }

  invalidate() {
    this.layouts.clear();
  }

  private wordWindow(word: CaptionWord) {
    return { start: word.start + this.offset, end: word.end + this.offset };
  }

  private layoutFor(page: CaptionPage, w: number, h: number): Layout {
    const key = `${w}x${h}|${this.styleKey}`;
    const cached = this.layouts.get(page.index);
    if (cached && cached.key === key) return cached;
    const layout = this.buildLayout(page, w, h, key);
    this.layouts.set(page.index, layout);
    return layout;
  }

  private fontFor(level: number, px: number) {
    const s = this.style;
    const key = s.emphasisFont && level >= 2 ? s.fontAlt : s.font;
    const weight = level >= 3 ? Math.min(900, s.weight + 100) : s.weight;
    return fontShorthand(key, weight, s.italic, px);
  }

  private transform(text: string) {
    const mode = this.style.caseMode;
    return mode === 'upper' ? text.toUpperCase() : mode === 'lower' ? text.toLowerCase() : text;
  }

  private buildLayout(page: CaptionPage, w: number, h: number, key: string): Layout {
    const s = this.style;
    const ctx = this.measure.ctx;
    const base = (s.size / 100) * h;
    const limit = Math.max(40, s.maxWidth * w);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${(s.tracking * base).toFixed(2)}px`;
    const space = base * 0.28;
    const items = page.words.map((index) => {
      const word = this.words[index];
      const level = this.levels[index] || 0;
      const levelScale = level > 0 ? s.emphasisScale[Math.min(2, level - 1)] : 1;
      const energyScale = 1 + s.energyScale * (word.energy - 0.5) * 0.7;
      let px = base * levelScale * energyScale;
      const text = this.transform(word.text);
      ctx.font = this.fontFor(level, px);
      let width = ctx.measureText(text).width;
      if (width > limit) {
        px *= limit / width;
        ctx.font = this.fontFor(level, px);
        width = ctx.measureText(text).width;
      }
      return { index, text, px, level, width, font: ctx.font };
    });
    const lines: typeof items[] = [];
    let line: typeof items = [];
    let used = 0;
    for (const item of items) {
      const add = (line.length ? space : 0) + item.width;
      if (line.length && used + add > limit) {
        lines.push(line);
        line = [];
        used = 0;
      }
      used += (line.length ? space : 0) + item.width;
      line.push(item);
    }
    if (line.length) lines.push(line);
    const laid: LaidWord[] = [];
    let y = 0;
    let blockWidth = 0;
    lines.forEach((row, lineIndex) => {
      const lineWidth = row.reduce((sum, item, i) => sum + item.width + (i ? space : 0), 0);
      const lineHeight = Math.max(...row.map((item) => item.px)) * s.lineHeight;
      blockWidth = Math.max(blockWidth, lineWidth);
      let x = -lineWidth / 2;
      row.forEach((item) => {
        laid.push({ index: item.index, text: item.text, font: item.font, px: item.px, width: item.width, x: x + item.width / 2, y: y + lineHeight / 2, level: item.level, line: lineIndex });
        x += item.width + space;
      });
      y += lineHeight;
    });
    const blockHeight = y;
    for (const item of laid) item.y -= blockHeight / 2;

    let cx = s.x * w;
    let cy = s.y * h;
    const pad = base * 0.5;
    if (s.placement === 'scatter') {
      const r1 = hash(s.seed, page.index, 1);
      const r2 = hash(s.seed, page.index, 2);
      cx = blockWidth / 2 + pad + r1 * Math.max(0, w - blockWidth - pad * 2);
      cy = blockHeight / 2 + pad + (0.12 * h) + r2 * Math.max(0, h * 0.76 - blockHeight - pad * 2);
    } else if (s.placement === 'alternate') {
      cy = page.index % 2 === 0 ? s.y * h : (1 - s.y) * h;
    }
    cx = clamp(cx, blockWidth / 2 + pad * 0.3, Math.max(blockWidth / 2 + pad * 0.3, w - blockWidth / 2 - pad * 0.3));
    cy = clamp(cy, blockHeight / 2 + pad * 0.3, Math.max(blockHeight / 2 + pad * 0.3, h - blockHeight / 2 - pad * 0.3));
    return { key, words: laid, width: blockWidth, height: blockHeight, cx, cy };
  }

  private hit(t: number, start: number, ms: number) {
    const dt = t - start;
    if (dt < 0) return 0;
    const decay = Math.max(0.04, ms / 1000 / 2.2);
    return Math.exp(-dt / decay);
  }

  private animIn(kind: AnimIn, p: number, px: number, word: LaidWord, seed: number): Anim {
    const s = this.style;
    const a: Anim = { ...REST };
    if (p >= 1) return a;
    const back = easeOutBack(p, 1.2 * s.overshoot + 0.2);
    switch (kind) {
      case 'fade': a.alpha = p; break;
      case 'pop': a.sx = a.sy = Math.max(0.01, 0.35 + 0.65 * back); a.alpha = clamp(p * 3); break;
      case 'slam': {
        const q = easeOutExpo(p);
        a.sx = a.sy = 1 + (1 - q) * (0.9 + s.overshoot);
        a.alpha = clamp(p * 9);
        a.rot = (hash(seed, 3) - 0.5) * 0.12 * (1 - q);
        break;
      }
      case 'rise': a.dy = (1 - easeOutCubic(p)) * px * 0.55; a.alpha = easeOutCubic(p); break;
      case 'drop': a.dy = -(1 - easeOutBounce(p)) * px * 1.4; a.alpha = clamp(p * 4); break;
      case 'slide': a.dx = -(1 - easeOutCubic(p)) * px * 1.6; a.alpha = easeOutCubic(p); break;
      case 'zoom': a.sx = a.sy = 0.15 + 0.85 * easeOutBack(p, s.overshoot); a.alpha = clamp(p * 2.5); break;
      case 'flip': a.sy = Math.max(0.02, Math.abs(Math.cos((1 - easeOutCubic(p)) * Math.PI / 2))); a.alpha = clamp(p * 3); break;
      case 'typewriter': a.chars = p; break;
      case 'decode': a.scramble = 1 - p; a.alpha = clamp(p * 4 + 0.3); break;
      case 'glitch': a.glitch = 1.1 * (1 - p); a.alpha = hash(seed, Math.floor(p * 9)) > 0.28 ? 1 : 0.2; a.dx = (hash(seed, Math.floor(p * 12), 4) - 0.5) * px * 0.35 * (1 - p); break;
      case 'blur': a.blur = (1 - easeOutCubic(p)) * px * 0.18; a.alpha = easeOutCubic(p); a.dy = (1 - easeOutCubic(p)) * px * 0.18; break;
      default: break;
    }
    return a;
  }

  private colorFor(word: CaptionWord, index: number, level: number) {
    const s = this.style;
    if (word.color) return word.color;
    if (level > 0 && s.emphasisColors[Math.min(2, level - 1)]) return s.emphasisColors[Math.min(2, level - 1)];
    if (s.paletteMode !== 'off' && s.palette.length > 1) {
      const slot = s.paletteMode === 'cycle' ? index : Math.floor(hash(s.seed, index, 9) * s.palette.length);
      return s.palette[slot % s.palette.length];
    }
    return s.fill;
  }

  /** Draw the video frame (with optional punch / shake / chroma) then the captions at time `t`. */
  render(ctx: Ctx, w: number, h: number, t: number, source: CanvasImageSource | null, sourceW = w, sourceH = h) {
    const s = this.style;
    const page = pageAt(this.pages, t);
    const stepT = Math.floor(t * 24) / 24;
    let pulse = 0;
    let burst = 0;
    if (page) {
      for (const index of page.words) {
        const word = this.words[index];
        const level = this.levels[index] || 0;
        const win = this.wordWindow(word);
        const strength = 0.35 + 0.65 * (level / 3);
        pulse = Math.max(pulse, this.hit(t, win.start, 220) * strength);
        burst = Math.max(burst, this.hit(t, win.start, s.glitchMs) * (level > 0 ? 1 : 0.7));
      }
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (source) {
      const zoom = 1 + s.punch * 0.07 * pulse;
      const shakeAmp = s.shake * burst * h * 0.012;
      const sx = shakeAmp ? (hash(stepT * 24, 11) - 0.5) * 2 * shakeAmp : 0;
      const sy = shakeAmp ? (hash(stepT * 24, 12) - 0.5) * 2 * shakeAmp : 0;
      ctx.save();
      ctx.translate(w / 2 + sx, h / 2 + sy);
      ctx.scale(zoom, zoom);
      ctx.translate(-w / 2, -h / 2);
      if (s.chromaVideo > 0 && burst > 0.08) this.drawChroma(ctx, source, w, h, sourceW, sourceH, s.chromaVideo * burst);
      else ctx.drawImage(source, 0, 0, sourceW, sourceH, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
    }
    if (s.dim > 0) {
      ctx.fillStyle = `rgba(0,0,0,${s.dim})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.vignette > 0) {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.58);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, `rgba(0,0,0,${s.vignette * 0.85})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
    if (page) this.drawPage(ctx, page, w, h, t, stepT);
    ctx.restore();
  }

  private drawChroma(ctx: Ctx, source: CanvasImageSource, w: number, h: number, sw: number, sh: number, amount: number) {
    const tmp = this.videoTmp;
    fit(tmp, w, h);
    const offset = Math.max(1, amount * w * 0.012);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    const channels: [string, number][] = [['#ff0000', -offset], ['#00ff00', 0], ['#0000ff', offset]];
    for (const [color, dx] of channels) {
      tmp.ctx.globalCompositeOperation = 'copy';
      tmp.ctx.drawImage(source, 0, 0, sw, sh, 0, 0, w, h);
      tmp.ctx.globalCompositeOperation = 'multiply';
      tmp.ctx.fillStyle = color;
      tmp.ctx.fillRect(0, 0, w, h);
      ctx.drawImage(tmp.canvas, 0, 0, w, h, dx, 0, w, h);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawPage(ctx: Ctx, page: CaptionPage, w: number, h: number, t: number, stepT: number) {
    const s = this.style;
    const layout = this.layoutFor(page, w, h);
    const base = (s.size / 100) * h;
    const pageAge = t - page.show;
    const outMs = Math.min(s.animMs, 260) / 1000;
    const outP = s.animOut === 'none' ? 0 : clamp((t - (page.hide - outMs)) / outMs);
    const pageRot = ((s.rotate + (hash(s.seed, page.index, 5) - 0.5) * 2 * s.tilt) * Math.PI) / 180;

    if (s.box > 0 && s.boxMode === 'page') {
      const pad = s.boxPad * base;
      const alpha = s.box * (1 - outP) * clamp(pageAge / 0.08);
      ctx.save();
      ctx.translate(layout.cx, layout.cy);
      ctx.rotate(pageRot);
      const grow = s.animIn === 'none' ? 1 : 0.88 + 0.12 * easeOutCubic(clamp(pageAge / (s.animMs / 1000)));
      ctx.scale(grow, grow);
      ctx.globalAlpha = clamp(alpha);
      ctx.fillStyle = s.boxColor;
      roundRect(ctx, -layout.width / 2 - pad, -layout.height / 2 - pad * 0.65, layout.width + pad * 2, layout.height + pad * 1.3, s.boxRadius * base);
      ctx.fill();
      ctx.restore();
    }

    for (const [slot, laid] of layout.words.entries()) {
      const word = this.words[laid.index];
      const win = this.wordWindow(word);
      const progressive = s.reveal === 'progressive';
      const appear = progressive ? win.start : page.show;
      if (t < appear) continue;
      const delay = progressive ? 0 : slot * s.stagger * 0.001;
      const ms = Math.max(1, s.animMs) / 1000;
      const p = clamp((t - appear - delay) / ms);
      if (t - appear < delay) continue;
      const seed = s.seed * 31 + laid.index;
      const anim = this.animIn(s.animIn, p, laid.px, laid, seed);
      const out = this.animOut(s.animOut, outP, laid.px, seed);
      const isActive = t >= win.start && t < win.end;
      const isPast = t >= win.end;
      const isFuture = t < win.start;
      let alpha = anim.alpha * out.alpha;
      if (isPast) alpha *= s.pastOpacity;
      if (isFuture) alpha *= s.futureOpacity;
      if (alpha <= 0.003) continue;

      const level = laid.level;
      const hit = this.hit(t, win.start, s.glitchMs);
      let g = 0;
      if (s.glitch > 0) {
        if (s.glitchTrigger === 'always') g = s.glitch * (0.4 + 0.6 * hit);
        else if (s.glitchTrigger === 'onset') g = s.glitch * hit;
        else g = s.glitch * hit * (level > 0 ? 0.45 + level * 0.3 : 0.05);
        g *= 1 + s.emphasisGlitch * level;
      }
      g = Math.max(g, anim.glitch, out.glitch);
      if (isFuture && !progressive) g *= 0.3;

      const activeP = isActive ? easeOutCubic(clamp((t - win.start) / 0.09)) : 0;
      const activeScale = s.active !== 'none' && isActive ? 1 + (s.activeScale - 1) * activeP : 1;
      const stepJitter = s.jitter > 0 ? s.jitter * laid.px * 0.04 : 0;
      const jx = stepJitter ? (hash(seed, stepT * 24, 1) - 0.5) * 2 * stepJitter * (0.35 + g) : 0;
      const jy = stepJitter ? (hash(seed, stepT * 24, 2) - 0.5) * 2 * stepJitter * 0.5 * (0.35 + g) : 0;
      const wob = s.wordJitter > 0 ? (hash(seed, stepT * 8, 6) - 0.5) * laid.px * 0.05 * s.wordJitter : 0;
      const rot = ((hash(s.seed, laid.index, 7) - 0.5) * 2 * s.wordRotate * Math.PI) / 180 + anim.rot + out.rot;

      const color = this.colorFor(word, laid.index, level);
      let text = laid.text;
      if (anim.chars < 1) text = text.slice(0, Math.max(0, Math.ceil([...text].length * anim.chars)));
      let scrambleAmount = anim.scramble;
      if (s.scramble > 0) scrambleAmount = Math.max(scrambleAmount, s.scramble * clamp(g) * 0.8);
      if (scrambleAmount > 0.01) text = scrambleText(text, scrambleAmount, seed, stepT);

      const px = laid.px * anim.sx * out.scale * activeScale;
      const x = layout.cx + laid.x * Math.cos(pageRot) - laid.y * Math.sin(pageRot) + anim.dx + out.dx + jx + wob;
      const y = layout.cy + laid.x * Math.sin(pageRot) + laid.y * Math.cos(pageRot) + anim.dy + out.dy + jy;
      const sweep = s.active === 'sweep' ? clamp((t - win.start) / Math.max(0.05, win.end - win.start)) : 0;
      const spec: WordSpec = {
        text, px, font: this.fontFor(level, px), color, active: isActive, past: isPast,
        sweep: s.active === 'sweep' ? (isPast ? 1 : isActive ? sweep : 0) : -1, boxed: s.active === 'box' && isActive, underlined: s.active === 'underline' && (isActive || isPast),
        wordBox: s.box > 0 && s.boxMode === 'word', alpha: clamp(alpha), ySquash: anim.sy / Math.max(0.01, anim.sx),
      };
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pageRot + rot);
      if (s.skew) ctx.transform(1, 0, Math.tan((s.skew * Math.PI) / 180), 1, 0, 0);
      if (anim.blur > 0.1) ctx.filter = `blur(${anim.blur.toFixed(1)}px)`;
      const flick = s.flicker > 0 && hash(seed, stepT * 24, 8) < s.flicker * (0.12 + 0.5 * clamp(g));
      if (flick) spec.alpha *= 0.35;
      if (g > 0.02 || s.scanlines > 0) this.paintLayered(ctx, spec, clamp(g, 0, 1.4), seed, stepT, s.scanlines);
      else this.paintDirect(ctx, spec);
      ctx.restore();
    }
  }

  private animOut(kind: CaptionStyle['animOut'], q: number, px: number, seed: number) {
    const o = { alpha: 1, scale: 1, dx: 0, dy: 0, rot: 0, glitch: 0 };
    if (q <= 0 || kind === 'none') return o;
    switch (kind) {
      case 'fade': o.alpha = 1 - q; break;
      case 'shrink': o.scale = 1 - 0.45 * q * q; o.alpha = 1 - q * q; break;
      case 'glitch': o.glitch = 1.2 * q; o.alpha = hash(seed, Math.floor(q * 10), 3) > q * 0.7 ? 1 : 0.15; o.dx = (hash(seed, Math.floor(q * 12), 5) - 0.5) * px * 0.4 * q; break;
      case 'drop': o.dy = q * q * px * 2.2; o.alpha = 1 - q * q; o.rot = q * 0.15; break;
      default: break;
    }
    return o;
  }

  private paintDirect(ctx: Ctx, spec: WordSpec) {
    ctx.globalAlpha = spec.alpha;
    if (spec.ySquash !== 1) ctx.scale(1, spec.ySquash);
    paintWord(ctx, spec, this.style, 0, 0);
  }

  private paintLayered(ctx: Ctx, spec: WordSpec, g: number, seed: number, stepT: number, scan: number) {
    const s = this.style;
    const measure = this.measure.ctx;
    measure.font = spec.font;
    if ('letterSpacing' in measure) (measure as Ctx & { letterSpacing: string }).letterSpacing = `${(s.tracking * spec.px).toFixed(2)}px`;
    const width = measure.measureText(spec.text || ' ').width;
    const pad = Math.ceil(spec.px * (0.55 + s.glow * 0.5 + s.strokeWidth * 0.1) + Math.abs(s.shadowY) * spec.px * 0.01 + (s.rgbSplit * spec.px * 0.12 * g));
    const lw = Math.ceil(width + pad * 2 + spec.px * 0.4);
    const lh = Math.ceil(spec.px * 1.5 + pad * 2);
    const layer = this.layer;
    fit(layer, lw, lh);
    layer.ctx.save();
    paintWord(layer.ctx, { ...spec, alpha: 1 }, s, lw / 2, lh / 2);
    layer.ctx.restore();

    const comp = this.compose;
    fit(comp, lw, lh);
    const cctx = comp.ctx;
    cctx.imageSmoothingEnabled = false;
    const bandCount = Math.max(0, Math.round(s.slices * g * 1.6));
    if (bandCount > 0 && g > 0.05) {
      const cuts: number[] = [0];
      for (let i = 0; i < bandCount * 2; i += 1) cuts.push(Math.floor(hash(seed, stepT * 24, 20 + i) * lh));
      cuts.push(lh);
      cuts.sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i += 1) {
        const y0 = cuts[i];
        const bh = cuts[i + 1] - y0;
        if (bh <= 0) continue;
        const shift = i % 2 === 1 ? (hash(seed, stepT * 24, 60 + i) - 0.5) * 2 * g * spec.px * 0.55 : 0;
        cctx.drawImage(layer.canvas, 0, y0, lw, bh, shift, y0, lw, bh);
      }
    } else {
      cctx.drawImage(layer.canvas, 0, 0, lw, lh, 0, 0, lw, lh);
    }
    if (scan > 0) {
      cctx.globalCompositeOperation = 'destination-out';
      cctx.fillStyle = `rgba(0,0,0,${0.55 * scan})`;
      const step = Math.max(2, Math.round(spec.px / 38));
      const roll = Math.floor(stepT * 24) % (step * 2);
      for (let y = roll; y < lh; y += step * 2) cctx.fillRect(0, y, lw, step);
      cctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = spec.alpha;
    if (spec.ySquash !== 1) ctx.scale(1, spec.ySquash);
    const split = s.rgbSplit * g * spec.px * 0.07;
    const sx = -lw / 2;
    const sy = -lh / 2;
    if (split > 0.6) {
      const tint = this.tint;
      fit(tint, lw, lh);
      tint.ctx.drawImage(comp.canvas, 0, 0, lw, lh, 0, 0, lw, lh);
      tint.ctx.globalCompositeOperation = 'source-in';
      tint.ctx.fillStyle = '#000';
      tint.ctx.fillRect(0, 0, lw, lh);
      ctx.globalAlpha = spec.alpha * 0.8;
      for (const dx of [-split, 0, split]) ctx.drawImage(tint.canvas, 0, 0, lw, lh, sx + dx * 0.6, sy, lw, lh);
      ctx.globalCompositeOperation = 'lighter';
      const channels: [string, number][] = [['#ff0000', -split], ['#00ff00', 0.2 * split], ['#0000ff', split]];
      for (const [color, dx] of channels) {
        fit(tint, lw, lh);
        tint.ctx.drawImage(comp.canvas, 0, 0, lw, lh, 0, 0, lw, lh);
        tint.ctx.globalCompositeOperation = 'multiply';
        tint.ctx.fillStyle = color;
        tint.ctx.fillRect(0, 0, lw, lh);
        tint.ctx.globalCompositeOperation = 'destination-in';
        tint.ctx.drawImage(comp.canvas, 0, 0, lw, lh, 0, 0, lw, lh);
        ctx.globalAlpha = spec.alpha;
        ctx.drawImage(tint.canvas, 0, 0, lw, lh, sx + dx, sy + (color === '#0000ff' ? split * 0.15 : 0), lw, lh);
      }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.drawImage(comp.canvas, 0, 0, lw, lh, sx, sy, lw, lh);
    }
    ctx.globalAlpha = 1;
  }
}

type WordSpec = {
  text: string; px: number; font: string; color: string; active: boolean; past: boolean; sweep: number; boxed: boolean; underlined: boolean;
  wordBox: boolean; alpha: number; ySquash: number;
};

function scrambleText(text: string, amount: number, seed: number, stepT: number) {
  const chars = [...text];
  return chars
    .map((char, i) => {
      if (/\s/.test(char)) return char;
      const resolved = (i + 1) / (chars.length + 1) < 1 - amount;
      if (resolved && hash(seed, i, stepT * 24) > amount * 0.5) return char;
      return GLYPHS[Math.floor(hash(seed, i, stepT * 24, 3) * GLYPHS.length)];
    })
    .join('');
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function paintWord(ctx: Ctx, spec: WordSpec, s: CaptionStyle, ox: number, oy: number) {
  const { text, px } = spec;
  if (!text) return;
  ctx.save();
  ctx.translate(ox, oy);
  ctx.font = spec.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${(s.tracking * px).toFixed(2)}px`;
  const width = ctx.measureText(text).width;
  const lift = px * 0.04;

  if (spec.wordBox || spec.boxed) {
    const pad = s.boxPad * px * 0.7;
    ctx.fillStyle = spec.boxed ? s.activeColor : s.boxColor;
    ctx.globalAlpha = spec.boxed ? 1 : s.box;
    roundRect(ctx, -width / 2 - pad, -px * 0.62, width + pad * 2, px * 1.2, s.boxRadius * px);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  const fillColor = spec.active && (s.active === 'color') ? s.activeColor : spec.boxed ? contrast(s.activeColor) : spec.color;
  let fillStyle: string | CanvasGradient = fillColor;
  if (s.gradient && fillColor === s.fill) {
    const angle = (s.gradientAngle * Math.PI) / 180;
    const dx = Math.cos(angle) * px * 0.55;
    const dy = Math.sin(angle) * px * 0.55;
    const gradient = ctx.createLinearGradient(-dx, -dy, dx, dy);
    gradient.addColorStop(0, s.fill);
    gradient.addColorStop(0.5, s.fill2);
    gradient.addColorStop(1, s.fill);
    fillStyle = gradient;
  }

  if (s.glow > 0) {
    ctx.save();
    ctx.shadowColor = s.glowColor;
    ctx.shadowBlur = s.glow * px * 0.55;
    ctx.fillStyle = s.glowColor;
    ctx.fillText(text, 0, lift);
    ctx.fillText(text, 0, lift);
    ctx.restore();
  }
  if (s.shadowBlur > 0 || s.shadowX || s.shadowY) {
    ctx.save();
    ctx.shadowColor = s.shadow;
    ctx.shadowBlur = (s.shadowBlur / 100) * px;
    ctx.shadowOffsetX = (s.shadowX / 100) * px;
    ctx.shadowOffsetY = (s.shadowY / 100) * px;
    ctx.fillStyle = s.shadow;
    ctx.strokeStyle = s.shadow;
    ctx.lineWidth = s.strokeWidth * px * 0.07 * 2;
    if (s.strokeWidth > 0) ctx.strokeText(text, 0, lift);
    ctx.fillText(text, 0, lift);
    ctx.restore();
  }
  if (s.strokeWidth > 0) {
    ctx.strokeStyle = s.stroke;
    ctx.lineWidth = s.strokeWidth * px * 0.07 * 2;
    ctx.strokeText(text, 0, lift);
  }
  ctx.fillStyle = fillStyle;
  ctx.fillText(text, 0, lift);
  if (spec.sweep > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(-width / 2 - px * 0.2, -px, (width + px * 0.4) * spec.sweep, px * 2);
    ctx.clip();
    ctx.fillStyle = s.activeColor;
    ctx.fillText(text, 0, lift);
    ctx.restore();
  }
  if (spec.underlined) {
    ctx.fillStyle = s.activeColor;
    const thick = Math.max(2, px * 0.07);
    ctx.fillRect(-width / 2, px * 0.5, width, thick);
  }
  ctx.restore();
}

function contrast(color: string) {
  const m = color.replace('#', '');
  if (m.length < 6) return '#000';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#0a0a0a' : '#ffffff';
}
