import { describe, expect, it } from 'vitest';
import { resolveCityMap, type ChapterMap } from './citymap';

const data: ChapterMap = {
  id: 'c1', title: 'DISTRICT 3', background: 'sky.png', aspectRatio: 2.4,
  nodes: [
    { id: 'home', label: 'Home', x: 0.1, y: 0.2, targetScene: 'home', icon: 'home' },
    { id: 'floor14', label: 'Floor 14', x: 0.3, y: 0.2, targetScene: 'floor14', icon: 'lift' },
    { id: 'lobby', label: 'Lobby', x: 0.6, y: 0.7, targetScene: 'lobby', icon: 'door' },
    { id: 'secret', label: 'Secret', x: 0.9, y: 0.7, targetScene: 'secret', icon: 'door', discoveredWhen: 'knows_secret' },
    { id: 'locked', label: 'Locked', x: 0.5, y: 0.5, targetScene: 'locked', icon: 'door', accessibleWhen: 'has_key' },
  ],
  connections: [
    { from: 'home', to: 'floor14', style: 'road' },
    { from: 'floor14', to: 'lobby', style: 'lift' },
    { from: 'lobby', to: 'secret', style: 'road' },
    { from: 'home', to: 'locked' },
  ],
};
// mimic conditions.ts holds(): an empty/undefined condition is always true; otherwise the fake decides
const none = (c?: string) => !c;
const only = (...yes: string[]) => (c?: string) => !c || yes.includes(c);

describe('the city map', () => {
  it('leaves out a place she has not found, and its lines', () => {
    // been nowhere, nothing known: a place with no discoveredWhen and no visited neighbour is not shown
    const now = resolveCityMap(data, none, new Set(), 'home');
    // home is her current scene so it shows; floor14 joins home only if home is visited — it is not, so hidden
    expect(now.nodes.map((n) => n.id).sort()).toEqual(['home']);
    expect(now.nodes[0].state).toBe('current');
    // no line survives with only one end known
    expect(now.connections.length).toBe(0);
  });

  it('marks where she stands as current even though she has, of course, been there', () => {
    // she is always in a place she has reached: being there must win over having been there
    const now = resolveCityMap(data, none, new Set(['home', 'lobby']), 'home');
    const byId = Object.fromEntries(now.nodes.map((n) => [n.id, n.state]));
    expect(byId.home).toBe('current');
    expect(byId.lobby).toBe('visited');
  });

  it('shows a visited place amber, its neighbours as known, and keeps their line', () => {
    const now = resolveCityMap(data, none, new Set(['home']), 'lobby');
    const byId = Object.fromEntries(now.nodes.map((n) => [n.id, n.state]));
    expect(byId.home).toBe('visited');       // been there
    expect(byId.floor14).toBe('discovered');  // joins home (visited), not been
    expect(byId.lobby).toBe('current');       // where she is
    // the home–floor14 line is drawn (both known); lobby–secret is not (secret unknown)
    expect(now.connections.some((c) => c.from.id === 'home' && c.to.id === 'floor14')).toBe(true);
    expect(now.connections.some((c) => c.to.id === 'secret')).toBe(false);
  });

  it('shows a story-gated place only when its condition holds', () => {
    const hidden = resolveCityMap(data, none, new Set(['lobby']), 'home');
    expect(hidden.nodes.some((n) => n.id === 'secret')).toBe(false);
    const shown = resolveCityMap(data, only('knows_secret'), new Set(['lobby']), 'home');
    expect(shown.nodes.some((n) => n.id === 'secret')).toBe(true);
  });

  it('marks a known but inaccessible place, which can be looked at not travelled to', () => {
    // locked joins home; home visited so locked is known; has_key false so it is inaccessible
    const now = resolveCityMap(data, only('knows_secret'), new Set(['home']), 'home');
    expect(now.nodes.find((n) => n.id === 'locked')?.state).toBe('inaccessible');
    // with the key it becomes a normal known place
    const open = resolveCityMap(data, only('has_key', 'knows_secret'), new Set(['home']), 'home');
    expect(open.nodes.find((n) => n.id === 'locked')?.state).toBe('discovered');
  });

  it('keeps a place known once the latch holds it, even with nothing else', () => {
    const now = resolveCityMap(data, none, new Set(), 'street', new Set(['lobby']));
    expect(now.nodes.some((n) => n.id === 'lobby')).toBe(true);
    // and reports what is known, for the game to latch
    expect(now.discovered).toContain('lobby');
  });
});
