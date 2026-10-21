// Runs the Ink story: knots per conversation, tags for who is speaking and for what the game does. The story is where
// everything that happens is kept, the game reads it: what she knows (variables, read by conditions), what she carries
// (the list `carried`), what she has picked up anywhere (`taken`), and an object's own knot, a stitch for each verb.

import { InkList, Story } from 'inkjs';
import storyJson from '../story/main.ink';
import { holds } from './conditions';

/** A speaker tag on a line names who says it: a lowercase id such as luna, fixer or concierge. */
const SPEAKER_TAG = /^[a-z][a-z0-9_]*$/;

/**
 * What a story's line can have the game do before it is said, as a tag `name: argument`:
 *   walk: 640 | walk: desk     she walks to x, or to a thing's place, and the line waits until she is there
 *   face: left | right         she turns
 *   wear: clothes | party      she changes, behind a fade (a projection too)
 *   go: street/from-backstreet she goes to a scene, arriving at a place there; the story goes on there
 *   fade: 0.6                  the screen goes dark for so many seconds, and comes back
 *   view: raw | concierge      the view switches
 *   wait: 1.5                  a pause, in seconds
 */
export const COMMANDS = ['walk', 'face', 'wear', 'go', 'fade', 'view', 'wait'] as const;
export type CommandName = (typeof COMMANDS)[number];
export interface Command { name: CommandName; arg: string }

export interface Line {
  text: string;
  /** The line's speaker tag, or "narration" for a line without one. */
  speaker: string;
  /** What the game does before the line is said; a line can be only that, with no text. */
  commands?: Command[];
}

/** A tag as a command, or null if it is not one (a speaker, or anything else). */
export function commandOf(tag: string): Command | null {
  const m = /^([a-z]+)\s*:\s*(.*)$/.exec(tag.trim());
  return m && (COMMANDS as readonly string[]).includes(m[1]) ? { name: m[1] as CommandName, arg: m[2].trim() } : null;
}

/** The stitch of an object's knot that each verb runs: Look runs `look`, Use `use`, using a thing on it `use_<thing>`. */
export const STITCH = { eyes: 'look', heart: 'talk', hands: 'use', take: 'take', ask: 'ask' } as const;

export class Dialogue {
  readonly story: Story;

  constructor(saved: string | null, json: unknown = storyJson) {
    this.story = new Story(json as ConstructorParameters<typeof Story>[0]);
    if (saved) {
      try {
        this.story.state.LoadJson(saved);
      } catch {
        // an old or broken save: start the story fresh
      }
    }
  }

  start(knot: string, rawView: boolean): Line[] {
    this.story.variablesState['raw_view'] = rawView;
    this.story.ChoosePathString(knot);
    return this.lines();
  }

  /** The view can switch during a conversation, so the lines after a choice see the view on screen now. */
  choose(i: number, rawView: boolean): Line[] {
    this.story.variablesState['raw_view'] = rawView;
    this.story.ChooseChoiceIndex(i);
    return this.lines();
  }

  lines(): Line[] {
    const out: Line[] = [];
    while (this.story.canContinue) {
      const text = (this.story.Continue() ?? '').trim();
      const tags = (this.story.currentTags ?? []).map((t) => t.trim());
      const commands = tags.map(commandOf).filter((c): c is Command => c !== null);
      if (!text && !commands.length) continue;
      out.push({ text, speaker: tags.find((t) => SPEAKER_TAG.test(t)) ?? 'narration', ...(commands.length ? { commands } : {}) });
    }
    return out;
  }

  get choices(): string[] {
    return this.story.currentChoices.map((c) => c.text);
  }

  get hasRaw(): boolean {
    return Boolean(this.story.variablesState['has_raw']);
  }

  /** A story variable as it is now: a number, a word, true or false, or a list (undefined if there is none). */
  read(name: string): unknown {
    try {
      return this.story.variablesState[name];
    } catch {
      return undefined;
    }
  }

  /** Whether a condition holds now (see conditions.ts); none always does. */
  test(cond: string | undefined): boolean {
    return holds(cond, (n) => this.read(n));
  }

  /** Whether the story has this knot, or this stitch of it. */
  has(knot: string, stitch?: string): boolean {
    const k = this.story.mainContentContainer.namedContent.get(knot) as { namedContent?: Map<string, unknown> } | undefined;
    return !!k && (!stitch || !!k.namedContent?.has(stitch));
  }

  /** The items in a list variable, in the list's own order; null if there is no such list. */
  listed(name: string): string[] | null {
    const l = this.read(name);
    if (!(l instanceof InkList)) return null;
    return l.orderedItems.map((kv) => kv.Key.itemName ?? '').filter(Boolean);
  }

  /** What she carries: the story's list `carried`, or null if the story keeps none. */
  carried(): string[] | null {
    return this.listed('carried');
  }

  /** Puts an item in a list (`carried`, `taken`), or takes it out. An item the story's lists do not have is left be. */
  private alter(list: string, item: string, on: boolean): void {
    const l = this.read(list);
    if (!(l instanceof InkList) || l.ContainsItemNamed(item) === on) return;
    let next: InkList;
    if (on) {
      // the item from the story's own list definitions: a list declared empty knows none of them yet
      let one: InkList;
      try { one = InkList.FromString(item, this.story); } catch { return; }
      next = l.Union(one);
    } else {
      next = new InkList(l);
      for (const kv of l.orderedItems) if (kv.Key.itemName === item) next.Remove(kv.Key);
    }
    this.story.variablesState[list] = next;
  }

  /** She gives a thing away, or uses it up: out of her pockets. */
  drop(item: string): void {
    this.alter('carried', item, false);
  }

  /** She picks up a thing: it goes into her pockets, and is taken from where it was for good. */
  take(item: string): void {
    this.alter('carried', item, true);
    this.alter('taken', item, true);
  }

  /** Whether she has ever picked this thing up from where it was. */
  took(item: string): boolean {
    return this.listed('taken')?.includes(item) ?? false;
  }

  save(): string {
    return this.story.state.ToJson();
  }
}
