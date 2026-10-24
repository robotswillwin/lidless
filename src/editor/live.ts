// The live effects in the editor (decision 44: what moves is drawn live, not painted): an oscilloscope's line, a clock's
// hands, a Newton's cradle, a hologram of rings. One description of each kind gives its name, its list in the scene file,
// how many the renderer draws, a new one, the box it covers on the scene, and its own fields in the side panel; the rest
// (selecting, moving, copying, deleting, which views) is the same for all of them.

import { SPEEDS, WAVES, type ClockDef, type CradleDef, type RingsDef, type ScopeDef } from '../engine/assets';
import type { SceneFile } from '../game/scenefile';
import { check, choice, colour, num, str } from './form';

export type LiveKind = 'scope' | 'clock' | 'cradle' | 'rings';
export type LiveItem = ScopeDef | ClockDef | CradleDef | RingsDef;
type List = 'scopes' | 'clocks' | 'cradles' | 'rings';

/** A story variable's name, or none (empty). */
const variable = (label: string, value: string | undefined, set: (v: string | undefined) => void, after: () => void) =>
  str(label, value ?? '', (v) => set(v.trim() || undefined), { after });

interface Kind {
  list: List;
  /** How many the renderer draws in a scene. */
  limit: number;
  name: string;
  about: string;
  /** A new one, at x, y. */
  make: (x: number, y: number) => LiveItem;
  /** Its own fields, each calling `after` once it has changed it. */
  fields: (o: never, after: () => void) => HTMLElement[];
}

export const LIVE: Record<LiveKind, Kind> = {
  scope: {
    list: 'scopes', limit: 2, name: 'Oscilloscope',
    about: 'Its line drawn live over a screen painted empty: it creeps, breathes, and in raw view carries a little noise. Its shape and speed as set here, or as story variables have them (its knobs).',
    make: (x, y) => ({ x, y, r: 40 }),
    fields: (s: ScopeDef, after) => {
      const round = s.w === undefined || s.h === undefined;
      const set = <K extends keyof ScopeDef>(k: K, v: ScopeDef[K] | undefined) => { if (v === undefined || v === '') delete s[k]; else s[k] = v; };
      return [
        check('A round glass (else a screen with corners)', round, (v) => {
          if (v) { s.r = Math.round(Math.min(s.w ?? 40, s.h ?? 40) / 2); delete s.w; delete s.h; } else { s.w = (s.r ?? 20) * 2; s.h = Math.round((s.r ?? 20) * 1.4); delete s.r; }
        }, after),
        ...(round
          ? [num('Radius, inside its rim', s.r ?? 20, (v) => { s.r = Math.max(2, v); }, { after })]
          : [num('Width', s.w ?? 40, (v) => { s.w = Math.max(4, v); }, { after }), num('Height', s.h ?? 28, (v) => { s.h = Math.max(4, v); }, { after })]),
        choice('Its shape', s.shape ?? 'sine', WAVES.map((w) => [w, w] as [string, string]), (v) => set('shape', v as ScopeDef['shape']), after),
        variable('…or a story variable that holds it (its knob)', s.wave, (v) => set('wave', v), after),
        choice('Its speed', s.pace ?? 'slow', Object.keys(SPEEDS).map((p) => [p, p] as [string, string]), (v) => set('pace', v as ScopeDef['pace']), after),
        variable('…or a story variable that holds it', s.speed, (v) => set('speed', v), after),
        colour('Its line in the Concierge’s view', s.colours?.concierge ?? [0.27, 0.9, 0.97], (c) => { s.colours = { ...s.colours, concierge: c }; after(); }),
        colour('Its line in raw view', s.colours?.raw ?? [0.36, 0.95, 0.42], (c) => { s.colours = { ...s.colours, raw: c }; after(); }),
      ];
    },
  },
  clock: {
    list: 'clocks', limit: 2, name: 'Clock',
    about: 'Its hands drawn live at the game’s time of day over a face painted without them, the second hand ticking.',
    make: (x, y) => ({ x, y, r: 12 }),
    fields: (c: ClockDef, after) => [num('Radius, inside the hour marks', c.r, (v) => { c.r = Math.max(2, v); }, { after })],
  },
  cradle: {
    list: 'cradles', limit: 1, name: 'Newton’s cradle',
    about: 'Its balls and threads drawn live on a frame painted without them. x, y is where the first thread hangs. Each time the story variable counting her swings goes up, an end ball is let go.',
    make: (x, y) => ({ x, y, gap: 17, length: 60, r: 8 }),
    fields: (c: CradleDef, after) => [
      num('Between the threads', c.gap, (v) => { c.gap = Math.max(1, v); }, { after }),
      num('Thread length, to a ball’s middle', c.length, (v) => { c.length = Math.max(4, v); }, { after }),
      num('Ball radius', c.r, (v) => { c.r = Math.max(1, v); }, { after }),
      variable('Her swings (a story variable that counts them)', c.swings, (v) => { if (v) c.swings = v; else delete c.swings; }, after),
      str('Its front posts, from and to x, left then right (a ball swings behind them)', c.posts?.join(', ') ?? '', (v) => {
        const p = v.split(',').map((t) => Number(t.trim()));
        if (p.length === 4 && p.every(Number.isFinite)) c.posts = p as [number, number, number, number];
        else if (!v.trim()) delete c.posts;
      }, { after }),
    ],
  },
  rings: {
    list: 'rings', limit: 1, name: 'Hologram rings',
    about: 'Three rings of light, each with a gap, turned by story variables in sixths; when another says their gaps line up, it opens into a flower of light. Usually the Concierge’s alone.',
    make: (x, y) => ({ x, y, r: 34, turns: ['rings_in', 'rings_mid', 'rings_out'], solved: 'rings_solved', only: 'concierge' }),
    fields: (g: RingsDef, after) => [
      num('Radius of the outer ring', g.r, (v) => { g.r = Math.max(4, v); }, { after }),
      ...(['inner', 'middle', 'outer'] as const).map((ring, k) => variable(`The ${ring} ring’s turn (a story variable)`, g.turns[k], (v) => { g.turns[k] = v ?? ''; }, after)),
      variable('Its gaps lined up (a story variable)', g.solved, (v) => { if (v) g.solved = v; else delete g.solved; }, after),
    ],
  },
};

export const LIVE_KINDS = Object.keys(LIVE) as LiveKind[];

/** The scene's live effects of a kind, as the file has them. */
export const liveList = (f: SceneFile, k: LiveKind): LiveItem[] => (f[LIVE[k].list] as LiveItem[] | undefined) ?? [];
/** The same, made in the file if it has none yet: to add one to. */
export const liveListOf = (f: SceneFile, k: LiveKind): LiveItem[] => ((f as unknown as Record<string, LiveItem[]>)[LIVE[k].list] ??= []);

/** The box one covers on the scene: x, y, width, height. */
export function liveBox(k: LiveKind, o: LiveItem): [number, number, number, number] {
  if (k === 'cradle') { const c = o as CradleDef; return [c.x - c.r, c.y, c.gap * 4 + c.r * 2, c.length + c.r]; }
  if (k === 'scope') { const s = o as ScopeDef, hw = s.w !== undefined ? s.w / 2 : s.r ?? 20, hh = s.h !== undefined ? s.h / 2 : s.r ?? 20; return [s.x - hw, s.y - hh, hw * 2, hh * 2]; }
  const r = (o as ClockDef | RingsDef).r;
  return [o.x - r, o.y - r, r * 2, r * 2];
}

/** Moved by dx, dy: a cradle's front posts with it. */
export function moveLive(k: LiveKind, o: LiveItem, dx: number, dy: number): void {
  o.x += dx;
  o.y += dy;
  const c = o as CradleDef;
  if (k === 'cradle' && c.posts && dx) c.posts = c.posts.map((p) => p + dx) as CradleDef['posts'];
}
