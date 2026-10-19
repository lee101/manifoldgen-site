export type Emphasis = 'auto' | 0 | 1 | 2 | 3;

export type CaptionWord = {
  id: string;
  text: string;
  start: number;
  end: number;
  energy: number;
  emphasis: Emphasis;
  breakBefore?: boolean;
  hidden?: boolean;
  color?: string;
};

export type GroupMode = 'word' | 'words' | 'phrase';

export type Grouping = {
  mode: GroupMode;
  wordsPerPage: number;
  maxChars: number;
  pauseBreak: number;
  respectPunctuation: boolean;
};

export type AnimIn = 'none' | 'fade' | 'pop' | 'slam' | 'rise' | 'drop' | 'slide' | 'zoom' | 'flip' | 'typewriter' | 'decode' | 'glitch' | 'blur';
export type AnimOut = 'none' | 'fade' | 'shrink' | 'glitch' | 'drop';
export type Reveal = 'all' | 'progressive';
export type Active = 'none' | 'color' | 'sweep' | 'box' | 'underline';
export type Placement = 'fixed' | 'scatter' | 'alternate';
export type CaseMode = 'none' | 'upper' | 'lower';
export type GlitchTrigger = 'always' | 'onset' | 'emphasis';

export type FontKey =
  | 'anton' | 'bebas' | 'archivo' | 'montserrat' | 'poppins' | 'oswald' | 'russo' | 'bangers' | 'marker'
  | 'pixel' | 'vt323' | 'orbitron' | 'spacemono' | 'syne' | 'playfair' | 'dmserif' | 'unbounded' | 'rubikglitch'
  | 'bungee' | 'inter' | 'caveat';

export type CaptionStyle = {
  name: string;
  font: FontKey;
  fontAlt: FontKey;
  size: number;
  weight: number;
  italic: boolean;
  caseMode: CaseMode;
  tracking: number;
  lineHeight: number;
  skew: number;

  x: number;
  y: number;
  maxWidth: number;
  placement: Placement;
  rotate: number;
  tilt: number;

  fill: string;
  fill2: string;
  gradient: boolean;
  gradientAngle: number;
  palette: string[];
  paletteMode: 'off' | 'cycle' | 'random';
  activeColor: string;
  active: Active;
  activeScale: number;
  pastOpacity: number;
  futureOpacity: number;
  reveal: Reveal;

  strokeWidth: number;
  stroke: string;
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadow: string;
  glow: number;
  glowColor: string;
  box: number;
  boxColor: string;
  boxRadius: number;
  boxPad: number;
  boxMode: 'page' | 'word';

  animIn: AnimIn;
  animOut: AnimOut;
  animMs: number;
  stagger: number;
  overshoot: number;

  glitch: number;
  glitchTrigger: GlitchTrigger;
  glitchMs: number;
  rgbSplit: number;
  slices: number;
  jitter: number;
  scanlines: number;
  flicker: number;
  scramble: number;

  energyScale: number;
  emphasisScale: [number, number, number];
  emphasisColors: [string, string, string];
  emphasisFont: boolean;
  emphasisGlitch: number;
  autoEmphasis: number;
  wordRotate: number;
  wordJitter: number;

  punch: number;
  shake: number;
  dim: number;
  vignette: number;
  chromaVideo: number;
  seed: number;
};

export type CaptionDoc = {
  words: CaptionWord[];
  style: CaptionStyle;
  grouping: Grouping;
  offset: number;
};

export type CaptionPage = {
  index: number;
  start: number;
  end: number;
  show: number;
  hide: number;
  words: number[];
};
