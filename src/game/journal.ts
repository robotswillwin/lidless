// Her journal: on her device, readable anywhere, and the Concierge can read it too, so only what she does not mind it
// knowing goes in: what she has to do, the people she knows, the places she has been (the map), what anyone may see.
// What she keeps from it goes in her paper notebook (notebook.ts). Pages are tabs, as in the notebook, and what she has
// not read yet has a dot; its model is the notebook's (notebookNow).

import { button, el } from './dom';
import { icon } from './icons';
import { keysOf, type ShownPage } from './notebook';

/** The tab that is the map rather than a page of entries. */
export const PLACES = 'places';

/**
 * The journal open at a tab: its pages, with the map as the places between them (`map` draws it into the page), and
 * what it is: on her device, where the Concierge can read it. Reading a page marks what is on it read.
 */
export function drawJournal(p: HTMLElement, pages: ShownPage[], tab: string | null,
  on: { tab: (id: string) => void; read: (keys: string[]) => void; close: () => void; map: (body: HTMLElement) => void }): void {
  p.setAttribute('aria-label', 'Her journal');
  // the map sits after the people, where the bible has it: objectives, people, places, evidence
  const tabs: { id: string; title: string; fresh: boolean }[] = pages.map((x) => ({ id: x.id, title: x.title, fresh: x.fresh }));
  tabs.splice(Math.min(2, tabs.length), 0, { id: PLACES, title: 'Places', fresh: false });
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const head = el('div', 'head', p), nav = el('nav', 'tabs', head);
  nav.setAttribute('aria-label', 'Pages');
  for (const t of tabs) {
    const b = button(`tab${t === current ? ' on' : ''}${t.fresh ? ' fresh' : ''}`, t.title, nav, () => on.tab(t.id));
    b.textContent = t.title;
    b.setAttribute('aria-current', String(t === current));
  }
  el('div', 'hint', head, current.id === PLACES ? 'Tap a place to go there' : 'On your device. The Concierge can read it.');
  button('hud-close', 'Close', head, on.close).innerHTML = icon('close', 18);
  const body = el('div', `body${current.id === PLACES ? ' places' : ''}`, p);
  if (current.id === PLACES) return on.map(body);
  const page = pages.find((x) => x.id === current.id);
  if (!page) return;
  if (!page.entries.length) el('p', 'empty', body, page.empty ?? '');
  const list = el('div', 'entries', body);
  for (const e of page.entries) {
    const d = el('div', `entry${e.done ? ' done' : ''}`, list);
    const name = el('div', `name${e.new ? ' fresh' : ''}`, d, e.name);
    if (e.done) name.insertAdjacentHTML('afterbegin', '<svg class="tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>');
    for (const l of e.lines) el('div', `note${l.fresh && !e.new ? ' fresh' : ''}`, d, l.text);
  }
  on.read(keysOf(page));
}
