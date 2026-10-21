// Lifting a thing out of a scene's picture: a thing she can take or move belongs in no background, but in a sprite of
// its own, placed in the scene, shown while the story says it is there and placeable in any other scene. A thing painted
// into a picture is lifted out of it: painted out of both views (touch, raw view redrawn from the Concierge's so the two
// line up), cut from the pictures as they were where they changed (a difference matte: its own pixels, its glow, its
// soft edges, nothing of the background), built as a prop that keeps the frame it was cut in, and placed in the scene
// exactly where it was. The picture is split again without it.
//
//   npm run asset -- lift <picture recipe> --box x,y,w,h --name parcel --prompt "the small cardboard parcel"
//                          [--scene home] [--when "!(taken has parcel)"] [--quality medium] [--hull]
//   ... --before <dir>   the pictures are already without it: cut it from the ones in <dir> (concierge.png, raw.png)
//   ... --hull           it is convex (a box, a jar): everything between its edges is it

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { buildOne } from './build.mjs';
import { blank, readRGBA, writePNG } from './image.mjs';
import { cmdTouch } from './images.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { cmdSplit } from './scenes.mjs';
import { rel } from './shared.mjs';

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * What a picture had in a box that the picture without it has not: the thing itself, whole, and the shadow it cast, as a
 * darkening that falls on whatever it is put on. What the painting-out changed besides (the background behind it drawn
 * again a little differently, its light on the wall) is not part of it: in another scene it would be a piece of this
 * one. `hull`: the thing is convex (a box, a jar), so everything between its edges is it, though its colour there is
 * the background's.
 */
export function matte(before, after, [x, y, w, h], { low = 10, high = 36, hull = false } = {}) {
  const out = blank(w, h), a = new Float32Array(w * h), shade = new Float32Array(w * h), core = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const s = ((y + j) * before.w + (x + i)) * 4, b = [0, 1, 2].map((c) => before.d[s + c]), f = [0, 1, 2].map((c) => after.d[s + c]);
    const d = Math.max(...b.map((v, c) => Math.abs(v - f[c]))), k = j * w + i;
    a[k] = smoothstep(low, high, d);
    out.d.set([...b, 0], k * 4);
    // a shadow darkens what is under it alike in every channel; a light brightens it alike: neither is the thing
    const r = b.map((v, c) => (v + 4) / (f[c] + 4)), m = (r[0] + r[1] + r[2]) / 3, even = Math.max(...r.map((v) => Math.abs(v - m))) < 0.1;
    if (even && m < 0.97) shade[k] = Math.min(1, 1 - m);
    core[k] = a[k] >= 0.5 && !(even && Math.abs(m - 1) >= 0.03) ? 1 : 0;
  }
  // its body: what changed clearly and is no shadow or light, without thin streaks (an edge of the desk drawn again), the
  // parts joined to its largest
  const grow = (m, r, on) => { const o = new Uint8Array(w * h); for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { let v = on ? 0 : 1; for (let dy = -r; dy <= r && (on ? !v : v); dy++) for (let dx = -r; dx <= r; dx++) { const X = xx + dx, Y = yy + dy, s = X >= 0 && Y >= 0 && X < w && Y < h ? m[Y * w + X] : on ? 0 : 1; if (on ? s : !s) { v = on ? 1 : 0; break; } } o[yy * w + xx] = v; } return o; };
  const body = grow(grow(core, 1, false), 1, true), part = new Int32Array(w * h).fill(-1), sizes = [];
  for (let i = 0; i < w * h; i++) {
    if (part[i] >= 0 || !body[i]) continue;
    const id = sizes.length, stack = [i];
    part[i] = id;
    let n = 0;
    while (stack.length) {
      const k = stack.pop(), kx = k % w, ky = (k / w) | 0;
      n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = kx + dx, yy = ky + dy, q = yy * w + xx;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h || part[q] >= 0 || !body[q]) continue;
        part[q] = id;
        stack.push(q);
      }
    }
    sizes.push(n);
  }
  const biggest = Math.max(0, ...sizes), solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) solid[i] = part[i] >= 0 && sizes[part[i]] >= biggest * 0.15 ? 1 : 0;
  // where it is the colour of what was behind it, it changed too little to show: anything its outline encloses is it
  // (its outline closed over small gaps, then everything the box's edge cannot reach through what is not it), or with
  // `hull`, everything between its edges
  const closed = grow(grow(solid, 2, true), 2, false), whole = new Uint8Array(w * h), stack = [];
  for (let i = 0; i < w * h; i++) { const xx = i % w, yy = (i / w) | 0; if ((xx === 0 || yy === 0 || xx === w - 1 || yy === h - 1) && !closed[i]) { whole[i] = 2; stack.push(i); } }
  while (stack.length) {
    const k = stack.pop(), kx = k % w, ky = (k / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = kx + dx, Y = ky + dy, q = Y * w + X; if (X < 0 || Y < 0 || X >= w || Y >= h || whole[q] || closed[q]) continue; whole[q] = 2; stack.push(q); }
  }
  for (let i = 0; i < w * h; i++) whole[i] = whole[i] === 2 ? 0 : solid[i] || closed[i] ? 1 : 1;
  if (hull) {
    const inside = convexHull(solid, w, h);
    for (let i = 0; i < w * h; i++) if (inside[i]) whole[i] = 1;
  }
  // the thing, a soft rim where its edge changed less (a glow fading out), and its shadow within a few pixels of it:
  // black, as dark as it made what it fell on
  const rim = grow(whole, 3, true), near = grow(whole, 5, true);
  for (let i = 0; i < w * h; i++) {
    if (whole[i]) out.d[i * 4 + 3] = 255;
    else if (near[i] && shade[i] > 0.02) out.d.set([0, 0, 0, Math.round(shade[i] * 255)], i * 4);
    else if (rim[i]) out.d[i * 4 + 3] = Math.round(a[i] * 255);
  }
  return out;
}

/** The pixels inside the convex hull of a mask's pixels. */
function convexHull(m, w, h) {
  const pts = [];
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (m[yy * w + xx]) pts.push([xx, yy], [xx + 1, yy], [xx, yy + 1], [xx + 1, yy + 1]);
  const inside = new Uint8Array(w * h);
  if (pts.length < 3) return inside;
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const half = (list) => { const s = []; for (const p of list) { while (s.length >= 2 && cross(s[s.length - 2], s[s.length - 1], p) <= 0) s.pop(); s.push(p); } s.pop(); return s; };
  const poly = [...half(pts), ...half([...pts].reverse())];
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const p = [xx + 0.5, yy + 0.5];
    if (poly.every((q, i) => cross(q, poly[(i + 1) % poly.length], p) >= 0)) inside[yy * w + xx] = 1;
  }
  return inside;
}

/**
 * How a picture's pixels land in its scene: where its nearest layer (or the picture itself) is placed, and how many
 * level pixels a texel of the picture is, across and down. A picture is drawn to the scene's height, so a texel is a
 * little more or less than half a pixel.
 */
async function placing(r, sceneFile, picture) {
  const scene = JSON.parse(await readFile(sceneFile, 'utf8')), mine = (a) => a === `${r.scene}/${r.name}` || a.startsWith(`${r.scene}/${r.name}-`);
  const at = scene.layers.map((l, i) => [l, i]).filter(([l]) => mine(l.asset)).pop();
  if (!at) throw new Error(`${rel(sceneFile)} has no layer of ${r.scene}/${r.name}`);
  const [layer, index] = at, sprite = JSON.parse(await readFile(join(ROOT, 'public/assets', layer.asset, 'sprite.json'), 'utf8'));
  // the layer's own picture: split layers are the picture with a margin each side
  const art = await readRGBA(join(ROOT, 'art', layer.asset.split('/')[0], layer.asset.split('/')[1], 'concierge.png')).catch(() => picture);
  const margin = layer.asset === `${r.scene}/${r.name}` ? 0 : Math.round((r.split?.margin ?? 20) * (r.res ?? 1));
  const fx = sprite.w / art.w, fy = sprite.h / art.h;
  return { scene, index, x0: (layer.x ?? sprite.x) + margin * fx, y0: layer.y ?? sprite.y, fx, fy };
}

export async function cmdLift([file], opt) {
  const r = await loadRecipe(file), box = String(opt.box ?? '').split(',').map(Number), name = opt.name;
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || typeof name !== 'string') throw new Error('usage: lift <picture recipe> --box x,y,w,h --name <thing> [--prompt "what it is"] [--scene <id>] [--when "<condition>"] [--before <dir>]');
  const [x, y, w, h] = box, views = ['concierge', 'raw'].filter((v) => existsSync(join(r.dir, `${v}.png`))), before = {};
  // the pictures as they were: given (painted out already), or as they are now, before painting it out
  for (const v of views) before[v] = await readRGBA(typeof opt.before === 'string' ? join(resolve(opt.before), `${v}.png`) : join(r.dir, `${v}.png`));
  if (typeof opt.before !== 'string') {
    const what = typeof opt.prompt === 'string' ? opt.prompt : `the ${name}`;
    await cmdTouch([file], { view: 'concierge', box: box.join(','), quality: opt.quality, prompt: `${what} is gone; what was behind it continues there as it is around it, everything else exactly as it is` });
    if (views.includes('raw')) await cmdTouch([file], { view: 'raw', from: 'concierge', box: box.join(','), quality: opt.quality, prompt: `the same place without ${what}, everything else exactly as the attached raw picture has it` });
  }
  // the thing, cut from each view where the picture changed: each view's own, so that it is only the thing wherever it
  // is put (the two pictures differ a little in where they have it)
  const dir = join(ROOT, 'art', r.scene, name);
  await mkdir(dir, { recursive: true });
  for (const v of views) await writePNG(join(dir, `${v}.png`), matte(before[v], await readRGBA(join(r.dir, `${v}.png`)), box, { hull: opt.hull === true }));
  // placed where it was: in the scene asked for, and in its recipe
  const sceneId = typeof opt.scene === 'string' ? opt.scene : r.scene, sceneFile = join(ROOT, 'public/assets/scenes', sceneId, 'scene.json');
  const p = existsSync(sceneFile) ? await placing(r, sceneFile, before[views[0]]) : null;
  const lx = p ? p.x0 + x * p.fx : x / (r.res ?? 1), ly = p ? p.y0 + y * p.fy : y / (r.res ?? 1), lw = w * (p?.fx ?? 1 / (r.res ?? 1)), lh = h * (p?.fy ?? 1 / (r.res ?? 1));
  const round = (v) => Math.round(v * 100) / 100;
  const recipe = {
    name, scene: r.scene, kind: 'prop', exists: views.length > 1 ? 'both' : views[0], look: r.look, res: r.res, frame: 'keep',
    prompt: `${typeof opt.prompt === 'string' ? opt.prompt : name}: lifted out of ${r.scene}/${r.name} (lift), cut from its pictures where they changed as it was painted out.`,
    height: round(lh), position: [round(lx + lw / 2), round(ly + lh)], depth: 3, occluder: false, material: r.material ?? 'stone', glow: { raw: 'auto', concierge: 'auto' }, palette: r.palette ?? 0, references: [],
  };
  const recipeFile = join(ROOT, 'art', r.scene, `${name}.json`);
  await writeFile(recipeFile, JSON.stringify(recipe, null, 2) + '\n');
  await buildOne(recipeFile);
  // the picture without it, split again; then the thing over it, where it was
  if (r.split?.layers?.length && p) await cmdSplit([file], { scene: sceneId, reuse: false });
  if (p) {
    const scene = JSON.parse(await readFile(sceneFile, 'utf8')), asset = `${r.scene}/${name}`, entry = { asset, x: round(lx), y: round(ly), ...(typeof opt.when === 'string' ? { when: opt.when } : {}) };
    const had = scene.layers.findIndex((l) => l.asset === asset);
    if (had >= 0) scene.layers[had] = { ...scene.layers[had], ...entry };
    else {
      const mine = (a) => a === `${r.scene}/${r.name}` || a.startsWith(`${r.scene}/${r.name}-`);
      const last = scene.layers.map((l, i) => (mine(l.asset) ? i : -1)).filter((i) => i >= 0).pop() ?? scene.layers.length - 1;
      scene.layers.splice(last + 1, 0, entry);
    }
    await writeFile(sceneFile, JSON.stringify(scene, null, 1) + '\n');
    console.log(`${rel(sceneFile)}: ${asset} at ${entry.x}, ${entry.y}${entry.when ? `, there while ${entry.when}` : ''}`);
  }
}
