// Presets: kinds of light (a street lamp, a neon sign, a shop window) kept in public/assets/presets.json and shared by
// every scene. A light placed in a scene names its preset and keeps only what it does its own way, so a preset changed
// once changes every light of its kind. Placing one can bring effects along: a street lamp its light shaft.

import type { GodrayDef, LightDef, SteamDef } from './assets';

/** Settings a light has its own way, over its preset's: null turns off something its preset has (a lamp's cone). */
export type LightSettings = { [K in keyof LightDef]?: LightDef[K] | null };

/**
 * A light as a scene file has it: its place, its preset if it has one, and whatever it sets its own way; and `views`,
 * what it does its own way in one view only (stronger in raw view, another colour in the Concierge's).
 */
export type PlacedLight = LightSettings & { x: number; y: number; preset?: string; suggested?: number; views?: Partial<Record<'raw' | 'concierge', LightSettings>> };

export interface LightPreset {
  label: string;
  light: Partial<LightDef>;
  /** Effects placed along with it, at its place: a light shaft, steam. */
  with?: { godray?: Omit<GodrayDef, 'x' | 'y'>; steam?: Omit<SteamDef, 'x' | 'y'> };
}

export interface Presets {
  lights: Record<string, LightPreset>;
}

const registry: Presets = { lights: {} };

export const presets = (): Presets => registry;

export function setPresets(p: Partial<Presets>): void {
  registry.lights = { ...(p.lights ?? {}) };
}

/** A light with nothing set and no preset: a plain white lamp. */
const PLAIN: Omit<LightDef, 'x' | 'y'> = { z: 40, r: 300, c: [1, 1, 1], i: 1, zone: 0 };

/**
 * The light as it shines: its preset's settings, its own over them, in a view (`raw` or `concierge`) that view's own
 * over those, and what it turns off left out. Without a view, as it is in both.
 */
export function resolveLight(l: PlacedLight, view?: 'raw' | 'concierge'): LightDef {
  const { views, ...own } = l;
  const out: Record<string, unknown> = { ...PLAIN, ...(l.preset ? registry.lights[l.preset]?.light : undefined), ...own, ...(view ? views?.[view] : undefined) };
  for (const k of Object.keys(out)) if (out[k] === null) delete out[k];
  return out as unknown as LightDef;
}

/** The game's presets, from public/assets/presets.json; none if there is no such file. */
export async function loadPresets(base: string): Promise<Presets> {
  try {
    const res = await fetch(`${base}/presets.json`, { cache: 'no-store' });
    if (res.ok) setPresets((await res.json()) as Presets);
  } catch {
    // no presets: every light has its own settings
  }
  return registry;
}
