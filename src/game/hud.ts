// The HUD over the frame. In the Concierge's view it is the Concierge's own interface: it names and classifies what
// her finger lights up, greets her, offers its services and keeps her things in its catalogue. In raw view that
// interface is gone, because the augmented eye is switched off: what is left is Lux's own, her handwriting on what she
// has noticed, her pockets, her notebook and her sense of being watched.
//
// Two balls at the bottom corners, made for thumbs, and nothing that needs a mouse to hover: her things on the left
// (her pockets, her notebook, the view switch, the Concierge's bell), what she can do on the right (look, talk, use,
// take, ask). A ball opens its choices on an arc around it. With a verb chosen, what her finger is over lights up if
// the verb does something to it, and letting go does it.

import { verbName, verbsIn, type Verb } from './actions';
import { note, pick, type Hotspot, type ViewText } from './level';

export type ActionKind = 'feet' | 'hands' | 'take' | 'eyes' | 'heart' | 'ask';

export interface Action {
  kind: ActionKind;
  /** What the action is called here, in the skin's own words. */
  label: string;
  /** Steps of the Concierge's attention it costs. */
  cost?: number;
}

export interface Item {
  icon: string;
  /** Only in one view: credits exist only in the Concierge's eye. */
  only?: 'raw' | 'concierge';
  /** Made by people, outside its catalogue: the Concierge offers to dispose of it. */
  unlicensed?: boolean;
  name: ViewText;
  note?: ViewText;
}

export interface NoteEntry {
  name: string;
  note: string;
  /** An Ink variable that must be true for her to have written this. */
  when?: string;
}

export interface NotebookPages {
  warning?: string;
  errands?: NoteEntry[];
  people?: NoteEntry[];
  questions?: { when?: string; lines: string[] };
}

const SVG_ATTRS = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/** Line icons on a 24 grid. */
const ICONS: Record<string, string> = {
  eyes: '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>',
  hands: '<path d="M7 12V6.5a1.5 1.5 0 0 1 3 0V11M10 11V4.5a1.5 1.5 0 0 1 3 0V11M13 11V5.5a1.5 1.5 0 0 1 3 0V12M16 12V8.5a1.5 1.5 0 0 1 3 0V15a6.5 6.5 0 0 1-6.5 6.5h-1A6.5 6.5 0 0 1 6 18.6l-2.7-3.4a1.5 1.5 0 0 1 2.3-1.9L7 15"/>',
  heart: '<path d="M12 20s-7.2-4.4-9.3-8.8C1.3 8.1 3.1 5 6.4 5c2.1 0 3.3 1.2 4 2.3.4.6 1 .6 1.3 0 .8-1.1 2-2.3 4-2.3 3.4 0 5.2 3.1 3.7 6.2C17.3 15.6 12 20 12 20z"/>',
  feet: '<path d="M12 2.5c2.3 0 3.6 2.3 3.6 5.2S14.4 14 12.3 14 8.9 10.9 8.9 7.9 9.7 2.5 12 2.5zM11.1 16.2c1.5 0 2.6 1.1 2.6 2.6s-1 2.7-2.2 2.7-2.7-1.2-2.7-2.7.8-2.6 2.3-2.6z"/>',
  // a hand closing under a small box: taking it
  take: '<rect x="9.5" y="2.5" width="7" height="6" rx="1"/><path d="M3 15.5l3.6-1.9a2.4 2.4 0 0 1 2-.1l3.4 1.3a1.4 1.4 0 0 1-.9 2.7l-2.6-.6M3 21l4.2-1.7h5.9l6.4-4.6a1.5 1.5 0 0 0-1.8-2.4l-4.4 2.7"/>',
  // the verbs' ball with no verb chosen: a ring with four ticks, choose what to do
  verbs: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"/>',
  // the view switch: the dot behind her eye
  temple: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/>',
  ask: '<path d="M3 18h18M5 18a7 7 0 0 1 14 0M12 11V8.5M10.5 8h3M4 21h16"/>',
  notebook: '<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 3v18M12 8h4M12 11.5h4"/>',
  satchel: '<path d="M4.5 9h15l-1.2 11.2a1 1 0 0 1-1 .8H6.7a1 1 0 0 1-1-.8L4.5 9z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};

/** Things on a 64 grid: thin lines in the Concierge's catalogue, pencil in her pockets. */
const ITEM_ICONS: Record<string, string> = {
  parcel: '<path d="M10 22l22-10 22 10v24L32 56 10 46z"/><path d="M10 22l22 10 22-10M32 32v24"/><path class="accent" d="M21 17l22 10v8"/>',
  credits: '<rect x="10" y="18" width="44" height="28" rx="4"/><rect class="accent" x="17" y="25" width="13" height="11" rx="1.5"/><path d="M37 27h11M37 32h11M37 37h7"/>',
  matches: '<rect x="10" y="28" width="44" height="20" rx="2"/><path d="M10 34h44M40 28l7-12"/><circle class="accent" cx="48" cy="14" r="2.6"/>',
  cigarettes: '<path d="M18 26h28v28H18z"/><path d="M18 33h28M24 26V12h6v14M34 26V16h6v10"/><path class="accent" d="M24 12h6"/>',
  map: '<path d="M8 14l16-4 16 4 16-4v38l-16 4-16-4-16 4z"/><path d="M24 10v38M40 14v38"/><path class="accent" d="M14 40c6-4 8-12 16-10s8 10 16 6 6-10 10-10" stroke-dasharray="3 4"/>',
};

/** A hand-drawn loop, for her slots and buttons: on a 54 grid. */
const LOOP = 'M27 3.5C39.5 3 50 13 49.6 27.2 49.2 39.8 39 50 26.6 49.4 14.2 48.8 4.4 39 4.8 26.4 5.2 14.4 14.8 4.9 27.8 5.6';

const icon = (name: string, size: number, pencil = false) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" stroke-width="1.6" ${SVG_ATTRS}>${pencil ? '<g filter="url(#lidless-pencil)">' : ''}${ICONS[name] ?? ''}${pencil ? '</g>' : ''}</svg>`;
const itemIcon = (name: string, size: number, pencil: boolean) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 64 64" stroke-width="${pencil ? 2.2 : 1.4}" ${SVG_ATTRS}>${pencil ? '<g filter="url(#lidless-pencil)">' : ''}${ITEM_ICONS[name] ?? ''}${pencil ? '</g>' : ''}</svg>`;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement | null, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.append(e);
  return e;
}

function button(cls: string, label: string, parent: HTMLElement, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, parent);
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
  return b;
}

/** What a chosen verb lights up under her finger: the thing, what the verb does to it, and where it is on screen. */
export interface Mark {
  h: Hotspot;
  a: Action;
  /** x, y, width, height in the HUD's pixels. */
  box: [number, number, number, number];
}

export class Hud {
  readonly root: HTMLElement;
  /** A verb chosen at the right ball, or put down (null). */
  onVerb: (v: Verb | null) => void = () => {};
  onTemple: () => void = () => {};
  onBell: () => void = () => {};
  onDispose: (id: string, dispose: boolean) => void = () => {};
  /** A panel opened over the frame. */
  onPanel: () => void = () => {};
  /** Whether an Ink variable is true, for what her notebook holds. */
  known: (variable: string) => boolean = () => false;

  private raw = false;
  private ribbon: HTMLElement;
  private greet: HTMLElement;
  private status: HTMLElement;
  private toastEl: HTMLElement | null = null;
  private toastTimer = 0;
  private eye: HTMLElement;
  private thingsBall: HTMLButtonElement;
  private verbBall: HTMLButtonElement;
  private verbLabel: HTMLElement;
  private verb: Verb | null = null;
  private unlocked = false;
  private menu: HTMLElement | null = null;
  private menuKind: 'things' | 'verbs' | null = null;
  private markEl: HTMLElement | null = null;
  private markOf: Hotspot | null = null;
  private panel: HTMLElement | null = null;
  private panelKind: 'things' | 'notebook' | null = null;
  private items: Record<string, Item> = {};
  private carried: string[] = [];
  private notebook: NotebookPages = {};

  constructor(canvas: HTMLCanvasElement) {
    const root = (this.root = el('div', 'hud'));
    root.dataset.skin = 'concierge';
    canvas.after(root);
    // her pencil: a little wobble on every line she draws
    root.insertAdjacentHTML('beforeend', '<svg class="hud-defs" width="0" height="0" aria-hidden="true"><defs><filter id="lidless-pencil" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.2"/></filter></defs></svg>');

    this.ribbon = el('div', 'hud-ribbon hud-co', root);
    this.ribbon.insertAdjacentHTML('beforeend', icon('ask', 28));
    const words = el('div', '', this.ribbon);
    this.greet = el('div', 'greet hud-serif', words);
    this.status = el('div', 'status hud-caps', words);

    this.eye = el('div', 'hud-eye', root);
    this.eye.innerHTML = `<svg class="eye" width="64" height="38" viewBox="0 0 70 40" fill="none" stroke-linecap="round" aria-hidden="true"><g filter="url(#lidless-pencil)"><path d="M4 20C13 7 24 4 35 4s22 3 31 16C57 33 46 36 35 36S13 33 4 20z" stroke="currentColor" stroke-width="2"/><circle class="iris" cx="35" cy="20" r="9" stroke="currentColor" stroke-width="2"/><circle class="pupil" cx="35" cy="20" r="3"/></g></svg><div class="ticks"><span></span><span></span><span></span></div>`;
    this.eye.setAttribute('role', 'img');

    // the two balls: her things on the left, what she can do on the right, the verb chosen named beside it
    this.thingsBall = button('hud-ball things', 'Her things', root, () => this.toggleMenu('things'));
    this.verbBall = button('hud-ball verbs', 'What she can do', root, () => this.toggleMenu('verbs'));
    this.verbLabel = el('div', 'hud-ball-label', root);
    this.verbLabel.hidden = true;
    this.setAttention(0);
  }

  setThings(items: Record<string, Item>, carried: string[]): void {
    this.items = items;
    this.carried = carried;
    this.drawBalls();
  }

  setNotebook(pages: NotebookPages): void {
    this.notebook = pages;
  }

  /** Which view is on screen, and whether she can switch yet: the switch and her sense of being watched come with the biohack. */
  setView(raw: boolean, unlocked: boolean): void {
    const changed = raw !== this.raw || unlocked !== this.unlocked;
    this.raw = raw;
    this.unlocked = unlocked;
    this.root.dataset.skin = raw ? 'raw' : 'concierge';
    if (unlocked) this.root.dataset.switch = ''; else delete this.root.dataset.switch;
    this.eye.hidden = !unlocked;
    if (changed) {
      this.closeMenu();
      this.mark(null);
      if (raw) this.dismissToast();
      this.drawBalls();
      if (this.panelKind) this.openPanel(this.panelKind);
    }
  }

  /** The verb chosen, or none: the right ball shows it, and names it beside it until it is used or put down. */
  setVerb(v: Verb | null): void {
    this.verb = v;
    this.closeMenu();
    this.drawBalls();
  }

  /** The Concierge's greeting and its line of the day, time and weather. */
  setStatus(greeting: string, status: string): void {
    if (this.greet.textContent !== greeting) this.greet.textContent = greeting;
    if (this.status.textContent !== status) this.status.textContent = status;
  }

  /** How closely the Concierge is watching her, 0 to 3. */
  setAttention(level: number): void {
    const n = Math.max(0, Math.min(3, Math.round(level)));
    this.eye.dataset.level = String(n);
    this.eye.querySelector('.iris')?.setAttribute('r', String([9, 7.5, 6, 4.5][n]));
    this.eye.querySelectorAll('.ticks span').forEach((s, i) => s.classList.toggle('on', i < n));
    this.eye.setAttribute('aria-label', `The Concierge's attention: ${['calm', 'noticing', 'watching', 'watching closely'][n]}`);
  }

  /**
   * What a chosen verb lights up under her finger, or nothing (null): in the Concierge's view its frame around the thing,
   * glowing, with its name, its classification and the verb; in raw view her pencil ring around it and her handwriting.
   */
  mark(m: Mark | null): void {
    if (!m) { this.markEl?.remove(); this.markEl = null; this.markOf = null; return; }
    const [x, y, w, h] = m.box;
    if (this.markOf !== m.h || !this.markEl) {
      this.markEl?.remove();
      const box = (this.markEl = el('div', 'hud-mark', this.root));
      this.markOf = m.h;
      box.insertAdjacentHTML('beforeend', this.raw
        ? `<svg class="ring" viewBox="0 0 54 54" preserveAspectRatio="none" ${SVG_ATTRS}><g filter="url(#lidless-pencil)"><path d="${LOOP}"/></g></svg>`
        : '<svg class="frame" aria-hidden="true"><path/></svg>');
      const label = el('div', 'hud-mark-label', box);
      el('div', 'name', label, pick(m.h.name, this.raw));
      const tag = note(m.h.tag, this.raw);
      if (tag) el('div', 'tag', label, tag);
      const verb = el('div', 'verb', label);
      verb.insertAdjacentHTML('beforeend', icon(m.a.kind, 16, this.raw));
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

  get panelOpen(): boolean { return this.panel !== null; }
  get menuOpen(): boolean { return this.menu !== null; }

  private toggleMenu(kind: 'things' | 'verbs'): void {
    if (this.menuKind === kind) this.closeMenu();
    else this.openMenu(kind);
  }

  /**
   * A ball's choices on a quarter circle around it: the verbs from straight up round to the left of the right ball,
   * her things from straight up round to the right of the left one, each labelled outward. The chosen verb is lit, and
   * choosing it again puts it down.
   */
  private openMenu(kind: 'things' | 'verbs'): void {
    this.closeMenu();
    this.closePanel();
    // like a panel, the choices clear what she was looking at off the bottom of the screen
    this.onPanel();
    const ball = kind === 'verbs' ? this.verbBall : this.thingsBall;
    const choices: { id: string; icon: string; label: string; on?: boolean; co?: boolean; badge?: number; run: () => void }[] = kind === 'verbs'
      ? verbsIn(this.raw).map((v) => ({ id: v, icon: v, label: verbName(v, this.raw), on: v === this.verb, co: v === 'ask', run: () => this.onVerb(v === this.verb ? null : v) }))
      : [
          { id: 'things', icon: 'satchel', label: this.raw ? 'pockets' : 'Your things', badge: this.raw ? undefined : this.thingCount(), run: () => this.togglePanel('things') },
          { id: 'notebook', icon: 'notebook', label: this.raw ? 'notebook' : 'Notebook', run: () => this.togglePanel('notebook') },
          ...(this.unlocked ? [{ id: 'view', icon: 'temple', label: this.raw ? 'back to its view' : 'see it as it is', run: () => { this.closeMenu(); this.onTemple(); } }] : []),
          ...(this.raw ? [] : [{ id: 'bell', icon: 'ask', label: 'Ring for assistance', co: true, run: () => { this.closeMenu(); this.onBell(); } }]),
        ];
    const root = this.root.getBoundingClientRect(), b = ball.getBoundingClientRect(), slot = b.width / 1.15;
    const menu = (this.menu = el('div', `hud-menu ${kind}`, this.root));
    this.menuKind = kind;
    ball.setAttribute('aria-expanded', 'true');
    menu.style.left = `${b.left + b.width / 2 - root.left}px`;
    menu.style.top = `${b.top + b.height / 2 - root.top}px`;
    const n = choices.length, r = Math.max(slot * 2.1, ((slot + 12) * (n - 1)) / (Math.PI / 2));
    const from = -90, span = kind === 'verbs' ? -90 : 90;
    menu.insertAdjacentHTML('beforeend', `<svg class="arc" width="${2 * r}" height="${2 * r}" viewBox="${-r} ${-r} ${2 * r} ${2 * r}" aria-hidden="true"><g filter="${this.raw ? 'url(#lidless-pencil)' : 'none'}"><path d="M0 ${-r}A${r} ${r} 0 0 ${kind === 'verbs' ? 0 : 1} ${kind === 'verbs' ? -r : r} 0" fill="none"/></g></svg>`);
    const arc = menu.querySelector('svg.arc') as SVGElement;
    arc.style.left = `${-r}px`;
    arc.style.top = `${-r}px`;
    choices.forEach((c, i) => {
      const deg = from + span * (n > 1 ? i / (n - 1) : 0.5), rad = (deg * Math.PI) / 180, cx = Math.cos(rad), cy = Math.sin(rad);
      const s = button(`hud-slot${c.on ? ' default' : ''}${c.co ? ' co' : ''}`, c.label, menu, c.run);
      s.dataset[kind === 'verbs' ? 'verb' : 'menu'] = c.id;
      s.style.left = `${r * cx}px`;
      s.style.top = `${r * cy}px`;
      s.innerHTML = this.raw
        ? `<svg class="loop" viewBox="0 0 54 54" ${SVG_ATTRS}><g filter="url(#lidless-pencil)"><path d="${LOOP}"/></g></svg>${icon(c.icon, 24, true)}`
        : icon(c.icon, 24);
      if (c.badge !== undefined) el('span', 'badge', s, String(c.badge));
      // the label further out along the same line, its near edge towards the slot
      const label = el('div', `hud-slot-label${c.co ? ' co' : ''}`, menu, c.label), out = r + slot / 2 + 8;
      label.style.left = `${out * cx}px`;
      label.style.top = `${out * cy}px`;
      label.style.transform = `translate(${cx < -0.3 ? '-100%' : cx > 0.3 ? '0' : '-50%'}, ${cy < -0.3 ? '-100%' : cy > 0.3 ? '0' : '-50%'})`;
    });
  }

  closeMenu(): void {
    this.menu?.remove();
    this.menu = null;
    this.menuKind = null;
    this.verbBall.setAttribute('aria-expanded', 'false');
    this.thingsBall.setAttribute('aria-expanded', 'false');
  }

  /** A message from the Concierge, under its greeting. Only in its view: raw view has no Concierge to show it. */
  toast(text: string, actions: { label: string; primary?: boolean; run?: () => void }[] = [], ms = 7000): void {
    if (this.raw) return;
    this.dismissToast();
    const t = (this.toastEl = el('div', 'hud-toast', this.root));
    t.setAttribute('role', 'status');
    el('p', '', t, text);
    if (actions.length) {
      const row = el('div', 'row', t);
      for (const a of actions) {
        const b = button(`hud-caps${a.primary ? ' primary' : ''}`, a.label, row, () => { this.dismissToast(); a.run?.(); });
        b.textContent = a.label;
      }
    }
    this.toastTimer = window.setTimeout(() => this.dismissToast(), ms);
  }

  dismissToast(): void {
    window.clearTimeout(this.toastTimer);
    this.toastEl?.remove();
    this.toastEl = null;
  }

  /** Close what the HUD has open: a ball's choices, a panel, what a verb has lit. */
  closeAll(): void {
    this.closeMenu();
    this.closePanel();
    this.mark(null);
  }

  togglePanel(kind: 'things' | 'notebook'): void {
    if (this.panelKind === kind) this.closePanel();
    else this.openPanel(kind);
  }

  closePanel(): void {
    this.panel?.remove();
    this.panel = null;
    this.panelKind = null;
  }

  /** N for the notebook, I for her things, Escape closes what is open or puts the verb down. Returns true if it used the key. */
  key(k: string): boolean {
    if (k === 'Escape' && (this.menu || this.panel)) { this.closeAll(); return true; }
    if (k === 'Escape' && this.verb) { this.onVerb(null); return true; }
    if (k === 'n' || k === 'N') { this.togglePanel('notebook'); return true; }
    if (k === 'i' || k === 'I') { this.togglePanel('things'); return true; }
    return false;
  }

  /** How many of her things are there in the view on screen. */
  private thingCount(): number {
    return this.carried.filter((id) => this.items[id] && this.items[id].only !== (this.raw ? 'concierge' : 'raw')).length;
  }

  /** The balls in the view's skin: her satchel on the left, the verb chosen (or the ring of choices) on the right. */
  private drawBalls(): void {
    const loop = this.raw ? `<svg class="loop" viewBox="0 0 54 54" ${SVG_ATTRS}><g filter="url(#lidless-pencil)"><path d="${LOOP}"/></g></svg>` : '';
    const n = this.thingCount();
    this.thingsBall.innerHTML = `${loop}${icon('satchel', 26, this.raw)}${this.raw ? '' : `<span class="badge">${n}</span>`}`;
    this.thingsBall.setAttribute('aria-label', `${this.raw ? 'Her pockets, her notebook' : 'Your things, your notebook'}${this.unlocked ? ', the view switch' : ''} (I, N)`);
    this.verbBall.innerHTML = `${loop}${icon(this.verb ?? 'verbs', 26, this.raw)}`;
    this.verbBall.setAttribute('aria-pressed', String(this.verb !== null));
    this.verbBall.setAttribute('aria-label', this.verb ? `${verbName(this.verb, this.raw)}: choose another, or put it down` : 'What she can do: look, talk, use, take');
    this.verbLabel.hidden = !this.verb;
    if (this.verb) {
      this.verbLabel.replaceChildren();
      el('div', 'verb', this.verbLabel, verbName(this.verb, this.raw));
      el('div', 'hint', this.verbLabel, this.raw ? 'slide over things' : 'Slide over what you see');
    }
  }

  private openPanel(kind: 'things' | 'notebook'): void {
    this.closeMenu();
    this.panel?.remove();
    this.panelKind = kind;
    const p = (this.panel = el('section', `hud-panel ${kind === 'notebook' ? 'notebook' : this.raw ? 'pockets' : 'things'}`, this.root));
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.onPanel();
    if (kind === 'notebook') this.drawNotebook(p);
    else if (this.raw) this.drawPockets(p);
    else this.drawThings(p);
  }

  /** The Concierge's catalogue of what she carries, each thing in its words; anything it did not make, it offers to take away. */
  private drawThings(p: HTMLElement): void {
    p.setAttribute('aria-label', 'Your things');
    const head = el('div', 'head', p);
    el('h2', 'hud-caps', head, 'Your things');
    el('div', 'motto hud-serif', head, 'Everything you need, and nothing you don’t.');
    button('hud-close', 'Close', head, () => this.closePanel()).innerHTML = icon('close', 16);
    const grid = el('div', 'cards', p);
    for (const id of this.carried) {
      const it = this.items[id];
      if (!it || it.only === 'raw') continue;
      const card = el('div', `card${it.unlicensed ? ' unlicensed' : ''}`, grid);
      card.insertAdjacentHTML('beforeend', itemIcon(it.icon, 56, false));
      const words = el('div', 'words', card);
      el('div', 'name hud-serif', words, pick(it.name, false));
      if (it.note) el('div', 'note hud-caps', words, pick(it.note, false));
      if (it.unlicensed) {
        el('div', 'offer hud-serif', words, 'Shall I dispose of it for you?');
        const row = el('div', 'row', words);
        button('hud-caps primary', 'Dispose', row, () => this.onDispose(id, true)).textContent = 'Dispose';
        button('hud-caps', 'Keep', row, () => this.onDispose(id, false)).textContent = 'Keep';
      }
    }
  }

  /** What is really on her, in pencil, with her own notes; what exists only in the Concierge's eye is crossed out. */
  private drawPockets(p: HTMLElement): void {
    p.setAttribute('aria-label', 'Her pockets');
    const head = el('div', 'head', p);
    el('h2', '', head, 'pockets');
    el('div', 'motto', head, 'what’s actually on me');
    button('hud-close', 'Close', head, () => this.closePanel()).innerHTML = icon('close', 18, true);
    const grid = el('div', 'cards', p);
    for (const id of this.carried) {
      const it = this.items[id];
      if (!it) continue;
      const gone = it.only === 'concierge', card = el('div', `card${gone ? ' gone' : ''}`, grid);
      card.insertAdjacentHTML('beforeend', gone ? '<svg width="96" height="64" viewBox="0 0 96 64" fill="none" stroke="currentColor" aria-hidden="true"><g filter="url(#lidless-pencil)"><rect x="10" y="10" width="76" height="44" rx="4" stroke-dasharray="5 5" stroke-width="1.6"/></g></svg>' : itemIcon(it.icon, 64, true));
      el('div', 'name', card, pick(it.name, true));
      if (it.note) el('div', 'note', card, pick(it.note, true));
    }
  }

  /** Her notebook: paper, the same in both views. What she knows depends on what has happened. */
  private drawNotebook(p: HTMLElement): void {
    p.setAttribute('aria-label', 'Her notebook');
    const nb = this.notebook, ok = (e: { when?: string }) => !e.when || this.known(e.when);
    const leftPage = el('div', 'page', p), rightPage = el('div', 'page', p);
    button('hud-close', 'Close', p, () => this.closePanel()).innerHTML = icon('close', 18, true);
    const section = (page: HTMLElement, title: string, entries: NoteEntry[], empty?: string) => {
      const shown = entries.filter(ok);
      if (!shown.length && !empty) return;
      el('h2', '', page, title);
      if (!shown.length) el('p', 'note', page, empty);
      for (const e of shown) { const d = el('div', 'entry', page); el('div', 'name', d, e.name); el('div', 'note', d, e.note); }
    };
    if (nb.warning) el('div', 'warning', leftPage, nb.warning);
    section(leftPage, 'errands', nb.errands ?? []);
    section(leftPage, 'people', nb.people ?? [], 'nobody yet.');
    el('h2', '', rightPage, 'places');
    rightPage.insertAdjacentHTML('beforeend', `<svg class="map" viewBox="0 0 470 250" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="A hand-drawn map: home, the backstreet, the main street and the radio repair, joined in a line"><g filter="url(#lidless-pencil)"><rect x="12" y="22" width="92" height="52" rx="3"/><path d="M104 48h44"/><rect x="148" y="22" width="112" height="52" rx="3"/><path d="M260 48c20 0 22 58 44 64"/><rect x="250" y="112" width="128" height="52" rx="3"/><path d="M314 164v34"/><rect class="accent" x="262" y="198" width="112" height="44" rx="3"/></g><g stroke="none" fill="currentColor" font-size="19" text-anchor="middle"><text x="58" y="54">home</text><text x="204" y="54">backstreet</text><text x="314" y="144">main street</text><text class="accent" x="318" y="226">radio repair</text><text x="58" y="96" font-size="15">entrance 3</text></g></svg>`);
    const q = nb.questions;
    if (q && ok(q)) {
      el('h2', '', rightPage, 'ask it (carefully)');
      const list = el('ol', 'questions', rightPage);
      for (const line of q.lines) el('li', '', list, line);
    }
  }
}
