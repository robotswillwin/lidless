// The map: the places she has been, drawn in, with the doors and people she has seen in them; a door out leads to a
// place sketched in with a question mark until she has been through it; a pin where she is. Tapping a place she has
// been takes her there, a door or a person in it to them, and a place she has only seen the door of to that door.
// A street is drawn as long as it is wide, so where things are along it is where they are on the map.

import { button, el } from './dom';
import { inView, pick, placeIn, type Hotspot } from './level';

export interface MapLayout {
  /** Each place on the map (a scene): where it is drawn, in map units; a street is a tenth of its width long, a room a box. */
  places: Record<string, { at: [number, number]; size?: [number, number]; spawn?: string }>;
}

/** What the map needs of a scene's file. */
export interface MapScene {
  id: string;
  name: string;
  kind: 'exterior' | 'interior';
  size: [number, number];
  spawns: Record<string, { x: number }>;
  hotspots: Hotspot[];
}

/** Where tapping takes her: a scene, arriving at one of its places to arrive, or at a hotspot (where she stands to use it). */
export interface Travel { scene: string; spawn?: string; at?: string }

export interface MapPlace { id: string; name: string; box: [number, number, number, number]; state: 'been' | 'seen'; here: boolean; street: boolean; go: Travel }
/** `named`: its name shown by it; a door to a place on the map has none, the place says where it goes. */
export interface MapSpot { scene: string; id: string; name: string; at: [number, number]; kind: 'door' | 'person' | 'thing'; named: boolean; go: Travel }
export interface MapLink { from: [number, number]; to: [number, number]; open: boolean }
export interface MapNow { places: MapPlace[]; spots: MapSpot[]; links: MapLink[]; you: [number, number] | null; bounds: [number, number, number, number] }

/** A hotspot worth a place on the map: a way out, someone to talk to, or a thing marked for it. */
export const onMap = (h: Hotspot): MapSpot['kind'] | null => (h.map === false ? null : h.go ? 'door' : h.talk ? 'person' : h.map ? 'thing' : null);

/**
 * The map as she knows it: `been` the scenes she has been in, `seen(scene, id)` whether she has seen a hotspot there,
 * `shown` whether one is there now (the story's conditions), `here` where she is.
 */
export function mapNow(layout: MapLayout, scenes: Record<string, MapScene>, been: ReadonlySet<string>, seen: (scene: string, id: string) => boolean,
  here: { scene: string; x: number }, raw: boolean, shown: (h: Hotspot) => boolean): MapNow {
  const boxOf = (id: string): { box: [number, number, number, number]; street: boolean } | null => {
    const l = layout.places[id], s = scenes[id];
    if (!l || !s) return null;
    const street = s.kind === 'exterior', size = l.size ?? (street ? [s.size[0] / 10, 22] : [56, 36]);
    return { box: [l.at[0], l.at[1], size[0], size[1]], street };
  };
  // a point along a place: as far along it as x is along the scene; on a street its middle, in a room below its name
  const pointIn = (id: string, x: number): [number, number] => {
    const { box, street } = boxOf(id)!, w = scenes[id].size[0];
    return [box[0] + Math.max(0.04, Math.min(0.96, x / w)) * box[2], box[1] + box[3] * (street ? 0.5 : 0.66)];
  };
  const places: MapPlace[] = [], spots: MapSpot[] = [], links: MapLink[] = [], joined = new Set<string>();
  const firstSpawn = (id: string) => layout.places[id]?.spawn ?? Object.keys(scenes[id]?.spawns ?? {})[0];
  for (const id of Object.keys(layout.places)) {
    const b = been.has(id) ? boxOf(id) : null;
    if (b) places.push({ id, name: scenes[id].name, box: b.box, state: 'been', here: id === here.scene, street: b.street, go: { scene: id, spawn: firstSpawn(id) } });
  }
  for (const p of [...places]) {
    for (const h of scenes[p.id].hotspots) {
      const kind = onMap(h);
      if (!kind || !inView(h, raw) || !shown(h) || !seen(p.id, h.id)) continue;
      const { rect } = placeIn(h, raw), at = pointIn(p.id, rect[0] + rect[2] / 2), name = pick(h.name, raw);
      const to = h.go?.scene, tb = to ? boxOf(to) : null;
      spots.push({ scene: p.id, id: h.id, name, at, kind, named: !tb, go: { scene: p.id, at: h.id } });
      // where a door leads: the place there, or one sketched in, as its door says, until she has been through it
      if (!to || !tb) continue;
      let target = places.find((q) => q.id === to);
      if (!target) {
        target = { id: to, name: scenes[to].name, box: tb.box, state: 'seen', here: false, street: tb.street, go: { scene: p.id, at: h.id } };
        places.push(target);
      }
      const pair = [p.id, to].sort().join('|');
      if (joined.has(pair) && target.state === 'been') continue;
      joined.add(pair);
      // to where she arrives through it, at the edge of the place nearest the door
      const arrive = scenes[to]?.spawns[h.go!.spawn]?.x, [tx0, ty, tw, th] = target.box;
      const tx = arrive !== undefined && target.state === 'been' ? pointIn(to, arrive)[0] : Math.max(tx0 + 4, Math.min(tx0 + tw - 4, at[0]));
      const toY = ty > at[1] ? ty : ty + th < at[1] ? ty + th : ty + th / 2;
      links.push({ from: at, to: [tx, toY], open: target.state === 'seen' });
    }
  }
  const you = been.has(here.scene) && boxOf(here.scene) ? pointIn(here.scene, here.x) : null;
  const xs = places.flatMap((p) => [p.box[0], p.box[0] + p.box[2]]), ys = places.flatMap((p) => [p.box[1], p.box[1] + p.box[3]]);
  const pad = 16, bounds: MapNow['bounds'] = xs.length
    ? [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad]
    : [0, 0, 100, 60];
  return { places, spots, links, you, bounds };
}

/** The map drawn into `body` (her journal's places): the places, their doors and people as dots, where she is; each a thing to tap. */
export function drawMap(body: HTMLElement, now: MapNow, go: (t: Travel, name: string) => void): void {
  const chart = el('div', 'chart', body);
  const [bx, by, bw, bh] = now.bounds;
  // as large as the panel allows, at the map's own shape; names over the dots in rows, so none covers another
  const fit = () => {
    const k = Math.min(body.clientWidth / bw, body.clientHeight / bh);
    chart.style.width = `${bw * k}px`;
    chart.style.height = `${bh * k}px`;
    const rows: number[] = [];
    for (const n of [...named].sort((a, b) => a.at - b.at)) {
      const w = n.label.offsetWidth, left = (n.at - bx) * k - w / 2;
      let row = rows.findIndex((right) => left > right + 6);
      if (row < 0) row = rows.length;
      rows[row] = left + w;
      n.label.style.setProperty('--row', String(row));
    }
  };
  const pct = (x: number, y: number) => `left:${((x - bx) / bw) * 100}%;top:${((y - by) / bh) * 100}%`;
  const svg = [`<svg viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="none" aria-hidden="true">`];
  for (const l of now.links) svg.push(`<line class="link${l.open ? ' open' : ''}" x1="${l.from[0]}" y1="${l.from[1]}" x2="${l.to[0]}" y2="${l.to[1]}"/>`);
  for (const q of now.places) svg.push(`<rect class="place ${q.state}${q.here ? ' here' : ''}${q.street ? ' street' : ''}" x="${q.box[0]}" y="${q.box[1]}" width="${q.box[2]}" height="${q.box[3]}" rx="${q.street ? 4 : 3}"/>`);
  svg.push('</svg>');
  chart.insertAdjacentHTML('beforeend', svg.join(''));
  // each place a thing to tap; a room's name in it, a street's under it at its far end, clear of its doors and people
  for (const q of now.places) {
    const cls = `${q.state}${q.here ? ' here' : ''}${q.street ? ' street' : ''}`;
    const b = button(`place ${cls}`, q.state === 'seen' ? `${q.name}: not been there yet, go to its door` : q.here ? `${q.name}: you are here` : `Go to ${q.name}`, chart, () => go(q.go, q.name));
    b.setAttribute('style', `${pct(q.box[0], q.box[1])};width:${(q.box[2] / bw) * 100}%;height:${(q.box[3] / bh) * 100}%`);
    const name = el('span', `place-name ${cls}`, chart, q.state === 'seen' ? `${q.name}?` : q.name);
    name.setAttribute('style', q.street ? `${pct(q.box[0] + q.box[2], q.box[1] + q.box[3])}` : pct(q.box[0], q.box[1]));
  }
  const named: { at: number; label: HTMLElement }[] = [];
  for (const s of now.spots) {
    const b = button(`spot ${s.kind}`, `Go to ${s.name}`, chart, () => go(s.go, s.name));
    b.setAttribute('style', pct(s.at[0], s.at[1]));
    if (s.named) named.push({ at: s.at[0], label: el('span', 'name', b, s.name) });
  }
  if (now.you) {
    const y = el('div', 'you', chart);
    y.setAttribute('style', pct(now.you[0], now.you[1]));
    y.setAttribute('aria-label', 'You are here');
  }
  requestAnimationFrame(fit);
  new ResizeObserver(fit).observe(body);
}
