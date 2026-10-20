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
  const extra = r.parts?.extra ?? [], partsPrompt = partsPromptFor(extra);
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
  // a mirrored left sheet has every part on the other side of the sheet
  const at = r.parts?.at && left && r.parts?.left?.mirror ? Object.fromEntries(Object.entries(r.parts.at).map(([n, [x, y]]) => [n, [SHEET.w - x, y]])) : r.parts?.at ?? null;
  const parts = cutParts(await readRGBA(sheetFile), at, r.parts?.joints ?? {}, left);
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
  const missing = [...Object.keys(PARTS_NAMES), ...extra.filter((n) => EXTRA_PARTS[n])].filter((n) => !parts[n]);
  console.log(`${r.name}: ${Object.keys(parts).length} parts → ${rel(join(dir, view))}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`);
  console.log(res.cost == null ? 'Cost: not reported by the API.' : `Cost: $${res.cost.toFixed(4)}`);
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
  for (const [name, p] of Object.entries(parts)) {
    if (!prop[name] || !BONE[name] || (name === 'shin' && prop.boot) || !p.joints) continue;
    const s = (prop[name] * unit) / BONE[name](p);
    if (Math.abs(s - 1) < 0.01) continue;
    const w = Math.max(1, Math.round(p.img.w * s)), h = Math.max(1, Math.round(p.img.h * s));
    parts[name] = { img: await resize(p.img, w, h), joints: Object.fromEntries(Object.entries(p.joints).map(([j, [x, y]]) => [j, [(x * w) / p.img.w, (y * h) / p.img.h]])) };
  }
  if (prop.boot && prop.shin && parts.shin && parts.thigh) Object.assign(parts, await lowerLeg(parts.shin.img, parts.thigh, prop.boot * unit, prop.shin * unit));
  // a lower leg drawn whole, the leg into its shoe, is split at the ankle so the foot can roll
  else if (parts.shin && !parts.foot) Object.assign(parts, splitAnkle(parts.shin.img, parts.shin.joints.knee));
  if (parts.head) parts.head = { ...parts.head, img: extendNeck(parts.head.img) };
  return parts;
}

/**
 * The neck carried on below the head's cut, so it tucks under the collar: every column whose lowest pixel is in the
 * bottom of the piece (the neck, not hair hanging higher up) continues downward. The torso is drawn over it, so only the
 * neckline shows it, and no gap opens between the neck and the collar however the head turns.
 */
export function extendNeck(img, frac = 0.14) {
  const extra = Math.round(img.h * frac), out = blank(img.w, img.h + extra);
  out.d.set(img.d, 0);
  for (let x = 0; x < img.w; x++) {
    let low = -1;
    for (let y = img.h - 1; y >= 0; y--) if (img.d[(y * img.w + x) * 4 + 3] >= 128) { low = y; break; }
    if (low < img.h * 0.86) continue;
    const src = img.d.subarray((Math.max(0, low - 2) * img.w + x) * 4, (Math.max(0, low - 2) * img.w + x) * 4 + 4);
    for (let y = low + 1; y < img.h + extra; y++) out.d.set(src, (y * img.w + x) * 4);
  }
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
      const prop = proportionsFor(r, look), them = sameAll?.[v]?.torso;
      await proportion(parts, prop, them && prop?.torso ? BONE.torso(them) / prop.torso : undefined);
      if (!parts.foot) throw new Error(`${r.name}: the rig needs a separate foot: give the recipe parts.proportions`);
      await mkdir(join(out, v), { recursive: true });
      const pieces = {};
      for (const [name, p] of Object.entries(parts)) {
        await writePNG(join(out, v, `${name}.png`), p.img);
        pieces[name] = { size: [p.img.w, p.img.h], joints: p.joints };
      }
      // a view whose chest moves as she steps (parts.bounce, 0 to 1): the rig weights the torso's chest to its own bone
      sets.push({ name: v, left, coatFront: left ? r.parts?.left?.coat === 'front' : r.parts?.coat === 'front', bounce: r.parts?.bounce?.[look] ?? 0, parts: pieces });
      // parts.gaits: the gaits besides standing she has in this outfit (all of walk, jog and run by default)
      const has = (g) => !r.parts?.gaits || r.parts.gaits.includes(g);
      if (v === 'raw') { walk = walkCycle(parts, gait, FAR); idle = idleCycle(parts, gait.idle, FAR, { frames: gait.idleFrames ?? 16 }); jog = has('jog') ? jogCycle(parts, r.parts?.jog ?? {}, FAR) : null; run = has('run') ? runCycle(parts, r.parts?.run ?? {}, FAR) : null; }
    }
    if (!walk) throw new Error(`${r.name}: no raw parts to rig`);
    await writeFile(join(out, 'rig.json'), JSON.stringify({ blend: `${r.name}.blend`, percent: PERCENT, far: FAR, sets, walk, idle, jog, run }, null, 1) + '\n');
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
