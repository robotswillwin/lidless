// Conversations as Monkey Island has them: each line over the head of whoever says it, in their colour, one at a time,
// for as long as it takes to read, and a tap, a click, Space or Enter moves on sooner. What is narrated is a quiet line
// at the top. Her answers are a list along the bottom to pick from, and the one she picks she says over her head.
// Her lines written in quotes she says aloud; without quotes they are her thoughts, shown softer and in italics. An
// answer she picks is always said. Everyone else's lines are speech (the story writes them in quotes).

import type { Command, Line } from './dialogue';

/** Where a speaker's lines go: the point over their head, in the HUD's pixels; null for the top, where narration is. */
export type SpeakerAt = (speaker: string) => [number, number] | null;

/** Each voice's colour: hers, the fixer's warm one, the Concierge's cyan (and its machines'); anyone else's their own. */
const VOICE: Record<string, string> = { luna: 'luna', fixer: 'warm', concierge: 'co', station: 'co', guardian: 'co', tap: 'co', lift: 'co', door: 'co', narration: 'narration' };

/** A line written in quotes is said aloud; one of hers without is a thought. */
const QUOTED = /^["\u201c\u201d\u2018\u2019']/;
/** Straight quotes around a line become typographic ones. */
const curly = (text: string): string => text.replace(/^"/, '\u201c').replace(/"$/, '\u201d');

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
  /** What a line has the game do before it is said (she walks, changes, a fade): the conversation waits for it. */
  run: (commands: Command[]) => Promise<void> = async () => {};
  /**
   * The Concierge's lines come from its presence: its bubble dropping from its header, when its view is on. Given a
   * line and how long it stays, true when it took it; false (raw view: no Concierge on screen) and the line shows as
   * any other, at the top.
   */
  viaCard: (text: string, ms: number) => boolean = () => false;
  /** Its bubble put away: the line has moved on. */
  cardDone: () => void = () => {};
  /** The line on screen is in the Concierge's bubble, not over a head. */
  private inCard = false;
  open = false;
  /** How long lines stay, times the normal (the text speed setting). */
  speed = 1;

  private queue: Line[] = [];
  /** A line's commands are being done: nothing moves on until they are. */
  private directing = false;
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
    this.queue = [...(said ? [{ text: said, speaker: 'luna', spoken: true }] : []), ...lines];
    this.choices = choices;
    this.list.hidden = true;
    this.next();
  }

  /** On to the next line; after the last one her answers, or, with none, the end. */
  next(): void {
    window.clearTimeout(this.timer);
    if (this.directing) return;
    const l = this.queue.shift();
    // the Concierge's fold stays out for another line of its own (it takes the new words); anything else puts it away
    const toCard = !!l && !l.commands?.length && l.speaker === 'concierge';
    if (this.inCard && !toCard) { this.inCard = false; this.cardDone(); }
    if (l?.commands?.length) {
      // what the line has the game do first, nothing said meanwhile; then its words, if it has any
      this.directing = true;
      this.current = null;
      this.line.hidden = true;
      this.skip.hidden = true;
      void this.run(l.commands).catch(() => {}).then(() => {
        this.directing = false;
        if (!this.open) return;
        if (l.text) this.queue.unshift({ text: l.text, speaker: l.speaker, ...(l.spoken ? { spoken: true } : {}) });
        this.next();
      });
      return;
    }
    if (l) {
      this.current = l;
      const stays = readingTime(l.text) * this.speed;
      // the Concierge speaks from its presence, when it has one on screen
      if (l.speaker === 'concierge' && this.viaCard(l.text, stays + 600)) {
        this.inCard = true;
        this.line.hidden = true;
        this.skip.hidden = false;
        this.timer = window.setTimeout(() => this.next(), stays);
        return;
      }
      const thought = l.speaker === 'luna' && !l.spoken && !QUOTED.test(l.text);
      this.line.textContent = thought ? l.text : curly(l.text);
      this.line.dataset.voice = VOICE[l.speaker] ?? 'other';
      this.line.dataset.mode = thought ? 'thought' : 'said';
      this.line.hidden = false;
      this.skip.hidden = false;
      this.place();
      this.timer = window.setTimeout(() => this.next(), readingTime(l.text) * this.speed);
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
    if (this.inCard) { this.inCard = false; this.cardDone(); }
    this.open = false;
    this.directing = false;
    this.current = null;
    this.queue = [];
    this.line.hidden = true;
    this.list.hidden = true;
    // answers put away are gone: none is left to pick from a list no longer there
    this.list.replaceChildren();
    this.skip.hidden = true;
  }

  private showChoices(): void {
    this.list.replaceChildren();
    this.choices.forEach((c, i) => {
      const b = el('button', 'talk-choice', el('li', '', this.list));
      b.type = 'button';
      b.dataset.cue = 'choose';
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
