// A chapter as the scripting agents deliver it (docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md): a folder of Markdown
// files, docs/chapters/<NN>-<name>/, its data in YAML blocks and its script in Ink blocks under fixed headings. Read,
// checked against the format and against the game (every id and every reference; the Ink compiled with the game's
// story, every command in it checked), and summed up: what it adds and what it would take to make. Or the catalog of
// what the game has now, which the agents write against.
//
//   npm run chapter -- docs/chapters/00-the-errand    check a chapter: errors to fix, warnings to weigh, a summary
//   npm run chapter -- --catalog                      write docs/chapters/CATALOG.md from the game as it is
//   npm run agent-package                             the scripting agent package: the catalog, and everything an agent
//                                                     is given, in one folder (docs/scripting-agent-package/)
//   npm run chapter -- --check-package                whether that folder is up to date with what it copies

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Compiler, CompilerOptions } from 'inkjs/full';
import { isMap, isScalar, isSeq, LineCounter, parseDocument } from 'yaml';
import { conditionProblem, variablesIn } from '../src/game/conditions.ts';

const ROOT = resolve(import.meta.dirname, '..'), ASSETS = join(ROOT, 'public/assets'), STORY = join(ROOT, 'src/story');
const rel = (p: string) => { const r = relative(ROOT, p); return r.startsWith('..') ? p : r; };

// ---------- what the game has ----------

type Obj = Record<string, unknown>;
const readJson = (p: string): Obj => JSON.parse(readFileSync(p, 'utf8')) as Obj;

interface Game {
  scenes: Map<string, { name: string; kind: string; private: boolean; spawns: string[]; spots: Obj[] }>;
  items: Obj;
  outfits: Obj;
  closeups: string[];
  machines: string[];
  journal: Obj[];
  notebook: Obj[];
  /** The story's own source, split: what comes before the first knot (declarations), and each knot by name. */
  header: { file: string; line: number; text: string }[];
  knots: Map<string, { file: string; line: number; lines: string[] }>;
  variables: Map<string, string>;
  /** What a variable means, where the story says so in a comment above it. */
  means: Map<string, string>;
  lists: Map<string, string[]>;
  speakers: Set<string>;
}

/** An Ink source split into what comes before its first knot, and its knots by name, each with where it starts. */
function splitInk(file: string, text: string) {
  const header: { file: string; line: number; text: string }[] = [], knots = new Map<string, { file: string; line: number; lines: string[] }>();
  let cur: { file: string; line: number; lines: string[] } | null = null;
  text.split('\n').forEach((line, i) => {
    const m = /^\s*={2,}\s*(?:function\s+)?([A-Za-z_]\w*)/.exec(line);
    if (m) { cur = { file, line: i + 1, lines: [] }; knots.set(m[1], cur); }
    if (cur) cur.lines.push(line);
    else header.push({ file, line: i + 1, text: line });
  });
  return { header, knots };
}

function loadGame(): Game {
  const scenes: Game['scenes'] = new Map();
  for (const id of readdirSync(join(ASSETS, 'scenes'))) {
    const f = join(ASSETS, 'scenes', id, 'scene.json');
    if (!existsSync(f)) continue;
    const s = readJson(f) as { name: string; kind: string; private?: boolean; spawns: Obj; hotspots: Obj[] };
    scenes.set(id, { name: s.name, kind: s.kind, private: !!s.private, spawns: Object.keys(s.spawns ?? {}), spots: s.hotspots ?? [] });
  }
  const world = readJson(join(ASSETS, 'world.json')) as { hero?: { outfits?: Obj }; outfits?: Obj };
  const closeups = existsSync(join(ASSETS, 'closeups')) ? [...new Set(readdirSync(join(ASSETS, 'closeups')).map((f) => f.split('.')[0]))] : [];
  const machines = existsSync(join(ASSETS, 'terminals')) ? readdirSync(join(ASSETS, 'terminals')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
  // the story: main.ink and what it includes, in the order it includes them
  const header: Game['header'] = [], knots: Game['knots'] = new Map();
  const add = (file: string) => {
    const text = readFileSync(join(STORY, file), 'utf8'), split = splitInk(file, text);
    for (const h of split.header) {
      const inc = /^\s*INCLUDE\s+(\S+)/.exec(h.text);
      if (inc) add(inc[1]);
      else header.push(h);
    }
    for (const [k, v] of split.knots) knots.set(k, v);
  };
  add('main.ink');
  const variables = new Map<string, string>(), lists = new Map<string, string[]>(), speakers = new Set(['luna', 'concierge', 'narration']);
  // what each variable means: the comment above its declaration, as main.ink writes them
  const means = new Map<string, string>();
  // (a comment is for the declarations right under it, up to a blank line or the next comment)
  let comment: string[] = [], afterVar = false;
  for (const h of header) {
    const c = /^\s*\/\/\s?(.*)$/.exec(h.text);
    if (c) { if (afterVar) comment = []; comment.push(c[1]); afterVar = false; continue; }
    const v = /^\s*VAR\s+(\w+)\s*=\s*(.+?)\s*(\/\/.*)?$/.exec(h.text);
    if (v) { variables.set(v[1], v[2]); if (comment.length) means.set(v[1], comment.join(' ')); }
    afterVar = !!v;
    if (!v && !/^\s*LIST\s/.test(h.text)) comment = [];
    const l = /^\s*LIST\s+(\w+)\s*=\s*(.+?)\s*(\/\/.*)?$/.exec(h.text);
    if (l) lists.set(l[1], l[2].split(',').map((x) => x.replace(/[()\s]/g, '').replace(/=.*/, '')).filter(Boolean));
  }
  for (const k of knots.values()) for (const line of k.lines) for (const t of line.matchAll(/#\s*([a-z][a-z0-9_]*)\s*(?=#|$)/g)) speakers.add(t[1]);
  return {
    means,
    scenes, items: readJson(join(ASSETS, 'items.json')), outfits: world.hero?.outfits ?? world.outfits ?? {}, closeups, machines,
    journal: (readJson(join(ASSETS, 'journal.json')).pages as Obj[]) ?? [], notebook: (readJson(join(ASSETS, 'notebook.json')).pages as Obj[]) ?? [],
    header, knots, variables, lists, speakers,
  };
}

// ---------- a chapter as delivered ----------

const SECTIONS = ['About', 'Beats', 'Places', 'People', 'Things', 'Story state', 'Puzzles', 'Journal', 'Notebook', 'Close-ups', 'Machines', 'Script', 'Questions', 'Notes'] as const;
type Section = (typeof SECTIONS)[number];
interface Block { file: string; line: number; lang: string; text: string }

/** Each section's code blocks, from every Markdown file of the chapter, with where each one is. */
function readChapter(dir: string): { files: string[]; blocks: Map<Section, Block[]>; unknown: string[] } {
  const files = readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => join(dir, f));
  const blocks = new Map<Section, Block[]>(SECTIONS.map((s) => [s, []])), unknown: string[] = [];
  for (const file of files) {
    let section: Section | null = null, fence: Block | null = null;
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (fence) {
        if (/^```\s*$/.test(line)) { if (section) blocks.get(section)!.push(fence); fence = null; }
        else fence.text += `${line}\n`;
        return;
      }
      const h = /^##\s+(.+?)\s*$/.exec(line);
      if (h) {
        const name = SECTIONS.find((s) => s.toLowerCase() === h[1].toLowerCase()) ?? null;
        if (!name) unknown.push(`${rel(file)}:${i + 1}: "## ${h[1]}" is not a section of the format`);
        section = name;
        return;
      }
      const f = /^```\s*([a-z]+)\s*$/.exec(line);
      if (f) fence = { file: rel(file), line: i + 2, lang: f[1], text: '' };
    });
  }
  return { files, blocks, unknown };
}

// ---------- checking ----------

interface Issue { level: 'error' | 'warning'; where: string; text: string }
const issues: Issue[] = [];
const error = (where: string, text: string) => issues.push({ level: 'error', where, text });
const warn = (where: string, text: string) => issues.push({ level: 'warning', where, text });

const ID = /^[a-z][a-z0-9-]*$/, NAME = /^[a-z][a-z0-9_]*$/;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
/** Where an entry of the data is, file and line: each map read from YAML keeps it, out of sight. */
const AT = Symbol('at');
const atOf = (v: unknown, fallback: string): string => (isObj(v) && typeof (v as Record<symbol, unknown>)[AT] === 'string' ? (v as Record<symbol, string>)[AT] : fallback);
/** YAML as plain data, each map knowing the line it starts on. */
function withLines(node: unknown, lc: LineCounter, file: string, base: number): unknown {
  if (isMap(node)) {
    const o: Obj = {};
    for (const p of node.items) o[isScalar(p.key) ? String(p.key.value) : String(p.key)] = withLines(p.value, lc, file, base);
    if (node.range) Object.defineProperty(o, AT, { value: `${file}:${base + lc.linePos(node.range[0]).line - 1}`, enumerable: false });
    return o;
  }
  if (isSeq(node)) return node.items.map((n) => withLines(n, lc, file, base));
  if (isScalar(node)) return node.value;
  return node == null ? null : ((node as { toJSON?: () => unknown }).toJSON?.() ?? null);
}
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
/** A size with a unit: "1.7 m", "30 × 22 × 4 cm", "6 m wide, 3 m high". */
const SIZE = /\d.*\b(mm|cm|m|metres?|meters?)\b/;

/** Text for both views, or the same in both: a string, or { concierge, raw }, as `only` allows. */
function viewText(v: unknown, where: string, field: string, only?: unknown, required = true): string[] {
  if (v === undefined || v === null) { if (required) error(where, `needs ${field}`); return []; }
  if (typeof v === 'string') return [v];
  if (!isObj(v)) { error(where, `${field} must be text, or { concierge: ..., raw: ... }`); return []; }
  for (const k of Object.keys(v)) if (k !== 'concierge' && k !== 'raw') error(where, `${field} has "${k}": only concierge and raw`);
  for (const view of ['concierge', 'raw']) if (only !== (view === 'raw' ? 'concierge' : 'raw') && typeof v[view] !== 'string') error(where, `${field} needs its ${view} view${only ? '' : ' (or one text for both)'}`);
  return Object.values(v).filter((x): x is string => typeof x === 'string');
}

function main() {
  const args = process.argv.slice(2);
  const game = loadGame();
  if (args.includes('--catalog')) return void writeCatalog(game);
  if (args.includes('--package')) return void writePackage(game);
  if (args.includes('--check-package')) return void checkPackage(game);
  const dirArg = args.find((a) => !a.startsWith('--'));
  if (!dirArg) { console.error('usage: npm run chapter -- <chapter folder>   |   npm run chapter -- --catalog'); process.exit(2); }
  const dir = resolve(dirArg);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) { console.error(`no chapter folder at ${dirArg}`); process.exit(2); }
  const { files, blocks, unknown } = readChapter(dir);
  if (!files.length) { console.error(`no .md files in ${dirArg}`); process.exit(2); }
  for (const u of unknown) warn(u.split(': "')[0], `"${u.split(': "')[1]}`);

  // the data: every YAML block of a section, read; a list section's blocks put together
  const data = (section: Section): { v: unknown; at: string }[] => blocks.get(section)!.filter((b) => b.lang === 'yaml').flatMap((b) => {
    const at = `${b.file}:${b.line}`, lc = new LineCounter(), doc = parseDocument(b.text, { lineCounter: lc });
    if (doc.errors.length) { for (const e of doc.errors) error(`${b.file}:${b.line + (e.linePos?.[0].line ?? 1) - 1}`, `YAML that cannot be read: ${e.message.split('\n')[0]}`); return []; }
    const v = withLines(doc.contents, lc, b.file, b.line);
    return Array.isArray(v) ? v.map((x) => ({ v: x, at: atOf(x, at) })) : [{ v, at: atOf(v, at) }];
  });
  for (const [section, list] of blocks) for (const b of list) if (b.lang !== 'yaml' && b.lang !== 'ink') warn(`${b.file}:${b.line}`, `a \`${b.lang}\` block under ${section}: only yaml and ink blocks are read`);
  for (const b of blocks.get('Script')!) if (b.lang !== 'ink') error(`${b.file}:${b.line}`, 'the Script is Ink: fence it as ```ink');

  // ----- About
  const about = data('About')[0]?.v as Obj | undefined;
  if (!isObj(about)) error('About', 'needs a yaml block: chapter, title, length, summary');
  else {
    if (typeof about.chapter !== 'number') error('About', 'chapter: its number');
    if (typeof about.title !== 'string') error('About', 'title: the chapter\'s title');
    if (typeof about.summary !== 'string') error('About', 'summary: what happens, in a few sentences');
    if (about.length !== undefined && typeof about.length !== 'number') error('About', 'length: minutes of play, a number');
  }

  // ----- Story state: what the chapter adds to the story's state
  const vars = new Map(game.variables), lists = new Map(game.lists);
  const newVars: string[] = [], newLists: string[] = [];
  for (const { v, at } of data('Story state')) {
    if (!isObj(v)) { error(at, 'Story state is a map: variables, lists'); continue; }
    for (const x of (v.variables as unknown[]) ?? []) {
      if (!isObj(x) || typeof x.name !== 'string' || !NAME.test(x.name)) { error(at, `a variable needs a name: lowercase letters, digits and _ (${JSON.stringify(x)})`); continue; }
      // one the game has, described (new: false): it is there, and not declared again
      if (x.new === false) { if (!game.variables.has(x.name)) error(at, `variable ${x.name}: the game has none (a new one: leave out new: false)`); continue; }
      if (vars.has(x.name)) { error(at, `variable ${x.name}: the game has it already (to describe it, say new: false)`); continue; }
      if (!['boolean', 'number', 'string'].includes(typeof x.start)) error(at, `variable ${x.name}: start must be true/false, a number or "text"`);
      if (typeof x.means !== 'string') warn(at, `variable ${x.name}: say what it means (means: ...)`);
      vars.set(x.name, typeof x.start === 'string' ? JSON.stringify(x.start) : String(x.start));
      newVars.push(x.name);
    }
    for (const x of (v.lists as unknown[]) ?? []) {
      if (!isObj(x) || typeof x.name !== 'string' || !/^[A-Z][A-Za-z0-9]*$/.test(x.name)) { error(at, `a list needs a name in CapitalCase (${JSON.stringify(x)})`); continue; }
      if (lists.has(x.name)) { error(at, `list ${x.name}: the game has it already`); continue; }
      const items = Array.isArray(x.items) ? x.items.map(String) : [];
      if (!items.length) error(at, `list ${x.name}: items, its values`);
      lists.set(x.name, items);
      newLists.push(x.name);
    }
  }

  // ----- Things: what she can carry
  const things = new Map<string, { at: string; v: Obj }>(), gameThings = new Set([...Object.keys(game.items), ...(game.lists.get('Things') ?? [])]);
  for (const { v, at } of data('Things')) {
    if (!isObj(v) || typeof v.id !== 'string' || !NAME.test(v.id)) { error(at, `a thing needs an id: lowercase letters, digits and _ (${JSON.stringify(v).slice(0, 80)})`); continue; }
    const where = `${at} thing ${v.id}`, exists = gameThings.has(v.id);
    if (things.has(v.id)) error(where, 'twice in the chapter');
    if (exists && v.new === true) error(where, 'is in the game already: leave out new: true to change it');
    if (!exists && v.new === false) error(where, 'is not in the game: a new thing (leave out new: false)');
    things.set(v.id, { at, v });
    // a thing the game has: what is given is checked, nothing more is asked for
    const need = !exists;
    viewText(v.name, where, 'name', v.only, need);
    if (isObj(v.name) && !v.only && typeof v.name.concierge === 'string' && typeof v.name.raw === 'string' && v.name.concierge.toLowerCase() !== v.name.raw.toLowerCase())
      warn(where, 'one name in both views ("Map"), so a player always knows what they hold: let the note say how each view sees it');
    for (const n of viewText(v.name, where, 'name', v.only, false)) if (n.length > 10) warn(where, `"${n}" is cut short under its picture in her things: 10 letters at most`);
    viewText(v.note, where, 'note (what her things say of it)', v.only, need);
    viewText(v.look, where, 'look (its picture, a prompt for each view)', v.only, need);
    if ((need || v.size !== undefined) && (typeof v.size !== 'string' || !SIZE.test(v.size))) warn(where, 'size, with its unit ("30 × 22 × 4 cm"), keeps its picture at its real size');
    if (v.only !== undefined && v.only !== 'raw' && v.only !== 'concierge') error(where, 'only: raw or concierge');
  }
  const allThings = new Set([...gameThings, ...things.keys()]);

  // ----- a condition: it reads, and only what the story has
  const condition = (cond: unknown, where: string, field: string) => {
    if (cond === undefined) return;
    if (typeof cond !== 'string') return error(where, `${field} must be a condition, as text`);
    const problem = conditionProblem(cond);
    if (problem) return error(where, `${field} "${cond}": ${problem}`);
    for (const name of variablesIn(cond)) if (!vars.has(name) && !lists.has(name)) error(where, `${field} "${cond}": the story has no ${name} (declare it under Story state)`);
    for (const m of cond.matchAll(/\bhas\s+\(?([a-z0-9_,\s]+)\)?/g)) for (const t of m[1].split(',').map((x) => x.trim()).filter(Boolean)) if (!allThings.has(t) && ![...lists.values()].some((l) => l.includes(t))) error(where, `${field} "${cond}": no thing or list item ${t}`);
  };

  // ----- People
  const people = new Map<string, { at: string; v: Obj }>();
  for (const { v, at } of data('People')) {
    if (!isObj(v) || typeof v.id !== 'string' || !NAME.test(v.id)) { error(at, `a person needs an id: lowercase letters, digits and _, which is also their speaker tag (${JSON.stringify(v).slice(0, 80)})`); continue; }
    const where = `${at} person ${v.id}`;
    if (people.has(v.id)) error(where, 'twice in the chapter');
    people.set(v.id, { at, v });
    // someone the game has (new: false): what is given is checked, nothing more is asked for
    const need = v.new !== false;
    viewText(v.name, where, 'name', v.only, need);
    viewText(v.look, where, 'look (how they are drawn, a prompt for each view)', v.only, need);
    if (need && typeof v.who !== 'string') warn(where, 'who: who they are, in a sentence or two');
    if ((need || v.height !== undefined) && (typeof v.height !== 'string' || !SIZE.test(v.height))) error(where, 'height, with its unit ("1.62 m"): people are drawn at their real height against Luna (1.7 m)');
    if (need && typeof v.pose !== 'string') warn(where, 'pose: standing, sitting, at work: how they are drawn');
    if (need && typeof v.voice !== 'string') warn(where, 'voice: how they talk');
  }

  // ----- Places
  const places = new Map<string, { at: string; v: Obj; spots: Map<string, Obj>; arrivals: Set<string> }>();
  for (const { v, at } of data('Places')) {
    if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id)) { error(at, `a place needs an id: lowercase letters, digits and - (${JSON.stringify(v).slice(0, 80)})`); continue; }
    const where = `${at} place ${v.id}`, exists = game.scenes.has(v.id);
    if (places.has(v.id)) error(where, 'twice in the chapter');
    if (exists && v.new === true) error(where, 'is in the game already: leave out new: true to add to it');
    if (!exists && v.new === false) error(where, 'is not in the game: a new place (leave out new: false)');
    const spots = new Map<string, Obj>(), arrivals = new Set<string>(exists ? game.scenes.get(v.id)!.spawns : []), p0at = at;
    places.set(v.id, { at, v, spots, arrivals });
    // a place the game has: what is given is checked (it describes the place, or changes it), nothing more is asked for
    const need = !exists;
    viewText(v.name, where, 'name', undefined, need);
    if ((need || v.kind !== undefined) && v.kind !== 'interior' && v.kind !== 'exterior') error(where, 'kind: interior or exterior');
    viewText(v.look, where, 'look (the picture, a prompt for each view)', undefined, need);
    if ((need || v.size !== undefined) && (typeof v.size !== 'string' || !SIZE.test(v.size))) error(where, 'size, with its units ("5 m wide, 3 m high"): the place is drawn at its real size against Luna (1.7 m)');
    if (v.width !== undefined && (typeof v.width !== 'number' || v.width < 1 || v.width > 3)) error(where, 'width: screens wide, 1 to 3');
    for (const a of (v.arrivals as unknown[]) ?? []) {
      if (!isObj(a) || typeof a.id !== 'string' || !ID.test(a.id)) { error(where, `an arrival needs an id (${JSON.stringify(a)})`); continue; }
      if (typeof a.where !== 'string') warn(`${where} arrival ${a.id}`, 'where: where she is when she arrives');
      arrivals.add(a.id);
    }
    if (!exists && !arrivals.size) error(where, 'arrivals: at least one place to arrive at');
    const gameSpots = new Set((game.scenes.get(v.id)?.spots ?? []).map((h) => String(h.id)));
    for (const s of [...((v.spots as unknown[]) ?? []), ...((v.ways as unknown[]) ?? [])]) {
      if (!isObj(s) || typeof s.id !== 'string' || !ID.test(s.id)) { error(where, `a spot needs an id: lowercase letters, digits and - (${JSON.stringify(s).slice(0, 80)})`); continue; }
      const sw = `${atOf(s, p0at)} place ${v.id} spot ${s.id}`;
      if (spots.has(s.id)) error(sw, 'twice in this place');
      spots.set(s.id, s);
      if (gameSpots.has(s.id) && s.new === true) error(sw, 'is in the place already');
      // a spot the place has: what is given is checked, nothing more is asked for
      const need = !gameSpots.has(s.id);
      viewText(s.name, sw, 'name', s.only, need);
      if (need && typeof s.where !== 'string') error(sw, 'where: where it is in the place, in words ("on the desk, left of the window")');
      if (need && !s.story && !s.look && !s.to && !s.item && !s.reply) warn(sw, 'nothing to see or do: give it a look, or a story knot');
      if (s.only !== undefined && s.only !== 'raw' && s.only !== 'concierge') error(sw, 'only: raw or concierge');
      for (const f of ['look', 'use', 'take', 'tag', 'reply'] as const) if (s[f] !== undefined) viewText(s[f], sw, f, s.only);
      if (s.kind !== undefined && !['person', 'machine', 'thing'].includes(String(s.kind))) error(sw, 'kind: person, machine or thing');
      if (s.ask !== undefined && typeof s.ask !== 'string') error(sw, 'ask: the Concierge\'s answer, one text (its view only)');
      condition(s.when, sw, 'when');
      if (s.item !== undefined && (typeof s.item !== 'string' || !allThings.has(s.item))) error(sw, `item: ${String(s.item)} is not a thing (add it under Things)`);
      if ((s.prop === true || s.item !== undefined) && (typeof s.size !== 'string' || !SIZE.test(s.size))) warn(sw, 'size, with its unit: a prop is made at its real size');
      if (s.wear !== undefined && !(String(s.wear) in game.outfits)) error(sw, `wear: no outfit ${String(s.wear)} (the game has ${Object.keys(game.outfits).join(', ')})`);
    }
  }
  const allPlaces = new Set([...game.scenes.keys(), ...places.keys()]);
  const arrivalsOf = (place: string) => places.get(place)?.arrivals ?? new Set(game.scenes.get(place)?.spawns ?? []);
  // ways out lead somewhere that is
  for (const [id, p] of places) for (const w of (p.v.ways as Obj[] | undefined) ?? []) {
    if (!isObj(w)) continue;
    const ww = `${atOf(w, p.at)} place ${id} way ${String(w.id)}`;
    if (typeof w.to !== 'string' || !allPlaces.has(w.to)) error(ww, `to: no place ${String(w.to)}`);
    else if (typeof w.arrive !== 'string' || !arrivalsOf(w.to).has(w.arrive)) error(ww, `arrive: ${w.to} has no arrival ${String(w.arrive)} (it has ${[...arrivalsOf(w.to)].join(', ') || 'none'}; add one under its arrivals)`);
  }
  // people are somewhere
  for (const [id, p] of people) for (const at of (p.v.where as unknown[]) ?? []) {
    const pw = `${p.at} person ${id}`;
    if (!isObj(at) || typeof at.place !== 'string') { error(pw, 'where: [{ place, spot?, when? }]'); continue; }
    if (!allPlaces.has(at.place)) error(pw, `where: no place ${at.place}`);
    condition(at.when, pw, 'where.when');
  }
  // things start somewhere
  for (const [id, t] of things) {
    const s = t.v.starts, tw = `${t.at} thing ${id}`;
    if (s === undefined || s === 'given' || s === 'carried') continue;
    const [place, spot] = String(s).split('/');
    if (!allPlaces.has(place)) { error(tw, `starts: no place ${place}`); continue; }
    const there = places.get(place)?.spots.get(spot ?? '') ?? game.scenes.get(place)?.spots.find((h) => h.id === spot);
    if (!there) error(tw, `starts: ${place} has no spot ${String(spot)}`);
    else if (there.item !== id) warn(tw, `starts at ${place}/${spot}: give that spot item: ${id}, so she can take it`);
  }

  // ----- Journal and notebook
  for (const [section, pages] of [['Journal', game.journal], ['Notebook', game.notebook]] as const) {
    const ids = new Set<string>();
    for (const { v, at } of data(section)) {
      if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id)) { error(at, `${section}: an entry needs an id (${JSON.stringify(v).slice(0, 80)})`); continue; }
      const ew = `${at} ${section.toLowerCase()} ${v.id}`;
      if (ids.has(v.id)) error(ew, 'twice'); ids.add(v.id);
      if (typeof v.page !== 'string') error(ew, `page: one of ${pages.map((p) => p.id).join(', ')}, or a new one`);
      else if (!pages.some((p) => p.id === v.page)) warn(ew, `page ${v.page} is new: say its title under Notes`);
      if (typeof v.name !== 'string') error(ew, 'name');
      condition(v.when, ew, 'when');
      condition(v.done, ew, 'done');
      for (const l of (v.lines as unknown[]) ?? []) if (isObj(l)) condition(l.when, ew, 'a line\'s when');
    }
  }

  // ----- Close-ups and machines
  const closeups = new Set(game.closeups), machines = new Set(game.machines);
  for (const { v, at } of data('Close-ups')) {
    if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id)) { error(at, 'a close-up needs an id'); continue; }
    viewText(v.look, `${at} close-up ${v.id}`, 'look (a prompt for each view)');
    closeups.add(v.id);
  }
  for (const { v, at } of data('Machines')) {
    if (!isObj(v) || typeof v.id !== 'string' || !ID.test(v.id)) { error(at, 'a machine needs an id'); continue; }
    const mw = `${at} machine ${v.id}`;
    for (const f of ['name', 'host', 'user']) if (typeof v[f] !== 'string') error(mw, `${f}`);
    if (!isObj(v.users) || !isObj(v.files)) error(mw, 'users and files');
    else {
      if (!(String(v.user) in v.users)) error(mw, `user ${String(v.user)} is not one of its users`);
      for (const [p, f] of Object.entries(v.files)) {
        if (!p.startsWith('/')) error(mw, `file ${p}: a path from /`);
        if (isObj(f)) { condition(f.when, mw, `${p} when`); for (const name of Object.keys((f.read as Obj) ?? {})) if (!vars.has(name)) error(mw, `${p} read: the story has no ${name}`); }
      }
      for (const [u, x] of Object.entries(v.users)) if (isObj(x)) for (const name of Object.keys((x.login as Obj) ?? {})) if (!vars.has(name)) error(mw, `user ${u} login: the story has no ${name}`);
    }
    machines.add(v.id);
  }

  // ----- Puzzles: what they give is in the story
  for (const { v, at } of data('Puzzles')) {
    if (!isObj(v) || typeof v.id !== 'string') { error(at, 'a puzzle needs an id'); continue; }
    if (typeof v.goal !== 'string') error(`${at} puzzle ${v.id}`, 'goal');
    for (const g of (v.gives as unknown[]) ?? []) if (typeof g !== 'string' || (!vars.has(g) && !allThings.has(g))) error(`${at} puzzle ${v.id}`, `gives ${String(g)}: no such variable or thing`);
  }

  // ----- the Script: compiled with the game's story, a knot of the chapter's in place of the game's of that name
  const script = blocks.get('Script')!.filter((b) => b.lang === 'ink');
  const chapterKnots = new Map<string, { file: string; line: number; lines: string[] }>(), chapterHeader: { file: string; line: number; text: string }[] = [];
  for (const b of script) {
    const split = splitInk(b.file, b.text);
    for (const h of split.header) if (h.text.trim()) chapterHeader.push({ ...h, line: b.line + h.line - 1 });
    for (const [k, v] of split.knots) {
      if (chapterKnots.has(k)) error(`${b.file}:${b.line + v.line - 1}`, `knot ${k} twice in the chapter`);
      chapterKnots.set(k, { ...v, line: b.line + v.line - 1 });
    }
  }
  for (const h of chapterHeader) if (!/^\s*(\/\/|VAR\s|LIST\s|CONST\s)/.test(h.text)) error(`${h.file}:${h.line}`, `outside any knot: "${h.text.trim().slice(0, 60)}" (declare variables under Story state; put lines in a knot)`);
  // the source and where each of its lines came from
  const src: string[] = [], from: string[] = [];
  const push = (text: string, where: string) => { src.push(text); from.push(where); };
  for (const h of game.header) {
    if (/^\s*LIST\s+Things\s*=/.test(h.text)) {
      const extra = [...things.keys()].filter((t) => !gameThings.has(t));
      push(extra.length ? h.text.replace(/\s*(\/\/.*)?$/, `, ${extra.join(', ')}`) : h.text, `src/story/${h.file}:${h.line}`);
    } else push(h.text, `src/story/${h.file}:${h.line}`);
  }
  for (const name of newVars) push(`VAR ${name} = ${vars.get(name)}`, 'Story state');
  for (const name of newLists) push(`LIST ${name} = ${lists.get(name)!.join(', ')}`, 'Story state');
  for (const h of chapterHeader) push(h.text, `${h.file}:${h.line}`);
  for (const [name, k] of game.knots) if (!chapterKnots.has(name)) k.lines.forEach((l, i) => push(l, `src/story/${k.file}:${k.line + i}`));
  for (const k of chapterKnots.values()) k.lines.forEach((l, i) => push(l, `${k.file}:${k.line + i}`));
  const compiler = new Compiler(src.join('\n'), new CompilerOptions('chapter', [], false, null, { ResolveInkFilename: (n: string) => n, LoadInkFileContents: () => '' }));
  let compiled: { mainContentContainer: { namedContent: Map<string, { namedContent?: Map<string, unknown> }> } } | null = null;
  try { compiled = compiler.Compile() as never; } catch { /* the errors say why */ }
  const mapLine = (msg: string) => {
    const m = /line (\d+)/.exec(msg);
    return m ? from[Number(m[1]) - 1] ?? 'Script' : 'Script';
  };
  for (const e of compiler.errors) error(mapLine(e), `Ink: ${e.replace(/^ERROR:\s*'chapter'\s*line \d+:\s*/, '')}`);
  for (const w of compiler.warnings) warn(mapLine(w), `Ink: ${w.replace(/^WARNING:\s*'chapter'\s*line \d+:\s*/, '')}`);
  const knotNames = new Set(compiled ? [...compiled.mainContentContainer.namedContent.keys()] : [...game.knots.keys(), ...chapterKnots.keys()]);
  const stitchesOf = (k: string) => new Set(compiled?.mainContentContainer.namedContent.get(k)?.namedContent?.keys() ?? []);

  // knots the data names are there
  const VERBS = new Set(['look', 'talk', 'use', 'take', 'ask']);
  for (const [id, p] of places) for (const s of p.spots.values()) {
    const sw = `${atOf(s, p.at)} place ${id} spot ${String(s.id)}`;
    for (const f of ['story', 'talk'] as const) if (s[f] !== undefined && !knotNames.has(String(s[f]))) error(sw, `${f}: no knot ${String(s[f])} in the Script or the game`);
    if (typeof s.story === 'string' && knotNames.has(s.story)) {
      for (const st of stitchesOf(s.story)) if (st.startsWith('use_') && !allThings.has(st.slice(4))) warn(sw, `knot ${s.story} has ${st}, but there is no thing ${st.slice(4)}`);
      if (![...stitchesOf(s.story)].some((st) => VERBS.has(st) || st.startsWith('use_'))) warn(sw, `knot ${s.story} has no stitch for a verb (look, talk, use, take, ask, use_<thing>): its start runs for Talk only`);
    }
  }
  for (const [id, p] of people) if (p.v.new !== false && typeof p.v.story === 'string' && !knotNames.has(p.v.story)) error(`${p.at} person ${id}`, `story: no knot ${p.v.story}`);
  for (const [id, p] of people) if (p.v.new !== false && p.v.story === undefined) warn(`${p.at} person ${id}`, 'story: their knot; without one, there is nothing to say to them');

  // the chapter's own lines: commands that do something real, speakers who are someone, lengths that fit a screen
  const COMMANDS = ['walk', 'face', 'wear', 'go', 'fade', 'view', 'wait', 'closeup', 'terminal'];
  const speakers = new Set([...game.speakers, ...people.keys()]);
  let lineCount = 0, wordCount = 0;
  for (const k of chapterKnots.values()) k.lines.forEach((raw, i) => {
    const where = `${k.file}:${k.line + i}`, line = raw.replace(/\/\/.*$/, '');
    const [text, ...tags] = line.split('#');
    for (const tag of tags.map((t) => t.trim()).filter(Boolean)) {
      const c = /^([a-z]+)\s*:\s*(.*)$/.exec(tag);
      if (c) {
        const [, name, arg] = c;
        if (!COMMANDS.includes(name)) { warn(where, `# ${tag}: not a command (${COMMANDS.join(', ')}); the game ignores it`); continue; }
        if (name === 'face' && !['left', 'right'].includes(arg)) error(where, '# face: left or right');
        if (name === 'view' && !['raw', 'concierge'].includes(arg)) error(where, '# view: raw or concierge');
        if ((name === 'fade' || name === 'wait') && !(Number(arg) > 0)) error(where, `# ${name}: seconds, a number`);
        if (name === 'wear' && !(arg in game.outfits)) error(where, `# wear: no outfit ${arg}`);
        if (name === 'closeup' && arg !== 'off' && !closeups.has(arg)) error(where, `# closeup: no close-up ${arg} (add it under Close-ups)`);
        if (name === 'terminal' && !machines.has(arg)) error(where, `# terminal: no machine ${arg} (add it under Machines)`);
        if (name === 'go') {
          const [scene, spawn] = arg.split('/').map((x) => x.trim());
          if (!allPlaces.has(scene)) error(where, `# go: no place ${scene}`);
          else if (spawn && !arrivalsOf(scene).has(spawn)) error(where, `# go: ${scene} has no arrival ${spawn}`);
        }
      } else if (NAME.test(tag) && !speakers.has(tag)) warn(where, `#${tag}: nobody of that name (a person's id, or luna, concierge)`);
    }
    const t = text.trim();
    if (!t || /^(=|~|-\s*>|->|\{|\}|-\s*else|VAR|LIST|CONST)/.test(t)) return;
    const choice = /^[*+]+\s*(?:\([^)]*\)\s*)?\[([^\]]*)\]/.exec(t);
    if (choice) { if (words(choice[1]) > 8) warn(where, `a choice of ${words(choice[1])} words: 8 at most`); return; }
    const said = t.replace(/^[-\s]*(?:\([^)]*\)\s*)?/, '').replace(/\{[^}]*\}/g, (m) => m.split('|')[0].replace(/^\{[^:]*:/, '')).replace(/->.*$/, '');
    if (!said.trim()) return;
    lineCount++;
    wordCount += words(said);
    if (words(said) > 25) warn(where, `a line of ${words(said)} words: 25 at most, it is a caption on a small screen`);
  });
  // texts in the data
  for (const [id, p] of places) for (const s of p.spots.values()) for (const f of ['look', 'use', 'take'] as const) {
    const v = s[f], texts = typeof v === 'string' ? [v] : isObj(v) ? Object.values(v).map(String) : [];
    for (const t of texts) if (words(t) > 30) warn(`${atOf(s, p.at)} place ${id} spot ${String(s.id)}`, `${f}: ${words(t)} words; one or two sentences`);
  }
  for (const { v, at } of data('Places')) if (isObj(v)) {
    for (const s of [...((v.spots as unknown[]) ?? []), ...((v.ways as unknown[]) ?? [])]) if (isObj(s)) {
      if (s.rect !== undefined || s.x !== undefined || s.y !== undefined) warn(`${atOf(s, at)} place ${String(v.id)} spot ${String(s.id)}`, 'no positions: say where it is in words; it is placed in the editor');
    }
  }

  // ----- the report
  const errs = issues.filter((i) => i.level === 'error'), warns = issues.filter((i) => i.level === 'warning');
  const title = isObj(about) ? `Chapter ${String(about.chapter)}: ${String(about.title)}` : rel(dir);
  console.log(`\n${title}${isObj(about) && about.length ? ` (about ${String(about.length)} minutes)` : ''}  ·  ${files.length} file${files.length > 1 ? 's' : ''}`);
  for (const i of [...errs, ...warns]) console.log(`  ${i.level === 'error' ? 'error  ' : 'warning'}  ${i.where}: ${i.text}`);
  const newPlaces = [...places.values()].filter((p) => !game.scenes.has(String(p.v.id))).length;
  const newPeople = [...people.values()].filter((p) => p.v.new !== false && !game.speakers.has(String(p.v.id))).length;
  const newThings = [...things.keys()].filter((t) => !gameThings.has(t)).length;
  // props still to make: on spots the game's places do not have yet
  const props = [...places.values()].flatMap((p) => [...p.spots.values()].filter((s) => s.prop === true && !(game.scenes.get(String(p.v.id))?.spots ?? []).some((h) => h.id === s.id))).length;
  const newCloseups = data('Close-ups').filter(({ v }) => isObj(v) && !game.closeups.includes(String(v.id))).length;
  const spots = [...places.values()].reduce((n, p) => n + p.spots.size, 0);
  console.log(`\n  places ${places.size} (${newPlaces} new) · spots ${spots} · people ${people.size} (${newPeople} new) · things ${things.size} (${newThings} new)`);
  console.log(`  story: ${newVars.length} new variables, ${newLists.length} new lists, ${chapterKnots.size} knots (${[...chapterKnots.keys()].filter((k) => game.knots.has(k)).length} of them the game's, rewritten), ${lineCount} lines, ${wordCount} words`);
  // what it takes to make, by what each kind has taken so far (docs/PLAN.md): my working time, the image model's cost
  const hours = [newPlaces * 1.75, newPeople * 1, (newThings + props) * 0.2, newCloseups * 0.25, chapterKnots.size * 0.05].reduce((a, b) => a + b, 0);
  const lo = newPlaces * 1 + newPeople * 1 + (newThings + props) * 0.1 + newCloseups * 0.2, hi = newPlaces * 3 + newPeople * 1.5 + (newThings + props) * 0.2 + newCloseups * 0.3;
  console.log(`  to make: ${newPlaces} places, ${newPeople} people, ${newThings} things and ${props} props, ${newCloseups} close-ups: about ${hours.toFixed(1)} hours of my time and $${lo.toFixed(0)} to $${hi.toFixed(0)} of image generation`);
  console.log(`\n  ${errs.length ? `${errs.length} error${errs.length > 1 ? 's' : ''}` : 'no errors'}, ${warns.length} warning${warns.length === 1 ? '' : 's'}${errs.length ? '' : ': ready to build'}\n`);
  process.exit(errs.length ? 1 : 0);
}

// ---------- the catalog ----------

function writeCatalog(game: Game) {
  const file = join(ROOT, 'docs/chapters/CATALOG.md');
  writeFileSync(file, catalogText(game));
  console.log(`${rel(file)}: ${game.scenes.size} places, ${Object.keys(game.items).length} things, ${game.variables.size} variables, ${game.knots.size} knots`);
}

function catalogText(game: Game): string {
  const view = (v: unknown) => (typeof v === 'string' ? v : isObj(v) ? (v.concierge === v.raw ? String(v.concierge) : `${String(v.concierge ?? '–')} / ${String(v.raw ?? '–')}`) : '');
  const out: string[] = [
    '# What the game has',
    '',
    'Generated from the game by `npm run chapter -- --catalog`: do not edit it by hand. A chapter names these ids to use',
    'what is there already; anything new goes in the chapter itself (docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md).',
    'Names are the Concierge\'s / raw view\'s where they differ.',
    '',
    '## Places',
    '',
  ];
  for (const [id, s] of game.scenes) {
    out.push(`### ${id}: ${s.name}`, '', `${s.kind}${s.private ? ', a privacy zone' : ''}. Arrivals: ${s.spawns.map((x) => `\`${x}\``).join(', ')}.`, '');
    out.push('| Spot | Name | Story | Notes |', '| --- | --- | --- | --- |');
    for (const h of s.spots) {
      const notes = [h.item ? `item \`${String(h.item)}\`` : '', h.go ? `to \`${String((h.go as Obj).scene)}/${String((h.go as Obj).spawn)}\`` : '', h.only ? `${String(h.only)} view only` : '', h.when ? `when \`${String(h.when)}\`` : '', h.wear ? `wear \`${String(h.wear)}\`` : '', h.follows ? 'moves' : ''].filter(Boolean).join(', ');
      out.push(`| \`${String(h.id)}\` | ${view(h.name)} | ${h.story ? `\`${String(h.story)}\`` : h.talk ? `\`${String(h.talk)}\` (talk)` : ''} | ${notes} |`);
    }
    out.push('');
  }
  out.push('## People who speak', '', 'Speaker tags in the story so far: ' + [...game.speakers].filter((s) => s !== 'narration').sort().map((s) => `\`#${s}\``).join(', ') + '. A line without a tag is narration.', '');
  out.push('## Things she can carry', '', '| Thing | Name | Note |', '| --- | --- | --- |');
  for (const [id, it] of Object.entries(game.items)) out.push(`| \`${id}\` | ${view((it as Obj).name)} | ${view((it as Obj).note)} |`);
  out.push('', '## The story\'s state', '', '| Variable | Starts as | What it is |', '| --- | --- | --- |');
  for (const [name, start] of game.variables) out.push(`| \`${name}\` | \`${start}\` | ${(game.means.get(name) ?? '').replace(/\|/g, '\\|')} |`);
  out.push('', 'Lists: ' + [...game.lists].map(([n, items]) => `\`${n}\` (${items.join(', ')})`).join('; ') + '.', '');
  out.push('## Knots', '', [...game.knots.keys()].map((k) => `\`${k}\``).join(', ') + '.', '');
  out.push('## Outfits', '', Object.entries(game.outfits).map(([id, o]) => `\`${id}\` (${String((o as Obj).name)})`).join(', ') + '.', '');
  out.push('## Close-ups and machines', '', `Close-ups: ${game.closeups.map((c) => `\`${c}\``).join(', ') || 'none'}. Machines: ${game.machines.map((m) => `\`${m}\``).join(', ') || 'none'}.`, '');
  out.push('## Journal and notebook pages', '', `Journal: ${game.journal.map((p) => `\`${String(p.id)}\` (${String(p.title)})`).join(', ')}. Notebook: ${game.notebook.map((p) => `\`${String(p.id)}\` (${String(p.title)})`).join(', ')}.`, '');
  return out.join('\n');
}

// ---------- the scripting agent package ----------

/** The folder a scripting agent is given, whole: made from the files it copies, never edited by hand. */
const PACKAGE = join(ROOT, 'docs/scripting-agent-package');
/** What it copies as they are: the world, the director's decisions, the format, and the brief for the first chapter. */
const PACKAGE_DOCS = [
  'docs/story/LIDLESS_Game_Bible_v0.4_2026-10-21.md',
  'docs/story/LIDLESS_Director_Decisions_2026-10-22.md',
  'docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md',
  'docs/story/LIDLESS_Vertical_Slice_v0.1_2026-10-21.md',
];

/** Each file of the package by its name: the docs, the catalog, every chapter's files side by side, the instructions. */
function packageFiles(game: Game): Map<string, string> {
  const files = new Map<string, string>();
  const format = readFileSync(join(ROOT, 'docs/story/LIDLESS_Chapter_Format_v1_2026-10-22.md'), 'utf8');
  const instructions = /## Instructions for the scripting agent[\s\S]*?\n```\n([\s\S]*?)\n```/.exec(format)?.[1];
  if (!instructions) throw new Error('the chapter format has no instructions block under "## Instructions for the scripting agent"');
  // chapters, flat: a project takes files, not folders
  const chapters: string[] = [];
  const dir = join(ROOT, 'docs/chapters');
  for (const c of readdirSync(dir).sort()) {
    if (!statSync(join(dir, c)).isDirectory()) continue;
    for (const f of readdirSync(join(dir, c)).filter((x) => x.endsWith('.md')).sort()) {
      const name = `chapter-${c}-${f}`;
      files.set(name, readFileSync(join(dir, c, f), 'utf8'));
      chapters.push(name);
    }
  }
  files.set('00-HOW-TO-USE.md', howToUse(chapters));
  files.set('INSTRUCTIONS.txt', `${instructions}\n`);
  for (const d of PACKAGE_DOCS) files.set(d.split('/').pop()!, readFileSync(join(ROOT, d), 'utf8'));
  files.set('CATALOG.md', catalogText(game));
  return files;
}

function howToUse(chapters: string[]): string {
  return [
    '# Scripting agent package',
    '',
    'Everything a scripting agent needs to write a chapter of Lidless, in one folder. Made by `npm run agent-package`',
    'from the files it copies: do not edit these copies; edit the originals in `docs/`, and make the package again.',
    '',
    '## Setting up the agent',
    '',
    '1. Upload every file in this folder to the agent\'s project, as its knowledge.',
    '2. Paste `INSTRUCTIONS.txt` into the project\'s instructions.',
    '',
    '## For each chapter',
    '',
    '1. Give the agent a brief: what the chapter is for, what must happen in it, where, and what you have decided for it.',
    '2. It sends `overview.md` first. Read it; tell it to go on, or what to change.',
    '3. It sends one file per place. Save them all in `docs/chapters/<NN>-<name>/`, for example `docs/chapters/01-the-voice-at-three/`.',
    '4. Check it: `npm run chapter -- docs/chapters/<NN>-<name>`. Paste any errors back to the agent, and save what it fixes.',
    '5. When the check shows no errors, the chapter is ready to build.',
    '6. Once it is built, run `npm run agent-package` again and upload the new and changed files (the new chapter, the',
    '   new catalog) to the project, in place of the old ones.',
    '',
    '## What is in it',
    '',
    '| File | What it is |',
    '| --- | --- |',
    '| `INSTRUCTIONS.txt` | The agent\'s instructions: paste into the project. |',
    '| `LIDLESS_Game_Bible_v0.4_2026-10-21.md` | The world, the characters and the story so far: canon. |',
    '| `LIDLESS_Director_Decisions_2026-10-22.md` | The director\'s decisions since the bible: where they differ, these hold. |',
    '| `LIDLESS_Chapter_Format_v1_2026-10-22.md` | How a chapter is written and delivered. |',
    '| `CATALOG.md` | Everything the game has now, by id: places and their spots, people, things, variables, knots. |',
    ...chapters.map((c) => `| \`${c}\` | ${c.startsWith('chapter-00-') ? 'The worked example: the opening, written in the format. Its folder is docs/chapters/00-the-errand/.' : 'A chapter written so far.'} |`),
    '| `LIDLESS_Vertical_Slice_v0.1_2026-10-21.md` | The proposal for chapter 1, the vertical slice, and the decisions it waits on. |',
    '',
  ].join('\n');
}

function writePackage(game: Game) {
  writeCatalog(game);
  const files = packageFiles(game);
  if (!existsSync(PACKAGE)) mkdirSync(PACKAGE, { recursive: true });
  // what is no longer part of it goes
  for (const f of readdirSync(PACKAGE)) if (!files.has(f)) rmSync(join(PACKAGE, f));
  for (const [name, text] of files) writeFileSync(join(PACKAGE, name), text);
  console.log(`${rel(PACKAGE)}/: ${files.size} files, ready to upload`);
}

/** Whether the package is what it would be made now: each copy the same as what it copies. */
function checkPackage(game: Game) {
  const files = packageFiles(game), stale: string[] = [];
  const have = existsSync(PACKAGE) ? new Set(readdirSync(PACKAGE)) : new Set<string>();
  for (const [name, text] of files) if (!have.has(name)) stale.push(`missing ${name}`); else if (readFileSync(join(PACKAGE, name), 'utf8') !== text) stale.push(`out of date ${name}`);
  for (const f of have) if (!files.has(f)) stale.push(`no longer part of it ${f}`);
  if (stale.length) { console.log(`${rel(PACKAGE)}/ is out of date (npm run agent-package):\n  ${stale.join('\n  ')}`); process.exit(1); }
  console.log(`${rel(PACKAGE)}/: up to date, ${files.size} files`);
}

main();
