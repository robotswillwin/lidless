// The tower's lift, which the neighbours ride too: where it is now, for the indicators over its doors on every floor.
// Riding it, she finds it waiting where she got out; a while later someone calls it, and it goes up or down a floor
// every 1.1 seconds to them (often the lobby), waits, and goes on. The same from the same start, so it is never random
// from one frame to the next.

/** The floors it goes to: the lobby (0) up to the top. */
const TOP = 16;
/** Seconds a floor, and how long it waits where she got out, and anywhere else. */
const PER_FLOOR = 1.1, WAITS_FOR_HER = 20, WAITS: [number, number] = [6, 18];

export interface LiftNow {
  /** The floor it is at, or passing: 0 the lobby. */
  floor: number;
  /** Which way it is going: 1 up, -1 down, 0 waiting. */
  dir: -1 | 0 | 1;
}

export class Lift {
  /** Its trip now: from where, to where, when it sets off (it waits until then) and when it gets there. */
  private from = 0;
  private to = 0;
  private leaves = 0;
  private arrives = 0;
  /** How long it waits before its next trip, if not as long as anywhere: where she got out. */
  private firstWait: number | null = null;
  private seed = 1;

  constructor(floor = 0, t = 0) { this.reset(floor, t, WAITS[0]); }

  /** It stopped at a floor at time t (she got out there), and waits there a while. */
  reset(floor: number, t: number, wait = WAITS_FOR_HER): void {
    this.from = this.to = Math.max(0, Math.min(TOP, Math.round(floor)));
    this.seed = (this.to * 7919 + Math.floor(t * 13)) % 2147483647 || 1;
    this.leaves = this.arrives = t;
    this.firstWait = wait;
  }

  /** Where it is at time t: its trips worked on up to t. */
  now(t: number): LiftNow {
    // there: it waits, then the next caller is somewhere else
    for (let n = 0; t >= this.arrives && n < 1000; n++) {
      const here = this.to, wait = this.firstWait ?? WAITS[0] + this.random() * (WAITS[1] - WAITS[0]);
      this.firstWait = null;
      let next = this.random() < 0.3 ? 0 : Math.floor(this.random() * (TOP + 1));
      if (next === here) next = here === 0 ? 1 + Math.floor(this.random() * TOP) : 0;
      this.from = here;
      this.to = next;
      this.leaves = this.arrives + wait;
      this.arrives = this.leaves + Math.abs(next - here) * PER_FLOOR;
    }
    if (t < this.leaves) return { floor: this.from, dir: 0 };
    const gone = Math.floor((t - this.leaves) / PER_FLOOR), dir = this.to > this.from ? 1 : -1;
    return { floor: this.from + dir * Math.min(gone, Math.abs(this.to - this.from)), dir };
  }

  private random(): number {
    this.seed = (this.seed * 48271) % 2147483647;
    return this.seed / 2147483647;
  }
}

/** A floor as the indicators show it: G for the lobby, else its number. */
export const floorLabel = (floor: number): string => (floor <= 0 ? 'G' : String(floor));
