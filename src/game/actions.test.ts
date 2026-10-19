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

  it('does to a thing only what it has a use for', () => {
    expect(actionFor(dock, 'heart', false)).toMatchObject({ kind: 'heart', label: 'Talk' });
    expect(actionFor(dock, 'hands', false)).toBeNull();
    expect(actionFor(dock, 'take', true)).toBeNull();
    expect(actionFor({ ...dock, use: 'It hums.', take: 'Mine now.' }, 'hands', true)).toMatchObject({ kind: 'hands', label: 'use' });
    expect(actionFor({ ...dock, take: 'Mine now.' }, 'take', false)).toMatchObject({ kind: 'take', label: 'Take' });
  });

  it('asks the Concierge only in its view', () => {
    expect(actionFor(dock, 'ask', false)).toMatchObject({ kind: 'ask' });
    expect(actionFor(dock, 'ask', true)).toBeNull();
  });

  it('makes looking at what the Concierge hides a stare in raw view, which costs attention', () => {
    expect(actionFor(dock, 'eyes', true)).toMatchObject({ label: 'look closely', cost: 1 });
    expect(actionFor(dock, 'eyes', false)).toMatchObject({ label: 'Look', cost: 0 });
    expect(actionFor({ ...dock, look: 'A bench.' }, 'eyes', true)?.cost).toBe(0);
  });
});

describe('actionsFor', () => {
  it('lists going through first, then what each verb does', () => {
    expect(actionsFor(dock, false).map((a) => a.kind)).toEqual(['eyes', 'heart', 'ask']);
    expect(actionsFor(dock, true).map((a) => a.kind)).toEqual(['eyes', 'heart']);
    expect(actionsFor({ id: 'door', name: 'Door', rect: [0, 0, 1, 1], go: { scene: 'radio', spawn: 'door' } }, false).map((a) => a.kind)).toEqual(['feet']);
  });
});

describe('defaultOf', () => {
  it('talks before going, goes before looking, looks before asking', () => {
    expect(defaultOf(actionsFor(dock, false)).kind).toBe('heart');
    expect(defaultOf([{ kind: 'ask', label: 'Ask' }, { kind: 'eyes', label: 'Look' }]).kind).toBe('eyes');
    expect(defaultOf([{ kind: 'eyes', label: 'Look' }, { kind: 'feet', label: 'Go' }]).kind).toBe('feet');
  });
});
