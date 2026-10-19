// Where the hero is drawn: the game and the scene editor place her the same way.

import type { Sprite } from '../engine/assets';
import type { DrawSprite } from '../engine/renderer';
import { hasLeft } from './anim';

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
