// Her notebook: paper and pencil, in her hand, the same in both views. She reads it only where the Concierge cannot see
// her (her home, a blind spot): anywhere else it stays shut. What is in it follows the story: an entry is written once
// its condition holds, a line is added to it as she learns more, an errand is crossed out once it is run. Pages are
// tabs along its edge; what she has not read yet is marked with a dot, on its tab and at the line.

import { button, el } from './dom';
import { icon } from './icons';

export interface NoteLine {
  text: string;
  /** Written once this condition on the story holds (see conditions.ts). */
  when?: string;
}

export interface NoteEntry {
  id: string;
  name: string;
  lines?: (string | NoteLine)[];
  /** Written once this holds. */
  when?: string;
  /** Crossed out (an errand run) once this holds. */
  done?: string;
}

export interface NotePage {
  id: string;
  title: string;
  /** The page is in the notebook once this holds. */
  when?: string;
  /** What the page says while nothing is written on it; with none, the page waits until something is. */
  empty?: string;
  /** Its entries as a numbered list of their names (questions), not names with notes under them. */
  list?: boolean;
  entries: NoteEntry[];
}

export interface Notebook {
  /** In red, at the top of the first page. */
  warning?: string;
  pages: NotePage[];
}

export interface ShownLine { key: string; text: string; fresh: boolean }
/** `fresh`: anything in it she has not read; `new`: the entry itself (or its crossing out). */
export interface ShownEntry { key: string; name: string; lines: ShownLine[]; done: boolean; fresh: boolean; new: boolean }
export interface ShownPage { id: string; title: string; empty?: string; list: boolean; entries: ShownEntry[]; fresh: boolean }

const lineOf = (l: string | NoteLine): NoteLine => (typeof l === 'string' ? { text: l } : l);

/**
 * What is written in it now: the pages and entries whose conditions hold, the lines she has added, errands run crossed
 * out and put last. `read` holds what she has read (entries' and lines' keys, and `!done` for a crossing out she has
 * seen): the rest is fresh.
 */
export function notebookNow(nb: Notebook, known: (cond: string) => boolean, read: ReadonlySet<string>): ShownPage[] {
  const holds = (c?: string) => !c || known(c);
  return (nb.pages ?? []).filter((p) => holds(p.when)).flatMap((p) => {
    const entries = p.entries.filter((e) => holds(e.when)).map((e): ShownEntry => {
      const key = `${p.id}/${e.id}`, done = !!e.done && known(e.done);
      const lines = (e.lines ?? []).map(lineOf).map((l, i) => ({ key: `${key}#${i}`, text: l.text, when: l.when })).filter((l) => holds(l.when))
        .map(({ key: k, text }) => ({ key: k, text, fresh: !read.has(k) }));
      const isNew = !read.has(key) || (done && !read.has(`${key}!done`));
      return { key, name: e.name, lines, done, new: isNew, fresh: isNew || lines.some((l) => l.fresh) };
    });
    const ordered = [...entries.filter((e) => !e.done), ...entries.filter((e) => e.done)];
    if (!ordered.length && !p.empty) return [];
    return [{ id: p.id, title: p.title, empty: p.empty, list: !!p.list, entries: ordered, fresh: ordered.some((e) => e.fresh) }];
  });
}

/** Everything a page shows, as read: its entries, their lines, and the crossings out. */
export function keysOf(page: ShownPage): string[] {
  return page.entries.flatMap((e) => [e.key, ...e.lines.map((l) => l.key), ...(e.done ? [`${e.key}!done`] : [])]);
}

/**
 * The notebook open on a page: its tabs along the right edge (a dot on those with something new), the page in her
 * hand, and her warning at the top of the first. Reading a page marks what is on it read (`onRead`).
 */
export function drawNotebook(p: HTMLElement, nb: Notebook, pages: ShownPage[], tab: string | null, on: { tab: (id: string) => void; read: (keys: string[]) => void; close: () => void }): void {
  p.setAttribute('aria-label', 'Her notebook');
  const page = pages.find((x) => x.id === tab) ?? pages[0];
  const sheet = el('div', 'sheet', p);
  button('hud-close', 'Close', p, on.close).innerHTML = icon('close', 18);
  const tabs = el('nav', 'tabs', p);
  tabs.setAttribute('aria-label', 'Pages');
  for (const x of pages) {
    const t = button(`tab${x === page ? ' on' : ''}${x.fresh ? ' fresh' : ''}`, x.title, tabs, () => on.tab(x.id));
    t.textContent = x.title;
    t.setAttribute('aria-current', String(x === page));
  }
  if (!page) { el('p', 'note', sheet, 'nothing yet.'); return; }
  if (nb.warning && page === pages[0]) el('div', 'warning', sheet, nb.warning);
  el('h2', '', sheet, page.title);
  if (!page.entries.length) el('p', 'note', sheet, page.empty ?? '');
  if (page.list) {
    const list = el('ol', 'questions', sheet);
    for (const e of page.entries) el('li', `${e.done ? 'done' : ''}${e.new ? ' fresh' : ''}`, list, e.name);
  } else {
    const col = el('div', 'entries', sheet);
    for (const e of page.entries) {
      const d = el('div', `entry${e.done ? ' done' : ''}`, col);
      el('div', `name${e.new ? ' fresh' : ''}`, d, e.name);
      for (const l of e.lines) el('div', `note${l.fresh ? ' fresh' : ''}`, d, l.text);
    }
  }
  on.read(keysOf(page));
}
