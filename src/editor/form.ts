// The side panel's fields: a change shows at once, and leaving a field keeps an undo step. Shared by every panel.

import type { ViewNote, ViewText } from '../game/level';
import { esc, prefs, redraw, remember, savePrefs, snapshot, type Kind } from './state';

type Input = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** One labelled field. */
export function field(label: string, input: Input, wide = false): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = `ed-field${wide ? ' wide' : ''}`;
  const name = document.createElement('span');
  name.textContent = label;
  row.append(name, input);
  let before = '';
  input.addEventListener('focus', () => { before = snapshot(); });
  input.addEventListener('change', () => { if (before) remember(before); before = snapshot(); });
  return row;
}

/** `after` runs after each change; by default the overlay is drawn again. */
export function num(label: string, value: number, set: (v: number) => void, opts: { step?: number; min?: number; max?: number; after?: () => void } = {}): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = String(value);
  input.step = String(opts.step ?? 1);
  if (opts.min !== undefined) input.min = String(opts.min);
  if (opts.max !== undefined) input.max = String(opts.max);
  input.addEventListener('input', () => { const v = Number(input.value); if (Number.isFinite(v)) { set(v); (opts.after ?? redraw.overlay)(); } });
  return field(label, input);
}

export function str(label: string, value: string, set: (v: string) => void, opts: { area?: boolean; list?: string[]; after?: () => void } = {}): HTMLLabelElement {
  const input = document.createElement(opts.area ? 'textarea' : 'input') as HTMLInputElement | HTMLTextAreaElement;
  input.value = value;
  if (opts.area) (input as HTMLTextAreaElement).rows = 3;
  if (opts.list && input instanceof HTMLInputElement) {
    const id = `list-${Math.random().toString(36).slice(2)}`, list = document.createElement('datalist');
    list.id = id;
    for (const v of opts.list) list.append(new Option(v, v));
    input.setAttribute('list', id);
    queueMicrotask(() => input.parentElement?.append(list));
  }
  input.addEventListener('input', () => { set(input.value); (opts.after ?? redraw.overlay)(); });
  return field(label, input, opts.area);
}

export function choice(label: string, value: string, options: [string, string][], set: (v: string) => void, after: () => void = redraw.overlay): HTMLLabelElement {
  const input = document.createElement('select');
  for (const [v, name] of options) input.append(new Option(name, v));
  input.value = value;
  input.addEventListener('input', () => { set(input.value); after(); });
  return field(label, input);
}

export function check(label: string, value: boolean, set: (v: boolean) => void, after: () => void = redraw.overlay): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value;
  input.addEventListener('input', () => { set(input.checked); after(); });
  const row = field(label, input);
  row.classList.add('check');
  return row;
}

export function colour(label: string, value: [number, number, number], set: (v: [number, number, number]) => void): HTMLLabelElement {
  const input = document.createElement('input');
  input.type = 'color';
  const hex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  input.value = `#${value.map(hex).join('')}`;
  input.addEventListener('input', () => { const n = parseInt(input.value.slice(1), 16); set([(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]); redraw.overlay(); });
  return field(label, input);
}

export function buttons(...list: [string, () => void, string?][]): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'ed-buttons';
  for (const [name, run, cls] of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = name;
    if (cls) b.className = cls;
    b.addEventListener('click', run);
    row.append(b);
  }
  return row;
}

export function heading(title: string, note = ''): HTMLDivElement {
  const h = document.createElement('div');
  h.className = 'ed-heading';
  h.innerHTML = `<h2>${esc(title)}</h2>${note ? `<p>${esc(note)}</p>` : ''}`;
  return h;
}

/** A text that can differ between the views: two fields, kept as one string when they are the same. */
export function viewText(label: string, value: ViewText | undefined, set: (v: ViewText | undefined) => void, area = false): HTMLLabelElement[] {
  const now = { concierge: typeof value === 'string' ? value : value?.concierge ?? '', raw: typeof value === 'string' ? value : value?.raw ?? '' };
  const store = () => set(!now.concierge && !now.raw ? undefined : now.concierge === now.raw ? now.concierge : { ...now });
  return [
    str(`${label}, Concierge view`, now.concierge, (v) => { now.concierge = v; store(); }, { area }),
    str(`${label}, raw view`, now.raw, (v) => { now.raw = v; store(); }, { area }),
  ];
}

/** The label under a name on hover: the Concierge's classification in its view, her own note in raw view. */
export function labelFields(value: ViewNote | undefined, set: (v: ViewNote | undefined) => void): HTMLLabelElement[] {
  const now = { concierge: typeof value === 'string' ? value : value?.concierge ?? '', raw: typeof value === 'string' ? '' : value?.raw ?? '' };
  const store = () => set(!now.raw ? now.concierge || undefined : { ...(now.concierge ? { concierge: now.concierge } : {}), raw: now.raw });
  return [
    str('Label, the Concierge’s (its view only)', now.concierge, (v) => { now.concierge = v; store(); }),
    str('Her note (raw view only)', now.raw, (v) => { now.raw = v; store(); }),
  ];
}

/**
 * A section of the side panel that folds away, folded or not as the viewer last left it: its title, a count or a word
 * beside it (`tone` colours it: error, warning, ok), tools on its right, and what is in it.
 */
export function section(id: string, title: string, fill: (body: HTMLElement) => void, opts: { badge?: string; tone?: string; tools?: HTMLElement[] } = {}): HTMLElement {
  const wrap = document.createElement('section'), head = document.createElement('div'), body = document.createElement('div');
  wrap.className = 'ed-section';
  wrap.dataset.section = id;
  head.className = 'ed-section-head';
  body.className = 'ed-section-body';
  const fold = document.createElement('button');
  fold.type = 'button';
  fold.className = 'ed-fold';
  fold.innerHTML = `<span class="chev" aria-hidden="true"></span><span class="t">${esc(title)}</span>${opts.badge ? `<span class="badge${opts.tone ? ` ${opts.tone}` : ''}">${esc(opts.badge)}</span>` : ''}`;
  const sync = () => { body.hidden = prefs.collapsed.has(id); fold.setAttribute('aria-expanded', String(!body.hidden)); };
  fold.addEventListener('click', () => { if (prefs.collapsed.has(id)) prefs.collapsed.delete(id); else prefs.collapsed.add(id); savePrefs(); sync(); });
  head.append(fold, ...(opts.tools ?? []));
  fill(body);
  sync();
  wrap.append(head, body);
  return wrap;
}

const EYE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><path d="M4 20L20 4"/></svg>';

/** Shows or hides a kind of thing on the scene, as the viewer last left it. */
export function eye(kind: Kind, label: string, after: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ed-eye';
  const sync = () => {
    const hidden = prefs.hidden.has(kind);
    b.setAttribute('aria-pressed', String(!hidden));
    b.setAttribute('aria-label', `${hidden ? 'Show' : 'Hide'} ${label} on the scene`);
    b.title = `${hidden ? 'Show' : 'Hide'} ${label} on the scene`;
    b.innerHTML = hidden ? EYE_OFF : EYE;
  };
  b.addEventListener('click', (e) => { e.stopPropagation(); if (prefs.hidden.has(kind)) prefs.hidden.delete(kind); else prefs.hidden.add(kind); savePrefs(); sync(); after(); });
  sync();
  return b;
}
