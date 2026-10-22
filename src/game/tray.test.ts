import { describe, expect, it } from 'vitest';
import { picturesOf, thingsNow, type Item } from './tray';

const items: Record<string, Item> = {
  parcel: { icon: 'parcel', art: { concierge: 'items/parcel.concierge.webp', raw: 'items/parcel.webp' }, name: 'Parcel', note: { concierge: 'Delivery 4471', raw: "don't open it." } },
  badge: { icon: 'credits', only: 'concierge', name: { concierge: 'Guest badge', raw: 'badge' } },
  matches: { icon: 'matches', art: 'items/matches.webp', unlicensed: true, name: { concierge: 'Matches', raw: 'matches (3)' } },
  memory: { icon: 'map', only: 'raw', name: 'a memory' },
};

describe('her things', () => {
  it('are what she carries, as the view on screen has them', () => {
    const co = thingsNow(items, ['parcel', 'badge', 'matches', 'memory', 'nothing'], false);
    expect(co.map((t) => t.name)).toEqual(['Parcel', 'Guest badge', 'Matches']);
    // what exists only in its eye is its own graphic; what it did not make, it labels
    expect(co.find((t) => t.id === 'badge')).toMatchObject({ projected: true, ghost: false, art: undefined });
    expect(co.find((t) => t.id === 'matches')).toMatchObject({ tag: 'Unlicensed', art: 'items/matches.webp' });
    const raw = thingsNow(items, ['parcel', 'badge', 'matches', 'memory'], true);
    expect(raw.map((t) => t.name)).toEqual(['Parcel', 'badge', 'matches (3)', 'a memory']);
    // painted as each view shows it, or the same in both
    expect([co[0].art, raw[0].art]).toEqual(['items/parcel.concierge.webp', 'items/parcel.webp']);
    expect(raw.find((t) => t.id === 'matches')?.art).toBe('items/matches.webp');
    expect(picturesOf(items.parcel)).toEqual(['items/parcel.concierge.webp', 'items/parcel.webp']);
    expect(picturesOf(items.badge)).toEqual([]);
    // in raw view a projection is an empty place in her pocket, and nothing is labelled
    expect(raw.find((t) => t.id === 'badge')).toMatchObject({ ghost: true, projected: false });
    expect(raw.every((t) => !t.tag)).toBe(true);
    // where it cannot see her, it says nothing about them
    expect(thingsNow(items, ['matches'], false, false)[0]).toMatchObject({ tag: undefined, unlicensed: false });
  });
});
