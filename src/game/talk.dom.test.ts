// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { Talk } from './talk';

const make = () => {
  const root = document.createElement('div');
  document.body.append(root);
  const talk = new Talk(root, () => [100, 100]);
  const line = root.querySelector<HTMLElement>('.talk-line')!;
  return { root, talk, line };
};

describe('what she says and what she thinks', () => {
  it('shows a line of hers without quotes as a thought, and one in quotes as said, the quotes typographic', () => {
    const { talk, line } = make();
    talk.show([{ text: 'Better not touch her work.', speaker: 'luna' }], []);
    expect(line.dataset.mode).toBe('thought');
    expect(line.textContent).toBe('Better not touch her work.');
    talk.next();
    talk.show([{ text: '"Good morning, CO."', speaker: 'luna' }], []);
    expect(line.dataset.mode).toBe('said');
    expect(line.textContent).toBe('“Good morning, CO.”');
  });

  it('says an answer she picked aloud, and everyone else\'s lines, quoted or not', () => {
    const { talk, line } = make();
    talk.show([], [], 'How much is a beer?');
    expect(line.dataset.mode).toBe('said');
    talk.next();
    talk.show([{ text: '"No. Nobody is, anymore."', speaker: 'fixer' }], []);
    expect(line.dataset.mode).toBe('said');
    expect(line.dataset.voice).toBe('warm');
  });
});

describe('the Concierge\'s lines', () => {
  it('go through its box when it takes them, with no line on the scene, and the box is told when they are over', () => {
    const { talk, line } = make();
    const said: string[] = [];
    let done = 0;
    talk.viaCard = (text) => { said.push(text); return true; };
    talk.cardDone = () => { done++; };
    talk.show([{ text: '"Step back from it."', speaker: 'concierge' }, { text: 'Fine. It is a box.', speaker: 'luna' }], []);
    expect(said).toEqual(['"Step back from it."']);
    expect(line.hidden).toBe(true);
    talk.next(); // her line: the box is put away first
    expect(done).toBe(1);
    expect(line.hidden).toBe(false);
    expect(line.dataset.mode).toBe('thought');
  });

  it('keep the box out from one of its lines to the next, swapping the words, not folding in between', () => {
    const { talk } = make();
    let done = 0;
    talk.viaCard = () => true;
    talk.cardDone = () => { done++; };
    talk.show([{ text: '"One."', speaker: 'concierge' }, { text: '"Two."', speaker: 'concierge' }], []);
    talk.next();
    expect(done).toBe(0);
    talk.next(); // the end: put away
    expect(done).toBe(1);
  });

  it('fall back to a line on the scene when the box is not there (raw view)', () => {
    const { talk, line } = make();
    talk.viaCard = () => false;
    talk.show([{ text: '"Step back."', speaker: 'concierge' }], []);
    expect(line.hidden).toBe(false);
    expect(line.dataset.voice).toBe('co');
    vi.restoreAllMocks();
  });
});
