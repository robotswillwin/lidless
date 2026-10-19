// Lights suggested from the art: what each layer's glow maps show as lit (lamps, windows, neon, screens) becomes a light
// at its place, in its colour, as big as the glow, in the views it glows in. A first pass for a new scene, to keep, move
// or discard in the editor.

import type { PlacedLight } from '../engine/presets';

export interface GlowImage {
  w: number;
  h: number;
  /** RGBA, as a glow map has it: the light given off at half intensity. */
  data: Uint8ClampedArray;
}

export interface GlowLayer {
  raw?: GlowImage;
  concierge?: GlowImage;
  /** Level pixels per pixel of the images. */
  scale: number;
  /** Where the images' first pixel is in the scene, in level pixels. */
  x0: number;
  y0: number;
  parallax: number;
  /** The street the people walk in, not a layer further away: its lights hang among them. */
  street: boolean;
}

/** One lit place in a glow map, in level pixels. */
export interface Glow {
  x: number;
  y: number;
  area: number;
  /** Its colour, the brightest channel 1. */
  c: [number, number, number];
  /** How bright it is at its brightest, 0 to 1. */
  peak: number;
}

/** How bright a glow-map pixel must be to count as lit, and how big a lit place must be, in level pixels. */
const LIT = 0.12, MIN_AREA = 40;

export interface FindOptions {
  /** How big a lit place must be, in level pixels. */
  minArea?: number;
  /** Below this, in level pixels, the ground: what glows there is the lights' reflections, so it is left out. */
  floor?: number;
}

/** The lit places in one glow map: pixels over LIT, joined where they nearly touch, each place with its middle and colour. */
export function findGlows(img: GlowImage, layer: Pick<GlowLayer, 'scale' | 'x0' | 'y0'>, { minArea = MIN_AREA, floor = Infinity }: FindOptions = {}): Glow[] {
  const { w, h, data } = img, lum = new Float32Array(w * h), on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = Math.max(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
    if (lum[i] > LIT && data[i * 4 + 3] > 0 && layer.y0 + ((i / w) | 0) * layer.scale < floor) on[i] = 1;
  }
  // a pixel next to a lit one joins it, so the bits of one sign or one window are one place
  const near = new Uint8Array(on);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on[y * w + x]) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) near[yy * w + xx] = 1; }
  }
  const seen = new Uint8Array(w * h), out: Glow[] = [], stack: number[] = [];
  for (let s = 0; s < w * h; s++) {
    if (!near[s] || seen[s]) continue;
    let n = 0, sw = 0, sx = 0, sy = 0, peak = 0;
    const col = [0, 0, 0];
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!, x = i % w, y = (i / w) | 0;
      if (on[i]) {
        const L = lum[i];
        n++; sw += L; sx += x * L; sy += y * L; peak = Math.max(peak, L);
        for (let c = 0; c < 3; c++) col[c] += (data[i * 4 + c] / 255) * L;
      }
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && near[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
    const area = n * layer.scale * layer.scale;
    if (area < minArea || sw <= 0) continue;
    const m = Math.max(col[0], col[1], col[2]) || 1;
    out.push({ x: layer.x0 + (sx / sw + 0.5) * layer.scale, y: layer.y0 + (sy / sw + 0.5) * layer.scale, area, c: [col[0] / m, col[1] / m, col[2] / m].map((v) => Math.round(v * 100) / 100) as [number, number, number], peak });
  }
  return out;
}

const saturated = (c: [number, number, number]) => (Math.max(...c) - Math.min(...c)) / Math.max(1e-6, Math.max(...c)) > 0.4;

/** A light for a lit place: reaching further the bigger it is, stronger the brighter. */
function lightFor(g: Glow, layer: GlowLayer, extra: Partial<PlacedLight>): PlacedLight {
  const l: PlacedLight = {
    x: Math.round(g.x), y: Math.round(g.y), z: 30,
    r: Math.round(Math.min(480, Math.max(90, 70 + 9 * Math.sqrt(g.area))) / 10) * 10,
    c: g.c, i: Math.round(Math.min(1.6, Math.max(0.5, 0.5 + g.peak * 0.9)) * 20) / 20, zone: 0,
    ...(layer.street && g.y > 0.45 * 540 ? { layer: 1 } : {}),
    ...(g.area < 800 ? { haze: 0.25 } : {}),
    ...(layer.parallax !== 1 ? { parallax: layer.parallax } : {}),
    ...extra,
    suggested: 1,
  };
  return l;
}

/**
 * Lights for the lit places of every layer, in both views. A place lit in both is one light in the Concierge's colour
 * (raw view turns lamps a pale white); lit only in the Concierge's view, a light of its view only; only in raw view, a
 * light of raw view, a machine's own if it is coloured. A place lit in both but coloured in raw view (a machine's eye
 * dressed up as a screen) gets one light for each view. None where a light is already, none in the ground's reflections
 * (below `floor`, the scene's reflection line), and the brightest `max` at most.
 */
export function suggestLights(layers: GlowLayer[], existing: { x: number; y: number }[], { max = 16, floor = Infinity } = {}): PlacedLight[] {
  const found: { l: PlacedLight; weight: number }[] = [];
  for (const layer of layers) {
    const find = (img?: GlowImage) => (img ? findGlows(img, layer, { floor }) : []);
    const conc = find(layer.concierge), raw = find(layer.raw);
    const used = new Set<Glow>();
    for (const g of conc) {
      const reach = Math.max(14, Math.sqrt(g.area) / 2);
      const twin = raw.filter((r) => !used.has(r)).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
      const both = twin && Math.hypot(twin.x - g.x, twin.y - g.y) <= reach;
      if (both) used.add(twin);
      if (both && saturated(twin.c)) {
        found.push({ l: lightFor(g, layer, { ar: 1 }), weight: g.area * g.peak });
        found.push({ l: lightFor(twin, layer, { raw: 1, machine: 1 }), weight: twin.area * twin.peak });
      } else found.push({ l: lightFor(g, layer, both ? {} : { ar: 1 }), weight: g.area * g.peak });
    }
    for (const r of raw) if (!used.has(r)) found.push({ l: lightFor(r, layer, saturated(r.c) ? { raw: 1, machine: 1 } : { raw: 1 }), weight: r.area * r.peak });
  }
  const out: PlacedLight[] = [];
  for (const { l } of found.sort((a, b) => b.weight - a.weight)) {
    if (out.length >= max) break;
    const taken = (p: { x: number; y: number }) => Math.hypot(p.x - l.x, p.y - l.y) < 28;
    if (existing.some(taken) || out.some((o) => taken(o) && !!o.ar === !!l.ar && !!o.raw === !!l.raw)) continue;
    out.push(l);
  }
  return out;
}
