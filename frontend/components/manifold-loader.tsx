'use client';

import styles from './manifold-loader.module.css';

type ManifoldLoaderProps = {
  progress?: number | null;
  label?: string;
  compact?: boolean;
};

const contourRows = Array.from({ length: 17 }, (_, index) => {
  const y = 190 - index * 8.6;
  const spread = 1 + index * 0.018;
  return {
    delay: `${-index * 0.19}s`,
    d: [
      `M -12 ${y + 35}`,
      `C 16 ${y + 34}, 29 ${y + 18}, 52 ${y - 29 * spread}`,
      `C 69 ${y - 64 * spread}, 80 ${y - 70 * spread}, 99 ${y - 27 * spread}`,
      `C 115 ${y + 10}, 128 ${y + 30}, 145 ${y - 9 * spread}`,
      `C 161 ${y - 47 * spread}, 174 ${y - 74 * spread}, 194 ${y - 52 * spread}`,
      `C 216 ${y - 26 * spread}, 234 ${y + 27}, 332 ${y + 35}`,
    ].join(' '),
  };
});

export function ManifoldLoader({ progress = null, label = 'Working', compact = false }: ManifoldLoaderProps) {
  const determinate = typeof progress === 'number' && Number.isFinite(progress);
  const normalizedProgress = determinate ? Math.max(0, Math.min(1, progress)) : 0.28;

  return <div className={`${styles.loader} ${compact ? styles.compact : ''}`} role="status" aria-live="polite" aria-label={label}>
    <div className={styles.surface} aria-hidden="true">
      <svg viewBox="0 0 320 220" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="manifold-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset="0.12" stopColor="white" stopOpacity="0.68" />
            <stop offset="0.5" stopColor="white" stopOpacity="0.98" />
            <stop offset="0.88" stopColor="white" stopOpacity="0.68" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="manifold-glow" cx="50%" cy="48%" r="52%">
            <stop stopColor="white" stopOpacity="0.1" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="320" height="220" fill="url(#manifold-glow)" />
        <g className={styles.contours} stroke="url(#manifold-fade)">
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
