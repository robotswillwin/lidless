import { describe, expect, it } from 'vitest';
import type { SpriteDef } from '../engine/assets';
import { blinking, frameFor } from './anim';

const luna = {
  anims: { idle: { from: 0, count: 16, fps: 5 }, walk: { from: 16, count: 16, stride: 148 }, idleLeft: { from: 32, count: 16, fps: 5 }, walkLeft: { from: 48, count: 16, stride: 148 }, blinkLeft: { from: 64, count: 16 } },
} as unknown as SpriteDef;
const ts = (seconds: number, step = 0.01) => Array.from({ length: Math.round(seconds / step) }, (_, i) => i * step);

describe('her blink', () => {
  it('shuts her eye for a moment every few seconds, never on a beat', () => {
    const shut = ts(120).filter(blinking);
    const starts = shut.filter((t) => !blinking(t - 0.01));
    // about every 3.5 seconds, each a moment long
    expect(starts.length).toBeGreaterThan(120 / 6);
    expect(starts.length).toBeLessThan(120 / 2.5);
    expect(shut.length / starts.length).toBeCloseTo(15, -0.5);
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    expect(Math.max(...gaps) - Math.min(...gaps)).toBeGreaterThan(2);
  });

  it('standing facing left, the same frame of her loop with her eye shut while she blinks', () => {
    const shut = ts(30).find((t) => blinking(t) && Math.floor(t * 5) % 16 === Math.floor((t + 0.1) * 5) % 16)!;
    const open = ts(30).find((t) => !blinking(t) && Math.floor(t * 5) % 16 === Math.floor(shut * 5) % 16)!;
    expect(frameFor(luna, false, 0, shut, -1) - 64).toBe(frameFor(luna, false, 0, open, -1) - 32);
    expect(frameFor(luna, false, 0, open, -1)).toBeLessThan(48);
  });

  it('not facing right, where her right eye shows, nor walking', () => {
    const shut = ts(30).find(blinking)!;
    expect(frameFor(luna, false, 0, shut, 1)).toBeLessThan(16);
    expect(frameFor(luna, true, 0.5, shut, -1)).toBe(56);
  });
});
