'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, UserRound } from 'lucide-react';
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
    <header className={styles.bar}>
      <Link href="/" className={styles.brand}>ManifoldGen</Link>
      <label className={styles.search}>
        <Search size={15} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search tools"
          aria-label="Search tools"
          data-testid="tools-search"
          autoFocus
        />
        <span className={styles.count}>{filtered.length}</span>
      </label>
      <Link href="/account" className={styles.account} aria-label="Account"><UserRound size={19} /></Link>
    </header>
    <h1 className={styles.srOnly}>AI creative tools</h1>
    <section className={styles.grid}>
      {filtered.map((tool) => <Link key={tool.href} href={tool.href} className={`${styles.card} ${tool.layout ? styles[tool.layout] : ''}`}>
        {tool.kind === 'video'
          ? <video src={tool.src} muted autoPlay loop playsInline preload="metadata" />
          : <img src={tool.src} alt={`${tool.name} real output`} loading="lazy" />}
        <span className={styles.tag}>{tool.label}</span>
        <div className={styles.copy}>
          <h2>{tool.name}</h2>
          <p>{tool.copy}</p>
          <small>{tool.meta}</small>
        </div>
      </Link>)}
      {filtered.length === 0 ? <p className={styles.empty} data-testid="tools-empty">No tool matches “{query}”.</p> : null}
    </section>
  </>;
}
