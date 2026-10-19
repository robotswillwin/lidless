// Lidless: boot, scenes and the ways between them, input, the frame loop, conversations, the view switch and saving.

import './style.css';
import { loadSprite, spriteDefaults } from './engine/assets';
import { loadProjectLook } from './engine/look';
import { fitCanvas, NH, NW, QUALITY, Renderer, type Tier } from './engine/renderer';
import { frameFor, hasLeft } from './game/anim';
import { Dialogue } from './game/dialogue';
import { Hud, type Action, type Item, type NotebookPages } from './game/hud';
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
  const optional = <T>(file: string, fallback: T) => fetch(`${assets}/${file}`, { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<T>) : fallback)).catch(() => fallback);
  const [worldFile, projectLook, items, notebook] = await Promise.all([
    loadWorld(assets), loadProjectLook(assets), optional<Record<string, Item>>('items.json', {}), optional<NotebookPages>('notebook.json', {}),
  ]);
  const save = loadSave();
  const heroPath = worldFile.hero.sprite, cut = heroPath.lastIndexOf('/');
  const heroSprite = await loadSprite(gl, `${assets}/${heroPath.slice(0, cut)}`, heroPath.slice(cut + 1), spriteDefaults(gl));
  const heroAnchor = heroSprite.def.anchor ?? [heroSprite.def.w / 2, heroSprite.def.h];
  const heroBob = () => (heroSprite.def.anims?.walk ? 0 : world.bob);

  // scenes are kept once loaded, so going back and forth is quick; on the dev server a change empties the cache, and
  // bust makes the art load again instead of coming from the browser's own cache
  const scenes = new Map<string, Promise<Scene>>();
  let bust = '';
  const sceneById = (id: string) => {
    if (!scenes.has(id)) scenes.set(id, loadSceneFile(assets, id).then((file) => buildScene(gl, assets, file, worldFile, bust)));
    return scenes.get(id)!;
  };
  // set by enter(), which runs before anything reads them
  let scene!: Scene, runner: SceneRunner, world: World;
  const cam: [number, number] = [0, 0];
  let camX = 0;
  // for tests: the camera held where the address says, in level pixels from the scene's start (?cam=12.25)
  const fixedCam = params.has('cam') ? Number(params.get('cam')) : null;
  /**
   * Where the camera wants to be. Across a scene wider than the screen: her in the middle, the scene's ends never past
   * the screen's. In one no wider: a little way toward her, the scene's drift at the ends of the walk line and none in
   * the middle (none at all for players who asked for less motion); each layer then moves at its own parallax.
   */
  const camTarget = () => {
    const f = scene.file;
    if (f.size[0] > NW) return Math.max(0, Math.min(f.size[0] - NW, world.heroX - NW / 2));
    const drift = reduceMotion ? 0 : f.drift ?? 0, { x0, x1 } = f.walk;
    return drift && x1 > x0 ? drift * Math.max(-1, Math.min(1, (world.heroX - (x0 + x1) / 2) / ((x1 - x0) / 2))) : 0;
  };
  const enter = async (id: string, at: { spawn?: string; x?: number; facing?: 1 | -1 }) => {
    const next = await sceneById(id), sp = at.spawn ? next.file.spawns[at.spawn] : undefined;
    scene = next;
    runner = new SceneRunner(next.loaded);
    // her pace follows her stride at her size here, so each foot stays where it lands
    const walk = heroSprite.def.anims?.walk;
    if (worldFile.hero.cadence && walk?.stride) next.level.hero.speed = worldFile.hero.cadence * walk.stride * (next.file.actorScale ?? 1);
    world = new World(next.level, at.x ?? sp?.x, at.facing ?? sp?.facing);
    camX = camTarget();
    cam[0] = fixedCam ?? camX;
  };
  // the scene to start in: asked for in the address, or the saved one, or where the world starts
  const askedScene = params.get('scene');
  const startId = askedScene ?? (save?.scene && worldFile.scenes.includes(save.scene) ? save.scene : worldFile.start.scene);
  if (askedScene) await enter(startId, { spawn: params.get('spawn') ?? Object.keys((await sceneById(startId)).file.spawns)[0] });
  else if (save?.scene === startId) await enter(startId, { x: save.heroX, facing: save.facing });
  else await enter(startId, { spawn: worldFile.start.spawn });

  const dialogue = new Dialogue(save?.ink ?? null);
  const ui = new UI(stage);
  const hud = new Hud(canvas);
  hud.setThings(items, worldFile.hero.items ?? []);
  hud.setNotebook(notebook);
  hud.known = (v) => Boolean(dialogue.story.variablesState[v]);
  const debugView = params.get('view') === 'raw';
  const canSwitch = () => dialogue.hasRaw || debugView;
  const state: ViewState = { view: debugView ? 0 : save && canSwitch() ? save.view : 1, sinceSwitch: 10 };
  // the look panel (L): pixels, light, characters, colour and film, from the game's saved look; split settings follow the view
  const look = createLookPanel(renderer, projectLook, stage, {
    view: () => (state.view < 0.5 ? 'raw' : 'concierge'),
    // a scene's own look, just saved into its file: the copy loaded here follows
    onSceneSaved: (id, json) => { void scenes.get(id)?.then((s) => { if (json) s.file.look = json; else delete s.file.look; }); },
  });
  // each scene shows the game's look with its own settings over it
  look.setScene(scene.file);
  const t0 = performance.now(), fixedT = params.has('t') ? Number(params.get('t')) : null;
  const clock = () => fixedT ?? (performance.now() - t0) / 1000;
  let switchedAt = -10, lastT = clock(), frames = 0, fpsAt = performance.now(), fps = 0, lockedBeforeTalk = false;
  // how closely the Concierge is watching her, 0 to 3: staring at what it hides raises it, behaving in its view lets it fall
  let attention = save?.attention ?? 0, attentionAt = 0;

  const persist = () => writeSave({ v: 1, scene: scene.file.id, heroX: Math.round(world.heroX), facing: world.facing, view: state.view, ink: dialogue.save(), attention });

  // a door or the end of the street: fade out, go to the other scene, fade in
  let travelling = false;
  const travel = async (exit: Exit) => {
    if (travelling) return;
    travelling = true;
    world.stop();
    held.clear();
    hud.closeAll();
    // what she was looking at stays behind
    ui.hideCaption();
    fade.classList.add('on');
    await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 260));
    try {
      await enter(exit.scene, { spawn: exit.spawn });
      look.setScene(scene.file);
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

  const syncView = () => hud.setView(state.view < 0.5, canSwitch());
  const raiseAttention = (n: number) => {
    attention = Math.min(3, attention + n);
    attentionAt = clock();
    hud.setAttention(attention);
    persist();
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
    // back in its view after staring too long: it noticed, and it is concerned
    if (state.view > 0.5 && attention >= 3) hud.toast('You seem distracted this evening, guest. Shall I schedule some rest for you?', [{ label: 'Yes, please', primary: true }, { label: 'No, thank you' }]);
  };

  // conversations
  const endTalk = () => {
    ui.closeDialogue();
    hud.setTalking(false);
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

  // what can be done with a thing, by Lux's properties: Feet go, Heart talks, Eyes look; in the Concierge's view its bell
  // asks it. In raw view, looking at something it shows differently is staring, and staring costs attention
  const actionsFor = (h: Hotspot, raw: boolean): Action[] => {
    const out: Action[] = [];
    if (h.go) out.push({ kind: 'feet', label: raw ? 'go' : 'Go' });
    if (h.talk) out.push({ kind: 'heart', label: raw ? 'talk' : 'Talk' });
    if (h.look) {
      const stare = raw && typeof h.look === 'object' && h.look.raw !== h.look.concierge;
      out.push({ kind: 'eyes', label: raw ? (stare ? 'look closely' : 'look') : 'Look', cost: stare ? 1 : 0 });
    }
    if (!raw && h.ask) out.push({ kind: 'ask', label: 'Ask' });
    return out;
  };
  /** What a thing is mostly for: talking to someone, going through a door, else looking. */
  const defaultOf = (actions: Action[]): Action => {
    const order = ['heart', 'feet', 'hands', 'eyes', 'ask'];
    return [...actions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
  };
  let pending: Action | null = null;
  const act = (h: Hotspot, a: Action) => {
    const raw = state.view < 0.5;
    if (a.kind === 'feet' && h.go) return void travel(h.go);
    if (a.kind === 'heart' && h.talk) {
      lockedBeforeTalk = !canSwitch();
      hud.setTalking(true);
      ui.showDialogue(dialogue.start(h.talk, raw), dialogue.choices);
    } else if (a.kind === 'eyes' && h.look) {
      ui.showCaption(pick(h.look, raw));
      if (a.cost) raiseAttention(a.cost);
    } else if (a.kind === 'ask' && h.ask) hud.toast(h.ask);
  };
  /** Looking and asking happen from where she stands, turned towards it; going and talking walk her there first. */
  const perform = (h: Hotspot, a: Action) => {
    hud.closeRing();
    if (a.kind === 'eyes' || a.kind === 'ask' || h.stand === undefined) {
      if (!world.moving) world.facing = h.rect[0] + h.rect[2] / 2 >= world.heroX ? 1 : -1;
      return act(h, a);
    }
    pending = a;
    world.walkTo(h.stand, h);
  };
  hud.onAction = perform;
  hud.onTemple = () => toggleView();
  hud.onBell = () => hud.toast(scene.file.assist ?? 'Is there anything I can do for you, guest?');
  hud.onPanel = () => ui.hideCaption();
  hud.onDispose = (_id, dispose) => hud.toast(dispose ? 'Of course, guest. I will collect it at your convenience.' : 'As you wish, guest.');

  // pointer: names under it; a click or tap on a thing with one use does it, on a thing with several fans them out, and a
  // second click on the same thing (or a double-click) does the default. Right-click looks. On the ground, she walks
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || ui.dialogueOpen || travelling) return hud.showHover(null);
    const [x, y] = toLevel(e, cam), h = world.hotspotAt(x, y, state.view < 0.5, cam[0]);
    canvas.style.cursor = h ? 'pointer' : 'default';
    hud.showHover(h, e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => hud.showHover(null));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (ui.dialogueOpen || travelling) return;
    if (hud.panelOpen) return hud.closePanel();
    const raw = state.view < 0.5, [x, y] = toLevel(e, cam), h = world.hotspotAt(x, y, raw, cam[0]), again = h !== null && hud.ringFor === h;
    hud.closeRing();
    if (!h) return world.walkTo(x);
    const actions = actionsFor(h, raw);
    if (!actions.length) return;
    if (e.button === 2) { const eyes = actions.find((a) => a.kind === 'eyes'); if (eyes) perform(h, eyes); return; }
    if (actions.length === 1 || again) return perform(h, again ? defaultOf(actions) : actions[0]);
    hud.openRing(h, actions, defaultOf(actions).kind, e.clientX, e.clientY);
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
    if (!ui.dialogueOpen && hud.key(e.key)) return e.preventDefault();
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

  const draw = () => {
    const t = clock(), dt = Math.min(0.05, Math.max(0, t - lastT));
    lastT = t;
    const wasMoving = world.moving;
    const arrived = ui.dialogueOpen || travelling ? null : world.update(dt);
    // the view may have changed on the way: a generated person is not there to talk to in raw view
    if (arrived && inView(arrived, state.view < 0.5)) {
      const actions = actionsFor(arrived, state.view < 0.5), a = actions.find((x) => x.kind === pending?.kind) ?? defaultOf(actions);
      pending = null;
      if (a) act(arrived, a);
    }
    // in its view, with nothing to stare at, its attention slowly settles
    if (attention > 0 && state.view > 0.5 && t - attentionAt > 30) { attention--; attentionAt = t; hud.setAttention(attention); }
    // its greeting and its line of the day: the evening goes on, and it never says it is raining
    const minute = 21 * 60 + 40 + Math.floor(t / 60), hh = Math.floor(minute / 60) % 24, mm = minute % 60;
    hud.setStatus(scene.file.greeting ?? 'Good evening, guest.', `Friday · Year 64 of Care · ${hh}:${String(mm).padStart(2, '0')} · ${scene.file.kind === 'interior' ? 'Indoors, 21°' : '14°, umbrella advised'}`);
    // walking into an end of the walk line that leads somewhere
    if (world.keyDir !== 0 && !travelling) {
      const end = world.keyDir < 0 ? scene.file.walk.x0 : scene.file.walk.x1, exit = Math.abs(world.heroX - end) < 0.5 ? exitAt(end) : undefined;
      if (exit?.go) void travel(exit.go);
    }
    // the camera follows her: briskly across a wide scene, gently in one that only drifts. It moves by fractions of a
    // pixel, so a slow camera glides; the renderer puts pixel art on whole pixels
    camX += (camTarget() - camX) * Math.min(1, dt * (scene.file.size[0] > NW ? 5 : 1.5));
    // and settles: an easing that never quite arrives would keep the layers creeping by fractions of a pixel
    if (Math.abs(camTarget() - camX) < 0.01) camX = camTarget();
    cam[0] = fixedCam ?? camX;
    if (wasMoving && !world.moving) persist();
    state.sinceSwitch = reduceMotion ? 10 : t - switchedAt;
    // facing left: the sprite's own left-facing frames, or its right-facing ones mirrored
    // she is drawn at the scene's scale: smaller where the camera is further back
    const sc = scene.file.actorScale ?? 1, flip = world.facing < 0 && !hasLeft(heroSprite.def), [ax, ay] = heroAnchor, w = heroSprite.def.w, bob = heroBob() * sc, hs = worldFile.hero.smoke;
    const walkY = scene.file.walk.y, hx = world.heroX - cam[0] - (flip ? w - ax : ax) * sc, hy = Math.round(walkY - cam[1] - ay * sc + bob);
    // the scene's smoke emitter follows her cigarette, or goes off screen when she has none
    const smoke: [number, number] = hs ? [world.heroX + hs[0] * sc * world.facing, walkY + hs[1] * sc + bob] : [-1000, -1000];
    fitCanvas(canvas);
    renderer.render(runner.frame(t, state, cam, [{ sprite: heroSprite, x: hx, y: hy, flip, scale: sc, frame: frameFor(heroSprite.def, world.moving, world.walked / sc, t, world.facing) }], smoke));
    frames++;
    const now = performance.now();
    if (now - fpsAt > 500) { fps = (frames * 1000) / (now - fpsAt); frames = 0; fpsAt = now; }
    if (!stats.hidden) stats.textContent = `${renderer.quality.tier} · ${fps.toFixed(0)} fps · ${canvas.width}×${canvas.height}`;
  };

  // on the dev server: when a scene file or any art changes, every scene loads again on its next visit, and the one on
  // screen at once, with her where she stands, if the change is its own (its file, or art it uses)
  import.meta.hot?.on('lidless:asset', (data: { files: string[] }) => {
    bust = String(Date.now());
    scenes.clear();
    const id = scene.file.id, own = data.files.some((f) => f === `scenes/${id}/scene.json` || scene.file.layers.some((l) => f.startsWith(`${l.asset}/`)));
    if (!own || travelling) return;
    void enter(id, { x: world.heroX, facing: world.facing }).catch((err: unknown) => ui.showCaption(`The scene did not load: ${err instanceof Error ? err.message : String(err)}`));
  });

  stats.hidden = !params.has('debug');
  syncView();
  hud.setAttention(attention);
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
