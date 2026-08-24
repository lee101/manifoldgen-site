export type GuideBlock =
  | { t: 'p'; text: string }
  | { t: 'h2'; text: string }
  | { t: 'h3'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'steps'; items: string[] }
  | { t: 'prompt'; label?: string; body: string }
  | { t: 'callout'; tone?: 'violet' | 'teal'; title: string; body: string };

export type GuideSectionId = 'foundations' | 'personas' | 'continuity' | 'craft' | 'money';

export type Guide = {
  slug: string;
  section: GuideSectionId;
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  updated: string;
  blocks: GuideBlock[];
};
