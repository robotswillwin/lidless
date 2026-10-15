
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
function drawDocked() {
  // someone sitting against the machine with a wrist in its cradle. Concierge view dresses them for dinner; the raw view does not
  const d = painter(378, 232);
  const RAG = mixc(P.n5, P.w3, 0.25), RAG_S = mixc(P.n3, P.w2, 0.3), GRY = mixc(P.sk2, P.n6, 0.6), GRY_S = mixc(P.sk2, P.n4, 0.6);
  const DRS = mixc(P.r3, P.r4, 0.5), DRS_L = mixc(P.r5, P.r6, 0.4), SILK = mixc(P.w7, P.w9, 0.4), SK = mixc(P.sk, P.w8, 0.12), SK_S = mixc(P.sk2, P.r2, 0.25);
  d.part([[5.4, -4.2], [10.2, -13.6], [12.4, -12.6], [14.4, -1.6], [15.8, 0], [12.0, 0], [11.4, -9.4], [7.4, -2.0]], RAG_S, { ar: DRS });
  const leg = d.part([[-2.2, -5.4], [9.2, -14.6], [11.4, -12.8], [13.0, -1.6], [14.6, 0], [10.4, 0], [9.6, -9.2], [-0.4, -1.0], [-3.6, -1.0]], RAG, { ar: DRS, layers: [[[[6.0, -12.4], [9.2, -14.6], [11.4, -12.8], [8.4, -11.0]], mixc(RAG, P.n6, 0.3), true, DRS_L]] });
  const torso = d.part([[-4.6, -1.2], [-5.2, -10], [-4.2, -18], [-1.6, -24.4], [2.4, -24.2], [3.6, -20], [2.4, -12], [2.6, -4], [-1.0, -0.8]], RAG, { ar: DRS, layers: [[[[-1.6, -24.4], [2.4, -24.2], [3.6, -20], [1.4, -19.4], [0.4, -23.0]], mixc(RAG, P.n6, 0.3), true, DRS_L], [[[-4.6, -1.2], [-5.2, -10], [-4.2, -18], [-3.0, -18], [-3.6, -10], [-3.0, -1.2]], RAG_S, true, mixc(DRS, P.n0, 0.4)]] });
  d.part([[0.6, -23.4], [3.6, -24.2], [9.6, -24.0], [16.6, -27.6], [19.6, -27.8], [19.8, -25.6], [16.4, -25.0], [9.4, -21.4], [3.2, -20.4]], GRY, { ar: SK, layers: [[[[3.2, -20.4], [9.4, -21.4], [16.4, -25.0], [19.8, -25.6], [19.6, -24.6], [16.0, -23.8], [9.0, -20.0], [3.6, -19.4]], GRY_S, true, SK_S]] });
  d.part([[1.0, -24.6], [3.8, -25.0], [4.4, -21.0], [1.4, -20.4]], RAG_S, { ar: SILK });
  const head = d.part([[0.2, -27.6], [1.6, -31.2], [4.6, -32.0], [7.0, -30.4], [7.6, -27.4], [6.6, -24.6], [4.0, -23.6], [1.4, -24.4]], GRY, { ar: SK, layers: [[[[4.6, -27.0], [7.6, -27.4], [6.6, -24.6], [4.0, -23.6], [3.6, -25.4]], GRY_S, true, SK_S]] });
  d.part([[0.0, -27.4], [1.2, -31.6], [4.4, -32.8], [6.8, -31.6], [5.4, -30.6], [3.0, -30.8], [1.6, -28.6], [1.2, -25.6]], mixc(P.n3, P.n5, 0.4), { ar: mixc(P.n0, P.w2, 0.4) });
  d.edge(torso, 0.5, 0, { eh: mulc(P.c7, 0.08) }); d.edge(head, -0.4, 0.3, { eh: mulc(P.c8, 0.12) }); d.edge(leg, -0.4, 0.3, { eh: mulc(P.c8, 0.08) });
  d.edge(torso, -0.4, 0, { ea: mulc(P.m5, 0.4), eag: 6 }); d.edge(head, 0.4, 0, { ea: mulc(P.c9, 0.4), eag: 6 });
}
