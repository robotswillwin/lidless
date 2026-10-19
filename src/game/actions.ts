// What can be done with a thing, by Lux's properties: Feet go, Heart talks, Eyes look; in the Concierge's view its bell
// asks it. In raw view, looking at something it shows differently is staring, and staring costs attention.

import type { Action } from './hud';
import type { Hotspot } from './level';

export function actionsFor(h: Hotspot, raw: boolean): Action[] {
  const out: Action[] = [];
  if (h.go) out.push({ kind: 'feet', label: raw ? 'go' : 'Go' });
  if (h.talk) out.push({ kind: 'heart', label: raw ? 'talk' : 'Talk' });
  if (h.look) {
    const stare = raw && typeof h.look === 'object' && h.look.raw !== h.look.concierge;
    out.push({ kind: 'eyes', label: raw ? (stare ? 'look closely' : 'look') : 'Look', cost: stare ? 1 : 0 });
  }
  if (!raw && h.ask) out.push({ kind: 'ask', label: 'Ask' });
  return out;
}

/** What a thing is mostly for: talking to someone, going through a door, else looking. */
export function defaultOf(actions: Action[]): Action {
  const order = ['heart', 'feet', 'hands', 'eyes', 'ask'];
  return [...actions].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}
