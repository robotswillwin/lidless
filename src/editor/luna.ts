// Luna in the editor, to judge the light on: standing where she is put, or, following the pointer, walking, jogging or
// running to it along the walk line as she would in the game, at her gaits' speeds in this scene.

import { frameFor } from '../game/anim';
import { heroGaits, paceFor } from '../game/hero';
import type { LevelDef } from '../game/level';
import { World } from '../game/world';
import { ed } from './state';

let moving: { world: World; key: string } | null = null;
let goal: number | null = null;

/** The world she moves in: made again when the scene, its walk line or the size of its people change. */
function world(): World {
  const f = ed.file, sc = f.actorScale ?? 1, key = `${f.id}:${f.walk.x0}:${f.walk.x1}:${f.walk.y}:${sc}`;
  if (!moving || moving.key !== key) {
    const gaits = ed.hero ? heroGaits(ed.hero.def, ed.world.hero, sc) : {};
    const level: LevelDef = { walk: f.walk, hero: { sprite: ed.world.hero.sprite, x: ed.luna.x, speed: gaits.walk?.speed ?? ed.world.hero.speed * Math.sqrt(sc), gaits }, hotspots: [] };
    moving = { world: new World(level, ed.luna.x, ed.luna.facing), key };
    goal = null;
  }
  return moving.world;
}

/** The pointer is at x: she heads there, as fast as she would go that far in the game. */
export function steerLuna(x: number): void {
  if (!ed.hero) return;
  const w = world(), tall = ed.hero.def.h * (ed.file.actorScale ?? 1);
  goal = x;
  w.walkTo(x, null, paceFor(Math.abs(x - w.heroX), ed.world.hero, tall));
}

/** Her frame now, moving her on by dt seconds if she follows the pointer. */
export function lunaFrame(t: number, dt: number): number {
  const def = ed.hero!.def;
  if (!ed.luna.track) {
    // standing where she is put; following again starts from there
    moving = null;
    return frameFor(def, false, 0, t, ed.luna.facing);
  }
  const w = world();
  if (!w.moving && goal === null) w.heroX = ed.luna.x;
  w.update(Math.min(0.05, dt));
  ed.luna.x = Math.round(w.heroX);
  ed.luna.facing = w.facing;
  return frameFor(def, w.moving, w.phase, t, w.facing, w.gait);
}
