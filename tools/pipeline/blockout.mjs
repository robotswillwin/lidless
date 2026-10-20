// Blockouts: a room built from simple boxes, in metres, and drawn in true perspective as a flat guide for
// `generate --layout`. Every object gets its real size against the characters, so the image model paints a place
// people could use: a bench at hip height, tools within reach, a door taller than a person.
//
// The camera looks straight at the back wall from Luna's eye height. Two numbers set the scale: pixels per metre at the
// back wall, and pixels per metre where the characters walk, some way in front of it (Luna, 1.7 m, is 240 px there).
// Everything else follows from the perspective, so near things are bigger and far things smaller, as they should be.

import sharp from 'sharp';

/** The game's camera for a room. Sizes are in game pixels (the scene is drawn at 960×540 and scrolls). */
export function camera({ width = 1016, height = 540, wallScale = 110, charScale = 141, walkDepth = 1.4, walkY = 500, eye = 1.6 } = {}) {
  // f / C is the scale at the wall, f / (C - walkDepth) where the characters walk: two equations for the camera's
  // distance from the wall (C) and its focal length (f)
  const C = walkDepth / (1 - wallScale / charScale), f = wallScale * C, horizon = walkY - charScale * eye, cx = width / 2;
  const project = ([x, h, d]) => { const z = Math.max(0.05, C - d); return [cx + (f * x) / z, horizon - (f * (h - eye)) / z]; };
  return { C, f, horizon, cx, width, height, eye, wallScale, charScale, walkDepth, walkY, project };
}

const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `rgb(${c.join(',')})`;
};

/**
 * A box from x0..x1 (metres right of the camera's axis), h0..h1 (above the floor), d0..d1 (in front of the back wall):
 * its visible faces, far ones first. The top shows when it is below the eye, the underside when above, and the side
 * that faces the axis.
 */
function boxFaces(cam, { x: [x0, x1], h: [h0, h1], d: [d0, d1] }) {
  const P = (x, h, d) => cam.project([x, h, d]), faces = [];
  if (h1 < cam.eye) faces.push(['top', [P(x0, h1, d0), P(x1, h1, d0), P(x1, h1, d1), P(x0, h1, d1)]]);
  if (h0 > cam.eye) faces.push(['bottom', [P(x0, h0, d0), P(x1, h0, d0), P(x1, h0, d1), P(x0, h0, d1)]]);
  if (x0 > 0) faces.push(['side', [P(x0, h0, d0), P(x0, h1, d0), P(x0, h1, d1), P(x0, h0, d1)]]);
  if (x1 < 0) faces.push(['side', [P(x1, h0, d0), P(x1, h1, d0), P(x1, h1, d1), P(x1, h0, d1)]]);
  faces.push(['front', [P(x0, h0, d1), P(x1, h0, d1), P(x1, h1, d1), P(x0, h1, d1)]]);
  return faces;
}

const LIGHT = { front: 1, top: 1.18, bottom: 0.72, side: 0.82 };

/**
 * Draw a blockout as an SVG the size of the generated image. spec: { camera, room: { width, height, colours },
 * objects: [{ x, h, d, colour, detail? }] }. Details add what tells a shape apart: shelves, books, a screen, a door,
 * a pegboard with its tools, a dial, a lamp shade. No text, no people.
 */
export function blockoutSVG(spec, outW = 2048, outH = 1088) {
  const cam = camera(spec.camera), kx = outW / cam.width, ky = outH / cam.height;
  const pt = ([x, y]) => `${(x * kx).toFixed(1)},${(y * ky).toFixed(1)}`;
  const poly = (pts, fill, stroke = 'rgb(28,28,30)', sw = 2) => `<polygon points="${pts.map(pt).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
  const P = (x, h, d) => cam.project([x, h, d]);
  const { width: W, height: H, colours: rc = {} } = spec.room, hw = W / 2, deep = 12;
  const out = [];
  // the room: floor, ceiling, side walls, back wall
  out.push(poly([P(-hw, 0, 0), P(hw, 0, 0), P(hw, 0, deep), P(-hw, 0, deep)], rc.floor ?? '#5a5450'));
  out.push(poly([P(-hw, H, 0), P(hw, H, 0), P(hw, H, deep), P(-hw, H, deep)], rc.ceiling ?? '#6a6662'));
  out.push(poly([P(-hw, 0, 0), P(-hw, H, 0), P(-hw, H, deep), P(-hw, 0, deep)], rc.side ?? '#77716c'));
  out.push(poly([P(hw, 0, 0), P(hw, H, 0), P(hw, H, deep), P(hw, 0, deep)], rc.side ?? '#77716c'));
  out.push(poly([P(-hw, 0, 0), P(hw, 0, 0), P(hw, H, 0), P(-hw, H, 0)], rc.wall ?? '#8a847e'));
  // things, far ones first, so nearer ones cover them
  const things = [...spec.objects].sort((a, b) => a.d[1] - b.d[1]);
  for (const o of things) {
    if (o.wall === 'left' || o.wall === 'right') {
      // something flat on a side wall (a door, a window): x is the wall, d its extent along it
      const x = o.wall === 'left' ? -hw : hw;
      out.push(poly([P(x, o.h[0], o.d[0]), P(x, o.h[1], o.d[0]), P(x, o.h[1], o.d[1]), P(x, o.h[0], o.d[1])], shade(o.colour, 0.9)));
      if (o.detail === 'door') {
        const m = 0.08;
        out.push(poly([P(x, o.h[0] + 1.0, o.d[0] + m), P(x, o.h[0] + 1.05, o.d[0] + m), P(x, o.h[0] + 1.05, o.d[0] + m + 0.12), P(x, o.h[0] + 1.0, o.d[0] + m + 0.12)], '#c8c0b0'));
        out.push(poly([P(x, o.h[0] + 1.25, o.d[0] + 0.15), P(x, o.h[1] - 0.15, o.d[0] + 0.15), P(x, o.h[1] - 0.15, o.d[1] - 0.15), P(x, o.h[0] + 1.25, o.d[1] - 0.15)], shade(o.colour, 0.75)));
      }
      continue;
    }
    for (const [face, pts] of boxFaces(cam, o)) out.push(poly(pts, shade(o.colour, LIGHT[face])));
    const [x0, x1] = o.x, [h0, h1] = o.h, d = o.d[1] + 0.001, w = x1 - x0, ht = h1 - h0;
    const rect = (ax0, ah0, ax1, ah1, fill, sw = 1.5) => poly([P(ax0, ah0, d), P(ax1, ah0, d), P(ax1, ah1, d), P(ax0, ah1, d)], fill, 'rgb(28,28,30)', sw);
    if (o.detail === 'shelves' || o.detail === 'books') {
      const levels = o.shelves ?? 5, rnd = mulberry(Math.round(x0 * 1000));
      for (let i = 0; i <= levels; i++) {
        const sh = h0 + (ht * i) / levels;
        out.push(rect(x0, sh - 0.025, x1, sh + 0.015, shade(o.colour, 1.1)));
        if (i === levels) break;
        // what stands on it: books and boxes, or small radios, to scale
        let x = x0 + 0.04;
        while (x < x1 - 0.12) {
          const radio = rnd() < (o.radios ?? 0.3), bw = radio ? 0.22 + rnd() * 0.14 : 0.03 + rnd() * 0.03, bh = radio ? 0.16 + rnd() * 0.1 : 0.2 + rnd() * 0.08;
          if (x + bw > x1 - 0.03) break;
          const top = Math.min(sh + 0.015 + bh, h0 + (ht * (i + 1)) / levels - 0.05);
          out.push(rect(x, sh + 0.015, x + bw, top, radio ? shade('#6e6a64', 0.9 + rnd() * 0.3) : shade(['#7a4a3a', '#3e4a5e', '#6a6a48', '#8a7a5a', '#4a3a3a'][Math.floor(rnd() * 5)], 1)));
          if (radio) out.push(circle(cam, [x + bw * 0.72, sh + 0.015 + (top - sh) * 0.5, d + 0.002], Math.min(bw, top - sh) * 0.22, '#d8d0b8', kx, ky));
          x += bw + 0.01 + (radio ? 0.04 : 0);
        }
      }
    }
    if (o.detail === 'pegboard') {
      for (let hh = h0 + 0.05; hh < h1 - 0.02; hh += 0.05) for (let xx = x0 + 0.05; xx < x1 - 0.02; xx += 0.05) out.push(circle(cam, [xx, hh, d], 0.006, '#3a3430', kx, ky));
      // hand tools at their real sizes: screwdrivers, pliers, wrenches, a hammer, a coil of wire
      const tools = o.tools ?? [];
      for (const t of tools) out.push(rect(t.x, t.h, t.x + t.w, t.h + t.l, t.colour ?? '#9a9890', 1));
    }
    if (o.detail === 'screen') out.push(rect(x0 + w * 0.12, h0 + ht * 0.2, x1 - w * 0.12, h1 - ht * 0.12, o.screen ?? '#2f6a3a'));
    if (o.detail === 'scope') { out.push(circle(cam, [x0 + w * 0.35, h0 + ht * 0.55, d], Math.min(w, ht) * 0.28, o.screen ?? '#2f6a3a', kx, ky)); for (const k of [0.75, 0.88]) out.push(circle(cam, [x0 + w * k, h0 + ht * 0.4, d], 0.015, '#d8d0b8', kx, ky)); }
    if (o.detail === 'radio') { out.push(rect(x0 + w * 0.08, h0 + ht * 0.15, x0 + w * 0.5, h1 - ht * 0.15, shade(o.colour, 0.7))); out.push(circle(cam, [x0 + w * 0.72, h0 + ht * 0.55, d], Math.min(w, ht) * 0.2, '#d8d0b8', kx, ky)); }
    if (o.detail === 'door') { out.push(rect(x0 + 0.08, h0 + 1.05, x1 - 0.08, h1 - 0.1, shade(o.colour, 0.85))); out.push(rect(x0 + 0.08, h0 + 0.1, x1 - 0.08, h0 + 0.95, shade(o.colour, 0.85))); out.push(rect(x1 - 0.14, h0 + 0.98, x1 - 0.07, h0 + 1.03, '#c8c0b0')); }
    if (o.detail === 'ajar') { out.push(rect(x1 - (o.gap ?? 0.25), h0, x1, h1, '#1a1612')); }
    if (o.detail === 'paper') out.push(rect(x0 + w * 0.1, h0 + ht * 0.1, x1 - w * 0.1, h1 - ht * 0.1, shade(o.colour, 0.85), 1));
    if (o.detail === 'clock') out.push(circle(cam, [(x0 + x1) / 2, (h0 + h1) / 2, d], Math.min(w, ht) * 0.42, '#e8e2d4', kx, ky));
    if (o.detail === 'shade') out.push(poly([P(x0 - 0.06, h0, d), P(x1 + 0.06, h0, d), P(x1 - 0.04, h1, d), P(x0 + 0.04, h1, d)], o.shade ?? '#e0c890'));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}"><rect width="100%" height="100%" fill="#202022"/>${out.join('')}</svg>`;
}

function circle(cam, [x, h, d], r, fill, kx, ky) {
  const [cx, cy] = cam.project([x, h, d]), s = cam.f / (cam.C - d);
  return `<ellipse cx="${(cx * kx).toFixed(1)}" cy="${(cy * ky).toFixed(1)}" rx="${(r * s * kx).toFixed(1)}" ry="${(r * s * ky).toFixed(1)}" fill="${fill}" stroke="rgb(28,28,30)" stroke-width="1"/>`;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The blockout as a PNG, the size of the image to generate. */
export async function blockoutPNG(spec, outW = 2048, outH = 1088) {
  return sharp(Buffer.from(blockoutSVG(spec, outW, outH))).png().toBuffer();
}

/** Where a point of the room lands in the scene, in game pixels: for placing hotspots, lights and characters. */
export function toScene(spec, p) {
  return camera(spec.camera).project(p);
}
