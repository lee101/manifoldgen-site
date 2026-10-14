export type ProductionService = 'destruction-studio' | 'exploded-view' | 'toon-shader' | 'blender-scene' | 'image-to-3d' | 'vectorize' | 'shot-cleanup';

export type ProductionParams = Record<string, unknown>;

export type ProductionRequest = {
  service: ProductionService;
  image_url?: string;
  model_url?: string;
  model_urls?: string[];
  video_url?: string;
  prompt?: string;
  duration?: number;
  params: ProductionParams;
};

export type SourceMode = 'preset' | 'demo' | 'upload' | 'photo';

type Option = readonly [string, string];

export type ProductionControl = {
  key: string;
  label: string;
  advanced?: boolean;
  hint?: string;
} & (
  | { type: 'select'; options: readonly Option[]; default: string }
  | { type: 'range'; min: number; max: number; step: number; default: number; unit?: string }
  | { type: 'toggle'; default: boolean }
  | { type: 'color'; default: string }
  | { type: 'palette'; default: string[] }
  | { type: 'seed'; default: string }
);

export type ProductionDemo = { caption: string };

export type ProductionTool = {
  slug: string;
  service: ProductionService;
  mcp: string;
  name: string;
  kicker: string;
  headline: string;
  blurb: string;
  metaTitle: string;
  metaDescription: string;
  kind: 'video' | 'image';
  input: 'model' | 'scene' | 'image' | 'video';
  sources?: readonly SourceMode[];
  presets?: readonly Option[];
  demoModels?: readonly Option[];
  controls: readonly ProductionControl[];
  outputs: string;
  inputsDoc: string;
  priceDoc: string;
  demoInputExt?: string;
  demoOutputExt?: string;
  demos: readonly ProductionDemo[];
  runLabel: string;
};

export const PRODKIT_PRICES = {
  base: { 'destruction-studio': 0.40, 'exploded-view': 0.40, 'toon-shader': 0.30, 'blender-scene': 0.30, 'image-to-3d': 0.06, vectorize: 0.02, 'shot-cleanup': 0.24 } as Record<ProductionService, number>,
  photoTo3D: 0.06,
  highQuality: 0.20,
  image3DHigh: 0.45,
  vectorAI: 0.03,
  eraserPerSecond: 0.24,
  eraserMaxSeconds: 30,
  eraserChunkSeconds: 4.8,
} as const;

const BLENDER: readonly ProductionService[] = ['destruction-studio', 'exploded-view', 'toon-shader', 'blender-scene'];

export const isBlenderService = (service: ProductionService) => BLENDER.includes(service);

const lower = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';

export function productionPriceUSD(req: ProductionRequest): number {
  const base = PRODKIT_PRICES.base[req.service];
  if (base === undefined) return 0;
  const high = lower(req.params.quality) === 'high';
  let price = 0;
  if (isBlenderService(req.service)) {
    price = base;
    if (req.service !== 'blender-scene' && !(req.model_url || '').trim() && (req.image_url || '').trim()) price += PRODKIT_PRICES.photoTo3D;
    if (high) price += PRODKIT_PRICES.highQuality;
  } else if (req.service === 'image-to-3d') {
    price = high ? PRODKIT_PRICES.image3DHigh : base;
  } else if (req.service === 'vectorize') {
    price = lower(req.params.engine) === 'ai' ? PRODKIT_PRICES.vectorAI : base;
  } else if (req.service === 'shot-cleanup') {
    const seconds = req.duration && req.duration > 0 ? req.duration : 5;
    price = PRODKIT_PRICES.eraserPerSecond * Math.ceil(Math.min(seconds, PRODKIT_PRICES.eraserMaxSeconds));
  }
  return Math.round(price * 100) / 100;
}

export const PRODUCTION_DEMO_BASE = 'https://manifoldgenstatic.manifoldgen.com/static/tools/production';

export function demoMedia(tool: Pick<ProductionTool, 'slug' | 'demoInputExt' | 'demoOutputExt'>, index: number) {
  const root = `${PRODUCTION_DEMO_BASE}/${tool.slug}/${index + 1}`;
  return { input: `${root}-input.${tool.demoInputExt || 'jpg'}`, output: `${root}-output.${tool.demoOutputExt || 'mp4'}`, poster: `${root}-poster.jpg` };
}

export const posterPlaceholder = (slug: string) => `${PRODUCTION_DEMO_BASE}/${slug}/1-poster.jpg`;

const ASPECTS: readonly Option[] = [['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1']];
const BACKGROUNDS: readonly Option[] = [['studio', 'Studio'], ['dark', 'Dark'], ['sky', 'Sky'], ['white', 'White']];

const renderControls: readonly ProductionControl[] = [
  { key: 'quality', label: 'Quality', type: 'select', options: [['draft', 'Draft · fast'], ['standard', 'Standard · 720p'], ['high', 'High · 1080p +$0.20']], default: 'standard' },
  { key: 'duration', label: 'Duration', type: 'range', min: 2, max: 8, step: 1, default: 5, unit: 's' },
  { key: 'aspect', label: 'Aspect', type: 'select', options: ASPECTS, default: '16:9', advanced: true },
  { key: 'background', label: 'Background', type: 'select', options: BACKGROUNDS, default: 'studio', advanced: true },
  { key: 'seed', label: 'Seed', type: 'seed', default: '', advanced: true, hint: 'Blank = random' },
];

const demos3 = (a: string, b: string, c: string): ProductionDemo[] => [{ caption: a }, { caption: b }, { caption: c }];

export const PRODUCTION_TOOLS: readonly ProductionTool[] = [
  {
    slug: 'destruction-studio', service: 'destruction-studio', mcp: 'blender_destruction', name: 'Destruction Studio', kicker: 'RIGID-BODY DESTRUCTION · EDITABLE .BLEND',
    headline: 'Shatter anything, physically.', blurb: 'Fracture a preset, 3D text, your model or a photo, then simulate debris and dust in hosted Blender. Get the MP4, a poster and the baked .blend.',
    metaTitle: 'Destruction Studio: Blender Fracture Simulation Online — ManifoldGen', metaDescription: 'Simulate cinematic rigid-body destruction with debris and dust in hosted Blender. Upload a model, type text or use a photo. MP4 + editable .blend from $0.40.',
    kind: 'video', input: 'model', sources: ['preset', 'upload', 'photo'],
    presets: [['tower', 'Tower'], ['wall', 'Wall'], ['pillar', 'Pillar'], ['statue', 'Statue'], ['house', 'House'], ['text', '3D text']],
    controls: [
      { key: 'material', label: 'Material', type: 'select', options: [['concrete', 'Concrete'], ['brick', 'Brick'], ['glass', 'Glass'], ['wood', 'Wood'], ['marble', 'Marble'], ['ice', 'Ice']], default: 'concrete' },
      { key: 'impact', label: 'Impact', type: 'select', options: [['ball', 'Wrecking ball'], ['explosion', 'Explosion'], ['quake', 'Quake'], ['slice', 'Slice']], default: 'ball' },
      { key: 'pieces', label: 'Pieces', type: 'range', min: 12, max: 160, step: 4, default: 64 },
      { key: 'slowmo', label: 'Slow motion', type: 'toggle', default: true },
      { key: 'dust', label: 'Dust', type: 'toggle', default: true },
      ...renderControls,
    ],
    outputs: 'video_url, poster_url, blend_url', inputsDoc: 'params.subject | model_url | image_url', priceDoc: '$0.40 (+$0.06 photo→3D, +$0.20 high)',
    demos: demos3('Concrete tower · wrecking ball', 'Glass text · explosion', 'Photo of a statue → marble fracture'), runLabel: 'Simulate destruction',
  },
  {
    slug: 'exploded-view', service: 'exploded-view', mcp: 'blender_exploded_view', name: 'Exploded View', kicker: 'EXPLODE · ASSEMBLE · TURNTABLE',
    headline: 'Exploded views without rigging.', blurb: 'Split a model into parts and animate it exploding or assembling with clean product staging. Upload a model, use a photo or try a demo.',
    metaTitle: 'Exploded View Animation Generator (Blender) — ManifoldGen', metaDescription: 'Animate product exploded views and assembly sequences from a 3D model or photo in hosted Blender. MP4, poster and editable .blend from $0.40.',
    kind: 'video', input: 'model', sources: ['demo', 'upload', 'photo'],
    demoModels: [['headphones', 'Headphones'], ['camera', 'Camera'], ['watch', 'Watch']],
    controls: [
      { key: 'mode', label: 'Mode', type: 'select', options: [['explode_assemble', 'Round trip'], ['explode', 'Explode'], ['assemble', 'Assemble']], default: 'explode_assemble' },
      { key: 'split', label: 'Split parts by', type: 'select', options: [['auto', 'Auto'], ['loose', 'Loose parts'], ['material', 'Material'], ['slices', 'Slices']], default: 'auto' },
      { key: 'axis', label: 'Axis', type: 'select', options: [['radial', 'Radial'], ['vertical', 'Vertical'], ['forward', 'Forward']], default: 'radial' },
      { key: 'spread', label: 'Spread', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1.2, unit: '×' },
      { key: 'stagger', label: 'Stagger', type: 'range', min: 0, max: 1, step: 0.05, default: 0.3 },
      { key: 'turntable', label: 'Turntable', type: 'toggle', default: true },
      { key: 'guides', label: 'Guide lines', type: 'toggle', default: false, advanced: true },
      ...renderControls,
    ],
    outputs: 'video_url, poster_url, blend_url', inputsDoc: 'model_url | image_url | params.demo', priceDoc: '$0.40 (+$0.06 photo→3D, +$0.20 high)',
    demos: demos3('Headphones · radial explode', 'Camera · assemble', 'Watch · vertical with guides'), runLabel: 'Render exploded view',
  },
  {
    slug: 'toon-shader', service: 'toon-shader', mcp: 'blender_toon_shader', name: 'Toon Shader', kicker: 'CEL · ANIME · COMIC · OUTLINES',
    headline: 'Cel-shade any model.', blurb: 'Apply toon materials with bands, rim light and outlines, then render a turntable. The .blend keeps every material editable.',
    metaTitle: 'Toon Shader: Cel-Shade 3D Models Online — ManifoldGen', metaDescription: 'Turn any 3D model or photo into a cel, anime or comic toon render with outlines and a custom palette. Turntable MP4 and editable .blend from $0.30.',
    kind: 'video', input: 'model', sources: ['demo', 'upload', 'photo'],
    demoModels: [['character', 'Character'], ['car', 'Car'], ['helmet', 'Helmet']],
    controls: [
      { key: 'style', label: 'Style', type: 'select', options: [['cel', 'Cel'], ['anime', 'Anime'], ['comic', 'Comic'], ['flat', 'Flat']], default: 'cel' },
      { key: 'bands', label: 'Shading bands', type: 'range', min: 2, max: 5, step: 1, default: 3 },
      { key: 'outline_width', label: 'Outline width', type: 'range', min: 0, max: 10, step: 0.5, default: 3 },
      { key: 'outline_color', label: 'Outline color', type: 'color', default: '#111111' },
      { key: 'rim', label: 'Rim light', type: 'toggle', default: true },
      { key: 'turntable', label: 'Turntable', type: 'toggle', default: true },
      { key: 'palette', label: 'Palette', type: 'palette', default: [], advanced: true, hint: 'Up to 8. Empty keeps source colors.' },
      ...renderControls,
    ],
    outputs: 'video_url, poster_url, blend_url', inputsDoc: 'model_url | image_url | params.demo', priceDoc: '$0.30 (+$0.06 photo→3D, +$0.20 high)',
    demos: demos3('Character · anime', 'Car · comic outlines', 'Helmet · flat palette'), runLabel: 'Render toon turntable',
  },
  {
    slug: 'blender-scene', service: 'blender-scene', mcp: 'blender_render_scene', name: 'Remote Blender', kicker: 'SCENE SPEC → RENDER · EDITABLE .BLEND',
    headline: 'Blender, as an API.', blurb: 'Describe objects, materials, lights, camera and keyframes in JSON, attach models, and render in hosted Blender. Built for agents and pipelines.',
    metaTitle: 'Remote Blender: Render JSON Scene Specs in the Cloud — ManifoldGen', metaDescription: 'Render declarative Blender scenes from JSON: primitives, 3D text, uploaded models, materials, lights and keyframed cameras. MP4 + editable .blend from $0.30.',
    kind: 'video', input: 'scene', controls: renderControls,
    outputs: 'video_url, poster_url, blend_url', inputsDoc: 'params.spec, model_urls[]', priceDoc: '$0.30 (+$0.20 high)',
    demos: demos3('Product shot on a turntable', 'Floating emissive title', 'Orbiting planets'), runLabel: 'Render scene',
  },
  {
    slug: 'image-to-3d', service: 'image-to-3d', mcp: 'image_to_3d', name: 'Image to 3D', kicker: 'PHOTO → TEXTURED GLB',
    headline: 'One photo, a textured 3D model.', blurb: 'Reconstruct a textured GLB from a single photo. Orbit it in the browser, download it, or send it straight to Destruction, Exploded View or Toon Shader.',
    metaTitle: 'Image to 3D Model (GLB) Online — ManifoldGen', metaDescription: 'Turn one photo into a textured GLB 3D model with AI 3D reconstruction. Preview in the browser and download. $0.06 standard, $0.45 high quality.',
    kind: 'image', input: 'image',
    controls: [{ key: 'quality', label: 'Quality', type: 'select', options: [['standard', 'Standard · $0.06'], ['high', 'High detail · $0.45']], default: 'standard' }],
    outputs: 'glb_url', inputsDoc: 'image_url', priceDoc: '$0.06 · high $0.45', demoOutputExt: 'jpg',
    demos: demos3('Sneaker photo → GLB', 'Toy figure → GLB', 'Ceramic vase → GLB'), runLabel: 'Build 3D model',
  },
  {
    slug: 'vectorize', service: 'vectorize', mcp: 'vectorize_image', name: 'Vectorize', kicker: 'RASTER → LAYERED SVG',
    headline: 'Pixels to clean, layered SVG.', blurb: 'Trace logos, art and photos into an SVG with one layer per color. Opens as layers in Illustrator, Inkscape and Figma.',
    metaTitle: 'Vectorize Image to Layered SVG Online — ManifoldGen', metaDescription: 'Convert PNG or JPG to a clean SVG with one layer per color. Color, poster, black-and-white and line-art modes. From $0.02 per image.',
    kind: 'image', input: 'image',
    controls: [
      { key: 'mode', label: 'Mode', type: 'select', options: [['color', 'Color'], ['poster', 'Poster'], ['bw', 'Black & white'], ['lineart', 'Line art']], default: 'color' },
      { key: 'colors', label: 'Colors', type: 'range', min: 2, max: 8, step: 1, default: 6, hint: 'Fewer = flatter' },
      { key: 'detail', label: 'Detail', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
      { key: 'engine', label: 'Engine', type: 'select', options: [['trace', 'Tracer · $0.02'], ['ai', 'AI tracer · $0.03']], default: 'trace' },
      { key: 'corners', label: 'Corner threshold', type: 'range', min: 0, max: 180, step: 5, default: 60, unit: '°', advanced: true },
      { key: 'smooth', label: 'Curves', type: 'select', options: [['spline', 'Spline'], ['polygon', 'Polygon'], ['pixel', 'Pixel']], default: 'spline', advanced: true },
    ],
    outputs: 'svg_url, palette, layers, paths', inputsDoc: 'image_url', priceDoc: '$0.02 · AI tracer $0.03', demoOutputExt: 'svg',
    demos: demos3('Logo → 4-color SVG', 'Illustration → poster layers', 'Sketch → line art'), runLabel: 'Vectorize',
  },
  {
    slug: 'shot-cleanup', service: 'shot-cleanup', mcp: 'remove_video_objects', name: 'Shot Cleanup', kicker: 'AI ERASER · VIDEO OBJECT REMOVAL',
    headline: 'Erase it from the shot.', blurb: 'Remove people, logos, cars or props from video while motion and texture stay intact. Name it, or click it on the first frame.',
    metaTitle: 'Remove Objects from Video Online (AI Eraser) — ManifoldGen', metaDescription: 'Erase people, logos and objects from video clips up to 30 s with an AI eraser. Name the object or click it. $0.24 per second, charged on success.',
    kind: 'video', input: 'video',
    controls: [{ key: 'keep_audio', label: 'Keep audio', type: 'toggle', default: true }],
    outputs: 'video_url', inputsDoc: 'video_url, prompt | params.points', priceDoc: '$0.24 / s (max 30 s)', demoInputExt: 'mp4',
    demos: demos3('Remove a passer-by', 'Remove a logo', 'Remove a parked car'), runLabel: 'Clean up shot',
  },
];

export const productionTool = (slug: string) => PRODUCTION_TOOLS.find((tool) => tool.slug === slug);

export const MODEL_EXTENSIONS = ['glb', 'obj', 'fbx', 'stl', 'ply'] as const;

export function modelContentType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ({ glb: 'model/gltf-binary', obj: 'model/obj', fbx: 'model/fbx', stl: 'model/stl', ply: 'model/ply' } as Record<string, string>)[ext] || '';
}

export function controlDefaults(controls: readonly ProductionControl[]): ProductionParams {
  return Object.fromEntries(controls.map((control) => [control.key, Array.isArray(control.default) ? [...control.default] : control.default]));
}

export function controlParams(controls: readonly ProductionControl[], values: ProductionParams): ProductionParams {
  const out: ProductionParams = {};
  for (const control of controls) {
    const value = values[control.key];
    if (control.type === 'seed') {
      const seed = Number.parseInt(String(value ?? ''), 10);
      if (Number.isFinite(seed)) out.seed = seed;
    } else if (control.type === 'palette') {
      const palette = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 8) : [];
      if (palette.length) out.palette = palette;
    } else if (value !== undefined && value !== '') {
      out[control.key] = value;
    }
  }
  return out;
}

const TOP_LEVEL = ['image_url', 'model_url', 'model_urls', 'video_url', 'prompt', 'duration'] as const;

export function apiBody(req: ProductionRequest): Record<string, unknown> {
  const body: Record<string, unknown> = { service: req.service };
  for (const key of TOP_LEVEL) {
    const value = req[key];
    if (value !== undefined && value !== '' && !(Array.isArray(value) && !value.length)) body[key] = value;
  }
  if (Object.keys(req.params).length) body.params = req.params;
  return body;
}

export function mcpArguments(req: ProductionRequest): Record<string, unknown> {
  const { service: _service, params, ...rest } = apiBody(req) as Record<string, unknown> & { params?: ProductionParams };
  return { ...rest, ...(params || {}) };
}

const shellQuote = (text: string) => `'${text.replace(/'/g, `'\\''`)}'`;

export function snippets(req: ProductionRequest, mcpTool: string) {
  const body = JSON.stringify(apiBody(req), null, 2);
  const args = JSON.stringify(mcpArguments(req));
  return {
    curl: `curl https://manifoldgen.com/api/service \\\n  -X POST \\\n  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d ${shellQuote(body)}\n\ncurl https://manifoldgen.com/api/video-jobs/$JOB_ID \\\n  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY"`,
    mcp: `${mcpTool}(${args})`,
    cli: `manifoldgen generate ${req.service} --params ${shellQuote(args)}`,
  };
}

export const MCP_SETUP = `{
  "mcpServers": {
    "manifoldgen": {
      "url": "https://manifoldgen.com/api/mcp",
      "headers": { "Authorization": "Bearer $MANIFOLDGEN_API_KEY" }
    }
  }
}`;

export const SCENE_TEMPLATES: readonly { id: string; label: string; spec: Record<string, unknown> }[] = [
  {
    id: 'product', label: 'Product shot',
    spec: {
      frames: 120,
      objects: [
        { type: 'model', model_index: 0, location: [0, 0, 0.6], scale: [1, 1, 1], keyframes: [{ frame: 1, rotation: [0, 0, 0] }, { frame: 120, rotation: [0, 0, 360] }] },
        { type: 'cylinder', location: [0, 0, 0], scale: [1.6, 1.6, 0.1], material: { color: '#1b1b22', roughness: 0.35 } },
      ],
      lights: [{ type: 'area', location: [3, -3, 4], energy: 600 }, { type: 'area', location: [-3, 2, 3], color: '#9ec5ff', energy: 250 }],
      camera: { location: [0, -5.5, 2], look_at: [0, 0, 0.8], lens: 60 },
      world: { preset: 'studio', strength: 0.6 },
    },
  },
  {
    id: 'title', label: 'Floating text title',
    spec: {
      frames: 96,
      objects: [
        { type: 'text', text: 'MANIFOLD', location: [0, 0, 1], rotation: [90, 0, 0], scale: [1, 1, 1], material: { color: '#ffffff', emission: '#8b6cff', emission_strength: 4 }, keyframes: [{ frame: 1, location: [0, 0, 0.6] }, { frame: 96, location: [0, 0, 1.1] }] },
        { type: 'plane', location: [0, 0, 0], scale: [12, 12, 1], material: { color: '#0b0b12', roughness: 0.2, metallic: 0.6 } },
      ],
      lights: [{ type: 'point', location: [0, -3, 3], color: '#b9a6ff', energy: 400 }],
      camera: { location: [0, -8, 1.4], look_at: [0, 0, 1], lens: 50, keyframes: [{ frame: 1, location: [-1.5, -8, 1.2] }, { frame: 96, location: [1.5, -7, 1.6] }] },
      world: { color: '#05050a', strength: 0.2 },
    },
  },
  {
    id: 'planets', label: 'Orbiting planets',
    spec: {
      frames: 144,
      objects: [
        { type: 'sphere', location: [0, 0, 0], scale: [1.2, 1.2, 1.2], material: { color: '#ffb347', emission: '#ff8a00', emission_strength: 6 } },
        { type: 'sphere', location: [3, 0, 0], scale: [0.35, 0.35, 0.35], material: { color: '#4fa3ff', roughness: 0.6 }, keyframes: [{ frame: 1, location: [3, 0, 0] }, { frame: 36, location: [0, 3, 0] }, { frame: 72, location: [-3, 0, 0] }, { frame: 108, location: [0, -3, 0] }, { frame: 144, location: [3, 0, 0] }] },
        { type: 'torus', location: [0, 0, 0], scale: [3, 3, 0.02], material: { color: '#ffffff', emission: '#ffffff', emission_strength: 0.4 } },
      ],
      lights: [{ type: 'point', location: [0, 0, 0], color: '#ffd28a', energy: 1500 }],
      camera: { location: [0, -9, 5], look_at: [0, 0, 0], lens: 40 },
      world: { color: '#020208', strength: 0.05 },
    },
  },
];

export const formatSpec = (spec: unknown) => JSON.stringify(spec, null, 2)
  .replace(/\[\s+([^[\]{}]*?)\s+\]/g, (_, inner: string) => `[${inner.split(/,\s+/).join(', ')}]`)
  .replace(/\{\n\s+("\w+": (?:\[[^[\]{}\n]*\]|[^{}[\]\n]+)(?:,\n\s+"\w+": (?:\[[^[\]{}\n]*\]|[^{}[\]\n]+))*)\n\s*\}/g, (match, inner: string) => {
    const line = `{ ${inner.replace(/,\n\s+/g, ', ')} }`;
    return line.length <= 72 ? line : match;
  });

export const SCENE_SCHEMA =`spec = {
  frames?: number,
  objects: [{            // 1-64
    type: cube|sphere|cylinder|cone|torus|plane|text|model,
    model_index?: n,     // into model_urls
    text?, location?: [x,y,z], rotation?: [deg], scale?: [x,y,z],
    material?: { color, roughness, metallic, emission, emission_strength, toon },
    keyframes?: [{ frame, location, rotation, scale }]
  }],
  lights?: [{ type, location, rotation, color, energy }],
  camera?: { location, look_at, lens, keyframes },
  world?: { color, strength, preset }
}`;

export function validateSceneSpec(text: string, modelCount: number): { spec?: Record<string, unknown>; error?: string } {
  if (new Blob([text]).size > 60 * 1024) return { error: 'Spec must be under 60 KB' };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch (reason) { return { error: `Invalid JSON: ${reason instanceof Error ? reason.message : 'parse error'}` }; }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Spec must be a JSON object' };
  const spec = parsed as Record<string, unknown>;
  const objects = spec.objects;
  if (!Array.isArray(objects) || objects.length < 1 || objects.length > 64) return { error: 'spec.objects must hold 1-64 objects' };
  for (const [index, item] of objects.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: `objects[${index}] must be an object` };
    const object = item as Record<string, unknown>;
    if (typeof object.type !== 'string') return { error: `objects[${index}].type is required` };
    if (object.model_index !== undefined) {
      const modelIndex = object.model_index;
      if (typeof modelIndex !== 'number' || !Number.isInteger(modelIndex) || modelIndex < 0) return { error: `objects[${index}].model_index must be a whole number` };
      if (modelIndex >= modelCount) return { error: `objects[${index}].model_index ${modelIndex} needs model #${modelIndex} uploaded` };
    }
    if (object.type === 'model' && object.model_index === undefined) return { error: `objects[${index}] of type model needs model_index` };
  }
  return { spec };
}

export const PRODUCTION_SUITE: readonly { href: string; name: string; copy: string; price: string }[] = [
  ...PRODUCTION_TOOLS.map((tool) => ({ href: `/tools/${tool.slug}`, name: tool.name, copy: tool.blurb.split('. ')[0] + '.', price: tool.priceDoc })),
  { href: '/tools/color-grade', name: 'Color Grade', copy: 'Balance shots, match references and export a .cube LUT in the browser.', price: 'Browser tool' },
  { href: '/tools/shader-fx', name: 'Shader FX', copy: 'Real-time feedback, kaleidoscope, bloom, halftone and VHS effects on images and video.', price: 'Browser tool' },
];
