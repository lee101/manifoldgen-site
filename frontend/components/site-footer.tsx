'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINK_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
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

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname === '/studio' || pathname.startsWith('/studio/')) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-[#0a0910] px-5 py-10 text-sm text-white/50">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        {LINK_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">{group.title}</h2>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="transition hover:text-white">{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-10 max-w-7xl border-t border-white/8 pt-6 text-center">
        <a href="https://manifoldgan.evangeler.com" className="font-medium text-white/65 transition hover:text-white">Affiliate program</a>
      </div>
    </footer>
  );
}
