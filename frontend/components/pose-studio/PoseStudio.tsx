'use client';

import { forwardRef, type ForwardRefExoticComponent, type RefAttributes, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { ArrowUpDown, Bone, Check, ClipboardPaste, Copy, Download, FlipHorizontal2, Footprints, Grid3x3, Hand, LoaderCircle, Redo2, RotateCcw, Scan, Sun, Undo2, UserMinus, UserPlus } from 'lucide-react';
import { CAMERA_VIEW_NAMES, HAND_SHAPES, MAP_KINDS, MAX_PEOPLE, OUTPUT_SIZES, PRESET_NAMES, PROP_LIMITS, PoseStudio as Studio, decodePose } from '../../lib/pose-studio';
import type { MapKind, MapRequest, PinKey, PoseJSON, Props, RegionMode, StudioState } from '../../lib/pose-studio';
import { PERSON_COLORS } from '../../lib/pose-studio/gpu';
import styles from './PoseStudio.module.css';

export type StudioMaps = Record<MapKind, { blob: Blob; imageData: ImageData; width: number; height: number }>;
export type PoseStudioHandle = {
  exportMap: (kind: MapKind, size?: { width?: number; height?: number }) => Promise<Blob>;
  exportAll: (size?: { width?: number; height?: number }) => Promise<StudioMaps>;
  getPose: () => PoseJSON | null;
  setPose: (pose: PoseJSON | string) => void;
  studio: Studio | null;
};
export type PoseStudioProps = {
  outputSize?: { width: number; height: number };
  value?: string;
  onChange?: (json: string) => void;
  onExport?: (maps: StudioMaps) => void;
  className?: string;
  showSizePicker?: boolean;
};

const KIND_LABEL: Record<MapKind, string> = { mesh: 'Mesh', skeleton: 'Skeleton', depth: 'Depth', region: 'Region' };
const PROP_META: { key: keyof Props; label: string; step: number; unit?: string; hint?: string }[] = [
  { key: 'headsTall', label: 'Heads tall', step: 0.05, hint: 'realistic 7.5, stylized 9' },
  { key: 'height', label: 'Height', step: 0.01, unit: ' m' },
  { key: 'shoulder', label: 'Shoulder width', step: 0.01 },
  { key: 'hip', label: 'Hip width', step: 0.01 },
  { key: 'limb', label: 'Limb length', step: 0.01 },
];
const PINS: { key: PinKey; label: string; side: string; icon: 'hand' | 'foot' }[] = [
  { key: 'footL', label: 'left foot', side: 'L', icon: 'foot' },
  { key: 'footR', label: 'right foot', side: 'R', icon: 'foot' },
  { key: 'handL', label: 'left hand', side: 'L', icon: 'hand' },
  { key: 'handR', label: 'right hand', side: 'R', icon: 'hand' },
];
const THUMB_EDGE = 220;

function parsePose(text: string): PoseJSON {
  const d = decodePose(text);
  if (!d || d.v !== 1 || !Array.isArray(d.fig) || !d.fig.length) throw new Error('Invalid pose data');
  return d;
}

function Btn({ label, on, onClick, disabled, children, wide }: { label: string; on?: boolean; onClick: () => void; disabled?: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <button type="button" className={`${styles.btn} ${wide ? styles.wide : ''}`} aria-label={label} title={label} aria-pressed={on} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

const PoseStudioView = forwardRef<PoseStudioHandle, PoseStudioProps>(function PoseStudioView({ outputSize, value, onChange, onExport, className, showSizePicker }, ref) {
  const rootEl = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const studioRef = useRef<Studio | null>(null);
  const canvases = useRef<Partial<Record<MapKind, HTMLCanvasElement | null>>>({});
  const lastEmit = useRef('');
  const valueRef = useRef(value);
  const sizeRef = useRef(outputSize);
  const onChangeRef = useRef(onChange);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [st, setSt] = useState<StudioState | null>(null);
  const [regionMode, setRegionMode] = useState<RegionMode>('person');
  const [hands, setHands] = useState(true);
  const [face, setFace] = useState(true);
  const [handSide, setHandSide] = useState<'L' | 'R' | 'both'>('both');
  const [filter, setFilter] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const opts = useRef<MapRequest>({});
  opts.current = { regionMode, hands, face };
  valueRef.current = value;
  sizeRef.current = outputSize;
  onChangeRef.current = onChange;
  const pickerShown = showSizePicker ?? !outputSize;

  const flash = useCallback((text: string, bad?: boolean) => {
    setMsg({ text, bad });
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), bad ? 6000 : 2200);
  }, []);

  const drawThumbs = useCallback(() => {
    thumbTimer.current = null;
    const s = studioRef.current;
    if (!s) return;
    const [ow, oh] = s.getOutputSize();
    const k = THUMB_EDGE / Math.max(ow, oh);
    const tw = Math.max(16, Math.round(ow * k)), th = Math.max(16, Math.round(oh * k));
    for (const kind of MAP_KINDS) {
      const c = canvases.current[kind];
      const ctx = c?.getContext('2d');
      if (!c || !ctx) continue;
      if (c.width !== tw || c.height !== th) { c.width = tw; c.height = th; }
      try { ctx.putImageData(s.exportImageData(kind, { ...opts.current, width: tw, height: th, thumb: true }), 0, 0); } catch { ctx.clearRect(0, 0, tw, th); }
    }
  }, []);

  const schedule = useCallback(() => {
    if (!thumbTimer.current) thumbTimer.current = setTimeout(drawThumbs, 250);
  }, [drawThumbs]);

  const applyPose = useCallback((text: string) => {
    const s = studioRef.current;
    if (!s) throw new Error('Studio not ready');
    s.setPose(parsePose(text));
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const o = sizeRef.current;
    const v = valueRef.current;
    const s = new Studio(el, { width: o?.width, height: o?.height, pose: v ? v : undefined });
    studioRef.current = s;
    lastEmit.current = v ?? '';
    let emitTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => setSt(s.getState());
    const offs = [
      s.on('state', (d) => { setSt(d as StudioState); schedule(); }),
      s.on('ready', () => { refresh(); schedule(); }),
      s.on('contextrestored', schedule),
      s.on('change', () => {
        schedule();
        if (emitTimer) clearTimeout(emitTimer);
        emitTimer = setTimeout(() => {
          emitTimer = null;
          if (!onChangeRef.current) return;
          const j = JSON.stringify(s.getPose());
          if (j === lastEmit.current) return;
          lastEmit.current = j;
          onChangeRef.current(j);
        }, 150);
      }),
    ];
    refresh();
    schedule();
    return () => {
      offs.forEach((f) => f());
      if (emitTimer) clearTimeout(emitTimer);
      if (thumbTimer.current) { clearTimeout(thumbTimer.current); thumbTimer.current = null; }
      s.destroy();
      if (studioRef.current === s) studioRef.current = null;
    };
  }, [schedule]);

  useEffect(() => () => { if (msgTimer.current) clearTimeout(msgTimer.current); }, []);

  useEffect(() => {
    if (outputSize) studioRef.current?.setOutputSize(outputSize.width, outputSize.height);
  }, [outputSize?.width, outputSize?.height]);

  useEffect(() => {
    if (!value || value === lastEmit.current || !studioRef.current) return;
    lastEmit.current = value;
    try { applyPose(value); } catch { flash('Invalid pose value', true); }
  }, [value, applyPose, flash]);

  useEffect(() => { schedule(); }, [regionMode, hands, face, schedule]);

  useImperativeHandle(ref, () => {
    const need = () => {
      const s = studioRef.current;
      if (!s) throw new Error('The 3D studio is still loading.');
      return s;
    };
    const req = (size?: { width?: number; height?: number }): MapRequest => ({ ...opts.current, ...size });
    return {
      exportMap: (kind, size) => need().exportMap(kind, req(size)),
      exportAll: (size) => need().exportAll(req(size)),
      getPose: () => studioRef.current?.getPose() ?? null,
      setPose: (p) => { if (typeof p === 'string') applyPose(p); else need().setPose(p); },
      get studio() { return studioRef.current; },
    };
  }, [applyPose]);

  const act = (fn: (s: Studio) => void) => {
    const s = studioRef.current;
    if (!s) return;
    fn(s);
    setSt(s.getState());
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const s = studioRef.current;
    const t = e.target as HTMLElement;
    if (!s || e.defaultPrevented || host.current?.contains(t)) return;
    const type = t instanceof HTMLInputElement ? t.type : '';
    if (t instanceof HTMLTextAreaElement || (type && type !== 'range' && type !== 'checkbox' && type !== 'button')) return;
    s.handleKey(e.nativeEvent);
  };

  const download = async (kind: MapKind) => {
    const s = studioRef.current;
    if (!s) return;
    try {
      const [w, h] = s.getOutputSize();
      const url = URL.createObjectURL(await s.exportMap(kind, { ...opts.current, width: w, height: h }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `pose-${kind}-${w}x${h}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Export failed', true);
    }
  };

  const runExport = async () => {
    const s = studioRef.current;
    if (!s || !onExport) return;
    setBusy(true);
    try {
      const [width, height] = s.getOutputSize();
      onExport(await s.exportAll({ ...opts.current, width, height }));
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Export failed', true);
    } finally {
      setBusy(false);
    }
  };

  const copyJson = async () => {
    const s = studioRef.current;
    if (!s) return;
    const text = JSON.stringify(s.getPose());
    try {
      await navigator.clipboard.writeText(text);
      flash('Pose JSON copied');
    } catch {
      setPasteText(text);
      setPasteOpen(true);
      flash('Clipboard blocked, copy from the box', true);
    }
  };

  const applyPaste = () => {
    try {
      applyPose(pasteText);
      setPasteOpen(false);
      setPasteText('');
      flash('Pose applied');
    } catch {
      flash('Invalid pose data', true);
    }
  };

  const sliding = useRef<keyof Props | null>(null);
  const endSlide = useRef<() => void>(() => {});
  const beginSlide = (k: keyof Props) => {
    const s = studioRef.current;
    if (!s || sliding.current) return;
    s.beginEdit();
    sliding.current = k;
    const end = () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!sliding.current) return;
      sliding.current = null;
      s.endEdit();
      setSt(s.getState());
    };
    endSlide.current = end;
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const slide = (k: keyof Props, v: number) =>
    act((s) => {
      if (sliding.current) s.previewProportions({ [k]: v });
      else s.setProportions({ [k]: v });
    });

  const sizes = st && !OUTPUT_SIZES.some(([w, h]) => w === st.size[0] && h === st.size[1]) ? [st.size, ...OUTPUT_SIZES] : OUTPUT_SIZES;
  const ow = st?.size[0] ?? 768, oh = st?.size[1] ?? 1024;
  const presets = PRESET_NAMES.filter((n) => n.toLowerCase().includes(filter.trim().toLowerCase()));
  const multi = (st?.people.length ?? 1) > 1;

  return (
    <div ref={rootEl} className={`${styles.root} ${className ?? ''}`} onKeyDown={onKeyDown} data-testid="pose-studio">
      <div className={styles.main}>
        <div className={styles.stage}>
          <div className={styles.toolbar} role="toolbar" aria-label="Pose tools">
            <div className={styles.seg} role="group" aria-label="Pose mode">
              {(['ik', 'fk'] as const).map((m) => (
                <button key={m} type="button" aria-pressed={st?.mode === m} aria-label={m === 'ik' ? 'Inverse kinematics mode' : 'Forward kinematics mode'} title={m === 'ik' ? 'IK: drag hands and feet (X)' : 'FK: rotate joints (X)'} onClick={() => act((s) => s.setMode(m))}>
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
            <Btn label="Depth drag (move handles toward or away from camera)" on={st?.depthMode} onClick={() => act((s) => s.setDepthMode(!s.getState().depthMode))}><ArrowUpDown size={16} /></Btn>
            <i className={styles.sep} />
            <Btn label="Undo (Ctrl+Z)" disabled={!st?.canUndo} onClick={() => act((s) => void s.undo())}><Undo2 size={16} /></Btn>
            <Btn label="Redo (Ctrl+Shift+Z)" disabled={!st?.canRedo} onClick={() => act((s) => void s.redo())}><Redo2 size={16} /></Btn>
            <Btn label="Mirror pose (M)" onClick={() => act((s) => s.mirror())}><FlipHorizontal2 size={16} /></Btn>
            <Btn label="Reset pose (R)" onClick={() => act((s) => s.reset())}><RotateCcw size={16} /></Btn>
            <i className={styles.sep} />
            {PINS.map((p) => (
              <Btn key={p.key} label={`Pin ${p.label}`} on={!!st?.pins[p.key]} onClick={() => act((s) => s.togglePin(p.key))}>
                {p.icon === 'hand' ? <Hand size={15} /> : <Footprints size={15} />}<b>{p.side}</b>
              </Btn>
            ))}
            <i className={styles.sep} />
            <Btn label="Copy pose (Ctrl+C)" onClick={() => act((s) => s.copyPose())}><Copy size={16} /></Btn>
            <Btn label="Paste pose (Ctrl+V)" disabled={!st?.canPaste} onClick={() => act((s) => s.pastePose())}><ClipboardPaste size={16} /></Btn>
            <Btn label="Add person" disabled={(st?.people.length ?? 0) >= MAX_PEOPLE} onClick={() => act((s) => void s.addPerson())}><UserPlus size={16} /></Btn>
            <Btn label="Remove selected person (Delete)" disabled={!multi} onClick={() => act((s) => void s.removePerson())}><UserMinus size={16} /></Btn>
            <i className={styles.sep} />
            <select className={styles.view} aria-label="Camera view preset" title="Camera view" value="" onChange={(e) => { const v = e.target.value; if (v) act((s) => void s.setCameraView(v)); }}>
              <option value="">View</option>
              {CAMERA_VIEW_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <Btn label="Frame figures (F)" onClick={() => act((s) => { s.frameFigures(); s.requestRender(); })}><Scan size={16} /></Btn>
            <Btn label="Toggle grid (G)" on={st?.grid} onClick={() => act((s) => s.setShowGrid(!s.getState().grid))}><Grid3x3 size={16} /></Btn>
            <Btn label="Toggle shadow" on={st?.shadow} onClick={() => act((s) => s.setShowShadow(!s.getState().shadow))}><Sun size={16} /></Btn>
            <Btn label="Toggle bones overlay" on={st?.bones} onClick={() => act((s) => s.setShowBones(!s.getState().bones))}><Bone size={16} /></Btn>
          </div>
          <div ref={host} className={styles.canvas} />
          {st && !st.webgl && <div className={styles.note}>WebGL2 unavailable: mesh, depth and region maps are disabled.</div>}
        </div>

        <div className={styles.strip}>
          <div className={styles.thumbs}>
            {MAP_KINDS.map((kind) => (
              <figure key={kind} className={styles.thumb}>
                <canvas ref={(c) => { canvases.current[kind] = c; }} style={{ aspectRatio: `${ow} / ${oh}` }} aria-label={`${KIND_LABEL[kind]} map preview`} />
                <figcaption>
                  <span>{KIND_LABEL[kind]}</span>
                  <button type="button" className={styles.mini} aria-label={`Download ${KIND_LABEL[kind]} map as PNG`} title={`Download ${KIND_LABEL[kind]} PNG`} onClick={() => void download(kind)}><Download size={13} /></button>
                </figcaption>
              </figure>
            ))}
          </div>
          <div className={styles.actions}>
            {onExport && <button type="button" className={styles.primary} disabled={busy} onClick={() => void runExport()}>{busy ? <LoaderCircle className={styles.spin} size={15} /> : <Download size={15} />} Export maps</button>}
            <button type="button" className={styles.ghost} onClick={() => void copyJson()}><Copy size={14} /> Copy pose JSON</button>
            <button type="button" className={styles.ghost} aria-expanded={pasteOpen} onClick={() => setPasteOpen((v) => !v)}><ClipboardPaste size={14} /> Paste pose JSON</button>
            <span className={`${styles.msg} ${msg?.bad ? styles.bad : ''}`} role="status" aria-live="polite">{msg ? <>{!msg.bad && <Check size={13} />}{msg.text}</> : null}</span>
          </div>
          {pasteOpen && (
            <div className={styles.paste}>
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste pose JSON or encoded pose string" aria-label="Pose JSON" rows={4} spellCheck={false} />
              <div>
                <button type="button" className={styles.primary} disabled={!pasteText.trim()} onClick={applyPaste}>Apply pose</button>
                <button type="button" className={styles.ghost} onClick={() => { setPasteOpen(false); setPasteText(''); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className={styles.side} aria-label="Pose settings">
        <section>
          <h3>People</h3>
          <div className={styles.chips}>
            {(st?.people ?? []).map((p, i) => {
              const c = PERSON_COLORS[p.color % PERSON_COLORS.length];
              return (
                <button key={p.id} type="button" className={styles.chip} aria-pressed={st?.selected === p.id} aria-label={`Select figure ${i + 1}`} title={`Figure ${i + 1} (key ${i + 1})`} onClick={() => act((s) => void s.selectPerson(p.id))}>
                  <i style={{ background: `rgb(${c[0]},${c[1]},${c[2]})` }} />{i + 1}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h3>Presets</h3>
          <input className={styles.text} type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter presets" aria-label="Filter presets" />
          <div className={styles.presets} role="group" aria-label="Pose presets">
            {presets.map((n) => <button key={n} type="button" onClick={() => act((s) => void s.setPreset(n))}>{n}</button>)}
            {!presets.length && <span className={styles.empty}>No match</span>}
          </div>
        </section>

        <section>
          <h3>Hands</h3>
          <div className={styles.seg} role="group" aria-label="Hand side">
            {(['L', 'R', 'both'] as const).map((sd) => <button key={sd} type="button" aria-pressed={handSide === sd} aria-label={sd === 'both' ? 'Both hands' : sd === 'L' ? 'Left hand' : 'Right hand'} onClick={() => setHandSide(sd)}>{sd === 'both' ? 'Both' : sd}</button>)}
          </div>
          <div className={styles.presets} role="group" aria-label="Hand shapes">
            {HAND_SHAPES.map((h) => <button key={h} type="button" onClick={() => act((s) => s.setHandShape(handSide, h))}>{h}</button>)}
          </div>
        </section>

        <section>
          <h3>Proportions</h3>
          {PROP_META.map(({ key, label, step, unit, hint }) => {
            const [lo, hi] = PROP_LIMITS[key];
            const v = st?.props[key] ?? lo;
            const id = `ps-${key}`;
            return (
              <div key={key} className={styles.range}>
                <label htmlFor={id}><span>{label}</span><output>{v.toFixed(2)}{unit}</output></label>
                <input id={id} type="range" min={lo} max={hi} step={step} value={v} aria-valuetext={`${v.toFixed(2)}${unit ?? ''}`} title={hint}
                  onPointerDown={() => beginSlide(key)}
                  onChange={(e) => slide(key, Number(e.target.value))}
                  onBlur={() => endSlide.current()} />
                {hint && <small>{hint}</small>}
              </div>
            );
          })}
        </section>

        <section>
          <h3>Camera and output</h3>
          <div className={styles.range}>
            <label htmlFor="ps-fov"><span>Field of view</span><output>{Math.round(st?.fov ?? 35)} deg</output></label>
            <input id="ps-fov" type="range" min={12} max={90} step={1} value={st?.fov ?? 35} aria-valuetext={`${Math.round(st?.fov ?? 35)} degrees`} onChange={(e) => act((s) => s.setFov(Number(e.target.value)))} />
          </div>
          {pickerShown && (
            <label className={styles.field}>Output size
              <select value={`${ow}x${oh}`} onChange={(e) => { const [w, h] = e.target.value.split('x').map(Number); act((s) => s.setOutputSize(w, h)); }}>
                {sizes.map(([w, h]) => <option key={`${w}x${h}`} value={`${w}x${h}`}>{w}x{h}</option>)}
              </select>
            </label>
          )}
          <label className={styles.field}>Region mode
            <select value={regionMode} onChange={(e) => setRegionMode(e.target.value as RegionMode)}>
              <option value="person">Per person</option>
              <option value="parts">Body parts</option>
            </select>
          </label>
          <div className={styles.checks}>
            <label><input type="checkbox" checked={hands} onChange={(e) => setHands(e.target.checked)} /> Skeleton hands</label>
            <label><input type="checkbox" checked={face} onChange={(e) => setFace(e.target.checked)} /> Skeleton face</label>
          </div>
        </section>
      </aside>
    </div>
  );
});

export default PoseStudioView as ForwardRefExoticComponent<PoseStudioProps & RefAttributes<unknown>>;
