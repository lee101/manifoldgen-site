'use client';

import './fonts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Captions, Check, Download, FileText, Film, Loader2, Pause, Play, Redo2, Scissors, Sparkles, Trash2, Undo2, Upload, Volume2, VolumeX, Wand2, X,
} from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser, type StoredUser } from '@/lib/auth';
import { ensurePaidAccess, isPaywallError } from '@/lib/paywall';
import { galleryProxyURL } from '@/lib/studio-media-drag';
import { EMPTY_AUDIO, decodeSpeech, type DecodedAudio } from '@/lib/captions/audio';
import { ENV_HOP, autoTime, planChunks, snapWordsChunked } from '@/lib/captions/dsp';
import { exportCaptionedMP4, exportSize, type ExportQuality } from '@/lib/captions/export';
import { FONTS, ensureFonts } from '@/lib/captions/registry';
import { CaptionEngine } from '@/lib/captions/render';
import { BASE_STYLE, DEFAULT_PRESET, FX_ON, PRESETS, applyChaos, applyFx, presetStyle, type FxFlags } from '@/lib/captions/styles';
import { transcribeAudio } from '@/lib/captions/transcribe';
import type { CaptionDoc, CaptionStyle, CaptionWord, Emphasis, Grouping } from '@/lib/captions/types';
import {
  DEFAULT_GROUPING, applyEnergy, buildPages, deleteWord, insertWordAfter, makeWord, mergeWithPrevious, parseSubtitles, realignText, resolveEmphasis, sortWords, splitWordAt, toSRT, toVTT, wordsToText,
} from '@/lib/captions/words';
import { ColorField, Segments, Toggle } from './controls';
import { StylePanel } from './StylePanel';
import { Timeline } from './Timeline';
import { WordFlow } from './WordFlow';
import styles from './crazy-captions.module.css';

type Source = { file: File; url: string; width: number; height: number; duration: number };
type Tab = 'transcript' | 'style' | 'export';

const PREFS = 'mg_crazy_captions_prefs';
const LANGUAGES = ['Auto-detect', 'English', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Dutch', 'Russian', 'Turkish', 'Arabic', 'Hindi', 'Indonesian', 'Japanese', 'Korean', 'Chinese'];
const PREVIEW_SIDE = 1280;

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function clock(seconds: number) {
  const t = Math.max(0, seconds);
  return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 10))}`;
}

async function loadSource(file: File): Promise<Source> {
  if (!file.type.startsWith('video/') && !/\.(mp4|mov|m4v|webm|mkv)$/i.test(file.name)) throw new Error('Choose a video file');
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.muted = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('This video cannot be played in your browser. Try an MP4 (H.264) or WebM.'));
    });
  } catch (reason) {
    URL.revokeObjectURL(url);
    throw reason;
  }
  return { file, url, width: video.videoWidth, height: video.videoHeight, duration: video.duration };
}

function readPrefs(): { style?: CaptionStyle; grouping?: Grouping; chaos?: number; fx?: FxFlags; preset?: string; language?: string } {
  try {
    return JSON.parse(localStorage.getItem(PREFS) || '{}');
  } catch {
    return {};
  }
}

function fileKey(file: File) {
  return `mg_cc_words:${file.name}:${file.size}:${file.lastModified}`;
}

export default function CrazyCaptionsTool() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<CaptionEngine | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<{ past: CaptionWord[][]; future: CaptionWord[][]; lastKey: string; at: number }>({ past: [], future: [], lastKey: '', at: 0 });

  const [user, setUser] = useState<StoredUser | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [audio, setAudio] = useState<DecodedAudio | null>(null);
  const [audioState, setAudioState] = useState<'idle' | 'reading' | 'ready'>('idle');
  const [words, setWordsState] = useState<CaptionWord[]>([]);
  const [style, setStyle] = useState<CaptionStyle>(() => presetStyle(DEFAULT_PRESET));
  const [grouping, setGrouping] = useState<Grouping>(DEFAULT_GROUPING);
  const [chaos, setChaos] = useState(1);
  const [fx, setFx] = useState<FxFlags>(FX_ON);
  const [offset, setOffset] = useState(0);
  const [preset, setPreset] = useState(DEFAULT_PRESET);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [hint, setHint] = useState('');
  const [snap, setSnap] = useState(true);
  const [selected, setSelected] = useState(-1);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showCaptions, setShowCaptions] = useState(true);
  const [tab, setTab] = useState<Tab>('transcript');
  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState('');
  const [fontsReady, setFontsReady] = useState(false);
  const [busy, setBusy] = useState<'' | 'transcribe' | 'export' | 'load'>('');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [resolution, setResolution] = useState(1080);
  const [quality, setQuality] = useState<ExportQuality>('high');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');

  const effective = useMemo(() => applyFx(applyChaos(style, chaos), fx), [style, chaos, fx]);
  const doc = useMemo<CaptionDoc>(() => ({ words, style: effective, grouping, offset }), [words, effective, grouping, offset]);
  const levels = useMemo(() => resolveEmphasis(words, effective), [words, effective]);
  const duration = source?.duration || 0;
  const live = useRef({ showCaptions, source });
  live.current = { showCaptions, source };

  useEffect(() => {
    const stored = loadStoredUser();
    setUser(stored);
    if (stored?.api_key) void refreshUser(stored.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    const prefs = readPrefs();
    if (prefs.style) setStyle({ ...BASE_STYLE, ...prefs.style });
    if (prefs.grouping) setGrouping({ ...DEFAULT_GROUPING, ...prefs.grouping });
    if (typeof prefs.chaos === 'number') setChaos(prefs.chaos);
    if (prefs.fx) setFx({ ...FX_ON, ...prefs.fx });
    if (prefs.preset) setPreset(prefs.preset);
    if (prefs.language) setLanguage(prefs.language);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(PREFS, JSON.stringify({ style, grouping, chaos, fx, preset, language })); } catch { /* storage unavailable */ }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [style, grouping, chaos, fx, preset, language]);

  useEffect(() => {
    let cancelled = false;
    const keys = PRESETS.flatMap((item) => [presetStyle(item.id).font, presetStyle(item.id).fontAlt]);
    void ensureFonts([...keys, ...FONTS.slice(0, 4).map((font) => font.key)]).then(() => { if (!cancelled) setFontsReady(true); });
    return () => { cancelled = true; };
  }, []);

  const previewSize = useMemo(() => (source ? exportSize(source.width, source.height, PREVIEW_SIDE) : { width: 1280, height: 720 }), [source]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const engine = engineRef.current;
    if (!canvas || !video || !engine || video.readyState < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = previewSize;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    if (!live.current.showCaptions) {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, width, height);
      return;
    }
    engine.render(ctx, width, height, video.currentTime, video, video.videoWidth, video.videoHeight);
  }, [previewSize]);

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new CaptionEngine(effective);
    engineRef.current.update(doc, duration);
    draw();
  }, [doc, duration, effective, draw, fontsReady, showCaptions]);

  useEffect(() => {
    let cancelled = false;
    void ensureFonts([effective.font, effective.fontAlt]).then(() => {
      if (cancelled) return;
      engineRef.current?.invalidate();
      draw();
    });
    return () => { cancelled = true; };
  }, [effective.font, effective.fontAlt, effective.weight, effective.italic, draw]);

  useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    let lastUI = 0;
    const loop = (now: number) => {
      draw();
      const video = videoRef.current;
      if (video && now - lastUI > 66) {
        lastUI = now;
        setTime(video.currentTime);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, draw]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !source) return;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
  }, [playing, source]);

  const seek = useCallback((t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || t, t));
    setTime(video.currentTime);
  }, []);

  const setWords = useCallback((next: CaptionWord[], key = '') => {
    const history = historyRef.current;
    const now = performance.now();
    setWordsState((current) => {
      if (!(key && history.lastKey === key && now - history.at < 900)) {
        history.past.push(current);
        if (history.past.length > 120) history.past.shift();
      }
      return next;
    });
    history.future = [];
    history.lastKey = key;
    history.at = now;
  }, []);

  const undo = useCallback(() => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    setWordsState((current) => { history.future.push(current); return previous; });
    history.lastKey = '';
  }, []);

  const redo = useCallback(() => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    setWordsState((current) => { history.past.push(current); return next; });
    history.lastKey = '';
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !(typing && target?.tagName === 'TEXTAREA')) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
      } else if (event.code === 'Space' && !typing && live.current.source) {
        event.preventDefault();
        setPlaying((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const resetProject = () => {
    historyRef.current = { past: [], future: [], lastKey: '', at: 0 };
    setWordsState([]);
    setSelected(-1);
    setOffset(0);
    setTextMode(false);
  };

  const choose = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setNotice('');
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError('Videos up to 2 GB');
      return;
    }
    setBusy('load');
    try {
      const next = await loadSource(file);
      setPlaying(false);
      setSource((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return next;
      });
      resetProject();
      setTime(0);
      setAudio(null);
      setAudioState('reading');
      try {
        const saved = JSON.parse(localStorage.getItem(fileKey(file)) || 'null');
        if (saved?.words?.length) {
          setWordsState(saved.words);
          setOffset(saved.offset || 0);
          setNotice('Restored your captions for this file');
        }
      } catch { /* no saved captions */ }
      void decodeSpeech(file).then((decoded) => {
        setAudio(decoded);
        setAudioState('ready');
        if (!decoded.hasAudio) setNotice('No readable soundtrack found. You can still type captions and place them on the timeline.');
        else setWordsState((current) => (current.length ? applyEnergy(current, decoded.env, ENV_HOP) : current));
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open that file');
    } finally {
      setBusy('');
    }
  }, []);

  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get('src')?.trim();
    if (!src) return;
    let parsed: URL;
    try {
      parsed = new URL(src, window.location.origin);
    } catch {
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.origin !== window.location.origin) return;
    setNotice('Loading video…');
    fetch(galleryProxyURL(parsed.href))
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load that video URL');
        const blob = await response.blob();
        const name = decodeURIComponent(parsed.pathname.split('/').pop() || 'video.mp4');
        await choose(new File([blob], name, { type: blob.type || 'video/mp4' }));
        setNotice('');
      })
      .catch((reason) => { setNotice(''); setError(reason instanceof Error ? reason.message : 'Could not load that video URL'); });
  }, [choose]);

  useEffect(() => {
    if (!source || !words.length) return undefined;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(fileKey(source.file), JSON.stringify({ words, offset })); } catch { /* storage unavailable */ }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [source, words, offset]);

  const say = (message: string) => { setError(''); setNotice(message); };
  const fail = (reason: unknown, fallback: string) => {
    if (isPaywallError(reason)) { setError(''); return; }
    setError(reason instanceof Error ? reason.message : fallback);
  };

  const chunkCount = useMemo(() => (audio?.hasAudio ? planChunks(audio.env, audio.duration, 60).length : 0), [audio]);

  const transcribe = async () => {
    if (!audio?.hasAudio || busy) return;
    const signedIn = ensurePaidAccess('Crazy Captions');
    if (!signedIn) return;
    setBusy('transcribe');
    setError('');
    setNotice('');
    setProgress(0);
    setProgressLabel('Listening…');
    try {
      const result = await transcribeAudio(audio, {
        apiKey: signedIn.api_key,
        language: language === LANGUAGES[0] ? '' : language,
        hint,
        snap,
        onProgress: (done, total) => { setProgress(total ? done / total : 0); setProgressLabel(`Transcribing ${done}/${total}`); },
      });
      if (!result.length) {
        setNotice('No speech was found in this video. Paste a transcript instead.');
      } else {
        setWords(result);
        setSelected(0);
        setNotice(`${result.length} words transcribed. Fix any mistakes below, then pick a style.`);
      }
      void refreshUser(signedIn.api_key).then((fresh) => { if (fresh) { setUser(fresh); saveUser(fresh); } });
    } catch (reason) {
      fail(reason, 'Transcription failed');
    } finally {
      setBusy('');
    }
  };

  const retime = () => {
    if (!audio?.hasAudio || !words.length) return;
    setWords(snapWordsChunked(words, audio.regions, audio.env), 'retime');
    say('Words snapped to the speech in the audio');
  };

  const applyText = (mode: 'keep' | 'retime') => {
    const text = draft.trim();
    if (!text) { setTextMode(false); return; }
    let next: CaptionWord[];
    if (mode === 'retime' || !words.length) {
      next = autoTime(text, audio?.regions || [], duration || text.split(/\s+/).length * 0.4);
      if (audio?.hasAudio) next = applyEnergy(next, audio.env, ENV_HOP);
    } else {
      next = realignText(words, text);
    }
    setWords(next);
    setTextMode(false);
    say(mode === 'retime' ? 'Transcript timed to the voice' : 'Transcript updated, timings kept for unchanged words');
  };

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (/\.json$/i.test(file.name)) {
        const data = JSON.parse(text);
        if (!Array.isArray(data.words)) throw new Error('Not a Crazy Captions project');
        const imported: CaptionWord[] = data.words.map((word: Partial<CaptionWord>) => ({ ...makeWord(String(word.text ?? ''), Number(word.start) || 0, Number(word.end) || 0, Number(word.energy) || 0.5), emphasis: (word.emphasis as Emphasis) ?? 'auto', breakBefore: word.breakBefore, hidden: word.hidden, color: word.color })).filter((word: CaptionWord) => word.text);
        setWords(imported);
        if (data.style) { setStyle({ ...BASE_STYLE, ...data.style }); setPreset('custom'); }
        if (data.fx) setFx({ ...FX_ON, ...data.fx });
        if (data.grouping) setGrouping({ ...DEFAULT_GROUPING, ...data.grouping });
        if (typeof data.offset === 'number') setOffset(data.offset);
        say(`Imported ${imported.length} words`);
      } else if (/\.(srt|vtt)$/i.test(file.name) || text.includes('-->')) {
        let imported = parseSubtitles(text);
        if (!imported.length) throw new Error('No captions found in that file');
        if (audio?.hasAudio) imported = applyEnergy(imported, audio.env, ENV_HOP);
        setWords(imported);
        say(`Imported ${imported.length} words from ${file.name}`);
      } else {
        setDraft(text);
        setTextMode(true);
        say('Plain text loaded. Choose “Time to voice” to place it on the audio.');
      }
    } catch (reason) {
      fail(reason, 'Could not import that file');
    }
  };

  const patchWord = (index: number, patch: Partial<CaptionWord>, key = '') => setWords(words.map((word, i) => (i === index ? { ...word, ...patch } : word)), key);
  const word = selected >= 0 ? words[selected] : undefined;

  const doFind = () => {
    if (!find) return;
    const lower = find.toLowerCase();
    const next = words.map((item) => (item.text.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, '') === lower.replace(/[^\p{L}\p{N}']+/gu, '') ? { ...item, text: replace || item.text } : item));
    const changed = next.filter((item, i) => item.text !== words[i].text).length;
    if (changed) { setWords(next); say(`Replaced ${changed} word${changed === 1 ? '' : 's'}`); } else say('No matching words');
  };

  const pages = useMemo(() => buildPages(words, grouping, 0, duration), [words, grouping, duration]);
  const baseName = (source?.file.name || 'video').replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9-_]+/gi, '-').slice(0, 60) || 'video';

  const exportVideo = async () => {
    if (!source || busy || !words.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy('export');
    setPlaying(false);
    setError('');
    setNotice('');
    setProgress(0);
    setProgressLabel('Rendering');
    try {
      const blob = await exportCaptionedMP4({
        file: source.file, doc, width: source.width, height: source.height, maxSide: resolution, quality, duration: source.duration,
        onProgress: setProgress, signal: controller.signal,
      });
      saveBlob(blob, `${baseName}-captions.mp4`);
      say(`Exported ${(blob.size / 1_000_000).toFixed(1)} MB MP4`);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') say('Export canceled');
      else if (reason instanceof Error && /cancel/i.test(reason.message)) say('Export canceled');
      else fail(reason, 'Export failed');
    } finally {
      abortRef.current = null;
      setBusy('');
    }
  };

  const downloadProject = () => saveBlob(new Blob([JSON.stringify({ version: 1, words, style, grouping, fx, offset, duration }, null, 1)], { type: 'application/json' }), `${baseName}-captions.json`);
  const outputSize = source ? exportSize(source.width, source.height, resolution) : null;
  const credits = user?.credits;

  const choosePreset = (id: string) => {
    const next = presetStyle(id);
    void ensureFonts([next.font, next.fontAlt]).then(() => {
      setStyle((current) => ({ ...next, seed: current.seed }));
      setPreset(id);
      setChaos(1);
      setGrouping((current) => {
        if (id === 'riot-scatter' || id === 'hifi-glitch') return { ...current, mode: 'word' };
        if (id === 'soft-clean' || id === 'terminal' || id === 'editorial') return { ...current, mode: 'phrase', maxChars: id === 'soft-clean' ? 42 : 34 };
        if (id === 'neon-karaoke') return { ...current, mode: 'phrase', maxChars: 30 };
        return { ...current, mode: 'words', wordsPerPage: 3, maxChars: 28 };
      });
    });
  };

  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/tools" className={styles.back}><ArrowLeft size={16} /> All tools</Link>
      <div className={styles.brand}><Captions size={13} /> CRAZY CAPTIONS</div>
      <Link href="/studio" className={styles.account}>{user ? `${Math.round(credits ?? 0)} credits` : 'Studio'}</Link>
    </header>
    <section className={styles.hero}>
      <h1>Crazy Captions</h1>
      <p>Word-perfect captions with Gemini, fixed by you, then restyled with loud, glitchy, hi-fi motion type that reacts to the voice. Rendered in your browser to a normal MP4.</p>
    </section>

    <section className={styles.workspace} data-tab={tab}>
      <div className={styles.previewPanel}>
        <div className={styles.stage} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
          {source ? <>
            <video ref={videoRef} className={styles.hidden} src={source.url} muted={muted} playsInline preload="auto"
              onLoadedData={draw} onSeeked={draw} onTimeUpdate={() => { if (!playing && videoRef.current) setTime(videoRef.current.currentTime); }}
              onEnded={() => setPlaying(false)} />
            <canvas ref={canvasRef} className={styles.canvas} data-testid="cc-canvas" style={{ aspectRatio: `${previewSize.width}/${previewSize.height}` }} />
          </> : <div className={styles.empty}>
            <button type="button" className={styles.drop} onClick={() => inputRef.current?.click()} disabled={busy === 'load'}>
              {busy === 'load' ? <Loader2 size={24} className={styles.spin} /> : <Upload size={24} />}
              <b>Drop or choose a video</b>
              <span>MP4, MOV, WebM · stays on your device · up to 2 GB</span>
            </button>
          </div>}
        </div>
        {source && <div className={styles.transport}>
          <button type="button" aria-label={playing ? 'Pause' : 'Play'} data-testid="cc-play" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={14} /> : <Play size={14} />}</button>
          <span className={styles.clock}>{clock(time)} / {clock(duration)}</span>
          <input aria-label="Seek" type="range" min="0" max={duration || 0} step="0.01" value={Math.min(time, duration || 0)} onChange={(event) => seek(Number(event.target.value))} />
          <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted((value) => !value)}>{muted ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>
          <button type="button" aria-pressed={!showCaptions} title="Hold to see the video without captions" onPointerDown={() => setShowCaptions(false)} onPointerUp={() => setShowCaptions(true)} onPointerLeave={() => setShowCaptions(true)}>Original</button>
          <button type="button" onClick={() => inputRef.current?.click()}><Upload size={14} /> Replace</button>
        </div>}
        <input ref={inputRef} hidden type="file" accept="video/*" data-testid="cc-file" onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} />
        {source && <Timeline
          duration={duration}
          env={audio?.env || EMPTY_AUDIO.env}
          words={words}
          selected={selected}
          time={time - offset}
          playing={playing}
          levels={levels}
          onSeek={(t) => seek(t + offset)}
          onSelect={setSelected}
          onChange={(next) => setWords(next, 'drag')}
        />}
      </div>

      <aside className={styles.controls}>
        <div className={styles.tabs} role="tablist">
          {([['transcript', '1  Transcript'], ['style', '2  Style'], ['export', '3  Export']] as [Tab, string][]).map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} data-testid={`cc-tab-${id}`} onClick={() => setTab(id)}>{label}</button>)}
        </div>

        {tab === 'transcript' && <div className={styles.panel}>
          <div className={styles.box}>
            <div className={styles.rowBetween}>
              <b>Word-by-word transcript</b>
              <small>{audioState === 'reading' ? 'Reading audio…' : audio?.hasAudio ? `${chunkCount} credit${chunkCount === 1 ? '' : 's'} · about ${Math.round(duration)} s of audio` : ''}</small>
            </div>
            <div className={styles.fieldRow}>
              <label>Language<select value={language} onChange={(event) => setLanguage(event.target.value)}>{LANGUAGES.map((item) => <option key={item}>{item}</option>)}</select></label>
              <Toggle label="Snap to voice" checked={snap} onChange={setSnap} />
            </div>
            <textarea className={styles.hint} rows={2} maxLength={800} placeholder="Optional: names, brands or lyrics to spell correctly" value={hint} onChange={(event) => setHint(event.target.value)} />
            <button type="button" className={styles.primary} data-testid="cc-transcribe" disabled={!source || !audio?.hasAudio || !!busy} onClick={() => void transcribe()}>
              {busy === 'transcribe' ? <><Loader2 size={14} className={styles.spin} /> {progressLabel}</> : <><Wand2 size={14} /> Transcribe with Gemini</>}
            </button>
            <p className={styles.fine}>{user ? '1 credit per minute of audio. Only the soundtrack is sent, never the video.' : 'Sign in to transcribe, or import / paste a transcript below.'}</p>
          </div>

          <div className={styles.actions}>
            <button type="button" disabled={!source} onClick={() => { setDraft(wordsToText(words)); setTextMode((value) => !value); }}><FileText size={13} /> {words.length ? 'Edit as text' : 'Paste transcript'}</button>
            <button type="button" onClick={() => importRef.current?.click()}><Upload size={13} /> Import SRT / VTT / JSON</button>
            <button type="button" disabled={!words.length || !audio?.hasAudio} onClick={retime}><Sparkles size={13} /> Snap to voice</button>
            <button type="button" disabled={!historyRef.current.past.length} onClick={undo}><Undo2 size={13} /> Undo</button>
            <button type="button" disabled={!historyRef.current.future.length} onClick={redo}><Redo2 size={13} /> Redo</button>
            <input ref={importRef} hidden type="file" accept=".srt,.vtt,.json,.txt,text/plain" onChange={(event) => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
          </div>

          {textMode && <div className={styles.box}>
            <textarea className={styles.textarea} data-testid="cc-text" rows={7} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Paste or type the transcript" />
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => applyText('keep')}><Check size={13} /> {words.length ? 'Apply, keep timing' : 'Apply'}</button>
              <button type="button" onClick={() => applyText('retime')} disabled={!draft.trim()}>Time to voice</button>
              <button type="button" onClick={() => setTextMode(false)}><X size={13} /> Cancel</button>
            </div>
          </div>}

          {words.length > 0 && <>
            <div className={styles.rowBetween}>
              <b>{words.length} words</b>
              <small>Enter marks a caption break · Space splits · Backspace joins</small>
            </div>
            <WordFlow words={words} selected={selected} time={time} offset={offset} levels={levels} onSelect={(index) => { setSelected(index); const w = words[index]; if (w && !playing) seek(w.start + offset + 0.02); }} onChange={(next) => setWords(next, 'text')} />

            <div className={styles.box}>
              <div className={styles.fieldRow}>
                <label>Find<input value={find} onChange={(event) => setFind(event.target.value)} placeholder="mis-heard word" /></label>
                <label>Replace<input value={replace} onChange={(event) => setReplace(event.target.value)} placeholder="correct word" /></label>
                <button type="button" className={styles.miniButton} onClick={doFind} disabled={!find}>All</button>
              </div>
              <label className={styles.row}>
                <span><b>Shift all captions</b><output>{offset >= 0 ? '+' : ''}{offset.toFixed(2)} s</output></span>
                <input type="range" min="-1.5" max="1.5" step="0.01" value={offset} onChange={(event) => setOffset(Number(event.target.value))} onDoubleClick={() => setOffset(0)} />
              </label>
            </div>

            {word && <div className={styles.box} data-testid="cc-inspector">
              <div className={styles.rowBetween}><b>“{word.text}”</b><small>{word.start.toFixed(2)}–{word.end.toFixed(2)} s</small></div>
              <div className={styles.fieldRow}>
                <label>Start<input type="number" step="0.01" value={Number(word.start.toFixed(3))} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v) && v >= 0 && v < word.end) patchWord(selected, { start: v }, 'num'); }} /></label>
                <label>End<input type="number" step="0.01" value={Number(word.end.toFixed(3))} onChange={(event) => { const v = Number(event.target.value); if (Number.isFinite(v) && v > word.start) patchWord(selected, { end: v }, 'num'); }} /></label>
              </div>
              <Segments label="Emphasis" value={word.emphasis} options={[{ value: 'auto', label: levels[selected] > 0 && word.emphasis === 'auto' ? `Auto · ${levels[selected]}` : 'Auto' }, { value: 0, label: 'Calm' }, { value: 1, label: 'Strong' }, { value: 2, label: 'Loud' }, { value: 3, label: 'Hero' }]} onChange={(value) => patchWord(selected, { emphasis: value as Emphasis })} />
              <ColorField label="Colour override" value={word.color || ''} clearable onChange={(value) => patchWord(selected, { color: value || undefined })} />
              <div className={styles.actions}>
                <button type="button" onClick={() => patchWord(selected, { breakBefore: !word.breakBefore })}>{word.breakBefore ? 'Remove break' : 'Start new caption here'}</button>
                <button type="button" onClick={() => patchWord(selected, { hidden: !word.hidden })}>{word.hidden ? 'Show word' : 'Hide word'}</button>
                <button type="button" onClick={() => { const next = splitWordAt(words, selected, time - offset); if (next !== words) setWords(next); else say('Move the playhead inside the word to split it'); }}><Scissors size={13} /> Split at playhead</button>
                <button type="button" disabled={selected === 0} onClick={() => { setWords(mergeWithPrevious(words, selected)); setSelected(selected - 1); }}>Join previous</button>
                <button type="button" onClick={() => { setWords(insertWordAfter(words, selected, 'new')); setSelected(selected + 1); }}>Add after</button>
                <button type="button" onClick={() => { setWords(deleteWord(words, selected)); setSelected(Math.max(0, selected - 1)); }}><Trash2 size={13} /> Delete</button>
              </div>
            </div>}
          </>}
        </div>}

        {tab === 'style' && <StylePanel
          style={style}
          grouping={grouping}
          chaos={chaos}
          fx={fx}
          ready={fontsReady}
          activePreset={preset}
          onStyle={(patch) => { setStyle((current) => ({ ...current, ...patch })); setPreset('custom'); }}
          onGrouping={(patch) => setGrouping((current) => ({ ...current, ...patch }))}
          onChaos={setChaos}
          onFx={(patch) => setFx((current) => ({ ...current, ...patch }))}
          onFxAll={setFx}
          onPreset={choosePreset}
        />}

        {tab === 'export' && <div className={styles.panel}>
          <div className={styles.box}>
            <b>MP4 with burned-in captions</b>
            <Segments label="Resolution" value={resolution} options={[{ value: 720, label: '720p' }, { value: 1080, label: '1080p' }, { value: 1440, label: '1440p' }, { value: 2160, label: '4K' }]} onChange={setResolution} />
            <Segments label="Quality" value={quality} options={[{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }, { value: 'max', label: 'Maximum' }]} onChange={setQuality} />
            <p className={styles.fine}>{outputSize ? `${outputSize.width} × ${outputSize.height} · H.264 + AAC, plays everywhere. ` : ''}Rendered on this device with WebCodecs; the original soundtrack is kept. Long or 4K videos take a while: keep this tab open.</p>
            {busy === 'export'
              ? <div className={styles.exporting}>
                <div className={styles.bar}><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <button type="button" onClick={() => abortRef.current?.abort()}><X size={13} /> Cancel · {Math.round(progress * 100)}%</button>
              </div>
              : <button type="button" className={styles.primary} data-testid="cc-export" disabled={!source || !words.length || !!busy} onClick={() => void exportVideo()}><Film size={14} /> Render MP4</button>}
            {!words.length && <p className={styles.fine}>Add a transcript first.</p>}
          </div>
          <div className={styles.box}>
            <b>Caption files</b>
            <div className={styles.actions}>
              <button type="button" disabled={!words.length} onClick={() => saveBlob(new Blob([toSRT(pages, words)], { type: 'text/plain' }), `${baseName}.srt`)}><Download size={13} /> SRT</button>
              <button type="button" disabled={!words.length} onClick={() => saveBlob(new Blob([toVTT(pages, words)], { type: 'text/vtt' }), `${baseName}.vtt`)}><Download size={13} /> VTT</button>
              <button type="button" disabled={!words.length} onClick={downloadProject}><Download size={13} /> Project JSON</button>
            </div>
            <p className={styles.fine}>The project file keeps every word, timing, emphasis and style so you can re-import it later.</p>
          </div>
        </div>}

        {(notice || error) && <p className={error ? styles.error : styles.notice} role="status">{error || notice}</p>}
      </aside>
    </section>
  </main>;
}
