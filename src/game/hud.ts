// The HUD over the frame, the same in both views: it is hers and the player's, not the Concierge's, so it does not
// change when the view does. What changes with the view is what things are (their names, whether they exist at all)
// and the Concierge's own voice, which only its view has: its greeting at the top left, its messages, its offers.
// Her journal is on her device: she reads it anywhere, and the Concierge can read it too. Her notebook is the one thing
// on paper: what she keeps from the Concierge, opened only in a privacy zone, where it cannot see her.
//
// Made for thumbs, nothing that needs a mouse to hover. Her things on the left ball: a tray of them slides out along the
// bottom. What she can do on the right ball (look, talk, use, take, ask), sliding out the other way. At the top right
// the view switch with her sense of being watched, the map, her journal, her notebook and the menu with her saves. With a verb
// chosen, what her finger is over lights up if the verb does something to it, and letting go does it; what she finds is
// written at the thing.

import { HERS, verbName, verbQuestion, type Verb } from './actions';
import { button, el } from './dom';
import { icon } from './icons';
import { note, pick, type Hotspot } from './level';
import { drawJournal, PLACES } from './journal';
import { drawMap, type MapNow, type Travel } from './map';
import { drawNotebook, notebookNow, type Notebook } from './notebook';
import { drawSettings, type Settings } from './settings';
import { drawInspect, drawTray, picturesOf, thingsNow, type Item } from './tray';

export type { Item } from './tray';
export type { Notebook } from './notebook';

/** `item`: using a thing she holds on it. */
export type ActionKind = 'feet' | 'hands' | 'take' | 'eyes' | 'heart' | 'ask' | 'item';

export interface Action {
  kind: ActionKind;
  /** What the action is called here, in the view's own words. */
  label: string;
  /** Steps of the Concierge's attention it costs. */
  cost?: number;
  /** The thing has something of its own for it (a text, a stitch of its knot), not only a standard reply. */
  own?: boolean;
}

/** What a chosen verb lights up under her finger: the thing, what the verb does to it, and where it is on screen. */
export interface Mark {
  h: Hotspot;
  a: Action;
  /** x, y, width, height in the HUD's pixels. */
  box: [number, number, number, number];
}

type PanelKind = 'journal' | 'notebook' | 'menu';

export class Hud {
  readonly root: HTMLElement;
  /** A verb chosen at the right ball, or put down (null). */
  onVerb: (v: Verb | null) => void = () => {};
  /** The view switch. */
  onView: () => void = () => {};
  /** Its greeting tapped: she rings for its assistance, or (asking it about something) puts the question down. */
  onBell: () => void = () => {};
  /** A panel opened over the frame. */
  onPanel: () => void = () => {};
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
  /** What she has read in her journal and her notebook, and reading more of them. */
  read: () => ReadonlySet<string> = () => new Set();
  onRead: (keys: string[]) => void = () => {};
  /** Where the assets are, for her things' pictures. */
  assets = 'assets';
  /** The player's settings, and changing them (from the menu's settings); back to the title screen. */
  settings: () => Settings | null = () => null;
  onSettings: (s: Settings) => void = () => {};
  onTitle: () => void = () => {};
  /** How long notes stay, times the normal (the text speed setting). */
  noteSpeed = 1;

  private raw = false;
  private unlocked = false;
  /** Out of the Concierge's sight: her notebook opens. */
  private unseen = false;
  private co: HTMLButtonElement;
  private greet: HTMLElement;
  private status: HTMLElement;
  private credits: HTMLElement;
  private toastEl: HTMLElement | null = null;
  private toastTimer = 0;
  private viewBtn: HTMLButtonElement;
  private journalBtn: HTMLButtonElement;
  private notebookBtn: HTMLButtonElement;
  private thingsBall: HTMLButtonElement;
  private verbBall: HTMLButtonElement;
  private verbLabel: HTMLElement;
  private verb: Verb | null = null;
  /** A thing she holds to use on something, and what it is called. */
  private held: { id: string; name: string } | null = null;
  private menu: HTMLElement | null = null;
  private trayEl: HTMLElement | null = null;
  private inspectEl: HTMLElement | null = null;
  private inspecting: string | null = null;
  private markEl: HTMLElement | null = null;
  private markOf: Hotspot | null = null;
  private noteEl: HTMLElement | null = null;
  private noteOf: Hotspot | null = null;
  private noteTimer = 0;
  private panel: HTMLElement | null = null;
  private panelKind: PanelKind | null = null;
  /** A close-up over the scene, and which: its picture follows the view. */
  private closeupEl: HTMLElement | null = null;
  private closeupName: string | null = null;
  private items: Record<string, Item> = {};
  private carried: string[] = [];
  private notebook: Notebook = { pages: [] };
  private notebookTab: string | null = null;
  private journal: Notebook = { pages: [] };
  private journalTab: string | null = null;
  /** The menu's tab: her saves, the settings, how to play. */
  private menuTab: 'saves' | 'settings' | 'help' = 'saves';
  /** Her things' pictures, fetched once. */
  private readonly fetched = new Set<string>();
  /** Its greeting and its line of the day, as the game last gave them. */
  private said: [string, string] = ['', ''];

  constructor(canvas: HTMLCanvasElement) {
    const root = (this.root = el('div', 'hud'));
    root.dataset.view = 'concierge';
    canvas.after(root);

    // the Concierge's greeting and its line of the day, in its view; tapped, she rings for it: it says what it would
    // have her do here, and offers to be asked about something. Until she first rings, its bell now and then rings
    this.co = button('hud-co beckon', 'The Concierge: ring for assistance', root, () => { this.co.classList.remove('beckon'); this.onBell(); });
    this.co.insertAdjacentHTML('beforeend', icon('ask', 22));
    const words = el('span', 'words', this.co);
    this.greet = el('span', 'greet', words);
    this.status = el('span', 'status', words);
    this.credits = el('span', 'credits', this.co);
    this.credits.hidden = true;

    // at the top right: the view and her sense of being watched, the map, her journal, her notebook, the menu
    const top = el('div', 'hud-top', root);
    this.viewBtn = button('hud-btn view', 'See it as it is (E)', top, () => this.onView());
    this.viewBtn.innerHTML = `${icon('view', 22)}<span class="ticks" aria-hidden="true"><span></span><span></span><span></span></span>`;
    button('hud-btn map', 'Map (M)', top, () => this.openJournal(PLACES)).innerHTML = icon('map', 22);
    this.journalBtn = button('hud-btn journal', 'Her journal (J)', top, () => this.openJournal());
    this.journalBtn.innerHTML = icon('journal', 22);
    this.notebookBtn = button('hud-btn notebook', 'Her notebook (N)', top, () => this.togglePanel('notebook'));
    button('hud-btn menu', 'Menu: saves, settings, help', top, () => this.togglePanel('menu')).innerHTML = icon('menu', 22);

    // the two balls: her things on the left, what she can do on the right, the verb chosen named beside it
    this.thingsBall = button('hud-ball things', 'Her things (I)', root, () => this.toggleTray());
    // holding a thing, the ball puts it back; else it slides out the verbs
    this.verbBall = button('hud-ball verbs', 'What she can do', root, () => (this.held ? this.onHold(null) : this.toggleVerbs()));
    this.verbLabel = el('div', 'hud-ball-label', root);
    this.verbLabel.hidden = true;
    this.setAttention(0);
    this.drawNotebookButton();
    this.drawBalls();
  }

  setThings(items: Record<string, Item>, carried: string[]): void {
    this.items = items;
    this.carried = carried;
    // their pictures fetched now, so the tray opens with them there
    for (const art of carried.flatMap((id) => picturesOf(items[id]))) if (!this.fetched.has(art)) { this.fetched.add(art); new Image().src = `${this.assets}/${art}`; }
    this.drawBalls();
    if (this.trayEl) this.openTray();
    if (this.inspecting && !carried.includes(this.inspecting)) this.closeInspect();
    // the story moved on: something new written down?
    this.drawFresh();
  }

  setNotebook(nb: Notebook): void {
    this.notebook = nb;
    this.drawFresh();
  }

  setJournal(j: Notebook): void {
    this.journal = j;
    this.drawFresh();
  }

  /** A dot on the journal's and the notebook's buttons while there is something in them she has not read. */
  private drawFresh(): void {
    const read = this.read();
    this.journalBtn.classList.toggle('fresh', notebookNow(this.journal, this.known, read, 'journal:').some((p) => p.fresh));
    this.notebookBtn.classList.toggle('fresh', notebookNow(this.notebook, this.known, read).some((p) => p.fresh));
  }

  /** Which view is on screen, and whether she can switch yet: the switch and her sense of being watched come with the biohack. */
  setView(raw: boolean, unlocked: boolean): void {
    const changed = raw !== this.raw || unlocked !== this.unlocked;
    this.raw = raw;
    this.unlocked = unlocked;
    this.root.dataset.view = raw ? 'raw' : 'concierge';
    this.viewBtn.hidden = !unlocked;
    this.viewBtn.setAttribute('aria-pressed', String(raw));
    this.viewBtn.setAttribute('aria-label', raw ? 'Back to its view (E)' : 'See it as it is (E)');
    if (!changed) return;
    this.closeVerbs();
    this.mark(null);
    if (raw) this.dismissToast();
    this.drawBalls();
    if (this.held) this.setHeld(this.held.id);
    if (this.trayEl) this.openTray();
    if (this.inspecting) this.inspect(this.inspecting);
    if (this.panelKind && this.panelKind !== 'notebook') this.openPanel(this.panelKind);
    if (this.closeupName) this.showCloseup(this.closeupName);
  }

  /** Whether a close-up is over the scene: lines are said at the top then, clear of it. */
  get closeupOpen(): boolean { return this.closeupName !== null; }

  /**
   * A close-up over the dimmed scene: a moment shown up close (her wrist in the station's cuff), as the view on screen
   * has it (`closeups/<name>.concierge.webp`, `.raw.webp`); null takes it away. Resolves once its picture is there.
   */
  showCloseup(name: string | null): Promise<void> {
    const was = this.closeupEl;
    this.closeupName = name;
    if (!name) {
      if (was) { was.classList.add('out'); window.setTimeout(() => was.remove(), 260); }
      this.closeupEl = null;
      return Promise.resolve();
    }
    const box = el('div', 'hud-closeup', this.root), img = el('img', '', box);
    img.alt = '';
    img.src = `${this.assets}/closeups/${name}.${this.raw ? 'raw' : 'concierge'}.webp`;
    if (was) { box.classList.add('still'); was.remove(); }
    this.closeupEl = box;
    return img.decode().catch(() => {});
  }

  /** Whether the Concierge can see her where she is: out of its sight, her notebook opens; in it, it shuts. */
  setUnseen(unseen: boolean): void {
    if (unseen === this.unseen) return;
    this.unseen = unseen;
    this.drawNotebookButton();
    // what it says about her things comes and goes with its sight of her
    if (this.trayEl) this.openTray();
    if (this.inspecting) this.inspect(this.inspecting);
    if (!unseen && this.panelKind === 'notebook') this.closePanel();
  }

  /** A thing she holds to use on something, on the right ball in place of a verb; null puts it back. */
  setHeld(id: string | null): void {
    const it = id ? this.items[id] : undefined;
    this.held = id && it ? { id, name: pick(it.name, this.raw) } : null;
    this.drawBalls();
    if (this.trayEl) this.trayEl.querySelectorAll<HTMLElement>('.slot').forEach((s) => s.classList.toggle('held', s.dataset.item === id));
  }

  /** The verb chosen, or none: the right ball shows it, its slot is lit, and with the verbs put away it is named beside the ball. */
  setVerb(v: Verb | null): void {
    this.verb = v;
    this.menu?.querySelectorAll<HTMLElement>('[data-verb]').forEach((b) => {
      b.classList.toggle('default', b.dataset.verb === v);
      b.setAttribute('aria-pressed', String(b.dataset.verb === v));
    });
    // asking it: its greeting listens, and says what it asks
    this.co.classList.toggle('listening', v === 'ask');
    this.co.setAttribute('aria-pressed', String(v === 'ask'));
    this.co.setAttribute('aria-label', v === 'ask' ? 'The Concierge is listening: tap what to ask about, or here to put the question down' : 'The Concierge: ring for assistance');
    this.drawStatus();
    this.drawBalls();
  }

  /** The Concierge's greeting and its line of the day, time and weather. */
  setStatus(greeting: string, status: string): void {
    this.said = [greeting, status];
    this.drawStatus();
  }

  /** Its greeting, or, asked about something, its question. */
  private drawStatus(): void {
    const [greeting, status] = this.verb === 'ask' ? [verbQuestion('ask', false), 'Tap it, or slide to find it'] : this.said;
    if (this.greet.textContent !== greeting) this.greet.textContent = greeting;
    if (this.status.textContent !== status) this.status.textContent = status;
  }

  /** Her credits, digital, on her account: shown with its greeting, in its view; null hides them. */
  setCredits(n: number | null): void {
    const text = n === null ? '' : `${n.toLocaleString('en-GB')} credits`;
    if (this.credits.textContent !== text) this.credits.textContent = text;
    this.credits.hidden = n === null;
  }

  /** How closely the Concierge is watching her, 0 to 3: the ticks under the view switch. */
  setAttention(level: number): void {
    const n = Math.max(0, Math.min(3, Math.round(level)));
    this.viewBtn.dataset.level = String(n);
    this.viewBtn.querySelectorAll('.ticks span').forEach((s, i) => s.classList.toggle('on', i < n));
    this.viewBtn.title = `Its attention: ${['calm', 'noticing', 'watching', 'watching closely'][n]}`;
  }

  /** What a chosen verb lights up under her finger, or nothing (null): corners around the thing, its name and the verb. */
  mark(m: Mark | null): void {
    if (!m) { this.markEl?.remove(); this.markEl = null; this.markOf = null; return; }
    const [x, y, w, h] = m.box;
    if (this.markOf !== m.h || !this.markEl) {
      this.markEl?.remove();
      const box = (this.markEl = el('div', 'hud-mark', this.root));
      this.markOf = m.h;
      box.insertAdjacentHTML('beforeend', '<svg class="frame" aria-hidden="true"><path/></svg>');
      const label = el('div', 'hud-mark-label', box);
      el('div', 'name', label, pick(m.h.name, this.raw));
      const tag = note(m.h.tag, this.raw);
      if (tag) el('div', 'tag', label, tag);
      const verb = el('div', 'verb', label);
      verb.insertAdjacentHTML('beforeend', icon(m.a.kind === 'item' ? 'hands' : m.a.kind, 15));
      el('span', '', verb, m.a.label);
      if (m.a.cost) verb.insertAdjacentHTML('beforeend', '<svg class="cost" width="30" height="16" viewBox="0 0 34 18" fill="none" stroke-linecap="round" aria-hidden="true"><path d="M2 9C5 4 8.5 3 12 3s7 1 10 6c-3 5-6.5 6-10 6S5 14 2 9z"/><circle cx="12" cy="9" r="2"/><path d="M26 9h6M29 6v6"/></svg>');
    }
    const box = this.markEl;
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
    box.style.width = `${w}px`;
    box.style.height = `${h}px`;
    // its corners, as long as the frame allows
    const c = Math.min(14, w / 3, h / 3), frame = box.querySelector('svg.frame');
    if (frame) {
      frame.setAttribute('viewBox', `0 0 ${w} ${h}`);
      frame.querySelector('path')?.setAttribute('d', `M0 ${c}V0H${c}M${w - c} 0H${w}V${c}M${w} ${h - c}V${h}H${w - c}M${c} ${h}H0V${h - c}`);
    }
    // the label above it, or under it when there is no room above
    box.classList.toggle('below', y < 70);
  }

  /** While she talks the conversation has the bottom of the frame: the balls step aside. */
  setTalking(on: boolean): void {
    if (on) { this.closeAll(); this.root.dataset.talking = ''; } else delete this.root.dataset.talking;
  }

  /** Something over the scene that a tap on the scene closes first: a panel, the tray, a thing close up. */
  get panelOpen(): boolean { return this.panel !== null || this.trayEl !== null || this.inspectEl !== null; }
  get menuOpen(): boolean { return this.menu !== null; }

  /* ---------- the balls ---------- */

  /** How many of her things there are in the view on screen. */
  private thingCount(): number {
    return thingsNow(this.items, this.carried, this.raw).filter((t) => !t.ghost).length;
  }

  /** The balls: her things on the left (how many), the verb chosen or the thing in her hand on the right. */
  private drawBalls(): void {
    const n = this.thingCount();
    this.thingsBall.innerHTML = `${icon('satchel', 26)}${n ? `<span class="badge">${n}</span>` : ''}`;
    this.thingsBall.setAttribute('aria-expanded', String(this.trayEl !== null));
    const held = this.held ? thingsNow(this.items, [this.held.id], this.raw)[0] : undefined, verb = this.verb === 'ask' ? null : this.verb;
    this.verbBall.innerHTML = held?.art ? `<img src="${this.assets}/${held.art}" alt="" width="40" height="40" draggable="false">` : icon(verb ?? (held ? 'hands' : 'verbs'), 26);
    this.verbBall.classList.toggle('holding', !!held);
    this.verbBall.setAttribute('aria-pressed', String(verb !== null || this.held !== null));
    this.verbBall.setAttribute('aria-label', this.held ? `${this.held.name}: put it back` : verb ? `${verbName(verb, this.raw)}: choose another, or put it down` : 'What she can do: look, talk, use, take');
    // with the verbs out, the lit slot names it; put away, what it asks sits beside the ball
    this.verbLabel.hidden = (!verb && !this.held) || this.menu !== null;
    if (this.held) {
      this.verbLabel.replaceChildren();
      el('div', 'verb', this.verbLabel, this.raw ? `use ${this.held.name.toLowerCase()} on what?` : `Use ${this.held.name} on what?`);
      el('div', 'hint', this.verbLabel, 'Tap it, or slide to find it');
    } else if (verb) {
      this.verbLabel.replaceChildren();
      el('div', 'verb', this.verbLabel, verbQuestion(verb, this.raw));
      el('div', 'hint', this.verbLabel, 'Tap it, or slide to find it');
    }
  }

  private toggleVerbs(): void {
    if (this.menu) this.closeVerbs();
    else this.openVerbs();
  }

  /**
   * The verbs, slid out sideways along the bottom from the right ball so they cover little of the street, each labelled
   * above, spaced so no two labels touch. They stay out until the ball is tapped again; the chosen verb is lit, and
   * choosing it again puts it down.
   */
  private openVerbs(): void {
    this.closeVerbs();
    this.closeTray();
    this.closePanel();
    this.onPanel();
    const ball = this.verbBall, choices = HERS.map((v) => ({ id: v, label: verbName(v, this.raw), on: v === this.verb }));
    const root = this.root.getBoundingClientRect(), b = ball.getBoundingClientRect(), slot = b.width / 1.15;
    const menu = (this.menu = el('div', 'hud-menu verbs', this.root));
    ball.setAttribute('aria-expanded', 'true');
    menu.style.left = `${b.left + b.width / 2 - root.left}px`;
    menu.style.top = `${b.top + b.height / 2 - root.top}px`;
    const made = choices.map((c) => {
      const s = button(`hud-slot${c.on ? ' default' : ''}`, c.label, menu, () => this.onVerb(c.id === this.verb ? null : c.id));
      s.dataset.verb = c.id;
      s.setAttribute('aria-pressed', String(c.on));
      s.innerHTML = icon(c.id, 24);
      return { s, label: el('div', 'hud-slot-label', menu, c.label) };
    });
    // out from the ball, each slot as wide as its label needs, sliding out from behind it one after another
    let x = b.width / 2 + 12;
    made.forEach(({ s, label }, i) => {
      const room = Math.max(slot, label.offsetWidth + 8), cx = -(x + room / 2);
      s.style.left = `${cx}px`;
      s.style.top = '0px';
      s.style.setProperty('--from', `${-cx}px`);
      s.style.animationDelay = label.style.animationDelay = `${i * 28}ms`;
      label.style.left = `${cx}px`;
      label.style.top = `${-slot / 2 - 7}px`;
      x += room + 6;
    });
    this.drawBalls();
  }

  private closeVerbs(): void {
    const was = this.menu;
    this.menu?.remove();
    this.menu = null;
    this.verbBall.setAttribute('aria-expanded', 'false');
    if (was) this.drawBalls();
  }

  /** Kept for the game: closes the verbs. */
  closeMenu(): void {
    this.closeVerbs();
  }

  /* ---------- her things ---------- */

  private toggleTray(): void {
    if (this.trayEl) this.closeTray();
    else this.openTray();
  }

  /** Her things slide out along the bottom from the left ball. */
  private openTray(): void {
    const wasOpen = this.trayEl !== null;
    this.trayEl?.remove();
    if (!wasOpen) { this.closeVerbs(); this.closePanel(); this.onPanel(); }
    const root = this.root.getBoundingClientRect(), b = this.thingsBall.getBoundingClientRect();
    this.trayEl = drawTray(this.root, thingsNow(this.items, this.carried, this.raw, !this.unseen), { x: b.left + b.width / 2 - root.left, y: b.top + b.height / 2 - root.top, r: b.width / 2 }, this.held?.id ?? null, this.assets, {
      inspect: (id) => (this.inspecting === id ? this.closeInspect() : this.inspect(id)),
    });
    if (wasOpen) this.trayEl.classList.add('still');
    this.drawBalls();
  }

  private closeTray(): void {
    if (!this.trayEl) return;
    this.trayEl.remove();
    this.trayEl = null;
    this.closeInspect();
    this.drawBalls();
  }

  /** A thing close up, over the tray. */
  private inspect(id: string): void {
    const t = thingsNow(this.items, this.carried, this.raw, !this.unseen).find((x) => x.id === id);
    this.inspectEl?.remove();
    this.inspectEl = null;
    this.inspecting = null;
    if (!t) return;
    this.inspecting = id;
    this.inspectEl = drawInspect(this.root, t, this.assets, this.held?.id === id, {
      hold: (thing) => { this.closeInspect(); this.onHold(thing); },
      close: () => this.closeInspect(),
    });
    const slot = this.trayEl?.querySelector<HTMLElement>(`[data-item="${id}"]`), root = this.root.getBoundingClientRect();
    this.trayEl?.querySelectorAll('.slot').forEach((x) => x.classList.toggle('open', x === slot));
    if (slot) {
      const r = slot.getBoundingClientRect(), w = this.inspectEl.offsetWidth;
      this.inspectEl.style.left = `${Math.max(8, Math.min(root.width - w - 8, r.left - root.left + r.width / 2 - w / 2))}px`;
      this.inspectEl.style.bottom = `${root.bottom - r.top + 34}px`;
    }
  }

  private closeInspect(): void {
    this.inspectEl?.remove();
    this.inspectEl = null;
    this.inspecting = null;
    this.trayEl?.querySelectorAll('.slot.open').forEach((x) => x.classList.remove('open'));
  }

  /* ---------- what she found, and the Concierge's messages ---------- */

  /**
   * What she found, written at the thing, where her eye already is: above it, or under it when there is no room above,
   * kept on screen. It stays as long as it takes to read (about 15 characters a second, from 2.5 to 9 seconds), and goes
   * sooner when she is given something else to do, or when it is tapped.
   */
  note(h: Hotspot, text: string, box: [number, number, number, number]): void {
    this.dismissNote();
    const n = (this.noteEl = el('div', 'hud-note', this.root));
    this.noteOf = h;
    n.setAttribute('role', 'status');
    el('div', 'name', n, pick(h.name, this.raw));
    el('p', 'text', n, text);
    n.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.dismissNote(); });
    this.placeNote(box);
    this.noteTimer = window.setTimeout(() => this.dismissNote(), Math.min(9000, Math.max(2500, 800 + text.length * 66)) * this.noteSpeed);
  }

  /** The thing the note is written at, while there is one. */
  get noteFor(): Hotspot | null { return this.noteOf; }

  /** Where the note goes for a thing at `box` (the HUD's pixels): above it, else under it, on screen and clear of the balls. */
  placeNote(box: [number, number, number, number]): void {
    const n = this.noteEl;
    if (!n) return;
    const W = this.root.clientWidth, H = this.root.clientHeight, m = Math.min(34, Math.max(12, W * 0.024)), w = n.offsetWidth, h = n.offsetHeight;
    const [x, y, bw, bh] = box, top = m + 60, bottom = H - m - this.verbBall.offsetHeight - 40;
    const above = y - 14 - h, below = y + bh + 14;
    const ny = above >= top ? above : below + h <= bottom ? below : Math.max(top, Math.min(bottom - h, above));
    n.style.left = `${Math.max(m, Math.min(W - m - w, x + bw / 2 - w / 2))}px`;
    n.style.top = `${ny}px`;
  }

  dismissNote(): void {
    window.clearTimeout(this.noteTimer);
    this.noteEl?.remove();
    this.noteEl = null;
    this.noteOf = null;
  }

  /** A message from the Concierge, under its greeting. Only in its view: raw view has no Concierge to show it. */
  toast(text: string, actions: { label: string; primary?: boolean; run?: () => void }[] = [], ms = 7000): void {
    if (this.raw) return;
    this.dismissToast();
    const t = (this.toastEl = el('div', 'hud-toast', this.root));
    t.setAttribute('role', 'status');
    t.insertAdjacentHTML('beforeend', icon('ask', 16));
    el('p', '', t, text);
    if (actions.length) {
      const row = el('div', 'row', t);
      for (const a of actions) button(a.primary ? 'primary' : '', a.label, row, () => { this.dismissToast(); a.run?.(); }).textContent = a.label;
    }
    this.toastTimer = window.setTimeout(() => this.dismissToast(), ms);
  }

  dismissToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toastEl?.remove();
    this.toastEl = null;
  }

  /** Close what the HUD has open: the verbs, her things, a panel, what a verb has lit, what she found. */
  closeAll(): void {
    this.closeVerbs();
    this.closeTray();
    this.closePanel();
    this.mark(null);
    this.dismissNote();
  }

  /* ---------- panels: her journal (with the map), her notebook, the menu ---------- */

  /** Her notebook's button: open where it cannot see her, its strap closed where it can. */
  private drawNotebookButton(): void {
    this.notebookBtn.innerHTML = icon(this.unseen ? 'notebook' : 'locked', 22);
    this.notebookBtn.classList.toggle('shut', !this.unseen);
    this.notebookBtn.setAttribute('aria-label', this.unseen ? 'Her notebook (N)' : 'Her notebook: not where it can see (N)');
  }

  togglePanel(kind: PanelKind): void {
    if (this.panelKind === kind) this.closePanel();
    else this.openPanel(kind);
  }

  private openPanel(kind: PanelKind): void {
    // her notebook stays shut where it can see her
    if (kind === 'notebook' && !this.unseen) return this.onShut();
    this.panel?.remove();
    this.closeVerbs();
    this.closeTray();
    this.panelKind = kind;
    this.root.dataset.panel = kind;
    const p = (this.panel = el('section', `hud-panel ${kind}`, this.root));
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.onPanel();
    if (kind === 'notebook') this.drawNotebookPanel(p);
    else if (kind === 'journal') this.drawJournalPanel(p);
    else this.drawMenu(p);
  }

  closePanel(): void {
    this.panel?.remove();
    this.panel = null;
    this.panelKind = null;
    delete this.root.dataset.panel;
    this.closeTray();
    this.drawFresh();
  }

  /**
   * Her journal, open at a tab (the map's is `places`), or closed if it is open there already. Its own button opens it at
   * the page last read, never the map.
   */
  private openJournal(tab?: string): void {
    if (this.panelKind === 'journal' && (tab === undefined ? this.journalTab !== PLACES : this.journalTab === tab)) return this.closePanel();
    this.journalTab = tab ?? (this.journalTab === PLACES ? null : this.journalTab);
    this.openPanel('journal');
  }

  private drawNotebookPanel(p: HTMLElement): void {
    const pages = notebookNow(this.notebook, this.known, this.read());
    drawNotebook(p, this.notebook, pages, this.notebookTab, {
      tab: (id) => { this.notebookTab = id; this.openPanel('notebook'); },
      read: (keys) => this.onRead(keys),
      close: () => this.closePanel(),
    });
  }

  private drawJournalPanel(p: HTMLElement): void {
    drawJournal(p, notebookNow(this.journal, this.known, this.read(), 'journal:'), this.journalTab, {
      tab: (id) => { this.journalTab = id; this.openPanel('journal'); },
      read: (keys) => this.onRead(keys),
      close: () => this.closePanel(),
      map: (body) => void this.mapNow().then((now) => {
        if (this.panel !== p) return;
        drawMap(body, now, (t) => { this.closePanel(); this.onTravel(t); });
      }),
    });
  }

  /**
   * The menu: her saves (where she is now, saved as she goes, and three slots she saves into and goes back to), the
   * settings, how to play, and the title screen.
   */
  private drawMenu(p: HTMLElement): void {
    p.setAttribute('aria-label', 'Menu');
    const head = el('div', 'head', p), tabs = el('nav', 'tabs', head);
    tabs.setAttribute('aria-label', 'Menu');
    const settings = this.settings();
    for (const [id, title] of [['saves', 'Saves'], ['settings', 'Settings'], ['help', 'How to play']] as const) {
      if (id === 'settings' && !settings) continue;
      const t = button(`tab${this.menuTab === id ? ' on' : ''}`, title, tabs, () => { this.menuTab = id; this.openPanel('menu'); });
      t.textContent = title;
      t.setAttribute('aria-current', String(this.menuTab === id));
    }
    button('to-title', 'To the title screen', head, () => { this.closePanel(); this.onTitle(); }).textContent = 'Title screen';
    button('hud-close', 'Close', head, () => this.closePanel()).innerHTML = icon('close', 18);
    const body = el('div', 'body', p);
    if (this.menuTab === 'settings' && settings) return drawSettings(body, settings, (s) => this.onSettings(s));
    if (this.menuTab === 'help') return drawHelp(body);
    const list = el('div', 'saves', body), all = this.saves();
    const when = (t?: number) => (t ? new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
    for (const slot of ['auto', 1, 2, 3] as const) {
      const s = all.find((x) => x.slot === slot), card = el('div', 'save', list);
      el('div', 'name', card, slot === 'auto' ? 'Now' : `Slot ${slot}`);
      el('div', 'when', card, s ? [s.where, when(s.savedAt)].filter(Boolean).join(' · ') || 'Saved' : 'Empty');
      const row = el('div', 'row', card);
      if (slot !== 'auto') button('', `Save in slot ${slot}`, row, () => { this.onSave(slot); this.openPanel('menu'); }).textContent = 'Save here';
      if (s && slot !== 'auto') button('primary', `Go back to slot ${slot}`, row, () => this.onLoad(slot)).textContent = 'Load';
    }
  }

  /** N her notebook, J her journal, M the map, I her things, Escape closes what is open or puts the verb down. Returns true if it used the key. */
  key(k: string): boolean {
    if (k === 'Escape' && (this.menu || this.panelOpen)) { this.closeAll(); return true; }
    if (k === 'Escape' && this.held) { this.onHold(null); return true; }
    if (k === 'Escape' && this.verb) { this.onVerb(null); return true; }
    if (k === 'n' || k === 'N') { this.togglePanel('notebook'); return true; }
    if (k === 'i' || k === 'I') { this.toggleTray(); return true; }
    if (k === 'm' || k === 'M') { this.openJournal(PLACES); return true; }
    if (k === 'j' || k === 'J') { this.openJournal(); return true; }
    return false;
  }
}

/** How to play: the controls, by touch and by keyboard. */
export function drawHelp(p: HTMLElement): void {
  const box = el('div', 'help', p);
  const rows: [string, string][] = [
    ['Walk', 'Tap where she should go. A door, or the end of the street, takes her through. Outdoors, hold a finger far ahead of her to run.'],
    ['Do', 'The ball at the bottom right: choose Look, Talk, Use or Take, then tap what to do it to (or slide over the scene and let go on what lights up). Anything can be tried; not everything answers.'],
    ['Concierge', 'Its greeting at the top left, in its view. Tap it and it says what it would have you do here; tap Ask about something, then a thing, and it tells you what it knows of it. Talk is Luna speaking herself.'],
    ['Her things', 'The ball at the bottom left. Tap a thing to see it close up; Use takes it out, then tap what to use it on.'],
    ['Top right', 'The view switch once she has it, the map, her journal (anywhere) and her notebook (only where it cannot see her), and this menu.'],
    ['Keys', 'Arrows or A and D walk, with Shift she runs. E switches view, I her things, M the map, J her journal, N her notebook, Esc closes. Numbers pick an answer.'],
  ];
  for (const [name, text] of rows) { const r = el('div', 'row-help', box); el('div', 'name', r, name); el('div', 'text', r, text); }
}
