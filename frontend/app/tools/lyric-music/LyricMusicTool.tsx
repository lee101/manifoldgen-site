'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clapperboard, LoaderCircle, Music4, ShieldCheck, Sparkles, Waves } from 'lucide-react';
import Link from 'next/link';
import { loadStoredUser, refreshUser, saveUser, StoredUser } from '../../../lib/auth';
import { quoteSong, runSong, SongResult, SongTrack } from '../../../lib/song-jobs';
import { SongTracks } from '../../../components/song-tracks';
import { STYLE_PRESETS } from '../voice-enhancer/VoiceEnhancerTool';
import { DEFAULT_LYRICS } from './default-lyrics';
import styles from '../music-generator/page.module.css';
import song from '../../../components/song-tools.module.css';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type Quality = 'lite' | 'standard' | 'studio';

// Labels only: the voices behind each quality level stay server-side.
export const QUALITIES: { id: Quality; name: string; detail: string; voices: { id: string; name: string }[] }[] = [
  { id: 'lite', name: 'Lite', detail: 'Fastest and cheapest', voices: [
    { id: 'M2', name: 'Marcus' }, { id: 'M1', name: 'Theo' }, { id: 'M3', name: 'Dex' }, { id: 'F1', name: 'Nova' }, { id: 'F2', name: 'Ivy' }] },
  { id: 'standard', name: 'Standard', detail: 'Natural voices', voices: [
    { id: 'am_michael', name: 'Michael' }, { id: 'am_fenrir', name: 'Ryder' }, { id: 'am_puck', name: 'Kai' },
    { id: 'am_onyx', name: 'Onyx' }, { id: 'af_heart', name: 'Harper' }, { id: 'af_bella', name: 'Bella' }] },
  { id: 'studio', name: 'Studio', detail: 'Most expressive delivery', voices: [
    { id: 'Fenrir', name: 'Fenrir · gritty' }, { id: 'Orus', name: 'Orus · firm' }, { id: 'Charon', name: 'Charon · deep' }, { id: 'Puck', name: 'Puck · bright' }] },
];

export default function LyricMusicTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [lyrics, setLyrics] = useState(DEFAULT_LYRICS);
  const [prompt, setPrompt] = useState(STYLE_PRESETS[0]);
  const [quality, setQuality] = useState<Quality>('studio');
  const [voice, setVoice] = useState('Fenrir');
  const [spoken, setSpoken] = useState(false);
  const [prices, setPrices] = useState<Partial<Record<Quality, number>>>({});
  const [seconds, setSeconds] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Paste lyrics');
  const [result, setResult] = useState<SongResult | null>(null);
  const level = QUALITIES.findIndex((q) => q.id === quality);
  const tracks: SongTrack[] = spoken ? ['voice', 'studio', 'produce'] : ['voice', 'studio'];

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  useEffect(() => {
    if (!user?.api_key || lyrics.trim().split(/\s+/).length < 8) { setPrices({}); return; }
    const timer = window.setTimeout(() => {
      quoteSong(user.api_key, { service: 'lyric_music', lyrics, prompt, quality, voice, tracks })
        .then((quote) => { setPrices(quote.quality_prices_usd || {}); setSeconds(quote.seconds); })
        .catch(() => setPrices({}));
    }, 400);
    return () => window.clearTimeout(timer);
  }, [user?.api_key, lyrics, prompt, quality, voice, spoken]);

  function pickQuality(next: Quality) {
    setQuality(next);
    setVoice(QUALITIES.find((q) => q.id === next)!.voices[0].id);
  }

  async function run() {
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to make a song'); return; }
    setResult(null); setPhase('queued'); setStatus('Waiting for a studio GPU…');
    try {
      const done = await runSong(user.api_key, { service: 'lyric_music', lyrics: lyrics.trim(), prompt: prompt.trim(), quality, voice, tracks },
        (next, nextPhase) => { setStatus(next); setPhase(nextPhase); });
      setResult({ ...done, lyrics: done.lyrics || lyrics }); setPhase('done'); setStatus('Song ready');
      void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    } catch (reason) {
      setPhase('error'); setStatus(reason instanceof Error ? reason.message : 'Song generation failed');
    }
  }

  const busy = phase === 'queued' || phase === 'processing';
  const words = lyrics.trim() ? lyrics.trim().split(/\s+/).length : 0;
  const current = QUALITIES[level];
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={17} /> Tools</Link>
      <span />
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Music4 size={14} /> LYRICS TO SONG · AI RAP GENERATOR</div>
      <h1>Paste the bars.<br /><span>Get the track.</span></h1>
      <p>Paste your lyrics, pick a style and a voice, and get a finished song that raps every line you wrote. Then turn it into a lyric music video.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={styles.promptLabel}>Lyrics <span className={styles.optional}>{words} words · about {Math.round(seconds || words / 3)}s</span>
          <textarea data-testid="lm-lyrics" value={lyrics} disabled={busy} maxLength={6000} rows={10}
            onChange={(event) => setLyrics(event.target.value)} />
          <small>Blank lines split verses. [Verse] / [Chorus] tags are respected if you add them.</small>
        </label>
        <label className={song.field}>Style
          <input type="text" data-testid="lm-prompt" value={prompt} maxLength={300} disabled={busy} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <div className={song.chips}>
          {STYLE_PRESETS.map((preset) => <button key={preset} type="button" aria-pressed={prompt === preset} disabled={busy}
            onClick={() => setPrompt(preset)}>{preset}</button>)}
        </div>
        <div className={song.slider}>
          <label className={song.field} style={{ marginBottom: 0 }}>Voice quality
            <input type="range" data-testid="lm-quality" min={0} max={2} step={1} value={level} disabled={busy}
              onChange={(event) => pickQuality(QUALITIES[Number(event.target.value)].id)} />
          </label>
          <div className={song.sliderLabels}>
            {QUALITIES.map((q) => <span key={q.id} className={q.id === quality ? song.on : ''}>
              <b>{q.name}{prices[q.id] !== undefined ? ` · $${prices[q.id]!.toFixed(2)}` : ''}</b>{q.detail}</span>)}
          </div>
        </div>
        <label className={song.field}>Voice
          <select data-testid="lm-voice" value={voice} disabled={busy} onChange={(event) => setVoice(event.target.value)}>
            {current.voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <div className={song.checks}>
          <label><input type="checkbox" data-testid="lm-spoken" checked={spoken} disabled={busy} onChange={(event) => setSpoken(event.target.checked)} />
            Spoken-word version<small>Also lay the voice&apos;s plain read over the beat</small></label>
        </div>
        <button data-testid="lm-run" className={styles.run} type="button" disabled={busy || words < 8} onClick={() => void run()}>
          {busy ? <LoaderCircle className={styles.spin} size={19} /> : <Sparkles size={18} />}{busy ? status : 'Make the song'}
        </button>
        <div className={styles.price}><span data-testid="lm-price">{prices[quality] !== undefined ? `Estimate · $${prices[quality]!.toFixed(2)}` : 'Estimate · —'}</span>
          <span>Charged only when the song is ready</span></div>
        {phase === 'error' && <div data-testid="lm-error" className={styles.error}>{status}</div>}
      </div>
      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{result ? 'YOUR SONG' : 'OUTPUT'}</span>{phase === 'done' && <span className={styles.ready}><Check size={13} /> READY</span>}</div>
        <div className={styles.preview}>
          {result ? <SongTracks result={result} prompt={prompt} />
            : <div className={styles.emptyOutput}>{busy ? <LoaderCircle className={styles.spin} size={35} /> : <Waves size={35} />}
              <b>{busy ? status : 'No song yet'}</b>
              <span>{busy ? 'A three-minute song takes about five to ten minutes.' : 'Paste lyrics, choose a style and voice, then make the song.'}</span></div>}
        </div>
      </div>
    </section>
    <section className={styles.notes}>
      <div><Sparkles size={17} /><span><strong>Every line rapped</strong>Renders are checked against your lyrics; the closest take wins.</span></div>
      <div><Clapperboard size={17} /><span><strong>Lyric video ready</strong>Send any finished track straight to the lyric video agent.</span></div>
      <div><ShieldCheck size={17} /><span><strong>Usage-based</strong>The price follows your lyrics&apos; length and the voice quality you pick.</span></div>
    </section>
  </main>;
}
