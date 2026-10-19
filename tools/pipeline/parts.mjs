// Cut-out parts: the image model draws a character as an exploded sheet of separate body parts, following a template of
// grey shapes, and each part is cut out with its joints: where it turns, and where its children hang from it.
// The far arm and leg reuse the near ones; the animation darkens them.

import sharp from 'sharp';
import { blank } from './image.mjs';

/**
 * The walk, 8 frames starting as the near leg touches down in front. Classic keys: contact, down, passing, up, then
 * the same for the far leg. Degrees; positive swings a hanging limb forward (toward +x). Knee and elbow are relative
 * to the bone above them. The far limbs run four frames behind the near ones.
 */
export const WALK = {
  thigh: [21, 15, 0, -13, -21, -13, 4, 18],
  knee: [-5, -18, -5, -10, -10, -40, -60, -25],
  arm: [-18, -10, 0, 10, 18, 10, 0, -10],
  elbow: [10, 12, 12, 18, 25, 18, 12, 12],
  lean: 3,
};

/**
 * Move the images of one frame down together until the lowest opaque row of any of them sits on the bottom edge:
 * the planted foot stays on the ground, and both views stay aligned. `air` pixels short of it for a frame she is off the
 * ground in, running.
 */
export function plant(imgs, air = 0) {
  let low = -1;
  for (const img of imgs) for (let y = img.h - 1; y > low; y--) {
    let hit = false;
    for (let x = 0; x < img.w && !hit; x++) hit = img.d[(y * img.w + x) * 4 + 3] >= 128;
    if (hit) { low = y; break; }
  }
  const drop = low < 0 ? 0 : Math.max(0, imgs[0].h - 1 - low - Math.round(air));
  return imgs.map((img) => {
    if (!drop) return img;
    const out = blank(img.w, img.h);
    out.d.set(img.d.subarray(0, (img.h - drop) * img.w * 4), drop * img.w * 4);
    return out;
  });
}

export const SHEET = { w: 1536, h: 1024 };

/**
 * The template, in sheet pixels, for a figure about 720 pixels tall seen from the side, facing right: each part's
 * grey shape, and its joints. A part turns on its first joint; the others are where its children attach.
 */
export const PARTS = {
  head: { at: [190, 240], joints: { neck: [190, 330] } },
  torso: { at: [470, 300], joints: { hip: [470, 400], neck: [470, 192], shoulder: [462, 222] } },
  coat: { at: [800, 320], joints: { waist: [800, 232] } },
  upperArm: { at: [1080, 270], joints: { shoulder: [1080, 222], elbow: [1080, 318] } },
  forearm: { at: [1250, 290], joints: { elbow: [1250, 226] } },
  thigh: { at: [330, 760], joints: { hip: [330, 696], knee: [330, 826] } },
  shin: { at: [650, 790], joints: { knee: [646, 712] } },
};

/**
 * Parts only some characters have, asked for by the recipe's `parts.extra`: where they go on the template, and their
 * joints. A ponytail is drawn on its own so it can sway; it hangs from the head's `tie` joint.
 */
export const EXTRA_PARTS = {
  ponytail: { at: [1110, 760], joints: { root: [1110, 640] } },
};

const SHAPES = {
  ponytail: ([x, y]) => `<path d="M ${x - 32} ${y - 120} Q ${x + 6} ${y - 140} ${x + 32} ${y - 112} L ${x + 12} ${y + 120} Q ${x} ${y + 150} ${x - 14} ${y + 118} Z"/>`,
  head: ([x, y]) => `<ellipse cx="${x}" cy="${y - 25}" rx="65" ry="75"/><rect x="${x - 22}" y="${y + 30}" width="44" height="70" rx="18"/>`,
  torso: ([x, y]) => `<rect x="${x - 75}" y="${y - 120}" width="150" height="240" rx="34"/>`,
  coat: ([x, y]) => `<path d="M ${x - 75} ${y - 100} L ${x + 75} ${y - 100} L ${x + 120} ${y + 100} L ${x - 120} ${y + 100} Z"/>`,
  upperArm: ([x, y]) => `<rect x="${x - 26}" y="${y - 81}" width="52" height="162" rx="26"/>`,
  forearm: ([x, y]) => `<rect x="${x - 22}" y="${y - 92}" width="44" height="130" rx="22"/><ellipse cx="${x + 4}" cy="${y + 58}" rx="24" ry="30"/>`,
  thigh: ([x, y]) => `<rect x="${x - 37}" y="${y - 109}" width="74" height="218" rx="37"/>`,
  shin: ([x, y]) => `<rect x="${x - 29}" y="${y - 114}" width="58" height="199" rx="29"/><rect x="${x - 29}" y="${y + 51}" width="120" height="44" rx="16"/>`,
};

/** The template as a PNG: grey shapes on white, no labels. With `cutout`, on transparency, for measuring. */
export async function template(cutout = false, extra = []) {
  const all = { ...PARTS, ...Object.fromEntries(extra.map((n) => [n, EXTRA_PARTS[n]])) };
  const shapes = Object.entries(all).map(([n, p]) => `<g fill="#cfe3ec">${SHAPES[n](p.at)}</g>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET.w}" height="${SHEET.h}">${cutout ? '' : '<rect width="100%" height="100%" fill="#ffffff"/>'}${shapes}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** The parts prompt for a character with these extra parts. */
export const partsPromptFor = (extra = []) => extra.includes('ponytail')
  ? partsPrompt.replace('the head with the neck and hair;', 'the head with the neck and the hair on the head, but without the ponytail; the ponytail on its own as a separate piece, from where it is tied at the back of the head to its tip, hanging straight down;')
  : partsPrompt;

export const partsPrompt = [
  'Draw a cut-out animation parts sheet of the character in the first image, seen from the side, facing right.',
  'The pale shapes in the second image only show where each part goes on the sheet and its rough size and direction; do not draw them.',
  'Draw every part as a separate piece with empty space around it, complete as if nothing covered it, and a little longer at each joint so it overlaps its neighbour when it bends. Every part ends in its own clothing or skin, never in a grey or coloured cap:',
  'the head with the neck and hair; the torso with the upper part of the coat, from the collar to the hips; the lower part of the coat, open, hanging from the waist;',
  'one upper arm in its coat sleeve; one forearm with the end of the sleeve and the hand, relaxed and open; one thigh in the trousers; one lower leg with its boot, toes pointing right.',
  'Keep every part at the same scale and in the same proportions as the character in the first image: no part shorter, longer, thinner or thicker than it is on her. Her thigh, from the hip to the knee, is long and slim, about three quarters as long as her lower leg from the knee to the sole.',
  'The same style, detail, colours and even, soft, frontal lighting as the first image.',
  'Transparent background, no text, no labels, no guide shapes.',
].join(' ');

/** The other side: the right-facing sheet redrawn as seen from the character's left, every part where it was. */
export const otherSidePrompt = [
  'This is a cut-out animation parts sheet of a character, every part seen from her right side, facing right.',
  'Redraw every part as seen from her other side, facing left: the same character, clothes and colours, each part turned around to face the other way and showing what is on that side, such as how her hair, visor and coat look from the left.',
  'Keep every part in the same place on the sheet and at the same size, separate and complete, in the same style and even lighting.',
  'Transparent background, no text.',
].join(' ');

/** Concierge parts: the raw sheet edited, so every part keeps its place and shape. */
export const conciergePartsPrompt = (description) => [
  'Edit this cut-out animation parts sheet into the same character\'s augmented look. Keep every part exactly where it is,',
  'with the same outline and size, separate and complete; change only surfaces, colours and details.',
  `The augmented look: ${description}`,
  'Transparent background, no text.',
].join(' ');

/**
 * Opaque blobs matched one to one with the parts: name → { pixels, box }. `at` gives each part's spot on the sheet
 * (the model may lay the sheet out its own way); without it, the template's layout is fitted onto the blobs'.
 */
function blobs(sheet, at = null) {
  const { w, h, d } = sheet, seen = new Uint8Array(w * h), out = {}, found = [];
  for (let p = 0; p < w * h; p++) {
    if (seen[p] || d[p * 4 + 3] < 128) continue;
    const stack = [p], pixels = [];
    seen[p] = 1;
    let sx = 0, sy = 0;
    while (stack.length) {
      const q = stack.pop(), x = q % w, y = (q / w) | 0;
      pixels.push(q); sx += x; sy += y;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
        if (n >= 0 && !seen[n] && d[n * 4 + 3] >= 128) { seen[n] = 1; stack.push(n); }
      }
    }
    if (pixels.length >= 40) found.push({ pixels, cx: sx / pixels.length, cy: sy / pixels.length });
  }
  // the model draws the parts bigger or shifted: compare layouts after fitting both into the same box, then match
  // the biggest blobs one to one with the slots, nearest pairs first; small leftovers join the nearest part
  const slots = Object.entries(at ?? Object.fromEntries(Object.entries(PARTS).map(([n, p]) => [n, { at: p.at }]))).map(([n, v]) => [n, { at: Array.isArray(v) ? v : v.at }]);
  const big = [...found].sort((a, b) => b.pixels.length - a.pixels.length).slice(0, slots.length);
  const frame = (pts) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs) || 1, Math.max(...ys) - Math.min(...ys) || 1]; };
  const [sx0, sy0, sw, sh] = frame(slots.map(([, p]) => p.at)), [bx0, by0, bw, bh] = frame(big.map((b) => [b.cx, b.cy]));
  const norm = (b) => (at ? [b.cx, b.cy] : [sx0 + ((b.cx - bx0) / bw) * sw, sy0 + ((b.cy - by0) / bh) * sh]);
  const pairs = [];
  for (const b of big) for (const [n, p] of slots) { const [x, y] = norm(b); pairs.push([Math.hypot(p.at[0] - x, p.at[1] - y), b, n]); }
  pairs.sort((a, b) => a[0] - b[0]);
  for (const [, b, n] of pairs) if (!out[n] && !b.name) { out[n] = { pixels: b.pixels }; b.name = n; }
  for (const b of found) if (!b.name) {
    let near = null, nd = Infinity;
    for (const o of big) if (o.name) { const dd = Math.hypot(o.cx - b.cx, o.cy - b.cy); if (dd < nd) { nd = dd; near = o; } }
    if (near) for (const q of b.pixels) out[near.name].pixels.push(q);
  }
  for (const b of Object.values(out)) {
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const p of b.pixels) { const x = p % w, y = (p / w) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    b.box = [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
  }
  return out;
}

/**
 * Where each part's joints are, read from its own shape: a fraction of the way down from its top (or up from its
 * bottom), centred on what is drawn at that height. The first joint is the one it turns on.
 */
// a joint is where a part turns or where a child hangs: on a row a fraction from its top or bottom, at the middle of that
// row; or at its back or front edge on a row a fraction from the top (`back` is the left of a part facing right): the
// tie of a ponytail at the back of the head, and the knot at the front of the ponytail's top
const JOINTS = {
  head: { neck: ['bottom', 0.1], tie: ['back', 0.15] },
  ponytail: { root: ['front', 0.09], tip: ['bottom', 0.04] },
  torso: { hip: ['bottom', 0.1], neck: ['top', 0.04], shoulder: ['top', 0.14] },
  coat: { waist: ['top', 0.03] },
  upperArm: { shoulder: ['top', 0.1], elbow: ['bottom', 0.1] },
  forearm: { elbow: ['top', 0.08] },
  thigh: { hip: ['top', 0.1], knee: ['bottom', 0.12] },
  shin: { knee: ['top', 0.08] },
};

function jointsOf(img, name, mirrored = false) {
  const opaque = (x, y) => img.d[(y * img.w + x) * 4 + 3] >= 128;
  const rowCentre = (y) => { let s = 0, n = 0; for (let x = 0; x < img.w; x++) if (opaque(x, y)) { s += x; n++; } return n ? s / n : img.w / 2; };
  // an edge, a little inside it: the left one or the right one, the other way round for a part facing left
  const rowEdge = (y, left) => {
    if (left) { for (let x = 0; x < img.w; x++) if (opaque(x, y)) return Math.min(img.w - 1, x + 4); }
    else for (let x = img.w - 1; x >= 0; x--) if (opaque(x, y)) return Math.max(0, x - 4);
    return img.w / 2;
  };
  return Object.fromEntries(Object.entries(JOINTS[name] ?? {}).map(([j, [from, f]]) => {
    const y = Math.min(img.h - 1, Math.round(from === 'bottom' ? (1 - f) * img.h : f * img.h));
    const x = from === 'back' ? rowEdge(y, !mirrored) : from === 'front' ? rowEdge(y, mirrored) : rowCentre(y);
    return [j, [Math.round(x), y]];
  }));
}

/**
 * Cut a sheet into its parts, each with its joints. `fix` overrides joints where the shape misleads (a hood on the
 * torso, a bun on the head), as fractions of the part's width and height, so one setting serves both views.
 */
export function cut(sheet, at = null, fix = {}, mirrored = false) {
  const found = blobs(sheet, at), parts = {};
  for (const [name, { pixels, box: [x0, y0, bw, bh] }] of Object.entries(found)) {
    const img = blank(bw, bh);
    for (const p of pixels) { const x = p % sheet.w, y = (p / sheet.w) | 0; img.d.set(sheet.d.subarray(p * 4, p * 4 + 4), ((y - y0) * bw + (x - x0)) * 4); }
    const joints = jointsOf(img, name, mirrored);
    // a left-facing part has its fixes mirrored
    for (const [j, [fx, fy]] of Object.entries(fix[name] ?? {})) joints[j] = [Math.round((mirrored ? 1 - fx : fx) * bw), Math.round(fy * bh)];
    parts[name] = { img, box: [x0, y0, bw, bh], joints };
  }
  return parts;
}

/* ---------- posing the parts: a 2D rig, for previews and for baking frames ---------- */


/**
 * The rig's angles for walk frame k of 8: the near limbs, the far ones half a cycle later, a lean and a coat sway.
 * A recipe's `parts.gait` gives the walk its character: `stride` and `knee` scale how far the legs swing and bend,
 * `swing` the arms' swing, `elbow` a constant bend held at the elbows, `lean` how far the torso leans back (degrees;
 * the head stays level). A shorter step, arms held closer with a soft bend and an upright back read as a lighter,
 * more feminine walk than the standard one.
 */
export function walkAngles(k, gait = {}) {
  const f = (k + 4) % 8, st = gait.stride ?? 1, kn = gait.knee ?? 1, sw = gait.swing ?? 1, el = gait.elbow ?? 0, lean = gait.lean ?? WALK.lean;
  return {
    // the coat trails a little behind, swinging out with each step
    torso: lean, head: -lean, coat: (-7 + 3 * Math.cos((4 * Math.PI * k) / 8)) * st,
    legUpper: WALK.thigh[k] * st, legLower: WALK.knee[k] * kn, legFarUpper: WALK.thigh[f] * st, legFarLower: WALK.knee[f] * kn,
    armUpper: WALK.arm[k] * sw, armLower: el + WALK.elbow[k] * sw, armFarUpper: WALK.arm[f] * sw, armFarLower: el + WALK.elbow[f] * sw,
  };
}

const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const tr = (x, y) => [1, 0, 0, 1, x, y];
const rot = (deg) => { const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t); return [c, -s, s, c, 0, 0]; };
const apply = (m, [x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const invert = (m) => { const det = m[0] * m[3] - m[2] * m[1]; return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det]; };

/**
 * The rig: each part turns on its first joint, which sits on a joint of its parent. Far limbs are the near ones again,
 * a little behind and darker. Back to front: an open coat hangs behind both legs, and the jacket covers their tops.
 */
const RIG = [
  ['armFarUpper', 'upperArm', 'torso', 'shoulder', 'shoulder', true], ['armFarLower', 'forearm', 'armFarUpper', 'elbow', 'elbow', true],
  ['coat', 'coat', 'torso', 'hip', 'waist', false],
  ['legFarUpper', 'thigh', 'torso', 'hip', 'hip', true], ['legFarLower', 'shin', 'legFarUpper', 'knee', 'knee', true], ['footFar', 'foot', 'legFarLower', 'ankle', 'ankle', true],
  ['legUpper', 'thigh', 'torso', 'hip', 'hip', false], ['legLower', 'shin', 'legUpper', 'knee', 'knee', false], ['foot', 'foot', 'legLower', 'ankle', 'ankle', false],
  // the head tucks its neck under the collar: drawn behind the torso, the ponytail behind the head
  ['ponytail', 'ponytail', 'head', 'tie', 'root', false], ['head', 'head', 'torso', 'neck', 'neck', false],
  ['torso', 'torso', null, null, 'hip', false],
  ['armUpper', 'upperArm', 'torso', 'shoulder', 'shoulder', false], ['armLower', 'forearm', 'armUpper', 'elbow', 'elbow', false],
];

/** Where a piece's point (in its part's own pixels) ends up for a set of angles: used to measure the stride. */
export function pointOf(parts, angles, piece, point, { origin, far = [-14, -6] }) {
  const out = {};
  pose(parts, angles, { w: 1, h: 1, origin, far, matrices: out });
  return apply(out[piece], point);
}

/**
 * Draw the parts posed. `angles` per rig piece in degrees (positive swings a hanging limb forward, toward +x), and
 * `far` the offset of the far limbs. Returns an image `w` by `h` with the hip at `origin`.
 */
export function pose(parts, angles, { w, h, origin, far = [-14, -6], matrices = null, coatFront = false }) {
  const out = blank(w, h), M = {}, order = [];
  // the coat can hang in front of the legs instead of behind them
  const rig = coatFront ? [...RIG.filter((r) => r[0] !== 'coat' && r[0] !== 'torso' && r[0] !== 'head' && !r[0].startsWith('armUpper') && r[0] !== 'armLower'), RIG.find((r) => r[0] === 'coat'), ...RIG.filter((r) => ['torso', 'head', 'armUpper', 'armLower'].includes(r[0]))] : RIG;
  // parents first, so every piece knows where its joint sits
  const byName = Object.fromEntries(RIG.map((r) => [r[0], r]));
  // a piece turns by its own angle plus its parent's, except that the legs and coat ignore the torso's lean
  const turn = (name) => { let a = 0; for (let n = name; n; n = byName[n][2]) { if (n === 'torso' && name !== 'torso' && !['head', 'ponytail', 'armUpper', 'armLower', 'armFarUpper', 'armFarLower'].includes(name)) break; a += angles[n] ?? 0; } return a; };
  const place = (name) => {
    if (M[name]) return M[name];
    const [, part, parent, attach, pivot, isFar] = byName[name], p = parts[part];
    const at = parent ? apply(place(parent), parts[byName[parent][1]].joints[attach]) : origin;
    const shift = isFar && parent === 'torso' ? far : [0, 0];
    M[name] = mul(mul(tr(at[0] + shift[0], at[1] + shift[1]), rot(turn(name))), tr(-p.joints[pivot][0], -p.joints[pivot][1]));
    return M[name];
  };
  // a character drawn without a separate foot walks on the boot of its shin
  for (const [name, part] of rig) if (parts[part]) { place(name); order.push(name); }
  if (matrices) Object.assign(matrices, M);
  for (const name of order) {
    const [, part, , , , isFar] = byName[name], img = parts[part]?.img;
    if (!img) continue;
    const inv = invert(M[name]);
    const corners = [[0, 0], [img.w, 0], [0, img.h], [img.w, img.h]].map((c) => apply(M[name], c));
    const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0])))), x1 = Math.min(w - 1, Math.ceil(Math.max(...corners.map((c) => c[0]))));
    const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1])))), y1 = Math.min(h - 1, Math.ceil(Math.max(...corners.map((c) => c[1]))));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const [sx, sy] = apply(inv, [x + 0.5, y + 0.5]), ix = Math.floor(sx), iy = Math.floor(sy);
      if (ix < 0 || iy < 0 || ix >= img.w || iy >= img.h) continue;
      const i = (iy * img.w + ix) * 4;
      if (img.d[i + 3] < 128) continue;
      const o = (y * w + x) * 4, k = isFar ? 0.62 : 1;
      out.d[o] = img.d[i] * k; out.d[o + 1] = img.d[i + 1] * k; out.d[o + 2] = img.d[i + 2] * k; out.d[o + 3] = 255;
    }
  }
  return out;
}

/* ---------- the walk: feet planted on the ground, legs reaching them ---------- */

/**
 * How she walks, a recipe's `parts.gait` changing any of it. Lengths are fractions of her leg (hip to ankle).
 * stride: ground covered in one cycle of two steps; stance: the part of the cycle a foot is on the ground; lift: how
 * high the ankle rises in the swing; strike and toeOff: the foot's angle as the heel lands and as the toe pushes off
 * (degrees); flex: how far the hip dips as the leg takes her weight; arms: the swing of the upper arms (degrees);
 * elbow and elbowSwing: the elbows' bend, and how much more as the arm comes forward; lean: how far her torso leans
 * forward from upright (degrees), whatever angle the parts sheet drew it at, the head and the hanging arms staying as
 * they hang; back: how far behind the hip, as a fraction of the stride, the foot's time on the ground is centred;
 * reach: how straight the legs get; coat: its flutter. The body is carried over its feet: the point the foot is centred
 * on is not the ankle but where a standing person's weight falls, 40% along the foot from the heel (`WEIGHT`). `idle` changes the same for her stance: weight on the near leg, the far leg free with its heel lifted (`heel`,
 * degrees) and its foot a little forward (`step`).
 */
export const GAIT = { frames: 16, stride: 1.35, stance: 0.62, lift: 0.11, strike: 12, toeOff: 24, flex: 0.008, arms: 10, elbow: 10, elbowSwing: 10, lean: 3, back: 0.04, reach: 0.993, coat: 2, dip: 0.08 };
/**
 * How she runs, a recipe's `parts.run` changing any of it: the walk's settings, the stride longer and the time on the
 * ground shorter than half the cycle, so both feet are off it between steps; the heel kicks up behind, the knee drives
 * forward, the torso leans into it, the arms are bent and swing hard, and the hip dips most halfway through each step
 * (`dip`: when in the cycle, after the foot lands).
 */
export const RUN = { frames: 16, stride: 2.3, stance: 0.36, lift: 0.3, strike: 4, toeOff: 30, flex: 0.03, arms: 46, elbow: 80, elbowSwing: 16, lean: 11, back: 0.02, reach: 0.985, coat: 5, dip: 0.17 };
export const STAND = { step: 0.06, heel: 10, reach: 0.997, arm: -3, elbow: 9, farArm: 4, farElbow: 12, lean: 1 };
/** Where along the foot, from the heel, a person's weight falls when they stand: the body is balanced over this point. */
const WEIGHT = 0.4;

/**
 * The torso's angle for the rig that makes it lean `forward` degrees from upright: the parts sheet may have drawn it
 * tilted. In the rig's angles a positive turn tips the torso back, as it swings a hanging limb forward.
 */
function torsoTurn(parts, forward) {
  const t = parts.torso?.joints;
  const drawn = t?.neck && t?.hip ? deg(Math.atan2(t.neck[0] - t.hip[0], t.hip[1] - t.neck[1])) : 0;
  return -(forward - drawn);
}

const rad = (d) => (d * Math.PI) / 180, deg = (r) => (r * 180) / Math.PI;
const smooth = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const smoother = (x) => { const t = Math.max(0, Math.min(1, x)); return t * t * t * (t * (t * 6 - 15) + 10); };
/** A vector turned the way the rig turns its parts: positive swings a hanging limb forward, and lifts a foot's toe. */
const turnVec = ([x, y], a) => { const c = Math.cos(a), s = Math.sin(a); return [c * x + s * y, -s * x + c * y]; };

/** The leg as the rig sees it: its bones' lengths and the angles they are drawn at, and the foot's heel and toe from its ankle. */
function legOf(parts) {
  const t = parts.thigh, sh = parts.shin, f = parts.foot;
  const v1 = [t.joints.knee[0] - t.joints.hip[0], t.joints.knee[1] - t.joints.hip[1]];
  const v2 = [sh.joints.ankle[0] - sh.joints.knee[0], sh.joints.ankle[1] - sh.joints.knee[1]];
  const rel = (j) => [f.joints[j][0] - f.joints.ankle[0], f.joints[j][1] - f.joints.ankle[1]];
  return { L1: Math.hypot(...v1), L2: Math.hypot(...v2), d1: Math.atan2(v1[0], v1[1]), d2: Math.atan2(v2[0], v2[1]), heel: rel('heel'), toe: rel('toe') };
}

/** The rig's thigh, knee and foot angles (degrees) that put the ankle at `a` from the hip at `h`, the foot at angle `phi`. The knee bends forward. */
function reach(leg, h, a, phi) {
  const vx = a[0] - h[0], vy = a[1] - h[1];
  const d = Math.max(Math.abs(leg.L1 - leg.L2) + 1e-3, Math.min(leg.L1 + leg.L2 - 1e-3, Math.hypot(vx, vy)));
  const b = Math.atan2(vx, vy), cos = (x) => Math.acos(Math.max(-1, Math.min(1, x)));
  const thighAbs = b + cos((leg.L1 ** 2 + d * d - leg.L2 ** 2) / (2 * leg.L1 * d)), shinAbs = b - cos((leg.L2 ** 2 + d * d - leg.L1 ** 2) / (2 * leg.L2 * d));
  const thigh = thighAbs - leg.d1, shinTurn = shinAbs - leg.d2;
  return { thigh: deg(thigh), knee: deg(shinTurn - thigh), foot: deg(phi - shinTurn), thighAbs: deg(thighAbs) };
}

/** How far below the hip at `h` the ground can be for an ankle at x, `oy` above the ground: the leg just reaching. */
const groundFor = (h, x, oy, R) => h[1] + Math.sqrt(Math.max(0, R * R - (x - h[0]) ** 2)) + oy;
/** The lower of two values, smoothly: never above either, so neither leg is ever asked to reach too far. */
const softMin = (a, b, k) => Math.min(a, b) - k * Math.log(1 + Math.exp(-Math.abs(a - b) / k));

/**
 * One walk cycle for parts that have a foot: the rig's angles for each frame, and the stride (pixels of ground covered
 * in a cycle) for the game to step her by, so her feet stay where they land. Each foot is on the ground for the stance,
 * landing on its heel, rolling flat and pushing off from its toe, and swings forward through the air for the rest of the
 * cycle; the legs reach the feet, and the hip rides as high as both legs allow, so it dips at each heel strike and rises
 * over the standing leg. `far` is where the far hip sits from the near one.
 */
export function walkCycle(parts, gaitIn = {}, far = [-14, -6], base = GAIT) {
  const g = { ...base, ...gaitIn }, leg = legOf(parts), L = leg.L1 + leg.L2, S = g.stride * L, R = g.reach * L;
  const footLen = leg.toe[0] - leg.heel[0], heelOff = g.stance - 0.2;
  // the heel lands so that, halfway through the foot's time on the ground, its weight point passes a little behind her
  // hip: she is carried over her feet
  const hx0 = S * (g.stance / 2 - g.back) - WEIGHT * footLen;
  const stanceAt = (p) => {
    const phi = p < 0.1 ? rad(g.strike) * (1 - smooth(p / 0.1)) : p < heelOff ? 0 : -rad(g.toeOff) * smooth((p - heelOff) / (g.stance - heelOff));
    // the foot stays where it landed: its heel's spot moves back under her as she walks on, and it turns on the heel
    // as it lands and on the toe as it pushes off
    const hx = hx0 - S * p, [cx, rel] = phi >= 0 ? [hx, leg.heel] : [hx + footLen, leg.toe], v = turnVec(rel, phi);
    return { x: cx - v[0], oy: v[1], phi };
  };
  const legAt = (p) => {
    p = ((p % 1) + 1) % 1;
    if (p <= g.stance) return stanceAt(p);
    const a = stanceAt(g.stance), b = stanceAt(0), u = (p - g.stance) / (1 - g.stance), mid = rad(8);
    const phi = u < 0.6 ? a.phi + (mid - a.phi) * smooth(u / 0.6) : mid + (b.phi - mid) * smooth((u - 0.6) / 0.4);
    return { x: a.x + (b.x - a.x) * smoother(u), oy: a.oy + (b.oy - a.oy) * smooth(u) + g.lift * L * Math.sin(Math.PI * Math.pow(u, 0.6)), phi };
  };
  const bell = (x) => { const w = ((x % 1) + 1.5) % 1 - 0.5; return Math.exp(-((w / 0.07) ** 2)); };
  const tor = torsoTurn(parts, g.lean), frames = [];
  for (let k = 0; k < g.frames; k++) {
    const p = k / g.frames, n = legAt(p), f = legAt(p + 0.5);
    // the ground under the hip: as low as the legs reach, a little lower as each leg takes her weight
    const G = softMin(groundFor([0, 0], n.x, n.oy, R), groundFor(far, f.x, f.oy, R), 0.02 * L) - g.flex * L * (bell(p - g.dip) + bell(p - g.dip - 0.5));
    const nl = reach(leg, [0, 0], [n.x, G - n.oy], n.phi), fl = reach(leg, far, [f.x, G - f.oy], f.phi);
    // how far the lowest point of either foot is off the ground: 0 while one stands on it, more when she is in the air
    const low = (ft) => Math.max(...[leg.heel, leg.toe].map((pt) => turnVec(pt, ft.phi)[1])) - ft.oy;
    const air = Math.max(0, -Math.max(low(n), low(f)));
    const arm = (q) => ({ up: -g.arms * Math.cos(2 * Math.PI * (q - 0.05)), low: g.elbow + (g.elbowSwing * (1 - Math.cos(2 * Math.PI * (q - 0.05)))) / 2 });
    const an = arm(p), af = arm(p + 0.5);
    // the head and the arms turn with the torso; turned back by as much, the head stays level and the arms hang
    frames.push({
      torso: tor, head: -tor, coat: -2 + 0.15 * (nl.thighAbs + fl.thighAbs) + g.coat * Math.sin(4 * Math.PI * p + 0.9),
      legUpper: nl.thigh, legLower: nl.knee, foot: nl.foot, legFarUpper: fl.thigh, legFarLower: fl.knee, footFar: fl.foot,
      armUpper: an.up - tor, armLower: an.low, armFarUpper: af.up - tor, armFarLower: af.low,
      // where the thighs point, for a coat or skirt that the legs push and drag; and how high the hip rides, for hair
      // that bounces with each step
      thighAbs: nl.thighAbs, thighAbsFar: fl.thighAbs, bob: G, air,
    });
  }
  return { frames, stride: S };
}

/** One run cycle: the walk's model with the run's settings (`RUN`, a recipe's `parts.run` over them). */
export const runCycle = (parts, runIn = {}, far = [-14, -6]) => walkCycle(parts, runIn, far, RUN);

/** Her stance for parts that have a foot: weight on the near leg, its foot flat under her; the far leg free, a little forward, heel lifted. */
export function standPose(parts, standIn = {}, far = [-14, -6]) {
  // the leg she stands on is straight, as a standing leg is: its knee only just short of locked
  const st = { ...STAND, ...standIn }, leg = legOf(parts), L = leg.L1 + leg.L2, R = st.reach * L;
  // the foot she stands on is under her with its weight point below her hip, the ankle a little behind it
  const ax = -(leg.heel[0] + WEIGHT * (leg.toe[0] - leg.heel[0])), G = groundFor([0, 0], ax, leg.heel[1], R);
  const near = reach(leg, [0, 0], [ax, G - leg.heel[1]], 0);
  const phi = -rad(st.heel), toeX = ax + leg.toe[0] + st.step * L, v = turnVec(leg.toe, phi);
  const free = reach(leg, far, [toeX - v[0], G - v[1]], phi), tor = torsoTurn(parts, st.lean);
  return {
    torso: tor, head: -tor, coat: 0, legUpper: near.thigh, legLower: near.knee, foot: near.foot,
    legFarUpper: free.thigh, legFarLower: free.knee, footFar: free.foot,
    armUpper: st.arm - tor, armLower: st.elbow, armFarUpper: st.farArm - tor, armFarLower: st.farElbow,
  };
}

/**
 * Standing, alive: one breath as a loop of frames around her stance. Breathing in lifts her chest and tips her torso
 * back a touch, her head following only partly; her arms sway a little later than the breath, and her free knee softens
 * as she breathes out. `breath` scales it all; the stance is `standPose`'s.
 */
export function idleCycle(parts, standIn = {}, far = [-14, -6], { frames = 16, breath = 1 } = {}) {
  const base = standPose(parts, standIn, far), out = [];
  for (let k = 0; k < frames; k++) {
    const p = k / frames, b = Math.sin(2 * Math.PI * p) * breath, late = Math.sin(2 * Math.PI * (p - 0.12)) * breath;
    out.push({
      ...base,
      torso: base.torso + 0.6 * b, head: base.head - 0.4 * b,
      armUpper: base.armUpper + 0.9 * late, armLower: base.armLower + 0.7 * late,
      armFarUpper: base.armFarUpper - 0.7 * late, armFarLower: base.armFarLower + 0.6 * late,
      legFarUpper: base.legFarUpper + 0.6 * (1 - b) / 2, legFarLower: base.legFarLower - 1.6 * (1 - b) / 2,
      coat: base.coat + 0.4 * b,
    });
  }
  return out;
}

/** The grey shapes' own boxes, measured from the template. */
export const measure = (templateCutout) => blobs(templateCutout);
