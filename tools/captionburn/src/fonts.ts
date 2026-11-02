/**
 * Fetches and caches the Google-font families the caption engine can use.
 * Run from the tool directory: `bun run src/fonts.ts`
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const FONT_DIR = join(import.meta.dir, '..', 'fonts');

/** css family name -> [local file, download url, weight] */
export const FONTS: Record<string, [string, string, number]> = {
  Montserrat: [
    'Montserrat-ExtraBold.ttf',
    'https://github.com/JulietaUla/Montserrat/raw/master/fonts/ttf/Montserrat-ExtraBold.ttf',
    800,
  ],
  Anton: ['Anton-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf', 400],
  "Bebas Neue": ['BebasNeue-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/bebasneue/BebasNeue-Regular.ttf', 400],
  "Archivo Black": ['ArchivoBlack-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf', 400],
  Bangers: ['Bangers-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/bangers/Bangers-Regular.ttf', 400],
  Bungee: ['Bungee-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/bungee/Bungee-Regular.ttf', 400],
  "Russo One": ['RussoOne-Regular.ttf', 'https://github.com/google/fonts/raw/main/ofl/russoone/RussoOne-Regular.ttf', 400],
};

export async function ensureFonts(names?: string[]): Promise<Record<string, string>> {
  mkdirSync(FONT_DIR, { recursive: true });
  const out: Record<string, string> = {};
  for (const [family, [file, url, weight]] of Object.entries(FONTS)) {
    if (names && !names.includes(family)) continue;
    const path = join(FONT_DIR, file);
    if (!existsSync(path)) {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`font ${family}: HTTP ${res.status}`);
      writeFileSync(path, Buffer.from(await res.arrayBuffer()));
    }
    out[family] = path;
    void weight;
  }
  return out;
}

if (import.meta.main) {
  const got = await ensureFonts();
  for (const [family, path] of Object.entries(got)) console.log(family, '->', path);
}
