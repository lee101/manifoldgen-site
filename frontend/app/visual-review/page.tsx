'use client';

import { useState } from 'react';
import { ManifoldLoader } from '../../components/manifold-loader';

export default function ManifoldLoaderReviewPage() {
  const [progress, setProgress] = useState(0.42);

  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#050505', color: '#f5f5f4', fontFamily: 'var(--font-sans, Arial, sans-serif)' }}>
    <section style={{ width: 'min(100%, 520px)' }}>
      <p style={{ margin: '0 0 10px', color: '#aaa', fontSize: 12, fontWeight: 700, letterSpacing: '.12em' }}>VISUAL REVIEW · MANIFOLD LOADER</p>
      <h1 style={{ margin: '0 0 10px', fontSize: 30, letterSpacing: '-.04em' }}>A moving surface, not a spinner.</h1>
      <p style={{ margin: '0 0 28px', color: '#aaa', fontSize: 15, lineHeight: 1.5 }}>The contour surface echoes the existing Manifold mark: two peaks, a soft central valley, and a slow drift that stays out of the way.</p>
      <ManifoldLoader progress={progress} label="Exporting your timeline" />
      <label style={{ display: 'grid', gap: 10, marginTop: 34, color: '#bbb', fontSize: 13 }}>
        Preview progress <output style={{ color: 'white' }}>{Math.round(progress * 100)}%</output>
        <input type="range" min="0" max="1" step="0.01" value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 34, paddingTop: 22, borderTop: '1px solid #202020' }}>
        <span style={{ color: '#aaa', fontSize: 13 }}>Compact background activity</span>
        <ManifoldLoader compact label="Exporting" />
      </div>
    </section>
  </main>;
}
