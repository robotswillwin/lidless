// Loads scenes and sprites in the asset contract format (see docs/ASSETS.md).

import { setFilter, solidTexture, textureFromImage, type GL } from './gl';

export type MapName = 'albedo.raw' | 'albedo.concierge' | 'normal' | 'normal.concierge' | 'material' | 'material.concierge' | 'meta' | 'glow.raw' | 'glow.concierge';

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
  /** Which way a placed character faces: -1 turns it to the left (mirrored, unless it has frames of its own for that). */
  facing?: 1 | -1;
  /** For a character: half the width of its shadow on the ground, in pixels; 0 for none. By default 0.3 of its width. */
  footprint?: number;
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
  /**
   * Animation frames in every map, in rows of `cols` (all in one row without it), a transparent gutter between them;
   * w and h are one frame.
   */
  frames?: { count: number; gutter: number; cols?: number };
  /**
   * Texels per level pixel, 1 by default: art built at 2 has twice the detail, and shows it at a render scale of 2. Every
   * other size and place here (w, h, x, y, anchor, strides) is in level pixels; the frames' gutter is in texels.
   */
  res?: number;
  /**
   * Named runs of frames. A walk has a stride: how far the body moves in one cycle, so the planted foot does not
   * slide. A loop has a speed in frames per second, and can give the order to play its frames in (repeats hold one).
   */
  anims?: Record<string, { from: number; count: number; stride?: number; fps?: number; seq?: number[] }>;
  /** Used when the sprite has no meta map. */
  occluder?: number;
  reflectivity?: number;
  object?: number;
  /** Also used when it has no meta map: its glow's group in each view, and 1 if its glow is a machine's own light. */
  groupRaw?: number;
  groupConcierge?: number;
  machine?: number;
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
  /** Exists only in raw view: the moon behind the Concierge's face, a machine's eye it dresses up as something else. */
  raw?: number;
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
  /**
   * How bright the ambient light is, 1 by default: a room with few lamps gets more, evenly and without highlights.
   * One number for both views, or one per view, since a dark raw room can be a white one to the Concierge.
   */
  ambient?: number | { raw?: number; concierge?: number };
  /** Exposure in stops, over the look's: 0 by default. One number for both views, or one per view (a white room in the Concierge's view). */
  exposure?: number | { raw?: number; concierge?: number };
  /** Flying traffic far away; ar = only in Concierge view. */
  traffic?: { lanes: number[]; perLane: number; x0: number; span: number; ar?: number };
  /** How much of the set's light is painted into its art, 0 to 1; one number, or one per view. */
  baked?: number | { raw?: number; concierge?: number };
  /** How big the people are drawn, 1 by default. */
  actorScale?: number;
  /** False to keep far shapes crisp: no depth of field. */
  dof?: boolean;
  /** How hard it rains in raw view, 0 to 1. */
  rain?: number;
  /** In a painted scene, the light its people are shown in, one colour or one per view. */
  actorLight?: [number, number, number] | { raw?: [number, number, number]; concierge?: [number, number, number] };
}

export interface Sprite {
  def: SpriteDef;
  tex: Record<MapName, WebGLTexture>;
  hasMeta: boolean;
  /** The size of its textures in texels: all the frames, with their gutters. */
  size: [number, number];
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
  // a character is drawn smaller or larger than it was made, and art with more than one texel per level pixel is
  // drawn at its own scale or shrunk, so both are sampled smoothly; packed flags never are
  if ((def.actor ?? def.kind === 'character') || (def.res ?? 1) > 1) for (const [m, t] of got) if (m !== 'meta') setFilter(gl, t, false);
  const albR = got.get('albedo.raw'), albImg = imgs.find(([m]) => m === 'albedo.raw')?.[1];
  if (!albR || !albImg) throw new Error(`${name} has no albedo.raw map`);
  const glowR = got.get('glow.raw') ?? fallback.glow, normal = got.get('normal') ?? fallback.normal, material = got.get('material') ?? fallback.material;
  return {
    def,
    hasMeta: got.has('meta'),
    size: [albImg.width, albImg.height],
    tex: {
      'albedo.raw': albR,
      'albedo.concierge': got.get('albedo.concierge') ?? albR,
      normal,
      // a thing that looks different to the Concierge has its own surface there; otherwise both views share one
      'normal.concierge': got.get('normal.concierge') ?? normal,
      material,
      'material.concierge': got.get('material.concierge') ?? material,
      meta: got.get('meta') ?? fallback.meta,
      'glow.raw': glowR,
      'glow.concierge': got.get('glow.concierge') ?? glowR,
    },
  };
}

