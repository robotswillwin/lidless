// The hero on the walk line: walking to a point or a hotspot, keyboard walking, picking hotspots.

import { inView, type Hotspot, type LevelDef } from './level';

export class World {
  heroX: number;
  facing: 1 | -1;
  /** Held keyboard direction: -1, 0 or 1. */
  keyDir = 0;
  moving = false;
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

  walkTo(x: number, then: Hotspot | null = null): void {
    this.target = this.clamp(x);
    this.pending = then;
  }

  stop(): void {
    this.target = null;
    this.pending = null;
  }

  /** Advance by dt seconds. Returns the hotspot the hero just reached, if any. */
  update(dt: number): Hotspot | null {
    const speed = this.level.hero.speed, startX = this.heroX;
    let arrived: Hotspot | null = null;
    if (this.keyDir !== 0) {
      this.stop();
      this.heroX = this.clamp(this.heroX + this.keyDir * speed * dt);
      this.facing = this.keyDir > 0 ? 1 : -1;
      this.moving = true;
    } else if (this.target !== null) {
      const dx = this.target - this.heroX;
      if (Math.abs(dx) < 1) {
        this.heroX = this.target;
        this.target = null;
        this.moving = false;
        if (this.pending) {
          const h = this.pending;
          this.pending = null;
          const cx = h.rect[0] + h.rect[2] / 2;
          this.facing = h.face ?? (cx >= this.heroX ? 1 : -1);
          arrived = h;
        }
      } else {
        this.heroX += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
        this.facing = dx > 0 ? 1 : -1;
        this.moving = true;
      }
    } else this.moving = false;
    this.walked += Math.abs(this.heroX - startX);
    this.walkT = this.moving ? this.walkT + dt : 0;
    return arrived;
  }

  /** A one-pixel step bob while walking, for a hero sprite without a walk cycle. */
  get bob(): number {
    return this.moving && Math.floor(this.walkT * 4.4) % 2 === 1 ? -1 : 0;
  }

  /** `look` is how far the camera is from the scene's start, its lean included: far hotspots have moved less. */
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
