// The 2D deferred renderer: sprites into a G-buffer, then lighting, composite, bloom and the final grade.

import type { LightDef, MapName, Sprite } from './assets';
import { createGeometry, createProgram, createTarget, solidTexture, type GL, type Program, type Target } from './gl';
import * as S from './shaders';

export const NW = 960;
export const NH = 540;

export type Tier = 'low' | 'medium' | 'high';

export interface Quality {
  tier: Tier;
  maxLights: number;
  shadows: boolean;
  ao: boolean;
  dof: boolean;
  streaks: boolean;
  godrays: boolean;
}

export const QUALITY: Record<Tier, Quality> = {
  low: { tier: 'low', maxLights: 10, shadows: false, ao: false, dof: false, streaks: false, godrays: false },
  medium: { tier: 'medium', maxLights: 18, shadows: true, ao: true, dof: false, streaks: false, godrays: true },
  high: { tier: 'high', maxLights: S.MAX_LIGHTS, shadows: true, ao: true, dof: true, streaks: true, godrays: true },
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
  beacons: Float32Array;
  nBeacons: number;
  steam: Float32Array;
  godrays: Float32Array;
  drips: [number, number, number, number];
  mirror: number;
}

const MAP_ORDER: [MapName, string][] = [
  ['albedo.raw', 'tAlbR'], ['albedo.concierge', 'tAlbC'], ['normal', 'tNrm'], ['material', 'tMat'],
  ['meta', 'tMeta'], ['glow.raw', 'tGlowR'], ['glow.concierge', 'tGlowC'],
];

export class Renderer {
  readonly gl: GL;
  private geo: ReturnType<typeof createGeometry>;
  private prog: Record<'sprite' | 'occ' | 'light' | 'comp' | 'bright' | 'blur' | 'dofdown' | 'streak' | 'final', Program>;
  private t: Record<'gbuf' | 'ao1' | 'ao2' | 'fa' | 'fb' | 'd1' | 'd2' | 'q1' | 'q2' | 'e1' | 'e2' | 'a1' | 'a2', Target>;
  private black: WebGLTexture;
  quality: Quality;

  constructor(private canvas: HTMLCanvasElement, quality: Quality) {
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: false });
    if (!gl) throw new Error('WebGL 2 is not available');
    if ((gl.getParameter(gl.MAX_DRAW_BUFFERS) as number) < 4) throw new Error('this GPU cannot write four render targets at once');
    this.gl = gl;
    this.quality = quality;
    this.geo = createGeometry(gl);
    this.prog = {
      sprite: createProgram(gl, S.SPRITE_FS, S.SPRITE_VS),
      occ: createProgram(gl, S.OCC_FS),
      light: createProgram(gl, S.LIGHT_FS),
      comp: createProgram(gl, S.COMP_FS),
      bright: createProgram(gl, S.BRIGHT_FS),
      blur: createProgram(gl, S.BLUR_FS),
      dofdown: createProgram(gl, S.DOFDOWN_FS),
      streak: createProgram(gl, S.STREAK_FS),
      final: createProgram(gl, S.FINAL_FS),
    };
    const half = { w: NW >> 1, h: NH >> 1 }, quarter = { w: NW >> 2, h: NH >> 2 }, eighth = { w: NW >> 3, h: NH >> 3 };
    this.t = {
      gbuf: createTarget(gl, NW, NH, { count: 4, nearest: true }),
      ao1: createTarget(gl, half.w, half.h), ao2: createTarget(gl, half.w, half.h),
      fa: createTarget(gl, NW, NH, { format: 'hdr', nearest: true }), fb: createTarget(gl, NW, NH, { format: 'hdr' }),
      d1: createTarget(gl, half.w, half.h, { format: 'hdr' }), d2: createTarget(gl, half.w, half.h, { format: 'hdr' }),
      q1: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }), q2: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }),
      e1: createTarget(gl, eighth.w, eighth.h, { format: 'hdr' }), e2: createTarget(gl, eighth.w, eighth.h, { format: 'hdr' }),
      a1: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }), a2: createTarget(gl, quarter.w, quarter.h, { format: 'hdr' }),
    };
    this.black = solidTexture(gl, [0, 0, 0, 0]);
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
    const w = target ? target.w : NW, h = target ? target.h : NH;
    if (target) gl.viewport(0, 0, w, h);
    else {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      if (pr.u.uOut) gl.uniform2f(pr.u.uOut, this.canvas.width, this.canvas.height);
    }
    if (pr.u.uRes) gl.uniform2f(pr.u.uRes, w, h);
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
    const visible = f.lights.filter((l) => l.x + l.r > cx && l.x - l.r < cx + NW && l.y + l.r > cy && l.y - l.r < cy + NH && !(l.ar && f.view < 0.5));
    if (visible.length <= this.quality.maxLights) return visible;
    return [...visible].sort((a, b) => b.i * b.r - a.i * a.r).slice(0, this.quality.maxLights);
  }

  render(f: Frame): void {
    const gl = this.gl, q = this.quality, t = this.t;
    gl.disable(gl.BLEND);

    // G-buffer: sprites back to front, alpha-tested
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.gbuf.fb);
    gl.viewport(0, 0, NW, NH);
    gl.clearBufferfv(gl.COLOR, 0, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 1, [0.5, 0.5, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 2, [0, 0, 0, 0]);
    gl.clearBufferfv(gl.COLOR, 3, [0, 0, 0, 0]);
    const sp = this.prog.sprite;
    gl.useProgram(sp.p);
    gl.uniform2f(sp.u.uScreen, NW, NH);
    gl.uniform1f(sp.u.uView, f.view);
    gl.bindVertexArray(this.geo.quad);
    for (const d of f.sprites) {
      const s = d.sprite, def = s.def;
      if (d.x > NW || d.y > NH || d.x + def.w < 0 || d.y + def.h < 0) continue;
      MAP_ORDER.forEach(([m, u], i) => this.bind(sp, u, s.tex[m], i));
      gl.uniform4f(sp.u.uRect, d.x, d.y, def.w, def.h);
      gl.uniform1f(sp.u.uFlip, d.flip ? 1 : 0);
      gl.uniform1f(sp.u.uHasMeta, s.hasMeta ? 1 : 0);
      gl.uniform4f(sp.u.uConst, def.occluder ?? 0, def.depth, def.reflectivity ?? 0, def.object ?? 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // ambient occlusion from the occluders
    let ao = this.black;
    if (q.ao) {
      this.pass(this.prog.occ, t.ao1, (pr) => { this.bind(pr, 'tG0', t.gbuf.tex[0], 0); gl.uniform2f(pr.u.uSrcRes, NW, NH); });
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
      LG.set([l.g ?? 0, (l.ar ? 1 : 0) + (l.machine ? 2 : 0), l.wrap ?? 0.3, l.haze ?? 0], i * 4);
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
      gl.uniform4fv(pr.u.uBeac, f.beacons); gl.uniform1i(pr.u.uNB, f.nBeacons);
    });

    // depth of field: background-only blur at half resolution
    if (q.dof) {
      this.pass(this.prog.dofdown, t.d1, (pr) => { this.bind(pr, 'tSrc', t.fa.tex[0], 0); this.bind(pr, 'tG3', t.gbuf.tex[3], 1); gl.uniform2f(pr.u.uSrcRes, NW, NH); });
      for (let n = 0; n < 2; n++) {
        this.pass(this.prog.blur, t.d2, (pr) => { this.bind(pr, 'tSrc', t.d1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
        this.pass(this.prog.blur, t.d1, (pr) => { this.bind(pr, 'tSrc', t.d2.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); });
      }
    }

    // composite: reflections, steam, rain, drips
    this.pass(this.prog.comp, t.fb, (pr) => {
      this.bind(pr, 'tA', t.fa.tex[0], 0); this.bind(pr, 'tG3', t.gbuf.tex[3], 1); this.bind(pr, 'tDof', t.d1.tex[0], 2);
      this.zoneUniforms(pr, f, 3);
      gl.uniform1f(pr.u.uTime, f.t); gl.uniform1f(pr.u.uDof, q.dof ? 1 : 0); gl.uniform1f(pr.u.uView, f.view);
      gl.uniform4fv(pr.u.uSteam, f.steam); gl.uniform4f(pr.u.uDrips, ...f.drips); gl.uniform1f(pr.u.uMirror, f.mirror);
    });

    // bloom at a quarter and an eighth of the resolution
    this.pass(this.prog.bright, t.q1, (pr) => { this.bind(pr, 'tSrc', t.fb.tex[0], 0); gl.uniform2f(pr.u.uSrcRes, NW, NH); });
    this.pass(this.prog.blur, t.q2, (pr) => { this.bind(pr, 'tSrc', t.q1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
    this.pass(this.prog.blur, t.q1, (pr) => { this.bind(pr, 'tSrc', t.q2.tex[0], 0); gl.uniform2f(pr.u.uDir, 0, 1); });
    this.pass(this.prog.blur, t.e2, (pr) => { this.bind(pr, 'tSrc', t.q1.tex[0], 0); gl.uniform2f(pr.u.uDir, 1, 0); });
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
      gl.uniform1f(pr.u.uTime, f.t); gl.uniform1f(pr.u.uGlitch, f.glitch); gl.uniform1f(pr.u.uView, f.view);
      gl.uniform1f(pr.u.uStreaks, q.streaks ? 1 : 0);
      gl.uniform4fv(pr.u.uGR, q.godrays ? f.godrays : new Float32Array(16));
    });
  }
}
