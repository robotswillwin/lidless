// The look panel: sliders for pixels, light, characters, colour and film, live on the renderer. L opens and closes it.
// A setting is the same in both views ("both") or split: then it has a value of its own in raw view and in Concierge
// view, and its slider edits the view on screen (E switches). It edits the game's look ("All scenes"), or the settings
// the scene on screen sets its own way over it ("This scene"). A scene shown in one of its variants (in the rain, in a
// power cut) has the variant's own settings over its own, and "This scene" edits those. Tuning is kept in this browser
// until it is saved: the game's look in public/assets/look.json, a scene's own settings, and its variants', in its scene
// file (on the dev server).

import {
  cleanSceneLook, cloneLookSet, cloneSceneLook, defaultLookSet, emptySceneLook, isSplit, LOOK_CONTROLS, LOOK_GROUPS,
  loadLocalLook, loadLocalSceneLook, lookFor, lookSetJSON, saveLocalLook, saveLocalSceneLook, sceneLookJSON, sceneSets,
  withScene, type Look, type LookSet, type SceneLook, type ViewName,
} from './engine/look';
import type { Renderer } from './engine/renderer';

export interface LookPanel {
  toggle(): void;
  /** Show the values of the view now on screen; call it when the view switches. */
  refresh(): void;
  /**
   * The scene on screen: its own settings go over the game's look, and "This scene" edits them. In one of its variants,
   * the variant's settings go over the scene's, and "This scene" edits the variant's.
   */
  setScene(scene: { id: string; name: string; look?: unknown; variants?: Record<string, { name?: string; look?: unknown }> } | null, variant?: string): void;
  readonly open: boolean;
}

export interface LookPanelOptions {
  /** The view on screen, which split settings edit. */
  view: () => ViewName;
  onToggle?: (open: boolean) => void;
  /** A scene's own settings, or a variant's, were saved into its scene file: keep the host's copy of the file the same. */
  onSceneSaved?: (id: string, look: Record<string, unknown> | undefined, variant?: string) => void;
}

const VIEW_LABEL: Record<ViewName, string> = { raw: 'raw view', concierge: 'Concierge view' };

/**
 * The scene on screen, and what "This scene" edits: its own settings, or in a variant the variant's, with the scene's own
 * under them (`under`).
 */
interface SceneState { id: string; name: string; saved: SceneLook; look: SceneLook; variant?: string; variantName?: string; under?: SceneLook }
/** Where a scene's settings, or a variant's, are kept in this browser until saved. */
const localId = (s: SceneState) => (s.variant ? `${s.id}~${s.variant}` : s.id);

export function createLookPanel(renderer: Renderer, project: LookSet, host: HTMLElement, opts: LookPanelOptions): LookPanel {
  let set = loadLocalLook(project) ?? cloneLookSet(project), saved = cloneLookSet(project);
  let scene: SceneState | null = null, scope: 'game' | 'scene' = 'game';
  /** What is on screen: the game's look with the scene's own settings over it, and a variant's over those. */
  const shown = () => (scene?.under ? withScene(withScene(set, scene.under), scene.look) : withScene(set, scene?.look ?? null));
  renderer.setLook(shown());

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = '') => {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text) e.textContent = text;
    return e;
  };
  const panel = el('aside', 'look');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Look');
  const note = el('p', 'look-note'), editing = el('p', 'look-editing'), scopes = el('div', 'look-scopes');
  const inputs = new Map<keyof Look, HTMLInputElement | HTMLSelectElement>(), outputs = new Map<keyof Look, HTMLOutputElement>();
  const links = new Map<keyof Look, HTMLButtonElement>(), rows = new Map<keyof Look, HTMLElement>(), resets = new Map<keyof Look, HTMLButtonElement>();

  const format = (key: keyof Look, v: number) => {
    const c = LOOK_CONTROLS.find((x) => x.key === key)!;
    if (key === 'colorLevels' && v === 0) return 'all';
    return c.step >= 1 ? String(v) : v.toFixed(2);
  };
  const gameChanged = () => JSON.stringify(lookSetJSON(set)) !== JSON.stringify(lookSetJSON(saved));
  const sceneChanged = () => !!scene && JSON.stringify(sceneLookJSON(scene.look)) !== JSON.stringify(sceneLookJSON(scene.saved));
  const ownCount = () => (scene ? LOOK_CONTROLS.filter((c) => sceneSets(scene!.look, c.key)).length : 0);
  const status = (text?: string) => {
    if (text !== undefined) { note.textContent = text; return; }
    const unsaved = [gameChanged() && 'the game’s look', sceneChanged() && 'this scene’s settings'].filter(Boolean);
    const own = ownCount();
    note.textContent = unsaved.length ? `Not saved (${unsaved.join(' and ')}): kept in this browser only.`
      : scope === 'game' && own ? `This scene sets ${own} of these its own way; those are marked and show its value.` : '';
  };
  const keep = () => {
    renderer.setLook(shown());
    saveLocalLook(set, saved);
    if (scene) saveLocalSceneLook(localId(scene), sceneChanged() ? scene.look : null, scene.saved);
  };

  /** Show every setting as it is in the view on screen. */
  const sync = () => {
    const view = opts.view(), all = shown(), now = lookFor(all, view), inScene = scope === 'scene' && !!scene;
    for (const c of LOOK_CONTROLS) {
      inputs.get(c.key)!.value = String(now[c.key]);
      const out = outputs.get(c.key);
      if (out) out.value = format(c.key, now[c.key]);
      const link = links.get(c.key)!, split = isSplit(inScene ? all : set, c.key);
      link.textContent = split ? 'split' : 'both';
      link.dataset.view = split ? view : '';
      link.setAttribute('aria-pressed', String(split));
      link.title = split ? `Its own value in each view; this slider edits ${VIEW_LABEL[view]}. Click to use one value for both.` : 'The same in both views. Click to give each view its own value.';
      // a setting this scene sets its own way: editable as the scene's in "This scene", and only shown in "All scenes"
      const own = !!scene && sceneSets(scene.look, c.key), row = rows.get(c.key)!;
      row.classList.toggle('look-own', own);
      row.title = own ? (inScene ? 'This scene’s own value. × goes back to the game’s.' : 'This scene sets this its own way, so changing it here does not show in this scene.') : '';
      resets.get(c.key)!.hidden = !(own && inScene);
    }
    const anySplit = LOOK_CONTROLS.some((c) => isSplit(inScene ? all : set, c.key));
    editing.textContent = anySplit ? `Split settings edit ${VIEW_LABEL[view]}. E switches view.` : '';
    editing.dataset.view = view;
    scopes.hidden = !scene;
    for (const b of scopes.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.scope === scope));
    const sceneBtn = scopes.querySelector<HTMLButtonElement>('[data-scope="scene"]');
    if (sceneBtn && scene) sceneBtn.textContent = scene.variant ? `This scene, ${scene.variantName}: ${scene.name || scene.id}` : `This scene: ${scene.name || scene.id}`;
    panel.dataset.scope = scope;
    status();
  };
  const replace = (next: LookSet, kept: boolean) => {
    set = cloneLookSet(next);
    renderer.setLook(shown());
    saveLocalLook(kept ? set : null, saved);
    sync();
  };
  const replaceScene = (next: SceneLook) => {
    if (!scene) return;
    scene.look = cloneSceneLook(next);
    keep();
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
  const inScene = () => scope === 'scene' && !!scene;
  head.append(
    el('strong', '', 'Look'),
    button('Undo', 'Back to what is saved', () => { if (inScene()) replaceScene(scene!.saved); else replace(saved, false); }),
    button('Defaults', 'All scenes: back to the original look, the same in both views. This scene: back to the game’s look', () => {
      if (inScene()) replaceScene(emptySceneLook());
      else replace(defaultLookSet(), true);
    }),
    button('Copy', 'Copy these settings as JSON', () => {
      const json = inScene() ? sceneLookJSON(scene!.look) ?? {} : lookSetJSON(set);
      void navigator.clipboard?.writeText(JSON.stringify(json, null, 2)).then(() => status('Copied.'), () => status('Could not copy.'));
    }),
  );
  // saving into the project only works on the dev server, which writes the file
  if (import.meta.env.DEV) head.append(button('Save', 'All scenes: save as the game’s look, in public/assets/look.json. This scene: save into its scene file', async () => {
    try {
      if (inScene()) {
        const s = scene!, json = sceneLookJSON(s.look);
        const res = await fetch(`/__scene-look?id=${encodeURIComponent(s.id)}${s.variant ? `&variant=${encodeURIComponent(s.variant)}` : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json ?? {}) });
        if (!res.ok) throw new Error(await res.text());
        s.saved = cloneSceneLook(s.look);
        saveLocalSceneLook(localId(s), null);
        opts.onSceneSaved?.(s.id, json, s.variant);
        sync();
        status(`Saved into the scene file of ${s.name || s.id}${s.variant ? `, as its ${s.variantName}` : ''}.`);
      } else {
        const res = await fetch('/__look', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lookSetJSON(set)) });
        if (!res.ok) throw new Error(await res.text());
        saved = cloneLookSet(set);
        saveLocalLook(null);
        sync();
        status('Saved as the game’s look.');
      }
    } catch (err) {
      status(`Could not save: ${err instanceof Error ? err.message : String(err)}`);
    }
  }));
  // what the sliders edit: the game's look, or this scene's own settings over it
  for (const [key, text, title] of [['game', 'All scenes', 'Edit the game’s look, in every scene'], ['scene', 'This scene', 'Edit only this scene: what you change here is set its own way over the game’s look']] as const) {
    const b = button(text, title, () => { scope = key; sync(); });
    b.dataset.scope = key;
    scopes.append(b);
  }
  panel.append(head, scopes, note, editing);

  for (const group of LOOK_GROUPS) {
    const section = el('section');
    section.append(el('h3', '', group));
    for (const c of LOOK_CONTROLS.filter((x) => x.group === group)) {
      const id = `look-${c.key}`, row = el('div', 'look-row'), name = el('label', '', c.label);
      name.htmlFor = id;
      rows.set(c.key, row);
      // the scene's own value goes, and the game's shows again
      const reset = button('×', 'Back to the game’s value', () => {
        if (!scene) return;
        delete scene.look.base[c.key];
        delete scene.look.raw[c.key];
        delete scene.look.concierge[c.key];
        keep();
        sync();
      });
      reset.classList.add('look-reset');
      resets.set(c.key, reset);
      const title = el('span', 'look-name');
      title.append(name, reset);
      // both views share it, or each view has its own
      const link = button('both', '', () => {
        const view = opts.view();
        if (inScene()) {
          const s = scene!.look, all = shown();
          if (isSplit(all, c.key)) {
            s.base[c.key] = lookFor(all, view)[c.key];
            delete s.raw[c.key];
            delete s.concierge[c.key];
          } else {
            s.raw[c.key] = all.base[c.key];
            s.concierge[c.key] = all.base[c.key];
            delete s.base[c.key];
          }
        } else if (isSplit(set, c.key)) {
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
      row.append(title, link);
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
        if (inScene()) {
          const s = scene!.look;
          if (isSplit(shown(), c.key)) s[view][c.key] = v;
          else s.base[c.key] = v;
        } else if (isSplit(set, c.key)) set[view][c.key] = v;
        else set.base[c.key] = v;
        keep();
        const out = outputs.get(c.key);
        if (out) out.value = format(c.key, v);
        // a setting changed in "This scene" becomes its own: mark it
        if (inScene()) sync();
        else status();
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
    setScene(next, variant) {
      if (!next) { scene = null; scope = 'game'; }
      else {
        const v = variant ? next.variants?.[variant] : undefined;
        const own = cleanSceneLook(next.look), savedLook = v ? cleanSceneLook(v.look) : own;
        scene = { id: next.id, name: next.name, saved: savedLook, look: cloneSceneLook(savedLook), ...(v ? { variant, variantName: v.name || variant, under: loadLocalSceneLook(next.id, own) ?? own } : {}) };
        scene.look = loadLocalSceneLook(localId(scene), savedLook) ?? scene.look;
      }
      renderer.setLook(shown());
      sync();
    },
    get open() { return !panel.hidden; },
  };
}
