'use client';

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowLeft, Check, Clapperboard, Download, Film, Loader2,
  Scissors, Sparkles, Upload, Wand2, X,
} from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { parseJSONResponse } from '@/lib/http';
import { analyzeAudioFile, beatGrid, type AudioAnalysis } from '@/lib/audio-understanding';
import styles from './page.module.css';

const SAMPLE_VIDEO = '/examples/robotrun.mp4';
const SAMPLE_NAME = 'robotrun.mp4';

const DEFAULT_PROMPT = `Let us make a video dramatizing this robot experience. First, a team of Asian anime characters building out a running robot with a square head, training it and testing it. Second, it actually running on an Olympic track. Third, its point of view running down the track with lots of interesting sensors, going really fast. Stitch the generated shots back together with cuts of the original footage. End on the robot hitting a wall fast while shocked anime characters watch, then a point-of-view shot as it explodes into sparks.`;

type AgentStep = {
  name: string;
  label: string;
  status: 'running' | 'done' | 'failed';
  detail?: string;
  elapsed_seconds?: number;
};

type PlannedShot = {
  id: string;
  kind: 'generated' | 'restyled_source' | 'source';
  seconds: number;
  image_prompt?: string;
  note?: string;
};

type JobResult = {
  _agent_step?: number;
  _agent_label?: string;
  _agent_steps?: AgentStep[];
  plan?: { title?: string; concept?: string; planner?: string; shots?: PlannedShot[] };
  planner?: string;
  shots?: { shot: PlannedShot; timeline_start: number; duration: number; error?: string }[];
  video_url?: string;
  duration?: number;
  project_url?: string;
  charged_usd?: number;
};

type JobPayload = {
  job?: { job_id?: string; status?: string; result?: JobResult; error?: string };
};

type Phase = 'idle' | 'analyzing' | 'uploading' | 'queued' | 'processing' | 'done' | 'error';

const KIND_LABEL: Record<PlannedShot['kind'], string> = {
  generated: 'Generated',
  restyled_source: 'Restyled',
  source: 'Original',
};

/** Presign + direct PUT, the same upload path every other tool uses. */
async function uploadToR2(file: File, apiKey: string): Promise<string> {
  const params = new URLSearchParams({
    filename: file.name,
    content_type: file.type || 'video/mp4',
    dataset: 'video-dramatizer',
  });
  const prepared = await parseJSONResponse<{ upload_url?: string; public_url?: string }>(
    await fetch(`/api/uploads/presign?${params}`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    'Could not prepare the video upload',
  );
  if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
  const uploaded = await fetch(prepared.upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/mp4' },
    body: file,
  });
  if (!uploaded.ok) throw new Error(`Video upload failed (${uploaded.status})`);
  return prepared.public_url;
}

export default function VideoDramatizerTool() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<StoredUser | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceURL, setSourceURL] = useState(SAMPLE_VIDEO);
  const [sourceName, setSourceName] = useState(SAMPLE_NAME);
  const [usingSample, setUsingSample] = useState(true);

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [maxShots, setMaxShots] = useState(6);

  const [audio, setAudio] = useState<AudioAnalysis | null>(null);
  const [audioError, setAudioError] = useState('');

  const [phase, setPhase] = useState<Phase>('idle');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [result, setResult] = useState<JobResult | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) {
      void refreshUser(stored.api_key).then((fresh) => {
        if (fresh) { setUser(fresh); saveUser(fresh); }
      });
    }
  }, []);

  /**
   * Runs the browser port of audio-understanding over whichever clip is
   * selected. This is the same onset/beat detection the server uses to place
   * cuts, so the beat readout here previews how the edit will be timed — and
   * it costs nothing, because it happens before the paid job is submitted.
   */
  const analyze = useCallback(async (source: Blob | string) => {
    setAudioError('');
    setAudio(null);
    setPhase('analyzing');
    setStatus('Analysing the soundtrack…');
    try {
      const blob = typeof source === 'string' ? await (await fetch(source)).blob() : source;
      const analysis = await analyzeAudioFile(blob, { includeSeries: false });
      setAudio(analysis);
      setStatus('');
      setPhase('idle');
    } catch (reason) {
      // Beat detection is a preview, never a blocker.
      setAudioError(reason instanceof Error ? reason.message : 'Could not analyse the audio');
      setStatus('');
      setPhase('idle');
    }
  }, []);

  useEffect(() => {
    void analyze(SAMPLE_VIDEO);
  }, [analyze]);

  useEffect(() => {
    if (!file) return;
    const localURL = URL.createObjectURL(file);
    setSourceURL(localURL);
    void analyze(file);
    return () => URL.revokeObjectURL(localURL);
  }, [file, analyze]);

  function choose(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith('video/')) { setError('Choose a video file.'); return; }
    if (next.size > 512 * 1024 * 1024) { setError('Videos must be 512 MB or smaller.'); return; }
    setError('');
    setResult(null);
    setSteps([]);
    setFile(next);
    setSourceName(next.name);
    setUsingSample(false);
  }

  function useSample() {
    setFile(null);
    setSourceURL(SAMPLE_VIDEO);
    setSourceName(SAMPLE_NAME);
    setUsingSample(true);
    setResult(null);
    setSteps([]);
    setError('');
    void analyze(SAMPLE_VIDEO);
  }

  async function run() {
    const currentUser = user || loadStoredUser();
    if (!currentUser?.api_key) { setError('Sign in to use the Video Dramatizer.'); return; }
    if (!prompt.trim()) { setError('Describe the video you want.'); return; }

    setError('');
    setResult(null);
    setSteps([]);
    try {
      setPhase('uploading');
      setStatus('Uploading the source clip…');
      // The sample ships as a static asset, so it gets uploaded exactly like a
      // user's own file and the server always receives a durable https URL.
      const upload = file || new File(
        [await (await fetch(SAMPLE_VIDEO)).blob()],
        SAMPLE_NAME,
        { type: 'video/mp4' },
      );
      const videoURL = await uploadToR2(upload, currentUser.api_key);

      setPhase('queued');
      setStatus('Handing the brief to the agent…');
      const queued = await parseJSONResponse<{
        result?: { job_id?: string; status_url?: string };
        estimated_cost_usd?: number;
      }>(
        await fetch('/api/service', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentUser.api_key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service: 'video-dramatize',
            prompt: prompt.trim(),
            video_url: videoURL,
            num_images: maxShots,
            duration: 5,
          }),
        }),
        'Could not start the dramatization',
      );

      const jobID = queued.result?.job_id;
      if (!jobID) throw new Error('The dramatizer returned no job');
      const statusURL = queued.result?.status_url || `/api/video-jobs/${encodeURIComponent(jobID)}`;

      // Agent runs are long: poll for up to an hour at 3s.
      for (let attempt = 0; attempt < 1200; attempt += 1) {
        const payload = await parseJSONResponse<JobPayload>(
          await fetch(statusURL, { headers: { Authorization: `Bearer ${currentUser.api_key}` } }),
          'Could not read the dramatization status',
        );
        const job = payload.job;
        const jobStatus = job?.status || '';
        if (job?.result) {
          setResult(job.result);
          if (job.result._agent_steps) setSteps(job.result._agent_steps);
          if (job.result._agent_label) setStatus(job.result._agent_label);
        }
        if (jobStatus === 'completed') {
          setPhase('done');
          setStatus('Your dramatized edit is ready');
          const fresh = await refreshUser(currentUser.api_key);
          if (fresh) { setUser(fresh); saveUser(fresh); }
          return;
        }
        if (jobStatus === 'failed' || jobStatus === 'payment_required') {
          throw new Error(job?.error || (jobStatus === 'payment_required'
            ? 'Top up to release this edit'
            : 'The dramatization failed'));
        }
        setPhase(jobStatus === 'processing' ? 'processing' : 'queued');
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }
      throw new Error('Still running — the job stays available in your account');
    } catch (reason) {
      setPhase('error');
      setStatus('');
      setError(reason instanceof Error ? reason.message : 'The dramatization failed');
    }
  }

  const busy = phase === 'uploading' || phase === 'queued' || phase === 'processing';
  const cuts = audio ? beatGrid(audio, 0.8) : [];
  const estimateUSD = Math.ceil((maxShots * 2) / 3) * (0.24 + 0.28 * 5 * 1.2);
  const credits = Math.ceil(estimateUSD / (user?.credit_price_usd || 0.01));
  const plan = result?.plan;

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Clapperboard size={14} /> VIDEO DRAMATIZER</div>
      <Link href="/account" className={styles.account}>
        {user ? `${(user.credits_usd ?? user.credits * (user.credit_price_usd || .01)).toFixed(2)} USD` : 'Sign in'}
      </Link>
    </header>

    <section className={styles.hero}>
      <div className={styles.eyebrow}>SHOT PLANNING · GENERATED CUT-INS · BEAT-ALIGNED EDITING</div>
      <h1>Describe the film.<br /><span>Get the edit, not just a clip.</span></h1>
      <p>
        Give the agent a clip and a brief. It watches the footage, listens for the beats, plans a shot list,
        generates and restyles the cut-ins, then hands back a finished vertical edit — and an editable
        project with every cut on its own timeline clip.
      </p>
    </section>

    <section className={styles.workspace}>
      <div className={styles.controls}>
        <div
          className={styles.drop}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}
          onClick={() => fileInput.current?.click()}
          data-testid="dramatizer-drop"
        >
          <input
            ref={fileInput}
            type="file"
            accept="video/*"
            hidden
            onChange={(event: ChangeEvent<HTMLInputElement>) => { choose(event.target.files?.[0]); event.target.value = ''; }}
          />
          <video src={sourceURL} muted loop playsInline autoPlay />
          <div className={styles.dropMeta}>
            <b>{sourceName}</b>
            <span>{usingSample ? 'Sample clip · click to use your own' : 'Your clip · click to replace'}</span>
          </div>
        </div>
        {!usingSample && (
          <button type="button" className={styles.ghost} onClick={useSample}>
            <X size={13} /> Back to the sample clip
          </button>
        )}

        <div className={styles.analysis} data-testid="dramatizer-analysis">
          <div className={styles.analysisHead}>
            <span><Activity size={13} /> SOUNDTRACK ANALYSIS</span>
            <small>in your browser</small>
          </div>
          {phase === 'analyzing' && <div className={styles.analysisBody}><Loader2 className={styles.spin} size={15} /> Detecting onsets and beats…</div>}
          {audioError && <div className={styles.analysisBody}>{audioError}</div>}
          {audio && (
            <>
              <div className={styles.stats}>
                <div><b>{audio.tempo.toFixed(0)}</b><span>BPM</span></div>
                <div><b>{audio.beat_times.length}</b><span>beats</span></div>
                <div><b>{audio.onset_times.length}</b><span>onsets</span></div>
                <div><b>{cuts.length}</b><span>cut points</span></div>
              </div>
              <div className={styles.beatBar} aria-hidden>
                {cuts.map((t) => (
                  <i key={t} style={{ left: `${Math.min(100, (t / Math.max(audio.duration, 0.001)) * 100)}%` }} />
                ))}
              </div>
              <small className={styles.hint}>
                Cuts back to the original footage land on these points.
              </small>
            </>
          )}
        </div>

        <label className={styles.field}>
          <span>Describe the video you want</span>
          <textarea
            value={prompt}
            maxLength={6000}
            rows={9}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Let us make a video dramatizing…"
            data-testid="dramatizer-prompt"
          />
          <small>Use ordering words — first, second, then, end on — and the agent will follow them as shot order.</small>
        </label>

        <div className={styles.options}>
          <label>
            <span>Shot budget</span>
            <select value={maxShots} onChange={(event) => setMaxShots(Number(event.target.value))}>
              <option value={4}>4 shots · quick</option>
              <option value={6}>6 shots · balanced</option>
              <option value={8}>8 shots · detailed</option>
              <option value={10}>10 shots · maximum</option>
            </select>
          </label>
        </div>

        <button
          className={styles.run}
          type="button"
          disabled={busy || !prompt.trim()}
          onClick={() => void run()}
          data-testid="dramatizer-run"
        >
          {busy ? <Loader2 className={styles.spin} size={18} /> : <Wand2 size={18} />}
          {busy ? (status || 'Working…') : 'Dramatize this clip'}
        </button>
        <div className={styles.price}>
          <span>Paid accounts · settled from the shot plan the agent runs</span>
          <b>~{credits} credits · ${estimateUSD.toFixed(2)}</b>
        </div>
        {error && <div className={styles.error} role="alert">{error}</div>}
      </div>

      <div className={styles.previewPanel}>
        <div className={styles.previewHeader}>
          <span>{result?.video_url ? 'FINISHED EDIT' : 'AGENT WORKSPACE'}</span>
          {result?.video_url && <span className={styles.ready}><Check size={13} /> READY</span>}
        </div>

        <div className={styles.preview}>
          {result?.video_url ? (
            <video src={result.video_url} controls playsInline autoPlay loop data-testid="dramatizer-result" />
          ) : (
            <div className={styles.empty}>
              {busy ? <Loader2 className={styles.spin} size={30} /> : <Film size={30} />}
              <b>{busy ? status || 'Working…' : 'Your edit will play here'}</b>
              <span>{busy ? 'Generated shots render in parallel.' : 'The agent plans, generates, then cuts.'}</span>
            </div>
          )}
        </div>

        {steps.length > 0 && (
          <ol className={styles.steps} data-testid="dramatizer-steps">
            {steps.map((step) => (
              <li key={step.name} className={styles[step.status]}>
                <i>
                  {step.status === 'done' ? <Check size={12} />
                    : step.status === 'failed' ? <X size={12} />
                    : <Loader2 className={styles.spin} size={12} />}
                </i>
                <span>
                  <b>{step.label}</b>
                  {step.detail && <small>{step.detail}</small>}
                </span>
                {step.elapsed_seconds ? <em>{step.elapsed_seconds.toFixed(0)}s</em> : null}
              </li>
            ))}
          </ol>
        )}

        {plan?.shots && plan.shots.length > 0 && (
          <div className={styles.shots} data-testid="dramatizer-shots">
            <div className={styles.shotsHead}>
              <span><Scissors size={13} /> SHOT LIST</span>
              {result?.planner && <small>planned by {result.planner}</small>}
            </div>
            {plan.shots.map((shot) => (
              <div key={shot.id} className={styles.shot} data-kind={shot.kind}>
                <b>{KIND_LABEL[shot.kind]}</b>
                <span>{shot.image_prompt || shot.note || 'cut from the original footage'}</span>
                <em>{shot.seconds.toFixed(1)}s</em>
              </div>
            ))}
          </div>
        )}

        <div className={styles.footer}>
          <span>
            {result?.duration
              ? `${result.duration.toFixed(1)}s · ${result.shots?.length ?? 0} clips${result.charged_usd ? ` · $${result.charged_usd.toFixed(2)}` : ''}`
              : 'Every cut arrives as a separate clip you can keep editing.'}
          </span>
          <div className={styles.actions}>
            {result?.video_url && <a href={result.video_url} download><Download size={15} /> Download</a>}
            {result?.project_url && (
              <Link href={result.project_url} className={styles.primary} data-testid="dramatizer-open-editor">
                <Sparkles size={15} /> Open in editor
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>

    <section className={styles.notes}>
      <div><Activity size={17} /><span><b>Listens before it cuts</b>Onset and beat detection runs in your browser and again on the server, so returns to the original footage land on the music.</span></div>
      <div><Wand2 size={17} /><span><b>Generates and restyles</b>New shots come from image generation; others repaint real frames of your clip so the subject carries into the stylized world.</span></div>
      <div><Scissors size={17} /><span><b>Hands back an edit</b>You get a finished vertical render and a Studio project where every cut is its own clip.</span></div>
    </section>
  </main>;
}
