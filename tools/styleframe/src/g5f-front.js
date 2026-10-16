/* ---------- the shop front: a glazed front across the open shop, so the street sees the radio repair from outside ---------- */
// In design units, like the room: the opening runs x 8–262, y 52–228. The front stands in it: a head rail and a transom
// bar, three panes of shop window over a panelled stall riser, and the door at the right, next to the pillar. The lit
// shop and the fixer stay visible through the glass, which is grimy in raw view and spotless in the Concierge's.
const FRONT = { door: [222, 258], doorGlass: [227, 99, 26, 51], mulls: [76.5, 148.5], transom: 88.5, sill: 188.5 };
/* the front's solid parts face the street: they take the street's light, not the shop's (see the zone map in g7) */
const frontSolid = (x, y) => (x >= 218 && x < 262 && y >= 52 && y < 228 && !(x >= 227 && x < 253 && y >= 99 && y < 150)) || (x >= 8 && x < 218 && y >= FRONT.sill && y < 228);
function glaze(gx, gy, gw, gh, seed) {
  const X0 = Math.round(gx * S2), Y0 = Math.round(gy * S2), X1 = Math.round((gx + gw) * S2), Y1 = Math.round((gy + gh) * S2), W = X1 - X0;
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    const p = y * NW + x, q = p * 3, u = (x - X0) / W, v = (y - Y0) / (Y1 - Y0);
    // the street caught in the glass: a broad soft band and a thin bright one, slanting the same way in every pane
    const s = (x - X0) + (Y1 - y) * 0.6 + seed * 23, band = (c, w) => Math.max(0, 1 - Math.abs(s - c) / w);
    const refl = Math.min(1, band(W * 0.3 + 40, 30) * 0.5 + band(W * 0.3 + 84, 4) * 0.55 + band(W * 0.9, 46) * 0.2);
    // grime: a film that thickens towards the bottom and the edges, streaked where the rain ran down
    const edge = Math.max(0, 0.1 - Math.min(u, 1 - u, v)) / 0.1;
    const film = Math.max(0, Math.min(1, Math.max(0, v - 0.5) * 1.4 + edge * 0.5 + (fbm(x * 0.07, y * 0.01, 3) - 0.48) * 0.9));
    const raw = [G.alb[q], G.alb[q + 1], G.alb[q + 2]], con = G.arm[p] ? [G.albA[q], G.albA[q + 1], G.albA[q + 2]] : raw;
    let r = mulc(raw, 0.72); r = mixc(r, mixc(P.n3, P.w2, 0.3), film * 0.6); r = mixc(r, P.n6, refl * 0.28);
    let c = mulc(con, 0.86); c = mixc(c, mixc(P.c6, P.n7, 0.5), refl * 0.22);
    G.alb[q] = r[0]; G.alb[q + 1] = r[1]; G.alb[q + 2] = r[2];
    G.albA[q] = c[0]; G.albA[q + 1] = c[1]; G.albA[q + 2] = c[2]; G.arm[p] = 1; G.covC[p] = Math.max(G.covC[p], G.covR[p]);
    G.eh[q] += 0.02 * refl; G.eh[q + 1] += 0.024 * refl; G.eh[q + 2] += 0.03 * refl;
    G.spec[p] = Math.max(G.spec[p], 0.3); G.shin[p] = Math.max(G.shin[p], 0.8);
  }
}
function drawFront() {
  const LAC = mixc(P.g1, P.n1, 0.4), LAC_HI = mixc(P.g2, P.n3, 0.5);
  const lac = (col = LAC, o = {}) => Object.assign({ alb: (x, y) => mulc(col, 0.88 + 0.22 * fbm(x * 0.04, y * 0.04, 2)), h: 0.5, bevel: 1.4, bh: 0.28, spec: 0.4, shin: 0.72, dep: 3, occ: 1, inn: 0 }, o);
  const gold = { alb: (x, y) => mixc(P.w6, P.w9, fbm(x * 0.15, y * 0.15, 2)), h: 0.55, spec: 0.9, shin: 0.85, dep: 3, inn: 0 };
  const [m1, m2] = FRONT.mulls, [d0, d1] = FRONT.door, T = FRONT.transom, SL = FRONT.sill;
  // the glass first, over the shop as it is drawn; the frames go on top
  const cols = [[12, m1], [m1 + 3, m2], [m2 + 3, 218]];
  cols.forEach(([a, b], i) => { glaze(a, 55.5, b - a, T - 55.5, i * 2); glaze(a, T + 3.5, b - a, SL - T - 3.5, i * 2 + 1); });
  glaze(d0, 55.5, d1 - d0, T - 55.5, 7);
  glaze(...FRONT.doorGlass, 9);
  // head rail, transom bar with a gold line, posts and mullions
  fill(R(8, 52, 254, 3.5), lac());
  fill(R(8, T, 254, 3.5), lac()); fill(R(10, T + 1.6, 208, 0.5), gold);
  fill(R(8, 52, 4, 176), lac()); fill(R(218, 52, 4, 176), lac()); fill(R(258, 52, 4, 176), lac());
  for (const mx of FRONT.mulls) { fill(R(mx, 55.5, 3, T - 55.5), lac(LAC, { bevel: 1 })); fill(R(mx, T + 3.5, 3, SL - T - 3.5), lac(LAC, { bevel: 1 })); }
  // the stall riser: a sill, three raised panels under the panes, a scuffed kick rail
  fill(R(10, SL, 210, 4), lac(LAC_HI, { spec: 0.5, shin: 0.8 })); fill(R(10, SL, 210, 0.6), { alb: mixc(LAC_HI, P.n6, 0.5), h: 0.6, spec: 0.6, dep: 3, inn: 0 });
  fill(R(12, SL + 4, 206, 36 - 4), lac(mulc(LAC, 0.85), { bevel: 0.8, bh: 0.1 }));
  for (const [a, b] of cols) {
    fill(R(a + 4, SL + 8, b - a - 8, 22), lac(LAC, { bevel: 2.2, bh: 0.32 }));
    fill(R(a + 6.5, SL + 10.5, b - a - 13, 17), lac(mulc(LAC, 0.92), { bevel: 1.2, bh: -0.12 }));
  }
  fill(R(12, 223.5, 206, 4.5), Object.assign(MAT.metal(P.n3, { rust: 0.5 }), { bevel: 0.8, bh: 0.15, spec: 0.35, shin: 0.5, dep: 3, occ: 1, inn: 0 }));
  // the door: lacquered like the front, a glass upper pane with a blank card hung in it, two panels, letter plate, knob
  const [gx, gy, gw, gh] = FRONT.doorGlass;
  fill(coverOps(c => c.rect(d0, T + 3.5, d1 - d0, 228 - T - 3.5), [{ draw: c => c.rect(gx, gy, gw, gh), mode: 'out' }], d0, T + 3.5, d1 - d0, 228 - T - 3.5), lac(LAC_HI, { bevel: 1.8 }));
  for (const [x, y, w, h] of [[gx - 1.2, gy - 1.2, gw + 2.4, 1.2], [gx - 1.2, gy + gh, gw + 2.4, 1.2], [gx - 1.2, gy, 1.2, gh], [gx + gw, gy, 1.2, gh]]) fill(R(x, y, w, h), lac(LAC, { bevel: 0.6 }));
  // a card hung inside the glass: real paper, so the Concierge's clean glass must not hide it (arAlb keeps it in its view)
  const card = (x, y) => mulc(mixc(P.n7, P.w6, 0.25), 0.9 + 0.12 * fbm(x * 0.2, y * 0.2, 2));
  for (const [px, py] of [[236, gy + 0.5], [244, gy + 0.5]]) fill(LN(px, py, 240, gy + 6, 0.35), { alb: P.n6, arAlb: P.n6, h: 0.55, dep: 3, inn: 0 });
  fill(R(233, gy + 6, 14, 8), { alb: card, arAlb: card, h: 0.55, bevel: 0.6, bh: 0.1, spec: 0.03, dep: 3, occ: 1, inn: 0 });
  for (const [py, ph] of [[156, 28], [190, 30]]) { fill(R(d0 + 5, py, d1 - d0 - 10, ph), lac(LAC_HI, { bevel: 2, bh: 0.3 })); fill(R(d0 + 7.5, py + 2.5, d1 - d0 - 15, ph - 5), lac(mulc(LAC_HI, 0.9), { bevel: 1, bh: -0.1 })); }
  fill(R(232, 151, 16, 3), Object.assign({}, gold, { bevel: 0.6, bh: 0.2 })); fill(R(234, 152.2, 12, 0.6), { alb: P.n0, h: 0.3, dep: 3, inn: 0 });
  fill(E(253.4, 172, 1.5, 1.5), Object.assign({}, gold, { round: 2, rh: 0.5 })); fill(R(252.6, 175, 1.6, 4), Object.assign({}, gold, { bevel: 0.4 }));
  fill(R(d0, 222.5, d1 - d0, 5.5), Object.assign(MAT.metal(P.n4, { rust: 0.5 }), { bevel: 0.6, bh: 0.15, spec: 0.45, shin: 0.6, dep: 3, occ: 1, inn: 0 }));
  // a worn stone step under the door
  fill(R(d0 - 2, 226.5, d1 - d0 + 4, 2.5), Object.assign(MAT.concrete(P.n4), { bevel: 0.8, bh: 0.2, spec: 0.1, dep: 3, inn: 0 }));
}
