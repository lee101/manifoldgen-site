export type VideoControlType = 'canny' | 'depth' | 'hed' | 'mlsd' | 'pose' | 'inpaint';

export type VideoControlTool = {
  slug: string;
  type: VideoControlType;
  name: string;
  eyebrow: string;
  description: string;
  bestFor: string[];
  prompt: string;
  accent: string;
  exampleInput?: string;
  exampleOutput?: string;
};

const MODEL = 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main';

export const VIDEO_CONTROL_TOOLS: readonly VideoControlTool[] = [
  { slug: 'canny-video', type: 'canny', name: 'Canny Video Control', eyebrow: 'EDGE-GUIDED VIDEO STYLE TRANSFER', description: 'Redraw a clip while its strongest silhouettes, contours, framing, and motion stay locked to the source.', bestFor: ['Graphic silhouettes', 'Product motion', 'Strong shape changes'], prompt: 'A lone traveler in an ornate crimson coat walking through a bioluminescent fantasy city, cinematic night lighting, detailed fabric, realistic motion', accent: '#6ee7ff', exampleInput: `${MODEL}/asset/canny_tokyo_street.mp4`, exampleOutput: `${MODEL}/results/canny_tokyo_street.mp4` },
  { slug: 'depth-video', type: 'depth', name: 'Depth Video Control', eyebrow: '3D STRUCTURE VIDEO STYLE TRANSFER', description: 'Use the source clip as a moving depth map so a new world inherits its camera path, spatial layers, and subject volume.', bestFor: ['Scene replacement', 'Camera continuity', 'Volumetric restyling'], prompt: 'An ancient star mage floating inside a vast celestial library, embroidered robes, glowing constellations, cinematic volumetric light, photoreal', accent: '#9f8cff', exampleInput: `${MODEL}/asset/depth_astronaut.mp4`, exampleOutput: `${MODEL}/results/depth_astronaut.mp4` },
  { slug: 'hed-video', type: 'hed', name: 'HED Video Control', eyebrow: 'SOFT-EDGE VIDEO STYLE TRANSFER', description: 'Preserve expressive internal contours and organic detail while changing the subject, material, palette, and world.', bestFor: ['Creatures and faces', 'Organic detail', 'Illustration transfer'], prompt: 'A colossal obsidian dragon riding through a rain-soaked neon megacity, blue fire, cinematic reflections, hyper-detailed fantasy realism', accent: '#ff7aa8', exampleInput: `${MODEL}/asset/hed_trex_bmx.mp4`, exampleOutput: `${MODEL}/results/hed_trex_bmx.mp4` },
  { slug: 'mlsd-video', type: 'mlsd', name: 'MLSD Video Control', eyebrow: 'LINE + ARCHITECTURE VIDEO TRANSFER', description: 'Keep dominant straight lines and perspective geometry stable while rebuilding architecture and designed environments.', bestFor: ['Architecture', 'Interiors', 'Perspective-locked worlds'], prompt: 'A luminous elven mountain village built from white stone and living trees, waterfalls, golden hour, epic fantasy realism', accent: '#ffca72', exampleInput: `${MODEL}/asset/mlsd_village.mp4`, exampleOutput: `${MODEL}/results/mlsd_village.mp4` },
  { slug: 'pose-video', type: 'pose', name: 'Pose Video Transfer', eyebrow: 'BODY MOTION + PERFORMANCE CONTROL', description: 'Extract a performer’s pose track and generate a completely new character who follows the same body motion and timing.', bestFor: ['Character replacement', 'Dance and action', 'Mage or creature transformations'], prompt: 'A powerful forest witch performing the movement, full body, layered emerald robes and leather corset, silver hair, magical particles around her hands, moonlit ancient forest, cinematic fantasy realism', accent: '#8ff0bd', exampleInput: `${MODEL}/asset/pose_dance.mp4`, exampleOutput: 'https://manifoldgenstatic.manifoldgen.com/gallery/control-video/pose-forest-witch-v12.mp4' },
  { slug: 'video-inpainting', type: 'inpaint', name: 'Video Inpainting', eyebrow: 'MASKED TEMPORAL REGENERATION', description: 'Paint only the masked region through a clip while unmasked pixels and the original timing remain anchored.', bestFor: ['Wardrobe replacement', 'Object removal', 'Localized VFX'], prompt: 'Replace the masked coat with detailed midnight-blue mage robes embroidered with silver runes, realistic fabric motion, consistent lighting', accent: '#f394ff' },
] as const;

export function videoControlTool(slug: string) {
  return VIDEO_CONTROL_TOOLS.find((tool) => tool.slug === slug);
}
