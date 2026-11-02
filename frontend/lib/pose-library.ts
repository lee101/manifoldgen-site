export type PoseView = 'front' | 'diag' | 'side' | 'above' | 'below';
export type PoseMap = 'image' | 'depth' | 'skeleton';

export type PoseRecord = {
  id: string;
  source: 'shisei' | 'generated';
  series: string;
  name: string;
  category: string;
  description: string;
  bodies?: string[];
  people: number;
  framing: 'full' | 'upper';
  nsfw: boolean;
  views: Partial<Record<PoseView, string>>;
  depth?: Partial<Record<PoseView, string>>;
  skeleton?: Partial<Record<PoseView, string>>;
  photos?: Partial<Record<PoseView, string>>;
  pose?: string;
  has_pose?: boolean;
  license: string;
  credit: string;
  similarity?: number;
};

export type PoseSearchResponse = { results: PoseRecord[]; total: number; mode: 'semantic' | 'keyword' | 'browse'; limit: number; offset: number };
export type PoseFacets = { total: number; categories: Record<string, number>; sources: Record<string, number>; bodies: Record<string, number> };

export const VIEW_LABELS: Record<PoseView, string> = { front: 'Front', diag: '3/4', side: 'Side', above: 'High', below: 'Low' };
export const VIEW_ORDER: PoseView[] = ['front', 'diag', 'side', 'above', 'below'];

export const POSE_STYLES: { id: string; label: string; prompt: string }[] = [
  { id: 'anime', label: 'Anime', prompt: 'clean anime illustration, cel shading, vivid colours' },
  { id: 'ghibli', label: 'Watercolour', prompt: 'soft hand-painted watercolour animation film style, warm natural light' },
  { id: 'photo', label: 'Photoreal', prompt: 'photograph, natural skin and fabric, studio lighting, 85mm lens' },
  { id: '3d', label: '3D render', prompt: 'stylised 3D animated film render, soft global illumination' },
  { id: 'comic', label: 'Comic ink', prompt: 'comic book inks with halftone shading and bold outlines' },
  { id: 'oil', label: 'Oil painting', prompt: 'expressive oil painting, visible brush strokes, rich colour' },
  { id: 'concept', label: 'Concept art', prompt: 'detailed fantasy concept art, dramatic lighting' },
];

export function poseSearchURL(p: { q?: string; source?: string; category?: string; body?: string; people?: number; offset?: number; limit?: number; allowNSFW?: boolean }): string {
  const u = new URLSearchParams();
  if (p.q) u.set('q', p.q);
  if (p.source) u.set('source', p.source);
  if (p.category) u.set('category', p.category);
  if (p.body) u.set('body', p.body);
  if (p.people) u.set('people', String(p.people));
  if (p.offset) u.set('offset', String(p.offset));
  u.set('limit', String(p.limit ?? 48));
  if (p.allowNSFW) u.set('allow_nsfw', 'true');
  return `/api/poses/search?${u}`;
}

export function poseMapURL(p: PoseRecord, view: PoseView, map: PoseMap): string | undefined {
  if (map === 'depth') return p.depth?.[view];
  if (map === 'skeleton') return p.skeleton?.[view];
  return p.views[view];
}

export function availableViews(p: PoseRecord): PoseView[] {
  return VIEW_ORDER.filter((v) => p.views[v]);
}

export function absoluteURL(url: string): string {
  return /^https?:/i.test(url) ? url : `${window.location.origin}${url}`;
}

export function styledEditPrompt(subject: string, style: string): string {
  return `Redraw this posed mannequin as ${subject.trim() || 'a character'}. Keep the exact pose, limb positions, camera angle and body proportions of the mannequin. Replace the mannequin with a real character wearing fitting clothes, in a matching background. Style: ${style}.`;
}
