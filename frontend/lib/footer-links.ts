import { CURATED_SEARCH_PAGES } from './search-pages';
import { tools } from './tools-catalog';

export interface FooterLink {
  href: string;
  label: string;
}

const byHref = (hrefs: string[]): FooterLink[] =>
  hrefs
    .map((href) => {
      const entry = tools.find((tool) => tool.href === href);
      return entry ? { href: entry.href, label: entry.name } : undefined;
    })
    .filter((link): link is FooterLink => Boolean(link));

export const FOOTER_TOOL_GROUPS: { title: string; links: FooterLink[]; more?: FooterLink }[] = [
  {
    title: 'Create',
    links: byHref(['/tools/make-image', '/tools/h3-image', '/tools/nano-banana', '/tools/flux-2', '/tools/gpt-image', '/tools/grok-imagine']),
    more: { href: '/tool/anima', label: 'Anima Art Studio' },
  },
  {
    title: 'Edit & enhance',
    links: byHref(['/tools/style-transfer', '/tools/relight', '/tools/inpaint', '/tools/outpaint', '/tools/image-upscale', '/tools/moodboard', '/tools/h3-image-editor']),
  },
  {
    title: 'Motion & audio',
    links: byHref(['/tools/character-animator', '/tools/cinematic-cameras', '/tools/video-background-remover', '/tools/music-generator', '/voice']),
    more: { href: '/tools', label: 'All tools' },
  },
];

export const FOOTER_VIDEO_MODEL_LINKS: FooterLink[] = [
  { href: '/tools/manifold', label: 'Manifold Video' },
  { href: '/tools/seedance-2', label: 'Seedance 2' },
  { href: '/tools/ltx-2-3', label: 'LTX 2.3' },
  { href: '/tools/wan', label: 'Wan Video' },
  { href: '/tools/ra2v', label: 'RA2V' },
];

export const FOOTER_BLOG_LINKS: FooterLink[] = [
  { href: '/blog/how-to-make-ai-video-from-script', label: 'AI video from a script' },
  { href: '/blog/how-to-make-ai-video-look-real', label: 'Make AI video look real' },
  { href: '/blog/ai-content-for-tiktok', label: 'AI content for TikTok' },
  { href: '/blog/start-faceless-channel-with-ai', label: 'Start a faceless channel' },
  { href: '/blog/consistent-characters-and-locations', label: 'Consistent characters & locations' },
  { href: '/blog/camera-movement-angles-and-lenses', label: 'Camera movement & lenses' },
  { href: '/blog/cutedsl-latent-teleportation-faster-generation', label: 'Faster generation with CuteDSL' },
  { href: '/blog/prompting-video-motion-camera-language', label: 'Prompting video motion' },
  { href: '/blog/prompting-images-composition-light', label: 'Prompting images: composition first' },
];

export const FOOTER_GUIDE_LINKS: FooterLink[] = [
  { href: '/blog/guides/why-ai-character-face-changes', label: 'Why AI faces change' },
  { href: '/blog/guides/keep-ai-character-consistent', label: 'Keep an AI character consistent' },
  { href: '/blog/guides/create-consistent-ai-influencer', label: 'Create an AI influencer' },
  { href: '/blog/guides/soul-id-explained', label: 'Soul ID explained' },
  { href: '/blog/guides/filmmaking-principles-for-ai-shots', label: 'Filmmaking principles' },
  { href: '/blog/guides/from-comfyui-to-one-click', label: 'From ComfyUI to one click' },
];

export const FOOTER_EXPLORE_QUERIES = [
  'cinematic portrait dramatic lighting',
  'film noir detective office',
  'golden hour city skyline',
  'cyberpunk street market rain',
  'elven archer misty forest',
  'space station orbiting ringed planet',
  'editorial fashion studio shoot',
  'tokyo crossing at night crowd',
  'snow leopard intense gaze',
  'gothic cathedral nave light shafts',
  'cinestill 800t neon night halation',
  'ballet dancer grand jete stage spotlight',
  'classic muscle car desert highway',
  'rustic sourdough crumb close-up',
  'watercolor misty mountain ranges',
  'anime style rooftop sunset city',
];


export const FOOTER_EXPLORE_LINKS: FooterLink[] = FOOTER_EXPLORE_QUERIES.flatMap((query) => {
  const entry = CURATED_SEARCH_PAGES.find((page) => page.query === query);
  if (!entry) return [];
  return [{ href: `/search/${entry.slug}`, label: query.replace(/\b\w/g, (c) => c.toUpperCase()) }];
});
