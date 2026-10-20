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

  it('are found where they are in the view on screen', () => {
    const world = new World({ ...level, hotspots: [{ id: 'sign', name: 'Sign', rect: [100, 100, 20, 20], views: { raw: { rect: [300, 100, 20, 20] } } }] });
    expect(world.hotspotAt(105, 105, false)?.id).toBe('sign');
    expect(world.hotspotAt(105, 105, true)).toBeNull();
    expect(world.hotspotAt(305, 105, true)?.id).toBe('sign');
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

describe('gaits', () => {
  // a walk at 60 px/s, a jog at 130, a run at 180; a cycle of each carries her 40, 80 and 100 px
  const fast: LevelDef = { ...level, hero: { ...level.hero, gaits: { walk: { speed: 60, stride: 40 }, jog: { speed: 130, stride: 80 }, run: { speed: 180, stride: 100 } } } };
  const go = (world: World, seconds: number) => { const seen = new Set<string>(); for (let i = 0; i < seconds * 60; i++) { world.update(1 / 60); seen.add(world.gait); } return seen; };

  it('sets off at a walk, speeds up through a jog into a run, and slows down to arrive at a walk', () => {
    const world = new World(fast, 30);
    world.walkTo(790, null, 'run');
    world.update(1 / 60);
    expect(world.gait).toBe('walk');
    expect(world.speed).toBeLessThan(70);
    const order: string[] = [];
    let top = 0, arrivedAt = 0;
    for (let i = 0; i < 1200 && world.moving; i++) {
      world.update(1 / 60);
      top = Math.max(top, world.speed);
      if (order[order.length - 1] !== world.gait) order.push(world.gait);
      arrivedAt = i;
    }
    expect(order).toEqual(['walk', 'jog', 'run', 'jog', 'walk']);
    expect(top).toBeCloseTo(180, 5);
    expect(world.heroX).toBe(790);
    expect(world.moving).toBe(false);
    expect(arrivedAt).toBeLessThan(600);
  });

  it('changes gait only as a foot lands: at the start or the middle of a cycle', () => {
    const world = new World(fast, 30);
    world.walkTo(790, null, 'run');
    let gait = world.gait;
    for (let i = 0; i < 1200 && world.moving; i++) {
      world.update(1 / 60);
      if (world.gait !== gait) {
        // just past a half cycle: less than a frame's ground into the new half
        const into = (world.phase * 2) % 1;
        expect(into).toBeLessThan(0.2);
        gait = world.gait;
      }
    }
  });

  it('goes no faster than its pace: jogging a middle distance, walking a short one', () => {
    const jog = new World(fast, 30);
    jog.walkTo(500, null, 'jog');
    expect(go(jog, 8)).toEqual(new Set(['walk', 'jog']));
    const walk = new World(fast, 30);
    walk.walkTo(200, null, 'walk');
    expect(go(walk, 8)).toEqual(new Set(['walk']));
  });

  it('turning back, slows to a walk first', () => {
    const world = new World(fast, 30);
    world.walkTo(790, null, 'run');
    go(world, 3);
    expect(world.speed).toBeGreaterThan(150);
    world.walkTo(100, null, 'run');
    world.update(1 / 60);
    expect(world.speed).toBeLessThanOrEqual(60 + 2.5 * 60 / 60 + 1e-9);
    expect(world.facing).toBe(-1);
  });

  it('runs with Shift on the keys, and walks without', () => {
    const world = new World(fast, 30);
    world.keyDir = 1;
    world.keyRun = true;
    expect(go(world, 2).has('run')).toBe(true);
    world.keyDir = 0;
    world.update(1 / 60);
    expect(world.moving).toBe(false);
    world.keyDir = 1;
    world.keyRun = false;
    expect(go(world, 2)).toEqual(new Set(['walk']));
  });

  it('without frames for a jog or a run, moves faster at a walk', () => {
    const world = new World(level, 30);
    expect(world.speedOf('jog')).toBeCloseTo(60 * 2.2, 5);
    expect(world.speedOf('run')).toBeCloseTo(60 * 3, 5);
  });
});
