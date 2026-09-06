'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clapperboard, Download, Film, Loader2, ScanSearch, Sparkles, Wand2, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { parseJSONResponse } from '@/lib/http';
import { TRAILER_EXAMPLES } from '@/lib/trailer-examples';
import styles from '../video-dramatizer/page.module.css';

type AgentStep = { name: string; label: string; status: 'running' | 'done' | 'failed'; detail?: string; elapsed_seconds?: number };
type PlannedShot = { id: string; seconds: number; visual_description?: string; image_prompt?: string; motion_prompt?: string; characters?: string[]; dialogue_transcript?: string };
type TrailerReference = { id: string; kind: 'setting' | 'character'; name: string; image_url?: string; error?: string };
type JobResult = {
  _agent_label?: string; _agent_steps?: AgentStep[];
  plan?: { shots?: PlannedShot[] };
  planner?: string; video_url?: string; audio_url?: string; project_url?: string;
  duration?: number; charged_usd?: number; references?: TrailerReference[];
};
type JobPayload = { job?: { status?: string; result?: JobResult; error?: string } };
type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';

export default function TrailerAgentTool({ example = '' }: { example?: string }) {
  const pack = TRAILER_EXAMPLES[example] || TRAILER_EXAMPLES['conjurers-soul'];
  const [user, setUser] = useState<StoredUser | null>(null);
  const [brief, setBrief] = useState(pack.brief);
  const [setting, setSetting] = useState(pack.setting);
  const [characterBible, setCharacterBible] = useState(pack.characters);
  const [music, setMusic] = useState(pack.music);
  const [lyrics, setLyrics] = useState(pack.lyrics);
  const [consistentCharacters, setConsistentCharacters] = useState(true);
  const [consistencyPasses, setConsistencyPasses] = useState(2);
  const [maxShots, setMaxShots] = useState(8);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<JobResult | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  async function run(sketch: boolean) {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to run the trailer agent.'); return; }
    if (!brief.trim()) { setError('A trailer brief is required.'); return; }
    setError(''); setResult(null);
    try {
      setPhase('queued'); setStatus(sketch ? 'Queuing the Z-Image sketch…' : 'Queuing the trailer agent…');
      const queued = await parseJSONResponse<{ result?: { job_id?: string; status_url?: string } }>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'video-dramatize', kind: 'trailer', sketch,
            prompt: brief.trim(), setting_prompt: setting.trim(), character_bible: characterBible.trim(),
            consistent_characters: consistentCharacters, consistency_passes: consistentCharacters ? consistencyPasses : 0,
            num_images: maxShots, duration: 5, image_backend: sketch ? 'zimage' : 'gpt-image-2',
            music_prompt: music.trim(), lyrics: lyrics.trim(), prompt_expansion_mode: 'grok-4.6',
          }),
        }),
        'Could not start the trailer agent',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The trailer agent returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 3600; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read trailer status',
        );
        const job = payload.job;
        if (job?.result) { setResult(job.result); setStatus(job.result._agent_label || status); }
        if (job?.status === 'completed') {
          setPhase('done'); setStatus(sketch ? 'Sketch plates are ready' : 'Trailer is ready');
          const fresh = await refreshUser(currentUser.api_key);
          if (fresh) { setUser(fresh); saveUser(fresh); }
          return;
        }
        if (job?.status === 'failed' || job?.status === 'payment_required') throw new Error(job.error || 'The trailer agent could not finish');
        setPhase(job?.status === 'processing' ? 'processing' : 'queued');
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
      throw new Error('The trailer is still running and remains in your account.');
    } catch (reason) {
      setPhase('error'); setStatus(''); setError(reason instanceof Error ? reason.message : 'The trailer agent failed');
    }
  }

  const busy = phase === 'queued' || phase === 'processing';
  const shots = result?.plan?.shots || [];
  const references = result?.references || [];
  const stills = (result?.plan?.shots || []).length;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}>All tools</Link>
      <div className={styles.brand}><Clapperboard size={14} /> CINEMATIC TRAILER AGENT</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>

    <section className={styles.hero}>
      <h1>One brief.<br /><span>Locked characters.</span></h1>
      <p>Grok 4.6 writes the cut. Sketch on Z-Image until the world and faces hold. Then GPT Image 2 builds identity sheets, Flash reviews 800px stills, style-transfers into start frames, and H3 animates the accepted stills driven by Gemini speech mixed with the score.</p>
    </section>

    <section className={styles.workspace}>
      <div className={styles.controls}>
        <label className={styles.field}>
          <span>Trailer brief</span>
          <textarea value={brief} maxLength={8000} rows={10} onChange={(event) => setBrief(event.target.value)} placeholder="Story, tone, SHOT 1 — 5 seconds. …" />
          <small>Include SHOT lines to lock the cut. Otherwise Grok 4.6 plans eight 5s shots from the brief.</small>
        </label>
        <label className={styles.field}>
          <span>World, lore, aesthetic</span>
          <textarea value={setting} maxLength={4000} rows={5} onChange={(event) => setSetting(event.target.value)} />
        </label>
        <label className={styles.toggle}>
          <input type="checkbox" checked={consistentCharacters} onChange={(event) => setConsistentCharacters(event.target.checked)} />
          <span><b>Consistent characters</b><small>Identity sheets first. Every start frame must match the sheet or it is regenerated.</small></span>
        </label>
        {consistentCharacters && <label className={styles.field}>
          <span>Character bible</span>
          <textarea value={characterBible} maxLength={12000} rows={8} onChange={(event) => setCharacterBible(event.target.value)} />
        </label>}
        <label className={styles.field}>
          <span>Score prompt</span>
          <textarea value={music} maxLength={2000} rows={3} onChange={(event) => setMusic(event.target.value)} />
        </label>
        <div className={styles.options}>
          <label><span>Shots</span><select value={maxShots} onChange={(event) => setMaxShots(Number(event.target.value))}><option value={6}>6</option><option value={8}>8</option><option value={10}>10</option><option value={12}>12</option></select></label>
          {consistentCharacters && <label><span>Identity repair passes</span><select value={consistencyPasses} onChange={(event) => setConsistencyPasses(Number(event.target.value))}><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option></select></label>}
        </div>
        <button className={styles.run} type="button" disabled={busy || !brief.trim()} onClick={() => void run(true)}>{busy ? <Loader2 className={styles.spin} size={18} /> : <Wand2 size={18} />}{busy ? status || 'Working…' : 'Sketch on Z-Image'}</button>
        <button className={styles.run} type="button" style={{ marginTop: 8 }} disabled={busy || !brief.trim()} onClick={() => void run(false)}>{busy ? <Loader2 className={styles.spin} size={18} /> : <Sparkles size={18} />}{busy ? status || 'Working…' : 'Make the trailer (GPT Image + H3)'}</button>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{result?.video_url ? 'TRAILER' : 'PLATES'}</span>{result?.video_url && <span className={styles.ready}><Check size={13} /> MASTER</span>}</div>
        <div className={styles.preview}>{result?.video_url ? <video src={result.video_url} controls playsInline /> : <div className={styles.empty}>{busy ? <Loader2 className={styles.spin} size={30} /> : <Film size={30} />}<b>{busy ? status : 'Sheets and start frames land here'}</b><span>Sketch first. H3 only runs after identity holds.</span></div>}</div>
        {(result?._agent_steps?.length || 0) > 0 && <ol className={styles.steps}>{result!._agent_steps!.map((step) => <li key={step.name} className={styles[step.status]}><i>{step.status === 'done' ? <Check size={12} /> : step.status === 'failed' ? <X size={12} /> : <Loader2 className={styles.spin} size={12} />}</i><span><b>{step.label}</b>{step.detail && <small>{step.detail}</small>}</span>{step.elapsed_seconds ? <em>{step.elapsed_seconds.toFixed(0)}s</em> : null}</li>)}</ol>}
        {references.length > 0 && <div className={styles.references}><div className={styles.shotsHead}><span><Sparkles size={13} /> WORLD + SHEETS</span></div><div className={styles.referenceGrid}>{references.map((reference) => <div key={`${reference.kind}-${reference.id}`} className={styles.referenceCard}>{reference.image_url ? <img src={reference.image_url} alt={reference.name} /> : <div className={styles.referenceMissing}><X size={15} /></div>}<span><b>{reference.name}</b><small>{reference.kind}{reference.error ? ' · unavailable' : ''}</small></span></div>)}</div></div>}
        {shots.length > 0 && <div className={styles.shots}><div className={styles.shotsHead}><span><ScanSearch size={13} /> SHOTS</span><small>{result?.planner}</small></div>{shots.map((shot) => <div key={shot.id} className={styles.shot} data-kind="generated"><b>{shot.id}</b><span>{shot.visual_description || shot.image_prompt}{shot.dialogue_transcript ? ` · ${shot.dialogue_transcript}` : ''}</span><em>{shot.seconds}s</em></div>)}</div>}
        <div className={styles.footer}><span>{result?.duration ? `${result.duration.toFixed(1)}s${result.charged_usd ? ` · $${result.charged_usd.toFixed(2)}` : ''}` : stills ? `${stills} planned shots` : 'Grok 4.6 · Z-Image sketch · GPT Image sheets · Flash 800px · Gemini TTS · H3 cog · Music3'}</span><div className={styles.actions}>{result?.video_url && <a href={result.video_url} download><Download size={15} /> Download</a>}{result?.project_url && <Link href={result.project_url} className={styles.primary}><Sparkles size={15} /> Open in Studio</Link>}</div></div>
      </div>
    </section>
  </main>;
}
