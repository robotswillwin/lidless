import { describe, expect, it } from 'vitest';
import { outfitAfter, outfitIn, type Outfits } from './outfits';

const outfits: Outfits = {
  coat: { sprite: 'cast/hero', name: 'Coat', out: true, home: 'home' },
  home: { sprite: 'cast/hero-home', name: 'Home clothes', out: 'coat' },
  robe: { sprite: 'cast/hero-robe', name: 'Bathrobe', stay: 'Not in this.' },
  party: { sprite: 'cast/hero-party', name: 'Party dress', out: true },
};

describe('outfits', () => {
  it('takes her coat off as she comes home, and puts it on over home clothes as she leaves', () => {
    expect(outfitAfter(outfits, 'coat', false, true)).toBe('home');
    expect(outfitAfter(outfits, 'home', true, false)).toBe('coat');
  });

  it('lets her go out in what can be worn outside, as she is, and keeps her home in what cannot', () => {
    expect(outfitAfter(outfits, 'party', true, false)).toBe('party');
    expect(outfitAfter(outfits, 'party', false, true)).toBe('party');
    expect(outfitAfter(outfits, 'robe', true, false)).toBeNull();
  });

  it('changes nothing between two places outside, or two at home', () => {
    expect(outfitAfter(outfits, 'coat', false, false)).toBe('coat');
    expect(outfitAfter(outfits, 'robe', true, true)).toBe('robe');
  });

  it('starts her in her first outfit, out of her coat if she starts at home; an outfit not listed is her first', () => {
    expect(outfitIn(outfits, 'coat', true)).toBe('home');
    expect(outfitIn(outfits, 'coat', false)).toBe('coat');
    expect(outfitAfter(outfits, 'gone', false, false)).toBe('coat');
  });
});
