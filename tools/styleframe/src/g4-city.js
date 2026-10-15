
/* ---------- the Concierge's skyline ---------- */
const FACE = [[100, 0], [62, 6], [40, 28], [30, 62], [27, 98], [34, 112], [25, 128], [6, 160], [8, 166], [24, 170], [22, 180], [17, 188], [27, 193], [19, 200], [30, 210], [25, 232], [34, 246], [60, 252], [78, 262], [82, 300], [152, 300], [150, 250], [165, 215], [188, 150], [181, 70], [150, 18]];
const SKY = y => { const t = Math.min(1, y / 456), st = [P.c1, P.v1, P.v2, P.v3, P.m2, P.m3], f = t * (st.length - 1), i = Math.min(st.length - 2, Math.floor(f)); return mulc(mixc(st[i], st[i + 1], f - i), 1.5); };
const GREY = c => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; return mixc([l, l, l], mulc(P.c4, l * 3.2), 0.3).map(v => v * 1.1); };
const AROF = c => { const g = GREY(c); return [Math.max(0, c[0] - g[0]), Math.max(0, c[1] - g[1]), Math.max(0, c[2] - g[2])]; };
const hazeM = k => ({ eh: (x, y) => mulc(GREY(SKY(y)), k), ea: (x, y) => mulc(AROF(SKY(y)), k), eag: 0 });
const clipR = (x, y, w, h) => { const x0 = Math.max(276, x), x1 = Math.min(452, x + w); return x1 > x0 ? R(x0, y, x1 - x0, h) : null; };
function cityTower(k, x, w, top, base, o) {
  const tiers = [[x, top, w]];
  if (w > 12 && k.chance(0.55)) { const nw = Math.round(w * k.R(0.5, 0.75)), nx = x + Math.round((w - nw) * k.R(0.2, 0.8)), nh = k.RI(8, 26); tiers.push([nx, top - nh, nw]); }
  for (const [tx, ty, tw] of tiers) fill(clipR(tx, ty, tw, base - ty), { alb: (px, py) => mulc(o.col, 0.85 + 0.25 * fbm(px * 0.05, py * 0.02, 2)), h: (px, py, i) => 0.45 + (((py - ty * 2) % (o.floor * 2)) === 0 ? -0.15 : 0), bevel: 1.5, bh: 0.25, spec: 0.25, shin: 0.5, dep: o.d, occ: 0, ...hazeM(o.haze) });
  for (const [tx, ty, tw] of tiers) for (let y = ty + 3; y < base - 3; y += o.floor) {
    const mode = k.r(), stripC = k.pick(o.wins), litP = mode < 0.5 ? 0.04 : mode < 0.86 ? o.lit : 0.92;
    for (let i = tx + 2; i < tx + tw - 2; i += o.sx) { const v = k.r(), col = mode >= 0.86 ? stripC : k.pick(o.wins), b = k.R(0.25, 0.85); if (v < litP && i >= 276 && i < 452) { const real = hash2(i * 7 + 3, y * 13 + o.d) < 0.2; fill(R(i, y, o.ww, o.wh), Object.assign({ alb: P.n0, h: 0.4, spec: 0.8, shin: 0.9, dep: o.d }, real ? { eh: mulc(mixc(P.w7, P.w9, hash2(i, y)), b * 0.75) } : { ea: mulc(col, b), eag: 0 })); } }
  }
  const [rx, ry, rw] = tiers[tiers.length - 1], r = k.r();
  if (r < 0.35) { for (let a = 0, n = k.RI(1, 3); a < n; a++) { const ax = rx + k.RI(1, Math.max(1, rw - 2)), ah = k.RI(6, 18); fill(clipR(ax, ry - ah, 0.8, ah), { alb: o.col, h: 0.5, spec: 0.3, dep: o.d }); if (ax >= 276 && ax < 452) SC.beacons.push([ax * 2, (ry - ah - 1) * 2, k.R(0, 6)]); } }
  else if (r < 0.6 && rw > 9) { const tx = rx + k.RI(1, rw - 8); fill(clipR(tx, ry - 10, 7, 7), { alb: o.col, h: cylU(0.35, 0.4), spec: 0.3, dep: o.d, ...hazeM(o.haze) }); fill(clipR(tx + 1, ry - 3, 0.8, 3), { alb: o.col, dep: o.d }); fill(clipR(tx + 5, ry - 3, 0.8, 3), { alb: o.col, dep: o.d }); }
  else if (r < 0.74 && rw > 10) { const bw = Math.min(rw - 2, k.RI(9, 15)), bx = rx + 1, by = ry - 9, c = k.pick([P.m4, P.c5, P.v4]); if (bx >= 276 && bx + bw < 452) { fill(R(bx, by, bw, 5), { ea: (px, py, i) => mixc(c, P.wA, i.v < 0.25 ? 0.5 : 0), eag: 6 }); fill(R(bx + 1, by + 5, 0.8, 4), { alb: o.col, dep: o.d }); } }
  const strip = k.r(), sc = k.pick([P.m5, P.c8, P.v4]), sy = k.RI(top + 4, Math.max(top + 5, base - 40)), sl = k.RI(10, 34);
  if (strip < o.neon && x + w - 2 >= 276 && x + w - 2 < 452) fill(R(x + w - 2, sy, 0.8, sl), { ea: sc, eag: 6 });
  if (o.d === 2) for (let y = top + k.RI(6, 14); y < base - 10; y += o.floor * k.RI(2, 3)) {
    if (k.chance(0.5)) { const ax = x + k.RI(1, Math.max(1, w - 6)); if (ax >= 276 && ax + 5 < 452) { box(ax, y, 5, 3, P.n2, { bv: 0.8, spec: 0.3, dep: 2 }); } }
    if (k.chance(0.35)) { const bx = x + 1, bw = Math.min(w - 2, k.RI(8, 14)); if (bx >= 276 && bx + bw < 452) { fill(R(bx, y + 4, bw, 0.8), { alb: o.edge, h: 0.6, spec: 0.5, dep: 2 }); for (let i = bx; i < bx + bw; i += 2) fill(R(i, y + 2, 0.6, 2), { alb: o.edge, h: 0.6, dep: 2 }); } }
  }
}
function drawCity() {
  const k = kit(31);
  const band = (x, y) => smooth((fbm(x * 0.0045 + 3, y * 0.016, 5) - 0.5) * 4);
  const skyAt = (x, y) => {
    let c = SKY(y); const n = fbm(x * 0.006, y * 0.03, 4); if (n > 0.55) c = mixc(c, mulc(P.v4, 1.4), (n - 0.55) * 1.6 * Math.min(1, y / 200));
    const cl = fbm(x * 0.0045 + 3, y * 0.016, 5); c = mixc(c, mulc(c, 0.45), band(x, y) * 0.8);
    return mixc(c, mulc(P.m5, 0.9), Math.max(0, 1 - Math.abs(cl - 0.5) * 12) * 0.35 * Math.min(1, y / 160));
  };
  fill(R(276, 0, 176, 228), { alb: P.n0, h: 0.5, dep: 0, eh: (x, y) => GREY(skyAt(x, y)), ea: (x, y) => AROF(skyAt(x, y)), eag: 0 });
  // the moon, behind the smog: only without the eye mod (group 9); with it, the same pixels show plain sky
  fill(E(423, 31, 40, 40), { ehg: 9, eag: 0, ea: skyAt, eh: (x, y) => {
    const c = GREY(skyAt(x, y)), md = Math.hypot(x - 846, y - 62), b = band(x, y);
    if (md < 17) return mixc(c, mixc(P.w9, P.n6, fbm(x * 0.09, y * 0.09, 3) * 0.8), smooth((17 - md) / 2) * (1 - b * 0.75));
    return mixc(c, mulc(P.v4, 1.5), Math.max(0, 1 - md / 80) ** 2 * 0.45 * (1 - b * 0.5)); } });
  // the Concierge's tower
  fill(PL([[300, 228], [303, 40], [309, 40], [312, 228]], false), { alb: (x, y) => mulc(P.v3, 0.8 + 0.2 * fbm(x * 0.1, y * 0.02, 2)), bevel: 2, bh: 0.3, h: 0.4, spec: 0.4, shin: 0.6, dep: 1, ...hazeM(0.45) });
  for (const ry of [62, 92, 124, 160]) { const hw = 7 + Math.round((ry - 40) / 30); fill(R(306 - hw, ry, hw * 2 + 1, 3), { alb: P.v4, bevel: 1, bh: 0.3, h: 0.45, spec: 0.5, dep: 1 }); for (let x = 306 - hw + 1; x < 306 + hw; x += 3) fill(R(x, ry + 1, 1, 1), { eh: mixc(P.c0, P.c7, 0.8) }); }
  fill(PL([[297, 41], [298, 30], [302, 24], [306, 22], [310, 24], [314, 30], [315, 41]]), { alb: P.v4, round: 5, rh: 0.6, h: 0.35, spec: 0.7, shin: 0.8, dep: 1, ...hazeM(0.4) });
  fill(R(305.6, 12, 0.8, 10), { alb: P.v3, h: 0.5, dep: 1 }); SC.beacons.push([612, 22, 0]);
  for (let a = 0; a < TAU; a += 0.05) { const x = 306 + Math.cos(a) * 13, y = 42 + Math.sin(a) * 2.2; fill(E(x, y, 0.6, 0.6), { eh: Math.sin(a) > 0 ? P.c9 : mulc(P.c7, 0.6) }); }
  // hologram face (eye mod only)
  const fp = ([fx, fy]) => [320 + fx * 0.36, 12 + fy * 0.36];
  fill(PL(FACE, true, fp), { useD: true, eag: 6, ea: (x, y, i) => {
    const rimv = Math.exp(-i.d / 2.5), core = smooth(i.d / 26), n = 0.7 + 0.6 * fbm(x * 0.04, y * 0.12 + 7, 3), scan = y % 3 === 0 ? 1 : 0.4, band = Math.floor(y / 9) % 7 === 3 ? 0.5 : 1;
    const v = (0.85 * rimv + (0.2 + 0.2 * core) * scan * n) * band * (1 - smooth((y - 170) / 70));
    const sky = AROF(skyAt(x, y)), f = mulc(mixc(P.c5, P.cA, Math.min(1, rimv * 1.2 + core * 0.2)), v); return [sky[0] + f[0], sky[1] + f[1], sky[2] + f[2]]; } });
  for (let fx = 44; fx <= 66; fx += 1) { const [x, y] = fp([fx, 114 + Math.sin((fx - 44) / 22 * Math.PI) * 6]); fill(R(x, y, 0.6, 0.6), { ea: mulc(P.c4, 0.5), eag: 6 }); }
  for (const fx of [50, 56, 62]) { const [x, y] = fp([fx, 120]); fill(LN(x, y, x - 0.4, y + 1.4, 0.4), { ea: mulc(P.c4, 0.5), eag: 6 }); }
  { const [x, y] = fp([19, 193]); fill(R(x, y, 4, 0.5), { ea: mulc(P.c4, 0.5), eag: 6 }); }
  // far towers, sky bridges, near towers
  for (let x = 268; x < 460;) { const w = k.RI(9, 22); cityTower(k, x, w, k.RI(66, 150), 228, { d: 1, col: mixc(P.v2, P.v1, 0.3), edge: P.v3, floor: 5, wins: [P.c7, mulc(P.w8, 0.8), P.w7, P.c6, mulc(P.n7, 0.7)], lit: 0.3, sx: 3, ww: 1, wh: 2, neon: 0.3, haze: 0.5 }); x += w + k.RI(-2, 2); }
  for (const [x0, x1, y] of [[330, 362, 136], [392, 428, 120], [286, 318, 150]]) { fill(clipR(x0, y, x1 - x0, 3), { alb: P.v3, h: cylV(0.35, 0.3), spec: 0.4, dep: 1, ...hazeM(0.35) }); for (let x = x0; x < x1; x += 3) if (x >= 276 && x < 452) fill(R(x, y + 1, 1, 1), { eh: mixc(P.c0, P.c7, 0.7) }); }
  for (let x = 266; x < 460;) { const w = k.RI(16, 34); cityTower(k, x, w, k.RI(118, 176), 228, { d: 2, col: P.c1, edge: P.c3, floor: 7, wins: [P.c8, P.w8, P.c7, mulc(P.w7, 0.7), mulc(P.n7, 0.6), mulc(P.w9, 0.6)], lit: 0.28, sx: 4, ww: 1.5, wh: 2.5, neon: 0.45, haze: 0.18 }); x += w + k.RI(0, 3); }
  // billboards the Concierge paints on the towers
  const panel = (x, y, w, h, top, bot, edge) => fill(R(x, y, w, h), { eag: 6, ea: (px, py, i) => (i.u < 0.03 || i.u > 0.97 || i.v < 0.06 || i.v > 0.94) ? edge : mixc(top, bot, i.v) });
  panel(294, 150, 22, 12, mulc(P.m3, 0.7), mulc(P.v2, 0.8), mulc(P.m5, 0.7)); fill(TXT('CALM', 305, 158.4, { size: 6.2, weight: 300, track: 1.6, align: 'center' }), { ea: P.m7, eag: 6 });
  panel(330, 176, 16, 9, mulc(P.c3, 0.8), mulc(P.c2, 0.8), mulc(P.c7, 0.6)); for (const [a, b] of bellStrokes(338, 181.6, 2.3)) neonTube([a, b], P.c8, P.cA, 6, null, 0.55);
  panel(414, 128, 24, 10, mulc(P.c4, 0.7), mulc(P.v2, 0.8), mulc(P.c7, 0.6)); fill(TXT('SAFE', 426, 135.4, { size: 5.6, weight: 300, track: 1.5, align: 'center' }), { ea: P.cA, eag: 6 });
}
