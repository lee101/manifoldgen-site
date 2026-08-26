'use client';

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Search, X } from 'lucide-react';
import { CATEGORIES, STYLES, type StyleEntry } from './styles';

const PAGE = 60;

export default function StyleGallery() {
  const [cat, setCat] = useState<string>('All');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return STYLES.filter(
      (s) =>
        (cat === 'All' || s.cat === cat) &&
        (!needle || s.name.toLowerCase().includes(needle) || s.prompt.toLowerCase().includes(needle)),
    );
  }, [cat, q]);

  useEffect(() => {
    setLimit(PAGE);
  }, [cat, q]);

  const isOpen = open !== null;
  const next = useCallback(() => setOpen((o) => (o === null ? o : (o + 1) % filtered.length)), [filtered.length]);
  const prev = useCallback(
    () => setOpen((o) => (o === null ? o : (o - 1 + filtered.length) % filtered.length)),
    [filtered.length],
  );

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, next, prev]);

  useEffect(() => {
    if (!isOpen) setCopied(false);
  }, [isOpen]);

  const visible = filtered.slice(0, limit);
  const current: StyleEntry | null = open !== null ? filtered[open] ?? null : null;

  const copyPrompt = () => {
    if (!current) return;
    navigator.clipboard.writeText(current.prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="sticky top-0 z-10 -mx-5 border-y border-white/10 bg-[#07070a]/90 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCat('All')}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${cat === 'All' ? 'border-[#bcb2ff] bg-[#bcb2ff]/15 text-white' : 'border-white/10 bg-white/[.03] text-white/55 hover:text-white'}`}
          >
            All {STYLES.length}
          </button>
          {CATEGORIES.map(({ name, count }) => (
            <button
              key={name}
              onClick={() => setCat(name)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${cat === name ? 'border-[#bcb2ff] bg-[#bcb2ff]/15 text-white' : 'border-white/10 bg-white/[.03] text-white/55 hover:text-white'}`}
            >
              {name} {count}
            </button>
          ))}
          <label className="relative ml-auto w-full max-w-xs">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search styles or prompts"
              className="w-full rounded-full border border-white/10 bg-white/[.04] py-1.5 pl-9 pr-3 text-sm text-white placeholder:text-white/30 focus:border-[#bcb2ff]/50 focus:outline-none"
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-white/40">
          Showing {visible.length} of {filtered.length} — every image is the same subject ({'aesthetic elf woman'}) with only the style modifier changed.
        </p>
      </div>

      {/* Grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {visible.map((s, idx) => (
          <button
            key={s.i}
            onClick={() => setOpen(idx)}
            className="group relative overflow-hidden rounded-xl border border-white/10 bg-black text-left"
          >
            <img
              src={s.url}
              alt={`Aesthetic elf woman in ${s.name} style`}
              loading="lazy"
              width={832}
              height={1216}
              className="aspect-[832/1216] w-full object-cover transition duration-300 group-hover:scale-[1.04]"
            />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-6 text-[11px] leading-tight text-white/85 opacity-0 transition group-hover:opacity-100">
              <span className="mr-1 font-mono text-white/45">#{s.i}</span>
              {s.name}
            </span>
          </button>
        ))}
      </div>

      {limit < filtered.length && (
        <div className="mt-8 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-full border border-white/15 bg-white/[.05] px-6 py-3 text-sm font-semibold text-white/80 transition hover:border-[#bcb2ff]/50 hover:text-white"
          >
            Load {Math.min(PAGE, filtered.length - limit)} more ({filtered.length - limit} left)
          </button>
        </div>
      )}

      {/* Lightbox */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0c0d10]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white/70 hover:text-white"
            >
              <X size={16} />
            </button>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:flex-row sm:p-6">
              <img
                src={current.url}
                alt={`Aesthetic elf woman in ${current.name} style`}
                className="mx-auto h-auto max-h-[70vh] w-auto flex-none rounded-lg object-contain sm:max-h-none"
                width={832}
                height={1216}
              />
              <div className="flex min-w-0 flex-col justify-between gap-4 sm:w-72">
                <div>
                  <div className="flex items-center justify-between text-xs text-white/40">
                    <span>{current.cat}</span>
                    <span>
                      {(open ?? 0) + 1} / {filtered.length}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-xl font-700 leading-snug tracking-tight text-white">{current.name}</h3>
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-white/40">Prompt</p>
                    <p className="mt-2 break-words font-mono text-[13px] leading-6 text-white/75">{current.prompt}</p>
                  </div>
                  <button
                    onClick={copyPrompt}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[.05] px-4 py-2 text-xs font-semibold text-white/80 hover:border-[#bcb2ff]/50 hover:text-white"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy prompt'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={prev}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/[.05] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"
                  >
                    <ChevronLeft size={14} /> Prev
                  </button>
                  <button
                    onClick={next}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/[.05] px-3 py-2 text-xs font-semibold text-white/80 hover:text-white"
                  >
                    Next <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
