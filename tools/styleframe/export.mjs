// Regenerates the main street's hand-coded layers from ./src: the sky with the city (sky), the crowd far off (crowd)
// and the street itself with the radio repair's front (set), plus the street's zone map. The style frame paints every
// surface into buffers (albedo for both views, height, material, glow); this runs it in headless Chrome and writes each
// layer in the asset contract format into public/assets/street/, beside the street's generated characters.
// The scene itself (lights, hotspots, effects) is public/assets/scenes/street/scene.json, edited in the scene editor.
// Usage: node tools/styleframe/export.mjs

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const here = import.meta.dirname, root = resolve(here, '../..'), out = resolve(root, 'public/assets/street');
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

// depth and parallax per layer: the sky is far and moves slowly, the crowd between, the street with the camera
const layers = { sky: [0, 0.35], crowd: [2, 0.8], set: [3, 1] };
for (const [name, g] of Object.entries(d.groups)) {
  mkdirSync(resolve(out, name), { recursive: true });
  for (const [m, url] of Object.entries(g.files)) writeFileSync(resolve(out, name, `${m}.png`), png(url));
  const [depth, parallax] = layers[name];
  writeFileSync(resolve(out, name, 'sprite.json'), JSON.stringify({ name, x: g.x, y: g.y, w: g.w, h: g.h, maps: Object.keys(g.files).sort(), depth, parallax }, null, 2) + '\n');
}
writeFileSync(resolve(out, 'zone.png'), png(d.zone));

// list the layers with the street's other assets, so the asset bench and the scene editor offer them
const listFile = resolve(out, 'bench.json'), list = existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : { assets: [], backgrounds: [] };
list.assets = [...new Set([...(list.assets ?? []), ...Object.keys(d.groups)])].sort();
writeFileSync(listFile, JSON.stringify(list, null, 2) + '\n');
console.log(`exported ${Object.keys(d.groups).join(', ')} and the zone map to ${out}`);
