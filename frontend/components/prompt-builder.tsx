'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, RefreshCw, Sparkles } from 'lucide-react';
import type { PromptTool } from '@/lib/prompt-tools';

const CAMERA_MOVES = [
  'slow eye-level dolly-in on a 35mm lens',
  'smooth lateral tracking shot on a 50mm lens',
  'low-angle crane from foreground detail into a wide reveal',
  'restrained 30-degree orbit on an 85mm lens',
  'natural shoulder-height handheld shot with minimal drift',
  'locked symmetrical wide shot on a 24mm rectilinear lens',
];

const LIGHTING = [
  'soft overcast daylight with realistic reflections',
  'warm practical light against cool blue-hour ambience',
  'hard side key with a narrow rim and deep negative fill',
  'early morning window light with gentle volumetric haze',
  'neon practicals reflected across wet surfaces',
  'high-key commercial softbox light with controlled highlights',
];

const STYLES = [
  'photoreal cinematic realism with tactile natural texture',
  'premium commercial film with crisp material detail',
  'observational documentary with restrained color grading',
  'hand-drawn cinematic anime with clean linework',
  'surreal high-fashion music video, polished but physical',
  'production-ready storyboard frame with clear value grouping',
];

const PLATFORMS = [
  '16:9 cinematic frame',
  '9:16 vertical social safe-area composition',
  '1:1 square social placement',
  '2.39:1 widescreen master',
  'source aspect ratio',
];

function cleanPart(value: string) {
  return value.trim().replace(/[.,;:]+$/, '');
}

function buildPrompt(values: PromptTool['defaults'], suffix: string) {
  const core = [
    `${cleanPart(values.subject)} ${cleanPart(values.action)}`,
    cleanPart(values.setting),
    cleanPart(values.camera),
    cleanPart(values.lighting),
    cleanPart(values.style),
    cleanPart(values.platform),
  ].filter(Boolean);
  return `${core.join('. ')}. ${suffix}`.replace(/\s+/g, ' ').trim();
}

function Field({ label, value, onChange, list }: { label: string; value: string; onChange: (value: string) => void; list?: string[] }) {
  const id = `prompt-${label.toLowerCase().replace(/\W+/g, '-')}`;
  return (
    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.13em] text-white/45">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={list ? `${id}-options` : undefined}
        className="min-w-0 rounded-xl border border-white/12 bg-black/35 px-4 py-3 text-sm font-normal normal-case tracking-normal text-white outline-none transition placeholder:text-white/25 focus:border-[#b99aef]/55"
      />
      {list ? <datalist id={`${id}-options`}>{list.map((option) => <option key={option} value={option} />)}</datalist> : null}
    </label>
  );
}

export default function PromptBuilder({ tool }: { tool: PromptTool }) {
  const [values, setValues] = useState(tool.defaults);
  const [copied, setCopied] = useState(false);
  const output = useMemo(() => buildPrompt(values, tool.suffix), [tool.suffix, values]);
  const studioHref = `/studio?prompt=${encodeURIComponent(output)}`;

  function update(key: keyof PromptTool['defaults'], value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setCopied(false);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#b99aef]/25 bg-[linear-gradient(145deg,rgba(185,154,239,.10),rgba(255,255,255,.025)_42%,rgba(55,214,197,.05))] shadow-[0_30px_100px_rgba(0,0,0,.24)]">
      <div className="flex flex-col gap-2 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-7">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#cab3f3]"><Sparkles size={13} /> Free · no login</p>
          <h2 className="mt-1 font-display text-xl font-700">Build your prompt</h2>
        </div>
        <button type="button" onClick={() => setValues(tool.defaults)} className="inline-flex items-center gap-2 self-start rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-white/55 hover:border-white/30 hover:text-white">
          <RefreshCw size={13} /> Reset example
        </button>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-7">
        <Field label="Subject" value={values.subject} onChange={(value) => update('subject', value)} />
        <Field label="Action" value={values.action} onChange={(value) => update('action', value)} />
        <Field label="Setting" value={values.setting} onChange={(value) => update('setting', value)} />
        <Field label="Camera" value={values.camera} onChange={(value) => update('camera', value)} list={CAMERA_MOVES} />
        <Field label="Lighting" value={values.lighting} onChange={(value) => update('lighting', value)} list={LIGHTING} />
        <Field label="Style" value={values.style} onChange={(value) => update('style', value)} list={STYLES} />
        <div className="md:col-span-2">
          <Field label="Format" value={values.platform} onChange={(value) => update('platform', value)} list={PLATFORMS} />
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/25 p-5 md:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Generated prompt</p>
          <span className="text-xs text-white/30">{output.length} characters</span>
        </div>
        <p className="mt-3 rounded-2xl border border-white/10 bg-black/45 p-5 font-mono text-[13px] leading-7 text-white/78" aria-live="polite">{output}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => void copyPrompt()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 hover:border-white/40 hover:text-white">
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied' : 'Copy prompt'}
          </button>
          <Link href={studioHref} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/85">
            Generate this video <ArrowRight size={16} />
          </Link>
          <Link href={tool.modelHref} className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-[#cab3f3] hover:text-white">
            Open {tool.recommendedModel}
          </Link>
        </div>
      </div>
    </section>
  );
}
