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

/** After a change to the walk line, the reflection line or the areas: the parts of the built scene that copy them. */
export function refresh(): void {
  if (!ed.scene) return;
  ed.scene.loaded.def.mirror = ed.file.mirror ?? ed.file.walk.y - 8;
  if (!ed.file.zoneMap) ed.scene.loaded.zone = zoneTexture(gl, ed.file);
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
  ed.lux = { x: first?.x ?? ed.file.size[0] / 2, facing: first?.facing ?? 1, show: true, follow: ed.lux.follow };
  await rebuild();
  dom.sceneSel.value = id;
  window.history.replaceState(null, '', `?scene=${id}`);
  setStatus('');
  updatePlay();
  redraw.overlay();
  redraw.side();
}

/** The Play link starts the game in this scene, at its first place. */
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
  const layersBefore = JSON.stringify(ed.file.layers);
  ed.file = JSON.parse(prev) as SceneFile;
  // lights and the rest are rebuilt from the file; layers only reload when they changed
  if (JSON.stringify(ed.file.layers) !== layersBefore || !ed.scene) await rebuild();
  else { ed.scene.loaded.def.lights = ed.file.lights; refresh(); }
  markDirty();
  if (!undoStack.length) setStatus('Undone to where you started');
  redraw.overlay();
  redraw.side();
}
