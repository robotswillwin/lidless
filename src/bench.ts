// The asset bench: a sprite from the pipeline, lit by the game's own renderer, next to the maps it was built from.
// Open bench.html on the dev server; it reloads the asset by itself when the pipeline rebuilds it.

import './style.css';
import { loadScene, loadSprite, spriteDefaults, type LightDef, type MapName, type Sprite, type SpriteDef } from './engine/assets';
import { solidTexture, textureFromImage } from './engine/gl';
import { fitCanvas, NH, NW, QUALITY, Renderer, type DrawSprite, type Frame, type Tier } from './engine/renderer';
import { lightGroups, SceneRunner, switchFade } from './game/scene';

/** The walk line of the style frame street: feet stand here. */
const GROUND = 464;
const base = `${import.meta.env.BASE_URL}assets`;
const params = new URLSearchParams(location.search);
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = el<HTMLCanvasElement>('game'), sceneIn = el<HTMLInputElement>('scene'), assetSel = el<HTMLSelectElement>('asset');
const backdropSel = el<HTMLSelectElement>('backdrop'), lightSel = el<HTMLSelectElement>('light'), xIn = el<HTMLInputElement>('x');
const flipIn = el<HTMLInputElement>('flip'), walkIn = el<HTMLInputElement>('walk');
const viewBtn = el<HTMLButtonElement>('view'), viewLabel = el<HTMLElement>('view-label');
const info = el<HTMLElement>('info'), mapsBox = el<HTMLElement>('maps'), errorBox = el<HTMLElement>('error');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const tier = params.get('q');
const renderer = new Renderer(canvas, QUALITY[tier === 'low' || tier === 'medium' ? tier : 'high']);
const gl = renderer.gl, fallback = spriteDefaults(gl);

/* ---------- the plain backdrop: a concrete wall and wet asphalt, made here so it needs no files ---------- */

/** Deterministic noise, so screenshots of the bench stay comparable. */
function rnd(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function paint(w: number, h: number, fn: (x: number, y: number) => [number, number, number]): WebGLTexture {
  const img = new ImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { img.data.set(fn(x, y), (y * w + x) * 4); img.data[(y * w + x) * 4 + 3] = 255; }
  return textureFromImage(gl, img);
}

function backdropSprite(def: Omit<SpriteDef, 'maps' | 'parallax'>, tex: Partial<Record<MapName, WebGLTexture>>): Sprite {
  const alb = tex['albedo.raw']!;
  return {
    def: { ...def, maps: [], parallax: 0 },
    hasMeta: !!tex.meta,
    tex: { 'albedo.raw': alb, 'albedo.concierge': alb, normal: tex.normal ?? fallback.normal, material: tex.material ?? fallback.material, meta: tex.meta ?? fallback.meta, 'glow.raw': fallback.glow, 'glow.concierge': fallback.glow },
  };
}

function plainBackdrop(): DrawSprite[] {
  const PW = 160, PH = 116, FH = NH - GROUND;
  // panels with recessed seams; dirt runs down from each horizontal seam; a darker kerb where the wall meets the street
  const wall = backdropSprite({ name: 'bench-wall', x: 0, y: 0, w: NW, h: GROUND, depth: 2 }, {
    'albedo.raw': paint(NW, GROUND, (x, y) => {
      const px = x % PW, py = y % PH, row = Math.floor(y / PH);
      const grime = py < 44 ? (1 - py / 44) * rnd(x >> 2, row + 50) * 12 : 0;
      let v = 30 + rnd(Math.floor(x / PW), row) * 8 + rnd(x >> 1, y >> 1) * 5 + rnd(x, y) * 3 - grime;
      if (px < 2 || py < 2) v *= 0.5;
      if (y >= GROUND - 6) v *= 0.7;
      return [v * 0.94, v, v * 1.1];
    }),
    normal: paint(NW, GROUND, (x, y) => {
      const px = x % PW, py = y % PH, nx = px === 0 ? 0.6 : px === 1 ? -0.6 : 0, ny = py === 0 ? 0.6 : py === 1 ? -0.6 : 0;
      return [128 + nx * 127, 128 + ny * 127, 128 + Math.sqrt(1 - nx * nx - ny * ny) * 127];
    }),
    material: solidTexture(gl, [14, 40, 0, 255]),
  });
  const puddles = [[480, 500, 170, 15], [150, 522, 90, 8], [820, 510, 110, 10]];
  const wet = (x: number, y: number) => puddles.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + (rnd(x >> 2, y >> 1) - 0.5) * 0.35 < 1);
  // the meta map marks puddles as mirrors (reflectivity 2) on otherwise damp asphalt (1); see docs/ASSETS.md
  const floor = backdropSprite({ name: 'bench-floor', x: 0, y: GROUND, w: NW, h: FH, depth: 3 }, {
    'albedo.raw': paint(NW, FH, (x, y) => { const v = (17 + rnd(x >> 1, y >> 1) * 6 + rnd(x, y + 999) * 3) * (wet(x, y + GROUND) ? 0.6 : 1); return [v * 0.95, v, v * 1.08]; }),
    material: paint(NW, FH, (x, y) => (wet(x, y + GROUND) ? [153, 217, 0] : [64, 115, 0])),
    meta: paint(NW, FH, (x, y) => [0, 3 * 64 + (wet(x, y + GROUND) ? 2 : 1) * 16, 0]),
  });
  return [{ sprite: wall, x: 0, y: 0 }, { sprite: floor, x: 0, y: GROUND }];
}

/* ---------- light rigs for the plain backdrop ---------- */

interface Rig { zone: WebGLTexture; lights: LightDef[] }
// zone map colours: g = outside (cold ambient, rain, the raw-view grade); none at all for the studio
const outside = solidTexture(gl, [0, 255, 255, 255]), neutral = solidTexture(gl, [0, 0, 255, 255]);
const RIGS: Record<string, Rig> = {
  // a street lamp overhead and a little warm bounce from below
  lamp: { zone: outside, lights: [
    { x: 560, y: 150, z: 40, r: 440, c: [0.8, 0.93, 1], i: 2.6, zone: 0, cone: [-0.25, 0.97, 0.45], haze: 0.45, shadow: 1, wrap: 0.3 },
    { x: 300, y: 430, z: 30, r: 260, c: [1, 0.6, 0.3], i: 0.5, zone: 0 },
  ] },
  // warm light spilling from a shop door on the left, under a dim sky
  door: { zone: outside, lights: [
    { x: 250, y: 330, z: 60, r: 380, c: [1, 0.62, 0.3], i: 2.4, zone: 0, haze: 0.2, shadow: 1 },
    { x: 700, y: 40, z: 200, r: 700, c: [0.4, 0.5, 0.8], i: 0.4, zone: 0 },
  ] },
  // the Concierge's neon on both sides; only a dim sky remains in raw view
  neon: { zone: outside, lights: [
    { x: 640, y: 300, z: 10, r: 260, c: [1, 0.22, 0.62], i: 2.2, zone: 0, haze: 0.3, ar: 1 },
    { x: 320, y: 300, z: 10, r: 260, c: [0.25, 0.9, 1], i: 2, zone: 0, haze: 0.3, ar: 1 },
    { x: 480, y: 60, z: 160, r: 600, c: [0.55, 0.65, 0.85], i: 0.55, zone: 0 },
  ] },
  // even, neutral light with no ambient or rain: for judging the colours and maps themselves
  studio: { zone: neutral, lights: [
    { x: 330, y: 120, z: 260, r: 1000, c: [1, 0.97, 0.92], i: 1.7, zone: 0, wrap: 0.5 },
    { x: 700, y: 300, z: 200, r: 900, c: [0.85, 0.9, 1], i: 0.6, zone: 0, wrap: 0.5 },
  ] },
};

/* ---------- state ---------- */

const plain = plainBackdrop();
let street: SceneRunner | null = null;
let asset: Sprite | null = null, assetDir = '', bust = '', loadToken = 0, view = params.get('view') === 'raw' ? 0 : 1, switchedAt = -10;
const t0 = performance.now(), fixedT = params.has('t') ? Number(params.get('t')) : null;
const clock = () => fixedT ?? (performance.now() - t0) / 1000;
const still = { cars: new Float32Array(64), beacons: new Float32Array(128), steam: new Float32Array(16), godrays: new Float32Array(16) };

sceneIn.value = params.get('scene') ?? 'test';
backdropSel.value = params.get('backdrop') === 'street' ? 'street' : 'plain';
lightSel.value = params.get('light') && RIGS[params.get('light')!] ? params.get('light')! : 'lamp';
flipIn.checked = params.get('flip') === '1';
walkIn.checked = params.get('walk') === '1';
let startX = params.has('x') ? Number(params.get('x')) : null;

function showError(msg: string | null): void {
  errorBox.hidden = !msg;
  errorBox.textContent = msg ?? '';
  if (msg) document.documentElement.dataset.err = msg;
  else delete document.documentElement.dataset.err;
}

function persist(): void {
  const p = new URLSearchParams({ scene: sceneIn.value.trim(), asset: asset?.def.name ?? '', backdrop: backdropSel.value, light: lightSel.value, x: xIn.value });
  if (view < 0.5) p.set('view', 'raw');
  if (flipIn.checked) p.set('flip', '1');
  if (walkIn.checked) p.set('walk', '1');
  for (const k of ['q', 't']) if (params.has(k)) p.set(k, params.get(k)!);
  history.replaceState(null, '', `?${p}`);
}

const PRESENCE = { both: 'real', concierge: 'generated: only in Concierge view', raw: 'edited out by the Concierge: only in raw view' };

function showInfo(reloaded: boolean): void {
  if (!asset) return void (info.textContent = '');
  const d = asset.def, two = d.maps.includes('albedo.concierge');
  const kind = d.exists && d.exists !== 'both' ? PRESENCE[d.exists] : two ? 'augmented: a raw look and a Concierge look' : 'the same in both views';
  const lit = backdropSel.value === 'street' ? 'lit by the street’s own lights' : `${lightSel.selectedOptions[0]?.text.toLowerCase()} light`;
  info.textContent = [`${d.w}×${d.h} px · depth ${d.depth}${d.occluder ? ' · casts shadows' : ''}`, kind, `${lit} · ${renderer.quality.tier} quality`, reloaded ? `reloaded ${new Date().toLocaleTimeString()}` : ''].filter(Boolean).join('\n');
}

function showMaps(): void {
  if (!asset) return mapsBox.replaceChildren();
  const name = asset.def.name;
  mapsBox.replaceChildren(...asset.def.maps.map((m) => {
    const fig = document.createElement('figure'), img = new Image(), cap = document.createElement('figcaption');
    img.src = `${assetDir}/${m}.png?v=${bust}`;
    img.alt = `${name}: ${m} map`;
    cap.textContent = m;
    fig.append(img, cap);
    return fig;
  }));
}

/** Free an asset's textures, leaving the shared fallbacks alone. */
function dispose(s: Sprite): void {
  const shared = new Set<WebGLTexture>(Object.values(fallback));
  for (const t of new Set(Object.values(s.tex))) if (!shared.has(t)) gl.deleteTexture(t);
}

/** Load an asset. A reload keeps its position; a newly picked one starts where its recipe puts it. */
async function selectAsset(name: string, reload: boolean, retry = true): Promise<void> {
  const token = ++loadToken, dir = `${base}/${sceneIn.value.trim()}`, stamp = String(Date.now());
  let next: Sprite;
  try {
    next = await loadSprite(gl, dir, name, fallback, stamp);
  } catch (err) {
    // the pipeline may still be writing files: try once more a moment later
    if (reload && retry) return void setTimeout(() => void selectAsset(name, true, false), 400);
    throw err;
  }
  if (token !== loadToken) return dispose(next);
  if (asset) dispose(asset);
  asset = next;
  assetDir = `${dir}/${name}`;
  bust = stamp;
  assetSel.value = name;
  if (!reload) {
    const d = next.def;
    xIn.value = String(startX ?? Math.round(d.x + (d.anchor?.[0] ?? d.w / 2)));
    startX = null;
  }
  showError(null);
  showMaps();
  showInfo(reload);
  persist();
}

async function loadList(prefer?: string): Promise<void> {
  const scene = sceneIn.value.trim(), res = await fetch(`${base}/${scene}/bench.json`, { cache: 'no-store' }).catch(() => null);
  if (!res?.ok) {
    asset = null;
    assetSel.replaceChildren();
    showMaps();
    showInfo(false);
    throw new Error(`Nothing built for "${scene}" yet. Build an asset with: npm run asset -- build art/${scene}/<name>.json`);
  }
  const names = ((await res.json()) as { assets: string[] }).assets;
  assetSel.replaceChildren(...names.map((n) => new Option(n, n)));
  const want = [prefer, asset?.def.name, params.get('asset')].find((n) => n && names.includes(n)) ?? names[0];
  if (want) await selectAsset(want, false);
}

async function useBackdrop(): Promise<void> {
  lightSel.disabled = backdropSel.value === 'street';
  if (backdropSel.value === 'street' && !street) street = new SceneRunner(await loadScene(gl, `${base}/styleframe`), new Set(['hero']));
  showInfo(false);
  persist();
}

/* ---------- drawing ---------- */

/** Walk back and forth across the street, facing the way it goes. */
function walkAt(t: number): [number, boolean] {
  const x0 = 100, span = 760, u = (t * 90) % (span * 2);
  return u < span ? [x0 + u, false] : [x0 + span - (u - span), true];
}

function draw(): void {
  fitCanvas(canvas);
  if (!asset) return;
  const t = clock(), d = asset.def, [ax] = d.anchor ?? [d.w / 2, d.h];
  const [cx, flip] = walkIn.checked ? walkAt(t) : [Number(xIn.value), flipIn.checked];
  const actor: DrawSprite = { sprite: asset, x: Math.round(cx - (flip ? d.w - ax : ax)), y: d.y, flip };
  const sinceSwitch = reduceMotion ? 10 : t - switchedAt;
  let f: Frame;
  if (backdropSel.value === 'street' && street) {
    // the hero is left out of the street; the smoke emitter that follows her cigarette goes off screen
    f = street.frame(t, { view, sinceSwitch }, [0, 0], [actor], [-1000, -1000]);
  } else {
    const rig = RIGS[lightSel.value] ?? RIGS.lamp;
    f = {
      t, view, glitch: switchFade(view, sinceSwitch), cam: [0, 0], level: [NW, NH], zone: rig.zone,
      sprites: [...plain, actor], lights: rig.lights, gi: lightGroups(t),
      cars: still.cars, nCars: 0, beacons: still.beacons, nBeacons: 0, steam: still.steam, godrays: still.godrays,
      drips: [0, 0, 0, 0], mirror: GROUND,
    };
  }
  renderer.render(f);
}

/* ---------- controls ---------- */

const syncView = () => {
  viewBtn.setAttribute('aria-pressed', String(view > 0.5));
  viewLabel.textContent = view > 0.5 ? 'Concierge view' : 'Raw view';
};
const toggleView = () => { view = view > 0.5 ? 0 : 1; switchedAt = clock(); syncView(); persist(); };
const report = (err: unknown) => showError(err instanceof Error ? err.message : String(err));

viewBtn.addEventListener('click', toggleView);
sceneIn.addEventListener('change', () => loadList().catch(report));
assetSel.addEventListener('change', () => selectAsset(assetSel.value, false).catch(report));
backdropSel.addEventListener('change', () => useBackdrop().catch(report));
lightSel.addEventListener('change', () => { showInfo(false); persist(); });
for (const input of [xIn, flipIn, walkIn]) input.addEventListener('input', persist);
el<HTMLFormElement>('panel').addEventListener('submit', (e) => e.preventDefault());

// E switches view, F turns the asset around, W walks it, Q cycles quality, arrows nudge it
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tgt = e.target;
  if ((tgt instanceof HTMLInputElement && tgt.type !== 'checkbox') || tgt instanceof HTMLSelectElement) return;
  const k = e.key.toLowerCase();
  if (k === 'e') toggleView();
  else if (k === 'f') flipIn.checked = !flipIn.checked;
  else if (k === 'w') walkIn.checked = !walkIn.checked;
  else if (k === 'q') {
    const order: Tier[] = ['low', 'medium', 'high'];
    renderer.quality = QUALITY[order[(order.indexOf(renderer.quality.tier) + 1) % order.length]];
    showInfo(false);
  } else if (k === 'arrowleft' || k === 'arrowright') {
    xIn.value = String(Number(xIn.value) + (k === 'arrowleft' ? -1 : 1) * (e.shiftKey ? 20 : 4));
    e.preventDefault();
  } else return;
  persist();
});

// The dev server says which files under public/assets changed: reload the asset that was rebuilt, or show a new one.
import.meta.hot?.on('lidless:asset', (data: { files: string[] }) => {
  const scene = sceneIn.value.trim(), parts = data.files.map((f) => f.split('/')).filter((p) => p[0] === scene);
  const built = parts.filter((p) => p.length === 3 && p[2] === 'sprite.json').map((p) => p[1]);
  const current = asset?.def.name, touched = !!current && parts.some((p) => p[1] === current);
  const listChanged = parts.some((p) => p.length === 2 && p[1] === 'bench.json');
  const fresh = built.find((n) => n !== current);
  if (listChanged || (fresh && !assetSel.querySelector(`option[value="${CSS.escape(fresh)}"]`))) loadList(fresh).catch(report);
  else if (fresh) selectAsset(fresh, false).catch(report);
  else if (touched) selectAsset(current, true).catch(report);
});

/* ---------- start ---------- */

syncView();
Promise.all([loadList(), useBackdrop()])
  .catch(report)
  .finally(() => {
    draw();
    document.documentElement.dataset.ready = '1';
    let last = 0;
    const loop = (now: number) => {
      requestAnimationFrame(loop);
      if (document.visibilityState !== 'visible' || now - last < 15) return;
      last = now;
      draw();
    };
    requestAnimationFrame(loop);
  });
