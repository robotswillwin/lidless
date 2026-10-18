// The look panel: sliders for pixels, light, characters, colour and film, live on the renderer. L opens and closes it.
// A setting is the same in both views ("both") or split: then it has a value of its own in raw view and in Concierge
// view, and its slider edits the view on screen (E switches). Tuning is kept in this browser until it is saved as the
// game's look (public/assets/look.json, on the dev server).

import {
  cloneLookSet, defaultLookSet, isSplit, LOOK_CONTROLS, LOOK_GROUPS, lookFor, lookSetJSON, loadLocalLook, saveLocalLook,
  type Look, type LookSet, type ViewName,
} from './engine/look';
import type { Renderer } from './engine/renderer';

export interface LookPanel {
  toggle(): void;
  /** Show the values of the view now on screen; call it when the view switches. */
  refresh(): void;
  readonly open: boolean;
}

export interface LookPanelOptions {
  /** The view on screen, which split settings edit. */
  view: () => ViewName;
  onToggle?: (open: boolean) => void;
}

const VIEW_LABEL: Record<ViewName, string> = { raw: 'raw view', concierge: 'Concierge view' };

export function createLookPanel(renderer: Renderer, project: LookSet, host: HTMLElement, opts: LookPanelOptions): LookPanel {
  let set = loadLocalLook(project) ?? cloneLookSet(project), saved = cloneLookSet(project);
  renderer.setLook(set);

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  };
  const panel = el('aside', 'look');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Look');
  const note = el('p', 'look-note'), editing = el('p', 'look-editing');
  const inputs = new Map<keyof Look, HTMLInputElement | HTMLSelectElement>(), outputs = new Map<keyof Look, HTMLOutputElement>();
  const links = new Map<keyof Look, HTMLButtonElement>();

  const format = (key: keyof Look, v: number) => {
    const c = LOOK_CONTROLS.find((x) => x.key === key)!;
    if (key === 'colorLevels' && v === 0) return 'all';
    return c.step >= 1 ? String(v) : v.toFixed(2);
  };
  const changed = () => JSON.stringify(lookSetJSON(set)) !== JSON.stringify(lookSetJSON(saved));
  const status = (text?: string) => { note.textContent = text ?? (changed() ? 'Not saved: kept in this browser only.' : ''); };
  const keep = () => { renderer.setLook(set); saveLocalLook(set, saved); };

  /** Show every setting as it is in the view on screen. */
  const sync = () => {
    const view = opts.view(), now = lookFor(set, view);
    for (const c of LOOK_CONTROLS) {
      inputs.get(c.key)!.value = String(now[c.key]);
      const out = outputs.get(c.key);
      if (out) out.value = format(c.key, now[c.key]);
      const link = links.get(c.key)!, split = isSplit(set, c.key);
      link.textContent = split ? 'split' : 'both';
      link.dataset.view = split ? view : '';
      link.setAttribute('aria-pressed', String(split));
      link.title = split ? `Its own value in each view; this slider edits ${VIEW_LABEL[view]}. Click to use one value for both.` : 'The same in both views. Click to give each view its own value.';
    }
    const anySplit = LOOK_CONTROLS.some((c) => isSplit(set, c.key));
    editing.textContent = anySplit ? `Split settings edit ${VIEW_LABEL[view]}. E switches view.` : '';
    editing.dataset.view = view;
    status();
  };
  const replace = (next: LookSet, kept: boolean) => {
    set = cloneLookSet(next);
    renderer.setLook(set);
    saveLocalLook(kept ? set : null, saved);
    sync();
  };

  const button = (text: string, title: string, run: () => void) => {
    const b = el('button', '', text);
    b.type = 'button';
    b.title = title;
    b.addEventListener('click', run);
    return b;
  };
  const head = el('div', 'look-head');
  head.append(
    el('strong', '', 'Look'),
    button('Undo', 'Back to the saved look', () => replace(saved, false)),
    button('Defaults', 'Back to the original look, the same in both views', () => replace(defaultLookSet(), true)),
    button('Copy', 'Copy these settings as JSON', () => { void navigator.clipboard?.writeText(JSON.stringify(lookSetJSON(set), null, 2)).then(() => status('Copied.'), () => status('Could not copy.')); }),
  );
  // saving into the project only works on the dev server, which writes the file
  if (import.meta.env.DEV) head.append(button('Save', 'Save as the game’s look, in public/assets/look.json', async () => {
    try {
      const res = await fetch('/__look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lookSetJSON(set)) });
      if (!res.ok) throw new Error(await res.text());
      saved = cloneLookSet(set);
      saveLocalLook(null);
      status('Saved as the game’s look.');
    } catch (err) {
      status(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }));
  panel.append(head, note, editing);

  for (const group of LOOK_GROUPS) {
    const section = el('section');
    section.append(el('h3', '', group));
    for (const c of LOOK_CONTROLS.filter((x) => x.group === group)) {
      const id = `look-${c.key}`, row = el('div', 'look-row'), name = el('label', '', c.label);
      name.htmlFor = id;
      // both views share it, or each view has its own
      const link = button('both', '', () => {
        const view = opts.view();
        if (isSplit(set, c.key)) {
          set.base[c.key] = lookFor(set, view)[c.key];
          delete set.raw[c.key];
          delete set.concierge[c.key];
        } else {
          set.raw[c.key] = set.base[c.key];
          set.concierge[c.key] = set.base[c.key];
        }
        keep();
        sync();
      });
      link.classList.add('look-link');
      links.set(c.key, link);
      row.append(name, link);
      let input: HTMLInputElement | HTMLSelectElement;
      if (c.options) {
        const list = el('select');
        c.options.forEach((label, i) => list.append(new Option(label, String(i))));
        row.classList.add('look-choice');
        row.append(list);
        input = list;
      } else {
        const range = el('input');
        range.type = 'range';
        range.min = String(c.min);
        range.max = String(c.max);
        range.step = String(c.step);
        const out = el('output');
        outputs.set(c.key, out);
        row.append(range, out);
        input = range;
      }
      input.id = id;
      input.addEventListener('input', () => {
        const v = Number(input.value), view = opts.view();
        if (isSplit(set, c.key)) set[view][c.key] = v;
        else set.base[c.key] = v;
        keep();
        const out = outputs.get(c.key);
        if (out) out.value = format(c.key, v);
        status();
      });
      inputs.set(c.key, input);
      section.append(row);
    }
    panel.append(section);
  }
  host.append(panel);
  sync();

  return {
    toggle() { panel.hidden = !panel.hidden; opts.onToggle?.(!panel.hidden); },
    refresh: sync,
    get open() { return !panel.hidden; },
  };
}
