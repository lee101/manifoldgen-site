// Shared configuration for the precomputed translation pipeline.
// Used by i18n-extract.ts, i18n-check.ts, i18n_fill.py (mirrors LANG codes),
// and i18n-build.ts. Adding a language = add a code here, run extract/fill/build.

export const SITE_URL = 'https://manifoldgen.com';

export const LANGS: { code: string; name: string }[] = [
  { code: 'de', name: 'German' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'pl', name: 'Polish' },
  { code: 'tr', name: 'Turkish' },
  { code: 'ru', name: 'Russian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'id', name: 'Indonesian' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Simplified Chinese' },
];

export type LangCode = (typeof LANGS)[number]['code'];

export const LANG_CODES = LANGS.map((l) => l.code);

// Brand/product tokens that are correct as-is in every language.
export const KEEP_AS_IS_TERMS = [
  'ManifoldGen', 'Manifold H3', 'Manifold Video', 'Manifold', 'Seedance 2 Fast', 'Seedance 2',
  'Seedance Fast', 'Seedance', 'LTX 2', 'LTX', 'Wan', 'Kling', 'Veo', 'Happy Horse',
  'Higgsfield', 'ByteDance', 'Alibaba', 'MiniMax', 'Google', 'OpenAI', 'Black Forest Labs',
  'Lightricks', 'RA2V', 'FLUX.2', 'Flux', 'GPT Image', 'Grok Imagine', 'Nano Banana',
  'Sora', 'PixVerse', 'Hailuo', 'Vidu', 'Runway', 'Pika', 'ComfyUI', 'API', 'NSFW', 'SFW',
  'SEO', 'URLs', 'URL', 'JSON', 'MCP', 'TTS', 'UGC', 'VFX', 'CGI', 'AI', '4K', '1080p', '720p',
] as const;

const keepAsIsByLengthDesc: readonly string[] = [...KEEP_AS_IS_TERMS].sort((a, b) => b.length - a.length);

/** True when a value is a pure brand/technical token identical in every locale. */
export function isKeepAsIs(value: string): boolean {
  const rest = keepAsIsByLengthDesc.reduce((acc, term) => acc.replaceAll(term, ''), value);
  return !/[A-Za-z]{2}/.test(rest);
}

const BRAND_TERMS_SORTED = [...KEEP_AS_IS_TERMS].sort((a, b) => b.length - a.length);

/**
 * Echo tolerance: some strings are correct byte-identical in every locale —
 * product/variant names ("<Brand> Reference Fast"), brand-led API page titles,
 * single technical tokens (Canny, Loops), and English prompt-phrase titles on
 * /search/ pages where the phrase IS the artifact being showcased.
 */
export function echoAllowed(_route: string, key: string, value: string): boolean {
  if (!value.includes(' ')) return true;
  if (key === 'name' || key.endsWith('.displayName') || key.endsWith('.name')) return true;
  // Brand-led strings (titles, table cells, labels): the brand carries the
  // meaning and locales keep it Latin anyway.
  if (BRAND_TERMS_SORTED.some((term) => value.startsWith(term))) return true;
  if (_route.startsWith('/search/') && key === 'title') return true;
  return false;
}

// Allowed Unicode scripts per language (used by checker + fill validation).
export const ALLOWED_SCRIPTS: Record<string, string[]> = {
  ar: ['Arabic'],
  hi: ['Devanagari'],
  ru: ['Cyrillic'],
  uk: ['Cyrillic'],
  ja: ['Hiragana', 'Katakana', 'Han'],
  ko: ['Hangul'],
  zh: ['Han'],
};

export function scriptOf(ch: string): string | null {
  const o = ch.codePointAt(0);
  if (o == null) return null;
  if (o >= 0x0900 && o <= 0x097f) return o === 0x0964 || o === 0x0965 ? null : 'Devanagari';
  if (o >= 0x0600 && o <= 0x06ff) return 'Arabic';
  if (o >= 0x0400 && o <= 0x04ff) return 'Cyrillic';
  if ((o >= 0x3040 && o <= 0x309f) || o === 0x30fc) return 'Hiragana';
  if (o >= 0x30a0 && o <= 0x30ff) return 'Katakana';
  if (o >= 0x4e00 && o <= 0x9fff) return 'Han';
  if (o >= 0xac00 && o <= 0xd7af) return 'Hangul';
  if ((o >= 0x0041 && o <= 0x005a) || (o >= 0x0061 && o <= 0x007a) || (o >= 0x00c0 && o <= 0x024f) || (o >= 0x1e00 && o <= 0x1eff)) return 'Latin';
  return null;
}

function scriptsOf(s: string): Set<string> {
  const seen = new Set<string>();
  for (const ch of s) {
    const sc = scriptOf(ch);
    if (sc) seen.add(sc);
  }
  return seen;
}

/** Reject output that leaked into a script the target language never uses. */
export function scriptOk(lang: string, s: string): boolean {
  const allowed = ALLOWED_SCRIPTS[lang];
  if (!allowed) return true;
  for (const sc of scriptsOf(s)) {
    if (sc !== 'Latin' && !allowed.includes(sc)) return false;
  }
  // Target-script languages must actually use their script somewhere when the
  // English source had real words (Latin-only output = untranslated drift).
  const hasTargetScript = [...scriptsOf(s)].some((sc) => allowed.includes(sc));
  return hasTargetScript;
}
