// Her front and back: a character seen from the side as she walks, turned to us and away from us, each one picture in
// both views (a recipe of its own, drawn from her profile), set into her frames as she stands in them: her height in
// her standing frame, her soles on its ground, her middle on its hip. The recipe names them:
//
//   "turns": { "front": "art/cast/hero-front", "back": "art/cast/hero-back" }
//
//   npm run asset -- turns <character recipe>      then build it; rig runs it after rendering
//
// Free: no image model. The frames land in front/ and back/ beside idle/, for build.

import { existsSync } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { framesDir } from './build.mjs';
import { readRGBA } from './image.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';

/** What of a picture is there: the box around its pixels that are more than half opaque. */
async function contentOf(file) {
  const img = await readRGBA(file);
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.d[(y * img.w + x) * 4 + 3] > 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { w: img.w, h: img.h, box: [x0, y0, x1 + 1, y1 + 1] };
}

export async function cmdTurns(files) {
  if (!files.length) throw new Error('usage: turns <character recipe> [more...]');
  for (const file of files) await turnsOne(await loadRecipe(file));
}

/** The recipe's turns, each picture scaled and placed as her standing frame has her, into <turn>/<view>-00.png. */
export async function turnsOne(r) {
  const dir = framesDir(r), stand = join(dir, 'idle', 'raw-00.png');
  if (!r.turns) throw new Error(`${r.name}: no "turns" in ${rel(r.file)}`);
  if (!existsSync(stand)) throw new Error(`${r.name}: no standing frame at ${rel(stand)} to set her turns by`);
  const frame = await contentOf(stand), [, top, , ground] = frame.box;
  const hip = existsSync(join(dir, 'origin.json')) ? JSON.parse(await readFile(join(dir, 'origin.json'), 'utf8')).x : frame.w / 2;
  for (const [turn, from] of Object.entries(r.turns)) {
    const src = resolve(ROOT, from), out = join(dir, turn);
    // raw view sets the size and the place, and the Concierge's, drawn over it, goes where it goes
    const pic = await contentOf(join(src, 'raw.png')), [px0, py0, px1, py1] = pic.box, k = (ground - top) / (py1 - py0);
    const left = Math.round(hip - ((px0 + px1) / 2) * k), down = Math.round(ground - py1 * k), W = Math.round(pic.w * k), H = Math.round(pic.h * k);
    await rm(out, { recursive: true, force: true });
    await mkdir(out, { recursive: true });
    for (const view of ['raw', 'concierge']) {
      const f = join(src, `${view}.png`);
      if (!existsSync(f)) throw new Error(`${r.name}: no ${view} picture of her ${turn} at ${rel(f)}`);
      const scaled = await sharp(f).resize(W, H, { kernel: 'lanczos3' }).png().toBuffer();
      // only what falls inside the frame
      const cx0 = Math.max(0, -left), cy0 = Math.max(0, -down), cx1 = Math.min(W, frame.w - left), cy1 = Math.min(H, frame.h - down);
      const piece = await sharp(scaled).extract({ left: cx0, top: cy0, width: cx1 - cx0, height: cy1 - cy0 }).png().toBuffer();
      await sharp({ create: { width: frame.w, height: frame.h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: piece, left: left + cx0, top: down + cy0 }]).png().toFile(join(out, `${view}-00.png`));
    }
    console.log(`${r.name}: her ${turn} from ${rel(src)}, ${(k * 100).toFixed(1)}% to her height (${ground - top} px), on her hip at ${hip} → ${rel(out)}`);
  }
}
