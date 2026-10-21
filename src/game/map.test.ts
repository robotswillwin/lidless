import { describe, expect, it } from 'vitest';
import type { Hotspot } from './level';
import { mapNow, type MapLayout, type MapScene } from './map';

const door = (id: string, x: number, scene: string, spawn: string, name = id): Hotspot => ({ id, name, rect: [x - 10, 200, 20, 100], stand: x, go: { scene, spawn } });
const scenes: Record<string, MapScene> = {
  home: { id: 'home', name: 'Home', kind: 'interior', size: [960, 540], spawns: { door: { x: 800 } }, hotspots: [door('door', 810, 'street', 'from-home')] },
  street: {
    id: 'street', name: 'Main street', kind: 'exterior', size: [2400, 540], spawns: { 'from-home': { x: 300 }, 'from-shop': { x: 1200 } },
    hotspots: [
      door('home-door', 300, 'home', 'door', 'Entrance 3'), door('shop-door', 1200, 'shop', 'door', 'Radio repair'),
      { id: 'kiosk', name: 'Street machine', rect: [900, 300, 50, 100], stand: 920, talk: 'kiosk' },
      { id: 'bench', name: 'Bench', rect: [1500, 380, 60, 40], stand: 1530 },
      { id: 'bar', name: { concierge: 'Bar', raw: 'Nobody drinks here' }, rect: [2000, 250, 200, 200], stand: 2100, map: true },
      { id: 'ghost', name: 'Projection', rect: [600, 250, 40, 100], stand: 620, talk: 'ghost', only: 'concierge' },
    ],
  },
  shop: { id: 'shop', name: 'Radio repair', kind: 'interior', size: [960, 540], spawns: { door: { x: 250 } }, hotspots: [door('door', 230, 'street', 'from-shop')] },
};
const layout: MapLayout = { places: { home: { at: [10, -50], spawn: 'door' }, street: { at: [0, 0] }, shop: { at: [100, 40] } } };
const all = () => true;

describe('the map', () => {
  it('draws the places she has been, and sketches in where the doors she has seen lead', () => {
    const seen = (sc: string, id: string) => sc === 'street' && ['home-door', 'shop-door', 'kiosk', 'bar', 'bench'].includes(id);
    const now = mapNow(layout, scenes, new Set(['street']), seen, { scene: 'street', x: 1200 }, false, all);
    expect(now.places.map((p) => [p.id, p.state, p.name])).toEqual([['street', 'been', 'Main street'], ['home', 'seen', 'Home'], ['shop', 'seen', 'Radio repair']]);
    // a street as long as it is wide: a tenth of its pixels; where she is, along it
    expect(now.places[0].box).toEqual([0, 0, 240, 22]);
    expect(now.you).toEqual([120, 11]);
    // doors, people and things marked for it, not everything (the bench); a door to a place on the map is not named
    expect(now.spots.map((s) => [s.id, s.kind, s.named])).toEqual([['home-door', 'door', false], ['shop-door', 'door', false], ['kiosk', 'person', true], ['bar', 'thing', true]]);
    // a place sketched in takes her to its door
    expect(now.places[2].go).toEqual({ scene: 'street', at: 'shop-door' });
    expect(now.links.every((l) => l.open)).toBe(true);
  });

  it('shows only what she has seen, what is there now, in the view on screen', () => {
    const now = mapNow(layout, scenes, new Set(['street']), (_, id) => id !== 'bar', { scene: 'street', x: 0 }, true, (h) => h.id !== 'kiosk');
    expect(now.spots.map((s) => s.id)).toEqual(['home-door', 'shop-door']);
    const named = mapNow(layout, scenes, new Set(['street']), all, { scene: 'street', x: 0 }, true, all);
    // the projection is not there in raw view; the bar has her name for it
    expect(named.spots.map((s) => s.name)).toEqual(['Entrance 3', 'Radio repair', 'Street machine', 'Nobody drinks here']);
  });

  it('takes her to a place where she arrives there, and joins two places she has been once', () => {
    const now = mapNow(layout, scenes, new Set(['street', 'home', 'shop']), all, { scene: 'home', x: 480 }, false, all);
    expect(now.places.find((p) => p.id === 'home')!.go).toEqual({ scene: 'home', spawn: 'door' });
    expect(now.places.find((p) => p.id === 'shop')!.go).toEqual({ scene: 'shop', spawn: 'door' });
    expect(now.links.length).toBe(2);
    expect(now.links.some((l) => l.open)).toBe(false);
    expect(now.places.find((p) => p.here)!.id).toBe('home');
  });
});
