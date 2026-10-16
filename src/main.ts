// Lidless: boot, scenes and the ways between them, input, the frame loop, conversations, the view switch and saving.

import './style.css';
import { loadSprite, spriteDefaults } from './engine/assets';
import { loadProjectLook } from './engine/look';
import { fitCanvas, NH, NW, QUALITY, Renderer, type Tier } from './engine/renderer';
import { frameFor, hasLeft } from './game/anim';
import { Dialogue } from './game/dialogue';
import { inView, pick, type Hotspot } from './game/level';
import { clearSave, loadSave, writeSave } from './game/save';
import { SceneRunner, type ViewState } from './game/scene';
import { buildScene, loadSceneFile, loadWorld, type Exit, type Scene } from './game/scenefile';
import { UI } from './game/ui';
import { World } from './game/world';
import { createLookPanel } from './look-panel';

const params = new URLSearchParams(location.search);
const stage = document.querySelector('.stage') as HTMLElement;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const viewBtn = document.getElementById('view') as HTMLButtonElement;
const viewLabel = document.getElementById('view-label') as HTMLElement;
const stats = document.getElementById('stats') as HTMLElement;
const errorBox = document.getElementById('error') as HTMLElement;
const fade = document.getElementById('fade') as HTMLElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickTier(): Tier {
  const q = params.get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}

/** Pointer position in level pixels. */
function toLevel(e: PointerEvent, cam: [number, number]): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * NW + cam[0], ((e.clientY - r.top) / r.height) * NH + cam[1]];
}

async function boot(): Promise<void> {
  if (params.has('new')) clearSave();
  const assets = `${import.meta.env.BASE_URL}assets`;
  const renderer = new Renderer(canvas, QUALITY[pickTier()]), gl = renderer.gl;
  const [worldFile, projectLook] = await Promise.all([loadWorld(assets), loadProjectLook(assets)]);
  const save = loadSave();
  const heroPath = worldFile.hero.sprite, cut = heroPath.lastIndexOf('/');
  const heroSprite = await loadSprite(gl, `${assets}/${heroPath.slice(0, cut)}`, heroPath.slice(cut + 1), spriteDefaults(gl));
  const heroAnchor = heroSprite.def.anchor ?? [heroSprite.def.w / 2, heroSprite.def.h];
  const heroBob = () => (heroSprite.def.anims?.walk ? 0 : world.bob);

  // scenes are kept once loaded, so going back and forth is quick
  const scenes = new Map<string, Promise<Scene>>();
  const sceneById = (id: string) => {
    if (!scenes.has(id)) scenes.set(id, loadSceneFile(assets, id).then((file) => buildScene(gl, assets, file, worldFile)));
    return scenes.get(id)!;
  };
  let scene: Scene, runner: SceneRunner, world: World;
  const cam: [number, number] = [0, 0];
  let camX = 0;
  /** Where the camera wants to be: her in the middle, the scene's ends never past the screen's. */
  const camTarget = () => Math.max(0, Math.min(scene.file.size[0] - NW, world.heroX - NW / 2));
  const enter = async (id: string, at: { spawn?: string; x?: number; facing?: 1 | -1 }) => {
    const next = await sceneById(id), sp = at.spawn ? next.file.spawns[at.spawn] : undefined;
    scene = next;
    runner = new SceneRunner(next.loaded);
    world = new World(next.level, at.x ?? sp?.x, at.facing ?? sp?.facing);
    camX = camTarget();
    cam[0] = Math.round(camX);
  };
  // the scene to start in: asked for in the address, or the saved one, or where the world starts
  const askedScene = params.get('scene');
  const startId = askedScene ?? (save?.scene && worldFile.scenes.includes(save.scene) ? save.scene : worldFile.start.scene);
  if (askedScene) await enter(startId, { spawn: params.get('spawn') ?? Object.keys((await sceneById(startId)).file.spawns)[0] });
  else if (save?.scene === startId) await enter(startId, { x: save.heroX, facing: save.facing });
  else await enter(startId, { spawn: worldFile.start.spawn });

  const dialogue = new Dialogue(save?.ink ?? null);
  const ui = new UI(stage);
  const debugView = params.get('view') === 'raw';
  const canSwitch = () => dialogue.hasRaw || debugView;
  const state: ViewState = { view: debugView ? 0 : save && canSwitch() ? save.view : 1, sinceSwitch: 10 };
  // the look panel (L): pixels, light, characters, colour and film, from the game's saved look; split settings follow the view
  const look = createLookPanel(renderer, projectLook, stage, { view: () => (state.view < 0.5 ? 'raw' : 'concierge') });
  const t0 = performance.now(), fixedT = params.has('t') ? Number(params.get('t')) : null;
  const clock = () => fixedT ?? (performance.now() - t0) / 1000;
  let switchedAt = -10, lastT = clock(), frames = 0, fpsAt = performance.now(), fps = 0, lockedBeforeTalk = false;

  const persist = () => writeSave({ v: 1, scene: scene.file.id, heroX: Math.round(world.heroX), facing: world.facing, view: state.view, ink: dialogue.save() });

  // a door or the end of the street: fade out, go to the other scene, fade in
  let travelling = false;
  const travel = async (exit: Exit) => {
    if (travelling) return;
    travelling = true;
    world.stop();
    held.clear();
    ui.showHover(null);
    fade.classList.add('on');
    await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 260));
    try {
      await enter(exit.scene, { spawn: exit.spawn });
      syncKeys();
      persist();
    } catch (err) {
      ui.showCaption(`That way is not built yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    fade.classList.remove('on');
    travelling = false;
  };
  /** An exit at an end of the walk line, which walking into with the keyboard takes. */
  const exitAt = (x: number) => scene.file.hotspots.find((h) => h.go && inView(h, state.view < 0.5) && x >= h.rect[0] - 1 && x <= h.rect[0] + h.rect[2] + 1);

  const syncView = () => {
    viewBtn.hidden = !canSwitch();
    viewBtn.setAttribute('aria-pressed', String(state.view > 0.5));
    viewLabel.textContent = state.view > 0.5 ? 'Concierge view' : 'Raw view';
  };
  // On the dev server E switches view from the start, to look at both views while building the game; the button and
  // every built version keep the story's lock until the fixer has opened her eye.
  const toggleView = (force = false) => {
    if (!canSwitch() && !force) return;
    state.view = state.view > 0.5 ? 0 : 1;
    switchedAt = clock();
    look.refresh();
    syncView();
    persist();
  };

  // conversations
  const endTalk = () => {
    ui.closeDialogue();
    // the conversation that unlocks the view switch, whichever it is, says how to use it
    const unlocked = lockedBeforeTalk && canSwitch();
    lockedBeforeTalk = false;
    syncView();
    persist();
    if (unlocked) {
      ui.showCaption('Something behind your eye is new. Press E, or the button, to see what is really there.');
      switchedAt = clock();
    }
  };
  ui.onChoose = (i) => {
    const said = dialogue.choices[i];
    const lines = dialogue.choose(i, state.view < 0.5);
    if (!lines.length && !dialogue.choices.length) return endTalk();
    ui.showDialogue(lines, dialogue.choices, said);
  };
  ui.onClose = endTalk;

  const interact = (h: Hotspot) => {
    if (h.go) return void travel(h.go);
    const raw = state.view < 0.5;
    if (h.talk) {
      lockedBeforeTalk = !canSwitch();
      ui.showDialogue(dialogue.start(h.talk, raw), dialogue.choices);
    } else if (h.look) ui.showCaption(pick(h.look, raw));
  };

  // pointer: hover names, click or tap to walk or to use
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || ui.dialogueOpen || travelling) return ui.showHover(null);
    const [x, y] = toLevel(e, cam), h = world.hotspotAt(x, y, state.view < 0.5);
    canvas.style.cursor = h ? 'pointer' : 'default';
    ui.showHover(h ? pick(h.name, state.view < 0.5) : null, e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => ui.showHover(null));
  canvas.addEventListener('pointerdown', (e) => {
    if (ui.dialogueOpen || travelling) return;
    const [x, y] = toLevel(e, cam), h = world.hotspotAt(x, y, state.view < 0.5);
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
    if (e.key === 'l' || e.key === 'L') return look.toggle();
    // the keys a slider or list uses itself stay with it: arrows move a look slider, not the hero; E, Q and L still work
    if (e.target instanceof Element && e.target.closest('.look') && /^(Arrow|Home|End|Page)/.test(e.key)) return;
    if (ui.key(e.key)) return e.preventDefault();
    const dir = dirOf(e.key);
    if (dir && !ui.dialogueOpen) { held.add(dir); syncKeys(); return e.preventDefault(); }
    if (e.key === 'e' || e.key === 'E') toggleView(import.meta.env.DEV);
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
  viewBtn.addEventListener('click', () => toggleView());

  const draw = () => {
    const t = clock(), dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    const wasMoving = world.moving;
    const arrived = ui.dialogueOpen || travelling ? null : world.update(dt);
    // the view may have changed on the way: a generated person is not there to talk to in raw view
    if (arrived && inView(arrived, state.view < 0.5)) interact(arrived);
    // walking into an end of the walk line that leads somewhere
    if (world.keyDir !== 0 && !travelling) {
      const end = world.keyDir < 0 ? scene.file.walk.x0 : scene.file.walk.x1, exit = Math.abs(world.heroX - end) < 0.5 ? exitAt(end) : undefined;
      if (exit?.go) void travel(exit.go);
    }
    // the camera follows her across a wide scene, in whole pixels so the pixel art stays crisp
    camX += (camTarget() - camX) * Math.min(1, dt * 5);
    cam[0] = Math.round(camX);
    if (wasMoving && !world.moving) persist();
    state.sinceSwitch = reduceMotion ? 10 : t - switchedAt;
    // facing left: the sprite's own left-facing frames, or its right-facing ones mirrored
    const flip = world.facing < 0 && !hasLeft(heroSprite.def), [ax, ay] = heroAnchor, w = heroSprite.def.w, bob = heroBob(), hs = worldFile.hero.smoke;
    const walkY = scene.file.walk.y, hx = Math.round(world.heroX - cam[0] - (flip ? w - ax : ax)), hy = Math.round(walkY - cam[1] - ay + bob);
    // the scene's smoke emitter follows her cigarette, or goes off screen when she has none
    const smoke: [number, number] = hs ? [world.heroX + hs[0] * world.facing, walkY + hs[1] + bob] : [-1000, -1000];
    fitCanvas(canvas);
    renderer.render(runner.frame(t, state, cam, [{ sprite: heroSprite, x: hx, y: hy, flip, frame: frameFor(heroSprite.def, world.moving, world.walked, t, world.facing) }], smoke));
    frames++;
    const now = performance.now();
    if (now - fpsAt > 500) { fps = (frames * 1000) / (now - fpsAt); frames = 0; fpsAt = now; }
    if (!stats.hidden) stats.textContent = `${renderer.quality.tier} · ${fps.toFixed(0)} fps · ${canvas.width}×${canvas.height}`;
  };

  // on the dev server: a scene saved in the scene editor comes back in at once, with her where she stands
  import.meta.hot?.on('lidless:asset', (data: { files: string[] }) => {
    const id = scene.file.id;
    if (!data.files.includes(`scenes/${id}/scene.json`) || travelling) return;
    scenes.delete(id);
    void enter(id, { x: world.heroX, facing: world.facing }).catch((err: unknown) => ui.showCaption(`The scene did not load: ${err instanceof Error ? err.message : String(err)}`));
  });

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
