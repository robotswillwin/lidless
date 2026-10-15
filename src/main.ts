// Lidless: boot, input, the frame loop, conversations, the view switch and saving.

import './style.css';
import { loadScene } from './engine/assets';
import { NH, NW, QUALITY, Renderer, type Tier } from './engine/renderer';
import { Dialogue } from './game/dialogue';
import { loadLevel, pick, type Hotspot } from './game/level';
import { clearSave, loadSave, writeSave } from './game/save';
import { SceneRunner, type ViewState } from './game/scene';
import { UI } from './game/ui';
import { World } from './game/world';

const params = new URLSearchParams(location.search);
const stage = document.querySelector('.stage') as HTMLElement;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const viewBtn = document.getElementById('view') as HTMLButtonElement;
const viewLabel = document.getElementById('view-label') as HTMLElement;
const stats = document.getElementById('stats') as HTMLElement;
const errorBox = document.getElementById('error') as HTMLElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickTier(): Tier {
  const q = params.get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}

/** Match the canvas to the device pixels it covers, so the sharp upscale has real pixels to work with. */
function fitCanvas(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(NW, Math.min(3840, Math.round(canvas.clientWidth * dpr)));
  const h = Math.round((w * NH) / NW);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

/** Pointer position in level pixels. */
function toLevel(e: PointerEvent, cam: [number, number]): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * NW + cam[0], ((e.clientY - r.top) / r.height) * NH + cam[1]];
}

async function boot(): Promise<void> {
  if (params.has('new')) clearSave();
  const base = `${import.meta.env.BASE_URL}assets/styleframe`;
  const renderer = new Renderer(canvas, QUALITY[pickTier()]);
  const [scene, level] = await Promise.all([loadScene(renderer.gl, base), loadLevel(base)]);
  const save = loadSave();
  const runner = new SceneRunner(scene, new Set([level.hero.sprite]));
  const heroSprite = runner.sprite(level.hero.sprite);
  const world = new World(level, save?.heroX, save?.facing);
  const dialogue = new Dialogue(save?.ink ?? null);
  const ui = new UI(stage);
  const debugView = params.get('view') === 'raw';
  const canSwitch = () => dialogue.hasRaw || debugView;
  const state: ViewState = { view: debugView ? 0 : save && canSwitch() ? save.view : 1, sinceSwitch: 10 };
  const cam: [number, number] = [0, 0];
  const t0 = performance.now(), fixedT = params.has('t') ? Number(params.get('t')) : null;
  const clock = () => fixedT ?? (performance.now() - t0) / 1000;
  let switchedAt = -10, lastT = clock(), frames = 0, fpsAt = performance.now(), fps = 0, talking: string | null = null;

  const persist = () => writeSave({ v: 1, heroX: Math.round(world.heroX), facing: world.facing, view: state.view, ink: dialogue.save() });

  const syncView = () => {
    viewBtn.hidden = !canSwitch();
    viewBtn.setAttribute('aria-pressed', String(state.view > 0.5));
    viewLabel.textContent = state.view > 0.5 ? 'Concierge view' : 'Raw view';
  };
  const toggleView = () => {
    if (!canSwitch()) return;
    state.view = state.view > 0.5 ? 0 : 1;
    switchedAt = clock();
    syncView();
    persist();
  };

  // conversations
  const endTalk = () => {
    ui.closeDialogue();
    const unlocked = talking === 'fixer' && canSwitch() && viewBtn.hidden;
    talking = null;
    syncView();
    persist();
    if (unlocked) {
      ui.showCaption('Something behind your eye is new. Press E, or the button, to see the street as it is.');
      switchedAt = clock();
    }
  };
  ui.onChoose = (i) => {
    const said = dialogue.choices[i];
    const lines = dialogue.choose(i);
    if (!lines.length && !dialogue.choices.length) return endTalk();
    ui.showDialogue(lines, dialogue.choices, said);
  };
  ui.onClose = endTalk;

  const interact = (h: Hotspot) => {
    const raw = state.view < 0.5;
    if (h.talk) {
      talking = h.talk;
      ui.showDialogue(dialogue.start(h.talk, raw), dialogue.choices);
    } else if (h.look) ui.showCaption(pick(h.look, raw));
  };

  // pointer: hover names, click or tap to walk or to use
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || ui.dialogueOpen) return ui.showHover(null);
    const [x, y] = toLevel(e, cam), h = world.hotspotAt(x, y);
    canvas.style.cursor = h ? 'pointer' : 'default';
    ui.showHover(h ? pick(h.name, state.view < 0.5) : null, e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => ui.showHover(null));
  canvas.addEventListener('pointerdown', (e) => {
    if (ui.dialogueOpen) return;
    const [x, y] = toLevel(e, cam), h = world.hotspotAt(x, y);
    if (!h) return world.walkTo(x);
    if (h.stand === undefined) return interact(h);
    world.walkTo(h.stand, h);
  });

  // keyboard: arrows or A/D walk, E switches view, number keys answer, Q cycles quality
  const held = new Set<string>();
  const syncKeys = () => { world.keyDir = (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0); };
  const dirOf = (k: string) => (k === 'ArrowLeft' || k === 'a' || k === 'A' ? 'left' : k === 'ArrowRight' || k === 'd' || k === 'D' ? 'right' : null);
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (ui.key(e.key)) return e.preventDefault();
    const dir = dirOf(e.key);
    if (dir && !ui.dialogueOpen) { held.add(dir); syncKeys(); return e.preventDefault(); }
    if (e.key === 'e' || e.key === 'E') toggleView();
    if (e.key === 'q' || e.key === 'Q') {
      const order: Tier[] = ['low', 'medium', 'high'];
      renderer.quality = QUALITY[order[(order.indexOf(renderer.quality.tier) + 1) % order.length]];
      stats.hidden = false;
    }
  });
  document.addEventListener('keyup', (e) => {
    const dir = dirOf(e.key);
    if (dir) { held.delete(dir); syncKeys(); if (!world.keyDir) persist(); }
  });
  window.addEventListener('blur', () => { held.clear(); syncKeys(); });
  viewBtn.addEventListener('click', toggleView);

  const draw = () => {
    const t = clock(), dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    const wasMoving = world.moving;
    const arrived = ui.dialogueOpen ? null : world.update(dt);
    if (arrived) interact(arrived);
    if (wasMoving && !world.moving) persist();
    state.sinceSwitch = reduceMotion ? 10 : t - switchedAt;
    const flip = world.facing < 0, [ax, ay] = level.hero.anchor, w = heroSprite.def.w;
    const hx = Math.round(world.heroX - cam[0] - (flip ? w - ax : ax)), hy = Math.round(level.walk.y - cam[1] - ay + world.bob);
    const smoke: [number, number] = [world.heroX + level.hero.smoke[0] * world.facing, level.walk.y + level.hero.smoke[1] + world.bob];
    fitCanvas();
    renderer.render(runner.frame(t, state, cam, [{ sprite: heroSprite, x: hx, y: hy, flip }], smoke));
    frames++;
    const now = performance.now();
    if (now - fpsAt > 500) { fps = (frames * 1000) / (now - fpsAt); frames = 0; fpsAt = now; }
    if (!stats.hidden) stats.textContent = `${renderer.quality.tier} · ${fps.toFixed(0)} fps · ${canvas.width}×${canvas.height}`;
  };

  stats.hidden = !params.has('debug');
  syncView();
  draw();
  document.documentElement.dataset.ready = '1';
  if (fixedT !== null) return;

  let visible = true, last = 0;
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; lastT = clock(); });
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (!visible || now - last < 15) return;
    last = now;
    draw();
  };
  requestAnimationFrame(loop);
}

boot().catch((err: unknown) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  errorBox.hidden = false;
  errorBox.textContent = `Lidless could not start: ${msg}`;
  document.documentElement.dataset.err = msg;
});
