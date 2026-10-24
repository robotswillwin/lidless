// A game session: the scene she is in and what is on screen, the view switch, conversations, saving, and each frame
// drawn. What it is made of has a module each: her controls (controls.ts), what she does to things (doing.ts), what she
// wears (dressing.ts), the ways between places (ways.ts), the Concierge's side of it (co.ts), what she knows and has
// done (progress.ts), how she turns (pose.ts), and how the story's commands are done (stage.ts).

import type { Sprite } from '../engine/assets';
import type { LookSet } from '../engine/look';
import { fitCanvas, NW, type Renderer } from '../engine/renderer';
import { createLookPanel, type LookPanel } from '../look-panel';
import { verbsIn } from './actions';
import { frameFor } from './anim';
import { Camera, cameraTarget } from './camera';
import { CO } from './co';
import { holds } from './conditions';
import { Controls } from './controls';
import { Dialogue, type Line } from './dialogue';
import { direct, type Stage } from './direct';
import { Doing } from './doing';
import { Dressing } from './dressing';
import { heroDrawing } from './hero';
import { Hud, type CloseupDef, type Item, type Notebook } from './hud';
import { inView, pick, placeIn, type Hotspot } from './level';
import { Lift } from './lift';
import { mapNow, onMap, type MapNow, type MapScene } from './map';
import type { MessagesFile } from './messages';
import { outfitAfter } from './outfits';
import { Turns } from './pose';
import { Progress } from './progress';
import type { Replies } from './replies';
import { listSaves, loadSave, writeSave, type SaveData, type Slot } from './save';
import { SceneRunner, type ViewState } from './scene';
import type { Scene, WorldFile } from './scenefile';
import { Scenes } from './scenes';
import type { Machine } from './shell';
import { storyStage } from './stage';
import { Talk } from './talk';
import { openTerminal } from './terminal';
import { reloadIntoGame } from './title';
import { UI } from './ui';
import { Ways } from './ways';
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
  notebook: Notebook;
  /** Her journal, on her device (see journal.ts): the same shape as the notebook. */
  journal: Notebook;
  /** The standard replies to a verb a thing has nothing of its own for (replies.ts). */
  replies?: Replies;
  /** Her messages through CO-net, in the Concierge's card (messages.ts). */
  messages?: MessagesFile;
  /** The close-ups' own settings: a paper's words (closeups.json). */
  closeups?: Record<string, CloseupDef>;
  save: SaveData | null;
  /** Players who asked for less motion: no camera drift, no switch glitch, no fade. */
  reduceMotion: boolean;
  /** For the checks: a story's pauses (`wait`) cut short, so a playthrough runs quickly. */
  fast?: boolean;
  /** For tests: a clock held at this time, in seconds; a camera held at this x. */
  fixedT?: number | null;
  fixedCam?: number | null;
  /** Raw view from the start and always switchable, to look at it while building the game. */
  rawView?: boolean;
  /** The scenes in this variant, whatever the story says: to look at one while building the game. */
  variant?: string | null;
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
  /** Conversations, Monkey Island style: lines over the speakers' heads, her answers along the bottom. */
  readonly talk: Talk;
  readonly hud: Hud;
  readonly look: LookPanel;
  /** The title screen is up: the keyboard leaves the game alone. */
  inputLocked = false;
  /** The scene on screen as it plays: its movers, its lights (scene.ts). */
  runner!: SceneRunner;
  /** The scenes near her, on the GPU or fetched ahead (see scenes.ts); `bust` makes changed art load again. */
  readonly scenes: Scenes;
  bust = '';
  /** Who she is talking to: their lines go over their head. */
  partner: Hotspot | null = null;
  /** A story's line is having the game do something (walk, change): she moves though a conversation is open. */
  directing = false;

  readonly progress: Progress;
  readonly co: CO;
  readonly controls: Controls;
  readonly doing: Doing;
  readonly dressing: Dressing;
  readonly ways: Ways;
  readonly turns = new Turns();
  /** The tower's lift, which the neighbours ride too: its displays show where it is. */
  readonly lift = new Lift();
  /** How the story's commands are done here. */
  readonly stage: Stage;

  private readonly camera = new Camera();
  private readonly t0 = performance.now();
  private lastT = 0;
  private switchedAt = -10;
  private lockedBeforeTalk = false;
  /** A choice that is not a conversation's, such as what to wear: picking an answer goes here. */
  private picker: ((i: number) => void) | null = null;
  /** The variant the scene on screen is shown in. */
  private variant: string | undefined;
  /** A mover she has gone up to (a guard on its round), stopped for her until she is done with it. */
  private heldMover: string | null = null;

  private constructor(readonly setup: GameSetup) {
    const s = setup;
    this.scenes = new Scenes(s.renderer.gl, s.assets, s.world);
    this.dialogue = new Dialogue(s.save?.ink ?? null);
    this.ui = new UI(s.stage);
    this.hud = new Hud(s.canvas);
    this.hud.assets = s.assets;
    this.hud.closeups = s.closeups ?? {};
    this.progress = new Progress(s.save);
    this.co = new CO(this);
    this.controls = new Controls(this);
    this.doing = new Doing(this);
    this.dressing = new Dressing(this);
    this.ways = new Ways(this);
    this.stage = storyStage(this);
    // her paper notebook, where the world has her carry it: once her morning has begun (a game from before the opening
    // has its notebook already)
    this.hud.hasNotebook = () => !s.world.notebook || this.dialogue.carries(s.world.notebook) || !this.dialogue.read('intro_morning_started');
    this.doing.syncThings();
    this.hud.setNotebook(s.notebook);
    this.hud.known = (cond) => this.dialogue.test(cond);
    this.dialogue.set('arrivals', this.progress.arrived);
    this.state = { view: s.rawView ? 0 : s.save && this.canSwitch() ? s.save.view : 1, sinceSwitch: 10 };
    // the look panel (L): from the game's saved look, with each scene's own settings over it; split settings follow the view
    this.look = createLookPanel(s.renderer, s.projectLook, s.stage, {
      view: () => (this.state.view < 0.5 ? 'raw' : 'concierge'),
      // a scene's own look, just saved into its file: the copy loaded here follows
      onSceneSaved: (id, json, variant) => {
        void this.scenes.file(id).then((file) => {
          const t = variant ? ((file.variants ??= {})[variant] ??= {}) : file;
          if (json) t.look = json; else delete t.look;
        });
      },
    });
    this.lastT = this.clock();
    this.talk = new Talk(this.hud.root, (speaker) => this.speakerAt(speaker));
    // her answer, said over her head, and what comes of it
    this.talk.onChoose = (i) => {
      if (this.picker) {
        const picked = this.picker;
        this.picker = null;
        this.talk.hide();
        return picked(i);
      }
      const said = this.dialogue.choices[i], lines = this.dialogue.choose(i, this.raw);
      this.talk.show(lines, this.dialogue.choices, said);
    };
    this.talk.onEnd = () => this.endTalk();
    // what a story's line has the game do before it is said: the conversation waits for it
    this.talk.run = (commands) => direct(commands, this.stage);
    this.hud.onVerb = (v) => this.controls.setVerb(v);
    this.hud.onHold = (id) => this.controls.hold(id);
    this.hud.saves = () => listSaves();
    this.hud.onSave = (slot) => this.saveTo(slot);
    this.hud.onLoad = (slot) => this.loadFrom(slot);
    this.hud.onView = () => this.toggleView();
    this.hud.mapNow = () => this.mapNow();
    this.hud.onTravel = (t) => void this.ways.jump(t);
    this.hud.onWay = (id) => this.ways.take(id);
    this.hud.onBack = () => this.ways.back();
    this.hud.onPanel = () => this.ui.hideCaption();
    // her notebook, where it can see her: she keeps it shut
    this.hud.onShut = () => this.say('Not here. It can see.');
    this.hud.read = () => this.progress.notesRead;
    this.hud.onRead = (keys) => {
      const fresh = keys.filter((k) => !this.progress.notesRead.has(k));
      for (const k of fresh) this.progress.notesRead.add(k);
      if (fresh.length) this.persist();
    };
    this.hud.setJournal(s.journal);
    // the Concierge: its presence opens its card; talking to it there, asking it about something, calling it
    const card = this.hud.concierge;
    card.onTap = () => this.co.ring();
    card.onTalk = () => this.co.talk();
    card.onAsk = () => this.controls.setVerb('ask');
    card.onCall = () => this.co.call();
    card.onRead = (id) => this.co.read(id);
    card.onChoose = (i) => {
      const said = this.dialogue.choices[i], lines = this.dialogue.choose(i, this.raw);
      card.converse(lines, this.dialogue.choices, said);
    };
    card.onEnd = () => this.endTalk();
    card.run = (commands) => direct(commands, this.stage);
  }

  /** A session, in the scene the address asks for, or the saved one, or where the world starts. */
  static async start(s: GameSetup, asked?: { scene: string; spawn?: string }): Promise<Game> {
    const g = new Game(s), save = s.save, w = s.world;
    const startId = asked?.scene ?? (save?.scene && w.scenes.includes(save.scene) ? save.scene : w.start.scene);
    if (asked) await g.enter(startId, { spawn: asked.spawn ?? Object.keys((await g.scenes.file(startId)).spawns)[0] });
    else if (save?.scene === startId) await g.enter(startId, { x: save.heroX, facing: save.facing });
    else await g.enter(startId, { spawn: w.start.spawn });
    // the projection she had on, put back on (its sprite loaded); if it cannot be, she is in her clothes
    if (g.dressing.projection) await g.dressing.project(g.dressing.projection).catch(() => g.dressing.project(null));
    g.syncView();
    g.hud.setAttention(g.co.attention);
    return g;
  }

  get raw(): boolean {
    return this.state.view < 0.5;
  }

  /** Seconds since the session started, or the held time. */
  clock(): number {
    return this.setup.fixedT ?? (performance.now() - this.t0) / 1000;
  }

  /** After the tab was hidden: the next frame does not catch up on the time away. */
  resume(): void {
    this.lastT = this.clock();
  }

  /** Less motion, or full: the settings' Motion, as it changes. */
  setMotion(reduced: boolean): void {
    this.setup.reduceMotion = reduced;
  }

  /* ---------- scenes ---------- */

  /**
   * Into a scene (or a close-up of one), arriving at one of its places or at x: what she wears for it, where she is for
   * the story, its things as the story has them, the camera on her, the scenes near it fetched, its look.
   */
  async enter(id: string, at: Arrival): Promise<void> {
    const next = await this.scenes.get(id), sp = at.spawn ? next.file.spawns[at.spawn] : undefined, from = this.scene?.file.id;
    // at home's door she changes: out of her coat coming in, into it going out; not going up close to her desk, or back
    const outfits = this.setup.world.hero.outfits, close = !!next.file.closeup || !!this.scene?.file.closeup;
    if (outfits && !close) await this.dressing.wear(outfitAfter(outfits, this.dressing.outfit, !!this.scene?.file.wardrobe, !!next.file.wardrobe) ?? this.dressing.outfit);
    this.scene = next;
    // where she is, for the story (a lift offers every floor but this one): in a close-up, the place it is of
    this.dialogue.set('scene_now', next.file.closeup ?? next.file.id);
    this.ways.entered(next.file);
    this.hud.setBack(!!next.file.closeup);
    this.runner = new SceneRunner(next.loaded);
    this.heldMover = null;
    this.dressing.fit(next);
    this.world = new World(next.level, at.x ?? sp?.x, at.facing ?? sp?.facing);
    this.world.raw = this.raw;
    // what is there depends on the story: a thing only while a condition holds, a thing she took gone for good
    this.world.shown = this.there;
    if (!next.file.closeup) this.progress.been.add(id);
    // the scene's own things by the story, the city's conditions by the address when it asks for a variant (?variant=)
    this.runner.shown = (when) => holds(when, (n) => (n === 'conditions' && this.setup.variant ? this.setup.variant : this.dialogue.read(n)));
    this.runner.read = (name) => this.dialogue.read(name);
    this.runner.daySeconds = (t) => this.co.secondOfDay(t);
    // the tower's lift: here, if she came by it
    if (at.spawn === 'lift' && next.file.floor !== undefined) this.lift.reset(next.file.floor, this.clock());
    this.runner.lift = (t) => this.lift.now(t);
    this.camera.jump(this.cameraTarget());
    this.cam[0] = this.setup.fixedCam ?? this.camera.x;
    // the scene she left and this one stay on the GPU, where she can go next is fetched, the rest let go
    this.scenes.settle(next, from);
    // each scene shows the game's look with its own settings over it, in the conditions the story has the city in
    this.variant = this.variantOf(next);
    this.look.setScene(next.file, this.variant);
  }

  /** Whether a hotspot is there now: only while its condition holds, and a thing she took is gone for good. */
  private readonly there = (h: Hotspot): boolean => this.dialogue.test(h.when) && !(h.item && this.dialogue.took(h.item));

  /** The variant of a scene for the city's conditions now: the story's, or the address's; none if it has none for them. */
  private variantOf(scene: Scene): string | undefined {
    const want = this.setup.variant ?? String(this.dialogue.story.variablesState['conditions'] ?? '');
    return want && scene.file.variants?.[want] ? want : undefined;
  }

  private cameraTarget(): number {
    return cameraTarget(this.scene.file, this.world.heroX, this.setup.reduceMotion);
  }

  /** The map as she knows it: every place on it whose file there is, what she has been to and seen, where she is. */
  private async mapNow(): Promise<MapNow> {
    const layout = this.setup.world.map ?? { places: {} }, ids = Object.keys(layout.places).filter((id) => this.setup.world.scenes.includes(id));
    const files = await Promise.all(ids.map((id) => this.scenes.file(id).catch(() => null)));
    const scenes: Record<string, MapScene> = {};
    ids.forEach((id, i) => { const f = files[i]; if (f) scenes[id] = f; });
    const here = this.ways.here();
    return mapNow(layout, scenes, this.progress.been, (sc, id) => this.progress.hasSeen(sc, id), { scene: here.scene, x: here.x }, this.raw, this.there);
  }

  /** What is on screen now of what goes on the map (ways out, people): seen, for the map. */
  private noticeSpots(): void {
    const f = this.scene.file, seen = this.progress.seenIn(f.id);
    for (const h of f.hotspots) {
      if (seen.has(h.id) || !onMap(h) || !inView(h, this.raw) || !this.there(h)) continue;
      const [x, , w] = placeIn(h, this.raw).rect, sx = x - this.cam[0] * (h.parallax ?? 1);
      if (sx + w > 0 && sx < NW) seen.add(h.id);
    }
  }

  /**
   * Art or a scene file changed on the dev server: every scene loads again on its next visit, and the one on screen at
   * once, with her where she stands, if the change is its own (its file, or art it uses).
   */
  assetsChanged(files: string[]): void {
    this.bust = String(Date.now());
    this.scenes.reset(this.bust, this.scene);
    const f = this.scene.file, own = files.some((p) => p === `scenes/${f.id}/scene.json` || f.layers.some((l) => p.startsWith(`${l.asset}/`)));
    if (!own || this.ways.travelling) return;
    void this.enter(f.id, { x: this.world.heroX, facing: this.world.facing }).catch((err: unknown) => this.ui.showCaption(`The scene did not load: ${err instanceof Error ? err.message : String(err)}`));
  }

  /** A thing's place on screen, in the HUD's pixels, where its layer has moved to with the camera. */
  boxOf(h: Hotspot): [number, number, number, number] {
    const c = this.setup.canvas.getBoundingClientRect(), hud = this.hud.root.getBoundingClientRect(), k = c.width / NW;
    const [x, y, w, hh] = placeIn(h, this.raw).rect;
    return [(x - this.cam[0] * (h.parallax ?? 1)) * k + c.left - hud.left, (y - this.cam[1]) * k + c.top - hud.top, w * k, hh * k];
  }

  /** A mover she goes up to (a guard on its round) stops for her, turned to her, until she is done with it. */
  holdMover(id: string, side: 1 | -1): void {
    this.letMoverGo();
    this.runner.hold(id, this.clock(), side);
    this.heldMover = id;
  }

  /** A mover she went up to goes on again from where it stopped. */
  letMoverGo(): void {
    if (this.heldMover) this.runner.release(this.heldMover, this.clock());
    this.heldMover = null;
  }

  /* ---------- the view switch ---------- */

  canSwitch(): boolean {
    return this.dialogue.hasRaw || !!this.setup.rawView;
  }

  private syncView(): void {
    this.hud.setView(this.raw, this.canSwitch());
  }

  /**
   * Raw view and back. On the dev server E switches view from the start (`force`), to look at both views while building
   * the game; the button and every built version keep the story's lock until the fixer has switched raw view on.
   */
  toggleView(force = false): void {
    if (!this.canSwitch() && !force) return;
    this.state.view = this.state.view > 0.5 ? 0 : 1;
    this.world.raw = this.raw;
    this.switchedAt = this.clock();
    this.look.refresh();
    // a projection shows in one view only: her gaits are the ones of the sprite now on screen
    if (this.dressing.wardrobe.projected) this.dressing.fit(this.scene);
    // a verb the other view does not have (the Concierge's bell) is put down
    const verb = this.controls.verb;
    if (verb && !verbsIn(this.raw).includes(verb)) this.controls.setVerb(null);
    this.syncView();
    this.hud.setVerb(this.controls.verb);
    this.persist();
  }

  /* ---------- conversations ---------- */

  /**
   * A conversation with the story's knot (or a knot's stitch) at `path`: with someone in the scene (`partner`, over whose
   * head their lines go) or no one; in the Concierge's card (`inCard`) or over the scene.
   */
  converse(partner: Hotspot | null, path: string, inCard = false): void {
    const locked = !this.canSwitch();
    this.talkOn(partner, this.dialogue.start(path, this.raw), this.dialogue.choices, inCard, locked);
  }

  /**
   * A conversation whose first lines are already started (a thing's knot, started to see whether it is one at all).
   * The conversation that unlocks the view switch, whichever it is, says how to use it as it ends (`locked`: whether the
   * switch was locked before it).
   */
  talkOn(partner: Hotspot | null, lines: Line[], choices: string[], inCard = false, locked = !this.canSwitch()): void {
    this.lockedBeforeTalk = locked;
    this.partner = partner;
    this.hud.setTalking(true);
    if (inCard) this.hud.concierge.converse(lines, choices);
    else this.talk.show(lines, choices);
  }

  /** Answers to pick from that are not a conversation's (what to wear), and a way out: the one picked is done. */
  offer(choices: { label: string; pick: () => void }[]): void {
    this.picker = (i) => choices[i]?.pick();
    this.talk.show([], [...choices.map((c) => c.label), 'Never mind']);
  }

  /** A line of hers, over her head. */
  say(text: string): void {
    this.talk.show([{ text, speaker: 'luna' }], []);
  }

  /**
   * Play begins, the title screen gone: a new game starts with the story's opening (her waking), once. A game saved
   * before, or one a test opens at a scene, does not.
   */
  begin(): void {
    if (this.progress.opened || !this.dialogue.has('opening')) return;
    this.progress.opened = true;
    this.talkOn(null, this.dialogue.start('opening', this.raw), this.dialogue.choices);
  }

  /** A conversation is over: what it changed shows (her things, the city's conditions, the view switch it unlocked). */
  endTalk(): void {
    this.partner = null;
    this.co.hangUp();
    this.letMoverGo();
    void this.hud.showCloseup(null);
    // a conversation can change the city's conditions: the rain starts, the power goes
    const v = this.variantOf(this.scene);
    if (v !== this.variant) { this.variant = v; this.look.setScene(this.scene.file, v); }
    this.hud.setTalking(false);
    this.doing.syncThings();
    // the conversation that unlocks the view switch, whichever it is, says how to use it
    const unlocked = this.lockedBeforeTalk && this.canSwitch();
    this.lockedBeforeTalk = false;
    this.syncView();
    this.persist();
    if (unlocked) {
      this.ui.showCaption('Something behind your eye is new. Touch your temple, with your things at the bottom left, or press E, to see what is really there.');
      this.switchedAt = this.clock();
    }
    // the call a line asked for, now the conversation it was in is over
    this.co.callIfAsked();
  }

  /**
   * Where a speaker's lines go: over her head; over whoever says it, when they are in the scene (a hotspot named for
   * them, or whose conversation is theirs); else over whoever she is talking to; narration at the top.
   */
  private speakerAt(speaker: string): [number, number] | null {
    // over a close-up every line is said at the top, clear of the picture; in a close-up of a place she is not drawn
    if (this.hud.closeupOpen) return null;
    if (speaker === 'luna' && this.scene.file.closeup) return null;
    if (speaker === 'luna') {
      const c = this.setup.canvas.getBoundingClientRect(), hud = this.hud.root.getBoundingClientRect(), k = c.width / NW;
      const head = this.scene.file.walk.y - this.dressing.shown.def.h * (this.scene.file.actorScale ?? 1);
      return [(this.world.heroX - this.cam[0]) * k + c.left - hud.left, (head - this.cam[1]) * k + c.top - hud.top - 6];
    }
    if (speaker === 'narration') return null;
    const own = this.scene.file.hotspots.find((h) => (h.id === speaker || h.talk === speaker) && inView(h, this.raw) && this.world.shown(h));
    const who = own ?? this.partner;
    if (!who) return null;
    const [x, y, w] = this.boxOf(who);
    return [x + w / 2, y - 6];
  }

  /**
   * An old machine's screen over the game (public/assets/terminals/<id>.json), until she switches it off. What she
   * reads there, and the users she becomes, tell the story; what is on it can wait for the story (a file's `when`).
   */
  async terminal(id: string): Promise<void> {
    const machine = await fetch(`${this.setup.assets}/terminals/${id}.json`, { cache: 'no-store' }).then((r) => (r.ok ? (r.json() as Promise<Machine>) : null)).catch(() => null);
    if (!machine) return;
    const locked = this.inputLocked;
    this.inputLocked = true;
    this.hud.closeAll();
    await openTerminal(this.setup.stage, machine, {
      test: (cond) => this.dialogue.test(cond),
      tell: (vars) => { for (const [k, v] of Object.entries(vars)) this.dialogue.set(k, v); },
    }, { fast: this.setup.fast });
    this.inputLocked = locked;
    this.persist();
  }

  /* ---------- saving ---------- */

  /** Where she is and what has happened, as a save: in a close-up, where she stood in the place. */
  private saveData(): SaveData {
    const here = this.ways.here();
    return {
      v: 2, scene: here.scene, heroX: Math.round(here.x), facing: here.facing, view: this.state.view, ink: this.dialogue.save(),
      attention: this.co.attention, outfit: this.dressing.outfit || undefined, projection: this.dressing.projection ?? undefined,
      savedAt: Date.now(), where: pick(this.scene.file.name, this.raw), ...this.progress.toSave(), clock: this.co.minute(),
    };
  }

  /** The autosave, written as she plays: never in the middle of a conversation, which saves as it ends. */
  persist(): void {
    if (this.talk.open || this.directing || this.hud.concierge.talking) return;
    writeSave(this.saveData());
  }

  /** Saving into one of her slots. */
  private saveTo(slot: Slot): void {
    if (this.talk.open || this.directing) return;
    writeSave(this.saveData(), slot);
  }

  /**
   * Going back to a save: it becomes the game in progress, which starts again from it. The address loses what would
   * override it (a new game, a scene asked for).
   */
  private loadFrom(slot: Slot): void {
    const d = loadSave(slot);
    if (!d) return;
    writeSave(d);
    reloadIntoGame();
  }

  /* ---------- each frame ---------- */

  frame(): void {
    const t = this.clock(), dt = Math.min(0.05, Math.max(0, t - this.lastT)), world = this.world, file = this.scene.file;
    this.lastT = t;
    const wasMoving = world.moving;
    this.controls.holdOn(t);
    // she moves while a conversation is open only when its story has her walk
    const arrived = (this.talk.open && !this.directing) || this.ways.travelling ? null : world.update(dt);
    // the view may have changed on the way: a generated person is not there to talk to in raw view
    if (arrived && inView(arrived, this.raw)) {
      const a = this.controls.arrivedAt(arrived);
      if (a) this.doing.act(arrived, a);
    }
    // the Concierge: its attention, its status line, its privacy sign, her messages, what it keeps of her
    this.co.frame(t, dt);
    // walking into an end of the walk line that leads somewhere: with the keys, or with a finger running her past it
    const push = this.controls.push();
    if (push !== 0 && !this.ways.travelling) {
      const end = push < 0 ? file.walk.x0 : file.walk.x1, exit = Math.abs(world.heroX - end) < 0.5 ? this.ways.exitAt(end) : undefined;
      if (exit?.go) void this.ways.go(exit.go);
    }
    this.cam[0] = this.setup.fixedCam ?? this.camera.follow(this.cameraTarget(), dt, file.size[0] > NW);
    // a hotspot that goes with a mover is where the mover is now; off the scene while it is out of sight
    for (const h of file.hotspots) if (h.follows) h.rect = this.runner.moverBoxes.get(h.follows) ?? [-1000, -1000, 0, 0];
    // what she sees goes on the map; out of its sight her notebook opens
    this.noticeSpots();
    this.hud.setUnseen(!this.co.watching);
    if (wasMoving && !world.moving) this.persist();
    this.state.sinceSwitch = this.setup.reduceMotion ? 10 : t - this.switchedAt;
    // she is drawn at the scene's scale, bobbing a little if her sprite has no walk of its own; the scene's smoke
    // emitter follows her cigarette, or goes off screen when she has none
    const hero = this.dressing.shown, sc = file.actorScale ?? 1, bob = (hero.def.anims?.walk ? 0 : world.bob) * sc, hs = this.setup.world.hero.smoke;
    const smoke: [number, number] = hs ? [world.heroX + hs[0] * sc * world.facing, file.walk.y + hs[1] * sc + bob] : [-1000, -1000];
    // turned to us or away from us (pose.ts), never mirrored: her eyepiece is on her right eye
    const turned = this.turns.frame(hero.def, t, world.moving, this.talk.open);
    const her = heroDrawing(hero, { x: world.heroX, walkY: file.walk.y, cam: this.cam, scale: sc, facing: turned === null ? world.facing : 1, bob, frame: turned ?? frameFor(hero.def, world.moving, world.phase, t, world.facing, world.gait) });
    // what a verb lights up, and what she found, stay on the thing as the camera follows her
    this.controls.remark();
    const noted = this.hud.noteFor;
    if (noted) this.hud.placeNote(this.boxOf(noted));
    this.hud.ways(this.ways.markers());
    this.talk.place();
    fitCanvas(this.setup.canvas);
    // where her head is, for a camera to follow; in a close-up she is not drawn: it is what she sees
    this.runner.lookAt = file.closeup ? null : [world.heroX, file.walk.y - hero.def.h * sc * 0.88];
    this.setup.renderer.render(this.runner.frame(t, this.state, this.cam, file.closeup ? [] : [her], file.closeup ? [-1000, -1000] : smoke));
  }
}
