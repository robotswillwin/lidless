// Recipes: one JSON file per asset in art/<scene>/<name>.json. Its working files live next to it in art/<scene>/<name>/.

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '../..');

/**
 * Defaults per kind of asset: generation size, in-game height, how round the volume is, shadows, depth, whether it is
 * cut out on a transparent background, and the pixel finish (how many flat colours each view is reduced to).
 * A background fills the frame: 2048x1088 shrinks to 1016x540, a little wider than the 960x540 screen.
 */
export const KINDS = {
  character: { size: '1024x1536', height: 240, round: 14, rh: 0.22, detail: 0.1, occluder: true, depth: 3, material: 'cloth', transparent: true, pixel: { colors: 32 } },
  prop: { size: '1024x1024', height: 120, round: 5, rh: 0.4, detail: 0.12, occluder: true, depth: 3, material: 'metal', transparent: true, pixel: { colors: 32 } },
  background: { size: '2048x1088', height: 540, round: 0, rh: 0, detail: 0.15, occluder: false, depth: 1, material: 'stone', transparent: false, pixel: { colors: 64 } },
  portrait: { size: '1024x1024', height: 360, round: 0, rh: 0, detail: 0.1, occluder: false, depth: 3, material: 'skin', transparent: true, pixel: { colors: 48 } },
};

/**
 * What flat vector art changes in a kind's defaults: its flat colours give the light almost no relief to catch, and it
 * keeps the model's own colours, since reducing them bands its soft gradients into blotches. A recipe can still ask for a
 * colour finish of its own.
 */
const VECTOR = { detail: 0.03, pixel: {} };

/** Which views a thing exists in: real, made up by the Concierge, or real but edited out by it. */
export const PRESENCE = ['both', 'concierge', 'raw'];

/**
 * @typedef {object} Recipe
 * @property {string} name
 * @property {string} scene
 * @property {'character'|'prop'|'background'|'portrait'} kind
 * @property {string} prompt              what to draw: in the raw world, or as the Concierge shows it when it is generated
 * @property {'both'|'concierge'|'raw'} [exists]  both: real (default); concierge: generated, gone in raw view; raw: edited out of Concierge view
 * @property {string} [concierge]         how the Concierge dresses a real thing up; leave out if it looks the same in both views
 * @property {number} [height]            in-game height in pixels
 * @property {[number, number]} [position]  level x of its centre and y of its base
 * @property {number} [depth]  @property {number} [parallax]  @property {boolean} [occluder]  @property {number} [reflectivity]
 * @property {number} [object]  @property {string} [material]
 * @property {{ raw?: 'auto'|'none', concierge?: 'auto'|'none', groupRaw?: number, groupConcierge?: number, machine?: boolean }} [glow]
 *   machine: a machine's own light (a screen, an indicator) keeps its colour in raw view; other glow turns sterile white
 * @property {number} [palette]           0 to 1: how strongly to pull colours toward the house palette
 * @property {string[]} [references]      images sent along as style references, relative to the project folder
 * @property {string[]} [conciergeReferences]  style references for the Concierge variant, the augmented view's look
 * @property {'character'} [referenceNote]  the references are the character's own model sheet: who to draw, not only how
 * @property {{ colors?: number, cleanup?: boolean } | false} [pixel]  the colour finish (default by kind), or false for none
 * @property {'pixel'|'paint'|'vector'} [look]  ask for pixel art, a painting that the build pixelates, or flat vector art
 * @property {boolean} [interior]        a background that is a room rather than a street
 * @property {boolean} [relics]          old devices that stay retro in the Concierge's view, as they looked when new
 * @property {string} [framing]          what to draw and how to frame it, instead of the kind's own note (a figure sitting or lying)
 * @property {object} [parts]           a character cut into parts: where they are on the sheet (`at`), joint fixes (`joints`),
 *   the left side (`left`), and `proportions`, each part's length as a fraction of her height, measured on her design
 */

/** @returns {Promise<Recipe & { file: string, dir: string, spec: typeof KINDS.character }>} */
export async function loadRecipe(file) {
  const path = resolve(file);
  if (!existsSync(path)) throw new Error(`no recipe at ${file}`);
  const r = JSON.parse(await readFile(path, 'utf8'));
  for (const k of ['name', 'scene', 'kind', 'prompt']) if (!r[k]) throw new Error(`${file} needs "${k}"`);
  if (!KINDS[r.kind]) throw new Error(`${file}: kind must be one of ${Object.keys(KINDS).join(', ')}`);
  if (r.exists && !PRESENCE.includes(r.exists)) throw new Error(`${file}: exists must be one of ${PRESENCE.join(', ')}`);
  return { ...r, file: path, dir: join(dirname(path), basename(path, '.json')), spec: { ...KINDS[r.kind], ...(r.look === 'vector' ? VECTOR : {}) } };
}

export function recipeTemplate(name, scene, kind) {
  return {
    name, scene, kind,
    exists: 'both',
    prompt: 'What it is and what it looks like in the raw world: materials, wear, colours.',
    concierge: 'How the Concierge dresses it up in its view. Delete this line if it looks the same in both views.',
    height: KINDS[kind].height,
    position: [480, 464],
    material: KINDS[kind].material,
    glow: { raw: 'none', concierge: 'auto', machine: false },
    palette: 0.35,
  };
}
