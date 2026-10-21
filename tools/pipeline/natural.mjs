// Raw view's skin, as it really is: the Concierge's view shows her flawless, raw view natural. On an outfit's raw parts
// (both sides of her, each its own), where skin shows: a little unevenness of tone, faint ribs on her side, fine hair on
// her forearms and legs, a few bruises, freckles and moles, knees and elbows a little redder; and the nutrition port in
// her lower back, which everyone has, a small ring of dull metal. All of it is drawn small
// and soft, in the flat style of the art. Done once, in place; parts/natural.json says which views have it.
//   node tools/pipeline/natural.mjs <recipe> [--views raw,raw-left]

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { loadRecipe, ROOT } from './recipe.mjs';

const lumOf = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** A seeded random number generator, so a piece gets the same marks every time. */
function rng(seed) {
  let s = 0;
  for (const c of seed) s = (Math.imul(s, 31) + c.charCodeAt(0)) | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Where a piece is skin: opaque, warm, not her outline, not white fabric, not metal. */
function skinOf(d, w, h) {
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2], l = lumOf(d, i * 4);
    m[i] = d[i * 4 + 3] > 200 && r > 110 && r >= g && g >= b - 6 && r - b > 24 && l > 95 ? 1 : 0;
  }
  return m;
}

/** The skin's span on a row: its first and last skin pixel. */
const spanOf = (m, w, y) => { let a = -1, b = -1; for (let x = 0; x < w; x++) if (m[y * w + x]) { if (a < 0) a = x; b = x; } return a < 0 ? null : [a, b]; };

function mix(d, i, col, a) { for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.round(d[i * 4 + c] * (1 - a) + col[c] * a); }
function mul(d, i, k) { for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.max(0, Math.min(255, Math.round(d[i * 4 + c] * k[c]))); }

/** Low, soft unevenness of tone and colour: value noise over cells of `cell` pixels. */
function mottle(d, w, h, skin, rand, cell = 34, amount = 0.025) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, tone = [], red = [];
  for (let i = 0; i < gw * gh; i++) { tone.push(rand() * 2 - 1); red.push(rand() * 2 - 1); }
  const at = (g, x, y) => { const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = smooth(0, 1, gx - x0), fy = smooth(0, 1, gy - y0), v = (a, b) => g[b * gw + a]; return (v(x0, y0) * (1 - fx) + v(x0 + 1, y0) * fx) * (1 - fy) + (v(x0, y0 + 1) * (1 - fx) + v(x0 + 1, y0 + 1) * fx) * fy; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!skin[i]) continue;
    const t = 1 + amount * at(tone, x, y), r = 0.02 * at(red, x, y);
    mul(d, i, [t * (1 + r), t * (1 - r * 0.6), t * (1 - r)]);
  }
}

/** A soft round mark: a bruise (purple in the middle, yellowing at its edge), a freckle or a mole. */
function spot(d, w, h, skin, cx, cy, r, inner, outer = null, a = 0.3) {
  for (let y = Math.floor(cy - r * 1.4); y <= cy + r * 1.4; y++) for (let x = Math.floor(cx - r * 1.4); x <= cx + r * 1.4; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h || !skin[y * w + x]) continue;
    const t = Math.hypot(x - cx, (y - cy) * 1.15) / r;
    const k = a * (1 - smooth(0.35, 1, t));
    if (k > 0) mix(d, y * w + x, inner, k);
    if (outer) { const o = a * 0.45 * smooth(0.6, 0.95, t) * (1 - smooth(1, 1.35, t)); if (o > 0) mix(d, y * w + x, outer, o); }
  }
}

/** A fine hair: a short, thin, soft stroke from (x, y), `len` pixels at angle `ang`. */
function hair(d, w, h, skin, x, y, len, ang, col, a) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let s = 0; s <= len * 3; s++) {
    const t = s / (len * 3), px = x + dx * len * t, py = y + dy * len * t, fade = Math.sin(Math.PI * t);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const X = Math.round(px) + ox, Y = Math.round(py) + oy;
      if (X < 0 || Y < 0 || X >= w || Y >= h || !skin[Y * w + X]) continue;
      const dd = Math.hypot(X - px, Y - py), k = a * fade * Math.max(0, 1 - dd / 0.9) / 3;
      if (k > 0) mix(d, Y * w + X, col, k);
    }
  }
}

/** Hair along a limb: `n` strokes in rows y0..y1, biased to its `side` (0 the back, 1 the front), along the limb. */
function hairs(d, w, h, skin, rand, n, y0, y1, side, frontRight, col, a, len = [4, 8]) {
  for (let k = 0; k < n; k++) {
    const y = Math.round(y0 + rand() * (y1 - y0)), sp = spanOf(skin, w, y);
    if (!sp) continue;
    // where across the limb: near the side asked for
    let u = Math.min(1, Math.max(0, side + (rand() - 0.5) * 0.5));
    if (!frontRight) u = 1 - u;
    const x = sp[0] + u * (sp[1] - sp[0]), L = len[0] + rand() * (len[1] - len[0]);
    // down the limb, leaning a little forward or back
    const ang = Math.PI / 2 + (rand() - 0.5) * 0.7 + (frontRight ? -0.15 : 0.15);
    hair(d, w, h, skin, x, y, L, ang, col, a * (0.7 + rand() * 0.6));
  }
}

/** Faint ribs on her side, below the bust: soft shadows curving down towards her front, a little light above each. */
function ribs(d, w, h, skin, bust, hip, frontRight) {
  const top = bust[1] + (hip[1] - bust[1]) * 0.2, gap = (hip[1] - bust[1]) * 0.085;
  for (let n = 0; n < 4; n++) {
    const yb = top + n * gap;
    for (let y = Math.floor(yb - 30); y < yb + 30; y++) {
      if (y < 0 || y >= h) continue;
      const sp = spanOf(skin, w, y);
      if (!sp) continue;
      for (let x = sp[0]; x <= sp[1]; x++) {
        const i = y * w + x;
        if (!skin[i]) continue;
        // across her side from the back (0) to the front (1); each rib descends towards the front and fades at both ends
        let u = (x - sp[0]) / Math.max(1, sp[1] - sp[0]);
        if (!frontRight) u = 1 - u;
        if (u < 0.08 || u > 0.72) continue;
        const along = smooth(0.08, 0.22, u) * (1 - smooth(0.5, 0.72, u)), yc = yb + (u - 0.3) * 26, dy = y - yc;
        const shade = Math.exp(-(dy * dy) / 7) * 0.14 * along, light = Math.exp(-((dy + 4) ** 2) / 4) * 0.045 * along;
        if (shade > 0.002 || light > 0.002) mul(d, i, [1 - shade + light, 1 - shade * 1.05 + light, 1 - shade * 1.1 + light]);
      }
    }
  }
}

/** Her nutrition port: a small ring of dull metal round a dark opening, in her lower back, lit from above. */
function port(d, w, h, j, frontRight) {
  const y0 = Math.round(j.hip[1] - 0.1 * h);
  let edge = -1;
  if (frontRight) { for (let x = 0; x < w; x++) if (d[(y0 * w + x) * 4 + 3] > 128) { edge = x; break; } }
  else for (let x = w - 1; x >= 0; x--) if (d[(y0 * w + x) * 4 + 3] > 128) { edge = x; break; }
  if (edge < 0) return;
  const cx = edge + (frontRight ? 6 : -6), cy = y0, R = 5.5;
  for (let y = Math.floor(cy - R - 2); y <= cy + R + 2; y++) for (let x = Math.floor(cx - R - 2); x <= cx + R + 2; x++) {
    const o = (y * w + x) * 4;
    if (x < 0 || y < 0 || x >= w || y >= h || d[o + 3] < 128) continue;
    let cover = 0, col = [0, 0, 0];
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const px = x + (sx + 0.5) / 4 - cx, py = y + (sy + 0.5) / 4 - cy, rr = Math.hypot(px, py * 1.15);
      if (rr > R) continue;
      cover++;
      const c = rr < R * 0.45 ? [28, 28, 32] : rr < R * 0.6 ? [55, 56, 60] : py < 0 ? [150, 152, 156] : [88, 90, 96];
      col = col.map((a, i) => a + c[i]);
    }
    if (!cover) continue;
    const f = cover / 16;
    for (let c = 0; c < 3; c++) d[o + c] = Math.round(d[o + c] * (1 - f) + (col[c] / cover) * f);
  }
}

/** A joint a little redder and darker: a knee, an elbow. */
function flush(d, w, h, skin, cx, cy, r) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h || !skin[y * w + x]) continue;
    const k = 1 - smooth(0.3, 1, Math.hypot(x - cx, y - cy) / r);
    if (k > 0) mul(d, y * w + x, [1 - 0.01 * k, 1 - 0.06 * k, 1 - 0.07 * k]);
  }
}

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) opt[args[i].slice(2)] = args[++i]; else pos.push(args[i]);
if (!pos[0]) throw new Error('usage: node tools/pipeline/natural.mjs <recipe> [--views raw,raw-left]');
const r = await loadRecipe(pos[0]), dir = join(r.dir, 'parts'), info = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8'));
const doneFile = join(dir, 'natural.json'), done = existsSync(doneFile) ? JSON.parse(await readFile(doneFile, 'utf8')) : [];
const HAIR = [118, 92, 70], FRECKLE = [150, 96, 70], MOLE = [92, 58, 44], BRUISE = [118, 92, 150], YELLOW = [178, 168, 98];
for (const view of String(opt.views ?? 'raw,raw-left').split(',')) {
  if (done.includes(view)) { console.log(`${r.name} ${view}: natural already`); continue; }
  const J = info[view] ?? {}, frontRight = J.torso?.joints?.bust && J.torso?.joints?.neck ? J.torso.joints.bust[0] >= J.torso.joints.neck[0] : true;
  for (const name of ['torso', 'coat', 'upperArm', 'forearm', 'thigh', 'shin']) {
    const file = join(dir, view, `${name}.png`);
    if (!existsSync(file) || !J[name]) continue;
    const { data, info: im } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = im.width, h = im.height, d = Buffer.from(data), j = J[name].joints;
    // the port first: it is metal, not skin, so nothing below draws on it
    if (name === 'torso' && j.hip) port(d, w, h, j, frontRight);
    const skin = skinOf(d, w, h), rand = rng(`${r.name}/${view}/${name}`);
    mottle(d, w, h, skin, rand);
    if (name === 'torso') {
      if (j.bust && j.hip) ribs(d, w, h, skin, j.bust, j.hip, frontRight);
      // freckles over her shoulders and upper chest; two moles
      for (let k = 0; k < 26; k++) { const y = j.neck[1] + 18 + rand() * (j.bust[1] - j.neck[1] - 10), sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, sp[0] + rand() * (sp[1] - sp[0]), y, 0.9 + rand() * 0.6, FRECKLE, null, 0.5); }
      for (let k = 0; k < 2; k++) { const y = j.bust[1] + 40 + rand() * 110, sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, sp[0] + (0.2 + rand() * 0.6) * (sp[1] - sp[0]), y, 1.7, MOLE, null, 0.75); }
    }
    if (name === 'coat') { const y = h * (0.45 + rand() * 0.3), sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, sp[0] + (0.3 + rand() * 0.4) * (sp[1] - sp[0]), y, 1.6, MOLE, null, 0.7); }
    if (name === 'upperArm') {
      for (let k = 0; k < 14; k++) { const y = j.shoulder[1] + 10 + rand() * 90, sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, sp[0] + rand() * (sp[1] - sp[0]), y, 0.9 + rand() * 0.5, FRECKLE, null, 0.45); }
      hairs(d, w, h, skin, rand, 18, j.shoulder[1] + 60, j.elbow[1] - 10, 0.25, frontRight, HAIR, 0.28, [3, 6]);
      flush(d, w, h, skin, j.elbow[0], j.elbow[1], 20);
      if (view.endsWith('-left')) { const y = j.shoulder[1] + (j.elbow[1] - j.shoulder[1]) * 0.55, sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, (sp[0] + sp[1]) / 2, y, 7, BRUISE, YELLOW, 0.26); }
    }
    if (name === 'forearm') {
      hairs(d, w, h, skin, rand, 70, j.elbow[1] + 14, h * 0.7, 0.2, frontRight, HAIR, 0.34);
      flush(d, w, h, skin, j.elbow[0], j.elbow[1], 18);
    }
    if (name === 'thigh') {
      hairs(d, w, h, skin, rand, 40, j.hip[1] + 60, j.knee[1] - 20, 0.75, frontRight, HAIR, 0.2, [3, 6]);
      flush(d, w, h, skin, j.knee[0], j.knee[1], 26);
      if (!view.endsWith('-left')) { const y = j.hip[1] + (j.knee[1] - j.hip[1]) * 0.58, sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, sp[0] + (frontRight ? 0.62 : 0.38) * (sp[1] - sp[0]), y, 12, BRUISE, YELLOW, 0.3); }
      { const y = j.hip[1] + 120 + rand() * 120, sp = spanOf(skin, w, Math.round(y)); if (sp) spot(d, w, h, skin, sp[0] + (0.3 + rand() * 0.4) * (sp[1] - sp[0]), y, 1.6, MOLE, null, 0.7); }
    }
    if (name === 'shin') {
      // stubble down the front of her shins, where she shaved a week ago
      hairs(d, w, h, skin, rand, 110, j.knee[1] + 22, h * 0.76, 0.85, frontRight, HAIR, 0.36, [3, 6]);
      flush(d, w, h, skin, j.knee[0], j.knee[1] + 6, 26);
      const y1 = j.knee[1] + (h * 0.76 - j.knee[1]) * 0.38, s1 = spanOf(skin, w, Math.round(y1));
      if (s1) spot(d, w, h, skin, s1[0] + (frontRight ? 0.72 : 0.28) * (s1[1] - s1[0]), y1, 10, BRUISE, YELLOW, 0.32);
      if (view.endsWith('-left')) { const y2 = j.knee[1] + (h * 0.76 - j.knee[1]) * 0.7, s2 = spanOf(skin, w, Math.round(y2)); if (s2) spot(d, w, h, skin, s2[0] + 0.3 * (s2[1] - s2[0]), y2, 7, BRUISE, YELLOW, 0.26); }
    }
    await sharp(d, { raw: { width: w, height: h, channels: 4 } }).png().toFile(file);
  }
  done.push(view);
  console.log(`${r.name} ${view}: natural skin → ${relative(ROOT, join(dir, view))}`);
}
await writeFile(doneFile, JSON.stringify(done) + '\n');
