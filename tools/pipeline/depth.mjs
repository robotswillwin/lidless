// How far away each part of a picture is, for splitting a scene into layers: Depth Anything V2 Small (Apache-2.0), run
// on this machine with onnxruntime-web. The model is downloaded once into node_modules/.cache/lidless (about 100 MB),
// which git ignores; nothing of it ships with the game.

import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';

const ROOT = resolve(import.meta.dirname, '../..');
const MODEL_URL = 'https://huggingface.co/onnx-community/depth-anything-v2-small/resolve/main/onnx/model.onnx';
const CACHE = join(ROOT, 'node_modules/.cache/lidless'), MODEL = join(CACHE, 'depth-anything-v2-small.onnx');

async function modelFile() {
  if (existsSync(MODEL)) return MODEL;
  await mkdir(CACHE, { recursive: true });
  console.log('Downloading the depth model, once: Depth Anything V2 Small, about 100 MB, into node_modules/.cache/lidless');
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`could not download the depth model (${res.status} ${res.statusText})`);
  await writeFile(`${MODEL}.part`, Buffer.from(await res.arrayBuffer()));
  await rename(`${MODEL}.part`, MODEL);
  return MODEL;
}

let session = null, ort = null;

/**
 * The picture's depth, at its own size: 0 the furthest thing in it, 1 the nearest (the model's relative inverse depth,
 * stretched to that range). `img` is { w, h, d } with RGBA bytes.
 */
export async function depthOf(img) {
  ort ??= await import('onnxruntime-web');
  ort.env.wasm.numThreads = Math.max(1, Math.min(8, cpus().length));
  session ??= await ort.InferenceSession.create(await readFile(await modelFile()), { executionProviders: ['wasm'] });
  // what the model takes: the shorter side at 518, both sides multiples of 14, colours normalised as ImageNet's
  const s = 518 / Math.min(img.w, img.h), W = Math.round((img.w * s) / 14) * 14, H = Math.round((img.h * s) / 14) * 14;
  const { data } = await sharp(Buffer.from(img.d.buffer, img.d.byteOffset, img.d.length), { raw: { width: img.w, height: img.h, channels: 4 } })
    .removeAlpha().resize(W, H, { fit: 'fill', kernel: 'cubic' }).raw().toBuffer({ resolveWithObject: true });
  const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225], x = new Float32Array(3 * W * H);
  for (let i = 0; i < W * H; i++) for (let c = 0; c < 3; c++) x[c * W * H + i] = (data[i * 3 + c] / 255 - mean[c]) / std[c];
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, H, W]) });
  const pred = out[session.outputNames[0]], [ph, pw] = pred.dims.slice(-2), p = pred.data;
  let lo = Infinity, hi = -Infinity;
  for (const v of p) { if (v < lo) lo = v; if (v > hi) hi = v; }
  // back to the picture's size, smoothly
  const d = new Float32Array(img.w * img.h), k = 1 / Math.max(1e-6, hi - lo);
  for (let y = 0; y < img.h; y++) {
    const fy = Math.min(ph - 1, Math.max(0, ((y + 0.5) * ph) / img.h - 0.5)), y0 = Math.floor(fy), y1 = Math.min(ph - 1, y0 + 1), ty = fy - y0;
    for (let xx = 0; xx < img.w; xx++) {
      const fx = Math.min(pw - 1, Math.max(0, ((xx + 0.5) * pw) / img.w - 0.5)), x0 = Math.floor(fx), x1 = Math.min(pw - 1, x0 + 1), tx = fx - x0;
      const v = (p[y0 * pw + x0] * (1 - tx) + p[y0 * pw + x1] * tx) * (1 - ty) + (p[y1 * pw + x0] * (1 - tx) + p[y1 * pw + x1] * tx) * ty;
      d[y * img.w + xx] = (v - lo) * k;
    }
  }
  return { w: img.w, h: img.h, d };
}
