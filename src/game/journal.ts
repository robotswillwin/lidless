// Her journal: on her device, readable anywhere, and the Concierge can read it too, so only what she does not mind it
// knowing goes in: what she has to do, the people she knows, the places she has been (the map), what anyone may see.
// What she keeps from it goes in her paper notebook (notebook.ts). Her device is her own head-up display, in her
// augmented view: the journal is a window of glass in the air before her, its pages a tab bar floating at its side,
// what she has not read yet with a dot; its model is the notebook's (notebookNow).

import { button, el } from './dom';
import { icon } from './icons';
import { keysOf, type ShownPage } from './notebook';

/** The tab that is the map rather than a page of entries. */
export const PLACES = 'places';

/** Each page's icon on its tab. */
const ICONS: Record<string, string> = { objectives: 'objectives', people: 'people', places: 'map', evidence: 'evidence' };

/**
 * The journal open at a tab: its pages, with the map as the places between them (`map` draws it into the page), and
 * what it is: on her device, where the Concierge can read it. Reading a page marks what is on it read.
 */
export function drawJournal(p: HTMLElement, pages: ShownPage[], tab: string | null,
  on: { tab: (id: string) => void; read: (keys: string[]) => void; close: () => void; map: (body: HTMLElement) => void; picture?: (thing: string) => string }): void {
  p.setAttribute('aria-label', 'Her journal');
  // the map sits after the people, where the bible has it: objectives, people, places, evidence
  const tabs: { id: string; title: string; fresh: boolean }[] = pages.map((x) => ({ id: x.id, title: x.title, fresh: x.fresh }));
  tabs.splice(Math.min(2, tabs.length), 0, { id: PLACES, title: 'Places', fresh: false });
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  // its pages beside the window, each with its icon; the window's heading the page open
  const nav = el('nav', 'tabs', p), head = el('div', 'head', p);
  nav.setAttribute('aria-label', 'Pages');
  for (const t of tabs) {
    const b = button(`tab${t === current ? ' on' : ''}${t.fresh ? ' fresh' : ''}`, t.title, nav, () => on.tab(t.id));
    b.innerHTML = `${icon(ICONS[t.id] ?? 'journal', 20)}<span>${t.title}</span>`;
    b.setAttribute('aria-current', String(t === current));
  }
  el('h2', 'title', head, current.title);
  // on her device: the Concierge reads it too, and the journal says so
  if (current.id === PLACES) el('div', 'hint', head, 'Tap a place to see it');
  else {
    const read = el('div', 'hint read', head);
    read.innerHTML = `${icon('eyes', 15)}<span>On your device. The Concierge can read it.</span>`;
    read.title = 'On your device. The Concierge can read it.';
  }
  button('hud-close', 'Close', head, on.close).innerHTML = icon('close', 18);
  const body = el('div', `body${current.id === PLACES ? ' places' : ''}`, p);
  body.dataset.page = current.id;
  if (current.id === PLACES) return on.map(body);
  const page = pages.find((x) => x.id === current.id);
  if (!page) return;
  // an empty page says so under its own icon, large
  if (!page.entries.length) el('div', 'empty', body).innerHTML = `${icon(ICONS[page.id] ?? 'journal', 40)}<p>${page.empty || 'Nothing written here yet.'}</p>`;
  const list = el('div', 'entries', body), first = page.entries.find((e) => !e.done);
  for (const e of page.entries) {
    // what she has to do next, large; the people she knows by their initial
    const d = el('div', `entry${e.done ? ' done' : ''}${page.id === 'objectives' && e === first ? ' current' : ''}`, list);
    if (page.id === 'people') el('span', 'initial', d, [...e.name.replace(/^the\s+/i, '')][0]?.toUpperCase() ?? '?').setAttribute('aria-hidden', 'true');
    // a thing with it (evidence she found): its picture, as the view shows it
    const pic = e.thing && on.picture ? on.picture(e.thing) : '';
    if (pic) { d.classList.add('with-thing'); el('div', 'thing', d).innerHTML = pic; }
    const name = el('div', `name${e.new ? ' fresh' : ''}`, d, e.name);
    if (e.done) name.insertAdjacentHTML('afterbegin', '<svg class="tick" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>');
    for (const l of e.lines) el('div', `note${l.fresh && !e.new ? ' fresh' : ''}`, d, l.text);
  }
  on.read(keysOf(page));
}
