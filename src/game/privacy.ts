// A privacy room the Concierge sees the door of (a public restroom): by law it neither sees nor hears her inside, but it
// knows she went in and when she came out. It notices a long stay, or coming back too often, though both are her right:
// its attention rises a step, and in its view it says so as she comes out.

export interface Noticed {
  /** Seconds inside before a stay is long. */
  after: number;
  /** So many visits within her last `within` arrivals anywhere is often. */
  often: number;
  within: number;
  /** What it says as she comes out after a long stay, or after coming too often. */
  long: string;
  again: string;
}

/** What it notices as she comes out: a long stay, coming too often (her visits are her arrival counts), or nothing. */
export function noticedOnLeaving(rule: Noticed, stay: number, visits: number[], arrived: number): 'long' | 'again' | null {
  if (stay > rule.after) return 'long';
  return visits.filter((v) => arrived - v < rule.within).length >= rule.often ? 'again' : null;
}
