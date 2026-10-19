import { paywallFromResponse } from '../paywall';
import { ENV_HOP, chunkGain, chunkIsSilent, encodeWav16, planChunks, snapWordsToSpeech, type Region } from './dsp';
import type { DecodedAudio } from './audio';
import type { CaptionWord } from './types';
import { applyEnergy, makeWord } from './words';

export type TranscribeOptions = {
  apiKey: string;
  language?: string;
  hint?: string;
  snap?: boolean;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
};

type ChunkReply = { words?: { w: string; s: number; e: number }[]; error?: string };

async function transcribeChunk(audio: DecodedAudio, chunk: Region, options: TranscribeOptions): Promise<{ w: string; s: number; e: number }[]> {
  const gain = chunkGain(audio.samples, chunk.start, chunk.end, audio.rate);
  const wav = encodeWav16(audio.samples, chunk.start, chunk.end, audio.rate, gain);
  const query = new URLSearchParams();
  if (options.language) query.set('language', options.language);
  if (options.hint) query.set('hint', options.hint.slice(0, 800));
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(`/api/captions/transcribe?${query}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'audio/wav' },
      body: wav as BodyInit,
      signal: options.signal,
    });
    const data: ChunkReply = await response.json().catch(() => ({}));
    const paywall = paywallFromResponse(response, data, 'Crazy Captions');
    if (paywall) throw paywall;
    if (response.ok) return data.words || [];
    if (attempt < 2 && (response.status === 429 || response.status >= 500)) {
      await new Promise((resolve) => setTimeout(resolve, 900 * (attempt + 1)));
      continue;
    }
    throw new Error(data.error || `Transcription failed (${response.status})`);
  }
}

/** Cut the soundtrack at quiet points, transcribe the chunks in parallel and stitch one timeline. */
export async function transcribeAudio(audio: DecodedAudio, options: TranscribeOptions): Promise<CaptionWord[]> {
  const chunks = planChunks(audio.env, audio.duration, 60).filter((chunk) => chunk.end - chunk.start >= 0.4 && !chunkIsSilent(audio.env, chunk));
  if (!chunks.length) return [];
  const results: { w: string; s: number; e: number }[][] = new Array(chunks.length);
  let next = 0;
  let done = 0;
  options.onProgress?.(0, chunks.length);
  const worker = async () => {
    while (next < chunks.length) {
      const at = next;
      next += 1;
      results[at] = await transcribeChunk(audio, chunks[at], options);
      done += 1;
      options.onProgress?.(done, chunks.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, chunks.length) }, worker));
  let words: CaptionWord[] = [];
  results.forEach((items, i) => {
    const chunk = chunks[i];
    let local = items.map((item) => makeWord(item.w, item.s, item.e));
    if (options.snap !== false && local.length) {
      const env = audio.env.subarray(Math.floor(chunk.start / ENV_HOP), Math.ceil(chunk.end / ENV_HOP));
      const regions = audio.regions
        .filter((region) => region.end > chunk.start && region.start < chunk.end)
        .map((region) => ({ start: Math.max(region.start, chunk.start) - chunk.start, end: Math.min(region.end, chunk.end) - chunk.start }));
      local = snapWordsToSpeech(local, regions, env, ENV_HOP);
    }
    for (const word of local) words.push({ ...word, start: word.start + chunk.start, end: word.end + chunk.start });
  });
  words.sort((a, b) => a.start - b.start);
  return applyEnergy(words, audio.env, ENV_HOP);
}
