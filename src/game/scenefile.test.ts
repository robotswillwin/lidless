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

  it('says so plainly when it is not a scene at all', () => {
    expect(checkSceneFile(null)).toEqual(['it is not a JSON object']);
    expect(checkSceneFile({}).length).toBeGreaterThan(4);
  });
});
