// Choosing animation frames.

import type { SpriteDef } from '../engine/assets';

/**
 * The frame to draw. Moving, the walk cycle follows the distance walked, so the planted foot does not slide. Standing,
 * the idle loop plays on the clock (t, in seconds), in its own order if it has one.
 */
export function frameFor(def: SpriteDef, moving: boolean, walked: number, t: number): number {
  const walk = def.anims?.walk, idle = def.anims?.idle;
  if (moving && walk?.stride) return walk.from + (Math.floor((walked / walk.stride) * walk.count) % walk.count);
  if (!idle) return 0;
  const step = Math.floor(t * (idle.fps ?? 0));
  return idle.from + (idle.seq ? idle.seq[step % idle.seq.length] : step % idle.count);
}
