// Cut-out rigs: a character cut into parts at its joints, posed with forward kinematics and baked into frames.
// Joints are placed by hand in the built still sprite's pixels. The baker works at WORK times game size, so parts
// rotate smoothly and shrink to clean pixels; the build then pixelates every frame with one shared set of colours.

import { blank } from './image.mjs';

export const WORK = 4;

/**
 * The human rig, parents before children. Each bone turns about its first joint; its pixels are the ones nearest to
 * its segments, within its radius (in game pixels). Bones without a radius share what is left: the torso and head.
 * "Front" limbs are nearer the viewer. The legs hang from the hips, so a leaning torso does not move the feet.
 */
export const HUMAN = {
  torso: { from: 'pelvis', segs: [['pelvis', 'neck']], parent: null },
  head: { from: 'neck', segs: [['neck', 'crown']], parent: 'torso' },
  legBackUpper: { from: 'hipBack', segs: [['hipBack', 'kneeBack']], parent: null, r: 9 },
  legBackLower: { from: 'kneeBack', segs: [['kneeBack', 'ankleBack'], ['ankleBack', 'toeBack']], parent: 'legBackUpper', r: 8 },
  legFrontUpper: { from: 'hipFront', segs: [['hipFront', 'kneeFront']], parent: null, r: 9 },
  legFrontLower: { from: 'kneeFront', segs: [['kneeFront', 'ankleFront'], ['ankleFront', 'toeFront']], parent: 'legFrontUpper', r: 8 },
  armBackUpper: { from: 'shoulderBack', segs: [['shoulderBack', 'elbowBack']], parent: 'torso', r: 7 },
  armBackLower: { from: 'elbowBack', segs: [['elbowBack', 'wristBack'], ['wristBack', 'handBack']], parent: 'armBackUpper', r: 6 },
  armFrontUpper: { from: 'shoulderFront', segs: [['shoulderFront', 'elbowFront']], parent: 'torso', r: 7 },
  armFrontLower: { from: 'elbowFront', segs: [['elbowFront', 'wristFront'], ['wristFront', 'handFront']], parent: 'armFrontUpper', r: 6 },
};

/** Drawing order, back to front. */
export const ORDER = ['armBackLower', 'armBackUpper', 'legBackLower', 'legBackUpper', 'torso', 'head', 'legFrontUpper', 'legFrontLower', 'armFrontUpper', 'armFrontLower'];

function segDist(x, y, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0;
  return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
}

/** Joints from game pixels to work pixels. */
export const toWork = (joints) => Object.fromEntries(Object.entries(joints).map(([k, [x, y]]) => [k, [x * WORK, y * WORK]]));

/**
 * Which bone each opaque pixel belongs to: the nearest limb within its radius, else the head above the neck, else the
 * torso. `radii` overrides a limb's radius, in game pixels. A long coat must stay with the torso: give the coat's hem
 * line (`hem`, game pixels from the top) and a radius pair [above the hem, below it]. A leg hidden behind the coat
 * takes nothing above the hem (0); one showing in the open front takes a thin strip.
 */
export function assign(img, J, radii = {}, hem = Infinity) {
  const names = Object.keys(HUMAN), limbs = names.filter((n) => HUMAN[n].r), label = new Int8Array(img.w * img.h).fill(-1);
  const radius = (n, y) => { const r = radii[n] ?? HUMAN[n].r; return (Array.isArray(r) ? r[y < hem * WORK ? 0 : 1] : r) * WORK; };
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const p = y * img.w + x;
    if (img.d[p * 4 + 3] < 128) continue;
    let best = -1, bd = Infinity;
    for (const n of limbs) {
      const d = Math.min(...HUMAN[n].segs.map(([a, b]) => segDist(x + 0.5, y + 0.5, J[a], J[b])));
      if (d <= radius(n, y) && d < bd) { bd = d; best = names.indexOf(n); }
    }
    label[p] = best >= 0 ? best : names.indexOf(y + 0.5 < J.neck[1] ? 'head' : 'torso');
  }
  return label;
}

/**
 * One image per bone: its own pixels, plus the parent's pixels in a disc around the joint it turns on, so no gap
 * opens when it bends. Each carries the box its pixels fill.
 */
export function cut(img, label, J) {
  const names = Object.keys(HUMAN), parts = {};
  names.forEach((n, k) => {
    const bone = HUMAN[n], out = blank(img.w, img.h), joint = J[bone.from], cap = (bone.r ?? 10) * WORK, parent = bone.parent ? names.indexOf(bone.parent) : -1;
    let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
    for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
      const p = y * img.w + x, l = label[p];
      if (l < 0) continue;
      const own = l === k, capped = parent >= 0 && l === parent && Math.hypot(x + 0.5 - joint[0], y + 0.5 - joint[1]) <= cap;
      if (!own && !capped) continue;
      out.d.set(img.d.subarray(p * 4, p * 4 + 4), p * 4);
      if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
    parts[n] = { ...out, box: x1 < 0 ? null : [x0, y0, x1, y1] };
  });
  return parts;
}

/* ---------- posing: 2x3 affine matrices [a, b, c, d, e, f], x' = a x + c y + e, y' = b x + d y + f ---------- */

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const ID = [1, 0, 0, 1, 0, 0];
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function invert(m) {
  const det = m[0] * m[3] - m[2] * m[1];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
/** Turn about point p by deg degrees; positive swings a bone that hangs down forward (toward +x). */
function rotAbout(p, deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
  return [c, -s, s, c, p[0] - c * p[0] - s * p[1], p[1] + s * p[0] - c * p[1]];
}

/** Each bone's placement for a set of angles (relative to its parent). */
export function transforms(J, angles) {
  const M = {};
  for (const [n, bone] of Object.entries(HUMAN)) M[n] = mul(bone.parent ? M[bone.parent] : ID, rotAbout(J[bone.from], angles[n] ?? 0));
  return M;
}

/** Where a joint ends up: carried by the bone that holds it. */
export const jointAt = (M, J, bone, joint) => apply(M[bone], J[joint]);

/** Draw the parts posed, back to front, into a canvas `pad` work pixels wider on each side. */
export function render(parts, M, w, h, pad) {
  const out = blank(w + pad * 2, h);
  for (const n of ORDER) {
    const part = parts[n];
    if (!part?.box) continue;
    const m = M[n], inv = invert(m), [bx0, by0, bx1, by1] = part.box;
    const corners = [[bx0, by0], [bx1 + 1, by0], [bx0, by1 + 1], [bx1 + 1, by1 + 1]].map((c) => apply(m, c));
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])) + pad)), x1 = Math.min(out.w - 1, Math.ceil(Math.max(...corners.map((c) => c[0])) + pad));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), y1 = Math.min(out.h - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const qx = x - pad + 0.5, qy = y + 0.5;
      const sx = Math.floor(inv[0] * qx + inv[2] * qy + inv[4]), sy = Math.floor(inv[1] * qx + inv[3] * qy + inv[5]);
      if (sx < 0 || sy < 0 || sx >= part.w || sy >= part.h) continue;
      const i = (sy * part.w + sx) * 4;
      if (part.d[i + 3] < 128) continue;
      out.d.set(part.d.subarray(i, i + 4), (y * out.w + x) * 4);
    }
  }
  return out;
}

/** Shrink by WORK: each game pixel is the coverage-weighted average of its block. */
export function shrink(img) {
  const w = Math.floor(img.w / WORK), h = Math.floor(img.h / WORK), out = blank(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let j = 0; j < WORK; j++) for (let i = 0; i < WORK; i++) {
      const k = ((y * WORK + j) * img.w + x * WORK + i) * 4, al = img.d[k + 3];
      r += img.d[k] * al; g += img.d[k + 1] * al; b += img.d[k + 2] * al; a += al;
    }
    const o = (y * w + x) * 4;
    if (a) out.d.set([r / a, g / a, b / a, a / (WORK * WORK)], o);
  }
  return out;
}

/**
 * Move the images of one frame down together until the lowest opaque row of any of them sits on the bottom edge:
 * the planted foot stays on the ground, and both views stay aligned.
 */
export function plant(imgs) {
  let low = -1;
  for (const img of imgs) for (let y = img.h - 1; y > low; y--) {
    let hit = false;
    for (let x = 0; x < img.w && !hit; x++) hit = img.d[(y * img.w + x) * 4 + 3] >= 128;
    if (hit) { low = y; break; }
  }
  const drop = low < 0 ? 0 : imgs[0].h - 1 - low;
  return imgs.map((img) => {
    if (!drop) return img;
    const out = blank(img.w, img.h);
    out.d.set(img.d.subarray(0, (img.h - drop) * img.w * 4), drop * img.w * 4);
    return out;
  });
}

/**
 * A walk cycle as angles, from a phase (0 to 2π). The front leg reaches forward at π/2 and back at 3π/2; the knee
 * bends while the leg swings through; the arms swing against the legs.
 */
export function walk(phase) {
  const leg = (ph) => ({ upper: 20 * Math.sin(ph), lower: -38 * Math.max(0, Math.cos(ph)) ** 1.5 });
  const arm = (ph) => ({ upper: -14 * Math.sin(ph), lower: 6 + 10 * Math.max(0, -Math.sin(ph)) });
  const lf = leg(phase), lb = leg(phase + Math.PI), af = arm(phase), ab = arm(phase + Math.PI);
  return {
    torso: 2, head: -1,
    legFrontUpper: lf.upper, legFrontLower: lf.lower, legBackUpper: lb.upper, legBackLower: lb.lower,
    armFrontUpper: af.upper, armFrontLower: af.lower, armBackUpper: ab.upper, armBackLower: ab.lower,
  };
}

/**
 * The frames of a character: idle first, then the walk cycle. `views` are work-size images of each look, all cut
 * with the same parts. Returns work-size frames per view, how far each frame dropped to plant its foot, and the
 * stride: how far the body moves in one full cycle so the planted foot does not slide.
 */
export function bake(views, joints, { steps = 8, pad = 48, radii, hem } = {}) {
  const J = toWork(joints), base = views.find(Boolean), label = assign(base, J, radii, hem);
  const cuts = views.map((img) => img && cut(img, label, J));
  const poses = [{}, ...Array.from({ length: steps }, (_, k) => walk((2 * Math.PI * k) / steps))];
  const frames = cuts.map((parts) => parts && poses.map((angles) => render(parts, transforms(J, angles), base.w, base.h, pad * WORK)));
  // the front foot is planted from π/2 to 3π/2; the body must cover the distance it travels back
  const toeX = (ph) => jointAt(transforms(J, walk(ph)), J, 'legFrontLower', 'toeFront')[0];
  const stride = (2 * (toeX(Math.PI / 2) - toeX((3 * Math.PI) / 2))) / WORK;
  return { frames, stride, label };
}
