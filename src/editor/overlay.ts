// The overlay: the scene's lights, hotspots, places, areas, walk and reflection lines drawn over it, to select and drag.

import { resolveLight } from '../engine/presets';
import { NH, NW } from '../engine/renderer';
import type { ViewText } from '../game/level';
import { refresh, syncEffects } from './files';
import { dom, ed, esc, layerParallax, LIMITS, onLayer, redraw, remember, snapshot, viewX, type Selection } from './state';

const css = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
const isSel = (s: Selection) => JSON.stringify(s) === JSON.stringify(ed.sel);
const text = (t: ViewText | undefined) => (t === undefined ? '' : typeof t === 'string' ? t : t.concierge);

export function drawOverlay(): void {
  const file = ed.file, luna = ed.luna, sel = ed.sel;
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
    const [x0, y, w, hh] = h.rect, x = onLayer(x0, h.parallax), s = isSel({ kind: 'hotspot', i });
    out.push(`<rect class="hot${h.go ? ' exit' : ''}${s ? ' sel' : ''}" x="${x}" y="${y}" width="${w}" height="${hh}" data-k="hotspot" data-i="${i}"><title>${esc(text(h.name))}${h.go ? ` → ${h.go.scene}` : ''}</title></rect>`);
    if (h.stand !== undefined) out.push(`<path class="stand${h.go ? ' exit' : ''}" d="M ${h.stand - 5} ${file.walk.y + 9} L ${h.stand + 5} ${file.walk.y + 9} L ${h.stand} ${file.walk.y + 2} Z"/>`);
    if (s) out.push(handle(x + w, y + hh, 'hotspot-resize', `data-i="${i}"`));
  });
  // places to arrive at
  for (const [id, sp] of Object.entries(file.spawns)) {
    const s = isSel({ kind: 'spawn', id }), y = file.walk.y, d = sp.facing;
    out.push(`<g class="spawn${s ? ' sel' : ''}" data-k="spawn" data-id="${esc(id)}"><line x1="${sp.x}" y1="${y}" x2="${sp.x}" y2="${y - 34}"/><path d="M ${sp.x} ${y - 34} L ${sp.x + 14 * d} ${y - 28} L ${sp.x} ${y - 22} Z"/><text x="${sp.x + 4 * d}" y="${y - 38}" text-anchor="${d > 0 ? 'start' : 'end'}">${esc(id)}</text><rect class="hit" x="${sp.x - 8}" y="${y - 40}" width="16" height="44"/></g>`);
  }
  // lights: a dot in their colour, each as it shines (with its preset); the selected one shows its reach and its cone.
  // A suggested one has a dashed ring until it is kept
  file.lights.forEach((placed, i) => {
    const s = isSel({ kind: 'light', i }), r0 = resolveLight(placed), l = { ...r0, x: onLayer(r0.x, r0.parallax) };
    if (s) {
      out.push(`<circle class="reach" cx="${l.x}" cy="${l.y}" r="${l.r}"/>`);
      if (l.cone) {
        const a = Math.atan2(l.cone[1], l.cone[0]), half = Math.acos(Math.max(-1, Math.min(1, l.cone[2]))), r = Math.min(l.r, 260);
        const p = (t: number) => `${l.x + Math.cos(t) * r} ${l.y + Math.sin(t) * r}`;
        out.push(`<path class="cone" d="M ${l.x} ${l.y} L ${p(a - half)} A ${r} ${r} 0 ${half > Math.PI / 2 ? 1 : 0} 1 ${p(a + half)} Z"/>`);
      }
    }
    const tags = [l.ar ? 'Concierge view only' : '', l.machine ? 'machine' : '', ['behind characters', 'among characters', 'in front of characters'][l.layer ?? 0]].filter(Boolean).join(', ');
    const name = placed.preset ? `${placed.preset} (preset)` : `Light ${i + 1}`;
    out.push(`<g class="light${s ? ' sel' : ''}${l.ar ? ' ar' : ''}${placed.suggested ? ' suggested' : ''}" data-k="light" data-i="${i}"><circle class="ring" cx="${l.x}" cy="${l.y}" r="9"/><circle cx="${l.x}" cy="${l.y}" r="5.5" fill="${css(l.c)}"/><title>${esc(name)}${placed.suggested ? ', suggested' : ''}: ${tags}</title></g>`);
  });
  // effects: steam and smoke, light shafts, blinking beacons, the drip curtain, and where movers run
  (file.steam ?? []).forEach((e, i) => {
    const s = isSel({ kind: 'steam', i }), top = e.y - e.height, half = Math.max(3, e.width), off = i >= LIMITS.steam ? ' off' : '';
    out.push(`<g class="fx steam${e.kind === 'smoke' ? ' smoke' : ''}${s ? ' sel' : ''}${off}" data-k="steam" data-i="${i}"><line x1="${e.x}" y1="${e.y}" x2="${e.x}" y2="${top}"/><line x1="${e.x - half}" y1="${top}" x2="${e.x + half}" y2="${top}"/><circle cx="${e.x}" cy="${e.y}" r="5"/><title>${e.kind === 'smoke' ? 'Smoke' : 'Steam'} ${i + 1}${off ? ': not drawn, at most 4' : ''}</title></g>`);
  });
  (file.godrays ?? []).forEach((g, i) => {
    const s = isSel({ kind: 'godray', i }), x = onLayer(g.x, g.parallax), off = i >= LIMITS.godrays ? ' off' : '';
    const rays = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => { const a = (k * Math.PI) / 4; return `M ${x + Math.cos(a) * 7} ${g.y + Math.sin(a) * 7} L ${x + Math.cos(a) * 12} ${g.y + Math.sin(a) * 12}`; }).join(' ');
    out.push(`<g class="fx godray${g.ar ? ' ar' : ''}${s ? ' sel' : ''}${off}" data-k="godray" data-i="${i}"><circle cx="${x}" cy="${g.y}" r="5"/><path d="${rays}"/><circle class="hit" cx="${x}" cy="${g.y}" r="13"/><title>Light shaft ${i + 1}${off ? ': not drawn, at most 4' : ''}</title></g>`);
  });
  (file.beacons ?? []).forEach((b, i) => {
    const s = isSel({ kind: 'beacon', i }), x = onLayer(b.x, b.parallax);
    out.push(`<g class="fx beacon${s ? ' sel' : ''}" data-k="beacon" data-i="${i}"><circle cx="${x}" cy="${b.y}" r="4"/><circle class="hit" cx="${x}" cy="${b.y}" r="9"/><title>Beacon ${i + 1}</title></g>`);
  });
  if (file.drips) {
    const d = file.drips, s = isSel({ kind: 'drips' });
    out.push(`<rect class="fx drips${s ? ' sel' : ''}" x="${d.x0}" y="${d.top}" width="${d.x1 - d.x0}" height="${d.bottom - d.top}" data-k="drips"><title>Drips from an edge</title></rect>`);
    if (s) out.push(handle(d.x1, d.bottom, 'drips-resize'));
  }
  (file.movers ?? []).forEach((m, i) => {
    const s = isSel({ kind: 'mover', i }), p = layerParallax(m.after), sp = ed.scene?.loaded.movers?.[i]?.sprite.def;
    const y = m.y ?? sp?.y ?? file.walk.y - 60, h = sp?.h ?? 20, x0 = onLayer(m.x0, p), x1 = onLayer(m.x1, p);
    out.push(`<g class="fx mover${s ? ' sel' : ''}" data-k="mover" data-i="${i}"><rect x="${x0}" y="${y}" width="${Math.max(1, x1 - x0)}" height="${h}"/><text x="${x0 + 4}" y="${y - 4}">${esc(m.asset)}</text><title>Mover: ${esc(m.asset)}, behind what is in front of ${esc(m.after)}</title></g>`);
    if (s) out.push(handle(x0, y + h / 2, 'mover-x0', `data-i="${i}"`), handle(x1, y + h / 2, 'mover-x1', `data-i="${i}"`));
  });
  // Luna, to judge the light on: drag her along the walk line
  if (luna.show) out.push(`<g class="luna" data-k="luna"><path d="M ${luna.x - 7} ${file.walk.y + 14} L ${luna.x} ${file.walk.y + 4} L ${luna.x + 7} ${file.walk.y + 14} Z"/><title>Luna, to judge the light on</title></g>`);
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
  else if (k === 'luna') orig = [ed.luna.x];
  else if (k === 'layer') { const l = file.layers[i], d = ed.scene!.loaded.sprites[i].def; orig = [l.x ?? d.x, l.y ?? d.y]; ref = { kind: 'layer', i }; }
  else if (k === 'steam') { const e = file.steam![i]; orig = [e.x, e.y]; ref = { kind: 'steam', i }; }
  else if (k === 'godray') { const g = file.godrays![i]; orig = [g.x, g.y]; ref = { kind: 'godray', i }; }
  else if (k === 'beacon') { const b = file.beacons![i]; orig = [b.x, b.y]; ref = { kind: 'beacon', i }; }
  else if (k === 'drips' || k === 'drips-resize') { const d = file.drips!; orig = [d.x0, d.x1, d.top, d.bottom]; ref = { kind: 'drips' }; }
  else if (k === 'mover' || k === 'mover-x0' || k === 'mover-x1') {
    const m = file.movers![i];
    orig = [m.x0, m.x1, m.y ?? ed.scene?.loaded.movers?.[i]?.sprite.def.y ?? 0];
    ref = { kind: 'mover', i };
  }
  if (ref) ed.sel = ref;
  else if (k.startsWith('walk') || k === 'mirror') ed.sel = { kind: 'scene' };
  drag = { k, start: at, orig, before: snapshot(), moved: false, ref };
  dom.overlay.setPointerCapture(e.pointerId);
  drawOverlay();
  redraw.side();
  e.preventDefault();
}

function move(e: PointerEvent): void {
  // Luna can follow the pointer along the walk line, to see how the lights fall on her as she walks
  if (!drag && ed.luna.track && ed.luna.show) {
    const [x] = toLevel(e), { x0, x1 } = ed.file.walk;
    ed.luna.x = Math.round(Math.max(x0, Math.min(x1, x)));
    drawOverlay();
    return;
  }
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
  else if (k === 'luna') ed.luna.x = o[0] + dx;
  else if (k === 'layer' && s?.kind === 'layer') {
    const l = file.layers[s.i];
    l.x = o[0] + dx;
    l.y = o[1] + dy;
    const d = ed.scene!.loaded.sprites[s.i].def;
    d.x = l.x;
    d.y = l.y;
  }
  else if (k === 'steam' && s?.kind === 'steam') { const e = file.steam![s.i]; e.x = o[0] + dx; e.y = o[1] + dy; }
  else if (k === 'godray' && s?.kind === 'godray') { const g = file.godrays![s.i]; g.x = o[0] + dx; g.y = o[1] + dy; }
  else if (k === 'beacon' && s?.kind === 'beacon') { const b = file.beacons![s.i]; b.x = o[0] + dx; b.y = o[1] + dy; }
  else if (k === 'drips') file.drips = { x0: o[0] + dx, x1: o[1] + dx, top: o[2] + dy, bottom: o[3] + dy };
  else if (k === 'drips-resize') file.drips = { x0: o[0], x1: Math.max(o[0] + 4, o[1] + dx), top: o[2], bottom: Math.max(o[2] + 4, o[3] + dy) };
  else if (s?.kind === 'mover') {
    const m = file.movers![s.i];
    // its height stays its sprite's until it is moved up or down
    if (k === 'mover') { m.x0 = o[0] + dx; m.x1 = o[1] + dx; if (dy || m.y !== undefined) m.y = o[2] + dy; }
    else if (k === 'mover-x0') m.x0 = Math.min(o[1] - 4, o[0] + dx);
    else if (k === 'mover-x1') m.x1 = Math.max(o[0] + 4, o[1] + dx);
  }
  if (k.startsWith('zone') || k.startsWith('walk') || k === 'mirror') refresh();
  else if (['steam', 'godray', 'beacon', 'drips', 'drips-resize'].includes(k)) syncEffects();
  else drawOverlay();
}

function end(): void {
  if (!drag) return;
  if (drag.moved && drag.k !== 'luna') remember(drag.before);
  drag = null;
  redraw.side();
}

export function bindOverlay(): void {
  dom.overlay.addEventListener('pointerdown', down);
  dom.overlay.addEventListener('pointermove', move);
  dom.overlay.addEventListener('pointerup', end);
  dom.overlay.addEventListener('pointercancel', end);
}
