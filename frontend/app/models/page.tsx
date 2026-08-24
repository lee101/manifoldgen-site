import type { Metadata } from 'next';
import Link from 'next/link';
import { IMAGE_MODELS, VIDEO_MODELS } from '@/lib/seo/models';
import { CtaStrip, PageShell } from '@/components/seo/kit';

export const metadata: Metadata = {
  title: 'AI Video Models on ManifoldGen — Seedance, Wan, LTX & More',
  description:
    'Every AI video and image model on ManifoldGen with prices, resolutions, audio support, and honest strengths. One API key, one credit balance, all models.',
  alternates: { canonical: '/models' },
};

const MODE = { text: 'Text to video', image: 'Image to video', reference: 'Reference to video' } as const;

export default function ModelsIndex() {
  return (
    <PageShell>
      <section className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-accent-2)]">Model directory</p>
        <h1 className="mt-4 font-display text-4xl font-700 tracking-tight md:text-6xl">Every AI video model, one balance</h1>
        <p className="mt-5 text-lg leading-8 text-white/70">
          ManifoldGen serves {VIDEO_MODELS.length} video model families plus six image engines through one API and one prepaid
          credit balance ($0.01 per credit). No per-vendor subscriptions; switch models mid-project.
        </p>
      </section>
      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {VIDEO_MODELS.map((model) => (
          <Link
            key={model.slug}
            href={`/models/${model.slug}`}
            className="group rounded-3xl border border-white/12 bg-white/[0.04] p-6 transition hover:border-white/35"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: model.accent }}>{model.vendor}</span>
              <span className="text-xs text-white/50">{model.priceFrom}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-700">{model.name}</h2>
            <p className="mt-2 text-sm leading-7 text-white/65">{model.tagline}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {model.modes.map((mode) => (
                <span key={mode} className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/60">{MODE[mode]}</span>
              ))}
              {model.audio && <span className="rounded-full border border-[var(--color-accent-2)]/40 px-2.5 py-1 text-[11px] text-[var(--color-accent-2)]">Native audio</span>}
              {model.resolutions.includes('1080p') && !model.resolutions.every((r) => r === '720p') && (
                <span className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/60">1080p</span>
              )}
            </div>
          </Link>
        ))}
      </section>
      <section className="mt-12">
        <h2 className="font-display text-xl font-700">Image engines</h2>
        <p className="mt-2 text-sm text-white/60">Per-image pricing across the image lane. All usable from Studio and the API.</p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-white/50">
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Price / image</th>
                <th className="px-4 py-3 font-medium">Known for</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8">
              {IMAGE_MODELS.map((imageModel) => (
                <tr key={imageModel.slug}>
                  <td className="px-4 py-3 font-medium text-white/90">{imageModel.name}</td>
                  <td className="px-4 py-3 text-white/75">${imageModel.priceUSD.toFixed(2)}</td>
                  <td className="px-4 py-3 text-white/55">{imageModel.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <CtaStrip heading="Generate on every model in one session" sub="Compare outputs side by side in Studio, then ship via the API." />
    </PageShell>
  );
}
