// Scenes in and out of the editor: opening one, building it for rendering, keeping the built scene in step with the file,
// saving through the dev server, and undo.

import { NW } from '../engine/renderer';
import { SceneRunner } from '../game/scene';
import { buildScene, loadSceneFile, zoneTexture, type SceneFile } from '../game/scenefile';
import { base, dom, ed, gl, markDirty, redraw, setStatus, undoStack } from './state';

/** Build the scene for rendering from the file. Lights stay shared with the file, so editing them shows at once. */
export async function rebuild(): Promise<void> {
  const built = await buildScene(gl, base, ed.file, ed.world, String(Date.now()));
  ed.scene = built;
  ed.runner = new SceneRunner(built.loaded);
  syncScroll();
}

/** After a change to the walk line, the reflection line, the ground or the areas: the parts of the built scene that copy them. */
export function refresh(): void {
  if (!ed.scene) return;
  ed.scene.loaded.def.mirror = ed.file.mirror ?? ed.file.walk.y - 8;
  ed.scene.loaded.def.ground = ed.file.ground;
  if (!ed.file.zoneMap) ed.scene.loaded.zone = zoneTexture(gl, ed.file);
  redraw.overlay();
}

/**
 * After a change to the effects: the built scene takes the file's steam, light shafts, beacons and drips again (an effect
 * added to a scene that had none is a new list), and the runner reads the ones it keeps copies of. Movers share their
 * settings with the file; a new one, or a new asset or layer for one, needs a rebuild.
 */
export function syncEffects(): void {
  if (!ed.scene) return;
  const d = ed.scene.loaded.def, f = ed.file;
  d.steam = f.steam ?? [];
  d.godrays = f.godrays ?? [];
  d.beacons = f.beacons ?? [];
  d.drips = f.drips;
  ed.runner?.sync();
  redraw.overlay();
}

export function syncScroll(): void {
  const max = Math.max(0, ed.file.size[0] - NW);
  dom.scroll.hidden = max === 0;
  dom.scroll.max = String(max);
  ed.camX = Math.min(ed.camX, max);
  dom.scroll.value = String(ed.camX);
}

export async function openScene(id: string): Promise<void> {
  ed.file = await loadSceneFile(base, id);
  ed.look?.setScene(ed.file);
  undoStack.length = 0;
  ed.dirty = false;
  ed.sel = { kind: 'scene' };
  ed.camX = 0;
  const first = Object.values(ed.file.spawns)[0];
  ed.luna = { x: first?.x ?? ed.file.size[0] / 2, facing: first?.facing ?? 1, show: true, follow: ed.luna.follow, track: ed.luna.track };
  await rebuild();
  dom.sceneSel.value = id;
  syncAddress();
  setStatus('');
  updatePlay();
  redraw.overlay();
  redraw.side();
}

/** The Play link starts the game in this scene, at its first place. */
/** The address names the scene and the view on screen, so a reload comes back to them. */
export function syncAddress(): void {
  window.history.replaceState(null, '', `?scene=${ed.file.id}${ed.view < 0.5 ? '&view=raw' : ''}`);
}

export function updatePlay(): void {
  const spawn = Object.keys(ed.file.spawns)[0];
  dom.play.href = `./?scene=${ed.file.id}${spawn ? `&spawn=${spawn}` : ''}`;
}

/** Every built asset, as scene/name, from the bench's lists. */
export async function listAssets(): Promise<string[]> {
  const get = async <T>(url: string) => { const r = await fetch(url, { cache: 'no-store' }); return r.ok ? ((await r.json()) as T) : null; };
  const index = await get<{ scenes: string[] }>(`${base}/bench.json`);
  const lists = await Promise.all((index?.scenes ?? []).map(async (s) => ((await get<{ assets: string[] }>(`${base}/${s}/bench.json`))?.assets ?? []).map((a) => `${s}/${a}`)));
  return lists.flat();
}

export async function save(): Promise<void> {
  try {
    const res = await fetch(`/__scene?id=${encodeURIComponent(ed.file.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ed.file) });
    if (!res.ok) throw new Error(await res.text());
    ed.dirty = false;
    if (!ed.world.scenes.includes(ed.file.id)) ed.world.scenes.push(ed.file.id);
    setStatus(`Saved ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    setStatus(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function undo(): Promise<void> {
  const prev = undoStack.pop();
  if (!prev) return;
  const layersBefore = JSON.stringify(ed.file.layers), moversBefore = JSON.stringify(ed.file.movers ?? []);
  ed.file = JSON.parse(prev) as SceneFile;
  // lights, effects and the rest are taken from the file again; layers and movers load again only when they changed
  if (JSON.stringify(ed.file.layers) !== layersBefore || JSON.stringify(ed.file.movers ?? []) !== moversBefore || !ed.scene) await rebuild();
  else {
    ed.scene.loaded.def.lights = ed.file.lights;
    // the movers' settings are the file's own objects: the ones just replaced by the undo
    ed.scene.loaded.movers?.forEach((m, k) => { m.def = ed.file.movers![k]; });
    syncEffects();
    refresh();
  }
  markDirty();
  if (!undoStack.length) setStatus('Undone to where you started');
  redraw.overlay();
  redraw.side();
}
