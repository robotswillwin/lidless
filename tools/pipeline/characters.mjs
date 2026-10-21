// Characters that walk: parts sheets drawn by the image model and cut into parts with their joints, posed to the recipe's
// proportions, rigged and rendered in Blender, or baked into frames without it.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { contentBox, fitColours, fitToHeight, hardenAlpha, paletteFit, pixelate, unionBox } from './clean.mjs';
import { blank, crop, readRGBA, resize, writePNG } from './image.mjs';
import { loadReferences } from './images.mjs';
import { edit } from './openai.mjs';
import { conciergePartsPrompt, cut as cutParts, EXTRA_PARTS, idleCycle, otherSidePrompt, PARTS as PARTS_NAMES, partsPromptFor, plant, pointOf, pose as posePartsRig, jogCycle, runCycle, SHEET, standPose, template as partsTemplate, walkAngles, walkCycle } from './parts.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { palette, rel } from './shared.mjs';

export async function cmdParts([file], opt) {
  const r = await loadRecipe(file), look = opt.view ?? 'raw', quality = opt.quality ?? 'low', dir = join(r.dir, 'parts');
  // --side left: the character seen from the other side; its parts live under raw-left and concierge-left
  const left = opt.side === 'left', view = left ? `${look}-left` : look;
  await mkdir(join(dir, view), { recursive: true });
  const extra = r.parts?.extra ?? [], partsPrompt = partsPromptFor(extra, r.parts?.pieces);
  const tpl = await partsTemplate(false, extra);
  await writeFile(join(dir, 'template.png'), tpl);
  if (opt.preview) return previewParts(r, dir);
  if (opt.bake) return bakeParts(r, dir);
  if (opt.dry) return console.log(`${r.name}: template in ${rel(join(dir, 'template.png'))}\n\n${partsPrompt}`);
  const small = async (buf) => ({ data: await sharp(buf).resize(1024, 1024, { fit: 'inside' }).png().toBuffer() });
  const sheetFile = join(dir, `${view}-sheet.png`);
  let res = { images: [], cost: 0 };
  // --recut cuts the sheet already drawn again, without drawing a new one; --mirror makes the left sheet by mirroring
  // the right one, so both sides are the same person (touch up what differs, such as an eye device, afterwards)
  if (opt.recut && existsSync(sheetFile)) res.images.push(await readFile(sheetFile));
  else if (left && opt.mirror) {
    const right = join(dir, `${look}-sheet.png`);
    if (!existsSync(right)) throw new Error(`make the right-facing ${look} parts first`);
    res.images.push(await sharp(right).flop().png().toBuffer());
  }
  else if (left && look === 'raw') {
    const right = join(dir, 'raw-sheet.png');
    if (!existsSync(right)) throw new Error('make the right-facing raw parts first: the left ones are redrawn from them');
    res = await edit({ prompt: `${otherSidePrompt} ${r.parts?.left?.raw ?? ''}`, images: [right], size: `${SHEET.w}x${SHEET.h}`, quality, n: 1, background: 'transparent' });
  } else if (view === 'raw') {
    const from = join(r.dir, r.parts?.from ?? 'raw.png');
    if (!existsSync(from)) throw new Error(`no image to draw the parts from at ${rel(from)}`);
    res = await edit({ prompt: partsPrompt, images: [{ name: 'character.png', ...(await small(await readFile(from))) }, { name: 'template.png', ...(await small(tpl)) }], size: `${SHEET.w}x${SHEET.h}`, quality, n: 1, background: 'transparent' });
  } else {
    const rawSheet = join(dir, left ? 'raw-left-sheet.png' : 'raw-sheet.png');
    if (!existsSync(rawSheet)) throw new Error('make the raw parts first: they are edited into the Concierge ones');
    if (!r.concierge) throw new Error(`${r.name} has no "concierge" description`);
    // pictures of her in the augmented look, if the recipe has them, show what the words cannot: her colours, her hair
    const refs = (r.conciergeReferences ?? []).map((f) => resolve(ROOT, f));
    const note = refs.length ? 'The first attached image is the parts sheet to edit. The other attached images show this same character in the augmented look: match her colours, hair, eye device and rendering there, but keep every part on the sheet exactly where it is, with the same outline. ' : '';
    res = await edit({ prompt: `${note}${conciergePartsPrompt(r.concierge, r.parts?.reshape)} ${left ? r.parts?.left?.concierge ?? '' : ''}`, images: [rawSheet, ...(await loadReferences(refs))], size: `${SHEET.w}x${SHEET.h}`, quality, n: 1, background: 'transparent' });
  }
  await writeFile(sheetFile, res.images[0]);
  // --swap a,b: two pieces the last cut took for each other change places in the recipe's parts.at, which keeps every
  // piece where that cut found it, for this cut and the ones after it
  const jfile0 = join(dir, 'parts.json');
  if (typeof opt.swap === 'string') {
    const [a, b] = opt.swap.split(',').map((s) => s.trim()), cur = existsSync(jfile0) ? JSON.parse(await readFile(jfile0, 'utf8'))[look] : null;
    if (!cur?.[a]?.box || !cur?.[b]?.box) throw new Error(`cut the ${look} parts first: --swap names two of their pieces`);
    const mid = ([x, y, w, h]) => [Math.round(x + w / 2), Math.round(y + h / 2)], keep = new Set(r.parts?.same?.parts ?? []);
    const at = { ...(r.parts?.at ?? {}) };
    for (const [n, p] of Object.entries(cur)) if (!keep.has(n) && p.box) at[n] = mid(p.box);
    [at[a], at[b]] = [mid(cur[b].box), mid(cur[a].box)];
    r.parts = { ...r.parts, at };
    const raw = JSON.parse(await readFile(r.file, 'utf8'));
    raw.parts = { ...raw.parts, at };
    await writeFile(r.file, JSON.stringify(raw, null, 2) + '\n');
    console.log(`${r.name}: ${a} and ${b} swapped in ${rel(r.file)}'s parts.at`);
  }
  // a mirrored left sheet has every part on the other side of the sheet
  const at = r.parts?.at && left && r.parts?.left?.mirror ? Object.fromEntries(Object.entries(r.parts.at).map(([n, [x, y]]) => [n, [SHEET.w - x, y]])) : r.parts?.at ?? null;
  const parts = cutParts(await readRGBA(sheetFile), at, r.parts?.joints ?? {}, left, extra);
  for (const [name, p] of Object.entries(parts)) await writePNG(join(dir, view, `${name}.png`), p.img);
  const jfile = join(dir, 'parts.json'), all = existsSync(jfile) ? JSON.parse(await readFile(jfile, 'utf8')) : {};
  // parts.same: parts taken as they are from another character's, for the same view, such as her head and hair in
  // another outfit, so she stays the same person
  const same = r.parts?.same, sameDir = same ? join(resolve(ROOT, same.from), 'parts') : null;
  const sameJoints = sameDir ? JSON.parse(await readFile(join(sameDir, 'parts.json'), 'utf8'))[view] ?? {} : {};
  for (const name of same?.parts ?? []) {
    const src = join(sameDir, view, `${name}.png`);
    if (!existsSync(src) || !sameJoints[name]) throw new Error(`${r.name}: no ${view} ${name} in ${rel(sameDir)} to take`);
    await copyFile(src, join(dir, view, `${name}.png`));
    parts[name] = { img: await readRGBA(src), box: sameJoints[name].box, joints: sameJoints[name].joints, same: true };
  }
  // a mirrored left sheet takes its joints from the right one, mirrored across the sheet, so they stay where they
  // belong even where a touch-up has changed a part's outline
  const right = left && r.parts?.left?.mirror ? all[look] : null;
  if (right) for (const [name, p] of Object.entries(parts)) {
    const rp = right[name];
    if (p.same) continue;
    if (rp?.box) p.joints = Object.fromEntries(Object.entries(rp.joints).map(([j, [x, y]]) => [j, [SHEET.w - 1 - (rp.box[0] + x) - p.box[0], rp.box[1] + y - p.box[1]]]));
  }
  all[view] = Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, { size: [p.img.w, p.img.h], box: p.box, joints: p.joints }]));
  await writeFile(jfile, JSON.stringify(all, null, 2) + '\n');
  await checkSheet(sheetFile, parts, join(dir, `${view}-check.png`));
  const missing = [...Object.keys(PARTS_NAMES), ...extra.filter((n) => EXTRA_PARTS[n])].filter((n) => !parts[n]);
  console.log(`${r.name}: ${Object.keys(parts).length} parts → ${rel(join(dir, view))}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`);
  console.log(res.cost == null ? 'Cost: not reported by the API.' : `Cost: $${res.cost.toFixed(4)}`);
}

/**
 * The sheet with each piece the cut found outlined and named, to see at a glance that it took each for what it is: the
 * image model does not always lay a sheet out as asked, and two pieces of a size, such as a forearm and a thigh, can
 * change places. `parts --recut --swap forearm,thigh` puts them right.
 */
async function checkSheet(sheetFile, parts, out) {
  const W = 960, meta = await sharp(sheetFile).metadata(), k = W / meta.width, H = Math.round(meta.height * k);
  const marks = Object.entries(parts).filter(([, p]) => !p.same).map(([n, p]) => {
    const [x, y, w, h] = p.box.map((v) => Math.round(v * k));
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#ff3d7f" stroke-width="2"/><text x="${x + 4}" y="${y + 18}" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${n}</text>`;
  }).join('');
  await sharp(sheetFile).resize(W, H).flatten({ background: '#2b2a33' }).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${marks}</svg>`) }]).png().toFile(out);
  console.log(`  each piece named: ${rel(out)}`);
}

/** Each part's length along its bone, in its own pixels: from joint to joint, or from its joint to its far end. */
export const BONE = {
  head: (p) => p.joints.neck[1],
  torso: (p) => Math.abs(p.joints.hip[1] - p.joints.neck[1]),
  coat: (p) => p.img.h - p.joints.waist[1],
  upperArm: (p) => Math.abs(p.joints.elbow[1] - p.joints.shoulder[1]),
  forearm: (p) => p.img.h - p.joints.elbow[1],
  thigh: (p) => Math.abs(p.joints.knee[1] - p.joints.hip[1]),
  shin: (p) => p.img.h - p.joints.knee[1],
  ponytail: (p) => p.img.h - p.joints.root[1],
};

/** A character's proportions for one view: the recipe's, with that view's own where it has any (heels in one view). */
export const proportionsFor = (r, look) => (r.parts?.proportions ? { ...r.parts.proportions, ...(r.parts.proportionsByView?.[look] ?? {}) } : undefined);

/**
 * The parts resized so the figure has the recipe's proportions: `parts.proportions` gives each part's length as a
 * fraction of her height, measured on her design (the head from its top to the base of the neck, the torso from the
 * neck to the hip joint, the coat from the hip to the hem, the shin from the knee to the sole, the forearm from the
 * elbow to the fingertips, and `boot` the boot's height when the shin part is drawn as a boot). An image model draws a
 * parts sheet at its own sizes, a big head and short legs as often as not; without this the rig puts them together as
 * drawn. The torso keeps its size; the others follow it.
 */
export async function proportion(parts, prop, unit) {
  if (!prop?.torso || !parts.torso) return parts;
  // her height in the parts' pixels: given, or what makes the torso keep its size
  unit ??= BONE.torso(parts.torso) / prop.torso;
  // what hangs from the waist with no length of its own (hips in briefs or trousers) keeps its size against the torso,
  // as the sheet drew them together
  const byTorso = (prop.torso * unit) / BONE.torso(parts.torso);
  for (const [name, p] of Object.entries(parts)) {
    if (!p.joints || !BONE[name] || (name === 'shin' && prop.boot)) continue;
    if (!prop[name] && name !== 'coat') continue;
    const s = prop[name] ? (prop[name] * unit) / BONE[name](p) : byTorso;
    // a garment as wide as drawn but longer or shorter (parts.proportions.coatLength): stretched down only, as a long
    // coat drawn short on the sheet would be far too wide made long by scaling it whole
    const sy = name === 'coat' && prop.coatLength ? (prop.coatLength * unit) / BONE.coat(p) : s;
    if (Math.abs(s - 1) < 0.01 && Math.abs(sy - 1) < 0.01) continue;
    const w = Math.max(1, Math.round(p.img.w * s)), h = Math.max(1, Math.round(p.img.h * sy));
    parts[name] = { img: await resize(p.img, w, h), joints: Object.fromEntries(Object.entries(p.joints).map(([j, [x, y]]) => [j, [(x * w) / p.img.w, (y * h) / p.img.h]])) };
  }
  if (prop.boot && prop.shin && parts.shin && parts.thigh) Object.assign(parts, await lowerLeg(parts.shin.img, parts.thigh, prop.boot * unit, prop.shin * unit));
  // a lower leg drawn whole, the leg into its shoe, is split at the ankle so the foot can roll
  else if (parts.shin && !parts.foot) Object.assign(parts, splitAnkle(parts.shin.img, parts.shin.joints.knee));
  // a shoe drawn too big for her, such as a fluffy slipper: the foot scaled to the recipe's length, heel to toe, as a
  // share of her height (her boots are 0.13)
  const f = parts.foot, len = f ? footLength(f.img) : 0;
  if (prop.foot && len > 0 && Math.abs((prop.foot * unit) / len - 1) > 0.02) {
    const s = (prop.foot * unit) / len, w = Math.max(1, Math.round(f.img.w * s)), h = Math.max(1, Math.round(f.img.h * s));
    parts.foot = { img: await resize(f.img, w, h), joints: Object.fromEntries(Object.entries(f.joints).map(([j, [x, y]]) => [j, [(x * w) / f.img.w, (y * h) / f.img.h]])) };
  }
  if (parts.head) parts.head = { ...parts.head, img: extendNeck(parts.head.img) };
  return parts;
}

/**
 * Another outfit's thigh and lower leg (her bare legs), sized as this outfit's are, in the colours this outfit drew its
 * own legs in: each pixel the median colour of this one's thigh, or of its lower leg, shaded by how light or dark the
 * bare leg is there against its own median, so the tights keep her knee, her calf and her outline. The foot stays this
 * outfit's (its shoe), hung from the borrowed shin's ankle.
 */
async function legsFrom(from, v, prop, unit, own) {
  const dir = join(resolve(ROOT, from), 'parts'), info = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8'))[v];
  if (!info?.thigh || !info?.shin || !info?.torso) throw new Error(`no ${v} thigh and lower leg in ${rel(dir)} to take her legs from`);
  // sized with their torso at this outfit's scale; a set seen from the left is mirrored to face right, as the rig has it
  const theirs = {};
  for (const n of ['torso', 'thigh', 'shin']) {
    const img = await readRGBA(join(dir, v, `${n}.png`));
    theirs[n] = v.endsWith('-left') ? mirrorPart(img, info[n].joints) : { img, joints: { ...info[n].joints } };
  }
  await proportion(theirs, { thigh: prop.thigh, shin: prop.shin, torso: prop.torso }, unit);
  const median = (img, from = 0, to = 1) => {
    const px = [];
    for (let y = Math.round(img.h * from); y < Math.round(img.h * to); y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.d[i + 3] > 200) px.push([img.d[i], img.d[i + 1], img.d[i + 2]]); }
    return [0, 1, 2].map((c) => (px.length ? px.map((p) => p[c]).sort((a, b) => a - b)[px.length >> 1] : 0));
  };
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const dress = (img, colour) => {
    const out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) }, base = lum(median(img));
    for (let i = 0; i < out.d.length; i += 4) {
      if (!out.d[i + 3]) continue;
      const s = Math.min(1.8, lum([img.d[i], img.d[i + 1], img.d[i + 2]]) / Math.max(1, base));
      for (let c = 0; c < 3; c++) out.d[i + c] = Math.round(colour[c] * Math.pow(s, 1.3));
    }
    return out;
  };
  // the lower leg's own colour from its shaft, above the shoe
  return {
    thigh: { ...theirs.thigh, img: dress(theirs.thigh.img, median(own.thigh.img)) },
    shin: { ...theirs.shin, img: dress(theirs.shin.img, median(own.shin.img, 0.1, 0.55)) },
  };
}

/**
 * A foot's length, heel to toe: its widest row below the ankle. Not where it touches the ground: a sock or a bare foot,
 * rounded at the heel and the toe, touches it only in the middle.
 */
export function footLength(img) {
  let most = 0;
  for (let y = Math.floor(img.h * 0.4); y < img.h; y++) { const sp = span(img, y); if (sp) most = Math.max(most, sp[1] - sp[0] + 1); }
  return most;
}

/**
 * Bare skin at a joint: the piece fades out over its overlap with the one under it, so no straight cut shows where a
 * sleeve or a trouser leg would have hidden it. An upper arm, a forearm, a lower leg fade at the top, past the joint
 * they turn on; the torso at the bottom, past the hip.
 *
 * `onto`: the pieces it fades into at its `top` and its `bottom`, at rest, each { img, at }, `at` where that piece's
 * first pixel is in this one's. Over the other piece it fades as before; past the other's outline, where only the
 * background would show through, it stays solid and its outline turns into the other's across the fade, so no
 * see-through rim is left there for the light to catch.
 */
export function softenJoint(part, name, bottom = 0.1, onto = {}) {
  const { img, joints } = part, h = img.h, w = img.w, out = { w, h, d: new Uint8ClampedArray(img.d) };
  const fade = (from, len) => {
    const other = onto[from];
    for (let y = 0; y < h; y++) {
      const t = Math.min(1, (from === 'top' ? y : h - 1 - y) / len), k = t * t * (3 - 2 * t);
      if (k >= 1) continue;
      const py = other ? y - other.at[1] : -1, own = other ? span(img, y) : null;
      const theirs = own && py >= 0 && py < other.img.h ? span(other.img, py) : null;
      if (!theirs) { for (let x = 0; x < w; x++) out.d[(y * w + x) * 4 + 3] *= k; continue; }
      // the outline here, from its own (k 1) to the other's (k 0)
      const l = own[0] + (theirs[0] + other.at[0] - own[0]) * (1 - k), r = own[1] + (theirs[1] + other.at[0] - own[1]) * (1 - k);
      for (let x = 0; x < w; x++) {
        const px = x - other.at[0], under = px >= 0 && px < other.img.w ? other.img.d[(py * other.img.w + px) * 4 + 3] / 255 : 0;
        const inside = Math.min(1, Math.max(0, Math.min(x - l, r - x) + 0.5));
        out.d[(y * w + x) * 4 + 3] *= under * k + (1 - under) * inside;
      }
    }
  };
  // a bare neck: the torso's top, down to its shoulders, melds into the head's neck behind it (see shapeParts)
  if (name === 'neck') { fade('top', Math.max(h * 0.06, (joints.shoulder?.[1] ?? h * 0.15) * 1.15)); return { ...part, img: out }; }
  // hips in briefs, drawn over her belly and the tops of her thighs: both of their straight edges; the bottom over
  // `bottom` of the piece's height, long enough for the buttocks to round off into the thighs under them
  if (name === 'coat') { fade('top', Math.max(h * 0.08, joints.waist?.[1] ?? 0)); fade('bottom', h * bottom); return { ...part, img: out }; }
  const atTop = { upperArm: 'shoulder', forearm: 'elbow', shin: 'knee', thigh: 'hip' }[name];
  const jy = atTop ? joints[atTop]?.[1] : joints.hip?.[1];
  if (jy === undefined) return part;
  // from the end to the joint, at least a twentieth of the piece
  fade(atTop ? 'top' : 'bottom', Math.max(h * 0.05, atTop ? jy : h - jy));
  return { ...part, img: out };
}

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, b === a ? Number(x >= b) : (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * A piece's back (its left side: every set faces right) kept inside the back of another drawn over it, so where the two
 * meet her back runs on into the other's outline instead of stepping out past it: on every row the other covers no
 * further out than its back, and over `ramp` rows above them, from its own back over to the other's. `at` is where the
 * other's first pixel is in this piece's. Bare hips drawn narrower at the waist than the torso's bottom would otherwise
 * leave a notch in the small of her back.
 */
export function tuckBack(part, other, at, ramp) {
  const { img } = part, out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) };
  // where the other begins in earnest: its first row at least half as wide as it gets (not a sliver of its top edge)
  const widths = Array.from({ length: other.img.h }, (_, y) => { const s = span(other.img, y); return s ? s[1] - s[0] + 1 : 0; });
  const most = Math.max(...widths), first = widths.findIndex((w) => w >= most * 0.5);
  if (first < 0) return part;
  const y0 = first + at[1], b0 = span(other.img, first)[0] + at[0], from = Math.max(0, y0 - ramp), start = span(img, from)?.[0];
  for (let y = from; y < img.h; y++) {
    let limit;
    if (y < y0) { if (start === undefined) continue; limit = start + (b0 - start) * ((y - from) / Math.max(1, y0 - from)); }
    else { const s = span(other.img, y - at[1]); if (!s) continue; limit = s[0] + at[0]; }
    for (let x = 0; x < img.w && x < limit + 1; x++) out.d[(y * img.w + x) * 4 + 3] *= Math.min(1, Math.max(0, x - limit + 0.5));
  }
  return { ...part, img: out };
}

/**
 * A limb's pieces at rest, each hung from the one before by a joint, as one image: the thigh, the lower leg and the foot
 * as one leg; the upper arm and the forearm as one arm. Where two pieces overlap they cross-fade from the one above to
 * the one below, so neither's drawn end shows, and the outline goes over from one to the other. Skinned on the limb's
 * bones (tools/blender/rig.py), it bends as one at the knee and the elbow, with no seam where the pieces met.
 * `chain` is [[piece], [piece, joint of the piece before it hangs from, its own joint], ...]; returns { img, joints },
 * every piece's joints in the image's pixels.
 */
export function composeLimb(chain) {
  const off = [[0, 0]];
  for (let i = 1; i < chain.length; i++) {
    const [p, from, own] = chain[i], prev = chain[i - 1][0], [px, py] = off[i - 1];
    off.push([px + prev.joints[from][0] - p.joints[own][0], py + prev.joints[from][1] - p.joints[own][1]]);
  }
  const x0 = Math.floor(Math.min(...chain.map(([p], i) => off[i][0]))), y0 = Math.floor(Math.min(...chain.map(([p], i) => off[i][1])));
  const x1 = Math.ceil(Math.max(...chain.map(([p], i) => off[i][0] + p.img.w))), y1 = Math.ceil(Math.max(...chain.map(([p], i) => off[i][1] + p.img.h)));
  const W = x1 - x0, H = y1 - y0, img = blank(W, H), at = off.map(([x, y]) => [Math.round(x - x0), Math.round(y - y0)]);
  // each piece's share of a row: all of it, but across its overlap with the piece above and the piece below, a cross-fade
  const share = (i, y) => {
    let w = 1;
    const top = at[i][1], bottom = at[i][1] + chain[i][0].img.h - 1;
    if (i > 0) { const pb = at[i - 1][1] + chain[i - 1][0].img.h - 1; if (pb > top) w *= smoothstep(top, pb, y); }
    if (i < chain.length - 1) { const nt = at[i + 1][1]; if (bottom > nt) w *= 1 - smoothstep(nt, bottom, y); }
    return w;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let a = 0, r = 0, g = 0, b = 0;
    chain.forEach(([p], i) => {
      const px = x - at[i][0], py = y - at[i][1];
      if (px < 0 || py < 0 || px >= p.img.w || py >= p.img.h) return;
      const j = (py * p.img.w + px) * 4, pa = (p.img.d[j + 3] / 255) * share(i, y);
      if (pa <= 0) return;
      a += pa; r += p.img.d[j] * pa; g += p.img.d[j + 1] * pa; b += p.img.d[j + 2] * pa;
    });
    if (a <= 0) continue;
    const o = (y * W + x) * 4;
    img.d[o] = r / a; img.d[o + 1] = g / a; img.d[o + 2] = b / a; img.d[o + 3] = Math.min(255, Math.round(a * 255));
  }
  const joints = {};
  chain.forEach(([p], i) => { for (const [n, [jx, jy]] of Object.entries(p.joints)) joints[n] = [jx + at[i][0], jy + at[i][1]]; });
  return { img, joints };
}

/**
 * A set of parts as the rig takes them (`v` the view and side, such as raw-left): sized to the recipe's proportions,
 * by the torso of the parts it takes from another character (`sameAll`), the head set on the neck, the legs hung from the
 * hip joint, a bare neck's stump faded, the hips cut, and her limbs joined into one image each. Changes `parts`; returns
 * the limbs.
 */
export async function shapeParts(r, look, v, parts, sameAll) {
  const prop = proportionsFor(r, look), them = sameAll?.[v]?.torso, unit = them && prop?.torso ? BONE.torso(them) / prop.torso : undefined;
  // parts.legs: her legs' shape from another outfit (her bare legs), in this one's colours, its own shoes kept: a sheet
  // can draw legs in tights as thin as tubes. Taken before this outfit's own are sized, at the same scale
  const own = r.parts?.legs ? { thigh: parts.thigh, shin: parts.shin } : null;
  await proportion(parts, prop, unit);
  if (own?.thigh && parts.thigh && parts.foot) Object.assign(parts, await legsFrom(r.parts.legs.from, v, prop, unit ?? BONE.torso(parts.torso) / prop.torso, own));
  // a garment with no collar shows the neck her coat's high collar hides: the head sits lower on the torso by
  // parts.neckSink, a share of the head's height, so less of the neck shows and the head does not look small
  if (r.parts?.neckSink && parts.head?.joints?.neck) parts.head = { ...parts.head, joints: { ...parts.head.joints, neck: [parts.head.joints.neck[0], parts.head.joints.neck[1] - r.parts.neckSink * parts.head.img.h] } };
  // her hip joint, where her legs hang from: a torso drawn to the waist, over hips of their own (briefs, a skirt),
  // ends above it, so the legs hang parts.proportions.hipDrop of her height below the torso's lowest joint
  if (prop?.hipDrop && parts.torso?.joints?.hip) { const u = BONE.torso(parts.torso) / prop.torso, [hx, hy] = parts.torso.joints.hip; parts.torso = { ...parts.torso, joints: { ...parts.torso.joints, legs: [hx, hy + prop.hipDrop * u] } }; }
  // the same joint in the hips' own pixels: briefs follow her near thigh below it (parts.coatThigh, see rig.py)
  if (parts.coat?.joints?.waist && parts.torso?.joints?.legs) {
    const [wx, wy] = parts.coat.joints.waist, [hx, hy] = parts.torso.joints.hip, [lx, ly] = parts.torso.joints.legs;
    parts.coat = { ...parts.coat, joints: { ...parts.coat.joints, legs: [wx + lx - hx, wy + ly - hy] } };
  }
  // a bare neck (parts.bareNeck): the torso's own stump of a neck goes, so the head's neck shows whole above a collar.
  // "shoulders", her shoulders bare too: the torso's top melds into the head's neck behind it, its outline sloping from
  // the neck's down to its own at the shoulders, so her neck flows into them. The sheets cut the torso flat across the
  // shoulders, which showed above them as a stiff collar of skin; a garment's own collar keeps its crisp edge
  if (r.parts?.bareNeck && r.parts.bareNeck !== 'shoulders' && parts.torso) parts.torso = fadeNeck(parts.torso);
  if (r.parts?.bareNeck === 'shoulders' && parts.torso && parts.head?.joints?.neck && parts.torso.joints?.neck) {
    const [tx, ty] = parts.torso.joints.neck, [hx, hy] = parts.head.joints.neck;
    parts.torso = softenJoint(parts.torso, 'neck', 0, { top: { img: parts.head.img, at: [Math.round(tx - hx), Math.round(ty - hy)] } });
  }
  // parts.coatCut: what hangs from the waist kept only down to this share of its height (hips in briefs, cut off
  // below the buttocks, so they do not lie over her thighs)
  if (r.parts?.coatCut && parts.coat) parts.coat = { ...parts.coat, img: crop(parts.coat.img, 0, 0, parts.coat.img.w, Math.round(parts.coat.img.h * r.parts.coatCut)) };
  // her limbs as one image each, which the rig skins on their bones (see composeLimb), unless the recipe keeps them
  // in pieces (parts.limbs: "pieces")
  const limbs = r.parts?.limbs === 'pieces' ? {} : composeLimbs(parts);
  // what bare hips fade into, at rest: the torso above them and the near leg below; and the torso into the hips
  const at = (a, aj, b, bj) => [Math.round(a.joints[aj][0] - b.joints[bj][0]), Math.round(a.joints[aj][1] - b.joints[bj][1])];
  const hung = parts.coat?.joints?.waist && parts.torso?.joints?.hip;
  // briefs over her belly (coat "over"): the small of her back runs on into their outline (see tuckBack)
  const over = (v.endsWith('-left') ? r.parts?.left?.coat ?? r.parts?.coat : r.parts?.coat) === 'over';
  if (hung && over) parts.torso = tuckBack(parts.torso, parts.coat, at(parts.torso, 'hip', parts.coat, 'waist'), Math.round(parts.torso.img.h * 0.1));
  const { torso, coat } = parts, leg = limbs.leg ?? parts.thigh;
  const onto = {
    coat: hung ? { top: { img: torso.img, at: at(coat, 'waist', torso, 'hip') }, ...(leg && coat.joints.legs ? { bottom: { img: leg.img, at: at(coat, 'legs', leg, 'hip') } } : {}) } : {},
    torso: hung ? { bottom: { img: coat.img, at: at(torso, 'hip', coat, 'waist') } } : {},
  };
  // parts.skin: pieces of bare skin, faded at their joints (see softenJoint). A limb in one image has no joint to fade
  // at the knee or the elbow: only its top, at the hip or the shoulder
  for (const name of r.parts?.skin ?? []) {
    if (limbs.leg && (name === 'thigh' || name === 'shin')) { if (name === 'thigh') limbs.leg = softenJoint(limbs.leg, 'thigh'); continue; }
    if (limbs.arm && (name === 'upperArm' || name === 'forearm')) { if (name === 'upperArm') limbs.arm = softenJoint(limbs.arm, 'upperArm'); continue; }
    // parts.coatFade: how much of the hips' height fades into the thighs (0.1 by default)
    if (parts[name]) parts[name] = softenJoint(parts[name], name, r.parts?.coatFade ?? 0.1, onto[name]);
  }
  // her head and torso as one image, skinned on both their bones (parts.limbs "pieces" keeps them apart too)
  if (r.parts?.limbs !== 'pieces' && parts.head?.joints?.neck && parts.torso?.joints?.neck) limbs.upper = composeUpper(parts.head, parts.torso);
  return limbs;
}

/**
 * A torso's stump of a neck faded out: its top rows, while they are as narrow as a neck (before the shoulders widen
 * it), go transparent over a few rows, so the head's own neck, drawn behind the torso, shows instead of a straight cut.
 */
export function fadeNeck(part) {
  const { img } = part, out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) };
  const widths = [];
  for (let y = 0; y < Math.round(img.h * 0.25); y++) { const sp = span(img, y); widths.push(sp ? sp[1] - sp[0] + 1 : 0); }
  const narrow = Math.min(...widths.filter((w) => w > 0).slice(0, Math.max(1, Math.round(widths.length * 0.3))));
  let end = 0;
  while (end < widths.length && widths[end] < narrow * 1.6) end++;
  const soft = Math.max(2, Math.round(img.h * 0.02));
  for (let y = 0; y < Math.min(img.h, end + soft); y++) {
    const k = y < end - soft ? 0 : smoothstep(end - soft, end + soft, y);
    for (let x = 0; x < img.w; x++) out.d[(y * img.w + x) * 4 + 3] *= k;
  }
  return { ...part, img: out };
}

/**
 * Her head and torso as one image at rest, the head under the torso as the rig drew them (its neck tucks under a
 * collar), so the rig skins it on the head's bone and the torso's: her neck bends as one when her head moves, as her
 * knees do, with no join where the two pieces met to slide or open. Its joints: the torso's, its `top` (the head's), and
 * where the ponytail is tied (`tie`), all in its own pixels.
 */
export function composeUpper(head, torso) {
  const ox = torso.joints.neck[0] - head.joints.neck[0], oy = torso.joints.neck[1] - head.joints.neck[1];
  const x0 = Math.floor(Math.min(0, ox)), y0 = Math.floor(Math.min(0, oy));
  const W = Math.ceil(Math.max(torso.img.w, ox + head.img.w)) - x0, H = Math.ceil(Math.max(torso.img.h, oy + head.img.h)) - y0, img = blank(W, H);
  // straight alpha, one over the other: the head first, the torso over it
  const over = (src, dx, dy) => {
    for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
      const s = (y * src.w + x) * 4, a = src.d[s + 3] / 255;
      if (!a) continue;
      const o = ((y + dy) * W + (x + dx)) * 4, b = img.d[o + 3] / 255, out = a + b * (1 - a);
      for (let c = 0; c < 3; c++) img.d[o + c] = Math.round((src.d[s + c] * a + img.d[o + c] * b * (1 - a)) / out);
      img.d[o + 3] = Math.round(out * 255);
    }
  };
  const hx = Math.round(ox - x0), hy = Math.round(oy - y0);
  over(head.img, hx, hy);
  over(torso.img, -x0, -y0);
  const joints = Object.fromEntries(Object.entries(torso.joints).map(([k, [x, y]]) => [k, [x - x0, y - y0]]));
  joints.top = [joints.neck[0], hy];
  if (head.joints.tie) joints.tie = [head.joints.tie[0] + hx, head.joints.tie[1] + hy];
  return { img, joints };
}

/** Her limbs as one image each, where she has their pieces: `leg` (thigh, lower leg, foot) and `arm` (upper arm, forearm). */
export function composeLimbs(parts) {
  const out = {};
  if (parts.thigh && parts.shin && parts.foot) out.leg = composeLimb([[parts.thigh], [parts.shin, 'knee', 'knee'], [parts.foot, 'ankle', 'ankle']]);
  if (parts.upperArm && parts.forearm) out.arm = composeLimb([[parts.upperArm], [parts.forearm, 'elbow', 'elbow']]);
  return out;
}

/** Her measures in a set of parts: the head's height and the foot's length, heel to toe, as shares of her height. */
export function measures(parts, prop) {
  if (!prop?.torso || !parts.torso) return null;
  const unit = BONE.torso(parts.torso) / prop.torso;
  return { head: parts.head ? BONE.head(parts.head) / unit : null, foot: parts.foot ? footLength(parts.foot.img) / unit : null };
}

/**
 * The neck carried on below the head, so it tucks under the collar: cut where it is narrowest under the jaw, and carried
 * straight down from there, as wide as it is there, `frac` of the head's height past the piece's own end. The sheets cut
 * the head with the base of the neck flaring into the shoulders and the chest, which the torso draws itself: where a
 * garment leaves her neck bare, that flare showed above her shoulders as a stiff flap, a collar of skin. The torso is
 * drawn over the neck, so only a neckline shows it, and no gap opens between the neck and the collar however the head
 * turns.
 */
export function extendNeck(img, frac = 0.14) {
  // the neck's narrowest row, going down from the jaw, before it widens into the shoulders: the piece's bottom is cut on
  // a slant, narrowing to a point below the shoulders, which is no neck
  let cut = -1, narrow = Infinity;
  for (let y = Math.round(img.h * 0.55); y < Math.round(img.h * 0.97); y++) {
    const sp = span(img, y);
    if (!sp) continue;
    const w = sp[1] - sp[0];
    if (w < narrow) { narrow = w; cut = y; } else if (w > narrow * 1.08 && cut > 0) break;
  }
  if (cut < 0) return img;
  const out = blank(img.w, img.h + Math.round(img.h * frac));
  out.d.set(img.d.subarray(0, (cut + 1) * img.w * 4), 0);
  const row = img.d.subarray(cut * img.w * 4, (cut + 1) * img.w * 4);
  for (let y = cut + 1; y < out.h; y++) out.d.set(row, y * img.w * 4);
  return out;
}

/** Where a row of a part is opaque: its first and last opaque x, or null. */
export function span(img, y) {
  const row = Math.max(0, Math.min(img.h - 1, Math.round(y)));
  let x0 = -1, x1 = -1;
  for (let x = 0; x < img.w; x++) if (img.d[(row * img.w + x) * 4 + 3] >= 128) { if (x0 < 0) x0 = x; x1 = x; }
  return x0 < 0 ? null : [x0, x1];
}

/**
 * The lower leg as her design has it: the trouser leg from the knee, carried on from the bottom of her thigh, tucked
 * into a boot of the design's height. An image model draws the shin part as a knee-high boot; stretched to the length
 * of her shin, its foot would come out far too big. It comes back as two parts, the shin down to the ankle and the foot
 * below it, overlapping a little so the ankle can bend, the foot knowing where its heel and toe touch the ground.
 */
export async function lowerLeg(bootImg, thigh, bootH, shinLen) {
  const boot = await resize(bootImg, Math.max(1, Math.round((bootImg.w * bootH) / bootImg.h)), Math.max(1, Math.round(bootH)));
  const top = span(boot, boot.h * 0.04) ?? [0, boot.w - 1], cx = (top[0] + top[1]) / 2;
  // the trouser around the knee, from the bottom of the thigh
  const t = thigh.img, kneeRow = span(t, t.h * 0.85) ?? [0, t.w - 1];
  const tw = Math.max(4, Math.round(Math.min(kneeRow[1] - kneeRow[0] + 1, (top[1] - top[0] + 1) * 0.92)));
  const k0 = Math.round(shinLen * 0.06), H = k0 + Math.round(shinLen), over = Math.round(bootH * 0.08);
  const tubeH = Math.max(4, H - boot.h + over), sample = { w: kneeRow[1] - kneeRow[0] + 1, h: Math.max(2, Math.round(t.h * 0.25)) };
  const piece = blank(sample.w, sample.h), y0 = Math.round(t.h * 0.7);
  for (let y = 0; y < sample.h; y++) for (let x = 0; x < sample.w; x++) {
    const sy = Math.min(t.h - 1, y0 + y), i = (sy * t.w + kneeRow[0] + x) * 4;
    piece.d.set(t.d.subarray(i, i + 4), (y * sample.w + x) * 4);
  }
  const tube = await resize(piece, tw, tubeH);
  const W = Math.max(boot.w, Math.ceil(cx + tw / 2) + 1), out = blank(W, H), tx = Math.round(cx - tw / 2);
  const over4 = (img, ox, oy) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.d[i + 3] < 128) continue; const X = ox + x, Y = oy + y; if (X >= 0 && Y >= 0 && X < W && Y < H) out.d.set(img.d.subarray(i, i + 4), (Y * W + X) * 4); } };
  over4(tube, tx, 0);
  over4(boot, 0, H - boot.h);
  return splitAnkle(out, [cx, k0], H - boot.h);
}

/**
 * A lower leg split at the ankle into the shin, knee to ankle, and the foot below, overlapping a little so the ankle
 * can bend; the foot knows where its heel and toe touch the ground. The ankle is found a little above where the shoe's
 * front starts reaching forward over the foot, below `from` (the top of the boot, or of the lower leg).
 */
export function splitAnkle(out, knee, from = 0) {
  const W = out.w, H = out.h, h = H - from, row = (y) => span(out, from + y);
  // the width of the shaft or calf at the shoe's top, the front edge's line below it, and where the toe starts
  const top = row(Math.round(h * 0.04)) ?? [0, W - 1], shaft = top[1] - top[0] + 1;
  let front = top[1];
  for (let y = Math.round(h * 0.04); y < Math.round(h * (from ? 0.4 : 0.6)); y++) { const sp = row(y); if (sp) front = Math.max(front, sp[1]); }
  let toeRow = h - 1;
  for (let y = Math.round(h * (from ? 0.4 : 0.6)); y < h; y++) { const sp = row(y); if (sp && sp[1] > front + shaft * 0.2) { toeRow = y; break; } }
  const ankleRow = Math.max(Math.round(h * (from ? 0.45 : 0.7)), toeRow - Math.round(shaft * 0.3)), at = row(ankleRow) ?? top;
  const ax = (at[0] + at[1]) / 2, ay = from + ankleRow, lap = Math.max(3, Math.round(shaft * 0.18));
  const shin = crop(out, 0, 0, W, Math.min(H, ay + lap)), foot = crop(out, 0, ay - lap, W, H - (ay - lap));
  // the sole's back and front, where the heel and the toe touch the ground
  let soleY = foot.h - 1;
  while (soleY > 0 && !span(foot, soleY)) soleY--;
  let hx = Infinity, fx = -Infinity;
  for (let y = Math.max(0, soleY - Math.round(foot.h * 0.06)); y <= soleY; y++) { const sp = span(foot, y); if (sp) { hx = Math.min(hx, sp[0]); fx = Math.max(fx, sp[1]); } }
  return {
    shin: { img: shin, joints: { knee, ankle: [ax, ay] } },
    foot: { img: foot, joints: { ankle: [ax, lap], heel: [hx, soleY], toe: [fx, soleY] } },
  };
}

/**
 * The parts posed into a standing frame and the 8-frame walk, written as frames for build to assemble: feet planted,
 * every view the same way. The stride comes from the near foot's travel while it is planted.
 */
export async function bakeParts(r, dir) {
  const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), W = 1600, H = 2000, origin = [800, 900];
  const mirror = (img) => { const out = blank(img.w, img.h); for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.d.set(img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4); return out; };
  let stride = 0, count = 0;
  const done = [], FAR = [-14, -6];
  for (const side of ['', '-left']) for (const look of ['raw', 'concierge']) {
    const v = look + side;
    if (!existsSync(join(dir, v, 'torso.png'))) continue;
    // a left-facing set is mirrored to face right, walked like the right one, and mirrored back
    const left = side === '-left', parts = {};
    for (const [name, info] of Object.entries(all[v])) {
      const img = await readRGBA(join(dir, v, `${name}.png`));
      parts[name] = left ? { img: mirror(img), joints: Object.fromEntries(Object.entries(info.joints).map(([j, [x, y]]) => [j, [img.w - 1 - x, y]])) } : { img, joints: info.joints };
    }
    await proportion(parts, proportionsFor(r, look));
    // with a foot of its own, the walk is built from where the feet go; without one, from the standard angles
    const gait = r.parts?.gait ?? {}, cycle = parts.foot ? walkCycle(parts, gait, FAR) : null;
    const foot = [parts.shin.img.w * 0.55, parts.shin.img.h * 0.97];
    if (v === 'raw') stride = cycle ? cycle.stride : 2 * (pointOf(parts, walkAngles(0, gait), 'legLower', foot, { origin })[0] - pointOf(parts, walkAngles(4, gait), 'legLower', foot, { origin })[0]);
    const write = async (anim, k, angles) => {
      const d = join(r.dir, 'anims', anim + (left ? 'Left' : ''));
      await mkdir(d, { recursive: true });
      const f = plant([posePartsRig(parts, angles, { w: W, h: H, origin, coatFront: left ? r.parts?.left?.coat === 'front' : r.parts?.coat === 'front' })])[0];
      await writePNG(join(d, `${look}-${String(k).padStart(2, '0')}.png`), left ? mirror(f) : f);
    };
    // the last bake's frames go first, so a shorter cycle leaves none behind
    for (const anim of ['idle', 'walk']) {
      const d = join(r.dir, 'anims', anim + (left ? 'Left' : ''));
      if (existsSync(d)) for (const f of await readdir(d)) if (f.startsWith(`${look}-`) && f.endsWith('.png')) await rm(join(d, f));
    }
    // standing: her stance, weight on one leg; then the walk
    await write('idle', 0, cycle ? standPose(parts, gait.idle, FAR) : gait.idle ?? {});
    const frames = cycle ? cycle.frames : Array.from({ length: 8 }, (_, k) => walkAngles(k, gait));
    for (let k = 0; k < frames.length; k++) await write('walk', k, frames[k]);
    count = frames.length;
    done.push(v);
  }
  await writeFile(join(r.dir, 'anims', 'walk', 'stride.json'), JSON.stringify({ stride }) + '\n');
  // where the hip is in every frame, both ways round: the sprite's anchor
  await writeFile(join(r.dir, 'anims', 'origin.json'), JSON.stringify({ x: origin[0] }) + '\n');
  console.log(`${r.name}: a standing frame and ${count} walk frames for ${done.join(', ')} → ${rel(join(r.dir, 'anims'))}, stride ${stride.toFixed(0)} px`);
}

/** A part image mirrored left to right, its joints with it. */
export const mirrorPart = (img, joints) => {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.d.set(img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4);
  return { img: out, joints: Object.fromEntries(Object.entries(joints).map(([j, [x, y]]) => [j, [img.w - 1 - x, y]])) };
};

/**
 * The character rigged in Blender (tools/blender/rig.py): its parts prepared as the bake prepares them (to the recipe's
 * proportions, the lower leg split into shin and foot, a set seen from the left mirrored to face right), written with
 * the walk to <recipe dir>/rig/; Blender builds one skeleton for every set, keys the walk with the coat and the arms
 * following through, saves rig/<name>.blend and renders each set's frames, which land in anims/ for build. With
 * --render-only it renders the saved .blend as it is, after the walk has been changed by hand.
 */
export async function cmdRig([file], opt) {
  const r = await loadRecipe(file), dir = join(r.dir, 'parts'), out = join(r.dir, 'rig'), tmp = join(out, 'frames'), FAR = [-14, -6], PERCENT = 50;
  if (!opt['render-only']) {
    const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), gait = r.parts?.gait ?? {}, sets = [];
    // an outfit that takes its head from another character's parts is as tall as that character, so its head stays as it is
    const sameAll = r.parts?.same ? JSON.parse(await readFile(join(resolve(ROOT, r.parts.same.from), 'parts', 'parts.json'), 'utf8')) : null;
    let walk = null, idle = null, jog = null, run = null;
    for (const side of ['', '-left']) for (const look of ['raw', 'concierge']) {
      const v = look + side;
      if (!existsSync(join(dir, v, 'torso.png'))) continue;
      const left = side === '-left', parts = {};
      for (const [name, info] of Object.entries(all[v])) {
        const img = await readRGBA(join(dir, v, `${name}.png`));
        parts[name] = left ? mirrorPart(img, info.joints) : { img, joints: info.joints };
      }
      const prop = proportionsFor(r, look), limbs = await shapeParts(r, look, v, parts, sameAll);
      if (v === 'raw') { const m = measures(parts, prop); if (m?.foot) console.log(`${r.name}: foot ${m.foot.toFixed(3)} of her height (her boots 0.13)${m.foot > 0.155 || m.foot < 0.09 ? ' — check it: set parts.proportions.foot' : ''}`); }
      if (!parts.foot) throw new Error(`${r.name}: the rig needs a separate foot: give the recipe parts.proportions`);
      await mkdir(join(out, v), { recursive: true });
      const pieces = {};
      for (const [name, p] of Object.entries({ ...parts, ...limbs })) {
        await writePNG(join(out, v, `${name}.png`), p.img);
        pieces[name] = { size: [p.img.w, p.img.h], joints: p.joints };
      }
      // a view whose chest moves as she steps (parts.bounce, 0 to 1): the rig weights the torso's chest to its own bone
      // what hangs from the waist: behind her legs, in front of them (front), or in front of her torso too (over: briefs
      // over her belly)
      const coat = left ? r.parts?.left?.coat ?? r.parts?.coat : r.parts?.coat;
      sets.push({ name: v, left, coatFront: coat === 'front' || coat === 'over', coatOver: coat === 'over', bounce: r.parts?.bounce?.[look] ?? 0, parts: pieces });
      // parts.gaits: the gaits besides standing she has in this outfit (all of walk, jog and run by default)
      const has = (g) => !r.parts?.gaits || r.parts.gaits.includes(g);
      if (v === 'raw') { walk = walkCycle(parts, gait, FAR); idle = idleCycle(parts, gait.idle, FAR, { frames: gait.idleFrames ?? 16 }); jog = has('jog') ? jogCycle(parts, r.parts?.jog ?? {}, FAR) : null; run = has('run') ? runCycle(parts, r.parts?.run ?? {}, FAR) : null; }
    }
    if (!walk) throw new Error(`${r.name}: no raw parts to rig`);
    // parts.coatSway: how much what hangs from the waist swings, 1 a coat's hem, 0 held still with her hips (trousers, briefs)
    // parts.coatThigh: how much of it follows her near thigh below her hip joint, 0 to 1 (bare hips in briefs, about 0.9)
    await writeFile(join(out, 'rig.json'), JSON.stringify({ blend: `${r.name}.blend`, percent: PERCENT, far: FAR, coatSway: r.parts?.coatSway ?? 1, coatThigh: r.parts?.coatThigh ?? 0, sets, walk, idle, jog, run }, null, 1) + '\n');
  }
  await rm(tmp, { recursive: true, force: true });
  execFileSync('blender', ['-b', '--factory-startup', '--python', resolve(ROOT, 'tools/blender/rig.py'), '--', out, tmp, ...(opt['render-only'] ? ['--render-only'] : [])], { stdio: ['ignore', 'inherit', 'inherit'] });
  // the first frames are the idle loop, then the walk, the jog and the run, each where the rig has it; a set seen from
  // the left is mirrored back
  const rig = JSON.parse(await readFile(join(out, 'rig.json'), 'utf8')), nIdle = Array.isArray(rig.idle) ? rig.idle.length : 1;
  const spans = [['idle', nIdle], ...['walk', 'jog', 'run'].filter((g) => rig[g]).map((g) => [g, rig[g].frames.length])];
  const runs = spans.map(([g]) => g);
  const which = (i) => { for (const [g, n] of spans) { if (i < n) return [g, i]; i -= n; } return [null, 0]; };
  for (const s of rig.sets) {
    const look = s.name.replace('-left', ''), sfx = s.left ? 'Left' : '';
    const files = (await readdir(join(tmp, s.name))).filter((f) => f.endsWith('.png')).sort();
    for (const anim of runs) {
      const d = join(out, 'anims', anim + sfx);
      await mkdir(d, { recursive: true });
      for (const f of await readdir(d)) if (f.startsWith(`${look}-`) && f.endsWith('.png')) await rm(join(d, f));
    }
    for (const [i, f] of files.entries()) {
      const [anim, k] = which(i);
      if (!anim) continue;
      const dst = join(out, 'anims', anim + sfx, `${look}-${String(k).padStart(2, '0')}.png`);
      await (s.left ? sharp(join(tmp, s.name, f)).flop() : sharp(join(tmp, s.name, f))).png().toFile(dst);
    }
  }
  await writeFile(join(out, 'anims', 'walk', 'stride.json'), JSON.stringify({ stride: (rig.walk.stride * PERCENT) / 100 }) + '\n');
  // the jog's and the run's strides, and how far she is off the ground in each frame, so build sets her down in the air,
  // not on a foot
  for (const g of ['jog', 'run']) if (rig[g]) await writeFile(join(out, 'anims', g, 'stride.json'), JSON.stringify({ stride: (rig[g].stride * PERCENT) / 100, air: rig[g].frames.map((f) => ((f.air ?? 0) * PERCENT) / 100) }) + '\n');
  await writeFile(join(out, 'anims', 'origin.json'), JSON.stringify({ x: (800 * PERCENT) / 100 }) + '\n');
  console.log(`${r.name}: rigged in Blender (${rel(join(out, rig.blend))}), ${spans.map(([g, n]) => `${n} ${g}`).join(', ')} frames for ${rig.sets.map((s) => s.name).join(', ')} → ${rel(join(out, 'anims'))}. Build it with: npm run asset -- build ${rel(r.file)}`);
}

/** The parts assembled and walked through the standard cycle, as an animated GIF beside the sheets, for checking. */
export async function previewParts(r, dir) {
  const views = ['raw', 'concierge'].filter((v) => existsSync(join(dir, v, 'torso.png')));
  const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), height = r.height ?? r.spec.height, rows = [];
  for (const v of views) {
    const parts = {};
    for (const [name, info] of Object.entries(all[v])) parts[name] = { img: await readRGBA(join(dir, v, `${name}.png`)), joints: info.joints };
    await proportion(parts, proportionsFor(r, v));
    const W = 1600, H = 2000, origin = [800, 900];
    const gait = r.parts?.gait ?? {}, cycle = parts.foot ? walkCycle(parts, gait) : null;
    const poses = cycle ? [standPose(parts, gait.idle), ...cycle.frames] : [gait.idle ?? {}, ...Array.from({ length: 8 }, (_, k) => walkAngles(k, gait))];
    const frames = poses.map((a) => posePartsRig(parts, a, { w: W, h: H, origin }));
    // feet on one ground line, one crop for all frames, shrunk to game size
    const planted = frames.map((f) => plant([f])[0]), box = planted.map((f) => contentBox(f)).reduce(unionBox);
    rows.push(await Promise.all(planted.map(async (f) => hardenAlpha(await fitToHeight(f, box, height)))));
  }
  const hexes = await palette(), px = { ...r.spec.pixel, ...(r.pixel ?? {}) }, S = 2;
  const pngs = [];
  for (let k = 1; k < rows[0].length; k++) {
    const tiles = await Promise.all(rows.map(async (fs) => {
      const f = paletteFit({ ...fs[k], d: new Uint8ClampedArray(fs[k].d) }, hexes, r.palette ?? 0.35);
      pixelate(f, { colors: px.colors ?? 32, centres: fs.centres ??= fitColours(paletteFit({ ...fs[0], d: new Uint8ClampedArray(fs[0].d) }, hexes, r.palette ?? 0.35), px.colors ?? 32) });
      return sharp(Buffer.from(f.d.buffer, f.d.byteOffset, f.d.length), { raw: { width: f.w, height: f.h, channels: 4 } }).resize(f.w * S, f.h * S, { kernel: 'nearest' }).png().toBuffer();
    }));
    const tw = rows[0][k].w * S, th = rows[0][k].h * S;
    pngs.push(await sharp({ create: { width: (tw + 20) * tiles.length, height: th, channels: 4, background: '#26262e' } }).composite(tiles.map((t, i) => ({ input: t, left: i * (tw + 20), top: 0 }))).png().toBuffer());
  }
  const out = join(dir, 'walk-preview.gif');
  await sharp(pngs, { join: { animated: true } }).gif({ delay: Array(pngs.length).fill(150), loop: 0 }).toFile(out);
  console.log(`${r.name}: walk preview → ${rel(out)}`);
}
