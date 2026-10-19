// Adding and deleting: lights, hotspots, exits, places, areas, layers, and new scenes.

import { presets, resolveLight } from '../engine/presets';
import { suggestLights, type GlowImage, type GlowLayer } from './suggest';
import { NH, NW } from '../engine/renderer';
import type { Hotspot } from '../game/level';
import { rebuild, refresh, syncEffects, updatePlay } from './files';
import { buttons, heading } from './form';
import { base, dom, ed, LIMITS, markDirty, redraw, remember, setStatus, snapshot, undoStack, viewX } from './state';

/** Where new things go: the middle of what is on screen. */
const centre = (): [number, number] => [Math.round(viewX() + NW / 2), Math.round(NH / 2)];

const uniqueId = (stem: string, taken: string[]) => { let n = 1; while (taken.includes(`${stem}-${n}`)) n++; return `${stem}-${n}`; };

export async function add(kind: string): Promise<void> {
  const file = ed.file, before = snapshot(), [cx, cy] = centre();
  if (kind === 'light') { file.lights.push({ x: cx, y: cy - 100, z: 40, r: 300, c: [0.85, 0.93, 1], i: 1.5, zone: 0, haze: 0.2 }); ed.sel = { kind: 'light', i: file.lights.length - 1 }; }
  else if (kind.startsWith('light:')) {
    // one of a kind, and the effects it brings along, at its place
    const key = kind.slice(6), p = presets().lights[key], x = cx, y = cy - 100;
    if (!p) return;
    file.lights.push({ x, y, preset: key });
    const shaft = p.with?.godray, steam = p.with?.steam;
    if (shaft && (file.godrays ?? []).length < LIMITS.godrays) (file.godrays ??= []).push({ x, y, ...shaft });
    if (steam && (file.steam ?? []).length < LIMITS.steam) (file.steam ??= []).push({ x, y: file.walk.y - 4, ...steam });
    if (shaft || steam) syncEffects();
    ed.sel = { kind: 'light', i: file.lights.length - 1 };
  }
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
  } else if (kind === 'steam' || kind === 'smoke') {
    const list = (file.steam ??= []);
    if (list.length >= LIMITS.steam) return setStatus(`At most ${LIMITS.steam} steam and smoke in a scene`);
    list.push(kind === 'smoke' ? { x: cx, y: file.walk.y - 120, height: 90, width: 5, kind } : { x: cx, y: file.walk.y - 4, height: 100, width: 10, kind });
    ed.sel = { kind: 'steam', i: list.length - 1 };
    syncEffects();
  } else if (kind === 'godray') {
    const list = (file.godrays ??= []);
    if (list.length >= LIMITS.godrays) return setStatus(`At most ${LIMITS.godrays} light shafts in a scene`);
    list.push({ x: cx, y: cy - 60, strength: 0.2, zone: 2 });
    ed.sel = { kind: 'godray', i: list.length - 1 };
    syncEffects();
  } else if (kind === 'beacon') {
    const list = (file.beacons ??= []);
    if (list.length >= LIMITS.beacons) return setStatus(`At most ${LIMITS.beacons} beacons in a scene`);
    list.push({ x: cx, y: 40, phase: Math.round(Math.random() * 63) / 10 });
    ed.sel = { kind: 'beacon', i: list.length - 1 };
    syncEffects();
  } else if (kind === 'drips') {
    // one curtain of drips a scene
    file.drips ??= { x0: cx - 80, x1: cx + 80, top: file.walk.y - 180, bottom: file.walk.y - 4 };
    ed.sel = { kind: 'drips' };
    syncEffects();
  } else if (kind === 'mover') {
    const asset = await pickAsset('Add a mover: what passes through');
    if (!asset) return;
    // behind the street by default: after the first layer that is further away than it
    const after = file.layers.find((l, i) => (l.parallax ?? ed.scene?.loaded.sprites[i]?.def.parallax ?? 1) < 1) ?? file.layers[0];
    (file.movers ??= []).push({ asset, after: after.asset, x0: 0, x1: file.size[0], speed: 80, wait: [10, 25] });
    ed.sel = { kind: 'mover', i: file.movers.length - 1 };
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
  else if (sel.kind === 'steam') { file.steam!.splice(sel.i, 1); syncEffects(); }
  else if (sel.kind === 'godray') { file.godrays!.splice(sel.i, 1); syncEffects(); }
  else if (sel.kind === 'beacon') { file.beacons!.splice(sel.i, 1); syncEffects(); }
  else if (sel.kind === 'drips') { delete file.drips; syncEffects(); }
  else if (sel.kind === 'mover') { file.movers!.splice(sel.i, 1); if (!file.movers!.length) delete file.movers; void rebuild().then(redraw.overlay); }
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
  ed.lux = { x: Math.round(w / 2), facing: 1, show: true, follow: ed.lux.follow, track: ed.lux.track };
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
  else if (sel.kind === 'steam') { const e = file.steam![sel.i]; e.x += dx; e.y += dy; syncEffects(); }
  else if (sel.kind === 'godray') { const g = file.godrays![sel.i]; g.x += dx; g.y += dy; syncEffects(); }
  else if (sel.kind === 'beacon') { const b = file.beacons![sel.i]; b.x += dx; b.y += dy; syncEffects(); }
  else if (sel.kind === 'drips') { const d = file.drips!; d.x0 += dx; d.x1 += dx; d.top += dy; d.bottom += dy; syncEffects(); }
  else if (sel.kind === 'mover') { const m = file.movers![sel.i]; m.x0 += dx; m.x1 += dx; if (dy) m.y = (m.y ?? ed.scene?.loaded.movers?.[sel.i]?.sprite.def.y ?? 0) + dy; }
  remember(before);
  redraw.overlay();
  redraw.side();
}

/* ---------- lights suggested from the art ---------- */

/** A glow map at half the level's resolution: one pixel for two by two level pixels. */
async function glowImage(url: string, w: number, h: number): Promise<GlowImage> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(w / 2));
  cv.height = Math.max(1, Math.round(h / 2));
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0, cv.width, cv.height);
  return { w: cv.width, h: cv.height, data: cx.getImageData(0, 0, cv.width, cv.height).data };
}

/** Lights at what the art shows lit, in both views, marked suggested until kept. */
export async function suggestFromArt(): Promise<void> {
  if (!ed.scene) return;
  setStatus('Looking for lights in the art…');
  const layers: GlowLayer[] = [];
  for (const [i, layer] of ed.file.layers.entries()) {
    const def = ed.scene.loaded.sprites[i]?.def;
    if (!def || (def.actor ?? def.kind === 'character')) continue;
    const map = async (name: 'glow.raw' | 'glow.concierge') => (def.maps.includes(name) ? glowImage(`${base}/${layer.asset}/${name}.png?v=${Date.now()}`, def.w, def.h) : undefined);
    layers.push({ raw: await map('glow.raw'), concierge: await map('glow.concierge'), scale: 2, x0: def.x, y0: def.y, parallax: def.parallax, street: def.parallax === 1 && !def.front });
  }
  // outside, the ground below the reflection line glows with the lights' reflections and pools, not lights of its own;
  // inside, below the floor can be another room (the cutaway of Lux's block)
  const floor = ed.file.kind === 'exterior' ? ed.file.mirror ?? ed.file.walk.y - 8 : Infinity;
  if (!layers.some((l) => l.raw || l.concierge)) { setStatus('Nothing to read lights from: no layer has glow maps (art in the flat look has them)'); return; }
  const found = suggestLights(layers, ed.file.lights.map(resolveLight), { floor });
  if (!found.length) { setStatus('No more lights found in the art'); return; }
  const before = snapshot();
  ed.file.lights.push(...found);
  remember(before);
  setStatus(`${found.length} lights suggested: dashed rings. Keep, move or discard them`);
  redraw.overlay();
  redraw.side();
}

/** Keep the suggested lights, or discard them: all of them at once. */
export function settleSuggested(keep: boolean): void {
  const before = snapshot();
  if (keep) for (const l of ed.file.lights) delete l.suggested;
  else ed.file.lights = ed.file.lights.filter((l) => !l.suggested);
  if (ed.scene) ed.scene.loaded.def.lights = ed.file.lights;
  if (ed.sel.kind === 'light') ed.sel = { kind: 'scene' };
  remember(before);
  redraw.overlay();
  redraw.side();
}
