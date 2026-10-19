import { describe, expect, it } from 'vitest';
import { Camera, cameraTarget } from './camera';

const street = { size: [960, 540] as [number, number], drift: 18, walk: { x0: 30, x1: 790 } };

describe('cameraTarget', () => {
  it('follows the hero across a wide scene, its ends never past the screen', () => {
    const wide = { size: [2000, 540] as [number, number], walk: { x0: 0, x1: 2000 } };
    expect(cameraTarget(wide, 100)).toBe(0);
    expect(cameraTarget(wide, 1000)).toBe(520);
    expect(cameraTarget(wide, 1990)).toBe(1040);
  });

  it('drifts toward her in a scene no wider than the screen: none in the middle, all of it at the ends', () => {
    expect(cameraTarget(street, 410)).toBe(0);
    expect(cameraTarget(street, 790)).toBe(18);
    expect(cameraTarget(street, 30)).toBe(-18);
    expect(cameraTarget(street, 600)).toBeCloseTo(9, 5);
    // past the walk line's ends it holds there
    expect(cameraTarget(street, 900)).toBe(18);
  });

  it('stays still for players who asked for less motion, and in scenes without a drift', () => {
    expect(cameraTarget(street, 790, true)).toBe(0);
    expect(cameraTarget({ ...street, drift: undefined }, 790)).toBe(0);
  });
});

describe('Camera', () => {
  it('eases toward its target and settles on it exactly', () => {
    const cam = new Camera();
    cam.jump(0);
    let x = 0;
    for (let i = 0; i < 400; i++) x = cam.follow(18, 1 / 60, false);
    expect(x).toBe(18);
  });

  it('follows faster across a wide scene', () => {
    const slow = new Camera(), fast = new Camera();
    expect(fast.follow(100, 0.1, true)).toBeGreaterThan(slow.follow(100, 0.1, false));
  });
});
