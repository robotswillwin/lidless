// What she wears, as the game holds it: her clothes (one of the world's outfits) and a projection over them, each a
// sprite loaded the first time she wears it and let go when she takes it off. Not her coat, which she wears whenever
// she goes out: a phone holds two of her at most. outfits.ts has the rules; this holds the state and the sprites.

import type { Sprite } from '../engine/assets';
import { dressedFor, keepsProjection, type Outfits } from './outfits';

export class Wardrobe {
  /** What she wears: an outfit's key. */
  outfit: string;
  /** A projection over it (a virtual outfit), if one is on. */
  projection: string | null;
  /** Her sprite in her clothes, and in the projection over them. */
  sprite: Sprite;
  projected: Sprite | null = null;
  private readonly sprites = new Map<string, Promise<Sprite>>();

  /**
   * `coat` is her first sprite's path (`first`, loaded before the game starts); `saved` what a save says she wore.
   * `load` and `free` put an outfit's sprite on the GPU and let it go.
   */
  constructor(
    readonly outfits: Outfits,
    private readonly coat: string,
    first: Sprite,
    saved: { outfit?: string; projection?: string; start?: string },
    private readonly load: (path: string) => Promise<Sprite>,
    private readonly free: (s: Sprite) => void,
  ) {
    this.sprite = first;
    this.sprites.set(coat, Promise.resolve(first));
    const was = saved.outfit && outfits[saved.outfit] ? saved.outfit : undefined;
    // a projection saved as what she wore (an older save) goes back on over her own clothes
    this.projection = saved.projection && outfits[saved.projection]?.virtual ? saved.projection : was && outfits[was].virtual ? was : null;
    this.outfit = was && !outfits[was].virtual ? was : saved.start ?? Object.keys(outfits).find((k) => !outfits[k].virtual) ?? '';
    // and over what it is worn over
    if (this.projection && !keepsProjection(outfits, this.projection, this.outfit)) this.outfit = dressedFor(outfits, this.projection) ?? this.outfit;
  }

  /** Her sprite as a view shows her: a projection over her clothes in the Concierge's, her clothes in raw view. */
  shown(raw: boolean): Sprite {
    return !raw && this.projected ? this.projected : this.sprite;
  }

  /** She changes into an outfit (her own clothes). */
  async wear(key: string): Promise<void> {
    const o = this.outfits[key];
    if (!o) return;
    const was = this.outfits[this.outfit]?.sprite;
    this.sprite = await this.spriteOf(o.sprite);
    this.outfit = key;
    this.letGo(was, [o.sprite, this.projection ? this.outfits[this.projection]?.sprite : undefined]);
  }

  /** A projection put on her, or taken off (null). */
  async project(key: string | null): Promise<void> {
    const was = this.projection ? this.outfits[this.projection]?.sprite : undefined, o = key ? this.outfits[key] : undefined;
    this.projected = o?.virtual ? await this.spriteOf(o.sprite) : null;
    this.projection = this.projected ? key : null;
    this.letGo(was, [o?.sprite, this.outfits[this.outfit]?.sprite]);
  }

  /** Her sprite in an outfit, loaded the first time she wears it. */
  private spriteOf(path: string): Promise<Sprite> {
    if (!this.sprites.has(path)) this.sprites.set(path, this.load(path));
    return this.sprites.get(path)!;
  }

  /** What she took off is let go, loaded again if she wears it again: unless she still wears it, or it is her coat. */
  private letGo(path: string | undefined, worn: (string | undefined)[]): void {
    if (!path || path === this.coat || worn.includes(path)) return;
    const off = this.sprites.get(path);
    this.sprites.delete(path);
    void off?.then((s) => this.free(s));
  }
}
