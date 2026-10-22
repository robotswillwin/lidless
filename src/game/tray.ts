// Her things: a tray that slides out along the bottom from the left ball, each thing painted as it really is, its name
// under it. Made for thumbs, nothing behind a hover: a tap on a thing (or holding a finger on it, or a right-click)
// shows it close up, with what is known about it, and Use takes it out to use on something; on the one in her hand it
// puts it back. In the Concierge's view its own words are on them ("Unlicensed item"), and a thing that exists only in
// its eye (a projection) is its own graphic; in raw view that is an empty place in her pocket.

import { button, el } from './dom';
import { arIcon, icon } from './icons';
import { pick, type ViewText } from './level';

export interface Item {
  /** The thing painted, an image under the assets (items/parcel.webp); without one, its icon stands in. */
  art?: string;
  icon: string;
  /** Only in one view: a projection exists only in the Concierge's eye. */
  only?: 'raw' | 'concierge';
  /** Made by people, outside its catalogue: the Concierge offers to dispose of it. */
  unlicensed?: boolean;
  name: ViewText;
  note?: ViewText;
}

/** A thing in the tray as the view on screen has it. */
export interface Thing {
  id: string;
  name: string;
  note: string;
  art?: string;
  icon: string;
  /** Drawn as the Concierge draws it: it exists only in its eye. */
  projected: boolean;
  /** In raw view, where something exists only in its eye: an empty place, its name crossed out. */
  ghost: boolean;
  /** The Concierge's label on it, in its view. */
  tag?: string;
  unlicensed: boolean;
}

/** What she carries, as the view on screen has it; where it cannot see her (`watched` false) it says nothing about it. */
export function thingsNow(items: Record<string, Item>, carried: string[], raw: boolean, watched = true): Thing[] {
  return carried.flatMap((id) => {
    const it = items[id];
    if (!it || (!raw && it.only === 'raw')) return [];
    const projected = !raw && it.only === 'concierge', ghost = raw && it.only === 'concierge';
    return [{
      id, name: pick(it.name, raw), note: it.note ? pick(it.note, raw) : '', art: projected ? undefined : it.art, icon: it.icon,
      projected, ghost, tag: !raw && watched && it.unlicensed ? 'Unlicensed' : undefined, unlicensed: watched && !!it.unlicensed,
    }];
  });
}

/** A thing's picture: painted, or its icon standing in; the Concierge's own graphic for a projection. */
export function pictureOf(t: Thing, size: number, assets: string): string {
  if (t.ghost) return '';
  if (t.projected) return arIcon(t.icon, size);
  if (t.art) return `<img src="${assets}/${t.art}" alt="" width="${size}" height="${size}" draggable="false">`;
  return `<span class="stand-in">${arIcon(t.icon, size)}</span>`;
}

/**
 * The tray's slots, out from the ball at `from` (its centre, in the HUD's pixels), each with its name under it, the one
 * in her hand lit. A tap on one shows it close up (`inspect`), where Use takes it out.
 */
export function drawTray(root: HTMLElement, things: Thing[], from: { x: number; y: number; r: number }, held: string | null, assets: string,
  on: { inspect: (id: string) => void }): HTMLElement {
  const tray = el('div', 'hud-tray', root);
  tray.setAttribute('role', 'toolbar');
  tray.setAttribute('aria-label', 'Her things');
  tray.style.left = `${from.x + from.r + 10}px`;
  tray.style.top = `${from.y}px`;
  if (!things.length) el('div', 'empty', tray, 'Nothing on her.');
  things.forEach((t, i) => {
    const slot = button(`slot${t.ghost ? ' ghost' : ''}${t.projected ? ' projected' : ''}${t.unlicensed && !t.ghost && t.tag ? ' unlicensed' : ''}${held === t.id ? ' held' : ''}`,
      t.ghost ? `${t.name}: not really there` : held === t.id ? `${t.name}, in her hand` : t.name, tray, () => on.inspect(t.id));
    slot.dataset.item = t.id;
    slot.style.animationDelay = `${i * 28}ms`;
    el('span', 'picture', slot).innerHTML = pictureOf(t, 52, assets);
    el('span', 'label', slot, t.name);
    if (t.tag) el('span', 'flag', slot);
    slot.addEventListener('pointerdown', (e) => e.stopPropagation());
    slot.addEventListener('contextmenu', (e) => { e.preventDefault(); on.inspect(t.id); });
  });
  return tray;
}

/**
 * A thing close up, over the tray: its picture, its name, what is known about it, and taking it out to use (or, the
 * one in her hand, putting it back). In the Concierge's view, a thing outside its catalogue comes with its offer to
 * dispose of it.
 */
export function drawInspect(root: HTMLElement, t: Thing, raw: boolean, assets: string, held: boolean,
  on: { hold: (id: string | null) => void; dispose: (id: string, dispose: boolean) => void; close: () => void }): HTMLElement {
  const card = el('section', `hud-inspect${t.ghost ? ' ghost' : ''}${t.projected ? ' projected' : ''}`, root);
  card.setAttribute('aria-label', t.name);
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  const pic = el('div', 'picture', card);
  pic.innerHTML = pictureOf(t, 112, assets);
  const words = el('div', 'words', card);
  el('h2', '', words, t.name);
  if (t.tag) el('div', 'tag', words, t.tag);
  if (t.note) el('p', 'note', words, t.note);
  const row = el('div', 'row', words);
  // Use takes it out to use on something; the one in her hand, Put back
  if (!t.ghost) button('primary', held ? `Put ${t.name} back` : `Use ${t.name}`, row, () => on.hold(held ? null : t.id)).textContent = held ? 'Put back' : 'Use';
  button('hud-close', 'Close', card, on.close).innerHTML = icon('close', 16);
  // its offer, in its own voice
  if (!raw && t.unlicensed) {
    const offer = el('div', 'co-offer', words);
    offer.insertAdjacentHTML('beforeend', icon('ask', 16));
    el('span', '', offer, 'Shall I dispose of it for you?');
    const choose = el('div', 'row', words);
    button('', 'Dispose', choose, () => on.dispose(t.id, true)).textContent = 'Dispose';
    button('', 'Keep', choose, () => on.dispose(t.id, false)).textContent = 'Keep';
  }
  return card;
}
