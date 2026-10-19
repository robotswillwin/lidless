// The side panel: the fields of what is selected, one panel for each kind of thing, and the scene's own when nothing is.

import { NW } from '../engine/renderer';
import { loadSceneFile, type Rect } from '../game/scenefile';
import { deleteSelected, pickAsset } from './edit';
import { rebuild, refresh, syncEffects, syncScroll, updatePlay } from './files';
import { buttons, check, choice, colour, heading, labelFields, num, str, viewText } from './form';
import { base, dom, ed, LIMITS, redraw, remember, snapshot } from './state';

const GROUPS: [string, string][] = [['0', 'Steady'], ['1', 'Monitor flicker'], ['2', 'Valves'], ['3', 'Fire'], ['4', 'The machine’s eye'], ['5', 'Neon flicker'], ['6', 'Hologram'], ['7', 'Screen'], ['8', 'String lights']];
const ZONES: [string, string][] = [['0', 'Everywhere'], ['1', 'Inside areas'], ['2', 'Outside, near layer'], ['4', 'Outside, every depth'], ['3', 'Facade']];

const side = (...nodes: Node[]) => dom.side.append(...nodes);
const reselect = () => { redraw.overlay(); drawSide(); };

function lightSide(i: number): void {
  const file = ed.file, l = file.lights[i], deg = (r: number) => Math.round((r * 180) / Math.PI);
  side(heading(`Light ${i + 1}`, 'Drag the dot to move it. Height is how far in front of the wall it hangs: low lights graze, high ones light flat.'));
  side(
    num('x', l.x, (v) => { l.x = v; }), num('y', l.y, (v) => { l.y = v; }),
    num('Height', l.z, (v) => { l.z = v; }, { min: 0, max: 400 }), num('Reach', l.r, (v) => { l.r = v; }, { min: 10, max: 2000, step: 10 }),
    colour('Colour', l.c, (v) => { l.c = v; }), num('Strength', l.i, (v) => { l.i = v; }, { step: 0.05, min: 0, max: 12 }),
    num('Wrap (soft)', l.wrap ?? 0.3, (v) => { l.wrap = v; }, { step: 0.05, min: 0, max: 1 }), num('Haze in the air', l.haze ?? 0, (v) => { l.haze = v; }, { step: 0.05, min: 0, max: 3 }),
    check('Casts shadows', !!l.shadow, (v) => { if (v) l.shadow = 1; else delete l.shadow; }),
    choice('Against characters', String(l.layer ?? 0), [['0', 'Behind them (part of the set)'], ['1', 'Among them (in the street)'], ['2', 'In front of them']], (v) => { l.layer = Number(v); }),
    choice('Lights', String(l.zone), ZONES, (v) => { l.zone = Number(v); }),
    check('Concierge view only', !!l.ar, (v) => { if (v) l.ar = 1; else delete l.ar; }),
    check('A machine’s light (keeps its colour in raw view)', !!l.machine, (v) => { if (v) l.machine = 1; else delete l.machine; }),
    choice('Flicker', String(l.g ?? 0), GROUPS, (v) => { const g = Number(v); if (g) l.g = g; else delete l.g; }),
    check('Cone', !!l.cone, (v) => { if (v) l.cone = [0, 1, 0.4]; else delete l.cone; drawSide(); }),
  );
  if (l.cone) {
    const cone = l.cone;
    side(
      num('Cone direction (90 = down)', deg(Math.atan2(cone[1], cone[0])), (v) => { const a = (v * Math.PI) / 180; cone[0] = +Math.cos(a).toFixed(3); cone[1] = +Math.sin(a).toFixed(3); }, { min: -180, max: 360 }),
      num('Cone half-angle', deg(Math.acos(Math.max(-1, Math.min(1, cone[2])))), (v) => { cone[2] = +Math.cos((Math.min(179, Math.max(1, v)) * Math.PI) / 180).toFixed(3); }, { min: 1, max: 179 }),
    );
  }
  side(buttons(
    ['Duplicate', () => { const before = snapshot(); file.lights.push({ ...structuredClone(l), x: l.x + 20, y: l.y + 20 }); ed.sel = { kind: 'light', i: file.lights.length - 1 }; remember(before); reselect(); }],
    ['Delete', () => deleteSelected(), 'danger'],
  ));
}

function hotspotSide(i: number): void {
  const h = ed.file.hotspots[i], sceneIds = ed.world.scenes;
  side(heading(h.go ? 'Exit' : 'Hotspot', h.go ? 'Using it goes to another scene. Put one over an end of the walk line to leave by walking into it.' : 'Drag to move, the corner to resize. Stand is where Lux walks to before using it.'));
  side(str('Id', h.id, (v) => { h.id = v; }));
  side(...viewText('Name', h.name, (v) => { h.name = v ?? ''; }));
  const [x, y, w, hh] = h.rect;
  side(
    num('x', x, (v) => { h.rect[0] = v; }), num('y', y, (v) => { h.rect[1] = v; }), num('Width', w, (v) => { h.rect[2] = v; }, { min: 4 }), num('Height', hh, (v) => { h.rect[3] = v; }, { min: 4 }),
    str('Stand (x, empty: no walking)', h.stand === undefined ? '' : String(h.stand), (v) => { const n = Number(v); if (v.trim() === '' || !Number.isFinite(n)) delete h.stand; else h.stand = n; }),
    choice('Faces', String(h.face ?? 0), [['0', 'Towards it'], ['1', 'Right'], ['-1', 'Left']], (v) => { const n = Number(v); if (n) h.face = n as 1 | -1; else delete h.face; }),
    choice('There in', h.only ?? 'both', [['both', 'Both views'], ['concierge', 'Concierge view only'], ['raw', 'Raw view only']], (v) => { if (v === 'both') delete h.only; else h.only = v as 'raw' | 'concierge'; }),
  );
  // under its name on hover: the Concierge's classification, or her own note in raw view; and its answer when she asks it
  side(...labelFields(h.tag, (v) => { if (v === undefined) delete h.tag; else h.tag = v; }));
  side(str('The Concierge’s answer to Ask', h.ask ?? '', (v) => { if (v) h.ask = v; else delete h.ask; }, { area: true }));
  if (h.go) {
    const go = h.go;
    side(
      choice('Leads to', go.scene, sceneIds.map((s) => [s, s] as [string, string]), (v) => { go.scene = v; drawSide(); }),
      str('Arriving at (a spawn there)', go.spawn, (v) => { go.spawn = v; }, { list: spawnsOf(go.scene) }),
    );
  } else {
    side(...viewText('Look text', h.look, (v) => { if (v === undefined) delete h.look; else h.look = v; }, true));
    side(str('Conversation (Ink knot)', h.talk ?? '', (v) => { if (v) h.talk = v; else delete h.talk; }));
  }
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

/** The places to arrive at in another scene, for an exit's list; loaded the first time they are asked for. */
const spawnCache = new Map<string, string[]>();
function spawnsOf(id: string): string[] {
  if (id === ed.file.id) return Object.keys(ed.file.spawns);
  if (!spawnCache.has(id)) {
    spawnCache.set(id, []);
    void loadSceneFile(base, id).then((f) => { spawnCache.set(id, Object.keys(f.spawns)); if (ed.sel.kind === 'hotspot') drawSide(); }).catch(() => {});
  }
  return spawnCache.get(id)!;
}

function spawnSide(id: string): void {
  const file = ed.file, sp = file.spawns[id];
  side(heading(`Spawn: ${id}`, 'A place to arrive at, on the walk line. Exits in other scenes name it. The first one is where Play starts.'));
  side(
    str('Name', id, (v) => {
      const name = v.trim();
      if (!name || name === id || file.spawns[name]) return;
      file.spawns = Object.fromEntries(Object.entries(file.spawns).map(([k, s]) => [k === id ? name : k, s]));
      ed.sel = { kind: 'spawn', id: name };
      redraw.overlay();
      updatePlay();
    }),
    num('x', sp.x, (v) => { sp.x = v; }),
    choice('Facing', String(sp.facing), [['1', 'Right'], ['-1', 'Left']], (v) => { sp.facing = Number(v) as 1 | -1; }),
  );
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function zoneSide(set: 'inside' | 'outside', i: number): void {
  const file = ed.file, r = file.zones![set]![i];
  side(heading(set === 'inside' ? 'Inside area' : 'Outside area', file.kind === 'exterior' ? 'In a street, an inside area is a room seen through a window or an open front: inside ambient, no rain.' : 'In a room, an outside area is a window or a door to the street: cold ambient, rain in raw view.'));
  if (file.zoneMap) side(heading('', `This scene uses a painted zone map (${file.zoneMap}); areas have no effect until it is removed.`));
  side(
    choice('Kind', set, [['inside', 'Inside'], ['outside', 'Outside']], (v) => {
      if (v === set) return;
      file.zones![set]!.splice(i, 1);
      ((file.zones![v as 'inside' | 'outside'] ??= []) as Rect[]).push(r);
      ed.sel = { kind: 'zone', set: v as 'inside' | 'outside', i: file.zones![v as 'inside' | 'outside']!.length - 1 };
      refresh();
      drawSide();
    }, refresh),
    num('x', r[0], (v) => { r[0] = v; }, { after: refresh }), num('y', r[1], (v) => { r[1] = v; }, { after: refresh }),
    num('Width', r[2], (v) => { r[2] = v; }, { min: 4, after: refresh }), num('Height', r[3], (v) => { r[3] = v; }, { min: 4, after: refresh }),
  );
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function layerSide(i: number): void {
  const file = ed.file, l = file.layers[i], d = ed.scene?.loaded.sprites[i]?.def;
  side(heading(`Layer ${i + 1}: ${l.asset}`, 'Drag its outline to move it. Layers draw back to front.'));
  const place = () => { if (d) { d.x = l.x ?? d.x; d.y = l.y ?? d.y; d.parallax = l.parallax ?? d.parallax; d.depth = l.depth ?? d.depth; } redraw.overlay(); };
  side(
    num('x', l.x ?? d?.x ?? 0, (v) => { l.x = v; }, { after: place }), num('y', l.y ?? d?.y ?? 0, (v) => { l.y = v; }, { after: place }),
    num('Parallax (1 moves with the street)', l.parallax ?? d?.parallax ?? 1, (v) => { l.parallax = v; }, { step: 0.05, min: 0, max: 2, after: place }),
    check('In front of the people', l.front ?? d?.front ?? false, (v) => { if (v) l.front = true; else delete l.front; if (d) d.front = v; }),
    choice('Depth', String(l.depth ?? d?.depth ?? 3), [['0', 'Sky'], ['1', 'Far'], ['2', 'Middle'], ['3', 'Near']], (v) => { l.depth = Number(v); }, place),
  );
  const move = (to: number) => {
    if (to < 0 || to >= file.layers.length) return;
    const before = snapshot(), [m] = file.layers.splice(i, 1);
    file.layers.splice(to, 0, m);
    ed.sel = { kind: 'layer', i: to };
    remember(before);
    void rebuild().then(reselect);
  };
  side(buttons(['Further back', () => move(i - 1)], ['Further forward', () => move(i + 1)], ['Delete', () => deleteSelected(), 'danger']));
}

/* ---------- effects ---------- */

const SHAFT_ZONES: [string, string][] = [['0', 'Everywhere'], ['1', 'Inside areas'], ['2', 'Outside']];

function steamSide(i: number): void {
  const e = ed.file.steam![i];
  side(heading(e.kind === 'smoke' ? `Smoke ${i + 1}` : `Steam ${i + 1}`, `Rising from the dot. The first smoke follows Lux’s cigarette when she smokes. At most ${LIMITS.steam} are drawn.`));
  side(
    choice('Kind', e.kind, [['steam', 'Steam: broad, slow, pale'], ['smoke', 'Smoke: thin, drifting']], (v) => { e.kind = v as 'steam' | 'smoke'; }, syncEffects),
    num('x', e.x, (v) => { e.x = v; }, { after: syncEffects }), num('y (where it starts)', e.y, (v) => { e.y = v; }, { after: syncEffects }),
    num('Height it rises', e.height, (v) => { e.height = v; }, { min: 4, max: 400, after: syncEffects }),
    num('Width', e.width, (v) => { e.width = v; }, { min: 1, max: 60, after: syncEffects }),
  );
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function godraySide(i: number): void {
  const g = ed.file.godrays![i];
  side(heading(`Light shaft ${i + 1}`, `Rays of light through the haze from a lamp, a window or a sign. At most ${LIMITS.godrays} are drawn.`));
  side(
    num('x', g.x, (v) => { g.x = v; }, { after: syncEffects }), num('y', g.y, (v) => { g.y = v; }, { after: syncEffects }),
    num('Strength', g.strength, (v) => { g.strength = v; }, { step: 0.01, min: 0, max: 1, after: syncEffects }),
    choice('Shines in', String(g.zone), SHAFT_ZONES, (v) => { g.zone = Number(v); }, syncEffects),
    check('Concierge view only', !!g.ar, (v) => { if (v) g.ar = 1; else delete g.ar; }, syncEffects),
    num('Parallax (on a far layer: its parallax)', g.parallax ?? 1, (v) => { if (v === 1) delete g.parallax; else g.parallax = v; }, { step: 0.05, min: 0, max: 2, after: syncEffects }),
  );
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function beaconSide(i: number): void {
  const b = ed.file.beacons![i];
  side(heading(`Beacon ${i + 1}`, 'A red warning light on a tower or a mast, blinking in its own rhythm.'));
  side(
    num('x', b.x, (v) => { b.x = v; }, { after: syncEffects }), num('y', b.y, (v) => { b.y = v; }, { after: syncEffects }),
    num('Phase (when it blinks)', b.phase, (v) => { b.phase = v; }, { step: 0.1, min: 0, max: 6.3, after: syncEffects }),
    num('Parallax (on a far layer: its parallax)', b.parallax ?? 1, (v) => { if (v === 1) delete b.parallax; else b.parallax = v; }, { step: 0.05, min: 0, max: 2, after: syncEffects }),
  );
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function dripsSide(): void {
  const d = ed.file.drips!;
  side(heading('Drips', 'Rain dripping off an edge, an awning or a balcony, in raw view: from the top of the box to its bottom.'));
  side(
    num('From x', d.x0, (v) => { d.x0 = v; }, { after: syncEffects }), num('To x', d.x1, (v) => { d.x1 = v; }, { after: syncEffects }),
    num('Top', d.top, (v) => { d.top = v; }, { after: syncEffects }), num('Bottom', d.bottom, (v) => { d.bottom = v; }, { after: syncEffects }),
  );
  side(buttons(['Delete', () => deleteSelected(), 'danger']));
}

function moverSide(i: number): void {
  const m = ed.file.movers![i], layers = ed.file.layers.map((l) => [l.asset, l.asset] as [string, string]);
  side(heading(`Mover: ${m.asset}`, 'Something that passes through the scene on its own, such as a train, a car or a drone: drawn after its layer, so nearer layers cover it, and seen only between its ends. Drag its band, or its ends.'));
  const reload = () => { void rebuild().then(() => { redraw.overlay(); drawSide(); }); };
  side(
    choice('Drawn after the layer', m.after, layers, (v) => { m.after = v; }, reload),
    num('From x (in that layer)', m.x0, (v) => { m.x0 = v; }), num('To x', m.x1, (v) => { m.x1 = v; }),
    str('y (empty: as built)', m.y === undefined ? '' : String(m.y), (v) => { const n = Number(v); if (v.trim() === '' || !Number.isFinite(n)) delete m.y; else m.y = n; }),
    num('Speed, px a second', m.speed, (v) => { m.speed = Math.max(1, v); }, { min: 1, max: 2000 }),
    num('Wait between passes: shortest, s', m.wait[0], (v) => { m.wait[0] = Math.max(0, v); }, { step: 0.5, min: 0 }),
    num('Longest, s', m.wait[1], (v) => { m.wait[1] = Math.max(m.wait[0], v); }, { step: 0.5, min: 0 }),
    choice('Direction', String(m.dir ?? 0), [['0', 'Each way in turn'], ['1', 'Always to the right'], ['-1', 'Always to the left']], (v) => { const n = Number(v); if (n) m.dir = n as 1 | -1; else delete m.dir; }),
  );
  side(buttons(
    ['Another asset', async () => { const a = await pickAsset('The mover’s asset'); if (!a) return drawSide(); const before = snapshot(); m.asset = a; remember(before); reload(); }],
    ['Delete', () => deleteSelected(), 'danger'],
  ));
}

/** Every effect in the scene, to select one that is hard to click. */
function effectsList(): HTMLDivElement {
  const f = ed.file, list = document.createElement('div');
  list.className = 'ed-list';
  const item = (label: string, sel: typeof ed.sel) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => { ed.sel = sel; reselect(); }); list.append(b); };
  (f.steam ?? []).forEach((e, i) => item(`${e.kind === 'smoke' ? 'Smoke' : 'Steam'} ${i + 1}`, { kind: 'steam', i }));
  (f.godrays ?? []).forEach((_, i) => item(`Light shaft ${i + 1}`, { kind: 'godray', i }));
  (f.beacons ?? []).forEach((_, i) => item(`Beacon ${i + 1}`, { kind: 'beacon', i }));
  if (f.drips) item('Drips', { kind: 'drips' });
  (f.movers ?? []).forEach((m, i) => item(`Mover: ${m.asset}`, { kind: 'mover', i }));
  return list;
}

function sceneSide(): void {
  const file = ed.file, lux = ed.lux;
  side(heading(file.name || file.id, `Scene ${file.id}: ${file.size[0]}×${file.size[1]} px. Click a light, hotspot, spawn or area to edit it.`));
  side(
    str('Name', file.name, (v) => { file.name = v; }),
    choice('Kind', file.kind, [['exterior', 'Exterior: outside, rain'], ['interior', 'Interior: inside']], (v) => { file.kind = v as 'exterior' | 'interior'; }, refresh),
    num('Width', file.size[0], (v) => { file.size[0] = Math.max(NW, v); syncScroll(); }, { min: NW, step: 16, after: refresh }),
    num('Walk line y', file.walk.y, (v) => { file.walk.y = v; }, { after: refresh }),
    num('Walk from x', file.walk.x0, (v) => { file.walk.x0 = v; }), num('Walk to x', file.walk.x1, (v) => { file.walk.x1 = v; }),
    num('Reflection line y', file.mirror ?? file.walk.y - 8, (v) => { file.mirror = v; }, { after: refresh }),
    num('People’s size (1 standard, under 1 further back)', file.actorScale ?? 1, (v) => { if (v === 1) delete file.actorScale; else file.actorScale = v; }, { step: 0.05, min: 0.3, max: 3, after: refresh }),
    num('Camera follows Lux, px each way (0 none; a scene no wider than the screen)', file.drift ?? 0, (v) => { if (v) file.drift = v; else delete file.drift; }, { step: 1, min: 0, max: 60 }),
    num('Light painted into the art (0 to 1)', typeof file.baked === 'number' ? file.baked : 0, (v) => { if (v) file.baked = v; else delete file.baked; }, { step: 0.05, min: 0, max: 1, after: refresh }),
    str('The Concierge’s greeting', file.greeting ?? '', (v) => { if (v) file.greeting = v; else delete file.greeting; }),
    str('Its answer to Ring for assistance', file.assist ?? '', (v) => { if (v) file.assist = v; else delete file.assist; }, { area: true }),
  );
  side(heading('Lux', 'Drag the triangle at her feet to move her.'));
  side(
    check('Show Lux', lux.show, (v) => { lux.show = v; }),
    check('Move the camera with her, as in the game', lux.follow, (v) => { lux.follow = v; }),
    choice('Lux faces', String(lux.facing), [['1', 'Right'], ['-1', 'Left']], (v) => { lux.facing = Number(v) as 1 | -1; }),
  );
  side(heading('Layers', 'Back to front. Click one to move it or change its depth.'));
  const list = document.createElement('div');
  list.className = 'ed-list';
  file.layers.forEach((l, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = `${i + 1}. ${l.asset}`; b.addEventListener('click', () => { ed.sel = { kind: 'layer', i }; reselect(); }); list.append(b); });
  side(list);
  side(heading('Lights', `${file.lights.length} lights. Dots on the scene; cyan rings are Concierge view only.`));
  side(heading('Effects', 'Steam, smoke, light shafts, beacons, drips and movers. Add them with + Effect.'), effectsList());
}

export function drawSide(): void {
  const file = ed.file, sel = ed.sel;
  dom.side.replaceChildren();
  if (sel.kind === 'light' && file.lights[sel.i]) lightSide(sel.i);
  else if (sel.kind === 'hotspot' && file.hotspots[sel.i]) hotspotSide(sel.i);
  else if (sel.kind === 'spawn' && file.spawns[sel.id]) spawnSide(sel.id);
  else if (sel.kind === 'zone' && file.zones?.[sel.set]?.[sel.i]) zoneSide(sel.set, sel.i);
  else if (sel.kind === 'layer' && file.layers[sel.i]) layerSide(sel.i);
  else if (sel.kind === 'steam' && file.steam?.[sel.i]) steamSide(sel.i);
  else if (sel.kind === 'godray' && file.godrays?.[sel.i]) godraySide(sel.i);
  else if (sel.kind === 'beacon' && file.beacons?.[sel.i]) beaconSide(sel.i);
  else if (sel.kind === 'drips' && file.drips) dripsSide();
  else if (sel.kind === 'mover' && file.movers?.[sel.i]) moverSide(sel.i);
  else { ed.sel = { kind: 'scene' }; sceneSide(); }
}
