// Browser port of https://github.com/lee101/audio-understanding
// (librosa-based audio_keypoint_detection.py). Mirrors server/audio_understanding.go
// step for step so the dramatizer can pick beat-synced cuts client-side before
// the job is submitted, and so the two implementations can be diffed on
// identical PCM (see tests/audio-parity.test.ts).

export const AUDIO_SAMPLE_RATE = 22050;
export const AUDIO_HOP_LENGTH = 1024;
export const AUDIO_N_FFT = 2048;
export const AUDIO_N_MELS = 128;

export type AudioAnalysis = {
  sample_rate: number;
  hop_length: number;
  n_fft: number;
  duration: number;
  tempo: number;
  onset_times: number[];
  beat_times: number[];
  times?: number[];
  onset_envelope?: number[];
  rms?: number[];
  spectral_centroid?: number[];
  spectral_rolloff?: number[];
  zero_crossing_rate?: number[];
};

export type AudioAnalysisOptions = {
  sampleRate?: number;
  hopLength?: number;
  nFFT?: number;
  nMels?: number;
  preMax?: number;
  postMax?: number;
  preAvg?: number;
  postAvg?: number;
  delta?: number;
  wait?: number;
  startBPM?: number;
  tightness?: number;
  includeSeries?: boolean;
};

type ResolvedOptions = Required<AudioAnalysisOptions>;

/** Defaults reproduce the upstream script's tuned parameters. */
export function defaultAudioAnalysisOptions(): ResolvedOptions {
  const sampleRate = AUDIO_SAMPLE_RATE;
  const hopLength = AUDIO_HOP_LENGTH;
  return {
    sampleRate,
    hopLength,
    nFFT: AUDIO_N_FFT,
    nMels: AUDIO_N_MELS,
    preMax: 5,
    postMax: 5,
    preAvg: Math.trunc((0.1 * sampleRate) / hopLength),
    postAvg: Math.trunc((0.1 * sampleRate) / hopLength) + 1,
    delta: 0.2,
    wait: Math.trunc((0.03 * sampleRate) / hopLength),
    startBPM: 60,
    tightness: 100,
    includeSeries: false,
  };
}

function resolveOptions(opts: AudioAnalysisOptions = {}): ResolvedOptions {
  return { ...defaultAudioAnalysisOptions(), ...opts };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

/**
 * Decodes a media file in the browser and analyses its audio track. Works for
 * video files too — decodeAudioData reads the audio stream out of an MP4.
 */
export async function analyzeAudioFile(
  source: Blob | ArrayBuffer,
  opts: AudioAnalysisOptions = {},
): Promise<AudioAnalysis> {
  const resolved = resolveOptions(opts);
  const samples = await decodeAudioMono(source, resolved.sampleRate);
  return analyzeAudioSamples(samples, resolved);
}

/**
 * Decodes to mono at the requested rate. OfflineAudioContext does the resample
 * so we match ffmpeg's `-ac 1 -ar <sr>` on the server closely enough for the
 * frame-level agreement the parity test asserts.
 */
export async function decodeAudioMono(
  source: Blob | ArrayBuffer,
  sampleRate = AUDIO_SAMPLE_RATE,
): Promise<Float64Array> {
  const bytes = source instanceof ArrayBuffer ? source : await source.arrayBuffer();

  const Ctx: typeof AudioContext =
    (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ||
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!;
  if (!Ctx) throw new Error('Web Audio is not available in this browser');

  const decoder = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(bytes.slice(0));
  } finally {
    void decoder.close();
  }
  if (!decoded.length) return new Float64Array(0);

  // Resample and downmix in one pass.
  const frames = Math.max(1, Math.ceil((decoded.duration || 0) * sampleRate));
  const offline = new OfflineAudioContext(1, frames, sampleRate);
  const node = offline.createBufferSource();
  node.buffer = decoded;
  node.connect(offline.destination);
  node.start();
  const rendered = await offline.startRendering();

  const channel = rendered.getChannelData(0);
  const out = new Float64Array(channel.length);
  for (let i = 0; i < channel.length; i += 1) out[i] = channel[i];
  return out;
}

/** Runs the full feature pipeline on mono PCM. Pure — safe outside a browser. */
export function analyzeAudioSamples(
  y: Float64Array | Float32Array | number[],
  opts: AudioAnalysisOptions = {},
): AudioAnalysis {
  const o = resolveOptions(opts);
  const samples = y instanceof Float64Array ? y : Float64Array.from(y);
  const { sampleRate: sr, hopLength: hop, nFFT: nfft } = o;

  const result: AudioAnalysis = {
    sample_rate: sr,
    hop_length: hop,
    n_fft: nfft,
    duration: samples.length / sr,
    tempo: 0,
    onset_times: [],
    beat_times: [],
  };
  if (samples.length < nfft) return result;

  const spec = stftPower(samples, nfft, hop);
  const mel = melFilterBank(sr, nfft, o.nMels, 0, sr / 2);
  const melSpec = applyFilterBank(spec, mel);
  const melDB = powerToDBRefMax(melSpec, 80);

  const onsetEnv = onsetStrength(melDB);
  const onsetEnvNorm = normalizeMax(onsetEnv);

  const onsetFrames = peakPick(onsetEnvNorm, o.preMax, o.postMax, o.preAvg, o.postAvg, o.delta, o.wait);
  result.onset_times = framesToTime(onsetFrames, sr, hop);

  const tempo = estimateTempo(onsetEnv, sr, hop, o.startBPM);
  const beatFrames = beatTrackDP(onsetEnv, sr, hop, tempo, o.tightness);
  result.tempo = tempo;
  result.beat_times = framesToTime(beatFrames, sr, hop);

  if (o.includeSeries) {
    result.times = Array.from({ length: spec.length }, (_, i) => (i * hop) / sr);
    result.onset_envelope = Array.from(onsetEnv);
    result.rms = Array.from(rmsFromPower(spec, nfft));
    const [centroid, rolloff] = spectralCentroidRolloff(spec, sr, nfft, 0.85);
    result.spectral_centroid = Array.from(centroid);
    result.spectral_rolloff = Array.from(rolloff);
    result.zero_crossing_rate = Array.from(zeroCrossingRate(samples, nfft, hop));
  }
  return result;
}

// ---------------------------------------------------------------------------
// FFT / STFT
// ---------------------------------------------------------------------------

function hannWindow(n: number): Float64Array {
  const w = new Float64Array(n);
  if (n === 1) {
    w[0] = 1;
    return w;
  }
  // Periodic Hann, matching scipy's get_window('hann', n, fftbins=True).
  for (let i = 0; i < n; i += 1) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  return w;
}

/** Iterative radix-2 Cooley-Tukey FFT; n must be a power of two. */
function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const ang = (-2 * Math.PI) / length;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = length / 2;
    for (let i = 0; i < n; i += length) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < half; j += 1) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + half] * curRe - im[i + j + half] * curIm;
        const vIm = re[i + j + half] * curIm + im[i + j + half] * curRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + half] = uRe - vRe;
        im[i + j + half] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

function reflectIndex(i: number, n: number): number {
  if (n === 1) return 0;
  const period = 2 * (n - 1);
  let k = ((i % period) + period) % period;
  if (k >= n) k = period - k;
  return k;
}

/** Mirrors librosa's center=True padding (np.pad mode='reflect'). */
function reflectPad(y: Float64Array, pad: number): Float64Array {
  const n = y.length;
  if (pad <= 0) return y;
  const out = new Float64Array(n + 2 * pad);
  for (let i = 0; i < pad; i += 1) {
    out[i] = y[reflectIndex(pad - i, n)];
    out[n + pad + i] = y[reflectIndex(n - 2 - i, n)];
  }
  out.set(y, pad);
  return out;
}

/** |STFT|^2 as frames x (nfft/2+1), centered like librosa. */
function stftPower(y: Float64Array, nfft: number, hop: number): Float64Array[] {
  const padded = reflectPad(y, nfft >> 1);
  const window = hannWindow(nfft);
  const bins = (nfft >> 1) + 1;
  const nFrames = 1 + Math.floor(y.length / hop);

  const out: Float64Array[] = [];
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  for (let f = 0; f < nFrames; f += 1) {
    const start = f * hop;
    if (start + nfft > padded.length) break;
    for (let i = 0; i < nfft; i += 1) {
      re[i] = padded[start + i] * window[i];
      im[i] = 0;
    }
    fftInPlace(re, im);
    const row = new Float64Array(bins);
    for (let b = 0; b < bins; b += 1) row[b] = re[b] * re[b] + im[b] * im[b];
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Mel scale (librosa slaney)
// ---------------------------------------------------------------------------

const MEL_F_SP = 200 / 3;
const MEL_MIN_LOG_HZ = 1000;
const MEL_MIN_LOG_MEL = MEL_MIN_LOG_HZ / MEL_F_SP;
const MEL_LOG_STEP = Math.log(6.4) / 27;

function hzToMel(f: number): number {
  if (f < MEL_MIN_LOG_HZ) return f / MEL_F_SP;
  return MEL_MIN_LOG_MEL + Math.log(f / MEL_MIN_LOG_HZ) / MEL_LOG_STEP;
}

function melToHz(m: number): number {
  if (m < MEL_MIN_LOG_MEL) return m * MEL_F_SP;
  return MEL_MIN_LOG_HZ * Math.exp(MEL_LOG_STEP * (m - MEL_MIN_LOG_MEL));
}

function melFilterBank(sr: number, nfft: number, nMels: number, fmin: number, fmax: number): Float64Array[] {
  const top = fmax > 0 ? fmax : sr / 2;
  const bins = (nfft >> 1) + 1;
  const fftFreqs = new Float64Array(bins);
  for (let i = 0; i < bins; i += 1) fftFreqs[i] = (i * sr) / nfft;

  const melMin = hzToMel(fmin);
  const melMax = hzToMel(top);
  const melPts = new Float64Array(nMels + 2);
  for (let i = 0; i < melPts.length; i += 1) {
    melPts[i] = melToHz(melMin + ((melMax - melMin) * i) / (nMels + 1));
  }

  const bank: Float64Array[] = [];
  for (let m = 0; m < nMels; m += 1) {
    const row = new Float64Array(bins);
    const lower = melPts[m];
    const center = melPts[m + 1];
    const upper = melPts[m + 2];
    const enorm = 2 / (upper - lower);
    for (let k = 0; k < bins; k += 1) {
      const f = fftFreqs[k];
      let w = 0;
      if (f >= lower && f <= center && center > lower) w = (f - lower) / (center - lower);
      else if (f > center && f <= upper && upper > center) w = (upper - f) / (upper - center);
      if (w > 0) row[k] = w * enorm;
    }
    bank.push(row);
  }
  return bank;
}

function applyFilterBank(spec: Float64Array[], bank: Float64Array[]): Float64Array[] {
  return spec.map((frame) => {
    const row = new Float64Array(bank.length);
    for (let m = 0; m < bank.length; m += 1) {
      const filt = bank[m];
      let sum = 0;
      for (let k = 0; k < filt.length; k += 1) {
        if (filt[k] !== 0 && k < frame.length) sum += filt[k] * frame[k];
      }
      row[m] = sum;
    }
    return row;
  });
}

/** Matches librosa.power_to_db(S, ref=np.max, top_db=topDB). */
function powerToDBRefMax(s: Float64Array[], topDB: number): Float64Array[] {
  const amin = 1e-10;
  let ref = amin;
  for (const row of s) for (const v of row) if (v > ref) ref = v;
  const logRef = 10 * Math.log10(Math.max(amin, ref));

  let maxDB = -Infinity;
  const out = s.map((row) => {
    const dst = new Float64Array(row.length);
    for (let i = 0; i < row.length; i += 1) {
      const db = 10 * Math.log10(Math.max(amin, row[i])) - logRef;
      dst[i] = db;
      if (db > maxDB) maxDB = db;
    }
    return dst;
  });
  if (topDB > 0 && Number.isFinite(maxDB)) {
    const floor = maxDB - topDB;
    for (const row of out) {
      for (let i = 0; i < row.length; i += 1) if (row[i] < floor) row[i] = floor;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Onsets
// ---------------------------------------------------------------------------

/**
 * Rectified first-order difference of the mel dB spectrogram averaged over mel
 * bands (librosa.onset.onset_strength, lag=1). Frame 0 has no predecessor, so a
 * transient at exactly t=0 is not detectable — same as librosa.
 */
function onsetStrength(melDB: Float64Array[]): Float64Array {
  const n = melDB.length;
  const env = new Float64Array(n);
  if (n < 2) return env;
  const nMels = melDB[0].length;
  for (let t = 1; t < n; t += 1) {
    let sum = 0;
    for (let m = 0; m < nMels; m += 1) {
      const d = melDB[t][m] - melDB[t - 1][m];
      if (d > 0) sum += d;
    }
    env[t] = sum / nMels;
  }
  return env;
}

function normalizeMax(x: Float64Array): Float64Array {
  let max = 0;
  for (const v of x) if (v > max) max = v;
  const out = new Float64Array(x.length);
  if (max <= 0) return out;
  for (let i = 0; i < x.length; i += 1) out[i] = x[i] / max;
  return out;
}

/** Reproduces librosa.util.peak_pick. */
function peakPick(
  x: Float64Array,
  preMax: number,
  postMax: number,
  preAvg: number,
  postAvg: number,
  delta: number,
  wait: number,
): number[] {
  const n = x.length;
  const peaks: number[] = [];
  if (!n) return peaks;
  let lastPeak = -1 - wait;
  for (let i = 0; i < n; i += 1) {
    let lo = Math.max(0, i - preMax);
    let hi = Math.min(n, i + postMax + 1);
    let isMax = true;
    for (let j = lo; j < hi; j += 1) {
      if (x[j] > x[i]) {
        isMax = false;
        break;
      }
    }
    if (!isMax) continue;

    lo = Math.max(0, i - preAvg);
    hi = Math.min(n, i + postAvg + 1);
    let sum = 0;
    for (let j = lo; j < hi; j += 1) sum += x[j];
    if (x[i] < sum / (hi - lo) + delta) continue;

    if (i > lastPeak + wait) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  return peaks;
}

function framesToTime(frames: number[], sr: number, hop: number): number[] {
  return frames.map((f) => (f * hop) / sr);
}

// ---------------------------------------------------------------------------
// Tempo + beat tracking (Ellis dynamic-programming tracker, as in librosa)
// ---------------------------------------------------------------------------

function estimateTempo(onsetEnv: Float64Array, sr: number, hop: number, startBPM: number): number {
  const n = onsetEnv.length;
  if (n < 4) return startBPM;
  const frameRate = sr / hop;

  let mean = 0;
  for (const v of onsetEnv) mean += v;
  mean /= n;
  const centered = new Float64Array(n);
  for (let i = 0; i < n; i += 1) centered[i] = onsetEnv[i] - mean;

  // Search 30..300 BPM.
  const minLag = Math.max(1, Math.floor((frameRate * 60) / 300));
  const maxLag = Math.min(n - 1, Math.ceil((frameRate * 60) / 30));
  if (maxLag <= minLag) return startBPM;

  let best = -Infinity;
  let bestLag = minLag;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let acf = 0;
    for (let i = lag; i < n; i += 1) acf += centered[i] * centered[i - lag];
    acf /= n - lag;
    const bpm = (60 * frameRate) / lag;
    // librosa's log-normal tempo prior, std = 1.0 octave.
    const z = Math.log2(bpm) - Math.log2(startBPM);
    const score = acf * Math.exp(-0.5 * z * z);
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  return (60 * frameRate) / bestLag;
}

function beatTrackDP(
  onsetEnv: Float64Array,
  sr: number,
  hop: number,
  tempo: number,
  tightness: number,
): number[] {
  const n = onsetEnv.length;
  if (n < 3 || tempo <= 0) return [];
  const frameRate = sr / hop;
  const period = Math.max(1, Math.round((60 * frameRate) / tempo));
  if (period >= n) return [];

  // Local score: onset envelope convolved with a Gaussian of width ~period.
  const half = period;
  const kernel = new Float64Array(2 * half + 1);
  for (let i = 0; i < kernel.length; i += 1) {
    const x = ((i - half) * 32) / period;
    kernel[i] = Math.exp(-0.5 * x * x);
  }
  let std = stdDev(onsetEnv);
  if (std <= 0) std = 1;
  const local = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    let sum = 0;
    for (let k = 0; k < kernel.length; k += 1) {
      const j = i + k - half;
      if (j >= 0 && j < n) sum += (kernel[k] * onsetEnv[j]) / std;
    }
    local[i] = sum;
  }

  const backlink = new Int32Array(n);
  const cumscore = new Float64Array(n);
  const loLag = Math.max(1, period >> 1);
  const hiLag = 2 * period;
  const firstThreshold = 0.01 * maxOf(local);

  for (let i = 0; i < n; i += 1) {
    let bestScore = -Infinity;
    let bestLag = -1;
    for (let lag = loLag; lag <= hiLag; lag += 1) {
      const j = i - lag;
      if (j < 0) break;
      // Penalise deviation from the expected period.
      const z = Math.log(lag / period);
      const score = cumscore[j] - tightness * z * z;
      if (score > bestScore) {
        bestScore = score;
        bestLag = j;
      }
    }
    if (bestLag < 0) {
      cumscore[i] = local[i];
      backlink[i] = -1;
      continue;
    }
    cumscore[i] = local[i] + bestScore;
    backlink[i] = bestLag;
    // Allow a strong early frame to start a fresh chain.
    if (local[i] > firstThreshold && local[i] > cumscore[i]) {
      cumscore[i] = local[i];
      backlink[i] = -1;
    }
  }

  let tail = -1;
  let best = -Infinity;
  for (let i = 0; i < n; i += 1) {
    if (cumscore[i] > best) {
      best = cumscore[i];
      tail = i;
    }
  }
  if (tail < 0) return [];

  const beats: number[] = [];
  for (let i = tail; i >= 0; i = backlink[i]) {
    beats.push(i);
    if (backlink[i] < 0) break;
  }
  beats.reverse();
  return trimBeats(local, beats);
}

/** librosa's __trim_beats: drop weak beats off the head and tail. */
function trimBeats(local: Float64Array, beats: number[]): number[] {
  if (!beats.length) return beats;
  let sum = 0;
  for (const b of beats) sum += local[b];
  const thresh = 0.5 * Math.sqrt(sum / beats.length);
  let start = 0;
  let end = beats.length - 1;
  while (start <= end && local[beats[start]] < thresh) start += 1;
  while (end >= start && local[beats[end]] < thresh) end -= 1;
  if (start > end) return [];
  return beats.slice(start, end + 1).sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Spectral features
// ---------------------------------------------------------------------------

function rmsFromPower(spec: Float64Array[], nfft: number): Float64Array {
  const out = new Float64Array(spec.length);
  for (let t = 0; t < spec.length; t += 1) {
    const frame = spec[t];
    let sum = 0;
    for (let k = 0; k < frame.length; k += 1) {
      // Interior bins appear twice in the full spectrum.
      sum += k === 0 || k === frame.length - 1 ? frame[k] : 2 * frame[k];
    }
    out[t] = Math.sqrt(sum) / nfft;
  }
  return out;
}

function spectralCentroidRolloff(
  spec: Float64Array[],
  sr: number,
  nfft: number,
  rollPercent: number,
): [Float64Array, Float64Array] {
  const bins = (nfft >> 1) + 1;
  const freqs = new Float64Array(bins);
  for (let i = 0; i < bins; i += 1) freqs[i] = (i * sr) / nfft;

  const centroid = new Float64Array(spec.length);
  const rolloff = new Float64Array(spec.length);
  for (let t = 0; t < spec.length; t += 1) {
    const power = spec[t];
    // librosa's spectral features use magnitude, not power.
    const mag = new Float64Array(power.length);
    let total = 0;
    let weighted = 0;
    for (let k = 0; k < power.length; k += 1) {
      mag[k] = Math.sqrt(power[k]);
      total += mag[k];
      weighted += mag[k] * freqs[k];
    }
    if (total > 0) centroid[t] = weighted / total;
    const target = rollPercent * total;
    let acc = 0;
    rolloff[t] = freqs[freqs.length - 1];
    for (let k = 0; k < mag.length; k += 1) {
      acc += mag[k];
      if (acc >= target) {
        rolloff[t] = freqs[k];
        break;
      }
    }
  }
  return [centroid, rolloff];
}

function zeroCrossingRate(y: Float64Array, frameLength: number, hop: number): Float64Array {
  const padded = reflectPad(y, frameLength >> 1);
  const nFrames = 1 + Math.floor(y.length / hop);
  const out: number[] = [];
  for (let f = 0; f < nFrames; f += 1) {
    const start = f * hop;
    if (start + frameLength > padded.length) break;
    let crossings = 0;
    for (let i = start + 1; i < start + frameLength; i += 1) {
      if (padded[i - 1] >= 0 !== padded[i] >= 0) crossings += 1;
    }
    out.push(crossings / frameLength);
  }
  return Float64Array.from(out);
}

// ---------------------------------------------------------------------------
// Cut-point helpers used by the dramatizer
// ---------------------------------------------------------------------------

/**
 * Cut points for an edit: prefers tracked beats, falls back to strong onsets,
 * and finally to an even grid, always respecting minGap seconds.
 */
export function beatGrid(analysis: AudioAnalysis, minGap: number): number[] {
  let src = analysis.beat_times;
  if (src.length < 2) src = analysis.onset_times;
  if (src.length < 2) {
    if (analysis.duration <= 0 || minGap <= 0) return [];
    const out: number[] = [];
    for (let t = 0; t < analysis.duration; t += minGap) out.push(t);
    return out;
  }
  const out: number[] = [];
  let last = -Infinity;
  for (const t of src) {
    if (t - last >= minGap) {
      out.push(t);
      last = t;
    }
  }
  return out;
}

/** Returns the cut point closest to t, within tolerance seconds. */
export function snapToBeat(analysis: AudioAnalysis, t: number, tolerance: number): number {
  let best = t;
  let bestDist = tolerance;
  for (const candidates of [analysis.beat_times, analysis.onset_times]) {
    for (const c of candidates) {
      const d = Math.abs(c - t);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
  }
  return best;
}

function stdDev(x: Float64Array): number {
  const n = x.length;
  if (n < 2) return 0;
  let mean = 0;
  for (const v of x) mean += v;
  mean /= n;
  let acc = 0;
  for (const v of x) {
    const d = v - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / n);
}

function maxOf(x: Float64Array): number {
  let m = -Infinity;
  for (const v of x) if (v > m) m = v;
  return Number.isFinite(m) ? m : 0;
}
