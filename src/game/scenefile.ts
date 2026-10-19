// Scenes, as the game and the scene editor see them: one file per scene, public/assets/scenes/<id>/scene.json, and
// public/assets/world.json listing them, where the game starts and who the hero is. A scene is built from layers
// (built assets, placed), lights, its inside and outside areas, the walk line, places to arrive and hotspots, some of
// which lead to other scenes.

import { loadSprite, spriteDefaults, type GodrayDef, type LightDef, type LoadedScene, type MoverDef, type SceneDef, type Sprite, type SteamDef } from '../engine/assets';
import { textureFromImage, type GL } from '../engine/gl';
import type { Hotspot, LevelDef } from './level';

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
  name: string;
  /** Exterior: outside air, the sky's cold ambient, rain in raw view. Interior: inside. Areas of the other kind go in zones. */
  kind: 'exterior' | 'interior';
  /** In level pixels; wider than 960 scrolls. */
  size: [number, number];
  layers: LayerDef[];
  lights: LightDef[];
  /** Areas of the other kind than the scene: a shop's inside seen from the street, a window to the outside in a room. */
  zones?: { inside?: Rect[]; outside?: Rect[] };
  /** Or a painted zone map, an asset path (r inside, g outside, b static shade), for scenes made by hand. */
  zoneMap?: string;
  walk: { y: number; x0: number; x1: number };
  /** World y of the line wet surfaces reflect around; by default a little above the walk line. */
  mirror?: number;
  /**
   * How bright the ambient light is, 1 by default: a room with few lamps gets more, evenly and without highlights.
   * One number for both views, or one per view, since a dark raw room can be a white one to the Concierge.
   */
  ambient?: number | { raw?: number; concierge?: number };
  /** The Concierge's greeting here, in its view: "Welcome home, guest." By default "Good evening, guest." */
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
   * around a smaller Lux), over 1 a closeup. Her pace on screen goes with the square root of it: smaller, but not a crawl.
   */
  actorScale?: number;
  /**
   * The scene's own look: the settings it sets its own way over the game's look (public/assets/look.json), shaped like
   * that file but with only those settings: rain, fog, depth of field, the light on its people, anything the look panel
   * has. Tuned in the look panel with "This scene", which saves here.
   */
  look?: Record<string, unknown>;
  /** Things that move through the scene on their own, such as a train along a viaduct. */
  movers?: MoverDef[];
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
  drips?: SceneDef['drips'];
  traffic?: SceneDef['traffic'];
}

export interface WorldFile {
  start: Exit;
  /** cadence: strides (two steps) a second; with a walk that has a stride, her pace follows it, so her feet stay where they land. */
  hero: { sprite: string; speed: number; cadence?: number; smoke?: [number, number]; items?: string[] };
  scenes: string[];
}

export interface Scene {
  file: SceneFile;
  loaded: LoadedScene;
  level: LevelDef;
}

const getJSON = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  return res.json() as Promise<T>;
};

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error(`could not load ${url}`));
  img.src = url;
});

export const loadWorld = (assets: string) => getJSON<WorldFile>(`${assets}/world.json`);
/** A scene file, checked: a mistake in it is reported by name, with every other mistake found, before anything uses it. */
export async function loadSceneFile(assets: string, id: string): Promise<SceneFile> {
  const data = await getJSON<unknown>(`${assets}/scenes/${id}/scene.json`), problems = checkSceneFile(data, id);
  if (problems.length) throw new Error(`scenes/${id}/scene.json: ${problems.join('; ')}`);
  return data as SceneFile;
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
  const f = data as Record<string, unknown>;
  if (!isStr(f.id)) out.push('id is missing');
  else if (id !== undefined && f.id !== id) out.push(`its id is ${f.id}, not ${id}`);
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
    const missing = ['x', 'y', 'z', 'r', 'i', 'zone'].filter((k) => !isNum(l?.[k]));
    if (missing.length) out.push(`lights[${i}] needs ${missing.join(', ')}`);
    if (!nums(l?.c, 3)) out.push(`lights[${i}].c must be [r, g, b]`);
  });
  const spawns = f.spawns as Record<string, Record<string, unknown>> | undefined;
  if (!spawns || typeof spawns !== 'object' || !Object.keys(spawns).length) out.push('spawns must name at least one place to arrive at');
  else for (const [name, sp] of Object.entries(spawns)) if (!isNum(sp?.x) || (sp.facing !== 1 && sp.facing !== -1)) out.push(`spawn ${name} needs x and facing 1 or -1`);
  if (!Array.isArray(f.hotspots)) out.push('hotspots must be a list (it can be empty)');
  else (f.hotspots as Record<string, unknown>[]).forEach((h, i) => {
    const name = isStr(h?.id) ? `hotspot ${h.id}` : `hotspots[${i}]`;
    if (!isStr(h?.id)) out.push(`${name} has no id`);
    if (!nums(h?.rect, 4)) out.push(`${name}: rect must be [x, y, width, height]`);
    if (!viewText(h?.name)) out.push(`${name}: name must be text, or { concierge, raw }`);
    if (h?.look !== undefined && !viewText(h.look)) out.push(`${name}: look must be text, or { concierge, raw }`);
    const go = h?.go as Record<string, unknown> | undefined;
    if (go !== undefined && (!isStr(go?.scene) || !isStr(go?.spawn))) out.push(`${name}: go needs a scene and a spawn to arrive at`);
    if (h?.only !== undefined && h.only !== 'raw' && h.only !== 'concierge') out.push(`${name}: only must be "raw" or "concierge"`);
  });
  if (f.movers !== undefined) {
    if (!Array.isArray(f.movers)) out.push('movers must be a list');
    else (f.movers as Record<string, unknown>[]).forEach((m, i) => {
      if (!isStr(m?.asset)) out.push(`movers[${i}] has no asset`);
      if (!layers?.some((l) => l?.asset === m?.after)) out.push(`movers[${i}] is drawn after ${String(m?.after)}, which is not one of the scene's layers`);
      if (!isNum(m?.x0) || !isNum(m?.x1) || m.x1 <= m.x0) out.push(`movers[${i}] needs x0 and x1, x1 right of x0`);
      if (!isNum(m?.speed) || m.speed <= 0) out.push(`movers[${i}] needs a speed over 0`);
      if (!nums(m?.wait, 2)) out.push(`movers[${i}].wait must be [shortest, longest] in seconds`);
    });
  }
  if (f.drift !== undefined && (!isNum(f.drift) || f.drift < 0)) out.push('drift must be a number of pixels, 0 or more');
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
  effects('steam', 4, ['x', 'y', 'height', 'width'], (e, name) => { if (e?.kind !== 'steam' && e?.kind !== 'smoke') out.push(`${name}.kind must be "steam" or "smoke"`); });
  effects('godrays', 4, ['x', 'y', 'strength', 'zone']);
  effects('beacons', 32, ['x', 'y', 'phase']);
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
  const fallback = spriteDefaults(gl), cache = new Map<string, Promise<Sprite>>();
  const sprite = (path: string) => {
    if (!cache.has(path)) {
      const i = path.lastIndexOf('/');
      cache.set(path, loadSprite(gl, `${assets}/${path.slice(0, i)}`, path.slice(i + 1), fallback, bust));
    }
    return cache.get(path)!;
  };
  const sprites = await Promise.all(file.layers.map(async (layer) => {
    const s = await sprite(layer.asset), d = s.def;
    // each layer has a definition of its own, so the same asset can be placed twice
    return { ...s, def: { ...d, x: layer.x ?? d.x, y: layer.y ?? d.y, parallax: layer.parallax ?? d.parallax, front: layer.front ?? d.front, depth: layer.depth ?? d.depth, facing: layer.facing ?? d.facing, footprint: layer.footprint ?? d.footprint } };
  }));
  const zone = file.zoneMap ? textureFromImage(gl, await loadImage(`${assets}/${file.zoneMap}`), false) : zoneTexture(gl, file);
  const def: SceneDef = {
    name: file.id, size: file.size, sprites: sprites.map((s) => s.def.name), zone: file.zoneMap ?? '',
    lights: file.lights, beacons: file.beacons ?? [], steam: file.steam ?? [], godrays: file.godrays ?? [],
    drips: file.drips, mirror: file.mirror ?? file.walk.y - 8, traffic: file.traffic, ambient: file.ambient, exposure: file.exposure, baked: file.baked, actorScale: file.actorScale,
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
  return { file, loaded: { def, sprites, zone, movers }, level };
}
