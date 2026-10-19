// A game session: the scene she is in and the ways between them, what she does with things, the view switch and how
// closely the Concierge watches her, conversations, saving, and each frame drawn.

import type { Sprite } from '../engine/assets';
import type { LookSet } from '../engine/look';
import { fitCanvas, NH, NW, type Renderer } from '../engine/renderer';
import { createLookPanel, type LookPanel } from '../look-panel';
import { actionsFor, defaultOf } from './actions';
import { frameFor } from './anim';
import { Camera, cameraTarget } from './camera';
import { Dialogue } from './dialogue';
import { heroDrawing } from './hero';
import { Hud, type Action, type Item, type NotebookPages } from './hud';
import { inView, pick, type Hotspot } from './level';
import { writeSave, type SaveData } from './save';
import { SceneRunner, type ViewState } from './scene';
import { buildScene, loadSceneFile, type Exit, type Scene, type WorldFile } from './scenefile';
import { UI } from './ui';
import { World } from './world';

export interface GameSetup {
  renderer: Renderer;
  canvas: HTMLCanvasElement;
  /** Where the game's overlays go: conversations, the look panel. */
  stage: HTMLElement;
  /** Covers the screen on the way from one scene to another. */
  fade: HTMLElement;
  /** The URL of the built assets. */
  assets: string;
  world: WorldFile;
  hero: Sprite;
  projectLook: LookSet;
  items: Record<string, Item>;
  notebook: NotebookPages;
  save: SaveData | null;
  /** Players who asked for less motion: no camera drift, no switch glitch, no fade. */
  reduceMotion: boolean;
  /** For tests: a clock held at this time, in seconds; a camera held at this x. */
  fixedT?: number | null;
  fixedCam?: number | null;
  /** Raw view from the start and always switchable, to look at it while building the game. */
  rawView?: boolean;
}

/** Where to arrive in a scene: at one of its places, or at x facing a way. */
export interface Arrival {
  spawn?: string;
  x?: number;
  facing?: 1 | -1;
}

export class Game {
  scene!: Scene;
  world!: World;
  readonly cam: [number, number] = [0, 0];
  readonly state: ViewState;
  readonly dialogue: Dialogue;
  readonly ui: UI;
  readonly hud: Hud;
  readonly look: LookPanel;
  travelling = false;

  private runner!: SceneRunner;
  private readonly camera = new Camera();
  /** Scenes are kept once loaded, so going back and forth is quick; `bust` makes changed art load again. */
  private readonly scenes = new Map<string, Promise<Scene>>();
  private bust = '';
  private readonly t0 = performance.now();
  private lastT = 0;
  private switchedAt = -10;
  private lockedBeforeTalk = false;
  /** How closely the Concierge is watching her, 0 to 3: staring at what it hides raises it, behaving in its view lets it fall. */
  private attention: number;
  private attentionAt = 0;
  /** What she will do with a thing when she gets there. */
  private pending: Action | null = null;
  /** The walk keys held down. */
  private readonly held = new Set<'left' | 'right'>();

  private constructor(private readonly s: GameSetup) {
    this.dialogue = new Dialogue(s.save?.ink ?? null);
    this.ui = new UI(s.stage);
    this.hud = new Hud(s.canvas);
    this.hud.setThings(s.items, s.world.hero.items ?? []);
    this.hud.setNotebook(s.notebook);
    this.hud.known = (v) => Boolean(this.dialogue.story.variablesState[v]);
    this.state = { view: s.rawView ? 0 : s.save && this.canSwitch() ? s.save.view : 1, sinceSwitch: 10 };
    this.attention = s.save?.attention ?? 0;
    // the look panel (L): from the game's saved look, with each scene's own settings over it; split settings follow the view
    this.look = createLookPanel(s.renderer, s.projectLook, s.stage, {
      view: () => (this.state.view < 0.5 ? 'raw' : 'concierge'),
      // a scene's own look, just saved into its file: the copy loaded here follows
      onSceneSaved: (id, json) => { void this.scenes.get(id)?.then((sc) => { if (json) sc.file.look = json; else delete sc.file.look; }); },
    });
    this.lastT = this.clock();
    this.ui.onChoose = (i) => {
      const said = this.dialogue.choices[i], lines = this.dialogue.choose(i, this.raw);
      if (!lines.length && !this.dialogue.choices.length) return this.endTalk();
      this.ui.showDialogue(lines, this.dialogue.choices, said);
    };
    this.ui.onClose = () => this.endTalk();
    this.hud.onAction = (h, a) => this.perform(h, a);
    this.hud.onTemple = () => this.toggleView();
    this.hud.onBell = () => this.hud.toast(this.scene.file.assist ?? 'Is there anything I can do for you, guest?');
    this.hud.onPanel = () => this.ui.hideCaption();
    this.hud.onDispose = (_id, dispose) => this.hud.toast(dispose ? 'Of course, guest. I will collect it at your convenience.' : 'As you wish, guest.');
  }

  /** A session, in the scene the address asks for, or the saved one, or where the world starts. */
  static async start(s: GameSetup, asked?: { scene: string; spawn?: string }): Promise<Game> {
    const g = new Game(s), save = s.save, w = s.world;
    const startId = asked?.scene ?? (save?.scene && w.scenes.includes(save.scene) ? save.scene : w.start.scene);
    if (asked) await g.enter(startId, { spawn: asked.spawn ?? Object.keys((await g.sceneById(startId)).file.spawns)[0] });
    else if (save?.scene === startId) await g.enter(startId, { x: save.heroX, facing: save.facing });
    else await g.enter(startId, { spawn: w.start.spawn });
    g.syncView();
    g.hud.setAttention(g.attention);
    return g;
  }

  get raw(): boolean {
    return this.state.view < 0.5;
  }

  /** Seconds since the session started, or the held time. */
  clock(): number {
    return this.s.fixedT ?? (performance.now() - this.t0) / 1000;
  }

  /** After the tab was hidden: the next frame does not catch up on the time away. */
  resume(): void {
    this.lastT = this.clock();
  }

  /* ---------- scenes ---------- */

  private sceneById(id: string): Promise<Scene> {
    if (!this.scenes.has(id)) this.scenes.set(id, loadSceneFile(this.s.assets, id).then((file) => buildScene(this.s.renderer.gl, this.s.assets, file, this.s.world, this.bust)));
    return this.scenes.get(id)!;
  }

  private async enter(id: string, at: Arrival): Promise<void> {
    const next = await this.sceneById(id), sp = at.spawn ? next.file.spawns[at.spawn] : undefined;
    this.scene = next;
    this.runner = new SceneRunner(next.loaded);
    // her pace follows her stride at her size here, so each foot stays where it lands
    const walk = this.s.hero.def.anims?.walk, cadence = this.s.world.hero.cadence;
    if (cadence && walk?.stride) next.level.hero.speed = cadence * walk.stride * (next.file.actorScale ?? 1);
    this.world = new World(next.level, at.x ?? sp?.x, at.facing ?? sp?.facing);
    this.camera.jump(this.cameraTarget());
    this.cam[0] = this.s.fixedCam ?? this.camera.x;
    // each scene shows the game's look with its own settings over it
    this.look.setScene(next.file);
  }

  private cameraTarget(): number {
    return cameraTarget(this.scene.file, this.world.heroX, this.s.reduceMotion);
  }

  /** A door or the end of the street: fade out, go to the other scene, fade in. */
  private async travel(exit: Exit): Promise<void> {
    if (this.travelling) return;
    this.travelling = true;
    this.world.stop();
    this.releaseKeys();
    this.hud.closeAll();
    // what she was looking at stays behind
    this.ui.hideCaption();
    this.s.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, this.s.reduceMotion ? 0 : 260));
    try {
      await this.enter(exit.scene, { spawn: exit.spawn });
      this.syncKeys();
      this.persist();
    } catch (err) {
      this.ui.showCaption(`That way is not built yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    this.s.fade.classList.remove('on');
    this.travelling = false;
  }

  /** An exit at an end of the walk line, which walking into with the keyboard takes. */
  private exitAt(x: number): Hotspot | undefined {
    return this.scene.file.hotspots.find((h) => h.go && inView(h, this.raw) && x >= h.rect[0] - 1 && x <= h.rect[0] + h.rect[2] + 1);
  }

  /**
   * Art or a scene file changed on the dev server: every scene loads again on its next visit, and the one on screen at
   * once, with her where she stands, if the change is its own (its file, or art it uses).
   */
  assetsChanged(files: string[]): void {
    this.bust = String(Date.now());
    this.scenes.clear();
    const f = this.scene.file, own = files.some((p) => p === `scenes/${f.id}/scene.json` || f.layers.some((l) => p.startsWith(`${l.asset}/`)));
    if (!own || this.travelling) return;
    void this.enter(f.id, { x: this.world.heroX, facing: this.world.facing }).catch((err: unknown) => this.ui.showCaption(`The scene did not load: ${err instanceof Error ? err.message : String(err)}`));
  }

  /* ---------- the view switch and the Concierge's attention ---------- */

  canSwitch(): boolean {
    return this.dialogue.hasRaw || !!this.s.rawView;
  }

  private syncView(): void {
    this.hud.setView(this.raw, this.canSwitch());
  }

  private raiseAttention(n: number): void {
    this.attention = Math.min(3, this.attention + n);
    this.attentionAt = this.clock();
    this.hud.setAttention(this.attention);
    this.persist();
  }

  /**
   * Raw view and back. On the dev server E switches view from the start (`force`), to look at both views while building
   * the game; the button and every built version keep the story's lock until the fixer has opened her eye.
   */
  toggleView(force = false): void {
    if (!this.canSwitch() && !force) return;
    this.state.view = this.state.view > 0.5 ? 0 : 1;
    this.switchedAt = this.clock();
    this.look.refresh();
    this.syncView();
    this.persist();
    // back in its view after staring too long: it noticed, and it is concerned
    if (this.state.view > 0.5 && this.attention >= 3) this.hud.toast('You seem distracted this evening, guest. Shall I schedule some rest for you?', [{ label: 'Yes, please', primary: true }, { label: 'No, thank you' }]);
  }

  /* ---------- conversations and doing things ---------- */

  private endTalk(): void {
    this.ui.closeDialogue();
    this.hud.setTalking(false);
    // the conversation that unlocks the view switch, whichever it is, says how to use it
    const unlocked = this.lockedBeforeTalk && this.canSwitch();
    this.lockedBeforeTalk = false;
    this.syncView();
    this.persist();
    if (unlocked) {
      this.ui.showCaption('Something behind your eye is new. Press E, or the button, to see what is really there.');
      this.switchedAt = this.clock();
    }
  }

  private act(h: Hotspot, a: Action): void {
    const raw = this.raw;
    if (a.kind === 'feet' && h.go) return void this.travel(h.go);
    if (a.kind === 'heart' && h.talk) {
      this.lockedBeforeTalk = !this.canSwitch();
      this.hud.setTalking(true);
      this.ui.showDialogue(this.dialogue.start(h.talk, raw), this.dialogue.choices);
    } else if (a.kind === 'eyes' && h.look) {
      this.ui.showCaption(pick(h.look, raw));
      if (a.cost) this.raiseAttention(a.cost);
    } else if (a.kind === 'ask' && h.ask) this.hud.toast(h.ask);
  }

  /** Looking and asking happen from where she stands, turned towards it; going and talking walk her there first. */
  private perform(h: Hotspot, a: Action): void {
    this.hud.closeRing();
    if (a.kind === 'eyes' || a.kind === 'ask' || h.stand === undefined) {
      if (!this.world.moving) this.world.facing = h.rect[0] + h.rect[2] / 2 >= this.world.heroX ? 1 : -1;
      return this.act(h, a);
    }
    this.pending = a;
    this.world.walkTo(h.stand, h);
  }

  /* ---------- input: the pointer in level pixels, the walk keys ---------- */

  /** The point under the pointer, in level pixels: the screen's position in the scene. */
  toLevel(clientX: number, clientY: number): [number, number] {
    const r = this.s.canvas.getBoundingClientRect();
    return [((clientX - r.left) / r.width) * NW + this.cam[0], ((clientY - r.top) / r.height) * NH + this.cam[1]];
  }

  /** The pointer moved: the name of what is under it. */
  hover(clientX: number, clientY: number, mouse: boolean): void {
    if (!mouse || this.ui.dialogueOpen || this.travelling) return this.hud.showHover(null);
    const [x, y] = this.toLevel(clientX, clientY), h = this.world.hotspotAt(x, y, this.raw, this.cam[0]);
    this.s.canvas.style.cursor = h ? 'pointer' : 'default';
    this.hud.showHover(h, clientX, clientY);
  }

  /**
   * A click or tap: on a thing with one use it does it, on a thing with several it fans them out, and a second click on
   * the same thing (or a double-click) does the default. Right-click looks. On the ground, she walks there.
   */
  press(clientX: number, clientY: number, button: number): void {
    if (this.ui.dialogueOpen || this.travelling) return;
    if (this.hud.panelOpen) return this.hud.closePanel();
    const raw = this.raw, [x, y] = this.toLevel(clientX, clientY), h = this.world.hotspotAt(x, y, raw, this.cam[0]), again = h !== null && this.hud.ringFor === h;
    this.hud.closeRing();
    if (!h) return this.world.walkTo(x);
    const actions = actionsFor(h, raw);
    if (!actions.length) return;
    if (button === 2) { const eyes = actions.find((a) => a.kind === 'eyes'); if (eyes) this.perform(h, eyes); return; }
    if (actions.length === 1 || again) return this.perform(h, again ? defaultOf(actions) : actions[0]);
    this.hud.openRing(h, actions, defaultOf(actions).kind, clientX, clientY);
  }

  walkKey(dir: 'left' | 'right', down: boolean): void {
    if (down) this.held.add(dir);
    else this.held.delete(dir);
    this.syncKeys();
    if (!down && !this.world.keyDir) this.persist();
  }

  releaseKeys(): void {
    this.held.clear();
    this.syncKeys();
  }

  private syncKeys(): void {
    this.world.keyDir = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
  }

  /* ---------- saving ---------- */

  persist(): void {
    writeSave({ v: 1, scene: this.scene.file.id, heroX: Math.round(this.world.heroX), facing: this.world.facing, view: this.state.view, ink: this.dialogue.save(), attention: this.attention });
  }

  /* ---------- each frame ---------- */

  frame(): void {
    const t = this.clock(), dt = Math.min(0.05, Math.max(0, t - this.lastT)), world = this.world, file = this.scene.file;
    this.lastT = t;
    const wasMoving = world.moving;
    const arrived = this.ui.dialogueOpen || this.travelling ? null : world.update(dt);
    // the view may have changed on the way: a generated person is not there to talk to in raw view
    if (arrived && inView(arrived, this.raw)) {
      const actions = actionsFor(arrived, this.raw), a = actions.find((x) => x.kind === this.pending?.kind) ?? defaultOf(actions);
      this.pending = null;
      if (a) this.act(arrived, a);
    }
    // in its view, with nothing to stare at, its attention slowly settles
    if (this.attention > 0 && !this.raw && t - this.attentionAt > 30) { this.attention--; this.attentionAt = t; this.hud.setAttention(this.attention); }
    // its greeting and its line of the day: the evening goes on, and it never says it is raining
    const minute = 21 * 60 + 40 + Math.floor(t / 60), hh = Math.floor(minute / 60) % 24, mm = minute % 60;
    this.hud.setStatus(file.greeting ?? 'Good evening, guest.', `Friday · Year 64 of Care · ${hh}:${String(mm).padStart(2, '0')} · ${file.kind === 'interior' ? 'Indoors, 21°' : '14°, umbrella advised'}`);
    // walking into an end of the walk line that leads somewhere
    if (world.keyDir !== 0 && !this.travelling) {
      const end = world.keyDir < 0 ? file.walk.x0 : file.walk.x1, exit = Math.abs(world.heroX - end) < 0.5 ? this.exitAt(end) : undefined;
      if (exit?.go) void this.travel(exit.go);
    }
    this.cam[0] = this.s.fixedCam ?? this.camera.follow(this.cameraTarget(), dt, file.size[0] > NW);
    if (wasMoving && !world.moving) this.persist();
    this.state.sinceSwitch = this.s.reduceMotion ? 10 : t - this.switchedAt;
    // she is drawn at the scene's scale, bobbing a little if her sprite has no walk of its own; the scene's smoke
    // emitter follows her cigarette, or goes off screen when she has none
    const hero = this.s.hero, sc = file.actorScale ?? 1, bob = (hero.def.anims?.walk ? 0 : world.bob) * sc, hs = this.s.world.hero.smoke;
    const smoke: [number, number] = hs ? [world.heroX + hs[0] * sc * world.facing, file.walk.y + hs[1] * sc + bob] : [-1000, -1000];
    const her = heroDrawing(hero, { x: world.heroX, walkY: file.walk.y, cam: this.cam, scale: sc, facing: world.facing, bob, frame: frameFor(hero.def, world.moving, world.walked / sc, t, world.facing) });
    fitCanvas(this.s.canvas);
    this.s.renderer.render(this.runner.frame(t, this.state, this.cam, [her], smoke));
  }
}
