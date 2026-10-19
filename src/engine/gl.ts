// Small WebGL2 helpers: programs, textures, render targets, a fullscreen triangle.

export type GL = WebGL2RenderingContext;

export interface Program {
  p: WebGLProgram;
  u: Record<string, WebGLUniformLocation>;
}

export const FULLSCREEN_VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

function compile(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader compile failed');
  return s;
}

export function createProgram(gl: GL, fs: string, vs: string = FULLSCREEN_VS): Program {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'program link failed');
  const u: Record<string, WebGLUniformLocation> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)!;
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name)!;
  }
  return { p, u };
}

export function setFilter(gl: GL, t: WebGLTexture, nearest: boolean): void {
  gl.bindTexture(gl.TEXTURE_2D, t);
  const f = nearest ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

/** Upload an image as-is: no premultiplied alpha, no colour conversion, top row first. */
export function textureFromImage(gl: GL, img: TexImageSource, nearest = true): WebGLTexture {
  const t = gl.createTexture()!;
  setFilter(gl, t, nearest);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
  return t;
}

export function solidTexture(gl: GL, rgba: [number, number, number, number]): WebGLTexture {
  const t = gl.createTexture()!;
  setFilter(gl, t, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
  return t;
}

export interface Target {
  tex: WebGLTexture[];
  fb: WebGLFramebuffer;
  w: number;
  h: number;
}

export type TargetFormat = 'rgba8' | 'hdr' | 'r8';

/** A framebuffer with one or more colour attachments of the same size and format. */
/** Free a render target's textures and framebuffer. */
export function deleteTarget(gl: GL, t: Target): void {
  for (const tex of t.tex) gl.deleteTexture(tex);
  gl.deleteFramebuffer(t.fb);
}

export function createTarget(gl: GL, w: number, h: number, opts: { count?: number; format?: TargetFormat; nearest?: boolean } = {}): Target {
  const count = opts.count ?? 1, format = opts.format ?? 'rgba8';
  const halfFloat = format === 'hdr' && !!gl.getExtension('EXT_color_buffer_float');
  const fb = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const tex: WebGLTexture[] = [];
  for (let i = 0; i < count; i++) {
    const t = gl.createTexture()!;
    setFilter(gl, t, opts.nearest ?? false);
    if (format === 'hdr') gl.texImage2D(gl.TEXTURE_2D, 0, halfFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    else if (format === 'r8') gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, w, h, 0, gl.RED, gl.UNSIGNED_BYTE, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
    tex.push(t);
  }
  if (count > 1) gl.drawBuffers(tex.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete (${status})`);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}

/** One triangle that covers the screen; shared by every fullscreen pass, also used as a unit quad for sprites. */
export function createGeometry(gl: GL): { full: WebGLVertexArrayObject; quad: WebGLVertexArrayObject } {
  const mk = (data: number[]) => {
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    return vao;
  };
  const full = mk([-1, -1, 3, -1, -1, 3]);
  const quad = mk([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);
  gl.bindVertexArray(null);
  return { full, quad };
}
