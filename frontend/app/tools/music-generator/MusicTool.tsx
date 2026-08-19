'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, LoaderCircle, Music4, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import styles from './page.module.css';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type JobPayload = {
  job?: {
    status?: string;
    error?: string;
    result?: { audio_url?: string; charged_usd?: number; duration_seconds?: number; metrics?: { duration_seconds?: number } };
  };
};

const EXAMPLE_PROMPT = 'House remix, EDM techno at 128 BPM, old-school electro bass, saxophone hook, electric guitar stabs, wide club production';
const EXAMPLE_LYRICS = '[Verse]\nThere is a house in New Orleans\nThey call the Rising Sun\n[Chorus]\nOh mother tell your children\nNot to do what I have done';
const DURATIONS = [30, 60, 90, 120, 150, 180];

function priceUSD(duration: number) {
  return Math.max(0.5, Math.round((0.4 + (0.2 * duration) / 60) * 100) / 100);
}

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

export default function MusicTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [prompt, setPrompt] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [duration, setDuration] = useState(60);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Describe the track');
  const [audioURL, setAudioURL] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [length, setLength] = useState<number | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  async function generate() {
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to generate music'); return; }
    if (prompt.trim().length < 10) { setPhase('error'); setStatus('Describe the style in at least 10 characters'); return; }
    setAudioURL(''); setCost(null); setLength(null); setPhase('queued'); setStatus('Job added');
    try {
      const queued = await jsonResponse<{ result?: { job_id?: string; status_url?: string }; estimated_cost_usd?: number }>(
        await fetch('/api/service', {
          method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ service: 'music', prompt: prompt.trim(), lyrics: lyrics.trim(), duration }),
        }),
        'Could not start music generation',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The music service returned no job');
      const statusURL = queued.result?.status_url || `/api/audio-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await jsonResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${user.api_key}` } }),
          'Could not read music status',
        );
        const next = payload.job?.status || '';
        if (next === 'completed') {
          const url = payload.job?.result?.audio_url;
          if (!url) throw new Error('Generation completed without audio');
          setAudioURL(url);
          setCost(payload.job?.result?.charged_usd ?? queued.estimated_cost_usd ?? null);
          setLength(payload.job?.result?.metrics?.duration_seconds ?? payload.job?.result?.duration_seconds ?? null);
          setPhase('done'); setStatus('Track ready');
          void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to release this track' : 'Music generation failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Composing…' : 'Job added');
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setStatus(reason instanceof Error ? reason.message : 'Music generation failed');
    }
  }

  const busy = phase === 'queued' || phase === 'processing';
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={17} /> Tools</Link>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Music4 size={14} /> MINIMAX MUSIC 3 · SONG GENERATOR</div>
      <h1>Write the song.<br /><span>Get the record.</span></h1>
      <p>Vocals and instrumental together, 32 kHz stereo, up to three minutes. The style caption decides the arrangement; the lyrics decide what gets sung.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={styles.promptLabel}>Style caption
          <textarea data-testid="music-prompt" value={prompt} disabled={busy} maxLength={2000}
            onChange={(event) => setPrompt(event.target.value)} placeholder={EXAMPLE_PROMPT} />
          <small>Name the genre, instruments, tempo and production character.</small>
        </label>
        <label className={styles.promptLabel}>Lyrics <span className={styles.optional}>optional</span>
          <textarea data-testid="music-lyrics" value={lyrics} disabled={busy} maxLength={8000} rows={8}
            onChange={(event) => setLyrics(event.target.value)} placeholder={EXAMPLE_LYRICS} />
          <small>Keep [Verse], [Chorus], [Bridge] and [Outro] on their own lines. Leave empty for an instrumental.</small>
        </label>
        <div className={styles.options}>
          <label>Length<select data-testid="music-duration" value={duration} disabled={busy}
            onChange={(event) => setDuration(Number(event.target.value))}>
            {DURATIONS.map((value) => <option key={value} value={value}>{value} seconds</option>)}
          </select></label>
          <button type="button" className={styles.example} disabled={busy}
            onClick={() => { setPrompt(EXAMPLE_PROMPT); setLyrics(EXAMPLE_LYRICS); }}>Use the example</button>
        </div>
        <button data-testid="music-run" className={styles.run} type="button" disabled={busy || prompt.trim().length < 10}
          onClick={() => void generate()}>
          {busy ? <LoaderCircle className={styles.spin} size={19} /> : <Sparkles size={18} />}{busy ? status : 'Generate track'}
        </button>
        <div className={styles.price}><span>Estimate · ${priceUSD(duration).toFixed(2)}</span><span>Charged after a successful render</span></div>
        {phase === 'error' && <div data-testid="music-error" className={styles.error}>{status}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{audioURL ? 'YOUR TRACK' : 'OUTPUT'}</span>{phase === 'done' && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {audioURL
            ? <audio data-testid="music-audio" controls src={audioURL} />
            : <div className={styles.emptyOutput}>{busy ? <LoaderCircle className={styles.spin} size={35} /> : <Waves size={35} />}<b>{busy ? status : 'No track yet'}</b><span>{busy ? 'A three-minute song renders in about a minute of GPU time.' : 'Describe a style, then generate.'}</span></div>}
        </div>
        <div className={styles.resultFooter}>
          <div><b>{phase === 'done' ? 'Saved to your audio library' : 'MiniMax-Music3'}</b>
            <span>{cost === null ? 'Vocals and instrumental in one pass' : `$${cost.toFixed(2)} charged${length ? ` · ${Math.round(length)}s` : ''}`}</span></div>
          {audioURL && <a href={audioURL} download><Download size={16} /> Download</a>}
        </div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><ShieldCheck size={17} /><span><strong>No voice cloning</strong>Requests that target a real person&apos;s voice are refused.</span></div>
      <div><Waves size={17} /><span><strong>32 kHz stereo</strong>Full song audio, not a stem or a loop.</span></div>
      <div><Sparkles size={17} /><span><strong>Usage-based</strong>You pay per finished track, only when it succeeds.</span></div>
    </section>
  </main>;
}
