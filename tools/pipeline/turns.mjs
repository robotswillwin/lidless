// Her front and back: a character seen from the side as she walks, turned to us and away from us, each one picture in
// both views (a recipe of its own, drawn from her profile), set into her frames as she stands in them: each view's
// picture at her height in that view's standing frame, her soles on its ground, her middle on its hip. The recipe
// names them, a turn as the folder of its pictures, or with what is done to them first:
//
//   "turns": { "front": "art/cast/hero-front", "back": "art/cast/hero-back" }
//   "turns": { "front": { "from": "art/cast/hero-underwear-front", "fabric": { "raw": [dark, mid, light], ... } } }
//   "turns": { "front": { "from": "art/cast/hero-underwear-front", "censor": true } }
//
// "fabric" colours the pictures' black underwear as the outfit's own is coloured (white in raw view, red in the
// Concierge's), its shading kept; "censor" turns it to skin under a censor's mosaic (censor.mjs), never drawn. Where a
// turn's folder has her left eye shut too (<view>-shut.png, touched from <view>.png), it lands in blink<Turn>/ the same
// way: her blink as she faces us.
//
//   npm run asset -- turns <character recipe>      then build it; rig runs it after rendering
//
// Free: no image model. The frames land in front/ and back/ beside idle/, for build.

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { framesDir } from './build.mjs';
import { censorFront, underwearOf } from './censor.mjs';
import { readRGBA, writePNG } from './image.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';

/** The box around a picture's pixels that are more than half opaque. */
function contentOf(img) {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.d[(y * img.w + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1 + 1, y1 + 1];
}

const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
const mix = (a, b, t) => a.map((v, c) => Math.round(v + (b[c] - v) * t));

/** The black underwear in `img` coloured from `dark` through `mid` to `light`, as its shading goes from deep to lit. */
function colourFabric(img, [dark, mid, light]) {
  const { all } = underwearOf(img.d, img.w, img.h);
  for (let p = 0; p < img.w * img.h; p++) {
    if (!all[p]) continue;
    const L = lum(img.d, p * 4), col = L < 43 ? mix(dark, mid, Math.max(0, (L - 32) / 11)) : mix(mid, light, Math.min(1, (L - 43) / 25));
    img.d.set(col, p * 4);
  }
}

/** A picture of her turned, scaled and placed as her standing frame has her, into a frame of its own. */
async function setInFrame(pic, { left, down, k, top, ground, frame }, file) {
  const W = Math.round(pic.w * k), H = Math.round(pic.h * k);
  const scaled = await sharp(Buffer.from(pic.d.buffer, pic.d.byteOffset, pic.d.byteLength), { raw: { width: pic.w, height: pic.h, channels: 4 } }).resize(W, H, { kernel: 'lanczos3' }).png().toBuffer();
  // only what falls inside the frame
  const cx0 = Math.max(0, -left), cy0 = Math.max(0, -down), cx1 = Math.min(W, frame.w - left), cy1 = Math.min(H, frame.h - down);
  const piece = await sharp(scaled).extract({ left: cx0, top: cy0, width: cx1 - cx0, height: cy1 - cy0 }).png().toBuffer();
  const { data } = await sharp({ create: { width: frame.w, height: frame.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: piece, left: left + cx0, top: down + cy0 }]).raw().toBuffer({ resolveWithObject: true });
  // nothing past her standing frame's height, so the frames all fit in the box they had and none changes size
  for (let y = 0; y < frame.h; y++) if (y < top || y >= ground) data.fill(0, y * frame.w * 4, (y + 1) * frame.w * 4);
  await writePNG(file, { w: frame.w, h: frame.h, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength) });
}

export async function cmdTurns(files) {
  if (!files.length) throw new Error('usage: turns <character recipe> [more...]');
  for (const file of files) await turnsOne(await loadRecipe(file));
}

/** The recipe's turns, each view's picture scaled and placed as that view's standing frame has her, into <turn>/<view>-00.png. */
export async function turnsOne(r) {
  const dir = framesDir(r);
  if (!r.turns) throw new Error(`${r.name}: no "turns" in ${rel(r.file)}`);
  const hip = existsSync(join(dir, 'origin.json')) ? JSON.parse(await readFile(join(dir, 'origin.json'), 'utf8')).x : null;
  for (const [turn, spec] of Object.entries(r.turns)) {
    const t = typeof spec === 'string' ? { from: spec } : spec, src = resolve(ROOT, t.from), out = join(dir, turn), said = [];
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    // her blink, where the turn has it: her left eye shut, set the same way
    const blinks = ['raw', 'concierge'].every((v) => existsSync(join(src, `${v}-shut.png`))), blinkOut = join(dir, `blink${turn[0].toUpperCase()}${turn.slice(1)}`);
    await rm(blinkOut, { recursive: true, force: true });
    if (blinks) await mkdir(blinkOut, { recursive: true });
    for (const view of ['raw', 'concierge']) {
      const stand = join(dir, 'idle', `${view}-00.png`), f = join(src, `${view}.png`);
      if (!existsSync(stand)) throw new Error(`${r.name}: no standing frame at ${rel(stand)} to set her turns by`);
      if (!existsSync(f)) throw new Error(`${r.name}: no ${view} picture of her ${turn} at ${rel(f)}`);
      const frame = await readRGBA(stand), [, top, , ground] = contentOf(frame), mid = hip ?? frame.w / 2;
      const pic = await readRGBA(f), [px0, py0, px1, py1] = contentOf(pic), k = (ground - top) / (py1 - py0);
      const place = { left: Math.round(mid - ((px0 + px1) / 2) * k), down: Math.round(ground - py1 * k), k, top, ground, frame };
      if (t.censor) said.push(`${view} censored at ${censorFront(pic.d, pic.w, pic.h).map((p) => p.map(Math.round).join(',')).join(' ')}`);
      if (t.fabric?.[view]) colourFabric(pic, t.fabric[view]);
      await setInFrame(pic, place, join(out, `${view}-00.png`));
      if (blinks) {
        const shut = await readRGBA(join(src, `${view}-shut.png`));
        if (t.censor) censorFront(shut.d, shut.w, shut.h);
        if (t.fabric?.[view]) colourFabric(shut, t.fabric[view]);
        await setInFrame(shut, place, join(blinkOut, `${view}-00.png`));
      }
      said.push(`${view} ${(k * 100).toFixed(1)}% to ${ground - top} px`);
    }
    console.log(`${r.name}: her ${turn}${blinks ? ' and its blink' : ''} from ${rel(src)} (${said.join('; ')}) → ${rel(out)}`);
  }
}
