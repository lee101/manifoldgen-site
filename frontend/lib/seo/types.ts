export type MediaAsset = {
  url: string;
  prompt: string;
  model?: string;
  width?: number;
  height?: number;
};

export type VideoAsset = MediaAsset & { kind: 'video' };
export type ImageAsset = MediaAsset & { kind: 'image' };

export type MediaBundle = {
  images: ImageAsset[];
  videos: VideoAsset[];
};

export type ManifestEntry = {
  images?: { url: string; prompt: string; model?: string; width?: number; height?: number }[];
  videos?: { url: string; prompt: string }[];
};

export type Faq = { q: string; a: string };

export type VideoModelRef = {
  slug: string;
  name: string;
  shortName: string;
  vendor: string;
  tagline: string;
  description: string;
  bestFor: string[];
  modes: ('text' | 'image' | 'reference')[];
  resolutions: string[];
  durations: string;
  audio: boolean;
  priceFrom: string;
  priceFromUSD: number;
  toolHrefs: { label: string; href: string }[];
  apiHref?: string;
  accent: string;
  mediaKey: string;
  verdictFor: string;
};

export type UseCase = {
  slug: string;
  h1: string;
  title: string;
  metaDescription: string;
  intro: string;
  audience: string;
  workflow: { step: string; detail: string }[];
  recommendedModels: { slug: string; why: string }[];
  prompts: string[];
  faqs: Faq[];
  mediaKey: string;
};

export type ComparisonSide = {
  modelSlug: string;
  displayName: string;
  bullets: string[];
};

export type Comparison = {
  slug: string;
  kind: 'video' | 'image';
  h1: string;
  title: string;
  metaDescription: string;
  question: string;
  verdict: string;
  a: ComparisonSide;
  b: ComparisonSide;
  specRows: { label: string; a: string; b: string }[];
  samePrompt?: {
    prompt: string;
    note: string;
    assets: { modelSlug: string; url: string; isVideo?: boolean }[];
  };
  chooseA: string[];
  chooseB: string[];
  faqs: Faq[];
  mediaKey: string;
};

export type BestTopic = {
  slug: string;
  question: string;
  h1: string;
  title: string;
  metaDescription: string;
  directAnswer: string;
  evidence: { claim: string; support: string }[];
  table?: { columns: string[]; rows: string[][] };
  runnersUp?: string[];
  faqs: Faq[];
  mediaKey: string;
};
