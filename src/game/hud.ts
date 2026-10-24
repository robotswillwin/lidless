// The HUD over the frame, the same in both views: it is hers and the player's, not the Concierge's, so it does not
// change when the view does. What changes with the view is what things are (their names, whether they exist at all)
// and the Concierge itself, which only its view has: its presence at the top left, made of light (concierge.ts).
// Her journal is on her device: she reads it anywhere, and the Concierge can read it too. Her notebook is the one thing
// on paper: what she keeps from the Concierge, opened only in a privacy zone, where it cannot see her.
//
// Made for thumbs, nothing that needs a mouse to hover. Her things on the left ball: a tray of them slides out along the
// bottom. What she can do on the right ball (look, talk, use, take, ask), sliding out the other way (balls.ts). At the
// top right the view switch with her sense of being watched, then the map, her journal, her notebook and the menu with
// her saves (panels.ts). With a verb chosen, what her finger is over lights up if the verb does something to it, and
// letting go does it (marks.ts); what she finds is written at the thing (notes.ts). A moment, or a paper, shown up close
// (closeup.ts). This is their hub: what the game asks of the HUD, and what it is told.

import { Balls } from './balls';
import { Closeups, type CloseupDef } from './closeup';
import { Concierge, type Readouts } from './concierge';
import type { Verb } from './actions';
import { button, el } from './dom';
import { icon } from './icons';
import type { Hotspot } from './level';
import type { MapNow, Travel } from './map';
import { Marks, type Mark, type Way } from './marks';
import type { Inbox } from './messages';
import { notebookNow, type Notebook } from './notebook';
import { Notes } from './notes';
import { Panels, type PanelKind } from './panels';
import { PLACES } from './journal';
import type { Settings } from './settings';
import type { Item } from './tray';

export type { Item } from './tray';
export type { Notebook } from './notebook';
export type { CloseupDef } from './closeup';
export type { Mark, Way } from './marks';
export { drawHelp } from './panels';

export class Hud {
  readonly root: HTMLElement;
  /** A verb chosen at the right ball, or put down (null). */
  onVerb: (v: Verb | null) => void = () => {};
  /** The view switch. */
  onView: () => void = () => {};
  /** A panel opened over the frame. */
  onPanel: () => void = () => {};
  /** A way's marker tapped: she goes there, and through. */
  onWay: (id: string) => void = () => {};
  /** Whether a condition on the story holds, for what her notebook holds. */
  known: (cond: string) => boolean = () => false;
  /** She takes a thing out of her pockets to use it on something (null: puts it back). */
  onHold: (id: string | null) => void = () => {};
  /** Her saves: what there is (the autosave first), saving into a slot, and going back to one. */
  saves: () => { slot: 'auto' | 1 | 2 | 3; savedAt?: number; where?: string }[] = () => [];
  onSave: (slot: 1 | 2 | 3) => void = () => {};
  onLoad: (slot: 'auto' | 1 | 2 | 3) => void = () => {};
  /** The map as she knows it now, and going somewhere on it. */
  mapNow: () => Promise<MapNow> = async () => ({ places: [], spots: [], links: [], you: null, bounds: [0, 0, 100, 60] });
  onTravel: (t: Travel) => void = () => {};
  /** Her notebook, reached for where it can see her: she keeps it shut. */
  onShut: () => void = () => {};
  /** Whether she has her paper notebook with her (it is a thing she carries): without it, there is nothing to open. */
  hasNotebook: () => boolean = () => true;
  /** What she has read in her journal and her notebook, and reading more of them. */
  read: () => ReadonlySet<string> = () => new Set();
  onRead: (keys: string[]) => void = () => {};
  /** Where the assets are, for her things' pictures and the close-ups. */
  assets = 'assets';
  /** The close-ups' own settings (closeups.json): a paper's words, and how they are set over it. */
  closeups: Record<string, CloseupDef> = {};
  /** In a close-up: back to where she stood. */
  onBack: () => void = () => {};
  /** The player's settings, and changing them (from the menu's settings); back to the title screen. */
  settings: () => Settings | null = () => null;
  onSettings: (s: Settings) => void = () => {};
  onTitle: () => void = () => {};
  /** How long notes stay, times the normal (the text speed setting). */
  noteSpeed = 1;

  private isRaw = false;
  private unlocked = false;
  /** Out of the Concierge's sight: her notebook opens. */
  private isUnseen = false;
  /** The Concierge, in its view: its presence at the top left, its card, its messages, talking to it. */
  readonly concierge: Concierge;
  readonly balls: Balls;
  readonly panels: Panels;
  private readonly closeup: Closeups;
  private readonly marks: Marks;
  private readonly notes: Notes;
  private readonly viewBtn: HTMLButtonElement;
  private readonly backBtn: HTMLButtonElement;

  constructor(canvas: HTMLCanvasElement) {
    const root = (this.root = el('div', 'hud'));
    root.dataset.view = 'concierge';
    canvas.after(root);

    // the Concierge, in its view, at the top left: tapped, its card opens over the scene
    this.concierge = new Concierge(root);

    // at the top right: the view and her sense of being watched, then the map, her journal, her notebook, the menu
    const top = el('div', 'hud-top', root);
    this.viewBtn = button('hud-btn view', 'See it as it is (E)', top, () => this.onView());
    this.viewBtn.innerHTML = `${icon('view', 22)}<span class="ticks" aria-hidden="true"><span></span><span></span><span></span></span>`;
    this.panels = new Panels(this, top);

    // in a close-up, back to where she stood: at the bottom, between the balls
    this.backBtn = button('hud-back', 'Step back (Esc)', root, () => this.onBack());
    this.backBtn.innerHTML = `${icon('back', 18)}<span>Step back</span>`;
    this.backBtn.hidden = true;

    // the two balls: her things on the left, what she can do on the right
    this.balls = new Balls(this);
    this.closeup = new Closeups(this);
    this.marks = new Marks(this);
    this.notes = new Notes(this);
    this.setAttention(0);
    this.panels.drawNotebookButton();
  }

  /** Raw view is on screen. */
  get raw(): boolean { return this.isRaw; }
  /** Out of the Concierge's sight. */
  get unseen(): boolean { return this.isUnseen; }

  /** Which view is on screen, and whether she can switch yet: the switch and her sense of being watched come with the biohack. */
  setView(raw: boolean, unlocked: boolean): void {
    const changed = raw !== this.isRaw || unlocked !== this.unlocked;
    this.isRaw = raw;
    this.unlocked = unlocked;
    this.root.dataset.view = raw ? 'raw' : 'concierge';
    this.viewBtn.hidden = !unlocked;
    this.viewBtn.setAttribute('aria-pressed', String(raw));
    this.viewBtn.setAttribute('aria-label', raw ? 'Back to its view (E)' : 'See it as it is (E)');
    if (!changed) return;
    this.marks.mark(null);
    if (raw) { this.dismissToast(); this.concierge.close(); }
    this.balls.viewChanged();
    this.panels.viewChanged();
    this.closeup.viewChanged();
  }

  /** Whether the Concierge can see her where she is: out of its sight, her notebook opens; in it, it shuts. */
  setUnseen(unseen: boolean): void {
    if (unseen === this.isUnseen) return;
    this.isUnseen = unseen;
    this.balls.unseenChanged();
    this.panels.notebookChanged();
  }

  /** In a close-up (a desk, a workbench, seen close), or not: its Back. */
  setBack(on: boolean): void {
    this.backBtn.hidden = !on;
    this.root.toggleAttribute('data-closeup', on);
  }

  /**
   * While she talks the conversation has the bottom of the frame: the balls step aside, and what is open closes, but
   * the Concierge's card, where she may be talking to it.
   */
  setTalking(on: boolean): void {
    if (!on) { delete this.root.dataset.talking; return; }
    this.balls.closeVerbs();
    this.panels.closeSheet();
    this.marks.mark(null);
    this.notes.dismiss();
    this.root.dataset.talking = '';
  }

  /** The Concierge's greeting and its line of the day, time and weather. */
  setStatus(greeting: string, status: string): void {
    this.concierge.setStatus(greeting, status);
  }

  /** What the Concierge keeps of her: her credits (digital, on her account), her heart, her nourishment. */
  setReadouts(r: Readouts): void {
    this.concierge.setReadouts(r);
  }

  /**
   * The Concierge's card, opened from its presence: its words for where she is, her messages, what she has to do (her
   * journal's objectives, not yet done: it reads her journal), its readouts; `unheard`, it cannot hear her where she is,
   * and from a home (`call`) she can call it.
   */
  openConcierge(words: string, unheard: boolean, inbox: Inbox[] = [], call = false): void {
    this.closeAll();
    this.onPanel();
    const objectives = notebookNow(this.panels.journal, this.known, this.read(), 'journal:').find((p) => p.id === 'objectives');
    const reminders = (objectives?.entries ?? []).filter((e) => !e.done).map((e) => ({ name: e.name, text: e.lines[0]?.text ?? '' }));
    this.concierge.open({ words, reminders, unheard, inbox, call });
  }

  /** How closely the Concierge is watching her, 0 to 3: the ticks under the view switch. */
  setAttention(level: number): void {
    const n = Math.max(0, Math.min(3, Math.round(level)));
    this.viewBtn.dataset.level = String(n);
    this.viewBtn.querySelectorAll('.ticks span').forEach((s, i) => s.classList.toggle('on', i < n));
    this.viewBtn.title = `Its attention: ${['calm', 'noticing', 'watching', 'watching closely'][n]}`;
  }

  /** A message from the Concierge, under its presence. Only in its view: raw view has no Concierge to show it. */
  toast(text: string, actions: { label: string; primary?: boolean; run?: () => void }[] = [], ms = 7000): void {
    if (!this.isRaw) this.concierge.say(text, actions, ms);
  }

  dismissToast(): void {
    this.concierge.dismiss();
  }

  /** Something over the scene that a tap on the scene closes first: a panel, the tray, a thing close up, its card. */
  get panelOpen(): boolean { return this.panels.open || this.balls.trayOpen || this.concierge.isOpen; }
  get menuOpen(): boolean { return this.balls.verbsOpen; }

  /** Close what the HUD has open: the verbs, her things, a panel, what a verb has lit, what she found. */
  closeAll(): void {
    this.balls.closeVerbs();
    this.balls.closeTray();
    this.panels.close();
    this.marks.mark(null);
    this.notes.dismiss();
  }

  /** N her notebook, J her journal, M the map, I her things, Escape closes what is open or puts the verb down. Returns true if it used the key. */
  key(k: string): boolean {
    if (this.concierge.key(k)) return true;
    if (k === 'Escape' && (this.balls.verbsOpen || this.panelOpen)) { this.closeAll(); return true; }
    if (k === 'Escape' && this.balls.holding) { this.onHold(null); return true; }
    if (k === 'Escape' && this.balls.chosen) { this.onVerb(null); return true; }
    if ((k === 'Escape' || k === 'Backspace') && !this.backBtn.hidden) { this.onBack(); return true; }
    if (k === 'n' || k === 'N') { this.panels.toggle('notebook'); return true; }
    if (k === 'i' || k === 'I') { this.balls.toggleTray(); return true; }
    if (k === 'm' || k === 'M') { this.panels.openJournal(PLACES); return true; }
    if (k === 'j' || k === 'J') { this.panels.openJournal(); return true; }
    return false;
  }

  /* ---------- what the game tells the parts ---------- */

  setThings(items: Record<string, Item>, carried: string[]): void {
    this.balls.setThings(items, carried);
    // the story moved on: something new written down?
    this.panels.drawFresh();
  }
  setNotebook(nb: Notebook): void { this.panels.setNotebook(nb); }
  setJournal(j: Notebook): void { this.panels.setJournal(j); }
  /** Her notebook taken or put down: its button shows or goes. */
  notebookChanged(): void { this.panels.notebookChanged(); }
  setHeld(id: string | null): void { this.balls.setHeld(id); }
  setVerb(v: Verb | null): void { this.balls.setVerb(v); }
  /** Kept for the game: closes the verbs. */
  closeMenu(): void { this.balls.closeVerbs(); }
  togglePanel(kind: PanelKind): void { this.panels.toggle(kind); }
  closePanel(): void { this.panels.close(); }
  get closeupOpen(): boolean { return this.closeup.open; }
  showCloseup(name: string | null): Promise<void> { return this.closeup.show(name); }
  readCloseup(name: string): Promise<void> { return this.closeup.read(name); }
  ways(list: Way[]): void { this.marks.ways(list); }
  mark(m: Mark | null): void { this.marks.mark(m); }
  note(h: Hotspot, text: string, box: [number, number, number, number]): void { this.notes.note(h, text, box); }
  get noteFor(): Hotspot | null { return this.notes.noteFor; }
  placeNote(box: [number, number, number, number]): void { this.notes.place(box); }
  dismissNote(): void { this.notes.dismiss(); }
}
