// A checked chapter into the game (npm run chapter -- <folder> --import): what it adds and changes, written into the
// game's data and its story, and what is left to make listed (the pictures, and the spots to place in the editor).
// With --dry nothing is written: every change is listed, so a chapter that describes the game as it is built (the
// worked example) changes nothing.
//
// What goes where:
//   Places        public/assets/scenes/<id>/scene.json: its texts and settings, its spots and ways (new ones at a place
//                 to move them from, with `where` saying where), its arrivals; a new place's art recipe
//                 (art/<id>/room.json) and its entry in world.json
//   Things        public/assets/items.json, the Things list and what she carries (src/story/main.ink), a new one's
//                 picture prompts (art/items/items.json)
//   Story state   new variables and lists, in src/story/main.ink, each with what it means
//   Messages      public/assets/messages.json
//   Journal, Notebook   public/assets/journal.json, notebook.json
//   Close-ups     the words on a paper (public/assets/closeups.json); a new one's prompts (art/closeups/closeups.json)
//   Machines      public/assets/terminals/<id>.json
//   People        a new person's art recipe (art/cast/<id>.json)
//   Script        each knot: in place of the game's of its name, else into src/story/<the chapter file>.ink
//
// What is already drawn keeps its picture: a look written for a place, a thing, a person or a close-up the game has is
// a description, not an order to draw it again.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..'), ASSETS = join(ROOT, 'public/assets'), STORY = join(ROOT, 'src/story');
const rel = (p: string) => relative(ROOT, p);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

export interface Parsed {
  dir: string;
  data: (section: string) => { v: unknown; at: string }[];
  places: Map<string, { at: string; v: Obj; spots: Map<string, Obj>; arrivals: Set<string> }>;
  things: Map<string, { at: string; v: Obj }>;
  people: Map<string, { at: string; v: Obj }>;
  knots: Map<string, { file: string; line: number; lines: string[] }>;
}
export interface GameKnots { knots: Map<string, { file: string; line: number; lines: string[] }> }

/** Text the same in both views, written once: { concierge: a, raw: a } is a. */
function oneText(v: unknown): unknown {
  if (isObj(v) && Object.keys(v).length === 2 && 'concierge' in v && 'raw' in v && v.concierge === v.raw) return v.concierge;
  return v;
}
/** For comparing: keys in order, text the same in both views written once, a block's end of line gone. */
function canon(v: unknown): string {
  const norm = (x: unknown): unknown => {
    x = oneText(x);
    if (typeof x === 'string') return x.replace(/\s+$/, '');
    if (Array.isArray(x)) return x.map(norm);
    if (isObj(x)) return Object.fromEntries(Object.keys(x).sort().map((k) => [k, norm(x[k])]));
    return x;
  };
  return JSON.stringify(norm(v));
}
const same = (a: unknown, b: unknown) => canon(a) === canon(b);
/** A look's prompt for a view (the same in both when written once), as one line. */
const lookIn = (look: unknown, view: 'concierge' | 'raw'): string => {
  const t = typeof look === 'string' ? look : isObj(look) ? look[view] : undefined;
  return typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '';
};
/** A block's text as the game keeps it: no newline at its very end. */
const clean = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/\n+$/, '') : isObj(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)])) : Array.isArray(v) ? v.map(clean) : v);

/** A JSON file of the game's, kept with the indent it has. */
class JsonFile {
  readonly path: string;
  readonly data: Obj;
  private readonly indent: number;
  private readonly before: string;
  constructor(path: string, fresh: Obj = {}) {
    this.path = path;
    const text = existsSync(path) ? readFileSync(path, 'utf8') : null;
    this.data = text ? (JSON.parse(text) as Obj) : fresh;
    this.indent = text && /^\{\n {2}"/.test(text) ? 2 : 1;
    this.before = text ? JSON.stringify(JSON.parse(text)) : '';
  }
  get changed(): boolean { return JSON.stringify(this.data) !== this.before; }
  write(): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, `${JSON.stringify(this.data, null, this.indent)}\n`);
  }
}

/** The spot's fields the game keeps on a hotspot, as the chapter writes them. */
const SPOT_FIELDS = ['name', 'look', 'use', 'take', 'tag', 'ask', 'story', 'talk', 'reply', 'kind', 'item', 'only', 'when', 'map', 'wear', 'wardrobe', 'zoom'] as const;
/** A place's fields the game keeps in its scene file. */
const PLACE_FIELDS = ['name', 'kind', 'private', 'home', 'greeting', 'assist', 'closeup', 'stay', 'arrive'] as const;

export function importChapter(p: Parsed, game: GameKnots, dry: boolean): void {
  const changes: string[] = [], toMake: string[] = [], files = new Map<string, JsonFile>();
  const json = (path: string, fresh: Obj = {}) => { if (!files.has(path)) files.set(path, new JsonFile(path, fresh)); return files.get(path)!; };
  const note = (file: string, what: string) => changes.push(`${rel(file)}: ${what}`);
  /** Set a field to the chapter's value where it differs; say so. */
  const fresh = new Set<Obj>();
  const set = (o: Obj, key: string, value: unknown, file: string, what: string) => {
    if (value === undefined) return;
    value = clean(oneText(value));
    if (key in o && same(o[key], value)) return;
    // what was just made is said once, not field by field
    if (!fresh.has(o)) note(file, `${what} ${key}${key in o ? '' : ' (new)'}`);
    o[key] = value;
  };

  // ----- Places
  const world = json(join(ASSETS, 'world.json'));
  for (const [id, place] of p.places) {
    const v = place.v, path = join(ASSETS, 'scenes', id, 'scene.json'), newPlace = !existsSync(path), closeup = typeof v.closeup === 'string';
    const width = typeof v.width === 'number' ? v.width : 1;
    const f = json(path, {
      id, name: clean(oneText(v.name)), kind: closeup ? 'interior' : v.kind, size: [960 * width, 540], layers: [{ asset: `${id}/room` }],
      ...(closeup ? {} : { walk: { y: 470, x0: 40, x1: 960 * width - 40 } }), spawns: {}, lights: [], hotspots: [],
    }), scene = f.data;
    if (newPlace) note(path, 'a new place');
    for (const k of PLACE_FIELDS) set(scene, k, v[k], path, 'place');
    // its arrivals: a new one where it says, to be placed in the editor
    if (!closeup) {
      const spawns = (scene.spawns ??= {}) as Record<string, Obj>, walk = scene.walk as { x0: number; x1: number };
      const arrivals = ((v.arrivals as Obj[] | undefined) ?? []).filter(isObj);
      arrivals.forEach((a, i) => {
        const aid = String(a.id);
        if (spawns[aid]) return;
        spawns[aid] = { x: Math.round(walk.x0 + ((i + 1) * (walk.x1 - walk.x0)) / (arrivals.length + 1)), facing: 1 };
        note(path, `arrival ${aid} (new)`);
        toMake.push(`place the arrival ${id}/${aid} in the editor: ${String(a.where ?? '')}`);
      });
    }
    // its spots and its ways, by id
    const hotspots = scene.hotspots as Obj[], given = [...((v.spots as Obj[] | undefined) ?? []), ...((v.ways as Obj[] | undefined) ?? [])].filter(isObj);
    given.forEach((s, i) => {
      const sid = String(s.id), isWay = ((v.ways as Obj[] | undefined) ?? []).includes(s);
      let h = hotspots.find((x) => x.id === sid);
      if (!h) {
        const w = scene.size as [number, number];
        h = { id: sid, name: clean(oneText(s.name)), rect: [Math.round(((i + 1) * w[0]) / (given.length + 1)) - 30, 240, 60, 120], ...(s.where ? { where: s.where } : {}) };
        hotspots.push(h);
        fresh.add(h);
        note(path, `spot ${sid} (new)`);
        toMake.push(`place the spot ${id}/${sid} in the editor: ${String(s.where ?? '')}`);
        if (s.prop === true) toMake.push(`draw ${id}/${sid} as a prop of its own (lift it out of the place's picture)`);
      }
      for (const k of SPOT_FIELDS) set(h, k, s[k], path, `spot ${sid}`);
      if (isWay && typeof s.to === 'string') set(h, 'go', { scene: s.to, spawn: s.arrive }, path, `way ${sid}`);
    });
    // a new place: its picture's recipe, and its place in the world
    if (newPlace) {
      const recipe = join(ROOT, 'art', id, 'room.json'), lk = (view: 'concierge' | 'raw') => lookIn(v.look, view);
      json(recipe, {
        name: 'room', scene: id, kind: 'background', interior: true, exists: 'both', look: 'vector', res: 2, size: '1936x1088',
        framing: closeup
          ? 'A close-up seen from the front and a little from above, at the eye height of a person standing at it, filling the frame from edge to edge. No text, no captions, no border.'
          : 'A wide cinematic cutaway seen straight on from the side, like a doll\'s house with its front wall removed, filling the whole frame. Lit by its own lamps. No text, no captions, no border.',
        height: 540, position: [480, 540], depth: 3, material: 'stone', glow: { raw: 'auto', concierge: 'auto', machine: true }, palette: 0,
        prompt: `${lk('raw')} Its real size: ${String(v.size ?? '')}. No people. No writing.`.trim(),
        concierge: `${lk('concierge')} No people. No signs, no symbols, no writing.`.trim(),
        references: [], conciergeReferences: [],
      });
      note(recipe, 'its picture\'s recipe (new)');
      toMake.push(`draw ${id} (art/${id}/room.json): a guide at Luna's scale first, then generate, variant, build`);
      if (!closeup) {
        const scenes = world.data.scenes as string[];
        if (!scenes.includes(id)) { scenes.push(id); note(world.path, `scene ${id}`); }
        const map = ((world.data.map ??= { places: {} }) as { places: Record<string, Obj> }).places;
        const first = ((v.arrivals as Obj[] | undefined) ?? []).find(isObj)?.id;
        if (!map[id]) { map[id] = { spawn: first }; note(world.path, `map place ${id}`); }
      }
    }
  }

  // ----- Things
  const items = json(join(ASSETS, 'items.json')), art = json(join(ROOT, 'art/items/items.json'), { things: {}, concierge: {} });
  const newThings: string[] = [], carriedNow: string[] = [];
  for (const [id, t] of p.things) {
    const v = t.v, isNew = !(id in items.data);
    const it = (items.data[id] ??= { icon: 'parcel', art: { concierge: `items/${id}.concierge.webp`, raw: `items/${id}.webp` } }) as Obj;
    if (isNew) { note(items.path, `thing ${id} (new)`); newThings.push(id); fresh.add(it); }
    for (const k of ['name', 'note', 'unlicensed', 'only'] as const) set(it, k, v[k], items.path, `thing ${id}`);
    if (isNew) {
      const lk = (view: 'concierge' | 'raw') => lookIn(v.look, view);
      if (lk('raw')) ((art.data.things ??= {}) as Obj)[id] = v.size ? `${lk('raw').replace(/\.$/, '')}, ${String(v.size)}` : lk('raw');
      if (lk('concierge')) ((art.data.concierge ??= {}) as Obj)[id] = lk('concierge');
      note(art.path, `thing ${id}'s picture prompts (new)`);
      toMake.push(`draw the thing ${id}: npm run asset -- items --only ${id}, then --concierge`);
    }
    if (v.starts === 'carried') carriedNow.push(id);
  }

  // ----- Story state, and the story's lists: into main.ink
  const mainPath = join(STORY, 'main.ink');
  let main = readFileSync(mainPath, 'utf8');
  const before = main;
  if (newThings.length) {
    main = main.replace(/^(LIST Things = )(.*)$/m, (_, a: string, list: string) => `${a}${list}, ${newThings.filter((t) => !list.split(/,\s*/).includes(t)).join(', ')}`);
    note(mainPath, `Things: ${newThings.join(', ')}`);
  }
  if (carriedNow.length) {
    main = main.replace(/^(VAR carried = \()(.*)(\))$/m, (_, a: string, list: string, b: string) => {
      const have = list.split(/,\s*/).filter(Boolean), add = carriedNow.filter((t) => !have.includes(t));
      if (add.length) note(mainPath, `she carries ${add.join(', ')} from the start`);
      return `${a}${[...have, ...add].join(', ')}${b}`;
    });
  }
  const decl: string[] = [];
  for (const { v } of p.data('Story state')) {
    if (!isObj(v)) continue;
    for (const x of ((v.variables as Obj[] | undefined) ?? []).filter(isObj)) {
      if (x.new === false || new RegExp(`^VAR\\s+${String(x.name)}\\s*=`, 'm').test(main)) continue;
      decl.push(`// ${String(x.means ?? '')}`.trimEnd(), `VAR ${String(x.name)} = ${typeof x.start === 'string' ? JSON.stringify(x.start) : String(x.start)}`);
      note(mainPath, `variable ${String(x.name)} (new)`);
    }
    for (const x of ((v.lists as Obj[] | undefined) ?? []).filter(isObj)) {
      if (new RegExp(`^LIST\\s+${String(x.name)}\\s*=`, 'm').test(main)) continue;
      decl.push(`LIST ${String(x.name)} = ${((x.items as unknown[]) ?? []).map(String).join(', ')}`);
      note(mainPath, `list ${String(x.name)} (new)`);
    }
  }
  if (decl.length) {
    const about = p.data('About')[0]?.v as Obj | undefined, title = about ? `Chapter ${String(about.chapter)}, ${String(about.title)}` : basename(p.dir);
    main = main.replace(/^-> END$/m, `// ${title}\n${decl.join('\n')}\n\n-> END`);
  }

  // ----- Messages
  const messages = json(join(ASSETS, 'messages.json'), { messages: [] }), inbox = messages.data.messages as Obj[];
  for (const { v } of p.data('Messages')) {
    if (!isObj(v)) continue;
    let m = inbox.find((x) => x.id === v.id);
    if (!m) { m = { id: v.id }; inbox.push(m); fresh.add(m); note(messages.path, `message ${String(v.id)} (new)`); }
    for (const k of ['from', 'arrives', 'text', 'read'] as const) set(m, k, v[k], messages.path, `message ${String(v.id)}`);
  }

  // ----- Journal and notebook
  for (const [section, file] of [['Journal', 'journal.json'], ['Notebook', 'notebook.json']] as const) {
    const book = json(join(ASSETS, file), { pages: [] }), pages = book.data.pages as Obj[];
    for (const { v } of p.data(section)) {
      if (!isObj(v)) continue;
      let page = pages.find((x) => x.id === v.page);
      if (!page) { page = { id: v.page, title: String(v.page).replace(/^./, (c) => c.toUpperCase()), entries: [] }; pages.push(page); note(book.path, `page ${String(v.page)} (new)`); }
      const entries = page.entries as Obj[];
      let e = entries.find((x) => x.id === v.id);
      if (!e) { e = { id: v.id }; entries.push(e); fresh.add(e); note(book.path, `${String(v.page)}/${String(v.id)} (new)`); }
      for (const k of ['name', 'when', 'done', 'lines'] as const) set(e, k, v[k], book.path, `${String(v.page)}/${String(v.id)}`);
    }
  }

  // ----- Close-ups: a paper's words; a new one's prompts
  const words = json(join(ASSETS, 'closeups.json')), prompts = json(join(ROOT, 'art/closeups/closeups.json'));
  for (const { v } of p.data('Close-ups')) {
    if (!isObj(v)) continue;
    const id = String(v.id);
    if (v.text !== undefined || v.hand !== undefined || v.dark !== undefined) {
      if (!(id in words.data)) { words.data[id] = {}; fresh.add(words.data[id] as Obj); note(words.path, `close-up ${id}'s words (new)`); }
      const d = words.data[id] as Obj;
      for (const k of ['text', 'hand', 'dark'] as const) set(d, k, v[k], words.path, `close-up ${id}`);
    }
    if (!(id in prompts.data) && isObj(v.look)) {
      prompts.data[id] = { concierge: lookIn(v.look, 'concierge'), references: [], raw: lookIn(v.look, 'raw'), rawReferences: [] };
      note(prompts.path, `close-up ${id}'s prompts (new)`);
      toMake.push(`draw the close-up ${id}: npm run asset -- closeups --only ${id}`);
    }
  }

  // ----- Machines
  for (const { v } of p.data('Machines')) {
    if (!isObj(v)) continue;
    const path = join(ASSETS, 'terminals', `${String(v.id)}.json`), m = json(path), { id: _, ...rest } = v;
    for (const [k, x] of Object.entries(rest)) set(m.data, k, x, path, `machine ${String(v.id)}`);
  }

  // ----- People: a new person's picture, drawn as the cast is (art/cast/fixer.json): one figure side on, at their
  // height against Luna's (1.7 m, drawn 240 high), her pictures its references for style and scale
  for (const [id, person] of p.people) {
    const v = person.v, recipe = join(ROOT, 'art/cast', `${id}.json`);
    if (v.new === false || existsSync(recipe)) continue;
    const lk = (view: 'concierge' | 'raw') => lookIn(v.look, view);
    const tall = /([\d.]+)\s*(cm|m)\b/.exec(String(v.height ?? '')), metres = tall ? Number(tall[1]) / (tall[2] === 'cm' ? 100 : 1) : 1.7;
    json(recipe, {
      name: id, scene: 'cast', kind: 'character', exists: v.only ? String(v.only) : 'both', look: 'vector', res: 1.25,
      framing: `One full-length figure standing, seen from the side in a three-quarter view facing left${v.pose ? `: ${String(v.pose)}` : ''}. Feet at the bottom of the frame. Even, soft, frontal lighting with no cast shadows and no rim light. Transparent background, the whole figure in frame with a little space around it, no ground, no text, no border.`,
      prompt: `${lk('raw')} ${String(v.height ?? '')} tall.`.trim(), concierge: lk('concierge'),
      height: Math.round((240 * metres) / 1.7), material: 'cloth', glow: { raw: 'none', concierge: 'auto', machine: false },
      references: ['art/cast/hero/raw.png'], conciergeReferences: ['art/cast/hero/concierge.png'],
    });
    note(recipe, 'a new person\'s recipe');
    toMake.push(`draw ${id} (art/cast/${id}.json) at ${String(v.height ?? '?')} against Luna's 1.7 m`);
  }

  // ----- Script: each knot in place of the game's of its name, else into the chapter file's own story file
  const inks = new Map<string, string>(), readInk = (f: string) => { if (!inks.has(f)) inks.set(f, existsSync(join(STORY, f)) ? readFileSync(join(STORY, f), 'utf8') : ''); return inks.get(f)!; };
  /** A knot's lines without what trails it (blank lines, and comments that belong to what comes next). */
  const body = (lines: string[]) => { const out = [...lines]; while (out.length && /^\s*(\/\/.*)?$/.test(out[out.length - 1])) out.pop(); return out; };
  const added = new Map<string, string[]>(), replaced = new Map<string, { start: number; count: number; lines: string[] }[]>();
  for (const [name, k] of p.knots) {
    const mine = body(k.lines), theirs = game.knots.get(name);
    if (theirs) {
      const old = body(theirs.lines);
      if (old.map((l) => l.trimEnd()).join('\n') === mine.map((l) => l.trimEnd()).join('\n')) continue;
      replaced.set(theirs.file, [...(replaced.get(theirs.file) ?? []), { start: theirs.line - 1, count: old.length, lines: mine }]);
      note(join(STORY, theirs.file), `knot ${name}`);
    } else {
      const file = `${basename(k.file, '.md').replace(/^overview$/, `chapter-${basename(p.dir).split('-')[0]}`)}.ink`;
      added.set(file, [...(added.get(file) ?? []), ...mine, '']);
      note(join(STORY, file), `knot ${name} (new)`);
    }
  }
  // in each file from its end, so where each knot is stays true
  for (const [file, list] of replaced) {
    const lines = readInk(file).split('\n');
    for (const r of list.sort((a, b) => b.start - a.start)) lines.splice(r.start, r.count, ...r.lines);
    inks.set(file, lines.join('\n'));
  }
  for (const [file, lines] of added) {
    const had = readInk(file);
    inks.set(file, `${had || `// ${file.replace(/\.ink$/, '')}: from ${rel(p.dir)}. Included by main.ink.\n`}\n${lines.join('\n')}`.replace(/\n{3,}/g, '\n\n'));
    if (!new RegExp(`^INCLUDE ${file.replace('.', '\\.')}$`, 'm').test(main)) {
      main = main.replace(/^(INCLUDE .+\n)(?!INCLUDE)/m, `$1INCLUDE ${file}\n`);
      note(mainPath, `INCLUDE ${file}`);
    }
  }

  // ----- the report, and the writing
  console.log(`\n  ${dry ? 'Importing would change' : 'Imported'}: ${changes.length ? '' : 'nothing'}`);
  for (const c of changes) console.log(`    ${c}`);
  if (toMake.length) { console.log('\n  Still to make:'); for (const t of toMake) console.log(`    ${t}`); }
  console.log('');
  if (dry) return;
  for (const f of files.values()) if (f.changed || !existsSync(f.path)) f.write();
  if (main !== before) writeFileSync(mainPath, main);
  for (const [file, text] of inks) if (text !== (existsSync(join(STORY, file)) ? readFileSync(join(STORY, file), 'utf8') : '')) writeFileSync(join(STORY, file), text);
}

// ---------- the other way: what the game has, written as a chapter writes it ----------

/** A place of the game's as a chapter's Places entry (`new: false`): its settings, arrivals, ways and spots, exactly. */
export function exportPlace(id: string, stringify: (v: unknown) => string): string {
  const scene = JSON.parse(readFileSync(join(ASSETS, 'scenes', id, 'scene.json'), 'utf8')) as Obj;
  const entry: Obj = { id, new: false };
  for (const k of PLACE_FIELDS) if (scene[k] !== undefined) entry[k] = oneText(scene[k]);
  if (!scene.closeup) entry.arrivals = Object.keys((scene.spawns as Obj) ?? {}).map((a) => ({ id: a, where: '' }));
  const ways: Obj[] = [], spots: Obj[] = [];
  for (const h of (scene.hotspots as Obj[]) ?? []) {
    const out: Obj = { id: h.id };
    for (const k of SPOT_FIELDS) if (h[k] !== undefined) out[k] = oneText(h[k]);
    const go = h.go as Obj | undefined;
    if (go) ways.push({ ...out, to: go.scene, arrive: go.spawn });
    else spots.push(out);
  }
  if (ways.length) entry.ways = ways;
  entry.spots = spots;
  return stringify([entry]);
}

/** Knots of the game's, as they are in its story files, for a chapter's Script. */
export function exportKnots(names: string[], knots: GameKnots['knots']): string {
  return names.map((n) => {
    const k = knots.get(n);
    if (!k) throw new Error(`the game has no knot ${n}`);
    const lines = [...k.lines];
    while (lines.length && /^\s*(\/\/.*)?$/.test(lines[lines.length - 1])) lines.pop();
    return lines.join('\n');
  }).join('\n\n');
}
