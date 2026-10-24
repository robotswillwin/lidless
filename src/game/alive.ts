// Standing alive, drawn live (decision 44): a character placed in a scene breathes, sways, and now and then turns its
// head, nods off, taps a foot or swirls its glass; Luna, turned to us, does the same. No frames: the sprite shader bends
// each part of the picture about its joint (`alive` in shaders.ts); here, how far each part is turned and raised now.

import { MOVES, type AlivePart, type Move, type Only } from '../engine/assets';
import { hash } from './anim';

/** How many parts of one character the sprite shader bends. */
export const MAX_PARTS = 6;
/** Seconds: a breath, a sway, between glances, a doze, between fidgets. */
const EVERY: Record<Move, number> = { breathe: 4.4, sway: 9, glance: 5, doze: 14, fidget: 8 };
/** How softly a part fades out: a round part over half its radius, everything above a joint over this many pixels. */
const SOFT = 30;
const TAU = Math.PI * 2, RAD = Math.PI / 180, STILL = { angle: 0, lift: 0 };
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

/**
 * How far a part is turned (radians) and raised (pixels) `t` seconds in. `seed` keeps two characters out of step;
 * `phase` (0 to 1) is how far into its first breath, sway or glance it is at 0: with none, every part starts as drawn.
 */
export function moveAt(p: AlivePart, t: number, seed = 0, phase = 0): { angle: number; lift: number } {
  const every = p.every ?? EVERY[p.move], x = t / every + phase, k = Math.floor(x), f = x - k, angle = (p.angle ?? 0) * RAD;
  // a number from 0 to 1 for each one of them, the same every time
  const r = (i: number, salt: number) => hash(i * 7919 + salt * 104729 + seed * 1299709);
  switch (p.move) {
    case 'breathe':
      // one in eight a sigh, more than twice as deep
      return { angle: 0, lift: (p.lift ?? 0.6) * (k > 0 && r(k, 1) < 0.125 ? 2.2 : 1) * (0.5 - 0.5 * Math.cos(TAU * f)) };
    case 'sway':
      return { angle: angle * Math.sin(TAU * x), lift: 0 };
    case 'glance': {
      // to another angle, over about half a second, then held; a third of the time back as drawn
      const to = (i: number) => (i <= 0 || r(i, 2) < 0.34 ? 0 : angle * (2 * r(i, 3) - 1));
      const from = 0.45 * r(k, 4), turn = Math.min(0.45, 0.6 / every);
      return { angle: to(k - 1) + (to(k) - to(k - 1)) * smooth(from, from + turn, f), lift: 0 };
    }
    case 'doze': {
      // awake a while, drooping slowly and more, then a jerk back up in a third of a second, a little past, settling
      const droop = 1 - 1.55 / every, jerk = droop + 0.35 / every;
      const a = f < 0.25 ? 0 : f < droop ? ((f - 0.25) / (droop - 0.25)) ** 1.6 : f < jerk ? 1 - 1.25 * smooth(droop, jerk, f) : -0.25 * (1 - smooth(jerk, 1, f));
      return { angle: angle * a, lift: 0 };
    }
    case 'fidget': {
      // two times in three, a moment of quick turns one way and back, about twice a second
      if (k <= 0 || r(k, 5) > 0.66) return STILL;
      const len = Math.min(every, 1.6 + 1.2 * r(k, 6)), start = (every - len) * 0.8 * r(k, 7), s = f * every - start;
      if (s < 0 || s > len) return STILL;
      const fade = smooth(0, 0.3, s) * (1 - smooth(len - 0.3, len, s));
      return { angle: angle * fade * (0.5 - 0.5 * Math.cos(TAU * 2.2 * s)), lift: 0 };
    }
  }
}

/**
 * The parts of a character in a view as the sprite shader takes them: for each, its joint, how far it is turned and
 * raised now; then where the part is, how far around it (-1: everything above the joint) and how softly it fades.
 * `dx` moves every point across: Luna's are measured from her middle. Null with no part in the view.
 */
export function bendsAt(parts: readonly AlivePart[], t: number, view: Only, seed = 0, phase = 0, dx = 0): Float32Array | null {
  const mine = parts.filter((p) => !p.only || p.only === view).slice(0, MAX_PARTS);
  if (!mine.length) return null;
  const out = new Float32Array(mine.length * 8);
  mine.forEach((p, i) => {
    const now = moveAt(p, t, seed + i, phase), at = p.at ?? p.joint;
    out.set([p.joint[0] + dx, p.joint[1], now.angle, now.lift, at[0] + dx, at[1], p.r ?? -1, p.soft ?? (p.r ? p.r / 2 : SOFT)], i * 8);
  });
  return out;
}

/** What is wrong with a character's moving parts, as a scene or world.json gives them (`name` says where): nothing, none. */
export function aliveProblems(parts: unknown, name: string): string[] {
  if (!Array.isArray(parts)) return [`${name} must be a list of its moving parts`];
  const out: string[] = [], num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const point = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(num);
  for (const view of ['raw', 'concierge']) {
    const n = parts.filter((p) => !p?.only || p.only === view).length;
    if (n > MAX_PARTS) out.push(`${name}: at most ${MAX_PARTS} parts move in a view, ${view} view has ${n}`);
  }
  parts.forEach((p, i) => {
    const at = `${name}[${i}]`;
    if (!(MOVES as readonly unknown[]).includes(p?.move)) out.push(`${at}.move must be one of ${MOVES.join(', ')}`);
    else if (p.move !== 'breathe' && p.angle === undefined) out.push(`${at} needs angle, in degrees`);
    if (!point(p?.joint)) out.push(`${at}.joint must be [x, y]`);
    if (p?.at !== undefined && !point(p.at)) out.push(`${at}.at must be [x, y]`);
    for (const k of ['r', 'soft', 'angle', 'lift', 'every']) if (p?.[k] !== undefined && !num(p[k])) out.push(`${at}.${k} must be a number`);
    if (num(p?.every) && p.every <= 0.5) out.push(`${at}.every must be over half a second`);
    if (p?.only !== undefined && p.only !== 'raw' && p.only !== 'concierge') out.push(`${at}.only must be raw or concierge`);
  });
  return out;
}
