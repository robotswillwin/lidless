import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AlivePart } from '../engine/assets';
import { aliveProblems, bendsAt, MAX_PARTS, moveAt } from './alive';

const RAD = Math.PI / 180;
const times = (secs: number, step = 0.05) => Array.from({ length: Math.round(secs / step) }, (_, i) => i * step);

describe('standing alive', () => {
  it('starts as drawn with no phase: a breath, a sway, a glance, a doze and a fidget all at rest at 0', () => {
    for (const move of ['breathe', 'sway', 'glance', 'doze', 'fidget'] as const) expect(moveAt({ move, joint: [0, 0], angle: 5, lift: 1 }, 0, 3)).toEqual({ angle: 0, lift: 0 });
  });

  it('breathes in and out each breath, now and then a sigh, and never sinks', () => {
    const p: AlivePart = { move: 'breathe', joint: [0, 50], lift: 1, every: 4 };
    const lifts = times(400).map((t) => moveAt(p, t, 2).lift);
    expect(Math.min(...lifts)).toBeGreaterThanOrEqual(0);
    expect(moveAt(p, 2, 2).lift).toBeCloseTo(1);
    // the deepest are sighs, more than twice a breath; most are not
    const peaks = Array.from({ length: 100 }, (_, k) => moveAt(p, k * 4 + 2, 2).lift);
    expect(peaks.filter((v) => v > 2).length).toBeGreaterThan(3);
    expect(peaks.filter((v) => v > 2).length).toBeLessThan(30);
    expect(moveAt(p, 4, 2).lift).toBeCloseTo(0);
  });

  it('glances: turns within its angle, holds, and is the same at the same moment', () => {
    const p: AlivePart = { move: 'glance', joint: [0, 0], angle: 6, every: 4 };
    const a = times(200).map((t) => moveAt(p, t, 9).angle);
    expect(Math.max(...a.map(Math.abs))).toBeLessThanOrEqual(6 * RAD + 1e-9);
    // held most of the time: few moments in which it is turning
    const turning = a.filter((v, i) => i > 0 && Math.abs(v - a[i - 1]) > 1e-6).length;
    expect(turning / a.length).toBeLessThan(0.2);
    expect(new Set(a.map((v) => v.toFixed(4))).size).toBeGreaterThan(5);
    expect(moveAt(p, 77.7, 9)).toEqual(moveAt(p, 77.7, 9));
    // two characters out of step
    expect(times(60).some((t) => moveAt(p, t, 9).angle !== moveAt(p, t, 10).angle)).toBe(true);
  });

  it('dozes: drooping slowly to its angle, then back up quickly, a little past', () => {
    const p: AlivePart = { move: 'doze', joint: [0, 0], angle: 10, every: 14 };
    const at = (t: number) => moveAt(p, t).angle / RAD;
    expect(at(2)).toBe(0);
    expect(at(8)).toBeGreaterThan(at(6));
    expect(at(12.4)).toBeGreaterThan(9.5);
    // within a third of a second it is up again, past where it was drawn, then settled
    expect(at(12.8)).toBeLessThan(0);
    expect(at(14)).toBeCloseTo(0);
  });

  it('fidgets now and then, still between', () => {
    const p: AlivePart = { move: 'fidget', joint: [0, 0], angle: 5, every: 6 };
    const a = times(600, 0.1).map((t) => moveAt(p, t, 4).angle);
    const moving = a.filter((v) => v > 1e-6).length / a.length;
    expect(moving).toBeGreaterThan(0.1);
    expect(moving).toBeLessThan(0.6);
    expect(Math.max(...a)).toBeLessThanOrEqual(5 * RAD + 1e-9);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0);
  });

  it('packs the parts in a view for the shader: joint, turn, rise; where, how far, how softly', () => {
    const parts: AlivePart[] = [
      { move: 'breathe', joint: [10, 50], soft: 20, lift: 1 },
      { move: 'glance', joint: [10, 30], at: [8, 20], r: 6, angle: 4, only: 'raw' },
      { move: 'sway', joint: [10, 100], angle: 1, only: 'concierge' },
    ];
    const raw = bendsAt(parts, 0, 'raw', 0, 0, 100)!;
    expect(raw.length).toBe(16);
    expect([...raw.slice(0, 8)]).toEqual([110, 50, 0, 0, 110, 50, -1, 20]);
    expect([...raw.slice(8)]).toEqual([110, 30, 0, 0, 108, 20, 6, 3]);
    expect(bendsAt(parts, 0, 'concierge')!.length).toBe(16);
    expect(bendsAt([parts[1]], 0, 'concierge')).toBe(null);
    expect(bendsAt(Array.from({ length: 9 }, () => parts[0]), 0, 'raw')!.length).toBe(MAX_PARTS * 8);
  });

  it('says what is wrong with them', () => {
    expect(aliveProblems({}, 'x')).toEqual(['x must be a list of its moving parts']);
    expect(aliveProblems([{ move: 'sway', joint: [0, 0], angle: 1, at: [1, 'a'], r: '3' }], 'x')).toEqual(['x[0].at must be [x, y]', 'x[0].r must be a number']);
  });

  it("Luna's, turned to us, are sound", () => {
    const world = JSON.parse(readFileSync('public/assets/world.json', 'utf8'));
    expect(world.hero.alive.front.length).toBeGreaterThan(0);
    expect(aliveProblems(world.hero.alive.front, 'hero.alive.front')).toEqual([]);
  });
});
