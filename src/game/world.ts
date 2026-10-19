// The hero on the walk line: walking or running to a point or a hotspot, keyboard walking, picking hotspots.

import { inView, type Hotspot, type LevelDef } from './level';

export class World {
  heroX: number;
  facing: 1 | -1;
  /** Held keyboard direction: -1, 0 or 1. */
  keyDir = 0;
  /** Running with the keys (Shift held). */
  keyRun = false;
  moving = false;
  /** Running, not walking: where she was sent was far off, or Shift is held. */
  running = false;
  /** Distance walked so far, which drives the walk cycle. */
  walked = 0;
  private walkT = 0;
  private target: number | null = null;
  private pending: Hotspot | null = null;

  constructor(readonly level: LevelDef, x?: number, facing?: 1 | -1) {
    this.heroX = this.clamp(x ?? level.hero.x);
    this.facing = facing ?? 1;
  }

  private clamp(x: number): number {
    return Math.max(this.level.walk.x0, Math.min(this.level.walk.x1, x));
  }

  /** She goes to x, and then does `then`; running, if `run`. */
  walkTo(x: number, then: Hotspot | null = null, run = false): void {
    this.target = this.clamp(x);
    this.pending = then;
    this.running = run;
  }

  stop(): void {
    this.target = null;
    this.pending = null;
    this.running = false;
  }

  /** Her pace now: running about twice as fast as she walks if the sprite has no run of its own to set it. */
  private get speed(): number {
    const h = this.level.hero;
    return this.running ? h.runSpeed ?? h.speed * 2.2 : h.speed;
  }

  /** Advance by dt seconds. Returns the hotspot the hero just reached, if any. */
  update(dt: number): Hotspot | null {
    const startX = this.heroX;
    let arrived: Hotspot | null = null;
    if (this.keyDir !== 0) {
      this.stop();
      this.running = this.keyRun;
      this.heroX = this.clamp(this.heroX + this.keyDir * this.speed * dt);
      this.facing = this.keyDir > 0 ? 1 : -1;
      this.moving = true;
    } else if (this.target !== null) {
      const dx = this.target - this.heroX;
      if (Math.abs(dx) < 1) {
        this.heroX = this.target;
        this.target = null;
        this.moving = false;
        this.running = false;
        if (this.pending) {
          const h = this.pending;
          this.pending = null;
          const cx = h.rect[0] + h.rect[2] / 2;
          this.facing = h.face ?? (cx >= this.heroX ? 1 : -1);
          arrived = h;
        }
      } else {
        this.heroX += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt);
        this.facing = dx > 0 ? 1 : -1;
        this.moving = true;
      }
    } else {
      this.moving = false;
      this.running = false;
    }
    this.walked += Math.abs(this.heroX - startX);
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
      const [rx0, ry, rw, rh] = hs[i].rect, rx = rx0 - look * ((hs[i].parallax ?? 1) - 1);
      if (x >= rx && x < rx + rw && y >= ry && y < ry + rh) return hs[i];
    }
    return null;
  }
}
