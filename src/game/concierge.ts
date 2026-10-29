// The Concierge, in its own view: the city's AI in her eye, made of light where everything of hers is glass. Its mark,
// a ring of light with a gap (the C on its stations), turns as it speaks and ripples as it listens. At the top left its
// presence greets her with what it keeps of her: her heart, her credits. Tapped, the presence opens into its card: its
// words for where she is, what she has to do (her journal's objectives: it reads her journal), its readouts of her, and
// talking to it, or asking it about something. Talking is a conversation in the card, its lines on the left in its
// voice, hers on the right, her answers under them. Its messages come as words under its presence; hers, through
// CO-net, wait in its card, a dot on its presence for each she has not read. In a privacy location it cannot hear her,
// and its privacy sign says so under its presence: the closed eye, which opens while she calls it from a home (the only
// place she can call it from) and closes when the call ends. Raw view has no Concierge: none of this is there.

import type { Command, Line } from './dialogue';
import { button, el } from './dom';
import { eyePaths } from './eye';
import { icon } from './icons';
import type { Inbox } from './messages';
import { sounds } from './sound';

/** Something she has to do, from her journal: its name and its first line. */
export interface Reminder { name: string; text: string }
/**
 * What it keeps of her: her credits, her heart (beats a minute), whether she has fed lately, her connection level; null
 * where it has none. Her nutrition is only ever good or, after a station, optimal: nothing she has to plan for or keep
 * track of.
 */
export interface Readouts { credits: number | null; heart: number | null; nourished: boolean | null; level: number | null }

/** The connection levels, 0 to 5, as the director's concept sheet names them (decision 18). */
export const LEVELS = ['Unregistered', 'Basic Care', 'Enhanced Care', 'Integrated Care', 'Deep Integration', 'Full Integration'];

type Say = { label: string; primary?: boolean; run?: () => void };

/** Its privacy sign where she is: none where it watches; shut in a privacy location; open on a call (or an emergency). */
export type Privacy = 'shut' | 'open' | null;

/** The privacy sign: the closed eye in its ring, as the loading eye starts (eye.ts), open with its red pupil on a call. */
function signSvg(id: string): string {
  return `<svg class="co-sign-eye" viewBox="-44 -44 88 88" aria-hidden="true"><defs><clipPath id="${id}"><path class="opening"/></clipPath></defs>`
    + '<circle class="ring" r="38"/><g transform="translate(0 -5)"><path class="lashes"/>'
    + `<g clip-path="url(#${id})"><rect x="-34" y="-15" width="68" height="30" class="ball"/><circle class="pupil" r="0"/></g>`
    + '<path class="lid" d="M-34 0Q0 30 34 0"/><path class="lid upper"/></g></svg>';
}

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
  level: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M12.6 5A5.4 5.4 0 1 0 12.6 11" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/></svg>',
};

/** How long it takes to say a line, its mark turning: quick, as a thing that thinks faster than she reads. */
const sayTime = (text: string) => Math.min(1100, 380 + text.length * 7);

/**
 * Its words into `p` as it says them: each a moment after the one before, out of a blur, as if spoken; the text the
 * same to read and to copy. With less motion, all at once.
 */
function spoken(p: HTMLElement, text: string): void {
  if (document.documentElement.dataset.motion === 'reduced') { p.append(text); return; }
  let i = 0;
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { p.append(part); continue; }
    const w = document.createElement('span');
    w.className = 'w';
    w.style.setProperty('--i', String(i++));
    w.textContent = part;
    p.append(w);
  }
}

export class Concierge {
  /** Its presence tapped: open its card (the game fills it), or, listening, put the question down. */
  onTap: () => void = () => {};
  /** Talk, in its card. */
  onTalk: () => void = () => {};
  /** Ask about something, in its card: it listens for her to tap a thing. */
  onAsk: () => void = () => {};
  /** Her answer number i, in a conversation with it. */
  onChoose: (i: number) => void = () => {};
  /** Calling it, in its card, from a home. */
  onCall: () => void = () => {};
  /** A message of hers opened in its card. */
  onRead: (id: string) => void = () => {};
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
  /** The card's own words, to come back once a line of the moment said in the card is done. */
  private cardWords = '';
  private wordsSwapped = false;
  private said: [string, string] = ['', ''];
  private listening = false;
  private readouts: Readouts = { credits: null, heart: null, nourished: null, level: null };
  private shown = '';
  /** In a conversation with it: lines still to say, and her answers after them. */
  private queue: Line[] = [];
  private choices: string[] = [];
  private conversing = false;
  private saying = 0;
  /** Out of its hearing (a privacy zone): no talking to it, no asking; from a home, calling it. */
  private unheard = false;
  private canCall = false;
  private readonly unreadEl: HTMLElement;
  private readonly sign: HTMLElement;
  private privacy: Privacy = null;
  private lid = 1;
  private lidRaf = 0;

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
    this.unreadEl = el('span', 'co-unread', this.head);
    this.unreadEl.hidden = true;
    this.sign = el('div', 'co-sign', this.layer);
    this.sign.setAttribute('role', 'status');
    this.sign.innerHTML = signSvg(`co-sign-${++marks}`) + '<span class="label"></span>';
    this.sign.hidden = true;
    this.drawSign();
    this.drawHead();
  }

  /**
   * Whether it hears her where she is (`unheard`: a privacy location), and whether she can call it from here: what its
   * card offers once a conversation in it is over.
   */
  setHearing(unheard: boolean, call: boolean): void {
    this.unheard = unheard;
    this.canCall = call;
  }

  /** Her unread messages, as a dot with their number on its presence. */
  setUnread(n: number): void {
    const text = n > 0 ? String(n) : '';
    if (this.unreadEl.textContent === text) return;
    this.unreadEl.textContent = text;
    this.unreadEl.hidden = !n;
    this.unreadEl.setAttribute('aria-label', n ? `${n} unread message${n > 1 ? 's' : ''}` : '');
  }

  /**
   * Its privacy sign: shown in a privacy location, the closed eye; on a call it opens, its red pupil kindled, and shuts
   * again when the call ends. `still` (less motion) turns it at once.
   */
  setPrivacy(p: Privacy, still = false): void {
    if (p === this.privacy) return;
    const was = this.privacy;
    this.privacy = p;
    this.sign.hidden = p === null;
    this.sign.dataset.state = p ?? '';
    const label = this.sign.querySelector('.label')!;
    label.textContent = p === 'open' ? 'Call open' : 'Private';
    this.sign.setAttribute('aria-label', p === 'open' ? 'Privacy: the Concierge hears you while you call' : 'Privacy: the Concierge cannot see or hear you here');
    const to = p === 'open' ? -1 : 1;
    cancelAnimationFrame(this.lidRaf);
    if (still || was === null || p === null) { this.lid = to; this.drawSign(); return; }
    const from = this.lid, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 520), e = k * k * (3 - 2 * k);
      this.lid = from + (to - from) * e;
      this.drawSign();
      if (k < 1) this.lidRaf = requestAnimationFrame(step);
    };
    this.lidRaf = requestAnimationFrame(step);
  }

  private drawSign(): void {
    const p = eyePaths(this.lid), q = (c: string) => this.sign.querySelector<SVGElement>(`.${c}`);
    q('opening')?.setAttribute('d', p.opening);
    q('lashes')?.setAttribute('d', p.lashes);
    q('upper')?.setAttribute('d', p.upper);
    q('pupil')?.setAttribute('r', String(Math.round(Math.max(0, -this.lid) * 55) / 10));
  }

  /** Its greeting and its line of the day. */
  setStatus(greeting: string, status: string): void {
    this.said = [greeting, status];
    this.drawHead();
  }

  /** What it keeps of her, shown on its presence (her heart, her credits) and in its card. */
  setReadouts(r: Readouts): void {
    const key = `${r.credits}|${r.heart}|${r.nourished}|${r.level}`;
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
    // asked about something, it listens, rising
    if (on && !this.listening) sounds.play('co-ask');
    this.listening = on;
    if (on) this.close();
    this.drawHead();
  }

  get isOpen(): boolean { return this.card !== null; }
  /** In a conversation with it. */
  get talking(): boolean { return this.conversing; }

  /**
   * Its card, opened from its presence: its words for where she is, her messages, what she has to do, its readouts, and
   * talking to it or asking it about something; where it cannot hear her (`unheard`), it says so in their place, and
   * from a home (`call`) she can call it.
   */
  open(o: { words: string; reminders: Reminder[]; unheard: boolean; inbox?: Inbox[]; call?: boolean }): void {
    this.dismiss(); // a line folded out gives way to the card, which has its own words
    this.cardWords = o.words;
    this.unheard = o.unheard;
    this.canCall = !!o.call;
    this.drawCard();
    sounds.play('co-open');
    const body = this.body!;
    spoken(el('p', 'co-words', body), o.words);
    if (o.inbox?.length) this.drawInbox(el('ul', 'co-inbox', body), o.inbox);
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
      // said in the open card: its words give way to the line, and come back when it is done
      const words = this.body?.querySelector<HTMLElement>('.co-words');
      if (words) {
        window.clearTimeout(this.sayTimer);
        words.replaceChildren();
        spoken(words, text);
        this.wordsSwapped = true;
        this.sayTimer = window.setTimeout(() => this.dismiss(), ms * this.speed);
        return;
      }
    }
    window.clearTimeout(this.sayTimer);
    sounds.play('co-message');
    // its box folds out under its header with the line written in it; a fold already out takes the new line
    let fold = this.sayEl;
    if (!fold || fold.classList.contains('out')) {
      fold = this.sayEl = el('div', 'co-fold', this.box);
      fold.setAttribute('role', 'status');
      fold.addEventListener('pointerdown', (e) => e.stopPropagation());
      el('div', '', fold);
      void fold.offsetHeight; // laid out folded first, so the fold-out is seen
      fold.classList.add('in');
    }
    const inner = fold.firstElementChild as HTMLElement;
    inner.replaceChildren();
    spoken(el('p', '', inner), text);
    if (actions.length) {
      const row = el('div', 'row', inner);
      for (const a of actions) button(a.primary ? 'primary' : '', a.label, row, () => { this.dismiss(); a.run?.(); }).textContent = a.label;
    }
    this.box.dataset.state = 'speaking';
    window.setTimeout(() => this.setState(), sayTime(text));
    this.sayTimer = window.setTimeout(() => this.dismiss(), ms * this.speed);
  }

  /** The fold goes back in, and is gone once it has. */
  dismiss(): void {
    window.clearTimeout(this.sayTimer);
    if (this.wordsSwapped) {
      this.wordsSwapped = false;
      const words = this.card ? this.body?.querySelector<HTMLElement>('.co-words') : null;
      if (words) { words.replaceChildren(); spoken(words, this.cardWords); }
    }
    const fold = this.sayEl;
    this.sayEl = null;
    if (!fold) return;
    fold.classList.remove('in');
    fold.classList.add('out');
    window.setTimeout(() => fold.remove(), 400);
  }

  /**
   * A conversation with it, in its card: the lines it has to say (and hers, and what the game does on the way), then her
   * answers; `said` is the answer she just gave, said first. Only the latest exchange stays in the card: her answer
   * and what it says to it, so the card stays small on a phone.
   */
  converse(lines: Line[], choices: string[], said?: string): void {
    if (!this.card) { this.drawCard(); this.box.dataset.talking = ''; }
    if (!this.thread || said) {
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
    if (r.nourished !== null) parts.push(`<span>${MARK.nourished}Nutrition ${r.nourished ? 'optimal' : 'good'}</span>`);
    if (r.level !== null && LEVELS[r.level]) parts.push(`<span>${MARK.level}<b>Level ${r.level}</b> ${LEVELS[r.level]}</span>`);
    box.innerHTML = parts.join('');
  }

  /**
   * Her messages in its card, newest last, the unread marked: tapped, one opens to its words (and is read), the others
   * close.
   */
  private drawInbox(list: HTMLElement, messages: Inbox[]): void {
    list.setAttribute('aria-label', 'Your messages');
    for (const m of messages) {
      const li = el('li', m.unread ? 'unread' : '', list);
      const b = button('co-msg', `Message from ${m.from}${m.unread ? ', unread' : ''}`, li, () => {
        const opening = !li.classList.contains('open');
        list.querySelectorAll('li.open').forEach((x) => x.classList.remove('open'));
        li.classList.toggle('open', opening);
        b.setAttribute('aria-expanded', String(opening));
        if (opening && li.classList.contains('unread')) { li.classList.remove('unread'); this.onRead(m.id); }
      });
      b.setAttribute('aria-expanded', 'false');
      el('span', 'from', b, m.from);
      el('span', 'peek', b, m.text);
      el('p', 'whole', li, m.text);
    }
  }

  /** What she can do in its card: talk to it, ask it about something; where it cannot hear her, it says so, or she calls it. */
  private drawActions(): void {
    const foot = this.foot!;
    foot.replaceChildren();
    if (this.unheard && this.canCall) {
      button('primary', 'Call the Concierge', foot, () => this.onCall()).textContent = 'Call';
      el('p', 'quiet', foot, 'It cannot hear you in here, unless you call.');
      return;
    }
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
    if (who === 'its') spoken(m, text.replace(/^["“](.*)["”]$/s, '$1'));
    else m.append(document.createTextNode(text));
    // the new line in sight from its start: a long one is read from the top
    const body = this.thread!.parentElement!;
    body.scrollTop = Math.min(m.offsetTop - body.offsetTop - 4, body.scrollHeight - body.clientHeight);
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
