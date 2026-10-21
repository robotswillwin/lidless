// Saves in the browser: the autosave, which the game writes as she plays, and a few slots she saves into herself.
// Everything is optional: a missing or broken save just starts a new game. A save says its version (v), and an older one
// is brought up to date as it loads; the story's state inside it survives changes to the story (Dialogue.load). The game
// saves only where it is safe: never in the middle of a conversation.

export interface SaveData {
  v: 2;
  /** The scene she is in; old saves have none and start where the world starts. */
  scene?: string;
  heroX: number;
  facing: 1 | -1;
  view: number;
  /** Ink story state: what has happened, what she knows and carries. */
  ink: string | null;
  /** How closely the Concierge is watching her, 0 to 3. */
  attention?: number;
  /** What she is wearing: one of the world's outfits. */
  outfit?: string;
  /** A projection over it, a virtual outfit, if one is on. */
  projection?: string;
  /** When it was saved (ms since 1970), and where: the scene's name. For the list of saves. */
  savedAt?: number;
  where?: string;
  /** The places she has been, and in each what she has seen of what goes on the map (ways out, people): see map.ts. */
  visited?: string[];
  seen?: Record<string, string[]>;
  /** What she has read in her notebook (see notebook.ts). */
  read?: string[];
  /** How many times she has gone from one scene to another, and how far each scene's rotations have turned (rotate.ts). */
  arrived?: number;
  rotations?: Record<string, number>;
  /** Her visits to privacy rooms whose doors the Concierge sees, by scene: her arrival counts then (privacy.ts). */
  visits?: Record<string, number[]>;
}

/** The autosave, or one of the slots she saves into. */
export type Slot = 'auto' | 1 | 2 | 3;
export const SLOTS: Slot[] = [1, 2, 3];
// the autosave keeps the key it has always had, so a game in progress carries on
const key = (slot: Slot) => (slot === 'auto' ? 'lidless.save.v1' : `lidless.slot.${slot}`);

/** A save brought up to this game's version, or null if it is none (or one from a newer game). */
export function upgrade(d: unknown): SaveData | null {
  if (!d || typeof d !== 'object') return null;
  const s = d as Record<string, unknown>;
  if (typeof s.heroX !== 'number') return null;
  // 1: the same, without when and where; they come with the next save
  if (s.v === 1) return { ...(s as unknown as SaveData), v: 2 };
  return s.v === 2 ? (s as unknown as SaveData) : null;
}

export function loadSave(slot: Slot = 'auto'): SaveData | null {
  try {
    const raw = localStorage.getItem(key(slot));
    return raw ? upgrade(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData, slot: Slot = 'auto'): void {
  try {
    localStorage.setItem(key(slot), JSON.stringify(d));
  } catch {
    // private windows and blocked storage: play on without saving
  }
}

export function clearSave(slot: Slot = 'auto'): void {
  try {
    localStorage.removeItem(key(slot));
  } catch {
    // nothing to clear
  }
}

/** Every save there is, the autosave first: when and where each was made. */
export function listSaves(): { slot: Slot; savedAt?: number; where?: string }[] {
  return (['auto', ...SLOTS] as Slot[]).flatMap((slot) => {
    const d = loadSave(slot);
    return d ? [{ slot, savedAt: d.savedAt, where: d.where }] : [];
  });
}
