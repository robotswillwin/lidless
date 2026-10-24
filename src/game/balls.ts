// The two balls at the bottom, made for thumbs: her things on the left, a tray of them sliding out along the bottom and
// a thing close up over it; what she can do on the right (look, talk, use, take), sliding out the other way, the verb
// chosen named beside it, or the thing she holds to use on something.

import { HERS, verbName, verbQuestion, type Verb } from './actions';
import { button, el } from './dom';
import type { Hud } from './hud';
import { icon } from './icons';
import { pick } from './level';
import { drawInspect, drawTray, picturesOf, thingsNow, type Item } from './tray';

export class Balls {
  private readonly thingsBall: HTMLButtonElement;
  private readonly verbBall: HTMLButtonElement;
  private readonly verbLabel: HTMLElement;
  private verb: Verb | null = null;
  /** A thing she holds to use on something, and what it is called. */
  private held: { id: string; name: string } | null = null;
  /** The verbs, slid out. */
  private menu: HTMLElement | null = null;
  private trayEl: HTMLElement | null = null;
  private inspectEl: HTMLElement | null = null;
  private inspecting: string | null = null;
  private items: Record<string, Item> = {};
  private carried: string[] = [];
  /** Her things' pictures, fetched once. */
  private readonly fetched = new Set<string>();

  constructor(private readonly hud: Hud) {
    this.thingsBall = button('hud-ball things', 'Her things (I)', hud.root, () => this.toggleTray());
    // holding a thing, the ball puts it back; else it slides out the verbs
    this.verbBall = button('hud-ball verbs', 'What she can do', hud.root, () => (this.held ? hud.onHold(null) : this.toggleVerbs()));
    this.verbLabel = el('div', 'hud-ball-label', hud.root);
    this.verbLabel.hidden = true;
    this.draw();
  }

  /** How tall a ball is on screen: what is written at things keeps clear of them. */
  get height(): number { return this.verbBall.offsetHeight; }
  /** The verbs are out. */
  get verbsOpen(): boolean { return this.menu !== null; }
  /** Her things are out, or one of them close up. */
  get trayOpen(): boolean { return this.trayEl !== null || this.inspectEl !== null; }
  /** A verb chosen, or a thing in her hand: Escape puts it down. */
  get chosen(): Verb | null { return this.verb; }
  get holding(): boolean { return this.held !== null; }

  setThings(items: Record<string, Item>, carried: string[]): void {
    this.items = items;
    this.carried = carried;
    // their pictures fetched now, so the tray opens with them there
    for (const art of carried.flatMap((id) => picturesOf(items[id]))) if (!this.fetched.has(art)) { this.fetched.add(art); new Image().src = `${this.hud.assets}/${art}`; }
    this.draw();
    if (this.trayEl) this.openTray();
    if (this.inspecting && !carried.includes(this.inspecting)) this.closeInspect();
  }

  /** A thing she holds to use on something, on the right ball in place of a verb; null puts it back. */
  setHeld(id: string | null): void {
    const it = id ? this.items[id] : undefined;
    this.held = id && it ? { id, name: pick(it.name, this.hud.raw) } : null;
    this.draw();
    if (this.trayEl) this.trayEl.querySelectorAll<HTMLElement>('.slot').forEach((s) => s.classList.toggle('held', s.dataset.item === id));
  }

  /** The verb chosen, or none: the right ball shows it, its slot is lit, and with the verbs put away it is named beside the ball. */
  setVerb(v: Verb | null): void {
    this.verb = v;
    this.menu?.querySelectorAll<HTMLElement>('[data-verb]').forEach((b) => {
      b.classList.toggle('default', b.dataset.verb === v);
      b.setAttribute('aria-pressed', String(b.dataset.verb === v));
    });
    // asking it: its presence listens, and says what it asks
    this.hud.concierge.setListening(v === 'ask');
    this.draw();
  }

  /** The view switched: what she has and can do, in its words. */
  viewChanged(): void {
    this.closeVerbs();
    this.draw();
    if (this.held) this.setHeld(this.held.id);
    if (this.trayEl) this.openTray();
    if (this.inspecting) this.inspect(this.inspecting);
  }

  /** The Concierge sees her or not: what it says of her things comes and goes with its sight of her. */
  unseenChanged(): void {
    if (this.trayEl) this.openTray();
    if (this.inspecting) this.inspect(this.inspecting);
  }

  /** How many of her things there are in the view on screen. */
  private thingCount(): number {
    return thingsNow(this.items, this.carried, this.hud.raw).filter((t) => !t.ghost).length;
  }

  /** The balls: her things on the left (how many), the verb chosen or the thing in her hand on the right. */
  private draw(): void {
    const raw = this.hud.raw, n = this.thingCount();
    this.thingsBall.innerHTML = `${icon('satchel', 26)}${n ? `<span class="badge">${n}</span>` : ''}`;
    this.thingsBall.setAttribute('aria-expanded', String(this.trayEl !== null));
    const held = this.held ? thingsNow(this.items, [this.held.id], raw)[0] : undefined, verb = this.verb === 'ask' ? null : this.verb;
    this.verbBall.innerHTML = held?.art ? `<img src="${this.hud.assets}/${held.art}" alt="" width="40" height="40" draggable="false">` : icon(verb ?? (held ? 'hands' : 'verbs'), 26);
    this.verbBall.classList.toggle('holding', !!held);
    this.verbBall.setAttribute('aria-pressed', String(verb !== null || this.held !== null));
    this.verbBall.setAttribute('aria-label', this.held ? `${this.held.name}: put it back` : verb ? `${verbName(verb, raw)}: choose another, or put it down` : 'What she can do: look, talk, use, take');
    // with the verbs out, the lit slot names it; put away, what it asks sits beside the ball
    this.verbLabel.hidden = (!verb && !this.held) || this.menu !== null;
    if (this.held) {
      this.verbLabel.replaceChildren();
      el('div', 'verb', this.verbLabel, raw ? `use ${this.held.name.toLowerCase()} on what?` : `Use ${this.held.name} on what?`);
      el('div', 'hint', this.verbLabel, 'Tap it, or slide to find it');
    } else if (verb) {
      this.verbLabel.replaceChildren();
      el('div', 'verb', this.verbLabel, verbQuestion(verb, raw));
      el('div', 'hint', this.verbLabel, 'Tap it, or slide to find it');
    }
  }

  /* ---------- the verbs ---------- */

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
    const hud = this.hud;
    this.closeVerbs();
    this.closeTray();
    hud.closePanel();
    hud.onPanel();
    const ball = this.verbBall, choices = HERS.map((v) => ({ id: v, label: verbName(v, hud.raw), on: v === this.verb }));
    const root = hud.root.getBoundingClientRect(), b = ball.getBoundingClientRect(), slot = b.width / 1.15;
    const menu = (this.menu = el('div', 'hud-menu verbs', hud.root));
    ball.setAttribute('aria-expanded', 'true');
    menu.style.left = `${b.left + b.width / 2 - root.left}px`;
    menu.style.top = `${b.top + b.height / 2 - root.top}px`;
    const made = choices.map((c) => {
      const s = button(`hud-slot${c.on ? ' default' : ''}`, c.label, menu, () => hud.onVerb(c.id === this.verb ? null : c.id));
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
    this.draw();
  }

  closeVerbs(): void {
    const was = this.menu;
    this.menu?.remove();
    this.menu = null;
    this.verbBall.setAttribute('aria-expanded', 'false');
    if (was) this.draw();
  }

  /* ---------- her things ---------- */

  toggleTray(): void {
    if (this.trayEl) this.closeTray();
    else this.openTray();
  }

  /** Her things slide out along the bottom from the left ball. */
  private openTray(): void {
    const hud = this.hud, wasOpen = this.trayEl !== null;
    this.trayEl?.remove();
    if (!wasOpen) { this.closeVerbs(); hud.closePanel(); hud.onPanel(); }
    const root = hud.root.getBoundingClientRect(), b = this.thingsBall.getBoundingClientRect();
    this.trayEl = drawTray(hud.root, thingsNow(this.items, this.carried, hud.raw, !hud.unseen), { x: b.left + b.width / 2 - root.left, y: b.top + b.height / 2 - root.top, r: b.width / 2 }, this.held?.id ?? null, hud.assets, {
      inspect: (id) => (this.inspecting === id ? this.closeInspect() : this.inspect(id)),
    });
    if (wasOpen) this.trayEl.classList.add('still');
    this.draw();
  }

  closeTray(): void {
    if (!this.trayEl) return;
    this.trayEl.remove();
    this.trayEl = null;
    this.closeInspect();
    this.draw();
  }

  /** A thing close up, over the tray. */
  private inspect(id: string): void {
    const hud = this.hud, t = thingsNow(this.items, this.carried, hud.raw, !hud.unseen).find((x) => x.id === id);
    this.inspectEl?.remove();
    this.inspectEl = null;
    this.inspecting = null;
    if (!t) return;
    this.inspecting = id;
    this.inspectEl = drawInspect(hud.root, t, hud.assets, this.held?.id === id, {
      hold: (thing) => { this.closeInspect(); hud.onHold(thing); },
      close: () => this.closeInspect(),
      read: (closeup) => { hud.closeAll(); void hud.readCloseup(closeup); },
    });
    const slot = this.trayEl?.querySelector<HTMLElement>(`[data-item="${id}"]`), root = hud.root.getBoundingClientRect();
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
}
