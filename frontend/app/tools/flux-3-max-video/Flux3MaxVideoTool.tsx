'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Clapperboard, Download, Image as ImageIcon, LoaderCircle, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../../lib/auth';
import { parseJSONResponse } from '../../../lib/http';
import styles from '../audio-spaces.module.css';
import { sleep, uploadToR2 } from '../character-swap/CharacterSwapTool';
import VideoDownload from '../../../components/video-download';

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type Mode = 'text' | 'image' | 'keyframes';
type ServiceResponse = { result?: { job_id?: string; status_url?: string }; estimated_cost_usd?: number; estimated_credits?: number };
type JobPayload = { job?: { status?: string; error?: string; result?: { video_url?: string; charged_usd?: number; credits_used?: number; seed?: number } } };
type Keyframe = { id: number; url: string; index: number };

export const RATE_USD = { '720p': 0.17, '1080p': 0.29 } as const;
export const ASPECTS = ['auto', '21:9', '2:1', '16:9', '4:3', '1:1', '3:4', '9:16'] as const;
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 20;
export const FPS = 24;
export const MAX_KEYFRAMES = 10;
const MODES: { id: Mode; label: string }[] = [{ id: 'text', label: 'Text' }, { id: 'image', label: 'Image' }, { id: 'keyframes', label: 'Keyframes' }];
const PROMPTS_EXAMPLE: Record<Mode, string> = {
  text: 'A red panda walks along a mossy log in a sunlit forest, pausing to sniff the air before climbing over a fallen branch. Soft morning light filters through the canopy. Ambient birdsong and rustling leaves.',
  image: 'Slow cinematic push-in toward the lighthouse as waves roll against the rocks and clouds drift across the golden sky. Gulls cry in the distance with the sound of surf.',
  keyframes: 'The woman picks up a brown felt fedora, lifts it onto her head with both hands and adjusts the brim, smiling at the camera. Soft studio light against a plain gray wall.',
};
const PROMPTS: Record<Mode, string> = {
  text: 'A red panda walks along a mossy log in a sunlit forest, pausing to sniff the air before climbing over a fallen branch. Soft morning light filters through the canopy. Ambient birdsong and rustling leaves.',
  image: 'The camera slowly pushes in as the subject turns toward the lens and smiles. Soft wind moves through the scene, with ambient sound and gentle music.',
  keyframes: 'The subject moves naturally from the first image to the last, with smooth continuous motion and matching ambient sound.',
};

const EXAMPLE_BASE = 'https://manifoldgenstatic.manifoldgen.com/static/tools/flux-3-max-video';
export const EXAMPLES: Record<Mode, { title: string; inputs: string[]; output: string; poster: string; summary: string }> = {
  text: { title: 'Text to video', inputs: [], output: `${EXAMPLE_BASE}/text-output.mp4`, poster: `${EXAMPLE_BASE}/text-poster.jpg`, summary: '720p · 5 s · prompt only' },
  image: { title: 'Image to video', inputs: [`${EXAMPLE_BASE}/image-input.jpg`], output: `${EXAMPLE_BASE}/image-output.mp4`, poster: `${EXAMPLE_BASE}/image-poster.jpg`, summary: '720p · 5 s · start frame' },
  keyframes: { title: 'Keyframes to video', inputs: [`${EXAMPLE_BASE}/keyframes-input-1.jpg`, `${EXAMPLE_BASE}/keyframes-input-2.jpg`], output: `${EXAMPLE_BASE}/keyframes-output.webm`, poster: `${EXAMPLE_BASE}/keyframes-poster.jpg`, summary: '720p · 5 s · frames 0 and 120' },
};

function FrameSlot({ label, hint, url, disabled, testId, apiKey, onChange, onError }: {
  label: string; hint: string; url: string; disabled: boolean; testId: string; apiKey: () => string | undefined;
  onChange: (url: string) => void; onError: (message: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState('');
  const [uploading, setUploading] = useState(false);

  async function upload(file?: File) {
    if (!file) return;
    const key = apiKey();
    if (!key) { onError('Sign in to upload an image.'); return; }
    if (!file.type.startsWith('image/')) { onError('Choose a PNG, JPEG, or WebP image.'); return; }
    onError(''); setUploading(true);
    try {
      onChange(await uploadToR2(file, file.name, file.type, key));
    } catch (reason) {
      onError(reason instanceof Error ? reason.message : 'Could not upload the image');
    } finally {
      setUploading(false);
    }
  }

  function useLink() {
    const value = link.trim();
    if (!/^https:\/\//i.test(value)) { onError('Use a public https:// image URL.'); return; }
    onError(''); onChange(value); setLink('');
  }

  return (
    <div>
      <div className={styles.output} style={{ marginTop: 0 }}>
        <div className={styles.outputHead}><span>{label.toUpperCase()}</span><span className={url ? styles.ready : ''}>{url ? 'LOADED' : 'EMPTY'}</span></div>
        {url ? <img data-testid={`${testId}-image`} key={url} src={url} alt={label} style={{ maxHeight: 220, objectFit: 'contain' }} /> : <div className={`${styles.empty} p-6`}><p>{hint}</p></div>}
      </div>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden
        onChange={(event: ChangeEvent<HTMLInputElement>) => { void upload(event.target.files?.[0]); event.target.value = ''; }} />
      <div className={styles.row} style={{ marginTop: 8 }}>
        <button type="button" className={styles.run} style={{ marginTop: 0, minHeight: 38 }} disabled={uploading || disabled} onClick={() => input.current?.click()}>
          {uploading ? <LoaderCircle className={styles.spin} size={16} /> : <Download size={15} />}{uploading ? 'Uploading…' : 'Upload image'}
        </button>
        {url
          ? <button type="button" className={styles.run} style={{ marginTop: 0, minHeight: 38, background: '#1a2624', color: '#d8ebe6' }} disabled={disabled} onClick={() => onChange('')}><X size={15} /> Clear</button>
          : <div />}
      </div>
      <label className={styles.field}>Or paste a public image URL
        <input data-testid={`${testId}-url`} type="url" value={link} disabled={uploading || disabled} placeholder="https://example.com/frame.png"
          onChange={(event) => setLink(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') useLink(); }} />
      </label>
      {link.trim() && <div className={styles.chips}><button type="button" disabled={disabled} onClick={useLink}>Use this URL</button></div>}
    </div>
  );
}

let nextKeyframeID = 1;

export default function Flux3MaxVideoTool() {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [mode, setMode] = useState<Mode>('text');
  const [startURL, setStartURL] = useState('');
  const [endURL, setEndURL] = useState('');
  const [keyframes, setKeyframes] = useState<Keyframe[]>([{ id: nextKeyframeID++, url: '', index: 0 }, { id: nextKeyframeID++, url: '', index: 5 * FPS }]);
  const [sourceError, setSourceError] = useState('');
  const [prompt, setPrompt] = useState(PROMPTS.text);
  const [promptEdited, setPromptEdited] = useState(false);
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState<keyof typeof RATE_USD>('720p');
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>('auto');
  const [reasoning, setReasoning] = useState<'low' | 'high'>('high');
  const [audio, setAudio] = useState(true);
  const [seed, setSeed] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [outputURL, setOutputURL] = useState('');
  const [chargedUSD, setChargedUSD] = useState<number | null>(null);
  const [creditsUsed, setCreditsUsed] = useState<number | null>(null);
  const [usedSeed, setUsedSeed] = useState<number | null>(null);

  const signedIn = Boolean(user?.api_key);
  const busy = phase === 'queued' || phase === 'processing';
  const priceUSD = RATE_USD[resolution] * duration;
  const maxIndex = duration * FPS;
  const ready = mode === 'text' || (mode === 'image' ? Boolean(startURL) : keyframes.length > 0 && keyframes.every((frame) => frame.url));

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  function changeMode(next: Mode) {
    setMode(next); setSourceError(''); setError('');
    if (!promptEdited) setPrompt(PROMPTS[next]);
  }

  function changeDuration(next: number) {
    setDuration(next);
    setKeyframes((rows) => rows.map((row) => ({ ...row, index: Math.min(row.index, next * FPS) })));
  }

  function updateKeyframe(id: number, patch: Partial<Keyframe>) {
    setKeyframes((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setOutputURL('');
  }

  function addKeyframe() {
    setKeyframes((rows) => {
      if (rows.length >= MAX_KEYFRAMES) return rows;
      const used = new Set(rows.map((row) => row.index));
      let index = Math.round(maxIndex / 2);
      while (used.has(index) && index < maxIndex) index += 1;
      while (used.has(index) && index > 0) index -= 1;
      return [...rows, { id: nextKeyframeID++, url: '', index }];
    });
  }

  function spaceEvenly() {
    setKeyframes((rows) => rows.map((row, i) => ({ ...row, index: rows.length > 1 ? Math.round((maxIndex * i) / (rows.length - 1)) : 0 })));
  }

  function validateKeyframes(): string {
    if (keyframes.some((frame) => !frame.url)) return 'Every keyframe needs an image.';
    if (new Set(keyframes.map((frame) => frame.index)).size !== keyframes.length) return 'Keyframe positions must be unique.';
    return '';
  }

  async function generate() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setPhase('error'); setError('Sign in to generate.'); return; }
    if (!prompt.trim()) { setPhase('error'); setError('Describe the video.'); return; }
    if (mode === 'image' && !startURL) { setPhase('error'); setError('Add a start frame first.'); return; }
    if (mode === 'keyframes') {
      const problem = validateKeyframes();
      if (problem) { setPhase('error'); setError(problem); return; }
    }
    setError(''); setOutputURL(''); setChargedUSD(null); setCreditsUsed(null); setUsedSeed(null);
    setPhase('queued'); setStatus('Job added');
    try {
      const queued = await parseJSONResponse<ServiceResponse>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'flux3_max_video', prompt: prompt.trim(),
            ...(mode === 'image' ? { image_url: startURL, ...(endURL ? { last_frame: endURL } : {}) } : {}),
            ...(mode === 'keyframes' ? { timed_keyframes: keyframes.map((frame) => ({ image_url: frame.url, frame_index: frame.index })) } : {}),
            duration, resolution, aspect_ratio: aspect, reasoning_level: reasoning, include_audio: audio,
            ...(seed.trim() ? { seed: Number(seed) } : {}),
          }),
        }),
        'Could not start the video',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The video service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read the video status',
        );
        const next = payload.job?.status || '';
        const result = payload.job?.result;
        if (next === 'completed') {
          if (!result?.video_url) throw new Error('Generation completed without a video');
          setOutputURL(result.video_url);
          setChargedUSD(result.charged_usd ?? null);
          setCreditsUsed(result.credits_used ?? null);
          setUsedSeed(result.seed ?? null);
          setPhase('done'); setStatus('Video ready');
          void refreshUser(currentUser.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to release this video' : 'Video generation failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Rendering with FLUX 3 Max' : 'Job added');
        await sleep(3000);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setError(reason instanceof Error ? reason.message : 'Video generation failed');
    }
  }

  function loadExample(next: Mode) {
    const example = EXAMPLES[next];
    setMode(next); setSourceError(''); setError(''); setOutputURL('');
    setPrompt(PROMPTS_EXAMPLE[next]); setPromptEdited(true);
    setDuration(5);
    if (next === 'image') { setStartURL(example.inputs[0]); setEndURL(''); }
    if (next === 'keyframes') setKeyframes(example.inputs.map((url, i) => ({ id: nextKeyframeID++, url, index: i === 0 ? 0 : 5 * FPS })));
    document.querySelector('[data-testid="flux3-mode-text"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  const apiKey = () => (user || loadStoredUser())?.api_key;
  const hint = mode === 'text' ? 'Type a prompt' : mode === 'image' ? 'Add a start frame' : 'Add every keyframe';

  return <>
    <section className={styles.hero}>
      <div className={styles.eyebrow}><Sparkles size={13} /> FLUX 3 MAX · TEXT · IMAGE · KEYFRAMES · NATIVE AUDIO</div>
      <h1>FLUX 3 Max video generator.</h1>
      <p>Generate from a prompt, animate one image toward an optional end frame, or pin up to ten keyframes along the timeline. 5 to 20 seconds at 720p or 1080p with generated sound, and a fixed price shown before it starts.</p>
    </section>
    <div className="mx-auto grid max-w-[1320px] gap-3.5 px-6 pb-3.5 md:grid-cols-3" data-testid="flux3-examples">
      {MODES.map(({ id }) => {
        const example = EXAMPLES[id];
        return (
          <div key={id} className={styles.panel} data-testid={`flux3-example-${id}`}>
            <div className={styles.panelHead}><div><span>EXAMPLE</span><h2>{example.title}</h2></div><Clapperboard size={17} /></div>
            {example.inputs.length > 0 && (
              <div className={styles.row} style={{ marginBottom: 10 }}>
                {example.inputs.map((url, i) => <img key={url} src={url} alt={`${example.title} input ${i + 1}`} data-testid={`flux3-example-${id}-input-${i}`} style={{ width: '100%', borderRadius: 8, maxHeight: 150, objectFit: 'cover' }} />)}
              </div>
            )}
            <video data-testid={`flux3-example-${id}-output`} src={example.output} poster={example.poster} muted loop playsInline controls preload="metadata" style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 260 }} />
            <p className={styles.price} style={{ display: 'block', marginTop: 10, lineHeight: 1.6 }}>{PROMPTS_EXAMPLE[id]}</p>
            <div className={styles.price}><span>{example.summary}</span><span>native audio</span></div>
            <button type="button" className={styles.run} style={{ minHeight: 40 }} disabled={busy} onClick={() => loadExample(id)} data-testid={`flux3-example-${id}-try`}>Try this setup</button>
          </div>
        );
      })}
    </div>
    <div className={styles.workspace}>
      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>01 / INPUT</span><h2>Mode and frames</h2></div><ImageIcon size={17} /></div>
        <div className={`${styles.segment} ${styles.three}`}>
          {MODES.map(({ id, label }) => (
            <button key={id} type="button" data-testid={`flux3-mode-${id}`} disabled={busy} className={mode === id ? styles.active : ''} onClick={() => changeMode(id)}>{label}</button>
          ))}
        </div>
        {mode === 'text' && <div className={`${styles.output} ${styles.empty}`} style={{ padding: 28 }}><p>Text to video needs no images. Describe the shot and it renders from the prompt alone.</p></div>}
        {mode === 'image' && <div className="grid gap-4">
          <FrameSlot label="Start frame" hint="The video starts from this image." url={startURL} disabled={busy} testId="flux3-start" apiKey={apiKey} onChange={(url) => { setStartURL(url); setOutputURL(''); }} onError={setSourceError} />
          <FrameSlot label="End frame (optional)" hint="The video lands on this image." url={endURL} disabled={busy} testId="flux3-end" apiKey={apiKey} onChange={(url) => { setEndURL(url); setOutputURL(''); }} onError={setSourceError} />
        </div>}
        {mode === 'keyframes' && <div className="grid gap-4">
          {keyframes.map((frame, i) => (
            <div key={frame.id} data-testid={`flux3-keyframe-${i}`} className="grid gap-2">
              <FrameSlot label={`Keyframe ${i + 1}`} hint="Pinned to the frame position below." url={frame.url} disabled={busy} testId={`flux3-kf${i}`} apiKey={apiKey} onChange={(url) => updateKeyframe(frame.id, { url })} onError={setSourceError} />
              <div className={styles.row} style={{ alignItems: 'end' }}>
                <label className={styles.field} style={{ marginTop: 0 }}>Frame index · {(frame.index / FPS).toFixed(2)} s
                  <input data-testid={`flux3-kf${i}-index`} type="number" min={0} max={maxIndex} step={1} disabled={busy} value={frame.index}
                    onChange={(event) => updateKeyframe(frame.id, { index: Math.max(0, Math.min(maxIndex, Math.round(Number(event.target.value) || 0))) })} />
                </label>
                <button type="button" className={styles.run} style={{ marginTop: 0, minHeight: 38, background: '#1a2624', color: '#d8ebe6' }} disabled={busy || keyframes.length <= 1} onClick={() => setKeyframes((rows) => rows.filter((row) => row.id !== frame.id))}><Trash2 size={14} /> Remove</button>
              </div>
            </div>
          ))}
          <div className={styles.chips} style={{ marginTop: 0 }}>
            <button type="button" data-testid="flux3-add-keyframe" disabled={busy || keyframes.length >= MAX_KEYFRAMES} onClick={addKeyframe}><Plus size={11} /> Add keyframe ({keyframes.length}/{MAX_KEYFRAMES})</button>
            <button type="button" disabled={busy || keyframes.length < 2} onClick={spaceEvenly}>Space evenly</button>
          </div>
          <div className={styles.price}><span>{FPS} fps · positions 0 to {maxIndex} at {duration} s</span><span>Unique frame indexes</span></div>
        </div>}
        <div className={styles.price}><span>PNG · JPEG · WebP</span><span>Aspect follows the first image on auto</span></div>
        {sourceError && <div data-testid="flux3-source-error" className={styles.error}>{sourceError}</div>}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>02 / SETTINGS</span><h2>Prompt and options</h2></div><Sparkles size={17} /></div>
        <label className={styles.field}>Prompt
          <textarea data-testid="flux3-prompt" rows={6} maxLength={4000} disabled={busy} value={prompt} onChange={(event) => { setPrompt(event.target.value); setPromptEdited(true); }} />
        </label>
        <label className={styles.field}>Duration · {duration} seconds
          <input data-testid="flux3-duration" type="range" min={MIN_SECONDS} max={MAX_SECONDS} step={1} disabled={busy} value={duration} onChange={(event) => changeDuration(Number(event.target.value))} />
        </label>
        <div className={styles.field}>Resolution
          <div className={styles.segment} style={{ marginBottom: 0 }}>
            {(['720p', '1080p'] as const).map((value) => (
              <button key={value} type="button" data-testid={`flux3-res-${value}`} disabled={busy} className={resolution === value ? styles.active : ''} onClick={() => setResolution(value)}>{value} · ${RATE_USD[value].toFixed(2)}/s</button>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>Aspect ratio
            <select data-testid="flux3-aspect" disabled={busy} value={aspect} onChange={(event) => setAspect(event.target.value as (typeof ASPECTS)[number])}>
              {ASPECTS.map((value) => <option key={value} value={value}>{value === 'auto' ? 'Auto' : value}</option>)}
            </select>
          </label>
          <label className={styles.field}>Seed
            <input data-testid="flux3-seed" inputMode="numeric" disabled={busy} value={seed} placeholder="Random" onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, '').slice(0, 10))} />
          </label>
        </div>
        <div className={styles.field}>Reasoning level
          <div className={styles.segment} style={{ marginBottom: 0 }}>
            {(['high', 'low'] as const).map((value) => (
              <button key={value} type="button" data-testid={`flux3-reasoning-${value}`} disabled={busy} className={reasoning === value ? styles.active : ''} onClick={() => setReasoning(value)}>{value === 'high' ? 'High · expands prompt' : 'Low · faster'}</button>
            ))}
          </div>
        </div>
        <label className={styles.field} style={{ gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: 10 }}>
          <input data-testid="flux3-audio" type="checkbox" disabled={busy} checked={audio} onChange={(event) => setAudio(event.target.checked)} style={{ width: 16 }} />
          <span>Generate audio</span>
        </label>
        <div className={styles.price}><span>${priceUSD.toFixed(2)} for this clip</span><span>{duration} s × ${RATE_USD[resolution].toFixed(2)}/s · {resolution}</span></div>
        {signedIn
          ? <button data-testid="flux3-run" className={styles.run} type="button" disabled={busy || !ready} onClick={() => void generate()}>
            {busy ? <LoaderCircle className={styles.spin} size={17} /> : <Clapperboard size={16} />}{busy ? status : ready ? `Generate · $${priceUSD.toFixed(2)}` : hint}
          </button>
          : <Link data-testid="flux3-run" href="/account" className={styles.run}>Sign in to generate</Link>}
        {error && <div data-testid="flux3-error" className={styles.error}>{error}</div>}
      </div>

      <div className={styles.panel}>
        <div className={styles.panelHead}><div><span>03 / OUTPUT</span><h2>Video</h2></div><Clapperboard size={17} /></div>
        <div className={styles.output} style={{ marginTop: 0 }}>
          <div className={styles.outputHead}><span>FLUX 3 MAX</span><span className={outputURL ? styles.ready : ''}>{outputURL ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {outputURL
            ? <>
              <video data-testid="flux3-output" src={outputURL} controls loop playsInline />
              <VideoDownload url={outputURL} name="manifoldgen-flux-3-max" className={styles.download} testId="flux3-download" />
            </>
            : <div className={`${styles.empty} p-8`}>{busy ? <><LoaderCircle className={styles.spin} size={22} /><p>{status}</p></> : <p>No video yet. {hint}, then generate.</p>}</div>}
        </div>
        {outputURL && <div className={styles.price}>
          <span>{usedSeed === null ? '' : `seed ${usedSeed}`}</span>
          <span>{creditsUsed === null ? '' : `${Math.ceil(creditsUsed)} credits used`}{chargedUSD === null ? '' : ` · $${chargedUSD.toFixed(2)}`}</span>
        </div>}
        {outputURL && <Link className={styles.download} style={{ margin: '10px 0 0' }} href={`/studio?video_url=${encodeURIComponent(outputURL)}&name=${encodeURIComponent('FLUX 3 Max video')}`}><Clapperboard size={14} /> Edit in Studio</Link>}
        <div className={styles.facts}>
          <div><b>5–20 s</b><span>Duration</span></div>
          <div><b>720p / 1080p</b><span>Resolution</span></div>
          <div><b>Native</b><span>Audio</span></div>
        </div>
      </div>
    </div>
  </>;
}
