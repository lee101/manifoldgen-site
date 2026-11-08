'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Clapperboard, Download, Film, LoaderCircle, Repeat, Sparkles } from 'lucide-react';
import { runJob, trailerHref } from '../../../lib/restyle-jobs';
import styles from './restyle.module.css';

type Mode = 'lofi' | 'motion' | 'agent';
type Step = { label: string; state: 'todo' | 'active' | 'done' };

const MODES: Record<Mode, { name: string; detail: string; icon: typeof Film }> = {
  lofi: { name: 'Lofi loop', detail: 'Illustrated scene, gentle motion and a visualizer, looped for the whole track', icon: Repeat },
  motion: { name: 'AI motion loop', detail: 'An H3 clip whose first and last frames match, repeated over the track', icon: Sparkles },
  agent: { name: 'Music video', detail: 'The trailer agent plans and shoots a multi-shot H3 video to the song', icon: Clapperboard },
};
const VISUALIZERS = [['bars', 'Spectrum bars'], ['wave', 'Waveform'], ['mirror', 'Mirror bars'], ['freqs', 'Frequency ring'], ['none', 'None']];
const INTERVALS = [0, 8, 16, 30];
const CLIP_SECONDS = [5, 8, 10, 15];

export default function NextStage({ apiKey, audioURL, style, seconds }: { apiKey: string; audioURL: string; style: string; seconds: number }) {
  const [mode, setMode] = useState<Mode>('lofi');
  const [scene, setScene] = useState('cozy attic study at night, rain on the window, warm desk lamp, sleeping cat, lofi anime illustration');
  const [visualizer, setVisualizer] = useState('bars');
  const [interval, setInterval] = useState(0);
  const [clip, setClip] = useState(8);
  const [steps, setSteps] = useState<Step[]>([]);
  const [video, setVideo] = useState('');
  const [error, setError] = useState('');
  const busy = steps.some((s) => s.state === 'active');
  const ready = Boolean(apiKey && audioURL);

  function plan(labels: string[]) {
    setSteps(labels.map((label) => ({ label, state: 'todo' })));
  }
  function mark(index: number, state: Step['state']) {
    setSteps((current) => current.map((s, i) => (i === index ? { ...s, state } : s)));
  }

  async function lofi() {
    plan(['Draw the scene and render the loop']);
    mark(0, 'active');
    const done = await runJob(apiKey, {
      service: 'lofi_loop', audio_url: audioURL, scene_prompt: scene.trim(), visualizer, preset: 'drift', motion: 'drift',
      loop_seconds: interval, aspect_ratio: '16:9',
    }, ['video_url'], 'video', () => undefined);
    mark(0, 'done');
    return done.url;
  }

  async function motion() {
    plan(['Paint the first frame', `Animate a ${clip}s seamless loop`, 'Repeat it over the track']);
    mark(0, 'active');
    const still = await runJob(apiKey, {
      service: 'image', prompt: `${scene.trim()}, cinematic 16:9, soft film grain, no text`, width: 1280, height: 720,
    }, ['image_url', 'url'], 'video', () => undefined);
    mark(0, 'done'); mark(1, 'active');
    const loop = await runJob(apiKey, {
      service: 'video', prompt: `${scene.trim()}, subtle ambient motion only, static camera, seamless loop, same style throughout`,
      first_frame: still.url, loop: true, duration: clip, aspect_ratio: '16:9', size: 'balanced', output_format: 'mp4-h264',
    }, ['video_url', 'url'], 'video', () => undefined);
    mark(1, 'done'); mark(2, 'active');
    const tiled = await runJob(apiKey, { service: 'lofi_loop', audio_url: audioURL, video_url: loop.url }, ['video_url'], 'video', () => undefined);
    mark(2, 'done');
    return tiled.url;
  }

  async function start() {
    if (!ready) return;
    setVideo(''); setError('');
    try {
      setVideo(mode === 'lofi' ? await lofi() : await motion());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video generation failed');
      setSteps((current) => current.map((s) => (s.state === 'active' ? { ...s, state: 'todo' } : s)));
    }
  }

  return <section className={styles.next} data-testid="mr-next" aria-disabled={!audioURL}>
    <header><Film size={15} /><b>Next: make a video</b><span>{audioURL ? 'optional' : 'after the restyle'}</span></header>
    <div className={styles.modes} role="tablist">
      {(Object.keys(MODES) as Mode[]).map((key) => {
        const Icon = MODES[key].icon;
        return <button key={key} type="button" role="tab" aria-selected={mode === key} data-testid={`mr-next-${key}`}
          disabled={busy} onClick={() => setMode(key)}><Icon size={15} /><b>{MODES[key].name}</b><small>{MODES[key].detail}</small></button>;
      })}
    </div>
    {mode !== 'agent' && <label className={styles.scene}>Scene
      <textarea rows={2} maxLength={600} value={scene} disabled={busy} data-testid="mr-scene" onChange={(event) => setScene(event.target.value)} />
    </label>}
    {mode === 'lofi' && <div className={styles.row}>
      <label>Visualizer<select value={visualizer} disabled={busy} onChange={(event) => setVisualizer(event.target.value)}>
        {VISUALIZERS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Loop every<select value={interval} disabled={busy} data-testid="mr-interval" onChange={(event) => setInterval(Number(event.target.value))}>
        {INTERVALS.map((s) => <option key={s} value={s}>{s ? `${s} seconds` : 'Auto'}</option>)}</select></label>
    </div>}
    {mode === 'motion' && <div className={styles.row}>
      <label>Clip length<select value={clip} disabled={busy} data-testid="mr-clip" onChange={(event) => setClip(Number(event.target.value))}>
        {CLIP_SECONDS.map((s) => <option key={s} value={s}>{s} seconds</option>)}</select></label>
      <p>First and last frame match, so the clip repeats with no visible seam{seconds ? ` (about ${Math.ceil(seconds / clip)} times)` : ''}.</p>
    </div>}
    {mode === 'agent'
      ? <Link className={`${styles.go} ${ready ? '' : styles.off}`} data-testid="mr-agent-link" aria-disabled={!ready}
        href={ready ? trailerHref(audioURL, style) : '#'} onClick={(event) => { if (!ready) event.preventDefault(); }}>
        <Clapperboard size={16} /> Open the trailer agent with this track</Link>
      : <button type="button" className={styles.go} disabled={!ready || busy || !scene.trim()} data-testid="mr-video-run" onClick={() => void start()}>
        {busy ? <LoaderCircle className={styles.spin} size={16} /> : <Film size={16} />}
        {busy ? steps.find((s) => s.state === 'active')?.label : mode === 'lofi' ? 'Render lofi loop' : 'Render motion loop'}
      </button>}
    {steps.length > 1 && <ol className={styles.steps}>{steps.map((s) => <li key={s.label} data-state={s.state}>{s.label}</li>)}</ol>}
    {mode !== 'agent' && <small className={styles.cost}>{mode === 'lofi' ? 'Lofi loop render $0.12.' : 'Billed per step: image, H3 clip at the video rate, then the $0.12 loop render.'}</small>}
    {error && <div className={styles.error} data-testid="mr-video-error">{error}</div>}
    {video && <div className={styles.video} data-testid="mr-video">
      <video controls playsInline loop src={video} />
      <a href={video} download><Download size={14} /> Download video</a>
    </div>}
  </section>;
}
