'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FOOTER_BLOG_LINKS,
  FOOTER_EXPLORE_LINKS,
  FOOTER_GUIDE_LINKS,
  FOOTER_TOOL_GROUPS,
  FOOTER_VIDEO_MODEL_LINKS,
  type FooterLink,
} from '../lib/footer-links';

const SEO_LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Use cases',
    links: [
      { label: 'Product ads', href: '/ai-video-generator/product-ads' },
      { label: 'TikTok videos', href: '/ai-video-generator/tiktok' },
      { label: 'Music videos', href: '/ai-video-generator/music-videos' },
      { label: 'VFX', href: '/ai-video-generator/vfx' },
      { label: 'Anime', href: '/ai-video-generator/anime' },
      { label: 'All use cases', href: '/ai-video-generator' },
    ],
  },
  {
    title: 'Models',
    links: [
      { label: 'Seedance 2', href: '/models/seedance' },
      { label: 'Wan', href: '/models/wan' },
      { label: 'LTX', href: '/models/ltx' },
      { label: 'Manifold Video', href: '/models/manifold' },
      { label: 'Happy Horse', href: '/models/happy-horse' },
      { label: 'Model directory', href: '/models' },
      { label: 'Model leaderboard', href: '/leaderboard' },
    ],
  },
  {
    title: 'Compare & answers',
    links: [
      { label: 'Seedance vs Wan', href: '/compare/seedance-vs-wan' },
      { label: 'Manifold vs Seedance', href: '/compare/manifold-vs-seedance' },
      { label: 'Best AI video generator', href: '/best/best-ai-video-generator' },
      { label: 'Cheapest AI video generator', href: '/best/cheapest-ai-video-generator' },
      { label: 'Most models in one API', href: '/best/most-ai-models-in-one-api' },
      { label: 'All comparisons', href: '/compare' },
    ],
  },
];

function FooterColumn({ title, links, more }: { title: string; links: readonly FooterLink[]; more?: FooterLink }) {
  return (
    <nav aria-label={title}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-white/60 transition hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
        {more ? (
          <li>
            <Link href={more.href} className="font-medium text-[var(--color-accent-2)] transition hover:text-white">
              {more.label}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname === '/studio' || pathname.startsWith('/studio/')) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-[#0a0910]">
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="sm:col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="font-display text-xl font-800 tracking-tight text-white">
              Manifold<span className="text-[var(--color-accent-2)]">Gen</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-6 text-white/55">
              Cinematic AI video, image, and audio generation — one studio, one API, every model behind a single request.
            </p>
            <div className="mt-6 flex flex-wrap gap-3 text-sm">
              <Link href="/studio" className="rounded-full bg-white px-4 py-2 font-semibold text-black transition hover:bg-white/85">
                Open Studio
              </Link>
              <Link href="/account" className="rounded-full border border-white/20 px-4 py-2 text-white/75 transition hover:border-white/40 hover:text-white">
                Account
              </Link>
            </div>
          </div>

          <FooterColumn {...FOOTER_TOOL_GROUPS[0]} />
          <FooterColumn {...FOOTER_TOOL_GROUPS[1]} />

          <div className="grid grid-cols-2 gap-x-6 sm:col-span-2 md:col-span-1">
            <FooterColumn title={FOOTER_TOOL_GROUPS[2].title} links={FOOTER_TOOL_GROUPS[2].links} more={FOOTER_TOOL_GROUPS[2].more} />
            <FooterColumn title="Video models" links={FOOTER_VIDEO_MODEL_LINKS} more={{ href: '/api/video-generators', label: 'API docs' }} />
          </div>
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-10 border-t border-white/10 pt-10 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <FooterColumn title="Blog" links={FOOTER_BLOG_LINKS} more={{ href: '/blog', label: 'All posts' }} />
          <FooterColumn title="Guides" links={FOOTER_GUIDE_LINKS} more={{ href: '/blog/guides', label: 'All guides' }} />
          {SEO_LINK_GROUPS.map((group) => (
            <FooterColumn key={group.title} title={group.title} links={group.links} />
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Explore the library</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {FOOTER_EXPLORE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/60 transition hover:border-white/40 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-sm text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} ManifoldGen. All rights reserved.</span>
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2" aria-label="Legal">
            <a href="https://manifoldgan.evangeler.com" className="transition hover:text-white">Affiliate program</a>
            <Link href="/api" className="transition hover:text-white">API</Link>
            <Link href="/privacy" className="transition hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition hover:text-white">Terms</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
