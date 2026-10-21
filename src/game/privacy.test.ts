import { describe, expect, it } from 'vitest';
import { noticedOnLeaving } from './privacy';

const rule = { after: 120, often: 3, within: 8, long: 'long', again: 'again' };

describe('a privacy room with its door in sight', () => {
  it('notices a long stay', () => {
    expect(noticedOnLeaving(rule, 30, [5], 5)).toBeNull();
    expect(noticedOnLeaving(rule, 130, [5], 5)).toBe('long');
  });

  it('notices coming back too often, within her last arrivals', () => {
    expect(noticedOnLeaving(rule, 20, [2, 9], 9)).toBeNull();
    expect(noticedOnLeaving(rule, 20, [3, 6, 9], 9)).toBe('again');
    // long ago does not count
    expect(noticedOnLeaving(rule, 20, [1, 6, 9], 9)).toBeNull();
  });
});
