'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pipette, Trash2 } from 'lucide-react';
import { FX_BY_TYPE, FX_DEFINITIONS, createFxLayer, type FxControl, type StudioFxLayer, type StudioFxType } from '../../lib/studio-fx/registry';
import styles from './production.module.css';

const GROUPS = ['Motion', 'Distort', 'Stylize', 'Light', 'Retro', 'Key'] as const;

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((value) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join('')}`;
const fromHex = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255);

export type FxStackProps = {
  layers: StudioFxLayer[];
  onChange: (layers: StudioFxLayer[], key: string) => void;
  onPickColor?: (apply: (hex: string) => void) => void;
};

export function FxStack({ layers, onChange, onPickColor }: FxStackProps) {
  const [openID, setOpenID] = useState<string>(layers[layers.length - 1]?.id || '');
  const patchLayer = (id: string, patch: Partial<StudioFxLayer>, key: string) => onChange(layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)), key);
  const setParams = (layer: StudioFxLayer, params: Record<string, number>, key: string) => patchLayer(layer.id, { params: { ...layer.params, ...params } }, `${layer.id}:${key}`);
  const move = (index: number, delta: number) => {
    const next = [...layers];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next, 'fx-order');
  };
  const add = (type: StudioFxType) => {
    const layer = createFxLayer(type);
    setOpenID(layer.id);
    onChange([...layers, layer], 'fx-add');
  };
  const control = (layer: StudioFxLayer, item: FxControl) => {
    if ('color' in item) {
      const [r, g, b] = item.color;
      const hex = toHex(layer.params[r], layer.params[g], layer.params[b]);
      const apply = (value: string) => { const [nr, ng, nb] = fromHex(value); setParams(layer, { [r]: nr, [g]: ng, [b]: nb }, 'color'); };
      return <div key={item.label} className={styles.colorRow}><b style={{ color: '#bfc4cc', fontWeight: 600 }}>{item.label}</b><span className={styles.inline}><input type="color" aria-label={item.label} value={hex} onChange={(event) => apply(event.target.value)} />{onPickColor && <button type="button" className={styles.chip} aria-label="Pick key color from stage" onClick={() => onPickColor(apply)}><Pipette size={11} /></button>}</span></div>;
    }
    if ('options' in item) {
      return <div key={item.key} className={styles.row}><span><b>{item.label}</b></span><div className={styles.segments}>{item.options.map((option, index) => <button type="button" key={option} aria-pressed={Math.round(layer.params[item.key] ?? 0) === index} onClick={() => setParams(layer, { [item.key]: index }, item.key)}>{option}</button>)}</div></div>;
    }
    const value = layer.params[item.key] ?? FX_BY_TYPE[layer.type].defaults[item.key] ?? 0;
    return <label key={item.key} className={styles.row}><span><b>{item.label}</b><output>{item.step >= 1 ? Math.round(value) : value.toFixed(item.step < 0.01 ? 3 : 2)}</output></span><input type="range" min={item.min} max={item.max} step={item.step} value={value} onChange={(event) => setParams(layer, { [item.key]: Number(event.target.value) }, item.key)} /></label>;
  };
  return <div className={styles.stack} data-testid="fx-stack">
    <select className={styles.select} data-testid="fx-add" aria-label="Add effect" value="" onChange={(event) => { if (event.target.value) add(event.target.value as StudioFxType); }}>
      <option value="">+ Add effect…</option>
      {GROUPS.map((group) => <optgroup key={group} label={group}>{FX_DEFINITIONS.filter((definition) => definition.group === group).map((definition) => <option key={definition.type} value={definition.type}>{definition.label}</option>)}</optgroup>)}
    </select>
    {!layers.length && <p className={styles.empty}>Stack GPU effects. Applied top to bottom.</p>}
    {layers.map((layer, index) => {
      const definition = FX_BY_TYPE[layer.type];
      const open = openID === layer.id;
      return <div key={layer.id} className={styles.layer} data-testid={`fx-layer-${layer.type}`}>
        <div className={styles.layerHead}>
          <input type="checkbox" aria-label={`Enable ${definition.label}`} checked={layer.enabled} onChange={(event) => patchLayer(layer.id, { enabled: event.target.checked }, `${layer.id}:enabled`)} />
          <button type="button" className={styles.layerName} aria-expanded={open} onClick={() => setOpenID(open ? '' : layer.id)}>{definition.label}<small>{Math.round((layer.params.mix ?? 1) * 100)}%</small></button>
          <span className={styles.layerTools}>
            <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ChevronUp size={13} /></button>
            <button type="button" aria-label="Move down" disabled={index === layers.length - 1} onClick={() => move(index, 1)}><ChevronDown size={13} /></button>
            <button type="button" aria-label={`Remove ${definition.label}`} onClick={() => onChange(layers.filter((item) => item.id !== layer.id), 'fx-remove')}><Trash2 size={12} /></button>
          </span>
        </div>
        {open && <div className={styles.layerBody}>
          {definition.controls.map((item) => control(layer, item))}
          <label className={styles.row}><span><b>Mix</b><output>{Math.round((layer.params.mix ?? 1) * 100)}%</output></span><input type="range" min="0" max="1" step="0.01" value={layer.params.mix ?? 1} onChange={(event) => setParams(layer, { mix: Number(event.target.value) }, 'mix')} /></label>
        </div>}
      </div>;
    })}
  </div>;
}
