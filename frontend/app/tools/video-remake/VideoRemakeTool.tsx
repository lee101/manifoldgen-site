'use client';

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, Film, Loader2, ScanSearch, Scissors, Sparkles, Upload, Wand2, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { parseJSONResponse } from '@/lib/http';
import styles from '../video-dramatizer/page.module.css';

const DEFAULT_GOAL = 'Remake every shot in one coherent next-generation AAA fantasy game cinematic language: Unreal Engine 5-quality stylized realism, physically based materials, expressive but game-faithful faces, detailed hair and cloth simulation, cinematic volumetric lighting, and clean modern rendering. Preserve every story beat, action, composition, camera movement, emotional progression, and cut. Never drift into generic live-action casting, anime, old low-poly game graphics, or another franchise aesthetic.';
const DEFAULT_SETTING = 'A unified medieval high-fantasy world with monumental ivory stone castles, oxidized brass airships, ancient forests, cobblestone or packed-earth roads, linen banners, worn leather, restrained luminous magic, atmospheric depth, and physically based surfaces. Warm ivory, brass, forest green, burgundy and jewel-tone accents remain stable across shots. No asphalt, cars, utility poles, modern signs, contemporary objects, neon, plastic theme-park surfaces, or science-fiction architecture.';
const DEFAULT_CHARACTERS = `Zidane — compact athletic young thief in his late teens with a narrow heart-shaped face, warm fair skin, bright teal-green eyes, straight brows, a small pointed nose, expressive mouth, and layered golden-blond hair gathered into a long low ponytail. One flexible tan monkey-like tail is real anatomy. He wears a cropped cobalt-blue sleeveless vest over a cream poet shirt with narrow black bow tie, fitted teal trousers, brown belts and pouches, cuffed leather boots, fingerless gloves, and two distinct curved daggers.
Garnet — seventeen-year-old princess with one unmistakable soft heart-shaped face, warm ivory-olive skin, large almond-shaped warm brown eyes, fine arched brows, a short delicate nose, defined cupid's-bow upper lip and fuller lower lip. Her glossy near-black hair is very long, straight and center-parted until the canonical haircut, after which the same face has a clean chin-length dark bob. She wears a white puff-sleeve fitted bodice, burnt-orange fitted lower jumpsuit and side belts, small crystal pendant, practical brown boots, and optional white-mage staff. Her performance is restrained and sincere; on the departing airship she looks downward over the rail crying, followed by a close-up where tears remain visible on the same face.
Vivi — small black mage, shadowed face, subtle glowing eyes, tall pointed hat, weathered blue coat, leather belts and brass buckles.
Steiner — tall broad-shouldered knight in his late thirties, stern weathered face, short dark hair, realistic worn plate armor.
Freya — elegant Burmecian dragoon with natural rat-like humanoid features, pink hair, red noble coat, winged hat, ornate lance; never dragon-like and never with wings.
Quina — unusual Qu chef with a long tongue, stained blue-and-white chef outfit.
Beatrix — striking general with long brown hair, one eye patch, intricate silver armor, Save the Queen sword.
Eiko — spirited child summoner with one stable round youthful face, large dark eyes, and a bright blue-violet chin-length bob. She alone has one real ivory anatomical horn growing from the center of her forehead. A separate saturated yellow bow sits in her hair and must never replace, cover, merge with, or become the horn. Her outfit has red draped sleeves and upper panels, yellow overall-like leg panels, warm accent stitching, and white boots; small wing-like back ornaments remain costume pieces rather than anatomy.
Amarant — tall muscular bounty hunter with red dreadlocks, blue skin, green vest and fitted green trousers.
Flying horned sorcerer enemy — a strange game-specific airborne elderly combatant seen from below: bald crown, extremely long divided white beard, elongated pointed ears or swept horn-like side anatomy, angular dark green triangular robe, pale yellow sleeves, thin red-brown legs and curled shoes, colorful wrist gems, rigid wing-like black mantle silhouette, and lightning around him. Preserve this eccentric silhouette; never turn him into Gandalf, a conventional robed human wizard, a staff-bearing sage, or a generic medieval magician.`;

type AgentStep = { name: string; label: string; status: 'running' | 'done' | 'failed'; detail?: string; elapsed_seconds?: number };
type PlannedShot = { id: string; seconds: number; visual_description?: string; image_prompt?: string; motion_prompt?: string; characters?: string[]; source_start?: number; source_end?: number; image_model?: string };
type RemakeReference = { id: string; kind: 'setting' | 'character'; name: string; image_url?: string; shot_ids?: string[]; error?: string };
type RemakeEstimate = {
  exact: boolean; shot_count: number; duration_seconds: number;
  base_images: number; reference_images: number; repair_images: number; total_images: number;
  motion_clips: number; motion_billable_seconds: number;
  image_unit_usd: number; image_cost_usd: number; reference_cost_usd: number; repair_reserve_usd: number;
  motion_unit_usd_per_second: number; motion_cost_usd: number; agent_cost_usd: number;
  estimated_cost_usd: number; estimated_credits: number; settlement: string;
};
type JobResult = {
  _agent_label?: string; _agent_steps?: AgentStep[];
  plan?: { shots?: PlannedShot[]; provider?: string };
  planner?: string; video_url?: string; project_url?: string;
  duration?: number; charged_usd?: number;
  references?: RemakeReference[]; reference_cost_usd?: number;
  estimate?: RemakeEstimate; agent_kind?: string;
};
type JobPayload = { job?: { status?: string; result?: JobResult; error?: string } };
type Phase = 'idle' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';

async function uploadVideo(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({ filename: file.name, content_type: file.type || 'video/mp4', dataset: 'video-remake' });
  const prepared = await parseJSONResponse<{ upload_url?: string; public_url?: string }>(
    await fetch(`/api/uploads/presign?${params}`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    'Could not prepare the source upload',
  );
  if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
  const response = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'video/mp4' }, body: file });
  if (!response.ok) throw new Error(`Source upload failed (${response.status})`);
  return prepared.public_url;
}

export default function VideoRemakeTool() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewURL, setPreviewURL] = useState('');
  const [sourceURL, setSourceURL] = useState('');
  const [estimate, setEstimate] = useState<RemakeEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const estimateSequence = useRef(0);
  const [duration, setDuration] = useState(0);
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [setting, setSetting] = useState(DEFAULT_SETTING);
  const [characterBible, setCharacterBible] = useState(DEFAULT_CHARACTERS);
  const [consistentCharacters, setConsistentCharacters] = useState(true);
  const [consistencyPasses, setConsistencyPasses] = useState(2);
  const [imageModel, setImageModel] = useState('gpt-image-2');
  const [maxShots, setMaxShots] = useState(60);
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<JobResult | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  useEffect(() => {
    if (!file) { setPreviewURL(''); return; }
    const url = URL.createObjectURL(file);
    setPreviewURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const currentUser = user || loadStoredUser();
    if (!sourceURL || !currentUser?.api_key) return;
    const sequence = ++estimateSequence.current;
    const timer = window.setTimeout(async () => {
      setEstimating(true);
      try {
        const payload = await parseJSONResponse<{ estimate?: RemakeEstimate }>(
          await fetch('/api/video-remake/estimate', {
            method: 'POST',
            headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: goal.trim() || 'Guided video remake', video_url: sourceURL,
              setting_prompt: setting.trim(), character_bible: characterBible.trim(),
              consistent_characters: consistentCharacters, consistency_passes: consistentCharacters ? consistencyPasses : 0,
              max_shots: maxShots, image_model: imageModel, video_model: 'minimax/h3-max/image-to-video', vision_model: 'gpt-5.6-luna',
            }),
          }),
          'Could not detect shots for pricing',
        );
        if (sequence === estimateSequence.current && payload.estimate) setEstimate(payload.estimate);
      } catch (reason) {
        if (sequence === estimateSequence.current) setError(reason instanceof Error ? reason.message : 'Could not estimate the remake');
      } finally {
        if (sequence === estimateSequence.current) setEstimating(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [sourceURL, user, setting, characterBible, consistentCharacters, consistencyPasses, imageModel, maxShots]);

  function choose(next?: File) {
    if (!next) return;
    if (!next.type.startsWith('video/')) { setError('Choose a video file.'); return; }
    if (next.size > 512 * 1024 * 1024) { setError('Videos must be 512 MB or smaller.'); return; }
    setFile(next); setSourceURL(''); setEstimate(null); setError(''); setResult(null); setDuration(0); setPhase('idle');
    const currentUser = user || loadStoredUser();
    if (currentUser?.api_key) {
      setEstimating(true);
      void uploadVideo(next, currentUser.api_key).then((url) => setSourceURL(url)).catch((reason) => {
        setEstimating(false);
        setError(reason instanceof Error ? reason.message : 'Could not upload the source for pricing');
      });
    }
  }

  async function run() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to run a video remake.'); return; }
    if (!file) { setError('Choose the source video first.'); return; }
    if (!goal.trim()) { setError('Describe the overall remake goal.'); return; }
    setError(''); setResult(null);
    try {
      let videoURL = sourceURL;
      if (!videoURL) {
        setPhase('uploading'); setStatus('Uploading the source…');
        videoURL = await uploadVideo(file, currentUser.api_key);
        setSourceURL(videoURL);
      }
      setPhase('queued'); setStatus('Queuing the remake agent…');
      const queued = await parseJSONResponse<{ result?: { job_id?: string; status_url?: string } }>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'video-dramatize', kind: 'remake', prompt: goal.trim(), video_url: videoURL,
            setting_prompt: setting.trim(), character_bible: characterBible.trim(), consistent_characters: consistentCharacters, consistency_passes: consistentCharacters ? consistencyPasses : 0,
            duration: Math.ceil(duration), num_images: maxShots, image_backend: imageModel,
            model: 'minimax/h3-max/image-to-video', prompt_expansion_mode: 'gpt-5.6-luna',
          }),
        }),
        'Could not start the remake',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The remake agent returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 3600; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read remake status',
        );
        const job = payload.job;
        if (job?.result) { setResult(job.result); if (job.result.estimate) setEstimate(job.result.estimate); setStatus(job.result._agent_label || status); }
        if (job?.status === 'completed') {
          setPhase('done'); setStatus('Your full-length remake is ready');
          const fresh = await refreshUser(currentUser.api_key);
          if (fresh) { setUser(fresh); saveUser(fresh); }
          return;
        }
        if (job?.status === 'failed' || job?.status === 'payment_required') throw new Error(job.error || 'The remake could not finish');
        setPhase(job?.status === 'processing' ? 'processing' : 'queued');
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
      throw new Error('The remake is still running and remains available in your account.');
    } catch (reason) {
      setPhase('error'); setStatus(''); setError(reason instanceof Error ? reason.message : 'The remake failed');
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';
  const assumedShots = Math.min(maxShots, Math.max(1, Math.ceil((duration || maxShots * 1.5) / 1.5)));
  const imageUSD = imageModel === 'gpt-image-2' ? 0.24 : 0.16;
  const referenceUSD = (setting.trim() ? 0.24 : 0) + (consistentCharacters ? 8 * 0.24 + 8 * consistencyPasses * imageUSD : 0);
  const provisionalUSD = referenceUSD + assumedShots * (imageUSD + 0.01) + ((duration || assumedShots * 1.5) + 5 * assumedShots) * 0.04 * 1.2;
  const estimateUSD = estimate?.estimated_cost_usd ?? provisionalUSD;
  const credits = estimate?.estimated_credits ?? Math.ceil(estimateUSD / (user?.credit_price_usd || 0.01));
  const shots = result?.plan?.shots || [];
  const references = result?.references || [];

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Scissors size={14} /> VIDEO REMAKE AGENT</div>
      <Link href="/account" className={styles.account}>{user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}</Link>
    </header>

    <section className={styles.hero}>
      <h1>Keep the film.<br /><span>Remake every shot.</span></h1>
      <p>Guide one coherent visual direction. The agent detects every cut, inspects and verbalizes each shot, writes image and motion prompts, rebuilds the picture, then restores the original length and soundtrack.</p>
    </section>

    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.drop} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }} onClick={() => inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept="video/*" hidden onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }} />
          {previewURL ? <video src={previewURL} muted playsInline controls onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} /> : <div className={styles.empty}><Upload size={28} /><b>Drop the source film</b><span>MP4, WebM, or MOV · up to 5 minutes / 512 MB</span></div>}
          {file && <div className={styles.dropMeta}><b>{file.name}</b><span>{duration ? `${duration.toFixed(3)} seconds` : 'Reading duration…'}</span></div>}
        </div>
        {file && <button type="button" className={styles.ghost} onClick={() => { estimateSequence.current += 1; setFile(null); setSourceURL(''); setEstimate(null); setEstimating(false); setResult(null); }}><X size={13} /> Remove source</button>}

        <label className={styles.field}>
          <span>Overall remake goal</span>
          <textarea value={goal} maxLength={6000} rows={7} onChange={(event) => setGoal(event.target.value)} placeholder="Describe the character bible, world, style, continuity rules, and creative goal…" />
          <small>DeepSeek applies this goal while writing separate visual, image-edit, and motion prompts for every detected shot.</small>
        </label>

        <label className={styles.field}>
          <span>World and setting bible</span>
          <textarea value={setting} maxLength={4000} rows={4} onChange={(event) => setSetting(event.target.value)} placeholder="Define period, architecture, materials, palette, technology, and things that must never appear…" />
          <small>GPT Image 2 builds one shared world board and supplies it to every shot.</small>
        </label>

        <label className={styles.toggle}>
          <input type="checkbox" checked={consistentCharacters} onChange={(event) => setConsistentCharacters(event.target.checked)} />
          <span><b>Consistent recurring characters</b><small>Vision tags who appears in every shot; GPT Image 2 builds up to eight reusable identity sheets.</small></span>
        </label>

        {consistentCharacters && <label className={styles.field}>
          <span>Canonical character bible</span>
          <textarea value={characterBible} maxLength={12000} rows={9} onChange={(event) => setCharacterBible(event.target.value)} placeholder="One canonical name and identity description per recurring character…" />
          <small>Be explicit about anatomy and negative constraints—for example, “a real horn, never a headband.”</small>
        </label>}

        <div className={styles.options}>
          <label><span>Frame restyle model</span><select value={imageModel} onChange={(event) => setImageModel(event.target.value)}><option value="nano-banana-2">Google Nano Banana 2 · $0.16/shot</option><option value="gpt-image-2">GPT Image 2 · $0.24/shot</option></select></label>
          <label><span>Maximum detected shots</span><select value={maxShots} onChange={(event) => setMaxShots(Number(event.target.value))}><option value={30}>30 shots</option><option value={45}>45 shots</option><option value={60}>60 shots</option><option value={80}>80 shots</option></select></label>
          {consistentCharacters && <label><span>Identity repair passes</span><select value={consistencyPasses} onChange={(event) => setConsistencyPasses(Number(event.target.value))}><option value={1}>1 bounded pass</option><option value={2}>2 bounded passes</option><option value={3}>3 bounded passes</option></select></label>}
        </div>

        <button className={styles.run} type="button" disabled={busy || estimating || !file || !goal.trim()} onClick={() => void run()}>{busy || estimating ? <Loader2 className={styles.spin} size={18} /> : <Wand2 size={18} />}{busy ? status || 'Working…' : estimating ? 'Detecting shots and pricing…' : 'Approve estimate and remake'}</button>
        <div className={styles.price}>
          <span>{estimate?.exact ? `${estimate.shot_count} detected shots · ${estimate.total_images} max images · ${estimate.motion_clips} H3 clips / ${estimate.motion_billable_seconds}s` : estimating ? 'Uploading and detecting real shot boundaries…' : 'Provisional ceiling until the source is analysed'}</span>
          <b>~{credits} credits · ${estimateUSD.toFixed(2)}</b>
        </div>
        {estimate?.exact && <div className={styles.price}><span>GPT images ${estimate.image_cost_usd.toFixed(2)} · references ${estimate.reference_cost_usd.toFixed(2)} · repair reserve ${estimate.repair_reserve_usd.toFixed(2)} · H3 ${estimate.motion_cost_usd.toFixed(2)} · agent ${estimate.agent_cost_usd.toFixed(2)}</span><b>Final charge uses successful work</b></div>}
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}><span>{result?.video_url ? 'FINISHED REMAKE' : 'DIRECTOR WORKSPACE'}</span>{result?.video_url && <span className={styles.ready}><Check size={13} /> EXACT SOUNDTRACK</span>}</div>
        <div className={styles.preview}>{result?.video_url ? <video src={result.video_url} controls playsInline /> : <div className={styles.empty}>{busy ? <Loader2 className={styles.spin} size={30} /> : <Film size={30} />}<b>{busy ? status : 'The remade film will play here'}</b><span>Every failed replacement falls back to its original shot, never a missing timeline gap.</span></div>}</div>

        {(result?._agent_steps?.length || 0) > 0 && <ol className={styles.steps}>{result!._agent_steps!.map((step) => <li key={step.name} className={styles[step.status]}><i>{step.status === 'done' ? <Check size={12} /> : step.status === 'failed' ? <X size={12} /> : <Loader2 className={styles.spin} size={12} />}</i><span><b>{step.label}</b>{step.detail && <small>{step.detail}</small>}</span>{step.elapsed_seconds ? <em>{step.elapsed_seconds.toFixed(0)}s</em> : null}</li>)}</ol>}

        {references.length > 0 && <div className={styles.references}><div className={styles.shotsHead}><span><Sparkles size={13} /> CONSISTENCY REFERENCES</span><small>{result?.reference_cost_usd ? `$${result.reference_cost_usd.toFixed(2)}` : ''}</small></div><div className={styles.referenceGrid}>{references.map((reference) => <div key={`${reference.kind}-${reference.id}`} className={styles.referenceCard}>{reference.image_url ? <img src={reference.image_url} alt={`${reference.name} reference`} /> : <div className={styles.referenceMissing}><X size={15} /></div>}<span><b>{reference.name}</b><small>{reference.kind === 'character' ? `${reference.shot_ids?.length || 0} tagged shots` : 'All shots'}{reference.error ? ' · unavailable' : ''}</small></span></div>)}</div></div>}

        {shots.length > 0 && <div className={styles.shots}><div className={styles.shotsHead}><span><ScanSearch size={13} /> DETECTED SHOTS</span><small>{result?.planner}</small></div>{shots.map((shot) => <div key={shot.id} className={styles.shot} data-kind="restyled_source"><b>{shot.id}</b><span>{shot.visual_description || shot.image_prompt}{shot.characters?.length ? ` · ${shot.characters.join(', ')}` : ''}</span><em>{shot.seconds.toFixed(2)}s</em></div>)}</div>}

        <div className={styles.footer}><span>{result?.duration ? `${result.duration.toFixed(3)}s${result.charged_usd ? ` · $${result.charged_usd.toFixed(2)}` : ''}` : 'Source dimensions, runtime, cut order, and soundtrack are preserved.'}</span><div className={styles.actions}>{result?.video_url && <a href={result.video_url} download><Download size={15} /> Download</a>}{result?.project_url && <Link href={result.project_url} className={styles.primary}><Sparkles size={15} /> Guide in editor</Link>}</div></div>
      </div>
    </section>

    <section className={styles.notes}>
      <div><Scissors size={17} /><span><b>Shot-aware</b>Scene-score peaks are coalesced so flashes do not become dozens of false cuts.</span></div>
      <div><ScanSearch size={17} /><span><b>Identity-aware</b>Vision assigns stable character IDs per shot, then the renderer attaches only the matching identity sheets.</span></div>
      <div><Film size={17} /><span><b>Timeline-safe</b>Each replacement is trimmed to its source window, with original footage used as a no-gap fallback.</span></div>
    </section>
  </main>;
}
