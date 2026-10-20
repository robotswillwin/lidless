// The scene editor: a scene rendered as in the game, its lights, hotspots, places and areas drawn over it to select,
// drag and edit, and Luna to judge the light on. Saves to public/assets/scenes/<id>/scene.json through the dev server.
// Its parts: state.ts (what is edited), files.ts (opening, building, saving, undo), overlay.ts (what is drawn over the
// scene, and dragging it), panels.ts with form.ts (the side panel), edit.ts (adding and deleting).

import '../style.css';
import { Story } from 'inkjs';
import { loadSprite, spriteDefaults, type LightDef } from '../engine/assets';
import { loadProjectLook } from '../engine/look';
import { loadPresets, presets } from '../engine/presets';
import { fitCanvas, type DrawSprite } from '../engine/renderer';
import { heroDrawing } from '../game/hero';
import { loadSceneFile, loadWorld } from '../game/scenefile';
import storyJson from '../story/main.ink';
import { createLookPanel } from '../look-panel';
import { add, deleteSelected, newScene, nudge } from './edit';
import { listAssets, openScene, revert, save, syncAddress, undo } from './files';
import { lunaFrame } from './luna';
import { bindOverlay, drawOverlay } from './overlay';
import { drawSide } from './panels';
import { base, dom, ed, gl, inTask, prefs, redraw, renderer, savePrefs, showError, t0, viewX, type Kind, type Task } from './state';

redraw.overlay = drawOverlay;
redraw.side = drawSide;

let lastT = 0;

function draw(): void {
  fitCanvas(dom.canvas);
  if (!ed.scene || !ed.runner) return;
  const file = ed.file, t = (performance.now() - t0) / 1000, dt = t - lastT, actors: DrawSprite[] = [];
  lastT = t;
  if (ed.hero && ed.luna.show) {
    // following the pointer she moves on, and her marker on the walk line with her
    const was = ed.luna.x, frame = lunaFrame(t, dt);
    // (with the camera following her, everything over the scene moves with it)
    if (ed.luna.x !== was) {
      if (ed.luna.follow) drawOverlay();
      else dom.overlay.querySelector('.luna path')?.setAttribute('d', `M ${ed.luna.x - 7} ${file.walk.y + 14} L ${ed.luna.x} ${file.walk.y + 4} L ${ed.luna.x + 7} ${file.walk.y + 14} Z`);
    }
    actors.push(heroDrawing(ed.hero, { x: ed.luna.x, walkY: file.walk.y, cam: [viewX(), 0], scale: file.actorScale ?? 1, facing: ed.luna.facing, frame }));
  }
  const cam: [number, number] = [viewX(), 0];
  renderer.lightView = ed.lightView;
  renderer.render(ed.runner.frame(t, { view: ed.view, sinceSwitch: t - ed.switchedAt }, cam, actors, [-1000, -1000]));
}

/** The mode buttons, and in Both mode which view is on screen. */
function syncView(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === ed.mode)));
  dom.showing.textContent = ed.mode === 'both' ? `showing ${ed.view < 0.5 ? 'raw' : 'AR'}` : '';
  dom.showing.dataset.view = ed.view < 0.5 ? 'raw' : 'concierge';
}

/** The view on screen: everything over the scene and the side panel show it as it is there. */
function showView(v: 0 | 1): void {
  if (ed.view === v) return;
  ed.view = v;
  ed.switchedAt = (performance.now() - t0) / 1000;
  ed.look?.refresh();
  syncAddress();
}

/** The kind of thing a selection is, to tell whether it belongs to a task. */
const KIND_OF: Record<string, Kind | 'layers'> = { light: 'lights', spawn: 'spawns', zone: 'areas', layer: 'layers', steam: 'effects', godray: 'effects', beacon: 'effects', drips: 'effects', mover: 'effects' };

/** What is being worked on: its add buttons in the toolbar, its things over the scene, its parts of the panel. */
function setTask(t: Task): void {
  ed.task = t;
  savePrefs();
  const sel = ed.sel, kind = sel.kind === 'hotspot' ? (ed.file?.hotspots[sel.i]?.go ? 'exits' : 'hotspots') : KIND_OF[sel.kind];
  // what is selected stays selected only if it belongs to the task (layers belong to the layout)
  if (kind && t !== 'all' && !(kind === 'layers' ? t === 'layout' : inTask(kind))) ed.sel = { kind: 'scene' };
  syncTask();
  if (ed.file) { drawOverlay(); drawSide(); }
}

/** What each task is, under the task's add buttons. */
const TASK_HINTS: Record<Task, string> = {
  all: 'Everything in the scene. 2 to 5 work on one thing at a time.',
  layout: 'The walk line, the reflection line and the ground, areas, layers, the camera, the people’s size.',
  interaction: 'Hotspots and exits, their texts and conversations, places to arrive at.',
  lighting: 'Lights and their kinds, and the scene’s light. G shows only what the lights do.',
  effects: 'Steam and smoke, light shafts, beacons, drips, movers.',
};

function syncTask(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-task]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.task === ed.task)));
  document.querySelectorAll<HTMLElement>('[data-in]').forEach((e) => { e.hidden = ed.task !== 'all' && e.dataset.in !== ed.task; });
  dom.toolsHint.textContent = TASK_HINTS[ed.task];
}

/** Both, raw or AR: in raw or AR, that view is on screen. */
function setMode(m: typeof ed.mode): void {
  ed.mode = m;
  if (m !== 'both') showView(m === 'raw' ? 0 : 1);
  syncView();
  drawOverlay();
  drawSide();
}

/** E: in Both mode the other view on screen; in raw or AR mode the other mode. */
function toggleView(): void {
  if (ed.mode !== 'both') return setMode(ed.mode === 'raw' ? 'concierge' : 'raw');
  showView(ed.view > 0.5 ? 0 : 1);
  syncView();
  drawOverlay();
  drawSide();
}

/* ---------- wiring ---------- */

bindOverlay();
document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.addEventListener('click', () => void add(b.dataset.add!).catch(showError)));
const addLight = document.getElementById('add-light') as HTMLSelectElement;
addLight.addEventListener('change', () => { const kind = addLight.value; addLight.value = ''; if (kind) void add(kind).catch(showError); });
const addEffect = document.getElementById('add-effect') as HTMLSelectElement;
addEffect.addEventListener('change', () => { const kind = addEffect.value; addEffect.value = ''; if (kind) void add(kind).catch(showError); });
dom.button('new-scene').addEventListener('click', () => void newScene().catch(showError));
dom.button('save').addEventListener('click', () => void save());
dom.button('undo').addEventListener('click', () => void undo());
dom.button('revert').addEventListener('click', () => void revert().catch(showError));
dom.button('look').addEventListener('click', () => ed.look?.toggle());
const lighting = dom.button('lighting');
const toggleLighting = () => { ed.lightView = !ed.lightView; lighting.setAttribute('aria-pressed', String(ed.lightView)); };
lighting.addEventListener('click', toggleLighting);
document.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode as typeof ed.mode)));
document.querySelectorAll<HTMLButtonElement>('[data-task]').forEach((b) => b.addEventListener('click', () => setTask(b.dataset.task as Task)));
const TASKS: Task[] = ['all', 'layout', 'interaction', 'lighting', 'effects'];
setTask(TASKS.includes(prefs.task as Task) ? (prefs.task as Task) : 'all');
dom.sceneSel.addEventListener('change', () => {
  if (ed.dirty && !confirm('Leave this scene without saving?')) { dom.sceneSel.value = ed.file.id; return; }
  void openScene(dom.sceneSel.value).catch(showError);
});
dom.scroll.addEventListener('input', () => { ed.camX = Number(dom.scroll.value); drawOverlay(); });
dom.stage.addEventListener('wheel', (e) => {
  const max = Number(dom.scroll.max);
  if (!max) return;
  ed.camX = Math.max(0, Math.min(max, ed.camX + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY)));
  dom.scroll.value = String(ed.camX);
  drawOverlay();
  e.preventDefault();
}, { passive: false });
window.addEventListener('beforeunload', (e) => { if (ed.dirty) e.preventDefault(); });

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
  else if (k === 'l' || k === 'L') ed.look?.toggle();
  else if (k === 'g' || k === 'G') toggleLighting();
  else if (k >= '1' && k <= '5') setTask(TASKS[Number(k) - 1]);
  else if (k === 'Escape') { ed.sel = { kind: 'scene' }; drawOverlay(); drawSide(); }
  else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelected(); }
  else if (k.startsWith('Arrow') && ed.sel.kind !== 'scene') {
    e.preventDefault();
    const d = e.shiftKey ? 10 : 1;
    nudge(k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0);
  }
});

/* ---------- start ---------- */

async function start(): Promise<void> {
  ed.world = await loadWorld(base);
  const [project, list] = await Promise.all([loadProjectLook(base), listAssets(), loadPresets(base)]);
  ed.assets = list;
  for (const id of ed.world.scenes) dom.sceneSel.add(new Option(id, id));
  // the kinds of light, after a light of its own
  // the kinds of light by the views they shine in
  for (const [title, test] of [['Both views', (l: LightDef) => !l.ar && !l.raw], ['AR only', (l: LightDef) => !!l.ar], ['Raw only', (l: LightDef) => !!l.raw && !l.ar]] as const) {
    const kinds = Object.entries(presets().lights).filter(([, p]) => test(p.light as LightDef));
    if (!kinds.length) continue;
    const group = document.createElement('optgroup');
    group.label = title;
    for (const [key, p] of kinds) group.append(new Option(p.label, `light:${key}`));
    addLight.append(group);
  }
  const heroPath = ed.world.hero.sprite, cut = heroPath.lastIndexOf('/');
  ed.hero = await loadSprite(gl, `${base}/${heroPath.slice(0, cut)}`, heroPath.slice(cut + 1), spriteDefaults(gl)).catch(() => null);
  ed.look = createLookPanel(renderer, project, dom.stage, {
    view: () => (ed.view < 0.5 ? 'raw' : 'concierge'),
    // the scene's own look was saved into its file: so the editor's own Save keeps it
    onSceneSaved: (id, json) => { if (ed.file?.id === id) { if (json) ed.file.look = json; else delete ed.file.look; } },
  });
  // the other scenes as saved, to check the exits between them both ways; and the story's conversations
  const files = await Promise.all(ed.world.scenes.map((id) => loadSceneFile(base, id).catch(() => null)));
  ed.others = Object.fromEntries(files.flatMap((f) => (f ? [[f.id, f]] : [])));
  try {
    ed.knots = new Set(new Story(storyJson).mainContentContainer.namedContent.keys());
  } catch {
    // without the story, conversations are not checked
  }
  const params = new URLSearchParams(location.search), asked = params.get('scene');
  if (params.get('view') === 'raw') ed.view = 0;
  await openScene(asked && ed.world.scenes.includes(asked) ? asked : ed.world.scenes[0]);
  syncView();
  document.documentElement.dataset.ready = '1';
  const loop = () => { requestAnimationFrame(loop); if (document.visibilityState === 'visible') draw(); };
  requestAnimationFrame(loop);
}

start().catch(showError);
