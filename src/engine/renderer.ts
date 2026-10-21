// The 2D deferred renderer: sprites into a G-buffer, then lighting, composite, bloom and the final grade.

import { smoothSampled, type GroundDef, type LightDef, type MapName, type Sprite } from './assets';
import { defaultLookSet, lookFor, type Look, type LookSet } from './look';
import { createGeometry, createProgram, createTarget, deleteTarget, solidTexture, type GL, type Program, type Target } from './gl';
import * as S from './shaders';

export const NW = 960;
export const NH = 540;

export type Tier = 'low' | 'medium' | 'high';

export interface Quality {
  tier: Tier;
  /**
   * Render scale: image pixels per level pixel. The level is always 960 by 540; at 2 the set, the characters and their
   * light are rendered at 1920 by 1080, so a screen that big shows art drawn at that size as crisp as it was drawn.
   */
  scale: number;
  maxLights: number;
  shadows: boolean;
  ao: boolean;
  dof: boolean;
  streaks: boolean;
  godrays: boolean;
}

export const QUALITY: Record<Tier, Quality> = {
  low: { tier: 'low', scale: 1, maxLights: 10, shadows: false, ao: false, dof: false, streaks: false, godrays: false },
  medium: { tier: 'medium', scale: 1, maxLights: 18, shadows: true, ao: true, dof: false, streaks: false, godrays: true },
  high: { tier: 'high', scale: 2, maxLights: S.MAX_LIGHTS, shadows: true, ao: true, dof: true, streaks: true, godrays: true },
};

/** Match the canvas to the device pixels it covers, so the sharp upscale has real pixels to work with. */
export function fitCanvas(canvas: HTMLCanvasElement): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(NW, Math.min(3840, Math.round(canvas.clientWidth * dpr)));
  const h = Math.round((w * NH) / NW);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

export interface DrawSprite {
  sprite: Sprite;
  /** Top-left corner on screen, in native pixels, after camera and parallax. */
  x: number;
  y: number;
  /** Mirror horizontally (a character facing the other way). */
  flip?: boolean;
  /** Which animation frame, for sprites that have frames. */
  frame?: number;
  /** Drawn at this size, 1 as built: a character in a scene seen from further back, or closer. */
  scale?: number;
  /** Only drawn between these x on screen: something that comes out from behind one thing and goes behind another. */
  clip?: [number, number];
  /**
   * A flat layer over flat layers behind it: its edges blend by how much of each pixel it covers, so they move smoothly
   * by fractions of a pixel instead of jumping a whole one. Only for art without a meta map drawn over art that has
   * already set the flags its pixels share (the scene runner decides).
   */
  blend?: boolean;
}

export interface Frame {
  t: number;
  /** 0 raw view, 1 Concierge view. */
  view: number;
  glitch: number;
  cam: [number, number];
  level: [number, number];
  zone: WebGLTexture;
  sprites: DrawSprite[];
  lights: LightDef[];
  /** Intensity per light group (index = group). */
  gi: number[];
  cars: Float32Array;
  nCars: number;
  /** Movers' streaks of light: x, y where each starts, its length signed by the way it trails, the deepest layer it shows on (0 to 1); and its colour and half its width. */
  trails?: Float32Array;
  trailColours?: Float32Array;
  nTrails?: number;
  beacons: Float32Array;
  nBeacons: number;
  steam: Float32Array;
  /** 1 for each steam emitter on a far layer: drawn only where that layer shows. */
  steamFar?: Float32Array;
  godrays: Float32Array;
  drips: [number, number, number, number];
  mirror: number;
  /** The ground the engine draws below the reflection line, if the scene has one. */
  ground?: GroundDef;
  /** The scene's ambient light, over the look's: 1 by default. */
  ambient?: number;
  /** The scene's exposure in stops, over the look's: 0 by default. */
  exposure?: number;
  /** How much of the set's light is painted into its art: 0 lit by the lights alone, 1 shown as painted. */
  baked?: number;
  /** Shadows on the ground under the characters: x and y of the feet on screen, half-width, unused; up to 8. */
  shadows?: Float32Array;
  nShadows?: number;
}

/** Reflections smudged at least this far sideways (the look's pixels) are a glossy floor: the people are smudged in too. */
const GLOSSY = 16;
/** No steam emitter on a far layer. */
const NO_FAR = new Float32Array(4);
/** No movers' trails. */
const NO_TRAILS = new Float32Array(16);

const MAP_ORDER: [MapName, string][] = [
  ['albedo.raw', 'tAlbR'], ['albedo.concierge', 'tAlbC'], ['normal', 'tNrm'], ['normal.concierge', 'tNrmC'], ['material', 'tMat'],
  ['material.concierge', 'tMatC'], ['meta', 'tMeta'], ['glow.raw', 'tGlowR'], ['glow.concierge', 'tGlowC'],
];

export class Renderer {
  readonly gl: GL;
  private geo: ReturnType<typeof createGeometry>;
  private prog: Record<'sprite' | 'occ' | 'light' | 'comp' | 'bright' | 'blur' | 'gauss' | 'dofdown' | 'refldown' | 'streak' | 'final', Program>;
  private t: Record<'gbuf' | 'ao1' | 'ao2' | 'fa' | 'fb' | 'd1' | 'd2' | 'r1' | 'r2' | 'r3' | 'r4' | 'q1' | 'q2' | 'e1' | 'e2' | 'a1' | 'a2', Target>;
  private black: WebGLTexture;
  private q!: Quality;
  /** Image pixels per level pixel for the full-size images: the quality's render scale. */
  private rs = 1;
  get quality(): Quality { return this.q; }
  /** A tier with another render scale makes the full-size images again at its size. */
  set quality(q: Quality) {
    this.q = q;
    if (this.t && q.scale !== this.rs) this.makeFull(q.scale);
  }
  /** The look in each view: pixels, light, characters, colour and film, changed live by the look panel. */
  private looks: { raw: Look; concierge: Look } = { raw: lookFor(defaultLookSet(), 'raw'), concierge: lookFor(defaultLookSet(), 'concierge') };

  setLook(set: LookSet): void {
    this.looks = { raw: lookFor(set, 'raw'), concierge: lookFor(set, 'concierge') };
  }

  constructor(private canvas: HTMLCanvasElement, quality: Quality) {
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL 2 is not available');
    if ((gl.getParameter(gl.MAX_DRAW_BUFFERS) as number) < 4) throw new Error('this GPU cannot write four render targets at once');
    this.gl = gl;
    this.q = quality;
    this.geo = createGeometry(gl);
    this.prog = {
      sprite: createProgram(gl, S.SPRITE_FS, S.SPRITE_VS),
      occ: createProgram(gl, S.OCC_FS),
      light: createProgram(gl, S.LIGHT_FS),
      comp: createProgram(gl, S.COMP_FS),
      bright: createProgram(gl, S.BRIGHT_FS),
      blur: createProgram(gl, S.BLUR_FS),
      dofdown: createProgram(gl, S.DOFDOWN_FS),
      refldown: createProgram(gl, S.REFLDOWN_FS),
      gauss: createProgram(gl, S.GAUSS_FS),
      streak: createProgram(gl, S.STREAK_FS),
      final: createProgram(gl, S.FINAL_FS),
    };
    // the blurred images (ambient occlusion, depth of field, bloom, streaks) stay at the level's size: they gain nothing
    // from more pixels. The full-size ones follow the render scale
    const half = { w: NW >> 1, h: NH >> 1 }, quarter = { w: NW >> 2, h: NH >> 2 }, eighth = { w: NW >> 3, h: NH >> 3 };
    this.rs = quality.scale;
    this.t = {
      ...this.fullTargets(this.rs),
      ao1: createTarget(gl, half.w, half.h), ao2: createTarget(gl, half.w, half.h),
      d1: createTarget(gl, half.w, half.h, { format: 'hdr' }), d2: createTarget(gl, half.w, half.h, { format: 'hdr' }),
      r1: createTarget(gl, half.w, half.h, { format: 'hdr' }), r2: createTarget(gl, half.w, half.h, { format: 'hdr' }),
      r3: createTarget(gl, half.w, half.h, { format: 'hdr' }), r4: createTarget(gl, half.w, half.h, { format: 'hdr' }),
      q1: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }), q2: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }),
      e1: createTarget(gl, eighth.w, eighth.h, { format: 'hdr' }), e2: createTarget(gl, eighth.w, eighth.h, { format: 'hdr' }),
      a1: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }), a2: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }),
    };
    this.black = solidTexture(gl, [0, 0, 0, 0]);
  }

  private fullTargets(s: number) {
    const gl = this.gl, w = NW * s, h = NH * s;
    return {
      gbuf: createTarget(gl, w, h, { count: 4, nearest: true }),
      fa: createTarget(gl, w, h, { format: 'hdr', nearest: true }), fb: createTarget(gl, w, h, { format: 'hdr' }),
    };
  }

  private makeFull(s: number): void {
    for (const k of ['gbuf', 'fa', 'fb'] as const) deleteTarget(this.gl, this.t[k]);
    Object.assign(this.t, this.fullTargets(s));
    this.rs = s;
  }

  private bind(pr: Program, name: string, tex: WebGLTexture, unit: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (pr.u[name]) gl.uniform1i(pr.u[name], unit);
  }

  /** Run a fullscreen pass into a target (or the canvas when target is null). */
  private pass(pr: Program, target: Target | null, setup: (pr: Program) => void): void {
    const gl = this.gl;
    gl.useProgram(pr.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    if (target) gl.viewport(0, 0, target.w, target.h);
    else {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (pr.u.uOut) gl.uniform2f(pr.u.uOut, this.canvas.width, this.canvas.height);
    }
    // a full-size pass works in level pixels whatever its image's size: uRes is the level's size, uRS image pixels per
    // level pixel. A smaller image's pass works in its own pixels
    const full = !target || target.w === NW * this.rs;
    if (pr.u.uRes) gl.uniform2f(pr.u.uRes, full ? NW : target!.w, full ? NH : target!.h);
    if (pr.u.uRS) gl.uniform1f(pr.u.uRS, full ? this.rs : 1);
    setup(pr);
    gl.bindVertexArray(this.geo.full);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private zoneUniforms(pr: Program, f: Frame, unit: number): void {
    const gl = this.gl;
    this.bind(pr, 'tZone', f.zone, unit);
    if (pr.u.uCam) gl.uniform2f(pr.u.uCam, f.cam[0], f.cam[1]);
    if (pr.u.uLevel) gl.uniform2f(pr.u.uLevel, f.level[0], f.level[1]);
  }

  /** Pick the lights that matter most on screen, up to the tier's budget. */
  private cullLights(f: Frame): LightDef[] {
    const [cx, cy] = f.cam;
    const visible = f.lights.filter((l) => l.x + l.r > cx && l.x - l.r < cx + NW && l.y + l.r > cy && l.y - l.r < cy + NH && !(l.ar && f.view < 0.5) && !(l.raw && f.view > 0.5));
    if (visible.length <= this.quality.maxLights) return visible;
    return [...visible].sort((a, b) => b.i * b.r - a.i * a.r).slice(0, this.quality.maxLights);
  }

  /**
   * The lighting view, for the scene editor: every surface a flat grey and nothing painted kept, so all that shows is
   * what the lights do, their glow in the air and the effects.
   */
  lightView = false;

  render(f: Frame): void {
    const gl = this.gl, q = this.quality, t = this.t, k = f.view >= 0.5 ? this.looks.concierge : this.looks.raw;
    const baked = this.lightView ? 0 : f.baked ?? 0;
    gl.disable(gl.BLEND);

    // G-buffer: sprites back to front, alpha-tested
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.gbuf.fb);
    gl.viewport(0, 0, t.gbuf.w, t.gbuf.h);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 2, [0, 0, 0, 0]);
    // alpha: the air in front of each pixel, 1 where nothing is drawn
    gl.clearBufferfv(gl.COLOR, 3, [0, 0, 0, 1]);
    const sp = this.prog.sprite;
    gl.useProgram(sp.p);
    gl.uniform2f(sp.u.uScreen, NW, NH);
    gl.uniform1f(sp.u.uView, f.view);
    gl.bindVertexArray(this.geo.quad);
    for (const d of f.sprites) {
      const s = d.sprite, def = s.def, sc = d.scale ?? 1, dw = def.w * sc, dh = def.h * sc;
      // pixel art on whole pixels of the buffer, to stay crisp; smoothly sampled art anywhere, so a slow camera glides
      const snap = !smoothSampled(def), x = snap ? Math.round(d.x * this.rs) / this.rs : d.x, y = snap ? Math.round(d.y * this.rs) / this.rs : d.y;
      if (x > NW || y > NH || x + dw < 0 || y + dh < 0) continue;
      MAP_ORDER.forEach(([m, u], i) => this.bind(sp, u, s.tex[m], i));
      gl.uniform4f(sp.u.uRect, x, y, dw, dh);
      // texels per pixel of the buffer: past about one, several samples per pixel keep it from sparkling
      const dens = ((def.res ?? 1) * (s.texScale ?? 1)) / (sc * this.rs);
      gl.uniform1f(sp.u.uSS, dens > 1.11 ? Math.min(4, Math.ceil(1.5 * dens)) : 1);
      gl.uniform1f(sp.u.uFlip, d.flip ? 1 : 0);
      gl.uniform1f(sp.u.uBlend, d.blend ? 1 : 0);
      // the frame's place in the texture: frames run in rows of `cols`, with a gutter of g texels between them
      const fr = def.frames, fi = fr ? Math.max(0, Math.min(fr.count - 1, d.frame ?? 0)) : 0, g = fr?.gutter ?? 0;
      const cols = fr ? Math.min(fr.count, fr.cols ?? fr.count) : 1, rows = fr ? Math.ceil(fr.count / cols) : 1;
      const [tw, th] = s.size, fw = (tw - (cols - 1) * g) / cols, fh = (th - (rows - 1) * g) / rows;
      gl.uniform4f(sp.u.uUV, ((fi % cols) * (fw + g)) / tw, fw / tw, (Math.floor(fi / cols) * (fh + g)) / th, fh / th);
      gl.uniform1f(sp.u.uHasMeta, s.hasMeta ? 1 : 0);
      // a character stands in front of the set: lights behind it rim it, and the set's glow mostly stays behind it
      gl.uniform1f(sp.u.uHaze, (def.actor ?? def.kind === 'character') || def.lit ? (def.haze ?? k.charGlow) : -1);
      // where wet ground mirrors it: its feet, as they are in this frame (lifted off the ground in a run's flight)
      gl.uniform1f(sp.u.uFoot, Math.min(1, Math.max(0, (y + dh - (fr?.lifts?.[fi] ?? 0) * sc) / NH)));
      gl.uniform4f(sp.u.uConst, def.occluder ?? 0, def.depth, def.reflectivity ?? 0, def.object ?? 0);
      gl.uniform3f(sp.u.uConstG, def.groupRaw ?? 0, def.groupConcierge ?? 0, def.machine ?? 0);
      if (d.clip) {
        const c0 = Math.max(0, Math.floor(d.clip[0] * this.rs)), c1 = Math.min(t.gbuf.w, Math.ceil(d.clip[1] * this.rs));
        if (c1 <= c0) continue;
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(c0, 0, c1 - c0, t.gbuf.h);
      }
      if (d.blend) { gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (d.blend) gl.disable(gl.BLEND);
      if (d.clip) gl.disable(gl.SCISSOR_TEST);
    }

    // ambient occlusion from the occluders
    let ao = this.black;
    if (q.ao) {
      this.pass(this.prog.occ, t.ao1, (pr) => { this.bind(pr, 'tG0', t.gbuf.tex[0], 0); gl.uniform2f(pr.u.uSrcRes, NW * this.rs, NH * this.rs); gl.uniform1f(pr.u.uStep, this.rs); });
      this.pass(this.prog.blur, t.ao2, (pr) => { this.bind(pr, 'tSrc', t.ao1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
      this.pass(this.prog.blur, t.ao1, (pr) => { this.bind(pr, 'tSrc', t.ao2.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); });
      ao = t.ao1.tex[0];
    }

    // lighting
    const lights = this.cullLights(f), M = S.MAX_LIGHTS;
    const LP = new Float32Array(M * 4), LC = new Float32Array(M * 4), LK = new Float32Array(M * 4), LG = new Float32Array(M * 4);
    lights.forEach((l, i) => {
      LP.set([l.x, l.y, l.z, l.r], i * 4);
      LC.set([l.c[0] * l.i, l.c[1] * l.i, l.c[2] * l.i, l.zone], i * 4);
      LK.set([...(l.cone ?? [0, 0, -2]), (l.shadow ? 1 : 0) + 2 * (l.ex ?? 0)], i * 4);
      // layer against the characters: set lights are behind them unless the light says it hangs among them or in front
      const layer = l.layer ?? 0;
      LG.set([l.g ?? 0, (l.ar ? 1 : 0) + (l.machine ? 2 : 0) + 4 * layer + (l.raw ? 16 : 0) + (l.own ? 32 : 0), l.wrap ?? 0.3, l.haze ?? 0], i * 4);
    });
    this.pass(this.prog.light, t.fa, (pr) => {
      t.gbuf.tex.forEach((tx, i) => this.bind(pr, `tG${i}`, tx, i));
      this.bind(pr, 'tAO', ao, 4);
      this.zoneUniforms(pr, f, 5);
      gl.uniform4fv(pr.u.uLP, LP); gl.uniform4fv(pr.u.uLC, LC); gl.uniform4fv(pr.u.uLK, LK); gl.uniform4fv(pr.u.uLG, LG);
      gl.uniform1i(pr.u.uNL, lights.length);
      const gi = new Float32Array(16); gi.set(f.gi.slice(0, 16));
      gl.uniform1fv(pr.u.uGI, gi);
      gl.uniform1f(pr.u.uView, f.view); gl.uniform1f(pr.u.uTime, f.t); gl.uniform1f(pr.u.uShadows, q.shadows ? 1 : 0);
      gl.uniform4fv(pr.u.uCars, f.cars); gl.uniform1i(pr.u.uNC, f.nCars);
      gl.uniform4fv(pr.u.uTrail, f.trails ?? NO_TRAILS); gl.uniform4fv(pr.u.uTrailC, f.trailColours ?? NO_TRAILS); gl.uniform1i(pr.u.uNT, f.nTrails ?? 0);
      gl.uniform4fv(pr.u.uBeac, f.beacons); gl.uniform1i(pr.u.uNB, f.nBeacons);
      gl.uniform4f(pr.u.uLookL, k.lights, k.ambient * (f.ambient ?? 1), k.haze, k.glow);
      gl.uniform1f(pr.u.uPower, k.power);
      gl.uniform1f(pr.u.uGround, f.mirror);
      gl.uniform4f(pr.u.uFloor, f.ground ? 1 : 0, k.groundPaint, k.groundTone, f.ground?.horizon ?? 0);
      gl.uniform1f(pr.u.uFill, k.charFill); gl.uniform1f(pr.u.uRim, k.charRim); gl.uniform1f(pr.u.uRawColour, k.rawColour); gl.uniform1f(pr.u.uBaked, baked); gl.uniform1f(pr.u.uLightView, this.lightView ? 1 : 0); gl.uniform1f(pr.u.uPaint, k.ambient);
      gl.uniform4f(pr.u.uActorLight, k.actorRed, k.actorGreen, k.actorBlue, k.actorPaint);
      gl.uniform4fv(pr.u.uSh, f.shadows ?? new Float32Array(32)); gl.uniform1i(pr.u.uNSh, f.nShadows ?? 0); gl.uniform1f(pr.u.uShadowK, k.charShadow);
    });

    // depth of field: background-only blur at half resolution
    const dof = q.dof && k.depthOfField > 0.5;
    if (dof) {
      this.pass(this.prog.dofdown, t.d1, (pr) => { this.bind(pr, 'tSrc', t.fa.tex[0], 0); this.bind(pr, 'tG3', t.gbuf.tex[3], 1); gl.uniform2f(pr.u.uSrcRes, NW, NH); });
      for (let n = 0; n < 2; n++) {
        this.pass(this.prog.blur, t.d2, (pr) => { this.bind(pr, 'tSrc', t.d1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
        this.pass(this.prog.blur, t.d1, (pr) => { this.bind(pr, 'tSrc', t.d2.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); });
      }
    }

    // the set for its reflections, softened at half resolution: sideways for diffuse ones (a glossy floor), up and down for
    // streaks (a wet street), each a Gaussian whose spread is half the look's pixels. Smudged far enough sideways, the
    // floor is glossy: the people are smudged into it with everything else instead of mirrored on their own
    const reflBlur = k.mirrorSet > 0 && (k.reflectStreak > 0 || k.reflectDiffuse > 0), smudge = reflBlur && k.reflectDiffuse >= GLOSSY;
    let refl = t.r1;
    const fade = reflBlur && k.reflectFade > 0;
    if (reflBlur) {
      this.pass(this.prog.refldown, t.r1, (pr) => {
        this.bind(pr, 'tSrc', t.fa.tex[0], 0); this.bind(pr, 'tG3', t.gbuf.tex[3], 1);
        gl.uniform2f(pr.u.uSrcRes, NW * this.rs, NH * this.rs); gl.uniform1f(pr.u.uStep, 2 * this.rs); gl.uniform1f(pr.u.uPeople, smudge ? 1 : 0);
      });
      // where things touch a glossy floor their reflection is sharp, softening away from them: a copy barely softened,
      // a sixth as far, for the composite to go from
      if (fade) {
        this.pass(this.prog.gauss, t.r3, (pr) => { this.bind(pr, 'tSrc', t.r1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); gl.uniform1f(pr.u.uSigma, k.reflectDiffuse / 24); });
        this.pass(this.prog.gauss, t.r4, (pr) => { this.bind(pr, 'tSrc', t.r3.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); gl.uniform1f(pr.u.uSigma, k.reflectStreak / 24); });
      }
      let other = t.r2;
      for (const [px, dx, dy] of [[k.reflectDiffuse, 1, 0], [k.reflectStreak, 0, 1]] as const) {
        if (px < 1) continue;
        const from = refl;
        // half the look's pixels is the spread in level pixels, half again in this target's
        this.pass(this.prog.gauss, other, (pr) => { this.bind(pr, 'tSrc', from.tex[0], 0); gl.uniform2f(pr.u.uDir, dx, dy); gl.uniform1f(pr.u.uSigma, px / 4); });
        [refl, other] = [other, refl];
      }
    }

    // composite: reflections, steam, rain, drips
    this.pass(this.prog.comp, t.fb, (pr) => {
      this.bind(pr, 'tA', t.fa.tex[0], 0); this.bind(pr, 'tG3', t.gbuf.tex[3], 1); this.bind(pr, 'tDof', t.d1.tex[0], 2);
      this.bind(pr, 'tRefl', reflBlur ? refl.tex[0] : this.black, 7); gl.uniform1f(pr.u.uReflBlur, reflBlur ? 1 : 0);
      this.bind(pr, 'tReflNear', fade ? t.r4.tex[0] : this.black, 8); gl.uniform1f(pr.u.uReflFade, fade ? k.reflectFade : 0);
      this.zoneUniforms(pr, f, 3);
      gl.uniform1f(pr.u.uTime, f.t); gl.uniform1f(pr.u.uDof, dof ? 1 : 0); gl.uniform1f(pr.u.uView, f.view);
      gl.uniform4fv(pr.u.uSteam, f.steam); gl.uniform4fv(pr.u.uSteamFar, f.steamFar ?? NO_FAR); gl.uniform4f(pr.u.uDrips, ...f.drips); gl.uniform1f(pr.u.uMirror, f.mirror);
      gl.uniform1f(pr.u.uRawFog, k.rawFog); gl.uniform1f(pr.u.uWrap, k.charWrap); gl.uniform1f(pr.u.uRain, k.rain); gl.uniform1f(pr.u.uFog, k.fog); gl.uniform1f(pr.u.uBakedC, baked);
      gl.uniform4f(pr.u.uRefl, k.reflect, k.reflectReach, k.reflectStreak, k.mirrorSet);
      gl.uniform2f(pr.u.uReflSoft, k.reflectDiffuse, k.reflectStreak); gl.uniform1f(pr.u.uSmudge, smudge ? 1 : 0);
      const gd = f.ground;
      gl.uniform4f(pr.u.uGnd, gd?.horizon ?? 0, gd?.kerb ?? 0, gd?.puddles ?? 0, gd ? 1 : 0);
      gl.uniform2f(pr.u.uSlab, gd?.slab?.[0] ?? 0, gd?.slab?.[1] ?? 0);
      gl.uniform3f(pr.u.uState, k.wet, k.polish, k.wear);
    });

    // bloom at a quarter and an eighth of the resolution
    this.pass(this.prog.bright, t.q1, (pr) => { this.bind(pr, 'tSrc', t.fb.tex[0], 0); gl.uniform2f(pr.u.uSrcRes, NW * this.rs, NH * this.rs); gl.uniform1f(pr.u.uStep, this.rs); });
    this.pass(this.prog.blur, t.q2, (pr) => { this.bind(pr, 'tSrc', t.q1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
    this.pass(this.prog.blur, t.q1, (pr) => { this.bind(pr, 'tSrc', t.q2.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); });
    // the eighth: the quarter halved first, each of its pixels the average of the two by two under it (the blur, with no
    // direction, only copies), then blurred there. Blurring straight into the smaller image skipped some of the pixels it
    // halved, so the widest, faintest glow came and went as the camera slid
    this.pass(this.prog.blur, t.e1, (pr) => { this.bind(pr, 'tSrc', t.q1.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 0); });
    this.pass(this.prog.blur, t.e2, (pr) => { this.bind(pr, 'tSrc', t.e1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
    this.pass(this.prog.blur, t.e1, (pr) => { this.bind(pr, 'tSrc', t.e2.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); });

    // anamorphic streaks
    if (q.streaks) {
      const st = this.prog.streak;
      this.pass(st, t.a1, (pr) => { this.bind(pr, 'tSrc', t.q1.tex[0], 0); gl.uniform1f(pr.u.uStep, 1); gl.uniform1f(pr.u.uThr, 0.2); });
      this.pass(st, t.a2, (pr) => { this.bind(pr, 'tSrc', t.a1.tex[0], 0); gl.uniform1f(pr.u.uStep, 4); gl.uniform1f(pr.u.uThr, 0); });
      this.pass(st, t.a1, (pr) => { this.bind(pr, 'tSrc', t.a2.tex[0], 0); gl.uniform1f(pr.u.uStep, 14); gl.uniform1f(pr.u.uThr, 0); });
    }

    // final: sharp upscale to the canvas, light shafts, grade
    this.pass(this.prog.final, null, (pr) => {
      this.bind(pr, 'tB', t.fb.tex[0], 0); this.bind(pr, 'tBloom1', t.q1.tex[0], 1); this.bind(pr, 'tBloom2', t.e1.tex[0], 2); this.bind(pr, 'tStreak', t.a1.tex[0], 3);
      this.zoneUniforms(pr, f, 4);
      this.bind(pr, 'tG3', t.gbuf.tex[3], 5);
      gl.uniform1f(pr.u.uTime, f.t); gl.uniform1f(pr.u.uGlitch, f.glitch); gl.uniform1f(pr.u.uView, f.view);
      gl.uniform1f(pr.u.uStreaks, q.streaks ? 1 : 0);
      gl.uniform4fv(pr.u.uGR, q.godrays ? f.godrays : new Float32Array(16));
      gl.uniform4f(pr.u.uLookP, k.pixelSize, k.pixelShape, k.shapeAmount, k.colorLevels);
      gl.uniform4f(pr.u.uLookB, k.bloom, k.shafts, k.streaks, k.dither);
      gl.uniform4f(pr.u.uLookC, k.exposure + (f.exposure ?? 0), k.contrast, k.saturation, k.temperature);
      gl.uniform4f(pr.u.uLookF, k.tint, k.vignette, k.grain, k.aberration);
      gl.uniform1f(pr.u.uGradeK, 1 - baked);
    });
  }
}
