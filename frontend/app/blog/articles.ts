export type BlogArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
};

export const articles: BlogArticle[] = [
  {
    slug: 'cutedsl-latent-teleportation-faster-generation',
    category: 'Systems',
    title: 'CuteDSL, latent teleportation, and the shortest path to faster generation',
    excerpt: 'A practical mental model for moving work through a generative pipeline without paying the full cost of rebuilding every intermediate representation.',
    readTime: '8 min read',
  },
  {
    slug: 'prompting-video-motion-camera-language',
    category: 'Prompt craft',
    title: 'Prompting video: describe the shot, not a pile of adjectives',
    excerpt: 'A repeatable structure for turning a visual idea into camera motion, subject action, lighting, and a clean ending.',
    readTime: '6 min read',
  },
  {
    slug: 'prompting-images-composition-light',
    category: 'Prompt craft',
    title: 'Prompting images: composition first, detail second',
    excerpt: 'Use subject, framing, lens, light, and material cues in the order an image model can actually use them.',
    readTime: '5 min read',
  },
];

export function articleBySlug(slug: string) {
  return articles.find((article) => article.slug === slug);
}
