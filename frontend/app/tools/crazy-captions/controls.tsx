'use client';

import type { ReactNode } from 'react';
import styles from './crazy-captions.module.css';

export function Section({ title, hint, open, children }: { title: string; hint?: string; open?: boolean; children: ReactNode }) {
  return <details className={styles.section} open={open}>
    <summary>{title}{hint && <small>{hint}</small>}</summary>
    <div className={styles.sectionBody}>{children}</div>
  </details>;
}

export function Slider({ label, value, min, max, step = 0.01, onChange, format }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void; format?: (value: number) => string;
}) {
  return <label className={styles.row}>
    <span><b>{label}</b><output>{format ? format(value) : step >= 1 ? Math.round(value) : value.toFixed(2)}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

export function Select<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return <label className={styles.row}>
    <span><b>{label}</b></span>
    <select value={String(value)} onChange={(event) => { const next = options.find((option) => String(option.value) === event.target.value); if (next) onChange(next.value); }}>
      {options.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
    </select>
  </label>;
}

export function Segments<T extends string | number>({ label, value, options, onChange }: {
  label?: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  return <div className={styles.row}>
    {label && <span><b>{label}</b></span>}
    <div className={styles.segments}>
      {options.map((option) => <button key={String(option.value)} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div>
  </div>;
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className={styles.toggle}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

export function ColorField({ label, value, onChange, clearable }: { label: string; value: string; onChange: (value: string) => void; clearable?: boolean }) {
  const shown = toHex(value);
  const valid = /^#[0-9a-f]{6}$/i.test(shown);
  return <div className={styles.colorRow}>
    <b>{label}</b>
    <span>
      {clearable && value && <button type="button" className={styles.miniButton} onClick={() => onChange('')}>auto</button>}
      <input type="color" aria-label={label} value={valid ? shown : '#ffffff'} onChange={(event) => onChange(event.target.value)} data-empty={!value || undefined} />
    </span>
  </div>;
}

function toHex(value: string) {
  const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return value;
  return `#${[match[1], match[2], match[3]].map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
}
