// Close-ups: a moment shown up close over the dimmed scene (her wrist in the station's cuff), as each view has it. The
// Concierge's view is drawn first, from the descriptions in art/closeups/closeups.json and their references; raw view is
// then edited from the picked picture, so the two line up exactly. Picked, both go into the game as
// public/assets/closeups/<id>.concierge.webp and .raw.webp, which the story's `# closeup: <id>` shows.
//
//   npm run asset -- closeups --only station [--n 2] [--quality medium] [--dry]
//   npm run asset -- closeups --pick station=1          the Concierge's picture; draws raw view's candidates from it
//   npm run asset -- closeups --pick-raw station=1      raw view's picture; both into the game

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadReferences } from './images.mjs';
import { edit } from './backend.mjs';
import { ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';
import { LOOKS } from './style.mjs';

const SPEC = join(ROOT, 'art/closeups/closeups.json'), OUT = join(ROOT, 'public/assets/closeups'), SIZE = '1536x1024';
const NOTE = 'A close-up for a cinematic 2D adventure game, a single moment seen up close. The attached images are references: the design of what is shown, and the style to match. No text, no letters, no frame, no border.';
const RAW_NOTE = 'Edit the first attached image into the raw, real view of the same moment: keep the composition, the framing and every outline where it is, aligned exactly; change only surfaces, materials, light and colour as described. The other attached images show how these things really look.';

async function candidates(dir, prefix, images) {
  await mkdir(dir, { recursive: true });
  const have = (await readdir(dir)).filter((f) => f.startsWith(prefix)).map((f) => Number(f.slice(prefix.length + 1, -4))).filter(Number.isFinite);
  let next = Math.max(0, ...have) + 1;
  for (const img of images) { const f = join(dir, `${prefix}-${next++}.png`); await writeFile(f, img); console.log(`  ${rel(f)}`); }
}

export async function cmdCloseups(_args, opt) {
  const spec = JSON.parse(await readFile(SPEC, 'utf8')), n = Number(opt.n ?? 2), quality = opt.quality ?? 'medium';
  const refs = (list) => (list ?? []).map((f) => join(ROOT, f));
  if (typeof opt.pick === 'string' || typeof opt['pick-raw'] === 'string') {
    const raw = typeof opt['pick-raw'] === 'string', [id, k] = (raw ? opt['pick-raw'] : opt.pick).split('='), c = spec[id];
    if (!c) throw new Error(`art/closeups/closeups.json has no ${id}`);
    const dir = join(ROOT, 'art/closeups', id), from = join(dir, 'candidates', `${raw ? 'raw' : 'concierge'}-${k}.png`);
    if (!existsSync(from)) throw new Error(`no candidate ${rel(from)}`);
    await copyFile(from, join(dir, `${raw ? 'raw' : 'concierge'}.png`));
    if (!raw) {
      // raw view, edited from the Concierge's picture
      const text = `${RAW_NOTE} ${c.raw} ${LOOKS.vector}`;
      console.log(`${id}: ${n} raw-view candidates from ${rel(from)}`);
      if (opt.dry) return console.log(`\n${text}`);
      const res = await edit({ prompt: text, images: [from, ...(await loadReferences(refs(c.rawReferences)))], size: SIZE, quality, n, background: 'opaque' });
      await candidates(join(dir, 'candidates'), 'raw', res.images);
      return console.log(`  $${res.cost?.toFixed(3)}; pick one with: npm run asset -- closeups --pick-raw ${id}=<n>`);
    }
    // both into the game, at the size it shows them
    await mkdir(OUT, { recursive: true });
    for (const v of ['concierge', 'raw']) {
      const src = join(dir, `${v}.png`);
      if (!existsSync(src)) throw new Error(`${id} has no ${v} picture yet`);
      const out = join(OUT, `${id}.${v}.webp`);
      await sharp(src).resize(1200, 800, { fit: 'cover' }).webp({ quality: 86 }).toFile(out);
      console.log(`${rel(out)}`);
    }
    return;
  }
  const ids = typeof opt.only === 'string' ? opt.only.split(',') : Object.keys(spec);
  for (const id of ids) {
    const c = spec[id];
    if (!c) throw new Error(`art/closeups/closeups.json has no ${id}`);
    const text = `${NOTE} ${c.concierge} ${LOOKS.vector}`;
    console.log(`${id}: ${n} × ${SIZE}, ${quality} quality, the Concierge's view`);
    if (opt.dry) { console.log(`\n${text}\n`); continue; }
    const res = await edit({ prompt: text, images: await loadReferences(refs(c.references)), size: SIZE, quality, n, background: 'opaque' });
    await candidates(join(ROOT, 'art/closeups', id, 'candidates'), 'concierge', res.images);
    console.log(`  $${res.cost?.toFixed(3)}; pick one with: npm run asset -- closeups --pick ${id}=<n>`);
  }
}
