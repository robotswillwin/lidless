
/* ---------- people: a walkway crowd that only the Concierge shows you, and someone at the dock ---------- */
function drawMidground() {
  // a raised walkway behind the street, in the haze
  for (const sx of [296, 360, 420]) fill(R(sx, 179.5, 3, 48.5), { alb: P.n1, h: 0.5, dep: 2, ...hazeM(0.3) });
  fill(R(276, 176.5, 176, 3), { alb: (x, y) => mulc(P.n2, 0.8 + 0.3 * fbm(x * 0.1, y * 0.3, 2)), h: 0.5, spec: 0.3, dep: 2, occ: 0, ...hazeM(0.22) });
  fill(R(276, 169, 176, 0.6), { alb: P.n3, h: 0.6, spec: 0.5, dep: 2, ...hazeM(0.25) }); for (let x = 278; x < 452; x += 7) fill(R(x, 169, 0.5, 7.5), { alb: P.n2, h: 0.6, dep: 2, ...hazeM(0.25) });
}
function drawCrowd() {
  // the crowd under umbrellas: Concierge view only
  const figure = (fx, h, umb, coat, rimC) => {
    const q = painter(fx, 176.5), s = h / 46, S = pts => pts.map(([x, y]) => [x * s, y * s]), ar = { arOnly: true };
    const sharp = cv => cv && fill(cv, { dep: 3 });
    const legs = q.part(S([[-2.2, -16], [2.2, -16], [2.0, 0], [0.8, 0], [0.2, -10], [-0.6, 0], [-1.8, 0]]), mixc(P.n1, P.c1, 0.5), ar);
    const body = q.part(S([[-3.2, -36], [3.0, -36.4], [4.0, -14], [-4.4, -14]]), coat, { arOnly: true, layers: [[S([[1.0, -36.2], [3.0, -36.4], [4.0, -14], [2.0, -14]]), mixc(coat, P.c4, 0.35)]] });
    const head = q.part(S([[-1.6, -41.4], [1.6, -41.6], [2.2, -38.6], [0.8, -36.6], [-1.4, -36.8], [-1.9, -39]]), mixc(P.sk2, P.n3, 0.4), ar);
    const can = q.part(S([[-9, -42], [-6, -46.4], [0, -48.4], [6, -46.4], [9, -42], [6, -42.8], [3, -42], [0, -42.8], [-3, -42], [-6, -42.8]]), umb, { arOnly: true, layers: [[S([[0, -48.4], [6, -46.4], [9, -42], [6, -42.8], [3, -42], [2, -46]]), mixc(umb, P.c5, 0.3)]] });
    for (const pt of [legs, body, head, can]) sharp(cover(pt.d, ...pt.bb));
    fill(LN(...q.tf(S([[1.4, -42]])[0]), ...q.tf(S([[1.4, -27]])[0]), 0.5), { ea: mixc(P.c9, P.cA, 0.4), eag: 6, dep: 3 });
    for (const pt of [body, legs]) q.edge(pt, -0.5, 0, { ea: mulc(rimC, 0.8), eag: 6 }); q.edge(body, 0.5, 0, { ea: mulc(P.c7, 0.35), eag: 6 });
    q.edge(can, 0, 0.6, { ea: mulc(rimC, 0.6), eag: 6 }); q.edge(can, -0.3, -0.6, { ea: mulc(P.c9, 0.35), eag: 6 }); q.edge(head, -0.4, 0, { ea: mulc(rimC, 0.6), eag: 6 });
  };
  figure(316, 40, mixc(P.n2, P.v2, 0.4), mixc(P.n2, P.c2, 0.4), P.m5);
  figure(331, 42, mixc(P.r3, P.n2, 0.4), mixc(P.n1, P.v1, 0.5), P.c8);
  figure(344, 39, mixc(P.c2, P.n2, 0.5), mixc(P.w2, P.n2, 0.5), P.m6);
  figure(395, 41, mixc(P.v2, P.n2, 0.4), mixc(P.n2, P.c2, 0.5), P.m5);
  figure(436, 38, mixc(P.n2, P.c3, 0.4), mixc(P.r2, P.n1, 0.5), P.c8);
  // one real person among them: in the raw world, the only one there, standing still in the rain
  const r = painter(352, 176.5), real = { dep: 2, occ: 0 };
  r.part([[-2.2, -33.4], [2.0, -34.0], [3.2, -17.6], [2.6, 0], [-2.6, 0], [-3.3, -17.6]], mixc(P.n3, P.w2, 0.3), { ar: mixc(P.n2, P.v2, 0.5), layers: [[[[0.7, -33.8], [2.0, -34.0], [3.2, -17.6], [2.6, 0], [1.2, 0], [1.8, -17.6]], mixc(P.n4, P.w3, 0.3), true, mixc(P.n3, P.v3, 0.5)]] });
  r.part([[-1.9, -38.0], [1.2, -39.2], [2.6, -36.4], [2.1, -33.6], [-1.6, -33.2], [-2.5, -35.6]], mixc(P.n4, P.w2, 0.4), { ar: mixc(P.n2, P.v2, 0.6) });
}
