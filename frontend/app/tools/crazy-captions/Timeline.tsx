'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { CaptionWord } from '@/lib/captions/types';
import { ENV_HOP } from '@/lib/captions/dsp';
import { moveEdge, shiftWord } from '@/lib/captions/words';
import styles from './crazy-captions.module.css';

type Drag = { index: number; mode: 'start' | 'end' | 'move'; originX: number; original: CaptionWord[]; origin: number } | null;

const HEIGHT = 132;
const WAVE = 70;

export function Timeline({ duration, env, words, selected, time, playing, levels, onSeek, onSelect, onChange }: {
  duration: number;
  env: Float32Array;
  words: CaptionWord[];
  selected: number;
  time: number;
  playing: boolean;
  levels: number[];
  onSeek: (t: number) => void;
  onSelect: (index: number) => void;
  onChange: (words: CaptionWord[]) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Drag>(null);
  const [pps, setPps] = useState(90);
  const [viewWidth, setViewWidth] = useState(600);
  const width = Math.max(viewWidth, Math.ceil(duration * pps) + 24);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return undefined;
    const observer = new ResizeObserver(() => setViewWidth(el.clientWidth));
    observer.observe(el);
    setViewWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el || duration <= 0) return;
    setPps((current) => (current === 90 ? Math.max(30, Math.min(220, (el.clientWidth - 24) / Math.max(4, Math.min(duration, 12)))) : current));
  }, [duration]);

  const draw = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    el.width = Math.floor(width * ratio);
    el.height = Math.floor(HEIGHT * ratio);
    const ctx = el.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, HEIGHT);
    ctx.fillStyle = '#0d0e15';
    ctx.fillRect(0, 0, width, HEIGHT);

    const tick = pps >= 120 ? 0.5 : pps >= 50 ? 1 : pps >= 22 ? 5 : 10;
    ctx.font = '10px ui-monospace, monospace';
    ctx.textBaseline = 'top';
    for (let t = 0; t <= duration; t += tick) {
      const x = Math.round(t * pps) + 0.5;
      ctx.fillStyle = '#2a2840';
      ctx.fillRect(x, 0, 1, 12);
      if (Math.round(t / tick) % (tick < 1 ? 2 : 1) === 0) {
        ctx.fillStyle = '#6f6a8c';
        const m = Math.floor(t / 60);
        ctx.fillText(`${m}:${String(Math.floor(t % 60)).padStart(2, '0')}`, x + 3, 1);
      }
    }

    const mid = 18 + WAVE / 2;
    if (env.length) {
      ctx.fillStyle = '#3a3558';
      const perPixel = Math.max(1, Math.floor(env.length / Math.max(1, duration * pps)));
      for (let x = 0; x < duration * pps; x += 1) {
        const from = Math.floor((x / pps) / ENV_HOP);
        let peak = 0;
        for (let i = from; i < Math.min(env.length, from + perPixel); i += 1) peak = Math.max(peak, env[i]);
        const h = Math.min(WAVE / 2, Math.sqrt(peak) * WAVE * 0.62);
        ctx.fillRect(x, mid - h, 1, Math.max(1, h * 2));
      }
    }

    words.forEach((word, i) => {
      const x = word.start * pps;
      const w = Math.max(3, (word.end - word.start) * pps);
      const level = levels[i] || 0;
      const isSelected = i === selected;
      const y = 18 + WAVE + 6 + (i % 2) * 0;
      ctx.fillStyle = word.hidden ? '#2b2b36' : isSelected ? '#8f7bff' : level >= 3 ? '#c93a73' : level === 2 ? '#a8602f' : level === 1 ? '#6b5ba8' : '#463f73';
      ctx.fillRect(x, y, w - 1, 34);
      ctx.fillStyle = isSelected ? '#fff' : '#d8d4f0';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      if (w > 14) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 2, y, w - 5, 34);
        ctx.clip();
        ctx.fillText(word.text, x + 4, y + 17);
        ctx.restore();
      }
      if (word.breakBefore) {
        ctx.fillStyle = '#ffd400';
        ctx.fillRect(x, 18, 2, WAVE + 22);
      }
      if (isSelected) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y, 3, 34);
        ctx.fillRect(x + w - 4, y, 3, 34);
      }
    });

    const px = time * pps;
    ctx.fillStyle = '#ff4f7b';
    ctx.fillRect(px - 0.5, 0, 1.5, HEIGHT);
    ctx.beginPath();
    ctx.moveTo(px - 5, 0);
    ctx.lineTo(px + 5, 0);
    ctx.lineTo(px, 7);
    ctx.fill();
  }, [width, duration, pps, env, words, selected, time, levels]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const el = scroller.current;
    if (!el || !playing) return;
    const x = time * pps;
    if (x < el.scrollLeft + 20 || x > el.scrollLeft + el.clientWidth - 60) el.scrollLeft = Math.max(0, x - el.clientWidth * 0.25);
  }, [time, playing, pps]);

  const locate = (event: React.PointerEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const t = Math.max(0, Math.min(duration, x / pps));
    const top = 18 + WAVE + 6;
    if (y >= top && y <= top + 34) {
      for (let i = 0; i < words.length; i += 1) {
        const a = words[i].start * pps;
        const b = words[i].end * pps;
        if (x >= a - 4 && x <= b + 4) {
          const edge = Math.min(8, Math.max(3, (b - a) / 3));
          if (Math.abs(x - a) <= edge) return { t, index: i, mode: 'start' as const };
          if (Math.abs(x - b) <= edge) return { t, index: i, mode: 'end' as const };
          return { t, index: i, mode: 'move' as const };
        }
      }
    }
    return { t, index: -1, mode: 'move' as const };
  };

  const onDown = (event: React.PointerEvent) => {
    const hit = locate(event);
    (event.target as Element).setPointerCapture(event.pointerId);
    if (hit.index >= 0) {
      onSelect(hit.index);
      drag.current = { index: hit.index, mode: hit.mode, originX: event.clientX, original: words, origin: hit.t };
      if (hit.mode === 'move') onSeek(words[hit.index].start);
    } else {
      drag.current = null;
      onSeek(hit.t);
    }
  };

  const onMove = (event: React.PointerEvent) => {
    const active = drag.current;
    if (!active) {
      if (event.buttons === 1) onSeek(locate(event).t);
      else if (canvas.current) {
        const hit = locate(event);
        canvas.current.style.cursor = hit.index >= 0 ? (hit.mode === 'move' ? 'grab' : 'ew-resize') : 'pointer';
      }
      return;
    }
    const delta = (event.clientX - active.originX) / pps;
    const base = active.original[active.index];
    if (active.mode === 'start') onChange(moveEdge(active.original, active.index, 'start', base.start + delta));
    else if (active.mode === 'end') onChange(moveEdge(active.original, active.index, 'end', base.end + delta));
    else onChange(shiftWord(active.original, active.index, delta));
  };

  const onUp = () => { drag.current = null; };

  const zoom = (factor: number) => setPps((current) => Math.max(12, Math.min(600, current * factor)));

  return <div className={styles.timelineWrap}>
    <div className={styles.timelineBar}>
      <span>Drag a word to move it, drag its edges to retime. Click the ruler to seek.</span>
      <div>
        <button type="button" aria-label="Zoom out" onClick={() => zoom(0.7)}><ZoomOut size={13} /></button>
        <button type="button" aria-label="Zoom in" onClick={() => zoom(1.4)}><ZoomIn size={13} /></button>
      </div>
    </div>
    <div ref={scroller} className={styles.timelineScroll} onWheel={(event) => { if (event.ctrlKey || event.metaKey) { event.preventDefault(); zoom(event.deltaY < 0 ? 1.15 : 0.87); } }}>
      <canvas ref={canvas} data-testid="cc-timeline" style={{ width, height: HEIGHT }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
    </div>
  </div>;
}
