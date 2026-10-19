#!/usr/bin/env node
// The asset pipeline. Run `npm run asset -- help` for the commands.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { bleedEdges, cleanEdges, contentBox, fillHoles, fitColours, fitToHeight, hardenAlpha, isOpaque, paletteFit, pixelate, removeFlatBackground, silhouetteMatch, unionBox } from './clean.mjs';
import { glowAuto, heightMap, materialMap, metaMap, normalMap } from './derive.mjs';
import { blank, crop, readRGBA, resize, writePNG } from './image.mjs';
import { edit, generate } from './openai.mjs';
import { KINDS, ROOT, loadRecipe, recipeTemplate } from './recipe.mjs';
import { blockoutPNG, camera as roomCamera } from './blockout.mjs';
import { conciergePartsPrompt, cut as cutParts, otherSidePrompt, PARTS as PARTS_NAMES, partsPrompt, plant, pointOf, pose as posePartsRig, SHEET, standPose, template as partsTemplate, walkAngles, walkCycle } from './parts.mjs';
import { conciergePrompt, extendPrompt, generationPrompt, LAYOUT_REFERENCES_NOTE, layoutNote, LOOKS, REDRESS_REFERENCES_NOTE, redressPrompt, reframePrompt, REFERENCE_NOTE, REFERENCE_NOTE_VECTOR, VARIANT_REFERENCES_NOTE } from './style.mjs';

try { process.loadEnvFile(resolve(ROOT, '.env.local')); } catch { /* no .env.local: fine until an API call needs the key */ }

const HELP = `Asset pipeline: generate art with an image AI, clean it and turn it into game sprites.

  npm run asset -- new <scene>/<name> [--kind character|prop|background|portrait]
      Write a recipe to art/<scene>/<name>.json to fill in.
  npm run asset -- generate <recipe> [--n 4] [--quality low|medium|high] [--look pixel|paint|vector] [--ref a.png,b.png] [--layout guide.png] [--tag name] [--dry]
      Generate candidates with GPT Image 2.5 into art/<scene>/<name>/candidates/: raw-view images, or Concierge
      images for something generated. Style references (the recipe's "references", or --ref) go along with the
      prompt; without any, Flare draws from the prompt alone. --layout gives a rough picture whose composition the
      candidates keep: a sketch, or a scene seen elsewhere in the game. --tag adds a word to the candidates' file names.
  npm run asset -- variant <recipe> [--n 2] [--quality medium] [--ref a.png] [--tag name] [--dry]
      Edit the picked raw image into Concierge-view candidates (GPT Image 2.5 Sunburst). The recipe's
      "conciergeReferences", or --ref, go along as style references for the augmented view.
  npm run asset -- redress <recipe> --prompt "what to change" [--view raw|concierge] [--from image] [--ref a.png] [--n 2] [--quality medium] [--dry]
      Edit the picked image of one view into new candidates of the same view: the same layout, every outline in
      place, with surfaces, wear and details changed as the prompt says. Pick one, and remake the other view if the
      outlines must still match it. --from edits another image instead, such as layout.png from blockout: painted
      this way, a blockout keeps every object exactly where and how big it is.
  npm run asset -- reframe <recipe> --scale 0.8 --floor <y> [--view raw|concierge] [--quality medium] [--dry]
      Shrink the picked image of a view around its floor line (y, in the image's pixels) and have GPT Image 2.5
      Sunburst paint the new edges: a set drawn too big for the characters gets their scale and keeps what is in it.
      Prints how scene coordinates move. Remake the other view with variant afterwards, so the two still match.
  npm run asset -- extend <recipe> --from <image> --box x,y,width [--view raw|concierge] [--n 2] [--dry]
      Place a picture, such as a concept panel wider than the screen, in the recipe's frame at the box, and have
      GPT Image 2.5 Sunburst paint the rest of the frame around it in its own style. The picture stays as it is.
  npm run asset -- zoom <scene id> --scale 0.6 [--dry]
      Pull a scene's camera back: in its scene file every place, hotspot, light and spawn moves toward the middle and
      the walk line by the scale, its people are drawn that much smaller (actorScale), and its walk line stays where it
      is. For each background layer it writes layout-zoom-raw.png (and -concierge) to the recipe's candidates/: the
      picked image shrunk the same way inside a blur of itself, to redraw with generate --layout, which continues the
      place into the blur. Give the recipe the same "scale" first. Free.
  npm run asset -- blockout <recipe>
      Draw the recipe's "blockout", a room built from boxes in metres, in true perspective, as layout.png: the guide
      for generate --layout, so every object comes out at its real size against the characters. layout-check.png
      shows Lux and the fixer standing in it, to judge the scale by eye. Free.
  npm run asset -- sheet <recipe>
      Lay all candidates side by side at game size, finished as the build would, to choose between them.
  npm run asset -- parts <recipe> [--view raw|concierge] [--quality low|medium] [--dry]
      Have GPT Image 2.5 Sunburst draw the character as a sheet of separate body parts (head, torso, coat, upper arm,
      forearm, thigh, shin) following a template, and cut them out with their joints into art/<scene>/<name>/parts/.
      The raw sheet is drawn from the recipe's parts.from image (default raw.png); the Concierge sheet is the raw
      sheet edited, so the parts match. --dry only writes the template.
      --preview walks the parts in a GIF; --bake renders a standing frame and the walk from them into anims/.
  npm run asset -- rig <recipe> [--render-only]
      Rig the character's parts in Blender: one skeleton for both outfits and sides, the walk keyed with the coat and
      the arms following through, frames rendered into anims/ for build. Saves art/<scene>/<name>/rig/<name>.blend, the
      file to change the walk in by hand; --render-only renders that file as it is. Needs Blender on the PATH.
  npm run asset -- erase <recipe> --file <image> --poly "x,y x,y x,y ..."
      Make everything inside the polygon transparent, to clear stray bits off cut-out art. Free; the old image is kept.
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
  const layout = typeof opt.layout === 'string' ? resolve(ROOT, opt.layout) : null;
  for (const f of [...refs, ...(layout ? [layout] : [])]) if (!existsSync(f)) throw new Error(`no image at ${rel(f)}`);
  // references set the rendering themselves, unless a look is asked for, on the command line or in the recipe
  const look = typeof opt.look === 'string' ? opt.look : r.look ?? (refs.length ? null : 'pixel');
  if (look && !LOOKS[look]) throw new Error(`look must be one of ${Object.keys(LOOKS).join(', ')}`);
  const notes = layout ? `${layoutNote(look)} ${refs.length ? `${LAYOUT_REFERENCES_NOTE} ` : ''}` : refs.length ? `${look === 'vector' ? REFERENCE_NOTE_VECTOR : REFERENCE_NOTE} ` : '';
  const prompt = notes + generationPrompt(r, look), as = r.exists === 'concierge' ? 'concierge' : 'raw';
  console.log(`${r.name}: ${n} × ${size}, ${quality} quality, ${look ?? 'reference'} look, ${as} view${layout ? `, laid out like ${rel(layout)}` : ''}${refs.length ? `, ${refs.length} reference${refs.length > 1 ? 's' : ''}` : ''}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  // with images it goes through the edit endpoint, which takes them; Sunburst follows them most closely. The layout goes first
  const background = r.spec.transparent ? 'transparent' : 'opaque', images = [...(layout ? [layout] : []), ...refs];
  const res = images.length ? await edit({ prompt, images: await loadReferences(images), size, quality, n, background }) : await generate({ prompt, size, quality, n, background });
  await saveCandidates(r, as, res, opt.tag);
}

async function cmdVariant([file], opt) {
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

async function cmdRedress([file], opt) {
  const r = await loadRecipe(file), view = opt.view ?? (r.exists === 'concierge' ? 'concierge' : 'raw');
  const src = typeof opt.from === 'string' ? resolve(ROOT, opt.from) : join(r.dir, `${view}.png`);
  if (typeof opt.prompt !== 'string') throw new Error('usage: redress <recipe> --prompt "what to change" [--view raw|concierge] [--from image] [--ref a.png,b.png]');
  if (!existsSync(src)) throw new Error(`pick or import a ${view} image first (${rel(src)})`);
  const refs = typeof opt.ref === 'string' ? opt.ref.split(',').map((f) => resolve(ROOT, f.trim())) : [];
  for (const f of refs) if (!existsSync(f)) throw new Error(`no image at ${rel(f)}`);
  const prompt = (refs.length ? `${REDRESS_REFERENCES_NOTE} ` : '') + redressPrompt(r, view, opt.prompt), meta = await sharp(src).metadata(), n = Number(opt.n ?? 2), quality = opt.quality ?? 'medium';
  const size = `${Math.round(meta.width / 16) * 16}x${Math.round(meta.height / 16) * 16}`;
  console.log(`${r.name}: ${n} re-dressed ${view} candidates of ${rel(src)}, ${size}${refs.length ? `, ${refs.length} reference${refs.length > 1 ? 's' : ''}` : ''}`);
  if (opt.dry) return console.log(`\n${prompt}`);
  await saveCandidates(r, view, await edit({ prompt, images: [src, ...(await loadReferences(refs))], size, quality, n, background: r.spec.transparent ? 'transparent' : 'opaque' }), opt.tag ?? 'redress');
}

/**
 * Place a picture in the recipe's frame and have the rest painted around it: a concept panel wider than the screen
 * becomes a full background. --box x,y,w says where it goes, in the frame's pixels; its height follows its shape.
 */
async function cmdExtend([file], opt) {
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

async function cmdReframe([file], opt) {
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

/** Every place in a scene file, moved by the camera pulling back: toward x = cx and y = fy by s. */
function zoomScene(file, s, anchors) {
  const cx = file.size[0] / 2, fy = file.walk.y, X = (x) => Math.round(cx + s * (x - cx)), Y = (y) => Math.round(fy + s * (y - fy)), L = (v) => Math.round(v * s);
  const rect = ([x, y, w, h]) => [X(x), Y(y), L(w), L(h)];
  file.walk.x0 = X(file.walk.x0);
  file.walk.x1 = X(file.walk.x1);
  if (file.mirror != null) file.mirror = Y(file.mirror);
  for (const sp of Object.values(file.spawns)) sp.x = X(sp.x);
  for (const h of file.hotspots) { h.rect = rect(h.rect); if (h.stand != null) h.stand = X(h.stand); }
  for (const l of file.lights) { l.x = X(l.x); l.y = Y(l.y); l.z = L(l.z); l.r = L(l.r); }
  for (const k of ['inside', 'outside']) if (file.zones?.[k]) file.zones[k] = file.zones[k].map(rect);
  for (const b of file.beacons ?? []) { b.x = X(b.x); b.y = Y(b.y); }
  for (const e of file.steam ?? []) { e.x = X(e.x); e.y = Y(e.y); e.height = L(e.height); e.width = L(e.width); }
  for (const g of file.godrays ?? []) { g.x = X(g.x); g.y = Y(g.y); }
  if (file.drips) Object.assign(file.drips, { x0: X(file.drips.x0), x1: X(file.drips.x1), top: Y(file.drips.top), bottom: Y(file.drips.bottom) });
  if (file.traffic) file.traffic.lanes = file.traffic.lanes.map(Y);
  // a person keeps standing where they stood, at the new size: their feet move like everything else
  for (const l of file.layers) {
    const a = anchors[l.asset];
    if (!a) continue;
    const [ax, ay] = a, fx = X(l.x + ax), fyy = Y(l.y + ay), sc = (file.actorScale ?? 1) * s;
    l.x = Math.round(fx - ax * sc); l.y = Math.round(fyy - ay * sc);
  }
  file.actorScale = +((file.actorScale ?? 1) * s).toFixed(3);
  return file;
}

async function cmdZoom([id], opt) {
  const s = Number(opt.scale);
  if (!id || !(s > 0.2 && s < 1)) throw new Error('usage: zoom <scene id> --scale 0.6');
  const path = resolve(ROOT, 'public/assets/scenes', id, 'scene.json');
  if (!existsSync(path)) throw new Error(`no scene at ${rel(path)}`);
  const file = JSON.parse(await readFile(path, 'utf8')), walkY = file.walk.y;
  if (file.zoneMap) console.log(`warning: ${file.zoneMap} is a picture of the zones and does not move; redraw it.`);
  // the people among the layers, by their feet
  const anchors = {}, backgrounds = [];
  for (const l of file.layers) {
    const sj = resolve(ROOT, 'public/assets', l.asset, 'sprite.json');
    if (!existsSync(sj)) continue;
    const def = JSON.parse(await readFile(sj, 'utf8'));
    if (def.kind === 'character' || def.actor) anchors[l.asset] = def.anchor ?? [def.w / 2, def.h];
    else if (def.kind === 'background') backgrounds.push(l.asset);
  }
  // each background's picked images, shrunk around the walk line inside a blur of themselves
  for (const asset of backgrounds) {
    const recipe = resolve(ROOT, 'art', `${asset}.json`);
    if (!existsSync(recipe)) continue;
    const r = await loadRecipe(recipe);
    for (const view of ['raw', 'concierge']) {
      const src = join(r.dir, `${view}.png`);
      if (!existsSync(src)) continue;
      const { width: W, height: H } = await sharp(src).metadata();
      const floor = (walkY / 540) * H, w = Math.round(W * s), h = Math.round(H * s), left = Math.round((W - w) / 2), top = Math.round(floor * (1 - s));
      const small = await sharp(src).resize(w, h, { kernel: 'lanczos3' }).removeAlpha().png().toBuffer();
      const out = join(r.dir, 'candidates', `layout-zoom-${view}.png`);
      await mkdir(dirname(out), { recursive: true });
      if (!opt.dry) await sharp(src).resize(W, H).removeAlpha().blur(40).composite([{ input: small, left, top }]).png().toFile(out);
      console.log(`  ${rel(out)}`);
    }
  }
  zoomScene(file, s, anchors);
  if (opt.dry) return console.log(JSON.stringify({ walk: file.walk, spawns: file.spawns, actorScale: file.actorScale }));
  await writeFile(path, JSON.stringify(file, null, 1) + '\n');
  console.log(`${id}: zoomed out to ${s}, people drawn at ${file.actorScale}. Redraw its backgrounds with: npm run asset -- generate <recipe> --layout <layout-zoom-raw.png>`);
}

async function cmdBlockout([file]) {
  const r = await loadRecipe(file);
  if (!r.blockout) throw new Error(`${r.name} has no "blockout" to draw`);
  const [W, H] = (r.size ?? r.spec.size).split('x').map(Number), cam = roomCamera(r.blockout.camera), k = W / cam.width;
  await mkdir(r.dir, { recursive: true });
  const guide = await blockoutPNG(r.blockout, W, H), out = join(r.dir, 'layout.png');
  await writeFile(out, guide);
  // the same, with the characters standing on the walk line: Lux near the left, the fixer at the bench
  const figure = async (asset, frameW, sceneX) => {
    const src = resolve(ROOT, 'public/assets', asset, 'albedo.raw.png'), { height } = await sharp(src).metadata();
    const img = await sharp(src).extract({ left: 0, top: 0, width: frameW, height }).resize(Math.round(frameW * k), Math.round(height * k), { kernel: 'nearest' }).png().toBuffer();
    return { input: img, left: Math.round((sceneX - frameW / 2) * k), top: Math.round((cam.walkY - height) * k) };
  };
  const people = [await figure('cast/hero', 143, 230), await figure('cast/fixer', 106, 600)];
  await sharp(guide).composite(people).png().toFile(join(r.dir, 'layout-check.png'));
  console.log(`${r.name}: ${r.blockout.objects.length} objects → ${rel(out)}, and ${rel(join(r.dir, 'layout-check.png'))} with Lux and the fixer in it`);
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
  // the bench lists every scene: keep an index of them, and of what was built last
  const indexFile = resolve(ROOT, 'public/assets/bench.json'), index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : { scenes: [] };
  if (!index.scenes.includes(scene)) index.scenes.push(scene);
  index.scenes.sort();
  index.latest = `${scene}/${name}`;
  await writeFile(indexFile, JSON.stringify(index, null, 2) + '\n');
  list.latest = name; // the bench opens the asset built last
  await writeFile(file, JSON.stringify(list, null, 2) + '\n');
}

async function buildOne(file) {
  const r = await loadRecipe(file), spec = r.spec, exists = r.exists ?? 'both', rawPath = join(r.dir, 'raw.png'), concPath = join(r.dir, 'concierge.png');
  // frames baked from parts, or touched up one by one, make an animated sprite
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
  const maps = ['albedo.raw', 'normal', 'material', 'meta'];
  await writePNG(join(out, 'albedo.raw.png'), raw);
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
 * An animated character: frames baked from its parts (parts --bake), or loops touched up frame by frame (touch
 * --frame). Every frame of both views is cropped and scaled the same way, so the character keeps its size and place,
 * and planted on the ground.
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
  if (!views.raw && !views.concierge) throw new Error(`${r.name}: no frames in ${rel(dir)} yet; bake them with: npm run asset -- parts ${rel(r.file)} --bake`);
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
async function writeAnimated(r, raws, concs, { anchorX, anims }) {
  const spec = r.spec, exists = r.exists ?? 'both', hexes = await palette(), strength = r.palette ?? 0.35, G = 2, n = (raws ?? concs).length;
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
    // each view's own surface, as in buildOne
    const surface = (img) => { const H = heightMap(img, { round: spec.round, rh: spec.rh, detail: spec.detail }); return [normalMap(H, w, h), materialMap(img, H, r.material ?? spec.material)]; };
    const [normalR, materialR] = surface(raw ?? conc);
    add('normal', normalR);
    add('material', materialR);
    if (raw && conc) { const [normalC, materialC] = surface(conc); add('normal.concierge', normalC); add('material.concierge', materialC); }
    if (!raw) raw = blank(w, h);
    if (exists === 'raw') conc = blank(w, h);
    add('albedo.raw', raw);
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
  // a character's colours run on a little past its edge, for the engine's smooth sampling
  for (const [name, imgs] of Object.entries(maps)) await writePNG(join(out, `${name}.png`), name.startsWith('albedo') ? bleedEdges(strip(imgs)) : strip(imgs), { rgb: !name.startsWith('albedo') });
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
  // --recut cuts the sheet already drawn again, without drawing a new one; --mirror makes the left sheet by mirroring
  // the right one, so both sides are the same person (touch up what differs, such as an eye device, afterwards)
  if (opt.recut && existsSync(sheetFile)) res.images.push(await readFile(sheetFile));
  else if (left && opt.mirror) {
    const right = join(dir, `${look}-sheet.png`);
    if (!existsSync(right)) throw new Error(`make the right-facing ${look} parts first`);
    res.images.push(await sharp(right).flop().png().toBuffer());
  }
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
  // a mirrored left sheet has every part on the other side of the sheet
  const at = r.parts?.at && left && r.parts?.left?.mirror ? Object.fromEntries(Object.entries(r.parts.at).map(([n, [x, y]]) => [n, [SHEET.w - x, y]])) : r.parts?.at ?? null;
  const parts = cutParts(await readRGBA(sheetFile), at, r.parts?.joints ?? {}, left);
  for (const [name, p] of Object.entries(parts)) await writePNG(join(dir, view, `${name}.png`), p.img);
  const jfile = join(dir, 'parts.json'), all = existsSync(jfile) ? JSON.parse(await readFile(jfile, 'utf8')) : {};
  // a mirrored left sheet takes its joints from the right one, mirrored across the sheet, so they stay where they
  // belong even where a touch-up has changed a part's outline
  const right = left && r.parts?.left?.mirror ? all[look] : null;
  if (right) for (const [name, p] of Object.entries(parts)) {
    const rp = right[name];
    if (rp?.box) p.joints = Object.fromEntries(Object.entries(rp.joints).map(([j, [x, y]]) => [j, [SHEET.w - 1 - (rp.box[0] + x) - p.box[0], rp.box[1] + y - p.box[1]]]));
  }
  all[view] = Object.fromEntries(Object.entries(parts).map(([n, p]) => [n, { size: [p.img.w, p.img.h], box: p.box, joints: p.joints }]));
  await writeFile(jfile, JSON.stringify(all, null, 2) + '\n');
  const missing = Object.keys(PARTS_NAMES).filter((n) => !parts[n]);
  console.log(`${r.name}: ${Object.keys(parts).length} parts → ${rel(join(dir, view))}${missing.length ? ` · missing: ${missing.join(', ')}` : ''}`);
  console.log(res.cost == null ? 'Cost: not reported by the API.' : `Cost: $${res.cost.toFixed(4)}`);
}

/** Each part's length along its bone, in its own pixels: from joint to joint, or from its joint to its far end. */
const BONE = {
  head: (p) => p.joints.neck[1],
  torso: (p) => Math.abs(p.joints.hip[1] - p.joints.neck[1]),
  coat: (p) => p.img.h - p.joints.waist[1],
  upperArm: (p) => Math.abs(p.joints.elbow[1] - p.joints.shoulder[1]),
  forearm: (p) => p.img.h - p.joints.elbow[1],
  thigh: (p) => Math.abs(p.joints.knee[1] - p.joints.hip[1]),
  shin: (p) => p.img.h - p.joints.knee[1],
};

/**
 * The parts resized so the figure has the recipe's proportions: `parts.proportions` gives each part's length as a
 * fraction of her height, measured on her design (the head from its top to the base of the neck, the torso from the
 * neck to the hip joint, the coat from the hip to the hem, the shin from the knee to the sole, the forearm from the
 * elbow to the fingertips, and `boot` the boot's height when the shin part is drawn as a boot). An image model draws a
 * parts sheet at its own sizes, a big head and short legs as often as not; without this the rig puts them together as
 * drawn. The torso keeps its size; the others follow it.
 */
async function proportion(parts, prop) {
  if (!prop?.torso || !parts.torso) return parts;
  const unit = BONE.torso(parts.torso) / prop.torso;
  for (const [name, p] of Object.entries(parts)) {
    if (name === 'torso' || !prop[name] || !BONE[name] || (name === 'shin' && prop.boot)) continue;
    const s = (prop[name] * unit) / BONE[name](p);
    if (Math.abs(s - 1) < 0.01) continue;
    const w = Math.max(1, Math.round(p.img.w * s)), h = Math.max(1, Math.round(p.img.h * s));
    parts[name] = { img: await resize(p.img, w, h), joints: Object.fromEntries(Object.entries(p.joints).map(([j, [x, y]]) => [j, [(x * w) / p.img.w, (y * h) / p.img.h]])) };
  }
  if (prop.boot && prop.shin && parts.shin && parts.thigh) Object.assign(parts, await lowerLeg(parts.shin.img, parts.thigh, prop.boot * unit, prop.shin * unit));
  return parts;
}

/** Where a row of a part is opaque: its first and last opaque x, or null. */
function span(img, y) {
  const row = Math.max(0, Math.min(img.h - 1, Math.round(y)));
  let x0 = -1, x1 = -1;
  for (let x = 0; x < img.w; x++) if (img.d[(row * img.w + x) * 4 + 3] >= 128) { if (x0 < 0) x0 = x; x1 = x; }
  return x0 < 0 ? null : [x0, x1];
}

/**
 * The lower leg as her design has it: the trouser leg from the knee, carried on from the bottom of her thigh, tucked
 * into a boot of the design's height. An image model draws the shin part as a knee-high boot; stretched to the length
 * of her shin, its foot would come out far too big. It comes back as two parts, the shin down to the ankle and the foot
 * below it, overlapping a little so the ankle can bend, the foot knowing where its heel and toe touch the ground.
 */
async function lowerLeg(bootImg, thigh, bootH, shinLen) {
  const boot = await resize(bootImg, Math.max(1, Math.round((bootImg.w * bootH) / bootImg.h)), Math.max(1, Math.round(bootH)));
  const top = span(boot, boot.h * 0.04) ?? [0, boot.w - 1], cx = (top[0] + top[1]) / 2;
  // the trouser around the knee, from the bottom of the thigh
  const t = thigh.img, kneeRow = span(t, t.h * 0.85) ?? [0, t.w - 1];
  const tw = Math.max(4, Math.round(Math.min(kneeRow[1] - kneeRow[0] + 1, (top[1] - top[0] + 1) * 0.92)));
  const k0 = Math.round(shinLen * 0.06), H = k0 + Math.round(shinLen), over = Math.round(bootH * 0.08);
  const tubeH = Math.max(4, H - boot.h + over), sample = { w: kneeRow[1] - kneeRow[0] + 1, h: Math.max(2, Math.round(t.h * 0.25)) };
  const piece = blank(sample.w, sample.h), y0 = Math.round(t.h * 0.7);
  for (let y = 0; y < sample.h; y++) for (let x = 0; x < sample.w; x++) {
    const sy = Math.min(t.h - 1, y0 + y), i = (sy * t.w + kneeRow[0] + x) * 4;
    piece.d.set(t.d.subarray(i, i + 4), (y * sample.w + x) * 4);
  }
  const tube = await resize(piece, tw, tubeH);
  const W = Math.max(boot.w, Math.ceil(cx + tw / 2) + 1), out = blank(W, H), tx = Math.round(cx - tw / 2);
  const over4 = (img, ox, oy) => { for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) { const i = (y * img.w + x) * 4; if (img.d[i + 3] < 128) continue; const X = ox + x, Y = oy + y; if (X >= 0 && Y >= 0 && X < W && Y < H) out.d.set(img.d.subarray(i, i + 4), (Y * W + X) * 4); } };
  over4(tube, tx, 0);
  over4(boot, 0, H - boot.h);
  // the ankle: a little above where the boot's front starts reaching forward over the foot, in the middle of the shaft
  const by = H - boot.h, shaft = top[1] - top[0] + 1;
  let toeRow = boot.h - 1;
  for (let y = Math.round(boot.h * 0.4); y < boot.h; y++) { const sp = span(boot, y); if (sp && sp[1] > top[1] + shaft * 0.2) { toeRow = y; break; } }
  const ankleRow = Math.max(Math.round(boot.h * 0.45), toeRow - Math.round(shaft * 0.3)), at = span(boot, ankleRow) ?? top;
  const ax = (at[0] + at[1]) / 2, ay = by + ankleRow, lap = Math.max(3, Math.round(shaft * 0.18));
  const shin = crop(out, 0, 0, W, Math.min(H, ay + lap)), foot = crop(out, 0, ay - lap, W, H - (ay - lap));
  // the sole's back and front, where the heel and the toe touch the ground
  let soleY = foot.h - 1;
  while (soleY > 0 && !span(foot, soleY)) soleY--;
  let hx = Infinity, fx = -Infinity;
  for (let y = Math.max(0, soleY - Math.round(foot.h * 0.06)); y <= soleY; y++) { const sp = span(foot, y); if (sp) { hx = Math.min(hx, sp[0]); fx = Math.max(fx, sp[1]); } }
  return {
    shin: { img: shin, joints: { knee: [cx, k0], ankle: [ax, ay] } },
    foot: { img: foot, joints: { ankle: [ax, lap], heel: [hx, soleY], toe: [fx, soleY] } },
  };
}

/**
 * The parts posed into a standing frame and the 8-frame walk, written as frames for build to assemble: feet planted,
 * every view the same way. The stride comes from the near foot's travel while it is planted.
 */
async function bakeParts(r, dir) {
  const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), W = 1600, H = 2000, origin = [800, 900];
  const mirror = (img) => { const out = blank(img.w, img.h); for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.d.set(img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4); return out; };
  let stride = 0, count = 0;
  const done = [], FAR = [-14, -6];
  for (const side of ['', '-left']) for (const look of ['raw', 'concierge']) {
    const v = look + side;
    if (!existsSync(join(dir, v, 'torso.png'))) continue;
    // a left-facing set is mirrored to face right, walked like the right one, and mirrored back
    const left = side === '-left', parts = {};
    for (const [name, info] of Object.entries(all[v])) {
      const img = await readRGBA(join(dir, v, `${name}.png`));
      parts[name] = left ? { img: mirror(img), joints: Object.fromEntries(Object.entries(info.joints).map(([j, [x, y]]) => [j, [img.w - 1 - x, y]])) } : { img, joints: info.joints };
    }
    await proportion(parts, r.parts?.proportions);
    // with a foot of its own, the walk is built from where the feet go; without one, from the standard angles
    const gait = r.parts?.gait ?? {}, cycle = parts.foot ? walkCycle(parts, gait, FAR) : null;
    const foot = [parts.shin.img.w * 0.55, parts.shin.img.h * 0.97];
    if (v === 'raw') stride = cycle ? cycle.stride : 2 * (pointOf(parts, walkAngles(0, gait), 'legLower', foot, { origin })[0] - pointOf(parts, walkAngles(4, gait), 'legLower', foot, { origin })[0]);
    const write = async (anim, k, angles) => {
      const d = join(r.dir, 'anims', anim + (left ? 'Left' : ''));
      await mkdir(d, { recursive: true });
      const f = plant([posePartsRig(parts, angles, { w: W, h: H, origin, coatFront: left ? r.parts?.left?.coat === 'front' : r.parts?.coat === 'front' })])[0];
      await writePNG(join(d, `${look}-${String(k).padStart(2, '0')}.png`), left ? mirror(f) : f);
    };
    // the last bake's frames go first, so a shorter cycle leaves none behind
    for (const anim of ['idle', 'walk']) {
      const d = join(r.dir, 'anims', anim + (left ? 'Left' : ''));
      if (existsSync(d)) for (const f of await readdir(d)) if (f.startsWith(`${look}-`) && f.endsWith('.png')) await rm(join(d, f));
    }
    // standing: her stance, weight on one leg; then the walk
    await write('idle', 0, cycle ? standPose(parts, gait.idle, FAR) : gait.idle ?? {});
    const frames = cycle ? cycle.frames : Array.from({ length: 8 }, (_, k) => walkAngles(k, gait));
    for (let k = 0; k < frames.length; k++) await write('walk', k, frames[k]);
    count = frames.length;
    done.push(v);
  }
  await writeFile(join(r.dir, 'anims', 'walk', 'stride.json'), JSON.stringify({ stride }) + '\n');
  // where the hip is in every frame, both ways round: the sprite's anchor
  await writeFile(join(r.dir, 'anims', 'origin.json'), JSON.stringify({ x: origin[0] }) + '\n');
  console.log(`${r.name}: a standing frame and ${count} walk frames for ${done.join(', ')} → ${rel(join(r.dir, 'anims'))}, stride ${stride.toFixed(0)} px`);
}

/** A part image mirrored left to right, its joints with it. */
const mirrorPart = (img, joints) => {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) out.d.set(img.d.subarray((y * img.w + x) * 4, (y * img.w + x) * 4 + 4), (y * img.w + (img.w - 1 - x)) * 4);
  return { img: out, joints: Object.fromEntries(Object.entries(joints).map(([j, [x, y]]) => [j, [img.w - 1 - x, y]])) };
};

/**
 * The character rigged in Blender (tools/blender/rig.py): its parts prepared as the bake prepares them (to the recipe's
 * proportions, the lower leg split into shin and foot, a set seen from the left mirrored to face right), written with
 * the walk to <recipe dir>/rig/; Blender builds one skeleton for every set, keys the walk with the coat and the arms
 * following through, saves rig/<name>.blend and renders each set's frames, which land in anims/ for build. With
 * --render-only it renders the saved .blend as it is, after the walk has been changed by hand.
 */
async function cmdRig([file], opt) {
  const r = await loadRecipe(file), dir = join(r.dir, 'parts'), out = join(r.dir, 'rig'), tmp = join(out, 'frames'), FAR = [-14, -6], PERCENT = 50;
  if (!opt['render-only']) {
    const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), gait = r.parts?.gait ?? {}, sets = [];
    let walk = null, idle = null;
    for (const side of ['', '-left']) for (const look of ['raw', 'concierge']) {
      const v = look + side;
      if (!existsSync(join(dir, v, 'torso.png'))) continue;
      const left = side === '-left', parts = {};
      for (const [name, info] of Object.entries(all[v])) {
        const img = await readRGBA(join(dir, v, `${name}.png`));
        parts[name] = left ? mirrorPart(img, info.joints) : { img, joints: info.joints };
      }
      await proportion(parts, r.parts?.proportions);
      if (!parts.foot) throw new Error(`${r.name}: the rig needs a separate foot: give parts.proportions a boot height`);
      await mkdir(join(out, v), { recursive: true });
      const pieces = {};
      for (const [name, p] of Object.entries(parts)) {
        await writePNG(join(out, v, `${name}.png`), p.img);
        pieces[name] = { size: [p.img.w, p.img.h], joints: p.joints };
      }
      sets.push({ name: v, left, coatFront: left ? r.parts?.left?.coat === 'front' : r.parts?.coat === 'front', parts: pieces });
      if (v === 'raw') { walk = walkCycle(parts, gait, FAR); idle = standPose(parts, gait.idle, FAR); }
    }
    if (!walk) throw new Error(`${r.name}: no raw parts to rig`);
    await writeFile(join(out, 'rig.json'), JSON.stringify({ blend: `${r.name}.blend`, percent: PERCENT, far: FAR, sets, walk, idle }, null, 1) + '\n');
  }
  await rm(tmp, { recursive: true, force: true });
  execFileSync('blender', ['-b', '--factory-startup', '--python', resolve(ROOT, 'tools/blender/rig.py'), '--', out, tmp, ...(opt['render-only'] ? ['--render-only'] : [])], { stdio: ['ignore', 'inherit', 'inherit'] });
  // frame 0 is the stance, 1 to N the walk; a set seen from the left is mirrored back
  const rig = JSON.parse(await readFile(join(out, 'rig.json'), 'utf8'));
  for (const s of rig.sets) {
    const look = s.name.replace('-left', ''), sfx = s.left ? 'Left' : '';
    const files = (await readdir(join(tmp, s.name))).filter((f) => f.endsWith('.png')).sort();
    for (const anim of ['idle', 'walk']) {
      const d = join(r.dir, 'anims', anim + sfx);
      await mkdir(d, { recursive: true });
      for (const f of await readdir(d)) if (f.startsWith(`${look}-`) && f.endsWith('.png')) await rm(join(d, f));
    }
    for (const [i, f] of files.entries()) {
      const dst = join(r.dir, 'anims', (i ? 'walk' : 'idle') + sfx, `${look}-${String(i ? i - 1 : 0).padStart(2, '0')}.png`);
      await (s.left ? sharp(join(tmp, s.name, f)).flop() : sharp(join(tmp, s.name, f))).png().toFile(dst);
    }
  }
  await writeFile(join(r.dir, 'anims', 'walk', 'stride.json'), JSON.stringify({ stride: (rig.walk.stride * PERCENT) / 100 }) + '\n');
  await writeFile(join(r.dir, 'anims', 'origin.json'), JSON.stringify({ x: (800 * PERCENT) / 100 }) + '\n');
  console.log(`${r.name}: rigged in Blender (${rel(join(out, rig.blend))}), a stance and ${rig.walk.frames.length} walk frames for ${rig.sets.map((s) => s.name).join(', ')} → ${rel(join(r.dir, 'anims'))}. Build it with: npm run asset -- build ${rel(r.file)}`);
}

/** The parts assembled and walked through the standard cycle, as an animated GIF beside the sheets, for checking. */
async function previewParts(r, dir) {
  const views = ['raw', 'concierge'].filter((v) => existsSync(join(dir, v, 'torso.png')));
  const all = JSON.parse(await readFile(join(dir, 'parts.json'), 'utf8')), height = r.height ?? r.spec.height, rows = [];
  for (const v of views) {
    const parts = {};
    for (const [name, info] of Object.entries(all[v])) parts[name] = { img: await readRGBA(join(dir, v, `${name}.png`)), joints: info.joints };
    await proportion(parts, r.parts?.proportions);
    const W = 1600, H = 2000, origin = [800, 900];
    const gait = r.parts?.gait ?? {}, cycle = parts.foot ? walkCycle(parts, gait) : null;
    const poses = cycle ? [standPose(parts, gait.idle), ...cycle.frames] : [gait.idle ?? {}, ...Array.from({ length: 8 }, (_, k) => walkAngles(k, gait))];
    const frames = poses.map((a) => posePartsRig(parts, a, { w: W, h: H, origin }));
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

/** Make everything inside a polygon transparent: clearing stray bits off cut-out art, by hand and for free. */
async function cmdErase([file], opt) {
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

async function cmdTouch([file], opt) {
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
  const prompt = `Change only the transparent area of the mask: ${opt.prompt}. Everything else stays exactly as it is; match the style, colours, lighting and detail around it.${r.spec.transparent ? ' Keep the flat, plain background colour around the subject exactly as it is.' : ''}`;
  if (opt.dry) return console.log(`\n${prompt}`);
  // the window, and a mask that is transparent over the box. Cut-out art goes on a key colour (--key, default green):
  // the model keeps it as the background, and it is keyed out again afterwards
  const key = r.spec.transparent ? (typeof opt.key === 'string' ? opt.key : '#00ff00') : null;
  const piece = await (key ? sharp(src).extract(win).flatten({ background: key }) : sharp(src).extract(win)).png().toBuffer();
  const m = Buffer.alloc(win.width * win.height * 4, 255);
  for (let y = by; y < by + bh; y++) for (let x = bx; x < bx + bw; x++) if (weight(x, y) > 0) m[((y - win.top) * win.width + (x - win.left)) * 4 + 3] = 0;
  const mask = await sharp(m, { raw: { width: win.width, height: win.height, channels: 4 } }).png().toBuffer();
  const res = await edit({ prompt, images: [{ name: 'piece.png', data: piece }], mask, size: `${win.width}x${win.height}`, quality, n: 1, background: r.spec.transparent ? 'transparent' : 'opaque' });
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

const [cmd, ...rest] = process.argv.slice(2), { pos, opt } = parse(rest);
const run = { new: cmdNew, rig: cmdRig, zoom: cmdZoom, extend: cmdExtend, generate: cmdGenerate, variant: cmdVariant, redress: cmdRedress, reframe: cmdReframe, blockout: cmdBlockout, pick: cmdPick, import: cmdImport, sheet: cmdSheet, touch: cmdTouch, erase: cmdErase, parts: cmdParts, build: async (files) => { if (!files.length) throw new Error('usage: build <recipe> [more...]'); for (const f of files) await buildOne(f); } }[cmd];
if (!run) console.log(HELP);
else run(pos, opt).catch((e) => { console.error(`error: ${e.message}`); process.exit(1); });
