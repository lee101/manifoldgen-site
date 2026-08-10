import Link from 'next/link';
import { ArrowLeft, Check, Clock3, Code2, KeyRound, Sparkles, WalletCards } from 'lucide-react';
import { CopyMarkdownButton } from './copy-markdown-button';
import { PricingTable } from './pricing-table';

export const metadata = {
  title: 'API Documentation',
  description: 'Build image, native video, and music generation into your product with the ManifoldGen API.',
};

const createVideo = `curl https://manifoldgen.com/api/service \\
  -X POST \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "video",
    "prompt": "A glass greenhouse at night, rain on the roof",
    "aspect_ratio": "16:9",
    "size": "native",
    "duration": 5,
    "num_steps": 20,
    "include_audio": true,
    "output_format": "webm-av1"
  }'`;

const queuedResponse = `{
  "result": {
    "job_id": "8a17…",
    "status": "queued",
    "status_url": "/api/video-jobs/8a17…"
  },
  "estimated_credits": 101,
  "estimated_cost_usd": 1.01
}`;

const pollJob = `curl https://manifoldgen.com/api/video-jobs/8a17… \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY"`;

const createImage = `curl https://manifoldgen.com/api/service \\
  -X POST \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "image",
    "prompt": "Editorial portrait, hard side light",
    "width": 1024,
    "height": 1024,
    "num_steps": 12
  }'`;

const createAudio = `curl https://manifoldgen.com/api/service \\
  -X POST \\
  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "audio",
    "prompt": "Warm modular synths, restrained drums, hopeful sunrise",
    "duration": 30
  }'`;

const audioResponse = `{
  "service": "audio",
  "audio_id": "9c41…",
  "audio_url": "https://…/track.wav",
  "kind": "music",
  "duration_seconds": 30,
  "indexed": true,
  "credits_used": 80,
  "cost_usd": 0.80
}`;

const searchAudio = `curl --get https://manifoldgen.com/api/audio/search \\
  --data-urlencode "q=hopeful modular sunrise" \\
  --data-urlencode "kind=music" \\
  --data-urlencode "top_k=20"`;

const llmMarkdown = `# ManifoldGen API integration

Use \`Authorization: Bearer $MANIFOLDGEN_API_KEY\` on every protected request. Never expose the key in browser code.

## Generate video
POST \`https://manifoldgen.com/api/service\` with JSON: \`{"service":"video","prompt":"...","aspect_ratio":"16:9","size":"native","duration":5,"num_steps":20,"include_audio":true,"output_format":"webm-av1"}\`. This returns HTTP 202 with \`result.job_id\` and \`result.status_url\`. Poll \`GET https://manifoldgen.com/api/video-jobs/{job_id}\` every 2–5 seconds until \`status\` is \`completed\`.

## Generate images
POST \`/api/service\` with \`{"service":"image","prompt":"...","width":1024,"height":1024,"num_steps":12,"n":1}\`. Image generation returns synchronously. Use \`n\` for batches.

## Generate audio
POST \`/api/service\` with \`{"service":"audio","prompt":"...","duration":30}\`. Music generation returns synchronously with a durable \`audio_url\` and \`audio_id\`. Duration defaults to 30 seconds and accepts 30–180 seconds. Search indexed audio with \`GET /api/audio/search?q=...&kind=music&top_k=20\`.

## Extend video
POST \`/api/studio/extend-video\` with \`{"video_url":"https://...","prompt":"continue the camera move","duration":5}\`. Authenticate with the same Bearer key, then poll the returned job/status URL if supplied.

\`GET /api/pricing\` returns the current video quality, resolution, duration, dollar, and credit matrix. Handle 401 (key), 402 (credits), 429/503 (retry with backoff).`;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-black/45 p-4 text-[13px] leading-6 text-white/75">
      <code>{children}</code>
    </pre>
  );
}

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-ink)] text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#07070a]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/65 hover:text-white">
            <ArrowLeft size={16} /> ManifoldGen
          </Link>
          <Link href="/account" className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold">
            Get an API key
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1 text-sm text-white/55">
            <a href="#quickstart" className="block py-1.5 hover:text-white">Quickstart</a>
            <a href="#video" className="block py-1.5 hover:text-white">Generate video</a>
            <a href="#jobs" className="block py-1.5 hover:text-white">Poll a job</a>
            <a href="#images" className="block py-1.5 hover:text-white">Generate images</a>
            <a href="#audio" className="block py-1.5 hover:text-white">Generate audio</a>
            <a href="#pricing" className="block py-1.5 hover:text-white">Pricing</a>
            <a href="#errors" className="block py-1.5 hover:text-white">Errors</a>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <div className="mb-14">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/65">
              <Code2 size={13} /> REST API
            </div>
            <h1 className="font-display text-4xl font-700 tracking-tight md:text-6xl">Build with ManifoldGen</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/60">
              Generate native video, production-ready images, and original music through one small JSON API.
              Pay only for successful generations.
            </p>
            <div className="mt-5"><CopyMarkdownButton markdown={llmMarkdown} /></div>
          </div>

          <section id="quickstart" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Quickstart</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                [KeyRound, '1. Create a key', 'Sign in on Account and copy your API key.'],
                [WalletCards, '2. Add credits', 'Credits are pay-as-you-go and never expire.'],
                [Sparkles, '3. Generate', 'Send a prompt, then poll the returned job URL.'],
              ].map(([Icon, title, copy]) => {
                const ItemIcon = Icon as typeof KeyRound;
                return (
                  <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <ItemIcon size={18} className="text-[var(--color-accent-2)]" />
                    <h3 className="mt-3 text-sm font-semibold">{String(title)}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/50">{String(copy)}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 text-sm leading-6 text-white/60">
              Send your key as <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">Authorization: Bearer …</code>.
              Keep it on your server; never ship it in public browser code.
            </p>
          </section>

          <section id="video" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Generate video</h2>
            <p className="mb-5 mt-3 leading-7 text-white/55">Creates an asynchronous video job. Audio is enabled by default.</p>
            <CodeBlock>{createVideo}</CodeBlock>
            <h3 className="mb-3 mt-7 text-sm font-semibold text-white/80">202 Accepted</h3>
            <CodeBlock>{queuedResponse}</CodeBlock>
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 text-sm">
              {[
                ['size', 'preview | balanced | native | audio', 'balanced'],
                ['duration', '4–60 seconds (audio: up to 45)', '5'],
                ['aspect_ratio', '16:9, 9:16, 1:1, 4:3, 3:4, 21:9', '16:9'],
                ['num_steps', '8–30; more steps increase time and price', '20'],
                ['include_audio', 'Generate native audio when available', 'true'],
                ['output_format', 'webm-av1 | mp4-h264', 'webm-av1'],
              ].map(([name, detail, fallback]) => (
                <div key={name} className="grid gap-1 border-b border-white/10 px-4 py-3 last:border-0 sm:grid-cols-[130px_1fr_100px]">
                  <code className="text-[var(--color-accent-2)]">{name}</code>
                  <span className="text-white/55">{detail}</span>
                  <span className="text-white/35">Default: {fallback}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="jobs" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Poll a job</h2>
            <p className="mb-5 mt-3 leading-7 text-white/55">
              Poll every 2–5 seconds until <code>status</code> is <code>completed</code>. Completed responses include
              the durable video URL, actual cost, and credits used.
            </p>
            <CodeBlock>{pollJob}</CodeBlock>
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-4 text-sm leading-6 text-amber-100/70">
              <Clock3 size={17} className="mt-1 shrink-0" /> Store the job ID. Jobs survive client disconnects and can be recovered later.
            </div>
          </section>

          <section id="images" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Generate images</h2>
            <p className="mb-5 mt-3 leading-7 text-white/55">Image requests return synchronously and start at 4 credits.</p>
            <CodeBlock>{createImage}</CodeBlock>
          </section>

          <section id="audio" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Generate and search audio</h2>
            <p className="mb-5 mt-3 leading-7 text-white/55">
              Music requests return synchronously, persist as durable audio assets, and are immediately searchable by meaning.
              Duration defaults to 30 seconds and accepts 30–180 seconds.
            </p>
            <CodeBlock>{createAudio}</CodeBlock>
            <h3 className="mb-3 mt-7 text-sm font-semibold text-white/80">200 OK</h3>
            <CodeBlock>{audioResponse}</CodeBlock>
            <h3 className="mb-3 mt-7 text-sm font-semibold text-white/80">Search public audio</h3>
            <p className="mb-5 text-sm leading-6 text-white/50">
              Search needs no key for public assets. Add your Bearer key to include your private audio in the results.
            </p>
            <CodeBlock>{searchAudio}</CodeBlock>
          </section>

          <section id="pricing" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Clear, usage-based pricing</h2>
            <p className="mt-3 leading-7 text-white/55">
              Choose a quality tier and duration up front. Every request returns the same preflight dollar and credit
              estimate shown below; completed video jobs settle from measured generation time and include the final charge.
            </p>
            <PricingTable />
          </section>

          <section id="errors" className="scroll-mt-28 border-t border-white/10 py-10">
            <h2 className="font-display text-2xl font-700">Errors</h2>
            <div className="mt-5 space-y-3 text-sm text-white/60">
              {[
                ['400', 'Invalid request or unsupported option'],
                ['401', 'Missing or invalid API key'],
                ['402', 'Not enough credits to release the result'],
                ['404', 'Job or resource not found'],
                ['429 / 503', 'Capacity unavailable; retry with backoff'],
              ].map(([code, meaning]) => (
                <div key={code} className="flex gap-4"><code className="w-20 text-white">{code}</code><span>{meaning}</span></div>
              ))}
            </div>
            <div className="mt-8 flex items-center gap-2 text-sm text-white/50"><Check size={16} className="text-[var(--color-accent-2)]" /> JSON responses use a stable <code>error</code> message.</div>
          </section>
        </article>
      </div>
    </main>
  );
}
