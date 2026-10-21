import { describe, expect, it } from 'vitest';
import { upgrade } from './save';

describe('saves', () => {
  it('bring an older save up to date, and know one that is none', () => {
    const old = { v: 1, scene: 'home', heroX: 400, facing: 1, view: 1, ink: null };
    expect(upgrade(old)).toEqual({ ...old, v: 2 });
    expect(upgrade({ ...old, v: 2, savedAt: 5, where: 'Home' })?.where).toBe('Home');
    expect(upgrade({ ...old, v: 3 })).toBeNull();
    expect(upgrade({ v: 2 })).toBeNull();
    expect(upgrade('nonsense')).toBeNull();
  });
});
