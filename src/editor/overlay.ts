// The overlay: the scene's lights, hotspots, places, areas, walk and reflection lines drawn over it, to select and drag.

import { NH, NW } from '../engine/renderer';
import type { ViewText } from '../game/level';
import { refresh } from './files';
import { dom, ed, esc, redraw, remember, snapshot, viewX, type Selection } from './state';

const css = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(ed.sel);
const text = (t: ViewText | undefined) => (t === undefined ? '' : typeof t === 'string' ? t : t.concierge);

export function drawOverlay(): void {
  const file = ed.file, lux = ed.lux, sel = ed.sel;
  dom.overlay.setAttribute('viewBox', `${viewX()} 0 ${NW} ${NH}`);
  const W = file.size[0], out: string[] = [];
  const handle = (x: number, y: number, k: string, extra = '') => `<rect class="handle" x="${x - 4}" y="${y - 4}" width="8" height="8" data-k="${k}" ${extra}/>`;
  // areas of the other kind
  for (const set of ['inside', 'outside'] as const) (file.zones?.[set] ?? []).forEach(([x, y, w, h], i) => {
    const s = isSel({ kind: 'zone', set, i });
    out.push(`<rect class="zone zone-${set}${s ? ' sel' : ''}" x="${x}" y="${y}" width="${w}" height="${h}" data-k="zone" data-set="${set}" data-i="${i}"><title>${set === 'inside' ? 'Inside' : 'Outside'} area</title></rect>`);
    if (s) out.push(handle(x + w, y + h, 'zone-resize', `data-set="${set}" data-i="${i}"`));
  });
  // the reflection line and the walk line
  const my = file.mirror ?? file.walk.y - 8;
  out.push(`<line class="mirror" x1="0" y1="${my}" x2="${W}" y2="${my}" data-k="mirror"><title>Reflection line: wet ground mirrors around it</title></line>`);
  out.push(`<line class="walk" x1="${file.walk.x0}" y1="${file.walk.y}" x2="${file.walk.x1}" y2="${file.walk.y}" data-k="walk-y"><title>Walk line: where feet stand</title></line>`);
  out.push(`<circle class="walk-end" cx="${file.walk.x0}" cy="${file.walk.y}" r="5" data-k="walk-x0"/><circle class="walk-end" cx="${file.walk.x1}" cy="${file.walk.y}" r="5" data-k="walk-x1"/>`);
  // hotspots and exits
  file.hotspots.forEach((h, i) => {
    const [x, y, w, hh] = h.rect, s = isSel({ kind: 'hotspot', i });
    out.push(`<rect class="hot${h.go ? ' exit' : ''}${s ? ' sel' : ''}" x="${x}" y="${y}" width="${w}" height="${hh}" data-k="hotspot" data-i="${i}"><title>${esc(text(h.name))}${h.go ? ` → ${h.go.scene}` : ''}</title></rect>`);
    if (h.stand !== undefined) out.push(`<path class="stand${h.go ? ' exit' : ''}" d="M ${h.stand - 5} ${file.walk.y + 9} L ${h.stand + 5} ${file.walk.y + 9} L ${h.stand} ${file.walk.y + 2} Z"/>`);
    if (s) out.push(handle(x + w, y + hh, 'hotspot-resize', `data-i="${i}"`));
  });
  // places to arrive at
  for (const [id, sp] of Object.entries(file.spawns)) {
    const s = isSel({ kind: 'spawn', id }), y = file.walk.y, d = sp.facing;
    out.push(`<g class="spawn${s ? ' sel' : ''}" data-k="spawn" data-id="${esc(id)}"><line x1="${sp.x}" y1="${y}" x2="${sp.x}" y2="${y - 34}"/><path d="M ${sp.x} ${y - 34} L ${sp.x + 14 * d} ${y - 28} L ${sp.x} ${y - 22} Z"/><text x="${sp.x + 4 * d}" y="${y - 38}" text-anchor="${d > 0 ? 'start' : 'end'}">${esc(id)}</text><rect class="hit" x="${sp.x - 8}" y="${y - 40}" width="16" height="44"/></g>`);
  }
  // lights: a dot in their colour; the selected one shows its reach and its cone
  file.lights.forEach((l, i) => {
    const s = isSel({ kind: 'light', i });
    if (s) {
      out.push(`<circle class="reach" cx="${l.x}" cy="${l.y}" r="${l.r}"/>`);
      if (l.cone) {
        const a = Math.atan2(l.cone[1], l.cone[0]), half = Math.acos(Math.max(-1, Math.min(1, l.cone[2]))), r = Math.min(l.r, 260);
        const p = (t: number) => `${l.x + Math.cos(t) * r} ${l.y + Math.sin(t) * r}`;
        out.push(`<path class="cone" d="M ${l.x} ${l.y} L ${p(a - half)} A ${r} ${r} 0 ${half > Math.PI / 2 ? 1 : 0} 1 ${p(a + half)} Z"/>`);
      }
    }
    const tags = [l.ar ? 'Concierge view only' : '', l.machine ? 'machine' : '', ['behind characters', 'among characters', 'in front of characters'][l.layer ?? 0]].filter(Boolean).join(', ');
    out.push(`<g class="light${s ? ' sel' : ''}${l.ar ? ' ar' : ''}" data-k="light" data-i="${i}"><circle class="ring" cx="${l.x}" cy="${l.y}" r="9"/><circle cx="${l.x}" cy="${l.y}" r="5.5" fill="${css(l.c)}"/><title>Light ${i + 1}: ${tags}</title></g>`);
  });
  // Lux, to judge the light on: drag her along the walk line
  if (lux.show) out.push(`<g class="lux" data-k="lux"><path d="M ${lux.x - 7} ${file.walk.y + 14} L ${lux.x} ${file.walk.y + 4} L ${lux.x + 7} ${file.walk.y + 14} Z"/><title>Lux, to judge the light on</title></g>`);
  // the selected layer's outline
  if (sel.kind === 'layer' && ed.scene) {
    const d = ed.scene.loaded.sprites[sel.i]?.def;
    if (d) out.push(`<rect class="layer-box" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" data-k="layer" data-i="${sel.i}"/>`);
  }
  dom.overlay.innerHTML = out.join('');
}

/* ---------- dragging ---------- */

let drag: { k: string; start: [number, number]; orig: number[]; before: string; moved: boolean; ref: Selection | null } | null = null;

const toLevel = (e: PointerEvent): [number, number] => {
  const pt = dom.overlay.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const p = pt.matrixTransform(dom.overlay.getScreenCTM()!.inverse());
  return [p.x, p.y];
};

/** Pressing on something selects it and starts dragging it; pressing on nothing selects the scene. */
function down(e: PointerEvent): void {
  const file = ed.file, target = (e.target as Element).closest('[data-k]') as SVGElement | null, at = toLevel(e);
  if (!target) { ed.sel = { kind: 'scene' }; drawOverlay(); redraw.side(); return; }
  const k = target.dataset.k!, i = Number(target.dataset.i), set = target.dataset.set as 'inside' | 'outside' | undefined, id = target.dataset.id;
  let orig: number[] = [], ref: Selection | null = null;
  if (k === 'light') { const l = file.lights[i]; orig = [l.x, l.y]; ref = { kind: 'light', i }; }
  else if (k === 'hotspot' || k === 'hotspot-resize') { orig = [...file.hotspots[i].rect]; ref = { kind: 'hotspot', i }; }
  else if (k === 'zone' || k === 'zone-resize') { orig = [...file.zones![set!]![i]]; ref = { kind: 'zone', set: set!, i }; }
  else if (k === 'spawn') { orig = [file.spawns[id!].x]; ref = { kind: 'spawn', id: id! }; }
  else if (k === 'walk-x0') orig = [file.walk.x0];
  else if (k === 'walk-x1') orig = [file.walk.x1];
  else if (k === 'walk-y') orig = [file.walk.y];
  else if (k === 'mirror') orig = [file.mirror ?? file.walk.y - 8];
  else if (k === 'lux') orig = [ed.lux.x];
  else if (k === 'layer') { const l = file.layers[i], d = ed.scene!.loaded.sprites[i].def; orig = [l.x ?? d.x, l.y ?? d.y]; ref = { kind: 'layer', i }; }
  if (ref) ed.sel = ref;
  else if (k.startsWith('walk') || k === 'mirror') ed.sel = { kind: 'scene' };
  drag = { k, start: at, orig, before: snapshot(), moved: false, ref };
  dom.overlay.setPointerCapture(e.pointerId);
  drawOverlay();
  redraw.side();
  e.preventDefault();
}

function move(e: PointerEvent): void {
  if (!drag) return;
  const file = ed.file, [x, y] = toLevel(e), dx = Math.round(x - drag.start[0]), dy = Math.round(y - drag.start[1]), o = drag.orig, s = drag.ref;
  if (!dx && !dy && !drag.moved) return;
  drag.moved = true;
  const k = drag.k;
  if (k === 'light' && s?.kind === 'light') { file.lights[s.i].x = o[0] + dx; file.lights[s.i].y = o[1] + dy; }
  else if (k === 'hotspot' && s?.kind === 'hotspot') file.hotspots[s.i].rect = [o[0] + dx, o[1] + dy, o[2], o[3]];
  else if (k === 'hotspot-resize' && s?.kind === 'hotspot') file.hotspots[s.i].rect = [o[0], o[1], Math.max(4, o[2] + dx), Math.max(4, o[3] + dy)];
  else if (k === 'zone' && s?.kind === 'zone') file.zones![s.set]![s.i] = [o[0] + dx, o[1] + dy, o[2], o[3]];
  else if (k === 'zone-resize' && s?.kind === 'zone') file.zones![s.set]![s.i] = [o[0], o[1], Math.max(4, o[2] + dx), Math.max(4, o[3] + dy)];
  else if (k === 'spawn' && s?.kind === 'spawn') file.spawns[s.id].x = o[0] + dx;
  else if (k === 'walk-x0') file.walk.x0 = o[0] + dx;
  else if (k === 'walk-x1') file.walk.x1 = o[0] + dx;
  else if (k === 'walk-y') file.walk.y = o[0] + dy;
  else if (k === 'mirror') file.mirror = o[0] + dy;
  else if (k === 'lux') ed.lux.x = o[0] + dx;
  else if (k === 'layer' && s?.kind === 'layer') {
    const l = file.layers[s.i];
    l.x = o[0] + dx;
    l.y = o[1] + dy;
    const d = ed.scene!.loaded.sprites[s.i].def;
    d.x = l.x;
    d.y = l.y;
  }
  if (k.startsWith('zone') || k.startsWith('walk') || k === 'mirror') refresh();
  else drawOverlay();
}

function end(): void {
  if (!drag) return;
  if (drag.moved && drag.k !== 'lux') remember(drag.before);
  drag = null;
  redraw.side();
}

export function bindOverlay(): void {
  dom.overlay.addEventListener('pointerdown', down);
  dom.overlay.addEventListener('pointermove', move);
  dom.overlay.addEventListener('pointerup', end);
  dom.overlay.addEventListener('pointercancel', end);
}
