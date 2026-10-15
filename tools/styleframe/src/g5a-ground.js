
/* ---------- wet pavement, curb, road ---------- */
function drawGround() {
  const pv = MAT.concrete(P.n3);
  fill(R(0, 228, 480, 7), { alb: (x, y) => { let c = mulc(pv.alb(x, y), 0.85); if (x % 48 < 1.5 || (y - 456) % 7 === 0 && x % 96 > 50) c = mulc(c, 0.45); if (y < 458) c = mixc(c, P.n5, 0.45); return c; },
    h: (x, y) => (x % 48 < 1.5 ? 0.3 : pv.h(x, y) + (y < 458 ? 0.08 : 0)), spec: 0.55, shin: 0.75, dep: 3, refl: 1, occ: 0 });
  fill(R(0, 235, 480, 2), { alb: (x, y) => mulc(y < 471 ? P.n5 : P.n2, 0.8 + 0.3 * fbm(x * 0.1, y * 0.3, 2)), h: (x, y) => (y < 471 ? 0.62 : 0.35), spec: 0.5, shin: 0.7, dep: 3, refl: 1 });
  const tracks = y => Math.exp(-((y - 498) ** 2) / 50) + Math.exp(-((y - 526) ** 2) / 50);
  fill(R(0, 237, 480, 33), { alb: (x, y) => { const g = hash2(x, y); const c = g < 0.07 ? P.n3 : g < 0.2 ? P.c0 : P.c1; return mulc(c, (0.85 + 0.3 * fbm(x * 0.02, y * 0.06, 3)) * (1 - 0.3 * tracks(y))); },
    h: (x, y) => 0.5 + 0.12 * (hash2(x + 7, y) - 0.5) * (1 - tracks(y)) + 0.06 * fbm(x * 0.1, y * 0.2, 2), spec: 0.6, shin: 0.8, dep: 3, refl: 1, occ: 0 });
  for (let x = 20; x < 480; x += 40) fill(R(x, 255.5, 16, 1.2), { alb: (px, py) => mixc(P.n6, P.n3, fbm(px * 0.2, py * 0.5, 2) * 0.9), h: 0.55, spec: 0.5, dep: 3, refl: 1 });
  // manhole and curb drain
  fill(E(338, 247, 14, 3), { alb: (x, y) => { const dx = (x - 676) / 28, dy = (y - 494) / 6, r = Math.hypot(dx, dy); return r > 0.86 ? P.n1 : (Math.floor(dx * 9 + 9) % 2 ? P.n2 : mulc(P.n3, 0.9)); }, h: (x, y) => 0.5 + 0.08 * Math.sin((x - 676) * 1.1), spec: 0.8, shin: 0.85, dep: 3, refl: 1 });
  fill(R(312, 233, 14, 2), { alb: P.n0, h: 0.3, dep: 3, refl: 0 }); for (let x = 313; x < 326; x += 2) fill(R(x, 233, 0.8, 2), { alb: P.n4, h: 0.55, spec: 0.7, shin: 0.7 });
  // puddles: two overlapping ellipses each, so the edges are not perfect
  for (const [px, py, rx, ry] of [[300, 247, 24, 3], [372, 259, 40, 4], [432, 249, 30, 3], [470, 263, 14, 2], [190, 252, 28, 3], [88, 260, 32, 3], [236, 264, 18, 2], [462, 241, 12, 2]]) {
    fill(E(px, py, rx, ry), { alb: P.c0, h: 0.5, spec: 1, shin: 1, refl: 2, dep: 3 });
    fill(E(px + rx * 0.35, py - ry * 0.35, rx * 0.55, ry * 0.75), { alb: P.c0, h: 0.5, spec: 1, shin: 1, refl: 2, dep: 3 });
  }
}
