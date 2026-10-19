import { ENV_HOP, SPEECH_RATE, envelope, speechRegions, type Region } from './dsp';

export type DecodedAudio = {
  samples: Float32Array;
  rate: number;
  duration: number;
  hasAudio: boolean;
  env: Float32Array;
  regions: Region[];
};

export const EMPTY_AUDIO: DecodedAudio = { samples: new Float32Array(0), rate: SPEECH_RATE, duration: 0, hasAudio: false, env: new Float32Array(0), regions: [] };

/** Decode the soundtrack of any media file to 16 kHz mono floats, plus the loudness envelope and speech regions. */
export async function decodeSpeech(file: Blob, onProgress?: (fraction: number) => void): Promise<DecodedAudio> {
  const { ALL_FORMATS, AudioBufferSink, BlobSource, Input } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return EMPTY_AUDIO;
    const duration = await track.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) return EMPTY_AUDIO;
    const length = Math.ceil((duration + 1) * SPEECH_RATE);
    const sums = new Float32Array(length);
    const counts = new Uint16Array(length);
    const sink = new AudioBufferSink(track);
    let last = 0;
    for await (const { buffer, timestamp } of sink.buffers()) {
      const channels = buffer.numberOfChannels;
      const data: Float32Array[] = [];
      for (let c = 0; c < channels; c += 1) data.push(buffer.getChannelData(c));
      const step = SPEECH_RATE / buffer.sampleRate;
      const origin = timestamp * SPEECH_RATE;
      for (let i = 0; i < buffer.length; i += 1) {
        const index = Math.floor(origin + i * step);
        if (index < 0 || index >= length) continue;
        let mono = data[0][i];
        for (let c = 1; c < channels; c += 1) mono += data[c][i];
        sums[index] += mono / channels;
        counts[index] += 1;
      }
      const now = timestamp + buffer.duration;
      if (onProgress && now - last > 2) {
        last = now;
        onProgress(Math.min(1, now / duration));
      }
    }
    const samples = new Float32Array(Math.ceil(duration * SPEECH_RATE));
    for (let i = 0; i < samples.length; i += 1) samples[i] = counts[i] ? sums[i] / counts[i] : 0;
    const env = envelope(samples, SPEECH_RATE, ENV_HOP);
    return { samples, rate: SPEECH_RATE, duration, hasAudio: true, env, regions: speechRegions(env) };
  } catch {
    return EMPTY_AUDIO;
  } finally {
    input.dispose();
  }
}
