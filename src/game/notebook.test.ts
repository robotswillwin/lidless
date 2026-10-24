import { describe, expect, it } from 'vitest';
import { keysOf, notebookNow, type Notebook } from './notebook';

const nb: Notebook = {
  warning: "don't read this where it can see",
  pages: [
    { id: 'errands', title: 'errands', entries: [
      { id: 'parcel', name: 'parcel 4471', done: 'delivered', lines: ['to the radio repair.', { text: 'on his bench now.', when: 'delivered' }] },
      { id: 'radio', name: 'my radio', lines: ['needs a valve.'], thing: 'matches' },
    ] },
    { id: 'people', title: 'people', empty: 'nobody yet.', entries: [{ id: 'fixer', name: 'the fixer', when: 'has_raw', lines: ['radio shop.'] }] },
    { id: 'questions', title: 'ask it', when: 'has_raw', list: true, entries: [{ id: 'weather', name: 'what is weather?' }] },
    { id: 'later', title: 'later', entries: [{ id: 'x', name: 'x', when: 'never' }] },
  ],
};
const story = (...on: string[]) => (c: string) => on.includes(c);

describe('her notebook', () => {
  it('has what the story has had her write: pages, entries and lines whose conditions hold', () => {
    const pages = notebookNow(nb, story(), new Set());
    expect(pages.map((p) => p.id)).toEqual(['errands', 'people']);
    expect(pages[0].entries.map((e) => e.lines.map((l) => l.text))).toEqual([['to the radio repair.'], ['needs a valve.']]);
    // a page with nothing on it yet says so; one with no word for that waits until something is written
    expect(pages[1]).toMatchObject({ entries: [], empty: 'nobody yet.' });
    const later = notebookNow(nb, story('has_raw', 'delivered'), new Set());
    expect(later.map((p) => p.id)).toEqual(['errands', 'people', 'questions']);
    expect(later[2].list).toBe(true);
  });

  it('carries the thing an entry shows, and none where it has none', () => {
    const [errands] = notebookNow(nb, story(), new Set());
    expect(errands.entries.map((e) => e.thing)).toEqual([undefined, 'matches']);
  });

  it('crosses out an errand run and puts it last, with what she learned', () => {
    const [errands] = notebookNow(nb, story('delivered'), new Set());
    expect(errands.entries.map((e) => [e.name, e.done])).toEqual([['my radio', false], ['parcel 4471', true]]);
    expect(errands.entries[1].lines.map((l) => l.text)).toEqual(['to the radio repair.', 'on his bench now.']);
  });

  it('keeps one book\'s keys apart from the other\'s', () => {
    const [errands] = notebookNow(nb, story(), new Set(), 'journal:');
    expect(errands.entries[0].key).toBe('journal:errands/parcel');
    expect(notebookNow(nb, story(), new Set(['errands/parcel']), 'journal:')[0].entries[0].new).toBe(true);
  });

  it('marks what she has not read, and nothing once she has read the page', () => {
    let read = new Set<string>();
    let [errands] = notebookNow(nb, story(), read);
    expect(errands.fresh).toBe(true);
    read = new Set(keysOf(errands));
    [errands] = notebookNow(nb, story(), read);
    expect(errands.fresh).toBe(false);
    // the story moves on: a new line, and the errand crossed out, are new to her
    [errands] = notebookNow(nb, story('delivered'), read);
    const parcel = errands.entries.find((e) => e.key === 'errands/parcel')!;
    expect(parcel.lines.map((l) => l.fresh)).toEqual([false, true]);
    expect(parcel.new).toBe(true);
    expect(errands.entries.find((e) => e.key === 'errands/radio')!.fresh).toBe(false);
  });
});
