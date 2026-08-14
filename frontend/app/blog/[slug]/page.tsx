import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Check, Clapperboard, Cpu, Image as ImageIcon } from 'lucide-react';
import { articleBySlug, articles } from '../articles';

type ArticlePageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return articles.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = articleBySlug(slug);
  return article ? { title: article.title, description: article.excerpt } : { title: 'Blog' };
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40 p-4 text-[13px] leading-6 text-white/75"><code>{children}</code></pre>;
}

function ArticleHeader({ category, title, excerpt, readTime }: { category: string; title: string; excerpt: string; readTime: string }) {
  return <header className="border-b border-white/10 pb-10"><div className="flex items-center gap-2 text-xs font-semibold tracking-[.14em] text-[#bcb2ff]"><BookOpen size={14} /> {category.toUpperCase()} · {readTime.toUpperCase()}</div><h1 className="mt-5 max-w-4xl font-display text-4xl font-700 tracking-tight sm:text-6xl">{title}</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-white/55">{excerpt}</p></header>;
}

export default async function BlogArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = articleBySlug(slug);
  if (!article) return <main className="min-h-screen bg-[var(--color-ink)] p-10 text-white">Article not found.</main>;

  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <header className="border-b border-white/10 bg-[#07070a]/85">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"><ArrowLeft size={16} /> All notes</Link>
          <Link href="/studio" className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold">Open Studio <ArrowRight size={14} /></Link>
        </div>
      </header>

      <article className="mx-auto max-w-6xl px-5 pb-24 pt-14 sm:pt-20">
        <ArticleHeader {...article} />

        {slug === 'cutedsl-latent-teleportation-faster-generation' && <div className="mt-12 max-w-3xl space-y-10 text-[16px] leading-8 text-white/65">
          <p>Generative workloads are often described as if the model is the whole system. In practice, the slow part can be the movement around the model: loading weights, translating formats, copying tensors, waiting for a worker, and throwing away an intermediate that another stage could have reused.</p>
          <p>CuteDSL is a useful way to think about that boundary. A small, declarative description of the work can travel through a system while the expensive representation stays close to the accelerator. The goal is not clever syntax; it is keeping orchestration cheap and inference busy.</p>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">What “latent teleportation” is pointing at</h2>
          <p>Use the phrase as a mental model: move a compact latent or an already-useful intermediate between compatible stages instead of reconstructing the whole problem from pixels or text each time. If a resize, style pass, temporal pass, or upscale can consume that representation directly, the pipeline avoids unnecessary decode–encode loops.</p>
          <div className="rounded-2xl border border-[#37d6c5]/20 bg-[#37d6c5]/[.06] p-5 text-[15px] leading-7 text-white/70"><div className="flex items-center gap-2 text-sm font-semibold text-[#7be7d9]"><Cpu size={16} /> The practical test</div><p className="mt-3">Ask: “What is the smallest representation the next stage can accept without losing the information it needs?” That answer is usually a better optimization target than shaving a few milliseconds from a JSON request.</p></div>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">Three places the savings show up</h2>
          <div className="space-y-5"><div><h3 className="font-semibold text-white">1. Keep the hot path resident</h3><p className="mt-1">Warm workers and reuse loaded weights. A queue should decide what runs next, not repeatedly rebuild the execution environment.</p></div><div><h3 className="font-semibold text-white">2. Batch compatible work</h3><p className="mt-1">Images with the same shape, model, and precision can share setup. Batching is most useful when the scheduler sees enough work early enough to form a batch.</p></div><div><h3 className="font-semibold text-white">3. Cache the right boundary</h3><p className="mt-1">Cache deterministic preprocessing and reusable conditioning. Do not cache a giant final artifact when a compact intermediate can serve multiple downstream requests.</p></div></div>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">A compact pipeline sketch</h2>
          <CodeBlock>{`request -> normalize prompt + references
        -> choose model / shape / precision
        -> warm worker or form a compatible batch
        -> generate in latent space
        -> decode only at the delivery boundary
        -> durable result + usage record`}</CodeBlock>
          <p>The important boundary is the last one. Decode when a human or an external API needs pixels or frames, not every time an internal stage wants to make a decision.</p>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">Measure the whole path</h2>
          <p>Track queue wait, worker startup, model load, inference, decode, upload, and time-to-first-preview separately. A faster kernel is nice, but a warm worker that removes a ten-second startup is often the bigger win. Optimize the slowest visible segment, then measure again with real prompts and real output shapes.</p>
        </div>}

        {slug === 'prompting-video-motion-camera-language' && <div className="mt-12 max-w-3xl space-y-10 text-[16px] leading-8 text-white/65">
          <p>A strong video prompt gives the model a shot to perform. Start with what is in frame, then say what moves, how the camera moves, how the light behaves, and where the shot should settle. The model does not need a screenplay; it needs a coherent visual event.</p>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-black"><video className="aspect-video w-full object-cover" controls muted loop playsInline preload="metadata" src="/showcase/h3-loop-glass-torus.webm" /><div className="p-5"><p className="text-xs font-semibold tracking-[.14em] text-[#7be7d9]">STUDIO EXAMPLE</p><p className="mt-2 text-sm leading-6 text-white/50">A generated showcase clip is useful for evaluating whether a prompt holds composition and motion together over time.</p></div></div>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">The five-part shot prompt</h2>
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><Clapperboard size={18} className="text-[#bcb2ff]" /><h3 className="mt-3 font-semibold text-white">Subject + setting</h3><p className="mt-1 text-sm leading-6">Name the hero object and the world around it. “A glass torus in a dark greenhouse” is more actionable than “beautiful sci-fi.”</p></div><div className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><ArrowRight size={18} className="text-[#bcb2ff]" /><h3 className="mt-3 font-semibold text-white">Action</h3><p className="mt-1 text-sm leading-6">Give the subject one primary verb: rotates, unfolds, drifts, approaches, or turns toward camera.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><Cpu size={18} className="text-[#bcb2ff]" /><h3 className="mt-3 font-semibold text-white">Camera</h3><p className="mt-1 text-sm leading-6">Choose one move and one lens feeling: slow dolly in, lateral tracking shot, locked macro, wide aerial drift.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><span className="text-lg text-[#bcb2ff]">✦</span><h3 className="mt-3 font-semibold text-white">Light + texture</h3><p className="mt-1 text-sm leading-6">Add physical cues such as rain reflections, soft rim light, volumetric haze, and brushed metal. Do not stack ten style labels.</p></div></div>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">Copyable prompt</h2>
          <CodeBlock>{`A translucent glass torus suspended in a rain-soaked greenhouse at night.
The torus rotates slowly while tiny droplets slide across its surface.
Slow cinematic dolly forward, eye-level macro perspective, shallow depth of field.
Cool moonlight through the glass roof, warm practical lights in the distance,
wet reflections, restrained motion, seamless three-second ending.`}</CodeBlock>
          <p>Notice the pacing: one subject, one action, one camera move, then physical light and a clear ending. If the result is unstable, remove adjectives before adding more. If the composition is right but the movement is wrong, change the action or camera line, not the entire prompt.</p>
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[.03] p-5 text-sm leading-7 text-white/55"><Check size={17} className="mt-1 shrink-0 text-[#7be7d9]" /> Use the Studio timeline to compare variations side by side, then trim the strongest moment instead of asking one generation to do everything.</div>
        </div>}

        {slug === 'prompting-images-composition-light' && <div className="mt-12 max-w-3xl space-y-10 text-[16px] leading-8 text-white/65">
          <p>Image prompts work best when they establish the frame before decorating it. A model can use “three-quarter portrait, subject on the right third, hard side light” as a set of visual constraints. It has less to do with whether the prompt sounds poetic.</p>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">Build from large to small</h2>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-6"><ol className="grid gap-4 text-sm leading-6 text-white/60"><li><b className="mr-2 text-white">01</b> Subject and action: what is the viewer looking at?</li><li><b className="mr-2 text-white">02</b> Composition: portrait, wide, centered, negative space, foreground/background.</li><li><b className="mr-2 text-white">03</b> Optics: lens feel, depth of field, focus plane, camera height.</li><li><b className="mr-2 text-white">04</b> Light and material: direction, softness, reflections, surface qualities.</li><li><b className="mr-2 text-white">05</b> Finish: color grade or medium, used as a final nudge.</li></ol></div>
          <h2 className="font-display text-3xl font-700 tracking-tight text-white">Copyable prompt</h2>
          <CodeBlock>{`Editorial portrait of a ceramicist in a cobalt-blue studio,
three-quarter profile positioned on the right third of a vertical frame,
negative space to the left, 85mm portrait lens, eyes in sharp focus,
hard window light from camera left, deep but readable shadows,
subtle clay dust in the air, tactile matte surfaces, restrained film color.`}</CodeBlock>
          <p>For a batch, change one variable at a time: framing, light direction, or material. That makes the outputs teach you something. If every variation changes the subject, lens, mood, and color at once, you cannot tell which instruction helped.</p>
          <div className="grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-[#37d6c5]/20 bg-[#37d6c5]/[.06] p-5"><ImageIcon size={18} className="text-[#7be7d9]" /><h3 className="mt-3 font-semibold text-white">References are constraints</h3><p className="mt-1 text-sm leading-6">Call out what a reference contributes: palette, silhouette, material, or composition. Do not make the model guess.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><Check size={18} className="text-[#bcb2ff]" /><h3 className="mt-3 font-semibold text-white">Negatives are a scalpel</h3><p className="mt-1 text-sm leading-6">Use a short list for known failure modes such as text, watermarks, or extra fingers, not a second essay that competes with the image.</p></div></div>
        </div>}
      </article>
    </main>
  );
}
