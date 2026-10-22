// What stands on a floor the engine draws stands on it, not in it. In a scene with a `ground`, the engine paints its own
// floor below the reflection line (`mirror`) over the set, and a prop or a mover drawn as part of the set is painted
// over with it there: the guardian's feet were, 14 pixels of them. Characters are drawn after the floor and may stand
// in front of the line; a set piece reaches below it only by a few pixels, its base meeting the floor.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SceneFile } from './scenefile';

const assets = join(__dirname, '../../public/assets');
/** How far a set piece's base may reach below the line: the nutrition station's meets the floor 6.5 pixels down. */
const BASE = 7;

describe('a floor the engine draws', () => {
  it('has nothing of the set standing in it: each prop and mover above its line, but for its base', () => {
    const sunk: string[] = [];
    for (const id of readdirSync(join(assets, 'scenes'))) {
      const s = JSON.parse(readFileSync(join(assets, 'scenes', id, 'scene.json'), 'utf8')) as SceneFile & { ground?: unknown; mirror?: number };
      if (!s.ground || s.mirror === undefined) continue;
      const placed = [...s.layers, ...(s.movers ?? [])] as { asset: string; y?: number }[];
      for (const p of placed) {
        const file = join(assets, p.asset, 'sprite.json');
        if (!existsSync(file)) continue;
        const def = JSON.parse(readFileSync(file, 'utf8')) as { kind?: string; y: number; h: number };
        if (def.kind === 'background' || def.kind === 'character') continue;
        const bottom = (p.y ?? def.y) + def.h;
        if (bottom > s.mirror + BASE) sunk.push(`${id}: ${p.asset} stands ${(bottom - s.mirror).toFixed(1)} px below the floor line (${s.mirror})`);
      }
    }
    expect(sunk).toEqual([]);
  });
});
