// The map: the city in profile, as she walks it. Each street a road along its row, as long as it is wide, so where a
// thing is along it is where it is on the map, its name under it; each room above the door it opens from, its own door
// over that one, joined to it; the people and things of note on them, their names under the road; a pin where she is.
// A door out leads to a place sketched in, dashed, with a question mark, until she has been through it. Tapping a place
// she has been takes her there, a door or a person to them, and a place she has only seen the door of to that door.

import { button, el } from './dom';
import { inView, pick, placeIn, type Hotspot, type ViewText } from './level';

export interface MapLayout {
  /**
   * Each place on the map (a scene). A street is laid at `at`, in map units, a tenth of its width long; a room goes
   * above the place whose door opens into it, its own door over that one, unless `at` puts it somewhere else. `size`
   * is a room's, in map units; `spawn` is where she arrives, going there from the map.
   */
  places: Record<string, { at?: [number, number]; size?: [number, number]; spawn?: string }>;
}

/** What the map needs of a scene's file. */
export interface MapScene {
  id: string;
  name: ViewText;
  kind: 'exterior' | 'interior';
  size: [number, number];
  spawns: Record<string, { x: number }>;
  hotspots: Hotspot[];
}

/** Where tapping takes her: a scene, arriving at one of its places to arrive, or at a hotspot (where she stands to use it). */
export interface Travel { scene: string; spawn?: string; at?: string }

type Box = [number, number, number, number];
export interface MapPlace { id: string; name: string; box: Box; state: 'been' | 'seen'; here: boolean; street: boolean; go: Travel }
/**
 * `named`: its name shown by it; a door to a place on the map has none, the place says where it goes (`to`). `street`:
 * it is on a road, its name under it.
 */
export interface MapSpot { scene: string; id: string; name: string; at: [number, number]; kind: 'door' | 'person' | 'thing'; named: boolean; street: boolean; to?: string; go: Travel }
export interface MapLink { from: [number, number]; to: [number, number]; open: boolean }
export interface MapNow { places: MapPlace[]; spots: MapSpot[]; links: MapLink[]; you: [number, number] | null; bounds: Box }

/** A road's thickness, a room's size, and how far above its door a room sits, in map units. */
export const ROAD = 8, ROOM: [number, number] = [56, 30], STEM = 12;
/** Room under a road for the names along it, in map units. */
const UNDER = 16;

/** A hotspot worth a place on the map: a way out, someone to talk to, or a thing marked for it. */
export const onMap = (h: Hotspot): MapSpot['kind'] | null => (h.map === false ? null : h.go ? 'door' : h.talk ? 'person' : h.map ? 'thing' : null);

const across = (h: Hotspot) => h.rect[0] + h.rect[2] / 2;
const clamp = (f: number) => Math.max(0.03, Math.min(0.97, f));
const overlaps = (a: Box, b: Box, gap: number) => a[0] < b[0] + b[2] + gap && b[0] < a[0] + a[2] + gap && a[1] < b[1] + b[3] + gap && b[1] < a[1] + a[3] + gap;

/**
 * Where each place on the map is drawn: each street where the layout lays it; then each room above the place whose door
 * opens into it (a street, or a room placed before it), where she arrives in it over that door, raised above any room
 * already there. A room with no door to it from the map, and no `at`, is left off.
 */
export function placeBoxes(layout: MapLayout, scenes: Record<string, MapScene>): Record<string, { box: Box; street: boolean }> {
  const out: Record<string, { box: Box; street: boolean }> = {};
  const ids = Object.keys(layout.places).filter((id) => scenes[id]);
  for (const id of ids) {
    const s = scenes[id], l = layout.places[id];
    if (s.kind === 'exterior') out[id] = { box: [l.at?.[0] ?? 0, l.at?.[1] ?? 0, l.size?.[0] ?? s.size[0] / 10, ROAD], street: true };
  }
  let rooms = ids.filter((id) => !out[id]);
  for (let pass = 0; rooms.length && pass < ids.length; pass++) {
    rooms = rooms.filter((id) => {
      const s = scenes[id], l = layout.places[id], [w, h] = l.size ?? ROOM;
      if (l.at) { out[id] = { box: [l.at[0], l.at[1], w, h], street: false }; return false; }
      // the door into it from a place already drawn, streets first
      for (const [from, o] of Object.entries(out)) {
        const door = scenes[from].hotspots.find((d) => d.go?.scene === id);
        if (!door) continue;
        const x = o.box[0] + clamp(across(door) / scenes[from].size[0]) * o.box[2];
        const back = s.spawns[door.go!.spawn]?.x ?? s.size[0] / 2, box: Box = [x - (back / s.size[0]) * w, o.box[1] - STEM - h, w, h];
        while (Object.values(out).some((p) => overlaps(p.box, box, 3))) box[1] -= h + STEM;
        out[id] = { box, street: false };
        return false;
      }
      return true;
    });
  }
  return out;
}

/**
 * The map as she knows it: `been` the scenes she has been in, `seen(scene, id)` whether she has seen a hotspot there,
 * `shown` whether one is there now (the story's conditions), `here` where she is.
 */
export function mapNow(layout: MapLayout, scenes: Record<string, MapScene>, been: ReadonlySet<string>, seen: (scene: string, id: string) => boolean,
  here: { scene: string; x: number }, raw: boolean, shown: (h: Hotspot) => boolean): MapNow {
  const boxes = placeBoxes(layout, scenes);
  // a point along a place, as far along it as x is along the scene: on a road its middle, in a room under its name
  const pointIn = (id: string, x: number): [number, number] => {
    const { box, street } = boxes[id];
    return [box[0] + clamp(x / scenes[id].size[0]) * box[2], box[1] + box[3] * (street ? 0.5 : 0.62)];
  };
  const places: MapPlace[] = [], spots: MapSpot[] = [], links: MapLink[] = [], joined = new Set<string>();
  const firstSpawn = (id: string) => layout.places[id]?.spawn ?? Object.keys(scenes[id]?.spawns ?? {})[0];
  for (const id of Object.keys(layout.places)) {
    const b = been.has(id) ? boxes[id] : undefined;
    if (b) places.push({ id, name: pick(scenes[id].name, raw), box: b.box, state: 'been', here: id === here.scene, street: b.street, go: { scene: id, spawn: firstSpawn(id) } });
  }
  for (const p of [...places]) {
    const pb = boxes[p.id].box;
    for (const h of scenes[p.id].hotspots) {
      const kind = onMap(h);
      if (!kind || !inView(h, raw) || !shown(h) || !seen(p.id, h.id)) continue;
      const { rect } = placeIn(h, raw), to = h.go?.scene, tb = to ? boxes[to] : undefined;
      let at = pointIn(p.id, rect[0] + rect[2] / 2);
      // a room's door back out is at its foot, where the line to the door it opens from leaves it
      if (kind === 'door' && !p.street && tb && tb.box[1] > pb[1]) at = [at[0], pb[1] + pb[3]];
      spots.push({ scene: p.id, id: h.id, name: pick(h.name, raw), at, kind, named: !tb, street: p.street, to: tb ? to : undefined, go: { scene: p.id, at: h.id } });
      // where a door leads: the place there, or one sketched in, as its door says, until she has been through it
      if (!to || !tb) continue;
      let target = places.find((q) => q.id === to);
      if (!target) {
        target = { id: to, name: pick(scenes[to].name, raw), box: tb.box, state: 'seen', here: false, street: tb.street, go: { scene: p.id, at: h.id } };
        places.push(target);
      }
      const pair = [p.id, to].sort().join('|');
      if (joined.has(pair) && target.state === 'been') continue;
      joined.add(pair);
      // from its edge facing the place it leads to, to where she arrives there, at its edge facing back
      const [, ty, , th] = target.box, arrive = scenes[to].spawns[h.go!.spawn]?.x, x = arrive !== undefined ? pointIn(to, arrive)[0] : at[0];
      const up = ty + th <= pb[1], down = ty >= pb[1] + pb[3];
      links.push({ from: [at[0], up ? pb[1] : down ? pb[1] + pb[3] : at[1]], to: [x, up ? ty + th : down ? ty : ty + th / 2], open: target.state === 'seen' });
    }
  }
  const you = been.has(here.scene) && boxes[here.scene] ? pointIn(here.scene, here.x) : null;
  const xs = places.flatMap((p) => [p.box[0], p.box[0] + p.box[2]]), ys = places.flatMap((p) => [p.box[1], p.box[1] + p.box[3] + (p.street ? UNDER : 0)]);
  const pad = 10, bounds: Box = xs.length
    ? [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad]
    : [0, 0, 100, 60];
  return { places, spots, links, you, bounds };
}

/**
 * The map drawn into `body` (her journal's places): the roads and the rooms over their doors, the people and things of
 * note as dots, where she is; each a thing to tap. Names along a road sit under it in rows, so none covers another.
 */
export function drawMap(body: HTMLElement, now: MapNow, go: (t: Travel, name: string) => void): void {
  const chart = el('div', 'chart', body);
  const [bx, by, bw, bh] = now.bounds;
  const pct = (x: number, y: number) => `left:${((x - bx) / bw) * 100}%;top:${((y - by) / bh) * 100}%`;
  const svg = [`<svg viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="none" aria-hidden="true">`];
  for (const l of now.links) svg.push(`<line class="link${l.open ? ' open' : ''}" x1="${l.from[0]}" y1="${l.from[1]}" x2="${l.to[0]}" y2="${l.to[1]}"/>`);
  for (const q of now.places) {
    const [x, y, w, h] = q.box;
    svg.push(`<rect class="${q.street ? 'road' : 'room'} ${q.state}${q.here ? ' here' : ''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${q.street ? h / 2 : 2.5}"/>`);
  }
  svg.push('</svg>');
  chart.insertAdjacentHTML('beforeend', svg.join(''));
  // under each road, its name at its start and the names along it, put in rows when the chart is sized
  const under = new Map<string, { at: number; centred: boolean; label: HTMLElement }[]>();
  const along = (scene: string) => under.get(scene) ?? under.set(scene, []).get(scene)!;
  for (const q of now.places) {
    const cls = `${q.state}${q.here ? ' here' : ''}${q.street ? ' street' : ' room'}`;
    const b = button(`place ${cls}`, q.state === 'seen' ? `${q.name}: not been there yet, go to its door` : q.here ? `${q.name}: you are here` : `Go to ${q.name}`, chart, () => go(q.go, q.name));
    b.setAttribute('style', `${pct(q.box[0], q.box[1])};width:${(q.box[2] / bw) * 100}%;height:${(q.box[3] / bh) * 100}%`);
    const name = el('span', `place-name ${cls}`, chart, q.state === 'seen' ? `${q.name}?` : q.name);
    name.setAttribute('style', pct(q.box[0], q.street ? q.box[1] + q.box[3] : q.box[1]));
    if (q.street) along(q.id).push({ at: q.box[0], centred: false, label: name });
  }
  for (const s of now.spots) {
    // a way along the road to the next street is the joint between them
    const joint = s.street && now.places.some((q) => q.id === s.to && q.street);
    const b = button(`spot ${s.kind}${s.street ? ' on-road' : ''}${joint ? ' joint' : ''}`, `Go to ${s.name}`, chart, () => go(s.go, s.name));
    b.setAttribute('style', pct(s.at[0], s.at[1]));
    if (!s.named) continue;
    const label = el('span', 'name', b, s.name);
    if (s.street) along(s.scene).push({ at: s.at[0], centred: true, label });
  }
  if (now.you) {
    const y = el('div', 'you', chart);
    y.setAttribute('style', pct(now.you[0], now.you[1]));
    y.setAttribute('aria-label', 'You are here');
  }
  // as large as the panel allows, at the map's own shape
  const fit = () => {
    const k = Math.min(body.clientWidth / bw, body.clientHeight / bh);
    chart.style.width = `${bw * k}px`;
    chart.style.height = `${bh * k}px`;
    chart.style.setProperty('--road', `${ROAD * k}px`);
    for (const labels of under.values()) {
      const rows: number[] = [];
      for (const n of [...labels].sort((a, b) => a.at - b.at)) {
        const w = n.label.offsetWidth, left = (n.at - bx) * k - (n.centred ? w / 2 : 0);
        let row = rows.findIndex((right) => left > right + 8);
        if (row < 0) row = rows.length;
        rows[row] = left + w;
        n.label.style.setProperty('--row', String(row));
      }
    }
  };
  requestAnimationFrame(fit);
  new ResizeObserver(fit).observe(body);
}
