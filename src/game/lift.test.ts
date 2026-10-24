import { describe, expect, it } from 'vitest';
import { floorLabel, Lift } from './lift';

describe('the tower\'s lift', () => {
  it('waits where she got out, then goes floor by floor to whoever called it, and waits there', () => {
    const lift = new Lift();
    lift.reset(14, 100);
    expect(lift.now(100)).toEqual({ floor: 14, dir: 0 });
    expect(lift.now(119)).toEqual({ floor: 14, dir: 0 });
    // off after twenty seconds, a floor every 1.1 seconds
    const moving = lift.now(121.2);
    expect(moving.dir).not.toBe(0);
    expect(Math.abs(moving.floor - 14)).toBe(1);
    // never off the tower, and on its way it passes every floor between
    let last = 14;
    for (let t = 121.2; t < 400; t += 0.25) {
      const { floor } = lift.now(t);
      expect(floor).toBeGreaterThanOrEqual(0);
      expect(floor).toBeLessThanOrEqual(16);
      expect(Math.abs(floor - last)).toBeLessThanOrEqual(1);
      last = floor;
    }
  });

  it('is the same from the same start', () => {
    const a = new Lift(), b = new Lift();
    a.reset(9, 50);
    b.reset(9, 50);
    for (const t of [60, 75, 90, 140, 300]) expect(a.now(t)).toEqual(b.now(t));
  });

  it('says the lobby as G', () => {
    expect(floorLabel(0)).toBe('G');
    expect(floorLabel(14)).toBe('14');
  });
});
