'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Clapperboard,
  CreditCard,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Repeat2,
  Maximize2,
  Music2,
  Paperclip,
  Search,
  Settings2,
  Sparkles,
  UserPlus,
  Volume2,
  VolumeX,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  clearUser,
  loadStoredUser,
  refreshUser,
  saveUser,
  userFromAuthResponse,
  type StoredUser,
} from '../lib/auth';
import { parseJSONResponse } from '../lib/http';
import {
  h3Dimensions,
  loopAnchorURL,
  type H3Aspect,
  type H3Size,
} from '../lib/h3-loop';

const API = '/api';
const GALLERY_CDN = 'https://manifoldgenstatic.manifoldgen.com/gallery';

type Aspect = H3Aspect;
type Size = H3Size;
type Format = 'webm-av1' | 'mp4-h264';
type AuthMode = 'signup' | 'signin';
type AuthResponse = Parameters<typeof userFromAuthResponse>[0] & {
  created?: boolean;
};
type CheckoutKind = 'credits' | 'monthly' | 'annual';

interface StripeEmbeddedCheckout {
  mount: (target: string | HTMLElement) => void;
  destroy: () => void;
}

interface StripeBrowserClient {
  initEmbeddedCheckout: (options: {
    clientSecret: string;
    onComplete?: () => void;
  }) => Promise<StripeEmbeddedCheckout>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeBrowserClient;
  }
}

let stripeJsPromise: Promise<void> | null = null;

function loadStripeJS() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Stripe.js requires a browser'));
  if (window.Stripe) return Promise.resolve();
  if (stripeJsPromise) return stripeJsPromise;
  stripeJsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://js.stripe.com/v3/"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.stripe.com/v3/';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Stripe.js'));
    document.head.appendChild(script);
  });
  return stripeJsPromise;
}

type SessionUser = StoredUser;

interface VideoJob {
  id: string;
  status: string;
  result_url?: string;
  error?: string;
  cost_usd?: number;
}

interface VideoJobState {
  job_id?: string;
  id?: string;
  status?: string;
  result_url?: string;
  video_url?: string;
  result?: { video_url?: string };
  error?: string;
  charged_usd?: number;
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
  service?: string;
  similarity?: number;
}

interface PromptAsset {
  kind: 'image' | 'audio';
  url: string;
  name: string;
}

const ASPECTS: Aspect[] = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
const SIZES: { id: Size; label: string; hint: string }[] = [
  { id: 'preview', label: 'Preview', hint: 'Fast draft' },
  { id: 'balanced', label: 'Balanced', hint: 'Balanced speed and detail' },
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
    thumb_url: galleryImageURL(img.thumb_url || img.thumb_path || img.file_path),
    image_url: galleryImageURL(img.image_url || img.file_path),
  }));
}

// Gallery images are published to the dedicated static bucket. Keep the gallery
// independent of whichever API host is serving local development or production.
function galleryImageURL(value?: string) {
  const path = (value || '').trim();
  if (!path) return undefined;
  if (path.startsWith(`${GALLERY_CDN}/`)) return path;
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      if (parsed.pathname.startsWith('/gallery/')) return `${GALLERY_CDN}${parsed.pathname.slice('/gallery'.length)}${parsed.search}`;
      if (!parsed.pathname.startsWith('/images/')) return path;
      return `${GALLERY_CDN}/${parsed.pathname.slice('/images/'.length)}${parsed.search}`;
    } catch {
      return path;
    }
  }
  return `${GALLERY_CDN}/${path.replace(/^\/?(?:images\/)?(?:gallery\/)?/, '')}`;
}

export default function HomePage() {
  const [apiKey, setApiKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [checkoutStep, setCheckoutStep] = useState(false);
  const [checkoutClientSecret, setCheckoutClientSecret] = useState('');
  const [checkoutPublishableKey, setCheckoutPublishableKey] = useState('');
  const [checkoutLabel, setCheckoutLabel] = useState('');
  const checkoutMountRef = useRef<HTMLDivElement>(null);
  const embeddedCheckoutRef = useRef<StripeEmbeddedCheckout | null>(null);
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
  const [loopMode, setLoopMode] = useState(false);
  const [upscaleMode, setUpscaleMode] = useState(false);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(2);
  const [generationStage, setGenerationStage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [job, setJob] = useState<VideoJob | null>(null);
  const [h3BaseEstimateUSD, setH3BaseEstimateUSD] = useState(1.01);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [imageCredits, setImageCredits] = useState(4);
  const [upscaleRates, setUpscaleRates] = useState({ base: 0.10, outputMPSecond: 0.012 });
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [backgroundRemovingID, setBackgroundRemovingID] = useState('');
  const [featuredVideos, setFeaturedVideos] = useState<VideoHit[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [videoHits, setVideoHits] = useState<VideoHit[]>([]);
  const [heroMuted, setHeroMuted] = useState(true);
  const [assets, setAssets] = useState<PromptAsset[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [draggingAsset, setDraggingAsset] = useState(false);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);

  const creditsLabel = useMemo(() => {
    if (!user) return 'Sign in';
    const usd = user.credits_usd ?? user.credits * creditPrice;
    const creds = creditPrice > 0 ? Math.round(usd / creditPrice) : Math.round(user.credits);
    return `${creds.toLocaleString()} cr · $${usd.toFixed(2)}`;
  }, [user, creditPrice]);

  const estVideoUSD = useMemo(() => {
    const sizeFactor = size === 'preview' ? 0.45 : size === 'balanced' ? 0.7 : 1;
    return Math.max(0.1, Math.ceil(h3BaseEstimateUSD * (duration / 5) * (steps / 20) * sizeFactor * 100) / 100);
  }, [h3BaseEstimateUSD, duration, size, steps]);
  const estVideoCredits = useMemo(
    () => Math.max(Math.ceil(0.1 / creditPrice), Math.ceil(estVideoUSD / creditPrice)),
    [creditPrice, estVideoUSD],
  );
  const estUpscaleUSD = useMemo(() => {
    if (!upscaleMode) return 0;
    const [width, height] = h3Dimensions(aspect, size);
    const outputMP = width * height * upscaleScale * upscaleScale / 1_000_000;
    return Math.ceil((upscaleRates.base + outputMP * duration * upscaleRates.outputMPSecond) * 100 - 1e-8) / 100;
  }, [aspect, duration, size, upscaleMode, upscaleRates, upscaleScale]);
  const estUpscaleCredits = Math.ceil(estUpscaleUSD / creditPrice);

  const applyUser = useCallback((next: StoredUser) => {
    saveUser(next);
    setUser(next);
    setApiKey(next.api_key);
    if (next.email) setEmail(next.email);
  }, []);

  const softRefresh = useCallback(async (key: string) => {
    const next = await refreshUser(key);
    if (next) applyUser(next);
  }, [applyUser]);

  const loadGallery = useCallback(async (q = '') => {
    const url = q.trim()
      ? `${API}/images/semantic?q=${encodeURIComponent(q.trim())}&top_k=48`
      : `${API}/images?skip_total=true&varied=true&per_page=48&allow_nsfw=true`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setGallery(normalizeImages(data.results || data.images || []));
  }, []);

  const loadFeaturedVideos = useCallback(async () => {
    const res = await fetch(`${API}/videos/featured?limit=24`);
    if (!res.ok) return;
    const data = await res.json();
    const rows: VideoHit[] = (data.results || []).filter((r: VideoHit) => r.video_url);
    setFeaturedVideos(rows);
    if (rows[0]?.prompt) {
      setPrompt((p) =>
        p ===
          'Slow aerial drift over a neon harbor at night, wet asphalt reflections, cinematic anamorphic bokeh'
          ? rows[0].prompt
          : p,
      );
    }
  }, []);

  useEffect(() => {
    const stored = loadStoredUser();
    if (stored) {
      applyUser(stored);
      void softRefresh(stored.api_key);
    }
    fetch(`${API}/pricing`)
      .then((r) => r.json())
      .then((data) => {
        if (data.credit_price_usd) setCreditPrice(data.credit_price_usd);
        if (data.image_credits) setImageCredits(data.image_credits);
        if (data.studio?.upscale_base_usd && data.studio?.upscale_output_mp_second_usd) {
          setUpscaleRates({ base: data.studio.upscale_base_usd, outputMPSecond: data.studio.upscale_output_mp_second_usd });
        }
        if (data.h3_video_estimate?.estimated_cost_usd) {
          setH3BaseEstimateUSD(data.h3_video_estimate.estimated_cost_usd);
        }
      })
      .catch(() => undefined);
    // The studio is usable without these feeds. Start them after the initial
    // viewport is responsive rather than competing with the hero for bandwidth.
    const deferredLoad = () => {
      loadGallery().catch(() => undefined);
      loadFeaturedVideos().catch(() => undefined);
    };
    const idleId = window.requestIdleCallback?.(deferredLoad, { timeout: 1800 });
    const timeoutId = idleId === undefined ? window.setTimeout(deferredLoad, 700) : undefined;
    return () => {
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [applyUser, softRefresh, loadGallery, loadFeaturedVideos]);

  useEffect(() => {
    if (!checkoutClientSecret || !checkoutPublishableKey || !checkoutMountRef.current) return;
    let cancelled = false;
    const mountCheckout = async () => {
      try {
        embeddedCheckoutRef.current?.destroy();
        embeddedCheckoutRef.current = null;
        await loadStripeJS();
        if (cancelled) return;
        const stripe = window.Stripe?.(checkoutPublishableKey);
        if (!stripe) throw new Error('Stripe.js did not initialize');
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret: checkoutClientSecret,
          onComplete: () => {
            setCheckoutClientSecret('');
            setCheckoutStep(false);
            setAuthOpen(false);
            if (apiKey) {
              void softRefresh(apiKey);
              window.setTimeout(() => void softRefresh(apiKey), 1500);
            }
          },
        });
        if (cancelled) {
          checkout.destroy();
          return;
        }
        checkout.mount(checkoutMountRef.current!);
        embeddedCheckoutRef.current = checkout;
      } catch (err) {
        if (!cancelled) setAuthError(err instanceof Error ? err.message : 'Failed to open checkout');
      }
    };
    void mountCheckout();
    return () => {
      cancelled = true;
      embeddedCheckoutRef.current?.destroy();
      embeddedCheckoutRef.current = null;
    };
  }, [apiKey, checkoutClientSecret, checkoutPublishableKey, softRefresh]);
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
    setCheckoutStep(false);
    setCheckoutClientSecret('');
    setCheckoutPublishableKey('');
    setAuthOpen(true);
  }

  function closeAuth() {
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
    setCheckoutClientSecret('');
    setCheckoutPublishableKey('');
    setCheckoutStep(false);
    setAuthOpen(false);
  }

  async function startCheckout(kind: CheckoutKind, amountUSD = 25) {
    if (!apiKey) return;
    setBusy(true);
    setAuthError('');
    setCheckoutClientSecret('');
    setCheckoutPublishableKey('');
    try {
      const body = kind === 'credits'
        ? { type: 'credits', amount_usd: amountUSD, return_url: `${window.location.origin}/?payment=success` }
        : { type: 'subscription', plan: kind, return_url: `${window.location.origin}/?payment=success` };
      const res = await fetch(`${API}/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Checkout failed');
      if (data.url && !data.client_secret) {
        window.location.href = data.url;
        return;
      }
      if (!data.client_secret || !data.publishable_key) throw new Error('Stripe checkout is unavailable');
      setCheckoutLabel(kind === 'credits' ? `$${amountUSD} credits` : `${kind} subscription`);
      setCheckoutPublishableKey(data.publishable_key);
      setCheckoutClientSecret(data.client_secret);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
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
      const data = await parseJSONResponse<AuthResponse>(res, 'Auth failed');
      const next = userFromAuthResponse(data);
      if (!next) throw new Error('No API key returned');
      applyUser(next);
      if (data.created || authMode === 'signup') {
        setCheckoutStep(true);
      } else {
        setAuthOpen(false);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Auth failed');
    } finally {
      setBusy(false);
    }
  }

  async function generate(overrides?: { prompt?: string; image?: string; audio?: string }) {
    if (!apiKey) {
      openAuth('signup');
      return;
    }
    setError('');
    setBusy(true);
    setGenerationStage(loopMode ? 'Creating loop keyframe…' : 'Starting H3 render…');
    try {
      let firstFrame = '';
      if (loopMode) {
        const [width, height] = h3Dimensions(aspect, size);
        const imageRes = await fetch(`${API}/service`, {
          method: 'POST',
          headers: authHeaders(apiKey),
          body: JSON.stringify({
            service: 'zimage',
            prompt,
            width,
            height,
            n: 1,
          }),
        });
        const imageData = await parseJSONResponse<Parameters<typeof loopAnchorURL>[0]>(
          imageRes,
          'Loop keyframe generation failed',
        );
        firstFrame = loopAnchorURL(imageData, window.location.origin);
        setGenerationStage('Animating back to the same keyframe…');
      }
      const res = await fetch(`${API}/service`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          service: 'h3_video',
          prompt: overrides?.prompt ?? prompt,
          aspect_ratio: aspect,
          size,
          duration,
          num_steps: steps,
          output_format: format,
          include_audio: includeAudio,
          loop: loopMode,
          ...(firstFrame ? { first_frame: firstFrame } : {}),
          structured_prompt: true,
          ...(!firstFrame ? { first_frame: overrides?.image ?? assets.find((asset) => asset.kind === 'image')?.url } : {}),
          audio_url: overrides?.audio ?? assets.find((asset) => asset.kind === 'audio')?.url,
        }),
      });
      const data = await parseJSONResponse<Record<string, unknown> & {
        result?: { job_id?: string };
        job_id?: string;
        id?: string;
      }>(res, 'Generation failed');
      const jobId = data.result?.job_id || data.job_id || data.id;
      if (!jobId) throw new Error('No job id returned');
      setGenerationStage('Rendering H3 video…');
      const generated = await pollJob(jobId);
      if (upscaleMode) {
        const videoURL = generated.result_url || generated.video_url || generated.result?.video_url;
        if (!videoURL) throw new Error('H3 completed without a video to upscale');
        const [width, height] = h3Dimensions(aspect, size);
        setGenerationStage(`Starting Real-ESRGAN ${upscaleScale}× upscale…`);
        const upscaleResponse = await fetch(`${API}/studio/upscale-video`, {
          method: 'POST', headers: authHeaders(apiKey),
          body: JSON.stringify({ video_url: videoURL, width, height, duration, scale: upscaleScale }),
        });
        const upscale = await parseJSONResponse<{ job_id?: string }>(upscaleResponse, 'Could not start post-upscale');
        if (!upscale.job_id) throw new Error('Post-upscale returned no job');
        setGenerationStage(`Upscaling every frame ${upscaleScale}×…`);
        await pollJob(upscale.job_id);
      }
      await softRefresh(apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setBusy(false);
      setGenerationStage('');
    }
  }

  function useGalleryImage(img: GalleryImage) {
    const src = img.image_url || img.thumb_url;
    if (!src) return;
    setPrompt(img.prompt);
    setAssets((current) => [
      { kind: 'image', url: src, name: img.prompt.slice(0, 48) || 'Gallery image' },
      ...current.filter((asset) => asset.kind !== 'image'),
    ]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openGalleryImageInStudio(img: GalleryImage, source = img.image_url || img.thumb_url) {
    if (!source) return;
    const query = new URLSearchParams({ image_url: source, name: img.prompt.slice(0, 80) || 'Gallery image' });
    window.location.assign(`/studio?${query}`);
  }

  async function removeGalleryBackground(img: GalleryImage) {
    const source = img.image_url || img.thumb_url;
    if (!source) return;
    if (!apiKey) {
      openAuth('signup');
      return;
    }
    setBackgroundRemovingID(img.id);
    setError('');
    try {
      const response = await fetch(`${API}/studio/remove-background`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({ image_url: source }),
      });
      const data = await parseJSONResponse<{ image_url?: string; credits_remain?: number }>(response, 'Background removal failed');
      if (!data.image_url) throw new Error('Background removal returned no image');
      if (user && typeof data.credits_remain === 'number') {
        const next = { ...user, credits: data.credits_remain };
        setUser(next);
        saveUser(next);
      }
      openGalleryImageInStudio(img, data.image_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Background removal failed');
    } finally {
      setBackgroundRemovingID('');
    }
  }

  async function uploadAssets(files: FileList | File[]) {
    const accepted = Array.from(files).filter(
      (file) => file.type.startsWith('image/') || file.type.startsWith('audio/'),
    );
    if (accepted.length === 0) {
      setError('Drop an image or audio file');
      return;
    }
    if (!apiKey) {
      openAuth('signup');
      return;
    }
    setAssetBusy(true);
    setError('');
    try {
      const uploaded: PromptAsset[] = [];
      for (const file of accepted) {
        const params = new URLSearchParams({
          filename: file.name,
          content_type: file.type || 'application/octet-stream',
          dataset: 'prompt-assets',
        });
        const presign = await fetch(`${API}/uploads/presign?${params}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const target = await presign.json();
        if (!presign.ok) throw new Error(target.error || 'Could not prepare upload');
        const put = await fetch(target.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!put.ok) throw new Error(`Upload failed for ${file.name}`);
        uploaded.push({
          kind: file.type.startsWith('audio/') ? 'audio' : 'image',
          url: target.public_url,
          name: file.name,
        });
      }
      setAssets((current) => {
        const kinds = new Set(uploaded.map((asset) => asset.kind));
        return [...uploaded, ...current.filter((asset) => !kinds.has(asset.kind))];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Asset upload failed');
    } finally {
      setAssetBusy(false);
    }
  }

  async function pollJob(jobId: string): Promise<VideoJobState> {
    for (let i = 0; i < 1200; i++) {
      const res = await fetch(`${API}/video-jobs/${jobId}`, {
        headers: authHeaders(apiKey),
      });
      const data = await parseJSONResponse<VideoJobState & { job?: VideoJobState }>(
        res,
        'Job poll failed',
      );
      const state: VideoJobState = data.job || data;
      const url =
        state.result_url ||
        state.video_url ||
        state.result?.video_url;
      setJob({
        id: state.job_id || state.id || jobId,
        status: state.status || 'processing',
        result_url: url,
        error: state.error,
        cost_usd: state.charged_usd ?? state.cost_usd,
      });
      if (['completed', 'succeeded', 'failed', 'payment_required', 'error'].includes(state.status || '')) {
        if (state.status === 'failed' || state.status === 'error' || state.status === 'payment_required') {
          throw new Error(state.error || 'Video failed');
        }
        return state;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error('Timed out waiting for video');
  }

  function signOut() {
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
    clearUser();
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

  async function playFullscreen() {
    const video = heroVideoRef.current;
    if (!video) return;
    await video.play().catch(() => undefined);
    if (video.requestFullscreen) {
      await video.requestFullscreen().catch(() => undefined);
      return;
    }
    const iosVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    iosVideo.webkitEnterFullscreen?.();
  }

  const [logoOk, setLogoOk] = useState(true);
  const logoSrc = '/brand/logo-nobg.webp';

  const resultUrl = job?.result_url || featuredVideos[0]?.video_url;
  // A local, cacheable poster protects LCP from slow API/gallery responses.
  const heroImage = '/brand/manifoldgen-og.webp';
  const displayVideos = videoHits.length > 0 ? videoHits : featuredVideos;

  return (
    <main className="relative min-h-screen bg-[var(--color-ink)]">
      {/* Full-bleed hero */}
      <section className="relative h-[100dvh] w-full overflow-hidden">
        <div className="absolute inset-0">
          {resultUrl ? (
            <video
              ref={heroVideoRef}
              key={resultUrl}
              className="hero-motion h-full w-full object-cover"
              src={resultUrl}
              autoPlay
              muted={heroMuted}
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
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-transparent to-transparent" />
          <div className="hero-grain pointer-events-none absolute inset-0 opacity-[0.35]" />
        </div>

        <header className="relative z-20 flex items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                width={54}
                height={36}
                className="h-8 w-auto object-contain brightness-125 drop-shadow md:h-9"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <Clapperboard className="text-[var(--color-accent-2)]" size={22} />
            )}
            <h1 className="font-display text-base font-700 tracking-tight sm:text-xl md:text-2xl">
              ManifoldGen
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="/studio" className="glass hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white sm:flex">
              <Clapperboard size={14} />
              Editor
            </a>
            <a href="/api" className="glass hidden rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white sm:block">
              API
            </a>
            {resultUrl ? (
              <>
                <button
                  type="button"
                  onClick={playFullscreen}
                  className="glass rounded-full p-2.5 text-[var(--color-mute)] transition hover:text-white"
                  aria-label="Play hero video fullscreen"
                >
                  <Maximize2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setHeroMuted((m) => !m)}
                  className="glass rounded-full p-2.5 text-[var(--color-mute)] transition hover:text-white"
                  aria-label={heroMuted ? 'Unmute hero video' : 'Mute hero video'}
                >
                  {heroMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </>
            ) : null}
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
                  data-testid="home-sign-in"
                  onClick={() => openAuth('signin')}
                  className="glass hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-medium sm:inline-flex"
                >
                  <LogIn size={16} />
                  Sign in
                </button>
                <button
                  type="button"
                  data-testid="home-sign-up"
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
            <div
              className={`glass prompt-glow rounded-3xl p-3 transition md:p-4 ${draggingAsset ? 'ring-2 ring-[var(--color-accent-2)]' : ''}`}
              onDragEnter={(e) => {
                e.preventDefault();
                setDraggingAsset(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingAsset(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDraggingAsset(false);
                void uploadAssets(e.dataTransfer.files);
              }}
            >
              {assets.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2 px-1">
                  {assets.map((asset) => (
                    <div key={`${asset.kind}-${asset.url}`} className="flex max-w-full items-center gap-2 rounded-xl bg-black/35 p-1.5 pr-2 text-xs">
                      {asset.kind === 'image' ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={asset.url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10"><Music2 size={17} /></span>
                      )}
                      <span className="max-w-40 truncate text-white/75">{asset.name}</span>
                      <button type="button" onClick={() => setAssets((rows) => rows.filter((row) => row.url !== asset.url))} aria-label={`Remove ${asset.name}`} className="rounded-full p-1 text-white/45 hover:text-white"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : null}
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
                <button
                  type="button"
                  data-testid="home-loop-toggle"
                  aria-pressed={loopMode}
                  disabled={busy}
                  onClick={() => setLoopMode((enabled) => !enabled)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                    loopMode
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-white/5 text-[var(--color-mute)] hover:text-white'
                  }`}
                  title="Generate a looping video" 
                >
                  <Repeat2 size={14} />
                  Loop
                </button>
                <button
                  type="button"
                  data-testid="home-upscale-toggle"
                  aria-pressed={upscaleMode}
                  disabled={busy}
                  onClick={() => setUpscaleMode((enabled) => !enabled)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                    upscaleMode
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-white/5 text-[var(--color-mute)] hover:text-white'
                  }`}
                  title="Post-upscale the finished video with Real-ESRGAN"
                >
                  <Maximize2 size={14} />
                  {upscaleMode ? `${upscaleScale}× upscale` : 'Upscale'}
                </button>
                <span className="hidden rounded-full bg-white/5 px-3 py-1.5 text-sm text-[var(--color-mute)] sm:inline" data-testid="home-video-cost">
                  {duration}s · ~{estVideoCredits + (loopMode ? imageCredits : 0) + estUpscaleCredits} credits · est. ${(estVideoUSD + estUpscaleUSD).toFixed(2)}
                </span>
                <span className="hidden rounded-full bg-white/5 px-3 py-1.5 text-sm text-[var(--color-mute)] md:inline" data-testid="home-image-cost">
                  Image {imageCredits} credits ($0.04)
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <input ref={assetInputRef} type="file" accept="image/*,audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void uploadAssets(e.target.files); e.currentTarget.value = ''; }} />
                  <button type="button" disabled={assetBusy} onClick={() => assetInputRef.current?.click()} className="glass inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm text-white/75 disabled:opacity-50" aria-label="Attach image or audio">
                    {assetBusy ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
                    <span className="hidden sm:inline">Add asset</span>
                  </button>
                  <button
                    type="button"
                    disabled={busy || !prompt.trim()}
                    onClick={() => void generate()}
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
            {busy && generationStage && (
              <p className="mt-2 text-xs text-white/65" data-testid="home-generation-stage">
                {generationStage}
              </p>
            )}
            {job && (
              <p className="mt-2 text-xs text-white/55" data-testid="home-job-cost">
                {job.status}
                {job.cost_usd != null
                  ? ` · $${job.cost_usd.toFixed(4)} · ~${Math.ceil(job.cost_usd / creditPrice)} credits`
                  : ''}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Search + videos full width */}
      <section className="relative z-10 w-full border-t border-white/5 bg-[#050508]">
        <form onSubmit={runSearch} className="flex gap-2 px-3 py-5 md:px-6">
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
          <div className="pb-4" data-testid="showcase-reel">
            <div className="flex items-end justify-between px-3 pb-3 md:px-6">
              <div>
                <h2 className="font-display text-lg tracking-wide text-white md:text-xl">Showcase</h2>
                <p className="text-sm text-[var(--color-mute)]">H3 clips — click to load into the studio</p>
              </div>
              <span className="hidden text-xs text-white/40 sm:inline">{displayVideos.length}</span>
            </div>
            <div className="reel-scroll flex snap-x snap-mandatory gap-0 overflow-x-auto pb-1">
              {displayVideos.map((hit, idx) => (
                <div key={hit.job_id} className="group relative aspect-video h-[46vw] shrink-0 snap-start overflow-hidden sm:h-[30vw] md:h-[24vw] lg:h-[20vw]">
                  <button type="button" aria-label="Play showcase video" onClick={() => playVideo(hit)} className="absolute inset-0 h-full w-full text-left">
                  {hit.video_url ? (
                    <video
                      src={hit.video_url}
                      muted
                      loop
                      playsInline
                      preload={idx < 3 ? 'metadata' : 'none'}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                      onMouseEnter={(e) => {
                        void e.currentTarget.play().catch(() => undefined);
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-end bg-white/5 p-4 text-left text-sm text-white/70">
                      {hit.prompt}
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent opacity-90 transition group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 text-left md:p-4">
                    <div className="line-clamp-2 text-sm leading-snug text-white/95 md:text-base">{hit.prompt}</div>
                  </div>
                  </button>
                  {hit.video_url && <button
                    type="button"
                    data-testid={`gallery-restyle-${hit.job_id}`}
                    onClick={() => { window.location.href = `/studio?video_url=${encodeURIComponent(hit.video_url!)}&name=${encodeURIComponent(hit.prompt || 'Gallery video')}&restyle=1`; }}
                    className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/65 px-3 py-1.5 text-xs font-medium text-white opacity-100 shadow-lg backdrop-blur-md transition hover:border-violet-300/60 hover:bg-violet-600/80 md:opacity-0 md:group-hover:opacity-100"
                  ><WandSparkles size={13} /> Transform</button>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Full-bleed gallery */}
      <section className="relative z-10 w-full" data-testid="still-gallery">
        <div className="flex items-end justify-between px-3 py-4 md:px-6">
          <div>
            <h2 className="font-display text-lg tracking-wide text-white md:text-xl">Gallery</h2>
            <p className="text-sm text-[var(--color-mute)]">Stills to remix into video prompts</p>
          </div>
          {gallery.length > 0 ? (
            <span className="text-xs text-white/40">{gallery.length}</span>
          ) : null}
        </div>
        {gallery.length === 0 ? (
          <p className="px-4 pb-12 text-sm text-[var(--color-mute)]">Gallery warming up…</p>
        ) : (
          <div className="gallery-bleed grid grid-cols-2 gap-px bg-black sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {gallery.map((img) => {
              const src = img.image_url || img.thumb_url;
              return (
                <div
                  key={img.id}
                  className="group relative aspect-[3/4] overflow-hidden bg-[#0c0c12]"
                >
                  <button type="button" onClick={() => useGalleryImage(img)} className="absolute inset-0 h-full w-full" title={img.prompt}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={img.prompt}
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-70 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100" />
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3 pb-14 text-left text-xs leading-snug text-white/90 opacity-90 transition group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 md:text-sm">
                    {img.prompt.slice(0, 140)}
                  </div>
                  {src ? (
                    <div className="absolute inset-x-3 bottom-3 z-10 grid grid-cols-2 gap-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <button type="button" onClick={() => { useGalleryImage(img); void generate({ prompt: img.prompt, image: src }); }} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white shadow-lg"><Sparkles size={14} />Generate video</button>
                      <button type="button" onClick={() => openGalleryImageInStudio(img)} className="inline-flex items-center justify-center gap-1 rounded-full bg-black/70 px-2 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black"><Clapperboard size={13} />Studio</button>
                      <button type="button" disabled={backgroundRemovingID === img.id} onClick={() => void removeGalleryBackground(img)} className="inline-flex items-center justify-center gap-1 rounded-full bg-black/70 px-2 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black disabled:opacity-60">{backgroundRemovingID === img.id ? <Loader2 className="animate-spin" size={13} /> : <WandSparkles size={13} />}Remove BG</button>
                    </div>
                  ) : null}
                </div>
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
              Duration (4–60s; &gt;15s chains segments)
              <input
                type="range"
                min={4}
                max={60}
                step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-2 w-full"
              />
              <span className="text-white">
                {duration}s{duration > 15 ? ' · multi-seg chain' : ''}
              </span>
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
                className="dark-select mt-2 w-full rounded-xl px-3 py-2"
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
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="settings-loop-toggle"
                checked={loopMode}
                disabled={busy}
                onChange={(e) => setLoopMode(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Seamless loop
                <span className="mt-0.5 block text-xs text-[var(--color-mute)]">
                make a looping video / cinemagraph
                </span>
              </span>
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="settings-upscale-toggle"
                checked={upscaleMode}
                disabled={busy}
                onChange={(e) => setUpscaleMode(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Real-ESRGAN post-upscale
                <span className="mt-1 flex items-center gap-2 text-xs text-[var(--color-mute)]">
                  Restore every frame after H3 renders
                  <select value={upscaleScale} disabled={!upscaleMode || busy} onChange={(e) => setUpscaleScale(Number(e.target.value) as 2 | 4)} className="dark-select rounded-md px-2 py-1">
                    <option value={2}>2×</option>
                    <option value={4}>4×</option>
                  </select>
                </span>
              </span>
            </label>
            <p className="mt-4 text-xs text-[var(--color-mute)]">
              Video shows an estimate up front and settles from actual generation time. Credits are about $0.01 each;
              images cost {imageCredits} credits ($0.04). Full examples are in the API docs.
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
                onClick={closeAuth}
                className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white/80 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              <div className="absolute bottom-4 left-5 right-5">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/logo-nobg.webp" alt="" className="h-10 w-auto object-contain brightness-125" />
                  <div className="font-display text-3xl font-800 tracking-tight">ManifoldGen</div>
                </div>
                <p className="mt-1 text-sm text-white/70">
                  {checkoutStep
                    ? 'Pick a plan.'
                    : authMode === 'signup'
                      ? 'Create your account.'
                      : 'Welcome back. Pick up where you left off.'}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-6 pt-2">
              {checkoutStep ? (
                <div className="flex flex-1 flex-col gap-4 py-4">
                  {checkoutClientSecret ? (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">Checkout</div>
                          <div className="text-xs text-white/45">{checkoutLabel}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCheckoutClientSecret('');
                            setCheckoutPublishableKey('');
                          }}
                          className="text-sm text-white/55 hover:text-white"
                        >
                          Change
                        </button>
                      </div>
                      <div ref={checkoutMountRef} className="min-h-80 overflow-hidden rounded-2xl bg-white" />
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startCheckout('monthly')}
                        className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent)]/15 p-4 text-left transition hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Subscribe monthly</span>
                          <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold">Recommended</span>
                        </div>
                        <div className="mt-1 text-sm text-white/60">Unlimited images + $25 video credits/month</div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startCheckout('annual')}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:opacity-50"
                      >
                        <div className="font-semibold">Subscribe annually</div>
                        <div className="mt-1 text-sm text-white/60">Unlimited images + $300 video credits/year</div>
                      </button>
                      <div className="pt-1">
                        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">Or buy credits</div>
                        <div className="grid grid-cols-3 gap-2">
                          {[10, 25, 50].map((amount) => (
                            <button
                              key={amount}
                              type="button"
                              disabled={busy}
                              onClick={() => void startCheckout('credits', amount)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                            >
                              ${amount}
                            </button>
                          ))}
                        </div>
                      </div>
                      {busy ? <Loader2 className="mx-auto animate-spin text-white/50" size={20} /> : null}
                      {authError ? <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{authError}</p> : null}
                    </>
                  )}
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
                      data-testid="home-auth-email"
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
                      data-testid="home-auth-password"
                      type="password"
                      autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1.5 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-[var(--color-accent)]"
                      placeholder="At least 8 characters"
                    />
                  </label>
                  {authError && (
                    <p className="mb-3 rounded-2xl bg-red-500/15 px-3 py-2 text-sm text-red-200">
                      {authError}
                    </p>
                  )}

                  {authMode === 'signup' && (
                    <p className="mb-4 text-xs leading-relaxed text-white/45">
                      Creates an API key and Stripe-ready wallet. Video pricing is estimated before rendering.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={busy}
                    data-testid="home-auth-submit"
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
