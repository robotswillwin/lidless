// A censored outfit from an underwear outfit's parts: the underwear becomes her skin, filled in from around it, and a
// small mosaic of her skin's tones covers where her nipples and her vulva would be. Nothing anatomical is drawn anywhere, under the mosaic or outside it: only smooth skin. No
// image model is involved.
//   node tools/pipeline/censor.mjs <from recipe> <to recipe> [--block 12] [--patch 3]
// The underwear is found in the parts as they were cut, before any recolouring (--fabric <git commit> takes them from
// there, where the fabric was dark): every dark region wider than a line, and the dark pixels joined to it inside her
// body. The new outfit's parts are the old one's with the torso and the hips censored; rig and build it as any outfit.

import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { loadRecipe, ROOT } from './recipe.mjs';

const lumOf = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
const morph = (m, w, h, r, grow) => {
  const o = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = grow ? 0 : 1;
    for (let dy = -r; dy <= r && (grow ? !v : v); dy++) for (let dx = -r; dx <= r; dx++) {
      const xx = x + dx, yy = y + dy, s = xx >= 0 && yy >= 0 && xx < w && yy < h ? m[yy * w + xx] : 0;
      if (grow ? s : !s) { v = grow ? 1 : 0; break; }
    }
    o[y * w + x] = v;
  }
  return o;
};

/** Where the underwear is in a piece as cut, its fabric dark: its main parts, and its thin straps. */
export function fabricOf(d, w, h) {
  const dark = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) dark[i] = d[i * 4 + 3] > 100 && lumOf(d, i * 4) < 75 ? 1 : 0;
  const main = morph(morph(dark, w, h, 2, false), w, h, 3, true), all = Uint8Array.from(main);
  const edge = morph(Uint8Array.from({ length: w * h }, (_, i) => (d[i * 4 + 3] > 100 ? 0 : 1)), w, h, 2, true);
  const queue = [];
  for (let i = 0; i < w * h; i++) if (all[i] && dark[i]) queue.push(i);
  while (queue.length) {
    const i = queue.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * w + xx;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || all[j] || edge[j] || d[j * 4 + 3] <= 100 || lumOf(d, j * 4) >= 90) continue;
      all[j] = 1;
      queue.push(j);
    }
  }
  // the thin parts joined to it (straps) as well as any dark line pixels: everything dark in the body near the fabric
  return { main, all: morph(all, w, h, 1, true) };
}

/** Three passes of a box blur, `r` pixels each way: about a Gaussian. */
function blurField(f, w, h, r) {
  let a = f, t = new Float32Array(w * h);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { t[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    const u = new Float32Array(w * h);
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += t[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { u[y * w + x] = s / (2 * r + 1); s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
    a = u;
  }
  return a;
}

/**
 * The fabric under `mask` replaced by her skin: a smooth field of the skin's colour, averaged from the skin away from
 * the fabric (the art shades the skin next to a garment darker, which filled in would leave a band where it was), blended
 * into the skin around over `R` pixels, so it has no shape of its own. Where the fabric made her outline, her outline is
 * drawn again in its colour elsewhere.
 */
export function fillSkin(d, w, h, mask, R = 8) {
  const N = w * h, A = (i) => d[i * 4 + 3];
  // how far each pixel of her body is from the fabric, up to R
  const dist = new Float32Array(N).fill(Infinity), queue = [];
  for (let i = 0; i < N; i++) if (mask[i]) { dist[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % w, y = (i / w) | 0;
    if (dist[i] >= R) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * w + xx;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || A(j) < 100 || dist[j] <= dist[i] + 1) continue;
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  const edge = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (A(i) < 100) continue;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h || A(yy * w + xx) < 100) { edge[i] = 1; break; } }
  }
  // the skin's colour, smoothed from clean skin only
  const wt = new Float32Array(N), ch = [0, 1, 2].map(() => new Float32Array(N));
  for (let i = 0; i < N; i++) if (A(i) > 200 && dist[i] > R && !edge[i] && lumOf(d, i * 4) >= 120) { wt[i] = 1; for (let c = 0; c < 3; c++) ch[c][i] = d[i * 4 + c]; }
  const bw = blurField(wt, w, h, 18), field = ch.map((f) => blurField(f, w, h, 18));
  // her outline's colour, where it is not the fabric's
  let oc = [0, 0, 0], on = 0;
  for (let i = 0; i < N; i++) if (edge[i] && dist[i] > R && A(i) > 200) { for (let c = 0; c < 3; c++) oc[c] += d[i * 4 + c]; on++; }
  oc = on ? oc.map((v) => v / on) : null;
  for (let i = 0; i < N; i++) {
    if (dist[i] > R || A(i) < 100 || bw[i] < 1e-7) continue;
    const k = mask[i] ? 1 : 1 - dist[i] / (R + 1);
    for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.round(d[i * 4 + c] * (1 - k) + (field[c][i] / bw[i]) * k);
    if (mask[i] && edge[i] && oc) d.set(oc.map(Math.round), i * 4);
  }
}

/**
 * A small mosaic, `n` by `n` blocks of `block` pixels, centred on (cx, cy): each block the average of the skin under it,
 * a little lighter or darker, so it reads as a censor's mosaic. It covers past her outline too, as a censor does.
 */
export function patch(d, w, h, cx, cy, block, n) {
  const x0 = Math.round(cx - (n * block) / 2), y0 = Math.round(cy - (n * block) / 2);
  for (let by = 0; by < n; by++) for (let bx = 0; bx < n; bx++) {
    const X = x0 + bx * block, Y = y0 + by * block;
    let r = 0, g = 0, b = 0, m = 0;
    for (let y = Math.max(0, Y); y < Math.min(h, Y + block); y++) for (let x = Math.max(0, X); x < Math.min(w, X + block); x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 100 || lumOf(d, i) < 90) continue;
      r += d[i]; g += d[i + 1]; b += d[i + 2]; m++;
    }
    if (!m) continue;
    const k = 1 + 0.1 * (((bx * 7 + by * 13) % 5) - 2) / 2;
    const col = [r / m, g / m, b / m].map((c) => Math.max(0, Math.min(255, Math.round(c * k))));
    for (let y = Math.max(0, Y); y < Math.min(h, Y + block); y++) for (let x = Math.max(0, X); x < Math.min(w, X + block); x++) d.set([...col, 255], (y * w + x) * 4);
  }
}

/** Where the front of a piece is: the side her chest faces, from its joints (every set faces right, or is drawn facing left). */
const facesRight = (joints) => (joints.bust && joints.neck ? joints.bust[0] >= joints.neck[0] : true);

/** The fabric's front-most point within rows y0..y1: its outline's furthest pixel the way she faces. */
function frontmost(mask, w, y0, y1, right) {
  let best = null;
  for (let y = Math.max(0, Math.round(y0)); y <= Math.round(y1); y++) for (let x = 0; x < w; x++) {
    if (!mask[y * w + x]) continue;
    if (!best || (right ? x > best[0] : x < best[0])) best = [x, y];
  }
  return best;
}

/**
 * Where underwear can be on her, seen whole from the front or the back: her torso and hips, below her neck and between
 * her arms; not her hair, her eyepiece or the devices on her wrists, which are dark too. Also her figure's box.
 */
export function underwearBand(d, w, h) {
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 100) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const mid = (x0 + x1) / 2, H = y1 - y0, reach = (x1 - x0) * 0.27, top = y0 + H * 0.19, bottom = y0 + H * 0.6;
  const band = new Uint8Array(w * h);
  for (let y = Math.ceil(top); y < bottom; y++) for (let x = Math.ceil(mid - reach); x < mid + reach; x++) band[y * w + x] = 1;
  return { band, box: [x0, y0, x1, y1] };
}

/**
 * Her underwear in a whole picture of her: the dark fabric on her torso and hips, and what reaches out from it, its
 * straps over her shoulders, as far as her collarbones and no further out than her shoulders.
 */
export function underwearOf(d, w, h) {
  const { main, all } = fabricOf(d, w, h), { band, box } = underwearBand(d, w, h), N = w * h;
  const [x0, y0, x1, y1] = box, H = y1 - y0, mid = (x0 + x1) / 2, reach = (x1 - x0) * 0.3, top = y0 + H * 0.12, bottom = y0 + H * 0.62;
  // a strap is a thin line: out of the band, only narrow runs of the dark, never a lock of dark hair lying on it
  const thin = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; ) {
    if (!all[y * w + x]) { x++; continue; }
    let e = x;
    while (e < w && all[y * w + e]) e++;
    if (e - x <= Math.max(6, (x1 - x0) * 0.035)) for (let k = x; k < e; k++) thin[y * w + k] = 1;
    x = e;
  }
  const keep = new Uint8Array(N), queue = [];
  for (let i = 0; i < N; i++) if (all[i] && band[i]) { keep[i] = 1; queue.push(i); }
  while (queue.length) {
    const i = queue.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy, j = yy * w + xx;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || keep[j] || !all[j] || (!band[j] && !thin[j]) || yy < top || yy > bottom || Math.abs(xx - mid) > reach) continue;
      keep[j] = 1;
      queue.push(j);
    }
  }
  for (let i = 0; i < N; i++) if (!keep[i]) main[i] = 0;
  return { main, all: keep, box };
}

/**
 * The same for her seen from the front, a whole picture of her in her underwear (black): the underwear turned to skin,
 * and a mosaic over each nipple, at each cup's middle, and over her vulva, where the briefs narrow between her legs.
 */
export function censorFront(d, w, h, block = 12, n = 3) {
  const { main, all, box: [x0, y0, x1, y1] } = underwearOf(d, w, h);
  const cut = Uint8Array.from(main);
  fillSkin(d, w, h, all);
  // her middle, and where the fabric is: the bra above her waist (her chest only, within her shoulders), the briefs below
  const mid = (x0 + x1) / 2, H = y1 - y0, chest = y0 + H * 0.2, waist = y0 + H * 0.42, reach = (x1 - x0) * 0.22;
  const cups = [[0, 0, 0], [0, 0, 0]], briefs = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!cut[y * w + x]) continue;
    if (y >= chest && y < waist && Math.abs(x - mid) < reach) { const c = cups[x < mid ? 0 : 1]; c[0] += x; c[1] += y; c[2]++; } else if (y >= waist) briefs.push([x, y]);
  }
  const at = [];
  for (const [sx, sy, m] of cups) if (m) at.push([sx / m, sy / m + block * 0.4]);
  // the briefs' lowest point near her middle, a little above it
  const low = briefs.filter(([x]) => Math.abs(x - mid) < (x1 - x0) * 0.08).reduce((a, b) => (!a || b[1] > a[1] ? b : a), null);
  if (low) at.push([mid, low[1] - block * 1.3]);
  for (const [cx, cy] of at) patch(d, w, h, cx, cy, block, n);
  return at;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {
const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]);
const [fromFile, toFile] = pos;
if (!fromFile || !toFile) throw new Error('usage: node tools/pipeline/censor.mjs <from recipe> <to recipe> [--block 12] [--patch 3] [--fabric <git commit>]');
const from = await loadRecipe(fromFile), to = await loadRecipe(toFile), block = Number(opt.block ?? 12), n = Number(opt.patch ?? 3);
const src = join(from.dir, 'parts'), dst = join(to.dir, 'parts');
await mkdir(dst, { recursive: true });
await copyFile(join(src, 'parts.json'), join(dst, 'parts.json'));
const info = JSON.parse(await readFile(join(src, 'parts.json'), 'utf8')), placed = [];
for (const view of ['raw', 'concierge', 'raw-left', 'concierge-left']) {
  if (!existsSync(join(src, view))) continue;
  await mkdir(join(dst, view), { recursive: true });
  for (const f of await readdir(join(src, view))) {
    const file = join(src, view, f), out = join(dst, view, f);
    if (!['torso.png', 'coat.png'].includes(f)) { await copyFile(file, out); continue; }
    // the fabric from the parts as cut (dark), the colours from the parts as they are now
    const cut = opt.fabric ? execFileSync('git', ['show', `${opt.fabric}:${relative(ROOT, file)}`], { cwd: ROOT, maxBuffer: 1 << 26 }) : await readFile(file);
    const c = await sharp(cut).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), { width: w, height: h } = c.info;
    const now = await sharp(file).ensureAlpha().raw().toBuffer(), d = Buffer.from(now);
    const { main, all } = fabricOf(c.data, w, h);
    fillSkin(d, w, h, all);
    // where it faces, from the torso's joints (the hips have none of their own to say)
    const right = facesRight(info[view]?.torso?.joints ?? {});
    let ys = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (main[y * w + x]) { ys.push(y); break; }
    if (!ys.length) { await sharp(d, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out); continue; }
    const top = ys[0], bottom = ys[ys.length - 1], tall = bottom - top;
    // her nipple: the cup's front-most point, a little inside it; her vulva: the briefs' lowest point, where their front
    // narrows between her legs
    const at = f === 'torso.png'
      ? (() => { const p = frontmost(main, w, top, top + tall * 0.75, right); return p && [p[0] + (right ? -1 : 1) * block * 0.6, p[1]]; })()
      : (() => { let p = null; for (let y = bottom; y >= top && !p; y--) for (let x = 0; x < w; x++) if (main[y * w + x] && (!p || (right ? x > p[0] : x < p[0]))) p = [x, y]; return p && [p[0], p[1] - block * 1.3]; })();
    if (at) { patch(d, w, h, at[0], at[1], block, n); placed.push(`${view}/${f.replace('.png', '')} ${at.map(Math.round).join(',')}`); }
    await sharp(d, { raw: { width: w, height: h, channels: 4 } }).png().toFile(out);
  }
}
console.log(`${to.name}: parts from ${from.name}, the underwear turned to skin, ${n}×${n} mosaics of ${block} px blocks at ${placed.join('; ')} → ${relative(ROOT, dst)}`);
}
