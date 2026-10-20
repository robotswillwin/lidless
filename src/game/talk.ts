// Conversations as Monkey Island has them: each line over the head of whoever says it, in their colour, one at a time,
// for as long as it takes to read, and a tap, a click, Space or Enter moves on sooner. What is narrated is a quiet line
// at the top. Her answers are a list along the bottom to pick from, and the one she picks she says over her head.

import type { Line } from './dialogue';

/** Where a speaker's lines go: the point over their head, in the HUD's pixels; null for the top, where narration is. */
export type SpeakerAt = (speaker: string) => [number, number] | null;

/** Each voice's colour: hers, the fixer's warm one, the Concierge's cyan; anyone else's their own. */
const VOICE: Record<string, string> = { luna: 'luna', fixer: 'warm', concierge: 'co', narration: 'narration' };

/** How long a line stays: about 16 characters a second to read it, from 1.8 to 8 seconds. */
export const readingTime = (text: string): number => Math.min(8000, Math.max(1800, 700 + text.length * 60));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent.append(e);
  return e;
}

export class Talk {
  /** She picked her answer number i. */
  onChoose: (i: number) => void = () => {};
  /** The conversation is over: its last line has been said and there is nothing left to answer. */
  onEnd: () => void = () => {};
  open = false;

  private queue: Line[] = [];
  private choices: string[] = [];
  private current: Line | null = null;
  private timer = 0;
  private readonly skip: HTMLElement;
  private readonly line: HTMLElement;
  private readonly list: HTMLOListElement;

  constructor(private readonly root: HTMLElement, private readonly at: SpeakerAt) {
    // while a line is said, a tap anywhere moves on
    this.skip = el('div', 'talk-skip', root);
    this.skip.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); this.next(); });
    this.line = el('div', 'talk-line', root);
    this.line.setAttribute('aria-live', 'polite');
    this.list = el('ol', 'talk-choices', root);
    this.list.setAttribute('aria-label', 'What she can say');
    this.hide();
  }

  /** The next lines of the conversation and the answers after them; `said` is the answer she just gave, said first. */
  show(lines: Line[], choices: string[], said?: string): void {
    this.open = true;
    this.queue = [...(said ? [{ text: said, speaker: 'luna' }] : []), ...lines];
    this.choices = choices;
    this.list.hidden = true;
    this.next();
  }

  /** On to the next line; after the last one her answers, or, with none, the end. */
  next(): void {
    window.clearTimeout(this.timer);
    const l = this.queue.shift();
    if (l) {
      this.current = l;
      this.line.textContent = l.text;
      this.line.dataset.voice = VOICE[l.speaker] ?? 'other';
      this.line.hidden = false;
      this.skip.hidden = false;
      this.place();
      this.timer = window.setTimeout(() => this.next(), readingTime(l.text));
      return;
    }
    this.current = null;
    this.line.hidden = true;
    this.skip.hidden = true;
    if (this.choices.length) this.showChoices();
    else { this.hide(); this.onEnd(); }
  }

  /** Each frame: the line stays over its speaker as they, and the camera, move. */
  place(): void {
    const l = this.current;
    if (!l) return;
    const p = this.at(l.speaker), W = this.root.clientWidth, w = this.line.offsetWidth, h = this.line.offsetHeight, m = 12;
    if (!p) {
      this.line.classList.add('top');
      this.line.style.left = `${(W - w) / 2}px`;
      this.line.style.top = '';
      return;
    }
    this.line.classList.remove('top');
    this.line.style.left = `${Math.max(m, Math.min(W - m - w, p[0] - w / 2))}px`;
    this.line.style.top = `${Math.max(m, p[1] - h)}px`;
  }

  /** Number keys pick an answer; Space, Enter or Escape move on from a line. Returns true if it used the key. */
  key(k: string): boolean {
    if (!this.open) return false;
    const n = Number(k);
    if (!this.list.hidden && n >= 1 && n <= this.choices.length) { this.pick(n - 1); return true; }
    if (this.current && (k === ' ' || k === 'Enter' || k === 'Escape')) { this.next(); return true; }
    return false;
  }

  /** Puts the conversation away without its end: she left the scene. */
  hide(): void {
    window.clearTimeout(this.timer);
    this.open = false;
    this.current = null;
    this.queue = [];
    this.line.hidden = true;
    this.list.hidden = true;
    this.skip.hidden = true;
  }

  private showChoices(): void {
    this.list.replaceChildren();
    this.choices.forEach((c, i) => {
      const b = el('button', 'talk-choice', el('li', '', this.list));
      b.type = 'button';
      el('span', 'key', b).textContent = String(i + 1);
      b.append(document.createTextNode(c));
      b.addEventListener('click', (e) => { e.stopPropagation(); this.pick(i); });
    });
    this.list.hidden = false;
  }

  private pick(i: number): void {
    this.list.hidden = true;
    this.onChoose(i);
  }
}
