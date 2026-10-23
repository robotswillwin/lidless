// Building: a recipe's chosen pictures, or a character's frames, cleaned, sized, palette-fitted and turned into the
// maps of a game sprite in public/assets.

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { bleedEdges, contentBox, fillHoles, fitColours, fitToHeight, hardenAlpha, isOpaque, paletteFit, pixelate, removeFlatBackground, silhouetteMatch, unionBox } from './clean.mjs';
import { glowAuto, heightMap, materialMap, metaMap, normalMap } from './derive.mjs';
import { blank, readRGBA, resize, writePNG } from './image.mjs';
import { plant } from './parts.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { finishFor, palette, rel } from './shared.mjs';

export async function updateBenchList(scene, name, kind) {
  const file = resolve(ROOT, 'public/assets', scene, 'bench.json');
  const list = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { assets: [] };
  if (!list.assets.includes(name)) list.assets.push(name);
  list.assets.sort();
  // the bench offers backgrounds as backdrops, with a character in front
  list.backgrounds = (list.backgrounds ?? []).filter((n) => n !== name);
  if (kind === 'background') list.backgrounds.push(name);
  list.backgrounds.sort();
  // the bench lists every scene: keep an index of them
  const indexFile = resolve(ROOT, 'public/assets/bench.json'), index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : { scenes: [] };
  if (!index.scenes.includes(scene)) index.scenes.push(scene);
  index.scenes.sort();
  delete index.latest;
  delete list.latest;
  await writeFile(indexFile, JSON.stringify(index, null, 2) + '\n');
  await writeFile(file, JSON.stringify(list, null, 2) + '\n');
  // and the bench opens the asset built last: noted where git does not see it, as it changes with every build
  await writeFile(resolve(ROOT, 'public/assets/latest.json'), JSON.stringify({ latest: `${scene}/${name}` }) + '\n');
}

/**
 * Where a character's animation frames are: rendered by its Blender rig into rig/anims, which can be rendered again and
 * is not kept in git; otherwise anims, made frame by frame (touch --frame) or baked from its parts, which is.
 */
export const framesDir = (r) => (existsSync(join(r.dir, 'rig', 'rig.json')) ? join(r.dir, 'rig', 'anims') : join(r.dir, 'anims'));

export async function buildOne(file) {
  const r = await loadRecipe(file), spec = r.spec, exists = r.exists ?? 'both', rawPath = join(r.dir, 'raw.png'), concPath = join(r.dir, 'concierge.png');
  // a picture split into layers is built as its layers, by split; a sprite of the whole picture would only take room
  if (r.split?.layers?.length) return console.log(`${r.name}: split into layers (${r.split.layers.map((l) => `${r.name}-${l.name}`).join(', ')}), so not built as a sprite of its own; after changing its pictures, split it again: npm run asset -- split ${rel(r.file)} --scene <scene id>`);
  // frames baked from parts, or touched up one by one, make an animated sprite
  if (existsSync(framesDir(r))) return assembleOne(r);
  const main = exists === 'concierge' ? concPath : rawPath;
  if (!existsSync(main)) throw new Error(`${r.name}: no ${exists === 'concierge' ? 'Concierge' : 'raw'} image yet. Generate and pick one, or import one.`);
  let raw = exists === 'concierge' ? null : await readRGBA(rawPath);
  let conc = exists === 'raw' || !existsSync(concPath) ? null : await readRGBA(concPath);
  // a cut-out generated on a plain backdrop loses the backdrop; a background fills its frame and keeps it
  if (spec.transparent) for (const img of [raw, conc]) if (img && isOpaque(img)) removeFlatBackground(img);
  if (raw && conc && (conc.w !== raw.w || conc.h !== raw.h)) {
    const { data } = await sharp(Buffer.from(conc.d.buffer, conc.d.byteOffset, conc.d.length), { raw: { width: conc.w, height: conc.h, channels: 4 } }).resize(raw.w, raw.h, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    conc = { w: raw.w, h: raw.h, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
  }
  // res: texels per level pixel, so art can carry more detail than the level's 960 by 540 for a render scale of 2
  const res = r.res ?? 1, flat = isFlat(r), first = raw ?? conc, height = Math.round((r.height ?? spec.height) * res), strength = r.palette ?? 0.35;
  // a cut-out is cropped to what it shows; one lifted from a picture (`frame: "keep"`) keeps the frame it was cut in, so
  // it lands exactly where it was
  const box = spec.transparent && r.frame !== 'keep' ? [raw, conc].filter(Boolean).map((img) => contentBox(img)).reduce(unionBox) : { x: 0, y: 0, w: first.w, h: first.h };
  const hexes = await palette();
  const finish = finishFor(r);
  if (raw) raw = finish(paletteFit(hardenAlpha(await fitToHeight(raw, box, height)), hexes, strength));
  if (conc) conc = finish(paletteFit(hardenAlpha(await fitToHeight(conc, box, height)), hexes, strength));

  // surfaces come from each view's own picture: in the Concierge's view a room is lit by its own walls, not by the cracks
  // of the real ones under them, and a dressed-up character by its own clothes. A generated thing has only its Concierge look
  const { w, h } = raw ?? conc;
  const surface = (img) => { const H = heightMap(img, { round: spec.round, rh: spec.rh, detail: spec.detail }); return [normalMap(H, w, h), materialMap(img, H, r.material ?? spec.material)]; };
  const [normalR, materialR] = surface(raw ?? conc), [normalC, materialC] = raw && conc ? surface(conc) : [null, null];
  // the view it is not in gets a transparent albedo, so the engine draws nothing there: no shadow, no reflection
  const glowRawSrc = raw;
  if (!raw) raw = blank(w, h);
  if (exists === 'raw') conc = blank(w, h);
  const glow = r.glow ?? {}, out = resolve(ROOT, 'public/assets', r.scene, r.name);
  await mkdir(out, { recursive: true });
  const maps = ['albedo.raw'];
  // colours run on a little past a cut-out's edges, as for characters: art sampled between pixels (a layer the camera
  // moves by fractions of one, art at more than one texel per level pixel) would otherwise mix its edges with the black
  // of empty pixels and draw dark lines around them
  const bled = (img) => bleedEdges({ w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) });
  await writePNG(join(out, 'albedo.raw.png'), bled(raw));
  // flat art has no relief or shine of its own to light, and one set of flags for all of it: the engine's defaults and
  // the sprite's own values stand in for those maps, at a fraction of the memory
  if (!flat) {
    maps.push('normal', 'material', 'meta');
    await writePNG(join(out, 'normal.png'), normalR, { rgb: true });
    await writePNG(join(out, 'material.png'), materialR, { rgb: true });
    if (normalC) {
      await writePNG(join(out, 'normal.concierge.png'), normalC, { rgb: true });
      await writePNG(join(out, 'material.concierge.png'), materialC, { rgb: true });
      maps.push('normal.concierge', 'material.concierge');
    }
    await writePNG(join(out, 'meta.png'), metaMap(raw, exists === 'both' ? conc : null, {
      occluder: r.occluder ?? spec.occluder, object: r.object ?? 0, depth: r.depth ?? spec.depth, reflectivity: r.reflectivity ?? 0,
      groupRaw: glow.groupRaw ?? 0, groupConcierge: glow.groupConcierge ?? 0, machine: !!glow.machine,
    }), { rgb: true });
  }
  // a background's glow at half its size: soft light loses nothing by it, and its two glow maps were half of what the
  // background took on the GPU. The engine samples every map by where it is in the sprite, whatever its size
  const halved = async (img) => (r.kind === 'background' && img.w > 64 && img.h > 64 ? resize(img, Math.ceil(img.w / 2), Math.ceil(img.h / 2)) : img);
  const glowRaw = glow.raw === 'auto' && glowRawSrc ? glowAuto(glowRawSrc) : null;
  if (glowRaw) { await writePNG(join(out, 'glow.raw.png'), await halved(glowRaw), { rgb: true }); maps.push('glow.raw'); }
  if (conc) {
    await writePNG(join(out, 'albedo.concierge.png'), bled(conc));
    maps.push('albedo.concierge');
    const gc = exists === 'raw' ? null : (glow.concierge ?? 'auto') === 'auto' ? glowAuto(conc) : glowRaw;
    if (gc) { await writePNG(join(out, 'glow.concierge.png'), await halved(gc), { rgb: true }); maps.push('glow.concierge'); }
  }
  const [cx, base] = r.position ?? [480, 464], lw = toLevel(w, res), lh = toLevel(h, res);
  const sprite = {
    name: r.name, x: Math.round(cx - lw / 2), y: Math.round(base - lh), w: lw, h: lh, maps: maps.sort(),
    depth: r.depth ?? spec.depth, parallax: r.parallax ?? 1, occluder: (r.occluder ?? spec.occluder) ? 1 : 0, reflectivity: r.reflectivity ?? 0, object: r.object ?? 0,
    ...(flat ? flatFlags(r) : {}), anchor: [Math.round(lw / 2), lh], exists, kind: r.kind, ...(res !== 1 ? { res } : {}), ...(r.lit ? { lit: true } : {}),
  };
  await writeFile(join(out, 'sprite.json'), JSON.stringify(sprite, null, 2) + '\n');
  // maps an earlier build wrote that this one did not
  for (const f of await readdir(out)) if (f.endsWith('.png') && !maps.includes(f.slice(0, -4))) await rm(join(out, f));
  await updateBenchList(r.scene, r.name, r.kind);
  const match = exists === 'both' && conc ? ` · outline match ${(silhouetteMatch(raw, conc) * 100).toFixed(0)}%` : exists === 'both' ? '' : ` · ${exists} view only`;
  console.log(`${r.name}: ${w}×${h}${res !== 1 ? ` texels, ${res} per level pixel` : ''} → ${rel(out)} (${maps.length} maps)${match}`);
}

/** Flat vector art: lit by the game's light alone, without relief, shine or per-pixel flags. A recipe can say otherwise. */
export const isFlat = (r) => r.flatMaps ?? r.look === 'vector';

/** Texels to level pixels, to a hundredth. */
export const toLevel = (v, res) => Math.round((v / res) * 100) / 100;

/** The flags a flat sprite's meta map would have carried, for the engine to use instead. */
export const flatFlags = (r) => {
  const glow = r.glow ?? {};
  return { ...(glow.groupRaw ? { groupRaw: glow.groupRaw } : {}), ...(glow.groupConcierge ? { groupConcierge: glow.groupConcierge } : {}), ...(glow.machine ? { machine: 1 } : {}) };
};

/**
 * An animated character: frames baked from its parts (parts --bake), or loops touched up frame by frame (touch
 * --frame). Every frame of both views is cropped and scaled the same way, so the character keeps its size and place,
 * and planted on the ground.
 */
export async function assembleOne(r) {
  const res = r.res ?? 1, height = Math.round((r.height ?? r.spec.height) * res), dir = framesDir(r);
  const load = async (anim, view) => {
    const d = join(dir, anim);
    if (!existsSync(d)) return [];
    const files = (await readdir(d)).filter((f) => f.startsWith(`${view}-`) && f.endsWith('.png')).sort();
    return Promise.all(files.map((f) => readRGBA(join(d, f))));
  };
  // runs in this order, each where it exists: standing, walking, jogging and running facing right, then the same facing
  // left, then standing facing left with her left eye shut (her blink), then turned to us and away from us
  const RUNS = ['idle', 'walk', 'jog', 'run', 'idleLeft', 'walkLeft', 'jogLeft', 'runLeft', 'blinkLeft', 'front', 'back'], views = {};
  for (const v of ['raw', 'concierge']) {
    const runs = {};
    for (const run of RUNS) runs[run] = await load(run, v);
    if (RUNS.some((run) => runs[run].length)) views[v] = runs;
  }
  if (!views.raw && !views.concierge) throw new Error(`${r.name}: no frames in ${rel(dir)} yet; bake them with: npm run asset -- parts ${rel(r.file)} --bake`);
  const [a, b] = [views.raw, views.concierge].filter(Boolean);
  if (b && RUNS.some((run) => a[run].length !== b[run].length)) throw new Error(`${r.name}: the raw and Concierge views have different frames; make both the same way`);
  const all = [views.raw, views.concierge].filter(Boolean).flatMap((v) => RUNS.flatMap((run) => v[run]));
  // an empty frame (a sign switched off) takes no part in the frames' size
  const shows = (img) => { for (let i = 3; i < img.d.length; i += 4) if (img.d[i] >= 128) return true; return false; };
  const box = all.filter(shows).map((img) => contentBox(img)).reduce(unionBox), scale = height / box.h;
  const gaitOf = async (name) => (existsSync(join(dir, name, 'stride.json')) ? JSON.parse(await readFile(join(dir, name, 'stride.json'), 'utf8')) : null);
  const G = { walk: await gaitOf('walk'), jog: await gaitOf('jog'), run: await gaitOf('run') };
  const gaitOfRun = (run) => G[run.replace(/Left$/, '')] ?? null;
  // each frame is set down on its lowest foot, a jog's and a run's frames as high off the ground as she is in them
  const airOf = (run, k) => (gaitOfRun(run)?.air?.[k] ?? 0) * scale;
  const frames = async (v) => v && Promise.all(RUNS.flatMap((run) => v[run].map((img, k) => [img, airOf(run, k)])).map(async ([img, air]) => plant([hardenAlpha(await fitToHeight(img, box, height))], air)[0]));
  const anims = {};
  let from = 0;
  for (const run of RUNS) {
    const count = a[run].length;
    if (!count) continue;
    const g = gaitOfRun(run);
    anims[run] = g ? { from, count, stride: toLevel(g.stride * scale, res) } : { from, count };
    from += count;
  }
  // the anchor: the rig's hip if the frames were baked from parts; otherwise writeAnimated centres it
  const origin = existsSync(join(dir, 'origin.json')) ? JSON.parse(await readFile(join(dir, 'origin.json'), 'utf8')).x : null;
  const anchorX = origin != null ? Math.round((origin - box.x) * scale) : null;
  // timing from the recipe: a loop's frames per second, and the order to play them in, repeats making a frame hold
  for (const [k, extra] of Object.entries(r.anims ?? {})) if (anims[k]) Object.assign(anims[k], extra);
  await writeAnimated(r, await frames(views.raw), await frames(views.concierge), { anchorX, anims });
}

/**
 * Animation frames, game size, into the asset: one set of colours per view across all frames, so nothing flickers;
 * maps derived frame by frame; every map a strip of frames with a transparent gutter between them.
 */
export async function writeAnimated(r, raws, concs, { anchorX, anims }) {
  const spec = r.spec, exists = r.exists ?? 'both', hexes = await palette(), strength = r.palette ?? 0.35, G = 2, n = (raws ?? concs).length;
  const res = r.res ?? 1, flat = isFlat(r);
  const px = r.pixel === false ? null : { ...spec.pixel, ...(r.pixel ?? {}) };
  for (const fs of [raws, concs]) if (fs) {
    // small seams where cut-out parts meet would let the set behind show through
    for (let k = 0; k < n; k++) { fillHoles(fs[k]); fs[k] = paletteFit(fs[k], hexes, strength); }
    // the colours are fitted to all frames together: a face seen only from one side keeps its skin tones
    const together = { w: fs[0].w, h: fs[0].h * n, d: new Uint8ClampedArray(fs[0].d.length * n) };
    fs.forEach((f, k) => together.d.set(f.d, k * f.d.length));
    const centres = px?.colors ? fitColours(together, px.colors) : null;
    if (centres) for (const f of fs) pixelate(f, { centres, cleanup: px.cleanup ?? true });
  }
  const { w, h } = (raws ?? concs)[0], glow = r.glow ?? {}, maps = {};
  const add = (name, img) => (maps[name] ??= []).push(img);
  for (let k = 0; k < n; k++) {
    let raw = raws?.[k] ?? null, conc = concs?.[k] ?? null;
    const glowRawSrc = raw;
    // each view's own surface, as in buildOne; flat art has none, and one set of flags for all of it
    if (!flat) {
      const surface = (img) => { const H = heightMap(img, { round: spec.round, rh: spec.rh, detail: spec.detail }); return [normalMap(H, w, h), materialMap(img, H, r.material ?? spec.material)]; };
      const [normalR, materialR] = surface(raw ?? conc);
      add('normal', normalR);
      add('material', materialR);
      if (raw && conc) { const [normalC, materialC] = surface(conc); add('normal.concierge', normalC); add('material.concierge', materialC); }
    }
    if (!raw) raw = blank(w, h);
    if (exists === 'raw') conc = blank(w, h);
    add('albedo.raw', raw);
    if (!flat) add('meta', metaMap(raw, exists === 'both' ? conc : null, {
      occluder: r.occluder ?? spec.occluder, object: r.object ?? 0, depth: r.depth ?? spec.depth, reflectivity: r.reflectivity ?? 0,
      groupRaw: glow.groupRaw ?? 0, groupConcierge: glow.groupConcierge ?? 0, machine: !!glow.machine,
    }));
    // glow.strength: how strongly its bright parts glow (a welder's arc more than a lamp)
    const glowOpt = glow.strength ? { strength: glow.strength } : undefined;
    if (glow.raw === 'auto' && glowRawSrc) add('glow.raw', glowAuto(glowRawSrc, glowOpt));
    if (conc) {
      add('albedo.concierge', conc);
      if (exists !== 'raw' && (glow.concierge ?? 'auto') === 'auto') add('glow.concierge', glowAuto(conc, glowOpt));
    }
  }
  // frames in rows, at most 2048 pixels wide, or 4096 where 2048 would make the sheet taller than that, so every phone
  // can load them (they all take 4096 each way); with a transparent gutter so neighbours
  // never bleed into each other
  const colsFor = (W) => Math.max(1, Math.min(n, Math.floor((W + G) / (w + G))));
  let cols = colsFor(2048);
  if (Math.ceil(n / cols) * (h + G) - G > 4096) cols = colsFor(4096);
  const rows = Math.ceil(n / cols);
  if (rows * (h + G) - G > 4096) console.warn(`${r.name}: ${n} frames make a sheet ${rows * (h + G) - G} pixels tall, more than some phones load`);
  const strip = (imgs) => {
    const out = blank(cols * w + (cols - 1) * G, rows * h + (rows - 1) * G);
    imgs.forEach((img, k) => {
      const ox = (k % cols) * (w + G), oy = Math.floor(k / cols) * (h + G);
      for (let y = 0; y < h; y++) out.d.set(img.d.subarray(y * w * 4, (y + 1) * w * 4), ((oy + y) * out.w + ox) * 4);
    });
    return out;
  };
  const out = resolve(ROOT, 'public/assets', r.scene, r.name);
  await mkdir(out, { recursive: true });
  // a character's colours run on a little past its edge, for the engine's smooth sampling
  for (const [name, imgs] of Object.entries(maps)) await writePNG(join(out, `${name}.png`), name.startsWith('albedo') ? bleedEdges(strip(imgs)) : strip(imgs), { rgb: !name.startsWith('albedo') });
  // sizes and places in level pixels; the frames' texels are res to each
  const lw = toLevel(w, res), lh = toLevel(h, res), anchor = [toLevel(anchorX ?? w / 2, res), lh], [cx, base] = r.position ?? [480, 464];
  // how far each frame's lowest point is off the ground (a run's flight), in level pixels: wet ground mirrors her
  // around her feet as they are in that frame, so her reflection stays with them
  const lifts = Array.from({ length: n }, (_, k) => {
    const imgs = [raws?.[k], concs?.[k]].filter(Boolean);
    let low = -1;
    for (const img of imgs) for (let y = h - 1; y > low; y--) { let on = false; for (let x = 0; x < w && !on; x++) on = img.d[(y * w + x) * 4 + 3] > 128; if (on) { low = y; break; } }
    return low < 0 ? 0 : Math.round(((h - 1 - low) / res) * 10) / 10;
  });
  const sprite = {
    name: r.name, x: Math.round(cx - anchor[0]), y: Math.round(base - lh), w: lw, h: lh, maps: Object.keys(maps).sort(),
    depth: r.depth ?? spec.depth, parallax: r.parallax ?? 1, occluder: (r.occluder ?? spec.occluder) ? 1 : 0, reflectivity: r.reflectivity ?? 0, object: r.object ?? 0,
    ...(flat ? flatFlags(r) : {}), anchor, exists, kind: r.kind, frames: { count: n, gutter: G, cols, ...(lifts.some((v) => v > 0) ? { lifts } : {}) }, anims, ...(res !== 1 ? { res } : {}), ...(r.lit ? { lit: true } : {}),
  };
  await writeFile(join(out, 'sprite.json'), JSON.stringify(sprite, null, 2) + '\n');
  for (const f of await readdir(out)) if (f.endsWith('.png') && !sprite.maps.includes(f.slice(0, -4))) await rm(join(out, f));
  await updateBenchList(r.scene, r.name, r.kind);
  console.log(`${r.name}: ${n} frames of ${w}×${h}${res !== 1 ? ` texels, ${res} per level pixel` : ''}${anims.walk ? `, walk stride ${anims.walk.stride} px` : ''} → ${rel(out)} (${sprite.maps.length} maps)`);
}
