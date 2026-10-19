import { describe, expect, it } from 'vitest';
import { findGlows, suggestLights, type GlowImage, type GlowLayer } from './suggest';

/** A glow map of w by h with lit rectangles: [x, y, w, h, r, g, b] each, colours 0 to 255. */
function glow(w: number, h: number, rects: number[][]): GlowImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data[i * 4 + 3] = 255;
  for (const [x0, y0, rw, rh, r, g, b] of rects) for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) data.set([r, g, b, 255], (y * w + x) * 4);
  return { w, h, data };
}

const street = (raw: number[][], concierge: number[][]): GlowLayer => ({ raw: glow(480, 270, raw), concierge: glow(480, 270, concierge), scale: 2, x0: 0, y0: 0, parallax: 1, street: true });

describe('findGlows', () => {
  it('finds each lit place, its middle in level pixels, its colour and size', () => {
    const g = findGlows(glow(100, 100, [[10, 10, 6, 4, 200, 160, 100]]), { scale: 2, x0: -20, y0: 0 });
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ x: -20 + 13 * 2, y: 12 * 2, area: 24 * 4, c: [1, 0.8, 0.5] });
  });

  it('joins pieces a pixel apart into one place, and leaves out specks', () => {
    const g = findGlows(glow(100, 100, [[10, 10, 4, 4, 200, 200, 200], [15, 10, 4, 4, 200, 200, 200], [60, 60, 1, 1, 255, 255, 255]]), { scale: 2, x0: 0, y0: 0 });
    expect(g).toHaveLength(1);
  });

  it('leaves out the ground below the floor, so a lamp is not joined to its reflection', () => {
    // a lamp from y 40 to 50, its reflection right under it to 60, and one more reflection further down
    const img = glow(100, 100, [[20, 40, 6, 10, 255, 200, 120], [20, 50, 6, 10, 160, 120, 80], [60, 80, 6, 6, 255, 255, 255]]);
    const g = findGlows(img, { scale: 2, x0: 0, y0: 0 }, { floor: 100 });
    expect(g).toHaveLength(1);
    expect(g[0].y).toBe(45 * 2);
  });
});

describe('suggestLights', () => {
  it('makes a lamp lit in both views one light, among the people when it is low in the street', () => {
    const l = suggestLights([street([[200, 150, 8, 6, 230, 220, 200]], [[200, 150, 8, 6, 255, 200, 120]])], []);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ x: 408, y: 306, c: [1, 0.78, 0.47], layer: 1, suggested: 1 });
    expect(l[0].ar).toBeUndefined();
    expect(l[0].raw).toBeUndefined();
  });

  it('makes neon lit only in the Concierge’s view a light of its view, and a coloured glow only in raw view a machine’s', () => {
    const l = suggestLights([street([[50, 50, 6, 6, 255, 120, 30]], [[300, 40, 10, 4, 255, 60, 140]])], []);
    expect(l.find((x) => x.ar)).toMatchObject({ ar: 1, c: [1, 0.24, 0.55] });
    expect(l.find((x) => x.raw)).toMatchObject({ raw: 1, machine: 1 });
  });

  it('gives a machine’s eye dressed up as a screen a light for each view', () => {
    const l = suggestLights([street([[100, 100, 6, 6, 255, 130, 40]], [[100, 100, 6, 6, 120, 110, 255]])], []);
    expect(l).toHaveLength(2);
    expect(l.map((x) => (x.ar ? 'ar' : x.raw ? 'raw' : 'both')).sort()).toEqual(['ar', 'raw']);
  });

  it('suggests nothing where a light is already, and on a far layer moves with it', () => {
    expect(suggestLights([street([[200, 150, 8, 6, 230, 220, 200]], [[200, 150, 8, 6, 255, 200, 120]])], [{ x: 410, y: 300 }])).toHaveLength(0);
    const far = { ...street([], [[100, 20, 10, 10, 200, 100, 255]]), parallax: 0.3, street: false };
    expect(suggestLights([far], [])[0]).toMatchObject({ parallax: 0.3, ar: 1 });
  });
});
