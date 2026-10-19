// The look: live settings for pixels, light, weather, characters, colour and film. Tuned with the look panel (L), kept
// per browser while tuning, and saved as the game's look in public/assets/look.json, which every page loads at start.
// A setting is the same in both views, or split: then raw view and Concierge view each have a value of their own.
// A scene can set some of them its own way: its scene file's "look" holds only those, over the game's look.

export interface Look {
  /** Native pixels per art pixel: 1 as drawn, more is chunkier. */
  pixelSize: number;
  /** 0 square, 1 rounded, 2 dots, 3 grid, 4 scanlines. */
  pixelShape: number;
  /** How dark the gaps of the pixel shape are, 0 to 1. */
  shapeAmount: number;
  /** Colour levels per channel; 0 keeps every colour. */
  colorLevels: number;
  /** Ordered dither when the colours are reduced, 0 to 1. */
  dither: number;
  lights: number;
  ambient: number;
  haze: number;
  glow: number;
  bloom: number;
  shafts: number;
  streaks: number;
  /** The poisonous fog of raw view. */
  rawFog: number;
  /** How hard it rains in raw view, 0 to 1: a drizzle around 0.3. Rain falls outside only. */
  rain: number;
  /** How strongly wet ground mirrors what is above it: the set and the people. */
  reflect: number;
  /**
   * In a scene with its light painted in, how much the set is mirrored in its wet ground as the camera moves, 0 to 1:
   * 0 where the art has its reflections painted in, 1 where they were taken out (asset ground) for the engine to make.
   */
  mirrorSet: number;
  /** How far up the set's reflection reaches: 1 a mirror; more shows taller things, squeezed, as a low camera sees them. */
  reflectReach: number;
  /** How far the set's reflection is smeared up and down, in pixels: the streaks of a wet street. */
  reflectStreak: number;
  /** How far it is smeared sideways, in pixels: the soft, diffuse reflections of polished stone. */
  reflectDiffuse: number;
  /**
   * How far below where things touch the ground their reflection goes from sharp to as soft as Streaks and Diffuse say,
   * in pixels, as on a glossy floor; 0 for evenly soft.
   */
  reflectFade: number;
  /**
   * On a ground the engine draws (a scene's "ground"): how wet it is, 0 dry to 1 soaked. Wet darkens it, lays a film of
   * water on it that mirrors in streaks, and fills its puddles, which mirror sharply and ripple in the rain.
   */
  wet: number;
  /** How much that ground shines when dry, 0 matte to 1 polished stone: a soft reflection, smudged by Diffuse. */
  polish: number;
  /** How worn and grimy that ground is, 0 new to 1: stains, grain, patched asphalt, slabs of uneven tone. */
  wear: number;
  /**
   * How much of the art's painted floor shows under that ground, 1 all of it. Less fades it out for plain stone lit by
   * the scene's own lights, so the floor's colour is only what it reflects and what shines on it.
   */
  groundPaint: number;
  /** How light that stone is, 0 black to 1 white. */
  groundTone: number;
  /** How much of a surface's own colour raw view keeps: 0 a cold grey, 1 all of it. Muted by default. */
  rawColour: number;
  /** How much of a light behind a character reaches the side we see, bounced off the surroundings. */
  charFill: number;
  /** How strongly a light behind a character catches its edges. */
  charRim: number;
  /** How much of the set's glowing air, halos and lens glow shows over a character, 0 to 1. */
  charGlow: number;
  /** How dark the ground gets right under a character, 0 to 1. */
  charShadow: number;
  /** How much a character's outline softens into the light around it, and takes it on. */
  charWrap: number;
  /**
   * In a scene with its light painted in: 1 shows its people in their own drawn colours times the light below, as
   * flat-shaded figures read in the concept art; 0 lights them by the lamps alone.
   */
  actorPaint: number;
  actorRed: number;
  actorGreen: number;
  actorBlue: number;
  /** In stops. */
  exposure: number;
  contrast: number;
  saturation: number;
  /** Cool (-1) to warm (+1). */
  temperature: number;
  /** Green (-1) to magenta (+1). */
  tint: number;
  vignette: number;
  grain: number;
  aberration: number;
  /** Far things soften, on the tiers that have it: 1 on, 0 off, for flat art that should stay sharp. */
  depthOfField: number;
}

export const LOOK_DEFAULTS: Look = {
  pixelSize: 1, pixelShape: 0, shapeAmount: 0.5, colorLevels: 0, dither: 0.5,
  lights: 1, ambient: 1, haze: 1, glow: 1, bloom: 1, shafts: 1, streaks: 1, rawFog: 1, rawColour: 0.5, rain: 1,
  reflect: 1, mirrorSet: 0, reflectReach: 1, reflectStreak: 0, reflectDiffuse: 0, reflectFade: 0, wet: 0, polish: 0.5, wear: 0.5, groundPaint: 1, groundTone: 0.25,
  charFill: 1, charRim: 1, charGlow: 0.05, charShadow: 0.55, charWrap: 0.6, actorPaint: 0, actorRed: 1, actorGreen: 1, actorBlue: 1,
  exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0,
  vignette: 1, grain: 1, aberration: 1, depthOfField: 1,
};

export type ViewName = 'raw' | 'concierge';

/** The shared settings, and per view the ones split off from them. */
export interface LookSet {
  base: Look;
  raw: Partial<Look>;
  concierge: Partial<Look>;
}

export const LOOK_GROUPS = ['Pixels', 'Light', 'Reflections', 'Characters', 'Colour', 'Film'] as const;

export interface LookControl {
  key: keyof Look;
  label: string;
  group: (typeof LOOK_GROUPS)[number];
  min: number;
  max: number;
  step: number;
  /** Named values, shown as a list instead of a slider. */
  options?: string[];
}

export const LOOK_CONTROLS: LookControl[] = [
  { key: 'pixelSize', label: 'Pixel size', group: 'Pixels', min: 1, max: 6, step: 1 },
  { key: 'pixelShape', label: 'Pixel shape', group: 'Pixels', min: 0, max: 4, step: 1, options: ['Square', 'Rounded', 'Dots', 'Grid', 'Scanlines'] },
  { key: 'shapeAmount', label: 'Shape strength', group: 'Pixels', min: 0, max: 1, step: 0.05 },
  { key: 'colorLevels', label: 'Colour levels (0 = all)', group: 'Pixels', min: 0, max: 32, step: 1 },
  { key: 'dither', label: 'Dither', group: 'Pixels', min: 0, max: 1, step: 0.05 },
  { key: 'lights', label: 'Lights', group: 'Light', min: 0, max: 3, step: 0.05 },
  { key: 'ambient', label: 'Ambient', group: 'Light', min: 0, max: 4, step: 0.05 },
  { key: 'haze', label: 'Haze around lights', group: 'Light', min: 0, max: 4, step: 0.05 },
  { key: 'glow', label: 'Glowing surfaces', group: 'Light', min: 0, max: 3, step: 0.05 },
  { key: 'bloom', label: 'Bloom', group: 'Light', min: 0, max: 3, step: 0.05 },
  { key: 'shafts', label: 'Light shafts', group: 'Light', min: 0, max: 4, step: 0.05 },
  { key: 'streaks', label: 'Lens streaks', group: 'Light', min: 0, max: 4, step: 0.05 },
  { key: 'rawFog', label: 'Raw view fog', group: 'Light', min: 0, max: 3, step: 0.05 },
  { key: 'rain', label: 'Rain in raw view', group: 'Light', min: 0, max: 1, step: 0.05 },
  { key: 'reflect', label: 'Reflections', group: 'Reflections', min: 0, max: 2, step: 0.05 },
  { key: 'mirrorSet', label: 'Mirror the set (painted scenes)', group: 'Reflections', min: 0, max: 1, step: 0.05 },
  { key: 'reflectReach', label: 'Reach up (1 a mirror)', group: 'Reflections', min: 1, max: 6, step: 0.1 },
  { key: 'reflectStreak', label: 'Streaks (up and down), px', group: 'Reflections', min: 0, max: 80, step: 1 },
  { key: 'reflectDiffuse', label: 'Diffuse (sideways), px', group: 'Reflections', min: 0, max: 40, step: 1 },
  { key: 'reflectFade', label: 'Sharp where things touch, soft after (px)', group: 'Reflections', min: 0, max: 120, step: 1 },
  { key: 'wet', label: 'Ground: wet (0 dry, 1 soaked)', group: 'Reflections', min: 0, max: 1, step: 0.05 },
  { key: 'polish', label: 'Ground: shine when dry', group: 'Reflections', min: 0, max: 1, step: 0.05 },
  { key: 'wear', label: 'Ground: wear and grime', group: 'Reflections', min: 0, max: 1, step: 0.05 },
  { key: 'groundPaint', label: 'Ground: painted colour (0 plain stone)', group: 'Reflections', min: 0, max: 1, step: 0.05 },
  { key: 'groundTone', label: 'Ground: stone lightness', group: 'Reflections', min: 0, max: 1, step: 0.01 },
  { key: 'charFill', label: 'Fill from lights behind', group: 'Characters', min: 0, max: 2, step: 0.05 },
  { key: 'charRim', label: 'Rim from lights behind', group: 'Characters', min: 0, max: 3, step: 0.05 },
  { key: 'charGlow', label: 'Glow showing over them', group: 'Characters', min: 0, max: 1, step: 0.01 },
  { key: 'charShadow', label: 'Shadow under them', group: 'Characters', min: 0, max: 1, step: 0.05 },
  { key: 'charWrap', label: 'Edges taking the light around', group: 'Characters', min: 0, max: 2, step: 0.05 },
  { key: 'actorPaint', label: 'Drawn colours (painted scenes)', group: 'Characters', min: 0, max: 1, step: 0.05 },
  { key: 'actorRed', label: 'Their light: red', group: 'Characters', min: 0, max: 2, step: 0.01 },
  { key: 'actorGreen', label: 'Their light: green', group: 'Characters', min: 0, max: 2, step: 0.01 },
  { key: 'actorBlue', label: 'Their light: blue', group: 'Characters', min: 0, max: 2, step: 0.01 },
  { key: 'rawColour', label: 'Raw view colour', group: 'Colour', min: 0, max: 1, step: 0.05 },
  { key: 'exposure', label: 'Exposure', group: 'Colour', min: -2, max: 2, step: 0.05 },
  { key: 'contrast', label: 'Contrast', group: 'Colour', min: 0.5, max: 1.8, step: 0.02 },
  { key: 'saturation', label: 'Saturation', group: 'Colour', min: 0, max: 2, step: 0.02 },
  { key: 'temperature', label: 'Temperature', group: 'Colour', min: -1, max: 1, step: 0.02 },
  { key: 'tint', label: 'Tint', group: 'Colour', min: -1, max: 1, step: 0.02 },
  { key: 'vignette', label: 'Vignette', group: 'Film', min: 0, max: 2.5, step: 0.05 },
  { key: 'grain', label: 'Grain', group: 'Film', min: 0, max: 4, step: 0.05 },
  { key: 'aberration', label: 'Colour fringes', group: 'Film', min: 0, max: 4, step: 0.05 },
  { key: 'depthOfField', label: 'Depth of field', group: 'Film', min: 0, max: 1, step: 1, options: ['Off', 'On'] },
];

/** The settings for one view: the shared ones with that view's split ones over them. */
export const lookFor = (set: LookSet, view: ViewName): Look => ({ ...set.base, ...set[view] });

export const isSplit = (set: LookSet, key: keyof Look): boolean => key in set.raw || key in set.concierge;

export const cloneLookSet = (set: LookSet): LookSet => ({ base: { ...set.base }, raw: { ...set.raw }, concierge: { ...set.concierge } });

export const defaultLookSet = (): LookSet => ({ base: { ...LOOK_DEFAULTS }, raw: {}, concierge: {} });

/** Only known keys with numbers, so a stale or broken file cannot break the renderer. */
function cleanValues(data: unknown): Partial<Look> {
  const out: Partial<Look> = {};
  if (!data || typeof data !== 'object') return out;
  for (const c of LOOK_CONTROLS) {
    const v = (data as Record<string, unknown>)[c.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[c.key] = Math.min(c.max, Math.max(c.min, v));
  }
  return out;
}

/** A look as stored: the shared settings at the top, the split ones under "raw" and "concierge". */
export function cleanLookSet(data: unknown): LookSet {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return { base: { ...LOOK_DEFAULTS, ...cleanValues(d) }, raw: cleanValues(d.raw), concierge: cleanValues(d.concierge) };
}

export function lookSetJSON(set: LookSet): Record<string, unknown> {
  const out: Record<string, unknown> = { ...set.base };
  if (Object.keys(set.raw).length) out.raw = { ...set.raw };
  if (Object.keys(set.concierge).length) out.concierge = { ...set.concierge };
  return out;
}

/** A scene's own settings, over the game's look: only those it sets, shared or split like the look's. */
export interface SceneLook {
  base: Partial<Look>;
  raw: Partial<Look>;
  concierge: Partial<Look>;
}

export const emptySceneLook = (): SceneLook => ({ base: {}, raw: {}, concierge: {} });

export const cloneSceneLook = (s: SceneLook): SceneLook => ({ base: { ...s.base }, raw: { ...s.raw }, concierge: { ...s.concierge } });

/** A scene's look as stored in its scene file, shaped like look.json but with only the settings it sets. */
export function cleanSceneLook(data: unknown): SceneLook {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  return { base: cleanValues(d), raw: cleanValues(d.raw), concierge: cleanValues(d.concierge) };
}

/** For the scene file; undefined when the scene sets nothing of its own. */
export function sceneLookJSON(s: SceneLook): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = { ...s.base };
  if (Object.keys(s.raw).length) out.raw = { ...s.raw };
  if (Object.keys(s.concierge).length) out.concierge = { ...s.concierge };
  return Object.keys(out).length ? out : undefined;
}

/** Whether the scene sets this setting, in either view. */
export const sceneSets = (s: SceneLook, key: keyof Look): boolean => key in s.base || key in s.raw || key in s.concierge;

/**
 * The look in a scene: the game's, with the scene's own settings over it. A setting the scene shares between the views
 * is shared there even where the game splits it; one it splits overrides each view it names.
 */
export function withScene(project: LookSet, scene: SceneLook | null): LookSet {
  const out = cloneLookSet(project);
  if (!scene) return out;
  for (const [k, v] of Object.entries(scene.base) as [keyof Look, number][]) { out.base[k] = v; delete out.raw[k]; delete out.concierge[k]; }
  Object.assign(out.raw, scene.raw);
  Object.assign(out.concierge, scene.concierge);
  return out;
}

/** The game's saved look, from public/assets/look.json, over the defaults. */
export async function loadProjectLook(base: string): Promise<LookSet> {
  try {
    const res = await fetch(`${base}/look.json`, { cache: 'no-store' });
    if (res.ok) return cleanLookSet(await res.json());
  } catch {
    // no saved look yet
  }
  return defaultLookSet();
}

/**
 * Tuning in progress in this browser is kept with the game's look it was made from. When that look changes (it is
 * saved, or the art changes and the look with it), tuning made against the old one is set aside, so a browser never
 * keeps showing the game through settings for art that is gone. The first version of this key had no such stamp.
 */
const LOCAL = 'lidless.look.v2', OLD_LOCAL = 'lidless.look.v1';

/** A short stamp of a look, to tell whether tuning was made against it. */
const stamp = (set: LookSet): string => {
  const s = JSON.stringify(lookSetJSON(set));
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/** Tuning in progress in this browser, if any, made against the game's look `project`. */
export function loadLocalLook(project: LookSet): LookSet | null {
  try {
    localStorage.removeItem(OLD_LOCAL);
    const raw = localStorage.getItem(LOCAL);
    if (!raw) return null;
    const { against, look } = JSON.parse(raw) as { against?: string; look?: unknown };
    if (against !== stamp(project)) { localStorage.removeItem(LOCAL); return null; }
    return cleanLookSet(look);
  } catch {
    return null;
  }
}

export function saveLocalLook(set: LookSet | null, project?: LookSet): void {
  try {
    if (set && project) localStorage.setItem(LOCAL, JSON.stringify({ against: stamp(project), look: lookSetJSON(set) }));
    else localStorage.removeItem(LOCAL);
  } catch {
    // private windows and blocked storage: tuning still works, it just is not kept
  }
}

/** Tuning of each scene's own settings in progress, kept the same way: per scene, with the scene look it was made from. */
const LOCAL_SCENES = 'lidless.sceneLook.v1';
const sceneStamp = (s: SceneLook) => stamp({ base: s.base as Look, raw: s.raw, concierge: s.concierge });

function localScenes(): Record<string, { against: string; look: unknown }> {
  try {
    const all = JSON.parse(localStorage.getItem(LOCAL_SCENES) ?? '{}') as unknown;
    return all && typeof all === 'object' ? all as Record<string, { against: string; look: unknown }> : {};
  } catch {
    return {};
  }
}

/** This browser's tuning of a scene's own settings, if any, made against its saved ones. */
export function loadLocalSceneLook(id: string, saved: SceneLook): SceneLook | null {
  const entry = localScenes()[id];
  return entry && entry.against === sceneStamp(saved) ? cleanSceneLook(entry.look) : null;
}

export function saveLocalSceneLook(id: string, look: SceneLook | null, saved?: SceneLook): void {
  try {
    const all = localScenes();
    if (look && saved) all[id] = { against: sceneStamp(saved), look: sceneLookJSON(look) ?? {} };
    else delete all[id];
    if (Object.keys(all).length) localStorage.setItem(LOCAL_SCENES, JSON.stringify(all));
    else localStorage.removeItem(LOCAL_SCENES);
  } catch {
    // as above
  }
}
