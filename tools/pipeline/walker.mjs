// A walk for a simple two-legged machine, from its standing frame: the frame cut into parts (the body with its far arm,
// the near arm, and one leg's thigh, shin and foot, the far leg a darker copy of the near one), and the legs moved by
// two-bone IK so each foot stands planted while the body passes over it, for exactly the stride the game moves it, and
// lifts and swings forward while the other one stands. The body dips and rises with the steps. Free: no image model.
//
// It walks both ways, each as it is drawn: the standing frames as drawn go to the side they face (idleLeft for art that
// faces left), and the walk and stand facing the other way are drawn mirrored, the lettering the recipe names put back
// the right way round, so a C does not read backwards.
//
//   node tools/pipeline/walker.mjs <recipe> [--debug]
//
// The recipe's "walker" (in the standing frame's pixels): faces (-1 drawn facing left), frames, step (how far a foot
// travels back while it stands: half the stride), lift, dip and bob (the body lower while it walks, and its rise and
// fall), stance (where a foot stands from its hip, mid-step), hip, knee and ankle (the near leg's joints), far (the far
// leg's offset) and farShade, toe and heel (the ends of the near foot's sole) and roll (how far the foot turns, toes up
// as it lands and heel up as it leaves, in degrees), shoulder and armSwing (the near arm's swing, in degrees), parts
// (polygons: thigh, shin, foot, nearArm, hipJoint), drop (polygons cleared from the body: the far leg as drawn) and
// letters (boxes of lettering: the same in both views, or each view's own, { "concierge": [...], "raw": [] } where
// raw view has none, the Concierge's C being its own). --debug draws the cuts over the standing frame.

import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readRGBA, writePNG } from './image.mjs';
import { loadRecipe } from './recipe.mjs';
import { rel } from './shared.mjs';

const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** The pixels of an image inside a mask, the rest transparent. */
function cut(img, mask) {
  const d = new Uint8ClampedArray(img.d.length);
  for (let i = 0; i < mask.length; i++) if (mask[i]) d.set(img.d.subarray(i * 4, i * 4 + 4), i * 4);
  return { w: img.w, h: img.h, d };
}

/** A part kept to its largest piece: the flecks of its neighbours a polygon's edge caught are dropped. */
function whole(part) {
  const n = part.w * part.h, seen = new Int32Array(n).fill(-1), sizes = [];
  for (let s0 = 0; s0 < n; s0++) {
    if (part.d[s0 * 4 + 3] < 24 || seen[s0] >= 0) continue;
    const id = sizes.length, stack = [s0];
    seen[s0] = id;
    let count = 0;
    while (stack.length) {
      const c = stack.pop(), x = c % part.w, y = (c - x) / part.w;
      count++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, yy = y + dy, j = yy * part.w + xx;
        if (xx >= 0 && yy >= 0 && xx < part.w && yy < part.h && seen[j] < 0 && part.d[j * 4 + 3] >= 24) { seen[j] = id; stack.push(j); }
      }
    }
    sizes.push(count);
  }
  const big = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < n; i++) if (seen[i] !== big) part.d.fill(0, i * 4, i * 4 + 4);
  return part;
}

function maskOf(w, h, polys) {
  const m = new Uint8Array(w * h);
  for (const poly of polys) {
    const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x++) if (inside(poly, x + 0.5, y + 0.5)) m[y * w + x] = 1;
  }
  return m;
}

/** The box around a part's pixels. */
function boxOf(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.d[(y * img.w + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return x1 < 0 ? null : [x0, y0, x1, y1];
}

/**
 * A part drawn over the frame, turned by `angle` (radians, clockwise on screen) about its pivot, which lands at `to`;
 * sampled bilinearly, premultiplied, over what is there. `shade` darkens it (a far leg).
 */
function draw(dst, src, from, to, angle = 0, shade = 1) {
  const b = boxOf(src);
  if (!b) return;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  // where the part's box goes: its corners turned about the pivot
  const corners = [[b[0], b[1]], [b[2] + 1, b[1]], [b[0], b[3] + 1], [b[2] + 1, b[3] + 1]].map(([x, y]) => {
    const dx = x - from[0], dy = y - from[1];
    return [to[0] + dx * cos - dy * sin, to[1] + dx * sin + dy * cos];
  });
  const X0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])))), X1 = Math.min(dst.w - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))));
  const Y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), Y1 = Math.min(dst.h - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
  const at = (x, y, k) => (x < 0 || y < 0 || x >= src.w || y >= src.h ? 0 : src.d[(y * src.w + x) * 4 + k]);
  for (let y = Y0; y <= Y1; y++) for (let x = X0; x <= X1; x++) {
    // back to the part: turned the other way about where its pivot landed
    const dx = x + 0.5 - to[0], dy = y + 0.5 - to[1], sx = from[0] + dx * cos + dy * sin - 0.5, sy = from[1] - dx * sin + dy * cos - 0.5;
    const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
    let a = 0;
    const c = [0, 0, 0];
    for (const [ox, oy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const al = (at(ix + ox, iy + oy, 3) / 255) * w;
      a += al;
      for (let k = 0; k < 3; k++) c[k] += at(ix + ox, iy + oy, k) * al;
    }
    if (a <= 0.002) continue;
    const i = (y * dst.w + x) * 4, da = dst.d[i + 3] / 255, out = a + da * (1 - a);
    for (let k = 0; k < 3; k++) dst.d[i + k] = Math.round((c[k] * shade + dst.d[i + k] * da * (1 - a)) / out);
    dst.d[i + 3] = Math.round(out * 255);
  }
}

/** Two-bone IK: where the knee is, the hip at p and the ankle reaching for a, bending toward `forward`. */
function knee(p, a, l1, l2, forward) {
  const dx = a[0] - p[0], dy = a[1] - p[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01), base = Math.atan2(dy, dx);
  const off = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
  // the knee to the front: the side of the hip-ankle line that `forward` points to
  const k1 = [p[0] + l1 * Math.cos(base + off), p[1] + l1 * Math.sin(base + off)], k2 = [p[0] + l1 * Math.cos(base - off), p[1] + l1 * Math.sin(base - off)];
  return (k1[0] - k2[0]) * forward >= 0 ? k1 : k2;
}

const mirrorX = (w) => (p) => [w - p[0], p[1]];
const angleOf = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const turned = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];

/**
 * The letter in a box of an image: the largest patch of pixels darker than the plate around them by a fifth (as faint
 * as raw view's lettering is on its rusted plates), grown by two pixels for its soft edge; and the plate's and the
 * letter's levels of light.
 */
function letterIn(img, [bx, by, bw, bh]) {
  const levels = [];
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) { const i = (y * img.w + x) * 4; if (img.d[i + 3] > 128) levels.push(lum(img.d, i)); }
  if (!levels.length) return null;
  levels.sort((p, q) => p - q);
  const plate = levels[Math.floor(levels.length * 0.75)], ink = levels[Math.floor(levels.length * 0.08)];
  const dark = new Uint8Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const i = ((by + y) * img.w + bx + x) * 4; dark[y * bw + x] = img.d[i + 3] > 128 && lum(img.d, i) < plate * 0.82 ? 1 : 0; }
  // the largest patch: the letter, not a seam or a stain
  const seen = new Int32Array(bw * bh).fill(-1), sizes = [];
  for (let s0 = 0; s0 < dark.length; s0++) {
    if (!dark[s0] || seen[s0] >= 0) continue;
    const id = sizes.length, stack = [s0];
    seen[s0] = id;
    let n = 0;
    while (stack.length) {
      const c = stack.pop(), cx = c % bw, cy = (c - cx) / bw;
      n++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy, j = y * bw + x;
        if (x >= 0 && y >= 0 && x < bw && y < bh && dark[j] && seen[j] < 0) { seen[j] = id; stack.push(j); }
      }
    }
    sizes.push(n);
  }
  if (!sizes.length) return null;
  const big = sizes.indexOf(Math.max(...sizes)), mask = new Uint8Array(bw * bh);
  for (let j = 0; j < mask.length; j++) if (seen[j] === big) mask[j] = 1;
  for (let pass = 0; pass < 2; pass++) {
    const grow = mask.slice();
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (!mask[y * bw + x] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => mask[(y + dy) * bw + x + dx] && x + dx >= 0 && x + dx < bw && y + dy >= 0 && y + dy < bh)) grow[y * bw + x] = 1;
    mask.set(grow);
  }
  return { mask, plate, ink };
}

/** The image mirrored, the lettering in `boxes` put back the right way round on its plate. */
function mirrored(img, boxes) {
  const out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d.length) };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.d.set(img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4);
  for (const box of boxes) {
    const [bx, by, bw, bh] = box, mx = img.w - (bx + bw), L = letterIn(img, box);
    if (!L) continue;
    // the mirrored letter gone: each row of it filled from the plate on either side
    const at = (x, y) => ((by + y) * img.w + mx + x) * 4, back = (x, y) => L.mask[y * bw + (bw - 1 - x)];
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (!back(x, y)) continue;
        let e = x;
        while (e + 1 < bw && back(e + 1, y)) e++;
        const l = x > 0 ? out.d.slice(at(x - 1, y), at(x - 1, y) + 3) : null, r = e + 1 < bw ? out.d.slice(at(e + 1, y), at(e + 1, y) + 3) : null;
        for (let k = x; k <= e; k++) {
          const t = (k - x + 1) / (e - x + 2), c = l && r ? [0, 1, 2].map((q) => l[q] * (1 - t) + r[q] * t) : (l ?? r ?? [0, 0, 0]);
          out.d.set(c.map(Math.round), at(k, y));
        }
        x = e;
      }
    }
    // the letter as drawn, its soft edge over the plate by how dark each pixel of it is
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      if (!L.mask[y * bw + x]) continue;
      const i = ((by + y) * img.w + bx + x) * 4, a = Math.max(0, Math.min(1, (L.plate - lum(img.d, i)) / Math.max(1, L.plate - L.ink)));
      const o = at(x, y);
      for (let q = 0; q < 3; q++) out.d[o + q] = Math.round(out.d[o + q] * (1 - a) + img.d[i + q] * a);
    }
  }
  return out;
}

const args = process.argv.slice(2), file = args.find((a) => !a.startsWith('--'));
if (!file) throw new Error('usage: node tools/pipeline/walker.mjs <recipe> [--debug]');
const r = await loadRecipe(file), W = r.walker;
if (!W) throw new Error(`${r.name} has no "walker" in its recipe`);
const anims = join(r.dir, 'anims'), drawnSide = W.faces < 0 ? 'Left' : '', otherSide = W.faces < 0 ? '' : 'Left';
// the standing frames as drawn: kept under the side they face (moved there the first time)
const drawnIdle = join(anims, `idle${drawnSide}`);
if (!existsSync(drawnIdle) || !(await readdir(drawnIdle)).some((f) => f.endsWith('.png'))) {
  await mkdir(drawnIdle, { recursive: true });
  for (const f of (await readdir(join(anims, 'idle'))).filter((f) => f.endsWith('.png'))) await copyFile(join(anims, 'idle', f), join(drawnIdle, f));
}
const N = W.frames ?? 12, step = W.step, lift = W.lift ?? 40, dip = W.dip ?? 20, bob = W.bob ?? 5, stance = W.stance ?? 0;
const l1 = Math.hypot(W.knee[0] - W.hip[0], W.knee[1] - W.hip[1]), l2 = Math.hypot(W.ankle[0] - W.knee[0], W.ankle[1] - W.knee[1]);
const ease = (u) => u * u * (3 - 2 * u);
/** The boxes of lettering in a view's frames, put back the right way round when mirrored. */
const lettersOf = (view) => (Array.isArray(W.letters) ? W.letters : W.letters?.[view] ?? []);
// what this makes, cleared once for both views: the walk each way, and the standing frames facing the other way
for (const d of [`walk${drawnSide}`, `walk${otherSide}`, `idle${otherSide}`]) { await rm(join(anims, d), { recursive: true, force: true }); await mkdir(join(anims, d), { recursive: true }); }

for (const view of ['concierge', 'raw']) {
  const idles = (await readdir(drawnIdle)).filter((f) => f.startsWith(`${view}-`) && f.endsWith('.png')).sort();
  const rest = await readRGBA(join(drawnIdle, idles[0]));
  for (const [side, flip] of [[drawnSide, false], [otherSide, true]]) {
    // facing the other way: everything mirrored, the lettering put back
    const m = flip ? mirrorX(rest.w) : (p) => p, mp = (poly) => poly.map(m), F = flip ? -W.faces : W.faces;
    const img = flip ? mirrored(rest, lettersOf(view)) : rest;
    const hip = m(W.hip), kn = m(W.knee), an = m(W.ankle), far = flip ? [-W.far[0], W.far[1]] : W.far;
    const P = W.parts, mask = (polys) => maskOf(img.w, img.h, polys.map(mp));
    const thigh = whole(cut(img, mask([P.thigh]))), shin = whole(cut(img, mask([P.shin]))), foot = whole(cut(img, mask([P.foot])));
    const arm = cut(img, mask([P.nearArm])), joint = cut(img, mask([P.hipJoint]));
    const gone = mask([P.thigh, P.shin, P.foot, P.nearArm, ...(W.drop ?? [])]), body = cut(img, gone.map((v) => 1 - v));
    if (args.includes('--debug') && !flip) {
      const dbg = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) };
      const tints = [[thigh, [255, 60, 60]], [shin, [60, 255, 60]], [foot, [60, 120, 255]], [arm, [255, 220, 40]], [joint, [255, 60, 255]]];
      for (const [part, c] of tints) for (let i = 0; i < part.d.length; i += 4) if (part.d[i + 3]) for (let k = 0; k < 3; k++) dbg.d[i + k] = (dbg.d[i + k] + c[k]) / 2;
      for (const p of [hip, kn, an]) for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) { const i = ((Math.round(p[1]) + y) * img.w + Math.round(p[0]) + x) * 4; dbg.d.set([255, 255, 0, 255], i); }
      await writePNG(join(r.dir, `walker-${view}-check.png`), dbg);
    }
    const out = join(anims, `walk${side}`);
    // a foot standing, a stance phase u (0 to 1) in: where its ankle is and how far the foot is turned (clockwise). It
    // lands toes up on its heel and lowers them, stands flat, then peels off its toe, the heel rising: each turn about
    // the point of it that stays on the ground, so nothing slides
    const toe = m(W.toe ?? W.ankle), heel = m(W.heel ?? W.ankle), [toeUp, heelUp] = (W.roll ?? [0, 0]).map((d) => (d * Math.PI) / 180);
    const standing = (flat, u) => {
      const r = u < 0.15 ? -toeUp * (1 - u / 0.15) : u > 0.7 ? heelUp * ((u - 0.7) / 0.3) ** 2 : 0, on = u < 0.15 ? heel : toe;
      if (!r) return { ankle: flat, turn: 0 };
      const turn = F * r, pivot = [flat[0] + on[0] - an[0], flat[1] + on[1] - an[1]], v = turned([flat[0] - pivot[0], flat[1] - pivot[1]], turn);
      return { ankle: [pivot[0] + v[0], pivot[1] + v[1]], turn };
    };
    const shoulder = m(W.shoulder ?? W.hip), swing = ((W.armSwing ?? 0) * Math.PI) / 180;
    for (let k = 0; k < N; k++) {
      const t = k / N, lower = dip + bob * Math.cos(4 * Math.PI * t), frame = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d.length) };
      const leg = (phase, offset, shade) => {
        const φ = (t + phase) % 1, home = [hip[0] + offset[0], hip[1] + offset[1]], p = [home[0], home[1] + lower];
        // the foot: standing, carried back under the body from in front of it to behind (mid-step `stance` behind the
        // hip); then in the air, from where it peeled off to where it lands, lifted on the way and eased in and out
        const flatAt = (along) => [home[0] - F * stance + F * along, an[1] + offset[1]];
        let pose;
        if (φ < 0.5) pose = standing(flatAt(step / 2 - step * (φ / 0.5)), φ / 0.5);
        else {
          const v = (φ - 0.5) / 0.5, e = ease(v), off = standing(flatAt(-step / 2), 0.9999), on = standing(flatAt(step / 2), 0);
          pose = { ankle: [off.ankle[0] + (on.ankle[0] - off.ankle[0]) * e, off.ankle[1] + (on.ankle[1] - off.ankle[1]) * e - lift * Math.sin(Math.PI * v)], turn: off.turn + (on.turn - off.turn) * e };
        }
        const a = pose.ankle, k2 = knee(p, a, l1, l2, F);
        draw(frame, foot, an, a, pose.turn, shade);
        draw(frame, shin, kn, k2, angleOf(k2, a) - angleOf(kn, an), shade);
        draw(frame, thigh, hip, p, angleOf(p, k2) - angleOf(hip, kn), shade);
      };
      leg(0.5, far, W.farShade ?? 0.8);
      draw(frame, body, [0, 0], [0, lower]);
      leg(0, [0, 0], 1);
      draw(frame, joint, [0, 0], [0, lower]);
      // the near arm swings against the near leg: back as that foot lands in front
      draw(frame, arm, shoulder, [shoulder[0], shoulder[1] + lower], F * swing * Math.cos(2 * Math.PI * t));
      await writePNG(join(out, `${view}-${String(k).padStart(2, '0')}.png`), frame);
    }
    // standing, facing the other way: the drawn standing frames mirrored
    if (flip) {
      const idleOut = join(anims, `idle${side}`);
      for (const f of idles) await writePNG(join(idleOut, f), mirrored(await readRGBA(join(drawnIdle, f)), lettersOf(view)));
    }
  }
}
console.log(`${r.name}: ${N} walking frames each way, both views, in ${rel(anims)}; standing frames as drawn in idle${drawnSide}, mirrored in idle${otherSide}`);
