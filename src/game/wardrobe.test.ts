import { describe, expect, it } from 'vitest';
import type { Sprite } from '../engine/assets';
import type { Outfits } from './outfits';
import { Wardrobe } from './wardrobe';

const outfits: Outfits = {
  coat: { sprite: 'cast/hero', name: 'Coat', out: true, home: 'clothes' },
  clothes: { sprite: 'cast/hero-clothes', name: 'Clothes', out: 'coat' },
  underwear: { sprite: 'cast/hero-underwear', name: 'Underwear', stay: 'No.' },
  party: { sprite: 'cast/hero-party', name: 'Party dress', virtual: true, over: 'clothes' },
};
const sprite = (path: string) => ({ def: { name: path } }) as unknown as Sprite;

function wardrobe(saved: { outfit?: string; projection?: string } = {}) {
  const loaded: string[] = [], freed: string[] = [];
  const w = new Wardrobe(outfits, 'cast/hero', sprite('cast/hero'), { ...saved, start: 'coat' }, async (p) => { loaded.push(p); return sprite(p); }, (s) => freed.push(s.def.name));
  return { w, loaded, freed };
}

describe('her wardrobe', () => {
  it('loads an outfit the first time she wears it, and lets go of what she took off, never her coat', async () => {
    const { w, loaded, freed } = wardrobe();
    await w.wear('clothes');
    await w.wear('underwear');
    await w.wear('coat');
    await new Promise((r) => setTimeout(r, 0));
    expect(loaded).toEqual(['cast/hero-clothes', 'cast/hero-underwear']);
    expect(freed).toEqual(['cast/hero-clothes', 'cast/hero-underwear']);
    expect(w.sprite.def.name).toBe('cast/hero');
  });

  it('shows a projection in the Concierge\'s view only, and keeps her clothes under it loaded', async () => {
    const { w, freed } = wardrobe({ outfit: 'clothes' });
    await w.wear('clothes');
    await w.project('party');
    expect(w.shown(false).def.name).toBe('cast/hero-party');
    expect(w.shown(true).def.name).toBe('cast/hero-clothes');
    await w.project(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(freed).toEqual(['cast/hero-party']);
    expect(w.shown(false).def.name).toBe('cast/hero-clothes');
  });

  it('puts a saved projection back over her clothes, an older save\'s too', () => {
    // an older save, the projection saved as what she wore: back on over her first outfit, her coat over her clothes
    expect(wardrobe({ outfit: 'party' }).w.outfit).toBe('coat');
    expect(wardrobe({ outfit: 'party' }).w.projection).toBe('party');
    expect(wardrobe({ outfit: 'underwear', projection: 'party' }).w.outfit).toBe('clothes');
  });
});
