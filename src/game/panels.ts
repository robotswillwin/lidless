// The panels over the frame: her journal (with the map), her notebook, and the menu with her saves, the settings and how
// to play; and their buttons at the top right, a dot on the journal's and the notebook's while there is something in them
// she has not read. Her notebook opens only where the Concierge cannot see her, and only if she has it with her.

import { button, el } from './dom';
import type { Hud } from './hud';
import { icon } from './icons';
import { drawJournal, PLACES } from './journal';
import { drawMap } from './map';
import { drawNotebook, notebookNow, type Notebook } from './notebook';
import { drawSettings } from './settings';

export type PanelKind = 'journal' | 'notebook' | 'menu';

export class Panels {
  private readonly journalBtn: HTMLButtonElement;
  private readonly notebookBtn: HTMLButtonElement;
  private panel: HTMLElement | null = null;
  private kind: PanelKind | null = null;
  /** What is in her notebook and her journal: the story's to say what shows. */
  notebook: Notebook = { pages: [] };
  journal: Notebook = { pages: [] };
  private notebookTab: string | null = null;
  private journalTab: string | null = null;
  /** The menu's tab: her saves, the settings, how to play. */
  private menuTab: 'saves' | 'settings' | 'help' = 'saves';

  /** Their buttons, after the view switch at the top right: the map, her journal, her notebook, the menu. */
  constructor(private readonly hud: Hud, top: HTMLElement) {
    button('hud-btn map', 'Map (M)', top, () => this.openJournal(PLACES)).innerHTML = icon('map', 22);
    this.journalBtn = button('hud-btn journal', 'Her journal (J)', top, () => this.openJournal());
    this.journalBtn.innerHTML = icon('journal', 22);
    this.notebookBtn = button('hud-btn notebook', 'Her notebook (N)', top, () => this.toggle('notebook'));
    button('hud-btn menu', 'Menu: saves, settings, help', top, () => this.toggle('menu')).innerHTML = icon('menu', 22);
  }

  /** A panel is open over the frame. */
  get open(): boolean { return this.panel !== null; }

  setNotebook(nb: Notebook): void {
    this.notebook = nb;
    this.drawFresh();
  }

  setJournal(j: Notebook): void {
    this.journal = j;
    this.drawFresh();
  }

  /** A dot on the journal's and the notebook's buttons while there is something in them she has not read. */
  drawFresh(): void {
    const hud = this.hud, read = hud.read();
    this.journalBtn.classList.toggle('fresh', notebookNow(this.journal, hud.known, read, 'journal:').some((p) => p.fresh));
    this.notebookBtn.classList.toggle('fresh', notebookNow(this.notebook, hud.known, read).some((p) => p.fresh));
  }

  /** Her notebook taken or put down, or the Concierge's sight of her changed: its button shows, opens or shuts, or goes. */
  notebookChanged(): void {
    this.drawNotebookButton();
    if (this.kind === 'notebook' && (!this.hud.hasNotebook() || !this.hud.unseen)) this.close();
  }

  /** The view switched: an open panel says it in the view's words (her notebook is hers in both). */
  viewChanged(): void {
    if (this.kind && this.kind !== 'notebook') this.openPanel(this.kind);
  }

  /** Her notebook's button: open where it cannot see her, its strap closed where it can; no notebook, no button. */
  drawNotebookButton(): void {
    const unseen = this.hud.unseen;
    this.notebookBtn.hidden = !this.hud.hasNotebook();
    this.notebookBtn.innerHTML = icon(unseen ? 'notebook' : 'locked', 22);
    this.notebookBtn.classList.toggle('shut', !unseen);
    this.notebookBtn.setAttribute('aria-label', unseen ? 'Her notebook (N)' : 'Her notebook: not where it can see (N)');
  }

  toggle(kind: PanelKind): void {
    if (this.kind === kind) this.close();
    else this.openPanel(kind);
  }

  private openPanel(kind: PanelKind): void {
    const hud = this.hud;
    // her notebook stays shut where it can see her
    if (kind === 'notebook' && !hud.hasNotebook()) return;
    if (kind === 'notebook' && !hud.unseen) return hud.onShut();
    this.panel?.remove();
    hud.concierge.close();
    hud.balls.closeVerbs();
    hud.balls.closeTray();
    this.kind = kind;
    hud.root.dataset.panel = kind;
    const p = (this.panel = el('section', `hud-panel ${kind}`, hud.root));
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    hud.onPanel();
    if (kind === 'notebook') this.drawNotebookPanel(p);
    else if (kind === 'journal') this.drawJournalPanel(p);
    else this.drawMenu(p);
  }

  /** What is over the scene closes: a panel, the tray, the Concierge's card. */
  close(): void {
    this.hud.concierge.close();
    this.closeSheet();
  }

  /** A panel and the tray close. */
  closeSheet(): void {
    this.panel?.remove();
    this.panel = null;
    this.kind = null;
    delete this.hud.root.dataset.panel;
    this.hud.balls.closeTray();
    this.drawFresh();
  }

  /**
   * Her journal, open at a tab (the map's is `places`), or closed if it is open there already. Its own button opens it at
   * the page last read, never the map.
   */
  openJournal(tab?: string): void {
    if (this.kind === 'journal' && (tab === undefined ? this.journalTab !== PLACES : this.journalTab === tab)) return this.close();
    this.journalTab = tab ?? (this.journalTab === PLACES ? null : this.journalTab);
    this.openPanel('journal');
  }

  private drawNotebookPanel(p: HTMLElement): void {
    const hud = this.hud, pages = notebookNow(this.notebook, hud.known, hud.read());
    drawNotebook(p, this.notebook, pages, this.notebookTab, {
      tab: (id) => { this.notebookTab = id; this.openPanel('notebook'); },
      read: (keys) => hud.onRead(keys),
      close: () => this.close(),
    });
  }

  private drawJournalPanel(p: HTMLElement): void {
    const hud = this.hud;
    drawJournal(p, notebookNow(this.journal, hud.known, hud.read(), 'journal:'), this.journalTab, {
      tab: (id) => { this.journalTab = id; this.openPanel('journal'); },
      read: (keys) => hud.onRead(keys),
      close: () => this.close(),
      map: (body) => void hud.mapNow().then((now) => {
        if (this.panel !== p) return;
        drawMap(body, now, (t) => { this.close(); hud.onTravel(t); });
      }),
    });
  }

  /**
   * The menu: her saves (where she is now, saved as she goes, and three slots she saves into and goes back to), the
   * settings, how to play, and the title screen.
   */
  private drawMenu(p: HTMLElement): void {
    const hud = this.hud;
    p.setAttribute('aria-label', 'Menu');
    const head = el('div', 'head', p), tabs = el('nav', 'tabs', head);
    tabs.setAttribute('aria-label', 'Menu');
    const settings = hud.settings();
    for (const [id, title] of [['saves', 'Saves'], ['settings', 'Settings'], ['help', 'How to play']] as const) {
      if (id === 'settings' && !settings) continue;
      const t = button(`tab${this.menuTab === id ? ' on' : ''}`, title, tabs, () => { this.menuTab = id; this.openPanel('menu'); });
      t.textContent = title;
      t.setAttribute('aria-current', String(this.menuTab === id));
    }
    button('to-title', 'To the title screen', head, () => { this.close(); hud.onTitle(); }).textContent = 'Title screen';
    button('hud-close', 'Close', head, () => this.close()).innerHTML = icon('close', 18);
    const body = el('div', 'body', p);
    if (this.menuTab === 'settings' && settings) return drawSettings(body, settings, (s) => hud.onSettings(s));
    if (this.menuTab === 'help') return drawHelp(body);
    const list = el('div', 'saves', body), all = hud.saves();
    const when = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    for (const slot of ['auto', 1, 2, 3] as const) {
      const s = all.find((x) => x.slot === slot), card = el('div', 'save', list);
      el('div', 'name', card, slot === 'auto' ? 'Now' : `Slot ${slot}`);
      el('div', 'when', card, s ? [s.where, when(s.savedAt)].filter(Boolean).join(' · ') || 'Saved' : 'Empty');
      const row = el('div', 'row', card);
      if (slot !== 'auto') button('', `Save in slot ${slot}`, row, () => { hud.onSave(slot); this.openPanel('menu'); }).textContent = 'Save here';
      if (s && slot !== 'auto') button('primary', `Go back to slot ${slot}`, row, () => hud.onLoad(slot)).textContent = 'Load';
    }
  }
}

/** How to play: the controls, by touch and by keyboard. */
export function drawHelp(p: HTMLElement): void {
  const box = el('div', 'help', p);
  const rows: [string, string][] = [
    ['Walk', 'Tap where she should go. The end of a street always has a marker to the next place; a door gets one once she has looked at it or tried it. Tap a marker, or the door, and she goes through. Outdoors, hold a finger far ahead of her to run.'],
    ['Do', 'Tap a thing and she looks at it. To do more, the ball at the bottom right: choose Talk, Use or Take, then tap what to do it to (or slide over the scene and let go on what lights up). Anything can be tried; not everything answers.'],
    ['Concierge', 'Its light at the top left, in its view. Tap it: it says what it would have you do here, what you have to do, and how you are. Talk to it there, or Ask about something, then tap a thing. Talk at the ball is Luna speaking to someone herself.'],
    ['Her things', 'The ball at the bottom left. Tap a thing to see it close up; Use takes it out, then tap what to use it on.'],
    ['Top right', 'The view switch once she has it, the map, her journal (anywhere) and her notebook (only where it cannot see her), and this menu.'],
    ['Keys', 'Arrows or A and D walk, with Shift she runs. E switches view, I her things, M the map, J her journal, N her notebook, Esc closes. Numbers pick an answer.'],
  ];
  for (const [name, text] of rows) { const r = el('div', 'row-help', box); el('div', 'name', r, name); el('div', 'text', r, text); }
}
