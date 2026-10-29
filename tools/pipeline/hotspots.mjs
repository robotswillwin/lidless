// A review picture of a scene's hotspots: its layers composited as the game places them (the camera at the left end),
// every hotspot's rect drawn over them with its id and its name in that view. One picture per view, for checking tap
// targets against the art without opening the editor. Writes art/review/<scene>.<view>.png.
//
//   npm run asset -- hotspots <scene> [--view raw|concierge|both] [--scale 1] [--all]   (--all: layers with a `when` too)

import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './recipe.mjs';
import { rel } from './shared.mjs';

const text = (v, view) => (typeof v === 'string' ? v : v ? (v[view] ?? v.concierge ?? v.raw ?? '') : '');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export async function cmdHotspots([scene], opt) {
  if (!scene) throw new Error('usage: hotspots <scene> [--view raw|concierge|both] [--scale 1]');
  const file = join(ROOT, 'public/assets/scenes', scene, 'scene.json');
  if (!existsSync(file)) throw new Error(`no scene at ${rel(file)}`);
  const f = JSON.parse(await readFile(file, 'utf8'));
  const [W, H] = f.size, scale = Number(opt.scale ?? 1), views = opt.view === 'both' || !opt.view ? ['raw', 'concierge'] : [opt.view];
  const outDir = join(ROOT, 'art/review');
  await mkdir(outDir, { recursive: true });
  for (const view of views) {
    const layers = [];
    for (const l of f.layers ?? []) {
      if (l.only && l.only !== view) continue;
      if (l.when && !opt.all) continue; // shown only while the story says so: left out unless --all, or they stack up
      const dir = join(ROOT, 'public/assets', l.asset), map = join(dir, `albedo.${view}.png`);
      if (!existsSync(map) || !existsSync(join(dir, 'sprite.json'))) continue;
      const sp = JSON.parse(await readFile(join(dir, 'sprite.json'), 'utf8'));
      const x = Math.round((l.x ?? sp.x) * scale), y = Math.round((l.y ?? sp.y) * scale), w = Math.round(sp.w * scale), h = Math.round(sp.h * scale);
      // only the part inside the picture: a layer may start left of it or run past its edge
      const sx = Math.max(0, -x), sy = Math.max(0, -y), vw = Math.min(w - sx, Math.round(W * scale) - Math.max(0, x)), vh = Math.min(h - sy, Math.round(H * scale) - Math.max(0, y));
      if (vw <= 0 || vh <= 0) continue;
      const img = await sharp(map).resize(w, h, { fit: 'fill' }).extract({ left: sx, top: sy, width: vw, height: vh }).png().toBuffer();
      layers.push({ input: img, left: Math.max(0, x), top: Math.max(0, y) });
    }
    const boxes = (f.hotspots ?? []).filter((h) => !h.only || h.only === view).map((h) => {
      const [x, y, w, hh] = h.rect.map((v) => v * scale), name = text(h.name, view);
      return `<rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="rgba(0,255,120,.08)" stroke="#2cff80" stroke-width="2"/>` +
        `<text x="${x + 4}" y="${y + 14}" font-family="Helvetica, Arial" font-size="${12 * scale}" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke">${esc(h.id)}${name ? ` · ${esc(name)}` : ''}</text>`;
    });
    const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}">${boxes.join('')}</svg>`);
    const out = join(outDir, `${scene}.${view}.png`);
    await sharp({ create: { width: Math.round(W * scale), height: Math.round(H * scale), channels: 4, background: '#101216' } })
      .composite([...layers, { input: svg, left: 0, top: 0 }]).png().toFile(out);
    console.log(`${rel(out)}: ${boxes.length} hotspots over ${layers.length} layers`);
  }
}
