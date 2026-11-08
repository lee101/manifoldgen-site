// Music restyle client: style presets, the restyle result, and the optional
// video stages that take the finished track (lofi loop, H3 loop clip tiled
// over the song, or the trailer agent).

export type RestylePreset = { id: string; name: string; prompt: string; bpm?: number };

export const RESTYLE_PRESETS: RestylePreset[] = [
  { id: 'lofi', name: 'Lofi hip hop', prompt: 'lofi hip hop, mellow Rhodes electric piano, dusty boom bap drums, warm vinyl crackle, relaxing', bpm: 80 },
  { id: 'rnb', name: 'R&B slow jam', prompt: 'smooth R&B instrumental, silky electric piano, deep warm bass, laid-back groove, soft finger snaps' },
  { id: 'violin', name: 'Violin & strings', prompt: 'expressive solo violin lead, warm string ensemble, soft piano, cinematic and lyrical' },
  { id: 'peaceful', name: 'Peaceful piano', prompt: 'peaceful relaxing solo piano, gentle and soft, ambient reverb, calm meditation' },
  { id: 'jazz', name: 'Jazz trio', prompt: 'jazz piano trio, upright bass, brushed drums, warm club ambience, swing feel' },
  { id: 'ambient', name: 'Ambient pads', prompt: 'ambient electronic, lush evolving pads, soft synth lead, slow and dreamy, spacious reverb' },
  { id: 'guitar', name: 'Acoustic guitar', prompt: 'fingerstyle acoustic guitar lead, warm and intimate, light percussion, folk' },
  { id: 'synthwave', name: 'Synthwave', prompt: '80s synthwave, analog synth lead, pulsing bass, gated reverb drums, retro neon' },
  { id: 'orchestral', name: 'Orchestral', prompt: 'full cinematic orchestra, soaring strings and horns, timpani, epic film score' },
  { id: 'chiptune', name: 'Chiptune', prompt: '8-bit chiptune, square wave lead, retro video game, bouncy arpeggios' },
];

export type RestyleResult = {
  audio_url?: string;
  duration_seconds?: number;
  charged_usd?: number;
  style?: string;
  harmony?: string;
  bpm?: number;
  key?: string;
  bars?: number;
  score_abc?: string;
  seed?: number;
};

type JobPayload = { job?: { status?: string; error?: string; result?: Record<string, unknown> } };
type Queued = { result?: { job_id?: string; status_url?: string; status?: string }; estimated_minutes?: number; estimated_cost_usd?: number } & Record<string, unknown>;

async function json<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallback);
  return payload as T;
}

function firstURL(value: unknown, keys: string[]): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  for (const key of keys) if (typeof record[key] === 'string' && (record[key] as string).startsWith('http')) return record[key] as string;
  for (const nested of Object.values(record)) {
    const found = firstURL(nested, keys);
    if (found) return found;
  }
  return '';
}

// runJob submits one /api/service request and follows its job until the
// first URL under `keys` appears; synchronous services return it directly.
export async function runJob(apiKey: string, body: Record<string, unknown>, keys: string[], kind: 'audio' | 'video',
  onStatus: (status: string) => void): Promise<{ url: string; result: Record<string, unknown> }> {
  const queued = await json<Queued>(await fetch('/api/service', {
    method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), `Could not start ${String(body.service)}`);
  const direct = firstURL(queued, keys);
  if (direct && !queued.result?.job_id) return { url: direct, result: queued };
  const jobID = queued.result?.job_id;
  if (!jobID) throw new Error('The service returned no job');
  const statusURL = queued.result?.status_url || `/api/${kind}-jobs/${encodeURIComponent(jobID)}`;
  for (let attempt = 0; attempt < 1500; attempt += 1) {
    const payload = await json<JobPayload>(await fetch(statusURL, { headers: { Authorization: `Bearer ${apiKey}` } }), 'Could not read the job status');
    const status = payload.job?.status || '';
    if (status === 'completed') {
      const url = firstURL(payload.job?.result, keys);
      if (!url) throw new Error('The job finished without output');
      return { url, result: payload.job?.result || {} };
    }
    if (status === 'failed' || status === 'payment_required' || status === 'cancelled') {
      throw new Error(payload.job?.error || (status === 'payment_required' ? 'Top up to release this result' : 'Generation failed'));
    }
    onStatus(status === 'processing' ? 'processing' : 'queued');
    await new Promise((resolve) => window.setTimeout(resolve, 3000));
  }
  throw new Error('Still rendering; it will appear in your library');
}

export function trailerHref(audioURL: string, style: string): string {
  const params = new URLSearchParams({ soundtrack: audioURL, brief: `Music video for an instrumental ${style.slice(0, 200)}` });
  return `/tools/trailer-agent?${params}`;
}
