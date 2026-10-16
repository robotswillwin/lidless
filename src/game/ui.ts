// The words on screen: hotspot names under the pointer, short captions, and the dialogue panel.

import type { Line } from './dialogue';

/** Names shown over a speaker's lines. A speaker tag not listed here shows as itself: woman_in_red as "Woman in red". */
const SPEAKER_NAME: Record<string, string> = { lux: 'Lux', fixer: 'The fixer', concierge: 'The Concierge' };
const speakerName = (id: string) => SPEAKER_NAME[id] ?? id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent.append(e);
  return e;
}

export class UI {
  onChoose: (i: number) => void = () => {};
  onClose: () => void = () => {};
  private hover: HTMLElement;
  private caption: HTMLElement;
  private panel: HTMLElement;
  private linesEl: HTMLElement;
  private choicesEl: HTMLOListElement;
  private captionTimer = 0;
  private choiceCount = 0;

  constructor(private stage: HTMLElement) {
    this.hover = el('div', 'hover', stage);
    this.hover.hidden = true;
    this.caption = el('p', 'caption', stage);
    this.caption.hidden = true;
    this.caption.setAttribute('aria-live', 'polite');
    this.panel = el('section', 'dialogue', stage);
    this.panel.hidden = true;
    this.panel.setAttribute('aria-live', 'polite');
    this.panel.setAttribute('aria-label', 'Conversation');
    this.linesEl = el('div', 'lines', this.panel);
    this.choicesEl = el('ol', 'choices', this.panel);
  }

  get dialogueOpen(): boolean {
    return !this.panel.hidden;
  }

  /** Name of what is under the pointer, next to it. Pass null to hide. */
  showHover(name: string | null, clientX = 0, clientY = 0): void {
    if (!name) {
      this.hover.hidden = true;
      return;
    }
    const r = this.stage.getBoundingClientRect();
    this.hover.textContent = name;
    this.hover.style.left = `${clientX - r.left}px`;
    this.hover.style.top = `${clientY - r.top}px`;
    this.hover.hidden = false;
  }

  showCaption(text: string): void {
    this.caption.textContent = text;
    this.caption.hidden = false;
    window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => (this.caption.hidden = true), 3500 + text.length * 45);
  }

  hideCaption(): void {
    window.clearTimeout(this.captionTimer);
    this.caption.hidden = true;
  }

  /** Show the next block of a conversation. `said` is the choice the player just made, if any. */
  showDialogue(lines: Line[], choices: string[], said?: string): void {
    this.hideCaption();
    this.showHover(null);
    this.linesEl.replaceChildren();
    if (said) el('p', 'line said', this.linesEl).textContent = said;
    let last = '';
    for (const l of lines) {
      // the speaker goes in an attribute, not a class, so a tag can never collide with the panel's own classes
      const p = el('p', 'line', this.linesEl);
      p.dataset.speaker = l.speaker;
      if (l.speaker !== 'narration' && l.speaker !== last) el('span', 'who', p).textContent = speakerName(l.speaker);
      p.append(document.createTextNode(l.text));
      last = l.speaker;
    }
    this.choicesEl.replaceChildren();
    this.choiceCount = choices.length;
    const add = (label: string, onClick: () => void, key?: string) => {
      const li = el('li', '', this.choicesEl), b = el('button', 'choice', li);
      b.type = 'button';
      if (key) el('span', 'key', b).textContent = key;
      b.append(document.createTextNode(label));
      b.addEventListener('click', onClick);
    };
    if (choices.length) choices.forEach((c, i) => add(c, () => this.onChoose(i), String(i + 1)));
    else add('Close', () => this.onClose());
    this.panel.hidden = false;
  }

  closeDialogue(): void {
    this.panel.hidden = true;
  }

  /** Keyboard: number keys pick a choice, Enter or Escape closes a finished conversation. Returns true if handled. */
  key(k: string): boolean {
    if (!this.dialogueOpen) return false;
    const n = Number(k);
    if (this.choiceCount && n >= 1 && n <= this.choiceCount) {
      this.onChoose(n - 1);
      return true;
    }
    if (!this.choiceCount && (k === 'Enter' || k === 'Escape' || k === ' ')) {
      this.onClose();
      return true;
    }
    return false;
  }
}
