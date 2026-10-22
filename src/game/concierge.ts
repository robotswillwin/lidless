// The Concierge, in its own view: the city's AI in her eye, made of light where everything of hers is glass. Its mark,
// a ring of light with a gap (the C on its stations), turns as it speaks and ripples as it listens. At the top left its
// presence greets her with what it keeps of her: her heart, her credits. Tapped, the presence opens into its card: its
// words for where she is, what she has to do (her journal's objectives: it reads her journal), its readouts of her, and
// talking to it, or asking it about something. Talking is a conversation in the card, its lines on the left in its
// voice, hers on the right, her answers under them. Its messages come as words under its presence. In a privacy zone it
// cannot hear her. Raw view has no Concierge: none of this is there.

import type { Command, Line } from './dialogue';
import { button, el } from './dom';
import { icon } from './icons';

/** Something she has to do, from her journal: its name and its first line. */
export interface Reminder { name: string; text: string }
/** What it keeps of her: her credits, her heart (beats a minute), whether she is nourished; null where it has none. */
export interface Readouts { credits: number | null; heart: number | null; nourished: boolean | null }

type Say = { label: string; primary?: boolean; run?: () => void };

let marks = 0;
/** Its mark: a ring of light with a gap on the right, the C on its stations; a ripple under it for listening. */
function orb(): string {
  const id = `co-light-${++marks}`;
  return `<svg class="co-orb" viewBox="0 0 40 40" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">`
    + '<stop offset="0" stop-color="#8ff0ea"/><stop offset="1" stop-color="#b7a8ff"/></linearGradient></defs>'
    + '<circle class="ripple" cx="20" cy="20" r="13.5"/><circle class="core" cx="20" cy="20" r="9"/>'
    + `<path class="ring" d="M31.2 12.45A13.5 13.5 0 1 0 31.2 27.55" stroke="url(#${id})"/></svg>`;
}

/** Its readouts' marks: her pulse, her credits, her nourishment. */
const MARK = {
  heart: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 8.5h3l1.5-3.5 2.5 7 2-5 1 1.5h3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  credits: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M9.8 6.2a2.4 2.4 0 1 0 0 3.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  nourished: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.2c2.3 3 3.8 5 3.8 7a3.8 3.8 0 0 1-7.6 0c0-2 1.5-4 3.8-7z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
};

/** How long it takes to say a line, its mark turning: quick, as a thing that thinks faster than she reads. */
const sayTime = (text: string) => Math.min(1100, 380 + text.length * 7);

export class Concierge {
  /** Its presence tapped: open its card (the game fills it), or, listening, put the question down. */
  onTap: () => void = () => {};
  /** Talk, in its card. */
  onTalk: () => void = () => {};
  /** Ask about something, in its card: it listens for her to tap a thing. */
  onAsk: () => void = () => {};
  /** Her answer number i, in a conversation with it. */
  onChoose: (i: number) => void = () => {};
  /** A conversation with it is over: said through, or its card closed on it. */
  onEnd: () => void = () => {};
  /** What a line has the game do before it is said: the conversation waits for it. */
  run: (commands: Command[]) => Promise<void> = async () => {};
  /** How long its words stay, times the normal (the text speed setting). */
  speed = 1;
  readonly layer: HTMLElement;

  private readonly box: HTMLElement;
  private readonly head: HTMLButtonElement;
  private readonly greet: HTMLElement;
  private readonly status: HTMLElement;
  private readonly mini: HTMLElement;
  private card: HTMLElement | null = null;
  private body: HTMLElement | null = null;
  private foot: HTMLElement | null = null;
  private thread: HTMLElement | null = null;
  private sayEl: HTMLElement | null = null;
  private sayTimer = 0;
  private said: [string, string] = ['', ''];
  private listening = false;
  private readouts: Readouts = { credits: null, heart: null, nourished: null };
  private shown = '';
  /** In a conversation with it: lines still to say, and her answers after them. */
  private queue: Line[] = [];
  private choices: string[] = [];
  private conversing = false;
  private saying = 0;
  /** Out of its hearing (a privacy zone): no talking to it, no asking. */
  private unheard = false;

  constructor(root: HTMLElement) {
    this.layer = el('div', 'co-layer', root);
    this.box = el('section', 'co beckon', this.layer);
    this.box.dataset.state = 'idle';
    this.box.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.head = button('co-head', 'The Concierge', this.box, () => { this.box.classList.remove('beckon'); this.onTap(); });
    this.head.insertAdjacentHTML('beforeend', orb());
    const words = el('span', 'words', this.head);
    this.greet = el('span', 'greet', words);
    this.status = el('span', 'status', words);
    this.mini = el('span', 'mini', this.head);
    this.drawHead();
  }

  /** Its greeting and its line of the day. */
  setStatus(greeting: string, status: string): void {
    this.said = [greeting, status];
    this.drawHead();
  }

  /** What it keeps of her, shown on its presence (her heart, her credits) and in its card. */
  setReadouts(r: Readouts): void {
    const key = `${r.credits}|${r.heart}|${r.nourished}`;
    this.readouts = r;
    if (key === this.shown) return;
    this.shown = key;
    this.mini.innerHTML = [
      r.heart !== null ? `<span class="heart" title="Heart">${MARK.heart}${r.heart}</span>` : '',
      r.credits !== null ? `<span class="credits" title="Credits">${MARK.credits}${r.credits.toLocaleString('en-GB')}</span>` : '',
    ].join('');
    const card = this.card?.querySelector('.co-readouts');
    if (card) this.drawReadouts(card as HTMLElement);
  }

  /** Asked about something: it listens, saying what it asks, until she taps a thing or its presence. */
  setListening(on: boolean): void {
    this.listening = on;
    if (on) this.close();
    this.drawHead();
  }

  get isOpen(): boolean { return this.card !== null; }
  /** In a conversation with it. */
  get talking(): boolean { return this.conversing; }

  /**
   * Its card, opened from its presence: its words for where she is, what she has to do, its readouts, and talking to it
   * or asking it about something; where it cannot hear her (`unheard`), it says so in their place.
   */
  open(o: { words: string; reminders: Reminder[]; unheard: boolean }): void {
    this.dismiss();
    this.unheard = o.unheard;
    this.drawCard();
    const body = this.body!;
    el('p', 'co-words', body, o.words);
    if (o.reminders.length) {
      const list = el('ul', 'co-reminders', body);
      list.setAttribute('aria-label', 'What you have to do');
      for (const r of o.reminders) { const li = el('li', '', list); el('span', 'name', li, r.name); if (r.text) el('span', 'text', li, r.text); }
    }
    this.drawReadouts(el('div', 'co-readouts', body));
    this.drawActions();
  }

  /** Its card closed: a conversation in it is over. */
  close(): void {
    if (!this.card) return;
    window.clearTimeout(this.saying);
    this.card.remove();
    this.card = this.body = this.foot = this.thread = null;
    delete this.box.dataset.open;
    this.head.setAttribute('aria-expanded', 'false');
    this.queue = [];
    this.choices = [];
    delete this.box.dataset.talking;
    this.drawHead();
    if (this.conversing) { this.conversing = false; this.onEnd(); }
  }

  /** A message from it, under its presence (in its card, if that is open), with what she can answer, for a while. */
  say(text: string, actions: Say[] = [], ms = 7000): void {
    if (this.card && !this.conversing) {
      const words = this.body?.querySelector('.co-words');
      if (words) { words.textContent = text; return; }
    }
    this.dismiss();
    const s = (this.sayEl = el('div', 'co-say', this.layer));
    s.setAttribute('role', 'status');
    s.addEventListener('pointerdown', (e) => e.stopPropagation());
    el('p', '', s, text);
    if (actions.length) {
      const row = el('div', 'row', s);
      for (const a of actions) button(a.primary ? 'primary' : '', a.label, row, () => { this.dismiss(); a.run?.(); }).textContent = a.label;
    }
    this.box.dataset.state = 'speaking';
    window.setTimeout(() => this.setState(), sayTime(text));
    this.sayTimer = window.setTimeout(() => this.dismiss(), ms * this.speed);
  }

  dismiss(): void {
    window.clearTimeout(this.sayTimer);
    this.sayEl?.remove();
    this.sayEl = null;
  }

  /**
   * A conversation with it, in its card: the lines it has to say (and hers, and what the game does on the way), then her
   * answers; `said` is the answer she just gave, said first.
   */
  converse(lines: Line[], choices: string[], said?: string): void {
    if (!this.card) { this.drawCard(); this.box.dataset.talking = ''; }
    if (!this.thread) {
      this.body!.replaceChildren();
      this.thread = el('div', 'co-thread', this.body!);
      this.thread.setAttribute('aria-live', 'polite');
    }
    this.conversing = true;
    this.foot!.replaceChildren();
    if (said) this.message('luna', said);
    this.queue = [...lines];
    this.choices = choices;
    this.next();
  }

  /** Number keys pick her answer; Escape closes its card. Returns true if it used the key. */
  key(k: string): boolean {
    if (!this.card) return false;
    if (k === 'Escape') { this.close(); return true; }
    const n = Number(k), picks = this.foot?.querySelectorAll<HTMLButtonElement>('.co-choices button') ?? [];
    if (n >= 1 && n <= picks.length) { picks[n - 1].click(); return true; }
    return false;
  }

  /* ---------- drawing ---------- */

  private drawHead(): void {
    const [greeting, status] = this.listening ? ['About what, Luna?', 'Tap it, or slide to find it'] : this.said;
    if (this.greet.textContent !== greeting) this.greet.textContent = greeting;
    if (this.status.textContent !== status) this.status.textContent = status;
    this.head.setAttribute('aria-label', this.listening ? 'The Concierge is listening: tap what to ask about, or here to put the question down' : this.card ? 'Close the Concierge' : 'The Concierge: open');
    this.setState();
  }

  /** Its mark: listening, speaking (a conversation going, a line on its way), or at rest. */
  private setState(): void {
    this.box.dataset.state = this.listening ? 'listening' : this.saying && this.conversing ? 'speaking' : 'idle';
    this.box.classList.toggle('listening', this.listening);
  }

  private drawCard(): void {
    this.card?.remove();
    this.box.dataset.open = '';
    this.head.setAttribute('aria-expanded', 'true');
    const card = (this.card = el('div', 'co-card', this.box));
    button('co-close', 'Close', card, () => this.close()).innerHTML = icon('close', 16);
    this.body = el('div', 'co-body', card);
    this.foot = el('div', 'co-foot', card);
    this.thread = null;
    this.drawHead();
  }

  private drawReadouts(box: HTMLElement): void {
    const r = this.readouts, parts: string[] = [];
    if (r.heart !== null) parts.push(`<span>${MARK.heart}<b>${r.heart}</b> bpm</span>`);
    if (r.credits !== null) parts.push(`<span>${MARK.credits}<b>${r.credits.toLocaleString('en-GB')}</b> credits</span>`);
    if (r.nourished !== null) parts.push(`<span>${MARK.nourished}${r.nourished ? 'Nourished' : 'Nutrition due'}</span>`);
    box.innerHTML = parts.join('');
  }

  /** What she can do in its card: talk to it, ask it about something; where it cannot hear her, it says so. */
  private drawActions(): void {
    const foot = this.foot!;
    foot.replaceChildren();
    if (this.unheard) { el('p', 'quiet', foot, 'It cannot hear you in here.'); return; }
    button('primary', 'Talk to the Concierge', foot, () => this.onTalk()).textContent = 'Talk';
    button('', 'Ask about something', foot, () => this.onAsk()).textContent = 'Ask about something';
  }

  /**
   * A line in the conversation: its on the left in its voice (the story's quotation marks off: the card says who
   * speaks), hers on the right, what is narrated between.
   */
  private message(speaker: string, text: string): void {
    const who = speaker === 'concierge' ? 'its' : speaker === 'luna' ? 'hers' : speaker === 'narration' ? 'narration' : 'other';
    const m = el('p', `msg ${who}`, this.thread!);
    if (who === 'other') el('span', 'who', m, speaker);
    m.append(document.createTextNode(who === 'its' ? text.replace(/^["“](.*)["”]$/s, '$1') : text));
    this.thread!.parentElement!.scrollTop = this.thread!.parentElement!.scrollHeight;
  }

  /** On to the next line: its own after a moment, its mark turning; what the game does, waited for; then her answers. */
  private next(): void {
    if (!this.conversing || !this.thread) return;
    const l = this.queue.shift();
    if (!l) return this.answers();
    if (l.commands?.length) {
      void this.run(l.commands).catch(() => {}).then(() => {
        if (l.text) this.queue.unshift({ text: l.text, speaker: l.speaker });
        this.next();
      });
      return;
    }
    if (l.speaker !== 'concierge') { this.message(l.speaker, l.text); return this.next(); }
    const typing = el('p', 'typing', this.thread);
    typing.innerHTML = '<i></i><i></i><i></i>';
    this.saying = window.setTimeout(() => {
      this.saying = 0;
      typing.remove();
      if (!this.thread) return;
      this.message('concierge', l.text);
      this.setState();
      this.next();
    }, sayTime(l.text) * Math.min(1, this.speed));
    this.setState();
  }

  /** Her answers under the conversation; with none, it is over, and its card offers talking or asking again. */
  private answers(): void {
    const foot = this.foot!;
    foot.replaceChildren();
    if (!this.choices.length) {
      this.conversing = false;
      delete this.box.dataset.talking;
      this.drawActions();
      this.onEnd();
      return;
    }
    const list = el('ol', 'co-choices', foot);
    list.setAttribute('aria-label', 'What she can say');
    this.choices.forEach((c, i) => {
      const b = button('', c, el('li', '', list), () => { foot.replaceChildren(); this.onChoose(i); });
      el('span', 'key', b, String(i + 1));
      b.append(document.createTextNode(c));
    });
    this.thread!.parentElement!.scrollTop = this.thread!.parentElement!.scrollHeight;
  }
}
