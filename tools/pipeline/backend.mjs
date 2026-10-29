// Which image model draws: OpenAI's (the default, paid, follows references) or Draw Things on this Mac (free, local,
// its own models), chosen with --backend on any command or ART_BACKEND in the environment. Each offers the same
// `generate` and `edit`, so the commands do not know the difference.

import * as openai from './openai.mjs';
import * as drawthings from './drawthings.mjs';

export const BACKENDS = { openai, drawthings };
export const backendName = () => process.env.ART_BACKEND || 'openai';

function pick() {
  const b = BACKENDS[backendName()];
  if (!b) throw new Error(`unknown backend "${backendName()}": one of ${Object.keys(BACKENDS).join(', ')}`);
  return b;
}

export const generate = (args) => pick().generate(args);
export const edit = (args) => pick().edit(args);
export const { MODELS, costOf } = openai;
