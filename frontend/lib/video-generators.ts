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
