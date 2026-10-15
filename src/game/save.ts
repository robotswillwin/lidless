// Autosave in the browser. Everything is optional: a missing or broken save just starts a new game.

export interface SaveData {
  v: 1;
  heroX: number;
  facing: 1 | -1;
  view: number;
  /** Ink story state, which holds the dialogue progress and the has_raw flag. */
  ink: string | null;
}

const KEY = 'lidless.save.v1';

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    return d && d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    // private windows and blocked storage: play on without saving
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
