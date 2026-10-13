export type AnimeToolId = 'pose' | 'scene' | 'depth' | 'sketch';
export type StudioMapKind = 'skeleton' | 'mesh' | 'depth' | 'region';

export type AnimeTool = {
  id: AnimeToolId;
  slug: string;
  service: string;
  name: string;
  eyebrow: string;
  headline: string;
  blurb: string;
  priceUSD: number;
  photo: boolean;
  paint: 'region' | 'sketch' | null;
  studio: boolean;
  prompts: { label: string; text: string }[];
  examples: { prompt: string; input: string; output: string; note: string }[];
};

export const ANIME_CDN = 'https://manifoldgenstatic.manifoldgen.com/static/tools/anime-control';

export const ANIME_SIZES = [
  { label: '1024 × 1024 square', width: 1024, height: 1024 },
  { label: '768 × 1152 portrait', width: 768, height: 1152 },
  { label: '832 × 1216 tall portrait', width: 832, height: 1216 },
  { label: '1152 × 768 landscape', width: 1152, height: 768 },
  { label: '1216 × 832 wide', width: 1216, height: 832 },
  { label: '768 × 768 fast square', width: 768, height: 768 },
];

export const REGION_COLORS = ['#ff2020', '#20ff20', '#2060ff', '#ffe020', '#ff20ff', '#20ffff'];

const PROMPTS = {
  witch: '1girl, witch, large pointed hat with a silver buckle, flowing dark purple robes, glowing green potion, moonlit forest, fireflies, dramatic lighting, masterpiece, best quality, newest, absurdres',
  mage: '1boy, arcane mage, long white hair, star-embroidered indigo cloak, floating spellbook, crackling blue magic circle, ancient library tower, volumetric light, masterpiece, best quality, newest, absurdres',
  vampire: '1girl, vampire countess, pale skin, red eyes, black lace gown with crimson lining, gothic castle balcony, huge full moon, bats, masterpiece, best quality, newest, absurdres',
};

const example = (id: AnimeToolId, n: number, prompt: string, note: string) => ({
  prompt, note,
  input: `${ANIME_CDN}/${id}-${n}-input.webp`,
  output: `${ANIME_CDN}/${id}-${n}-output.webp`,
});

export const ANIME_TOOLS: Record<AnimeToolId, AnimeTool> = {
  pose: {
    id: 'pose', slug: 'anime-pose-control', service: 'anime_pose_control', name: 'Anime Pose Control',
    eyebrow: 'POSE A 3D PUPPET OR USE A PHOTO',
    headline: 'Pose it, then draw it.',
    blurb: 'Drag a 3D puppet into any pose, or drop in a photo of someone in the pose you want. Your anime character follows the pose exactly, in any style you can describe.',
    priceUSD: 0.08, photo: true, paint: null, studio: true,
    prompts: [{ label: 'Witch', text: PROMPTS.witch }, { label: 'Mage', text: PROMPTS.mage }, { label: 'Vampire', text: PROMPTS.vampire }],
    examples: [
      example('pose', 1, '1girl, witch, facing the viewer, looking at viewer, front view, tall crooked purple hat, flowing dark robes, one arm stretched out casting a green spell, other hand on chest, moonlit ruined chapel, glowing runes, masterpiece, best quality, newest, absurdres', 'Posed puppet to witch'),
      example('pose', 2, '1boy, arcane mage, white beard, star embroidered indigo cloak, holding a glowing crystal staff with both hands, ancient library tower, floating books, blue light, masterpiece, best quality, newest, absurdres', 'Posed puppet to mage'),
      example('pose', 3, '1girl, vampire countess, facing viewer, running, mid stride, one knee raised, dynamic motion, pale skin, red eyes, black gown with crimson lining, gothic garden, flying bats, blood red moon, windswept hair, masterpiece, best quality, newest, absurdres', 'Posed puppet to vampire'),
    ],
  },
  scene: {
    id: 'scene', slug: 'anime-scene-control', service: 'anime_scene_control', name: 'Anime Scene Control',
    eyebrow: 'REGIONS + 3D POSE FOR MULTI-CHARACTER SCENES',
    headline: 'Place every character.',
    blurb: 'Pose several 3D puppets or paint colour regions to decide who stands where. Both can run together for stable multi-character layouts.',
    priceUSD: 0.10, photo: false, paint: 'region', studio: true,
    prompts: [{ label: 'Witch', text: PROMPTS.witch }, { label: 'Mage', text: PROMPTS.mage }, { label: 'Vampire', text: PROMPTS.vampire }],
    examples: [
      example('scene', 1, '2girls, left girl is a young witch with a pointed hat, right girl is a vampire with red eyes and black dress, facing each other, gothic courtyard, candlelight, rose petals, masterpiece, best quality, newest, absurdres', 'Two puppets and regions to a witch and a vampire'),
      example('scene', 2, '1boy, arcane mage, silver circlet, midnight blue robes with golden runes, holding a glowing sword with both hands, ancient ruins, swirling stardust, facing viewer, masterpiece, best quality, newest, absurdres', 'Puppet and region to a mage'),
    ],
  },
  depth: {
    id: 'depth', slug: 'anime-depth-control', service: 'anime_depth_control', name: 'Anime Depth Control',
    eyebrow: 'KEEP THE SCENE GEOMETRY',
    headline: 'Keep the space, change the story.',
    blurb: 'A depth map locks in the scene: layout, perspective and foreground to background. Use a photo (depth is estimated for you) or the 3D studio.',
    priceUSD: 0.10, photo: true, paint: null, studio: true,
    prompts: [{ label: 'Mage', text: PROMPTS.mage }, { label: 'Vampire', text: PROMPTS.vampire }, { label: 'Witch', text: PROMPTS.witch }],
    examples: [
      example('depth', 1, PROMPTS.mage, 'Depth map to mage tower'),
      example('depth', 2, PROMPTS.vampire, 'Depth map to vampire balcony'),
      example('depth', 3, PROMPTS.witch, 'Depth map to witch forest'),
    ],
  },
  sketch: {
    id: 'sketch', slug: 'anime-sketch-control', service: 'anime_sketch_control', name: 'Anime Sketch Control',
    eyebrow: 'DRAW IT OR TRACE A PHOTO',
    headline: 'Sketch in, finished art out.',
    blurb: 'Scribble on the canvas or upload any image: its edges guide the drawing while your prompt sets the characters, colours and mood.',
    priceUSD: 0.12, photo: true, paint: 'sketch', studio: false,
    prompts: [{ label: 'Witch', text: PROMPTS.witch }, { label: 'Vampire', text: PROMPTS.vampire }, { label: 'Mage', text: PROMPTS.mage }],
    examples: [
      example('sketch', 1, PROMPTS.witch, 'Scribble to witch'),
      example('sketch', 2, PROMPTS.vampire, 'Edges to vampire'),
      example('sketch', 3, PROMPTS.mage, 'Scribble to mage'),
    ],
  },
};

export const ANIME_TOOL_LIST = Object.values(ANIME_TOOLS);

export function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(blob);
  });
}

export async function photoToDataURL(file: Blob, maxEdge = 1280): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function seedValue(text: string): number {
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) && value >= 0 ? value : Math.floor(Math.random() * 2_000_000_000);
}
