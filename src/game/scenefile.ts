// Scenes, as the game and the scene editor see them: one file per scene, public/assets/scenes/<id>/scene.json, and
// public/assets/world.json listing them, where the game starts and who the hero is. A scene is built from layers
// (built assets, placed), lights, its inside and outside areas, the walk line, places to arrive and hotspots, some of
// which lead to other scenes.

import { loadSprite, spriteDefaults, type GodrayDef, type LightDef, type LoadedScene, type SceneDef, type Sprite, type SteamDef } from '../engine/assets';
import { textureFromImage, type GL } from '../engine/gl';
import type { Hotspot, LevelDef } from './level';

export type Rect = [number, number, number, number];

export interface LayerDef {
  /** A built asset: scene/name under assets. */
  asset: string;
  /** Where it goes in the scene; by default where the asset's sprite.json puts it. */
  x?: number;
  y?: number;
  parallax?: number;
  depth?: number;
  /** For a character: which way it faces, -1 for left. It plays its idle loop where it stands. */
  facing?: 1 | -1;
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
  hero: { sprite: string; speed: number; smoke?: [number, number] };
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
export const loadSceneFile = (assets: string, id: string) => getJSON<SceneFile>(`${assets}/scenes/${id}/scene.json`);

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
    return { ...s, def: { ...d, x: layer.x ?? d.x, y: layer.y ?? d.y, parallax: layer.parallax ?? d.parallax, depth: layer.depth ?? d.depth, facing: layer.facing ?? d.facing } };
  }));
  const zone = file.zoneMap ? textureFromImage(gl, await loadImage(`${assets}/${file.zoneMap}`), false) : zoneTexture(gl, file);
  const def: SceneDef = {
    name: file.id, size: file.size, sprites: sprites.map((s) => s.def.name), zone: file.zoneMap ?? '',
    lights: file.lights, beacons: file.beacons ?? [], steam: file.steam ?? [], godrays: file.godrays ?? [],
    drips: file.drips, mirror: file.mirror ?? file.walk.y - 8, traffic: file.traffic,
  };
  const level: LevelDef = {
    walk: file.walk,
    hero: { sprite: world.hero.sprite, x: Object.values(file.spawns)[0]?.x ?? file.size[0] / 2, speed: world.hero.speed, smoke: world.hero.smoke },
    hotspots: file.hotspots,
  };
  return { file, loaded: { def, sprites, zone }, level };
}
