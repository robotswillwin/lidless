import { describe, expect, it } from 'vitest';
import { Progress } from './progress';
import type { SceneFile } from './scenefile';

const place = (id: string, more: Partial<SceneFile> = {}) => ({ id, ...more }) as SceneFile;

describe('what she knows and has done', () => {
  it('a new game: nothing known, its opening still to run; a save from before the opening has had it', () => {
    const p = new Progress(null);
    expect([p.been.size, p.arrived, p.opened]).toEqual([0, 0, false]);
    expect(new Progress({ v: 2, heroX: 0, facing: 1, view: 1, ink: null }).opened).toBe(true);
  });

  it('knows the ways she has found and what she has seen, place by place', () => {
    const p = new Progress(null);
    p.find('street', 'radio-door');
    p.seenIn('street').add('kiosk');
    expect([p.knows('street', 'radio-door'), p.knows('home', 'radio-door')]).toEqual([true, false]);
    expect([p.hasSeen('street', 'kiosk'), p.hasSeen('street', 'bar')]).toEqual([true, false]);
  });

  it('counts her arrivals, turns a place\'s rotations, and keeps her visits to a privacy room it sees the door of', () => {
    const p = new Progress(null);
    const street = place('street', { rotate: { station_seat: { values: ['woman', 'man'] } } });
    expect(p.arrive(street, () => true)).toEqual({ arrivals: 1, station_seat: 'woman' });
    expect(p.arrive(street, () => true)).toEqual({ arrivals: 2, station_seat: 'man' });
    expect(p.arrive(place('restroom', { noticed: { after: 120, often: 3, within: 8, long: 'L', again: 'A' } }), () => true)).toEqual({ arrivals: 3 });
    expect(p.visits).toEqual({ restroom: [3] });
  });

  it('goes into her save and comes back from it the same', () => {
    const p = new Progress(null);
    p.been.add('home');
    p.find('home', 'door');
    p.seenIn('home').add('desk');
    p.notesRead.add('seen:cradle');
    p.messagesRead.add('athena-invitation');
    p.arrive(place('home'), () => true);
    p.opened = true;
    const saved = { v: 2 as const, heroX: 0, facing: 1 as const, view: 1, ink: null, ...p.toSave() };
    expect(new Progress(saved).toSave()).toEqual(p.toSave());
    expect(saved).toMatchObject({ visited: ['home'], found: { home: ['door'] }, seen: { home: ['desk'] }, arrived: 1, opened: true });
  });
});
