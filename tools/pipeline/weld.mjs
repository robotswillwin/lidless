// A welder's frames for a machine: its idle loop, a weld drawn at the tip of its tool frame by frame over its picked
// pictures. The arc ignites, flashes, flickers and goes out; sparks spray back from the work and fall, cooling to embers.
// The same physical weld in both views: blue-white with pale sparks in the Concierge's view, white with orange sparks in
// raw view. Drawn solid (the build cuts soft edges), small and bright: the engine's bloom makes the halo, and a light with
// a pulse in step with the frames (printed at the end) lights the wall.
//   node tools/pipeline/weld.mjs <recipe> --tip x,y [--away -1|1] [--fps 12]
// --tip: the tool's tip in the picked pictures' pixels; --away: which way the sparks fly back (-1 left, the default).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { loadRecipe } from './recipe.mjs';

/** A seeded random number generator, so a frame gets the same sparks every time. */
function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const LOOKS = {
  concierge: { core: [255, 255, 255], rim: [90, 225, 255], hot: [236, 252, 255], cool: [110, 205, 255] },
  raw: { core: [255, 255, 240], rim: [255, 196, 96], hot: [255, 238, 176], cool: [255, 132, 36] },
};

/** Each frame: the arc's radius (0 for none), and the sparks: how long after they flew, how many, how bright. */
const FRAMES = [
  null,
  { arc: 26, t: 0.05, n: 8, bright: 1, seed: 11 },
  { arc: 50, t: 0.1, n: 22, bright: 1, seed: 23 },
  { arc: 44, t: 0.18, n: 24, bright: 1, seed: 37 },
  { arc: 36, t: 0.26, n: 22, bright: 0.95, seed: 41 },
  { arc: 0, t: 0.36, n: 16, bright: 0.8, seed: 53 },
  { arc: 0, t: 0.48, n: 10, bright: 0.6, seed: 67 },
];
/** How strongly the weld lights the wall in each frame: the light's pulse. */
const LIGHT = [0, 0.45, 1, 0.9, 0.7, 0.12, 0.04];
/** Two bursts and the pauses between them. */
const SEQ = [...Array(14).fill(0), 1, 2, 3, 4, 2, 3, 4, 3, 2, 4, 3, 5, 6, ...Array(10).fill(0), 1, 2, 4, 3, 2, 3, 4, 2, 5, 6, ...Array(6).fill(0)];

/** Paints a solid disc or a thick segment into the picture, every pixel sampled 3 by 3 so its edge is smooth. */
function paint(d, w, h, inside, [x0, y0, x1, y1], colourAt) {
  for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(h - 1, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(w - 1, Math.ceil(x1)); x++) {
    let cover = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) if (inside(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3)) cover++;
    if (!cover) continue;
    const f = cover / 9, i = (y * w + x) * 4, c = colourAt(x + 0.5, y + 0.5), a = d[i + 3] / 255, out = a * (1 - f) + f;
    for (let k = 0; k < 3; k++) d[i + k] = Math.round((d[i + k] * a * (1 - f) + c[k] * f) / Math.max(1e-6, out));
    d[i + 3] = Math.round(255 * out);
  }
}

const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);

function weld(d, w, h, [tx, ty], away, look, f) {
  const L = LOOKS[look], g = 2600;
  const rand = rng(f.seed);
  for (let k = 0; k < f.n; k++) {
    // back from the work and down, a few up; each its own speed and its own start within the frame's moment
    const a = (100 + rand() * 120) * (Math.PI / 180), speed = 380 + rand() * 520, t = f.t * (0.55 + rand() * 0.6);
    const vx = Math.cos(a) * speed * (away < 0 ? 1 : -1), vy = Math.sin(a) * speed * -0.35 + 120 + rand() * 260;
    const at = (s) => [tx + vx * s, ty + vy * s + 0.5 * g * s * s];
    const [x1, y1] = at(t), [x0, y0] = at(Math.max(0, t - 0.08)), width = 13 + rand() * 5;
    const cool = Math.min(1, t / 0.45), hot = mix(L.hot, L.cool, cool).map((c) => c * f.bright + 40 * (1 - f.bright));
    const len = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / len, uy = (y1 - y0) / len;
    const inside = (px, py) => { const q = (px - x0) * ux + (py - y0) * uy; if (q < 0 || q > len) return false; return Math.abs((px - x0) * -uy + (py - y0) * ux) <= width / 2; };
    paint(d, w, h, inside, [Math.min(x0, x1) - width, Math.min(y0, y1) - width, Math.max(x0, x1) + width, Math.max(y0, y1) + width],
      (px, py) => mix(L.cool.map((c) => c * f.bright), hot, Math.min(1, ((px - x0) * ux + (py - y0) * uy) / len)));
  }
  if (f.arc) {
    const R = f.arc;
    paint(d, w, h, (px, py) => Math.hypot(px - tx, py - ty) <= R, [tx - R, ty - R, tx + R, ty + R],
      (px, py) => mix(L.core, L.rim, Math.max(0, (Math.hypot(px - tx, py - ty) - R * 0.55) / (R * 0.45))));
  }
}

const args = process.argv.slice(2), opt = {}, pos = [];
for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) { opt[args[i].slice(2)] = args[i + 1]; i++; } else pos.push(args[i]);
if (!pos[0] || typeof opt.tip !== 'string') throw new Error('usage: node tools/pipeline/weld.mjs <recipe> --tip x,y [--away -1|1] [--fps 12]');
const r = await loadRecipe(pos[0]), tip = opt.tip.split(',').map(Number), away = Number(opt.away ?? -1), fps = Number(opt.fps ?? 12);
const dir = join(r.dir, 'anims', 'idle');
await mkdir(dir, { recursive: true });
for (const view of ['concierge', 'raw']) {
  const { data, info } = await sharp(join(r.dir, `${view}.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let k = 0; k < FRAMES.length; k++) {
    const d = Buffer.from(data);
    if (FRAMES[k]) weld(d, info.width, info.height, tip, away, view, FRAMES[k]);
    await sharp(d, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(join(dir, `${view}-${String(k).padStart(2, '0')}.png`));
  }
}
await writeFile(join(dir, 'weld.json'), JSON.stringify({ fps, seq: SEQ, light: SEQ.map((k) => LIGHT[k]) }) + '\n');
console.log(`${r.name}: ${FRAMES.length} frames into ${dir}`);
console.log(`its recipe's anims: ${JSON.stringify({ idle: { fps, seq: SEQ } })}`);
console.log(`a light at the tip, its pulse: ${JSON.stringify({ fps, seq: SEQ.map((k) => LIGHT[k]) })}`);
