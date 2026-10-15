// Cleaning generated art: drop flat backgrounds, find the subject, scale to game size, hard pixel edges, pull toward the palette.

import { blank, crop, resize } from './image.mjs';

/** True when the image has no meaningful transparency (a generator ignored the transparent background). */
export function isOpaque(img) {
  let n = 0;
  for (let i = 3; i < img.d.length; i += 4) if (img.d[i] < 250) n++;
  return n < img.w * img.h * 0.01;
}

/**
 * Remove a flat background by flood fill from the borders: pixels connected to the edge and close in colour
 * to the border's typical colour become transparent. Works for art rendered on a plain backdrop.
 */
export function removeFlatBackground(img, tolerance = 20) {
  const { w, h, d } = img;
  const border = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
  const med = [0, 1, 2].map((c) => { const v = border.map((p) => d[p * 4 + c]).sort((a, b) => a - b); return v[v.length >> 1]; });
  const close = (p) => Math.abs(d[p * 4] - med[0]) + Math.abs(d[p * 4 + 1] - med[1]) + Math.abs(d[p * 4 + 2] - med[2]) < tolerance * 3;
  const seen = new Uint8Array(w * h), stack = border.filter(close);
  for (const p of stack) seen[p] = 1;
  while (stack.length) {
    const p = stack.pop();
    d[p * 4 + 3] = 0;
    const x = p % w, y = (p / w) | 0;
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q >= 0 && !seen[q] && close(q)) { seen[q] = 1; stack.push(q); }
    }
  }
  return img;
}

/** Bounding box of pixels with alpha above the threshold, padded. */
export function contentBox(img, pad = 2, threshold = 128) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    if (img.d[(y * img.w + x) * 4 + 3] >= threshold) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error('the image is empty after removing the background');
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 1 + pad * 2, h: y1 - y0 + 1 + pad * 2 };
}

export function unionBox(a, b) {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Crop to the box and scale so the box is `height` pixels tall. */
export async function fitToHeight(img, box, height) {
  const cut = crop(img, box.x, box.y, box.w, box.h);
  const s = height / box.h;
  return resize(cut, Math.max(1, Math.round(box.w * s)), height);
}

/** Hard pixel-art edges: alpha becomes 0 or 255. */
export function hardenAlpha(img, threshold = 128) {
  for (let i = 3; i < img.d.length; i += 4) img.d[i] = img.d[i] >= threshold ? 255 : 0;
  return img;
}

/* ---------- palette fitting in OKLab, a colour space where distances match what we see ---------- */

const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const toSrgb = (c) => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055)));
function oklab(r, g, b) {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function fromOklab(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s), toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s), toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)];
}

/**
 * Pull colours toward the house palette. strength 0 leaves the art alone, 1 snaps every pixel to its nearest palette colour.
 * Lightness keeps more of the original than hue, so shading survives a strong pull.
 */
export function paletteFit(img, hexes, strength) {
  if (strength <= 0) return img;
  const pal = hexes.map((h) => { const n = parseInt(h.slice(1), 16); return oklab(n >> 16, (n >> 8) & 255, n & 255); });
  const cache = new Map();
  for (let i = 0; i < img.d.length; i += 4) {
    if (!img.d[i + 3]) continue;
    const key = (img.d[i] << 16) | (img.d[i + 1] << 8) | img.d[i + 2];
    let out = cache.get(key);
    if (!out) {
      const [L, A, B] = oklab(img.d[i], img.d[i + 1], img.d[i + 2]);
      let best = pal[0], bd = Infinity;
      for (const p of pal) { const dd = (p[0] - L) ** 2 * 0.6 + (p[1] - A) ** 2 + (p[2] - B) ** 2; if (dd < bd) { bd = dd; best = p; } }
      out = fromOklab(L + (best[0] - L) * strength * 0.7, A + (best[1] - A) * strength, B + (best[2] - B) * strength);
      cache.set(key, out);
    }
    img.d[i] = out[0]; img.d[i + 1] = out[1]; img.d[i + 2] = out[2];
  }
  return img;
}

/** One image with the shape of both views: the raw pixels, and the Concierge pixels where raw is empty. */
export function overlay(raw, conc) {
  const out = { w: raw.w, h: raw.h, d: new Uint8ClampedArray(raw.d) };
  for (let i = 3; i < out.d.length; i += 4) if (out.d[i] < 128 && conc.d[i] >= 128) out.d.set(conc.d.subarray(i - 3, i + 1), i - 3);
  return out;
}

/** Share of pixels whose shape agrees between two images of the same size (intersection over union of their alpha). */
export function silhouetteMatch(a, b) {
  let inter = 0, uni = 0;
  for (let i = 3; i < a.d.length; i += 4) { const x = a.d[i] > 127, y = b.d[i] > 127; if (x && y) inter++; if (x || y) uni++; }
  return uni ? inter / uni : 1;
}

export { blank };
