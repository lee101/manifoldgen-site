'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  Gauge,
  Loader2,
  Mic2,
  Play,
  RefreshCcw,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  Volume2,
  WandSparkles,
} from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '../../lib/auth';
import { parseJSONResponse } from '../../lib/http';
import { CREDITS_UPDATED_EVENT, openPaymentDialog } from '../../lib/payments';
import styles from './page.module.css';

type VoiceModel = {
  id: string;
  name: string;
  description: string;
  max_characters: number;
  voices?: string[];
  formats: string[];
  sample_rates?: number[];
  supports_speed: boolean;
  supports_pitch: boolean;
  supports_volume: boolean;
  supports_mood: boolean;
  supports_voice_details: boolean;
  price_usd_per_1000_characters?: number;
  price_usd_per_minute?: number;
  markup: number;
};

type VoiceResult = {
  id: string;
  audio_url: string;
  filename: string;
  title?: string;
  duration_seconds?: number;
  format: string;
  seed?: number;
  created_at?: string;
};

type GenerateResponse = {
  model: string;
  results: VoiceResult[];
  errors?: string[];
  credits_used: number;
  credits_remain: number;
  cost_usd: number;
};

type SavedSettings = {
  model: string;
  batchSize: number;
  voice: string;
  voiceDetails: string;
  mood: 'angry' | 'neutral' | 'happy';
  speed: number;
  pitch: number;
  volume: number;
  outputFormat: string;
  sampleRate: number;
};

const DEFAULTS: SavedSettings = {
  model: 'seed-audio-1',
  batchSize: 1,
  voice: '',
  voiceDetails: '',
  mood: 'neutral',
  speed: 1,
  pitch: 0,
  volume: 1,
  outputFormat: 'mp3',
  sampleRate: 24000,
};

const SETTINGS_KEY = 'manifold_voice_studio_settings_v1';

function loadSettings(): SavedSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return DEFAULTS;
  }
}

function formatDuration(seconds = 0) {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export default function VoiceStudioPage() {
  const [models, setModels] = useState<VoiceModel[]>([]);
  const [settings, setSettings] = useState<SavedSettings>(DEFAULTS);
  const [text, setText] = useState('');
  const [user, setUser] = useState<StoredUser | null>(null);
  const [creditPrice, setCreditPrice] = useState(0.01);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [results, setResults] = useState<VoiceResult[]>([]);
  const [playing, setPlaying] = useState('');
  const [playbackProgress, setPlaybackProgress] = useState<Record<string, number>>({});
  const [deleting, setDeleting] = useState('');

  const selected = useMemo(() => models.find((model) => model.id === settings.model) || models[0], [models, settings.model]);
  const characterCount = Array.from(text).length;
  const estimatedUSD = useMemo(() => {
    if (!selected || !characterCount) return 0;
    if (selected.price_usd_per_1000_characters) return selected.price_usd_per_1000_characters * characterCount / 1000 * settings.batchSize;
    const seconds = Math.min(120, Math.max(1, characterCount / 12 / settings.speed));
    return (selected.price_usd_per_minute || 0) * seconds / 60 * settings.batchSize;
  }, [characterCount, selected, settings.batchSize, settings.speed]);

  useEffect(() => {
    setSettings(loadSettings());
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.credit_price_usd) setCreditPrice(stored.credit_price_usd);
    if (stored) {
      void fetch('/api/voice/generations', { headers: { Authorization: `Bearer ${stored.api_key}` } })
        .then((response) => parseJSONResponse<{ results?: VoiceResult[] }>(response, 'Could not load voice history'))
        .then((data) => setResults(data.results || []))
        .catch(() => undefined);
      void refreshUser(stored.api_key).then((next) => {
        if (!next) return;
        setUser(next);
        if (next.credit_price_usd) setCreditPrice(next.credit_price_usd);
      });
    }
    fetch('/api/voice/models').then((response) => parseJSONResponse<{ models: VoiceModel[]; credit_price_usd?: number }>(response, 'Could not load voice models')).then((data) => {
      setModels(data.models || []);
      if (data.credit_price_usd) setCreditPrice(data.credit_price_usd);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load voice models'));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setSettings((current) => ({
      ...current,
      model: selected.id,
      voice: selected.voices?.includes(current.voice) ? current.voice : selected.voices?.[0] || '',
      outputFormat: selected.formats.includes(current.outputFormat) ? current.outputFormat : selected.formats[0],
      sampleRate: selected.sample_rates?.includes(current.sampleRate) ? current.sampleRate : selected.sample_rates?.[0] || 24000,
    }));
  }, [selected]);

  function chooseModel(model: VoiceModel) {
    setSettings((current) => ({ ...current, model: model.id, voice: model.voices?.[0] || '', outputFormat: model.formats[0], sampleRate: model.sample_rates?.[0] || 24000 }));
    setModelMenuOpen(false);
    setError('');
  }

  function resetAdvanced() {
    setSettings((current) => ({ ...current, mood: 'neutral', speed: 1, pitch: 0, volume: 1, outputFormat: selected?.formats[0] || 'mp3', sampleRate: selected?.sample_rates?.[0] || 24000 }));
  }

  function saveSettings() {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setNotice('Voice settings saved');
    window.setTimeout(() => setNotice(''), 2400);
  }

  async function generate() {
    if (!selected || busy) return;
    if (!user) {
      setError('Sign in from Account before generating a voice.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice(`Generating ${settings.batchSize === 1 ? 'voice' : `${settings.batchSize} variations`} with ${selected.name}…`);
    try {
      const response = await fetch('/api/voice/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.api_key}` },
        body: JSON.stringify({
          model: selected.id,
          text: text.trim(),
          batch_size: settings.batchSize,
          voice: settings.voice,
          voice_details: settings.voiceDetails,
          mood: settings.mood,
          speed: settings.speed,
          pitch: settings.pitch,
          volume: settings.volume,
          output_format: settings.outputFormat,
          sample_rate: settings.sampleRate,
          language: 'auto',
        }),
      });
      const data = await parseJSONResponse<GenerateResponse>(response, 'Voice generation failed');
      setResults((current) => [...(data.results || []), ...current.filter((item) => !data.results.some((created) => created.id === item.id))]);
      const nextUser = { ...user, credits: data.credits_remain, credits_usd: data.credits_remain * creditPrice };
      setUser(nextUser);
      saveUser(nextUser);
      window.dispatchEvent(new CustomEvent(CREDITS_UPDATED_EVENT));
      setNotice(`${data.results.length} ${data.results.length === 1 ? 'voice' : 'voices'} ready · $${data.cost_usd.toFixed(4)}`);
      if (data.errors?.length) setError(`${data.errors.length} batch ${data.errors.length === 1 ? 'item' : 'items'} failed and were not charged.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Voice generation failed');
      setNotice('');
    } finally {
      setBusy(false);
    }
  }

  function toggleAudio(id: string) {
    const audio = document.getElementById(`voice-${id}`) as HTMLAudioElement | null;
    if (!audio) return;
    document.querySelectorAll<HTMLAudioElement>('audio[data-voice-result]').forEach((candidate) => {
      if (candidate !== audio) candidate.pause();
    });
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  function updatePlayback(id: string, audio: HTMLAudioElement) {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    setPlaybackProgress((current) => ({ ...current, [id]: duration ? Math.min(1, audio.currentTime / duration) : 0 }));
  }

  function seekAudio(event: React.MouseEvent<HTMLDivElement>, id: string) {
    const audio = document.getElementById(`voice-${id}`) as HTMLAudioElement | null;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    audio.currentTime = progress * audio.duration;
    setPlaybackProgress((current) => ({ ...current, [id]: progress }));
  }

  async function downloadVoice(result: VoiceResult) {
    try {
      const response = await fetch(result.audio_url);
      if (!response.ok) throw new Error('Could not download voice');
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = result.filename || 'voice.mp3';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not download voice');
    }
  }

  async function deleteVoice(result: VoiceResult) {
    if (!user || deleting || !window.confirm(`Delete ${result.filename}? This also removes its stored audio.`)) return;
    setDeleting(result.id);
    setError('');
    const audio = document.getElementById(`voice-${result.id}`) as HTMLAudioElement | null;
    audio?.pause();
    try {
      const response = await fetch(`/api/voice/generations/${encodeURIComponent(result.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.api_key}` },
      });
      await parseJSONResponse<{ deleted: boolean }>(response, 'Could not delete voice');
      setResults((current) => current.filter((item) => item.id !== result.id));
      setPlaybackProgress((current) => {
        const next = { ...current };
        delete next[result.id];
        return next;
      });
      setNotice(`${result.filename} deleted`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not delete voice');
    } finally {
      setDeleting('');
    }
  }

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <div className={styles.brandSide}>
        <Link href="/" className={styles.back} aria-label="Back to ManifoldGen"><ArrowLeft size={17} /></Link>
        <Link href="/" className={styles.brand}><img src="/brand/logo-mark.webp" alt="" /><span>MANIFOLD</span></Link>
        <span className={styles.divider} />
        <div className={styles.title}><Mic2 size={16} /><span>Voice Studio</span><em>BETA</em></div>
      </div>
      <div className={styles.accountSide}>
        <span className={styles.balance}>{user ? `${Math.round(user.credits).toLocaleString()} cr` : 'Not signed in'}</span>
        <button onClick={() => openPaymentDialog({ message: 'Add credits to keep generating voices.' })}>Top up</button>
        <Link href="/account" aria-label="Account"><UserRound size={17} /></Link>
      </div>
    </header>

    <section className={styles.hero}>
      <div><span className={styles.eyebrow}>TEXT TO PERFORMANCE</span><h1>Give every line a voice.</h1><p>Natural narration, expressive delivery, and full cinematic audio scenes—all in one workspace.</p></div>
      <div className={styles.marginBadge}><Check size={15} /><span><b>Usage pricing</b><small>Provider cost + 20%</small></span></div>
    </section>

    <div className={styles.workspace}>
      <section className={styles.composer}>
        <div className={styles.controlGrid}>
          <div className={styles.modelControl}>
            <label>Model</label>
            <button className={styles.modelButton} aria-expanded={modelMenuOpen} onClick={() => setModelMenuOpen((open) => !open)}>
              <span className={styles.modelGlyph}><WandSparkles size={17} /></span><span><b>{selected?.name || 'Loading models…'}</b><small>{selected?.description || 'Connecting to voice providers'}</small></span><ChevronDown size={15} />
            </button>
            {modelMenuOpen && <div className={styles.modelMenu}>
              {models.map((model) => <button key={model.id} className={model.id === selected?.id ? styles.modelSelected : ''} onClick={() => chooseModel(model)}>
                <span className={styles.modelGlyph}><Mic2 size={15} /></span><span><b>{model.name}</b><small>{model.description}</small></span>{model.id === selected?.id && <Check size={15} />}
              </button>)}
            </div>}
          </div>
          <div className={styles.batchControl}><label>Batch size</label><div>{[1, 2, 3, 4].map((size) => <button key={size} className={settings.batchSize === size ? styles.batchActive : ''} onClick={() => setSettings((current) => ({ ...current, batchSize: size }))}>{size}<span>/4</span></button>)}</div></div>
        </div>

        <div className={styles.scriptField}>
          <div><label htmlFor="voice-script">Script</label><span>{characterCount}/{selected?.max_characters || 5000}</span></div>
          <textarea id="voice-script" value={text} maxLength={selected?.max_characters || 5000} onChange={(event) => setText(event.target.value)} placeholder={selected?.id === 'seed-audio-1' ? 'Describe dialogue, speakers, sound effects, and ambience—or enter a line to speak…' : 'Write the words you want brought to life…'} />
          {selected?.id === 'eleven-v3' && <small>Try inline tags such as [whispers], [excited], [laughs], or [British accent].</small>}
          {selected?.id === 'minimax-2.8-hd' && <small>Use (laughs), (sighs), or &lt;#0.5#&gt; for a precise pause.</small>}
        </div>

        <div className={styles.optional}><span>Optional</span></div>
        <div className={styles.optionalGrid}>
          {selected?.voices?.length ? <label className={styles.field}><span>Voice</span><select value={settings.voice} onChange={(event) => setSettings((current) => ({ ...current, voice: event.target.value }))}>{selected.voices.map((voice) => <option key={voice} value={voice}>{voice.replaceAll('_', ' ')}</option>)}</select></label> : <div />}
          <label className={`${styles.field} ${styles.detailsField}`}><span>Voice details <em>{settings.voiceDetails.length}/500</em></span><input value={settings.voiceDetails} maxLength={500} disabled={!selected?.supports_voice_details} onChange={(event) => setSettings((current) => ({ ...current, voiceDetails: event.target.value }))} placeholder={selected?.supports_voice_details ? 'e.g. Young British voice, soft but excited, occasional giggle' : `Style this model with ${selected?.supports_mood ? 'mood or inline tags' : 'its voice preset'}`} /></label>
        </div>

        <div className={styles.advanced}>
          <button className={styles.advancedHeader} onClick={() => setAdvancedOpen((open) => !open)}><span><Settings2 size={15} />Advanced settings<small>{selected?.name} controls</small></span><ChevronDown className={advancedOpen ? styles.chevronOpen : ''} size={16} /></button>
          {advancedOpen && <div className={styles.advancedBody}>
            <div className={styles.advancedTitle}><span>Delivery</span><button onClick={resetAdvanced}><RefreshCcw size={12} />Reset</button></div>
            <div className={styles.moodRow}><label>Mood</label><div>{(['angry', 'neutral', 'happy'] as const).map((mood) => <button disabled={!selected?.supports_mood} key={mood} className={settings.mood === mood ? styles.moodActive : ''} onClick={() => setSettings((current) => ({ ...current, mood }))}>{mood[0].toUpperCase() + mood.slice(1)}</button>)}</div></div>
            <div className={styles.sliders}>
              <label className={!selected?.supports_speed ? styles.unsupported : ''}><span><Gauge size={14} />Speed <b>{settings.speed.toFixed(1)}×</b></span><input disabled={!selected?.supports_speed} type="range" min="0.5" max="2" step="0.1" value={settings.speed} onChange={(event) => setSettings((current) => ({ ...current, speed: Number(event.target.value) }))} /></label>
              <label className={!selected?.supports_pitch ? styles.unsupported : ''}><span><Sparkles size={14} />Pitch <b>{settings.pitch > 0 ? '+' : ''}{settings.pitch}</b></span><input disabled={!selected?.supports_pitch} type="range" min="-12" max="12" step="1" value={settings.pitch} onChange={(event) => setSettings((current) => ({ ...current, pitch: Number(event.target.value) }))} /></label>
              <label className={!selected?.supports_volume ? styles.unsupported : ''}><span><Volume2 size={14} />Volume <b>{Math.round(settings.volume * 100)}%</b></span><input disabled={!selected?.supports_volume} type="range" min="0.1" max="2" step="0.1" value={settings.volume} onChange={(event) => setSettings((current) => ({ ...current, volume: Number(event.target.value) }))} /></label>
            </div>
            <div className={styles.audioSettings}><span>Audio settings</span><div>
              <label>Output format<select value={settings.outputFormat} onChange={(event) => setSettings((current) => ({ ...current, outputFormat: event.target.value }))}>{selected?.formats.map((format) => <option value={format} key={format}>{format === 'ogg_opus' ? 'OGG Opus' : format.toUpperCase()}</option>)}</select></label>
              <label>Sample rate<select value={settings.sampleRate} onChange={(event) => setSettings((current) => ({ ...current, sampleRate: Number(event.target.value) }))}>{selected?.sample_rates?.map((rate) => <option value={rate} key={rate}>{rate / 1000} kHz</option>)}</select></label>
            </div></div>
            <button className={styles.saveSettings} onClick={saveSettings}><Check size={13} />Save settings</button>
          </div>}
        </div>

        {error && <div className={styles.error} role="alert">{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}
        <div className={styles.generateBar}>
          <div><span>Estimated usage</span><b>{estimatedUSD ? `$${estimatedUSD.toFixed(4)} · ${(estimatedUSD / creditPrice).toFixed(2)} cr` : 'Add a script to estimate'}</b><small>Includes 20% service margin</small></div>
          <button disabled={busy || !text.trim() || characterCount > (selected?.max_characters || 5000)} onClick={() => void generate()}>{busy ? <Loader2 className={styles.spin} size={17} /> : <Sparkles size={17} />}{busy ? 'Generating…' : `Generate${settings.batchSize > 1 ? ` ${settings.batchSize} voices` : ' voice'}`}</button>
        </div>
      </section>

      <aside className={styles.outputPanel}>
        <div className={styles.outputHeader}><span><Volume2 size={15} />Output</span>{results.length > 0 && <small>{results.length} take{results.length === 1 ? '' : 's'}</small>}</div>
        {!results.length ? <div className={styles.emptyOutput}><span><Mic2 size={30} /></span><h2>Your voices will appear here</h2><p>Choose a model, tune the delivery, and generate up to four takes at once.</p></div> : <div className={styles.results}>
          {results.map((result, index) => {
            const progress = playbackProgress[result.id] || 0;
            return <article key={result.id}>
            <div className={styles.takeTop}><span title={result.filename}>{result.filename || `voice-${index + 1}.${result.format}`}</span><small>{formatDuration(result.duration_seconds)} · {result.format.replace('ogg_opus', 'opus').toUpperCase()}</small></div>
            <div className={styles.player}>
              <button onClick={() => toggleAudio(result.id)}>{playing === result.id ? <Square size={15} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button>
              <div className={styles.wave} role="slider" aria-label={`Playback position for ${result.filename}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} onClick={(event) => seekAudio(event, result.id)}>{Array.from({ length: 38 }, (_, bar) => <i key={bar} className={(bar + 1) / 38 <= progress ? styles.wavePlayed : ''} style={{ height: `${24 + ((bar * 37 + index * 19) % 72)}%` }} />)}<span style={{ left: `${progress * 100}%` }} /></div>
              <audio id={`voice-${result.id}`} data-voice-result src={result.audio_url} preload="metadata" onTimeUpdate={(event) => updatePlayback(result.id, event.currentTarget)} onLoadedMetadata={(event) => updatePlayback(result.id, event.currentTarget)} onPlay={() => setPlaying(result.id)} onPause={() => setPlaying((current) => current === result.id ? '' : current)} onEnded={(event) => { event.currentTarget.currentTime = 0; setPlaybackProgress((current) => ({ ...current, [result.id]: 0 })); setPlaying(''); }} />
            </div>
            <div className={styles.takeActions}><button onClick={() => void downloadVoice(result)}><Download size={14} />Download</button><Link href={`/studio?audio_url=${encodeURIComponent(result.audio_url)}&name=${encodeURIComponent(result.filename || `voice-${index + 1}.${result.format}`)}`}><WandSparkles size={14} />Open in editor</Link><button aria-label={`Delete ${result.filename}`} className={styles.deleteTake} disabled={deleting === result.id} onClick={() => void deleteVoice(result)}>{deleting === result.id ? <Loader2 className={styles.spin} size={14} /> : <Trash2 size={14} />}<span>Delete</span></button></div>
          </article>})}
        </div>}
        <div className={styles.modelFoot}><span>POWERED BY</span><b>{selected?.name || 'Voice providers'}</b><small>{selected?.price_usd_per_1000_characters ? `$${selected.price_usd_per_1000_characters.toFixed(3)} / 1k characters` : `$${(selected?.price_usd_per_minute || 0).toFixed(3)} / minute`} retail</small></div>
      </aside>
    </div>
  </main>;
}
