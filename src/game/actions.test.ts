import { describe, expect, it } from 'vitest';
import { actionFor, actionsFor, defaultOf, verbsIn } from './actions';
import type { Hotspot } from './level';

const dock: Hotspot = {
  id: 'dock', name: 'Someone at the dock', rect: [0, 0, 10, 10], talk: 'dock',
  look: { concierge: 'A woman in a red dress, dining.', raw: 'Her wrist is locked in the cradle.' }, ask: 'She is a guest, dining.',
};

describe('verbs', () => {
  it('offers the Concierge’s bell only in its view', () => {
    expect(verbsIn(false)).toEqual(['eyes', 'heart', 'hands', 'take', 'ask']);
    expect(verbsIn(true)).toEqual(['eyes', 'heart', 'hands', 'take']);
  });

  it('does every verb to everything, saying which it has something of its own for', () => {
    expect(actionFor(dock, 'heart', false)).toMatchObject({ kind: 'heart', label: 'Talk', own: true });
    // nothing of its own for these: a standard reply answers
    expect(actionFor(dock, 'hands', false)).toMatchObject({ kind: 'hands', own: false });
    expect(actionFor(dock, 'take', true)).toMatchObject({ kind: 'take', label: 'take', own: false });
    expect(actionFor({ ...dock, use: 'It hums.', take: 'Mine now.' }, 'hands', true)).toMatchObject({ kind: 'hands', label: 'use', own: true });
    expect(actionFor({ ...dock, take: 'Mine now.' }, 'take', false)).toMatchObject({ kind: 'take', label: 'Take', own: true });
    // her wardrobe, and the shower that leaves her in her bathrobe, are used with nothing written for it; a door, going through
    expect(actionFor({ ...dock, wardrobe: true }, 'hands', false)).toMatchObject({ kind: 'hands', own: true });
    expect(actionFor({ ...dock, wear: 'robe' }, 'hands', true)).toMatchObject({ kind: 'hands', label: 'use', own: true });
    expect(actionFor({ ...dock, go: { scene: 'street', spawn: 'start' } }, 'hands', true)).toMatchObject({ own: true });
    // a machine's reply is its own answer to Talk
    expect(actionFor({ id: 'bot', name: 'Bot', rect: [0, 0, 1, 1], reply: 'Bzzzzt.' }, 'heart', false)).toMatchObject({ own: true });
  });

  it('asks the Concierge only in its view, named for it so it is not taken for talking', () => {
    expect(actionFor(dock, 'ask', false)).toMatchObject({ kind: 'ask', label: 'Ask the Concierge', own: true });
    expect(actionFor({ ...dock, ask: undefined }, 'ask', false)).toMatchObject({ own: false });
    expect(actionFor(dock, 'ask', true)).toBeNull();
  });

  it('looks closely in raw view at what the Concierge shows otherwise, at no cost: raw view is legal', () => {
    expect(actionFor(dock, 'eyes', true)).toMatchObject({ label: 'look closely' });
    expect(actionFor(dock, 'eyes', true)?.cost).toBeUndefined();
    expect(actionFor(dock, 'eyes', false)).toMatchObject({ label: 'Look' });
    expect(actionFor({ ...dock, look: 'A bench.' }, 'eyes', true)).toMatchObject({ label: 'look' });
  });
});

describe('actionsFor', () => {
  it('lists going through first, then every verb', () => {
    expect(actionsFor(dock, false).map((a) => a.kind)).toEqual(['eyes', 'heart', 'hands', 'take', 'ask']);
    expect(actionsFor(dock, true).map((a) => a.kind)).toEqual(['eyes', 'heart', 'hands', 'take']);
    expect(actionsFor({ id: 'door', name: 'Door', rect: [0, 0, 1, 1], go: { scene: 'radio', spawn: 'door' } }, false).map((a) => a.kind)).toEqual(['feet', 'eyes', 'heart', 'hands', 'take', 'ask']);
  });
});

describe('defaultOf', () => {
  it('does what the thing is for: talks before going, goes before looking, looks before asking', () => {
    expect(defaultOf(actionsFor(dock, false)).kind).toBe('heart');
    expect(defaultOf([{ kind: 'ask', label: 'Ask', own: true }, { kind: 'eyes', label: 'Look', own: true }]).kind).toBe('eyes');
    expect(defaultOf([{ kind: 'eyes', label: 'Look', own: true }, { kind: 'feet', label: 'Go' }]).kind).toBe('feet');
  });

  it('never picks a standard reply over what the thing has, and looks when it has nothing at all', () => {
    // a bench with only a look: tapped, she looks, rather than talking to it
    expect(defaultOf(actionsFor({ id: 'bench', name: 'Bench', rect: [0, 0, 1, 1], look: 'A bench.' }, false)).kind).toBe('eyes');
    expect(defaultOf(actionsFor({ id: 'blank', name: 'Blank', rect: [0, 0, 1, 1] }, false)).kind).toBe('eyes');
  });
});
