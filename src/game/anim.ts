// Choosing animation frames.

import type { SpriteDef } from '../engine/assets';
import type { Gait } from './level';

/** Whether the sprite has frames of its own for facing left; if not, it is drawn mirrored. */
export const hasLeft = (def: SpriteDef): boolean => !!(def.anims?.walkLeft || def.anims?.idleLeft);

/** A blink, in seconds; the moments one may come in, each this long; and how often one does, about every 3.5 seconds. */
const BLINK = 0.15, SLOT = 0.6, CHANCE = 0.17;

/** A number from 0 to 1 for each whole number, the same every time, with no pattern to see. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Whether her eye is shut at `t` (in seconds): a quick blink now and then, never on a beat, the same for the same t. */
export function blinking(t: number): boolean {
  const slot = Math.floor(t / SLOT), h = hash(slot);
  if (h >= CHANCE) return false;
  const start = (h / CHANCE) * (SLOT - BLINK), into = t - slot * SLOT;
  return into >= start && into < start + BLINK;
}

/**
 * The frame to draw. Moving, the cycle of her gait (the walk's where the sprite has none of its own) at `cycles`, how far
 * through it she is, which follows the ground covered, so a planted foot does not slide. Standing, the idle loop plays
 * on the clock (t, in seconds), in its own order if it has one. Facing left (facing < 0), the left-facing runs are used
 * where the sprite has them; standing so, she blinks now and then where it has her eye shut in each of them (blinkLeft).
 */
export function frameFor(def: SpriteDef, moving: boolean, cycles: number, t: number, facing = 1, gait: Gait = 'walk'): number {
  const left = facing < 0 && hasLeft(def), anim = (name: string) => def.anims?.[left ? `${name}Left` : name];
  const own = anim(gait), cycle = own?.stride ? own : anim('walk'), idle = anim('idle');
  if (moving && cycle?.stride) return cycle.from + (Math.floor((((cycles % 1) + 1) % 1) * cycle.count) % cycle.count);
  if (!idle) return 0;
  const step = Math.floor(t * (idle.fps ?? 0)), blink = left ? def.anims?.blinkLeft : undefined;
  const from = blink?.count === idle.count && blinking(t) ? blink.from : idle.from;
  return from + (idle.seq ? idle.seq[step % idle.seq.length] : step % idle.count);
}
