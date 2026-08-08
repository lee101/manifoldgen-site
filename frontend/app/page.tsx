'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  CreditCard,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Search,
  Settings2,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react';

const API = '/api';

type Aspect = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
type Size = 'preview' | 'balanced' | 'native';
type Format = 'webm-av1' | 'mp4-h264';
type AuthMode = 'signup' | 'signin';

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

interface GalleryImage {
  id: string;
  prompt: string;
  thumb_url?: string;
  image_url?: string;
  file_path?: string;
  thumb_path?: string;
  similarity?: number;
}

interface VideoHit {
  job_id: string;
  prompt: string;
  video_url?: string;
  similarity?: number;
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

function normalizeImages(rows: GalleryImage[]): GalleryImage[] {
  return rows.map((img) => ({
    ...img,
    thumb_url:
      img.thumb_url ||
      (img.thumb_path ? `/images/${img.thumb_path}` : undefined) ||
      (img.file_path ? `/images/${img.file_path}` : undefined),
    image_url: img.image_url || (img.file_path ? `/images/${img.file_path}` : undefined),
  }));
}

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [authWelcome, setAuthWelcome] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState(
    'Slow aerial drift over a neon harbor at night, wet asphalt reflections, cinematic anamorphic bokeh',
  );
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [size, setSize] = useState<Size>('native');
  const [duration, setDuration] = useState(5);
  const [steps, setSteps] = useState(20);
  const [format, setFormat] = useState<Format>('webm-av1');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [job, setJob] = useState<VideoJob | null>(null);
  const [h3Rate, setH3Rate] = useState(2.688);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [featuredVideos, setFeaturedVideos] = useState<VideoHit[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [videoHits, setVideoHits] = useState<VideoHit[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);

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

  const loadGallery = useCallback(async (q = '') => {
    const url = q.trim()
      ? `${API}/images/semantic?q=${encodeURIComponent(q.trim())}&top_k=36`
      : `${API}/images?skip_total=true&varied=true&per_page=36&allow_nsfw=true`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setGallery(normalizeImages(data.results || data.images || []));
  }, []);

  const loadFeaturedVideos = useCallback(async () => {
    const res = await fetch(`${API}/search?q=${encodeURIComponent('cinematic neon light')}&top_k=12`);
    if (!res.ok) return;
    const data = await res.json();
    const rows: VideoHit[] = (data.results || []).filter((r: VideoHit) => r.video_url);
    setFeaturedVideos(rows);
    setJob((prev) => {
      if (prev?.result_url || !rows[0]?.video_url) return prev;
      return {
        id: rows[0].job_id,
        status: 'completed',
        result_url: rows[0].video_url,
      };
    });
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
    loadGallery().catch(() => undefined);
    loadFeaturedVideos().catch(() => undefined);
  }, [restoreSession, loadGallery, loadFeaturedVideos]);

  useEffect(() => {
    if (job?.result_url || gallery.length === 0) return;
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % gallery.length);
    }, 8000);
    return () => window.clearInterval(id);
  }, [job?.result_url, gallery.length]);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = searchQ.trim();
    if (!q) {
      setVideoHits([]);
      await loadGallery();
      return;
    }
    setSearchBusy(true);
    try {
      const [vids] = await Promise.all([
        fetch(`${API}/search?q=${encodeURIComponent(q)}&top_k=12`).then(async (r) =>
          r.ok ? r.json() : { results: [] },
        ),
        loadGallery(q),
      ]);
      setVideoHits(vids.results || []);
    } finally {
      setSearchBusy(false);
    }
  }

  function openAuth(mode: AuthMode = 'signup') {
    setAuthMode(mode);
    setAuthError('');
    setAuthWelcome(false);
    setAuthOpen(true);
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    if (authMode === 'signup' && password !== password2) {
      setAuthError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setAuthError('Use at least 8 characters');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/email-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auth failed');
      await restoreSession(data.api_key);
      if (data.created || authMode === 'signup') {
        setAuthWelcome(true);
      } else {
        setAuthOpen(false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!apiKey) {
      openAuth('signup');
      return;
    }
    setError('');
    setBusy(true);
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
      const jobId = data.result?.job_id || data.job_id || data.id;
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
      const url =
        data.result_url ||
        data.video_url ||
        data.result?.video_url ||
        (typeof data.result === 'object' ? data.result?.video_url : undefined);
      setJob({
        id: data.job_id || data.id || jobId,
        status: data.status,
        result_url: url,
        error: data.error,
        cost_usd: data.charged_usd ?? data.cost_usd,
      });
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

  function playVideo(hit: VideoHit) {
    setPrompt(hit.prompt);
    if (hit.video_url) {
      setJob({ id: hit.job_id, status: 'completed', result_url: hit.video_url });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const resultUrl = job?.result_url;
  const heroImage = gallery[heroIndex]?.image_url || gallery[heroIndex]?.thumb_url;
  const displayVideos = videoHits.length > 0 ? videoHits : featuredVideos;

  return (
    <main className="relative min-h-screen bg-[var(--color-ink)]">
      {/* Full-bleed hero */}
      <section className="relative h-[100dvh] w-full overflow-hidden">
        <div className="absolute inset-0">
          {resultUrl ? (
            <video
              key={resultUrl}
              className="hero-motion h-full w-full object-cover"
              src={resultUrl}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={heroImage}
              src={heroImage}
              alt=""
              className="hero-motion h-full w-full object-cover opacity-90"
            />
          ) : (
            <div className="hero-motion h-full w-full bg-[radial-gradient(ellipse_at_20%_20%,#2a1f66_0%,transparent_45%),radial-gradient(ellipse_at_80%_10%,#123a45_0%,transparent_40%),linear-gradient(160deg,#07070a,#12101c_55%,#0a0a10)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
        </div>

        <header className="relative z-20 flex items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <Clapperboard className="text-[var(--color-accent-2)]" size={22} />
            <div className="font-display text-xl font-700 tracking-tight md:text-2xl">ManifoldGen</div>
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
              <>
                <button
                  type="button"
                  onClick={() => openAuth('signin')}
                  className="glass hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-medium sm:inline-flex"
                >
                  <LogIn size={16} />
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
                >
                  <UserPlus size={16} />
                  Sign up
                </button>
              </>
            )}
          </div>
        </header>

        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-4 pt-24 md:px-6 md:pb-6">
          <div className="mx-auto w-full max-w-4xl">
            <p className="mb-3 hidden max-w-xl text-sm text-white/65 md:block md:text-base">
              Full-bleed cinematic video. Prompt, render, remix the gallery.
            </p>
            <div className="glass prompt-glow rounded-3xl p-3 md:p-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Describe the shot, camera, light, motion…"
                className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-white/35 md:text-lg"
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
                <span className="hidden rounded-full bg-white/5 px-3 py-1.5 text-sm text-[var(--color-mute)] sm:inline">
                  {duration}s · ${h3Rate.toFixed(3)}/GPU-hr
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !prompt.trim()}
                    onClick={generate}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                    {user ? 'Generate' : 'Sign up to generate'}
                  </button>
                </div>
              </div>
            </div>
            {error && (
              <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>
            )}
            {job && (
              <p className="mt-2 text-xs text-white/55">
                {job.status}
                {job.cost_usd != null ? ` · $${job.cost_usd.toFixed(4)}` : ''}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Search + videos full width */}
      <section className="relative z-10 w-full border-t border-white/5 bg-black/40">
        <form onSubmit={runSearch} className="flex gap-2 px-3 py-4 md:px-6">
          <div className="glass flex flex-1 items-center gap-2 rounded-full px-4 py-2.5">
            <Search size={16} className="text-[var(--color-mute)]" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search videos and gallery by prompt…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-white/35 md:text-base"
            />
          </div>
          <button
            type="submit"
            disabled={searchBusy}
            className="glass rounded-full px-5 py-2 text-sm disabled:opacity-50"
          >
            {searchBusy ? <Loader2 className="animate-spin" size={16} /> : 'Search'}
          </button>
        </form>

        {displayVideos.length > 0 && (
          <div className="pb-2">
            <div className="flex gap-2 overflow-x-auto px-0 pb-2 md:gap-3">
              {displayVideos.map((hit) => (
                <button
                  key={hit.job_id}
                  type="button"
                  onClick={() => playVideo(hit)}
                  className="group relative h-[42vw] min-w-[72vw] shrink-0 overflow-hidden bg-white/5 sm:h-[28vw] sm:min-w-[44vw] md:h-[22vw] md:min-w-[32vw] lg:h-[18vw] lg:min-w-[28vw]"
                >
                  {hit.video_url ? (
                    <video
                      src={hit.video_url}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
                      onMouseEnter={(e) => {
                        void e.currentTarget.play().catch(() => undefined);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-end p-4 text-left text-sm text-white/70">
                      {hit.prompt}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 text-left md:p-4">
                    <div className="line-clamp-2 text-sm text-white/90 md:text-base">{hit.prompt}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Full-bleed gallery */}
      <section className="relative z-10 w-full">
        {gallery.length === 0 ? (
          <p className="px-4 py-10 text-sm text-[var(--color-mute)]">Gallery warming up…</p>
        ) : (
          <div className="gallery-bleed grid grid-cols-2 gap-px bg-black sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {gallery.map((img) => {
              const src = img.image_url || img.thumb_url;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => {
                    setPrompt(img.prompt);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="group relative aspect-[3/4] overflow-hidden bg-[#0c0c12]"
                  title={img.prompt}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={img.prompt}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-left text-xs leading-snug text-white/90 opacity-0 transition group-hover:opacity-100 md:text-sm">
                    {img.prompt.slice(0, 140)}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {settingsOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 md:items-center">
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
              H3 settles per GPU-second from app.nz + 20% (≈ ${h3Rate.toFixed(3)} / GPU-hour).
            </p>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6">
          <div className="auth-panel relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#0b0b12] md:h-auto md:max-h-[90dvh] md:rounded-[2rem] md:border md:border-white/10">
            <div className="relative h-40 shrink-0 overflow-hidden md:h-48">
              {resultUrl ? (
                <video src={resultUrl} muted loop autoPlay playsInline className="h-full w-full object-cover" />
              ) : heroImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={heroImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,#3a2a8a,transparent_55%),linear-gradient(160deg,#0a0a10,#151525)]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b12] via-[#0b0b12]/40 to-black/20" />
              <button
                type="button"
                onClick={() => setAuthOpen(false)}
                className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-4 left-5 right-5">
                <div className="font-display text-3xl font-800 tracking-tight">ManifoldGen</div>
                <p className="mt-1 text-sm text-white/70">
                  {authWelcome
                    ? 'Studio ready. Top up credits anytime and start rendering.'
                    : authMode === 'signup'
                      ? 'Create your studio account in under a minute.'
                      : 'Welcome back. Pick up where you left off.'}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-2">
              {authWelcome ? (
                <div className="flex flex-1 flex-col justify-between gap-6 py-4">
                  <ul className="space-y-3 text-sm text-white/75">
                    <li className="flex gap-3">
                      <Sparkles size={16} className="mt-0.5 text-[var(--color-accent-2)]" />
                      API key saved on this device — generate from the prompt bar.
                    </li>
                    <li className="flex gap-3">
                      <CreditCard size={16} className="mt-0.5 text-[var(--color-accent-2)]" />
                      Add credits on Account when you are ready to render H3.
                    </li>
                    <li className="flex gap-3">
                      <Clapperboard size={16} className="mt-0.5 text-[var(--color-accent-2)]" />
                      Remix any gallery still into a native-resolution video prompt.
                    </li>
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthOpen(false);
                      setAuthWelcome(false);
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3 font-semibold"
                  >
                    <Sparkles size={16} />
                    Enter studio
                  </button>
                </div>
              ) : (
                <form onSubmit={submitAuth} className="flex flex-1 flex-col">
                  <div className="mb-4 flex rounded-full bg-white/5 p-1 text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setAuthError('');
                      }}
                      className={`flex-1 rounded-full py-2 font-medium transition ${
                        authMode === 'signup' ? 'bg-white/15 text-white' : 'text-white/50'
                      }`}
                    >
                      Sign up
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setAuthError('');
                      }}
                      className={`flex-1 rounded-full py-2 font-medium transition ${
                        authMode === 'signin' ? 'bg-white/15 text-white' : 'text-white/50'
                      }`}
                    >
                      Sign in
                    </button>
                  </div>

                  <label className="mb-3 block text-sm text-white/70">
                    Email
                    <input
                      required
                      autoFocus
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                      placeholder="you@studio.com"
                    />
                  </label>
                  <label className="mb-3 block text-sm text-white/70">
                    Password
                    <input
                      required
                      type="password"
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                      placeholder="At least 8 characters"
                    />
                  </label>
                  {authMode === 'signup' && (
                    <label className="mb-3 block text-sm text-white/70">
                      Confirm password
                      <input
                        required
                        type="password"
                        autoComplete="new-password"
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                      />
                    </label>
                  )}

                  {authError && (
                    <p className="mb-3 rounded-2xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
                      {authError}
                    </p>
                  )}

                  {authMode === 'signup' && (
                    <p className="mb-4 text-xs leading-relaxed text-white/45">
                      Creates an API key and Stripe-ready wallet. H3 bills at app.nz GPU rates + 20%.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-3.5 font-semibold disabled:opacity-50"
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : authMode === 'signup' ? (
                      <UserPlus size={16} />
                    ) : (
                      <KeyRound size={16} />
                    )}
                    {authMode === 'signup' ? 'Create account' : 'Sign in'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
