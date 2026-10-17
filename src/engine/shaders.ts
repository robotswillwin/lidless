// GLSL for the 2D deferred pipeline. Ported from the style frame prototype.
//
// G-buffer (four RGBA8 targets, written by the sprite pass):
//   G0  rgb albedo for the current view      a  height (7 bits) and occluder flag (1 bit)
//   G1  rg  normal xy                        b  specular         a  shininess
//   G2  rgb glow / 2 for the current view    a  light group / 15
//   G3  r   depth layer / 3                  g  reflectivity / 2 (a character: its feet's height on screen / 540)
//       b   object id / 63                   a  1 where something was drawn (a character: its share of the air, below 0.5)
// Screen-space helpers use image coordinates (y down); P() and T() convert to GL's bottom-up targets.

export const MAX_LIGHTS = 32;

const HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes;
out vec4 o;
vec2 P() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); }
vec4 T(sampler2D t, vec2 p) { return texture(t, vec2(p.x, uRes.y - p.y) / uRes); }
float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
// G-buffer 3's alpha: 1 for the set; for a character, half its share of the glowing air in front of it (so below 0.5)
float isActor(float a) { return step(a, 0.75); }
float airOf(float a) { return a < 0.75 ? a * 2.0 : 1.0; }
// raw view: things are cold and lit a sterile white; only the poisonous air between them is yellow-green.
// A machine's own light (a monitor, an indicator, the kiosk's eye) keeps its colour.
const vec3 RAW_LIGHT = vec3(0.92, 0.98, 1.06);
const vec3 RAW_COLD = vec3(0.84, 0.95, 1.12);
const vec3 RAW_AIR = vec3(0.93, 0.93, 0.42);
// the colour tint at the brightness of c
vec3 tone(vec3 c, vec3 tint) { return lum(c) * tint / lum(tint); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
vec3 lin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
`;

/** World-space zone map: r = inside, g = outside, b = static ambient occlusion. */
const ZONE = `
uniform sampler2D tZone;
uniform vec2 uCam, uLevel;
vec4 Z(vec2 p) { return texture(tZone, (p + uCam) / uLevel); }
`;

/* ---------- sprite pass: one quad per sprite, alpha-tested, writes all four G-buffer targets ---------- */

export const SPRITE_VS = `#version 300 es
in vec2 aPos;
uniform vec4 uRect;     // x, y, w, h in screen pixels, top-left origin
uniform vec2 uScreen;
uniform float uFlip;     // 1 mirrors the sprite horizontally
uniform vec2 uUV;        // the frame: where it starts across the texture and how wide it is (0 and 1 for a single image)
out vec2 vUv;
void main() {
  vec2 p = uRect.xy + aPos * uRect.zw;
  vUv = vec2(uUV.x + (uFlip > 0.5 ? 1.0 - aPos.x : aPos.x) * uUV.y, aPos.y);
  gl_Position = vec4(p.x / uScreen.x * 2.0 - 1.0, 1.0 - p.y / uScreen.y * 2.0, 0.0, 1.0);
}`;

export const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D tAlbR, tAlbC, tNrm, tNrmC, tMat, tMatC, tMeta, tGlowR, tGlowC;
uniform float uView;       // 0 raw, 1 Concierge
uniform float uFlip;
uniform vec4 uConst;       // fallbacks when a sprite has no meta map: occluder, depth, reflectivity, object id
uniform float uHasMeta;
uniform float uHaze;       // a character: how much of the set's glowing air shows over it, 0 to 1; the set: -1
uniform float uFoot;       // a character: the height of its feet on screen, 0 at the top to 1 at the bottom
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;
void main() {
  vec4 aR = texture(tAlbR, vUv), aC = texture(tAlbC, vUv);
  vec4 a = uView > 0.5 ? aC : aR;
  if (a.a < 0.5) discard;
  vec3 meta = floor(texture(tMeta, vUv).rgb * 255.0 + 0.5);
  // the Concierge's additions are lit exactly like the real world: nothing in its view may look projected
  float occ = uConst.x, dep = uConst.y, refl = uConst.z, obj = uConst.w, grpR = 0.0, grpC = 0.0, mach = 0.0;
  if (uHasMeta > 0.5) {
    occ = step(127.5, meta.r); obj = mod(meta.r, 64.0);
    dep = floor(meta.g / 64.0); refl = floor(mod(meta.g, 64.0) / 16.0); mach = mod(meta.g, 2.0);
    grpR = floor(meta.b / 16.0); grpC = mod(meta.b, 16.0);
  }
  // each view has its own surface: the Concierge's walls are smooth where the real ones are cracked
  float cv = step(0.5, uView);
  vec3 n = mix(texture(tNrm, vUv).rgb, texture(tNrmC, vUv).rgb, cv) * 2.0 - 1.0;
  if (uFlip > 0.5) n.x = -n.x;
  vec3 m = mix(texture(tMat, vUv).rgb, texture(tMatC, vUv).rgb, cv);
  vec3 gR = texture(tGlowR, vUv).rgb, gC = texture(tGlowC, vUv).rgb;
  vec3 g = uView > 0.5 ? gC : gR;
  float grp = (uView > 0.5 && grpC > 0.5 && dot(abs(gC - gR), vec3(1.0)) > 0.004) ? grpC : grpR;
  o0 = vec4(a.rgb, (floor(m.b * 127.0 + 0.5) * 2.0 + occ) / 255.0);
  o1 = vec4(n.xy * 0.5 + 0.5, m.r, m.g);
  o2 = vec4(g, (grp + 16.0 * mach) / 31.0);
  // a character is never a reflecting surface, so its reflectivity slot carries where its feet are: wet ground mirrors it
  // around them, wherever it stands
  o3 = vec4(dep / 3.0, uHaze < 0.0 ? refl / 2.0 : uFoot, obj / 63.0, uHaze < 0.0 ? 1.0 : uHaze * 0.5);
}`;

/* ---------- ambient occlusion: occluders, downsampled, then blurred with the shared blur ---------- */

export const OCC_FS = HEAD + `
uniform sampler2D tG0; uniform vec2 uSrcRes;
float occ(vec2 q) { return mod(floor(texture(tG0, q).a * 255.0 + 0.5), 2.0); }
void main() {
  vec2 base = floor(gl_FragCoord.xy) * 2.0; float s = 0.0;
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) s += occ((base + vec2(float(i), float(j)) + 0.5) / uSrcRes);
  o = vec4(s * 0.25, 0.0, 0.0, 1.0);
}`;

/* ---------- lighting ---------- */

export const LIGHT_FS = HEAD + ZONE + `
uniform sampler2D tG0, tG1, tG2, tG3, tAO;
uniform vec4 uLP[${MAX_LIGHTS}], uLC[${MAX_LIGHTS}], uLK[${MAX_LIGHTS}], uLG[${MAX_LIGHTS}];
uniform int uNL;
uniform float uGI[16], uView, uTime, uShadows;
uniform vec4 uLookL;      // the look: lights, ambient, haze, glowing surfaces
uniform float uFill;      // the look: how much of a light behind a character reaches the side we see
uniform float uRim;       // the look: how strongly a light behind a character catches its edges
uniform float uGround;    // world y of the ground line
uniform float uRawColour; // the look: how much of a surface's own colour raw view keeps, 0 a cold grey to 1 all of it
uniform vec4 uSh[8];      // shadows on the ground under the characters: feet x, y on screen, half-width
uniform int uNSh;
uniform float uShadowK;   // the look: how dark the ground gets right under a character
uniform vec4 uCars[16]; uniform int uNC;
uniform vec4 uBeac[32]; uniform int uNB;
float facadeW(vec2 w) { return w.y < 104.0 ? 1.0 : w.y > 424.0 ? 0.7 : w.x > 524.0 ? 0.5 : 0.18; }
float occAt(vec2 p) { return mod(floor(T(tG0, p).a * 255.0 + 0.5), 2.0); }
float shadowMarch(vec2 p, vec2 lp, float self) {
  if (self > 0.5) return 1.0;
  vec2 d = lp - p; float L = length(d); if (L < 6.0) return 1.0;
  vec2 dir = d / L; float reach = min(L - 4.0, 54.0), s = 0.0;
  for (int k = 1; k <= 16; k++) { float t = reach * float(k) / 16.0; s += occAt(p + dir * t) * (1.0 - 0.55 * t / reach); }
  return clamp(1.0 - s * 0.16, 0.15, 1.0);
}
void main() {
  vec2 p = P(), w = p + uCam;
  vec4 g0 = T(tG0, p), g1 = T(tG1, p), g2 = T(tG2, p), g3 = T(tG3, p), z = Z(p);
  // a character in front of the set: air is how much of the glowing air lies between it and the eye (1 for the set).
  // It stands in the street even in front of a shop, so it takes the zone of the ground under it, not of the set behind.
  float actor = isActor(g3.a), air = airOf(g3.a);
  z = mix(z, Z(vec2(p.x, uGround - uCam.y)), actor);
  float hv = floor(g0.a * 255.0 + 0.5), occ = mod(hv, 2.0), hz = floor(hv / 2.0) / 127.0 * 22.0;
  vec2 nxy = g1.xy * 2.0 - 1.0; vec3 Nn = vec3(nxy, sqrt(max(0.0, 1.0 - dot(nxy, nxy))));
  float specS = g1.z, shin = mix(6.0, 120.0, g1.w), dep = g3.r, obj = floor(g3.b * 63.0 + 0.5);
  float raw = 1.0 - uView;
  // raw view: every surface goes cold and muted; the strongest colour left lives in the air
  vec3 alb = lin(g0.rgb);
  alb = mix(alb, tone(alb, RAW_COLD), raw * (1.0 - uRawColour));
  float occB = T(tAO, p).r, ao = (occ > 0.5 ? 1.0 - 0.25 * occB : 1.0 - 0.8 * occB) * z.b;
  vec3 ambIn = vec3(0.1, 0.066, 0.046), ambOut = vec3(0.045, 0.055, 0.1);
  vec3 amb = (mix(ambIn, tone(ambIn, RAW_LIGHT), raw) * z.r + mix(ambOut, tone(ambOut, RAW_COLD), raw) * z.g) * uLookL.y;
  vec3 col = alb * amb * mix(0.4, 1.0, ao) * (0.85 - 0.3 * Nn.y), spc = vec3(0.0), haze = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    vec4 LP = uLP[i], LC = uLC[i], LK = uLK[i], LG = uLG[i];
    // flags: 1 only in Concierge view, 2 a machine's own light, 4 and 8 its layer: 0 behind the characters, 1 among them, 2 in front
    float arL = mod(LG.y, 2.0), machL = mod(floor(LG.y * 0.5 + 0.01), 2.0), layer = floor(LG.y * 0.25 + 0.01);
    float gi = uGI[int(LG.x + 0.5)] * (arL > 0.5 ? uView : 1.0);
    if (gi < 0.002) continue;
    float zh = LC.w < 0.5 ? 1.0 : LC.w < 1.5 ? z.r : LC.w < 2.5 ? z.g : LC.w < 3.5 ? facadeW(w) : z.g;
    float zw = zh * (LC.w > 1.5 && LC.w < 2.5 ? mix(0.08, 1.0, step(0.9, dep)) : 1.0);
    if (zh < 0.002) continue;
    vec2 lp = LP.xy - uCam, d2 = lp - p; float dist = length(d2); if (dist > LP.w) continue;
    float att = 1.0 - dist / LP.w; att *= att;
    float cone = 1.0;
    if (LK.z > -1.5) { float c = dot(normalize(-d2 + 1e-4), LK.xy); cone = smoothstep(LK.z, LK.z + 0.18, c); }
    if (cone < 0.002) continue;
    float ex = floor(LK.w * 0.5 + 0.01), keep = (ex > 0.5 && abs(obj - ex) < 0.5) ? 0.0 : 1.0;
    float sh = (uShadows > 0.5 && mod(LK.w, 2.0) > 0.5) ? shadowMarch(p, lp, occ) : 1.0;
    vec3 lc = arL + machL > 0.5 ? LC.rgb : mix(LC.rgb, tone(LC.rgb, RAW_LIGHT), raw);
    // a light behind a character shines at it from behind: it catches the edges as a rim, and a little of it, bounced
    // off the room around, reaches the side we see as a soft fill, the same everywhere nearby: no hot spot
    float back = layer < 0.5 ? actor : 0.0;
    vec3 Lf = normalize(vec3(d2, LP.z - hz)), Lb = normalize(vec3(d2, -0.6 * abs(LP.z - hz) - 4.0));
    vec3 Lv = back > 0.5 ? Lb : Lf;
    float diff = max((dot(Nn, Lv) + LG.z) / (1.0 + LG.z), 0.0);
    vec3 li = lc * gi * att * cone * sh * zw * keep * uLookL.x * (back > 0.5 ? uRim : 1.0);
    col += alb * li * diff;
    if (back > 0.0) col += alb * lc * gi * min(att, 0.3) * cone * zw * keep * uLookL.x * back * uFill * (0.6 + 0.4 * max(dot(Nn, Lf), 0.0));
    vec3 H = normalize(Lv + vec3(0.0, 0.0, 1.0));
    spc += li * specS * pow(max(dot(Nn, H), 0.0), shin) * 2.0;
    // its glow in the air: hidden behind a character when the light is behind it, mostly hidden among them
    float seen = layer < 0.5 ? air : layer < 1.5 ? mix(air, 1.0, 0.25) : 1.0;
    haze += mix(lc, tone(lc, RAW_AIR), raw) * gi * pow(att, LK.z > -1.5 ? 2.0 : 3.0) * cone * LG.w * zh * seen;
  }
  // the ground under a character's feet gets less of every light, and of the ambient: it stands on it. Not the character
  // itself, and not anything glowing
  float ground = 1.0;
  if (actor < 0.5) for (int s = 0; s < 8; s++) {
    if (s >= uNSh) break;
    vec4 sh = uSh[s]; vec2 r = (p - sh.xy) / vec2(sh.z, max(4.0, sh.z * 0.16));
    ground *= 1.0 - uShadowK * (1.0 - smoothstep(0.1, 1.0, dot(r, r)));
  }
  // the glowing air around lights: a person in front of it gets only the part between them and the eye (g3.a)
  vec3 outc = (col + spc) * ground + haze * mix(0.06, 0.16, z.g) * uLookL.z;
  float ge = floor(g2.a * 31.0 + 0.5), machE = step(15.5, ge);
  vec3 em = lin(g2.rgb * 2.0);
  outc += mix(em, tone(em, RAW_LIGHT), raw * (1.0 - machE)) * uGI[int(mod(ge, 16.0))] * uLookL.w;
  if (dep < 0.4 && uView > 0.5) {
    for (int k = 0; k < 16; k++) { if (k >= uNC) break; vec4 c = uCars[k]; vec2 r = p - (c.xy - uCam); float al = r.x * c.z;
      if (abs(r.y) < 1.2) { if (al > -c.w && al < 0.0) outc += vec3(2.2, 0.25, 0.2) * pow(1.0 + al / c.w, 2.0) * 0.6; if (al >= 0.0 && al < 4.0) outc += al < 2.0 ? vec3(4.0, 4.2, 4.6) : vec3(0.08, 0.08, 0.1); } }
  }
  vec3 bc = mix(vec3(5.0, 0.6, 0.5), tone(vec3(5.0, 0.6, 0.5), RAW_LIGHT), raw), bh = mix(vec3(0.6, 0.05, 0.05), tone(vec3(0.6, 0.05, 0.05), RAW_AIR), raw);
  for (int k = 0; k < 32; k++) { if (k >= uNB) break; vec4 b = uBeac[k]; if (sin(uTime * 2.4 + b.z) > 0.4) { float d = length(p - (b.xy - uCam)); outc += bc * smoothstep(2.0, 0.5, d) + bh * smoothstep(14.0, 0.0, d) * 0.4; } }
  o = vec4(outc, 1.0);
}`;

/* ---------- composite: depth of field, wet reflections, steam and smoke, rain, drips ---------- */

export const COMP_FS = HEAD + ZONE + `
uniform sampler2D tA, tG3, tDof;
uniform float uTime, uDof, uView, uRawFog;
uniform float uWrap;      // the look: how much a character's outline softens into the light around it, and takes it on
uniform vec4 uSteam[4];
uniform vec4 uDrips;      // world x0, x1, top, bottom of the drip curtain; z <= 0 turns it off
uniform float uMirror;    // world y of the reflection line
float rainL(vec2 p, float t, float sc, float sp, float ln, float dens) {
  vec2 q = p / sc; q.x += q.y * 0.28; q.y -= t * sp;
  vec2 cell = vec2(floor(q.x), floor(q.y / ln)); float rnd = hash(cell);
  float x = fract(q.x) - (0.2 + 0.6 * hash(cell + 7.1)), y = fract(q.y / ln);
  return smoothstep(0.1, 0.0, abs(x)) * smoothstep(0.0, 0.3, y) * smoothstep(1.0, 0.55, y) * step(1.0 - dens, rnd);
}
void main() {
  vec2 p = P(), w = p + uCam;
  vec3 c = T(tA, p).rgb;
  vec4 g3 = T(tG3, p), z = Z(p);
  float dep = g3.r, refl = isActor(g3.a) > 0.5 ? 0.0 : g3.g, GY = uMirror - uCam.y;
  // a character takes the zone of the ground it stands on: rain falls in front of it out in the street
  z = mix(z, Z(vec2(p.x, GY)), isActor(g3.a));
  float dk = uDof * (dep < 0.15 ? 0.4 : dep < 0.5 ? 0.85 : dep < 0.8 ? 0.45 : 0.0);
  if (dk > 0.0) { vec4 b = texture(tDof, gl_FragCoord.xy / uRes); if (b.a > 0.02) c = mix(c, b.rgb / b.a, dk * smoothstep(0.02, 0.3, b.a)); }
  float raw = 1.0 - uView;
  // a character sits in the picture, not on it: its outline softens into what is behind it, and the light around it wraps
  // a little over its edges. Samples at 3 and 6 pixels that land on the set say how near the edge this pixel is
  if (uWrap > 0.0 && isActor(g3.a) > 0.5) {
    vec3 env = vec3(0.0); float n = 0.0;
    for (int k = 0; k < 8; k++) {
      vec2 dir = vec2(cos(float(k) * 0.7854), sin(float(k) * 0.7854));
      for (int j = 1; j <= 2; j++) { vec2 q = p + dir * float(j) * 3.0; if (isActor(T(tG3, q).a) < 0.5) { env += T(tA, q).rgb; n += 1.0; } }
    }
    if (n > 0.0) { env /= n; float edge = n / 16.0; c = mix(c, env, min(0.6, edge * 0.5 * uWrap)) + env * edge * 0.5 * uWrap; }
  }
  if (refl > 0.02) {
    float puddle = step(0.7, refl);
    // rain stirs the puddles in the real world; the Concierge's streets are wet glass
    float rip = (sin(p.y * 0.85 + uTime * 5.0 + w.x * 0.04) * mix(0.5, 1.6, puddle) + (vn(w * 0.08 + uTime) - 0.5) * 2.0 * puddle) * mix(0.25, 1.0, raw);
    // the set is mirrored around its ground line, and a character around its own feet: look up this column for the nearest
    // character above this bit of ground. If the set's mirror lands on a character standing elsewhere, take the set beside it
    vec2 qs = vec2(p.x + rip, 2.0 * GY - p.y), q = qs;
    float F = -1.0;
    for (int k = 1; k <= 32; k++) { vec4 ga = T(tG3, vec2(p.x, p.y - float(k) * 3.0)); if (isActor(ga.a) > 0.5) { F = ga.g * uRes.y; break; } }
    bool mine = false;
    if (F > 0.0 && p.y > F) { vec2 qa = vec2(p.x + rip, 2.0 * F - p.y); if (isActor(T(tG3, qa).a) > 0.5) { q = qa; mine = true; } }
    float keep = 1.0;
    if (!mine && isActor(T(tG3, qs).a) > 0.5) {
      keep = 0.0;
      for (int j = 1; j <= 4; j++) for (int s = -1; s <= 1; s += 2) { vec2 b = qs + vec2(float(s * j) * 14.0, 0.0); if (keep < 0.5 && isActor(T(tG3, b).a) < 0.5) { q = b; keep = 1.0; } }
    }
    vec3 r = (T(tA, q).rgb * 2.0 + T(tA, q + vec2(0.0, 2.0)).rgb + T(tA, q - vec2(0.0, 2.0)).rgb + (T(tA, q + vec2(0.0, 5.0)).rgb + T(tA, q - vec2(0.0, 5.0)).rgb) * 0.6 + T(tA, q - vec2(0.0, 9.0)).rgb * 0.4) / 5.6;
    float k = mix(0.42, 0.88, puddle) * (0.75 + 0.25 * smoothstep(GY, uRes.y, p.y)) * keep;
    c = c * (1.0 - k * 0.5) + r * k;
  }
  // raw view: the poisonous air between the eye and everything it sees, thicker with distance and outdoors
  if (raw > 0.0) {
    float fd = dep < 0.15 ? 0.55 : dep < 0.5 ? 0.38 : dep < 0.8 ? 0.22 : 0.08;
    c = mix(c, tone(vec3(0.045), RAW_AIR), min(1.0, raw * fd * mix(0.35, 1.0, z.g * (1.0 - z.r)) * uRawFog));
  }
  vec3 near = (T(tA, p + vec2(6.0, 0.0)).rgb + T(tA, p - vec2(6.0, 0.0)).rgb + T(tA, p + vec2(0.0, 6.0)).rgb + T(tA, p - vec2(0.0, 6.0)).rgb) * 0.25;
  for (int s = 0; s < 4; s++) {
    vec4 e = uSteam[s]; if (e.z <= 0.0) continue; vec2 r = p - (e.xy - uCam); float up = -r.y; if (up < -4.0 || up > e.z) continue;
    float smoke = step(e.w, 0.0), k = up / e.z, sway = sin(k * 5.0 + uTime * 0.8) * 8.0 * k, wdt = abs(e.w) * (0.35 + k * (1.0 + 2.0 * smoke));
    float n = fbm(vec2((r.x - sway) * 0.05, (r.y + uTime * 26.0) * 0.045));
    float d = smoothstep(wdt, wdt * 0.2, abs(r.x - sway)) * smoothstep(0.75, 0.25, k * n) * n * (1.0 - k);
    vec3 vapour = mix(vec3(0.025, 0.025, 0.03), vec3(0.16, 0.16, 0.18), smoke);
    c += (mix(near, tone(near, RAW_AIR), raw * 0.6) * 1.4 + mix(vapour, tone(vapour, RAW_AIR) * 1.2, raw)) * d * mix(0.9, 1.3, smoke);
  }
  // rain falls only in the real world: the Concierge keeps its streets dry
  float outside = z.g * (1.0 - z.r) * raw;
  if (outside > 0.05) {
    float rn = rainL(p, uTime, 2.0, 55.0, 6.0, 0.33) * 0.55 + rainL(p + 37.0, uTime, 4.0, 95.0, 5.0, 0.22);
    vec3 tint = normalize(near + 1e-4) * 0.9;
    c += rn * outside * (tone(vec3(0.012, 0.014, 0.02), RAW_AIR) + tint * lum(near) * 2.6);
    if (p.y > GY + 2.0) { vec2 cell = floor(w / vec2(18.0, 6.0)); float ph = fract(uTime * (0.7 + hash(cell)) + hash(cell + 3.0)); float rr = length((w - (cell + 0.5) * vec2(18.0, 6.0)) * vec2(1.0, 3.0)); c += vec3(0.18, 0.2, 0.24) * smoothstep(1.4, 0.0, abs(rr - ph * 9.0)) * (1.0 - ph) * step(0.55, hash(cell + 9.0)) * (0.4 + lum(near)); }
  }
  if (uDrips.z > 0.0 && raw > 0.5 && w.y < uDrips.w && w.x > uDrips.x && w.x < uDrips.y && z.r > 0.5) {
    float dx = mod(w.x, 37.0), id = floor(w.x / 37.0), ph = fract(uTime * (0.45 + hash(vec2(id, 1.0)) * 0.5) + hash(vec2(id, 2.0)));
    float yy = uDrips.z + ph * ph * (uDrips.w - uDrips.z);
    if (abs(dx - 18.0) < 0.8 && abs(w.y - yy) < 2.5) c += vec3(0.5, 0.42, 0.35) * (0.4 + lum(near) * 2.0);
  }
  o = vec4(c, 1.0);
}`;

/* ---------- bloom, blur, depth of field, streaks ---------- */

export const BRIGHT_FS = HEAD + `
uniform sampler2D tSrc; uniform vec2 uSrcRes;
vec3 br(vec2 uv) { vec3 c = texture(tSrc, uv).rgb; return c * smoothstep(0.75, 1.6, lum(c)); }
void main() { vec2 uv = gl_FragCoord.xy / uRes, px = 1.0 / uSrcRes; o = vec4((br(uv + px * vec2(-1.0, -1.0)) + br(uv + px * vec2(1.0, -1.0)) + br(uv + px * vec2(-1.0, 1.0)) + br(uv + px * vec2(1.0, 1.0))) * 0.25, 1.0); }`;

export const BLUR_FS = HEAD + `
uniform sampler2D tSrc; uniform vec2 uDir;
void main() { vec2 uv = gl_FragCoord.xy / uRes; vec4 s = vec4(0.0); float w[5] = float[](0.227, 0.194, 0.121, 0.054, 0.016);
  s += texture(tSrc, uv) * w[0]; for (int i = 1; i < 5; i++) { vec2 off = uDir * float(i) * 1.6 / uRes; s += (texture(tSrc, uv + off) + texture(tSrc, uv - off)) * w[i]; } o = s; }`;

/** Background-only half-res copy for depth of field: foreground pixels get zero weight so they don't bleed into the blur. */
export const DOFDOWN_FS = HEAD + `
uniform sampler2D tSrc, tG3; uniform vec2 uSrcRes;
void main() { vec2 base = floor(gl_FragCoord.xy) * 2.0; vec4 acc = vec4(0.0);
  for (int j = 0; j < 2; j++) for (int i = 0; i < 2; i++) { vec2 q = (base + vec2(float(i), float(j)) + 0.5) / uSrcRes; float w = texture(tG3, q).r < 0.9 ? 1.0 : 0.0; acc += vec4(texture(tSrc, q).rgb * w, w); }
  o = acc * 0.25; }`;

/** Anamorphic streaks: a long horizontal blur of the brightest light. */
export const STREAK_FS = HEAD + `
uniform sampler2D tSrc; uniform float uStep, uThr;
void main() { vec2 uv = gl_FragCoord.xy / uRes; vec3 s = vec3(0.0); float tw = 0.0;
  for (int i = -6; i <= 6; i++) { float w = exp(-float(i * i) / 18.0); s += max(texture(tSrc, uv + vec2(float(i) * uStep / uRes.x, 0.0)).rgb - uThr, 0.0) * w; tw += w; }
  o = vec4(s / tw, 1.0); }`;

/* ---------- final: sharp upscale, bloom and light shafts, film grade ---------- */

export const FINAL_FS = HEAD + ZONE + `
uniform sampler2D tB, tBloom1, tBloom2, tStreak, tG3;
uniform float uTime, uGlitch, uView, uStreaks;
uniform vec4 uGR[4];
uniform vec2 uOut;
// the look: pixel size, pixel shape, shape strength, colour levels | bloom, shafts, streaks, dither |
// exposure, contrast, saturation, temperature | tint, vignette, grain, colour fringes
uniform vec4 uLookP, uLookB, uLookC, uLookF;
// each source pixel stays a crisp block at any size, with one anti-aliased device pixel at its edges
vec3 sharpT(vec2 p) { float s = max(1.0, uOut.x / uRes.x); vec2 q = floor(p) + 0.5 + clamp((fract(p) - 0.5) * s, -0.5, 0.5); return T(tB, q).rgb; }
// a bigger pixel: the average of its block, from four filtered taps
vec3 blockT(vec2 centre, float ps) { float o = ps * 0.25; return (T(tB, centre + vec2(-o, -o)).rgb + T(tB, centre + vec2(o, -o)).rgb + T(tB, centre + vec2(-o, o)).rgb + T(tB, centre + vec2(o, o)).rgb) * 0.25; }
vec3 pixelT(vec2 p, float ps) { return ps > 1.0 ? blockT((floor(p / ps) + 0.5) * ps, ps) : sharpT(p); }
// the shape of one pixel, from where this screen pixel sits inside it (0 to 1 each way)
float shapeMask(vec2 local, float shape, float soft) {
  vec2 d = abs(local - 0.5);
  if (shape < 0.5) return 1.0;
  if (shape < 1.5) return 1.0 - smoothstep(0.2 - soft, 0.2 + soft, length(max(d - 0.3, 0.0)));
  if (shape < 2.5) return 1.0 - smoothstep(0.42 - soft, 0.42 + soft, length(d));
  if (shape < 3.5) return 1.0 - smoothstep(0.44 - soft, 0.5, max(d.x, d.y));
  return 1.0 - smoothstep(0.3 - soft, 0.5, d.y);
}
float bayer4(vec2 b) { vec2 m = mod(b, 4.0); int i = int(m.x) + int(m.y) * 4;
  float t[16] = float[](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0); return (t[i] + 0.5) / 16.0; }
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
void main() {
  vec2 p = vec2(gl_FragCoord.x, uOut.y - gl_FragCoord.y) * (uRes / uOut);
  float raw = 1.0 - uView;
  // back to Concierge view: its frames resync, a digital glitch
  if (uGlitch > 0.0 && uView > 0.5) { float row = floor(p.y / 3.0); if (hash(vec2(row, floor(uTime * 30.0))) < 0.25 * uGlitch) p.x += (hash(vec2(row, 7.0)) - 0.5) * 50.0 * uGlitch; }
  // into raw view: the biohack shuts the augmented eye's nerve, and the healthy eye's own signal swims in, doubled at first
  float nerve = uView > 0.5 ? 0.0 : smoothstep(0.0, 1.0, uGlitch);
  vec2 ctr = p - uRes * 0.5; float r2 = dot(ctr, ctr) / dot(uRes * 0.5, uRes * 0.5);
  vec2 ca = ctr / length(uRes * 0.5) * 1.2 * r2 * uLookF.w;
  float ps = max(1.0, floor(uLookP.x + 0.5));
  vec3 c = vec3(pixelT(p + ca, ps).r, pixelT(p, ps).g, pixelT(p - ca, ps).b);
  if (nerve > 0.0) c = mix(c, pixelT(p + vec2(12.0, -2.0) * nerve, ps), 0.45 * nerve);
  vec2 uv = vec2(p.x, uRes.y - p.y) / uRes;
  vec3 b1 = texture(tBloom1, uv).rgb, b2 = texture(tBloom2, uv).rgb;
  // a character in front of the set hides the light behind it: the shafts and the wide halo are light caught in the air
  // behind them, and the lens glow only wraps a little over their edges (air: 1 for the set, small for a character)
  float air = airOf(T(tG3, ps > 1.0 ? (floor(p / ps) + 0.5) * ps : p).a), lens = mix(1.0, air, 0.9);
  vec3 bl = (b1 * lens * 0.55 + mix(b2, tone(b2, RAW_AIR), raw * 0.7) * air * 0.45) * uLookB.x;
  vec4 z = Z(p); float jit = hash(floor(p) * 0.37);
  for (int s = 0; s < 4; s++) {
    vec4 g = uGR[s]; if (g.z <= 0.0) continue;
    float zw = g.w < 1.5 ? z.r : z.g; if (zw < 0.05) continue;
    vec2 dv = (g.xy - uCam - p) / 24.0, q = p + dv * jit; float dec = 1.0; vec3 acc = vec3(0.0);
    for (int k = 0; k < 24; k++) { q += dv; acc += texture(tBloom1, vec2(q.x, uRes.y - q.y) / uRes).rgb * dec; dec *= 0.92; }
    bl += mix(acc, tone(acc, RAW_AIR), raw) * g.z * zw / 24.0 * uLookB.y * air;
  }
  c += bl + (texture(tStreak, uv).rgb * vec3(0.5, 0.68, 1.0) * 0.5 * uStreaks * uLookB.z + b1 * mix(vec3(0.22, 0.06, 0.02), tone(vec3(0.22, 0.06, 0.02), RAW_AIR), raw) * uLookB.x) * lens;
  c = aces(c * 1.32 * exp2(uLookC.x));
  float l = lum(c);
  // Concierge view: cool shadows, warm highlights. Raw view: a neutral grade, its cold things and yellow-green air are already in the image
  c = mix(c, c * mix(vec3(0.84, 0.95, 1.12), vec3(1.0), raw) + vec3(0.0, 0.005, 0.012) * uView, (1.0 - smoothstep(0.0, 0.45, l)) * 0.7);
  c = mix(c, c * mix(vec3(1.07, 1.0, 0.9), vec3(0.97, 1.0, 1.04), raw), smoothstep(0.45, 1.0, l) * 0.4);
  l = lum(c);
  c = mix(vec3(l), c, mix(mix(0.72, 0.95, raw), 1.05, smoothstep(0.45, 0.95, l)));
  c *= max(0.0, 1.0 - 0.36 * pow(r2, 1.3) * uLookF.y);
  if (nerve > 0.0) c = mix(c, vec3(lum(c)), 0.5 * nerve) * (1.0 - nerve * (0.55 + 0.4 * smoothstep(0.1, 0.9, r2)));
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.15);
  // colour: contrast, saturation, temperature and tint, in display space
  c = (c - 0.5) * uLookC.y + 0.5;
  c = mix(vec3(lum(c)), c, uLookC.z);
  c *= vec3(1.0 + 0.12 * uLookC.w - 0.04 * uLookF.x, 1.0 + 0.08 * uLookF.x, 1.0 - 0.12 * uLookC.w - 0.04 * uLookF.x);
  // fewer colours, with an ordered dither laid on the art pixels
  if (uLookP.w > 1.5) { float L = uLookP.w - 1.0; c = floor(clamp(c, 0.0, 1.0) * L + 0.5 + (bayer4(floor(p / ps)) - 0.5) * uLookB.w) / L; }
  // the shape of each pixel, soft over about one screen pixel
  float cellPx = ps * uOut.x / uRes.x;
  if (uLookP.z > 0.0 && cellPx >= 2.0) c *= mix(1.0, shapeMask(fract(p / ps), uLookP.y, 0.5 / cellPx), uLookP.z);
  c += (hash(p + fract(uTime) * 91.0) - 0.5) * mix(0.05, 0.018, sqrt(l)) * uLookF.z;
  o = vec4(c, 1.0);
}`;
