// What the pipeline's commands share: paths relative to the project, numbered file names, the house palette and the
// pixel finish.

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pixelate } from './clean.mjs';
import { ROOT } from './recipe.mjs';

export const rel = (p) => relative(ROOT, p);

export async function nextName(dir, prefix, tag) {
  const have = existsSync(dir) ? (await readdir(dir)).filter((f) => f.startsWith(`${prefix}-`)).map((f) => parseInt(f.slice(prefix.length + 1), 10) || 0) : [];
  let n = Math.max(0, ...have);
  return () => `${prefix}-${String(++n).padStart(2, '0')}${tag ? `-${tag}` : ''}.png`;
}

export const palette = async () => Object.values(JSON.parse(await readFile(resolve(ROOT, 'art/palette.json'), 'utf8')).ramps).flat();

/** The pixel finish for a recipe: its kind's default, changed or switched off by the recipe. */
export const finishFor = (r) => (img) => {
  const px = r.pixel === false ? null : { ...r.spec.pixel, ...(r.pixel ?? {}) };
  return px?.colors ? pixelate(img, px) : img;
};
