// Lidless: boot, the frame loop, the view switch and quality tiers.

import './style.css';
import { loadScene } from './engine/assets';
import { NH, NW, QUALITY, Renderer, type Tier } from './engine/renderer';
import { SceneRunner, type ViewState } from './game/scene';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const viewBtn = document.getElementById('view') as HTMLButtonElement;
const viewLabel = document.getElementById('view-label') as HTMLElement;
const stats = document.getElementById('stats') as HTMLElement;
const errorBox = document.getElementById('error') as HTMLElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function pickTier(): Tier {
  const q = params.get('q');
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return matchMedia('(pointer: coarse)').matches ? 'medium' : 'high';
}

/** Match the canvas to the device pixels it covers, so the sharp upscale has real pixels to work with. */
function fitCanvas(): void {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = Math.max(NW, Math.min(3840, Math.round(canvas.clientWidth * dpr)));
  const h = Math.round((w * NH) / NW);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

async function boot(): Promise<void> {
  const renderer = new Renderer(canvas, QUALITY[pickTier()]);
  const scene = await loadScene(renderer.gl, `${import.meta.env.BASE_URL}assets/styleframe`);
  const runner = new SceneRunner(scene);
  const state: ViewState = { view: params.get('view') === 'raw' ? 0 : 1, sinceSwitch: 10 };
  const t0 = performance.now(), fixedT = params.has('t') ? Number(params.get('t')) : null;
  const clock = () => fixedT ?? (performance.now() - t0) / 1000;
  let switchedAt = -10, last = 0, frames = 0, fpsAt = performance.now(), fps = 0;

  const draw = () => {
    const t = clock();
    state.sinceSwitch = reduceMotion ? 10 : t - switchedAt;
    fitCanvas();
    renderer.render(runner.frame(t, state, [0, 0]));
    frames++;
    const now = performance.now();
    if (now - fpsAt > 500) { fps = (frames * 1000) / (now - fpsAt); frames = 0; fpsAt = now; }
    if (!stats.hidden) stats.textContent = `${renderer.quality.tier} · ${fps.toFixed(0)} fps · ${canvas.width}×${canvas.height}`;
  };

  const sync = () => {
    viewBtn.setAttribute('aria-pressed', String(state.view > 0.5));
    viewLabel.textContent = state.view > 0.5 ? 'Concierge view' : 'Raw view';
  };
  const toggle = () => {
    state.view = state.view > 0.5 ? 0 : 1;
    switchedAt = clock();
    sync();
    if (reduceMotion) draw();
  };
  const cycleTier = () => {
    const order: Tier[] = ['low', 'medium', 'high'];
    renderer.quality = QUALITY[order[(order.indexOf(renderer.quality.tier) + 1) % order.length]];
    stats.hidden = false;
    if (reduceMotion) draw();
  };

  viewBtn.addEventListener('click', toggle);
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea/i.test((e.target as HTMLElement).tagName)) return;
    if (e.key === 'e' || e.key === 'E') toggle();
    if (e.key === 'q' || e.key === 'Q') cycleTier();
  });
  stats.hidden = !params.has('debug');
  sync();
  draw();
  document.documentElement.dataset.ready = '1';
  if (reduceMotion || fixedT !== null) return;

  let visible = true;
  document.addEventListener('visibilitychange', () => { visible = document.visibilityState === 'visible'; });
  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (!visible || now - last < 15) return;
    last = now;
    draw();
  };
  requestAnimationFrame(loop);
}

boot().catch((err: unknown) => {
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  errorBox.hidden = false;
  errorBox.textContent = `Lidless could not start: ${msg}`;
  document.documentElement.dataset.err = msg;
});
