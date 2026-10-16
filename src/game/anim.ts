// Choosing animation frames.

import type { SpriteDef } from '../engine/assets';

/** The frame to draw: while moving, the walk cycle by distance walked, so the planted foot does not slide; else idle. */
export function frameFor(def: SpriteDef, moving: boolean, walked: number): number {
  const walk = def.anims?.walk, idle = def.anims?.idle;
  if (moving && walk?.stride) return walk.from + (Math.floor((walked / walk.stride) * walk.count) % walk.count);
  return idle?.from ?? 0;
}
