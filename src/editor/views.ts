// Editing each view on its own. In Both mode a change is made for both views, and that setting becomes the same in both;
// in Raw or AR mode it is that view's own, over what the thing has in both (kept under its `views`). What is only in one
// view is set apart from what is in both by `only` (a light by its `ar` and `raw` flags).

import type { Only } from '../engine/assets';
import { ed } from './state';

/** The view on screen. */
export const shownView = (): Only => (ed.view < 0.5 ? 'raw' : 'concierge');
/** The view edits go to only, or none in Both mode. */
export const editView = (): Only | null => (ed.mode === 'both' ? null : ed.mode);
/** A view's name in the editor. */
export const viewLabel = (v: Only): string => (v === 'raw' ? 'raw' : 'AR');

type WithViews = { views?: Partial<Record<Only, Record<string, unknown>>> };

/** Drop what a thing no longer does its own way in a view. */
function tidy(o: WithViews): void {
  for (const v of ['raw', 'concierge'] as const) if (o.views?.[v] && !Object.keys(o.views[v]!).length) delete o.views[v];
  if (o.views && !Object.keys(o.views).length) delete o.views;
}

/**
 * Set a setting of a thing for the mode: in Raw or AR mode as that view's own, dropped when it is what the thing has in
 * both (`same`); in Both mode for both views, by `shared` (a light's own setting, over its preset), and no view's own
 * any more. undefined turns it off, in a view written out as null.
 */
export function setFor(o: object, k: string, v: unknown, opts: { same?: unknown; shared?: (k: string, v: unknown) => void } = {}): void {
  const t = o as WithViews & Record<string, unknown>, only = editView();
  if (only) {
    const views = (t.views ??= {}), own = (views[only] ??= {});
    if (JSON.stringify(v ?? null) === JSON.stringify(('same' in opts ? opts.same : t[k]) ?? null)) delete own[k];
    else own[k] = v === undefined ? null : v;
  } else {
    if (opts.shared) opts.shared(k, v);
    else if (v === undefined) delete t[k];
    else t[k] = v;
    for (const view of ['raw', 'concierge'] as const) if (t.views?.[view]) delete t.views[view]![k];
  }
  tidy(t);
}

/** The views a thing has any of these settings its own way in. */
export const ownIn = (o: object, ...keys: string[]): Only[] => (['raw', 'concierge'] as const).filter((v) => keys.some((k) => (o as WithViews).views?.[v] && k in (o as WithViews).views![v]!));

/** Whether a thing does anything its own way in a view. */
export const hasOwn = (o: object, v: Only): boolean => !!(o as WithViews).views?.[v];

/** Forget what a thing does its own way in a view: it is as it is in both again. */
export function sameInBoth(o: object, v: Only): void {
  delete (o as WithViews).views?.[v];
  tidy(o as WithViews);
}

/**
 * Mark a field's label with the views it is set its own way in: a list, or a function asked again after each change in
 * the field, so the mark follows what is typed.
 */
export function markOwn(row: HTMLElement, views: Only[] | (() => Only[])): HTMLElement {
  const label = row.querySelector('span');
  const draw = () => {
    const now = typeof views === 'function' ? views() : views;
    row.querySelectorAll('.ed-own').forEach((p) => p.remove());
    row.classList.toggle('own', now.length > 0);
    for (const v of now) {
      const pill = document.createElement('span');
      pill.className = `ed-own ${v}`;
      pill.textContent = viewLabel(v);
      pill.title = `Set its own way in ${v === 'raw' ? 'raw view' : 'the Concierge’s view (AR)'}`;
      label?.append(pill);
    }
  };
  draw();
  if (typeof views === 'function') for (const ev of ['input', 'change']) row.addEventListener(ev, () => queueMicrotask(draw));
  return row;
}
