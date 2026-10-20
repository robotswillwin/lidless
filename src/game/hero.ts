// Where the hero is drawn: the game and the scene editor place her the same way.

import type { Sprite, SpriteDef } from '../engine/assets';
import type { DrawSprite } from '../engine/renderer';
import { hasLeft } from './anim';
import type { Gait, LevelDef } from './level';
import type { WorldFile } from './scenefile';

export interface HeroPlace {
  /** Her feet's x in the scene, and the walk line's y. */
  x: number;
  walkY: number;
  cam: [number, number];
  /** The scene's actorScale: smaller where the camera is further back. */
  scale: number;
  facing: 1 | -1;
  /** Up and down as she steps, in level pixels at her size. */
  bob?: number;
  frame: number;
}

/**
 * Her sprite on screen: her feet (the sprite's anchor) on the walk line at x, at the scene's scale. Facing left she uses
 * the sprite's own left-facing frames, or its right-facing ones mirrored.
 */
export function heroDrawing(sprite: Sprite, p: HeroPlace): DrawSprite {
  const def = sprite.def, [ax, ay] = def.anchor ?? [def.w / 2, def.h], flip = p.facing < 0 && !hasLeft(def);
  return {
    sprite,
    x: p.x - p.cam[0] - (flip ? def.w - ax : ax) * p.scale,
    y: Math.round(p.walkY - p.cam[1] - ay * p.scale + (p.bob ?? 0)),
    flip,
    scale: p.scale,
    frame: p.frame,
  };
}

/**
 * Each gait her sprite has frames for, at her size in a scene: its speed, its stride at a cadence (strides a second,
 * world.json's; a jog and a run by default 1.3 and 1.45 times the walk's), and how far a cycle carries her, so a foot
 * stays where it lands.
 */
export function heroGaits(def: SpriteDef, hero: WorldFile['hero'], scale: number): NonNullable<LevelDef['hero']['gaits']> {
  const cadence = { walk: hero.cadence, jog: hero.jogCadence ?? (hero.cadence && hero.cadence * 1.3), run: hero.runCadence ?? (hero.cadence && hero.cadence * 1.45) };
  const gaits: NonNullable<LevelDef['hero']['gaits']> = {};
  for (const g of ['walk', 'jog', 'run'] as const) {
    const stride = def.anims?.[g]?.stride, c = cadence[g];
    if (stride && c) gaits[g] = { speed: c * stride * scale, stride: stride * scale };
  }
  return gaits;
}

/** How fast she may go to get somewhere `distance` away: walking, jogging past a few of her heights, running past twice that. */
export function paceFor(distance: number, hero: WorldFile['hero'], tall: number): Gait {
  return distance > (hero.runFrom ?? 5) * tall ? 'run' : distance > (hero.jogFrom ?? 2.5) * tall ? 'jog' : 'walk';
}
