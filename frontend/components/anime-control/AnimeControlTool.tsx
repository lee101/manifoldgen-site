'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { Download, Image as ImageIcon, LoaderCircle, PersonStanding, Sparkles, Upload } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../lib/auth';
import { parseJSONResponse } from '../../lib/http';
import {
  ANIME_SIZES, ANIME_TOOLS, blobToDataURL, photoToDataURL, seedValue,
  type AnimeToolId, type StudioMapKind,
} from '../../lib/anime-control';
import { sleep } from '../../app/tools/character-swap/CharacterSwapTool';
import pageStyles from '../../app/tools/audio-spaces.module.css';
import styles from './anime-control.module.css';
import PaintPad, { type PaintPadHandle } from './PaintPad';

export type StudioHandle = { exportMap: (kind: StudioMapKind, size: { width: number; height: number }) => Promise<Blob> };

const PoseStudio = dynamic(() => import('../pose-studio/PoseStudio'), { ssr: false });

type Phase = 'idle' | 'queued' | 'processing' | 'done' | 'error';
type Source = 'studio' | 'photo' | 'paint';
type JobPayload = { job?: { status?: string; error?: string; result?: { image_url?: string; charged_usd?: number } } };

export default function AnimeControlTool({ tool: toolId }: { tool: AnimeToolId }) {
  const tool = ANIME_TOOLS[toolId];
  const sources: { id: Source; label: string }[] = [
    ...(tool.studio ? [{ id: 'studio' as const, label: '3D studio' }] : []),
    ...(tool.paint ? [{ id: 'paint' as const, label: tool.paint === 'region' ? 'Paint regions' : 'Draw a sketch' }] : []),
    ...(tool.photo ? [{ id: 'photo' as const, label: 'Photo' }] : []),
  ];
  const photoInput = useRef<HTMLInputElement>(null);
  const studio = useRef<StudioHandle>(null);
  const pad = useRef<PaintPadHandle>(null);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [source, setSource] = useState<Source>(sources[0].id);
  const [prompt, setPrompt] = useState(tool.prompts[0].text);
  const [negative, setNegative] = useState('');
  const [size, setSize] = useState(0);
  const [seed, setSeed] = useState('');
  const [strength, setStrength] = useState(1);
  const [regionalStrength, setRegionalStrength] = useState(1);
  const [poseStrength, setPoseStrength] = useState(1);
  const [photo, setPhoto] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [inputs, setInputs] = useState<string[]>([]);
  const [charged, setCharged] = useState<number | null>(null);

  const signedIn = Boolean(user?.api_key);
  const busy = phase === 'queued' || phase === 'processing';
  const { width, height } = ANIME_SIZES[size];

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
  }, []);

  async function choosePhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Choose a PNG, JPEG, or WebP image.'); return; }
    setError('');
    try { setPhoto(await photoToDataURL(file)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not read the image'); }
  }

  async function studioMap(kind: StudioMapKind): Promise<string> {
    if (!studio.current) throw new Error('The 3D studio is still loading.');
    return blobToDataURL(await studio.current.exportMap(kind, { width, height }));
  }

  async function collect(): Promise<{ controlImages: Record<string, string>; imageURL?: string; previews: string[] }> {
    if (source === 'photo') {
      if (!photo) throw new Error('Add a photo first.');
      return { controlImages: {}, imageURL: photo, previews: [photo] };
    }
    if (source === 'paint') {
      if (!pad.current || pad.current.isEmpty()) throw new Error(tool.paint === 'region' ? 'Paint at least one region first.' : 'Draw something first.');
      const map = await blobToDataURL(await pad.current.exportPNG(width, height));
      return { controlImages: { [tool.paint === 'region' ? 'region_map' : 'edge_image']: map }, previews: [map] };
    }
    if (toolId === 'pose') { const map = await studioMap('mesh'); return { controlImages: { pose_map: map }, previews: [map] }; }
    if (toolId === 'depth') { const map = await studioMap('depth'); return { controlImages: { depth_image: map }, previews: [map] }; }
    const [mesh, region] = await Promise.all([studioMap('mesh'), studioMap('region')]);
    return { controlImages: { pose_map: mesh, region_map: region }, previews: [mesh, region] };
  }

  async function generate() {
    const current = user || loadStoredUser();
    if (!current?.api_key) { setPhase('error'); setError('Sign in to generate.'); return; }
    if (!prompt.trim()) { setPhase('error'); setError('Describe your character.'); return; }
    setError(''); setResult(''); setCharged(null); setPhase('queued'); setStatus('Preparing the control image');
    try {
      const control = await collect();
      setInputs(control.previews);
      const body: Record<string, unknown> = {
        service: tool.service, prompt: prompt.trim(), width, height, seed: seedValue(seed),
        control_images: control.controlImages, strength,
      };
      if (negative.trim()) body.negative_prompt = negative.trim();
      if (control.imageURL) body.image_url = control.imageURL;
      if (toolId === 'scene') body.control_strengths = { regional: regionalStrength, pose: poseStrength };
      setStatus('Job added');
      const queued = await parseJSONResponse<{ result?: { job_id?: string; status_url?: string } }>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${current.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        'Could not start the illustration',
      );
      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The service returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;
      for (let attempt = 0; attempt < 900; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${current.api_key}` } }),
          'Could not read the job status',
        );
        const next = payload.job?.status || '';
        if (next === 'completed') {
          const url = payload.job?.result?.image_url;
          if (!url) throw new Error('Generation completed without an image');
          setResult(url); setCharged(payload.job?.result?.charged_usd ?? null);
          setPhase('done'); setStatus('Illustration ready');
          void refreshUser(current.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
          return;
        }
        if (next === 'failed' || next === 'payment_required') {
          throw new Error(payload.job?.error || (next === 'payment_required' ? 'Top up to release this image' : 'Generation failed'));
        }
        setPhase(next === 'processing' ? 'processing' : 'queued');
        setStatus(next === 'processing' ? 'Drawing your character' : 'Waiting for a GPU');
        await sleep(2000);
      }
      throw new Error('The job remains available in your account');
    } catch (reason) {
      setPhase('error');
      setError(reason instanceof Error ? reason.message : 'Generation failed');
    }
  }

  return <>
    <section className={pageStyles.hero}>
      <div className={pageStyles.eyebrow}><PersonStanding size={13} /> {tool.eyebrow}</div>
      <h1>{tool.headline}</h1>
      <p>{tool.blurb} A fixed ${tool.priceUSD.toFixed(2)} per image.</p>
    </section>
    <div className={styles.stack}>
      <div className={pageStyles.panel}>
        <div className={pageStyles.panelHead}><div><span>01 / CONTROL INPUT</span><h2>{tool.name}</h2></div><ImageIcon size={17} /></div>
        {sources.length > 1 && (
          <div className={styles.tabs} role="tablist">
            {sources.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={source === item.id} className={source === item.id ? styles.on : ''}
                disabled={busy} onClick={() => setSource(item.id)}>{item.label}</button>
            ))}
          </div>
        )}
        {source === 'studio' && (
          <div className={styles.studio} data-testid="anime-studio">
            <PoseStudio ref={studio} outputSize={{ width, height }} />
          </div>
        )}
        {source === 'paint' && tool.paint && <PaintPad ref={pad} mode={tool.paint} width={width} height={height} disabled={busy} />}
        {source === 'photo' && (
          <div className={styles.photo}>
            <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" hidden
              onChange={(event: ChangeEvent<HTMLInputElement>) => { void choosePhoto(event.target.files?.[0]); event.target.value = ''; }} />
            {photo ? <img src={photo} alt="Reference" /> : (
              <div className={styles.drop} onClick={() => photoInput.current?.click()}><Upload size={18} /><p>Upload a photo</p></div>
            )}
            {photo && <button type="button" className={pageStyles.run} disabled={busy} onClick={() => photoInput.current?.click()}><Upload size={15} /> Change photo</button>}
            <div className={pageStyles.price}><span>PNG, JPEG or WebP</span><span>{toolId === 'pose' ? 'One person, full body works best' : 'Any image'}</span></div>
          </div>
        )}
      </div>
      <div className={pageStyles.panel}>
        <div className={pageStyles.panelHead}><div><span>02 / CHARACTER</span><h2>Describe and generate</h2></div><Sparkles size={17} /></div>
        <label className={pageStyles.field}>Prompt (tags or a sentence)
          <textarea data-testid="anime-prompt" rows={5} maxLength={2400} disabled={busy} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <div className={pageStyles.chips}>
          {tool.prompts.map((item) => (
            <button key={item.label} type="button" disabled={busy} onClick={() => setPrompt(item.text)}>{item.label}</button>
          ))}
        </div>
        <label className={pageStyles.field}>Size
          <select data-testid="anime-size" disabled={busy} value={size} onChange={(event) => setSize(Number(event.target.value))}>
            {ANIME_SIZES.map((option, index) => <option key={option.label} value={index}>{option.label}</option>)}
          </select>
        </label>
        {toolId === 'scene' && source === 'studio' ? <>
          <label className={styles.range}>Region strength {regionalStrength.toFixed(2)}
            <input type="range" min={0} max={1.5} step={0.05} disabled={busy} value={regionalStrength} onChange={(event) => setRegionalStrength(Number(event.target.value))} />
          </label>
          <label className={styles.range}>Pose strength {poseStrength.toFixed(2)}
            <input type="range" min={0} max={1.5} step={0.05} disabled={busy} value={poseStrength} onChange={(event) => setPoseStrength(Number(event.target.value))} />
          </label>
        </> : toolId !== 'sketch' && toolId !== 'scene' && (
          <label className={styles.range}>Control strength {strength.toFixed(2)}
            <input type="range" min={0.3} max={1.5} step={0.05} disabled={busy} value={strength} onChange={(event) => setStrength(Number(event.target.value))} />
          </label>
        )}
        <div className={pageStyles.row}>
          <label className={pageStyles.field}>Seed (blank = random)
            <input data-testid="anime-seed" inputMode="numeric" disabled={busy} value={seed} onChange={(event) => setSeed(event.target.value.replace(/\D/g, ''))} />
          </label>
          <label className={pageStyles.field}>Avoid (optional)
            <input disabled={busy} value={negative} onChange={(event) => setNegative(event.target.value)} placeholder="blurry, extra fingers" />
          </label>
        </div>
        <div className={pageStyles.price}><span>Fixed ${tool.priceUSD.toFixed(2)} per image, confirmed before it starts</span><span>Complex poses can still miss; try another seed</span></div>
        {signedIn
          ? <button data-testid="anime-run" className={pageStyles.run} type="button" disabled={busy} onClick={() => void generate()}>
            {busy ? <LoaderCircle className={pageStyles.spin} size={17} /> : <PersonStanding size={16} />}{busy ? status : 'Generate the illustration'}
          </button>
          : <Link data-testid="anime-run" href="/account" className={pageStyles.run}>Sign in to generate</Link>}
        {error && <div data-testid="anime-error" className={pageStyles.error}>{error}</div>}
        <div className={pageStyles.output}>
          <div className={pageStyles.outputHead}><span>RESULT</span><span className={result ? pageStyles.ready : ''}>{result ? 'READY' : busy ? 'GENERATING' : 'WAITING'}</span></div>
          {result
            ? <>
              <div className={styles.pair} style={{ margin: 12 }}>
                <figure><figcaption>INPUT</figcaption><img data-testid="anime-input-preview" src={inputs[0]} alt="Control input" /></figure>
                <figure><figcaption>OUTPUT</figcaption><img data-testid="anime-output" src={result} alt="Generated illustration" /></figure>
              </div>
              <a className={pageStyles.download} data-testid="anime-download" href={result} download={`${tool.slug}.webp`} target="_blank" rel="noreferrer"><Download size={14} /> Download</a>
            </>
            : <div className={`${pageStyles.empty} p-8`}>{busy ? <><LoaderCircle className={pageStyles.spin} size={22} /><p>{status}</p></> : <p>Your illustration appears here beside its control input.</p>}</div>}
        </div>
        {phase === 'done' && charged !== null && <div className={pageStyles.price}><span>Done</span><span>${charged.toFixed(2)}</span></div>}
      </div>
    </div>
    <section className={styles.examples}>
      <h2>Examples</h2>
      {tool.examples.map((item, index) => (
        <div key={index} className={styles.exampleCard}>
          <div className={styles.pair}>
            <figure><figcaption>INPUT</figcaption><img src={item.input} alt={`${item.note} input`} loading="lazy" /></figure>
            <figure><figcaption>OUTPUT</figcaption><img src={item.output} alt={`${item.note} output`} loading="lazy" /></figure>
          </div>
          <small>{item.note.toUpperCase()}</small>
          <p>{item.prompt}</p>
        </div>
      ))}
    </section>
  </>;
}
