'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser, RotateCcw, Square, Trash2, Brush } from 'lucide-react';
import { REGION_COLORS } from '../../lib/anime-control';
import styles from './anime-control.module.css';

export type PaintPadHandle = {
  exportPNG: (width: number, height: number) => Promise<Blob>;
  isEmpty: () => boolean;
  clear: () => void;
};

type Props = { mode: 'region' | 'sketch'; width: number; height: number; disabled?: boolean; onChange?: () => void };
type Tool = 'brush' | 'box' | 'erase';

const PaintPad = forwardRef<PaintPadHandle, Props>(function PaintPad({ mode, width, height, disabled, onChange }, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const history = useRef<ImageData[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);
  const snapshot = useRef<ImageData | null>(null);
  const [tool, setTool] = useState<Tool>('brush');
  const [color, setColor] = useState(mode === 'sketch' ? '#ffffff' : REGION_COLORS[0]);
  const [size, setSize] = useState(mode === 'sketch' ? 4 : 28);
  const scale = 0.5;

  const blank = useCallback(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, el.width, el.height);
    history.current = [];
  }, []);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const keep = document.createElement('canvas');
    keep.width = el.width; keep.height = el.height;
    keep.getContext('2d')!.drawImage(el, 0, 0);
    el.width = Math.round(width * scale);
    el.height = Math.round(height * scale);
    const ctx = el.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, el.width, el.height);
    if (keep.width > 1) ctx.drawImage(keep, 0, 0, el.width, el.height);
    history.current = [];
  }, [width, height]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.current!.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.current!.width, y: ((event.clientY - rect.top) / rect.height) * canvas.current!.height };
  };

  const paint = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const ctx = canvas.current!.getContext('2d')!;
    const ink = tool === 'erase' ? '#000' : color;
    if (tool === 'box') {
      if (snapshot.current) ctx.putImageData(snapshot.current, 0, 0);
      ctx.fillStyle = ink;
      ctx.fillRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      return;
    }
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * scale;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const el = canvas.current!;
    el.setPointerCapture(event.pointerId);
    const ctx = el.getContext('2d')!;
    history.current = [...history.current.slice(-24), ctx.getImageData(0, 0, el.width, el.height)];
    snapshot.current = ctx.getImageData(0, 0, el.width, el.height);
    start.current = point(event);
    if (tool !== 'box') paint(start.current, start.current);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!start.current) return;
    const next = point(event);
    paint(tool === 'box' ? start.current : start.current, next);
    if (tool !== 'box') start.current = next;
  };

  const up = () => {
    if (!start.current) return;
    start.current = null;
    snapshot.current = null;
    onChange?.();
  };

  const undo = () => {
    const el = canvas.current;
    const last = history.current.pop();
    if (el && last) { el.getContext('2d')!.putImageData(last, 0, 0); onChange?.(); }
  };

  useImperativeHandle(ref, () => ({
    clear: () => { blank(); onChange?.(); },
    isEmpty: () => {
      const el = canvas.current;
      if (!el) return true;
      const data = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
      for (let i = 0; i < data.length; i += 4) if (data[i] || data[i + 1] || data[i + 2]) return false;
      return true;
    },
    exportPNG: (outWidth, outHeight) => new Promise<Blob>((resolve, reject) => {
      const out = document.createElement('canvas');
      out.width = outWidth; out.height = outHeight;
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = mode === 'sketch';
      ctx.drawImage(canvas.current!, 0, 0, outWidth, outHeight);
      out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export the canvas'))), 'image/png');
    }),
  }), [blank, mode, onChange]);

  return (
    <div className={styles.pad}>
      <div className={styles.padTools}>
        <button type="button" className={tool === 'brush' ? styles.on : ''} onClick={() => setTool('brush')} title="Brush"><Brush size={14} /></button>
        {mode === 'region' && <button type="button" className={tool === 'box' ? styles.on : ''} onClick={() => setTool('box')} title="Box"><Square size={14} /></button>}
        <button type="button" className={tool === 'erase' ? styles.on : ''} onClick={() => setTool('erase')} title="Eraser"><Eraser size={14} /></button>
        <button type="button" onClick={undo} title="Undo"><RotateCcw size={14} /></button>
        <button type="button" onClick={() => { blank(); onChange?.(); }} title="Clear"><Trash2 size={14} /></button>
        <input type="range" min={4} max={96} value={size} onChange={(event) => setSize(Number(event.target.value))} aria-label="Brush size" />
      </div>
      {mode === 'region' && (
        <div className={styles.swatches}>
          {REGION_COLORS.map((swatch) => (
            <button key={swatch} type="button" aria-label={`Region colour ${swatch}`} className={color === swatch && tool !== 'erase' ? styles.swatchOn : ''}
              style={{ background: swatch }} onClick={() => { setColor(swatch); if (tool === 'erase') setTool('brush'); }} />
          ))}
        </div>
      )}
      <canvas ref={canvas} className={styles.padCanvas} style={{ aspectRatio: `${width} / ${height}` }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
    </div>
  );
});

export default PaintPad;
