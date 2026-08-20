'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Clapperboard,
  ClipboardPaste,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Clock3,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Repeat2,
  GripVertical,
  Image as ImageIcon,
  Maximize2,
  Mic2,
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
import { ManifoldLoader } from '../components/manifold-loader';
import {
  h3Dimensions,
  loopAnchorURL,
  type H3Aspect,
  type H3Size,
} from '../lib/h3-loop';

const API = '/api';
const GALLERY_CDN = 'https://manifoldgenstatic.manifoldgen.com/gallery';
const GALLERY_ASSET_VERSION = '20260817-gallery-index-refresh';
const HOMEPAGE_HERO_PROMPT =
  'An obsidian lighthouse fractures moonlight into spectral fog while black waves climb upward, slow impossible crane shot; sub-bass surf, distant glass harmonics';
const HOMEPAGE_HERO_VIDEO_URL =
  'https://manifoldgenstatic.manifoldgen.com/gallery/03475ad6-41a/videos/add2e0dd-9f8f-4d6d-b0dc-41a210fecaa3.webm';

type Aspect = H3Aspect;
type Size = H3Size;
type Format = 'webm-av1' | 'mp4-h264';
type GenerationMode = 'video' | 'images';
type AuthMode = 'signup' | 'signin';
type AuthResponse = Parameters<typeof userFromAuthResponse>[0] & {
  created?: boolean;
};
type CheckoutKind = 'credits' | 'creator_monthly' | 'creator_annual' | 'pro_monthly' | 'pro_annual';

const checkoutPlanLabels: Record<Exclude<CheckoutKind, 'credits'>, string> = {
  creator_monthly: 'Creator · $14.99/month',
  creator_annual: 'Creator · $149/year',
  pro_monthly: 'Pro · $49/month',
  pro_annual: 'Pro · $490/year',
};

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
  result?: { video_url?: string; stage?: string; music_video?: boolean };
  error?: string;
  charged_usd?: number;
  cost_usd?: number;
}

type HomeGenerationTask = {
  id: string;
  mode: GenerationMode;
  label: string;
  status: 'starting' | 'queued' | 'processing' | 'upscaling' | 'completed' | 'failed';
  result_url?: string;
  error?: string;
  cost_usd?: number;
};

interface GalleryImage {
  id: string;
  prompt: string;
  width?: number;
  height?: number;
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
  music_video?: boolean;
  music_audio_url?: string;
  similarity?: number;
}

type GalleryFeedItem =
  | { kind: 'image'; id: string; prompt: string; image: GalleryImage; src?: string }
  | { kind: 'video'; id: string; prompt: string; video: VideoHit };

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
  const cacheBusted = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${GALLERY_ASSET_VERSION}`;
  const path = (value || '').trim();
  if (!path) return undefined;
  if (path.startsWith(`${GALLERY_CDN}/`)) return cacheBusted(path);
  if (/^https?:\/\//i.test(path)) {
    try {
      const parsed = new URL(path);
      if (parsed.pathname.startsWith('/gallery/')) return cacheBusted(`${GALLERY_CDN}${parsed.pathname.slice('/gallery'.length)}${parsed.search}`);
      if (!parsed.pathname.startsWith('/images/')) return path;
      return cacheBusted(`${GALLERY_CDN}/${parsed.pathname.slice('/images/'.length)}${parsed.search}`);
    } catch {
      return path;
    }
  }
  return cacheBusted(`${GALLERY_CDN}/${path.replace(/^\/?(?:images\/)?(?:gallery\/)?/, '')}`);
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
  const [prompt, setPrompt] = useState(HOMEPAGE_HERO_PROMPT);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('video');
  const [aspect, setAspect] = useState<Aspect>('16:9');
  const [size, setSize] = useState<Size>('native');
  const [duration, setDuration] = useState(5);
  const [steps, setSteps] = useState(20);
  const [format, setFormat] = useState<Format>('webm-av1');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [loopMode, setLoopMode] = useState(false);
  const [musicVideoMode, setMusicVideoMode] = useState(false);
  const [upscaleMode, setUpscaleMode] = useState(false);
  const [upscaleScale, setUpscaleScale] = useState<2 | 4>(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [job, setJob] = useState<VideoJob | null>(null);
  const [generationTasks, setGenerationTasks] = useState<HomeGenerationTask[]>([]);
  const [h3BaseEstimateUSD, setH3BaseEstimateUSD] = useState(1.01);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [imageCredits, setImageCredits] = useState(4);
  const [upscaleRates, setUpscaleRates] = useState({ base: 0.10, outputMPSecond: 0.012 });
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [galleryCursor, setGalleryCursor] = useState<number | null>(null);
  const [galleryWrapped, setGalleryWrapped] = useState(false);
  const [galleryHasMore, setGalleryHasMore] = useState(true);
  const [galleryLoadingMore, setGalleryLoadingMore] = useState(false);
  const [backgroundRemovingID, setBackgroundRemovingID] = useState('');
  const [featuredVideos, setFeaturedVideos] = useState<VideoHit[]>([]);
  const [featuredHasMore, setFeaturedHasMore] = useState(true);
  const [searchQ, setSearchQ] = useState('');
  const [activeSearchQ, setActiveSearchQ] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchLimit, setSearchLimit] = useState(24);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [videoHits, setVideoHits] = useState<VideoHit[]>([]);
  const [heroMuted, setHeroMuted] = useState(true);
  const [assets, setAssets] = useState<PromptAsset[]>([]);
  const [assetBusy, setAssetBusy] = useState(false);
  const [draggingAsset, setDraggingAsset] = useState(false);
  const [framesOpen, setFramesOpen] = useState(false);
  const [frameDropIndex, setFrameDropIndex] = useState<number | null>(null);
  const pendingAssetFilesRef = useRef<File[]>([]);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const assetInputRef = useRef<HTMLInputElement>(null);
  const searchMoreRef = useRef<HTMLDivElement>(null);
  const galleryMoreRef = useRef<HTMLDivElement>(null);
  const gallerySeedRef = useRef(Math.random());

  const updateGenerationTask = useCallback((id: string, update: Partial<HomeGenerationTask>) => {
    setGenerationTasks((current) => current.map((task) => task.id === id ? { ...task, ...update } : task));
  }, []);

  const creditsLabel = useMemo(() => {
    if (!user) return 'Sign in';
    const usd = user.credits_usd ?? user.credits * creditPrice;
    return `$${usd.toFixed(2)}`;
  }, [user, creditPrice]);

  const estVideoUSD = useMemo(() => {
    const sizeFactor = size === 'preview' ? 0.45 : size === 'balanced' ? 0.7 : 1;
    return Math.max(0.1, Math.ceil(h3BaseEstimateUSD * (duration / 5) * (steps / 20) * sizeFactor * 100) / 100);
  }, [h3BaseEstimateUSD, duration, size, steps]);
  const estUpscaleUSD = useMemo(() => {
    if (!upscaleMode) return 0;
    const [width, height] = h3Dimensions(aspect, size);
    const outputMP = width * height * upscaleScale * upscaleScale / 1_000_000;
    return Math.ceil((upscaleRates.base + outputMP * duration * upscaleRates.outputMPSecond) * 100 - 1e-8) / 100;
  }, [aspect, duration, size, upscaleMode, upscaleRates, upscaleScale]);

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

  const loadGallery = useCallback(async (q = '', attempt = 0): Promise<void> => {
    const url = q.trim()
      ? `${API}/images/semantic?q=${encodeURIComponent(q.trim())}&top_k=48`
      : `${API}/images?skip_total=true&varied=true&per_page=24&allow_nsfw=true&seed=${gallerySeedRef.current}`;
    const res = await fetch(url);
    if (!res.ok) {
      // The public API can briefly be unavailable while the image/search
      // indexes finish loading after a deploy. Retry so the gallery does not
      // remain permanently stuck on “warming up” after one early 503.
      if (attempt < 3) {
        await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
        return loadGallery(q, attempt + 1);
      }
      return;
    }
    const data = await res.json();
    setGallery(normalizeImages(data.results || data.images || []));
    if (!q.trim()) {
      setGalleryCursor(typeof data.next_cursor === 'number' ? data.next_cursor : null);
      setGalleryWrapped(Boolean(data.cursor_wrapped));
      setGalleryHasMore(typeof data.next_cursor === 'number');
    }
  }, []);

  const loadFeaturedVideos = useCallback(async () => {
    const res = await fetch(`${API}/videos/featured?limit=24&offset=0`);
    if (!res.ok) return;
    const data = await res.json();
    const rows: VideoHit[] = (data.results || []).filter((r: VideoHit) => r.video_url);
    setFeaturedVideos(rows);
    setFeaturedHasMore(data.has_more ?? rows.length === 24);
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
        if (data.video_estimate?.estimated_cost_usd) {
          setH3BaseEstimateUSD(data.video_estimate.estimated_cost_usd);
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
      setActiveSearchQ('');
      setVideoHits([]);
      setSearchLimit(24);
      setSearchHasMore(false);
      await loadGallery();
      return;
    }
    setSearchBusy(true);
    try {
      const limit = 24;
      const [vids, images] = await Promise.all([
        fetch(`${API}/search?q=${encodeURIComponent(q)}&top_k=${limit}`).then(async (r) =>
          r.ok ? r.json() : { results: [] },
        ),
        fetch(`${API}/images/semantic?q=${encodeURIComponent(q)}&top_k=${limit}`).then(async (r) =>
          r.ok ? r.json() : { results: [] },
        ),
      ]);
      setVideoHits(vids.results || []);
      setGallery(normalizeImages(images.results || images.images || []));
      setSearchLimit(limit);
      setSearchHasMore((vids.results || []).length === limit || (images.results || images.images || []).length === limit);
      setActiveSearchQ(q);
    } finally {
      setSearchBusy(false);
    }
  }

  const loadMoreSearch = useCallback(async () => {
    if (!activeSearchQ || searchBusy || !searchHasMore || searchLimit >= 200) return;
    const nextLimit = Math.min(200, searchLimit + 24);
    setSearchBusy(true);
    try {
      const q = encodeURIComponent(activeSearchQ);
      const [vids, images] = await Promise.all([
        fetch(`${API}/search?q=${q}&top_k=${nextLimit}`).then((r) => r.ok ? r.json() : { results: videoHits }),
        fetch(`${API}/images/semantic?q=${q}&top_k=${nextLimit}`).then((r) => r.ok ? r.json() : { results: gallery }),
      ]);
      const nextVideos = vids.results || [];
      const nextImages = normalizeImages(images.results || images.images || []);
      setVideoHits(nextVideos);
      setGallery(nextImages);
      setSearchLimit(nextLimit);
      setSearchHasMore(nextLimit < 200 && (nextVideos.length === nextLimit || nextImages.length === nextLimit));
    } finally {
      setSearchBusy(false);
    }
  }, [activeSearchQ, gallery, searchBusy, searchHasMore, searchLimit, videoHits]);

  useEffect(() => {
    const target = searchMoreRef.current;
    if (!target || !activeSearchQ || !searchHasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreSearch();
    }, { rootMargin: '500px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeSearchQ, loadMoreSearch, searchHasMore]);

  const loadMoreGallery = useCallback(async () => {
    if (activeSearchQ || galleryLoadingMore || (!galleryHasMore && !featuredHasMore)) return;
    setGalleryLoadingMore(true);
    try {
      const requests: Promise<void>[] = [];
      if (galleryHasMore && galleryCursor !== null) {
        const params = new URLSearchParams({
          skip_total: 'true', varied: 'true', per_page: '24', allow_nsfw: 'true',
          seed: String(gallerySeedRef.current), after: String(galleryCursor),
          wrapped: String(galleryWrapped),
        });
        requests.push(fetch(`${API}/images?${params}`).then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          const rows = normalizeImages(data.images || data.results || []);
          setGallery((current) => {
            const seen = new Set(current.map((item) => item.id));
            return [...current, ...rows.filter((item) => !seen.has(item.id))];
          });
          setGalleryCursor(typeof data.next_cursor === 'number' ? data.next_cursor : null);
          setGalleryWrapped(Boolean(data.cursor_wrapped));
          setGalleryHasMore(typeof data.next_cursor === 'number');
        }));
      }
      if (featuredHasMore) {
        requests.push(fetch(`${API}/videos/featured?limit=24&offset=${featuredVideos.length}`).then(async (res) => {
          if (!res.ok) return;
          const data = await res.json();
          const rows: VideoHit[] = (data.results || []).filter((item: VideoHit) => item.video_url);
          setFeaturedVideos((current) => {
            const seen = new Set(current.map((item) => item.job_id));
            return [...current, ...rows.filter((item) => !seen.has(item.job_id))];
          });
          setFeaturedHasMore(data.has_more ?? rows.length === 24);
        }));
      }
      await Promise.all(requests);
    } finally {
      setGalleryLoadingMore(false);
    }
  }, [activeSearchQ, featuredHasMore, featuredVideos.length, galleryCursor, galleryHasMore, galleryLoadingMore, galleryWrapped]);

  useEffect(() => {
    const target = galleryMoreRef.current;
    if (!target || activeSearchQ || (!galleryHasMore && !featuredHasMore)) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreGallery();
    }, { rootMargin: '800px 0px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [activeSearchQ, featuredHasMore, galleryHasMore, loadMoreGallery]);

  function openAuth(mode: AuthMode = 'signup') {
    setAuthMode(mode);
    setAuthError('');
    setCheckoutStep(false);
    setCheckoutClientSecret('');
    setCheckoutPublishableKey('');
    setAuthOpen(true);
  }

  const closeAuth = useCallback(() => {
    embeddedCheckoutRef.current?.destroy();
    embeddedCheckoutRef.current = null;
    setCheckoutClientSecret('');
    setCheckoutPublishableKey('');
    setCheckoutStep(false);
    setAuthOpen(false);
  }, []);

  useEffect(() => {
    if (!authOpen && !framesOpen && !settingsOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (authOpen) closeAuth();
      else if (framesOpen) setFramesOpen(false);
      else setSettingsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [authOpen, closeAuth, framesOpen, settingsOpen]);

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
      const data = await parseJSONResponse<{ url?: string; client_secret?: string; publishable_key?: string }>(res, 'Checkout failed');
      if (data.url && !data.client_secret) {
        window.location.href = data.url;
        return;
      }
      if (!data.client_secret || !data.publishable_key) throw new Error('checkout is unavailable');
      setCheckoutLabel(kind === 'credits' ? `$${amountUSD} credits` : checkoutPlanLabels[kind]);
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
      const pendingFiles = pendingAssetFilesRef.current;
      pendingAssetFilesRef.current = [];
      if (pendingFiles.length) window.setTimeout(() => void uploadAssets(pendingFiles), 0);
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

  function reorderFrames(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= imageFrames.length || toIndex >= imageFrames.length) return;
    setAssets((current) => {
      const frames = current.filter((asset) => asset.kind === 'image');
      const moved = frames[fromIndex];
      if (!moved) return current;
      const nextFrames = [...frames];
      nextFrames.splice(fromIndex, 1);
      nextFrames.splice(toIndex, 0, moved);
      return [...nextFrames, ...current.filter((asset) => asset.kind !== 'image')];
    });
  }

  function removeAsset(asset: PromptAsset) {
    setAssets((current) => current.filter((row) => row.url !== asset.url));
  }

  function handleAssetPaste(event: React.ClipboardEvent<HTMLElement>) {
    const clipboardImages = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const imageFiles = clipboardImages.length > 0
      ? clipboardImages
      : Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    event.preventDefault();
    void uploadAssets(imageFiles);
  }

  async function generate(overrides?: { prompt?: string; image?: string; audio?: string }) {
    if (!apiKey) {
      openAuth('signup');
      return;
    }
    const taskID = `home-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const taskMode = generationMode;
    const taskPrompt = (overrides?.prompt ?? prompt).trim();
    setGenerationTasks((current) => [{
      id: taskID,
      mode: taskMode,
      label: taskMode === 'images' ? 'Creating 4 images' : 'Starting video',
      status: 'starting' as const,
    }, ...current].slice(0, 12));
    setError('');
    try {
      if (taskMode === 'images') {
        const [width, height] = h3Dimensions(aspect, size);
        const imageRes = await fetch(`${API}/service`, {
          method: 'POST',
          headers: authHeaders(apiKey),
          body: JSON.stringify({
            service: 'zimage',
            prompt: taskPrompt,
            width,
            height,
            n: 4,
            num_images: 4,
            image_backend: 'auto',
          }),
        });
        await parseJSONResponse(imageRes, 'Image generation failed');
        await loadGallery();
        updateGenerationTask(taskID, { status: 'completed', label: '4 images ready' });
        window.setTimeout(() => setGenerationTasks((current) => current.filter((task) => task.id !== taskID)), 3500);
        await softRefresh(apiKey);
        return;
      }
      const steeringFrameURLs = overrides?.image
        ? [overrides.image]
        : imageFrames.map((asset) => asset.url);
      const renderedDuration = duration * Math.max(1, steeringFrameURLs.length - 1);
      let firstFrame = '';
      if (loopMode) {
        if (steeringFrameURLs.length > 0) {
          firstFrame = steeringFrameURLs[0];
          updateGenerationTask(taskID, { label: 'Starting loop video from frame 1' });
        } else {
          updateGenerationTask(taskID, { label: 'Making loop frame' });
          const [width, height] = h3Dimensions(aspect, size);
          const imageRes = await fetch(`${API}/service`, {
            method: 'POST',
            headers: authHeaders(apiKey),
            body: JSON.stringify({
              service: 'zimage',
              prompt: taskPrompt,
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
          updateGenerationTask(taskID, { label: 'Starting loop video' });
        }
      }
      if (musicVideoMode && !firstFrame) firstFrame = steeringFrameURLs[0] || '';
      if (musicVideoMode && !firstFrame) {
        updateGenerationTask(taskID, { label: 'Creating the opening frame' });
        const [width, height] = h3Dimensions(aspect, size);
        const imageRes = await fetch(`${API}/service`, {
          method: 'POST',
          headers: authHeaders(apiKey),
          body: JSON.stringify({ service: 'zimage', prompt: `${taskPrompt}. Cinematic opening frame for a music video.`, width, height, n: 1 }),
        });
        const imageData = await parseJSONResponse<Parameters<typeof loopAnchorURL>[0]>(imageRes, 'Music video opening frame generation failed');
        firstFrame = loopAnchorURL(imageData, window.location.origin);
        updateGenerationTask(taskID, { label: 'Composing the soundtrack' });
      }
      if (!firstFrame) firstFrame = steeringFrameURLs[0] || '';
      const lastFrame = !loopMode && !musicVideoMode && steeringFrameURLs.length > 1
        ? steeringFrameURLs[steeringFrameURLs.length - 1]
        : '';
      const orderedKeyframes = !loopMode && !musicVideoMode && steeringFrameURLs.length > 2
        ? steeringFrameURLs
        : undefined;
      const res = await fetch(`${API}/service`, {
        method: 'POST',
        headers: authHeaders(apiKey),
        body: JSON.stringify({
          service: 'h3_video',
          prompt: taskPrompt,
          aspect_ratio: aspect,
          size,
          duration,
          num_steps: steps,
          output_format: format,
          include_audio: includeAudio,
          music_video: musicVideoMode,
          music_duration: musicVideoMode ? 30 : undefined,
          loop: loopMode,
          ...(firstFrame ? { first_frame: firstFrame } : {}),
          ...(lastFrame ? { last_frame: lastFrame } : {}),
          ...(orderedKeyframes ? { keyframes: orderedKeyframes } : {}),
          structured_prompt: true,
          audio_url: musicVideoMode || steeringFrameURLs.length > 1 ? undefined : (overrides?.audio ?? audioAsset?.url),
        }),
      });
      const data = await parseJSONResponse<Record<string, unknown> & {
        result?: { job_id?: string };
        job_id?: string;
        id?: string;
      }>(res, 'Generation failed');
      const jobId = data.result?.job_id || data.job_id || data.id;
      if (!jobId) throw new Error('No job id returned');
      updateGenerationTask(taskID, { status: 'queued', label: 'Video queued' });
      const generated = await pollJob(jobId, (state) => {
        const resultURL = state.result_url || state.video_url || state.result?.video_url;
        updateGenerationTask(taskID, {
          status: state.status === 'queued' || state.status === 'pending' ? 'queued' : 'processing',
          label: musicVideoMode
            ? (state.result?.stage === 'music' ? 'Composing soundtrack' : 'Creating music video')
            : (state.status === 'queued' || state.status === 'pending' ? 'Video queued' : 'Creating video'),
          result_url: resultURL,
          cost_usd: state.charged_usd ?? state.cost_usd,
        });
      });
      let finalState = generated;
      if (upscaleMode) {
        const videoURL = generated.result_url || generated.video_url || generated.result?.video_url;
        if (!videoURL) throw new Error('completed without a video to upscale');
        const [width, height] = h3Dimensions(aspect, size);
        updateGenerationTask(taskID, { status: 'upscaling', label: `Upscaling ${upscaleScale}×` });
        const upscaleResponse = await fetch(`${API}/studio/upscale-video`, {
          method: 'POST', headers: authHeaders(apiKey),
          body: JSON.stringify({ video_url: videoURL, width, height, duration: renderedDuration, scale: upscaleScale }),
        });
        const upscale = await parseJSONResponse<{ job_id?: string }>(upscaleResponse, 'Could not start post-upscale');
        if (!upscale.job_id) throw new Error('Post-upscale returned no job');
        finalState = await pollJob(upscale.job_id, (state) => updateGenerationTask(taskID, {
          status: 'upscaling',
          label: `Upscaling ${upscaleScale}×`,
          cost_usd: state.charged_usd ?? state.cost_usd,
        }));
      }
      const finalURL = finalState.result_url || finalState.video_url || finalState.result?.video_url;
      const finalJob = {
        id: finalState.job_id || finalState.id || jobId,
        status: 'completed',
        result_url: finalURL,
        cost_usd: finalState.charged_usd ?? finalState.cost_usd,
      };
      setJob(finalJob);
      updateGenerationTask(taskID, { status: 'completed', label: 'Video ready', result_url: finalURL, cost_usd: finalJob.cost_usd });
      window.setTimeout(() => setGenerationTasks((current) => current.filter((task) => task.id !== taskID)), 3500);
      await softRefresh(apiKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed';
      updateGenerationTask(taskID, { status: 'failed', label: 'Generation failed', error: message });
      setError(message);
    }
  }

  function selectGalleryImage(img: GalleryImage) {
    const src = img.image_url || img.thumb_url;
    if (!src) return;
    setPrompt(img.prompt);
    setAssets((current) => current.some((asset) => asset.url === src)
      ? current
      : [...current, { kind: 'image', url: src, name: img.prompt.slice(0, 48) || 'Gallery image' }]);
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
      pendingAssetFilesRef.current = [...pendingAssetFilesRef.current, ...accepted];
      setError('Sign in to add pasted frames. Your images are ready when you return.');
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
        const images = uploaded.filter((asset) => asset.kind === 'image');
        const audio = uploaded.find((asset) => asset.kind === 'audio');
        const existingURLs = new Set(current.map((asset) => asset.url));
        const nextImages = images.filter((asset) => !existingURLs.has(asset.url));
        return [
          ...current.filter((asset) => asset.kind === 'image'),
          ...nextImages,
          ...(audio ? [audio] : []),
          ...current.filter((asset) => asset.kind === 'audio' && !audio),
        ];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Asset upload failed');
    } finally {
      setAssetBusy(false);
    }
  }

  async function pollJob(jobId: string, onUpdate?: (state: VideoJobState) => void): Promise<VideoJobState> {
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
      onUpdate?.({ ...state, result_url: url });
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

  // Keep the landing experience deterministic. Showcase data is loaded lazily
  // and may change order; it should not replace the homepage hero underneath a
  // visitor. User-selected and newly generated videos still take precedence.
  const resultUrl = job?.result_url || HOMEPAGE_HERO_VIDEO_URL;
  const activeGenerationTasks = generationTasks.filter((task) => !['completed', 'failed'].includes(task.status));
  // A local, cacheable poster protects LCP from slow API/gallery responses.
  const heroImage = '/brand/manifoldgen-og.webp';
  const musicVideos = featuredVideos.filter((video) => video.music_video || video.service === 'music_video');
  const galleryFeed = useMemo<GalleryFeedItem[]>(() => {
    const videos = featuredVideos.filter((video) => !video.music_video && video.service !== 'music_video');
    const rows: GalleryFeedItem[] = [];
    const length = Math.max(gallery.length, videos.length);
    for (let index = 0; index < length; index += 1) {
      const image = gallery[index];
      if (image) rows.push({ kind: 'image', id: image.id, prompt: image.prompt, image, src: image.image_url || image.thumb_url });
      const video = videos[index];
      if (video?.video_url) rows.push({ kind: 'video', id: video.job_id, prompt: video.prompt, video });
    }
    return rows;
  }, [featuredVideos, gallery]);
  const imageFrames = useMemo(() => assets.filter((asset) => asset.kind === 'image'), [assets]);
  const audioAsset = useMemo(() => assets.find((asset) => asset.kind === 'audio'), [assets]);
  const transitionCount = Math.max(1, imageFrames.length - 1);
  const visualAnchorUSD = (loopMode || musicVideoMode) && imageFrames.length === 0 ? imageCredits * creditPrice : 0;
  const musicVideoUSD = musicVideoMode ? 0.80 : 0;
  const estimatedSequenceUSD = (estVideoUSD + estUpscaleUSD + musicVideoUSD) * transitionCount + visualAnchorUSD;

  useEffect(() => {
    if (imageFrames.length > 1 && loopMode) setLoopMode(false);
  }, [imageFrames.length, loopMode]);
  const mixedSearchHits = useMemo(() => {
    const rows: Array<
      | { kind: 'video'; id: string; prompt: string; video: VideoHit }
      | { kind: 'image'; id: string; prompt: string; image: GalleryImage; src?: string }
    > = [];
    const length = Math.max(videoHits.length, gallery.length);
    for (let index = 0; index < length; index += 1) {
      const video = videoHits[index];
      if (video?.video_url) rows.push({ kind: 'video', id: video.job_id, prompt: video.prompt, video });
      const image = gallery[index];
      if (image) rows.push({ kind: 'image', id: image.id, prompt: image.prompt, image, src: image.image_url || image.thumb_url });
    }
    return rows;
  }, [gallery, videoHits]);

  return (
    <main className="relative min-h-screen bg-[var(--color-ink)]">
      {/* Full-bleed hero */}
      <section className="relative h-[100dvh] w-full overflow-hidden">
        {resultUrl ? (
          <video
            ref={heroVideoRef}
            data-testid="home-hero-video"
            key={resultUrl}
            className="hero-motion absolute inset-0 h-full w-full object-cover"
            src={resultUrl}
            poster={heroImage}
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
            className="hero-motion absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="hero-motion absolute inset-0 h-full w-full bg-[radial-gradient(ellipse_at_20%_20%,#2a1f66_0%,transparent_45%),radial-gradient(ellipse_at_80%_10%,#123a45_0%,transparent_40%),linear-gradient(160deg,#07070a,#12101c_55%,#0a0a10)]" />
        )}

        <header className="relative z-20 flex items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                width={54}
                height={36}
                className="h-8 w-auto scale-[1.7] object-contain brightness-125 drop-shadow md:h-9"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <Clapperboard className="text-[var(--color-accent-2)]" size={22} />
            )}
            <p className="font-display text-base font-700 tracking-tight sm:text-xl md:text-2xl">
              ManifoldGen
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/voice" className="glass hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white md:flex">
              <Mic2 size={14} />
              Voice
            </a>
            <Link href="/tools" className="glass hidden rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white md:block">
              Tools
            </Link>
            <Link href="/tools/h3-image" className="glass hidden rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white lg:block">
              H3 Images
            </Link>
            <Link href="/tool/anima" className="glass hidden rounded-full px-3 py-2 text-sm text-[var(--color-mute)] hover:text-white xl:block">
              Anima Art
            </Link>
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
            <div className="mb-4 max-w-3xl drop-shadow-[0_3px_18px_rgba(0,0,0,.7)]">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[var(--color-accent-2)]">AI video creator</p>
              <h1 className="mt-2 font-display text-2xl font-700 tracking-tight text-white sm:text-3xl md:text-4xl">Create AI video from text, images, and reference media.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75 md:text-base">ManifoldGen is an AI video generator and editor for cinematic text-to-video, image-to-video, motion, audio, and finishing.</p>
            </div>
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
              onPaste={handleAssetPaste}
            >
              {imageFrames.length > 0 ? (
                <div className="mb-3 rounded-2xl border border-white/10 bg-black/20 p-2.5" data-testid="home-frame-tray">
                  <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/75">
                        <span>Steering frames</span>
                        <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] tracking-normal text-white/50">{imageFrames.length}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">{imageFrames.length > 1 ? `${transitionCount} locked transition${transitionCount === 1 ? '' : 's'} · ${duration}s each` : 'Frame 1 anchors the shot'}</p>
                    </div>
                    <button type="button" onClick={() => setFramesOpen(true)} className="shrink-0 rounded-full px-2.5 py-1.5 text-[11px] font-medium text-white/55 transition hover:bg-white/10 hover:text-white">
                      Manage frames
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imageFrames.map((asset, index) => (
                      <div
                        key={`frame-${asset.url}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', String(index));
                        }}
                        onDragOver={(event) => { event.preventDefault(); setFrameDropIndex(index); }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                          if (Number.isInteger(fromIndex)) reorderFrames(fromIndex, index);
                          setFrameDropIndex(null);
                        }}
                        onDragEnd={() => setFrameDropIndex(null)}
                        className={`group relative w-24 shrink-0 overflow-hidden rounded-xl border bg-black/40 p-1 transition sm:w-28 ${frameDropIndex === index ? 'border-[var(--color-accent-2)] ring-1 ring-[var(--color-accent-2)]/50' : 'border-white/10 hover:border-white/25'}`}
                      >
                        <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={asset.url} alt={`Steering frame ${index + 1}`} className="h-full w-full object-cover" />
                          <span className="absolute left-1.5 top-1.5 rounded-md bg-black/75 px-1.5 py-1 text-[10px] font-bold text-white">{index + 1}</span>
                          <button type="button" onClick={() => removeAsset(asset)} aria-label={`Remove frame ${index + 1}`} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white/70 opacity-100 transition hover:text-white sm:opacity-0 sm:group-hover:opacity-100"><X size={12} /></button>
                        </div>
                        <div className="flex items-center justify-between gap-1 px-0.5 pt-1 text-[10px] text-white/45">
                          <GripVertical size={12} className="shrink-0" />
                          <span className="truncate">{index === 0 ? 'First frame' : index === imageFrames.length - 1 ? 'Last frame' : `Frame ${index + 1}`}</span>
                          <div className="flex shrink-0">
                            <button type="button" disabled={index === 0} onClick={() => reorderFrames(index, index - 1)} aria-label={`Move frame ${index + 1} left`} className="rounded p-0.5 hover:bg-white/10 disabled:opacity-20"><ChevronLeft size={12} /></button>
                            <button type="button" disabled={index === imageFrames.length - 1} onClick={() => reorderFrames(index, index + 1)} aria-label={`Move frame ${index + 1} right`} className="rounded p-0.5 hover:bg-white/10 disabled:opacity-20"><ChevronRight size={12} /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => assetInputRef.current?.click()} className="flex min-h-24 w-24 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 bg-white/[.03] text-[11px] text-white/45 transition hover:border-white/35 hover:bg-white/[.06] hover:text-white sm:w-28">
                      <ClipboardPaste size={16} />
                      Add frame
                    </button>
                  </div>
                </div>
              ) : null}
              {audioAsset ? (
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-black/35 p-1.5 pr-2 text-xs">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Music2 size={16} /></span>
                  <span className="min-w-0 flex-1 truncate text-white/70">{audioAsset.name}</span>
                  <button type="button" onClick={() => removeAsset(audioAsset)} aria-label={`Remove ${audioAsset.name}`} className="rounded-full p-1 text-white/45 hover:text-white"><X size={13} /></button>
                </div>
              ) : null}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Describe the shot, camera, light, motion… Paste an image to set frame 1"
                className="w-full resize-none bg-transparent px-2 py-1 text-base outline-none placeholder:text-white/35 md:text-lg"
              />
              {imageFrames.length === 0 ? (
                <div className="flex items-center gap-2 px-2 pb-1 text-[11px] text-white/35">
                  <ClipboardPaste size={13} className="text-[var(--color-accent-2)]/80" />
                  Paste an image here to use it as the first video frame
                </div>
              ) : null}
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
                <div className="flex items-center rounded-full bg-white/5 p-0.5" role="group" aria-label="Generation type" data-testid="home-generation-mode">
                  <button
                    type="button"
                    aria-pressed={generationMode === 'video'}
                    onClick={() => setGenerationMode('video')}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${generationMode === 'video' ? 'bg-white/15 text-white' : 'text-[var(--color-mute)] hover:text-white'}`}
                  >Video</button>
                  <button
                    type="button"
                    aria-pressed={generationMode === 'images'}
                    onClick={() => setGenerationMode('images')}
                    className={`rounded-full px-3 py-1.5 text-sm transition ${generationMode === 'images' ? 'bg-white/15 text-white' : 'text-[var(--color-mute)] hover:text-white'}`}
                  >4 images</button>
                </div>
                <button
                  type="button"
                  data-testid="home-loop-toggle"
                  aria-pressed={loopMode}
                  disabled={generationMode === 'images' || imageFrames.length > 1 || musicVideoMode}
                  onClick={() => setLoopMode((enabled) => !enabled)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                    loopMode
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-white/5 text-[var(--color-mute)] hover:text-white'
                  }`}
                  title={imageFrames.length > 1 ? 'Loops use one matching start/end frame' : 'Generate a looping video'}
                >
                  <Repeat2 size={14} />
                  Loop
                </button>
                <button
                  type="button"
                  data-testid="home-music-video-toggle"
                  aria-pressed={musicVideoMode}
                  disabled={generationMode === 'images'}
                  onClick={() => setMusicVideoMode((enabled) => {
                    const next = !enabled;
                    if (next) {
                      setLoopMode(false);
                      setIncludeAudio(true);
                      setDuration(15);
                    }
                    return next;
                  })}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                    musicVideoMode
                      ? 'bg-fuchsia-600 text-white'
                      : 'bg-white/5 text-[var(--color-mute)] hover:text-white'
                  }`}
                  title="Compose a MiniMax soundtrack first, then use it to drive H3"
                >
                  <Music2 size={14} />
                  Music video
                </button>
                <button
                  type="button"
                  data-testid="home-upscale-toggle"
                  aria-pressed={upscaleMode}
                  disabled={generationMode === 'images'}
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
                {generationMode === 'video' ? (
                  <span data-testid="home-video-cost">
                    <button
                      type="button"
                      data-testid="home-duration-control"
                      onClick={() => setSettingsOpen(true)}
                      className="group inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-sm text-[var(--color-mute)] transition hover:bg-white/10 hover:text-white"
                      aria-label={`Video duration ${duration} seconds per transition. Change duration`}
                    >
                      <Clock3 size={14} className="text-white/50 transition group-hover:text-[var(--color-accent-2)]" />
                      <span>{imageFrames.length > 2 ? `${duration}s × ${transitionCount}` : `${duration}s`}</span>
                      <span className="hidden text-white/35 sm:inline">· ~${estimatedSequenceUSD.toFixed(2)}</span>
                    </button>
                  </span>
                ) : null}
                <span className="hidden rounded-full bg-white/5 px-3 py-1.5 text-sm text-[var(--color-mute)] md:inline" data-testid="home-image-cost">
                  4 images · ${(imageCredits * 4 * creditPrice).toFixed(2)}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <input ref={assetInputRef} type="file" accept="image/*,audio/*" multiple className="hidden" onChange={(e) => { if (e.target.files) void uploadAssets(e.target.files); e.currentTarget.value = ''; }} />
                  <button type="button" data-testid="home-add-asset" disabled={assetBusy} onClick={() => assetInputRef.current?.click()} className="glass inline-flex items-center gap-2 rounded-full px-3 py-2.5 text-sm text-white/75 disabled:opacity-50" aria-label="Add image or audio">
                    {assetBusy ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
                    <span className="hidden sm:inline">{imageFrames.length > 0 ? 'Add frame' : 'Add asset'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!prompt.trim()}
                    onClick={() => void generate()}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    {user ? (generationMode === 'images' ? 'Generate 4 images' : musicVideoMode ? 'Generate music video' : imageFrames.length > 2 ? `Generate ${transitionCount} transitions` : 'Generate video') : 'Sign up to generate'}
                  </button>
                </div>
              </div>
            </div>
            {error && (
              <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>
            )}
            {activeGenerationTasks.length > 0 && <div className="mt-3 flex justify-end" data-testid="home-background-activity">
              <ManifoldLoader compact label={activeGenerationTasks.length === 1 ? activeGenerationTasks[0].label : `${activeGenerationTasks.length} tasks running`} />
            </div>}
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

      {musicVideos.length > 0 && <section className="relative z-10 border-t border-fuchsia-300/10 bg-[linear-gradient(180deg,#100817,#050508)] py-6" data-testid="home-music-videos">
        <div className="flex items-end justify-between px-3 pb-4 md:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-fuchsia-300">MiniMax score → H3 reference video</p>
            <h2 className="mt-1 font-display text-xl tracking-wide text-white md:text-2xl">Music videos</h2>
          </div>
          <Link href="/studio" className="rounded-full border border-fuchsia-200/20 bg-fuchsia-300/10 px-4 py-2 text-xs font-semibold text-fuchsia-100 transition hover:bg-fuchsia-300/20">Create one in Studio</Link>
        </div>
        <div className="reel-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 md:px-6">
          {musicVideos.map((hit, index) => <button key={hit.job_id} type="button" onClick={() => playVideo(hit)} className="group relative aspect-video h-[48vw] max-h-[420px] min-h-[220px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left sm:h-[32vw] lg:h-[24vw]" aria-label="Play music video">
            {hit.video_url && <video src={hit.video_url} muted loop playsInline preload={index < 2 ? 'metadata' : 'none'} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)} onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }} />}
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md"><Music2 size={13} /> Music video</span>
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4 pt-14 text-sm leading-snug text-white md:text-base">{hit.prompt}</span>
          </button>)}
        </div>
      </section>}

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
          {activeSearchQ ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setSearchQ('');
                setActiveSearchQ('');
                setVideoHits([]);
                setSearchLimit(24);
                setSearchHasMore(false);
                void loadGallery();
              }}
              className="glass rounded-full p-3 text-white/55 transition hover:text-white"
            >
              <X size={16} />
            </button>
          ) : null}
        </form>

        {activeSearchQ ? (
          <div className="px-3 pb-6 md:px-6" data-testid="home-search-results">
            <div className="flex items-end justify-between border-b border-white/10 pb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent-2)]">Mixed media search</p>
                <h2 className="mt-1 font-display text-xl tracking-wide text-white">Results for “{activeSearchQ}”</h2>
              </div>
              <span className="text-xs text-white/40">{mixedSearchHits.length} images + videos</span>
            </div>
            {mixedSearchHits.length === 0 ? (
              <p className="py-10 text-sm text-[var(--color-mute)]">No matching images or videos yet. Try a broader visual description.</p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {mixedSearchHits.map((hit, index) => (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    type="button"
                    data-testid={`home-search-${hit.kind}-${hit.id}`}
                    onClick={() => hit.kind === 'video' ? playVideo(hit.video) : selectGalleryImage(hit.image)}
                    className="group relative aspect-video overflow-hidden rounded-xl bg-white/5 text-left"
                  >
                    {hit.kind === 'video' ? (
                      <video
                        src={hit.video.video_url}
                        muted
                        loop
                        playsInline
                        preload={index < 4 ? 'metadata' : 'none'}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                        onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
                        onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }}
                      />
                    ) : hit.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={hit.src} alt={hit.prompt} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : null}
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur">
                      {hit.kind === 'video' ? 'Video' : 'Image'}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black via-black/70 to-transparent px-3 pb-2 pt-8 text-xs leading-snug text-white/90">
                      {hit.prompt}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div ref={searchMoreRef} className="flex min-h-20 items-center justify-center py-4">
              {searchHasMore ? (
                <button type="button" onClick={() => void loadMoreSearch()} disabled={searchBusy} className="glass rounded-full px-5 py-2 text-sm text-white/70 disabled:opacity-50">
                  {searchBusy ? <Loader2 className="animate-spin" size={16} /> : 'Load more results'}
                </button>
              ) : mixedSearchHits.length > 0 ? <span className="text-xs text-white/35">All matching media loaded</span> : null}
            </div>
          </div>
        ) : null}
      </section>

      {/* Full-bleed gallery */}
      {!activeSearchQ && <section className="relative z-10 w-full" data-testid="still-gallery">
        <div className="flex items-end justify-between px-3 py-4 md:px-6">
          <div>
            <h2 className="font-display text-lg tracking-wide text-white md:text-xl">Gallery</h2>
            <p className="text-sm text-[var(--color-mute)]">Images + videos</p>
          </div>
          {galleryFeed.length > 0 ? (
            <span className="text-xs text-white/40">{galleryFeed.length}</span>
          ) : null}
        </div>
        {galleryFeed.length === 0 ? (
          <p className="px-4 pb-12 text-sm text-[var(--color-mute)]">Gallery warming up…</p>
        ) : (
          <div className="gallery-bleed columns-2 bg-black sm:columns-3 md:columns-4 xl:columns-5 2xl:columns-6">
            {galleryFeed.map((item) => {
              if (item.kind === 'video') return (
                <div key={`video-${item.id}`} data-testid={`gallery-video-${item.id}`} className="group relative mb-px aspect-video break-inside-avoid overflow-hidden bg-[#0c0c12]">
                  <button type="button" aria-label="Play gallery video" onClick={() => playVideo(item.video)} className="absolute inset-0 h-full w-full text-left">
                    <video src={item.video.video_url} muted loop playsInline preload="metadata" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)} onMouseLeave={(event) => { event.currentTarget.pause(); event.currentTarget.currentTime = 0; }} />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden p-3 text-xs leading-snug text-white/90 opacity-0 transition group-hover:opacity-100 sm:line-clamp-2 md:text-sm">{item.prompt}</div>
                    <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 backdrop-blur">Video</span>
                  </button>
                  <button type="button" onClick={() => { window.location.href = `/studio?video_url=${encodeURIComponent(item.video.video_url!)}&name=${encodeURIComponent(item.prompt || 'Gallery video')}&restyle=1`; }} className="absolute bottom-3 right-3 z-10 hidden items-center gap-1 rounded-full bg-black/70 px-3 py-2 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100 sm:inline-flex"><WandSparkles size={13} />Transform</button>
                </div>
              );
              const img = item.image;
              const src = item.src;
              return (
                <div
                  key={img.id}
                  className="group relative mb-px break-inside-avoid overflow-hidden bg-[#0c0c12]"
                >
                  <button type="button" onClick={() => selectGalleryImage(img)} className="absolute inset-0 h-full w-full" title={img.prompt}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={img.prompt}
                      className="block h-auto w-full transition duration-700 group-hover:scale-105"
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
                      <button type="button" onClick={() => { selectGalleryImage(img); void generate({ prompt: img.prompt, image: src }); }} className="col-span-2 inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white shadow-lg"><Sparkles size={14} />Generate video</button>
                      <button type="button" onClick={() => openGalleryImageInStudio(img)} className="inline-flex items-center justify-center gap-1 rounded-full bg-black/70 px-2 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black"><Clapperboard size={13} />Studio</button>
                      <button type="button" disabled={backgroundRemovingID === img.id} onClick={() => void removeGalleryBackground(img)} className="inline-flex items-center justify-center gap-1 rounded-full bg-black/70 px-2 py-2 text-xs font-medium text-white backdrop-blur hover:bg-black disabled:opacity-60">{backgroundRemovingID === img.id ? <Loader2 className="animate-spin" size={13} /> : <WandSparkles size={13} />}Remove BG</button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <div ref={galleryMoreRef} className="flex min-h-24 items-center justify-center py-5">
          {galleryLoadingMore ? <Loader2 className="animate-spin text-white/45" size={20} /> : galleryHasMore || featuredHasMore ? (
            <button type="button" onClick={() => void loadMoreGallery()} className="glass rounded-full px-5 py-2 text-sm text-white/70">Load more media</button>
          ) : galleryFeed.length > 0 ? <span className="text-xs text-white/35">All gallery media loaded</span> : null}
        </div>
      </section>}

      {settingsOpen && (
        <div data-testid="homepage-settings-backdrop" className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm md:items-center" onMouseDown={(event) => event.target === event.currentTarget && setSettingsOpen(false)}>
          <div className="glass w-full max-w-md rounded-3xl border border-white/10 p-5 shadow-2xl shadow-black/40" role="dialog" aria-modal="true" aria-label="Video settings">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 font-display text-xl font-700">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent-2)]"><Clock3 size={17} /></span>
                  Video settings
                </div>
                <p className="mt-1 text-sm text-[var(--color-mute)]">Choose how much of the moment to create.</p>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="mb-5 rounded-2xl bg-black/20 p-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">Duration</div>
                  <p className="mt-1 text-sm text-white/55">Longer generations continue the shot across chained segments.</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-3xl font-700 text-white">{duration}<span className="ml-1 text-base font-normal text-white/45">sec</span></div>
                  <div className="text-xs text-white/40">~${estimatedSequenceUSD.toFixed(2)}</div>
                </div>
              </div>
              <input
                aria-label="Video duration in seconds"
                type="range"
                min={4}
                max={60}
                step={1}
                value={duration}
                disabled={musicVideoMode}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mt-5 w-full accent-[var(--color-accent)]"
              />
              <div className="mt-1 flex justify-between text-[11px] text-white/30"><span>4 sec</span><span>60 sec</span></div>
              <div className="mt-4 grid grid-cols-5 gap-1.5">
                {[5, 10, 15, 30, 60].map((seconds) => (
                  <button
                    key={seconds}
                    type="button"
                    disabled={musicVideoMode}
                    onClick={() => setDuration(seconds)}
                    aria-pressed={duration === seconds}
                    className={`rounded-xl px-2 py-2 text-xs font-medium transition ${duration === seconds ? 'bg-[var(--color-accent)] text-white' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'}`}
                  >{seconds}s</button>
                ))}
              </div>
              {musicVideoMode ? <p className="mt-3 text-xs text-fuchsia-300">Music videos use H3’s fixed 15-second reference-audio window.</p> : null}
              {duration > 15 ? <p className="mt-3 text-xs text-[var(--color-accent-2)]">Multi-segment generation enabled for this length.</p> : null}
            </div>
            <label className="mb-3 block text-sm text-[var(--color-mute)]">
              Quality steps (8–30)
              <input
                type="range" min={8} max={30} value={steps}
                onChange={(e) => setSteps(Number(e.target.value))} className="mt-2 w-full accent-[var(--color-accent)]"
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
              Audio
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="settings-loop-toggle"
                checked={loopMode}
                onChange={(e) => setLoopMode(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Seamless loop
                <span className="mt-0.5 block text-xs text-[var(--color-mute)]">Looping video</span>
              </span>
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                data-testid="settings-upscale-toggle"
                checked={upscaleMode}
                onChange={(e) => setUpscaleMode(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Real-ESRGAN post-upscale
                <span className="mt-1 flex items-center gap-2 text-xs text-[var(--color-mute)]">
                  Restore after render
                  <select value={upscaleScale} disabled={!upscaleMode} onChange={(e) => setUpscaleScale(Number(e.target.value) as 2 | 4)} className="dark-select rounded-md px-2 py-1">
                    <option value={2}>2×</option>
                    <option value={4}>4×</option>
                  </select>
                </span>
              </span>
            </label>
            <p className="mt-4 text-xs text-[var(--color-mute)]">Final video cost follows render time. Images are $0.04 each.</p>
          </div>
        </div>
      )}

      {framesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6"
          onPaste={handleAssetPaste}
          onMouseDown={(event) => event.target === event.currentTarget && setFramesOpen(false)}
        >
          <div
            className="auth-panel flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#0b0b12] md:rounded-[2rem]"
            role="dialog"
            aria-modal="true"
            aria-label="Steering frames"
            tabIndex={-1}
            autoFocus
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-6">
              <div>
                <div className="flex items-center gap-2 font-display text-xl font-700">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--color-accent)]/20 text-[var(--color-accent-2)]"><Clapperboard size={17} /></span>
                  Steering frames
                </div>
                <p className="mt-1 max-w-lg text-sm leading-5 text-white/45">Paste, drop, or add images. Drag to reorder the sequence before you generate.</p>
              </div>
              <button type="button" onClick={() => setFramesOpen(false)} aria-label="Close frame manager" className="rounded-full p-2 text-white/55 transition hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
            <div
              className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void uploadAssets(event.dataTransfer.files);
              }}
            >
              <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-accent-2)]/20 bg-[var(--color-accent-2)]/[.06] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <ClipboardPaste size={18} className="shrink-0 text-[var(--color-accent-2)]" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/85">Paste an image to add a frame</div>
                    <div className="mt-0.5 text-xs text-white/45">With this window open, paste a screenshot directly from your clipboard.</div>
                  </div>
                </div>
                <button type="button" onClick={() => assetInputRef.current?.click()} className="shrink-0 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/15">Browse</button>
              </div>
              {imageFrames.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {imageFrames.map((asset, index) => (
                    <div
                      key={`modal-frame-${asset.url}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', String(index));
                      }}
                      onDragOver={(event) => { event.preventDefault(); setFrameDropIndex(index); }}
                      onDrop={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                        if (Number.isInteger(fromIndex)) reorderFrames(fromIndex, index);
                        setFrameDropIndex(null);
                      }}
                      onDragEnd={() => setFrameDropIndex(null)}
                      className={`group overflow-hidden rounded-2xl border bg-black/30 p-1.5 transition ${frameDropIndex === index ? 'border-[var(--color-accent-2)] ring-1 ring-[var(--color-accent-2)]/50' : 'border-white/10 hover:border-white/25'}`}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-white/5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={asset.url} alt={`Steering frame ${index + 1}`} className="h-full w-full object-cover" />
                        <div className="absolute inset-x-2 top-2 flex items-center justify-between">
                          <span className="rounded-md bg-black/75 px-2 py-1 text-[11px] font-bold text-white">Frame {index + 1}</span>
                          <button type="button" onClick={() => removeAsset(asset)} aria-label={`Remove frame ${index + 1}`} className="rounded-full bg-black/70 p-1.5 text-white/70 transition hover:text-white"><X size={13} /></button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-1 pt-2 text-xs text-white/45">
                        <span className="flex min-w-0 items-center gap-1.5 truncate"><GripVertical size={14} />{index === 0 ? 'First frame' : index === imageFrames.length - 1 ? 'Last frame' : 'In sequence'}</span>
                        <div className="flex shrink-0">
                          <button type="button" disabled={index === 0} onClick={() => reorderFrames(index, index - 1)} aria-label={`Move frame ${index + 1} earlier`} className="rounded-md p-1 hover:bg-white/10 disabled:opacity-20"><ChevronLeft size={14} /></button>
                          <button type="button" disabled={index === imageFrames.length - 1} onClick={() => reorderFrames(index, index + 1)} aria-label={`Move frame ${index + 1} later`} className="rounded-md p-1 hover:bg-white/10 disabled:opacity-20"><ChevronRight size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={() => assetInputRef.current?.click()} className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[.02] text-sm text-white/45 transition hover:border-white/30 hover:bg-white/[.05] hover:text-white">
                    <Paperclip size={19} />
                    Add another frame
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => assetInputRef.current?.click()} className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[.02] text-center text-sm text-white/50 transition hover:border-white/30 hover:bg-white/[.05] hover:text-white">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10"><ImageIcon size={22} /></span>
                  <span><b className="block text-white/80">Drop your first frame here</b><small className="mt-1 block text-white/40">or paste an image into the prompt</small></span>
                </button>
              )}
            </div>
            <div className="flex flex-col gap-3 border-t border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <p className="text-xs leading-5 text-white/40">Every adjacent pair becomes a {duration}s transition. Each segment stops on its next frame; the final segment ends on frame {imageFrames.length}.</p>
              <button type="button" onClick={() => setFramesOpen(false)} className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110">Done</button>
            </div>
          </div>
        </div>
      )}

      {authOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/75 p-0 backdrop-blur-sm md:items-center md:p-6" onMouseDown={(event) => event.target === event.currentTarget && closeAuth()}>
          <div className="auth-panel relative flex h-full w-full max-w-lg flex-col overflow-hidden bg-[#0b0b12] md:h-auto md:max-h-[90dvh] md:rounded-[2rem] md:border md:border-white/10" role="dialog" aria-modal="true" aria-label={checkoutStep ? 'Checkout' : authMode === 'signup' ? 'Create your account' : 'Sign in'}>
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
                {!checkoutStep && (
                  <p className="mt-1 text-sm text-white/70">
                    {authMode === 'signup'
                      ? 'Create your account.'
                      : 'Welcome back. Pick up where you left off.'}
                  </p>
                )}
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
                        onClick={() => void startCheckout('creator_monthly')}
                        className="rounded-2xl border border-[var(--color-accent)] bg-[var(--color-accent)]/15 p-4 text-left transition hover:bg-[var(--color-accent)]/25 disabled:opacity-50"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">Creator · $14.99/month</span>
                          <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 text-xs font-semibold">Recommended</span>
                        </div>
                        <div className="mt-1 text-sm text-white/60">Unlimited images + $25 video credits/month</div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startCheckout('creator_annual')}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:opacity-50"
                      >
                        <div className="font-semibold">Creator · $149/year</div>
                        <div className="mt-1 text-sm text-white/60">Two months free + $300 video credits/year</div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startCheckout('pro_monthly')}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:opacity-50"
                      >
                        <div className="font-semibold">Pro · $49/month</div>
                        <div className="mt-1 text-sm text-white/60">Unlimited images and a higher-volume creator workspace</div>
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void startCheckout('pro_annual')}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:opacity-50"
                      >
                        <div className="font-semibold">Pro · $490/year</div>
                        <div className="mt-1 text-sm text-white/60">Two months free on a year of Pro</div>
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
