'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  CreditCard,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';

const API = '/api';

type Aspect = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
type Size = 'preview' | 'balanced' | 'native';
type Format = 'webm-av1' | 'mp4-h264';

interface SessionUser {
  email?: string;
  api_key: string;
  credits: number;
  credits_usd?: number;
}

interface VideoJob {
  id: string;
  status: string;
  result_url?: string;
  error?: string;
  cost_usd?: number;
}

const ASPECTS: Aspect[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const SIZES: { id: Size; label: string; hint: string }[] = [
  { id: 'preview', label: 'Preview', hint: 'Fast draft' },
  { id: 'balanced', label: 'Balanced', hint: 'Default' },
  { id: 'native', label: 'Native', hint: 'Max detail' },
];

function authHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState(
    'Slow aerial drift over a neon harbor at night, wet asphalt reflections, cinematic anamorphic bokeh',
  );
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [size, setSize] = useState<Size>('balanced');
  const [duration, setDuration] = useState(5);
  const [steps, setSteps] = useState(20);
  const [format, setFormat] = useState<Format>('webm-av1');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [job, setJob] = useState<VideoJob | null>(null);
  const [h3Rate, setH3Rate] = useState(2.688);

  const creditsLabel = useMemo(() => {
    if (!user) return 'Sign in';
    const usd = user.credits_usd ?? user.credits;
    return `$${usd.toFixed(2)}`;
  }, [user]);

  const restoreSession = useCallback(async (key: string) => {
    const res = await fetch(`${API}/session`, { headers: authHeaders(key) });
    if (!res.ok) throw new Error('Session expired');
    const data = await res.json();
    setUser({
      email: data.email,
      api_key: data.api_key || key,
      credits: data.credits ?? 0,
      credits_usd: data.credits_usd,
    });
    setApiKey(data.api_key || key);
    localStorage.setItem('mg_api_key', data.api_key || key);
  }, []);

  useEffect(() => {
    const key = localStorage.getItem('mg_api_key');
    if (key) {
      setApiKey(key);
      restoreSession(key).catch(() => localStorage.removeItem('mg_api_key'));
    }
    fetch(`${API}/pricing`)
      .then((r) => r.json())
      .then((data) => {
        const row = (data.services || data || []).find?.(
          (s: { service: string; price_usd: number }) => s.service === 'h3_video',
        );
        if (row?.price_usd) setH3Rate(row.price_usd);
      })
      .catch(() => undefined);
  }, [restoreSession]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      await restoreSession(data.api_key);
      setAuthOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!apiKey) {
      setAuthOpen(true);
      return;
    }
    setError('');
    setBusy(true);
    setJob(null);
    try {
      const res = await fetch(`${API}/service`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          service: 'h3_video',
          prompt,
          aspect_ratio: aspect,
          size,
          duration,
          num_steps: steps,
          output_format: format,
          include_audio: includeAudio,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      const jobId = data.job_id || data.id;
      if (!jobId) throw new Error('No job id returned');
      await pollJob(jobId);
      await restoreSession(apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  async function pollJob(jobId: string) {
    for (let i = 0; i < 180; i++) {
      const res = await fetch(`${API}/video-jobs/${jobId}`, {
        headers: authHeaders(apiKey),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Job poll failed');
      setJob(data);
      if (['completed', 'succeeded', 'failed', 'payment_required', 'error'].includes(data.status)) {
        if (data.status === 'failed' || data.status === 'error') {
          throw new Error(data.error || 'Video failed');
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Timed out waiting for video');
  }

  function signOut() {
    localStorage.removeItem('mg_api_key');
    setUser(null);
    setApiKey('');
  }

  const resultUrl = job?.result_url;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        {resultUrl ? (
          <video
            key={resultUrl}
            className="hero-motion h-full w-full object-cover opacity-80"
            src={resultUrl}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div className="hero-motion h-full w-full bg-[radial-gradient(ellipse_at_20%_20%,#2a1f66_0%,transparent_45%),radial-gradient(ellipse_at_80%_10%,#123a45_0%,transparent_40%),linear-gradient(160deg,#07070a,#12101c_55%,#0a0a10)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/25" />
      </div>

      <header className="relative z-20 flex items-center justify-between px-5 py-4 md:px-8">
        <div className="flex items-center gap-3">
          <Clapperboard className="text-[var(--color-accent-2)]" size={22} />
          <div>
            <div className="font-display text-lg font-700 tracking-tight">ManifoldGen</div>
            <div className="text-xs text-[var(--color-mute)]">AI video studio</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="glass rounded-full p-2.5 text-[var(--color-mute)] transition hover:text-white"
            aria-label="Settings"
          >
            <Settings2 size={18} />
          </button>
          {user ? (
            <>
              <a
                href="/account"
                className="glass hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white sm:flex"
              >
                <CreditCard size={14} />
                {creditsLabel}
              </a>
              <button
                type="button"
                onClick={signOut}
                className="glass rounded-full p-2.5 text-[var(--color-mute)] hover:text-white"
                aria-label="Sign out"
              >
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            >
              <LogIn size={16} />
              Sign in
            </button>
          )}
        </div>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-5xl flex-col justify-end px-4 pb-8 pt-16 md:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="font-display text-4xl font-800 tracking-tight text-white md:text-6xl">
            ManifoldGen
          </h1>
          <p className="mt-3 max-w-xl text-base text-white/70 md:text-lg">
            Full-bleed H3 video. Metered at app.nz GPU rates plus 20%. Sign in, prompt, render.
          </p>
        </div>

        <div className="glass prompt-glow rounded-3xl p-3 md:p-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="Describe the shot, camera, light, motion…"
            className="w-full resize-none bg-transparent px-2 py-2 text-base outline-none placeholder:text-white/35 md:text-lg"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value as Aspect)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-sm"
            >
              {ASPECTS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value as Size)}
              className="rounded-full bg-white/5 px-3 py-1.5 text-sm"
            >
              {SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <span className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-[var(--color-mute)]">
              {duration}s · {steps} steps · ${h3Rate.toFixed(3)}/GPU-hr
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="rounded-full p-2 text-[var(--color-mute)] hover:bg-white/5 hover:text-white"
                aria-label="Open settings"
              >
                <Settings2 size={18} />
              </button>
              <button
                type="button"
                disabled={busy || !prompt.trim()}
                onClick={generate}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                Generate
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>
        )}
        {job && (
          <p className="mt-3 text-sm text-white/60">
            Job {job.id.slice(0, 8)} · {job.status}
            {job.cost_usd != null ? ` · $${job.cost_usd.toFixed(4)}` : ''}
          </p>
        )}
      </section>

      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 md:items-center">
          <div className="glass w-full max-w-md rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-700">Settings</h2>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <label className="mb-3 block text-sm text-[var(--color-mute)]">
              Duration (4–15s)
              <input
                type="range"
                min={4}
                max={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <span className="text-white">{duration}s</span>
            </label>
            <label className="mb-3 block text-sm text-[var(--color-mute)]">
              Steps (8–30)
              <input
                type="range"
                min={8}
                max={30}
                value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <span className="text-white">{steps}</span>
            </label>
            <label className="mb-3 block text-sm text-[var(--color-mute)]">
              Output
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as Format)}
                className="mt-2 w-full rounded-xl bg-white/5 px-3 py-2 text-white"
              >
                <option value="webm-av1">WebM AV1</option>
                <option value="mp4-h264">MP4 H.264</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
              />
              Include audio when available
            </label>
            <p className="mt-4 text-xs text-[var(--color-mute)]">
              H3 settles per GPU-second from app.nz, with a 20% ManifoldGen markup
              (≈ ${h3Rate.toFixed(3)} / GPU-hour).
            </p>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4 md:items-center">
          <form onSubmit={signIn} className="glass w-full max-w-md rounded-3xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-700">Sign in</h2>
              <button type="button" onClick={() => setAuthOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="mb-4 text-sm text-[var(--color-mute)]">
              Email signup creates an API key and Stripe-ready credit wallet.
            </p>
            <label className="mb-3 block text-sm">
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2"
              />
            </label>
            <label className="mb-4 block text-sm">
              Password
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 px-3 py-2"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
              Continue
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
