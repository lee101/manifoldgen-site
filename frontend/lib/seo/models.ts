import type { VideoModelRef } from './types';

// Prices are USD per 5 seconds of video unless noted, from /api/pricing and
// server/services.go videoModelPricesPerSecondUSD. 1 credit = $0.01.
export const VIDEO_MODELS: VideoModelRef[] = [
  {
    slug: 'manifold',
    name: 'Manifold Video',
    shortName: 'Manifold',
    vendor: 'ManifoldGen native',
    tagline: 'Native cinematic generator with keyframes, exact stop frames, and generated audio.',
    description:
      'Manifold Video is our in-house model, served from our own GPUs. It is the only generator on this list with ordered keyframes and an exact stop frame: you can pin where a shot starts, where it ends, and what happens between. It generates its own synchronized audio track.',
    bestFor: ['Ordered keyframes', 'Exact stop frames', 'Loops', 'Native audio'],
    modes: ['text', 'image'],
    resolutions: ['Preview', 'Balanced', 'Native'],
    durations: '4–15s',
    audio: true,
    priceFrom: 'from ~101 credits (~$1.01) per clip',
    priceFromUSD: 1.01,
    toolHrefs: [{ label: 'Open Manifold Video', href: '/tools/manifold' }],
    apiHref: '/api/video-generators/manifold',
    accent: '#7c6cff',
    mediaKey: 'model-manifold',
    verdictFor:
      'the default choice when you need shot-level control (start frame, stop frame, ordered keyframes), seamless loops, or video with generated audio',
  },
  {
    slug: 'seedance',
    name: 'Seedance 2',
    shortName: 'Seedance',
    vendor: 'ByteDance',
    tagline: 'High-fidelity cinematic motion with strong prompt following and native audio.',
    description:
      'Seedance 2 is the quality benchmark on ManifoldGen for cinematic text-to-video: it follows complex prompts, keeps characters coherent through action, and generates audio. Five variants cover fast drafts, full-quality renders, image-to-video animation, and reference-guided generation.',
    bestFor: ['Cinematic motion', 'Prompt fidelity', 'Character action', 'Reference consistency'],
    modes: ['text', 'image', 'reference'],
    resolutions: ['720p', '1080p'],
    durations: '4–10s',
    audio: true,
    priceFrom: 'from 128 credits (~$1.28) per 5s clip',
    priceFromUSD: 1.28,
    toolHrefs: [
      { label: 'Seedance 2 (text)', href: '/tools/seedance-2' },
      { label: 'Seedance Fast', href: '/tools/seedance-2-fast' },
      { label: 'Seedance Image to Video', href: '/tools/seedance-2-image' },
      { label: 'Seedance Reference', href: '/tools/seedance-2-reference' },
    ],
    apiHref: '/api/video-generators/seedance-2',
    accent: '#58a6ff',
    mediaKey: 'model-seedance',
    verdictFor:
      'the strongest overall pick for cinematic quality, multi-subject action, and brand-consistent reference work — when budget per clip matters less than output quality',
  },
  {
    slug: 'wan',
    name: 'Wan',
    shortName: 'Wan',
    vendor: 'Alibaba',
    tagline: 'Versatile open-model text-to-video at the lowest sensible price.',
    description:
      'Wan handles broad visual styles and camera moves at $0.75 per 5-second clip, roughly half of Seedance Fast. It has no native audio and tops out at 720p, which makes it the workhorse for drafts, style exploration, and volume social content rather than final hero shots.',
    bestFor: ['Versatile styles', 'Low cost', 'Camera-move prompting'],
    modes: ['text'],
    resolutions: ['720p'],
    durations: '5–6s',
    priceFrom: 'from 90 credits (~$0.90) per 5s clip',
    priceFromUSD: 0.9,
    audio: false,
    toolHrefs: [{ label: 'Open Wan Video', href: '/tools/wan' }],
    apiHref: '/api/video-generators/wan',
    accent: '#50fa7b',
    mediaKey: 'model-wan',
    verdictFor:
      'the best price-to-versatility ratio for drafts, style tests, and high-volume social clips that do not need audio or 1080p',
  },
  {
    slug: 'ltx',
    name: 'LTX 2 & LTX 2.3',
    shortName: 'LTX',
    vendor: 'Lightricks',
    tagline: 'Cheapest clips on the platform, plus a dependable 1080p image-to-video lane.',
    description:
      'LTX 2 text-to-video starts at 9 credits (~$0.09) per clip — the cheapest real generator on ManifoldGen, built for previs, placeholders, and editorial timing. LTX 2.3 is the production lane: image-to-video with coherent motion and dependable 1080p landscape output.',
    bestFor: ['Cheapest previews', 'Editorial timing', '1080p image-to-video'],
    modes: ['text', 'image'],
    resolutions: ['720p', '1080p (LTX 2.3)'],
    durations: '5–6s (t2v), 6s (i2v)',
    audio: false,
    priceFrom: 'from 9 credits (~$0.09); LTX 2.3 i2v ~$1.40 per 6s',
    priceFromUSD: 0.09,
    toolHrefs: [
      { label: 'LTX 2 (text)', href: '/tools/ltx-2' },
      { label: 'LTX 2.3 (image to video)', href: '/tools/ltx-2-3' },
    ],
    apiHref: '/api/video-generators/ltx-2',
    accent: '#bd93f9',
    mediaKey: 'model-ltx',
    verdictFor:
      'previs and animatics at almost zero cost (LTX 2), or reliable 1080p animation of a still (LTX 2.3)',
  },
  {
    slug: 'happy-horse',
    name: 'Happy Horse',
    shortName: 'Happy Horse',
    vendor: 'Alibaba',
    tagline: 'Expressive image animation for stylized characters and playful motion.',
    description:
      'Happy Horse animates a still image with expressive, lively motion. It is tuned for stylized characters, dance-like movement, and playful scenes where energy matters more than photoreal precision. Image input only; no audio; 720p.',
    bestFor: ['Expressive motion', 'Stylized characters', 'Meme-ready energy'],
    modes: ['image'],
    resolutions: ['720p'],
    durations: '5–10s',
    audio: false,
    priceFrom: 'from 168 credits (~$1.68) per clip',
    priceFromUSD: 1.68,
    toolHrefs: [{ label: 'Open Happy Horse', href: '/tools/happy-horse' }],
    apiHref: '/api/video-generators/happy-horse',
    accent: '#ff6b9d',
    mediaKey: 'model-happy-horse',
    verdictFor:
      'animating illustrated or stylized characters where expressive, exaggerated motion beats realism',
  },
  {
    slug: 'ra2v',
    name: 'RA2V',
    shortName: 'RA2V',
    vendor: 'ManifoldGen routing',
    tagline: 'Smart general-purpose route that picks the pipeline for you.',
    description:
      'RA2V is a routed service: you describe the shot, ManifoldGen selects and runs the appropriate backend, and you get a polished result without choosing a specialized workflow. A good default for API users who want one endpoint and consistent output across prompt types.',
    bestFor: ['One-endpoint simplicity', 'Smart routing', 'Polished general output'],
    modes: ['text'],
    resolutions: ['720p', '1080p'],
    durations: '5–6s',
    audio: false,
    priceFrom: 'from 120 credits (~$1.20) per clip',
    priceFromUSD: 1.2,
    toolHrefs: [{ label: 'Open RA2V', href: '/tools/ra2v' }],
    apiHref: '/api/video-generators/ra2v',
    accent: '#ffb86c',
    mediaKey: 'model-ra2v',
    verdictFor:
      'API products that want decent video from a single stable endpoint instead of maintaining per-model logic',
  },
  {
    slug: 'kling',
    name: 'Kling 3.0',
    shortName: 'Kling',
    vendor: 'Kuaishou',
    tagline: 'Cinematic text and image-to-video with native synced audio and filmic camera work.',
    description:
      'Kling 3.0 renders cinematic clips with synchronized native audio from text or a starting image. The Pro lane tops the lineup for fluid motion, improved lipsync, and 1080p output; the Standard lane keeps the price low for volume, and the 2.6 lane is the budget route with reliable motion and audio.',
    bestFor: ['Native audio', 'Multi-shot scenes', 'Filmic camera work', 'Image animation'],
    modes: ['text', 'image'],
    resolutions: ['720p', '1080p (Pro)'],
    durations: '5–10s',
    audio: true,
    priceFrom: 'from 76 credits (~$0.76) per 5s clip',
    priceFromUSD: 0.76,
    toolHrefs: [
      { label: 'Kling 3.0 (text)', href: '/tools/kling-3' },
      { label: 'Kling 3.0 Pro', href: '/tools/kling-3-pro' },
      { label: 'Kling 3.0 (image)', href: '/tools/kling-3-image' },
      { label: 'Kling 2.6', href: '/tools/kling-26' },
    ],
    apiHref: '/api/video-generators/kling-3',
    accent: '#ff3417',
    mediaKey: 'model-kling',
    verdictFor:
      'cinematic shots that need synced audio out of the box, multi-shot scenes, or budget image animation with reliable motion',
  },
  {
    slug: 'veo',
    name: 'Veo 3.1',
    shortName: 'Veo',
    vendor: 'Google',
    tagline: 'Photoreal image and text-to-video with synchronized sound and strong prompt adherence.',
    description:
      'Veo 3.1 is the photoreal flagship on ManifoldGen: realistic motion, synchronized sound, and tight prompt adherence at up to 1080p. The Fast lane animates a still with native audio at a fraction of the flagship rate, which makes it a strong pick for character-driven and product shots that must look physical.',
    bestFor: ['Photorealism', 'Synchronized audio', 'Prompt adherence', 'Fast still animation'],
    modes: ['text', 'image'],
    resolutions: ['720p', '1080p'],
    durations: '4–8s',
    audio: true,
    priceFrom: 'from 240 credits (~$2.40) per clip; Veo Fast from 90 credits',
    priceFromUSD: 2.4,
    toolHrefs: [
      { label: 'Veo 3.1', href: '/tools/veo-3-1' },
      { label: 'Veo 3.1 Fast', href: '/tools/veo-3-1-fast' },
    ],
    apiHref: '/api/video-generators/veo-3-1',
    accent: '#4285f4',
    mediaKey: 'model-veo',
    verdictFor:
      'photoreal motion with believable physics and synced audio, especially image-to-video when the still must look physical',
  },
];

export function videoModel(slug: string): VideoModelRef | undefined {
  return VIDEO_MODELS.find((m) => m.slug === slug);
}

// Image models, priced per image via /api/pricing and server/image_tools.go.
export const IMAGE_MODELS = [
  { slug: 'flux-2-dev', name: 'FLUX.2 [dev]', priceUSD: 0.04, note: 'open-weight workhorse, strong prompt adherence' },
  { slug: 'flux-2-klein', name: 'FLUX.2 [klein]', priceUSD: 0.03, note: 'cheapest image on the platform' },
  { slug: 'grok-imagine', name: 'Grok Imagine', priceUSD: 0.04, note: 'fast, punchy aesthetics; $0.09 at 2K' },
  { slug: 'z-image', name: 'Z-Image (native)', priceUSD: 0.04, note: 'our native fast lane, 4-step turbo' },
  { slug: 'nano-banana-2', name: 'Nano Banana 2', priceUSD: 0.16, note: 'Google Gemini image, best edits & text rendering' },
  { slug: 'gpt-image-2', name: 'GPT Image 2', priceUSD: 0.24, note: 'highest instruction following' },
] as const;
