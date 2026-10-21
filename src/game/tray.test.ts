import { describe, expect, it } from 'vitest';
import { thingsNow, type Item } from './tray';

const items: Record<string, Item> = {
  parcel: { icon: 'parcel', art: 'items/parcel.webp', name: { concierge: 'Parcel', raw: 'the parcel' }, note: { concierge: 'Delivery 4471', raw: "don't open it." } },
  credits: { icon: 'credits', only: 'concierge', name: { concierge: '312 credits', raw: 'credits' } },
  matches: { icon: 'matches', art: 'items/matches.webp', unlicensed: true, name: { concierge: 'Matches', raw: 'matches (3)' } },
  memory: { icon: 'map', only: 'raw', name: 'a memory' },
};

describe('her things', () => {
  it('are what she carries, as the view on screen has them', () => {
    const co = thingsNow(items, ['parcel', 'credits', 'matches', 'memory', 'nothing'], false);
    expect(co.map((t) => t.name)).toEqual(['Parcel', '312 credits', 'Matches']);
    // what exists only in its eye is its own graphic; what it did not make, it labels
    expect(co.find((t) => t.id === 'credits')).toMatchObject({ projected: true, ghost: false, art: undefined });
    expect(co.find((t) => t.id === 'matches')).toMatchObject({ tag: 'Unlicensed', art: 'items/matches.webp' });
    const raw = thingsNow(items, ['parcel', 'credits', 'matches', 'memory'], true);
    expect(raw.map((t) => t.name)).toEqual(['the parcel', 'credits', 'matches (3)', 'a memory']);
    // in raw view the credits are an empty place in her pocket, and nothing is labelled
    expect(raw.find((t) => t.id === 'credits')).toMatchObject({ ghost: true, projected: false });
    expect(raw.every((t) => !t.tag)).toBe(true);
  });
});
