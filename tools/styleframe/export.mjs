// Regenerates public/assets/styleframe from the hand-coded style frame in ./src.
// The style frame paints every surface into buffers (albedo for both views, height, material, glow);
// this runs it in headless Chrome one layer at a time and writes each layer in the asset contract format.
// Usage: node tools/styleframe/export.mjs

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname, root = resolve(here, '../..'), out = resolve(root, 'public/assets/styleframe');
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const parts = readdirSync(resolve(here, 'src')).filter((f) => f.endsWith('.js')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
const js = '(() => {\n' + parts.map((f) => readFileSync(resolve(here, 'src', f), 'utf8')).join('\n') + '\n})();';
const page = resolve(root, 'node_modules/.cache/styleframe-export.html');
mkdirSync(resolve(root, 'node_modules/.cache'), { recursive: true });
writeFileSync(page, readFileSync(resolve(here, 'src/head.html'), 'utf8') + '<canvas id=pix width=960 height=540></canvas><script>' + js + '</script>');

const dom = execFileSync(chrome, ['--headless=new', `--user-data-dir=${resolve(root, 'node_modules/.cache/shot-chrome')}`, '--virtual-time-budget=30000', '--dump-dom', 'file://' + page], { encoding: 'utf8', maxBuffer: 256 << 20 });
const err = /data-err="([^"]*)"/.exec(dom);
if (err) throw new Error(err[1]);
const raw = /data-export="([^"]*)"/.exec(dom);
if (!raw) throw new Error('the style frame did not export anything');
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const d = JSON.parse(unescape(raw[1]));
const png = (url) => Buffer.from(url.split(',', 2)[1], 'base64');

// depth, parallax, and which views a layer exists in when not both
const layers = { 'sky-city': [0, 0.35], crowd: [2, 0.8], street: [3, 1], sleeper: [3, 1, 'raw'], docked: [3, 1], hero: [3, 1] };
for (const [name, g] of Object.entries(d.groups)) {
  mkdirSync(resolve(out, name), { recursive: true });
  for (const [m, url] of Object.entries(g.files)) writeFileSync(resolve(out, name, `${m}.png`), png(url));
  const [depth, parallax, exists] = layers[name];
  writeFileSync(resolve(out, name, 'sprite.json'), JSON.stringify({ name, x: g.x, y: g.y, w: g.w, h: g.h, maps: Object.keys(g.files).sort(), depth, parallax, ...(exists ? { exists } : {}) }, null, 2));
}
writeFileSync(resolve(out, 'zone.png'), png(d.zone));
const scene = {
  name: 'styleframe', size: [960, 540], sprites: ['sky-city', 'crowd', 'street', 'sleeper', 'docked', 'hero'], zone: 'zone.png',
  lights: d.lights,
  beacons: d.beacons.map(([x, y, phase]) => ({ x, y, phase: Math.round(phase * 1000) / 1000 })),
  steam: Array.from({ length: d.steam.length / 4 }, (_, i) => d.steam.slice(i * 4, i * 4 + 4)).map(([x, y, height, w]) => ({ x, y, height, width: Math.abs(w), kind: w < 0 ? 'smoke' : 'steam' })),
  godrays: Array.from({ length: d.godrays.length / 4 }, (_, i) => d.godrays.slice(i * 4, i * 4 + 4)).map(([x, y, strength, zone]) => ({ x, y, strength, zone, ...(x === 708 && y === 110 ? { ar: 1 } : {}) })),
  drips: { x0: 16, x1: 524, top: 106, bottom: 456 }, mirror: 456,
  traffic: { lanes: [184, 212, 248, 276], perLane: 3, x0: 552, span: 352, ar: 1 },
};
writeFileSync(resolve(out, 'scene.json'), JSON.stringify(scene, null, 1));
console.log(`exported ${Object.keys(d.groups).length} sprites, ${d.lights.length} lights to ${out}`);
