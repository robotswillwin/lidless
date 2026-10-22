// Everything the scenes and the notebook name in the story is there: a broken reference is the bug a story with many
// branches makes most, and it shows only when a player reaches it.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { conditionProblem, variablesIn } from './conditions';
import { Dialogue } from './dialogue';
import type { Notebook } from './notebook';
import type { SceneFile, WorldFile } from './scenefile';
import { picturesOf, type Item } from './tray';

const assets = join(__dirname, '../../public/assets');
const scenes: SceneFile[] = readdirSync(join(assets, 'scenes')).map((id) => JSON.parse(readFileSync(join(assets, 'scenes', id, 'scene.json'), 'utf8')));
const items = JSON.parse(readFileSync(join(assets, 'items.json'), 'utf8')) as Record<string, unknown>;
const notebook = JSON.parse(readFileSync(join(assets, 'notebook.json'), 'utf8')) as Notebook;
const journal = JSON.parse(readFileSync(join(assets, 'journal.json'), 'utf8')) as Notebook;
const books = { notebook, journal };
const world = JSON.parse(readFileSync(join(assets, 'world.json'), 'utf8')) as WorldFile;
const story = new Dialogue(null);
/** Every item of the story's lists: the Things she can carry. */
const things = new Set((story.story.listDefinitions?.lists ?? []).flatMap((l) => [...l.items.keys()].map((k) => JSON.parse(k).itemName as string)));
const variable = (name: string) => story.story.variablesState.GetVariableWithName(name) !== null;

/** Every condition in the game's data, and where it is. */
function conditions(): [string, string][] {
  const out: [string, string][] = [];
  for (const s of scenes) {
    for (const [v, r] of Object.entries(s.rotate ?? {})) if (r.from) out.push([`${s.id}: rotate ${v}`, r.from]);
    for (const h of s.hotspots) if (h.when) out.push([`${s.id}: hotspot ${h.id}`, h.when]);
    s.layers.forEach((l, i) => { if (l.when) out.push([`${s.id}: layers[${i}]`, l.when]); });
    s.lights.forEach((l, i) => { if (l.when) out.push([`${s.id}: lights[${i}]`, l.when]); });
  }
  for (const [book, b] of Object.entries(books)) for (const p of b.pages) {
    if (p.when) out.push([`${book}: page ${p.id}`, p.when]);
    for (const e of p.entries) {
      for (const c of [e.when, e.done]) if (c) out.push([`${book}: ${p.id}/${e.id}`, c]);
      (e.lines ?? []).forEach((l, i) => { if (typeof l !== 'string' && l.when) out.push([`${book}: ${p.id}/${e.id} line ${i}`, l.when]); });
    }
  }
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

  it('turns only story variables, as she arrives in a scene', () => {
    const bad = scenes.flatMap((s) => Object.keys(s.rotate ?? {}).filter((v) => !variable(v)).map((v) => `${s.id}: rotate ${v}, which the story does not have`));
    expect(bad).toEqual([]);
  });

  it('has a scene for every place on the map, and the places to arrive it names', () => {
    const bad: string[] = [];
    for (const [id, place] of Object.entries(world.map?.places ?? {})) {
      const s = scenes.find((x) => x.id === id);
      if (!s || !world.scenes.includes(id)) bad.push(`map: ${id} is no scene of the world's`);
      else if (place.spawn && !s.spawns[place.spawn]) bad.push(`map: ${id} arrives at ${place.spawn}, which the scene does not have`);
    }
    for (const id of world.scenes) if (!world.map?.places[id]) bad.push(`map: ${id} is not on it`);
    for (const [book, b] of Object.entries(books)) {
      const ids = new Set<string>(book === 'journal' ? ['places'] : []);
      for (const p of b.pages) {
        if (ids.has(p.id)) bad.push(`${book}: two pages are ${p.id}`);
        ids.add(p.id);
        const entries = new Set<string>();
        for (const e of p.entries) { if (entries.has(e.id)) bad.push(`${book}: ${p.id} has two entries ${e.id}`); entries.add(e.id); }
      }
    }
    expect(bad).toEqual([]);
  });

  it('shows every thing she can carry, painted in each view it has a picture for', () => {
    expect([...things].filter((t) => !items[t])).toEqual([]);
    const missing = Object.entries(items).flatMap(([id, it]) => picturesOf(it as Item).filter((f) => !existsSync(join(assets, f))).map((f) => `${id}: ${f}`));
    expect(missing).toEqual([]);
  });
});
