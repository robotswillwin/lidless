// The title screen: the game's name over its first scene, already drawn and moving behind it, and the ways in: on with
// the game in progress, a new game, a saved one, the settings, how to play. Shown as the game opens and from the menu
// (Title screen); not when the address asks for a scene or a new game (the checks and the editor), and not after a save
// was loaded from the menu, which reloads the page into it.

import { button, el } from './dom';
import { drawHelp } from './hud';
import { clearSave, listSaves, loadSave, writeSave, type Slot } from './save';
import { drawSettings, type Settings } from './settings';

/** Set before a reload that goes straight into the game: the title is not shown once. */
const SKIP = 'lidless.skipTitle';

/** Whether the title is shown as the game opens: not for an address that asks for a scene, and not right after a load. */
export function titleAtStart(params: URLSearchParams): boolean {
  let skip = false;
  try { skip = sessionStorage.getItem(SKIP) === '1'; sessionStorage.removeItem(SKIP); } catch { /* no session storage */ }
  return !skip && !['scene', 'new', 't', 'notitle'].some((k) => params.has(k));
}

/** The page loaded again straight into the game: after a new game, or a save loaded. */
export function reloadIntoGame(): void {
  try { sessionStorage.setItem(SKIP, '1'); } catch { /* the title shows; nothing worse */ }
  const p = new URLSearchParams(location.search);
  for (const k of ['new', 'scene', 'spawn']) p.delete(k);
  const q = p.toString();
  location.replace(`${location.pathname}${q ? `?${q}` : ''}`);
}

export interface TitleHooks {
  settings: () => Settings;
  onSettings: (s: Settings) => void;
  /** On with the game in progress: the title goes. */
  onContinue: () => void;
}

/**
 * The title over the stage. Continue goes on with the game in progress (or begins the game, if there is none saved);
 * a new game and a saved one reload the page into them. Returns a function that takes the title away.
 */
export function showTitle(stage: HTMLElement, hooks: TitleHooks): () => void {
  const box = el('section', 'title-screen', stage);
  box.setAttribute('aria-label', 'Lidless');
  stage.dataset.title = '';
  const close = () => { box.classList.add('out'); delete stage.dataset.title; window.setTimeout(() => box.remove(), 400); };
  const view = (draw: (panel: HTMLElement) => void) => {
    box.replaceChildren();
    el('h1', 'name', box, 'Lidless');
    el('p', 'line', box, 'Year 64 of Care');
    const panel = el('div', 'panel', box);
    draw(panel);
  };
  const back = (panel: HTMLElement) => button('back', 'Back', panel, () => view(main)).textContent = 'Back';
  const main = (panel: HTMLElement) => {
    const saved = !!loadSave('auto'), menu = el('nav', 'menu', panel);
    const item = (label: string, run: () => void, primary = false) => { const b = button(primary ? 'primary' : '', label, menu, run); b.textContent = label; return b; };
    item(saved ? 'Continue' : 'Begin', () => { close(); hooks.onContinue(); }, true).focus();
    if (saved) item('New game', () => view(confirmNew));
    if (listSaves().some((s) => s.slot !== 'auto')) item('Load game', () => view(load));
    item('Settings', () => view((p) => { drawSettings(p, hooks.settings(), hooks.onSettings); back(p); }));
    item('How to play', () => view((p) => { drawHelp(p); back(p); }));
  };
  const confirmNew = (panel: HTMLElement) => {
    el('p', 'ask', panel, 'Start a new game? The game in progress is replaced; your saved slots stay.');
    const row = el('div', 'menu', panel);
    button('primary', 'Start a new game', row, () => { clearSave('auto'); reloadIntoGame(); }).textContent = 'Start';
    button('', 'Back', row, () => view(main)).textContent = 'Back';
  };
  const load = (panel: HTMLElement) => {
    const list = el('div', 'menu', panel);
    const when = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    for (const s of listSaves().filter((x) => x.slot !== 'auto')) {
      const b = button('', `Load slot ${s.slot}`, list, () => { const d = loadSave(s.slot as Slot); if (d) { writeSave(d); reloadIntoGame(); } });
      b.textContent = `Slot ${s.slot}${s.where ? ` · ${s.where}` : ''}${s.savedAt ? ` · ${when(s.savedAt)}` : ''}`;
    }
    back(panel);
  };
  view(main);
  return close;
}
