// Her controls in a session: a finger (or the mouse) on the scene and the walk keys, turned into what she does. A tap
// walks her there: up to a thing, and she looks at it (or talks with someone she can), through a way out (a door, the
// end of the street), running if it is far. A tap never takes or uses a thing: that is a verb chosen at the ball, which
// slid over the scene lights up what it would do, and letting go does it; a thing out of her pockets is used on the next
// thing tapped. A finger held down and moved steers her; held down outdoors far from her, it runs her after it until it
// comes up. In a close-up nothing is walked to: a tap looks, there and then. The page's events come in through input.ts.

import { NH, NW } from '../engine/renderer';
import { actionFor, actionsFor, defaultOf, itemActionFor, type Action, type Verb } from './actions';
import type { Game } from './game';
import { holdPace, paceFor } from './hero';
import type { Mark } from './marks';
import { pick, placeIn, type Hotspot } from './level';

/** Seconds a finger is held down before it can run her (a tap is quicker): see holdOn. */
const HOLD = 0.25;

export class Controls {
  /** The verb chosen at the ball: what she will do to the next thing her finger lights up. */
  verb: Verb | null = null;
  /** A thing she holds, out of her pockets, to use on the next thing her finger lights up. */
  inHand: string | null = null;
  /** What she will do with a thing when she gets there. */
  pending: Action | null = null;
  /** What it lights up under her finger now. */
  private marked: Mark | null = null;
  /** The walk keys held down. */
  private readonly held = new Set<'left' | 'right'>();
  /** Where a finger (or the mouse button) went down on the scene, while it is down; where it is now, and when it went down. */
  private down: [number, number] | null = null;
  private finger: [number, number] | null = null;
  private downAt = 0;
  /** Held down outdoors far from her, it runs her after it until it comes up (see holdOn); chasing while it is far. */
  private holding = false;
  private chasing = false;

  constructor(private readonly g: Game) {}

  /**
   * A finger or the mouse button went down on the scene. With a verb chosen, what is under it lights up. Without one,
   * she goes there: up to a thing, through a way out (a door, the end of the street), running if it is far; on her,
   * where nothing else is, she turns to us until she moves. A finger held down and moved steers her; held down outdoors
   * far from her, it runs her after it until it comes up (holdOn). Right-click puts the verb down, or looks. The balls'
   * choices stay out; a panel closes, and what she found goes as she is given something else to do.
   */
  pointerDown(clientX: number, clientY: number, button: number): void {
    const g = this.g;
    if (g.talk.open || g.ways.travelling) return;
    if (g.hud.panelOpen) return g.hud.closePanel();
    g.hud.dismissNote();
    g.letMoverGo();
    if (button === 2) {
      if (this.inHand) return this.hold(null);
      if (this.verb) return this.setVerb(null);
      const [x, y] = this.toLevel(clientX, clientY), h = g.world.hotspotAt(x, y, g.raw, g.cam[0]), a = h && actionFor(h, 'eyes', g.raw, g.doing.stitches);
      if (h && a) g.doing.perform(h, a);
      return;
    }
    this.down = [clientX, clientY];
    this.finger = [clientX, clientY];
    this.downAt = g.clock();
    this.holding = this.chasing = false;
    if (this.verb || this.inHand) return this.scan(clientX, clientY);
    const [x, y] = this.toLevel(clientX, clientY), h = g.world.hotspotAt(x, y, g.raw, g.cam[0]);
    // in a close-up nothing is walked to: a tap on a thing looks at it (or goes, or talks), there and then
    if (g.scene.file.closeup) {
      const a = h ? defaultOf(actionsFor(h, g.raw, g.doing.stitches), h) : null;
      if (h && a) g.doing.perform(h, a);
      return;
    }
    // on her, with nothing there to go to (a door she stands in front of is still gone through)
    if (!h && !g.world.moving && this.onHer(x, y)) { g.turns.out = true; return; }
    const goes = !!(h?.go || h?.zoom);
    this.pending = goes ? { kind: 'feet', label: '' } : null;
    const stand = h ? placeIn(h, g.raw).stand : undefined;
    this.goTo(h?.go || stand === undefined ? x : stand, goes ? h : null);
  }

  /** It moved: with a verb, what it is over lights up (a mouse needs no button for that); a finger held down steers her. */
  pointerMove(clientX: number, clientY: number): void {
    if (this.g.talk.open || this.g.ways.travelling) return;
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
    this.g.doing.perform(m.h, m.a);
  }

  /** The finger was taken away, or the mouse left the scene without a button down. */
  pointerCancel(): void {
    this.letGo();
    this.unmark();
  }

  /** The finger is up, or she is leaving: if it was running her, she stops where she is, as she does letting go of a key. */
  letGo(): void {
    this.down = null;
    this.finger = null;
    if (this.holding) { this.holding = this.chasing = false; this.g.world.stop(); }
  }

  /**
   * Each frame: a finger held down a moment outdoors, further from her than she would jog to, runs her after it: on a
   * street wider than the screen it stays ahead of her as the camera follows, so she runs on until it comes up. Brought
   * in near her, she stops chasing it and walks to where it points then, and stands there; moved, it steers her as any
   * finger does, and taken far again, it runs her again. Letting go stops her; held past an end of the street, she goes
   * on through its way out. A tap is a tap: she goes where it was.
   */
  holdOn(t: number): void {
    const g = this.g;
    if (!this.finger || this.verb || g.talk.open || g.ways.travelling || g.scene.file.kind !== 'exterior' || t - this.downAt < HOLD) return;
    const x = this.toLevel(this.finger[0], this.finger[1])[0], tall = g.dressing.shown.def.h * (g.scene.file.actorScale ?? 1);
    if (holdPace(Math.abs(x - g.world.heroX), g.setup.world.hero, tall) === 'run') {
      this.holding = this.chasing = true;
      this.pending = null;
      g.world.walkTo(x, null, 'run');
    } else if (this.chasing) {
      // near her: the camera following her would keep a point on screen just ahead of her for ever
      this.chasing = false;
      g.world.walkTo(x, null, 'walk');
    }
  }

  /** Which way she is pushed into an end of the walk line: the walk keys, or a finger running her past it. */
  push(): number {
    const world = this.g.world;
    return world.keyDir || (this.chasing && this.finger ? Math.sign(this.toLevel(this.finger[0], this.finger[1])[0] - world.heroX) : 0);
  }

  /** The arrows walk her; with Shift she speeds up through a jog into a run. Not in a close-up. */
  walkKey(dir: 'left' | 'right', down: boolean, run = false): void {
    if (this.g.scene?.file.closeup) return;
    if (down) this.held.add(dir);
    else this.held.delete(dir);
    this.g.world.keyRun = run;
    this.syncKeys();
    if (!down && !this.g.world.keyDir) this.g.persist();
  }

  releaseKeys(): void {
    this.held.clear();
    this.syncKeys();
  }

  /** The walk keys held, told to the world she walks in (a new one, as she arrives somewhere). */
  syncKeys(): void {
    this.g.world.keyDir = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
  }

  /** A verb chosen at the ball (or asking, at the Concierge's greeting), or put down. */
  setVerb(v: Verb | null): void {
    this.verb = v;
    if (v && this.inHand) { this.inHand = null; this.g.hud.setHeld(null); }
    this.unmark();
    this.g.hud.setVerb(v);
    this.g.setup.canvas.style.cursor = v || this.inHand ? 'crosshair' : '';
  }

  /** She takes a thing out to use it on something, the next thing her finger lights up; null puts it back. */
  hold(id: string | null): void {
    this.inHand = id;
    if (id) { this.g.hud.closePanel(); this.setVerb(null); }
    this.unmark();
    this.g.hud.setHeld(id);
    this.g.setup.canvas.style.cursor = id ? 'crosshair' : '';
  }

  /**
   * She goes to x, and then does what is pending to `then`: walking, jogging if it is further than a few of her heights
   * off, and running if it is further than twice that. She speeds up into it and slows down out of it.
   */
  goTo(x: number, then: Hotspot | null = null): void {
    const g = this.g, tall = g.dressing.shown.def.h * (g.scene.file.actorScale ?? 1);
    g.world.walkTo(x, then, paceFor(Math.abs(x - g.world.heroX), g.setup.world.hero, tall));
  }

  /** She got to a thing she was going to: what she does to it now, what was pending, else what a tap does (a look). */
  arrivedAt(h: Hotspot): Action | null {
    const actions = actionsFor(h, this.g.raw, this.g.doing.stitches);
    const a = this.pending?.kind === 'item' ? this.pending : actions.find((x) => x.kind === this.pending?.kind) ?? defaultOf(actions, h);
    this.pending = null;
    return a ?? null;
  }

  /** What a verb lights up stays on the thing as the camera follows her. */
  remark(): void {
    if (!this.marked) return;
    this.marked.box = this.g.boxOf(this.marked.h);
    this.g.hud.mark(this.marked);
  }

  /** The point under the pointer, in level pixels: the screen's position in the scene. */
  toLevel(clientX: number, clientY: number): [number, number] {
    const r = this.g.setup.canvas.getBoundingClientRect(), cam = this.g.cam;
    return [((clientX - r.left) / r.width) * NW + cam[0], ((clientY - r.top) / r.height) * NH + cam[1]];
  }

  /** With a verb chosen: what is under the pointer lights up if the verb does something to it. */
  private scan(clientX: number, clientY: number): void {
    const g = this.g, [x, y] = this.toLevel(clientX, clientY), h = this.verb || this.inHand ? g.world.hotspotAt(x, y, g.raw, g.cam[0]) : null;
    const name = this.inHand && g.setup.items[this.inHand] ? pick(g.setup.items[this.inHand].name, g.raw) : this.inHand ?? '';
    const a = !h ? null : this.inHand ? itemActionFor(name, g.raw) : this.verb ? actionFor(h, this.verb, g.raw, g.doing.stitches) : null;
    this.marked = h && a ? { h, a, box: g.boxOf(h) } : null;
    g.hud.mark(this.marked);
  }

  unmark(): void {
    this.marked = null;
    this.g.hud.mark(null);
  }

  /** Whether a point in the level is on her: her figure about her middle, from her feet to the top of her head. */
  private onHer(x: number, y: number): boolean {
    const g = this.g, def = g.dressing.shown.def, sc = g.scene.file.actorScale ?? 1, ay = def.anchor?.[1] ?? def.h, foot = g.scene.file.walk.y;
    return Math.abs(x - g.world.heroX) <= def.w * sc * 0.12 + 6 && y <= foot && y >= foot - ay * sc * 0.95;
  }
}
