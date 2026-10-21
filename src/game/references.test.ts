// Everything the scenes and the notebook name in the story is there: a broken reference is the bug a story with many
// branches makes most, and it shows only when a player reaches it.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conditionProblem, variablesIn } from './conditions';
import { Dialogue } from './dialogue';
import type { SceneFile } from './scenefile';

const assets = join(__dirname, '../../public/assets');
const scenes: SceneFile[] = readdirSync(join(assets, 'scenes')).map((id) => JSON.parse(readFileSync(join(assets, 'scenes', id, 'scene.json'), 'utf8')));
const items = JSON.parse(readFileSync(join(assets, 'items.json'), 'utf8')) as Record<string, unknown>;
const notebook = JSON.parse(readFileSync(join(assets, 'notebook.json'), 'utf8')) as Record<string, unknown>;
const story = new Dialogue(null);
/** Every item of the story's lists: the Things she can carry. */
const things = new Set((story.story.listDefinitions?.lists ?? []).flatMap((l) => [...l.items.keys()].map((k) => JSON.parse(k).itemName as string)));
const variable = (name: string) => story.story.variablesState.GetVariableWithName(name) !== null;

/** Every condition in the game's data, and where it is. */
function conditions(): [string, string][] {
  const out: [string, string][] = [];
  for (const s of scenes) {
    for (const h of s.hotspots) if (h.when) out.push([`${s.id}: hotspot ${h.id}`, h.when]);
    s.layers.forEach((l, i) => { if (l.when) out.push([`${s.id}: layers[${i}]`, l.when]); });
    s.lights.forEach((l, i) => { if (l.when) out.push([`${s.id}: lights[${i}]`, l.when]); });
  }
  const entries = (['errands', 'people'] as const).flatMap((k) => (notebook[k] as { name: string; when?: string; done?: string }[] | undefined) ?? []);
  for (const e of entries) for (const c of [e.when, e.done]) if (c) out.push([`notebook: ${e.name}`, c]);
  const q = notebook.questions as { when?: string } | undefined;
  if (q?.when) out.push(['notebook: questions', q.when]);
  return out;
}

describe('what the scenes and the notebook name in the story', () => {
  it('can be read, and reads only variables the story has', () => {
    // the check itself: a variable the story has, and one it has not
    expect(variable('has_raw')).toBe(true);
    expect(variable('no_such_variable')).toBe(false);
    expect(things.has('valve')).toBe(true);
    const bad = conditions().flatMap(([where, c]) => {
      const p = conditionProblem(c);
      if (p) return [`${where}: ${p}`];
      return variablesIn(c).filter((v) => !variable(v)).map((v) => `${where}: the story has no variable ${v}`);
    });
    expect(bad).toEqual([]);
  });

  it('has every knot a hotspot talks through or tells its story in, and every thing to take', () => {
    const bad: string[] = [];
    for (const s of scenes) for (const h of s.hotspots) {
      if (h.talk && !story.has(h.talk.split('.')[0], h.talk.split('.')[1])) bad.push(`${s.id}: hotspot ${h.id} talks through ${h.talk}, which the story does not have`);
      if (h.story && !story.has(h.story)) bad.push(`${s.id}: hotspot ${h.id} tells its story in ${h.story}, which the story does not have`);
      if (h.item && !things.has(h.item)) bad.push(`${s.id}: hotspot ${h.id} is ${h.item}, which is none of the story's Things`);
      if (h.item && !items[h.item]) bad.push(`${s.id}: hotspot ${h.id} is ${h.item}, which items.json does not show`);
    }
    expect(bad).toEqual([]);
  });

  it('shows every thing she can carry', () => {
    expect([...things].filter((t) => !items[t])).toEqual([]);
  });
});
