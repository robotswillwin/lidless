// Draw Things (the Mac app) as the image model, over its HTTP API server (Settings → API Server, HTTP, port 7860 by
// default): the same `generate` and `edit` as openai.mjs, so every command runs unchanged with --backend drawthings.
// Free, local, and its models are the app's: whatever is selected there (model, steps, sampler, guidance) is what is
// used unless this is told otherwise (--model, --steps, --cfg, --seed, --strength, or DT_* in the environment).
//
// What it cannot do that the OpenAI edit endpoint can: follow style reference images (there is no image-prompt here), so
// references are left out and only the prompt carries the style; a layout guide or a source image does go in, as the
// picture that image-to-image starts from (--strength says how far it may stray; 0.8 by default, 1 under a mask). A
// diffusion model copies a guide literally, lettering included: give it one without text labels (the labels are for
// the OpenAI model, which reads them).

import sharp from 'sharp';

const URL = process.env.DT_URL ?? 'http://127.0.0.1:7860';
let notedRefs = false;

/** Draw Things wants sizes in multiples of 64; the nearest ones, the aspect kept. */
export function roundSize(size) {
  const [w, h] = size.split('x').map(Number);
  const r = (v) => Math.max(64, Math.round(v / 64) * 64);
  return { width: r(w), height: r(h), changed: r(w) !== w || r(h) !== h };
}

/** What the command line or the environment pins; anything not set is left to the app's own settings. */
function pinned() {
  const e = process.env, out = {};
  if (e.DT_MODEL) out.model = e.DT_MODEL;
  if (e.DT_STEPS) out.steps = Number(e.DT_STEPS);
  if (e.DT_CFG) { out.cfg_scale = Number(e.DT_CFG); out.guidance_scale = Number(e.DT_CFG); }
  if (e.DT_SEED) out.seed = Number(e.DT_SEED);
  if (e.DT_SAMPLER) out.sampler = e.DT_SAMPLER;
  // LoRAs by file name as the app lists them, with a weight: "flat_vector_lora_f16.ckpt:0.8,other.ckpt:0.5"
  if (e.DT_LORA) out.loras = e.DT_LORA.split(',').map((x) => { const [file, w] = x.trim().split(':'); return { file, weight: w === undefined ? 1 : Number(w) }; });
  return out;
}

async function post(endpoint, body) {
  let res;
  try {
    res = await fetch(`${URL}/sdapi/v1/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`Draw Things is not answering at ${URL} (${e.cause?.code ?? e.message}). In Draw Things: Settings → API Server, switch on the HTTP server (port 7860), pick the model there, then run this again. Another address: DT_URL=http://host:port.`);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(`Draw Things ${endpoint} failed (${res.status}): ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const images = (data.images ?? []).map((b64) => Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
  if (!images.length) throw new Error(`Draw Things ${endpoint} returned no images`);
  return { images, usage: null, cost: 0 };
}

/** The prompt, and a flat ground to cut away later where a transparent picture is wanted (the models paint no alpha). */
const promptFor = (prompt, background) => background === 'transparent' ? `${prompt} The subject alone on a plain, flat, even mid-grey background with nothing else on it.` : prompt;
const NEGATIVE = 'text, letters, writing, caption, watermark, signature, logo, blurry, low quality, deformed, extra limbs';

/** @returns {Promise<{ images: Buffer[], usage: null, cost: 0 }>} PNG files */
export async function generate({ prompt, size, n = 1, background = 'transparent' }) {
  const { width, height, changed } = roundSize(size);
  if (changed) console.log(`  (size ${size} rounded to ${width}x${height} for Draw Things)`);
  return post('txt2img', { prompt: promptFor(prompt, background), negative_prompt: NEGATIVE, width, height, batch_size: n, seed: -1, ...pinned() });
}

/**
 * Image-to-image from the first image (a layout guide, or the picture being changed); any other images are style
 * references, which this backend cannot take. A mask (transparent where the picture may change) becomes the API's
 * (white where it may change), and under one the change is total.
 */
export async function edit({ prompt, images, mask, size, n = 1, background = 'transparent', init = true }) {
  if (!init) return generate({ prompt, size, n, background }); // only references given: nothing to start from
  if (images.length > 1 && !notedRefs) { notedRefs = true; console.log(`  (Draw Things takes no reference images: ${images.length - 1} left out, the prompt carries the style)`); }
  const { width, height, changed } = roundSize(size);
  if (changed) console.log(`  (size ${size} rounded to ${width}x${height} for Draw Things)`);
  const first = images[0], data = typeof first === 'string' ? await sharp(first).png().toBuffer() : first.data;
  const initPng = await sharp(data).resize(width, height, { fit: 'fill' }).png().toBuffer();
  // a layout guide is crude boxes: the model must repaint most of it (0.8) and keep only the places; under a mask, all
  const strength = Number(process.env.DT_STRENGTH ?? (mask ? 1 : 0.8));
  const body = { prompt: promptFor(prompt, background), negative_prompt: NEGATIVE, width, height, batch_size: n, seed: -1, init_images: [initPng.toString('base64')], strength, ...pinned() };
  if (mask) {
    // alpha → white where it may change (transparent), black where it must stay (opaque)
    const { data: a, info } = await sharp(mask).ensureAlpha().extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < a.length; i++) a[i] = 255 - a[i];
    const m = await sharp(a, { raw: { width: info.width, height: info.height, channels: 1 } }).resize(width, height, { fit: 'fill' }).png().toBuffer();
    body.mask = m.toString('base64');
    body.inpainting_mask_invert = 0;
    body.inpainting_fill = 1;
  }
  return post('img2img', body);
}
