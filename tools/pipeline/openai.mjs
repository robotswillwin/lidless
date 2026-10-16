// OpenAI image API: generate new images, or edit one (the Concierge version of a raw image).
// The key comes from OPENAI_API_KEY, which the CLI loads from .env.local. Docs: https://developers.openai.com/api/docs/guides/image-generation

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

const API = 'https://api.openai.com/v1/images';
export const MODELS = { generate: 'gpt-image-2.5-flare', edit: 'gpt-image-2.5-sunburst' };
/** Dollars per million tokens: https://developers.openai.com/api/docs/models/gpt-image-2.5-flare */
const PRICE = { textIn: 5, imageIn: 8, imageOut: 30 };

/** What a call cost, from the token usage the API reports with it. */
export function costOf(usage) {
  if (!usage) return null;
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0, textIn = usage.input_tokens_details?.text_tokens ?? Math.max(0, (usage.input_tokens ?? 0) - imageIn);
  return (textIn * PRICE.textIn + imageIn * PRICE.imageIn + (usage.output_tokens ?? 0) * PRICE.imageOut) / 1e6;
}

function key() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error('OPENAI_API_KEY is not set. Put it in .env.local as OPENAI_API_KEY=... (that file is never committed).');
  return k;
}

async function call(endpoint, init) {
  const res = await fetch(`${API}/${endpoint}`, { ...init, headers: { Authorization: `Bearer ${key()}`, ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${endpoint} failed (${res.status}): ${body?.error?.message ?? res.statusText}`);
  return { images: (body.data ?? []).map((d) => Buffer.from(d.b64_json, 'base64')), usage: body.usage ?? null, cost: costOf(body.usage) };
}

/** @returns {Promise<{ images: Buffer[], usage: object | null, cost: number | null }>} PNG files and what they cost */
export function generate({ prompt, size, quality = 'medium', n = 1, model = MODELS.generate }) {
  return call('generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, quality, n, background: 'transparent', output_format: 'png' }),
  });
}

/** Edit: the first image is the one being changed, the rest are references. Returns the same as generate. */
export async function edit({ prompt, images, size, quality = 'medium', n = 1, model = MODELS.edit }) {
  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('n', String(n));
  form.append('background', 'transparent');
  form.append('output_format', 'png');
  for (const path of images) form.append('image[]', new Blob([await readFile(path)], { type: path.endsWith('.png') ? 'image/png' : 'image/jpeg' }), basename(path));
  return call('edits', { method: 'POST', body: form });
}
