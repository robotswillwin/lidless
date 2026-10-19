// Adding and deleting: lights, hotspots, exits, places, areas, layers, and new scenes.

import { NH, NW } from '../engine/renderer';
import type { Hotspot } from '../game/level';
import { rebuild, refresh, updatePlay } from './files';
import { buttons, heading } from './form';
import { base, dom, ed, markDirty, redraw, remember, snapshot, undoStack, viewX } from './state';

/** Where new things go: the middle of what is on screen. */
const centre = (): [number, number] => [Math.round(viewX() + NW / 2), Math.round(NH / 2)];

const uniqueId = (stem: string, taken: string[]) => { let n = 1; while (taken.includes(`${stem}-${n}`)) n++; return `${stem}-${n}`; };

export async function add(kind: string): Promise<void> {
  const file = ed.file, before = snapshot(), [cx, cy] = centre();
  if (kind === 'light') { file.lights.push({ x: cx, y: cy - 100, z: 40, r: 300, c: [0.85, 0.93, 1], i: 1.5, zone: 0, haze: 0.2 }); ed.sel = { kind: 'light', i: file.lights.length - 1 }; }
  else if (kind === 'hotspot' || kind === 'exit') {
    const id = uniqueId(kind, file.hotspots.map((h) => h.id));
    const h: Hotspot = { id, name: kind === 'exit' ? 'Exit' : 'Something', rect: [cx - 40, file.walk.y - 160, 80, 150], stand: cx };
    if (kind === 'exit') h.go = { scene: ed.world.scenes.find((s) => s !== file.id) ?? file.id, spawn: '' };
    else h.look = 'What she sees.';
    file.hotspots.push(h);
    ed.sel = { kind: 'hotspot', i: file.hotspots.length - 1 };
  } else if (kind === 'spawn') { const id = uniqueId('arrive', Object.keys(file.spawns)); file.spawns[id] = { x: cx, facing: 1 }; ed.sel = { kind: 'spawn', id }; updatePlay(); }
  else if (kind === 'zone') {
    const set = file.kind === 'exterior' ? 'inside' : 'outside';
    file.zones ??= {};
    (file.zones[set] ??= []).push([cx - 100, 120, 200, file.walk.y - 120]);
    ed.sel = { kind: 'zone', set, i: file.zones[set]!.length - 1 };
    refresh();
  } else if (kind === 'layer') {
    const asset = await pickAsset('Add a layer');
    if (!asset) return;
    file.layers.push({ asset });
    ed.sel = { kind: 'layer', i: file.layers.length - 1 };
    await rebuild();
  }
  remember(before);
  redraw.overlay();
  redraw.side();
}

export function deleteSelected(): void {
  const file = ed.file, sel = ed.sel, before = snapshot();
  if (sel.kind === 'light') file.lights.splice(sel.i, 1);
  else if (sel.kind === 'hotspot') file.hotspots.splice(sel.i, 1);
  else if (sel.kind === 'spawn') delete file.spawns[sel.id];
  else if (sel.kind === 'zone') { file.zones![sel.set]!.splice(sel.i, 1); refresh(); }
  else if (sel.kind === 'layer') { file.layers.splice(sel.i, 1); void rebuild().then(redraw.overlay); }
  else return;
  ed.sel = { kind: 'scene' };
  remember(before);
  redraw.overlay();
  redraw.side();
}

/** Choose a built asset, in the side panel. */
export function pickAsset(title: string, filter?: (path: string) => boolean): Promise<string | null> {
  return new Promise((resolve) => {
    dom.side.replaceChildren(heading(title, 'Built assets, by scene. Build new ones with npm run asset -- build.'));
    const list = document.createElement('div');
    list.className = 'ed-list';
    for (const a of ed.assets.filter(filter ?? (() => true))) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = a;
      b.addEventListener('click', () => resolve(a));
      list.append(b);
    }
    dom.side.append(list, buttons(['Cancel', () => { resolve(null); redraw.side(); }]));
  });
}

/** A new scene from a built background, saved on the first Save. */
export async function newScene(): Promise<void> {
  if (ed.dirty && !confirm('Leave this scene without saving?')) return;
  const asset = await pickAsset('New scene: its background');
  if (!asset) return;
  const id = (prompt('Id of the new scene (lower case, digits, dashes)', asset.split('/').pop()) ?? '').trim();
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) { redraw.side(); return; }
  const def = await (await fetch(`${base}/${asset}/sprite.json`, { cache: 'no-store' })).json() as { w: number; h: number };
  const w = Math.max(NW, def.w), h = 540;
  ed.file = {
    id, name: id, kind: 'exterior', size: [w, h], layers: [{ asset, x: 0, y: 0 }], lights: [],
    walk: { y: h - 74, x0: 30, x1: w - 30 }, spawns: { start: { x: Math.round(w / 2), facing: 1 } }, hotspots: [],
  };
  undoStack.length = 0;
  ed.sel = { kind: 'scene' };
  ed.camX = 0;
  ed.lux = { x: Math.round(w / 2), facing: 1, show: true, follow: ed.lux.follow };
  await rebuild();
  if (![...dom.sceneSel.options].some((o) => o.value === id)) dom.sceneSel.add(new Option(`${id} (new)`, id));
  dom.sceneSel.value = id;
  markDirty();
  updatePlay();
  redraw.overlay();
  redraw.side();
}

/** Arrow keys nudge the selection: 1 pixel, or 10 with shift. */
export function nudge(dx: number, dy: number): void {
  const file = ed.file, sel = ed.sel, before = snapshot();
  if (sel.kind === 'light') { file.lights[sel.i].x += dx; file.lights[sel.i].y += dy; }
  else if (sel.kind === 'hotspot') { const r = file.hotspots[sel.i].rect; r[0] += dx; r[1] += dy; }
  else if (sel.kind === 'spawn') file.spawns[sel.id].x += dx;
  else if (sel.kind === 'zone') { const r = file.zones![sel.set]![sel.i]; r[0] += dx; r[1] += dy; refresh(); }
  else if (sel.kind === 'layer' && ed.scene) { const l = file.layers[sel.i], s = ed.scene.loaded.sprites[sel.i].def; l.x = (l.x ?? s.x) + dx; l.y = (l.y ?? s.y) + dy; s.x = l.x; s.y = l.y; }
  remember(before);
  redraw.overlay();
  redraw.side();
}
