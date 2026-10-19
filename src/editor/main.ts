// The scene editor: a scene rendered as in the game, its lights, hotspots, places and areas drawn over it to select,
// drag and edit, and Lux to judge the light on. Saves to public/assets/scenes/<id>/scene.json through the dev server.
// Its parts: state.ts (what is edited), files.ts (opening, building, saving, undo), overlay.ts (what is drawn over the
// scene, and dragging it), panels.ts with form.ts (the side panel), edit.ts (adding and deleting).

import '../style.css';
import { loadSprite, spriteDefaults } from '../engine/assets';
import { loadProjectLook } from '../engine/look';
import { fitCanvas, type DrawSprite } from '../engine/renderer';
import { frameFor } from '../game/anim';
import { heroDrawing } from '../game/hero';
import { loadWorld } from '../game/scenefile';
import { createLookPanel } from '../look-panel';
import { add, deleteSelected, newScene, nudge } from './edit';
import { listAssets, openScene, save, undo } from './files';
import { bindOverlay, drawOverlay } from './overlay';
import { drawSide } from './panels';
import { base, dom, ed, gl, redraw, renderer, showError, t0, viewX } from './state';

redraw.overlay = drawOverlay;
redraw.side = drawSide;

function draw(): void {
  fitCanvas(dom.canvas);
  if (!ed.scene || !ed.runner) return;
  const file = ed.file, t = (performance.now() - t0) / 1000, actors: DrawSprite[] = [], cam: [number, number] = [viewX(), 0];
  if (ed.hero && ed.lux.show) actors.push(heroDrawing(ed.hero, { x: ed.lux.x, walkY: file.walk.y, cam, scale: file.actorScale ?? 1, facing: ed.lux.facing, frame: frameFor(ed.hero.def, false, 0, t, ed.lux.facing) }));
  renderer.render(ed.runner.frame(t, { view: ed.view, sinceSwitch: t - ed.switchedAt }, cam, actors, [-1000, -1000]));
}

function syncView(): void {
  dom.viewBtn.setAttribute('aria-pressed', String(ed.view > 0.5));
  dom.viewBtn.textContent = ed.view > 0.5 ? 'Concierge view' : 'Raw view';
}

function toggleView(): void {
  ed.view = ed.view > 0.5 ? 0 : 1;
  ed.switchedAt = (performance.now() - t0) / 1000;
  syncView();
  ed.look?.refresh();
}

/* ---------- wiring ---------- */

bindOverlay();
document.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((b) => b.addEventListener('click', () => void add(b.dataset.add!).catch(showError)));
const addEffect = document.getElementById('add-effect') as HTMLSelectElement;
addEffect.addEventListener('change', () => { const kind = addEffect.value; addEffect.value = ''; if (kind) void add(kind).catch(showError); });
dom.button('new-scene').addEventListener('click', () => void newScene().catch(showError));
dom.button('save').addEventListener('click', () => void save());
dom.button('undo').addEventListener('click', () => void undo());
dom.button('look').addEventListener('click', () => ed.look?.toggle());
dom.viewBtn.addEventListener('click', toggleView);
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
  const [project, list] = await Promise.all([loadProjectLook(base), listAssets()]);
  ed.assets = list;
  for (const id of ed.world.scenes) dom.sceneSel.add(new Option(id, id));
  const heroPath = ed.world.hero.sprite, cut = heroPath.lastIndexOf('/');
  ed.hero = await loadSprite(gl, `${base}/${heroPath.slice(0, cut)}`, heroPath.slice(cut + 1), spriteDefaults(gl)).catch(() => null);
  ed.look = createLookPanel(renderer, project, dom.stage, {
    view: () => (ed.view < 0.5 ? 'raw' : 'concierge'),
    // the scene's own look was saved into its file: so the editor's own Save keeps it
    onSceneSaved: (id, json) => { if (ed.file?.id === id) { if (json) ed.file.look = json; else delete ed.file.look; } },
  });
  const asked = new URLSearchParams(location.search).get('scene');
  await openScene(asked && ed.world.scenes.includes(asked) ? asked : ed.world.scenes[0]);
  syncView();
  document.documentElement.dataset.ready = '1';
  const loop = () => { requestAnimationFrame(loop); if (document.visibilityState === 'visible') draw(); };
  requestAnimationFrame(loop);
}

start().catch(showError);
