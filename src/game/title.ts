// The title screen: the game's name over its first scene, already drawn and moving behind it, and the ways in: on with
// the game in progress, a new game, a saved one, the settings, how to play. Shown as the game opens and from the menu
// (Title screen); not when the address asks for a scene or a new game (the checks and the editor), and not after a save
// was loaded from the menu, which reloads the page into it.

import { button, el } from './dom';
import { Eye, eyeMark } from './eye';
import { drawHelp } from './hud';
import { icon } from './icons';
import { clearSave, listSaves, loadSave, loadThumb, writeSave, writeThumb, type Slot } from './save';
import { drawSettings, type Settings } from './settings';

/** When a game was saved, as a player says it: today at 13:24, yesterday at 9:05, or 24 Oct at 13:24. */
export function savedWhen(t: number, now = Date.now()): string {
  const d = new Date(t), day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }), days = Math.round((day(new Date(now)) - day(d)) / 86400000);
  if (days === 0) return `Today at ${time}`;
  if (days === 1) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} at ${time}`;
}

/** Set before a reload that goes straight into the game: the title is not shown once. */
const SKIP = 'lidless.skipTitle';

/** Whether the title is shown as the game opens: not for an address that asks for a scene, and not right after a load. */
export function titleAtStart(params: URLSearchParams): boolean {
  let skip = false;
  try { skip = sessionStorage.getItem(SKIP) === '1'; sessionStorage.removeItem(SKIP); } catch { /* no session storage */ }
  return !skip && !['scene', 'new', 't', 'notitle', 'terminal', 'opening'].some((k) => params.has(k));
}

const BEGIN = 'lidless.begin';

/** A new game: the page loaded again straight into it, where its story's opening begins. */
export function startNewGame(): void {
  try { sessionStorage.setItem(BEGIN, '1'); } catch { /* it starts without its opening */ }
  reloadIntoGame();
}

/** Whether this page is a new game started from the title screen (once: asked again, it is not). */
export function takeBegin(): boolean {
  try { const b = sessionStorage.getItem(BEGIN) === '1'; sessionStorage.removeItem(BEGIN); return b; } catch { return false; }
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
  /**
   * Its eye opens as it shows (come back to from the game); without, it shows open, as the wait's eye left it as the
   * game opened.
   */
  openEye?: boolean;
}

/**
 * The title over the stage: its mark, the eye from the wait, open and looking about; the name; and the ways in, down
 * the left over a shade, the scene moving on the right. Continue goes on with the game in progress (or begins the game,
 * if there is none saved); a new game and a saved one reload the page into them. The settings and how to play open in
 * the same place, under their name and Back. Returns a function that takes the title away.
 */
export function showTitle(stage: HTMLElement, hooks: TitleHooks): () => void {
  const box = el('section', 'title-screen', stage);
  box.setAttribute('aria-label', 'Lidless');
  stage.dataset.title = '';
  const brand = el('header', 'brand', box);
  brand.innerHTML = eyeMark('title-eye');
  // as the wait left it: open, its pupil lit, looking about and blinking now and then
  const eye = new Eye(brand.querySelector('svg')!, () => document.documentElement.dataset.motion === 'reduced');
  eye.play(hooks.openEye ? 0.2 : 3.4);
  el('h1', 'logo', brand, 'Lidless');
  el('p', 'tagline', brand, 'Year 64 of Care');
  const panel = el('div', 'panel', box);
  const close = () => { eye.stop(); box.classList.add('out'); delete stage.dataset.title; window.setTimeout(() => box.remove(), 400); };
  /** One of its pages: the ways in, or another under its name with Back over it. */
  const view = (draw: (panel: HTMLElement) => void, title?: string) => {
    panel.replaceChildren();
    box.classList.toggle('sub', !!title);
    if (title) {
      const head = el('div', 'head', panel);
      button('back', 'Back (Esc)', head, () => view(main)).innerHTML = `${icon('back', 16)}<span>Back</span>`;
      el('h2', '', head, title);
    }
    draw(panel);
    if (title) panel.querySelector<HTMLElement>('.back')?.focus({ preventScroll: true });
  };
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('sub')) { e.stopPropagation(); view(main); } });
  // the game in progress, at the foot of the screen: its picture, where she is and when it was; a tap goes on with it
  const auto = loadSave('auto');
  if (auto) {
    const card = button('continue-card', `Continue from ${auto.where ?? 'where you were'}`, box, () => { close(); hooks.onContinue(); });
    const thumb = loadThumb('auto');
    if (thumb) { const img = el('img', 'shot', card) as HTMLImageElement; img.src = thumb; img.alt = ''; }
    const words = el('span', 'words', card);
    el('span', 'where', words, auto.where ?? 'Your game');
    if (auto.savedAt) el('span', 'when', words, savedWhen(auto.savedAt));
  }
  const main = (panel: HTMLElement) => {
    const saved = !!loadSave('auto'), menu = el('nav', 'menu', panel);
    menu.setAttribute('aria-label', 'Lidless');
    const item = (label: string, run: () => void, primary = false) => { const b = button(primary ? 'primary' : '', label, menu, run); b.textContent = label; return b; };
    item(saved ? 'Continue' : 'Begin', () => { close(); hooks.onContinue(); }, true).focus({ preventScroll: true });
    if (saved) item('New game', () => view(confirmNew, 'New game'));
    if (listSaves().some((s) => s.slot !== 'auto')) item('Load game', () => view(load, 'Load game'));
    item('Settings', () => view((p) => drawSettings(p, hooks.settings(), hooks.onSettings), 'Settings'));
    item('How to play', () => view(drawHelp, 'How to play'));
  };
  const confirmNew = (panel: HTMLElement) => {
    el('p', 'ask', panel, 'The game in progress is replaced by a new one. Your saved slots stay.');
    const row = el('nav', 'menu', panel);
    button('primary', 'Start a new game', row, () => { clearSave('auto'); startNewGame(); }).textContent = 'Start a new game';
  };
  const load = (panel: HTMLElement) => {
    const list = el('nav', 'menu slots', panel);
    const when = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    for (const s of listSaves().filter((x) => x.slot !== 'auto')) {
      const b = button('', `Load slot ${s.slot}`, list, () => { const d = loadSave(s.slot as Slot); if (d) { writeSave(d); writeThumb('auto', loadThumb(s.slot)); reloadIntoGame(); } });
      if (s.thumb) { const img = el('img', 'shot', b) as HTMLImageElement; img.src = s.thumb; img.alt = ''; }
      const words = el('span', 'words', b);
      el('span', 'slot', words, `Slot ${s.slot}`);
      el('span', 'where', words, [s.where, when(s.savedAt)].filter(Boolean).join(' · '));
    }
  };
  view(main);
  return close;
}
