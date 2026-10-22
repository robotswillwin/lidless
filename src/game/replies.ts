// What a thing answers to a verb it has nothing of its own for. Every thing in a scene can be looked at, talked to, used
// and taken, and asked about in the Concierge's view: where a scene file or the story gives it nothing for that verb,
// one of the standard replies says so, by the verb and by what the thing is (a person, a machine, a thing, a way out),
// in the view on screen, and a different one each time she tries the same thing again. They are in
// public/assets/replies.json, to be written like any other text; `{name}` in one is the thing's name.

import type { Hotspot } from './level';

/** What a thing is, for its standard replies: who answers, what can be done to it. */
export type Kind = 'person' | 'machine' | 'thing' | 'way';
/** The verbs with standard replies: hers, the Concierge's (`ask`, its voice), and using a thing she carries (`item`). */
export type ReplyVerb = 'look' | 'talk' | 'use' | 'take' | 'ask' | 'item';

/** A list of replies, the same in both views or one for each. */
type Lines = string[] | { concierge?: string[]; raw?: string[] };
/** By verb, by kind (or `any`); the Concierge's `ask` also has `private`, for a privacy zone, where it cannot see. */
export type Replies = Partial<Record<ReplyVerb, Partial<Record<Kind | 'any' | 'private', Lines>>>>;

/** What a thing is: as its scene file says, else a way out (it goes somewhere), someone to talk to, or a thing. */
export function kindOf(h: Hotspot): Kind {
  if (h.kind) return h.kind;
  if (h.go) return 'way';
  return h.talk ? 'person' : 'thing';
}

const linesOf = (l: Lines | undefined, raw: boolean): string[] => (!l ? [] : Array.isArray(l) ? l : (raw ? l.raw : l.concierge) ?? l.concierge ?? l.raw ?? []);

/**
 * The standard reply to a verb on a thing: for its kind (else any), in the view on screen, the `tries`-th of them round
 * again (the first try 0), its name put in for `{name}`. Asked in a privacy zone, the Concierge's own. Null if there is
 * none to give.
 */
export function replyFor(replies: Replies, verb: ReplyVerb, kind: Kind, raw: boolean, tries: number, name: string, privacy = false): string | null {
  const byKind = replies[verb] ?? {};
  const pool = verb === 'ask' && privacy && byKind.private ? linesOf(byKind.private, raw) : [...linesOf(byKind[kind], raw), ...(byKind[kind] ? [] : linesOf(byKind.any, raw))];
  if (!pool.length) return null;
  return pool[((tries % pool.length) + pool.length) % pool.length].replace(/\{name\}/g, name);
}
