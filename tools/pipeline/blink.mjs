// Her blink: her left eye shut in every frame she stands in facing left, the only side it shows on (her right eye has
// no lids, and its eyepiece covers it). One frame was touched once with the eye shut, the head's blink/<view>-shut.png
// beside the frame it was touched from (<view>-open.png); every outfit that shares that head (parts.same) takes the
// shut eye from it. In each standing frame the head is found where it has moved to, to a quarter of a pixel, and the
// eyelid set over the eye there. The frames land in blinkLeft/ beside idleLeft/, one for each, for build.
//
//   npm run asset -- blink <character recipe> [more...]      then build them; rig runs it after rendering
//
// Free: no image model.

import { existsSync } from 'node:fs';
import { mkdir, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { framesDir } from './build.mjs';
import { readRGBA, writePNG } from './image.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';

/** Where a character's head has its shut eye: its own folder, or the one it shares its head with. */
export const blinkDir = (r) => join(r.parts?.same?.parts?.includes('head') ? resolve(ROOT, r.parts.same.from) : r.dir, 'blink');

/** Catmull-Rom: a pixel's channel between pixels, as sharp as a quarter-pixel move allows. */
function bicubic(img, x, y, c) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const w = (t) => [((-t + 2) * t - 1) * t / 2, ((3 * t - 5) * t * t + 2) / 2, ((-3 * t + 4) * t + 1) * t / 2, (t - 1) * t * t / 2];
  const wx = w(fx), wy = w(fy);
  let s = 0;
  for (let j = 0; j < 4; j++) {
    const yy = Math.max(0, Math.min(img.h - 1, y0 - 1 + j));
    let row = 0;
    for (let i = 0; i < 4; i++) row += wx[i] * img.d[(yy * img.w + Math.max(0, Math.min(img.w - 1, x0 - 1 + i))) * 4 + c];
    s += wy[j] * row;
  }
  return s;
}

/**
 * Where the head is in `frame`, against `open`, the frame the eye was shut in: the move [dx, dy] that lays `open`'s
 * face around the eye (`around`, x0 y0 x1 y1) best over the frame's, to whole pixels, then to quarters; and how far
 * apart they still are, per channel. The head only moves as she stands, it does not turn.
 */
export function findHead(open, frame, around, reach = 24) {
  const pts = [];
  for (let y = around[1]; y <= around[3]; y++) for (let x = around[0]; x <= around[2]; x++) {
    const i = (y * open.w + x) * 4;
    if (open.d[i + 3] >= 250) pts.push([x, y, open.d[i], open.d[i + 1], open.d[i + 2]]);
  }
  const at = (x, y, c) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = (y0 * frame.w + x0) * 4 + c, r = frame.w * 4;
    return (frame.d[i] * (1 - fx) + frame.d[i + 4] * fx) * (1 - fy) + (frame.d[i + r] * (1 - fx) + frame.d[i + r + 4] * fx) * fy;
  };
  const off = (dx, dy) => {
    let s = 0;
    for (const [x, y, r, g, b] of pts) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= frame.w - 1 || Y >= frame.h - 1) return Infinity;
      const e0 = r - at(X, Y, 0), e1 = g - at(X, Y, 1), e2 = b - at(X, Y, 2);
      s += e0 * e0 + e1 * e1 + e2 * e2;
    }
    return Math.sqrt(s / pts.length / 3);
  };
  let best = [Infinity, 0, 0];
  for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) { const e = off(dx, dy); if (e < best[0]) best = [e, dx, dy]; }
  const [, ix, iy] = best;
  for (let dy = iy - 1; dy <= iy + 1; dy += 0.25) for (let dx = ix - 1; dx <= ix + 1; dx += 0.25) { const e = off(dx, dy); if (e < best[0]) best = [e, dx, dy]; }
  return { move: [best[1], best[2]], apart: best[0] };
}

/** Where `shut` differs from `open` on her face, 0 to 1, and the box around it. */
function lidOf(open, shut) {
  const W = open.w, H = open.h, k = new Float32Array(W * H);
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let p = 0; p < W * H; p++) {
    if (open.d[p * 4 + 3] < 250) continue;
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(open.d[p * 4 + c] - shut.d[p * 4 + c]));
    if (d > 2) { k[p] = Math.min(1, d / 24); const x = p % W, y = (p / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return { k, box: [x0, y0, x1, y1] };
}

/**
 * `frame` with the eye shut: what changed from `open` to `shut` on her face, softened at its edge, set over it moved by
 * `move`; its colours only, never over what is not her (the frame's own outline and alpha stay).
 */
export function shutEye(frame, open, shut, move) {
  const W = open.w, H = open.h, { k, box: [bx0, by0, bx1, by1] } = lidOf(open, shut);
  const out = { w: frame.w, h: frame.h, d: new Uint8ClampedArray(frame.d) };
  if (bx1 < bx0) return out;
  const [dx, dy] = move, mask = { w: W, h: H, d: new Float32Array(W * H * 4) };
  for (let p = 0; p < W * H; p++) mask.d[p * 4] = k[p];
  for (let y = Math.floor(by0 + dy) - 2; y <= Math.ceil(by1 + dy) + 2; y++) for (let x = Math.floor(bx0 + dx) - 2; x <= Math.ceil(bx1 + dx) + 2; x++) {
    if (x < 0 || y < 0 || x >= frame.w || y >= frame.h) continue;
    const i = (y * frame.w + x) * 4, m = Math.max(0, Math.min(1, bicubic(mask, x - dx, y - dy, 0))) * (frame.d[i + 3] / 255);
    if (m <= 0) continue;
    for (let c = 0; c < 3; c++) out.d[i + c] = frame.d[i + c] * (1 - m) + Math.max(0, Math.min(255, bicubic(shut, x - dx, y - dy, c))) * m;
  }
  return out;
}

export async function cmdBlink(files) {
  if (!files.length) throw new Error('usage: blink <character recipe> [more...]');
  for (const file of files) await blinkOne(await loadRecipe(file));
}

/** The recipe's standing-left frames, each with her left eye shut, into blinkLeft/. */
export async function blinkOne(r) {
  const src = blinkDir(r), dir = framesDir(r), out = join(dir, 'blinkLeft');
  if (!existsSync(join(dir, 'idleLeft'))) throw new Error(`${r.name}: no frames standing facing left in ${rel(dir)}`);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  for (const view of ['raw', 'concierge']) {
    if (!existsSync(join(src, `${view}-shut.png`))) throw new Error(`${r.name}: no shut eye at ${rel(join(src, `${view}-shut.png`))}`);
    const open = await readRGBA(join(src, `${view}-open.png`)), shut = await readRGBA(join(src, `${view}-shut.png`));
    // the face around the eye, where the head is looked for
    const [x0, y0, x1, y1] = lidOf(open, shut).box;
    if (x1 - x0 > 80 || y1 - y0 > 60) throw new Error(`${r.name}: the shut eye in ${rel(src)} differs from the open one in more than the eye (${x0},${y0} to ${x1},${y1})`);
    const around = [x0 - 12, y0 - 14, x1 + 8, y1 + 10], moves = [];
    for (const f of (await readdir(join(dir, 'idleLeft'))).filter((f) => f.startsWith(`${view}-`) && f.endsWith('.png')).sort()) {
      const frame = await readRGBA(join(dir, 'idleLeft', f)), { move, apart } = findHead(open, frame, around);
      if (apart > 16) console.warn(`${r.name} ${view} ${f}: the head was not found well (${apart.toFixed(1)} apart); look at it`);
      await writePNG(join(out, f), shutEye(frame, open, shut, move));
      moves.push(move.join(','));
    }
    console.log(`${r.name} ${view}: her left eye shut in ${moves.length} frames, the head moved ${[...new Set(moves)].join(' ')}`);
  }
  console.log(`  → ${rel(out)}`);
}
