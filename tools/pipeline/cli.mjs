#!/usr/bin/env node
// The asset pipeline. Run `npm run asset -- help` for the commands.

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { contentBox, fitToHeight, hardenAlpha, isOpaque, overlay, paletteFit, pixelate, removeFlatBackground, silhouetteMatch, unionBox } from './clean.mjs';
import { glowAuto, heightMap, materialMap, metaMap, normalMap } from './derive.mjs';
import { blank, readRGBA, writePNG } from './image.mjs';
import { edit, generate } from './openai.mjs';
import { KINDS, ROOT, loadRecipe, recipeTemplate } from './recipe.mjs';
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
      Lay all candidates side by side at game size, to choose between them.
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
  const res = refs.length ? await edit({ prompt, images: refs, size, quality, n, background }) : await generate({ prompt, size, quality, n, background });
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
  const hexes = await palette();
  const finish = (img) => (r.pixel?.colors ? pixelate(img, r.pixel) : img);
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
    const s = paletteFit(hardenAlpha(await fitToHeight(img, box, height)), hexes, r.palette ?? 0.35);
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

const [cmd, ...rest] = process.argv.slice(2), { pos, opt } = parse(rest);
const run = { new: cmdNew, generate: cmdGenerate, variant: cmdVariant, pick: cmdPick, import: cmdImport, sheet: cmdSheet, build: async (files) => { if (!files.length) throw new Error('usage: build <recipe> [more...]'); for (const f of files) await buildOne(f); } }[cmd];
if (!run) console.log(HELP);
else run(pos, opt).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
