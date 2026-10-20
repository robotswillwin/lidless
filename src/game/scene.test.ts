import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LoadedScene, MoverDef, Sprite, SpriteDef } from '../engine/assets';
import { SceneRunner } from './scene';

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
