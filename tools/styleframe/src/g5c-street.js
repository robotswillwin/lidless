
/* ---------- street level ---------- */
function neonTube(pts, col, hot, grp, tube = P.m2, w = 1.5) {
  const m = tube ? { alb: tube, h: 0.6, round: w, rh: 0.3, spec: 0.8, shin: 0.9, dep: 3, eag: grp, ea: (x, y, i) => (i.d > w * 0.6 ? hot : col) } : { useD: true, eag: grp, ea: (x, y, i) => (i.d > w * 0.6 ? hot : col) };
  for (let i = 0; i < pts.length - 1; i++) fill(LN(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w), m);
  for (const [x, y] of pts) fill(E(x, y, w / 2, w / 2), m);
}
/* a glyph or any shape as a glass tube: physical glass (tube) plus light; ar = the light exists only in the eye mod */
function neonShape(cv, col, hot, grp, tube, ar = true) {
  const lit = (x, y, i) => (i.d > 0.8 ? hot : col), m = tube ? { alb: tube, h: 0.6, round: 1.2, rh: 0.35, spec: 0.8, shin: 0.9, dep: 3 } : { useD: true };
  fill(cv, Object.assign(m, ar ? { ea: lit, eag: grp } : { eh: lit, ehg: grp }));
}
function neonText(str, x, y, cs, col, hot, grp, vertical) {
  [...str].forEach((ch, n) => {
    const gl = ch === 'A' ? '111101111101101' : FONT[ch]; if (!gl) return;
    const gx = x + (vertical ? 0 : n * cs * 4), gy = y + (vertical ? n * cs * 6 : 0), on = (i, j) => i >= 0 && i < 3 && j >= 0 && j < 5 && gl[j * 3 + i] === '1', c = (i, j) => [gx + i * cs, gy + j * cs];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (on(i, j)) { if (on(i + 1, j)) neonTube([c(i, j), c(i + 1, j)], col, hot, grp); if (on(i, j + 1)) neonTube([c(i, j), c(i, j + 1)], col, hot, grp); if (!on(i + 1, j) && !on(i, j + 1) && !on(i - 1, j) && !on(i, j - 1)) neonTube([c(i, j)], col, hot, grp); }
  });
}
function sag(x0, y0, x1, y1, d, w, m) { let px = x0, py = y0; for (let s = 1; s <= 24; s++) { const t = s / 24, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + 4 * d * t * (1 - t); fill(LN(px, py, x, y, w), m); px = x; py = y; } }
function drawStreet() {
  const k = kit(47);
  // the building next door: rain-streaked concrete panels
  const con = MAT.concrete(P.c3), pan = (x, y) => ({ sx: (x - 904) % 26, sy: (y + 6) % 44 });
  fill(R(452, 0, 28, 228), { alb: (x, y) => { const { sx, sy } = pan(x, y); let c = mixc(con.alb(x, y), P.c3, 0.3 * fbm(x * 0.02, y * 0.01, 3)); if (sx < 1.2 || sy < 1.2) c = mulc(c, 0.4); c = mixc(c, P.c0, Math.max(0, fbm(x * 0.21, y * 0.004, 3) - 0.48) * 1.3); if (sy > 1 && sy < 6) c = mixc(c, P.c0, 0.3 * (1 - sy / 6)); return c; },
    h: (x, y) => { const { sx, sy } = pan(x, y); return sx < 1.2 || sy < 1.2 ? 0.28 : con.h(x, y); }, spec: 0.18, shin: 0.45, dep: 3, occ: 0 });
  fill(R(452, 0, 3, 228), { alb: (x, y) => mulc(P.c4, 0.8 + 0.3 * fbm(x * 0.1, y * 0.02, 2)), h: cylU(0.35, 0.4), spec: 0.3, shin: 0.5, dep: 3 });
  fill(R(475, 0, 3, 228), { ...MAT.metal(P.n3, { rust: 0.55 }), h: cylU(0.3, 0.55), spec: 0.4, shin: 0.55, dep: 3 });
  for (let y = 30; y < 228; y += 40) box(474, y, 5, 1.6, P.n2, { bv: 0.6, spec: 0.4 });
  for (const [wx, wy, lit] of [[457, 134, 0], [466, 134, 1], [457, 160, 0], [466, 160, 0]]) {
    box(wx - 0.6, wy - 0.6, 8.2, 12.2, P.n2, { bv: 1, spec: 0.3 });
    fill(R(wx + 0.8, wy + 0.8, 5.4, 9.4), { alb: (x, y) => (lit ? P.w1 : (y % 4 < 2 ? P.c1 : P.n0)), h: (x, y) => (y % 4 < 2 ? 0.5 : 0.42), spec: 0.9, shin: 0.92, dep: 3, eh: lit ? (x, y) => (y % 4 < 2 ? mixc(P.w0, P.w7, 0.6) : mixc(P.w0, P.w5, 0.22)) : null });
    box(wx - 1.2, wy + 11.2, 9.4, 1.3, P.n3, { bv: 0.5, spec: 0.4 });
  }
  fill(R(467.5, 142.2, 3.4, 2.4), { alb: P.w5, h: cylU(0.4, 0.3), spec: 0.1, dep: 3 }); for (const [lx, ly] of [[468, 140.6], [469.6, 140], [470.6, 141.2], [468.8, 139.2]]) fill(E(lx, ly, 1.1, 0.7), { alb: P.g2, round: 1, rh: 0.4, h: 0.55, spec: 0.2, dep: 3 });
  box(455, 179, 12, 7, P.n3, { ...MAT.metal(P.n3, { rust: 0.5 }), bv: 1, spec: 0.4 }); fill(E(461, 182.5, 2.2, 2.2), { alb: P.n1, round: 2, rh: 0.3, h: 0.45, spec: 0.9, shin: 0.9 });
  fill(E(457.4, 181.2, 0.45, 0.45), { eh: P.c7 }); fill(E(457.4, 183.6, 0.45, 0.45), { eh: P.g3 });
  fill(R(470.6, 124, 1.2, 55), { alb: P.n3, h: cylU(0.4, 0.4), spec: 0.4, dep: 3 });
  // the BAR: red neon, human-made and illegal, so it stays lit in the raw world; a pin-up in tubes under the letters
  const tubeH = (pts, w = 0.8) => { const m = { alb: P.r2, h: 0.6, round: w, rh: 0.35, spec: 0.8, shin: 0.9, dep: 3, ehg: 5, eh: (x, y, i) => (i.d > w * 0.55 ? P.r7 : P.r5) }; for (let n = 0; n < pts.length - 1; n++) fill(LN(...pts[n], ...pts[n + 1], w), m); for (const q of pts) fill(E(q[0], q[1], w / 2, w / 2), m); };
  fill(R(464.5, 40, 1, 6), { alb: P.n3, h: 0.6, spec: 0.5, dep: 3, occ: 1 });
  box(455, 46, 20, 78, P.n1, { ...MAT.metal(P.n1, { rust: 0.6 }), bv: 2, spec: 0.35, shin: 0.5, occ: 1 });
  fill(R(457, 48, 16, 74), { alb: P.n0, h: 0.38, spec: 0.2, dep: 3 });
  for (const [rx, ry] of [[456.5, 47.5], [473.5, 47.5], [456.5, 122.5], [473.5, 122.5]]) rivet(rx, ry, P.n4);
  [...'BAR'].forEach((ch, n) => neonShape(TXT(ch, 465, 61.5 + n * 12.4, { font: '"Playfair Display"', weight: 700, size: 11.5, align: 'center', stroke: 0.85 }), P.r5, P.r7, 5, P.r2, false));
  const pin = pts => pts.map(([x, y]) => [457 + x, 92 + y]);
  const ang = []; for (let a = 0; a <= TAU + 0.01; a += TAU / 14) ang.push([9 + Math.cos(a) * 2, 3.2 + Math.sin(a) * 2.1]);
  tubeH(pin(ang), 0.7); tubeH(pin([[7.2, 1.6], [6.4, 0.6], [7.6, 0.2]]), 0.6);
  tubeH(pin([[7.8, 4.8], [7.2, 8.0], [6.8, 12.0], [7.6, 15.6], [10.0, 16.6], [14.6, 16.2], [13.8, 22.8], [14.6, 27.8], [16.2, 28.2]]));
  tubeH(pin([[10.6, 5.0], [10.2, 6.6], [11.8, 8.6], [10.6, 10.2], [10.0, 12.6], [11.0, 14.6], [15.6, 14.0], [12.8, 21.4], [11.6, 26.8], [13.0, 27.6]]));
  tubeH(pin([[8.0, 7.0], [5.2, 11.6], [4.6, 16.2]]), 0.7);
  // a bakery window under the open sign: real bread, the most expensive thing on the street
  box(452.5, 198, 27.5, 30, P.w2, { ...MAT.wood(P.w2), bv: 1.2, spec: 0.3, occ: 1 });
  fill(R(454.6, 200, 23.2, 25.6), { alb: P.w1, h: 0.4, spec: 0.9, shin: 0.95, dep: 3, eh: (x, y, i) => mixc(mulc(P.w1, 0.6), P.w7, 0.25 + 0.4 * (1 - i.v)) });
  const kb = kit(61);
  for (const sy of [207, 214.6, 222.2]) {
    fill(R(454.6, sy, 23.2, 0.9), { ...MAT.wood(P.w4), h: 0.6, spec: 0.3, dep: 3 });
    for (let lx = 456.6; lx < 476; lx += kb.R(4.4, 5.6)) { const lw = kb.R(1.8, 2.5), lh = kb.R(1.3, 1.9), cy = sy - lh * 0.9;
      fill(E(lx + lw, cy, lw, lh), { alb: (x, y, i) => mixc(P.w5, P.w7, 0.25 + 0.5 * (1 - i.v)), h: 0.55, round: 1.4, rh: 0.4, spec: 0.35, shin: 0.5, dep: 3, eh: (x, y, i) => mulc(P.w6, 0.22 * (1 - i.v)) });
      fill(LN(lx + lw - 1, cy - lh * 0.3, lx + lw + 0.6, cy - lh * 0.7, 0.3), { alb: P.w8, h: 0.6 }); fill(LN(lx + lw + 0.4, cy - lh * 0.1, lx + lw + 1.6, cy - lh * 0.5, 0.3), { alb: P.w8, h: 0.6 }); } }
  fill(R(455.6, 216.4, 3, 1.8), { alb: P.n7, h: 0.6, spec: 0.05, dep: 3 }); fill(R(456.2, 217.2, 1.6, 0.3), { alb: P.n2, h: 0.6 });
  for (const cx of [458.5, 471.5]) fill(R(cx, 188, 0.6, 2.4), { alb: P.n3, h: 0.6, spec: 0.5, dep: 3 });
  neonShape(TXT('open', 465, 196, { font: 'Yellowtail', size: 10, align: 'center' }), P.w8, P.wA, 0, P.w3, false);
  fill(R(470.6, 179, 1.2, 4), { alb: P.n3, h: 0.6, spec: 0.5, dep: 3, occ: 1 }); fill(E(471.2, 185, 1.8, 1.8), { alb: P.w2, round: 2, rh: 0.4, h: 0.55, spec: 0.7, dep: 3, occ: 1, eh: (x, y, i) => (i.d > 1.4 ? P.w9 : P.w7) });
  for (const gx of [470, 471.2, 472.4]) fill(R(gx - 0.2, 183.4, 0.4, 3.6), { alb: P.n2, h: 0.65, spec: 0.4, dep: 3 });
  // string lights over the street (eye mod) and two power cables
  let px = 276, py = 40;
  for (let x = 277; x <= 452; x++) { const t = (x - 276) / 176, y = 40 + 56 * t * (1 - t) - 6 * t; fill(LN(px, py, x, y, 0.5), { alb: P.n0, h: 0.55, dep: 3 }); px = x; py = y;
    if (x % 12 === 0) { fill(R(x - 0.4, y, 0.8, 1), { alb: P.n1, h: 0.6, dep: 3 }); fill(E(x, y + 2.2, 0.9, 1.2), { alb: P.n2, round: 1.5, rh: 0.4, h: 0.5, spec: 0.8, shin: 0.85, dep: 3, eag: 6, ea: (a, b, i) => (i.d > 0.9 ? P.cA : mulc(P.c9, 0.8)) }); } }
  sag(304, 128, 452, 108, 9, 0.6, { alb: P.n0, h: 0.55, spec: 0.3, dep: 3 }); sag(276, 70, 304, 126, 6, 0.6, { alb: P.n0, h: 0.55, spec: 0.3, dep: 3 });
  // street lamp, with a camera dome and a hand-written notice; its head well above a standing person's
  fill(R(301.4, 78, 3.4, 142), { ...MAT.metal(P.n3, { rust: 0.6 }), h: cylU(0.3, 0.55), spec: 0.5, shin: 0.6, dep: 3, occ: 1 });
  box(298, 219, 10, 9, P.n2, { ...MAT.metal(P.n2, { rust: 0.55 }), bv: 2, spec: 0.45, shin: 0.55, occ: 1 });
  for (const ry of [150, 196]) box(300.6, ry, 5, 2, P.n4, { bv: 0.6, spec: 0.5, occ: 1 });
  fill(LN(303, 79, 316, 73.5, 1.6), { ...MAT.metal(P.n3), h: 0.6, spec: 0.5, shin: 0.6, dep: 3, occ: 1 });
  fill(PL([[311, 74], [313, 70.6], [319, 69.6], [325, 71.2], [326, 74.4], [322, 76.6], [312.5, 76.6]]), { ...MAT.metal(P.n4, { rust: 0.6 }), round: 3, rh: 0.5, h: 0.4, spec: 0.6, shin: 0.7, dep: 3, occ: 1 });
  fill(PL([[313.5, 75.6], [323.5, 75.6], [322, 77.4], [315, 77.4]], false), { alb: P.n6, h: 0.5, spec: 0.9, shin: 0.9, dep: 3, eh: (x, y, i) => mixc(P.c9, P.cA, 1 - i.v) });
  fill(R(307, 76.5, 1, 3), { alb: P.n2, h: 0.6, dep: 3 }); fill(E(307.5, 80.4, 1.6, 1.3), { alb: P.n1, round: 1.6, rh: 0.5, h: 0.5, spec: 0.95, shin: 0.95, dep: 3, occ: 1 }); fill(E(307.8, 80.8, 0.4, 0.4), { eh: P.m5 });
  fill(PL([[300.2, 168], [306.2, 167.6], [306.4, 176], [300.4, 176.4]], false), { alb: (x, y) => mixc(P.n6, P.w8, 0.25 * fbm(x * 0.3, y * 0.3, 2)), h: 0.6, spec: 0.03, dep: 3, occ: 1 });
  for (const ly of [169.6, 171.1, 172.6, 174.1]) fill(LN(301, ly, 305.2 - (ly % 2), ly, 0.35), { alb: P.n2, h: 0.6 });
  // bench, with someone asleep on it; the eye mod covers them with a planter
  for (const lx of [318, 345]) fill(R(lx, 205, 2, 23), { ...MAT.metal(P.n2, { rust: 0.5 }), h: cylU(0.35, 0.4), spec: 0.4, shin: 0.5, dep: 3, occ: 1 });
  for (const [sy, sh] of [[203.5, 2.4], [212.5, 3]]) fill(R(316, sy, 32, sh), { ...WOOD(P.w4), h: cylV(0.4, 0.3), spec: 0.3, shin: 0.55, occ: 1 });
  fill(R(317, 215.5, 30, 0.8), { alb: P.n1, h: 0.4, dep: 3, occ: 1 });
  const blanket = (x, y) => mulc([mixc(P.c4, P.n4, 0.5), mixc(P.m3, P.w3, 0.55), mixc(P.c5, P.n5, 0.6), P.w4][(((x >> 3) + (y >> 3) * 2) % 4 + 4) % 4], 0.8 + 0.25 * fbm(x * 0.08, y * 0.05, 3));
  fill(PL([[320, 213], [323.5, 206.5], [330, 204.2], [336, 204.6], [342, 206], [346.4, 209.6], [347.2, 213]]), { alb: blanket, round: 6, rh: 0.55, h: (x, y) => 0.35 + 0.08 * Math.sin(x * 0.5 + y * 0.2), spec: 0.03, dep: 3, occ: 1 });
  fill(E(320.5, 209.3, 2.8, 2.6), { alb: P.sk2, round: 3, rh: 0.5, h: 0.45, spec: 0.12, shin: 0.4, dep: 3, occ: 1 });
  fill(PL([[317.4, 208.5], [318, 205.6], [321, 204.6], [323.6, 206], [323.6, 208.2]]), { ...MAT.fabric(mixc(P.m4, P.n4, 0.55), { fold: 0.9 }), round: 2, rh: 0.4, h: 0.4, spec: 0.03, dep: 3, occ: 1 });
  fill(PL([[346.5, 210.6], [349.4, 210], [350, 212.8], [346.8, 213]], false), { alb: P.n1, round: 1.4, rh: 0.4, h: 0.45, spec: 0.3, dep: 3, occ: 1 });
  fill(PL([[332, 228], [332, 223.5], [332.8, 222.4], [332.8, 220.5], [333.8, 220.5], [333.8, 222.4], [334.6, 223.5], [334.6, 228]], false), { alb: P.g1, h: cylU(0.35, 0.4), spec: 0.95, shin: 0.95, dep: 3, occ: 1 });
  // the eye mod's version: a hotel planter, three clipped topiaries, and a polite line of type
  fill(R(312, 203, 40, 25), { eag: 6, arAlb: (x, y, i) => (i.v < 0.06 ? mixc(P.w6, P.w8, 0.5 + 0.5 * fbm(x * 0.2, y, 2)) : mulc(mixc(P.n2, P.c2, 0.4), 0.7 + 0.45 * (1 - i.v) * 0.6 + 0.12 * fbm(x * 0.05, y * 0.05, 2))),
    ea: (x, y, i) => (i.v < 0.06 ? mulc(P.w7, 0.4) : (i.u < 0.012 || i.u > 0.988) ? mulc(P.c7, 0.3) : mulc(mixc(P.c2, P.c3, 1 - i.v), 0.8 + 0.25 * fbm(x * 0.05, y * 0.05, 2))) });
  for (const [tx, tr] of [[320, 5.2], [332, 6.4], [344, 5.2]]) {
    const ty = 203 - 2.4 - tr;
    fill(R(tx - 0.5, 200, 1, 3), { arAlb: P.w3 });
    fill(E(tx, ty, tr, tr), { useD: true, eag: 6, arAlb: (x, y) => { const dx = (x / 2 - tx) / tr, dy = (y / 2 - ty) / tr, sh = 0.5 + 0.5 * (-dx * 0.45 - dy * 0.75); return mulc(mixc(P.g1, P.g2, 0.45), Math.max(0.22, sh) * (0.7 + 0.55 * fbm(x * 0.45, y * 0.45, 2))); },
      ea: (x, y, i) => { const dx = (x / 2 - tx) / tr, dy = (y / 2 - ty) / tr, sh = Math.max(0.15, 0.5 + 0.5 * (-dx * 0.45 - dy * 0.75)), lf = 0.6 + 0.6 * fbm(x * 0.45, y * 0.45, 2); return i.d < 1.1 ? mulc(P.c8, 0.6) : mulc(mixc(P.g2, P.c6, 0.25), 1.3 * sh * lf + (y % 3 === 0 ? 0.08 : 0)); } });
  }
  fill(TXT('Please rest.', 332, 186.5, { size: 5.4, weight: 300, track: 0.3, align: 'center' }), { ea: P.c9, eag: 6 });
  // vending machine
  box(432, 184, 19, 44, P.n2, { ...MAT.metal(P.c2, { rust: 0.6 }), bv: 2.5, spec: 0.45, shin: 0.6, occ: 1 });
  fill(R(433.4, 185.6, 15.6, 1.2), { alb: P.n0, h: 0.5, ea: P.c8, eag: 0, dep: 3 });
  fill(R(434, 189, 13, 26), { alb: P.n0, h: 0.35, spec: 1, shin: 0.97, dep: 3, eag: 0, ea: (x, y) => mixc(P.c0, P.c4, 0.3 + 0.12 * Math.sin(y * 0.4)) });
  for (let y = 192; y < 213; y += 5) { fill(R(434, y + 3, 13, 0.6), { alb: P.n4, h: 0.6, spec: 0.6 }); for (let x = 435; x < 446; x += 3) { const c = k.pick([mixc(P.m5, P.n6, 0.55), P.w7, mixc(P.c8, P.n6, 0.45), mixc(P.g3, P.n6, 0.55), P.n7]);
    fill(PL([[x, y + 3], [x, y + 0.6], [x + 0.4, y], [x + 1.6, y], [x + 2, y + 0.6], [x + 2, y + 3]], false), { arAlb: c, ea: mulc(c, 0.35), eag: 0 }); } }
  box(447.6, 195, 2.4, 7, P.n1, { bv: 0.6, spec: 0.5 }); fill(R(448.4, 196.5, 0.8, 2.5), { alb: P.n0, eh: P.g3 });
  box(435.5, 217.5, 10, 4.5, P.n0, { bv: 0.8, spec: 0.4, h: 0.3 });
  fill(R(433, 223, 17, 4), { alb: (x, y) => (((x + y) >> 2) % 2 ? P.n1 : P.n3), h: 0.5, dep: 3 });
  for (const [a, b] of bellStrokes(441.5, 180, 2.6)) neonTube([a, b], P.c8, P.cA, 6, null, 0.6);
  // trash bags, glossy and wet
  for (const [bx, bw, c] of [[426, 12, P.n1], [436, 13, P.c1], [446, 8, P.n1]]) {
    fill(PL([[bx, 228], [bx + 0.6, 220], [bx + bw * 0.3, 215.6], [bx + bw / 2, 214], [bx + bw * 0.7, 215.6], [bx + bw - 0.6, 220], [bx + bw, 228]]), { alb: (x, y) => mulc(c, 0.9 + 0.2 * fbm(x * 0.1, y * 0.1, 2)), round: 7, rh: 0.6, h: (x, y) => 0.32 + 0.1 * fbm(x * 0.15, y * 0.15, 3), spec: 0.75, shin: 0.75, dep: 3, occ: 1 });
    fill(PL([[bx + bw / 2 - 1.2, 214.4], [bx + bw / 2, 212], [bx + bw / 2 + 1.2, 214.4]], false), { alb: c, round: 1, rh: 0.4, h: 0.5, spec: 0.7, dep: 3, occ: 1 });
  }
  // hydrant and bollards
  fill(PL([[353.4, 228], [353.4, 220.4], [356, 218.8], [358.6, 220.4], [358.6, 228]], false), { ...MAT.metal(mixc(P.m3, P.w4, 0.5), { rust: 0.55 }), h: cylU(0.3, 0.55), spec: 0.45, shin: 0.6, dep: 3, occ: 1 });
  fill(E(356, 218.6, 2.8, 1.6), { ...MAT.metal(mixc(P.m4, P.w4, 0.5), { rust: 0.6 }), round: 2, rh: 0.5, h: 0.45, spec: 0.5, dep: 3, occ: 1 });
  for (const nx of [352.2, 359.8]) fill(E(nx, 223, 1, 1), { alb: P.n2, round: 1.2, rh: 0.5, h: 0.5, spec: 0.5, dep: 3, occ: 1 });
  fill(R(352, 226.5, 8, 1.5), { alb: mixc(P.m2, P.w3, 0.5), h: 0.55, spec: 0.3, dep: 3, occ: 1 });
  for (const bx of [250, 286]) {
    fill(PL([[bx, 230], [bx, 217.5], [bx + 0.6, 216.3], [bx + 2.5, 215.6], [bx + 4.4, 216.3], [bx + 5, 217.5], [bx + 5, 230]], false), { ...MAT.metal(P.n4, { rust: 0.6 }), h: cylU(0.3, 0.55), spec: 0.5, shin: 0.6, dep: 3, occ: 1 });
    fill(R(bx, 219.6, 5, 1.6), { alb: P.n7, h: cylU(0.35, 0.5), spec: 0.9, shin: 0.85, dep: 3, occ: 1 });
  }
}
