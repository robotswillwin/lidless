import { describe, expect, it } from 'vitest';
import { savedWhen } from './title';

describe('the title screen', () => {
  it('says when the game in progress was saved as a player would: today, yesterday, or the date', () => {
    const now = new Date(2026, 9, 24, 15, 0).getTime();
    expect(savedWhen(new Date(2026, 9, 24, 13, 24).getTime(), now)).toMatch(/^Today at \S/);
    expect(savedWhen(new Date(2026, 9, 23, 23, 50).getTime(), now)).toMatch(/^Yesterday at \S/);
    const older = savedWhen(new Date(2026, 9, 2, 9, 5).getTime(), now);
    expect(older).toMatch(/ at \S/);
    expect(older).not.toMatch(/^(Today|Yesterday)/);
  });
});
