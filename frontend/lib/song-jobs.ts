// Shared client for the voice enhancer and lyric music generator: upload a
// recording, ask for a live quote, submit, and poll the audio job.

export type SongTrack = 'voice' | 'studio' | 'produce';

export type SongResult = {
  audio_url?: string;
  charged_usd?: number;
  input_seconds?: number;
  lyrics?: string;
  tracks?: Partial<Record<SongTrack, { audio_url: string; duration_seconds?: number }>>;
};

type JobPayload = { job?: { status?: string; error?: string; result?: SongResult } };

async function json<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

export async function uploadRecording(apiKey: string, file: File, dataset: string): Promise<string> {
  const query = new URLSearchParams({ filename: file.name || 'take.wav', content_type: file.type || 'application/octet-stream', dataset });
  const target = await json<{ upload_url: string; public_url: string }>(
    await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${apiKey}` } }),
    'Could not prepare the upload',
  );
  const sent = await fetch(target.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  if (!sent.ok) throw new Error('Upload failed');
  return target.public_url;
}

export function mediaSeconds(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const media = document.createElement(file.type.startsWith('video') ? 'video' : 'audio');
    media.preload = 'metadata';
    media.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(Number.isFinite(media.duration) ? media.duration : 0); };
    media.onerror = () => { URL.revokeObjectURL(url); resolve(0); };
    media.src = url;
  });
}

export type Quote = { estimated_cost_usd: number; seconds: number; quality_prices_usd?: Record<string, number> };

export async function quoteSong(apiKey: string, body: Record<string, unknown>): Promise<Quote> {
  return json<Quote>(await fetch('/api/service', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, quote_only: true }),
  }), 'Could not price this song');
}

export async function runSong(apiKey: string, body: Record<string, unknown>, onStatus: (status: string, phase: 'queued' | 'processing') => void): Promise<SongResult> {
  const queued = await json<{ result?: { job_id?: string; status_url?: string }; estimated_minutes?: number }>(
    await fetch('/api/service', {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
    'Could not start the song',
  );
  const jobID = queued.result?.job_id;
  if (!jobID) throw new Error('The service returned no job');
  const statusURL = queued.result?.status_url || `/api/audio-jobs/${encodeURIComponent(jobID)}`;
  const minutes = queued.estimated_minutes ? ` · about ${queued.estimated_minutes} min` : '';
  for (let attempt = 0; attempt < 1800; attempt += 1) {
    const payload = await json<JobPayload>(await fetch(statusURL, { headers: { Authorization: `Bearer ${apiKey}` } }), 'Could not read the job status');
    const status = payload.job?.status || '';
    if (status === 'completed') {
      if (!payload.job?.result?.audio_url) throw new Error('The song finished without audio');
      return payload.job.result;
    }
    if (status === 'failed' || status === 'payment_required') {
      throw new Error(payload.job?.error || (status === 'payment_required' ? 'Top up to release this song' : 'Song generation failed'));
    }
    onStatus(status === 'processing' ? `Producing your song${minutes}` : 'Waiting for a studio GPU…', status === 'processing' ? 'processing' : 'queued');
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }
  throw new Error('Still rendering; the song will appear in your audio library');
}

// The trailer agent turns a finished song plus its lyrics into a lyric music video.
export function lyricVideoHref(audioURL: string, lyrics: string, prompt: string): string {
  const params = new URLSearchParams({ soundtrack: audioURL, lyrics: lyrics.slice(0, 4000), brief: `Lyric music video for a ${prompt}` });
  return `/tools/trailer-agent?${params}`;
}
