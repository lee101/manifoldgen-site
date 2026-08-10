'use client';

import { useId } from 'react';
import styles from './manifold-loader.module.css';

type ManifoldLoaderProps = {
  progress?: number | null;
  label?: string;
  compact?: boolean;
};

const contourRows = Array.from({ length: 19 }, (_, index) => {
  const offset = (index - 9) * 5.7;
  return {
    delay: `${-index * 0.19}s`,
    d: [
      `M -12 ${133 + offset}`,
      `C 22 ${96 + offset}, 46 ${119 + offset}, 68 ${88 + offset}`,
      `C 85 ${64 + offset}, 92 ${45 + offset}, 104 ${47 + offset}`,
      `C 123 ${51 + offset}, 128 ${103 + offset}, 160 ${119 + offset}`,
      `C 192 ${103 + offset}, 197 ${51 + offset}, 216 ${47 + offset}`,
      `C 228 ${45 + offset}, 235 ${64 + offset}, 252 ${88 + offset}`,
      `C 274 ${119 + offset}, 298 ${96 + offset}, 332 ${133 + offset}`,
    ].join(' '),
  };
});

export function ManifoldLoader({ progress = null, label = 'Working', compact = false }: ManifoldLoaderProps) {
  const id = useId().replace(/:/g, '');
  const determinate = typeof progress === 'number' && Number.isFinite(progress);
  const normalizedProgress = determinate ? Math.max(0, Math.min(1, progress)) : 0.28;

  return <div className={`${styles.loader} ${compact ? styles.compact : ''}`} role="status" aria-live="polite" aria-label={label}>
    <div className={styles.surface} aria-hidden="true">
      <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.12" stopColor="white" stopOpacity="0.68" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.98" />
            <stop offset="0.88" stopColor="white" stopOpacity="0.68" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`${id}-glow`} cx="50%" cy="48%" r="52%">
            <stop stopColor="white" stopOpacity="0.1" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="220" fill={`url(#${id}-glow)`} />
        <g className={styles.contours} stroke={`url(#${id}-fade)`}>
          {contourRows.map((row, index) => <path key={index} d={row.d} style={{ animationDelay: row.delay }} />)}
        </g>
      </svg>
    </div>
    <div className={styles.meta}>
      <span>{label}</span>
      {determinate && <output>{Math.round(normalizedProgress * 100)}%</output>}
    </div>
    <div className={styles.track} aria-hidden="true"><i className={determinate ? '' : styles.indeterminate} style={{ width: determinate ? `${normalizedProgress * 100}%` : undefined }} /></div>
  </div>;
}
