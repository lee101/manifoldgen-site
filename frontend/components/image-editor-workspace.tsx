'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Check, Eraser, Image as ImageIcon, Layers3, Loader2, MousePointer2, Sparkles, Type, Upload, WandSparkles, X } from 'lucide-react';
import { loadStoredUser, refreshUser, saveUser } from '@/lib/auth';

type Point = { x: number; y: number; label: 0 | 1 };
type Box = { x: number; y: number; width: number; height: number };
type TextLayer = Box & { text: string; maskURL: string; fontSize: number; fontFamily: string; fontWeight: number; fontStyle: string; color: string };
type APIResponse = Record<string, unknown> & { error?: string; upload_url?: string; public_url?: string; saved_image_url?: string; result?: unknown };

async function responseJSON(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as APIResponse;
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

function findURL(value: unknown, preferred = ['image_url', 'url', 'data_url']): string {
  if (!value || typeof value !== 'object') return '';
  const row = value as Record<string, unknown>;
  for (const key of preferred) if (typeof row[key] === 'string') return row[key] as string;
  for (const key of ['image', 'output', 'result', 'cutout', 'composite', 'background', 'mask']) {
    const found = findURL(row[key], preferred);
    if (found) return found;
  }
  return '';
}

async function uploadImage(file: File, apiKey: string) {
  const query = new URLSearchParams({ filename: file.name, content_type: file.type || 'image/webp', dataset: 'image-editor' });
  const prepared = await responseJSON(await fetch(`/api/uploads/presign?${query}`, { headers: { Authorization: `Bearer ${apiKey}` } }), 'Could not prepare the image upload');
  if (!prepared.upload_url || !prepared.public_url) throw new Error('Upload service returned no destination');
  const uploaded = await fetch(prepared.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/webp' }, body: file });
  if (!uploaded.ok) throw new Error(`Image upload failed (${uploaded.status})`);
  return prepared.public_url;
}

export function ImageEditorWorkspace() {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [maskURL, setMaskURL] = useState('');
  const [foregroundURL, setForegroundURL] = useState('');
  const [backgroundURL, setBackgroundURL] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generatedURL, setGeneratedURL] = useState('');
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [mode, setMode] = useState<'object' | 'text'>('object');
  const [textBox, setTextBox] = useState<Box | null>(null);
  const [textLayer, setTextLayer] = useState<TextLayer | null>(null);
  const [drawingText, setDrawingText] = useState<{ x: number; y: number } | null>(null);
  const [movingText, setMovingText] = useState<{ dx: number; dy: number } | null>(null);
  const [busy, setBusy] = useState<'upload' | 'background' | 'select' | 'text' | 'erase' | 'edit' | 'generate' | ''>('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const preview = generatedURL || source;
  const activeMask = maskURL;

  useEffect(() => {
    if (!sourceFile) return;
    const local = URL.createObjectURL(sourceFile);
    setSource(local); setGeneratedURL(''); setMaskURL(''); setForegroundURL(''); setBackgroundURL(''); setPoints([]); setTextLayer(null); setTextBox(null);
    return () => URL.revokeObjectURL(local);
  }, [sourceFile]);

  const layers = useMemo(() => [
    backgroundURL && { name: 'Background', url: backgroundURL, detail: 'Recovered cleanly with BiRefNet' },
    foregroundURL && { name: 'Foreground', url: foregroundURL, detail: 'Transparent, independently editable' },
    activeMask && { name: 'Selected object', url: activeMask, detail: 'SAM2 precise object mask' },
  ].filter(Boolean) as { name: string; url: string; detail: string }[], [activeMask, backgroundURL, foregroundURL]);

  function userOrError() {
    const user = loadStoredUser();
    if (!user?.api_key) { setError('Sign in to use Image Editor.'); return null; }
    return user;
  }

  async function ensureSource(apiKey: string) {
    if (!sourceFile) return generatedURL || source;
    setBusy('upload'); setStatus('Uploading your image…');
    const url = await uploadImage(sourceFile, apiKey);
    setSource(url); setSourceFile(null);
    return url;
  }

  async function request(path: string, body: Record<string, unknown>, fallback: string) {
    const user = userOrError(); if (!user) throw new Error('Sign in to continue');
    const response = await responseJSON(await fetch(path, { method: 'POST', headers: { Authorization: `Bearer ${user.api_key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), fallback);
    refreshUser(user.api_key).then((next) => next && saveUser(next));
    return response;
  }

  async function separateBackground() {
    const user = userOrError(); if (!user) return;
    setBusy('background'); setError('');
    try {
      const imageURL = await ensureSource(user.api_key);
      if (!imageURL || imageURL.startsWith('blob:')) throw new Error('Choose an image first.');
      setStatus('Separating foreground and background…');
      const data = await request('/api/image-editor/background', { image_url: imageURL }, 'Could not separate this image');
      const result = data.result;
      const cutout = findURL((result as Record<string, unknown>)?.cutout);
      const background = findURL((result as Record<string, unknown>)?.background);
      if (!cutout) throw new Error('The background worker returned no foreground layer.');
      setForegroundURL(cutout); setBackgroundURL(background || imageURL); setStatus('Two editable layers are ready');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Background separation failed'); setStatus(''); }
    finally { setBusy(''); }
  }

  async function selectObject() {
    const user = userOrError(); if (!user) return;
    if (!points.length) { setError('Click the object first. Shift-click marks an area to exclude.'); return; }
    setBusy('select'); setError('');
    try {
      const imageURL = await ensureSource(user.api_key);
      if (!imageURL || imageURL.startsWith('blob:')) throw new Error('Choose an image first.');
      setStatus('Finding the object boundary…');
      const data = await request('/api/image-editor/select', { image_url: imageURL, points }, 'Could not select this object');
      const mask = findURL(data.result, ['mask_url', 'url', 'data_url']);
      if (!mask) throw new Error('The selection worker returned no mask.');
      setMaskURL(mask); setStatus('Object selected. Refine with more points, or regenerate it.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Object selection failed'); setStatus(''); }
    finally { setBusy(''); }
  }

  async function regenerate() {
    const user = userOrError(); if (!user) return;
    if (!maskURL) { setError('Select an object before regenerating it.'); return; }
    if (!prompt.trim()) { setError('Describe the replacement you want.'); return; }
    setBusy('edit'); setError('');
    try {
      const imageURL = await ensureSource(user.api_key);
      setStatus('Regenerating only the selected area…');
      const data = await request('/api/image-editor/edit', { image_url: imageURL, mask_url: maskURL, prompt: prompt.trim() }, 'Could not regenerate this object');
      const output = findURL(data.result);
      if (!output) throw new Error('The inpainting worker returned no image.');
      setGeneratedURL(output); setSource(output); setMaskURL(''); setPoints([]); setStatus('Replacement ready. The rest of the image was preserved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Targeted regeneration failed'); setStatus(''); }
    finally { setBusy(''); }
  }

  async function grabText(box: Box) {
    const user = userOrError(); if (!user) return;
    setBusy('text'); setError('');
    try {
      const imageURL = await ensureSource(user.api_key);
      setStatus('Reading text and rebuilding it as a layer…');
      const data = await request('/api/image-editor/text', { image_url: imageURL, box }, 'Could not read this text');
      const result = (data.result || {}) as Record<string, unknown>;
      const found = result.box as Partial<Box> | undefined;
      const text = typeof result.text === 'string' ? result.text : '';
      const mask = typeof result.mask_url === 'string' ? result.mask_url : findURL(result, ['mask_url', 'url', 'data_url']);
      if (!text || !mask || !found || typeof found.x !== 'number' || typeof found.y !== 'number' || typeof found.width !== 'number' || typeof found.height !== 'number') throw new Error('Magic Grab could not build an editable text layer.');
      setTextLayer({ text, maskURL: mask, x: found.x, y: found.y, width: found.width, height: found.height, fontSize: typeof result.font_size === 'number' ? result.font_size : 28, fontFamily: typeof result.font_family === 'string' ? result.font_family : 'Arial, Helvetica, sans-serif', fontWeight: typeof result.font_weight === 'number' ? result.font_weight : 600, fontStyle: result.font_style === 'italic' ? 'italic' : 'normal', color: typeof result.color === 'string' ? result.color : '#ffffff' });
      setTextBox(null); setMode('object'); setStatus('Text is now its own layer. Drag it, edit its copy, then erase the original beneath it.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Magic Grab Text failed'); setStatus(''); }
    finally { setBusy(''); }
  }

  async function eraseGrabbedText() {
    const user = userOrError(); if (!user || !textLayer) return;
    setBusy('erase'); setError('');
    try {
      const imageURL = await ensureSource(user.api_key);
      setStatus('Removing the original lettering while keeping your text layer…');
      const data = await request('/api/image-editor/edit', { image_url: imageURL, mask_url: textLayer.maskURL, prompt: 'Clean background matching the surrounding texture and lighting. Remove all text, lettering, logo marks, symbols, and watermark traces.' }, 'Could not erase the original text');
      const output = findURL(data.result);
      if (!output) throw new Error('The erase worker returned no image.');
      setSource(output); setGeneratedURL(output); setStatus('Original text removed. Your editable text layer remains on top.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Text erase failed'); setStatus(''); }
    finally { setBusy(''); }
  }

  function normalizedPoint(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
  }

  function startCanvasPointer(event: PointerEvent<HTMLDivElement>) {
    if (mode !== 'text' || movingText) return;
    const point = normalizedPoint(event); event.currentTarget.setPointerCapture(event.pointerId); setDrawingText(point); setTextBox({ ...point, width: 0, height: 0 });
  }

  function moveCanvasPointer(event: PointerEvent<HTMLDivElement>) {
    if (!drawingText) return;
    const point = normalizedPoint(event); setTextBox({ x: Math.min(drawingText.x, point.x), y: Math.min(drawingText.y, point.y), width: Math.abs(point.x - drawingText.x), height: Math.abs(point.y - drawingText.y) });
  }

  function finishCanvasPointer(event: PointerEvent<HTMLDivElement>) {
    if (!drawingText || !textBox) return;
    event.currentTarget.releasePointerCapture(event.pointerId); setDrawingText(null);
    if (textBox.width < 0.02 || textBox.height < 0.02) { setTextBox(null); setError('Draw a box around at least one line of text.'); return; }
    void grabText(textBox);
  }

  async function generateSource() {
    const user = userOrError(); if (!user) return;
    if (!generatePrompt.trim()) { setError('Describe the image you want to create.'); return; }
    setBusy('generate'); setError(''); setStatus('Creating a new source image…');
    try {
      const data = await request('/api/service', { service: 'zimage', prompt: generatePrompt.trim(), width: 1024, height: 1024 }, 'Could not create an image');
      const url = typeof data.saved_image_url === 'string' ? data.saved_image_url : findURL(data.result, ['url', 'image_url', 'data_url']);
      if (!url) throw new Error('Image generation returned no image.');
      setSource(url); setGeneratedURL(url); setSourceFile(null); setMaskURL(''); setForegroundURL(''); setBackgroundURL(''); setPoints([]); setStatus('New image ready for layered editing');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Image generation failed'); setStatus(''); }
    finally { setBusy(''); }
  }

  return <div className="grid overflow-hidden rounded-3xl border border-white/15 bg-[#151824] xl:grid-cols-[minmax(0,1fr)_350px]">
    <section className="min-w-0 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-[.18em] text-[#8c7cff]">Layered image editor</div><h2 className="mt-2 font-display text-2xl font-700">Select an object. Change only that object.</h2></div><button type="button" onClick={() => input.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/75 hover:border-white/35"><Upload size={15} /> Upload image</button><input ref={input} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setSourceFile(file); event.target.value = ''; }} /></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><input value={generatePrompt} onChange={(event) => setGeneratePrompt(event.target.value)} placeholder="Or generate a source image, for example: a red vintage sports car in rain" className="min-w-0 rounded-xl border border-white/15 bg-[#0d1018] px-4 py-3 text-sm text-white outline-none focus:border-white/35" /><button onClick={() => void generateSource()} disabled={!!busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50">{busy === 'generate' ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Generate</button></div>
      <div className="relative mt-5 flex min-h-[360px] max-h-[68vh] items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-[#0d1018]">
        {preview ? <div onPointerDown={startCanvasPointer} onPointerMove={moveCanvasPointer} onPointerUp={finishCanvasPointer} onClick={(event) => { if (mode !== 'object') return; const rect = event.currentTarget.getBoundingClientRect(); const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)); const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)); setPoints((current) => [...current.slice(-15), { x, y, label: event.shiftKey ? 0 : 1 }]); setMaskURL(''); }} className={`relative block max-h-[68vh] max-w-full touch-none ${mode === 'text' ? 'cursor-crosshair' : 'cursor-crosshair'}`} title={mode === 'text' ? 'Drag a box around the text you want to grab.' : 'Click to select. Shift-click excludes an area.'}><img src={preview} alt="Image being edited" className="block max-h-[68vh] max-w-full object-contain" />{activeMask && <img src={activeMask} alt="Selection mask" className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-35 mix-blend-screen" />}{points.map((point, index) => <i key={`${point.x}-${point.y}-${index}`} className={`pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${point.label ? 'bg-[#8c7cff]' : 'bg-red-500'}`} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} />)}{textBox && <i className="pointer-events-none absolute border-2 border-[#75d5d0] bg-[#75d5d0]/15" style={{ left: `${textBox.x * 100}%`, top: `${textBox.y * 100}%`, width: `${textBox.width * 100}%`, height: `${textBox.height * 100}%` }} />}{textLayer && <span onPointerDown={(event) => { event.stopPropagation(); const rect = event.currentTarget.parentElement!.getBoundingClientRect(); setMovingText({ dx: (event.clientX - rect.left) / rect.width - textLayer.x, dy: (event.clientY - rect.top) / rect.height - textLayer.y }); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => { if (!movingText) return; const rect = event.currentTarget.parentElement!.getBoundingClientRect(); setTextLayer((layer) => layer ? { ...layer, x: Math.max(0, Math.min(1 - layer.width, (event.clientX - rect.left) / rect.width - movingText.dx)), y: Math.max(0, Math.min(1 - layer.height, (event.clientY - rect.top) / rect.height - movingText.dy)) } : layer); }} onPointerUp={(event) => { setMovingText(null); event.currentTarget.releasePointerCapture(event.pointerId); }} className="absolute cursor-move whitespace-pre-wrap border border-dashed border-[#75d5d0] px-1 leading-none shadow-[0_0_12px_rgba(0,0,0,.6)]" style={{ left: `${textLayer.x * 100}%`, top: `${textLayer.y * 100}%`, width: `${textLayer.width * 100}%`, minHeight: `${textLayer.height * 100}%`, color: textLayer.color, fontFamily: textLayer.fontFamily, fontSize: `${textLayer.fontSize}px`, fontWeight: textLayer.fontWeight, fontStyle: textLayer.fontStyle }}>{textLayer.text}</span>}</div> : <div className="max-w-sm p-8 text-center text-white/50"><ImageIcon className="mx-auto text-white/25" size={40} /><p className="mt-4 text-sm leading-6">Upload an image or generate a new one. Then click the subject to select it precisely.</p></div>}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/55"><span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2">{mode === 'text' ? <><Type size={13} /> Drag a box around a text block</> : <><MousePointer2 size={13} /> Click includes · Shift-click excludes</>}</span>{points.length > 0 && <button onClick={() => { setPoints([]); setMaskURL(''); }} className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 hover:border-white/30"><X size={13} /> Clear {points.length} point{points.length === 1 ? '' : 's'}</button>}</div>
      {status && <p className="mt-4 text-sm text-white/60">{status}</p>}{error && <p role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-400/[.06] p-3 text-sm text-red-100/80">{error}</p>}
    </section>
    <aside className="border-t border-white/15 bg-white/[.025] p-5 sm:p-7 xl:border-l xl:border-t-0"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-white/55"><Layers3 size={14} /> Layers and edits</div>
      <button onClick={() => void separateBackground()} disabled={!preview || !!busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-4 py-3 text-sm font-semibold hover:border-white/35 disabled:opacity-45">{busy === 'background' ? <Loader2 className="animate-spin" size={16} /> : <Layers3 size={16} />} Split foreground + background <small className="text-white/45">1 cr</small></button>
      <button onClick={() => void selectObject()} disabled={!preview || !points.length || !!busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8c7cff] px-4 py-3 text-sm font-bold text-[#13131a] disabled:opacity-45">{busy === 'select' ? <Loader2 className="animate-spin" size={16} /> : <MousePointer2 size={16} />} Select object <small className="opacity-60">1 cr</small></button>
      <button onClick={() => { setMode((current) => current === 'text' ? 'object' : 'text'); setTextBox(null); setError(''); }} disabled={!preview || !!busy} className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold disabled:opacity-45 ${mode === 'text' ? 'border-[#75d5d0] bg-[#75d5d0]/15 text-[#a8f4ef]' : 'border-white/15 bg-white/[.04] hover:border-white/35'}`}><Type size={16} /> {mode === 'text' ? 'Draw text box on image' : 'Magic Grab Text'} <small className="text-white/45">1 cr</small></button>
      <div className="mt-5 space-y-2">{layers.length ? layers.map((layer) => <div key={layer.name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 p-2"><img src={layer.url} alt="" className="h-11 w-11 rounded-lg border border-white/10 object-cover" /><span className="min-w-0"><b className="block truncate text-sm">{layer.name}</b><small className="block truncate text-xs text-white/45">{layer.detail}</small></span><Check className="ml-auto text-[#8c7cff]" size={15} /></div>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm leading-6 text-white/40">Split the backdrop or select an object to create editable layers.</p>}</div>
      <label className="mt-6 block text-sm font-semibold text-white/75">Replace or remove the selected object</label><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="for example: replace with a polished chrome helmet, matching the original light" rows={4} className="mt-2 w-full resize-none rounded-xl border border-white/15 bg-[#0d1018] p-3 text-sm leading-6 outline-none focus:border-white/35" />
      <button onClick={() => void regenerate()} disabled={!maskURL || !prompt.trim() || !!busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-45">{busy === 'edit' ? <Loader2 className="animate-spin" size={16} /> : <WandSparkles size={16} />} Regenerate selected area <small className="text-black/55">8 cr</small></button>
      {textLayer && <div className="mt-6 rounded-2xl border border-[#75d5d0]/30 bg-[#75d5d0]/[.06] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#b9fff8]"><Type size={15} /> Editable text layer</div><textarea value={textLayer.text} onChange={(event) => setTextLayer((layer) => layer ? { ...layer, text: event.target.value } : layer)} rows={2} className="mt-3 w-full resize-none rounded-lg border border-white/15 bg-[#0d1018] p-2 text-sm" /><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-white/45">FONT SIZE<input type="number" min="8" max="240" value={textLayer.fontSize} onChange={(event) => setTextLayer((layer) => layer ? { ...layer, fontSize: Number(event.target.value) || 8 } : layer)} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0d1018] px-2 py-1.5 text-sm" /></label><label className="text-[10px] font-semibold text-white/45">COLOR<input type="color" value={textLayer.color} onChange={(event) => setTextLayer((layer) => layer ? { ...layer, color: event.target.value } : layer)} className="mt-1 h-8 w-full rounded-lg border border-white/15 bg-[#0d1018] p-1" /></label><label className="text-[10px] font-semibold text-white/45">STYLE<select value={textLayer.fontWeight} onChange={(event) => setTextLayer((layer) => layer ? { ...layer, fontWeight: Number(event.target.value) } : layer)} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0d1018] px-2 py-1.5 text-sm"><option value="400">Regular</option><option value="500">Medium</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label><label className="text-[10px] font-semibold text-white/45">FAMILY<select value={textLayer.fontFamily} onChange={(event) => setTextLayer((layer) => layer ? { ...layer, fontFamily: event.target.value } : layer)} className="mt-1 w-full rounded-lg border border-white/15 bg-[#0d1018] px-2 py-1.5 text-sm"><option value="Arial, Helvetica, sans-serif">Sans serif</option><option value="Georgia, serif">Serif</option><option value="'Courier New', monospace">Mono</option></select></label></div><button onClick={() => void eraseGrabbedText()} disabled={!!busy} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-black disabled:opacity-45">{busy === 'erase' ? <Loader2 className="animate-spin" size={15} /> : <Eraser size={15} />} Erase original text <small className="text-black/55">8 cr</small></button></div>}
      <p className="mt-4 text-xs leading-5 text-white/40">Selection and regeneration run on an on-demand GPU worker. Failed requests are refunded automatically.</p>
    </aside>
  </div>;
}
