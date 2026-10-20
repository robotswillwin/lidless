import { describe, expect, it } from 'vitest';
import { holdPace } from './hero';
import type { LevelDef } from './level';
import { World } from './world';

const hero = { sprite: 'cast/hero', speed: 60, jogFrom: 1.5, runFrom: 3 };

describe('a finger held down outdoors', () => {
  it('runs her after it from further than she would jog to, and nearer has her walk', () => {
    // her height on screen 100 px: she would jog past 150
    expect(holdPace(400, hero, 100)).toBe('run');
    expect(holdPace(160, hero, 100)).toBe('run');
    expect(holdPace(140, hero, 100)).toBe('walk');
  });

  it('keeps her running while it stays ahead of her, as on a street the camera follows her along, and letting go stops her', () => {
    const level: LevelDef = { walk: { y: 452, x0: 30, x1: 2370 }, hero: { sprite: 'cast/hero', x: 300, speed: 60 }, hotspots: [] };
    const world = new World(level);
    // each frame the finger is where the screen puts it, 400 px ahead of her: four seconds on, she has run on past where
    // it first went down, still at a run
    for (let i = 0; i < 240; i++) { world.walkTo(world.heroX + 400, null, 'run'); world.update(1 / 60); }
    expect(world.speed).toBeCloseTo(world.speedOf('run'));
    const at = world.heroX;
    expect(at).toBeGreaterThan(300 + 400);
    world.stop();
    world.update(1 / 60);
    expect(world.moving).toBe(false);
    expect(world.heroX).toBe(at);
  });
});
