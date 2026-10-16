// Level data: where you can walk, where the hero starts, and the things you can look at or talk to.

/** Text that can differ between Concierge view and raw view. */
export type ViewText = string | { concierge: string; raw: string };

export interface Hotspot {
  id: string;
  name: ViewText;
  /** x, y, w, h in level pixels. */
  rect: [number, number, number, number];
  /** Where the hero walks to before interacting; look-only hotspots far away can leave it out. */
  stand?: number;
  /** Which way the hero faces when she gets there. */
  face?: 1 | -1;
  look?: ViewText;
  /** Ink knot to run. */
  talk?: string;
  /** A door or the end of the street: using it goes to this scene, arriving at this place there. */
  go?: { scene: string; spawn: string };
  /**
   * Only there in one view. A generated person is gone in raw view ("concierge"); someone the Concierge edits
   * out can only be found in raw view ("raw"). Raw view is the only way to tell who is real.
   */
  only?: 'raw' | 'concierge';
}

export interface LevelDef {
  walk: { y: number; x0: number; x1: number };
  /**
   * The hero's sprite is a name in the scene, or a path under assets such as "cast/hero". Anchor and smoke (where her
   * cigarette is, from her feet) are for sprites that do not say themselves.
   */
  hero: { sprite: string; x: number; anchor?: [number, number]; smoke?: [number, number]; speed: number };
  hotspots: Hotspot[];
}

/** Whether a hotspot is there in the current view. */
export const inView = (h: Hotspot, raw: boolean): boolean => !h.only || (h.only === 'raw') === raw;

export const pick = (t: ViewText, raw: boolean): string => (typeof t === 'string' ? t : raw ? t.raw : t.concierge);

export async function loadLevel(base: string): Promise<LevelDef> {
  const res = await fetch(`${base}/level.json`);
  if (!res.ok) throw new Error(`could not load ${base}/level.json (${res.status})`);
  return res.json() as Promise<LevelDef>;
}
