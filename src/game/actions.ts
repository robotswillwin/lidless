// What she can do with things. A verb is chosen first, at the ball in the bottom right corner, and then done to whatever
// lights up under her finger: Look (her Eyes), Talk (her Heart), Use and Take (her Hands), and in the Concierge's view
// Ask (its bell). Going through a door, or off the end of the street, needs no verb: tapping it walks her there and
// through. In raw view, looking at something it shows differently is staring, and staring costs attention, except where
// the Concierge neither sees nor hears her (her home: a private scene).

import type { Action } from './hud';
import type { Hotspot } from './level';

export type Verb = 'eyes' | 'heart' | 'hands' | 'take' | 'ask';

/** The verbs at the ball in the view on screen: the Concierge's bell is there only in its view. */
export const verbsIn = (raw: boolean): Verb[] => (raw ? ['eyes', 'heart', 'hands', 'take'] : ['eyes', 'heart', 'hands', 'take', 'ask']);

const NAMES: Record<Verb, string> = { eyes: 'Look', heart: 'Talk', hands: 'Use', take: 'Take', ask: 'Ask' };

/** A verb's name: the Concierge's, capitalised, in its view; hers, in lower case, in raw view. */
export const verbName = (v: Verb, raw: boolean): string => (raw ? NAMES[v].toLowerCase() : NAMES[v]);

/** Whether a thing's knot in the story has a stitch: an object with `story` answers a verb there. */
export type Stitches = (h: Hotspot, stitch: string) => boolean;
const STITCHES: Record<Verb, string> = { eyes: 'look', heart: 'talk', hands: 'use', take: 'take', ask: 'ask' };

/**
 * What the verb does to this thing in the view on screen, or null if it does nothing to it. `watched`: the Concierge sees
 * her here. `stitches`: whether the thing's knot in the story answers a verb (over its texts).
 */
export function actionFor(h: Hotspot, v: Verb, raw: boolean, watched = true, stitches: Stitches = () => false): Action | null {
  const st = stitches(h, STITCHES[v]);
  if (v === 'eyes') {
    if (!h.look && !st) return null;
    // staring is looking closely at what the Concierge shows otherwise: plain texts that differ (the story says itself)
    const stare = raw && !st && typeof h.look === 'object' && h.look.raw !== h.look.concierge;
    return { kind: 'eyes', label: raw ? (stare ? 'look closely' : 'look') : 'Look', cost: stare && watched ? 1 : 0 };
  }
  if (v === 'heart') return h.talk || st ? { kind: 'heart', label: verbName(v, raw) } : null; // a `talk` knot comes first
  if (v === 'hands') return h.use || h.wardrobe || h.wear || st ? { kind: 'hands', label: verbName(v, raw) } : null;
  if (v === 'take') return h.take || h.item || st ? { kind: 'take', label: verbName(v, raw) } : null;
  return !raw && (h.ask || st) ? { kind: 'ask', label: 'Ask' } : null;
}

/** Using a thing she holds on this one: on anything, to try; what comes of it is the story's (use_<thing>), or nothing. */
export const itemActionFor = (name: string, raw: boolean): Action => ({ kind: 'item', label: raw ? `use ${name}` : `Use ${name}` });

/** Everything that can be done with a thing in the view on screen: going through it first, then the verbs in order. */
export function actionsFor(h: Hotspot, raw: boolean, watched = true, stitches: Stitches = () => false): Action[] {
  const out: Action[] = h.go ? [{ kind: 'feet', label: raw ? 'go' : 'Go' }] : [];
  for (const v of verbsIn(raw)) {
    const a = actionFor(h, v, raw, watched, stitches);
    if (a) out.push(a);
  }
  return out;
}

/** What a thing is mostly for: talking to someone, going through a door, else using, taking, looking. */
export function defaultOf(actions: Action[]): Action {
  const order = ['heart', 'feet', 'hands', 'take', 'eyes', 'ask'];
  return [...actions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}
