// Her front and back. Seen from the side as she walks, she turns: her back to us as she goes in at a door, to us as
// she comes out of one or has changed what she wears, and to us when she has stood still a while; each until she
// moves, side on while she talks. Only where her sprite has the frames (front, back); without them she stays side on.

import type { SpriteDef } from '../engine/assets';
import { blinking } from './anim';

export type Pose = 'front' | 'back';

/** How long she stands still before she turns to us, in seconds. */
export const TURN_AFTER = 6;

/**
 * Whether a way is a door, in a wall we look at as every door is drawn (a shop front, the back wall of a room or a
 * corridor, a lift), which she goes in at with her back to us and comes out of facing us; or an end of the street,
 * reaching the scene's edge, which she walks off side on.
 */
export function isDoor(rect: readonly [number, number, number, number], width: number): boolean {
  return rect[0] > 2 && rect[0] + rect[2] < width - 2;
}

/** How she stands at `t`: going in at a door, come out of one (`out`, until she moves), or still since `stillSince`. */
export function poseAt(t: number, s: { going: boolean; moving: boolean; talking: boolean; out: boolean; stillSince: number }): Pose | null {
  if (s.going) return 'back';
  if (s.moving || s.talking) return null;
  return s.out || t - s.stillSince >= TURN_AFTER ? 'front' : null;
}

/** Her frame for a pose, where her sprite has one; facing us at `t`, she blinks now and then where it has her blink. */
export function poseFrame(def: SpriteDef, pose: Pose | null, t = 0): number | null {
  const anim = pose ? def.anims?.[pose] : undefined, blink = pose === 'front' ? def.anims?.blinkFront : undefined;
  if (!anim) return null;
  return blink && blinking(t) ? blink.from : anim.from;
}
