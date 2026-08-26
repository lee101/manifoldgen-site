import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Faq } from '@/lib/seo/types';

export function SeoHeader() {
  return (
    <header className="border-b border-white/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="font-display text-lg font-700 tracking-tight">ManifoldGen</Link>
        <nav className="flex items-center gap-1 text-sm text-white/70">
          <Link href="/ai-video-generator" className="rounded-full px-3 py-2 hover:text-white">Use cases</Link>
          <Link href="/models" className="rounded-full px-3 py-2 hover:text-white">Models</Link>
          <Link href="/compare" className="rounded-full px-3 py-2 hover:text-white">Compare</Link>
          <Link href="/best" className="hidden rounded-full px-3 py-2 hover:text-white sm:block">Answers</Link>
          <Link href="/studio" className="rounded-full bg-white px-4 py-2 font-semibold text-black">Studio</Link>
        </nav>
      </div>
    </header>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `https://manifoldgen.com${item.path}`,
    })),
  };
}

export function FaqSection({ faqs, title = 'Frequently asked questions' }: { faqs: Faq[]; title?: string }) {
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-700 tracking-tight">{title}</h2>
      <div className="mt-5 divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
        {faqs.map((faq) => (
          <details key={faq.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-medium text-white/90 marker:hidden">
              <span className="mr-2 text-[var(--color-accent-2)] group-open:hidden">+</span>
              <span className="mr-2 hidden text-[var(--color-accent-2)] group-open:inline">−</span>
              {faq.q}
            </summary>
            <p className="mt-3 pl-5 text-sm leading-7 text-white/65">{faq.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function CrossLinks({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{title}</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/75 transition hover:border-white/40 hover:text-white"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function CtaStrip({ heading, sub }: { heading: string; sub: string }) {
  return (
    <section className="mt-14 flex flex-col justify-between gap-5 rounded-3xl border border-white/15 bg-white/[0.05] p-6 sm:flex-row sm:items-center">
      <div>
        <h2 className="font-display text-xl font-700">{heading}</h2>
        <p className="mt-1 text-sm text-white/60">{sub}</p>
      </div>
      <div className="flex shrink-0 gap-3">
        <Link href="/studio" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-white/85">Open Studio</Link>
        <Link href="/api/video-generators" className="rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold hover:border-white/50">API docs</Link>
      </div>
    </section>
  );
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen overflow-x-clip bg-[var(--color-ink)] text-white">
      <SeoHeader />
      <div className="mx-auto max-w-7xl px-5 py-10 md:py-14">{children}</div>
    </main>
  );
}

export function SpecTable({ columns, rows }: { columns: [string, string, string]; rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-white/50">
            <th className="px-4 py-3 font-medium">{columns[0]}</th>
            <th className="px-4 py-3 font-medium">{columns[1]}</th>
            <th className="px-4 py-3 font-medium">{columns[2]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/8">
          {rows.map((row) => (
            <tr key={row[0]}>
              <td className="px-4 py-3 text-white/55">{row[0]}</td>
              <td className="px-4 py-3 text-white/90">{row[1]}</td>
              <td className="px-4 py-3 text-white/90">{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
