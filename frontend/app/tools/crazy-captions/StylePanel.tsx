'use client';

import { useEffect, useRef } from 'react';
import { Dices, Plus, X } from 'lucide-react';
import { FONTS, ensureFonts, fontInfo } from '@/lib/captions/registry';
import { CaptionEngine } from '@/lib/captions/render';
import { FX_ON, FX_READABLE, PRESETS, applyFx, fxIsReadable, presetStyle, type FxFlags } from '@/lib/captions/styles';
import type { CaptionStyle, Grouping } from '@/lib/captions/types';
import { makeWord } from '@/lib/captions/words';
import { ColorField, Section, Segments, Select, Slider, Toggle } from './controls';
import styles from './crazy-captions.module.css';

const pct = (value: number) => `${Math.round(value * 100)}%`;
const x = (value: number) => `${value.toFixed(2)}×`;

function sampleBackground(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, width, height);
  sky.addColorStop(0, '#26335f');
  sky.addColorStop(0.55, '#a35a78');
  sky.addColorStop(1, '#1a1430');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,214,150,0.55)';
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.3, height * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#120f22';
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let i = 0; i <= 8; i += 1) ctx.lineTo((width / 8) * i, height * (0.74 + 0.12 * Math.sin(i * 1.7)));
  ctx.lineTo(width, height);
  ctx.fill();
  return canvas;
}

function PresetThumb({ id, ready, fx }: { id: string; ready: boolean; fx: FxFlags }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !ready) return;
    const w = 240;
    const h = 135;
    el.width = w;
    el.height = h;
    const style = applyFx(presetStyle(id), fx);
    const words = [makeWord('MAKE', 0, 0.35, 0.4), makeWord('IT', 0.35, 0.6, 0.3), makeWord('LOUD!', 0.6, 1.2, 1)];
    words[2].emphasis = 2;
    const engine = new CaptionEngine({ ...style, y: Math.min(0.78, Math.max(0.42, style.y)), x: Math.min(0.7, Math.max(0.3, style.x)), animMs: Math.min(style.animMs, 120) });
    engine.update({ words, style: engine.style, grouping: { mode: 'phrase', wordsPerPage: 3, maxChars: 40, pauseBreak: 2, respectPunctuation: false }, offset: 0 }, 2);
    engine.render(el.getContext('2d')!, w, h, 0.76, sampleBackground(w, h));
  }, [id, ready, fx]);
  return <canvas ref={ref} aria-hidden />;
}

export function StylePanel({ style, grouping, chaos, fx, ready, activePreset, onStyle, onGrouping, onChaos, onFx, onFxAll, onPreset }: {
  style: CaptionStyle;
  grouping: Grouping;
  chaos: number;
  fx: FxFlags;
  ready: boolean;
  activePreset: string;
  onStyle: (patch: Partial<CaptionStyle>) => void;
  onGrouping: (patch: Partial<Grouping>) => void;
  onChaos: (value: number) => void;
  onFx: (patch: Partial<FxFlags>) => void;
  onFxAll: (value: FxFlags) => void;
  onPreset: (id: string) => void;
}) {
  const info = fontInfo(style.font);
  const set = <K extends keyof CaptionStyle>(key: K) => (value: CaptionStyle[K]) => onStyle({ [key]: value } as Partial<CaptionStyle>);
  const tuple = (key: 'emphasisScale' | 'emphasisColors', index: number, value: number | string) => {
    const next = [...style[key]] as (number | string)[];
    next[index] = value;
    onStyle({ [key]: next } as Partial<CaptionStyle>);
  };

  const randomize = () => {
    const pick = <T,>(items: readonly T[]) => items[Math.floor(Math.random() * items.length)];
    const base = presetStyle(pick(PRESETS).id);
    const hue = Math.floor(Math.random() * 360);
    void ensureFonts([base.font, base.fontAlt]).then(() => onStyle({
      ...base, name: 'Remix', seed: Math.floor(Math.random() * 9999), activeColor: hslToHex(hue, 95, 60), glowColor: hslToHex((hue + 40) % 360, 90, 60),
      glitch: Math.random() < 0.7 ? 0.3 + Math.random() * 0.7 : 0,
    }));
  };

  const readable = fxIsReadable(fx);
  const effects: { key: keyof FxFlags; label: string; note: string }[] = [
    { key: 'glitch', label: 'Glitch', note: 'RGB split, tears, scramble' },
    { key: 'camera', label: 'Camera', note: 'shake, zoom, video RGB' },
    { key: 'wobble', label: 'Tilt', note: 'rotation, skew, wobble' },
    { key: 'scatter', label: 'Scatter', note: 'random positions' },
  ];

  return <div className={styles.stylePanel}>
    <div className={styles.fxBox} data-testid="cc-readability">
      <div className={styles.fxHead}>
        <b>Effects</b>
        <button type="button" className={styles.miniButton} aria-pressed={readable && fx.legible} data-testid="cc-readable" onClick={() => onFxAll(readable && fx.legible ? FX_ON : FX_READABLE)}>{readable && fx.legible ? 'Restore effects' : 'Make readable'}</button>
      </div>
      <div className={styles.fxGrid}>
        {effects.map((item) => <button key={item.key} type="button" aria-pressed={fx[item.key] as boolean} data-testid={`cc-fx-${item.key}`} onClick={() => onFx({ [item.key]: !fx[item.key] })}>
          <i aria-hidden />
          <span><b>{item.label}</b><small>{item.note}</small></span>
        </button>)}
      </div>
      <Toggle label="Legibility boost: outline, shadow, brighter upcoming words, capped sizes" checked={fx.legible} onChange={(value) => onFx({ legible: value })} />
    </div>

    <div className={styles.presetGrid} role="listbox" aria-label="Caption style presets">
      {PRESETS.map((preset) => <button key={preset.id} type="button" role="option" aria-selected={preset.id === activePreset} className={styles.preset} data-testid={`cc-preset-${preset.id}`} onClick={() => onPreset(preset.id)}>
        <PresetThumb id={preset.id} ready={ready} fx={fx} />
        <b>{preset.label}</b>
        <small>{preset.blurb}</small>
      </button>)}
    </div>

    <div className={styles.chaos}>
      <Slider label="Chaos" value={chaos} min={0} max={2} step={0.05} onChange={onChaos} format={(value) => (value < 0.05 ? 'off' : `${value.toFixed(2)}×`)} />
      <button type="button" className={styles.miniButton} onClick={randomize} title="Remix: random preset with a fresh accent colour"><Dices size={13} /> Remix</button>
      <button type="button" className={styles.miniButton} onClick={() => onStyle({ seed: Math.floor(Math.random() * 9999) })} title="New random seed for tilt, scatter and colour order">Reseed</button>
    </div>

    <Section title="TYPE" open>
      <Select label="Font" value={style.font} options={FONTS.map((font) => ({ value: font.key, label: `${font.label} · ${font.note}` }))} onChange={(value) => { void ensureFonts([value]).then(() => onStyle({ font: value, weight: fontInfo(value).weights.includes(style.weight) ? style.weight : fontInfo(value).weights[fontInfo(value).weights.length - 1] })); }} />
      {info.weights.length > 1 && <Slider label="Weight" value={style.weight} min={info.weights[0]} max={info.weights[info.weights.length - 1]} step={100} onChange={set('weight')} />}
      <Slider label="Size" value={style.size} min={2} max={22} step={0.1} onChange={set('size')} format={(value) => `${value.toFixed(1)}% of height`} />
      <Segments label="Case" value={style.caseMode} options={[{ value: 'upper', label: 'UPPER' }, { value: 'none', label: 'Normal' }, { value: 'lower', label: 'lower' }]} onChange={set('caseMode')} />
      <Slider label="Tracking" value={style.tracking} min={-0.08} max={0.4} onChange={set('tracking')} />
      <Slider label="Line height" value={style.lineHeight} min={0.7} max={1.6} onChange={set('lineHeight')} />
      <Slider label="Skew" value={style.skew} min={-25} max={25} step={1} onChange={set('skew')} format={(value) => `${value}°`} />
      {info.italic && <Toggle label="Italic" checked={style.italic} onChange={set('italic')} />}
    </Section>

    <Section title="GROUPING" hint="how many words show together">
      <Segments value={grouping.mode} options={[{ value: 'word', label: 'One word' }, { value: 'words', label: 'Few words' }, { value: 'phrase', label: 'Phrases' }]} onChange={(mode) => onGrouping({ mode })} />
      {grouping.mode === 'words' && <Slider label="Words per caption" value={grouping.wordsPerPage} min={2} max={8} step={1} onChange={(value) => onGrouping({ wordsPerPage: value })} />}
      {grouping.mode !== 'word' && <Slider label="Max characters" value={grouping.maxChars} min={8} max={80} step={1} onChange={(value) => onGrouping({ maxChars: value })} />}
      <Slider label="Break on pause" value={grouping.pauseBreak} min={0.15} max={2} onChange={(value) => onGrouping({ pauseBreak: value })} format={(value) => `${value.toFixed(2)} s`} />
      <Toggle label="Break at sentence ends" checked={grouping.respectPunctuation} onChange={(value) => onGrouping({ respectPunctuation: value })} />
      <Segments label="Reveal" value={style.reveal} options={[{ value: 'all', label: 'Whole caption' }, { value: 'progressive', label: 'Word by word' }]} onChange={set('reveal')} />
    </Section>

    <Section title="LAYOUT">
      <Segments label="Placement" value={style.placement} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'alternate', label: 'Flip' }, { value: 'scatter', label: 'Scatter' }]} onChange={set('placement')} />
      {style.placement !== 'scatter' && <Slider label="Horizontal" value={style.x} min={0.1} max={0.9} onChange={set('x')} format={pct} />}
      {style.placement !== 'scatter' && <Slider label="Vertical" value={style.y} min={0.08} max={0.94} onChange={set('y')} format={pct} />}
      <Slider label="Max width" value={style.maxWidth} min={0.3} max={0.98} onChange={set('maxWidth')} format={pct} />
      <Slider label="Base rotation" value={style.rotate} min={-30} max={30} step={0.5} onChange={set('rotate')} format={(value) => `${value}°`} />
      <Slider label="Random tilt per caption" value={style.tilt} min={0} max={20} step={0.5} onChange={set('tilt')} format={(value) => `±${value}°`} />
    </Section>

    <Section title="COLOUR">
      <ColorField label="Text" value={style.fill} onChange={set('fill')} />
      <Toggle label="Gradient fill" checked={style.gradient} onChange={set('gradient')} />
      {style.gradient && <>
        <ColorField label="Gradient middle" value={style.fill2} onChange={set('fill2')} />
        <Slider label="Gradient angle" value={style.gradientAngle} min={0} max={360} step={5} onChange={set('gradientAngle')} format={(value) => `${value}°`} />
      </>}
      <Segments label="Active word" value={style.active} options={[{ value: 'none', label: 'None' }, { value: 'color', label: 'Colour' }, { value: 'sweep', label: 'Sweep' }, { value: 'box', label: 'Box' }, { value: 'underline', label: 'Line' }]} onChange={set('active')} />
      {style.active !== 'none' && <ColorField label="Active colour" value={style.activeColor} onChange={set('activeColor')} />}
      {style.active !== 'none' && <Slider label="Active pop" value={style.activeScale} min={1} max={1.6} onChange={set('activeScale')} format={x} />}
      <Slider label="Spoken words" value={style.pastOpacity} min={0.1} max={1} onChange={set('pastOpacity')} format={pct} />
      <Slider label="Upcoming words" value={style.futureOpacity} min={0} max={1} onChange={set('futureOpacity')} format={pct} />
      <Segments label="Palette" value={style.paletteMode} options={[{ value: 'off', label: 'Single' }, { value: 'cycle', label: 'Cycle' }, { value: 'random', label: 'Random' }]} onChange={set('paletteMode')} />
      {style.paletteMode !== 'off' && <div className={styles.palette}>
        {style.palette.map((color, index) => <span key={index}>
          <input type="color" aria-label={`Palette colour ${index + 1}`} value={color} onChange={(event) => onStyle({ palette: style.palette.map((item, i) => (i === index ? event.target.value : item)) })} />
          {style.palette.length > 2 && <button type="button" aria-label="Remove colour" onClick={() => onStyle({ palette: style.palette.filter((_, i) => i !== index) })}><X size={10} /></button>}
        </span>)}
        {style.palette.length < 8 && <button type="button" className={styles.miniButton} aria-label="Add colour" onClick={() => onStyle({ palette: [...style.palette, '#ff3d6e'] })}><Plus size={12} /></button>}
      </div>}
    </Section>

    <Section title="OUTLINE, SHADOW, GLOW, BOX">
      <Slider label="Outline" value={style.strokeWidth} min={0} max={3} onChange={set('strokeWidth')} />
      {style.strokeWidth > 0 && <ColorField label="Outline colour" value={style.stroke} onChange={set('stroke')} />}
      <Slider label="Shadow blur" value={style.shadowBlur} min={0} max={60} step={1} onChange={set('shadowBlur')} />
      <Slider label="Shadow X" value={style.shadowX} min={-20} max={20} step={0.5} onChange={set('shadowX')} />
      <Slider label="Shadow Y" value={style.shadowY} min={-20} max={30} step={0.5} onChange={set('shadowY')} />
      <ColorField label="Shadow colour" value={style.shadow} onChange={set('shadow')} />
      <Slider label="Glow" value={style.glow} min={0} max={1.5} onChange={set('glow')} />
      {style.glow > 0 && <ColorField label="Glow colour" value={style.glowColor} onChange={set('glowColor')} />}
      <Slider label="Background box" value={style.box} min={0} max={1} onChange={set('box')} format={pct} />
      {style.box > 0 && <>
        <ColorField label="Box colour" value={style.boxColor} onChange={set('boxColor')} />
        <Segments label="Box covers" value={style.boxMode} options={[{ value: 'page', label: 'Whole caption' }, { value: 'word', label: 'Each word' }]} onChange={set('boxMode')} />
        <Slider label="Box radius" value={style.boxRadius} min={0} max={0.6} onChange={set('boxRadius')} />
        <Slider label="Box padding" value={style.boxPad} min={0.05} max={0.8} onChange={set('boxPad')} />
      </>}
    </Section>

    <Section title="MOTION">
      <Select label="Enter" value={style.animIn} options={[
        { value: 'none', label: 'Cut' }, { value: 'fade', label: 'Fade' }, { value: 'pop', label: 'Pop' }, { value: 'slam', label: 'Slam' }, { value: 'rise', label: 'Rise' },
        { value: 'drop', label: 'Drop and bounce' }, { value: 'slide', label: 'Slide' }, { value: 'zoom', label: 'Zoom' }, { value: 'flip', label: 'Flip' },
        { value: 'typewriter', label: 'Typewriter' }, { value: 'decode', label: 'Decode' }, { value: 'glitch', label: 'Glitch in' }, { value: 'blur', label: 'Blur focus' },
      ]} onChange={set('animIn')} />
      <Select label="Exit" value={style.animOut} options={[{ value: 'none', label: 'Cut' }, { value: 'fade', label: 'Fade' }, { value: 'shrink', label: 'Shrink' }, { value: 'glitch', label: 'Glitch out' }, { value: 'drop', label: 'Fall' }]} onChange={set('animOut')} />
      <Slider label="Duration" value={style.animMs} min={40} max={900} step={10} onChange={set('animMs')} format={(value) => `${value} ms`} />
      <Slider label="Overshoot" value={style.overshoot} min={0} max={1.5} onChange={set('overshoot')} />
      {style.reveal === 'all' && <Slider label="Word stagger" value={style.stagger} min={0} max={250} step={5} onChange={set('stagger')} format={(value) => `${value} ms`} />}
      <Slider label="Video punch-in" value={style.punch} min={0} max={1.5} onChange={set('punch')} />
      <Slider label="Screen shake" value={style.shake} min={0} max={1.5} onChange={set('shake')} />
    </Section>

    <Section title="GLITCH" hint={fx.glitch ? 'hi-fi disruption' : 'switched off in Effects'}>
      <Slider label="Intensity" value={style.glitch} min={0} max={1.5} onChange={set('glitch')} />
      <Segments label="Triggered" value={style.glitchTrigger} options={[{ value: 'onset', label: 'Each word' }, { value: 'emphasis', label: 'Emphasis' }, { value: 'always', label: 'Always' }]} onChange={set('glitchTrigger')} />
      <Slider label="Burst length" value={style.glitchMs} min={60} max={900} step={10} onChange={set('glitchMs')} format={(value) => `${value} ms`} />
      <Slider label="RGB split" value={style.rgbSplit} min={0} max={1.6} onChange={set('rgbSplit')} />
      <Slider label="Slice tears" value={style.slices} min={0} max={12} step={1} onChange={set('slices')} />
      <Slider label="Jitter" value={style.jitter} min={0} max={1.6} onChange={set('jitter')} />
      <Slider label="Scanlines" value={style.scanlines} min={0} max={1} onChange={set('scanlines')} />
      <Slider label="Flicker" value={style.flicker} min={0} max={1} onChange={set('flicker')} />
      <Slider label="Scramble glyphs" value={style.scramble} min={0} max={1} onChange={set('scramble')} />
      <Slider label="Video RGB split" value={style.chromaVideo} min={0} max={1.2} onChange={set('chromaVideo')} />
    </Section>

    <Section title="INTENSITY" hint="size, colour and font follow the voice">
      <Slider label="Loudness to size" value={style.energyScale} min={0} max={1.6} onChange={set('energyScale')} />
      <Slider label="Auto emphasis" value={style.autoEmphasis} min={0} max={1} onChange={set('autoEmphasis')} format={pct} />
      {[0, 1, 2].map((index) => <div key={index} className={styles.levelRow}>
        <b>Level {index + 1}</b>
        <input type="range" min="1" max="3.2" step="0.02" value={style.emphasisScale[index]} aria-label={`Level ${index + 1} size`} onChange={(event) => tuple('emphasisScale', index, Number(event.target.value))} />
        <output>{style.emphasisScale[index].toFixed(2)}×</output>
        <ColorField label="" value={style.emphasisColors[index]} onChange={(value) => tuple('emphasisColors', index, value)} clearable />
      </div>)}
      <Toggle label="Strong levels use the second font" checked={style.emphasisFont} onChange={set('emphasisFont')} />
      {style.emphasisFont && <Select label="Second font" value={style.fontAlt} options={FONTS.map((font) => ({ value: font.key, label: font.label }))} onChange={(value) => { void ensureFonts([value]).then(() => onStyle({ fontAlt: value })); }} />}
      <Slider label="Extra glitch per level" value={style.emphasisGlitch} min={0} max={1.5} onChange={set('emphasisGlitch')} />
      <Slider label="Random word tilt" value={style.wordRotate} min={0} max={20} step={0.5} onChange={set('wordRotate')} format={(value) => `±${value}°`} />
      <Slider label="Word wobble" value={style.wordJitter} min={0} max={2} onChange={set('wordJitter')} />
    </Section>

    <Section title="FRAME">
      <Slider label="Dim video" value={style.dim} min={0} max={0.8} onChange={set('dim')} format={pct} />
      <Slider label="Vignette" value={style.vignette} min={0} max={1} onChange={set('vignette')} format={pct} />
    </Section>
  </div>;
}

function hslToHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
