export type VideoExportFormat = 'original' | 'mp4';

export function videoExtension(url: string): string {
  try {
    return new URL(url, 'https://placeholder.invalid').pathname.split('.').pop()?.toLowerCase() || '';
  } catch {
    return '';
  }
}

export function safeVideoName(name: string, fallback = 'manifoldgen-video') {
  return name.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[\\/:*?"<>|\s]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || fallback;
}

function saveBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read the video (${response.status})`);
  return response.blob();
}

export async function convertVideoToMp4(source: Blob, onProgress?: (fraction: number) => void): Promise<Blob> {
  const { ALL_FORMATS, BlobSource, BufferTarget, Conversion, Input, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo } = await import('mediabunny');
  if (!(await canEncodeVideo('avc'))) throw new Error('This browser cannot encode MP4. Download the WebM instead.');
  const audio = (await canEncodeAudio('aac')) ? { codec: 'aac' as const } : (await canEncodeAudio('opus')) ? { codec: 'opus' as const } : { discard: true };
  const input = new Input({ source: new BlobSource(source), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const conversion = await Conversion.init({ input, output, video: { codec: 'avc', bitrate: 8_000_000 }, audio, showWarnings: false });
  if (!conversion.isValid) throw new Error('This video cannot be converted to MP4 in the browser. Download the WebM instead.');
  conversion.onProgress = (fraction) => onProgress?.(Math.min(1, fraction));
  await conversion.execute();
  const buffer = (output.target as InstanceType<typeof BufferTarget>).buffer;
  if (!buffer) throw new Error('MP4 conversion produced no output');
  return new Blob([buffer], { type: 'video/mp4' });
}

export async function downloadVideo(url: string, name: string, format: VideoExportFormat, onProgress?: (fraction: number) => void) {
  const extension = videoExtension(url) || 'mp4';
  const base = safeVideoName(name);
  let blob: Blob;
  try {
    blob = await fetchBlob(url);
  } catch (reason) {
    if (format === 'original') {
      window.open(url, '_blank', 'noopener');
      return;
    }
    throw reason;
  }
  if (format === 'original' || extension === 'mp4') {
    saveBlob(blob, `${base}.${extension}`);
    return;
  }
  saveBlob(await convertVideoToMp4(blob, onProgress), `${base}.mp4`);
}
