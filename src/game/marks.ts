// What the HUD draws at things in the scene: a marker over each way in and out on screen, so it is plain where she can
// go; and, with a verb chosen, corners around what it lights up under her finger, its name and what the verb does.

import { button, el } from './dom';
import type { Action } from './actions';
import type { Hud } from './hud';
import { icon } from './icons';
import { note, pick, type Hotspot } from './level';

/**
 * A way in or out on screen: a door into a building, or a way off the end of the street. `x`, `y` in the HUD's pixels,
 * over the door's top; a way off the street's end has a fixed place, the bottom corner on its side (CSS), so not used.
 */
export interface Way { id: string; label: string; x: number; y: number; edge: 'in' | 'left' | 'right' }

/** What a chosen verb lights up under her finger: the thing, what the verb does to it, and where it is on screen. */
export interface Mark {
  h: Hotspot;
  a: Action;
  /** x, y, width, height in the HUD's pixels. */
  box: [number, number, number, number];
}

const WAY_GLYPH = {
  in: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 14V2.8h8V14M2.5 14h11M9.6 8.4v.01" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  left: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export class Marks {
  /** The markers over the ways in and out on screen, by hotspot. */
  private readonly wayEls = new Map<string, HTMLButtonElement>();
  private markEl: HTMLElement | null = null;
  private markOf: Hotspot | null = null;

  constructor(private readonly hud: Hud) {}

  /**
   * The ways in and out on screen, each frame: a marker over each door that leads somewhere, and one at the edge of the
   * street for a way off its end; a tap on one takes her there and through. In the Concierge's view they are its light,
   * in raw view her own.
   */
  ways(list: Way[]): void {
    const now = new Set<string>();
    for (const w of list) {
      now.add(w.id);
      let b = this.wayEls.get(w.id);
      if (!b) {
        const id = w.id;
        b = button('hud-way', w.label, this.hud.root, () => this.hud.onWay(id));
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        this.wayEls.set(w.id, b);
      }
      if (b.dataset.edge !== w.edge || b.dataset.label !== w.label) {
        b.dataset.edge = w.edge;
        b.dataset.label = w.label;
        b.replaceChildren();
        if (w.edge !== 'right') b.insertAdjacentHTML('beforeend', WAY_GLYPH[w.edge]);
        el('span', '', b, w.label);
        if (w.edge === 'right') b.insertAdjacentHTML('beforeend', WAY_GLYPH.right);
        b.setAttribute('aria-label', w.edge === 'in' ? `Go in: ${w.label}` : `Go: ${w.label}`);
      }
      b.style.setProperty('--x', `${Math.round(w.x)}px`);
      b.style.setProperty('--y', `${Math.round(w.y)}px`);
    }
    for (const [id, b] of this.wayEls) if (!now.has(id)) { b.remove(); this.wayEls.delete(id); }
  }

  /** What a chosen verb lights up under her finger, or nothing (null): corners around the thing, its name and the verb. */
  mark(m: Mark | null): void {
    if (!m) { this.markEl?.remove(); this.markEl = null; this.markOf = null; return; }
    const raw = this.hud.raw, [x, y, w, h] = m.box;
    if (this.markOf !== m.h || !this.markEl) {
      this.markEl?.remove();
      const box = (this.markEl = el('div', 'hud-mark', this.hud.root));
      this.markOf = m.h;
      box.insertAdjacentHTML('beforeend', '<svg class="frame" aria-hidden="true"><path/></svg>');
      const label = el('div', 'hud-mark-label', box);
      el('div', 'name', label, pick(m.h.name, raw));
      const tag = note(m.h.tag, raw);
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
}
