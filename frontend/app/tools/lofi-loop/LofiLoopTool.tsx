'use client';

import { useEffect, useState } from 'react';
import { Check, Download, LoaderCircle, Music4, Sparkles, Waves } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import { parseJSONResponse } from '../../../lib/http';
import styles from '../audio-spaces.module.css';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type Option = { id: string; label: string };
type LofiSpec = {
  defaults?: { size?: string; fps?: number; seam_seconds?: number; viz_alpha?: number };
  visualizers?: Option[];
  presets?: Option[];
  palettes?: Option[];
};
type ServiceResponse = {
  result?: { job_id?: string; status?: string; status_url?: string };
  credits_used?: number;
  credits_remain?: number;
  estimated_cost_usd?: number;
  estimated_generation_seconds?: number;
};
type JobPayload = {
  job?: {
    status?: string;
    error?: string;
    result?: { video_url?: string; cover_url?: string; visualizer?: string; duration_seconds?: number };
  };
};

const EXAMPLE_PROMPT = 'Rainy midnight study session, dusty vinyl piano over warm tape hiss, slow boom-bap drums';
const EXAMPLE_SCENE = 'A cozy apartment at midnight, rain streaking the window, blurred city lights below';
const EXAMPLE_CHARACTER = 'A tired student in an oversized hoodie, headphones on, asleep over an open notebook';
const PROMPT_IDEAS: { label: string; prompt: string }[] = [
  { label: 'Rainy study session', prompt: EXAMPLE_PROMPT },
  { label: 'Foggy morning jazz', prompt: 'Slow jazz guitar loop for a foggy morning commute, warm upright bass, brushed drums' },
  { label: 'Late-night soul chops', prompt: 'Dusty soul chops and vinyl crackle for late-night reading, muted trumpet, soft keys' },
];

const DURATIONS = [30, 60, 90, 120, 180];
const SIZES = ['1280x704', '1024x576', '1344x768'];
// Motion ids come from GET /api/lofi-loop/spec; these are the fallbacks.
const MOTIONS: Option[] = [
  { id: 'drift', label: 'Slow Drift' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'rain-window', label: 'Rain Window' },
  { id: 'embers', label: 'Embers' },
  { id: 'rooftop', label: 'Rooftop' },
  { id: 'vigil', label: 'Vigil' },
  { id: 'static', label: 'Still' },
];
const FALLBACK_VISUALIZERS: Option[] = [
  { id: 'bars', label: 'Spectrum Bars' },
  { id: 'wave', label: 'Waveform' },
  { id: 'mirror', label: 'Mirror Bars' },
  { id: 'lissajous', label: 'Lissajous' },
  { id: 'freqs', label: 'Frequency Ring' },
  { id: 'cqt', label: 'CQT Rolls' },
  { id: 'none', label: 'No visualizer' },
];
const FALLBACK_PRESETS: Option[] = [
  { id: 'drift', label: 'Drift' },
  { id: 'breathe', label: 'Breathe' },
  { id: 'rain-window', label: 'Rain Window' },
  { id: 'embers', label: 'Embers' },
  { id: 'rooftop', label: 'Rooftop' },
  { id: 'vigil', label: 'Vigil' },
];
const FALLBACK_PALETTES: Option[] = [
  { id: 'ember', label: 'Ember' },
  { id: 'neon', label: 'Neon' },
  { id: 'violet', label: 'Violet' },
  { id: 'moss', label: 'Moss' },
  { id: 'ash', label: 'Ash' },
];

function sleep(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  window.setTimeout(resolve, ms);
  return promise;
}

export default function LofiLoopTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [prompt, setPrompt] = useState('');
  const [character, setCharacter] = useState('');
  const [scene, setScene] = useState('');
  const [audio, setAudio] = useState('');
  const [duration, setDuration] = useState(60);
  const [visualizer, setVisualizer] = useState('bars');
  const [preset, setPreset] = useState('drift');
  const [palette, setPalette] = useState('ember');
  const [motion, setMotion] = useState('drift');
  const [size, setSize] = useState('1280x704');
  const [seed, setSeed] = useState('');
  const [seamSeconds, setSeamSeconds] = useState(1.5);
  const [visualizers, setVisualizers] = useState<Option[]>(FALLBACK_VISUALIZERS);
  const [presets, setPresets] = useState<Option[]>(FALLBACK_PRESETS);
  const [palettes, setPalettes] = useState<Option[]>(FALLBACK_PALETTES);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('Describe the track');
  const [videoURL, setVideoURL] = useState('');
  const [coverURL, setCoverURL] = useState('');
  const [cost, setCost] = useState<number | null>(null);
  const [creditsRemain, setCreditsRemain] = useState<number | null>(null);
  const [estimatedSeconds, setEstimatedSeconds] = useState<number | null>(null);
  const [vizUsed, setVizUsed] = useState('');
  const [videoLength, setVideoLength] = useState<number | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    let cancelled = false;
    void fetch('/api/lofi-loop/spec')
      .then((response) => parseJSONResponse<LofiSpec>(response, 'Could not load the lofi options'))
      .then((spec) => {
        if (cancelled) return;
        if (spec.visualizers?.length) setVisualizers(spec.visualizers);
        if (spec.presets?.length) setPresets(spec.presets);
        if (spec.palettes?.length) setPalettes(spec.palettes);
        if (spec.defaults?.size) setSize(spec.defaults.size);
        if (spec.defaults?.seam_seconds) setSeamSeconds(spec.defaults.seam_seconds);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  async function generate() {
    if (!user?.api_key) { setPhase('error'); setStatus('Sign in to build a lofi loop'); return; }
    if (prompt.trim().length < 10) { setPhase('error'); setStatus('Describe the track in at least 10 characters'); return; }
    setVideoURL(''); setCoverURL(''); setCost(null); setCreditsRemain(null); setEstimatedSeconds(null);
    setVizUsed(''); setVideoLength(null); setPhase('queued'); setStatus('Job added');
    try {
      const queued = await parseJSONResponse<ServiceResponse>(
        await fetch('/api/service', {
          method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'lofi_loop',
            prompt: prompt.trim(),
            character_prompt: character.trim(),
            scene_prompt: scene.trim(),
            music_duration: duration,
            ...(audio.trim() ? { audio_url: audio.trim() } : {}),
            visualizer,
            preset,
            palette,
            motion,
            size,
            aspect_ratio: '16:9',
            duration,
            ...(seed.trim() ? { seed: Number(seed) } : {}),
            loop_seconds: 0,
            loop_start: 0,
            seam_seconds: seamSeconds,
          }),
        }),
        'Could not start the lofi loop',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The lofi service returned no job');
      setCost(queued.estimated_cost_usd ?? null);
      setCreditsRemain(queued.credits_remain ?? null);
      setEstimatedSeconds(queued.estimated_generation_seconds ?? null);
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${user.api_key}` } }),
          'Could not read the loop status',
        );
        const next = payload.job?.status || '';
        if (next === 'completed') {
          const url = payload.job?.result?.video_url;
          if (!url) throw new Error('Generation completed without a video');
          setVideoURL(url);
          setCoverURL(payload.job?.result?.cover_url || '');
          setVizUsed(payload.job?.result?.visualizer || visualizer);
          setVideoLength(payload.job?.result?.duration_seconds ?? null);
          setPhase('done'); setStatus('Loop ready');
          void refreshUser(user.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to render this loop' : 'Lofi loop generation failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Rendering the loop…' : 'Job added');
        await sleep(2500);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setStatus(reason instanceof Error ? reason.message : 'Lofi loop generation failed');
    }
  }

  const busy = phase === 'queued' || phase === 'processing';

  const vizLabel = visualizers.find((option) => option.id === (vizUsed || visualizer))?.label || (vizUsed || visualizer);
  return <>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Music4 size={13} /> Z-IMAGE COVER · PARALLAX LOOP · AUDIO VISUALIZER</div>
      <h1>Turn a track into a looping lofi world.</h1>
      <p>Paint the first frame, drift it into a seamless parallax loop, overlay a live audio visualizer, and download the finished video.</p>
    </section>
    <section className={styles.workspace}>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>01 / SOURCE</span><h2>Music</h2></div><Music4 size={17} /></div>
        <label className={styles.field}>Song or style prompt
          <textarea className={styles.script} data-testid="lofi-prompt" rows={6} maxLength={2000} disabled={busy}
            value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={EXAMPLE_PROMPT} />
        </label>
        <div className={styles.chips}>
          {PROMPT_IDEAS.map((idea) => <button key={idea.label} type="button" disabled={busy} onClick={() => setPrompt(idea.prompt)}>{idea.label}</button>)}
        </div>
        <label className={styles.field}>Audio URL (optional)
          <input data-testid="lofi-audio-url" type="url" disabled={busy} value={audio}
            onChange={(event) => setAudio(event.target.value)} placeholder="https://example.com/track.mp3" />
        </label>
        <div className={styles.row}>
          <label className={styles.field}>Length
            <select data-testid="lofi-duration" disabled={busy} value={duration} onChange={(event) => setDuration(Number(event.target.value))}>
              {DURATIONS.map((value) => <option key={value} value={value}>{value} seconds</option>)}
            </select>
          </label>
          <label className={styles.field}>Seed
            <input data-testid="lofi-seed" type="number" min="0" disabled={busy} value={seed}
              onChange={(event) => setSeed(event.target.value)} placeholder="random" />
          </label>
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>02 / LOOK</span><h2>Scene and motion</h2></div><Sparkles size={17} /></div>
        <label className={styles.field}>Environment
          <textarea rows={4} data-testid="lofi-scene" maxLength={2000} disabled={busy}
            value={scene} onChange={(event) => setScene(event.target.value)} placeholder={EXAMPLE_SCENE} />
        </label>
        <label className={styles.field}>Cover subject
          <input data-testid="lofi-character" maxLength={1000} disabled={busy} value={character}
            onChange={(event) => setCharacter(event.target.value)} placeholder={EXAMPLE_CHARACTER} />
        </label>
        <div className={styles.row}>
          <label className={styles.field}>Preset
            <select data-testid="lofi-preset" disabled={busy} value={preset} onChange={(event) => setPreset(event.target.value)}>
              {presets.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>Palette
            <select data-testid="lofi-palette" disabled={busy} value={palette} onChange={(event) => setPalette(event.target.value)}>
              {palettes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>Visualizer
            <select data-testid="lofi-visualizer" disabled={busy} value={visualizer} onChange={(event) => setVisualizer(event.target.value)}>
              {visualizers.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>Motion
            <select data-testid="lofi-motion" disabled={busy} value={motion} onChange={(event) => setMotion(event.target.value)}>
              {MOTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <label className={styles.field}>Size
          <select data-testid="lofi-size" disabled={busy} value={size} onChange={(event) => setSize(event.target.value)}>
            {SIZES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>03 / RENDER</span><h2>Looping video</h2></div><Waves size={17} /></div>
        <button data-testid="lofi-run" className={styles.run} type="button" disabled={busy || prompt.trim().length < 10}
          onClick={() => void generate()}>
          {busy ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={16} />}{busy ? status : 'Build the lofi loop'}
        </button>
        <div className={styles.price}>
          <span>{cost === null ? 'Estimate shown after submit' : `Estimate · $${cost.toFixed(2)}`}</span>
          <span>{creditsRemain === null ? `${size} · ${motion}` : `${creditsRemain} credits remaining`}</span>
        </div>
        {phase === 'error' && <div data-testid="lofi-error" className={styles.error}>{status}</div>}
        <div className={styles.output}>
          <div className={styles.outputHead}><span>LOOP OUTPUT</span><span className={videoURL ? styles.ready : ''}>{videoURL ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {videoURL
            ? <>
              <video data-testid="lofi-video" src={videoURL} poster={coverURL || undefined} autoPlay muted loop playsInline controls />
              {coverURL && <a data-testid="lofi-cover" href={coverURL} target="_blank" rel="noreferrer"><img src={coverURL} alt="Generated cover still" /></a>}
              <a className={styles.download} href={videoURL} download><Download size={14} /> Download loop</a>
            </>
            : <div className={`${styles.empty} p-8`}>{busy ? <><LoaderCircle className={styles.spin} size={22} /><p>{status}</p></> : <p>No loop yet. Describe a track, then render.</p>}</div>}
        </div>
        {videoURL && <div className={styles.facts}>
          <div><b>{vizLabel}</b><span>VISUALIZER</span></div>
          <div><b>{videoLength === null ? '—' : `${Math.round(videoLength)}s`}</b><span>LENGTH</span></div>
          <div><b>{estimatedSeconds === null ? '—' : `${Math.round(estimatedSeconds)}s`}</b><span>EST. RENDER</span></div>
        </div>}
        {phase === 'done' && <div className={styles.price}><span><Check size={11} /> Seamless loop ready</span><span>{size} · {preset} · {palette}</span></div>}
      </div>
    </section>
  </>;
}
