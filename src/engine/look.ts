// The look: live settings for pixels, light, colour and film. Tuned with the look panel (L), kept per browser while
// tuning, and saved as the game's look in public/assets/look.json, which every page loads at start.

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
  /** How much of a light behind a character reaches the side we see, bounced off the surroundings. */
  charFill: number;
  bloom: number;
  shafts: number;
  streaks: number;
  /** The poisonous fog of raw view. */
  rawFog: number;
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
  lights: 1, ambient: 1, haze: 1, glow: 1, charFill: 1, bloom: 1, shafts: 1, streaks: 1, rawFog: 1,
  exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0,
  vignette: 1, grain: 1, aberration: 1,
};

export interface LookControl {
  key: keyof Look;
  label: string;
  group: 'Pixels' | 'Light' | 'Colour' | 'Film';
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
  { key: 'charFill', label: 'Fill on characters', group: 'Light', min: 0, max: 2, step: 0.05 },
  { key: 'bloom', label: 'Bloom', group: 'Light', min: 0, max: 3, step: 0.05 },
  { key: 'shafts', label: 'Light shafts', group: 'Light', min: 0, max: 4, step: 0.05 },
  { key: 'streaks', label: 'Lens streaks', group: 'Light', min: 0, max: 4, step: 0.05 },
  { key: 'rawFog', label: 'Raw view fog', group: 'Light', min: 0, max: 3, step: 0.05 },
  { key: 'exposure', label: 'Exposure', group: 'Colour', min: -2, max: 2, step: 0.05 },
  { key: 'contrast', label: 'Contrast', group: 'Colour', min: 0.5, max: 1.8, step: 0.02 },
  { key: 'saturation', label: 'Saturation', group: 'Colour', min: 0, max: 2, step: 0.02 },
  { key: 'temperature', label: 'Temperature', group: 'Colour', min: -1, max: 1, step: 0.02 },
  { key: 'tint', label: 'Tint', group: 'Colour', min: -1, max: 1, step: 0.02 },
  { key: 'vignette', label: 'Vignette', group: 'Film', min: 0, max: 2.5, step: 0.05 },
  { key: 'grain', label: 'Grain', group: 'Film', min: 0, max: 4, step: 0.05 },
  { key: 'aberration', label: 'Colour fringes', group: 'Film', min: 0, max: 4, step: 0.05 },
];

const LOCAL = 'lidless.look.v1';

/** Only known keys with numbers, so a stale or broken file cannot break the renderer. */
export function cleanLook(data: unknown): Partial<Look> {
  const out: Partial<Look> = {};
  if (!data || typeof data !== 'object') return out;
  for (const c of LOOK_CONTROLS) {
    const v = (data as Record<string, unknown>)[c.key];
    if (typeof v === 'number' && Number.isFinite(v)) out[c.key] = Math.min(c.max, Math.max(c.min, v));
  }
  return out;
}

/** The game's saved look, from public/assets/look.json, over the defaults. */
export async function loadProjectLook(base: string): Promise<Look> {
  try {
    const res = await fetch(`${base}/look.json`, { cache: 'no-store' });
    if (res.ok) return { ...LOOK_DEFAULTS, ...cleanLook(await res.json()) };
  } catch {
    // no saved look yet
  }
  return { ...LOOK_DEFAULTS };
}

/** Tuning in progress in this browser, if any. */
export function loadLocalLook(): Partial<Look> | null {
  try {
    const raw = localStorage.getItem(LOCAL);
    return raw ? cleanLook(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocalLook(look: Look | null): void {
  try {
    if (look) localStorage.setItem(LOCAL, JSON.stringify(look));
    else localStorage.removeItem(LOCAL);
  } catch {
    // private windows and blocked storage: tuning still works, it just is not kept
  }
}
