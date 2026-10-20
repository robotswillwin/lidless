// Exits both ways. An exit here leads to a place to arrive at in another scene, and that scene has a way back here,
// arriving at a place by this exit. What a pair of scenes lacks of that, and where to make it: the way back at the end of
// the walk line she comes in by (the other end from an end she walked out by; for a door, the same side as the door), each
// place to arrive at a little in from where she comes in, facing in. A place already there near that spot is used rather
// than another made. The editor makes the changes (see exits.ts).

import type { Hotspot, ViewText } from '../game/level';
import type { SceneFile } from '../game/scenefile';

/** How near an end of the walk line an exit is one to walk out by, and a place is near enough to use. */
export const EDGE = 60;
/** How far in from where she comes in she arrives. */
export const IN = 30;
/** A new way back's height, standing on the walk line. */
const TALL = 160;

export interface Join {
  /** The place there the exit arrives at, whether the exit names it yet, and whether the other scene has it. */
  arrive: string;
  exitNames: boolean;
  hasArrive: boolean;
  /** The way back there: its index in the other scene's hotspots, or -1 if there is none. */
  back: number;
  /** The place here the way back arrives at, whether the way back names it yet, and whether this scene has it. */
  backTo: string;
  backNames: boolean;
  hasBackTo: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const unique = (stem: string, taken: string[]) => { if (!taken.includes(stem)) return stem; let n = 2; while (taken.includes(`${stem}-${n}`)) n++; return `${stem}-${n}`; };
export const nameOf = (t: ViewText): string => (typeof t === 'string' ? t : t.concierge || t.raw);

/** Where along the walk line a hotspot is used: where she stands for it, or under its middle. */
export const alongWalk = (h: Hotspot, f: SceneFile): number => clamp(h.stand ?? h.rect[0] + h.rect[2] / 2, f.walk.x0, f.walk.x1);

/** A place to arrive at by x: a little in from it, towards the middle of the walk line, facing in. */
export function arriveBy(f: SceneFile, x: number): { x: number; facing: 1 | -1 } {
  const dir: 1 | -1 = x < (f.walk.x0 + f.walk.x1) / 2 ? 1 : -1;
  return { x: Math.round(clamp(x + IN * dir, f.walk.x0, f.walk.x1)), facing: dir };
}

/** A place a scene already has near x: one to use rather than make another. */
const near = (f: SceneFile, x: number): string | undefined =>
  Object.entries(f.spawns).filter(([, s]) => Math.abs(s.x - x) <= EDGE).sort((a, b) => Math.abs(a[1].x - x) - Math.abs(b[1].x - x))[0]?.[0];

/** How exit h, here, and the scene it leads to are joined up, and the names of what is missing. */
export function joinOf(h: Hotspot, here: SceneFile, there: SceneFile): Join {
  const x = alongWalk(h, here);
  // of the ways back, the one arriving nearest this exit
  const dist = (s: string) => (here.spawns[s] ? Math.abs(here.spawns[s].x - x) : Infinity);
  const backs = there.hotspots.flatMap((b, k) => (b.go?.scene === here.id ? [k] : [])).sort((a, b) => dist(there.hotspots[a].go!.spawn) - dist(there.hotspots[b].go!.spawn));
  const back = backs[0] ?? -1, named = back >= 0 ? there.hotspots[back].go!.spawn : '';
  const backTo = named || near(here, arriveBy(here, x).x) || unique(`from-${there.id}`, Object.keys(here.spawns));
  const arrive = h.go?.spawn || (back >= 0 ? near(there, arriveBy(there, alongWalk(there.hotspots[back], there)).x) : undefined) || unique(`from-${here.id}`, Object.keys(there.spawns));
  return { arrive, exitNames: !!h.go?.spawn, hasArrive: !!there.spawns[arrive], back, backTo, backNames: !!named, hasBackTo: !!here.spawns[backTo] };
}

export const joinedUp = (j: Join): boolean => j.exitNames && j.hasArrive && j.back >= 0 && j.backNames && j.hasBackTo;
/** Whether what is missing includes anything in the other scene. */
export const missingThere = (j: Join): boolean => !j.hasArrive || j.back < 0 || !j.backNames;

/** Here: the exit names the place it arrives at, and the place the way back arrives at is made by the exit. Whether it made that place. */
export function makeHere(h: Hotspot, here: SceneFile, j: Join): boolean {
  h.go!.spawn = j.arrive;
  if (j.hasBackTo) return false;
  here.spawns[j.backTo] = arriveBy(here, alongWalk(h, here));
  return true;
}

/** There: the way back (made, or arriving at its place here), and the place the exit arrives at. */
export function makeThere(h: Hotspot, here: SceneFile, there: SceneFile, j: Join): { back: number; madeBack: boolean; madeArrive: boolean } {
  let back = j.back;
  const madeBack = back < 0;
  if (madeBack) {
    const x = alongWalk(h, here), out = x <= here.walk.x0 + EDGE ? -1 : x >= here.walk.x1 - EDGE ? 1 : 0;
    const side = out ? -out : x < here.size[0] / 2 ? -1 : 1, end = side < 0 ? there.walk.x0 : there.walk.x1;
    // over the end of the walk line, to leave by walking into it, reaching out past it
    const x0 = side < 0 ? Math.max(0, end - 45) : end - 15, x1 = side < 0 ? end + 15 : Math.min(there.size[0], end + 45);
    there.hotspots.push({
      id: unique(`to-${here.id}`, there.hotspots.map((b) => b.id)), name: `To ${here.name || here.id}`,
      rect: [x0, there.walk.y - TALL, x1 - x0, TALL], stand: end, go: { scene: here.id, spawn: j.backTo }, ...(h.only ? { only: h.only } : {}),
    });
    back = there.hotspots.length - 1;
  } else there.hotspots[back].go!.spawn = j.backTo;
  const madeArrive = !there.spawns[j.arrive];
  if (madeArrive) there.spawns[j.arrive] = arriveBy(there, alongWalk(there.hotspots[back], there));
  return { back, madeBack, madeArrive };
}
