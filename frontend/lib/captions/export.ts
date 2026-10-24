import { CaptionEngine } from './render';
import { ensureFonts } from './registry';
import type { CaptionDoc } from './types';

export type ExportQuality = 'standard' | 'high' | 'max';

export type ExportOptions = {
  file: Blob;
  doc: CaptionDoc;
  width: number;
  height: number;
  maxSide: number;
  quality: ExportQuality;
  duration: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
};

const QUALITY_LEVEL = { standard: 'medium', high: 'high', max: 'very-high' } as const;

function even(value: number) {
  return Math.max(2, Math.round(value / 2) * 2);
}

export function exportSize(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: even(width * scale), height: even(height * scale) };
}

/** Re-encode the video in the browser with the captions burned in; the soundtrack is carried over. */
export async function exportCaptionedMP4(options: ExportOptions): Promise<Blob> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, Quality, canEncodeAudio, canEncodeVideo } = await import('mediabunny');
  const size = exportSize(options.width, options.height, options.maxSide);
  const codec = (await canEncodeVideo('avc', size)) ? 'avc' : null;
  if (!codec) throw new Error('This browser cannot encode MP4 (H.264). Try Chrome, Edge or Safari.');
  const { style, secondary } = options.doc;
  await ensureFonts(secondary?.enabled ? [style.font, style.fontAlt, secondary.style.font] : [style.font, style.fontAlt]);

  const engine = new CaptionEngine(style);
  engine.update(options.doc, options.duration);
  const raster = document.createElement('canvas');
  raster.width = size.width;
  raster.height = size.height;
  const context = raster.getContext('2d', { alpha: false })!;

  if (!(await canEncodeAudio('aac'))) {
    try {
      (await import('@mediabunny/aac-encoder')).registerAacEncoder();
    } catch { /* fall back to Opus below */ }
  }
  const aac = await canEncodeAudio('aac');
  const audio = aac ? { codec: 'aac' as const } : (await canEncodeAudio('opus')) ? { codec: 'opus' as const } : { discard: true };
  const input = new Input({ source: new BlobSource(options.file), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  try {
    const conversion = await Conversion.init({
      input,
      output,
      showWarnings: false,
      video: {
        codec,
        quality: new Quality(QUALITY_LEVEL[options.quality]),
        forceTranscode: true,
        width: size.width,
        height: size.height,
        fit: 'fill',
        processedWidth: size.width,
        processedHeight: size.height,
        process: (sample) => {
          if (options.signal?.aborted) throw new DOMException('Export canceled', 'AbortError');
          const frame = sample.toVideoFrame();
          try {
            engine.render(context, size.width, size.height, sample.timestamp, frame, frame.displayWidth, frame.displayHeight);
          } finally {
            frame.close();
          }
          return raster;
        },
      },
      audio,
    });
    if (!conversion.isValid) throw new Error('This video cannot be re-encoded in your browser.');
    conversion.onProgress = (fraction) => options.onProgress?.(Math.min(1, fraction));
    const abort = () => { void conversion.cancel(); };
    options.signal?.addEventListener('abort', abort, { once: true });
    await conversion.execute();
    options.signal?.removeEventListener('abort', abort);
    const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
    if (!buffer) throw new Error('Export produced no output');
    return new Blob([buffer], { type: 'video/mp4' });
  } finally {
    input.dispose();
  }
}
