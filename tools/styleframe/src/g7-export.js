// the shop front's door and stall riser face the street (frontSolid, in g5f): out there, not in the shop
const insideD = (x, y) => frontSolid(x, y) ? 0 : y >= 228 ? (x < 262 ? 0.55 : Math.max(0, 0.55 - (x - 262) / 30)) * Math.max(0, 1 - (y - 228) / 16) : y < 52 ? 0 : x <= 256 ? 1 : x < 268 ? (268 - x) / 12 : y > 212 ? Math.max(0, 1 - (x - 268) / 70) * 0.7 : 0;
const outsideD = (x, y) => frontSolid(x, y) ? 1 : (y < 52 || y >= 228 || x >= 276) ? 1 : x >= 262 ? 0.9 : y > 205 ? Math.max(0.05, 1 - (262 - x) / 60) * 0.55 : Math.max(0.02, 1 - (262 - x) / 26) * 0.35;
/* groups: 0 static, 1 crt, 2 tubes, 3 fire, 4 eye, 5 neon sign, 6 hologram, 7 screen, 8 string lights, 9 offline marker */
/* machines keep their colour in raw view; everything else there is lit sterile white */
const MACHINE = new Set([1, 2, 3, 4, 7, 9]);

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
  // the main street's layers: the sky with the city, the crowd far off, and the street itself. No characters: they are
  // generated sprites placed in the scene, never painted into the set
  const groups = [
    ['sky', () => { drawCity(); drawMidground(); }],
    ['crowd', () => drawCrowd()],
    ['set', () => { drawRoom(); drawProps(); drawFront(); drawGround(); drawKiosk(); drawStreet(); }],
  ];
  const out = { groups: {} }; let inn = null;
  for (const [name, fn] of groups) { resetG(); fn(); out.groups[name] = encodeGroup(); if (name === 'set') inn = G.inn.slice(); }
  // the level's zone map: r = inside, g = outside, b = static ambient occlusion (the shop's floor line and ceiling)
  const zd = new ImageData(NW, NH);
  for (let y = 0; y < NH; y++) for (let x = 0; x < NW; x++) { const p = y * NW + x, t = p * 4; let ao = 1;
    if (inn[p]) { if (y > 420 && y < 436) ao *= 0.6 + 0.4 * Math.abs(y - 428) / 8; if (y < 132) ao *= 0.6 + 0.4 * (y - 104) / 28; }
    zd.data[t] = Math.round(insideD(x / S2, y / S2) * 255); zd.data[t + 1] = Math.round(outsideD(x / S2, y / S2) * 255); zd.data[t + 2] = Math.round(Math.max(0, Math.min(1, ao)) * 255); zd.data[t + 3] = 255; }
  const cv = document.createElement('canvas'); cv.width = NW; cv.height = NH; cv.getContext('2d').putImageData(zd, 0, 0); out.zone = cv.toDataURL('image/png');
  document.documentElement.setAttribute('data-export', JSON.stringify(out));
}
const FONTS = ['300 20px Jost', '400 20px Jost', '700 20px "Playfair Display"', 'italic 600 20px "Playfair Display"', '400 20px Yellowtail'];
Promise.race([Promise.all(FONTS.map(f => document.fonts.load(f).catch(() => null))), new Promise(r => setTimeout(r, 2500))]).then(() => { try { exportAll(); } catch (e) { document.documentElement.setAttribute('data-err', String(e && e.stack || e)); } });
