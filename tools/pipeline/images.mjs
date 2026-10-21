// Making and changing pictures with the image model: generating candidates, the Concierge's variants, re-dressing,
// extending and reframing, touching up areas; picking, importing, erasing and laying candidates side by side.

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import sharp from 'sharp';
import { buildOne } from './build.mjs';
import { cleanEdges, contentBox, fitToHeight, hardenAlpha, isOpaque, paletteFit, removeFlatBackground } from './clean.mjs';
import { readRGBA, writePNG } from './image.mjs';
import { edit, generate } from './openai.mjs';
import { KINDS, loadRecipe, recipeTemplate, ROOT } from './recipe.mjs';
import { finishFor, nextName, palette, rel } from './shared.mjs';
import { CHARACTER_REDRESS_NOTE, CHARACTER_SHEET_NOTE, conciergePrompt, extendPrompt, generationPrompt, LAYOUT_REFERENCES_NOTE, layoutNote, LOOKS, REDRESS_REFERENCES_NOTE, redressPrompt, REFERENCE_NOTE, REFERENCE_NOTE_VECTOR, reframePrompt, VARIANT_REFERENCES_NOTE } from './style.mjs';

/** Style references shrunk to 1024 pixels on their long side: plenty to show a style, at a fraction of the input tokens. */
export const loadReferences = (paths) => Promise.all(paths.map(async (p) => ({
  name: basename(p).replace(/\.\w+$/, '.png'),
  data: await sharp(p).resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).png().toBuffer(),
})));

export async function saveCandidates(r, prefix, { images, usage, cost }, tag) {
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  const name = await nextName(dir, prefix, tag);
  const names = [];
  for (const png of images) { const f = join(dir, name()); await writeFile(f, png); names.push(basename(f, '.png')); console.log(`  ${rel(f)}`); }
  console.log(cost == null ? 'Cost: not reported by the API.' : `Cost: $${cost.toFixed(4)} (${usage.output_tokens ?? '?'} image tokens out, ${usage.input_tokens ?? '?'} tokens in)`);
  if (names.length) console.log(`Pick one with: npm run asset -- pick ${rel(r.file)} ${names[0]}`);
}

export async function cmdNew([target], opt) {
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

export async function cmdGenerate([file], opt) {
  const r = await loadRecipe(file), size = r.size ?? r.spec.size, n = Number(opt.n ?? 4), quality = opt.quality ?? 'medium';
  // the Concierge's view of something real is drawn first when it is the picture to match, as the main street was
  const as = r.exists === 'concierge' || opt.view === 'concierge' ? 'concierge' : 'raw';
  if (as === 'concierge' && r.exists !== 'concierge' && !r.concierge) throw new Error(`${r.name} has no "concierge" description to draw its Concierge view from`);
  const refs = (typeof opt.ref === 'string' ? opt.ref.split(',') : (as === 'concierge' && r.exists !== 'concierge' ? r.conciergeReferences : null) ?? r.references ?? []).map((f) => resolve(ROOT, f.trim()));
  const layout = typeof opt.layout === 'string' ? resolve(ROOT, opt.layout) : null;
  for (const f of [...refs, ...(layout ? [layout] : [])]) if (!existsSync(f)) throw new Error(`no image at ${rel(f)}`);
  // references set the rendering themselves, unless a look is asked for, on the command line or in the recipe
  const look = typeof opt.look === 'string' ? opt.look : r.look ?? (refs.length ? null : 'pixel');
  if (look && !LOOKS[look]) throw new Error(`look must be one of ${Object.keys(LOOKS).join(', ')}`);
  const refNote = r.referenceNote === 'character' ? CHARACTER_SHEET_NOTE : look === 'vector' ? REFERENCE_NOTE_VECTOR : REFERENCE_NOTE;
  const notes = layout ? `${layoutNote(look)} ${refs.length ? `${LAYOUT_REFERENCES_NOTE} ` : ''}` : refs.length ? `${refNote} ` : '';
  const prompt = notes + generationPrompt(r, look, as);
  console.log(`${r.name}: ${n} × ${size}, ${quality} quality, ${look ?? 'reference'} look, ${as} view${layout ? `, laid out like ${rel(layout)}` : ''}${refs.length ? `, ${refs.length} reference${refs.length > 1 ? 's' : ''}` : ''}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  // with images it goes through the edit endpoint, which takes them; Sunburst follows them most closely. The layout goes first
  const background = r.spec.transparent ? 'transparent' : 'opaque', images = [...(layout ? [layout] : []), ...refs];
  const res = images.length ? await edit({ prompt, images: await loadReferences(images), size, quality, n, background }) : await generate({ prompt, size, quality, n, background });
  await saveCandidates(r, as, res, opt.tag);
}

export async function cmdVariant([file], opt) {
  const r = await loadRecipe(file), src = join(r.dir, 'raw.png');
  if ((r.exists ?? 'both') !== 'both') throw new Error(`${r.name} exists only in ${r.exists} view, so it has no second look`);
  if (!r.concierge) throw new Error(`${r.name} has no "concierge" description, so it looks the same in both views`);
  if (!existsSync(src)) throw new Error(`pick or import a raw image first (${rel(src)})`);
  // the augmented view's own references, if any, show its look
  const refs = (typeof opt.ref === 'string' ? opt.ref.split(',') : r.conciergeReferences ?? []).map((f) => resolve(ROOT, f.trim()));
  for (const f of refs) if (!existsSync(f)) throw new Error(`no image at ${rel(f)}`);
  const prompt = (refs.length ? `${VARIANT_REFERENCES_NOTE} ` : '') + conciergePrompt(r), meta = await sharp(src).metadata(), n = Number(opt.n ?? 2), quality = opt.quality ?? 'medium';
  const size = `${Math.round(meta.width / 16) * 16}x${Math.round(meta.height / 16) * 16}`;
  console.log(`${r.name}: ${n} Concierge variants of ${rel(src)}, ${size}${refs.length ? `, ${refs.length} reference${refs.length > 1 ? 's' : ''}` : ''}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  await saveCandidates(r, 'concierge', await edit({ prompt, images: [src, ...(await loadReferences(refs))], size, quality, n, background: r.spec.transparent ? 'transparent' : 'opaque' }), opt.tag);
}

export async function cmdRedress([file], opt) {
  const r = await loadRecipe(file), view = opt.view ?? (r.exists === 'concierge' ? 'concierge' : 'raw');
  const src = typeof opt.from === 'string' ? resolve(ROOT, opt.from) : join(r.dir, `${view}.png`);
  if (typeof opt.prompt !== 'string') throw new Error('usage: redress <recipe> --prompt "what to change" [--view raw|concierge] [--from image] [--ref a.png,b.png]');
  if (!existsSync(src)) throw new Error(`pick or import a ${view} image first (${rel(src)})`);
  const refs = typeof opt.ref === 'string' ? opt.ref.split(',').map((f) => resolve(ROOT, f.trim())) : [];
  for (const f of refs) if (!existsSync(f)) throw new Error(`no image at ${rel(f)}`);
  const prompt = (refs.length ? `${r.referenceNote === 'character' ? CHARACTER_REDRESS_NOTE : REDRESS_REFERENCES_NOTE} ` : '') + redressPrompt(r, view, opt.prompt), meta = await sharp(src).metadata(), n = Number(opt.n ?? 2), quality = opt.quality ?? 'medium';
  const size = `${Math.round(meta.width / 16) * 16}x${Math.round(meta.height / 16) * 16}`;
  console.log(`${r.name}: ${n} re-dressed ${view} candidates of ${rel(src)}, ${size}${refs.length ? `, ${refs.length} reference${refs.length > 1 ? 's' : ''}` : ''}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  await saveCandidates(r, view, await edit({ prompt, images: [src, ...(await loadReferences(refs))], size, quality, n, background: r.spec.transparent ? 'transparent' : 'opaque' }), opt.tag ?? 'redress');
}

/**
 * Place a picture in the recipe's frame and have the rest painted around it: a concept panel wider than the screen
 * becomes a full background. --box x,y,w says where it goes, in the frame's pixels; its height follows its shape.
 */
export async function cmdExtend([file], opt) {
  const r = await loadRecipe(file), view = opt.view ?? (r.exists === 'concierge' ? 'concierge' : 'raw'), quality = opt.quality ?? 'medium';
  const src = typeof opt.from === 'string' ? resolve(ROOT, opt.from) : null;
  const [W, H] = (r.size ?? r.spec.size).split('x').map(Number);
  const [left, top, w] = typeof opt.box === 'string' ? opt.box.split(',').map(Number) : [];
  if (!src || !existsSync(src) || !(w > 0)) throw new Error('usage: extend <recipe> --from <image> --box x,y,width [--view raw|concierge] [--n 2]');
  const meta = await sharp(src).metadata(), h = Math.round((meta.height * w) / meta.width), edge = 16;
  const small = await sharp(src).resize(w, h, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  // around it, a blur of the picture stretched over the whole frame, so the model has colours to continue from
  const frame = Buffer.from(await sharp(src).resize(W, H, { fit: 'fill' }).blur(40).removeAlpha().raw().toBuffer());
  for (let y = 0; y < h; y++) if (top + y >= 0 && top + y < H) small.copy(frame, ((top + y) * W + left) * 3, y * w * 3, (y + 1) * w * 3);
  const inside = (x, y) => x - left >= 0 && x - left < w && y - top >= 0 && y - top < h;
  const depth = (x, y) => Math.min(x - left + edge, left + w - 1 - x + edge, y - top, top + h - 1 - y);
  const m = Buffer.alloc(W * H * 4, 255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inside(x, y) || depth(x, y) < edge) m[(y * W + x) * 4 + 3] = 0;
  const prompt = extendPrompt(r, view), n = Number(opt.n ?? 2);
  console.log(`${r.name}: ${rel(src)} at ${left},${top} ${w}×${h} in ${W}×${H}, the rest painted, ${n} ${view} candidates`);
  if (opt.dry) return console.log(`\n${prompt}`);
  const res = await edit({ prompt, images: [{ name: 'frame.png', data: await sharp(frame, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer() }], mask: await sharp(m, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), size: `${W}x${H}`, quality, n, background: 'opaque' });
  // the picture goes back over what was painted, blended into it over its top and bottom edge
  const images = [];
  for (const png of res.images) {
    const { data } = await sharp(png).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const X = left + x, Y = top + y;
      if (Y < 0 || Y >= H) continue;
      const k = Math.min(1, Math.max(0, Math.min(y, h - 1 - y) / edge)), i = (Y * W + X) * 3, j = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - k) + small[j + c] * k);
    }
    images.push(await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer());
  }
  await saveCandidates(r, view, { ...res, images }, opt.tag ?? 'extend');
}

export async function cmdReframe([file], opt) {
  const r = await loadRecipe(file), view = opt.view ?? (r.exists === 'concierge' ? 'concierge' : 'raw'), src = join(r.dir, `${view}.png`);
  const s = Number(opt.scale), floor = Number(opt.floor), quality = opt.quality ?? 'medium';
  if (!(s > 0.3 && s < 1) || !Number.isFinite(floor)) throw new Error('usage: reframe <recipe> --scale 0.8 --floor <y of the floor line, in the image>');
  if (!existsSync(src)) throw new Error(`no ${view} image at ${rel(src)}`);
  const { width: W, height: H } = await sharp(src).metadata();
  // the picture shrinks around the floor line, which stays where it was; the rest of the frame is new
  const w = Math.round(W * s), h = Math.round(H * s), left = Math.round((W - w) / 2), top = Math.round(floor * (1 - s)), edge = 14;
  const small = await sharp(src).resize(w, h, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer();
  // around it, a blur of the whole picture, so the model has colours to continue from
  const frame = Buffer.from(await sharp(src).resize(W, H).blur(30).removeAlpha().raw().toBuffer());
  for (let y = 0; y < h; y++) small.copy(frame, ((top + y) * W + left) * 3, y * w * 3, (y + 1) * w * 3);
  // the mask is transparent outside the picture and over its last few pixels, where old and new are blended
  const inside = (x, y) => x - left >= 0 && x - left < w && y - top >= 0 && y - top < h;
  const depth = (x, y) => Math.min(x - left, left + w - 1 - x, y - top, top + h - 1 - y);
  const m = Buffer.alloc(W * H * 4, 255);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inside(x, y) || depth(x, y) < edge) m[(y * W + x) * 4 + 3] = 0;
  const prompt = reframePrompt(r, view);
  console.log(`${r.name}: ${view} image shrunk to ${(s * 100).toFixed(0)}% around y ${floor}, new edges painted at ${quality} quality`);
  if (opt.dry) return console.log(`\n${prompt}`);
  const res = await edit({ prompt, images: [{ name: 'frame.png', data: await sharp(frame, { raw: { width: W, height: H, channels: 3 } }).png().toBuffer() }], mask: await sharp(m, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), size: `${W}x${H}`, quality, n: 1, background: 'opaque' });
  if (!res.images.length) throw new Error('the API returned no image');
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, (await nextName(dir, `${view}-reframe-output`))()), res.images[0]);
  // the shrunk picture goes back over what the model drew, blended into it over its edge
  const { data } = await sharp(res.images[0]).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = left + x, Y = top + y, k = Math.min(1, depth(X, Y) / edge), i = (Y * W + X) * 3, j = (y * w + x) * 3;
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(data[i + c] * (1 - k) + small[j + c] * k);
  }
  const name = (await nextName(dir, view, 'reframe'))(), out = join(dir, name);
  await sharp(data, { raw: { width: W, height: H, channels: 3 } }).png().toFile(out);
  const spent = res.cost == null ? 'Cost: not reported by the API.' : `Cost: $${res.cost.toFixed(4)}`;
  console.log(`  ${rel(out)}\n${spent}\nIn the scene, a point x, y of the old picture is now at ${(left / W).toFixed(4)} × width + ${s} x, ${(top / H).toFixed(4)} × height + ${s} y.`);
  console.log(`Pick it with: npm run asset -- pick ${rel(r.file)} ${basename(name, '.png')}`);
}

export async function cmdPick([file, cand]) {
  const r = await loadRecipe(file), name = (cand ?? '').replace(/\.png$/, ''), src = join(r.dir, 'candidates', `${name}.png`);
  if (!existsSync(src)) throw new Error(`no candidate ${rel(src)}`);
  const as = name.startsWith('concierge') ? 'concierge' : 'raw';
  await copyFile(src, join(r.dir, `${as}.png`));
  console.log(`${r.name}: ${name} is now the ${as} image. Build it with: npm run asset -- build ${rel(r.file)}`);
}

export async function cmdImport([file, image], opt) {
  const r = await loadRecipe(file), as = opt.as ?? (r.exists === 'concierge' ? 'concierge' : 'raw');
  if (!image || !existsSync(image)) throw new Error('usage: import <recipe> <image> [--as raw|concierge]');
  await mkdir(r.dir, { recursive: true });
  await sharp(image).ensureAlpha().png().toFile(join(r.dir, `${as}.png`));
  console.log(`${r.name}: imported ${image} as the ${as} image.`);
}

/** Every candidate cleaned and sized as the build would, side by side and feet level, at twice game size. */
export async function cmdSheet([file]) {
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
export function editWindow(W, H, bx, by, bw, bh) {
  const up16 = (v) => Math.ceil(v / 16) * 16, MIN = 655360;
  let w = up16(bw + 128), h = up16(bh + 128);
  while (w * h < MIN && (w < W || h < H)) { if ((w / h < 1.6 || h >= H) && w < W) w += 16; else h += 16; }
  if (w > 3 * h) h = up16(w / 3);
  if (h > 3 * w) w = up16(h / 3);
  w = Math.min(w, W - (W % 16)); h = Math.min(h, H - (H % 16));
  return { left: Math.max(0, Math.min(W - w, Math.round(bx + bw / 2 - w / 2))), top: Math.max(0, Math.min(H - h, Math.round(by + bh / 2 - h / 2))), width: w, height: h };
}

/**
 * Paint an area of an image in the colour of another, keeping its own light and shade: a piece in its garment's fabric,
 * such as a robe's thighs, so the robe reads closed as she walks. With --skin only skin is painted, such as an arm the
 * image model drew onto a torso, which the rig's own arm already is. Free; the old image is kept.
 */
export async function cmdPaint([file], opt) {
  const r = await loadRecipe(file), src = typeof opt.file === 'string' ? join(r.dir, opt.file) : null;
  const rect = (s) => { const b = String(s ?? '').split(',').map(Number); return b.length === 4 && b.every(Number.isFinite) ? b : null; };
  const box = rect(opt.box), like = rect(opt.like);
  if (!src || !existsSync(src) || !box || !like) throw new Error('usage: paint <recipe> --file <image in the asset folder> --box x,y,w,h --like x,y,w,h [--skin]');
  const img = await readRGBA(src), { w, d } = img, at = (x, y) => (y * w + x) * 4;
  const lum = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  // skin: warm, red over green over blue, the way her skin is drawn in either view
  const skin = (i) => d[i + 3] > 100 && d[i] > d[i + 1] && d[i + 1] >= d[i + 2] - 4 && d[i] - d[i + 2] > 20;
  const within = ([x0, y0, bw, bh], f) => { for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) f(at(x, y)); };
  // the colour to paint: what is not skin in the area it is taken from; the light and shade: the painted pixels' own
  let n = 0, m = 0, ml = 0;
  const c = [0, 0, 0];
  within(like, (i) => { if (d[i + 3] > 200 && !skin(i)) { n++; for (let k = 0; k < 3; k++) c[k] += d[i + k]; } });
  if (!n) throw new Error(`nothing to take a colour from at ${opt.like}`);
  const paint = (i) => d[i + 3] > 100 && (!opt.skin || skin(i));
  within(box, (i) => { if (paint(i)) { m++; ml += lum(i); } });
  if (!m) return console.log(`${r.name}: nothing to paint in ${opt.box}`);
  ml /= m;
  within(box, (i) => {
    if (!paint(i)) return;
    const k = Math.max(0.7, Math.min(1.2, lum(i) / ml));
    for (let j = 0; j < 3; j++) d[i + j] = Math.round(Math.min(255, (c[j] / n) * k));
  });
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  const keep = join(dir, (await nextName(dir, `${basename(src, '.png')}-before-paint`))());
  await copyFile(src, keep);
  await writePNG(src, img);
  console.log(`${r.name}: painted ${m} pixels in ${rel(src)} as rgb(${c.map((v) => Math.round(v / n)).join(',')}) (the old one is ${rel(keep)})`);
}

/** Make everything inside a polygon transparent: clearing stray bits off cut-out art, by hand and for free. */
export async function cmdErase([file], opt) {
  const r = await loadRecipe(file), src = typeof opt.file === 'string' ? join(r.dir, opt.file) : null;
  const pts = String(opt.poly ?? '').trim().split(/\s+/).map((p) => p.split(',').map(Number));
  if (!src || pts.length < 3 || pts.some((p) => p.length !== 2 || p.some((v) => !Number.isFinite(v)))) throw new Error('usage: erase <recipe> --file <image in the asset folder> --poly "x,y x,y x,y ..."');
  const img = await readRGBA(src);
  const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  let n = 0;
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(img.h - 1, Math.ceil(Math.max(...ys))); y++) for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(img.w - 1, Math.ceil(Math.max(...xs))); x++) {
    const i = (y * img.w + x) * 4;
    if (img.d[i + 3] && inside(x + 0.5, y + 0.5)) { img.d[i + 3] = 0; n++; }
  }
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  const keep = join(dir, (await nextName(dir, `${basename(src, '.png')}-before-erase`))());
  await copyFile(src, keep);
  await writePNG(src, img);
  console.log(`${r.name}: erased ${n} pixels in ${rel(src)} (the old one is ${rel(keep)})`);
}

export async function cmdTouch([file], opt) {
  // --file touches any image of the asset (a parts sheet, say) instead of the picked one, and rebuilds nothing
  const r = await loadRecipe(file), view = opt.view ?? (r.exists === 'concierge' ? 'concierge' : 'raw'), src = typeof opt.file === 'string' ? join(r.dir, opt.file) : join(r.dir, `${view}.png`);
  // --box takes several areas, "x,y,w,h;x,y,w,h", repainted together; --keep areas inside them stay exactly as they are
  const parseBoxes = (s) => String(s ?? '').split(';').filter(Boolean).map((b) => b.split(',').map(Number));
  const boxes = parseBoxes(opt.box), keeps = parseBoxes(opt.keep);
  if (!boxes.length || [...boxes, ...keeps].some((b) => b.length !== 4 || b.some((v) => !Number.isFinite(v))) || typeof opt.prompt !== 'string') throw new Error('usage: touch <recipe> --box x,y,w,h[;x,y,w,h] [--keep x,y,w,h[;...]] --prompt "what to change" [--view raw|concierge]');
  if (!existsSync(src)) throw new Error(`no ${view} image at ${rel(src)}`);
  const img = await readRGBA(src), feather = 6;
  const clampBox = ([x, y, w, h]) => { const bx = Math.max(0, Math.round(x)), by = Math.max(0, Math.round(y)); return [bx, by, Math.min(img.w - bx, Math.round(w)), Math.min(img.h - by, Math.round(h))]; };
  const areas = boxes.map(clampBox), kept = keeps.map(clampBox);
  const ux0 = Math.min(...areas.map((b) => b[0])), uy0 = Math.min(...areas.map((b) => b[1]));
  const ux1 = Math.max(...areas.map((b) => b[0] + b[2])), uy1 = Math.max(...areas.map((b) => b[1] + b[3]));
  // how much of the new picture a pixel takes: 1 inside the areas, fading out over their last pixels towards the
  // outside and towards kept areas. The fade follows the outline of all areas together, so areas that touch blend as one.
  const bx = ux0, by = uy0, bw = ux1 - ux0, bh = uy1 - uy0, ox = bx - 1, oy = by - 1, OW = bw + 2, OH = bh + 2;
  const within = (x, y) => areas.some(([ax, ay, aw, ah]) => x >= ax && x < ax + aw && y >= ay && y < ay + ah) && !kept.some(([kx, ky, kw, kh]) => x >= kx && x < kx + kw && y >= ky && y < ky + kh);
  const D = new Float32Array(OW * OH);
  for (let y = 0; y < OH; y++) for (let x = 0; x < OW; x++) D[y * OW + x] = within(ox + x, oy + y) ? 1e9 : 0;
  for (let y = 1; y < OH; y++) for (let x = 1; x < OW - 1; x++) { const i = y * OW + x; if (D[i]) D[i] = Math.min(D[i], D[i - 1] + 1, D[i - OW] + 1, D[i - OW - 1] + 1.414, D[i - OW + 1] + 1.414); }
  for (let y = OH - 2; y >= 0; y--) for (let x = OW - 2; x >= 1; x--) { const i = y * OW + x; if (D[i]) D[i] = Math.min(D[i], D[i + 1] + 1, D[i + OW] + 1, D[i + OW + 1] + 1.414, D[i + OW - 1] + 1.414); }
  const weight = (x, y) => { const d = D[(y - oy) * OW + (x - ox)]; return d ? Math.min(1, d / feather) : 0; };
  const win = editWindow(img.w, img.h, bx, by, bw, bh), quality = opt.quality ?? 'medium';
  console.log(`${r.name}: touching ${areas.length > 1 ? `${areas.length} areas within ` : ''}${bw}×${bh} at ${bx},${by}${kept.length ? `, keeping ${kept.length}` : ''}, sending ${win.width}×${win.height} at ${quality} quality`);
  // --from concierge|raw: the area redrawn from the other view's picture as this view, outlines in place, this view's
  // picture the style to match, after the other view was changed there: so the two views still line up
  const from = typeof opt.from === 'string' ? opt.from : null, fromFile = from ? join(r.dir, `${from}.png`) : null;
  if (from && (from === view || !existsSync(fromFile))) throw new Error(`--from needs the other view's picture (${from})`);
  const prompt = from
    ? `${REDRESS_REFERENCES_NOTE} ${redressPrompt(r, view, `Repaint it as ${view} view, as simple and flat as it is now: ${opt.prompt}`)}`
    : `Change only the transparent area of the mask: ${opt.prompt}. Everything else stays exactly as it is; match the style, colours, lighting and detail around it.${r.spec.transparent ? ' Keep the flat, plain background colour around the subject exactly as it is.' : ''}`;
  if (opt.dry) return console.log(`\n${prompt}`);
  // the window, and a mask that is transparent over the box. Cut-out art goes on a key colour (--key, default green):
  // the model keeps it as the background, and it is keyed out again afterwards
  const key = r.spec.transparent ? (typeof opt.key === 'string' ? opt.key : '#00ff00') : null;
  const piece = await (key ? sharp(fromFile ?? src).extract(win).flatten({ background: key }) : sharp(fromFile ?? src).extract(win)).png().toBuffer();
  const m = Buffer.alloc(win.width * win.height * 4, 255);
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (weight(x, y) > 0) m[((y - win.top) * win.width + (x - win.left)) * 4 + 3] = 0;
  const mask = await sharp(m, { raw: { width: win.width, height: win.height, channels: 4 } }).png().toBuffer();
  // redrawn from the other view: the whole window, with this view's picture as the style
  const refs = from ? [{ name: `${view}.png`, data: await sharp(src).resize(1024, 1024, { fit: 'inside' }).png().toBuffer() }] : [];
  const res = await edit({ prompt, images: [{ name: 'piece.png', data: piece }, ...refs], mask: from ? undefined : mask, size: `${win.width}x${win.height}`, quality, n: 1, background: r.spec.transparent ? 'transparent' : 'opaque' });
  if (!res.images.length) throw new Error('the API returned no image');
  // keep what the model drew, before it is pasted back, to see what went wrong when a touch-up fails
  await mkdir(join(r.dir, 'candidates'), { recursive: true });
  await writeFile(join(r.dir, 'candidates', (await nextName(join(r.dir, 'candidates'), `${basename(src, '.png')}-touch-output`))()), res.images[0]);
  const { data } = await sharp(res.images[0]).resize(win.width, win.height, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // cut-out art stays cut out: the key colour, and anything near it, becomes transparent again
  if (key) {
    const k = parseInt(key.slice(1), 16), kr = k >> 16, kg = (k >> 8) & 255, kb = k & 255;
    for (let i = 0; i < data.length; i += 4) if (Math.hypot(data[i] - kr, data[i + 1] - kg, data[i + 2] - kb) < 110) data[i + 3] = 0;
  }
  // only the areas come back, blended over their edges so no seam shows
  const out = { w: img.w, h: img.h, d: new Uint8ClampedArray(img.d) };
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) {
    const k = weight(x, y);
    if (k <= 0) continue;
    const i = (y * img.w + x) * 4, j = ((y - win.top) * win.width + (x - win.left)) * 4;
    for (let c = 0; c < 4; c++) out.d[i + c] = img.d[i + c] * (1 - k) + data[j + c] * k;
  }
  // --clean sets how close to the key colour an edge pixel must be to go: lower keeps more of colours near the key
  if (key) cleanEdges(out, [Math.max(0, bx - 2), Math.max(0, by - 2), Math.min(img.w, bx + bw + 2), Math.min(img.h, by + bh + 2)], key, { near: Number(opt.clean ?? 190) });
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
