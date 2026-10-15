'use strict';
/* Scene is designed in 480×270 units and rendered at 960×540: every surface gets albedo, height (for normals),
   specular, occlusion, emissive and zone data, and a WebGL pass lights it. */
const NW = 960, NH = 540, N = NW * NH, S2 = 2, TAU = Math.PI * 2;
const QS = new URLSearchParams(location.search);
const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
function rngOf(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function kit(seed) { const r = rngOf(seed), R = (a, b) => a + (b - a) * r(); return { r, R, RI: (a, b) => Math.floor(R(a, b + 1)), pick: a => a[Math.floor(r() * a.length)], chance: p => r() < p }; }
const C = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
const P = {
  w0: C('#0d0806'), w1: C('#1c110c'), w2: C('#2e1b12'), w3: C('#452717'), w4: C('#63361c'), w5: C('#8a4a22'), w6: C('#b0642a'), w7: C('#d48a3a'), w8: C('#f0b25a'), w9: C('#ffd88a'), wA: C('#fff1c8'),
  c0: C('#05070d'), c1: C('#0a0f1d'), c2: C('#111a31'), c3: C('#1a2846'), c4: C('#243b5e'), c5: C('#2e5478'), c6: C('#3c7090'), c7: C('#4f94a8'), c8: C('#6cc4c8'), c9: C('#a6f0ea'), cA: C('#e2fffa'),
  m1: C('#2a0b26'), m2: C('#4c1340'), m3: C('#7c1b5a'), m4: C('#b62a78'), m5: C('#ea4596'), m6: C('#ff7cbe'), m7: C('#ffc4e2'),
  v1: C('#160f2c'), v2: C('#241a46'), v3: C('#382a66'), v4: C('#523e90'),
  n0: C('#08080a'), n1: C('#141317'), n2: C('#24222a'), n3: C('#36333a'), n4: C('#4c4850'), n5: C('#6a6468'), n6: C('#8e8682'), n7: C('#b9ada2'),
  r1: C('#1f0708'), r2: C('#4a0f12'), r3: C('#7a1a1c'), r4: C('#a8282a'), r5: C('#d84a3e'), r6: C('#ff7a62'), r7: C('#ffc0b0'),
  g1: C('#0b2a1c'), g2: C('#15603a'), g3: C('#3fbf6a'), g4: C('#a8ffbe'), sk: C('#c48a62'), sk2: C('#8a5a40'),
};
/* noise */
const PERM = (() => { const r = rngOf(1234), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } const o = new Uint8Array(512); for (let i = 0; i < 512; i++) o[i] = p[i & 255]; return o; })();
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), h = (a, b) => PERM[(PERM[a & 255] + b) & 255] / 255; const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
function fbm(x, y, oct = 4) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.3, y * f + i * 9.1); n += a; f *= 2.03; a *= 0.5; } return s / n; }
const hash2 = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/* the buffers */
const G = {
  alb: new Float32Array(N * 3), albA: new Float32Array(N * 3), arm: new Uint8Array(N), hgt: new Float32Array(N).fill(0.5), spec: new Float32Array(N), shin: new Float32Array(N),
  occ: new Uint8Array(N), obj: new Uint8Array(N), dep: new Uint8Array(N), covR: new Float32Array(N), covC: new Float32Array(N), eh: new Float32Array(N * 3), ehg: new Uint8Array(N), ea: new Float32Array(N * 3), eag: new Uint8Array(N), refl: new Uint8Array(N), inn: new Uint8Array(N),
};
/* anti-aliased coverage of a canvas path drawn in design units */
const CV = document.createElement('canvas'); CV.width = NW; CV.height = NH; const CX = CV.getContext('2d', { willReadFrequently: true });
function cover(draw, bx, by, bw, bh) {
  const x0 = Math.max(0, Math.floor(bx * S2) - 2), y0 = Math.max(0, Math.floor(by * S2) - 2), x1 = Math.min(NW, Math.ceil((bx + bw) * S2) + 2), y1 = Math.min(NH, Math.ceil((by + bh) * S2) + 2);
  const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return null;
  CX.setTransform(1, 0, 0, 1, 0, 0); CX.clearRect(x0, y0, w, h); CX.setTransform(S2, 0, 0, S2, 0, 0); CX.fillStyle = '#fff'; CX.beginPath(); draw(CX); CX.fill();
  const d = CX.getImageData(x0, y0, w, h).data, c = new Float32Array(w * h); for (let i = 0; i < c.length; i++) c[i] = d[i * 4 + 3] / 255;
  return { x0, y0, w, h, c };
}
const R = (x, y, w, h) => cover(c => c.rect(x, y, w, h), x, y, w, h);
const E = (cx, cy, rx, ry) => cover(c => c.ellipse(cx, cy, rx, ry, 0, 0, TAU), cx - rx, cy - ry, rx * 2, ry * 2);
function smoothAdd(ctx, p, closed = true) {
  const n = p.length, get = i => closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))];
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 0; i < (closed ? n : n - 1); i++) { const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2); ctx.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]); }
  if (closed) ctx.closePath();
}
function PL(pts, sm = true, tf) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const q = tf ? pts.map(tf) : pts; for (const [x, y] of q) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return cover(c => { if (sm) smoothAdd(c, q); else { c.moveTo(q[0][0], q[0][1]); for (const [x, y] of q.slice(1)) c.lineTo(x, y); c.closePath(); } }, x0, y0, x1 - x0, y1 - y0); }
function LN(x0, y0, x1, y1, w) { const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L * w / 2, ny = dx / L * w / 2; return PL([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], false); }
function dist(cv) {
  const { w, h, c } = cv, D = new Float32Array(w * h);
  for (let i = 0; i < D.length; i++) D[i] = c[i] > 0.5 ? 1e9 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (!D[i]) continue; let m = D[i]; if (x > 0) m = Math.min(m, D[i - 1] + 1); if (y > 0) { m = Math.min(m, D[i - w] + 1); if (x > 0) m = Math.min(m, D[i - w - 1] + 1.414); if (x < w - 1) m = Math.min(m, D[i - w + 1] + 1.414); } D[i] = m; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (!D[i]) continue; let m = D[i]; if (x < w - 1) m = Math.min(m, D[i + 1] + 1); if (y < h - 1) { m = Math.min(m, D[i + w] + 1); if (x < w - 1) m = Math.min(m, D[i + w + 1] + 1.414); if (x > 0) m = Math.min(m, D[i + w - 1] + 1.414); } D[i] = m; }
  return D;
}
function resetG() { for (const k in G) G[k].fill(k === 'hgt' ? 0.5 : 0); }
let OBJ = 0; /* object id for the fills that follow; a light can skip one object (the kiosk is not lit by its own eye) */
/* paint a material into the buffers. m: { alb, h, bevel, bh, round, rh, spec, shin, occ, dep, refl, inn, eh, ehg, keepE } */
function fill(cv, m) {
  if (!cv) return; const { x0, y0, w, h, c } = cv, D = (m.bevel || m.round || m.useD) ? dist(cv) : null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const a = c[j * w + i]; if (a <= 0.03) continue;
    const x = x0 + i, y = y0 + j, p = y * NW + x, q = p * 3, d = D ? D[j * w + i] : 0, info = { u: i / w, v: j / h, d };
    const aa = Math.min(1, a * 1.1);
    if (m.alb || (m.eh && !m.arAlb && !m.ea)) G.covR[p] = Math.max(G.covR[p], aa);
    if (m.arAlb || (m.ea && !m.alb)) G.covC[p] = Math.max(G.covC[p], aa);
    const col = typeof m.alb === 'function' ? m.alb(x, y, info) : m.alb;
    if (col) { G.alb[q] += (col[0] - G.alb[q]) * aa; G.alb[q + 1] += (col[1] - G.alb[q + 1]) * aa; G.alb[q + 2] += (col[2] - G.alb[q + 2]) * aa; }
    let hh = typeof m.h === 'function' ? m.h(x, y, info) : (m.h ?? 0.5);
    if (m.bevel) hh += (m.bh ?? 0.25) * smooth(d / m.bevel);
    if (m.round) hh += (m.rh ?? 0.5) * Math.sqrt(Math.min(1, d / m.round));
    if (col) G.hgt[p] += (hh - G.hgt[p]) * aa;
    if (aa > 0.5) {
      if (col) { G.spec[p] = m.spec ?? 0.04; G.shin[p] = m.shin ?? 0.25; G.obj[p] = m.obj ?? OBJ; if (!m.keepE) { G.eh[q] = G.eh[q + 1] = G.eh[q + 2] = 0; G.ea[q] = G.ea[q + 1] = G.ea[q + 2] = 0; } }
      if (m.occ != null) G.occ[p] = m.occ; if (m.dep != null) G.dep[p] = m.dep; if (m.refl != null) G.refl[p] = m.refl; if (m.inn != null) G.inn[p] = m.inn;
    }
    if (m.eh) { const e = typeof m.eh === 'function' ? m.eh(x, y, info) : m.eh; if (e) { G.eh[q] += (e[0] - G.eh[q]) * aa; G.eh[q + 1] += (e[1] - G.eh[q + 1]) * aa; G.eh[q + 2] += (e[2] - G.eh[q + 2]) * aa; if (aa > 0.4) G.ehg[p] = m.ehg || 0; } }
    if (m.ea) { const e = typeof m.ea === 'function' ? m.ea(x, y, info) : m.ea; if (e) { G.ea[q] += (e[0] - G.ea[q]) * aa; G.ea[q + 1] += (e[1] - G.ea[q + 1]) * aa; G.ea[q + 2] += (e[2] - G.ea[q + 2]) * aa; if (aa > 0.4) G.eag[p] = m.eag || 0; } }
    if (m.arAlb) { const e = typeof m.arAlb === 'function' ? m.arAlb(x, y, info) : m.arAlb; G.albA[q] = e[0]; G.albA[q + 1] = e[1]; G.albA[q + 2] = e[2]; if (aa > 0.4) G.arm[p] = 1; }
  }
}
/* painted rim light: the outline of an object catches light from its sides (M from maskOf, box in native px) */
function maskOf(cvs) { const M = new Uint8Array(N); for (const cv of cvs) if (cv) { const { x0, y0, w, h, c } = cv; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (c[j * w + i] > 0.5) M[(y0 + j) * NW + x0 + i] = 1; } return M; }
function rim(M, x0, y0, x1, y1, L, Rt, T, fy) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = y * NW + x; if (!M[p]) continue; const q = p * 3, f = fy ? fy(y) : 1, add = (c, s) => { if (c) { G.eh[q] += c[0] * s * f; G.eh[q + 1] += c[1] * s * f; G.eh[q + 2] += c[2] * s * f; } };
    if (!M[p - 1]) add(L, 1); else if (!M[p - 2]) add(L, 0.3); if (!M[p + 1]) add(Rt, 1); else if (!M[p + 2]) add(Rt, 0.3); if (!M[p - NW]) add(T, 1); }
}
const glowH = (cv, col, grp = 0) => fill(cv, { eh: col, ehg: grp });
const glowA = (cv, col, grp = 6) => fill(cv, { ea: col, eag: grp });
/* material library: albedo and height from per-pixel procedural texture (x, y in native pixels) */
const MAT = {
  brick: (base, mortar, o = {}) => { const bw = o.bw || 18, bh = o.bh || 8, sd = o.seed || 1;
    const cell = (x, y) => { const row = Math.floor(y / bh), off = (row & 1) * (bw >> 1), col = Math.floor((x + off) / bw); return { row, col, lx: x + off - col * bw, ly: y - row * bh }; };
    return { alb: (x, y) => { const { row, col, lx, ly } = cell(x, y); if (lx < 2 || ly < 2) return mixc(mortar, P.w0, fbm(x * 0.3, y * 0.3, 2) * 0.5); const v = hash2(col + sd * 31, row); let c = mixc(base, v > 0.7 ? P.w5 : v < 0.3 ? mulc(base, 0.7) : base, 0.4); c = mulc(c, 0.82 + 0.3 * fbm(x * 0.12, y * 0.12, 3)); const soot = fbm(x * 0.02, y * 0.05, 3); return mixc(c, P.w0, Math.max(0, soot - 0.5) * 1.1); },
      h: (x, y) => { const { lx, ly } = cell(x, y); if (lx < 2 || ly < 2) return 0.18; const e = Math.min(lx - 2, bw - 1 - lx, ly - 2, bh - 1 - ly); return 0.42 + 0.16 * smooth(e / 2.2) + 0.1 * fbm(x * 0.5, y * 0.5, 2) - (hash2(x, y) < 0.02 ? 0.15 : 0); } }; },
  plaster: (base, o = {}) => ({ alb: (x, y) => { let c = mulc(base, 0.78 + 0.4 * fbm(x * 0.018, y * 0.018, 4)); const drip = fbm(x * 0.09, y * 0.008, 3); c = mixc(c, P.w0, Math.max(0, drip - 0.56) * 1.4); if (fbm(x * 0.05 + 40, y * 0.05, 3) > 0.66) c = mixc(c, P.w4, 0.25); return c; }, h: (x, y) => 0.5 + 0.12 * fbm(x * 0.25, y * 0.25, 3) + 0.08 * fbm(x * 0.03, y * 0.03, 2) }),
  wood: (base, o = {}) => ({ alb: (x, y) => { const g = Math.sin(x * (o.dir === 'v' ? 0 : 0.35) + y * (o.dir === 'v' ? 0.35 : 0) + fbm(x * 0.03, y * 0.3, 3) * 9); return mulc(base, 0.86 + 0.1 * g + 0.12 * fbm(x * 0.1, y * 0.1, 2)); }, h: (x, y) => 0.5 + 0.04 * Math.sin(x * 0.35 + fbm(x * 0.03, y * 0.3, 3) * 9) }),
  metal: (base, o = {}) => ({ alb: (x, y) => { let c = mulc(base, 0.9 + 0.16 * fbm(x * 0.06, y * 0.06, 3)); const r = fbm(x * 0.04 + 9, y * 0.04, 4); if (r > (o.rust ?? 0.62)) c = mixc(c, mixc(P.w4, P.w5, fbm(x * 0.2, y * 0.2, 2)), Math.min(1, (r - (o.rust ?? 0.62)) * 6)); if (hash2(x >> 1, y * 3) < 0.004) c = mixc(c, P.n7, 0.5); return c; }, h: (x, y) => 0.5 + 0.03 * fbm(x * 0.4, y * 0.4, 2) }),
  fabric: (base, o = {}) => ({ alb: (x, y) => mulc(base, 0.88 + 0.08 * ((x + y) & 1) + 0.14 * fbm(x * 0.07, y * 0.03, 3)), h: (x, y) => 0.5 + 0.12 * Math.sin(x * (o.fold ?? 0.22) + fbm(x * 0.02, y * 0.02, 2) * 6) + 0.04 * fbm(x * 0.5, y * 0.5, 2) }),
  concrete: (base) => ({ alb: (x, y) => { let c = mulc(base, 0.82 + 0.3 * fbm(x * 0.04, y * 0.04, 4)); if (hash2(x, y) < 0.03) c = mulc(c, 0.7); return c; }, h: (x, y) => 0.5 + 0.08 * fbm(x * 0.3, y * 0.3, 3) }),
};
/* real type as coverage, in design units: x, y is the baseline start (or centre with align). o: { size, font, weight, track, align, italic, stroke } */
function TXT(str, x, y, o = {}) {
  const sz = o.size || 8, font = `${o.italic ? 'italic ' : ''}${o.weight || 400} ${sz * S2}px ${o.font || 'Jost'}`, tr = `${(o.track || 0) * S2}px`;
  const set = c => { c.setTransform(1, 0, 0, 1, 0, 0); c.font = font; c.letterSpacing = tr; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff'; c.strokeStyle = '#fff'; c.lineWidth = (o.stroke || 1) * S2; c.lineJoin = c.lineCap = 'round'; };
  set(CX); const w = CX.measureText(str).width / S2, ax = o.align === 'center' ? x - w / 2 : o.align === 'right' ? x - w : x;
  const cv = cover(c => { set(c); if (o.stroke) c.strokeText(str, ax * S2, y * S2); else c.fillText(str, ax * S2, y * S2); }, ax - 3, y - sz * 1.15, w + 6, sz * 1.6);
  CX.letterSpacing = '0px'; return cv;
}
/* coverage of shape A combined with other shapes: ops = [{ draw, mode: 'in' | 'out', dx, dy }] ('in' keeps the overlap, 'out' cuts the shape away; dx, dy shift it) */
function coverOps(drawA, ops, bx, by, bw, bh) {
  const x0 = Math.max(0, Math.floor(bx * S2) - 2), y0 = Math.max(0, Math.floor(by * S2) - 2), x1 = Math.min(NW, Math.ceil((bx + bw) * S2) + 2), y1 = Math.min(NH, Math.ceil((by + bh) * S2) + 2);
  const w = x1 - x0, h = y1 - y0; if (w <= 0 || h <= 0) return null;
  CX.setTransform(1, 0, 0, 1, 0, 0); CX.clearRect(x0, y0, w, h); CX.setTransform(S2, 0, 0, S2, 0, 0); CX.fillStyle = '#fff'; CX.beginPath(); drawA(CX); CX.fill();
  for (const o of ops) { CX.save(); CX.globalCompositeOperation = o.mode === 'out' ? 'destination-out' : 'destination-in'; CX.translate(o.dx || 0, o.dy || 0); CX.beginPath(); o.draw(CX); CX.fill(); CX.restore(); }
  const d = CX.getImageData(x0, y0, w, h).data, c = new Float32Array(w * h); for (let i = 0; i < c.length; i++) c[i] = d[i * 4 + 3] / 255;
  return { x0, y0, w, h, c };
}
/* painted figures: flat surfaces (no emboss) with light and shadow shapes laid inside each part, like a pixel artist shades.
   painter(ox, oy) works in local units around an anchor; part() paints base + clipped layers; edge() lights one side of a part */
function painter(ox, oy) {
  const tf = ([x, y]) => [ox + x, oy + y];
  const D = (pts, sm = true) => c => { const q = pts.map(tf); if (sm) smoothAdd(c, q); else { c.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) c.lineTo(q[i][0], q[i][1]); c.closePath(); } };
  const BB = pts => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of pts.map(tf)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a - 2, b - 2, c - a + 4, d - b + 4]; };
  const grain = (col, k) => (x, y) => mulc(col, 1 + (fbm(x * 0.21, y * 0.21, 2) - 0.5) * k * 2);
  const part = (pts, col, o = {}) => {
    const d = D(pts, o.sm ?? true), bb = BB(pts), m = { h: 0.5, spec: o.spec ?? 0.03, shin: o.shin ?? 0.3, dep: 3, occ: 1 }, g = o.grain ?? 0.07;
    const tex = c => (c == null ? null : typeof c === 'function' ? c : grain(c, g)), paint = (cv, c, a) => fill(cv, o.arOnly ? { arAlb: tex(c) } : Object.assign({ ...m, alb: tex(c) }, a != null ? { arAlb: tex(a) } : {}));
    paint(cover(d, ...bb), col, o.ar);
    for (const [sp, c2, sm2, a2] of o.layers || []) paint(coverOps(d, [{ draw: D(sp, sm2 ?? true), mode: 'in' }], ...bb), c2, a2 ?? (o.ar != null ? o.ar : null));
    return { d, bb };
  };
  const edge = (pt, dx, dy, m) => fill(coverOps(pt.d, [{ draw: pt.d, mode: 'out', dx, dy }], ...pt.bb), m);
  const stroke = (pts, w, col, o = {}) => { for (let i = 0; i < pts.length - 1; i++) fill(LN(...tf(pts[i]), ...tf(pts[i + 1]), w), Object.assign({ alb: col, h: 0.5, spec: 0.03, dep: 3, occ: 1 }, o)); };
  const dot = (x, y, r, m) => fill(E(...tf([x, y]), r, r), m);
  return { tf, D, BB, part, edge, stroke, dot };
}
/* the Concierge's mark: a service bell, as a list of strokes (cx, cy = centre of the dome base, r = dome radius) */
function bellStrokes(cx, cy, r) {
  const s = [], arc = []; for (let a = Math.PI; a <= TAU + 1e-6; a += Math.PI / 14) arc.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  for (let i = 0; i < arc.length - 1; i++) s.push([arc[i], arc[i + 1]]);
  s.push([[cx - r * 1.35, cy + r * 0.28], [cx + r * 1.35, cy + r * 0.28]], [[cx, cy - r], [cx, cy - r * 1.3]], [[cx - r * 0.3, cy - r * 1.32], [cx + r * 0.3, cy - r * 1.32]]);
  return s;
}
const FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100110101010', 7: '111001010010010', 8: '010101010101010', 9: '010101011001110', ' ': '000000000000000', '·': '000000010000000', '-': '000000111000000' };
/* pixel text in native pixels: px = size of one glyph cell in native px */
function textCells(str, x, y, px) { const cells = []; let cx = x; for (const ch of str.toUpperCase()) { const gl = FONT[ch]; if (gl) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (gl[j * 3 + i] === '1') cells.push([cx + i * px, y + j * px]); cx += 4 * px; } return cells; }
function textGlow(str, x, y, px, col, ar = false, grp = 0, under = null) { for (const [cx, cy] of textCells(str, x, y, px)) { const cv = R(cx / S2, cy / S2, px / S2, px / S2); if (under) fill(cv, { alb: under, h: 0.55, keepE: true }); if (ar) glowA(cv, col, grp); else glowH(cv, col, grp); } }
