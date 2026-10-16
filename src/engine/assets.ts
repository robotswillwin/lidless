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
  /** Feet or base point inside the sprite, for characters placed by their position. */
  anchor?: [number, number];
  /**
   * Which views it is in: both (real), concierge (generated, made up by the Concierge) or raw (real, but the
   * Concierge edits it out). The albedo of a view it is not in is transparent, so this is information for tools.
   */
  exists?: 'both' | 'concierge' | 'raw';
  /** What the pipeline built it as: character, prop, background or portrait. */
  kind?: string;
  /**
   * Drawn in front of the set, like a character: lights behind it only rim it and give it a soft fill, and the set's
   * glowing air stays mostly behind it. Default: true for characters.
   */
  actor?: boolean;
  /** For an actor: how much of the set's glowing air shows over it, 0 to 1. Default: the look's "Glow showing over them". */
  haze?: number;
  /** Animation frames side by side in every map, a transparent gutter between them; w and h are one frame. */
  frames?: { count: number; gutter: number };
  /**
   * Named runs of frames. A walk has a stride: how far the body moves in one cycle, so the planted foot does not
   * slide. A loop has a speed in frames per second, and can give the order to play its frames in (repeats hold one).
   */
  anims?: Record<string, { from: number; count: number; stride?: number; fps?: number; seq?: number[] }>;
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
  /** A machine's own light (a monitor, an indicator, the kiosk's eye): keeps its colour in raw view, where main lighting goes sterile white. */
  machine?: number;
  /**
   * Where the light is against the characters: 0 behind them, part of the set (a character in front hides its glow,
   * is rimmed by it and gets a soft fill from it), 1 among them, hanging in the street space (a street lamp: it lights
   * them fully and most of its glow is hidden behind them), 2 in front of them. Default 0.
   */
  layer?: number;
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
export function spriteDefaults(gl: GL) {
  return {
    normal: solidTexture(gl, [128, 128, 255, 255]),
    material: solidTexture(gl, [10, 64, 128, 255]),
    meta: solidTexture(gl, [0, 0, 0, 255]),
    glow: solidTexture(gl, [0, 0, 0, 255]),
  };
}

/** `bust` is added to every URL to skip the browser cache when an asset was just rebuilt. */
export async function loadSprite(gl: GL, base: string, name: string, fallback: ReturnType<typeof spriteDefaults>, bust = ''): Promise<Sprite> {
  const q = bust ? `?v=${bust}` : '';
  const def = await loadJSON<SpriteDef>(`${base}/${name}/sprite.json${q}`);
  const imgs = await Promise.all(def.maps.map(async (m) => [m, await loadImage(`${base}/${name}/${m}.png${q}`)] as const));
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
  const fallback = spriteDefaults(gl);
  const [sprites, zoneImg] = await Promise.all([
    Promise.all(def.sprites.map((n) => loadSprite(gl, base, n, fallback))),
    loadImage(`${base}/${def.zone}`),
  ]);
  return { def, sprites, zone: textureFromImage(gl, zoneImg, false) };
}
