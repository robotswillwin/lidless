// What she wears. Each outfit is a sprite of its own, and where she is decides what she can wear. At home (a scene with a
// wardrobe) she takes off her coat as she comes in and can change into anything she has; as she leaves she puts her coat
// on over home clothes, goes out as she is in what can be worn outside, and does not go out at all in what cannot.

export interface Outfit {
  /** Her sprite in it, as an asset path: cast/hero. */
  sprite: string;
  /** What it is called where she picks it. */
  name: string;
  /** Leaving home in it: true, she goes as she is; an outfit's key, she changes into that; left out, she stays in. */
  out?: true | string;
  /** Coming home in it: the outfit she changes into (out of her coat); left out, she stays in it. */
  home?: string;
  /** What she says when she will not go out in it. */
  stay?: string;
}

export type Outfits = Record<string, Outfit>;

/**
 * What she wears after going from one place to another, at home or not: changed at home's door, or null if she will
 * not go out in it.
 */
export function outfitAfter(outfits: Outfits, wearing: string, fromHome: boolean, toHome: boolean): string | null {
  let o = outfits[wearing] ? wearing : Object.keys(outfits)[0];
  if (fromHome && !toHome) {
    const out = outfits[o]?.out;
    if (out === undefined) return null;
    if (out !== true && outfits[out]) o = out;
  }
  if (toHome && !fromHome) {
    const home = outfits[o]?.home;
    if (home && outfits[home]) o = home;
  }
  return o;
}

/** What she is shown in where she arrives first, as the editor shows her: her first outfit, changed if it is at home. */
export const outfitIn = (outfits: Outfits, first: string, home: boolean): string => outfitAfter(outfits, first, false, home) ?? first;
