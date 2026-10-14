'use client';

import { useEffect, useRef, useState, type UIEvent } from 'react';
import { ArrowRight, Code2, Pause, Play } from 'lucide-react';
import { demoMedia, snippets, type ProductionRequest, type ProductionTool } from '@/lib/production-tools';
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
