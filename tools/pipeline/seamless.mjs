// Make an image horizontally seamless (tileable left-to-right) so the map can repeat it to any width with no visible
// join. Method: over a narrow band at each vertical edge, cross-blend the two edges toward each other so column 0 and
// column W-1 meet smoothly. Best on an even, landmark-free skyline. Operates in place on the picked art (run before
// `build`, so the glow map inherits the seamless result).
//
// Usage: node tools/pipeline/seamless.mjs <image.png> [bandFraction]
//   bandFraction: how wide the blended band at each edge is, as a fraction of width (default 0.10)

import { readRGBA, writePNG } from './image.mjs';

const path = process.argv[2];
if (!path) { console.error('usage: seamless.mjs <image.png> [bandFraction]'); process.exit(1); }
const band = Number(process.argv[3] ?? 0.1);

const { w: W, h: H, d } = await readRGBA(path);
const out = new Uint8ClampedArray(d); // copy
const bandPx = Math.max(2, Math.floor(W * band));
const idx = (x, y) => (y * W + x) * 4;

// The seam where the right edge (x=W-1) meets the left edge (x=0) when tiled: blend a band of width bandPx on each side
// toward its tiling partner, so both edges converge. Weight is 1 (keep own) deep inside and 0.5 at the very edge, where
// the two sides average and therefore match.
for (let y = 0; y < H; y++) {
  for (let i = 0; i < bandPx; i++) {
    const wgt = 0.5 + 0.5 * (i / bandPx); // 0.5 at the edge → 1.0 inside
    const l = idx(i, y), r = idx(W - 1 - i, y);
    const lr = d[l], lg = d[l + 1], lb = d[l + 2];
    const rr = d[r], rg = d[r + 1], rb = d[r + 2];
    out[l] = lr * wgt + rr * (1 - wgt); out[l + 1] = lg * wgt + rg * (1 - wgt); out[l + 2] = lb * wgt + rb * (1 - wgt);
    out[r] = rr * wgt + lr * (1 - wgt); out[r + 1] = rg * wgt + lg * (1 - wgt); out[r + 2] = rb * wgt + lb * (1 - wgt);
  }
}
await writePNG(path, { w: W, h: H, d: out });
console.log(`seamless: ${path} (${W}x${H}), blended ${bandPx}px edge bands`);
