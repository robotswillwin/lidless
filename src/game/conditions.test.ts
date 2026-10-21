import { describe, expect, it } from 'vitest';
import { conditionProblem, holds, variablesIn } from './conditions';

const state: Record<string, unknown> = { has_raw: true, favours_owed: 1, conditions: 'rain', none: false, carried: ['parcel', 'valve'], empty: [] };
const read = (n: string) => state[n];

describe('conditions on the story', () => {
  it('hold with no condition, and read a variable as true or false', () => {
    expect(holds(undefined, read)).toBe(true);
    expect(holds('', read)).toBe(true);
    expect(holds('has_raw', read)).toBe(true);
    expect(holds('none', read)).toBe(false);
    expect(holds('empty', read)).toBe(false);
  });

  it('read not, and, or, grouping, in symbols or words', () => {
    expect(holds('!has_raw', read)).toBe(false);
    expect(holds('not none', read)).toBe(true);
    expect(holds('has_raw && none', read)).toBe(false);
    expect(holds('has_raw and !none', read)).toBe(true);
    expect(holds('none || has_raw', read)).toBe(true);
    expect(holds('!(none or has_raw)', read)).toBe(false);
  });

  it('compare numbers and words', () => {
    expect(holds('favours_owed >= 1', read)).toBe(true);
    expect(holds('favours_owed > 1', read)).toBe(false);
    expect(holds('conditions == "rain"', read)).toBe(true);
    expect(holds("conditions != 'fog'", read)).toBe(true);
    expect(holds('has_raw == true', read)).toBe(true);
  });

  it('ask a list whether it holds an item, or all of several', () => {
    expect(holds('carried has valve', read)).toBe(true);
    expect(holds('carried has (parcel, valve)', read)).toBe(true);
    expect(holds('carried has (parcel, radio)', read)).toBe(false);
    expect(holds('!(carried has radio)', read)).toBe(true);
    // Ink's own lists answer by name
    const ink = { ContainsItemNamed: (n: string) => n === 'map', Count: 1 };
    expect(holds('pockets has map', (n) => (n === 'pockets' ? ink : undefined))).toBe(true);
  });

  it('say what is wrong with one it cannot read, and name the variables one reads', () => {
    expect(conditionProblem('has_raw &&')).toMatch(/ends too soon/);
    expect(conditionProblem('has_raw )')).toMatch(/unexpected/);
    expect(conditionProblem('carried has')).toMatch(/name expected/);
    expect(conditionProblem('favours_owed >= 1 && carried has valve')).toBeNull();
    expect(variablesIn('favours_owed >= 1 && carried has (valve, radio) || !has_raw').sort()).toEqual(['carried', 'favours_owed', 'has_raw']);
  });
});
