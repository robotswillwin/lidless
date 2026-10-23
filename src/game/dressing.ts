// What she wears in a session: her outfits' sprites (wardrobe.ts), the one the view on screen shows (a projection over
// her clothes in the Concierge's), her pace fitted to its stride, her wardrobe at home as answers to pick from, and
// changing, behind a moment's fade.

import { freeSprite, loadSprite, spriteDefaults, type Sprite } from '../engine/assets';
import type { Game } from './game';
import { heroGaits } from './hero';
import { dressedFor, keepsProjection } from './outfits';
import type { Scene } from './scenefile';
import { Wardrobe } from './wardrobe';

export class Dressing {
  /** What she wears: her clothes, a projection over them, and her sprites in them. */
  readonly wardrobe: Wardrobe;

  constructor(private readonly g: Game) {
    const s = g.setup, gl = s.renderer.gl;
    this.wardrobe = new Wardrobe(s.world.hero.outfits ?? {}, s.world.hero.sprite, s.hero, { outfit: s.save?.outfit, projection: s.save?.projection, start: s.world.hero.outfit },
      (path) => { const cut = path.lastIndexOf('/'); return loadSprite(gl, `${s.assets}/${path.slice(0, cut)}`, path.slice(cut + 1), spriteDefaults(gl), g.bust); },
      (sprite) => freeSprite(gl, sprite));
  }

  get outfit(): string { return this.wardrobe.outfit; }
  get projection(): string | null { return this.wardrobe.projection; }

  /** Her sprite as the view on screen shows her: a projection over her clothes in the Concierge's, her clothes in raw view. */
  get shown(): Sprite {
    return this.wardrobe.shown(this.g.raw);
  }

  /** A projection put on her, or taken off; her gaits are its sprite's in the Concierge's view. */
  async project(key: string | null): Promise<void> {
    await this.wardrobe.project(key);
    if (this.g.scene) this.fit(this.g.scene);
  }

  wear(key: string): Promise<void> {
    return this.wardrobe.wear(key);
  }

  /**
   * Her pace follows her stride at her size here, so each foot stays where it lands; each gait the same way, a jog and a
   * run longer strides at a quicker cadence. Only the gaits she has in what she wears.
   */
  fit(scene: Scene): void {
    const gaits = heroGaits(this.shown.def, this.g.setup.world.hero, scene.file.actorScale ?? 1);
    scene.level.hero.gaits = gaits;
    if (gaits.walk) scene.level.hero.speed = gaits.walk.speed;
  }

  /**
   * Her wardrobe: what she wears at home, as answers to pick from, and a way out of it. Not her coat: she takes that off
   * as she comes in, it hangs by the door, and she puts it on as she leaves.
   */
  open(): void {
    const g = this.g, outfits = g.setup.world.hero.outfits;
    if (!outfits) return;
    // her own clothes; in the Concierge's view also what her AR system can put on her, and taking it off
    const own = Object.keys(outfits).filter((k) => !outfits[k].home && !outfits[k].virtual);
    const projections = g.raw ? [] : Object.keys(outfits).filter((k) => outfits[k].virtual);
    g.offer([
      ...own.map((k) => ({ label: `${outfits[k].name}${k === this.outfit ? ' (wearing)' : ''}`, pick: () => { if (k !== this.outfit) void this.change(k); } })),
      ...projections.map((k) => ({ label: `${outfits[k].name}, projected${k === this.projection ? ' (on)' : ''}`, pick: () => { if (k !== this.projection) void this.change(k); } })),
      ...(this.projection && !g.raw ? [{ label: 'Projection off', pick: () => void this.change(null) }] : []),
    ]);
  }

  /**
   * She changes clothes where she stands, behind a moment's fade, held for `hold` ms more where a while passes: into her
   * own clothes, or a projection put on or (null) taken off over them. Where a while passes (the shower), the projection
   * comes off with her clothes. The fade lifts on her facing us.
   */
  async change(key: string | null, hold = 0): Promise<void> {
    const g = this.g;
    g.setup.fade.classList.add('on');
    await new Promise((r) => setTimeout(r, g.setup.reduceMotion ? 0 : 260 + hold));
    try {
      const outfits = g.setup.world.hero.outfits ?? {}, virtual = key ? outfits[key]?.virtual : true;
      if (virtual) {
        // a projection goes on over her clothes: she dresses in them first, so raw view shows her dressed
        const under = key ? dressedFor(outfits, key) : undefined;
        if (under && outfits[under] && !keepsProjection(outfits, key!, this.outfit)) await this.wear(under);
        await this.project(key);
      } else if (key) {
        await this.wear(key);
        // undressing takes a projection off with her clothes, as the shower does
        if (hold || (this.projection && !keepsProjection(outfits, this.projection, key))) await this.project(null);
      }
      this.fit(g.scene);
      g.persist();
      // changed, out of the shower or dressed, she faces us until she moves
      g.turns.out = true;
    } catch (err) {
      g.ui.showCaption(`Those clothes are not made yet (${err instanceof Error ? err.message : String(err)}).`);
    }
    g.setup.fade.classList.remove('on');
  }
}
