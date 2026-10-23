// The Concierge's side of a session (CO, as Luna calls it): its card opened from its presence, with its words for where
// she is or her new messages; talking to it, and calling it from a home (decision 30), its privacy sign open while the
// call lasts; how closely it watches her; and each frame its status line (the greeting for the time of day, the clock),
// its privacy sign, and what it keeps of her: her heart, her credits, her nourishment, her level. Its presence and card
// on screen are concierge.ts.

import { clockText, dayPart, greetingFor, minuteAt, parseClock } from './clock';
import type { Game } from './game';
import { inbox, unreadWords, type Inbox } from './messages';

export class CO {
  /** On a call from a home: it hears her, its privacy sign open, until the conversation ends. */
  calling = false;
  /** A story's line asked for a call once its conversation is over (the opening's "Good morning, CO."). */
  private callAfter = false;
  /** How closely it is watching her, 0 to 3: staring at what it hides raises it, behaving in its view lets it fall. */
  attention: number;
  private attentionAt = 0;
  /** Her heart, beats a minute, as her wrists tell it: it keeps it. */
  private heart = 66;
  /** The time of day the clock started at this session, minutes after midnight (clock.ts); the story's part of the day. */
  private readonly clockStart: number;
  private dayPartSet = '';

  constructor(private readonly g: Game) {
    this.attention = g.setup.save?.attention ?? 0;
    this.clockStart = g.setup.save?.clock ?? parseClock(g.setup.world.clock);
  }

  /**
   * It sees and hears her here: everywhere but a privacy location (her home, the public restroom; later approved meeting
   * rooms), which the law it keeps forbids it to watch, unless she has called it.
   */
  get watching(): boolean {
    const scene = this.g.scene;
    return !!scene && (!scene.file.private || this.calling);
  }

  /** From a home she can call it (decision 30); not from a public privacy room, nor in raw view. */
  get canCall(): boolean {
    const f = this.g.scene.file;
    return !!f.private && !!f.home && !this.g.raw;
  }

  /**
   * Its presence tapped: its card opens, with what it would have her do here (the scene's `assist`) or her new
   * messages, and closes again. Tapped while it listens, the question is put down.
   */
  ring(): void {
    const g = this.g;
    if (g.controls.verb === 'ask') return g.controls.setVerb(null);
    if (g.hud.concierge.isOpen) return g.hud.concierge.close();
    const box = this.inbox(), unread = box.filter((m) => m.unread).length;
    g.hud.openConcierge(unread ? unreadWords(unread) : g.scene.file.assist ?? 'Is there anything I can do for you, Luna?', !this.watching, box, this.canCall);
  }

  /**
   * She calls it: it hears her, its privacy sign opens, and they talk (its knot for the place); when the conversation
   * ends the call does, and the sign shuts.
   */
  call(): void {
    const g = this.g;
    if (!this.canCall || this.calling || g.talk.open || g.ways.travelling) return;
    // once the call is over, its card is as it is here: it cannot hear her, she can call it again
    g.hud.concierge.setHearing(true, true);
    this.calling = true;
    this.talk();
    if (!g.hud.concierge.talking) this.calling = false;
  }

  /** A story's line asks for a call: it is made once the conversation the line is in is over. */
  callSoon(): void {
    this.callAfter = true;
  }

  /** The conversation is over, and with it a call. */
  hangUp(): void {
    this.calling = false;
  }

  /** After a conversation: the call a line asked for in it. */
  callIfAsked(): void {
    if (!this.callAfter) return;
    this.callAfter = false;
    window.setTimeout(() => this.call(), 0);
  }

  /**
   * Talking to it, in its card: its knot for where she is (`concierge_<place>`, a `-` in the place's id a `_`, as Ink
   * names go; in a close-up, the place it is of), else its own (`concierge`). Not where it cannot hear her.
   */
  talk(): void {
    const g = this.g, f = g.scene.file;
    const knot = [`concierge_${(f.closeup ?? f.id).replace(/-/g, '_')}`, 'concierge'].find((k) => g.dialogue.has(k));
    if (!knot || !this.watching || g.raw) return;
    g.converse(null, knot, true);
  }

  /** A knot a place runs as she arrives: its own, in its card (in raw view, where it has none, as any conversation). */
  ask(knot: string): void {
    this.g.converse(null, knot, !this.g.raw);
  }

  /** Her messages now: those that have come, and which she has not read. */
  inbox(): Inbox[] {
    const g = this.g, file = g.setup.messages;
    return file ? inbox(file, (c) => g.dialogue.test(c), g.progress.messagesRead) : [];
  }

  /** A message opened in its card: read, and the story hears of it. */
  read(id: string): void {
    const g = this.g;
    if (g.progress.messagesRead.has(id)) return;
    g.progress.messagesRead.add(id);
    const m = g.setup.messages?.messages.find((x) => x.id === id);
    if (m?.read) g.dialogue.set(m.read, true);
    g.persist();
  }

  /** It watches her more closely (something it noticed, her staring at what it hides), up to 3. */
  raiseAttention(n: number): void {
    this.attention = Math.min(3, this.attention + n);
    this.attentionAt = this.g.clock();
    this.g.hud.setAttention(this.attention);
    this.g.persist();
  }

  /** The time of day now, minutes after midnight. */
  minute(t = this.g.clock()): number {
    return minuteAt(this.clockStart, t);
  }

  /** The time of day, seconds after midnight: a clock's second hand. */
  secondOfDay(t = this.g.clock()): number {
    return (((this.clockStart * 60 + t) % 86400) + 86400) % 86400;
  }

  /**
   * Each frame, `t` seconds into the session and `dt` since the last: in its view, with nothing to stare at, its
   * attention slowly settles; its greeting and its line of the day (the clock, the weather: it never says it is
   * raining); the story's part of the day; its privacy sign; her unread messages; and what it keeps of her.
   */
  frame(t: number, dt: number): void {
    const g = this.g, file = g.scene.file, world = g.world;
    if (this.attention > 0 && !g.raw && t - this.attentionAt > 30) { this.attention--; this.attentionAt = t; g.hud.setAttention(this.attention); }
    const minute = this.minute(t), part = dayPart(minute);
    g.hud.setStatus(greetingFor(file.greeting, minute), `${clockText(minute)}, Friday, Year 64 of Care. ${file.kind === 'interior' ? 'Indoors, 21°.' : '14°, an umbrella is advised.'}`);
    if (part !== this.dayPartSet) { this.dayPartSet = part; g.dialogue.set('day_part', part); }
    // its privacy sign where it cannot see her, open while she calls it; her unread messages on its presence
    g.hud.concierge.setPrivacy(g.raw || !file.private ? null : this.calling ? 'open' : 'shut', g.setup.reduceMotion);
    g.hud.concierge.setUnread(g.raw ? 0 : this.inbox().filter((m) => m.unread).length);
    // what it keeps of her: her credits, her heart as her wrists tell it (it climbs as she hurries, and as its attention
    // on her grows, and settles slowly), and whether she has fed lately (by the story's count of her comings and goings)
    const pace = (world.moving ? (world.gait === 'run' ? 128 : world.gait === 'jog' ? 104 : 84) : 66) + this.attention * 7;
    this.heart += (pace - this.heart) * Math.min(1, dt / (pace > this.heart ? 5 : 12));
    const credits = g.dialogue.read('credits'), arrivals = g.dialogue.read('arrivals'), fed = g.dialogue.read('fed_at'), level = g.dialogue.read('care_level');
    g.hud.setReadouts({
      credits: typeof credits === 'number' ? credits : null,
      heart: Math.round(this.heart + Math.sin(t * 0.9) * 1.4),
      nourished: typeof arrivals === 'number' && typeof fed === 'number' ? arrivals - fed < 8 : null,
      level: typeof level === 'number' ? level : null,
    });
  }
}
