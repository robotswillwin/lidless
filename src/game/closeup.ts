// A moment shown up close over the dimmed scene (her waking, her wrist in the station's cuff), as the view on screen has
// it; and a paper read there, which stays until she puts it down. A paper's words are the close-up's own
// (closeups.json), set over the blank paper in her hand or in type, never drawn into the picture.

import { el } from './dom';
import type { Hud } from './hud';

/**
 * A close-up's own settings (closeups.json): its words, set over its blank paper in her handwriting (`hand`) or in type,
 * within `area` (x, y, w, h, as parts of the picture), tilted `tilt` degrees, `size` times the picture's width; and
 * whether it fills the dark (`dark`: her waking).
 */
export interface CloseupDef { text?: string; hand?: boolean; area?: [number, number, number, number]; tilt?: number; size?: number; dark?: boolean }

export class Closeups {
  /** The close-up over the scene, and which: its picture follows the view. */
  private box: HTMLElement | null = null;
  private name: string | null = null;
  private fit: ResizeObserver | null = null;
  /** A paper being read: puts it down (read). */
  private putDown: (() => void) | null = null;

  constructor(private readonly hud: Hud) {}

  /** Whether a close-up is over the scene: lines are said at the top then, clear of it. */
  get open(): boolean { return this.name !== null; }

  /**
   * A close-up over the dimmed scene (`closeups/<name>.concierge.webp`, `.raw.webp`); null takes it away. Resolves once
   * its picture is there. A close-up `dark` fills the dark (her waking).
   */
  show(name: string | null): Promise<void> {
    const hud = this.hud, was = this.box;
    this.name = name;
    this.fit?.disconnect();
    // a paper being read is put down with it
    this.putDown?.();
    if (!name) {
      if (was) { was.classList.add('out'); window.setTimeout(() => was.remove(), 260); }
      this.box = null;
      return Promise.resolve();
    }
    const def = hud.closeups[name] ?? {};
    const box = el('div', `hud-closeup${def.dark ? ' dark' : ''}`, hud.root), frame = el('div', 'frame', box), img = el('img', '', frame);
    img.alt = def.text ?? '';
    img.src = this.picture(name);
    if (def.text) {
      const [x, y, w, h] = def.area ?? [0.2, 0.17, 0.6, 0.66];
      const words = el('div', `words ${def.hand ? 'hand' : 'typed'}`, frame);
      // in a hand, each line a little its own: not quite level, not quite where the last began
      def.text.split('\n').forEach((line, i) => {
        const l = el('span', 'ln', words, line || ' ');
        if (def.hand) l.style.transform = `translateX(${((i * 37) % 5) * 0.8}%) rotate(${(((i * 53) % 9) - 4) * 0.18}deg)`;
      });
      Object.assign(words.style, { left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%`, transform: def.tilt ? `rotate(${def.tilt}deg)` : '' });
      words.setAttribute('aria-hidden', 'true');
      // its size follows the paper's on screen
      const fit = () => { words.style.fontSize = `${img.clientWidth * (def.size ?? (def.hand ? 0.036 : 0.03))}px`; };
      this.fit = new ResizeObserver(fit);
      this.fit.observe(img);
    }
    if (was) { box.classList.add('still'); was.remove(); }
    this.box = box;
    return img.decode().catch(() => {});
  }

  /**
   * A paper close up, read: it stays until she puts it down (a tap, or Space, Enter or Escape), and only then does the
   * conversation go on. Resolves once it is put down.
   */
  read(name: string): Promise<void> {
    return new Promise((done) => {
      void this.show(name).then(() => {
        const box = this.box;
        if (!box || this.name !== name) return done();
        box.classList.add('reading');
        const hint = el('p', 'put-down', box, 'Tap to put it down');
        hint.setAttribute('role', 'status');
        let over = false;
        const end = () => {
          if (over) return;
          over = true;
          this.putDown = null;
          box.removeEventListener('pointerdown', tap);
          document.removeEventListener('keydown', key, true);
          if (this.box === box) void this.show(null);
          done();
        };
        const tap = (e: Event) => { e.preventDefault(); e.stopPropagation(); end(); };
        const key = (e: KeyboardEvent) => { if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); end(); } };
        box.addEventListener('pointerdown', tap);
        document.addEventListener('keydown', key, true);
        this.putDown = end;
      });
    });
  }

  /** The view switched: the picture on screen is the other view's. */
  viewChanged(): void {
    const img = this.box?.querySelector('img');
    if (this.name && img) img.src = this.picture(this.name);
  }

  private picture(name: string): string {
    return `${this.hud.assets}/closeups/${name}.${this.hud.raw ? 'raw' : 'concierge'}.webp`;
  }
}
