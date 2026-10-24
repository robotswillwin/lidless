// GLSL for the 2D deferred pipeline. Ported from the style frame prototype.
//
// G-buffer (four RGBA8 targets, written by the sprite pass):
//   G0  rgb albedo for the current view      a  height (7 bits) and occluder flag (1 bit)
//   G1  rg  normal xy                        b  specular         a  shininess
//   G2  rgb glow / 2 for the current view    a  light group / 15
//   G3  r   depth layer / 3                  g  reflectivity / 2 (a character: its feet's height on screen / 540)
//       b   object id / 63                   a  1 where something was drawn (a character: its share of the air, below 0.5)
// Screen-space helpers use image coordinates (y down); P() and T() convert to GL's bottom-up targets. A full-size pass
// works in level pixels (960 by 540) whatever the render scale: uRes is the level's size and uRS image pixels per level
// pixel, so P() can fall between whole pixels, and every distance in pixels below is a level distance.

export const MAX_LIGHTS = 32;

const HEAD = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uRS;
out vec4 o;
vec2 P() { return vec2(gl_FragCoord.x, uRes.y * uRS - gl_FragCoord.y) / uRS; }
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
// the Concierge's air in fog: violet, as its city glows
const vec3 CO_AIR = vec3(0.78, 0.6, 1.0);
// the colour tint at the brightness of c
vec3 tone(vec3 c, vec3 tint) { return lum(c) * tint / lum(tint); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
vec3 lin(vec3 c) { return pow(max(c, 0.0), vec3(2.2)); }
// the eye's focal length in level pixels (about 50 degrees across the screen), for the ground the engine draws
const float FOCAL = 1000.0;
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
uniform vec4 uUV;        // the frame: where it starts across the texture and how wide it is, where it starts down it and how tall
uniform vec2 uPad;       // drawn this much bigger each way, as a part of its size: room for a character's parts to move into
out vec2 vUv;
void main() {
  vec2 a = aPos * (1.0 + 2.0 * uPad) - uPad, p = uRect.xy + a * uRect.zw;
  vUv = vec2(uUV.x + (uFlip > 0.5 ? 1.0 - a.x : a.x) * uUV.y, uUV.z + a.y * uUV.w);
  gl_Position = vec4(p.x / uScreen.x * 2.0 - 1.0, 1.0 - p.y / uScreen.y * 2.0, 0.0, 1.0);
}`;

export const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D tAlbR, tAlbC, tNrm, tNrmC, tMat, tMatC, tMeta, tGlowR, tGlowC;
uniform float uView;       // 0 raw, 1 Concierge
uniform float uFlip;
uniform vec4 uConst;       // fallbacks when a sprite has no meta map: occluder, depth, reflectivity, object id
uniform vec3 uConstG;      // and for its glow: its group in raw view, in the Concierge's, 1 for a machine's own light
uniform float uHasMeta;
uniform float uHaze;       // a character: how much of the set's glowing air shows over it, 0 to 1; the set: -1
uniform float uFoot;       // a character: the height of its feet on screen, 0 at the top to 1 at the bottom
uniform float uSS;         // samples across each axis of a screen pixel: a sprite drawn smaller than it was made
uniform float uBlend;      // 1: a flat layer over the set behind it, its edges blended by how much of each pixel it covers
uniform float uOpacity;    // how much of it shows, 0 to 1: a blended layer fading
uniform vec4 uUV;          // the frame's place in the texture, to keep the samples inside it
uniform vec4 uBend[12];    // a character's parts moving where it stands (alive.ts): two each, see alive()
uniform float uNBend;      // how many
uniform vec2 uSize;        // the frame's size in its own pixels
layout(location = 0) out vec4 o0;
layout(location = 1) out vec4 o1;
layout(location = 2) out vec4 o2;
layout(location = 3) out vec4 o3;
// where the pixel's colour comes from in the texture: its own place, or where its part was drawn if it has moved
vec2 U;
// a character standing alive: each of its parts turned about its joint and raised (the first vec4: the joint, the turn
// in radians, the rise in pixels), the part being what lies within a radius of a point (the second: the point, the
// radius, or under 0 everything above the joint, and how softly it fades). Each part carries those after it, so they are
// taken back in their order: from where a pixel is drawn to where it was in the picture. False where that is outside
// its frame: nothing is drawn there
bool alive(vec2 uv) {
  U = uv;
  if (uNBend < 0.5) return true;
  vec2 q = (uv - uUV.xz) / uUV.yw * uSize;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uNBend) break;
    vec4 A = uBend[2 * i], B = uBend[2 * i + 1];
    float w = B.z > 0.0 ? 1.0 - smoothstep(B.z, B.z + B.w, length(q - B.xy)) : 1.0 - smoothstep(A.y, A.y + B.w, q.y);
    if (w <= 0.0) continue;
    vec2 r = q + vec2(0.0, A.w * w) - A.xy;
    float c = cos(A.z * w), s = sin(A.z * w);
    q = A.xy + vec2(c * r.x + s * r.y, c * r.y - s * r.x);
  }
  if (q.x < 0.0 || q.y < 0.0 || q.x > uSize.x || q.y > uSize.y) return false;
  // kept half a texel inside its frame
  vec2 hx = 0.5 / vec2(textureSize(tAlbR, 0));
  U = clamp(uUV.xz + q / uSize * uUV.yw, uUV.xz + hx, uUV.xz + uUV.yw - hx);
  return true;
}
// a sprite drawn smaller than it was made covers several texels per pixel: average them, weighted by coverage, so it
// shrinks smoothly instead of sparkling
vec2 ssStep() { return vec2(dFdx(vUv.x), dFdy(vUv.y)) / uSS; }
vec2 ssAt(int i, int j) {
  vec2 uv = U + (vec2(float(i), float(j)) - 0.5 * (uSS - 1.0)) * ssStep();
  float tw = 0.5 / float(textureSize(tAlbR, 0).x);
  float th = 0.5 / float(textureSize(tAlbR, 0).y);
  uv.x = clamp(uv.x, uUV.x + tw, uUV.x + uUV.y - tw);
  uv.y = clamp(uv.y, uUV.z + th, uUV.z + uUV.w - th);
  return uv;
}
vec4 ssColour(sampler2D t) {
  if (uSS < 1.5) return texture(t, U);
  vec4 s = vec4(0.0); int n = int(uSS + 0.5);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) { if (i >= n || j >= n) continue; vec4 c = texture(t, ssAt(i, j)); s += vec4(c.rgb * c.a, c.a); }
  return s.a > 0.0 ? vec4(s.rgb / s.a, s.a / float(n * n)) : vec4(0.0);
}
vec3 ssPlain(sampler2D t) {
  if (uSS < 1.5) return texture(t, U).rgb;
  vec3 s = vec3(0.0); int n = int(uSS + 0.5);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) { if (i >= n || j >= n) continue; s += texture(t, ssAt(i, j)).rgb; }
  return s / float(n * n);
}
void main() {
  if (!alive(vUv)) discard;
  vec4 aR = ssColour(tAlbR), aC = ssColour(tAlbC);
  vec4 a = uView > 0.5 ? aC : aR;
  a.a *= uOpacity;
  // a cut-out's edge is either drawn or not; a blended one covers its edge pixels in part, so it moves smoothly
  if (a.a < (uBlend > 0.5 ? 0.004 : 0.5)) discard;
  vec3 meta = floor(texture(tMeta, U).rgb * 255.0 + 0.5);
  // the Concierge's additions are lit exactly like the real world: nothing in its view may look projected
  float occ = uConst.x, dep = uConst.y, refl = uConst.z, obj = uConst.w, grpR = uConstG.x, grpC = uConstG.y, mach = uConstG.z;
  if (uHasMeta > 0.5) {
    occ = step(127.5, meta.r); obj = mod(meta.r, 64.0);
    dep = floor(meta.g / 64.0); refl = floor(mod(meta.g, 64.0) / 16.0); mach = mod(meta.g, 2.0);
    grpR = floor(meta.b / 16.0); grpC = mod(meta.b, 16.0);
  }
  // each view has its own surface: the Concierge's walls are smooth where the real ones are cracked
  float cv = step(0.5, uView);
  vec3 n = normalize(mix(ssPlain(tNrm), ssPlain(tNrmC), cv) * 2.0 - 1.0);
  if (uFlip > 0.5) n.x = -n.x;
  vec3 m = mix(texture(tMat, U).rgb, texture(tMatC, U).rgb, cv);
  vec3 gR = ssPlain(tGlowR), gC = ssPlain(tGlowC);
  vec3 g = uView > 0.5 ? gC : gR;
  float grp = (uView > 0.5 && grpC > 0.5 && dot(abs(gC - gR), vec3(1.0)) > 0.004) ? grpC : grpR;
  o0 = vec4(a.rgb, (floor(m.b * 127.0 + 0.5) * 2.0 + occ) / 255.0);
  o1 = vec4(n.xy * 0.5 + 0.5, m.r, m.g);
  o2 = vec4(g, (grp + 16.0 * mach) / 31.0);
  // a character is never a reflecting surface, so its reflectivity slot carries where its feet are: wet ground mirrors it
  // around them, wherever it stands
  // and a character's object slot carries how much of the pixel it covers, for a soft outline
  o3 = vec4(dep / 3.0, uHaze < 0.0 ? refl / 2.0 : uFoot, uHaze < 0.0 ? obj / 63.0 : a.a, uHaze < 0.0 ? 1.0 : uHaze * 0.5);
  // blended: every value weighed by the coverage, over what is there (premultiplied); the packed flags in the alpha
  // channels stay those of the layer behind, which flat layers share
  if (uBlend > 0.5) { float c = a.a; o0 = vec4(o0.rgb * c, c); o1 = vec4(o1.rgb * c, c); o2 = vec4(o2.rgb * c, c); o3 = vec4(o3.rgb * c, c); }
}`;

/* ---------- ambient occlusion: occluders, downsampled, then blurred with the shared blur ---------- */

// how much of each pixel at half the level's size is an occluder: every pixel of the G-buffer under it counts (two by two
// at a render scale of 1, four by four at 2), so a thin occluder's darkening holds still as the camera slides it along
export const OCC_FS = HEAD + `
uniform sampler2D tG0; uniform vec2 uSrcRes; uniform float uStep;
float occ(vec2 q) { return mod(floor(texture(tG0, q).a * 255.0 + 0.5), 2.0); }
void main() {
  int n = int(uStep * 2.0 + 0.5); vec2 base = floor(gl_FragCoord.xy) * float(n); float s = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) { if (i >= n || j >= n) continue; s += occ((base + vec2(float(i), float(j)) + 0.5) / uSrcRes); }
  o = vec4(s / float(n * n), 0.0, 0.0, 1.0);
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
uniform float uBaked;     // how much of the set's light is painted into its art: 0 lit by the lights alone, 1 as painted
uniform vec4 uActorLight;  // in a painted scene, the light its people are shown in: their own colours times rgb, by a
uniform float uPaint;     // the look's ambient: how bright a painted set and its people are shown, 1 as painted
uniform vec4 uSh[8];      // shadows on the ground under the characters: feet x, y on screen, half-width
uniform int uNSh;
uniform float uShadowK;   // the look: how dark the ground gets right under a character
uniform vec4 uCars[16]; uniform int uNC;
uniform vec4 uTrail[4], uTrailC[4]; uniform int uNT;   // movers' streaks of light (see MoverDef.trail)
uniform vec4 uBeac[32]; uniform int uNB;
uniform float uLightView;  // 1: the lighting view (scene editor): everything a flat grey, so only what the lights do shows
uniform vec4 uFloor;      // the ground the engine draws: 1 when there is one; how much of the painted floor shows (the
                          // look, 1 all of it); the lightness of the stone that shows instead; the horizon's world y
uniform float uPower;     // the look: the city's power, 1 on; at 0 its lights are out but for those with their own
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
  float specS = g1.z, shin = mix(6.0, 120.0, g1.w), dep = g3.r, obj = actor > 0.5 ? 0.0 : floor(g3.b * 63.0 + 0.5);
  float raw = 1.0 - uView;
  // raw view: every surface goes cold and muted; the strongest colour left lives in the air. A set with its light
  // painted in is already as raw view sees it
  float bk = uBaked * (1.0 - actor);
  vec3 alb = mix(lin(g0.rgb), vec3(0.3), uLightView);
  // a power cut: the power here is the city's, but near a light with power of its own (a battery, a generator, the
  // Concierge's own supply) it is that light's
  float pw = uPower;
  if (uPower < 0.999) for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    float fl = uLG[i].y;
    if (fl < 31.5) continue;
    // only a light in the view on screen: one only in the Concierge's, or only in raw view, keeps nothing lit in the other
    if ((mod(fl, 2.0) > 0.5 && uView < 0.5) || (mod(floor(fl / 16.0 + 0.01), 2.0) > 0.5 && uView > 0.5)) continue;
    // what it lights itself, near it: a shop window, a billboard's face; not the street around it, however far it reaches
    float d = length(uLP[i].xy - uCam - p), R = uLP[i].w;
    pw = max(pw, mix(uPower, 1.0, smoothstep(min(0.7 * R, 160.0), min(0.3 * R, 70.0), d)));
  }
  // what is painted lit in the set (a window, a neon sign, a lamp: its brightest colours, pixel by pixel, so its edges
  // go with it) goes dark with the power, and the rest dims, its light having come from the city's
  // down to the soft light a lamp throws, painted as a pool or a cone, and a neon sign's halo
  float mx = max(g0.r, max(g0.g, g0.b)), litPaint = smoothstep(0.38, 0.85, mx) * (1.0 - actor);
  // people dim less: they are lit by what is near them, and the eye finds them
  alb *= mix(1.0, 0.1, (1.0 - pw) * litPaint) * mix(mix(0.45, 0.7, actor), 1.0, pw);
  bk *= 1.0 - uLightView;
  // the floor the engine draws: as the painted one fades out, stone shows instead, lit by the scene's own lights from
  // above (it faces up, not the eye) and by its ambient. The set's floor is what reflects below the ground line
  float fl = uFloor.x * (1.0 - uFloor.y) * (1.0 - actor) * step(0.01, g3.g) * step(uGround + 0.5, w.y) * (1.0 - uLightView);
  if (fl > 0.0) {
    alb = mix(alb, lin(vec3(uFloor.z)), fl);
    bk *= 1.0 - fl;
    Nn = normalize(mix(Nn, vec3(0.0, -0.94, 0.34), fl));
  }
  alb = mix(alb, tone(alb, RAW_COLD), raw * (1.0 - uRawColour) * (1.0 - bk));
  float occB = T(tAO, p).r, ao = (occ > 0.5 ? 1.0 - 0.25 * occB : 1.0 - 0.8 * occB) * z.b;
  vec3 ambIn = vec3(0.1, 0.066, 0.046), ambOut = vec3(0.045, 0.055, 0.1);
  vec3 amb = (mix(ambIn, tone(ambIn, RAW_LIGHT), raw) * z.r + mix(ambOut, tone(ambOut, RAW_COLD), raw) * z.g) * uLookL.y;
  vec3 col = alb * amb * mix(0.4, 1.0, ao) * (0.85 - 0.3 * Nn.y), spc = vec3(0.0), haze = vec3(0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNL) break;
    vec4 LP = uLP[i], LC = uLC[i], LK = uLK[i], LG = uLG[i];
    // flags: 1 only in Concierge view, 2 a machine's own light, 4 and 8 its layer: 0 behind the characters, 1 among them,
    // 2 in front; 16 only in raw view
    // 32: it has power of its own, and stays on in a power cut
    float arL = mod(LG.y, 2.0), machL = mod(floor(LG.y * 0.5 + 0.01), 2.0), layer = mod(floor(LG.y * 0.25 + 0.01), 4.0), rawL = mod(floor(LG.y / 16.0 + 0.01), 2.0), ownL = floor(LG.y / 32.0 + 0.01);
    float gi = uGI[int(LG.x + 0.5)] * (arL > 0.5 ? uView : 1.0) * (rawL > 0.5 ? 1.0 - uView : 1.0) * (ownL > 0.5 ? 1.0 : uPower);
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
    // raw view's lamps go sterile white, unless the set's light is painted: then its lamps keep the colour they were given
    vec3 lc = arL + machL > 0.5 || uBaked > 0.5 ? LC.rgb : mix(LC.rgb, tone(LC.rgb, RAW_LIGHT), raw);
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
  // the floor the engine draws is lit as a floor: each light from where it hangs, above it and in front of the wall,
  // its pool brightest right under it. The ground's coordinates as the composite draws it: pixels at the walk line,
  // along the street and out from it towards the eye
  if (fl > 0.0) {
    float GYl = uGround - uCam.y, Hz = min(uFloor.w - uCam.y, GYl - 8.0), zr = (GYl - Hz) / max(p.y - Hz, 1.0);
    vec2 g = vec2(uCam.x + uRes.x * 0.5 + (p.x - uRes.x * 0.5) * zr, FOCAL * (1.0 - zr));
    vec3 fcol = vec3(0.0);
    for (int i = 0; i < ${MAX_LIGHTS}; i++) {
      if (i >= uNL) break;
      vec4 LP = uLP[i], LC = uLC[i], LK = uLK[i], LG = uLG[i];
      float arL = mod(LG.y, 2.0), machL = mod(floor(LG.y * 0.5 + 0.01), 2.0), rawL = mod(floor(LG.y / 16.0 + 0.01), 2.0), ownL = floor(LG.y / 32.0 + 0.01);
      float gi = uGI[int(LG.x + 0.5)] * (arL > 0.5 ? uView : 1.0) * (rawL > 0.5 ? 1.0 - uView : 1.0) * (ownL > 0.5 ? 1.0 : uPower);
      float zh = LC.w < 0.5 ? 1.0 : LC.w < 1.5 ? z.r : LC.w < 2.5 ? z.g : LC.w < 3.5 ? facadeW(w) : z.g;
      // a light below the ground line lights none of it
      if (gi * zh < 0.002 || LP.y >= uGround) continue;
      vec3 dv = vec3(g.x - LP.x, uGround - LP.y, g.y - LP.z);
      float dl = length(dv), a = max(0.0, 1.0 - dl / (LP.w * 1.4)); a *= a;
      if (a <= 0.0) continue;
      vec3 dn = dv / dl;
      float cone = LK.z > -1.5 ? smoothstep(LK.z, LK.z + 0.18, dot(dn.xy, LK.xy)) : 1.0;
      vec3 lc = arL + machL > 0.5 || uBaked > 0.5 ? LC.rgb : mix(LC.rgb, tone(LC.rgb, RAW_LIGHT), raw);
      fcol += lc * gi * zh * a * cone * dn.y * uLookL.x * 2.5;
    }
    col = mix(col, alb * amb * mix(0.4, 1.0, ao) * (0.85 - 0.3 * Nn.y) + alb * fcol, fl);
  }
  // a set with its light painted in shows as painted (the final pass leaves its colours alone), the lights adding a
  // little, and its reflections are painted too: the lights' glints stay faint on it. The characters stay lit by them
  col = mix(col, alb * uPaint + col * 0.35, bk);
  // and its people in their own flat colours, tinted by the place, the lamps near them adding their light
  if (actor > 0.5) col = mix(col, alb * uActorLight.rgb * uPaint + col * 0.25, uActorLight.a * (1.0 - uLightView));
  spc *= 1.0 - 0.75 * bk;
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
  outc += mix(em, tone(em, RAW_LIGHT), raw * (1.0 - machE)) * uGI[int(mod(ge, 16.0))] * uLookL.w * (1.0 - 0.75 * uLightView) * pw;
  if (dep < 0.4 && uView > 0.5) {
    for (int k = 0; k < 16; k++) { if (k >= uNC) break; vec4 c = uCars[k]; vec2 r = p - (c.xy - uCam); float al = r.x * c.z;
      if (abs(r.y) < 1.2) { if (al > -c.w && al < 0.0) outc += vec3(2.2, 0.25, 0.2) * pow(1.0 + al / c.w, 2.0) * 0.6; if (al >= 0.0 && al < 4.0) outc += al < 2.0 ? vec3(4.0, 4.2, 4.6) : vec3(0.08, 0.08, 0.1); } }
  }
  for (int k = 0; k < 4; k++) {
    if (k >= uNT) break; vec4 tr = uTrail[k]; if (dep > tr.w) continue;
    vec2 r = p - (tr.xy - uCam); float len = abs(tr.z), back = -r.x * sign(tr.z);
    if (back < -1.5 || back > len) continue;
    float t = clamp(back / len, 0.0, 1.0), hw = uTrailC[k].w * (1.0 - 0.65 * t);
    outc += lin(uTrailC[k].rgb) * 2.2 * smoothstep(hw + 1.0, hw * 0.3, abs(r.y)) * (1.0 - t) * (1.0 - t) * smoothstep(-1.5, 0.5, back);
  }
  vec3 bc = mix(vec3(5.0, 0.6, 0.5), tone(vec3(5.0, 0.6, 0.5), RAW_LIGHT), raw), bh = mix(vec3(0.6, 0.05, 0.05), tone(vec3(0.6, 0.05, 0.05), RAW_AIR), raw);
  for (int k = 0; k < 32; k++) { if (k >= uNB) break; vec4 b = uBeac[k]; if (sin(uTime * 2.4 + b.z) > 0.4) { float d = length(p - (b.xy - uCam)); outc += bc * smoothstep(2.0, 0.5, d) + bh * smoothstep(14.0, 0.0, d) * 0.4; } }
  o = vec4(outc, 1.0);
}`;

/* ---------- composite: depth of field, wet reflections, steam and smoke, rain, drips ---------- */

export const COMP_FS = HEAD + ZONE + `
uniform sampler2D tA, tG3, tDof;
uniform sampler2D tRefl;  // the set without its people, blurred for its reflections (when uReflBlur is on)
uniform sampler2D tReflNear; // the same barely softened, for where things touch a glossy floor (when uReflFade is on)
uniform float uReflFade;  // the look: how far below the line, in level pixels, a reflection goes from sharp to soft; 0 evenly
uniform float uReflBlur;  // 1: the set's reflection comes from tRefl, soft and streaked; 0: from the sharp picture
uniform vec2 uReflSoft;   // the look: how far reflections smear sideways and up and down, in level pixels
uniform float uSmudge;    // 1: a glossy floor, every reflection smudged into colour and light, the people's too
uniform float uTime, uDof, uView, uRawFog;
uniform float uWrap;      // the look: how much a character's outline softens into the light around it, and takes it on
uniform float uRain;      // how hard it rains in the view on screen, 0 to 1
uniform float uFog;       // the look: fog in the air, in the view's own: violet to the Concierge, raw view's smog
uniform float uBakedC;    // how much of the set is painted, its reflections too: then only the characters are mirrored
uniform vec4 uRefl;       // the look: reflections' strength; how far up the set's reaches (1 a mirror); how far its lights
                          // streak down, in pixels; how much the set is mirrored in a painted scene, below the line
uniform vec4 uSteam[4];
uniform vec4 uSteamFar;   // 1 for each emitter on a far layer: its plume only where a far layer is in front
uniform vec4 uDrips;      // world x0, x1, top, bottom of the drip curtain; z <= 0 turns it off
uniform vec4 uScope[8];   // oscilloscopes, four vec4 each: the screen's middle (world) and half its width, the line's
                          // shape (1 sine, 2 square, 3 triangle, 4 saw, 5 voice); the shape before, how far it has
                          // turned, how far its waves have crept, how many cross the screen; half its height, 1 for a
                          // round glass, and the line's colour in raw view, then in the Concierge's
uniform int uNScope;
uniform vec4 uClock[2];   // clocks: a face's middle (world) and its radius inside the hour marks
uniform int uNClock;
uniform float uDaySec;    // the time of day, seconds after midnight
uniform vec4 uCradle[3];  // a Newton's cradle: where its first thread hangs (world), the gap between threads, their
                          // length; its balls' radius, seconds since an end ball was let go, which end, 1 if there is
                          // one; its front posts, from and to x, left then right (world)
uniform vec4 uInd[16];    // the lift's displays, four vec4 each: the box (world), its figures' segments (tens, ones),
                          // which way the lift goes; the figures' colour in raw view, then in the Concierge's
uniform int uNInd;
uniform vec4 uWatch[2];   // cameras on walls: where the bracket meets the wall (world), size, which way it looks
uniform int uNWatch;
uniform vec4 uAir[2];     // air from an outlet: where it comes out (world), how wide, seconds since its spot was used
uniform int uNAir;
uniform vec4 uRings[2];   // a hologram of three rings: its middle (world), its size, 1 if there is one; each ring's turn
                          // (radians, the inner first), how long since its gaps lined up (seconds; -1 while they don't)
uniform float uMirror;    // world y of the reflection line
uniform vec4 uGnd;        // the ground the engine draws over a painted floor: the horizon's world y; the kerb's distance in
                          // front of the walk line (0: none); how much of it holds puddles when wet; 1 when there is one
uniform vec2 uSlab;       // a paving slab's width and depth, in pixels at the walk line; 0: no slabs
uniform vec3 uState;      // the look: how wet the ground is (0 dry, 1 soaked), how polished when dry, how worn
/*
 * The ground below the reflection line, when the scene has one: paving slabs, a kerb and the road beyond it, seen by an
 * eye at the horizon's height. Its coordinates are pixels at the walk line, along the street and out from the walk line
 * towards the eye, so it moves under the camera as a floor does, the near ground faster than the far.
 */
const float KERB = 7.0;      // the kerb's height, in pixels at the walk line
struct Ground {
  vec3 tint;    // what it does to the painted floor's colour
  float gloss;  // how much it shines dry, polished
  float film;   // how much a film of water on it mirrors, broken up by its grain
  float pud;    // standing water, 0 to 1: none when dry
  float joint;  // how much of the pixel is a joint between slabs
  float face;   // 1 on the kerb's face, which mirrors nothing
  float edge;   // the kerb's top edge, catching the light
  float fres;   // reflections are stronger far off, where the eye looks along the ground, than near: 1 at the walk line
  vec2 tilt;    // a slab never laid quite level mirrors a little askew: how far its reflection is moved
};
// how much of a pixel f wide a line hw either side of its middle covers, its middle d away
float cover(float d, float hw, float f) { return clamp((min(d + 0.5 * f, hw) - max(d - 0.5 * f, -hw)) / f, 0.0, 1.0); }
// the joints of cells \`size\` apart, at s cells along, in a pixel f wide: lines closer together than a pixel or so fade
// to their average, so far rows of slabs do not shimmer
float joints(float s, float size, float hw, float f) {
  float d = min(fract(s), 1.0 - fract(s)) * size;
  return mix(cover(d, hw, f), 2.0 * hw / size, smoothstep(0.25, 0.7, f / size));
}
Ground groundAt(vec2 p, float GY) {
  Ground o = Ground(vec3(1.0), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, vec2(0.0));
  float H = min(uGnd.x - uCam.y, GY - 8.0), cx = uRes.x * 0.5, lift = 0.0, wear = uState.z;
  bool road = false;
  if (uGnd.y > 0.0) {
    // the kerb: the pavement ends there, and its face drops KERB to the road
    float zk = 1.0 - min(uGnd.y, FOCAL * 0.9) / FOCAL, yk = H + (GY - H) / zk, yb = yk + KERB / zk;
    o.edge = cover(abs(p.y - yk + 0.4), 0.5, 1.0 / uRS);
    if (p.y >= yb) { road = true; lift = KERB; }
    else if (p.y >= yk) o.face = 1.0;
  }
  float zr = (GY - H + lift) / max(p.y - H, 1.0);
  vec2 g = vec2(uCam.x + cx + (p.x - cx) * zr, FOCAL * (1.0 - zr));
  float fx = zr / uRS, fz = FOCAL * zr / max(p.y - H, 1.0) / uRS;   // ground pixels across a target pixel, along and out
  float s = (p.y - H) / length(vec2(p.y - H, FOCAL)), s0 = (GY - H) / length(vec2(GY - H, FOCAL));
  o.fres = (0.04 + 0.96 * pow(1.0 - s, 5.0)) / (0.04 + 0.96 * pow(1.0 - s0, 5.0));
  if (o.face > 0.5) { o.tint = vec3(mix(0.6, 0.45, wear)); return o; }
  float rough;
  if (road) {
    // asphalt: darker and rougher, patched where it was dug up, grimy along the gutter
    vec2 cs = vec2(160.0, 110.0), pc = floor(g / cs), pf = fract(g / cs), pw = vec2(fx, fz) / cs;
    vec2 m0 = 0.08 + 0.3 * vec2(hash(pc + 1.0), hash(pc + 2.0)), m1 = 0.92 - 0.3 * vec2(hash(pc + 3.0), hash(pc + 4.0));
    vec2 in2 = smoothstep(m0 - pw, m0 + pw, pf) * smoothstep(m1 + pw, m1 - pw, pf);
    float pa = in2.x * in2.y * step(0.68, hash(pc + 5.0)) * wear;
    o.tint = vec3(0.78 * (1.0 - 0.14 * pa) * (1.0 - 0.3 * wear * exp(-(g.y - uGnd.y) / 14.0)));
    o.gloss = 0.55; rough = mix(0.85, 0.55, pa);
  } else {
    o.gloss = 1.0; rough = 0.4;
    if (uSlab.x > 0.0 && uSlab.y > 0.0) {
      // paving slabs, each row half a slab along from the last, each a little lighter or darker
      vec2 sl = g / uSlab; sl.x += 0.5 * mod(floor(sl.y), 2.0);
      o.joint = max(joints(sl.x, uSlab.x, 0.8, fx), joints(sl.y, uSlab.y, 0.8, fz));
      vec2 id = floor(sl);
      float h1 = hash(id + 3.7), h2 = hash(id + 8.1), h3 = hash(id + 1.3);
      o.tint = vec3(1.0 + (h1 - 0.5) * mix(0.1, 0.2, wear));
      // polished slabs are never laid quite level: each mirrors a little askew, and a little more or less
      o.tilt = (vec2(h2, h3) - 0.5) * vec2(1.4, 3.0) * uState.y;
      o.gloss = 0.8 + 0.4 * h2;
    }
  }
  // grime: stains in big soft blotches, and a grain that fades out where it would be finer than a pixel
  o.tint *= 1.0 - wear * 0.28 * smoothstep(0.5, 0.8, fbm(g * vec2(0.008, 0.013) + 11.0));
  float fine = smoothstep(1.0, 0.35, max(fx * 0.45, fz * 0.3));
  o.tint *= 1.0 + (vn(g * vec2(0.45, 0.3) + 2.0) - 0.5) * wear * 0.24 * fine;
  // a film of water mirrors less on rough ground, broken by its grain into the streaks of a wet street
  float spark = vn(vec2(g.x * 0.3, g.y * 0.035) + 5.0);
  o.film = mix(0.42, 0.25, rough) * mix(1.0, 0.3 + 1.4 * spark, rough * mix(0.5, 1.0, fine));
  // polish is uneven: duller in patches, and its shine drawn into streaks by fine scratches along the eye's way
  o.gloss *= mix(0.55, 1.0, smoothstep(0.3, 0.7, vn(g * vec2(0.007, 0.012) + 31.0))) * mix(1.0, 0.55 + 0.9 * spark, 0.45 * fine);
  // standing water: where the ground dips, filling as it gets wetter; with a kerb, on the road most, along the gutter
  float amt = clamp(uGnd.z * (uGnd.y > 0.0 && !road ? 0.5 : 1.0) + (road ? 0.35 * exp(-(g.y - uGnd.y) / 25.0) : 0.0), 0.0, 1.0);
  // two octaves, so they are simple shapes with smooth outlines, as the flat look draws them; amt is about the share covered
  float n = vn(g * vec2(0.010, 0.016) + 4.2) * 0.667 + vn(g * vec2(0.0203, 0.0325) + vec2(10.2, 17.7)) * 0.333, thr = 0.76 - 0.52 * amt;
  o.pud = smoothstep(thr, thr + 0.01, n) * smoothstep(0.3, 0.8, uState.x) * step(0.001, uGnd.z);
  return o;
}
// an oscilloscope's line at phase ph, in cycles: its height, -1 to 1, and its slope, per cycle
vec2 waveAt(float s, float ph) {
  float f = fract(ph);
  if (s < 1.5) return vec2(sin(6.2831853 * ph), 6.2831853 * cos(6.2831853 * ph));
  if (s < 2.5) return vec2(f < 0.5 ? 1.0 : -1.0, 0.0);
  if (s < 3.5) { float g = fract(ph + 0.75); return vec2(4.0 * abs(g - 0.5) - 1.0, g < 0.5 ? -4.0 : 4.0); }
  if (s < 4.5) return vec2(2.0 * fract(ph + 0.5) - 1.0, 2.0);
  // a voice: quick waves in bursts that swell and fade as it goes on
  float th = 6.2831853 * ph * 0.6 + uTime * 1.1, e0 = 0.5 + 0.5 * sin(th), e = 0.25 + 0.75 * e0 * e0;
  float de = 0.75 * e0 * cos(th) * 6.2831853 * 0.6, a3 = 6.2831853 * ph * 3.0, a7 = 6.2831853 * ph * 7.0 + 1.3;
  float wv = 0.7 * sin(a3) + 0.3 * sin(a7), dw = 6.2831853 * (2.1 * cos(a3) + 2.1 * cos(a7));
  return vec2(wv * e, dw * e + wv * de);
}
// how much of a pixel px wide at p a box from lo to hi covers
float boxCover(vec2 p, vec2 lo, vec2 hi, float px) { vec2 d = max(lo - p, p - hi); return clamp(0.5 - max(d.x, d.y) / px, 0.0, 1.0); }
// how much of a pixel a figure dw by dh covers at p (its top left 0, 0): its lit segments, the bits of its mask, a top
// then clockwise, the middle last
float figure(vec2 p, float dw, float dh, int mask, float px) {
  float t = dh * 0.15, s = t * 0.65, m = dh * 0.5, c = 0.0;
  if ((mask & 1) != 0) c = max(c, boxCover(p, vec2(s, 0.0), vec2(dw - s, t), px));
  if ((mask & 2) != 0) c = max(c, boxCover(p, vec2(dw - t, s), vec2(dw, m - t * 0.3), px));
  if ((mask & 4) != 0) c = max(c, boxCover(p, vec2(dw - t, m + t * 0.3), vec2(dw, dh - s), px));
  if ((mask & 8) != 0) c = max(c, boxCover(p, vec2(s, dh - t), vec2(dw - s, dh), px));
  if ((mask & 16) != 0) c = max(c, boxCover(p, vec2(0.0, m + t * 0.3), vec2(t, dh - s), px));
  if ((mask & 32) != 0) c = max(c, boxCover(p, vec2(0.0, s), vec2(t, m - t * 0.3), px));
  if ((mask & 64) != 0) c = max(c, boxCover(p, vec2(s, m - t * 0.5), vec2(dw - s, m + t * 0.5), px));
  return c;
}
// how far p is from the segment from a to b
float segAt(vec2 p, vec2 a, vec2 b) { vec2 ab = b - a; return length(p - a - ab * clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0)); }
// how far q is from a clock's hand at angle a (clockwise from twelve), reaching len, with a tail behind the middle
float handAt(vec2 q, float a, float len, float tail) {
  vec2 d = vec2(sin(a), -cos(a));
  return length(q - d * clamp(dot(q, d), -tail, len));
}
// how far q is from the nearest step a square or a saw jumps down or up: the beam crosses it too fast to light it much
float waveStep(float s, vec2 q, float ph, float span, float amp, float drift, float waves) {
  if (s < 1.5 || (s > 2.5 && s < 3.5) || s > 4.5) return 1e3;
  float pj = s < 2.5 ? floor(ph * 2.0 + 0.5) * 0.5 : floor(ph) + 0.5, xj = (2.0 * (pj - drift) / waves - 1.0) * span;
  return abs(xj) > span ? 1e3 : length(vec2(q.x - xj, max(abs(q.y) - amp, 0.0)));
}
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
  if (dk > 0.0) { vec4 b = T(tDof, p); if (b.a > 0.02) c = mix(c, b.rgb / b.a, dk * smoothstep(0.02, 0.3, b.a)); }
  float raw = 1.0 - uView;
  // what stirs the puddles: the real world's weather, and the Concierge's when it rains there too
  float stir = max(raw, uRain);
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
  // her outline: a pixel she only partly covers takes the rest of its colour from the set around it
  if (isActor(g3.a) > 0.5 && g3.b < 0.99) {
    vec3 env = vec3(0.0); float m = 0.0;
    for (int k = 0; k < 8; k++) { vec2 q = p + vec2(cos(float(k) * 0.7854), sin(float(k) * 0.7854)) * 1.5; if (isActor(T(tG3, q).a) < 0.5) { env += T(tA, q).rgb; m += 1.0; } }
    if (m > 0.0) c = mix(env / m, c, g3.b);
  }
  // the ground the scene has the engine draw, if this pixel is its floor
  Ground G = Ground(vec3(1.0), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, vec2(0.0));
  bool gnd = uGnd.w > 0.5 && refl > 0.02 && p.y > GY && isActor(g3.a) < 0.5;
  if (gnd) G = groundAt(p, GY);
  if (refl > 0.02) {
    float puddle = gnd ? G.pud : step(0.7, refl);
    // rain stirs the puddles in the real world; the Concierge's streets are still, unless it rains there too. Softened
    // reflections get long, slow swells, so their edges waver instead of breaking into bands. On a ground of the scene's
    // own only standing water moves: stone and asphalt hold still
    float rip = gnd
      ? (sin(p.y * 0.85 + uTime * 5.0 + w.x * 0.04) * 1.2 + (vn(w * 0.08 + uTime) - 0.5) * 2.0) * G.pud * mix(0.2, 1.0, stir)
      : uReflBlur > 0.5
      ? (sin(p.y * 0.32 + uTime * 2.0 + w.x * 0.025) * 0.8 + (vn(w * vec2(0.03, 0.12) + uTime * 0.4) - 0.5) * 1.6 * puddle) * mix(0.15, 1.0, stir)
      : (sin(p.y * 0.85 + uTime * 5.0 + w.x * 0.04) * mix(0.5, 1.6, puddle) + (vn(w * 0.08 + uTime) - 0.5) * 2.0 * puddle) * mix(0.25, 1.0, stir);
    // the set is mirrored around its ground line, and a character around its own feet: look up this column for the nearest
    // character above this bit of ground. If the set's mirror lands on a character standing elsewhere, take the set beside it
    // the set's reflection reaches uRefl.y times as far up as the pixel is below the line: a low camera over wet ground
    // sees tall things in it, squeezed
    vec2 tilt = G.tilt * (1.0 + 0.06 * (p.y - GY)) * (1.0 - G.pud);
    vec2 qs = vec2(p.x + rip + tilt.x, max(0.5, GY - (p.y - GY) * uRefl.y + tilt.y)), q = qs;
    float F = -1.0;
    if (uSmudge < 0.5) for (int k = 1; k <= 32; k++) { vec4 ga = T(tG3, vec2(p.x, p.y - float(k) * 3.0)); if (isActor(ga.a) > 0.5) { F = ga.g * uRes.y; break; } }
    // (whether a pixel mirrors her is decided where the ripple does not move it, so her reflection's edges do not comb
    // into stripes, row by row; the ripple moves only what is shown)
    bool mine = false;
    if (F > 0.0 && p.y > F) { vec2 qa = vec2(p.x + rip, 2.0 * F - p.y); if (isActor(T(tG3, vec2(p.x, qa.y)).a) > 0.5) { q = qa; mine = true; } }
    float keep = 1.0;
    // the set's mirror lands on a character standing elsewhere (or on her own legs, seen through a gap in her reflection,
    // as when she runs): what is behind her is not in the picture. The set's own reflection, with the people left out of
    // it, has it, filled in from around her (below); without that, the set beside her stands in
    bool behind = !mine && uSmudge < 0.5 && isActor(T(tG3, vec2(qs.x - rip, qs.y)).a) > 0.5;
    vec3 r = (T(tA, q).rgb * 2.0 + T(tA, q + vec2(0.0, 2.0)).rgb + T(tA, q - vec2(0.0, 2.0)).rgb + (T(tA, q + vec2(0.0, 5.0)).rgb + T(tA, q - vec2(0.0, 5.0)).rgb) * 0.6 + T(tA, q - vec2(0.0, 9.0)).rgb * 0.4) / 5.6;
    if (behind && uReflBlur < 0.5) {
      // what the set has behind her at that height is the set on either side of her, carried smoothly across: so the
      // street's reflection runs on through the gaps in hers (between her legs as she runs), with no seam or smear
      float dl = -1.0, dr = -1.0;
      for (int j = 1; j <= 32; j++) {
        if (dl < 0.0 && isActor(T(tG3, qs - vec2(float(j) * 4.0, 0.0)).a) < 0.5) dl = float(j) * 4.0;
        if (dr < 0.0 && isActor(T(tG3, qs + vec2(float(j) * 4.0, 0.0)).a) < 0.5) dr = float(j) * 4.0;
      }
      if (dl < 0.0 && dr < 0.0) keep = 0.0;
      else {
        vec3 cl = T(tA, qs - vec2(max(dl, 0.0), 0.0)).rgb, cr = T(tA, qs + vec2(max(dr, 0.0), 0.0)).rgb;
        r = dl < 0.0 ? cr : dr < 0.0 ? cl : mix(cl, cr, dl / (dl + dr));
      }
    }
    vec3 rs = r;  // sharp, as standing water mirrors
    // a character's reflection softens as the set's does: averaged over her own pixels around the mirrored point, and
    // fading at her edges by how much of her is there
    float cover = 1.0;
    if (mine && uReflSoft.x + uReflSoft.y > 0.5) {
      vec3 acc = vec3(0.0); float n = 0.0, soft = uReflFade > 0.0 ? mix(0.15, 1.0, smoothstep(0.0, uReflFade, p.y - F)) : 1.0;
      for (int j = -1; j <= 1; j++) for (int i = -2; i <= 2; i++) {
        vec2 o = q + vec2(float(i) * 0.25 * uReflSoft.x, float(j) * 0.35 * uReflSoft.y) * soft;
        if (isActor(T(tG3, o).a) > 0.5) { acc += T(tA, o).rgb; n += 1.0; }
      }
      if (n > 0.0) r = acc / n;
      cover = n / 15.0;
    }
    // the set, softened: blurred sideways (diffuse, as in polished stone) and up and down (streaks, as in a wet street)
    float below = step(GY + 0.5, p.y);
    if (!mine && uReflBlur > 0.5) {
      vec2 qq = vec2(q.x, min(GY - 1.0, q.y));
      vec4 b = T(tRefl, qq);
      // a glossy floor mirrors sharply where things touch it, softer the further they are
      if (uReflFade > 0.0) b = mix(T(tReflNear, qq), b, smoothstep(0.0, uReflFade, p.y - GY));
      // where a person stood, the set's reflection is a hole only partly filled by its blur: what is on either side of
      // it, carried smoothly across (the nearest block of it beside, copied in, showed as a smear between her feet)
      // (three rows of it, a few pixels apart, so the rows' different widths of her do not band it)
      if (b.a < 0.5) {
        vec4 fill = vec4(0.0);
        for (int row = -1; row <= 1; row++) {
          // its edges found where the water's ripple does not move them, so the rows do not fan out in stripes
          vec2 qr = qq + vec2(0.0, float(row) * 4.0), qe = vec2(p.x, qr.y);
          vec4 bl = vec4(0.0), br = vec4(0.0);
          float dl = -1.0, dr = -1.0;
          for (int j = 1; j <= 32; j++) {
            if (dl < 0.0 && T(tRefl, qe - vec2(float(j) * 4.0, 0.0)).a >= 0.5) dl = float(j) * 4.0;
            if (dr < 0.0 && T(tRefl, qe + vec2(float(j) * 4.0, 0.0)).a >= 0.5) dr = float(j) * 4.0;
          }
          if (dl > 0.0) bl = T(tRefl, qr - vec2(dl, 0.0));
          if (dr > 0.0) br = T(tRefl, qr + vec2(dr, 0.0));
          fill += dl > 0.0 && dr > 0.0 ? mix(bl, br, dl / (dl + dr)) : dl > 0.0 ? bl : dr > 0.0 ? br : T(tRefl, qr);
        }
        b = fill / 3.0;
      }
      if (b.a > 0.02) { r = b.rgb / b.a; if (behind) rs = r; }
      else if (behind) keep = 0.0;
    }
    float k, seen = keep * (mine ? cover : max(1.0 - uBakedC, uRefl.w * below)) * uRefl.x;
    if (gnd) {
      // its own colour: wet things are darker, standing water darker still, and so are the joints between slabs; the
      // kerb's top edge catches the light
      c *= G.tint * mix(1.0, 0.72, uState.x) * mix(1.0, 0.8, G.pud) * (1.0 - 0.4 * G.joint);
      c += G.edge * (c * 0.9 + 0.01);
      // dry, polished stone shines softly; wet, a film of water mirrors on anything, broken up by the grain under it;
      // standing water mirrors best, and sharply. All of it more far off than near
      r = mix(r, rs, G.pud);
      k = max(max(G.gloss * uState.y, G.film * uState.x), G.pud) * G.fres * (1.0 - 0.75 * G.joint) * (1.0 - G.face) * (1.0 - G.edge) * seen;
      // a shiny dry floor shows its reflection over its own colour: the shinier, the less of its colour
      c = c * (1.0 - k * mix(0.5, 0.9, uState.y * (1.0 - uState.x))) + r * k;
    } else {
      k = mix(0.42, 0.88, puddle) * (0.75 + 0.25 * smoothstep(GY, uRes.y, p.y)) * seen;
      c = c * (1.0 - k * 0.5) + r * k;
    }
  }
  // raw view: the poisonous air between the eye and everything it sees, thicker with distance and outdoors
  if (raw > 0.0) {
    float fd = dep < 0.15 ? 0.55 : dep < 0.5 ? 0.38 : dep < 0.8 ? 0.22 : 0.08;
    c = mix(c, tone(vec3(0.045), RAW_AIR), min(1.0, raw * fd * mix(0.35, 1.0, z.g * (1.0 - z.r)) * uRawFog));
  }
  vec3 near = (T(tA, p + vec2(6.0, 0.0)).rgb + T(tA, p - vec2(6.0, 0.0)).rgb + T(tA, p + vec2(0.0, 6.0)).rgb + T(tA, p - vec2(0.0, 6.0)).rgb) * 0.25;
  // fog: the air between the eye and everything, thicker with distance and outdoors, lit by what glows in it
  if (uFog > 0.0) {
    float fdf = dep < 0.15 ? 0.75 : dep < 0.5 ? 0.55 : dep < 0.8 ? 0.32 : 0.14;
    vec3 fogC = mix(tone(vec3(0.07), CO_AIR), tone(vec3(0.07), RAW_AIR), raw) + near * 0.45;
    c = mix(c, fogC, min(1.0, fdf * mix(0.45, 1.0, z.g * (1.0 - z.r)) * uFog));
  }
  for (int s = 0; s < 4; s++) {
    vec4 e = uSteam[s]; if (e.z <= 0.0) continue; vec2 r = p - (e.xy - uCam); float up = -r.y; if (up < -4.0 || up > e.z || abs(r.x) > abs(e.w) * 3.4 + 9.0) continue;
    // a smokestack's, on a far layer: only where that layer shows, rising slowly, its dark smoke darkening the smog
    float far = uSteamFar[s]; if (far > 0.5 && dep > 0.4) continue;
    float smoke = step(e.w, 0.0), k = up / e.z, sway = sin(k * 5.0 + uTime * 0.8) * 8.0 * k, wdt = abs(e.w) * (0.35 + k * (1.0 + 2.0 * smoke));
    float n = fbm(vec2((r.x - sway) * 0.05, (r.y + uTime * mix(26.0, 9.0, far)) * 0.045));
    float d = smoothstep(wdt, wdt * 0.2, abs(r.x - sway)) * smoothstep(0.75, 0.25, k * n) * n * (1.0 - k);
    if (far > 0.5) { c = mix(c, c * 0.45, min(0.85, d * 1.6)); continue; }
    vec3 vapour = mix(vec3(0.025, 0.025, 0.03), vec3(0.16, 0.16, 0.18), smoke);
    c += (mix(near, tone(near, RAW_AIR), raw * 0.6) * 1.4 + mix(vapour, tone(vapour, RAW_AIR) * 1.2, raw)) * d * mix(0.9, 1.3, smoke);
  }
  // rain falls outside: in the real world, and in the Concierge's when it lets it (a storm it cannot hide)
  // past 1, a downpour: more streaks, and nearer ones, longer and brighter
  float outside = z.g * (1.0 - z.r) * min(uRain, 1.0), pour = clamp(uRain - 1.0, 0.0, 1.0);
  if (outside > 0.05) {
    float rn = rainL(p, uTime, 2.0, 55.0, 6.0, 0.33 + 0.3 * pour) * 0.55 + rainL(p + 37.0, uTime, 4.0, 95.0, 5.0, 0.22 + 0.25 * pour) + rainL(p + 71.0, uTime, 6.0, 140.0, 7.0, 0.12 * pour) * 1.4;
    vec3 tint = normalize(near + 1e-4) * 0.9;
    c += rn * outside * (mix(vec3(0.012, 0.014, 0.02), tone(vec3(0.012, 0.014, 0.02), RAW_AIR), raw) + tint * lum(near) * 2.6);
    if (p.y > GY + 2.0 && refl > 0.02 && hash(floor(w / vec2(18.0, 6.0)) + 21.0) < uRain) { vec2 cell = floor(w / vec2(18.0, 6.0)); float ph = fract(uTime * (0.7 + hash(cell)) + hash(cell + 3.0)); float rr = length((w - (cell + 0.5) * vec2(18.0, 6.0)) * vec2(1.0, 3.0)); c += vec3(0.18, 0.2, 0.24) * smoothstep(1.4, 0.0, abs(rr - ph * 9.0)) * (1.0 - ph) * step(0.55, hash(cell + 9.0)) * (0.4 + lum(near)) * (gnd ? G.pud : 1.0); }
    // on a ground of the scene's own, rings spread only in standing water; on the rest, wet, drops splash
    if (gnd && G.pud < 0.99) {
      vec2 cs = vec2(7.0, 3.0), cell = floor(w / cs), at = (cell + vec2(hash(cell + 1.0), hash(cell + 2.0))) * cs;
      float ph = fract(uTime * (1.3 + hash(cell + 5.0)) + hash(cell + 4.0));
      float drop = smoothstep(0.9, 0.25, length((w - at) * vec2(1.0, 2.2))) * smoothstep(0.14, 0.0, ph) * step(hash(cell + 7.0), uRain * 0.6);
      c += vec3(0.16, 0.18, 0.21) * drop * (1.0 - G.pud) * uState.x * (0.4 + lum(near));
    }
  }
  if (uDrips.z > 0.0 && raw > 0.5 && w.y < uDrips.w && w.x > uDrips.x && w.x < uDrips.y && z.r > 0.5) {
    float dx = mod(w.x, 37.0), id = floor(w.x / 37.0), ph = fract(uTime * (0.45 + hash(vec2(id, 1.0)) * 0.5) + hash(vec2(id, 2.0)));
    float yy = uDrips.z + ph * ph * (uDrips.w - uDrips.z);
    if (abs(dx - 18.0) < 0.8 && abs(w.y - yy) < 2.5) c += vec3(0.5, 0.42, 0.35) * (0.4 + lum(near) * 2.0);
  }
  // an oscilloscope's line, drawn live: it creeps along (the trigger never quite holds) and breathes a little, and in raw
  // view carries a real signal's noise; its knobs turned, it changes shape over a moment, and speed. Never over someone
  // in front of it
  for (int i = 0; i < 2; i++) {
    if (i >= uNScope) break;
    vec4 A = uScope[i * 4], B = uScope[i * 4 + 1], C = uScope[i * 4 + 2], D = uScope[i * 4 + 3];
    vec2 q = w - A.xy;
    bool round = C.y > 0.5;
    if ((round ? dot(q, q) > A.z * A.z : abs(q.x) > A.z || abs(q.y) > C.x) || isActor(g3.a) > 0.5) continue;
    float span = A.z * (round ? 0.92 : 0.86), amp = C.x * (round ? 0.44 : 0.5) * (1.0 + 0.03 * sin(uTime * 0.9 + float(i) * 1.7));
    float waves = max(B.w, 0.25), drift = B.z, ph = (clamp(q.x / span, -1.0, 1.0) + 1.0) * 0.5 * waves + drift, k = smoothstep(0.0, 1.0, B.y);
    vec2 v = mix(waveAt(B.x, ph), waveAt(A.w, ph), k);
    // its line as fine as its screen is small: set for a glass 48 pixels in radius, up close
    float sc = C.x / 48.0, px = 1.0 / uRS, hw = max(0.6, 1.55 * sc);
    float yc = -amp * v.x + (vn(vec2(w.x * 0.9 / sc, uTime * 30.0)) - 0.5) * 0.6 * sc * raw;
    float sl = amp * v.y * waves / (2.0 * span), past = abs(q.x) - span;
    float d = past > 0.0 ? length(vec2(past, q.y - yc)) : abs(q.y - yc) / sqrt(1.0 + sl * sl);
    // a line with no jumps in it, steep or not: how far from a few short pieces of it either side of this pixel (the
    // slope alone, where it is steep, lights the whole column)
    bool jumps = abs(A.w - 2.0) < 0.5 || abs(A.w - 4.0) < 0.5 || (k < 1.0 && (abs(B.x - 2.0) < 0.5 || abs(B.x - 4.0) < 0.5));
    if (!jumps) {
      d = 1e3;
      vec2 last = vec2(0.0);
      for (int j = -3; j <= 3; j++) {
        float xs = clamp(q.x + float(j) * 0.8, -span, span), pj = (xs / span + 1.0) * 0.5 * waves + drift;
        vec2 pt = vec2(xs, -amp * mix(waveAt(B.x, pj).x, waveAt(A.w, pj).x, k) + (vn(vec2((A.x + xs) * 0.9 / sc, uTime * 30.0)) - 0.5) * 0.6 * sc * raw);
        if (j > -3) d = min(d, segAt(q, last, pt));
        last = pt;
      }
    }
    float steps = (cover(waveStep(B.x, q, ph, span, amp, drift, waves), hw * 0.5, px) * (1.0 - k) + cover(waveStep(A.w, q, ph, span, amp, drift, waves), hw * 0.5, px) * k) * 0.35;
    vec3 col = mix(vec3(C.z, C.w, D.x), D.yzw, uView) * (0.96 + 0.04 * sin(uTime * 7.0 + float(i)));
    float line = max(cover(d, hw, px), steps);
    c = mix(c, col, line);
    c += col * (exp(-d * d / (12.0 * sc * sc)) * 0.4 + exp(-d / (7.0 * sc)) * 0.1) * 0.5 * (1.0 - line);
  }
  // a clock's hands, live, at the game's time of day: the second hand ticks, and settles with a little bounce. Never
  // over someone in front of it
  for (int i = 0; i < 2; i++) {
    if (i >= uNClock) break;
    vec4 K = uClock[i];
    vec2 q = w - K.xy;
    float R = K.z, f = fract(uDaySec), tau = 6.2831853, px = 1.0 / uRS;
    if (dot(q, q) > R * R || isActor(g3.a) > 0.5) continue;
    float sec = floor(mod(uDaySec, 60.0)) - exp(-f * 22.0) * cos(f * 38.0);
    float dh = handAt(q, tau * mod(uDaySec / 3600.0, 12.0) / 12.0, R * 0.5, R * 0.08);
    float dm = handAt(q, tau * mod(uDaySec / 60.0, 60.0) / 60.0, R * 0.74, R * 0.08);
    float ds = handAt(q, tau * sec / 60.0, R * 0.8, R * 0.2);
    vec3 ink = mix(vec3(0.03), vec3(0.03, 0.035, 0.07), uView), red = mix(vec3(0.42, 0.1, 0.06), vec3(0.7, 0.18, 0.1), uView);
    c = mix(c, ink, max(cover(dh, R * 0.06, px), cover(dm, R * 0.045, px)));
    c = mix(c, red, cover(ds, max(R * 0.016, 0.3), px) * 0.9);
    c = mix(c, ink, cover(length(q), R * 0.08, px));
  }
  // a Newton's cradle, live: its five balls on their threads. Let go, an end ball swings in, and the knock sends the other
  // end out and back, to and fro, dying away. Lit from the upper left, as the painted frame is
  if (uCradle[1].w > 0.5 && isActor(g3.a) < 0.5) {
    vec4 P = uCradle[0], Q = uCradle[1], F = uCradle[2];
    vec2 o = w - P.xy;
    float r = Q.x, gap = P.z, L = P.w;
    // behind the frame's front posts, the balls are hidden: an end ball swings out behind one
    bool post = (w.x > F.x && w.x < F.y) || (w.x > F.z && w.x < F.w);
    if (!post && o.x > -L * 0.6 - r && o.x < gap * 4.0 + L * 0.6 + r && o.y > -1.0 && o.y < L + r + 1.0) {
      float tau = max(Q.y, 0.0), amp = 0.42 * exp(-tau / 6.5) * step(tau, 40.0), cw = cos(tau * 6.2831853 / 0.72), px = 1.0 / uRS;
      // chrome: the room above its horizon, light; the dark below it, and the warm desk low down; a highlight, a glint
      vec3 sky = mix(vec3(0.52, 0.49, 0.34), vec3(0.62, 0.48, 0.68), uView), sky2 = mix(vec3(0.27, 0.25, 0.17), vec3(0.3, 0.2, 0.38), uView);
      vec3 low = mix(vec3(0.06, 0.06, 0.035), vec3(0.07, 0.04, 0.1), uView), desk = mix(vec3(0.24, 0.21, 0.12), vec3(0.55, 0.26, 0.2), uView);
      vec3 rim = mix(vec3(0.03, 0.03, 0.02), vec3(0.04, 0.025, 0.07), uView), hi = mix(vec3(0.95, 0.92, 0.75), vec3(1.0, 0.94, 0.92), uView);
      vec3 glint = mix(vec3(0.62, 0.52, 0.3), vec3(1.0, 0.55, 0.32), uView), thread = mix(vec3(0.5, 0.47, 0.36), vec3(0.72, 0.62, 0.78), uView);
      for (int i = 0; i < 5; i++) {
        // the end let go swings out on one half of each swing, the other end on the other half
        float th = 0.0;
        if (i == (Q.z > 0.0 ? 4 : 0)) th = Q.z * amp * max(cw, 0.0);
        if (i == (Q.z > 0.0 ? 0 : 4)) th = Q.z * amp * min(cw, 0.0);
        vec2 pv = vec2(gap * float(i), 0.0), cb = pv + L * vec2(sin(th), cos(th)), q = o - cb;
        c = mix(c, thread, cover(segAt(o, pv, cb - normalize(cb - pv) * r * 0.9), 0.2, px) * 0.85);
        float dd = length(q), cov = clamp((r - dd) / px + 0.5, 0.0, 1.0);
        if (cov <= 0.0) continue;
        vec2 n = q / r;
        float edge = 0.08 / r;
        vec3 col = n.y < 0.06 ? mix(sky, sky2, smoothstep(-0.9, 0.06, n.y)) : mix(low, desk, smoothstep(0.35, 0.95, n.y));
        col = mix(col, low, smoothstep(0.06 - edge, 0.06 + edge, n.y) * (1.0 - smoothstep(0.06, 0.2, n.y)) * 0.6);
        col = mix(col, rim, smoothstep(0.8, 0.97, dd / r));
        col = mix(col, hi, smoothstep(0.24, 0.14, length((n - vec2(-0.34, -0.42)) * vec2(1.0, 1.4))));
        col = mix(col, glint, smoothstep(0.16, 0.06, length(n - vec2(0.62, 0.1))) * 0.85);
        c = mix(c, col, cov);
      }
    }
  }
  // the lift's displays: where it is, its floor in figures, an arrow while it goes up or down
  for (int i = 0; i < 4; i++) {
    if (i >= uNInd) break;
    vec4 B = uInd[i * 4], F = uInd[i * 4 + 1];
    vec2 q = w - B.xy;
    if (q.x < 0.0 || q.y < 0.0 || q.x > B.z || q.y > B.w || isActor(g3.a) > 0.5) continue;
    float px = 1.0 / uRS, ch = B.w * 0.78, dw = ch * 0.52, gap = ch * 0.2, aw = ch * 0.5;
    vec2 o0 = vec2((B.z - (aw + gap + dw * 2.0 + gap)) * 0.5, (B.w - ch) * 0.5);
    float on = figure(q - o0 - vec2(aw + gap, 0.0), dw, ch, int(F.x + 0.5), px);
    on = max(on, figure(q - o0 - vec2(aw + gap * 2.0 + dw, 0.0), dw, ch, int(F.y + 0.5), px));
    if (abs(F.z) > 0.5) {
      // its arrow: up, or down
      vec2 a = (q - o0) / vec2(aw, ch);
      if (F.z < 0.0) a.y = 1.0 - a.y;
      float e = max(max((abs(a.x - 0.5) - (a.y - 0.2) * 0.5) * aw, (0.2 - a.y) * ch), (a.y - 0.8) * ch);
      on = max(on, clamp(0.5 - e / px, 0.0, 1.0));
    }
    vec4 R = uInd[i * 4 + 2], C = uInd[i * 4 + 3];
    c = mix(c, mix(R.rgb, C.rgb, uView), on);
  }
  // a camera on a wall: its bracket, its body turned slowly to follow her, its lens, a red light blinking now and then
  for (int i = 0; i < 2; i++) {
    if (i >= uNWatch) break;
    vec4 K = uWatch[i];
    vec2 q = w - K.xy;
    float s = K.z, px = 1.0 / uRS;
    if (dot(q, q) > 160.0 * s * s || isActor(g3.a) > 0.5) continue;
    vec2 dir = vec2(cos(K.w), sin(K.w)), up = vec2(dir.y, -dir.x);
    if (up.y > 0.0) up = -up;
    vec2 pivot = vec2(0.0, 3.0 * s), front = pivot + dir * 6.5 * s;
    float arm = segAt(q, vec2(0.0), pivot) - 0.8 * s, body = segAt(q, pivot - dir * 1.8 * s, front) - 2.1 * s, lens = length(q - front) - 1.3 * s;
    float led = length(q - (pivot + dir * 0.5 * s + up * 2.4 * s)) - 0.55 * s, blink = step(fract(uTime / 1.7), 0.07);
    vec3 grey = dot(q - pivot, up) > 0.0 ? vec3(0.42, 0.42, 0.38) : vec3(0.24, 0.24, 0.21);
    c = mix(c, vec3(0.16, 0.16, 0.15), clamp(0.5 - arm / px, 0.0, 1.0));
    c = mix(c, grey, clamp(0.5 - body / px, 0.0, 1.0));
    c = mix(c, vec3(0.03), clamp(0.5 - lens / px, 0.0, 1.0));
    c = mix(c, vec3(0.7), clamp(0.5 - (length(q - front - up * 0.5 * s) - 0.35 * s) / px, 0.0, 1.0) * 0.8);
    c = mix(c, mix(vec3(0.3, 0.05, 0.04), vec3(1.6, 0.25, 0.15), blink), clamp(0.5 - led / px, 0.0, 1.0));
  }
  // air from an outlet a while after its spot was used: warm streaks going down and spreading. It roars in raw view;
  // in the Concierge's it only whispers
  for (int i = 0; i < 2; i++) {
    if (i >= uNAir) break;
    vec4 A = uAir[i];
    float since = A.w;
    vec2 q = w - A.xy;
    float v = q.y / 34.0, hw = A.z * 0.5 * (1.0 + 0.8 * v), u = q.x / hw;
    if (since < 0.0 || since > 2.8 || v < 0.0 || v > 1.0 || abs(u) > 1.0 || isActor(g3.a) > 0.5) continue;
    float on = smoothstep(0.0, 0.25, since) * (1.0 - smoothstep(2.0, 2.8, since)), lane = floor((u + 1.0) * 5.0);
    float streak = smoothstep(0.5, 0.95, sin(q.y * 0.32 - since * 16.0 + hash(vec2(lane, 3.0)) * 6.28)) * (1.0 - abs(fract((u + 1.0) * 5.0) - 0.5) * 2.0);
    c += vec3(0.95, 0.9, 0.82) * streak * (1.0 - v) * (1.0 - abs(u) * 0.6) * on * mix(0.34, 0.14, uView);
  }
  // a hologram of three rings, each with a gap, floating over its emitter: a faint beam up from it, the light
  // flickering and scanned. Its gaps lined up, it chimes in a flash and opens into a flower of light, turning slowly
  if (uRings[0].w > 0.5 && isActor(g3.a) < 0.5) {
    vec4 H = uRings[0], T = uRings[1];
    vec2 q = w - H.xy;
    float R = H.z, px = 1.0 / uRS, dq = length(q), since = T.w, solved = step(0.0, since);
    if (dq < R * 1.5 || (abs(q.x) < R * 0.6 && q.y > 0.0 && q.y < R * 1.9)) {
      float glow = 0.0, spin = solved * since * 0.35;
      for (int k = 0; k < 3; k++) {
        float rr = R * (0.42 + 0.29 * float(k)), turn = (k == 0 ? T.x : k == 1 ? T.y : T.z) + spin;
        float a = mod(atan(q.x, -q.y) - turn + 3.14159265, 6.2831853) - 3.14159265;
        float ring = smoothstep(0.36, 0.48, abs(a)), d = abs(dq - rr);
        glow += (cover(d, 0.7, px) * 0.6 + exp(-d * d / 5.0) * 0.22) * ring;
      }
      // the beam, widening up from the emitter on the surface below, and the emitter's spark
      float base = R * 1.75, up = clamp((base - q.y) / (base - R * 0.2), 0.0, 1.0), wide = R * (0.1 + 0.5 * up);
      if (q.y > R * 0.2 && q.y < base) glow += (1.0 - smoothstep(wide * 0.5, wide, abs(q.x))) * 0.07 * (1.0 - up * 0.6);
      glow += exp(-dot(q - vec2(0.0, base), q - vec2(0.0, base)) / 3.0) * 0.8;
      if (solved > 0.5) {
        // the flower: six petals opening from the middle; the chime's flash
        float open = smoothstep(0.0, 1.2, since), ang = atan(q.x, -q.y) + since * 0.35;
        float pr = R * 0.33 * open * (0.72 + 0.28 * cos(6.0 * ang));
        glow += smoothstep(pr + 0.8, pr - 0.8, dq) * 0.4 * open + exp(-since * 2.5) * exp(-dq * dq / (R * R)) * 0.9;
      }
      float live = (0.9 + 0.1 * sin(uTime * 23.0) * sin(uTime * 3.1)) * (0.88 + 0.12 * sin((w.y - uTime * 14.0) * 2.2));
      c += vec3(0.3, 0.82, 1.0) * glow * live * (0.75 + 0.3 * solved);
    }
  }
  o = vec4(c, 1.0);
}`;

/* ---------- bloom, blur, depth of field, streaks ---------- */

/**
 * What glows bright enough to bloom, at a quarter of the level's size: every pixel of the picture under each of its
 * pixels, four by four level pixels, each weighed against the threshold on its own and then averaged. A thin glowing
 * line, such as a door's lit frame, then keeps its glow as the camera slides it across the screen: sampling only some of
 * the pixels, it was caught in one frame and missed in the next; weighing averages of two by two against the threshold,
 * it lost more of its glow straddling two of them than lying in one, and its glow still flickered.
 */
export const BRIGHT_FS = HEAD + `
uniform sampler2D tSrc; uniform vec2 uSrcRes; uniform float uStep;
vec3 br(vec3 c) { return c * smoothstep(0.75, 1.6, lum(c)); }
void main() {
  int n = int(uStep * 4.0 + 0.5); ivec2 base = ivec2(floor(gl_FragCoord.xy)) * n; vec3 s = vec3(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) { if (i >= n || j >= n) continue; s += br(texelFetch(tSrc, base + ivec2(i, j), 0).rgb); }
  o = vec4(s / float(n * n), 1.0);
}`;

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

/**
 * The set for its reflections, at half the level's resolution: every pixel of the picture under each of its pixels (two
 * by two level pixels, four by four at a render scale of 2), premultiplied by how much of it is set. The people are left
 * out (they are mirrored around their own feet), unless uPeople is 1: then they are smudged into it with the set.
 */
export const REFLDOWN_FS = HEAD + `
uniform sampler2D tSrc, tG3; uniform vec2 uSrcRes; uniform float uStep, uPeople;
void main() { int n = int(uStep + 0.5); vec2 base = floor(gl_FragCoord.xy) * uStep; vec4 acc = vec4(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) { if (i >= n || j >= n) continue; vec2 q = (base + vec2(float(i), float(j)) + 0.5) / uSrcRes;
    float w = max(uPeople, 1.0 - isActor(texture(tG3, q).a)); acc += vec4(texture(tSrc, q).rgb * w, w); }
  o = acc / float(n * n); }`;

/**
 * A wide Gaussian blur along uDir, sigma uSigma in this target's pixels, in one pass: taps a pixel apart up to a sigma of
 * 8, further apart beyond, out to three sigmas. For smudging reflections, where the shared blur would take many passes.
 */
export const GAUSS_FS = HEAD + `
uniform sampler2D tSrc; uniform vec2 uDir; uniform float uSigma;
void main() { vec2 uv = gl_FragCoord.xy / uRes; vec4 s = texture(tSrc, uv); float ws = 1.0, st = max(1.0, uSigma / 8.0);
  for (int i = 1; i <= 24; i++) { float x = float(i) * st; if (x > 3.0 * uSigma) break; float w = exp(-0.5 * x * x / (uSigma * uSigma)); vec2 off = uDir * x / uRes;
    s += (texture(tSrc, uv + off) + texture(tSrc, uv - off)) * w; ws += 2.0 * w; }
  o = s / ws; }`;

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
uniform float uGradeK;   // the built-in grade, 1; 0 for a painted scene
// each source pixel stays a crisp block at any size, with one anti-aliased device pixel at its edges
// the image's own pixels, each a crisp square with a soft edge one screen pixel wide: at a render scale of 2 they are
// half a level pixel
vec3 sharpT(vec2 p) { vec2 b = p * uRS; float s = max(1.0, uOut.x / (uRes.x * uRS)); vec2 q = floor(b) + 0.5 + clamp((fract(b) - 0.5) * s, -0.5, 0.5); return T(tB, q / uRS).rgb; }
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
  // the film curve, or for a painted scene (uGradeK 0) its colours as painted, with a soft shoulder over the light added
  vec3 ex = c * exp2(uLookC.x), sh = mix(ex, 0.8 + 0.2 * (1.0 - exp(-(ex - 0.8) / 0.2)), step(0.8, ex));
  c = mix(sh, aces(ex * 1.32), uGradeK);
  float l = lum(c);
  // Concierge view: cool shadows, warm highlights. Raw view: a neutral grade, its cold things and yellow-green air are already in the image.
  // A painted scene's colours are final already: the grade is left out (uGradeK 0)
  c = mix(c, c * mix(vec3(0.84, 0.95, 1.12), vec3(1.0), raw) + vec3(0.0, 0.005, 0.012) * uView, (1.0 - smoothstep(0.0, 0.45, l)) * 0.7 * uGradeK);
  c = mix(c, c * mix(vec3(1.07, 1.0, 0.9), vec3(0.97, 1.0, 1.04), raw), smoothstep(0.45, 1.0, l) * 0.4 * uGradeK);
  l = lum(c);
  c = mix(vec3(l), c, mix(1.0, mix(mix(0.72, 0.95, raw), 1.05, smoothstep(0.45, 0.95, l)), uGradeK));
  c *= max(0.0, 1.0 - 0.36 * pow(r2, 1.3) * uLookF.y);
  if (nerve > 0.0) c = mix(c, vec3(lum(c)), 0.5 * nerve) * (1.0 - nerve * (0.55 + 0.4 * smoothstep(0.1, 0.9, r2)));
  c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.15 * uGradeK);
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
