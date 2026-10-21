import { describe, expect, it } from 'vitest';
import { rotateOnArrival } from './rotate';

describe('a scene by turns', () => {
  it('turns to the next value each time she arrives, round and round', () => {
    const rot = { seat: { values: ['woman', '', 'man'] } };
    let counts: Record<string, number> = {};
    const seen: string[] = [];
    for (let k = 0; k < 5; k++) { const r = rotateOnArrival(rot, counts, () => true); counts = r.counts; seen.push(r.set.seat); }
    expect(seen).toEqual(['woman', '', 'man', 'woman', '']);
  });

  it('waits, with `from`, until its condition holds', () => {
    const rot = { seat: { values: ['woman', '', 'man'], from: 'has_raw' } };
    let raw = false, counts: Record<string, number> = {};
    const step = () => { const r = rotateOnArrival(rot, counts, (c) => c === 'has_raw' && raw); counts = r.counts; return r.set.seat; };
    expect(step()).toBeUndefined();
    expect(step()).toBeUndefined();
    raw = true;
    expect([step(), step(), step()]).toEqual(['woman', '', 'man']);
  });
});
