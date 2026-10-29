// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sound', () => ({ sounds: { play: () => {} } }));
const { Concierge } = await import('./concierge');

describe('the Concierge speaking from its box', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('folds its box out with the line in it, takes a second line into the same fold, and folds back in when done', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const co = new Concierge(root);
    co.say('That cabinet is the city\'s.', [], 5000);
    const fold = root.querySelector<HTMLElement>('.co-fold')!;
    expect(fold).not.toBeNull();
    expect(fold.classList.contains('in')).toBe(true);
    expect(fold.closest('.co')).not.toBeNull(); // inside its own box, not beside it
    expect(fold.textContent).toContain('That cabinet');
    co.say('Please step back.', [], 5000);
    expect(root.querySelectorAll('.co-fold').length).toBe(1);
    expect(fold.textContent).toContain('step back');
    co.dismiss();
    expect(fold.classList.contains('out')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(root.querySelector('.co-fold')).toBeNull();
  });

  it('says a line in the open card instead, and gives the card its own words back after', () => {
    const root = document.createElement('div');
    document.body.append(root);
    const co = new Concierge(root);
    co.open({ words: 'Welcome home, Luna.', reminders: [], unheard: false });
    const words = () => root.querySelector('.co-words')?.textContent ?? '';
    expect(words()).toBe('Welcome home, Luna.');
    co.say('Authorised technicians only.', [], 3000);
    expect(words()).toBe('Authorised technicians only.');
    expect(root.querySelector('.co-fold')).toBeNull();
    vi.advanceTimersByTime(3500);
    expect(words()).toBe('Welcome home, Luna.');
  });
});
