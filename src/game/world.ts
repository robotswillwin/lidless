// The hero on the walk line: walking, jogging or running to a point or a hotspot, keyboard walking, picking hotspots.
// Sent far, she speeds up from a walk into a jog and, further still, into a run, and slows down through them again to
// arrive at a walk. Her legs change gait only as a foot lands, so they stay in step.

import { inView, placeIn, type Gait, type Hotspot, type LevelDef } from './level';

/** How quickly she speeds up and slows down, in walking speeds a second. */
const ACCEL = 2.5, DECEL = 3;
/**
 * Where between two gaits' speeds her legs change up, and where they change down: apart, so near one speed she does not
 * flicker between two gaits.
 */
const UP = 0.35, DOWN = 0.25;
const GAITS: Gait[] = ['walk', 'jog', 'run'];

export class World {
  heroX: number;
  facing: 1 | -1;
  /** Held keyboard direction: -1, 0 or 1. */
  keyDir = 0;
  /** Running with the keys (Shift held): she speeds up through a jog into a run. */
  keyRun = false;
  moving = false;
  /** How fast she is going, in level pixels a second. */
  speed = 0;
  /** The gait her legs are in. It changes only as a foot lands. */
  gait: Gait = 'walk';
  /** How far through her gait's cycle she is, in cycles: it picks the frame. */
  phase = 0;
  private walkT = 0;
  private target: number | null = null;
  private pending: Hotspot | null = null;
  /** The fastest gait she may take to get where she is going. */
  private pace: Gait = 'walk';
  /** Raw view on screen: hotspots are where they are in it. */
  raw = false;

  constructor(readonly level: LevelDef, x?: number, facing?: 1 | -1) {
    this.heroX = this.clamp(x ?? level.hero.x);
    this.facing = facing ?? 1;
  }

  private clamp(x: number): number {
    return Math.max(this.level.walk.x0, Math.min(this.level.walk.x1, x));
  }

  /** She goes to x, and then does `then`, going no faster than `pace`. Turning back, she slows to a walk first. */
  walkTo(x: number, then: Hotspot | null = null, pace: Gait = 'walk'): void {
    const to = this.clamp(x);
    if (this.moving && Math.sign(to - this.heroX) === -this.facing) this.speed = Math.min(this.speed, this.speedOf('walk'));
    this.target = to;
    this.pending = then;
    this.pace = pace;
  }

  stop(): void {
    this.target = null;
    this.pending = null;
  }

  /** A gait's speed: from the level, or for a gait the sprite has no frames for, a faster walk. */
  speedOf(g: Gait): number {
    const h = this.level.hero;
    return h.gaits?.[g]?.speed ?? h.speed * (g === 'walk' ? 1 : g === 'jog' ? 2.2 : 3);
  }

  /** How far a cycle of a gait carries her: what its frames show, so a foot stays where it lands. */
  private strideOf(g: Gait): number {
    const gs = this.level.hero.gaits;
    return gs?.[g]?.stride ?? gs?.walk?.stride ?? 0;
  }

  /** The gait for a speed: up or down a gait past its margin, from the gait she is in. */
  private gaitFor(v: number): Gait {
    const i = GAITS.indexOf(this.gait), next = GAITS[i + 1], prev = GAITS[i - 1], at = (g: Gait) => this.speedOf(g);
    if (next && v > at(this.gait) + UP * (at(next) - at(this.gait))) return next;
    if (prev && v < at(prev) + DOWN * (at(this.gait) - at(prev))) return prev;
    return this.gait;
  }

  private rest(): void {
    this.moving = false;
    this.speed = 0;
    this.gait = 'walk';
    this.phase = 0;
  }

  /** Advance by dt seconds. Returns the hotspot the hero just reached, if any. */
  update(dt: number): Hotspot | null {
    const walk = this.speedOf('walk');
    let arrived: Hotspot | null = null, dir = 0, goal = 0, left = Infinity;
    if (this.keyDir !== 0) {
      this.stop();
      dir = this.keyDir;
      goal = this.speedOf(this.keyRun ? 'run' : 'walk');
    } else if (this.target !== null) {
      const dx = this.target - this.heroX;
      if (Math.abs(dx) < 1) {
        this.heroX = this.target;
        this.target = null;
        this.rest();
        if (this.pending) {
          const h = this.pending;
          this.pending = null;
          const { rect, face } = placeIn(h, this.raw), cx = rect[0] + rect[2] / 2;
          this.facing = face ?? (cx >= this.heroX ? 1 : -1);
          arrived = h;
        }
      } else {
        dir = Math.sign(dx);
        left = Math.abs(dx);
        // as fast as her pace allows, and no faster than she can slow down from to be walking a stride before she
        // gets there: her last steps are walked
        const walkIn = this.strideOf('walk') || walk * 0.5;
        goal = Math.min(this.speedOf(this.pace), Math.sqrt(walk * walk + 2 * DECEL * walk * Math.max(0, left - walkIn)));
      }
    } else this.rest();
    if (dir !== 0) {
      // from standing she sets off at a walk, then speeds up or slows down towards her goal
      if (!this.moving) this.speed = walk;
      this.speed = this.speed < goal ? Math.min(goal, this.speed + ACCEL * walk * dt) : Math.max(goal, this.speed - DECEL * walk * dt);
      const from = this.heroX;
      this.heroX = this.clamp(this.heroX + dir * Math.min(left, this.speed * dt));
      this.facing = dir > 0 ? 1 : -1;
      this.moving = true;
      // her legs: on through the cycle by the ground covered, and into another gait as a foot lands
      const stride = this.strideOf(this.gait), before = this.phase;
      if (stride > 0) this.phase += Math.abs(this.heroX - from) / stride;
      const want = this.gaitFor(this.speed);
      if (want !== this.gait && (Math.floor(before * 2) !== Math.floor(this.phase * 2) || stride <= 0)) this.gait = want;
    }
    this.walkT = this.moving ? this.walkT + dt : 0;
    return arrived;
  }

  /** A one-pixel step bob while walking, for a hero sprite without a walk cycle. */
  get bob(): number {
    return this.moving && Math.floor(this.walkT * 4.4) % 2 === 1 ? -1 : 0;
  }

  /** `look` is how far the camera has moved from the scene's start: hotspots on far layers have moved less. */
  hotspotAt(x: number, y: number, raw: boolean, look = 0): Hotspot | null {
    const hs = this.level.hotspots;
    for (let i = hs.length - 1; i >= 0; i--) {
      if (!inView(hs[i], raw)) continue;
      const [rx0, ry, rw, rh] = placeIn(hs[i], raw).rect, rx = rx0 - look * ((hs[i].parallax ?? 1) - 1);
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return hs[i];
    }
    return null;
  }
}
