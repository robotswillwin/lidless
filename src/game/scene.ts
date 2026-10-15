// Turns a loaded scene plus the current state into a frame for the renderer.

import type { LoadedScene } from '../engine/assets';
import type { DrawSprite, Frame } from '../engine/renderer';

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

export class SceneRunner {
  private cars = new Float32Array(64);
  private beacons = new Float32Array(128);
  private steam = new Float32Array(16);
  private godrays = new Float32Array(16);

  constructor(readonly scene: LoadedScene) {
    const d = scene.def;
    d.beacons.slice(0, 32).forEach((b, i) => this.beacons.set([b.x, b.y, b.phase, 1], i * 4));
    d.steam.slice(0, 4).forEach((e, i) => this.steam.set([e.x, e.y, e.height, e.kind === 'smoke' ? -e.width : e.width], i * 4));
  }

  frame(t: number, v: ViewState, cam: [number, number]): Frame {
    const d = this.scene.def;
    const sprites: DrawSprite[] = this.scene.sprites.map((sprite) => ({
      sprite,
      x: Math.round(sprite.def.x - cam[0] * sprite.def.parallax),
      y: Math.round(sprite.def.y - cam[1] * sprite.def.parallax),
    }));
    let nCars = 0;
    const tr = d.traffic;
    if (tr) {
      tr.lanes.forEach((y, li) => {
        for (let j = 0; j < tr.perLane && nCars < 16; j++) {
          const vel = (li % 2 ? -1 : 1) * (40 + li * 9), off = j * 140 + li * 47;
          const x = tr.x0 + ((((off + t * vel) % tr.span) + tr.span) % tr.span);
          this.cars.set([x, y + Math.sin(t + off) * 1.5, Math.sign(vel), 26], nCars++ * 4);
        }
      });
    }
    this.godrays.fill(0);
    d.godrays.slice(0, 4).forEach((g, i) => this.godrays.set([g.x, g.y, g.ar ? g.strength * v.view : g.strength, g.zone], i * 4));
    const dr = d.drips;
    return {
      t,
      view: v.view,
      glitch: Math.max(0, 1 - v.sinceSwitch / 0.45),
      cam,
      level: d.size,
      zone: this.scene.zone,
      sprites,
      lights: d.lights,
      gi: lightGroups(t),
      cars: this.cars,
      nCars,
      beacons: this.beacons,
      nBeacons: Math.min(32, d.beacons.length),
      steam: this.steam,
      godrays: this.godrays,
      drips: dr ? [dr.x0, dr.x1, dr.top, dr.bottom] : [0, 0, 0, 0],
      mirror: d.mirror,
    };
  }
}
