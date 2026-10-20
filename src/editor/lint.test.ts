import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { setPresets } from '../engine/presets';
import type { SceneFile } from '../game/scenefile';
import { CORNER, lintScene, PHONE_LIGHTS, type LintContext } from './lint';

const dir = resolve(__dirname, '../../public/assets');
const read = (id: string) => JSON.parse(readFileSync(`${dir}/scenes/${id}/scene.json`, 'utf8')) as SceneFile;
const ids = readdirSync(`${dir}/scenes`);
const ctx = (over: Partial<LintContext> = {}): LintContext => ({
  scenes: ids, others: Object.fromEntries(ids.map((id) => [id, read(id)])), knots: new Set(['fixer', 'kiosk']), start: { scene: 'home', spawn: 'door' }, ...over,
});

afterEach(() => setPresets({ lights: {} }));

describe('lintScene', () => {
  it('finds no errors in the game’s scenes', () => {
    setPresets(JSON.parse(readFileSync(`${dir}/presets.json`, 'utf8')));
    for (const id of ids) expect(lintScene(read(id), ctx()).filter((p) => p.level === 'error'), id).toEqual([]);
  });

  it('flags a hotspot with nothing to do, and a conversation the story does not have', () => {
    const f = read('street');
    f.hotspots.push({ id: 'crate', name: 'Crate', rect: [400, 300, 20, 20] }, { id: 'ghost', name: 'Ghost', rect: [500, 300, 20, 20], talk: 'nobody' });
    const p = lintScene(f, ctx());
    expect(p).toContainEqual({ level: 'warning', text: expect.stringContaining('Crate: nothing to do with it'), sel: { kind: 'hotspot', i: f.hotspots.length - 2 } });
    expect(p).toContainEqual({ level: 'error', text: 'Ghost talks with “nobody”, which the story does not have', sel: { kind: 'hotspot', i: f.hotspots.length - 1 } });
  });

  it('checks exits both ways: to a place that is not there, and from other scenes to places this one lacks', () => {
    const f = read('street');
    const door = f.hotspots.findIndex((h) => h.go?.scene === 'radio');
    f.hotspots[door].go = { scene: 'radio', spawn: 'nowhere' };
    expect(lintScene(f, ctx()).map((p) => p.text)).toContain(`${typeof f.hotspots[door].name === 'string' ? f.hotspots[door].name : f.hotspots[door].name.concierge} leads to radio's “nowhere”, a place radio does not have`);
    // the radio repair's exit arrives at a place on the street; without it, the street is told
    const radio = read('radio'), back = radio.hotspots.find((h) => h.go?.scene === 'street')!;
    const s = read('street');
    delete s.spawns[back.go!.spawn];
    expect(lintScene(s, ctx()).some((p) => p.level === 'error' && p.text.includes(`arrives at “${back.go!.spawn}” here`))).toBe(true);
  });

  it('warns of a hotspot under a corner button on a phone, and one hidden under another', () => {
    const f = read('street');
    f.hotspots.push({ id: 'drain', name: 'Drain', rect: [10, 540 - CORNER + 10, 40, 40], look: 'A drain.' });
    f.hotspots.push({ id: 'cat', name: 'Cat', rect: [400, 200, 20, 20], look: 'A cat.' }, { id: 'box', name: 'Box', rect: [395, 195, 40, 40], look: 'A box.' });
    const texts = lintScene(f, ctx()).map((p) => p.text);
    expect(texts).toContain('Drain is mostly under the bottom left button on a phone: hard to tap');
    expect(texts).toContain('Cat is mostly under Box: taps there go to Box');
  });

  it('warns when more lights shine on one screen than a phone draws, in each view', () => {
    const f = read('street');
    f.lights = Array.from({ length: PHONE_LIGHTS + 2 }, (_, i) => ({ x: 40 * i, y: 200, z: 30, r: 200, c: [1, 1, 1] as [number, number, number], i: 1, zone: 0 }));
    const texts = lintScene(f, ctx()).map((p) => p.text);
    expect(texts).toContain(`In the Concierge’s view, ${PHONE_LIGHTS + 2} lights shine on one screen: a phone draws the ${PHONE_LIGHTS} strongest`);
    expect(texts).toContain(`In raw view, ${PHONE_LIGHTS + 2} lights shine on one screen: a phone draws the ${PHONE_LIGHTS} strongest`);
  });

  it('checks a hotspot where it is in each view, and a light set to neither view', () => {
    const f = read('street');
    // in the Concierge's view a sign up the wall; in raw view the same thing, fallen to the bottom left corner
    f.hotspots.push({ id: 'sign', name: 'Sign', rect: [400, 100, 40, 40], look: 'A sign.', views: { raw: { rect: [10, 540 - CORNER + 10, 40, 40] } } });
    f.lights.push({ x: 300, y: 200, z: 30, r: 100, c: [1, 1, 1], i: 1, zone: 0, ar: 1, raw: 1 });
    const texts = lintScene(f, ctx()).map((p) => p.text);
    expect(texts).toContain('Sign is mostly under the bottom left button on a phone in raw view: hard to tap');
    expect(texts).toContain(`Light ${f.lights.length} shines in neither view: it is set to AR only and to raw only`);
  });

  it('names what the scene file’s own checks are about, to select it', () => {
    const f = read('street');
    (f.lights[1] as { r?: number }).r = undefined;
    delete (f.lights[1] as { preset?: string }).preset;
    expect(lintScene(f, ctx()).find((p) => p.text.startsWith('lights[1]'))?.sel).toEqual({ kind: 'light', i: 1 });
  });

  it('reminds of a hotspot left with the placeholder it was made with', () => {
    const f = read('street');
    f.hotspots.push({ id: 'new', name: 'Something', rect: [400, 300, 20, 20], look: 'What she sees.' });
    expect(lintScene(f, ctx()).map((p) => p.text)).toContain('Something still has the placeholder name it was made with');
    f.hotspots[f.hotspots.length - 1].name = 'Crate';
    expect(lintScene(f, ctx()).map((p) => p.text)).toContain('Crate still has the placeholder look text it was made with');
  });

  it('reminds of suggested lights not yet kept or discarded, and the game’s start', () => {
    const f = read('home');
    f.lights.push({ x: 100, y: 100, suggested: 1 });
    const start = Object.keys(f.spawns)[0];
    delete f.spawns[start];
    const p = lintScene(f, ctx({ start: { scene: 'home', spawn: start } }));
    expect(p.some((x) => x.text === '1 suggested lights are not kept or discarded yet')).toBe(true);
    expect(p.some((x) => x.level === 'error' && x.text === `The game starts here at “${start}”, a place this scene does not have`)).toBe(true);
  });
});
