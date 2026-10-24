import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSceneFile } from './scenefile';

const scenes = resolve(__dirname, '../../public/assets/scenes');
const read = (id: string) => JSON.parse(readFileSync(`${scenes}/${id}/scene.json`, 'utf8')) as Record<string, unknown>;

describe('checkSceneFile', () => {
  it('finds nothing wrong with the game’s scenes', () => {
    for (const id of readdirSync(scenes)) expect(checkSceneFile(read(id), id), id).toEqual([]);
  });

  it('names what is wrong, all of it at once', () => {
    const f = read('street');
    f.id = 'elsewhere';
    (f.walk as { x1: number }).x1 = 0;
    (f.hotspots as { rect: unknown }[])[0].rect = [1, 2];
    (f.movers as { after: string }[])[0].after = 'street/nothing';
    const problems = checkSceneFile(f, 'street');
    expect(problems).toContain('its id is elsewhere, not street');
    expect(problems).toContain('walk.x1 must be right of walk.x0');
    expect(problems.some((p) => p.includes('rect must be [x, y, width, height]'))).toBe(true);
    expect(problems.some((p) => p.startsWith('movers[0] is drawn after street/nothing'))).toBe(true);
  });

  it('wants an exit to say where it arrives', () => {
    const f = read('street');
    (f.hotspots as unknown[]).push({ id: 'gate', name: 'Gate', rect: [0, 0, 1, 1], go: { scene: 'radio' } });
    expect(checkSceneFile(f, 'street')).toContain('hotspot gate: go needs a scene and a spawn to arrive at');
  });

  it('checks the effects, and how many the renderer draws', () => {
    const f = read('street');
    f.steam = [...(f.steam as unknown[]), { x: 1, y: 1, height: 1, width: 1, kind: 'fog' }, {}, {}, {}];
    f.drips = { x0: 1 };
    const problems = checkSceneFile(f, 'street');
    expect(problems).toContain('steam: at most 4 are drawn, this scene has 5');
    expect(problems).toContain('steam[1].kind must be "steam" or "smoke"');
    expect(problems.some((p) => p.startsWith('steam[2] needs x, y, height, width'))).toBe(true);
    expect(problems).toContain('drips needs x0, x1, top and bottom');
  });

  it('checks an oscilloscope: where its glass is, its shape or the story variable that holds it, two at most', () => {
    const f = read('street');
    f.scopes = [{ x: 1, y: 1, r: 10, shape: 'zigzag', pace: 'warp' }, { x: 1, y: 1, wave: 'Not a name', speed: 3 }, { x: 1, y: 1, r: 4, when: 'has_raw and' }];
    const problems = checkSceneFile(f, 'street');
    expect(problems).toContain('scopes: at most 2 are drawn, this scene has 3');
    expect(problems).toContain('scopes[0].shape must be one of sine, square, triangle, saw, voice');
    expect(problems).toContain('scopes[1] needs r (a round glass) or w and h (a screen with corners)');
    expect(problems).toContain('scopes[1].wave must name a story variable');
    expect(problems).toContain('scopes[0].pace must be one of slow, medium, fast');
    expect(problems).toContain('scopes[1].speed must name a story variable');
    expect(problems.some((p) => p.startsWith('scopes[2]: when:'))).toBe(true);
  });

  it('checks a clock and a screen with corners: where they are, how big, in what colours', () => {
    const f = read('street');
    f.scopes = [{ x: 1, y: 1, w: 20, h: 14, colours: { raw: [1, 0.5] } }];
    f.clocks = [{ x: 1, y: 1 }, { x: 1, y: 1, r: 5, when: 'and' }];
    const problems = checkSceneFile(f, 'street');
    expect(problems).toContain('scopes[0].colours.raw must be [r, g, b], 0 to 1');
    expect(problems.some((p) => p.startsWith('clocks[0] needs r'))).toBe(true);
    expect(problems.some((p) => p.startsWith('clocks[1]: when:'))).toBe(true);
    expect(problems.some((p) => p.startsWith('scopes[0] needs'))).toBe(false);
  });

  it('checks a cradle, a hologram of rings, and pictures shown in turn', () => {
    const f = read('street');
    f.cradles = [{ x: 1, y: 1, gap: 2, length: 3, r: 1, swings: 'Bad name', posts: [1, 2] }];
    f.rings = [{ x: 1, y: 1, r: 3, turns: ['a', 'b'] }];
    (f.layers as Record<string, unknown>[])[0].show = { at: 3, of: 3, every: 5 };
    const problems = checkSceneFile(f, 'street');
    expect(problems).toContain('cradles[0].swings must name a story variable');
    expect(problems).toContain("cradles[0].posts must be [from, to, from, to]: the frame's front posts");
    expect(problems).toContain("rings[0].turns must name three story variables, the inner ring's first");
    expect(problems).toContain('layers[0].show needs at (from 0), of, every (seconds) and perhaps fade');
  });

  it('checks the ground: its eye above the reflection line, its slabs, kerb and puddles', () => {
    const f = read('street');
    f.ground = { horizon: 460, slab: [90], kerb: -5, puddles: 2 };
    expect(checkSceneFile(f, 'street')).toEqual([
      'ground.horizon must be above the reflection line',
      'ground.slab must be [width, depth], 0 or more',
      'ground.kerb must be 0 to 900 pixels in front of the walk line',
      'ground.puddles must be 0 to 1',
    ]);
    f.ground = { horizon: 352 };
    expect(checkSceneFile(f, 'street')).toEqual([]);
  });

  it('checks its variants: each named, each an object', () => {
    const f = read('street');
    expect(Object.keys(f.variants as object)).toEqual(['rain', 'fog', 'outage']);
    f.variants = { ...(f.variants as object), 'Heavy Snow': {}, dawn: 'early' };
    expect(checkSceneFile(f, 'street')).toEqual([
      'variant “Heavy Snow” needs a name of lower case letters, digits and dashes',
      'variant dawn must be an object: { name, look }',
    ]);
  });

  it('says so plainly when it is not a scene at all', () => {
    expect(checkSceneFile(null)).toEqual(['it is not a JSON object']);
    expect(checkSceneFile({}).length).toBeGreaterThan(4);
  });
});
