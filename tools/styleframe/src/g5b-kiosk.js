
/* ---------- the Concierge's street machine ---------- */
function drawKiosk() {
  OBJ = 1;
  const paint = MAT.metal(P.n3, { rust: 0.66 }), rivX = x => 750 + Math.round((x - 750) / 12) * 12;
  const seam = (x, y) => Math.abs(y - 352) < 1.2 || Math.abs(y - 396) < 1.2 || (Math.abs(x - 796) < 1.2 && y > 396 && y < 444);
  const shell = PL([[370, 227], [368, 170], [372, 148], [384, 136], [398, 132], [412, 136], [424, 148], [428, 170], [426, 227]]);
  fill(shell, {
    alb: (x, y) => {
      let c = mixc(paint.alb(x, y), P.c2, 0.25 * fbm(x * 0.01, y * 0.02, 2));
      for (const ry of [358, 402]) { const rc = rivX(x), dx = Math.abs(x - rc), len = 8 + 30 * hash2(rc, ry); if (y > ry && y < ry + len && dx < 1.6) c = mixc(c, P.w4, 0.75 * (1 - (y - ry) / len) * (1 - dx / 1.6)); }
      if (seam(x, y)) c = mulc(c, 0.4);
      if (hash2(x >> 2, y) < 0.006) c = mixc(c, P.n6, 0.6);
      return mulc(c, 0.7 + 0.3 * smooth((452 - y) / 90));
    },
    h: (x, y) => 0.5 + 0.03 * fbm(x * 0.4, y * 0.4, 2) - (seam(x, y) ? 0.25 : 0), round: 22, rh: 0.7, spec: 0.4, shin: 0.6, dep: 3, occ: 1 });
  for (let rx = 375; rx < 424; rx += 6) rivet(rx, 188.5, P.n4);
  // antenna with a beacon, a camera, a speaker
  fill(R(411.6, 122, 0.9, 12), { alb: P.n4, h: 0.6, spec: 0.6, dep: 3, occ: 1 }); fill(E(412, 122.4, 0.8, 0.8), { alb: P.n2, eh: P.m5, dep: 3 }); SC.beacons.push([824, 244, 1.7]);
  fill(E(381, 150, 2.4, 2.4), { alb: P.n3, round: 2, rh: 0.5, h: 0.5, spec: 0.7, shin: 0.8, dep: 3, occ: 1 }); fill(E(381, 150, 1.3, 1.3), { alb: P.n0, h: 0.6, spec: 1, shin: 1, dep: 3 }); fill(E(381.3, 149.8, 0.45, 0.45), { eh: P.m5 });
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (Math.hypot(i, j) <= 2.2) fill(E(398 + i * 0.9, 142 + j * 0.9, 0.28, 0.28), { alb: P.n0, h: 0.3 });
  // the eye: a socket, a bezel, a glass dome with a hexagonal iris
  fill(E(398, 158, 12.8, 12.8), { alb: P.n0, h: 0.35, dep: 3, occ: 1 });
  fill(E(398, 158, 12, 12), { ...MAT.metal(P.n4, { rust: 0.7 }), round: 5, rh: 0.6, h: 0.45, spec: 0.75, shin: 0.8, dep: 3, occ: 1 });
  fill(E(398, 158, 9.8, 9.8), { alb: P.n2, round: 2, rh: -0.3, h: 0.62, spec: 0.6, shin: 0.7, dep: 3 });
  fill(E(398, 158, 9, 9), { alb: P.n0, round: 9, rh: 0.5, h: 0.5, spec: 1, shin: 1, dep: 3, ehg: 4, eh: (x, y) => {
    const dx = (x - 796) / 2, dy = (y - 316) / 2, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx), seg = ((a + TAU) % (TAU / 6)) - TAU / 12, hexR = 3.8 / Math.cos(seg);
    if (r < 1.1) return mulc(P.c4, 0.8);
    if (r < hexR) return mixc(P.cA, P.c9, (r - 1.1) / (hexR - 1.1));
    return mulc(mixc(P.c9, P.c5, (r - hexR) / (9 - hexR)), Math.sin(a * 6 + r * 1.3) > 0.55 ? 0.5 : 1);
  } });
  fill(E(394.6, 154.2, 1.2, 0.8), { eh: P.cA, ehg: 4 });
  // the screen: black glass; the greeting is only in the eye mod
  box(378, 172, 40, 14, P.n3, { ...MAT.metal(P.n3, { rust: 0.7 }), bv: 1.2, spec: 0.5, shin: 0.6, occ: 1 });
  fill(R(379.5, 173.5, 37, 11), { alb: P.n0, h: 0.35, spec: 1, shin: 0.98, dep: 3, eag: 7, ea: (x, y, i) => (i.u < 0.012 || i.u > 0.988 || i.v < 0.04 || i.v > 0.96) ? mulc(P.c7, 0.45) : mulc(P.c2, 0.25 + 0.15 * i.v) });
  fill(TXT('Good evening.', 398, 178.8, { size: 4.6, weight: 300, track: 0.25, align: 'center' }), { ea: P.cA, eag: 7 });
  fill(R(390, 180.5, 16, 0.3), { ea: mulc(P.c7, 0.6), eag: 7 });
  fill(TXT('Dinner is served.', 398, 184.2, { size: 3.6, weight: 400, track: 0.2, align: 'center' }), { ea: mixc(P.c8, P.cA, 0.5), eag: 7 });
  // grille, and the dock: rest your wrist in the cradle and it feeds you through the implant it can see. The cradle is at
  // the height of a hand reaching out from someone kneeling at the machine, which is how the guests use it
  for (let y = 204; y < 216; y += 3) fill(R(376, y, 12, 1.4), { alb: P.n0, h: 0.25, spec: 0.1, dep: 3 });
  box(388, 191.5, 21, 5, P.n3, { ...MAT.metal(P.n4, { rust: 0.7 }), bv: 1.2, spec: 0.55, shin: 0.65, occ: 1 });
  fill(E(398.5, 194.2, 7.6, 1.9), { alb: P.n0, h: 0.22, spec: 0.3, dep: 3 });
  fill(E(398.5, 194.2, 6.6, 1.5), { useD: true, eh: (x, y, i) => (i.d < 1.1 ? P.c8 : null), ehg: 4 });
  fill(E(398.5, 194.4, 0.6, 0.5), { eh: P.cA, ehg: 4 });
  for (const fx of [391, 406]) fill(E(fx, 197.6, 1.2, 1.2), { alb: P.n2, round: 1.2, rh: 0.5, h: 0.5, spec: 0.7, shin: 0.75, dep: 3 });
  fill(R(371, 218, 54, 4), { alb: (x, y) => { const s = ((x + y) >> 3) % 2, worn = fbm(x * 0.12, y * 0.3, 3) > 0.62; return worn ? P.n3 : s ? mixc(P.w7, P.w5, fbm(x * 0.2, y * 0.2, 2)) : P.n1; }, h: 0.52, spec: 0.3, dep: 3 });
  fill(PL([[410.6, 210.8], [416.2, 211.3], [415.8, 216.4], [410.9, 216]], false), { alb: mixc(P.n7, P.w8, 0.15), h: 0.56, spec: 0.05, dep: 3 });
  fill(LN(411.6, 212, 415, 215.4, 0.6), { alb: P.w5, h: 0.56 }); fill(LN(415, 212, 411.6, 215.4, 0.6), { alb: P.w5, h: 0.56 });
  for (const fx of [374, 414]) box(fx, 224, 9, 4, P.n1, { bv: 1, spec: 0.3, occ: 1 });
  // its power cable, down into the street
  let cx0 = 425, cy0 = 200; for (let t = 0.05; t <= 1.001; t += 0.05) { const x = 425 + 21 * t, y = 200 + 28 * t * t; fill(LN(cx0, cy0, x, y, 1.3), { alb: P.n0, h: 0.6, spec: 0.5, shin: 0.6, dep: 3, occ: 1 }); cx0 = x; cy0 = y; }
  rim(maskOf([shell]), 730, 260, 862, 456, mulc(P.c7, 0.26), mulc(P.m5, 0.16), mulc(P.c8, 0.24), y => 0.25 + 0.75 * smooth((440 - y) / 150));
  OBJ = 0;
}
