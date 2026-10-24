import { describe, expect, it } from 'vitest';
import { commandOf, Dialogue } from './dialogue';

describe('the story', () => {
  it('keeps what she carries, and what she has picked up for good', () => {
    const d = new Dialogue(null);
    expect(d.carried()).toEqual(['matches', 'cigarettes', 'map']);
    d.take('parcel');
    expect(d.carried()).toContain('parcel');
    expect(d.took('parcel')).toBe(true);
    d.drop('parcel');
    expect(d.carried()).not.toContain('parcel');
    expect(d.took('parcel')).toBe(true);
    // a thing the story's lists do not have is left be
    d.take('spaceship');
    expect(d.carried()).not.toContain('spaceship');
  });

  it('keeps her credits as a number, and loads a save from when they were a thing she carried', () => {
    expect(new Dialogue(null).read('credits')).toBe(312);
    // such a save: the parcel taken, the credits in her pockets, the list's items numbered as they were then
    const d = new Dialogue(null);
    d.take('parcel');
    const old = JSON.parse(d.save());
    old.variablesState.carried = { list: { 'Things.parcel': 1, 'Things.credits': 2, 'Things.matches': 3, 'Things.cigarettes': 4, 'Things.map': 5 } };
    const loaded = new Dialogue(JSON.stringify(old));
    expect(loaded.loaded).not.toBe('fresh');
    expect(loaded.read('credits')).toBe(312);
    expect(loaded.carried()).toEqual(expect.arrayContaining(['parcel', 'matches', 'cigarettes', 'map']));
    loaded.drop('parcel');
    loaded.take('paper_notebook');
    expect(loaded.test('carried has paper_notebook && !(carried has parcel) && carried has map')).toBe(true);
  });

  it('feeds her at the station now and then: once fed, she does not need it for a while', () => {
    const d = new Dialogue(null), closeup = (lines: { commands?: { name: string; arg: string }[] }[]) => lines.flatMap((l) => l.commands ?? []).filter((c) => c.name === 'closeup').map((c) => c.arg);
    d.set('arrivals', 3);
    expect(closeup(d.start('station.use', false))).toEqual(['station', 'off']);
    expect(d.read('fed_at')).toBe(3);
    const again = d.start('station.use', false);
    expect(again.map((l) => l.text).join(' ')).toMatch(/don't need it right now/);
    expect(closeup(again)).toEqual([]);
    d.set('arrivals', 9);
    expect(closeup(d.start('station.use', true))).toEqual(['station', 'off']);
  });

  it('has the guardian speak of keeping the street safe, and ask to be told of anything odd', () => {
    const d = new Dialogue(null), lines = d.start('guardian', false);
    expect(lines.every((l) => l.speaker === 'guardian')).toBe(true);
    expect(lines.map((l) => l.text).join(' ')).toMatch(/safe/);
    const odd = d.choices.findIndex((c) => /wrong/.test(c));
    expect(d.choose(odd, false).map((l) => l.text).join(' ')).toMatch(/tell me/i);
  });

  it('reads conditions on its state', () => {
    const d = new Dialogue(null);
    expect(d.test('!has_raw && carried has map')).toBe(true);
    expect(d.test('carried has paper_notebook')).toBe(false);
    d.take('paper_notebook');
    expect(d.test('carried has paper_notebook && taken has paper_notebook')).toBe(true);
  });

  it('runs an object\'s stitches: her top drawer opens, and shuts again', () => {
    const d = new Dialogue(null);
    expect(d.has('luna_drawer', 'use')).toBe(true);
    expect(d.has('luna_drawer', 'take')).toBe(false);
    expect(d.start('luna_drawer.use', true).map((l) => l.text).join(' ')).toMatch(/gives/);
    expect(d.test('luna_drawer_open')).toBe(true);
    expect(d.start('luna_drawer.look', true).map((l) => l.text).join(' ')).toMatch(/torch/);
    d.start('luna_drawer.use', false);
    expect(d.test('!luna_drawer_open')).toBe(true);
  });

  it('delivers the parcel to the fixer, once', () => {
    const d = new Dialogue(null);
    d.take('parcel');
    d.start('fixer.use_parcel', false);
    expect(d.test('parcel_delivered && !(carried has parcel)')).toBe(true);
    expect(d.start('fixer.use_parcel', false)[0].text).toMatch(/already/);
  });

  it('keeps it all in a save', () => {
    const d = new Dialogue(null);
    d.take('paper_notebook');
    const again = new Dialogue(d.save());
    expect(again.carried()).toContain('paper_notebook');
    expect(again.took('paper_notebook')).toBe(true);
  });

  it('reads a tag as a command only if it is one', () => {
    expect(commandOf('walk: desk')).toEqual({ name: 'walk', arg: 'desk' });
    expect(commandOf('go:street/from-backstreet')).toEqual({ name: 'go', arg: 'street/from-backstreet' });
    expect(commandOf('fixer')).toBeNull();
    expect(commandOf('mood: sad')).toBeNull();
  });
});

describe('a save over a story that changed', () => {
  it('keeps what she knew and carried when the story changed under where it was saved', async () => {
    const { Compiler } = await import('inkjs/full');
    const compile = (src: string) => JSON.parse(new Compiler(src).Compile().ToJson() ?? '{}');
    const before = compile(`LIST Things = valve, map\nVAR carried = (map)\nVAR met = false\n=== shop ===\n~ met = true\n~ carried += valve\nA line.\n* [Go on.] Next.\n-> END\n`);
    const after = compile(`LIST Things = valve, map\nVAR carried = (map)\nVAR met = false\nVAR added = 3\n=== store ===\nRenamed.\n-> END\n`);
    const d = new Dialogue(null, before);
    d.start('shop', false);
    // saved in the middle of the shop's knot, which the new story no longer has
    const again = new Dialogue(d.save(), after);
    expect(again.loaded).toBe('kept');
    expect(again.test('met && carried has valve && added == 3')).toBe(true);
    expect(again.start('store', false)[0].text).toBe('Renamed.');
  });

  it('starts afresh from something that is no save at all', () => {
    expect(new Dialogue('not a save').loaded).toBe('fresh');
    expect(new Dialogue(new Dialogue(null).save()).loaded).toBe('whole');
  });
});
