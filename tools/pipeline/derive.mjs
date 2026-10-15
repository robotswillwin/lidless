// Deriving the lighting maps from a cleaned sprite: height, normals, material, meta and glow (see docs/ASSETS.md).

import { blank } from './image.mjs';

const lumOf = (d, i) => (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;

/** Distance in pixels from each opaque pixel to the nearest transparent one (two-pass chamfer). */
function distanceInside(img) {
  const { w, h, d } = img, D = new Float32Array(w * h);
  for (let i = 0; i < D.length; i++) D[i] = d[i * 4 + 3] > 127 ? 1e9 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!D[i]) continue; let m = D[i];
    if (x > 0) m = Math.min(m, D[i - 1] + 1);
    if (y > 0) { m = Math.min(m, D[i - w] + 1); if (x > 0) m = Math.min(m, D[i - w - 1] + 1.414); if (x < w - 1) m = Math.min(m, D[i - w + 1] + 1.414); }
    D[i] = m;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x; if (!D[i]) continue; let m = D[i];
    if (x < w - 1) m = Math.min(m, D[i + 1] + 1);
    if (y < h - 1) { m = Math.min(m, D[i + w] + 1); if (x < w - 1) m = Math.min(m, D[i + w + 1] + 1.414); if (x > 0) m = Math.min(m, D[i + w - 1] + 1.414); }
    D[i] = m;
  }
  return D;
}

function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += src[y * w + xx]; n++; } } tmp[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++; } } out[y * w + x] = s / n; }
  return out;
}

/**
 * Height for lighting: the outline is inflated into a soft volume (round = how many pixels it takes to reach full height),
 * plus small surface detail from the art's own light and dark.
 */
export function heightMap(img, { round = 8, rh = 0.5, detail = 0.12 } = {}) {
  const { w, h, d } = img, N = w * h, D = distanceInside(img), L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = lumOf(d, i * 4);
  const M = boxBlur(L, w, h, 2), H = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    if (d[i * 4 + 3] <= 127) { H[i] = 0.5; continue; }
    const vol = round > 0 ? rh * Math.sqrt(Math.min(1, D[i] / round)) : 0;
    H[i] = Math.max(0, Math.min(1, 0.5 + vol * 0.9 + detail * (L[i] - M[i]) * 2));
  }
  return H;
}

/** Normals from height, with the same scale and orientation the engine expects (x right, y up in image space). */
export function normalMap(H, w, h) {
  const out = blank(w, h, [128, 128, 255, 255]), at = (x, y) => H[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx = -(at(x + 1, y) - at(x - 1, y)) * 5, ny = -(at(x, y + 1) - at(x, y - 1)) * 5, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * w + x) * 4;
    out.d[i] = Math.round((nx * 0.5 + 0.5) * 255); out.d[i + 1] = Math.round((ny * 0.5 + 0.5) * 255); out.d[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
  }
  return out;
}

export const MATERIALS = {
  cloth: [0.05, 0.3], leather: [0.35, 0.62], metal: [0.55, 0.72], plastic: [0.4, 0.6], skin: [0.12, 0.4],
  stone: [0.06, 0.25], wood: [0.15, 0.45], glass: [0.95, 0.95], wet: [0.5, 0.8], paper: [0.03, 0.2],
};

/** Shine strength and sharpness from the material, with a little more shine on brighter parts; height in blue. */
export function materialMap(img, H, material) {
  const [spec, shin] = MATERIALS[material] ?? MATERIALS.cloth, out = blank(img.w, img.h, [0, 0, 0, 255]);
  for (let p = 0, i = 0; p < H.length; p++, i += 4) {
    const k = 0.75 + 0.5 * lumOf(img.d, i);
    out.d[i] = Math.round(Math.min(1, spec * k) * 255); out.d[i + 1] = Math.round(shin * 255); out.d[i + 2] = Math.round(H[p] * 255);
  }
  return out;
}

/** Whether a pixel looks different in the Concierge view (its normals then flatten in that view). */
function differs(raw, conc, i) {
  if ((raw.d[i + 3] > 127) !== (conc.d[i + 3] > 127)) return true;
  return Math.abs(raw.d[i] - conc.d[i]) + Math.abs(raw.d[i + 1] - conc.d[i + 1]) + Math.abs(raw.d[i + 2] - conc.d[i + 2]) > 36;
}

/** Packed per-pixel flags: shadow-casting, view difference, object id, depth, reflectivity and light groups. */
export function metaMap(raw, conc, { occluder = true, object = 0, depth = 3, reflectivity = 0, groupRaw = 0, groupConcierge = 0 } = {}) {
  const out = blank(raw.w, raw.h, [0, 0, 0, 255]);
  for (let i = 0; i < out.d.length; i += 4) {
    out.d[i] = (occluder ? 128 : 0) + (conc && differs(raw, conc, i) ? 64 : 0) + Math.min(63, object);
    out.d[i + 1] = Math.min(3, depth) * 64 + Math.min(2, reflectivity) * 16;
    out.d[i + 2] = Math.min(15, groupRaw) * 16 + Math.min(15, groupConcierge);
  }
  return out;
}

/**
 * Light the surface gives off, found in the art itself: bright, saturated pixels (neon, screens, flames) and near-white hot spots.
 * Stored at half intensity, as the engine expects.
 */
export function glowAuto(img, { threshold = 0.7, strength = 1.1 } = {}) {
  const out = blank(img.w, img.h, [0, 0, 0, 255]);
  for (let i = 0; i < img.d.length; i += 4) {
    if (img.d[i + 3] <= 127) continue;
    const r = img.d[i] / 255, g = img.d[i + 1] / 255, b = img.d[i + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx > 0 ? (mx - mn) / mx : 0, lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const e = Math.max(0, Math.min(1, (Math.max(lum, mx * sat) - threshold) / (1 - threshold))) * (0.35 + 0.65 * sat) * strength;
    if (e <= 0) continue;
    const half = (c) => Math.round(Math.min(255, (c * e) / 2 * 255));
    out.d[i] = half(r); out.d[i + 1] = half(g); out.d[i + 2] = half(b);
  }
  return out;
}
