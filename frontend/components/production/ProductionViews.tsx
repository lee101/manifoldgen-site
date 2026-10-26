'use client';

import { useEffect, useRef, useState, type UIEvent } from 'react';
import { ArrowRight, Code2, Link2, Pause, Play, Share2 } from 'lucide-react';
import { demoMedia, formatFightStats, snippets, type ProductionRequest, type ProductionTool } from '@/lib/production-tools';
import styles from './production.module.css';

export function SvgCompare({ original, svg }: { original: string; svg: string }) {
  const [zoom, setZoom] = useState(1);
  const left = useRef<HTMLDivElement>(null);
  const right = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  function sync(event: UIEvent<HTMLDivElement>) {
    if (syncing.current) { syncing.current = false; return; }
    const source = event.currentTarget;
    const target = source === left.current ? right.current : left.current;
    if (!target) return;
    syncing.current = true;
    target.scrollLeft = source.scrollLeft;
    target.scrollTop = source.scrollTop;
  }
  return <div className={styles.resultBody}>
    <div className={styles.compare}>
      <div className={styles.comparePane}><span>ORIGINAL</span><div ref={left} className={styles.zoomBox} onScroll={sync}><img src={original} alt="Original raster" style={{ width: `${zoom * 100}%` }} /></div></div>
      <div className={styles.comparePane}><span>SVG</span><div ref={right} className={styles.zoomBox} onScroll={sync}><img data-testid="svg-result" src={svg} alt="Vectorized SVG" style={{ width: `${zoom * 100}%` }} /></div></div>
    </div>
    <label className={styles.zoomBar}>ZOOM<input className={styles.range} type="range" min={1} max={8} step={0.5} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />{zoom}×</label>
  </div>;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function BeforeAfter({ before, after, aspect }: { before: string; after: string; aspect: number }) {
  const beforeRef = useRef<HTMLVideoElement>(null);
  const afterRef = useRef<HTMLVideoElement>(null);
  const [wipe, setWipe] = useState(50);
  const [time, setTime] = useState(0);
  const [length, setLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  function toggle() {
    const a = afterRef.current; const b = beforeRef.current;
    if (!a || !b) return;
    if (a.paused) { b.currentTime = a.currentTime; void a.play(); void b.play().catch(() => {}); setPlaying(true); }
    else { a.pause(); b.pause(); setPlaying(false); }
  }
  function seek(value: number) {
    if (afterRef.current) afterRef.current.currentTime = value;
    if (beforeRef.current) beforeRef.current.currentTime = value;
    setTime(value);
  }
  function follow() {
    const a = afterRef.current; const b = beforeRef.current;
    if (!a || !b) return;
    setTime(a.currentTime);
    if (Math.abs(b.currentTime - a.currentTime) > 0.12) b.currentTime = a.currentTime;
  }
  return <div className={styles.resultBody}>
    <div className={styles.wipe} style={{ aspectRatio: String(aspect || 16 / 9) }}>
      <video ref={beforeRef} src={before} muted playsInline preload="auto" />
      <video ref={afterRef} data-testid="cleanup-result" src={after} playsInline preload="auto" loop style={{ clipPath: `inset(0 0 0 ${wipe}%)` }}
        onTimeUpdate={follow} onLoadedMetadata={(event) => setLength(event.currentTarget.duration || 0)}
        onPause={() => { beforeRef.current?.pause(); setPlaying(false); }} onSeeked={follow} />
      <div className={styles.wipeLine} style={{ left: `${wipe}%` }} />
      <span className={styles.wipeTag} style={{ left: 8 }}>BEFORE</span>
      <span className={styles.wipeTag} style={{ right: 8 }}>AFTER</span>
    </div>
    <div className={styles.wipeControls}>
      <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
      <input className={styles.range} type="range" aria-label="Scrub" min={0} max={length || 1} step={0.01} value={Math.min(time, length || 1)} onChange={(event) => seek(Number(event.target.value))} />
      <span>{formatTime(time)} / {formatTime(length)}</span>
    </div>
    <label className={styles.wipeSlider}>WIPE<input className={styles.range} type="range" min={0} max={100} value={wipe} onChange={(event) => setWipe(Number(event.target.value))} />{wipe}%</label>
  </div>;
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return <div className={styles.code}>
    <div className={styles.codeLabel}>{label}</div>
    <pre><code>{code}</code></pre>
    <button type="button" onClick={() => { void navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400); }); }}>{copied ? 'Copied' : 'Copy'}</button>
  </div>;
}

export function ApiPanel({ request, tool }: { request: ProductionRequest; tool: ProductionTool }) {
  const code = snippets(request, tool.mcp);
  return <details className={styles.api}>
    <summary><Code2 size={14} /> Use via API / MCP</summary>
    <div className={styles.apiBody}>
      <CodeBlock label="REST · curl" code={code.curl} />
      <CodeBlock label={`MCP tool · ${tool.mcp}`} code={code.mcp} />
      <CodeBlock label="CLI" code={code.cli} />
      <div className={styles.hint}>Upload local files with the MCP <code>create_upload</code> tool, then poll with <code>wait_for_job</code>. <a href="/tools/production" style={{ color: '#c5a7ff' }}>MCP setup</a> · <a href="/api#production" style={{ color: '#c5a7ff' }}>API docs</a></div>
    </div>
  </details>;
}

const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);

function DemoMediaEl({ url, poster, onFail, alt }: { url: string; poster?: string; onFail: () => void; alt: string }) {
  return isVideo(url)
    ? <video src={url} poster={poster} muted loop autoPlay playsInline preload="metadata" onError={onFail} />
    : <img src={url} alt={alt} loading="lazy" onError={onFail} />;
}

export function DemoGallery({ tool }: { tool: ProductionTool }) {
  const [failed, setFailed] = useState<Set<number>>(() => new Set());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || failed.size >= tool.demos.length) return null;
  const fail = (index: number) => setFailed((current) => new Set(current).add(index));
  return <section className={styles.demos} data-testid="production-demos">
    <h2>Examples</h2>
    <div className={styles.demoGrid}>
      {tool.demos.map((demo, index) => {
        if (failed.has(index)) return null;
        const media = demoMedia(tool, index);
        return <figure key={index} className={styles.demoCard} style={{ margin: 0 }}>
          <div className={styles.demoPair}>
            <DemoMediaEl url={media.input} alt={`${demo.caption} input`} onFail={() => fail(index)} />
            <ArrowRight size={16} />
            <DemoMediaEl url={media.output} poster={media.poster} alt={`${demo.caption} output`} onFail={() => fail(index)} />
          </div>
          <p>{demo.caption}</p>
        </figure>;
      })}
    </div>
  </section>;
}


export function ShareRow({ url, title, page }: { url: string; title: string; page: string }) {
  const [note, setNote] = useState('');
  const text = `${title} ${page}`;
  const say = (message: string) => { setNote(message); setTimeout(() => setNote(''), 2200); };
  async function share() {
    try {
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (!nav.share) { await navigator.clipboard?.writeText(url); say('Link copied'); return; }
      try {
        const blob = await (await fetch(url)).blob();
        const file = new File([blob], 'manifoldgen.mp4', { type: blob.type || 'video/mp4' });
        if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title, text }); return; }
      } catch { /* cross-origin or too large: share the link instead */ }
      await nav.share({ title, text, url });
    } catch { /* cancelled */ }
  }
  const links: [string, string][] = [
    ['X', `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`],
    ['Reddit', `https://www.reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`],
    ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`],
  ];
  return <div className={styles.actions} data-testid="share-row" style={{ marginTop: 6 }}>
    <button type="button" className={`${styles.action} ${styles.actionPrimary}`} onClick={() => void share()}><Share2 size={13} /> Share</button>
    <button type="button" className={styles.action} onClick={() => { void navigator.clipboard?.writeText(url).then(() => say('Link copied'), () => say('Copy failed')); }}><Link2 size={13} /> Copy link</button>
    {links.map(([label, href]) => <a key={label} className={styles.action} href={href} target="_blank" rel="noreferrer">{label}</a>)}
    {note && <span className={styles.hint} role="status">{note}</span>}
  </div>;
}

export function FightStatsCard({ stats, names = [] }: { stats: unknown; names?: readonly string[] }) {
  const view = formatFightStats(stats, names);
  if (!view) return null;
  const { rows, totals } = view;
  return <section className={styles.stats} data-testid="fight-stats" aria-label="Fight stats">
    <header className={styles.statsHead}>
      <b>Fight stats</b>
      <span>{totals.strikes} strikes · {totals.impacts} hits{totals.bpm ? ` · ${totals.bpm} BPM` : ''} · peak at {totals.peakAt} s</span>
    </header>
    <div className={styles.statsRows} role="table" aria-label="Per fighter stats">
      <div className={`${styles.statsRow} ${styles.statsLabels}`} role="row">
        <span role="columnheader">Fighter</span><span role="columnheader">Strikes</span><span role="columnheader">Hits</span><span role="columnheader">Taken</span>
        <span role="columnheader">Power</span><span role="columnheader">Top speed</span><span role="columnheader">Combo</span>
      </div>
      {rows.map((row) => <div key={row.id} className={styles.statsRow} role="row" data-testid={`fight-stats-row-${row.id}`} data-active={row.mostActive || undefined}>
        <span role="cell" className={styles.statsName}>{row.label}{row.mostActive && <i>most active</i>}</span>
        <span role="cell" data-label="Strikes">{row.strikes}</span><span role="cell" data-label="Hits">{row.impacts}</span><span role="cell" data-label="Taken">{row.hitsTaken}</span>
        <span role="cell" data-label="Power">{row.avgPower}</span><span role="cell" data-label="Top speed">{row.topSpeed}</span><span role="cell" data-label="Combo">{row.bestCombo}</span>
      </div>)}
    </div>
  </section>;
}
