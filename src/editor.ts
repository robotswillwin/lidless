// The scene editor: a scene rendered as in the game, its lights, hotspots, places and areas drawn over it to select,
// drag and edit, and Lux to judge the light on. Saves to public/assets/scenes/<id>/scene.json through the dev server.

import './style.css';
import { loadSprite, spriteDefaults, type Sprite } from './engine/assets';
import { loadProjectLook } from './engine/look';
import { fitCanvas, NH, NW, QUALITY, Renderer, type DrawSprite } from './engine/renderer';
import { frameFor } from './game/anim';
import type { Hotspot, ViewText } from './game/level';
import { SceneRunner } from './game/scene';
import { buildScene, loadSceneFile, loadWorld, zoneTexture, type Rect, type Scene, type SceneFile, type WorldFile } from './game/scenefile';
import { createLookPanel, type LookPanel } from './look-panel';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('game'), overlay = document.getElementById('overlay') as unknown as SVGSVGElement;
const side = el<HTMLElement>('side'), statusBox = el<HTMLElement>('status'), sceneSel = el<HTMLSelectElement>('scene');
const scrollIn = el<HTMLInputElement>('scroll'), viewBtn = el<HTMLButtonElement>('view'), playLink = el<HTMLAnchorElement>('play');
const errorBox = el<HTMLElement>('error');
const base = `${import.meta.env.BASE_URL}assets`;
const renderer = new Renderer(canvas, QUALITY.high), gl = renderer.gl;

/* ---------- state ---------- */

type Selection =
  | { kind: 'scene' }
  | { kind: 'light'; i: number }
  | { kind: 'hotspot'; i: number }
  | { kind: 'spawn'; id: string }
  | { kind: 'zone'; set: 'inside' | 'outside'; i: number }
  | { kind: 'layer'; i: number };

let world: WorldFile, file: SceneFile, scene: Scene | null = null, runner: SceneRunner | null = null, hero: Sprite | null = null;
let sel: Selection = { kind: 'scene' }, view = 1, switchedAt = -10, camX = 0, dirty = false, assets: string[] = [];
let lux = { x: 480, facing: 1 as 1 | -1, show: true };
const undoStack: string[] = [];
const t0 = performance.now();

const snapshot = () => JSON.stringify(file);
const setStatus = (text: string) => { statusBox.textContent = text; };
const showError = (err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  errorBox.hidden = false;
  errorBox.textContent = msg;
  document.documentElement.dataset.err = msg;
};
const markDirty = () => { dirty = true; setStatus('Not saved'); };
/** Keep the scene as it was before a change, for undo. */
const remember = (before: string) => { if (before !== snapshot()) { undoStack.push(before); if (undoStack.length > 200) undoStack.shift(); markDirty(); } };

/* ---------- loading and rebuilding ---------- */

/** Build the scene for rendering from the file. Lights stay shared with the file, so editing them shows at once. */
async function rebuild(): Promise<void> {
  const built = await buildScene(gl, base, file, world, String(Date.now()));
  scene = built;
  runner = new SceneRunner(built.loaded);
  syncScroll();
}

/** After a change to the walk line, the reflection line or the areas: the parts of the built scene that copy them. */
function refresh(): void {
  if (!scene) return;
  scene.loaded.def.mirror = file.mirror ?? file.walk.y - 8;
  if (!file.zoneMap) scene.loaded.zone = zoneTexture(gl, file);
  drawOverlay();
}

function syncScroll(): void {
  const max = Math.max(0, file.size[0] - NW);
  scrollIn.hidden = max === 0;
  scrollIn.max = String(max);
  camX = Math.min(camX, max);
  scrollIn.value = String(camX);
}

async function openScene(id: string): Promise<void> {
  file = await loadSceneFile(base, id);
  undoStack.length = 0;
  dirty = false;
  sel = { kind: 'scene' };
  camX = 0;
  const first = Object.values(file.spawns)[0];
  lux = { x: first?.x ?? file.size[0] / 2, facing: first?.facing ?? 1, show: true };
  await rebuild();
  sceneSel.value = id;
  window.history.replaceState(null, '', `?scene=${id}`);
  setStatus('');
  updatePlay();
  drawOverlay();
  drawSide();
}

function updatePlay(): void {
  const spawn = Object.keys(file.spawns)[0];
  playLink.href = `./?scene=${file.id}${spawn ? `&spawn=${spawn}` : ''}`;
}

async function listAssets(): Promise<string[]> {
  const get = async <T>(url: string) => { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? ((await r.json()) as T) : null; };
  const index = await get<{ scenes: string[] }>(`${base}/bench.json`);
  const lists = await Promise.all((index?.scenes ?? []).map(async (s) => ((await get<{ assets: string[] }>(`${base}/${s}/bench.json`))?.assets ?? []).map((a) => `${s}/${a}`)));
  return [...lists.flat(), 'styleframe/sky-city', 'styleframe/crowd', 'styleframe/street', 'styleframe/docked'];
}

/* ---------- drawing ---------- */

function draw(): void {
  fitCanvas(canvas);
  if (!scene || !runner) return;
  const t = (performance.now() - t0) / 1000, actors: DrawSprite[] = [];
  if (hero && lux.show) {
    const d = hero.def, [ax, ay] = d.anchor ?? [d.w / 2, d.h];
    actors.push({ sprite: hero, x: Math.round(lux.x - camX - ax), y: Math.round(file.walk.y - ay), frame: frameFor(d, false, 0, t, lux.facing) });
  }
  renderer.render(runner.frame(t, { view, sinceSwitch: t - switchedAt }, [camX, 0], actors, [-1000, -1000]));
}

const css = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(sel);

function drawOverlay(): void {
  overlay.setAttribute('viewBox', `${camX} 0 ${NW} ${NH}`);
  const W = file.size[0], out: string[] = [];
  const handle = (x: number, y: number, k: string, extra = '') => `<rect class="handle" x="${x - 4}" y="${y - 4}" width="8" height="8" data-k="${k}" ${extra}/>`;
  // areas of the other kind
  for (const set of ['inside', 'outside'] as const) (file.zones?.[set] ?? []).forEach(([x, y, w, h], i) => {
    const s = isSel({ kind: 'zone', set, i });
    out.push(`<rect class="zone zone-${set}${s ? ' sel' : ''}" x="${x}" y="${y}" width="${w}" height="${h}" data-k="zone" data-set="${set}" data-i="${i}"><title>${set === 'inside' ? 'Inside' : 'Outside'} area</title></rect>`);
    if (s) out.push(handle(x + w, y + h, 'zone-resize', `data-set="${set}" data-i="${i}"`));
  });
  // the reflection line and the walk line
  const my = file.mirror ?? file.walk.y - 8;
  out.push(`<line class="mirror" x1="0" y1="${my}" x2="${W}" y2="${my}" data-k="mirror"><title>Reflection line: wet ground mirrors around it</title></line>`);
  out.push(`<line class="walk" x1="${file.walk.x0}" y1="${file.walk.y}" x2="${file.walk.x1}" y2="${file.walk.y}" data-k="walk-y"><title>Walk line: where feet stand</title></line>`);
  out.push(`<circle class="walk-end" cx="${file.walk.x0}" cy="${file.walk.y}" r="5" data-k="walk-x0"/><circle class="walk-end" cx="${file.walk.x1}" cy="${file.walk.y}" r="5" data-k="walk-x1"/>`);
  // hotspots and exits
  file.hotspots.forEach((h, i) => {
    const [x, y, w, hh] = h.rect, s = isSel({ kind: 'hotspot', i });
    out.push(`<rect class="hot${h.go ? ' exit' : ''}${s ? ' sel' : ''}" x="${x}" y="${y}" width="${w}" height="${hh}" data-k="hotspot" data-i="${i}"><title>${esc(text(h.name))}${h.go ? ` → ${h.go.scene}` : ''}</title></rect>`);
    if (h.stand !== undefined) out.push(`<path class="stand${h.go ? ' exit' : ''}" d="M ${h.stand - 5} ${file.walk.y + 9} L ${h.stand + 5} ${file.walk.y + 9} L ${h.stand} ${file.walk.y + 2} Z"/>`);
    if (s) out.push(handle(x + w, y + hh, 'hotspot-resize', `data-i="${i}"`));
  });
  // places to arrive at
  for (const [id, sp] of Object.entries(file.spawns)) {
    const s = isSel({ kind: 'spawn', id }), y = file.walk.y, d = sp.facing;
    out.push(`<g class="spawn${s ? ' sel' : ''}" data-k="spawn" data-id="${esc(id)}"><line x1="${sp.x}" y1="${y}" x2="${sp.x}" y2="${y - 34}"/><path d="M ${sp.x} ${y - 34} L ${sp.x + 14 * d} ${y - 28} L ${sp.x} ${y - 22} Z"/><text x="${sp.x + 4 * d}" y="${y - 38}" text-anchor="${d > 0 ? 'start' : 'end'}">${esc(id)}</text><rect class="hit" x="${sp.x - 8}" y="${y - 40}" width="16" height="44"/></g>`);
  }
  // lights: a dot in their colour; the selected one shows its reach and its cone
  file.lights.forEach((l, i) => {
    const s = isSel({ kind: 'light', i });
    if (s) {
      out.push(`<circle class="reach" cx="${l.x}" cy="${l.y}" r="${l.r}"/>`);
      if (l.cone) {
        const a = Math.atan2(l.cone[1], l.cone[0]), half = Math.acos(Math.max(-1, Math.min(1, l.cone[2]))), r = Math.min(l.r, 260);
        const p = (t: number) => `${l.x + Math.cos(t) * r} ${l.y + Math.sin(t) * r}`;
        out.push(`<path class="cone" d="M ${l.x} ${l.y} L ${p(a - half)} A ${r} ${r} 0 ${half > Math.PI / 2 ? 1 : 0} 1 ${p(a + half)} Z"/>`);
      }
    }
    const tags = [l.ar ? 'Concierge view only' : '', l.machine ? 'machine' : '', ['behind characters', 'among characters', 'in front of characters'][l.layer ?? 0]].filter(Boolean).join(', ');
    out.push(`<g class="light${s ? ' sel' : ''}${l.ar ? ' ar' : ''}" data-k="light" data-i="${i}"><circle class="ring" cx="${l.x}" cy="${l.y}" r="9"/><circle cx="${l.x}" cy="${l.y}" r="5.5" fill="${css(l.c)}"/><title>Light ${i + 1}: ${tags}</title></g>`);
  });
  // Lux, to judge the light on: drag her along the walk line
  if (lux.show) out.push(`<g class="lux" data-k="lux"><path d="M ${lux.x - 7} ${file.walk.y + 14} L ${lux.x} ${file.walk.y + 4} L ${lux.x + 7} ${file.walk.y + 14} Z"/><title>Lux, to judge the light on</title></g>`);
  // the selected layer's outline
  if (sel.kind === 'layer' && scene) {
    const d = scene.loaded.sprites[sel.i]?.def;
    if (d) out.push(`<rect class="layer-box" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" data-k="layer" data-i="${sel.i}"/>`);
  }
  overlay.innerHTML = out.join('');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const text = (t: ViewText | undefined) => (t === undefined ? '' : typeof t === 'string' ? t : t.concierge);

/* ---------- dragging on the overlay ---------- */

let drag: { k: string; start: [number, number]; orig: number[]; before: string; moved: boolean; ref: Selection | null } | null = null;

const toLevel = (e: PointerEvent): [number, number] => {
  const pt = overlay.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(overlay.getScreenCTM()!.inverse());
  return [p.x, p.y];
};

overlay.addEventListener('pointerdown', (e) => {
  const target = (e.target as Element).closest('[data-k]') as SVGElement | null, at = toLevel(e);
  if (!target) { sel = { kind: 'scene' }; drawOverlay(); drawSide(); return; }
  const k = target.dataset.k!, i = Number(target.dataset.i), set = target.dataset.set as 'inside' | 'outside' | undefined, id = target.dataset.id;
  let orig: number[] = [], ref: Selection | null = null;
  if (k === 'light') { const l = file.lights[i]; orig = [l.x, l.y]; ref = { kind: 'light', i }; }
  else if (k === 'hotspot' || k === 'hotspot-resize') { orig = [...file.hotspots[i].rect]; ref = { kind: 'hotspot', i }; }
  else if (k === 'zone' || k === 'zone-resize') { orig = [...file.zones![set!]![i]]; ref = { kind: 'zone', set: set!, i }; }
  else if (k === 'spawn') { orig = [file.spawns[id!].x]; ref = { kind: 'spawn', id: id! }; }
  else if (k === 'walk-x0') orig = [file.walk.x0];
  else if (k === 'walk-x1') orig = [file.walk.x1];
  else if (k === 'walk-y') orig = [file.walk.y];
  else if (k === 'mirror') orig = [file.mirror ?? file.walk.y - 8];
  else if (k === 'lux') orig = [lux.x];
  else if (k === 'layer') { const l = file.layers[i], d = scene!.loaded.sprites[i].def; orig = [l.x ?? d.x, l.y ?? d.y]; ref = { kind: 'layer', i }; }
  if (ref) sel = ref;
  else if (k.startsWith('walk') || k === 'mirror') sel = { kind: 'scene' };
  drag = { k, start: at, orig, before: snapshot(), moved: false, ref };
  overlay.setPointerCapture(e.pointerId);
  drawOverlay();
  drawSide();
  e.preventDefault();
});

overlay.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const [x, y] = toLevel(e), dx = Math.round(x - drag.start[0]), dy = Math.round(y - drag.start[1]), o = drag.orig, s = drag.ref;
  if (!dx && !dy && !drag.moved) return;
  drag.moved = true;
  const k = drag.k;
  if (k === 'light' && s?.kind === 'light') { file.lights[s.i].x = o[0] + dx; file.lights[s.i].y = o[1] + dy; }
  else if (k === 'hotspot' && s?.kind === 'hotspot') file.hotspots[s.i].rect = [o[0] + dx, o[1] + dy, o[2], o[3]];
  else if (k === 'hotspot-resize' && s?.kind === 'hotspot') file.hotspots[s.i].rect = [o[0], o[1], Math.max(4, o[2] + dx), Math.max(4, o[3] + dy)];
  else if (k === 'zone' && s?.kind === 'zone') file.zones![s.set]![s.i] = [o[0] + dx, o[1] + dy, o[2], o[3]];
  else if (k === 'zone-resize' && s?.kind === 'zone') file.zones![s.set]![s.i] = [o[0], o[1], Math.max(4, o[2] + dx), Math.max(4, o[3] + dy)];
  else if (k === 'spawn' && s?.kind === 'spawn') file.spawns[s.id].x = o[0] + dx;
  else if (k === 'walk-x0') file.walk.x0 = o[0] + dx;
  else if (k === 'walk-x1') file.walk.x1 = o[0] + dx;
  else if (k === 'walk-y') file.walk.y = o[0] + dy;
  else if (k === 'mirror') file.mirror = o[0] + dy;
  else if (k === 'lux') lux.x = o[0] + dx;
  else if (k === 'layer' && s?.kind === 'layer') {
    const l = file.layers[s.i];
    l.x = o[0] + dx;
    l.y = o[1] + dy;
    const d = scene!.loaded.sprites[s.i].def;
    d.x = l.x;
    d.y = l.y;
  }
  if (k.startsWith('zone') || k.startsWith('walk') || k === 'mirror') refresh();
  else drawOverlay();
});

const endDrag = () => {
  if (!drag) return;
  if (drag.moved && drag.k !== 'lux') remember(drag.before);
  drag = null;
  drawSide();
};
overlay.addEventListener('pointerup', endDrag);
overlay.addEventListener('pointercancel', endDrag);

/* ---------- the side panel: what is selected ---------- */

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** One labelled field: change shows at once, and leaving the field keeps an undo step. */
function field(label: string, input: Field, wide = false): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = `ed-field${wide ? ' wide' : ''}`;
  const name = document.createElement('span');
  name.textContent = label;
  row.append(name, input);
  let before = '';
  input.addEventListener('focus', () => { before = snapshot(); });
  input.addEventListener('change', () => { if (before) remember(before); before = snapshot(); });
  return row;
}

function num(label: string, value: number, set: (v: number) => void, opts: { step?: number; min?: number; max?: number; after?: () => void } = {}): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.step = String(opts.step ?? 1);
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  input.addEventListener('input', () => { const v = Number(input.value); if (Number.isFinite(v)) { set(v); (opts.after ?? drawOverlay)(); } });
  return field(label, input);
}

function str(label: string, value: string, set: (v: string) => void, opts: { area?: boolean; list?: string[]; after?: () => void } = {}): HTMLLabelElement {
  const input = document.createElement(opts.area ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
  input.value = value;
  if (opts.area) (input as HTMLTextAreaElement).rows = 3;
  if (opts.list && input instanceof HTMLInputElement) {
    const id = `list-${Math.random().toString(36).slice(2)}`, list = document.createElement('datalist');
    list.id = id;
    for (const v of opts.list) list.append(new Option(v, v));
    input.setAttribute('list', id);
    queueMicrotask(() => input.parentElement?.append(list));
  }
  input.addEventListener('input', () => { set(input.value); (opts.after ?? drawOverlay)(); });
  return field(label, input, opts.area);
}

function choice(label: string, value: string, options: [string, string][], set: (v: string) => void, after: () => void = drawOverlay): HTMLLabelElement {
  const input = document.createElement('select');
  for (const [v, name] of options) input.append(new Option(name, v));
  input.value = value;
  input.addEventListener('input', () => { set(input.value); after(); });
  return field(label, input);
}

function check(label: string, value: boolean, set: (v: boolean) => void, after: () => void = drawOverlay): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('input', () => { set(input.checked); after(); });
  const row = field(label, input);
  row.classList.add('check');
  return row;
}

function colour(label: string, value: [number, number, number], set: (v: [number, number, number]) => void): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'color';
  const hex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  input.value = `#${value.map(hex).join('')}`;
  input.addEventListener('input', () => { const n = parseInt(input.value.slice(1), 16); set([(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]); drawOverlay(); });
  return field(label, input);
}

function buttons(...list: [string, () => void, string?][]): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'ed-buttons';
  for (const [name, run, cls] of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    if (cls) b.className = cls;
    b.addEventListener('click', run);
    row.append(b);
  }
  return row;
}

const heading = (title: string, note = '') => {
  const h = document.createElement('div');
  h.className = 'ed-heading';
  h.innerHTML = `<h2>${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ''}`;
  return h;
};

/** A text that can differ between the views: two fields, kept as one string when they are the same. */
function viewText(label: string, value: ViewText | undefined, set: (v: ViewText | undefined) => void, area = false): HTMLLabelElement[] {
  const now = { concierge: typeof value === 'string' ? value : value?.concierge ?? '', raw: typeof value === 'string' ? value : value?.raw ?? '' };
  const store = () => set(!now.concierge && !now.raw ? undefined : now.concierge === now.raw ? now.concierge : { ...now });
  return [
    str(`${label}, Concierge view`, now.concierge, (v) => { now.concierge = v; store(); }, { area }),
    str(`${label}, raw view`, now.raw, (v) => { now.raw = v; store(); }, { area }),
  ];
}

const GROUPS: [string, string][] = [['0', 'Steady'], ['1', 'Monitor flicker'], ['2', 'Valves'], ['3', 'Fire'], ['4', 'The machine’s eye'], ['5', 'Neon flicker'], ['6', 'Hologram'], ['7', 'Screen'], ['8', 'String lights']];
const ZONES: [string, string][] = [['0', 'Everywhere'], ['1', 'Inside areas'], ['2', 'Outside, near layer'], ['4', 'Outside, every depth'], ['3', 'Facade']];

function lightSide(i: number): void {
  const l = file.lights[i], deg = (r: number) => Math.round((r * 180) / Math.PI);
  side.append(heading(`Light ${i + 1}`, 'Drag the dot to move it. Height is how far in front of the wall it hangs: low lights graze, high ones light flat.'));
  side.append(
    num('x', l.x, (v) => { l.x = v; }), num('y', l.y, (v) => { l.y = v; }),
    num('Height', l.z, (v) => { l.z = v; }, { min: 0, max: 400 }), num('Reach', l.r, (v) => { l.r = v; }, { min: 10, max: 2000, step: 10 }),
    colour('Colour', l.c, (v) => { l.c = v; }), num('Strength', l.i, (v) => { l.i = v; }, { step: 0.05, min: 0, max: 12 }),
    num('Wrap (soft)', l.wrap ?? 0.3, (v) => { l.wrap = v; }, { step: 0.05, min: 0, max: 1 }), num('Haze in the air', l.haze ?? 0, (v) => { l.haze = v; }, { step: 0.05, min: 0, max: 3 }),
    check('Casts shadows', !!l.shadow, (v) => { if (v) l.shadow = 1; else delete l.shadow; }),
    choice('Against characters', String(l.layer ?? 0), [['0', 'Behind them (part of the set)'], ['1', 'Among them (in the street)'], ['2', 'In front of them']], (v) => { l.layer = Number(v); }),
    choice('Lights', String(l.zone), ZONES, (v) => { l.zone = Number(v); }),
    check('Concierge view only', !!l.ar, (v) => { if (v) l.ar = 1; else delete l.ar; }),
    check('A machine’s light (keeps its colour in raw view)', !!l.machine, (v) => { if (v) l.machine = 1; else delete l.machine; }),
    choice('Flicker', String(l.g ?? 0), GROUPS, (v) => { const g = Number(v); if (g) l.g = g; else delete l.g; }),
    check('Cone', !!l.cone, (v) => { if (v) l.cone = [0, 1, 0.4]; else delete l.cone; drawSide(); }),
  );
  if (l.cone) {
    const cone = l.cone;
    side.append(
      num('Cone direction (90 = down)', deg(Math.atan2(cone[1], cone[0])), (v) => { const a = (v * Math.PI) / 180; cone[0] = +Math.cos(a).toFixed(3); cone[1] = +Math.sin(a).toFixed(3); }, { min: -180, max: 360 }),
      num('Cone half-angle', deg(Math.acos(Math.max(-1, Math.min(1, cone[2])))), (v) => { cone[2] = +Math.cos((Math.min(179, Math.max(1, v)) * Math.PI) / 180).toFixed(3); }, { min: 1, max: 179 }),
    );
  }
  side.append(buttons(
    ['Duplicate', () => { const before = snapshot(); file.lights.push({ ...structuredClone(l), x: l.x + 20, y: l.y + 20 }); sel = { kind: 'light', i: file.lights.length - 1 }; remember(before); drawOverlay(); drawSide(); }],
    ['Delete', () => deleteSelected(), 'danger'],
  ));
}

function hotspotSide(i: number): void {
  const h = file.hotspots[i], sceneIds = world.scenes;
  side.append(heading(h.go ? 'Exit' : 'Hotspot', h.go ? 'Using it goes to another scene. Put one over an end of the walk line to leave by walking into it.' : 'Drag to move, the corner to resize. Stand is where Lux walks to before using it.'));
  side.append(str('Id', h.id, (v) => { h.id = v; }));
  side.append(...viewText('Name', h.name, (v) => { h.name = v ?? ''; }));
  const [x, y, w, hh] = h.rect;
  side.append(
    num('x', x, (v) => { h.rect[0] = v; }), num('y', y, (v) => { h.rect[1] = v; }), num('Width', w, (v) => { h.rect[2] = v; }, { min: 4 }), num('Height', hh, (v) => { h.rect[3] = v; }, { min: 4 }),
    str('Stand (x, empty: no walking)', h.stand === undefined ? '' : String(h.stand), (v) => { const n = Number(v); if (v.trim() === '' || !Number.isFinite(n)) delete h.stand; else h.stand = n; }),
    choice('Faces', String(h.face ?? 0), [['0', 'Towards it'], ['1', 'Right'], ['-1', 'Left']], (v) => { const n = Number(v); if (n) h.face = n as 1 | -1; else delete h.face; }),
    choice('There in', h.only ?? 'both', [['both', 'Both views'], ['concierge', 'Concierge view only'], ['raw', 'Raw view only']], (v) => { if (v === 'both') delete h.only; else h.only = v as 'raw' | 'concierge'; }),
  );
  if (h.go) {
    const go = h.go;
    side.append(
      choice('Leads to', go.scene, sceneIds.map((s) => [s, s] as [string, string]), (v) => { go.scene = v; drawSide(); }),
      str('Arriving at (a spawn there)', go.spawn, (v) => { go.spawn = v; }, { list: spawnsOf(go.scene) }),
    );
  } else {
    side.append(...viewText('Look text', h.look, (v) => { if (v === undefined) delete h.look; else h.look = v; }, true));
    side.append(str('Conversation (Ink knot)', h.talk ?? '', (v) => { if (v) h.talk = v; else delete h.talk; }));
  }
  side.append(buttons(['Delete', () => deleteSelected(), 'danger']));
}

const spawnCache = new Map<string, string[]>();
function spawnsOf(id: string): string[] {
  if (id === file.id) return Object.keys(file.spawns);
  if (!spawnCache.has(id)) {
    spawnCache.set(id, []);
    void loadSceneFile(base, id).then((f) => { spawnCache.set(id, Object.keys(f.spawns)); if (sel.kind === 'hotspot') drawSide(); }).catch(() => {});
  }
  return spawnCache.get(id)!;
}

function spawnSide(id: string): void {
  const sp = file.spawns[id];
  side.append(heading(`Spawn: ${id}`, 'A place to arrive at, on the walk line. Exits in other scenes name it. The first one is where Play starts.'));
  side.append(
    str('Name', id, (v) => {
      const name = v.trim();
      if (!name || name === id || file.spawns[name]) return;
      file.spawns = Object.fromEntries(Object.entries(file.spawns).map(([k, s]) => [k === id ? name : k, s]));
      sel = { kind: 'spawn', id: name };
      drawOverlay();
      updatePlay();
    }),
    num('x', sp.x, (v) => { sp.x = v; }),
    choice('Facing', String(sp.facing), [['1', 'Right'], ['-1', 'Left']], (v) => { sp.facing = Number(v) as 1 | -1; }),
  );
  side.append(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function zoneSide(set: 'inside' | 'outside', i: number): void {
  const r = file.zones![set]![i];
  side.append(heading(set === 'inside' ? 'Inside area' : 'Outside area', file.kind === 'exterior' ? 'In a street, an inside area is a room seen through a window or an open front: inside ambient, no rain.' : 'In a room, an outside area is a window or a door to the street: cold ambient, rain in raw view.'));
  if (file.zoneMap) side.append(heading('', `This scene uses a painted zone map (${file.zoneMap}); areas have no effect until it is removed.`));
  side.append(
    choice('Kind', set, [['inside', 'Inside'], ['outside', 'Outside']], (v) => {
      if (v === set) return;
      file.zones![set]!.splice(i, 1);
      ((file.zones![v as 'inside' | 'outside'] ??= []) as Rect[]).push(r);
      sel = { kind: 'zone', set: v as 'inside' | 'outside', i: file.zones![v as 'inside' | 'outside']!.length - 1 };
      refresh();
      drawSide();
    }, refresh),
    num('x', r[0], (v) => { r[0] = v; }, { after: refresh }), num('y', r[1], (v) => { r[1] = v; }, { after: refresh }),
    num('Width', r[2], (v) => { r[2] = v; }, { min: 4, after: refresh }), num('Height', r[3], (v) => { r[3] = v; }, { min: 4, after: refresh }),
  );
  side.append(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function layerSide(i: number): void {
  const l = file.layers[i], d = scene?.loaded.sprites[i]?.def;
  side.append(heading(`Layer ${i + 1}: ${l.asset}`, 'Drag its outline to move it. Layers draw back to front.'));
  const place = () => { if (d) { d.x = l.x ?? d.x; d.y = l.y ?? d.y; d.parallax = l.parallax ?? d.parallax; d.depth = l.depth ?? d.depth; } drawOverlay(); };
  side.append(
    num('x', l.x ?? d?.x ?? 0, (v) => { l.x = v; }, { after: place }), num('y', l.y ?? d?.y ?? 0, (v) => { l.y = v; }, { after: place }),
    num('Parallax (1 moves with the street)', l.parallax ?? d?.parallax ?? 1, (v) => { l.parallax = v; }, { step: 0.05, min: 0, max: 2, after: place }),
    choice('Depth', String(l.depth ?? d?.depth ?? 3), [['0', 'Sky'], ['1', 'Far'], ['2', 'Middle'], ['3', 'Near']], (v) => { l.depth = Number(v); }, place),
  );
  const move = (to: number) => { if (to < 0 || to >= file.layers.length) return; const before = snapshot(); const [m] = file.layers.splice(i, 1); file.layers.splice(to, 0, m); sel = { kind: 'layer', i: to }; remember(before); void rebuild().then(() => { drawOverlay(); drawSide(); }); };
  side.append(buttons(['Further back', () => move(i - 1)], ['Further forward', () => move(i + 1)], ['Delete', () => deleteSelected(), 'danger']));
}

function sceneSide(): void {
  side.append(heading(file.name || file.id, `Scene ${file.id}: ${file.size[0]}×${file.size[1]} px. Click a light, hotspot, spawn or area to edit it.`));
  side.append(
    str('Name', file.name, (v) => { file.name = v; }),
    choice('Kind', file.kind, [['exterior', 'Exterior: outside, rain'], ['interior', 'Interior: inside']], (v) => { file.kind = v as 'exterior' | 'interior'; }, refresh),
    num('Width', file.size[0], (v) => { file.size[0] = Math.max(NW, v); syncScroll(); }, { min: NW, step: 16, after: refresh }),
    num('Walk line y', file.walk.y, (v) => { file.walk.y = v; }, { after: refresh }),
    num('Walk from x', file.walk.x0, (v) => { file.walk.x0 = v; }), num('Walk to x', file.walk.x1, (v) => { file.walk.x1 = v; }),
    num('Reflection line y', file.mirror ?? file.walk.y - 8, (v) => { file.mirror = v; }, { after: refresh }),
  );
  side.append(heading('Lux', 'Drag the triangle at her feet to move her.'));
  side.append(
    check('Show Lux', lux.show, (v) => { lux.show = v; }),
    choice('Lux faces', String(lux.facing), [['1', 'Right'], ['-1', 'Left']], (v) => { lux.facing = Number(v) as 1 | -1; }),
  );
  side.append(heading('Layers', 'Back to front. Click one to move it or change its depth.'));
  const list = document.createElement('div');
  list.className = 'ed-list';
  file.layers.forEach((l, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${i + 1}. ${l.asset}`; b.addEventListener('click', () => { sel = { kind: 'layer', i }; drawOverlay(); drawSide(); }); list.append(b); });
  side.append(list);
  side.append(heading('Lights', `${file.lights.length} lights. Dots on the scene; cyan rings are Concierge view only.`));
}

function drawSide(): void {
  side.replaceChildren();
  if (sel.kind === 'light' && file.lights[sel.i]) lightSide(sel.i);
  else if (sel.kind === 'hotspot' && file.hotspots[sel.i]) hotspotSide(sel.i);
  else if (sel.kind === 'spawn' && file.spawns[sel.id]) spawnSide(sel.id);
  else if (sel.kind === 'zone' && file.zones?.[sel.set]?.[sel.i]) zoneSide(sel.set, sel.i);
  else if (sel.kind === 'layer' && file.layers[sel.i]) layerSide(sel.i);
  else { sel = { kind: 'scene' }; sceneSide(); }
}

/* ---------- adding and deleting ---------- */

/** Where new things go: the middle of what is on screen. */
const centre = (): [number, number] => [Math.round(camX + NW / 2), Math.round(NH / 2)];

async function add(kind: string): Promise<void> {
  const before = snapshot(), [cx, cy] = centre();
  if (kind === 'light') { file.lights.push({ x: cx, y: cy - 100, z: 40, r: 300, c: [0.85, 0.93, 1], i: 1.5, zone: 0, haze: 0.2 }); sel = { kind: 'light', i: file.lights.length - 1 }; }
  else if (kind === 'hotspot' || kind === 'exit') {
    const id = uniqueId(kind, file.hotspots.map((h) => h.id));
    const h: Hotspot = { id, name: kind === 'exit' ? 'Exit' : 'Something', rect: [cx - 40, file.walk.y - 160, 80, 150], stand: cx };
    if (kind === 'exit') h.go = { scene: world.scenes.find((s) => s !== file.id) ?? file.id, spawn: '' };
    else h.look = 'What she sees.';
    file.hotspots.push(h);
    sel = { kind: 'hotspot', i: file.hotspots.length - 1 };
  } else if (kind === 'spawn') { const id = uniqueId('arrive', Object.keys(file.spawns)); file.spawns[id] = { x: cx, facing: 1 }; sel = { kind: 'spawn', id }; updatePlay(); }
  else if (kind === 'zone') {
    const set = file.kind === 'exterior' ? 'inside' : 'outside';
    file.zones ??= {};
    (file.zones[set] ??= []).push([cx - 100, 120, 200, file.walk.y - 120]);
    sel = { kind: 'zone', set, i: file.zones[set]!.length - 1 };
    refresh();
  } else if (kind === 'layer') {
    const asset = await pickAsset('Add a layer');
    if (!asset) return;
    file.layers.push({ asset });
    sel = { kind: 'layer', i: file.layers.length - 1 };
    await rebuild();
  }
  remember(before);
  drawOverlay();
  drawSide();
}

const uniqueId = (stem: string, taken: string[]) => { let n = 1; while (taken.includes(`${stem}-${n}`)) n++; return `${stem}-${n}`; };

function deleteSelected(): void {
  const before = snapshot();
  if (sel.kind === 'light') file.lights.splice(sel.i, 1);
  else if (sel.kind === 'hotspot') file.hotspots.splice(sel.i, 1);
  else if (sel.kind === 'spawn') delete file.spawns[sel.id];
  else if (sel.kind === 'zone') { file.zones![sel.set]!.splice(sel.i, 1); refresh(); }
  else if (sel.kind === 'layer') { file.layers.splice(sel.i, 1); void rebuild().then(drawOverlay); }
  else return;
  sel = { kind: 'scene' };
  remember(before);
  drawOverlay();
  drawSide();
}

/** Choose a built asset, in the side panel. */
function pickAsset(title: string, filter?: (path: string) => boolean): Promise<string | null> {
  return new Promise((resolve) => {
    side.replaceChildren(heading(title, 'Built assets, by scene. Build new ones with npm run asset -- build.'));
    const list = document.createElement('div');
    list.className = 'ed-list';
    for (const a of assets.filter(filter ?? (() => true))) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a;
      b.addEventListener('click', () => resolve(a));
      list.append(b);
    }
    side.append(list, buttons(['Cancel', () => { resolve(null); drawSide(); }]));
  });
}

async function newScene(): Promise<void> {
  if (dirty && !confirm('Leave this scene without saving?')) return;
  const asset = await pickAsset('New scene: its background');
  if (!asset) return;
  const id = (prompt('Id of the new scene (lower case, digits, dashes)', asset.split('/').pop()) ?? '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) { drawSide(); return; }
  const def = await (await fetch(`${base}/${asset}/sprite.json`, { cache: 'no-store' })).json() as { w: number; h: number };
  const w = Math.max(NW, def.w), h = 540;
  file = {
    id, name: id, kind: 'exterior', size: [w, h], layers: [{ asset, x: 0, y: 0 }], lights: [],
    walk: { y: h - 74, x0: 30, x1: w - 30 }, spawns: { start: { x: Math.round(w / 2), facing: 1 } }, hotspots: [],
  };
  undoStack.length = 0;
  sel = { kind: 'scene' };
  camX = 0;
  lux = { x: Math.round(w / 2), facing: 1, show: true };
  await rebuild();
  if (![...sceneSel.options].some((o) => o.value === id)) sceneSel.add(new Option(`${id} (new)`, id));
  sceneSel.value = id;
  markDirty();
  updatePlay();
  drawOverlay();
  drawSide();
}

/* ---------- saving, undo, view ---------- */

async function save(): Promise<void> {
  try {
    const res = await fetch(`/__scene?id=${encodeURIComponent(file.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(file) });
    if (!res.ok) throw new Error(await res.text());
    dirty = false;
    if (!world.scenes.includes(file.id)) world.scenes.push(file.id);
    setStatus(`Saved ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    setStatus(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function undo(): Promise<void> {
  const prev = undoStack.pop();
  if (!prev) return;
  const layersBefore = JSON.stringify(file.layers);
  file = JSON.parse(prev) as SceneFile;
  // lights and the rest are rebuilt from the file; layers only reload when they changed
  if (JSON.stringify(file.layers) !== layersBefore || !scene) await rebuild();
  else { scene.loaded.def.lights = file.lights; refresh(); }
  markDirty();
  if (!undoStack.length) setStatus('Undone to where you started');
  drawOverlay();
  drawSide();
}

const syncView = () => {
  viewBtn.setAttribute('aria-pressed', String(view > 0.5));
  viewBtn.textContent = view > 0.5 ? 'Concierge view' : 'Raw view';
};
const toggleView = () => { view = view > 0.5 ? 0 : 1; switchedAt = (performance.now() - t0) / 1000; syncView(); look?.refresh(); };

/* ---------- wiring ---------- */

let look: LookPanel | null = null;

document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.addEventListener('click', () => void add(b.dataset.add!).catch(showError)));
el<HTMLButtonElement>('new-scene').addEventListener('click', () => void newScene().catch(showError));
el<HTMLButtonElement>('save').addEventListener('click', () => void save());
el<HTMLButtonElement>('undo').addEventListener('click', () => void undo());
el<HTMLButtonElement>('look').addEventListener('click', () => look?.toggle());
viewBtn.addEventListener('click', toggleView);
sceneSel.addEventListener('change', () => {
  if (dirty && !confirm('Leave this scene without saving?')) { sceneSel.value = file.id; return; }
  void openScene(sceneSel.value).catch(showError);
});
scrollIn.addEventListener('input', () => { camX = Number(scrollIn.value); drawOverlay(); });
el<HTMLElement>('stage').addEventListener('wheel', (e) => {
  const max = Number(scrollIn.max);
  if (!max) return;
  camX = Math.max(0, Math.min(max, camX + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)));
  scrollIn.value = String(camX);
  drawOverlay();
  e.preventDefault();
}, { passive: false });
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });

document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
  if (e.metaKey || e.ctrlKey) {
    if (e.key === 's') { e.preventDefault(); void save(); }
    else if (e.key === 'z' && !typing) { e.preventDefault(); void undo(); }
    return;
  }
  // Escape leaves a field, so the editor's keys work again
  if (typing && e.key === 'Escape') { (e.target as HTMLElement).blur(); return; }
  if (typing || e.altKey) return;
  const k = e.key;
  if (k === 'e' || k === 'E') toggleView();
  else if (k === 'l' || k === 'L') look?.toggle();
  else if (k === 'Escape') { sel = { kind: 'scene' }; drawOverlay(); drawSide(); }
  else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelected(); }
  else if (k.startsWith('Arrow') && sel.kind !== 'scene') {
    // nudge the selection: 1 pixel, or 10 with shift
    e.preventDefault();
    const before = snapshot(), d = e.shiftKey ? 10 : 1, dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0;
    if (sel.kind === 'light') { file.lights[sel.i].x += dx; file.lights[sel.i].y += dy; }
    else if (sel.kind === 'hotspot') { const r = file.hotspots[sel.i].rect; r[0] += dx; r[1] += dy; }
    else if (sel.kind === 'spawn') file.spawns[sel.id].x += dx;
    else if (sel.kind === 'zone') { const r = file.zones![sel.set]![sel.i]; r[0] += dx; r[1] += dy; refresh(); }
    else if (sel.kind === 'layer' && scene) { const l = file.layers[sel.i], s = scene.loaded.sprites[sel.i].def; l.x = (l.x ?? s.x) + dx; l.y = (l.y ?? s.y) + dy; s.x = l.x; s.y = l.y; }
    remember(before);
    drawOverlay();
    drawSide();
  }
});

/* ---------- start ---------- */

async function start(): Promise<void> {
  world = await loadWorld(base);
  const [project, list] = await Promise.all([loadProjectLook(base), listAssets()]);
  assets = list;
  for (const id of world.scenes) sceneSel.add(new Option(id, id));
  const heroPath = world.hero.sprite, cut = heroPath.lastIndexOf('/');
  hero = await loadSprite(gl, `${base}/${heroPath.slice(0, cut)}`, heroPath.slice(cut + 1), spriteDefaults(gl)).catch(() => null);
  look = createLookPanel(renderer, project, el<HTMLElement>('stage'), { view: () => (view < 0.5 ? 'raw' : 'concierge') });
  const asked = new URLSearchParams(location.search).get('scene');
  await openScene(asked && world.scenes.includes(asked) ? asked : world.scenes[0]);
  syncView();
  document.documentElement.dataset.ready = '1';
  const loop = () => { requestAnimationFrame(loop); if (document.visibilityState === 'visible') draw(); };
  requestAnimationFrame(loop);
}

start().catch(showError);
