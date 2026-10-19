// Choosing animation frames.

import type { SpriteDef } from '../engine/assets';

/** Whether the sprite has frames of its own for facing left; if not, it is drawn mirrored. */
export const hasLeft = (def: SpriteDef): boolean => !!(def.anims?.walkLeft || def.anims?.idleLeft);

/**
 * The frame to draw. Moving, the walk cycle (the run's, running, where the sprite has one) follows the distance covered,
 * so the planted foot does not slide. Standing, the idle loop plays on the clock (t, in seconds), in its own order if it
 * has one. Facing left (facing < 0), the left-facing runs are used where the sprite has them.
 */
export function frameFor(def: SpriteDef, moving: boolean, walked: number, t: number, facing = 1, running = false): number {
  const left = facing < 0 && hasLeft(def);
  const run = running ? def.anims?.[left ? 'runLeft' : 'run'] : undefined;
  const walk = run?.stride ? run : def.anims?.[left ? 'walkLeft' : 'walk'], idle = def.anims?.[left ? 'idleLeft' : 'idle'];
  if (moving && walk?.stride) return walk.from + (Math.floor((walked / walk.stride) * walk.count) % walk.count);
  if (!idle) return 0;
  const step = Math.floor(t * (idle.fps ?? 0));
  return idle.from + (idle.seq ? idle.seq[step % idle.seq.length] : step % idle.count);
}
