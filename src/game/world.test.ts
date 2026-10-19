import { describe, expect, it } from 'vitest';
import type { LevelDef } from './level';
import { World } from './world';

const level: LevelDef = {
  walk: { y: 452, x0: 30, x1: 790 },
  hero: { sprite: 'cast/hero', x: 400, speed: 60 },
  hotspots: [
    { id: 'door', name: 'Door', rect: [280, 270, 44, 160], stand: 304 },
    { id: 'face', name: 'Face', rect: [840, 88, 66, 150], parallax: 0.6 },
    { id: 'sleeper', name: 'Someone asleep', rect: [110, 410, 104, 34], only: 'raw' },
  ],
};

describe('hotspots', () => {
  const world = new World(level);

  it('are found where they are on the street', () => {
    expect(world.hotspotAt(300, 300, false)?.id).toBe('door');
    expect(world.hotspotAt(10, 10, false)).toBeNull();
  });

  it('move with their layer as the camera moves, so a click finds them where they are drawn', () => {
    // with the camera 20 px along, the face, at 0.6, has moved 8 px less than the street: 8 px to the right of its place
    expect(world.hotspotAt(843, 100, false, 20)).toBeNull();
    expect(world.hotspotAt(850, 100, false, 20)?.id).toBe('face');
  });

  it('are only there in their view', () => {
    expect(world.hotspotAt(150, 420, false)).toBeNull();
    expect(world.hotspotAt(150, 420, true)?.id).toBe('sleeper');
  });
});

describe('walking', () => {
  it('stays on the walk line, and arrives at what she walked to', () => {
    const world = new World(level, 1000);
    expect(world.heroX).toBe(790);
    world.walkTo(304, level.hotspots[0]);
    let arrived = null;
    for (let i = 0; i < 1000 && !arrived; i++) arrived = world.update(1 / 60);
    expect(arrived?.id).toBe('door');
    expect(world.heroX).toBeCloseTo(304, 0);
  });
});
