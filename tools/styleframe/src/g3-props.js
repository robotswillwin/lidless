
/* ---------- everything in the shop ---------- */
const WOOD = c => Object.assign(MAT.wood(c), { spec: 0.15, shin: 0.45, dep: 3 });
/* muted period materials: oxblood bakelite, bottle green, faded navy, tobacco */
const BAK = mixc(P.m2, P.w3, 0.6), BGR = mixc(P.g1, P.n3, 0.55), NAVY = mixc(P.c3, P.n3, 0.5), TOB = mixc(P.w5, P.n4, 0.35);
function radioSet(x, y, w, h, col) {
  box(x, y, w, h, col, { bv: 1.5, spec: 0.3, shin: 0.5, occ: 1 });
  for (let j = y + 2; j < y + h - 2; j += 1.5) for (let i = x + 1.5; i < x + w / 2; i += 1.5) fill(R(i, j, 0.6, 0.6), { alb: mulc(col, 0.4), h: 0.35 });
  const dx = x + w / 2 + 1, dw = Math.max(3, w / 2 - 3);
  fill(R(dx, y + 2, dw, 3), { alb: P.n1, h: 0.4, eh: (px, py, i) => mixc(P.w7, P.w9, 1 - Math.abs(i.u - 0.5) * 2), spec: 0.8, shin: 0.9 });
  fill(R(dx + dw * 0.45, y + 2, 0.5, 3), { eh: mulc(P.w2, 0.5) });
  for (const kx of [dx + 1, dx + dw - 1]) fill(E(kx, y + h - 2.5, 1.2, 1.2), { alb: P.n2, round: 2, rh: 0.5, h: 0.5, spec: 0.5, shin: 0.6 });
}
function drawProps() {
  const k = kit(19);
  // shelf unit
  for (const px of [44, 106]) box(px, 70, 2, 84, P.w4, { bv: 1, ...WOOD(P.w4), occ: 1 });
  for (const sy of [92, 112, 132, 152]) {
    let x = 47;
    while (x < 104) {
      const w = k.RI(4, 11), h = k.RI(6, 15), kind = k.r(), top = sy - h; if (x + w > 105) break;
      if (kind < 0.24) radioSet(x, top, Math.max(7, w), h, k.pick([P.w5, P.n6, BAK, BGR]));
      else if (kind < 0.48) for (let i = 0; i < w; i++) { const c = k.pick([BAK, NAVY, TOB, BGR, mulc(P.n6, 0.8), P.w4, mixc(P.w7, P.n6, 0.6)]), t = top + k.RI(0, 3); box(x + i, t, 1, sy - t, c, { bv: 0.5, spec: 0.12, occ: 1 }); }
      else if (kind < 0.66) { fill(R(x, top + 2, w, h - 2), { alb: mixc(P.c3, P.c5, 0.3), h: (px, py, i) => 0.4 + 0.4 * Math.sqrt(Math.max(0, 1 - (2 * i.u - 1) ** 2)), spec: 0.9, shin: 0.92, occ: 1, dep: 3 }); for (let i = 0; i < w * 2; i++) fill(R(x + k.R(1, w - 1.5), k.R(top + 5, sy - 1.5), 0.6, 0.6), { alb: P.w6, h: 0.6, spec: 0.6 }); box(x, top, w, 2, P.n5, { bv: 0.5, spec: 0.5 }); }
      else if (kind < 0.82) { box(x, top, w, h, P.n7, { bv: 1, spec: 0.05, occ: 1 }); fill(R(x, top + 2, w, 1), { alb: P.w5, h: 0.5 }); }
      else { box(x, top, w, h, P.w6, { bv: 1, spec: 0.05, occ: 1 }); for (let j = top + 1; j < sy - 1; j += 2) fill(R(x + 0.5, j, w - 1, 0.5), { alb: P.w4, h: 0.4 }); }
      x += w + k.RI(0, 1);
    }
    box(44, sy, 64, 3, P.w5, { ...WOOD(P.w5), bv: 1, occ: 1 });
  }
  // record player and records
  box(66, 64, 34, 6, P.n3, { bv: 1, spec: 0.4, occ: 1 }); fill(E(79, 62.8, 9, 1.6), { alb: P.n0, h: 0.6, spec: 0.9, shin: 0.85 }); fill(E(79, 62.8, 1.5, 0.6), { alb: BAK, h: 0.7 });
  fill(LN(97, 61, 87, 63.4, 0.7), { alb: P.n6, h: 0.7, spec: 0.8, shin: 0.8 }); fill(E(98, 68, 0.6, 0.6), { eh: P.m5 });
  for (let i = 0; i < 6; i++) box(102 + i, 58 + (i % 2), 1, 12 - (i % 2), [BAK, NAVY, P.n1, TOB, P.n0, BGR][i], { bv: 0.3, spec: 0.2, occ: 1 });
  // pegboard and tools
  fill(R(114, 70, 58, 48), Object.assign(MAT.wood(P.w4), { bevel: 1.5, bh: 0.15, spec: 0.08, dep: 3 }));
  for (let y = 73; y < 116; y += 4) for (let x = 117; x < 170; x += 4) fill(E(x, y, 0.55, 0.55), { alb: P.w1, h: 0.2 });
  for (const [x, len, hc] of [[120, 18, P.w5], [124, 14, P.n2], [128, 20, TOB], [132, 16, BAK]]) { fill(R(x - 0.4, 76, 0.8, len), { alb: P.n6, h: 0.65, spec: 0.8, shin: 0.85, occ: 1 }); fill(R(x - 1.3, 76 + len, 2.6, 6), { alb: hc, round: 1.4, rh: 0.4, h: 0.5, spec: 0.5, shin: 0.6, occ: 1 }); }
  fill(R(139.5, 76, 1.4, 22), { ...WOOD(P.w6), h: cylU(0.35, 0.4), occ: 1 }); box(137, 74, 7, 4, P.n5, { bv: 1, spec: 0.7, shin: 0.8, occ: 1 });
  fill(LN(148, 78, 156, 96, 1.2), { alb: P.n6, h: 0.6, spec: 0.8, occ: 1 }); fill(LN(150, 78, 157, 95, 1.2), { alb: P.n5, h: 0.6, spec: 0.8, occ: 1 });
  for (const [cx, cy, r0, c] of [[162, 84, 6, P.w6], [163, 105, 4, P.n6]]) { fill(E(cx, cy, r0, r0), { alb: c, h: 0.65, round: 2, rh: 0.25, spec: 0.7, shin: 0.75, occ: 1 }); fill(E(cx, cy, r0 - 2, r0 - 2), { alb: P.w4, h: 0.4, ...MAT.wood(P.w4) }); }
  // posters, clock, bulb sign, cork board with the map
  // a schematic print, a notice with a snapshot pinned to it, a clock, a framed photograph
  const ink = (pts, c = P.n1, w = 0.9) => { for (let i = 0; i < pts.length - 1; i++) fill(LN(...pts[i], ...pts[i + 1], w), { alb: c, h: 0.52 }); };
  const paper = (x, y) => mulc(mixc(P.n7, P.w8, 0.22), 0.8 + 0.2 * fbm(x * 0.08, y * 0.08, 3) - (fbm(x * 0.02 + 5, y * 0.02, 2) > 0.62 ? 0.12 : 0));
  fill(R(176, 68, 22, 30), { alb: paper, h: (x, y, i) => 0.5 + 0.12 * i.v * i.v, spec: 0.04, dep: 3 });
  const sch = mixc(P.c3, P.n3, 0.4);
  ink([[178.5, 72], [195.5, 72]], sch, 0.4); ink([[178.5, 94], [195.5, 94]], sch, 0.4); ink([[179, 72], [179, 94]], sch, 0.4); ink([[195, 72], [195, 94]], sch, 0.4);
  for (let gx = 179; gx < 195.5; gx += 2) ink([[gx, 72.4], [gx, 93.6]], mixc(P.n7, P.c5, 0.12), 0.18);
  { const vx = 182.6, vy = 77.6; fill(E(vx, vy, 2.2, 2.6), { alb: sch, h: 0.52 }); fill(E(vx, vy, 1.7, 2.1), { alb: paper, h: 0.52 }); ink([[vx - 1, vy + 0.8], [vx + 1, vy + 0.8]], sch, 0.35); ink([[vx, vy - 1.5], [vx, vy + 0.1]], sch, 0.35); }
  for (const cx of [189.4, 191.4]) for (let cy = 75; cy < 81.5; cy += 1.3) fill(E(cx, cy, 0.7, 0.55), { alb: sch, h: 0.52 });
  ink([[190.4, 74.6], [190.4, 81.6]], sch, 0.3); ink([[182.6, 80.2], [182.6, 84.6], [186, 84.6]], sch, 0.35); ink([[186, 84.6], [186.6, 83.6], [187.2, 85.6], [187.8, 83.6], [188.4, 85.6], [189, 84.6], [193.6, 84.6]], sch, 0.35);
  ink([[189.4, 81.4], [189.4, 84.6]], sch, 0.35); ink([[193.6, 76], [193.6, 90]], sch, 0.35); ink([[180, 88], [190.6, 88]], sch, 0.35); ink([[184.4, 88], [184.4, 89.6]], sch, 0.35); ink([[183.2, 89.6], [185.6, 89.6]], sch, 0.35); ink([[183.7, 90.4], [185.1, 90.4]], sch, 0.35);
  for (const [tx, ty] of [[179.6, 92.4], [186.4, 92.6], [190.4, 92.2]]) ink([[tx, ty], [tx + 3 + (tx % 2), ty]], mixc(P.n4, P.c4, 0.2), 0.25);
  fill(R(200, 92, 18, 24), { alb: paper, h: 0.5, dep: 3 }); for (let ly = 95; ly < 104; ly += 1.6) ink([[201.6, ly], [201.6 + 14 - ((ly * 7) % 5), ly]], mulc(P.n4, 0.9), 0.35);
  fill(PL([[204, 104.5], [214.5, 103.8], [215, 114], [204.6, 114.6]], false), { alb: P.n7, h: 0.55, spec: 0.1, dep: 3 }); fill(R(205.2, 105.2, 8.6, 6.6), { alb: (x, y) => mixc(mixc(P.w3, P.w6, 0.4), P.n6, fbm(x * 0.2, y * 0.2, 2) * 0.6), h: 0.56, spec: 0.2 });
  fill(E(209.5, 108.6, 1.4, 1.8), { alb: mixc(P.w2, P.sk2, 0.5), h: 0.57 }); fill(E(209.5, 112.2, 2.6, 1.4), { alb: mixc(P.w2, P.n3, 0.5), h: 0.57 }); fill(E(209.5, 104.6, 0.7, 0.7), { alb: BAK, round: 0.8, rh: 0.4, h: 0.6, spec: 0.7 });
  fill(E(214, 78, 7, 7), { alb: P.w5, round: 3, rh: 0.4, h: 0.5, spec: 0.5, shin: 0.6, occ: 1 }); fill(E(214, 78, 5.2, 5.2), { alb: mixc(P.n7, P.w8, 0.2), h: 0.55, spec: 0.7, shin: 0.9 });
  for (let a = 0; a < 12; a++) { const ang = a / 12 * TAU; fill(E(214 + Math.cos(ang) * 4.3, 78 + Math.sin(ang) * 4.3, 0.3, 0.3), { alb: P.n2, h: 0.56 }); }
  ink([[214, 78], [214, 74.4]], P.n1, 0.7); ink([[214, 78], [216.6, 79.2]], P.n1, 0.7); fill(E(214, 78, 0.5, 0.5), { alb: P.n1, h: 0.7 });
  box(226, 72, 26, 18, P.w2, { ...MAT.wood(P.w2), bv: 1.5, spec: 0.35, shin: 0.6, occ: 0 });
  fill(R(228.5, 74.5, 21, 13), { alb: (x, y) => { const n = fbm(x * 0.07, y * 0.07, 3); return mixc(mixc(P.w2, P.w7, 0.25 + 0.4 * n), P.n7, 0.25); }, h: 0.5, spec: 0.7, shin: 0.9, dep: 3 });
  for (const [px, pw, ph] of [[234, 3.2, 8.6], [240.6, 3.6, 9.6]]) { fill(E(px + pw / 2, 87.5 - ph + 1.6, pw * 0.38, 1.5), { alb: mixc(P.w2, P.w4, 0.4), h: 0.52 }); fill(PL([[px, 87.5], [px + 0.3, 87.5 - ph + 3.4], [px + pw / 2, 87.5 - ph + 2.6], [px + pw - 0.3, 87.5 - ph + 3.4], [px + pw, 87.5]], false), { alb: mixc(P.w1, P.w3, 0.5), h: 0.52 }); }
  box(224, 96, 36, 38, P.w4, { ...WOOD(P.w4), bv: 1.5 }); fill(R(226, 98, 32, 34), { alb: (x, y) => mulc(P.w6, 0.75 + 0.35 * fbm(x * 0.35, y * 0.35, 3)), h: (x, y) => 0.45 + 0.08 * fbm(x * 0.6, y * 0.6, 2), spec: 0.02, dep: 3 });
  fill(R(228, 100, 18, 16), { alb: (x, y) => mixc(P.n6, P.n7, fbm(x * 0.1, y * 0.1, 2)), h: 0.52 }); for (const yy of [104, 108, 112]) ink([[229, yy], [245, yy]], P.n5, 0.5); ink([[232, 102], [242, 112]], P.n5, 0.5);
  const pins = [[230, 103], [241, 106], [235, 113], [252, 122], [233, 126]]; for (let i = 0; i < pins.length - 1; i++) ink([pins[i], pins[i + 1]], mulc(BAK, 0.8), 0.5); for (const [px, py] of pins) fill(E(px, py, 0.8, 0.8), { alb: mixc(P.w7, P.w5, 0.5), round: 1, rh: 0.5, h: 0.6, spec: 0.8, shin: 0.8 });
  box(248, 101, 9, 10, P.n7, { bv: 0.5 }); fill(R(249, 102, 7, 6), { alb: (x, y) => mixc(P.n2, P.sk, fbm(x * 0.4, y * 0.4, 2) * 0.5), h: 0.5 });
  for (const [nx, ny, nc] of [[228, 119, mixc(P.w8, P.n6, 0.5)], [244, 120, P.n7], [250, 113, mixc(P.n7, P.c7, 0.25)], [238, 125, P.n6]]) { fill(R(nx, ny, 7, 6), { alb: nc, h: (x, y, i) => 0.5 + 0.1 * i.v, spec: 0.03 }); ink([[nx + 1, ny + 2.5], [nx + 5, ny + 2.5]], P.n4, 0.5); }
  // shelf of old radios
  box(112, 146, 112, 3, P.w5, { ...WOOD(P.w5), bv: 1, occ: 1 }); for (const bx of [116, 214]) { box(bx, 149, 1.2, 6, P.n3, { bv: 0.3 }); box(bx, 154, 4, 1.2, P.n3, { bv: 0.3 }); }
  for (const [x, w, h, c] of [[114, 22, 14, P.w5], [138, 16, 12, P.n6], [156, 24, 16, BAK], [182, 14, 10, BGR], [198, 22, 14, P.w4]]) radioSet(x, 146 - h, w, h, c);
  // floor lamp and warm string lights
  fill(R(62.8, 174, 1.6, 50), { alb: P.n4, h: cylU(0.4, 0.4), spec: 0.6, shin: 0.7, occ: 1, dep: 3 }); box(58, 223, 11, 4, P.n3, { bv: 1, spec: 0.5, occ: 1 });
  fill(PL([[57, 174], [58, 164], [69, 164], [71, 174]], false), Object.assign(MAT.fabric(P.w6), { h: cylU(0.4, 0.3), spec: 0.02, occ: 1, eh: (x, y, i) => mulc(P.w6, 0.25 + 0.35 * i.v), ehg: 0 }));
  fill(R(57.5, 173, 13, 1), { eh: P.w9 });
  for (let x = 20; x <= 250; x += 1) { const t = (x - 20) / 230, y = 66 + 18 * t * (1 - t); fill(R(x, y, 1, 0.5), { alb: P.n1, h: 0.6 }); if (x % 9 === 0) fill(E(x, y + 1.5, 0.9, 1.1), { alb: P.w2, h: 0.6, eh: (px, py, i) => i.d > 0.8 ? P.wA : P.w8, ehg: 8 }); }
  // rug, sofa, pillows, blanket, robot cat
  fill(R(46, 216, 58, 10), { alb: (x, y) => { const b = y < 434 || y > 449; if (b) return TOB; return ((x + y) % 16 < 4) ? TOB : ((x - y) % 20 === 0 ? P.w6 : mulc(BAK, 0.85 + 0.2 * fbm(x * 0.2, y * 0.2, 2))); }, h: (x, y) => 0.42 + 0.04 * fbm(x * 0.6, y * 0.6, 2), spec: 0.02, dep: 3, inn: 1 });
  const leather = c => ({ alb: (x, y) => mulc(c, 0.85 + 0.25 * fbm(x * 0.06, y * 0.06, 3)), spec: 0.3, shin: 0.55, dep: 3, occ: 1 });
  fill(PL([[44, 208], [44, 196], [48, 193], [98, 193], [102, 196], [102, 208]]), { ...leather(P.w5), round: 7, rh: 0.6, h: 0.35 });
  fill(PL([[44, 218], [44, 207], [102, 207], [102, 218]]), { ...leather(P.w4), round: 5, rh: 0.5, h: 0.35 });
  for (const ax of [40, 100]) fill(PL([[ax, 220], [ax, 200], [ax + 3, 197], [ax + 6, 200], [ax + 6, 220]]), { ...leather(P.w4), round: 3, rh: 0.6, h: 0.35 });
  for (const lx of [42, 101]) box(lx, 219, 3, 7, P.w1, { bv: 0.5, occ: 1 });
  fill(PL([[74, 205], [74, 198], [79, 196], [83, 198], [83, 205]]), { ...MAT.fabric(BAK), round: 4, rh: 0.6, h: 0.35, spec: 0.03, occ: 1, dep: 3 });
  fill(PL([[85, 205], [86, 199], [92, 198], [93, 205]]), { ...MAT.fabric(mixc(P.w6, P.n5, 0.45)), round: 3, rh: 0.6, h: 0.35, spec: 0.03, occ: 1, dep: 3 });
  fill(PL([[46, 196], [62, 195], [66, 200], [63, 208], [66, 214], [62, 221], [46, 221]]), { alb: (x, y) => mulc((((x >> 2) + (y >> 2)) % 3 === 0) ? mixc(P.c3, P.n3, 0.55) : ((x + y) % 12 < 6 ? mixc(P.c4, P.n4, 0.6) : mixc(P.c5, P.n5, 0.6)), 0.9 + 0.15 * fbm(x * 0.1, y * 0.1, 2)), h: (x, y) => 0.5 + 0.18 * Math.sin(x * 0.25 + y * 0.08), round: 3, rh: 0.3, spec: 0.03, occ: 1, dep: 3 });
  fill(PL([[84, 207], [84.6, 201.6], [89, 200.8], [97, 201], [99.4, 202.4], [99.6, 207]]), { alb: (x, y) => mulc(P.w4, 0.8 + 0.3 * fbm(x * 0.08, y * 0.08, 3)), round: 3, rh: 0.5, h: 0.4, spec: 0.35, shin: 0.6, occ: 1, dep: 3 }); fill(LN(86, 203.6, 98, 203.4, 0.5), { alb: P.w2, h: 0.36 }); fill(R(91, 203, 2, 1.6), { alb: mixc(P.w7, P.n6, 0.4), round: 0.6, rh: 0.4, h: 0.5, spec: 0.9, shin: 0.8 });
  // workbench
  box(126, 180, 118, 6, P.w5, { ...WOOD(P.w5), bv: 1.5, occ: 1 });
  for (const lx of [130, 238]) fill(R(lx, 186, 3, 41), { ...WOOD(P.w3), h: cylU(0.35, 0.35), occ: 1 });
  box(146, 204, 32, 22, P.w4, { ...WOOD(P.w4), bv: 1.5, occ: 1 }); for (const yy of [210, 218]) fill(R(147, yy, 30, 0.6), { alb: P.w2, h: 0.35 });
  fill(R(156, 211.5, 9, 5), { alb: paper, h: 0.55, spec: 0.03 }); ink([[157.2, 213], [163, 213.2]], P.n4, 0.4); ink([[157.2, 214.8], [161.4, 214.8]], P.n4, 0.4);
  box(182, 210, 22, 16, P.n3, { bv: 1, spec: 0.35, occ: 1 }); fill(R(187, 214, 8, 4.6), { alb: paper, h: 0.55, spec: 0.03 }); ink([[188, 215.6], [193.6, 215.6]], P.n4, 0.4);
  box(208, 214, 16, 12, P.n1, { bv: 1, spec: 0.4, occ: 1 }); box(210, 212, 3, 2, BAK, { bv: 0.5, spec: 0.6 }); box(219, 212, 3, 2, P.n6, { bv: 0.5, spec: 0.8 });
  box(138, 188, 34, 4, P.n5, { bv: 1, spec: 0.4, occ: 1 }); fill(E(169, 189.5, 0.6, 0.6), { eh: P.m5 }); fill(E(145, 189.5, 0.6, 0.6), { eh: P.g3 });
  for (const [x0, x1, y0, d] of [[138, 160, 192, 7], [172, 236, 188, 5]]) { let px = x0, py = y0; for (let x = x0 + 1; x <= x1; x++) { const t = (x - x0) / (x1 - x0), ny = y0 + 4 * d * t * (1 - t); fill(LN(px, py, x, ny, 0.9), { alb: P.n0, h: 0.6, spec: 0.4, occ: 1 }); px = x; py = ny; } }
  // machines on the bench
  fill(PL([[132, 180], [132, 150], [134, 148], [158, 148], [160, 150], [160, 180]], false), { alb: (x, y) => mulc(P.n6, 0.9 + 0.12 * fbm(x * 0.05, y * 0.05, 2)), bevel: 3, bh: 0.35, h: 0.4, spec: 0.25, shin: 0.45, occ: 1, dep: 3 });
  fill(R(136, 152, 20, 18), { alb: P.g1, h: (x, y, i) => 0.55 + 0.15 * (1 - ((2 * i.u - 1) ** 2 + (2 * i.v - 1) ** 2) / 2), spec: 0.9, shin: 0.95, ehg: 1,
    eh: (x, y) => { const wv = 322 + Math.sin(x * 0.35) * 8, d = Math.abs(y - wv); const base = mixc(P.g1, P.g2, 0.55); return mixc(base, (y & 1) ? P.g1 : base, 0.35).map((v, i) => v + (d < 1.2 ? [0.6, 1, 0.7][i] : d < 3 ? [0.2, 0.5, 0.25][i] : 0)); } });
  for (let x = 152; x < 158; x += 2) fill(R(x, 172, 1, 4), { alb: P.n4, h: 0.3 });
  fill(R(160, 166, 3, 14), { alb: P.g2, h: 0.55, spec: 0.3, occ: 1, dep: 3 }); for (let y = 168; y < 179; y += 3) fill(R(160.6, y, 1.6, 1.2), { alb: P.w7, h: 0.7, spec: 0.7 });
  box(164, 162, 20, 18, P.n4, { bv: 1.5, spec: 0.3, occ: 1 }); fill(E(171, 170, 5, 5), { alb: P.g1, h: 0.6, spec: 0.9, shin: 0.95, ehg: 1, eh: (x, y) => { const wv = 340 + Math.sin(x * 0.6) * 4; return Math.abs(y - wv) < 1.2 ? P.g3 : mixc(P.g1, P.g2, 0.3); } });
  for (const [kx, ky, kc] of [[179, 166, P.w7], [179, 170, P.w7]]) fill(E(kx, ky, 1.1, 1.1), { alb: kc, round: 1.5, rh: 0.5, h: 0.5, spec: 0.5 }); fill(E(179, 174, 0.7, 0.7), { eh: P.m5 });
  box(188, 176, 18, 4, P.w5, { ...WOOD(P.w5), bv: 1, occ: 1 });
  for (const tx of [190, 194, 198, 202]) fill(PL([[tx - 1.4, 176], [tx - 1.4, 168], [tx, 166], [tx + 1.4, 168], [tx + 1.4, 176]], false), { alb: mulc(P.n6, 0.6), h: cylU(0.4, 0.4), spec: 0.95, shin: 0.97, occ: 1, dep: 3, ehg: 2, eh: (x, y, i) => i.u > 0.3 && i.u < 0.7 && i.v > 0.25 ? mixc(P.w7, P.w9, i.v) : mulc(P.w5, 0.3) });
  box(208, 160, 30, 20, P.w5, { ...WOOD(P.w5), bv: 2, occ: 1 });
  for (let y = 163; y < 177; y += 1.6) fill(R(210, y, 9, 0.7), { alb: P.w2, h: 0.35 });
  fill(R(222, 163, 13, 6), { alb: P.n1, h: 0.5, spec: 0.9, shin: 0.95, eh: (x, y, i) => mixc(P.w7, P.w9, 1 - Math.abs(i.u - 0.5) * 2) }); fill(R(228, 163, 0.6, 6), { eh: P.w2 });
  for (const kx of [225, 232]) fill(E(kx, 174, 2.2, 2.2), { alb: P.n2, round: 3, rh: 0.5, h: 0.5, spec: 0.6, shin: 0.7 });
  box(240, 176, 6, 4, P.n3, { bv: 1, spec: 0.5, occ: 1 }); fill(LN(243, 176, 239.5, 146, 1.4), { alb: P.n4, h: 0.6, spec: 0.7, occ: 1 }); fill(LN(239.5, 146, 228, 140, 1.4), { alb: P.n4, h: 0.6, spec: 0.7, occ: 1 });
  fill(PL([[221, 142], [223, 137], [231, 137], [233, 142]], false), { alb: P.n3, h: cylU(0.4, 0.4), spec: 0.7, shin: 0.8, occ: 1, dep: 3 }); fill(R(223.5, 141.6, 7, 1), { eh: P.wA });
  fill(PL([[126.5, 180], [126.5, 174], [131.5, 174], [131.5, 180]], false), { alb: P.n6, h: cylU(0.4, 0.4), spec: 0.6, shin: 0.7, occ: 1, dep: 3 });
  // kettle on a gas burner, on a crate
  box(244, 210, 16, 18, P.w4, { ...WOOD(P.w4), bv: 1.5, occ: 1 }); box(245, 205, 14, 5, P.n3, { bv: 1, spec: 0.5, occ: 1 });
  for (let x = 247; x < 257; x += 1.2) fill(PL([[x, 205], [x + 0.6, 202.2 - k.R(0, 1.5)], [x + 1.2, 205]], false), { eh: (px, py, i) => mixc(P.c9, P.c6, i.v), ehg: 3 });
  fill(PL([[246.5, 204], [247, 197], [252, 194.5], [257, 197], [257.5, 204]]), { alb: P.n5, round: 4, rh: 0.6, h: 0.35, spec: 0.85, shin: 0.88, occ: 1, dep: 3 });
  fill(LN(256.5, 199.5, 260.5, 196, 1.2), { alb: P.n5, h: 0.6, spec: 0.8, occ: 1 }); fill(E(252, 193.8, 1.6, 0.8), { alb: P.n2, h: 0.6, spec: 0.5 });
}
function drawFixer() {
  // the fixer: a heavy-set mechanic on a wooden chair, khaki shirt, rolled sleeves, suspenders; his visor is opened up and rewired (the black-market red LED)
  const f = painter(0, 0), KH = mixc(P.w6, P.n6, 0.55), KH_S = mixc(P.w4, P.n3, 0.5), KH_L = mixc(P.w8, P.n7, 0.45), KH_G = mixc(KH, P.g3, 0.22), BRN = mixc(P.w2, P.n1, 0.4);
  const TRS = mixc(P.n2, P.c2, 0.3), TRS_L = mixc(P.n4, P.w4, 0.25), SK = mixc(P.sk, P.w6, 0.12), SK_S = mixc(P.sk2, P.w3, 0.35), SK_L = mixc(P.sk, P.wA, 0.4), HR = mixc(P.n1, P.w2, 0.4), HR_L = mixc(P.n5, P.w4, 0.3);
  const warmEdge = { eh: mulc(P.w8, 0.24) }, crt = { eh: mulc(P.g3, 0.18) };
  for (const lx of [107.4, 122.6]) fill(LN(lx, 201, lx + (lx < 115 ? -1.2 : 1.2), 227, 1.3), { ...WOOD(P.w4), occ: 1 });
  fill(LN(108.2, 199, 107.4, 176, 1.3), { ...WOOD(P.w4), occ: 1 }); for (const ry of [180, 186]) fill(LN(107.4, ry, 109.6, ry - 0.4, 0.9), { ...WOOD(P.w5), occ: 1 });
  box(105.6, 198, 19, 3, P.w5, { ...WOOD(P.w5), bv: 1, occ: 1 });
  const legs = f.part([[112, 195], [124, 193.6], [132, 194.6], [135.4, 197.4], [135.6, 201.4], [135.8, 223.6], [131.8, 223.8], [131.6, 203], [123, 202.4], [112, 201.6]], TRS, { layers: [
    [[[113, 195], [124, 193.8], [132, 194.8], [134.6, 197], [132, 196.8], [124, 196.2], [113, 197.2]], TRS_L], [[[134.2, 203], [135.6, 203], [135.8, 223.4], [134.6, 223.4]], TRS_L]] });
  f.edge(legs, -0.5, 0.5, warmEdge);
  f.part([[130.4, 222.6], [136.4, 222.4], [139.6, 225.4], [139.8, 228], [130.2, 228]], mixc(P.w2, P.n1, 0.25), { spec: 0.35, layers: [[[[131.6, 222.8], [136.2, 222.6], [138.4, 224.6], [133.4, 224.4]], mixc(P.w4, P.n5, 0.3)]] });
  const back = f.part([[111.0, 198.6], [109.8, 191], [110.2, 183], [112.4, 176.6], [116.0, 171.6], [121.0, 169.2], [126.8, 169.6], [129.6, 172.8], [130.4, 178.4], [129.4, 185], [128.4, 191.4], [127.0, 196.6], [123, 199]], KH, { layers: [
    [[[111.0, 198.6], [109.8, 191], [110.2, 183], [112.4, 176.6], [114.4, 177.2], [113.0, 185], [114.0, 193], [116.4, 198.8]], KH_S],
    [[[113.4, 175.0], [116.0, 171.6], [121.0, 169.2], [126.8, 169.6], [127.8, 171.0], [121.4, 171.4], [116.6, 173.6]], KH_L],
    [[[128.2, 175.4], [130.4, 178.4], [129.2, 185], [128.0, 191.4], [127.0, 190.6], [128.0, 184]], KH_G]] });
  f.stroke([[120.4, 170.2], [117.6, 186], [117.6, 197.4]], 0.9, BRN); f.stroke([[125.6, 170.0], [128.4, 177], [127.2, 196]], 0.8, BRN);
  for (const [bx, by] of [[117.8, 196.6], [125.4, 195.6]]) f.dot(bx, by, 0.45, { alb: mixc(P.w7, P.n6, 0.4), h: 0.5, spec: 0.8, shin: 0.8, dep: 3 });
  f.edge(back, -0.5, 0.5, warmEdge); f.edge(back, 0.6, 0, { eh: mulc(P.w7, 0.16) });
  const arm = f.part([[122.4, 172.2], [128.0, 171.6], [130.2, 176.8], [130.4, 182.6], [129.0, 185.4], [124.6, 185.6], [123.4, 180.0], [122.0, 176.2]], KH, { layers: [
    [[[122.4, 172.2], [124.8, 172.0], [126.0, 179.0], [126.4, 185.6], [124.6, 185.6], [123.4, 180.0], [122.0, 176.2]], KH_S], [[[128.0, 171.6], [130.2, 176.8], [130.4, 182.6], [129.2, 182.6], [128.8, 176.6]], KH_G]] });
  f.edge(arm, -0.45, 0.4, crt);
  f.part([[124.2, 182.8], [130.6, 182.0], [131.0, 185.6], [124.8, 186.6]], mixc(KH_L, P.n7, 0.3), { layers: [[[[124.2, 184.8], [131.0, 184.0], [131.0, 185.6], [124.8, 186.6]], KH_S]] });
  const fore = f.part([[125.4, 186.4], [128.8, 184.0], [134.0, 179.4], [136.2, 180.8], [130.6, 187.2], [127.0, 188.0]], SK, { layers: [
    [[[126.0, 187.6], [130.2, 186.8], [135.8, 181.0], [136.2, 180.8], [130.6, 187.2], [127.0, 188.0]], SK_S], [[[128.8, 184.0], [134.0, 179.4], [134.6, 179.8], [129.6, 184.6]], SK_L]] });
  for (let hx = 128.6; hx < 134; hx += 1.1) f.stroke([[hx, 185.4 - (hx - 128.6) * 0.8], [hx + 0.5, 185.0 - (hx - 128.6) * 0.8]], 0.18, SK_S);
  f.edge(fore, -0.4, 0.4, warmEdge);
  f.part([[133.8, 178.4], [137.6, 178.0], [138.4, 180.2], [136.8, 181.8], [134.0, 181.2]], SK, { layers: [[[[134.0, 180.4], [138.2, 180.0], [136.8, 181.8], [134.0, 181.2]], SK_S]] });
  f.part([[136.6, 175.0], [138.2, 175.0], [138.4, 178.6], [136.4, 178.6]], mulc(P.n6, 0.7), { spec: 0.95, shin: 0.95 }); f.dot(137.4, 176.4, 0.4, { eh: mulc(P.w8, 0.5) });
  f.part([[125.0, 170.6], [128.6, 169.4], [130.0, 172.2], [127.6, 174.0], [125.0, 173.4]], SK_S);
  const head = f.part([[124.98, 165.85], [125.21, 161.37], [127.45, 158.46], [130.81, 157.78], [133.50, 159.13], [134.84, 161.82], [135.06, 163.61], [136.41, 165.18], [135.96, 166.30], [135.06, 166.52], [135.29, 167.86], [134.39, 169.43], [131.6, 170.8], [128.6, 170.8], [126.55, 169.43]], SK, { sm: false, layers: [
    [[[124.98, 165.85], [125.21, 161.37], [127.00, 160.92], [127.90, 166.07], [129.0, 170.6], [126.55, 169.43]], SK_S],
    [[[132.60, 165.85], [135.29, 166.30], [135.29, 167.86], [134.39, 169.43], [131.6, 170.8], [128.6, 170.8], [128.57, 169.21], [131.48, 168.76]], mixc(SK_S, HR, 0.55)],
    [[[134.39, 162.04], [135.06, 163.61], [136.41, 165.18], [135.51, 165.40], [134.39, 164.06]], SK_L]] });
  f.edge(head, -0.5, 0.5, warmEdge); f.edge(head, -0.45, 0, crt);
  f.part([[124.54, 166.07], [124.54, 161.14], [126.55, 158.01], [130.36, 156.89], [133.72, 158.01], [135.29, 160.47], [132.15, 159.58], [128.79, 160.25], [127.67, 162.49], [127.67, 166.30], [126.10, 167.19]], HR, { layers: [[[[126.55, 158.01], [130.36, 156.89], [133.72, 158.01], [130.58, 158.23], [127.67, 159.35]], HR_L]] });
  f.dot(128.12, 164.73, 0.85, { alb: SK_S, h: 0.5, dep: 3, occ: 1 });
  f.stroke([[128.79, 162.04], [124.98, 162.71]], 0.6, mixc(P.n2, P.n4, 0.4), { spec: 0.6 });
  const vis = f.part([[129.46, 160.47], [134.39, 160.25], [135.51, 162.26], [134.39, 164.28], [129.91, 164.50], [129.02, 162.49]], mixc(P.n2, P.n4, 0.5), { spec: 0.85, shin: 0.85, layers: [[[[129.46, 160.47], [134.39, 160.25], [135.06, 161.37], [130.36, 161.59]], mixc(P.n5, P.n7, 0.4)]] });
  f.part([[135.06, 161.37], [137.53, 161.14], [137.98, 163.83], [135.29, 164.06]], mixc(P.n3, P.w5, 0.3), { spec: 0.9, shin: 0.9 }); f.dot(137.75, 162.49, 0.75, { alb: mixc(P.n6, P.c8, 0.3), h: 0.5, spec: 1, shin: 0.97, dep: 3 });
  for (const [a, b] of [[[130.36, 164.50], [131.03, 166.97]], [[131.48, 164.50], [132.82, 166.52]]]) f.stroke([a, b], 0.2, mixc(P.r4, P.w6, 0.3));
  f.dot(130.14, 161.59, 0.3, { eh: P.r5, ehg: 0 }); f.edge(vis, -0.4, 0, crt);

  box(128, 227, 9, 1, P.n1, { bv: 0.3, occ: 1 });
}
