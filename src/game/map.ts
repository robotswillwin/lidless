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
   * above the place whose door opens into it, its own door over that one, unless `at` puts it somewhere else. A floor
   * a lift goes to has no door into it: `over` puts it above another (the floor below), the two lifts one over the
   * other, joined. `size` is a room's, in map units; `spawn` is where she arrives, going there from the map.
   */
  places: Record<string, { at?: [number, number]; size?: [number, number]; spawn?: string; over?: string }>;
}

/** What the map needs of a scene's file. */
export interface MapScene {
  id: string;
  name: ViewText;
  kind: 'exterior' | 'interior';
  size: [number, number];
  spawns: Record<string, { x: number }>;
  hotspots: Hotspot[];
  /** The tower floor it is on (0 the lobby/street, negative underground), for the map's floor axis. */
  floor?: number;
  /** A still of the place's art (its background), for a room she has not been to — shown dimmed, in grey. */
  art?: string;
}

/** Where tapping takes her: a scene, arriving at one of its places to arrive, or at a hotspot (where she stands to use it). */
export interface Travel { scene: string; spawn?: string; at?: string }

type Box = [number, number, number, number];
/**
 * `picture`: the place as she last saw it, for its card (the game's, by the place's id). `floor`: the tower floor it is
 * on. `art`: a still of its background, for a place she has not been to. State: `been` she has been in it, `seen` she
 * knows its door, `unknown` it is only drawn as part of the building, dim and grey.
 */
export interface MapPlace { id: string; name: string; box: Box; state: 'been' | 'seen' | 'unknown'; here: boolean; street: boolean; go: Travel; picture?: string; floor?: number; art?: string }
/**
 * `named`: its name shown by it; a door to a place on the map has none, the place says where it goes (`to`). `street`:
 * it is on a road, its name under it.
 */
export interface MapSpot { scene: string; id: string; name: string; at: [number, number]; kind: 'door' | 'person' | 'thing'; named: boolean; street: boolean; to?: string; go: Travel }
export interface MapLink { from: [number, number]; to: [number, number]; open: boolean }
export interface MapNow { places: MapPlace[]; spots: MapSpot[]; links: MapLink[]; you: [number, number] | null; bounds: Box }

/** A road's thickness, a room's size (a card with its picture, at the screen's shape), and how far above its door a room sits, in map units. */
export const ROAD = 6, ROOM: [number, number] = [48, 27], STEM = 11;
/** Room under a road for the names along it, in map units. */
const UNDER = 16;
/**
 * The most pixels a map unit is drawn (a map of few places at its size, not blown up to fill the panel), and the
 * fewest (a room's card wide enough for its name and its picture): a map bigger than that scrolls under the finger.
 */
const MOST = 3.2, LEAST = 2.5;

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
      // a floor over another: its place to arrive at over the other's of the same name (the lift), else centred
      if (l.over) {
        const o = out[l.over], below = scenes[l.over];
        if (!o || !below) return true;
        const name = l.spawn, there = name ? below.spawns[name]?.x : undefined, here = name ? s.spawns[name]?.x : undefined;
        const x = there !== undefined ? o.box[0] + clamp(there / below.size[0]) * o.box[2] : o.box[0] + o.box[2] / 2;
        const box: Box = [x - ((here ?? s.size[0] / 2) / s.size[0]) * w, o.box[1] - STEM - h, w, h];
        while (Object.values(out).some((p) => overlaps(p.box, box, 3))) box[1] -= h + STEM;
        out[id] = { box, street: false };
        return false;
      }
      // the door into it from a place already drawn, streets first
      for (const [from, o] of Object.entries(out)) {
        const door = scenes[from].hotspots.find((d) => d.go?.scene === id);
        if (!door) continue;
        const x = o.box[0] + clamp(across(door) / scenes[from].size[0]) * o.box[2];
        const back = s.spawns[door.go!.spawn]?.x ?? s.size[0] / 2;
        // a flat entered from a floor's corridor (the door is from a room, not a street) is ON that floor: it sits at the
        // same level, beside the corridor. A shop off a street sits just above the street.
        if (!o.street) {
          const box: Box = [o.box[0] + o.box[2] + STEM, o.box[1], w, h]; // to the right of the corridor, same level
          while (Object.values(out).some((p) => overlaps(p.box, box, 3))) box[0] += w + STEM;
          out[id] = { box, street: false };
          return false;
        }
        const box: Box = [x - (back / s.size[0]) * w, o.box[1] - STEM - h, w, h];
        while (Object.values(out).some((p) => overlaps(p.box, box, 3))) box[1] -= h + STEM;
        out[id] = { box, street: false };
        return false;
      }
      // or its own door leads to a floor already drawn (the floor has no door back marked): a flat off that floor, placed
      // beside it on the same level — this is how Athena's flat, reached from floor 9, finds its place
      for (const d of s.hotspots) {
        const to = d.go?.scene, o = to ? out[to] : undefined;
        if (!o || o.street) continue;
        const box: Box = [o.box[0] - STEM - w, o.box[1], w, h]; // to the left of the corridor, same level
        while (Object.values(out).some((p) => overlaps(p.box, box, 3))) box[0] -= w + STEM;
        out[id] = { box, street: false };
        return false;
      }
      return true;
    });
  }
  return out;
}

/**
 * Arrange the places as a transit map: each floor of the tower is its own vertical line, the floors parallel and side by
 * side; the flat on a floor sits directly above that floor's station, and the lift joins the floor stations in a row. The
 * streets run as one line along the bottom, the shops stops along it, and the lobby drops from the lift down to it. This
 * replaces the cutaway's geometry with clean columns, so every link is horizontal or vertical. Changes the boxes in place.
 *
 * `floorOf` gives a scene's tower floor; `doorsOut` its door targets. Positions are in map units.
 */
function metroArrange(
  boxes: Record<string, { box: Box; street: boolean }>,
  floorOf: (id: string) => number | undefined,
  doorsOut: (id: string) => string[],
): void {
  const ids = Object.keys(boxes);
  const [w, h] = ROOM, COL = w + 16, ROW = h + 16;
  const put = (id: string, cx: number, cyTop: number) => { boxes[id].box = [cx - w / 2, cyTop, w, h]; };
  const doorPeers = (id: string) => [...doorsOut(id), ...ids.filter((o) => doorsOut(o).includes(id))];
  // the floors (those with a tower floor number): one column each, highest on the left, all on the same row (the lift
  // level), so the lift joins them as a horizontal line and each floor is its own vertical line
  const floors = ids.filter((id) => !boxes[id].street && floorOf(id) !== undefined).sort((a, b) => (floorOf(b) ?? 0) - (floorOf(a) ?? 0));
  const floorSet = new Set(floors), colX = new Map<string, number>();
  const yFloorTop = 0;
  floors.forEach((id, i) => { const cx = i * COL; colX.set(id, cx); put(id, cx, yFloorTop); });
  // a flat (a room whose door joins a floor) sits directly above that floor: same column, the row above
  const flatCol = new Map<string, number>();
  for (const id of ids) {
    if (boxes[id].street || floorSet.has(id)) continue;
    const f = doorPeers(id).find((t) => floorSet.has(t));
    if (f !== undefined && colX.has(f)) { const cx = colX.get(f)!; flatCol.set(id, cx); put(id, cx, yFloorTop - ROW); }
  }
  // the streets: one horizontal line along the bottom, left to right in layout order; shops become stops just above it
  const streets = ids.filter((id) => boxes[id].street);
  const yStreetTop = yFloorTop + ROW * 2;
  const streetX = new Map<string, number>();
  streets.forEach((id, i) => { const cx = i * COL * 2.2; streetX.set(id, cx); boxes[id].box = [cx - COL * 1.1, yStreetTop, COL * 2.2, ROAD]; });
  let si = 0;
  for (const id of ids) {
    if (boxes[id].street || floorSet.has(id) || flatCol.has(id)) continue;
    const st = doorPeers(id).find((t) => streetX.has(t));
    if (st !== undefined) put(id, (streetX.get(st) ?? 0) + (si++ - 0.5) * COL * 1.3, yStreetTop - ROW);
    else put(id, (si++) * COL, yStreetTop - ROW * 2); // anything else: a row of its own, so it is never left stale
  }
}

/**
 * The map as she knows it: `been` the scenes she has been in, `seen(scene, id)` whether she has seen a hotspot there,
 * `shown` whether one is there now (the story's conditions), `here` where she is.
 */
export function mapNow(layout: MapLayout, scenes: Record<string, MapScene>, been: ReadonlySet<string>, seen: (scene: string, id: string) => boolean,
  here: { scene: string; x: number }, raw: boolean, shown: (h: Hotspot) => boolean): MapNow {
  const boxes = placeBoxes(layout, scenes);
  // arrange the placed scenes as a transit map: floors in parallel columns, flats above their floor, streets along the
  // bottom (placeBoxes still decides which scenes get a box; this sets where they sit)
  metroArrange(boxes, (id) => scenes[id]?.floor, (id) => (scenes[id]?.hotspots ?? []).map((h) => h.go?.scene).filter((s): s is string => !!s));
  // a point along a place, as far along it as x is along the scene: on a road its middle, in a room under its name
  const pointIn = (id: string, x: number): [number, number] => {
    const { box, street } = boxes[id];
    return [box[0] + clamp(x / scenes[id].size[0]) * box[2], box[1] + box[3] * (street ? 0.5 : 0.62)];
  };
  const places: MapPlace[] = [], spots: MapSpot[] = [], links: MapLink[] = [];
  const firstSpawn = (id: string) => layout.places[id]?.spawn ?? Object.keys(scenes[id]?.spawns ?? {})[0];
  for (const id of Object.keys(layout.places)) {
    const b = been.has(id) ? boxes[id] : undefined;
    if (b) places.push({ id, name: pick(scenes[id].name, raw), box: b.box, state: 'been', here: id === here.scene, street: b.street, go: { scene: id, spawn: firstSpawn(id) }, floor: scenes[id].floor, art: scenes[id].art });
  }
  for (const p of [...places]) {
    const pb = boxes[p.id].box;
    for (const h of scenes[p.id].hotspots) {
      const kind = onMap(h);
      if (!kind || !inView(h, raw) || !shown(h) || !seen(p.id, h.id)) continue;
      const { rect } = placeIn(h, raw), to = h.go?.scene, tb = to ? boxes[to] : undefined;
      let at = pointIn(p.id, rect[0] + rect[2] / 2);
      // a room's door to a place below it is at its foot, to a place above it at its top, where the line leaves it
      if (kind === 'door' && !p.street && tb && tb.box[1] > pb[1]) at = [at[0], pb[1] + pb[3]];
      else if (kind === 'door' && !p.street && tb && tb.box[1] + tb.box[3] <= pb[1]) at = [at[0], pb[1]];
      spots.push({ scene: p.id, id: h.id, name: pick(h.name, raw), at, kind, named: !tb, street: p.street, to: tb ? to : undefined, go: { scene: p.id, at: h.id } });
      // where a door leads: the place there, or one sketched in, as its door says, until she has been through it
      if (!to || !tb) continue;
      let target = places.find((q) => q.id === to);
      if (!target) {
        target = { id: to, name: pick(scenes[to].name, raw), box: tb.box, state: 'seen', here: false, street: tb.street, go: { scene: p.id, at: h.id }, floor: scenes[to].floor };
        places.push(target);
      }
      // (the line between p and its door's target is drawn by the structural-links pass below, centre to centre)
    }
  }
  // the rest of the building she has not reached: every other place with a box, drawn dim and grey as part of the whole
  // tower (a still of its art, no name), so the map is the building, not only the rooms she has been to. Added before the
  // lift is drawn, so the shaft runs through the floors she has not been to as well.
  for (const id of Object.keys(layout.places)) {
    if (places.some((q) => q.id === id) || !boxes[id] || !scenes[id]) continue;
    const b = boxes[id];
    places.push({ id, name: pick(scenes[id].name, raw), box: b.box, state: 'unknown', here: false, street: b.street, go: { scene: id, spawn: firstSpawn(id) }, floor: scenes[id].floor, art: scenes[id].art });
  }
  // All the building's ways, as the transit map draws them: a line between the stations of two places joined by the lift
  // (the `over` chain) or by a door — whether or not she has seen it, so the whole network shows. A line is faded until
  // she has been along it (both ends visited). Centre to centre, so drawMap can route them as metro lines.
  const placed = new Map(places.map((p) => [p.id, p]));
  const linked = new Set<string>();
  const centreOf = (p: MapPlace): [number, number] => [p.box[0] + p.box[2] / 2, p.box[1] + p.box[3] / 2];
  const join = (a?: MapPlace, b?: MapPlace) => {
    if (!a || !b || a.id === b.id) return;
    const key = [a.id, b.id].sort().join('|');
    if (linked.has(key)) return;
    linked.add(key);
    links.push({ from: centreOf(a), to: centreOf(b), open: !(a.state === 'been' && b.state === 'been') });
  };
  for (const p of places) {
    join(p, placed.get(layout.places[p.id]?.over ?? '')); // the lift, up the floors
    for (const h of scenes[p.id]?.hotspots ?? []) join(p, h.go?.scene ? placed.get(h.go.scene) : undefined); // a door
  }
  const you = been.has(here.scene) && boxes[here.scene] ? pointIn(here.scene, here.x) : null;
  const xs = places.flatMap((p) => [p.box[0], p.box[0] + p.box[2]]), ys = places.flatMap((p) => [p.box[1], p.box[1] + p.box[3] + (p.street ? UNDER : 0)]);
  const pad = 10, bounds: Box = xs.length
    ? [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad]
    : [0, 0, 100, 60];
  return { places, spots, links, you, bounds };
}

/**
 * The map drawn into `body` (her journal's places): the roads as lines with their names under them, each room a card
 * over its door with its picture as she last saw it and its name on it, a place she has only seen the door of dashed
 * with a question mark; the people and things of note as dots; where she is. A tap on any of it picks its place, shown
 * beside the map: its picture larger, who and what she knows there, and the way there. Nothing travels at one tap.
 */
export function drawMap(body: HTMLElement, now: MapNow, go: (t: Travel, name: string) => void): void {
  const map = el('div', 'map-view', body), area = el('div', 'area', map), chart = el('div', 'chart', area), detail = el('aside', 'place-detail', map);
  detail.setAttribute('aria-live', 'polite');
  const [bx, by, bw, bh] = now.bounds;
  const pct = (x: number, y: number) => `left:${((x - bx) / bw) * 100}%;top:${((y - by) / bh) * 100}%`;
  // Her AR map of the building drawn as a transit map: each place a station, the ways between them coloured lines — the
  // lift one line up the floors, the street another along the ground, short links for a flat off a corridor. A station
  // she has been to is filled, one she has not is hollow; where she is now is ringed. The lines and dots are the SVG
  // (its strokes kept fine at any size); the names and the tap targets sit over it as DOM.
  const centre = (b: Box): [number, number] => [b[0] + b[2] / 2, b[1] + b[3] / 2];
  const stations = new Map<string, { p: [number, number]; q: MapPlace; deg: number }>();
  for (const q of now.places) stations.set(q.id, { p: centre(q.box), q, deg: 0 });
  // the link endpoints are station centres: match each to its station
  const at = (pt: [number, number]) => [...stations.values()].find((s) => Math.abs(s.p[0] - pt[0]) < 0.5 && Math.abs(s.p[1] - pt[1]) < 0.5);
  const svg = [`<svg viewBox="${bx} ${by} ${bw} ${bh}" preserveAspectRatio="none" aria-hidden="true">`];
  // the lines: each link drawn in straight segments only (a transit map has no diagonals). A run that is already
  // horizontal or vertical is one straight line; a link that is neither bends once at a right angle (an L), going along
  // whichever axis is longer first. A way she has not taken is faded.
  const EPS = 0.75;
  for (const l of now.links) {
    const sa = at(l.from), sb = at(l.to);
    if (!sa || !sb || sa === sb) continue;
    sa.deg++; sb.deg++;
    const [ax, ay] = sa.p, [bx2, by2] = sb.p, dx = Math.abs(bx2 - ax), dy = Math.abs(by2 - ay);
    const cls = `route ${dy > dx ? 'lift' : 'ground'}${l.open ? ' open' : ''}`;
    if (dx < EPS || dy < EPS) {
      svg.push(`<line class="${cls}" x1="${ax}" y1="${ay}" x2="${bx2}" y2="${by2}"/>`); // already straight
    } else {
      // bend at a right angle: travel the longer axis first, so the corner sits near the lesser station
      const corner: [number, number] = dy >= dx ? [ax, by2] : [bx2, ay];
      svg.push(`<polyline class="${cls}" points="${ax},${ay} ${corner[0]},${corner[1]} ${bx2},${by2}"/>`);
    }
  }
  // the station dots, over the lines: filled where she has been, hollow where she has not, a ring where she is
  for (const [id, s] of stations) {
    const inter = s.deg >= 3;
    svg.push(`<g class="stn ${s.q.state}${s.q.here ? ' here' : ''}${inter ? ' interchange' : ''}" data-id="${id}">` +
      `<circle class="dot" cx="${s.p[0]}" cy="${s.p[1]}" r="${inter ? 3.6 : 2.8}"/></g>`);
  }
  svg.push('</svg>');
  chart.insertAdjacentHTML('beforeend', svg.join(''));
  // which way each station's lines leave it, so its name goes to a clear side (opposite a branch, never over a line)
  const dirs = new Map<string, { left: boolean; right: boolean; up: boolean; down: boolean }>();
  for (const id of stations.keys()) dirs.set(id, { left: false, right: false, up: false, down: false });
  for (const l of now.links) {
    const sa = at(l.from), sb = at(l.to);
    if (!sa || !sb) continue;
    const da = dirs.get(sa.q.id)!, db = dirs.get(sb.q.id)!, dx = sb.p[0] - sa.p[0], dy = sb.p[1] - sa.p[1];
    if (Math.abs(dx) > 1) { (dx > 0 ? (da.right = true) : (da.left = true)); (dx > 0 ? (db.left = true) : (db.right = true)); }
    if (Math.abs(dy) > 1) { (dy > 0 ? (da.down = true) : (da.up = true)); (dy > 0 ? (db.up = true) : (db.down = true)); }
  }
  // the tap target and name for each station, as DOM over its dot
  const buttons = new Map<string, HTMLButtonElement>();
  for (const [id, s] of stations) {
    const q = s.q, cls = `${q.state}${q.here ? ' here' : ''}`;
    const label = q.state === 'unknown' ? 'A place she has not reached' : q.state === 'seen' ? `${q.name}: not been there yet, go to its door` : q.here ? `${q.name}: you are here` : `Go to ${q.name}`;
    const b = button(`stop ${cls}`, label, chart, () => pick(q));
    b.dataset.cue = 'choose';
    b.setAttribute('style', pct(s.p[0], s.p[1]));
    buttons.set(id, b);
    // its name on a clear side: a street station below; otherwise opposite whichever side has a branch, so it never sits
    // over a line (left if a line goes right, right if one goes left, else right)
    if (q.state !== 'unknown') {
      const d = dirs.get(id)!;
      const side = q.street ? 'below' : d.right && !d.left ? 'left' : d.left && !d.right ? 'right' : d.up && !d.down ? 'below' : 'right';
      const name = el('span', `stn-name ${cls} ${side}`, chart, q.name);
      name.setAttribute('style', pct(s.p[0], s.p[1]));
    }
  }
  // where she is now: a pulsing ring around her station
  const hereStn = [...stations.values()].find((s) => s.q.here);
  if (hereStn) { const ring = el('div', 'here-ring', chart); ring.setAttribute('style', pct(hereStn.p[0], hereStn.p[1])); ring.setAttribute('aria-label', 'You are here'); }
  // a legend: what a filled and a hollow station mean
  const legend = el('div', 'legend', map);
  const key = (cls: string, label: string) => { const row = el('div', 'key', legend); el('span', `swatch ${cls}`, row); el('span', '', row, label); };
  key('been', 'Visited');
  key('seen', 'Not yet reached');

  /** A place picked: its station lit on the map, and shown beside it, with the way there and what she knows there. */
  function pick(q: MapPlace): void {
    for (const [id, b] of buttons) b.classList.toggle('picked', id === q.id);
    // light the station picked (its dot is in the SVG, not the button)
    chart.querySelectorAll('.stn').forEach((c) => c.classList.toggle('lit', (c as SVGElement).dataset.id === q.id));
    detail.replaceChildren();
    const unknown = q.state === 'unknown', src = q.picture ?? q.art;
    const shot = el('div', `shot${src ? '' : ' none'}${unknown ? ' dim' : ''}`, detail);
    if (src) { const img = el('img', '', shot) as HTMLImageElement; img.src = src; img.alt = ''; el('span', 'tint', shot); }
    else el('span', '', shot, '?');
    el('h3', 'name', detail, unknown ? 'Somewhere in the building' : q.name);
    el('p', 'state', detail, unknown ? 'She has not reached it.' : q.here ? 'You are here' : q.state === 'seen' ? 'Not been there yet. She knows its door.' : q.street ? 'A street' : 'Been there');
    const here = now.spots.filter((s) => s.scene === q.id && s.named);
    if (here.length) {
      const list = el('ul', 'here', detail);
      for (const s of here) { const b = button('spot-go', `Go to ${s.name}`, el('li', s.kind, list), () => go(s.go, s.name)); b.textContent = s.name; b.dataset.cue = 'confirm'; }
    }
    // she can go to a place she knows (been, or a door she has seen); a place she has not reached offers no way yet
    if (!q.here && !unknown) { const b = button('go', q.state === 'seen' ? `Go to ${q.name}'s door` : `Go to ${q.name}`, detail, () => go(q.go, q.name)); b.textContent = q.state === 'seen' ? 'Go to its door' : 'Go there'; b.dataset.cue = 'confirm'; }
  }
  pick(now.places.find((q) => q.here) ?? now.places[0]);

  // as large as the area allows, at the map's own shape; the stations and their names scale with it
  const fit = () => {
    const W = area.clientWidth, H = area.clientHeight;
    const k = Math.max(LEAST, Math.min(W / bw, H / bh, MOST));
    chart.style.width = `${bw * k}px`;
    chart.style.height = `${bh * k}px`;
    chart.style.setProperty('--k', String(k));
    // too big for the page: it scrolls, its edges fading where there is more, and opens on where she is
    area.classList.toggle('scrolls-x', bw * k + 24 > W);
    area.classList.toggle('scrolls-y', bh * k + 24 > H);
    const you = now.you ?? now.places.find((q) => q.here)?.box.slice(0, 2) as [number, number] | undefined;
    if (you) { area.scrollLeft = (you[0] - bx) * k - W / 2; area.scrollTop = (you[1] - by) * k - H / 2; }
  };
  requestAnimationFrame(fit);
  new ResizeObserver(fit).observe(area);
}
