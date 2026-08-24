'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Check, Search } from 'lucide-react';
import styles from './page.module.css';

import type { ToolCard } from '@/lib/tools-catalog';

export default function ToolsIndex({ tools }: { tools: readonly ToolCard[] }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter((tool) => `${tool.name} ${tool.label} ${tool.copy} ${tool.meta}`.toLowerCase().includes(q));
  }, [tools, query]);

  return <>
    <section className={styles.intro}>
      <p>TOOLS / {tools.length}</p>
      <h1>One focused space<br />for every creative job.</h1>
      <span>Every card below shows a real output from the tool—not a stock placeholder.</span>
      <label className={styles.search}>
        <Search size={15} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools — relight, upscale, FLUX…"
          aria-label="Search tools"
          data-testid="tools-search"
        />
      </label>
    </section>
    <section className={styles.grid}>
      {filtered.map((tool, index) => <Link key={tool.href} href={tool.href} className={`${styles.card} ${index === 0 && !query ? styles.featured : ''}`}>
        <div className={styles.media}>{tool.kind === 'video' ? <video src={tool.src} muted autoPlay loop playsInline /> : <img src={tool.src} alt={`${tool.name} real output`} loading="lazy" />}
          <span className={styles.real}><Check size={11} /> REAL OUTPUT</span>
        </div>
        <div className={styles.copy}><small>{tool.label}</small><h2>{tool.name}</h2><p>{tool.copy}</p><footer><span>{tool.meta}</span><ArrowUpRight size={18} /></footer></div>
      </Link>)}
      {filtered.length === 0 ? <p className={styles.empty} data-testid="tools-empty">No tool matches “{query}”.</p> : null}
    </section>
  </>;
}
