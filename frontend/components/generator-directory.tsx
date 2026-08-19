'use client';

import Link from 'next/link';
import { ArrowRight, Clapperboard, Code2, Image as ImageIcon, Layers3, MousePointer2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { loadStoredUser, refreshUser, type StoredUser } from '@/lib/auth';
import { CREDITS_UPDATED_EVENT } from '@/lib/payments';
import { VIDEO_GENERATORS } from '@/lib/video-generators';

export function GeneratorHeader({ section }: { section: 'Tools' | 'API' }) {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    const stored = loadStoredUser();
    if (stored) {
      setUser(stored);
      refreshUser(stored.api_key).then((next) => next && setUser(next));
    }

    const updateCredits = () => {
      const next = loadStoredUser();
      if (next) setUser(next);
    };
    window.addEventListener(CREDITS_UPDATED_EVENT, updateCredits);
    return () => window.removeEventListener(CREDITS_UPDATED_EVENT, updateCredits);
  }, []);

  const creditsLabel = useMemo(() => {
    if (!user) return 'Account';
    const usd = user.credits_usd ?? user.credits * (user.credit_price_usd ?? 0.01);
    return `${Math.round(user.credits).toLocaleString()} cr · $${usd.toFixed(2)}`;
  }, [user]);

  return (
    <header className="sticky top-0 z-30 border-b border-white/15 bg-[#10131a]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-700"><img src="/brand/logo-nobg.webp" alt="" className="h-7 w-auto scale-[1.7] brightness-125" /> ManifoldGen</Link>
        <nav className="flex items-center gap-1 text-sm text-white/70">
          <Link href="/tools" className={`rounded-full px-3 py-2 hover:text-white ${section === 'Tools' ? 'bg-white/10 text-white' : ''}`}>Tools</Link>
          <Link href="/api/video-generators" className={`hidden rounded-full px-3 py-2 hover:text-white sm:block ${section === 'API' ? 'bg-white/10 text-white' : ''}`}>API</Link>
          <Link href="/studio" className="hidden rounded-full px-3 py-2 hover:text-white md:block">Studio</Link>
          <Link href="/account" className="ml-1 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-black" data-testid="generator-header-credits">
            {user ? <span className="text-xs">{creditsLabel}</span> : creditsLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function GeneratorCards({ destination = 'tools' }: { destination?: 'tools' | 'api' }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {destination === 'tools' && <Link href="/tool/image-editor" className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.045] p-6 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]">
        <div className="absolute inset-x-0 top-0 h-px opacity-80" style={{ background: 'linear-gradient(90deg, transparent, #75d5d0, transparent)' }} />
        <div className="flex items-start justify-between"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] text-[#75d5d0]"><MousePointer2 size={20} /></span><ArrowRight size={17} className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white/80" /></div>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">SAM2 · BIREFNET · INPAINTING</div>
        <h2 className="mt-2 font-display text-xl font-700">AI Image Editor</h2>
        <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/65">Split an image into layers, select an object precisely, and regenerate only that selected area.</p>
        <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-white/50"><span>from 1 Manifold credit</span><span>Open tool</span></div>
      </Link>}
      {destination === 'tools' && <Link href="/tool/animate-video" className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.045] p-6 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]">
        <div className="absolute inset-x-0 top-0 h-px opacity-80" style={{ background: 'linear-gradient(90deg, transparent, #9c8cff, transparent)' }} />
        <div className="flex items-start justify-between"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07] text-[#9c8cff]"><Layers3 size={20} /></span><ArrowRight size={17} className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white/80" /></div>
        <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">WAN · ANIMATION TRANSFER</div>
        <h2 className="mt-2 font-display text-xl font-700">Animation Transfer</h2>
        <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/65">Drive a reference character with the body motion, expression, timing, and optional audio from a video.</p>
        <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-white/50"><span>from 60 Manifold credits</span><span>Open tool</span></div>
      </Link>}
      {VIDEO_GENERATORS.map((generator) => {
        const Icon = generator.mode === 'image' ? ImageIcon : generator.mode === 'reference' ? Layers3 : Clapperboard;
        const href = destination === 'tools' ? `/tools/${generator.slug}` : `/api/video-generators/${generator.slug}`;
        return (
          <Link key={generator.slug} href={href} className="group relative overflow-hidden rounded-3xl border border-white/15 bg-white/[0.045] p-6 transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/[0.07]">
            <div className="absolute inset-x-0 top-0 h-px opacity-80" style={{ background: `linear-gradient(90deg, transparent, ${generator.accent}, transparent)` }} />
            <div className="flex items-start justify-between">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07]" style={{ color: generator.accent }}><Icon size={20} /></span>
              <ArrowRight size={17} className="text-white/40 transition group-hover:translate-x-1 group-hover:text-white/80" />
            </div>
            <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{generator.family} · {generator.mode === 'text' ? 'Text to video' : generator.mode === 'image' ? 'Image to video' : 'Reference to video'}</div>
            <h2 className="mt-2 font-display text-xl font-700">{generator.name}</h2>
            <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/65">{generator.description}</p>
            <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4 text-xs text-white/50"><span>{generator.price}</span><span>{destination === 'tools' ? 'Open generator' : 'API + tester'}</span></div>
          </Link>
        );
      })}
    </div>
  );
}

export function DirectoryIntro({ api = false }: { api?: boolean }) {
  return (
    <div className="mb-10 max-w-3xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-white/70">{api ? <Code2 size={13} /> : <Sparkles size={13} />} {api ? 'VIDEO API DIRECTORY' : 'MANIFOLDGEN TOOLS'}</div>
      <h1 className="mt-5 font-display text-4xl font-700 tracking-tight md:text-6xl">{api ? 'One API. Every video workflow.' : 'Choose the right generator for the shot.'}</h1>
      <p className="mt-5 text-lg leading-8 text-white/70">{api ? 'Every generator has a stable ManifoldGen model ID, request examples, an interactive tester, async job recovery, and editor-ready output.' : 'Generate from text, animate a still, or guide a shot with reference media. Every result can move straight onto the ManifoldGen Studio timeline.'}</p>
    </div>
  );
}
