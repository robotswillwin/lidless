import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SceneFile } from '../game/scenefile';
import { lintScene } from './lint';
import { arriveBy, IN, joinedUp, joinOf, makeHere, makeThere, missingThere } from './join';

const dir = resolve(__dirname, '../../public/assets/scenes');
const read = (id: string) => JSON.parse(readFileSync(`${dir}/${id}/scene.json`, 'utf8')) as SceneFile;
const exit = (f: SceneFile, id: string) => f.hotspots.find((h) => h.id === id)!;
/** A scene to lead to with nothing leading back: a corridor, its walk line from 40 to 900. */
const corridor = (): SceneFile => ({ ...read('home'), id: 'corridor', name: 'Corridor', size: [960, 540], walk: { y: 400, x0: 40, x1: 900 }, hotspots: [], spawns: { start: { x: 480, facing: 1 } } });

describe('exits both ways', () => {
  it('finds the game’s exits joined up', () => {
    for (const [a, id, b] of [['street', 'to-backstreet', 'backstreet'], ['backstreet', 'to-street', 'street'], ['street', 'radio-door', 'radio'], ['radio', 'door', 'street'], ['backstreet', 'entrance', 'home'], ['home', 'door', 'backstreet']]) {
      const here = read(a), j = joinOf(exit(here, id), here, read(b));
      expect(joinedUp(j), `${a}'s ${id}`).toBe(true);
    }
  });

  it('makes the way back at the other end from an end walked out by, and a place to arrive at by each', () => {
    const here = read('street'), there = corridor();
    // out by the street's right end, into the corridor
    here.hotspots.push({ id: 'east', name: 'East', rect: [2350, 320, 40, 150], stand: 2370, go: { scene: 'corridor', spawn: '' } });
    const h = here.hotspots.at(-1)!, j = joinOf(h, here, there);
    expect(j).toMatchObject({ arrive: 'from-street', exitNames: false, hasArrive: false, back: -1, backTo: 'from-corridor', hasBackTo: false });
    expect(missingThere(j)).toBe(true);
    expect(makeHere(h, here, j)).toBe(true);
    // in from the right end, facing left
    expect(here.spawns['from-corridor']).toEqual({ x: 2370 - IN, facing: -1 });
    expect(h.go!.spawn).toBe('from-street');
    const made = makeThere(h, here, there, j);
    expect(made).toEqual({ back: 0, madeBack: true, madeArrive: true });
    // in the corridor at its left end, standing on the walk line, leading back to where she left
    const back = there.hotspots[0];
    expect(back).toMatchObject({ id: 'to-street', name: 'To Main street', stand: 40, go: { scene: 'street', spawn: 'from-corridor' } });
    expect(back.rect[1] + back.rect[3]).toBe(400);
    expect(back.rect[0]).toBeLessThanOrEqual(40);
    expect(back.rect[0] + back.rect[2]).toBeGreaterThan(40);
    expect(there.spawns['from-street']).toEqual({ x: 40 + IN, facing: 1 });
    expect(joinedUp(joinOf(h, here, there))).toBe(true);
    // and neither scene has a problem with exits any more
    const ctx = { scenes: ['street', 'corridor', 'backstreet', 'radio', 'home'], others: { street: here, corridor: there, backstreet: read('backstreet'), radio: read('radio'), home: read('home') } };
    for (const f of [here, there]) expect(lintScene(f, ctx).filter((p) => p.level === 'error' && /leads to|arrives at/.test(p.text)), f.id).toEqual([]);
  });

  it('puts the way back on the same side as a door', () => {
    const here = read('street'), there = corridor();
    // a door in the street's left half
    here.hotspots.push({ id: 'shop', name: 'Shop', rect: [180, 300, 50, 170], stand: 205, go: { scene: 'corridor', spawn: '' } });
    const h = here.hotspots.at(-1)!, j = joinOf(h, here, there);
    makeHere(h, here, j);
    makeThere(h, here, there, j);
    expect(there.hotspots[0].stand).toBe(40);
    // by the door here, facing into the street
    expect(here.spawns[j.backTo]).toEqual(arriveBy(here, 205));
  });

  it('uses a place already there, and makes only what is missing', () => {
    const here = read('street'), there = read('backstreet');
    // the backstreet's way back arrives at a place the street has lost
    delete here.spawns['from-backstreet'];
    const h = exit(here, 'to-backstreet'), j = joinOf(h, here, there);
    expect(j).toMatchObject({ arrive: 'from-street', hasArrive: true, backTo: 'from-backstreet', backNames: true, hasBackTo: false });
    expect(missingThere(j)).toBe(false);
    makeHere(h, here, j);
    expect(here.spawns['from-backstreet']).toEqual({ x: 30 + IN, facing: 1 });
    expect(joinedUp(joinOf(h, here, there))).toBe(true);
    // an exit arriving nowhere yet, by a way back there: it arrives at the place by that way back, none made
    h.go!.spawn = '';
    const k = joinOf(h, here, there);
    expect(k).toMatchObject({ arrive: 'from-street', exitNames: false, hasArrive: true });
    expect(makeHere(h, here, k)).toBe(false);
    expect(h.go!.spawn).toBe('from-street');
  });
});
