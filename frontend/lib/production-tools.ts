export type MotionService = 'motion-fx' | 'beat-drop' | 'motion-track' | 'motion-score';
export type ProductionService = 'destruction-studio' | 'exploded-view' | 'toon-shader' | 'blender-scene' | 'image-to-3d' | 'vectorize' | 'shot-cleanup' | MotionService;

export type ProductionParams = Record<string, unknown>;

export type ProductionRequest = {
  service: ProductionService;
  image_url?: string;
  model_url?: string;
  model_urls?: string[];
  video_url?: string;
  audio_url?: string;
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
  | { type: 'names'; default: string; placeholder?: string }
  | { type: 'tri'; default: string }
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
  variantOf?: string;
  fixedParams?: ProductionParams;
  audio?: 'optional' | 'required';
  audioLabel?: string;
  audioHint?: string;
  demoSlug?: string;
  demoIndexes?: readonly number[];
  extraCopy?: string;
};

export const MOTION_PRICING: Record<MotionService, { rate: number; min: number; max: number }> = {
  'motion-fx': { rate: 0.06, min: 0.15, max: 20 },
  'beat-drop': { rate: 0.04, min: 0.10, max: 30 },
  'motion-track': { rate: 0.02, min: 0.05, max: 60 },
  'motion-score': { rate: 0.05, min: 0.20, max: 30 },
};

export const isMotionService = (service: string): service is MotionService => service in MOTION_PRICING;

export const PRODKIT_PRICES = {
  base: { 'destruction-studio': 0.40, 'exploded-view': 0.40, 'toon-shader': 0.30, 'blender-scene': 0.30, 'image-to-3d': 0.06, vectorize: 0.02, 'shot-cleanup': 0.24, 'motion-fx': 0.06, 'beat-drop': 0.04, 'motion-track': 0.02, 'motion-score': 0.05 } as Record<ProductionService, number>,
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
  if (isMotionService(req.service)) {
    const rule = MOTION_PRICING[req.service];
    const seconds = req.duration && req.duration > 0 ? req.duration : 5;
    return Math.round(Math.max(rule.min, rule.rate * Math.ceil(Math.min(seconds, rule.max))) * 100) / 100;
  }
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

export function demoMedia(tool: Pick<ProductionTool, 'slug' | 'demoInputExt' | 'demoOutputExt' | 'demoSlug' | 'demoIndexes'>, index: number) {
  const root = `${PRODUCTION_DEMO_BASE}/${tool.demoSlug || tool.slug}/${tool.demoIndexes?.[index] ?? index + 1}`;
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

const PALETTE_OPTIONS: readonly Option[] = [['', 'Preset default'], ['gold-blue', 'Gold & blue'], ['fire', 'Fire'], ['neon', 'Neon'], ['ice', 'Ice']];
const FX_PRESETS: readonly Option[] = [
  ['anime-fight', 'Anime fight'], ['ki-aura', 'Power aura'], ['lightning', 'Lightning'], ['neon-trails', 'Neon trails'],
  ['game-hud', 'Fighting-game HUD'], ['spotlight', 'Spotlight'], ['slowmo-impacts', 'Impact slow-mo'],
  ['exaggerate', 'Motion exaggerate'], ['echo', 'Afterimage echo'],
];
const REFRAME_ASPECTS: readonly Option[] = [['', 'Source'], ['9:16', '9:16 · Shorts / Reels'], ['4:5', '4:5 · Feed'], ['1:1', '1:1'], ['16:9', '16:9']];
const reframe: ProductionControl = { key: 'aspect', label: 'Reframe to', type: 'select', options: REFRAME_ASPECTS, default: '', hint: 'Smart crop that follows the action' };
const intensity: ProductionControl = { key: 'intensity', label: 'Intensity', type: 'range', min: 0.3, max: 1.6, step: 0.1, default: 1 };
const palette: ProductionControl = { key: 'palette', label: 'Color palette', type: 'select', options: PALETTE_OPTIONS, default: '' };
const fxControls: readonly ProductionControl[] = [
  { key: 'preset', label: 'Effect', type: 'select', options: FX_PRESETS, default: 'anime-fight' },
  intensity,
  palette,
  { key: 'names', label: 'Fighter names', type: 'names', default: '', placeholder: 'Sensei, Rival', advanced: false, hint: 'Comma separated, shown in the HUD and spotlight' },
  { key: 'slowmo', label: 'Slow-mo on big hits', type: 'tri', default: '' },
  { key: 'sfx', label: 'Impact sound effects', type: 'tri', default: '' },
  { key: 'text', label: 'Comic hit text (POW!)', type: 'tri', default: '' },
  reframe,
  { key: 'seed', label: 'Seed', type: 'seed', default: '', advanced: true, hint: 'Blank = default' },
];

const motionDemos = (...captions: string[]): ProductionDemo[] => captions.map((caption) => ({ caption }));

const FX_COMMON = {
  kind: 'video' as const, input: 'video' as const, controls: fxControls,
  outputs: 'video_url, poster_url', inputsDoc: 'video_url | params.preset', priceDoc: '$0.06 / s (min $0.15, max 20 s)',
  demoInputExt: 'mp4', demoSlug: 'motion-fx',
  extraCopy: 'Pose tracking finds every fighter, follows them through the clip and drives the effects, so the aura, trails and impacts stay glued to the moves. Output keeps your resolution (up to 1280 px) and adds matching impact sound.',
};

const fxVariant = (slug: string, preset: string, mcpNote: string, v: Pick<ProductionTool, 'name' | 'kicker' | 'headline' | 'blurb' | 'metaTitle' | 'metaDescription' | 'runLabel'> & { demoIndex: number; demoCaption: string; lock?: ProductionParams }): ProductionTool => {
  const fixedParams: ProductionParams = { preset, ...(v.lock || {}) };
  return {
    ...FX_COMMON, slug, service: 'motion-fx', mcp: mcpNote, variantOf: 'motion-fx', fixedParams,
    name: v.name, kicker: v.kicker, headline: v.headline, blurb: v.blurb, metaTitle: v.metaTitle, metaDescription: v.metaDescription, runLabel: v.runLabel,
    controls: fxControls.filter((control) => !(control.key in fixedParams)),
    demoIndexes: [v.demoIndex], demos: [{ caption: v.demoCaption }],
  };
};

export const MOTION_TOOLS: readonly ProductionTool[] = [
  {
    ...FX_COMMON, slug: 'motion-fx', service: 'motion-fx', mcp: 'apply_motion_fx', name: 'Motion FX', kicker: 'POSE-TRACKED ACTION EFFECTS · MARTIAL ARTS · SPORTS',
    headline: 'Anime fight effects on any clip.', blurb: 'Drop in a martial arts, dance or sports clip. Pose tracking follows every fighter and adds power auras, light trails, lightning, comic impacts, slow-mo on the big hits and matching sound. Share the result anywhere.',
    metaTitle: 'AI Fight Effects: Anime Aura, Lightning and Impact FX for Video — ManifoldGen', metaDescription: 'Turn martial arts and action clips into anime fight scenes. Pose-tracked power auras, lightning, speed trails, slow-mo impacts and sound effects. From $0.15, API included.',
    demos: motionDemos('Sparring · anime fight', 'Kung fu · power aura', 'Karate kata · lightning', 'Sparring · fighting-game HUD', 'Kung fu · neon trails', 'Kata · spotlight', 'Sparring · motion exaggerate', 'Kung fu · afterimage echo', 'Sparring · vertical reframe'), runLabel: 'Add effects',
    audio: 'optional', audioLabel: 'Song (optional)', audioHint: 'Effects hit on the beat and the song becomes the soundtrack. Leave empty for sound effects only.',
  },
  fxVariant('anime-fight-fx', 'anime-fight', 'apply_motion_fx', {
    name: 'Anime Fight FX', kicker: 'AURA · TRAILS · COMIC IMPACTS · SLOW-MO', headline: 'Make your fight look like an anime.',
    blurb: 'Every kick gets a shockwave, speed lines and a POW!, every fighter a glowing aura, and the biggest hits ramp into slow motion with sound. Built for martial arts and sparring clips.',
    metaTitle: 'Anime Fight Effect Generator for Video: Aura, POW! Impacts, Slow-mo — ManifoldGen', metaDescription: 'Add anime fight effects to any video: glowing auras, speed trails, comic POW impacts, slow-mo on hits and sound effects, all pose-tracked. From $0.15.',
    runLabel: 'Make it anime', demoIndex: 1, demoCaption: 'Sparring · anime fight',
  }),
  fxVariant('ki-aura-fx', 'ki-aura', 'apply_motion_fx', {
    name: 'Power Aura FX', kicker: 'KI AURA · LIGHTNING · LIMB TRAILS', headline: 'Charge up. Go super.',
    blurb: 'A flaming aura that grows with how hard each fighter moves, with lightning crackling off the limbs. Tracks every person in the shot and keeps the glow glued to the body.',
    metaTitle: 'Power Aura Video Effect: Dragon-Ball Style Ki Aura and Lightning — ManifoldGen', metaDescription: 'Add a glowing power aura and crackling lightning to martial arts and training videos. Pose-tracked, intensity follows your movement. From $0.15.',
    runLabel: 'Power up', demoIndex: 2, demoCaption: 'Kung fu · power aura',
  }),
  fxVariant('lightning-fx', 'lightning', 'apply_motion_fx', {
    name: 'Lightning FX', kicker: 'ELECTRIC ARCS · IMPACT FLASH · SHOCKWAVES', headline: 'Lightning on every limb.',
    blurb: 'Electric arcs follow hands and feet, then flash and shockwave on contact. Works on solo forms and two-person fights.',
    metaTitle: 'Lightning Effect for Video: Electric Arcs on Kicks and Punches — ManifoldGen', metaDescription: 'Add pose-tracked lightning, flash and shockwave impacts to martial arts, boxing and dance videos. Slow-mo and sound included. From $0.15.',
    runLabel: 'Add lightning', demoIndex: 3, demoCaption: 'Karate kata · lightning',
  }),
  fxVariant('fight-game-hud', 'game-hud', 'apply_motion_fx', {
    name: 'Fight Game HUD', kicker: 'HEALTH BARS · COMBO COUNTER · FIGHT!', headline: 'Turn any fight into a fighting game.',
    blurb: 'Tracked fighter brackets, health bars that drain on every detected hit, a combo counter and a FIGHT! banner. Name the fighters and post it.',
    metaTitle: 'Fighting Game HUD Overlay for Video: Health Bars, Combo Counter — ManifoldGen', metaDescription: 'Overlay a fighting-game HUD on real martial arts footage: health bars driven by real hits, combo counter, FIGHT! banner and tracked brackets. From $0.15.',
    runLabel: 'Add game HUD', demoIndex: 4, demoCaption: 'Sparring · fighting-game HUD',
  }),
  fxVariant('motion-exaggerate-fx', 'exaggerate', 'apply_motion_fx', {
    name: 'Motion Exaggerate FX', kicker: 'WHIP WARP · SMEAR STREAKS · SNAPPIER MOVES', headline: 'Make every move hit harder.',
    blurb: 'Punches whip further, kicks stretch past the pose and smear streaks trail the limbs, the way animators exaggerate a strike. Pose tracking drives the warp, so only the moving limbs bend. Dial the amount up for cartoon snap or down for a subtle punch-in.',
    metaTitle: 'Motion Exaggeration Video Effect: Smear Frames and Whip Warp for Fights — ManifoldGen', metaDescription: 'Exaggerate the motion in martial arts, dance and sports clips: pose-driven whip and stretch warp with anime smear streaks. Adjustable amount. From $0.15, API included.',
    runLabel: 'Exaggerate the motion', demoIndex: 7, demoCaption: 'Sparring · motion exaggerate',
  }),
  fxVariant('afterimage-fx', 'echo', 'apply_motion_fx', {
    name: 'Afterimage Echo FX', kicker: 'GHOST COPIES · COLOR TRAILS · SPEED FORCE', headline: 'Leave a trail of ghosts.',
    blurb: 'Delayed colored copies of each fighter trail behind every move, like a speed-force afterimage. Each person gets their own color, and the echo stretches with how fast they move.',
    metaTitle: 'Afterimage Echo Video Effect: Ghost Trails Behind Every Move — ManifoldGen', metaDescription: 'Add colored afterimage echoes that trail every fighter or dancer in your video. Pose-tracked, per-person colors, speed-reactive. From $0.15, API included.',
    runLabel: 'Add the echo', demoIndex: 8, demoCaption: 'Kung fu · afterimage echo',
  }),
  fxVariant('fight-reel-reframe', 'anime-fight', 'apply_motion_fx', {
    name: 'Fight Reel Reframe', kicker: 'WIDE TO VERTICAL · CAMERA FOLLOWS THE FIGHTERS · TIKTOK · REELS · SHORTS', headline: 'Turn widescreen fights into vertical reels.',
    blurb: 'Drop in 16:9 fight or action footage and get a 9:16 cut where the virtual camera follows the fighters, with the anime effects on top. Tone the intensity down for a clean reframe or turn it up for the full edit.',
    metaTitle: 'Reframe Fight Videos to Vertical 9:16 for TikTok, Reels and Shorts — ManifoldGen', metaDescription: 'Convert widescreen martial arts and action footage to vertical video with a smart crop that follows the fighters. Optional anime effects, slow-mo and sound. From $0.15.',
    runLabel: 'Reframe to vertical', demoIndex: 9, demoCaption: 'Sparring · vertical reframe', lock: { aspect: '9:16' },
  }),
  {
    slug: 'beat-drop-fx', service: 'beat-drop', mcp: 'beat_drop_video', variantOf: 'beat-drop', name: 'Beat Drop FX', kicker: 'SONG-SYNCED ZOOM · FLASH · SHAKE',
    headline: 'Make any video hit on the beat.', blurb: 'Upload a clip and a song. Every kick punches the camera in, every snare flashes and splits color, and the video shakes on the drop. The song becomes the soundtrack.',
    metaTitle: 'Beat Sync Video Effects: Zoom, Flash and Shake on the Beat — ManifoldGen', metaDescription: 'Sync video effects to your music automatically: zoom punch on kicks, flash on snares, color split and shake on the drop. Upload a clip and a song. From $0.10.',
    kind: 'video', input: 'video', audio: 'required', audioLabel: 'Song', audioHint: 'MP3 · WAV · M4A · up to 60 MB. Used as the soundtrack.',
    controls: [intensity, palette, reframe],
    outputs: 'video_url, poster_url', inputsDoc: 'video_url, audio_url', priceDoc: '$0.04 / s (min $0.10, max 30 s)', demoInputExt: 'mp4', demoSlug: 'beat-drop',
    extraCopy: 'Kicks and snares are detected from the song itself, so effects land exactly on the beat. No pose tracking needed, which keeps it cheap.',
    demos: motionDemos('Karate kata · synced to a track', 'Sparring · synced to a track'), runLabel: 'Sync to the beat',
  },
  {
    slug: 'motion-tracker', service: 'motion-track', mcp: 'track_motion', name: 'Motion Tracker', kicker: 'POSE TRACKING API · SKELETONS · HIT EVENTS · TRACK GUIDE',
    headline: 'Track every person. Get the data.', blurb: 'Multi-person pose tracking with persistent IDs, a skeleton preview video, per-limb hit and strike events, tempo, and a colored-spline track guide you can use as motion-control conditioning for generative video. Download tracks.json and signals.json or call the API.',
    metaTitle: 'Pose Tracking API for Video: Skeletons, Hit Events, Motion Track Guide — ManifoldGen', metaDescription: 'Track people in video with pose keypoints, persistent IDs, strike and impact events and tempo. Skeleton preview, tracks.json and a motion track guide for generative video. From $0.05.',
    kind: 'video', input: 'video', controls: [],
    outputs: 'preview_url, guide_url, tracks_url, signals_url, poster_url', inputsDoc: 'video_url', priceDoc: '$0.02 / s (min $0.05, max 60 s)', demoInputExt: 'mp4', demoSlug: 'motion-track',
    extraCopy: 'tracks.json holds 17 COCO keypoints per person per frame. signals.json holds the motion energy curve, detected strikes and impacts, and the tempo. The guide video renders colored splines for head, hands, feet and hips: use it as motion-control conditioning for generative video models.',
    demos: motionDemos('Sparring · skeleton preview', 'Kung fu · skeleton preview'), runLabel: 'Track motion',
  },
  {
    slug: 'motion-score', service: 'motion-score', mcp: 'score_motion_video', name: 'Motion Score', kicker: 'VIDEO-REACTIVE SOUNDTRACK · HIT SOUNDS · TEMPO LOCK',
    headline: 'A soundtrack that follows the fight.', blurb: 'Pose tracking reads the tempo and every strike, then builds drums locked to the movement with impact and whoosh sounds on each hit. Bring your own track and it is tempo-fitted, beat-aligned and ducked under the hits.',
    metaTitle: 'Auto Soundtrack for Action Video: Music and Hit Sounds Synced to Motion — ManifoldGen', metaDescription: 'Generate a soundtrack from the movement in your video: tempo-locked drums, impact sounds on every strike, optional tempo-fitted music. From $0.20.',
    kind: 'video', input: 'video', audio: 'optional', audioLabel: 'Your music (optional)', audioHint: 'Fitted to the motion tempo and ducked under hits. Leave empty for a generated drum score.',
    controls: [{ key: 'keep_audio', label: 'Keep original audio underneath', type: 'toggle', default: false }],
    outputs: 'video_url, audio_url, cues_url, poster_url', inputsDoc: 'video_url, audio_url?', priceDoc: '$0.05 / s (min $0.20, max 30 s)', demoInputExt: 'mp4',
    extraCopy: 'cues.json lists every detected hit with its time and power, the tempo, and a music prompt you can use to generate a matching track elsewhere.',
    demos: motionDemos('Kung fu · generated drum score', 'Sparring · your track, tempo-fitted'), runLabel: 'Score the video',
  },
];

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
      { key: 'colors', label: 'Colors', type: 'range', min: 2, max: 32, step: 1, default: 12, hint: 'One layer per color' },
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

export const productionTool = (slug: string) => PRODUCTION_TOOLS.find((tool) => tool.slug === slug) || MOTION_TOOLS.find((tool) => tool.slug === slug);

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
    } else if (control.type === 'names') {
      const names = String(value ?? '').split(',').map((item) => item.trim().slice(0, 16)).filter(Boolean).slice(0, 4);
      if (names.length) out.names = names;
    } else if (control.type === 'tri') {
      if (value === 'true' || value === 'false') out[control.key] = value === 'true';
    } else if (value !== undefined && value !== '') {
      out[control.key] = value;
    }
  }
  return out;
}

const TOP_LEVEL = ['image_url', 'model_url', 'model_urls', 'video_url', 'audio_url', 'prompt', 'duration'] as const;

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

export function cliCommand(req: ProductionRequest): string {
  const parts = ['manifoldgen generate', req.service];
  if (req.image_url) parts.push('--image', shellQuote(req.image_url));
  if (req.model_url) parts.push('--model', shellQuote(req.model_url));
  if (req.model_urls?.length) parts.push('--models', shellQuote(req.model_urls.join(',')));
  if (req.video_url) parts.push('--video', shellQuote(req.video_url));
  if (req.audio_url) parts.push('--audio', shellQuote(req.audio_url));
  if (req.prompt) parts.push('--prompt', shellQuote(req.prompt));
  if (req.duration) parts.push('--duration', String(req.duration));
  if (Object.keys(req.params).length) parts.push('--params', shellQuote(JSON.stringify(req.params)));
  parts.push('--wait --out .');
  return parts.join(' ');
}

export function snippets(req: ProductionRequest, mcpTool: string) {
  const body = JSON.stringify(apiBody(req), null, 2);
  const args = JSON.stringify(mcpArguments(req));
  return {
    curl: `curl https://manifoldgen.com/api/service \\\n  -X POST \\\n  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d ${shellQuote(body)}\n\ncurl https://manifoldgen.com/api/video-jobs/$JOB_ID \\\n  -H "Authorization: Bearer $MANIFOLDGEN_API_KEY"`,
    mcp: `${mcpTool}(${args})`,
    cli: cliCommand(req),
  };
}

export type FightStats = {
  fighters?: Record<string, Record<string, unknown>>;
  total_strikes?: unknown; total_impacts?: unknown; peak_intensity_t?: unknown; bpm?: unknown; most_active?: unknown;
};

export type FightStatsRow = {
  id: string; label: string; strikes: number; impacts: number; hitsTaken: number; avgPower: string; topSpeed: string;
  bestCombo: number; activeSeconds: string; mostActive: boolean;
};

export type FightStatsView = { rows: FightStatsRow[]; totals: { strikes: number; impacts: number; peakAt: string; bpm: string } };

const finite = (value: unknown, fallback = 0) => (typeof value === 'number' && Number.isFinite(value) ? value : fallback);
const count = (value: unknown) => Math.max(0, Math.round(finite(value)));

export function formatFightStats(stats: unknown, names: readonly string[] = []): FightStatsView | null {
  if (!stats || typeof stats !== 'object') return null;
  const data = stats as FightStats;
  const fighters = data.fighters && typeof data.fighters === 'object' ? data.fighters : {};
  const rows = Object.entries(fighters)
    .filter(([, value]) => value && typeof value === 'object')
    .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
    .slice(0, 8)
    .map(([id, value]) => {
      const index = Number(id) - 1;
      const named = Number.isInteger(index) && index >= 0 ? names[index]?.trim() : '';
      return {
        id, label: named || `Fighter ${id}`,
        strikes: count(value.strikes), impacts: count(value.impacts), hitsTaken: count(value.hits_taken),
        avgPower: finite(value.avg_power).toFixed(2), topSpeed: finite(value.top_speed).toFixed(1),
        bestCombo: count(value.best_combo), activeSeconds: finite(value.active_seconds).toFixed(1),
        mostActive: String(data.most_active ?? '') === id,
      };
    });
  if (!rows.length) return null;
  return {
    rows,
    totals: {
      strikes: count(data.total_strikes) || rows.reduce((sum, row) => sum + row.strikes, 0),
      impacts: count(data.total_impacts) || rows.reduce((sum, row) => sum + row.impacts, 0),
      peakAt: finite(data.peak_intensity_t).toFixed(1),
      bpm: finite(data.bpm) > 0 ? String(Math.round(finite(data.bpm))) : '',
    },
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
  ...[...PRODUCTION_TOOLS, ...MOTION_TOOLS.filter((tool) => !tool.variantOf)].map((tool) => ({ href: `/tools/${tool.slug}`, name: tool.name, copy: tool.blurb.split('. ')[0] + '.', price: tool.priceDoc })),
  { href: '/tools/color-grade', name: 'Color Grade', copy: 'Balance shots, match references and export a .cube LUT in the browser.', price: 'Browser tool' },
  { href: '/tools/shader-fx', name: 'Shader FX', copy: 'Real-time feedback, kaleidoscope, bloom, halftone and VHS effects on images and video.', price: 'Browser tool' },
];
