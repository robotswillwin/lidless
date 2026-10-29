// Her Places map, as the chapter's city: one wide panoramic skyline (painted by the art pipeline, no labels baked in)
// with every location drawn over it in code — a marker where each place is, lines between them, their names, and where
// she is now. The picture is only atmosphere; the map is the markers, which come from data (public/assets/maps/<chapter>.json)
// so a new place is added by editing the data, not this file.
//
// Everything lives in one SVG in one viewBox: the background as tiles, the markers and lines and names as its children.
// Panning and zooming just move the viewBox, so the markers never drift from the picture. A place she has not found is
// left out whole — its marker, its name and its lines — so nothing she should not know leaks onto the map.

import { button, el } from './dom';
import { icon } from './icons';
import type { Travel } from './map';

/** A marker's glyph (an entry in icons.ts). */
export type NodeIcon = 'home' | 'person' | 'shop' | 'door' | 'bar' | 'radio' | 'street' | 'lift';
/** Where a marker's name sits by it. */
export type LabelPos = 'above' | 'below' | 'left' | 'right';

/**
 * What kind of place a node is, which decides how it is drawn: a `street` is a thoroughfare, drawn as a labelled segment
 * of the line itself; a `stop` is a place entered from a street, a dot on that line with its name above; a `room` is a
 * place inside a building, reached from a stop, on a branch rising (or sinking) from it.
 */
export type NodeKind = 'street' | 'stop' | 'room';

/** One place on the map: an important destination, drawn at a spot on the picture. Authored, not derived from scenes. */
export interface MapNode {
  id: string;
  label: string;
  /** A second, smaller line under the name (a floor, a note): "Floor 14". */
  sublabel?: string;
  kind?: NodeKind;
  /** A street's extent along the line, 0 to 1 across (its stops sit within it); defaults to a span around x. */
  span?: [number, number];
  /** Where it sits on the picture, 0 to 1 across and down. A stop's y snaps to its street's. */
  x: number;
  y: number;
  /** The scene a tap travels to, and where she arrives in it. */
  targetScene: string;
  targetArrival?: string;
  icon?: NodeIcon;
  /** When she knows of it (a story condition; empty means always). Drawn only once known. */
  discoveredWhen?: string;
  /** When she can go there (empty means always). Known but not this: she can look, not travel. */
  accessibleWhen?: string;
  labelPosition?: LabelPos;
  group?: string;
}

/** A line between two places. Drawn only when both ends are known (and `visibleWhen`, if set). */
export interface Connection {
  from: string;
  to: string;
  style?: 'road' | 'lift' | 'tunnel';
  visibleWhen?: string;
}

/** A chapter's whole map: one picture and the places and lines on it. */
export interface ChapterMap {
  id: string;
  title: string;
  /** The panorama's asset path (under assets). */
  background: string;
  /** The marker space's shape, width over height. */
  aspectRatio: number;
  /** The picture's own shape, if it differs (for tiling it without stretching); defaults to aspectRatio. */
  imageAspect?: number;
  nodes: MapNode[];
  connections: Connection[];
}

type NodeState = 'current' | 'visited' | 'discovered' | 'inaccessible';

/** A place resolved against what she knows, ready to draw. Hidden ones are left out. */
export interface CityNode extends MapNode {
  state: NodeState;
  go: Travel;
}

/** The map resolved for drawing: the known places, the drawable lines, and where she is. */
export interface CityMapNow {
  title: string;
  /** The panorama's full URL. */
  background: string;
  aspectRatio: number;
  imageAspect: number;
  nodes: CityNode[];
  connections: { from: CityNode; to: CityNode; style: string }[];
  /** The ids she now knows of, for the game to remember (so a place stays known once found). */
  discovered: string[];
}

/**
 * Work out the map from what she knows: `test` reads a story condition, `been` is the scenes she has been in, `here` is
 * where she is now, `latch` is the places she has ever known of (kept in her save). A place is known if the story says
 * so, or it is latched, or she has been there, or it joins a place she has been to; an unknown place is left out whole.
 */
export function resolveCityMap(
  data: ChapterMap,
  test: (cond?: string) => boolean,
  been: ReadonlySet<string>,
  here: string,
  latch?: ReadonlySet<string>,
): CityMapNow {
  const visited = (n: MapNode) => been.has(n.targetScene);
  // a place joins a visited one when a connection ties them and that other end has been reached
  const neighboursVisited = new Set<string>();
  for (const c of data.connections) {
    const a = data.nodes.find((n) => n.id === c.from), b = data.nodes.find((n) => n.id === c.to);
    if (a && b && visited(a)) neighboursVisited.add(b.id);
    if (a && b && visited(b)) neighboursVisited.add(a.id);
  }
  // discoveredWhen, when set, gates on its own; when empty, a place shows once she is there, has been, is latched, or it
  // joins a place she has been to
  const isKnown = (n: MapNode): boolean => {
    if (n.targetScene === here) return true; // she is standing there
    if (n.discoveredWhen && n.discoveredWhen.length > 0) return test(n.discoveredWhen);
    return !!latch?.has(n.id) || visited(n) || neighboursVisited.has(n.id);
  };
  const nodes: CityNode[] = [];
  for (const n of data.nodes) {
    if (!isKnown(n)) continue;
    const accessible = test(n.accessibleWhen);
    const state: NodeState = n.targetScene === here ? 'current' : visited(n) ? 'visited' : accessible ? 'discovered' : 'inaccessible';
    nodes.push({ ...n, state, go: { scene: n.targetScene, spawn: n.targetArrival } });
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const connections: CityMapNow['connections'] = [];
  for (const c of data.connections) {
    const a = byId.get(c.from), b = byId.get(c.to);
    if (a && b && test(c.visibleWhen)) connections.push({ from: a, to: b, style: c.style ?? 'road' });
  }
  return {
    title: data.title,
    background: data.background,
    aspectRatio: data.aspectRatio,
    imageAspect: data.imageAspect ?? data.aspectRatio,
    nodes,
    connections,
    discovered: nodes.map((n) => n.id),
  };
}

/** The marker glyphs, from icons.ts. */
const GLYPH: Record<NodeIcon, string> = {
  home: icon('home', 15),
  person: icon('people', 15),
  shop: icon('shop', 15),
  bar: icon('bar', 15),
  radio: icon('radio', 15),
  door: icon('door', 15),
  street: icon('map', 15),
  lift: icon('lift', 15),
};
const LOCK = icon('locked', 13);

/** The map's drawing is laid out in this many units across; its height follows the aspect. */
const W = 2000;

/**
 * Draw the chapter's city map into `body`: the panorama tiled behind, the places as markers with their names, the lines
 * between them, a pulse where she is. A tap on a place she can reach travels there (`go`); a place she knows but cannot
 * reach yet she can look at, not travel to. She can pan and zoom; the markers hold to the picture.
 */
export function drawCityMap(body: HTMLElement, now: CityMapNow, go: (t: Travel, label: string) => void): void {
  const H = Math.round(W / now.aspectRatio);
  const root = el('div', 'city-map', body);
  const px = (n: CityNode): [number, number] => [n.x * W, n.y * H];

  // one SVG holds everything in one coordinate space, so pan and zoom never slip the markers off the picture
  const parts: string[] = [`<svg class="city" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${now.title}">`];
  // the panorama, tiled across without stretching (each tile as wide as the picture's own shape makes it)
  const tileW = Math.max(1, Math.round(H * now.imageAspect)), n = Math.ceil(W / tileW) + 1;
  for (let i = 0; i < n; i++) parts.push(`<image href="${now.background}" x="${i * tileW}" y="0" width="${tileW}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  // a soft darkening under the markers, so names read over any part of the picture
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#cm-veil)"/>`);
  parts.push(`<defs><linearGradient id="cm-veil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(4,9,14,0)"/><stop offset="1" stop-color="rgba(4,9,14,.35)"/></linearGradient></defs>`);
  // what kind of place each is, which street a stop sits on, and where it is drawn (a stop snaps to its street's line)
  const kindOf = (n: CityNode) => n.kind ?? 'stop';
  const streetOf = (n: CityNode): CityNode | undefined => {
    for (const c of now.connections) {
      const o = c.from.id === n.id ? c.to : c.to.id === n.id ? c.from : null;
      if (o && kindOf(o) === 'street') return o;
    }
    return undefined;
  };
  const pos = (n: CityNode): [number, number] => {
    const s = kindOf(n) === 'stop' ? streetOf(n) : undefined;
    return [n.x * W, (s ? s.y : n.y) * H];
  };
  const spanPx = (s: CityNode): [number, number] => { const [a, b] = s.span ?? [s.x - 0.1, s.x + 0.1]; return [a * W, b * W]; };
  // the lines between places, under the markers. A stop sits on its street, so needs no line of its own; two streets
  // meet at a junction (drawn with the streets below); anything else — a lift up to a room, a tunnel down — is a branch
  // drawn here, bent once at a right angle when it is neither flat nor upright (a transit map has no diagonals)
  const junctions: [number, number][] = [];
  for (const c of now.connections) {
    const ka = kindOf(c.from), kb = kindOf(c.to);
    if (ka === 'street' && kb === 'street') {
      const [a0, a1] = spanPx(c.from), [b0, b1] = spanPx(c.to);
      junctions.push([(Math.max(a0, b0) + Math.min(a1, b1)) / 2, c.from.y * H]);
      continue;
    }
    if ((ka === 'street' && kb === 'stop') || (ka === 'stop' && kb === 'street')) continue;
    const [ax, ay] = pos(c.from), [bx, by] = pos(c.to);
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    const open = c.from.state === 'inaccessible' || c.to.state === 'inaccessible';
    const cls = `conn ${c.style}${open ? ' faint' : ''}`;
    if (dx < 2 || dy < 2) parts.push(`<line class="${cls}" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`);
    else { const cxp = dy >= dx ? ax : bx, cyp = dy >= dx ? by : ay; parts.push(`<polyline class="${cls}" points="${ax},${ay} ${cxp},${cyp} ${bx},${by}"/>`); }
  }
  parts.push('</svg>');
  root.insertAdjacentHTML('beforeend', parts.join(''));
  const svg = root.querySelector('svg.city') as SVGSVGElement;

  // the markers and names, as SVG over the lines (added after so they sit on top). Each is a tap target.
  const svgns = 'http://www.w3.org/2000/svg';
  const add = (tag: string, attrs: Record<string, string | number>, parent: Element, html?: string) => {
    const e = document.createElementNS(svgns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    if (html !== undefined) e.innerHTML = html;
    parent.append(e);
    return e;
  };
  let inspect: HTMLElement | null = null;
  const closeInspect = () => { inspect?.remove(); inspect = null; };
  let dragged = false; // set true while panning, so a drag does not also fire a marker tap
  const pickFor = (nd: CityNode) => () => {
    closeInspect();
    if (nd.state === 'inaccessible') { inspect = showInspect(root, nd); return; }
    go(nd.go, nd.label);
  };
  // a tap target: fires unless the pointer was dragging the map (then it was a scroll, not a tap)
  const tap = (e: Element, pick: () => void) => e.addEventListener('click', (ev) => { ev.stopPropagation(); if (!dragged) pick(); });
  const onKey = (g: Element, pick: () => void) => g.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); pick(); } });

  // Markers keep their size on screen whatever the panel's size (as a map app's labels do): each is drawn in screen
  // pixels inside a group scaled by k, map units per pixel, refreshed when the panel resizes (`applyScale`, below).
  // On a big panel, past REF pixels per unit, they grow with the map instead, so they never look lost in it.
  const scaled: { el: Element; x: number; y: number }[] = [];
  const anchor = (e: Element, x: number, y: number) => { scaled.push({ el: e, x, y }); return e; };

  // the streets first, under everything else: each a labelled segment of the line itself, tappable along its length,
  // coloured by its own scene's state — so the line reads as scenes joined end to end; then a ring where two meet
  for (const nd of now.nodes) {
    if (kindOf(nd) !== 'street') continue;
    const [x0, x1] = spanPx(nd), y = nd.y * H;
    const g = add('g', { class: `node street ${nd.state}`, 'data-id': nd.id, role: 'button', tabindex: '0', 'aria-label': nd.label }, svg);
    add('line', { class: 'artery', x1: x0, y1: y, x2: x1, y2: y }, g);
    const hit = add('line', { class: 'artery-hit', x1: x0, y1: y, x2: x1, y2: y }, g);
    const name = anchor(add('text', { class: 'street-name', x: 0, y: 11 }, g), (x0 + x1) / 2, y);
    name.textContent = nd.label;
    const pick = pickFor(nd);
    tap(hit, pick); tap(name, pick); onKey(g, pick);
  }
  for (const [jx, jy] of junctions) anchor(add('circle', { class: 'junction', cx: 0, cy: 0, r: 6 }, svg), jx, jy);

  // the stops and rooms: a dot where the place is, a stem, and its pill — a stop's above its street, a room's beside its
  // branch. A pill is a dark bordered box with the glyph, the name and any second line (a floor), for high contrast over
  // the city. Its foreignObject sits in the marker's pixel frame, sized generously so no name is cut.
  const PILL_GAP = 10;
  for (const nd of now.nodes) {
    if (kindOf(nd) === 'street') continue;
    const [x, y] = pos(nd);
    const g = anchor(add('g', { class: `node ${kindOf(nd)} ${nd.state}`, 'data-id': nd.id, role: 'button', tabindex: '0', 'aria-label': nd.label }, svg), x, y);
    const side = nd.labelPosition ?? (kindOf(nd) === 'room' ? 'right' : 'above');
    const ph = nd.sublabel ? 40 : 32;
    const off = ph / 2 + PILL_GAP;
    const bx = side === 'left' ? -off : side === 'right' ? off : 0;
    const by = side === 'above' ? -off : side === 'below' ? off : 0;
    add('line', { class: 'stem', x1: 0, y1: 0, x2: bx, y2: by }, g);
    if (nd.state === 'current') add('circle', { class: 'ring', cx: 0, cy: 0, r: 11 }, g);
    add('circle', { class: 'node-dot', cx: 0, cy: 0, r: 5 }, g);
    const estW = Math.ceil(50 + Math.max(nd.label.length, nd.sublabel?.length ?? 0) * 9.5);
    const fx = side === 'left' ? bx - estW : side === 'right' ? bx : bx - estW / 2;
    const fo = add('foreignObject', { class: 'pill-fo', x: fx, y: by - ph / 2, width: estW, height: ph }, g);
    const wrap = document.createElement('div');
    wrap.className = `cm-pill ${nd.state}`;
    wrap.style.justifyContent = side === 'right' ? 'flex-start' : side === 'left' ? 'flex-end' : 'center';
    wrap.innerHTML = `<button type="button" class="pill-box" aria-label="${nd.label}"><span class="pill-icon">${GLYPH[nd.icon ?? 'door'] ?? GLYPH.door}</span>` +
      `<span class="pill-text"><span>${nd.label}</span>${nd.sublabel ? `<span class="pill-sub">${nd.sublabel}</span>` : ''}</span>` +
      `${nd.state === 'inaccessible' ? `<span class="pill-lock">${LOCK}</span>` : ''}</button>`;
    fo.append(wrap);
    const pick = pickFor(nd);
    // the pill (an HTML button) and the dot are the tap targets — tapped directly, so the foreignObject cannot swallow it
    tap(wrap.querySelector('.pill-box')!, pick); tap(g.querySelector('.node-dot')!, pick); onKey(g, pick);
  }

  // the title, in a corner; a small legend of what the colours mean
  el('div', 'city-title', root, now.title);
  const legend = el('div', 'city-legend', root);
  const key = (cls: string, text: string) => { const r = el('div', 'key', legend); el('span', `dot ${cls}`, r); el('span', '', r, text); };
  key('current', 'You are here');
  key('visited', 'Visited');
  key('discovered', 'Known');
  if (now.nodes.some((n) => n.state === 'inaccessible')) key('inaccessible', 'Locked');

  // scrolling only (no zoom): the viewBox is a window into the map at a fixed scale, its shape the panel's (so the
  // picture fills it with no bars). It shows the map's full height, big enough to read, and scrolls across the width.
  const view = { x: 0, y: 0, w: W, h: H };
  const apply = () => svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`);
  // the panel's shape (width over height); the viewBox keeps it so `slice` crops nothing
  const panelAspect = () => { const r = svg.getBoundingClientRect(); return r.width && r.height ? r.width / r.height : now.aspectRatio; };
  const fitScale = () => {
    const pa = panelAspect();
    view.h = H;            // show the full height — a fixed scale, no zoom
    view.w = view.h * pa;  // width follows the panel's shape
    if (view.w > W) { view.w = W; view.h = view.w / pa; } // if the panel is wider than the whole map, show it all
  };
  // markers in screen pixels: k map units per pixel, floored at a reference scale so they grow on a big panel
  const REF = 0.6;
  const applyScale = () => {
    // the layout height, not the bounding box: the panel's opening animation transforms the box for a moment
    const hpx = svg.clientHeight || svg.getBoundingClientRect().height;
    const scale = hpx ? hpx / view.h : REF;
    const k = Math.max(1 / scale, 1 / REF);
    for (const m of scaled) m.el.setAttribute('transform', `translate(${m.x} ${m.y}) scale(${k})`);
  };
  const clampPos = () => {
    view.x = Math.max(0, Math.min(W - view.w, view.x));
    view.y = Math.max(0, Math.min(H - view.h, view.y));
  };
  // the wheel scrolls across (a wide map reads left-to-right), never zooms
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    view.x += (ev.deltaX || ev.deltaY) * (view.w / svg.getBoundingClientRect().width);
    clampPos(); apply();
  }, { passive: false });
  const down = new Map<number, { x: number; y: number }>();
  svg.addEventListener('pointerdown', (ev) => { down.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); dragged = false; });
  svg.addEventListener('pointermove', (ev) => {
    const p = down.get(ev.pointerId); if (!p) return;
    const r = svg.getBoundingClientRect();
    const dxu = ((ev.clientX - p.x) / r.width) * view.w, dyu = ((ev.clientY - p.y) / r.height) * view.h;
    // once it is clearly a drag, capture the pointer so the scroll is smooth; before that let a tap through to a pill
    if (!dragged && Math.abs(ev.clientX - p.x) + Math.abs(ev.clientY - p.y) > 4) { dragged = true; try { svg.setPointerCapture(ev.pointerId); } catch { /* fine */ } }
    if (!dragged) return;
    view.x -= dxu; view.y -= dyu; clampPos(); apply();
    down.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
  });
  const up = (ev: PointerEvent) => { down.delete(ev.pointerId); };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
  // a tap on the open map (not a pill) just closes any inspect card
  svg.addEventListener('click', () => { if (!dragged) closeInspect(); });
  // keep the scale right when the panel resizes
  new ResizeObserver(() => { fitScale(); applyScale(); clampPos(); apply(); }).observe(svg);

  // open framing: the full height (places big), scrolled to where she is; the width overflows and scrolls across
  const hereNode = now.nodes.find((n) => n.state === 'current');
  requestAnimationFrame(() => {
    fitScale();
    applyScale();
    if (hereNode) { const [hx, hy] = px(hereNode); view.x = Math.max(0, Math.min(W - view.w, hx - view.w / 2)); view.y = Math.max(0, Math.min(H - view.h, hy - view.h / 2)); }
    apply();
  });
}

/** A small card for a place she knows of but cannot reach yet: its name, and that she cannot go there. */
function showInspect(root: HTMLElement, node: CityNode): HTMLElement {
  const card = el('div', 'city-inspect', root);
  el('h3', '', card, node.label);
  el('p', '', card, 'Known, but she cannot get there yet.');
  button('close', 'Close', card, () => card.remove()).innerHTML = icon('close', 16);
  return card;
}
