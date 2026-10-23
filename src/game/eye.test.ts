import { describe, expect, it } from 'vitest';
import { eyeAt, eyePaths, openedAfter } from './eye';

describe('the eye that opens while the game waits', () => {
  it('starts as the privacy sign, shut in its ring, and slowly opens', () => {
    expect(eyeAt(0)).toEqual({ lid: 1, ring: 1, pupil: 0, gaze: 0 });
    const half = eyeAt(1.3);
    expect(half.lid).toBeGreaterThan(-0.6);
    expect(half.lid).toBeLessThan(0.6);
    expect(eyeAt(2.3)).toMatchObject({ lid: -1, ring: 0 });
  });

  it('kindles a red pupil once open, and then looks about and blinks', () => {
    expect(eyeAt(2.3).pupil).toBeLessThan(0.5);
    expect(eyeAt(3).pupil).toBe(1);
    const gazes = Array.from({ length: 80 }, (_, i) => eyeAt(3 + i * 0.1).gaze);
    expect(Math.min(...gazes)).toBeLessThan(-5);
    expect(Math.max(...gazes)).toBeGreaterThan(4);
    // a blink: the lid comes nearly down, and goes up again
    expect(eyeAt(3.55).lid).toBeGreaterThan(0.5);
    expect(eyeAt(3.8).lid).toBe(-1);
  });

  it('is held, once shown, until it has opened and its pupil kindled', () => {
    expect(eyeAt(openedAfter(false))).toMatchObject({ lid: -1, pupil: 1 });
    expect(eyeAt(openedAfter(true), true)).toMatchObject({ lid: -1, pupil: 1 });
  });

  it('with less motion: shut, then open, nothing in between', () => {
    expect(eyeAt(0.6, true)).toEqual({ lid: 1, ring: 1, pupil: 0, gaze: 0 });
    expect(eyeAt(1.3, true)).toEqual({ lid: -1, ring: 0, pupil: 1, gaze: 0 });
  });

  it('draws the lid bent down shut and up open, its lashes down, folded away as it passes flat, then up', () => {
    const shut = eyePaths(1), flat = eyePaths(0), open = eyePaths(-1);
    expect(shut.upper).toBe('M-34 0Q0 30 34 0');
    expect(open.upper).toBe('M-34 0Q0 -30 34 0');
    // the middle lash hangs down from the shut lid and stands up from the open one
    expect(shut.lashes).toContain('M0 15L0 24');
    expect(open.lashes).toContain('M0 -15L0 -24');
    expect(flat.lashes).toContain('M0 0L0 0');
    // shut, the opening between the lids has no height
    expect(shut.opening).toBe('M-34 0Q0 30 34 0Q0 30 -34 0Z');
  });
});
