// Loads scenes and sprites in the asset contract format (see docs/ASSETS.md).

import { solidTexture, textureFromImage, type GL } from './gl';

export type MapName = 'albedo.raw' | 'albedo.concierge' | 'normal' | 'material' | 'meta' | 'glow.raw' | 'glow.concierge';

export interface SpriteDef {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  maps: MapName[];
  /** 0 sky, 1 far, 2 middle, 3 near. Drives depth of field and which lights reach it. */
  depth: number;
  /** How fast the layer moves with the camera: 1 moves with the street, 0 stays put. */
  parallax: number;
  /** Used when the sprite has no meta map. */
  occluder?: number;
  reflectivity?: number;
  object?: number;
}

export interface LightDef {
  x: number;
  y: number;
  z: number;
  r: number;
  c: [number, number, number];
  i: number;
  /** 0 everywhere, 1 inside, 2 outside (near layer only), 3 facade, 4 outside at every depth. */
  zone: number;
  wrap?: number;
  haze?: number;
  cone?: [number, number, number];
  shadow?: number;
  /** Light group: animated intensity (flicker, pulse). */
  g?: number;
  /** Exists only in Concierge view. */
  ar?: number;
  /** Object id this light does not light (its own housing). */
  ex?: number;
}

export interface SteamDef { x: number; y: number; height: number; width: number; kind: 'steam' | 'smoke' }
export interface GodrayDef { x: number; y: number; strength: number; zone: number; ar?: number }

export interface SceneDef {
  name: string;
  size: [number, number];
  sprites: string[];
  /** World-space zone map: r inside, g outside, b static ambient occlusion. */
  zone: string;
  lights: LightDef[];
  beacons: { x: number; y: number; phase: number }[];
  steam: SteamDef[];
  godrays: GodrayDef[];
  drips?: { x0: number; x1: number; top: number; bottom: number };
  /** World y of the line wet surfaces reflect around. */
  mirror: number;
  /** Flying traffic far away; ar = only in Concierge view. */
  traffic?: { lanes: number[]; perLane: number; x0: number; span: number; ar?: number };
}

export interface Sprite {
  def: SpriteDef;
  tex: Record<MapName, WebGLTexture>;
  hasMeta: boolean;
}

export interface LoadedScene {
  def: SceneDef;
  sprites: Sprite[];
  zone: WebGLTexture;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function loadJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

/** Fallbacks for maps an asset leaves out: flat normal, a dull material, no glow. */
function defaults(gl: GL) {
  return {
    normal: solidTexture(gl, [128, 128, 255, 255]),
    material: solidTexture(gl, [10, 64, 128, 255]),
    meta: solidTexture(gl, [0, 0, 0, 255]),
    glow: solidTexture(gl, [0, 0, 0, 255]),
  };
}

export async function loadSprite(gl: GL, base: string, name: string, fallback: ReturnType<typeof defaults>): Promise<Sprite> {
  const def = await loadJSON<SpriteDef>(`${base}/${name}/sprite.json`);
  const imgs = await Promise.all(def.maps.map(async (m) => [m, await loadImage(`${base}/${name}/${m}.png`)] as const));
  const got = new Map<MapName, WebGLTexture>(imgs.map(([m, img]) => [m, textureFromImage(gl, img)]));
  const albR = got.get('albedo.raw');
  if (!albR) throw new Error(`${name} has no albedo.raw map`);
  const glowR = got.get('glow.raw') ?? fallback.glow;
  return {
    def,
    hasMeta: got.has('meta'),
    tex: {
      'albedo.raw': albR,
      'albedo.concierge': got.get('albedo.concierge') ?? albR,
      normal: got.get('normal') ?? fallback.normal,
      material: got.get('material') ?? fallback.material,
      meta: got.get('meta') ?? fallback.meta,
      'glow.raw': glowR,
      'glow.concierge': got.get('glow.concierge') ?? glowR,
    },
  };
}

export async function loadScene(gl: GL, base: string): Promise<LoadedScene> {
  const def = await loadJSON<SceneDef>(`${base}/scene.json`);
  const fallback = defaults(gl);
  const [sprites, zoneImg] = await Promise.all([
    Promise.all(def.sprites.map((n) => loadSprite(gl, base, n, fallback))),
    loadImage(`${base}/${def.zone}`),
  ]);
  return { def, sprites, zone: textureFromImage(gl, zoneImg, false) };
}
