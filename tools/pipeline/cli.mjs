#!/usr/bin/env node
// The asset pipeline. Run `npm run asset -- help` for the commands.

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { contentBox, fitColours, fitToHeight, hardenAlpha, isOpaque, overlay, paletteFit, pixelate, removeFlatBackground, silhouetteMatch, unionBox } from './clean.mjs';
import { glowAuto, heightMap, materialMap, metaMap, normalMap } from './derive.mjs';
import { blank, readRGBA, writePNG } from './image.mjs';
import { edit, generate } from './openai.mjs';
import { KINDS, ROOT, loadRecipe, recipeTemplate } from './recipe.mjs';
import { conciergePartsPrompt, cut as cutParts, otherSidePrompt, PARTS as PARTS_NAMES, partsPrompt, pointOf, pose as posePartsRig, SHEET, template as partsTemplate, walkAngles } from './parts.mjs';
import { animatePrompt, guide, poses } from './poses.mjs';
import { bake, plant, shrink, WORK } from './rig.mjs';
import { conciergePrompt, generationPrompt, LOOKS, REFERENCE_NOTE } from './style.mjs';

try { process.loadEnvFile(resolve(ROOT, '.env.local')); } catch { /* no .env.local: fine until an API call needs the key */ }

const HELP = `Asset pipeline: generate art with an image AI, clean it and turn it into game sprites.

  npm run asset -- new <scene>/<name> [--kind character|prop|background|portrait]
      Write a recipe to art/<scene>/<name>.json to fill in.
  npm run asset -- generate <recipe> [--n 4] [--quality low|medium|high] [--look pixel|paint] [--ref a.png,b.png] [--tag name] [--dry]
      Generate candidates with GPT Image 2.5 into art/<scene>/<name>/candidates/: raw-view images, or Concierge
      images for something generated. Style references (the recipe's "references", or --ref) go along with the
      prompt; without any, Flare draws from the prompt alone. --tag adds a word to the candidates' file names.
  npm run asset -- variant <recipe> [--n 2] [--quality medium] [--tag name] [--dry]
      Edit the picked raw image into Concierge-view candidates (GPT Image 2.5 Sunburst).
  npm run asset -- sheet <recipe>
      Lay all candidates side by side at game size, finished as the build would, to choose between them.
  npm run asset -- animate <recipe> [--anim walk] [--view raw|concierge] [--quality low|medium] [--dry]
      Draw the character in each frame of an animation with GPT Image 2.5 Sunburst, following a grey mannequin
      posed in the character's own proportions (the recipe's pose.joints, in the source image's pixels). Frames and
      guides go to art/<scene>/<name>/anims/<anim>/. --dry only draws the guides, which costs nothing.
  npm run asset -- parts <recipe> [--view raw|concierge] [--quality low|medium] [--dry]
      Have GPT Image 2.5 Sunburst draw the character as a sheet of separate body parts (head, torso, coat, upper arm,
      forearm, thigh, shin) following a template, and cut them out with their joints into art/<scene>/<name>/parts/.
      The raw sheet is drawn from the recipe's parts.from image (default raw.png); the Concierge sheet is the raw
      sheet edited, so the parts match. --dry only writes the template.
      --preview walks the parts in a GIF; --bake renders a standing frame and the walk from them into anims/.
  npm run asset -- touch <recipe> --box x,y,w,h --prompt "what to change" [--view raw|concierge] [--quality low|medium] [--frame idle/1] [--dry]
      Change one area of the picked image with GPT Image 2.5 Sunburst, then rebuild. The box is in the picked
      image's pixels. Only a window around it is sent, and only the box is pasted back; the old image is kept
      in candidates/. With --frame, the result becomes that animation frame instead (art/<scene>/<name>/anims/),
      the picked image staying frame 0: everything outside the box is identical in every frame.
  npm run asset -- pick <recipe> <candidate>
      Use a candidate, e.g. raw-03 or concierge-01.
  npm run asset -- import <recipe> <image> [--as raw|concierge]
      Use an image made elsewhere, by hand or with another AI. Transparent PNGs work best;
      otherwise ask for a plain, bright, single-colour backdrop so it can be removed.
  npm run asset -- build <recipe> [more recipes...]
      Clean, size, palette-fit and derive the lighting maps into public/assets/<scene>/<name>/.

A recipe's "exists" says which views it is in:
  both        real (the default). A "concierge" description gives it a dressed-up look too: augmented.
  concierge   generated: the Concierge made it up, so raw view shows nothing there.
  raw         real, but the Concierge edits it out: only raw view shows it.

The API key goes in .env.local as OPENAI_API_KEY=... (never committed).`;

function parse(argv) {
  const pos = [], opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2), v = argv[i + 1]; if (v === undefined || v.startsWith('--')) opt[k] = true; else { opt[k] = v; i++; } }
    else pos.push(a);
  }
  return { pos, opt };
}

const rel = (p) => relative(ROOT, p);

async function nextName(dir, prefix, tag) {
  const have = existsSync(dir) ? (await readdir(dir)).filter((f) => f.startsWith(`${prefix}-`)).map((f) => parseInt(f.slice(prefix.length + 1), 10) || 0) : [];
  let n = Math.max(0, ...have);
  return () => `${prefix}-${String(++n).padStart(2, '0')}${tag ? `-${tag}` : ''}.png`;
}

const palette = async () => Object.values(JSON.parse(await readFile(resolve(ROOT, 'art/palette.json'), 'utf8')).ramps).flat();

/** The pixel finish for a recipe: its kind's default, changed or switched off by the recipe. */
const finishFor = (r) => (img) => {
  const px = r.pixel === false ? null : { ...r.spec.pixel, ...(r.pixel ?? {}) };
  return px?.colors ? pixelate(img, px) : img;
};

/** Style references shrunk to 1024 pixels on their long side: plenty to show a style, at a fraction of the input tokens. */
const loadReferences = (paths) => Promise.all(paths.map(async (p) => ({
  name: basename(p).replace(/\.\w+$/, '.png'),
  data: await sharp(p).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).png().toBuffer(),
})));

async function saveCandidates(r, prefix, { images, usage, cost }, tag) {
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  const name = await nextName(dir, prefix, tag);
  const names = [];
  for (const png of images) { const f = join(dir, name()); await writeFile(f, png); names.push(basename(f, '.png')); console.log(`  ${rel(f)}`); }
  console.log(cost == null ? 'Cost: not reported by the API.' : `Cost: $${cost.toFixed(4)} (${usage.output_tokens ?? '?'} image tokens out, ${usage.input_tokens ?? '?'} tokens in)`);
  if (names.length) console.log(`Pick one with: npm run asset -- pick ${rel(r.file)} ${names[0]}`);
}

async function cmdNew([target], opt) {
  const [scene, name] = (target ?? '').split('/');
  if (!scene || !name) throw new Error('usage: new <scene>/<name> [--kind character]');
  const kind = opt.kind ?? 'prop';
  if (!KINDS[kind]) throw new Error(`kind must be one of ${Object.keys(KINDS).join(', ')}`);
  const file = resolve(ROOT, 'art', scene, `${name}.json`);
  if (existsSync(file)) throw new Error(`${rel(file)} already exists`);
  await mkdir(resolve(ROOT, 'art', scene), { recursive: true });
  await writeFile(file, JSON.stringify(recipeTemplate(name, scene, kind), null, 2) + '\n');
  console.log(`Wrote ${rel(file)}. Fill in the prompt, then: npm run asset -- generate ${rel(file)}`);
}

async function cmdGenerate([file], opt) {
  const r = await loadRecipe(file), size = r.size ?? r.spec.size, n = Number(opt.n ?? 4), quality = opt.quality ?? 'medium';
  const refs = (typeof opt.ref === 'string' ? opt.ref.split(',') : r.references ?? []).map((f) => resolve(ROOT, f.trim()));
  for (const f of refs) if (!existsSync(f)) throw new Error(`no reference image at ${rel(f)}`);
  // references set the rendering themselves, unless a look is asked for on the command line
  const look = typeof opt.look === 'string' ? opt.look : refs.length ? null : r.look ?? 'pixel';
  if (look && !LOOKS[look]) throw new Error(`look must be one of ${Object.keys(LOOKS).join(', ')}`);
  const prompt = (refs.length ? `${REFERENCE_NOTE} ` : '') + generationPrompt(r, look), as = r.exists === 'concierge' ? 'concierge' : 'raw';
  console.log(`${r.name}: ${n} × ${size}, ${quality} quality, ${look ?? 'reference'} look, ${as} view${refs.length ? `, ${refs.length} reference${refs.length > 1 ? 's' : ''}` : ''}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  // with references it goes through the edit endpoint, which takes images; Sunburst follows them most closely
  const background = r.spec.transparent ? 'transparent' : 'opaque';
  const res = refs.length ? await edit({ prompt, images: await loadReferences(refs), size, quality, n, background }) : await generate({ prompt, size, quality, n, background });
  await saveCandidates(r, as, res, opt.tag);
}

async function cmdVariant([file], opt) {
  const r = await loadRecipe(file), src = join(r.dir, 'raw.png');
  if ((r.exists ?? 'both') !== 'both') throw new Error(`${r.name} exists only in ${r.exists} view, so it has no second look`);
  if (!r.concierge) throw new Error(`${r.name} has no "concierge" description, so it looks the same in both views`);
  if (!existsSync(src)) throw new Error(`pick or import a raw image first (${rel(src)})`);
  const prompt = conciergePrompt(r), meta = await sharp(src).metadata(), n = Number(opt.n ?? 2), quality = opt.quality ?? 'medium';
  const size = `${Math.round(meta.width / 16) * 16}x${Math.round(meta.height / 16) * 16}`;
  console.log(`${r.name}: ${n} Concierge variants of ${rel(src)}, ${size}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  await saveCandidates(r, 'concierge', await edit({ prompt, images: [src], size, quality, n, background: r.spec.transparent ? 'transparent' : 'opaque' }), opt.tag);
}

async function cmdPick([file, cand]) {
  const r = await loadRecipe(file), name = (cand ?? '').replace(/\.png$/, ''), src = join(r.dir, 'candidates', `${name}.png`);
  if (!existsSync(src)) throw new Error(`no candidate ${rel(src)}`);
  const as = name.startsWith('concierge') ? 'concierge' : 'raw';
  await copyFile(src, join(r.dir, `${as}.png`));
  console.log(`${r.name}: ${name} is now the ${as} image. Build it with: npm run asset -- build ${rel(r.file)}`);
}

async function cmdImport([file, image], opt) {
  const r = await loadRecipe(file), as = opt.as ?? (r.exists === 'concierge' ? 'concierge' : 'raw');
  if (!image || !existsSync(image)) throw new Error('usage: import <recipe> <image> [--as raw|concierge]');
  await mkdir(r.dir, { recursive: true });
  await sharp(image).ensureAlpha().png().toFile(join(r.dir, `${as}.png`));
  console.log(`${r.name}: imported ${image} as the ${as} image.`);
}

async function updateBenchList(scene, name, kind) {
  const file = resolve(ROOT, 'public/assets', scene, 'bench.json');
  const list = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { assets: [] };
  if (!list.assets.includes(name)) list.assets.push(name);
  list.assets.sort();
  // the bench offers backgrounds as backdrops, with a character in front
  list.backgrounds = (list.backgrounds ?? []).filter((n) => n !== name);
  if (kind === 'background') list.backgrounds.push(name);
  list.backgrounds.sort();
  list.latest = name; // the bench opens the asset built last
  await writeFile(file, JSON.stringify(list, null, 2) + '\n');
}

async function buildOne(file) {
  const r = await loadRecipe(file), spec = r.spec, exists = r.exists ?? 'both', rawPath = join(r.dir, 'raw.png'), concPath = join(r.dir, 'concierge.png');
  // frames drawn with `animate` make an animated sprite
  if (existsSync(join(r.dir, 'anims'))) return assembleOne(r);
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
  const first = raw ?? conc, height = r.height ?? spec.height, strength = r.palette ?? 0.35;
  const box = spec.transparent ? [raw, conc].filter(Boolean).map((img) => contentBox(img)).reduce(unionBox) : { x: 0, y: 0, w: first.w, h: first.h };
  if (r.rig?.joints) return bakeOne(r, raw, conc, box);
  const hexes = await palette();
  const finish = finishFor(r);
  if (raw) raw = finish(paletteFit(hardenAlpha(await fitToHeight(raw, box, height)), hexes, strength));
  if (conc) conc = finish(paletteFit(hardenAlpha(await fitToHeight(conc, box, height)), hexes, strength));

  // volume and material come from the outline of both views together; a generated thing has only its Concierge look
  const shape = raw && conc ? overlay(raw, conc) : raw ?? conc, { w, h } = shape;
  const H = heightMap(shape, { round: spec.round, rh: spec.rh, detail: spec.detail });
  // the view it is not in gets a transparent albedo, so the engine draws nothing there: no shadow, no reflection
  const glowRawSrc = raw;
  if (!raw) raw = blank(w, h);
  if (exists === 'raw') conc = blank(w, h);
  const glow = r.glow ?? {}, out = resolve(ROOT, 'public/assets', r.scene, r.name);
  await mkdir(out, { recursive: true });
  const maps = ['albedo.raw', 'normal', 'material', 'meta'];
  await writePNG(join(out, 'albedo.raw.png'), raw);
  await writePNG(join(out, 'normal.png'), normalMap(H, w, h), { rgb: true });
  await writePNG(join(out, 'material.png'), materialMap(shape, H, r.material ?? spec.material), { rgb: true });
  await writePNG(join(out, 'meta.png'), metaMap(raw, exists === 'both' ? conc : null, {
    occluder: r.occluder ?? spec.occluder, object: r.object ?? 0, depth: r.depth ?? spec.depth, reflectivity: r.reflectivity ?? 0,
    groupRaw: glow.groupRaw ?? 0, groupConcierge: glow.groupConcierge ?? 0, machine: !!glow.machine,
  }), { rgb: true });
  const glowRaw = glow.raw === 'auto' && glowRawSrc ? glowAuto(glowRawSrc) : null;
  if (glowRaw) { await writePNG(join(out, 'glow.raw.png'), glowRaw, { rgb: true }); maps.push('glow.raw'); }
  if (conc) {
    await writePNG(join(out, 'albedo.concierge.png'), conc);
    maps.push('albedo.concierge');
    const gc = exists === 'raw' ? null : (glow.concierge ?? 'auto') === 'auto' ? glowAuto(conc) : glowRaw;
    if (gc) { await writePNG(join(out, 'glow.concierge.png'), gc, { rgb: true }); maps.push('glow.concierge'); }
  }
  const [cx, base] = r.position ?? [480, 464];
  const sprite = {
    name: r.name, x: Math.round(cx - w / 2), y: Math.round(base - h), w, h, maps: maps.sort(),
    depth: r.depth ?? spec.depth, parallax: r.parallax ?? 1, occluder: (r.occluder ?? spec.occluder) ? 1 : 0, reflectivity: r.reflectivity ?? 0, object: r.object ?? 0,
    anchor: [Math.round(w / 2), h], exists, kind: r.kind,
  };
  await writeFile(join(out, 'sprite.json'), JSON.stringify(sprite, null, 2) + '\n');
  // maps an earlier build wrote that this one did not
  for (const f of await readdir(out)) if (f.endsWith('.png') && !maps.includes(f.slice(0, -4))) await rm(join(out, f));
  await updateBenchList(r.scene, r.name, r.kind);
  const match = exists === 'both' && conc ? ` · outline match ${(silhouetteMatch(raw, conc) * 100).toFixed(0)}%` : exists === 'both' ? '' : ` · ${exists} view only`;
  console.log(`${r.name}: ${w}×${h} → ${rel(out)} (${maps.length} maps)${match}`);
}

/**
 * A rigged character: cut into parts at its joints, posed into an idle frame and a walk cycle, each frame shrunk to
 * game size and planted on the ground.
 */
async function bakeOne(r, rawSrc, concSrc, box) {
  const height = r.height ?? r.spec.height, pad = 48;
  const work = async (img) => img && hardenAlpha(await fitToHeight(img, box, height * WORK));
  const { frames, stride } = bake([await work(rawSrc), await work(concSrc)], r.rig.joints, { radii: r.rig.radii, hem: r.rig.hem, pad });
  const views = frames.map((fs) => fs && fs.map((f) => hardenAlpha(shrink(f)))), n = (views[0] ?? views[1]).length;
  for (let k = 0; k < n; k++) {
    const planted = plant(views.filter(Boolean).map((fs) => fs[k]));
    views.filter(Boolean).forEach((fs, v) => { fs[k] = planted[v]; });
  }
  const restW = Math.round((box.w * height) / box.h);
  await writeAnimated(r, views[0], views[1], { anchorX: pad + Math.round(restW / 2), anims: { idle: { from: 0, count: 1 }, walk: { from: 1, count: n - 1, stride: Math.round(stride) } } });
}

/**
 * A character animated frame by frame with `animate`: an idle frame, then the walk. Every frame of both views is
 * cropped and scaled the same way, so the character keeps its size and place, and planted on the ground.
 */
async function assembleOne(r) {
  const height = r.height ?? r.spec.height, dir = join(r.dir, 'anims');
  const load = async (anim, view) => {
    const d = join(dir, anim);
    if (!existsSync(d)) return [];
    const files = (await readdir(d)).filter((f) => f.startsWith(`${view}-`) && f.endsWith('.png')).sort();
    return Promise.all(files.map((f) => readRGBA(join(d, f))));
  };
  // runs in this order, each where it exists: standing and walking facing right, then the same facing left
  const RUNS = ['idle', 'walk', 'idleLeft', 'walkLeft'], views = {};
  for (const v of ['raw', 'concierge']) {
    const runs = {};
    for (const run of RUNS) runs[run] = await load(run, v);
    if (RUNS.some((run) => runs[run].length)) views[v] = runs;
  }
  if (!views.raw && !views.concierge) throw new Error(`${r.name}: no frames in ${rel(dir)} yet; make them with: npm run asset -- animate ${rel(r.file)}`);
  const [a, b] = [views.raw, views.concierge].filter(Boolean);
  if (b && RUNS.some((run) => a[run].length !== b[run].length)) throw new Error(`${r.name}: the raw and Concierge views have different frames; make both the same way`);
  const all = [views.raw, views.concierge].filter(Boolean).flatMap((v) => RUNS.flatMap((run) => v[run]));
  const box = all.map((img) => contentBox(img)).reduce(unionBox), scale = height / box.h;
  const frames = async (v) => v && Promise.all(RUNS.flatMap((run) => v[run]).map(async (img) => plant([hardenAlpha(await fitToHeight(img, box, height))])[0]));
  const stride = existsSync(join(dir, 'walk', 'stride.json')) ? JSON.parse(await readFile(join(dir, 'walk', 'stride.json'), 'utf8')).stride * scale : 0;
  const anims = {};
  let from = 0;
  for (const run of RUNS) {
    const count = a[run].length;
    if (!count) continue;
    anims[run] = run.startsWith('walk') ? { from, count, stride: Math.round(stride) } : { from, count };
    from += count;
  }
  // the anchor: the rig's hip if the frames were baked from parts, else the posed pelvis
  const origin = existsSync(join(dir, 'origin.json')) ? JSON.parse(await readFile(join(dir, 'origin.json'), 'utf8')).x : r.pose?.joints?.pelvis?.[0];
  const anchorX = origin != null ? Math.round((origin - box.x) * scale) : null;
  // timing from the recipe: a loop's frames per second, and the order to play them in, repeats making a frame hold
  for (const [k, extra] of Object.entries(r.anims ?? {})) if (anims[k]) Object.assign(anims[k], extra);
  await writeAnimated(r, await frames(views.raw), await frames(views.concierge), { anchorX, anims });
}

/**
 * Animation frames, game size, into the asset: one set of colours per view across all frames, so nothing flickers;
 * maps derived frame by frame; every map a strip of frames with a transparent gutter between them.
 */
async function writeAnimated(r, raws, concs, { anchorX, anims }) {
  const spec = r.spec, exists = r.exists ?? 'both', hexes = await palette(), strength = r.palette ?? 0.35, G = 2, n = (raws ?? concs).length;
  const px = r.pixel === false ? null : { ...spec.pixel, ...(r.pixel ?? {}) };
  for (const fs of [raws, concs]) if (fs) {
    for (let k = 0; k < n; k++) fs[k] = paletteFit(fs[k], hexes, strength);
    const centres = px?.colors ? fitColours(fs[0], px.colors) : null;
    if (centres) for (const f of fs) pixelate(f, { centres, cleanup: px.cleanup ?? true });
  }
  const { w, h } = (raws ?? concs)[0], glow = r.glow ?? {}, maps = {};
  const add = (name, img) => (maps[name] ??= []).push(img);
  for (let k = 0; k < n; k++) {
    let raw = raws?.[k] ?? null, conc = concs?.[k] ?? null;
    const shape = raw && conc ? overlay(raw, conc) : raw ?? conc, glowRawSrc = raw;
    const H = heightMap(shape, { round: spec.round, rh: spec.rh, detail: spec.detail });
    if (!raw) raw = blank(w, h);
    if (exists === 'raw') conc = blank(w, h);
    add('albedo.raw', raw);
    add('normal', normalMap(H, w, h));
    add('material', materialMap(shape, H, r.material ?? spec.material));
    add('meta', metaMap(raw, exists === 'both' ? conc : null, {
      occluder: r.occluder ?? spec.occluder, object: r.object ?? 0, depth: r.depth ?? spec.depth, reflectivity: r.reflectivity ?? 0,
      groupRaw: glow.groupRaw ?? 0, groupConcierge: glow.groupConcierge ?? 0, machine: !!glow.machine,
    }));
    if (glow.raw === 'auto' && glowRawSrc) add('glow.raw', glowAuto(glowRawSrc));
    if (conc) {
      add('albedo.concierge', conc);
      if (exists !== 'raw' && (glow.concierge ?? 'auto') === 'auto') add('glow.concierge', glowAuto(conc));
    }
  }
  // frames side by side, with a transparent gutter so neighbours never bleed into each other
  const strip = (imgs) => {
    const out = blank(n * w + (n - 1) * G, h);
    imgs.forEach((img, k) => { for (let y = 0; y < h; y++) out.d.set(img.d.subarray(y * w * 4, (y + 1) * w * 4), (y * out.w + k * (w + G)) * 4); });
    return out;
  };
  const out = resolve(ROOT, 'public/assets', r.scene, r.name);
  await mkdir(out, { recursive: true });
  for (const [name, imgs] of Object.entries(maps)) await writePNG(join(out, `${name}.png`), strip(imgs), { rgb: !name.startsWith('albedo') });
  const anchor = [anchorX ?? Math.round(w / 2), h], [cx, base] = r.position ?? [480, 464];
  const sprite = {
    name: r.name, x: cx - anchor[0], y: base - h, w, h, maps: Object.keys(maps).sort(),
    depth: r.depth ?? spec.depth, parallax: r.parallax ?? 1, occluder: (r.occluder ?? spec.occluder) ? 1 : 0, reflectivity: r.reflectivity ?? 0, object: r.object ?? 0,
    anchor, exists, kind: r.kind, frames: { count: n, gutter: G }, anims,
  };
  await writeFile(join(out, 'sprite.json'), JSON.stringify(sprite, null, 2) + '\n');
  for (const f of await readdir(out)) if (f.endsWith('.png') && !sprite.maps.includes(f.slice(0, -4))) await rm(join(out, f));
  await updateBenchList(r.scene, r.name, r.kind);
  console.log(`${r.name}: ${n} frames of ${w}×${h}${anims.walk ? `, walk stride ${anims.walk.stride} px` : ''} → ${rel(out)} (${sprite.maps.length} maps)`);
}

/** Every candidate cleaned and sized as the build would, side by side and feet level, at twice game size. */
async function cmdSheet([file]) {
  const r = await loadRecipe(file), dir = join(r.dir, 'candidates');
  const files = existsSync(dir) ? (await readdir(dir)).filter((f) => /^(raw|concierge)-.*\.png$/.test(f)).sort() : [];
  if (!files.length) throw new Error(`no candidates in ${rel(dir)} yet`);
  const height = r.height ?? r.spec.height, hexes = await palette(), scale = 2, pad = 16, label = 24, tiles = [];
  for (const f of files) {
    const img = await readRGBA(join(dir, f));
    if (r.spec.transparent && isOpaque(img)) removeFlatBackground(img);
    const box = r.spec.transparent ? contentBox(img) : { x: 0, y: 0, w: img.w, h: img.h };
    const s = finishFor(r)(paletteFit(hardenAlpha(await fitToHeight(img, box, height)), hexes, r.palette ?? 0.35));
    const png = await sharp(Buffer.from(s.d.buffer, s.d.byteOffset, s.d.length), { raw: { width: s.w, height: s.h, channels: 4 } }).resize(s.w * scale, s.h * scale, { kernel: 'nearest' }).png().toBuffer();
    tiles.push({ name: f.slice(0, -4), png, w: Math.max(s.w * scale, 150), sw: s.w * scale, h: s.h * scale });
  }
  const W = tiles.reduce((sum, t) => sum + t.w + pad, pad), H = Math.max(...tiles.map((t) => t.h)) + pad * 2 + label, layers = [];
  let x = pad;
  for (const t of tiles) {
    layers.push({ input: t.png, left: x + Math.round((t.w - t.sw) / 2), top: H - pad - label - t.h });
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${t.w}" height="${label}"><text x="${t.w / 2}" y="17" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="13" fill="#b8b2c8">${t.name}</text></svg>`), left: x, top: H - pad - label + 4 });
    x += t.w + pad;
  }
  const out = join(dir, 'sheet.png');
  await sharp({ create: { width: W, height: H, channels: 4, background: '#2a2a33' } }).composite(layers).png().toFile(out);
  console.log(`${r.name}: ${tiles.length} candidates at twice game size → ${rel(out)}`);
}

/**
 * The part of the image sent for a touch-up: the box with room around it, in multiples of 16, at least the API's
 * minimum of 655,360 pixels, no wider than 3:1, and inside the image.
 */
function editWindow(W, H, bx, by, bw, bh) {
  const up16 = (v) => Math.ceil(v / 16) * 16, MIN = 655360;
  let w = up16(bw + 128), h = up16(bh + 128);
  while (w * h < MIN && (w < W || h < H)) { if ((w / h < 1.6 || h >= H) && w < W) w += 16; else h += 16; }
  if (w > 3 * h) h = up16(w / 3);
  if (h > 3 * w) w = up16(h / 3);
  w = Math.min(w, W - (W % 16)); h = Math.min(h, H - (H % 16));
  return { left: Math.max(0, Math.min(W - w, Math.round(bx + bw / 2 - w / 2))), top: Math.max(0, Math.min(H - h, Math.round(by + bh / 2 - h / 2))), width: w, height: h };
}

async function cmdAnimate([file], opt) {
  const r = await loadRecipe(file), anim = opt.anim ?? 'walk', view = opt.view ?? 'raw', quality = opt.quality ?? 'low';
  if (!r.pose?.joints) throw new Error(`${r.name} has no pose.joints to pose a mannequin with`);
  const src = join(r.dir, `${view}.png`);
  if (!existsSync(src)) throw new Error(`no ${view} image at ${rel(src)}`);
  const { w, h } = await sharp(src).metadata().then((m) => ({ w: m.width, h: m.height }));
  const { frames, stride } = poses(anim, r.pose.joints), dir = join(r.dir, 'anims', anim);
  await mkdir(dir, { recursive: true });
  const guides = await Promise.all(frames.map((P) => guide(P, w, h)));
  await Promise.all(guides.map((g, k) => writeFile(join(dir, `guide-${String(k).padStart(2, '0')}.png`), g)));
  await writeFile(join(dir, 'stride.json'), JSON.stringify({ stride }) + '\n');
  console.log(`${r.name}: ${frames.length} ${anim} guides in ${rel(dir)}, stride ${stride.toFixed(0)} px in the source image`);
  const what = anim === 'walk' ? 'walking to the right' : 'standing still, facing right';
  if (opt.dry) return console.log(`\n${animatePrompt(what)}`);
  // one call per frame, all at once; the character goes first, its guide second, both shrunk to save input tokens
  const small = (data) => sharp(data).resize(768, 768, { fit: 'inside' }).png().toBuffer();
  const prompt = animatePrompt(what), base = { name: `${view}.png`, data: await small(await readFile(src)) };
  let total = 0;
  await Promise.all(guides.map(async (g, k) => {
    const res = await edit({ prompt, images: [base, { name: 'guide.png', data: await small(g) }], size: `${w}x${h}`, quality, n: 1, background: 'transparent' });
    await writeFile(join(dir, `${view}-${String(k).padStart(2, '0')}.png`), res.images[0]);
    total += res.cost ?? 0;
  }));
  console.log(`${frames.length} frames in ${rel(dir)} · cost $${total.toFixed(4)}`);
}

async function cmdParts([file], opt) {
  const r = await loadRecipe(file), look = opt.view ?? 'raw', quality = opt.quality ?? 'low', dir = join(r.dir, 'parts');
  // --side left: the character seen from the other side; its parts live under raw-left and concierge-left
  const left = opt.side === 'left', view = left ? `${look}-left` : look;
  await mkdir(join(dir, view), { recursive: true });
  const tpl = await partsTemplate();
  await writeFile(join(dir, 'template.png'), tpl);
  if (opt.preview) return previewParts(r, dir);
  if (opt.bake) return bakeParts(r, dir);
  if (opt.dry) return console.log(`${r.name}: template in ${rel(join(dir, 'template.png'))}\n\n${partsPrompt}`);
  const small = async (buf) => ({ data: await sharp(buf).resize(1024, 1024, { fit: 'inside' }).png().toBuffer() });
  const sheetFile = join(dir, `${view}-sheet.png`);
  let res = { images: [], cost: 0 };
  // --recut cuts the sheet already drawn again, without drawing a new one
  if (opt.recut && existsSync(sheetFile)) res.images.push(await readFile(sheetFile));
  else if (left && look === 'raw') {
    const right = join(dir, 'raw-sheet.png');
    if (!existsSync(right)) throw new Error('make the right-facing raw parts first: the left ones are redrawn from them');
    res = await edit({ prompt: `${otherSidePrompt} ${r.parts?.left?.raw ?? ''}`, images: [right], size: `${SHEET.w}x${SHEET.h}`, quality, n: 1, background: 'transparent' });
  } else if (view === 'raw') {
    const from = join(r.dir, r.parts?.from ?? 'raw.png');
    if (!existsSync(from)) throw new Error(`no image to draw the parts from at ${rel(from)}`);
    res = await edit({ prompt: partsPrompt, images: [{ name: 'character.png', ...(await small(await readFile(from))) }, { name: 'template.png', ...(await small(tpl)) }], size: `${SHEET.w}x${SHEET.h}`, quality, n: 1, background: 'transparent' });
  } else {
    const rawSheet = join(dir, left ? 'raw-left-sheet.png' : 'raw-sheet.png');
    if (!existsSync(rawSheet)) throw new Error('make the raw parts first: they are edited into the Concierge ones');
    if (!r.concierge) throw new Error(`${r.name} has no "concierge" description`);
    res = await edit({ prompt: `${conciergePartsPrompt(r.concierge)} ${left ? r.parts?.left?.concierge ?? '' : ''}`, images: [rawSheet], size: `${SHEET.w}x${SHEET.h}`, quality, n: 1, background: 'transparent' });
  }
  await writeFile(sheetFile, res.images[0]);
  const parts = cutParts(await readRGBA(sheetFile), r.parts?.at ?? null, r.parts?.joints ?? {}, left);
  for (const [name, p] of Object.entries(parts)) await writePNG(join(dir, view, `${name}.png`), p.img);
  const jfile = join(dir, 'parts.json'), all = existsSync(jfile) ? JSON.parse(await readFile(jfile, 'utf8')) : {};
  all[view] = Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, { size: [p.img.w, p.img.h], joints: p.joints }]));
  await writeFile(jfile, JSON.stringify(all, null, 2) + '\n');
  const missing = Object.keys(PARTS_NAMES).filter((n) => !parts[n]);
  console.log(`${r.name}: ${Object.keys(parts).length} parts → ${rel(join(dir, view))}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`);
  console.log(res.cost == null ? 'Cost: not reported by the API.' : `Cost: $${res.cost.toFixed(4)}`);
}

/**
 * The parts posed into a standing frame and the 8-frame walk, written as frames for build to assemble: feet planted,
 * every view the same way. The stride comes from the near foot's travel while it is planted.
 */
async function bakeParts(r, dir) {
  const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), W = 1600, H = 2000, origin = [800, 900];
  const mirror = (img) => { const out = blank(img.w, img.h); for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.d.set(img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4); return out; };
  let stride = 0;
  const done = [];
  for (const side of ['', '-left']) for (const look of ['raw', 'concierge']) {
    const v = look + side;
    if (!existsSync(join(dir, v, 'torso.png'))) continue;
    // a left-facing set is mirrored to face right, walked like the right one, and mirrored back
    const left = side === '-left', parts = {};
    for (const [name, info] of Object.entries(all[v])) {
      const img = await readRGBA(join(dir, v, `${name}.png`));
      parts[name] = left ? { img: mirror(img), joints: Object.fromEntries(Object.entries(info.joints).map(([j, [x, y]]) => [j, [img.w - 1 - x, y]])) } : { img, joints: info.joints };
    }
    const foot = [parts.shin.img.w * 0.55, parts.shin.img.h * 0.97];
    if (v === 'raw') stride = 2 * (pointOf(parts, walkAngles(0), 'legLower', foot, { origin })[0] - pointOf(parts, walkAngles(4), 'legLower', foot, { origin })[0]);
    const write = async (anim, k, angles) => {
      const d = join(r.dir, 'anims', anim + (left ? 'Left' : ''));
      await mkdir(d, { recursive: true });
      const f = plant([posePartsRig(parts, angles, { w: W, h: H, origin })])[0];
      await writePNG(join(d, `${look}-${String(k).padStart(2, '0')}.png`), left ? mirror(f) : f);
    };
    await write('idle', 0, {});
    for (let k = 0; k < 8; k++) await write('walk', k, walkAngles(k));
    done.push(v);
  }
  await writeFile(join(r.dir, 'anims', 'walk', 'stride.json'), JSON.stringify({ stride }) + '\n');
  // where the hip is in every frame, both ways round: the sprite's anchor
  await writeFile(join(r.dir, 'anims', 'origin.json'), JSON.stringify({ x: origin[0] }) + '\n');
  console.log(`${r.name}: a standing frame and 8 walk frames for ${done.join(', ')} → ${rel(join(r.dir, 'anims'))}, stride ${stride.toFixed(0)} px`);
}

/** The parts assembled and walked through the standard cycle, as an animated GIF beside the sheets, for checking. */
async function previewParts(r, dir) {
  const views = ['raw', 'concierge'].filter((v) => existsSync(join(dir, v, 'torso.png')));
  const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), height = r.height ?? r.spec.height, rows = [];
  for (const v of views) {
    const parts = {};
    for (const [name, info] of Object.entries(all[v])) parts[name] = { img: await readRGBA(join(dir, v, `${name}.png`)), joints: info.joints };
    const W = 1600, H = 2000, origin = [800, 900];
    const frames = [{}, ...Array.from({ length: 8 }, (_, k) => walkAngles(k))].map((a) => posePartsRig(parts, a, { w: W, h: H, origin }));
    // feet on one ground line, one crop for all frames, shrunk to game size
    const planted = frames.map((f) => plant([f])[0]), box = planted.map((f) => contentBox(f)).reduce(unionBox);
    rows.push(await Promise.all(planted.map(async (f) => hardenAlpha(await fitToHeight(f, box, height)))));
  }
  const hexes = await palette(), px = { ...r.spec.pixel, ...(r.pixel ?? {}) }, S = 2;
  const pngs = [];
  for (let k = 1; k < rows[0].length; k++) {
    const tiles = await Promise.all(rows.map(async (fs) => {
      const f = paletteFit({ ...fs[k], d: new Uint8ClampedArray(fs[k].d) }, hexes, r.palette ?? 0.35);
      pixelate(f, { colors: px.colors ?? 32, centres: fs.centres ??= fitColours(paletteFit({ ...fs[0], d: new Uint8ClampedArray(fs[0].d) }, hexes, r.palette ?? 0.35), px.colors ?? 32) });
      return sharp(Buffer.from(f.d.buffer, f.d.byteOffset, f.d.length), { raw: { width: f.w, height: f.h, channels: 4 } }).resize(f.w * S, f.h * S, { kernel: 'nearest' }).png().toBuffer();
    }));
    const tw = rows[0][k].w * S, th = rows[0][k].h * S;
    pngs.push(await sharp({ create: { width: (tw + 20) * tiles.length, height: th, channels: 4, background: '#26262e' } }).composite(tiles.map((t, i) => ({ input: t, left: i * (tw + 20), top: 0 }))).png().toBuffer());
  }
  const out = join(dir, 'walk-preview.gif');
  await sharp(pngs, { join: { animated: true } }).gif({ delay: Array(pngs.length).fill(150), loop: 0 }).toFile(out);
  console.log(`${r.name}: walk preview → ${rel(out)}`);
}

async function cmdTouch([file], opt) {
  // --file touches any image of the asset (a parts sheet, say) instead of the picked one, and rebuilds nothing
  const r = await loadRecipe(file), view = opt.view ?? (r.exists === 'concierge' ? 'concierge' : 'raw'), src = typeof opt.file === 'string' ? join(r.dir, opt.file) : join(r.dir, `${view}.png`);
  const box = String(opt.box ?? '').split(',').map(Number);
  if (box.length !== 4 || box.some((v) => !Number.isFinite(v)) || typeof opt.prompt !== 'string') throw new Error('usage: touch <recipe> --box x,y,w,h --prompt "what to change" [--view raw|concierge]');
  if (!existsSync(src)) throw new Error(`no ${view} image at ${rel(src)}`);
  const img = await readRGBA(src), [bx, by] = [Math.max(0, Math.round(box[0])), Math.max(0, Math.round(box[1]))];
  const bw = Math.min(img.w - bx, Math.round(box[2])), bh = Math.min(img.h - by, Math.round(box[3]));
  const win = editWindow(img.w, img.h, bx, by, bw, bh), quality = opt.quality ?? 'medium';
  console.log(`${r.name}: touching ${bw}×${bh} at ${bx},${by} in the ${view} image, sending ${win.width}×${win.height} at ${quality} quality`);
  const prompt = `Change only the transparent area of the mask: ${opt.prompt}. Everything else stays exactly as it is; match the style, colours, lighting and detail around it.${r.spec.transparent ? ' Keep the flat, plain background colour around the subject exactly as it is.' : ''}`;
  if (opt.dry) return console.log(`\n${prompt}`);
  // the window, and a mask that is transparent over the box. Cut-out art goes on a key colour (--key, default green):
  // the model keeps it as the background, and it is keyed out again afterwards
  const key = r.spec.transparent ? (typeof opt.key === 'string' ? opt.key : '#00ff00') : null;
  const piece = await (key ? sharp(src).extract(win).flatten({ background: key }) : sharp(src).extract(win)).png().toBuffer();
  const m = Buffer.alloc(win.width * win.height * 4, 255);
  for (let y = by - win.top; y < by - win.top + bh; y++) for (let x = bx - win.left; x < bx - win.left + bw; x++) m[(y * win.width + x) * 4 + 3] = 0;
  const mask = await sharp(m, { raw: { width: win.width, height: win.height, channels: 4 } }).png().toBuffer();
  const res = await edit({ prompt, images: [{ name: 'piece.png', data: piece }], mask, size: `${win.width}x${win.height}`, quality, n: 1, background: r.spec.transparent ? 'transparent' : 'opaque' });
  if (!res.images.length) throw new Error('the API returned no image');
  const { data } = await sharp(res.images[0]).resize(win.width, win.height, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // cut-out art stays cut out: the key colour, and anything near it, becomes transparent again
  if (key) {
    const k = parseInt(key.slice(1), 16), kr = k >> 16, kg = (k >> 8) & 255, kb = k & 255;
    for (let i = 0; i < data.length; i += 4) if (Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb) < 110) data[i + 3] = 0;
  }
  // only the box comes back, blended over its last 6 pixels so no seam shows
  const out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) }, feather = 6;
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    const k = Math.min(1, (Math.min(x - bx, bx + bw - 1 - x, y - by, by + bh - 1 - y) + 1) / feather), i = (y * img.w + x) * 4, j = ((y - win.top) * win.width + (x - win.left)) * 4;
    for (let c = 0; c < 4; c++) out.d[i + c] = img.d[i + c] * (1 - k) + data[j + c] * k;
  }
  const spent = res.cost == null ? 'Cost: not reported by the API.' : `Cost: $${res.cost.toFixed(4)} (${res.usage.output_tokens ?? '?'} image tokens out, ${res.usage.input_tokens ?? '?'} tokens in)`;
  if (typeof opt.frame === 'string') {
    // an animation frame: the picked image is frame 0, and this one differs only inside the box
    const [anim, num] = opt.frame.split('/'), adir = join(r.dir, 'anims', anim), name = (k) => join(adir, `${view}-${String(k).padStart(2, '0')}.png`);
    await mkdir(adir, { recursive: true });
    if (!existsSync(name(0))) await copyFile(src, name(0));
    await writePNG(name(Number(num)), out);
    return console.log(`  ${rel(name(Number(num)))}\n${spent}`);
  }
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  const keep = join(dir, (await nextName(dir, `${basename(src, '.png')}-before-touch`))());
  await copyFile(src, keep);
  await writePNG(src, out);
  console.log(`  ${rel(src)} (the old one is ${rel(keep)})\n${spent}`);
  if (typeof opt.file !== 'string') await buildOne(file);
}

const [cmd, ...rest] = process.argv.slice(2), { pos, opt } = parse(rest);
const run = { new: cmdNew, generate: cmdGenerate, variant: cmdVariant, pick: cmdPick, import: cmdImport, sheet: cmdSheet, touch: cmdTouch, animate: cmdAnimate, parts: cmdParts, build: async (files) => { if (!files.length) throw new Error('usage: build <recipe> [more...]'); for (const f of files) await buildOne(f); } }[cmd];
if (!run) console.log(HELP);
else run(pos, opt).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
