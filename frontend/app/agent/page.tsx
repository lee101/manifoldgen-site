'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Clapperboard, Loader2, Play, Sparkles } from 'lucide-react';
import { loadStoredUser, type StoredUser } from '@/lib/auth';
import { DEFAULT_ADJUSTMENTS } from '@/lib/studio-renderer';
import { parseJSONResponse } from '@/lib/http';
import styles from './page.module.css';

const TRAILER_BRIEF = `Create an epic 16:9 fantasy game trailer for Big Multiplayer Chess. The world is a colossal, physically real chessboard battlefield rendered like a high-end Unreal Engine cinematic. Four armies converge: the Black King is ancient and evil, the White King is noble and good, the Red King is fierce and impulsive, and the Blue King is cold and strategic. Pawns are disciplined spearmen wearing unmistakable pawn-shaped helmets. Knights are armored horse riders. Bishops are mystical war-priests. Rooks are enormous warriors in fortress armor with castle-shaped helmets. Keep the four faction designs and colors consistent. Use spoken character dialogue inside the shots, not a narrator. Build from ominous character reveals to cavalry, armies colliding, and a four-king confrontation. End on the Big Multiplayer Chess logo.`;

const SHOTS = [
  `SHOT 1 — 5 seconds. Ultra-wide aerial descent over an endless colossal chessboard carved into a storm-battered obsidian plain, four enormous armies gathering at the black, ivory, crimson and cobalt edges. Pawn spearmen in pawn-shaped helmets lower thousands of spears in perfect ranks. High-definition Unreal Engine fantasy cinematic, physically based materials, ArtStation-quality character design, coherent scale, 16:9. Thunder, distant war horns, no narration.`,
  `SHOT 2 — 5 seconds. Intimate low-angle character reveal of the Black King: ancient male tyrant in jagged obsidian crown armor, ember-red eyes, ash drifting through a ruined black throne hall, evil but regal rather than monstrous. Slow dolly inward. He looks directly toward the battlefield and says in a deep restrained voice: “Every board belongs to the dark.” Precise lip sync, cinematic native dialogue and room acoustics, Unreal Engine realism, 16:9.`,
  `SHOT 3 — 5 seconds. Heroic close character shot of the White King: noble weathered male ruler in ivory plate and luminous silver crown, dawn breaking behind a cathedral fortress, white pawn-spearmen kneeling then rising. Slow orbit, volumetric sunlight. He calmly answers: “Not while one piece still stands.” Precise lip sync, natural spoken dialogue, high-end fantasy game cinematic, 16:9.`,
  `SHOT 4 — 5 seconds. Smash cut between the Red King and Blue King facing one another across a rain-slick chess square. Red King: fierce woman in crimson crown armor, sparks and banners whipping, says “Then let the board burn.” Blue King: cold tactical man in cobalt geometric armor amid icy mist, replies “You have already lost.” Clear separate voices and lip sync, dramatic shot-reverse-shot, Unreal Engine cinematic, 16:9.`,
  `SHOT 5 — 5 seconds. Armored knight cavalry erupts into motion across giant marble chess squares: horse riders wearing crested knight-shaped helms leap a shattered rank of pawn spearmen. Camera races inches above the ground beside iron hooves, debris and rain in slow motion, readable black versus white faction colors, premium physically based fantasy action, native battle audio, no narration, 16:9.`,
  `SHOT 6 — 5 seconds. A mystical bishop war-priest strides diagonally through the battle, tall mitre-shaped helm and layered ceremonial armor, sweeping a staff to part ranks with a radiant diagonal wall of energy. Match cut to an enemy bishop countering with shadow magic. Dynamic crane move, tactical chess geometry remains visually clear, spectacular but grounded Unreal Engine VFX, 16:9.`,
  `SHOT 7 — 5 seconds. The rook enters: a gigantic fortress warrior three times the height of a pawn, brutal stone-and-steel armor and an unmistakable castle-shaped helmet, charging in a perfectly straight line through siege smoke and smashing shields aside. Low camera shakes with every step. Pawn spearmen rally around its feet. Massive scale, ArtStation-quality detail, cinematic native impacts, 16:9.`,
  `SHOT 8 — 5 seconds. Final four-way confrontation at the glowing center square. Black, White, Red and Blue Kings advance from four directions as their surviving armies collide behind them. Fast heroic close-ups, then a silent overhead tableau like a living chess position. The White King says: “Your move.” A colossal shockwave slams the armies together and hard cuts to black. Precise dialogue, coherent established character designs, Unreal Engine fantasy trailer climax, 16:9.`,
];

const MUSIC_PROMPT = `Epic dark-fantasy trailer score, 100 BPM rising to 132 BPM, low war drums, taiko, cellos, French horns, metallic chess-piece percussion, four-note motif passed between sinister male choir, noble mixed choir, fierce female chant and cold whisper ensemble. Sparse ominous opening, escalating cavalry ostinato, huge final impact at 39 seconds, then three seconds of resonant silence for a logo. No modern pop beat.`;
const LYRICS = `[Intro - whispered]
Four crowns. One board.

[Build - low choir]
Black as night, white as dawn,
Red the flame, blue the storm.

[Chorus - full choir]
Rank by rank, the kingdoms rise,
Every move, a world decides.

[Final - shouted]
Your move!`;

const REVIEW_MASTER = 'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/bigmultiplayerchess-trailer-v1.mp4';
const REVIEW_MUSIC = 'https://manifoldgenstatic.manifoldgen.com/createdmusic/bmc-four-crowns-1787448565.wav';
const REVIEW_CLIPS = [
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/01-four-armies-d9a1d6ec-dbe6-497a-b306-07d4131236a1.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/02-black-king-21dcb6ef-b1c4-41b9-a05a-b9e4d251058b.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/03-white-king-92dc5204-ebf9-4f79-a48f-019e7a8d1bd2.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/04-red-blue-kings-1f244ba4-af70-43b3-a5d4-e438353031e6.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/05-knight-charge-98603c19-eddb-45d8-aaa4-37144447003a.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/06-bishop-duel-fd83ec34-3f9b-4876-895b-5cf621e2ef25.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/07-rook-assault-4d802611-766e-4459-b4f9-af5a2205f550.mp4',
  'https://manifoldgenstatic.manifoldgen.com/gallery/testreview/bigmultiplayerchess/08-four-kings-climax-bcfbbd59-0790-45c1-8e8b-fc23c74118bb.mp4',
];

type Step = { label: string; state: 'waiting' | 'running' | 'done' | 'failed'; detail?: string };
type Job = { status?: string; result?: unknown; error?: string };

function auth(key: string) { return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }; }
function resultJobID(value: unknown): string {
  const root = value as { result?: { job_id?: string }; job_id?: string };
  return root?.result?.job_id || root?.job_id || '';
}
function mediaURL(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.startsWith('http') ? value : '';
  if (Array.isArray(value)) return value.map(mediaURL).find(Boolean) || '';
  if (typeof value !== 'object') return '';
  const item = value as Record<string, unknown>;
  for (const key of ['video_url', 'audio_url', 'output_url', 'url', 'saved_video_url']) {
    if (typeof item[key] === 'string' && String(item[key]).startsWith('http')) return String(item[key]);
  }
  for (const key of ['result', 'output', 'data', 'video', 'audio']) {
    const found = mediaURL(item[key]); if (found) return found;
  }
  return '';
}

async function poll(path: string, key: string, attempts = 1200) {
  for (let i = 0; i < attempts; i += 1) {
    const payload = await parseJSONResponse<{ job?: Job }>(await fetch(path, { headers: auth(key) }), 'Could not read generation status');
    const job = payload.job || {};
    if (job.status === 'completed') { const url = mediaURL(job.result); if (!url) throw new Error('Generation completed without media'); return url; }
    if (job.status === 'failed' || job.status === 'payment_required' || job.status === 'cancelled') throw new Error(job.error || `Generation ${job.status}`);
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }
  throw new Error('Generation is still running; it remains in your account');
}

async function publishStudioProject(apiKey: string, clipURLs: string[], musicURL: string) {
  const projectID = crypto.randomUUID();
  const base = { adjustments: DEFAULT_ADJUSTMENTS, visualTrack: 0, volume: 1, fadeIn: 0, fadeOut: 0, sourceAudioMuted: false, stageX: .5, stageY: .5, stageScale: 1, stageRotation: 0 };
  const assets = clipURLs.map((url, index) => ({
    ...base, id: crypto.randomUUID(), name: `${String(index + 1).padStart(2, '0')} ${['Four armies','Black King','White King','Red and Blue','Knight charge','Bishop duel','Rook assault','Your move'][index]}.mp4`,
    kind: 'video', duration: 5, width: 1344, height: 768, trimStart: 0, trimEnd: 5, timelineStart: index * 5,
    cloudURL: url, contentType: 'video/mp4', size: 0, lastModified: Date.now(),
  }));
  assets.push({ ...base, id: crypto.randomUUID(), name: 'Big Multiplayer Chess end card.png', kind: 'image', duration: 3, width: 1680, height: 941, trimStart: 0, trimEnd: 3, timelineStart: 40, cloudURL: `${window.location.origin}/brand/bigmultiplayerchess-end-card.png`, contentType: 'image/png', size: 0, lastModified: Date.now() });
  const audio = { ...base, id: crypto.randomUUID(), name: 'Four Crowns trailer score.wav', kind: 'audio', duration: 43, width: 1, height: 1, trimStart: 0, trimEnd: 43, timelineStart: 0, cloudURL: musicURL, contentType: 'audio/wav', size: 0, lastModified: Date.now(), volume: .24 };
  const document = { version: 5, selectedID: assets[0].id, canvas: { width: 1920, height: 1080 }, audioTrackVolume: 1, assets: [...assets, audio], history: { undo: [], redo: [] } };
  await parseJSONResponse(await fetch(`/api/studio/projects/${projectID}`, { method: 'PUT', headers: auth(apiKey), body: JSON.stringify({ name: 'Big Multiplayer Chess — Four Crowns Trailer', document }) }), 'Could not publish Studio project');
  return `/studio?project=${encodeURIComponent(projectID)}`;
}

export default function AgentPage() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [brief, setBrief] = useState(TRAILER_BRIEF);
  const [steps, setSteps] = useState<Step[]>([
    { label: 'Plan cinematic shots', state: 'waiting' }, { label: 'Generate 8 H3 clips', state: 'waiting' },
    { label: 'Compose Music3 score', state: 'waiting' }, { label: 'Build Studio timeline', state: 'waiting' },
  ]);
  const [projectURL, setProjectURL] = useState('');
  const [error, setError] = useState('');
  const busy = steps.some((step) => step.state === 'running');
  const estimatedUSD = useMemo(() => 8 * 1.4 + .35, []);
  useEffect(() => setUser(loadStoredUser()), []);

  function mark(index: number, state: Step['state'], detail?: string) {
    setSteps((current) => current.map((step, i) => i === index ? { ...step, state, detail } : step));
  }

  async function createTrailer() {
    const current = user || loadStoredUser();
    if (!current?.api_key) { setError('Sign in before running the trailer agent.'); return; }
    setError(''); setProjectURL('');
    setSteps((items) => items.map((item) => ({ ...item, state: 'waiting', detail: undefined })));
    try {
      mark(0, 'running');
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      mark(0, 'done', `${SHOTS.length} continuity-locked shots · 43 second cut`);

      mark(1, 'running', 'Submitting all shots in parallel');
      const videoJobs = await Promise.all(SHOTS.map(async (shot) => {
        const response = await parseJSONResponse<unknown>(await fetch('/api/service', {
          method: 'POST', headers: auth(current.api_key),
          body: JSON.stringify({ service: 'h3_video', prompt: `${brief}\n\n${shot}`, aspect_ratio: '16:9', size: 'native', duration: 5, num_steps: 28, output_format: 'mp4-h264', include_audio: true, structured_prompt: true }),
        }), 'Could not queue an H3 shot');
        const id = resultJobID(response); if (!id) throw new Error('H3 returned no job'); return id;
      }));

      mark(2, 'running', 'Composing the four-faction theme');
      const musicQueued = await parseJSONResponse<{ result?: { job_id?: string }; audio_url?: string }>(await fetch('/api/studio/generate-music', {
        method: 'POST', headers: auth(current.api_key), body: JSON.stringify({ prompt: MUSIC_PROMPT, lyrics: LYRICS, duration: 43 }),
      }), 'Could not start Music3');
      const musicJobID = musicQueued.result?.job_id || '';
      if (!musicQueued.audio_url && !musicJobID) throw new Error('Music3 returned no job');
      const musicPromise = musicQueued.audio_url ? Promise.resolve(musicQueued.audio_url) : poll(`/api/audio-jobs/${musicJobID}`, current.api_key);
      const clipURLs = await Promise.all(videoJobs.map((id) => poll(`/api/video-jobs/${id}`, current.api_key)));
      mark(1, 'done', `${clipURLs.length} clips ready with native dialogue`);
      const musicURL = await musicPromise;
      mark(2, 'done', '43 second score and choir lyrics ready');

      mark(3, 'running', 'Publishing editable cloud project');
      const url = await publishStudioProject(current.api_key, clipURLs, musicURL);
      setProjectURL(url); mark(3, 'done', 'Every shot, score, and end card is editable');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The trailer agent failed');
      setSteps((items) => items.map((item) => item.state === 'running' ? { ...item, state: 'failed' } : item));
    }
  }

  async function openReviewCut() {
    const current = user || loadStoredUser();
    if (!current?.api_key) { setError('Sign in to copy the review cut into Studio.'); return; }
    setError(''); mark(3, 'running', 'Copying the rendered assets into your project');
    try { const url = await publishStudioProject(current.api_key, REVIEW_CLIPS, REVIEW_MUSIC); setProjectURL(url); mark(3, 'done', 'Review cut copied into your Studio'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not create the Studio project'); mark(3, 'failed'); }
  }

  return <main className={styles.page}>
    <nav><Link href="/">MANIFOLDGEN</Link><span>/ AGENT</span><Link href="/studio">Studio</Link></nav>
    <header><span><Clapperboard size={16} /> CINEMATIC TRAILER AGENT</span><h1>One brief.<br /><em>A real edit.</em></h1><p>The agent writes continuity-safe H3 shots, generates dialogue and a Music3 score, then lays everything into an editable cloud Studio project.</p></header>
    <section className={styles.grid}>
      <div className={styles.brief}><label>Creative brief<textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows={14} /></label><div className={styles.meta}><span>8 × 5s H3 shots</span><span>43s Music3 score</span><span>16:9 master</span></div><button onClick={() => void createTrailer()} disabled={busy || !brief.trim()}>{busy ? <Loader2 className={styles.spin} /> : <Sparkles />} {busy ? 'Agent is working…' : 'Make the trailer project'}</button><small>Estimated generation cost ~${estimatedUSD.toFixed(2)}. You are charged only for successful generations.</small>{error && <p className={styles.error}>{error}</p>}</div>
      <div className={styles.run}><div className={styles.poster}><video src={REVIEW_MASTER} poster="/brand/bigmultiplayerchess-end-card.png" controls playsInline /><span><Play fill="currentColor" /> RENDERED REVIEW CUT · 43 SEC</span></div><ol>{steps.map((step) => <li key={step.label} data-state={step.state}>{step.state === 'done' ? <Check /> : step.state === 'running' ? <Loader2 className={styles.spin} /> : <i /> }<span><b>{step.label}</b><small>{step.detail || step.state}</small></span></li>)}</ol>{projectURL ? <Link className={styles.open} href={projectURL}>Open the project in Studio →</Link> : <button className={styles.open} onClick={() => void openReviewCut()}>Copy this review cut into Studio →</button>}<a className={styles.download} href={REVIEW_MASTER} download>Download 1080p master</a></div>
    </section>
    <section className={styles.story}><h2>The trailer story</h2>{SHOTS.map((shot, index) => <article key={shot}><b>{String(index + 1).padStart(2, '0')}</b><p>{shot.replace(/^SHOT \d+ — 5 seconds\. /, '')}</p></article>)}</section>
  </main>;
}
