// the shop front's door and stall riser face the street (frontSolid, in g5f): out there, not in the shop
const insideD = (x, y) => frontSolid(x, y) ? 0 : y >= 228 ? (x < 262 ? 0.55 : Math.max(0, 0.55 - (x - 262) / 30)) * Math.max(0, 1 - (y - 228) / 16) : y < 52 ? 0 : x <= 256 ? 1 : x < 268 ? (268 - x) / 12 : y > 212 ? Math.max(0, 1 - (x - 268) / 70) * 0.7 : 0;
const outsideD = (x, y) => frontSolid(x, y) ? 1 : (y < 52 || y >= 228 || x >= 276) ? 1 : x >= 262 ? 0.9 : y > 205 ? Math.max(0.05, 1 - (262 - x) / 60) * 0.55 : Math.max(0.02, 1 - (262 - x) / 26) * 0.35;
/* groups: 0 static, 1 crt, 2 tubes, 3 fire, 4 eye, 5 neon sign, 6 hologram, 7 screen, 8 string lights, 9 offline marker */
/* machines keep their colour in raw view; everything else there is lit sterile white */
const MACHINE = new Set([1, 2, 3, 4, 7, 9]);
function sceneLights() {
  const L = (o) => Object.assign({ z: 30, zone: 0, i: 1, wrap: 0.3, haze: 0 }, o);
  return [
    L({ x: 300, y: 158, z: 70, r: 360, c: [1.0, 0.62, 0.3], i: 2.6, zone: 1, shadow: 1, haze: 0.35 }),
    L({ x: 126, y: 344, z: 34, r: 200, c: [1.0, 0.6, 0.28], i: 1.6, zone: 1, shadow: 1 }),
    L({ x: 452, y: 284, z: 26, r: 210, c: [1.0, 0.78, 0.5], i: 2.6, zone: 1, cone: [-0.42, 0.91, 0.5], shadow: 1, haze: 0.6 }),
    L({ x: 66, y: 380, z: 22, r: 170, c: [1.0, 0.58, 0.28], i: 1.2, zone: 1 }),
    L({ x: 330, y: 270, z: 16, r: 150, c: [1.0, 0.6, 0.22], i: 0.8, zone: 1 }),
    L({ x: 240, y: 150, z: 18, r: 300, c: [1.0, 0.62, 0.3], i: 0.5, zone: 1, g: 8 }),
    L({ x: 482, y: 160, z: 16, r: 90, c: [1.0, 0.65, 0.25], i: 0.8, zone: 1 }),
    L({ x: 292, y: 322, z: 22, r: 160, c: [0.3, 1.0, 0.55], i: 1.2, zone: 1, g: 1, machine: 1 }),
    L({ x: 390, y: 340, z: 14, r: 96, c: [1.0, 0.45, 0.15], i: 1.4, zone: 1, g: 2, machine: 1 }),
    L({ x: 504, y: 408, z: 10, r: 70, c: [0.5, 0.6, 1.0], i: 0.9, zone: 1, g: 3, machine: 1 }),
    L({ x: 160, y: 14, z: 30, r: 170, c: [1.0, 0.72, 0.42], i: 1.5, zone: 3, cone: [0.15, 0.99, 0.1] }),
    L({ x: 388, y: 14, z: 30, r: 170, c: [1.0, 0.72, 0.42], i: 1.5, zone: 3, cone: [0.15, 0.99, 0.1] }),
    L({ x: 720, y: 470, z: 90, r: 460, c: [0.35, 0.22, 0.6], i: 0.5, zone: 2, layer: 1 }),
    L({ x: 636, y: 154, z: 34, r: 510, c: [0.85, 0.97, 1.0], i: 2.6, zone: 2, cone: [0, 1, 0.3], shadow: 1, haze: 0.45, layer: 1 }),
    L({ x: 882, y: 404, z: 12, r: 100, c: [0.4, 0.8, 1.0], i: 0.7, zone: 2, g: 6, ar: 1 }),
    L({ x: 932, y: 446, z: 8, r: 90, c: [1.0, 0.6, 0.25], i: 1.0, zone: 2 }),
    L({ x: 796, y: 316, z: 34, r: 360, c: [0.55, 0.95, 1.0], i: 2.4, zone: 2, g: 4, shadow: 1, haze: 0.12, ex: 1, machine: 1 }),
    L({ x: 796, y: 420, z: 12, r: 80, c: [0.4, 0.85, 1.0], i: 0.8, zone: 2, g: 4, ex: 1, machine: 1 }),
    L({ x: 796, y: 376, z: 10, r: 110, c: [1.0, 0.25, 0.6], i: 1.0, zone: 2, g: 7, ar: 1 }),
    L({ x: 930, y: 172, z: 26, r: 400, c: [1.0, 0.16, 0.1], i: 2.0, zone: 2, g: 5, haze: 0.3 }),
    L({ x: 708, y: 130, z: 70, r: 500, c: [0.3, 0.75, 1.0], i: 0.9, zone: 4, g: 6, ar: 1, haze: 0.4 }),
    L({ x: 728, y: 96, z: 24, r: 320, c: [0.8, 0.5, 1.0], i: 0.5, zone: 4, g: 6, ar: 1 }),
    L({ x: 610, y: 312, z: 16, r: 150, c: [1.0, 0.25, 0.65], i: 0.8, zone: 2, g: 6, ar: 1 }),
    L({ x: 664, y: 410, z: 16, r: 110, c: [0.25, 1.0, 0.8], i: 0.8, zone: 2, g: 6, ar: 1 }),
    L({ x: 942, y: 374, z: 18, r: 170, c: [1.0, 0.62, 0.3], i: 1.4, zone: 2, cone: [0, 1, 0.25], haze: 0.5, layer: 1 }),
    L({ x: 486, y: 250, z: 70, r: 240, c: [1.0, 0.66, 0.38], i: 1.6, zone: 2, wrap: 0.2, cone: [0.6, 0.8, 0.25], layer: 1 }),
    L({ x: 620, y: 330, z: 45, r: 170, c: [0.55, 0.72, 1.0], i: 0.7, zone: 2, wrap: 0.2, cone: [-0.95, 0.3, 0.2], layer: 1 }),
    L({ x: 546, y: 336, z: 12, r: 46, c: [0.4, 0.95, 1.0], i: 1.0, zone: 0, g: 6, ar: 1 }),
  ];
}

function encodeGroup() {
  let x0 = NW, y0 = NH, x1 = -1, y1 = -1;
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) { const p = y * NW + x; if (Math.max(G.covR[p], G.covC[p]) > 0.02) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } }
  if (x1 < 0) return null;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, mk = () => new ImageData(w, h), b8 = v => Math.max(0, Math.min(255, Math.round(v * 255)));
  const img = { 'albedo.raw': mk(), 'albedo.concierge': mk(), normal: mk(), material: mk(), meta: mk(), 'glow.raw': mk(), 'glow.concierge': mk() };
  const H = (x, y) => G.hgt[Math.max(0, Math.min(NH - 1, y)) * NW + Math.max(0, Math.min(NW - 1, x))];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const x = x0 + i, y = y0 + j, p = y * NW + x, q = p * 3, t = (j * w + i) * 4, cr = G.covR[p], cc = G.covC[p];
    const un = cr > 0.02 ? 1 / Math.min(1, cr) : 0;
    const a = img['albedo.raw'].data, c = img['albedo.concierge'].data;
    a[t] = b8(G.alb[q] * un); a[t + 1] = b8(G.alb[q + 1] * un); a[t + 2] = b8(G.alb[q + 2] * un); a[t + 3] = b8(cr);
    const ar = G.arm[p] && cc > 0.02;
    c[t] = ar ? b8(G.albA[q]) : a[t]; c[t + 1] = ar ? b8(G.albA[q + 1]) : a[t + 1]; c[t + 2] = ar ? b8(G.albA[q + 2]) : a[t + 2]; c[t + 3] = b8(Math.max(cr, cc));
    let nx = -(H(x + 1, y) - H(x - 1, y)) * 5, ny = -(H(x, y + 1) - H(x, y - 1)) * 5, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
    const n = img.normal.data; n[t] = b8(nx * 0.5 + 0.5); n[t + 1] = b8(ny * 0.5 + 0.5); n[t + 2] = b8(nz * 0.5 + 0.5); n[t + 3] = 255;
    const m = img.material.data; m[t] = b8(G.spec[p]); m[t + 1] = b8(G.shin[p]); m[t + 2] = b8(G.hgt[p]); m[t + 3] = 255;
    const me = img.meta.data; me[t] = (G.occ[p] ? 128 : 0) + (ar ? 64 : 0) + Math.min(63, G.obj[p]); me[t + 1] = Math.min(3, G.dep[p]) * 64 + Math.min(2, G.refl[p]) * 16 + (MACHINE.has(G.ehg[p]) ? 1 : 0); me[t + 2] = Math.min(15, G.ehg[p]) * 16 + Math.min(15, G.eag[p]); me[t + 3] = 255;
    const gr = img['glow.raw'].data, gc = img['glow.concierge'].data, off = G.ehg[p] === 9 ? 0 : 1;
    for (let k = 0; k < 3; k++) { gr[t + k] = b8(G.eh[q + k] / 2); gc[t + k] = b8((G.eh[q + k] * off + G.ea[q + k]) / 2); }
    gr[t + 3] = gc[t + 3] = 255;
  }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const cx = cv.getContext('2d');
  const files = {}; for (const k in img) { cx.clearRect(0, 0, w, h); cx.putImageData(img[k], 0, 0); files[k] = cv.toDataURL('image/png'); }
  return { x: x0, y: y0, w, h, files };
}
function exportAll() {
  const groups = [
    ['sky-city', () => { drawCity(); drawMidground(); }],
    // no characters in the set: the fixer works inside the shop, which is a scene of its own
    ['street', () => { drawRoom(); drawProps(); drawFront(); drawGround(); drawKiosk(); drawStreet(); }],
    ['crowd', () => drawCrowd()], ['docked', () => drawDocked()], ['hero', () => drawHero()],
  ];
  const out = { groups: {} }; let inn = null;
  for (const [name, fn] of groups) { resetG(); fn(); out.groups[name] = encodeGroup(); if (name === 'street') inn = G.inn.slice(); }
  // the level's zone map: r = inside, g = outside, b = static ambient occlusion (the shop's floor line and ceiling)
  const zd = new ImageData(NW, NH);
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) { const p = y * NW + x, t = p * 4; let ao = 1;
    if (inn[p]) { if (y > 420 && y < 436) ao *= 0.6 + 0.4 * Math.abs(y - 428) / 8; if (y < 132) ao *= 0.6 + 0.4 * (y - 104) / 28; }
    zd.data[t] = Math.round(insideD(x / S2, y / S2) * 255); zd.data[t + 1] = Math.round(outsideD(x / S2, y / S2) * 255); zd.data[t + 2] = Math.round(Math.max(0, Math.min(1, ao)) * 255); zd.data[t + 3] = 255; }
  const cv = document.createElement('canvas'); cv.width = NW; cv.height = NH; cv.getContext('2d').putImageData(zd, 0, 0); out.zone = cv.toDataURL('image/png');
  out.lights = sceneLights(); out.beacons = SC.beacons; out.steam = [636, 466, 140, 14, 565, 249, 90, -5]; out.godrays = [636, 152, 0.35, 2, 708, 110, 0.22, 2, 796, 316, 0.25, 2, 300, 154, 0.3, 1];
  document.documentElement.setAttribute('data-export', JSON.stringify(out));
}
const FONTS = ['300 20px Jost', '400 20px Jost', '700 20px "Playfair Display"', 'italic 600 20px "Playfair Display"', '400 20px Yellowtail'];
Promise.race([Promise.all(FONTS.map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 2500))]).then(() => { try { exportAll(); } catch (e) { document.documentElement.setAttribute('data-err', String(e && e.stack || e)); } });
