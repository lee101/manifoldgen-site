import type { BlogArticle } from '../articles';

export const cutedslLatentTeleportation: BlogArticle = {
  slug: 'cutedsl-latent-teleportation-faster-generation',
  category: 'Systems',
  title: 'CuteDSL, latent teleportation, and the shortest path to faster generation',
  excerpt: 'A practical mental model for moving work through a generative pipeline without paying the full cost of rebuilding every intermediate representation.',
  readTime: '8 min read',
  date: '2026-07-16',
  ogImage: '/blog/og/cutedsl-latent-teleportation-faster-generation.webp',
  blocks: [
    { type: 'p', text: 'Generative workloads are often described as if the model is the whole system. In practice, the slow part can be the movement around the model: loading weights, translating formats, copying tensors, waiting for a worker, and throwing away an intermediate that another stage could have reused.' },
    { type: 'p', text: 'CuteDSL is a useful way to think about that boundary. A small, declarative description of the work can travel through a system while the expensive representation stays close to the accelerator. The goal is not clever syntax; it is keeping orchestration cheap and inference busy.' },
    { type: 'h2', text: 'What “latent teleportation” is pointing at' },
    { type: 'p', text: 'Use the phrase as a mental model: move a compact latent or an already-useful intermediate between compatible stages instead of reconstructing the whole problem from pixels or text each time. If a resize, style pass, temporal pass, or upscale can consume that representation directly, the pipeline avoids unnecessary decode–encode loops.' },
    { type: 'callout', title: 'The practical test', text: 'Ask: “What is the smallest representation the next stage can accept without losing the information it needs?” That answer is usually a better optimization target than shaving a few milliseconds from a JSON request.' },
    { type: 'h2', text: 'Three places the savings show up' },
    { type: 'h3', text: '1. Keep the hot path resident' },
    { type: 'p', text: 'Warm workers and reuse loaded weights. A queue should decide what runs next, not repeatedly rebuild the execution environment.' },
    { type: 'h3', text: '2. Batch compatible work' },
    { type: 'p', text: 'Images with the same shape, model, and precision can share setup. Batching is most useful when the scheduler sees enough work early enough to form a batch.' },
    { type: 'h3', text: '3. Cache the right boundary' },
    { type: 'p', text: 'Cache deterministic preprocessing and reusable conditioning. Do not cache a giant final artifact when a compact intermediate can serve multiple downstream consumers.' },
    { type: 'h2', text: 'A compact pipeline sketch' },
    { type: 'code', text: `request -> normalize prompt + references
        -> choose model / shape / precision
        -> warm worker or form a compatible batch
        -> generate in latent space
        -> decode only at the delivery boundary
        -> durable result + usage record` },
    { type: 'p', text: 'The important boundary is the last one. Decode when a human or an external API needs pixels or frames, not every time an internal stage wants to make a decision.' },
    { type: 'h2', text: 'Measure the whole path' },
    { type: 'p', text: 'Track queue wait, worker startup, model load, inference, decode, upload, and time-to-first-preview separately. A faster kernel is nice, but a warm worker that removes a ten-second startup is often the bigger win. Optimize the slowest visible segment, then measure again with real prompts and real output shapes.' },
  ],
};
