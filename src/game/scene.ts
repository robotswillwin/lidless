// Turns a loaded scene plus the current state into a frame for the renderer.

import type { LoadedScene, MoverDef, SpriteDef } from '../engine/assets';
import type { DrawSprite, Frame } from '../engine/renderer';
import { frameFor, hasLeft } from './anim';

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


/** A mover's current pass: when it starts (or started), which way it goes, how many passes came before it. */
interface Pass { from: number; dir: 1 | -1; n: number }

const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);

export class SceneRunner {
  private passes: Pass[] = [];
  private cars = new Float32Array(64);
  private beacons = new Float32Array(128);
  private steam = new Float32Array(16);
  private godrays = new Float32Array(16);
  private shadows = new Float32Array(32);
  private smokeSlot: number;

  /** Sprites named in `dynamic` are left out; the game draws them itself (the hero). */
  constructor(readonly scene: LoadedScene, private dynamic = new Set<string>()) {
    const d = scene.def;
    this.smokeSlot = d.steam.findIndex((e) => e.kind === 'smoke');
    d.beacons.slice(0, 32).forEach((b, i) => this.beacons.set([b.x, b.y, b.phase, 1], i * 4));
    d.steam.slice(0, 4).forEach((e, i) => this.steam.set([e.x, e.y, e.height, e.kind === 'smoke' ? -e.width : e.width], i * 4));
  }

  sprite(name: string) {
    const s = this.scene.sprites.find((x) => x.def.name === name);
    if (!s) throw new Error(`no sprite called ${name}`);
    return s;
  }

  /**
   * A mover where it is at time t, or nothing while it waits between passes. A pass takes it from just outside one end of
   * where it can be seen to just outside the other; the next one starts a wait later, the other way unless it keeps one.
   */
  private mover(k: number, t: number, cam: [number, number], parallax: number): DrawSprite | null {
    const { def, sprite } = this.scene.movers![k], m: MoverDef = def, w = sprite.def.w;
    const dur = (m.x1 - m.x0 + w) / Math.max(1, m.speed), dirOf = (n: number): 1 | -1 => (m.dir ? m.dir : n % 2 ? -1 : 1);
    let p = this.passes[k];
    // the first pass soon after arriving, and again if the clock jumped (a tab left in the background, a reload)
    if (!p || t < p.from - m.wait[1] - dur || t > p.from + dur + m.wait[1] + 60) p = this.passes[k] = { from: t + between(m.wait) * 0.25, dir: dirOf(p?.n ?? 0), n: p?.n ?? 0 };
    while (t > p.from + dur) { p.n++; p.dir = dirOf(p.n); p.from += dur + between(m.wait); }
    if (t < p.from) return null;
    const run = (t - p.from) * m.speed, x = p.dir > 0 ? m.x0 - w + run : m.x1 - run;
    return {
      sprite, x: x - cam[0] * parallax, y: (m.y ?? sprite.def.y) - cam[1] * parallax, flip: p.dir < 0,
      clip: [m.x0 - cam[0] * parallax, m.x1 - cam[0] * parallax],
    };
  }

  /** `actors` are drawn after the scene's sprites; `smoke` moves the scene's smoke emitter (the hero's cigarette). */
  frame(t: number, v: ViewState, cam: [number, number], actors: DrawSprite[] = [], smoke?: [number, number]): Frame {
    const d = this.scene.def;
    if (smoke && this.smokeSlot >= 0) this.steam.set(smoke, this.smokeSlot * 4);
    // where something on a layer of its own parallax seems to be, in the street's pixels: the renderer takes the camera off
    const along = (p = 1) => -cam[0] * (p - 1);
    // the set first, in the scene's order; then the people, the nearest last, so whoever stands nearer covers whoever is
    // behind; then anything nearer than them
    const isPerson = (def: SpriteDef) => def.actor ?? def.kind === 'character';
    const set: DrawSprite[] = [], people: DrawSprite[] = [], front: DrawSprite[] = [];
    this.scene.sprites.forEach((sprite, i) => {
      if (this.dynamic.has(sprite.def.name)) return;
      const def = sprite.def, facing = def.facing ?? 1;
      // a character placed in the scene plays its idle loop, facing the way the scene says
      const draw = {
        sprite,
        x: def.x - cam[0] * def.parallax,
        y: def.y - cam[1] * def.parallax,
        flip: facing < 0 && !hasLeft(def),
        frame: def.frames ? frameFor(def, false, 0, t, facing) : 0,
        scale: isPerson(def) ? d.actorScale ?? 1 : 1,
      };
      (isPerson(def) ? people : def.front ? front : set).push(draw);
      // what moves through the scene behind the nearer layers goes right after its own
      this.scene.movers?.forEach((m, k) => { if (m.after === i) { const md = this.mover(k, t, cam, def.parallax); if (md) set.push(md); } });
    });
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
    d.godrays.slice(0, 4).forEach((g, i) => this.godrays.set([g.x + along(g.parallax), g.y, g.ar ? g.strength * v.view : g.strength, g.zone], i * 4));
    d.beacons.slice(0, 32).forEach((b, i) => { this.beacons[i * 4] = b.x + along(b.parallax); });
    const dr = d.drips;
    return {
      t,
      view: v.view,
      glitch: switchFade(v.view, v.sinceSwitch),
      cam,
      level: d.size,
      zone: this.scene.zone,
      sprites,
      lights: d.lights.some((l) => (l.parallax ?? 1) !== 1) ? d.lights.map((l) => ((l.parallax ?? 1) === 1 ? l : { ...l, x: l.x + along(l.parallax) })) : d.lights,
      gi: lightGroups(t),
      cars: this.cars,
      nCars,
      beacons: this.beacons,
      nBeacons: Math.min(32, d.beacons.length),
      steam: this.steam,
      godrays: this.godrays,
      drips: dr ? [dr.x0, dr.x1, dr.top, dr.bottom] : [0, 0, 0, 0],
      mirror: d.mirror,
      ambient: typeof d.ambient === 'object' ? (d.ambient.raw ?? 1) + ((d.ambient.concierge ?? 1) - (d.ambient.raw ?? 1)) * v.view : d.ambient,
      exposure: typeof d.exposure === 'object' ? (d.exposure.raw ?? 0) + ((d.exposure.concierge ?? 0) - (d.exposure.raw ?? 0)) * v.view : d.exposure,
      baked: typeof d.baked === 'object' ? (d.baked.raw ?? 0) + ((d.baked.concierge ?? 0) - (d.baked.raw ?? 0)) * v.view : d.baked,
      shadows: this.shadows,
      nShadows,
    };
  }
}
