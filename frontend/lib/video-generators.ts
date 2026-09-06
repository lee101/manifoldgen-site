export type VideoGeneratorMode = 'text' | 'image' | 'reference';

export type VideoGeneratorExample = {
  prompt: string;
  outputURL: string;
  imageURL?: string;
};

export type VideoGenerator = {
  slug: string;
  model: string;
  name: string;
  shortName: string;
  family: string;
  mode: VideoGeneratorMode;
  description: string;
  strengths: string[];
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  audio: boolean;
  price: string;
  accent: string;
  manifold?: boolean;
  example?: VideoGeneratorExample;
  guide?: { slug: string; title: string };
};

const COMMON_RATIOS = ['16:9', '9:16', '1:1', '4:3', '3:4'];
const OPENPATHS_STATIC = 'https://openpathsstatic.openpaths.io/static/uploads/playground';
const SEEDANCE_LOGO = `${OPENPATHS_STATIC}/seedance/openpaths-logo.webp`;
const HAPPY_HORSE_IMAGE = `${OPENPATHS_STATIC}/happy-horse/rap.png`;
const FAL_VIDEO = `${OPENPATHS_STATIC}/fal-video`;

const EXAMPLES = {
  manifold: {
    prompt: 'A glass torus floats in a dark studio, slowly turning as luminous violet and cyan light travels through its transparent body, cinematic macro photography, precise reflections, no text.',
    outputURL: '/showcase/h3-loop-glass-torus.webm',
  },
  seedanceFast: {
    prompt: 'A cinematic 4-second shot of a compact AI routing console on a dark workstation, luminous paths connecting model nodes across a glass interface, slow handheld push-in, realistic reflections, premium product demo lighting, no readable text.',
    outputURL: `${OPENPATHS_STATIC}/seedance/seedance-fast-text-to-video.mp4`,
  },
  seedance: {
    prompt: 'A polished studio macro shot of an AI infrastructure dashboard represented as glowing fiber-optic routes inside a transparent cube, slow orbiting camera, cinematic depth of field, clean black background, no readable text.',
    outputURL: `${OPENPATHS_STATIC}/seedance/seedance-text-to-video.mp4`,
  },
  seedanceImage: {
    prompt: 'Animate the supplied OpenPaths logo as a premium product mark: subtle camera push-in, soft light sweep across the surface, tiny particles moving around it, clean dark studio background, elegant motion, no added text.',
    outputURL: `${OPENPATHS_STATIC}/seedance/seedance-image-to-video.mp4`,
    imageURL: SEEDANCE_LOGO,
  },
  seedanceReferenceFast: {
    prompt: 'Use @Image1 as the exact brand mark on a small illuminated badge mounted to a matte black server rack. Slow dolly-in, shallow depth of field, cool white rim light, subtle cable movement, premium infrastructure commercial, no extra text.',
    outputURL: `${OPENPATHS_STATIC}/seedance/seedance-fast-reference-to-video.mp4`,
    imageURL: SEEDANCE_LOGO,
  },
  seedanceReference: {
    prompt: '@Image1 is projected as a crisp holographic interface element above a developer desk. Camera slides left to right, soft reflections on glass, realistic workstation lighting, cinematic product demo, no additional words or watermarks.',
    outputURL: `${OPENPATHS_STATIC}/seedance/seedance-reference-to-video.mp4`,
    imageURL: SEEDANCE_LOGO,
  },
  happyHorse: {
    prompt: 'Bring the scene in the image to life.',
    outputURL: `${OPENPATHS_STATIC}/happy-horse/happy-horse-image-to-video.mp4`,
    imageURL: HAPPY_HORSE_IMAGE,
  },
  ltx: {
    prompt: 'A polished real-estate listing still becomes a smooth slow zoom-in video, subtle parallax, stable architecture, natural lighting, no text overlays.',
    outputURL: `${OPENPATHS_STATIC}/happy-horse/happy-horse-image-to-video.mp4`,
    imageURL: SEEDANCE_LOGO,
  },
  wan: {
    prompt: 'Cinematic aerial shot soaring over a neon-drenched futuristic megacity at dusk, sleek glass towers reflecting magenta and cyan light, flying vehicles streaking between skyscrapers, volumetric fog, ultra-smooth glide.',
    outputURL: 'https://openpathsstatic.openpaths.io/static/uploads/playground/manifoldgen/wan-2.7-text-to-video-example.mp4',
  },
  ltx2: {
    prompt: 'Sweeping cinematic drone shot gliding over neon-lit futuristic city canyons at dusk, holographic light trails reflecting on glass towers, volumetric fog, dramatic teal-and-amber color grade.',
    outputURL: `${FAL_VIDEO}/hailuo-2.3-text-to-video.mp4`,
  },
  ra2v: {
    prompt: 'A lone astronaut drifts weightless inside a derelict space station, dust motes glittering in shafts of golden sunlight through cracked viewports, slow cinematic dolly push, anamorphic lens flare, volumetric god rays, hyper-detailed.',
    outputURL: `${FAL_VIDEO}/kling-v3-pro-text-to-video.mp4`,
  },
} satisfies Record<string, VideoGeneratorExample>;

export const VIDEO_GENERATORS: VideoGenerator[] = [
  {
    slug: 'manifold', model: 'manifold', name: 'Manifold Video', shortName: 'Manifold', family: 'Manifold', mode: 'text',
    description: 'Our native cinematic generator with prompt, start frame, stop frame, ordered keyframes, loops, and generated audio.',
    strengths: ['Ordered keyframes', 'Exact stop frames', 'Native audio'], durations: [4, 5, 8, 10, 15],
    aspectRatios: [...COMMON_RATIOS, '21:9'], resolutions: ['Preview', 'Balanced', 'Native'], audio: true,
    price: 'from ~101 Manifold credits', accent: '#7c6cff', manifold: true, example: EXAMPLES.manifold,
  },
  {
    slug: 'h3-max', model: 'minimax/h3-max/text-to-video', name: 'H3 Max', shortName: 'H3 Max', family: 'MiniMax', mode: 'text',
    description: 'fal H3 Max text-to-video with stronger prompt adherence, polished aesthetics, and fast hosted inference.',
    strengths: ['Prompt adherence', 'Fast throughput', '5–15 second clips'], durations: [5, 10, 15],
    aspectRatios: [...COMMON_RATIOS, '21:9'], resolutions: ['480p', '768p'], audio: false,
    price: 'from $0.15 equivalent', accent: '#8b5cf6',
  },
  {
    slug: 'h3-max-image', model: 'minimax/h3-max/image-to-video', name: 'H3 Max Image to Video', shortName: 'H3 Max Image', family: 'MiniMax', mode: 'image',
    description: 'Animate a starting image—and optionally land on an ending image—with fal H3 Max.',
    strengths: ['Start-frame fidelity', 'Optional end frame', 'Fast throughput'], durations: [5, 10, 15],
    aspectRatios: COMMON_RATIOS, resolutions: ['480p', '768p'], audio: false,
    price: 'from $0.15 equivalent', accent: '#a78bfa',
  },
  {
    slug: 'seedance-2-fast', model: 'seedance-2.0-fast-text-to-video', name: 'Seedance 2 Fast', shortName: 'Seedance Fast', family: 'Seedance', mode: 'text',
    description: 'Fast text-to-video for concepts, social cuts, motion studies, and rapid iteration.',
    strengths: ['Fast iteration', 'Prompt motion', 'Social formats'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 128 Manifold credits', accent: '#37d6c5', example: EXAMPLES.seedanceFast,
  },
  {
    slug: 'seedance-2', model: 'seedance-2.0-text-to-video', name: 'Seedance 2', shortName: 'Seedance 2', family: 'Seedance', mode: 'text',
    description: 'High-fidelity text-to-video with strong instruction following and cinematic movement.',
    strengths: ['Cinematic motion', 'Prompt fidelity', 'Character action'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 161 Manifold credits', accent: '#58a6ff', example: EXAMPLES.seedance,
  },
  {
    slug: 'seedance-2-image', model: 'seedance-2.0-image-to-video', name: 'Seedance 2 Image to Video', shortName: 'Seedance Image', family: 'Seedance', mode: 'image',
    description: 'Animate a still while retaining its subject, composition, palette, and visual identity.',
    strengths: ['Image fidelity', 'Controlled motion', 'Portrait animation'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 160 Manifold credits', accent: '#ff8a65', example: EXAMPLES.seedanceImage,
  },
  {
    slug: 'seedance-2-reference-fast', model: 'seedance-2.0-fast-reference-to-video', name: 'Seedance 2 Reference Fast', shortName: 'Seedance Ref Fast', family: 'Seedance', mode: 'reference',
    description: 'Use reference media to establish a subject or style, with a faster turnaround for iteration.',
    strengths: ['Reference control', 'Fast drafts', 'Style continuity'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 128 Manifold credits', accent: '#f7c948', example: EXAMPLES.seedanceReferenceFast,
  },
  {
    slug: 'seedance-2-reference', model: 'seedance-2.0-reference-to-video', name: 'Seedance 2 Reference', shortName: 'Seedance Reference', family: 'Seedance', mode: 'reference',
    description: 'Reference-guided video generation for recurring subjects, products, and visual worlds.',
    strengths: ['Subject consistency', 'Reference guidance', 'Production quality'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 160 Manifold credits', accent: '#d18cff', example: EXAMPLES.seedanceReference,
  },
  {
    slug: 'happy-horse', model: 'alibaba/happy-horse/image-to-video', name: 'Happy Horse Image to Video', shortName: 'Happy Horse', family: 'Happy Horse', mode: 'image',
    description: 'Expressive image animation tuned for lively motion, stylized characters, and playful scenes.',
    strengths: ['Expressive motion', 'Stylized scenes', 'Strong animation'], durations: [5, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p'], audio: false, price: 'from 168 Manifold credits', accent: '#ff6b9d', example: EXAMPLES.happyHorse,
  },
  {
    slug: 'ltx-2-3', model: 'ltx-2.3-image-to-video', name: 'LTX 2.3 Image to Video', shortName: 'LTX 2.3', family: 'LTX', mode: 'image',
    description: 'Production-oriented image-to-video with coherent motion and dependable landscape output.',
    strengths: ['1080p output', 'Coherent motion', 'Production shots'], durations: [6],
    aspectRatios: COMMON_RATIOS, resolutions: ['1080p'], audio: true, price: 'from 202 Manifold credits', accent: '#8be9fd', example: EXAMPLES.ltx,
  },
  {
    slug: 'wan', model: 'wan', name: 'Wan Video', shortName: 'Wan', family: 'Wan', mode: 'text',
    description: 'Versatile text-to-video for broad visual styles, camera motion, and cost-conscious drafts.',
    strengths: ['Versatile styles', 'Good value', 'Camera prompts'], durations: [5, 6],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p'], audio: false, price: 'from 90 Manifold credits', accent: '#50fa7b', example: EXAMPLES.wan,
  },
  {
    slug: 'ltx-2', model: 'ltx-2', name: 'LTX 2 Video', shortName: 'LTX 2', family: 'LTX', mode: 'text',
    description: 'A quick, economical generator for previs, placeholders, and early editorial timing.',
    strengths: ['Low cost', 'Fast previews', 'Editorial drafts'], durations: [5, 6],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p'], audio: false, price: 'from 9 Manifold credits', accent: '#bd93f9', example: EXAMPLES.ltx2,
  },
  {
    slug: 'ra2v', model: 'ra2v', name: 'RA2V Smart Video', shortName: 'RA2V', family: 'RA2V', mode: 'text',
    description: 'A smart general-purpose route for polished text-to-video without choosing a specialized workflow.',
    strengths: ['General purpose', 'Smart routing', 'Polished output'], durations: [5, 6],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: false, price: 'from 120 Manifold credits', accent: '#ffb86c', example: EXAMPLES.ra2v,
  },
  {
    slug: 'kling-3', model: 'fal-ai/kling-video/v3/standard/text-to-video', name: 'Kling 3.0', shortName: 'Kling 3', family: 'Kling', mode: 'text',
    description: 'Kling 3.0 Standard text-to-video with cinematic motion and native synced audio.',
    strengths: ['Native audio', 'Cinematic motion', 'Multi-shot scenes'], durations: [5, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p'], audio: true, price: 'from 76 Manifold credits', accent: '#ff3417',
    guide: { slug: 'how-to-use-kling-3', title: 'How to Use Kling 3.0' },
  },
  {
    slug: 'kling-3-pro', model: 'fal-ai/kling-video/v3/pro/text-to-video', name: 'Kling 3.0 Pro', shortName: 'Kling Pro', family: 'Kling', mode: 'text',
    description: 'Kling 3.0 Pro tops the Kling lineup for fluid motion, lipsync, and filmic camera work.',
    strengths: ['Flagship quality', 'Improved lipsync', '1080p output'], durations: [5, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 101 Manifold credits', accent: '#ff5722',
    guide: { slug: 'how-to-use-kling-3-pro', title: 'How to Use Kling 3.0' },
  },
  {
    slug: 'kling-3-image', model: 'fal-ai/kling-video/v3/standard/image-to-video', name: 'Kling 3.0 Image to Video', shortName: 'Kling Image', family: 'Kling', mode: 'image',
    description: 'Animate a still with Kling 3.0 while keeping the subject locked and audio in sync.',
    strengths: ['Image fidelity', 'Native audio', 'Controlled motion'], durations: [5, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p'], audio: true, price: 'from 76 Manifold credits', accent: '#ff8a50',
    guide: { slug: 'how-to-use-kling-3-image', title: 'How to Use Kling 3.0' },
  },
  {
    slug: 'kling-26', model: 'fal-ai/kling-video/v2.6/pro/text-to-video', name: 'Kling 2.6', shortName: 'Kling 2.6', family: 'Kling', mode: 'text',
    description: 'Kling 2.6 Pro is the budget-friendly Kling route with strong motion and native audio.',
    strengths: ['Low cost', 'Reliable motion', 'Native audio'], durations: [5, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 84 Manifold credits', accent: '#ffa726',
    guide: { slug: 'how-to-use-kling-2-6', title: 'How to Use Kling 2.6' },
  },
  {
    slug: 'kling-26-image', model: 'fal-ai/kling-video/v2.6/pro/image-to-video', name: 'Kling 2.6 Image to Video', shortName: 'Kling 2.6 Image', family: 'Kling', mode: 'image',
    description: 'Bring a still to life on the affordable Kling 2.6 Pro route with synced audio.',
    strengths: ['Budget rate', 'Image animation', 'Synced audio'], durations: [5, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 84 Manifold credits', accent: '#ffb74d',
    guide: { slug: 'how-to-use-kling-26-image', title: 'How to Use Kling 2.6' },
  },
  {
    slug: 'veo-3-1-fast', model: 'fal-ai/veo3.1/fast/image-to-video', name: 'Veo 3.1 Fast', shortName: 'Veo Fast', family: 'Veo', mode: 'image',
    description: 'Google Veo 3.1 Fast animates a still with realistic motion and native audio at a low rate.',
    strengths: ['Realistic motion', 'Native audio', 'Low cost'], durations: [4, 6, 8],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 90 Manifold credits', accent: '#4285f4',
    guide: { slug: 'how-to-use-veo-3-1-fast', title: 'How to Use Veo 3.1' },
  },
  {
    slug: 'veo-3-1', model: 'fal-ai/veo3.1/image-to-video', name: 'Veo 3.1', shortName: 'Veo 3.1', family: 'Veo', mode: 'image',
    description: 'Google Veo 3.1 is the flagship for photoreal image-to-video with synchronized sound.',
    strengths: ['Photorealism', 'Synchronized audio', 'Prompt adherence'], durations: [4, 6, 8],
    aspectRatios: COMMON_RATIOS, resolutions: ['720p', '1080p'], audio: true, price: 'from 240 Manifold credits', accent: '#34a853',
    guide: { slug: 'how-to-use-veo-3-1', title: 'How to Use Veo 3.1' },
  },
  {
    slug: 'seedance-2-5', model: 'seedance-2.5-text-to-video', name: 'Seedance 2.5', shortName: 'Seedance 2.5', family: 'Seedance', mode: 'text',
    description: 'Seedance 2.5 reasons about a whole shot at once: coherent single-take clips up to 30 seconds with synced audio.',
    strengths: ['Long single takes', 'Whole-shot coherence', 'Native audio'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['480p', '720p'], audio: true, price: 'from 106 Manifold credits', accent: '#00b8a9',
    guide: { slug: 'how-to-use-seedance-2-5', title: 'How to Use Seedance 2.5' },
  },
  {
    slug: 'seedance-2-5-image', model: 'seedance-2.5-image-to-video', name: 'Seedance 2.5 Image to Video', shortName: 'Seedance 2.5 Image', family: 'Seedance', mode: 'image',
    description: 'Extend one frame into a continuous Seedance 2.5 take without multi-clip stitching drift.',
    strengths: ['One-frame start', 'Continuous motion', 'Native audio'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['480p', '720p'], audio: true, price: 'from 106 Manifold credits', accent: '#26c6da',
    guide: { slug: 'how-to-use-seedance-2-5-image', title: 'How to Use Seedance 2.5' },
  },
  {
    slug: 'seedance-2-5-reference', model: 'seedance-2.5-reference-to-video', name: 'Seedance 2.5 Reference', shortName: 'Seedance Ref 2.5', family: 'Seedance', mode: 'reference',
    description: 'Lock characters, sets, and palettes across a full take with Seedance 2.5 multimodal references.',
    strengths: ['Character lock', 'Set consistency', 'Multimodal refs'], durations: [4, 5, 8, 10],
    aspectRatios: COMMON_RATIOS, resolutions: ['480p', '720p'], audio: true, price: 'from 106 Manifold credits', accent: '#7ee8e0',
    guide: { slug: 'how-to-use-seedance-2-5-reference', title: 'How to Use Seedance 2.5' },
  },
  {
    slug: 'seedance-4k', model: 'seedance-2.0-4k-text-to-video', name: 'Seedance 4K', shortName: 'Seedance 4K', family: 'Seedance', mode: 'text',
    description: 'Seedance 2.0 pinned to native 4K output: professional-grade resolution in one step, no upscale pass.',
    strengths: ['Native 4K', 'No upscaling', 'Cinematic detail'], durations: [4, 5],
    aspectRatios: ['16:9', '9:16'], resolutions: ['4k'], audio: true, price: 'from 747 Manifold credits', accent: '#9575cd',
    guide: { slug: 'how-to-use-seedance-4k', title: 'How to Use Seedance 4K' },
  },
];

export function videoGenerator(slug: string) {
  return VIDEO_GENERATORS.find((generator) => generator.slug === slug);
}

export function generatorRequest(generator: VideoGenerator, values: {
  prompt: string;
  imageURL?: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  includeAudio: boolean;
  seed?: number;
}) {
  if (generator.manifold) {
    const size = values.resolution.toLowerCase();
    return {
      service: 'h3_video', prompt: values.prompt, duration: values.duration,
      aspect_ratio: values.aspectRatio, size, num_steps: 20,
      output_format: 'webm-av1', include_audio: values.includeAudio,
      ...(values.imageURL ? { first_frame: values.imageURL } : {}),
    };
  }
  return {
    service: 'video_generate', model: generator.model, prompt: values.prompt,
    duration: values.duration, aspect_ratio: values.aspectRatio,
    resolution: values.resolution.toLowerCase(), output_format: 'mp4',
    include_audio: values.includeAudio,
    ...(generator.mode === 'reference' && values.imageURL ? { reference_image_urls: [values.imageURL] } : {}),
    ...(generator.mode === 'image' && values.imageURL ? { image_url: values.imageURL } : {}),
    ...(values.seed !== undefined ? { seed: values.seed } : {}),
  };
}
