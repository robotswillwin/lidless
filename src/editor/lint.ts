// What is wrong with a scene, or will go wrong in play: the scene file's own checks, and what only shows when it is played
// or when other scenes lead into it. A hotspot nobody can do anything with, a conversation the story does not have, an
// exit to a place that is not there, a hotspot under the phone's corner buttons or hidden under another, more lights than
// a phone draws. Each problem names what it is about, so the editor can select it.

import { resolveLight } from '../engine/presets';
import { inView, placeIn, type Hotspot, type ViewText } from '../game/level';
import { checkSceneFile, withCloseupDefaults, type SceneFile } from '../game/scenefile';
import type { Selection } from './state';

export interface Problem {
  /** An error breaks the scene or a way through the game; a warning is likely a mistake. */
  level: 'error' | 'warning';
  text: string;
  /** What it is about, to select. */
  sel?: Selection;
}

export interface LintContext {
  /** Every scene the world lists. */
  scenes: string[];
  /** Other scenes' files, by id, as far as they are loaded: to check exits both ways. */
  others: Record<string, SceneFile>;
  /** The story's knots, if known: what a hotspot's conversation can name. */
  knots?: Set<string>;
  /** Where the game starts. */
  start?: { scene: string; spawn: string };
  /** Every built asset (scene/name), if known. */
  assets?: Set<string>;
}

/** The screen in level pixels: the renderer's NW by NH. */
const SW = 960, SH = 540;
/**
 * The corner buttons on a phone held sideways, in level pixels: a ball and its margin in each bottom corner. Taps there
 * go to the buttons, not the scene.
 */
export const CORNER = 84;
/** What a new hotspot is given, to be written over: left in, it shows in the game. */
export const PLACEHOLDER = { name: 'Something', look: 'What she sees.' };
/** How many lights a phone draws at once (the medium tier's): the weakest further ones are left out. */
export const PHONE_LIGHTS = 18;

const nameOf = (t: ViewText): string => (typeof t === 'string' ? t : t.concierge || t.raw);
const area = ([, , w, h]: readonly number[]) => Math.max(0, w) * Math.max(0, h);
const overlap = ([ax, ay, aw, ah]: readonly number[], [bx, by, bw, bh]: readonly number[]) => Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx)) * Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));

/** What a scene file's own check message is about. */
function selFor(msg: string, file: SceneFile): Selection | undefined {
  let m: RegExpMatchArray | null;
  if ((m = msg.match(/^hotspot (\S+?):/))) { const i = file.hotspots.findIndex((h) => h.id === m![1]); return i >= 0 ? { kind: 'hotspot', i } : undefined; }
  if ((m = msg.match(/^hotspots\[(\d+)\]/))) return { kind: 'hotspot', i: Number(m[1]) };
  if ((m = msg.match(/^lights\[(\d+)\]/))) return { kind: 'light', i: Number(m[1]) };
  if ((m = msg.match(/^steam\[(\d+)\]/))) return { kind: 'steam', i: Number(m[1]) };
  if ((m = msg.match(/^godrays\[(\d+)\]/))) return { kind: 'godray', i: Number(m[1]) };
  if ((m = msg.match(/^beacons\[(\d+)\]/))) return { kind: 'beacon', i: Number(m[1]) };
  if ((m = msg.match(/^movers\[(\d+)\]/))) return { kind: 'mover', i: Number(m[1]) };
  if ((m = msg.match(/^spawn (\S+) /))) return { kind: 'spawn', id: m[1] };
  if (msg.startsWith('drips')) return { kind: 'drips' };
  return undefined;
}

export function lintScene(given: SceneFile, ctx: LintContext): Problem[] {
  // a close-up's walk and places to arrive at are filled in, as the game does
  const file = withCloseupDefaults(given) as SceneFile;
  const out: Problem[] = [];
  // a problem found in both views is said once
  const said = new Set<string>();
  const add = (level: Problem['level'], text: string, sel?: Selection) => { if (!said.has(text)) { said.add(text); out.push({ level, text, sel }); } };
  const err = (text: string, sel?: Selection) => add('error', text, sel);
  const warn = (text: string, sel?: Selection) => add('warning', text, sel);
  const [W, H] = file.size, { x0, x1, y: wy } = file.walk;

  // the scene file's own checks: what would stop it loading
  for (const msg of checkSceneFile(file, file.id)) err(msg, selFor(msg, file));

  // its layers
  file.layers.forEach((l, i) => { if (ctx.assets && !ctx.assets.has(l.asset)) err(`Layer ${i + 1}, ${l.asset}, is not built`, { kind: 'layer', i }); });

  // the walk line
  if (x0 < 0 || x1 > W) warn(`The walk line runs past the scene's edge (${x0} to ${x1}, the scene is ${W} wide)`);
  if (wy < 0 || wy > H) err(`The walk line is off the scene (y ${wy})`);

  // hotspots and exits, each in the views it is in
  const single = W <= SW;
  const views = (h: Hotspot) => [false, true].filter((raw) => inView(h, raw));
  const sameRect = (h: Hotspot) => JSON.stringify(placeIn(h, true).rect) === JSON.stringify(placeIn(h, false).rect);
  file.hotspots.forEach((h, i) => {
    const sel: Selection = { kind: 'hotspot', i }, name = nameOf(h.name) || h.id, r = h.rect;
    const texts = (t?: ViewText) => (t === undefined ? [] : typeof t === 'string' ? [t] : [t.concierge, t.raw]);
    if (texts(h.name).includes(PLACEHOLDER.name) || texts(h.look).includes(PLACEHOLDER.look)) warn(`${name} still has the placeholder ${texts(h.name).includes(PLACEHOLDER.name) ? 'name' : 'look text'} it was made with`, sel);
    if (!h.look && !h.talk && !h.use && !h.take && !h.ask && !h.go && !h.wardrobe && !h.wear && !h.story && !h.item) warn(`${name}: nothing to do with it. Give it a look, talk, use or take text, an answer to Ask, a knot in the story, a thing to take, or make it an exit`, sel);
    if (h.talk && ctx.knots && !ctx.knots.has(h.talk.split('.')[0])) err(`${name} talks with “${h.talk}”, which the story does not have`, sel);
    if (h.stand !== undefined && (h.stand < x0 || h.stand > x1)) warn(`${name}: she stands at x ${h.stand} to use it, off the walk line (${x0} to ${x1})`, sel);
    if (r[0] + r[2] < 0 || r[0] > W || r[1] + r[3] < 0 || r[1] > H) warn(`${name} is off the scene`, sel);
    // the corner buttons: on one screen, a hotspot mostly under them cannot be tapped, in a view it is in, where it is there
    for (const raw of views(h)) {
      const vr = placeIn(h, raw).rect;
      if (single && area(vr) > 0) for (const [side, box] of [['left', [0, SH - CORNER, CORNER, CORNER]], ['right', [SW - CORNER, SH - CORNER, CORNER, CORNER]]] as const) {
        if (overlap(vr, box) >= 0.5 * area(vr)) warn(`${name} is mostly under the bottom ${side} button on a phone${views(h).length > 1 && !sameRect(h) ? ` in ${raw ? 'raw view' : 'AR'}` : ''}: hard to tap`, sel);
      }
    }
    if (h.go) {
      if (!ctx.scenes.includes(h.go.scene)) err(`${name} leads to “${h.go.scene}”, a scene the world does not list`, sel);
      else {
        const there = h.go.scene === file.id ? file : ctx.others[h.go.scene];
        if (there && !there.spawns[h.go.spawn]) err(`${name} leads to ${h.go.scene}'s “${h.go.spawn}”, a place ${h.go.scene} does not have`, sel);
      }
    }
  });
  // a hotspot mostly under a later one, in a view they share, where they are there: taps there go to the later one.
  // Two that take turns (`seat == "woman"`, `seat == "man"`: the same variable, other values) are never there together
  const turn = (h: Hotspot) => /^\s*(\w+)\s*==\s*("[^"]*"|-?\d+(?:\.\d+)?|true|false)\s*$/.exec(h.when ?? '');
  const takeTurns = (a: Hotspot, b: Hotspot) => { const ta = turn(a), tb = turn(b); return !!ta && !!tb && ta[1] === tb[1] && ta[2] !== tb[2]; };
  file.hotspots.forEach((a, i) => file.hotspots.forEach((b, j) => {
    if (j <= i || takeTurns(a, b)) return;
    for (const raw of views(a).filter((v) => views(b).includes(v))) {
      const ra = placeIn(a, raw).rect, o = overlap(ra, placeIn(b, raw).rect);
      if (o > 0 && o >= 0.5 * area(ra)) warn(`${nameOf(a.name) || a.id} is mostly under ${nameOf(b.name) || b.id}: taps there go to ${nameOf(b.name) || b.id}`, { kind: 'hotspot', i });
    }
  }));

  // places to arrive at, and the exits elsewhere that arrive at them
  for (const [id, sp] of Object.entries(file.spawns)) if (sp.x < x0 || sp.x > x1) warn(`The place “${id}” is off the walk line (x ${sp.x})`, { kind: 'spawn', id });
  for (const [sid, other] of Object.entries(ctx.others)) {
    if (sid === file.id) continue;
    // about this scene's exit to that one, if it has one: its panel makes the place
    const ours = file.hotspots.findIndex((x) => x.go?.scene === sid);
    for (const h of other.hotspots) if (h.go?.scene === file.id && !file.spawns[h.go.spawn]) err(`${other.name || sid}'s exit “${nameOf(h.name) || h.id}” arrives at “${h.go.spawn}” here, a place this scene does not have`, ours >= 0 ? { kind: 'hotspot', i: ours } : undefined);
  }
  if (ctx.start?.scene === file.id && !file.spawns[ctx.start.spawn]) err(`The game starts here at “${ctx.start.spawn}”, a place this scene does not have`);

  // lights: ones still to keep or discard, and more on one screen than a phone draws
  file.lights.forEach((l, i) => { const r = resolveLight(l); if (r.ar && r.raw) err(`Light ${i + 1} shines in neither view: it is set to AR only and to raw only`, { kind: 'light', i }); });
  const pending = file.lights.findIndex((l) => l.suggested);
  if (pending >= 0) warn(`${file.lights.filter((l) => l.suggested).length} suggested lights are not kept or discarded yet`, { kind: 'light', i: pending });
  for (const [view, raw] of [['the Concierge’s view', false], ['raw view', true]] as const) {
    // each light as it is in that view
    const lights = file.lights.map((l) => resolveLight(l, raw ? 'raw' : 'concierge'));
    let most = 0;
    for (let cam = 0; cam <= Math.max(0, W - SW); cam += 120) {
      most = Math.max(most, lights.filter((l) => !(raw ? l.ar : l.raw) && l.x + l.r > cam && l.x - l.r < cam + SW && l.y + l.r > 0 && l.y - l.r < SH).length);
      if (W <= SW) break;
    }
    if (most > PHONE_LIGHTS) warn(`In ${view}, ${most} lights shine on one screen: a phone draws the ${PHONE_LIGHTS} strongest`);
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
