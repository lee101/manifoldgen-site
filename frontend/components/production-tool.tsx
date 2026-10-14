'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clapperboard, Eye, Film, ImageDown, Loader2, Pause, Play, Sparkles, Upload } from 'lucide-react';
import { DEFAULT_ADJUSTMENTS, StudioRenderer, type StudioAdjustments } from '@/lib/studio-renderer';
import { samplePixels, type StudioLUT, type StudioNumericAdjustments } from '@/lib/studio-grade';
import { fxAnimated, type StudioFxLayer } from '@/lib/studio-fx/registry';
import { galleryProxyURL } from '@/lib/studio-media-drag';
import { putStudioHandoff } from '@/lib/studio-handoff';
import { GradeControls } from '@/components/studio/grade-controls';
import { FxStack } from '@/components/studio/fx-stack';
import controlStyles from '@/components/studio/production.module.css';
import styles from './production-tool.module.css';

type Mode = 'grade' | 'fx';
type Source = { file: File; kind: 'image' | 'video'; url: string; width: number; height: number; duration: number };

const BASICS: { key: keyof StudioNumericAdjustments; label: string; min: number; max: number }[] = [
  { key: 'exposure', label: 'Exposure', min: -2, max: 2 },
  { key: 'contrast', label: 'Contrast', min: -0.8, max: 1 },
  { key: 'saturation', label: 'Saturation', min: -1, max: 1 },
  { key: 'temperature', label: 'Temperature', min: -1, max: 1 },
  { key: 'tint', label: 'Tint', min: -1, max: 1 },
  { key: 'highlights', label: 'Highlights', min: -1, max: 1 },
  { key: 'shadows', label: 'Shadows', min: -1, max: 1 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 1 },
  { key: 'grain', label: 'Grain', min: 0, max: 1 },
];

const COPY: Record<Mode, { name: string; label: string; lede: string }> = {
  grade: { name: 'Color Grade', label: 'COLOR GRADING', lede: 'Lift/gamma/gain wheels, curves, .cube LUTs, reference matching and film looks. Runs on your GPU, nothing uploads.' },
  fx: { name: 'Shader FX', label: 'GPU EFFECTS', lede: 'Stack feedback, kaleidoscope, glitch, CRT, VHS, bloom and keying effects on any image or video. Runs locally, free.' },
};

function fit(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(2, Math.round(width * scale / 2) * 2), height: Math.max(2, Math.round(height * scale / 2) * 2) };
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function sampleFile() {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const context = canvas.getContext('2d')!;
  const sky = context.createLinearGradient(0, 0, 0, 720);
  sky.addColorStop(0, '#1b3b6f');
  sky.addColorStop(0.55, '#f2a65a');
  sky.addColorStop(1, '#3b1f2b');
  context.fillStyle = sky;
  context.fillRect(0, 0, 1280, 720);
  context.fillStyle = '#ffe3a3';
  context.beginPath();
  context.arc(860, 380, 90, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#1d1a24';
  context.beginPath();
  context.moveTo(0, 720);
  [[0, 520], [180, 430], [360, 500], [560, 380], [760, 520], [980, 450], [1280, 540], [1280, 720]].forEach(([x, y]) => context.lineTo(x, y));
  context.fill();
  ['#e84a5f', '#2ec4b6', '#ffd166', '#5f6caf'].forEach((color, index) => {
    context.fillStyle = color;
    context.fillRect(80 + index * 120, 600, 100, 80);
  });
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
  return new File([blob], 'sample.png', { type: 'image/png' });
}

async function loadSource(file: File): Promise<Source> {
  const url = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('This video cannot be played in your browser'));
    });
    return { file, kind: 'video', url, width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  }
  if (!file.type.startsWith('image/')) throw new Error('Choose an image or video');
  const image = new Image();
  image.src = url;
  await image.decode();
  return { file, kind: 'image', url, width: image.naturalWidth, height: image.naturalHeight, duration: 5 };
}

export function ProductionTool({ mode }: { mode: Mode }) {
  const copy = COPY[mode];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const rendererRef = useRef<StudioRenderer | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [adjustments, setAdjustments] = useState<StudioAdjustments>({ ...DEFAULT_ADJUSTMENTS });
  const [luts, setLuts] = useState<Record<string, StudioLUT>>({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [compare, setCompare] = useState(false);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const lut = adjustments.lutID ? luts[adjustments.lutID] || null : null;
  const stateRef = useRef({ adjustments, lut, compare, source });
  stateRef.current = { adjustments, lut, compare, source };
  const startRef = useRef(performance.now());

  const choose = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError('');
    if (file.size > 1024 * 1024 * 1024) {
      setError('Files up to 1 GB');
      return;
    }
    try {
      const next = await loadSource(file);
      setSource((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return next;
      });
      setPlaying(false);
      setTime(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open that file');
    }
  }, []);

  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('src')?.trim();
    if (!src) return;
    let parsed: URL;
    try {
      parsed = new URL(src, window.location.origin);
    } catch {
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.origin !== window.location.origin) return;
    setNotice('Loading media…');
    fetch(galleryProxyURL(parsed.href))
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load that media URL');
        const blob = await response.blob();
        const name = decodeURIComponent(parsed.pathname.split('/').pop() || 'media');
        await choose(new File([blob], name, { type: blob.type || (/\.(mp4|webm|mov)$/i.test(name) ? 'video/mp4' : 'image/png') }));
        setNotice('');
      })
      .catch((reason) => { setNotice(''); setError(reason instanceof Error ? reason.message : 'Could not load that media URL'); });
  }, [choose]);

  const draw = useCallback(() => {
    const renderer = rendererRef.current;
    const { adjustments: current, lut: currentLUT, compare: showOriginal, source: currentSource } = stateRef.current;
    if (!renderer || !currentSource) return;
    const media = currentSource.kind === 'video' ? videoRef.current : imageRef.current;
    if (!media || (media instanceof HTMLVideoElement && media.readyState < 2)) return;
    const size = fit(currentSource.width, currentSource.height, 1600);
    renderer.resize(size.width, size.height);
    const clock = media instanceof HTMLVideoElement ? media.currentTime : (performance.now() - startRef.current) / 1000;
    renderer.draw(media, showOriginal ? DEFAULT_ADJUSTMENTS : current, clock * 24, { time: clock, lut: currentLUT, stateKey: 'tool' });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !source) return undefined;
    try {
      rendererRef.current = new StudioRenderer(canvas, { preserveDrawingBuffer: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'WebGL 2 is required');
      return undefined;
    }
    draw();
    return () => {
      rendererRef.current?.release();
      rendererRef.current = null;
    };
  }, [source, draw]);

  useEffect(() => { draw(); }, [adjustments, lut, compare, draw]);

  const animated = fxAnimated(adjustments.fx) || adjustments.glitchAmount > 0;
  useEffect(() => {
    if (!source || !(playing || (source.kind === 'image' && animated))) return undefined;
    let frame = 0;
    let lastUI = 0;
    const loop = (now: number) => {
      draw();
      if (now - lastUI > 120 && videoRef.current) {
        lastUI = now;
        setTime(videoRef.current.currentTime);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [source, playing, animated, draw]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || source?.kind !== 'video') return;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing, source]);

  const patch = useCallback((next: Partial<StudioAdjustments>) => setAdjustments((current) => ({ ...current, ...next })), []);
  const addLUT = useCallback((next: StudioLUT) => setLuts((current) => ({ ...current, [next.id]: next })), []);
  const sampleFrame = () => {
    const media = source?.kind === 'video' ? videoRef.current : imageRef.current;
    if (!source || !media) return null;
    return samplePixels(media, source.width, source.height);
  };
  const say = (message: string, isError = false) => {
    if (isError) setError(message);
    else {
      setError('');
      setNotice(message);
    }
  };
  const baseName = (source?.file.name || 'manifold').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'manifold';

  const exportPNG = () => {
    draw();
    canvasRef.current?.toBlob((blob) => { if (blob) saveBlob(blob, `${baseName}-${mode}.png`); }, 'image/png');
  };

  const exportMP4 = async () => {
    if (!source) return;
    setBusy('mp4');
    setProgress(0);
    setError('');
    setPlaying(false);
    const canvas = document.createElement('canvas');
    const renderer = new StudioRenderer(canvas, { preserveDrawingBuffer: true });
    const raster = document.createElement('canvas');
    const context = raster.getContext('2d', { alpha: false })!;
    const size = fit(source.width, source.height, 1920);
    renderer.resize(size.width, size.height);
    raster.width = canvas.width;
    raster.height = canvas.height;
    const { adjustments: current, lut: currentLUT } = stateRef.current;
    try {
      const { ALL_FORMATS, BlobSource, BufferTarget, CanvasSource, Conversion, Input, Mp4OutputFormat, Output, Quality, canEncodeVideo } = await import('mediabunny');
      if (!(await canEncodeVideo('avc', { width: raster.width, height: raster.height }))) throw new Error('This browser cannot encode MP4');
      const target = new BufferTarget();
      const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
      if (source.kind === 'video') {
        const input = new Input({ source: new BlobSource(source.file), formats: ALL_FORMATS });
        const conversion = await Conversion.init({
          input,
          output,
          showWarnings: false,
          video: {
            codec: 'avc',
            quality: new Quality('high'),
            forceTranscode: true,
            processedWidth: raster.width,
            processedHeight: raster.height,
            process: (sample) => {
              const frame = sample.toVideoFrame();
              renderer.draw(frame, current, sample.timestamp * 24, { time: sample.timestamp, lut: currentLUT, stateKey: 'export' });
              frame.close();
              renderer.copyToCanvas(context);
              return raster;
            },
          },
        });
        if (!conversion.isValid) throw new Error('This video cannot be re-encoded in your browser');
        conversion.onProgress = (fraction) => setProgress(Math.min(1, fraction));
        await conversion.execute();
        input.dispose();
      } else {
        const videoSource = new CanvasSource(raster, { codec: 'avc', quality: new Quality('high') });
        output.addVideoTrack(videoSource);
        await output.start();
        const image = imageRef.current!;
        const fps = 30;
        const frames = fps * 5;
        for (let index = 0; index < frames; index += 1) {
          const seconds = index / fps;
          renderer.draw(image, current, seconds * 24, { time: seconds, lut: currentLUT, stateKey: 'export' });
          renderer.copyToCanvas(context);
          await videoSource.add(seconds, 1 / fps, { keyFrame: index % 60 === 0 });
          setProgress((index + 1) / frames);
        }
        await output.finalize();
      }
      if (!target.buffer) throw new Error('Export produced no output');
      saveBlob(new Blob([target.buffer], { type: 'video/mp4' }), `${baseName}-${mode}.mp4`);
      setNotice('MP4 exported');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Export failed');
    } finally {
      renderer.release();
      setBusy('');
    }
  };

  const openInStudio = async () => {
    if (!source) return;
    setBusy('studio');
    try {
      const id = await putStudioHandoff(source.file, adjustments, lut);
      window.location.href = `/studio?handoff=${encodeURIComponent(id)}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open Studio');
      setBusy('');
    }
  };

  return <main className={styles.page}>
    <header className={styles.header}><Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link><div className={styles.brand}><Sparkles size={13} /> {copy.label}</div><Link href="/studio" className={styles.account}>Studio</Link></header>
    <section className={styles.hero}><h1>{copy.name}</h1><p>{copy.lede}</p></section>
    <section className={styles.workspace}>
      <div className={styles.previewPanel}>
        <div
          className={styles.stage}
          data-testid="production-stage"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}
        >
          {source ? <>
            {source.kind === 'video'
              ? <video ref={videoRef} className={styles.hidden} src={source.url} muted playsInline loop preload="auto" onLoadedData={draw} onSeeked={draw} />
              : <img ref={imageRef} className={styles.hidden} src={source.url} alt="" onLoad={draw} />}
            <canvas ref={canvasRef} className={styles.canvas} style={{ aspectRatio: `${source.width}/${source.height}` }} />
          </> : <div className={styles.empty}>
            <button type="button" className={styles.drop} onClick={() => inputRef.current?.click()}><Upload size={24} /><b>Drop or choose an image or video</b><span>PNG, JPG, WebP, MP4, WebM · stays on your device</span></button>
            <button type="button" className={styles.ghost} onClick={() => { void sampleFile().then(choose); }}>Try a sample image</button>
          </div>}
        </div>
        {source && <div className={styles.transport}>
          {source.kind === 'video' && <button type="button" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>}
          {source.kind === 'video' && <input aria-label="Seek" type="range" min="0" max={source.duration || 0} step="0.01" value={time} onChange={(event) => { const value = Number(event.target.value); setTime(value); if (videoRef.current) videoRef.current.currentTime = value; }} />}
          {source.kind === 'image' && <span className={styles.meta}>{source.width} × {source.height}</span>}
          <button type="button" aria-pressed={compare} title="Hold to compare with the original" onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)} onPointerLeave={() => setCompare(false)}><Eye size={14} /> Original</button>
          <button type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Replace</button>
        </div>}
        <input ref={inputRef} hidden type="file" accept="image/*,video/*" data-testid="production-file" onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      <aside className={styles.controls}>
        {mode === 'grade' && <details className={controlStyles.section} open>
          <summary>BASICS</summary>
          <div className={controlStyles.body}>
            <div className={controlStyles.grid2}>{BASICS.map((item) => <label key={item.key} className={controlStyles.row}><span><b>{item.label}</b><output>{Math.round(adjustments[item.key] * 100)}</output></span><input type="range" min={item.min} max={item.max} step="0.01" value={adjustments[item.key]} onChange={(event) => patch({ [item.key]: Number(event.target.value) })} onDoubleClick={() => patch({ [item.key]: DEFAULT_ADJUSTMENTS[item.key] })} /></label>)}</div>
          </div>
        </details>}
        {mode === 'grade'
          ? <GradeControls adjustments={adjustments} onChange={(next) => patch(next)} luts={luts} onAddLUT={addLUT} sampleFrame={source ? sampleFrame : undefined} onNotice={say} exportName={`${baseName}-grade`} />
          : <FxStack layers={adjustments.fx || []} onChange={(layers: StudioFxLayer[]) => patch({ fx: layers })} />}
        <div className={styles.exportBar}>
          <button type="button" disabled={!source || !!busy} onClick={exportPNG}><ImageDown size={14} /> PNG</button>
          <button type="button" disabled={!source || !!busy} data-testid="production-export-mp4" onClick={() => void exportMP4()}>{busy === 'mp4' ? <><Loader2 size={14} className={styles.spin} /> {Math.round(progress * 100)}%</> : <><Film size={14} /> MP4</>}</button>
          <button type="button" className={styles.primary} disabled={!source || !!busy} data-testid="production-open-studio" onClick={() => void openInStudio()}><Clapperboard size={14} /> Open in Studio</button>
        </div>
        {(notice || error) && <p className={error ? styles.error : styles.notice} role="status">{error || notice}</p>}
      </aside>
    </section>
  </main>;
}
