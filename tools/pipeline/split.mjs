// Layer maps: which layer of a scene each pixel of its picture belongs to, for splitting it into layers that move at
// their own speed. The map is a plain picture, one flat colour per layer, back to front in the order of LAYER_COLOURS,
// so it can be painted over by hand in any paint program.

import { blank } from './image.mjs';

/** The colours of the layers in a map, from the furthest to the nearest. */
export const LAYER_COLOURS = [[40, 90, 255], [40, 210, 110], [255, 60, 70], [255, 220, 40], [220, 60, 220], [60, 220, 220]];
export const LAYER_COLOUR_NAMES = ['blue', 'green', 'red', 'yellow', 'magenta', 'cyan'];

/**
 * A first map from the picture's depth (0 far to 1 near, see depth.mjs): everything below `ground` (the walk line, in
 * the picture's pixels) is the nearest layer, as the street she walks on; above it the depth falls into `n` bands, found
 * by clustering. Then `fixes`, rectangles (`rect`) or polygons (`poly`) in the picture's pixels, move what is in them to
 * a layer (`to`), all of it or only what is in the layers `from`; and specks smaller than `speck` pixels join the layer
 * around them. A polygon is traced around something with a shape of its own, such as a street lamp: rectangles around
 * one take the lit air around it along, and that slides with it as a box. `rim` (pixels) cleans up the thin rings the
 * depth leaves around near things' soft edges.
 */
export function draftLayerMap(depth, w, h, { n, ground, fixes = [], speck = 400, rim = 0 }) {
  // the bands: k-means over the depth above the ground
  const vals = [];
  for (let y = 0; y < Math.min(h, ground); y += 2) for (let x = 0; x < w; x += 2) vals.push(depth[y * w + x]);
  vals.sort((a, b) => a - b);
  let centres = Array.from({ length: n }, (_, k) => vals[Math.floor(((k + 0.5) / n) * vals.length)] ?? k / n);
  const nearestCentre = (v) => { let b = 0; for (let k = 1; k < n; k++) if (Math.abs(v - centres[k]) < Math.abs(v - centres[b])) b = k; return b; };
  for (let it = 0; it < 30; it++) {
    const sum = new Array(n).fill(0), count = new Array(n).fill(0);
    for (const v of vals) { const b = nearestCentre(v); sum[b] += v; count[b]++; }
    centres = centres.map((c, k) => (count[k] ? sum[k] / count[k] : c)).sort((a, b) => a - b);
  }
  const L = new Uint8Array(w * h);
  for (let i = 0; i < L.length; i++) L[i] = Math.floor(i / w) >= ground ? n - 1 : nearestCentre(depth[i]);
  // a near thing's soft edge has a depth between it and what is behind it, so it comes out as a thin ring of a layer in
  // between, which would slide out from behind it as its ghost: a band of a middle layer no wider than `rim` with a nearer
  // layer on one side and a further one on the other joins the nearer
  if (rim > 0) for (let k = 1; k < n - 1; k++) {
    const nearer = new Uint8Array(w * h), further = new Uint8Array(w * h);
    for (let i = 0; i < L.length; i++) { nearer[i] = L[i] > k ? 1 : 0; further[i] = L[i] < k ? 1 : 0; }
    const dn = distanceFrom(nearer, w, h), df = distanceFrom(further, w, h);
    for (let i = 0; i < L.length; i++) if (L[i] === k && dn[i] <= rim && df[i] <= rim) L[i] = k + 1;
  }
  for (const f of fixes) {
    // a rectangle, or a polygon traced around something with a shape of its own, such as a street lamp
    const [fx, fy, fw, fh] = f.rect ?? boundsOf(f.poly);
    for (let y = Math.max(0, fy); y < Math.min(h, fy + fh); y++) for (let x = Math.max(0, fx); x < Math.min(w, fx + fw); x++) {
      const i = y * w + x;
      if (f.poly && !insidePoly(f.poly, x + 0.5, y + 0.5)) continue;
      if (!f.from || f.from.includes(L[i])) L[i] = f.to;
    }
  }
  mergeSpecks(L, w, h, n, speck);
  return L;
}

const boundsOf = (poly) => {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]), x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  return [x, y, Math.ceil(Math.max(...xs)) - x + 1, Math.ceil(Math.max(...ys)) - y + 1];
};

function insidePoly(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Regions of one layer smaller than `min` pixels take the layer most of their neighbours are in. */
function mergeSpecks(L, w, h, n, min) {
  const seen = new Uint8Array(w * h), stack = [], comp = [];
  const around = (i) => { const x = i % w, y = (i / w) | 0; return [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]; };
  for (let s = 0; s < L.length; s++) {
    if (seen[s]) continue;
    const lab = L[s];
    comp.length = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      comp.push(i);
      for (const j of around(i)) if (j >= 0 && !seen[j] && L[j] === lab) { seen[j] = 1; stack.push(j); }
    }
    if (comp.length >= min) continue;
    const votes = new Array(n).fill(0);
    for (const i of comp) for (const j of around(i)) if (j >= 0 && L[j] !== lab) votes[L[j]]++;
    const best = votes.indexOf(Math.max(...votes));
    if (votes[best] > 0) for (const i of comp) L[i] = best;
  }
}

/** The map as a picture: each pixel its layer's colour. */
export function layerMapImage(L, w, h) {
  const img = blank(w, h, [0, 0, 0, 255]);
  for (let i = 0; i < L.length; i++) img.d.set(LAYER_COLOURS[L[i]], i * 4);
  return img;
}

/**
 * Unknown pixels filled smoothly from the known ones around them (push-pull, then softened): where a nearer thing hid
 * a layer, the colours of what is around it, with no shape of its own. An image model painting over a flat colour in
 * the hidden thing's shape paints the thing back, as a dark silhouette; over this it paints what is behind.
 * `rgba` is the layer's pixels, `known` 1 where they are its own. Returns RGBA bytes.
 */
export function pushPull(rgba, known, w, h) {
  const levels = [];
  let lw = w, lh = h, c = new Float32Array(w * h * 3), a = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) if (known[i]) { a[i] = 1; for (let k = 0; k < 3; k++) c[i * 3 + k] = rgba[i * 4 + k]; }
  levels.push({ w: lw, h: lh, c, a });
  // push: sums and counts, halving until one pixel
  while (lw > 1 || lh > 1) {
    const nw = Math.max(1, Math.ceil(lw / 2)), nh = Math.max(1, Math.ceil(lh / 2)), nc = new Float32Array(nw * nh * 3), na = new Float32Array(nw * nh);
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) { const i = y * lw + x, j = (y >> 1) * nw + (x >> 1); na[j] += a[i]; for (let k = 0; k < 3; k++) nc[j * 3 + k] += c[i * 3 + k]; }
    levels.push({ w: nw, h: nh, c: nc, a: na });
    lw = nw; lh = nh; c = nc; a = na;
  }
  // pull: a pixel with nothing known in it takes the average of the coarser one over it, sampled between its neighbours
  for (let l = levels.length - 2; l >= 0; l--) {
    const L = levels[l], U = levels[l + 1];
    const avg = (x, y, k) => { const X = Math.min(U.w - 1, Math.max(0, x)), Y = Math.min(U.h - 1, Math.max(0, y)), j = Y * U.w + X; return U.a[j] > 0 ? U.c[j * 3 + k] / U.a[j] : null; };
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x;
      if (L.a[i] > 0) continue;
      const fx = (x + 0.5) / 2 - 0.5, fy = (y + 0.5) / 2 - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      for (let k = 0; k < 3; k++) {
        let s = 0, wt = 0;
        for (const [dx, dy, ww] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]]) { const v = avg(x0 + dx, y0 + dy, k); if (v !== null) { s += v * ww; wt += ww; } }
        L.c[i * 3 + k] = wt > 0 ? s / wt : 0;
      }
      L.a[i] = 1;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4), L0 = levels[0];
  for (let i = 0; i < w * h; i++) { for (let k = 0; k < 3; k++) out[i * 4 + k] = L0.c[i * 3 + k] / L0.a[i]; out[i * 4 + 3] = 255; }
  return out;
}

/** The map laid over the picture, to check it by eye. */
export function layerPreview(L, pic) {
  const img = blank(pic.w, pic.h, [0, 0, 0, 255]);
  for (let i = 0; i < L.length; i++) for (let c = 0; c < 3; c++) img.d[i * 4 + c] = Math.round(pic.d[i * 4 + c] * 0.55 + LAYER_COLOURS[L[i]][c] * 0.45);
  return img;
}

/** A map read back, painted over or not: each pixel the layer whose colour is nearest. */
export function readLayerMap(img, n) {
  const L = new Uint8Array(img.w * img.h);
  for (let i = 0; i < L.length; i++) {
    let best = 0, bd = Infinity;
    for (let k = 0; k < n; k++) {
      const c = LAYER_COLOURS[k], d = (img.d[i * 4] - c[0]) ** 2 + (img.d[i * 4 + 1] - c[1]) ** 2 + (img.d[i * 4 + 2] - c[2]) ** 2;
      if (d < bd) { bd = d; best = k; }
    }
    L[i] = best;
  }
  return L;
}

/** How far each pixel is from the nearest pixel that is on, in pixels (a chamfer distance, for bands around shapes). */
export function distanceFrom(on, w, h) {
  const D = new Float32Array(w * h);
  for (let i = 0; i < D.length; i++) D[i] = on[i] ? 0 : 1e9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!D[i]) continue;
    if (x > 0) D[i] = Math.min(D[i], D[i - 1] + 1);
    if (y > 0) { D[i] = Math.min(D[i], D[i - w] + 1); if (x > 0) D[i] = Math.min(D[i], D[i - w - 1] + 1.414); if (x < w - 1) D[i] = Math.min(D[i], D[i - w + 1] + 1.414); }
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!D[i]) continue;
    if (x < w - 1) D[i] = Math.min(D[i], D[i + 1] + 1);
    if (y < h - 1) { D[i] = Math.min(D[i], D[i + w] + 1); if (x < w - 1) D[i] = Math.min(D[i], D[i + w + 1] + 1.414); if (x > 0) D[i] = Math.min(D[i], D[i + w - 1] + 1.414); }
  }
  return D;
}
