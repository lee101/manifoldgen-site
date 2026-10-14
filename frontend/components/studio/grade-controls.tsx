'use client';

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { ClipboardPaste, Copy, Download, RotateCcw, Upload, X } from 'lucide-react';
import {
  FILM_LOOKS,
  applyFilmLook,
  autoExposure,
  autoWhiteBalance,
  bakeGradeLUT,
  curveEvaluator,
  decodeLUTData,
  encodeLUTData,
  frameStats,
  gradeDefaults,
  gradeResources,
  identityCurves,
  parseCube,
  pickGrade,
  reinhardMatchLUT,
  rgbToWheel,
  serializeCube,
  storableLUT,
  wheelToRGB,
  type CurvePoint,
  type PixelSample,
  type StudioAdjustments,
  type StudioCurveChannel,
  type StudioCurves,
  type StudioGrade,
  type StudioLUT,
} from '../../lib/studio-grade';
import styles from './production.module.css';

const CLIPBOARD_KEY = 'mg_grade_clipboard_v1';

type ClipboardGrade = { grade: StudioGrade; lut?: { name: string; size: number; data: string } };

export function newLUTID(prefix = 'lut') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function downloadText(text: string, filename: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 20_000);
}

export function exportGradeCube(adjustments: StudioAdjustments, lut: StudioLUT | null | undefined, name: string) {
  const data = bakeGradeLUT(adjustments, lut || null, 33);
  downloadText(serializeCube({ title: name, size: 33, data }), `${name.replace(/[^a-z0-9-_]+/gi, '-').replace(/^-|-$/g, '') || 'grade'}.cube`);
}

export async function readCubeFile(file: File): Promise<StudioLUT> {
  if (file.size > 12_000_000) throw new Error('LUT file is too large');
  const parsed = parseCube(await file.text());
  return storableLUT({ id: newLUTID(), name: parsed.title || file.name.replace(/\.cube$/i, ''), size: parsed.size, data: parsed.data });
}

export async function imagePixels(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 96 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return { data: image.data, width: canvas.width, height: canvas.height } satisfies PixelSample;
}

function Wheel({ label, values, master, amount, masterRange, onChange }: { label: string; values: [number, number, number]; master: number; amount: number; masterRange: number; onChange: (rgb: [number, number, number], master: number) => void }) {
  const [x, y] = rgbToWheel(values[0], values[1], values[2], amount);
  const clampRadius = Math.min(1, Math.hypot(x, y));
  const angle = Math.atan2(y, x);
  const dotX = 50 + Math.cos(angle) * clampRadius * 50;
  const dotY = 50 - Math.sin(angle) * clampRadius * 50;
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = -((event.clientY - rect.top) / rect.height - 0.5) * 2;
    onChange(wheelToRGB(nx, ny, amount), master);
  };
  return <div className={styles.wheel}>
    <b>{label}</b>
    <div
      className={styles.wheelPad}
      role="slider"
      aria-label={`${label} color wheel`}
      aria-valuetext={`${values.map((value) => value.toFixed(2)).join(' ')}`}
      tabIndex={0}
      title="Drag to tint · double-click to reset"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); move(event); }}
      onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }}
      onDoubleClick={() => onChange([0, 0, 0], 0)}
      onKeyDown={(event) => { if (event.key === 'Escape' || event.key === 'Backspace') onChange([0, 0, 0], master); }}
    >
      <span className={styles.wheelDot} style={{ left: `${dotX}%`, top: `${dotY}%` }} />
    </div>
    <input aria-label={`${label} master`} type="range" min={-masterRange} max={masterRange} step={0.005} value={master} onChange={(event) => onChange(values, Number(event.target.value))} onDoubleClick={() => onChange(values, 0)} />
    <output>{master >= 0 ? '+' : ''}{master.toFixed(2)}</output>
  </div>;
}

const CHANNELS: { id: StudioCurveChannel; label: string; color: string }[] = [
  { id: 'master', label: 'Luma', color: '#e8e8ee' },
  { id: 'red', label: 'R', color: '#ff6b6b' },
  { id: 'green', label: 'G', color: '#5fe08a' },
  { id: 'blue', label: 'B', color: '#69a7ff' },
];

function CurveEditor({ curves, onChange }: { curves: StudioCurves; onChange: (curves: StudioCurves) => void }) {
  const [channel, setChannel] = useState<StudioCurveChannel>('master');
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<number | null>(null);
  const points = curves[channel];
  const active = CHANNELS.find((item) => item.id === channel)!;
  const paths = useMemo(() => CHANNELS.map((item) => {
    const evaluate = curveEvaluator(curves[item.id]);
    return { ...item, d: Array.from({ length: 65 }, (_, index) => { const x = index / 64; return `${index ? 'L' : 'M'}${(x * 100).toFixed(2)},${((1 - evaluate(x)) * 100).toFixed(2)}`; }).join('') };
  }), [curves]);
  const locate = (event: ReactPointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height))] as CurvePoint;
  };
  const update = (next: CurvePoint[]) => onChange({ ...curves, [channel]: next });
  const movePoint = (index: number, [x, y]: CurvePoint) => {
    const next = points.map((point) => [...point] as CurvePoint);
    const min = index === 0 ? 0 : next[index - 1][0] + 0.01;
    const max = index === next.length - 1 ? 1 : next[index + 1][0] - 0.01;
    next[index] = [index === 0 ? 0 : index === next.length - 1 ? 1 : Math.max(min, Math.min(max, x)), y];
    update(next);
  };
  return <div className={styles.row}>
    <div className={styles.tabs}>{CHANNELS.map((item) => <button key={item.id} type="button" aria-pressed={channel === item.id} onClick={() => setChannel(item.id)} style={channel === item.id ? { color: item.color } : undefined}>{item.label}</button>)}</div>
    <svg
      ref={svgRef}
      className={styles.curve}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="grade-curve"
      onPointerDown={(event) => {
        const point = locate(event);
        const hit = points.findIndex(([x, y]) => Math.abs(x - point[0]) < 0.05 && Math.abs(y - point[1]) < 0.06);
        event.currentTarget.setPointerCapture(event.pointerId);
        if (hit >= 0) {
          dragRef.current = hit;
          return;
        }
        if (points.length >= 12) return;
        const next = [...points, point].sort((left, right) => left[0] - right[0]);
        dragRef.current = next.indexOf(point);
        update(next);
      }}
      onPointerMove={(event) => { if (dragRef.current !== null) movePoint(dragRef.current, locate(event)); }}
      onPointerUp={() => { dragRef.current = null; }}
      onDoubleClick={(event) => {
        const point = locate(event as unknown as ReactPointerEvent);
        const hit = points.findIndex(([x, y], index) => index > 0 && index < points.length - 1 && Math.abs(x - point[0]) < 0.05 && Math.abs(y - point[1]) < 0.06);
        if (hit > 0) update(points.filter((_, index) => index !== hit));
      }}
    >
      {[25, 50, 75].map((value) => <g key={value} stroke="#1f232b" strokeWidth="0.5"><line x1={value} y1="0" x2={value} y2="100" /><line x1="0" y1={value} x2="100" y2={value} /></g>)}
      <line x1="0" y1="100" x2="100" y2="0" stroke="#2a2f38" strokeWidth="0.5" strokeDasharray="2 2" />
      {paths.filter((item) => item.id !== channel).map((item) => <path key={item.id} d={item.d} fill="none" stroke={item.color} strokeOpacity="0.25" strokeWidth="0.7" vectorEffect="non-scaling-stroke" />)}
      <path d={paths.find((item) => item.id === channel)!.d} fill="none" stroke={active.color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
      {points.map(([x, y], index) => <circle key={index} cx={x * 100} cy={(1 - y) * 100} r="2.4" fill="#0d0f13" stroke={active.color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />)}
    </svg>
    <div className={styles.inline}><p className={styles.hint} style={{ flex: 1 }}>Tap to add · drag · double-tap a point to remove</p><button type="button" className={styles.chip} onClick={() => update([[0, 0], [1, 1]])}>Reset {active.label}</button></div>
  </div>;
}

export type GradeControlsProps = {
  adjustments: StudioAdjustments;
  onChange: (patch: Partial<StudioAdjustments>, key: string) => void;
  luts: Record<string, StudioLUT>;
  onAddLUT: (lut: StudioLUT) => void;
  sampleFrame?: () => PixelSample | null;
  references?: { id: string; label: string }[];
  sampleReference?: (id: string) => Promise<PixelSample | null>;
  onNotice?: (message: string, isError?: boolean) => void;
  exportName?: string;
};

export function GradeControls({ adjustments, onChange, luts, onAddLUT, sampleFrame, references = [], sampleReference, onNotice, exportName = 'manifold-grade' }: GradeControlsProps) {
  const [referenceID, setReferenceID] = useState('');
  const [matching, setMatching] = useState(false);
  const lut = adjustments.lutID ? luts[adjustments.lutID] || null : null;
  const curves = adjustments.curves || identityCurves();
  const notify = (message: string, isError = false) => onNotice?.(message, isError);

  const copyGrade = () => {
    const payload: ClipboardGrade = { grade: pickGrade(adjustments) };
    if (lut) {
      const stored = storableLUT(lut);
      payload.lut = { name: stored.name, size: stored.size, data: encodeLUTData(stored.data) };
    }
    try {
      localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(payload));
      notify('Grade copied');
    } catch {
      notify('Could not copy the grade', true);
    }
  };

  const pasteGrade = () => {
    try {
      const payload = JSON.parse(localStorage.getItem(CLIPBOARD_KEY) || 'null') as ClipboardGrade | null;
      if (!payload?.grade) {
        notify('Copy a grade first', true);
        return;
      }
      const grade = { ...payload.grade };
      if (grade.lutID && !luts[grade.lutID] && payload.lut) onAddLUT({ id: grade.lutID, name: payload.lut.name, size: payload.lut.size, data: decodeLUTData(payload.lut.data, payload.lut.size) });
      onChange({ ...gradeDefaults(), ...grade }, 'grade-paste');
      notify('Grade pasted');
    } catch {
      notify('Could not paste the grade', true);
    }
  };

  const importLUT = async (file: File | undefined) => {
    if (!file) return;
    try {
      const next = await readCubeFile(file);
      onAddLUT(next);
      onChange({ lutID: next.id, lutIntensity: 1 }, 'lut');
      notify(`${next.name} loaded`);
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Could not read the LUT', true);
    }
  };

  const runAuto = (mode: 'wb' | 'exposure' | 'both') => {
    const pixels = sampleFrame?.();
    if (!pixels) {
      notify('Frame not ready yet', true);
      return;
    }
    let patch: Partial<StudioAdjustments> = {};
    if (mode !== 'exposure') patch = { ...patch, ...autoWhiteBalance(pixels, adjustments, lut) };
    if (mode !== 'wb') patch = { ...patch, ...autoExposure(pixels, { ...adjustments, ...patch }, lut) };
    onChange(patch, `auto-${mode}`);
  };

  const match = async (pixelsPromise: Promise<PixelSample | null>) => {
    const source = sampleFrame?.();
    setMatching(true);
    try {
      const reference = await pixelsPromise;
      if (!source || !reference) throw new Error('Frames not ready yet');
      const withoutLUT = { ...adjustments, lutID: undefined };
      const data = reinhardMatchLUT(frameStats(source, withoutLUT, gradeResources(withoutLUT)), frameStats(reference), 33);
      const next: StudioLUT = { id: newLUTID('match'), name: 'Reference match', size: 33, data };
      onAddLUT(next);
      onChange({ lutID: next.id, lutIntensity: 1 }, 'match');
      notify('Matched to reference');
    } catch (reason) {
      notify(reason instanceof Error ? reason.message : 'Match failed', true);
    } finally {
      setMatching(false);
    }
  };

  const wheel = (prefix: 'lift' | 'gamma' | 'gain') => ({
    values: [adjustments[`${prefix}R`], adjustments[`${prefix}G`], adjustments[`${prefix}B`]] as [number, number, number],
    master: adjustments[`${prefix}M`],
    onChange: (rgb: [number, number, number], master: number) => onChange({ [`${prefix}R`]: rgb[0], [`${prefix}G`]: rgb[1], [`${prefix}B`]: rgb[2], [`${prefix}M`]: master }, `wheel-${prefix}`),
  });

  return <div className={styles.stack} data-testid="grade-controls">
    <div className={styles.actions}>
      <button type="button" onClick={copyGrade} title="Copy grade"><Copy size={12} /> Copy</button>
      <button type="button" onClick={pasteGrade} title="Paste grade"><ClipboardPaste size={12} /> Paste</button>
      <button type="button" data-testid="grade-export-cube" onClick={() => exportGradeCube(adjustments, lut, exportName)} title="Export grade as 33³ .cube"><Download size={12} /> .cube</button>
      <button type="button" onClick={() => onChange({ ...gradeDefaults() }, 'grade-reset')} title="Reset grade"><RotateCcw size={12} /> Reset</button>
    </div>
    <details className={styles.section} open>
      <summary>COLOR WHEELS</summary>
      <div className={styles.body}>
        <div className={styles.wheels}>
          <Wheel label="Lift" amount={0.15} masterRange={0.3} {...wheel('lift')} />
          <Wheel label="Gamma" amount={0.4} masterRange={1} {...wheel('gamma')} />
          <Wheel label="Gain" amount={0.35} masterRange={1} {...wheel('gain')} />
        </div>
        <p className={styles.hint}>Shadows · midtones · highlights. Double-click to reset.</p>
      </div>
    </details>
    <details className={styles.section}>
      <summary>CURVES{adjustments.curves ? <small>on</small> : null}</summary>
      <div className={styles.body}><CurveEditor curves={curves} onChange={(next) => onChange({ curves: next }, 'curves')} /></div>
    </details>
    <details className={styles.section} open={!!lut || undefined}>
      <summary>3D LUT{lut ? <small>{lut.size}³</small> : null}</summary>
      <div className={styles.body}>
        <div className={styles.inline}>
          {lut ? <span className={styles.lutName} title={lut.name}>{lut.name}</span> : <span className={styles.hint} style={{ flex: 1 }}>.cube 17 / 33 / 65</span>}
          <label className={`${styles.chip} ${styles.file}`}><Upload size={12} /> Import<input type="file" accept=".cube,text/plain" data-testid="grade-lut-input" onChange={(event) => { void importLUT(event.target.files?.[0]); event.target.value = ''; }} /></label>
          {lut && <button type="button" className={styles.chip} aria-label="Remove LUT" onClick={() => onChange({ lutID: undefined }, 'lut')}><X size={12} /></button>}
        </div>
        {lut && <label className={styles.row}><span><b>Intensity</b><output>{Math.round(adjustments.lutIntensity * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={adjustments.lutIntensity} onChange={(event) => onChange({ lutIntensity: Number(event.target.value) }, 'lut-intensity')} /></label>}
      </div>
    </details>
    <details className={styles.section}>
      <summary>MATCH &amp; AUTO</summary>
      <div className={styles.body}>
        <div className={styles.actions}>
          <button type="button" data-testid="grade-auto-wb" disabled={!sampleFrame} onClick={() => runAuto('wb')}>Auto WB</button>
          <button type="button" data-testid="grade-auto-exposure" disabled={!sampleFrame} onClick={() => runAuto('exposure')}>Auto exposure</button>
          <button type="button" disabled={!sampleFrame} onClick={() => runAuto('both')}>Both</button>
        </div>
        <div className={styles.inline}>
          {references.length > 0 && <select aria-label="Reference clip" value={referenceID} onChange={(event) => setReferenceID(event.target.value)}><option value="">Reference clip…</option>{references.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>}
          {references.length > 0 && <button type="button" className={styles.chip} disabled={!referenceID || matching || !sampleReference} onClick={() => void match(sampleReference!(referenceID))}>Match</button>}
          <label className={`${styles.chip} ${styles.file}`}><Upload size={12} /> {references.length ? 'Still' : 'Match to still'}<input type="file" accept="image/*" data-testid="grade-match-input" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void match(imagePixels(file)); }} /></label>
        </div>
        <p className={styles.hint}>Transfers the reference&apos;s color statistics (Lab) into a LUT.</p>
      </div>
    </details>
    <details className={styles.section}>
      <summary>FILM LOOKS</summary>
      <div className={styles.body}>
        <div className={styles.looks}>{FILM_LOOKS.map((look) => <button type="button" key={look.name} data-testid={`grade-look-${look.name.toLowerCase().replace(/[^a-z]+/g, '-')}`} onClick={() => onChange(applyFilmLook(adjustments, look), 'film-look')}><span style={{ background: `linear-gradient(135deg, ${look.colors})` }} /><b>{look.name}</b></button>)}</div>
      </div>
    </details>
  </div>;
}
