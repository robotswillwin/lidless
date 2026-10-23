// The time of day. A new game starts when the world says (world.json "clock", "07:12"), a save goes on from when it was
// saved, and the clock runs with real time. The Concierge greets her by it, and the story knows the part of the day
// (day_part); its view is evening whatever the clock says (decision 29).

/** "07:12" as minutes after midnight; anything else, `fallback` (the evening the game was first made in). */
export function parseClock(s: string | undefined, fallback = 21 * 60 + 40): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s ?? '');
  return m ? (Number(m[1]) * 60 + Number(m[2])) % 1440 : fallback;
}

/** The minute of the day `seconds` after a clock that started at `start`. */
export const minuteAt = (start: number, seconds: number): number => (((start + Math.floor(seconds / 60)) % 1440) + 1440) % 1440;

export const clockText = (minute: number): string => `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

export function dayPart(minute: number): DayPart {
  const h = minute / 60;
  return h >= 5 && h < 12 ? 'morning' : h >= 12 && h < 17 ? 'afternoon' : h >= 17 && h < 22 ? 'evening' : 'night';
}

/** Its greeting at a time: "Good morning, Luna."; at night it still says good evening. */
export const greetingAt = (minute: number): string => `Good ${dayPart(minute) === 'night' ? 'evening' : dayPart(minute)}, Luna.`;

/** A scene's own greeting at a time, its "Good evening" the time of day's; with none, the time of day's. */
export function greetingFor(own: string | undefined, minute: number): string {
  if (!own) return greetingAt(minute);
  return own.replace(/^Good (morning|afternoon|evening)/, greetingAt(minute).replace(/, Luna\.$/, ''));
}
