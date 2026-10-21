// Her things, painted for the tray: each real thing she can carry painted on its own in the game's look, as it really
// is, with a picture of the game as the style to match. What exists only in the Concierge's eye (credits) is its own
// graphic, not painted. The descriptions are in art/items/items.json; candidates go to art/items/<id>/candidates/, and
// picking one cuts it out, square, into public/assets/items/<id>.webp, which items.json then names as the thing's art.
//
//   npm run asset -- items [--only parcel,valve] [--n 2] [--quality medium] [--dry]
//   npm run asset -- items --pick parcel=2,valve=1

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { contentBox, isOpaque, removeFlatBackground } from './clean.mjs';
import { readRGBA } from './image.mjs';
import { edit, generate } from './openai.mjs';
import { loadReferences } from './images.mjs';
import { ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';
import { LOOKS, REFERENCE_NOTE_VECTOR } from './style.mjs';

const SPEC = join(ROOT, 'art/items/items.json'), GAME = join(ROOT, 'public/assets/items.json'), OUT = join(ROOT, 'public/assets/items');
/** How big a thing's picture is in the game: the tray shows it at about 60 pixels, close up at 112, on screens twice as dense. */
const SIZE = 256;

const prompt = (what) => [
  `One object for the inventory of a cinematic 2D adventure game: ${what}.`,
  'Shown on its own, whole and centred, seen from a little above at a three-quarter angle, filling most of the square frame,',
  'on a fully transparent background: no shadow under it, no surface, no frame, no text, no other objects.',
  LOOKS.vector,
  'Lit softly from the upper left. It is the real thing, a little worn and used, in a city where everything new is a projection.',
].join(' ');

async function paint(spec, ids, opt) {
  const n = Number(opt.n ?? 2), quality = opt.quality ?? 'medium', refs = (spec.references ?? []).map((f) => join(ROOT, f));
  for (const f of refs) if (!existsSync(f)) throw new Error(`no image at ${rel(f)}`);
  for (const id of ids) {
    const what = spec.things[id];
    if (!what) throw new Error(`art/items/items.json does not describe ${id}`);
    const text = `${refs.length ? `${REFERENCE_NOTE_VECTOR} ` : ''}${prompt(what)}`;
    console.log(`${id}: ${n} × 1024x1024, ${quality} quality${refs.length ? `, ${refs.length} style reference${refs.length > 1 ? 's' : ''}` : ''}`);
    if (opt.dry) { console.log(`\n${text}\n`); continue; }
    const res = refs.length
      ? await edit({ prompt: text, images: await loadReferences(refs), size: '1024x1024', quality, n, background: 'transparent' })
      : await generate({ prompt: text, size: '1024x1024', quality, n, background: 'transparent' });
    const dir = join(ROOT, 'art/items', id, 'candidates');
    await mkdir(dir, { recursive: true });
    const have = (await readdir(dir)).filter((f) => /^\d+\.png$/.test(f)).map((f) => Number(f.slice(0, -4)));
    let next = Math.max(0, ...have) + 1;
    for (const img of res.images) {
      const file = join(dir, `${next++}.png`);
      await writeFile(file, img);
      console.log(`  ${rel(file)}`);
    }
    if (res.cost != null) console.log(`  $${res.cost.toFixed(3)}`);
  }
}

/** A candidate, cut out square with a little room around it, into the game; items.json names it as the thing's art. */
async function pick(choices) {
  const game = JSON.parse(await readFile(GAME, 'utf8'));
  await mkdir(OUT, { recursive: true });
  for (const [id, n] of choices) {
    const src = join(ROOT, 'art/items', id, 'candidates', `${n}.png`);
    if (!existsSync(src)) throw new Error(`no candidate ${rel(src)}`);
    if (!game[id]) throw new Error(`items.json has no ${id}`);
    const img = await readRGBA(src);
    if (isOpaque(img)) removeFlatBackground(img);
    const box = contentBox(img, 0, 24), side = Math.round(Math.max(box.w, box.h) * 1.08);
    const cut = await sharp(Buffer.from(img.d.buffer, img.d.byteOffset, img.d.length), { raw: { width: img.w, height: img.h, channels: 4 } })
      .extract({ left: box.x, top: box.y, width: box.w, height: box.h })
      .extend({ top: Math.floor((side - box.h) / 2), bottom: Math.ceil((side - box.h) / 2), left: Math.floor((side - box.w) / 2), right: Math.ceil((side - box.w) / 2), background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(SIZE, SIZE, { kernel: 'lanczos3' })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    const out = join(OUT, `${id}.webp`);
    await writeFile(out, cut);
    game[id].art = `items/${id}.webp`;
    console.log(`${id}: ${rel(src)} → ${rel(out)} (${(cut.length / 1024).toFixed(1)} KB)`);
  }
  await writeFile(GAME, JSON.stringify(game, null, 1) + '\n');
}

export async function cmdItems(_args, opt) {
  if (typeof opt.pick === 'string') return pick(opt.pick.split(',').map((c) => { const [id, n] = c.split('='); return [id.trim(), Number(n)]; }));
  const spec = JSON.parse(await readFile(SPEC, 'utf8'));
  const ids = typeof opt.only === 'string' ? opt.only.split(',').map((s) => s.trim()) : Object.keys(spec.things);
  await paint(spec, ids, opt);
}
