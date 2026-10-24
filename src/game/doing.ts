// What comes of what she does to a thing in a session: a verb done to it (looking, talking, using, taking, asking the
// Concierge), or a thing from her pockets used on it. Its own texts, or its knot in the story (a stitch for each verb,
// use_<thing> for a thing used on it), else a standard reply for what it is (replies.ts); a way out gone through, a thing
// gone up close to. Looking and asking happen from where she stands; the rest walks her there first. Her pockets as the
// story has them, too.

import { STITCH } from './dialogue';
import type { Game } from './game';
import type { Action } from './actions';
import { pick, placeIn, type Hotspot } from './level';
import { kindOf, replyFor, type ReplyVerb } from './replies';

export class Doing {
  /** How often she has tried a verb on a thing with nothing of its own for it, by place, thing and verb: the next reply. */
  private readonly tries = new Map<string, number>();

  constructor(private readonly g: Game) {}

  /** Whether a thing's knot in the story has this stitch. */
  readonly stitches = (h: Hotspot, name: string): boolean => !!h.story && this.g.dialogue.has(h.story, name);

  /** Looking and asking happen from where she stands, turned towards it; talking, using and taking walk her there first. */
  perform(h: Hotspot, a: Action): void {
    const g = this.g, { rect, stand } = placeIn(h, g.raw);
    // something on its round (a guard) stops for her, turned to her, and she goes up to it
    if (h.follows && a.kind !== 'eyes' && a.kind !== 'ask') {
      const cx = rect[0] + rect[2] / 2, side: 1 | -1 = g.world.heroX < cx ? -1 : 1;
      g.holdMover(h.follows, side);
      g.controls.pending = a;
      return g.controls.goTo(cx + side * (rect[2] / 2 + 12), h);
    }
    if ((a.kind === 'eyes' && !h.zoom) || a.kind === 'ask' || stand === undefined) {
      if (!g.world.moving) g.world.facing = rect[0] + rect[2] / 2 >= g.world.heroX ? 1 : -1;
      return this.act(h, a);
    }
    g.controls.pending = a;
    g.controls.goTo(stand, h);
  }

  /** She does it, there. */
  act(h: Hotspot, a: Action): void {
    const g = this.g, raw = g.raw;
    // used: what it does in the scene starts (air from a dryer)
    if (a.kind === 'hands') g.runner.used(h.id, g.clock());
    // a way she has looked at or tried is known from now on: its marker shows
    if (h.go || h.kind === 'way') g.ways.find(h);
    if (a.kind === 'feet' && h.go) return void g.ways.go(h.go, false, true);
    // a thing seen close up: tapped, looked at or used, the view goes in close
    if (h.zoom && (a.kind === 'feet' || a.kind === 'eyes' || a.kind === 'hands')) return void g.ways.zoomInto(h);
    // a thing she holds, used on this one: the story's use_<thing>, or nothing comes of it
    if (a.kind === 'item') {
      const id = g.controls.inHand;
      g.controls.hold(null);
      if (id && this.stitches(h, `use_${id}`)) return this.runStory(h, `${h.story}.use_${id}`);
      return this.standard(h, 'item');
    }
    // a conversation of its own (`talk`) is what Talk does; any other verb, the thing's knot where it answers it
    const st = STITCH[a.kind as keyof typeof STITCH];
    if (st && !(a.kind === 'heart' && h.talk) && this.stitches(h, st)) return this.runStory(h, `${h.story}.${st}`);
    // a thing to pick up: into her pockets, gone from here for good
    if (a.kind === 'take' && h.item) {
      g.dialogue.take(h.item);
      this.syncThings();
      g.persist();
      const name = g.setup.items[h.item] ? pick(g.setup.items[h.item].name, raw) : h.item;
      return g.hud.note(h, h.take ? pick(h.take, raw) : raw ? `${name}, in my pocket.` : `${name}: added to your things.`, g.boxOf(h));
    }
    if (a.kind === 'heart' && h.talk) g.converse(h, h.talk);
    else if (a.kind === 'heart' && h.reply) g.hud.note(h, pick(h.reply, raw), g.boxOf(h));
    else if (a.kind === 'eyes' && h.look) {
      // what she finds is written at the thing, where her eye already is
      g.hud.note(h, pick(h.look, raw), g.boxOf(h));
      if (a.cost) g.co.raiseAttention(a.cost);
    } else if (a.kind === 'hands' && h.wardrobe) g.dressing.open();
    // the shower: a while passes behind the fade, and she comes out of it undressed; what she finds, after
    else if (a.kind === 'hands' && h.wear) void g.dressing.change(h.wear, 900).then(() => { if (h.use) g.hud.note(h, pick(h.use, raw), g.boxOf(h)); });
    else if (a.kind === 'hands' && h.use) g.hud.note(h, pick(h.use, raw), g.boxOf(h));
    // using a door is going through it
    else if (a.kind === 'hands' && h.go) void g.ways.go(h.go, false, true);
    else if (a.kind === 'take' && h.take) g.hud.note(h, pick(h.take, raw), g.boxOf(h));
    else if (a.kind === 'ask' && h.ask) g.hud.toast(h.ask);
    // nothing of its own for this verb: a standard reply for what it is
    else if (a.kind !== 'feet') this.standard(h, ({ eyes: 'look', heart: 'talk', hands: 'use', take: 'take', ask: 'ask' } as const)[a.kind]);
  }

  /**
   * A thing's knot in the story, at a stitch: one plain line with nothing to answer is written at the thing, as a look
   * is; anything more (several lines, someone speaking, answers, something the game does) is a conversation.
   */
  runStory(h: Hotspot, path: string): void {
    const g = this.g, lines = g.dialogue.start(path, g.raw), choices = g.dialogue.choices, one = lines[0];
    if (lines.length === 1 && !choices.length && !one.commands && (one.speaker === 'narration' || one.speaker === 'luna')) {
      g.hud.note(h, one.text, g.boxOf(h));
      g.endTalk();
      return;
    }
    if (!lines.length && !choices.length) return g.endTalk();
    g.talkOn(h, lines, choices);
  }

  /**
   * A standard reply to a verb (replies.ts): written at the thing, or, asking, said by the Concierge in its voice (in a
   * privacy zone, that it cannot see in there). Tried again on the same thing, the next one.
   */
  private standard(h: Hotspot, verb: ReplyVerb): void {
    const g = this.g, key = `${g.scene.file.id}/${h.id}/${verb}`, tries = this.tries.get(key) ?? 0;
    this.tries.set(key, tries + 1);
    const text = replyFor(g.setup.replies ?? {}, verb, kindOf(h), g.raw, tries, pick(h.name, g.raw), !g.co.watching);
    if (!text) return;
    if (verb === 'ask') g.hud.toast(text);
    else g.hud.note(h, text, g.boxOf(h));
  }

  /** Her pockets as the story has them now (or as the world lists them, in a story that keeps none). */
  syncThings(): void {
    const g = this.g, carried = g.dialogue.carried();
    g.hud.setThings(g.setup.items, carried ?? g.setup.world.hero.items ?? []);
    g.hud.notebookChanged();
    if (g.controls.inHand && !(carried ?? []).includes(g.controls.inHand)) g.controls.hold(null);
  }
}
