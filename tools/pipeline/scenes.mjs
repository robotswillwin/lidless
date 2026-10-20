// Scenes: rooms laid out from boxes in metres, cameras pulled back, and pictures split into layers that move at their
// own speed.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { blockoutPNG, camera as roomCamera } from './blockout.mjs';
import { buildOne } from './build.mjs';
import { depthOf } from './depth.mjs';
import { blank, readRGBA, writePNG } from './image.mjs';
import { edit, generate } from './openai.mjs';
import { loadRecipe, ROOT } from './recipe.mjs';
import { nextName, rel } from './shared.mjs';
import { distanceFrom, draftLayerMap, LAYER_COLOUR_NAMES, layerMapImage, layerPreview, pushPull, readLayerMap } from './split.mjs';

/** The screen, in level pixels: as wide as one-screen scenes are. */
const NW = 960;

/** Every place in a scene file, moved by the camera pulling back: toward x = cx and y = fy by s. */
export function zoomScene(file, s, anchors) {
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

export async function cmdZoom([id], opt) {
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

export async function cmdBlockout([file]) {
  const r = await loadRecipe(file);
  if (!r.blockout) throw new Error(`${r.name} has no "blockout" to draw`);
  const [W, H] = (r.size ?? r.spec.size).split('x').map(Number), cam = roomCamera(r.blockout.camera), k = W / cam.width;
  await mkdir(r.dir, { recursive: true });
  const guide = await blockoutPNG(r.blockout, W, H), out = join(r.dir, 'layout.png');
  await writeFile(out, guide);
  // the same, with the characters standing on the walk line: Luna near the left, the fixer at the bench
  const figure = async (asset, frameW, sceneX) => {
    const src = resolve(ROOT, 'public/assets', asset, 'albedo.raw.png'), { height } = await sharp(src).metadata();
    const img = await sharp(src).extract({ left: 0, top: 0, width: frameW, height }).resize(Math.round(frameW * k), Math.round(height * k), { kernel: 'nearest' }).png().toBuffer();
    return { input: img, left: Math.round((sceneX - frameW / 2) * k), top: Math.round((cam.walkY - height) * k) };
  };
  const people = [await figure('cast/hero', 143, 230), await figure('cast/fixer', 106, 600)];
  await sharp(guide).composite(people).png().toFile(join(r.dir, 'layout-check.png'));
  console.log(`${r.name}: ${r.blockout.objects.length} objects → ${rel(out)}, and ${rel(join(r.dir, 'layout-check.png'))} with Luna and the fixer in it`);
}

/**
 * A background split into layers that move at their own speed. The recipe's "split" names them, far to near, with their
 * parallax; "ground" is the walk line (everything under it is the street, the nearest layer); "fixes" move rectangles or
 * polygons of the map to a layer; "margin" is how far past the screen's edges the layers reach, "thin" how narrow a
 * thing in front is bridged across, "soft" how wide a nearer thing's soft edge is, all in level pixels; "marginMatch" how
 * close (0 to 255) the model's painting past an edge must come to the picture's edge for the furthest layer to use it.
 */
export async function cmdSplit([file], opt) {
  const r = await loadRecipe(file), cfg = r.split;
  if (!cfg?.layers?.length) throw new Error(`${r.name}: say how to split it first, in the recipe: "split": { "layers": [{ "name": "far", "parallax": 0.3 }, ..., { "name": "street", "parallax": 1 }], "ground": <walk line y> }`);
  const res = r.res ?? 1, names = cfg.layers.map((l) => l.name), N = names.length, mapFile = join(r.dir, 'layers.png');
  if (N > 6) throw new Error('at most six layers');
  const views = ['raw', 'concierge'].filter((v) => existsSync(join(r.dir, `${v}.png`)));
  const pics = {};
  for (const v of views) pics[v] = await readRGBA(join(r.dir, `${v}.png`));
  const { w: W, h: H } = pics[views[0]];

  if (opt.map) {
    // the depth of both views together: they line up, and one's mistakes are not the other's
    const deps = [];
    for (const v of views) deps.push(await depthOf(pics[v]));
    const depth = new Float32Array(W * H);
    for (let i = 0; i < depth.length; i++) depth[i] = deps.reduce((a, d) => a + d.d[i], 0) / deps.length;
    const layerOf = (n) => { const k = names.indexOf(n); if (k < 0) throw new Error(`no layer called ${n}`); return k; };
    const fixes = (cfg.fixes ?? []).map((f) => ({ to: layerOf(f.to), from: f.from?.map(layerOf), rect: f.rect?.map((v) => Math.round(v * res)), poly: f.poly?.map(([x, y]) => [x * res, y * res]) }));
    const L = draftLayerMap(depth, W, H, { n: N, ground: Math.round((cfg.ground ?? H / res) * res), fixes, rim: Math.round((cfg.rim ?? 3) * res) });
    await writePNG(mapFile, layerMapImage(L, W, H), { rgb: true });
    await writePNG(join(r.dir, 'layers-preview.png'), layerPreview(L, pics[views.at(-1)]), { rgb: true });
    return console.log(`${r.name}: layer map → ${rel(mapFile)}: ${names.map((n, k) => `${n} ${LAYER_COLOUR_NAMES[k]}`).join(', ')}. See it over the picture in layers-preview.png, paint over the map to fix it, then split without --map.`);
  }

  if (!existsSync(mapFile)) throw new Error(`${r.name}: no layer map yet; make one with: npm run asset -- split ${rel(r.file)} --map`);
  // a view can have a map of its own, layers-raw.png or layers-concierge.png, where its things are not the other's: a
  // lantern in one view hangs where the other has only a bulb, and its glow stays with the far smog
  const L0 = readLayerMap(await readRGBA(mapFile), N), maps = {};
  for (const v of views) { const f = join(r.dir, `layers-${v}.png`); maps[v] = existsSync(f) ? readLayerMap(await readRGBA(f), N) : L0; }
  const margin = Math.round((cfg.margin ?? 20) * res), quality = opt.quality ?? 'medium';
  const recipe = JSON.parse(await readFile(r.file, 'utf8'));
  const layers = [];
  let cost = 0;
  for (let k = 0; k < N; k++) {
    const layer = cfg.layers[k], name = `${r.name}-${layer.name}`, out = join(ROOT, 'art', r.scene, name);
    // every layer reaches past the screen's edges, as the camera moves; the picture is padded to the model's sizes. In a
    // scene wider than the screen a layer further away moves less, so the camera only ever shows the start of it: from
    // the left edge, a screen and its parallax's share of the scroll. Past that it is left out (span): the far city of a
    // wide street, not the picture's width, which also keeps the image model's fill within the sizes it paints
    const m = margin, sceneW = W / res, need = Math.ceil((NW + (layer.parallax ?? 1) * Math.max(0, sceneW - NW)) * res);
    const span = Math.min(W, need + m), CW = m + span + (span >= W ? m : 0), EH = Math.ceil(H / 16) * 16, scrolls = sceneW > NW;
    await mkdir(out, { recursive: true });
    for (const v of views) {
      const pic = pics[v], img = blank(CW, H), L = maps[v];
      // own: this layer's pixels. hidden: what nearer layers cover. past: the margins and the padding, painted, each row
      // of a margin belonging to the layer of the picture's edge in that row: 1 this one, 2 a nearer one, 3 a further one
      const own = new Uint8Array(CW * EH), hidden = new Uint8Array(CW * EH), past = new Uint8Array(CW * EH);
      for (let y = 0; y < EH; y++) for (let x = 0; x < CW; x++) {
        const sx = x - m, i = y * CW + x, l = y < H ? L[y * W + Math.min(W - 1, Math.max(0, sx))] : N;
        if (y >= H || sx < 0 || sx >= W) past[i] = l === k ? 1 : l > k ? 2 : 3;
        else if (l === k) { own[i] = 1; img.d.set(pic.d.subarray((y * W + sx) * 4, (y * W + sx) * 4 + 4), (y * CW + x) * 4); }
        else if (l > k) hidden[i] = 1;
      }
      // only the furthest layer needs the image model's painting, behind nearer things and past the edges: the nearer layers
      // fill behind things from their own rows and carry their edges out (below). The model sees this layer and what is
      // further away as they are, and paints what nearer layers and the margins hide, over a plain fill of the layer's own
      // average colour so nothing of what stood there leads it astray
      let data = null;
      if (k === 0) {
      const avg = [0, 0, 0];
      let n = 0;
      for (let i = 0; i < own.length; i++) if (own[i]) { const j = i * 4; avg[0] += img.d[j]; avg[1] += img.d[j + 1]; avg[2] += img.d[j + 2]; n++; }
      const fill = avg.map((c) => Math.round(c / Math.max(1, n)));
      const input = blank(CW, EH, [...fill, 255]), mask = Buffer.alloc(CW * EH * 4, 255);
      // what a nearer thing hides: the colours around it, with no shape (see pushPull). Below the ground, which the street
      // always covers, nothing is painted
      const known = new Uint8Array(CW * EH);
      for (let y = 0; y < Math.min(H, EH); y++) for (let x = m; x < m + span; x++) { const i = y * CW + x; if (!hidden[i] && !past[i]) { known[i] = 1; input.d.set(pic.d.subarray((y * W + x - m) * 4, (y * W + x - m) * 4 + 3), i * 4); } }
      if (scrolls) input.d.set(pushPull(input.d, known, CW, EH));
      const groundT = Math.round((cfg.ground ?? H / res) * res);
      for (let y = 0; y < EH; y++) for (let x = 0; x < CW; x++) {
        const i = y * CW + x;
        if (!known[i] && (!scrolls || y < groundT)) mask[i * 4 + 3] = 0;
      }
      const prompt = `Fill the transparent area of the mask with ${layer.fill ?? `more of what is at this distance in the picture`}, continued naturally, as if the nearer buildings, objects and people in front of it were not there, and on past the picture's left and right edges. Nothing stands in front of it: no buildings, no bridge or viaduct, no pillars, no trees, no lamps, no people and no dark silhouettes of them; only more of the distance. No text. Everything else stays exactly as it is; match the style, colours and lighting of the picture around it.${r.look === 'vector' ? ' Keep the style exactly: clean, simple shapes with crisp edges, flat colour and soft planes of light and shadow, no texture and no fine detail.' : ''}`;
      if (opt.dry) { console.log(`${name} ${v}: ${CW}×${EH}\n${prompt}`); continue; }
      const piece = await sharp(Buffer.from(input.d.buffer, input.d.byteOffset, input.d.length), { raw: { width: CW, height: EH, channels: 4 } }).png().toBuffer();
      const maskPNG = await sharp(mask, { raw: { width: CW, height: EH, channels: 4 } }).png().toBuffer();
      // a fill made from exactly this picture, mask and prompt before is used again, not paid for twice
      const key = createHash('sha1').update(piece).update(maskPNG).update(prompt).update(quality).digest('hex'), fillFile = join(out, `${v}-fill.png`), keyFile = join(out, `${v}-fill.key`);
      let filled;
      // --reuse keeps the fills already there whatever they were made from: after a split that stopped half way
      if (existsSync(fillFile) && (opt.reuse || (existsSync(keyFile) && (await readFile(keyFile, 'utf8')).trim() === key))) filled = await readFile(fillFile);
      else {
        const got = await edit({ prompt, images: [{ name: 'layer.png', data: piece }], mask: maskPNG, size: `${CW}x${EH}`, quality, n: 1, background: 'opaque' });
        if (!got.images.length) throw new Error('the API returned no image');
        cost += got.cost ?? 0;
        filled = got.images[0];
        await writeFile(fillFile, filled);
        await writeFile(keyFile, key + '\n');
      }
      ({ data } = await sharp(filled).resize(CW, EH, { fit: 'fill' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
      } else if (opt.dry) continue;
      // a nearer thing's soft edge is part of the picture's pixels around it: in this layer those would be a faint copy of
      // its outline, which slides away from it. So this layer's pixels that close to a nearer layer take the colours of
      // its clean pixels next to them instead, from any side; one with none near keeps its own
      const dNear = distanceFrom(hidden, CW, EH), soft = Math.round((cfg.soft ?? 1.5) * res), edge = new Uint8Array(CW * EH);
      for (let i = 0; i < own.length; i++) if (own[i] && dNear[i] <= soft) edge[i] = 1;
      for (let pass = 0; pass <= soft + 1; pass++) {
        const done = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < CW; x++) {
          const i = y * CW + x;
          if (edge[i] !== 1) continue;
          let r = 0, g = 0, b = 0, n = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const xx = x + dx, yy = y + dy, j = yy * CW + xx;
            if (xx < 0 || yy < 0 || xx >= CW || yy >= H || !own[j] || edge[j] === 1) continue;
            r += img.d[j * 4]; g += img.d[j * 4 + 1]; b += img.d[j * 4 + 2]; n++;
          }
          if (n) done.push([i, r / n, g / n, b / n]);
        }
        for (const [i, r, g, b] of done) { img.d[i * 4] = r; img.d[i * 4 + 1] = g; img.d[i * 4 + 2] = b; edge[i] = 2; }
      }
      // inside the picture, only the furthest layer, which nothing is behind, takes the model's painting where nearer
      // layers hide it: its guess there can be anything, even black, and the others need little behind them (below)
      if (k === 0) for (let i = 0; i < hidden.length && i < CW * H; i++) if (hidden[i]) { img.d.set(data.subarray(i * 4, i * 4 + 3), i * 4); img.d[i * 4 + 3] = 255; }
      // past the picture's edges, each side's runs of rows whose edge pixel is in this layer: the edge's own colours carried
      // out, which is all the nearer layers show of their margins as the camera moves (it painted black there, or a
      // border); for the furthest layer, the model's painting where it carries on the picture there. Rows whose edge is in
      // another layer stay empty here: that layer's margin covers them
      for (const side of [-1, 1]) {
        // a layer cut short of the picture's right end has the picture itself there, not a margin to carry out
        if (side > 0 && span < W) continue;
        const edgeOf = (y) => L[y * W + (side < 0 ? 0 : W - 1)];
        for (let y = 0; y < H; y++) {
          if (edgeOf(y) !== k) continue;
          let y2 = y;
          while (y2 + 1 < H && edgeOf(y2 + 1) === k) y2++;
          let diff = 0, n = 0;
          if (data) for (let yy = y; yy <= y2; yy++) for (let j = 0; j < 3; j++) {
            const mi = (yy * CW + (side < 0 ? m - 1 - j : m + W + j)) * 4, pi = (yy * W + (side < 0 ? j : W - 1 - j)) * 4;
            for (let c = 0; c < 3; c++) diff += Math.abs(data[mi + c] - pic.d[pi + c]);
            n += 3;
          }
          const carries = !!data && diff / n < (cfg.marginMatch ?? 16);
          for (let yy = y; yy <= y2; yy++) for (let j = 0; j < m; j++) {
            const i = yy * CW + (side < 0 ? m - 1 - j : m + W + j), pi = (yy * W + (side < 0 ? 2 : W - 3)) * 4;
            img.d.set(carries ? data.subarray(i * 4, i * 4 + 3) : pic.d.subarray(pi, pi + 3), i * 4);
            img.d[i * 4 + 3] = 255;
          }
          y = y2;
        }
      }
      // behind nearer things, row by row: the layers only ever slide sideways, and only a little against each other, so
      // what shows from behind a nearer thing as it slides is the rest of its row. Something narrow (a post, a lamp's head)
      // is bridged from this layer's colours on either side; something wide has the colours of its sides carried in, as
      // far as the layers can slide (the margin), and where it stands against something further away, only half way, the
      // rest left to the layer behind. The furthest layer does the same: the camera only ever shows that much behind an
      // edge, and the model's painting there could be anything, even black, or tear a shape the map cut in two; it keeps
      // the model's painting only deeper in, which is never seen. Colours are taken a pixel or two out from the edge.
      // A scene that scrolls slides its layers far against each other, not the few pixels of a lean: there the furthest
      // layer keeps the model's painting behind nearer things, and a nearer layer carries only long, level runs of its
      // own (a viaduct's deck) behind them, as far as the camera reveals; a narrow upright thing (a pillar, a tower's
      // edge) is not smeared across, and what is behind it shows instead
      const thin = Math.round((cfg.thin ?? 24) * res), rim = 2;
      // in a scene that scrolls, a nearer layer carries nothing behind nearer things: a smear of a tower's base slides
      // into view as a bar. What runs on level behind them is its bands' (below); the furthest layer is painted
      const reach = !scrolls ? m : 0;
      const carryMin = 0;
      for (let y = 0; y < H; y++) {
        const row = y * CW, x0 = m, x1 = m + span - 1;
        const runOf = (x, dir) => { let n = 0; for (let s = x; s >= x0 && s <= x1 && own[row + s] && n < carryMin; s += dir) n++; return n; };
        const from = (x, dir) => { let s = x; for (let r = 0; r < rim && s + dir >= x0 && s + dir <= x1 && own[row + s + dir]; r++) s += dir; return (row + s) * 4; };
        const paint = (x, a, b, t) => { const o = (row + x) * 4; for (let c = 0; c < 3; c++) img.d[o + c] = Math.round(img.d[a + c] * (1 - t) + img.d[b + c] * t); img.d[o + 3] = 255; };
        for (let x = x0; x <= x1; x++) {
          if (!hidden[row + x]) continue;
          let e = x;
          while (e + 1 <= x1 && hidden[row + e + 1]) e++;
          const len = e - x + 1, left = x > x0 && own[row + x - 1], right = e < x1 && own[row + e + 1];
          // what is past each end: this layer, the picture's edge (the margin carries on), or something further away
          const leftEdge = x === x0, rightEdge = e === x1;
          if (left && right && len <= thin) {
            const a = from(x - 1, -1), b = from(e + 1, 1);
            for (let j = 0; j < len; j++) paint(x + j, a, b, (j + 1) / (len + 1));
          } else {
            const share = (otherOwn, otherEdge) => Math.min(reach, otherOwn ? Math.ceil(len / 2) : otherEdge ? len : Math.ceil(len / 2));
            if (left && runOf(x - 1, -1) >= carryMin) { const a = from(x - 1, -1), n = share(right, rightEdge); for (let j = 0; j < n; j++) paint(x + j, a, a, 0); }
            if (right && runOf(e + 1, 1) >= carryMin) { const b = from(e + 1, 1), n = share(left, leftEdge); for (let j = 0; j < n; j++) paint(e - j, b, b, 0); }
          }
          x = e;
        }
      }
      // a layer's bands (level px): rows of something level that runs on behind nearer things, a viaduct's deck. In them,
      // from the layer's left edge to the row's last own pixel, everything not its own takes the row's median colour: the
      // deck carries on behind a building as the camera slides them apart, with no shape of the building in it, and with
      // no sliver of the city between two of its pieces
      for (const [b0, b1] of layer.bands ?? []) for (let y = Math.round(b0 * res); y < Math.min(H, Math.round(b1 * res)); y++) {
        const row = y * CW, cols = [[], [], []];
        let last = -1;
        for (let x = m; x < m + span; x++) if (own[row + x]) { last = x; for (let c = 0; c < 3; c++) cols[c].push(img.d[(row + x) * 4 + c]); }
        if (last < 0) continue;
        const med = cols.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
        for (let x = 0; x <= last; x++) if (!own[row + x]) { img.d.set(med, (row + x) * 4); img.d[(row + x) * 4 + 3] = 255; }
      }
      // a layer's pillars: a column it repeats (a viaduct's pillars), copied from one it shows (`template`, level px) to
      // every `every` px from `from`, where nearer things hide all of where it would stand: the deck does not float over a
      // long span as the camera slides a building away from in front of it. Nowhere the picture shows something else
      const P = layer.pillars;
      if (P) {
        const [y0, y1] = P.rows.map((v) => Math.round(v * res)), [t0, t1] = P.template.map((v) => Math.round(v * res)), pw = t1 - t0;
        const tpl = [];
        for (let y = y0; y < Math.min(H, y1); y++) for (let x = 0; x < pw; x++) tpl.push(img.d.slice((y * CW + m + t0 + x) * 4, (y * CW + m + t0 + x) * 4 + 4));
        const first = P.from - Math.floor((P.from - 0) / P.every) * P.every;
        for (let cx = first; cx * res + pw < span; cx += P.every) {
          const x0 = m + Math.round(cx * res);
          let hiddenAll = true;
          for (let y = y0; y < Math.min(H, y1) && hiddenAll; y += 2) for (let x = x0; x < x0 + pw; x++) if (!(hidden[y * CW + x] || past[y * CW + x])) { hiddenAll = false; break; }
          if (!hiddenAll) continue;
          let k2 = 0;
          for (let y = y0; y < Math.min(H, y1); y++) for (let x = 0; x < pw; x++, k2++) if (tpl[k2][3] > 0) img.d.set(tpl[k2], (y * CW + x0 + x) * 4);
        }
      }
      // see-through windows (cfg.windows, [x, y, w, h] in level px): cut out of every layer nearer than the furthest, which
      // the image model painted behind them, as the map gives them to a nearer layer. The city through a window then
      // slides with the city as the camera leans, not with the wall
      if (k > 0) for (const [wx, wy, ww, wh] of cfg.windows ?? []) {
        for (let y = Math.max(0, Math.round(wy * res)); y < Math.min(H, Math.round((wy + wh) * res)); y++)
          for (let x = Math.max(0, m + Math.round(wx * res)); x < Math.min(CW, m + Math.round((wx + ww) * res)); x++) img.d[(y * CW + x) * 4 + 3] = 0;
      }
      if (!opt.dry) await writePNG(join(out, `${v}.png`), img);
    }
    if (opt.dry) continue;
    // the layer's recipe: the background's own settings, placed with its margin
    const keep = Object.fromEntries(Object.entries(recipe).filter(([key]) => !['name', 'prompt', 'concierge', 'references', 'conciergeReferences', 'framing', 'size', 'split'].includes(key)));
    // placed by its left margin, which the build centres: a layer cut short is not as wide as the picture
    const layerRecipe = {
      name, prompt: `The ${layer.name} layer of ${r.scene}/${r.name}, cut from its picture by split: change that picture and split it again.`,
      ...keep, position: [(CW / 2 - m) / res, H / res], ...(layer.depth !== undefined ? { depth: layer.depth } : {}), layerOf: `${r.scene}/${r.name}`,
    };
    const layerFile = join(ROOT, 'art', r.scene, `${name}.json`);
    await writeFile(layerFile, JSON.stringify(layerRecipe, null, 2) + '\n');
    await buildOne(layerFile);
    layers.push({ asset: `${r.scene}/${name}`, ...(layer.parallax !== 1 ? { parallax: layer.parallax } : {}) });
  }
  if (opt.dry) return;
  if (cost) console.log(`Cost: $${cost.toFixed(4)}`);
  // the scene: the layers in place of the picture, back to front
  if (typeof opt.scene === 'string') {
    const sceneFile = join(ROOT, 'public/assets/scenes', opt.scene, 'scene.json');
    const scene = JSON.parse(await readFile(sceneFile, 'utf8')), at = scene.layers.findIndex((l) => l.asset === `${r.scene}/${r.name}` || l.asset.startsWith(`${r.scene}/${r.name}-`));
    scene.layers = scene.layers.filter((l) => !(l.asset === `${r.scene}/${r.name}` || l.asset.startsWith(`${r.scene}/${r.name}-`)));
    scene.layers.splice(at < 0 ? 0 : at, 0, ...layers);
    await writeFile(sceneFile, JSON.stringify(scene, null, 1) + '\n');
    console.log(`${rel(sceneFile)}: ${layers.map((l) => l.asset).join(', ')} in place of ${r.scene}/${r.name}`);
  } else console.log(`For the scene file's layers:\n${JSON.stringify(layers, null, 1)}`);
}

/**
 * A picture's wet ground without its painted reflections, for a scene whose reflections the engine makes as the camera
 * moves (the look's "Mirror the set"): painted ones stay put while what they reflect slides. Below `--from` (level
 * pixels), in both views, the ground keeps its broad pools of light but loses the streaks: each stretch of a row takes
 * the colour of its darkest few pixels, smoothed. The pictures before are kept in candidates/; split or build again after.
 */
export async function cmdGround([file], opt) {
  const r = await loadRecipe(file), res = r.res ?? 1, from = Number(opt.from);
  if (!Number.isFinite(from)) throw new Error('usage: ground <recipe> --from <y in level pixels: the reflection line>');
  // --smooth: how far up and down each stretch is averaged, in level pixels; lines across the painted ground (planks, wet
  // ripples) are narrower than that, so they go, and its broad pools of light stay
  const BLOCK = Math.round(24 * res), LOW = 0.12, R = Math.round(Number(opt.smooth ?? 20) * res);
  for (const v of ['raw', 'concierge']) {
    const f = join(r.dir, `${v}.png`);
    if (!existsSync(f)) continue;
    const img = await readRGBA(f), { w, h } = img, y0 = Math.max(0, Math.round(from * res));
    const dir = join(r.dir, 'candidates');
    await mkdir(dir, { recursive: true });
    const keep = join(dir, (await nextName(dir, `${v}-before-ground`))());
    await copyFile(f, keep);
    // each row in blocks: a block's colour is the mean of its darkest pixels, which the streaks of light leave out
    const nb = Math.ceil(w / BLOCK), base = new Float32Array((h - y0) * nb * 3);
    for (let y = y0; y < h; y++) for (let b = 0; b < nb; b++) {
      const px = [];
      for (let x = b * BLOCK; x < Math.min(w, (b + 1) * BLOCK); x++) {
        const i = (y * w + x) * 4;
        px.push([0.2126 * img.d[i] + 0.7152 * img.d[i + 1] + 0.0722 * img.d[i + 2], img.d[i], img.d[i + 1], img.d[i + 2]]);
      }
      px.sort((a, c) => a[0] - c[0]);
      const n = Math.max(1, Math.round(px.length * LOW)), o = ((y - y0) * nb + b) * 3;
      for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) base[o + c] += px[k][c + 1] / n;
    }
    // smoothed across the blocks and down the rows, so the ground is a calm, flat surface
    const rows = h - y0, smooth = new Float32Array(base.length);
    for (let y = 0; y < rows; y++) for (let b = 0; b < nb; b++) for (let c = 0; c < 3; c++) {
      let sum = 0, n = 0;
      for (let dy = -R; dy <= R; dy++) for (let db = -1; db <= 1; db++) {
        const yy = y + dy, bb = b + db;
        if (yy < 0 || yy >= rows || bb < 0 || bb >= nb) continue;
        sum += base[(yy * nb + bb) * 3 + c]; n++;
      }
      smooth[(y * nb + b) * 3 + c] = sum / n;
    }
    for (let y = y0; y < h; y++) for (let x = 0; x < w; x++) {
      // between the centres of the blocks either side
      const fb = Math.max(0, Math.min(nb - 1, (x + 0.5) / BLOCK - 0.5)), b0 = Math.floor(fb), b1 = Math.min(nb - 1, b0 + 1), t = fb - b0, i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) img.d[i + c] = Math.round(smooth[((y - y0) * nb + b0) * 3 + c] * (1 - t) + smooth[((y - y0) * nb + b1) * 3 + c] * t);
    }
    await writePNG(f, img);
    console.log(`${r.name}: ${v} ground below y ${from} without its painted reflections → ${rel(f)} (the old one is ${rel(keep)})`);
  }
}


/**
 * Widen a background to the right by one tile, in both views: a street that scrolls. The image model paints at most
 * three times as wide as high, so a wide picture grows a tile at a time. The Concierge's view first: a frame of
 * `--tile` pixels with the picture's last `--overlap` pixels at its left, the rest painted to continue it as `--prompt`
 * describes. Then raw view: that whole tile redrawn as raw view (`--raw-prompt`), every outline in place, so the two
 * views line up, and joined to the raw picture with a blend over the seam. The old pictures are kept in candidates/.
 */
export async function cmdWiden([file], opt) {
  const r = await loadRecipe(file), quality = opt.quality ?? 'medium';
  const tile = Number(opt.tile ?? 2400), overlap = Number(opt.overlap ?? 960), band = Number(opt.band ?? 96);
  if (typeof opt.prompt !== 'string' || typeof opt['raw-prompt'] !== 'string') throw new Error('usage: widen <recipe> --prompt "what comes next, in the Concierge\'s view" --raw-prompt "the same in raw view" [--tile 2400] [--overlap 960] [--quality medium] [--dry]');
  const cFile = join(r.dir, 'concierge.png'), rFile = join(r.dir, 'raw.png');
  const conc = await readRGBA(cFile), raw = await readRGBA(rFile), { w: W, h: H } = conc;
  if (raw.w !== W || raw.h !== H) throw new Error('the two views must be the same size');
  const H16 = Math.ceil(H / 16) * 16, add = tile - overlap;
  if (tile > 3 * H16) throw new Error(`a tile can be at most three times as wide as high: ${3 * H16}`);
  const keep = r.look === 'vector' ? ' Keep the style exactly: clean, simple shapes with crisp edges, flat colour and soft planes of light and shadow, no texture and no fine detail.' : '';
  const prompt = `Extend this picture to the right into the transparent area of the mask: the same street continues to the right, at the same scale, with the same ground line, the same pavement and wet street along the bottom, the same horizon and the same distant city behind, in exactly the same style, colours, lighting and level of detail. What comes next along the street: ${opt.prompt} Keep everything that is already there exactly as it is. No people, no border.${keep}`;
  console.log(`${r.name}: ${W}×${H} → ${W + add}×${H}: a ${tile}×${H16} tile, ${overlap} px of it the picture's end, ${add} px new, in both views`);
  if (opt.dry) return console.log(`\n${prompt}`);
  const dir = join(r.dir, 'candidates');
  await mkdir(dir, { recursive: true });
  const toPNG = (img) => sharp(Buffer.from(img.d.buffer, img.d.byteOffset, img.d.length), { raw: { width: img.w, height: img.h, channels: 4 } }).png().toBuffer();
  // the frame: the picture's end at the left, a blur of it stretched over the rest for colours to continue from
  const end = blank(overlap, H);
  for (let y = 0; y < H; y++) end.d.set(conc.d.subarray((y * W + W - overlap) * 4, (y * W + W) * 4), y * overlap * 4);
  const blur = await sharp(await toPNG(end)).resize(tile, H16, { fit: 'fill' }).blur(40).ensureAlpha().raw().toBuffer();
  const frame = { w: tile, h: H16, d: new Uint8ClampedArray(blur) };
  for (let y = 0; y < H; y++) frame.d.set(end.d.subarray(y * overlap * 4, (y + 1) * overlap * 4), y * tile * 4);
  const mask = Buffer.alloc(tile * H16 * 4, 255);
  for (let y = 0; y < H16; y++) for (let x = 0; x < tile; x++) if (x >= overlap || y >= H) mask[(y * tile + x) * 4 + 3] = 0;
  const c = await edit({ prompt, images: [{ name: 'frame.png', data: await toPNG(frame) }], mask: await sharp(mask, { raw: { width: tile, height: H16, channels: 4 } }).png().toBuffer(), size: `${tile}x${H16}`, quality, n: 1, background: 'opaque' });
  if (!c.images.length) throw new Error('the API returned no image');
  const painted = await sharp(c.images[0]).resize(tile, H16, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
  // the Concierge's tile: the picture's end exactly as it was, and what was painted after it
  const cTile = blank(tile, H);
  for (let y = 0; y < H; y++) {
    cTile.d.set(end.d.subarray(y * overlap * 4, (y + 1) * overlap * 4), y * tile * 4);
    cTile.d.set(painted.subarray((y * tile + overlap) * 4, (y * tile + tile) * 4), (y * tile + overlap) * 4);
  }
  const n = (await nextName(dir, 'widen-concierge'))();
  await writePNG(join(dir, n), cTile);
  // raw view: the whole tile redrawn, outlines in place, with the raw picture as the style to match
  const refs = [{ name: 'raw-street.png', data: await sharp(rFile).resize(1024, 1024, { fit: 'inside' }).png().toBuffer() }];
  const { REDRESS_REFERENCES_NOTE, redressPrompt } = await import('./style.mjs');
  const rp = `${REDRESS_REFERENCES_NOTE} ${redressPrompt(r, 'raw', `Repaint it as raw view, as simple and flat as it is now, in the colours of the attached street: ${opt['raw-prompt']}`)}`;
  const tilePNG = await sharp(await toPNG(cTile)).extend({ bottom: H16 - H, extendWith: 'copy' }).png().toBuffer();
  const rr = await edit({ prompt: rp, images: [{ name: 'tile.png', data: tilePNG }, ...refs], size: `${tile}x${H16}`, quality, n: 1, background: 'opaque' });
  if (!rr.images.length) throw new Error('the API returned no image');
  const rTile = { w: tile, h: H16, d: new Uint8ClampedArray(await sharp(rr.images[0]).resize(tile, H16, { fit: 'fill' }).ensureAlpha().raw().toBuffer()) };
  await writePNG(join(dir, (await nextName(dir, 'widen-raw'))()), rTile);
  // both pictures one tile wider; raw view blended from its own end into the redrawn tile over the last `band` pixels
  const grow = (pic, t, blend) => {
    const out = blank(W + add, H);
    for (let y = 0; y < H; y++) {
      out.d.set(pic.d.subarray(y * W * 4, (y + 1) * W * 4), y * (W + add) * 4);
      out.d.set(t.d.subarray((y * t.w + overlap) * 4, (y * t.w + tile) * 4), (y * (W + add) + W) * 4);
      if (blend) for (let x = W - band; x < W; x++) {
        const k = (x - (W - band)) / band, s = k * k * (3 - 2 * k), i = (y * (W + add) + x) * 4, j = (y * t.w + overlap - (W - x)) * 4;
        for (let ch = 0; ch < 3; ch++) out.d[i + ch] = Math.round(out.d[i + ch] * (1 - s) + t.d[j + ch] * s);
      }
    }
    return out;
  };
  for (const [f, pic, t, blend, v] of [[cFile, conc, cTile, false, 'concierge'], [rFile, raw, rTile, true, 'raw']]) {
    await copyFile(f, join(dir, (await nextName(dir, `${v}-before-widen`))()));
    await writePNG(f, grow(pic, t, blend));
  }
  const spent = (c.cost ?? 0) + (rr.cost ?? 0);
  console.log(`${r.name}: ${W + add}×${H} in both views (the tiles: candidates/${n} and its raw). Cost: $${spent.toFixed(4)}`);
}
