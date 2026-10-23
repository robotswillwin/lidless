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
  /**
   * How fast the layer moves with the camera: 1 moves with the street, 0 stays put, over 1 is nearer than the street.
   * In a scene no wider than the screen, the camera leans with the hero (the scene's drift): the street stays where it
   * is and the other layers slide against it, each by how far it is from the street's 1.
   */
  parallax: number;
  /** Drawn in front of the people: something nearer than the walk line, such as a railing or the edge of a wall. */
  front?: boolean;
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
  /** Placed in a scene only for one view: the scene's say over where the asset itself exists. */
  only?: Only;
  /** A layer placed only while a condition on the story holds (the game reads it; the engine draws what it is given). */
  when?: string;
  /** Placed elsewhere in one view of a scene. */
  views?: Views<{ x: number; y: number }>;
  /** What the pipeline built it as: character, prop, background or portrait. */
  kind?: string;
  /**
   * Drawn in front of the set, like a character: lights behind it only rim it and give it a soft fill, and the set's
   * glowing air stays mostly behind it. Default: true for characters.
   */
  actor?: boolean;
  /**
   * Part of the set, at its own size and in its order, but lit as a character is: by the scene's own lights, not as
   * painted, and mirrored in wet ground around its own feet. A machine standing or moving in the street, drawn flat-lit
   * like the people, in a scene whose set has its night painted in.
   */
  lit?: boolean;
  /** For an actor: how much of the set's glowing air shows over it, 0 to 1. Default: the look's "Glow showing over them". */
  haze?: number;
  /**
   * Animation frames in every map, in rows of `cols` (all in one row without it), a transparent gutter between them;
   * w and h are one frame.
   */
  /**
   * `lifts`: how far each frame's lowest point is off the ground, in level pixels (a run's flight): wet ground mirrors
   * her around her feet as they are in that frame, so her reflection stays with them.
   */
  frames?: { count: number; gutter: number; cols?: number; lifts?: number[] };
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
  /** A light on a layer that is not the street's moves with it: its parallax (1, the street's, by default). */
  parallax?: number;
  /** Exists only in raw view: the moon behind the Concierge's face, a machine's eye it dresses up as something else. */
  raw?: number;
  /** A machine's own light (a monitor, an indicator, the kiosk's eye): keeps its colour in raw view, where main lighting goes sterile white. */
  machine?: number;
  /** 1: it has power of its own (a battery, a generator, the Concierge's own supply), so it stays on in a power cut. */
  own?: number;
  /**
   * Where the light is against the characters: 0 behind them, part of the set (a character in front hides its glow,
   * is rimmed by it and gets a soft fill from it), 1 among them, hanging in the street space (a street lamp: it lights
   * them fully and most of its glow is hidden behind them), 2 in front of them. Default 0.
   */
  layer?: number;
  /** Object id this light does not light (its own housing). */
  ex?: number;
  /**
   * Its strength by turns, `fps` steps a second through `seq` (each a factor on its strength): on the same clock as a
   * sprite's idle loop with the same fps and as many steps, so a welder's flash lights up as its frames flash.
   */
  pulse?: { fps: number; seq: number[] };
}

import type { PlacedLight } from './presets';

/** Only in one view: there in raw view, or in the Concierge's. Anything without it is in both. */
export type Only = 'raw' | 'concierge';
/** Whether something is in the view on screen (view 0 raw, 1 the Concierge's). */
export const inViewOf = (only: Only | undefined, view: number): boolean => !only || (only === 'concierge') === view >= 0.5;

/** What something placed in a scene does its own way in one view, over what it does in both. */
export type Views<T> = Partial<Record<Only, Partial<T>>>;
/** Something placed as it is in a view: its own settings there over the ones it has in both. */
export function asIn<T extends { views?: Views<T> }>(o: T, view: Only): T {
  const own = o.views?.[view];
  return own ? { ...o, ...own } : o;
}

/** `parallax`: smoke from a chimney on a far layer moves with that layer, and is drawn only where that layer shows. */
export interface SteamDef { x: number; y: number; height: number; width: number; kind: 'steam' | 'smoke'; parallax?: number; only?: Only; views?: Views<SteamDef> }
/**
 * `parallax` for things on a layer that is not the street's: they move with that layer, as lights and beacons can.
 * `ar` (1) is the older way to say only in the Concierge's view.
 */
export interface GodrayDef { x: number; y: number; strength: number; zone: number; ar?: number; only?: Only; parallax?: number; views?: Views<GodrayDef> }
export interface BeaconDef { x: number; y: number; phase: number; parallax?: number; only?: Only; views?: Views<BeaconDef> }
/** The shapes an oscilloscope's line takes, in the order its dial turns through them. */
export const WAVES = ['sine', 'square', 'triangle', 'saw'] as const;
export type Wave = (typeof WAVES)[number];
/**
 * An oscilloscope's screen, its line drawn live by the engine: it creeps along and breathes, with a little noise on it in
 * raw view. Where the glass's middle is and its radius inside the rim; the shape it shows, as placed (`shape`) or as a
 * story variable has it (`wave`: its dial, which the story turns); only in one view, or while a condition holds.
 */
export interface ScopeDef { x: number; y: number; r: number; shape?: Wave; wave?: string; when?: string; only?: Only; parallax?: number }

/**
 * The ground below the reflection line, drawn by the engine over a painted floor that was smoothed for it (asset ground
 * --smooth): paving slabs in perspective, a kerb and the road beyond it, and where puddles collect. How wet, polished and
 * worn it is comes from the look, per view: raw view's street is wet, worn concrete; the Concierge's, dry polished stone.
 */
export interface GroundDef {
  /** World y of the horizon, the eye's height: the nearer the walk line, the flatter the ground is seen. */
  horizon: number;
  /** A paving slab's width and depth, in pixels at the walk line; none, or [0, 0], for no slabs. */
  slab?: [number, number];
  /** How far in front of the walk line the kerb is, in pixels at the walk line; none, or 0, for no kerb and no road. */
  kerb?: number;
  /** How much of the ground holds puddles when it is wet, 0 to 1: the road most, along the gutter, the pavement less. */
  puddles?: number;
}

export interface SceneDef {
  name: string;
  size: [number, number];
  sprites: string[];
  /** World-space zone map: r inside, g outside, b static ambient occlusion. */
  zone: string;
  /** As placed: each resolved with its preset as it is drawn (see presets.ts). */
  lights: PlacedLight[];
  beacons: BeaconDef[];
  steam: SteamDef[];
  godrays: GodrayDef[];
  /** Oscilloscopes' screens, their lines drawn live: two at most. */
  scopes?: ScopeDef[];
  drips?: { x0: number; x1: number; top: number; bottom: number };
  /** World y of the line wet surfaces reflect around. */
  mirror: number;
  /** The ground the engine draws below that line, if any. */
  ground?: GroundDef;
  /**
   * How bright the ambient light is, 1 by default: a room with few lamps gets more, evenly and without highlights.
   * One number for both views, or one per view, since a dark raw room can be a white one to the Concierge.
   */
  ambient?: number | { raw?: number; concierge?: number };
  /** Exposure in stops, over the look's: 0 by default. One number for both views, or one per view (a white room in the Concierge's view). */
  exposure?: number | { raw?: number; concierge?: number };
  /** Flying traffic far away; ar = only in Concierge view. */
  traffic?: { lanes: number[]; perLane: number; x0: number; span: number; ar?: number; parallax?: number };
  /** How much of the set's light is painted into its art, 0 to 1; one number, or one per view. */
  baked?: number | { raw?: number; concierge?: number };
  /** How big the people are drawn, 1 by default. */
  actorScale?: number;
}

export interface Sprite {
  def: SpriteDef;
  tex: Record<MapName, WebGLTexture>;
  hasMeta: boolean;
  /** The size of its textures in texels as made: all the frames, with their gutters. */
  size: [number, number];
  /** The fraction of that size its textures were loaded at: less where the screen shows less of it (a phone). */
  texScale?: number;
}

/**
 * How many texels per level pixel the screen shows: 1 on a phone, which draws the level at its own size, 2 on a desktop.
 * Art made with more is loaded smaller, to as much as the screen shows: what is left out was averaged away on screen
 * anyway, and a phone keeps a quarter of the memory for a background made at 2. Unlimited until the game sets it.
 */
let texelBudget = Infinity;
export function setTexelBudget(perLevelPixel: number): void {
  texelBudget = perLevelPixel;
}

/**
 * People are drawn smaller than they were made (her height on the street is about half of it): three quarters of the
 * screen's texels is plenty for them, and a scene that drew them larger than that would show them a little softer.
 */
const PEOPLE_SHOWN = 0.75;

/** An image at a fraction of its size, its colours kept where it is transparent; as it is where the browser cannot. */
async function shrunk(img: HTMLImageElement, f: number): Promise<TexImageSource> {
  const w = Math.max(1, Math.round(img.width * f)), h = Math.max(1, Math.round(img.height * f));
  try {
    const b = await createImageBitmap(img, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
    if (b.width === w && b.height === h) return b;
    b.close();
  } catch {
    // a browser that does not resize bitmaps: the image as it is
  }
  return img;
}

/**
 * Something that moves through a scene on its own: a train along a viaduct, a car, a drone. It is drawn just after one of
 * the scene's layers, so the nearer layers cover it, and moves with that layer's parallax.
 */
export interface MoverDef {
  /** A built asset, scene/name, drawn as it was built going right and mirrored going left. */
  asset: string;
  /** The layer it is drawn after, by its asset: it moves with that layer's parallax. */
  after: string;
  /**
   * Where it can be seen, from x0 to x1 in that layer's pixels: it comes out from behind something at one end and goes
   * behind something at the other.
   */
  x0: number;
  x1: number;
  /** The top of the sprite, in the layer's pixels; by default where its sprite.json puts it. */
  y?: number;
  /** Pixels a second. */
  speed: number;
  /** Seconds from the end of one pass to the start of the next, at random between the two. */
  wait: [number, number];
  /** 1 always left to right, -1 always right to left, 0 (the default) each way in turn. */
  dir?: 1 | -1 | 0;
  /**
   * Streaks of light from it, each from `at` (in its sprite's pixels, as built going right), `length` pixels long, in
   * `colour`, `width` pixels thick where it starts (3 by default), thinning and fading: behind it for a length over 0 (a
   * thruster's trail), ahead of it under 0 (a headlight's beam). Drawn by the engine, soft, where built art has hard
   * edges; seen only where the mover's layer is. At most four in a scene.
   */
  lights?: { at: [number, number]; length: number; colour: [number, number, number]; width?: number }[];
  /** Where it stops on the way, a while: its middle at x (in the layer's pixels), for so many seconds. A delivery at a door. */
  stops?: { x: number; seconds: number }[];
  /** A hover: how far it rises and falls, in pixels, and how long one rise and fall takes, in seconds. A drone. */
  bob?: [number, number];
  /**
   * It paces a beat of its own instead of passing through: its body (its sprite's anchor) walks from x0 to x1 and back,
   * stopping on the way where it stops, resting at each end for the average of `wait`, turning round. Walking it plays
   * its walk, at its walk's stride; resting, its idle loop. A guard on its round.
   */
  patrol?: boolean;
  only?: Only;
  views?: Views<MoverDef>;
}

export interface LoadedScene {
  def: SceneDef;
  sprites: Sprite[];
  zone: WebGLTexture;
  /** The scene's movers, each with its sprite and the index of the layer it is drawn after. */
  movers?: { def: MoverDef; sprite: Sprite; after: number }[];
}

/** A file fetched as it is, its bytes only: an image is decoded later, as its scene is put on the GPU. */
export async function loadBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  return res.blob();
}

/** An image from fetched bytes, decoded before it is used (off the main thread, where the browser can). */
export async function imageFromBlob(blob: Blob, what = 'an image'): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob), img = new Image();
  img.src = url;
  try {
    await img.decode().catch(() => new Promise<void>((resolve, reject) => { if (img.complete && img.naturalWidth) resolve(); else { img.onload = () => resolve(); img.onerror = () => reject(new Error(`could not decode ${what}`)); } }));
  } finally {
    URL.revokeObjectURL(url);
  }
  return img;
}

async function loadJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`could not load ${url} (${res.status})`);
  return res.json() as Promise<T>;
}

/** Fallbacks for maps an asset leaves out: flat normal, a dull material, no glow. */
/** Let a sprite's textures go: one loaded with stand-ins of its own (spriteDefaults), which go with it. */
export function freeSprite(gl: GL, s: Sprite): void {
  for (const t of new Set(Object.values(s.tex))) gl.deleteTexture(t);
}

export function spriteDefaults(gl: GL) {
  return {
    normal: solidTexture(gl, [128, 128, 255, 255]),
    material: solidTexture(gl, [10, 64, 128, 255]),
    meta: solidTexture(gl, [0, 0, 0, 255]),
    glow: solidTexture(gl, [0, 0, 0, 255]),
  };
}

/**
 * Sampled smoothly, not as pixel art: a character, drawn smaller or larger than it was made, and art with more than one
 * texel per level pixel. Such sprites can also sit between pixels, so a slow camera glides.
 */
export const smoothSampled = (def: SpriteDef): boolean => (def.actor ?? def.kind === 'character') || (def.res ?? 1) > 1;

/** A sprite's files, fetched and not yet decoded or on the GPU: in a scene she may go to next. */
export interface FetchedSprite {
  name: string;
  def: SpriteDef;
  files: (readonly [MapName, Blob])[];
}

/** `bust` is added to every URL to skip the browser cache when an asset was just rebuilt. */
export async function fetchSprite(base: string, name: string, bust = ''): Promise<FetchedSprite> {
  const q = bust ? `?v=${bust}` : '';
  const def = await loadJSON<SpriteDef>(`${base}/${name}/sprite.json${q}`);
  return { name, def, files: await Promise.all(def.maps.map(async (m) => [m, await loadBlob(`${base}/${name}/${m}.png${q}`)] as const)) };
}

export async function loadSprite(gl: GL, base: string, name: string, fallback: ReturnType<typeof spriteDefaults>, bust = ''): Promise<Sprite> {
  return makeSprite(gl, await fetchSprite(base, name, bust), fallback);
}

/** A fetched sprite decoded and put on the GPU, as detailed as the screen shows. */
export async function makeSprite(gl: GL, fetched: FetchedSprite, fallback: ReturnType<typeof spriteDefaults>): Promise<Sprite> {
  const { def, name } = fetched;
  const imgs = await Promise.all(fetched.files.map(async ([m, blob]) => [m, await imageFromBlob(blob, `${name}/${m}.png`)] as const));
  // as much detail as the screen shows; packed flags, which cannot be averaged, as they are. And no bigger than the GPU
  // takes: a wide street's layer can be wider than an older GPU's 4096 texels
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, big = Math.max(...imgs.map(([, img]) => Math.max(img.width, img.height)));
  const f = Math.min(1, (texelBudget * (def.actor ?? def.kind === 'character' ? PEOPLE_SHOWN : 1)) / (def.res ?? 1), max / big);
  const srcs = await Promise.all(imgs.map(async ([m, img]) => [m, f < 0.99 && (m !== 'meta' || big > max) ? await shrunk(img, f) : img] as const));
  const got = new Map<MapName, WebGLTexture>(srcs.map(([m, src]) => [m, textureFromImage(gl, src)]));
  for (const [, src] of srcs) if (src instanceof ImageBitmap) src.close();
  // a character is drawn smaller or larger than it was made, and art with more than one texel per level pixel is
  // drawn at its own scale or shrunk, so both are sampled smoothly; packed flags never are
  if (smoothSampled(def)) for (const [m, t] of got) if (m !== 'meta') setFilter(gl, t, false);
  const albR = got.get('albedo.raw'), albImg = imgs.find(([m]) => m === 'albedo.raw')?.[1];
  if (!albR || !albImg) throw new Error(`${name} has no albedo.raw map`);
  const glowR = got.get('glow.raw') ?? fallback.glow, normal = got.get('normal') ?? fallback.normal, material = got.get('material') ?? fallback.material;
  const albSrc = srcs.find(([m]) => m === 'albedo.raw')?.[1];
  return {
    def,
    hasMeta: got.has('meta'),
    size: [albImg.width, albImg.height],
    texScale: albSrc && albSrc !== albImg ? (albSrc as ImageBitmap).width / albImg.width : 1,
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

