// Copy and paste: what is selected, within a scene or into another. The clipboard is kept in this browser, so it
// outlasts a change of scene, a reload, and goes from one tab to another. Pasted into the scene it came from, a copy
// lands a little to the right; in another scene, where it was; and if that is off the screen, in the middle of it. In
// Raw or AR mode, a thing only in the other view becomes this one's own, so what is pasted there is seen there.
// Duplicating is copying and pasting in one go, the clipboard left as it was.

import { presets, resolveLight, type PlacedLight } from '../engine/presets';
import { NW } from '../engine/renderer';
import type { Hotspot } from '../game/level';
import type { SceneFile } from '../game/scenefile';
import { rebuild, refresh, syncEffects, updatePlay } from './files';
import { ed, LIMITS, onLayer, redraw, remember, setStatus, snapshot, viewX, type Selection } from './state';
import { LIVE, liveList, liveListOf, type LiveItem, type LiveKind } from './live';
import { editView, viewLabel } from './views';

interface Clip {
  kind: Selection['kind'];
  item: unknown;
  /** The scene it was copied in. */
  from: string;
  /** A place to arrive at's name; an area's set (inside or outside). */
  id?: string;
}

const KEY = 'lidless.editor.clip';
/** How far to the right a copy lands from what it is a copy of: aside, at the same height, since heights mean something here. */
const APART = 20;
let kept: Clip | null = null;

function clip(): Clip | null {
  try {
    const c = localStorage.getItem(KEY);
    if (c) return JSON.parse(c) as Clip;
  } catch {
    // only this page's
  }
  return kept;
}

const NAMES: Partial<Record<Selection['kind'], string>> = { light: 'a light', hotspot: 'a hotspot', spawn: 'a place to arrive at', zone: 'an area', layer: 'a layer', steam: 'steam', godray: 'a light shaft', beacon: 'a beacon', drips: 'drips', mover: 'a mover' };
const nameOf = (c: Clip): string => (c.kind === 'steam' && (c.item as { kind?: string }).kind === 'smoke' ? 'smoke' : c.kind === 'live' ? `a ${LIVE[c.id as LiveKind]?.name.toLowerCase() ?? 'live effect'}` : NAMES[c.kind] ?? 'it');

/** What is selected, as it is in the file, for the clipboard; nothing for the scene itself. */
function take(sel: Selection, f: SceneFile): Clip | null {
  const one = (item: unknown, id?: string): Clip | null => (item ? { kind: sel.kind, item: structuredClone(item), from: f.id, id } : null);
  switch (sel.kind) {
    case 'light': return one(f.lights[sel.i]);
    case 'hotspot': return one(f.hotspots[sel.i]);
    case 'spawn': return one(f.spawns[sel.id], sel.id);
    case 'zone': return one(f.zones?.[sel.set]?.[sel.i], sel.set);
    case 'layer': return one(f.layers[sel.i]);
    case 'steam': return one(f.steam?.[sel.i]);
    case 'godray': return one(f.godrays?.[sel.i]);
    case 'beacon': return one(f.beacons?.[sel.i]);
    case 'drips': return one(f.drips);
    case 'mover': return one(f.movers?.[sel.i]);
    // a live effect: which kind it is goes with it
    case 'live': return one(liveList(f, sel.fx)[sel.i], sel.fx);
    default: return null;
  }
}

/** The Paste button names what it would paste. */
export function syncPaste(): void {
  const b = document.getElementById('paste') as HTMLButtonElement | null, c = clip();
  if (!b) return;
  b.disabled = !c;
  b.title = c ? `Paste ${nameOf(c)} from ${c.from} (Cmd+V)` : 'Paste what you copy with Cmd+C, here or in another scene';
}
// copied in another tab
window.addEventListener('storage', (e) => { if (e.key === KEY) syncPaste(); });

export function copySelected(): boolean {
  const c = take(ed.sel, ed.file);
  if (!c) return false;
  kept = c;
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // kept for this page only
  }
  syncPaste();
  setStatus(`Copied ${nameOf(c)}. Cmd+V pastes it, here or in another scene`);
  return true;
}

const unique = (stem: string, taken: string[]) => { if (!taken.includes(stem)) return stem; let n = 2; while (taken.includes(`${stem}-${n}`)) n++; return `${stem}-${n}`; };

type Item = Record<string, unknown> & { views?: Record<string, Record<string, unknown>> };

/** Where a thing is across the scene, as drawn (one on a layer further away moves less with the camera); none for a mover, which passes through. */
function across(kind: Clip['kind'], o: Item): number | undefined {
  const rect = (r: number[]) => r[0] + r[2] / 2;
  switch (kind) {
    case 'hotspot': return rect(o.rect as number[]);
    case 'zone': return rect(o as unknown as number[]);
    case 'drips': return ((o.x0 as number) + (o.x1 as number)) / 2;
    case 'mover': return undefined;
    default: return typeof o.x === 'number' ? onLayer(o.x, (o.parallax as number | undefined) ?? 1) : undefined;
  }
}

/** Move a thing d to the right, and where it is in each view with it. */
function shift(kind: Clip['kind'], o: Item, d: number): void {
  if (!d) return;
  if (kind === 'zone') { (o as unknown as number[])[0] += d; return; }
  const keys = kind === 'hotspot' ? ['stand'] : kind === 'drips' || kind === 'mover' ? ['x0', 'x1'] : ['x'];
  if (kind === 'live' && Array.isArray(o.posts)) o.posts = (o.posts as number[]).map((p) => p + d);
  for (const t of [o, ...Object.values(o.views ?? {})]) {
    if (!t) continue;
    for (const k of keys) if (typeof t[k] === 'number') t[k] = (t[k] as number) + d;
    if (kind === 'hotspot' && Array.isArray(t.rect)) { const r = t.rect as number[]; t.rect = [r[0] + d, r[1], r[2], r[3]]; }
  }
}

/** A light's own flag: left out where its kind has it the same, written out (as 0 when off) where its kind does not. */
function flag(l: Item, k: 'ar' | 'raw', on: boolean): void {
  const from = l.preset ? presets().lights[l.preset as string]?.light[k] : undefined;
  if (!!from === on) delete l[k];
  else l[k] = on ? 1 : 0;
  for (const v of Object.values(l.views ?? {})) delete v?.[k];
}

/** In Raw or AR mode, a thing only in the other view becomes this view's own. Whether it did. */
function intoMode(kind: Clip['kind'], o: Item): boolean {
  const only = editView();
  if (!only) return false;
  if (kind === 'light') {
    const r = resolveLight(o as unknown as PlacedLight);
    if (!(only === 'raw' ? r.ar && !r.raw : r.raw && !r.ar)) return false;
    flag(o, 'ar', only === 'concierge');
    flag(o, 'raw', only === 'raw');
    return true;
  }
  // an old light shaft's `ar` is AR only
  const was = (o.only as string | undefined) ?? (kind === 'godray' && o.ar ? 'concierge' : undefined);
  if (!was || was === only) return false;
  o.only = only;
  delete o.ar;
  return true;
}

/** Put a copy in the scene, d to the right of where it was, and select it. Whether it could. */
async function put(c: Clip, d: number): Promise<{ moved: boolean } | null> {
  const f = ed.file, o = structuredClone(c.item) as Item;
  if (c.kind === 'scene') return null;
  if (c.kind === 'drips' && d && f.drips) { setStatus('A scene has one curtain of drips: copy it to paste it in another scene'); return null; }
  if (c.kind === 'live') {
    const k = LIVE[c.id as LiveKind];
    if (!k) return null;
    if (liveList(f, c.id as LiveKind).length >= k.limit) { setStatus(`At most ${k.limit} ${k.name.toLowerCase()}${k.limit > 1 ? 's' : ''} in a scene`); return null; }
  }
  const list = c.kind === 'steam' ? 'steam' : c.kind === 'godray' ? 'godrays' : c.kind === 'beacon' ? 'beacons' : null;
  if (list) {
    const limit = LIMITS[list], n = (f[list] ?? []).length;
    if (n >= limit) { setStatus(`At most ${limit} ${list === 'steam' ? 'steam and smoke' : list === 'godrays' ? 'light shafts' : 'beacons'} in a scene`); return null; }
  }
  // on the screen: where it was, d along; if that is off the screen, in the middle of it
  const x = across(c.kind, o), cam = viewX();
  if (x !== undefined && (x + d < cam || x + d > cam + NW)) d = Math.round(cam + NW / 2 - x);
  shift(c.kind, o, d);
  switch (c.kind) {
    case 'light':
      // a copy is one to keep
      delete o.suggested;
      f.lights.push(o as unknown as PlacedLight);
      ed.sel = { kind: 'light', i: f.lights.length - 1 };
      break;
    case 'hotspot':
      o.id = unique(o.id as string, f.hotspots.map((h) => h.id));
      f.hotspots.push(o as unknown as Hotspot);
      ed.sel = { kind: 'hotspot', i: f.hotspots.length - 1 };
      break;
    case 'spawn': {
      const id = unique(c.id ?? 'arrive', Object.keys(f.spawns));
      f.spawns[id] = o as unknown as SceneFile['spawns'][string];
      ed.sel = { kind: 'spawn', id };
      updatePlay();
      break;
    }
    case 'zone': {
      const set = c.id === 'outside' ? 'outside' : 'inside';
      ((f.zones ??= {})[set] ??= []).push(o as unknown as [number, number, number, number]);
      ed.sel = { kind: 'zone', set, i: f.zones[set]!.length - 1 };
      refresh();
      break;
    }
    case 'layer':
      f.layers.push(o as unknown as SceneFile['layers'][number]);
      ed.sel = { kind: 'layer', i: f.layers.length - 1 };
      break;
    case 'steam': case 'godray': case 'beacon': {
      const to = (f[list!] ??= []) as unknown[];
      to.push(o);
      ed.sel = { kind: c.kind, i: to.length - 1 };
      break;
    }
    case 'drips':
      // one curtain of drips a scene: the pasted one takes the place of any there
      f.drips = o as unknown as SceneFile['drips'];
      ed.sel = { kind: 'drips' };
      break;
    case 'live': {
      const to = liveListOf(f, c.id as LiveKind);
      to.push(o as unknown as LiveItem);
      ed.sel = { kind: 'live', fx: c.id as LiveKind, i: to.length - 1 };
      break;
    }
    case 'mover':
      // drawn after a layer this scene has: the one it was, or its first
      if (!f.layers.some((l) => l.asset === o.after)) o.after = f.layers[0]?.asset;
      (f.movers ??= []).push(o as unknown as NonNullable<SceneFile['movers']>[number]);
      ed.sel = { kind: 'mover', i: f.movers.length - 1 };
      break;
  }
  const moved = intoMode(c.kind, o);
  if (c.kind === 'layer' || c.kind === 'mover') await rebuild();
  else if (list || c.kind === 'drips' || c.kind === 'live') syncEffects();
  return { moved };
}

async function place(c: Clip, d: number, did: string): Promise<boolean> {
  const before = snapshot(), done = await put(c, d);
  if (!done) return false;
  remember(before);
  redraw.overlay();
  redraw.side();
  const only = editView();
  setStatus(`${did}${done.moved && only ? `, made ${viewLabel(only)} view's own` : ''}`);
  return true;
}

/** Paste what was copied into the scene open now. */
export async function paste(): Promise<boolean> {
  const c = clip();
  if (!c) { setStatus('Nothing copied yet: select something and press Cmd+C'); return false; }
  const here = c.from === ed.file.id;
  return place(c, here ? APART : 0, `Pasted ${nameOf(c)}${here ? '' : ` from ${c.from}`}`);
}

/** A copy of what is selected, a little to the right, the clipboard left as it was. */
export async function duplicate(): Promise<boolean> {
  const c = take(ed.sel, ed.file);
  return c ? place(c, APART, `Duplicated ${nameOf(c)}`) : false;
}
