// What she can do with things. A verb is chosen first, at the ball in the bottom right corner, and then done to whatever
// lights up under her finger: Look (her Eyes), Talk (her Heart), Use and Take (her Hands). Asking the Concierge about a
// thing is its own, chosen at its greeting in the top left, in its view only. Every thing answers every verb: what it has of its own (a text, its knot in the
// story), else a standard reply for what it is (replies.ts), so trying is never wrong and never silent. Going through a
// door, or off the end of the street, needs no verb: tapping it walks her there and through, and so does using it. In
// raw view, looking at something it shows differently is looking closely. Raw view is legal: the Concierge knows she
// uses it and does not hold it against her, so looking costs nothing. A tap with no verb looks, or talks with someone
// she can, or goes through a door: it never takes or uses a thing.

import type { Hotspot } from './level';

/** `item`: using a thing she holds on it. */
export type ActionKind = 'feet' | 'hands' | 'take' | 'eyes' | 'heart' | 'ask' | 'item';

export interface Action {
  kind: ActionKind;
  /** What the action is called here, in the view's own words. */
  label: string;
  /** Steps of the Concierge's attention it costs. */
  cost?: number;
  /** The thing has something of its own for it (a text, a stitch of its knot), not only a standard reply. */
  own?: boolean;
}

export type Verb = 'eyes' | 'heart' | 'hands' | 'take' | 'ask';

/** Her verbs, at the ball: the same in both views. */
export const HERS: Verb[] = ['eyes', 'heart', 'hands', 'take'];
/** Every verb in the view on screen: hers, and in its view asking the Concierge, at its greeting. */
export const verbsIn = (raw: boolean): Verb[] => (raw ? HERS : [...HERS, 'ask']);

// (asking is the Concierge's: named for it, so it is not taken for talking)
const NAMES: Record<Verb, string> = { eyes: 'Look', heart: 'Talk', hands: 'Use', take: 'Take', ask: 'Concierge' };
// what each asks, chosen: what to do it to
const OBJECTS: Record<Verb, string> = { eyes: 'Look at what?', heart: 'Talk to whom?', hands: 'Use what?', take: 'Take what?', ask: 'About what, Luna?' };

/** What a verb chosen asks, beside the ball (or, asking, under its greeting): hers in lower case in raw view. */
export const verbQuestion = (v: Verb, raw: boolean): string => (raw ? OBJECTS[v].toLowerCase() : OBJECTS[v]);

/** A verb's name: the Concierge's, capitalised, in its view; hers, in lower case, in raw view. */
export const verbName = (v: Verb, raw: boolean): string => (raw ? NAMES[v].toLowerCase() : NAMES[v]);

/** Whether a thing's knot in the story has a stitch: an object with `story` answers a verb there. */
export type Stitches = (h: Hotspot, stitch: string) => boolean;
const STITCHES: Record<Verb, string> = { eyes: 'look', heart: 'talk', hands: 'use', take: 'take', ask: 'ask' };

/**
 * What the verb does to this thing in the view on screen. Every thing answers every verb (asking, in the Concierge's
 * view only); `own` says it has something of its own for it, a text or a stitch of its knot, rather than a standard
 * reply. `stitches`: whether the thing's knot in the story answers a verb (over its texts).
 */
export function actionFor(h: Hotspot, v: Verb, raw: boolean, stitches: Stitches = () => false): Action | null {
  const st = stitches(h, STITCHES[v]);
  if (v === 'eyes') {
    // looking closely at what the Concierge shows otherwise: plain texts that differ (the story says itself)
    const closely = raw && !st && typeof h.look === 'object' && h.look.raw !== h.look.concierge;
    return { kind: 'eyes', label: raw ? (closely ? 'look closely' : 'look') : 'Look', own: !!h.look || !!h.zoom || st };
  }
  if (v === 'heart') return { kind: 'heart', label: verbName(v, raw), own: !!h.talk || !!h.reply || st };
  if (v === 'hands') return { kind: 'hands', label: verbName(v, raw), own: !!(h.use || h.wardrobe || h.wear || h.go || h.zoom) || st };
  if (v === 'take') return { kind: 'take', label: verbName(v, raw), own: !!(h.take || h.item) || st };
  return raw ? null : { kind: 'ask', label: 'Ask the Concierge', own: !!h.ask || st };
}

/** Using a thing she holds on this one: on anything, to try; what comes of it is the story's (use_<thing>), or nothing. */
export const itemActionFor = (name: string, raw: boolean): Action => ({ kind: 'item', label: raw ? `use ${name}` : `Use ${name}` });

/** Everything that can be done with a thing in the view on screen: going through it first, then the verbs in order. */
export function actionsFor(h: Hotspot, raw: boolean, stitches: Stitches = () => false): Action[] {
  // a door, and a thing seen close up (zoom), are gone up to and into with a tap
  const out: Action[] = h.go || h.zoom ? [{ kind: 'feet', label: raw ? 'go' : 'Go' }] : [];
  for (const v of verbsIn(raw)) {
    const a = actionFor(h, v, raw, stitches);
    if (a) out.push(a);
  }
  return out;
}

/**
 * What a tap with no verb does: going through a door, or up close to a thing seen close up; talking with someone she can
 * hold a conversation with (`talk`); else looking. Taking and using want their verb, chosen at the ball: a tap never
 * picks a thing up or uses it (the director, 24 October).
 */
export function defaultOf(actions: Action[], h?: Hotspot): Action {
  const go = actions.find((a) => a.kind === 'feet'), talk = actions.find((a) => a.kind === 'heart');
  return go ?? (h?.talk && talk ? talk : actions.find((a) => a.kind === 'eyes') ?? actions[0]);
}
