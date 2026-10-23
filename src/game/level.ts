// Level data: where you can walk, where the hero starts, and the things you can look at or talk to.

/** Text that can differ between Concierge view and raw view. */
export type ViewText = string | { concierge: string; raw: string };

/** A label under a name: a plain string is the Concierge's own and shows only in its view; `raw` is her note in raw view. */
export type ViewNote = string | { concierge?: string; raw?: string };

export interface Hotspot {
  id: string;
  name: ViewText;
  /** x, y, w, h in level pixels. */
  rect: [number, number, number, number];
  /** For something on a layer that is not the street's: that layer's parallax, so the hotspot moves with it. */
  parallax?: number;
  /** Where the hero walks to before interacting; look-only hotspots far away can leave it out. */
  stand?: number;
  /** Which way the hero faces when she gets there. */
  face?: 1 | -1;
  look?: ViewText;
  /** Using it (the Use verb): what she finds when she does. */
  use?: ViewText;
  /** Taking it (the Take verb): what she says as she does. What goes into her pockets comes with the story. */
  take?: ViewText;
  /** Under its name: in the Concierge's view its classification of the thing ("Guest · dining"), in raw view her own note, if any. */
  tag?: ViewNote;
  /** What the Concierge answers when she asks it about the thing. Its view only. */
  ask?: string;
  /** Ink knot to run. */
  talk?: string;
  /** What it says back when she talks to it, with no conversation: a machine's "Bzzzzt". */
  reply?: ViewText;
  /**
   * What it is, for the standard replies to a verb it has nothing of its own for (replies.ts): a person, a machine or
   * a thing. By default a way out if it goes somewhere, a person if it has a conversation, else a thing.
   */
  kind?: 'person' | 'machine' | 'thing' | 'way';
  /** A door or the end of the street: using it goes to this scene, arriving at this place there. */
  go?: { scene: string; spawn: string };
  /**
   * A close-up of it, a scene of its own (scenes/<id>, `closeup`): tapping it, or looking at or using it, she goes up to
   * it and the view goes in close, where its things can be looked at, used, opened and taken one by one.
   */
  zoom?: string;
  /**
   * Only there in one view. A generated person is gone in raw view ("concierge"); someone the Concierge edits
   * out can only be found in raw view ("raw"). Raw view is the only way to tell who is real.
   */
  only?: 'raw' | 'concierge';
  /** Where it is in one view its own way: drawn differently there, it takes up another place. */
  views?: Partial<Record<'raw' | 'concierge', Partial<Place>>>;
  /** Her wardrobe: using it, she picks what to wear. */
  wardrobe?: boolean;
  /** Using it, she changes into this outfit, a while passing behind a fade: the shower leaves her undressed. */
  wear?: string;
  /** There only while this condition on the story holds (see conditions.ts): a thing that turns up, a door that opens. */
  when?: string;
  /**
   * Its knot in the story: each verb runs the knot's stitch of its name (look, talk, use, take, ask) where it has one,
   * over the texts here, and using a thing she carries on it runs use_<thing>. The story then says what happens.
   */
  story?: string;
  /** A thing she can pick up (one of the story's Things): Take puts it in her pockets, and it is gone from here for good. */
  item?: string;
  /** On the map once she has seen it, to go to: ways out and people are on it anyway, unless this is false. */
  map?: boolean;
  /** A mover it goes with (its asset): wherever the mover is now, there it is (a guard on its round). */
  follows?: string;
}

/** Where a hotspot is: its area, where she stands to use it and which way she faces then. */
export interface Place {
  rect: [number, number, number, number];
  stand?: number;
  face?: 1 | -1;
}

/** Where a hotspot is in a view: its own place there, where it has one, over the place it has in both. */
export function placeIn(h: Hotspot, raw: boolean): Place {
  const o = h.views?.[raw ? 'raw' : 'concierge'];
  return { rect: o?.rect ?? h.rect, stand: o && 'stand' in o ? o.stand : h.stand, face: o?.face ?? h.face };
}

/** How she moves: walking, jogging, running. */
export type Gait = 'walk' | 'jog' | 'run';

export interface LevelDef {
  walk: { y: number; x0: number; x1: number };
  /**
   * The hero's sprite is a name in the scene, or a path under assets such as "cast/hero". Anchor and smoke (where her
   * cigarette is, from her feet) are for sprites that do not say themselves.
   */
  hero: {
    sprite: string; x: number; anchor?: [number, number]; smoke?: [number, number];
    /** Her walking speed, in level pixels a second. */
    speed: number;
    /** Each gait her sprite has frames for: its speed, and how far a cycle of it carries her, at her size in the scene. */
    gaits?: Partial<Record<Gait, { speed: number; stride: number }>>;
  };
  hotspots: Hotspot[];
}

/** Whether a hotspot is there in the current view. */
export const inView = (h: Hotspot, raw: boolean): boolean => !h.only || (h.only === 'raw') === raw;

export const pick = (t: ViewText, raw: boolean): string => (typeof t === 'string' ? t : raw ? t.raw : t.concierge);

/** The label for the view on screen, or an empty string if it has none there. The Concierge's words never show in raw view. */
export const note = (t: ViewNote | undefined, raw: boolean): string => (t === undefined ? '' : typeof t === 'string' ? (raw ? '' : t) : (raw ? t.raw : t.concierge) ?? '');
