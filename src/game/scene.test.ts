import { afterEach, describe, expect, it, vi } from 'vitest';
import { slideOpacity, type LoadedScene, type MoverDef, type Sprite, type SpriteDef } from '../engine/assets';
import { patrolAt, pulseAt, SceneRunner, travelled } from './scene';

const sprite = (name: string, def: Partial<SpriteDef> = {}, hasMeta = false): Sprite => ({
  def: { name, x: 0, y: 0, w: 960, h: 540, maps: ['albedo.raw'], depth: 3, parallax: 1, res: 2, ...def },
  tex: {} as Sprite['tex'], hasMeta, size: [1920, 1080],
});

const train = sprite('train', { w: 100, h: 20, y: 230 });
const mover: MoverDef = { asset: 'street/train', after: 'street/mid', x0: 100, x1: 500, speed: 100, wait: [10, 20] };

function scene(layers: Sprite[], movers: LoadedScene['movers'] = []): LoadedScene {
  return {
    def: { name: 'street', size: [960, 540], sprites: layers.map((s) => s.def.name), zone: '', lights: [], beacons: [], steam: [], godrays: [], mirror: 452 },
    sprites: layers, zone: {} as WebGLTexture, movers,
  };
}

const view = { view: 1, sinceSwitch: 10 };

afterEach(() => { vi.restoreAllMocks(); });

describe('a scene’s frame', () => {
  it('blends the edges of flat layers over the first, so they slide smoothly', () => {
    const f = new SceneRunner(scene([sprite('far', { parallax: 0.3 }), sprite('mid', { parallax: 0.6 }), sprite('street')])).frame(0, view, [0, 0]);
    expect(f.sprites.map((s) => !!s.blend)).toEqual([false, true, true]);
  });

  it('keeps every layer cut out when the set has pixel art with flags of its own', () => {
    const f = new SceneRunner(scene([sprite('far'), sprite('shop', { res: 1 }, true)])).frame(0, view, [0, 0]);
    expect(f.sprites.some((s) => s.blend)).toBe(false);
  });

  it('moves each layer by its parallax', () => {
    const f = new SceneRunner(scene([sprite('far', { parallax: 0.3 }), sprite('street')])).frame(0, view, [10, 0]);
    expect(f.sprites.map((s) => s.x)).toEqual([-3, -10]);
  });
});

describe('sync', () => {
  it('reads steam and beacons again after they changed, as the scene editor changes them', () => {
    const sc = scene([sprite('far')]), r = new SceneRunner(sc);
    expect(r.frame(0, view, [0, 0]).steam[0]).toBe(0);
    sc.def.steam = [{ x: 120, y: 400, height: 90, width: 5, kind: 'smoke' }];
    sc.def.beacons = [{ x: 300, y: 40, phase: 1 }];
    r.sync();
    const f = r.frame(0, view, [0, 0]);
    expect(Array.from(f.steam.slice(0, 4))).toEqual([120, 400, 90, -5]);
    expect(f.nBeacons).toBe(1);
    expect(Array.from(f.beacons.slice(0, 3))).toEqual([300, 40, 1]);
  });
});

describe('movers', () => {
  const run = () => new SceneRunner(scene([sprite('far'), sprite('mid', { parallax: 0.6 }), sprite('street')], [{ def: mover, sprite: train, after: 1 }]));
  const trainIn = (f: ReturnType<SceneRunner['frame']>) => f.sprites.find((s) => s.sprite === train);

  it('waits a little after arriving, then crosses, drawn right after its layer, seen only between its ends', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const r = run();
    expect(trainIn(r.frame(0, view, [0, 0]))).toBeUndefined();
    // the first pass starts a quarter of the shortest wait in: 2.5 s
    const f = r.frame(3.5, view, [10, 0]), t = trainIn(f)!;
    expect(f.sprites.indexOf(t)).toBe(2);
    expect(t.x).toBeCloseTo(100 - 100 + 100 - 10 * 0.6, 5);
    expect(t.flip).toBe(false);
    expect(t.clip).toEqual([100 - 6, 500 - 6]);
  });

  it('goes the other way on its next pass, mirrored, after a wait', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const r = run();
    r.frame(0, view, [0, 0]);
    // a pass takes (500 - 100 + 100) / 100 = 5 s: the first ends at 7.5 s, the next starts 10 s later
    expect(trainIn(r.frame(8, view, [0, 0]))).toBeUndefined();
    expect(trainIn(r.frame(17, view, [0, 0]))).toBeUndefined();
    const t = trainIn(r.frame(18.5, view, [0, 0]))!;
    expect(t.flip).toBe(true);
    expect(t.x).toBeCloseTo(500 - 100, 5);
  });

  it('keeps going one way when it is told to', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const oneWay = new SceneRunner(scene([sprite('far'), sprite('mid'), sprite('street')], [{ def: { ...mover, dir: -1 }, sprite: train, after: 1 }]));
    oneWay.frame(0, view, [0, 0]);
    expect(trainIn(oneWay.frame(3, view, [0, 0]))!.flip).toBe(true);
    oneWay.frame(10, view, [0, 0]);
    expect(trainIn(oneWay.frame(18.5, view, [0, 0]))!.flip).toBe(true);
  });
});

describe('each view', () => {
  const raw = { view: 0, sinceSwitch: 10 };

  it('leaves out a layer placed for the other view, and draws one placed elsewhere in this view there', () => {
    const layers = [sprite('street'), sprite('holo', { only: 'concierge' }), sprite('crate', { x: 100, views: { raw: { x: 140 } } })];
    const co = new SceneRunner(scene(layers)).frame(0, view, [0, 0]), rw = new SceneRunner(scene(layers)).frame(0, raw, [0, 0]);
    expect(co.sprites.map((s) => s.sprite.def.name)).toEqual(['street', 'holo', 'crate']);
    expect(rw.sprites.map((s) => s.sprite.def.name)).toEqual(['street', 'crate']);
    expect(co.sprites[2].x).toBe(100);
    expect(rw.sprites[1].x).toBe(140);
  });

  it('gives each light its view’s own settings, and steam and beacons only where they are', () => {
    const sc = scene([sprite('street')]);
    sc.def.lights = [{ x: 10, y: 20, z: 30, r: 100, c: [1, 1, 1], i: 1, zone: 0, views: { raw: { i: 3 } } }];
    sc.def.steam = [{ x: 1, y: 2, height: 10, width: 4, kind: 'steam', only: 'raw' }, { x: 5, y: 6, height: 10, width: 4, kind: 'steam' }];
    sc.def.beacons = [{ x: 7, y: 8, phase: 0, only: 'concierge' }];
    const runner = new SceneRunner(sc);
    const co = runner.frame(0, view, [0, 0]);
    expect(co.lights[0].i).toBe(1);
    expect([...co.steam.slice(0, 8)]).toEqual([5, 6, 10, 4, 0, 0, 0, 0]);
    expect(co.nBeacons).toBe(1);
    // (read before the next frame, which fills the same arrays)
    const rw = runner.frame(0, raw, [0, 0]);
    expect(rw.lights[0].i).toBe(3);
    expect([...rw.steam.slice(0, 8)]).toEqual([1, 2, 10, 4, 5, 6, 10, 4]);
    expect(rw.nBeacons).toBe(0);
  });

  it('dims a light shaft out of its view, the older ar flag as well', () => {
    const sc = scene([sprite('street')]);
    sc.def.godrays = [{ x: 1, y: 1, strength: 0.5, zone: 0, only: 'raw' }, { x: 2, y: 2, strength: 0.4, zone: 0, ar: 1 }];
    // the runner fills the same arrays every frame: read each frame before the next
    const runner = new SceneRunner(sc), at = (v: typeof view) => { const g = runner.frame(0, v, [0, 0]).godrays; return [g[2], Math.round(g[6] * 100) / 100]; };
    expect(at(view)).toEqual([0, 0.4]);
    expect(at(raw)).toEqual([0.5, 0]);
  });
});

describe('a mover on its way', () => {
  it('goes at its speed, and stops a while where it stops', () => {
    expect(travelled(2, 10, [])).toBe(20);
    const stops = [{ at: 30, seconds: 4 }, { at: 50, seconds: 1 }];
    expect(travelled(2, 10, stops)).toBe(20);
    // reaches the first stop at 3 seconds, waits till 7, the second at 9, waits till 10
    expect(travelled(3, 10, stops)).toBe(30);
    expect(travelled(6.5, 10, stops)).toBe(30);
    expect(travelled(8, 10, stops)).toBe(40);
    expect(travelled(9.5, 10, stops)).toBe(50);
    expect(travelled(11, 10, stops)).toBe(60);
  });
});

describe('a guard on its round', () => {
  it('walks its beat, rests at each end, turns, and walks back', () => {
    // 100 px at 10 px/s: 10 s a way, 4 s rest at each end, a round of 28 s
    expect(patrolAt(0, 0, 100, 10, 4)).toMatchObject({ x: 0, dir: 1, moving: true });
    expect(patrolAt(5, 0, 100, 10, 4)).toMatchObject({ x: 50, dir: 1, moving: true, walked: 50 });
    expect(patrolAt(12, 0, 100, 10, 4)).toMatchObject({ x: 100, dir: 1, moving: false });
    expect(patrolAt(19, 0, 100, 10, 4)).toMatchObject({ x: 50, dir: -1, moving: true, walked: 150 });
    expect(patrolAt(26, 0, 100, 10, 4)).toMatchObject({ x: 0, dir: -1, moving: false });
    expect(patrolAt(28 + 5, 0, 100, 10, 4).x).toBe(50);
  });

  it('stops on the way where it stops, and is not walking then', () => {
    const p = patrolAt(6, 0, 100, 10, 4, [{ x: 50, seconds: 3 }]);
    expect(p).toMatchObject({ x: 50, moving: false });
    expect(patrolAt(9, 0, 100, 10, 4, [{ x: 50, seconds: 3 }])).toMatchObject({ x: 60, moving: true });
  });
});

describe('a pulsing light', () => {
  it('steps through its sequence on the clock', () => {
    const p = { fps: 10, seq: [0, 1, 0.5] };
    expect(pulseAt(p, 0)).toBe(0);
    expect(pulseAt(p, 0.15)).toBe(1);
    expect(pulseAt(p, 0.25)).toBe(0.5);
    expect(pulseAt(p, 0.35)).toBe(0);
  });
});

describe('an oscilloscope', () => {
  const withScope = (scopes: NonNullable<LoadedScene['def']['scopes']>) => { const sc = scene([sprite('bench')]); sc.def.scopes = scopes; return sc; };

  it('shows the shape its dial is at in the story, turning into it over a moment', () => {
    let dial = 'sine';
    const r = new SceneRunner(withScope([{ x: 800, y: 180, r: 48, wave: 'scope_wave' }]));
    r.read = () => dial;
    let f = r.frame(1, view, [0, 0]);
    expect(f.nScopes).toBe(1);
    expect([...f.scopes!.slice(0, 6)]).toEqual([800, 180, 48, 1, 1, 1]);
    expect([f.scopes![8], f.scopes![9]]).toEqual([48, 1]);
    dial = 'saw';
    f = r.frame(2, view, [0, 0]);
    expect([f.scopes![3], f.scopes![4], f.scopes![5]]).toEqual([4, 1, 0]);
    f = r.frame(2.35, view, [0, 0]);
    expect(f.scopes![5]).toBeCloseTo(1);
  });

  it('eases to the speed its other knob is at: more waves, creeping faster, without a jump', () => {
    let knob = 'slow';
    const r = new SceneRunner(withScope([{ x: 800, y: 180, r: 48, wave: 'scope_wave', speed: 'scope_speed' }]));
    r.read = (n) => (n === 'scope_speed' ? knob : undefined);
    let f = r.frame(1, view, [0, 0]);
    expect(f.scopes![7]).toBe(1);
    knob = 'fast';
    const before = f.scopes![6];
    f = r.frame(1.05, view, [0, 0]);
    expect(f.scopes![7]).toBeGreaterThan(1);
    expect(f.scopes![7]).toBeLessThan(4);
    expect(Math.abs(f.scopes![6] - before)).toBeLessThan(0.05);
    for (let t = 1.1; t < 3; t += 0.05) f = r.frame(t, view, [0, 0]);
    expect(f.scopes![7]).toBeCloseTo(4, 1);
  });

  it('a screen with corners: half its width and height, and its own colours', () => {
    const r = new SceneRunner(withScope([{ x: 10, y: 20, w: 30, h: 16, shape: 'voice', colours: { concierge: [1, 0.6, 0.2] } }]));
    const f = r.frame(0, view, [0, 0]);
    expect([f.scopes![2], f.scopes![3], f.scopes![8], f.scopes![9]]).toEqual([15, 5, 8, 0]);
    expect([...f.scopes!.slice(13, 16)].map((v) => Math.round(v * 100) / 100)).toEqual([1, 0.6, 0.2]);
  });

  it('a clock: where it is, and the time of day', () => {
    const sc = scene([sprite('shop')]);
    sc.def.clocks = [{ x: 777, y: 229, r: 12 }];
    const r = new SceneRunner(sc);
    r.daySeconds = (t) => 7 * 3600 + 12 * 60 + t;
    const f = r.frame(30, view, [0, 0]);
    expect(f.nClocks).toBe(1);
    expect([...f.clocks!.slice(0, 4)]).toEqual([777, 229, 12, 1]);
    expect(f.daySeconds).toBe(7 * 3600 + 12 * 60 + 30);
  });

  it('keeps its own shape without a dial; one in the other view, or not there yet, is not drawn', () => {
    const r = new SceneRunner(withScope([{ x: 1, y: 2, r: 3, shape: 'triangle' }, { x: 5, y: 5, r: 5, only: 'raw' }, { x: 9, y: 9, r: 9, when: 'has_raw' }]));
    r.shown = () => false;
    const f = r.frame(0, view, [0, 0]);
    expect(f.nScopes).toBe(1);
    expect(f.scopes![3]).toBe(3);
  });
});

describe('pictures shown in turn', () => {
  const show = (at: number) => ({ at, of: 3, every: 6, fade: 1.5 });
  it('shows one at a time, the next fading in over it, and the last fading out to the first', () => {
    expect([0, 1, 2].map((k) => slideOpacity(show(k), 3))).toEqual([1, 0, 0]);
    // the second fading in over the first, which stays until it is in
    expect(slideOpacity(show(1), 6.75)).toBeCloseTo(0.5);
    expect(slideOpacity(show(0), 6.75)).toBe(1);
    expect(slideOpacity(show(0), 8)).toBe(0);
    // round again: the first already there under the last, which fades out
    expect(slideOpacity(show(0), 18.75)).toBe(1);
    expect(slideOpacity(show(2), 18.75)).toBeCloseTo(0.5);
    expect(slideOpacity({ at: 0, of: 1, every: 5 }, 2)).toBe(1);
  });
});

describe('a Newton\'s cradle', () => {
  const withCradle = () => { const sc = scene([sprite('desk')]); sc.def.cradles = [{ x: 600, y: 140, gap: 17, length: 64, r: 8, swings: 'swings', posts: [590, 596, 690, 696] }]; return sc; };
  it('swings each time her count of swings goes up, from alternate ends; not for the count she arrives with', () => {
    let n = 3;
    const r = new SceneRunner(withCradle());
    r.read = () => n;
    let f = r.frame(10, view, [0, 0]);
    expect(f.cradle![5]).toBeGreaterThan(40);
    n = 4;
    f = r.frame(11, view, [0, 0]);
    expect([f.cradle![5], f.cradle![6], f.cradle![7]]).toEqual([0, -1, 1]);
    f = r.frame(12.5, view, [0, 0]);
    expect(f.cradle![5]).toBeCloseTo(1.5);
    n = 5;
    expect(r.frame(13, view, [0, 0]).cradle![6]).toBe(1);
    expect([...f.cradle!.slice(8)]).toEqual([590, 596, 690, 696]);
  });
});

describe('a hologram of rings', () => {
  const withRings = () => { const sc = scene([sprite('desk')]); sc.def.rings = [{ x: 300, y: 170, r: 34, turns: ['a', 'b', 'c'], solved: 'done' }]; return sc; };
  it('turns each ring the way the story did, a sixth at a time, easing; and knows when its gaps lined up', () => {
    const v: Record<string, unknown> = { a: 2, b: 4, c: 1, done: false };
    const r = new SceneRunner(withRings());
    r.read = (n) => v[n];
    let f = r.frame(0, view, [0, 0]);
    expect(f.rings![4]).toBeCloseTo((2 * Math.PI) / 3);
    expect(f.rings![7]).toBe(-1);
    v.a = 3;
    for (let t = 0.05; t < 2; t += 0.05) f = r.frame(t, view, [0, 0]);
    expect(f.rings![4]).toBeCloseTo(Math.PI, 2);
    // from five round to nought: forward a sixth, not back five
    v.b = 5;
    r.frame(2, view, [0, 0]);
    v.b = 0;
    for (let t = 2.05; t < 4; t += 0.05) f = r.frame(t, view, [0, 0]);
    expect(f.rings![5]).toBeCloseTo(2 * Math.PI, 2);
    v.done = true;
    f = r.frame(4, view, [0, 0]);
    expect(f.rings![7]).toBe(0);
    expect(r.frame(5, view, [0, 0]).rings![7]).toBe(1);
  });
});

