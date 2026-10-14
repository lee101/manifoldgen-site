'use client';

import { BLEND_MODES, NO_CROP, TRANSITIONS, normalizeCrop, type StudioBlendMode, type StudioCrop, type StudioTransition, type StudioTransitionType } from '../../lib/studio-composite';
import styles from './production.module.css';

export type CompositePatch = { opacity?: number; blendMode?: StudioBlendMode; crop?: StudioCrop; transition?: StudioTransition };

export function CompositeControls({ opacity = 1, blend = 'normal', crop, transition, hasPrevious, maxTransition, onChange, compact }: {
  opacity?: number;
  blend?: StudioBlendMode;
  crop?: StudioCrop;
  transition?: StudioTransition;
  hasPrevious: boolean;
  maxTransition: number;
  onChange: (patch: CompositePatch, key: string) => void;
  compact?: boolean;
}) {
  const box = crop || NO_CROP;
  return <div className={styles.stack} data-testid="composite-controls">
    <label className={styles.row}><span><b>Opacity</b><output>{Math.round(opacity * 100)}%</output></span><input data-testid="composite-opacity" type="range" min="0" max="1" step="0.01" value={opacity} onChange={(event) => onChange({ opacity: Number(event.target.value) }, 'opacity')} /></label>
    <label className={styles.row}><span><b>Blend</b></span><select className={styles.select} data-testid="composite-blend" value={blend} onChange={(event) => onChange({ blendMode: event.target.value as StudioBlendMode }, 'blend')}>{BLEND_MODES.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}</select></label>
    {!compact && <details className={styles.section} open={!!crop || undefined}>
      <summary>CROP{crop ? <small>on</small> : null}</summary>
      <div className={styles.body}>
        <div className={styles.grid2}>{(['left', 'right', 'top', 'bottom'] as const).map((side) => <label key={side} className={styles.row}><span><b>{side[0].toUpperCase() + side.slice(1)}</b><output>{Math.round(box[side] * 100)}%</output></span><input data-testid={`composite-crop-${side}`} type="range" min="0" max="0.9" step="0.005" value={box[side]} onChange={(event) => { const next = normalizeCrop({ ...box, [side]: Number(event.target.value) }); onChange({ crop: next.left || next.top || next.right || next.bottom ? next : undefined }, `crop-${side}`); }} /></label>)}</div>
        {crop && <button type="button" className={styles.chip} onClick={() => onChange({ crop: undefined }, 'crop-reset')}>Reset crop</button>}
      </div>
    </details>}
    {!compact && <details className={styles.section} open={!!transition || undefined}>
      <summary>TRANSITION IN{transition ? <small>{transition.duration.toFixed(1)}s</small> : null}</summary>
      <div className={styles.body}>
        <select className={styles.select} data-testid="composite-transition" value={transition?.type || ''} onChange={(event) => onChange({ transition: event.target.value ? { type: event.target.value as StudioTransitionType, duration: Math.min(transition?.duration ?? 1, maxTransition) } : undefined }, 'transition')}>
          <option value="">None</option>
          {TRANSITIONS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {transition && <label className={styles.row}><span><b>Duration</b><output>{transition.duration.toFixed(1)}s</output></span><input type="range" min="0.1" max={Math.max(0.1, maxTransition)} step="0.1" value={Math.min(transition.duration, maxTransition)} onChange={(event) => onChange({ transition: { ...transition, duration: Number(event.target.value) } }, 'transition-duration')} /></label>}
        <p className={styles.hint}>{hasPrevious ? 'Blends from the previous clip on this track, centered on the cut.' : 'No clip directly before this one: plays as an intro from transparent.'}</p>
      </div>
    </details>}
  </div>;
}
