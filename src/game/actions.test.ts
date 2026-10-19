import { describe, expect, it } from 'vitest';
import { actionsFor, defaultOf } from './actions';
import type { Hotspot } from './level';

const dock: Hotspot = {
  id: 'dock', name: 'Someone at the dock', rect: [0, 0, 10, 10], talk: 'dock',
  look: { concierge: 'A woman in a red dress, dining.', raw: 'Her wrist is locked in the cradle.' }, ask: 'She is a guest, dining.',
};

describe('actionsFor', () => {
  it('offers talking, looking and asking in the Concierge’s view', () => {
    expect(actionsFor(dock, false).map((a) => a.kind)).toEqual(['heart', 'eyes', 'ask']);
  });

  it('makes looking at what the Concierge hides a stare in raw view, which costs attention, and drops asking it', () => {
    const raw = actionsFor(dock, true);
    expect(raw.map((a) => a.kind)).toEqual(['heart', 'eyes']);
    expect(raw.find((a) => a.kind === 'eyes')).toMatchObject({ label: 'look closely', cost: 1 });
  });

  it('costs nothing to look at what is the same in both views', () => {
    expect(actionsFor({ ...dock, look: 'A bench.' }, true).find((a) => a.kind === 'eyes')?.cost).toBe(0);
  });

  it('goes through doors', () => {
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
