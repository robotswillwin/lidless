import { describe, expect, it } from 'vitest';
import { commandOf, Dialogue } from './dialogue';

describe('the story', () => {
  it('keeps what she carries, and what she has picked up for good', () => {
    const d = new Dialogue(null);
    expect(d.carried()).toEqual(['credits', 'matches', 'cigarettes', 'map']);
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

  it('reads conditions on its state', () => {
    const d = new Dialogue(null);
    expect(d.test('!has_raw && carried has map')).toBe(true);
    expect(d.test('carried has valve')).toBe(false);
    d.take('valve');
    expect(d.test('carried has valve && taken has valve')).toBe(true);
  });

  it('runs an object\'s stitches: the radio needs a valve, and with one she hears a voice', () => {
    const d = new Dialogue(null);
    expect(d.has('radio', 'use')).toBe(true);
    expect(d.has('radio', 'take')).toBe(false);
    expect(d.start('radio.use', true).map((l) => l.text).join(' ')).toMatch(/needs another/);
    d.take('valve');
    const lines = d.start('radio.use', true);
    expect(lines.some((l) => l.commands?.some((c) => c.name === 'wait'))).toBe(true);
    expect(d.test('radio_heard && !(carried has valve)')).toBe(true);
    expect(lines.at(-1)?.speaker).toBe('luna');
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
    d.take('valve');
    const again = new Dialogue(d.save());
    expect(again.carried()).toContain('valve');
    expect(again.took('valve')).toBe(true);
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
