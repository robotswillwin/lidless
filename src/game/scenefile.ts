// Scenes, as the game and the scene editor see them: one file per scene, public/assets/scenes/<id>/scene.json, and
// public/assets/world.json listing them, where the game starts and who the hero is. A scene is built from layers
// (built assets, placed), lights, its inside and outside areas, the walk line, places to arrive and hotspots, some of
// which lead to other scenes.

import { fetchSprite, imageFromBlob, loadBlob, makeSprite, spriteDefaults, WAVES, type FetchedSprite, type GodrayDef, type GroundDef, type LoadedScene, type Only, type Views, type MoverDef, type SceneDef, type ScopeDef, type Sprite, type SteamDef } from '../engine/assets';
import { presets, type PlacedLight } from '../engine/presets';
import { conditionProblem } from './conditions';
import { textureFromImage, type GL } from '../engine/gl';
import type { Hotspot, LevelDef, ViewText } from './level';
import type { MapLayout } from './map';
import type { Noticed } from './privacy';
import type { Rotation } from './rotate';
import type { Outfits } from './outfits';

export type Rect = [number, number, number, number];

export interface LayerDef {
  /** A built asset: scene/name under assets. */
  asset: string;
  /** Where it goes in the scene; by default where the asset's sprite.json puts it. */
  x?: number;
  y?: number;
  /** How fast it moves with the camera: 1 with the street, under 1 further away, over 1 nearer. */
  parallax?: number;
  depth?: number;
  /** Drawn in front of the people: a layer nearer than the walk line. */
  front?: boolean;
  /** For a character: which way it faces, -1 for left. It plays its idle loop where it stands. */
  facing?: 1 | -1;
  /** For a character: half the width of its shadow on the ground, in pixels; 0 for none. */
  footprint?: number;
  /** Only in one view in this scene: a hologram over the street in the Concierge's, a scrawl only raw view shows. */
  only?: Only;
  /** Placed elsewhere in one view. */
  views?: Views<{ x: number; y: number }>;
  /** There only while this condition on the story holds (see conditions.ts): a window broken, a sign that comes on. */
  when?: string;
}

/** Where a door or an edge leads: a scene, and the place there to arrive at. */
export interface Exit {
  scene: string;
  spawn: string;
}

export interface Spawn {
  x: number;
  facing: 1 | -1;
}

export interface SceneFile {
  id: string;
  /** On the map and her saves: the same in both views, or as each names it ({ concierge: Cocktail bar, raw: Bar }). */
  name: ViewText;
  /** Exterior: outside air, the sky's cold ambient, rain in raw view. Interior: inside. Areas of the other kind go in zones. */
  kind: 'exterior' | 'interior';
  /**
   * A close-up of a place (the place's id): a desk, a workbench, seen close. She is not drawn in it and nothing is walked
   * to: a tap on a thing does what it is for, the verbs as anywhere; Back returns her to where she stood. It needs no walk
   * or places to arrive at. Not on the map; for the story she is still in the place (scene_now).
   */
  closeup?: string;
  /** In level pixels; wider than 960 scrolls. */
  size: [number, number];
  layers: LayerDef[];
  /** Each its place and, if it is one of a kind, its preset, with what it does its own way (see presets.ts). */
  lights: PlacedLight[];
  /** Areas of the other kind than the scene: a shop's inside seen from the street, a window to the outside in a room. */
  zones?: { inside?: Rect[]; outside?: Rect[] };
  /** Or a painted zone map, an asset path (r inside, g outside, b static shade), for scenes made by hand. */
  zoneMap?: string;
  walk: { y: number; x0: number; x1: number };
  /** World y of the line wet surfaces reflect around; by default a little above the walk line. */
  mirror?: number;
  /** The ground the engine draws below the reflection line, over a painted floor smoothed for it: slabs, a kerb, puddles. */
  ground?: GroundDef;
  /**
   * How bright the ambient light is, 1 by default: a room with few lamps gets more, evenly and without highlights.
   * One number for both views, or one per view, since a dark raw room can be a white one to the Concierge.
   */
  ambient?: number | { raw?: number; concierge?: number };
  /** The Concierge's greeting here, in its view: "Welcome home, Luna." By default "Good evening, Luna." */
  greeting?: string;
  /** What the Concierge says when she rings for assistance here: its hint, for now. */
  assist?: string;
  /** Exposure in stops, 0 by default; one number, or one per view. */
  exposure?: number | { raw?: number; concierge?: number };
  /**
   * How much of the set's light is painted into its art, 0 to 1; one number, or one per view. 0 (the default) lights the
   * set with the scene's lights alone, as art drawn flat needs; 1 shows art with its night painted in as painted, the
   * lights only adding a little. The characters are lit by the lights either way.
   */
  baked?: number | { raw?: number; concierge?: number };
  /**
   * How big the people are drawn here, 1 by default: under 1 the camera is further back (0.6 shows more of the place
   * around a smaller Luna), over 1 a closeup. Her pace on screen goes with the square root of it: smaller, but not a crawl.
   */
  actorScale?: number;
  /** Her home: she takes off her coat here as she comes in, and a hotspot that is her wardrobe lets her change clothes. */
  wardrobe?: boolean;
  /**
   * A privacy zone: her home, the public restroom, and later approved meeting rooms. The law the Concierge keeps forbids
   * it to see or hear anyone there (it may still see who goes in and out). Her paper notebook opens only here. It answers
   * when she asks it, with the bell.
   */
  private?: boolean;
  /**
   * A private home, hers or a friend's: from here she can call the Concierge, Talk in its card, and its privacy sign
   * opens while the call lasts (decision 30). A public privacy room (a restroom, a meeting room) cannot be called from.
   */
  home?: boolean;
  /**
   * As she arrives here from somewhere else, the first of these whose condition holds runs its knot of the story: the
   * Concierge's question as she steps out of a friend's flat.
   */
  arrive?: { story: string; when?: string }[];
  /**
   * She does not leave this place while a condition holds, by any way out, the map too: she says why instead (her
   * messages first, the morning she wakes). A story taking her somewhere still does.
   */
  stay?: { when: string; say: ViewText };
  /**
   * A privacy room whose door the Concierge sees (a public restroom): it notices a long stay, or coming too often, and
   * says so as she comes out (see privacy.ts).
   */
  noticed?: Noticed;
  /**
   * The scene's own look: the settings it sets its own way over the game's look (public/assets/look.json), shaped like
   * that file but with only those settings: rain, fog, depth of field, the light on its people, anything the look panel
   * has. Tuned in the look panel with "This scene", which saves here.
   */
  look?: Record<string, unknown>;
  /**
   * The scene in other conditions, by name ("rain", "fog", "outage"): each its own look settings over the scene's, as
   * the story's `conditions` or the address's `variant` asks for it.
   */
  variants?: Record<string, { name?: string; look?: Record<string, unknown> }>;
  /** Things that move through the scene on their own, such as a train along a viaduct. */
  movers?: MoverDef[];
  /**
   * What it shows by turns: story variables the game sets as she arrives, each to the next of its values (see
   * rotate.ts). Who sits at the station: `{ "station_seat": { "values": ["woman", "", "man"], "from": "has_raw" } }`.
   */
  rotate?: Record<string, Rotation>;
  /**
   * In a scene no wider than the screen: how far the camera leans with the hero as she walks from one end to the other,
   * in pixels, 0 (the default) for none. The street she walks on stays put; the other layers slide against it by how
   * far they are from it, the sky (parallax 0) by this much, nearer layers (over 1) the other way.
   */
  drift?: number;
  spawns: Record<string, Spawn>;
  hotspots: Hotspot[];
  beacons?: SceneDef['beacons'];
  steam?: SteamDef[];
  godrays?: GodrayDef[];
  scopes?: ScopeDef[];
  drips?: SceneDef['drips'];
  traffic?: SceneDef['traffic'];
}

export interface WorldFile {
  start: Exit;
  /** The time a new game starts at, "07:12"; a save keeps its own. 21:40 where none is given. */
  clock?: string;
  /** The thing she must carry for her paper notebook to open (her notebook is a thing in her pockets): none, always. */
  notebook?: string;
  /**
   * cadence: strides (two steps) a second; with a walk that has a stride, her pace follows it, so her feet stay where
   * they land. jogCadence and runCadence: the same jogging and running (by default 1.3 and 1.45 times the walk's).
   * jogFrom and runFrom: sent further than this many times her height on screen, she jogs (2.5 by default), and runs
   * (5 by default).
   */
  hero: {
    sprite: string; speed: number; cadence?: number; jogCadence?: number; runCadence?: number; jogFrom?: number; runFrom?: number; smoke?: [number, number]; items?: string[];
    /** What she can wear, each a sprite of its own (see outfits.ts); without any, she always wears `sprite`. */
    outfits?: Outfits;
    /** The outfit she starts in; the first one if none is given. */
    outfit?: string;
  };
  scenes: string[];
  /** Where each place is drawn on the map (see map.ts). */
  map?: MapLayout;
}

export interface Scene {
  file: SceneFile;
  loaded: LoadedScene;
  level: LevelDef;
  /** Everything it put on the GPU, to let go of when it is no longer near her (freeScene). */
  textures: WebGLTexture[];
}

/** A scene's files fetched, none of it decoded or on the GPU yet: a scene she may go to next. */
export interface FetchedScene {
  file: SceneFile;
  sprites: Map<string, Promise<FetchedSprite>>;
  zone?: Promise<Blob>;
}

const getJSON = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  return res.json() as Promise<T>;
};

export const loadWorld = (assets: string) => getJSON<WorldFile>(`${assets}/world.json`);
/** A scene file, checked: a mistake in it is reported by name, with every other mistake found, before anything uses it. */
export async function loadSceneFile(assets: string, id: string): Promise<SceneFile> {
  const data = withCloseupDefaults(await getJSON<unknown>(`${assets}/scenes/${id}/scene.json`)), problems = checkSceneFile(data, id);
  if (problems.length) throw new Error(`scenes/${id}/scene.json: ${problems.join('; ')}`);
  return data as SceneFile;
}

/** A close-up has no walk and no places to arrive at of its own: the whole of it, and its middle. */
export function withCloseupDefaults(data: unknown): unknown {
  const f = data as Partial<SceneFile> | null;
  if (!f || typeof f !== 'object' || typeof f.closeup !== 'string' || !Array.isArray(f.size)) return data;
  const [w, h] = f.size;
  return { ...f, walk: f.walk ?? { y: h - 1, x0: 0, x1: w }, spawns: f.spawns ?? { in: { x: w / 2, facing: 1 } }, lights: f.lights ?? [] };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const nums = (v: unknown, n: number) => Array.isArray(v) && v.length === n && v.every(isNum);
const viewText = (v: unknown) => isStr(v) || (!!v && typeof v === 'object' && isStr((v as { concierge?: unknown }).concierge) && isStr((v as { raw?: unknown }).raw));

/**
 * What is wrong with a scene file, in words: missing or mistyped fields, an exit without a place to arrive at, a mover
 * drawn after a layer the scene does not have. Empty when it is fine. The fields the game does without are not required.
 */
export function checkSceneFile(data: unknown, id?: string): string[] {
  const out: string[] = [];
  if (!data || typeof data !== 'object') return ['it is not a JSON object'];
  const f = withCloseupDefaults(data) as Record<string, unknown>;
  if (!isStr(f.id)) out.push('id is missing');
  else if (id !== undefined && f.id !== id) out.push(`its id is ${f.id}, not ${id}`);
  if (f.name !== undefined && !viewText(f.name)) out.push('name must be text, or { concierge, raw }');
  if (f.kind !== 'exterior' && f.kind !== 'interior') out.push('kind must be "exterior" or "interior"');
  if (!nums(f.size, 2)) out.push('size must be [width, height]');
  const walk = f.walk as Record<string, unknown> | undefined;
  if (!walk || !isNum(walk.y) || !isNum(walk.x0) || !isNum(walk.x1)) out.push('walk needs y, x0 and x1');
  else if (walk.x1 <= walk.x0) out.push('walk.x1 must be right of walk.x0');
  const layers = Array.isArray(f.layers) ? (f.layers as Record<string, unknown>[]) : null;
  if (!layers?.length) out.push('layers must list at least one built asset');
  else layers.forEach((l, i) => { if (!l || !isStr(l.asset)) out.push(`layers[${i}] has no asset`); });
  if (!Array.isArray(f.lights)) out.push('lights must be a list (it can be empty)');
  else (f.lights as Record<string, unknown>[]).forEach((l, i) => {
    // one of a kind needs only its place: its preset has the rest; one of its own needs everything
    const kinds = presets().lights, preset = l?.preset;
    if (preset !== undefined && (!isStr(preset) || (Object.keys(kinds).length && !kinds[preset]))) out.push(`lights[${i}]: there is no preset ${String(preset)} (public/assets/presets.json)`);
    const missing = (preset === undefined ? ['x', 'y', 'z', 'r', 'i', 'zone'] : ['x', 'y']).filter((k) => !isNum(l?.[k]));
    if (missing.length) out.push(`lights[${i}] needs ${missing.join(', ')}`);
    if (preset === undefined ? !nums(l?.c, 3) : l?.c !== undefined && l.c !== null && !nums(l.c, 3)) out.push(`lights[${i}].c must be [r, g, b]`);
  });
  if (f.variants !== undefined) {
    if (!f.variants || typeof f.variants !== 'object' || Array.isArray(f.variants)) out.push('variants must be an object of variants by name');
    else for (const [k, v] of Object.entries(f.variants as Record<string, unknown>)) {
      if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(k)) out.push(`variant “${k}” needs a name of lower case letters, digits and dashes`);
      if (!v || typeof v !== 'object' || Array.isArray(v)) out.push(`variant ${k} must be an object: { name, look }`);
    }
  }
  const spawns = f.spawns as Record<string, Record<string, unknown>> | undefined;
  if (!spawns || typeof spawns !== 'object' || !Object.keys(spawns).length) out.push('spawns must name at least one place to arrive at');
  else for (const [name, sp] of Object.entries(spawns)) if (!isNum(sp?.x) || (sp.facing !== 1 && sp.facing !== -1)) out.push(`spawn ${name} needs x and facing 1 or -1`);
  if (!Array.isArray(f.hotspots)) out.push('hotspots must be a list (it can be empty)');
  else (f.hotspots as Record<string, unknown>[]).forEach((h, i) => {
    const name = isStr(h?.id) ? `hotspot ${h.id}` : `hotspots[${i}]`;
    if (!isStr(h?.id)) out.push(`${name} has no id`);
    if (!nums(h?.rect, 4)) out.push(`${name}: rect must be [x, y, width, height]`);
    if (!viewText(h?.name)) out.push(`${name}: name must be text, or { concierge, raw }`);
    for (const k of ['look', 'use', 'take', 'reply'] as const) if (h?.[k] !== undefined && !viewText(h[k])) out.push(`${name}: ${k} must be text, or { concierge, raw }`);
    if (h?.kind !== undefined && !['person', 'machine', 'thing', 'way'].includes(h.kind as string)) out.push(`${name}: kind must be "person", "machine", "thing" or "way"`);
    const go = h?.go as Record<string, unknown> | undefined;
    if (go !== undefined && (!isStr(go?.scene) || !isStr(go?.spawn))) out.push(`${name}: go needs a scene and a spawn to arrive at`);
    if (h?.only !== undefined && h.only !== 'raw' && h.only !== 'concierge') out.push(`${name}: only must be "raw" or "concierge"`);
    for (const k of ['story', 'item'] as const) if (h?.[k] !== undefined && !isStr(h[k])) out.push(`${name}: ${k} must be a name`);
    if (h?.when !== undefined) { const p = isStr(h.when) ? conditionProblem(h.when) : 'it must be text'; if (p) out.push(`${name}: when: ${p}`); }
  });
  // a layer or a light there only when a condition holds
  for (const [list, items] of [['layers', layers ?? []], ['lights', Array.isArray(f.lights) ? (f.lights as Record<string, unknown>[]) : []]] as const) {
    items.forEach((x, i) => { if (x?.when !== undefined) { const p = isStr(x.when) ? conditionProblem(x.when) : 'it must be text'; if (p) out.push(`${list}[${i}]: when: ${p}`); } });
  }
  if (f.noticed !== undefined) {
    const n = f.noticed as Record<string, unknown>;
    if (!n || !isNum(n.after) || !isNum(n.often) || !isNum(n.within) || typeof n.long !== 'string' || typeof n.again !== 'string') out.push('noticed needs after, often and within (numbers), long and again (what it says)');
  }
  if (f.rotate !== undefined) {
    if (!f.rotate || typeof f.rotate !== 'object' || Array.isArray(f.rotate)) out.push('rotate must be an object of story variables');
    else for (const [name, r] of Object.entries(f.rotate as Record<string, { values?: unknown; from?: unknown }>)) {
      if (!Array.isArray(r?.values) || !r.values.length || r.values.some((v) => typeof v !== 'string')) out.push(`rotate.${name} needs values, a list of words`);
      if (r?.from !== undefined && (typeof r.from !== 'string' || conditionProblem(r.from))) out.push(`rotate.${name}.from is no condition: ${String(r.from)}`);
    }
  }
  if (f.movers !== undefined) {
    if (!Array.isArray(f.movers)) out.push('movers must be a list');
    else (f.movers as Record<string, unknown>[]).forEach((m, i) => {
      if (!isStr(m?.asset)) out.push(`movers[${i}] has no asset`);
      if (!layers?.some((l) => l?.asset === m?.after)) out.push(`movers[${i}] is drawn after ${String(m?.after)}, which is not one of the scene's layers`);
      if (!isNum(m?.x0) || !isNum(m?.x1) || m.x1 <= m.x0) out.push(`movers[${i}] needs x0 and x1, x1 right of x0`);
      if (!isNum(m?.speed) || m.speed <= 0) out.push(`movers[${i}] needs a speed over 0`);
      const st = m?.stops as { x?: unknown; seconds?: unknown }[] | undefined;
      if (st !== undefined && (!Array.isArray(st) || st.some((s) => !isNum(s?.x) || !isNum(s?.seconds) || (s.seconds as number) < 0))) out.push(`movers[${i}].stops: each needs x and seconds`);
      if (m?.patrol !== undefined && typeof m.patrol !== 'boolean') out.push(`movers[${i}].patrol must be true or false`);
      const bob = m?.bob as unknown[] | undefined;
      if (bob !== undefined && (!Array.isArray(bob) || bob.length !== 2 || !bob.every(isNum))) out.push(`movers[${i}].bob needs [pixels, seconds]`);
      const ls = m?.lights as Record<string, unknown>[] | undefined;
      if (ls !== undefined && (!Array.isArray(ls) || ls.some((l) => !Array.isArray(l?.at) || !isNum(l?.length) || !Array.isArray(l?.colour)))) out.push(`movers[${i}].lights: each needs at [x, y], a length and a colour [r, g, b]`);
      if (!nums(m?.wait, 2)) out.push(`movers[${i}].wait must be [shortest, longest] in seconds`);
    });
  }
  if (f.drift !== undefined && (!isNum(f.drift) || f.drift < 0)) out.push('drift must be a number of pixels, 0 or more');
  if (f.ground !== undefined) {
    const g = f.ground as Partial<GroundDef>;
    if (!isNum(g.horizon)) out.push('ground.horizon must be the world y of the eye');
    else {
      const line = isNum(f.mirror) ? f.mirror : isNum(walk?.y) ? walk.y - 8 : undefined;
      if (line !== undefined && g.horizon >= line) out.push('ground.horizon must be above the reflection line');
    }
    if (g.slab !== undefined && (!nums(g.slab, 2) || g.slab.some((v) => v < 0))) out.push('ground.slab must be [width, depth], 0 or more');
    if (g.kerb !== undefined && (!isNum(g.kerb) || g.kerb < 0 || g.kerb >= 900)) out.push('ground.kerb must be 0 to 900 pixels in front of the walk line');
    if (g.puddles !== undefined && (!isNum(g.puddles) || g.puddles < 0 || g.puddles > 1)) out.push('ground.puddles must be 0 to 1');
  }
  // effects: what each needs, and how many the renderer draws
  const effects = (key: string, max: number, needs: string[], extra?: (e: Record<string, unknown>, name: string) => void) => {
    const list = f[key];
    if (list === undefined) return;
    if (!Array.isArray(list)) { out.push(`${key} must be a list`); return; }
    if (list.length > max) out.push(`${key}: at most ${max} are drawn, this scene has ${list.length}`);
    (list as Record<string, unknown>[]).forEach((e, i) => {
      const missing = needs.filter((k) => !isNum(e?.[k]));
      if (missing.length) out.push(`${key}[${i}] needs ${missing.join(', ')}`);
      extra?.(e, `${key}[${i}]`);
    });
  };
  effects('steam', 4, ['x', 'y', 'height', 'width'], (e, name) => {
    if (e?.kind !== 'steam' && e?.kind !== 'smoke') out.push(`${name}.kind must be "steam" or "smoke"`);
    if (e?.parallax !== undefined && !isNum(e.parallax)) out.push(`${name}.parallax must be a number`);
  });
  effects('godrays', 4, ['x', 'y', 'strength', 'zone']);
  effects('beacons', 32, ['x', 'y', 'phase']);
  effects('scopes', 2, ['x', 'y', 'r'], (e, name) => {
    if (e?.shape !== undefined && !(WAVES as readonly unknown[]).includes(e.shape)) out.push(`${name}.shape must be one of ${WAVES.join(', ')}`);
    if (e?.wave !== undefined && (!isStr(e.wave) || !/^[a-z_][a-z0-9_]*$/.test(e.wave))) out.push(`${name}.wave must name a story variable`);
    if (e?.when !== undefined) { const p = isStr(e.when) ? conditionProblem(e.when) : 'it must be text'; if (p) out.push(`${name}: when: ${p}`); }
  });
  if (f.drips !== undefined) {
    const d = f.drips as Record<string, unknown>;
    if (!d || !['x0', 'x1', 'top', 'bottom'].every((k) => isNum(d[k]))) out.push('drips needs x0, x1, top and bottom');
  }
  return out;
}

/**
 * The zone map, from the scene's kind and its areas of the other kind: r inside, g outside, b static shade. Drawn at a
 * quarter of the scene's size; the renderer's filtering softens the edges between areas.
 */
export function zoneTexture(gl: GL, file: SceneFile): WebGLTexture {
  const S = 4, w = Math.max(1, Math.ceil(file.size[0] / S)), h = Math.max(1, Math.ceil(file.size[1] / S));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext('2d')!;
  const inside = 'rgb(255,0,255)', outside = 'rgb(0,255,255)';
  cx.fillStyle = file.kind === 'interior' ? inside : outside;
  cx.fillRect(0, 0, w, h);
  const paint = (rects: Rect[] | undefined, colour: string) => {
    cx.fillStyle = colour;
    for (const [x, y, rw, rh] of rects ?? []) cx.fillRect(x / S, y / S, rw / S, rh / S);
  };
  paint(file.zones?.inside, inside);
  paint(file.zones?.outside, outside);
  return textureFromImage(gl, cv, false);
}

/** A scene ready to play: its layers loaded and placed, its zone map, and its level data for the hero. */
export async function buildScene(gl: GL, assets: string, file: SceneFile, world: WorldFile, bust = ''): Promise<Scene> {
  return makeScene(gl, fetchScene(assets, file, bust), world);
}

/**
 * A scene's files fetched: every asset it places, each once, and its zone map. Nothing is decoded or put on the GPU, so
 * a scene she may go to next costs only its files' bytes until she does. A failure shows when the scene is made.
 */
export function fetchScene(assets: string, file: SceneFile, bust = ''): FetchedScene {
  const quiet = <T>(p: Promise<T>) => { p.catch(() => {}); return p; };
  const sprites = new Map<string, Promise<FetchedSprite>>();
  for (const path of [...file.layers.map((l) => l.asset), ...(file.movers ?? []).map((m) => m.asset)]) {
    const i = path.lastIndexOf('/');
    if (!sprites.has(path)) sprites.set(path, quiet(fetchSprite(`${assets}/${path.slice(0, i)}`, path.slice(i + 1), bust)));
  }
  return { file, sprites, zone: file.zoneMap ? quiet(loadBlob(`${assets}/${file.zoneMap}${bust ? `?v=${bust}` : ''}`)) : undefined };
}

/** A fetched scene decoded and put on the GPU. */
export async function makeScene(gl: GL, fetched: FetchedScene, world: WorldFile): Promise<Scene> {
  const { file } = fetched, fallback = spriteDefaults(gl), cache = new Map<string, Promise<Sprite>>();
  const sprite = (path: string) => {
    if (!cache.has(path)) cache.set(path, (fetched.sprites.get(path) ?? Promise.reject(new Error(`${file.id}: ${path} was not fetched`))).then((f) => makeSprite(gl, f, fallback)));
    return cache.get(path)!;
  };
  const sprites = await Promise.all(file.layers.map(async (layer) => {
    const s = await sprite(layer.asset), d = s.def;
    // each layer has a definition of its own, so the same asset can be placed twice
    return { ...s, def: { ...d, x: layer.x ?? d.x, y: layer.y ?? d.y, parallax: layer.parallax ?? d.parallax, front: layer.front ?? d.front, depth: layer.depth ?? d.depth, facing: layer.facing ?? d.facing, footprint: layer.footprint ?? d.footprint, only: layer.only, views: layer.views, when: layer.when } };
  }));
  const zone = fetched.zone ? textureFromImage(gl, await imageFromBlob(await fetched.zone, file.zoneMap), false) : zoneTexture(gl, file);
  const def: SceneDef = {
    name: file.id, size: file.size, sprites: sprites.map((s) => s.def.name), zone: file.zoneMap ?? '',
    lights: file.lights, beacons: file.beacons ?? [], steam: file.steam ?? [], godrays: file.godrays ?? [], scopes: file.scopes ?? [],
    drips: file.drips, mirror: file.mirror ?? file.walk.y - 8, ground: file.ground, traffic: file.traffic, ambient: file.ambient, exposure: file.exposure, baked: file.baked, actorScale: file.actorScale,
  };
  const level: LevelDef = {
    walk: file.walk,
    hero: { sprite: world.hero.sprite, x: Object.values(file.spawns)[0]?.x ?? file.size[0] / 2, speed: world.hero.speed * Math.sqrt(file.actorScale ?? 1), smoke: world.hero.smoke },
    hotspots: file.hotspots,
  };
  const movers = await Promise.all((file.movers ?? []).map(async (m) => {
    const after = file.layers.findIndex((l) => l.asset === m.after);
    if (after < 0) throw new Error(`${file.id}: a mover is drawn after ${m.after}, which is not one of its layers`);
    return { def: m, sprite: await sprite(m.asset), after };
  }));
  // everything it put on the GPU, each once: its sprites' maps, the stand-ins they share, its zone map
  const textures = new Set<WebGLTexture>([zone, ...Object.values(fallback)]);
  for (const s of [...sprites, ...movers.map((m) => m.sprite)]) for (const t of Object.values(s.tex)) textures.add(t);
  return { file, loaded: { def, sprites, zone, movers }, level, textures: [...textures] };
}

/** Let a scene's textures go: it is no longer near her. Not while it is on screen. */
export function freeScene(gl: GL, scene: Scene): void {
  for (const t of scene.textures) gl.deleteTexture(t);
  scene.textures = [];
}
