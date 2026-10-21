import { describe, expect, it } from 'vitest';
import type { SceneFile } from './scenefile';
import { keepFor, neighbours } from './scenes';

const scene = (id: string, goes: string[]): SceneFile => ({
  id, name: id, kind: 'exterior', size: [960, 540], layers: [], lights: [], walk: { y: 400, x0: 30, x1: 930 }, spawns: {},
  hotspots: goes.map((to, i) => ({ id: `way${i}`, name: 'Way', rect: [0, 0, 10, 10], go: { scene: to, spawn: 'from' } })),
});

describe('scenes near her', () => {
  it('are the ones her ways out lead to, each once, not the scene itself', () => {
    expect(neighbours(scene('street', ['backstreet', 'radio', 'backstreet', 'street']))).toEqual(['backstreet', 'radio']);
  });

  it('keep the scene she is in and the one she came from on the GPU, and the files of where she can go next', () => {
    const k = keepFor(scene('backstreet', ['street', 'home']), 'street');
    expect([...k.gpu]).toEqual(['backstreet', 'street']);
    expect([...k.files].sort()).toEqual(['backstreet', 'home', 'street']);
  });

  it('keep only the one she is in when she has come from nowhere, as at the start', () => {
    expect([...keepFor(scene('home', ['backstreet'])).gpu]).toEqual(['home']);
  });
});
