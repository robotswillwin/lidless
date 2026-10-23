import { describe, expect, it } from 'vitest';
import { clockText, dayPart, greetingFor, minuteAt, parseClock } from './clock';

describe('the time of day', () => {
  it('starts where the world or a save says, and runs with real time', () => {
    expect(parseClock('07:12')).toBe(432);
    expect(parseClock(undefined)).toBe(21 * 60 + 40);
    expect(clockText(minuteAt(432, 59))).toBe('7:12');
    expect(clockText(minuteAt(432, 61))).toBe('7:13');
    expect(clockText(minuteAt(23 * 60 + 59, 60))).toBe('0:00');
  });

  it('greets her by the part of the day, a place keeping its own words', () => {
    expect(dayPart(432)).toBe('morning');
    expect(dayPart(23 * 60)).toBe('night');
    expect(greetingFor(undefined, 432)).toBe('Good morning, Luna.');
    expect(greetingFor('Good evening, Luna.', 13 * 60)).toBe('Good afternoon, Luna.');
    expect(greetingFor('Good evening, Luna.', 23 * 60)).toBe('Good evening, Luna.');
    expect(greetingFor('Welcome home, Luna.', 432)).toBe('Welcome home, Luna.');
  });
});
