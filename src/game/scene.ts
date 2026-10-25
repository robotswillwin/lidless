// Turns a loaded scene plus the current state into a frame for the renderer.

import { asIn, inViewOf, slideOpacity, smoothSampled, SPEEDS, WAVES, type LoadedScene, type MoverDef, type Speed, type SpriteDef } from '../engine/assets';
import { resolveLight } from '../engine/presets';
import type { DrawSprite, Frame } from '../engine/renderer';
import { bendsAt } from './alive';
import { frameFor, hash, hasLeft } from './anim';
import { floorLabel, type LiftNow } from './lift';

/** A figure on a lift's display, as its seven segments: the bits of a top, then clockwise, the middle last. */
const SEGMENTS: Record<string, number> = { 0: 63, 1: 6, 2: 91, 3: 79, 4: 102, 5: 109, 6: 125, 7: 7, 8: 127, 9: 111, G: 61 };

export interface ViewState {
  /** 0 raw view, 1 Concierge view. */
  view: number;
  /** Seconds since the last switch, for the glitch. */
  sinceSwitch: number;
}

/** Light group intensities: 0 steady, 1 monitor, 2 valves, 3 fire, 4 the machine's eye, 5 neon flicker, 6 hologram, 7 screen, 8 string lights. */
export function lightGroups(t: number): number[] {
  const s = Math.sin, flick = s(t * 13.1) * s(t * 3.7) > 0.84 ? 0.25 : 1;
  return [1, 0.85 + 0.15 * s(t * 31) * s(t * 7), 0.85 + 0.15 * s(t * 2.1), 0.7 + 0.3 * s(t * 9) * s(t * 3.7 + 1), 0.9 + 0.1 * s(t * 1.3), flick, 0.9 + 0.1 * s(t * 2), 0.92 + 0.08 * s(t * 5), 0.9 + 0.1 * s(t * 0.7), 1, 1, 1, 1, 1, 1, 1];
}

/**
 * How far into a view switch, from 1 just after it down to 0. Into raw view the biohack shuts a nerve, which takes
 * longer than the Concierge resyncing its frames on the way back.
 */
export const switchFade = (view: number, since: number): number => Math.max(0, 1 - since / (view < 0.5 ? 0.9 : 0.45));


/**
 * Where a patrolling mover is at time t: its body's x, walking from x0 to x1 and back at `speed`, stopping on the way
 * where it stops, resting `rest` seconds at each end; which way it faces, whether it is walking, and how far it has
 * walked in this round (for its walk's cycle).
 */
export function patrolAt(t: number, x0: number, x1: number, speed: number, rest: number, stops: { x: number; seconds: number }[] = []): { x: number; dir: 1 | -1; moving: boolean; walked: number } {
  const span = Math.max(0, x1 - x0), v = Math.max(1e-6, speed), on = stops.filter((s) => s.x > x0 && s.x < x1);
  const going = (dir: 1 | -1) => on.map((s) => ({ at: dir > 0 ? s.x - x0 : x1 - s.x, seconds: s.seconds })).sort((a, b) => a.at - b.at);
  const leg = span / v + on.reduce((a, s) => a + s.seconds, 0), period = 2 * (leg + rest);
  if (period <= 0) return { x: x0, dir: 1, moving: false, walked: 0 };
  const tau = ((t % period) + period) % period;
  const walk = (dir: 1 | -1, k: number) => {
    const d = travelled(k, v, going(dir)), moving = k < leg && travelled(Math.min(leg, k + 1e-3), v, going(dir)) > d + 1e-9;
    return { d: Math.min(span, d), moving };
  };
  if (tau < leg) { const w = walk(1, tau); return { x: x0 + w.d, dir: 1, moving: w.moving, walked: w.d }; }
  if (tau < leg + rest) return { x: x1, dir: 1, moving: false, walked: span };
  if (tau < 2 * leg + rest) { const w = walk(-1, tau - leg - rest); return { x: x1 - w.d, dir: -1, moving: w.moving, walked: span + w.d }; }
  return { x: x0, dir: -1, moving: false, walked: 0 };
}

/** A light's strength factor now, by its pulse: its sequence stepped through on the clock. */
export const pulseAt = (p: { fps: number; seq: number[] }, t: number): number => (p.seq.length ? p.seq[Math.floor(t * p.fps) % p.seq.length] : 1);

/** A mover's current pass: when it starts (or started), which way it goes, how many passes came before it. */
interface Pass { from: number; dir: 1 | -1; n: number }

/** What the scene sounds like now (sound.ts reads it): sustained levels 0 to 1, and moments that are true for one frame. */
export interface SceneSound {
  /** The lift's motor while it moves (louder the more displays show it), its ding as it arrives, its start as it leaves. */
  liftMove: number; liftDing: boolean; liftStart: boolean;
  /** The dryer's air, 0 to 1, fading as it dies down. */
  dryer: number;
  /** The hologram's hum while it floats, its chord as it forms, its chime as its gaps line up. */
  hologramHum: number; hologramOn: boolean; hologramSolved: boolean;
  /** A ball of the cradle struck; a ring turned; the camera turning (0 to 1 by how fast). */
  cradleClack: boolean; ringTurn: boolean; cameraMove: number;
  /** An old machine's idle hum (a scope on a bench): a sign the place has working electronics. */
  machineHum: number;
}

const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

/**
 * How far a mover has gone, `elapsed` seconds into a pass at `speed`, stopping on the way: each stop `at` so far along
 * the pass, for `seconds`, in the order it reaches them.
 */
export function travelled(elapsed: number, speed: number, stops: { at: number; seconds: number }[]): number {
  let t = elapsed, d = 0;
  for (const s of stops) {
    const reach = (s.at - d) / speed;
    if (t <= reach) return d + t * speed;
    t -= reach;
    d = s.at;
    if (t <= s.seconds) return d;
    t -= s.seconds;
  }
  return d + t * speed;
}

export class SceneRunner {
  /** Where each mover was drawn last, by its asset: its box in the level, for a hotspot that follows it. */
  readonly moverBoxes = new Map<string, [number, number, number, number]>();
  /** Movers stopped where they are (a guard she talks to), turned to her: by asset, since when, facing which way. */
  private readonly held = new Map<string, { at: number; facing: 1 | -1 }>();
  /** How long each mover has been held, all told: its own clock runs that much behind, so it goes on where it stopped. */
  private readonly lag = new Map<string, number>();

  /** A mover stops where it is at time t, turned to face `facing`. */
  hold(asset: string, t: number, facing: 1 | -1): void {
    const h = this.held.get(asset);
    if (h) h.facing = facing;
    else this.held.set(asset, { at: t, facing });
  }

  /** It goes on again from where it stopped. */
  release(asset: string, t: number): void {
    const h = this.held.get(asset);
    if (!h) return;
    this.lag.set(asset, (this.lag.get(asset) ?? 0) + (t - h.at));
    this.held.delete(asset);
  }

  private passes: Pass[] = [];
  private cars = new Float32Array(64);
  private beacons = new Float32Array(128);
  private steam = new Float32Array(16);
  private steamFar = new Float32Array(4);
  private trails = new Float32Array(16);
  private trailColours = new Float32Array(16);
  private nTrails = 0;
  private steamDefs: LoadedScene['def']['steam'] = [];
  private godrays = new Float32Array(16);
  private shadows = new Float32Array(32);
  private smokeSlot = -1;

  /** Whether a condition on the story holds: a layer or a light with one is there only while it does. */
  shown: (when: string) => boolean = () => true;
  /** A story variable's value: an oscilloscope's knobs (its `wave` and `speed`). */
  read: (name: string) => unknown = () => undefined;

  /** The time of day, in seconds after midnight, at the scene's time t: a clock's hands. */
  daySeconds: (t: number) => number = (t) => t;

  /**
   * Each oscilloscope's line: four vec4 for each. Its shape now, the one before and when its knob turned; how many waves
   * cross its screen and how fast they creep, easing to its speed's; and how far they have crept, so a turn never jumps.
   */
  private scopes = new Float32Array(32);
  /** Each clock: where it is and how big. */
  private clocks = new Float32Array(8);
  /** A Newton's cradle: where it hangs, how big; how long since an end ball was let go, and which. */
  private cradle = new Float32Array(12);
  private swung: { count: number; at: number; side: number } | null = null;
  /** A hologram of rings: each ring's turn as shown, easing to the story's, and when its gaps lined up (-1: they don't). */
  private rings = new Float32Array(8);
  private ringState: { value: number[]; target: number[]; shown: number[]; solvedAt: number; t: number } | null = null;
  /** Where the tower's lift is, for the displays over its doors. */
  lift: (t: number) => LiftNow = () => ({ floor: 0, dir: 0 });
  /** Where her head is (world), for a camera to turn to: none in a close-up. */
  lookAt: [number, number] | null = null;
  /** When each spot was last used, by its id: air from a dryer. */
  private readonly usedAt = new Map<string, number>();
  private indicators = new Float32Array(64);
  private cameras = new Float32Array(8);
  private readonly aims: number[] = [];
  private aimedAt = 0;
  private airs = new Float32Array(8);

  /**
   * What is worth hearing in the scene now, for the game to sound (sound.ts): the lift's motor and its arrival, the
   * dryer's air, the hologram's hum and its forming and solving, the cradle's clack, a ring turned, the camera turning.
   * Built each frame, read right after.
   */
  readonly audible: SceneSound = { liftMove: 0, liftDing: false, liftStart: false, dryer: 0, hologramHum: 0, hologramOn: false, hologramSolved: false, cradleClack: false, ringTurn: false, cameraMove: 0, machineHum: 0 };
  /** The lift's way last frame, and whether it has struck the cradle or turned a ring since, so a change is heard once. */
  private liftDir = 0;
  private cradleAt = -1;
  private ringTurnedAt = -1;
  private solvedBefore = false;
  private hologramSeen = false;

  /** A spot was used: what it does in the scene (air from a dryer) starts. */
  used(spot: string, t: number): void {
    this.usedAt.set(spot, t);
  }
  private readonly dials: { now: number; was: number; at: number; waves: number; creep: number; crept: number; t: number }[] = [];

  /** Sprites named in `dynamic` are left out; the game draws them itself (the hero). */
  constructor(readonly scene: LoadedScene, private dynamic = new Set<string>()) {
    this.sync();
  }

  /** The view the steam and beacons were last read for: they are read again when it changes. */
  private syncedFor = -1;

  /** Read the scene's steam and beacons again, after they changed (in the scene editor), for the view on screen. */
  sync(view = this.syncedFor < 0 ? 1 : this.syncedFor): void {
    const vn = view >= 0.5 ? 'concierge' : 'raw';
    const d = this.scene.def, steam = d.steam.filter((e) => inViewOf(e.only, view)).map((e) => asIn(e, vn)), beacons = d.beacons.filter((b) => inViewOf(b.only, view)).map((b) => asIn(b, vn));
    this.syncedFor = view;
    // her cigarette: the first smoke on the street's own layer (a chimney's on a far layer stays where it is)
    this.smokeSlot = steam.findIndex((e) => e.kind === 'smoke' && (e.parallax ?? 1) === 1);
    this.beacons.fill(0);
    this.steam.fill(0);
    beacons.slice(0, 32).forEach((b, i) => this.beacons.set([b.x, b.y, b.phase, 1], i * 4));
    this.steamFar.fill(0);
    this.steamDefs = steam.slice(0, 4);
    this.steamDefs.forEach((e, i) => { this.steam.set([e.x, e.y, e.height, e.kind === 'smoke' ? -e.width : e.width], i * 4); this.steamFar[i] = (e.parallax ?? 1) < 1 ? 1 : 0; });
    this.nBeacons = Math.min(32, beacons.length);
    this.beaconDefs = beacons;
  }

  private nBeacons = 0;
  private beaconDefs: LoadedScene['def']['beacons'] = [];

  sprite(name: string) {
    const s = this.scene.sprites.find((x) => x.def.name === name);
    if (!s) throw new Error(`no sprite called ${name}`);
    return s;
  }

  /**
   * A mover where it is at time t, or nothing while it waits between passes. A pass takes it from just outside one end of
   * where it can be seen to just outside the other; the next one starts a wait later, the other way unless it keeps one.
   */
  private mover(k: number, now: number, cam: [number, number], parallax: number, view: 'raw' | 'concierge'): DrawSprite | null {
    const { def, sprite } = this.scene.movers![k], m: MoverDef = asIn(def, view), w = sprite.def.w, span = m.x1 - m.x0 + w;
    // its own clock: stopped while it is held, behind by as long as it has been held
    const held = this.held.get(def.asset), t = (held ? held.at : now) - (this.lag.get(def.asset) ?? 0);
    if (m.patrol) {
      // on its round: its body where it is, turned the way it walks; walking or resting. Held, it stands, turned to her
      const sd = sprite.def, p0 = patrolAt(t, m.x0, m.x1, m.speed, (m.wait[0] + m.wait[1]) / 2, m.stops);
      const p = held ? { ...p0, moving: false, dir: held.facing } : p0, ax = sd.anchor?.[0] ?? w / 2, flip = p.dir < 0 && !hasLeft(sd);
      const stride = sd.anims?.walk?.stride ?? sd.h * 0.6, bob = m.bob ? m.bob[0] * Math.sin((now * 2 * Math.PI) / Math.max(0.1, m.bob[1])) : 0;
      return {
        sprite, x: p.x - (flip ? w - ax : ax) - cam[0] * parallax, y: (m.y ?? sd.y) + bob - cam[1] * parallax, flip,
        frame: sd.frames ? frameFor(sd, p.moving, p.walked / stride, now, p.dir) : 0,
      };
    }
    // its stops, as far along a pass each way as its middle reaches them
    const stopsGoing = (dir: 1 | -1) => (m.stops ?? []).map((s) => ({ at: dir > 0 ? s.x - (m.x0 - w / 2) : m.x1 + w / 2 - s.x, seconds: s.seconds }))
      .filter((s) => s.at > 0 && s.at < span).sort((a, b) => a.at - b.at);
    const pause = (m.stops ?? []).reduce((sum, s) => sum + (s.x > m.x0 - w / 2 && s.x < m.x1 + w / 2 ? s.seconds : 0), 0);
    const dur = span / Math.max(1, m.speed) + pause, dirOf = (n: number): 1 | -1 => (m.dir ? m.dir : n % 2 ? -1 : 1);
    let p = this.passes[k];
    // the first pass soon after arriving, and again if the clock jumped (a tab left in the background, a reload)
    if (!p || t < p.from - m.wait[1] - dur || t > p.from + dur + m.wait[1] + 60) p = this.passes[k] = { from: t + between(m.wait) * 0.25, dir: dirOf(p?.n ?? 0), n: p?.n ?? 0 };
    while (t > p.from + dur) { p.n++; p.dir = dirOf(p.n); p.from += dur + between(m.wait); }
    if (t < p.from) return null;
    const run = travelled(t - p.from, Math.max(1, m.speed), stopsGoing(p.dir)), x = p.dir > 0 ? m.x0 - w + run : m.x1 - run;
    const bob = m.bob ? m.bob[0] * Math.sin((t * 2 * Math.PI) / Math.max(0.1, m.bob[1])) : 0;
    return {
      sprite, x: x - cam[0] * parallax, y: (m.y ?? sprite.def.y) + bob - cam[1] * parallax, flip: p.dir < 0,
      clip: [m.x0 - cam[0] * parallax, m.x1 - cam[0] * parallax],
    };
  }

  /** A mover's streaks of light where it is now: a thruster's back the way it came, a headlight's ahead; on its layer and what is behind it. */
  private lightsOf(m: MoverDef, d: DrawSprite, cam: [number, number], depth: number): void {
    for (const tr of m.lights ?? []) {
      if (this.nTrails >= 4) return;
      const ax = d.flip ? d.sprite.def.w - tr.at[0] : tr.at[0];
      this.trails.set([d.x + ax + cam[0], d.y + tr.at[1] + cam[1], (d.flip ? -1 : 1) * tr.length, (depth + 0.5) / 3], this.nTrails * 4);
      this.trailColours.set([tr.colour[0], tr.colour[1], tr.colour[2], (tr.width ?? 3) / 2], this.nTrails * 4);
      this.nTrails++;
    }
  }

  /** `actors` are drawn after the scene's sprites; `smoke` moves the scene's smoke emitter (the hero's cigarette). */
  frame(t: number, v: ViewState, cam: [number, number], actors: DrawSprite[] = [], smoke?: [number, number]): Frame {
    const d = this.scene.def, view = v.view >= 0.5 ? 1 : 0, viewName = view ? 'concierge' : 'raw';
    // what is only in one view comes and goes with it
    if (view !== this.syncedFor) this.sync(view);
    // where something on a layer of its own parallax seems to be, in the street's pixels: the renderer takes the camera off
    const along = (p = 1) => -cam[0] * (p - 1);
    this.steamDefs.forEach((e, i) => { this.steam[i * 4] = e.x + along(e.parallax); });
    if (smoke && this.smokeSlot >= 0) this.steam.set(smoke, this.smokeSlot * 4);
    // the set first, in the scene's order; then the people, the nearest last, so whoever stands nearer covers whoever is
    // behind; then anything nearer than them
    const isPerson = (def: SpriteDef) => def.actor ?? def.kind === 'character';
    const set: DrawSprite[] = [], people: DrawSprite[] = [], front: DrawSprite[] = [];
    this.nTrails = 0;
    this.scene.sprites.forEach((sprite, i) => {
      if (this.dynamic.has(sprite.def.name)) return;
      const def = sprite.def, facing = def.facing ?? 1;
      // a layer placed for one view only, or only while something holds: its movers go with it
      if (!inViewOf(def.only, view) || (def.when && !this.shown(def.when))) return;
      // a picture shown in turn: not at all, or fading in or out
      const opacity = def.show ? slideOpacity(def.show, t) : 1;
      if (opacity <= 0) return;
      // a character placed in the scene plays its idle loop, facing the way the scene says; placed elsewhere in this view,
      // it is drawn there
      const at = def.views?.[viewName];
      const draw = {
        sprite,
        x: (at?.x ?? def.x) - cam[0] * def.parallax,
        y: (at?.y ?? def.y) - cam[1] * def.parallax,
        flip: facing < 0 && !hasLeft(def),
        frame: def.frames ? frameFor(def, false, 0, t, facing) : 0,
        scale: isPerson(def) ? d.actorScale ?? 1 : 1,
        ...(opacity < 1 ? { opacity } : {}),
        // standing alive: breathing, swaying, turning its head now and then, each out of step with the others
        ...(def.alive ? { bends: bendsAt(def.alive, t, viewName, i + 1, hash(i + 1)) } : {}),
      };
      (isPerson(def) ? people : def.front ? front : set).push(draw);
      // what moves through the scene behind the nearer layers goes right after its own
      this.scene.movers?.forEach((m, k) => {
        if (m.after !== i || !inViewOf(m.def.only, view)) return;
        const md = this.mover(k, t, cam, def.parallax, viewName);
        if (md) { set.push(md); this.lightsOf(asIn(m.def, viewName), md, cam, def.depth); this.moverBoxes.set(m.def.asset, [md.x + cam[0] * def.parallax, md.y + cam[1] * def.parallax, md.sprite.def.w, md.sprite.def.h]); }
        else this.moverBoxes.delete(m.def.asset);
      });
    });
    // flat layers over the first one blend their edges, so a moving camera slides them smoothly; it has set the flags
    // every flat layer shares. With anything else in the set, all of it stays cut out
    const flat = (s: DrawSprite) => smoothSampled(s.sprite.def) && !s.sprite.hasMeta;
    if (set.length > 1 && set.every(flat)) for (const s of set.slice(1)) s.blend = true;
    people.push(...actors);
    const foot = (d: DrawSprite) => d.y + d.sprite.def.h * (d.scale ?? 1);
    people.sort((a, b) => foot(a) - foot(b));
    const sprites = [...set, ...people, ...front];
    // a shadow on the ground under each of them, centred under the feet (the anchor), as wide as their footprint
    this.shadows.fill(0);
    let nShadows = 0;
    for (const d of people) {
      const def = d.sprite.def, sc = d.scale ?? 1, ax = def.anchor?.[0] ?? def.w / 2, half = (def.footprint ?? def.w * 0.3) * sc;
      if (half <= 0 || nShadows >= 8) continue;
      this.shadows.set([d.x + (d.flip ? def.w - ax : ax) * sc, foot(d), half, 0], nShadows++ * 4);
    }
    let nCars = 0;
    const tr = d.traffic;
    if (tr) {
      tr.lanes.forEach((y, li) => {
        for (let j = 0; j < tr.perLane && nCars < 16; j++) {
          const vel = (li % 2 ? -1 : 1) * (40 + li * 9), off = j * 140 + li * 47;
          const x = tr.x0 + ((((off + t * vel) % tr.span) + tr.span) % tr.span);
          this.cars.set([x + along(tr.parallax), y + Math.sin(t + off) * 1.5, Math.sign(vel), 26], nCars++ * 4);
        }
      });
    }
    this.godrays.fill(0);
    d.godrays.slice(0, 4).forEach((g0, i) => { const g = asIn(g0, viewName); this.godrays.set([g.x + along(g.parallax), g.y, inViewOf(g.only ?? (g.ar ? 'concierge' : undefined), view) ? g.strength : 0, g.zone], i * 4); });
    this.beaconDefs.slice(0, 32).forEach((b, i) => { this.beacons[i * 4] = b.x + along(b.parallax); });
    // an oscilloscope's line: the shape its knob is at, turning into it from the one before; its speed, eased to
    this.scopes.fill(0);
    let nScopes = 0;
    (d.scopes ?? []).forEach((sc, i) => {
      if (nScopes >= 2 || !inViewOf(sc.only, view) || (sc.when && !this.shown(sc.when))) return;
      const dial = sc.wave === undefined ? undefined : this.read(sc.wave), knob = sc.speed === undefined ? undefined : this.read(sc.speed);
      const shape = 1 + Math.max(0, WAVES.indexOf((WAVES as readonly unknown[]).includes(dial) ? (dial as (typeof WAVES)[number]) : sc.shape ?? 'sine'));
      const pace = SPEEDS[typeof knob === 'string' && knob in SPEEDS ? (knob as Speed) : sc.pace ?? 'slow'];
      const at = (this.dials[i] ??= { now: shape, was: shape, at: -10, waves: pace.waves, creep: pace.creep, crept: 0.1 + i * 0.37, t });
      if (at.now !== shape) { at.was = at.now; at.now = shape; at.at = t; }
      const dt = Math.min(0.1, Math.max(0, t - at.t)), ease = 1 - Math.exp(-dt * 6);
      at.t = t;
      at.waves += (pace.waves - at.waves) * ease;
      at.creep += (pace.creep - at.creep) * ease;
      at.crept = (at.crept + at.creep * dt) % 1;
      // a round glass, or a screen with corners; its line's colour in each view
      const round = sc.w === undefined || sc.h === undefined, hw = round ? sc.r ?? 0 : sc.w! / 2, hh = round ? sc.r ?? 0 : sc.h! / 2;
      const raw = sc.colours?.raw ?? [0.36, 0.95, 0.42], conc = sc.colours?.concierge ?? [0.27, 0.9, 0.97];
      this.scopes.set([
        sc.x + along(sc.parallax), sc.y, hw, shape, at.was, Math.min(1, Math.max(0, (t - at.at) / 0.35)), at.crept, at.waves,
        hh, round ? 1 : 0, raw[0], raw[1], raw[2], conc[0], conc[1], conc[2],
      ], nScopes++ * 16);
    });
    // a clock's hands: where it is, and the time of day
    this.clocks.fill(0);
    let nClocks = 0;
    for (const ck of d.clocks ?? []) {
      if (nClocks >= 2 || !inViewOf(ck.only, view) || (ck.when && !this.shown(ck.when))) continue;
      this.clocks.set([ck.x + along(ck.parallax), ck.y, ck.r, 1], nClocks++ * 4);
    }
    // what is worth hearing this frame, filled as each effect is worked out below
    const snd = this.audible;
    snd.liftDing = snd.liftStart = snd.hologramOn = snd.hologramSolved = snd.cradleClack = snd.ringTurn = false;
    snd.liftMove = snd.dryer = snd.hologramHum = snd.cameraMove = snd.machineHum = 0;
    // a scope on a bench (not a knob she turns): the place has working electronics, a faint hum — kept low, it is only
    // a sign of the room, well under the scene
    if ((d.scopes ?? []).some((s) => inViewOf(s.only, view) && !(s.when && !this.shown(s.when)))) snd.machineHum = 0.3;
    // a Newton's cradle: a swing as her count of them goes up (none for the count she arrives with), from alternate ends
    this.cradle.fill(0);
    const cr = (d.cradles ?? [])[0];
    if (cr && inViewOf(cr.only, view) && !(cr.when && !this.shown(cr.when))) {
      const n = cr.swings === undefined ? 0 : Number(this.read(cr.swings)) || 0;
      if (!this.swung) this.swung = { count: n, at: -100, side: 1 };
      else if (n !== this.swung.count) this.swung = { count: n, at: t, side: n % 2 ? 1 : -1 };
      const dx = along(cr.parallax), posts = cr.posts ?? [0, 0, 0, 0];
      this.cradle.set([cr.x + dx, cr.y, cr.gap, cr.length, cr.r, t - this.swung.at, this.swung.side, 1, posts[0] + dx, posts[1] + dx, posts[2] + dx, posts[3] + dx]);
      // a ball is let go the moment the count changes, and again each time it strikes the other end (its period ~0.9 s)
      if (this.swung.at > 0 && this.swung.at !== this.cradleAt) { snd.cradleClack = true; this.cradleAt = this.swung.at; }
    }
    // the lift's displays: its floor in figures, an arrow while it moves
    this.indicators.fill(0);
    let nIndicators = 0;
    const lift = (d.indicators ?? []).length ? this.lift(t) : null;
    for (const ind of d.indicators ?? []) {
      if (nIndicators >= 4 || !lift || !inViewOf(ind.only, view) || (ind.when && !this.shown(ind.when))) continue;
      const label = floorLabel(lift.floor), raw = ind.colours?.raw ?? [1, 0.62, 0.22], conc = ind.colours?.concierge ?? [0.72, 0.93, 1];
      this.indicators.set([ind.x + along(ind.parallax), ind.y, ind.w, ind.h, label.length > 1 ? SEGMENTS[label[0]] ?? 0 : 0, SEGMENTS[label[label.length - 1]] ?? 0, lift.dir, 0, ...raw, 0, ...conc, 0], nIndicators++ * 16);
    }
    if (lift) {
      // its motor while it moves (fuller the more of its displays she sees), a ding as it stops, a start as it leaves
      snd.liftMove = lift.dir !== 0 ? Math.min(1, 0.6 + 0.2 * nIndicators) : 0;
      if (lift.dir === 0 && this.liftDir !== 0) snd.liftDing = true;
      if (lift.dir !== 0 && this.liftDir === 0) snd.liftStart = true;
      this.liftDir = lift.dir;
    }
    // a camera turns, slowly, to where her head is
    this.cameras.fill(0);
    let nCameras = 0;
    const turn = Math.min(1, Math.max(0, t - this.aimedAt) * 1.8);
    this.aimedAt = t;
    (d.cameras ?? []).forEach((cam, i) => {
      if (nCameras >= 2 || !inViewOf(cam.only, view) || (cam.when && !this.shown(cam.when))) return;
      const x = cam.x + along(cam.parallax), want = this.lookAt ? Math.atan2(this.lookAt[1] - cam.y, this.lookAt[0] - x) : Math.PI / 2;
      const aim = Math.max(0.3, Math.min(Math.PI - 0.3, want)), was = this.aims[i] ?? aim;
      this.aims[i] = was + (aim - was) * turn;
      this.cameras.set([x, cam.y, cam.size ?? 1, this.aims[i]], nCameras++ * 4);
      // the servo while it is swinging round: louder the faster it moves
      snd.cameraMove = Math.max(snd.cameraMove, Math.min(1, Math.abs(aim - was) * 12));
    });
    // air from an outlet, a while after its spot was used
    this.airs.fill(0);
    let nAirs = 0;
    for (const air of d.airs ?? []) {
      if (nAirs >= 2 || !inViewOf(air.only, view) || (air.when && !this.shown(air.when))) continue;
      const at = this.usedAt.get(air.spot);
      this.airs.set([air.x + along(air.parallax), air.y, air.w, at === undefined ? -1 : t - at], nAirs++ * 4);
      // the air blows for about 2.8 s, dying away over the last of it
      if (at !== undefined) { const since = t - at; snd.dryer = Math.max(snd.dryer, since < 0 || since > 2.8 ? 0 : Math.min(1, (2.8 - since) / 0.6)); }
    }
    // a hologram of rings: each turns the way the story turned it, a sixth at a time, the short way round when it jumps
    this.rings.fill(0);
    const rg = (d.rings ?? [])[0];
    if (rg && inViewOf(rg.only, view) && !(rg.when && !this.shown(rg.when))) {
      const sixth = Math.PI / 3, values = rg.turns.map((n) => ((Math.round(Number(this.read(n)) || 0) % 6) + 6) % 6), solved = rg.solved !== undefined && !!this.read(rg.solved);
      if (!this.ringState) this.ringState = { value: values, target: values.map((v) => v * sixth), shown: values.map((v) => v * sixth), solvedAt: solved ? t - 10 : -1, t };
      const st = this.ringState, dt = Math.min(0.1, Math.max(0, t - st.t)), ease = 1 - Math.exp(-dt * 10);
      st.t = t;
      values.forEach((v, k) => {
        const step = (((v - st.value[k]) % 6) + 6) % 6;
        if (step) st.target[k] += (step <= 3 ? step : step - 6) * sixth;
        st.value[k] = v;
        st.shown[k] += (st.target[k] - st.shown[k]) * ease;
      });
      if (solved && st.solvedAt < 0) st.solvedAt = t;
      if (!solved) st.solvedAt = -1;
      this.rings.set([rg.x + along(rg.parallax), rg.y, rg.r, 1, st.shown[0], st.shown[1], st.shown[2], st.solvedAt < 0 ? -1 : t - st.solvedAt]);
      // its quiet hum while it floats; a ring turned (its shown turn still easing to its target); the chime as it solves
      snd.hologramHum = 1;
      if (values.some((_, k) => Math.abs(st.target[k] - st.shown[k]) > 0.02) && t - this.ringTurnedAt > 0.25) { snd.ringTurn = true; this.ringTurnedAt = t; }
      if (solved && !this.solvedBefore) snd.hologramSolved = true;
      this.solvedBefore = solved;
      // as it first comes into view, a chord: the rings forming
      if (!this.hologramSeen) { snd.hologramOn = true; this.hologramSeen = true; }
    } else this.hologramSeen = false;
    const dr = d.drips;
    return {
      t,
      view: v.view,
      glitch: switchFade(v.view, v.sinceSwitch),
      cam,
      level: d.size,
      zone: this.scene.zone,
      sprites,
      // each light with its preset and as it is in this view, and on a far layer where that layer is
      lights: d.lights.filter((placed) => !placed.when || this.shown(placed.when)).map((placed) => {
        let l = resolveLight(placed, viewName);
        // a pulse: its strength by turns, in step with a sprite's frames
        if (l.pulse) l = { ...l, i: (l.i ?? 1) * pulseAt(l.pulse, t) };
        return (l.parallax ?? 1) === 1 ? l : { ...l, x: l.x + along(l.parallax) };
      }),
      gi: lightGroups(t),
      cars: this.cars,
      nCars,
      trails: this.trails,
      trailColours: this.trailColours,
      nTrails: this.nTrails,
      beacons: this.beacons,
      nBeacons: this.nBeacons,
      steam: this.steam,
      steamFar: this.steamFar,
      godrays: this.godrays,
      scopes: this.scopes,
      nScopes,
      clocks: this.clocks,
      nClocks,
      cradle: this.cradle,
      rings: this.rings,
      indicators: this.indicators,
      nIndicators,
      cameras: this.cameras,
      nCameras,
      airs: this.airs,
      nAirs,
      daySeconds: this.daySeconds(t),
      drips: dr ? [dr.x0, dr.x1, dr.top, dr.bottom] : [0, 0, 0, 0],
      mirror: d.mirror,
      ground: d.ground,
      ambient: typeof d.ambient === 'object' ? (d.ambient.raw ?? 1) + ((d.ambient.concierge ?? 1) - (d.ambient.raw ?? 1)) * v.view : d.ambient,
      exposure: typeof d.exposure === 'object' ? (d.exposure.raw ?? 0) + ((d.exposure.concierge ?? 0) - (d.exposure.raw ?? 0)) * v.view : d.exposure,
      baked: typeof d.baked === 'object' ? (d.baked.raw ?? 0) + ((d.baked.concierge ?? 0) - (d.baked.raw ?? 0)) * v.view : d.baked,
      shadows: this.shadows,
      nShadows,
    };
  }
}
