
/* ---------- the shop's shell ---------- */
const SC = { beacons: [] };
const cylU = (lo = 0.25, hi = 0.6) => (x, y, i) => lo + hi * Math.sqrt(Math.max(0, 1 - (2 * i.u - 1) ** 2));
const cylV = (lo = 0.25, hi = 0.6) => (x, y, i) => lo + hi * Math.sqrt(Math.max(0, 1 - (2 * i.v - 1) ** 2));
function box(x, y, w, h, col, o = {}) { fill(R(x, y, w, h), Object.assign({ alb: col, h: 0.45, bevel: o.bv ?? 2, bh: 0.3, spec: 0.08, shin: 0.3, dep: 3 }, o)); }
function rivet(x, y, col = P.n5) { fill(E(x, y, 0.8, 0.8), { alb: col, round: 2, rh: 0.5, h: 0.5, spec: 0.5, shin: 0.6, dep: 3 }); }
function bulb(x, y, col, hot, grp = 0) { fill(E(x, y, 1.1, 1.1), { alb: P.w2, round: 2, rh: 0.4, h: 0.5, eh: (px, py, i) => mixc(col, hot, Math.max(0, 1 - i.d / 1.6) * 0.0 + (i.d > 1.6 ? 0.6 : 0)), ehg: grp, dep: 3, spec: 0.6, shin: 0.8 }); }
function drawRoom() {
  const k = kit(12);
  fill(R(0, 0, 276, 52), Object.assign(MAT.brick(P.w3, P.w1, { bw: 18, bh: 8 }), { spec: 0.03, dep: 3 }));
  fill(R(262, 52, 14, 176), Object.assign(MAT.brick(P.w3, P.w1, { bw: 18, bh: 8, seed: 3 }), { spec: 0.03, dep: 3 }));
  fill(R(268, 0, 4, 228), Object.assign(MAT.metal(P.n4, { rust: 0.58 }), { h: cylU(0.3, 0.55), spec: 0.35, shin: 0.5, dep: 3, occ: 0 }));
  for (let y = 20; y < 228; y += 34) box(267, y, 6, 2, P.n2, { bv: 1 });
  box(263, 118, 9, 7, P.n6, { bv: 1, spec: 0.3 }); for (const [cx, cy] of textCells('17', 529, 239, 1.4)) fill(R(cx / 2, cy / 2, 0.7, 0.7), { alb: P.n1, h: 0.4 });
  // the shop sign: gold leaf on black lacquer, lit by two gooseneck lamps
  box(24, 7, 214, 30, P.w2, { ...MAT.wood(P.w2), bv: 2, spec: 0.35, shin: 0.6 });
  fill(R(27, 10, 208, 24), { alb: (x, y) => mulc(mixc(P.n0, P.w1, 0.35), 0.75 + 0.35 * fbm(x * 0.02, y * 0.25, 3)), h: (x, y) => 0.42 + 0.02 * fbm(x * 0.3, y * 0.3, 2), spec: 0.6, shin: 0.88, dep: 3 });
  const gold = { alb: (x, y) => { const w = fbm(x * 0.12, y * 0.12, 3); return w > 0.68 ? mixc(P.w4, P.n1, 0.4) : mixc(P.w7, P.w9, w); }, round: 1.3, rh: 0.45, h: 0.5, spec: 0.95, shin: 0.86, dep: 3 };
  const sign = { font: '"Playfair Display"', weight: 700, size: 14.5, track: 2.4, align: 'center' };
  fill(TXT('RADIO  REPAIR', 131.9, 26.9, sign), { alb: mixc(P.n0, P.w1, 0.5), h: 0.38, dep: 3 });
  fill(TXT('RADIO  REPAIR', 131, 26, sign), gold);
  fill(TXT('valves \u00b7 wireless \u00b7 television', 131, 32.4, { font: '"Playfair Display"', italic: true, weight: 600, size: 4.4, track: 0.5, align: 'center' }), gold);
  for (const [x0, x1] of [[34, 96], [166, 228]]) fill(R(x0, 12.6, x1 - x0, 0.5), gold);
  for (const dx of [31, 231]) fill(PL([[dx, 12.85], [dx + 1.2, 11.6], [dx + 2.4, 12.85], [dx + 1.2, 14.1]], false), gold);
  for (const lx of [74, 188]) {
    fill(LN(lx, 0, lx, 2.4, 0.9), { alb: P.n3, h: 0.6, spec: 0.6, shin: 0.7, dep: 3, occ: 1 });
    fill(LN(lx, 2.4, lx + 5, 3.2, 0.9), { alb: P.n3, h: 0.6, spec: 0.6, shin: 0.7, dep: 3, occ: 1 });
    fill(PL([[lx + 3.2, 2.6], [lx + 8.2, 3.4], [lx + 9.2, 6.2], [lx + 2.4, 5.4]], false), { alb: mixc(P.g1, P.n3, 0.5), round: 1.2, rh: 0.4, h: 0.45, spec: 0.7, shin: 0.75, dep: 3, occ: 1 });
    fill(LN(lx + 2.8, 5.6, lx + 8.8, 6.4, 0.6), { eh: P.w9 });
  }
  // corrugated shutter, rolled up
  fill(R(6, 40, 256, 12), Object.assign(MAT.metal(P.n3, { rust: 0.55 }), { h: (x) => 0.45 + 0.22 * Math.sin(x * 0.95), spec: 0.35, shin: 0.45, dep: 3 }));
  box(6, 39, 256, 1.5, P.n5, { bv: 0.5, spec: 0.5 }); box(6, 50.5, 256, 1.5, P.n5, { bv: 0.5, spec: 0.6 }); box(130, 49, 14, 2, P.n6, { bv: 0.5, spec: 0.6 });
  for (let x = 8; x < 262; x += 7) fill(R(x, 52, 0.5, 1.5), { alb: P.c6, h: 0.6, spec: 0.9, shin: 0.9 });
  // interior shell
  fill(R(8, 52, 254, 176), { inn: 1 });
  fill(R(8, 62, 254, 124), Object.assign(MAT.plaster(P.w2), { spec: 0.02, dep: 3, inn: 1 }));
  for (const [bx, by, bw, bh] of [[186, 150, 22, 26], [10, 126, 28, 20], [118, 64, 30, 12]]) fill(PL([[bx, by + bh * 0.5], [bx + bw * 0.2, by], [bx + bw * 0.8, by + 2], [bx + bw, by + bh * 0.6], [bx + bw * 0.7, by + bh], [bx + bw * 0.15, by + bh * 0.9]]), Object.assign(MAT.brick(P.w4, P.w1, { bw: 18, bh: 8, seed: 7 }), { spec: 0.02, dep: 3, inn: 1 }));
  for (const [x0, y0, n] of [[60, 160, 18], [244, 132, 14], [170, 64, 12], [100, 100, 10]]) { let x = x0, y = y0; for (let i = 0; i < n; i++) { const nx = x + k.R(-1.2, 1.2), ny = y + 1; fill(LN(x, y, nx, ny, 0.6), { alb: P.w0, h: 0.32 }); x = nx; y = ny; } }
  // glazed tile wainscot
  fill(R(8, 185, 254, 2), Object.assign(MAT.wood(P.w5), { bevel: 1.5, bh: 0.3, spec: 0.25, dep: 3 }));
  fill(R(8, 187, 254, 27), { dep: 3, inn: 1, spec: 0.35, shin: 0.75,
    alb: (x, y) => { const tx = (x + (((y - 374) / 10 | 0) & 1) * 6) % 12, ty = (y - 374) % 10; if (tx < 1 || ty < 1) return P.w1; const v = hash2(((x + (((y - 374) / 10 | 0) & 1) * 6) / 12) | 0, ((y - 374) / 10) | 0); return mulc(v > 0.8 ? P.w2 : v < 0.15 ? P.w4 : P.w3, 0.85 + 0.25 * fbm(x * 0.08, y * 0.08, 2)); },
    h: (x, y) => { const tx = (x + (((y - 374) / 10 | 0) & 1) * 6) % 12, ty = (y - 374) % 10; if (tx < 1 || ty < 1) return 0.2; return 0.45 + 0.15 * smooth(Math.min(tx - 1, 11 - tx, ty - 1, 9 - ty) / 2); } });
  // ceiling, pipes, valve, vent duct, cable loops
  fill(R(8, 52, 254, 10), Object.assign(MAT.plaster(P.w1), { dep: 3, inn: 1 }));
  for (const py of [53, 57]) fill(R(8, py, 254, 2.6), Object.assign(MAT.metal(P.n3, { rust: 0.6 }), { h: cylV(0.3, 0.55), spec: 0.45, shin: 0.55, dep: 3 }));
  for (let x = 30; x < 262; x += 46) box(x, 52, 3, 9, P.n2, { bv: 1 });
  fill(E(96, 58, 3.2, 3.2), { alb: mixc(P.w4, P.m2, 0.35), round: 3, rh: 0.4, h: 0.5, spec: 0.4, dep: 3 }); fill(E(96, 58, 1, 1), { alb: P.n2, h: 0.8 });
  fill(R(170, 62, 84, 7), Object.assign(MAT.metal(P.n3), { h: cylV(0.35, 0.35), spec: 0.4, shin: 0.5, dep: 3 }));
  for (let x = 172; x < 254; x += 12) { fill(R(x, 62.5, 0.6, 6), { alb: P.n1, h: 0.3 }); rivet(x + 2.5, 64); rivet(x + 2.5, 67); }
  box(240, 63.5, 9, 5, P.n1, { bv: 0.5 }); for (let x = 241; x < 248; x += 1.5) fill(R(x, 64, 0.6, 4), { alb: P.n4, h: 0.7, spec: 0.4 });
  for (const [x0, x1, y0, d] of [[100, 118, 62, 10], [196, 214, 69, 8]]) { let px = x0, py = y0; for (let x = x0 + 1; x <= x1; x++) { const t = (x - x0) / (x1 - x0), ny = y0 + 4 * d * t * (1 - t); fill(LN(px, py, x, ny, 1), { alb: P.n0, h: 0.6, spec: 0.3, occ: 1 }); px = x; py = ny; } }
  // conduits with junction boxes
  fill(R(23.5, 62, 2.4, 34), Object.assign(MAT.metal(P.n4), { h: cylU(0.3, 0.5), spec: 0.35, dep: 3 }));
  fill(R(8, 139, 254, 2.4), Object.assign(MAT.metal(P.n4), { h: cylV(0.3, 0.5), spec: 0.35, dep: 3 }));
  for (const x of [60, 118, 176, 236]) { box(x, 136.5, 7, 7, P.n5, { bv: 1, spec: 0.3 }); rivet(x + 3.5, 140, P.n3); }
  // fuse box, calendar
  box(14, 96, 22, 28, P.n5, { bv: 1.5, spec: 0.35, shin: 0.4 }); box(16, 100, 18, 9, P.n3, { bv: 0.5 });
  for (let i = 0; i < 4; i++) { box(17 + i * 4, 101, 2, 7, P.n1, { bv: 0.5 }); box(17 + i * 4, i % 2 ? 102 : 105, 2, 2, P.n7, { bv: 0.5, spec: 0.4 }); }
  box(17, 112, 16, 8, P.n4, { bv: 0.5 }); fill(PL([[25, 113.6], [28.2, 118.6], [21.8, 118.6]], false), { alb: mixc(P.w7, P.w5, 0.4), h: 0.55, spec: 0.2 }); fill(R(24.6, 115.2, 0.8, 1.8), { alb: P.n1, h: 0.56 });
  fill(E(33.5, 99, 0.8, 0.8), { alb: P.m3, h: 0.6, eh: P.m5 });
  fill(R(14, 72, 16, 18), { alb: (x, y) => mulc(P.n7, 0.9 + 0.1 * fbm(x * 0.2, y * 0.2, 2)), h: (x, y, i) => 0.5 + 0.1 * i.v, dep: 3, spec: 0.05 }); box(14, 72, 16, 4, mixc(P.m2, P.w3, 0.6), { bv: 0.5 });
  for (let y = 78; y < 88; y += 3) for (let x = 15; x < 29; x += 3) fill(R(x, y, 1, 1), { alb: P.n5, h: 0.5 }); fill(R(21, 81, 2, 1), { alb: mixc(P.m2, P.w3, 0.6), h: 0.5 });
  // back door, ajar, warm light behind
  box(12, 150, 28, 78, P.w5, { bv: 1.5, spec: 0.15 });
  fill(R(15, 153, 22, 75), { alb: P.w0, h: 0.2, dep: 3 });
  fill(R(15, 153, 16, 75), Object.assign(MAT.wood(P.w4, { dir: 'v' }), { bevel: 1, bh: 0.2, spec: 0.12, dep: 3 }));
  for (const [py, ph] of [[158, 22], [186, 30]]) { fill(R(17.5, py, 10, ph), Object.assign(MAT.wood(mulc(P.w4, 0.85), { dir: 'v' }), { h: 0.38, bevel: 1.5, bh: 0.12 })); }
  fill(E(28.5, 193, 1.2, 1.2), { alb: P.w7, round: 2, rh: 0.5, h: 0.5, spec: 0.8, shin: 0.8 });
  fill(R(31.5, 154, 2.5, 73), { eh: (x, y) => mixc(P.w7, P.w9, 0.4 * fbm(x * 0.1, y * 0.05, 2)) });
  fill(R(34, 154, 2, 73), { eh: mixc(P.w0, P.w6, 0.6) });
  fill(PL([[42, 152], [45, 154], [47, 168], [48, 186], [38, 186], [39, 168], [40, 154]]), Object.assign(MAT.fabric(P.c4, { fold: 0.9 }), { spec: 0.03, dep: 3, occ: 1 }));
  // floorboards
  fill(R(8, 214, 254, 14), { dep: 3, inn: 1, spec: 0.22, shin: 0.55,
    alb: (x, y) => { const row = ((y - 428) / 6) | 0, seam = (y - 428) % 6 === 0, joint = (x + row * 37) % 62 === 0; if (seam || joint) return P.w1; const g = Math.sin(x * 0.3 + fbm(x * 0.02, y * 0.4, 3) * 8); const worn = x > 300 && x < 476 && y > 440; return mulc(worn ? P.w5 : P.w4, 0.85 + 0.08 * g + 0.15 * fbm(x * 0.05, y * 0.2, 3)); },
    h: (x, y) => ((y - 428) % 6 === 0 || (x + (((y - 428) / 6) | 0) * 37) % 62 === 0) ? 0.25 : 0.5 + 0.03 * Math.sin(x * 0.3) });
  box(8, 227, 254, 1.2, P.n4, { bv: 0.4, spec: 0.5 });
}
