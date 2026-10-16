// The look: live settings for pixels, light, characters, colour and film. Tuned with the look panel (L), kept per
// browser while tuning, and saved as the game's look in public/assets/look.json, which every page loads at start.
// A setting is the same in both views, or split: then raw view and Concierge view each have a value of their own.

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
  /** How much of a surface's own colour raw view keeps: 0 a cold grey, 1 all of it. Muted by default. */
  rawColour: number;
  /** How much of a light behind a character reaches the side we see, bounced off the surroundings. */
  charFill: number;
  /** How strongly a light behind a character catches its edges. */
  charRim: number;
  /** How much of the set's glowing air, halos and lens glow shows over a character, 0 to 1. */
  charGlow: number;
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
}

export const LOOK_DEFAULTS: Look = {
  pixelSize: 1, pixelShape: 0, shapeAmount: 0.5, colorLevels: 0, dither: 0.5,
  lights: 1, ambient: 1, haze: 1, glow: 1, bloom: 1, shafts: 1, streaks: 1, rawFog: 1, rawColour: 0.5,
  charFill: 1, charRim: 1, charGlow: 0.05,
  exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0,
  vignette: 1, grain: 1, aberration: 1,
};

export type ViewName = 'raw' | 'concierge';

/** The shared settings, and per view the ones split off from them. */
export interface LookSet {
  base: Look;
  raw: Partial<Look>;
  concierge: Partial<Look>;
}

export const LOOK_GROUPS = ['Pixels', 'Light', 'Characters', 'Colour', 'Film'] as const;

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
  { key: 'charFill', label: 'Fill from lights behind', group: 'Characters', min: 0, max: 2, step: 0.05 },
  { key: 'charRim', label: 'Rim from lights behind', group: 'Characters', min: 0, max: 3, step: 0.05 },
  { key: 'charGlow', label: 'Glow showing over them', group: 'Characters', min: 0, max: 1, step: 0.01 },
  { key: 'rawColour', label: 'Raw view colour', group: 'Colour', min: 0, max: 1, step: 0.05 },
  { key: 'exposure', label: 'Exposure', group: 'Colour', min: -2, max: 2, step: 0.05 },
  { key: 'contrast', label: 'Contrast', group: 'Colour', min: 0.5, max: 1.8, step: 0.02 },
  { key: 'saturation', label: 'Saturation', group: 'Colour', min: 0, max: 2, step: 0.02 },
  { key: 'temperature', label: 'Temperature', group: 'Colour', min: -1, max: 1, step: 0.02 },
  { key: 'tint', label: 'Tint', group: 'Colour', min: -1, max: 1, step: 0.02 },
  { key: 'vignette', label: 'Vignette', group: 'Film', min: 0, max: 2.5, step: 0.05 },
  { key: 'grain', label: 'Grain', group: 'Film', min: 0, max: 4, step: 0.05 },
  { key: 'aberration', label: 'Colour fringes', group: 'Film', min: 0, max: 4, step: 0.05 },
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

const LOCAL = 'lidless.look.v1';

/** Tuning in progress in this browser, if any. */
export function loadLocalLook(): LookSet | null {
  try {
    const raw = localStorage.getItem(LOCAL);
    return raw ? cleanLookSet(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocalLook(set: LookSet | null): void {
  try {
    if (set) localStorage.setItem(LOCAL, JSON.stringify(lookSetJSON(set)));
    else localStorage.removeItem(LOCAL);
  } catch {
    // private windows and blocked storage: tuning still works, it just is not kept
  }
}
