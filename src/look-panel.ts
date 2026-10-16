// The look panel: sliders for pixels, light, colour and film, live on the renderer. L opens and closes it.
// Tuning is kept in this browser until it is saved as the game's look (public/assets/look.json, on the dev server).

import { LOOK_CONTROLS, LOOK_DEFAULTS, loadLocalLook, saveLocalLook, type Look } from './engine/look';
import type { Renderer } from './engine/renderer';

export interface LookPanel {
  toggle(): void;
  readonly open: boolean;
}

const GROUPS = ['Pixels', 'Light', 'Colour', 'Film'] as const;

export function createLookPanel(renderer: Renderer, project: Look, host: HTMLElement, onToggle?: (open: boolean) => void): LookPanel {
  renderer.look = { ...project, ...(loadLocalLook() ?? {}) };
  let saved = { ...project };

  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}) => Object.assign(document.createElement(tag), props);
  const panel = make('aside', { className: 'look', hidden: true });
  panel.setAttribute('aria-label', 'Look');
  const note = make('p', { className: 'look-note' });
  const inputs = new Map<keyof Look, HTMLInputElement | HTMLSelectElement>(), outputs = new Map<keyof Look, HTMLOutputElement>();

  const format = (key: keyof Look, v: number) => {
    const c = LOOK_CONTROLS.find((x) => x.key === key)!;
    if (key === 'colorLevels' && v === 0) return 'all';
    return c.step >= 1 ? String(v) : v.toFixed(2);
  };
  const changed = () => LOOK_CONTROLS.some((c) => renderer.look[c.key] !== saved[c.key]);
  const status = (text?: string) => { note.textContent = text ?? (changed() ? 'Not saved: kept in this browser only.' : ''); };
  const sync = () => {
    for (const c of LOOK_CONTROLS) {
      const v = renderer.look[c.key];
      inputs.get(c.key)!.value = String(v);
      const out = outputs.get(c.key);
      if (out) out.value = format(c.key, v);
    }
    status();
  };
  const set = (look: Look, keep: boolean) => { renderer.look = { ...look }; saveLocalLook(keep ? renderer.look : null); sync(); };

  const button = (text: string, title: string, run: () => void) => {
    const b = make('button', { type: 'button', textContent: text, title });
    b.addEventListener('click', run);
    return b;
  };
  const head = make('div', { className: 'look-head' });
  head.append(
    make('strong', { textContent: 'Look' }),
    button('Undo', 'Back to the saved look', () => set(saved, false)),
    button('Defaults', 'Back to the original look', () => set(LOOK_DEFAULTS, true)),
    button('Copy', 'Copy these settings as JSON', () => { void navigator.clipboard?.writeText(JSON.stringify(renderer.look, null, 2)).then(() => status('Copied.'), () => status('Could not copy.')); }),
  );
  // saving into the project only works on the dev server, which writes the file
  if (import.meta.env.DEV) head.append(button('Save', 'Save as the game’s look, in public/assets/look.json', async () => {
    try {
      const res = await fetch('/__look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(renderer.look) });
      if (!res.ok) throw new Error(await res.text());
      saved = { ...renderer.look };
      saveLocalLook(null);
      status('Saved as the game’s look.');
    } catch (err) {
      status(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }));
  panel.append(head, note);

  for (const group of GROUPS) {
    const section = make('section');
    section.append(make('h3', { textContent: group }));
    for (const c of LOOK_CONTROLS.filter((x) => x.group === group)) {
      const row = make('label', { className: 'look-row' });
      row.append(make('span', { textContent: c.label }));
      let input: HTMLInputElement | HTMLSelectElement;
      if (c.options) {
        const list = document.createElement('select');
        c.options.forEach((name, i) => list.append(new Option(name, String(i))));
        row.classList.add('look-choice');
        row.append(list);
        input = list;
      } else {
        const range = document.createElement('input');
        range.type = 'range';
        range.min = String(c.min);
        range.max = String(c.max);
        range.step = String(c.step);
        const out = document.createElement('output');
        outputs.set(c.key, out);
        row.append(range, out);
        input = range;
      }
      input.addEventListener('input', () => {
        renderer.look[c.key] = Number(input.value);
        saveLocalLook(renderer.look);
        const out = outputs.get(c.key);
        if (out) out.value = format(c.key, renderer.look[c.key]);
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
    toggle() { panel.hidden = !panel.hidden; onToggle?.(!panel.hidden); },
    get open() { return !panel.hidden; },
  };
}
