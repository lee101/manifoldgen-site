'use client';

import { useEffect, useState } from 'react';

type VideoPricePoint = {
  duration_seconds: number;
  price_usd: number;
  credits: number;
};

type VideoPricingTier = {
  size: 'preview' | 'balanced' | 'native';
  label: string;
  resolution_16_9: string;
  prices: VideoPricePoint[];
};

type PricingResponse = {
  credit_price_usd?: number;
  image_price_usd?: number;
  image_credits?: number;
  image_high_step_price_usd?: number;
  image_high_step_credits?: number;
  gpt_image_price_usd?: number;
  gpt_image_credits?: number;
  gpt_image_metered?: boolean;
  video_pricing?: {
    basis_steps?: number;
    billing?: string;
    tiers?: VideoPricingTier[];
  };
  pricing?: Array<{ service?: string; price_usd?: number; price_cute?: number; unit?: string }>;
  studio?: { music_generation_credits?: number; music_generation_base_usd?: number; music_generation_minimum_usd?: number; music_generation_minute_usd?: number };
};

const FALLBACK_TIERS: VideoPricingTier[] = [
  { size: 'preview', label: 'Preview', resolution_16_9: '1024 × 576', prices: [[5, .46], [10, .91], [15, 1.37], [30, 2.73], [60, 5.45]].map(([duration_seconds, price_usd]) => ({ duration_seconds, price_usd, credits: Math.round(price_usd * 100) })) },
  { size: 'balanced', label: 'Balanced', resolution_16_9: '1184 × 672', prices: [[5, .71], [10, 1.42], [15, 2.12], [30, 4.24], [60, 8.47]].map(([duration_seconds, price_usd]) => ({ duration_seconds, price_usd, credits: Math.round(price_usd * 100) })) },
  { size: 'native', label: 'Native', resolution_16_9: '1344 × 768', prices: [[5, 1.01], [10, 2.02], [15, 3.03], [30, 6.05], [60, 12.10]].map(([duration_seconds, price_usd]) => ({ duration_seconds, price_usd, credits: Math.round(price_usd * 100) })) },
];

const FALLBACK: PricingResponse = {
  credit_price_usd: .01,
  image_price_usd: .04,
  image_credits: 4,
  image_high_step_price_usd: .10,
  image_high_step_credits: 10,
  gpt_image_price_usd: .24,
  gpt_image_credits: 24,
  gpt_image_metered: true,
  video_pricing: { basis_steps: 20, tiers: FALLBACK_TIERS },
  pricing: [{ service: 'speech', price_usd: .005, price_cute: .5, unit: 'per 100 characters' }],
  studio: { music_generation_credits: 80, music_generation_base_usd: .40, music_generation_minimum_usd: .50, music_generation_minute_usd: .20 },
};

function money(value: number, minimumDigits = 2) {
  return `$${value.toFixed(value < .01 ? 3 : minimumDigits)}`;
}

function credits(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

export function PricingTable() {
  const [pricing, setPricing] = useState<PricingResponse>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/pricing')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('pricing unavailable')))
      .then((data: PricingResponse) => { if (!cancelled) setPricing({ ...FALLBACK, ...data }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const tiers = pricing.video_pricing?.tiers?.length ? pricing.video_pricing.tiers : FALLBACK_TIERS;
  const durations = tiers[0]?.prices.map((point) => point.duration_seconds) || [5, 10, 15, 30, 60];
  const creditPrice = pricing.credit_price_usd || .01;
  const musicMinimum = pricing.studio?.music_generation_minimum_usd || .50;
  const musicPerMinute = pricing.studio?.music_generation_minute_usd || .20;
  const tts = pricing.pricing?.find((item) => item.service === 'speech');

  return (
    <div className="mt-7 space-y-7">
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Video generation</h3>
            <p className="mt-1 text-sm text-white/45">16:9 output · {pricing.video_pricing?.basis_steps || 20} steps · audio included</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/50">1 credit = {money(creditPrice)}</span>
        </div>
        <div className="grid gap-3 sm:hidden">
          {tiers.map((tier) => <article key={tier.size} className={`rounded-2xl border p-4 ${tier.size === 'balanced' ? 'border-[var(--color-accent)]/35 bg-[var(--color-accent)]/[0.08]' : 'border-white/10 bg-white/[0.025]'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><b>{tier.label}</b>{tier.size === 'balanced' && <small className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] text-white/65">recommended</small>}</div>
              <span className="text-xs text-white/45">{tier.resolution_16_9}</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {tier.prices.map((point) => <div key={point.duration_seconds} className="rounded-xl bg-black/20 p-2.5">
                <small className="block text-[10px] uppercase tracking-wider text-white/35">{point.duration_seconds}s</small>
                <b className="mt-1 block text-sm">{money(point.price_usd)}</b>
                <small className="block text-[10px] text-white/40">{credits(point.credits)} cr</small>
              </div>)}
            </div>
          </article>)}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-white/10 sm:block">
          <table data-testid="api-video-pricing" className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.05] text-xs uppercase tracking-[.12em] text-white/40">
              <tr>
                <th className="px-4 py-3 font-medium">Quality</th>
                <th className="px-4 py-3 font-medium">Resolution</th>
                {durations.map((duration) => <th key={duration} className="px-4 py-3 font-medium">{duration}s</th>)}
              </tr>
            </thead>
            <tbody>
              {tiers.map((tier) => <tr key={tier.size} className={`border-t border-white/10 ${tier.size === 'balanced' ? 'bg-[var(--color-accent)]/[0.06]' : ''}`}>
                <th className="px-4 py-4 font-semibold text-white"><span>{tier.label}</span>{tier.size === 'balanced' && <small className="ml-2 rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] text-white/65">recommended</small>}</th>
                <td className="whitespace-nowrap px-4 py-4 text-white/55">{tier.resolution_16_9}</td>
                {tier.prices.map((point) => <td key={point.duration_seconds} className="px-4 py-4"><b className="block text-white">{money(point.price_usd)}</b><small className="mt-0.5 block whitespace-nowrap text-white/40">{credits(point.credits)} credits</small></td>)}
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/40">
          Prices shown use 20 steps. Eight steps cost about 40% of the table price; 30 steps cost about 150%.
          Other aspect ratios keep the selected quality tier with dimensions adjusted to the supported pixel grid.
        </p>
      </section>

      <section>
        <h3 className="text-base font-semibold">Images and audio</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-sm text-white/45">Image generation</div>
            <div className="mt-2 text-2xl font-semibold">{money(pricing.image_price_usd || .04)}</div>
            <div className="mt-1 text-sm text-white/50">{credits(pricing.image_credits || 4)} credits per image</div>
            <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/35">20+ steps: {money(pricing.image_high_step_price_usd || .10)} · {credits(pricing.image_high_step_credits || 10)} credits</div>
          </div>
          <div className="rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.07] p-5">
            <div className="text-sm text-white/45">GPT Image 2</div>
            <div className="mt-2 text-2xl font-semibold">{money(pricing.gpt_image_price_usd || .24)}</div>
            <div className="mt-1 text-sm text-white/50">{credits(pricing.gpt_image_credits || 24)} credits per image</div>
            <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/35">Opt-in only · always metered, including unlimited image plans</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-sm text-white/45">Music generation</div>
            <div className="mt-2 text-2xl font-semibold">from {money(musicMinimum)}</div>
            <div className="mt-1 text-sm text-white/50">{money(musicPerMinute)}/minute + base</div>
            <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/35">Built with MiniMax-Music3 · successful generations only</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <div className="text-sm text-white/45">Text to speech</div>
            <div className="mt-2 text-2xl font-semibold">{money(tts?.price_usd || .005)}</div>
            <div className="mt-1 text-sm text-white/50">{credits(tts?.price_cute || .5)} credits per 100 characters</div>
            <div className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-white/35">Exact charge follows the submitted character count</div>
          </div>
        </div>
      </section>
    </div>
  );
}
