// Choosing animation frames.

import type { SpriteDef } from '../engine/assets';
import type { Gait } from './level';

/** Whether the sprite has frames of its own for facing left; if not, it is drawn mirrored. */
export const hasLeft = (def: SpriteDef): boolean => !!(def.anims?.walkLeft || def.anims?.idleLeft);

/**
 * The frame to draw. Moving, the cycle of her gait (the walk's where the sprite has none of its own) at `cycles`, how far
 * through it she is, which follows the ground covered, so a planted foot does not slide. Standing, the idle loop plays
 * on the clock (t, in seconds), in its own order if it has one. Facing left (facing < 0), the left-facing runs are used
 * where the sprite has them.
 */
export function frameFor(def: SpriteDef, moving: boolean, cycles: number, t: number, facing = 1, gait: Gait = 'walk'): number {
  const left = facing < 0 && hasLeft(def), anim = (name: string) => def.anims?.[left ? `${name}Left` : name];
  const own = anim(gait), cycle = own?.stride ? own : anim('walk'), idle = anim('idle');
  if (moving && cycle?.stride) return cycle.from + (Math.floor((((cycles % 1) + 1) % 1) * cycle.count) % cycle.count);
  if (!idle) return 0;
  const step = Math.floor(t * (idle.fps ?? 0));
  return idle.from + (idle.seq ? idle.seq[step % idle.seq.length] : step % idle.count);
}
