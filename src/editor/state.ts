// The scene editor's state: the scene file being edited and what is built from it, the selection, the view, Luna, undo,
// and the page's elements. Every part of the editor works on this one object.

import type { Sprite } from '../engine/assets';
import { NW, QUALITY, Renderer } from '../engine/renderer';
import { cameraTarget } from '../game/camera';
import type { SceneRunner } from '../game/scene';
import type { Scene, SceneFile, WorldFile } from '../game/scenefile';
import type { LookPanel } from '../look-panel';

export type Selection =
  | { kind: 'scene' }
  | { kind: 'light'; i: number }
  | { kind: 'hotspot'; i: number }
  | { kind: 'spawn'; id: string }
  | { kind: 'zone'; set: 'inside' | 'outside'; i: number }
  | { kind: 'layer'; i: number }
  | { kind: 'steam'; i: number }
  | { kind: 'godray'; i: number }
  | { kind: 'beacon'; i: number }
  | { kind: 'drips' }
  | { kind: 'mover'; i: number };

/** How many of each effect the renderer draws: more are left out. */
export const LIMITS = { steam: 4, godrays: 4, beacons: 32 };

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export const dom = {
  canvas: el<HTMLCanvasElement>('game'),
  overlay: document.getElementById('overlay') as unknown as SVGSVGElement,
  side: el<HTMLElement>('side'),
  status: el<HTMLElement>('status'),
  sceneSel: el<HTMLSelectElement>('scene'),
  scroll: el<HTMLInputElement>('scroll'),
  viewBtn: el<HTMLButtonElement>('view'),
  play: el<HTMLAnchorElement>('play'),
  error: el<HTMLElement>('error'),
  stage: el<HTMLElement>('stage'),
  button: (id: string) => el<HTMLButtonElement>(id),
};

export const base = `${import.meta.env.BASE_URL}assets`;
export const renderer = new Renderer(dom.canvas, QUALITY.high);
export const gl = renderer.gl;

export const ed = {
  world: undefined as unknown as WorldFile,
  /** The scene file as it will be saved: edits change it, and the built scene follows. */
  file: undefined as unknown as SceneFile,
  scene: null as Scene | null,
  runner: null as SceneRunner | null,
  hero: null as Sprite | null,
  sel: { kind: 'scene' } as Selection,
  /** 0 raw view, 1 Concierge view, and when it last switched, for the glitch. */
  view: 1,
  switchedAt: -10,
  /** Where the editor is scrolled to, in a scene wider than the screen. */
  camX: 0,
  dirty: false,
  /** Every built asset, as scene/name: for new layers and scenes. */
  assets: [] as string[],
  /**
   * Luna, to judge the light on: where she stands, which way she faces, whether the camera follows her as in the game, and
   * whether she follows the pointer along the walk line.
   */
  luna: { x: 480, facing: 1 as 1 | -1, show: true, follow: false, track: false },
  /** The lighting view: only what the lights do. */
  lightView: false,
  look: null as LookPanel | null,
};

export const undoStack: string[] = [];
export const t0 = performance.now();

/**
 * What to draw again after a change: the overlay (lights, hotspots, places, areas over the scene) and the side panel (the
 * selection's fields). Set by the editor's main module, so the parts that change things need not know how they are drawn.
 */
export const redraw = { overlay: (): void => {}, side: (): void => {} };

export const snapshot = (): string => JSON.stringify(ed.file);
export const setStatus = (text: string): void => { dom.status.textContent = text; };
export const showError = (err: unknown): void => {
  const msg = err instanceof Error ? err.message : String(err);
  dom.error.hidden = false;
  dom.error.textContent = msg;
  document.documentElement.dataset.err = msg;
};
export const markDirty = (): void => { ed.dirty = true; setStatus('Not saved'); };
/** Keep the scene as it was before a change, for undo. */
export const remember = (before: string): void => {
  if (before === snapshot()) return;
  undoStack.push(before);
  if (undoStack.length > 200) undoStack.shift();
  markDirty();
};

/**
 * The camera: where the editor is scrolled to, or in a scene no wider than the screen with "Move the camera with her"
 * on, where the game would have it with Luna where she stands (see the scene's drift).
 */
export const viewX = (): number => (ed.luna.follow && ed.file.size[0] <= NW ? cameraTarget(ed.file, ed.luna.x) : ed.camX);

/**
 * Where something on a layer of its own parallax is drawn in the overlay, whose coordinates are the street's: as the camera
 * moves, a thing further away (parallax under 1) moves less than the street.
 */
export const onLayer = (x: number, parallax = 1): number => x + viewX() * (1 - parallax);

/** The parallax of a scene layer, by its asset; 1 (the street's) if it has none or is not found. */
export const layerParallax = (asset: string): number => {
  const i = ed.file.layers.findIndex((l) => l.asset === asset);
  return i < 0 ? 1 : ed.file.layers[i].parallax ?? ed.scene?.loaded.sprites[i]?.def.parallax ?? 1;
};

export const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
