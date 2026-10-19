import { describe, expect, it } from 'vitest';
import { distanceFrom, draftLayerMap, layerMapImage, readLayerMap } from './split.mjs';

// a picture 20 wide and 10 tall: the left half far away, the right half near, the walk line at row 8
const W = 20, H = 10, depth = new Float32Array(W * H);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) depth[y * W + x] = x < 10 ? 0.1 : 0.9;
const at = (L, x, y) => L[y * W + x];

describe('draftLayerMap', () => {
  it('groups the depth above the ground into bands, far to near; under it everything is the street', () => {
    const L = draftLayerMap(depth, W, H, { n: 2, ground: 8, speck: 0 });
    expect(at(L, 2, 2)).toBe(0);
    expect(at(L, 15, 2)).toBe(1);
    expect(at(L, 2, 9)).toBe(1);
  });

  it('moves what a rectangle covers to a layer, all of it or only what is in the layers named', () => {
    const all = draftLayerMap(depth, W, H, { n: 2, ground: 8, speck: 0, fixes: [{ to: 1, rect: [0, 0, 4, 4] }] });
    expect(at(all, 1, 1)).toBe(1);
    expect(at(all, 5, 5)).toBe(0);
    const some = draftLayerMap(depth, W, H, { n: 2, ground: 8, speck: 0, fixes: [{ to: 0, from: [0], rect: [0, 0, 20, 4] }] });
    expect(at(some, 15, 1)).toBe(1);
  });

  it('follows a polygon’s outline, not its box', () => {
    // a triangle with its right angle at the top left: its far corner stays where it was
    const L = draftLayerMap(depth, W, H, { n: 2, ground: 8, speck: 0, fixes: [{ to: 1, poly: [[0, 0], [8, 0], [0, 8]] }] });
    expect(at(L, 1, 1)).toBe(1);
    expect(at(L, 7, 6)).toBe(0);
  });

  it('lets specks join the layer around them', () => {
    const d = depth.slice();
    d[3 * W + 3] = 0.9;
    expect(at(draftLayerMap(d, W, H, { n: 2, ground: 8, speck: 0 }), 3, 3)).toBe(1);
    expect(at(draftLayerMap(d, W, H, { n: 2, ground: 8, speck: 4 }), 3, 3)).toBe(0);
  });
});

describe('a layer map as a picture', () => {
  it('reads back the same layers it was drawn from', () => {
    const L = draftLayerMap(depth, W, H, { n: 3, ground: 8, speck: 0 });
    expect(Array.from(readLayerMap(layerMapImage(L, W, H), 3))).toEqual(Array.from(L));
  });
});

describe('distanceFrom', () => {
  it('measures how far each pixel is from the nearest one that is on', () => {
    const on = new Uint8Array(W * H);
    on[5 * W + 5] = 1;
    const D = distanceFrom(on, W, H);
    expect(D[5 * W + 5]).toBe(0);
    expect(D[5 * W + 8]).toBe(3);
    expect(D[8 * W + 8]).toBeCloseTo(3 * Math.SQRT2, 1);
  });
});
