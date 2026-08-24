// Generated benchmark registry for the SEO surface (/leaderboard, /compare/*, /best/*).
// Editorial category rankings are ours; every clip is a real ManifoldGen generation
// produced by scripts/seo_bench.py (same prompt across all models).

export type BenchModel = {
  key: string;
  name: string;
  family: string;
  toolSlug?: string;
  accent: string;
  blurb: string;
};

export type BenchCategory = {
  key: string;
  label: string;
  tagline: string;
  prompt: string;
  ranking: string[];
  why: Partial<Record<string, string>>;
};

import { BENCH_RESULTS, type BenchResult } from './bench-results';

export const MODELS: BenchModel[] = [
  {
    key: 'manifold-h3',
    name: 'Manifold H3',
    family: 'Manifold',
    toolSlug: 'manifold',
    accent: '#b18cff',
    blurb: 'ManifoldGen\u2019s hosted H3 pipeline. Strong VFX imagination, stylized worlds, and native audio support.',
  },
  {
    key: 'seedance',
    name: 'Seedance 2',
    family: 'Seedance',
    toolSlug: 'seedance-2',
    accent: '#58a6ff',
    blurb: 'Best all-round cinematic quality: human motion, camera language, and prompt fidelity.',
  },
  {
    key: 'seedance-fast',
    name: 'Seedance 2 Fast',
    family: 'Seedance',
    toolSlug: 'seedance-2-fast',
    accent: '#37d6c5',
    blurb: 'The fast Seedance tier \u2014 most of the quality at a lower price, ideal for iteration.',
  },
  {
    key: 'ltx-2',
    name: 'LTX 2',
    family: 'LTX',
    toolSlug: 'ltx-2',
    accent: '#f7c948',
    blurb: 'Fastest full generation round-trip on ManifoldGen; great stylized looks and product shots.',
  },
  {
    key: 'wan',
    name: 'Wan',
    family: 'Wan',
    toolSlug: 'wan',
    accent: '#ff8a65',
    blurb: 'Open-weights workhorse with dependable motion at a mid-tier price.',
  },
];

export const CATEGORIES: BenchCategory[] = [
  {
    key: 'human-motion',
    label: 'Human Motion',
    tagline: 'Dancers, athletes, realistic people moving',
    prompt:
      'A dancer in a flowing red dress performs contemporary dance on a rain-slicked city street at night, neon reflections on wet pavement, slow-motion fabric trails, cinematic tracking shot',
    ranking: ['seedance', 'manifold-h3', 'wan', 'ltx-2', 'seedance-fast'],
    why: {
      seedance: 'Cleanest fabric dynamics and footwork; the neon reflections stay physically plausible.',
      'manifold-h3': 'Expressive pose changes, slightly softer detail on hands.',
      wan: 'Solid rhythm but stiffer transitions between poses.',
      'ltx-2': 'Readable motion, some limb smearing during fast spins.',
      'seedance-fast': 'Fast draft of the same scene with less fine-grained motion.',
    },
  },
  {
    key: 'vfx',
    label: 'VFX',
    tagline: 'Impossible scenes that still look filmed',
    prompt:
      'A massive whale swims through clouds above a remote mountain village at sunset, volumetric god rays, glowing mist trailing behind it, epic fantasy VFX shot',
    ranking: ['manifold-h3', 'seedance', 'ltx-2', 'wan', 'seedance-fast'],
    why: {
      'manifold-h3': 'Most cinematic composition: believable whale mass, layered god rays, glowing mist trail.',
      seedance: 'Beautiful light and scale, slightly more conservative camera.',
      'ltx-2': 'Strong colors; whale anatomy drifts a little near the tail.',
      wan: 'Good atmosphere, less volumetric depth.',
      'seedance-fast': 'Quick take with flatter lighting.',
    },
  },
  {
    key: 'cinematic',
    label: 'Cinematic Landscape',
    tagline: 'Drone shots, landscapes, golden-hour drama',
    prompt:
      'Drone shot flying low over an endless lavender field at golden hour, wind rippling through the flowers, distant storm clouds on the horizon, anamorphic lens flare',
    ranking: ['seedance', 'ltx-2', 'manifold-h3', 'wan', 'seedance-fast'],
    why: {
      seedance: 'Stable parallax, convincing flower motion, filmic flare handling.',
      'ltx-2': 'Sweeping move with rich color grade; minor texture repetition.',
      'manifold-h3': 'Dramatic sky and depth, slightly stronger stylization.',
      wan: 'Smooth flight, gentler wind response in the field.',
      'seedance-fast': 'Fast draft with simpler cloud detail.',
    },
  },
  {
    key: 'product',
    label: 'Product Shot',
    tagline: 'E-commerce, ads, studio product turns',
    prompt:
      'A sleek matte-black smartwatch rotates slowly on a reflective obsidian pedestal, dramatic studio rim lighting, macro detail on the textured crown, premium product commercial',
    ranking: ['seedance', 'ltx-2', 'seedance-fast', 'manifold-h3', 'wan'],
    why: {
      seedance: 'Sharpest hardware detail; reflections behave like real glass.',
      'ltx-2': 'Clean rotation and premium lighting at the lowest cost per clip.',
      'seedance-fast': 'Crisp but with a slightly faster, less controlled turn.',
      'manifold-h3': 'Moody look, crown macro softens briefly.',
      wan: 'Correct concept, least refined specular highlights.',
    },
  },
  {
    key: 'stylized',
    label: 'Stylized World',
    tagline: 'Anime, paper-craft, illustration in motion',
    prompt:
      'A paper-craft origami fox trots through a miniature cardboard forest, tiny paper leaves drift through the air, tilt-shift macro lens, warm afternoon light',
    ranking: ['ltx-2', 'manifold-h3', 'seedance-fast', 'seedance', 'wan'],
    why: {
      'ltx-2': 'Charming material feel: paper grain, tilt-shift falloff, playful gait.',
      'manifold-h3': 'Rich miniature world-building; fox design drifts between shots.',
      'seedance-fast': 'Neat composition at draft cost.',
      seedance: 'Polished render, more literal interpretation of the brief.',
      wan: 'Readable scene, least tactile materials.',
    },
  },
  {
    key: 'camera-motion',
    label: 'Camera Motion',
    tagline: 'Dollies, push-ins, one continuous shot',
    prompt:
      'One continuous dolly shot pushing through the open door of a cozy late-night ramen shop toward a steaming bowl, steam swirling, shallow depth of field, warm practical lights',
    ranking: ['seedance', 'manifold-h3', 'ltx-2', 'wan', 'seedance-fast'],
    why: {
      seedance: 'The only model that holds one unbroken move from street to bowl without a cut.',
      'manifold-h3': 'Confident push-in with beautiful steam simulation.',
      'ltx-2': 'Smooth move, small spatial jump mid-shot.',
      wan: 'Steady but slower-feeling dolly.',
      'seedance-fast': 'Draft-speed version with simpler depth cues.',
    },
  },
];

const RANK_POINTS = [6, 5, 4, 3, 2];

export function resultFor(categoryKey: string, modelKey: string): BenchResult | undefined {
  return BENCH_RESULTS[`${categoryKey}:${modelKey}`];
}

export function completedClip(categoryKey: string, modelKey: string) {
  const result = resultFor(categoryKey, modelKey);
  return result?.status === 'completed' && result.video_url ? result : undefined;
}

export function rankedModels(category: BenchCategory): BenchModel[] {
  return category.ranking
    .map((key) => MODELS.find((model) => model.key === key))
    .filter((model): model is BenchModel => Boolean(model));
}

export function modelScore(modelKey: string): number {
  let points = 0;
  for (const category of CATEGORIES) {
    const position = category.ranking.indexOf(modelKey);
    if (position >= 0 && position < RANK_POINTS.length) points += RANK_POINTS[position];
  }
  return points;
}

export function leaderboardModels(): Array<BenchModel & { score: number }> {
  return MODELS.map((model) => ({ ...model, score: modelScore(model.key) })).sort(
    (a, b) => b.score - a.score,
  );
}

/** Median measured wall-clock seconds across this model's completed generations. */
export function medianSpeed(modelKey: string): number | null {
  const samples = Object.entries(BENCH_RESULTS)
    .filter(([key, value]) => value.status === 'completed' && value.wall_seconds && key.endsWith(`:${modelKey}`))
    .map(([, value]) => value.wall_seconds as number)
    .sort((a, b) => a - b);
  if (!samples.length) return null;
  const mid = Math.floor(samples.length / 2);
  return samples.length % 2 ? samples[mid] : Math.round((samples[mid - 1] + samples[mid]) / 2);
}

export function comparePairs(): Array<{ slug: string; a: BenchModel; b: BenchModel }> {
  const pairs: Array<{ slug: string; a: BenchModel; b: BenchModel }> = [];
  for (let i = 0; i < MODELS.length; i += 1) {
    for (let j = i + 1; j < MODELS.length; j += 1) {
      pairs.push({ slug: `${MODELS[i].key}-vs-${MODELS[j].key}`, a: MODELS[i], b: MODELS[j] });
    }
  }
  return pairs;
}
