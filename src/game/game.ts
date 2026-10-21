// A game session: the scene she is in and the ways between them, what she does with things, the view switch and how
// closely the Concierge watches her, conversations, saving, and each frame drawn.

import { freeSprite, loadSprite, spriteDefaults, type Sprite } from '../engine/assets';
import type { LookSet } from '../engine/look';
import { fitCanvas, NH, NW, type Renderer } from '../engine/renderer';
import { createLookPanel, type LookPanel } from '../look-panel';
import { actionFor, actionsFor, defaultOf, itemActionFor, verbsIn, type Verb } from './actions';
import { frameFor } from './anim';
import { Camera, cameraTarget } from './camera';
import { Dialogue, STITCH } from './dialogue';
import { direct, type Stage } from './direct';
import { heroDrawing, heroGaits, holdPace, paceFor } from './hero';
import { Hud, type Action, type Item, type Mark, type Notebook } from './hud';
import { inView, pick, placeIn, type Hotspot } from './level';
import { mapNow, onMap, type MapNow, type MapScene, type Travel } from './map';
import { rotateOnArrival } from './rotate';
import { dressedFor, keepsProjection, outfitAfter } from './outfits';
import { Wardrobe } from './wardrobe';
import { listSaves, loadSave, writeSave, type SaveData, type Slot } from './save';
import { SceneRunner, type ViewState } from './scene';
import { Talk } from './talk';
import { type Scene, type WorldFile } from './scenefile';
import { Scenes } from './scenes';
import { UI } from './ui';
import { World } from './world';

/** Seconds a finger is held down before it can run her (a tap is quicker): see Game.holdOn. */
const HOLD = 0.25;

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
  save: SaveData | null;
  /** Players who asked for less motion: no camera drift, no switch glitch, no fade. */
  reduceMotion: boolean;
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
  travelling = false;

  private runner!: SceneRunner;
  private readonly camera = new Camera();
  /** Scenes are kept once loaded, so going back and forth is quick; `bust` makes changed art load again. */
  /** The scenes near her, on the GPU or fetched ahead (see scenes.ts). */
  private readonly scenes: Scenes;
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
  /** The verb chosen at the ball: what she will do to the next thing her finger lights up. */
  private verb: Verb | null = null;
  /** What it lights up under her finger now. */
  private marked: Mark | null = null;
  /** Where a finger (or the mouse button) went down on the scene, while it is down. */
  private down: [number, number] | null = null;
  /** Where that finger is now, and when it went down. */
  private finger: [number, number] | null = null;
  private downAt = 0;
  /** Held down outdoors far from her, it runs her after it until it comes up (see holdOn); chasing while it is far. */
  private holding = false;
  private chasing = false;
  /** Who she is talking to: their lines go over their head. */
  private partner: Hotspot | null = null;
  /** A thing she holds, out of her pockets, to use on the next thing her finger lights up. */
  private inHand: string | null = null;
  /** A story's line is having the game do something (walk, change): she moves though a conversation is open. */
  private directing = false;
  /** What she wears: her clothes, a projection over them, and her sprites in them (see wardrobe.ts). */
  private readonly wardrobe: Wardrobe;
  private get outfit(): string { return this.wardrobe.outfit; }
  private get projection(): string | null { return this.wardrobe.projection; }
  /** A choice that is not a conversation's, such as what to wear: picking an answer goes here. */
  private picker: ((i: number) => void) | null = null;
  /** The variant the scene on screen is shown in. */
  private variant: string | undefined;
  /** The places she has been, and what she has seen in each (its ways out, people): what the map shows (see map.ts). */
  private readonly been: Set<string>;
  private readonly seen: Map<string, Set<string>>;
  /** What she has read in her notebook: the rest is marked new. */
  private readonly notesRead: Set<string>;
  /** How many times she has gone from one scene to another, and how far each scene's rotations have turned (rotate.ts). */
  private arrived: number;
  private rotations: Record<string, number>;
  /** A mover she has gone up to (a guard on its round), stopped for her until she is done with it. */
  private heldMover: string | null = null;

  private constructor(private readonly s: GameSetup) {
    this.scenes = new Scenes(s.renderer.gl, s.assets, s.world);
    this.dialogue = new Dialogue(s.save?.ink ?? null);
    this.ui = new UI(s.stage);
    this.hud = new Hud(s.canvas);
    this.hud.assets = s.assets;
    this.syncThings();
    this.hud.setNotebook(s.notebook);
    this.hud.known = (cond) => this.dialogue.test(cond);
    this.been = new Set(s.save?.visited ?? []);
    this.seen = new Map(Object.entries(s.save?.seen ?? {}).map(([k, v]) => [k, new Set(v)]));
    this.notesRead = new Set(s.save?.read ?? []);
    this.arrived = s.save?.arrived ?? 0;
    this.rotations = { ...(s.save?.rotations ?? {}) };
    this.dialogue.set('arrivals', this.arrived);
    this.state = { view: s.rawView ? 0 : s.save && this.canSwitch() ? s.save.view : 1, sinceSwitch: 10 };
    this.attention = s.save?.attention ?? 0;
    const gl = s.renderer.gl;
    this.wardrobe = new Wardrobe(s.world.hero.outfits ?? {}, s.world.hero.sprite, s.hero, { outfit: s.save?.outfit, projection: s.save?.projection, start: s.world.hero.outfit },
      (path) => { const cut = path.lastIndexOf('/'); return loadSprite(gl, `${s.assets}/${path.slice(0, cut)}`, path.slice(cut + 1), spriteDefaults(gl), this.bust); },
      (sprite) => freeSprite(gl, sprite));
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
    this.hud.onVerb = (v) => this.setVerb(v);
    this.hud.onHold = (id) => this.hold(id);
    this.hud.saves = () => listSaves();
    this.hud.onSave = (slot) => this.saveTo(slot);
    this.hud.onLoad = (slot) => this.loadFrom(slot);
    // what a story's line has the game do before it is said: the conversation waits for it
    this.talk.run = (commands) => direct(commands, this.stage);
    this.hud.onView = () => this.toggleView();
    this.hud.mapNow = () => this.mapNow();
    this.hud.onTravel = (t) => void this.jump(t);
    // her notebook, where it can see her: she keeps it shut
    this.hud.onShut = () => this.say('Not here. It can see.');
    this.hud.read = () => this.notesRead;
    this.hud.onRead = (keys) => {
      const fresh = keys.filter((k) => !this.notesRead.has(k));
      for (const k of fresh) this.notesRead.add(k);
      if (fresh.length) this.persist();
    };
    this.hud.setJournal(s.journal);
    this.hud.onBell = () => this.hud.toast(this.scene.file.assist ?? 'Is there anything I can do for you, guest?');
    this.hud.onPanel = () => this.ui.hideCaption();
    this.hud.onDispose = (_id, dispose) => this.hud.toast(dispose ? 'Of course, guest. I will collect it at your convenience.' : 'As you wish, guest.');
  }

  /** A session, in the scene the address asks for, or the saved one, or where the world starts. */
  static async start(s: GameSetup, asked?: { scene: string; spawn?: string }): Promise<Game> {
    const g = new Game(s), save = s.save, w = s.world;
    const startId = asked?.scene ?? (save?.scene && w.scenes.includes(save.scene) ? save.scene : w.start.scene);
    if (asked) await g.enter(startId, { spawn: asked.spawn ?? Object.keys((await g.scenes.file(startId)).spawns)[0] });
    else if (save?.scene === startId) await g.enter(startId, { x: save.heroX, facing: save.facing });
    else await g.enter(startId, { spawn: w.start.spawn });
    // the projection she had on, put back on (its sprite loaded); if it cannot be, she is in her clothes
    if (g.projection) await g.project(g.projection).catch(() => g.project(null));
    g.syncView();
    g.hud.setAttention(g.attention);
    return g;
  }

  get raw(): boolean {
    return this.state.view < 0.5;
  }

  /**
   * The Concierge sees and hears her here: everywhere but a privacy zone (her home; later public restrooms and approved
   * meeting rooms), which the law it keeps forbids it to watch.
   */
  get watched(): boolean {
    return !!this.scene && !this.scene.file.private;
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

  private async enter(id: string, at: Arrival): Promise<void> {
    const next = await this.scenes.get(id), sp = at.spawn ? next.file.spawns[at.spawn] : undefined, from = this.scene?.file.id;
    // at home's door she changes: out of her coat coming in, into it going out
    const outfits = this.s.world.hero.outfits;
    if (outfits) await this.wear(outfitAfter(outfits, this.outfit, !!this.scene?.file.wardrobe, !!next.file.wardrobe) ?? this.outfit);
    this.scene = next;
    this.runner = new SceneRunner(next.loaded);
    this.heldMover = null;
    this.fitGaits(next);
    this.world = new World(next.level, at.x ?? sp?.x, at.facing ?? sp?.facing);
    this.world.raw = this.raw;
    // what is there depends on the story: a thing only while a condition holds, a thing she took gone for good
    this.world.shown = this.there;
    this.been.add(id);
    this.runner.shown = (when) => this.dialogue.test(when);
    this.camera.jump(this.cameraTarget());
    this.cam[0] = this.s.fixedCam ?? this.camera.x;
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
    const want = this.s.variant ?? String(this.dialogue.story.variablesState['conditions'] ?? '');
    return want && scene.file.variants?.[want] ? want : undefined;
  }

  private cameraTarget(): number {
    return cameraTarget(this.scene.file, this.world.heroX, this.s.reduceMotion);
  }

  /**
   * Her pace follows her stride at her size here, so each foot stays where it lands; each gait the same way, a jog and a
   * run longer strides at a quicker cadence. Only the gaits she has in what she wears.
   */
  private fitGaits(scene: Scene): void {
    const gaits = heroGaits(this.shown.def, this.s.world.hero, scene.file.actorScale ?? 1);
    scene.level.hero.gaits = gaits;
    if (gaits.walk) scene.level.hero.speed = gaits.walk.speed;
  }

  /* ---------- what she wears ---------- */

  /** Her sprite as the view on screen shows her: a projection over her clothes in the Concierge's, her clothes in raw view. */
  private get shown(): Sprite {
    return this.wardrobe.shown(this.raw);
  }

  /** A projection put on her, or taken off; her gaits are its sprite's in the Concierge's view. */
  private async project(key: string | null): Promise<void> {
    await this.wardrobe.project(key);
    if (this.scene) this.fitGaits(this.scene);
  }

  private wear(key: string): Promise<void> {
    return this.wardrobe.wear(key);
  }

  /**
   * Her wardrobe: what she wears at home, as answers to pick from, and a way out of it. Not her coat: she takes that off
   * as she comes in, it hangs by the door, and she puts it on as she leaves.
   */
  private openWardrobe(): void {
    const outfits = this.s.world.hero.outfits;
    if (!outfits) return;
    // her own clothes; in the Concierge's view also what her AR system can put on her, and taking it off
    const own = Object.keys(outfits).filter((k) => !outfits[k].home && !outfits[k].virtual);
    const projections = this.raw ? [] : Object.keys(outfits).filter((k) => outfits[k].virtual);
    const choices: { label: string; pick: () => void }[] = [
      ...own.map((k) => ({ label: `${outfits[k].name}${k === this.outfit ? ' (wearing)' : ''}`, pick: () => { if (k !== this.outfit) void this.change(k); } })),
      ...projections.map((k) => ({ label: `${outfits[k].name}, projected${k === this.projection ? ' (on)' : ''}`, pick: () => { if (k !== this.projection) void this.change(k); } })),
      ...(this.projection && !this.raw ? [{ label: 'Projection off', pick: () => void this.change(null) }] : []),
    ];
    this.picker = (i) => choices[i]?.pick();
    this.talk.show([], [...choices.map((c) => c.label), 'Never mind']);
  }

  /**
   * She changes clothes where she stands, behind a moment's fade, held for `hold` ms more where a while passes: into her
   * own clothes, or a projection put on or (null) taken off over them. Where a while passes (the shower), the projection
   * comes off with her clothes.
   */
  private async change(key: string | null, hold = 0): Promise<void> {
    this.s.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, this.s.reduceMotion ? 0 : 260 + hold));
    try {
      const outfits = this.s.world.hero.outfits ?? {}, virtual = key ? outfits[key]?.virtual : true;
      if (virtual) {
        // a projection goes on over her clothes: she dresses in them first, so raw view shows her dressed
        const under = key ? dressedFor(outfits, key) : undefined;
        if (under && outfits[under] && !keepsProjection(outfits, key!, this.outfit)) await this.wear(under);
        await this.project(key);
      } else if (key) {
        await this.wear(key);
        // undressing takes a projection off with her clothes, as the shower does
        if (hold || (this.projection && !keepsProjection(outfits, this.projection, key))) await this.project(null);
      }
      this.fitGaits(this.scene);
      this.persist();
    } catch (err) {
      this.ui.showCaption(`Those clothes are not made yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    this.s.fade.classList.remove('on');
  }

  /** A line of hers, over her head. */
  private say(text: string): void {
    this.talk.show([{ text, speaker: 'luna' }], []);
  }

  /**
   * She goes through a way out (a door, the end of the street), or somewhere on the map: fade out, go to the other
   * scene, arriving at one of its places or at x, fade in. For the story (`story`), whatever she wears, and the
   * conversation goes on there.
   */
  private async travel(exit: { scene: string } & Arrival, story = false): Promise<void> {
    if (this.travelling) return;
    this.travelling = true;
    this.letGo();
    this.world.stop();
    this.releaseKeys();
    // dressed in what she does not go out in, she stays
    const outfits = this.s.world.hero.outfits;
    if (outfits && this.scene.file.wardrobe && !story) {
      const to = await this.scenes.file(exit.scene).catch(() => null);
      if (to && outfitAfter(outfits, this.outfit, true, !!to.wardrobe) === null) {
        this.travelling = false;
        return this.say(outfits[this.outfit]?.stay ?? 'Not dressed like this.');
      }
    }
    this.setVerb(null);
    this.hud.closeAll();
    // what she was looking at, and who she was talking to, stay behind
    this.ui.hideCaption();
    if (this.talk.open && !story) { this.talk.hide(); this.endTalk(); }
    // a conversation going on there: whoever she talked to here is left behind
    if (story) this.partner = null;
    this.s.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, this.s.reduceMotion ? 0 : 260));
    // a scene not ready once the fade is dark: after a moment a small ring turning. One fetched ahead never shows it
    const waiting = setTimeout(() => this.s.fade.classList.add('wait'), 300);
    try {
      await this.enter(exit.scene, exit);
      this.arrive();
      this.syncKeys();
      this.persist();
    } catch (err) {
      this.ui.showCaption(`That way is not built yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    clearTimeout(waiting);
    this.s.fade.classList.remove('wait', 'on');
    this.travelling = false;
  }

  /**
   * She has come to a scene from another: the story's count of arrivals goes up (`arrivals`, a clock it can count by),
   * and the scene's rotations turn, before it is seen: who sits at the station now.
   */
  private arrive(): void {
    this.arrived++;
    this.dialogue.set('arrivals', this.arrived);
    const { set, counts } = rotateOnArrival(this.scene.file.rotate ?? {}, this.rotations, (c) => this.dialogue.test(c));
    this.rotations = counts;
    for (const [name, value] of Object.entries(set)) this.dialogue.set(name, value);
  }

  /** Going somewhere on the map: a place (where one arrives there), or a door or a person in it (where she stands to use it). */
  private async jump(t: Travel): Promise<void> {
    if (this.talk.open || this.travelling) return;
    const file = await this.scenes.file(t.scene).catch(() => null), h = t.at ? file?.hotspots.find((x) => x.id === t.at) : undefined;
    if (!file) return;
    if (!h) return this.travel({ scene: t.scene, spawn: t.spawn && file.spawns[t.spawn] ? t.spawn : Object.keys(file.spawns)[0] });
    const { rect, stand, face } = placeIn(h, this.raw), x = stand ?? rect[0] + rect[2] / 2;
    return this.travel({ scene: t.scene, x, facing: face ?? (rect[0] + rect[2] / 2 >= x ? 1 : -1) });
  }

  /** The map as she knows it: every place on it whose file there is, what she has been to and seen, where she is. */
  private async mapNow(): Promise<MapNow> {
    const layout = this.s.world.map ?? { places: {} }, ids = Object.keys(layout.places).filter((id) => this.s.world.scenes.includes(id));
    const files = await Promise.all(ids.map((id) => this.scenes.file(id).catch(() => null)));
    const scenes: Record<string, MapScene> = {};
    ids.forEach((id, i) => { const f = files[i]; if (f) scenes[id] = f; });
    return mapNow(layout, scenes, this.been, (sc, id) => !!this.seen.get(sc)?.has(id), { scene: this.scene.file.id, x: this.world.heroX }, this.raw, this.there);
  }

  /** What is on screen now of what goes on the map (ways out, people): seen, for the map. */
  private noticeSpots(): void {
    const f = this.scene.file, seen = this.seen.get(f.id) ?? new Set<string>();
    for (const h of f.hotspots) {
      if (seen.has(h.id) || !onMap(h) || !inView(h, this.raw) || !this.there(h)) continue;
      const [x, , w] = placeIn(h, this.raw).rect, sx = x - this.cam[0] * (h.parallax ?? 1);
      if (sx + w > 0 && sx < NW) seen.add(h.id);
    }
    this.seen.set(f.id, seen);
  }

  /** An exit at an end of the walk line, which walking into with the keyboard takes. */
  private exitAt(x: number): Hotspot | undefined {
    return this.scene.file.hotspots.find((h) => { const [rx, , rw] = placeIn(h, this.raw).rect; return h.go && inView(h, this.raw) && this.world.shown(h) && x >= rx - 1 && x <= rx + rw + 1; });
  }

  /**
   * Art or a scene file changed on the dev server: every scene loads again on its next visit, and the one on screen at
   * once, with her where she stands, if the change is its own (its file, or art it uses).
   */
  assetsChanged(files: string[]): void {
    this.bust = String(Date.now());
    this.scenes.reset(this.bust, this.scene);
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
   * the game; the button and every built version keep the story's lock until the fixer has switched raw view on.
   */
  toggleView(force = false): void {
    if (!this.canSwitch() && !force) return;
    this.state.view = this.state.view > 0.5 ? 0 : 1;
    this.world.raw = this.raw;
    this.switchedAt = this.clock();
    this.look.refresh();
    // a projection shows in one view only: her gaits are the ones of the sprite now on screen
    if (this.wardrobe.projected) this.fitGaits(this.scene);
    // a verb the other view does not have (the Concierge's bell) is put down
    if (this.verb && !verbsIn(this.raw).includes(this.verb)) this.setVerb(null);
    this.syncView();
    this.hud.setVerb(this.verb);
    this.persist();
  }

  /* ---------- conversations and doing things ---------- */

  private endTalk(): void {
    this.partner = null;
    this.letMoverGo();
    void this.hud.showCloseup(null);
    // a conversation can change the city's conditions: the rain starts, the power goes
    const v = this.variantOf(this.scene);
    if (v !== this.variant) { this.variant = v; this.look.setScene(this.scene.file, v); }
    this.hud.setTalking(false);
    this.syncThings();
    // the conversation that unlocks the view switch, whichever it is, says how to use it
    const unlocked = this.lockedBeforeTalk && this.canSwitch();
    this.lockedBeforeTalk = false;
    this.syncView();
    this.persist();
    if (unlocked) {
      this.ui.showCaption('Something behind your eye is new. Touch your temple, with your things at the bottom left, or press E, to see what is really there.');
      this.switchedAt = this.clock();
    }
  }

  /** A mover she went up to goes on again from where it stopped. */
  private letMoverGo(): void {
    if (this.heldMover) this.runner.release(this.heldMover, this.clock());
    this.heldMover = null;
  }

  /** Whether a thing's knot in the story has this stitch. */
  private stitch(h: Hotspot, name: string): boolean {
    return !!h.story && this.dialogue.has(h.story, name);
  }
  private readonly stitches = (h: Hotspot, name: string): boolean => this.stitch(h, name);

  /** How the story's commands are done here (see direct.ts). */
  private readonly stage: Stage = {
    walk: async (to) => {
      const h = this.scene.file.hotspots.find((x) => x.id === to), place = h ? placeIn(h, this.raw) : null;
      const x = place ? place.stand ?? place.rect[0] + place.rect[2] / 2 : Number(to);
      if (!Number.isFinite(x)) return;
      this.directing = true;
      this.goTo(x);
      // until she is there (or gives up, at the end of the walk line)
      const until = performance.now() + 15000;
      while (this.world.moving && performance.now() < until) await this.stage.sleep(50);
      this.directing = false;
      if (place) this.world.facing = place.face ?? (place.rect[0] + place.rect[2] / 2 >= this.world.heroX ? 1 : -1);
    },
    face: (dir) => { this.world.facing = dir; },
    wear: (outfit) => this.change(outfit),
    go: async (scene, spawn) => this.travel({ scene, spawn: spawn ?? Object.keys((await this.scenes.file(scene)).spawns)[0] }, true),
    fade: async (seconds) => {
      this.s.fade.classList.add('on');
      await this.stage.sleep(260 + seconds * 1000);
      this.s.fade.classList.remove('on');
      await this.stage.sleep(260);
    },
    view: (raw) => { if (raw !== this.raw) this.toggleView(true); },
    sleep: (ms) => new Promise((r) => setTimeout(r, this.s.reduceMotion ? Math.min(ms, 50) : ms)),
    closeup: (name) => this.hud.showCloseup(name),
  };

  /**
   * A thing's knot in the story, at a stitch: one plain line with nothing to answer is written at the thing, as a look
   * is; anything more (several lines, someone speaking, answers, something the game does) is a conversation.
   */
  private runStory(h: Hotspot, path: string): void {
    const lines = this.dialogue.start(path, this.raw), choices = this.dialogue.choices, one = lines[0];
    if (lines.length === 1 && !choices.length && !one.commands && (one.speaker === 'narration' || one.speaker === 'luna')) {
      this.hud.note(h, one.text, this.boxOf(h));
      this.endTalk();
      return;
    }
    if (!lines.length && !choices.length) return this.endTalk();
    this.lockedBeforeTalk = !this.canSwitch();
    this.partner = h;
    this.hud.setTalking(true);
    this.talk.show(lines, choices);
  }

  private act(h: Hotspot, a: Action): void {
    const raw = this.raw;
    if (a.kind === 'feet' && h.go) return void this.travel(h.go);
    // a thing she holds, used on this one: the story's use_<thing>, or nothing comes of it
    if (a.kind === 'item') {
      const id = this.inHand;
      this.hold(null);
      if (id && this.stitch(h, `use_${id}`)) return this.runStory(h, `${h.story}.use_${id}`);
      return this.hud.note(h, raw ? 'nothing.' : 'Nothing happens.', this.boxOf(h));
    }
    // a conversation of its own (`talk`) is what Talk does; any other verb, the thing's knot where it answers it
    const st = STITCH[a.kind as keyof typeof STITCH];
    if (st && !(a.kind === 'heart' && h.talk) && this.stitch(h, st)) return this.runStory(h, `${h.story}.${st}`);
    // a thing to pick up: into her pockets, gone from here for good
    if (a.kind === 'take' && h.item) {
      this.dialogue.take(h.item);
      this.syncThings();
      this.persist();
      const name = this.s.items[h.item] ? pick(this.s.items[h.item].name, raw) : h.item;
      return this.hud.note(h, h.take ? pick(h.take, raw) : raw ? `${name}, in my pocket.` : `${name}: added to your things.`, this.boxOf(h));
    }
    if (a.kind === 'heart' && h.talk) {
      this.lockedBeforeTalk = !this.canSwitch();
      this.partner = h;
      this.hud.setTalking(true);
      this.talk.show(this.dialogue.start(h.talk, raw), this.dialogue.choices);
    } else if (a.kind === 'eyes' && h.look) {
      // what she finds is written at the thing, where her eye already is
      this.hud.note(h, pick(h.look, raw), this.boxOf(h));
      if (a.cost) this.raiseAttention(a.cost);
    } else if (a.kind === 'hands' && h.wardrobe) this.openWardrobe();
    // the shower: a while passes behind the fade, and she comes out of it in her bathrobe; what she finds, after
    else if (a.kind === 'hands' && h.wear) void this.change(h.wear, 900).then(() => { if (h.use) this.hud.note(h, pick(h.use, raw), this.boxOf(h)); });
    else if (a.kind === 'hands' && h.use) this.hud.note(h, pick(h.use, raw), this.boxOf(h));
    else if (a.kind === 'take' && h.take) this.hud.note(h, pick(h.take, raw), this.boxOf(h));
    else if (a.kind === 'ask' && h.ask) this.hud.toast(h.ask);
  }

  /** Looking and asking happen from where she stands, turned towards it; talking, using and taking walk her there first. */
  private perform(h: Hotspot, a: Action): void {
    const { rect, stand } = placeIn(h, this.raw);
    // something on its round (a guard) stops for her, turned to her, and she goes up to it
    if (h.follows && a.kind !== 'eyes' && a.kind !== 'ask') {
      const cx = rect[0] + rect[2] / 2, side: 1 | -1 = this.world.heroX < cx ? -1 : 1;
      this.letMoverGo();
      this.runner.hold(h.follows, this.clock(), side);
      this.heldMover = h.follows;
      this.pending = a;
      return this.goTo(cx + side * (rect[2] / 2 + 12), h);
    }
    if (a.kind === 'eyes' || a.kind === 'ask' || stand === undefined) {
      if (!this.world.moving) this.world.facing = rect[0] + rect[2] / 2 >= this.world.heroX ? 1 : -1;
      return this.act(h, a);
    }
    this.pending = a;
    this.goTo(stand, h);
  }

  /**
   * She goes to x, and then does what is pending to `then`: walking, jogging if it is further than a few of her heights
   * off, and running if it is further than twice that. She speeds up into it and slows down out of it.
   */
  private goTo(x: number, then: Hotspot | null = null): void {
    const tall = this.shown.def.h * (this.scene.file.actorScale ?? 1);
    this.world.walkTo(x, then, paceFor(Math.abs(x - this.world.heroX), this.s.world.hero, tall));
  }

  /* ---------- her things ---------- */

  /** Her pockets as the story has them now (or as the world lists them, in a story that keeps none). */
  private syncThings(): void {
    this.hud.setThings(this.s.items, this.dialogue.carried() ?? this.s.world.hero.items ?? []);
    if (this.inHand && !(this.dialogue.carried() ?? []).includes(this.inHand)) this.hold(null);
  }

  /** She takes a thing out to use it on something, the next thing her finger lights up; null puts it back. */
  private hold(id: string | null): void {
    this.inHand = id;
    if (id) { this.hud.closePanel(); this.setVerb(null); }
    this.unmark();
    this.hud.setHeld(id);
    this.s.canvas.style.cursor = id ? 'crosshair' : '';
  }

  /* ---------- input: verbs, the pointer in level pixels, the walk keys ---------- */

  /** A verb chosen at the ball, or put down. */
  private setVerb(v: Verb | null): void {
    this.verb = v;
    if (v && this.inHand) { this.inHand = null; this.hud.setHeld(null); }
    this.unmark();
    this.hud.setVerb(v);
    this.s.canvas.style.cursor = v || this.inHand ? 'crosshair' : '';
  }

  /** The point under the pointer, in level pixels: the screen's position in the scene. */
  toLevel(clientX: number, clientY: number): [number, number] {
    const r = this.s.canvas.getBoundingClientRect();
    return [((clientX - r.left) / r.width) * NW + this.cam[0], ((clientY - r.top) / r.height) * NH + this.cam[1]];
  }

  /** Where a speaker's lines go: over her head, over whoever she is talking to, or (narration) at the top. */
  private speakerAt(speaker: string): [number, number] | null {
    // over a close-up every line is said at the top, clear of the picture
    if (this.hud.closeupOpen) return null;
    if (speaker === 'luna') {
      const c = this.s.canvas.getBoundingClientRect(), hud = this.hud.root.getBoundingClientRect(), k = c.width / NW;
      const head = this.scene.file.walk.y - this.shown.def.h * (this.scene.file.actorScale ?? 1);
      return [(this.world.heroX - this.cam[0]) * k + c.left - hud.left, (head - this.cam[1]) * k + c.top - hud.top - 6];
    }
    if (speaker === 'narration' || !this.partner) return null;
    const [x, y, w] = this.boxOf(this.partner);
    return [x + w / 2, y - 6];
  }

  /** A thing's place on screen, in the HUD's pixels, where its layer has moved to with the camera. */
  private boxOf(h: Hotspot): [number, number, number, number] {
    const c = this.s.canvas.getBoundingClientRect(), hud = this.hud.root.getBoundingClientRect(), k = c.width / NW;
    const [x, y, w, hh] = placeIn(h, this.raw).rect;
    return [(x - this.cam[0] * (h.parallax ?? 1)) * k + c.left - hud.left, (y - this.cam[1]) * k + c.top - hud.top, w * k, hh * k];
  }

  /** With a verb chosen: what is under the pointer lights up if the verb does something to it. */
  private scan(clientX: number, clientY: number): void {
    const [x, y] = this.toLevel(clientX, clientY), h = this.verb || this.inHand ? this.world.hotspotAt(x, y, this.raw, this.cam[0]) : null;
    const name = this.inHand && this.s.items[this.inHand] ? pick(this.s.items[this.inHand].name, this.raw) : this.inHand ?? '';
    const a = !h ? null : this.inHand ? itemActionFor(name, this.raw) : this.verb ? actionFor(h, this.verb, this.raw, this.stitches) : null;
    this.marked = h && a ? { h, a, box: this.boxOf(h) } : null;
    this.hud.mark(this.marked);
  }

  private unmark(): void {
    this.marked = null;
    this.hud.mark(null);
  }

  /**
   * A finger or the mouse button went down on the scene. With a verb chosen, what is under it lights up. Without one,
   * she goes there: up to a thing, through a way out (a door, the end of the street), running if it is far. A finger
   * held down and moved steers her; held down outdoors far from her, it runs her after it until it comes up (holdOn).
   * Right-click puts the verb down, or looks. The balls' choices stay out; a panel
   * closes, and what she found goes as she is given something else to do.
   */
  pointerDown(clientX: number, clientY: number, button: number): void {
    if (this.talk.open || this.travelling) return;
    if (this.hud.panelOpen) return this.hud.closePanel();
    this.hud.dismissNote();
    this.letMoverGo();
    if (button === 2) {
      if (this.inHand) return this.hold(null);
      if (this.verb) return this.setVerb(null);
      const [x, y] = this.toLevel(clientX, clientY), h = this.world.hotspotAt(x, y, this.raw, this.cam[0]), a = h && actionFor(h, 'eyes', this.raw, this.stitches);
      if (h && a) this.perform(h, a);
      return;
    }
    this.down = [clientX, clientY];
    this.finger = [clientX, clientY];
    this.downAt = this.clock();
    this.holding = this.chasing = false;
    if (this.verb || this.inHand) return this.scan(clientX, clientY);
    const [x, y] = this.toLevel(clientX, clientY), h = this.world.hotspotAt(x, y, this.raw, this.cam[0]);
    this.pending = h?.go ? { kind: 'feet', label: '' } : null;
    const stand = h ? placeIn(h, this.raw).stand : undefined;
    this.goTo(h?.go || stand === undefined ? x : stand, h?.go ? h : null);
  }

  /** It moved: with a verb, what it is over lights up (a mouse needs no button for that); a finger held down steers her. */
  pointerMove(clientX: number, clientY: number): void {
    if (this.talk.open || this.travelling) return;
    if (this.down) this.finger = [clientX, clientY];
    if (this.verb || this.inHand) return this.scan(clientX, clientY);
    if (this.down && !this.chasing && Math.hypot(clientX - this.down[0], clientY - this.down[1]) > 12) {
      this.pending = null;
      this.goTo(this.toLevel(clientX, clientY)[0]);
    }
  }

  /** It came up: with a verb, letting go over what it lit does the verb to it, and the verb is put down. */
  pointerUp(): void {
    const was = this.down;
    this.letGo();
    if (!was || (!this.verb && !this.inHand)) return;
    const m = this.marked;
    if (!m) return this.unmark();
    if (this.verb) this.setVerb(null);
    this.unmark();
    this.perform(m.h, m.a);
  }

  /** The finger was taken away, or the mouse left the scene without a button down. */
  pointerCancel(): void {
    this.letGo();
    this.unmark();
  }

  /** The finger is up, or she is leaving: if it was running her, she stops where she is, as she does letting go of a key. */
  private letGo(): void {
    this.down = null;
    this.finger = null;
    if (this.holding) { this.holding = this.chasing = false; this.world.stop(); }
  }

  /**
   * A finger held down a moment outdoors, further from her than she would jog to, runs her after it: on a street wider
   * than the screen it stays ahead of her as the camera follows, so she runs on until it comes up. Brought in near her,
   * she stops chasing it and walks to where it points then, and stands there; moved, it steers her as any finger does,
   * and taken far again, it runs her again. Letting go stops her; held past an end of the street, she goes on through its
   * way out. A tap is a tap: she goes where it was.
   */
  private holdOn(t: number): void {
    if (!this.finger || this.verb || this.talk.open || this.travelling || this.scene.file.kind !== 'exterior' || t - this.downAt < HOLD) return;
    const x = this.toLevel(this.finger[0], this.finger[1])[0], tall = this.shown.def.h * (this.scene.file.actorScale ?? 1);
    if (holdPace(Math.abs(x - this.world.heroX), this.s.world.hero, tall) === 'run') {
      this.holding = this.chasing = true;
      this.pending = null;
      this.world.walkTo(x, null, 'run');
    } else if (this.chasing) {
      // near her: the camera following her would keep a point on screen just ahead of her for ever
      this.chasing = false;
      this.world.walkTo(x, null, 'walk');
    }
  }

  /** The arrows walk her; with Shift she speeds up through a jog into a run. */
  walkKey(dir: 'left' | 'right', down: boolean, run = false): void {
    if (down) this.held.add(dir);
    else this.held.delete(dir);
    this.world.keyRun = run;
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

  /** Where she is and what has happened, as a save. */
  private saveData(): SaveData {
    return {
      v: 2, scene: this.scene.file.id, heroX: Math.round(this.world.heroX), facing: this.world.facing, view: this.state.view, ink: this.dialogue.save(),
      attention: this.attention, outfit: this.outfit || undefined, projection: this.projection ?? undefined, savedAt: Date.now(), where: this.scene.file.name,
      visited: [...this.been], seen: Object.fromEntries([...this.seen].map(([k, v]) => [k, [...v]])), read: [...this.notesRead],
      arrived: this.arrived, rotations: this.rotations,
    };
  }

  /** The autosave, written as she plays: never in the middle of a conversation, which saves as it ends. */
  persist(): void {
    if (this.talk.open || this.directing) return;
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
    const p = new URLSearchParams(location.search);
    for (const k of ['new', 'scene', 'spawn']) p.delete(k);
    const q = p.toString();
    location.replace(`${location.pathname}${q ? `?${q}` : ''}`);
  }

  /* ---------- each frame ---------- */

  frame(): void {
    const t = this.clock(), dt = Math.min(0.05, Math.max(0, t - this.lastT)), world = this.world, file = this.scene.file;
    this.lastT = t;
    const wasMoving = world.moving;
    this.holdOn(t);
    // she moves while a conversation is open only when its story has her walk
    const arrived = (this.talk.open && !this.directing) || this.travelling ? null : world.update(dt);
    // the view may have changed on the way: a generated person is not there to talk to in raw view
    if (arrived && inView(arrived, this.raw)) {
      const actions = actionsFor(arrived, this.raw, this.stitches), a = this.pending?.kind === 'item' ? this.pending : actions.find((x) => x.kind === this.pending?.kind) ?? defaultOf(actions);
      this.pending = null;
      if (a) this.act(arrived, a);
    }
    // in its view, with nothing to stare at, its attention slowly settles
    if (this.attention > 0 && !this.raw && t - this.attentionAt > 30) { this.attention--; this.attentionAt = t; this.hud.setAttention(this.attention); }
    // its greeting and its line of the day: the evening goes on, and it never says it is raining
    const minute = 21 * 60 + 40 + Math.floor(t / 60), hh = Math.floor(minute / 60) % 24, mm = minute % 60;
    this.hud.setStatus(file.greeting ?? 'Good evening, guest.', `Friday · Year 64 of Care · ${hh}:${String(mm).padStart(2, '0')} · ${file.kind === 'interior' ? 'Indoors, 21°' : '14°, umbrella advised'}`);
    const credits = this.dialogue.read('credits');
    this.hud.setCredits(typeof credits === 'number' ? credits : null);
    // walking into an end of the walk line that leads somewhere: with the keys, or with a finger running her past it
    const push = world.keyDir || (this.chasing && this.finger ? Math.sign(this.toLevel(this.finger[0], this.finger[1])[0] - world.heroX) : 0);
    if (push !== 0 && !this.travelling) {
      const end = push < 0 ? file.walk.x0 : file.walk.x1, exit = Math.abs(world.heroX - end) < 0.5 ? this.exitAt(end) : undefined;
      if (exit?.go) void this.travel(exit.go);
    }
    this.cam[0] = this.s.fixedCam ?? this.camera.follow(this.cameraTarget(), dt, file.size[0] > NW);
    // a hotspot that goes with a mover is where the mover is now; off the scene while it is out of sight
    for (const h of file.hotspots) if (h.follows) h.rect = this.runner.moverBoxes.get(h.follows) ?? [-1000, -1000, 0, 0];
    // what she sees goes on the map; out of its sight her notebook opens
    this.noticeSpots();
    this.hud.setUnseen(!this.watched);
    if (wasMoving && !world.moving) this.persist();
    this.state.sinceSwitch = this.s.reduceMotion ? 10 : t - this.switchedAt;
    // she is drawn at the scene's scale, bobbing a little if her sprite has no walk of its own; the scene's smoke
    // emitter follows her cigarette, or goes off screen when she has none
    const hero = this.shown, sc = file.actorScale ?? 1, bob = (hero.def.anims?.walk ? 0 : world.bob) * sc, hs = this.s.world.hero.smoke;
    const smoke: [number, number] = hs ? [world.heroX + hs[0] * sc * world.facing, file.walk.y + hs[1] * sc + bob] : [-1000, -1000];
    const her = heroDrawing(hero, { x: world.heroX, walkY: file.walk.y, cam: this.cam, scale: sc, facing: world.facing, bob, frame: frameFor(hero.def, world.moving, world.phase, t, world.facing, world.gait) });
    // what a verb lights up, and what she found, stay on the thing as the camera follows her
    if (this.marked) { this.marked.box = this.boxOf(this.marked.h); this.hud.mark(this.marked); }
    const noted = this.hud.noteFor;
    if (noted) this.hud.placeNote(this.boxOf(noted));
    this.talk.place();
    fitCanvas(this.s.canvas);
    this.s.renderer.render(this.runner.frame(t, this.state, this.cam, [her], smoke));
  }
}
