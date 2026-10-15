// Image in and out, as plain RGBA buffers. sharp does decoding, encoding and resampling.

import sharp from 'sharp';

/** @typedef {{ w: number, h: number, d: Uint8ClampedArray }} Img  RGBA, 4 bytes per pixel */

/** @returns {Promise<Img>} */
export async function readRGBA(path) {
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}

/** Write RGBA (or RGB when every alpha is 255 and `rgb` is set) as PNG. */
export async function writePNG(path, img, { rgb = false } = {}) {
  let data = img.d, channels = 4;
  if (rgb) {
    data = new Uint8ClampedArray(img.w * img.h * 3);
    for (let i = 0, j = 0; i < img.d.length; i += 4, j += 3) { data[j] = img.d[i]; data[j + 1] = img.d[i + 1]; data[j + 2] = img.d[i + 2]; }
    channels = 3;
  }
  await sharp(Buffer.from(data.buffer, data.byteOffset, data.length), { raw: { width: img.w, height: img.h, channels } }).png({ compressionLevel: 9 }).toFile(path);
}

/** @returns {Img} */
export function blank(w, h, fill = [0, 0, 0, 0]) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) d.set(fill, i);
  return { w, h, d };
}

/** @returns {Img} */
export function crop(img, x, y, w, h) {
  const out = blank(w, h);
  for (let j = 0; j < h; j++) {
    const sy = y + j;
    if (sy < 0 || sy >= img.h) continue;
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      if (sx < 0 || sx >= img.w) continue;
      out.d.set(img.d.subarray((sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4), (j * w + i) * 4);
    }
  }
  return out;
}

/** Resample with premultiplied alpha, so transparent pixels don't bleed dark fringes. */
export async function resize(img, w, h) {
  const { data, info } = await sharp(Buffer.from(img.d.buffer, img.d.byteOffset, img.d.length), { raw: { width: img.w, height: img.h, channels: 4 } })
    .resize(w, h, { kernel: 'lanczos3', fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, d: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length) };
}
