// What she found, written at the thing, where her eye already is: above it, or under it when there is no room above,
// kept on screen and clear of the balls. It stays as long as it takes to read, and goes sooner when she is given
// something else to do, or when it is tapped.

import { el } from './dom';
import type { Hud } from './hud';
import { pick, type Hotspot } from './level';

export class Notes {
  private noteEl: HTMLElement | null = null;
  private noteOf: Hotspot | null = null;
  private timer = 0;

  constructor(private readonly hud: Hud) {}

  /** What she found at a thing at `box` (the HUD's pixels): about 15 characters a second, from 2.5 to 9 seconds. */
  note(h: Hotspot, text: string, box: [number, number, number, number]): void {
    this.dismiss();
    const n = (this.noteEl = el('div', 'hud-note', this.hud.root));
    this.noteOf = h;
    n.setAttribute('role', 'status');
    el('div', 'name', n, pick(h.name, this.hud.raw));
    el('p', 'text', n, text);
    n.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.dismiss(); });
    this.place(box);
    this.timer = window.setTimeout(() => this.dismiss(), Math.min(9000, Math.max(2500, 800 + text.length * 66)) * this.hud.noteSpeed);
  }

  /** The thing the note is written at, while there is one. */
  get noteFor(): Hotspot | null { return this.noteOf; }

  /** Where the note goes for a thing at `box`: above it, else under it, on screen and clear of the balls. */
  place(box: [number, number, number, number]): void {
    const n = this.noteEl;
    if (!n) return;
    const root = this.hud.root, W = root.clientWidth, H = root.clientHeight, m = Math.min(34, Math.max(12, W * 0.024)), w = n.offsetWidth, h = n.offsetHeight;
    const [x, y, bw, bh] = box, top = m + 60, bottom = H - m - this.hud.balls.height - 40;
    const above = y - 14 - h, below = y + bh + 14;
    const ny = above >= top ? above : below + h <= bottom ? below : Math.max(top, Math.min(bottom - h, above));
    n.style.left = `${Math.max(m, Math.min(W - m - w, x + bw / 2 - w / 2))}px`;
    n.style.top = `${ny}px`;
  }

  dismiss(): void {
    window.clearTimeout(this.timer);
    this.noteEl?.remove();
    this.noteEl = null;
    this.noteOf = null;
  }
}
