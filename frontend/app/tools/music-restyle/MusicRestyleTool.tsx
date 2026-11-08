'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Download, LoaderCircle, Music4, ShieldCheck, Upload, Waves, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import { mediaSeconds, quoteSong, uploadRecording } from '../../../lib/song-jobs';
import { RESTYLE_PRESETS, RestyleResult, runJob } from '../../../lib/restyle-jobs';
import NextStage from './NextStage';
import styles from '../music-generator/page.module.css';
import song from '../../../components/song-tools.module.css';
import local from './restyle.module.css';

type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';
type Harmony = 'melody' | 'full';

const HARMONY: Record<Harmony, { name: string; detail: string }> = {
  melody: { name: 'Fit the style', detail: 'Keeps the melody, writes new chords for the style' },
  full: { name: 'Keep the chords', detail: 'Same melody and harmony, new arrangement' },
};

export default function MusicRestyleTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [audioURL, setAudioURL] = useState('');
  const [sourcePreview, setSourcePreview] = useState('');
  const [fileName, setFileName] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [preset, setPreset] = useState(RESTYLE_PRESETS[0].id);
  const [prompt, setPrompt] = useState(RESTYLE_PRESETS[0].prompt);
  const [harmony, setHarmony] = useState<Harmony>('melody');
  const [tempo, setTempo] = useState(0);
  const [length, setLength] = useState(0);
  const [renders, setRenders] = useState(1);
  const [rights, setRights] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Upload an instrumental');
  const [result, setResult] = useState<RestyleResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  const restyleSeconds = Math.round(length || Math.min(seconds || 180, 360));
  useEffect(() => {
    if (!user?.api_key) { setPrice(null); return; }
    const timer = window.setTimeout(() => {
      quoteSong(user.api_key, { service: 'music_restyle', duration: Math.max(restyleSeconds, 10), n: renders })
        .then((quote) => setPrice(quote.estimated_cost_usd)).catch(() => setPrice(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [user?.api_key, restyleSeconds, renders]);

  function pick(id: string) {
    const next = RESTYLE_PRESETS.find((p) => p.id === id);
    if (!next) return;
    setPreset(id); setPrompt(next.prompt); setTempo(next.bpm || 0);
  }

  async function choose(files: FileList | File[] | null) {
    const file = files ? Array.from(files)[0] : undefined;
    if (!file) return;
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to upload a track'); return; }
    setResult(null); setPhase('uploading'); setStatus('Uploading…');
    try {
      const duration = await mediaSeconds(file);
      if (duration && duration < 10) throw new Error('Tracks must be at least 10 seconds');
      setAudioURL(await uploadRecording(user.api_key, file, 'music-restyle'));
      setSourcePreview(URL.createObjectURL(file));
      setFileName(file.name); setSeconds(duration);
      setPhase('idle');
      setStatus(duration > 360 ? `${Math.round(duration)}s track · the first 6 minutes are restyled` : `${Math.round(duration)}s track ready`);
    } catch (reason) {
      setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Upload failed');
    }
  }

  async function run() {
    if (!user?.api_key || !audioURL) return;
    setResult(null); setPhase('queued'); setStatus('Waiting for a studio GPU…');
    try {
      const done = await runJob(user.api_key, {
        service: 'music_restyle', audio_url: audioURL, prompt: prompt.trim(), harmony, n: renders, rights_confirmed: rights,
        ...(tempo ? { bpm: tempo } : {}), ...(length ? { duration: length } : {}),
      }, ['audio_url'], 'audio', (next) => {
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Transcribing and re-performing…' : 'Waiting for a studio GPU…');
      });
      setResult(done.result as RestyleResult); setPhase('done'); setStatus('Restyle ready');
      void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    } catch (reason) {
      setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Restyle failed');
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';
  const maxLength = Math.min(Math.floor(seconds || 360), 360);
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={17} /> Tools</Link>
      <span />
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Music4 size={14} /> AI MUSIC RESTYLE · SAME TUNE, NEW STYLE</div>
      <h1>Any instrumental.<br /><span>Any style.</span></h1>
      <p>Upload a track and hear its melody re-performed as lofi, an R&amp;B slow jam, solo violin or peaceful piano. Then loop it into a lofi video or an AI music video.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={`${song.drop} ${dragging ? song.dropActive : ''}`} data-testid="mr-drop"
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files); }}>
          <input ref={input} data-testid="mr-file" type="file" accept="audio/*,video/*" disabled={busy}
            onChange={(event) => void choose(event.target.files)} />
          {phase === 'uploading' ? <LoaderCircle className={styles.spin} size={22} /> : <Upload size={22} />}
          <b>{fileName || 'Drop an instrumental'}</b>
          <span>{fileName ? status : 'MP3, WAV, M4A or a video · melody-led tracks work best'}</span>
        </label>

        <div className={song.chips} role="group" aria-label="Style presets">
          {RESTYLE_PRESETS.map((p) => <button key={p.id} type="button" data-testid={`mr-preset-${p.id}`} aria-pressed={preset === p.id}
            disabled={busy} onClick={() => pick(p.id)}>{p.name}</button>)}
        </div>
        <label className={song.field}>Style
          <input type="text" data-testid="mr-prompt" value={prompt} maxLength={300} disabled={busy}
            onChange={(event) => { setPrompt(event.target.value); setPreset(''); }} />
        </label>

        <div className={local.segment} role="radiogroup" aria-label="Harmony">
          {(Object.keys(HARMONY) as Harmony[]).map((key) => <button key={key} type="button" role="radio" aria-checked={harmony === key}
            data-testid={`mr-harmony-${key}`} disabled={busy} onClick={() => setHarmony(key)}>
            <b>{HARMONY[key].name}</b><small>{HARMONY[key].detail}</small>
          </button>)}
        </div>

        <div className={local.sliders}>
          <label>
            <span>Tempo <b data-testid="mr-tempo-label">{tempo ? `${tempo} BPM` : 'Original'}</b></span>
            <input type="range" min={0} max={160} step={2} value={tempo} disabled={busy} data-testid="mr-tempo"
              onChange={(event) => { const v = Number(event.target.value); setTempo(v < 50 ? 0 : v); }} />
          </label>
          <label>
            <span>Length <b>{length ? `First ${length}s` : seconds > 360 ? 'First 6 min' : 'Whole track'}</b></span>
            <input type="range" min={0} max={maxLength} step={10} value={length} disabled={busy || !seconds} data-testid="mr-length"
              onChange={(event) => { const v = Number(event.target.value); setLength(v < 20 ? 0 : v); }} />
          </label>
        </div>

        <div className={local.renders}>
          <span>Renders</span>
          {[1, 2].map((n) => <button key={n} type="button" aria-pressed={renders === n} disabled={busy} data-testid={`mr-renders-${n}`}
            onClick={() => setRenders(n)}>{n === 1 ? 'One' : 'Best of two'}</button>)}
        </div>

        <label className={song.consent}>
          <input type="checkbox" data-testid="mr-rights" checked={rights} disabled={busy} onChange={(event) => setRights(event.target.checked)} />
          <span>I own this recording, it is in the public domain, or I have permission to arrange it.</span>
        </label>
        <button data-testid="mr-run" className={styles.run} type="button" disabled={busy || !audioURL || !rights || !prompt.trim()}
          onClick={() => void run()}>
          {busy && phase !== 'uploading' ? <LoaderCircle className={styles.spin} size={19} /> : <Wand2 size={18} />}
          {busy && phase !== 'uploading' ? status : 'Restyle my track'}
        </button>
        <div className={styles.price}><span data-testid="mr-price">{price === null ? 'Estimate · —' : `Estimate · $${price.toFixed(2)}`}</span>
          <span>{seconds ? `${restyleSeconds}s restyled · charged only on success` : 'Priced from the track length'}</span></div>
        {phase === 'error' && <div data-testid="mr-error" className={styles.error}>{status}</div>}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{result ? 'RESTYLED' : 'OUTPUT'}</span>{phase === 'done' && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={local.output}>
          {sourcePreview && <div className={song.track} data-testid="mr-source">
            <header><b>Original</b><span>{fileName}</span></header>
            <audio controls preload="none" src={sourcePreview} />
          </div>}
          {result?.audio_url ? <div className={`${song.track} ${local.after}`} data-testid="mr-result">
            <header><b>{RESTYLE_PRESETS.find((p) => p.id === preset)?.name || 'Your style'}</b>
              <span>{[result.key, result.bpm ? `${result.bpm} BPM` : '', result.duration_seconds ? `${Math.round(result.duration_seconds)}s` : ''].filter(Boolean).join(' · ')}</span></header>
            <audio controls preload="auto" src={result.audio_url} />
            <div className={song.trackActions}>
              <a href={result.audio_url} download><Download size={14} /> MP3</a>
              {result.score_abc && <a href={`data:text/vnd.abc;charset=utf-8,${encodeURIComponent(result.score_abc)}`} download="restyle-score.abc">Score (ABC)</a>}
            </div>
            {result.score_abc && <details className={local.score}><summary>Score the restyle followed{result.bars ? ` · ${result.bars} bars` : ''}</summary><pre>{result.score_abc}</pre></details>}
          </div> : <div className={local.empty}>{busy ? <LoaderCircle className={styles.spin} size={35} /> : <Waves size={35} />}
            <b>{busy ? status : 'No restyle yet'}</b>
            <span>{busy ? 'A three-minute track takes about three to six minutes.' : 'Upload a track, pick a style, then restyle. Video comes next.'}</span></div>}
        </div>
        <NextStage apiKey={user?.api_key || ''} audioURL={result?.audio_url || ''} style={prompt} seconds={result?.duration_seconds || 0} />
      </div>
    </section>
    <section className={styles.notes}>
      <div><Music4 size={17} /><span><strong>Same tune</strong>The melody is transcribed to a score and re-performed note for note in the new style.</span></div>
      <div><ShieldCheck size={17} /><span><strong>Your rights</strong>Restyle music you own, public domain pieces, or tracks you may arrange.</span></div>
      <div><Wand2 size={17} /><span><strong>Usage-based</strong>Priced from the track length, charged only when the restyle is ready.</span></div>
    </section>
  </main>;
}
