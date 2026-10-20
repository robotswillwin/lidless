// The side panel: the fields of what is selected, one panel for each kind of thing, and the scene's own when nothing is.

import { NW } from '../engine/renderer';
import type { Rect } from '../game/scenefile';
import type { LightDef } from '../engine/assets';
import { presets, resolveLight } from '../engine/presets';
import { inView, placeIn, type Hotspot, type ViewText } from '../game/level';
import { asIn, inViewOf, type Only } from '../engine/assets';
import { duplicate } from './clipboard';
import { deleteSelected, pickAsset, settleSuggested, suggestFromArt } from './edit';
import { joinUp } from './exits';
import { joinedUp, joinOf, missingThere, nameOf as joinName } from './join';
import { rebuild, refresh, syncEffects, syncHero, syncScroll, updatePlay } from './files';
import { amount, buttons, check, choice, colour, eye, heading, labelFields, num, section, slider, str, viewText } from './form';
import { lintScene, type Problem } from './lint';
import { editView, hasOwn, markOwn, ownIn, sameInBoth, setFor, shownView, viewLabel } from './views';
import { dom, ed, inTask, LIMITS, redraw, remember, showError, snapshot, type Kind, type Selection } from './state';

const GROUPS: [string, string][] = [['0', 'Steady'], ['1', 'Monitor flicker'], ['2', 'Valves'], ['3', 'Fire'], ['4', 'The machine’s eye'], ['5', 'Neon flicker'], ['6', 'Hologram'], ['7', 'Screen'], ['8', 'String lights']];
const ZONES: [string, string][] = [['0', 'Everywhere'], ['1', 'Inside areas'], ['2', 'Outside, near layer'], ['4', 'Outside, every depth'], ['3', 'Facade']];

const side = (...nodes: Node[]) => dom.side.append(...nodes);
const reselect = () => { redraw.overlay(); drawSide(); };

const SHOWN: [string, string][] = [['both', 'Both views'], ['concierge', 'AR only (the Concierge’s view)'], ['raw', 'Raw view only']];

/** Which views a thing is in: both, or only one. The same in both views, whatever the mode. */
function shownIn(value: Only | undefined, set: (v: Only | undefined) => void, after?: () => void): HTMLLabelElement {
  return choice('Shown in', value ?? 'both', SHOWN, (v) => set(v === 'both' ? undefined : (v as Only)), after);
}

/** What the mode does to the changes in this panel, and, if the thing is not in the view on screen, where it is. */
function modeNote(here: boolean, also = ''): void {
  const only = editView(), shown = shownView();
  const where = here ? '' : `Not in ${shown === 'raw' ? 'raw view' : 'AR'}: it is in ${shown === 'raw' ? 'AR' : 'raw view'} only. `;
  const mode = only ? `${viewLabel(only) === 'AR' ? 'AR' : 'Raw'} mode: what you change is ${only === 'raw' ? 'raw view' : 'AR'}’s own; the other view keeps its own.` : 'Both: what you change becomes the same in both views.';
  const p = document.createElement('p');
  p.className = `ed-mode-note${here ? '' : ' away'}`;
  p.textContent = `${where}${mode}${also ? ` ${also}` : ''}`;
  side(p);
}

/** A copy of what is selected, a little to the right (Cmd+D). */
const DUPLICATE: [string, () => void] = ['Duplicate', () => void duplicate().catch(showError)];

/** An effect's buttons: back to as it is in both views, if it has its own settings in this one; and delete. */
function effectButtons(o: object, shown: Only): HTMLDivElement {
  return buttons(
    ...(hasOwn(o, shown) ? [[`Same in both views`, () => { const before = snapshot(); sameInBoth(o, shown); syncEffects(); remember(before); reselect(); }] as [string, () => void]] : []),
    DUPLICATE,
    ['Delete', () => deleteSelected(), 'danger'],
  );
}

function lightSide(i: number): void {
  const file = ed.file, l = file.lights[i], kinds = presets().lights, kind = l.preset ? kinds[l.preset] : undefined;
  const shown = shownView(), both = resolveLight(l), eff = resolveLight(l, shown), deg = (r: number) => Math.round((r * 180) / Math.PI);
  // a setting changed here is the light's own; the same as its preset's, it follows the preset again. Off is written out
  // where the preset has it on (0 for a flag, null for a cone); a flag that is off is otherwise left out
  const own = <K extends keyof LightDef>(k: K, v: LightDef[K] | undefined) => {
    const from = kind?.light[k], o = l as Record<string, unknown>, flag = ['ar', 'raw', 'machine', 'shadow', 'g'].includes(k);
    if (kind && JSON.stringify(v ?? null) === JSON.stringify(from ?? null)) delete o[k];
    else if (v === undefined) { if (kind && from !== undefined) o[k] = null; else delete o[k]; }
    else if (v === 0 && flag && !(kind && from)) delete o[k];
    else o[k] = v;
  };
  // a setting for the mode: in Raw or AR that view's own, in Both for both views (the light's own, over its preset)
  const set = <K extends keyof LightDef>(k: K, v: LightDef[K] | undefined) => setFor(l, k, v, { same: both[k], shared: (kk, vv) => own(kk as K, vv as LightDef[K] | undefined) });
  const m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(l, ...keys));
  const here = !(both.ar && shown === 'raw') && !(both.raw && shown === 'concierge');
  side(heading(kind ? kind.label : `Light ${i + 1}`, `${kind ? 'One of a kind: change the preset (public/assets/presets.json) to change every light of this kind; what you change here is this light’s own.' : 'A light of its own.'} Drag the dot to move it. Height is how far in front of the wall it hangs: low lights graze, high ones light flat.`));
  modeNote(here);
  if (l.suggested) side(heading('', 'Suggested from the art: keep it, move it, or discard it.'), buttons(['Keep', () => { const before = snapshot(); delete l.suggested; remember(before); reselect(); }], ['Discard', () => deleteSelected(), 'danger']));
  side(
    choice('Preset', l.preset ?? '', [['', 'None: its own settings'], ...Object.entries(kinds).map(([k, p]) => [k, p.label] as [string, string])], (v) => {
      const o = l as Record<string, unknown>;
      // taking a preset takes all of it; leaving one keeps how the light looks, as its own settings
      if (v) { for (const k of Object.keys(o)) if (!['x', 'y', 'parallax', 'suggested', 'views'].includes(k)) delete o[k]; l.preset = v; }
      else { const { views, ...flat } = resolveLight(l) as LightDef & { views?: unknown }; void views; Object.assign(o, flat); delete l.preset; }
      reselect();
    }),
    shownIn(both.ar ? 'concierge' : both.raw ? 'raw' : undefined, (v) => {
      own('ar', v === 'concierge' ? 1 : 0);
      own('raw', v === 'raw' ? 1 : 0);
      for (const vv of ['raw', 'concierge'] as const) { delete l.views?.[vv]?.ar; delete l.views?.[vv]?.raw; }
    }, reselect),
    m(num('x', eff.x, (v) => set('x', v)), 'x'), m(num('y', eff.y, (v) => set('y', v)), 'y'),
    m(slider('Height in front of the wall, px', eff.z, (v) => set('z', v), { min: 0, max: 300, step: 1 }), 'z'), m(slider('Reach, px', eff.r, (v) => set('r', v), { min: 20, max: 1200, step: 10 }), 'r'),
    m(colour('Colour', eff.c, (v) => set('c', v)), 'c'), m(slider('Strength', eff.i, (v) => set('i', v), { min: 0, max: 1, scale: amount(6) }), 'i'),
    m(slider('Wrap (soft)', eff.wrap ?? 0.3, (v) => set('wrap', v), { min: 0, max: 1 }), 'wrap'), m(slider('Haze in the air', eff.haze ?? 0, (v) => set('haze', v), { min: 0, max: 1, scale: amount(3) }), 'haze'),
    m(check('Casts shadows', !!eff.shadow, (v) => set('shadow', v ? 1 : 0)), 'shadow'),
    m(choice('Against characters', String(eff.layer ?? 0), [['0', 'Behind them (part of the set)'], ['1', 'Among them (in the street)'], ['2', 'In front of them']], (v) => set('layer', Number(v))), 'layer'),
    m(choice('Lights', String(eff.zone), ZONES, (v) => set('zone', Number(v))), 'zone'),
    check('A machine’s light (keeps its colour in raw view)', !!both.machine, (v) => own('machine', v ? 1 : 0)),
    m(choice('Flicker', String(eff.g ?? 0), GROUPS, (v) => set('g', Number(v))), 'g'),
    slider('Parallax (on a far layer: its parallax)', l.parallax ?? 1, (v) => { if (v === 1) delete l.parallax; else l.parallax = v; }, { min: 0, max: 2, step: 0.05, mark: 1 }),
    m(check('Cone', !!eff.cone, (v) => { set('cone', v ? (kind?.light.cone ?? [0, 1, 0.4]) : undefined); drawSide(); }), 'cone'),
  );
  if (eff.cone) {
    const cone: [number, number, number] = [...eff.cone];
    side(
      m(slider('Cone direction, degrees (90 down)', deg(Math.atan2(cone[1], cone[0])), (v) => { const a = (v * Math.PI) / 180; cone[0] = +Math.cos(a).toFixed(3); cone[1] = +Math.sin(a).toFixed(3); set('cone', [...cone]); }, { min: -180, max: 180, step: 1, mark: 90 }), 'cone'),
      m(slider('Cone half-angle, degrees', deg(Math.acos(Math.max(-1, Math.min(1, cone[2])))), (v) => { cone[2] = +Math.cos((Math.min(179, Math.max(1, v)) * Math.PI) / 180).toFixed(3); set('cone', [...cone]); }, { min: 1, max: 179, step: 1 }), 'cone'),
    );
  }
  const ownSettings = Object.keys(l).filter((k) => !['x', 'y', 'preset', 'parallax', 'suggested', 'views'].includes(k));
  side(buttons(
    ...(hasOwn(l, shown) ? [[`Same in both views`, () => { const before = snapshot(); sameInBoth(l, shown); remember(before); reselect(); }] as [string, () => void]] : []),
    ...(kind && ownSettings.length ? [['Back to the preset', () => { const before = snapshot(), o = l as Record<string, unknown>; for (const k of ownSettings) delete o[k]; remember(before); reselect(); }] as [string, () => void]] : []),
    DUPLICATE,
    ['Delete', () => deleteSelected(), 'danger'],
  ));
}

function hotspotSide(i: number): void {
  const h = ed.file.hotspots[i], sceneIds = ed.world.scenes, shown = shownView(), pl = placeIn(h, shown === 'raw'), r = [...pl.rect] as [number, number, number, number];
  // where it is, for the mode: in Raw or AR that view's own place, in Both its place in both
  const setPlace = (k: 'rect' | 'stand' | 'face', v: unknown) => setFor(h, k, v, { same: h[k] });
  const m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(h, ...keys));
  side(heading(h.go ? 'Exit' : 'Hotspot', h.go ? 'Using it goes to another scene. Put one over an end of the walk line to leave by walking into it.' : 'Drag to move, the corner to resize. Stand is where Luna walks to before using it.'));
  modeNote(inView(h, shown === 'raw'), 'Its texts have a field for each view.');
  side(str('Id', h.id, (v) => { h.id = v; }));
  side(...viewText('Name', h.name, (v) => { h.name = v ?? ''; }));
  side(
    shownIn(h.only, (v) => { if (v) h.only = v; else delete h.only; }, reselect),
    m(num('x', r[0], (v) => { r[0] = v; setPlace('rect', [...r]); }), 'rect'), m(num('y', r[1], (v) => { r[1] = v; setPlace('rect', [...r]); }), 'rect'),
    m(num('Width', r[2], (v) => { r[2] = Math.max(4, v); setPlace('rect', [...r]); }, { min: 4 }), 'rect'), m(num('Height', r[3], (v) => { r[3] = Math.max(4, v); setPlace('rect', [...r]); }, { min: 4 }), 'rect'),
    m(str('Stand (x, empty: no walking)', pl.stand === undefined ? '' : String(pl.stand), (v) => { const n = Number(v); setPlace('stand', v.trim() === '' || !Number.isFinite(n) ? undefined : n); }), 'stand'),
    m(choice('Faces', String(pl.face ?? 0), [['0', 'Towards it'], ['1', 'Right'], ['-1', 'Left']], (v) => { const n = Number(v); setPlace('face', n ? n : undefined); }), 'face'),
  );
  // under its name on hover: the Concierge's classification, or her own note in raw view; and its answer when she asks it
  side(...labelFields(h.tag, (v) => { if (v === undefined) delete h.tag; else h.tag = v; }));
  side(str('The Concierge’s answer to Ask', h.ask ?? '', (v) => { if (v) h.ask = v; else delete h.ask; }, { area: true }));
  if (h.go) {
    const go = h.go, join = document.createElement('div');
    join.className = 'ed-join';
    side(
      choice('Leads to', go.scene, sceneIds.map((s) => [s, s] as [string, string]), (v) => { go.scene = v; drawSide(); }),
      str('Arriving at (a spawn there)', go.spawn, (v) => { go.spawn = v; }, { list: spawnsOf(go.scene), after: () => { redraw.overlay(); wayBack(join, i); } }),
      join,
    );
    wayBack(join, i);
  } else {
    side(...viewText('Look text', h.look, (v) => { if (v === undefined) delete h.look; else h.look = v; }, true));
    side(check('Her wardrobe: Use picks what she wears', !!h.wardrobe, (v) => { if (v) h.wardrobe = true; else delete h.wardrobe; }));
    const outfits = ed.world.hero.outfits ?? {};
    if (Object.keys(outfits).length) side(choice('Using it, she changes into', h.wear ?? '', [['', 'Nothing: she stays as she is'], ...Object.entries(outfits).map(([k, o]) => [k, o.name] as [string, string])], (v) => { if (v) h.wear = v; else delete h.wear; }));
    side(str('Conversation (Ink knot)', h.talk ?? '', (v) => { if (v) h.talk = v; else delete h.talk; }));
    // what the Use and Take verbs do to it: without a text, they do nothing to it and it does not light up for them
    side(...viewText('Use text', h.use, (v) => { if (v === undefined) delete h.use; else h.use = v; }, true));
    side(...viewText('Take text', h.take, (v) => { if (v === undefined) delete h.take; else h.take = v; }, true));
  }
  side(buttons(
    ...(hasOwn(h, shown) ? [[`Same in both views`, () => { const before = snapshot(); sameInBoth(h, shown); remember(before); reselect(); }] as [string, () => void]] : []),
    DUPLICATE,
    ['Delete', () => deleteSelected(), 'danger'],
  ));
}

/**
 * An exit's way back: whether it arrives at a place in the scene it leads to, and whether that scene has a way back
 * arriving by it here; and a button to make what is missing.
 */
function wayBack(box: HTMLElement, i: number): void {
  const h = ed.file.hotspots[i], go = h.go!, there = ed.others[go.scene];
  box.replaceChildren();
  box.hidden = go.scene === ed.file.id;
  if (box.hidden) return;
  const line = (ok: boolean, text: string, cls = ok ? 'ok' : 'missing') => { const p = document.createElement('p'); p.className = cls; p.textContent = text; box.append(p); };
  if (!there) return line(false, `${go.scene} is not saved yet: save it to make the way back`);
  const j = joinOf(h, ed.file, there), them = there.name || there.id, back = j.back >= 0 ? there.hotspots[j.back] : undefined;
  line(j.exitNames && j.hasArrive, !j.exitNames ? 'Arrives nowhere yet' : j.hasArrive ? `Arrives at “${j.arrive}” in ${them}` : `${them} has no “${j.arrive}” yet`);
  line(!!back && j.backNames && j.hasBackTo, !back ? `No way back from ${them} yet` : `The way back, “${joinName(back.name)}”, ${!j.backNames ? 'arrives nowhere yet' : j.hasBackTo ? `arrives at “${j.backTo}” here` : `arrives at “${j.backTo}”, not made here yet`}`);
  if (joinedUp(j)) return;
  const far = missingThere(j);
  const label = far ? (j.back < 0 ? 'Make the way back' : !j.hasArrive ? `Make “${j.arrive}” in ${them}` : 'Finish the way back') : !j.hasBackTo ? `Make “${j.backTo}” here` : `Arrive at “${j.arrive}”`;
  box.append(buttons([label, () => void joinUp(i).catch(showError)]));
  if (far) line(true, `Saves this scene, then opens ${them} with what is missing there made, to place and save.`, 'hint');
}

/** The places to arrive at in another scene, for an exit's list: from the scenes the editor loaded. */
function spawnsOf(id: string): string[] {
  if (id === ed.file.id) return Object.keys(ed.file.spawns);
  return Object.keys(ed.others[id]?.spawns ?? {});
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
  side(buttons(DUPLICATE, ['Delete', () => deleteSelected(), 'danger']));
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
  side(buttons(DUPLICATE, ['Delete', () => deleteSelected(), 'danger']));
}

function layerSide(i: number): void {
  const file = ed.file, l = file.layers[i], d = ed.scene?.loaded.sprites[i]?.def, shown = shownView();
  const at = { x: l.views?.[shown]?.x ?? l.x ?? d?.x ?? 0, y: l.views?.[shown]?.y ?? l.y ?? d?.y ?? 0 };
  const m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(l, ...keys));
  side(heading(`Layer ${i + 1}: ${l.asset}`, 'Drag its outline to move it. Layers draw back to front.'));
  modeNote(!l.only || l.only === shown, 'Its parallax, depth and order are the same in both views.');
  const place = () => { if (d) { d.x = l.x ?? d.x; d.y = l.y ?? d.y; d.parallax = l.parallax ?? d.parallax; d.depth = l.depth ?? d.depth; d.views = l.views; d.only = l.only; } redraw.overlay(); };
  side(
    shownIn(l.only, (v) => { if (v) l.only = v; else delete l.only; }, place),
    m(num('x', at.x, (v) => setFor(l, 'x', v, { same: l.x ?? d?.x }), { after: place }), 'x'), m(num('y', at.y, (v) => setFor(l, 'y', v, { same: l.y ?? d?.y }), { after: place }), 'y'),
    slider('Parallax (1 moves with the street)', l.parallax ?? d?.parallax ?? 1, (v) => { l.parallax = v; }, { min: 0, max: 2, step: 0.05, mark: 1, after: place }),
    check('In front of the people', l.front ?? d?.front ?? false, (v) => { if (v) l.front = true; else delete l.front; if (d) d.front = v; }),
    choice('Depth', String(l.depth ?? d?.depth ?? 3), [['0', 'Sky'], ['1', 'Far'], ['2', 'Middle'], ['3', 'Near']], (v) => { l.depth = Number(v); }, place),
  );
  const move = (to: number) => {
    if (to < 0 || to >= file.layers.length) return;
    const before = snapshot(), [mv] = file.layers.splice(i, 1);
    file.layers.splice(to, 0, mv);
    ed.sel = { kind: 'layer', i: to };
    remember(before);
    void rebuild().then(reselect);
  };
  side(buttons(
    ...(hasOwn(l, shown) ? [[`Same in both views`, () => { const before = snapshot(); sameInBoth(l, shown); place(); remember(before); reselect(); }] as [string, () => void]] : []),
    ['Further back', () => move(i - 1)], ['Further forward', () => move(i + 1)], DUPLICATE, ['Delete', () => deleteSelected(), 'danger'],
  ));
}

/* ---------- effects ---------- */

const SHAFT_ZONES: [string, string][] = [['0', 'Everywhere'], ['1', 'Inside areas'], ['2', 'Outside']];

function steamSide(i: number): void {
  const e = ed.file.steam![i], shown = shownView(), v = asIn(e, shown), m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(e, ...keys));
  side(heading(e.kind === 'smoke' ? `Smoke ${i + 1}` : `Steam ${i + 1}`, `Rising from the dot. The first smoke follows Luna’s cigarette when she smokes. At most ${LIMITS.steam} are drawn in a view.`));
  modeNote(inViewOf(e.only, ed.view));
  side(
    shownIn(e.only, (o) => { if (o) e.only = o; else delete e.only; }, () => { syncEffects(); reselect(); }),
    choice('Kind', e.kind, [['steam', 'Steam: broad, slow, pale'], ['smoke', 'Smoke: thin, drifting']], (k) => { e.kind = k as 'steam' | 'smoke'; }, syncEffects),
    m(num('x', v.x, (n) => setFor(e, 'x', n), { after: syncEffects }), 'x'), m(num('y (where it starts)', v.y, (n) => setFor(e, 'y', n), { after: syncEffects }), 'y'),
    m(slider('Height it rises, px', v.height, (n) => setFor(e, 'height', n), { min: 4, max: 400, step: 1, after: syncEffects }), 'height'),
    m(slider('Width, px', v.width, (n) => setFor(e, 'width', n), { min: 1, max: 60, step: 1, after: syncEffects }), 'width'),
  );
  side(effectButtons(e, shown));
}

function godraySide(i: number): void {
  const g = ed.file.godrays![i], shown = shownView(), v = asIn(g, shown), m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(g, ...keys));
  const only = g.only ?? (g.ar ? 'concierge' : undefined);
  side(heading(`Light shaft ${i + 1}`, `Rays of light through the haze from a lamp, a window or a sign. At most ${LIMITS.godrays} are drawn.`));
  modeNote(inViewOf(only, ed.view));
  side(
    shownIn(only, (o) => { delete g.ar; if (o) g.only = o; else delete g.only; }, () => { syncEffects(); reselect(); }),
    m(num('x', v.x, (n) => setFor(g, 'x', n), { after: syncEffects }), 'x'), m(num('y', v.y, (n) => setFor(g, 'y', n), { after: syncEffects }), 'y'),
    m(slider('Strength', v.strength, (n) => setFor(g, 'strength', n), { min: 0, max: 1, after: syncEffects }), 'strength'),
    m(choice('Shines in', String(v.zone), SHAFT_ZONES, (z) => setFor(g, 'zone', Number(z)), syncEffects), 'zone'),
    slider('Parallax (on a far layer: its parallax)', g.parallax ?? 1, (n) => { if (n === 1) delete g.parallax; else g.parallax = n; }, { min: 0, max: 2, step: 0.05, mark: 1, after: syncEffects }),
  );
  side(effectButtons(g, shown));
}

function beaconSide(i: number): void {
  const b = ed.file.beacons![i], shown = shownView(), v = asIn(b, shown), m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(b, ...keys));
  side(heading(`Beacon ${i + 1}`, 'A red warning light on a tower or a mast, blinking in its own rhythm.'));
  modeNote(inViewOf(b.only, ed.view));
  side(
    shownIn(b.only, (o) => { if (o) b.only = o; else delete b.only; }, () => { syncEffects(); reselect(); }),
    m(num('x', v.x, (n) => setFor(b, 'x', n), { after: syncEffects }), 'x'), m(num('y', v.y, (n) => setFor(b, 'y', n), { after: syncEffects }), 'y'),
    m(slider('When in its rhythm it blinks (0 to 1)', v.phase, (n) => setFor(b, 'phase', n), { min: 0, max: 1, scale: { toUi: (p) => p / (2 * Math.PI), fromUi: (u) => +(u * 2 * Math.PI).toFixed(2) }, after: syncEffects }), 'phase'),
    slider('Parallax (on a far layer: its parallax)', b.parallax ?? 1, (n) => { if (n === 1) delete b.parallax; else b.parallax = n; }, { min: 0, max: 2, step: 0.05, mark: 1, after: syncEffects }),
  );
  side(effectButtons(b, shown));
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
  const mv = ed.file.movers![i], layers = ed.file.layers.map((l) => [l.asset, l.asset] as [string, string]), shown = shownView(), v = asIn(mv, shown);
  const m = (row: HTMLElement, ...keys: string[]) => markOwn(row, () => ownIn(mv, ...keys));
  side(heading(`Mover: ${mv.asset}`, 'Something that passes through the scene on its own, such as a train, a car or a drone: drawn after its layer, so nearer layers cover it, and seen only between its ends. Drag its band, or its ends.'));
  modeNote(inViewOf(mv.only, ed.view), 'Its asset and its layer are the same in both views.');
  const reload = () => { void rebuild().then(() => { redraw.overlay(); drawSide(); }); };
  side(
    shownIn(mv.only, (o) => { if (o) mv.only = o; else delete mv.only; }, reselect),
    choice('Drawn after the layer', mv.after, layers, (a) => { mv.after = a; }, reload),
    m(num('From x (in that layer)', v.x0, (n) => setFor(mv, 'x0', n)), 'x0'), m(num('To x', v.x1, (n) => setFor(mv, 'x1', n)), 'x1'),
    m(str('y (empty: as built)', v.y === undefined ? '' : String(v.y), (t) => { const n = Number(t); setFor(mv, 'y', t.trim() === '' || !Number.isFinite(n) ? undefined : n); }), 'y'),
    m(slider('Speed, px a second', v.speed, (n) => setFor(mv, 'speed', Math.max(1, n)), { min: 1, max: 800, step: 5 }), 'speed'),
    slider('Wait between passes: shortest, s', mv.wait[0], (n) => { mv.wait[0] = Math.max(0, n); }, { min: 0, max: 60, step: 0.5 }),
    slider('Longest, s', mv.wait[1], (n) => { mv.wait[1] = Math.max(mv.wait[0], n); }, { min: 0, max: 90, step: 0.5 }),
    m(choice('Direction', String(v.dir ?? 0), [['0', 'Each way in turn'], ['1', 'Always to the right'], ['-1', 'Always to the left']], (d) => { const n = Number(d); setFor(mv, 'dir', n ? n : undefined); }), 'dir'),
  );
  side(buttons(
    ...(hasOwn(mv, shown) ? [[`Same in both views`, () => { const before = snapshot(); sameInBoth(mv, shown); remember(before); reselect(); }] as [string, () => void]] : []),
    ['Another asset', async () => { const a = await pickAsset('The mover’s asset'); if (!a) return drawSide(); const before = snapshot(); mv.asset = a; remember(before); reload(); }],
    DUPLICATE,
    ['Delete', () => deleteSelected(), 'danger'],
  ));
}

const css = (c: [number, number, number]) => `rgb(${c.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
const named = (t: ViewText): string => (typeof t === 'string' ? t : t.concierge || t.raw);
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.append(e);
  return e;
}

/** What can be done with a hotspot. */
const uses = (h: Hotspot): string => [...(['look', 'talk', 'use', 'take'] as const).filter((k) => h[k]), ...(h.ask ? ['ask'] : [])].join(' · ') || 'nothing to do';

interface Row { label: string; detail?: string; dot?: string; sel: Selection; only?: Only }

const PARTS: [Only | undefined, string][] = [[undefined, 'Both views'], ['concierge', 'AR only'], ['raw', 'Raw only']];

/**
 * A row for each thing: selects it, and lights it on the scene while the pointer is over it. Where some are in one view
 * only, they are in parts of their own: in both views, AR only, raw only; the other view's, faint.
 */
function rows(parent: HTMLElement, items: Row[]): void {
  const split = items.some((it) => it.only);
  for (const [only, title] of PARTS) {
    const part = items.filter((it) => it.only === only);
    if (!part.length) continue;
    if (split) el('div', `ed-part${only ? ` ${only}` : ''}${only && only !== shownView() ? ' other' : ''}`, parent, title);
    rowList(parent, part, !!only && only !== shownView());
  }
}

function rowList(parent: HTMLElement, items: Row[], other: boolean): void {
  const list = el('div', `ed-rows${other ? ' other' : ''}`, parent);
  for (const it of items) {
    const b = el('button', 'ed-row', list);
    b.type = 'button';
    if (it.dot) el('span', 'dot', b).style.background = it.dot;
    el('span', 'label', b, it.label);
    if (it.detail) el('span', 'detail', b, it.detail);
    b.addEventListener('click', () => { ed.hover = null; ed.sel = it.sel; reselect(); });
    b.addEventListener('mouseenter', () => { ed.hover = it.sel; redraw.overlay(); });
    b.addEventListener('mouseleave', () => { ed.hover = null; redraw.overlay(); });
  }
}

/** Everything in the scene by kind, each kind with an eye to hide it on the scene and see the rest; in a task, its kinds. */
function outline(body: HTMLElement): void {
  const f = ed.file, task = ed.task;
  const group = (title: string, kind: Kind | null, items: Row[], opts: { note?: string; extra?: HTMLElement } = {}) => {
    // a task's own kinds only; layers belong to the layout
    if (task !== 'all' && (kind ? !inTask(kind) : task !== 'layout')) return;
    const g = el('div', 'ed-group', body), head = el('div', 'ed-group-head', g);
    el('span', 't', head, title);
    el('span', 'n', head, opts.note ?? (items.length ? String(items.length) : 'none'));
    if (kind) head.append(eye(kind, title.toLowerCase(), redraw.overlay));
    if (opts.extra) g.append(opts.extra);
    if (items.length) rows(g, items);
  };
  group('Layers, back to front', null, f.layers.map((l, i) => ({ label: `${i + 1}. ${l.asset}`, detail: [l.parallax !== undefined && l.parallax !== 1 ? `parallax ${l.parallax}` : '', l.front ? 'in front' : ''].filter(Boolean).join(' · '), sel: { kind: 'layer', i }, only: l.only })));
  const suggested = f.lights.filter((l) => l.suggested).length;
  const tools = buttons(['Suggest from the art', () => void suggestFromArt().then(reselect)], ...(suggested ? [[`Keep ${suggested}`, () => settleSuggested(true)], ['Discard them', () => settleSuggested(false), 'danger']] as [string, () => void, string?][] : []));
  group('Lights', 'lights', f.lights.map((placed, i) => {
    const l = resolveLight(placed, shownView()), kind = placed.preset ? presets().lights[placed.preset]?.label ?? placed.preset : `Light ${i + 1}`;
    const notes = [l.machine ? 'machine' : '', placed.suggested ? 'suggested' : '', placed.views ? 'set per view' : ''].filter(Boolean);
    return { label: kind, dot: css(l.c), detail: notes.join(' · '), sel: { kind: 'light', i } as Selection, only: l.ar ? 'concierge' : l.raw ? 'raw' : undefined };
  }), { extra: tools });
  const hot = f.hotspots.map((h, i) => ({ h, i }));
  group('Hotspots', 'hotspots', hot.filter(({ h }) => !h.go).map(({ h, i }) => ({ label: named(h.name) || h.id, detail: uses(h), sel: { kind: 'hotspot', i }, only: h.only })));
  group('Exits', 'exits', hot.filter(({ h }) => h.go).map(({ h, i }) => ({ label: named(h.name) || h.id, detail: `→ ${h.go!.scene}, ${h.go!.spawn}`, sel: { kind: 'hotspot', i }, only: h.only })));
  group('Places to arrive at', 'spawns', Object.entries(f.spawns).map(([id, sp]) => ({ label: id, detail: `x ${sp.x}, facing ${sp.facing > 0 ? 'right' : 'left'}`, sel: { kind: 'spawn', id } })));
  group('Areas', 'areas', (['inside', 'outside'] as const).flatMap((set) => (f.zones?.[set] ?? []).map((_, i) => ({ label: `${set === 'inside' ? 'Inside' : 'Outside'} ${i + 1}`, detail: f.kind === 'exterior' ? 'an inside in the street' : 'an outside in the room', sel: { kind: 'zone', set, i } as Selection }))));
  const fx: Row[] = [
    ...(f.steam ?? []).map((e, i) => ({ label: `${e.kind === 'smoke' ? 'Smoke' : 'Steam'} ${i + 1}`, detail: i >= LIMITS.steam ? 'not drawn' : '', sel: { kind: 'steam', i } as Selection, only: e.only })),
    ...(f.godrays ?? []).map((g, i) => ({ label: `Light shaft ${i + 1}`, detail: i >= LIMITS.godrays ? 'not drawn' : '', sel: { kind: 'godray', i } as Selection, only: g.only ?? (g.ar ? 'concierge' as const : undefined) })),
    ...(f.beacons ?? []).map((b, i) => ({ label: `Beacon ${i + 1}`, sel: { kind: 'beacon', i } as Selection, only: b.only })),
    // drips fall in raw view only: it rains only there
    ...(f.drips ? [{ label: 'Drips', sel: { kind: 'drips' } as Selection, only: 'raw' as const }] : []),
    ...(f.movers ?? []).map((m, i) => ({ label: `Mover: ${m.asset}`, sel: { kind: 'mover', i } as Selection, only: m.only })),
  ];
  group('Effects', 'effects', fx);
  group('Walk and reflection lines', 'lines', [], { note: `walk ${f.walk.x0} to ${f.walk.x1} at y ${f.walk.y} · reflection y ${f.mirror ?? f.walk.y - 8}` });
}

/** What is wrong with the scene, or will go wrong in play: each problem selects what it is about. */
function problems(body: HTMLElement, found: Problem[]): void {
  if (!found.length) {
    el('p', 'ed-note', body, 'None found. Checked: its layers, the walk line, hotspots and exits (both ways), places to arrive at, the story’s conversations, the phone’s corner buttons, and how many lights a phone draws.');
    return;
  }
  const list = el('div', 'ed-problems', body);
  for (const p of found) {
    const b = el('button', `ed-problem ${p.level}`, list);
    b.type = 'button';
    el('span', 'mark', b, p.level === 'error' ? '●' : '▲');
    el('span', 'text', b, p.text);
    if (p.sel) {
      const sel = p.sel;
      b.addEventListener('click', () => { ed.hover = null; ed.sel = sel; reselect(); });
      b.addEventListener('mouseenter', () => { ed.hover = sel; redraw.overlay(); });
      b.addEventListener('mouseleave', () => { ed.hover = null; redraw.overlay(); });
    } else b.disabled = true;
  }
}

/**
 * A scene setting that can differ between the views: its value in the view on screen. In Both mode a change sets it for
 * both views; in Raw or AR mode for that view only, and the file keeps one number while the views agree.
 */
function perView(label: string, key: 'ambient' | 'exposure' | 'baked', plain: number, opts: { step: number; min: number; max: number; mark?: number }): HTMLLabelElement {
  const file = ed.file, cur = () => file[key], valueIn = (v: Only) => { const c = cur(); return (typeof c === 'object' ? c?.[v] : c) ?? plain; };
  const row = slider(label, valueIn(shownView()), (x) => {
    const only = editView(), o = { raw: valueIn('raw'), concierge: valueIn('concierge') };
    if (only) o[only] = x; else o.raw = o.concierge = x;
    if (o.raw === o.concierge) { if (o.raw === plain) delete file[key]; else file[key] = o.raw; }
    else file[key] = o;
  }, { ...opts, after: refresh });
  const differ = valueIn('raw') !== valueIn('concierge');
  return markOwn(row, differ ? ['raw', 'concierge'] : []) as HTMLLabelElement;
}

/** The scene's panel, with nothing selected: what is wrong, everything in it, its settings, its ground, and Luna. */
function sceneSide(): void {
  const file = ed.file, luna = ed.luna;
  side(heading(file.name || file.id, `Scene ${file.id}: ${file.size[0]}×${file.size[1]} px. Click anything on it, or in the outline, to edit it.`));
  const found = lintScene(file, { scenes: ed.world.scenes, others: ed.others, knots: ed.knots, start: ed.world.start, assets: ed.assets.length ? new Set(ed.assets) : undefined });
  const errors = found.filter((p) => p.level === 'error').length;
  side(section('problems', 'Problems', (body) => problems(body, found), { badge: found.length ? String(found.length) : 'none', tone: errors ? 'error' : found.length ? 'warning' : 'ok' }));
  side(section('outline', 'Outline', outline));
  const space = () => [
    str('Name', file.name, (v) => { file.name = v; }),
    choice('Kind', file.kind, [['exterior', 'Exterior: outside, rain'], ['interior', 'Interior: inside']], (v) => { file.kind = v as 'exterior' | 'interior'; }, refresh),
    num('Width', file.size[0], (v) => { file.size[0] = Math.max(NW, v); syncScroll(); }, { min: NW, step: 16, after: refresh }),
    num('Walk line y', file.walk.y, (v) => { file.walk.y = v; }, { after: refresh }),
    num('Walk from x', file.walk.x0, (v) => { file.walk.x0 = v; }), num('Walk to x', file.walk.x1, (v) => { file.walk.x1 = v; }),
    num('Reflection line y', file.mirror ?? file.walk.y - 8, (v) => { file.mirror = v; }, { after: refresh }),
    slider('People’s size (1 standard, under 1 further back)', file.actorScale ?? 1, (v) => { if (v === 1) delete file.actorScale; else file.actorScale = v; }, { min: 0.3, max: 1.5, step: 0.01, mark: 1, after: refresh }),
    slider('Camera follows Luna, px each way (a scene no wider than the screen)', file.drift ?? 0, (v) => { if (v) file.drift = v; else delete file.drift; }, { min: 0, max: 60, step: 1 }),
    check('Her home: she takes her coat off here, and a hotspot can be her wardrobe', !!file.wardrobe, (v) => { if (v) file.wardrobe = true; else delete file.wardrobe; }, () => void syncHero().then(redraw.overlay)),
  ];
  const light = () => [
    perView('Ambient light (1 as standard)', 'ambient', 1, { step: 0.05, min: 0, max: 3, mark: 1 }),
    perView('Exposure, stops', 'exposure', 0, { step: 0.05, min: -2, max: 2, mark: 0 }),
    perView('Light painted into the art', 'baked', 0, { step: 0.01, min: 0, max: 1 }),
  ];
  const concierge = () => [
    str('The Concierge’s greeting', file.greeting ?? '', (v) => { if (v) file.greeting = v; else delete file.greeting; }),
    str('Its answer to Ring for assistance', file.assist ?? '', (v) => { if (v) file.assist = v; else delete file.assist; }, { area: true }),
  ];
  const task = ed.task;
  if (task === 'all') side(section('settings', 'Scene settings', (body) => body.append(...space(), ...light(), ...concierge())));
  if (task === 'layout') side(section('space', 'The scene', (body) => body.append(...space())));
  if (task === 'interaction') side(section('concierge', 'The Concierge here', (body) => body.append(...concierge())));
  if (task === 'lighting') side(section('light', 'The scene’s light', (body) => {
    el('p', 'ed-note', body, 'How bright the scene is in each view, and how much of its light is painted into the art. G shows only what the lights do.');
    body.append(...light());
  }));
  const g = file.ground, line = file.mirror ?? file.walk.y - 8;
  if (task === 'all' || task === 'layout') side(section('ground', 'Ground', (body) => {
    el('p', 'ed-note', body, 'Drawn by the engine below the reflection line, over a floor smoothed for it: paving slabs, a kerb, puddles. How wet, shiny and worn it is in each view is in the look panel, under Reflections.');
    body.append(check('The engine draws the ground', !!g, (v) => { if (v) file.ground = { horizon: line - 100, slab: [90, 70], puddles: 0.25 }; else delete file.ground; }, () => { refresh(); redraw.side(); }));
    if (g) body.append(
      slider('Horizon y: the eye’s height (nearer the line, flatter)', g.horizon, (v) => { g.horizon = Math.min(v, line - 8); }, { min: 0, max: line - 8, step: 2, after: refresh }),
      slider('Slab width, px (0: no slabs)', g.slab?.[0] ?? 0, (v) => { g.slab = [Math.max(0, v), g.slab?.[1] ?? v]; }, { min: 0, max: 200, step: 2, after: refresh }),
      slider('Slab depth, px', g.slab?.[1] ?? 0, (v) => { g.slab = [g.slab?.[0] ?? v, Math.max(0, v)]; }, { min: 0, max: 200, step: 2, after: refresh }),
      slider('Kerb, px in front of the walk line (0: none, no road)', g.kerb ?? 0, (v) => { if (v > 0) g.kerb = v; else delete g.kerb; }, { min: 0, max: 400, step: 5, after: refresh }),
      slider('Puddles when wet', g.puddles ?? 0, (v) => { g.puddles = Math.min(1, Math.max(0, v)); }, { min: 0, max: 1, after: refresh }),
    );
  }, { badge: g ? 'on' : 'off' }));
  side(section('luna', 'Luna', (body) => {
    el('p', 'ed-note', body, 'To judge the light on. Drag the triangle at her feet to move her, or have her follow the pointer: she walks, jogs or runs to it along the walk line, as she would that far in the game.');
    body.append(
      check('Show Luna', luna.show, (v) => { luna.show = v; }),
      check('Move the camera with her, as in the game', luna.follow, (v) => { luna.follow = v; }),
      check('She follows the pointer, at the game’s pace', luna.track, (v) => { luna.track = v; }),
      choice('Luna faces', String(luna.facing), [['1', 'Right'], ['-1', 'Left']], (v) => { luna.facing = Number(v) as 1 | -1; }),
    );
  }));
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
