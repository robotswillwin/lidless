import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkSceneFile } from '../game/scenefile';
import { resolveLight, setPresets, type Presets } from './presets';

const file = (p: string) => JSON.parse(readFileSync(resolve(__dirname, '../../public/assets', p), 'utf8'));

afterEach(() => setPresets({ lights: {} }));

describe('resolveLight', () => {
  it('gives a light its preset’s settings, its own over them', () => {
    setPresets({ lights: { lamp: { label: 'Lamp', light: { z: 30, r: 250, c: [1, 0.8, 0.5], i: 1.2, zone: 0, cone: [0, 1, 0.45], haze: 0.3 } } } });
    const l = resolveLight({ x: 10, y: 20, preset: 'lamp', r: 110 });
    expect(l).toMatchObject({ x: 10, y: 20, z: 30, r: 110, i: 1.2, cone: [0, 1, 0.45] });
  });

  it('turns off what the preset has on, with null', () => {
    setPresets({ lights: { lamp: { label: 'Lamp', light: { z: 30, r: 250, c: [1, 1, 1], i: 1, zone: 0, cone: [0, 1, 0.45] } } } });
    expect('cone' in resolveLight({ x: 0, y: 0, preset: 'lamp', cone: null })).toBe(false);
  });

  it('makes a plain white lamp of a light with nothing set, and one with an unknown preset', () => {
    expect(resolveLight({ x: 1, y: 2 })).toMatchObject({ x: 1, y: 2, z: 40, r: 300, c: [1, 1, 1], i: 1, zone: 0 });
    expect(resolveLight({ x: 1, y: 2, preset: 'nothing' }).r).toBe(300);
  });
});

describe('the game’s presets', () => {
  it('are all complete lights', () => {
    const p = file('presets.json') as Presets;
    for (const [k, v] of Object.entries(p.lights)) {
      expect(v.label, k).toBeTruthy();
      for (const f of ['z', 'r', 'i', 'zone'] as const) expect(typeof v.light[f], `${k}.${f}`).toBe('number');
      expect(v.light.c, k).toHaveLength(3);
    }
  });

  it('are the ones the scenes name', () => {
    setPresets(file('presets.json'));
    for (const id of ['street', 'home', 'backstreet', 'radio']) expect(checkSceneFile(file(`scenes/${id}/scene.json`), id), id).toEqual([]);
    const f = file('scenes/street/scene.json');
    f.lights[0].preset = 'no-such-kind';
    expect(checkSceneFile(f, 'street')).toContain('lights[0]: there is no preset no-such-kind (public/assets/presets.json)');
  });

  it('let a light of a kind leave out everything but its place', () => {
    setPresets(file('presets.json'));
    const f = file('scenes/street/scene.json');
    f.lights = [{ x: 1, y: 2, preset: 'street-lamp' }, { x: 1, y: 2 }];
    expect(checkSceneFile(f, 'street')).toEqual(['lights[1] needs z, r, i, zone', 'lights[1].c must be [r, g, b]']);
  });
});
