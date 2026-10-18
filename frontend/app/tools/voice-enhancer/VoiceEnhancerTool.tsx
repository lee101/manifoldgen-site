'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, LoaderCircle, Mic, ShieldCheck, Upload, Waves, Wand2 } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import { mediaSeconds, quoteSong, runSong, SongResult, SongTrack, uploadRecording } from '../../../lib/song-jobs';
import { SongTracks, TRACK_COPY } from '../../../components/song-tracks';
import styles from '../music-generator/page.module.css';
import song from '../../../components/song-tools.module.css';

type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';
export const STYLE_PRESETS = ['hard hip-hop diss track', 'melodic trap', 'boom bap', 'UK drill', 'pop anthem', 'rock anthem', 'R&B slow jam', 'EDM festival'];

export default function VoiceEnhancerTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [audioURL, setAudioURL] = useState('');
  const [fileName, setFileName] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [prompt, setPrompt] = useState(STYLE_PRESETS[0]);
  const [lyrics, setLyrics] = useState('');
  const [tracks, setTracks] = useState<SongTrack[]>(['voice', 'studio', 'produce']);
  const [consent, setConsent] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Upload a sung or rapped take');
  const [result, setResult] = useState<SongResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  useEffect(() => {
    if (!user?.api_key || tracks.length === 0) { setPrice(null); return; }
    const timer = window.setTimeout(() => {
      quoteSong(user.api_key, { service: 'voice_enhancer', duration: Math.round(seconds || 180), tracks, prompt })
        .then((quote) => setPrice(quote.estimated_cost_usd)).catch(() => setPrice(null));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [user?.api_key, seconds, tracks, prompt]);

  async function choose(files: FileList | File[] | null) {
    const file = files ? Array.from(files)[0] : undefined;
    if (!file) return;
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to upload a recording'); return; }
    setResult(null); setPhase('uploading'); setStatus('Uploading…');
    try {
      const length = await mediaSeconds(file);
      if (length && (length < 5 || length > 360)) throw new Error('Recordings must be between 5 seconds and 6 minutes');
      setAudioURL(await uploadRecording(user.api_key, file, 'voice-enhancer'));
      setFileName(file.name); setSeconds(length);
      setPhase('idle'); setStatus(length ? `${Math.round(length)} second take ready` : 'Take ready');
    } catch (reason) {
      setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Upload failed');
    }
  }

  function toggle(track: SongTrack) {
    setTracks((current) => current.includes(track) ? current.filter((t) => t !== track) : [...current, track]);
  }

  async function run() {
    if (!user?.api_key || !audioURL) return;
    setResult(null); setPhase('queued'); setStatus('Waiting for a studio GPU…');
    try {
      const done = await runSong(user.api_key, {
        service: 'voice_enhancer', audio_url: audioURL, prompt: prompt.trim(), lyrics: lyrics.trim(), tracks,
        voice_consent: consent,
      }, (next, nextPhase) => { setStatus(next); setPhase(nextPhase); });
      setResult(done); setPhase('done'); setStatus('Song ready');
      void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    } catch (reason) {
      setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Song generation failed');
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';
  const needsConsent = tracks.includes('voice') && !consent;
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={17} /> Tools</Link>
      <span />
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Mic size={14} /> AI VOICE ENHANCER · VOCAL PRODUCER</div>
      <h1>Rap it rough.<br /><span>Hear it produced.</span></h1>
      <p>Upload a phone or bedroom take, pick a style, and get it back as a finished record: your voice re-performed on a full beat, a studio vocalist version, and your own take cleaned and locked to the beat.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={`${song.drop} ${dragging ? song.dropActive : ''}`} data-testid="ve-drop"
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void choose(event.dataTransfer.files); }}>
          <input ref={input} data-testid="ve-file" type="file" accept="audio/*,video/*" disabled={busy}
            onChange={(event) => void choose(event.target.files)} />
          {phase === 'uploading' ? <LoaderCircle className={styles.spin} size={22} /> : <Upload size={22} />}
          <b>{fileName || 'Drop your recording'}</b>
          <span>{fileName ? status : 'MP3, WAV, M4A or a video · up to 6 minutes'}</span>
        </label>
        <label className={song.field}>Style
          <input type="text" data-testid="ve-prompt" value={prompt} maxLength={300} disabled={busy} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <div className={song.chips}>
          {STYLE_PRESETS.map((preset) => <button key={preset} type="button" aria-pressed={prompt === preset} disabled={busy}
            onClick={() => setPrompt(preset)}>{preset}</button>)}
        </div>
        <label className={styles.promptLabel}>Lyrics <span className={styles.optional}>optional · best accuracy</span>
          <textarea data-testid="ve-lyrics" value={lyrics} disabled={busy} maxLength={6000} rows={4}
            onChange={(event) => setLyrics(event.target.value)} placeholder="Paste your lyrics so every word lands. Leave empty and we transcribe your take." />
        </label>
        <div className={song.checks}>
          {(['voice', 'studio', 'produce'] as SongTrack[]).map((track) => <label key={track}>
            <input type="checkbox" data-testid={`ve-track-${track}`} checked={tracks.includes(track)} disabled={busy} onChange={() => toggle(track)} />
            {TRACK_COPY[track].name}<small>{TRACK_COPY[track].detail}</small>
          </label>)}
        </div>
        {tracks.includes('voice') && <label className={song.consent}>
          <input type="checkbox" data-testid="ve-consent" checked={consent} disabled={busy} onChange={(event) => setConsent(event.target.checked)} />
          <span>This recording is my own voice, or I have the singer&apos;s permission to re-perform it in their voice.</span>
        </label>}
        <button data-testid="ve-run" className={styles.run} type="button" disabled={busy || !audioURL || tracks.length === 0 || needsConsent}
          onClick={() => void run()}>
          {busy && phase !== 'uploading' ? <LoaderCircle className={styles.spin} size={19} /> : <Wand2 size={18} />}
          {busy && phase !== 'uploading' ? status : 'Produce my song'}
        </button>
        <div className={styles.price}><span data-testid="ve-price">{price === null ? 'Estimate · —' : `Estimate · $${price.toFixed(2)}`}</span>
          <span>{seconds ? `${Math.round(seconds)}s take · charged only on success` : 'Priced from your take’s length'}</span></div>
        {phase === 'error' && <div data-testid="ve-error" className={styles.error}>{status}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{result ? 'YOUR SONG' : 'OUTPUT'}</span>{phase === 'done' && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {result ? <SongTracks result={result} prompt={prompt} />
            : <div className={styles.emptyOutput}>{busy ? <LoaderCircle className={styles.spin} size={35} /> : <Waves size={35} />}
              <b>{busy ? status : 'No song yet'}</b>
              <span>{busy ? 'A three-minute take takes about five to ten minutes.' : 'Upload a take, choose a style, then produce.'}</span></div>}
        </div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><ShieldCheck size={17} /><span><strong>Your voice only</strong>The voice version always uses the uploaded singer, never anyone else&apos;s.</span></div>
      <div><Waves size={17} /><span><strong>Every word kept</strong>Takes are transcribed and checked so the song says what you said.</span></div>
      <div><Wand2 size={17} /><span><strong>Usage-based</strong>Priced from your take&apos;s length, charged only when the song is ready.</span></div>
    </section>
  </main>;
}
