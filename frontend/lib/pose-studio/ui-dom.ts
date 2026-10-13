import { CAMERA_VIEW_NAMES, HAND_SHAPES, MAP_KINDS, OUTPUT_SIZES, PROP_LIMITS, PoseStudio } from './index';
import type { HandShape, MapKind, MapRequest, MapSet, PinKey, PoseStudioOptions, Props, RegionMode, StudioState } from './index';
import { PRESET_NAMES } from './index';
import { PERSON_COLORS } from './gpu';

export type PoseStudioUIOptions = PoseStudioOptions & {
  onExport?: (maps: MapSet) => void;
  onChange?: (poseJson: string) => void;
  ui?: boolean;
};

export interface PoseStudioUIHandle {
  studio: PoseStudio;
  el: HTMLElement;
  destroy(): void;
  getPose(): ReturnType<PoseStudio['getPose']>;
  setPose(j: Parameters<PoseStudio['setPose']>[0]): void;
  exportAll(req?: MapRequest): Promise<MapSet>;
  exportMap(kind: MapKind, req?: MapRequest): Promise<Blob>;
}

const ICONS: Record<string, string> = {
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  mirror: 'M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z',
  reset: 'M4 12a8 8 0 1 0 3-6.2M4 4v5h5',
  copy: 'M9 9h11v11H9zM5 15V5h10',
  paste: 'M8 4h8v3H8zM6 5H5v16h14V5h-1M9 13h6M9 17h4',
  userPlus: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6',
  userMinus: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 11h6',
  view: 'M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
  shadow: 'M3 17c0-2 4-3.5 9-3.5s9 1.5 9 3.5-4 3.5-9 3.5-9-1.5-9-3.5zM12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  bones: 'M4 4h4v4H4zM16 16h4v4h-4zM8 8l8 8',
  frame: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  depth: 'M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4',
  pin: 'M12 17v5M8 3h8l-1 6 3 4H6l3-4z',
  download: 'M12 4v11M7 11l5 5 5-5M5 20h14',
  export: 'M12 15V3M7 8l5-5 5 5M5 21h14',
  chevron: 'm6 9 6 6 6-6',
};

const MAP_LABEL: Record<MapKind, string> = { mesh: 'Mesh', skeleton: 'Skeleton', depth: 'Depth', region: 'Region' };
const PIN_BTNS: [PinKey, string, string][] = [['footL', 'LF', 'Pin left foot'], ['footR', 'RF', 'Pin right foot'], ['handL', 'LH', 'Pin left hand'], ['handR', 'RH', 'Pin right hand']];
const PROP_ROWS: { key: keyof Props; label: string; step: number; fmt: (v: number) => string; hint?: string }[] = [
  { key: 'headsTall', label: 'Heads tall', step: 0.1, fmt: (v) => v.toFixed(1), hint: '7.5 realistic, 9 stylized' },
  { key: 'height', label: 'Height', step: 0.01, fmt: (v) => `${v.toFixed(2)} m` },
  { key: 'shoulder', label: 'Shoulder width', step: 0.01, fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'hip', label: 'Hip width', step: 0.01, fmt: (v) => `${v.toFixed(2)}x` },
  { key: 'limb', label: 'Limb length', step: 0.01, fmt: (v) => `${v.toFixed(2)}x` },
];

type Child = Node | string | null | false | undefined;
type HProps = { class?: string; on?: Record<string, (e: any) => void>; [k: string]: unknown };

let uid = 0;

export function mountPoseStudioUI(el: HTMLElement, options: PoseStudioUIOptions = {}): PoseStudioUIHandle {
  const offs: (() => void)[] = [];
  let destroyed = false;
  const listen = (t: EventTarget, ev: string, fn: (e: any) => void, o?: AddEventListenerOptions) => {
    t.addEventListener(ev, fn, o);
    offs.push(() => t.removeEventListener(ev, fn, o));
  };

  if (options.ui === false) {
    const studio = new PoseStudio(el, options);
    if (options.onChange) offs.push(studio.on('change', () => options.onChange!(JSON.stringify(studio.getPose()))));
    return {
      studio,
      el,
      getPose: () => studio.getPose(),
      setPose: (j) => studio.setPose(j),
      exportAll: (req) => studio.exportAll(req),
      exportMap: (k, req) => studio.exportMap(k, req),
      destroy() {
        if (destroyed) return;
        destroyed = true;
        offs.forEach((f) => f());
        studio.destroy();
      },
    };
  }

  const h = <K extends keyof HTMLElementTagNameMap>(tag: K, p: HProps = {}, ...kids: Child[]): HTMLElementTagNameMap[K] => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined || v === false || v === null) continue;
      if (k === 'class') e.className = v as string;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v as Record<string, (e: any) => void>)) listen(e, ev, fn);
      else e.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of kids) if (c) e.append(c);
    return e;
  };

  const icon = (name: string) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'ps-ico');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', ICONS[name]);
    s.append(p);
    return s;
  };

  const btn = (label: string, onClick: () => void, o: { icon?: string; text?: string; toggle?: boolean; cls?: string } = {}) =>
    h('button', { type: 'button', class: `ps-btn ${o.cls ?? ''}`, 'aria-label': label, title: label, 'aria-pressed': o.toggle ? 'false' : undefined, on: { click: onClick } }, o.icon && icon(o.icon), o.text && h('span', { class: 'ps-btn-t' }, o.text));

  const setPressed = (b: HTMLElement, v: boolean) => b.setAttribute('aria-pressed', String(v));
  const section = (key: string, title: string, ...kids: Child[]) =>
    h('details', { class: 'ps-sec', open: true, 'data-sec': key }, h('summary', { class: 'ps-sec-h' }, h('span', {}, title), icon('chevron')), h('div', { class: 'ps-sec-b' }, ...kids));
  const group = (label: string, ...kids: Child[]) => h('div', { class: 'ps-grp', role: 'group', 'aria-label': label }, ...kids);

  const studioHost = h('div', { class: 'ps-canvas' });
  const studio = new PoseStudio(studioHost, options);
  let state: StudioState = studio.getState();
  let regionMode: RegionMode = 'person';
  let skHands = true;
  let skFace = true;

  const modeBtns = (['ik', 'fk'] as const).map((m) => btn(m === 'ik' ? 'Inverse kinematics: drag hands and feet' : 'Forward kinematics: rotate joints', () => studio.setMode(m), { text: m.toUpperCase(), toggle: true }));
  const depthBtn = btn('Depth drag: moving a handle changes its distance from the camera', () => studio.setDepthMode(!state.depthMode), { icon: 'depth', text: 'Depth', toggle: true });
  const undoBtn = btn('Undo (Ctrl+Z)', () => studio.undo(), { icon: 'undo' });
  const redoBtn = btn('Redo (Ctrl+Shift+Z)', () => studio.redo(), { icon: 'redo' });
  const pinBtns = PIN_BTNS.map(([k, t, l]) => Object.assign(btn(l, () => studio.togglePin(k), { icon: 'pin', text: t, toggle: true }), { _k: k }));
  const pasteBtn = btn('Paste pose (Ctrl+V)', () => studio.pastePose(), { icon: 'paste' });
  const addBtn = btn('Add person', () => studio.addPerson(), { icon: 'userPlus' });
  const removeBtn = btn('Remove selected person (Delete)', () => studio.removePerson(), { icon: 'userMinus' });
  const gridBtn = btn('Toggle floor grid (G)', () => studio.setShowGrid(!state.grid), { icon: 'grid', toggle: true });
  const shadowBtn = btn('Toggle shadow', () => studio.setShowShadow(!state.shadow), { icon: 'shadow', toggle: true });
  const bonesBtn = btn('Toggle bone overlay', () => studio.setShowBones(!state.bones), { icon: 'bones', toggle: true });

  const menuId = `ps-menu-${++uid}`;
  const menu = h('div', { class: 'ps-menu', id: menuId, role: 'menu', hidden: true }, ...CAMERA_VIEW_NAMES.map((n) => h('button', { type: 'button', class: 'ps-menu-i', role: 'menuitem', on: { click: () => { studio.setCameraView(n); closeMenu(); viewBtn.focus(); } } }, n)));
  const viewBtn = btn('Camera view presets', () => (menu.hidden ? openMenu() : closeMenu()), { icon: 'view', text: 'View' });
  viewBtn.setAttribute('aria-haspopup', 'menu');
  viewBtn.setAttribute('aria-controls', menuId);
  viewBtn.setAttribute('aria-expanded', 'false');
  const openMenu = () => { menu.hidden = false; viewBtn.setAttribute('aria-expanded', 'true'); };
  const closeMenu = () => { menu.hidden = true; viewBtn.setAttribute('aria-expanded', 'false'); };
  listen(document, 'pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target as Node) && !viewBtn.contains(e.target as Node)) closeMenu(); });
  listen(menu, 'keydown', (e: KeyboardEvent) => { if (e.key === 'Escape') { closeMenu(); viewBtn.focus(); e.stopPropagation(); } });

  const toolbar = h('div', { class: 'ps-toolbar', role: 'toolbar', 'aria-label': 'Pose tools' },
    group('Mode', h('div', { class: 'ps-seg' }, ...modeBtns), depthBtn),
    group('History', undoBtn, redoBtn, btn('Mirror pose (M)', () => studio.mirror(), { icon: 'mirror' }), btn('Reset pose (R)', () => studio.reset(), { icon: 'reset' })),
    group('Pins', ...pinBtns),
    group('Pose clipboard', btn('Copy pose (Ctrl+C)', () => studio.copyPose(), { icon: 'copy' }), pasteBtn),
    group('People', addBtn, removeBtn),
    group('Camera', h('div', { class: 'ps-menu-wrap' }, viewBtn, menu), btn('Frame figures (F)', () => { studio.frameFigures(); }, { icon: 'frame' })),
    group('Display', gridBtn, shadowBtn, bonesBtn),
  );
  const stage = h('div', { class: 'ps-stage' }, studioHost, toolbar);

  const peopleBox = h('div', { class: 'ps-chips', role: 'group', 'aria-label': 'People' });
  let peopleSig = '';
  listen(peopleBox, 'click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
    if (b) studio.selectPerson(Number(b.dataset.id));
  });

  const presetBox = h('div', { class: 'ps-presets' }, ...PRESET_NAMES.map((n) => h('button', { type: 'button', class: 'ps-chip ps-preset', title: n, 'aria-label': `Preset: ${n}`, 'data-n': n }, n)));
  listen(presetBox, 'click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-n]');
    if (b) studio.setPreset(b.dataset.n!);
  });

  let handSide: 'L' | 'R' | 'both' = 'both';
  const sideBtns = (['L', 'R', 'both'] as const).map((s) => {
    const b = btn(s === 'both' ? 'Apply hand shape to both hands' : `Apply hand shape to ${s === 'L' ? 'left' : 'right'} hand`, () => { handSide = s; sideBtns.forEach((x, i) => setPressed(x, i === (['L', 'R', 'both'] as const).indexOf(s))); }, { text: s === 'both' ? 'Both' : s, toggle: true });
    return b;
  });
  sideBtns.forEach((b, i) => setPressed(b, i === 2));
  const handBox = h('div', { class: 'ps-presets ps-hands' }, ...HAND_SHAPES.map((s: HandShape) => h('button', { type: 'button', class: 'ps-chip', 'aria-label': `Hand shape: ${s}`, title: s, on: { click: () => studio.setHandShape(handSide, s) } }, s)));

  const sliders = new Map<string, { input: HTMLInputElement; out: HTMLElement; dragging: boolean }>();
  const slider = (id: string, label: string, min: number, max: number, step: number, fmt: (v: number) => string, hint: string | undefined, onInput: (v: number, dragging: boolean) => void, onStart?: () => void, onEnd?: () => void) => {
    const input = h('input', { type: 'range', class: 'ps-range', id, min, max, step });
    const out = h('output', { class: 'ps-val', for: id });
    const rec = { input, out, dragging: false };
    sliders.set(id, rec);
    const end = () => {
      if (!rec.dragging) return;
      rec.dragging = false;
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      onEnd?.();
    };
    offs.push(() => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); });
    listen(input, 'pointerdown', () => {
      if (rec.dragging) return;
      rec.dragging = true;
      onStart?.();
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
    listen(input, 'input', () => { const v = Number(input.value); out.textContent = fmt(v); onInput(v, rec.dragging); });
    const el = h('div', { class: 'ps-row' }, h('div', { class: 'ps-row-h' }, h('label', { for: id }, label), out), input, hint && h('div', { class: 'ps-hint' }, hint));
    return { el, set: (v: number) => { if (!rec.dragging) input.value = String(v); out.textContent = fmt(v); } };
  };

  const propSliders = PROP_ROWS.map((r) => ({
    r,
    s: slider(`ps-p-${uid}-${r.key}`, r.label, PROP_LIMITS[r.key][0], PROP_LIMITS[r.key][1], r.step, r.fmt, r.hint,
      (v, drag) => (drag ? studio.previewProportions({ [r.key]: v }) : studio.setProportions({ [r.key]: v })), () => studio.beginEdit(), () => studio.endEdit()),
  }));
  const fovSlider = slider(`ps-fov-${uid}`, 'Field of view', 12, 90, 1, (v) => `${Math.round(v)} deg`, undefined, (v) => studio.setFov(v));

  const sizeKey = (w: number, h2: number) => `${w}x${h2}`;
  const sizeSel = h('select', { class: 'ps-select', id: `ps-size-${uid}`, 'aria-label': 'Output size' }, ...OUTPUT_SIZES.map(([w, h2]) => h('option', { value: sizeKey(w, h2) }, `${w}x${h2}`)));
  listen(sizeSel, 'change', () => { const [w, h2] = sizeSel.value.split('x').map(Number); studio.setOutputSize(w, h2); });
  const regionSel = h('select', { class: 'ps-select', id: `ps-region-${uid}`, 'aria-label': 'Region map mode' },
    h('option', { value: 'person' }, 'Per person'), h('option', { value: 'parts' }, 'Body parts'));
  listen(regionSel, 'change', () => { regionMode = regionSel.value as RegionMode; schedThumbs(); });
  const checkbox = (label: string, init: boolean, fn: (v: boolean) => void) => {
    const input = h('input', { type: 'checkbox', class: 'ps-check' });
    input.checked = init;
    listen(input, 'change', () => { fn(input.checked); schedThumbs(); });
    return h('label', { class: 'ps-checklab' }, input, h('span', {}, label));
  };
  const field = (label: string, id: string, ctl: HTMLElement) => h('div', { class: 'ps-field' }, h('label', { for: id }, label), ctl);

  const thumbs = new Map<MapKind, { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D }>();
  const thumbBox = h('div', { class: 'ps-thumbs' }, ...MAP_KINDS.map((k) => {
    const cv = h('canvas', { class: 'ps-thumb-cv', role: 'img', 'aria-label': `${MAP_LABEL[k]} map preview` });
    thumbs.set(k, { cv, ctx: cv.getContext('2d')! });
    return h('figure', { class: 'ps-thumb' }, cv, h('figcaption', { class: 'ps-thumb-c' }, h('span', {}, MAP_LABEL[k]),
      btn(`Download ${MAP_LABEL[k]} map as PNG`, () => { void download(k); }, { icon: 'download', cls: 'ps-btn-sm' })));
  }));

  const status = h('span', { class: 'ps-status', role: 'status', 'aria-live': 'polite' });
  let statusTimer = 0;
  const say = (t: string, err = false) => {
    status.textContent = t;
    status.classList.toggle('ps-err', err);
    clearTimeout(statusTimer);
    if (t) statusTimer = window.setTimeout(() => { status.textContent = ''; }, 3500);
  };

  const paste = h('textarea', { class: 'ps-text', rows: 5, 'aria-label': 'Pose JSON', placeholder: 'Paste pose JSON or encoded pose string', spellcheck: 'false' });
  const pasteErr = h('div', { class: 'ps-error', role: 'alert' });
  const pasteBox = h('div', { class: 'ps-paste', hidden: true }, paste, pasteErr,
    h('div', { class: 'ps-paste-a' },
      btn('Apply pose JSON', () => {
        const t = paste.value.trim();
        try {
          if (!t) throw new Error('Nothing to apply');
          studio.setPose(t.startsWith('{') ? JSON.parse(t) : t);
          pasteErr.textContent = '';
          pasteBox.hidden = true;
          say('Pose applied');
        } catch (e) {
          pasteErr.textContent = `Invalid pose data: expected pose JSON or an encoded pose string`;
        }
      }, { text: 'Apply', cls: 'ps-btn-primary' }),
      btn('Cancel', () => { pasteBox.hidden = true; pasteErr.textContent = ''; }, { text: 'Cancel' })));
  const copyJson = async () => {
    const t = JSON.stringify(studio.getPose());
    try {
      await navigator.clipboard.writeText(t);
      say('Pose JSON copied');
    } catch {
      paste.value = t;
      pasteBox.hidden = false;
      paste.focus();
      paste.select();
      say('Select and copy the JSON below');
    }
  };

  const reqDefaults = (req: MapRequest = {}): MapRequest => ({ regionMode, hands: skHands, face: skFace, ...req });
  const saveBlob = (b: Blob, name: string) => {
    const u = URL.createObjectURL(b);
    const a = h('a', { href: u, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  };
  const download = async (k: MapKind) => {
    try {
      const b = await studio.exportMap(k, reqDefaults());
      const [w, h2] = studio.getOutputSize();
      saveBlob(b, `pose-${k}-${w}x${h2}.png`);
    } catch (e) {
      say(e instanceof Error ? e.message : 'Export failed', true);
    }
  };
  const exportBtn = btn('Export all maps', async () => {
    exportBtn.disabled = true;
    try {
      const maps = await studio.exportAll(reqDefaults());
      if (options.onExport) options.onExport(maps);
      else for (const k of MAP_KINDS) saveBlob(maps[k].blob, `pose-${k}-${maps[k].width}x${maps[k].height}.png`);
      say('Exported');
    } catch (e) {
      say(e instanceof Error ? e.message : 'Export failed', true);
    }
    exportBtn.disabled = false;
  }, { icon: 'export', text: 'Export maps', cls: 'ps-btn-primary ps-btn-wide' });

  const panelBody = h('div', { class: 'ps-panel-body' },
    section('people', 'People', peopleBox),
    section('presets', 'Presets', presetBox),
    section('maps', 'Maps', thumbBox),
    section('hands', 'Hands', group('Hand side', ...sideBtns), handBox),
    section('props', 'Proportions', ...propSliders.map((p) => p.s.el)),
    section('camera', 'Camera and output', fovSlider.el, field('Output size', sizeSel.id, sizeSel), field('Region map', regionSel.id, regionSel),
      h('div', { class: 'ps-checks' }, h('span', { class: 'ps-lab' }, 'Skeleton'), checkbox('Hands', skHands, (v) => (skHands = v)), checkbox('Face', skFace, (v) => (skFace = v)))),
  );
  const footer = h('div', { class: 'ps-panel-foot' }, pasteBox,
    h('div', { class: 'ps-foot-r' }, exportBtn,
      btn('Copy pose JSON', () => { void copyJson(); }, { icon: 'copy', text: 'Copy JSON' }),
      btn('Paste pose JSON', () => { pasteBox.hidden = !pasteBox.hidden; if (!pasteBox.hidden) paste.focus(); }, { icon: 'paste', text: 'Paste JSON' })),
    status);
  const panel = h('aside', { class: 'ps-panel', 'aria-label': 'Pose settings' }, panelBody, footer);
  const app = h('div', { class: 'ps-app' }, stage, panel);
  const root = h('div', { class: 'ps-root' }, app);
  el.append(root);

  listen(root, 'keydown', (e: KeyboardEvent) => {
    if (e.defaultPrevented) return;
    const t = e.target as HTMLElement;
    if (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !['range', 'checkbox'].includes((t as HTMLInputElement).type))) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && t.tagName === 'BUTTON') return;
    studio.handleKey(e);
  });

  let tTimer = 0;
  let tSize = '';
  const schedThumbs = () => {
    if (tTimer || destroyed) return;
    tTimer = window.setTimeout(() => { tTimer = 0; refreshThumbs(); }, 250);
  };
  const refreshThumbs = () => {
    if (destroyed) return;
    const [w, h2] = state.size;
    const k = 200 / Math.max(w, h2);
    const tw = Math.max(16, Math.round(w * k)), th = Math.max(16, Math.round(h2 * k));
    const sz = `${tw}x${th}`;
    for (const [kind, t] of thumbs) {
      if (sz !== tSize) { t.cv.width = tw; t.cv.height = th; t.cv.style.aspectRatio = `${tw} / ${th}`; }
      try {
        t.ctx.putImageData(studio.exportImageData(kind, { width: tw, height: th, thumb: true, regionMode, hands: skHands, face: skFace }), 0, 0);
      } catch {
        t.ctx.clearRect(0, 0, tw, th);
      }
    }
    tSize = sz;
  };

  const update = (s: StudioState) => {
    state = s;
    modeBtns.forEach((b, i) => setPressed(b, s.mode === (i === 0 ? 'ik' : 'fk')));
    setPressed(depthBtn, s.depthMode);
    setPressed(gridBtn, s.grid);
    setPressed(shadowBtn, s.shadow);
    setPressed(bonesBtn, s.bones);
    undoBtn.disabled = !s.canUndo;
    redoBtn.disabled = !s.canRedo;
    pasteBtn.disabled = !s.canPaste;
    addBtn.disabled = s.people.length >= PoseStudio.maxPeople;
    removeBtn.disabled = s.people.length <= 1;
    for (const b of pinBtns) setPressed(b, s.pins[b._k]);
    const sig = s.people.map((p) => `${p.id}:${p.color}`).join(',') + `|${s.selected}`;
    if (sig !== peopleSig) {
      peopleSig = sig;
      peopleBox.replaceChildren(...s.people.map((p, i) => {
        const c = PERSON_COLORS[p.color % PERSON_COLORS.length];
        const b = h('button', { type: 'button', class: 'ps-chip ps-person', 'data-id': p.id, 'aria-label': `Select figure ${i + 1}`, title: `Figure ${i + 1} (key ${i + 1})`, 'aria-pressed': String(p.id === s.selected) },
          h('i', { class: 'ps-sw', style: `background:rgb(${c[0]},${c[1]},${c[2]})` }), String(i + 1));
        return b;
      }));
    }
    for (const { r, s: sl } of propSliders) { const v = s.props?.[r.key]; if (typeof v === 'number') sl.set(v); }
    fovSlider.set(s.fov);
    const sk = sizeKey(s.size[0], s.size[1]);
    if (![...sizeSel.options].some((o) => o.value === sk)) sizeSel.append(h('option', { value: sk }, `${s.size[0]}x${s.size[1]}`));
    sizeSel.value = sk;
    schedThumbs();
  };

  offs.push(studio.on('state', (d) => update(d as StudioState)));
  offs.push(studio.on('change', () => { schedThumbs(); if (options.onChange) options.onChange(JSON.stringify(studio.getPose())); }));
  offs.push(studio.on('select', () => schedThumbs()));
  update(state);

  return {
    studio,
    el: root,
    getPose: () => studio.getPose(),
    setPose: (j) => studio.setPose(j),
    exportAll: (req) => studio.exportAll(reqDefaults(req)),
    exportMap: (k, req) => studio.exportMap(k, reqDefaults(req)),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(tTimer);
      clearTimeout(statusTimer);
      offs.forEach((f) => f());
      offs.length = 0;
      studio.destroy();
      root.remove();
    },
  };
}
