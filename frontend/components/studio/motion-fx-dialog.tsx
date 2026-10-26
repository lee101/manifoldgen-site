'use client';

import { Film, Sparkles } from 'lucide-react';
import {
  MOTION_ASPECTS, MOTION_INTENSITY, MOTION_PALETTES, STUDIO_MOTION_PRESETS, formatUSD, motionRule, quoteMotion,
  type MotionOptions, type MotionWindow,
} from '../../lib/studio-motion';
import styles from './motion-fx.module.css';

const PALETTE_LABELS: Record<string, string> = { 'gold-blue': 'Gold & blue', fire: 'Fire', neon: 'Neon', ice: 'Ice' };
type Toggle = 'slowmo' | 'sfx' | 'text';
const TOGGLES: { key: Toggle; label: string }[] = [
  { key: 'slowmo', label: 'Slow-mo on big hits' },
  { key: 'sfx', label: 'Impact sounds' },
  { key: 'text', label: 'Comic hit text' },
];

const triValue = (value: boolean | undefined) => (value === undefined ? '' : value ? 'on' : 'off');
const triParse = (value: string) => (value === '' ? undefined : value === 'on');

export function MotionFxDialog({ sourceName, window: win, options, onChange, onRun, busy, blocker }: {
  sourceName: string;
  window: MotionWindow;
  options: MotionOptions;
  onChange: (patch: Partial<MotionOptions>) => void;
  onRun: () => void;
  busy: boolean;
  blocker: string;
}) {
  const rule = motionRule('motion-fx');
  const price = quoteMotion('motion-fx', win.seconds);
  return <div className={styles.dialog} data-testid="motion-fx-dialog">
    <div className={styles.source}>
      <Film size={16} />
      <span><small>SOURCE CLIP</small><b>{sourceName}</b></span>
    </div>
    {win.truncated && <p className={styles.warning} data-testid="motion-warning">Motion FX processes up to {win.seconds} seconds from the start of the file. The rest of this clip is left out of the result.</p>}
    {!win.truncated && win.offsetStart && <p className={styles.warning} data-testid="motion-warning">This clip is trimmed. Motion FX renders from the start of the file through the end of your trim ({win.seconds} s), so the result is longer than the trimmed clip.</p>}

    <fieldset className={styles.presets} role="radiogroup" aria-label="Effect">
      <legend className={styles.label}>EFFECT</legend>
      {STUDIO_MOTION_PRESETS.map((preset) => {
        const active = options.preset === preset.id;
        return <button
          key={preset.id}
          type="button"
          role="radio"
          aria-checked={active}
          data-testid={`motion-preset-${preset.id}`}
          className={`${styles.preset} ${active ? styles.presetActive : ''}`}
          onClick={() => onChange({ preset: preset.id })}
        ><b>{preset.label}</b><small>{preset.blurb}</small></button>;
      })}
    </fieldset>

    <div className={styles.grid}>
      <label className={`${styles.field} ${styles.wide}`}>
        <span>Intensity<output>{options.intensity.toFixed(1)}×</output></span>
        <input data-testid="motion-intensity" type="range" min={MOTION_INTENSITY.min} max={MOTION_INTENSITY.max} step={MOTION_INTENSITY.step} value={options.intensity} onChange={(event) => onChange({ intensity: Number(event.target.value) })} />
      </label>
      <label className={styles.field}>
        <span>Color palette</span>
        <select data-testid="motion-palette" value={options.palette} onChange={(event) => onChange({ palette: event.target.value })}>
          <option value="">Preset default</option>
          {MOTION_PALETTES.map((palette) => <option key={palette} value={palette}>{PALETTE_LABELS[palette]}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span>Reframe</span>
        <select data-testid="motion-aspect" value={options.aspect ?? ''} onChange={(event) => onChange({ aspect: event.target.value || undefined })}>
          <option value="">Keep source</option>
          {MOTION_ASPECTS.map((aspect) => <option key={aspect} value={aspect}>{aspect}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span>Fighter names</span>
        <input data-testid="motion-names" type="text" maxLength={80} value={options.names} placeholder="Sensei, Rival" onChange={(event) => onChange({ names: event.target.value })} />
      </label>
      {TOGGLES.map((toggle) => <label key={toggle.key} className={styles.field}>
        <span>{toggle.label}</span>
        <select data-testid={`motion-${toggle.key}`} value={triValue(options[toggle.key])} onChange={(event) => onChange({ [toggle.key]: triParse(event.target.value) })}>
          <option value="">Preset default</option>
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </label>)}
      <p className={`${styles.hint} ${styles.wide}`}>Pose tracking finds every person in the clip, so use a shot where fighters are fully visible. Reframing follows the action and creates a new clip in Media; the project canvas does not change. The result keeps its own sound.</p>
    </div>

    <div className={styles.footer}>
      <div className={styles.quote} data-testid="motion-quote">
        <b>{formatUSD(price)}</b>
        <small>{win.seconds} s × {formatUSD(rule.rate)} · minimum {formatUSD(rule.min)}</small>
      </div>
      <button type="button" className={styles.run} data-testid="motion-run" disabled={busy || !!blocker} onClick={onRun}>
        <Sparkles size={15} />{busy ? 'Starting…' : 'Add Motion FX'}
      </button>
    </div>
    {blocker && <p className={styles.blocker} role="alert" data-testid="motion-blocker">{blocker}</p>}
  </div>;
}
