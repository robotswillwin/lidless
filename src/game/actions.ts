// What she can do with things. A verb is chosen first, at the ball in the bottom right corner, and then done to whatever
// lights up under her finger: Look (her Eyes), Talk (her Heart), Use and Take (her Hands), and in the Concierge's view
// Ask (its bell). Going through a door, or off the end of the street, needs no verb: tapping it walks her there and
// through. In raw view, looking at something it shows differently is staring, and staring costs attention.

import type { Action } from './hud';
import type { Hotspot } from './level';

export type Verb = 'eyes' | 'heart' | 'hands' | 'take' | 'ask';

/** The verbs at the ball in the view on screen: the Concierge's bell is there only in its view. */
export const verbsIn = (raw: boolean): Verb[] => (raw ? ['eyes', 'heart', 'hands', 'take'] : ['eyes', 'heart', 'hands', 'take', 'ask']);

const NAMES: Record<Verb, string> = { eyes: 'Look', heart: 'Talk', hands: 'Use', take: 'Take', ask: 'Ask' };

/** A verb's name: the Concierge's, capitalised, in its view; hers, in lower case, in raw view. */
export const verbName = (v: Verb, raw: boolean): string => (raw ? NAMES[v].toLowerCase() : NAMES[v]);

/** What the verb does to this thing in the view on screen, or null if it does nothing to it. */
export function actionFor(h: Hotspot, v: Verb, raw: boolean): Action | null {
  if (v === 'eyes') {
    if (!h.look) return null;
    const stare = raw && typeof h.look === 'object' && h.look.raw !== h.look.concierge;
    return { kind: 'eyes', label: raw ? (stare ? 'look closely' : 'look') : 'Look', cost: stare ? 1 : 0 };
  }
  if (v === 'heart') return h.talk ? { kind: 'heart', label: verbName(v, raw) } : null;
  if (v === 'hands') return h.use || h.wardrobe ? { kind: 'hands', label: verbName(v, raw) } : null;
  if (v === 'take') return h.take ? { kind: 'take', label: verbName(v, raw) } : null;
  return !raw && h.ask ? { kind: 'ask', label: 'Ask' } : null;
}

/** Everything that can be done with a thing in the view on screen: going through it first, then the verbs in order. */
export function actionsFor(h: Hotspot, raw: boolean): Action[] {
  const out: Action[] = h.go ? [{ kind: 'feet', label: raw ? 'go' : 'Go' }] : [];
  for (const v of verbsIn(raw)) {
    const a = actionFor(h, v, raw);
    if (a) out.push(a);
  }
  return out;
}

/** What a thing is mostly for: talking to someone, going through a door, else using, taking, looking. */
export function defaultOf(actions: Action[]): Action {
  const order = ['heart', 'feet', 'hands', 'take', 'eyes', 'ask'];
  return [...actions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}
