export type ToolCard = {
  href: string;
  name: string;
  label: string;
  copy: string;
  kind: 'image' | 'video' | 'audio';
  src: string;
  meta: string;
};

export const TOOL_CDN = 'https://manifoldgenstatic.manifoldgen.com/gallery';

export const tools: readonly ToolCard[] = [
  { href: '/tool/anima', name: 'Anima Art Studio', label: 'CHARACTER ART', copy: 'Anime-native character design and polished illustration.', kind: 'image', src: '/examples/anima/celestial-cartographer.png', meta: 'Anima-2.9B · seed 18467291' },
  { href: '/tools/make-image', name: 'Make Image', label: 'BULK TEXT TO IMAGE', copy: 'Generate many variants at once across Z-Image, RA1, and R1, one prompt per line.', kind: 'image', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_20260816.png`, meta: 'Z-Image · RA1 · R1 · multi-variant' },
  { href: '/tools/cinematic-cameras', name: 'Cinematic Cameras', label: 'CAMERA CONTROL', copy: 'Image generation steered by dolly, crane, macro, and lens-direction presets.', kind: 'image', src: `${TOOL_CDN}/originals/d9e1b11a3ec6e66f_22e5d455.webp`, meta: 'Z-Image · GPT Image 2 · camera presets' },
  { href: '/tools/relight', name: 'Relight', label: 'LIGHTING CONTROL', copy: 'Move the key light. Adjust direction and mood of any photo with IC-Light v2.', kind: 'image', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_greenhouse_20260816.png`, meta: 'fal IC-Light v2 · directional relighting' },
  { href: '/tools/inpaint', name: 'Inpaint', label: 'MASKED EDITING', copy: 'Brush an area, describe the change—everything outside your mask stays pixel-identical.', kind: 'image', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_20260816.png`, meta: 'GPT Image 2 edit · feathered mask composite' },
  { href: '/tools/image-upscale', name: 'Image Upscale', label: 'ENHANCE', copy: '2x creative upscaling that recovers texture and detail without plastic artifacts.', kind: 'image', src: `${TOOL_CDN}/originals/ea0d66c5b19b8439_64411e9f.webp`, meta: 'fal creative-upscaler · 2x' },
  { href: '/tools/outpaint', name: 'Extend Image', label: 'OUTPAINTING', copy: 'Grow the canvas in any direction or zoom out while the scene keeps extending.', kind: 'image', src: `${TOOL_CDN}/originals/64171ef03cb954ad_378dad88.webp`, meta: 'extend-image · expand or zoom out' },
  { href: '/tools/moodboard', name: 'Soul Moodboard', label: 'REFERENCES', copy: 'Drop 2–6 references and fuse them into one focused visual direction.', kind: 'image', src: `${TOOL_CDN}/originals/e681e42f9ad635c1_45a810ec.webp`, meta: 'Nano Banana 2 · GPT Image 2 · multi-reference' },
  { href: '/tools/nano-banana', name: 'Nano Banana 2', label: 'IMAGE MODEL', copy: 'Google Gemini-flash image generation and reference editing at speed.', kind: 'image', src: `${TOOL_CDN}/originals/2cd11733526df0ed_6e875ea4.webp`, meta: 'or/gemini-3.1-flash-image via OpenPaths' },
  { href: '/tools/grok-imagine', name: 'Grok Imagine 2.0', label: 'IMAGE MODEL', copy: 'High-resolution image generation by xAI with 2K quality tier.', kind: 'image', src: `${TOOL_CDN}/originals/8393bf4dfc931639_c83b5040.webp`, meta: 'grok-imagine-image · 1K/2K' },
  { href: '/tools/flux-2', name: 'FLUX.2', label: 'IMAGE MODEL', copy: 'Speed-optimized detail from Klein, Dev, and Pro lanes.', kind: 'image', src: `${TOOL_CDN}/originals/ea0d66c5b19b8439_64411e9f.webp`, meta: 'FLUX.2 Klein · Dev · Pro' },
  { href: '/tools/gpt-image', name: 'GPT Image 2', label: 'IMAGE MODEL', copy: '4K-capable images with near-perfect text rendering.', kind: 'image', src: `${TOOL_CDN}/originals/d9e1b11a3ec6e66f_22e5d455.webp`, meta: 'gpt-image-2 · always metered' },
  { href: '/tools/style-transfer', name: 'Style Transfer', label: 'IMAGE EDITING', copy: 'Upload a source image, describe a new visual world, and keep the composition while the edit runs.', kind: 'image', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_20260816.png`, meta: 'OpenPaths image-edit · GPT Image 2 route' },
  { href: '/tools/h3-image', name: 'H3 Image', label: 'TEXT TO IMAGE', copy: 'High-detail finished frames from the H3 visual world model.', kind: 'image', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_20260816.png`, meta: 'MiniMax H3 · real generation' },
  { href: '/tools/h3-image-editor', name: 'H3 Image Editor', label: 'REFERENCE EDIT', copy: 'Regenerate a source while preserving identity and geometry.', kind: 'image', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_greenhouse_20260816.png`, meta: 'H3 REF2VA · real edit' },
  { href: '/tools/character-animator', name: 'Character Animator', label: 'IMAGE + MOTION', copy: 'Transfer body movement, expression, and timing from a driving clip.', kind: 'video', src: `${TOOL_CDN}/videos/wan_animate_cartographer_standard_5s_20260816.mp4`, meta: 'Wan Animate 2 · real 5s Standard output' },
  { href: '/tools/pose-video', name: 'Pose Video Transfer', label: 'CONTROL VIDEO', copy: 'Turn a driving performance into a witch, mage, creature, or completely new character.', kind: 'video', src: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main/asset/pose_dance.mp4', meta: 'Pose motion control · ordinary video or prepared pass' },
  { href: '/tools/depth-video', name: 'Depth Video Control', label: 'VIDEO STYLE TRANSFER', copy: 'Rebuild a clip while preserving moving depth, camera path, and spatial volume.', kind: 'video', src: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main/asset/depth_astronaut.mp4', meta: 'Depth control · ordinary video or prepared pass' },
  { href: '/tools/canny-video', name: 'Canny Video Control', label: 'VIDEO STYLE TRANSFER', copy: 'Keep silhouettes and motion locked while redrawing every frame in a new world.', kind: 'video', src: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main/asset/canny_tokyo_street.mp4', meta: 'Canny edge control · ordinary video or prepared pass' },
  { href: '/tools/hed-video', name: 'HED Video Control', label: 'VIDEO STYLE TRANSFER', copy: 'Preserve soft organic contours for expressive creature, face, and illustration transfer.', kind: 'video', src: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main/asset/hed_trex_bmx.mp4', meta: 'HED contour control · ordinary video or prepared pass' },
  { href: '/tools/mlsd-video', name: 'MLSD Video Control', label: 'ARCHITECTURE CONTROL', copy: 'Hold straight lines and perspective stable while transforming designed spaces.', kind: 'video', src: 'https://huggingface.co/alibaba-pai/MiniMax-H3-Fun-Controlnet-Union/resolve/main/asset/mlsd_village.mp4', meta: 'MLSD line control · ordinary video or prepared pass' },
  { href: '/tools/video-background-remover', name: 'Video Background Remover', label: 'VIDEO UTILITY', copy: 'Create a transparent foreground while retaining original pixels.', kind: 'video', src: `${TOOL_CDN}/service_netw/video-background/6f378c9b-1c0d-4aad-9f1a-e41f9436fca5.webm`, meta: 'RVM · real transparent output' },
  { href: '/tools/music-generator', name: 'Song Generator', label: 'MUSIC', copy: 'Full songs with vocals and instrumental from a caption and your lyrics.', kind: 'audio', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_20260816.png`, meta: 'MiniMax-Music3 · 32 kHz stereo' },
  { href: '/voice', name: 'Voice Studio', label: 'TEXT TO SPEECH', copy: 'Expressive narration, dialogue, and audio scenes from a script across seven voice models.', kind: 'audio', src: `${TOOL_CDN}/originals/h3_dev_glass_hummingbird_greenhouse_20260816.png`, meta: 'Seed Audio · ElevenLabs v3 · Gemini Voice' },
];
