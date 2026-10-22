import { describe, expect, it } from 'vitest';
import type { Hotspot } from './level';
import { mapNow, placeBoxes, ROAD, ROOM, STEM, type MapLayout, type MapScene } from './map';

const door = (id: string, x: number, scene: string, spawn: string, name = id): Hotspot => ({ id, name, rect: [x - 10, 200, 20, 100], stand: x, go: { scene, spawn } });
const scenes: Record<string, MapScene> = {
  home: { id: 'home', name: 'Home', kind: 'interior', size: [960, 540], spawns: { door: { x: 800 } }, hotspots: [door('door', 810, 'street', 'from-home')] },
  street: {
    id: 'street', name: 'Main street', kind: 'exterior', size: [2400, 540], spawns: { 'from-home': { x: 300 }, 'from-shop': { x: 1200 }, 'from-alley': { x: 2380 } },
    hotspots: [
      door('home-door', 300, 'home', 'door', 'Entrance 3'), door('shop-door', 1200, 'shop', 'door', 'Radio repair'),
      { id: 'kiosk', name: 'Street machine', rect: [900, 300, 50, 100], stand: 920, talk: 'kiosk' },
      { id: 'bench', name: 'Bench', rect: [1500, 380, 60, 40], stand: 1530 },
      { id: 'bar', name: { concierge: 'Bar', raw: 'Nobody drinks here' }, rect: [2000, 250, 200, 200], stand: 2100, map: true },
      { id: 'ghost', name: 'Projection', rect: [600, 250, 40, 100], stand: 620, talk: 'ghost', only: 'concierge' },
      door('to-alley', 2390, 'alley', 'from-street', 'Alley'),
    ],
  },
  shop: { id: 'shop', name: 'Radio repair', kind: 'interior', size: [960, 540], spawns: { door: { x: 240 } }, hotspots: [door('door', 230, 'street', 'from-shop')] },
  alley: { id: 'alley', name: 'Alley', kind: 'exterior', size: [960, 540], spawns: { 'from-street': { x: 20 } }, hotspots: [door('to-street', 10, 'street', 'from-alley')] },
};
const layout: MapLayout = { places: { home: { spawn: 'door' }, street: { at: [0, 0] }, shop: {}, alley: { at: [240, 0] } } };
const all = () => true;

describe('the map', () => {
  it('lays each street along its row, as long as it is wide, and each room above the door it opens from', () => {
    const boxes = placeBoxes(layout, scenes);
    expect(boxes.street).toEqual({ box: [0, 0, 240, ROAD], street: true });
    expect(boxes.alley.box).toEqual([240, 0, 96, ROAD]);
    // her home's door is 300 of 2400 along the street: 30 on the map; where she arrives in it (800 of 960) over it
    const [hx, hy, hw, hh] = boxes.home.box;
    expect([hw, hh]).toEqual(ROOM);
    expect(hx + (800 / 960) * hw).toBeCloseTo(30);
    expect(hy + hh).toBe(-STEM);
    // the shop's door further along, its room over it, its arrival (240 of 960) over the door
    expect(boxes.shop.box[0] + (240 / 960) * ROOM[0]).toBeCloseTo(120);
    expect(boxes.shop.box[1]).toBe(-STEM - ROOM[1]);
  });

  it('raises a room over another already there, and puts one where its layout says', () => {
    const near: Record<string, MapScene> = { ...scenes, shop: { ...scenes.shop, spawns: { door: { x: 800 } } } };
    near.street = { ...scenes.street, hotspots: [...scenes.street.hotspots.filter((h) => h.id !== 'shop-door'), door('shop-door', 400, 'shop', 'door')] };
    const boxes = placeBoxes(layout, near);
    expect(boxes.shop.box[1]).toBe(boxes.home.box[1] - ROOM[1] - STEM);
    expect(placeBoxes({ places: { ...layout.places, shop: { at: [5, 60], size: [40, 20] } } }, scenes).shop.box).toEqual([5, 60, 40, 20]);
  });

  it('draws the places she has been, and sketches in where the doors she has seen lead', () => {
    const seen = (sc: string, id: string) => sc === 'street' && ['home-door', 'shop-door', 'kiosk', 'bar', 'bench'].includes(id);
    const now = mapNow(layout, scenes, new Set(['street']), seen, { scene: 'street', x: 1200 }, false, all);
    expect(now.places.map((p) => [p.id, p.state, p.name])).toEqual([['street', 'been', 'Main street'], ['home', 'seen', 'Home'], ['shop', 'seen', 'Radio repair']]);
    // where she is, along the road
    expect(now.you).toEqual([120, ROAD / 2]);
    // doors, people and things marked for it, not everything (the bench); a door to a place on the map is not named
    expect(now.spots.map((s) => [s.id, s.kind, s.named])).toEqual([['home-door', 'door', false], ['shop-door', 'door', false], ['kiosk', 'person', true], ['bar', 'thing', true]]);
    // a place sketched in takes her to its door
    expect(now.places[2].go).toEqual({ scene: 'street', at: 'shop-door' });
    // a line up from the road at its door to the room's foot, dashed while she has not been in
    expect(now.links[0]).toEqual({ from: [30, 0], to: [30, -STEM], open: true });
    expect(now.links.every((l) => l.open)).toBe(true);
  });

  it('shows only what she has seen, what is there now, in the view on screen', () => {
    const now = mapNow(layout, scenes, new Set(['street']), (_, id) => id !== 'bar', { scene: 'street', x: 0 }, true, (h) => h.id !== 'kiosk');
    expect(now.spots.map((s) => s.id)).toEqual(['home-door', 'shop-door', 'to-alley']);
    const named = mapNow(layout, scenes, new Set(['street']), all, { scene: 'street', x: 0 }, true, all);
    // the projection is not there in raw view; the bar has her name for it
    expect(named.spots.map((s) => s.name)).toEqual(['Entrance 3', 'Radio repair', 'Street machine', 'Nobody drinks here', 'Alley']);
  });

  it('takes her to a place where she arrives there, and joins two places she has been once', () => {
    const now = mapNow(layout, scenes, new Set(['street', 'home', 'shop', 'alley']), all, { scene: 'home', x: 480 }, false, all);
    expect(now.places.find((p) => p.id === 'home')!.go).toEqual({ scene: 'home', spawn: 'door' });
    expect(now.places.find((p) => p.id === 'shop')!.go).toEqual({ scene: 'shop', spawn: 'door' });
    expect(now.links.length).toBe(3);
    expect(now.links.some((l) => l.open)).toBe(false);
    expect(now.places.find((p) => p.here)!.id).toBe('home');
    // her room's door is at its foot, where the line down to the street leaves it; the alley's way back joins the roads
    expect(now.spots.find((s) => s.scene === 'home')!.at[1]).toBe(-STEM);
    expect(now.spots.find((s) => s.id === 'to-alley')).toMatchObject({ street: true, to: 'alley', named: false });
  });
});
