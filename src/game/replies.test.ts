import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Hotspot } from './level';
import { kindOf, replyFor, type Replies } from './replies';

const replies: Replies = {
  talk: { thing: ['It doesn\'t answer.', 'Nothing.'], machine: ['A polite beep.'] },
  take: { any: ['Not yours.'], way: ['You can\'t take a door with you.'] },
  ask: { any: ['{name}, Luna.'], private: ['I can\'t see in here, Luna.'] },
  look: { any: { concierge: ['Lovely.'], raw: ['Nothing special.'] } },
};
const spot = (h: Partial<Hotspot>): Hotspot => ({ id: 'x', name: 'X', rect: [0, 0, 1, 1], ...h });

describe('what a thing is', () => {
  it('is what its scene file says, else a way out, someone to talk to, or a thing', () => {
    expect(kindOf(spot({ kind: 'machine', talk: 'guardian' }))).toBe('machine');
    expect(kindOf(spot({ go: { scene: 'street', spawn: 'start' } }))).toBe('way');
    expect(kindOf(spot({ talk: 'fixer' }))).toBe('person');
    expect(kindOf(spot({}))).toBe('thing');
  });
});

describe('a standard reply', () => {
  it('fits what the thing is, and is a different one each time she tries again, round and round', () => {
    expect(replyFor(replies, 'talk', 'thing', false, 0, 'Bench')).toBe('It doesn\'t answer.');
    expect(replyFor(replies, 'talk', 'thing', false, 1, 'Bench')).toBe('Nothing.');
    expect(replyFor(replies, 'talk', 'thing', false, 2, 'Bench')).toBe('It doesn\'t answer.');
    expect(replyFor(replies, 'talk', 'machine', false, 0, 'Bot')).toBe('A polite beep.');
  });

  it('falls back on what any thing gets, but not when its kind has its own', () => {
    expect(replyFor(replies, 'take', 'thing', false, 0, 'Bench')).toBe('Not yours.');
    expect(replyFor(replies, 'take', 'way', false, 0, 'Door')).toBe('You can\'t take a door with you.');
  });

  it('is in the view on screen, and names the thing where it says {name}', () => {
    expect(replyFor(replies, 'look', 'thing', true, 0, 'Bench')).toBe('Nothing special.');
    expect(replyFor(replies, 'look', 'thing', false, 0, 'Bench')).toBe('Lovely.');
    expect(replyFor(replies, 'ask', 'thing', false, 0, 'Bench')).toBe('Bench, Luna.');
  });

  it('is, asking the Concierge in a privacy zone, that it cannot see in there', () => {
    expect(replyFor(replies, 'ask', 'thing', false, 0, 'Bench', true)).toBe('I can\'t see in here, Luna.');
  });

  it('is nothing where there is none to give', () => {
    expect(replyFor(replies, 'use', 'thing', false, 0, 'Bench')).toBeNull();
  });

  it('has one for every verb and every kind in the game\'s own replies', () => {
    const game = JSON.parse(readFileSync(join(__dirname, '../../public/assets/replies.json'), 'utf8')) as Replies;
    for (const verb of ['look', 'talk', 'use', 'take', 'ask', 'item'] as const) {
      for (const kind of ['thing', 'machine', 'person', 'way', 'fixture', 'door'] as const) {
        // a way's Use goes through it, and its Look is its own; every other pair has a reply
        if (verb === 'use' && kind === 'way') continue;
        expect(replyFor(game, verb, kind, false, 0, 'X'), `${verb} ${kind}`).toBeTruthy();
        expect(replyFor(game, verb, kind, true, 0, 'X'), `${verb} ${kind} raw`).toBeTruthy();
      }
    }
    expect(replyFor(game, 'ask', 'thing', false, 0, 'X', true)).toMatch(/can't see in here/);
  });
});
