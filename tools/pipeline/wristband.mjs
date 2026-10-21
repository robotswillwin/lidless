// Her wrist device, in the style of her eyepiece: drawn on an outfit's forearm parts, at the wrist, in each view's own
// look. The Concierge's view: a sleek white band with a cyan light, like her visor. Raw view: a brass plate on a dark
// leather strap with a small amber lens, like her goggle. Her rig draws both arms from the one forearm picture, so she
// wears one on each wrist. Drawn flat and small, in the style of the art; done once, in place, and parts/wristband.json
// says which views have it.
//   node tools/pipeline/wristband.mjs <recipe> [--views raw,concierge,raw-left,concierge-left] [--dry]

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadRecipe } from './recipe.mjs';

const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
/** Skin, as natural.mjs has it: opaque, warm, light; not a red, brown, purple or black sleeve. */
const isSkin = (d, i) => { const r = d[i], g = d[i + 1], b = d[i + 2]; return d[i + 3] > 200 && r > 110 && r >= g && g >= b - 6 && r - b > 24 && lum(d, i) > 95; };

/**
 * Where her wrist is in a forearm hanging down, the hand at the bottom, measured on her skin only (a coat's flared cuff
 * is no part of her wrist). Bare, it is the narrowest of her forearm just above where her hand widens. In a sleeve, it is
 * where the sleeve ends: the band goes there, its top under the sleeve, so it shows from under the cuff. Also the colour
 * of the sleeve, so the band is drawn under it, and which way the forearm runs.
 */
export function wristOf(d, w, h, T) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let x0 = -1, x1 = -1, s0 = -1, s1 = -1, skin = 0, all = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] <= 128) continue;
      if (x0 < 0) x0 = x;
      x1 = x; all++;
      if (isSkin(d, i)) { if (s0 < 0) s0 = x; s1 = x; skin++; }
    }
    rows.push({ x0, x1, s0, s1, width: s1 - s0 + 1, skin: all ? skin / all : 0, mid: (x0 + x1) / 2, smid: (s0 + s1) / 2 });
  }
  const skinRow = (y) => y >= 0 && y < h && rows[y].s0 >= 0 && rows[y].skin >= 0.6;
  let start = -1;
  for (let y = 0; y < h - 4 && start < 0; y++) if ([0, 1, 2, 3].every((k) => skinRow(y + k))) start = y;
  if (start < 0) return null;
  const sleeved = start > h * 0.25;
  let hand = -1;
  for (let y = Math.round(h * 0.55); y < h; y++) if (skinRow(y) && (hand < 0 || rows[y].width > rows[hand].width)) hand = y;
  if (hand < 0) return null;
  let y = -1, ref = -1;
  if (sleeved) {
    y = Math.round(start + T * 0.3);
    ref = Math.min(hand, Math.round(y + T / 2));
  } else {
    let minW = Infinity;
    for (let k = Math.round(h * 0.3); k < hand - Math.round(h * 0.04); k++) if (skinRow(k)) minW = Math.min(minW, rows[k].width);
    for (let k = Math.round(h * 0.3); k < hand - Math.round(h * 0.04); k++) if (skinRow(k) && rows[k].width <= minW + 1) y = k;
    ref = y;
  }
  if (y < 0 || !skinRow(ref)) return null;
  // the forearm's line: the middles of the rows above the wrist (a sleeve runs as the arm in it does)
  const ys = [], xs = [];
  for (let k = Math.max(0, y - Math.round(h * 0.15)); k <= y; k++) if (rows[k].x0 >= 0) { ys.push(k); xs.push(rows[k].mid); }
  const my = ys.reduce((a, b) => a + b, 0) / ys.length, mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const slope = ys.reduce((a, k, j) => a + (k - my) * (xs[j] - mx), 0) / Math.max(1e-6, ys.reduce((a, k) => a + (k - my) ** 2, 0));
  // the sleeve's colour: the opaque pixels just above where her skin starts
  let sleeve = null;
  if (sleeved) {
    const acc = [0, 0, 0];
    let n = 0;
    for (let k = Math.max(0, start - Math.round(h * 0.08)); k < start - 2; k++) for (let x = rows[k].x0; x >= 0 && x <= rows[k].x1; x++) {
      const i = (k * w + x) * 4;
      if (d[i + 3] > 200 && !isSkin(d, i)) { acc[0] += d[i]; acc[1] += d[i + 1]; acc[2] += d[i + 2]; n++; }
    }
    if (n) sleeve = acc.map((v) => v / n);
  }
  // the band's middle, where the arm is at the row its width was measured on, carried along the forearm's line
  return { y, x: rows[ref].smid + slope * (y - ref), width: rows[ref].width, slope, start, sleeved, sleeve };
}

const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

/** The band's colour at (u, v): u across her wrist, -1 to 1; v along it, -1 (towards the elbow) to 1. */
const STYLES = {
  // the Concierge's: sleek white, lit from above, a glowing cyan line round it and a brighter light at its middle
  concierge: (u, v) => {
    let c = mix([246, 249, 255], [176, 186, 206], (v + 1) / 2);
    if (Math.abs(v) < 0.24 && Math.abs(u) < 0.78) c = mix([110, 236, 255], [190, 252, 255], 1 - Math.abs(u) / 0.78);
    if (Math.hypot(u / 0.16, v / 0.42) < 1) c = [228, 255, 255];
    return c;
  },
  // raw view's: a dark leather strap, a brass plate with a highlight, and a small amber lens in a dark rim
  raw: (u, v) => {
    let c = mix([92, 64, 44], [46, 31, 22], (v + 1) / 2);
    if (Math.abs(u) < 0.42 && Math.abs(v) < 0.82) c = mix([226, 178, 92], [132, 94, 40], (v + 0.82) / 1.64);
    const r = Math.hypot(u / 0.2, v / 0.6);
    if (r < 1) c = r < 0.62 ? mix([255, 236, 170], [255, 160, 50], r / 0.62) : [58, 38, 20];
    return c;
  },
};

/**
 * The band drawn round the wrist: as wide as her wrist and a little more, so it wraps round it; its edges curving a
 * little, as a band round an arm seen from the side does; a thin darker edge, as the art's outlines are. Each pixel
 * sampled 4 by 4, so its edges are soft.
 */
function drawBand(d, w, h, at, look, T) {
  // under the sleeve: its own pixels stay as they are
  const fabric = (i) => at.sleeve && d[i + 3] > 128 && !isSkin(d, i) && Math.hypot(d[i] - at.sleeve[0], d[i + 1] - at.sleeve[1], d[i + 2] - at.sleeve[2]) < 60;
  const len = Math.hypot(1, at.slope), ax = [at.slope / len, 1 / len], across = [ax[1], -ax[0]];
  const W = at.width / len + 5, cx = at.x, cy = at.y, sag = T * 0.22;
  const shape = (u, v) => {
    const e = sag * (1 - Math.min(1, (2 * u) / W) ** 2), top = -T / 2 + e, bot = T / 2 + e, half = W / 2;
    if (Math.abs(u) > half || v < top || v > bot) return null;
    // rounded ends
    const rr = T * 0.35, cu = Math.abs(u) - (half - rr);
    if (cu > 0 && (v < top + rr || v > bot - rr)) { const cv = v < top + rr ? v - (top + rr) : v - (bot - rr); if (Math.hypot(cu, cv) > rr) return null; }
    const edge = Math.min(half - Math.abs(u), v - top, bot - v);
    return { u: u / half, v: ((v - e) / (T / 2)), edge };
  };
  const R = Math.ceil(Math.max(W, T) / 2 + 4);
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(h - 1, Math.ceil(cy + R)); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(w - 1, Math.ceil(cx + R)); x++) {
    let cover = 0, col = [0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4 - cx, py = y + (sy + 0.5) / 4 - cy;
      const u = px * across[0] + py * across[1], v = px * ax[0] + py * ax[1], s = shape(u, v);
      if (!s) continue;
      cover++;
      let c = STYLES[look](s.u, s.v);
      if (s.edge < 1) c = c.map((k) => k * 0.62);
      col = col.map((k, i) => k + c[i]);
    }
    if (!cover) continue;
    const f = cover / 16, i = (y * w + x) * 4, a = d[i + 3] / 255;
    if (fabric(i)) continue;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((d[i + k] * a * (1 - f) + (col[k] / cover) * f) / Math.max(1e-6, a * (1 - f) + f));
    d[i + 3] = Math.round(255 * (a * (1 - f) + f));
  }
}

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { const k = args[i].slice(2), v = args[i + 1]; if (v === undefined || v.startsWith('--')) opt[k] = true; else { opt[k] = v; i++; } } else pos.push(args[i]);
if (!pos[0]) throw new Error('usage: node tools/pipeline/wristband.mjs <recipe> [--views raw,concierge,raw-left,concierge-left] [--dry]');
const r = await loadRecipe(pos[0]), dir = join(r.dir, 'parts'), doneFile = join(dir, 'wristband.json');
const done = existsSync(doneFile) ? JSON.parse(await readFile(doneFile, 'utf8')) : [];
for (const view of String(opt.views ?? 'raw,concierge,raw-left,concierge-left').split(',')) {
  const file = join(dir, view, 'forearm.png');
  if (!existsSync(file)) continue;
  if (done.includes(view) && !opt.dry) { console.log(`${r.name} ${view}: has its band already`); continue; }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // a band about a sixteenth of the forearm's length
  const T = Math.max(10, Math.round(info.height * 0.062)), d = Buffer.from(data), at = wristOf(d, info.width, info.height, T);
  if (!at) { console.log(`${r.name} ${view}: no wrist found, left as it is`); continue; }
  console.log(`${r.name} ${view}: wrist at ${Math.round(at.x)}, ${at.y}${at.sleeved ? ` (under the sleeve, which ends at ${at.start})` : ''}, ${at.width} px across, slope ${at.slope.toFixed(2)}`);
  if (opt.dry) continue;
  drawBand(d, info.width, info.height, at, view.startsWith('raw') ? 'raw' : 'concierge', T);
  await sharp(d, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(file);
  done.push(view);
}
if (!opt.dry) await writeFile(doneFile, JSON.stringify([...new Set(done)]) + '\n');
